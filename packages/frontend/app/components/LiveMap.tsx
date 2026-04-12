'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSettings } from './SettingsContext';
import type { MapStyle } from './SettingsContext';
import { DiffMarkersLayer } from './DiffMarkersLayer';
import { DiffLegend } from './DiffLegend';
import { agentFetch } from '../lib/client/agent-rate-limit-client';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Hazard = {
  hazardId: string;
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

const getCssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const toRgba = (color: string, alpha: number) => {
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    const full = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgbMatch = c.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
  if (rgbMatch) return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  const rgbaMatch = c.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)$/i);
  if (rgbaMatch) return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
  return c;
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
      { id: 'background', type: 'background', paint: { 'background-color': getCssVar('--c-bg', '#0A0E15') } },
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

function getMaxZoomForStyle(style: MapStyle): number {
  // AWS Location Service hosted raster styles commonly top out before 19+.
  // When MapLibre over-zooms, it can request tiles that don't exist, producing
  // noisy 404s even though the map may still appear to render.
  return (style === 'satellite' || style === 'terrain') ? 18 : 19;
}

// ─────────────────────────────────────────────
// LiveMap
// ─────────────────────────────────────────────

export function LiveMap({ selectedSession }: { selectedSession?: any }) {
  const { settings, update } = useSettings();
  const mapContainer   = useRef<HTMLDivElement>(null);
  const map            = useRef<maplibregl.Map | null>(null);
  const pendingSession = useRef<any>(null);
  const currentStyle   = useRef<MapStyle>(settings.mapStyle);

  const [hazards,        setHazards]        = useState<Hazard[]>([]);
  const hazardsRef = useRef<Hazard[]>([]);
  const [hazardsHydrated, setHazardsHydrated] = useState(false);
  const hazardsHydratedRef = useRef(false);
  const [showUnverified, setShowUnverified]  = useState(true);
  const showUnverifiedRef = useRef(true);
  const [mapReady,       setMapReady]        = useState(false);
  const [hazardsRendered, setHazardsRendered] = useState(false);
  const [selectionMode,  setSelectionMode]   = useState(false);
  const [selectedHazards, setSelectedHazards] = useState<Set<string>>(new Set());
  const selectionModeRef = useRef(false);
  const [newHazardNotification, setNewHazardNotification] = useState<string | null>(null);

  const HAZARDS_SOURCE_ID = 'hazards-source';
  const HAZARDS_LAYER_ID = 'hazards-layer';

  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  type PinPoint = { lat: number; lon: number };
  const [pinA, setPinA] = useState<PinPoint | null>(null);
  const [pinB, setPinB] = useState<PinPoint | null>(null);
  const dropPinModeRef = useRef<'A' | 'B' | null>(null);
  const pinMarkersRef = useRef<{ A: maplibregl.Marker | null; B: maplibregl.Marker | null }>({ A: null, B: null });
  const routeDataRef = useRef<any>(null);
  const ignoreNextHazardClickRef = useRef(false);

  const ROUTE_FASTEST_ID = 'fastest-route';
  const ROUTE_SAFEST_ID = 'safest-route';

  const setDropPinMode = useCallback((mode: 'A' | 'B' | null) => {
    dropPinModeRef.current = mode;
    if (typeof window !== 'undefined') {
      (window as any).__dropPinMode = mode;
    }
    const m = map.current;
    if (!m) return;

    if (mode) {
      m.getCanvas().style.cursor = 'crosshair';
      // Reduce accidental drags while dropping pins
      try {
        m.dragPan.disable();
        m.doubleClickZoom.disable();
      } catch {
        // ignore
      }
    } else {
      m.getCanvas().style.cursor = '';
      try {
        m.dragPan.enable();
        m.doubleClickZoom.enable();
      } catch {
        // ignore
      }
    }
  }, []);

  // Escape to cancel pin-drop mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!dropPinModeRef.current) return;
      setDropPinMode(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setDropPinMode]);

  const makePinElement = useCallback((label: 'A' | 'B') => {
    const pinA = getCssVar('--c-red', '#EF4444');
    const pinB = getCssVar('--c-accent-2', '#3B82F6');
    const el = document.createElement('div');
    el.className = 'pin-marker';
    el.style.pointerEvents = 'none';
    el.innerHTML = `
      <div style="
        width: 32px;
        height: 32px;
        background: ${label === 'A' ? pinA : pinB};
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
          font-family: var(--v-font-mono);
        ">${label}</span>
      </div>
    `;
    return el;
  }, []);

  const upsertPinMarker = useCallback((label: 'A' | 'B', point: PinPoint | null) => {
    const m = map.current;
    if (!m) return;

    const existing = pinMarkersRef.current[label];
    if (!point) {
      existing?.remove();
      pinMarkersRef.current[label] = null;
      return;
    }

    if (existing) {
      existing.setLngLat([point.lon, point.lat]);
      return;
    }

    const marker = new maplibregl.Marker({ element: makePinElement(label) })
      .setLngLat([point.lon, point.lat])
      .addTo(m);
    pinMarkersRef.current[label] = marker;
  }, [makePinElement]);

  const removeRouteLayers = useCallback(() => {
    const m = map.current;
    if (!m) return;
    [ROUTE_FASTEST_ID, ROUTE_SAFEST_ID].forEach((id) => {
      try {
        if (m.getLayer(id)) m.removeLayer(id);
        if (m.getSource(id)) m.removeSource(id);
      } catch {
        // ignore
      }
    });
  }, []);

  const plotRoutes = useCallback((routeData: any) => {
    const m = map.current;
    if (!m || !routeData) return;

    removeRouteLayers();

    const fastest = routeData?.fastest?.geometry;
    const safest = routeData?.safest?.geometry;
    if (!Array.isArray(fastest) || !Array.isArray(safest)) return;

    m.addSource(ROUTE_FASTEST_ID, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: fastest,
        },
        properties: {},
      },
    } as any);

    m.addLayer({
      id: ROUTE_FASTEST_ID,
      type: 'line',
      source: ROUTE_FASTEST_ID,
      paint: {
        'line-color': getCssVar('--c-accent-2', '#3B82F6'),
        'line-width': 4,
        'line-dasharray': [2, 2],
      },
    } as any);

    m.addSource(ROUTE_SAFEST_ID, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: safest,
        },
        properties: {},
      },
    } as any);

    m.addLayer({
      id: ROUTE_SAFEST_ID,
      type: 'line',
      source: ROUTE_SAFEST_ID,
      paint: {
        'line-color': getCssVar('--c-green', '#22C55E'),
        'line-width': 4,
      },
    } as any);
  }, [removeRouteLayers]);

  const calculatePinRoute = useCallback(async () => {
    if (!pinA || !pinB) return;

    try {
      const res = await agentFetch('/api/agent/urban-planning', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          start: { lat: pinA.lat, lon: pinA.lon },
          end: { lat: pinB.lat, lon: pinB.lon },
          constraints: { avoidHazardTypes: ['POTHOLE', 'DEBRIS'] }
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      
      // Plot routes on map
      if (data.pathData) {
        routeDataRef.current = data.pathData;
        plotRoutes(data.pathData);
      }
      
      // Send result directly to agent panel with context
      if (data.message || data.analysis) {
        (window as any).__urbanPlannerResult = {
          message: data.message || data.analysis,
          pathData: data.pathData,
          context: {
            type: 'route-calculated',
            pinA: { lat: pinA.lat, lon: pinA.lon },
            pinB: { lat: pinB.lat, lon: pinB.lon },
            fastest: data.pathData?.fastest,
            safest: data.pathData?.safest,
            recommendation: data.pathData?.recommendation
          }
        };
        (window as any).__urbanPlannerResultTrigger?.();
      }
    } catch {
      // ignore
    }
  }, [pinA, pinB, plotRoutes]);

  // Expose pin routing hooks for TopBar
  useEffect(() => {
    (window as any).__setDropPinMode = (mode: 'A' | 'B' | null) => setDropPinMode(mode);
    (window as any).__calculatePinRoute = () => calculatePinRoute();
    return () => {
      // don't delete globals (other tabs/components may depend on them)
    };
  }, [setDropPinMode, calculatePinRoute]);

  // Keep markers in sync
  useEffect(() => {
    if (!map.current || !mapReady) return;
    upsertPinMarker('A', pinA);
    upsertPinMarker('B', pinB);
  }, [pinA, pinB, mapReady, upsertPinMarker]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  const markHazardsHydrated = useCallback(() => {
    if (hazardsHydratedRef.current) return;
    hazardsHydratedRef.current = true;
    setHazardsHydrated(true);
  }, []);

  const makeHazardId = useCallback((input: { geohash?: string; timestamp?: string; lat: number; lon: number }) => {
    const gh = String(input.geohash || 'nogh');
    const ts = String(input.timestamp || 'notime');
    return `${gh}#${ts}#${input.lat.toFixed(5)}#${input.lon.toFixed(5)}`;
  }, []);

  const normalizeHazard = useCallback((raw: any): Hazard | null => {
    const lat = Number(raw?.lat);
    const lon = Number(raw?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const geohash = String(raw?.geohash || raw?.geohash7 || '');
    const timestamp = String(raw?.timestamp || raw?.ts || raw?.detectedAt || raw?.createdAt || '');
    const hazardType = String(raw?.hazardType || raw?.type || 'HAZARD');
    const confidence = Number(raw?.confidence ?? 0);
    const status = String(raw?.status || 'unverified');
    const verificationScore = raw?.verificationScore != null ? Number(raw.verificationScore) : undefined;
    const hazardId = String(raw?.hazardId || raw?.id || '') || makeHazardId({ geohash, timestamp, lat, lon });

    return {
      hazardId,
      lat,
      lon,
      geohash,
      hazardType,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      status,
      verificationScore,
      timestamp,
    };
  }, [makeHazardId]);

  const toggleHazardSelection = useCallback((hazardId: string) => {
    setSelectedHazards((prev) => {
      const next = new Set(prev);
      if (next.has(hazardId)) next.delete(hazardId);
      else next.add(hazardId);
      return next;
    });
  }, []);

  // Keep refs in sync so map callbacks always have latest values
  useEffect(() => { hazardsRef.current = hazards; }, [hazards]);
  useEffect(() => { showUnverifiedRef.current = showUnverified; }, [showUnverified]);

  const ensureHazardsLayer = useCallback(() => {
    if (!map.current) return;
    const m = map.current;

    // Style reloads remove sources/layers; re-add as needed.
    const hasSource = !!m.getSource(HAZARDS_SOURCE_ID);
    const hasLayer = !!m.getLayer(HAZARDS_LAYER_ID);

    if (!hasSource) {
      m.addSource(HAZARDS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        // Use `properties.hazardId` as the feature id, so feature-state works.
        promoteId: 'hazardId' as any,
      } as any);
    }

    if (!hasLayer) {
      const verified = getCssVar('--c-accent-2', '#4278F5');
      const danger = getCssVar('--c-red', '#D94F5C');
      const verifiedFill = toRgba(verified, 0.35);
      const dangerFill = toRgba(danger, 0.35);

      m.addLayer({
        id: HAZARDS_LAYER_ID,
        type: 'circle',
        source: HAZARDS_SOURCE_ID,
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            10,
            6,
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'status'], 'verified'],
            verifiedFill,
            dangerFill,
          ],
          'circle-stroke-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            danger,
            ['case', ['==', ['get', 'status'], 'verified'], verified, danger],
          ],
          'circle-stroke-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            3,
            1.5,
          ],
          'circle-opacity': 1,
        },
      } as any);

      m.on('mouseenter', HAZARDS_LAYER_ID, () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', HAZARDS_LAYER_ID, () => {
        m.getCanvas().style.cursor = '';
      });
    }
  }, []); // uses stable string constants

  const buildHazardsGeoJson = useCallback(() => {
    const visible = hazards.filter((h) => h.status === 'verified' || showUnverified);
    return {
      type: 'FeatureCollection',
      features: visible.map((h) => ({
        type: 'Feature',
        id: h.hazardId,
        properties: {
          hazardId: h.hazardId,
          status: h.status,
          hazardType: h.hazardType,
          type: h.hazardType,
          confidence: h.confidence,
          geohash: h.geohash,
          timestamp: h.timestamp,
        },
        geometry: {
          type: 'Point',
          coordinates: [h.lon, h.lat],
        },
      })),
    } as any;
  }, [hazards, showUnverified]);

  // Keep hazards GeoJSON source in sync
  useEffect(() => {
    if (!map.current || !mapReady || !hazardsHydrated) return;
    ensureHazardsLayer();

    const source = map.current.getSource(HAZARDS_SOURCE_ID) as any;
    if (source?.setData) {
      source.setData(buildHazardsGeoJson());
      setHazardsRendered(true);
    }
  }, [mapReady, hazardsHydrated, ensureHazardsLayer, buildHazardsGeoJson, settings.mapStyle]);

  // Keep selection feature-state in sync
  useEffect(() => {
    if (!map.current || !mapReady || !hazardsHydrated) return;
    ensureHazardsLayer();

    const m = map.current;
    const visible = hazards.filter((h) => h.status === 'verified' || showUnverified);
    visible.forEach((h) => {
      try {
        m.setFeatureState({ source: HAZARDS_SOURCE_ID, id: h.hazardId as any }, { selected: selectedHazards.has(h.hazardId) });
      } catch {
        // ignore (feature may not exist yet)
      }
    });
  }, [selectedHazards, hazards, showUnverified, mapReady, hazardsHydrated, ensureHazardsLayer, settings.mapStyle]);

  // ── Agent highlight: pulse urgent hazards & fly to top ──────────────────────
  useEffect(() => {
    const URGENT_LAYER = 'hazards-urgent-pulse';
    let pulseFrame: number;
    let pulseStart: number | null = null;

    const handler = (e: Event) => {
      const { hazardIds, top } = (e as CustomEvent).detail as { hazardIds: string[]; top?: { lat: number; lon: number } };
      const m = map.current;
      if (!m || !mapReady) return;

      // Ensure the hazards source exists before adding a layer on top of it
      ensureHazardsLayer();

      // Set feature-state urgent on matching hazards
      hazards.forEach(h => {
        try {
          m.setFeatureState(
            { source: HAZARDS_SOURCE_ID, id: h.hazardId as any },
            { urgent: hazardIds.includes(h.hazardId) }
          );
        } catch { /* ignore */ }
      });

      // Add pulsing red ring layer above hazards if not present
      if (!m.getLayer(URGENT_LAYER)) {
        m.addLayer({
          id: URGENT_LAYER,
          type: 'circle',
          source: HAZARDS_SOURCE_ID,
          // feature-state can't be used in filter — use paint opacity instead
          paint: {
            'circle-radius': 14,
            'circle-color': 'transparent',
            'circle-stroke-color': '#ff2d55',
            'circle-stroke-width': 2.5,
            'circle-opacity': ['case', ['boolean', ['feature-state', 'urgent'], false], 1, 0],
            'circle-stroke-opacity': ['case', ['boolean', ['feature-state', 'urgent'], false], 1, 0],
          },
        } as any);
      }

      // Animate pulse via rAF
      cancelAnimationFrame(pulseFrame);
      pulseStart = null;
      const animate = (ts: number) => {
        if (!m.getLayer(URGENT_LAYER)) return;
        if (pulseStart === null) pulseStart = ts;
        const t = ((ts - pulseStart) % 1200) / 1200;
        const radius = 10 + Math.sin(t * Math.PI * 2) * 6;
        try {
          m.setPaintProperty(URGENT_LAYER, 'circle-radius', radius);
          m.setPaintProperty(URGENT_LAYER, 'circle-stroke-width', 2 + Math.sin(t * Math.PI * 2) * 1.5);
        } catch { return; }
        pulseFrame = requestAnimationFrame(animate);
      };
      pulseFrame = requestAnimationFrame(animate);

      // Fly to top hazard — fall back to looking up coords from loaded hazards
      const resolvedTop = top ?? (() => {
        const match = hazards.find(h => hazardIds.includes(h.hazardId));
        return match ? { lat: match.lat, lon: match.lon } : undefined;
      })();
      if (resolvedTop) {
        m.flyTo({ center: [resolvedTop.lon, resolvedTop.lat], zoom: 15, duration: 1400 });
      }
    };

    window.addEventListener('vigia-agent-highlight', handler);
    return () => {
      window.removeEventListener('vigia-agent-highlight', handler);
      cancelAnimationFrame(pulseFrame);
    };
  }, [mapReady, hazards, ensureHazardsLayer, HAZARDS_SOURCE_ID]);


  useEffect(() => {
    (window as any).__mapViewportTrigger = () => {
      const viewport = (window as any).__mapViewport;
      if (viewport && map.current && mapReady) {
        map.current.flyTo({
          center: viewport.center,
          zoom: viewport.zoom || 15,
          duration: 1500,
        });
      } else if (viewport) {
        setTimeout(() => {
          if (map.current && mapReady) {
            map.current.flyTo({
              center: viewport.center,
              zoom: viewport.zoom || 15,
              duration: 1500,
            });
          } else {
            console.error('[LiveMap] Map still not ready after retry');
          }
        }, 1000);
      }
    };
    // Don't delete on unmount - keep it available
  }, [mapReady]);

  // ── Real-time hazard events (only when no session selected) ─────────────────
  useEffect(() => {
    // Don't listen for real-time hazards when viewing a session
    if (selectedSession) return;
    
    const handler = (event: CustomEvent) => {
      const { hazardType, lat, lon, confidence, timestamp, status } = event.detail;
      
      // Generate geohash from coordinates
      const geohash = `live-${Date.now()}`;
      const hazardId = makeHazardId({ geohash, timestamp, lat, lon });
      
      const newHazard: Hazard = {
        hazardId,
        lat, 
        lon, 
        geohash,
        hazardType,
        confidence,
        status: status || 'UNVERIFIED',
        timestamp,
      };
      
      setHazards(prev => [newHazard, ...prev]);
      markHazardsHydrated();
      
      // Show notification
      setNewHazardNotification(`${hazardType} detected at ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      setTimeout(() => setNewHazardNotification(null), 3000);
      
      // Trigger sparkly animation
      if (map.current) {
        // Fly to new hazard
        map.current.flyTo({
          center: [lon, lat],
          zoom: 16,
          duration: 1000,
        });
        
        // Add temporary sparkle marker with pulsing rings
        setTimeout(() => {
          if (!map.current) return;
          
          const el = document.createElement('div');
          el.style.width = '60px';
          el.style.height = '60px';
          el.style.position = 'relative';
          el.style.pointerEvents = 'none';

          const sparkle = getCssVar('--c-rose', '#D94F5C');
          
          // Inner glow
          const inner = document.createElement('div');
          inner.style.position = 'absolute';
          inner.style.inset = '0';
          inner.style.borderRadius = '50%';
          inner.style.background = `radial-gradient(circle, ${sparkle} 0%, ${toRgba(sparkle, 0.6)} 40%, ${toRgba(sparkle, 0)} 70%)`;
          inner.style.animation = 'sparkle 2s ease-out';
          el.appendChild(inner);
          
          // Outer ring
          const outer = document.createElement('div');
          outer.style.position = 'absolute';
          outer.style.inset = '0';
          outer.style.borderRadius = '50%';
          outer.style.border = `2px solid ${toRgba(sparkle, 0.8)}`;
          outer.style.animation = 'sparkle-ring 2s ease-out';
          el.appendChild(outer);
          
          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lon, lat])
            .addTo(map.current!);
          
          // Remove after animation
          setTimeout(() => marker.remove(), 2000);
        }, 1000);
      }
    };
    
    window.addEventListener('new-hazard-detected', handler as EventListener);
    return () => window.removeEventListener('new-hazard-detected', handler as EventListener);
  }, [selectedSession, makeHazardId, markHazardsHydrated]);

  // ── Load session hazards ────────────────────
  useEffect(() => {
    // Reset so skeleton shows while new session loads
    hazardsHydratedRef.current = false;
    setHazardsHydrated(false);
    setMapReady(false);
    setHazardsRendered(false);

    if (selectedSession?.hazards) {
      const sessionHazards = selectedSession.hazards
        .map((h: any) => {
          const lat = Number(h.lat);
          const lon = Number(h.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

          const geohash = String(selectedSession.geohash7 || '');
          const timestamp = String(selectedSession.timestamp || selectedSession.temporal?.createdAt || '');
          return {
            hazardId: makeHazardId({ geohash, timestamp, lat, lon }),
            lat,
            lon,
            geohash,
            hazardType: String(h.type || 'HAZARD'),
            confidence: Number(h.confidence ?? 0),
            status: 'verified',
            timestamp,
          } satisfies Hazard;
        })
        .filter(Boolean) as Hazard[];
      setHazards(sessionHazards);
      hazardsRef.current = sessionHazards;
      markHazardsHydrated();
      
      // Center map on session coverage
      if (map.current) {
        if (selectedSession.coverage?.centerPoint) {
          map.current.jumpTo({ 
            center: [selectedSession.coverage.centerPoint.lon, selectedSession.coverage.centerPoint.lat], 
            zoom: 12 
          });
        } else if (sessionHazards.length > 0) {
          map.current.jumpTo({ center: [sessionHazards[0].lon, sessionHazards[0].lat], zoom: 14 });
        }
      } else {
        pendingSession.current = selectedSession;
      }
    } else {
      fetchHazards();
    }
  }, [selectedSession, makeHazardId, markHazardsHydrated]);

  // ── Fetch hazards ───────────────────────────
  const fetchHazards = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_TELEMETRY_API_URL || process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return;
      const res  = await fetch(`${apiUrl}/hazards`);
      const data = await res.json();
      const raw = Array.isArray(data?.hazards) ? data.hazards : [];
      const normalized = raw.map(normalizeHazard).filter(Boolean) as Hazard[];
      setHazards(normalized);
      hazardsRef.current = normalized;
    } catch (_) {
      // Best-effort: don't block UI forever if hazards fetch fails
    } finally {
      markHazardsHydrated();
    }
  };

  // ── Map init ────────────────────────────────
  useEffect(() => {
    if (!hazardsHydrated) return;
    if (!mapContainer.current || map.current) return;

    const styleSpec = getMapStyle(settings.mapStyle);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleSpec,
      center: [84.8814, 22.2604],
      zoom: 12,
      maxZoom: getMaxZoomForStyle(settings.mapStyle),
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const ro = new ResizeObserver(() => map.current?.resize());
    ro.observe(mapContainer.current);

    map.current.on('load', () => {
      map.current?.resize();
      // Apply filter immediately on load
      applyMapFilter(mapContainer.current, settings.mapStyle);

      // Ensure hazards layer exists and populate with already-fetched data
      // BEFORE setting mapReady, so the map is never shown without hazards
      ensureHazardsLayer();

      const source = map.current?.getSource(HAZARDS_SOURCE_ID) as any;
      if (source?.setData) {
        const visible = hazardsRef.current.filter(h => h.status === 'verified' || showUnverifiedRef.current);
        source.setData({
          type: 'FeatureCollection',
          features: visible.map(h => ({
            type: 'Feature',
            id: h.hazardId,
            properties: { hazardId: h.hazardId, status: h.status, hazardType: h.hazardType, type: h.hazardType, confidence: h.confidence, geohash: h.geohash, timestamp: h.timestamp },
            geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
          })),
        });
        setHazardsRendered(true);
      }

      // Now reveal the map — hazards are already in the source
      setMapReady(true);

      // Rehydrate pins/routes
      upsertPinMarker('A', pinA);
      upsertPinMarker('B', pinB);
      if (routeDataRef.current) plotRoutes(routeDataRef.current);

      // Handle pending session
      if (pendingSession.current) {
        if (pendingSession.current.coverage?.centerPoint) {
          map.current?.jumpTo({ 
            center: [pendingSession.current.coverage.centerPoint.lon, pendingSession.current.coverage.centerPoint.lat], 
            zoom: 12 
          });
        } else if (pendingSession.current.hazards?.length > 0) {
          const h = pendingSession.current.hazards[0];
          map.current?.jumpTo({ center: [h.lon, h.lat], zoom: 14 });
        }
        pendingSession.current = null;
      }
    });

    // Re-apply filter after any style change (tiles reload)
    map.current.on('styledata', () => {
      applyMapFilter(mapContainer.current, currentStyle.current);

      // Re-add hazards layer on style reload
      if (map.current?.isStyleLoaded?.()) {
        try {
          ensureHazardsLayer();
          if (routeDataRef.current) plotRoutes(routeDataRef.current);
        } catch {
          // ignore
        }
      }
    });

    // Map interactions for hazard selection (GeoJSON layer)
    const startPress = (e: any) => {
      if (!map.current) return;
      const m = map.current;
      const point = e?.point;
      if (!point) return;

      // Check if hazards layer exists before querying
      if (!m.getLayer(HAZARDS_LAYER_ID)) return;

      const features = m.queryRenderedFeatures(point, { layers: [HAZARDS_LAYER_ID] }) as any[];
      if (!features?.length) return;

      const feature = features[0];
      const hazardId = String(feature?.properties?.hazardId || feature?.id || '');
      if (!hazardId) return;

      if (longPressTimerRef.current != null) window.clearTimeout(longPressTimerRef.current);
      longPressTriggeredRef.current = false;
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        setSelectionMode(true);
        setSelectedHazards(new Set([hazardId]));
      }, 450);
    };

    const endPress = () => {
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    map.current.on('mousedown', startPress);
    map.current.on('touchstart', startPress);
    map.current.on('mouseup', endPress);
    map.current.on('touchend', endPress);
    map.current.on('touchcancel', endPress);
    map.current.on('mouseout', endPress);

    map.current.on('click', HAZARDS_LAYER_ID, (e: any) => {
      if (ignoreNextHazardClickRef.current) {
        ignoreNextHazardClickRef.current = false;
        return;
      }

      const feature = e?.features?.[0];
      const hazardId = String(feature?.properties?.hazardId || feature?.id || '');
      if (!hazardId) return;

      if (longPressTriggeredRef.current) {
        // Don't treat the release click as a selection toggle
        longPressTriggeredRef.current = false;
        return;
      }

      if (selectionModeRef.current) {
        toggleHazardSelection(hazardId);
      }
    });

    // Click-to-place pins
    map.current.on('click', (e: any) => {
      const mode = dropPinModeRef.current;
      if (!mode) return;

      const lat = Number(e?.lngLat?.lat);
      const lon = Number(e?.lngLat?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      ignoreNextHazardClickRef.current = true;

      if (mode === 'A') setPinA({ lat, lon });
      if (mode === 'B') setPinB({ lat, lon });
      setDropPinMode(null);
    });

    map.current.on('styleimagemissing', (e) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx && !map.current?.hasImage(e.id))
        map.current?.addImage(e.id, ctx.getImageData(0, 0, 1, 1));
    });

    return () => {
      ro.disconnect();
      pinMarkersRef.current.A?.remove();
      pinMarkersRef.current.B?.remove();
      pinMarkersRef.current = { A: null, B: null };
      map.current?.remove();
      map.current = null;
      setMapReady(false);
      setHazardsRendered(false);
    };
  }, [hazardsHydrated]);

  // Poll every 5 seconds for real-time updates (after initial hydration)
  useEffect(() => {
    if (!hazardsHydrated) return;
    const interval = setInterval(fetchHazards, 5000);
    return () => clearInterval(interval);
  }, [hazardsHydrated]);

  // ── React to mapStyle changes ───────────────
  useEffect(() => {
    if (!map.current || !mapReady) return;
    currentStyle.current = settings.mapStyle;

    // Clamp zoom for the new style before tiles start streaming.
    const maxZoom = getMaxZoomForStyle(settings.mapStyle);
    try {
      (map.current as any).setMaxZoom?.(maxZoom);
      const z = (map.current as any).getZoom?.();
      if (typeof z === 'number' && z > maxZoom) (map.current as any).setZoom?.(maxZoom);
    } catch {
      // best-effort
    }

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

  // ── Hazards are rendered via GeoJSON layer ───────────────────────────────

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
      {hazardsHydrated && (
        <div
          ref={mapContainer}
          className="vigia-map-dark"
          style={{ position: 'absolute', inset: 0 }}
        />
      )}

      {/* Grid overlay — rose tinted, only when enabled */}
      {mapReady && hazardsHydrated && settings.showGrid && (
        <div className="map-grid-overlay" style={{ zIndex: 2 }} />
      )}

      {/* Loading */}
      {!(mapReady && hazardsRendered) && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--c-bg)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px solid var(--c-border)',
              borderTopColor: 'var(--c-rose)',
              animation: 'spin 0.85s linear infinite',
            }} />
            <span style={{
              fontSize: '0.66rem',
              color: 'var(--c-text-3)',
              fontFamily: 'var(--v-font-mono)',
              letterSpacing: '0.06em',
            }}>
              LOADING MAP
            </span>
          </div>
        </div>
      )}

      {/* ── Overlays ─────────────────────────── */}

      {/* Top-left: hazard stats + style badge */}
      {mapReady && hazardsHydrated && selectionMode && (
        <div style={{
          position: 'absolute', top: 52, right: 44,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 4,
          background: 'var(--c-overlay)',
          border: '1px solid var(--c-rose-border)',
          backdropFilter: 'blur(8px)',
          zIndex: 6,
        }}>
          <span style={{
            fontSize: '0.62rem',
            color: 'var(--c-rose-2)',
            fontFamily: 'var(--v-font-mono)',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            Selection
          </span>
          <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
          <span style={{
            fontSize: '0.62rem',
            color: 'var(--c-text-2)',
            fontFamily: 'var(--v-font-mono)',
          }}>
            {selectedHazards.size} selected
          </span>
          <span style={{ color: 'var(--c-rose-border)', fontSize: '0.7rem' }}>│</span>
          <button
            onClick={() => {
              const queued = hazards
                .filter((h) => selectedHazards.has(h.hazardId))
                .map((h) => ({
                  id: h.hazardId,
                  type: h.hazardType,
                  severity: 3,
                  geohash: h.geohash,
                  lat: h.lat,
                  lon: h.lon,
                  timestamp: h.timestamp,
                  confidence: h.confidence,
                  status: h.status,
                }));

              sessionStorage.setItem('vigia:maintenance:queuedHazards', JSON.stringify({ version: 1, hazards: queued }));
              window.dispatchEvent(new CustomEvent('vigia-report-maintenance', { detail: { hazards: queued } }));

              setSelectedHazards(new Set());
              setSelectionMode(false);
            }}
            disabled={selectedHazards.size === 0}
            style={{
              padding: '4px 9px',
              borderRadius: 4,
              cursor: selectedHazards.size === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--v-font-mono)',
              fontSize: '0.60rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              border: '1px solid var(--c-accent-glow)',
              background: 'var(--c-accent-glow)',
              color: 'var(--c-accent-2)',
              opacity: selectedHazards.size === 0 ? 0.5 : 1,
            }}
          >
            Report
          </button>
          <button
            onClick={() => {
              setSelectedHazards(new Set());
              setSelectionMode(false);
            }}
            style={{
              padding: '4px 9px',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'var(--v-font-mono)',
              fontSize: '0.60rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              border: '1px solid var(--c-border)',
              background: 'var(--c-overlay)',
              color: 'var(--c-text-3)',
            }}
          >
            Exit
          </button>
        </div>
      )}

      {mapReady && hazardsHydrated && (
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
      {mapReady && hazardsHydrated && (
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
      {mapReady && hazardsHydrated && selectedSession && (
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
      {mapReady && hazardsHydrated && (
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
      {mapReady && hazardsHydrated && <DiffLegend />}
      {mapReady && hazardsHydrated && <DiffMarkersLayer map={map.current} />}
      
      {/* New hazard notification toast */}
      {newHazardNotification && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          padding: '8px 16px',
          borderRadius: 4,
          background: toRgba(getCssVar('--c-rose', '#D94F5C'), 0.95),
          border: `1px solid ${getCssVar('--c-rose', '#D94F5C')}`,
          backdropFilter: 'blur(8px)',
          boxShadow: `0 4px 12px ${toRgba(getCssVar('--c-rose', '#D94F5C'), 0.4)}`,
          animation: 'slideDown 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              fontSize: '0.7rem', 
              color: 'var(--c-text)', 
              fontFamily: "var(--v-font-mono)",
              fontWeight: 600,
            }}>
              NEW HAZARD DETECTED
            </span>
          </div>
          <div style={{ 
            fontSize: '0.62rem', 
            color: 'var(--c-text-2)', 
            fontFamily: "var(--v-font-mono)",
            marginTop: 2,
          }}>
            {newHazardNotification}
          </div>
        </div>
      )}
    </div>
  );
}
