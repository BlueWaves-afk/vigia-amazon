'use client';

import React, { useRef, useState, useEffect, FC } from 'react';
import {
  agentFetch,
  AgentRateLimitedError,
  useAgentRateLimitLock,
} from '../lib/client/agent-rate-limit-client';
import { Skeleton } from './Skeleton';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO = "var(--v-font-mono)";
const SANS = "var(--v-font-ui)";
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

const ATTACHMENT_OPTIONS: Record<string, Array<{ type: string; icon: any; label: string }>> = {
  livemap: [
    { type: 'mapBounds', icon: <svg />, label: 'Current map area' },
    { type: 'visibleHazards', icon: <svg />, label: 'Visible hazards' },
    { type: 'activeRoute', icon: <svg />, label: 'Current route' },
  ],
  network: [
    { type: 'selectedNode', icon: <svg />, label: 'Selected node' },
    { type: 'networkGraph', icon: <svg />, label: 'Network topology' },
    { type: 'coverageGaps', icon: <svg />, label: 'Coverage gaps' },
  ],
  maintenance: [
    { type: 'workOrders', icon: <svg />, label: 'Active work orders' },
    { type: 'priorityQueue', icon: <svg />, label: 'Priority queue' },
    { type: 'resources', icon: <svg />, label: 'Resource availability' },
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

/** Parse hazard cards from agent response text. Looks for structured hazard blocks. */
interface ParsedHazard { hazardId: string; lat: number; lon: number; hazardType: string; priority: number; geohash?: string; }
function parseHazardsFromResponse(text: string): ParsedHazard[] {
  const results: ParsedHazard[] = [];

  // Match: "ACCIDENT at (42.36, -71.06) — priority: 85.5"
  const parenRe = /\b(ACCIDENT|POTHOLE|DEBRIS|ANIMAL)\b.*?\((-?\d+\.\d+),\s*(-?\d+\.\d+)\).*?priority[:\s]+(\d+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(text)) !== null) {
    results.push({ hazardId: `parsed-${results.length}`, hazardType: m[1].toUpperCase(), lat: parseFloat(m[2]), lon: parseFloat(m[3]), priority: parseFloat(m[4]) });
  }

  // Match: "latitude: 42.36" / "longitude: -71.06" near a hazard type
  if (results.length === 0) {
    const blockRe = /\b(ACCIDENT|POTHOLE|DEBRIS|ANIMAL)\b[\s\S]{0,300}?latitude[:\s]+(-?\d+\.\d+)[\s\S]{0,100}?longitude[:\s]+(-?\d+\.\d+)[\s\S]{0,100}?priority[:\s]+(\d+(?:\.\d+)?)/gi;
    while ((m = blockRe.exec(text)) !== null) {
      results.push({ hazardId: `parsed-${results.length}`, hazardType: m[1].toUpperCase(), lat: parseFloat(m[2]), lon: parseFloat(m[3]), priority: parseFloat(m[4]) });
    }
  }

  // Fallback: geohash#timestamp IDs only (no coords)
  if (results.length === 0) {
    const idRe = /\b([0-9a-z]{7,9}#\d{4}-\d{2}-\d{2}T[^\s,)]+)/g;
    [...text.matchAll(idRe)].slice(0, 10).forEach((x, i) =>
      results.push({ hazardId: x[1], lat: 0, lon: 0, hazardType: 'HAZARD', priority: 100 - i * 5 })
    );
  }

  return results;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentContextType = 'livemap' | 'network' | 'maintenance';

export interface AgentChatPanelProps {
  contextType: AgentContextType;
  context?: Record<string, any>;
  availableSessions?: Array<{ sessionId: string; label: string; geohash?: string }>;
  onAttach?: (type: string) => void;
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
    lat:        number;
    lon:        number;
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

export const AgentChatPanel: FC<AgentChatPanelProps> = ({ contextType, context = {}, availableSessions = [], onAttach = () => {} }) => {
  const [messages, setMessages]           = useState<Message[]>([]);
  const [query, setQuery]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [sessionId, setSessionId]         = useState<string>(() => mkId());
  const [collapsed, setCollapsed]         = useState(false);
  const [panelWidth, setPanelWidth]       = useState(DEFAULT_WIDTH);
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());
  const [attachments, setAttachments]     = useState<ContextAttachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const { isLocked: isRateLimited, secondsRemaining: rateLimitSecondsRemaining } = useAgentRateLimitLock();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const pinMenuRef     = useRef<HTMLButtonElement>(null);
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
        if (ctx) { 
          setCollapsed(false); 
          // If ctx is an object with query field, extract it
          if (typeof ctx === 'object' && ctx.query) {
            sendQuery(ctx.query, ctx);
          } else {
            // Legacy: ctx is just a string
            sendQuery(ctx);
          }
        }
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
          return prev;
        }

        const nextContent = String(context.diffAnalysis ?? '').trim();
        const last = prev[prev.length - 1];
        const lastContent = typeof last?.content === 'string' ? last.content.trim() : '';
        if (last?.role === 'assistant' && lastContent && lastContent === nextContent) {
          return prev;
        }

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
    if (isRateLimited) {
      setMessages(prev => [...prev, {
        id: mkId(),
        role: 'assistant',
        content: `Rate limited — try again in ${rateLimitSecondsRemaining}s.`,
        timestamp: Date.now(),
      }]);
      return;
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = '30px';
    }
    setQuery('');

    const userMsg: Message = { id: mkId(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    const assistantId = mkId();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      traces: [],
      isThinking: true,
    }]);

    const updateAssistant = (partial: Partial<Message>) => {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, ...partial } : m));
    };

    try {
      // Detect query types
      const isUrbanPlanning = /\b(path|route|construction|road|optimal|build)\b/i.test(text);
      const isMaintenance = /\b(maintenance|repair|prioritize|cost|fix)\b/i.test(text) || context.type === 'maintenance';
      
      if (contextType === 'network') {
        // Use network-analysis API for network context
        const attachCtx = attachments.reduce<Record<string, any>>((acc, a) => ({ ...acc, ...a.data }), {});
        const res = await agentFetch('/api/agent/network-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text,
            context: { ...context, ...attachCtx, ...contextOverride },
          }),
        });
        
        if (res.status === 429) {
          const retryAfterHeader = Number(res.headers.get('Retry-After') || '0');
          const data = await res.json();
          const retryAfter = retryAfterHeader > 0
            ? retryAfterHeader
            : Math.ceil(Number(data.retryAfter || 60000) / 1000);
          updateAssistant({
            content: `${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`,
            isThinking: false,
          });
          return;
        }
        
        const data = await res.json();
        const rawTraces: any[] = data.traces ?? [];
        const thinkStart = Date.now();

        // Auto-expand trace section while thinking is in progress
        if (rawTraces.length > 0) {
          setExpandedTraces(prev => new Set([...prev, assistantId]));
        }

        // Reveal traces one-by-one to simulate streaming
        for (const traceText of rawTraces) {
          await new Promise(r => setTimeout(r, 280 + Math.random() * 320));
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { 
              ...m, 
              traces: [...(m.traces || []), { 
                id: mkId(), 
                text: typeof traceText === 'string' ? traceText : JSON.stringify(traceText, null, 2) 
              }] 
            } : m
          ));
        }

        // After traces, show final content
        const content = data.analysis ?? data.message ?? JSON.stringify(data);
        await new Promise(r => setTimeout(r, 400));
        updateAssistant({ content, isThinking: false });
      } else if (contextType === 'livemap' && isUrbanPlanning) {
        // Use urban-planning API for path/route queries
        const attachCtx = attachments.reduce<Record<string, any>>((acc, a) => ({ ...acc, ...a.data }), {});
        const fullContext = { ...context, ...attachCtx, ...contextOverride };
        
        // Only use urban-planning API for actual coordinate-based routing
        const hasCoordinates = (fullContext.pinA && fullContext.pinB) || (fullContext.start && fullContext.end);
        
        if (!hasCoordinates) {
          // For text queries about routes, use regular chat API
          const res = await agentFetch('/api/agent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: text,
              context: fullContext,
            }),
          });
          
          if (res.status === 429) {
            const retryAfterHeader = Number(res.headers.get('Retry-After') || '0');
            const data = await res.json();
            const retryAfter = retryAfterHeader > 0
              ? retryAfterHeader
              : Math.ceil(Number(data.retryAfter || 60000) / 1000);
            updateAssistant({
              content: `${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`,
              isThinking: false,
            });
            return;
          }
          
          const data = await res.json();
          const content = data.analysis ?? data.message ?? JSON.stringify(data);
          updateAssistant({ content, isThinking: false });
          return;
        }
        
        // Use coordinates for actual route calculation
        const res = await agentFetch('/api/agent/urban-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: fullContext.pinA || fullContext.start,
            end: fullContext.pinB || fullContext.end,
            constraints: { avoidHazardTypes: ['POTHOLE', 'DEBRIS'] }
          }),
        });
        
        if (res.status === 429) {
          const retryAfterHeader = Number(res.headers.get('Retry-After') || '0');
          const data = await res.json();
          const retryAfter = retryAfterHeader > 0
            ? retryAfterHeader
            : Math.ceil(Number(data.retryAfter || 60000) / 1000);
          updateAssistant({
            content: `${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`,
            isThinking: false,
          });
          return;
        }
        
        if (!res.ok) {
          const error = await res.json();
          updateAssistant({
            content: `Error calculating route: ${error.error || 'Unknown error'}`,
            isThinking: false,
          });
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
        
        updateAssistant({ content, isThinking: false });
      } else if (isMaintenance && context.type === 'maintenance') {
        // Use maintenance-priority API
        const hazardIds = context.hazardIds || [];
        const res = await agentFetch('/api/agent/maintenance-priority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hazardIds,
            hazards: context.hazards,
          }),
        });
        
        if (res.status === 429) {
          const retryAfterHeader = Number(res.headers.get('Retry-After') || '0');
          const data = await res.json();
          const retryAfter = retryAfterHeader > 0
            ? retryAfterHeader
            : Math.ceil(Number(data.retryAfter || 60000) / 1000);
          updateAssistant({
            content: `${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`,
            isThinking: false,
          });
          return;
        }
        
        const data = await res.json();
        const content = data.analysis ?? data.message ?? JSON.stringify(data);
        updateAssistant({ content, isThinking: false });
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
        const res = await agentFetch('/api/agent/chat', {
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
          const retryAfterHeader = Number(res.headers.get('Retry-After') || '0');
          const retryAfter = retryAfterHeader > 0
            ? retryAfterHeader
            : Math.ceil(Number(data.retryAfter || 60000) / 1000);
          updateAssistant({
            content: `${data.error}\n\nPlease wait ${retryAfter} seconds before trying again.`,
            isThinking: false,
          });
          return;
        }
        
        const data = await res.json();
        const rawTraces: any[] = data.traces ?? data.thinking ?? [];
        const thinkStart = Date.now();

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

        // Parse hazard cards from response and fire map highlight event
        const parsedHazards = parseHazardsFromResponse(content);
        const isUrgentQuery = /urgent|attention|priorit|critical/i.test(text);
        if (parsedHazards.length > 0 && isUrgentQuery) {
          const top = parsedHazards.find(h => h.lat !== 0 && h.lon !== 0);
          window.dispatchEvent(new CustomEvent('vigia-agent-highlight', {
            detail: {
              hazardIds: parsedHazards.map(h => h.hazardId),
              top: top ? { lat: top.lat, lon: top.lon } : undefined,
            },
          }));
        }

        updateAssistant({ content, isThinking: false, thinkDuration, hazards: parsedHazards.length > 0 && isUrgentQuery ? parsedHazards : undefined });

        // Auto-collapse traces ~1 s after answer lands
        if (rawTraces.length > 0) {
          setTimeout(() => setExpandedTraces(prev => {
            const n = new Set(prev); n.delete(assistantId); return n;
          }), 900);
        }
      }
    } catch (err: any) {
      if (err instanceof AgentRateLimitedError) {
        updateAssistant({
          content: err.message,
          isThinking: false,
        });
      } else {
        updateAssistant({
          role: 'error',
          content: 'Request failed — check your connection.',
          isThinking: false,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
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
        borderLeft: '1px solid var(--v-border-default)',
        background: 'var(--c-panel)',
        position: 'relative',
        overflow: 'hidden',
        padding: 8,
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

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--v-hover)',
          border: '1px solid var(--v-border-default)',
          borderBottom: 'none',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          overflow: 'hidden',
        }}>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{
            height: 36, flexShrink: 0,
            paddingLeft: 14, paddingRight: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--v-border-default)',
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
                  transition: 'background 0.12s, color 0.12s, border-color 0.12s',
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
            padding: '12px 14px 2px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 && (
              <>
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
                <div style={{ padding: '10px 4px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(QUICK_PROMPTS[contextType] ?? []).map(p => (
                    <button
                      key={p}
                      onClick={() => sendQuery(p)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '0.64rem',
                        fontFamily: SANS,
                        color: 'var(--c-text-2)',
                        background: 'var(--c-panel)',
                        border: '1px solid var(--v-border-default)',
                        borderRadius: 4,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 120ms, border-color 120ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--c-hover-md)';
                        e.currentTarget.style.borderColor = 'var(--c-border-md)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--c-panel)';
                        e.currentTarget.style.borderColor = 'var(--v-border-default)';
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 6,
              }}>

                {/* ── Thinking traces (assistant only) ──────────────────── */}
                {m.role === 'assistant' && (m.isThinking || (m.traces?.length ?? 0) > 0) && (
                  <div style={{ padding: '0 0 2px 0' }}>
                    {m.isThinking ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img
                          src="/logo.svg"
                          alt="VIGIA"
                          style={{ width: 14, height: 14, opacity: 0.7 }}
                        />
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ animation: 'agent-spin 1s linear infinite' }}
                        >
                          <path
                            fill="var(--c-text-3)"
                            d="M8 16a8 8 0 1 0 0-16a8 8 0 0 0 0 16Zm0-2a6 6 0 1 1 0-12a6 6 0 0 1 0 12Z"
                            opacity=".25"
                          />
                          <path
                            fill="var(--c-text-2)"
                            d="M8 0a8 8 0 0 1 8 8h-2a6 6 0 0 0-6-6V0Z"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <img
                            src="/logo.svg"
                            alt="VIGIA"
                            style={{ width: 14, height: 14, opacity: 0.7 }}
                          />
                          <button
                            onClick={() => setExpandedTraces(prev => {
                              const next = new Set(prev);
                              next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                              return next;
                            })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, color: 'var(--c-text-3)', fontSize: '0.6rem', fontFamily: SANS }}
                          >
                            <span style={{ fontSize: '0.5rem' }}>{expandedTraces.has(m.id) ? '▼' : '▶'}</span>
                            {`${m.traces?.length ?? 0} reasoning steps`}
                          </button>
                        </div>
                        {expandedTraces.has(m.id) && (
                          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, borderLeft: '1px solid var(--v-border-subtle)', paddingLeft: 10 }}>
                            {m.traces?.map((tr, i) => (
                              <div key={tr.id} style={{ fontSize: '0.62rem', fontFamily: MONO, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
                                <span style={{ color: 'var(--c-text-4)', marginRight: 6 }}>{i + 1}.</span>
                                {tr.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Message content ─────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div
                    className={m.role === 'user' ? 'user-message' : 'assistant-message'}
                    style={{
                      padding: m.role === 'user' ? '8px 12px' : '8px 12px',
                      borderRadius: 8,
                      fontSize: '0.7rem',
                      lineHeight: 1.7,
                      border: m.role === 'user' ? '1px solid var(--v-border-default)' : '1px solid transparent',
                      background: m.role === 'user' ? 'var(--c-panel)' : 'var(--c-bg-card)',
                      color: 'var(--c-text-2)',
                      fontFamily: SANS,
                      marginLeft: m.role === 'user' ? '32px' : 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {m.role === 'assistant' && m.isThinking && !m.content ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                        <Skeleton width="85%" height={10} />
                        <Skeleton width="70%" height={10} />
                        <Skeleton width="55%" height={10} />
                      </div>
                    ) : (
                      m.role === 'assistant' ? renderMarkdown(m.content) : m.content
                    )}
                    {/* ── Hazard cards ── */}
                    {m.hazards && m.hazards.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {m.hazards.map((h, i) => (
                          <button
                            key={h.hazardId}
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('vigia-agent-highlight', {
                                detail: {
                                  hazardIds: [h.hazardId],
                                  top: h.lat !== 0 ? { lat: h.lat, lon: h.lon } : undefined,
                                },
                              }));
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '7px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                              border: '1px solid color-mix(in srgb, #ff2d55 35%, var(--v-border-subtle))',
                              background: 'color-mix(in srgb, #ff2d55 8%, var(--c-panel))',
                              color: 'var(--c-text-2)', fontFamily: MONO, fontSize: '0.65rem',
                              transition: 'background 0.12s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, #ff2d55 16%, var(--c-panel))')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'color-mix(in srgb, #ff2d55 8%, var(--c-panel))')}
                          >
                            <span>
                              <span style={{ color: '#ff2d55', marginRight: 6 }}>#{i + 1}</span>
                              {h.hazardType}
                              {h.lat !== 0 && <span style={{ color: 'var(--c-text-3)', marginLeft: 8 }}>{h.lat.toFixed(4)}, {h.lon.toFixed(4)}</span>}
                            </span>
                            <span style={{ color: '#ff2d55', fontWeight: 700 }}>P{Math.round(h.priority)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Spinner only for contexts that have no inline trace streaming */}


        </div>

        {/* ── Input area ─────────────────────────────────────────────────── */}
        <div style={{
          padding: '6px 10px 8px',
          border: '1px solid var(--v-border-default)',
          background: 'var(--v-hover)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 36,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
        }}>
          {/* Attachments */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
              {attachments.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'var(--c-panel)',
                  border: '1px solid var(--v-border-default)',
                  borderRadius: 3, padding: '2px 5px',
                  fontSize: '0.6rem', fontFamily: SANS,
                  color: 'var(--c-text-2)',
                }}>
                  <span>{a.label}</span>
                  <button
                    onClick={() => setAttachments(p => p.filter(pa => pa.id !== a.id))}
                    style={{
                      background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                      color: 'var(--c-text-3)', display: 'flex',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-text-3)'}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
          }}>
            {/* Attach button */}
            <div style={{ position: 'relative' }}>
              <button
                ref={pinMenuRef as React.RefObject<HTMLButtonElement>}
                onClick={() => setShowAttachMenu(v => !v)}
                title="Attach context"
                style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: '1px solid var(--c-border-1)', cursor: 'pointer',
                  color: 'var(--c-text-3)', borderRadius: 6,
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-text)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-text-3)'}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M6.364 7.636l-2.829 2.829a2.5 2.5 0 103.536 3.536l4.95-4.95a4 4 0 10-5.657-5.657l-5.657 5.657a5.5 5.5 0 107.778 7.778l.707-.707"
                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
              {/* Attach menu */}
              {showAttachMenu && (
                <div
                  ref={attachMenuRef}
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 4px)',
                    left: 0,
                    marginBottom: 4,
                    width: 200,
                    maxHeight: 250,
                    overflowY: 'auto',
                    background: 'var(--c-bg)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 4,
                    boxShadow: '0 4px 12px #00000044',
                    zIndex: 100,
                  }}
                >
                  <div style={{
                    fontSize: '0.6rem',
                    fontFamily: SANS,
                    color: 'var(--c-text-3)',
                    padding: '4px 8px',
                  }}>
                    ATTACH CONTEXT
                  </div>
                  {(ATTACHMENT_OPTIONS[contextType] ?? []).map(opt => (
                    <button
                      key={opt.type}
                      onClick={() => {
                        onAttach(opt.type);
                        setShowAttachMenu(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'var(--c-text-2)',
                        fontSize: '0.7rem',
                        fontFamily: SANS,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-hover-sm)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ opacity: 0.6 }}>{opt.icon}</div>
                      <div>{opt.label}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask the agent…"
              disabled={loading || isRateLimited}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                resize: 'none',
                padding: '6px 4px',
                fontSize: '0.68rem',
                fontFamily: SANS,
                color: 'var(--c-text)',
                maxHeight: 120,
                lineHeight: 1.5,
              }}
              rows={1}
            />
            <button
              onClick={() => sendQuery(query)}
              disabled={loading || !query.trim() || isRateLimited}
              style={{
                width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: '1px solid var(--c-border-1)',
                cursor: 'pointer', color: 'var(--c-text-3)',
                borderRadius: 6,
                transition: 'color 0.12s, border-color 0.12s',
              }}
              onMouseEnter={(e) => { if (!loading && query.trim()) e.currentTarget.style.color = 'var(--c-rose-2)'; }}
              onMouseLeave={(e) => { if (!loading && query.trim()) e.currentTarget.style.color = 'var(--c-text-3)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M13 1L1 6l5 1 1 5 5-11z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {isRateLimited && (
            <div style={{ fontSize: '0.58rem', color: 'var(--c-red)', textAlign: 'center', marginTop: 4, fontFamily: SANS }}>
              Rate limited. Please wait {rateLimitSecondsRemaining}s.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
