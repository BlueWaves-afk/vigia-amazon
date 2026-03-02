'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSettings } from './SettingsContext';
import type { MapStyle } from './SettingsContext';
import { DiffMarkersLayer } from './DiffMarkersLayer';
import { DiffLegend } from './DiffLegend';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Hazard = {
  lat: number; lon: number; geohash: string;
  hazardType: string; confidence: number;
  status: string; verificationScore?: number; timestamp: string;
};

// ─────────────────────────────────────────────
// Canvas CSS filter per map style
// Applied directly to the <canvas> element so
// ANY tile source (AWS, OSM, etc.) gets darkened.
// This is the reliable cross-source approach.
// ─────────────────────────────────────────────

const MAP_FILTERS: Record<MapStyle, string> = {
  'dark-osm':  'brightness(0.82) saturate(0.50) hue-rotate(192deg) contrast(1.05)',
  'satellite': 'brightness(0.72) saturate(0.70) hue-rotate(160deg) contrast(1.08)',
  'terrain':   'brightness(0.75) saturate(0.55) hue-rotate(30deg)  contrast(1.06) sepia(0.12)',
  'minimal':   'brightness(0.60) saturate(0.20) contrast(1.10)',
};

// ─────────────────────────────────────────────
// getMapStyle — returns AWS style URL
// We switch visual appearance via CSS filter above
// Map name can be swapped per style if env vars exist
// ─────────────────────────────────────────────

function getMapStyle(style: MapStyle): string {
  const apiKey = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';

  // If env has per-style map names, use them
  const styleMapNames: Partial<Record<MapStyle, string>> = {
    'satellite': process.env.NEXT_PUBLIC_MAP_NAME_SATELLITE || '',
    'terrain':   process.env.NEXT_PUBLIC_MAP_NAME_TERRAIN   || '',
  };

  // Fallback: OSM-based free tiles (no AWS key needed)
  const OSM_STYLE: maplibregl.StyleSpecification = {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap',
        maxzoom: 19,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0A0E15' } },
      { id: 'osm-tiles',  type: 'raster', source: 'osm', paint: { 'raster-opacity': 1 } },
    ],
  };

  // Use per-style AWS map name if provided, else fallback
  const specificMap = styleMapNames[style];
  if (specificMap && apiKey) {
    return `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${specificMap}/style-descriptor?key=${apiKey}`;
  }

  const defaultMap = process.env.NEXT_PUBLIC_MAP_NAME || '';
  if (defaultMap && apiKey) {
    return `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${defaultMap}/style-descriptor?key=${apiKey}`;
  }

  // No keys — use OSM
  return OSM_STYLE as any;
}

// ─────────────────────────────────────────────
// Apply CSS filter to the map canvas
// Called whenever mapStyle setting changes
// ─────────────────────────────────────────────

function applyMapFilter(mapEl: HTMLDivElement | null, style: MapStyle) {
  if (!mapEl) return;
  const canvas = mapEl.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas) {
    canvas.style.filter = MAP_FILTERS[style];
    canvas.style.transition = 'filter 0.4s ease';
  }
}

// ─────────────────────────────────────────────
// LiveMap
// ─────────────────────────────────────────────

export function LiveMap({ selectedSession }: { selectedSession?: any }) {
  const { settings, update } = useSettings();
  const mapContainer   = useRef<HTMLDivElement>(null);
  const map            = useRef<maplibregl.Map | null>(null);
  const markers        = useRef<maplibregl.Marker[]>([]);
  const pendingSession = useRef<any>(null);
  const currentStyle   = useRef<MapStyle>(settings.mapStyle);

  const [hazards,        setHazards]        = useState<Hazard[]>([]);
  const [showUnverified, setShowUnverified]  = useState(true);
  const [mapReady,       setMapReady]        = useState(false);

  // ── Real-time hazard events ─────────────────
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const { type, lat, lon, confidence, timestamp } = event.detail;
      setHazards(prev => [{
        lat, lon, geohash: 'live',
        hazardType: type, confidence,
        status: 'unverified', timestamp,
      }, ...prev]);
    };
    window.addEventListener('hazard-detected', handler as EventListener);
    return () => window.removeEventListener('hazard-detected', handler as EventListener);
  }, []);

  // ── Load session hazards ────────────────────
  useEffect(() => {
    if (selectedSession?.hazards) {
      const sessionHazards = selectedSession.hazards.map((h: any) => ({
        lat: h.lat, lon: h.lon,
        geohash: selectedSession.geohash7,
        hazardType: h.type, confidence: h.confidence,
        status: 'verified', timestamp: selectedSession.timestamp,
      }));
      setHazards(sessionHazards);
      if (map.current && sessionHazards.length > 0) {
        map.current.jumpTo({ center: [sessionHazards[0].lon, sessionHazards[0].lat], zoom: 14 });
      } else {
        pendingSession.current = selectedSession;
      }
    } else {
      fetchHazards();
    }
  }, [selectedSession]);

  // ── Fetch hazards ───────────────────────────
  const fetchHazards = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return;
      const res  = await fetch(`${apiUrl}/hazards`);
      const data = await res.json();
      setHazards(data.hazards || []);
    } catch (_) {}
  };

  // ── Marker element ──────────────────────────
  const createMarkerElement = useCallback((verified: boolean, hazardType?: string) => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative; width:14px; height:14px; cursor:pointer;';

    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 1.5px solid ${verified ? '#4278F5' : '#D94F5C'};
      background: ${verified ? 'rgba(66,120,245,0.35)' : 'rgba(217,79,92,0.35)'};
      box-shadow: 0 0 6px ${verified ? 'rgba(66,120,245,0.55)' : 'rgba(217,79,92,0.55)'};
      transition: transform 0.15s;
    `;

    // Pulse ring on unverified
    if (!verified) {
      const ring = document.createElement('div');
      ring.className = 'hazard-ring';
      ring.style.cssText = `
        position: absolute; inset: -4px;
        border-radius: 50%;
        border: 1.5px solid #D94F5C;
        animation: marker-ring 2s ease-out infinite;
      `;
      wrapper.appendChild(ring);
    }

    wrapper.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.3)'; });
    wrapper.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)'; });

    wrapper.appendChild(dot);
    return wrapper;
  }, []);

  // ── Map init ────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const styleSpec = getMapStyle(settings.mapStyle);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleSpec,
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
      // Apply filter immediately on load
      applyMapFilter(mapContainer.current, settings.mapStyle);

      if (pendingSession.current?.hazards?.length > 0) {
        const h = pendingSession.current.hazards[0];
        map.current?.jumpTo({ center: [h.lon, h.lat], zoom: 14 });
        pendingSession.current = null;
      }
    });

    // Re-apply filter after any style change (tiles reload)
    map.current.on('styledata', () => {
      applyMapFilter(mapContainer.current, currentStyle.current);
    });

    map.current.on('styleimagemissing', (e) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx && !map.current?.hasImage(e.id))
        map.current?.addImage(e.id, ctx.getImageData(0, 0, 1, 1));
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

  // ── React to mapStyle changes ───────────────
  useEffect(() => {
    if (!map.current || !mapReady) return;
    currentStyle.current = settings.mapStyle;
    const styleSpec = getMapStyle(settings.mapStyle);
    map.current.setStyle(styleSpec);
    // Filter applied via 'styledata' event above, but also immediately:
    setTimeout(() => applyMapFilter(mapContainer.current, settings.mapStyle), 50);
  }, [settings.mapStyle, mapReady]);

  // ── React to showLabels (hue-rotate tweak) ──
  // Labels in AWS hosted styles can't be toggled programmatically
  // without re-loading, so we adjust brightness slightly as a hint
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const canvas = mapContainer.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const base = MAP_FILTERS[settings.mapStyle];
    // showLabels=false → extra desaturation so labels visually recede
    canvas.style.filter = settings.showLabels
      ? base
      : base + ' saturate(0.1) brightness(0.7)';
  }, [settings.showLabels, mapReady, settings.mapStyle]);

  // ── Markers ─────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapReady) return;
    markers.current.forEach(m => m.remove());
    markers.current = [];
    hazards
      .filter(h => h.status === 'verified' || showUnverified)
      .forEach(hazard => {
        const el     = createMarkerElement(hazard.status === 'verified', hazard.hazardType);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([hazard.lon, hazard.lat])
          .setPopup(
            new maplibregl.Popup({ closeButton: false, offset: 12 }).setHTML(`
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.68rem;line-height:1.6;color:var(--c-text)">
                <div style="font-weight:500;color:${hazard.status==='verified' ? 'var(--c-accent-2)' : 'var(--c-red)'};margin-bottom:4px">
                  ${hazard.hazardType || 'HAZARD'} · ${hazard.status.toUpperCase()}
                </div>
                <div style="color:var(--c-text-2)">conf: ${(hazard.confidence * 100).toFixed(0)}%</div>
                <div style="color:var(--c-text-3)">${hazard.lat.toFixed(4)}, ${hazard.lon.toFixed(4)}</div>
              </div>
            `)
          )
          .addTo(map.current!);
        markers.current.push(marker);
      });
  }, [hazards, showUnverified, mapReady, createMarkerElement]);

  // ── Style display names ─────────────────────
  const STYLE_LABELS: Record<MapStyle, string> = {
    'dark-osm':  'Dark',
    'satellite': 'Satellite',
    'terrain':   'Terrain',
    'minimal':   'Minimal',
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--c-bg)' }}>

      {/* Map container — vigia-map-dark class triggers CSS overrides */}
      <div
        ref={mapContainer}
        className="vigia-map-dark"
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Grid overlay — rose tinted, only when enabled */}
      {mapReady && settings.showGrid && (
        <div className="map-grid-overlay" style={{ zIndex: 2 }} />
      )}

      {/* Loading */}
      {!mapReady && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--c-bg)', zIndex: 10,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid var(--c-border)',
              borderTopColor: 'var(--c-rose)',
              animation: 'spin 0.85s linear infinite',
            }} />
            <span style={{ fontSize: '0.66rem', color: 'var(--c-text-3)', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em' }}>
              LOADING MAP
            </span>
          </div>
        </div>
      )}

      {/* ── Overlays ─────────────────────────── */}

      {/* Top-left: hazard stats + style badge */}
      {mapReady && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 4,
          background: 'rgba(6,9,16,0.88)',
          border: '1px solid var(--c-rose-border)',
          backdropFilter: 'blur(8px)',
          zIndex: 5, pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--c-accent-2)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.62rem', color: 'var(--c-text-2)', fontFamily: 'IBM Plex Mono, monospace' }}>
              {hazards.filter(h => h.status === 'verified').length} verified
            </span>
          </div>
          <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--c-red)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.62rem', color: 'var(--c-text-2)', fontFamily: 'IBM Plex Mono, monospace' }}>
              {hazards.filter(h => h.status !== 'verified').length} unverified
            </span>
          </div>
          <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
          <span style={{ fontSize: '0.62rem', color: 'var(--c-rose)', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500 }}>
            {STYLE_LABELS[settings.mapStyle]}
          </span>
          {settings.showGrid && (
            <>
              <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
              <span style={{ fontSize: '0.60rem', color: 'var(--c-rose)', fontFamily: 'IBM Plex Mono, monospace', opacity: 0.7 }}>
                GRID
              </span>
            </>
          )}
        </div>
      )}

      {/* Map style switcher — 4 pills */}
      {mapReady && (
        <div style={{
          position: 'absolute', bottom: 16, left: 10,
          display: 'flex', gap: 5, zIndex: 5,
        }}>
          {(['dark-osm', 'satellite', 'terrain', 'minimal'] as MapStyle[]).map(s => {
            const active = settings.mapStyle === s;
            return (
              <button key={s} onClick={() => update({ mapStyle: s })} style={{
                padding: '4px 9px', borderRadius: 4, cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.60rem',
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.05em',
                border: `1px solid ${active ? 'var(--c-rose-border)' : 'var(--c-border)'}`,
                background: active ? 'rgba(6,9,16,0.95)' : 'rgba(6,9,16,0.80)',
                color: active ? 'var(--c-rose-2)' : 'var(--c-text-3)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.15s',
                textTransform: 'uppercase',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border-md)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border)';
                }
              }}
              >
                {STYLE_LABELS[s]}
              </button>
            );
          })}

          {/* Grid toggle */}
          <button onClick={() => update({ showGrid: !settings.showGrid })} style={{
            padding: '4px 9px', borderRadius: 4, cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.60rem', fontWeight: 600,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            border: `1px solid ${settings.showGrid ? 'var(--c-rose-border)' : 'var(--c-border)'}`,
            background: settings.showGrid ? 'rgba(123,84,130,0.18)' : 'rgba(6,9,16,0.80)',
            color: settings.showGrid ? 'var(--c-rose-2)' : 'var(--c-text-3)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!settings.showGrid) {
              (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border-md)';
            }
          }}
          onMouseLeave={(e) => {
            if (!settings.showGrid) {
              (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border)';
            }
          }}
          >
            Grid {settings.showGrid ? 'ON' : 'OFF'}
          </button>

          {/* Labels toggle */}
          <button onClick={() => update({ showLabels: !settings.showLabels })} style={{
            padding: '4px 9px', borderRadius: 4, cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.60rem', fontWeight: 600,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            border: `1px solid ${settings.showLabels ? 'var(--c-accent-glow)' : 'var(--c-border)'}`,
            background: settings.showLabels ? 'rgba(26,64,190,0.15)' : 'rgba(6,9,16,0.80)',
            color: settings.showLabels ? 'var(--c-accent-2)' : 'var(--c-text-3)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!settings.showLabels) {
              (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border-md)';
            }
          }}
          onMouseLeave={(e) => {
            if (!settings.showLabels) {
              (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border)';
            }
          }}
          >
            Labels {settings.showLabels ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

      {/* Filter toggle — top right */}
      {mapReady && (
        <div style={{ position: 'absolute', top: 10, right: 44, zIndex: 5 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
            background: 'rgba(6,9,16,0.88)',
            border: '1px solid var(--c-border)',
            backdropFilter: 'blur(8px)',
          }}>
            <div className="vigia-toggle" style={{ background: showUnverified ? 'var(--c-accent)' : 'rgba(255,255,255,0.08)' }}>
              <div className="vigia-toggle-thumb" style={{ transform: showUnverified ? 'translateX(14px)' : 'translateX(2px)' }} />
            </div>
            <input type="checkbox" checked={showUnverified} onChange={e => setShowUnverified(e.target.checked)} style={{ display: 'none' }} />
            <span style={{ fontSize: '0.64rem', color: 'var(--c-text-2)', fontFamily: 'IBM Plex Mono, monospace' }}>
              Unverified
            </span>
          </label>
        </div>
      )}

      {/* Diff layers */}
      {mapReady && <DiffLegend />}
      {mapReady && <DiffMarkersLayer map={map.current} />}
    </div>
  );
}
