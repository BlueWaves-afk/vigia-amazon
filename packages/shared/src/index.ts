// Shared types for VIGIA system

export type HazardType = 'POTHOLE' | 'DEBRIS' | 'ACCIDENT' | 'ANIMAL';

export interface TelemetryPayload {
  hazardType: HazardType;
  lat: number;
  lon: number;
  timestamp: string;
  confidence: number;
}

export interface SignedTelemetry extends TelemetryPayload {
  signature: string;
}

export interface HazardRecord extends TelemetryPayload {
  geohash: string;
  status: 'pending' | 'verified' | 'rejected';
  verificationScore?: number;
  traceId?: string;
}

export interface AgentTrace {
  traceId: string;
  hazardId: string;
  thoughts: string[];
  actions: string[];
  observations: string[];
  finalDecision: string;
  verificationScore: number;
  createdAt: string;
}

export interface LedgerEntry {
  ledgerId: string;
  timestamp: string;
  contributorId: string;
  hazardId: string;
  credits: number;
  previousHash: string;
  currentHash: string;
}
