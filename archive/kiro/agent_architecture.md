# VIGIA Agent Architecture Specification
**Version**: 2.0  
**Last Updated**: 2026-03-04  
**Status**: Phase 1 - Discovery Complete

---

## Executive Summary

VIGIA's Bedrock Agent (ID: `TAWWC3SQ0L`, Alias: `TSTALIASID`) currently performs **Hazard Verification** using a single Action Group. This document defines the upgrade path to support three additional domains: **Network Intelligence**, **Maintenance Logistics**, and **Generative Urban Planning**.

---

## Current Architecture (v1.0)

### Existing Components

**Bedrock Agent**:
- Agent ID: `TAWWC3SQ0L`
- Alias: `TSTALIASID`
- Model: Amazon Nova Lite
- Current Capability: Hazard Verification

**Action Group 1: Hazard Verification**
- Lambda: `BedrockRouterFunction` (Python 3.12)
- Location: `packages/backend/src/actions/bedrock-router.py`
- Tools:
  1. `query_hazards(geohash, radiusMeters, hoursBack)` → Returns hazards near location
  2. `calculate_score(similarHazards)` → Computes verification score (0-100)

**DynamoDB Tables**:
1. **HazardsTable** (Ingestion Stack)
   - PK: `geohash` (STRING)
   - SK: `timestamp` (STRING)
   - Attributes: `hazardType`, `lat`, `lon`, `confidence`, `status`, `signature`, `verificationScore`
   - GSI: `status-timestamp-index`
   - Stream: Enabled (triggers Orchestrator Lambda)

2. **LedgerTable** (Trust Stack)
   - PK: `ledgerId` (STRING)
   - SK: `timestamp` (STRING)
   - Attributes: `sessionId`, `action`, `contributorId`, `previousHash`, `currentHash`

3. **AgentTracesTable** (Intelligence Stack)
   - PK: `traceId` (STRING)
   - SK: `timestamp` (NUMBER)
   - GSI: `HazardIdIndex` (hazardId, createdAt)
   - TTL: 7 days

4. **CooldownTable** (Intelligence Stack)
   - PK: `cooldownKey` (STRING)
   - TTL: Prevents duplicate Bedrock invocations

5. **MaintenanceQueueTable** (Innovation Stack)
   - PK: `reportId` (STRING)
   - SK: `reportedAt` (NUMBER)
   - GSI: `GeohashIndex`, `StatusIndex`

6. **EconomicMetricsTable** (Innovation Stack)
   - PK: `sessionId` (STRING)
   - SK: `timestamp` (NUMBER)

**Orchestrator Lambda**:
- Location: `packages/backend/src/orchestrator/index.ts`
- Trigger: DynamoDB Stream (HazardsTable)
- Function: Invokes Bedrock Agent for verification, stores traces

**Sync Verification Lambda**:
- Location: `packages/backend/functions/verify-hazard-sync/index.ts`
- Trigger: API Gateway POST `/verify-hazard-sync`
- Function: Synchronous verification for interactive demo

---

## Proposed Architecture (v2.0)

### New Action Groups

#### Action Group 2: Network Intelligence (The Analyst)

**Purpose**: Analyze DePIN network health and identify coverage gaps.

**Lambda**: `NetworkIntelligenceLambda` (Python 3.12)  
**Location**: `packages/backend/src/actions/network-intelligence.py`

**Tools**:

1. **`analyze_node_connectivity`**
   - **Input Schema**:
     ```json
     {
       "geohash": "string (7 chars)",
       "radiusKm": "number (default: 10)"
     }
     ```
   - **Output Schema**:
     ```json
     {
       "activeNodeCount": "number",
       "geographicSpread": {
         "coverageAreaKm2": "number",
         "uniqueGeohashes": "number"
       },
       "healthScore": "number (0-100)",
       "lastActivityTimestamp": "string (ISO 8601)"
     }
     ```
   - **Logic**:
     - Query HazardsTable for unique `contributorId` (hashed signatures) in geohash prefix
     - Calculate geographic spread using geohash diversity
     - Health score = (activeNodes * 20) + (geographicSpread * 30) + (recentActivity * 50)

2. **`identify_coverage_gaps`**
   - **Input Schema**:
     ```json
     {
       "boundingBox": {
         "north": "number",
         "south": "number",
         "east": "number",
         "west": "number"
       },
       "minReportsThreshold": "number (default: 5)"
     }
     ```
   - **Output Schema**:
     ```json
     {
       "gapPolygons": [
         {
           "geohash": "string",
           "centerLat": "number",
           "centerLon": "number",
           "reportCount": "number",
           "severity": "LOW | MEDIUM | HIGH"
         }
       ],
       "totalGaps": "number"
     }
     ```
   - **Logic**:
     - Divide bounding box into geohash grid (precision 6)
     - Query HazardsTable for each cell
     - Flag cells with < minReportsThreshold as gaps
     - Severity: HIGH (0 reports), MEDIUM (1-2), LOW (3-4)

**Data Sources**:
- HazardsTable (for contributor diversity and telemetry density)

---

#### Action Group 3: Maintenance Logistics (The Manager)

**Purpose**: Prioritize repair queue and estimate costs.

**Lambda**: `MaintenanceLogisticsLambda` (Python 3.12)  
**Location**: `packages/backend/src/actions/maintenance-logistics.py`

**Tools**:

1. **`prioritize_repair_queue`**
   - **Input Schema**:
     ```json
     {
       "hazardIds": ["string"],
       "trafficDensitySource": "MOCK | REAL (default: MOCK)"
     }
     ```
   - **Output Schema**:
     ```json
     {
       "prioritizedQueue": [
         {
           "hazardId": "string",
           "priority": "number (1-100)",
           "reasoning": "string",
           "estimatedCost": "number (USD)"
         }
       ]
     }
     ```
   - **Logic**:
     - Fetch hazards from HazardsTable
     - Priority = (severity * 40) + (trafficDensity * 30) + (age * 20) + (verificationScore * 10)
     - Severity mapping: POTHOLE=60, DEBRIS=40, ACCIDENT=100, ANIMAL=20
     - Traffic density: Mock data (urban=80, suburban=50, rural=20)

2. **`estimate_repair_cost`**
   - **Input Schema**:
     ```json
     {
       "hazardIds": ["string"]
     }
     ```
   - **Output Schema**:
     ```json
     {
       "totalCost": "number (USD)",
       "breakdown": [
         {
           "hazardId": "string",
           "hazardType": "string",
           "baseCost": "number",
           "severityMultiplier": "number",
           "finalCost": "number"
         }
       ]
     }
     ```
   - **Logic**:
     - Base costs: POTHOLE=$500, DEBRIS=$200, ACCIDENT=$5000, ANIMAL=$100
     - Severity multiplier: verificationScore/100 (e.g., 85/100 = 0.85x cost)
     - Final cost = baseCost * (1 + severityMultiplier * 0.2)

**Data Sources**:
- HazardsTable (for hazard details)
- MaintenanceQueueTable (for existing reports)

---

#### Action Group 4: Generative Urban Planner (The Architect)

**Purpose**: Propose alternative road paths to bypass high-cost hazard zones.

**Lambda**: `UrbanPlannerLambda` (Python 3.12)  
**Location**: `packages/backend/src/actions/urban-planner.py`

**Tools**:

1. **`find_optimal_path`**
   - **Input Schema**:
     ```json
     {
       "start": {"lat": "number", "lon": "number"},
       "end": {"lat": "number", "lon": "number"},
       "constraints": {
         "avoidHazardTypes": ["string"],
         "maxDetourPercent": "number (default: 20)"
       }
     }
     ```
   - **Output Schema**:
     ```json
     {
       "path": [
         {"lat": "number", "lon": "number", "geohash": "string"}
       ],
       "totalDistanceKm": "number",
       "hazardsAvoided": "number",
       "detourPercent": "number"
     }
     ```
   - **Logic**:
     - Simplified A* pathfinding using geohash waypoints (precision 6)
     - Cost function: distance + (hazardDensity * 10)
     - Query HazardsTable for hazard density per geohash
     - Return waypoint list (frontend renders polyline)

2. **`calculate_construction_roi`**
   - **Input Schema**:
     ```json
     {
       "pathData": {
         "distanceKm": "number",
         "hazardsAvoided": "number"
       },
       "constructionCostPerKm": "number (default: 1000000)"
     }
     ```
   - **Output Schema**:
     ```json
     {
       "constructionCost": "number (USD)",
       "annualRepairSavings": "number (USD)",
       "breakEvenYears": "number",
       "roi10Year": "number (percent)"
     }
     ```
   - **Logic**:
     - Construction cost = distanceKm * constructionCostPerKm
     - Annual repair savings = hazardsAvoided * avgRepairCost ($500)
     - Break-even = constructionCost / annualRepairSavings
     - ROI = ((annualRepairSavings * 10) - constructionCost) / constructionCost * 100

**Data Sources**:
- HazardsTable (for hazard density per geohash)
- EconomicMetricsTable (for historical repair costs)

---

## Frontend Integration

### Existing Endpoint
- **POST** `/api/agent/chat` (packages/frontend/app/api/agent/chat/route.ts)
  - Used by: DiffChat component
  - Invokes: Bedrock Agent with diff context

### New Endpoints Required

1. **POST** `/api/agent/network-analysis`
   - Body: `{ geohash, radiusKm }`
   - Returns: Node connectivity + coverage gaps
   - UI: New "Network Health" panel in Console tab

2. **POST** `/api/agent/maintenance-priority`
   - Body: `{ hazardIds[] }`
   - Returns: Prioritized queue with cost estimates
   - UI: "Maintenance" tab (already exists, needs wiring)

3. **POST** `/api/agent/urban-planning`
   - Body: `{ start, end, constraints }`
   - Returns: Optimal path + ROI analysis
   - UI: New "Urban Planner" modal (overlay on map)

---

## Environment Variables

**No new env vars required**. Reuse existing:
- `NEXT_PUBLIC_BEDROCK_AGENT_ID=TAWWC3SQ0L`
- `NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID=TSTALIASID`
- `NEXT_PUBLIC_AWS_REGION=us-east-1`

Backend Lambdas will use:
- `HAZARDS_TABLE_NAME`
- `LEDGER_TABLE_NAME`
- `MAINTENANCE_QUEUE_TABLE_NAME`
- `ECONOMIC_METRICS_TABLE_NAME`

---

## Cost Estimate

**Bedrock Agent Invocations**:
- Current: ~100 verifications/day = $0.60/day (Nova Lite)
- New: +50 network analyses + 30 maintenance queries + 10 urban planning = +$0.54/day
- **Total**: ~$1.14/day ($34/month)

**Lambda Executions**:
- 3 new Lambdas @ 512MB, avg 2s execution
- ~90 invocations/day = $0.02/day
- **Total**: $0.62/month

**DynamoDB**:
- All tables use on-demand billing (free tier covers dev usage)

**Grand Total**: ~$35/month (well within $200 AWS credit budget)

---

## Security Considerations

1. **Action Group Permissions**:
   - Each Lambda has least-privilege IAM role
   - Read-only access to HazardsTable for analysis tools
   - Write access to MaintenanceQueueTable only for logistics tools

2. **Input Validation**:
   - All tool inputs validated via JSON Schema in Bedrock Agent config
   - Geohash format: 7 chars, alphanumeric
   - Coordinates: lat [-90, 90], lon [-180, 180]

3. **Rate Limiting**:
   - API Gateway: 100 req/sec (existing)
   - Bedrock Agent: No additional throttling needed (Nova Lite handles burst)

---

## Testing Strategy

1. **Unit Tests** (Python):
   - Mock DynamoDB responses
   - Test each tool function independently
   - Coverage target: 80%

2. **Integration Tests**:
   - Deploy to dev stack
   - Invoke Bedrock Agent via AWS CLI
   - Verify tool responses match schema

3. **Frontend E2E**:
   - Test new API endpoints with Postman
   - Verify UI renders agent responses correctly

---

## Rollout Plan

**Phase 1**: Discovery & SDD (Current)  
**Phase 2**: Lambda Implementation (3 new Action Group Lambdas)  
**Phase 3**: CDK Stack Update (Add Lambdas to IntelligenceStack)  
**Phase 4**: Bedrock Agent Configuration (Update via AWS Console or CDK)  
**Phase 5**: Frontend API Routes (3 new Next.js API routes)  
**Phase 6**: UI Components (Network Health panel, Urban Planner modal)  
**Phase 7**: Testing & Deployment

---

## Open Questions

1. **Bedrock Agent Update Method**: Use AWS Console or CDK L1 constructs?
   - **Recommendation**: CDK L1 (`CfnAgent`, `CfnAgentActionGroup`) for IaC
   
2. **Urban Planning Graph Data**: Use real OSM data or simplified waypoint grid?
   - **Recommendation**: Simplified geohash grid for hackathon (OSM integration = future work)

3. **Traffic Density Source**: Mock data or integrate real API (e.g., TomTom)?
   - **Recommendation**: Mock data with configurable JSON file

---

## Approval Checklist

- [ ] Architecture reviewed by Lead Engineer
- [ ] Cost estimate approved
- [ ] Security considerations validated
- [ ] Frontend integration plan confirmed
- [ ] Proceed to Phase 2 (Lambda Implementation)

---

**Document Owner**: Lead Cloud Architect  
**Next Review**: After Phase 2 completion
