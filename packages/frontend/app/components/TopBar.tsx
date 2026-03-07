'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Settings, AlertTriangle, Activity, Command, Search } from 'lucide-react';

type SidebarActivity = 'explorer' | 'detection' | 'network' | 'maintenance';
type ConsoleTab = 'traces' | 'ledger' | 'console';
type TopMenu = 'File' | 'View' | 'Analysis' | 'Ledger' | 'Help';

interface TopBarProps {
  onSettingsOpen?: () => void;
  onCommandOpen?:  () => void;
  onNewSession?: () => void;
  onSaveSession?: () => void;
  onActivityChange?: (activity: SidebarActivity) => void;
  onConsoleTab?: (tab: ConsoleTab) => void;
  onDropPinA?: () => void;
  onDropPinB?: () => void;
  onCalculateRoute?: () => void;
}

export function TopBar({
  onSettingsOpen,
  onCommandOpen,
  onNewSession,
  onSaveSession,
  onActivityChange,
  onConsoleTab,
  onDropPinA,
  onDropPinB,
  onCalculateRoute,
}: TopBarProps) {
  const headerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [openMenu, setOpenMenu] = useState<TopMenu | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [metrics, setMetrics] = useState({ hazards: 0, nodes: 0 });

  // Fetch metrics from API
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics/dashboard');
        if (res.ok) {
          const data = await res.json();
          setMetrics({
            hazards: data.hazards?.total || 0,
            nodes: data.network?.activeNodes || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch topbar metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = useMemo(() => {
    type Item =
      | { type: 'sep' }
      | { type: 'item'; label: string; shortcut?: string; disabled?: boolean; action?: () => void };

    const safe = (fn?: () => void) => () => fn?.();

    const items: Record<TopMenu, Item[]> = {
      File: [
        { type: 'item', label: 'New Session', shortcut: '⌘N', action: safe(onNewSession), disabled: !onNewSession },
        { type: 'item', label: 'Save Session', shortcut: '⌘S', action: safe(onSaveSession), disabled: !onSaveSession },
        { type: 'sep' },
        { type: 'item', label: 'Command Palette', shortcut: '⌘K', action: safe(onCommandOpen), disabled: !onCommandOpen },
        { type: 'item', label: 'Settings', shortcut: '⌘,', action: safe(onSettingsOpen), disabled: !onSettingsOpen },
      ],
      View: [
        { type: 'item', label: 'Explorer', action: () => onActivityChange?.('explorer'), disabled: !onActivityChange },
        { type: 'item', label: 'Detection', action: () => onActivityChange?.('detection'), disabled: !onActivityChange },
        { type: 'item', label: 'Network Map', action: () => onActivityChange?.('network'), disabled: !onActivityChange },
        { type: 'item', label: 'Maintenance', action: () => onActivityChange?.('maintenance'), disabled: !onActivityChange },
      ],
      Analysis: [
        { type: 'item', label: 'Route Planning', disabled: true },
        { type: 'item', label: '  Drop Pin A', action: safe(onDropPinA), disabled: !onDropPinA },
        { type: 'item', label: '  Drop Pin B', action: safe(onDropPinB), disabled: !onDropPinB },
        { type: 'item', label: '  Calculate Route', action: safe(onCalculateRoute), disabled: !onCalculateRoute },
        { type: 'sep' },
        { type: 'item', label: 'Network Analysis', action: () => onActivityChange?.('network'), disabled: !onActivityChange },
        { type: 'item', label: 'Maintenance Priority', action: () => onActivityChange?.('maintenance'), disabled: !onActivityChange },
      ],
      Ledger: [
        { type: 'item', label: 'Agent Traces', action: () => onConsoleTab?.('traces'), disabled: !onConsoleTab },
        { type: 'item', label: 'DePIN Ledger', action: () => onConsoleTab?.('ledger'), disabled: !onConsoleTab },
        { type: 'item', label: 'Console', action: () => onConsoleTab?.('console'), disabled: !onConsoleTab },
      ],
      Help: [
        { type: 'item', label: 'Keyboard Shortcuts', shortcut: '⌘K', action: safe(onCommandOpen), disabled: !onCommandOpen },
        { type: 'item', label: 'About VIGIA', disabled: true },
      ],
    };

    return items;
  }, [onActivityChange, onCommandOpen, onConsoleTab, onNewSession, onSaveSession, onSettingsOpen, onDropPinA, onDropPinB, onCalculateRoute]);

  useEffect(() => {
    if (!openMenu) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };

    const onMouseDown = (e: MouseEvent) => {
      const menuEl = menuRef.current;
      if (!menuEl) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('.vigia-menu-item')) return;
      if (menuEl.contains(e.target as Node)) return;
      setOpenMenu(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [openMenu]);

  const openAt = (menu: TopMenu, buttonEl: HTMLElement) => {
    const headerEl = headerRef.current;
    if (!headerEl) return;
    const h = headerEl.getBoundingClientRect();
    const b = buttonEl.getBoundingClientRect();
    const left = Math.max(10, Math.min(h.width - 220, b.left - h.left));
    const top = b.bottom - h.top + 6;
    setMenuPos({ left, top });
    setOpenMenu(menu);
  };

  return (
    <header
      ref={(el) => { headerRef.current = el; }}
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

        </div>

        {/* Menu items — pill hover */}
        {(['File', 'View', 'Analysis', 'Ledger', 'Help'] as TopMenu[]).map((item) => (
          <button
            key={item}
            className="vigia-menu-item"
            style={{
              padding: '0 11px', height: 28, border: 'none',
              background: openMenu === item ? 'var(--v-topbar-menu-hover)' : 'transparent',
              color: openMenu === item ? 'var(--v-topbar-menu-active)' : 'var(--v-topbar-menu)',
              fontSize: '0.72rem', cursor: 'pointer',
              fontFamily: 'var(--v-font-ui)',
              borderRadius: 'var(--v-radius-sm)',
              margin: '0 1px',
              transition: 'background var(--v-transition-fast), color var(--v-transition-fast)',
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const el = e.currentTarget as HTMLElement;
              if (openMenu === item) {
                setOpenMenu(null);
                return;
              }
              openAt(item, el);
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'var(--v-topbar-menu-hover)';
              el.style.color = 'var(--v-topbar-menu-active)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = openMenu === item ? 'var(--v-topbar-menu-hover)' : 'transparent';
              el.style.color = openMenu === item ? 'var(--v-topbar-menu-active)' : 'var(--v-topbar-menu)';
            }}
          >
            {item}
          </button>
        ))}

        {/* Dropdown */}
        {openMenu && menuPos && (
          <div
            ref={(el) => { menuRef.current = el; }}
            style={{
              position: 'absolute',
              left: menuPos.left,
              top: menuPos.top,
              width: 220,
              background: 'var(--v-panel-bg)',
              border: '1px solid var(--v-panel-border)',
              borderRadius: 'var(--v-radius-md)',
              boxShadow: 'var(--shadow-md)',
              padding: 6,
              zIndex: 1200,
            }}
          >
            {menuItems[openMenu].map((it, idx) => {
              if (it.type === 'sep') {
                return (
                  <div
                    key={`sep-${idx}`}
                    style={{ height: 1, background: 'var(--v-panel-border)', margin: '6px 6px' }}
                  />
                );
              }

              const disabled = !!it.disabled;
              return (
                <button
                  key={`${openMenu}-${it.label}-${idx}`}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    it.action?.();
                    setOpenMenu(null);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '7px 8px',
                    border: 'none',
                    borderRadius: 'var(--v-radius-sm)',
                    background: 'transparent',
                    color: disabled ? 'var(--v-text-muted)' : 'var(--v-text-primary)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.70rem',
                    fontFamily: 'var(--v-font-ui)',
                    textAlign: 'left',
                    opacity: disabled ? 0.55 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (disabled) return;
                    (e.currentTarget as HTMLElement).style.background = 'var(--v-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
                  {it.shortcut && (
                    <span style={{
                      fontSize: '0.62rem',
                      fontFamily: 'var(--v-font-mono)',
                      color: 'var(--v-text-muted)',
                      letterSpacing: '0.02em',
                      flexShrink: 0,
                    }}>
                      {it.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
            transition: 'border-color var(--v-transition-fast)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--v-accent-hover)';
            el.style.boxShadow = 'none';
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

        {/* Hazards chip — system accent */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 'var(--v-radius-md)',
          background: 'var(--v-accent-muted)',
          border: '1px solid color-mix(in srgb, var(--v-accent) 35%, transparent)',
        }}>
          <AlertTriangle size={10} style={{ color: 'var(--v-accent-hover)', flexShrink: 0 }} />
          <span style={{
            fontSize: '0.63rem', fontWeight: 600, letterSpacing: '0.01em',
            fontFamily: 'var(--v-font-mono)', color: 'var(--v-accent-hover)',
          }}>
            {metrics.hazards} hazards
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
            {metrics.nodes} nodes
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
