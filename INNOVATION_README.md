# VIGIA Innovation Features

**Status**: Implementation Complete ✅  
**Last Updated**: 2026-03-01

This document describes the four major innovation features added to VIGIA: Infrastructure Diff Tool, Scenario Branching, Explainable AI (ReAct Logs), and Economic Layer.

---

## 🎯 Features Overview

### 1. Infrastructure "Diff" Tool (Temporal Auditing)
Compare two road session files to visualize infrastructure decay and repair cycles over time.

**Key Capabilities:**
- Drag-and-drop `.map` files to trigger diff computation
- Visual markers: RED (new hazards), GREEN (fixed), ORANGE (worsened)
- Export diff reports as JSON
- Local-first operation (IndexedDB, no server upload)

**UI Location:** Map File System activity group → Drag file onto another file

### 2. Scenario "Branching" (What-If Routing)
Simulate infrastructure changes and their impact on city-wide traffic latency.

**Key Capabilities:**
- Create `.scmap` branch files from any `.map` file
- Toggle hazards on/off, add simulated hazards
- Recompute routes with Bedrock Agent
- View latency comparison (baseline vs. branch)

**UI Location:** Map File System → Right-click `.map` file → "Create Branch"

### 3. Explainable AI (Live ReAct Logs)
Expose the Bedrock Agent's internal reasoning process in real-time.

**Key Capabilities:**
- Live streaming of agent thoughts, actions, observations
- Search/filter by geohash or contributor ID
- Virtual scrolling for 1000+ traces
- Auto-scroll toggle
- 7-day TTL for trace data

**UI Location:** Console Panel → Agent Traces tab

### 4. Maintenance "Bounties" & Economic Layer
Quantify the economic value of early hazard detection for municipalities and insurers.

**Key Capabilities:**
- Submit maintenance reports for verified hazards
- Auto-calculate repair costs based on type and severity
- ROI widget showing prevented damage costs
- Maintenance queue with status tracking

**UI Location:** Maintenance activity group + DePIN Ledger tab (ROI widget)

---

## 📁 Project Structure

```
vigia-amazon/
├── packages/
│   ├── frontend/
│   │   ├── app/components/
│   │   │   ├── MapFileExplorer.tsx          # File tree with drag-and-drop
│   │   │   ├── DiffLayer.tsx                # Diff visualization
│   │   │   ├── BranchLayer.tsx              # Branch simulation
│   │   │   ├── AgentTracesTab.tsx           # ReAct logs viewer
│   │   │   ├── ROIWidget.tsx                # Economic metrics
│   │   │   ├── MaintenancePanel.tsx         # Report submission
│   │   │   ├── InnovationSidebar.tsx        # Activity groups
│   │   │   ├── InnovationMapView.tsx        # Integrated map
│   │   │   └── InnovationConsolePanel.tsx   # Tabbed console
│   │   ├── stores/
│   │   │   ├── mapFileStore.ts              # Files, diff, branches
│   │   │   ├── agentTraceStore.ts           # ReAct traces, SSE
│   │   │   └── economicStore.ts             # Metrics, reports
│   │   ├── workers/
│   │   │   ├── diffWorker.ts                # Diff computation
│   │   │   └── branchWorker.ts              # Branch management
│   │   └── lib/storage/
│   │       └── mapFileDB.ts                 # IndexedDB wrapper
│   │
│   ├── backend/
│   │   ├── functions/
│   │   │   ├── routing-agent-branch/        # Branch routing Lambda
│   │   │   ├── agent-trace-streamer/        # SSE trace streaming
│   │   │   ├── maintenance-report-handler/  # Report submission
│   │   │   ├── economic-metrics-query/      # Metrics API
│   │   │   └── maintenance-queue-query/     # Queue API
│   │   └── lib/
│   │       └── costCalculator.ts            # Cost formulas
│   │
│   ├── infrastructure/
│   │   └── lib/stacks/
│   │       └── innovation-stack.ts          # CDK definitions
│   │
│   └── shared/
│       └── src/
│           ├── mapFile.ts                   # MapFile, ScenarioBranch types
│           ├── agentTrace.ts                # ReActTrace types
│           └── economic.ts                  # MaintenanceReport, EconomicMetrics types
│
├── requirements_innovate.md                 # Functional requirements
├── design_innovate.md                       # Technical architecture
└── tasks_innovate.md                        # Implementation checklist
```

---

## 🗄️ DynamoDB Tables

### AgentTraces
```
Partition Key: traceId (String)
Sort Key: timestamp (Number)
TTL: 7 days
GSI: GeohashIndex (geohash, timestamp)
```

### MaintenanceQueue
```
Partition Key: reportId (String)
Sort Key: reportedAt (Number)
GSI: GeohashIndex (geohash, reportedAt)
GSI: StatusIndex (status, reportedAt)
```

### EconomicMetrics
```
Partition Key: sessionId (String)
Sort Key: timestamp (Number)
```

---

## 🚀 API Endpoints

### POST /api/routing-agent/branch
Recompute routes for a scenario branch.

**Request:**
```json
{
  "branchId": "uuid",
  "hazards": [{ "id": "...", "geohash": "...", "type": "POTHOLE", "severity": 3 }]
}
```

**Response:**
```json
{
  "baselineAvgLatency": 12.5,
  "branchAvgLatency": 18.2,
  "delta": 5.7,
  "deltaPercent": 45.6,
  "affectedRoutes": 23,
  "computedAt": 1709308800000
}
```

### GET /api/agent-traces/stream
Server-Sent Events stream of ReAct traces.

**Response (SSE):**
```
data: {"traceId":"...","timestamp":...,"steps":[...]}

data: {"traceId":"...","timestamp":...,"steps":[...]}
```

### POST /api/maintenance/report
Submit a maintenance report for a hazard.

**Request:**
```json
{
  "hazardId": "uuid",
  "geohash": "7tg3v2k",
  "type": "POTHOLE",
  "severity": 4,
  "reportedBy": "contributor-id",
  "notes": "Large pothole near intersection",
  "signature": "0xabc...def"
}
```

**Response:**
```json
{
  "reportId": "uuid",
  "estimatedCost": 210
}
```

### GET /api/economic/metrics?sessionId={id}
Fetch economic metrics for a session.

**Response:**
```json
{
  "sessionId": "current-session",
  "timestamp": 1709308800000,
  "totalHazardsDetected": 47,
  "totalEstimatedRepairCost": 8450,
  "totalPreventedDamageCost": 14100,
  "roiMultiplier": 1.67,
  "hazardBreakdown": {
    "POTHOLE": { "count": 32, "avgCost": 193.75 },
    "DEBRIS": { "count": 12, "avgCost": 104.17 },
    "FLOODING": { "count": 3, "avgCost": 1000 }
  }
}
```

### GET /api/maintenance/queue?status={status}&geohash={geohash}
Query maintenance reports.

**Response:**
```json
[
  {
    "reportId": "uuid",
    "hazardId": "uuid",
    "geohash": "7tg3v2k",
    "type": "POTHOLE",
    "severity": 4,
    "reportedBy": "contributor-id",
    "reportedAt": 1709308800000,
    "estimatedCost": 210,
    "status": "PENDING",
    "notes": "Large pothole near intersection"
  }
]
```

---

## 💰 Cost Analysis

### Bedrock Costs
- **ReAct Tracing**: No additional cost (built-in feature with `enableTrace: true`)
- **Branch Routing**: ~$0.06 per 1M input tokens (Nova Lite)
- **Estimated**: 50 branch simulations/day × 1000 tokens = **$0.003/day**

### DynamoDB Costs
- **On-demand billing** (stay within free tier)
- **AgentTraces**: TTL auto-deletion after 7 days (no long-term storage cost)
- **MaintenanceQueue**: ~100 writes/day = **$0.000025/day**
- **EconomicMetrics**: Pre-aggregated, ~10 writes/day = **$0.0000025/day**

### Lambda Costs
- **routing-agent-branch**: 512MB, ~2s = $0.0000083/invocation
- **agent-trace-streamer**: 1024MB, ~5s = $0.0000208/invocation
- **maintenance-report-handler**: 256MB, ~500ms = $0.0000010/invocation

**Total Estimated Cost**: **<$0.50/day** for 100 active users

---

## 🧪 Testing

### Unit Tests
```bash
# Test diff algorithm
npm test -- diffWorker.test.ts

# Test cost calculator
npm test -- costCalculator.test.ts
```

### Integration Tests
```bash
# Test end-to-end diff flow
npm run test:e2e -- diff.spec.ts

# Test branch simulation
npm run test:e2e -- branch.spec.ts

# Test ReAct streaming
npm run test:e2e -- traces.spec.ts

# Test maintenance reports
npm run test:e2e -- maintenance.spec.ts
```

### Performance Benchmarks
```bash
# Diff computation (target: <2s for 500 hazards)
npm run benchmark -- diff

# Branch rendering (target: 60fps with 100 hazards)
npm run benchmark -- branch

# Trace streaming (target: <500ms latency)
npm run benchmark -- traces
```

---

## 🚢 Deployment

### Prerequisites
- AWS CLI configured
- AWS CDK v2 installed
- Node.js 20+

### Deploy Infrastructure
```bash
cd packages/infrastructure
npm run cdk:deploy
```

### Deploy Frontend
```bash
cd packages/frontend
npm run build
# Deploy to Amplify or Vercel
```

### Environment Variables
```bash
# Backend Lambda functions
ROUTING_AGENT_ID=<bedrock-agent-id>
ORCHESTRATOR_AGENT_ID=<bedrock-agent-id>
MAINTENANCE_QUEUE_TABLE=<dynamodb-table-name>
ECONOMIC_METRICS_TABLE=<dynamodb-table-name>
TRACES_TABLE_NAME=<dynamodb-table-name>
```

---

## 📊 Success Metrics

- ✅ **Diff Computation**: <2 seconds for 500 hazards
- ✅ **Branch Rendering**: 60fps with 100 simulated hazards
- ✅ **ReAct Streaming**: <500ms latency from Bedrock to UI
- ✅ **ROI Widget**: <1 second update after new hazard
- ✅ **Cost**: <$0.50/day for 100 users
- ✅ **UI Compliance**: Monochrome design, VS Code layout, JetBrains Mono for data

---

## 🔒 Security

- **Local-First**: Diff and branch operations never send data to server unless explicitly saved
- **Signature Validation**: All maintenance reports require valid ECDSA signatures
- **Data Separation**: `.scmap` files visually distinct from `.map` files (dashed borders, branch icon)
- **Privacy**: Contributor IDs redacted in public traces (last 4 chars only)
- **TTL**: Agent traces auto-deleted after 7 days

---

## 📚 Documentation

- [requirements_innovate.md](./requirements_innovate.md) - User stories and acceptance criteria
- [design_innovate.md](./design_innovate.md) - Technical architecture and data structures
- [tasks_innovate.md](./tasks_innovate.md) - Implementation checklist (97 tasks)
- [.kiro/steering/innovation-features-guardrails.md](./.kiro/steering/innovation-features-guardrails.md) - Design rules and constraints

---

## 🎯 Demo

Visit `/innovation` route to see all features in action:
- Sidebar: Map File System + Maintenance activity groups
- Main Stage: Map with diff/branch layers
- Console: Agent Traces + DePIN Ledger tabs

---

**Built with**: Next.js 14, Zustand, MapLibre GL JS, AWS CDK, DynamoDB, Lambda, Bedrock (Nova Lite)
