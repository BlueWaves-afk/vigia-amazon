import { City, TerminalLog } from '@/types';

// ─────────────────────────────────────────────
// City Data
// ─────────────────────────────────────────────

export const CITIES: City[] = [
  {
    id: 'new-york',
    name: 'New York',
    region: 'United States',
    coordinates: [-74.006, 40.7128],
    zoom: 12,
    population: '8.3M',
    threatLevel: 'HIGH',
  },
  {
    id: 'los-angeles',
    name: 'Los Angeles',
    region: 'United States',
    coordinates: [-118.2437, 34.0522],
    zoom: 11,
    population: '3.9M',
    threatLevel: 'MEDIUM',
  },
  {
    id: 'chicago',
    name: 'Chicago',
    region: 'United States',
    coordinates: [-87.6298, 41.8781],
    zoom: 12,
    population: '2.7M',
    threatLevel: 'MEDIUM',
  },
  {
    id: 'houston',
    name: 'Houston',
    region: 'United States',
    coordinates: [-95.3698, 29.7604],
    zoom: 11,
    population: '2.3M',
    threatLevel: 'LOW',
  },
  {
    id: 'miami',
    name: 'Miami',
    region: 'United States',
    coordinates: [-80.1918, 25.7617],
    zoom: 12,
    population: '470K',
    threatLevel: 'CRITICAL',
  },
  {
    id: 'seattle',
    name: 'Seattle',
    region: 'United States',
    coordinates: [-122.3321, 47.6062],
    zoom: 12,
    population: '737K',
    threatLevel: 'LOW',
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    region: 'United States',
    coordinates: [-112.074, 33.4484],
    zoom: 11,
    population: '1.6M',
    threatLevel: 'LOW',
  },
];

export function getCityById(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}

// ─────────────────────────────────────────────
// Log Generation
// ─────────────────────────────────────────────

type LogTemplate = {
  category: TerminalLog['category'];
  severity: TerminalLog['severity'];
  message: string;
};

const LOG_TEMPLATES: LogTemplate[] = [
  // HAZARD
  { category: 'HAZARD', severity: 'WARN', message: 'Hazard Detected: POTHOLE | Manhattan Ave & 34th St | Confidence: 0.87' },
  { category: 'HAZARD', severity: 'ERROR', message: 'Hazard Detected: FLOODING | Brooklyn Bridge Approach | Confidence: 0.94' },
  { category: 'HAZARD', severity: 'WARN', message: 'Hazard Detected: CONSTRUCTION | Midtown Tunnel | Confidence: 0.79' },
  { category: 'HAZARD', severity: 'ERROR', message: 'Hazard Alert: DEBRIS | Queens Blvd I-278 | Confidence: 0.88' },
  { category: 'HAZARD', severity: 'INFO', message: 'Hazard Cleared: POTHOLE | 5th Ave & 42nd St | Duration: 02:14:33' },
  { category: 'HAZARD', severity: 'WARN', message: 'Hazard Detected: ICE | FDR Drive NB | Confidence: 0.91' },
  { category: 'HAZARD', severity: 'ERROR', message: 'Critical Zone: ACCIDENT | Lincoln Tunnel Exit | Units Dispatched: 3' },
  // SWARM
  { category: 'SWARM', severity: 'SUCCESS', message: 'Swarm Verification Complete | Nodes: 14/14 | Consensus: UNANIMOUS' },
  { category: 'SWARM', severity: 'INFO', message: 'Swarm Consensus Achieved | Block #48821 | Time: 0.34s' },
  { category: 'SWARM', severity: 'WARN', message: 'Swarm Agent Reconnected | ID: SW-0x4F2A | Downtime: 00:00:07' },
  { category: 'SWARM', severity: 'INFO', message: 'Swarm Route Broadcast | Recipients: 23 | ACK: 23/23' },
  { category: 'SWARM', severity: 'INFO', message: 'Swarm Latency Report | Avg: 12ms | P95: 28ms | P99: 34ms' },
  { category: 'SWARM', severity: 'SUCCESS', message: 'Swarm Quorum Established | Validators: 9/12 | Status: ACTIVE' },
  { category: 'SWARM', severity: 'WARN', message: 'Swarm Node Degraded | ID: SW-0x8C1D | Load: 94% | Action: REBALANCE' },
  // LEDGER
  { category: 'LEDGER', severity: 'SUCCESS', message: 'Ledger Entry Created | Hash: 0x94abf3c1 | Block: #48822' },
  { category: 'LEDGER', severity: 'INFO', message: 'Ledger Verified | Block #48822 | Validators: 12 | Status: CONFIRMED' },
  { category: 'LEDGER', severity: 'SUCCESS', message: 'Ledger Audit Passed | Integrity: 100% | Chain Length: 48823' },
  { category: 'LEDGER', severity: 'INFO', message: 'Ledger Entry: ROUTE_CALCULATED | TxID: 0xfe91b4a2 | Gas: 0' },
  { category: 'LEDGER', severity: 'SUCCESS', message: 'Ledger Sync Complete | Delta: +3 entries | Peers: 8' },
  { category: 'LEDGER', severity: 'INFO', message: 'Ledger Snapshot | Height: 48823 | Size: 14.2MB | CID: Qm7x9f' },
  // SYSTEM
  { category: 'SYSTEM', severity: 'SUCCESS', message: 'Edge Node: ONLINE | Region: us-east-1 | Latency: 8ms' },
  { category: 'SYSTEM', severity: 'INFO', message: 'Cloud Sync: ACTIVE | Queue: 0 | Last Sync: 00:00:02 ago' },
  { category: 'SYSTEM', severity: 'INFO', message: 'Model Inference: 142ms | GPU Util: 63% | Batch: 4' },
  { category: 'SYSTEM', severity: 'INFO', message: 'Cache Flushed | Released: 2.3MB | Hit Rate: 94.2%' },
  { category: 'SYSTEM', severity: 'SUCCESS', message: 'Config Reload: vigia.config.json | Diff: 0 changes' },
  { category: 'SYSTEM', severity: 'WARN', message: 'Memory Pressure: 78% | Threshold: 80% | Action: MONITOR' },
  { category: 'SYSTEM', severity: 'INFO', message: 'Telemetry Flushed | Events: 142 | Endpoint: collector.vigia.internal' },
];

let logIndex = 0;
let globalLogId = 1;

export function getNextLog(): TerminalLog {
  const template = LOG_TEMPLATES[logIndex % LOG_TEMPLATES.length];
  logIndex = (logIndex + Math.floor(Math.random() * 3) + 1) % LOG_TEMPLATES.length;
  const now = new Date();
  const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  return {
    id: `log-${globalLogId++}`,
    timestamp,
    category: template.category,
    severity: template.severity,
    message: template.message,
  };
}

// ─────────────────────────────────────────────
// Mock Route Generation
// ─────────────────────────────────────────────

export function generateMockRoute(
  center: [number, number],
  variant: 'fastest' | 'safest'
): GeoJSON.Feature<GeoJSON.LineString> {
  const offset = variant === 'fastest' ? 0 : 1;
  const amplitude = variant === 'fastest' ? 0.003 : 0.005;
  const coords: [number, number][] = [];

  for (let i = 0; i <= 10; i++) {
    const t = (i / 10) * Math.PI * 2;
    coords.push([
      center[0] + (i - 5) * 0.009,
      center[1] + Math.sin(t + offset * 1.2) * amplitude,
    ]);
  }

  return {
    type: 'Feature',
    properties: { variant },
    geometry: { type: 'LineString', coordinates: coords },
  };
}

export const THREAT_LEVEL_COLORS = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
  CRITICAL: '#DC2626',
} as const;

export const CATEGORY_COLORS: Record<TerminalLog['category'], string> = {
  HAZARD: '#EF4444',
  SWARM: '#3B82F6',
  LEDGER: '#10B981',
  SYSTEM: '#8B95A1',
};

export const SEVERITY_COLORS: Record<TerminalLog['severity'], string> = {
  INFO: '#8B95A1',
  WARN: '#F59E0B',
  ERROR: '#EF4444',
  SUCCESS: '#10B981',
};
