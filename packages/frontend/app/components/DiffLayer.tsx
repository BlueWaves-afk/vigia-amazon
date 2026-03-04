'use client';

import { useMapFileStore } from '@/stores/mapFileStore';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

const FONT_UI   = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

// Map marker colors — inlined into DOM elements so must stay as raw hex/rgb
const CLR_NEW      = '#F0606C'; // matches --c-red
const CLR_FIXED    = '#34D492'; // matches --c-green
const CLR_WORSENED = '#E0A040'; // matches --c-yellow

export function DiffLayer({ map }: { map: maplibregl.Map | null }) {
  const { diffState, clearDiff } = useMapFileStore();
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!map || !diffState) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const makeEl = (color: string, title: string) => {
      const el = document.createElement('div');
      el.title = title;
      el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.25);box-shadow:0 0 6px ${color}80;`;
      return el;
    };

    diffState.changes.new.forEach(hazard => {
      const el = makeEl(CLR_NEW, `New: ${hazard.type} (Severity ${hazard.severity})`);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([parseFloat(hazard.geohash.substring(0, 3)), parseFloat(hazard.geohash.substring(3))])
        .addTo(map);
      markersRef.current.push(marker);
    });

    diffState.changes.fixed.forEach(hazard => {
      const el = makeEl(CLR_FIXED, `Fixed: ${hazard.type}`);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([parseFloat(hazard.geohash.substring(0, 3)), parseFloat(hazard.geohash.substring(3))])
        .addTo(map);
      markersRef.current.push(marker);
    });

    diffState.changes.worsened.forEach(({ before, after }) => {
      const el = makeEl(CLR_WORSENED, `Worsened: ${after.type} (${before.severity} → ${after.severity})`);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([parseFloat(after.geohash.substring(0, 3)), parseFloat(after.geohash.substring(3))])
        .addTo(map);
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [map, diffState]);

  if (!diffState) return null;

  const btnStyle: React.CSSProperties = {
    fontSize: '0.70rem', padding: '4px 10px',
    background: 'var(--c-hover)', border: '1px solid var(--c-border)',
    borderRadius: 4, cursor: 'pointer', color: 'var(--c-text-2)',
    fontFamily: FONT_UI, transition: 'background var(--dur-fast), color var(--dur-fast)',
  };

  return (
    <div style={{
      position: 'absolute', top: 16, left: 16, zIndex: 10,
      background: 'var(--c-elevated)', border: '1px solid var(--c-border-md)',
      borderRadius: 6, padding: 12, boxShadow: 'var(--shadow-md)',
      fontFamily: FONT_UI, minWidth: 200,
    }}>
      <div style={{ fontSize: '0.60rem', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 8 }}>
        Diff Analysis
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        {[
          { color: CLR_NEW,      label: `+${diffState.summary.totalNew} New`                          },
          { color: CLR_FIXED,    label: `-${diffState.summary.totalFixed} Fixed`                       },
          { color: CLR_WORSENED, label: `${diffState.summary.totalWorsened} Worsened`                  },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.70rem', color: 'var(--c-text-2)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '0.70rem', color: 'var(--c-text-2)', marginBottom: 10 }}>
        Net change:{' '}
        <span style={{
          fontFamily: FONT_MONO, fontWeight: 600,
          color: diffState.summary.netChange > 0 ? CLR_NEW : diffState.summary.netChange < 0 ? CLR_FIXED : 'var(--c-text-2)',
        }}>
          {diffState.summary.netChange > 0 ? '+' : ''}{diffState.summary.netChange}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          style={btnStyle}
          onClick={clearDiff}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover-md)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)';    (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)'; }}
        >
          Clear
        </button>
        <button
          style={{ ...btnStyle, background: 'var(--c-accent-glow)', color: 'var(--c-accent-2)', borderColor: 'var(--c-accent-glow-strong)' }}
          onClick={() => {
            const blob = new Blob([JSON.stringify(diffState, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `diff-${Date.now()}.json`; a.click();
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(92,143,248,0.28)'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-accent-glow)'}
        >
          Export
        </button>
      </div>
    </div>
  );
}
