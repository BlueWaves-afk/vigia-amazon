'use client';

import { useEffect, useState, useRef } from 'react';
import { useAgentTraceStore } from '@/stores/agentTraceStore';
import type { ReActStep, ReActTrace } from '@/types/shared';

const MONO = 'var(--v-font-mono)';
const SANS = 'var(--v-font-ui)';

// ── Step sub-components ──────────────────────────────────────

function ThoughtLine({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: '0.7rem', marginTop: 1, flexShrink: 0, opacity: 0.4, color: 'var(--c-text-3)', fontFamily: MONO }}>○</span>
      <span style={{ fontSize: '0.68rem', fontFamily: MONO, color: 'var(--c-text-3)', fontStyle: 'italic', lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  );
}

function ActionLine({ action, input }: { action: string; input: Record<string, unknown> }) {
  const entries = Object.entries(input);
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, paddingLeft: 12 }}>
      <span style={{ fontSize: '0.7rem', marginTop: 1, flexShrink: 0, color: 'var(--c-accent-2)', fontFamily: MONO }}>→</span>
      <div style={{ fontSize: '0.68rem', fontFamily: MONO, lineHeight: 1.5 }}>
        <span style={{ color: 'var(--c-accent-2)', fontWeight: 600 }}>{action}</span>
        {entries.length > 0 && (
          <span style={{ color: 'var(--c-text-3)', marginLeft: 6 }}>
            ({entries.map(([k, v], i) => (
              <span key={k}>
                <span style={{ color: 'var(--c-text-2)' }}>{k}</span>
                <span style={{ color: 'var(--c-text-3)' }}>: </span>
                <span style={{ color: 'var(--c-yellow)' }}>{String(v)}</span>
                {i < entries.length - 1 && <span style={{ color: 'var(--c-text-3)' }}>, </span>}
              </span>
            ))})
          </span>
        )}
      </div>
    </div>
  );
}

function ObservationLine({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, paddingLeft: 12 }}>
      <span style={{ fontSize: '0.7rem', marginTop: 1, flexShrink: 0, color: 'var(--c-text-3)' }}>◎</span>
      <span style={{ fontSize: '0.68rem', fontFamily: MONO, color: 'var(--c-text-2)', lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  );
}

function FinalAnswerLine({ text }: { text: string }) {
  return (
    <div style={{
      marginTop: 8, padding: '8px 10px',
      background: 'var(--c-green-dim)',
      borderLeft: '2px solid var(--c-green)',
      borderRadius: '0 3px 3px 0',
    }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--c-green)', fontFamily: MONO, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Conclusion
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--c-text)', fontFamily: SANS, lineHeight: 1.5 }}>
        {text}
      </div>
    </div>
  );
}

function StepBlock({ step, index, animate }: { step: ReActStep; index: number; animate?: boolean }) {
  return (
    <div style={{
      opacity: animate ? 0 : 1,
      animation: animate ? `fadeSlideIn 0.3s ease forwards ${index * 0.08}s` : undefined,
    }}>
      {step.thought     && <ThoughtLine text={step.thought} />}
      {step.action      && <ActionLine action={step.action} input={step.actionInput} />}
      {step.observation && <ObservationLine text={step.observation} />}
      {step.finalAnswer && <FinalAnswerLine text={step.finalAnswer} />}
    </div>
  );
}

// ── Live thinking banner ─────────────────────────────────────
interface ThinkingState {
  hazardId: string;
  steps: ReActStep[];
  isThinking: boolean;
  startTime: number;
  traceId?: string;
  verificationScore?: number;
}

function ThinkingBanner({ trace }: { trace: ThinkingState }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!trace.isThinking) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - trace.startTime) / 1000)), 500);
    return () => clearInterval(t);
  }, [trace.isThinking, trace.startTime]);

  return (
    <div style={{
      margin: '10px 10px 4px',
      background: 'var(--c-panel)',
      border: '1px solid var(--c-accent-glow)',
      borderLeft: '3px solid var(--c-accent-2)',
      borderRadius: 4, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        background: 'var(--c-accent-glow)',
        borderBottom: '1px solid var(--v-border-subtle)',
      }}>
        {trace.isThinking ? (
          <div style={{ display: 'flex', gap: 3 }}>
            {[0, 0.15, 0.3].map((d, i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--c-accent-2)',
                animation: 'dotPulse 1.2s ease-in-out infinite',
                animationDelay: `${d}s`,
              }} />
            ))}
          </div>
        ) : (
          <span style={{ fontSize: '0.7rem', color: 'var(--c-green)' }}>✓</span>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--c-text)', fontFamily: SANS }}>
            {trace.isThinking ? 'VIGIA Agent — Reasoning' : 'VIGIA Agent — Done'}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--c-text-3)', fontFamily: MONO }}>
            {trace.isThinking
              ? `Elapsed ${elapsed}s · hazard ${trace.hazardId?.slice(-6) ?? '—'}`
              : `Completed · ${trace.steps.length} steps`}
          </div>
        </div>
        {!trace.isThinking && trace.verificationScore !== undefined && (
          <div style={{
            padding: '2px 8px', borderRadius: 3,
            background: trace.verificationScore >= 70 ? 'var(--c-green-dim)' : 'var(--c-red-dim)',
            border: `1px solid ${trace.verificationScore >= 70 ? 'var(--c-green)' : 'var(--c-red)'}`,
            fontSize: '0.68rem', fontFamily: MONO, fontWeight: 700,
            color: trace.verificationScore >= 70 ? 'var(--c-green)' : 'var(--c-red)',
          }}>
            {trace.verificationScore}/100
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px 6px' }}>
        {trace.steps.length > 0
          ? trace.steps.map((step, i) => <StepBlock key={i} step={step} index={i} animate={trace.isThinking} />)
          : <div style={{ fontSize: '0.68rem', color: 'var(--c-text-3)', fontFamily: MONO, fontStyle: 'italic' }}>
              Initializing reasoning chain…
            </div>
        }
      </div>
    </div>
  );
}

// ── Historical trace card ────────────────────────────────────
function TraceCard({ trace, index }: { trace: ReActTrace; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const ts = new Date(trace.timestamp).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const score = (trace as any).verificationScore as number | undefined;

  return (
    <div style={{
      margin: '0 10px 6px',
      background: 'var(--c-panel)',
      border: '1px solid var(--v-border-default)',
      borderRadius: 4, overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', background: 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'}
        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      >
        <span style={{ color: 'var(--c-text-3)', fontSize: '0.6rem', flexShrink: 0 }}>
          {expanded ? '▾' : '▸'}
        </span>
        <span style={{ fontSize: '0.6rem', color: 'var(--c-text-3)', fontFamily: MONO, flexShrink: 0 }}>{ts}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--c-text-3)', fontFamily: MONO, flexShrink: 0 }}>·</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--c-text-2)', fontFamily: MONO, fontWeight: 600, flexShrink: 0 }}>
          #{trace.traceId.slice(-8)}
        </span>
        <span style={{ fontSize: '0.6rem', color: 'var(--c-text-3)', fontFamily: MONO, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {trace.geohash}
        </span>
        {score !== undefined && (
          <span style={{
            fontSize: '0.6rem', fontFamily: MONO, fontWeight: 700, flexShrink: 0,
            padding: '1px 6px', borderRadius: 2,
            background: score >= 70 ? 'var(--c-green-dim)' : 'var(--c-red-dim)',
            color: score >= 70 ? 'var(--c-green)' : 'var(--c-red)',
          }}>
            {score}/100
          </span>
        )}
        <span style={{
          fontSize: '0.58rem', fontFamily: MONO, color: 'var(--c-text-3)',
          padding: '1px 5px', borderRadius: 2, background: 'var(--c-elevated)', flexShrink: 0,
        }}>
          {trace.steps.length} steps
        </span>
      </button>
      {expanded && (
        <div style={{ padding: '8px 12px 10px', borderTop: '1px solid var(--v-border-subtle)' }}>
          {trace.steps.map((step, i) => <StepBlock key={i} step={step} index={i} />)}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export function AgentTracesTab() {
  const { traces, filter, isStreaming, setFilter, connectSSE, disconnectSSE } = useAgentTraceStore();
  const [autoScroll, setAutoScroll] = useState(true);
  const [thinkingTrace, setThinkingTrace] = useState<ThinkingState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connectSSE('/api/agent-traces/stream');
    return () => disconnectSSE();
  }, [connectSSE, disconnectSSE]);

  useEffect(() => {
    const onStart = (e: Event) => {
      const { hazardId } = (e as CustomEvent).detail;
      setThinkingTrace({ hazardId, steps: [], isThinking: true, startTime: Date.now() });
    };
    const onStep = (e: Event) => {
      const { step } = (e as CustomEvent).detail;
      setThinkingTrace(prev => prev ? { ...prev, steps: [...prev.steps, step] } : null);
    };
    const onComplete = (e: Event) => {
      const { traceId, steps, verificationScore } = (e as CustomEvent).detail;
      setThinkingTrace(prev => prev ? { ...prev, isThinking: false, traceId, steps, verificationScore } : null);
      setTimeout(() => setThinkingTrace(null), 12000);
    };
    window.addEventListener('verification-start',    onStart    as EventListener);
    window.addEventListener('verification-step',     onStep     as EventListener);
    window.addEventListener('verification-complete', onComplete as EventListener);
    return () => {
      window.removeEventListener('verification-start',    onStart    as EventListener);
      window.removeEventListener('verification-step',     onStep     as EventListener);
      window.removeEventListener('verification-complete', onComplete as EventListener);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [traces, thinkingTrace, autoScroll]);

  const filteredTraces = filter
    ? traces.filter(t => t.geohash.includes(filter) || t.contributorId.includes(filter))
    : traces;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-bg)' }}>
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1.0); opacity: 1;   }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      {/* Toolbar */}
      <div className="vigia-panel-header" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px', height: 34, flexShrink: 0,
        background: 'var(--c-panel)', borderBottom: 'none',
      }}>
        <input
          type="text"
          placeholder="Filter by geohash or contributor…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1, padding: '3px 8px',
            fontSize: '0.68rem', fontFamily: MONO,
            background: 'var(--c-input)', border: '1px solid var(--v-border-default)',
            borderRadius: 3, color: 'var(--c-text)', outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--v-accent) 50%, transparent)')}
          onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--v-border-default)')}
        />
        {filter && (
          <button
            onClick={() => setFilter('')}
            style={{
              padding: '2px 8px', borderRadius: 3, fontSize: '0.62rem', fontFamily: MONO,
              background: 'var(--c-elevated)', border: '1px solid var(--v-border-default)',
              color: 'var(--c-text-2)', cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--c-elevated)'}
          >
            ✕
          </button>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.62rem', color: 'var(--c-text-3)', fontFamily: MONO, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox" checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            style={{ width: 11, height: 11, accentColor: 'var(--c-accent-2)', cursor: 'pointer' }}
          />
          Scroll
        </label>
        <div title={isStreaming ? 'Live' : 'Disconnected'} style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: isStreaming ? 'var(--c-green)' : 'var(--c-text-3)',
          boxShadow: isStreaming ? '0 0 5px var(--c-green)' : 'none',
          transition: 'background 0.3s',
        }} />
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
        {thinkingTrace && <ThinkingBanner trace={thinkingTrace} />}

        {filteredTraces.length > 0 ? (
          <div style={{ paddingBottom: 8 }}>
            {[...filteredTraces].reverse().map((trace, i) => (
              <TraceCard key={trace.traceId} trace={trace} index={i} />
            ))}
          </div>
        ) : (
          !thinkingTrace && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '50%', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--c-text-3)', fontFamily: MONO }}>
                {filter ? 'No traces match this filter' : 'Waiting for verification requests…'}
              </div>
            </div>
          )
        )}
      </div>

      {/* Status bar */}
      <div className="vigia-sidebar-footer" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px', height: 22, flexShrink: 0,
        background: 'var(--c-panel)', borderTop: 'none',
        fontSize: '0.6rem', fontFamily: MONO, color: 'var(--c-text-3)',
      }}>
        <span>
          {filteredTraces.length} trace{filteredTraces.length !== 1 ? 's' : ''}
          {filter && ` (of ${traces.length})`}
        </span>
        <span style={{ color: isStreaming ? 'var(--c-green)' : 'var(--c-text-3)' }}>
          {isStreaming ? '● LIVE' : '○ offline'}
        </span>
      </div>
    </div>
  );
}
