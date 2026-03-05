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
// Only apply filters to dark-osm and minimal
// Satellite and terrain use actual AWS maps
// ─────────────────────────────────────────────

const MAP_FILTERS: Record<MapStyle, string> = {
  'dark-osm':  'brightness(0.82) saturate(0.50) hue-rotate(192deg) contrast(1.05)',
  'satellite': 'none', // No filter - use actual satellite map
  'terrain':   'none', // No filter - use actual terrain map
  'minimal':   'brightness(0.60) saturate(0.20) contrast(1.10)',
};

// ─────────────────────────────────────────────
// getMapStyle — returns AWS style URL
// Satellite and terrain use dedicated AWS maps
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

  // ── Real-time hazard events (only when no session selected) ─────────────────
  useEffect(() => {
    // Don't listen for real-time hazards when viewing a session
    if (selectedSession) return;
    
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
  }, [selectedSession]);

  // ── Load session hazards ────────────────────
  useEffect(() => {
    if (selectedSession?.hazards) {
      console.log('LiveMap: Loading session', selectedSession);
      console.log('LiveMap: Coverage', selectedSession.coverage);
      
      const sessionHazards = selectedSession.hazards.map((h: any) => ({
        lat: h.lat, lon: h.lon,
        geohash: selectedSession.geohash7,
        hazardType: h.type, confidence: h.confidence,
        status: 'verified', timestamp: selectedSession.timestamp || selectedSession.temporal?.createdAt,
      }));
      setHazards(sessionHazards);
      
      // Center map on session coverage
      if (map.current) {
        if (selectedSession.coverage?.centerPoint) {
          console.log('LiveMap: Centering on', selectedSession.coverage.centerPoint);
          map.current.jumpTo({ 
            center: [selectedSession.coverage.centerPoint.lon, selectedSession.coverage.centerPoint.lat], 
            zoom: 12 
          });
        } else if (sessionHazards.length > 0) {
          console.log('LiveMap: Centering on first hazard');
          map.current.jumpTo({ center: [sessionHazards[0].lon, sessionHazards[0].lat], zoom: 14 });
        }
      } else {
        console.log('LiveMap: Map not ready, storing pending session');
        pendingSession.current = selectedSession;
      }
    } else {
      fetchHazards();
    }
  }, [selectedSession]);

  // ── Fetch hazards ───────────────────────────
  const fetchHazards = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_TELEMETRY_API_URL || process.env.NEXT_PUBLIC_API_URL;
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

      // Handle pending session
      if (pendingSession.current) {
        console.log('LiveMap: Map loaded, processing pending session');
        if (pendingSession.current.coverage?.centerPoint) {
          console.log('LiveMap: Centering on coverage centerPoint', pendingSession.current.coverage.centerPoint);
          map.current?.jumpTo({ 
            center: [pendingSession.current.coverage.centerPoint.lon, pendingSession.current.coverage.centerPoint.lat], 
            zoom: 12 
          });
        } else if (pendingSession.current.hazards?.length > 0) {
          const h = pendingSession.current.hazards[0];
          console.log('LiveMap: Centering on first hazard');
          map.current?.jumpTo({ center: [h.lon, h.lat], zoom: 14 });
        }
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
              <div style="font-family:var(--v-font-mono);font-size:0.68rem;line-height:1.6;color:var(--c-text)">
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
            <span style={{ fontSize: '0.66rem', color: 'var(--c-text-3)', fontFamily: "var(--v-font-mono)", letterSpacing: '0.06em' }}>
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
          background: 'var(--c-overlay)',
          border: '1px solid var(--c-rose-border)',
          backdropFilter: 'blur(8px)',
          zIndex: 5, pointerEvents: 'none',
        }}>
          {selectedSession && (
            <>
              <span style={{ fontSize: '0.62rem', color: 'var(--c-yellow)', fontFamily: "var(--v-font-mono)", fontWeight: 600 }}>
                SNAPSHOT
              </span>
              <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
              <span style={{ fontSize: '0.60rem', color: 'var(--c-text-2)', fontFamily: "var(--v-font-mono)" }}>
                {new Date(selectedSession.temporal?.createdAt || selectedSession.timestamp).toLocaleString()}
              </span>
              <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--c-accent-2)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.62rem', color: 'var(--c-text-2)', fontFamily: "var(--v-font-mono)" }}>
              {hazards.filter(h => h.status === 'verified').length} verified
            </span>
          </div>
          <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--c-red)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.62rem', color: 'var(--c-text-2)', fontFamily: "var(--v-font-mono)" }}>
              {hazards.filter(h => h.status !== 'verified').length} unverified
            </span>
          </div>
          <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
          <span style={{ fontSize: '0.62rem', color: 'var(--c-rose)', fontFamily: "var(--v-font-mono)", fontWeight: 500 }}>
            {STYLE_LABELS[settings.mapStyle]}
          </span>
          {settings.showGrid && (
            <>
              <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
              <span style={{ fontSize: '0.60rem', color: 'var(--c-rose)', fontFamily: "var(--v-font-mono)", opacity: 0.7 }}>
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
                fontFamily: "var(--v-font-mono)", fontSize: '0.60rem',
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.05em',
                border: `1px solid ${active ? 'var(--c-rose-border)' : 'var(--c-border)'}`,
                background: active ? 'var(--c-elevated)' : 'var(--c-overlay)',
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
            fontFamily: "var(--v-font-mono)", fontSize: '0.60rem', fontWeight: 600,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            border: `1px solid ${settings.showGrid ? 'var(--c-rose-border)' : 'var(--c-border)'}`,
            background: settings.showGrid ? 'var(--c-rose-dim)' : 'var(--c-overlay)',
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
            fontFamily: "var(--v-font-mono)", fontSize: '0.60rem', fontWeight: 600,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            border: `1px solid ${settings.showLabels ? 'var(--c-accent-glow)' : 'var(--c-border)'}`,
            background: settings.showLabels ? 'var(--c-accent-glow)' : 'var(--c-overlay)',
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

      {/* Update Session button - only show when viewing a session */}
      {mapReady && selectedSession && (
        <div style={{ position: 'absolute', top: 10, right: 180, zIndex: 5 }}>
          <button
            onClick={async () => {
              const confirmed = window.confirm(
                `Create updated snapshot of "${selectedSession.displayName || selectedSession.location?.city}"?\n\n` +
                `This will create a NEW session with current hazard data while preserving the original snapshot.`
              );
              
              if (!confirmed) return;
              
              try {
                // Fetch current hazards for this location
                const apiUrl = process.env.NEXT_PUBLIC_TELEMETRY_API_URL || process.env.NEXT_PUBLIC_API_URL;
                const response = await fetch(`${apiUrl}/hazards?geohash=${selectedSession.coverage?.centerPoint?.geohash || selectedSession.geohash7}`);
                const currentHazards = await response.json();
                
                // Create new session with updated data
                const { useMapFileStore } = await import('@/stores/mapFileStore');
                const now = Date.now();
                const dateStr = new Date().toISOString().split('T')[0];
                
                // Get existing sessions to determine sequence number
                const { getFilesByLocation } = useMapFileStore.getState();
                const existingSessions = await getFilesByLocation(
                  selectedSession.location.country,
                  selectedSession.location.state,
                  selectedSession.location.city
                );
                const todaySessions = existingSessions.filter(s => 
                  s.displayName?.startsWith(`${selectedSession.location.city}-${dateStr}`)
                );
                const sequenceNum = String(todaySessions.length + 1).padStart(3, '0');
                
                const updatedSession = {
                  ...selectedSession,
                  sessionId: crypto.randomUUID(),
                  displayName: `${selectedSession.location.city}-${dateStr}-${sequenceNum}`,
                  temporal: {
                    ...selectedSession.temporal,
                    captureStart: now,
                    captureEnd: now,
                    createdAt: now,
                    status: 'collecting' as const,
                  },
                  hazards: currentHazards,
                  metadata: {
                    ...selectedSession.metadata,
                    totalHazards: currentHazards.length,
                    hazardsByType: currentHazards.reduce((acc: any, h: any) => {
                      acc[h.type] = (acc[h.type] || 0) + 1;
                      return acc;
                    }, {}),
                  },
                };
                
                await useMapFileStore.getState().saveMapFile(updatedSession);
                
                // Dispatch event to open new session
                window.dispatchEvent(new CustomEvent('vigia-session-created', {
                  detail: { session: updatedSession }
                }));
                
                alert(`Updated snapshot created: ${updatedSession.displayName}`);
              } catch (err) {
                console.error('Failed to update session:', err);
                alert('Failed to create updated snapshot');
              }
            }}
            style={{
              padding: '5px 12px',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'var(--c-overlay)',
              border: '1px solid var(--c-accent-glow)',
              backdropFilter: 'blur(8px)',
              color: 'var(--c-accent-2)',
              fontSize: '0.62rem',
              fontFamily: "var(--v-font-mono)",
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--c-accent-glow)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-accent-2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--c-overlay)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-accent-glow)';
            }}
          >
            Update Snapshot
          </button>
        </div>
      )}

      {/* Filter toggle — top right */}
      {mapReady && (
        <div style={{ position: 'absolute', top: 10, right: 44, zIndex: 5 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
            background: 'var(--c-overlay)',
            border: '1px solid var(--c-border)',
            backdropFilter: 'blur(8px)',
          }}>
            <div className="vigia-toggle" style={{ background: showUnverified ? 'var(--c-accent)' : 'var(--c-border-md)' }}>
              <div className="vigia-toggle-thumb" style={{ transform: showUnverified ? 'translateX(14px)' : 'translateX(2px)' }} />
            </div>
            <input type="checkbox" checked={showUnverified} onChange={e => setShowUnverified(e.target.checked)} style={{ display: 'none' }} />
            <span style={{ fontSize: '0.64rem', color: 'var(--c-text-2)', fontFamily: "var(--v-font-mono)" }}>
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
