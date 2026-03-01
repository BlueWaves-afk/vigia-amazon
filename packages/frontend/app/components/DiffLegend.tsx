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
      background: '#FFFFFF',
      border: '1px solid #CBD5E1',
      borderRadius: 4,
      padding: 12,
      minWidth: 200,
      zIndex: 10,
      fontFamily: 'Inter, sans-serif',
      pointerEvents: 'auto',
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 8, color: '#1E293B' }}>
        DIFF ANALYSIS
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
          <span style={{ color: '#64748B' }}>New: {diffState.summary.totalNew}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }} />
          <span style={{ color: '#64748B' }}>Fixed: {diffState.summary.totalFixed}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
          <span style={{ color: '#64748B' }}>Worsened: {diffState.summary.totalWorsened}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={clearDiff}
          style={{
            flex: 1,
            padding: '6px 12px',
            fontSize: '0.7rem',
            fontWeight: 500,
            background: '#F5F5F5',
            border: '1px solid #CBD5E1',
            borderRadius: 3,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
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
            padding: '6px 12px',
            fontSize: '0.7rem',
            fontWeight: 500,
            background: '#3B82F6',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Export
        </button>
      </div>
    </div>
  );
}
