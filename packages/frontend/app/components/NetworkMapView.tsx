'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const C = {
  bg: '#0A0E14',
  panel: '#141920',
  border: 'rgba(0, 255, 0, 0.2)',
  text: '#00FF00',
  textDim: '#00AA00',
  accent: '#00FF00',
};

// Demo data: Active nodes in India (simulating real VIGIA users)
const DEMO_NODES = [
  { id: 'node-1', lat: 28.6139, lon: 77.2090, city: 'New Delhi', sessions: 142, coverage: 45.2 },
  { id: 'node-2', lat: 19.0760, lon: 72.8777, city: 'Mumbai', sessions: 238, coverage: 67.8 },
  { id: 'node-3', lat: 13.0827, lon: 80.2707, city: 'Chennai', sessions: 156, coverage: 52.1 },
  { id: 'node-4', lat: 22.5726, lon: 88.3639, city: 'Kolkata', sessions: 189, coverage: 58.4 },
  { id: 'node-5', lat: 12.9716, lon: 77.5946, city: 'Bangalore', sessions: 312, coverage: 78.9 },
  { id: 'node-6', lat: 17.3850, lon: 78.4867, city: 'Hyderabad', sessions: 201, coverage: 61.3 },
  { id: 'node-7', lat: 23.0225, lon: 72.5714, city: 'Ahmedabad', sessions: 134, coverage: 43.7 },
  { id: 'node-8', lat: 18.5204, lon: 73.8567, city: 'Pune', sessions: 167, coverage: 54.2 },
  { id: 'node-9', lat: 26.9124, lon: 75.7873, city: 'Jaipur', sessions: 98, coverage: 38.6 },
  { id: 'node-10', lat: 21.1458, lon: 79.0882, city: 'Nagpur', sessions: 87, coverage: 32.4 },
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

    // Initialize map with dark surveillance style
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0A0E14' },
          },
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
            paint: {
              'raster-opacity': 0.5, // Higher visibility base map
              'raster-brightness-min': 0,
              'raster-brightness-max': 0.6,
              'raster-saturation': -1, // Grayscale
              'raster-contrast': 0.3, // Add contrast
            },
          },
        ],
      },
      center: [78.9629, 20.5937], // Center of India
      zoom: 4.5,
      attributionControl: false,
    });

    map.current.on('load', () => {
      if (!map.current) return;

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
          'line-color': '#00FF00',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            4, 4,
            8, 8,
            12, 12,
          ],
          'line-opacity': 0.2,
          'line-blur': 3,
        },
      });

      // Main road lines
      map.current.addLayer({
        id: 'roads-layer',
        type: 'line',
        source: 'roads',
        paint: {
          'line-color': '#00FF00',
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
          'circle-color': '#00FF00',
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
          'circle-color': '#00FF00',
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
          'circle-color': '#00FF00',
          'circle-opacity': 1,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-opacity': 0.8,
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

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${C.border}`,
        background: C.panel,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text, fontFamily: 'Inter, sans-serif' }}>
              VIGIA NETWORK SURVEILLANCE
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textDim, fontFamily: 'JetBrains Mono, monospace' }}>
              Real-time road intelligence network
            </p>
          </div>
          
          {/* Stats */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 24, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              <div>
                <div style={{ color: C.textDim }}>ACTIVE NODES</div>
                <div style={{ color: C.text, fontSize: 16, fontWeight: 600 }}>{stats.totalNodes}</div>
              </div>
              <div>
                <div style={{ color: C.textDim }}>TOTAL SESSIONS</div>
                <div style={{ color: C.text, fontSize: 16, fontWeight: 600 }}>{stats.totalSessions}</div>
              </div>
              <div>
                <div style={{ color: C.textDim }}>AVG COVERAGE</div>
                <div style={{ color: C.text, fontSize: 16, fontWeight: 600 }}>{stats.avgCoverage}%</div>
              </div>
            </div>
            
            {isZoomedIn && (
              <button
                onClick={zoomOut}
                style={{
                  background: 'rgba(0, 255, 0, 0.15)',
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  padding: '8px 12px',
                  color: C.text,
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ← ZOOM OUT
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
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'rgba(10, 14, 20, 0.95)',
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: 12,
            minWidth: 200,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: C.text, fontWeight: 600 }}>NODE: {selectedNode.city.toUpperCase()}</span>
              <button
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.text,
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ color: C.textDim, marginBottom: 4 }}>
              ID: {selectedNode.id}
            </div>
            <div style={{ color: C.textDim, marginBottom: 4 }}>
              Location: {selectedNode.lat.toFixed(4)}, {selectedNode.lon.toFixed(4)}
            </div>
            <div style={{ height: 1, background: C.border, margin: '8px 0' }} />
            <div style={{ color: C.text, marginBottom: 4 }}>
              Sessions: <span style={{ color: C.accent }}>{selectedNode.sessions}</span>
            </div>
            <div style={{ color: C.text }}>
              Coverage: <span style={{ color: C.accent }}>{selectedNode.coverage}%</span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(10, 14, 20, 0.95)',
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: 12,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
        }}>
          <div style={{ color: C.text, fontWeight: 600, marginBottom: 8 }}>LEGEND</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />
            <span style={{ color: C.textDim }}>Active Node</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 2, background: C.accent, opacity: 0.4 }} />
            <span style={{ color: C.textDim }}>Covered Road</span>
          </div>
        </div>
      </div>
    </div>
  );
}
