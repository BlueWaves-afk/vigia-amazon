# VIGIA Quick Reference

## 🚀 Quick Start (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Deploy infrastructure (requires Docker)
cd packages/infrastructure
npx cdk deploy

# 3. Start frontend
cd ../frontend
cp .env.local.example .env.local
# Edit .env.local with API Gateway URL
npm run dev

# 4. Open http://localhost:3000
```

---

## 📁 Project Structure

```
vigia-amazon/
├── packages/
│   ├── frontend/          # Next.js 14 App
│   │   ├── app/
│   │   │   ├── components/VideoUploader.tsx
│   │   │   ├── hooks/useHazardDetector.ts
│   │   │   └── page.tsx
│   │   └── public/workers/hazard-detector.worker.ts
│   │
│   ├── backend/           # Lambda functions
│   │   └── src/
│   │       ├── validator/index.ts
│   │       └── orchestrator/index.ts
│   │
│   ├── infrastructure/    # AWS CDK
│   │   └── lib/stacks/
│   │       ├── ingestion-stack.ts
│   │       ├── intelligence-stack.ts
│   │       ├── trust-stack.ts
│   │       └── visualization-stack.ts
│   │
│   └── shared/            # Shared types
│
├── private-key.pem        # ECDSA private key (gitignored)
├── public-key.pem         # ECDSA public key (in Secrets Manager)
│
└── docs/
    ├── SUMMARY.md         # Implementation status
    ├── DEPLOYMENT.md      # Deployment guide
    ├── CHECKLIST.md       # Pre-deployment checklist
    └── tasks.md           # Original task plan
```

---

## 🔑 Key Commands

### Development
```bash
# Install all dependencies
npm install

# Start frontend dev server
npm run dev

# Run linting
npm run lint

# Build all packages
npm run build
```

### Infrastructure
```bash
cd packages/infrastructure

# Bootstrap CDK (first time only)
npx cdk bootstrap

# Synthesize CloudFormation template
npx cdk synth

# Deploy all stacks
npx cdk deploy

# Destroy all resources
npx cdk destroy
```

### Testing
```bash
# Test API Gateway endpoint
curl <ApiEndpoint>/telemetry

# Generate signed test payload
node -e "..." > test-payload.json

# Send test request
curl -X POST <ApiEndpoint>/telemetry \
  -H "Content-Type: application/json" \
  -d @test-payload.json

# Check DynamoDB
aws dynamodb scan --table-name <HazardsTableName> --max-items 10

# View Lambda logs
aws logs tail /aws/lambda/VigiaStack-IngestionValidatorFunction --follow
```

### Monitoring
```bash
# Check AWS costs
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost

# View CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=VigiaStack-IngestionValidatorFunction \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        ZONE 1: WEB EDGE                      │
│  Next.js 14 + Web Worker + ONNX Runtime + Web Crypto API    │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTPS POST
┌─────────────────────────────────────────────────────────────┐
│                    ZONE 2: INGESTION FUNNEL                  │
│  API Gateway → Lambda Validator → DynamoDB (Hazards)        │
└─────────────────────────────────────────────────────────────┘
                              ↓ DynamoDB Stream
┌─────────────────────────────────────────────────────────────┐
│                  ZONE 3: INTELLIGENCE CORE                   │
│  Lambda Orchestrator → Bedrock Agent (Nova Lite)            │
│  → DynamoDB (Cooldown, Traces)                              │
└─────────────────────────────────────────────────────────────┘
                              ↓ Verified Hazards
┌─────────────────────────────────────────────────────────────┐
│                     ZONE 4: TRUST LAYER                      │
│  DynamoDB Ledger (Hash Chain) → Validator Lambda            │
└─────────────────────────────────────────────────────────────┘
                              ↓ Query
┌─────────────────────────────────────────────────────────────┐
│                  ZONE 5: VISUALIZATION                       │
│  Amazon Location Service + MapLibre GL JS                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Implementation Status

| Phase | Progress | Status |
|-------|----------|--------|
| 0: Scaffolding | 100% | ✅ Complete |
| 1: Ingestion | 100% | ✅ Complete |
| 2: Web Worker | 100% | ✅ Complete |
| 3: Thin-Thread MVP | 80% | ⚠️ ONNX placeholder |
| 4: Intelligence | 70% | ⚠️ Bedrock manual setup |
| 5: Trust | 50% | ⏳ Hash validator needed |
| 6: Visualization | 0% | ⏳ Not started |
| 7: UI Polish | 0% | ⏳ Not started |
| 8: Testing | 0% | ⏳ Not started |
| **Overall** | **60%** | **Ready to deploy** |

---

## 💰 Cost Breakdown

| Service | Usage | Cost |
|---------|-------|------|
| Lambda | 1M requests/month | Free Tier |
| DynamoDB | 25 GB, on-demand | Free Tier |
| API Gateway | 1M requests/month | Free Tier |
| Secrets Manager | 1 secret | $0.09/month |
| Bedrock (Nova Lite) | ~20K tokens | ~$1.30 (7-day) |
| **Total** | | **$1.39** ✅ |

---

## 🔐 Security Features

- **ECDSA P-256 Signatures**: End-to-end from Web Worker to Lambda
- **Geohash Privacy**: 7-character precision (~150m radius)
- **Hash Chain Integrity**: SHA-256 ledger validation
- **Cooldown Deduplication**: 5-minute window per geohash+type
- **Secrets Manager**: Public key storage with caching

---

## 🧪 Testing Workflow

1. **Local Testing**
   - Upload video in UI
   - Verify telemetry feed
   - Check browser console

2. **API Testing**
   - Generate signed payload
   - POST to API Gateway
   - Verify 200 response

3. **Backend Testing**
   - Check DynamoDB for records
   - View Lambda logs
   - Verify signature validation

4. **Integration Testing**
   - End-to-end video → DynamoDB
   - Orchestrator → Bedrock Agent
   - Ledger hash chain

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Docker not running | Start Docker Desktop |
| Signature fails | Check key pair matches |
| Web Worker error | Hard refresh browser |
| CDK deploy fails | Check AWS credentials |
| DynamoDB throttle | Already on-demand billing |
| Lambda timeout | Increase in CDK config |

---

## 📚 Documentation

- **SUMMARY.md**: Implementation status and next steps
- **DEPLOYMENT.md**: Step-by-step deployment guide
- **CHECKLIST.md**: Pre-deployment checklist
- **tasks.md**: Original task plan (45 tasks)
- **design.md**: Architecture and design document
- **requirements.md**: EARS-notated requirements

---

## 🎯 Next Steps

### To Deploy (30 min)
1. Start Docker Desktop
2. Run `npx cdk deploy`
3. Configure frontend `.env.local`
4. Test with video upload

### To Complete MVP (15-20 hours)
1. Add ONNX inference (2-3h)
2. Create Bedrock Agent (1-2h)
3. Build visualization (6-8h)
4. Polish UI (4-6h)
5. Testing (4-6h)

---

## 🏆 Competition Info

- **Event**: Amazon 10,000 AIdeas (Semi-Finalist)
- **Voting Phase**: March 13-20, 2026
- **Budget**: $200 AWS credits
- **Estimated Cost**: $1.39 for 7-day voting
- **Target**: Stay within Free Tier + minimal Bedrock usage

---

**Ready to deploy!** 🚀

Run `npx cdk deploy` to get started.
