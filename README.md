# VIGIA - Sentient Road Infrastructure System

**Amazon 10,000 AIdeas Competition (Semi-Finalist)**

A web-based Hybrid Hierarchical Multi-Agent System (H-HMAS) that transforms smartphones into a real-time "sentient infrastructure" for road safety.

## 🏗️ Project Structure

```
vigia-amazon/
├── packages/
│   ├── frontend/          # Next.js 14 App (AWS Amplify)
│   ├── backend/           # Lambda functions
│   ├── infrastructure/    # AWS CDK
│   └── shared/            # Shared TypeScript types
├── docs/
│   ├── requirements.md    # EARS-notated requirements
│   ├── design.md          # Architecture & design document
│   └── tasks.md           # Implementation task plan
└── package.json           # Monorepo root
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- AWS CLI configured
- AWS CDK v2

### Installation

```bash
# Install dependencies
npm install

# Start frontend dev server
npm run dev

# Deploy infrastructure (after configuration)
npm run cdk:deploy
```

### Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill in AWS credentials and service endpoints
3. Copy `packages/frontend/.env.local.example` to `packages/frontend/.env.local`

## 📋 Implementation Status

- [x] **TASK-0.1**: Repository scaffolding ✅
- [x] **TASK-0.2**: AWS CDK infrastructure skeleton ✅
- [x] **TASK-1.1**: DynamoDB Hazards Table ✅
- [x] **TASK-1.2**: API Gateway REST Endpoint ✅
- [x] **TASK-1.3**: Secrets Manager for Public Key ✅
- [x] **TASK-1.4**: Lambda Validator Function ✅
- [x] **TASK-2.1**: Next.js frontend setup ✅
- [x] **TASK-2.2**: Web Worker infrastructure ✅
- [x] **TASK-2.3**: Video upload & frame extraction ✅
- [x] **TASK-2.4**: Web Crypto API signing ✅
- [x] **TASK-3.1**: ONNX model integration (YOLOv26 pothole detector) ✅
- [x] **TASK-3.2**: Telemetry transmission ✅
- [x] **TASK-4.1**: Cooldown Table ✅
- [x] **TASK-4.2**: Agent Traces Table ✅
- [x] **TASK-4.5**: Lambda Orchestrator ✅
- [x] **TASK-3.3**: End-to-end testing ✅
- [x] **Phase 5**: Zone 4 - Trust Layer (hash chain validator) ✅
- [x] **Phase 6**: Zone 5 - Visualization (Amazon Location Service) ✅
- [x] **Phase 7**: UI Polish ✅
- [x] **Phase 8**: Testing ✅
- [x] **Innovation Features**: All 4 features complete (97/97 tasks) ✅

**Current Progress**: 100% complete

**Innovation Features Status**: ✅ DEPLOYED & TESTED
- Diff Tool: Working
- Scenario Branching: Working
- ReAct Logs: Working
- Economic Layer: Working

See [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md) for full details and [TEST_REPORT.md](./TEST_REPORT.md) for test results.

## 🎨 Architecture

VIGIA uses a 5-zone serverless architecture:

1. **Zone 1 (Web Edge)**: Next.js + Web Workers for client-side AI inference
2. **Zone 2 (Ingestion)**: API Gateway + Lambda for telemetry validation
3. **Zone 3 (Intelligence)**: DynamoDB + Bedrock Agents for verification
4. **Zone 4 (Trust)**: Append-only DynamoDB ledger with hash chain
5. **Zone 5 (Visualization)**: Amazon Location Service + MapLibre GL JS

See [design.md](./design.md) for detailed architecture documentation.

## 💰 Cost Optimization

**Target**: Stay within AWS Free Tier + $200 credits  
**Estimated Cost**: $1.39 for 7-day voting phase

- Amplify, Lambda, API Gateway, DynamoDB: Free Tier
- Bedrock (Nova Lite): ~$1.30
- Secrets Manager: ~$0.09

## 🧪 Testing

```bash
# Run all tests
npm test

# Run linting
npm run lint

# Property-based testing (after implementation)
npm run test:pbt
```

## 📚 Documentation

- [requirements.md](./requirements.md) - EARS-notated system requirements
- [design.md](./design.md) - Production-grade architecture document
- [tasks.md](./tasks.md) - Granular implementation task plan
- [design_context.txt](./design_context.txt) - Original vision document

## 🏆 Competition Timeline

- **Phase 1 (Days 1-5)**: Thin-Thread MVP
- **Phase 2 (Days 6-8)**: Intelligence & Trust layers
- **Phase 3 (Days 9-10)**: Visualization
- **Phase 4 (Days 11-12)**: UI polish
- **Phase 5 (Days 13-14)**: Testing
- **Phase 6 (Day 15)**: Deployment & demo
- **Voting Phase**: March 13-20, 2026

## 📄 License

Apache License 2.0 - See [LICENSE](./LICENSE)

## 🤝 Contributing

This is a competition project. Contributions are not currently accepted.

---

**Built with**: Next.js 14, AWS CDK, Amazon Bedrock (Nova Lite), DynamoDB, Lambda, Amazon Location Service