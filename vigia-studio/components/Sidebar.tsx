'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Globe,
  MapPin,
  AlertTriangle,
  FolderOpen,
  Folder,
  Layers,
  Navigation,
  Radio,
  Database,
  Settings,
  Search,
  GitBranch,
} from 'lucide-react';
import { CITIES, THREAT_LEVEL_COLORS } from '@/lib/mockData';
import { City } from '@/types';

interface SidebarProps {
  onCityOpen: (cityId: string) => void;
  activeCityIds: string[];
}

// ─────────────────────────────────────────────
// Tree Node
// ─────────────────────────────────────────────

interface CityRowProps {
  city: City;
  onOpen: (id: string) => void;
  isActive: boolean;
  depth?: number;
}

function CityRow({ city, onOpen, isActive, depth = 0 }: CityRowProps) {
  const threatColor = THREAT_LEVEL_COLORS[city.threatLevel];
  const paddingLeft = 12 + depth * 16;

  return (
    <button
      onClick={() => onOpen(city.id)}
      className={`w-full flex items-center gap-2 h-7 group relative text-left transition-colors rounded-sm focus:outline-none focus:ring-2 focus:ring-border-focus ${isActive ? 'bg-[rgba(37,99,235,0.12)]' : ''}`}
      style={{
        paddingLeft,
        background: isActive ? 'rgba(37,99,235,0.12)' : undefined,
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = '';
      }}
    >
      {/* Active border */}
      {isActive && (
        <span
          className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{ background: '#2563EB' }}
        />
      )}

      <MapPin size={12} className="flex-shrink-0 text-text-muted" />
      <span
        className="flex-1 truncate"
        style={{
          fontSize: '0.78rem',
          color: isActive ? '#E2E8F0' : '#8B95A1',
          fontWeight: isActive ? 500 : 400,
          transition: 'color var(--transition-fast)',
        }}
      >
        {city.name}
      </span>

      {/* Threat badge */}
      <span
        className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: threatColor,
          borderRadius: '3px',
          padding: '2px 6px',
          fontSize: '0.65rem',
          color: '#fff',
          fontWeight: 500,
          transition: 'opacity var(--transition-fast)',
        }}
      >
        {city.threatLevel}
      </span>

      {/* Live dot */}
      <span
        className="w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0"
        style={{ background: threatColor, opacity: 0.7 }}
      />
    </button>
  );
}

// ─────────────────────────────────────────────
// Region Group
// ─────────────────────────────────────────────

interface RegionGroupProps {
  region: string;
  cities: City[];
  onOpen: (id: string) => void;
  activeCityIds: string[];
}

function RegionGroup({ region, cities, onOpen, activeCityIds }: RegionGroupProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 h-7 px-2 transition-colors"
        style={{ fontSize: '0.7rem' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
      >
        {expanded ? (
          <ChevronDown size={11} className="text-text-muted" />
        ) : (
          <ChevronRight size={11} className="text-text-muted" />
        )}
        {expanded ? (
          <FolderOpen size={12} className="text-text-muted" />
        ) : (
          <Folder size={12} className="text-text-muted" />
        )}
        <span
          className="uppercase text-text-muted tracking-widest"
          style={{ fontSize: '0.66rem', letterSpacing: '0.08em' }}
        >
          {region}
        </span>
        <span
          className="ml-auto text-text-muted"
          style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace' }}
        >
          {cities.length}
        </span>
      </button>
      {expanded && (
        <div>
          {cities.map((city) => (
            <CityRow
              key={city.id}
              city={city}
              onOpen={onOpen}
              isActive={activeCityIds.includes(city.id)}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Activity Bar Icon
// ─────────────────────────────────────────────

interface ActivityItemProps {
  icon: React.ReactNode;
  active?: boolean;
  label: string;
}

function ActivityItem({ icon, active, label }: ActivityItemProps) {
  return (
    <button
      title={label}
      className="w-full flex items-center justify-center h-10 relative transition-colors"
      style={{
        color: active ? '#E2E8F0' : '#4B5563',
        borderLeft: active ? '2px solid #2563EB' : '2px solid transparent',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = '#8B95A1'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = '#4B5563'; }}
    >
      {icon}
    </button>
  );
}

// ─────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────

export function Sidebar({ onCityOpen, activeCityIds }: SidebarProps) {
  const [activeSection, setActiveSection] = useState<'explorer' | 'layers' | 'swarm' | 'ledger'>('explorer');
  const regions = [...new Set(CITIES.map((c) => c.region))];

  return (
    <div
      className="flex flex-shrink-0 h-full"
      style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Activity bar */}
      <div
        className="flex flex-col w-10 flex-shrink-0"
        style={{
          background: '#0D1117',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex flex-col flex-1">
          <ActivityItem icon={<Globe size={18} />} active={activeSection === 'explorer'} label="Geo Explorer" />
          <ActivityItem icon={<Layers size={18} />} active={activeSection === 'layers'} label="Layer Control" />
          <ActivityItem icon={<Radio size={18} />} active={activeSection === 'swarm'} label="Swarm Monitor" />
          <ActivityItem icon={<Database size={18} />} active={activeSection === 'ledger'} label="Ledger" />
        </div>
        <div className="flex flex-col">
          <ActivityItem icon={<GitBranch size={18} />} label="Version Control" />
          <ActivityItem icon={<Settings size={18} />} label="Settings" />
        </div>
      </div>

      {/* Panel content */}
      <div
        className="w-56 flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-sidebar)' }}
      >
        {/* Panel Header */}
        <div
          className="flex items-center justify-between px-3 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            className="uppercase tracking-widest text-text-muted font-medium"
            style={{ fontSize: '0.66rem', letterSpacing: '0.1em' }}
          >
            GEO EXPLORER
          </span>
          <button className="text-text-muted hover:text-text-secondary transition-colors p-0.5">
            <Search size={12} />
          </button>
        </div>

        {/* Search */}
        <div className="px-2 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            className="flex items-center gap-2 px-2 h-6 rounded"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Search size={10} className="text-text-muted flex-shrink-0" />
            <input
              type="text"
              placeholder="Filter locations..."
              className="bg-transparent flex-1 text-text-secondary focus:outline-none placeholder-text-muted"
              style={{ fontSize: '0.72rem' }}
            />
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {regions.map((region) => (
            <RegionGroup
              key={region}
              region={region}
              cities={CITIES.filter((c) => c.region === region)}
              onOpen={onCityOpen}
              activeCityIds={activeCityIds}
            />
          ))}

          {/* Divider */}
          <div className="my-2 mx-3" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Pinned label */}
          <div className="px-3 py-1">
            <span
              className="uppercase text-text-muted tracking-widest"
              style={{ fontSize: '0.62rem', letterSpacing: '0.1em' }}
            >
              PINNED
            </span>
          </div>
          <div
            className="mx-3 my-1 flex items-center gap-2 px-2 py-1 rounded"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <Navigation size={10} className="text-text-muted" />
            <span className="text-text-muted" style={{ fontSize: '0.72rem' }}>
              Route Library
            </span>
          </div>
          <div
            className="mx-3 my-1 flex items-center gap-2 px-2 py-1 rounded"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <AlertTriangle size={10} className="text-accent-red" />
            <span className="text-text-muted" style={{ fontSize: '0.72rem' }}>
              Active Hazards
            </span>
            <span
              className="ml-auto text-accent-red font-mono rounded px-1"
              style={{
                fontSize: '0.6rem',
                background: 'rgba(239,68,68,0.15)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              7
            </span>
          </div>
        </div>

        {/* Bottom status */}
        <div
          className="px-3 py-2 flex items-center gap-2 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green flex-shrink-0" />
          <span className="text-text-muted" style={{ fontSize: '0.66rem' }}>
            {CITIES.length} locations indexed
          </span>
        </div>
      </div>
    </div>
  );
}
