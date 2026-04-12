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
  displayName: string;
  coverage: {
    type: 'city' | 'region' | 'neighborhood' | 'custom';
    name: string;
    boundingBox: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    centerPoint: {
      lat: number;
      lon: number;
      geohash: string;
    };
    geohashPrecision: number;
    geohashTiles: string[];
    areaKm2: number;
  };
  temporal: {
    captureStart: number;
    captureEnd: number;
    createdAt: number;
    finalizedAt?: number;
    duration: number;
    status: 'collecting' | 'finalized' | 'archived';
  };
  location: {
    continent: string;
    country: string;
    state: string;
    region: string;
    city: string;
    neighborhood?: string;
  };
  hazards: Hazard[];
  metadata: {
    totalHazards: number;
    hazardsByType: Record<string, number>;
    severityDistribution: Record<string, number>;
    contributors: string[];
    dataSource: 'manual' | 'video' | 'import';
    tags: string[];
  };
}

export interface ScenarioBranch extends MapFile {
  parentMapId: string;
  branchId: string;
  branchName: string;
  timestamp: number;
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

/** V2 trace written by OrchestratorLambda (VLM pipeline) */
export interface V2Trace {
  traceId: string;
  hazardId: string;
  vlm_reasoning: string;
  vlm_confidence: number | null;
  onnx_confidence: number;
  discovery_bonus: number | null;
  total_score: number | null;
  verdict: 'VERIFIED' | 'REJECTED' | 'UNVERIFIED_VLM_FAILED';
  createdAt: string;
  reward_skipped_reason?: string;
  agent_final_answer?: string;
  react_steps?: Array<{ thought?: string; action?: string; actionInput?: Record<string, unknown>; observation?: string }>;
}
