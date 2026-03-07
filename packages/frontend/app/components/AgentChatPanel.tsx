'use client';

import { useRef, useState, useEffect } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO = "'IBM Plex Mono', 'JetBrains Mono', monospace";
const SANS = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";
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

const STATIC_ATTACH_OPTIONS: Record<string, Array<{ label: string; key: string }>> = {
  livemap: [
    { label: 'Current map area',     key: 'mapBounds'      },
    { label: 'Visible hazards',      key: 'visibleHazards' },
    { label: 'Current route',        key: 'activeRoute'    },
  ],
  network: [
    { label: 'Selected node',        key: 'selectedNode'   },
    { label: 'Network topology',     key: 'networkGraph'   },
    { label: 'Coverage gaps',        key: 'coverageGaps'   },
  ],
  maintenance: [
    { label: 'Active work orders',   key: 'workOrders'     },
    { label: 'Priority queue',       key: 'priorityQueue'  },
    { label: 'Resource availability',key: 'resources'      },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mkId = () => Math.random().toString(36).slice(2, 10);

/** Pull a human-readable string out of a raw Bedrock trace object. */
function extractTraceText(raw: any): string {
  if (typeof raw === 'string') return raw;
  const t = raw?.trace ?? raw;

  // orchestrationTrace → rationale
  const ot = t?.orchestrationTrace;
  if (ot?.rationale?.text)                              return ot.rationale.text;
  if (ot?.observation?.finalResponse?.text)             return ot.observation.finalResponse.text;
  if (ot?.invocationInput?.actionGroupInvocationInput)
    return `Calling tool: ${ot.invocationInput.actionGroupInvocationInput.actionGroupName ?? 'unknown'}`;
  if (ot?.invocationInput?.toolUse?.name)               return `Calling: ${ot.invocationInput.toolUse.name}`;
  if (ot?.modelInvocationOutput?.rawResponse?.content)  return ot.modelInvocationOutput.rawResponse.content.slice(0, 200);
  if (ot?.modelInvocationInput)                         return 'Consulting model…';

  // preProcessingTrace
  const pre = t?.preProcessingTrace;
  if (pre?.modelInvocationOutput?.parsedResponse?.rationale) return pre.modelInvocationOutput.parsedResponse.rationale;

  // postProcessingTrace
  const post = t?.postProcessingTrace;
  if (post?.modelInvocationOutput?.parsedResponse?.text)     return post.modelInvocationOutput.parsedResponse.text;

  // fallback: stringify and trim
  try { return JSON.stringify(t).slice(0, 160); } catch { return '…'; }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentChatPanelProps {
  contextType: 'livemap' | 'network' | 'maintenance';
  context?: Record<string, any>;
  availableSessions?: Array<{ sessionId: string; label: string; geohash?: string }>;
}

interface ThinkingTrace {
  id:   string;
  text: string;
}

interface Message {
  id:             string;
  role:           'user' | 'assistant' | 'error';
  content:        string;
  timestamp:      number;
  traces?:        ThinkingTrace[];
  isThinking?:    boolean;
  thinkDuration?: number;
  hazards?: Array<{
    hazardId:   string;
    latitude:   number;
    longitude:  number;
    hazardType: string;
    priority:   number;
  }>;
}
interface ContextAttachment {
  id:    string;
  label: string;
  data:  Record<string, any>;
}
// ─── Component ───────────────────────────────────────────────────────────────

export function AgentChatPanel({ contextType, context = {}, availableSessions = [] }: AgentChatPanelProps) {
  const [messages, setMessages]           = useState<Message[]>([]);
  const [query, setQuery]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [sessionId, setSessionId]         = useState<string>(() => mkId());
  const [collapsed, setCollapsed]         = useState(false);
  const [panelWidth, setPanelWidth]       = useState(DEFAULT_WIDTH);
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());
  const [attachments, setAttachments]     = useState<ContextAttachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const pinMenuRef     = useRef<HTMLDivElement>(null);
  const attachMenuRef  = useRef<HTMLDivElement>(null);
  const hasHydrated    = useRef(false);
  const isDragging     = useRef(false);
  const startX         = useRef(0);
  const startW         = useRef(0);

  // ── Hydrate from localStorage on mount; save on every subsequent change ─────
  useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      try {
        const raw = localStorage.getItem(`vigia:chat:${contextType}`);
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved.messages) && saved.messages.length > 0) {
            setMessages((saved.messages as Message[]).map((m: Message) =>
              m.isThinking ? { ...m, isThinking: false, content: m.content || '[interrupted]' } : m
            ));
          }
          if (saved.sessionId) setSessionId(saved.sessionId);
        }
      } catch {}
      return;
    }
    try {
      localStorage.setItem(
        `vigia:chat:${contextType}`,
        JSON.stringify({ messages, sessionId })
      );
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, sessionId]);

  // ── Close attach menu on outside click ─────────────────────────────────
  useEffect(() => {
    if (!showAttachMenu) return;
    const onDown = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node))
        setShowAttachMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showAttachMenu]);

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
    
    if (contextType === 'livemap') {
      // Listen for direct urban planner results
      (window as any).__urbanPlannerResultTrigger = () => {
        const result = (window as any).__urbanPlannerResult;
        if (result?.message) {
          setCollapsed(false);
          setMessages(prev => [...prev, { 
            id: mkId(), 
            role: 'assistant', 
            content: result.message, 
            timestamp: Date.now() 
          }]);
          
          // Merge route context into component context for future queries
          if (result.context) {
            Object.assign(context, result.context);
          }
        }
      };
      
      // Listen for general agent triggers
      (window as any).__triggerAgent = () => {
        const msg = (window as any).__agentMessage;
        const ctx = (window as any).__agentContext;
        if (msg && ctx) { 
          setCollapsed(false);
          sendQuery(msg, ctx);
        }
      };
      
      return () => {
        delete (window as any).__urbanPlannerResultTrigger;
        delete (window as any).__urbanPlannerResult;
        delete (window as any).__triggerAgent;
        delete (window as any).__agentMessage;
        delete (window as any).__agentContext;
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextType]);

  // Show diff analysis as initial message (append, don't replace)
  // Track shown diffs by their display name to avoid duplicates on reload
  useEffect(() => {
    console.log('🔍 AgentChatPanel context.diffAnalysis:', context.diffAnalysis);
    if (context.diffAnalysis && context.currentDiff) {
      const diffId = `${context.currentDiff.sessionA.id}-${context.currentDiff.sessionB.id}`;

      // IMPORTANT: use the functional updater for de-dupe so we always compare
      // against the latest hydrated message list (avoids stale closure on reload).
      setMessages(prev => {
        const alreadyShown = prev.some(m =>
          m.role === 'assistant' &&
          typeof m.content === 'string' &&
          m.content.includes('Diff Analysis') &&
          m.content.includes(context.currentDiff.displayName)
        );

        if (alreadyShown) {
          console.log('⏭️ Diff analysis already shown for:', diffId);
          return prev;
        }

        const nextContent = String(context.diffAnalysis ?? '').trim();
        const last = prev[prev.length - 1];
        const lastContent = typeof last?.content === 'string' ? last.content.trim() : '';
        if (last?.role === 'assistant' && lastContent && lastContent === nextContent) {
          console.log('⏭️ Skipping consecutive duplicate assistant message for:', diffId);
          return prev;
        }

        console.log('✅ Appending diff analysis message for:', diffId);
        return [...prev, {
          id: mkId(),
          role: 'assistant',
          content: context.diffAnalysis!,
          timestamp: Date.now(),
        }];
      });
    }
  }, [context.diffAnalysis, context.currentDiff]);

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

  const clearHistory = () => {
    setMessages([]);
    setAttachments([]);
    const newSid = mkId();
    setSessionId(newSid);
    try { localStorage.removeItem(`vigia:chat:${contextType}`); } catch {}
  };

  // Derive attach-menu options from static list + passed sessions
  const attachOptions: ContextAttachment[] = [
    ...(STATIC_ATTACH_OPTIONS[contextType] ?? []).map(o => ({
      id:    `ctx-${o.key}`,
      label: o.label,
      data:  { [o.key]: context[o.key] ?? null },
    })),
    ...availableSessions.map(s => ({
      id:    `sess-${s.sessionId}`,
      label: s.label,
      data:  { sessionId: s.sessionId, geohash: s.geohash, sessionLabel: s.label },
    })),
  ];

  // Simple markdown renderer (bold, remove emojis)
  const renderMarkdown = (text: string) => {
    // Remove emojis
    const noEmoji = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    
    // Split by ** for bold
    const parts = noEmoji.split(/(\*\*[^*]+\*\*)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Send a query to the orchestration agent
  const sendQuery = async (q?: string, contextOverride?: Record<string, any>) => {
    const text = (q ?? query).trim();
    if (!text || loading) return;

    if (textareaRef.current) {
      textareaRef.current.style.height = '30px';
    }
    setQuery('');

    const userMsg: Message = { id: mkId(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Emit usage event for rate limit tracking
    window.dispatchEvent(new CustomEvent('vigia-agent-query'));

    try {
      // Detect query types
      const isUrbanPlanning = /\b(path|route|construction|road|optimal|build)\b/i.test(text);
      const isMaintenance = /\b(maintenance|repair|prioritize|cost|fix)\b/i.test(text) || context.type === 'maintenance';
      
      if (contextType === 'network') {
        // Use network-analysis API for network context
        const attachCtx = attachments.reduce<Record<string, any>>((acc, a) => ({ ...acc, ...a.data }), {});
        const res = await fetch('/api/agent/network-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text,
            context: { ...context, ...attachCtx, ...contextOverride },
          }),
        });
        
        if (res.status === 429) {
          const data = await res.json();
          const retryAfter = Math.ceil((data.retryAfter || 60000) / 1000);
          setMessages(prev => [...prev, { 
            id: mkId(), 
            role: 'assistant', 
            content: `⚠️ ${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`, 
            timestamp: Date.now() 
          }]);
          return;
        }
        
        const data = await res.json();
        const content = data.analysis ?? data.message ?? JSON.stringify(data);
        setMessages(prev => [...prev, { id: mkId(), role: 'assistant', content, timestamp: Date.now() }]);
      } else if (contextType === 'livemap' && isUrbanPlanning) {
        // Use urban-planning API for path/route queries
        const attachCtx = attachments.reduce<Record<string, any>>((acc, a) => ({ ...acc, ...a.data }), {});
        const fullContext = { ...context, ...attachCtx, ...contextOverride };
        
        // Only use urban-planning API for actual coordinate-based routing
        const hasCoordinates = (fullContext.pinA && fullContext.pinB) || (fullContext.start && fullContext.end);
        
        if (!hasCoordinates) {
          // For text queries about routes, use regular chat API
          const res = await fetch('/api/agent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: text,
              context: fullContext,
            }),
          });
          
          if (res.status === 429) {
            const data = await res.json();
            const retryAfter = Math.ceil((data.retryAfter || 60000) / 1000);
            setMessages(prev => [...prev, { 
              id: mkId(), 
              role: 'assistant', 
              content: `⚠️ ${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`, 
              timestamp: Date.now() 
            }]);
            return;
          }
          
          const data = await res.json();
          const content = data.analysis ?? data.message ?? JSON.stringify(data);
          setMessages(prev => [...prev, { id: mkId(), role: 'assistant', content, timestamp: Date.now() }]);
          return;
        }
        
        // Use coordinates for actual route calculation
        const res = await fetch('/api/agent/urban-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: fullContext.pinA || fullContext.start,
            end: fullContext.pinB || fullContext.end,
            constraints: { avoidHazardTypes: ['POTHOLE', 'DEBRIS'] }
          }),
        });
        
        if (res.status === 429) {
          const data = await res.json();
          const retryAfter = Math.ceil((data.retryAfter || 60000) / 1000);
          setMessages(prev => [...prev, { 
            id: mkId(), 
            role: 'assistant', 
            content: `⚠️ ${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`, 
            timestamp: Date.now() 
          }]);
          return;
        }
        
        if (!res.ok) {
          const error = await res.json();
          setMessages(prev => [...prev, { 
            id: mkId(), 
            role: 'assistant', 
            content: `Error calculating route: ${error.error || 'Unknown error'}`, 
            timestamp: Date.now() 
          }]);
          return;
        }
        
        const data = await res.json();
        const content = data.analysis ?? data.message ?? JSON.stringify(data);
        
        // Emit path data if available for map rendering
        if (data.pathData) {
          (window as any).__urbanPlannerPath = data.pathData;
          (window as any).__urbanPlannerPathTrigger?.();
        }
        
        // Ensure panel is visible
        setCollapsed(false);
        
        setMessages(prev => [...prev, { id: mkId(), role: 'assistant', content, timestamp: Date.now() }]);
        setMessages(prev => [...prev, { id: mkId(), role: 'assistant', content, timestamp: Date.now() }]);
      } else if (isMaintenance && context.type === 'maintenance') {
        // Use maintenance-priority API
        const hazardIds = context.hazardIds || [];
        const res = await fetch('/api/agent/maintenance-priority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hazardIds,
            hazards: context.hazards,
          }),
        });
        
        if (res.status === 429) {
          const data = await res.json();
          const retryAfter = Math.ceil((data.retryAfter || 60000) / 1000);
          setMessages(prev => [...prev, { 
            id: mkId(), 
            role: 'assistant', 
            content: `⚠️ ${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`, 
            timestamp: Date.now() 
          }]);
          return;
        }
        
        const data = await res.json();
        const content = data.analysis ?? data.message ?? JSON.stringify(data);
        setMessages(prev => [...prev, { id: mkId(), role: 'assistant', content, timestamp: Date.now() }]);
      } else {
        // Auto-attach current diff context if viewing a diff
        const attachCtx = attachments.reduce<Record<string, any>>((acc, a) => ({ ...acc, ...a.data }), {});
        
        // Build context string for the agent
        let contextPrompt = '';
        if (context.currentDiff) {
          const diff = context.currentDiff;
          const timeSpan = diff.summary?.timeSpanDays != null ? diff.summary.timeSpanDays.toFixed(1) : 'N/A';
          const degradationScore = diff.summary?.degradationScore != null ? diff.summary.degradationScore.toFixed(1) : 'N/A';
          
          contextPrompt = `\n\nCurrent Context: You are analyzing a diff comparison between two sessions:
- Session A: ${diff.sessionA.city || 'Unknown'} (${new Date(diff.sessionA.timestamp).toLocaleDateString()})
- Session B: ${diff.sessionB.city || 'Unknown'} (${new Date(diff.sessionB.timestamp).toLocaleDateString()})
- Time span: ${timeSpan} days
- Changes: ${diff.changes.newCount || 0} new, ${diff.changes.fixedCount || 0} fixed, ${diff.changes.worsenedCount || 0} worsened, ${diff.changes.unchangedCount || 0} unchanged
- Degradation score: ${degradationScore}/100
- Net change: ${diff.summary?.netChange > 0 ? '+' : ''}${diff.summary?.netChange || 0} hazards

Use this context to answer questions about the infrastructure changes between these two sessions.`;
        }
        
        const fullContext = { 
          type: contextType, 
          ...context, 
          ...attachCtx,
          attachments: attachments.map(a => a.data) 
        };
        
        // Use default chat API for other contexts
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text + contextPrompt,
            sessionId,
            context: fullContext,
          }),
        });
        
        if (res.status === 429) {
          const data = await res.json();
          const retryAfter = Math.ceil((data.retryAfter || 60000) / 1000);
          setMessages(prev => [...prev, { 
            id: mkId(), 
            role: 'assistant', 
            content: `⚠️ ${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`, 
            timestamp: Date.now() 
          }]);
          return;
        }
        
        const data = await res.json();
        const rawTraces: any[] = data.traces ?? data.thinking ?? [];
        const thinkStart = Date.now();

        // Add assistant placeholder immediately so the thinking section appears
        const assistantId = mkId();
        setMessages(prev => [...prev, {
          id: assistantId, role: 'assistant', content: '',
          timestamp: Date.now(), traces: [],
          isThinking: rawTraces.length > 0,
        }]);

        // Auto-expand trace section while thinking is in progress
        if (rawTraces.length > 0) {
          setExpandedTraces(prev => new Set([...prev, assistantId]));
        }

        // Reveal traces one-by-one to simulate streaming
        for (const traceText of rawTraces) {
          await new Promise(r => setTimeout(r, 280 + Math.random() * 320));
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, traces: [...(m.traces ?? []), { id: mkId(), text: extractTraceText(traceText) }] }
              : m
          ));
        }

        // Brief pause before the answer appears
        if (rawTraces.length > 0) await new Promise(r => setTimeout(r, 180));

        const content = data.content ?? data.message ?? JSON.stringify(data);
        const thinkDuration = Date.now() - thinkStart;
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content, isThinking: false, thinkDuration }
            : m
        ));

        // Auto-collapse traces ~1 s after answer lands
        if (rawTraces.length > 0) {
          setTimeout(() => setExpandedTraces(prev => {
            const n = new Set(prev); n.delete(assistantId); return n;
          }), 900);
        }
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
            transition: 'background 0.12s, color 0.12s, border-color 0.12s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background  = 'var(--c-rose-dim)';
            el.style.borderColor = 'var(--c-rose-border)';
            el.style.color       = 'var(--c-rose-2)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background  = 'transparent';
            el.style.borderColor = 'var(--c-border)';
            el.style.color       = 'var(--c-rose-2)';
          }}
        >
          ‹
        </button>
        {/* Rotated label */}
        <div style={{
          marginTop: 14,
          fontSize: '0.52rem', color: 'var(--c-text-3)',
          fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.09em',
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
      <style>{`
        @keyframes agent-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes agent-spin {
          to { transform: rotate(360deg); }
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
            color: 'var(--c-rose-2)', fontFamily: SANS,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {CONTEXT_LABELS[contextType]}
          </span>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* New chat button */}
            <button
              onClick={clearHistory}
              title="New chat"
              style={{
                width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: 'var(--c-text-3)',
                borderRadius: 3,
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'var(--c-rose-dim)';
                el.style.color      = 'var(--c-red)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'transparent';
                el.style.color      = 'var(--c-text-3)';
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
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
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'var(--c-hover)';
                el.style.color      = 'var(--c-text)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'transparent';
                el.style.color      = 'var(--c-text-3)';
              }}
            >
              ›
            </button>
          </div>
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
              fontFamily: SANS, textAlign: 'center',
              marginTop: 20, lineHeight: 1.85,
            }}>
              Ask anything about<br />
              <span style={{ color: 'var(--c-rose-2)' }}>
                {CONTEXT_LABELS[contextType].toLowerCase()}
              </span>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 4,
            }}>

              {/* ── Thinking traces (assistant only) ──────────────────── */}
              {m.role === 'assistant' && (m.traces?.length ?? 0) > 0 && (
                <div style={{
                  maxWidth: '93%',
                  border: '1px solid var(--c-border)',
                  borderRadius: 5, overflow: 'hidden',
                }}>
                  {/* Header — click to expand/collapse */}
                  <button
                    onClick={() => setExpandedTraces(prev => {
                      const n = new Set(prev);
                      n.has(m.id) ? n.delete(m.id) : n.add(m.id);
                      return n;
                    })}
                    style={{
                      width: '100%', padding: '5px 9px',
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'var(--c-elevated)',
                      border: 'none', cursor: 'pointer',
                      color: 'var(--c-text-3)',
                      fontFamily: SANS, fontSize: '0.59rem',
                      textAlign: 'left',
                    }}
                  >
                    {/* Spinner while active, chevron when done */}
                    {m.isThinking ? (
                      <svg
                        width="11" height="11" viewBox="0 0 11 11"
                        style={{ animation: 'agent-spin 1s linear infinite', flexShrink: 0 }}
                      >
                        <circle cx="5.5" cy="5.5" r="4" fill="none"
                          stroke="var(--c-text-3)" strokeWidth="1.4"
                          strokeDasharray="9 5" />
                      </svg>
                    ) : (
                      <svg
                        width="8" height="8" viewBox="0 0 8 8"
                        style={{
                          flexShrink: 0,
                          transform: expandedTraces.has(m.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s',
                        }}
                      >
                        <path d="M2 1.5l3.5 3L2 7"
                          fill="none" stroke="var(--c-text-3)" strokeWidth="1.2"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span style={{ color: m.isThinking ? 'var(--c-text-3)' : 'var(--c-text-2)' }}>
                      {m.isThinking
                        ? 'Thinking…'
                        : `Thought for ${((m.thinkDuration ?? 0) / 1000).toFixed(1)}s`
                      }
                    </span>
                  </button>

                  {/* Traces body */}
                  {expandedTraces.has(m.id) && (
                    <div style={{
                      padding: '8px 10px',
                      background: 'var(--c-bg)',
                      display: 'flex', flexDirection: 'column', gap: 7,
                      maxHeight: 240, overflowY: 'auto',
                      borderTop: '1px solid var(--c-border)',
                    }}>
                      {m.traces!.map((t, ti) => {
                        const isActiveTrace = m.isThinking && ti === m.traces!.length - 1;
                        return (
                          <div key={t.id} style={{
                            fontSize: '0.60rem', lineHeight: 1.6,
                            fontFamily: MONO,
                            wordBreak: 'break-word',
                            ...(isActiveTrace ? {
                              background:
                                'linear-gradient(90deg, var(--c-text-3) 20%, var(--c-text-2) 50%, var(--c-text-3) 80%)',
                              backgroundSize: '200% auto',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              animation: 'agent-shimmer 2.2s linear infinite',
                            } : {
                              color: 'var(--c-text-3)',
                            }),
                          }}>
                            {t.text}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Main content bubble ───────────────────────────────── */}
              {(m.content || m.role === 'user' || m.role === 'error') && (
                <div style={{
                  maxWidth: '93%', padding: '6px 9px', borderRadius: 4,
                  fontSize: '0.65rem', fontFamily: MONO, lineHeight: 1.6,
                  background:
                    m.role === 'user'  ? 'var(--c-rose-dim)'    :
                    m.role === 'error' ? 'rgba(255,60,50,0.08)' :
                                         'var(--c-elevated)',
                  color:
                    m.role === 'user'  ? 'var(--c-rose-2)' :
                    m.role === 'error' ? 'var(--c-red)'    :
                    m.isThinking       ? 'var(--c-text-3)' :
                                         'var(--c-text)',
                  border: `1px solid ${
                    m.role === 'user'  ? 'var(--c-rose-border)' :
                    m.role === 'error' ? 'rgba(255,60,50,0.25)' :
                                         'var(--c-border)'
                  }`,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                </div>
              )}
            </div>
          ))}

          {/* Spinner only for contexts that have no inline trace streaming */}
          {loading && !messages.some(m => m.isThinking) && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' }}>
              <svg
                width="12" height="12" viewBox="0 0 12 12"
                style={{ animation: 'agent-spin 1s linear infinite', flexShrink: 0 }}
              >
                <circle cx="6" cy="6" r="4.5" fill="none"
                  stroke="var(--c-text-3)" strokeWidth="1.5"
                  strokeDasharray="10 4" />
              </svg>
              <span style={{ fontSize: '0.59rem', color: 'var(--c-text-3)', fontFamily: SANS }}>
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
                  fontSize: '0.60rem', fontFamily: SANS,
                  transition: 'background 0.12s, color 0.12s, border-color 0.12s',
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
          flexShrink: 0, position: 'relative',
        }}>

          {/* ── Attach menu popover ─────────────────────────────────────── */}
          {showAttachMenu && (
            <div ref={attachMenuRef} style={{
              position: 'absolute', bottom: 'calc(100% + 4px)',
              left: 0, right: 0,
              background: 'var(--c-elevated)',
              border: '1px solid var(--c-border)',
              borderRadius: 5, overflow: 'hidden',
              boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
              zIndex: 200,
            }}>
              <div style={{
                padding: '5px 10px 3px',
                fontSize: '0.54rem', color: 'var(--c-text-3)',
                fontFamily: SANS, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Add context
              </div>
              {attachOptions.length === 0 ? (
                <div style={{ padding: '6px 10px 8px', fontSize: '0.60rem', color: 'var(--c-text-3)', fontFamily: MONO }}>
                  No sessions available
                </div>
              ) : attachOptions.map(opt => {
                const already = attachments.some(a => a.id === opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (!already) setAttachments(prev => [...prev, opt]);
                      setShowAttachMenu(false);
                    }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '5px 10px',
                      background: already ? 'var(--c-rose-dim)' : 'transparent',
                      border: 'none', borderTop: '1px solid var(--c-border)',
                      cursor: already ? 'default' : 'pointer',
                      color: already ? 'var(--c-rose-2)' : 'var(--c-text-2)',
                      fontFamily: SANS, fontSize: '0.62rem',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                    onMouseEnter={(e) => {
                      if (!already) (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!already) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {already && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Attachment chips ────────────────────────────────────────── */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {attachments.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  padding: '2px 5px 2px 7px',
                  background: 'var(--c-rose-dim)',
                  border: '1px solid var(--c-rose-border)',
                  borderRadius: 10,
                  fontSize: '0.57rem', fontFamily: SANS, color: 'var(--c-rose-2)',
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                  {a.label}
                  <button
                    onClick={() => setAttachments(prev => prev.filter(x => x.id !== a.id))}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--c-rose-2)', padding: '0 0 0 2px',
                      fontSize: '0.75rem', lineHeight: 1,
                      display: 'flex', alignItems: 'center',
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
            {/* Attach button */}
            <button
              onClick={() => setShowAttachMenu(v => !v)}
              title="Add context"
              style={{
                width: 28, height: 28, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: showAttachMenu ? 'var(--c-rose-dim)' : 'transparent',
                border: `1px solid ${showAttachMenu ? 'var(--c-rose-border)' : 'var(--c-border)'}`,
                borderRadius: 3, cursor: 'pointer',
                color: showAttachMenu ? 'var(--c-rose-2)' : 'var(--c-text-3)',
                transition: 'background 0.12s, color 0.12s, border-color 0.12s',
              }}
              onMouseEnter={(e) => {
                if (!showAttachMenu) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--c-rose-border)';
                  el.style.color       = 'var(--c-rose-2)';
                  el.style.background  = 'var(--c-rose-dim)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showAttachMenu) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--c-border)';
                  el.style.color       = 'var(--c-text-3)';
                  el.style.background  = 'transparent';
                }
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

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
                fontSize: '0.64rem', fontFamily: SANS,
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
                fontSize: '0.85rem', transition: 'background 0.12s, color 0.12s, border-color 0.12s',
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
