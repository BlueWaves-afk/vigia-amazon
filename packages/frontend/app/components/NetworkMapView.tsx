'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RefreshCw } from 'lucide-react';
import { useSettings } from './SettingsContext';
import { applyMapFilter } from '../lib/map-style';
import { AgentChatPanel } from './AgentChatPanel';
import { GlobalNetworkExplorer } from './GlobalNetworkExplorer';
import { Skeleton } from './Skeleton';

const C = {
  bg:      'var(--c-panel)',
  panel:   'var(--v-hover)',
  elevated:'var(--c-bg)',
  border:  'var(--v-border-default)',
  text:    'var(--c-text)',
  textSec: 'var(--c-text-2)',
  textMut: 'var(--c-text-3)',
  accent:  'var(--c-accent-2)',
  green:   'var(--c-green)',
};

const FONT = 'var(--v-font-ui)';
const MONO = 'var(--v-font-mono)';

function NetworkMapSkeleton() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, padding: 8, gap: 8 }}>
      <div style={{
        height: 38, flexShrink: 0,
        background: C.panel,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
      }}>
        <Skeleton width={150} height={12} />
        <Skeleton width={150} height={12} style={{ marginLeft: 20 }} />
        <Skeleton width={200} height={20} style={{ marginLeft: 'auto' }} />
      </div>
      <div style={{ flex: 1, background: C.panel, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton width="80%" height={24} />
          <Skeleton width="60%" height={18} />
          <Skeleton variant="rectangular" height={300} style={{ borderRadius: 8, marginTop: 16 }} />
        </div>
      </div>
    </div>
  );
}

// Resolve colors for MapLibre (which can't read CSS vars directly)
const getCssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const getAccentColor = () => getCssVar('--c-accent-2', '#4278F5');
const getBgColor = () => getCssVar('--c-bg', '#0A0E15');

// Resolve raster tint for OSM tiles
const getOSMPaint = (theme: string): Record<string, number> =>
  theme === 'light'
    ? { 'raster-opacity': 0.9, 'raster-saturation': -0.3, 'raster-brightness-max': 1.0, 'raster-contrast': 0.1 }
    : { 'raster-opacity': 0.5, 'raster-saturation': -1,   'raster-brightness-max': 0.6, 'raster-contrast': 0.3 };

// Real network data fetched from /api/network-nodes
interface NetworkNode { wallet: string; lat: number; lon: number; lastSeen: string; reportCount: number; lastHazardType: string; }
interface CoveragePoint { lat: number; lon: number; hazardType: string; }
interface NetworkData { nodes: NetworkNode[]; coverage: CoveragePoint[]; stats: { activeNodes: number; totalReports: number; verifiedCoverage: number } }

export function NetworkMapView() {
  const { settings } = useSettings();
  const accentHex = getAccentColor();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [activeTab, setActiveTab] = useState<'surveillance' | 'explorer'>('surveillance');
  const [mapReady, setMapReady] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [networkData, setNetworkData] = useState<NetworkData>({ nodes: [], coverage: [], stats: { activeNodes: 0, totalReports: 0, verifiedCoverage: 0 } });
  const [loading, setLoading] = useState(true);

  const fetchNetworkData = async () => {
    try {
      const res = await fetch('/api/network-nodes');
      if (res.ok) {
        const data: NetworkData = await res.json();
        setNetworkData(data);
      }
    } catch (e) { console.error('[NetworkMapView] fetch failed', e); }
    setLoading(false);
  };

  useEffect(() => {
    fetchNetworkData();
    const interval = setInterval(fetchNetworkData, 30000);
    return () => clearInterval(interval);
  }, []);

  const zoomOut = () => {
    map.current?.flyTo({ center: [20, 20], zoom: 2, duration: 1500, essential: true });
    setSelectedNode(null);
    setIsZoomedIn(false);
  };

  useEffect(() => {
    if (!mapContainer.current || map.current || activeTab !== 'surveillance') return;

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
            { id: 'background', type: 'background' as const, paint: { 'background-color': getBgColor() } },
            { id: 'osm-tiles',  type: 'raster'     as const, source: 'osm', paint: { ...getOSMPaint(settings.theme) } },
          ],
        };

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: awsStyle as any,
      center: [20, 20], // World center
      zoom: 2,
      attributionControl: false,
    });

    map.current.on('load', () => {
      if (!map.current) return;

      applyMapFilter(mapContainer.current, settings.mapStyle);

      // ── Coverage points (verified hazard locations) — green dots ──────────
      map.current.addSource('coverage', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.current.addLayer({
        id: 'coverage-layer',
        type: 'circle',
        source: 'coverage',
        paint: {
          'circle-radius': 4,
          'circle-color': getCssVar('--c-green', '#22C55E'),
          'circle-opacity': 0.7,
          'circle-stroke-width': 1,
          'circle-stroke-color': getCssVar('--c-green', '#16A34A'),
          'circle-stroke-opacity': 0.5,
        },
      });

      // ── Active node points (last location per wallet) — accent dots ────────
      map.current.addSource('nodes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.current.addLayer({
        id: 'nodes-glow-outer',
        type: 'circle',
        source: 'nodes',
        paint: { 'circle-radius': 22, 'circle-color': accentHex, 'circle-opacity': 0.12, 'circle-blur': 1 },
      });
      map.current.addLayer({
        id: 'nodes-glow',
        type: 'circle',
        source: 'nodes',
        paint: { 'circle-radius': 13, 'circle-color': accentHex, 'circle-opacity': 0.3, 'circle-blur': 0.8 },
      });
      map.current.addLayer({
        id: 'nodes-layer',
        type: 'circle',
        source: 'nodes',
        paint: {
          'circle-radius': 7,
          'circle-color': accentHex,
          'circle-opacity': 1,
          'circle-stroke-width': 2,
          'circle-stroke-color': getCssVar('--c-text', '#FFFFFF'),
          'circle-stroke-opacity': 0.7,
        },
      });

      // Click handler for nodes
      map.current.on('click', 'nodes-layer', (e) => {
        if (e.features?.[0]) {
          const props = e.features[0].properties as NetworkNode;
          setSelectedNode(props);
          const coords = (e.features[0].geometry as any).coordinates;
          map.current?.flyTo({ center: coords, zoom: 16, duration: 1200, essential: true });
          setIsZoomedIn(true);
        }
      });
      map.current.on('mouseenter', 'nodes-layer', () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', 'nodes-layer', () => { if (map.current) map.current.getCanvas().style.cursor = ''; });

      setMapReady(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [activeTab]);

  // Update map layer colors when theme changes
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const m = map.current;
    const hex = accentHex;
    try {
      m.setPaintProperty('nodes-glow-outer', 'circle-color', hex);
      m.setPaintProperty('nodes-glow',       'circle-color', hex);
      m.setPaintProperty('nodes-layer',      'circle-color', hex);
      if (m.getLayer('background')) m.setPaintProperty('background', 'background-color', getBgColor());
      if (m.getLayer('osm-tiles')) {
        const p = getOSMPaint(settings.theme);
        Object.entries(p).forEach(([k, v]) => m.setPaintProperty('osm-tiles', k, v));
      }
    } catch (_) { /* layers may not exist yet */ }
  }, [settings.theme, mapReady]);

  // Trigger map resize when switching back to surveillance tab
  useEffect(() => {
    if (activeTab === 'surveillance' && mapReady && map.current) {
      setTimeout(() => map.current?.resize(), 50);
    }
  }, [activeTab, mapReady]);

  // Populate map sources once map is ready and data is available
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const src = map.current.getSource('nodes') as maplibregl.GeoJSONSource | undefined;
    const covSrc = map.current.getSource('coverage') as maplibregl.GeoJSONSource | undefined;
    if (!src || !covSrc) return;
    src.setData({ type: 'FeatureCollection', features: networkData.nodes.map(n => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [n.lon, n.lat] }, properties: n })) });
    covSrc.setData({ type: 'FeatureCollection', features: networkData.coverage.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: c })) });
    // Auto-fit to nodes if any
    if (networkData.nodes.length > 0) {
      const lons = networkData.nodes.map(n => n.lon);
      const lats = networkData.nodes.map(n => n.lat);
      map.current.fitBounds([[Math.min(...lons) - 0.1, Math.min(...lats) - 0.1], [Math.max(...lons) + 0.1, Math.max(...lats) + 0.1]], { padding: 60, maxZoom: 14, duration: 1000 });
    }
  }, [mapReady, networkData]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', padding: 8, gap: 8 }}>
      {/* Header */}
      <div className="vigia-panel-header" style={{
        padding: '0 16px',
        height: 38, flexShrink: 0,
        border: '1px solid var(--v-border-default)',
        background: 'var(--v-hover)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0 }}>
            {(['surveillance', 'explorer'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '0 14px',
                height: 38,
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid var(--c-accent-2)` : '2px solid transparent',
                color: activeTab === tab ? 'var(--c-accent-2)' : 'var(--c-text-3)',
                fontFamily: 'var(--v-font-mono)',
                fontSize: '0.62rem',
                fontWeight: activeTab === tab ? 700 : 400,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'color 120ms ease, border-color 120ms ease',
              }}>
                {tab === 'surveillance' ? 'Network Surveillance' : 'Global Explorer'}
              </button>
            ))}
          </div>

          {/* Stats — only shown on surveillance tab */}
          {activeTab === 'surveillance' && <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 20, fontFamily: MONO, fontSize: '0.62rem' }}>
              <div>
                <div style={{ color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Active Nodes</div>
                <div style={{ color: C.accent, fontSize: '0.82rem', fontWeight: 600 }}>{networkData.stats.activeNodes}</div>
              </div>
              <div>
                <div style={{ color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Total Reports</div>
                <div style={{ color: C.accent, fontSize: '0.82rem', fontWeight: 600 }}>{networkData.stats.totalReports}</div>
              </div>
              <div>
                <div style={{ color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Verified Coverage</div>
                <div style={{ color: 'var(--c-green)', fontSize: '0.82rem', fontWeight: 600 }}>{networkData.stats.verifiedCoverage}</div>
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
          </div>}
        </div>
      </div>

      {/* Tab content — both always mounted, toggled with display to preserve map */}
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'explorer' ? 'block' : 'none', background: C.panel, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <GlobalNetworkExplorer />
      </div>
      <div style={{ flex: 1, position: 'relative', display: activeTab === 'surveillance' ? 'block' : 'none', background: C.panel, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <style>{`@keyframes nw-spin{to{transform:rotate(360deg)}}`}</style>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        {!mapReady && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: 7,
            color: C.textSec, fontFamily: MONO, fontSize: '0.7rem',
            pointerEvents: 'none',
          }}>
            <RefreshCw size={13} style={{ color: C.accent, animation: 'nw-spin 1s linear infinite' }} />
            Loading map
          </div>
        )}
        
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
                Edge Node
              </span>
              <button onClick={() => setSelectedNode(null)} style={{ background: 'transparent', border: 'none', color: C.textMut, cursor: 'pointer', fontSize: '1rem', padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ color: C.textMut, marginBottom: 3 }}>Wallet: {selectedNode.wallet}</div>
            <div style={{ color: C.textMut, marginBottom: 6 }}>{Number(selectedNode.lat).toFixed(4)}, {Number(selectedNode.lon).toFixed(4)}</div>
            <div className="ide-divider" style={{ marginBottom: 6 }} />
            <div style={{ color: C.textSec, marginBottom: 3 }}>
              Reports: <span style={{ color: C.accent, fontWeight: 600 }}>{selectedNode.reportCount}</span>
            </div>
            <div style={{ color: C.textSec, marginBottom: 3 }}>
              Last type: <span style={{ color: C.accent, fontWeight: 600 }}>{selectedNode.lastHazardType}</span>
            </div>
            <div style={{ color: C.textSec, marginBottom: 8 }}>
              Last seen: <span style={{ color: C.accent }}>{new Date(selectedNode.lastSeen).toLocaleTimeString()}</span>
            </div>
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
            <span style={{ color: C.textSec }}>Active Node (last location)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--c-green)', flexShrink: 0 }} />
            <span style={{ color: C.textSec }}>Verified Hazard (coverage)</span>
          </div>
        </div>
      </div>
      </div> {/* close flex:1 column div */}
      <AgentChatPanel
        contextType="network"
        context={{ 
          nodeCount: networkData.stats.activeNodes,
          totalReports: networkData.stats.totalReports,
          verifiedCoverage: networkData.stats.verifiedCoverage,
        }}
      />
    </div>
  );
}
