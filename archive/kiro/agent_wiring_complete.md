# VIGIA Agent Wiring - Activity Groups to Lambdas

**Date**: 2026-03-04  
**Status**: ✅ COMPLETE

---

## Activity Group Architecture

VIGIA has 5 activity groups in the sidebar, each connected to specific Bedrock Agent action groups:

```
┌─────────────────────────────────────────────────────────────────┐
│                        VIGIA Dashboard                          │
├─────────────────────────────────────────────────────────────────┤
│ Sidebar Activities          │  Agent Action Groups              │
├─────────────────────────────┼───────────────────────────────────┤
│ 1. Geo Explorer (Globe)     │  → QueryAndVerify (Orchestrator)  │
│    - Map File System        │     • query_hazards               │
│    - Session Management     │     • calculate_score             │
│    - Diff Analysis          │                                   │
├─────────────────────────────┼───────────────────────────────────┤
│ 2. Detection (Activity)     │  → Detection Mode (Local ONNX)    │
│    - Video Upload           │     • YOLOv26 Pothole Detector    │
│    - Frame Extraction       │     • Web Worker Processing       │
│    - Real-time Analysis     │                                   │
├─────────────────────────────┼───────────────────────────────────┤
│ 3. Network (Radio)          │  → NetworkIntelligence            │
│    - Network Health Panel   │     • analyze_node_connectivity   │
│    - Coverage Gap Analysis  │     • identify_coverage_gaps      │
├─────────────────────────────┼───────────────────────────────────┤
│ 4. Maintenance (Wrench)     │  → MaintenanceLogistics           │
│    - Maintenance Queue      │     • prioritize_repair_queue     │
│    - Cost Estimation        │     • estimate_repair_cost        │
├─────────────────────────────┼───────────────────────────────────┤
│ 5. Urban Planner (Map)      │  → UrbanPlanner                   │
│    - Optimal Pathfinding    │     • find_optimal_path           │
│    - ROI Calculation        │     • calculate_construction_roi  │
└─────────────────────────────┴───────────────────────────────────┘
```

---

## Implementation Details

### 1. Geo Explorer (Map File System)

**Component**: `Sidebar.tsx` + `LiveMap.tsx` + `DiffView.tsx`  
**Agent**: Orchestrator Agent (existing)  
**API Route**: `/api/agent/chat`  
**Lambda**: `BedrockRouterFunction`

**Flow**:
```
User selects session → LiveMap renders hazards → User clicks "Verify" 
→ Calls /api/agent/chat → Bedrock Agent invokes QueryAndVerify action group
→ Lambda queries DynamoDB → Returns verification score → UI updates
```

**Tools Used**:
- `query_hazards(geohash, radiusMeters, hoursBack)` - Find similar hazards
- `calculate_score(similarHazards)` - Compute verification score

---

### 2. Detection Mode

**Component**: `DetectionModeView.tsx` + `VideoUploader.tsx`  
**Agent**: Local ONNX (no cloud agent)  
**Processing**: Web Worker with YOLOv26 model

**Flow**:
```
User uploads video → Web Worker extracts frames → ONNX model detects potholes
→ Generates telemetry → Signs with ECDSA → Sends to /telemetry endpoint
→ DynamoDB stores hazards → Orchestrator Lambda triggers verification
```

**No Bedrock Agent** - This is client-side AI inference for cost optimization.

---

### 3. Network Intelligence

**Component**: `NetworkHealthPanel.tsx`  
**Agent**: NetworkIntelligence Action Group  
**API Route**: `/api/agent/network-analysis`  
**Lambda**: `NetworkIntelligenceFunction`

**Flow**:
```
User enters geohash + radius → Clicks "Analyze Network"
→ Calls /api/agent/network-analysis → Bedrock Agent invokes NetworkIntelligence
→ Lambda scans DynamoDB for unique contributors → Calculates health score
→ Returns metrics → UI displays node count, coverage, health score
```

**Tools Used**:
- `analyze_node_connectivity(geohash, radiusKm)` - DePIN network health
- `identify_coverage_gaps(boundingBox, minReportsThreshold)` - Find sparse areas

**UI Features**:
- Input: Geohash (7 chars) + Radius (km)
- Output: Active nodes, coverage area, health score (0-100)
- Visual: Text-based analysis (future: map overlay)

---

### 4. Maintenance Logistics

**Component**: `MaintenancePanelIntegrated.tsx`  
**Agent**: MaintenanceLogistics Action Group  
**API Route**: `/api/agent/maintenance-priority`  
**Lambda**: `MaintenanceLogisticsFunction`

**Flow**:
```
User views maintenance queue → Selects hazards → Clicks "Prioritize with AI"
→ Calls /api/agent/maintenance-priority with hazardIds[]
→ Bedrock Agent invokes MaintenanceLogistics → Lambda fetches hazards from DynamoDB
→ Calculates priority scores (severity + traffic + age + verification)
→ Returns prioritized queue + cost estimates → UI reorders queue
```

**Tools Used**:
- `prioritize_repair_queue(hazardIds[], trafficDensitySource)` - Rank by urgency
- `estimate_repair_cost(hazardIds[])` - Calculate total repair cost

**Priority Formula**:
```
priority = (severity * 0.5) + (traffic * 0.3) + (verification * 0.2)

Severity: ACCIDENT=100, POTHOLE=60, DEBRIS=40, ANIMAL=20
Traffic: Deterministic from geohash (10-100)
Verification: From verificationScore field (0-100)
```

**Cost Formula**:
```
finalCost = baseCost * (1 + (verificationScore/100) * 0.2)

Base Costs: ACCIDENT=$5000, POTHOLE=$500, DEBRIS=$200, ANIMAL=$100
```

---

### 5. Urban Planner

**Component**: `UrbanPlannerModal.tsx`  
**Agent**: UrbanPlanner Action Group  
**API Route**: `/api/agent/urban-planning`  
**Lambda**: `UrbanPlannerFunction`

**Flow**:
```
User clicks "Urban Planner" activity → Clicks "Find Optimal Path"
→ Modal opens → User enters start/end coordinates + hazard types to avoid
→ Clicks "Find Optimal Path & Calculate ROI"
→ Calls /api/agent/urban-planning → Bedrock Agent invokes UrbanPlanner
→ Lambda generates Bezier curve (21 waypoints) → Calculates ROI
→ Returns path + financial analysis → UI displays results
```

**Tools Used**:
- `find_optimal_path(start, end, constraints)` - Bezier curve pathfinding
- `calculate_construction_roi(pathData, constructionCostPerKm)` - Financial analysis

**Bezier Math**:
```
Midpoint: (start + end) / 2
Perpendicular Vector: (-dy, dx) normalized
Control Point: midpoint + perpendicular * 600m
Curve: B(t) = (1-t)² P₀ + 2(1-t)t P₁ + t² P₂  (t ∈ [0,1])
```

**ROI Calculation**:
```
Construction Cost: distanceKm * $1.5M/km
Land Acquisition: $400k (fixed)
Annual Savings: hazardsAvoided * $500/year
Break-Even: totalCost / annualSavings
10-Year ROI: ((savings*10 - cost) / cost) * 100
```

---

## File Structure

```
packages/frontend/app/
├── page.tsx                              # Main dashboard, activity routing
├── components/
│   ├── Sidebar.tsx                       # Activity group buttons
│   ├── LiveMap.tsx                       # Geo Explorer (QueryAndVerify)
│   ├── DetectionModeView.tsx             # Detection (Local ONNX)
│   ├── NetworkHealthPanel.tsx            # Network (NetworkIntelligence)
│   ├── MaintenancePanelIntegrated.tsx    # Maintenance (MaintenanceLogistics)
│   └── UrbanPlannerModal.tsx             # Urban Planner (UrbanPlanner)
└── api/agent/
    ├── chat/route.ts                     # Orchestrator agent
    ├── network-analysis/route.ts         # Network Intelligence
    ├── maintenance-priority/route.ts     # Maintenance Logistics
    └── urban-planning/route.ts           # Urban Planner
```

---

## Agent Invocation Pattern

All API routes follow this pattern:

```typescript
// 1. Accept user input
const { geohash, radiusKm } = await req.json();

// 2. Create Bedrock Agent client
const client = new BedrockAgentRuntimeClient({ region: 'us-east-1' });

// 3. Invoke agent with natural language prompt
const command = new InvokeAgentCommand({
  agentId: process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID,
  agentAliasId: process.env.NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID,
  sessionId: `session-${Date.now()}`,
  inputText: `Analyze network health for geohash ${geohash} within ${radiusKm}km radius`
});

// 4. Stream response
const response = await client.send(command);
for await (const event of response.completion) {
  if (event.chunk?.bytes) {
    const text = new TextDecoder().decode(event.chunk.bytes);
    analysis += text;
  }
}

// 5. Return to frontend
return NextResponse.json({ analysis, sessionId });
```

---

## Environment Variables

**Required** (`.env.local`):
```bash
NEXT_PUBLIC_BEDROCK_AGENT_ID=TAWWC3SQ0L
NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID=TSTALIASID
NEXT_PUBLIC_AWS_REGION=us-east-1
```

**Backend Lambdas** (set by CDK):
```bash
HAZARDS_TABLE_NAME=VigiaStack-IngestionHazardsTable-*
MAINTENANCE_QUEUE_TABLE_NAME=VigiaStack-InnovationMaintenanceQueue-*
ECONOMIC_METRICS_TABLE_NAME=VigiaStack-InnovationEconomicMetrics-*
```

---

## Testing Each Activity

### Test 1: Geo Explorer
1. Click "Geo Explorer" activity
2. Select a session from sidebar
3. Map loads with hazards
4. Click a hazard marker → "Verify" button
5. Agent analyzes similar hazards → Returns verification score

### Test 2: Detection
1. Click "Detection" activity
2. Upload dashcam video
3. Web Worker processes frames
4. ONNX model detects potholes
5. Telemetry sent to backend

### Test 3: Network Intelligence
1. Click "Network" activity
2. Enter geohash: `drt2yzr`, radius: `10`
3. Click "Analyze Network"
4. Agent returns: node count, coverage, health score

### Test 4: Maintenance
1. Click "Maintenance" activity
2. View maintenance queue
3. Select hazards → Click "Prioritize with AI"
4. Agent returns: prioritized queue + cost estimates

### Test 5: Urban Planner
1. Click "Urban Planner" activity
2. Click "Find Optimal Path"
3. Enter start/end coordinates
4. Select hazard types to avoid
5. Click "Find Optimal Path & Calculate ROI"
6. Agent returns: Bezier curve path + ROI analysis

---

## Cost Per Activity

| Activity | Agent Calls | Cost/Query | Daily (100 queries) |
|----------|-------------|------------|---------------------|
| Geo Explorer | 1 | $0.006 | $0.60 |
| Detection | 0 (local) | $0 | $0 |
| Network | 1 | $0.006 | $0.60 |
| Maintenance | 1 | $0.006 | $0.60 |
| Urban Planner | 2 | $0.012 | $1.20 |
| **Total** | - | - | **$3.00/day** |

**Monthly**: ~$90 (well within $200 AWS credit budget)

---

## Summary

✅ **5 Activity Groups** wired to **4 Bedrock Agent Action Groups**  
✅ **8 Tools** available across all agents  
✅ **3 API Routes** for new capabilities  
✅ **All components** integrated into main dashboard  
✅ **Build passing** with no errors  

**Status**: Ready for demo! 🚀

---

**Engineer**: Lead Frontend Architect  
**Date**: 2026-03-04 01:52 AM IST  
**Approval**: ✅ COMPLETE
