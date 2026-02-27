'use client';

import { useState } from 'react';
import {
  Globe,
  Layers,
  Radio,
  Database,
  Settings,
  GitBranch,
  Search,
  AlertTriangle,
  Navigation,
} from 'lucide-react';
import { FolderItem } from './FolderItem';

interface SidebarProps {
  onSentinelEyeClick: () => void;
  isSentinelEyeActive: boolean;
}

// ─────────────────────────────────────────────
// Activity Bar Button
// ─────────────────────────────────────────────

function ActivityBtn({
  icon,
  active,
  label,
}: {
  icon: React.ReactNode;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      title={label}
      className="w-full flex items-center justify-center h-10 relative transition-colors"
      style={{
        color: active ? '#E2E8F0' : '#4B5563',
        borderLeft: active ? '2px solid #2563EB' : '2px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = '#8B95A1';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = '#4B5563';
      }}
    >
      {icon}
    </button>
  );
}

// ─────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────

export function Sidebar({ onSentinelEyeClick, isSentinelEyeActive }: SidebarProps) {
  return (
    <div
      className="flex flex-shrink-0 h-full"
      style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* ── Activity Bar ────────────────────── */}
      <div
        className="flex flex-col w-10 flex-shrink-0"
        style={{ background: '#0A0D12', borderRight: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex flex-col flex-1">
          <ActivityBtn icon={<Globe size={18} />} active label="Geo Explorer" />
          <ActivityBtn icon={<Layers size={18} />} label="Layers" />
          <ActivityBtn icon={<Radio size={18} />} label="Swarm" />
          <ActivityBtn icon={<Database size={18} />} label="Ledger" />
        </div>
        <div className="flex flex-col">
          <ActivityBtn icon={<GitBranch size={18} />} label="Source Control" />
          <ActivityBtn icon={<Settings size={18} />} label="Settings" />
        </div>
      </div>

      {/* ── Explorer Panel ──────────────────── */}
      <div
        className="w-56 flex flex-col overflow-hidden"
        style={{ background: '#161B22' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            className="uppercase text-ide-text-tertiary font-medium tracking-widest"
            style={{ fontSize: '0.64rem', letterSpacing: '0.1em' }}
          >
            EXPLORER
          </span>
          <button className="text-ide-text-tertiary p-0.5 transition-colors hover:text-ide-text-secondary">
            <Search size={12} />
          </button>
        </div>

        {/* Search */}
        <div className="px-2 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            className="flex items-center gap-2 px-2 h-6 rounded"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Search size={10} className="text-ide-text-tertiary flex-shrink-0" />
            <input
              type="text"
              placeholder="Filter..."
              className="bg-transparent flex-1 text-ide-text-secondary focus:outline-none placeholder-ide-text-tertiary"
              style={{ fontSize: '0.7rem' }}
            />
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          <FolderItem label="Sessions" icon="folder">
            <FolderItem label="2026-02-27" icon="folder" depth={1}>
              <FolderItem label="Session-001" icon="file" depth={2} />
              <FolderItem label="Session-002" icon="file" depth={2} />
            </FolderItem>
          </FolderItem>

          <FolderItem label="Live Streams" icon="folder">
            <FolderItem
              label="Sentinel Eye"
              icon="video"
              depth={1}
              isActive={isSentinelEyeActive}
              onClick={onSentinelEyeClick}
            />
          </FolderItem>

          {/* Divider */}
          <div className="my-2 mx-3" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

          {/* Pinned section */}
          <div className="px-3 py-1">
            <span
              className="uppercase text-ide-text-tertiary tracking-widest"
              style={{ fontSize: '0.6rem', letterSpacing: '0.1em' }}
            >
              PINNED
            </span>
          </div>

          <div
            className="mx-2 my-1 flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.05)' }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
          >
            <Navigation size={10} className="text-ide-text-tertiary" />
            <span className="text-ide-text-tertiary" style={{ fontSize: '0.72rem' }}>Route Library</span>
          </div>

          <div
            className="mx-2 my-1 flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.05)' }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
          >
            <AlertTriangle size={10} className="text-ide-red" />
            <span className="text-ide-text-tertiary" style={{ fontSize: '0.72rem' }}>Active Hazards</span>
            <span
              className="ml-auto px-1 rounded font-data"
              style={{
                fontSize: '0.58rem',
                background: 'rgba(239,68,68,0.15)',
                color: '#EF4444',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              7
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-3 py-2 flex items-center gap-2 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-ide-green pulse flex-shrink-0" />
          <span className="text-ide-text-tertiary" style={{ fontSize: '0.64rem' }}>
            Rourkela · India
          </span>
        </div>
      </div>
    </div>
  );
}
