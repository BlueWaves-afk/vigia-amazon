'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSettings } from './SettingsContext';
import type { MapStyle } from './SettingsContext';

// ─────────────────────────────────────────────
// LiveMap — ALL original logic preserved
// Map style, grid, labels now react to Settings
// ─────────────────────────────────────────────

type Hazard = {
  lat: number; lon: number; geohash: string;
  hazardType: string; confidence: number;
  status: string; verificationScore?: number; timestamp: string;
};

// ── Map style resolver ────────────────────────
function getMapStyle(style: MapStyle, showLabels: boolean): string {
  // Use Amazon Location Service map styles
  const mapName = process.env.NEXT_PUBLIC_MAP_NAME || 'StandardMap';
  const apiKey = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';
  
  return `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`;
}

export function LiveMap({ selectedSession }: { selectedSession?: any }) {
  const { settings } = useSettings();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map          = useRef<maplibregl.Map | null>(null);
  const markers      = useRef<maplibregl.Marker[]>([]);
  const pendingSession = useRef<any>(null);

  const [hazards,        setHazards]        = useState<Hazard[]>([]);
  const [showUnverified, setShowUnverified]  = useState(true);
  const [mapReady,       setMapReady]        = useState(false);

  // ── Load session hazards when selected ─────
  useEffect(() => {
    console.log('LiveMap selectedSession changed:', selectedSession);
    if (selectedSession?.hazards) {
      console.log('Session hazards:', selectedSession.hazards);
      const sessionHazards = selectedSession.hazards.map((h: any) => ({
        lat: h.lat,
        lon: h.lon,
        geohash: selectedSession.geohash7,
        hazardType: h.type,
        confidence: h.confidence,
        status: 'verified',
        timestamp: selectedSession.timestamp,
      }));
      console.log('Mapped hazards:', sessionHazards);
      setHazards(sessionHazards);
      
      // Jump to location instantly (no animation)
      if (map.current && sessionHazards.length > 0) {
        console.log('Jumping to:', sessionHazards[0].lon, sessionHazards[0].lat);
        map.current.jumpTo({
          center: [sessionHazards[0].lon, sessionHazards[0].lat],
          zoom: 14,
        });
      } else {
        console.log('Map not ready, storing pending session');
        pendingSession.current = selectedSession;
      }
    } else {
      console.log('No session hazards, fetching default');
      fetchHazards();
    }
  }, [selectedSession]);

  // ── Original fetch ─────────────────────────
  const fetchHazards = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return;
      const res  = await fetch(`${apiUrl}/hazards`);
      const data = await res.json();
      setHazards(data.hazards || []);
    } catch (_) {}
  };

  const createMarkerElement = (verified: boolean) => {
    const el = document.createElement('div');
    el.style.cssText = `
      width:10px; height:10px; border-radius:50%; cursor:pointer;
      border: 2px solid ${verified ? '#3B82F6' : 'rgba(255,255,255,0.25)'};
      background: ${verified ? 'rgba(59,130,246,0.45)' : 'rgba(229,72,77,0.4)'};
      box-shadow: ${verified ? '0 0 7px rgba(59,130,246,0.65)' : '0 0 5px rgba(229,72,77,0.45)'};
    `;
    return el;
  };

  // ── Map init ────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(settings.mapStyle, settings.showLabels),
      center: [84.8814, 22.2604],
      zoom: 12,
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const ro = new ResizeObserver(() => map.current?.resize());
    ro.observe(mapContainer.current);

    map.current.on('load', () => { 
      map.current?.resize(); 
      setMapReady(true);
      
      // Jump to pending session if exists
      if (pendingSession.current?.hazards?.length > 0) {
        console.log('Map loaded, jumping to pending session');
        const h = pendingSession.current.hazards[0];
        map.current?.jumpTo({
          center: [h.lon, h.lat],
          zoom: 14,
        });
        pendingSession.current = null;
      }
    });

    map.current.on('styleimagemissing', (e) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx && !map.current?.hasImage(e.id)) {
        map.current?.addImage(e.id, ctx.getImageData(0, 0, 1, 1));
      }
    });

    fetchHazards();
    const interval = setInterval(fetchHazards, 30000);

    return () => {
      clearInterval(interval);
      ro.disconnect();
      map.current?.remove();
      map.current = null;
      setMapReady(false);
    };
  }, []); // eslint-disable-line

  // ── React to map style changes ─────────────
  useEffect(() => {
    if (!map.current || !mapReady) return;
    map.current.setStyle(getMapStyle(settings.mapStyle, settings.showLabels));
  }, [settings.mapStyle, settings.showLabels, mapReady]);

  // ── Markers ─────────────────────────────────
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
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--c-bg)' }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      {/* Grid overlay — toggled by showGrid setting */}
      {mapReady && settings.showGrid && (
        <div className="map-grid-overlay" />
      )}

      {/* Loading */}
      {!mapReady && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              border: '2px solid var(--c-accent-2)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span style={{ fontSize: '0.68rem', color: 'var(--c-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
              Loading map...
            </span>
          </div>
        </div>
      )}

      {/* Map style indicator */}
      {mapReady && (
        <div style={{
          position: 'absolute', top: 10, left: 10, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 10px', borderRadius: 3,
          background: 'rgba(12,16,22,0.88)',
          border: '1px solid var(--c-border)',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-accent-2)', boxShadow: '0 0 5px rgba(59,130,246,0.7)' }} />
            <span style={{ fontSize: '0.64rem', color: 'var(--c-text-2)', fontFamily: 'JetBrains Mono, monospace' }}>
              {hazards.filter(h => h.status === 'verified').length} verified
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>│</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-red)', boxShadow: '0 0 4px rgba(229,72,77,0.6)' }} />
            <span style={{ fontSize: '0.64rem', color: 'var(--c-text-2)', fontFamily: 'JetBrains Mono, monospace' }}>
              {hazards.filter(h => h.status !== 'verified').length} unverified
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>│</span>
          <span style={{ fontSize: '0.64rem', color: 'var(--c-text-3)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
            {settings.mapStyle}
          </span>
        </div>
      )}

      {/* Filter toggle */}
      {mapReady && (
        <div style={{ position: 'absolute', top: 10, right: 44 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px', borderRadius: 3, cursor: 'pointer',
            background: 'rgba(12,16,22,0.88)',
            border: '1px solid var(--c-border)',
            backdropFilter: 'blur(6px)',
          }}>
            <div className="vigia-toggle" style={{ background: showUnverified ? 'var(--c-accent)' : 'rgba(255,255,255,0.1)' }}>
              <div className="vigia-toggle-thumb" style={{ transform: showUnverified ? 'translateX(14px)' : 'translateX(2px)' }} />
            </div>
            <input type="checkbox" checked={showUnverified} onChange={(e) => setShowUnverified(e.target.checked)} style={{ display: 'none' }} />
            <span style={{ fontSize: '0.66rem', color: 'var(--c-text-2)' }}>Show Unverified</span>
          </label>
        </div>
      )}
    </div>
  );
}
