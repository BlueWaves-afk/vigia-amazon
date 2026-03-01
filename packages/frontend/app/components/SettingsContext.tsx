'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type Theme    = 'dark' | 'darker' | 'high-contrast';
export type MapStyle = 'dark-osm' | 'satellite' | 'terrain' | 'minimal';
export type Density  = 'compact' | 'default' | 'spacious';

export interface AppSettings {
  theme:      Theme;
  mapStyle:   MapStyle;
  density:    Density;
  showGrid:   boolean;
  showLabels: boolean;
  fontSize:   number;
}

// ─────────────────────────────────────────────
// Theme palettes — what actually changes
// ─────────────────────────────────────────────

const THEMES: Record<Theme, Record<string, string>> = {
  'dark': {
    '--c-bg':        '#0C1016',
    '--c-sidebar':   '#141920',
    '--c-panel':     '#181E27',
    '--c-elevated':  '#1E2530',
    '--c-deep':      '#080B10',
    '--c-border':    'rgba(255,255,255,0.07)',
    '--c-border-md': 'rgba(255,255,255,0.11)',
    '--c-text':      '#DDE3ED',
    '--c-text-2':    '#7C8799',
    '--c-text-3':    '#3D4655',
    '--c-accent':    '#1D4ED8',
    '--c-accent-2':  '#3B82F6',
  },
  'darker': {
    '--c-bg':        '#060810',
    '--c-sidebar':   '#0A0D14',
    '--c-panel':     '#0E1219',
    '--c-elevated':  '#131820',
    '--c-deep':      '#030508',
    '--c-border':    'rgba(255,255,255,0.06)',
    '--c-border-md': 'rgba(255,255,255,0.1)',
    '--c-text':      '#C8D0DC',
    '--c-text-2':    '#5A6475',
    '--c-text-3':    '#2E3545',
    '--c-accent':    '#1D4ED8',
    '--c-accent-2':  '#3B82F6',
  },
  'high-contrast': {
    '--c-bg':        '#000000',
    '--c-sidebar':   '#0A0A0A',
    '--c-panel':     '#111111',
    '--c-elevated':  '#1A1A1A',
    '--c-deep':      '#000000',
    '--c-border':    'rgba(255,255,255,0.18)',
    '--c-border-md': 'rgba(255,255,255,0.28)',
    '--c-text':      '#FFFFFF',
    '--c-text-2':    '#AAAAAA',
    '--c-text-3':    '#555555',
    '--c-accent':    '#4D90FE',
    '--c-accent-2':  '#74AAFF',
  },
};

// Density → spacing multipliers applied as CSS vars
const DENSITY_VARS: Record<Density, Record<string, string>> = {
  'compact':  { '--d-row': '22px', '--d-pad': '6px',  '--d-gap': '4px'  },
  'default':  { '--d-row': '26px', '--d-pad': '8px',  '--d-gap': '6px'  },
  'spacious': { '--d-row': '32px', '--d-pad': '12px', '--d-gap': '10px' },
};

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

interface SettingsCtx {
  settings:  AppSettings;
  update:    (partial: Partial<AppSettings>) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

// ─────────────────────────────────────────────
// Provider — applies CSS vars to :root on change
// ─────────────────────────────────────────────

const DEFAULTS: AppSettings = {
  theme:      'dark',
  mapStyle:   'dark-osm',
  density:    'default',
  showGrid:   false,
  showLabels: true,
  fontSize:   18,
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  const applyToDOM = useCallback((s: AppSettings) => {
    const root = document.documentElement;

    // Apply theme vars
    const palette = THEMES[s.theme];
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v));

    // Apply density vars
    const density = DENSITY_VARS[s.density];
    Object.entries(density).forEach(([k, v]) => root.style.setProperty(k, v));

    // Apply font size
    root.style.setProperty('--d-font-size', `${s.fontSize}px`);
    root.style.fontSize = `${s.fontSize}px`;
  }, []);

  // Apply on mount
  useEffect(() => {
    applyToDOM(settings);
  }, []); // eslint-disable-line

  const update = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      applyToDOM(next);
      return next;
    });
  }, [applyToDOM]);

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}
