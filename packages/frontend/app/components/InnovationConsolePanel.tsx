'use client';

import { useState } from 'react';
import { AgentTracesTab } from './AgentTracesTab';
import { DePINLedgerTab } from './DePINLedgerTab';

const FONT_UI = "'IBM Plex Sans', system-ui, sans-serif";

interface InnovationConsolePanelProps { sessionId: string; }

export function InnovationConsolePanel({ sessionId }: InnovationConsolePanelProps) {
  const [activeTab, setActiveTab] = useState<'traces' | 'ledger'>('traces');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--c-panel)' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--c-border)',
        background: 'var(--c-sidebar)', flexShrink: 0,
      }}>
        {(['traces', 'ledger'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0 14px', height: 34, fontSize: '0.72rem', fontWeight: active ? 600 : 400,
                color: active ? 'var(--c-text)' : 'var(--c-text-2)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: active ? '2px solid var(--c-accent-2)' : '2px solid transparent',
                fontFamily: FONT_UI, transition: 'color var(--dur-fast), border-color var(--dur-fast)',
                position: 'relative', top: 1,
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)'; }}
            >
              {tab === 'traces' ? 'Agent Traces' : 'DePIN Ledger'}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'traces' && <AgentTracesTab />}
        {activeTab === 'ledger' && <DePINLedgerTab sessionId={sessionId} />}
      </div>
    </div>
  );
}
