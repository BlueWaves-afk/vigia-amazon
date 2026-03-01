'use client';

import { Settings } from 'lucide-react';

// ─────────────────────────────────────────────
// TopBar
// ─────────────────────────────────────────────

const C = {
  bg:      '#080B10',
  border:  'rgba(255,255,255,0.07)',
  text:    '#DDE3ED',
  textSec: '#7C8799',
  textMut: '#3D4655',
  accent:  '#3B82F6',
};

interface TopBarProps {
  onSettingsOpen?: () => void;
}

export function TopBar({ onSettingsOpen }: TopBarProps) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 38,
      flexShrink: 0,
      background: C.bg,
      borderBottom: `1px solid ${C.border}`,
      userSelect: 'none',
    }}>
      {/* ── Left ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 18px', height: '100%',
          borderRight: `1px solid ${C.border}`,
        }}>
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
            <rect x="1"   y="1"   width="5" height="5" stroke="#1D4ED8" strokeWidth="1.3" />
            <rect x="8"   y="1"   width="5" height="5" stroke="#1D4ED8" strokeWidth="1.3" />
            <rect x="1"   y="8"   width="5" height="5" stroke="#3B82F6" strokeWidth="1.3" opacity="0.5" />
            <rect x="8"   y="8"   width="5" height="5" stroke="#3B82F6" strokeWidth="1.3" opacity="0.22" />
          </svg>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text, letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
            VIGIA
          </span>
          <span style={{ fontSize: '0.7rem', color: C.textMut, fontFamily: 'JetBrains Mono, monospace' }}>
            v1.0
          </span>
        </div>

        {/* Menu */}
        {['File', 'View', 'Analysis', 'Swarm', 'Ledger', 'Help'].map((item) => (
          <button key={item} style={{
            padding: '0 14px', height: '100%', border: 'none',
            background: 'transparent', color: C.textMut,
            fontSize: '0.85rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            (e.currentTarget as HTMLElement).style.color = C.textSec;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = C.textMut;
          }}>
            {item}
          </button>
        ))}
      </div>

      {/* ── Center ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {['vigia', 'road-intelligence', 'workspace'].map((seg, i, arr) => (
          <span key={seg} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: '0.8rem',
              color: i === arr.length - 1 ? C.textSec : C.textMut,
              fontFamily: 'Inter, sans-serif',
            }}>
              {seg}
            </span>
            {i < arr.length - 1 && (
              <span style={{ color: C.textMut, opacity: 0.3, fontSize: '0.85rem' }}>/</span>
            )}
          </span>
        ))}
      </div>

      {/* ── Right ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', borderLeft: `1px solid ${C.border}` }}>
        {/* Innovation Features button */}
        <a
          href="/innovation"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 12px', height: '100%', border: 'none',
            background: 'transparent', color: C.accent, cursor: 'pointer',
            fontSize: '0.8rem', fontWeight: 500,
            textDecoration: 'none',
            transition: 'background 0.1s',
            fontFamily: 'Inter, sans-serif',
          }}
          title="Innovation Features Demo"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <span>✨</span>
          <span>Innovation</span>
        </a>
        
        {/* Settings button */}
        <button
          onClick={onSettingsOpen}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: '100%', border: 'none',
            background: 'transparent', color: C.textMut, cursor: 'pointer',
            transition: 'background 0.1s, color 0.1s',
          }}
          title="Settings (⌘,)"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLElement).style.color = C.textSec;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = C.textMut;
          }}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
