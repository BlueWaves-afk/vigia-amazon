import { create } from 'zustand';
import type { EconomicMetrics, MaintenanceReport } from '@vigia/shared';

interface EconomicStore {
  metrics: EconomicMetrics | null;
  maintenanceQueue: MaintenanceReport[];
  isLoading: boolean;

  fetchMetrics: (sessionId: string) => Promise<void>;
  submitMaintenanceReport: (report: Omit<MaintenanceReport, 'reportId' | 'estimatedCost'>) => Promise<void>;
  fetchMaintenanceQueue: (filters?: { status?: string; geohash?: string }) => Promise<void>;
}

export const useEconomicStore = create<EconomicStore>((set) => ({
  metrics: null,
  maintenanceQueue: [],
  isLoading: false,

  fetchMetrics: async (sessionId) => {
    set({ isLoading: true });
    try {
      const apiEndpoint = process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT || 'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';
      const response = await fetch(`${apiEndpoint}/economic/metrics?sessionId=${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const metrics: EconomicMetrics = await response.json();
      set({ metrics, isLoading: false });
    } catch (error) {
      console.error('[EconomicStore] Failed to fetch metrics:', error);
      set({ isLoading: false });
    }
  },

  submitMaintenanceReport: async (report) => {
    set({ isLoading: true });
    try {
      const apiEndpoint = process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT || 'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';
      const response = await fetch(`${apiEndpoint}/maintenance/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!response.ok) throw new Error('Failed to submit report');

      const result = await response.json();
      console.log('[EconomicStore] Report submitted:', result);

      // Refresh queue
      await useEconomicStore.getState().fetchMaintenanceQueue();
      set({ isLoading: false });
    } catch (error) {
      console.error('[EconomicStore] Failed to submit report:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  fetchMaintenanceQueue: async (filters) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.geohash) params.append('geohash', filters.geohash);

      const apiEndpoint = process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT || 'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';
      const response = await fetch(`${apiEndpoint}/maintenance/queue?${params}`);
      if (!response.ok) throw new Error('Failed to fetch queue');

      const queue: MaintenanceReport[] = await response.json();
      set({ maintenanceQueue: queue, isLoading: false });
    } catch (error) {
      console.error('[EconomicStore] Failed to fetch queue:', error);
      set({ isLoading: false });
    }
  },
}));
