'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Globe, Radio, Database,
  Settings, Search, AlertTriangle,
  Navigation, ChevronRight, ChevronDown,
  Folder, FolderOpen, FileText, Video,
  Clock, MapPin, Activity, Wrench, Map,
} from 'lucide-react';
import { VFSManager } from '../lib/vfs-manager';
import { useMapFileStore } from '../../stores/mapFileStore';
import { useSettings } from './SettingsContext';
import { applyMapFilter } from '../lib/map-style';

interface SidebarProps {
  onSentinelEyeClick:  () => void;
  isSentinelEyeActive: boolean;
  onSettingsOpen:      () => void;
  onSessionClick?:     (session: any) => void;
  onSessionsDeleted?:  (sessionIds: string[]) => void;
  onNewSessionClick?:  () => void;
  onRefreshSessions?:  () => void;
  onActivityChange?:   (activity: 'explorer' | 'detection' | 'network' | 'maintenance') => void;
}

// ─────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────

const C = {
  bg:      'var(--c-sidebar)',
  actBar:  'var(--c-bg)',
  border:  'var(--c-border)',
  text:    'var(--c-text)',
  textSec: 'var(--c-text-2)',
  textMut: 'var(--c-text-3)',
  accent:  'var(--c-accent-2)',
  accentBg:'var(--c-accent-glow)',
  hover:   'var(--c-hover)',
  green:   'var(--c-green)',
  red:     'var(--c-red)',
  yellow:  'var(--c-yellow)',
  panel:   'var(--c-panel)',
};

// ─────────────────────────────────────────────
// Activity bar icon
// ─────────────────────────────────────────────

function ActivityBtn({ icon, active, label, onClick }: {
  icon: React.ReactNode;
  active?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      style={{
        width: '100%',
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: active ? 'var(--c-accent-glow)' : 'transparent',
        color: active ? 'var(--c-accent-2)' : C.textMut,
        borderLeft: active ? '2px solid var(--c-accent-2)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'color var(--dur-fast), background var(--dur-fast), border-color var(--dur-fast)',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = C.textSec;
          (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = C.textMut;
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }
      }}
    >
      {icon}
    </button>
  );
}

// ─────────────────────────────────────────────
// Tree node
// ─────────────────────────────────────────────

function TreeNode({
  label, icon, depth = 0, isActive = false,
  onClick, onContextMenu, children, badge, badgeColor,
  draggable, onDragStart, onDragOver, onDragLeave, onDrop, sessionData,
}: {
  label: string;
  icon: 'folder' | 'file' | 'video' | 'session';
  depth?: number;
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  sessionData?: any;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = Boolean(children);

  const handleClick = () => {
    if (hasChildren) setExpanded(v => !v);
    onClick?.();
  };

  const iconEl = () => {
    if (icon === 'video')   return <Video    size={15} style={{ color: C.accent,   flexShrink: 0 }} />;
    if (icon === 'file')    return <FileText  size={15} style={{ color: C.textMut,  flexShrink: 0 }} />;
    if (icon === 'session') return <Clock     size={15} style={{ color: C.textMut,  flexShrink: 0 }} />;
    if (expanded)           return <FolderOpen size={15} style={{ color: C.textSec, flexShrink: 0 }} />;
    return                         <Folder    size={15} style={{ color: C.textMut,  flexShrink: 0 }} />;
  };

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={onContextMenu}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={(e) => {
          if (onDragOver) {
            e.preventDefault();
            setDragOver(true);
            onDragOver(e);
          }
        }}
        onDragLeave={(e) => {
          setDragOver(false);
          onDragLeave?.(e);
        }}
        onDrop={(e) => {
          setDragOver(false);
          onDrop?.(e);
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          paddingLeft: 10 + depth * 14,
          paddingRight: 10,
          border: 'none',
          background: dragOver ? 'var(--c-accent-glow-strong)' : isActive ? C.accentBg : 'transparent',
          cursor: draggable ? 'grab' : 'pointer',
          position: 'relative',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => {
          if (!isActive && !dragOver) (e.currentTarget as HTMLElement).style.background = C.hover;
        }}
        onMouseLeave={(e) => {
          if (!isActive && !dragOver) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {isActive && (
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: C.accent }} />
        )}

        {/* Chevron */}
        <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {hasChildren
            ? (expanded
              ? <ChevronDown  size={12}  style={{ color: C.textMut }} />
              : <ChevronRight size={12}  style={{ color: C.textMut }} />)
            : null}
        </span>

        {iconEl()}

        <span style={{
          flex: 1,
          fontSize: '0.73rem',
          color: isActive ? C.text : icon === 'folder' ? C.textSec : C.textMut,
          fontWeight: isActive ? 500 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          letterSpacing: '-0.005em',
        }}>
          {label}
        </span>

        {badge && (
          <span style={{
            fontSize: '0.58rem',
            padding: '1px 5px',
            borderRadius: 3,
            background: badgeColor ? `${badgeColor}1A` : 'rgba(255,255,255,0.06)',
            color: badgeColor ?? C.textMut,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 600,
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}>
            {badge}
          </span>
        )}

        {icon === 'video' && (
          <span style={{
            fontSize: '0.65rem', padding: '2px 6px', borderRadius: 3,
            background: 'var(--c-red)', color: '#fff', fontWeight: 700,
            letterSpacing: '0.06em', fontFamily: "'IBM Plex Sans', sans-serif",
            flexShrink: 0,
          }}>
            LIVE
          </span>
        )}
      </button>
      {hasChildren && expanded && <div>{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Quick-stat chip
// ─────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      padding: '8px 0',
      flex: 1,
    }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '-0.02em' }}>
        {value}
      </span>
      <span style={{ fontSize: '0.58rem', color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────

const MIN_WIDTH = 0;  // Allow full collapse
const MAX_WIDTH = 340;
const DEFAULT_WIDTH = 210;

export function Sidebar({ onSentinelEyeClick, isSentinelEyeActive, onSettingsOpen, onSessionClick, onSessionsDeleted, onNewSessionClick, onRefreshSessions, onActivityChange }: SidebarProps) {
  const { computeDiff } = useMapFileStore();
  const { settings } = useSettings();
  const [width, setWidth]         = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [vfsManager, setVfsManager] = useState<VFSManager | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lon: number; name: string; city?: string; region?: string; country?: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeActivity, setActiveActivity] = useState<'explorer' | 'detection' | 'network' | 'maintenance'>('explorer');
  const [showMap, setShowMap] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: any } | null>(null);
  const [draggedSession, setDraggedSession] = useState<any>(null);
  const [dropTarget, setDropTarget] = useState<any>(null);
  const mapRef = useRef<any>(null);
  const startX   = useRef(0);
  const startW   = useRef(DEFAULT_WIDTH);
  const handleRef = useRef<HTMLDivElement>(null);

  // Initialize VFS Manager
  useEffect(() => {
    const init = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod';
        const manager = new VFSManager(apiUrl);
        await manager.init();
        setVfsManager(manager);
        // Expose to window for save functionality
        (window as any).__vfsManager = manager;
        loadSessions(manager);
      } catch (error) {
        console.warn('VFS Manager init failed (CORS or network issue), using IndexedDB only:', error);
        // Still load from IndexedDB even if VFS fails
        loadSessions(null);
      }
    };
    init();
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const loadSessions = async (manager: VFSManager | null) => {
    setSessionsLoading(true);
    try {
      let savedSessions: any[] = [];
      
      // Load from VFSManager (permanent/saved) if available
      if (manager) {
        try {
          savedSessions = await manager.listSessions();
        } catch (error) {
          console.warn('Failed to load from VFS (CORS or network issue), using IndexedDB only');
        }
      }
      
      // Load from mapFileStore (temporary/unsaved)
      const { useMapFileStore } = await import('@/stores/mapFileStore');
      await useMapFileStore.getState().loadFiles();
      const tempFiles = Array.from(useMapFileStore.getState().files.values());
      
      // Convert temp files to session format with * indicator
      const tempSessions = tempFiles.map((file: any) => ({
        sessionId: file.sessionId,
        timestamp: file.temporal?.createdAt || Date.now(),
        location: file.location,
        hazardCount: file.metadata?.totalHazards || 0,
        verifiedCount: file.hazards?.filter((h: any) => h.status === 'verified').length || 0,
        status: file.temporal?.status || 'draft',
        geohash7: file.coverage?.centerPoint?.geohash || '',
        isTemporary: true, // Flag to show *
        displayName: file.displayName,
      }));
      
      // Merge: temp sessions first, then saved sessions (avoid duplicates)
      const savedIds = new Set(savedSessions.map((s: any) => s.sessionId));
      const uniqueTempSessions = tempSessions.filter((t: any) => !savedIds.has(t.sessionId));
      
      setSessions([...uniqueTempSessions, ...savedSessions]);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Expose refresh function to parent
  useEffect(() => {
    if (vfsManager && onRefreshSessions) {
      (window as any).__refreshSessions = () => loadSessions(vfsManager);
    }
  }, [vfsManager, onRefreshSessions]);

  const searchLocation = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod';
      const response = await fetch(`${apiUrl}/places/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search API error:', response.status, errorText);
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      
      const data = await response.json();
      console.log('Search results:', data);
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
    if (!showMap || !mapRef.current) return;
    
    const initMap = async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      const apiKey = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';
      const mapName = process.env.NEXT_PUBLIC_MAP_NAME || 'StandardMap';
      
      const map = new maplibregl.Map({
        container: 'location-picker-map',
        style: `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`,
        center: [0, 20],
        zoom: 2,
      });

      map.on('load', () => {
        applyMapFilter(mapRef.current, settings.mapStyle);
      });

      map.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        
        // Reverse geocode via backend proxy
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod';
          const response = await fetch(`${apiUrl}/places/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: [lng, lat] }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Reverse geocode error:', response.status, errorText);
            setSelectedLocation({
              lat,
              lon: lng,
              name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            });
            return;
          }
          
          const data = await response.json();
          console.log('Reverse geocode result:', data);
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
          console.error('Reverse geocode failed:', err);
          setSelectedLocation({
            lat,
            lon: lng,
            name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          });
        }
      });
    };
    
    initMap();
  }, [showMap]);

  const createSession = async () => {
    if (!vfsManager || !selectedLocation) return;
    
    // Notify parent to open loading tab
    onSessionClick?.({ 
      sessionId: 'creating', 
      status: 'creating',
      location: { name: selectedLocation.name }
    });
    
    setShowLocationModal(false);
    
    try {
      const geohash = `9q8yy${Math.random().toString(36).substring(2, 4)}`;
      
      // Extract string values from location (Places API returns nested objects)
      const city = typeof selectedLocation.city === 'string' 
        ? selectedLocation.city 
        : (selectedLocation.city as any)?.Name || selectedLocation.name.split(',')[0]?.trim() || 'Unknown';
      
      const region = typeof selectedLocation.region === 'string'
        ? selectedLocation.region
        : (selectedLocation.region as any)?.Name || selectedLocation.name.split(',')[1]?.trim() || 'Unknown';
      
      const country = typeof selectedLocation.country === 'string'
        ? selectedLocation.country
        : (selectedLocation.country as any)?.Name || selectedLocation.name.split(',').pop()?.trim() || 'Unknown';
      
      // Determine continent from country
      const continentMap: Record<string, string> = {
        'France': 'Europe', 'Germany': 'Europe', 'Italy': 'Europe', 'Spain': 'Europe', 'United Kingdom': 'Europe',
        'India': 'Asia', 'China': 'Asia', 'Japan': 'Asia', 'South Korea': 'Asia', 'Thailand': 'Asia',
        'United States': 'North America', 'Canada': 'North America', 'Mexico': 'North America',
        'Brazil': 'South America', 'Argentina': 'South America', 'Chile': 'South America',
        'Australia': 'Oceania', 'New Zealand': 'Oceania',
        'Egypt': 'Africa', 'South Africa': 'Africa', 'Nigeria': 'Africa', 'Kenya': 'Africa',
      };
      const continent = continentMap[country] || 'Unknown';
      
      const session = await vfsManager.createSession({
        userId: 'default',
        geohash7: geohash,
        timestamp: new Date().toISOString(),
        hazardCount: Math.floor(Math.random() * 10) + 1,
        verifiedCount: Math.floor(Math.random() * 5),
        contributorId: 'user-' + Date.now(),
        status: 'draft',
        location: {
          continent: continent,
          country: country,
          region: region,
          city: city,
        },
        hazards: [{ 
          type: 'POTHOLE', 
          lat: selectedLocation.lat, 
          lon: selectedLocation.lon, 
          confidence: 0.85 
        }],
        metadata: { source: 'manual' },
      });
      
      await loadSessions(vfsManager);
      
      // Notify parent with created session
      onSessionClick?.(session);
      
      setLocationSearch('');
      setSelectedLocation(null);
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to create session:', err);
      alert('Failed to create session');
    }
  };

  // Group sessions by geographic hierarchy
  const sessionsByGeo = sessions.reduce((acc, s) => {
    const continent = s.location?.continent || 'Unknown';
    const country = s.location?.country || 'Unknown';
    const region = s.location?.region || 'Unknown';
    const city = s.location?.city || 'Unknown';
    
    if (!acc[continent]) acc[continent] = {};
    if (!acc[continent][country]) acc[continent][country] = {};
    if (!acc[continent][country][region]) acc[continent][country][region] = {};
    if (!acc[continent][country][region][city]) acc[continent][country][region][city] = [];
    
    acc[continent][country][region][city].push(s);
    return acc;
  }, {} as Record<string, Record<string, Record<string, Record<string, any[]>>>>);

  const formatSessionLabel = (session: any) => {
    // Use displayName if available (for both temp and saved files)
    if (session.displayName) {
      return session.isTemporary ? `* ${session.displayName}` : session.displayName;
    }
    
    // Check metadata for displayName (saved sessions store it here)
    if (session.metadata?.displayName) {
      return session.isTemporary ? `* ${session.metadata.displayName}` : session.metadata.displayName;
    }
    
    // Fallback to timestamp formatting
    const date = new Date(session.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = session.timestamp.split('T')[1]?.substring(0, 5) || '00:00';
    const label = `${year}-${month}-${day} ${time}`;
    return session.isTemporary ? `* ${label}` : label;
  };

  const handleSessionRightClick = (e: React.MouseEvent, session: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, session });
  };

  const handleDeleteSession = async () => {
    if (!vfsManager || !contextMenu) return;
    
    const session = contextMenu.session;
    const isFolder = !session.sessionId; // Folders don't have sessionId
    
    if (isFolder) {
      // Delete all sessions in folder
      const sessionsToDelete = session.sessions || [];
      
      const confirmed = window.confirm(
        `Are you sure you want to delete "${session.label}" and all ${sessionsToDelete.length} session(s) inside it?`
      );
      
      if (!confirmed) {
        setContextMenu(null);
        return;
      }
      
      try {
        const deletedIds: string[] = [];
        const { useMapFileStore } = await import('@/stores/mapFileStore');
        
        for (const s of sessionsToDelete) {
          console.log('Deleting session:', s.sessionId);
          
          // Delete from VFSManager if not temporary
          if (!s.isTemporary) {
            await vfsManager.deleteSession(s.sessionId);
          }
          
          // Delete from mapFileStore
          await useMapFileStore.getState().deleteMapFile(s.sessionId);
          
          deletedIds.push(s.sessionId);
        }
        await loadSessions(vfsManager);
        onSessionsDeleted?.(deletedIds);
        setContextMenu(null);
        
        // Emit trace event
        window.dispatchEvent(new CustomEvent('vigia-trace', {
          detail: { type: 'delete', message: `Folder deleted: ${session.label} (${deletedIds.length} sessions)` }
        }));
        
        alert(`Successfully deleted ${deletedIds.length} session(s)`);
      } catch (err) {
        console.error('Failed to delete folder:', err);
        alert(`Failed to delete folder: ${(err as Error).message}`);
      }
    } else {
      // Delete single session
      const confirmed = window.confirm(
        `Are you sure you want to delete session "${session.displayName || session.sessionId}"?`
      );
      
      if (!confirmed) {
        setContextMenu(null);
        return;
      }
      
      try {
        console.log('Deleting session:', session.sessionId);
        
        // Delete from VFSManager (permanent storage) if not temporary
        if (!session.isTemporary) {
          await vfsManager.deleteSession(session.sessionId);
        }
        
        // Delete from mapFileStore (temporary storage)
        const { useMapFileStore } = await import('@/stores/mapFileStore');
        await useMapFileStore.getState().deleteMapFile(session.sessionId);
        
        await loadSessions(vfsManager);
        onSessionsDeleted?.([session.sessionId]);
        setContextMenu(null);
        
        // Emit trace event
        window.dispatchEvent(new CustomEvent('vigia-trace', {
          detail: { type: 'delete', message: `Session deleted: ${session.displayName || session.sessionId}` }
        }));
        
        alert('Session deleted successfully');
      } catch (err) {
        console.error('Failed to delete session:', err);
        alert(`Failed to delete session: ${(err as Error).message}`);
      }
    }
  };

  const handleShowMetadata = () => {
    if (!contextMenu) return;
    const metadata = {
      sessionId: contextMenu.session.sessionId,
      geohash: contextMenu.session.geohash7,
      timestamp: contextMenu.session.timestamp,
      hazardCount: contextMenu.session.hazardCount,
      verifiedCount: contextMenu.session.verifiedCount,
      status: contextMenu.session.status,
      fileHash: contextMenu.session.fileHash,
      parentHash: contextMenu.session.parentHash,
    };
    alert(JSON.stringify(metadata, null, 2));
    setContextMenu(null);
  };

  // ── Drag resize ───────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startW.current = width;
    setIsDragging(true);
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta)));
    };
    const onUp = () => {
      setIsDragging(false);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [isDragging]);

  const isCollapsed = width <= MIN_WIDTH + 10;

  return (
    <div style={{ display: 'flex', flexShrink: 0, height: '100%', position: 'relative' }}>

      {/* ── Activity Bar ────────────────────── */}
      <div
        className="vigia-activity-bar"
        style={{
        width: 44,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: C.actBar,
        borderRight: 'none',
        boxShadow: 'none',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ActivityBtn icon={<Globe size={20} />}    active={activeActivity === 'explorer'} label="Geo Explorer" onClick={() => { setActiveActivity('explorer'); onActivityChange?.('explorer'); }} />
          <ActivityBtn icon={<Activity size={20} />} active={activeActivity === 'detection'} label="Detection" onClick={() => { setActiveActivity('detection'); onActivityChange?.('detection'); }} />
          <ActivityBtn icon={<Radio size={20} />}    active={activeActivity === 'network'} label="Network" onClick={() => { setActiveActivity('network'); onActivityChange?.('network'); }} />
          <ActivityBtn icon={<Wrench size={20} />}   active={activeActivity === 'maintenance'} label="Maintenance" onClick={() => { setActiveActivity('maintenance'); onActivityChange?.('maintenance'); }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ActivityBtn icon={<Settings size={20} />}  label="Settings" onClick={onSettingsOpen} />
        </div>
      </div>

      {/* ── Explorer Panel - only show for explorer activity ──────────────────── */}
      {activeActivity === 'explorer' && (
      <div style={{
        width,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: C.bg,
        transition: isDragging ? 'none' : undefined,
      }}>
        {/* Panel header - only show for explorer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 36,
          flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
          background: 'rgba(255,255,255,0.01)',
        }}>
          <span style={{
            fontSize: '0.60rem',
            color: C.textMut,
            fontWeight: 600,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}>
            {isCollapsed ? '≡' : 'EXPLORER'}
          </span>
          {!isCollapsed && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button 
                onClick={() => onNewSessionClick?.()}
                disabled={!vfsManager}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: vfsManager ? C.textMut : C.textMut + '50', 
                  cursor: vfsManager ? 'pointer' : 'not-allowed', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  width: 16,
                  height: 16,
                }}
                onMouseEnter={(e) => vfsManager && ((e.currentTarget as HTMLElement).style.color = C.textSec)}
                onMouseLeave={(e) => vfsManager && ((e.currentTarget as HTMLElement).style.color = C.textMut)}
                title="New Session"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="6" y1="1" x2="6" y2="11" />
                  <line x1="1" y1="6" x2="11" y2="6" />
                </svg>
              </button>
              <button style={{ 
                background: 'none', 
                border: 'none', 
                color: C.textMut, 
                cursor: 'pointer', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                width: 16,
                height: 16,
              }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = C.textSec}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = C.textMut}
              >
                <Search size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Search filter */}
        {!isCollapsed && (
          <div style={{ padding: '6px 8px', borderBottom: `1px solid rgba(255,255,255,0.05)`, flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 24, padding: '0 8px', borderRadius: 3,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <Search size={10} style={{ color: C.textMut, flexShrink: 0 }} />
              <input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter..."
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '0.7rem', color: C.textSec,
                  fontFamily: "'IBM Plex Sans', sans-serif", flex: 1, width: 0,
                }}
              />
            </div>
          </div>
        )}

        {/* ── Stats strip ───────────────────── */}
        {!isCollapsed && (
          <div
            className="vigia-stats-strip"
            style={{
            display: 'flex',
            borderBottom: 'none',
            flexShrink: 0,
          }}>
            <StatChip label="Hazards" value="7"  color={C.red}    />
            <div style={{ width: 1, background: C.border, margin: '6px 0' }} />
            <StatChip label="Verified" value="6" color={C.accent} />
            <div style={{ width: 1, background: C.border, margin: '6px 0' }} />
            <StatChip label="Nodes"  value="48"  color={C.green}  />
          </div>
        )}

        {/* Tree */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4, paddingBottom: 4 }}>
          <style>{`@keyframes sb-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}`}</style>
          <TreeNode label="Sessions" icon="folder">
              {sessionsLoading ? (
                <>
                  {[72, 88, 58, 80, 64].map((w, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      height: 30, paddingLeft: 24,
                      opacity: 1 - i * 0.14,
                    }}>
                      <div style={{
                        width: 13, height: 13, borderRadius: 2, flexShrink: 0,
                        background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%)',
                        backgroundSize: '200% 100%',
                        animation: `sb-shimmer 1.6s ease-in-out ${i * 0.1}s infinite`,
                      }} />
                      <div style={{
                        height: 9, borderRadius: 3, width: `${w}%`, maxWidth: 130,
                        background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%)',
                        backgroundSize: '200% 100%',
                        animation: `sb-shimmer 1.6s ease-in-out ${i * 0.1}s infinite`,
                      }} />
                    </div>
                  ))}
                </>
              ) : Object.keys(sessionsByGeo).length === 0 ? (
                <div style={{
                  padding: '10px 16px',
                  color: C.textMut,
                  fontSize: '0.71rem',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontStyle: 'italic',
                }}>
                  No sessions yet
                </div>
              ) : Object.keys(sessionsByGeo).sort().map(continent => (
                <TreeNode 
                  key={`continent-${continent}`} 
                  label={continent} 
                  icon="folder" 
                  depth={1}
                  onContextMenu={(e) => handleSessionRightClick(e, { 
                    label: continent, 
                    folderPath: continent,
                    sessions: Object.values(sessionsByGeo[continent] as any).flatMap((c: any) => 
                      Object.values(c).flatMap((r: any) => Object.values(r).flat())
                    )
                  })}
                >
                  {Object.keys(sessionsByGeo[continent]).sort().map(country => (
                    <TreeNode 
                      key={`country-${continent}-${country}`} 
                      label={country} 
                      icon="folder" 
                      depth={2}
                      onContextMenu={(e) => handleSessionRightClick(e, { 
                        label: country, 
                        folderPath: `${continent}/${country}`,
                        sessions: Object.values(sessionsByGeo[continent][country] as any).flatMap((r: any) => Object.values(r).flat())
                      })}
                  >
                    {Object.keys(sessionsByGeo[continent][country]).sort().map(region => (
                      <TreeNode 
                        key={`region-${continent}-${country}-${region}`} 
                        label={region} 
                        icon="folder" 
                        depth={3}
                        onContextMenu={(e) => handleSessionRightClick(e, { 
                          label: region, 
                          folderPath: `${continent}/${country}/${region}`,
                          sessions: Object.values(sessionsByGeo[continent][country][region]).flat()
                        })}
                      >
                        {Object.keys(sessionsByGeo[continent][country][region]).sort().map(city => (
                          <TreeNode 
                            key={`city-${continent}-${country}-${region}-${city}`} 
                            label={city} 
                            icon="folder" 
                            depth={4}
                            onContextMenu={(e) => handleSessionRightClick(e, { 
                              label: city, 
                              folderPath: `${continent}/${country}/${region}/${city}`,
                              sessions: sessionsByGeo[continent][country][region][city]
                            })}
                          >
                            {sessionsByGeo[continent][country][region][city]
                              .sort((a: any, b: any) => {
                                const aTime = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
                                const bTime = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
                                return bTime - aTime;
                              })
                              .map((session: any) => {
                                const label = formatSessionLabel(session);
                                const badgeColor = session.hazardCount > 5 ? C.red : session.hazardCount > 2 ? C.yellow : C.green;
                                return (
                                  <TreeNode
                                    key={session.sessionId}
                                    label={label}
                                    icon="session"
                                    depth={5}
                                    badge={`${session.hazardCount} hz`}
                                    badgeColor={badgeColor}
                                    onClick={() => onSessionClick?.(session)}
                                    onContextMenu={(e) => handleSessionRightClick(e, session)}
                                    draggable={true}
                                    sessionData={session}
                                    onDragStart={(e) => {
                                      e.dataTransfer.effectAllowed = 'copy';
                                      setDraggedSession(session);
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'copy';
                                      setDropTarget(session);
                                    }}
                                    onDragLeave={() => {
                                      setDropTarget(null);
                                    }}
                                    onDrop={async (e) => {
                                      e.preventDefault();
                                      setDropTarget(null);
                                      
                                      if (draggedSession && draggedSession.sessionId !== session.sessionId) {
                                        // Create diff between two sessions
                                        try {
                                          // Load full sessions from stores
                                          const { useMapFileStore } = await import('@/stores/mapFileStore');
                                          await useMapFileStore.getState().loadFiles();
                                          
                                          let sessionA = useMapFileStore.getState().files.get(draggedSession.sessionId);
                                          let sessionB = useMapFileStore.getState().files.get(session.sessionId);
                                          
                                          // If not in temp storage, reconstruct from VFS data
                                          if (!sessionA) {
                                            sessionA = {
                                              ...draggedSession,
                                              coverage: draggedSession.metadata?.coverage,
                                              temporal: draggedSession.metadata?.temporal,
                                              displayName: draggedSession.metadata?.displayName || draggedSession.displayName,
                                            } as any;
                                          }
                                          
                                          if (!sessionB) {
                                            sessionB = {
                                              ...session,
                                              coverage: session.metadata?.coverage,
                                              temporal: session.metadata?.temporal,
                                              displayName: session.metadata?.displayName || session.displayName,
                                            } as any;
                                          }
                                          
                                          // Compute diff
                                          const { computeMapDiff } = await import('../../lib/diffCompute');
                                          const diffMap = computeMapDiff(sessionA as any, sessionB as any);
                                          
                                          // Dispatch event to open diff view
                                          window.dispatchEvent(new CustomEvent('vigia-diff-created', {
                                            detail: { diffMap }
                                          }));
                                          
                                          // Emit trace event
                                          window.dispatchEvent(new CustomEvent('vigia-trace', {
                                            detail: { 
                                              type: 'diff', 
                                              message: `Diff created: ${diffMap.displayName}` 
                                            }
                                          }));
                                        } catch (err) {
                                          console.error('Failed to create diff:', err);
                                          alert('Failed to create diff');
                                        }
                                        
                                        setDraggedSession(null);
                                      }
                                    }}
                                  />
                                );
                              })}
                          </TreeNode>
                        ))}
                      </TreeNode>
                    ))}
                  </TreeNode>
                ))}
              </TreeNode>
            ))}
          </TreeNode>

          {/* Divider */}
          {!isCollapsed && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 8px' }} />
              <div style={{ padding: '2px 10px 4px', fontSize: '0.6rem', color: C.textMut, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600 }}>
                Pinned
              </div>

              {[
                { icon: <Navigation size={10} />, label: 'Route Library',  badge: undefined },
                { icon: <AlertTriangle size={10} style={{ color: C.red }} />, label: 'Active Hazards', badge: '7' },
                { icon: <Activity size={10} />,   label: 'Swarm Monitor',  badge: '48' },
                { icon: <MapPin size={10} />,      label: 'Rourkela Zone',  badge: undefined },
              ].map(({ icon, label, badge }) => (
                <button
                  key={label}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px 5px 20px', border: 'none',
                    background: 'transparent', cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span style={{ color: C.textMut, flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontSize: '0.72rem', color: C.textMut, flex: 1, textAlign: 'left', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.005em' }}>
                    {label}
                  </span>
                  {badge && (
                    <span style={{
                      fontSize: '0.58rem', padding: '1px 5px', borderRadius: 3,
                      background: 'rgba(255,255,255,0.06)', color: C.textMut,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div
            className="vigia-sidebar-footer"
            style={{
            padding: '7px 10px',
            borderTop: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} className="pulse" />
            <span style={{ fontSize: '0.64rem', color: C.textMut, fontFamily: "'IBM Plex Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Rourkela · India · Online
            </span>
          </div>
        )}
      </div>
      )}

      {/* ── Drag resize handle ───────────────── */}
      <div
        ref={handleRef}
        className={`drag-handle-x ${isDragging ? 'dragging' : ''}`}
        onMouseDown={onMouseDown}
        onDoubleClick={() => {
          // Double-click to collapse/expand
          setWidth(width < 50 ? DEFAULT_WIDTH : 0);
        }}
        style={{
          width: 5,
          background: 'transparent',
          cursor: 'col-resize',
          flexShrink: 0,
          position: 'relative',
          display: width === 0 ? 'none' : 'block',
        }}
      />

      {/* Show expand button when collapsed */}
      {width === 0 && (
        <div
          onClick={() => setWidth(DEFAULT_WIDTH)}
          style={{
            width: 24,
            height: 48,
            position: 'absolute',
            left: 48,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--c-elevated)',
            border: `1px solid ${C.border}`,
            borderRadius: '0 4px 4px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-accent-glow)'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-elevated)'}
        >
          <ChevronRight size={16} style={{ color: C.text }} />
        </div>
      )}

      {/* ── Location Selection Modal ───────────────── */}
      {showLocationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowLocationModal(false)}>
          <div style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            width: showMap ? 700 : 500,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                Select Location
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setShowMap(!showMap)}
                  style={{
                    background: showMap ? C.accentBg : 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    color: C.text,
                    fontSize: '0.7rem',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}
                >
                  {showMap ? 'List' : 'Map'}
                </button>
                <button onClick={() => {
                  setShowLocationModal(false);
                  setShowMap(false);
                  setLocationSearch('');
                  setSelectedLocation(null);
                  setSearchResults([]);
                }} style={{
                  background: 'none',
                  border: 'none',
                  color: C.textMut,
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: 0,
                  width: 20,
                  height: 20,
                }}>×</button>
              </div>
            </div>

            {/* Search */}
            <div style={{ padding: 16 }}>
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search for a location..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  color: C.text,
                  fontSize: '0.8rem',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  outline: 'none',
                }}
              />
            </div>

            {/* Content: List or Map */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', minHeight: 300 }}>
              {!showMap ? (
                <>
                  {isSearching && (
                    <div style={{ textAlign: 'center', padding: 20, color: C.textMut, fontSize: '0.8rem' }}>
                      Searching...
                    </div>
                  )}
                  {!isSearching && searchResults.length === 0 && locationSearch && (
                    <div style={{ textAlign: 'center', padding: 20, color: C.textMut, fontSize: '0.8rem' }}>
                      No results found
                    </div>
                  )}
                  {!isSearching && searchResults.length === 0 && !locationSearch && (
                    <div style={{ textAlign: 'center', padding: 20, color: C.textMut, fontSize: '0.8rem' }}>
                      Type to search for any location worldwide
                    </div>
                  )}
                  {searchResults.map((loc, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedLocation(loc)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: selectedLocation?.name === loc.name ? C.accentBg : 'transparent',
                        border: `1px solid ${selectedLocation?.name === loc.name ? C.accent : C.border}`,
                        borderRadius: 3,
                        color: C.text,
                        fontSize: '0.8rem',
                        fontFamily: "'IBM Plex Sans', sans-serif",
                        textAlign: 'left',
                        cursor: 'pointer',
                        marginBottom: 8,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedLocation?.name !== loc.name) {
                          (e.currentTarget as HTMLElement).style.background = C.hover;
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
                </>
              ) : (
                <div 
                  id="location-picker-map" 
                  ref={mapRef}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    minHeight: 300,
                    background: C.panel,
                    borderRadius: 3,
                    border: `1px solid ${C.border}`,
                  }}
                />
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: 16,
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ fontSize: '0.7rem', color: C.textMut, fontFamily: "'IBM Plex Mono', monospace" }}>
                {selectedLocation && `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lon.toFixed(4)}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setShowLocationModal(false);
                    setShowMap(false);
                    setLocationSearch('');
                    setSelectedLocation(null);
                    setSearchResults([]);
                  }}
                  style={{
                    padding: '6px 16px',
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    color: C.text,
                    fontSize: '0.75rem',
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={createSession}
                  disabled={!selectedLocation}
                  style={{
                    padding: '6px 16px',
                    background: selectedLocation ? C.accent : C.textMut,
                    border: 'none',
                    borderRadius: 3,
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    cursor: selectedLocation ? 'pointer' : 'not-allowed',
                    opacity: selectedLocation ? 1 : 0.5,
                  }}
                >
                  Create Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--c-elevated)',
            border: '1px solid var(--c-border-md)',
            borderRadius: 6,
            boxShadow: '0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)',
            zIndex: 10000,
            minWidth: 190,
            padding: '4px 0',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.session.sessionId && (
            <>
              <button
                onClick={() => {
                  onSessionClick?.(contextMenu.session);
                  setContextMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: C.text,
                  fontSize: '0.75rem',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                Open
              </button>
              <button
                onClick={handleShowMetadata}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: C.text,
                  fontSize: '0.75rem',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                Show Metadata
              </button>
              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
            </>
          )}
          <button
            onClick={handleDeleteSession}
            style={{
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: C.red,
              fontSize: '0.75rem',
              fontFamily: "'IBM Plex Sans', sans-serif",
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = C.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            Delete {contextMenu.session.sessionId ? 'Session' : 'Folder'}
          </button>
        </div>
      )}
    </div>
  );
}
