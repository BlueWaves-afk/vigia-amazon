'use client';

import { Settings, AlertTriangle, Activity, Command, Search } from 'lucide-react';

interface TopBarProps {
  onSettingsOpen?: () => void;
  onCommandOpen?:  () => void;
}

export function TopBar({ onSettingsOpen, onCommandOpen }: TopBarProps) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center',
      height: 34, flexShrink: 0, position: 'relative',
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

          {/* Project logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="VIGIA" width={20} height={20} style={{ display: 'block', flexShrink: 0 }} />

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
            (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)';
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

      {/* ── Center: ⌘K search bar — absolutely centered like VS Code ───── */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex' }}>
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
      </div>

      {/* ── Right ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', borderLeft: '1px solid var(--c-border)', marginLeft: 'auto' }}>

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

        {/* Settings */}
        <button onClick={onSettingsOpen} title="Settings (⌘,)" className="icon-hover" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: '100%', border: 'none',
          background: 'transparent', color: 'var(--c-text-3)', cursor: 'pointer',
          transition: 'background 0.1s, color 0.12s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)';
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
