'use client';

import { Activity, Cloud, Shield, GitBranch, Wifi, AlertTriangle } from 'lucide-react';

// ─────────────────────────────────────────────
// TopBar — VIGIA main application menu bar
// ─────────────────────────────────────────────

function StatusDot({ label, ok = true }: { label: string; ok?: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 h-full border-r border-ide-border last:border-r-0"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 pulse ${ok ? 'bg-ide-green' : 'bg-ide-red'}`}
      />
      <span className="text-ide-text-secondary" style={{ fontSize: '0.68rem' }}>
        {label}
      </span>
    </div>
  );
}

export function TopBar() {
  return (
    <header
      className="flex items-center justify-between h-8 flex-shrink-0 select-none"
      style={{ background: '#0A0D12', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* ── Left: Logo + menu ─────────────────── */}
      <div className="flex items-center h-full">
        <div
          className="flex items-center gap-2 px-4 h-full border-r border-ide-border"
        >
          {/* Geometric mark */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <rect x="1"  y="1"  width="5.5" height="5.5" stroke="#2563EB" strokeWidth="1.4" />
            <rect x="8.5" y="1"  width="5.5" height="5.5" stroke="#2563EB" strokeWidth="1.4" />
            <rect x="1"  y="8.5" width="5.5" height="5.5" stroke="#3B82F6" strokeWidth="1.4" opacity="0.55" />
            <rect x="8.5" y="8.5" width="5.5" height="5.5" stroke="#3B82F6" strokeWidth="1.4" opacity="0.25" />
          </svg>
          <span
            className="text-ide-text font-semibold"
            style={{ fontSize: '0.76rem', letterSpacing: '-0.01em' }}
          >
            VIGIA
          </span>
          <span
            className="text-ide-text-tertiary font-data"
            style={{ fontSize: '0.6rem' }}
          >
            v1.0
          </span>
        </div>

        {/* Menu items */}
        {['File', 'View', 'Analysis', 'Swarm', 'Ledger', 'Help'].map((item) => (
          <button
            key={item}
            className="px-3 h-full text-ide-text-tertiary transition-colors"
            style={{ fontSize: '0.7rem' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLElement).style.color = '#8B95A1';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '';
              (e.currentTarget as HTMLElement).style.color = '';
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {/* ── Center: breadcrumb hint ────────────── */}
      <div className="flex items-center gap-1" style={{ fontSize: '0.66rem' }}>
        <span className="text-ide-text-tertiary">vigia</span>
        <span className="text-ide-text-tertiary opacity-30">/</span>
        <span className="text-ide-text-tertiary">road-intelligence</span>
        <span className="text-ide-text-tertiary opacity-30">/</span>
        <span className="text-ide-text-secondary">workspace</span>
      </div>

      {/* ── Right: System status ───────────────── */}
      <div className="flex items-center h-full border-l border-ide-border">
        <StatusDot label="Edge Online" />
        <StatusDot label="Cloud Sync" />
        <StatusDot label="Ledger Integrity" />

        <div className="flex items-center gap-1.5 px-3 h-full border-l border-ide-border">
          <AlertTriangle size={10} className="text-ide-yellow" />
          <span className="text-ide-text-secondary" style={{ fontSize: '0.66rem' }}>
            7 active hazards
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 h-full border-l border-ide-border">
          <GitBranch size={10} className="text-ide-text-tertiary" />
          <span className="text-ide-text-tertiary" style={{ fontSize: '0.66rem' }}>
            main
          </span>
        </div>
      </div>
    </header>
  );
}
