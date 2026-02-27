'use client';

import { useEffect, useState } from 'react';

type ReasoningTrace = {
  traceId: string;
  hazardId: string;
  reasoning: string;
  verificationScore: number;
  createdAt: string;
};

export function ReasoningTraceViewer() {
  const [trace, setTrace] = useState<ReasoningTrace | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrace = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/traces`);
      const data = await response.json();
      if (data.hasData) {
        setTrace(data.trace);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch trace:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrace();
    const interval = setInterval(fetchTrace, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const parseReasoning = (text: string) => {
    if (!text) return [];
    
    // Split by common ReAct patterns
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      
      // Highlight keywords
      if (trimmed.toLowerCase().includes('thought:') || trimmed.toLowerCase().includes('thinking')) {
        return { type: 'thought', text: trimmed, key: i };
      }
      if (trimmed.toLowerCase().includes('action:') || trimmed.toLowerCase().includes('query')) {
        return { type: 'action', text: trimmed, key: i };
      }
      if (trimmed.toLowerCase().includes('observation:') || trimmed.toLowerCase().includes('found')) {
        return { type: 'observation', text: trimmed, key: i };
      }
      if (trimmed.toLowerCase().includes('final') || trimmed.toLowerCase().includes('decision') || trimmed.toLowerCase().includes('score')) {
        return { type: 'decision', text: trimmed, key: i };
      }
      return { type: 'normal', text: trimmed, key: i };
    }).filter(Boolean);
  };

  if (loading) {
    return (
      <div className="font-data text-xs text-ide-text-secondary">
        <div className="flex items-center gap-2">
          <span className="animate-pulse">&gt;</span>
          <span>Initializing AI reasoning engine...</span>
        </div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="font-data text-xs text-ide-text-secondary">
        <div className="flex items-center gap-2">
          <span className="animate-pulse">&gt;</span>
          <span>System idle. Awaiting edge telemetry...</span>
        </div>
      </div>
    );
  }

  const parsedLines = parseReasoning(trace.reasoning);

  return (
    <div className="font-data text-[10px] space-y-1">
      {/* Header */}
      <div className="text-ide-text-secondary border-b border-ide-border pb-2 mb-2">
        <div className="flex items-center justify-between">
          <span>&gt; BEDROCK AGENT TRACE</span>
          <span className="text-ide-text-tertiary">{trace.traceId.substring(0, 12)}</span>
        </div>
        <div className="text-ide-text-tertiary mt-1">
          Hazard: {trace.hazardId} | Score: {trace.verificationScore}/100
        </div>
      </div>

      {/* Reasoning Steps */}
      <div className="space-y-1">
        {parsedLines.map((line: any) => {
          if (line.type === 'thought') {
            return (
              <div key={line.key} className="text-ide-text-secondary">
                <span className="text-ide-text">[THOUGHT]</span> {line.text.replace(/thought:/i, '').trim()}
              </div>
            );
          }
          if (line.type === 'action') {
            return (
              <div key={line.key} className="text-ide-text-secondary">
                <span className="text-ide-text">[ACTION]</span> {line.text.replace(/action:/i, '').trim()}
              </div>
            );
          }
          if (line.type === 'observation') {
            return (
              <div key={line.key} className="text-ide-text-secondary">
                <span className="text-ide-text">[OBSERVATION]</span> {line.text.replace(/observation:/i, '').trim()}
              </div>
            );
          }
          if (line.type === 'decision') {
            return (
              <div key={line.key} className="text-ide-text font-semibold">
                <span>[FINAL DECISION]</span> {line.text}
              </div>
            );
          }
          return (
            <div key={line.key} className="text-ide-text-tertiary">
              {line.text}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-ide-text-tertiary pt-2 border-t border-ide-border mt-2">
        Last updated: {new Date(trace.createdAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
