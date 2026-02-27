'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ─────────────────────────────────────────────
// LiveMap — ALL original logic preserved
// Map falls back to free OSM dark tiles when
// AWS Location API key is not configured
// ─────────────────────────────────────────────

type Hazard = {
  lat: number;
  lon: number;
  geohash: string;
  hazardType: string;
  confidence: number;
  status: string;
  verificationScore?: number;
  timestamp: string;
};

// ── Free dark map style (no API key needed) ──
const FREE_DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0E1117' },
    },
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-opacity': 0.82,
        'raster-brightness-min': 0.0,
        'raster-brightness-max': 0.22,
        'raster-saturation': -1.0,
        'raster-contrast': 0.1,
        'raster-hue-rotate': 195,
      },
    },
  ],
};

function getMapStyle(): string | maplibregl.StyleSpecification {
  const mapName = process.env.NEXT_PUBLIC_MAP_NAME;
  const apiKey  = process.env.NEXT_PUBLIC_LOCATION_API_KEY;

  // Use AWS only if both env vars are properly set
  if (mapName && mapName !== 'VigiaMap' && apiKey && apiKey.length > 10) {
    return `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`;
  }

  // Free dark fallback
  return FREE_DARK_STYLE;
}

export function LiveMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map          = useRef<maplibregl.Map | null>(null);
  const markers      = useRef<maplibregl.Marker[]>([]);

  const [hazards,       setHazards]       = useState<Hazard[]>([]);
  const [showUnverified, setShowUnverified] = useState(true);
  const [mapReady,       setMapReady]       = useState(false);

  // ── All original fetch logic preserved ────
  const fetchHazards = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return; // silently skip if no API configured
      const res  = await fetch(`${apiUrl}/hazards`);
      const data = await res.json();
      setHazards(data.hazards || []);
    } catch (e) {
      // Silently fail — map still renders without hazards
    }
  };

  // ── Marker style for dark map ─────────────
  const createMarkerElement = (verified: boolean) => {
    const el = document.createElement('div');
    el.style.width           = '10px';
    el.style.height          = '10px';
    el.style.borderRadius    = '50%';
    el.style.border          = `2px solid ${verified ? '#3B82F6' : 'rgba(255,255,255,0.25)'}`;
    el.style.backgroundColor = verified ? 'rgba(59,130,246,0.45)' : 'rgba(239,68,68,0.4)';
    el.style.cursor          = 'pointer';
    el.style.boxShadow       = verified
      ? '0 0 7px rgba(59,130,246,0.65)'
      : '0 0 5px rgba(239,68,68,0.45)';
    return el;
  };

  // ── All original map init logic preserved ─
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container:         mapContainer.current,
      style:             getMapStyle(),
      center:            [84.8814, 22.2604], // Rourkela, India
      zoom:              12,
      attributionControl: false,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );

    const resizeObserver = new ResizeObserver(() => map.current?.resize());
    resizeObserver.observe(mapContainer.current);

    map.current.on('load', () => {
      map.current?.resize();
      setMapReady(true);
    });

    map.current.on('styleimagemissing', (e) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, 1, 1);
        if (!map.current?.hasImage(e.id)) map.current?.addImage(e.id, imageData);
      }
    });

    fetchHazards();
    const interval = setInterval(fetchHazards, 30000);

    return () => {
      clearInterval(interval);
      resizeObserver.disconnect();
      map.current?.remove();
      map.current = null;
      setMapReady(false);
    };
  }, []);

  // ── All original marker logic preserved ───
  useEffect(() => {
    if (!map.current || !mapReady) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    hazards
      .filter((h) => h.status === 'verified' || showUnverified)
      .forEach((hazard) => {
        const el     = createMarkerElement(hazard.status === 'verified');
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([hazard.lon, hazard.lat])
          .addTo(map.current!);
        markers.current.push(marker);
      });
  }, [hazards, showUnverified, mapReady]);

  return (
    <div className="w-full h-full relative" style={{ background: '#0E1117' }}>
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Loading overlay */}
      {!mapReady && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: '#0E1117' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-7 h-7 rounded-full border-2 border-blue-500 animate-spin"
              style={{ borderTopColor: 'transparent' }}
            />
            <span
              style={{
                fontSize: '0.7rem',
                color: '#4B5563',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              Loading map...
            </span>
          </div>
        </div>
      )}

      {/* Hazard count overlay — top left */}
      {mapReady && (
        <div
          className="absolute top-3 left-3 flex items-center gap-3 px-3 py-1.5 rounded"
          style={{
            background: 'rgba(14,17,23,0.88)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(6px)',
            pointerEvents: 'none',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: '#3B82F6', boxShadow: '0 0 5px rgba(59,130,246,0.7)' }}
            />
            <span style={{ fontSize: '0.66rem', color: '#8B95A1', fontFamily: 'JetBrains Mono, monospace' }}>
              Verified
            </span>
            <span style={{ fontSize: '0.66rem', color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              {hazards.filter((h) => h.status === 'verified').length}
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.12)' }}>│</span>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: '#EF4444', boxShadow: '0 0 5px rgba(239,68,68,0.5)' }}
            />
            <span style={{ fontSize: '0.66rem', color: '#8B95A1', fontFamily: 'JetBrains Mono, monospace' }}>
              Unverified
            </span>
            <span style={{ fontSize: '0.66rem', color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              {hazards.filter((h) => h.status !== 'verified').length}
            </span>
          </div>
        </div>
      )}

      {/* Filter toggle — top right */}
      {mapReady && (
        <div className="absolute top-3 right-12">
          <label
            className="flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer select-none"
            style={{
              background: 'rgba(14,17,23,0.88)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <div
              className="relative w-7 h-4 rounded-full transition-colors flex-shrink-0"
              style={{ background: showUnverified ? '#2563EB' : 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                style={{ transform: showUnverified ? 'translateX(14px)' : 'translateX(2px)' }}
              />
            </div>
            <input
              type="checkbox"
              checked={showUnverified}
              onChange={(e) => setShowUnverified(e.target.checked)}
              className="sr-only"
            />
            <span style={{ fontSize: '0.68rem', color: '#8B95A1' }}>Show Unverified</span>
          </label>
        </div>
      )}
    </div>
  );
}
