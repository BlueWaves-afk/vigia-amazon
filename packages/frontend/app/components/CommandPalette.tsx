'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, MapPin, Video, Settings, Layers, Database,
  Zap, GitBranch, Moon, Sun, Monitor, Map, Activity,
  ChevronRight, Command,
} from 'lucide-react';
import { useSettings } from './SettingsContext';

// ─────────────────────────────────────────────
// Command definitions
// ─────────────────────────────────────────────

type CommandCategory = 'Navigation' | 'Actions' | 'Settings' | 'Map';

interface Command {
  id:       string;
  label:    string;
  sublabel?: string;
  category: CommandCategory;
  icon:     React.ReactNode;
  kbd?:     string;
  action:   () => void;
}

// ─────────────────────────────────────────────
// Fuzzy match — simple character-subsequence
// ─────────────────────────────────────────────

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ─────────────────────────────────────────────
// Skeleton for loading state
// ─────────────────────────────────────────────

function CmdSkeleton() {
  return (
    <div style={{ padding: '4px 6px' }}>
      {[80, 60, 70, 50].map((w, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 5, marginBottom: 2,
        }}>
          <div className="skeleton skeleton-icon" style={{ flexShrink: 0 }} />
          <div className="skeleton skeleton-text" style={{ width: `${w}%`, flex: 1 }} />
          <div className="skeleton skeleton-badge" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// CommandPalette
// ─────────────────────────────────────────────

interface CommandPaletteProps {
  open:    boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
  onSettingsOpen?: () => void;
}

export function CommandPalette({ open, onClose, onNavigate, onSettingsOpen }: CommandPaletteProps) {
  const { update, settings } = useSettings();
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState(0);
  const [loading,  setLoading]  = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build command list — memoized on settings
  const commands: Command[] = [
    // Navigation
    {
      id: 'nav-map', label: 'Open World Map', sublabel: 'Geo hazard view',
      category: 'Navigation', icon: <MapPin size={14} />, kbd: '⌘1',
      action: () => { onNavigate?.('map'); onClose(); },
    },
    {
      id: 'nav-sentinel', label: 'Open Detection Node', sublabel: 'ONNX video analysis',
      category: 'Navigation', icon: <Video size={14} />, kbd: '⌘2',
      action: () => { onNavigate?.('sentinel'); onClose(); },
    },
    {
      id: 'nav-network', label: 'Open Network Map', sublabel: 'DePIN swarm topology',
      category: 'Navigation', icon: <Activity size={14} />, kbd: '⌘3',
      action: () => { onNavigate?.('network'); onClose(); },
    },

    // Actions
    {
      id: 'act-new-session', label: 'New Session', sublabel: 'Create road survey session',
      category: 'Actions', icon: <Zap size={14} />, kbd: '⌘N',
      action: () => { onClose(); },
    },
    {
      id: 'act-refresh', label: 'Refresh Sessions',
      category: 'Actions', icon: <GitBranch size={14} />,
      action: () => {
        if ((window as any).__refreshSessions) (window as any).__refreshSessions();
        onClose();
      },
    },
    {
      id: 'act-settings', label: 'Open Settings',
      category: 'Actions', icon: <Settings size={14} />, kbd: '⌘,',
      action: () => { onSettingsOpen?.(); onClose(); },
    },

    // Theme
    {
      id: 'theme-dark', label: 'Theme: Dark',
      category: 'Settings', icon: <Moon size={14} />,
      action: () => { update({ theme: 'dark' }); onClose(); },
    },
    {
      id: 'theme-darker', label: 'Theme: Darker',
      category: 'Settings', icon: <Monitor size={14} />,
      action: () => { update({ theme: 'darker' }); onClose(); },
    },
    {
      id: 'theme-hc', label: 'Theme: High Contrast',
      category: 'Settings', icon: <Sun size={14} />,
      action: () => { update({ theme: 'high-contrast' }); onClose(); },
    },
    {
      id: 'theme-light', label: 'Theme: Light',
      category: 'Settings', icon: <Sun size={14} />,
      action: () => { update({ theme: 'light' }); onClose(); },
    },

    // Map
    {
      id: 'map-dark', label: 'Map Style: Dark',
      category: 'Map', icon: <Map size={14} />,
      action: () => { update({ mapStyle: 'dark-osm' }); onClose(); },
    },
    {
      id: 'map-satellite', label: 'Map Style: Satellite',
      category: 'Map', icon: <Layers size={14} />,
      action: () => { update({ mapStyle: 'satellite' }); onClose(); },
    },
    {
      id: 'map-grid-on', label: 'Map: Show Grid',
      category: 'Map', icon: <Database size={14} />,
      action: () => { update({ showGrid: true }); onClose(); },
    },
    {
      id: 'map-grid-off', label: 'Map: Hide Grid',
      category: 'Map', icon: <Database size={14} />,
      action: () => { update({ showGrid: false }); onClose(); },
    },
  ];

  const filtered = commands.filter(c =>
    fuzzyMatch(query, c.label) || fuzzyMatch(query, c.sublabel ?? '') || fuzzyMatch(query, c.category)
  );

  // Group by category
  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    setLoading(true);
    setTimeout(() => setLoading(false), 300);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape')   { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); filtered[selected]?.action(); }
  }, [filtered, selected, onClose]);

  // Global ⌘K listener (also handled in page.tsx but doubled here as safety)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>

        {/* Input */}
        <div className="cmd-input-wrap">
          <Search size={15} style={{ color: 'var(--c-rose)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search commands, sessions, settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'none', border: 'none', color: 'var(--c-text-3)',
                cursor: 'pointer', fontSize: '0.62rem', fontFamily: 'IBM Plex Mono, monospace',
                padding: '2px 6px', borderRadius: 3,
                background: 'var(--c-panel)', border: '1px solid var(--c-border)',
              } as any}
            >
              esc
            </button>
          )}
        </div>

        {/* Results */}
        <div className="cmd-results">
          {loading ? (
            <CmdSkeleton />
          ) : filtered.length === 0 ? (
            <div style={{
              padding: '32px 16px', textAlign: 'center',
              color: 'var(--c-text-3)', fontSize: '0.76rem',
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}>
              No commands match <strong style={{ color: 'var(--c-text-2)' }}>"{query}"</strong>
            </div>
          ) : (
            (() => {
              let globalIdx = 0;
              return Object.entries(grouped).map(([cat, cmds]) => (
                <div key={cat}>
                  <div className="cmd-category">{cat}</div>
                  {cmds.map((cmd) => {
                    const idx = globalIdx++;
                    const isSelected = idx === selected;
                    return (
                      <div
                        key={cmd.id}
                        className={`cmd-item ${isSelected ? 'selected' : ''}`}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelected(idx)}
                      >
                        <span style={{ color: isSelected ? 'var(--c-rose-2)' : 'var(--c-text-3)', flexShrink: 0 }}>
                          {cmd.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: isSelected ? 'var(--c-text)' : 'var(--c-text-2)',
                            fontWeight: isSelected ? 500 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {cmd.label}
                          </div>
                          {cmd.sublabel && (
                            <div style={{ fontSize: '0.62rem', color: 'var(--c-text-3)', marginTop: 1 }}>
                              {cmd.sublabel}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <ChevronRight size={11} style={{ color: 'var(--c-rose)', flexShrink: 0 }} />
                        )}
                        {cmd.kbd && !isSelected && (
                          <span className="cmd-kbd">{cmd.kbd}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>

        {/* Footer */}
        <div className="cmd-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> dismiss</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Command size={9} style={{ color: 'var(--c-rose)' }} />
            <span style={{ color: 'var(--c-rose)', fontWeight: 500 }}>VIGIA</span>
          </span>
        </div>
      </div>
    </div>
  );
}
