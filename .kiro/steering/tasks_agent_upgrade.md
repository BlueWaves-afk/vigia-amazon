# VIGIA Agent Upgrade - Implementation Tasks
**Version**: 2.0  
**Created**: 2026-03-04  
**Status**: Phase 1 & 3 Complete - AWS-Native Architecture Upgrade

---

## 🎯 Architectural Shift: Platform Depth Upgrade

**Objective**: Replace generic Lambda code with AWS-native managed services to prove deep AWS integration.

**Key Changes**:
1. Urban Planner → Step Functions Express Workflow (ASL)
2. Spatial Analysis → Amazon Location Service Geofences
3. Event Processing → EventBridge Pipes (future)

---

## Phase 1: Step Functions Urban Planner ✅

### Task 1.1: ASL Workflow Definition
- [x] Create `urban-planner.asl.json` with Amazon States Language
- [x] Define Parallel State with 3 branches:
  - [x] Branch A: GenerateBezierPath (with Location Service integration)
  - [x] Branch B: CalculateLandCost
  - [x] Branch C: CheckZoneRegulations (with Location Service integration)
- [x] Add MergeResults state with intrinsic functions
- [x] Add CalculateROI state with financial logic

### Task 1.2: Micro-Lambda Functions
- [x] Create `generate-bezier-path.py`
  - [x] Bezier curve generation (21 waypoints)
  - [x] BatchEvaluateGeofences API call
  - [x] Hazard avoidance calculation
- [x] Create `calculate-land-cost.py`
  - [x] Distance-based cost calculation
  - [x] Land acquisition formula
- [x] Create `check-zone-regulations.py`
  - [x] BatchEvaluateGeofences API call
  - [x] Compliance status determination

### Task 1.3: CDK Infrastructure
- [x] Add Step Functions imports to `intelligence-stack.ts`
- [x] Create StateMachine resource (Express Workflow)
- [x] Grant Lambda invoke permissions to State Machine
- [x] Grant Bedrock Agent `states:StartSyncExecution` permission
- [x] Output State Machine ARN

### Task 1.4: Integration
- [x] Update frontend API route to invoke Step Functions
- [x] Test end-to-end workflow via Bedrock Agent
- [x] Verify parallel execution in CloudWatch Logs

---

## Phase 2: Lambda Implementation (Action Groups) ✅

### Task 2.1: Network Intelligence Lambda
- [x] Create `packages/backend/src/actions/network-intelligence.py`
- [x] Implement `analyze_node_connectivity(geohash, radiusKm)`
  - [x] Query HazardsTable for unique contributors in geohash prefix
  - [x] Calculate geographic spread (unique geohashes)
  - [x] Compute health score formula
  - [x] Return JSON response matching schema
- [x] Implement `identify_coverage_gaps(boundingBox, minReportsThreshold)`
  - [x] Generate geohash grid (precision 6) for bounding box
  - [x] Query HazardsTable for each cell
  - [x] Flag gaps with severity levels
  - [x] Return GeoJSON-compatible response
- [x] Add error handling and logging
- [ ] Write unit tests (mock DynamoDB)

### Task 2.2: Maintenance Logistics Lambda
- [x] Create `packages/backend/src/actions/maintenance-logistics.py`
- [x] Implement `prioritize_repair_queue(hazardIds, trafficDensitySource)`
  - [x] Fetch hazards from HazardsTable
  - [x] Apply priority formula
  - [x] Add mock traffic density data
  - [x] Sort by priority descending
  - [x] Return prioritized list with reasoning
- [x] Implement `estimate_repair_cost(hazardIds)`
  - [x] Define base cost mapping (POTHOLE=$500, etc.)
  - [x] Apply severity multiplier
  - [x] Calculate total and breakdown
  - [x] Return cost estimate JSON
- [x] Add error handling and logging
- [ ] Write unit tests (mock DynamoDB)

### Task 2.3: Urban Planner Lambda (Legacy - Kept as Fallback)
- [x] Keep existing `urban-planner.py` for backward compatibility
- [x] Add feature flag: `USE_STEP_FUNCTIONS=true`
- [x] Implement `find_optimal_path(start, end, constraints)`
- [x] Implement `calculate_construction_roi(pathData, constructionCostPerKm)`

---

## Phase 3: Amazon Location Service Geofences ✅

### Task 3.1: Geofence Collection
- [x] Create `VigiaRestrictedZones` collection in CDK
- [x] Define 4 demo zones:
  - [x] Residential (low priority)
  - [x] Commercial (medium priority)
  - [x] Industrial (high priority)
  - [x] Protected (no construction)
- [x] Add geofence polygons to collection

### Task 3.2: Integration with Path Generation
- [x] Add `BatchEvaluateGeofences` call to `generate-bezier-path.py`
- [x] Parse zone intersections from API response
- [x] Adjust ROI based on zone regulations
- [x] Grant IAM permissions for Location Service

### Task 3.3: Frontend Visualization
- [ ] Update map to display geofence zones as overlays
- [ ] Color-code zones by priority (red=protected, yellow=commercial, etc.)
- [ ] Show zone intersections in Urban Planner modal

---
  - [x] Estimate annual repair savings
  - [x] Compute break-even and 10-year ROI
  - [x] Return financial analysis JSON
- [x] Add error handling and logging
- [ ] Write unit tests (mock DynamoDB)

---

## Phase 3: CDK Infrastructure Update

### Task 3.1: Update IntelligenceStack
- [x] Open `packages/infrastructure/lib/stacks/intelligence-stack.ts`
- [x] Add NetworkIntelligenceLambda resource
  - [x] Runtime: Python 3.12
  - [x] Handler: `network-intelligence.lambda_handler`
  - [x] Timeout: 30s
  - [x] Environment: `HAZARDS_TABLE_NAME`
  - [x] Grant read access to HazardsTable
  - [x] Add Bedrock invoke permission
- [x] Add MaintenanceLogisticsLambda resource
  - [x] Runtime: Python 3.12
  - [x] Handler: `maintenance-logistics.lambda_handler`
  - [x] Timeout: 30s
  - [x] Environment: `HAZARDS_TABLE_NAME`, `MAINTENANCE_QUEUE_TABLE_NAME`
  - [x] Grant read access to both tables
  - [x] Add Bedrock invoke permission
- [x] Add UrbanPlannerLambda resource
  - [x] Runtime: Python 3.12
  - [x] Handler: `urban-planner.lambda_handler`
  - [x] Timeout: 30s
  - [x] Environment: `HAZARDS_TABLE_NAME`, `ECONOMIC_METRICS_TABLE_NAME`
  - [x] Grant read access to both tables
  - [x] Add Bedrock invoke permission
- [x] Export Lambda ARNs as CloudFormation outputs
- [x] Run `cdk synth` to validate
- [x] Run `cdk deploy` to deploy

### Task 3.2: Verify Lambda Deployment
- [x] Check CloudFormation outputs for Lambda ARNs
- [x] Test each Lambda independently via AWS CLI
  - [x] `aws lambda invoke --function-name NetworkIntelligenceLambda ...`
  - [x] `aws lambda invoke --function-name MaintenanceLogisticsLambda ...`
  - [x] `aws lambda invoke --function-name UrbanPlannerLambda ...`
- [x] Verify DynamoDB permissions (check CloudWatch Logs)

---

## Phase 4: Bedrock Agent Configuration

### Task 4.1: Update Agent via AWS Console (Manual)
- [x] Navigate to Amazon Bedrock Console → Agents
- [x] Select Agent `vigia-auditor-strategist` (ID: `TAWWC3SQ0L`)
- [x] Add Action Group: "NetworkIntelligence"
  - [x] Lambda: NetworkIntelligenceLambda ARN
  - [x] API Schema: Define `analyze_node_connectivity` and `identify_coverage_gaps`
  - [x] Input/Output schemas from `agent_architecture.md`
- [x] Add Action Group: "MaintenanceLogistics"
  - [x] Lambda: MaintenanceLogisticsLambda ARN
  - [x] API Schema: Define `prioritize_repair_queue` and `estimate_repair_cost`
  - [x] Input/Output schemas from `agent_architecture.md`
- [x] Add Action Group: "UrbanPlanner"
  - [x] Lambda: UrbanPlannerLambda ARN
  - [x] API Schema: Define `find_optimal_path` and `calculate_construction_roi`
  - [x] Input/Output schemas from `agent_architecture.md`
- [x] Update Agent Instructions (system prompt)
- [x] Create new Agent Version
- [x] Update Alias `TSTALIASID` to point to new version
- [x] Test Agent via Bedrock Console (invoke with sample queries)

### Task 4.2: Alternative - Update Agent via CDK (Advanced)
- [ ] Research CDK L1 constructs: `CfnAgent`, `CfnAgentActionGroup`
- [ ] Create `packages/infrastructure/lib/constructs/bedrock-agent.ts`
- [ ] Define Agent configuration as code
- [ ] Import into IntelligenceStack
- [ ] Deploy via `cdk deploy`
- [ ] **Note**: This is optional; Console method is faster for hackathon

---

## Phase 5: Frontend API Routes

### Task 5.1: Network Analysis Endpoint
- [ ] Create `packages/frontend/app/api/agent/network-analysis/route.ts`
- [ ] Implement POST handler:
  - [ ] Accept `{ geohash, radiusKm }` from request body
  - [ ] Invoke Bedrock Agent with context:
    ```
    Analyze network health for geohash {geohash} within {radiusKm}km radius.
    Use analyze_node_connectivity and identify_coverage_gaps tools.
    ```
  - [ ] Parse agent response
  - [ ] Return JSON: `{ connectivity, gaps }`
- [ ] Add error handling (500 on failure)
- [ ] Test with Postman

### Task 5.2: Maintenance Priority Endpoint
- [ ] Create `packages/frontend/app/api/agent/maintenance-priority/route.ts`
- [ ] Implement POST handler:
  - [ ] Accept `{ hazardIds[] }` from request body
  - [ ] Invoke Bedrock Agent with context:
    ```
    Prioritize these hazards for repair: {hazardIds}.
    Use prioritize_repair_queue and estimate_repair_cost tools.
    ```
  - [ ] Parse agent response
  - [ ] Return JSON: `{ prioritizedQueue, totalCost }`
- [ ] Add error handling
- [ ] Test with Postman

### Task 5.3: Urban Planning Endpoint
- [ ] Create `packages/frontend/app/api/agent/urban-planning/route.ts`
- [ ] Implement POST handler:
  - [ ] Accept `{ start, end, constraints }` from request body
  - [ ] Invoke Bedrock Agent with context:
    ```
    Find optimal path from {start} to {end} avoiding {constraints.avoidHazardTypes}.
    Use find_optimal_path and calculate_construction_roi tools.
    ```
  - [ ] Parse agent response
  - [ ] Return JSON: `{ path, roi }`
- [ ] Add error handling
- [ ] Test with Postman

---

## Phase 6: Frontend UI Components

### Task 6.1: Network Health Panel
- [ ] Create `packages/frontend/app/components/NetworkHealthPanel.tsx`
- [ ] Design:
  - [ ] Input: Geohash or location search
  - [ ] Button: "Analyze Network"
  - [ ] Display: Active nodes, health score, coverage map
  - [ ] Render coverage gaps as red polygons on map
- [ ] Wire to `/api/agent/network-analysis`
- [ ] Add to Console tab (new sub-tab)
- [ ] Style with monochrome design system

### Task 6.2: Maintenance Priority Integration
- [ ] Open `packages/frontend/app/components/MaintenancePanel.tsx` (already exists)
- [ ] Add "Prioritize Queue" button
- [ ] On click:
  - [ ] Collect selected hazard IDs from queue
  - [ ] Call `/api/agent/maintenance-priority`
  - [ ] Re-render queue in priority order
  - [ ] Show cost estimate at top
- [ ] Add loading state during agent invocation
- [ ] Display agent reasoning in tooltip

### Task 6.3: Urban Planner Modal
- [ ] Create `packages/frontend/app/components/UrbanPlannerModal.tsx`
- [ ] Design:
  - [ ] Input: Start/End coordinates (click on map or search)
  - [ ] Checkboxes: Hazard types to avoid
  - [ ] Slider: Max detour percent
  - [ ] Button: "Find Optimal Path"
  - [ ] Display: Path polyline on map, ROI metrics
- [ ] Wire to `/api/agent/urban-planning`
- [ ] Render path as blue polyline on LiveMap
- [ ] Show ROI breakdown in side panel
- [ ] Add "Export Report" button (PDF generation)

### Task 6.4: Activity Group Integration
- [ ] Add "Urban Planner" to activity group list in `page.tsx`
- [ ] Icon: 🏗️ or similar
- [ ] Render UrbanPlannerModal when selected
- [ ] Ensure modal overlays LiveMap correctly

---

## Phase 7: Testing & Validation

### Task 7.1: Unit Tests
- [ ] Python Lambda tests (pytest):
  - [ ] `tests/test_network_intelligence.py`
  - [ ] `tests/test_maintenance_logistics.py`
  - [ ] `tests/test_urban_planner.py`
- [ ] Run: `pytest packages/backend/src/actions/tests/`
- [ ] Target: 80% coverage

### Task 7.2: Integration Tests
- [ ] Test Bedrock Agent via AWS CLI:
  ```bash
  aws bedrock-agent-runtime invoke-agent \
    --agent-id TAWWC3SQ0L \
    --agent-alias-id TSTALIASID \
    --session-id test-session \
    --input-text "Analyze network health for geohash drt2yzr"
  ```
- [ ] Verify agent calls correct Lambda
- [ ] Verify response matches schema

### Task 7.3: Frontend E2E Tests
- [ ] Test Network Health Panel:
  - [ ] Enter geohash → Click "Analyze" → Verify results render
- [ ] Test Maintenance Priority:
  - [ ] Select hazards → Click "Prioritize" → Verify queue reorders
- [ ] Test Urban Planner:
  - [ ] Set start/end → Click "Find Path" → Verify polyline renders
- [ ] Check browser console for errors
- [ ] Verify agent traces appear in Console tab

### Task 7.4: Cost Monitoring
- [ ] Check AWS Cost Explorer after 24 hours
- [ ] Verify Bedrock costs < $2/day
- [ ] Verify Lambda costs < $0.10/day
- [ ] Adjust if exceeding budget

---

## Phase 8: Documentation & Handoff

### Task 8.1: Update README
- [ ] Add "Agent Capabilities" section
- [ ] Document new API endpoints
- [ ] Add usage examples for each domain

### Task 8.2: Create Demo Script
- [ ] Write `DEMO_SCRIPT.md` with step-by-step walkthrough:
  1. Hazard Verification (existing)
  2. Network Health Analysis (new)
  3. Maintenance Prioritization (new)
  4. Urban Planning (new)
- [ ] Include screenshots

### Task 8.3: Record Demo Video
- [ ] Screen recording showing all 4 agent capabilities
- [ ] Narrate agent reasoning
- [ ] Upload to YouTube (unlisted)
- [ ] Add link to README

---

## Rollback Plan

If any phase fails:
1. **Lambda Issues**: Revert CDK stack to previous version (`cdk deploy --rollback`)
2. **Agent Issues**: Revert Agent Alias to previous version in Bedrock Console
3. **Frontend Issues**: Remove new API routes, hide UI components

---

## Success Criteria

- [ ] All 3 new Action Groups deployed and functional
- [ ] Agent responds correctly to queries in all 4 domains
- [ ] Frontend UI renders agent responses without errors
- [ ] Total cost < $2/day
- [ ] Demo video recorded and published

---

**Estimated Time**: 8-12 hours (1-2 days)  
**Priority**: High (Competition deadline: March 20, 2026)  
**Owner**: Lead Cloud Architect + AI Engineer
