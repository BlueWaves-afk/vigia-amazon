# VIGIA Quick Deployment Guide

## Prerequisites
- Node.js 20+
- AWS CLI configured with credentials
- AWS CDK v2 installed globally: `npm install -g aws-cdk`
- Docker Desktop running (required for Lambda bundling)

## Step-by-Step Deployment

### 1. Install Dependencies
```bash
npm install
```

### 2. Bootstrap CDK (First Time Only)
```bash
cd packages/infrastructure
npx cdk bootstrap
```

### 3. Deploy Infrastructure
```bash
npx cdk deploy --all

# Note the outputs:
# - ApiEndpoint: https://xxxxx.execute-api.REGION.amazonaws.com/prod
# - HazardsTableName: VigiaStack-IngestionHazardsTableXXXXX
```

### 4. Configure Frontend Environment
```bash
cd packages/frontend
cp .env.local.example .env.local

# Edit .env.local:
echo "NEXT_PUBLIC_API_URL=<ApiEndpoint from CDK output>" > .env.local
```

### 5. Start Frontend Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### 6. Test the System

#### Upload Private Key
1. In the UI, click "Upload Private Key"
2. Select `private-key.pem` from the project root
3. Wait for "✓ Key loaded" confirmation

#### Upload Test Video
1. Click "Upload Video"
2. Select any dashcam video (MP4, WebM, etc.)
3. Click "Start Detection"
4. Watch the telemetry feed in Zone A

#### Verify Backend Processing
```bash
# Check DynamoDB for hazard records
aws dynamodb scan \
  --table-name <HazardsTableName> \
  --max-items 10

# Check Lambda logs
aws logs tail /aws/lambda/VigiaStack-IngestionValidatorFunction --follow
```

## Testing Signature Verification

### Generate Test Payload
```bash
node -e "
const crypto = require('crypto');
const fs = require('fs');

const payload = {
  hazardType: 'POTHOLE',
  lat: 37.7749,
  lon: -122.4194,
  timestamp: new Date().toISOString(),
  confidence: 0.85
};

const privateKey = fs.readFileSync('private-key.pem');
const sign = crypto.createSign('SHA256');
sign.update(JSON.stringify(payload));
sign.end();

const signature = sign.sign(privateKey, 'base64');

console.log(JSON.stringify({ ...payload, signature }, null, 2));
" > test-payload.json
```

### Send Test Request
```bash
curl -X POST <ApiEndpoint>/telemetry \
  -H "Content-Type: application/json" \
  -d @test-payload.json

# Expected response: {"success":true}
```

## Bedrock Agent Setup (Manual)

### 1. Create Agent
1. Go to AWS Console → Amazon Bedrock → Agents
2. Click "Create Agent"
3. Name: `vigia-auditor-strategist`
4. Model: Amazon Nova Lite
5. Instructions:
```
You are the Auditor-Strategist for VIGIA, a road safety verification system.

Your role:
1. Query similar hazards using the query-hazards action
2. Calculate verification scores using the calculate-score action
3. Provide reasoning for your decisions

Always follow this pattern:
- Thought: Analyze the hazard
- Action: Query similar hazards
- Observation: Review results
- Thought: Calculate verification score
- Action: Calculate score
- Final Answer: Provide verification decision with score (0-100)
```

### 2. Create Action Group
1. In the agent, click "Add Action Group"
2. Name: `QueryAndVerify`
3. Add Lambda functions:
   - `query-hazards` (needs Python implementation)
   - `calculate-score` (needs Python implementation)

### 3. Update Lambda Environment Variables
```bash
# Get Agent ID and Alias ID from Bedrock console
export BEDROCK_AGENT_ID=<your-agent-id>
export BEDROCK_AGENT_ALIAS_ID=<your-agent-alias-id>

# Update Lambda environment variables
aws lambda update-function-configuration \
  --function-name VigiaStack-IntelligenceOrchestratorFunction \
  --environment "Variables={BEDROCK_AGENT_ID=$BEDROCK_AGENT_ID,BEDROCK_AGENT_ALIAS_ID=$BEDROCK_AGENT_ALIAS_ID,...}"
```

## Monitoring

### CloudWatch Dashboards
```bash
# View Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=VigiaStack-IngestionValidatorFunction \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Cost Monitoring
```bash
# Check current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

## Cleanup

### Delete All Resources
```bash
cd packages/infrastructure
npx cdk destroy --all

# Manually delete:
# - Bedrock Agent (if created)
# - CloudWatch Log Groups (if retention is set)
```

## Troubleshooting

### "Signature verification failed"
- Ensure public key in Secrets Manager matches `public-key.pem`
- Check that Web Worker loaded the correct private key
- Verify payload structure matches exactly

### "DynamoDB throttling"
- Already using on-demand billing, should not throttle
- Check CloudWatch metrics for consumed capacity
- Verify no infinite loops in Lambda

### "Web Worker not loading"
- Check browser console for errors
- Ensure Next.js dev server is running
- Try hard refresh (Cmd+Shift+R)

### "CDK deployment fails"
- Run `aws sts get-caller-identity` to verify credentials
- Check IAM permissions (need admin or CDK-specific policies)
- Review CloudFormation console for detailed errors

## Next Steps

1. ✅ Deploy infrastructure
2. ✅ Test video upload and detection
3. ⏳ Implement real ONNX inference (TASK-3.1)
4. ⏳ Create Bedrock Agent action group Lambdas (TASK-4.3)
5. ⏳ Add Amazon Location Service visualization (Phase 6)

---

**Need Help?** Check `IMPLEMENTATION_STATUS.md` for detailed progress and `tasks.md` for remaining work.
