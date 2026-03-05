'use client';

import { useRef, useState, useEffect } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO = "'IBM Plex Mono', monospace";
const DEFAULT_WIDTH = 300;
const MIN_OPEN_WIDTH = 200;
const MAX_WIDTH = 500;
const COLLAPSED_WIDTH = 28;

const CONTEXT_LABELS: Record<string, string> = {
  livemap:     'LIVE MAP ANALYSIS',
  network:     'NETWORK INTELLIGENCE',
  maintenance: 'MAINTENANCE AGENT',
};

const QUICK_PROMPTS: Record<string, string[]> = {
  livemap: [
    'What hazards need urgent attention?',
    'Find optimal path between two points',
    'Estimate repair costs for visible damage',
    'Recommend new road construction',
  ],
  network: [
    'Analyze node connectivity health',
    'Identify network coverage gaps',
    'Optimal path between selected nodes',
    'Recommend expansion priorities',
  ],
  maintenance: [
    'Prioritize the repair queue',
    'Cost estimate for pending repairs',
    'Recommend maintenance schedule',
    'Optimal resource allocation',
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mkId = () => Math.random().toString(36).slice(2, 10);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentChatPanelProps {
  contextType: 'livemap' | 'network' | 'maintenance';
  context?: Record<string, any>;
  availableSessions?: Array<{ sessionId: string; label: string; geohash?: string }>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error' | 'thinking';
  content: string;
  timestamp: number;
  hazards?: Array<{
    hazardId: string;
    latitude: number;
    longitude: number;
    hazardType: string;
    priority: number;
  }>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AgentChatPanel({ contextType, context = {} }: AgentChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2, 18));
  const [collapsed, setCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const pinMenuRef     = useRef<HTMLDivElement>(null);
  const isDragging     = useRef(false);
  const startX         = useRef(0);
  const startW         = useRef(0);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for network agent triggers from node clicks
  useEffect(() => {
    if (contextType === 'network') {
      (window as any).__networkAgentTrigger = () => {
        const ctx = (window as any).__networkAgentContext;
        if (ctx) { setCollapsed(false); sendQuery(ctx); }
      };
      return () => {
        delete (window as any).__networkAgentTrigger;
        delete (window as any).__networkAgentContext;
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextType]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newW  = Math.max(MIN_OPEN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta));
      setPanelWidth(newW);
    };
    const onMouseUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  const onDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current     = e.clientX;
    startW.current     = panelWidth;
    e.preventDefault();
  };

  // Send a query to the orchestration agent
  const sendQuery = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text || loading) return;

    if (textareaRef.current) {
      textareaRef.current.style.height = '30px';
    }
    setQuery('');

    const userMsg: Message = { id: mkId(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Detect urban planning queries (path, route, construction, road)
      const isUrbanPlanning = /\b(path|route|construction|road|optimal|build)\b/i.test(text);
      
      if (contextType === 'network') {
        // Use network-analysis API for network context
        const res = await fetch('/api/agent/network-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text,
            context: context,
          }),
        });
        const data = await res.json();
        const content = data.analysis ?? data.message ?? JSON.stringify(data);
        setMessages(prev => [...prev, { id: mkId(), role: 'assistant', content, timestamp: Date.now() }]);
      } else if (contextType === 'livemap' && isUrbanPlanning) {
        // Use urban-planning API for path/route queries
        const res = await fetch('/api/agent/urban-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text,
            context: context,
          }),
        });
        const data = await res.json();
        const content = data.analysis ?? data.message ?? JSON.stringify(data);
        
        // Emit path data if available for map rendering
        if (data.pathData) {
          (window as any).__urbanPlannerPath = data.pathData;
          (window as any).__urbanPlannerPathTrigger?.();
        }
        
        setMessages(prev => [...prev, { id: mkId(), role: 'assistant', content, timestamp: Date.now() }]);
      } else {
        // Use default chat API for other contexts
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text,
            sessionId,
            context: { type: contextType, ...context },
          }),
        });
        const data = await res.json();
        const content = data.content ?? data.message ?? JSON.stringify(data);
        setMessages(prev => [...prev, { id: mkId(), role: 'assistant', content, timestamp: Date.now() }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: mkId(),
        role: 'error',
        content: 'Request failed — check your connection.',
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Collapsed state ─────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div style={{
        width: COLLAPSED_WIDTH, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        borderLeft: '1px solid var(--c-border)',
        background: 'var(--c-panel)',
      }}>
        {/* Expand button */}
        <button
          onClick={() => setCollapsed(false)}
          title="Open Analysis Agent"
          style={{
            marginTop: 10,
            width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--c-border)',
            borderRadius: 3, cursor: 'pointer',
            color: 'var(--c-rose-2)', fontSize: '0.8rem',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--c-rose-dim)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-rose-border)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border)';
          }}
        >
          ‹
        </button>
        {/* Rotated label */}
        <div style={{
          marginTop: 14,
          fontSize: '0.52rem', color: 'var(--c-text-3)',
          fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.09em',
          writingMode: 'vertical-rl', textOrientation: 'mixed',
          transform: 'rotate(180deg)', userSelect: 'none',
        }}>
          Agent
        </div>
      </div>
    );
  }

  // ── Expanded state ──────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe for loading dots */}
      <style>{`
        @keyframes agent-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.0); opacity: 1.0; }
        }
      `}</style>

      <div style={{
        width: panelWidth, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--c-border)',
        background: 'var(--c-panel)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* ── Drag handle — left edge ─────────────────────────────────────── */}
        <div
          onMouseDown={onDragStart}
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            cursor: 'ew-resize', zIndex: 10,
            background: 'transparent', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--c-rose-border)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          height: 36, flexShrink: 0,
          paddingLeft: 14, paddingRight: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-sidebar)',
        }}>
          <span style={{
            fontSize: '0.60rem', fontWeight: 600,
            color: 'var(--c-rose-2)', fontFamily: MONO,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {CONTEXT_LABELS[contextType]}
          </span>

          {/* Collapse button */}
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse panel"
            style={{
              width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              cursor: 'pointer', color: 'var(--c-text-3)',
              fontSize: '0.8rem', borderRadius: 3,
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)';
              (e.currentTarget as HTMLElement).style.color = 'var(--c-text)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)';
            }}
          >
            ›
          </button>
        </div>

        {/* ── Message list ───────────────────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '10px 10px 6px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {messages.length === 0 && (
            <div style={{
              color: 'var(--c-text-3)', fontSize: '0.64rem',
              fontFamily: MONO, textAlign: 'center',
              marginTop: 20, lineHeight: 1.85,
            }}>
              Ask anything about<br />
              <span style={{ color: 'var(--c-rose-2)' }}>
                {CONTEXT_LABELS[contextType].toLowerCase()}
              </span>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '93%', padding: '6px 9px', borderRadius: 4,
                fontSize: '0.65rem', fontFamily: MONO, lineHeight: 1.6,
                background:
                  m.role === 'user'  ? 'var(--c-rose-dim)'       :
                  m.role === 'error' ? 'rgba(255,60,50,0.08)'    :
                                       'var(--c-elevated)',
                color:
                  m.role === 'user'  ? 'var(--c-rose-2)' :
                  m.role === 'error' ? 'var(--c-red)'    :
                                       'var(--c-text)',
                border: `1px solid ${
                  m.role === 'user'  ? 'var(--c-rose-border)'     :
                  m.role === 'error' ? 'rgba(255,60,50,0.25)'     :
                                       'var(--c-border)'
                }`,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: 'var(--c-rose-2)',
                    animation: `agent-dot 1.1s ${i * 0.18}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '0.59rem', color: 'var(--c-text-3)', fontFamily: MONO }}>
                thinking
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Quick prompts (only on empty state) ───────────────────────── */}
        {messages.length === 0 && !loading && (
          <div style={{ padding: '0 10px 8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {QUICK_PROMPTS[contextType].map((p, i) => (
              <button
                key={i}
                onClick={() => sendQuery(p)}
                style={{
                  textAlign: 'left', padding: '5px 8px', borderRadius: 3,
                  background: 'transparent',
                  border: '1px solid var(--c-border)',
                  cursor: 'pointer', color: 'var(--c-text-3)',
                  fontSize: '0.60rem', fontFamily: MONO,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--c-rose-border)';
                  el.style.color       = 'var(--c-rose-2)';
                  el.style.background  = 'var(--c-rose-dim)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--c-border)';
                  el.style.color       = 'var(--c-text-3)';
                  el.style.background  = 'transparent';
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* ── Input row ──────────────────────────────────────────────────── */}
        <div style={{
          padding: '6px 10px 10px 14px',
          borderTop: '1px solid var(--c-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendQuery();
                }
              }}
              placeholder="Ask the agent…"
              rows={1}
              style={{
                flex: 1, resize: 'none', overflow: 'hidden',
                minHeight: 30, height: 30, maxHeight: 100,
                background: 'var(--c-bg)',
                border: '1px solid var(--c-border)',
                borderRadius: 3, padding: '5px 8px',
                color: 'var(--c-text)',
                fontSize: '0.64rem', fontFamily: MONO,
                lineHeight: 1.5, outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e)  => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-rose-border)'; }}
              onBlur={(e)   => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-border)'; }}
            />

            {/* Send button */}
            <button
              onClick={() => sendQuery()}
              disabled={!query.trim() || loading}
              style={{
                width: 28, height: 28, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: query.trim() && !loading ? 'var(--c-rose-dim)' : 'var(--c-elevated)',
                border: `1px solid ${query.trim() && !loading ? 'var(--c-rose-border)' : 'var(--c-border)'}`,
                borderRadius: 3,
                cursor: query.trim() && !loading ? 'pointer' : 'not-allowed',
                color: query.trim() && !loading ? 'var(--c-rose-2)' : 'var(--c-text-3)',
                fontSize: '0.85rem', transition: 'all 0.12s',
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
