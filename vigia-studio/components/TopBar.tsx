'use client';

import { Activity, Cloud, Shield, GitBranch, Wifi } from 'lucide-react';

// ─────────────────────────────────────────────
// TopBar — VIGIA Studio main menu bar
// ─────────────────────────────────────────────

interface StatusIndicatorProps {
  label: string;
  icon: React.ReactNode;
  status: 'online' | 'warning' | 'offline';
}

function StatusIndicator({ label, icon, status }: StatusIndicatorProps) {
  const dotColor =
    status === 'online'
      ? 'bg-accent-green'
      : status === 'warning'
      ? 'bg-accent-yellow'
      : 'bg-accent-red';

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 border-r border-[rgba(255,255,255,0.06)] last:border-r-0">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} status-dot-online flex-shrink-0`} />
      <span className="text-text-secondary" style={{ fontSize: '0.7rem' }}>
        {label}
      </span>
    </div>
  );
}

export function TopBar() {
  return (
    <header
      className="flex items-center justify-between h-8 flex-shrink-0 select-none shadow-sm"
      style={{
        background: '#0D1117',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 0 0 rgba(37,99,235,0.04)',
      }}
    >
      {/* Left — Branding + Menu Items */}
      <div className="flex items-center h-full">
        {/* Logo block */}
        <div
          className="flex items-center gap-2 px-4 h-full border-r"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          {/* Geometric logo mark */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" stroke="#2563EB" strokeWidth="1.5" />
            <rect x="9" y="1" width="6" height="6" stroke="#2563EB" strokeWidth="1.5" />
            <rect x="1" y="9" width="6" height="6" stroke="#3B82F6" strokeWidth="1.5" opacity="0.6" />
            <rect x="9" y="9" width="6" height="6" stroke="#3B82F6" strokeWidth="1.5" opacity="0.3" />
          </svg>
          <span
            className="text-text-primary font-semibold tracking-tight"
            style={{ fontSize: '0.78rem', letterSpacing: '-0.01em' }}
          >
            VIGIA Studio
          </span>
          <span
            className="text-text-muted font-mono"
            style={{ fontSize: '0.62rem' }}
          >
            v2.4.1
          </span>
        </div>

        {/* Menu items */}
        {['File', 'View', 'Analysis', 'Swarm', 'Ledger', 'Help'].map((item) => (
          <button
            key={item}
            className="px-3 h-full text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors rounded-sm focus:outline-none focus:ring-2 focus:ring-border-focus"
            style={{ fontSize: '0.72rem', transition: 'all var(--transition-fast)' }}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Center — File path breadcrumb */}
      <div className="flex items-center gap-1" style={{ fontSize: '0.68rem' }}>
        <span className="text-text-muted">geo-intelligence</span>
        <span className="text-text-muted opacity-40">/</span>
        <span className="text-text-muted">workspace</span>
        <span className="text-text-muted opacity-40">/</span>
        <span className="text-text-secondary">united-states</span>
      </div>

      {/* Right — System Status */}
      <div className="flex items-center h-full border-l" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <StatusIndicator label="Edge Online" icon={<Wifi size={10} />} status="online" />
        <StatusIndicator label="Cloud Sync" icon={<Cloud size={10} />} status="online" />
        <StatusIndicator label="Ledger Integrity" icon={<Shield size={10} />} status="online" />

        <div
          className="flex items-center gap-1.5 px-3 h-full border-l"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <GitBranch size={10} className="text-text-muted" />
          <span className="text-text-muted" style={{ fontSize: '0.68rem' }}>
            main
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 h-full border-l"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <Activity size={10} className="text-accent-green" />
          <span className="text-text-muted" style={{ fontSize: '0.68rem' }}>
            48 active nodes
          </span>
        </div>
      </div>
    </header>
  );
}
