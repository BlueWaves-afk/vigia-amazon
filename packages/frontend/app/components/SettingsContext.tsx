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
  'dark': {
    '--c-bg':         '#0A0E15',
    '--c-sidebar':    '#0F1520',
    '--c-panel':      '#131A24',
    '--c-elevated':   '#192130',
    '--c-deep':       '#060910',
    '--c-border':     'rgba(255,255,255,0.06)',
    '--c-border-md':  'rgba(255,255,255,0.10)',
    '--c-border-hi':  'rgba(255,255,255,0.18)',
    '--c-text':       '#D4DCEC',
    '--c-text-2':     '#5E6E82',
    '--c-text-3':     '#30404E',
    '--c-accent':     '#1840BE',
    '--c-accent-2':   '#4278F5',
    '--c-accent-glow':'rgba(66,120,245,0.14)',
    '--c-rose':        '#7B5482',
    '--c-rose-2':      '#9A72A2',
    '--c-rose-dim':   'rgba(123,84,130,0.10)',
    '--c-rose-glow':  'rgba(123,84,130,0.18)',
    '--c-rose-border':'rgba(123,84,130,0.20)',
    '--c-green':      '#2EBD82',
    '--c-green-dim':  'rgba(46,189,130,0.11)',
    '--c-red':        '#D94F5C',
    '--c-red-dim':    'rgba(217,79,92,0.11)',
    '--c-yellow':     '#C98B34',
    '--c-yellow-dim': 'rgba(201,139,52,0.11)',
  },
  'darker': {
    '--c-bg':         '#05070C',
    '--c-sidebar':    '#080C14',
    '--c-panel':      '#0B1019',
    '--c-elevated':   '#101722',
    '--c-deep':       '#020408',
    '--c-border':     'rgba(255,255,255,0.05)',
    '--c-border-md':  'rgba(255,255,255,0.09)',
    '--c-border-hi':  'rgba(255,255,255,0.15)',
    '--c-text':       '#B8C4D8',
    '--c-text-2':     '#485A6C',
    '--c-text-3':     '#243040',
    '--c-accent':     '#1840BE',
    '--c-accent-2':   '#4278F5',
    '--c-accent-glow':'rgba(66,120,245,0.12)',
    '--c-rose':        '#6A4470',
    '--c-rose-2':      '#856092',
    '--c-rose-dim':   'rgba(106,68,112,0.09)',
    '--c-rose-glow':  'rgba(106,68,112,0.15)',
    '--c-rose-border':'rgba(106,68,112,0.18)',
    '--c-green':      '#28A872',
    '--c-green-dim':  'rgba(40,168,114,0.11)',
    '--c-red':        '#C44450',
    '--c-red-dim':    'rgba(196,68,80,0.11)',
    '--c-yellow':     '#B87C2A',
    '--c-yellow-dim': 'rgba(184,124,42,0.11)',
  },
  'high-contrast': {
    '--c-bg':         '#000000',
    '--c-sidebar':    '#080808',
    '--c-panel':      '#101010',
    '--c-elevated':   '#181818',
    '--c-deep':       '#000000',
    '--c-border':     'rgba(255,255,255,0.20)',
    '--c-border-md':  'rgba(255,255,255,0.34)',
    '--c-border-hi':  'rgba(255,255,255,0.55)',
    '--c-text':       '#FFFFFF',
    '--c-text-2':     '#BBBBBB',
    '--c-text-3':     '#666666',
    '--c-accent':     '#4D8FF5',
    '--c-accent-2':   '#78AAFF',
    '--c-accent-glow':'rgba(120,170,255,0.18)',
    '--c-rose':        '#B090BC',
    '--c-rose-2':      '#CAA8D6',
    '--c-rose-dim':   'rgba(176,144,188,0.15)',
    '--c-rose-glow':  'rgba(176,144,188,0.25)',
    '--c-rose-border':'rgba(176,144,188,0.35)',
    '--c-green':      '#40DCA0',
    '--c-green-dim':  'rgba(64,220,160,0.15)',
    '--c-red':        '#FF6070',
    '--c-red-dim':    'rgba(255,96,112,0.15)',
    '--c-yellow':     '#FFBE4A',
    '--c-yellow-dim': 'rgba(255,190,74,0.15)',
  },
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
    '--c-accent':     '#1840BE',
    '--c-accent-2':   '#2563EB',
    '--c-accent-glow':'rgba(37,99,235,0.1)',
    '--c-rose':        '#5E3A6A',
    '--c-rose-2':      '#7A5488',
    '--c-rose-dim':   'rgba(94,58,106,0.08)',
    '--c-rose-glow':  'rgba(94,58,106,0.14)',
    '--c-rose-border':'rgba(94,58,106,0.20)',
    '--c-green':      '#0A7A50',
    '--c-green-dim':  'rgba(10,122,80,0.1)',
    '--c-red':        '#B42030',
    '--c-red-dim':    'rgba(180,32,48,0.1)',
    '--c-yellow':     '#9A6010',
    '--c-yellow-dim': 'rgba(154,96,16,0.1)',
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
}

const Ctx = createContext<SettingsCtx | null>(null);

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

const DEFAULTS: AppSettings = {
  theme:      'dark',
  mapStyle:   'dark-osm',
  density:    'default',
  showGrid:   false,
  showLabels: true,
  fontSize:   13,
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  const applyToDOM = useCallback((s: AppSettings) => {
    const root = document.documentElement;
    Object.entries(THEMES[s.theme]).forEach(([k, v]) => root.style.setProperty(k, v));
    Object.entries(DENSITY_VARS[s.density]).forEach(([k, v]) => root.style.setProperty(k, v));
    const fs = Math.max(11, Math.min(16, s.fontSize));
    root.style.setProperty('--d-font-size', `${fs}px`);
    root.style.fontSize = `${fs}px`;
    root.classList.toggle('vigia-theme-light', s.theme === 'light');
  }, []);

  useEffect(() => { applyToDOM(settings); }, []); // eslint-disable-line

  const update = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      applyToDOM(next);
      return next;
    });
  }, [applyToDOM]);

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}
