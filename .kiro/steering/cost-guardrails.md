# Cost Guardrails for VIGIA Project

**Purpose**: Ensure all AWS service selections stay within Free Tier limits and $200 credit budget.

---

## Mandatory Service Selections

### Amazon Bedrock
- **REQUIRED MODEL**: Amazon Nova Lite
- **NEVER USE**: Claude 3.5 Sonnet, Claude 3 Opus, or any other premium models
- **REASON**: Nova Lite costs ~$0.06/1M input tokens vs. $3.00/1M for Sonnet
- **ESTIMATED COST**: $1.30 for entire voting phase

### Event Processing
- **REQUIRED**: AWS Lambda (Always Free: 1M requests/month)
- **NEVER USE**: Amazon Kinesis Data Streams ($0.015/shard-hour = $11/month minimum)
- **REASON**: Lambda is free for our traffic volume; Kinesis burns credits unnecessarily
- **PATTERN**: Use DynamoDB Streams + Lambda triggers instead of Kinesis

### Database
- **REQUIRED**: DynamoDB (Always Free: 25 GB storage, 25 WCU/RCU)
- **NEVER USE**: Amazon Timestream ($0.50/GB ingested)
- **BILLING MODE**: On-demand for production, provisioned (1 RCU/WCU) for dev

### Ledger/Blockchain
- **REQUIRED**: DynamoDB append-only table with hash chain
- **NEVER USE**: Amazon QLDB ($0.30/1M requests)
- **REASON**: Hash chain simulation is free and sufficient for demo

### Analytics/Visualization
- **REQUIRED**: Custom React charts (Recharts library)
- **NEVER USE**: Amazon QuickSight ($9/user/month)
- **REASON**: Embedded charts are free and customizable

---

## Cost Monitoring Rules

1. **Bedrock Cost Limit**: If estimated cost approaches $50, auto-switch to cached Agent traces from S3
2. **Lambda Invocations**: Monitor CloudWatch metric; alert if >900K/month (90% of free tier)
3. **DynamoDB**: Use on-demand billing to avoid throttling; monitor consumed capacity
4. **Location Service**: Cache routes aggressively; limit to 40K calculations/month (free tier)

---

## Prohibited Services

- ❌ Amazon Kinesis (any variant)
- ❌ Amazon Timestream
- ❌ Amazon QLDB
- ❌ Amazon QuickSight
- ❌ Claude 3.5 Sonnet/Opus
- ❌ Amazon SageMaker (use ONNX Runtime Web in browser instead)

---

## When Suggesting Alternatives

If a task requires event streaming or analytics:
1. **First choice**: Lambda + DynamoDB Streams
2. **Second choice**: EventBridge (free tier: 14M events/month)
3. **Never suggest**: Kinesis, Timestream, or premium Bedrock models

---

**Budget Target**: $1.39 for 7-day voting phase (March 13-20, 2026)
