'use client';

import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

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
  onSessionCreated: (session: any) => void;
  onRefreshSessions?: () => void;
}

export function NewSessionView({ onSessionCreated, onRefreshSessions }: NewSessionViewProps) {
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

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

  // Initialize map when map view is shown
  useEffect(() => {
    if (viewMode !== 'map' || !mapRef.current || mapInstanceRef.current) return;
    
    const initMap = async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      const apiKey = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';
      const mapName = process.env.NEXT_PUBLIC_MAP_NAME || 'StandardMap';
      
      const map = new maplibregl.Map({
        container: 'new-session-map',
        style: `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`,
        center: [0, 20],
        zoom: 2,
      });

      mapInstanceRef.current = map;

      map.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        
        try {
          const apiUrl = 'https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod';
          const response = await fetch(`${apiUrl}/places/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: [lng, lat] }),
          });
          
          if (!response.ok) {
            setSelectedLocation({ lat, lon: lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
            return;
          }
          
          const data = await response.json();
          const place = data.ResultItems?.[0];
          
          setSelectedLocation({
            lat,
            lon: lng,
            name: place?.Title || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            city: place?.Address?.Locality || place?.Address?.Municipality,
            region: place?.Address?.Region?.Name || place?.Address?.SubRegion?.Name,
            country: place?.Address?.Country?.Name,
          });
        } catch (err) {
          setSelectedLocation({ lat, lon: lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        }
      });
    };
    
    initMap();
  }, [viewMode]);

  const createSession = async () => {
    if (!selectedLocation || isCreating) return;
    
    setIsCreating(true);
    
    try {
      const apiUrl = 'https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod';
      
      const city = typeof selectedLocation.city === 'string' 
        ? selectedLocation.city 
        : selectedLocation.city?.Name || selectedLocation.name.split(',')[0]?.trim() || 'Unknown';
      
      const region = typeof selectedLocation.region === 'string'
        ? selectedLocation.region
        : selectedLocation.region?.Name || selectedLocation.name.split(',')[1]?.trim() || 'Unknown';
      
      const country = typeof selectedLocation.country === 'string'
        ? selectedLocation.country
        : selectedLocation.country?.Name || selectedLocation.name.split(',').pop()?.trim() || 'Unknown';
      
      const continentMap: Record<string, string> = {
        'France': 'Europe', 'Germany': 'Europe', 'Italy': 'Europe', 'Spain': 'Europe', 'United Kingdom': 'Europe',
        'India': 'Asia', 'China': 'Asia', 'Japan': 'Asia', 'South Korea': 'Asia', 'Thailand': 'Asia',
        'United States': 'North America', 'Canada': 'North America', 'Mexico': 'North America',
        'Brazil': 'South America', 'Argentina': 'South America', 'Chile': 'South America',
        'Australia': 'Oceania', 'New Zealand': 'Oceania',
        'Egypt': 'Africa', 'South Africa': 'Africa', 'Nigeria': 'Africa', 'Kenya': 'Africa',
      };
      const continent = continentMap[country] || 'Unknown';
      
      const geohash = `9q8yy${Math.random().toString(36).substring(2, 4)}`;
      
      const response = await fetch(`${apiUrl}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default',
          geohash7: geohash,
          timestamp: new Date().toISOString(),
          hazardCount: Math.floor(Math.random() * 10) + 1,
          verifiedCount: Math.floor(Math.random() * 5),
          contributorId: 'user-' + Date.now(),
          status: 'draft',
          location: { continent, country, region, city },
          hazards: [{ 
            type: 'POTHOLE', 
            lat: selectedLocation.lat, 
            lon: selectedLocation.lon, 
            confidence: 0.85 
          }],
          metadata: { source: 'manual' },
        }),
      });
      
      const session = await response.json();
      
      // Emit trace event
      window.dispatchEvent(new CustomEvent('vigia-trace', {
        detail: { type: 'create', message: `Session created: ${city}, ${region} (${session.sessionId})` }
      }));
      
      onRefreshSessions?.();
      onSessionCreated(session);
    } catch (err) {
      console.error('Failed to create session:', err);
      alert('Failed to create session');
      setIsCreating(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: 'var(--c-bg)',
      padding: 24,
      gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--c-text)', fontFamily: 'Inter, sans-serif', margin: 0 }}>
          Create New Session
        </h2>
        <button
          onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
          style={{
            padding: '6px 12px',
            background: viewMode === 'map' ? 'var(--c-accent-bg)' : 'var(--c-panel)',
            border: `1px solid var(--c-border)`,
            borderRadius: 3,
            color: 'var(--c-text)',
            fontSize: '0.8rem',
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
          }}
        >
          {viewMode === 'map' ? 'List View' : 'Map View'}
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        padding: '10px 14px',
        background: 'var(--c-panel)',
        border: `1px solid var(--c-border)`,
        borderRadius: 4,
      }}>
        <Search size={16} style={{ color: 'var(--c-text-3)' }} />
        <input
          type="text"
          value={locationSearch}
          onChange={(e) => setLocationSearch(e.target.value)}
          placeholder="Search for a location..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--c-text)',
            fontSize: '0.9rem',
            fontFamily: 'Inter, sans-serif',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {viewMode === 'list' ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isSearching && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--c-text-3)', fontSize: '0.85rem' }}>
                Searching...
              </div>
            )}
            {!isSearching && searchResults.length === 0 && locationSearch && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--c-text-3)', fontSize: '0.85rem' }}>
                No results found
              </div>
            )}
            {!isSearching && searchResults.length === 0 && !locationSearch && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--c-text-3)', fontSize: '0.85rem' }}>
                Type to search for any location worldwide
              </div>
            )}
            {searchResults.map((loc, i) => (
              <button
                key={i}
                onClick={() => setSelectedLocation(loc)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: selectedLocation?.name === loc.name ? 'var(--c-accent-bg)' : 'transparent',
                  border: `1px solid ${selectedLocation?.name === loc.name ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  borderRadius: 4,
                  color: 'var(--c-text)',
                  fontSize: '0.85rem',
                  fontFamily: 'Inter, sans-serif',
                  textAlign: 'left',
                  cursor: 'pointer',
                  marginBottom: 8,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (selectedLocation?.name !== loc.name) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedLocation?.name !== loc.name) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                {loc.name}
              </button>
            ))}
          </div>
        ) : (
          <div 
            id="new-session-map" 
            ref={mapRef}
            style={{ 
              flex: 1,
              background: 'var(--c-panel)',
              borderRadius: 4,
              border: `1px solid var(--c-border)`,
            }}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        paddingTop: 16,
        borderTop: `1px solid var(--c-border)`,
      }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--c-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
          {selectedLocation && `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lon.toFixed(4)}`}
        </div>
        <button
          onClick={createSession}
          disabled={!selectedLocation || isCreating}
          style={{
            padding: '8px 20px',
            background: selectedLocation && !isCreating ? 'var(--c-accent)' : 'var(--c-text-3)',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontSize: '0.85rem',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            cursor: selectedLocation && !isCreating ? 'pointer' : 'not-allowed',
            opacity: selectedLocation && !isCreating ? 1 : 0.5,
          }}
        >
          {isCreating ? 'Creating...' : 'Create Session'}
        </button>
      </div>
    </div>
  );
}
