# Innovation Features Implementation Guardrails

**Purpose**: Enforce design rules and architectural constraints when implementing the four innovation features (Diff Tool, Scenario Branching, ReAct Logs, Economic Layer).

---

## 🎯 Primary Source of Truth

All implementation MUST strictly adhere to:
1. `requirements_innovate.md` - Functional requirements and acceptance criteria
2. `design_innovate.md` - Technical architecture and data structures
3. `tasks_innovate.md` - Granular implementation checklist

---

## ⛔ Mandatory Architectural Constraints

### Local-First Operations
- **REQUIRED**: Diff computation and branch management MUST use IndexedDB + Web Workers
- **NEVER**: Send `.map` or `.scmap` files to DynamoDB unless user explicitly clicks "Save" or "Export"
- **REASON**: Cost optimization and privacy (local-only forensics)
- **QUOTA**: 50MB IndexedDB limit, LRU eviction for >20 files

### File Format Separation
- **REQUIRED**: Use `.map` extension for real forensic data, `.scmap` for simulation branches
- **NEVER**: Mix simulated hazards with real telemetry in the same file
- **VISUAL DISTINCTION**: `.scmap` files MUST render with dashed borders and branch icon (🌿)
- **REASON**: Prevent confusion between real data and "what-if" scenarios

### Bedrock Cost Controls
- **REQUIRED**: Use Amazon Nova Lite for all Bedrock Agent calls
- **REQUIRED**: Cache branch routing results (cache key: SHA-256 hash of hazard array)
- **REQUIRED**: Enable `enableTrace: true` for ReAct logs (no additional cost)
- **NEVER**: Make redundant Bedrock calls for identical branch scenarios
- **BUDGET**: <$0.10 per branch simulation, <$0.50/day total

### Performance Targets
- **Diff Computation**: <2 seconds for 500 hazards (Web Worker, non-blocking)
- **Branch Rendering**: 60fps with 100 simulated hazards (MapLibre data-driven styling)
- **ReAct Streaming**: <500ms latency from Bedrock response to UI render
- **ROI Widget**: <1 second update after new hazard verification

---

## 🎨 UI/UX Design Rules

### Monochrome Palette (Strict Adherence)
- **Backgrounds**: #FFFFFF (main), #F5F5F5 (panels)
- **Borders**: #CBD5E1 (1px solid)
- **Diff Colors**: #EF4444 (red/new), #10B981 (green/fixed), #F59E0B (orange/worsened)
- **Typography**: Inter (UI), JetBrains Mono (data/logs/traces)

### Activity Group Layout
- **REQUIRED**: Follow VS Code IDE pattern (Sidebar | Main Stage | Bottom Panel)
- **NEW GROUPS**: 
  - "Map File System" (existing, enhanced with drag-and-drop)
  - "Maintenance" (new, for bounty reports)
- **TABS**: Agent Traces (enhanced), DePIN Ledger (enhanced with ROI widget)

### Component Hierarchy
```
Sidebar
├── MapFileExplorer (drag-and-drop for diff)
│   ├── .map files (📄 icon)
│   └── .scmap files (🌿 icon, nested under parent)
├── MaintenancePanel (NEW)
│   ├── ReportForm
│   └── MaintenanceQueue
└── ConsolePanel
    ├── AgentTracesTab (virtual scrolling, JetBrains Mono)
    └── DePINLedgerTab (ROI widget at top)
```

---

## 📊 Data Structure Rules

### TypeScript Interfaces (Non-Negotiable)
- **REQUIRED**: Define all interfaces in `packages/shared/types/`
- **REQUIRED**: Use Zod for runtime validation
- **REQUIRED**: Export to both frontend and backend packages

### Key Interfaces
```typescript
// MapFile: Real forensic data
interface MapFile {
  version: "1.0";
  sessionId: string;
  timestamp: number;
  hazards: Hazard[];
  metadata: { totalHazards, geohashBounds, contributors };
}

// ScenarioBranch: Simulation data (extends MapFile)
interface ScenarioBranch extends MapFile {
  parentMapId: string;
  branchId: string;
  simulatedChanges: { addedHazards, removedHazards, modifiedSeverity };
  routingResults?: { baselineAvgLatency, branchAvgLatency, delta };
}

// ReActTrace: Explainable AI logs
interface ReActTrace {
  traceId: string;
  timestamp: number;
  steps: { thought, action, actionInput, observation, finalAnswer }[];
}

// MaintenanceReport: Economic layer
interface MaintenanceReport {
  reportId: string;
  hazardId: string;
  estimatedCost: number; // Formula: baseCost[type] * (1 + severity * 0.2)
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
}
```

---

## 🔧 Implementation Patterns

### Web Workers (Required for Heavy Computation)
- **Diff Engine**: `workers/diffWorker.ts` (set difference algorithm)
- **Branch Manager**: `workers/branchWorker.ts` (file I/O, simulation state)
- **NEVER**: Block main thread for >16ms (60fps target)

### State Management (Zustand Stores)
- `mapFileStore.ts`: Files, diff state, branch operations
- `agentTraceStore.ts`: ReAct logs, SSE connection, filtering
- `economicStore.ts`: Metrics, maintenance queue, ROI calculations

### API Endpoints (New Routes)
```
POST /api/routing-agent/branch
  → Lambda: routing-agent-branch
  → Returns: {baselineAvgLatency, branchAvgLatency, delta}

GET /api/agent-traces/stream
  → Lambda: agent-trace-streamer (SSE)
  → Streams: ReAct logs in real-time

POST /api/maintenance/report
  → Lambda: maintenance-report-handler
  → Returns: {reportId, estimatedCost}

GET /api/economic/metrics?sessionId={id}
  → Query: EconomicMetrics DynamoDB table
```

---

## 🗄️ DynamoDB Table Rules

### New Tables (CDK Definitions Required)
1. **AgentTraces**
   - Partition: `traceId`, Sort: `timestamp`
   - GSI: `GeohashIndex` (partition: `geohash`)
   - TTL: 7 days (auto-delete old traces)

2. **MaintenanceQueue**
   - Partition: `reportId`, Sort: `reportedAt`
   - GSI: `GeohashIndex`, `StatusIndex`
   - No TTL (permanent records)

3. **EconomicMetrics**
   - Partition: `sessionId`, Sort: `timestamp`
   - Pre-aggregated data (updated via DynamoDB Streams)

### Billing Mode
- **REQUIRED**: On-demand billing (stay within free tier)
- **NEVER**: Use provisioned capacity (risk of throttling)

---

## 🔒 Security Rules

### Signature Validation
- **REQUIRED**: Branch files inherit parent's ECDSA signature chain
- **REQUIRED**: Maintenance reports require valid ECDSA signature
- **NEVER**: Accept unsigned simulated hazards

### Data Separation
- **REQUIRED**: Simulated hazards MUST have visual distinction (dashed borders, tooltips)
- **NEVER**: Allow `.scmap` files to be uploaded to DynamoDB as real data
- **REASON**: Prevent contamination of forensic ledger

### Privacy
- **REQUIRED**: Redact contributor IDs in public traces (show last 4 chars only)
- **REQUIRED**: No PII in ReAct logs
- **TTL**: 7 days for traces, permanent for maintenance reports

---

## 📈 Cost Monitoring Rules

### Bedrock Costs
- **ALERT**: If branch routing costs exceed $0.10/invocation
- **ACTION**: Increase cache hit rate, reduce hazard array size
- **TARGET**: <$0.50/day for 100 active users

### DynamoDB Costs
- **ALERT**: If write capacity exceeds 25 WCU (free tier limit)
- **ACTION**: Batch writes (max 25 items), use DynamoDB Streams for aggregation
- **TARGET**: Stay within free tier

### Lambda Costs
- **ALERT**: If execution time exceeds 5 seconds (routing agent)
- **ACTION**: Optimize Bedrock prompt, reduce hazard processing
- **TARGET**: <$0.01/day for Lambda invocations

---

## ✅ Testing Requirements

### Unit Tests (80% Coverage Minimum)
- Diff algorithm: Identical files, disjoint files, severity changes
- Cost calculator: All hazard types, severity multipliers
- Signature validation: Valid/invalid ECDSA

### Integration Tests (End-to-End Flows)
- Diff: Upload 2 files → drag-and-drop → verify markers
- Branch: Create branch → toggle hazards → recompute routes → verify widget
- ReAct: Submit telemetry → verify SSE stream → verify DynamoDB persistence
- Economic: Submit report → verify queue → verify ROI widget update

### Performance Tests (Benchmarks)
- Diff: 500 hazards in <2s
- Branch: 100 simulated hazards at 60fps
- ReAct: 100 traces/second without memory leaks
- ROI: Update in <1s

---

## 🚫 Prohibited Actions

### DO NOT:
- ❌ Send `.map` or `.scmap` files to DynamoDB without explicit user action
- ❌ Use Claude 3.5 Sonnet or any premium Bedrock model (use Nova Lite only)
- ❌ Block main thread for heavy computation (use Web Workers)
- ❌ Mix simulated and real hazards in the same data structure
- ❌ Make redundant Bedrock API calls (implement caching)
- ❌ Store traces longer than 7 days (use TTL)
- ❌ Hardcode cost formulas (use configurable JSON)
- ❌ Create new documentation files (use existing requirements/design/tasks)

### ALWAYS:
- ✅ Use IndexedDB for local-first operations
- ✅ Implement LRU eviction (50MB quota, 20 files max)
- ✅ Cache Bedrock responses (SHA-256 hash as key)
- ✅ Use virtual scrolling for >100 list items
- ✅ Validate signatures before accepting reports
- ✅ Update task checkboxes in `tasks_innovate.md` as you complete work
- ✅ Follow monochrome design system (#FFFFFF, #F5F5F5, #CBD5E1)
- ✅ Use JetBrains Mono for all data/logs/traces

---

## 📝 Task Completion Protocol

When implementing tasks from `tasks_innovate.md`:
1. **Read** the corresponding requirement in `requirements_innovate.md`
2. **Reference** the design in `design_innovate.md`
3. **Implement** the minimal code to satisfy acceptance criteria
4. **Test** against performance targets and cost limits
5. **Update** the checkbox in `tasks_innovate.md` from `[ ]` to `[x]`
6. **Verify** no prohibited actions were taken

---

## 🎯 Success Criteria

Implementation is complete when:
- All 97 tasks in `tasks_innovate.md` are checked `[x]`
- All acceptance criteria in `requirements_innovate.md` are met
- Performance targets are achieved (diff <2s, branch 60fps, traces <500ms)
- Cost stays <$0.50/day for 100 users
- 80% unit test coverage
- End-to-end integration tests pass
- UI adheres to monochrome design system

---

**Budget Reminder**: Total innovation features cost target is <$0.50/day, keeping VIGIA within the $200 AWS credit budget for the competition voting phase.
