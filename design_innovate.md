# VIGIA Innovation Features - Design Document

**Document Version**: 1.0  
**Last Updated**: 2026-03-01  
**Status**: Draft - Technical Design

---

## 1. System Architecture Overview

### 1.1 Architecture Updates

The innovation features extend VIGIA's existing 5-zone architecture:

```
┌─────────────────────────────────────────────────────────────┐
│ Zone 1: Web Edge (Enhanced)                                 │
│ ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│ │ Map File System │  │ Diff Engine  │  │ Branch Manager  │ │
│ │ (IndexedDB)     │  │ (Web Worker) │  │ (Web Worker)    │ │
│ └─────────────────┘  └──────────────┘  └─────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Activity Groups: Map | Maintenance | Console            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Zone 2: Ingestion (Unchanged)                               │
│ API Gateway → Lambda Validator → DynamoDB                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Zone 3: Intelligence (Enhanced)                             │
│ ┌──────────────────┐  ┌────────────────────────────────┐   │
│ │ Bedrock Agent    │  │ Routing Agent (Branch-Aware)   │   │
│ │ (ReAct Tracing)  │  │ (Scenario Simulation)          │   │
│ └──────────────────┘  └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ New Tables:                                                  │
│ • MaintenanceQueue (GSI: status, geohash)                   │
│ • EconomicMetrics (aggregated ROI data)                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Diagrams

#### Diff Tool Flow
```
User drags FileB onto FileA
    ↓
DiffWorker.postMessage({fileA, fileB})
    ↓
Parse JSON → Compute Set Diff → Classify Changes
    ↓
Return {new: [], fixed: [], worsened: []}
    ↓
MapLibre renders markers (RED/GREEN/ORANGE)
```

#### Branch Simulation Flow
```
User right-clicks .map → "Create Branch"
    ↓
Generate .scmap file in IndexedDB
    ↓
User toggles infrastructure / adds hazards
    ↓
Click "Recompute Routes"
    ↓
POST /api/routing-agent {branchId, hazards[]}
    ↓
Lambda invokes Bedrock with branch context
    ↓
Return {baselineLatency, branchLatency, delta}
    ↓
UI displays comparison widget
```

#### ReAct Streaming Flow
```
Telemetry arrives → Lambda Orchestrator
    ↓
Invoke Bedrock Agent with enableTrace: true
    ↓
SSE stream: {thought, action, observation, answer}
    ↓
Frontend EventSource listener
    ↓
Append to Agent Traces tab (virtual scroll)
    ↓
Store in DynamoDB AgentTraces (TTL: 7 days)
```

---

## 2. Data Structures

### 2.1 Map File Format (`.map`)

```typescript
interface MapFile {
  version: "1.0";
  sessionId: string; // "Session-2026-03-01"
  timestamp: number; // Unix epoch
  hazards: Hazard[];
  metadata: {
    totalHazards: number;
    geohashBounds: string[]; // Coverage area
    contributors: string[]; // Unique contributor IDs
  };
}

interface Hazard {
  id: string; // UUID
  geohash: string; // Precision 7
  type: "POTHOLE" | "DEBRIS" | "FLOODING" | "ACCIDENT";
  severity: 1 | 2 | 3 | 4 | 5;
  timestamp: number;
  signature: string; // ECDSA-P256
  contributorId: string;
  frameHash?: string; // SHA-256 of detection frame
}
```

### 2.2 Scenario Branch Format (`.scmap`)

```typescript
interface ScenarioBranch extends MapFile {
  parentMapId: string; // Reference to original .map file
  branchId: string; // "branch-001"
  branchName: string; // User-defined
  simulatedChanges: {
    addedHazards: Hazard[]; // Manually added
    removedHazards: string[]; // IDs of toggled-off hazards
    modifiedSeverity: { id: string; newSeverity: number }[];
  };
  routingResults?: {
    baselineAvgLatency: number; // seconds
    branchAvgLatency: number;
    affectedRoutes: number;
    computedAt: number;
  };
}
```

### 2.3 Diff Result Structure

```typescript
interface DiffResult {
  fileA: { sessionId: string; timestamp: number };
  fileB: { sessionId: string; timestamp: number };
  changes: {
    new: Hazard[]; // In B, not in A
    fixed: Hazard[]; // In A, not in B
    worsened: { before: Hazard; after: Hazard }[]; // Severity increased
    unchanged: Hazard[]; // Same ID, same severity
  };
  summary: {
    totalNew: number;
    totalFixed: number;
    totalWorsened: number;
    netChange: number; // new - fixed
  };
}
```

### 2.4 ReAct Trace Structure

```typescript
interface ReActTrace {
  traceId: string;
  timestamp: number;
  geohash: string;
  contributorId: string;
  steps: ReActStep[];
}

interface ReActStep {
  thought: string; // Agent's reasoning
  action: string; // Function call (e.g., "query_dynamodb_history")
  actionInput: Record<string, any>;
  observation: string; // Function result
  finalAnswer?: string; // Only on last step
}
```

### 2.5 Maintenance Queue Entry

```typescript
interface MaintenanceReport {
  reportId: string; // UUID
  hazardId: string; // FK to Hazard
  geohash: string; // GSI partition key
  type: Hazard["type"];
  severity: number;
  reportedBy: string; // Contributor ID
  reportedAt: number;
  estimatedCost: number; // USD
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  notes?: string;
  signature: string; // ECDSA signature of report
}
```

### 2.6 Economic Metrics

```typescript
interface EconomicMetrics {
  sessionId: string; // Partition key
  timestamp: number; // Sort key
  totalHazardsDetected: number;
  totalEstimatedRepairCost: number;
  totalPreventedDamageCost: number; // Based on industry averages
  roiMultiplier: number; // preventedCost / repairCost
  hazardBreakdown: {
    POTHOLE: { count: number; avgCost: number };
    DEBRIS: { count: number; avgCost: number };
    FLOODING: { count: number; avgCost: number };
  };
}
```

---

## 3. Frontend Architecture

### 3.1 State Management (Zustand Stores)

```typescript
// stores/mapFileStore.ts
interface MapFileStore {
  files: Map<string, MapFile | ScenarioBranch>;
  activeFileId: string | null;
  diffState: DiffResult | null;
  
  loadFile: (file: File) => Promise<void>;
  createBranch: (parentId: string) => Promise<string>;
  computeDiff: (fileAId: string, fileBId: string) => Promise<DiffResult>;
  saveBranchChanges: (branchId: string, changes: SimulatedChanges) => void;
}

// stores/agentTraceStore.ts
interface AgentTraceStore {
  traces: ReActTrace[];
  filter: string;
  isStreaming: boolean;
  
  connectSSE: () => void;
  appendTrace: (trace: ReActTrace) => void;
  filterTraces: (query: string) => void;
}

// stores/economicStore.ts
interface EconomicStore {
  metrics: EconomicMetrics | null;
  maintenanceQueue: MaintenanceReport[];
  
  fetchMetrics: (sessionId: string) => Promise<void>;
  submitMaintenanceReport: (report: Omit<MaintenanceReport, "reportId">) => Promise<void>;
}
```

### 3.2 Web Worker Architecture

```typescript
// workers/diffWorker.ts
self.onmessage = (e: MessageEvent<{ fileA: MapFile; fileB: MapFile }>) => {
  const { fileA, fileB } = e.data;
  
  const hazardsA = new Map(fileA.hazards.map(h => [h.id, h]));
  const hazardsB = new Map(fileB.hazards.map(h => [h.id, h]));
  
  const newHazards = [...hazardsB.values()].filter(h => !hazardsA.has(h.id));
  const fixedHazards = [...hazardsA.values()].filter(h => !hazardsB.has(h.id));
  const worsened = [...hazardsB.values()]
    .filter(hB => {
      const hA = hazardsA.get(hB.id);
      return hA && hB.severity > hA.severity;
    })
    .map(hB => ({ before: hazardsA.get(hB.id)!, after: hB }));
  
  self.postMessage({ new: newHazards, fixed: fixedHazards, worsened });
};

// workers/branchWorker.ts
// Handles branch file I/O and simulation state management
```

### 3.3 Component Hierarchy

```
App
├── Sidebar (Activity Groups)
│   ├── MapFileExplorer
│   │   ├── FileTreeItem (.map files)
│   │   └── FileTreeItem (.scmap files, nested)
│   ├── MaintenancePanel (NEW)
│   │   ├── MaintenanceQueue
│   │   └── ReportForm
│   └── ConsolePanel
│       ├── AgentTracesTab (ENHANCED)
│       └── DePINLedgerTab (ENHANCED with ROI widget)
│
├── MainStage (Tabbed Map View)
│   ├── MapView (MapLibre GL JS)
│   │   ├── DiffLayer (conditional)
│   │   ├── BranchLayer (conditional)
│   │   └── HazardMarkers
│   └── ComparisonWidget (for branch latency)
│
└── BottomPanel (Terminal/Console)
    └── LiveReActLog
```

---

## 4. Backend Architecture

### 4.1 New Lambda Functions

#### `routing-agent-branch` (Node.js 20)
```typescript
export const handler = async (event: APIGatewayProxyEvent) => {
  const { branchId, hazards } = JSON.parse(event.body!);
  
  // Fetch branch file from S3 or reconstruct from request
  const branchHazards = hazards.filter(h => !h.removed);
  
  // Invoke Bedrock Agent with branch context
  const response = await bedrockAgent.invokeAgent({
    agentId: process.env.ROUTING_AGENT_ID,
    sessionId: branchId,
    inputText: `Recompute routes avoiding these hazards: ${JSON.stringify(branchHazards)}`,
    enableTrace: false, // Routing doesn't need traces
  });
  
  // Parse routing results
  const { baselineLatency, branchLatency } = parseRoutingResponse(response);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      baselineAvgLatency: baselineLatency,
      branchAvgLatency: branchLatency,
      delta: branchLatency - baselineLatency,
      deltaPercent: ((branchLatency - baselineLatency) / baselineLatency) * 100,
    }),
  };
};
```

#### `agent-trace-streamer` (Node.js 20)
```typescript
export const handler = awslambda.streamifyResponse(
  async (event, responseStream) => {
    const { telemetry } = JSON.parse(event.body!);
    
    const response = await bedrockAgent.invokeAgent({
      agentId: process.env.ORCHESTRATOR_AGENT_ID,
      sessionId: telemetry.contributorId,
      inputText: JSON.stringify(telemetry),
      enableTrace: true, // KEY: Enable ReAct tracing
    });
    
    // Stream traces as SSE
    for await (const chunk of response.completion) {
      if (chunk.trace) {
        const trace = parseReActTrace(chunk.trace);
        responseStream.write(`data: ${JSON.stringify(trace)}\n\n`);
        
        // Also persist to DynamoDB
        await dynamodb.putItem({
          TableName: "AgentTraces",
          Item: { ...trace, ttl: Math.floor(Date.now() / 1000) + 604800 }, // 7 days
        });
      }
    }
    
    responseStream.end();
  }
);
```

#### `maintenance-report-handler` (Node.js 20)
```typescript
export const handler = async (event: APIGatewayProxyEvent) => {
  const report: Omit<MaintenanceReport, "reportId"> = JSON.parse(event.body!);
  
  // Verify signature
  const isValid = await verifyECDSA(report.signature, report.hazardId);
  if (!isValid) return { statusCode: 403, body: "Invalid signature" };
  
  // Calculate estimated cost
  const estimatedCost = calculateRepairCost(report.type, report.severity);
  
  const reportId = uuidv4();
  await dynamodb.putItem({
    TableName: "MaintenanceQueue",
    Item: { ...report, reportId, estimatedCost, status: "PENDING" },
  });
  
  // Update economic metrics
  await updateEconomicMetrics(report.geohash, estimatedCost);
  
  return {
    statusCode: 201,
    body: JSON.stringify({ reportId, estimatedCost }),
  };
};

function calculateRepairCost(type: string, severity: number): number {
  const baseCosts = {
    POTHOLE: 150,
    DEBRIS: 50,
    FLOODING: 1000,
    ACCIDENT: 0, // Not repairable
  };
  return baseCosts[type] * (1 + severity * 0.2); // 20% increase per severity level
}
```

### 4.2 DynamoDB Table Schemas

#### MaintenanceQueue Table
```yaml
TableName: MaintenanceQueue
PartitionKey: reportId (String)
SortKey: reportedAt (Number)
GSI:
  - IndexName: GeohashIndex
    PartitionKey: geohash
    SortKey: reportedAt
  - IndexName: StatusIndex
    PartitionKey: status
    SortKey: reportedAt
Attributes:
  - hazardId, type, severity, reportedBy, estimatedCost, status, notes, signature
```

#### EconomicMetrics Table
```yaml
TableName: EconomicMetrics
PartitionKey: sessionId (String)
SortKey: timestamp (Number)
Attributes:
  - totalHazardsDetected, totalEstimatedRepairCost, totalPreventedDamageCost
  - roiMultiplier, hazardBreakdown (Map)
```

### 4.3 API Gateway Routes

```
POST /api/routing-agent/branch
  → routing-agent-branch Lambda
  → Returns latency comparison

GET /api/agent-traces/stream
  → agent-trace-streamer Lambda (response streaming)
  → SSE endpoint

POST /api/maintenance/report
  → maintenance-report-handler Lambda
  → Returns reportId and estimatedCost

GET /api/economic/metrics?sessionId={id}
  → Fetch from EconomicMetrics table
```

---

## 5. UI/UX Design

### 5.1 Map File System Explorer (Enhanced)

```
┌─ MAP FILE SYSTEM ────────────────────┐
│ 📁 Sessions                          │
│   📄 Session-2026-01-01.map          │
│   📄 Session-2026-02-01.map          │
│   📄 Session-2026-03-01.map          │
│     ├─ 🌿 branch-flood-scenario.scmap│
│     └─ 🌿 branch-bridge-closure.scmap│
│                                       │
│ [Right-click context menu]           │
│ • Open                                │
│ • Create Branch                       │
│ • Compare with...                     │
│ • Export                              │
└───────────────────────────────────────┘
```

**Drag-and-Drop Behavior**:
- Dragging `.map` file onto another `.map` file triggers diff computation
- Visual feedback: Dashed border around drop target
- Diff results render in main map view with legend overlay

### 5.2 Diff Visualization

```
┌─ MAP VIEW (DIFF MODE) ───────────────────────────────┐
│ [Legend]                                              │
│ 🔴 +12 New Hazards    🟢 -5 Fixed    🟠 3 Worsened   │
│                                                       │
│ [Map with colored markers]                            │
│ • Red markers: New potholes detected in March         │
│ • Green markers: Potholes fixed since January         │
│ • Orange markers: Severity increased (e.g., 2 → 4)    │
│                                                       │
│ [Export Diff Report] [Clear Diff]                     │
└───────────────────────────────────────────────────────┘
```

### 5.3 Branch Simulation UI

```
┌─ MAP VIEW (BRANCH MODE) ─────────────────────────────┐
│ 📂 Active: branch-flood-scenario.scmap                │
│                                                       │
│ [Map with dashed-border markers for simulated changes]│
│                                                       │
│ [Simulation Controls]                                 │
│ • Click hazard to toggle closure                      │
│ • Right-click map to add simulated hazard             │
│                                                       │
│ [Recompute Routes] ← Triggers Bedrock Agent           │
│                                                       │
│ [Comparison Widget]                                   │
│ ┌─────────────────────────────────────────────────┐  │
│ │ Baseline: 12 min avg                            │  │
│ │ Branch:   18 min avg (+50%)                     │  │
│ │ Affected Routes: 23                             │  │
│ └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### 5.4 Agent Traces Tab (Enhanced)

```
┌─ AGENT TRACES ───────────────────────────────────────┐
│ [Search: geohash or contributor ID] [Clear Filter]    │
│                                                       │
│ 17:45:32.123 | Trace #42                             │
│ ├─ Thought: "Multiple reports of POTHOLE at 7tg3v"   │
│ ├─ Action: query_dynamodb_history(geohash="7tg3v")   │
│ ├─ Observation: "Prior report 2h ago by #42"         │
│ └─ Final Answer: "Hazard verified. Updating ledger"  │
│                                                       │
│ 17:46:01.456 | Trace #43                             │
│ ├─ Thought: "Signature validation required"          │
│ ├─ Action: verify_ecdsa(signature="0x...")           │
│ ├─ Observation: "Valid signature from Contributor #8"│
│ └─ Final Answer: "Telemetry accepted"                │
│                                                       │
│ [Auto-scroll: ON] [Export Traces]                    │
└───────────────────────────────────────────────────────┘
```

### 5.5 DePIN Ledger Tab (Enhanced with ROI Widget)

```
┌─ DePIN LEDGER ───────────────────────────────────────┐
│ [City Health ROI - Last 7 Days]                      │
│ ┌─────────────────────────────────────────────────┐  │
│ │ Total Hazards Detected: 47                      │  │
│ │ Estimated Repair Cost: $8,450                   │  │
│ │ Prevented Damage Cost: $14,100                  │  │
│ │ ROI Multiplier: 1.67x                           │  │
│ │                                                 │  │
│ │ Breakdown:                                      │  │
│ │ • Potholes: 32 ($6,200 repair, $9,600 prevented)│  │
│ │ • Debris: 12 ($1,250 repair, $2,400 prevented)  │  │
│ │ • Flooding: 3 ($3,000 repair, $2,100 prevented) │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ [Hash Chain Ledger]                                   │
│ Block #1234: 0xabc...def                              │
│ Block #1235: 0x123...456                              │
└───────────────────────────────────────────────────────┘
```

### 5.6 Maintenance Activity Group (NEW)

```
┌─ MAINTENANCE ─────────────────────────────────────────┐
│ [Report Hazard for Maintenance]                       │
│                                                       │
│ Hazard ID: abc-123-def                                │
│ Type: POTHOLE                                         │
│ Severity: 4/5                                         │
│ Location: Geohash 7tg3v2k                             │
│ Estimated Repair Cost: $420                           │
│                                                       │
│ Notes (optional):                                     │
│ ┌─────────────────────────────────────────────────┐  │
│ │ Large pothole near intersection, high traffic   │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ [Submit Report] [Cancel]                              │
│                                                       │
│ [Maintenance Queue]                                   │
│ • Report #001: POTHOLE at 7tg3v (PENDING)             │
│ • Report #002: DEBRIS at 9q5ct (IN_PROGRESS)          │
└───────────────────────────────────────────────────────┘
```

---

## 6. Performance Optimizations

### 6.1 Diff Computation
- Use Web Worker to avoid blocking main thread
- Implement early exit for identical files (SHA-256 hash comparison)
- Limit diff to 500 hazards per file (paginate larger files)

### 6.2 Branch Rendering
- Use MapLibre's data-driven styling for dashed borders
- Cache branch files in IndexedDB with LRU eviction (max 10 branches)
- Debounce route recomputation (500ms delay after last edit)

### 6.3 ReAct Streaming
- Use virtual scrolling (react-window) for trace log (1000+ entries)
- Batch DynamoDB writes (max 25 items per batch)
- Client-side filtering without re-fetching

### 6.4 Economic Calculations
- Pre-aggregate metrics in DynamoDB (update on hazard verification)
- Cache ROI widget data in Zustand store (5-minute TTL)
- Use DynamoDB Streams to trigger metric updates

---

## 7. Security Considerations

### 7.1 Branch File Integrity
- Branch files inherit parent's signature chain
- Simulated changes are clearly marked (cannot be confused with real data)
- Branch files cannot be uploaded to DynamoDB (local-only)

### 7.2 Maintenance Report Validation
- Require ECDSA signature from authenticated contributor
- Rate limit: 10 reports per contributor per hour
- Validate hazard ID exists in DynamoDB before accepting report

### 7.3 ReAct Trace Privacy
- Redact contributor IDs in public-facing traces (show only last 4 chars)
- TTL of 7 days for trace data
- No PII in trace logs

---

## 8. Cost Analysis

### 8.1 Bedrock Costs
- ReAct tracing: No additional cost (built-in feature)
- Branch routing: ~$0.06 per 1M input tokens (Nova Lite)
- Estimated: 50 branch simulations/day × 1000 tokens = $0.003/day

### 8.2 DynamoDB Costs
- MaintenanceQueue: On-demand, ~$0.25/million writes
- EconomicMetrics: Pre-aggregated, ~100 writes/day = $0.000025/day
- AgentTraces: TTL auto-deletion, no storage cost after 7 days

### 8.3 Lambda Costs
- routing-agent-branch: 512MB, ~2s execution = $0.0000083/invocation
- agent-trace-streamer: 1024MB, ~5s execution = $0.0000208/invocation
- maintenance-report-handler: 256MB, ~500ms = $0.0000010/invocation

**Total Estimated Cost**: <$0.50/day for 100 active users

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Diff algorithm: Test with identical files, disjoint files, overlapping files
- Cost calculation: Verify formula for all hazard types and severities
- Signature validation: Test with valid/invalid ECDSA signatures

### 9.2 Integration Tests
- End-to-end diff: Upload two files, verify markers render correctly
- Branch simulation: Create branch, modify hazards, verify routing API call
- ReAct streaming: Mock Bedrock response, verify SSE parsing

### 9.3 Performance Tests
- Diff computation: Benchmark with 500-hazard files (target: <2s)
- Branch rendering: Measure FPS with 100 simulated hazards (target: 60fps)
- Trace streaming: Verify no memory leaks with 1000+ traces

---

## 10. Deployment Plan

### Phase 1: Local-First Features (Week 1)
- Implement Map File System with IndexedDB
- Build Diff Engine (Web Worker)
- Create Branch Manager (Web Worker)

### Phase 2: Backend Integration (Week 2)
- Deploy routing-agent-branch Lambda
- Deploy agent-trace-streamer Lambda
- Create MaintenanceQueue and EconomicMetrics tables

### Phase 3: UI Polish (Week 3)
- Implement Agent Traces tab enhancements
- Build Maintenance activity group
- Add ROI widget to DePIN Ledger

### Phase 4: Testing & Optimization (Week 4)
- Run performance benchmarks
- Conduct usability testing with city engineers
- Optimize Bedrock API calls for cost efficiency

---

**End of Design Document**
