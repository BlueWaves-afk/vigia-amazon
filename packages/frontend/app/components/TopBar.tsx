'use client';

import { Settings, AlertTriangle, Activity, GitBranch, Command, Search } from 'lucide-react';

interface TopBarProps {
  onSettingsOpen?: () => void;
  onCommandOpen?:  () => void;
}

function StatusDot({ label, ok = true }: { label: string; ok?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '0 10px', height: '100%',
      borderRight: '1px solid var(--c-border)',
    }}>
      <span className="pulse" style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: ok ? 'var(--c-green)' : 'var(--c-red)',
      }} />
      <span style={{ fontSize: '0.63rem', color: 'var(--c-text-3)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
        {label}
      </span>
    </div>
  );
}

export function TopBar({ onSettingsOpen, onCommandOpen }: TopBarProps) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 34, flexShrink: 0,
      background: 'var(--c-deep)',
      borderBottom: '1px solid var(--c-border)',
      userSelect: 'none',
    }}>

      {/* ── Left ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>

        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '0 16px', height: '100%',
          borderRight: '1px solid var(--c-border)',
          position: 'relative',
        }}>
          {/* Rose accent line on logo section */}
          <div style={{
            position: 'absolute', left: 0, top: '20%', bottom: '20%',
            width: 2,
            background: 'linear-gradient(180deg, transparent, var(--c-rose), transparent)',
            borderRadius: 1,
            opacity: 0.6,
          }} />

          {/* 2×2 grid mark */}
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="5" stroke="var(--c-accent-2)"  strokeWidth="1.4" />
            <rect x="8" y="1" width="5" height="5" stroke="var(--c-accent-2)"  strokeWidth="1.4" />
            <rect x="1" y="8" width="5" height="5" stroke="var(--c-rose)"      strokeWidth="1.4" opacity="0.65" />
            <rect x="8" y="8" width="5" height="5" stroke="var(--c-rose)"      strokeWidth="1.4" opacity="0.28" />
          </svg>

          <span style={{
            fontSize: '0.82rem', fontWeight: 600,
            color: 'var(--c-text)',
            letterSpacing: '-0.02em',
            fontFamily: 'IBM Plex Sans, sans-serif',
          }}>
            VIGIA
          </span>
          <span style={{ fontSize: '0.60rem', color: 'var(--c-text-3)', fontFamily: 'IBM Plex Mono, monospace' }}>
            v1.0
          </span>
        </div>

        {/* Menu items */}
        {['File', 'View', 'Analysis', 'Swarm', 'Ledger', 'Help'].map((item) => (
          <button key={item} className="btn-lift" style={{
            padding: '0 11px', height: '100%', border: 'none',
            background: 'transparent', color: 'var(--c-text-3)',
            fontSize: '0.74rem', cursor: 'pointer',
            fontFamily: 'IBM Plex Sans, sans-serif',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)';
          }}>
            {item}
          </button>
        ))}
      </div>

      {/* ── Center: ⌘K search bar ─────────── */}
      <button
        onClick={onCommandOpen}
        className="btn-lift"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', borderRadius: 5,
          background: 'var(--c-input)',
          border: '1px solid var(--c-border)',
          color: 'var(--c-text-3)',
          cursor: 'pointer',
          transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.12s',
          minWidth: 200,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-rose-border)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--c-rose-dim)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      >
        <Search size={12} style={{ color: 'var(--c-text-3)' }} />
        <span style={{ fontSize: '0.72rem', flex: 1, textAlign: 'left', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          Search commands...
        </span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'var(--c-panel)',
          border: '1px solid var(--c-border)',
          borderRadius: 3, padding: '1px 5px',
          flexShrink: 0,
        }}>
          <Command size={9} style={{ color: 'var(--c-rose)' }} />
          <span style={{ fontSize: '0.60rem', color: 'var(--c-text-3)', fontFamily: 'IBM Plex Mono, monospace' }}>K</span>
        </div>
      </button>

      {/* ── Right ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', borderLeft: '1px solid var(--c-border)' }}>

        <StatusDot label="Edge"   ok />
        <StatusDot label="Cloud"  ok />
        <StatusDot label="Ledger" ok />

        {/* Hazards */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 10px', height: '100%',
          borderRight: '1px solid var(--c-border)',
        }}>
          <AlertTriangle size={11} style={{ color: 'var(--c-yellow)' }} />
          <span style={{ fontSize: '0.63rem', color: 'var(--c-text-3)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            7 hazards
          </span>
        </div>

        {/* Nodes */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 10px', height: '100%',
          borderRight: '1px solid var(--c-border)',
        }}>
          <Activity size={11} style={{ color: 'var(--c-text-3)' }} />
          <span style={{ fontSize: '0.63rem', color: 'var(--c-text-3)', fontFamily: 'IBM Plex Mono, monospace' }}>
            48 nodes
          </span>
        </div>

        {/* Branch */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 10px', height: '100%',
          borderRight: '1px solid var(--c-border)',
        }}>
          <GitBranch size={11} style={{ color: 'var(--c-rose)', opacity: 0.7 }} />
          <span style={{ fontSize: '0.63rem', color: 'var(--c-text-3)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
            main
          </span>
        </div>

        {/* Settings */}
        <button onClick={onSettingsOpen} title="Settings (⌘,)" className="icon-hover" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: '100%', border: 'none',
          background: 'transparent', color: 'var(--c-text-3)', cursor: 'pointer',
          transition: 'background 0.1s, color 0.12s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
          (e.currentTarget as HTMLElement).style.color = 'var(--c-rose-2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)';
        }}>
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
}
