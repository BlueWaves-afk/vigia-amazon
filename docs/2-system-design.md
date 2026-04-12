# VIGIA: System Design Document

**Project**: Sentient Road Infrastructure System  
**Architecture**: Hybrid Hierarchical Multi-Agent System (H-HMAS)  
**Version**: 2.0 (Consolidated)  
**Last Updated**: March 3, 2026  
**Status**: Production Deployment

---

## 1. Executive Summary

VIGIA implements a serverless, cost-optimized architecture on AWS that transforms smartphones into a distributed road safety intelligence network. The system uses client-side AI inference, Bedrock Agent verification, and a cryptographic ledger to create a trustworthy infrastructure monitoring platform.

**Key Design Principles**:
- **Serverless-First**: Zero idle costs, auto-scaling
- **Edge Intelligence**: AI runs in-browser via Web Workers
- **Cost-Optimized**: Strict AWS Free Tier adherence
- **Privacy-Preserving**: No raw video transmission
- **DePIN-Ready**: Append-only ledger with hash chain

---

## 2. High-Level Architecture

### 2.1 Five-Zone Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ZONE 1: WEB EDGE                        │
│  ┌──────────────┐         ┌─────────────────────────────────┐  │
│  │ Next.js UI   │◄────────┤   Dedicated Web Worker          │  │
│  │ (Amplify)    │         │  - YOLOv8 ONNX Inference        │  │
│  │              │         │  - Web Crypto Signing           │  │
│  │ - Video UI   │         │  - Telemetry Batching           │  │
│  │ - MapLibre   │         │  - Diff Engine                  │  │
│  │ - Analytics  │         │  - Branch Manager               │  │
│  └──────┬───────┘         └─────────────────────────────────┘  │
└─────────┼───────────────────────────────────────────────────────┘
          │ HTTPS POST (Signed Telemetry)
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ZONE 2: INGESTION FUNNEL                   │
│  ┌──────────────┐         ┌─────────────────────────────────┐  │
│  │ API Gateway  │────────►│   Lambda (Validator)            │  │
│  │ (REST)       │         │  - Schema Validation            │  │
│  │              │         │  - Signature Verification       │  │
│  │              │         │  - Geohash Computation          │  │
│  └──────────────┘         └────────┬────────────────────────┘  │
└─────────────────────────────────────┼───────────────────────────┘
                                      │ Write
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ZONE 3: INTELLIGENCE CORE                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              DynamoDB (Hazards Table)                    │  │
│  │  PK: geohash  |  SK: timestamp  |  hazardType | status  │  │
│  └────────┬─────────────────────────────────────────────────┘  │
│           │ DynamoDB Stream                                     │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Lambda (Agent Orchestrator)                            │  │
│  │   - Check Cooldown Table (TTL=300s)                      │  │
│  │   - Invoke Bedrock Agent if new hazard                   │  │
│  └────────┬─────────────────────────────────────────────────┘  │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Agents for Amazon Bedrock (Nova Lite)                  │  │
│  │   ┌────────────────┐      ┌──────────────────┐          │  │
│  │   │ Auditor Agent  │      │ Strategist Agent │          │  │
│  │   │ - Verify via   │─────►│ - Alert or Log?  │          │  │
│  │   │   spatial query│      │ - Calc credits   │          │  │
│  │   └────────────────┘      └──────────────────┘          │  │
│  └────────┬─────────────────────────────────────────────────┘  │
└───────────┼─────────────────────────────────────────────────────┘
            │ If verified (score ≥ 70)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ZONE 4: TRUST LAYER                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         DynamoDB (DePIN Ledger - Append Only)            │  │
│  │  contributorId | hazardId | credits | previousHash |     │  │
│  │                                       currentHash         │  │
│  └────────┬─────────────────────────────────────────────────┘  │
│           │ DynamoDB Stream                                     │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Lambda (Hash Chain Validator)                          │  │
│  │   - Verify currentHash = SHA256(entry + previousHash)    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │ Query for visualization
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ZONE 5: VISUALIZATION LAYER                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Amazon Location Service                                │  │
│  │   - Map Tiles (MapLibre GL JS)                           │  │
│  │   - Route Calculation API                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 DynamoDB Tables

#### Hazards Table
```typescript
{
  geohash: string;           // PK: Precision 7 geohash
  timestamp: string;         // SK: ISO 8601 UTC
  hazardId: string;          // UUID
  hazardType: "POTHOLE" | "DEBRIS" | "ACCIDENT" | "ANIMAL";
  lat: number;
  lon: number;
  confidence: number;        // 0.0-1.0
  signature: string;         // ECDSA P-256
  status: "pending" | "verified" | "rejected" | "unverified";
  verificationScore?: number; // 0-100
  contributorId: string;     // Anonymized hash
  ttl: number;               // Unix timestamp (30 days)
}

// GSI: status-timestamp-index
// PK: status, SK: timestamp
```

#### Cooldown Table
```typescript
{
  cooldownKey: string;       // PK: "{geohash}#{hazardType}"
  processedAt: string;       // ISO 8601 UTC
  ttl: number;               // Unix timestamp (300s)
}
```

#### Agent Traces Table
```typescript
{
  traceId: string;           // PK: UUID
  timestamp: number;         // Sort key
  hazardId: string;
  geohash: string;           // GSI partition key
  contributorId: string;
  reasoning: string;         // Full agent response
  verificationScore: number;
  steps: ReActStep[];        // Structured reasoning
  createdAt: string;
  ttl: number;               // 7 days
}

interface ReActStep {
  thought: string;
  action: string;
  actionInput: Record<string, any>;
  observation: string;
  finalAnswer?: string;
}

// GSI: GeohashIndex
// PK: geohash, SK: timestamp
```

#### DePIN Ledger Table
```typescript
{
  ledgerId: string;          // PK: Always "ledger"
  timestamp: string;         // SK: ISO 8601 UTC
  contributorId: string;
  hazardId: string;
  credits: number;
  previousHash: string;      // SHA-256
  currentHash: string;       // SHA-256
}
```

#### Maintenance Queue Table
```typescript
{
  reportId: string;          // PK: UUID
  reportedAt: number;        // SK: Unix timestamp
  hazardId: string;
  geohash: string;           // GSI partition key
  type: HazardType;
  severity: 1 | 2 | 3 | 4 | 5;
  reportedBy: string;
  estimatedCost: number;     // USD
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  notes?: string;
  signature: string;
}

// GSI: GeohashIndex (PK: geohash, SK: reportedAt)
// GSI: StatusIndex (PK: status, SK: reportedAt)
```

#### Economic Metrics Table
```typescript
{
  sessionId: string;         // PK
  timestamp: number;         // SK
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
```

### 3.2 File Formats

#### Map File (`.map`)
```typescript
interface MapFile {
  version: "1.0";
  sessionId: string;
  timestamp: number;
  hazards: Hazard[];
  metadata: {
    totalHazards: number;
    geohashBounds: string[];
    contributors: string[];
  };
}
```

#### Scenario Branch File (`.scmap`)
```typescript
interface ScenarioBranch extends MapFile {
  parentMapId: string;
  branchId: string;
  branchName: string;
  simulatedChanges: {
    addedHazards: Hazard[];
    removedHazards: string[];
    modifiedSeverity: { id: string; newSeverity: number }[];
  };
  routingResults?: {
    baselineAvgLatency: number;
    branchAvgLatency: number;
    affectedRoutes: number;
    computedAt: number;
  };
}
```

---

## 4. AWS Infrastructure

### 4.1 Lambda Functions

#### Validator Function
- **Runtime**: Node.js 20
- **Memory**: 256 MB
- **Timeout**: 10s
- **Trigger**: API Gateway POST /telemetry
- **Permissions**: DynamoDB PutItem, Secrets Manager GetSecretValue
- **Environment Variables**:
  - `HAZARDS_TABLE_NAME`
  - `PUBLIC_KEY_SECRET_ARN`

#### Agent Orchestrator
- **Runtime**: Python 3.12
- **Memory**: 512 MB
- **Timeout**: 30s
- **Trigger**: DynamoDB Stream (Hazards Table)
- **Permissions**: DynamoDB Read/Write, Bedrock InvokeAgent
- **Environment Variables**:
  - `HAZARDS_TABLE_NAME`
  - `COOLDOWN_TABLE_NAME`
  - `TRACES_TABLE_NAME`
  - `LEDGER_TABLE_NAME`
  - `BEDROCK_AGENT_ID`
  - `BEDROCK_AGENT_ALIAS_ID`

#### Verify Hazard Sync
- **Runtime**: Node.js 20
- **Memory**: 256 MB
- **Timeout**: 25s
- **Trigger**: API Gateway POST /verify-hazard-sync
- **Permissions**: DynamoDB Write, Bedrock InvokeAgent
- **Environment Variables**:
  - `TRACES_TABLE_NAME`
  - `HAZARDS_TABLE_NAME`
  - `BEDROCK_AGENT_ID`
  - `BEDROCK_AGENT_ALIAS_ID`

#### Hash Chain Validator
- **Runtime**: Node.js 20
- **Memory**: 256 MB
- **Timeout**: 10s
- **Trigger**: DynamoDB Stream (Ledger Table)
- **Permissions**: DynamoDB Query, SNS Publish
- **Environment Variables**:
  - `LEDGER_TABLE_NAME`
  - `ALERT_TOPIC_ARN`

#### Routing Agent Branch
- **Runtime**: Node.js 20
- **Memory**: 512 MB
- **Timeout**: 30s
- **Trigger**: API Gateway POST /api/routing-agent/branch
- **Permissions**: Bedrock InvokeAgent
- **Environment Variables**:
  - `ROUTING_AGENT_ID`

#### Agent Trace Streamer
- **Runtime**: Node.js 20
- **Memory**: 1024 MB
- **Timeout**: 60s
- **Trigger**: API Gateway GET /api/agent-traces/stream (SSE)
- **Permissions**: DynamoDB Write, Bedrock InvokeAgent
- **Environment Variables**:
  - `TRACES_TABLE_NAME`
  - `ORCHESTRATOR_AGENT_ID`

#### Maintenance Report Handler
- **Runtime**: Node.js 20
- **Memory**: 256 MB
- **Timeout**: 10s
- **Trigger**: API Gateway POST /api/maintenance/report
- **Permissions**: DynamoDB Write
- **Environment Variables**:
  - `MAINTENANCE_QUEUE_TABLE_NAME`
  - `ECONOMIC_METRICS_TABLE_NAME`

### 4.2 API Gateway Endpoints

#### Ingestion API
```
POST /telemetry
  → Lambda: validator
  → Validates and stores hazard telemetry

POST /verify-hazard-sync
  → Lambda: verify-hazard-sync
  → Manual hazard verification with real-time thinking

OPTIONS /*
  → CORS preflight
```

#### Innovation API
```
POST /api/routing-agent/branch
  → Lambda: routing-agent-branch
  → Returns latency comparison for branch scenarios

GET /api/agent-traces/stream
  → Lambda: agent-trace-streamer
  → SSE endpoint for real-time traces

POST /api/maintenance/report
  → Lambda: maintenance-report-handler
  → Submit maintenance reports

GET /api/economic/metrics?sessionId={id}
  → Query: EconomicMetrics table
  → Returns ROI metrics
```

### 4.3 Bedrock Agents

#### Auditor/Strategist Agent
- **Model**: Amazon Nova Lite
- **Agent ID**: <REDACTED>
- **Alias ID**: <REDACTED>
- **Action Groups**:
  - `queryHazards`: Query DynamoDB for similar hazards
  - `calculateScore`: Compute verification score
- **Instructions**: (See Section 5.3 in original design.md)

#### Routing Agent (Branch-Aware)
- **Model**: Amazon Nova Lite
- **Purpose**: Recompute routes for scenario branches
- **Action Groups**:
  - `calculateRoutes`: Compute optimal routes avoiding hazards

### 4.4 Amazon Location Service

#### Map Resource
- **Name**: vigia-map
- **Style**: Light Gray Canvas
- **Provider**: Esri

#### Route Calculator
- **Name**: vigia-route-calculator
- **Data Source**: Esri
- **Travel Mode**: Car

---

## 5. Frontend Architecture

### 5.1 Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Custom CSS
- **State Management**: Zustand
- **Map Library**: MapLibre GL JS
- **AI Runtime**: ONNX Runtime Web
- **Worker Communication**: Comlink
- **Storage**: IndexedDB (via idb library)

### 5.2 Component Hierarchy

```
App (page.tsx)
├── Sidebar (Activity Groups)
│   ├── MapFileExplorer
│   │   ├── FileTreeItem (.map files)
│   │   └── FileTreeItem (.scmap files, nested)
│   ├── MaintenancePanel
│   │   ├── MaintenanceQueue
│   │   └── ReportForm
│   └── ConsolePanel
│       ├── AgentTracesTab
│       └── DePINLedgerTab (with ROI widget)
│
├── MainStage (Tabbed Map View)
│   ├── MapView (MapLibre GL JS)
│   │   ├── DiffLayer (conditional)
│   │   ├── BranchLayer (conditional)
│   │   └── HazardMarkers
│   ├── ComparisonWidget (branch latency)
│   └── ReasoningTraceViewer
│
├── VideoUploader (Sentinel Eye)
│   ├── VideoPlayer
│   ├── CanvasOverlay (bounding boxes)
│   └── TelemetryLog
│
└── HazardVerificationPanel
    ├── PendingHazardsList
    └── VerificationControls
```

### 5.3 State Management (Zustand Stores)

#### mapFileStore.ts
```typescript
interface MapFileStore {
  files: Map<string, MapFile | ScenarioBranch>;
  activeFileId: string | null;
  diffState: DiffResult | null;
  
  loadFile: (file: File) => Promise<void>;
  createBranch: (parentId: string) => Promise<string>;
  computeDiff: (fileAId: string, fileBId: string) => Promise<DiffResult>;
  saveBranchChanges: (branchId: string, changes: SimulatedChanges) => void;
}
```

#### agentTraceStore.ts
```typescript
interface AgentTraceStore {
  traces: ReActTrace[];
  filter: string;
  isStreaming: boolean;
  
  connectSSE: (url: string) => void;
  disconnectSSE: () => void;
  appendTrace: (trace: ReActTrace) => void;
  filterTraces: (query: string) => void;
}
```

#### economicStore.ts
```typescript
interface EconomicStore {
  metrics: EconomicMetrics | null;
  maintenanceQueue: MaintenanceReport[];
  
  fetchMetrics: (sessionId: string) => Promise<void>;
  submitMaintenanceReport: (report: Omit<MaintenanceReport, "reportId">) => Promise<void>;
}
```

### 5.4 Web Workers

#### hazard-detector.worker.ts
- Load ONNX model (YOLOv8-nano)
- Process video frames (640x640)
- Detect hazards with confidence ≥ 0.6
- Sign telemetry with Web Crypto API
- Return signed payloads

#### diffWorker.ts
- Parse `.map` files
- Compute set differences (new, fixed, worsened)
- Return diff results in <2s

#### branchWorker.ts
- Manage `.scmap` file I/O
- Handle simulation state
- Persist changes to IndexedDB

---

## 6. Security Architecture

### 6.1 Cryptographic Signing

**Algorithm**: ECDSA P-256 (secp256r1)

**Signing Process** (Client-Side):
1. Generate telemetry payload
2. Serialize to canonical JSON
3. Sign with Web Crypto API
4. Encode signature as base64
5. Attach to payload

**Verification Process** (Server-Side):
1. Retrieve public key from Secrets Manager (cached)
2. Decode base64 signature
3. Verify signature against payload
4. Reject if invalid (HTTP 400)

### 6.2 Hash Chain Integrity

**Ledger Entry Hash Computation**:
```typescript
const dataToHash = JSON.stringify({
  contributorId,
  hazardId,
  credits,
  timestamp,
  previousHash
});
const currentHash = SHA256(dataToHash);
```

**Validation**:
- Lambda triggered by DynamoDB Stream
- Fetch previous entry
- Recompute hash
- Compare with stored `currentHash`
- Raise SNS alert if mismatch

### 6.3 IAM Policies

**Principle of Least Privilege**:
- Validator Lambda: DynamoDB PutItem (Hazards Table only)
- Orchestrator Lambda: DynamoDB Read/Write (Hazards, Cooldown, Traces, Ledger)
- Hash Validator Lambda: DynamoDB Query (Ledger Table only), SNS Publish

**API Gateway Authorization**:
- Public endpoints (no auth for demo)
- CORS enabled for frontend origin
- Throttling: 100 req/s, burst 200

---

## 7. Performance Optimizations

### 7.1 Client-Side

**Web Worker Offloading**:
- ONNX inference runs in dedicated worker
- Diff computation in separate worker
- Main thread remains responsive (<16ms tasks)

**Caching**:
- ONNX model cached in browser (no re-download)
- Map tiles cached by MapLibre
- Branch files cached in IndexedDB (LRU eviction)

**Virtual Scrolling**:
- Agent Traces tab uses react-window
- Handles 1000+ traces without performance degradation

### 7.2 Server-Side

**DynamoDB Optimization**:
- On-demand billing (no throttling)
- GSIs for efficient queries
- TTL for automatic cleanup

**Lambda Optimization**:
- Reuse Bedrock Agent sessions
- Cache public key in memory
- Batch DynamoDB writes (max 25 items)

**API Gateway Caching**:
- Route calculations cached (5-minute TTL)
- Branch routing results cached by SHA-256 hash

---

## 8. Cost Analysis

### 8.1 Breakdown (7-Day Voting Phase)

| Service | Usage | Cost |
|---------|-------|------|
| AWS Amplify | 1 app, 10 GB bandwidth | $0.00 (Free Tier) |
| Lambda | 50K invocations, 100 GB-s | $0.00 (Free Tier) |
| API Gateway | 10K requests | $0.00 (Free Tier) |
| DynamoDB | 25 WCU/RCU, 25 GB storage | $0.00 (Free Tier) |
| Bedrock (Nova Lite) | 20M input tokens | ~$1.30 |
| Secrets Manager | 1 secret | ~$0.09 |
| Location Service | 40K route calculations | $0.00 (Free Tier) |
| CloudWatch Logs | 5 GB | $0.00 (Free Tier) |
| **TOTAL** | | **$1.39** |

### 8.2 Cost Monitoring

**CloudWatch Alarms**:
- Bedrock cost > $40 → Switch to cached traces
- DynamoDB consumed capacity > 20 WCU → Alert
- Lambda errors > 1% → Alert

---

## 9. Deployment Architecture

### 9.1 Infrastructure as Code

**AWS CDK v2**:
- `VigiaStack`: Root stack
- `IngestionStack`: API Gateway + Validator Lambda
- `IntelligenceStack`: Orchestrator + Bedrock integration
- `TrustStack`: Ledger + Hash Validator
- `VisualizationStack`: Location Service
- `InnovationStack`: Innovation feature Lambdas

### 9.2 CI/CD Pipeline

**GitHub Actions** (Future):
1. Run tests on PR
2. Deploy to staging on merge to `main`
3. Manual approval for production
4. Deploy to production

**Current**: Manual deployment via `npm run cdk:deploy`

### 9.3 Monitoring

**CloudWatch Dashboards**:
- API Gateway: Request count, latency, errors
- Lambda: Invocations, duration, errors
- DynamoDB: Consumed capacity, throttles
- Bedrock: Token usage, latency

**Alarms**:
- Cost > $5/day
- Error rate > 1%
- p95 latency > 1s

---

## 10. Design Decisions & Trade-offs

### 10.1 Why Web Workers?

**Decision**: Run ONNX inference in dedicated Web Worker

**Rationale**:
- Prevents main thread blocking
- Enables true parallelism
- Better user experience (responsive UI)

**Trade-off**: Increased complexity (Comlink, message passing)

### 10.2 Why Nova Lite?

**Decision**: Use Amazon Nova Lite instead of Claude 3.5 Sonnet

**Rationale**:
- 50x cheaper ($0.06/1M vs $3.00/1M tokens)
- Sufficient for verification task
- Stays within budget

**Trade-off**: Slightly lower reasoning quality

### 10.3 Why Local-First for Innovation Features?

**Decision**: Keep diff/branch operations in IndexedDB

**Rationale**:
- Zero server cost
- Instant operations
- Privacy (no server upload)

**Trade-off**: No cross-device sync

### 10.4 Why DynamoDB Over RDS?

**Decision**: Use DynamoDB for all data storage

**Rationale**:
- Serverless (no idle costs)
- Auto-scaling
- Free tier generous

**Trade-off**: Limited query flexibility (no SQL joins)

---

**Document Status**: ✅ Complete - Production architecture deployed and tested
