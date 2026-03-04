'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Square, X } from 'lucide-react';
import ngeohash from 'ngeohash';
import { v4 as uuidv4 } from 'uuid';
import type { MapFile } from '@/types/shared';
import { useSettings } from './SettingsContext';
import { applyMapFilter } from '../lib/map-style';

const C = {
  bg: '#FFFFFF',
  panel: '#F5F5F5',
  hover: '#E5E7EB',
  border: '#CBD5E1',
  text: '#000000',
  textSec: '#6B7280',
  textMut: '#9CA3AF',
  accent: '#3B82F6',
  accentBg: '#EFF6FF',
};

interface NewSessionViewProps {
  onSessionCreated: (session: MapFile) => void;
  onRefreshSessions?: () => void;
}

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function NewSessionView({ onSessionCreated, onRefreshSessions }: NewSessionViewProps) {
  const { settings } = useSettings();
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
  const [coverageType, setCoverageType] = useState<'city' | 'region' | 'neighborhood' | 'custom'>('city');
  
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawStartRef = useRef<{ lat: number; lon: number } | null>(null);
  const drawModeRef = useRef(false);
  const rectangleRef = useRef<any>(null);

  // Keep drawModeRef in sync with drawMode state
  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  const searchLocation = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const apiUrl = 'https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod';
      const response = await fetch(`${apiUrl}/places/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      
      if (!response.ok) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      
      const data = await response.json();
      const results = data.ResultItems?.map((r: any) => ({
        name: r.Title,
        lat: r.Position[1],
        lon: r.Position[0],
        city: r.Address?.Locality || r.Address?.Municipality,
        region: r.Address?.Region?.Name || r.Address?.SubRegion?.Name,
        state: r.Address?.Region?.Name,
        country: r.Address?.Country?.Name,
      })) || [];
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchLocation(locationSearch), 300);
    return () => clearTimeout(timer);
  }, [locationSearch]);

  useEffect(() => {
    if (!selectedLocation || !mapRef.current || mapInstanceRef.current) return;
    
    const initMap = async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      const apiKey = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';
      const mapName = process.env.NEXT_PUBLIC_MAP_NAME || 'StandardMap';
      
      const map = new maplibregl.Map({
        container: mapRef.current,
        style: `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`,
        center: [selectedLocation.lon, selectedLocation.lat],
        zoom: 12,
      });

      mapInstanceRef.current = map;

      map.on('load', () => {
        applyMapFilter(mapRef.current, settings.mapStyle);
        // Draw bounding box handlers
        map.on('mousedown', (e) => {
          if (!drawModeRef.current) return;
          e.preventDefault();
          drawStartRef.current = { lat: e.lngLat.lat, lon: e.lngLat.lng };
        });

        map.on('mousemove', (e) => {
          if (!drawModeRef.current || !drawStartRef.current) return;
          
          const start = drawStartRef.current;
          const end = { lat: e.lngLat.lat, lon: e.lngLat.lng };
          
          const box = {
            north: Math.max(start.lat, end.lat),
            south: Math.min(start.lat, end.lat),
            east: Math.max(start.lon, end.lon),
            west: Math.min(start.lon, end.lon),
          };

          const coordinates = [
            [box.west, box.north],
            [box.east, box.north],
            [box.east, box.south],
            [box.west, box.south],
            [box.west, box.north],
          ];

          if (map.getSource('bbox')) {
            (map.getSource('bbox') as any).setData({
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
            });
          } else {
            map.addSource('bbox', {
              type: 'geojson',
              data: {
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
              },
            });
            map.addLayer({
              id: 'bbox-fill',
              type: 'fill',
              source: 'bbox',
              paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0.2 },
            });
            map.addLayer({
              id: 'bbox-outline',
              type: 'line',
              source: 'bbox',
              paint: { 'line-color': '#3B82F6', 'line-width': 2 },
            });
          }
        });

        map.on('mouseup', (e) => {
          if (!drawModeRef.current || !drawStartRef.current) return;
          
          const start = drawStartRef.current;
          const end = { lat: e.lngLat.lat, lon: e.lngLat.lng };
          
          const box = {
            north: Math.max(start.lat, end.lat),
            south: Math.min(start.lat, end.lat),
            east: Math.max(start.lon, end.lon),
            west: Math.min(start.lon, end.lon),
          };

          setBoundingBox(box);
          setDrawMode(false);
          drawStartRef.current = null;
        });
      });
    };
    
    initMap();
  }, [selectedLocation]);

  // Separate effect to handle drawMode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    if (drawMode) {
      map.dragPan.disable();
      map.doubleClickZoom.disable();
      map.scrollZoom.disable();
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      map.dragPan.enable();
      map.doubleClickZoom.enable();
      map.scrollZoom.enable();
      map.getCanvas().style.cursor = '';
    }
  }, [drawMode]);

  const selectLocation = (loc: any) => {
    setSelectedLocation(loc);
    setSearchResults([]);
    setLocationSearch(loc.name);
  };

  const startDrawing = () => {
    setDrawMode(true);
    setBoundingBox(null);
  };

  const clearBoundingBox = () => {
    setBoundingBox(null);
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      if (map.getLayer('bbox-fill')) map.removeLayer('bbox-fill');
      if (map.getLayer('bbox-outline')) map.removeLayer('bbox-outline');
      if (map.getSource('bbox')) map.removeSource('bbox');
    }
  };

  const calculateArea = (box: BoundingBox): number => {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const latDiff = toRad(box.north - box.south);
    const lonDiff = toRad(box.east - box.west);
    const avgLat = toRad((box.north + box.south) / 2);
    const height = latDiff * R;
    const width = lonDiff * R * Math.cos(avgLat);
    return Math.abs(height * width);
  };

  const determineGeohashPrecision = (areaKm2: number): number => {
    if (areaKm2 > 1000) return 5;
    if (areaKm2 > 100) return 6;
    if (areaKm2 > 10) return 7;
    if (areaKm2 > 1) return 8;
    return 9;
  };

  const generateGeohashTiles = (box: BoundingBox, precision: number): string[] => {
    const tiles = new Set<string>();
    const cellSizes: Record<number, { lat: number; lon: number }> = {
      5: { lat: 0.02197, lon: 0.02197 },
      6: { lat: 0.00549, lon: 0.00549 },
      7: { lat: 0.00137, lon: 0.00137 },
      8: { lat: 0.00034, lon: 0.00034 },
      9: { lat: 0.000086, lon: 0.000086 },
    };
    const cellSize = cellSizes[precision] || cellSizes[7];
    
    for (let lat = box.south; lat <= box.north; lat += cellSize.lat) {
      for (let lon = box.west; lon <= box.east; lon += cellSize.lon) {
        tiles.add(ngeohash.encode(lat, lon, precision));
      }
    }
    return Array.from(tiles);
  };

  const createSession = async () => {
    if (!selectedLocation || !boundingBox || isCreating) return;
    
    setIsCreating(true);
    
    try {
      const { useMapFileStore } = await import('@/stores/mapFileStore');
      const { saveMapFile } = useMapFileStore.getState();
      
      const areaKm2 = calculateArea(boundingBox);
      const geohashPrecision = determineGeohashPrecision(areaKm2);
      const geohashTiles = generateGeohashTiles(boundingBox, geohashPrecision);
      const centerLat = (boundingBox.north + boundingBox.south) / 2;
      const centerLon = (boundingBox.east + boundingBox.west) / 2;
      
      const city = selectedLocation.city || 'Unknown';
      const state = selectedLocation.state || selectedLocation.region || 'Unknown';
      const country = selectedLocation.country || 'Unknown';
      
      const continentMap: Record<string, string> = {
        'France': 'Europe', 'Germany': 'Europe', 'Italy': 'Europe', 'Spain': 'Europe', 'United Kingdom': 'Europe',
        'India': 'Asia', 'China': 'Asia', 'Japan': 'Asia', 'South Korea': 'Asia', 'Thailand': 'Asia',
        'United States': 'North America', 'Canada': 'North America', 'Mexico': 'North America',
        'Brazil': 'South America', 'Argentina': 'South America', 'Chile': 'South America',
        'Australia': 'Oceania', 'New Zealand': 'Oceania',
        'Egypt': 'Africa', 'South Africa': 'Africa', 'Nigeria': 'Africa', 'Kenya': 'Africa',
      };
      const continent = continentMap[country] || 'Unknown';
      
      const now = Date.now();
      const dateStr = new Date().toISOString().split('T')[0];
      
      // Query existing sessions for this city and date to get next sequence number
      const { getFilesByLocation } = useMapFileStore.getState();
      const existingSessions = await getFilesByLocation(country, state, city);
      const todaySessions = existingSessions.filter(s => 
        s.displayName.startsWith(`${city}-${dateStr}`)
      );
      const sequenceNum = String(todaySessions.length + 1).padStart(3, '0');
      
      const displayName = `${city}-${dateStr}-${sequenceNum}`;
      
      
      const session: MapFile = {
        version: '1.0',
        sessionId: uuidv4(),
        displayName,
        coverage: {
          type: coverageType,
          name: `${city}, ${state}, ${country}`,
          boundingBox,
          centerPoint: {
            lat: centerLat,
            lon: centerLon,
            geohash: ngeohash.encode(centerLat, centerLon, 7),
          },
          geohashPrecision,
          geohashTiles,
          areaKm2,
        },
        temporal: {
          captureStart: now,
          captureEnd: now,
          createdAt: now,
          duration: 0,
          status: 'collecting',
        },
        location: {
          continent,
          country,
          state,
          region: state,
          city,
        },
        hazards: [],
        metadata: {
          totalHazards: 0,
          hazardsByType: {},
          severityDistribution: {},
          contributors: [],
          dataSource: 'manual',
          tags: [],
        },
      };
      
      // Save to IndexedDB
      await saveMapFile(session);
      
      window.dispatchEvent(new CustomEvent('vigia-trace', {
        detail: { type: 'create', message: `Session created: ${displayName} (${areaKm2.toFixed(2)} km²)` }
      }));
      
      onRefreshSessions?.();
      onSessionCreated(session);
    } catch (err) {
      console.error('Failed to create session:', err);
      alert('Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, padding: 24, gap: 16, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: C.text, fontFamily: "var(--v-font-ui)", margin: 0 }}>
          Create New Session
        </h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
        <Search size={16} style={{ color: C.textMut }} />
        <input
          type="text"
          value={locationSearch}
          onChange={(e) => setLocationSearch(e.target.value)}
          placeholder="Search for a location..."
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.9rem', fontFamily: "var(--v-font-ui)", color: C.text }}
        />
      </div>

      {searchResults.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 4, background: C.bg }}>
          {searchResults.map((loc, i) => (
            <div
              key={i}
              onClick={() => selectLocation(loc)}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < searchResults.length - 1 ? `1px solid ${C.border}` : 'none', background: selectedLocation === loc ? C.accentBg : C.bg }}
            >
              <div style={{ fontSize: '0.9rem', fontWeight: 500, color: C.text }}>{loc.name}</div>
              <div style={{ fontSize: '0.75rem', color: C.textSec }}>{loc.city}, {loc.region}, {loc.country}</div>
            </div>
          ))}
        </div>
      )}

      {selectedLocation && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={startDrawing}
              disabled={drawMode}
              style={{ padding: '8px 16px', background: drawMode ? C.panel : C.accent, color: drawMode ? C.textMut : '#FFF', border: `1px solid ${C.border}`, borderRadius: 4, cursor: drawMode ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontFamily: "var(--v-font-ui)", display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Square size={14} />
              {drawMode ? 'Drawing... (drag on map)' : 'Draw Coverage Area'}
            </button>
            {boundingBox && (
              <button onClick={clearBoundingBox} style={{ padding: '8px 16px', background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "var(--v-font-ui)", display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={14} />
                Clear
              </button>
            )}
          </div>

          {boundingBox && (
            <div style={{ padding: 16, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text, marginBottom: 8 }}>Coverage Details</div>
              <div style={{ fontSize: '0.75rem', color: C.textSec, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>Area: {calculateArea(boundingBox).toFixed(2)} km²</div>
                <div>Precision: {determineGeohashPrecision(calculateArea(boundingBox))}</div>
                <div>Tiles: {generateGeohashTiles(boundingBox, determineGeohashPrecision(calculateArea(boundingBox))).length}</div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: '0.75rem', color: C.textSec, display: 'block', marginBottom: 4 }}>Coverage Type</label>
                <select value={coverageType} onChange={(e) => setCoverageType(e.target.value as any)} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: '0.85rem', fontFamily: "var(--v-font-ui)" }}>
                  <option value="city">City</option>
                  <option value="region">Region</option>
                  <option value="neighborhood">Neighborhood</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          )}

          <div ref={mapRef} style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 4, minHeight: 400, maxHeight: 500 }} />

          <button
            onClick={createSession}
            disabled={!boundingBox || isCreating}
            style={{ padding: '12px 24px', background: (!boundingBox || isCreating) ? C.panel : C.accent, color: (!boundingBox || isCreating) ? C.textMut : '#FFF', border: `1px solid ${C.border}`, borderRadius: 4, cursor: (!boundingBox || isCreating) ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: 600, fontFamily: "var(--v-font-ui)" }}
          >
            {isCreating ? 'Creating...' : 'Create Session'}
          </button>
        </>
      )}
    </div>
  );
}
