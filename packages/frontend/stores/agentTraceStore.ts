import { create } from 'zustand';
import type { ReActTrace } from '@/types/shared';

const RECONNECT_MAX_DELAY_MS = 30_000;
const LOG_THROTTLE_MS = 10_000;

interface AgentTraceStore {
  traces: ReActTrace[];
  filter: string;
  isStreaming: boolean;
  eventSource: EventSource | null;
  activeHazardId: string | null;

  connectSSE: (endpoint: string) => void;
  disconnectSSE: () => void;
  appendTrace: (trace: ReActTrace) => void;
  setFilter: (query: string) => void;
  clearTraces: () => void;
  setActiveHazardId: (id: string | null) => void;
}

export const useAgentTraceStore = create<AgentTraceStore>((set, get) => ({
  traces: [],
  filter: '',
  isStreaming: false,
  eventSource: null,
  activeHazardId: null,

  connectSSE: (endpoint) => {
    // These are intentionally kept outside Zustand state to avoid rerenders.
    // They are attached to the function object so they persist across calls.
    const self = get().connectSSE as unknown as {
      _reconnectTimer?: ReturnType<typeof setTimeout> | null;
      _reconnectAttempts?: number;
      _lastLogAt?: number;
      _manuallyDisconnected?: boolean;
    };

    const clearReconnectTimer = () => {
      if (self._reconnectTimer) {
        clearTimeout(self._reconnectTimer);
        self._reconnectTimer = null;
      }
    };

    self._manuallyDisconnected = false;
    self._reconnectAttempts = self._reconnectAttempts ?? 0;
    clearReconnectTimer();

    const { eventSource: existingSource } = get();

    // Skip connection if endpoint is not available
    if (!endpoint || endpoint.includes('undefined')) {
      if (existingSource) existingSource.close();
      set({ eventSource: null, isStreaming: false });
      return;
    }

    const apiEndpoint = process.env.NEXT_PUBLIC_INNOVATION_API_URL || 'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';
    const fullEndpoint = endpoint.startsWith('http') ? endpoint : `${apiEndpoint}${endpoint}`;
    
    // Skip if innovation endpoint is not configured
    if (!process.env.NEXT_PUBLIC_INNOVATION_API_URL) {
      if (existingSource) existingSource.close();
      set({ eventSource: null, isStreaming: false });
      return;
    }

    // If we're already connected/connecting to the same stream, keep it.
    if (
      existingSource &&
      existingSource.url === fullEndpoint &&
      existingSource.readyState !== EventSource.CLOSED
    ) {
      set({
        eventSource: existingSource,
        isStreaming: existingSource.readyState === EventSource.OPEN,
      });
      return;
    }

    if (existingSource) {
      existingSource.close();
    }
    set({ eventSource: null, isStreaming: false });

    const eventSource = new EventSource(fullEndpoint);

    // Track the active source immediately; mark streaming only after onopen.
    set({ eventSource, isStreaming: false });

    eventSource.onopen = () => {
      self._reconnectAttempts = 0;
      set({ isStreaming: true });
    };

    eventSource.onmessage = (event) => {
      try {
        const trace: ReActTrace = JSON.parse(event.data);
        get().appendTrace(trace);
      } catch (error) {
        console.error('[AgentTraceStore] Failed to parse trace:', error);
      }
    };

    eventSource.onerror = (error) => {
      // Note: browsers surface *any* stream interruption via onerror (including
      // normal idle timeouts / server closes). EventSource will often retry on
      // its own (readyState === CONNECTING), so treat this as a disconnect signal.
      const now = Date.now();
      const shouldLog = !self._lastLogAt || now - self._lastLogAt > LOG_THROTTLE_MS;
      if (shouldLog) {
        self._lastLogAt = now;
        const readyState = eventSource.readyState;
        const stateLabel = readyState === EventSource.CONNECTING
          ? 'CONNECTING'
          : readyState === EventSource.OPEN
            ? 'OPEN'
            : 'CLOSED';
        // Use warn (not error) to avoid tripping dev overlays/test harnesses.
        console.warn('[AgentTraceStore] SSE disconnected (will retry):', { state: stateLabel, error });
      }

      set({ isStreaming: false });

      // If the user explicitly disconnected, do not reconnect.
      if (self._manuallyDisconnected) {
        return;
      }
      
      // Don't reconnect if endpoint is not configured
      if (!process.env.NEXT_PUBLIC_INNOVATION_API_URL) {
        return;
      }

      // Let the browser handle automatic retries while CONNECTING.
      if (eventSource.readyState === EventSource.CONNECTING) {
        return;
      }

      // If the stream is CLOSED, manually reconnect with exponential backoff.
      if (eventSource.readyState === EventSource.CLOSED) {
        const attempts = (self._reconnectAttempts ?? 0) + 1;
        self._reconnectAttempts = attempts;
        const baseDelay = Math.min(RECONNECT_MAX_DELAY_MS, 1000 * Math.pow(2, Math.min(attempts, 5)));
        const jitter = Math.floor(Math.random() * 250);
        const delay = baseDelay + jitter;

        clearReconnectTimer();
        self._reconnectTimer = setTimeout(() => {
          if (self._manuallyDisconnected) return;
          get().connectSSE(endpoint);
        }, delay);
      }
    };
  },

  disconnectSSE: () => {
    const self = get().connectSSE as unknown as {
      _reconnectTimer?: ReturnType<typeof setTimeout> | null;
      _manuallyDisconnected?: boolean;
    };
    self._manuallyDisconnected = true;
    if (self._reconnectTimer) {
      clearTimeout(self._reconnectTimer);
      self._reconnectTimer = null;
    }

    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null, isStreaming: false });
    }
  },

  appendTrace: (trace) => {
    set((state) => ({
      traces: [...state.traces, trace].slice(-1000), // Keep last 1000 traces
    }));
  },

  setFilter: (query) => set({ filter: query }),
  clearTraces: () => set({ traces: [] }),
  setActiveHazardId: (id) => set({ activeHazardId: id }),
}));
