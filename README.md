<img width="3780" height="1890" alt="image" src="https://github.com/user-attachments/assets/71c5ec70-44f0-41f5-9fad-b8ebb12b6ed1" />

<div align="center">
  <h1>VIGIA IDE</h1>
  <p><strong>Sentient Road Infrastructure IDE</strong></p>
  <p><em>Hybrid multi-agent road-safety intelligence with on-device inference, serverless verification, and a tamper-evident ledger.</em></p>

  <p>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-Apache--2.0-blue.svg"></a>
    <img alt="Deployment" src="https://img.shields.io/badge/Deployment-AWS%20Amplify-FF9900?logo=awsamplify&logoColor=white">
    <img alt="Frontend" src="https://img.shields.io/badge/Frontend-Next.js%20%2B%20React-black.svg">
    <img alt="Backend" src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Python-43853D.svg">
    <a href="https://main.d2nkopgztcw9g1.amplifyapp.com/"><img alt="Live demo" src="https://img.shields.io/badge/Live-Demo-2563EB?logo=googlechrome&logoColor=white"></a>
  </p>
</div>

## What VIGIA does in one sentence
VIGIA IDE treats road infrastructure like infrastructure-as-code, turning hazards, zones, and repairs into versionable, auditable “changesets” that teams can review, verify, and deploy as real-world maintenance actions.

## At a glance
- Competition: Amazon 10,000 AIdeas (Semi-Finalist)
- Architecture: Hybrid Multi-Agent System (H-MAS) with an infrastructure-as-code IDE experience
- Deployment: AWS Amplify (web hosting)
- Live demo: https://main.d2nkopgztcw9g1.amplifyapp.com/

## Table of contents
- [Live demo](#live-demo)
- [Executive summary](#executive-summary)
- [System principles](#system-principles)
- [Five-zone architecture](#five-zone-architecture)
- [AWS-native platform depth](#aws-native-platform-depth)
- [Cost analysis](#cost-analysis)
- [Scaling projections](#scaling-projections)
- [Kiro spec-driven development](#kiro-spec-driven-development)
- [Architectural choices and trade-offs](#architectural-choices--trade-offs)
- [Technology stack](#technology-stack)
- [Getting started](#getting-started)
- [Core features](#core-features)
- [Data infrastructure](#data-infrastructure)
- [Security architecture](#security-architecture)
- [Competition context](#competition-context)
- [Future roadmap](#future-roadmap)
- [Documentation index](#documentation-index)
- [Contributors](#contributors)
- [License](#license)
- [Acknowledgments](#acknowledgments)
- [Contact](#contact)

## Live demo
https://main.d2nkopgztcw9g1.amplifyapp.com/

## Executive Summary

VIGIA IDE is a road-infrastructure intelligence platform that combines on-device hazard detection, agentic verification, and a tamper-evident ledger. It presents hazards, routes, and zone compliance through an IDE-like workflow to support faster planning, monitoring, and response.

**Key Innovation**: Complete DePIN (Decentralized Physical Infrastructure Network) platform combining edge AI inference, agentic verification, and tamper-evident ledger technology for trustworthy infrastructure monitoring at near-zero operational cost.

---

## System Principles

### 1. Serverless-First Architecture
All compute runs on AWS Lambda (scales to zero), DynamoDB on-demand billing, API Gateway with automatic throttling. Zero idle costs, automatic scaling, pay-per-use pricing.

### 2. Edge Intelligence
YOLOv26-FP32 ONNX model runs in a browser Web Worker (6 MB model, ~60ms inference). Zero cloud compute costs for AI inference. Simulates real-world DePIN nodes (ARM chips, mobile phones).

### 3. Cost-Optimized AI
Amazon Nova Lite ($0.06/1M tokens) instead of Claude 3.5 Sonnet ($3.00/1M tokens). 50x cost reduction. Aggressive caching and deduplication. Total AI cost: ~$1.60 for entire voting phase (includes Bedrock image tile pricing at $0.00080/tile).
![compressed](https://github.com/user-attachments/assets/d0b2213b-8172-49f3-a585-34e626e3a6df)

### 4. Local-First Operations
Diff computation, scenario branching, and forensic analysis run in browser (IndexedDB + Web Workers). Zero server costs for analysis. Data sent to cloud only on explicit user action.

### 5. Cryptographic Trust
ECDSA P-256 signatures on all telemetry via `ethers.js` keypair generated in the browser. Every hazard payload is signed with EIP-191 at the edge. The backend dynamically recovers the public key via `ethers.verifyMessage()` and enforces a strict fail-closed HTTP 401 for any unregistered or improperly signed payload. Device addresses are registered in a `VigiaDeviceRegistry` DynamoDB table. The production `vigia-raspi` deployment uses a Hardware Root of Trust for firmware-level signing.

### 6. Explainable AI
ReAct pattern (Reasoning + Acting) for all agent decisions. Full transparency with thought/action/observation logs. Streaming traces via Server-Sent Events (SSE). Users see exactly how AI reached conclusions.
![compressed](https://github.com/user-attachments/assets/7e4ce3bf-3ffa-43cd-82b1-f7c145df8cc5)


---

## Five-Zone Architecture

<img width="1386" height="482" alt="image" src="https://github.com/user-attachments/assets/39ed8d90-84b6-4731-a30d-1c04ddade016" />


**Data Flow**: Browser → API Gateway → Validator → DynamoDB → Orchestrator → Bedrock Agent → Ledger → UI

---

## AWS-Native Platform Depth

### 1. Amazon States Language (ASL)
Declarative workflow orchestration using JSON-based state machine definitions. Not generic Lambda code—AWS-specific syntax that couldn't run elsewhere.

**File**: `packages/backend/src/workflows/urban-planner.asl.json`

**Features**: Parallel state with 3 concurrent branches, ASL intrinsic functions for math, ResultSelector for data transformation.

**Performance**: 206ms execution time (target: <5s)


### 2. Step Functions Express Workflows
Synchronous workflow execution with <5 second response time. Parallel execution of 3 micro-Lambdas: Bezier path generation, cost calculation, zone compliance.

**CDK**: `packages/infrastructure/lib/stacks/intelligence-stack.ts` (lines 318-323)

**Code**:
```typescript
const stateMachine = new sfn.StateMachine(this, 'UrbanPlannerStateMachine', {
  definitionBody: sfn.DefinitionBody.fromFile('urban-planner.asl.json'),
  stateMachineType: sfn.StateMachineType.EXPRESS,
});
```
<img width="1505" height="1322" alt="image" src="https://github.com/user-attachments/assets/0b080811-75f5-493a-9761-4c10aade2517" />

### 3. Amazon Location Service Geofences
Managed spatial intelligence for zone-based regulations. 4 demo zones: Residential (low priority), Commercial (medium), Industrial (high), Protected (no construction).

**CDK**: `packages/infrastructure/lib/stacks/intelligence-stack.ts` (lines 236-239)

**Integration**: `generate-bezier-path.py` calls `BatchEvaluateGeofences` API to check zone intersections.

### 4. Amazon Location Service Route Calculator
Enterprise-grade routing with Esri road network data. Calculates fastest and safest routes with 90-point geometry.

**CDK**: `packages/infrastructure/lib/stacks/intelligence-stack.ts` (lines 246-250)

**Performance**: 355ms average response time

<img width="1485" height="649" alt="image" src="https://github.com/user-attachments/assets/bbb44766-2b23-406c-8cef-d895927620e9" />


### 5. DynamoDB Streams + Lambda Triggers
Event-driven architecture with change data capture. New hazards automatically trigger verification workflow.

**Pattern**: HazardsTable Stream → EventBridge Pipe (INSERT-only filter, ~60% invocation reduction) → Orchestrator Lambda → Nova Lite VLM → Bedrock Agent → LedgerTable. A second Pipe fans out VERIFIED hazards to an SQS maintenance queue.

### 6. Amazon Bedrock Agents
4 Action Groups with 11 tools for hazard verification, network intelligence, maintenance logistics, and urban planning.
 
**Model**: Amazon Nova Lite  
**Cost**: $0.006 per query

**Tools**:
- QueryAndVerify: `query_hazards`, `calculate_score`, `coordinates_to_geohash`, `scan_all_hazards`
- NetworkIntelligence: `analyze_node_connectivity`, `identify_coverage_gaps`
- MaintenanceLogistics: `prioritize_repair_queue`, `estimate_repair_cost`
- UrbanPlanner: `find_optimal_path`, `calculate_construction_roi`, `calculate_pin_routes` (invokes Step Functions)


---

## Cost Analysis

### Voting Phase (7 Days): Estimated $1.39 Total

| Service | Usage | Cost | Notes |
|---------|-------|------|-------|
| Bedrock (Nova Lite) | 20M input tokens | $1.20 | 50x cheaper than Sonnet |
| Secrets Manager | 1 secret × 7 days | $0.09 | ECDSA public key storage |
| Location Service Geofences | 500 evaluations | $0.02 | Zone compliance checks |
| Lambda | 50K invocations | $0.00 | Within 1M free tier |
| DynamoDB | 25 WCU/RCU | $0.00 | Within free tier |
| API Gateway | 10K requests | $0.00 | Within 1M free tier |
| CloudWatch | 5 GB logs | $0.00 | Within 5 GB free tier |
| Step Functions Express | 100 executions | $0.00 | Within 4K free tier |
| Location Service Routes | 50 calculations | $0.00 | Within 40K free tier |
| **TOTAL** | | **$1.72** | **99% under $200 budget** |

### Cost Guardrails

**Mandatory selections** (`.kiro/steering/cost-guardrails.md`):

| Selection | Policy | Rationale |
|---|---|---|
| Amazon Nova Lite | Required | Baseline model for cost control |
| Claude 3.5 Sonnet | Prohibited | ~50x higher token cost |
| Amazon Kinesis | Prohibited | $11/month minimum |
| Amazon Timestream | Prohibited | $0.50/GB ingested |
| Amazon QLDB | Prohibited | $0.30/1M requests |
| Amazon QuickSight | Prohibited | $9/user/month |

**Result**: Stayed within free tier for all services except Bedrock and Secrets Manager.

---

## Scaling Projections

### City-Wide Deployment (10,000 Users)

**Traffic**: 300,000 hazards/day (30 per user)

| Service | Monthly Cost | Calculation |
|---------|--------------|-------------|
| Lambda | $18.00 | 4.5M invocations - 1M free = 3.5M × $0.20/1M + GB-seconds |
| DynamoDB | $45.00 | 9M writes - 750K free = 8.25M × $1.25/1M (writes) + reads |
| Bedrock | $135.00 | 150K calls/day × $0.006 × 30 days |
| Location Service | $25.00 | 50K routes/day × $0.0005 × 30 days |
| API Gateway | $7.80 | 9M requests - 1M free = 8M × $3.50/1M |
| **TOTAL** | **$288.50** | **$0.028 per node/month** |

**Revenue Model**: Premium tier at $2.99/month  
**Break-Even**: 35 premium users (0.35% conversion)  
**Profit Margin**: 92% at 1% conversion (100 premium users)

### National Deployment (1,000,000 Users)

**Traffic**: 30,000,000 hazards/day

**Monthly Cost**: $23,305 (linear scaling)  
**Per-User Cost**: $0.028/month (constant)  
**Revenue Potential**: $159,700/month (5% premium conversion)  
**Profit Margin**: 85%

**Key Insight**: Serverless architecture maintains constant per-user cost at any scale.

---

## Kiro Spec-Driven Development
<img width="611" height="306" alt="image" src="https://github.com/user-attachments/assets/490abbd9-9e50-4a7e-a59d-20a4908db331" />
Kiro streamlines development by acting as a Technical Lead rather than just a code completion tool. Instead of writing code line-by-line, you provide a high-level goal, and Kiro automatically generates a Requirement Document, a Technical Design (including architectural diagrams), and a Task List. This structured approach eliminates the "guesswork" for the AI; because it understands the architecture before it writes a single character, it can execute complex, multi-file changes with high precision.
### Documentation Structure

**Core Specifications** (`docs/`):
1. `1-requirements.md` - 197 tasks, 100% complete
2. `2-system-design.md` - Five-zone architecture
3. `3-component-specs.md` - Component interfaces
4. `4-master-task-list.md` - Task tracking

**Steering Documents** (`.kiro/steering/`): 24 files
- `cost-guardrails.md` - Mandatory service selections
- `innovation-features-guardrails.md` - Local-first constraints
- `platform_depth_upgrade.md` - AWS-native architecture
- `agent_architecture.md` - Bedrock Agent specifications
- `ui-refactor-guardrails.md` - Design system rules

**Total Documentation**: 106 markdown files, ~200,000 words (~400 pages)

### Workflow

1. **Requirements** → Define functional and non-functional requirements
2. **Design** → Architect system with AWS services
3. **Tasks** → Break down into granular implementation steps
4. **Implementation** → Execute tasks with guardrails enforcement
5. **Verification** → Test and validate against acceptance criteria


---

## Architectural Choices & Trade-offs

### 1. Web Workers for ONNX (Not Lambda)
**Decision**: Run YOLO26-FP32 in browser Web Worker  
**Alternative**: Lambda with SageMaker endpoint  
**Rationale**: Zero cloud compute costs, instant inference, privacy-preserving  
**Trade-off**: Limited to browser-compatible models (<50 MB)

### 2. Nova Lite (Not Claude 3.5 Sonnet)
**Decision**: Amazon Nova Lite ($0.06/1M tokens)  
**Alternative**: Claude 3.5 Sonnet ($3.00/1M tokens)  
**Rationale**: 50x cost reduction, sufficient for verification tasks  
**Trade-off**: Slightly lower reasoning quality (acceptable for demo)

### 3. DynamoDB (Not RDS)
**Decision**: DynamoDB with on-demand billing  
**Alternative**: RDS PostgreSQL with PostGIS  
**Rationale**: Serverless, auto-scaling, free tier, no idle costs  
**Trade-off**: No complex joins (denormalized schema required)

### 4. Local-First Diff/Branch (Not Server-Side)
**Decision**: Compute diffs in browser (IndexedDB + Web Workers)  
**Alternative**: Server-side diff API with S3 storage  
**Rationale**: Zero server costs, instant results, privacy  
**Trade-off**: 50 MB IndexedDB limit, no cross-device sync

### 5. Step Functions Express (Not Standard)
**Decision**: Express Workflows (synchronous, <5s)  
**Alternative**: Standard Workflows (asynchronous, minutes)  
**Rationale**: Real-time response for interactive UI  
**Trade-off**: 5-minute execution limit (sufficient for routing)

### 6. Geohash Precision 7 (Not 9)
**Decision**: 7-character geohashes (~150m accuracy)  
**Alternative**: 9-character geohashes (~5m accuracy)  
**Rationale**: Balance between precision and query efficiency  
**Trade-off**: Hazards within 150m grouped together

### 7. DynamoDB Ledger (Not Blockchain)
**Decision**: DynamoDB with SHA-256 hash chain  
**Alternative**: Amazon Managed Blockchain or QLDB  
**Rationale**: Free tier, sufficient immutability for demo  
**Trade-off**: Not true blockchain (centralized, no consensus)

### 8. Browser Storage for Sessions (Not Cloud)
**Decision**: sessionStorage (unsaved) + localStorage (saved)  
**Alternative**: DynamoDB with user authentication  
**Rationale**: Zero server costs, no multi-user conflicts  
**Trade-off**: No cross-device sync, lost if browser data cleared

### 9. IP-Based Rate Limiting (Not User-Based)
**Decision**: 5 queries/min, 30 queries/hour per IP  
**Alternative**: Cognito authentication with per-user quotas  
**Rationale**: No authentication required, simple implementation  
**Trade-off**: Shared IPs (offices, VPNs) share quota

---

## Technology Stack

### Frontend (Zone 1: Web Edge)
- Next.js 16.1.6 (App Router), React 19.2.3, TypeScript 5.3.3
- ONNX Runtime Web 1.20.1, YOLOv26-FP32 (6 MB)
- MapLibre GL JS 5.19.0, Zustand 5.0.2 (state)
- Comlink 4.4.2 (Web Worker RPC)

### Backend (Zones 2-4)
- Node.js 20 (20+ Lambdas), Python 3.12 (8 Lambdas)
- AWS SDK v3, Bedrock Agent Runtime

### Infrastructure (AWS CDK)
- AWS CDK 2.170.0 (TypeScript)
- 17 DynamoDB tables, 33 Lambda functions
- 1 Step Functions State Machine (Express, 3 states)
- 2 EventBridge Pipes (INSERT filter + VERIFIED fan-out)
- 1 SQS Queue (verified hazard maintenance fan-out)
- 1 Location Service Geofence Collection (`VigiaRestrictedZones`)
- 1 Location Service Route Calculator (`VigiaStack-VigiaRouteCalculator`)
- 4 API Gateways (Telemetry, Session, Innovation, Enterprise)

### AI/ML
- Amazon Bedrock (Nova Lite) - Verification agent
- ONNX Runtime Web - Edge inference
- YOLOv26-FP32 - Pothole detection

---

## Getting Started

### Prerequisites
- Node.js 20+
- AWS CLI authenticated
- AWS CDK v2

### Installation
```bash
npm install
```

### Deploy Infrastructure
```bash
npm run cdk:deploy
```

### Seed Demo Data
```bash
node scripts/seed-comprehensive-demo-data.js
```

### Run Frontend
```bash
npm run dev
```

### Configuration
Create `packages/frontend/.env.local`:
```bash
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_API_GATEWAY_URL=<REDACTED>
NEXT_PUBLIC_BEDROCK_AGENT_ID=<REDACTED>
NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID=<REDACTED>
```

---

## Core Features

### 1. Edge Hazard Detection
Frame extraction at 5 FPS, YOLOv26-FP32 inference in Web Worker (60ms), ECDSA P-256 signing, privacy controls (blur faces/plates).

### 2. Cryptographic Trust
ECDSA dynamic device registry (`VigiaDeviceRegistry`), EIP-191 payload signing via `ethers.js`, `ethers.verifyMessage()` server-side recovery, fail-closed HTTP 401 for unregistered devices, SHA-256 hash chain ledger.

### 3. Agent Verification
Nova Lite-based verification with ReAct traces (Thought → Action → Observation), streaming via SSE, explainable AI.

### 4. Tamper-Evident Ledger
Append-only DePIN ledger, SHA-256 hash chain, stream-based integrity validation, 100% valid chain.

### 5. Map + Routing
MapLibre visualization, Amazon Location Service routes, hazard-aware route coloring, pin-based comparison (fastest vs. safest).

### 6. Infrastructure Diffs
Temporal auditing with set difference algorithm, visual markers (red=new, green=fixed, orange=worsened), drag-and-drop comparison.

### 7. Scenario Branching
"What-if" simulations, toggle hazards on/off, recompute routes, visual distinction (.scmap files with dashed borders).

### 8. Economic Layer
Maintenance queue with repair reports, cost estimation ($500/pothole, $5K/accident), ROI widget (300-500% returns).

---

## Data Infrastructure

### 17 DynamoDB Tables

**1. HazardsTable** (Ingestion Stack)
- PK: `geohash` (7 chars), SK: `timestamp` (ISO 8601)
- Attributes: hazardType, lat, lon, confidence, status, signature, verificationScore, h3_index, s3_key, driverWalletAddress
- GSI: `status-timestamp-index`, `h3-hazardtype-index`
- Stream: NEW_AND_OLD_IMAGES → EventBridge Pipes

**2. VigiaDeviceRegistry** (Ingestion Stack)
- PK: `device_address` (Ethereum address)
- Attributes: registered_at, blacklisted, slashed_at, slash_reason
- Purpose: Zero-trust ECDSA device authentication

**3. TrustLedgerTable** (Trust Stack)
- PK: `ledgerId`, SK: `timestamp`
- Attributes: contributorId, hazardId, geohash, credits, previousHash, currentHash
- GSI: `ContributorGeohashIndex` — reward deduplication
- Hash Chain: SHA-256(previousHash + currentData)

**4. AgentTracesTable** (Intelligence Stack)
- PK: `traceId`, SK: `createdAt`
- GSI: `HazardIdIndex` (hazardId + createdAt)
- TTL: 7 days
- Stores: VLM reasoning, verdict, scores, ReAct steps

**5. CooldownTable** (Intelligence Stack)
- PK: `cooldownKey` (hazardId)
- TTL: 30 seconds
- Purpose: Prevent duplicate Orchestrator invocations

**6. RewardsLedgerTable** (Intelligence Stack)
- PK: `wallet_address`
- Attributes: pending_balance, total_earned, total_claimed, nonce, last_hazard_id
- Purpose: Off-chain VGA reward accrual (zero gas)

**7. MaintenanceQueueTable** (Innovation Stack)
- PK: `reportId`, SK: `reportedAt`
- GSI: `GeohashIndex`, `StatusIndex`
- Attributes: hazardId, estimatedCost, status, priority

**8. EconomicMetricsTable** (Innovation Stack)
- PK: `sessionId`, SK: `timestamp`
- Attributes: totalHazards, verifiedCount, estimatedSavings, roi

**9. SessionFilesTable** (Session Stack)
- PK: `userId`, SK: `sessionId`
- GSI: `geohash7-timestamp-index`, `status-timestamp-index`
- TTL: configurable

**10. SessionLedgerEntries** (Session Stack)
- PK: `ledgerId`, SK: `timestamp`
- Stream: NEW_AND_OLD_IMAGES

**11. EnterpriseUsersTable** (Enterprise Stack)
- PK: `userId` (Cognito sub)
- GSI: `apiKey-index`
- Attributes: email, apiKey, trialVga, dataCredits

**12. BurnHistoryTable** (Enterprise Stack)
- PK: `userId`, SK: `timestamp`
- Stream: NEW_IMAGE → RewardsDistributor Lambda
- Attributes: vgaBurned, creditsProvisioned, nodeRewardPool, txHash

**13. AgentRateLimitTable** (Shared)
- PK: `pk`, TTL: `ttl`
- Purpose: IP-based rate limiting for agent queries

### 15 Lambda Functions

**Ingestion** (6): Validator, RegisterDevice, HazardsGetter, LedgerGetter, TracesGetter, TracesByHazard  
**Intelligence** (11): Orchestrator, BedrockRouter, NetworkIntelligence, MaintenanceLogistics, UrbanPlanner, 3 Step Functions micro-Lambdas, VerifyHazardSync, ClaimSignature, RewardsBalance, SlashNode  
**Session** (4): SessionCRUD, GeohashResolver, HashChainValidator, PlacesSearch  
**Innovation** (5): RoutingAgentBranch, AgentTraceStreamer, MaintenanceReportHandler, EconomicMetricsQuery, MaintenanceQueueQuery  
**Enterprise** (6): Register, Login, Me, Burn, Stats, RewardsDistributor  
**Shared** (1): AgentRateLimit

### Web3 BME Economy

**Smart Contract**: `VIGIA_BME.sol` deployed on Polygon Amoy (`0xb4F085aa632065dA4bB1A9250E9C5C3675B7Da47`)  
**Treasury**: AWS KMS vault (`0x4588a66b967ed8CFad952Ca557160A338f6115BF`) holds 1,000,000 VGA  
**Staking**: Nodes must stake ≥ 10 VGA to earn rewards and claim  
**Slashing**: VLM confidence < 0.1 triggers `vigia-slash-node` Lambda → KMS signs `slash()` → burns stake + blacklists node  
**Bonding Curve**: `P = P₀ × (S₀ / S)` — price rises as supply burns  
**Off-chain Ledger**: Rewards accrue in `RewardsLedgerTable` (zero gas) → node calls `claimRewards()` on-chain with KMS signature

### Enterprise DaaS Portal

**Auth**: AWS Cognito User Pool (`us-east-1_kPgzfccax`) — email/password, JWT-protected routes  
**Tables**: `EnterpriseUsersTable` (userId, apiKey, trialVga, dataCredits) + `BurnHistoryTable` (stream-triggered rewards)  
**API**: `https://m1ots3cacc.execute-api.us-east-1.amazonaws.com/prod`  
**Trial**: 20 VGA pre-loaded, no wallet required  
**Burn mechanic**: 1 VGA → 1,000 API credits; 20% of each burn → node reward pool


## Security Architecture

### Cryptographic Signing(In actual VIGIA nodes, simulated in browser).
- ECDSA P-256 (secp256r1 curve)
- Private key: Browser Web Crypto API (non-exportable)
- KMS key ID: AWS Systems Manager Parameter Store (`/vigia/KMS_KEY_ID`)
- Signature: Base64-encoded, attached to all telemetry

### Server-Side Validation
- Validator Lambda verifies all signatures
- Invalid signatures rejected (400 Bad Request)
- Replay attack prevention (timestamp checks)

### Rate Limiting
- IP-based: 5 queries/min, 30 queries/hour
- Server-side enforcement (cannot be bypassed)
- Visual indicator (GitHub Copilot style)
- 97% cost reduction on abuse scenarios

### IAM Security
- Least-privilege roles for all Lambdas
- Service-to-service authentication
- No hardcoded credentials
- Secrets Manager for sensitive data

### Privacy Controls
- Zero-knowledge contributor IDs (hashed signatures)
- No PII in ReAct logs
- 7-day TTL on traces

---


## Competition Context

### Amazon 10,000 AIdeas
**Status**: Semi-Finalist  
**Voting Phase**: March 13-20, 2026 (7 days)  
**Budget**: $200 AWS credits  

---

## Future Roadmap

### Phase 1: Production Hardening
Implement pricing tiers, domain name, data privacy controls, full end-to-end connectivity for enterprise customers.

### Phase 2: Mobile SDK
Native iOS/Android libraries, real-time GPS integration, background detection mode, offline queue with sync.

### Phase 3: Advanced Features
WebSocket streaming, multi-tenant support, ML-based predictions, gamification, API marketplace.

### Phase 4: Blockchain Migration
Replace DynamoDB off-chain ledger with on-chain anchoring (Merkle root written to Polygon periodically). Expand staking/slashing to full DePIN governance model with decentralized consensus.

---

## Documentation Index

**Core**: `docs/1-requirements.md`, `docs/2-system-design.md`, `docs/3-component-specs.md`, `docs/4-master-task-list.md`  
**Data**: `docs/DATA_ECOSYSTEM.md`, `docs/DEMO_DATA_GUIDE.md`, `docs/SEEDING_VERIFICATION_REPORT.md`  
**Features**: `docs/PIN_ROUTING_IMPLEMENTATION.md`, `docs/CLOUD_DATA_INTEGRATION.md`  
**Steering**: `.kiro/steering/` (24 files)  
**Archive**: `archive/` (74 historical documents)

---

## Contributors
<a href="https://github.com/BlueWaves-afk/vigia-amazon/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=BlueWaves-afk/vigia-amazon" />
</a>


## License

Apache License 2.0 - See [LICENSE](LICENSE)

---

## Acknowledgments

**Competition**: Amazon 10,000 AIdeas  
**Development Tool**: Kiro AI (spec-driven development)  
**AWS Services**: Bedrock, Lambda, DynamoDB, Location Service, Step Functions  
**Open Source**: Next.js, MapLibre, ONNX Runtime, Zustand

---

## Contact

**Project Lead**: Tom Mathew 
**Competition**: Amazon 10,000 AIdeas (Semi-Finalist)

---

**Status**: Near Production-ready demo system  
**Last Updated**: April 16, 2026  
**Version**: 1.0
