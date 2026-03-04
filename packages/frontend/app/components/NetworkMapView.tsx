'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSettings } from './SettingsContext';
import { applyMapFilter } from '../lib/map-style';
import { AgentChatPanel } from './AgentChatPanel';

const C = {
  bg:      'var(--c-bg)',
  panel:   'var(--c-panel)',
  elevated:'var(--c-elevated)',
  border:  'var(--c-border)',
  text:    'var(--c-text)',
  textSec: 'var(--c-text-2)',
  textMut: 'var(--c-text-3)',
  accent:  'var(--c-accent-2)',
  green:   'var(--c-green)',
};

const FONT = 'var(--v-font-ui)';
const MONO = 'var(--v-font-mono)';

// Resolve accent color for MapLibre (which can't use CSS vars)
const getAccentHex = (theme: string) =>
  theme === 'light' ? '#2563EB' : theme === 'high-contrast' ? '#78AAFF' : '#4278F5';

// Resolve background color for map fallback style
const getBgHex = (theme: string) =>
  theme === 'light' ? '#F4F7FC' : theme === 'darker' ? '#05070C' : theme === 'high-contrast' ? '#000000' : '#0A0E15';

// Resolve raster tint for OSM tiles
const getOSMPaint = (theme: string): Record<string, number> =>
  theme === 'light'
    ? { 'raster-opacity': 0.9, 'raster-saturation': -0.3, 'raster-brightness-max': 1.0, 'raster-contrast': 0.1 }
    : { 'raster-opacity': 0.5, 'raster-saturation': -1,   'raster-brightness-max': 0.6, 'raster-contrast': 0.3 };

// Demo data: Active nodes in India (simulating real VIGIA users)
const DEMO_NODES = [
  { id: 'node-1', lat: 28.6139, lon: 77.2090, city: 'New Delhi', sessions: 142, coverage: 45.2, geohash: 'ttv2yzr' },
  { id: 'node-2', lat: 19.0760, lon: 72.8777, city: 'Mumbai', sessions: 238, coverage: 67.8, geohash: 'te7myzr' },
  { id: 'node-3', lat: 13.0827, lon: 80.2707, city: 'Chennai', sessions: 156, coverage: 52.1, geohash: 'tdm8yzr' },
  { id: 'node-4', lat: 22.5726, lon: 88.3639, city: 'Kolkata', sessions: 189, coverage: 58.4, geohash: 'tuvnyzr' },
  { id: 'node-5', lat: 12.9716, lon: 77.5946, city: 'Bangalore', sessions: 312, coverage: 78.9, geohash: 'tdm2yzr' },
  { id: 'node-6', lat: 17.3850, lon: 78.4867, city: 'Hyderabad', sessions: 201, coverage: 61.3, geohash: 'tep4yzr' },
  { id: 'node-7', lat: 23.0225, lon: 72.5714, city: 'Ahmedabad', sessions: 134, coverage: 43.7, geohash: 'ts7kyzr' },
  { id: 'node-8', lat: 18.5204, lon: 73.8567, city: 'Pune', sessions: 167, coverage: 54.2, geohash: 'te9myzr' },
  { id: 'node-9', lat: 26.9124, lon: 75.7873, city: 'Jaipur', sessions: 98, coverage: 38.6, geohash: 'tsv8yzr' },
  { id: 'node-10', lat: 21.1458, lon: 79.0882, city: 'Nagpur', sessions: 87, coverage: 32.4, geohash: 'tep9yzr' },
];

// Seeded random for consistent road generation
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Generate realistic city road network (grid + arterials + curves)
const generateCityRoads = (node: typeof DEMO_NODES[0], index: number) => {
  const roads: number[][][] = [];
  const seed = index * 1000;
  const coverage = node.coverage / 100;
  const gridSize = 0.015; // ~1.5km grid blocks
  const cityRadius = 0.08 + coverage * 0.12; // City size based on coverage
  
  // Generate main grid roads (horizontal and vertical streets)
  const gridLines = Math.floor(4 + coverage * 8);
  
  for (let i = 0; i < gridLines; i++) {
    const offset = (i - gridLines / 2) * gridSize;
    const jitter = (seededRandom(seed + i) - 0.5) * 0.003; // Slight irregularity
    
    // Horizontal roads with slight curves
    const hRoad: number[][] = [];
    const hLength = cityRadius * (0.6 + seededRandom(seed + i + 100) * 0.4);
    for (let t = 0; t <= 10; t++) {
      const progress = t / 10;
      const x = node.lon - hLength + progress * hLength * 2;
      const curve = Math.sin(progress * Math.PI) * 0.005 * seededRandom(seed + i + 200);
      hRoad.push([x, node.lat + offset + jitter + curve]);
    }
    if (hRoad.length > 1) roads.push(hRoad);
    
    // Vertical roads with slight curves
    const vRoad: number[][] = [];
    const vLength = cityRadius * (0.6 + seededRandom(seed + i + 300) * 0.4);
    for (let t = 0; t <= 10; t++) {
      const progress = t / 10;
      const y = node.lat - vLength + progress * vLength * 2;
      const curve = Math.sin(progress * Math.PI) * 0.005 * seededRandom(seed + i + 400);
      vRoad.push([node.lon + offset + jitter + curve, y]);
    }
    if (vRoad.length > 1) roads.push(vRoad);
  }
  
  // Generate main arterial roads (diagonal highways)
  const numArterials = Math.floor(2 + coverage * 4);
  for (let i = 0; i < numArterials; i++) {
    const angle = (Math.PI * 2 * i) / numArterials + seededRandom(seed + i + 500) * 0.3;
    const arterial: number[][] = [];
    const length = cityRadius * (1.2 + seededRandom(seed + i + 600) * 0.6);
    
    for (let t = 0; t <= 15; t++) {
      const progress = t / 15;
      const dist = progress * length;
      // Add realistic curves to arterials
      const curve = Math.sin(progress * Math.PI * 2) * 0.01 * seededRandom(seed + i + 700);
      const perpAngle = angle + Math.PI / 2;
      arterial.push([
        node.lon + Math.cos(angle) * dist + Math.cos(perpAngle) * curve,
        node.lat + Math.sin(angle) * dist + Math.sin(perpAngle) * curve,
      ]);
    }
    if (arterial.length > 1) roads.push(arterial);
  }
  
  // Generate ring roads (circular routes around city center)
  if (coverage > 0.4) {
    const ringRoad: number[][] = [];
    const ringRadius = cityRadius * 0.7;
    for (let t = 0; t <= 36; t++) {
      const angle = (Math.PI * 2 * t) / 36;
      const wobble = 1 + (seededRandom(seed + t + 800) - 0.5) * 0.1;
      ringRoad.push([
        node.lon + Math.cos(angle) * ringRadius * wobble,
        node.lat + Math.sin(angle) * ringRadius * wobble,
      ]);
    }
    roads.push(ringRoad);
  }
  
  return roads;
};

export function NetworkMapView() {
  const { settings } = useSettings();
  const accentHex = getAccentHex(settings.theme);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedNode, setSelectedNode] = useState<typeof DEMO_NODES[0] | null>(null);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [stats, setStats] = useState({
    totalNodes: DEMO_NODES.length,
    totalSessions: DEMO_NODES.reduce((sum, n) => sum + n.sessions, 0),
    avgCoverage: (DEMO_NODES.reduce((sum, n) => sum + n.coverage, 0) / DEMO_NODES.length).toFixed(1),
  });

  const zoomOut = () => {
    map.current?.flyTo({
      center: [78.9629, 20.5937],
      zoom: 4.5,
      duration: 1500,
      essential: true,
    });
    setSelectedNode(null);
    setIsZoomedIn(false);
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Resolve Amazon Location Service style URL (same pattern as LiveMap)
    const apiKey    = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';
    const mapName   = process.env.NEXT_PUBLIC_MAP_NAME || '';
    const awsStyle  = apiKey && mapName
      ? `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`
      : {
          version: 8 as const,
          sources: {
            'osm': { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19 },
          },
          layers: [
            { id: 'background', type: 'background' as const, paint: { 'background-color': getBgHex(settings.theme) } },
            { id: 'osm-tiles',  type: 'raster'     as const, source: 'osm', paint: { ...getOSMPaint(settings.theme) } },
          ],
        };

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: awsStyle as any,
      center: [78.9629, 20.5937], // Center of India
      zoom: 4.5,
      attributionControl: false,
    });

    map.current.on('load', () => {
      if (!map.current) return;

      applyMapFilter(mapContainer.current, settings.mapStyle);

      // Add road segments (green lines tracing city road networks)
      const roadFeatures = DEMO_NODES.flatMap((node, index) =>
        generateCityRoads(node, index).map((roadCoords, roadIndex) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: roadCoords,
          },
          properties: { nodeId: node.id, roadIndex },
        }))
      );

      map.current.addSource('roads', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: roadFeatures,
        },
      });

      // Road glow effect
      map.current.addLayer({
        id: 'roads-glow',
        type: 'line',
        source: 'roads',
        paint: {
          'line-color': accentHex,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 4,
            8, 8,
            12, 12,
          ],
          'line-opacity': 0.15,
          'line-blur': 3,
        },
      });

      // Main road lines
      map.current.addLayer({
        id: 'roads-layer',
        type: 'line',
        source: 'roads',
        paint: {
          'line-color': accentHex,
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 1.5,
            8, 2.5,
            12, 4,
          ],
          'line-opacity': 0.85,
        },
      });

      // Add node points (green dots with glow)
      const nodeFeatures = DEMO_NODES.map(node => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [node.lon, node.lat],
        },
        properties: node,
      }));

      map.current.addSource('nodes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: nodeFeatures,
        },
      });

      // Outer glow effect
      map.current.addLayer({
        id: 'nodes-glow-outer',
        type: 'circle',
        source: 'nodes',
        paint: {
          'circle-radius': 25,
          'circle-color': accentHex,
          'circle-opacity': 0.15,
          'circle-blur': 1,
        },
      });

      // Inner glow effect
      map.current.addLayer({
        id: 'nodes-glow',
        type: 'circle',
        source: 'nodes',
        paint: {
          'circle-radius': 15,
          'circle-color': accentHex,
          'circle-opacity': 0.35,
          'circle-blur': 0.8,
        },
      });

      // Main node dots
      map.current.addLayer({
        id: 'nodes-layer',
        type: 'circle',
        source: 'nodes',
        paint: {
          'circle-radius': 8,
          'circle-color': accentHex,
          'circle-opacity': 1,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-opacity': 0.6,
        },
      });

      // Click handler for nodes - zoom into city
      map.current.on('click', 'nodes-layer', (e) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties as any;
          setSelectedNode(props);
          
          // Fly to the clicked node
          const coords = (e.features[0].geometry as any).coordinates;
          map.current?.flyTo({
            center: coords,
            zoom: 12,
            duration: 1500,
            essential: true,
          });
          setIsZoomedIn(true);
        }
      });

      // Hover cursor
      map.current.on('mouseenter', 'nodes-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'nodes-layer', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      setMapReady(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map layer colors when theme changes
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const m = map.current;
    const hex = accentHex;
    try {
      m.setPaintProperty('roads-glow',        'line-color',   hex);
      m.setPaintProperty('roads-layer',       'line-color',   hex);
      m.setPaintProperty('nodes-glow-outer',  'circle-color', hex);
      m.setPaintProperty('nodes-glow',        'circle-color', hex);
      m.setPaintProperty('nodes-layer',       'circle-color', hex);
      // Also update background for keyless OSM fallback
      if (m.getLayer('background')) {
        m.setPaintProperty('background', 'background-color', getBgHex(settings.theme));
      }
      if (m.getLayer('osm-tiles')) {
        const p = getOSMPaint(settings.theme);
        Object.entries(p).forEach(([k, v]) => m.setPaintProperty('osm-tiles', k, v));
      }
    } catch (_) { /* layers may not exist yet */ }
  }, [settings.theme, mapReady]);

  // Reapply CSS filter whenever map style setting changes
  useEffect(() => {
    if (!mapReady) return;
    applyMapFilter(mapContainer.current, settings.mapStyle);
  }, [settings.mapStyle, mapReady]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div className="vigia-panel-header" style={{
        padding: '0 16px',
        height: 38, flexShrink: 0,
        borderBottom: 'none',
        background: C.panel,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.text, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Network Surveillance
            </span>
            <span style={{ fontSize: '0.6rem', color: C.textMut, fontFamily: MONO }}>
              Real-time road intelligence
            </span>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 20, fontFamily: MONO, fontSize: '0.62rem' }}>
              <div>
                <div style={{ color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Active Nodes</div>
                <div style={{ color: C.accent, fontSize: '0.82rem', fontWeight: 600 }}>{stats.totalNodes}</div>
              </div>
              <div>
                <div style={{ color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Total Sessions</div>
                <div style={{ color: C.accent, fontSize: '0.82rem', fontWeight: 600 }}>{stats.totalSessions}</div>
              </div>
              <div>
                <div style={{ color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Avg Coverage</div>
                <div style={{ color: C.accent, fontSize: '0.82rem', fontWeight: 600 }}>{stats.avgCoverage}%</div>
              </div>
            </div>

            {isZoomedIn && (
              <button
                onClick={zoomOut}
                style={{
                  background: 'var(--c-accent-glow)',
                  border: `1px solid color-mix(in srgb, var(--v-accent) 30%, transparent)`,
                  borderRadius: 3,
                  padding: '4px 10px',
                  color: C.accent,
                  cursor: 'pointer',
                  fontFamily: MONO,
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-accent-glow)'}
              >
                ← Zoom Out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        
        {/* Node info overlay */}
        {selectedNode && (
          <div style={{
            position: 'absolute', top: 12, right: 44,
            background: 'var(--c-overlay)',
            border: `1px solid var(--v-rose-border)`,
            borderRadius: 4,
            padding: '10px 12px',
            minWidth: 200,
            fontFamily: MONO,
            fontSize: '0.65rem',
            backdropFilter: 'blur(8px)',
            zIndex: 5,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: C.text, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {selectedNode.city}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: 'transparent', border: 'none', color: C.textMut, cursor: 'pointer', fontSize: '1rem', padding: 0, display: 'flex', lineHeight: 1 }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = C.text}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = C.textMut}
              >
                ×
              </button>
            </div>
            <div style={{ color: C.textMut, marginBottom: 3 }}>ID: {selectedNode.id}</div>
            <div style={{ color: C.textMut, marginBottom: 6 }}>{selectedNode.lat.toFixed(4)}, {selectedNode.lon.toFixed(4)}</div>
            <div className="ide-divider" style={{ marginBottom: 6 }} />
            <div style={{ color: C.textSec, marginBottom: 3 }}>
              Sessions: <span style={{ color: C.accent, fontWeight: 600 }}>{selectedNode.sessions}</span>
            </div>
            <div style={{ color: C.textSec, marginBottom: 8 }}>
              Coverage: <span style={{ color: C.accent, fontWeight: 600 }}>{selectedNode.coverage}%</span>
            </div>
            <div className="ide-divider" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: '0.7rem', color: C.textMut, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Ask Agent
            </div>
            <button
              onClick={() => {
                const context = `Analyze network health for geohash ${selectedNode.geohash} in ${selectedNode.city}. Use analyze_node_connectivity to get active node count, geographic spread, and health score for this area.`;
                (window as any).__networkAgentContext = context;
                (window as any).__networkAgentTrigger?.();
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                background: C.accent,
                border: `1px solid color-mix(in srgb, var(--v-accent) 30%, transparent)`,
                borderRadius: 3,
                color: C.text,
                fontSize: '0.7rem',
                cursor: 'pointer',
                marginBottom: 4,
                fontFamily: FONT,
              }}
            >
              Analyze This Node
            </button>
            <button
              onClick={() => {
                // Calculate bounding box (~10km around node)
                const latOffset = 0.05; // ~5km
                const lonOffset = 0.05;
                const bbox = {
                  north: selectedNode.lat + latOffset,
                  south: selectedNode.lat - latOffset,
                  east: selectedNode.lon + lonOffset,
                  west: selectedNode.lon - lonOffset,
                };
                const context = `Identify coverage gaps near ${selectedNode.city}. Use identify_coverage_gaps with bounding box: north=${bbox.north.toFixed(4)}, south=${bbox.south.toFixed(4)}, east=${bbox.east.toFixed(4)}, west=${bbox.west.toFixed(4)}, and minReportsThreshold=5.`;
                (window as any).__networkAgentContext = context;
                (window as any).__networkAgentTrigger?.();
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                background: 'transparent',
                border: `1px solid var(--v-border-default)`,
                borderRadius: 3,
                color: C.text,
                fontSize: '0.7rem',
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              Find Coverage Gaps
            </button>
          </div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 16, left: 10,
          background: 'var(--c-overlay)',
          border: `1px solid var(--v-border-default)`,
          borderRadius: 4,
          padding: '8px 12px',
          fontFamily: MONO,
          fontSize: '0.62rem',
          backdropFilter: 'blur(8px)',
          zIndex: 5,
        }}>
          <div style={{ color: C.textMut, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.58rem' }}>Legend</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, flexShrink: 0 }} />
            <span style={{ color: C.textSec }}>Active Node</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 2, background: C.accent, opacity: 0.5, flexShrink: 0 }} />
            <span style={{ color: C.textSec }}>Covered Road</span>
          </div>
        </div>
      </div>
      </div>
      <AgentChatPanel
        contextType="network"
        context={{ nodeCount: stats.totalNodes, totalSessions: stats.totalSessions, avgCoverage: stats.avgCoverage }}
      />
    </div>
  );
}
