# VIGIA Platform Depth Upgrade - AWS-Native Architecture

**Date**: 2026-03-04  
**Status**: 🚧 IN PROGRESS  
**Objective**: Replace generic Lambda code with AWS-native managed services

---

## 🎯 Strategic Goal

Prove to judges that VIGIA is **deeply integrated with AWS internals**, not just "Lambda functions that could run anywhere."

---

## 📊 Platform Depth Score

| Component | Before (Generic) | After (AWS-Native) | Depth Score |
|-----------|------------------|-------------------|-------------|
| Urban Planner | Python Lambda | Step Functions Express Workflow | ⭐⭐⭐⭐⭐ |
| Event Processing | Direct invocation | EventBridge Pipes + Filters | ⭐⭐⭐⭐ |
| Spatial Analysis | Custom math | Location Service Geofences | ⭐⭐⭐⭐⭐ |
| Verification | Polling | DynamoDB Streams → Pipes | ⭐⭐⭐⭐ |

**Target**: 4.5+ stars average (AWS-native architecture)

---

## Phase 1: Step Functions Urban Planner ✅

### Problem
Current `urban-planner.py` is a monolithic Lambda that:
- Generates Bezier paths
- Calculates construction costs
- Computes ROI
- All in one function (could run on any cloud)

### Solution
Refactor into **AWS Step Functions Express Workflow** with parallel execution:

```
┌─────────────────────────────────────────────────────────────┐
│                  Urban Planner Workflow                     │
├─────────────────────────────────────────────────────────────┤
│  Input: {start, end, constraints}                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Parallel Execution                     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Branch A: GenerateBezierPathLambda                │   │
│  │  Branch B: CalculateLandCostLambda                 │   │
│  │  Branch C: CheckZoneRegulationsLambda              │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         MergeResults (Choice State)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  Output: {path, cost, roi, compliance}                      │
└─────────────────────────────────────────────────────────────┘
```

### AWS-Native Features Used
- **Amazon States Language (ASL)**: Declarative workflow definition
- **Parallel State**: True concurrent execution (not sequential)
- **Express Workflows**: <5s execution, synchronous response
- **IAM Service Roles**: Least-privilege execution
- **CloudWatch Logs**: Automatic execution tracing

### Cost Impact
- Step Functions Express: $1.00 per 1M requests
- Current Lambda: $0.20 per 1M requests
- **Increase**: +$0.80 per 1M (acceptable for demo)

---

## Phase 2: EventBridge Pipes (Future)

### Problem
Current architecture polls or directly invokes verification.

### Solution
**Amazon EventBridge Pipes** with built-in filtering:

```
DynamoDB Stream → EventBridge Pipe → Step Functions
                  (Filter: status='PENDING' AND confidence>70)
```

### AWS-Native Features
- **EventBridge Pipes**: Serverless event filtering
- **DynamoDB Streams**: Change data capture
- **Built-in Transformations**: No Lambda needed for filtering

**Status**: Deferred to post-hackathon

---

## Phase 3: Location Service Geofences ✅

### Problem
Current implementation:
- Shows points on a map
- No spatial intelligence
- No zone awareness

### Solution
**Amazon Location Service Geofences** for spatial analysis:

```
┌─────────────────────────────────────────────────────────────┐
│              Location Service Integration                   │
├─────────────────────────────────────────────────────────────┤
│  1. Create Geofence Collection: VigiaRestrictedZones       │
│  2. Define Zones:                                           │
│     - Residential (low priority)                            │
│     - Commercial (medium priority)                          │
│     - Industrial (high priority)                            │
│     - Protected (no construction)                           │
│  3. BatchEvaluateGeofences API:                             │
│     - Input: Bezier path waypoints                          │
│     - Output: Zone intersections                            │
│  4. Adjust ROI based on zone regulations                    │
└─────────────────────────────────────────────────────────────┘
```

### AWS-Native Features Used
- **Geofence Collections**: Managed spatial index
- **BatchEvaluateGeofences**: Bulk spatial queries
- **Esri/HERE Maps**: Enterprise-grade map data
- **IAM Policies**: Fine-grained access control

### Cost Impact
- Location Service: $0.04 per 1,000 geofence evaluations
- **Estimate**: $0.12 for 3,000 evaluations (demo phase)

---

## Implementation Checklist

### Phase 1: Step Functions Urban Planner
- [x] Create ASL workflow definition (`urban-planner.asl.json`)
- [x] Split Lambda into 3 micro-functions:
  - [x] `generate-bezier-path.py`
  - [x] `calculate-land-cost.py`
  - [x] `check-zone-regulations.py`
- [x] Update CDK stack (`intelligence-stack.ts`)
- [x] Grant Bedrock Agent `states:StartSyncExecution` permission
- [ ] Update frontend API route to invoke Step Functions
- [ ] Test end-to-end workflow
- [ ] Update documentation

### Phase 3: Location Service Geofences
- [x] Create Geofence Collection in CDK
- [x] Define 4 demo zones (Residential, Commercial, Industrial, Protected)
- [x] Add `BatchEvaluateGeofences` call to path generation
- [x] Update ROI calculation based on zone intersections
- [ ] Update frontend to display zone overlays
- [ ] Test geofence evaluation
- [ ] Update documentation

---

## Success Metrics

**Platform Depth Indicators**:
1. ✅ Uses ASL (Amazon States Language) - unique to AWS
2. ✅ Parallel execution via Step Functions - not generic Lambda
3. ✅ Location Service Geofences - AWS-specific spatial engine
4. ⏳ EventBridge Pipes - serverless filtering (future)
5. ✅ DynamoDB Streams - change data capture (existing)

**Judge Impact**:
- "This couldn't run on Azure/GCP without major rewrites"
- "Deep integration with AWS managed services"
- "Leverages platform-specific features (ASL, Geofences)"

---

## Cost Summary

| Service | Current | After Upgrade | Delta |
|---------|---------|---------------|-------|
| Lambda | $0.02/day | $0.02/day | $0 |
| Step Functions | $0 | $0.10/day | +$0.10 |
| Location Service | $0 | $0.02/day | +$0.02 |
| **Total** | **$0.60/day** | **$0.74/day** | **+$0.14** |

**Monthly**: $22.20 (well within $200 budget)

---

## Rollback Plan

If Step Functions or Location Service fail:
1. Keep original `urban-planner.py` Lambda as fallback
2. Feature flag: `USE_STEP_FUNCTIONS=false`
3. Revert CDK stack to previous version

---

**Status**: Phase 1 & 3 implementation in progress  
**Target Completion**: 2026-03-04 04:00 AM IST  
**Owner**: Principal Solutions Architect
