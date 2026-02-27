# ✅ Bedrock Router Lambda Deployed Successfully

## Lambda Function ARN

```
arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-IntelligenceBedrockRouterFunctionE993F7-sdUx2LRYu4wg
```

## Configuration Details

**Function Name**: `VigiaStack-IntelligenceBedrockRouterFunctionE993F7-sdUx2LRYu4wg`  
**Runtime**: Python 3.12  
**Handler**: `bedrock-router.lambda_handler`  
**Timeout**: 30 seconds  
**Region**: us-east-1

## Permissions Granted

✅ **DynamoDB Query**: Read access to Hazards Table  
✅ **Bedrock Invoke**: Resource-based policy allows `bedrock.amazonaws.com` to invoke this Lambda

## Environment Variables

- `HAZARDS_TABLE_NAME`: `VigiaStack-IngestionHazardsTable05BAEAEE-1B0GEE1NV7PU5`

## API Paths Supported

### 1. `/query-hazards`
**Input**:
```json
{
  "apiPath": "/query-hazards",
  "geohash": "9q8yyk8",
  "radiusMeters": 500,
  "hoursBack": 24
}
```

**Output**:
```json
{
  "hazards": [...],
  "count": 5
}
```

### 2. `/calculate-score`
**Input**:
```json
{
  "apiPath": "/calculate-score",
  "similarHazards": [
    {"confidence": 0.85},
    {"confidence": 0.92}
  ]
}
```

**Output**:
```json
{
  "verificationScore": 87.5,
  "breakdown": {
    "countScore": 40,
    "confidenceScore": 26.55,
    "temporalScore": 30
  }
}
```

## Next Steps in Bedrock Console

1. Go to **Amazon Bedrock** → **Agents**
2. Select your agent: `vigia-auditor-strategist`
3. Go to **Action Groups**
4. Click **Edit** on your action group
5. Under **Action group executor**:
   - Select **Lambda function**
   - Paste ARN: `arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-IntelligenceBedrockRouterFunctionE993F7-sdUx2LRYu4wg`
6. Click **Save**
7. Click **Prepare** to update the agent

## Testing the Lambda Directly

```bash
# Test query-hazards
aws lambda invoke \
  --function-name VigiaStack-IntelligenceBedrockRouterFunctionE993F7-sdUx2LRYu4wg \
  --payload '{"apiPath":"/query-hazards","geohash":"9q8yyk8"}' \
  --region us-east-1 \
  response.json

cat response.json

# Test calculate-score
aws lambda invoke \
  --function-name VigiaStack-IntelligenceBedrockRouterFunctionE993F7-sdUx2LRYu4wg \
  --payload '{"apiPath":"/calculate-score","similarHazards":[{"confidence":0.85}]}' \
  --region us-east-1 \
  response.json

cat response.json
```

## Features Implemented

✅ **Unified Router**: Single Lambda handles both API paths  
✅ **Decimal Handling**: Custom JSON encoder prevents DynamoDB Decimal crashes  
✅ **DynamoDB Query**: Queries Hazards table by geohash  
✅ **Score Calculation**: Computes 0-100 verification score  
✅ **Bedrock Response Format**: Returns proper `messageVersion` and `response` structure  
✅ **Resource Policy**: Bedrock service can invoke without IAM role assumption

---

**Status**: ✅ Ready to link in Bedrock Console  
**Deployment Time**: 81.88 seconds  
**Cost**: $0 (within Free Tier)
