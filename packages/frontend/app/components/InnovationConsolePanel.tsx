'use client';

import { useState, useEffect } from 'react';
import { AgentTracesTab } from './AgentTracesTab';
import { DePINLedgerTab } from './DePINLedgerTab';

interface InnovationConsolePanelProps { sessionId: string; }

export function InnovationConsolePanel({ sessionId }: InnovationConsolePanelProps) {
  const [activeTab, setActiveTab] = useState<'traces' | 'ledger'>('traces');

  // Switch to traces tab when "View Reasoning" is clicked from HazardVerificationPanel
  useEffect(() => {
    const handler = () => setActiveTab('traces');
    window.addEventListener('open-agent-traces', handler);
    return () => window.removeEventListener('open-agent-traces', handler);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--v-bg-elevated)' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--v-border-subtle)',
        background: 'var(--v-bg-surface)', flexShrink: 0,
      }}>
        {(['traces', 'ledger'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0 14px', height: 34, fontSize: '0.72rem', fontWeight: active ? 600 : 400,
                color: active ? 'var(--v-text-primary)' : 'var(--v-text-secondary)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: active ? `2px solid var(--v-accent-hover)` : '2px solid transparent',
                fontFamily: 'var(--v-font-ui)', transition: `color var(--v-transition-fast), border-color var(--v-transition-fast)`,
                position: 'relative', top: 1,
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--v-text-primary)'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--v-text-secondary)'; }}
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
