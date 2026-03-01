/**
 * Shared types for VIGIA system
 * Inlined to avoid cross-package import issues in Amplify build
 */

export type HazardType = 'POTHOLE' | 'DEBRIS' | 'FLOODING' | 'ACCIDENT';

export interface Hazard {
  id: string;
  geohash: string;
  lat: number;
  lon: number;
  type: HazardType;
  severity: number;
  timestamp: number;
  signature: string;
  contributorId: string;
  frameHash?: string;
}

export interface MapFile {
  version: '1.0';
  sessionId: string;
  timestamp: number;
  hazards: Hazard[];
  metadata: {
    totalHazards: number;
    geohashBounds: string[];
    contributors: string[];
  };
}

export interface ScenarioBranch extends MapFile {
  parentMapId: string;
  branchId: string;
  branchName: string;
  simulatedChanges: {
    addedHazards: Hazard[];
    removedHazards: string[];
    modifiedSeverity: Array<{
      id: string;
      newSeverity: number;
    }>;
  };
  routingResults?: {
    baselineAvgLatency: number;
    branchAvgLatency: number;
    affectedRoutes: number;
    computedAt: number;
  };
}

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

export interface MaintenanceReport {
  reportId: string;
  hazardId: string;
  geohash: string;
  type: HazardType;
  severity: number;
  reportedBy: string;
  reportedAt: number;
  estimatedCost: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  notes?: string;
  signature: string;
}

export interface EconomicMetrics {
  sessionId: string;
  timestamp: number;
  totalHazardsDetected: number;
  totalEstimatedRepairCost: number;
  totalPreventedDamageCost: number;
  roiMultiplier: number;
  hazardBreakdown: {
    POTHOLE: { count: number; avgCost: number };
    DEBRIS: { count: number; avgCost: number };
    FLOODING: { count: number; avgCost: number };
  };
}

export interface ReActStep {
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation: string;
  finalAnswer?: string;
}

export interface ReActTrace {
  traceId: string;
  timestamp: number;
  geohash: string;
  contributorId: string;
  steps: ReActStep[];
}
