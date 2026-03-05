'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, ArrowUp } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WIDTH   = 300;
const MIN_OPEN_WIDTH  = 200;
const MAX_WIDTH       = 500;

const CONTEXT_LABELS: Record<string, string> = {
  livemap:     'Live Map Analysis',
  network:     'Network Intelligence',
  maintenance: 'Maintenance Agent',
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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentChatPanelProps {
  contextType: 'livemap' | 'network' | 'maintenance';
  context?: Record<string, any>;
}

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AgentChatPanel({ contextType, context = {} }: AgentChatPanelProps) {
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [query,      setQuery]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [sessionId]                 = useState(() => Math.random().toString(36).slice(2, 18));
  const [collapsed,  setCollapsed]  = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const isDragging     = useRef(false);
  const startX         = useRef(0);
  const startW         = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const sendQuery = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text || loading) return;
    if (textareaRef.current) textareaRef.current.style.height = '32px';
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    setLoading(true);
    try {
      const isUrbanPlanning = /\b(path|route|construction|road|optimal|build)\b/i.test(text);
      if (contextType === 'network') {
        const res  = await fetch('/api/agent/network-analysis', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text, context }),
        });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.analysis ?? data.message ?? JSON.stringify(data), timestamp: Date.now() }]);
      } else if (contextType === 'livemap' && isUrbanPlanning) {
        const res  = await fetch('/api/agent/urban-planning', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text, context }),
        });
        const data = await res.json();
        if (data.pathData) {
          (window as any).__urbanPlannerPath = data.pathData;
          (window as any).__urbanPlannerPathTrigger?.();
        }
        setMessages(prev => [...prev, { role: 'assistant', content: data.analysis ?? data.message ?? JSON.stringify(data), timestamp: Date.now() }]);
      } else {
        const res  = await fetch('/api/agent/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text, sessionId, context: { type: contextType, ...context } }),
        });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.content ?? data.message ?? JSON.stringify(data), timestamp: Date.now() }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Request failed — check your connection.', timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Collapsed ─────────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="acp-collapsed">
        <button className="acp-expand-btn" onClick={() => setCollapsed(false)} title="Open Analysis Agent">
          <ChevronLeft size={13} />
        </button>
        <span className="acp-collapsed-label">Agent</span>
      </div>
    );
  }

  // ── Expanded ──────────────────────────────────────────────────────────────
  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="acp-panel" style={{ width: panelWidth }}>
      <div className="acp-drag-handle" onMouseDown={onDragStart} />

      {/* Header */}
      <div className="acp-header">
        <span className="acp-header-label">{CONTEXT_LABELS[contextType]}</span>
        <button className="acp-collapse-btn" onClick={() => setCollapsed(true)} title="Collapse panel">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Empty state or messages */}
      {isEmpty ? (
        <>
          <div className="acp-empty">
            <div className="acp-empty-icon"><Sparkles size={16} /></div>
            <p className="acp-empty-text">
              Ask anything about<br />
              <strong style={{ color: 'var(--v-text-secondary)', fontWeight: 500 }}>
                {CONTEXT_LABELS[contextType].toLowerCase()}
              </strong>
            </p>
          </div>
          <div className="acp-chips">
            {QUICK_PROMPTS[contextType].map((p, i) => (
              <button key={i} className="acp-chip" onClick={() => sendQuery(p)}>{p}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="acp-messages">
          {messages.map((m, i) => (
            <div key={i} className={`acp-msg acp-msg--${m.role}`}>{m.content}</div>
          ))}
          {loading && (
            <div className="acp-thinking">
              <div style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="acp-dot" style={{ animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--v-text-disabled)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                thinking…
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input row */}
      <div className="acp-input-row">
        <textarea
          ref={textareaRef}
          className="acp-textarea"
          value={query}
          rows={1}
          placeholder="Ask the agent…"
          onChange={(e) => {
            setQuery(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); }
          }}
        />
        <button
          className="acp-send-btn"
          onClick={() => sendQuery()}
          disabled={!query.trim() || loading}
          title="Send"
        >
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  );
}
