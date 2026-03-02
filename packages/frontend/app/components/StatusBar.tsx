'use client';

import { User, CheckCircle, AlertTriangle, Cpu, Wifi, Activity, GitBranch } from 'lucide-react';

function StatusItem({ children, borderLeft = true, accentBg = false }: {
  children: React.ReactNode; borderLeft?: boolean; accentBg?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 11px', height: '100%', flexShrink: 0,
      borderLeft: borderLeft ? '1px solid var(--c-border)' : undefined,
      background: accentBg ? 'var(--c-accent)' : 'transparent',
    }}>
      {children}
    </div>
  );
}

const S = { fontSize: '0.64rem', fontFamily: 'IBM Plex Sans, sans-serif', color: 'var(--c-text-2)' } as const;
const M = { fontSize: '0.64rem', fontFamily: 'IBM Plex Mono, monospace',  color: 'var(--c-text-2)' } as const;

export function StatusBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 24, flexShrink: 0, userSelect: 'none',
      background: 'var(--c-deep)',
      borderTop: '1px solid var(--c-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <StatusItem borderLeft={false} accentBg>
          <User size={10} style={{ color: '#fff' }} />
          <span style={{ ...S, color: '#fff', fontWeight: 500 }}>user</span>
        </StatusItem>
        <StatusItem>
          <GitBranch size={10} style={{ color: 'var(--c-rose)', opacity: 0.8 }} />
          <span style={M}>main</span>
        </StatusItem>
        <StatusItem>
          <CheckCircle size={10} style={{ color: 'var(--c-green)' }} />
          <span style={S}>No errors</span>
        </StatusItem>
        <StatusItem>
          <AlertTriangle size={10} style={{ color: 'var(--c-yellow)' }} />
          <span style={S}>7 hazards</span>
        </StatusItem>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <StatusItem>
          <Activity size={10} style={{ color: 'var(--c-text-3)' }} />
          <span style={M}>48 nodes</span>
        </StatusItem>
        <StatusItem>
          <Cpu size={10} style={{ color: 'var(--c-text-3)' }} />
          <span style={M}>ONNX · Active</span>
        </StatusItem>
        <StatusItem>
          <Wifi size={10} style={{ color: 'var(--c-text-3)' }} />
          <span style={M}>8ms</span>
        </StatusItem>
        <StatusItem>
          <span style={{ ...S, color: 'var(--c-text-3)' }}>UTF-8 · GeoJSON</span>
        </StatusItem>
      </div>
    </div>
  );
}
