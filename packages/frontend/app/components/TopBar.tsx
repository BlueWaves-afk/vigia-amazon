'use client';

import { Settings, AlertTriangle, Activity, Command, Search } from 'lucide-react';

interface TopBarProps {
  onSettingsOpen?: () => void;
  onCommandOpen?:  () => void;
}

const FONT_UI   = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

export function TopBar({ onSettingsOpen, onCommandOpen }: TopBarProps) {
  return (
    <header
      className="vigia-topbar"
      style={{
        display: 'flex', alignItems: 'center',
        height: 36, flexShrink: 0, position: 'relative',
        background: 'var(--c-deep)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02)',
        userSelect: 'none',
      }}
    >

      {/* ── Left ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>

        {/* Logo lockup */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '0 18px', height: '100%',
          borderRight: '1px solid var(--c-border)',
          position: 'relative',
        }}>
          {/* Rose accent line */}
          <div style={{
            position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 2,
            background: 'linear-gradient(180deg, transparent, var(--c-rose) 50%, transparent)',
            borderRadius: 1, opacity: 0.65,
          }} />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="VIGIA" width={18} height={18} style={{ display: 'block', flexShrink: 0 }} />

          <span style={{
            fontSize: '0.80rem', fontWeight: 700,
            color: 'var(--c-text)', letterSpacing: '-0.03em',
            fontFamily: FONT_UI,
          }}>
            VIGIA
          </span>
          <span style={{
            fontSize: '0.58rem', color: 'var(--c-text-3)',
            fontFamily: FONT_MONO, letterSpacing: '0.04em',
          }}>
            v1.0
          </span>
        </div>

        {/* Menu items */}
        {['File', 'View', 'Analysis', 'Swarm', 'Ledger', 'Help'].map((item) => (
          <button key={item} style={{
            padding: '0 10px', height: '100%', border: 'none',
            background: 'transparent', color: 'var(--c-text-3)',
            fontSize: '0.73rem', cursor: 'pointer',
            fontFamily: FONT_UI,
            transition: 'background var(--dur-fast), color var(--dur-fast)',
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

      {/* ── Center: ⌘K search pill ─────────── */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <button
          onClick={onCommandOpen}
          className="btn-lift"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 6,
            background: 'var(--c-input)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text-3)',
            cursor: 'pointer',
            minWidth: 210,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-rose-border)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--c-rose-dim), inset 0 1px 0 rgba(255,255,255,0.02)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.02)';
          }}
        >
          <Search size={11} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.71rem', flex: 1, textAlign: 'left', fontFamily: FONT_UI }}>
            Search commands…
          </span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'var(--c-panel)', border: '1px solid var(--c-border)',
            borderRadius: 3, padding: '1px 5px', flexShrink: 0,
          }}>
            <Command size={9} style={{ color: 'var(--c-rose)' }} />
            <span style={{ fontSize: '0.58rem', color: 'var(--c-text-3)', fontFamily: FONT_MONO }}>K</span>
          </div>
        </button>
      </div>

      {/* ── Right ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', marginLeft: 'auto' }}>

        {/* Hazards pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 12px', height: '100%',
          borderLeft: '1px solid var(--c-border)',
          borderRight: '1px solid var(--c-border)',
        }}>
          <AlertTriangle size={11} style={{ color: 'var(--c-yellow)' }} />
          <span style={{ fontSize: '0.63rem', color: 'var(--c-text-3)', fontFamily: FONT_UI }}>
            7 hazards
          </span>
        </div>

        {/* Nodes pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 12px', height: '100%',
          borderRight: '1px solid var(--c-border)',
        }}>
          <Activity size={11} style={{ color: 'var(--c-text-3)' }} />
          <span style={{ fontSize: '0.63rem', color: 'var(--c-text-3)', fontFamily: FONT_MONO }}>
            48 nodes
          </span>
        </div>

        {/* Settings button */}
        <button
          onClick={onSettingsOpen}
          title="Settings (⌘,)"
          className="icon-hover"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: '100%', border: 'none',
            background: 'transparent', color: 'var(--c-text-3)',
            cursor: 'pointer',
            transition: 'background var(--dur-fast), color var(--dur-fast)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--c-rose-2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)';
          }}
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
}
