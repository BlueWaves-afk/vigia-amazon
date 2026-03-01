'use client';

import { useState } from 'react';
import { AgentTracesTab } from './AgentTracesTab';
import { DePINLedgerTab } from './DePINLedgerTab';

interface InnovationConsolePanelProps {
  sessionId: string;
}

export function InnovationConsolePanel({ sessionId }: InnovationConsolePanelProps) {
  const [activeTab, setActiveTab] = useState<'traces' | 'ledger'>('traces');

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      <div className="flex border-b border-[#CBD5E1] bg-[#252526]">
        <button
          onClick={() => setActiveTab('traces')}
          className={`px-4 py-2 text-xs font-medium ${
            activeTab === 'traces'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Agent Traces
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 text-xs font-medium ${
            activeTab === 'ledger'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          DePIN Ledger
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'traces' && <AgentTracesTab />}
        {activeTab === 'ledger' && <DePINLedgerTab sessionId={sessionId} />}
      </div>
    </div>
  );
}
