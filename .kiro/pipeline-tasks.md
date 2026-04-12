# VIGIA Pipeline V2 — Implementation Tasks

Track of fully completed and implemented phases.

---

## ✅ Phase 1: ECDSA Device Registry

**Completed**: 2026-04-11

| Task | File | Status |
|---|---|---|
| Create `VigiaDeviceRegistry` DynamoDB table | `ingestion-stack.ts` | ✅ |
| `POST /register-device` Lambda | `functions/register-device/index.ts` | ✅ |
| Wire `/register-device` to API Gateway (telemetry API) | AWS Console + CDK | ✅ |
| Refactor `verify-hazard-sync` → ethers ECDSA recovery + registry `GetItem` | `functions/verify-hazard-sync/index.ts` | ✅ |
| Refactor `ValidatorLambda` → same ECDSA recovery + registry check | `src/validator/index.ts` | ✅ |
| `useDeviceWallet` hook — localStorage keygen + auto-registration | `hooks/useDeviceWallet.ts` | ✅ |
| Edge Node Badge in Detection Node panel header | `DetectionModeView.tsx` | ✅ |
| Pass `deviceAddress`/`signPayload` to `VideoUploader` + `HazardVerificationPanel` | `DetectionModeView.tsx` | ✅ |
| Sign payload before `POST /telemetry` in `VideoUploader` | `VideoUploader.tsx` | ✅ |
| Sign payload before `POST /verify-hazard-sync` in `HazardVerificationPanel` | `HazardVerificationPanel.tsx` | ✅ |
| Deploy `VigiaDeviceRegistry` table to AWS | AWS Console | ✅ |
| Deploy `register-device` Lambda + API Gateway route to AWS | AWS Console | ✅ |
| Deploy refactored `ValidatorLambda` to AWS | AWS Console | ✅ |

---

## ✅ Phase 2: H3 Geospatial Deduplication

**Completed**: 2026-04-11

| Task | File | Status |
|---|---|---|
| Add `h3-js` dependency | `packages/backend/package.json` | ✅ |
| Add `h3-hazardtype-index` GSI to `HazardsTable` | `ingestion-stack.ts` | ✅ |
| `isDuplicateHazard()` — H3 res-9 dedup query (12h window) | `functions/verify-hazard-sync/index.ts` | ✅ |
| Store `h3_index` on hazard items | `functions/verify-hazard-sync/index.ts` | ✅ |
| Gate `creditReward` on dedup check | `functions/verify-hazard-sync/index.ts` | ✅ |
| Return `hazardStatus: verified_new \| verified_duplicate` | `functions/verify-hazard-sync/index.ts` | ✅ |
| Stress tests (11 tests, real ethers signing, concurrency) | `__tests__/verify-hazard-sync.test.ts` | ✅ |

---

## ✅ Phase 3: Bedrock Agent Pipeline — Analysis & Tests

**Completed**: 2026-04-11

| Task | File | Status |
|---|---|---|
| Full pipeline map (validator → orchestrator → bedrock → scoring) | `.kiro/pipeline-v2-spec.md` | ✅ |
| `bedrock-router.py` unit tests — 21 tests, scoring math, boundary conditions | `__tests__/test_bedrock_router.py` | ✅ |
| Identified scoring bug: first-ever hazard scores max 57 (below threshold) | Analysis | ✅ |
| Identified `temporalScore` is hardcoded constant (not temporal) | Analysis | ✅ |
| Identified dual-threshold inconsistency (60 vs 70) | Analysis | ✅ |

---

## ✅ Phase 4: Pipeline V2 — S3 Pointer Pattern + VLM + Fail-Closed Treasury

**Completed**: 2026-04-11

### Backend

| Task | File | Status |
|---|---|---|
| Add `VigiaHazardFramesBucket` S3 bucket (30-day lifecycle) | `ingestion-stack.ts` | ✅ |
| Add `s3` import + `framesbucket` public property to `IngestionStack` | `ingestion-stack.ts` | ✅ |
| Add `framesBucket` prop to `IntelligenceStackProps` | `intelligence-stack.ts` | ✅ |
| Wire `framesBucket` in `vigia-stack.ts` | `vigia-stack.ts` | ✅ |
| `ValidatorLambda`: decode `frame_base64` → `PutObject` S3 → write `PENDING` + `s3_key` → return `202` | `src/validator/index.ts` | ✅ |
| `OrchestratorLambda`: S3 `GetObject` → Bedrock `converse` (Nova Lite VLM) | `src/orchestrator/index.ts` | ✅ |
| Fail-closed quarantine: any VLM/S3 failure → `UNVERIFIED_VLM_FAILED`, no `creditReward` | `src/orchestrator/index.ts` | ✅ |
| Deterministic scoring: `DiscoveryBonus + (vlm_confidence × 60)`, threshold 65 | `src/orchestrator/index.ts` | ✅ |
| V2 TracesTable schema: `vlm_reasoning`, `vlm_confidence`, `discovery_bonus`, `total_score`, `verdict` | `src/orchestrator/index.ts` | ✅ |
| Grant `s3:PutObject` to ValidatorLambda | `ingestion-stack.ts` | ✅ |
| Grant `s3:GetObject` + `bedrock:InvokeModel` to OrchestratorLambda | `intelligence-stack.ts` | ✅ |
| Remove `calculate_score` Bedrock tool dependency from scoring path | `src/orchestrator/index.ts` | ✅ |
| Remove `calculate_score` from `bedrock-router.py` `lambda_handler` dispatch | `src/actions/bedrock-router.py` | ✅ |
| Add `@aws-sdk/client-bedrock-runtime` + `@aws-sdk/client-s3` dependencies | `packages/backend/package.json` | ✅ |
| TypeScript compile clean (backend + infrastructure) | — | ✅ |

### Frontend

| Task | File | Status |
|---|---|---|
| Extract `frame_base64` from canvas at detection time | `VideoUploader.tsx` | ✅ |
| Include `frame_base64` in `POST /api/telemetry` payload | `VideoUploader.tsx` | ✅ |
| Emit `hazard-accepted` event with `hazardId` on `202` response | `VideoUploader.tsx` | ✅ |
| New `HazardStatus` type: `pending \| processing \| verified \| rejected \| vlm_failed` | `HazardVerificationPanel.tsx` | ✅ |
| Polling logic: `GET /api/traces/{hazardId}` every 3s until terminal state | `HazardVerificationPanel.tsx` | ✅ |
| Badge states: Pending → Processing (spinner) → Verified / Rejected / Pending Review | `HazardVerificationPanel.tsx` | ✅ |
| Replace "Verify Hazard" with "View Reasoning" button (context menu + inline) | `HazardVerificationPanel.tsx` | ✅ |
| `handleViewReasoning` → `setActiveHazardId` + dispatch `open-agent-traces` | `HazardVerificationPanel.tsx` | ✅ |
| `activeHazardId` + `setActiveHazardId` in Zustand store | `stores/agentTraceStore.ts` | ✅ |
| `AgentTracesTab`: fetch trace on `activeHazardId` change | `AgentTracesTab.tsx` | ✅ |
| VLM reasoning card: reasoning text + confidence / discovery bonus / total score grid | `AgentTracesTab.tsx` | ✅ |
| `GET /api/traces/[hazardId]` Next.js proxy route | `app/api/traces/[hazardId]/route.ts` | ✅ |
| Fix `HDNodeWallet` type in `useDeviceWallet` | `hooks/useDeviceWallet.ts` | ✅ |
| All `app/` source files TypeScript-clean | — | ✅ |
| Add `V2Trace` type | `types/shared.ts` | ✅ |
| Use `V2Trace` in `AgentTracesTab` (replace `any`) | `AgentTracesTab.tsx` | ✅ |
| `open-agent-traces` event listener → switch `InnovationConsolePanel` to traces tab | `InnovationConsolePanel.tsx` | ✅ |

---

## ✅ Phase 5: Production Deployment

**Completed**: 2026-04-11

| Task | Notes | Status |
|---|---|---|
| Create `vigia-hazard-frames-203800220566` S3 bucket | `us-east-1`, block public access | ✅ |
| Set 30-day lifecycle rule on frames bucket | Expires all objects after 30 days | ✅ |
| Build + deploy ValidatorLambda (V2 code) | esbuild → zip → `update-function-code` | ✅ |
| Build + deploy OrchestratorLambda (V2 code) | esbuild → zip → `update-function-code` | ✅ |
| Set `FRAMES_BUCKET_NAME` on ValidatorLambda | `vigia-hazard-frames-203800220566` | ✅ |
| Set `FRAMES_BUCKET_NAME` + `REWARDS_LEDGER_TABLE_NAME` on OrchestratorLambda | Correct table name verified | ✅ |
| Grant `s3:PutObject` to ValidatorLambda role | `FramesBucketWrite` inline policy | ✅ |
| Grant `s3:GetObject` to OrchestratorLambda role | `FramesBucketRead` inline policy | ✅ |
| Grant `bedrock:InvokeModel` to OrchestratorLambda role | `BedrockInvokeModel` inline policy | ✅ |
| Smoke test: register device → POST telemetry → `202 PENDING` | Live API confirmed | ✅ |
| Smoke test: Orchestrator VLM trace written to TracesTable | Nova Lite reasoning confirmed | ✅ |
