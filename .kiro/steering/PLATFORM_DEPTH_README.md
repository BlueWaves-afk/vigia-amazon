# Platform Depth Upgrade - Quick Start Guide

## 🎯 What This Does

Transforms VIGIA's Urban Planner from a generic Lambda function into an **AWS-native architecture** using:
- **Step Functions Express Workflows** (Amazon States Language)
- **Amazon Location Service Geofences** (Managed spatial intelligence)
- **Parallel Execution** (Infrastructure-level orchestration)

## 🚀 Deployment (3 Steps)

### Step 1: Deploy Infrastructure
```bash
cd packages/infrastructure
npx cdk deploy --all --require-approval never
```

**Expected Output**:
```
✅ VigiaStack-UrbanPlannerStateMachine-XXXXX
✅ VigiaStack-VigiaRestrictedZones
✅ VigiaStack-GenerateBezierPathFunction-XXXXX
✅ VigiaStack-CalculateLandCostFunction-XXXXX
✅ VigiaStack-CheckZoneRegulationsFunction-XXXXX
```

### Step 2: Add Geofences
```bash
cd ../..
./scripts/add-geofences.sh
```

**Expected Output**:
```
✅ All 4 geofences added successfully!
```

### Step 3: Test State Machine
```bash
aws stepfunctions start-sync-execution \
  --state-machine-arn <ARN_FROM_STEP_1> \
  --input '{"start":{"lat":42.36,"lon":-71.06},"end":{"lat":42.37,"lon":-71.05},"constraints":{"avoidHazardTypes":["POTHOLE"]}}' \
  --region us-east-1
```

**Expected Output**: JSON with path, costs, ROI, and zone intersections

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Step Functions State Machine                   │
├─────────────────────────────────────────────────────────────┤
│  Input: {start, end, constraints}                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Parallel Execution                     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Branch A: GenerateBezierPath                      │   │
│  │    └─ Calls Location Service API                   │   │
│  │  Branch B: CalculateLandCost                       │   │
│  │  Branch C: CheckZoneRegulations                    │   │
│  │    └─ Calls Location Service API                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MergeResults (ASL Intrinsic Functions)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  CalculateROI (ASL Math Operations)                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│  Output: {path, costs, roi, compliance}                     │
└─────────────────────────────────────────────────────────────┘
```

## 🗺️ Geofence Zones

| Zone | Priority | Coordinates | Regulation |
|------|----------|-------------|------------|
| Residential | Low | [-71.06, 42.36] to [-71.05, 42.37] | Standard approval |
| Commercial | Medium | [-71.07, 42.35] to [-71.06, 42.36] | Business impact assessment |
| Industrial | High | [-71.08, 42.34] to [-71.07, 42.35] | Environmental review |
| Protected | Critical | [-71.09, 42.33] to [-71.08, 42.34] | Construction prohibited |

## 💰 Cost Impact

| Service | Cost/Day | Monthly |
|---------|----------|---------|
| Step Functions Express | $0.10 | $3.00 |
| Location Service | $0.02 | $0.60 |
| Lambda (3 micro-functions) | $0.02 | $0.60 |
| **Total** | **$0.14** | **$4.20** |

**Budget**: Well within $200 AWS credits

## 🎯 Judge Talking Points

1. **"We use Amazon States Language for declarative workflow orchestration"**
   - Not generic Lambda code
   - AWS-specific ASL syntax

2. **"Parallel execution is handled by Step Functions infrastructure"**
   - Not custom threading code
   - Built-in orchestration

3. **"Spatial analysis leverages Amazon Location Service's managed geofence engine"**
   - Not custom math
   - AWS-managed spatial intelligence

4. **"This architecture is tightly coupled to AWS platform capabilities"**
   - Couldn't run on Azure/GCP without major rewrites
   - Shows deep AWS integration

## 🧪 Verification Commands

### Check State Machine
```bash
aws stepfunctions list-state-machines --region us-east-1 | grep UrbanPlanner
```

### Check Geofence Collection
```bash
aws location describe-geofence-collection \
  --collection-name VigiaRestrictedZones \
  --region us-east-1
```

### List Geofences
```bash
aws location list-geofences \
  --collection-name VigiaRestrictedZones \
  --region us-east-1
```

### Test Geofence Evaluation
```bash
aws location batch-evaluate-geofences \
  --collection-name VigiaRestrictedZones \
  --device-position-updates '[{"DeviceId":"test","Position":[-71.06,42.36],"SampleTime":"2026-03-04T00:00:00Z"}]' \
  --region us-east-1
```

## 🔄 Rollback

If needed, revert to legacy Lambda:

```bash
# 1. Keep USE_STEP_FUNCTIONS=false in environment
# 2. Bedrock Agent still calls urban-planner Lambda
# 3. No changes to frontend
```

## 📝 Files Created

- `packages/backend/src/workflows/urban-planner.asl.json` - ASL workflow
- `packages/backend/src/actions/step-functions/generate-bezier-path.py` - Micro-Lambda
- `packages/backend/src/actions/step-functions/calculate-land-cost.py` - Micro-Lambda
- `packages/backend/src/actions/step-functions/check-zone-regulations.py` - Micro-Lambda
- `packages/infrastructure/lib/stacks/intelligence-stack.ts` - Updated CDK
- `scripts/add-geofences.sh` - Geofence setup script
- `.kiro/steering/platform_depth_upgrade.md` - Architecture doc
- `.kiro/steering/platform_depth_implementation.md` - Implementation summary

## ✅ Success Criteria

- [x] ASL workflow compiles
- [x] CDK code compiles
- [x] 3 micro-Lambdas created
- [x] Location Service collection defined
- [ ] CDK deployment successful
- [ ] Geofences added
- [ ] State Machine execution tested
- [ ] Bedrock Agent updated

---

**Status**: Ready for deployment! 🚀
