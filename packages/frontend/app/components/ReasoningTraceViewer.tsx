'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Brain, Zap, Eye, CheckCircle } from 'lucide-react';
import { useAgentTraceStore } from '../../stores/agentTraceStore';

// ─────────────────────────────────────────────
// ReasoningTraceViewer — ALL Bedrock logic preserved
// Visual layer: Copilot agent-thinking style
// ─────────────────────────────────────────────

const MONO = "'IBM Plex Mono', monospace";

type ReasoningTrace = {
  traceId: string;
  hazardId: string;
  reasoning: string;
  verificationScore: number;
  createdAt: string;
};

const TYPE_CONFIG = {
  thought:     { icon: <Brain size={11} />,       color: 'var(--c-rose-2)', bg: 'var(--c-rose-dim)',   border: 'var(--c-rose-border)',  label: 'THOUGHT'  },
  action:      { icon: <Zap size={11} />,          color: 'var(--c-rose-2)', bg: 'var(--c-rose-dim)',   border: 'var(--c-rose-border)',  label: 'ACTION'   },
  observation: { icon: <Eye size={11} />,           color: 'var(--c-text-2)', bg: 'var(--c-hover)',    border: 'var(--c-border-md)',     label: 'OBS'      },
  decision:    { icon: <CheckCircle size={11} />,   color: 'var(--c-rose-2)', bg: 'var(--c-rose-dim)',   border: 'var(--c-rose-border)',  label: 'DECISION' },
  normal:      { icon: null,                        color: 'var(--c-text-2)', bg: 'transparent',         border: 'transparent',           label: ''         },
} as const;

// ── CSS animations ────────────────────────────
const STYLES = `
  @keyframes rtv-dot {
    0%,80%,100% { opacity: 0.2; transform: translateY(0); }
    40%         { opacity: 1;   transform: translateY(-2px); }
  }
  @keyframes rtv-slide {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes rtv-spin {
    to { transform: rotate(360deg); }
  }
`;

// ── Animated "thinking" banner ────────────────
function ThinkingHeader({ active, steps }: { active: boolean; steps: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 8px',
      background: 'var(--c-rose-dim)',
      border: '1px solid var(--c-rose-border)',
      borderRadius: 6,
      marginBottom: 8,
      fontFamily: MONO,
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      {active ? (
        <>
          <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                background: 'var(--c-rose-2)',
                animation: `rtv-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--c-rose-2)', letterSpacing: '0.04em' }}>
            Agent reasoning{steps > 0 ? ` · ${steps} step${steps !== 1 ? 's' : ''}` : '…'}
          </span>
        </>
      ) : (
        <>
          <CheckCircle size={12} style={{ color: 'var(--c-rose-2)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--c-rose-2)', letterSpacing: '0.04em' }}>
            Reasoning complete · {steps} step{steps !== 1 ? 's' : ''}
          </span>
        </>
      )}
    </div>
  );
}

// ── Single live step row ──────────────────────
function StepRow({ step, index }: { step: any; index: number }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 3,
      paddingLeft: 10,
      borderLeft: '2px solid var(--c-rose-border)',
      marginBottom: 6,
      animation: 'rtv-slide 0.28s ease both',
      animationDelay: `${index * 0.06}s`,
      fontFamily: MONO,
      fontSize: '0.7rem',
    }}>
      {step.thought && (
        <div style={{ color: 'var(--c-fg-3, #9CA3AF)', fontStyle: 'italic', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <Brain size={11} style={{ color: 'var(--c-rose-2)', flexShrink: 0, marginTop: 1 }} />
          <span>{step.thought}</span>
        </div>
      )}
      {step.action && (
        <div style={{ color: 'var(--c-rose-2)', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <Zap size={11} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <span style={{ fontWeight: 600 }}>{step.action}</span>
            {step.actionInput && (
              <span style={{ color: 'var(--c-fg-3, #9CA3AF)', marginLeft: 6 }}>
                {JSON.stringify(step.actionInput)}
              </span>
            )}
          </span>
        </div>
      )}
      {step.observation && (
        <div style={{ color: 'var(--c-fg-2, #8B9AB1)', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <Eye size={11} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {step.observation.substring(0, 100)}
            {step.observation.length > 100 ? '…' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

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

  // NEW: Listen for real-time thinking steps
  const [thinkingSteps, setThinkingSteps] = useState<any[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  
  useEffect(() => {
    const handleStart = () => {
      console.log('[ReasoningTraceViewer] START');
      setIsThinking(true);
      setThinkingSteps([]);
      setLoading(true);
    };
    const handleStep = (e: CustomEvent) => {
      console.log('[ReasoningTraceViewer] STEP:', e.detail);
      setThinkingSteps(prev => [...prev, e.detail.step]);
    };
    const handleComplete = (e: CustomEvent) => {
      console.log('[ReasoningTraceViewer] COMPLETE:', e.detail);
      setIsThinking(false);
      setLoading(false);
      // Store final reasoning
      if (e.detail.reasoning) {
        setTrace({
          traceId: e.detail.traceId,
          hazardId: e.detail.traceId,
          reasoning: e.detail.reasoning,
          verificationScore: e.detail.verificationScore || 0,
          createdAt: new Date().toISOString(),
        });
      }
    };
    
    window.addEventListener('verification-start', handleStart);
    window.addEventListener('verification-step', handleStep as EventListener);
    window.addEventListener('verification-complete', handleComplete as EventListener);
    
    return () => {
      window.removeEventListener('verification-start', handleStart);
      window.removeEventListener('verification-step', handleStep as EventListener);
      window.removeEventListener('verification-complete', handleComplete as EventListener);
    };
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

  // ── Render: Live thinking steps ───────────
  if (loading || isThinking || thinkingSteps.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', fontFamily: MONO, fontSize: '0.7rem' }}>
        <style>{STYLES}</style>
        <ThinkingHeader active={isThinking} steps={thinkingSteps.length} />
        {thinkingSteps.map((step, i) => (
          <StepRow key={i} step={step} index={i} />
        ))}
        {!isThinking && trace?.reasoning && (
          <div style={{
            marginTop: 8,
            padding: '6px 8px',
            background: 'var(--c-rose-dim)',
            border: '1px solid var(--c-rose-border)',
            borderRadius: 6,
            color: 'var(--c-rose-2)',
            fontSize: '0.7rem',
            lineHeight: 1.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <CheckCircle size={11} />
              <span style={{ fontWeight: 600 }}>Final Reasoning</span>
            </div>
            <div style={{ color: 'var(--c-fg-2)', whiteSpace: 'pre-wrap' }}>
              {trace.reasoning}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Spinner fallback ──────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: '0.7rem', color: 'var(--c-fg-2, #6B7280)' }}>
        <style>{STYLES}</style>
        <RefreshCw size={13} style={{ color: 'var(--c-rose-2)', animation: 'rtv-spin 1s linear infinite' }} />
        <span>Agent processing verification…</span>
      </div>
    );
  }

  // ── Render: Idle ──────────────────────────
  if (!trace) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: '0.7rem', color: 'var(--c-fg-2, #6B7280)' }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: 'var(--c-rose-2)', opacity: 0.5,
        }} />
        <span>Ready · right-click a hazard to verify</span>
      </div>
    );
  }

  // ── Render: Full trace ────────────────────
  const parsedLines = parseReasoning(trace.reasoning);
  const scoreNum = typeof trace.verificationScore === 'number'
    ? (trace.verificationScore > 1 ? trace.verificationScore : Math.round(trace.verificationScore * 100))
    : 0;
  const scoreColor = 'var(--c-rose-2)';
  const scoreBg    = 'var(--c-rose-dim)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontFamily: MONO, fontSize: '0.7rem' }}>
      <style>{STYLES}</style>

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 6, marginBottom: 6,
        borderBottom: '1px solid var(--c-border, rgba(255,255,255,0.06))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            padding: '1px 6px', borderRadius: 4,
            background: 'var(--c-rose-dim)', color: 'var(--c-rose-2)',
            fontSize: '0.6rem', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            BEDROCK
          </span>
          <span style={{ color: 'var(--c-fg-3, #9CA3AF)', fontSize: '0.63rem', letterSpacing: '0.02em' }}>
            {trace.traceId.substring(0, 10)}
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '1px 8px', borderRadius: 99,
          background: scoreBg, color: scoreColor,
          fontSize: '0.65rem', fontWeight: 700,
        }}>
          {scoreNum}
          <span style={{ fontWeight: 400, opacity: 0.55, marginLeft: 1 }}>/100</span>
        </div>
      </div>

      {/* ── Hazard ID ── */}
      <div style={{ color: 'var(--c-fg-3, #9CA3AF)', marginBottom: 7, fontSize: '0.64rem' }}>
        hazard{' '}
        <span style={{ color: 'var(--c-fg-2, #8B9AB1)' }}>{trace.hazardId}</span>
      </div>

      {/* ── Reasoning step rows ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {parsedLines.map((line: any) => {
          const cfg = TYPE_CONFIG[line.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.normal;
          const cleanText = line.text
            .replace(/thought:/i, '').replace(/action:/i, '')
            .replace(/observation:/i, '').trim();

          if (line.type === 'normal') {
            return (
              <div key={line.key} style={{
                color: 'var(--c-fg-3, #9CA3AF)',
                paddingLeft: 8, opacity: 0.45,
                fontSize: '0.64rem', lineHeight: 1.5,
              }}>
                {line.text}
              </div>
            );
          }

          return (
            <div key={line.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: '3px 7px 3px 6px',
              borderLeft: `2px solid ${cfg.border}`,
              background: cfg.bg,
              borderRadius: '0 4px 4px 0',
              marginBottom: 1,
            }}>
              <span style={{
                color: cfg.color, flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 4,
                marginTop: 1,
              }}>
                {cfg.icon}
                <span style={{ fontSize: '0.57rem', fontWeight: 700, letterSpacing: '0.09em', opacity: 0.75 }}>
                  {cfg.label}
                </span>
              </span>
              <span style={{ color: 'var(--c-fg-2, #8B9AB1)', flex: 1, lineHeight: 1.55 }}>
                {cleanText}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 6, marginTop: 6,
        borderTop: '1px solid var(--c-border, rgba(255,255,255,0.05))',
        color: 'var(--c-fg-3, #9CA3AF)', fontSize: '0.61rem',
      }}>
        <span>{new Date(trace.createdAt).toLocaleTimeString()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: 'var(--c-rose-2)',
          }} />
          <span>live</span>
        </div>
      </div>
    </div>
  );
}
