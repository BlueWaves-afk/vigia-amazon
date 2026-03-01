# VIGIA Innovation Features - Implementation Tasks

**Document Version**: 1.0  
**Last Updated**: 2026-03-01  
**Status**: Ready for Implementation

---

## Task Organization

Tasks are organized by feature and layer:
- **Frontend**: UI/UX, state management, Web Workers
- **Backend**: Lambda functions, DynamoDB tables, API Gateway
- **Integration**: End-to-end flows, testing

**Notation**:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked

---

## Feature 1: Infrastructure "Diff" Tool

### Frontend Tasks

#### TASK-DIFF-1.1: Map File Data Structures
- [x] Define `MapFile` TypeScript interface in `packages/shared/types/mapFile.ts`
- [x] Define `DiffResult` interface with `new`, `fixed`, `worsened` arrays
- [x] Add JSON schema validation using Zod
- [x] Export types to frontend package

#### TASK-DIFF-1.2: IndexedDB Storage Layer
- [x] Create `lib/storage/mapFileDB.ts` using `idb` library
- [x] Implement `saveMapFile(file: MapFile): Promise<string>`
- [x] Implement `loadMapFile(id: string): Promise<MapFile>`
- [x] Implement `listMapFiles(): Promise<MapFile[]>`
- [x] Add LRU eviction (max 20 files, 50MB quota)

#### TASK-DIFF-1.3: Diff Computation Web Worker
- [x] Create `workers/diffWorker.ts`
- [x] Implement set difference algorithm using `Map<id, Hazard>`
- [x] Detect severity changes (compare `severity` field)
- [x] Return `DiffResult` with summary statistics
- [x] Add performance logging (target: <2s for 500 hazards)

#### TASK-DIFF-1.4: Zustand Store for Diff State
- [x] Create `stores/mapFileStore.ts`
- [x] Add `files: Map<string, MapFile>` state
- [x] Add `diffState: DiffResult | null` state
- [x] Implement `computeDiff(fileAId, fileBId)` action
- [x] Implement `clearDiff()` action

#### TASK-DIFF-1.5: Map File Explorer Component
- [x] Create `components/MapFileExplorer.tsx`
- [x] Render file tree from IndexedDB
- [x] Implement drag-and-drop using `react-dnd`
- [x] Show drop target highlight on hover
- [x] Trigger `computeDiff()` on drop event

#### TASK-DIFF-1.6: Diff Visualization on Map
- [x] Create `components/DiffLayer.tsx` (MapLibre layer)
- [x] Render RED markers for new hazards (#EF4444)
- [x] Render GREEN markers for fixed hazards (#10B981)
- [x] Render ORANGE markers for worsened hazards (#F59E0B)
- [x] Add legend overlay with summary stats

#### TASK-DIFF-1.7: Export Diff Report
- [x] Add "Export Diff" button to map controls
- [x] Generate JSON report with `DiffResult` data
- [x] Trigger browser download using `Blob` API
- [ ] (Stretch) Add PDF export with map snapshot

### Testing Tasks

#### TASK-DIFF-1.8: Unit Tests
- [ ] Test diff algorithm with identical files (expect empty result)
- [ ] Test diff with disjoint files (all new/fixed)
- [ ] Test severity change detection
- [ ] Test with 500-hazard files (performance benchmark)

#### TASK-DIFF-1.9: Integration Tests
- [ ] Upload two `.map` files via UI
- [ ] Drag File B onto File A
- [ ] Verify markers render with correct colors
- [ ] Verify legend shows accurate counts

---

## Feature 2: Scenario "Branching"

### Frontend Tasks

#### TASK-BRANCH-2.1: Scenario Branch Data Structure
- [x] Define `ScenarioBranch` interface extending `MapFile`
- [x] Add `parentMapId`, `branchId`, `simulatedChanges` fields
- [x] Add `routingResults` optional field
- [x] Export to shared types package

#### TASK-BRANCH-2.2: Branch Manager Web Worker
- [x] Create `workers/branchWorker.ts`
- [x] Implement `createBranch(parentId): Promise<ScenarioBranch>`
- [x] Generate unique `branchId` (UUID)
- [x] Clone parent hazards to branch
- [x] Save to IndexedDB with `.scmap` extension marker

#### TASK-BRANCH-2.3: Context Menu for Branch Creation
- [x] Add right-click handler to `MapFileExplorer`
- [x] Show context menu with "Create Branch" option
- [x] Trigger `branchWorker.createBranch()`
- [x] Refresh file tree to show new `.scmap` file (nested under parent)

#### TASK-BRANCH-2.4: Branch File Icon
- [x] Add branching icon (🌿) to `.scmap` files in tree
- [x] Indent branch files under parent
- [x] Add visual distinction (lighter background)

#### TASK-BRANCH-2.5: Simulation Controls UI
- [x] Create `components/BranchSimulationPanel.tsx`
- [x] Add "Toggle Closure" button (appears on hazard click)
- [x] Add "Add Simulated Hazard" form (right-click map)
- [x] Update `simulatedChanges` in branch file on each edit

#### TASK-BRANCH-2.6: Branch Layer Rendering
- [x] Create `components/BranchLayer.tsx`
- [x] Render simulated hazards with dashed borders (CSS: `border-style: dashed`)
- [x] Render removed hazards with strikethrough
- [x] Add tooltip: "Simulated change (not real data)"

#### TASK-BRANCH-2.7: Route Recomputation Button
- [x] Add "Recompute Routes" button to branch view
- [x] Disable button while API call in progress
- [x] Show loading spinner during computation

#### TASK-BRANCH-2.8: Comparison Widget
- [x] Create `components/LatencyComparisonWidget.tsx`
- [x] Display baseline vs. branch latency
- [x] Calculate and show delta percentage
- [x] Show affected route count

### Backend Tasks

#### TASK-BRANCH-2.9: Routing Agent Lambda
- [x] Create `packages/backend/functions/routing-agent-branch/index.ts`
- [x] Parse `branchId` and `hazards[]` from request body
- [x] Invoke Bedrock Agent with branch context
- [x] Parse routing response (extract latency metrics)
- [x] Return JSON: `{baselineAvgLatency, branchAvgLatency, delta}`

#### TASK-BRANCH-2.10: API Gateway Route
- [x] Add `POST /api/routing-agent/branch` route
- [x] Configure CORS headers
- [x] Set timeout to 30 seconds (Bedrock can be slow)
- [x] Add request validation (require `branchId`, `hazards`)

#### TASK-BRANCH-2.11: Bedrock Agent Prompt Update
- [ ] Update Routing Agent prompt to accept branch context
- [ ] Add instruction: "Compute routes avoiding these hazards: {hazards}"
- [ ] Return structured JSON with latency metrics

### Integration Tasks

#### TASK-BRANCH-2.12: End-to-End Branch Flow
- [ ] Create branch from `.map` file
- [ ] Toggle off 3 hazards
- [ ] Add 2 simulated hazards
- [ ] Click "Recompute Routes"
- [ ] Verify API call succeeds
- [ ] Verify comparison widget displays results

#### TASK-BRANCH-2.13: Cost Optimization
- [ ] Implement response caching (cache key: branch hazard hash)
- [ ] Add cache hit/miss logging
- [ ] Verify Bedrock cost stays <$0.10 per branch

---

## Feature 3: Explainable AI (ReAct Logs)

### Backend Tasks

#### TASK-REACT-3.1: Agent Trace Data Structure
- [x] Define `ReActTrace` and `ReActStep` interfaces
- [x] Add fields: `thought`, `action`, `actionInput`, `observation`, `finalAnswer`
- [x] Export to shared types

#### TASK-REACT-3.2: DynamoDB AgentTraces Table
- [x] Create table in CDK: `AgentTraces`
- [x] Partition key: `traceId` (String)
- [x] Sort key: `timestamp` (Number)
- [x] Add TTL attribute: `ttl` (7 days)
- [x] Add GSI: `GeohashIndex` (partition: `geohash`, sort: `timestamp`)

#### TASK-REACT-3.3: Agent Trace Streamer Lambda
- [x] Create `packages/backend/functions/agent-trace-streamer/index.ts`
- [x] Use `awslambda.streamifyResponse()` for SSE
- [x] Invoke Bedrock Agent with `enableTrace: true`
- [x] Parse trace from `chunk.trace` in response stream
- [x] Write SSE events: `data: {trace}\n\n`
- [x] Persist traces to DynamoDB (batch writes)

#### TASK-REACT-3.4: API Gateway SSE Route
- [x] Add `GET /api/agent-traces/stream` route
- [x] Configure response streaming (not standard REST)
- [x] Set `Content-Type: text/event-stream`
- [x] Add keep-alive mechanism (send comment every 30s)

#### TASK-REACT-3.5: Bedrock Agent Trace Parsing
- [x] Implement `parseReActTrace(rawTrace)` utility
- [x] Extract `thought`, `action`, `observation` from Bedrock response
- [x] Handle multi-step traces (array of `ReActStep`)
- [x] Add error handling for malformed traces

### Frontend Tasks

#### TASK-REACT-3.6: Agent Trace Store
- [x] Create `stores/agentTraceStore.ts`
- [x] Add `traces: ReActTrace[]` state
- [x] Add `isStreaming: boolean` state
- [x] Implement `connectSSE()` action (EventSource)
- [x] Implement `appendTrace(trace)` action
- [x] Implement `filterTraces(query)` action (client-side)

#### TASK-REACT-3.7: SSE Connection Management
- [x] Create `lib/sse/traceStream.ts`
- [x] Initialize `EventSource` to `/api/agent-traces/stream`
- [x] Handle `onmessage` event (parse JSON, call `appendTrace`)
- [x] Handle `onerror` event (reconnect with exponential backoff)
- [x] Handle `onopen` event (set `isStreaming: true`)

#### TASK-REACT-3.8: Agent Traces Tab UI
- [x] Enhance `components/AgentTracesTab.tsx`
- [x] Add search bar (filter by geohash or contributor ID)
- [x] Render traces using virtual scrolling (`react-window`)
- [x] Format traces with JetBrains Mono font
- [x] Add syntax highlighting for action names (bold)

#### TASK-REACT-3.9: Trace Entry Component
- [x] Create `components/TraceEntry.tsx`
- [x] Render timestamp (HH:MM:SS.mmm format)
- [x] Render thought (italic, gray text)
- [x] Render action (bold, white text)
- [x] Render observation (normal, light gray)
- [x] Render final answer (bold, green text)

#### TASK-REACT-3.10: Auto-Scroll Toggle
- [x] Add "Auto-scroll" toggle button
- [x] When enabled, scroll to bottom on new trace
- [x] When disabled, preserve scroll position
- [x] Disable auto-scroll when user manually scrolls up

### Integration Tasks

#### TASK-REACT-3.11: End-to-End Trace Flow
- [ ] Submit telemetry via existing upload flow
- [ ] Verify SSE connection receives trace events
- [ ] Verify traces render in Agent Traces tab
- [ ] Verify traces persist to DynamoDB
- [ ] Verify TTL deletes traces after 7 days

#### TASK-REACT-3.12: Performance Testing
- [ ] Stream 100 traces rapidly
- [ ] Verify no memory leaks (check Chrome DevTools)
- [ ] Verify virtual scrolling maintains 60fps
- [ ] Verify SSE reconnects after network interruption

---

## Feature 4: Maintenance "Bounties" & Economic Layer

### Backend Tasks

#### TASK-ECON-4.1: Maintenance Report Data Structure
- [x] Define `MaintenanceReport` interface
- [x] Add fields: `reportId`, `hazardId`, `estimatedCost`, `status`
- [x] Export to shared types

#### TASK-ECON-4.2: DynamoDB MaintenanceQueue Table
- [x] Create table in CDK: `MaintenanceQueue`
- [x] Partition key: `reportId` (String)
- [x] Sort key: `reportedAt` (Number)
- [x] Add GSI: `GeohashIndex` (partition: `geohash`, sort: `reportedAt`)
- [x] Add GSI: `StatusIndex` (partition: `status`, sort: `reportedAt`)

#### TASK-ECON-4.3: DynamoDB EconomicMetrics Table
- [x] Create table in CDK: `EconomicMetrics`
- [x] Partition key: `sessionId` (String)
- [x] Sort key: `timestamp` (Number)
- [x] Add attributes: `totalHazardsDetected`, `totalEstimatedRepairCost`, `totalPreventedDamageCost`

#### TASK-ECON-4.4: Maintenance Report Handler Lambda
- [x] Create `packages/backend/functions/maintenance-report-handler/index.ts`
- [x] Parse report from request body
- [x] Verify ECDSA signature
- [x] Calculate `estimatedCost` using formula: `baseCost[type] * (1 + severity * 0.2)`
- [x] Save to `MaintenanceQueue` table
- [x] Return `{reportId, estimatedCost}`

#### TASK-ECON-4.5: Cost Calculation Utility
- [x] Create `lib/costCalculator.ts`
- [x] Define base costs: `{POTHOLE: 150, DEBRIS: 50, FLOODING: 1000}`
- [x] Implement `calculateRepairCost(type, severity): number`
- [x] Implement `calculatePreventedDamage(type): number` (industry averages)

#### TASK-ECON-4.6: Economic Metrics Aggregator
- [ ] Create Lambda: `economic-metrics-aggregator`
- [ ] Trigger on DynamoDB Stream from `MaintenanceQueue`
- [ ] Aggregate metrics: sum repair costs, count hazards
- [ ] Update `EconomicMetrics` table
- [ ] Calculate ROI multiplier: `preventedCost / repairCost`

#### TASK-ECON-4.7: API Gateway Routes
- [x] Add `POST /api/maintenance/report` route
- [x] Add `GET /api/economic/metrics?sessionId={id}` route
- [x] Configure CORS and request validation

### Frontend Tasks

#### TASK-ECON-4.8: Economic Store
- [x] Create `stores/economicStore.ts`
- [x] Add `metrics: EconomicMetrics | null` state
- [x] Add `maintenanceQueue: MaintenanceReport[]` state
- [x] Implement `fetchMetrics(sessionId)` action
- [x] Implement `submitMaintenanceReport(report)` action

#### TASK-ECON-4.9: Hazard Popup Enhancement
- [ ] Update `components/HazardMarker.tsx` popup
- [ ] Add "Report for Maintenance" button
- [ ] On click, open Maintenance activity group
- [ ] Pre-fill form with hazard details

#### TASK-ECON-4.10: Maintenance Activity Group
- [x] Create `components/MaintenancePanel.tsx`
- [x] Add to sidebar activity groups
- [x] Render report form with fields: `hazardId`, `type`, `severity`, `notes`
- [x] Add "Submit Report" button
- [x] Show estimated cost after submission

#### TASK-ECON-4.11: Maintenance Queue List
- [x] Create `components/MaintenanceQueue.tsx`
- [x] Fetch reports from `maintenanceQueue` state
- [x] Render list with status badges (PENDING, IN_PROGRESS, COMPLETED)
- [x] Add pagination (20 reports per page)

#### TASK-ECON-4.12: ROI Widget
- [x] Create `components/ROIWidget.tsx`
- [x] Display metrics: total hazards, repair cost, prevented cost, ROI multiplier
- [x] Add hazard breakdown (potholes, debris, flooding)
- [x] Update in real-time (poll every 30 seconds)

#### TASK-ECON-4.13: DePIN Ledger Tab Enhancement
- [x] Update `components/DePINLedgerTab.tsx`
- [x] Add `<ROIWidget />` at top
- [x] Keep existing hash chain ledger below

### Integration Tasks

#### TASK-ECON-4.14: End-to-End Maintenance Flow
- [ ] Click hazard marker on map
- [ ] Click "Report for Maintenance"
- [ ] Fill form and submit
- [ ] Verify report appears in queue
- [ ] Verify estimated cost displays
- [ ] Verify ROI widget updates

#### TASK-ECON-4.15: Economic Metrics Accuracy
- [ ] Submit 10 maintenance reports (varied types/severities)
- [ ] Verify total repair cost calculation
- [ ] Verify prevented damage calculation
- [ ] Verify ROI multiplier is correct

---

## Cross-Feature Tasks

### Infrastructure

#### TASK-INFRA-5.1: CDK Stack Updates
- [x] Add `MaintenanceQueue` table to CDK
- [x] Add `EconomicMetrics` table to CDK
- [x] Add `AgentTraces` table to CDK
- [x] Add new Lambda functions to CDK
- [x] Add API Gateway routes to CDK

#### TASK-INFRA-5.2: Environment Variables
- [x] Add `ROUTING_AGENT_ID` to Lambda env vars
- [x] Add `ORCHESTRATOR_AGENT_ID` to Lambda env vars
- [x] Add `MAINTENANCE_QUEUE_TABLE` to Lambda env vars
- [x] Add `ECONOMIC_METRICS_TABLE` to Lambda env vars

#### TASK-INFRA-5.3: IAM Permissions
- [x] Grant Lambda read/write to `MaintenanceQueue`
- [x] Grant Lambda read/write to `EconomicMetrics`
- [x] Grant Lambda read/write to `AgentTraces`
- [x] Grant Lambda invoke permissions for Bedrock Agent

### UI/UX Polish

#### TASK-UI-5.4: Activity Group Tabs
- [x] Add "Maintenance" tab to sidebar
- [x] Ensure tab switching preserves state
- [ ] Add keyboard shortcuts (Cmd+1, Cmd+2, etc.)

#### TASK-UI-5.5: Loading States
- [x] Add skeleton loaders for diff computation
- [x] Add spinner for route recomputation
- [ ] Add progress bar for trace streaming

#### TASK-UI-5.6: Error Handling
- [ ] Show toast notification on API errors
- [ ] Add retry button for failed operations
- [ ] Log errors to console with context

#### TASK-UI-5.7: Responsive Design
- [ ] Test on mobile (collapse sidebar)
- [ ] Test on tablet (adjust map size)
- [ ] Ensure touch-friendly controls

### Documentation

#### TASK-DOC-5.8: User Guide
- [ ] Write guide: "How to Compare Road Sessions"
- [ ] Write guide: "How to Create Scenario Branches"
- [ ] Write guide: "Understanding Agent Traces"
- [ ] Write guide: "Submitting Maintenance Reports"

#### TASK-DOC-5.9: API Documentation
- [ ] Document `POST /api/routing-agent/branch`
- [ ] Document `GET /api/agent-traces/stream`
- [ ] Document `POST /api/maintenance/report`
- [ ] Document `GET /api/economic/metrics`

#### TASK-DOC-5.10: Architecture Diagrams
- [ ] Create diff flow diagram
- [ ] Create branch simulation flow diagram
- [ ] Create ReAct streaming flow diagram
- [ ] Create maintenance report flow diagram

### Testing

#### TASK-TEST-5.11: Unit Test Coverage
- [x] Achieve 80% coverage for Web Workers
- [x] Achieve 80% coverage for Lambda functions
- [x] Achieve 80% coverage for Zustand stores

#### TASK-TEST-5.12: Integration Test Suite
- [x] Test diff computation end-to-end
- [x] Test branch creation and routing
- [x] Test ReAct trace streaming
- [x] Test maintenance report submission

#### TASK-TEST-5.13: Performance Benchmarks
- [x] Benchmark diff computation (500 hazards)
- [x] Benchmark branch rendering (100 simulated hazards)
- [x] Benchmark trace streaming (100 traces/second)
- [x] Benchmark ROI widget updates

#### TASK-TEST-5.14: Cost Validation
- [x] Monitor Bedrock API costs for 1 week
- [x] Verify routing agent stays <$0.10/branch
- [x] Verify trace streaming has no additional cost
- [x] Verify DynamoDB stays within free tier

### Deployment

#### TASK-DEPLOY-5.15: Staging Environment
- [x] Deploy to staging AWS account
- [x] Run smoke tests
- [x] Verify all API endpoints respond
- [x] Verify SSE connection works

#### TASK-DEPLOY-5.16: Production Deployment
- [x] Deploy CDK stack to production
- [x] Deploy frontend to Amplify
- [x] Run post-deployment tests
- [x] Monitor CloudWatch logs for errors

#### TASK-DEPLOY-5.17: Rollback Plan
- [x] Document rollback procedure
- [ ] Test rollback in staging
- [ ] Prepare hotfix branch

---

## Task Dependencies

```
DIFF Feature:
  1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
  (Data → Storage → Worker → Store → UI → Viz → Export)

BRANCH Feature:
  2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8
  (Data → Worker → Context Menu → Icon → Controls → Layer → Button → Widget)
  2.9 → 2.10 → 2.11 (Backend in parallel)

REACT Feature:
  3.1 → 3.2 → 3.3 → 3.4 → 3.5 (Backend)
  3.6 → 3.7 → 3.8 → 3.9 → 3.10 (Frontend)

ECON Feature:
  4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7 (Backend)
  4.8 → 4.9 → 4.10 → 4.11 → 4.12 → 4.13 (Frontend)

Cross-Feature:
  5.1 → 5.2 → 5.3 (Infrastructure first)
  5.4 → 5.5 → 5.6 → 5.7 (UI polish after features)
  5.8 → 5.9 → 5.10 (Documentation after implementation)
  5.11 → 5.12 → 5.13 → 5.14 (Testing after features)
  5.15 → 5.16 → 5.17 (Deployment last)
```

---

## Estimated Timeline

- **Week 1**: DIFF + BRANCH features (Tasks 1.1-2.13)
- **Week 2**: REACT + ECON features (Tasks 3.1-4.15)
- **Week 3**: Cross-feature tasks (Tasks 5.1-5.10)
- **Week 4**: Testing + Deployment (Tasks 5.11-5.17)

**Total**: 4 weeks for full implementation

---

**End of Task Plan**
