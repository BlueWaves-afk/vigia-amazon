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
      <div className="font-mono text-sm text-gray-500 p-4">
        <div className="flex items-center gap-2">
          <span className="animate-pulse">▸</span>
          <span>Initializing AI reasoning engine...</span>
        </div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="font-mono text-sm text-gray-500 p-4">
        <div className="flex items-center gap-2">
          <span className="animate-pulse">▸</span>
          <span>System idle. Awaiting edge telemetry...</span>
        </div>
      </div>
    );
  }

  const parsedLines = parseReasoning(trace.reasoning);

  return (
    <div className="font-mono text-xs p-4 space-y-2 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="text-vigia-accent border-b border-gray-800 pb-2 mb-3">
        <div className="flex items-center justify-between">
          <span>▸ BEDROCK AGENT TRACE</span>
          <span className="text-gray-600">{trace.traceId.substring(0, 12)}</span>
        </div>
        <div className="text-gray-500 text-[10px] mt-1">
          Hazard: {trace.hazardId} | Score: {trace.verificationScore}/100
        </div>
      </div>

      {/* Reasoning Steps */}
      <div className="space-y-1">
        {parsedLines.map((line: any) => {
          if (line.type === 'thought') {
            return (
              <div key={line.key} className="text-yellow-400">
                <span className="text-yellow-600">[THOUGHT]</span> {line.text.replace(/thought:/i, '').trim()}
              </div>
            );
          }
          if (line.type === 'action') {
            return (
              <div key={line.key} className="text-blue-400">
                <span className="text-blue-600">[ACTION]</span> {line.text.replace(/action:/i, '').trim()}
              </div>
            );
          }
          if (line.type === 'observation') {
            return (
              <div key={line.key} className="text-purple-400">
                <span className="text-purple-600">[OBSERVATION]</span> {line.text.replace(/observation:/i, '').trim()}
              </div>
            );
          }
          if (line.type === 'decision') {
            return (
              <div key={line.key} className="text-vigia-success font-semibold">
                <span className="text-green-600">[FINAL DECISION]</span> {line.text}
              </div>
            );
          }
          return (
            <div key={line.key} className="text-gray-400">
              {line.text}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-gray-600 text-[10px] pt-2 border-t border-gray-800 mt-3">
        Last updated: {new Date(trace.createdAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
