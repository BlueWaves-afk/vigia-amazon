'use client';

import { useState, useEffect } from 'react';
import { MapPin, X, Navigation } from 'lucide-react';

interface Pin {
  id: string;
  lat: number;
  lon: number;
  label: 'A' | 'B';
}

interface RouteData {
  fastest: {
    geometry: [number, number][];
    distance_km: number;
    duration_minutes: number;
    hazards_count: number;
  };
  safest: {
    geometry: [number, number][];
    distance_km: number;
    duration_minutes: number;
    hazards_count: number;
    hazards_avoided: number;
    detour_percent: number;
  };
  recommendation: string;
}

interface PinRoutingPanelProps {
  map: any;
  maplibregl: any;
  onRoutesCalculated?: (routes: RouteData) => void;
}

const getCssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const getPinColors = () => ({
  pinA: getCssVar('--c-red', '#EF4444'),
  pinB: getCssVar('--c-accent-2', '#3B82F6'),
  fastest: getCssVar('--c-accent-2', '#3B82F6'),
  safest: getCssVar('--c-green', '#22C55E'),
});

export function PinRoutingPanel({ map, maplibregl, onRoutesCalculated }: PinRoutingPanelProps) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteData | null>(null);

  // Listen for route data from agent
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__urbanPlannerPathTrigger = () => {
        const pathData = (window as any).__urbanPlannerPath;
        if (pathData) {
          setRoutes(pathData);
          plotRoutes(pathData);
        }
      };
    }
  }, [map]);

  const togglePinMode = () => {
    if (pinMode) {
      // Disable pin mode
      setPinMode(false);
      if (map) map.getCanvas().style.cursor = '';
    } else {
      // Enable pin mode
      setPinMode(true);
      if (map) map.getCanvas().style.cursor = 'crosshair';
    }
  };

  const addPin = (lat: number, lon: number) => {
    if (pins.length >= 2) return;
    
    const label = pins.length === 0 ? 'A' : 'B';
    const newPin: Pin = {
      id: `pin-${Date.now()}`,
      lat,
      lon,
      label,
    };
    
    setPins([...pins, newPin]);
    
    // Add marker to map
    if (map && maplibregl) {
      const colors = getPinColors();
      const el = document.createElement('div');
      el.className = 'pin-marker';
      el.innerHTML = `
        <div style="
          width: 32px;
          height: 32px;
          background: ${label === 'A' ? colors.pinA : colors.pinB};
          border: 3px solid var(--c-bg);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px color-mix(in srgb, var(--c-text) 30%, transparent);
        ">
          <span style="
            color: var(--c-text);
            font-weight: bold;
            font-size: 14px;
            transform: rotate(45deg);
          ">${label}</span>
        </div>
      `;
      
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lon, lat])
        .addTo(map);
      
      (marker as any)._pinId = newPin.id;
    }
    
    if (pins.length === 1) {
      // Second pin placed, disable pin mode
      setPinMode(false);
      if (map) map.getCanvas().style.cursor = '';
    }
  };

  const clearPins = () => {
    setPins([]);
    setRoutes(null);
    
    // Remove markers from map
    if (map) {
      const markers = map._markers || [];
      markers.forEach((m: any) => {
        if (m._pinId) m.remove();
      });
    }
    
    // Remove route layers
    if (map) {
      ['fastest-route', 'safest-route'].forEach(layerId => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(layerId)) map.removeSource(layerId);
      });
    }
  };

  const calculateRoutes = async () => {
    if (pins.length !== 2) return;
    
    const [pinA, pinB] = pins;
    
    // Send message to agent via window event with structured context
    const message = `Calculate the fastest and safest routes from Pin A at (${pinA.lat.toFixed(4)}, ${pinA.lon.toFixed(4)}) to Pin B at (${pinB.lat.toFixed(4)}, ${pinB.lon.toFixed(4)}). Return both route geometries with hazard analysis.`;
    
    // Trigger agent panel
    if (typeof window !== 'undefined') {
      (window as any).__agentContext = {
        type: 'pin-routing',
        start: { lat: pinA.lat, lon: pinA.lon },
        end: { lat: pinB.lat, lon: pinB.lon },
      };
      (window as any).__agentMessage = message;
      (window as any).__triggerAgent?.();
    }
  };

  const plotRoutes = (routeData: RouteData) => {
    if (!map) return;
    
    // Remove existing routes
    ['fastest-route', 'safest-route'].forEach(layerId => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(layerId)) map.removeSource(layerId);
    });
    
    // Add fastest route (blue dashed)
    const colors = getPinColors();
    map.addSource('fastest-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: routeData.fastest.geometry,
        },
      },
    });
    
    map.addLayer({
      id: 'fastest-route',
      type: 'line',
      source: 'fastest-route',
      paint: {
        'line-color': colors.fastest,
        'line-width': 4,
        'line-dasharray': [2, 2],
      },
    });
    
    // Add safest route (green solid)
    map.addSource('safest-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: routeData.safest.geometry,
        },
      },
    });
    
    map.addLayer({
      id: 'safest-route',
      type: 'line',
      source: 'safest-route',
      paint: {
        'line-color': colors.safest,
        'line-width': 4,
      },
    });
  };

  // Handle map clicks when in pin mode
  if (map && pinMode) {
    const handleMapClick = (e: any) => {
      if (pinMode && pins.length < 2) {
        addPin(e.lngLat.lat, e.lngLat.lng);
      }
    };
    
    map.off('click', handleMapClick);
    map.on('click', handleMapClick);
  }

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      background: 'var(--c-panel)',
      border: '1px solid var(--c-border)',
      borderRadius: 8,
      padding: 16,
      minWidth: 280,
      maxWidth: 320,
      boxShadow: 'var(--v-shadow-sm)',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>
          Route Planning
        </h3>
        {pins.length > 0 && (
          <button
            onClick={clearPins}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--c-text-2)',
            }}
            title="Clear pins"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={togglePinMode}
          disabled={pins.length >= 2}
          style={{
            padding: '8px 12px',
            background: pinMode ? 'var(--c-accent)' : 'var(--c-elevated)',
            color: pinMode ? 'var(--c-text)' : 'var(--c-text)',
            border: '1px solid var(--c-border)',
            borderRadius: 6,
            cursor: pins.length >= 2 ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: pins.length >= 2 ? 0.5 : 1,
          }}
        >
          <MapPin size={14} />
          {pinMode ? 'Click map to place pin' : `Drop Pin ${pins.length === 0 ? 'A' : 'B'}`}
        </button>

        {pins.length === 2 && !routes && (
          <button
            onClick={calculateRoutes}
            disabled={loading}
            style={{
              padding: '8px 12px',
              background: 'var(--c-accent)',
              color: 'var(--c-text)',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            <Navigation size={14} />
            {loading ? 'Calculating...' : 'Find Routes'}
          </button>
        )}

        {routes && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-text-2)' }}>
            <div style={{ marginBottom: 12, padding: 8, background: 'var(--c-bg)', borderRadius: 4 }}>
              <div style={{ fontWeight: 600, color: 'var(--c-accent-2)', marginBottom: 4 }}>Fastest Route</div>
              <div>Distance: {routes.fastest.distance_km} km</div>
              <div>Time: {routes.fastest.duration_minutes} min</div>
              <div>Hazards: {routes.fastest.hazards_count}</div>
            </div>

            <div style={{ marginBottom: 12, padding: 8, background: 'var(--c-bg)', borderRadius: 4 }}>
              <div style={{ fontWeight: 600, color: 'var(--c-green)', marginBottom: 4 }}>Safest Route</div>
              <div>Distance: {routes.safest.distance_km} km (+{routes.safest.detour_percent}%)</div>
              <div>Time: {routes.safest.duration_minutes} min</div>
              <div>Hazards: {routes.safest.hazards_count}</div>
              <div style={{ color: 'var(--c-green)', fontWeight: 500 }}>Avoided: {routes.safest.hazards_avoided} hazards</div>
            </div>

            <div style={{ padding: 8, background: 'var(--c-accent-glow)', borderRadius: 4, fontSize: 11 }}>
              <strong>Recommendation:</strong> {routes.recommendation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
