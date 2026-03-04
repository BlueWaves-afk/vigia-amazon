'use client';

import { Settings, AlertTriangle, Activity, Command, Search } from 'lucide-react';

interface TopBarProps {
  onSettingsOpen?: () => void;
  onCommandOpen?:  () => void;
}

export function TopBar({ onSettingsOpen, onCommandOpen }: TopBarProps) {
  return (
    <header
      className="vigia-topbar"
      style={{
        display: 'flex', alignItems: 'center',
        height: 40, flexShrink: 0, position: 'relative',
        background: 'var(--v-topbar-bg)',
        userSelect: 'none',
      }}
    >

      {/* ── Left ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>

        {/* Logo lockup */}
        <div
          className="vigia-topbar-divider"
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px', height: '100%', position: 'relative' }}
        >
          {/* Indigo/violet left accent bar */}
          <div style={{
            position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 2,
            background: 'linear-gradient(180deg, transparent, var(--v-accent) 50%, transparent)',
            borderRadius: 1, opacity: 0.8,
          }} />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="VIGIA" width={18} height={18} style={{ display: 'block', flexShrink: 0 }} />

          {/* VIGIA wordmark — indigo→violet gradient */}
          <span style={{
            fontSize: '0.82rem', fontWeight: 700,
            letterSpacing: '-0.03em',
            fontFamily: 'var(--v-font-ui)',
            background: 'linear-gradient(90deg, var(--v-accent) 0%, var(--v-accent-hover) 55%, var(--v-rose) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            VIGIA
          </span>

          {/* Version badge */}
          <span style={{
            fontSize: '0.56rem', fontFamily: 'var(--v-font-mono)',
            letterSpacing: '0.06em', fontWeight: 500,
            padding: '1px 6px', borderRadius: 99,
            background: 'var(--v-accent-muted)',
            border: '1px solid var(--v-rose-border)',
            color: 'var(--v-rose)',
          }}>
            v1.0
          </span>
        </div>

        {/* Menu items — pill hover */}
        {['File', 'View', 'Analysis', 'Swarm', 'Ledger', 'Help'].map((item) => (
          <button
            key={item}
            className="vigia-menu-item"
            style={{
              padding: '0 11px', height: 28, border: 'none',
              background: 'transparent',
              color: 'var(--v-topbar-menu)',
              fontSize: '0.72rem', cursor: 'pointer',
              fontFamily: 'var(--v-font-ui)',
              borderRadius: 'var(--v-radius-sm)',
              margin: '0 1px',
              transition: 'background var(--v-transition-fast), color var(--v-transition-fast)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'var(--v-topbar-menu-hover)';
              el.style.color = 'var(--v-topbar-menu-active)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'transparent';
              el.style.color = 'var(--v-topbar-menu)';
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {/* ── Center: ⌘K search bar ─────────── */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <button
          onClick={onCommandOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 'var(--v-radius-md)',
            background: 'var(--v-topbar-search-bg)',
            border: '1px solid var(--v-topbar-search-border)',
            color: 'var(--v-topbar-search-text)',
            cursor: 'pointer',
            minWidth: 260,
            transition: 'border-color var(--v-transition-fast), box-shadow var(--v-transition-fast)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--v-accent-hover)';
            el.style.boxShadow = '0 0 0 3px var(--v-accent-muted)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--v-topbar-search-border)';
            el.style.boxShadow = 'none';
          }}
        >
          <Search size={11} style={{ flexShrink: 0, opacity: 0.55 }} />
          <span style={{ fontSize: '0.70rem', flex: 1, textAlign: 'left', fontFamily: 'var(--v-font-ui)', opacity: 0.65 }}>
            Search commands…
          </span>
          {/* ⌘K badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'var(--v-accent-muted)',
            border: '1px solid var(--v-rose-border)',
            borderRadius: 'var(--v-radius-sm)', padding: '1px 5px', flexShrink: 0,
          }}>
            <Command size={9} style={{ color: 'var(--v-rose)', opacity: 0.8 }} />
            <span style={{ fontSize: '0.57rem', fontFamily: 'var(--v-font-mono)', color: 'var(--v-rose)', opacity: 0.8 }}>K</span>
          </div>
        </button>
      </div>

      {/* ── Right ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%', marginLeft: 'auto', paddingRight: 8 }}>

        {/* Hazards chip — warning/amber */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 'var(--v-radius-md)',
          background: 'var(--v-warning-dim)',
          border: '1px solid color-mix(in srgb, var(--v-warning) 35%, transparent)',
        }}>
          <AlertTriangle size={10} style={{ color: 'var(--v-warning)', flexShrink: 0 }} />
          <span style={{
            fontSize: '0.63rem', fontWeight: 600, letterSpacing: '0.01em',
            fontFamily: 'var(--v-font-mono)', color: 'var(--v-warning)',
          }}>
            7 hazards
          </span>
        </div>

        {/* Nodes chip — accent/blue */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 'var(--v-radius-md)',
          background: 'var(--v-accent-muted)',
          border: '1px solid color-mix(in srgb, var(--v-accent) 35%, transparent)',
        }}>
          <Activity size={10} style={{ color: 'var(--v-accent-hover)', flexShrink: 0 }} />
          <span style={{
            fontSize: '0.63rem', fontWeight: 600, letterSpacing: '0.01em',
            fontFamily: 'var(--v-font-mono)', color: 'var(--v-accent-hover)',
          }}>
            48 nodes
          </span>
        </div>

        {/* Settings button */}
        <button
          onClick={onSettingsOpen}
          title="Settings (⌘,)"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, border: 'none', borderRadius: 'var(--v-radius-sm)',
            background: 'transparent',
            color: 'var(--v-topbar-menu)',
            cursor: 'pointer',
            transition: 'background var(--v-transition-fast), color var(--v-transition-fast)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'var(--v-topbar-menu-hover)';
            el.style.color = 'var(--v-topbar-menu-active)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = 'transparent';
            el.style.color = 'var(--v-topbar-menu)';
          }}
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
}
