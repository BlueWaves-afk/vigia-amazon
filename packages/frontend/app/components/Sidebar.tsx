'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Globe, Radio, Database,
  Settings, Search, AlertTriangle,
  Navigation, ChevronRight, ChevronDown,
  Folder, FolderOpen, FileText, Video,
  Clock, MapPin, Activity, Wrench,
} from 'lucide-react';
import { VFSManager } from '../lib/vfs-manager';
import { MaintenancePanel } from './MaintenancePanelIntegrated';
import { useMapFileStore } from '../../stores/mapFileStore';

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
  accentBg:'rgba(59,130,246,0.12)',
  hover:   'rgba(59,130,246,0.08)',
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
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        color: active ? C.text : C.textMut,
        borderLeft: active ? `2px solid ${C.accent}` : '2px solid transparent',
        cursor: 'pointer',
        transition: 'color 0.12s, background 0.12s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = C.textSec;
          (e.currentTarget as HTMLElement).style.background = C.hover;
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
          background: dragOver ? 'rgba(59,130,246,0.2)' : isActive ? C.accentBg : 'transparent',
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
          fontSize: '0.85rem',
          color: isActive ? C.text : icon === 'video' ? C.textSec : '#8B9AAE',
          fontWeight: isActive ? 500 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          fontFamily: 'Inter, sans-serif',
        }}>
          {label}
        </span>

        {badge && (
          <span style={{
            fontSize: '0.7rem',
            padding: '2px 7px',
            borderRadius: 4,
            background: badgeColor ? `${badgeColor}22` : 'rgba(255,255,255,0.06)',
            color: badgeColor ?? C.textMut,
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600,
            flexShrink: 0,
          }}>
            {badge}
          </span>
        )}

        {icon === 'video' && (
          <span style={{
            fontSize: '0.65rem', padding: '2px 6px', borderRadius: 3,
            background: '#E5484D', color: '#fff', fontWeight: 700,
            letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif',
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
      <span style={{ fontSize: '0.95rem', fontWeight: 600, color, fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </span>
      <span style={{ fontSize: '0.7rem', color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────

const MIN_WIDTH = 160;
const MAX_WIDTH = 340;
const DEFAULT_WIDTH = 210;

export function Sidebar({ onSentinelEyeClick, isSentinelEyeActive, onSettingsOpen, onSessionClick, onSessionsDeleted, onNewSessionClick, onRefreshSessions, onActivityChange }: SidebarProps) {
  const { computeDiff } = useMapFileStore();
  const [width, setWidth]         = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
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
      const apiUrl = 'https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod';
      const manager = new VFSManager(apiUrl);
      await manager.init();
      setVfsManager(manager);
      loadSessions(manager);
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

  const loadSessions = async (manager: VFSManager) => {
    try {
      const data = await manager.listSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
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
      const apiUrl = 'https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod';
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

      map.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        
        // Reverse geocode via backend proxy
        try {
          const apiUrl = 'https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod';
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
    const date = new Date(session.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = session.timestamp.split('T')[1].substring(0, 5);
    return `${year}-${month}-${day} ${time}`;
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
        for (const s of sessionsToDelete) {
          console.log('Deleting session:', s.sessionId);
          await vfsManager.deleteSession(s.sessionId);
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
        `Are you sure you want to delete session "${session.sessionId}"?`
      );
      
      if (!confirmed) {
        setContextMenu(null);
        return;
      }
      
      try {
        console.log('Deleting session:', session.sessionId);
        await vfsManager.deleteSession(session.sessionId);
        await loadSessions(vfsManager);
        onSessionsDeleted?.([session.sessionId]);
        setContextMenu(null);
        
        // Emit trace event
        window.dispatchEvent(new CustomEvent('vigia-trace', {
          detail: { type: 'delete', message: `Session deleted: ${session.sessionId}` }
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
      <div style={{
        width: 48,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: C.actBar,
        borderRight: `1px solid ${C.border}`,
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
          height: 38,
          flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{
            fontSize: '0.75rem',
            color: C.textSec,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'Inter, sans-serif',
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
                  fontFamily: 'Inter, sans-serif', flex: 1, width: 0,
                }}
              />
            </div>
          </div>
        )}

        {/* ── Stats strip ───────────────────── */}
        {!isCollapsed && (
          <div style={{
            display: 'flex',
            borderBottom: `1px solid ${C.border}`,
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
          <TreeNode label="Sessions" icon="folder">
              {Object.keys(sessionsByGeo).sort().map(continent => (
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
                              .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))
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
                                        // Check if same location (city)
                                        const sameLocation = draggedSession.location?.city === session.location?.city;
                                        
                                        if (sameLocation) {
                                          // Trigger split view
                                          window.dispatchEvent(new CustomEvent('vigia-split-view', {
                                            detail: { left: draggedSession, right: session }
                                          }));
                                          
                                          // Emit trace event
                                          window.dispatchEvent(new CustomEvent('vigia-trace', {
                                            detail: { 
                                              type: 'split', 
                                              message: `Split view: ${draggedSession.sessionId} | ${session.sessionId}` 
                                            }
                                          }));
                                        } else {
                                          // Different locations - compute diff
                                          try {
                                            // Add sessions to store as MapFiles
                                            const { files } = useMapFileStore.getState();
                                            
                                            const fileA: any = {
                                              version: "1.0",
                                              sessionId: draggedSession.sessionId,
                                              timestamp: new Date(draggedSession.timestamp).getTime(),
                                              hazards: draggedSession.hazards || [],
                                              metadata: {
                                                totalHazards: draggedSession.hazardCount || 0,
                                                geohashBounds: draggedSession.geohash7 || '',
                                                contributors: [draggedSession.contributorId || 'unknown']
                                              }
                                            };
                                            
                                            const fileB: any = {
                                              version: "1.0",
                                              sessionId: session.sessionId,
                                              timestamp: new Date(session.timestamp).getTime(),
                                              hazards: session.hazards || [],
                                              metadata: {
                                                totalHazards: session.hazardCount || 0,
                                                geohashBounds: session.geohash7 || '',
                                                contributors: [session.contributorId || 'unknown']
                                              }
                                            };
                                            
                                            // Add to store
                                            files.set(fileA.sessionId, fileA);
                                            files.set(fileB.sessionId, fileB);
                                            useMapFileStore.setState({ files: new Map(files) });
                                            
                                            // Compute diff
                                            await computeDiff(fileA.sessionId, fileB.sessionId);
                                            
                                            // Emit trace event
                                            window.dispatchEvent(new CustomEvent('vigia-trace', {
                                              detail: { 
                                                type: 'diff', 
                                                message: `Diff computed: ${draggedSession.sessionId} → ${session.sessionId}` 
                                              }
                                            }));
                                          } catch (err) {
                                            console.error('Failed to compute diff:', err);
                                            alert('Failed to compute diff. Sessions may not have hazard data.');
                                          }
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
              <div style={{ padding: '2px 10px 4px', fontSize: '0.6rem', color: C.textMut, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
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
                  <span style={{ fontSize: '0.73rem', color: '#5C6B80', flex: 1, textAlign: 'left', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                  {badge && (
                    <span style={{
                      fontSize: '0.58rem', padding: '1px 5px', borderRadius: 3,
                      background: 'rgba(255,255,255,0.06)', color: C.textMut,
                      fontFamily: 'JetBrains Mono, monospace',
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
          <div style={{
            padding: '7px 10px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, flexShrink: 0 }} className="pulse" />
            <span style={{ fontSize: '0.64rem', color: C.textMut, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        style={{
          width: 4,
          background: 'transparent',
          cursor: 'col-resize',
          flexShrink: 0,
          borderRight: `1px solid ${C.border}`,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.3)'}
        onMouseLeave={(e) => { if (!isDragging) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      />

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
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text, fontFamily: 'Inter, sans-serif' }}>
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
                    fontFamily: 'Inter, sans-serif',
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
                  fontFamily: 'Inter, sans-serif',
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
                        fontFamily: 'Inter, sans-serif',
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
              <div style={{ fontSize: '0.7rem', color: C.textMut, fontFamily: 'JetBrains Mono, monospace' }}>
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
                    fontFamily: 'Inter, sans-serif',
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
                    fontFamily: 'Inter, sans-serif',
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

      {/* ── Maintenance Panel ──────────────────────────────────────────────── */}
      {activeActivity === 'maintenance' && (
        <div style={{
          width,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: C.bg,
        }}>
          <MaintenancePanel />
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 10000,
            minWidth: 180,
            padding: '4px 0',
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
                  fontFamily: 'Inter, sans-serif',
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
                  fontFamily: 'Inter, sans-serif',
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
              fontFamily: 'Inter, sans-serif',
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
