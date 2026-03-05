'use client';

import { useMapFileStore } from '../../stores/mapFileStore';

export function DiffLegend() {
  const { diffState, clearDiff } = useMapFileStore();

  if (!diffState) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: 16,
      background: 'var(--c-elevated)',
      border: '1px solid var(--c-border-md)',
      borderRadius: 6,
      padding: 12,
      minWidth: 200,
      zIndex: 10,
      fontFamily: "var(--v-font-ui)",
      pointerEvents: 'auto',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ fontSize: '0.60rem', fontWeight: 600, marginBottom: 10, color: 'var(--c-text-3)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
        Diff Analysis
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--c-red)', boxShadow: '0 0 6px var(--c-red)', flexShrink: 0 }} />
          <span style={{ color: 'var(--c-text-2)' }}>New: <span style={{ color: 'var(--c-text)', fontWeight: 500 }}>{diffState.summary.totalNew}</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--c-green)', boxShadow: '0 0 6px var(--c-green)', flexShrink: 0 }} />
          <span style={{ color: 'var(--c-text-2)' }}>Fixed: <span style={{ color: 'var(--c-text)', fontWeight: 500 }}>{diffState.summary.totalFixed}</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--c-yellow)', boxShadow: '0 0 6px var(--c-yellow)', flexShrink: 0 }} />
          <span style={{ color: 'var(--c-text-2)' }}>Worsened: <span style={{ color: 'var(--c-text)', fontWeight: 500 }}>{diffState.summary.totalWorsened}</span></span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={clearDiff}
          style={{
            flex: 1,
            padding: '5px 10px',
            fontSize: '0.70rem',
            fontWeight: 500,
            background: 'var(--c-hover)',
            border: '1px solid var(--c-border)',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--c-text-2)',
            fontFamily: "var(--v-font-ui)",
            transition: 'background var(--dur-fast), color var(--dur-fast)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover-md)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)'; }}
        >
          Clear
        </button>
        <button
          onClick={() => {
            const data = JSON.stringify(diffState, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diff-${Date.now()}.json`;
            a.click();
          }}
          style={{
            flex: 1,
            padding: '5px 10px',
            fontSize: '0.70rem',
            fontWeight: 500,
            background: 'var(--c-accent-glow)',
            color: 'var(--c-accent-2)',
            border: '1px solid var(--c-accent-glow-strong)',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: "var(--v-font-ui)",
            transition: 'background var(--dur-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--v-accent) 28%, transparent)'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-accent-glow)'}
        >
          Export
        </button>
      </div>
    </div>
  );
}
