'use client';

import { useAgentTraceStore } from '@/stores/agentTraceStore';
import type { ReActStep } from '@/types/shared';
import { useEffect, useState } from 'react';

export function AgentTracesTab() {
  const { traces, filter, isStreaming, setFilter, connectSSE, disconnectSSE } = useAgentTraceStore();
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Connect to SSE stream on mount
    connectSSE('/api/agent-traces/stream');

    return () => {
      disconnectSSE();
    };
  }, [connectSSE, disconnectSSE]);

  const filteredTraces = filter
    ? traces.filter(t => 
        t.geohash.includes(filter) || 
        t.contributorId.includes(filter)
      )
    : traces;

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      <div className="p-3 border-b border-[#CBD5E1] bg-[#252526] flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            placeholder="Filter by geohash or contributor ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-2 py-1 text-xs bg-[#3C3C3C] border border-[#CBD5E1] rounded text-white font-mono"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="text-xs px-2 py-1 bg-[#3C3C3C] border border-[#CBD5E1] rounded text-white hover:bg-[#4C4C4C]"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3"
            />
            Auto-scroll
          </label>
          <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-[#10B981]' : 'bg-gray-500'}`} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredTraces.length > 0 ? (
          <div className="p-3">
            {filteredTraces.map((trace, index) => {
              const timestamp = new Date(trace.timestamp).toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3,
              });

              return (
                <div key={index} className="mb-4 px-3 py-2 border-b border-[#CBD5E1] font-mono text-xs">
                  <div className="text-gray-500 mb-1">
                    {timestamp} | Trace #{trace.traceId.slice(-8)}
                  </div>
                  {trace.steps.map((step: ReActStep, i: number) => (
                    <div key={i} className="ml-2 mb-2">
                      {step.thought && (
                        <div className="text-gray-600 italic">
                          ├─ Thought: "{step.thought}"
                        </div>
                      )}
                      {step.action && (
                        <div className="text-white font-medium">
                          ├─ Action: <span className="text-blue-400">{step.action}</span>
                          {Object.keys(step.actionInput).length > 0 && (
                            <span className="text-gray-500">({JSON.stringify(step.actionInput)})</span>
                          )}
                        </div>
                      )}
                      {step.observation && (
                        <div className="text-gray-400">
                          ├─ Observation: "{step.observation}"
                        </div>
                      )}
                      {step.finalAnswer && (
                        <div className="text-[#10B981] font-medium">
                          └─ Final Answer: "{step.finalAnswer}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-gray-500">
            {isStreaming ? 'Waiting for traces...' : 'Not connected to trace stream'}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[#CBD5E1] bg-[#252526] text-xs text-gray-500 font-mono">
        {filteredTraces.length} traces {filter && `(filtered from ${traces.length})`}
      </div>
    </div>
  );
}
