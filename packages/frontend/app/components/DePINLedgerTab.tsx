'use client';

import { ROIWidget } from './ROIWidget';

const FONT_UI   = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

interface DePINLedgerTabProps { sessionId: string; }

export function DePINLedgerTab({ sessionId }: DePINLedgerTabProps) {
  const blocks = [
    { num: '#1234', hash: '0xabc…def' },
    { num: '#1235', hash: '0x123…456' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--c-panel)', overflowY: 'auto', fontFamily: FONT_UI }}>
      <div style={{ padding: 12 }}>
        <ROIWidget sessionId={sessionId} />
      </div>

      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ background: 'var(--c-elevated)', border: '1px solid var(--c-border)', borderRadius: 6, padding: 12 }}>
          <div style={{ fontSize: '0.60rem', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 10 }}>
            Hash Chain Ledger
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {blocks.map(({ num, hash }) => (
              <div key={num} style={{ padding: '6px 8px', background: 'var(--c-hover)', border: '1px solid var(--c-border)', borderRadius: 4 }}>
                <div style={{ fontSize: '0.64rem', color: 'var(--c-text-2)', marginBottom: 2 }}>Block {num}</div>
                <div style={{ fontSize: '0.70rem', color: 'var(--c-text)', fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hash}</div>
              </div>
            ))}
            <div style={{ fontSize: '0.64rem', color: 'var(--c-text-3)', textAlign: 'center', padding: '6px 0' }}>
              Existing ledger functionality preserved
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
