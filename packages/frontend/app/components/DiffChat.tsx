'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { Bot, Send, RefreshCw, AlertCircle } from 'lucide-react';

const MONO = 'var(--v-font-mono)';
const SANS = 'var(--v-font-ui)';

const C = {
  bg:      'var(--c-bg)',
  panel:   'var(--c-panel)',
  elevated:'var(--c-elevated)',
  border:  'var(--c-border)',
  borderMd:'var(--c-border-md)',
  text:    'var(--c-text)',
  textSec: 'var(--c-text-2)',
  textMut: 'var(--c-text-3)',
  hover:   'var(--c-hover)',
  overlay: 'var(--c-overlay)',
  rose:    'var(--c-rose-2)',
  roseDim: 'var(--c-rose-dim)',
  roseBdr: 'var(--c-rose-border)',
  roseGlow:'var(--c-rose-glow)',
  red:     'var(--c-red)',
  redDim:  'var(--c-red-dim)',
};

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: number;
}

const QUICK_PROMPTS = [
  'Summarize the key changes',
  'Which hazards need urgent attention?',
  'Estimate repair costs',
  'What improved between sessions?',
] as const;

interface DiffChatProps {
  diffMap: any;
  agentAnalysis?: any;
}

export function DiffChat({ diffMap, agentAnalysis }: DiffChatProps) {
  const uid = useId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Seed initial analysis message if provided
  useEffect(() => {
    if (agentAnalysis && messages.length === 0) {
      const lines: string[] = [];
      if (agentAnalysis.summary) lines.push(agentAnalysis.summary);
      if (agentAnalysis.degradationAssessment) lines.push('', agentAnalysis.degradationAssessment);
      if (agentAnalysis.recommendations?.length) {
        lines.push('');
        agentAnalysis.recommendations.forEach((r: string, i: number) => lines.push(`${i + 1}. ${r}`));
      }
      setMessages([{
        id: `${uid}-init`,
        role: 'assistant',
        content: lines.join('\n'),
        timestamp: agentAnalysis.analyzedAt ?? Date.now(),
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentAnalysis]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendQuery = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: `${uid}-u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    const diffContext = {
      sessionA: diffMap.sessionA.displayName,
      sessionB: diffMap.sessionB.displayName,
      timeSpanDays: diffMap.summary.timeSpanDays,
      totalNew: diffMap.summary.totalNew,
      totalFixed: diffMap.summary.totalFixed,
      totalWorsened: diffMap.summary.totalWorsened,
      degradationScore: diffMap.summary.degradationScore,
    };

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          sessionId: agentSessionId,
          diffContext,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages(prev => [...prev, {
          id: `${uid}-e-${Date.now()}`,
          role: 'error',
          content: data.error ?? 'Agent returned an unexpected error.',
          timestamp: Date.now(),
        }]);
      } else {
        if (data.sessionId && !agentSessionId) setAgentSessionId(data.sessionId);
        setMessages(prev => [...prev, {
          id: `${uid}-a-${Date.now()}`,
          role: 'assistant',
          content: data.content,
          timestamp: Date.now(),
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `${uid}-e-${Date.now()}`,
        role: 'error',
        content: `Network error: ${err.message}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery(input);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
  };

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: C.bg, borderLeft: `1px solid ${C.border}`,
    }}>
      <style>{`@keyframes dc-spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Panel header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '0 12px', height: 32,
        borderBottom: `1px solid ${C.border}`,
        background: C.panel, flexShrink: 0,
      }}>
        <Bot size={12} style={{ color: C.rose, flexShrink: 0 }} />
        <span style={{
          fontSize: '0.62rem', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: C.textMut, fontFamily: MONO,
        }}>Analysis Agent</span>
        {agentSessionId && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.55rem', color: C.textMut, fontFamily: MONO,
            letterSpacing: '0.04em',
          }}>
            {agentSessionId.slice(-8)}
          </span>
        )}
      </div>

      {/* ── Message list ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 10px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ padding: '16px 4px' }}>
            <p style={{
              fontSize: '0.68rem', color: C.textMut,
              fontFamily: MONO, letterSpacing: '0.04em',
              marginBottom: 10,
            }}>
              Ask the orchestrator agent about this diff:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => sendQuery(p)}
                  disabled={isLoading}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    border: `1px solid ${C.roseBdr}`,
                    borderRadius: 5,
                    background: C.roseDim,
                    color: C.textSec,
                    fontSize: '0.7rem',
                    fontFamily: SANS,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.roseGlow)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.roseDim)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <div style={{
              padding: '8px 11px',
              borderRadius: msg.role === 'user' ? '8px 8px 2px 8px' : '2px 8px 8px 8px',
              background:
                msg.role === 'user'   ? C.roseDim :
                msg.role === 'error'  ? C.redDim  :
                C.elevated,
              border: `1px solid ${
                msg.role === 'user'   ? C.roseBdr :
                msg.role === 'error'  ? C.red     :
                C.border
              }`,
              fontSize: '0.75rem',
              fontFamily: msg.role === 'assistant' ? MONO : SANS,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              color: msg.role === 'error' ? C.red : C.text,
            }}>
              {msg.role === 'error' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <AlertCircle size={11} style={{ color: C.red }} />
                  <span style={{ fontSize: '0.6rem', fontFamily: MONO, letterSpacing: '0.06em', color: C.red }}>ERROR</span>
                </span>
              )}
              {msg.role === 'error' && <br />}
              {msg.content}
            </div>
            <span style={{
              fontSize: '0.55rem', color: C.textMut,
              fontFamily: MONO,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              paddingLeft: msg.role !== 'user' ? 4 : 0,
              paddingRight: msg.role === 'user' ? 4 : 0,
            }}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {/* Thinking indicator */}
        {isLoading && (
          <div style={{
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 11px',
            border: `1px solid ${C.border}`,
            borderRadius: '2px 8px 8px 8px',
            background: C.elevated,
          }}>
            <RefreshCw
              size={11}
              style={{ color: C.rose, animation: 'dc-spin 1s linear infinite', flexShrink: 0 }}
            />
            <span style={{ fontSize: '0.68rem', color: C.textSec, fontFamily: MONO }}>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div style={{
        padding: '8px 10px',
        borderTop: `1px solid ${C.border}`,
        background: C.panel, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about hazards, costs, priorities..."
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              padding: '7px 10px',
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              outline: 'none',
              resize: 'none',
              minHeight: 34,
              maxHeight: 100,
              background: C.bg,
              color: C.text,
              fontSize: '0.75rem',
              fontFamily: SANS,
              lineHeight: 1.5,
              overflowY: 'auto',
            }}
          />
          <button
            onClick={() => sendQuery(input)}
            disabled={!canSend}
            title="Send (Enter)"
            style={{
              width: 32, height: 32,
              flexShrink: 0,
              border: `1px solid ${canSend ? C.roseBdr : C.border}`,
              borderRadius: 5,
              background: canSend ? C.roseDim : C.elevated,
              color: canSend ? C.rose : C.textMut,
              cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s, border-color 0.12s',
            }}
            onMouseEnter={e => canSend && (e.currentTarget.style.background = C.roseGlow)}
            onMouseLeave={e => (e.currentTarget.style.background = canSend ? C.roseDim : C.elevated)}
          >
            <Send size={13} />
          </button>
        </div>
        <p style={{
          margin: '5px 0 0',
          fontSize: '0.55rem', color: C.textMut,
          fontFamily: MONO, letterSpacing: '0.03em',
        }}>
          Enter to send &nbsp;&middot;&nbsp; Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
