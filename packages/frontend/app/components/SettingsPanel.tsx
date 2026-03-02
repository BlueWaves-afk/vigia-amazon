'use client';

import { useEffect, useRef } from 'react';
import {
  X, Sun, Moon, Monitor, Layers, Type,
  Grid, Sliders, Check, Eye,
} from 'lucide-react';
import { useSettings, Theme, MapStyle, Density } from './SettingsContext';

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '0.6rem', color: 'var(--c-text-3)',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      fontWeight: 600, padding: '16px 16px 6px',
      fontFamily: 'Inter, sans-serif',
    }}>
      {label}
    </div>
  );
}

function OptionPill({ label, active, onClick, icon }: {
  label: string; active: boolean;
  onClick: () => void; icon?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 5, padding: '5px 8px', borderRadius: 4, flex: 1,
      border: `1px solid ${active ? 'rgba(59,130,246,0.5)' : 'var(--c-border)'}`,
      background: active ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
      color: active ? 'var(--c-accent-2)' : 'var(--c-text-2)',
      fontSize: '0.7rem', cursor: 'pointer',
      fontFamily: 'Inter, sans-serif',
      transition: 'all 0.12s',
    }}
    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
    >
      {icon}{label}
      {active && <Check size={9} style={{ marginLeft: 2 }} />}
    </button>
  );
}

function ToggleRow({ label, sublabel, value, onChange, icon }: {
  label: string; sublabel?: string;
  value: boolean; onChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div onClick={() => onChange(!value)} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px', cursor: 'pointer',
    }}
    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ color: 'var(--c-text-3)' }}>{icon}</span>}
        <div>
          <div style={{ fontSize: '0.76rem', color: 'var(--c-text)', fontFamily: 'Inter, sans-serif' }}>{label}</div>
          {sublabel && <div style={{ fontSize: '0.64rem', color: 'var(--c-text-3)', fontFamily: 'Inter, sans-serif', marginTop: 1 }}>{sublabel}</div>}
        </div>
      </div>
      <div className="vigia-toggle" style={{ background: value ? 'var(--c-accent)' : 'rgba(255,255,255,0.1)' }}>
        <div className="vigia-toggle-thumb" style={{ transform: value ? 'translateX(14px)' : 'translateX(2px)' }} />
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, unit = '', onChange }: {
  label: string; value: number; min: number; max: number;
  step: number; unit?: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ padding: '8px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.76rem', color: 'var(--c-text)', fontFamily: 'Inter, sans-serif' }}>{label}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--c-accent-2)', fontFamily: 'JetBrains Mono, monospace' }}>
          {value}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: 4 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'var(--c-accent)', borderRadius: 2, transition: 'width 0.1s' }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: '100%' }}
        />
      </div>
    </div>
  );
}

const MAP_STYLES: { id: MapStyle; label: string; preview: string }[] = [
  { id: 'dark-osm',  label: 'Dark',      preview: 'linear-gradient(135deg,#0C1016 0%,#1A2235 100%)' },
  { id: 'satellite', label: 'Satellite', preview: 'linear-gradient(135deg,#1a2a1a 0%,#2a3d1a 100%)' },
  { id: 'terrain',   label: 'Terrain',   preview: 'linear-gradient(135deg,#1e1a14 0%,#2e2810 100%)' },
  { id: 'minimal',   label: 'Minimal',   preview: 'linear-gradient(135deg,#141920 0%,#1c2333 100%)' },
];

// ─────────────────────────────────────────────
// SettingsPanel — reads/writes via context
// ─────────────────────────────────────────────

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, update } = useSettings();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div ref={overlayRef} className="settings-overlay fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="settings-panel slide-in-right">

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', height: 40, flexShrink: 0,
          borderBottom: '1px solid var(--c-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={13} style={{ color: 'var(--c-accent-2)' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--c-text)', fontFamily: 'Inter, sans-serif' }}>
              Settings
            </span>
          </div>
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: 3, border: 'none',
            background: 'transparent', color: 'var(--c-text-3)', cursor: 'pointer', transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)'; }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── Appearance ──────────────── */}
          <SectionLabel label="Appearance" />

          <div style={{ padding: '0 16px 10px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-2)', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>Color Theme</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <OptionPill label="Dark"    active={settings.theme === 'dark'}           onClick={() => update({ theme: 'dark' })}           icon={<Moon   size={10} />} />
              <OptionPill label="Darker"  active={settings.theme === 'darker'}         onClick={() => update({ theme: 'darker' })}         icon={<Monitor size={10} />} />
              <OptionPill label="Light"   active={settings.theme === 'light'}          onClick={() => update({ theme: 'light' })}          icon={<Sun    size={10} />} />
              <OptionPill label="Hi-Con"  active={settings.theme === 'high-contrast'}  onClick={() => update({ theme: 'high-contrast' })}  icon={<Eye    size={10} />} />
            </div>
          </div>

          <div style={{ padding: '0 16px 10px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--c-text-2)', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>UI Density</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <OptionPill label="Compact"  active={settings.density === 'compact'}  onClick={() => update({ density: 'compact' })}  />
              <OptionPill label="Default"  active={settings.density === 'default'}  onClick={() => update({ density: 'default' })}  />
              <OptionPill label="Spacious" active={settings.density === 'spacious'} onClick={() => update({ density: 'spacious' })} />
            </div>
          </div>

          <SliderRow
            label="Font Size" value={settings.fontSize}
            min={11} max={16} step={1} unit="px"
            onChange={(v) => update({ fontSize: v })}
          />

          {/* ── Map ─────────────────────── */}
          <div style={{ height: 1, background: 'var(--c-border)', margin: '8px 0' }} />
          <SectionLabel label="Map" />

          <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MAP_STYLES.map((s) => {
              const active = settings.mapStyle === s.id;
              return (
                <button key={s.id} onClick={() => update({ mapStyle: s.id })} style={{
                  display: 'flex', flexDirection: 'column', gap: 6, padding: 8,
                  borderRadius: 4, cursor: 'pointer', position: 'relative', flex: 1,
                  border: `1px solid ${active ? 'rgba(59,130,246,0.5)' : 'var(--c-border)'}`,
                  background: active ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                >
                  <div style={{ height: 32, borderRadius: 3, background: s.preview, border: '1px solid rgba(255,255,255,0.06)' }} />
                  <span style={{ fontSize: '0.65rem', color: active ? 'var(--c-accent-2)' : 'var(--c-text-2)', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
                    {s.label}
                  </span>
                  {active && (
                    <div style={{
                      position: 'absolute', top: 5, right: 5,
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'var(--c-accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={8} style={{ color: '#fff' }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <ToggleRow
            label="Show Grid Lines" sublabel="Coordinate overlay on map"
            value={settings.showGrid}   onChange={(v) => update({ showGrid: v })}
            icon={<Grid size={13} />}
          />
          <ToggleRow
            label="Show Map Labels" sublabel="Street and place names"
            value={settings.showLabels} onChange={(v) => update({ showLabels: v })}
            icon={<Type size={13} />}
          />

          {/* ── Data ────────────────────── */}
          <div style={{ height: 1, background: 'var(--c-border)', margin: '8px 0' }} />
          <SectionLabel label="Data" />
          <ToggleRow label="Auto-fetch Hazards" sublabel="Poll every 30s" value={true} onChange={() => {}} icon={<Eye size={13} />} />
          <ToggleRow label="Show Unverified" sublabel="Red markers on map" value={true} onChange={() => {}} icon={<Layers size={13} />} />

          {/* Reset */}
          <div style={{ height: 1, background: 'var(--c-border)', margin: '8px 0' }} />
          <div style={{ padding: '12px 16px 20px' }}>
            <button
              onClick={() => update({ theme: 'dark', mapStyle: 'dark-osm', density: 'default', showGrid: false, showLabels: true, fontSize: 18 })}
              style={{
                width: '100%', padding: '7px 0', borderRadius: 4,
                border: '1px solid var(--c-border)', background: 'rgba(255,255,255,0.02)',
                color: 'var(--c-text-2)', fontSize: '0.72rem', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)'; }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--c-border)', padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--c-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
            VIGIA v1.0 · settings.json
          </span>
          <button onClick={onClose} style={{
            padding: '4px 12px', borderRadius: 3,
            border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)',
            color: 'var(--c-accent-2)', fontSize: '0.72rem', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.18)'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)'}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
