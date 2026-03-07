import { create } from 'zustand';
import type { EconomicMetrics, MaintenanceReport } from '@/types/shared';

interface EconomicStore {
  metrics: EconomicMetrics | null;
  maintenanceQueue: MaintenanceReport[];
  isLoading: boolean;

  fetchMetrics: (sessionId: string) => Promise<void>;
  submitMaintenanceReport: (report: Omit<MaintenanceReport, 'reportId' | 'estimatedCost'>) => Promise<void>;
  updateMaintenanceReportStatus: (args: { reportId: string; status: MaintenanceReport['status'] }) => Promise<void>;
  fetchMaintenanceQueue: (filters?: { status?: string; geohash?: string }) => Promise<void>;
}

export const useEconomicStore = create<EconomicStore>((set) => ({
  metrics: null,
  maintenanceQueue: [],
  isLoading: false,

  fetchMetrics: async (sessionId) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`/api/economic/metrics?${new URLSearchParams({ sessionId }).toString()}`);
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
      const response = await fetch('/api/maintenance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (!response.ok) throw new Error('Failed to submit report');

      const result = await response.json();
      console.log('[EconomicStore] Report submitted:', result);

      // Optimistically show the new report in the queue immediately.
      if (result?.reportId && typeof result?.estimatedCost === 'number') {
        const optimistic: MaintenanceReport = {
          ...report,
          reportId: String(result.reportId),
          estimatedCost: Number(result.estimatedCost),
        };
        set((state) => ({ maintenanceQueue: [optimistic, ...state.maintenanceQueue] }));
      }

      // Refresh queue
      await useEconomicStore.getState().fetchMaintenanceQueue();
      set({ isLoading: false });
    } catch (error) {
      console.error('[EconomicStore] Failed to submit report:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  updateMaintenanceReportStatus: async ({ reportId, status }) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`/api/maintenance/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, status }),
      });

      if (!response.ok) throw new Error('Failed to update report status');
      await response.json().catch(() => undefined);

      await useEconomicStore.getState().fetchMaintenanceQueue();
      set({ isLoading: false });
    } catch (error) {
      console.error('[EconomicStore] Failed to update report status:', error);
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

      const response = await fetch(`/api/maintenance/queue?${params}`);
      if (!response.ok) throw new Error('Failed to fetch queue');

      const queue: MaintenanceReport[] = await response.json();
      set({ maintenanceQueue: queue, isLoading: false });
    } catch (error) {
      console.error('[EconomicStore] Failed to fetch queue:', error);
      set({ isLoading: false });
    }
  },
}));
