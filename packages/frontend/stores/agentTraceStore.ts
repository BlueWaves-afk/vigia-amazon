import { create } from 'zustand';
import type { ReActTrace } from '@vigia/shared';

interface AgentTraceStore {
  traces: ReActTrace[];
  filter: string;
  isStreaming: boolean;
  eventSource: EventSource | null;

  connectSSE: (endpoint: string) => void;
  disconnectSSE: () => void;
  appendTrace: (trace: ReActTrace) => void;
  setFilter: (query: string) => void;
  clearTraces: () => void;
}

export const useAgentTraceStore = create<AgentTraceStore>((set, get) => ({
  traces: [],
  filter: '',
  isStreaming: false,
  eventSource: null,

  connectSSE: (endpoint) => {
    const { eventSource: existingSource } = get();
    if (existingSource) {
      existingSource.close();
    }

    // Skip connection if endpoint is not available
    if (!endpoint || endpoint.includes('undefined')) {
      console.log('[AgentTraceStore] SSE endpoint not configured, skipping connection');
      return;
    }

    const apiEndpoint = process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT || 'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';
    const fullEndpoint = endpoint.startsWith('http') ? endpoint : `${apiEndpoint}${endpoint}`;
    
    // Skip if innovation endpoint is not configured
    if (!process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT) {
      console.log('[AgentTraceStore] Innovation API endpoint not configured, skipping SSE connection');
      return;
    }

    const eventSource = new EventSource(fullEndpoint);

    eventSource.onopen = () => {
      console.log('[AgentTraceStore] SSE connected');
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
      console.error('[AgentTraceStore] SSE error:', error);
      set({ isStreaming: false });
      eventSource.close();
      
      // Don't reconnect if endpoint is not configured
      if (!process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT) {
        return;
      }
      
      // Reconnect with exponential backoff
      setTimeout(() => {
        console.log('[AgentTraceStore] Reconnecting...');
        get().connectSSE(endpoint);
      }, 5000);
    };

    set({ eventSource, isStreaming: true });
  },

  disconnectSSE: () => {
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
}));
