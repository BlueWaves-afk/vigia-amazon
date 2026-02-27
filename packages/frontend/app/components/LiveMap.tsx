'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Hazard = {
  lat: number;
  lon: number;
  geohash: string;
};

export function LiveMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [routeVisible, setRouteVisible] = useState(false);

  // Mock hazards (replace with API call)
  const mockHazards: Hazard[] = [
    { lat: 37.7749, lon: -122.4194, geohash: '9q8yyk8' },
    { lat: 37.7850, lon: -122.4100, geohash: '9q8yyke' },
  ];

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapName = process.env.NEXT_PUBLIC_MAP_NAME || 'StandardMap';
    const apiKey = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`,
      center: [-122.4194, 37.7749],
      zoom: 12,
    });

    map.current.on('styleimagemissing', (e) => {
      // Suppress missing image warnings
      console.debug('Missing map image:', e.id);
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const drawSmartRoute = () => {
    if (!map.current) return;

    // Mock route: simple line from point A to B
    const start = [-122.4194, 37.7749];
    const end = [-122.4100, 37.7850];
    
    // Generate route points (simplified - in production use Location Service)
    const routePoints: [number, number][] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lon = start[0] + (end[0] - start[0]) * t;
      const lat = start[1] + (end[1] - start[1]) * t;
      routePoints.push([lon, lat]);
    }

    // Classify segments as safe (green) or dangerous (red)
    const safeSegments: [number, number][][] = [];
    const dangerSegments: [number, number][][] = [];

    for (let i = 0; i < routePoints.length - 1; i++) {
      const [lon, lat] = routePoints[i];
      const nextPoint = routePoints[i + 1];
      
      // Check if within 50m of any hazard
      const nearHazard = mockHazards.some(h => 
        calculateDistance(lat, lon, h.lat, h.lon) < 50
      );

      if (nearHazard) {
        dangerSegments.push([routePoints[i], nextPoint]);
      } else {
        safeSegments.push([routePoints[i], nextPoint]);
      }
    }

    // Remove existing route layers
    if (map.current.getLayer('route-safe')) map.current.removeLayer('route-safe');
    if (map.current.getLayer('route-danger')) map.current.removeLayer('route-danger');
    if (map.current.getSource('route-safe')) map.current.removeSource('route-safe');
    if (map.current.getSource('route-danger')) map.current.removeSource('route-danger');

    // Add safe segments (green)
    if (safeSegments.length > 0) {
      map.current.addSource('route-safe', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: safeSegments.map(segment => ({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: segment,
            },
          })),
        },
      });

      map.current.addLayer({
        id: 'route-safe',
        type: 'line',
        source: 'route-safe',
        paint: {
          'line-color': '#10b981',
          'line-width': 4,
        },
      });
    }

    // Add danger segments (red)
    if (dangerSegments.length > 0) {
      map.current.addSource('route-danger', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: dangerSegments.map(segment => ({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: segment,
            },
          })),
        },
      });

      map.current.addLayer({
        id: 'route-danger',
        type: 'line',
        source: 'route-danger',
        paint: {
          'line-color': '#ef4444',
          'line-width': 4,
        },
      });
    }

    // Add hazard markers
    mockHazards.forEach((hazard, i) => {
      new maplibregl.Marker({ color: '#ef4444' })
        .setLngLat([hazard.lon, hazard.lat])
        .setPopup(new maplibregl.Popup().setHTML(`<strong>Pothole</strong><br/>Geohash: ${hazard.geohash}`))
        .addTo(map.current!);
    });

    setRouteVisible(true);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Route Controls */}
      <div className="absolute top-4 right-4 z-10 bg-vigia-panel p-3 rounded-lg border border-gray-800">
        <button
          onClick={drawSmartRoute}
          className="px-4 py-2 bg-vigia-accent text-white rounded hover:bg-blue-600 text-sm"
        >
          {routeVisible ? 'Route Active' : 'Show Smart Route'}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-vigia-panel p-3 rounded-lg border border-gray-800 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-1 bg-vigia-success"></div>
          <span className="text-gray-300">Safe Route</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-vigia-danger"></div>
          <span className="text-gray-300">Hazard Zone</span>
        </div>
      </div>
    </div>
  );
}
