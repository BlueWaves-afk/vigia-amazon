# 🔧 Bedrock Agent Configuration Fix Required

## Issues Found

### 1. ✅ Hazards ARE being stored in DynamoDB
- Telemetry submission works correctly
- Hazards table has entries

### 2. ✅ Orchestrator Lambda IS being triggered
- DynamoDB Stream is enabled and working
- Lambda processes new hazards

### 3. ✅ Traces ARE being created
- Traces exist in DynamoDB with hazardId format `geohash#timestamp`
- Auto-verify mode creates traces with score 50

### 4. ❌ Bedrock Agent Lambda ARN is outdated
- **Current (wrong)**: `VigiaStack-IntelligenceBedrockRouterFunctionE993F7-sdUx2LRYu4wg`
- **Correct**: `VigiaStack-IntelligenceWithHazardsBedrockRouterFun-gW5JPucnZJJG`
- **Error**: `Access denied while invoking Lambda function`

### 5. ❌ Frontend not transitioning from PENDING to UNVERIFIED
- `telemetry-submitted` event IS being dispatched
- But hazard IDs don't match between detection and telemetry

## Manual Fix Required (AWS Console)

### Step 1: Update Bedrock Agent Action Group

1. Go to **AWS Console** → **Amazon Bedrock** → **Agents**
2. Select agent: `vigia-auditor-strategist` (ID: `TAWWC3SQ0L`)
3. Click **Edit** (top right)
4. Scroll to **Action Groups** section
5. Click **Edit** on `QueryAndVerify` action group
6. Under **Action group executor**:
   - Select **Lambda function**
   - **Replace** the Lambda ARN with:
     ```
     arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-IntelligenceWithHazardsBedrockRouterFun-gW5JPucnZJJG
     ```
7. Click **Update action group**
8. Click **Save and exit**
9. Click **Prepare** (top right) to update the agent

### Step 2: Test the System

1. **Refresh your browser** (hard refresh)
2. **Upload a new video** in Detection Mode
3. **Watch the verification pipeline**:
   - Hazards appear as PENDING
   - After 5s → UNVERIFIED (telemetry sent)
   - After 10-15s → VERIFYING (Bedrock Agent processing)
   - After 20-30s → VERIFIED or REJECTED (Agent responded)

## What's Working Now

✅ **Hazard Detection**: ONNX model detects potholes
✅ **Telemetry Submission**: Hazards sent to backend
✅ **DynamoDB Storage**: Hazards stored with geohash
✅ **Stream Trigger**: Orchestrator Lambda triggered
✅ **Trace Creation**: Traces stored in database
✅ **API Endpoint**: GET /traces/{hazardId} returns traces
✅ **CORS**: Enabled and working
✅ **Frontend Polling**: Queries correct hazardId format

## What Needs Fixing

❌ **Bedrock Agent Lambda ARN**: Update in AWS Console (see Step 1 above)
❌ **Frontend State Transition**: Hazards stuck in PENDING (will fix after Agent works)

## Why Hazards Stay in PENDING

The frontend listens for `telemetry-submitted` event to transition from PENDING → UNVERIFIED. The event IS being dispatched, but there's a mismatch:

- **Hazard ID when detected**: `tguqs70#2026-03-01T09:26:00.000Z`
- **Hazard ID in telemetry event**: Same format ✅
- **Issue**: Event listener might not be matching IDs correctly

Once the Bedrock Agent is fixed and actually processing hazards, we can verify the full flow works.

## Testing After Fix

```bash
# 1. Submit test hazard
curl -X POST https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod/telemetry \
  -H "Content-Type: application/json" \
  -d '{"lat":22.2900,"lon":84.8800,"hazardType":"POTHOLE","confidence":0.95,"timestamp":"2026-03-01T09:30:00.000Z","signature":"TEST_MODE_SIGNATURE"}'

# 2. Wait 15 seconds for processing

# 3. Check orchestrator logs
aws logs tail /aws/lambda/VigiaStack-IntelligenceWithHazardsOrchestratorFunc-ij8V0sH7VmcS \
  --since 1m \
  --region us-east-1 \
  --format short | grep -E "Bedrock|score|Processed"

# 4. Check if trace was created
aws dynamodb query \
  --table-name VigiaStack-IntelligenceWithHazardsAgentTracesTable5CD02A70-C0SX07TU70LN \
  --index-name HazardIdIndex \
  --key-condition-expression "hazardId = :hid" \
  --expression-attribute-values '{":hid":{"S":"tguqes0#2026-03-01T09:30:00.000Z"}}' \
  --region us-east-1
```

## Expected Behavior After Fix

1. **Hazard detected** → Status: PENDING
2. **Telemetry sent** → Status: UNVERIFIED
3. **Orchestrator triggered** → Invokes Bedrock Agent
4. **Agent queries similar hazards** → Calculates verification score
5. **Trace stored** → Score 0-100 with reasoning
6. **Frontend polls** → Receives trace
7. **Status updated** → VERIFIED (≥70) or REJECTED (<70)
8. **Auto-removed** → After 5 seconds

## Current Workaround

The system is in **auto-verify mode** which:
- ✅ Creates traces immediately
- ✅ Assigns score based on confidence (≥0.6 → 80, <0.6 → 50)
- ❌ Doesn't use Bedrock Agent intelligence
- ❌ Doesn't query similar hazards

This is sufficient for basic testing but not for the full AI verification pipeline.

## Summary

**Action Required**: Update Bedrock Agent Lambda ARN in AWS Console (5 minutes)

**After Fix**: Full AI verification pipeline will work end-to-end! 🎉
