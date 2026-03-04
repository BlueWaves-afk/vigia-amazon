'use client';

import { useEffect, useRef, useState } from 'react';
import type { DiffMapFile } from '../../lib/diffCompute';
import maplibregl from 'maplibre-gl';
import { GitCompare, RefreshCw } from 'lucide-react';
import { DiffChat } from './DiffChat';
import { useSettings } from './SettingsContext';
import type { MapStyle } from './SettingsContext';

// CSS filter per map style — matches LiveMap exactly
const MAP_FILTERS: Record<MapStyle, string> = {
  'dark-osm':  'brightness(0.82) saturate(0.50) hue-rotate(192deg) contrast(1.05)',
  'satellite': 'brightness(0.72) saturate(0.70) hue-rotate(160deg) contrast(1.08)',
  'terrain':   'brightness(0.75) saturate(0.55) hue-rotate(30deg)  contrast(1.06) sepia(0.12)',
  'minimal':   'brightness(0.60) saturate(0.20) contrast(1.10)',
};

function applyMapFilter(el: HTMLDivElement | null, style: MapStyle) {
  if (!el) return;
  const canvas = el.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas) {
    canvas.style.filter = MAP_FILTERS[style];
    canvas.style.transition = 'filter 0.4s ease';
  }
}

function getMapStyle(style: MapStyle): string | maplibregl.StyleSpecification {
  const apiKey    = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';
  const styleMapNames: Partial<Record<MapStyle, string>> = {
    'satellite': process.env.NEXT_PUBLIC_MAP_NAME_SATELLITE || '',
    'terrain':   process.env.NEXT_PUBLIC_MAP_NAME_TERRAIN   || '',
  };
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
  const specificMap = styleMapNames[style];
  if (specificMap && apiKey)
    return `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${specificMap}/style-descriptor?key=${apiKey}`;
  const defaultMap = process.env.NEXT_PUBLIC_MAP_NAME || '';
  if (defaultMap && apiKey)
    return `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${defaultMap}/style-descriptor?key=${apiKey}`;
  return OSM_STYLE as any;
}

const MONO = 'var(--v-font-mono)';
const SANS = 'var(--v-font-ui)';

const C = {
  bg:      'var(--c-bg)',
  panel:   'var(--c-panel)',
  elevated:'var(--c-elevated)',
  border:  'var(--c-border)',
  borderMd:'var(--c-border-md)',
  text:    'var(--c-text)',
  textSec: 'var(--c-text-2)',
  textMut: 'var(--c-text-3)',
  hover:   'var(--c-hover)',
  rose:    'var(--c-rose-2)',
  roseDim: 'var(--c-rose-dim)',
  roseBdr: 'var(--c-rose-border)',
  red:     'var(--c-red)',
  redDim:  'var(--c-red-dim)',
  green:   'var(--c-green)',
  greenDim:'var(--c-green-dim)',
  yellow:  'var(--c-yellow)',
  yellowDim:'var(--c-yellow-dim)',
  overlay: 'var(--c-overlay)',
};

interface DiffViewProps {
  diffMap: DiffMapFile;
}

export function DiffView({ diffMap }: DiffViewProps) {
  const { settings } = useSettings();
  const mapARef = useRef<HTMLDivElement>(null);
  const mapBRef = useRef<HTMLDivElement>(null);
  const mapAInstance = useRef<maplibregl.Map | null>(null);
  const mapBInstance = useRef<maplibregl.Map | null>(null);
  
  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [syncMaps, setSyncMaps] = useState(true);
  const syncMapsRef = useRef(true);
  const syncingRef = useRef(false); // lock to prevent A→B→A infinite loop
  const [agentAnalysis, setAgentAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState({ a: false, b: false });

  // Fetch agent analysis on mount
  useEffect(() => {
    fetchAgentAnalysis();
  }, [diffMap]);

  const fetchAgentAnalysis = async () => {
    setIsAnalyzing(true);
    
    // Use client-side fallback analysis (no API call needed)
    const fallbackAnalysis = generateFallbackAnalysis(diffMap);
    setAgentAnalysis(fallbackAnalysis);
    setIsAnalyzing(false);
    
    // Emit trace event
    window.dispatchEvent(new CustomEvent('vigia-trace', {
      detail: { 
        type: 'agent-analysis', 
        message: `Diff analysis complete: ${diffMap.displayName}`,
        data: fallbackAnalysis,
      }
    }));
  };

  const generateFallbackAnalysis = (diffMap: DiffMapFile) => {
    const { summary, changes } = diffMap;
    
    let degradationLevel = 'moderate';
    let degradationText = '';
    
    if (summary.degradationScore > 70) {
      degradationLevel = 'severe';
      degradationText = 'The road infrastructure has experienced severe degradation';
    } else if (summary.degradationScore > 50) {
      degradationLevel = 'significant';
      degradationText = 'The road infrastructure shows significant deterioration';
    } else if (summary.degradationScore > 30) {
      degradationLevel = 'moderate';
      degradationText = 'The road infrastructure has moderate changes';
    } else {
      degradationLevel = 'minimal';
      degradationText = 'The road infrastructure shows minimal degradation';
    }

    const recommendations = [];
    
    if (summary.totalNew > 10) {
      recommendations.push('Immediate inspection required for newly identified hazards');
    }
    if (summary.totalWorsened > 5) {
      recommendations.push('Prioritize repair of worsening hazards to prevent further deterioration');
    }
    if (summary.degradationScore > 60) {
      recommendations.push('Allocate emergency maintenance budget for critical areas');
    }
    if (summary.totalFixed > 0) {
      recommendations.push(`Continue maintenance efforts - ${summary.totalFixed} hazards successfully addressed`);
    }
    if (recommendations.length === 0) {
      recommendations.push('Continue regular monitoring');
      recommendations.push('Schedule routine maintenance');
    }

    return {
      traceId: `analysis-${Date.now()}`,
      summary: `${degradationText} over ${summary.timeSpanDays.toFixed(1)} days. ${summary.totalNew} new hazards detected, ${summary.totalFixed} hazards fixed, and ${summary.totalWorsened} hazards worsened. Net change: ${summary.netChange > 0 ? '+' : ''}${summary.netChange} hazards.`,
      degradationAssessment: `Degradation Level: ${degradationLevel.toUpperCase()} (Score: ${summary.degradationScore.toFixed(1)}/100). ${summary.netChange > 0 ? 'Infrastructure quality is declining and requires attention' : 'Infrastructure quality is stable or improving'}.`,
      recommendations,
      confidence: 0.85,
      analyzedAt: Date.now(),
    };
  };

  // Initialize maps
  useEffect(() => {
    if (!mapARef.current || !mapBRef.current) return;
    // Do not guard on existing instances here — cleanup nulls them out

    const initMaps = async () => {
      try {
        // Wait one frame so flex layout has resolved dimensions
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        if (!mapARef.current || !mapBRef.current) return;

        const rectA = mapARef.current.getBoundingClientRect();
        const rectB = mapBRef.current.getBoundingClientRect();

        if (rectA.width === 0 || rectA.height === 0 || rectB.width === 0 || rectB.height === 0) {
          console.warn('Map containers have zero dimensions — retrying after layout...');
          // Retry once after a short delay
          setTimeout(() => {
            if (mapAInstance.current || mapBInstance.current) return;
            initMaps();
          }, 100);
          return;
        }

        const styleSpec = getMapStyle(settings.mapStyle);
        console.log('Using map style:', typeof styleSpec === 'string' ? styleSpec : 'OSM fallback');

        const centerA = diffMap.sessionA.coverage?.centerPoint || { lat: 0, lon: 0 };
        const centerB = diffMap.sessionB.coverage?.centerPoint || { lat: 0, lon: 0 };

        console.log('Initializing maps with centers:', centerA, centerB);

        // Map A (older session)
        mapAInstance.current = new maplibregl.Map({
          container: mapARef.current!,
          style: styleSpec,
          center: [centerA.lon, centerA.lat],
          zoom: 13,
          attributionControl: false,
        });

        // Map B (newer session)
        mapBInstance.current = new maplibregl.Map({
          container: mapBRef.current!,
          style: styleSpec,
          center: [centerB.lon, centerB.lat],
          zoom: 13,
          attributionControl: false,
        });

        console.log('Maps created, waiting for load...');

        // Error handling
        mapAInstance.current.on('error', (e) => {
          console.error('Map A error:', e);
        });

        mapBInstance.current.on('error', (e) => {
          console.error('Map B error:', e);
        });

        // Add navigation controls
        mapAInstance.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        mapBInstance.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        // Synchronized movement — guarded with a lock to prevent infinite recursion
        const syncMapMovement = (source: maplibregl.Map, target: maplibregl.Map) => {
          if (!syncMapsRef.current || syncingRef.current) return;
          syncingRef.current = true;
          const center = source.getCenter();
          const zoom = source.getZoom();
          target.jumpTo({ center, zoom });
          syncingRef.current = false;
        };

        mapAInstance.current.on('move', () => {
          if (syncMapsRef.current && mapBInstance.current) {
            syncMapMovement(mapAInstance.current!, mapBInstance.current);
          }
        });

        mapBInstance.current.on('move', () => {
          if (syncMapsRef.current && mapAInstance.current) {
            syncMapMovement(mapBInstance.current!, mapAInstance.current);
          }
        });

        // Resize maps when their containers change size (sidebar collapse etc.)
        const resizeObserver = new ResizeObserver(() => {
          mapAInstance.current?.resize();
          mapBInstance.current?.resize();
        });
        if (mapARef.current) resizeObserver.observe(mapARef.current);
        if (mapBRef.current) resizeObserver.observe(mapBRef.current);
        // Store cleanup fn on instances so the effect cleanup can call it
        (mapAInstance.current as any).__resizeObserver = resizeObserver;

        // Add hazard markers + apply CSS filter after map loads
        mapAInstance.current.on('load', () => {
          console.log('Map A loaded');
          setMapsLoaded(prev => ({ ...prev, a: true }));
          addHazardMarkers(mapAInstance.current!, 'A');
          applyMapFilter(mapARef.current, settings.mapStyle);
        });
        
        mapBInstance.current.on('load', () => {
          console.log('Map B loaded');
          setMapsLoaded(prev => ({ ...prev, b: true }));
          addHazardMarkers(mapBInstance.current!, 'B');
          applyMapFilter(mapBRef.current, settings.mapStyle);
        });
      } catch (error) {
        console.error('Failed to initialize maps:', error);
      }
    };

    initMaps();

    return () => {
      // Disconnect resize observer before removing maps
      const ro = (mapAInstance.current as any)?.__resizeObserver as ResizeObserver | undefined;
      ro?.disconnect();
      mapAInstance.current?.remove();
      mapAInstance.current = null;
      mapBInstance.current?.remove();
      mapBInstance.current = null;
    };
  }, [diffMap]);

  // Re-apply filter when the user switches map style in settings
  useEffect(() => {
    if (mapsLoaded.a) applyMapFilter(mapARef.current, settings.mapStyle);
    if (mapsLoaded.b) applyMapFilter(mapBRef.current, settings.mapStyle);
  }, [settings.mapStyle, mapsLoaded]);

  const addHazardMarkers = (map: maplibregl.Map, session: 'A' | 'B') => {
    const { newHazards, fixedHazards, worsenedHazards, unchangedHazards } = diffMap.changes;

    const popup = (colorVar: string, label: string, type: string, detail: string) =>
      `<div style="font-family:${MONO};font-size:0.68rem;padding:2px 0;">
        <span style="color:${colorVar};font-weight:700;letter-spacing:0.06em;">${label}</span><br/>
        <span style="color:var(--c-text)">${type}</span><br/>
        <span style="color:var(--c-text-2)">${detail}</span>
      </div>`;

    if (session === 'B') {
      newHazards.forEach(h => {
        const el = createMarkerElement('var(--c-red)', 'var(--c-red-dim)');
        new maplibregl.Marker({ element: el })
          .setLngLat([h.lon, h.lat])
          .setPopup(new maplibregl.Popup({ className: 'vigia-popup' }).setHTML(
            popup('var(--c-red)', 'NEW', h.type, `Severity: ${h.severity}`)
          ))
          .addTo(map);
      });
    }

    if (session === 'A') {
      fixedHazards.forEach(h => {
        const el = createMarkerElement('var(--c-green)', 'var(--c-green-dim)');
        new maplibregl.Marker({ element: el })
          .setLngLat([h.lon, h.lat])
          .setPopup(new maplibregl.Popup({ className: 'vigia-popup' }).setHTML(
            popup('var(--c-green)', 'FIXED', h.type, `Was: ${h.severity}`)
          ))
          .addTo(map);
      });
    }

    worsenedHazards.forEach(h => {
      const el = createMarkerElement('var(--c-yellow)', 'var(--c-yellow-dim)');
      new maplibregl.Marker({ element: el })
        .setLngLat([h.lon, h.lat])
        .setPopup(new maplibregl.Popup({ className: 'vigia-popup' }).setHTML(
          popup('var(--c-yellow)', 'WORSENED', h.type, `${h.oldSeverity} → ${h.newSeverity}`)
        ))
        .addTo(map);
    });

    unchangedHazards.forEach(h => {
      const el = createMarkerElement('var(--c-text-3)', 'var(--c-hover)');
      new maplibregl.Marker({ element: el })
        .setLngLat([h.lon, h.lat])
        .setPopup(new maplibregl.Popup({ className: 'vigia-popup' }).setHTML(
          popup('var(--c-text-2)', 'UNCHANGED', h.type, `Severity: ${h.severity}`)
        ))
        .addTo(map);
    });
  };

  const createMarkerElement = (colorVar: string, bgVar: string) => {
    const el = document.createElement('div');
    el.style.width = '14px';
    el.style.height = '14px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = bgVar;
    el.style.border = `1.5px solid ${colorVar}`;
    el.style.cursor = 'pointer';
    el.style.boxShadow = `0 0 0 2px var(--c-bg)`;
    return el;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <style>{`@keyframes dv-spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Panel header ── */}
      <div className="vigia-panel-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', height: 32,
        borderBottom: 'none',
        background: C.panel,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <GitCompare size={12} style={{ color: C.rose, flexShrink: 0 }} />
          <span style={{
            fontSize: '0.62rem', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: C.textMut, fontFamily: MONO,
          }}>
            Diff View
          </span>
          <span style={{
            fontSize: '0.65rem', color: C.textSec, fontFamily: MONO,
          }}>
            {diffMap.displayName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.62rem', color: C.textMut, fontFamily: MONO }}>
            {diffMap.summary.timeSpanDays.toFixed(1)}d apart
          </span>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: '0.65rem', color: C.textSec, fontFamily: SANS,
            cursor: 'pointer', userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={syncMaps}
              onChange={(e) => {
                setSyncMaps(e.target.checked);
                syncMapsRef.current = e.target.checked;
              }}
              style={{ accentColor: 'var(--c-rose-2)', cursor: 'pointer' }}
            />
            Sync
          </label>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: `1px solid var(--v-border-default)`,
        background: C.elevated,
        flexShrink: 0,
      }}>
        {[
          { label: 'NEW',       value: diffMap.summary.totalNew,       color: C.red,    dim: C.redDim    },
          { label: 'FIXED',     value: diffMap.summary.totalFixed,     color: C.green,  dim: C.greenDim  },
          { label: 'WORSENED',  value: diffMap.summary.totalWorsened,  color: C.yellow, dim: C.yellowDim },
          { label: 'UNCHANGED', value: diffMap.summary.totalUnchanged ?? 0, color: C.textSec, dim: C.hover },
        ].map(({ label, value, color, dim }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px',
            borderRight: `1px solid var(--v-border-subtle)`,
            fontFamily: MONO,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.58rem', color: C.textMut, letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ fontSize: '0.72rem', color, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px' }}>
          <span style={{ fontSize: '0.58rem', color: C.textMut, fontFamily: MONO, letterSpacing: '0.06em' }}>DEGRADATION</span>
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, fontFamily: MONO,
            color: diffMap.summary.degradationScore > 60 ? C.red
                 : diffMap.summary.degradationScore > 40 ? C.yellow
                 : C.green,
          }}>
            {diffMap.summary.degradationScore.toFixed(1)}
            <span style={{ fontWeight: 400, fontSize: '0.58rem', color: C.textMut }}>/100</span>
          </span>
        </div>
      </div>

      {/* ── Side-by-side maps + chat ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Maps */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Map A */}
          <div style={{ flex: 1, position: 'relative', borderRight: `1px solid var(--v-border-default)` }}>
            <div style={{
              position: 'absolute', top: 8, left: 8, zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 4,
              background: C.overlay,
              backdropFilter: 'blur(8px)',
              border: `1px solid var(--v-border-default)`,
              fontFamily: MONO, fontSize: '0.62rem', color: C.textSec,
              pointerEvents: 'none',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.rose }} />
              {diffMap.sessionA.displayName}
            </div>
            {!mapsLoaded.a && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex', alignItems: 'center', gap: 7,
                color: C.textSec, fontFamily: MONO, fontSize: '0.7rem',
              }}>
                <RefreshCw size={13} style={{ color: C.rose, animation: 'dv-spin 1s linear infinite' }} />
                Loading map
              </div>
            )}
            <div ref={mapARef} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Map B */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 8, left: 8, zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 4,
              background: C.overlay,
              backdropFilter: 'blur(8px)',
              border: `1px solid var(--v-border-default)`,
              fontFamily: MONO, fontSize: '0.62rem', color: C.textSec,
              pointerEvents: 'none',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.rose }} />
              {diffMap.sessionB.displayName}
            </div>
            {!mapsLoaded.b && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex', alignItems: 'center', gap: 7,
                color: C.textSec, fontFamily: MONO, fontSize: '0.7rem',
              }}>
                <RefreshCw size={13} style={{ color: C.rose, animation: 'dv-spin 1s linear infinite' }} />
                Loading map
              </div>
            )}
            <div ref={mapBRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>

        {/* Chat panel */}
        <div style={{ width: 400, flexShrink: 0 }}>
          <DiffChat diffMap={diffMap} agentAnalysis={agentAnalysis} />
        </div>
      </div>
    </div>
  );
}
