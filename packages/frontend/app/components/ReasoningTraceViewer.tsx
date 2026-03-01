'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Brain, Zap, Eye, CheckCircle } from 'lucide-react';
import { useAgentTraceStore } from '../../stores/agentTraceStore';

// ─────────────────────────────────────────────
// ReasoningTraceViewer — ALL Bedrock logic preserved
// Visual layer updated to dark IDE terminal style
// ─────────────────────────────────────────────

type ReasoningTrace = {
  traceId: string;
  hazardId: string;
  reasoning: string;
  verificationScore: number;
  createdAt: string;
};

const TYPE_CONFIG = {
  thought:     { icon: <Brain size={13} />,       color: '#3B82F6', label: 'THOUGHT'     },
  action:      { icon: <Zap size={13} />,          color: '#F59E0B', label: 'ACTION'      },
  observation: { icon: <Eye size={13} />,           color: '#8B95A1', label: 'OBSERVATION' },
  decision:    { icon: <CheckCircle size={13} />,   color: '#10B981', label: 'DECISION'    },
  normal:      { icon: null,                        color: '#4B5563', label: ''            },
} as const;

export function ReasoningTraceViewer() {
  const { traces, isStreaming, connectSSE, disconnectSSE } = useAgentTraceStore();
  const [trace, setTrace] = useState<ReasoningTrace | null>(null);
  const [loading, setLoading] = useState(true);

  // Connect to SSE stream on mount
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';
    // Only connect if innovation endpoint is configured
    if (process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT) {
      connectSSE(`${apiUrl}/agent-traces/stream`);
    }
    
    return () => disconnectSSE();
  }, [connectSSE, disconnectSSE]);

  // Update trace when new traces arrive
  useEffect(() => {
    if (traces.length > 0) {
      const latestTrace = traces[traces.length - 1];
      setTrace({
        traceId: latestTrace.traceId,
        hazardId: latestTrace.geohash, // Use geohash as hazard identifier
        reasoning: latestTrace.steps.map(s => 
          `Thought: ${s.thought}\nAction: ${s.action}\nObservation: ${s.observation}`
        ).join('\n') + `\nFinal Answer: ${latestTrace.steps[latestTrace.steps.length - 1]?.finalAnswer || 'Processing...'}`,
        verificationScore: 0.85,
        createdAt: new Date(latestTrace.timestamp).toISOString(),
      });
      setLoading(false);
    }
  }, [traces]);

  // Listen for verification events from HazardVerificationPanel (backward compatibility)
  useEffect(() => {
    const handleVerification = (event: CustomEvent) => {
      const { hazardId, reasoning, verificationScore } = event.detail;
      setTrace({
        traceId: hazardId,
        hazardId: hazardId,
        reasoning: reasoning || 'Processing...',
        verificationScore: verificationScore || 0,
        createdAt: new Date().toISOString(),
      });
      setLoading(false);
    };

    window.addEventListener('agent-trace-update', handleVerification as EventListener);
    return () => window.removeEventListener('agent-trace-update', handleVerification as EventListener);
  }, []);

  // ── Original parsing logic preserved ──────
  const parseReasoning = (text: string) => {
    if (!text) return [];
    return text.split('\n').map((line, i) => {
      const t = line.trim();
      if (!t) return null;
      if (t.toLowerCase().includes('thought:') || t.toLowerCase().includes('thinking'))
        return { type: 'thought' as const, text: t, key: i };
      if (t.toLowerCase().includes('action:') || t.toLowerCase().includes('query'))
        return { type: 'action' as const, text: t, key: i };
      if (t.toLowerCase().includes('observation:') || t.toLowerCase().includes('found'))
        return { type: 'observation' as const, text: t, key: i };
      if (t.toLowerCase().includes('final') || t.toLowerCase().includes('decision') || t.toLowerCase().includes('score'))
        return { type: 'decision' as const, text: t, key: i };
      return { type: 'normal' as const, text: t, key: i };
    }).filter(Boolean);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 font-data" style={{ fontSize: '0.82rem', color: '#4B5563' }}>
        <RefreshCw size={14} className="animate-spin" style={{ color: '#2563EB' }} />
        <span>Initializing AI reasoning engine...</span>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="flex items-center gap-2 font-data" style={{ fontSize: '0.82rem', color: '#4B5563' }}>
        <span className="animate-pulse" style={{ color: '#2563EB' }}>›</span>
        <span>System idle. Awaiting edge telemetry...</span>
      </div>
    );
  }

  const parsedLines = parseReasoning(trace.reasoning);
  const scoreColor = trace.verificationScore >= 70 ? '#10B981' : trace.verificationScore >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="font-data space-y-0" style={{ fontSize: '0.68rem' }}>
      {/* ── Header ──────────────────────────── */}
      <div
        className="flex items-center justify-between pb-2 mb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: '#4B5563' }}>›</span>
          <span style={{ color: '#6B7280' }}>BEDROCK AGENT TRACE</span>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{
              background: 'rgba(59,130,246,0.1)',
              color: '#3B82F6',
              fontSize: '0.6rem',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {trace.traceId.substring(0, 10)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span style={{ color: '#4B5563' }}>score</span>
          <span
            className="font-semibold"
            style={{ color: scoreColor }}
          >
            {trace.verificationScore}
            <span style={{ color: '#4B5563', fontWeight: 400 }}>/100</span>
          </span>
        </div>
      </div>

      <div
        className="mb-2 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#4B5563' }}
      >
        <span>hazard </span>
        <span style={{ color: '#6B7280' }}>{trace.hazardId}</span>
      </div>

      {/* ── Reasoning Steps ─────────────────── */}
      <div className="space-y-1 log-line">
        {parsedLines.map((line: any) => {
          const cfg = TYPE_CONFIG[line.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.normal;
          const cleanText = line.text
            .replace(/thought:/i, '')
            .replace(/action:/i, '')
            .replace(/observation:/i, '')
            .trim();

          if (line.type === 'normal') {
            return (
              <div key={line.key} style={{ color: '#3D4451', paddingLeft: '1rem' }}>
                {line.text}
              </div>
            );
          }

          return (
            <div key={line.key} className="flex items-start gap-2">
              <span
                className="flex items-center gap-1 flex-shrink-0 mt-0.5"
                style={{ color: cfg.color }}
              >
                {cfg.icon}
                <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em' }}>
                  [{cfg.label}]
                </span>
              </span>
              <span style={{ color: '#6B7280' }}>{cleanText}</span>
            </div>
          );
        })}
      </div>

      {/* ── Footer ──────────────────────────── */}
      <div
        className="flex items-center justify-between pt-2 mt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#3D4451' }}
      >
        <span>Last updated: {new Date(trace.createdAt).toLocaleTimeString()}</span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full pulse" style={{ background: '#10B981' }} />
          <span style={{ color: '#4B5563' }}>live</span>
        </div>
      </div>
    </div>
  );
}
