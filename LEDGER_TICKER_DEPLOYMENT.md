# DePIN Ledger Ticker Deployment Guide

## ✅ What Was Implemented

### Backend
1. **Lambda Function**: `packages/backend/src/ledger/get-entries.ts`
   - Fetches 10 most recent ledger entries
   - Sorts by timestamp (newest first)
   - Returns JSON with CORS headers

2. **CDK Updates**:
   - Added `IngestionStackProps` to accept ledger table
   - Created `LedgerGetterFunction` Lambda
   - Added `GET /ledger` API endpoint
   - Granted DynamoDB read access to ledger table

3. **API Endpoint**: `GET /ledger`
   - Returns: `{ entries: [...], count: number }`
   - CORS enabled for frontend access

### Frontend
1. **LedgerTicker Component**: `packages/frontend/app/components/LedgerTicker.tsx`
   - Fetches ledger data every 10 seconds
   - Smooth horizontal marquee animation
   - Shows: "Contributor {id} earned {credits} $VIGIA for {hazard}"
   - Placeholder: "Awaiting network consensus..." when empty
   - Hover to pause animation
   - Gradient fade on edges

2. **Dashboard Integration**: Updated `page.tsx`
   - LedgerTicker in Zone D
   - Responsive layout

---

## 🚀 Deploy Backend Updates

### Step 1: Navigate to Infrastructure
```bash
cd /Users/tommathew/Documents/Github\ Repositories/vigia-amazon/packages/infrastructure
```

### Step 2: Synthesize (Test)
```bash
npx cdk synth
```
**Expected**: CloudFormation template generated without errors

### Step 3: Deploy
```bash
npx cdk deploy --require-approval never
```

**What Will Happen**:
1. Creates new Lambda: `VigiaStack-IngestionLedgerGetterFunction...`
2. Adds IAM policy for DynamoDB read access
3. Creates new API Gateway resource: `GET /ledger`
4. Updates existing stack (no downtime)

**Deployment Time**: ~2-3 minutes

---

## 🧪 Test the Backend

### Test 1: API Endpoint
```bash
curl https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod/ledger
```

**Expected Response** (if ledger has entries):
```json
{
  "entries": [
    {
      "contributorId": "a1b2c3d4",
      "credits": 5,
      "hazardId": "9q8yyk8#2026-02-27T12:00:00Z",
      "timestamp": "2026-02-27T12:00:00Z",
      "currentHash": "abc123...",
      "previousHash": "def456..."
    }
  ],
  "count": 1
}
```

**Expected Response** (if ledger is empty):
```json
{
  "entries": [],
  "count": 0
}
```

### Test 2: Lambda Directly
```bash
aws lambda invoke \
  --function-name VigiaStack-IngestionLedgerGetterFunction... \
  --region us-east-1 \
  response.json

cat response.json
```

### Test 3: Check Lambda Logs
```bash
aws logs tail /aws/lambda/VigiaStack-IngestionLedgerGetterFunction --follow --region us-east-1
```

---

## 🎨 Test the Frontend

### Step 1: Start Dev Server
```bash
cd /Users/tommathew/Documents/Github\ Repositories/vigia-amazon/packages/frontend
npm run dev
```

### Step 2: Open Browser
http://localhost:3000

### Step 3: Check Zone D (Bottom Strip)

**If Ledger Has Entries**:
- Smooth scrolling ticker
- Shows: "✓ [Verified] Contributor a1b2c3d4 earned 5 $VIGIA for POTHOLE"
- Continuous loop animation
- Hover to pause

**If Ledger Is Empty**:
- Shows: "⏺ Awaiting network consensus..."
- Pulsing animation

### Step 4: Verify Auto-Refresh
- Wait 10 seconds
- Check browser console for fetch requests
- New entries should appear automatically

---

## 🔧 Populate Test Data (Optional)

If your ledger is empty, add test data:

```bash
aws dynamodb put-item \
  --table-name VigiaStack-TrustLedgerTable... \
  --item '{
    "ledgerId": {"S": "ledger"},
    "timestamp": {"S": "2026-02-27T12:00:00Z"},
    "contributorId": {"S": "a1b2c3d4e5f6g7h8"},
    "hazardId": {"S": "9q8yyk8#2026-02-27T12:00:00Z"},
    "credits": {"N": "5"},
    "currentHash": {"S": "abc123def456"},
    "previousHash": {"S": "000000000000"}
  }' \
  --region us-east-1
```

Refresh the page and the ticker should show the entry!

---

## 📊 Expected Output

### CDK Deploy Output
```
✨  Synthesis time: 10.2s

VigiaStack: deploying...
VigiaStack: creating CloudFormation changeset...

 ✅  VigiaStack

Outputs:
VigiaStack.ApiEndpoint = https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod/
VigiaStack.HazardsTableName = VigiaStack-IngestionHazardsTable...
VigiaStack.IngestionVigiaAPIEndpoint... = https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod/

Stack ARN:
arn:aws:cloudformation:us-east-1:203800220566:stack/VigiaStack/...

✨  Total time: 180s
```

### Browser Console (Every 10 seconds)
```
Fetching ledger entries...
Received 3 entries
```

### Visual Result
Zone D shows a smooth, continuous scroll of verified contributions in a sleek, dark-mode ticker style.

---

## 🎯 Demo Script

**Narrator**: "Every verified hazard is recorded in an immutable ledger. Watch as contributors earn $VIGIA tokens in real-time."

**Action**: Point to Zone D ticker scrolling

**Narrator**: "This is our DePIN token economy. No central authority. Pure consensus."

---

## 🐛 Troubleshooting

### Ticker Shows "Awaiting network consensus..."
**Cause**: Ledger table is empty (no verified hazards yet)

**Solution**: 
1. Upload a video in Zone A
2. Wait for Bedrock Agent to verify (check Zone B)
3. Orchestrator Lambda writes to ledger
4. Ticker updates in 10 seconds

### API Returns 500 Error
**Cause**: Lambda can't access ledger table

**Solution**:
```bash
# Check Lambda has correct permissions
aws lambda get-policy \
  --function-name VigiaStack-IngestionLedgerGetterFunction... \
  --region us-east-1
```

### Ticker Not Animating
**Cause**: CSS animation not loading

**Solution**: Hard refresh browser (Cmd+Shift+R)

### CORS Error
**Cause**: API Gateway CORS not configured

**Solution**: Already configured in Lambda response headers. Check browser console for actual error.

---

## 📝 Files Created/Modified

### Backend
- ✅ `packages/backend/src/ledger/get-entries.ts` (new)
- ✅ `packages/infrastructure/lib/stacks/ingestion-stack.ts` (modified)
- ✅ `packages/infrastructure/lib/vigia-stack.ts` (modified)

### Frontend
- ✅ `packages/frontend/app/components/LedgerTicker.tsx` (new)
- ✅ `packages/frontend/app/page.tsx` (modified)

---

## ✅ Success Checklist

- [ ] CDK deploy completes without errors
- [ ] `GET /ledger` endpoint returns 200
- [ ] Frontend shows ticker in Zone D
- [ ] Ticker auto-refreshes every 10 seconds
- [ ] Animation is smooth and continuous
- [ ] Hover pauses animation
- [ ] Placeholder shows when empty

---

**Status**: Ready to deploy!  
**Command**: `npx cdk deploy --require-approval never`  
**ETA**: 2-3 minutes  
**Next**: Priority 2 - Bedrock Reasoning Trace Viewer
