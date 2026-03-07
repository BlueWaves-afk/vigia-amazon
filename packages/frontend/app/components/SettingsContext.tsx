'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type Theme    = 'dark' | 'darker' | 'high-contrast' | 'light';
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

const THEMES: Record<Theme, Record<string, string>> = {
  // ── Dark ── Midnight blue, clearly legible secondary text
  'dark': {
    '--c-bg':         '#080C13',
    '--c-sidebar':    '#0D1219',
    '--c-panel':      '#111720',
    '--c-elevated':   '#172030',
    '--c-deep':       '#050709',
    '--c-border':     'rgba(255,255,255,0.07)',
    '--c-border-md':  'rgba(255,255,255,0.12)',
    '--c-border-hi':  'rgba(255,255,255,0.22)',
    // Text: primary bright, secondary clearly readable, tertiary visible
    '--c-text':       '#E2EAF6',
    '--c-text-2':     '#7A90AA',
    '--c-text-3':     '#445566',
    '--c-accent':     'var(--v-accent)',
    '--c-accent-2':   'var(--v-accent-hover)',
    '--c-accent-glow':'var(--v-accent-glow)',
    '--c-rose':        'var(--v-rose)',
    '--c-rose-2':      'var(--v-rose)',
    '--c-rose-dim':   'var(--v-rose-dim)',
    '--c-rose-glow':  'var(--v-rose-dim)',
    '--c-rose-border':'var(--v-rose-border)',
    '--c-green':      '#34D492',
    '--c-green-dim':  'rgba(52,212,146,0.13)',
    '--c-red':        '#F0606C',
    '--c-red-dim':    'rgba(240,96,108,0.13)',
    '--c-yellow':     '#E0A040',
    '--c-yellow-dim': 'rgba(224,160,64,0.13)',
    '--c-input':      '#0B1018',
    '--c-hover':      'rgba(255,255,255,0.06)',
    '--c-overlay':    'rgba(8,12,19,0.90)',
  },
  // ── Darker ── True black base, boosted text contrast
  'darker': {
    '--c-bg':         '#04060A',
    '--c-sidebar':    '#07090F',
    '--c-panel':      '#0A0D16',
    '--c-elevated':   '#0F1522',
    '--c-deep':       '#020305',
    '--c-border':     'rgba(255,255,255,0.08)',
    '--c-border-md':  'rgba(255,255,255,0.13)',
    '--c-border-hi':  'rgba(255,255,255,0.22)',
    '--c-text':       '#DCE8F8',
    '--c-text-2':     '#6E88A0',
    '--c-text-3':     '#3D5060',
    '--c-accent':     'var(--v-accent)',
    '--c-accent-2':   'var(--v-accent-hover)',
    '--c-accent-glow':'var(--v-accent-glow)',
    '--c-rose':        'var(--v-rose)',
    '--c-rose-2':      'var(--v-rose)',
    '--c-rose-dim':   'var(--v-rose-dim)',
    '--c-rose-glow':  'var(--v-rose-dim)',
    '--c-rose-border':'var(--v-rose-border)',
    '--c-green':      '#30C888',
    '--c-green-dim':  'rgba(48,200,136,0.13)',
    '--c-red':        '#E85864',
    '--c-red-dim':    'rgba(232,88,100,0.13)',
    '--c-yellow':     '#D89830',
    '--c-yellow-dim': 'rgba(216,152,48,0.13)',
    '--c-input':      '#060810',
    '--c-hover':      'rgba(255,255,255,0.06)',
    '--c-overlay':    'rgba(4,6,10,0.93)',
  },
  // ── High Contrast ── Maximum legibility
  'high-contrast': {
    '--c-bg':         '#000000',
    '--c-sidebar':    '#080808',
    '--c-panel':      '#101010',
    '--c-elevated':   '#1A1A1A',
    '--c-deep':       '#000000',
    '--c-border':     'rgba(255,255,255,0.22)',
    '--c-border-md':  'rgba(255,255,255,0.36)',
    '--c-border-hi':  'rgba(255,255,255,0.60)',
    '--c-text':       '#FFFFFF',
    '--c-text-2':     '#C8D4E4',
    '--c-text-3':     '#7890A8',
    '--c-accent':     '#4D8FF5',
    '--c-accent-2':   '#82B4FF',
    '--c-accent-glow':'rgba(130,180,255,0.20)',
    '--c-rose':        '#C09ACC',
    '--c-rose-2':      '#D4B4E0',
    '--c-rose-dim':   'rgba(192,154,204,0.16)',
    '--c-rose-glow':  'rgba(192,154,204,0.28)',
    '--c-rose-border':'rgba(192,154,204,0.40)',
    '--c-green':      '#44E8AA',
    '--c-green-dim':  'rgba(68,232,170,0.16)',
    '--c-red':        '#FF7080',
    '--c-red-dim':    'rgba(255,112,128,0.16)',
    '--c-yellow':     '#FFD060',
    '--c-yellow-dim': 'rgba(255,208,96,0.16)',
    '--c-input':      '#0A0A0A',
    '--c-hover':      'rgba(255,255,255,0.09)',
    '--c-overlay':    'rgba(0,0,0,0.95)',
  },
  // ── Light ── Clean paper white
  'light': {
    '--c-bg':         '#F4F7FC',
    '--c-sidebar':    '#ECF0F8',
    '--c-panel':      '#FFFFFF',
    '--c-elevated':   '#EEF2FA',
    '--c-deep':       '#E2E8F4',
    '--c-border':     'rgba(0,0,0,0.08)',
    '--c-border-md':  'rgba(0,0,0,0.14)',
    '--c-border-hi':  'rgba(0,0,0,0.24)',
    '--c-text':       '#18253A',
    '--c-text-2':     '#445268',
    '--c-text-3':     '#8090A8',
    '--c-accent':     'var(--v-accent)',
    '--c-accent-2':   'var(--v-accent-hover)',
    '--c-accent-glow':'var(--v-accent-glow)',
    '--c-rose':        'var(--v-rose)',
    '--c-rose-2':      'var(--v-rose)',
    '--c-rose-dim':   'var(--v-rose-dim)',
    '--c-rose-glow':  'var(--v-rose-dim)',
    '--c-rose-border':'var(--v-rose-border)',
    '--c-green':      '#0A7A50',
    '--c-green-dim':  'rgba(10,122,80,0.1)',
    '--c-red':        '#B42030',
    '--c-red-dim':    'rgba(180,32,48,0.1)',
    '--c-yellow':     '#9A6010',
    '--c-yellow-dim': 'rgba(154,96,16,0.1)',
    '--c-input':      '#FFFFFF',
    '--c-hover':      'rgba(0,0,0,0.05)',
    '--c-overlay':    'rgba(255,255,255,0.92)',
  },
};

const DENSITY_VARS: Record<Density, Record<string, string>> = {
  'compact':  { '--d-row': '24px', '--d-pad': '6px',  '--d-gap': '5px'  },
  'default':  { '--d-row': '27px', '--d-pad': '9px',  '--d-gap': '6px'  },
  'spacious': { '--d-row': '34px', '--d-pad': '13px', '--d-gap': '10px' },
};

interface SettingsCtx {
  settings: AppSettings;
  update:   (partial: Partial<AppSettings>) => void;
  ready:    boolean;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function useSettingsReady() {
  const ctx = useContext(Ctx);
  return ctx?.ready ?? false;
}

const STORAGE_KEY = 'vigia-settings';

const DEFAULTS: AppSettings = {
  theme:      'light',
  mapStyle:   'dark-osm',
  density:    'default',
  showGrid:   false,
  showLabels: true,
  fontSize:   16,
};

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) } as AppSettings;
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  const applyToDOM = useCallback((s: AppSettings) => {
    const root = document.documentElement;
    Object.entries(THEMES[s.theme]).forEach(([k, v]) => root.style.setProperty(k, v));
    Object.entries(DENSITY_VARS[s.density]).forEach(([k, v]) => root.style.setProperty(k, v));
    const fs = Math.max(11, Math.min(24, s.fontSize));
    root.style.setProperty('--d-font-size', `${fs}px`);
    root.style.fontSize = `${fs}px`;
    // Set data-theme attribute so CSS can respond to the active theme
    root.setAttribute('data-theme', s.theme);
    // Per-theme body rendering tweaks
    const body = document.body;
    const smoothing = s.theme === 'light' ? 'auto' : 'antialiased';
    (body.style as any)['-webkit-font-smoothing'] = smoothing;
    body.style.setProperty('-webkit-font-smoothing', smoothing);
    root.classList.toggle('vigia-theme-light', s.theme === 'light');
    root.classList.toggle('vigia-theme-dark', s.theme === 'dark' || s.theme === 'darker');
    root.classList.toggle('vigia-theme-hc', s.theme === 'high-contrast');
  }, []);

  // Load persisted settings on first mount
  useEffect(() => {
    const saved = loadSettings();
    setSettings(saved);
    applyToDOM(saved);
    setReady(true);
  }, []); // eslint-disable-line

  const update = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      applyToDOM(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota exceeded */ }
      return next;
    });
  }, [applyToDOM]);

  return <Ctx.Provider value={{ settings, update, ready }}>{children}</Ctx.Provider>;
}
