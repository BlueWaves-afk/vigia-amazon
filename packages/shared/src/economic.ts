import { z } from 'zod';

// Maintenance report schema
export const MaintenanceReportSchema = z.object({
  reportId: z.string().uuid(),
  hazardId: z.string().uuid(),
  geohash: z.string().length(7),
  type: z.enum(['POTHOLE', 'DEBRIS', 'FLOODING', 'ACCIDENT']),
  severity: z.number().int().min(1).max(5),
  reportedBy: z.string(),
  reportedAt: z.number(),
  estimatedCost: z.number(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']),
  notes: z.string().max(500).optional(),
  signature: z.string(),
});

export type MaintenanceReport = z.infer<typeof MaintenanceReportSchema>;

// Economic metrics schema
export const EconomicMetricsSchema = z.object({
  sessionId: z.string(),
  timestamp: z.number(),
  totalHazardsDetected: z.number(),
  totalEstimatedRepairCost: z.number(),
  totalPreventedDamageCost: z.number(),
  roiMultiplier: z.number(),
  hazardBreakdown: z.object({
    POTHOLE: z.object({ count: z.number(), avgCost: z.number() }),
    DEBRIS: z.object({ count: z.number(), avgCost: z.number() }),
    FLOODING: z.object({ count: z.number(), avgCost: z.number() }),
  }),
});

export type EconomicMetrics = z.infer<typeof EconomicMetricsSchema>;
