'use client';

import { ChevronRight, Globe } from 'lucide-react';

export function Breadcrumb({ path }: { path: string[] }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 25,
      padding: '0 12px', flexShrink: 0, userSelect: 'none',
      background: 'var(--c-sidebar)',
      borderBottom: '1px solid var(--c-border)',
      gap: 2,
    }}>
      <Globe size={9} style={{ color: 'var(--c-text-3)', marginRight: 5, flexShrink: 0 }} />
      {path.filter(Boolean).map((seg, i, arr) => (
        <span key={`${seg}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{
            fontSize: '0.65rem',
            fontFamily: 'IBM Plex Sans, sans-serif',
            color: i === arr.length - 1 ? 'var(--c-text-2)' : 'var(--c-text-3)',
            fontWeight: i === arr.length - 1 ? 500 : 400,
            cursor: i < arr.length - 1 ? 'pointer' : 'default',
            transition: 'color 0.1s',
          }}
          onMouseEnter={(e) => { if (i < arr.length - 1) (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)'; }}
          onMouseLeave={(e) => { if (i < arr.length - 1) (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)'; }}
          >
            {seg}
          </span>
          {i < arr.length - 1 && (
            <ChevronRight size={8} style={{ color: 'var(--c-rose)', opacity: 0.45, flexShrink: 0 }} />
          )}
        </span>
      ))}
    </div>
  );
}
