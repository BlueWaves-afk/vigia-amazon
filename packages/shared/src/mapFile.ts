import { z } from 'zod';

// Hazard schema
export const HazardSchema = z.object({
  id: z.string().uuid(),
  geohash: z.string().length(7),
  lat: z.number(),
  lon: z.number(),
  type: z.enum(['POTHOLE', 'DEBRIS', 'FLOODING', 'ACCIDENT']),
  severity: z.number().int().min(1).max(5),
  timestamp: z.number(),
  signature: z.string(),
  contributorId: z.string(),
  frameHash: z.string().optional(),
});

export type Hazard = z.infer<typeof HazardSchema>;

// MapFile schema (real forensic data)
export const MapFileSchema = z.object({
  version: z.literal('1.0'),
  sessionId: z.string(),
  timestamp: z.number(),
  hazards: z.array(HazardSchema),
  metadata: z.object({
    totalHazards: z.number(),
    geohashBounds: z.array(z.string()),
    contributors: z.array(z.string()),
  }),
});

export type MapFile = z.infer<typeof MapFileSchema>;

// ScenarioBranch schema (simulation data)
export const ScenarioBranchSchema = MapFileSchema.extend({
  parentMapId: z.string(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  simulatedChanges: z.object({
    addedHazards: z.array(HazardSchema),
    removedHazards: z.array(z.string().uuid()),
    modifiedSeverity: z.array(z.object({
      id: z.string().uuid(),
      newSeverity: z.number().int().min(1).max(5),
    })),
  }),
  routingResults: z.object({
    baselineAvgLatency: z.number(),
    branchAvgLatency: z.number(),
    affectedRoutes: z.number(),
    computedAt: z.number(),
  }).optional(),
});

export type ScenarioBranch = z.infer<typeof ScenarioBranchSchema>;

// Diff result types
export interface DiffResult {
  fileA: { sessionId: string; timestamp: number };
  fileB: { sessionId: string; timestamp: number };
  changes: {
    new: Hazard[];
    fixed: Hazard[];
    worsened: Array<{ before: Hazard; after: Hazard }>;
    unchanged: Hazard[];
  };
  summary: {
    totalNew: number;
    totalFixed: number;
    totalWorsened: number;
    netChange: number;
  };
}
