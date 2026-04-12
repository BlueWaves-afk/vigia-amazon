# VIGIA Pipeline V2 — Architecture Spec

**Status**: Awaiting approval before implementation  
**Supersedes**: Current split-brain verify-hazard-sync + orchestrator architecture

---

## Problem Statement

Three structural flaws in the current system:

1. **Split-brain AI**: Both `verify-hazard-sync` and `OrchestratorLambda` independently invoke Bedrock for the same hazard — race conditions, double billing, inconsistent state.
2. **Broken tokenomics**: A first-ever hazard at a new location scores max 57 (below both thresholds). Early discoverers are never rewarded.
3. **No image-level fraud detection**: The agent reasons only on geohash counts. ONNX edge confidence alone can trigger rewards — trivially gameable.

---

## Architecture Overview

```
Browser
  │  POST /api/telemetry  { ...hazard, frame_base64 }
  ▼
ValidatorLambda  (/telemetry)
  │  1. ethers.verifyMessage → device registry check → 401 if missing
  │  2. PutObject S3 (VigiaHazardFramesBucket) → s3_key
  │  3. PutItem HazardsTable  { status: "PENDING", s3_key }
  │  4. Return HTTP 202 Accepted — zero AI here
  │
  │  DynamoDB Stream (INSERT trigger)
  ▼
OrchestratorLambda  (sole AI worker)
  │  1. Cooldown check (30s by geohash#type)
  │  2. GetObject S3 using s3_key from stream NewImage
  │  3. Bedrock converse (Nova Lite) with image bytes
  │     ┌─ SUCCESS → vlm_confidence from JSON response
  │     └─ FAILURE → status: UNVERIFIED_VLM_FAILED, no reward, write trace, exit
  │  4. Count existing VERIFIED hazards at geohash (local DynamoDB query)
  │  5. Deterministic score = DiscoveryBonus + (vlm_confidence × 60)
  │  6. score ≥ 65 → UpdateItem VERIFIED + creditReward
  │     score < 65  → UpdateItem REJECTED
  │  7. PutItem TracesTable (hazardId, vlm_reasoning, score breakdown)
  │
  ▼
Frontend polls GET /api/traces/{hazardId}  (every 3s while PENDING)
  → Updates badge: PENDING → Processing → VERIFIED / REJECTED / Pending Review
```

`verify-hazard-sync` is **repurposed as the ingestion endpoint** (same URL, new behaviour). The frontend no longer triggers synchronous AI.

---

## §1. Async Ingestion & S3 Pointer Pattern

### ValidatorLambda (`packages/backend/src/validator/index.ts`)

**New behaviour:**
1. ECDSA verify + device registry check (unchanged)
2. Decode `frame_base64` → upload to S3:
   ```typescript
   const s3Key = `frames/${geohash}/${timestamp}.jpg`;
   await s3.send(new PutObjectCommand({
     Bucket: process.env.FRAMES_BUCKET_NAME!,
     Key: s3Key,
     Body: Buffer.from(frame_base64, 'base64'),
     ContentType: 'image/jpeg',
   }));
   ```
3. Write HazardsTable with `status: "PENDING"` and `s3_key`
4. Return `202 Accepted` with `{ hazardId, status: "PENDING" }`

**If `frame_base64` is absent**: write hazard with `status: "PENDING"` and `s3_key: null`. The Orchestrator will handle the missing frame via the VLM fallback path.

### New S3 Bucket: `VigiaHazardFramesBucket`
- Lifecycle rule: expire objects after 30 days
- No public access
- Provisioned in `ingestion-stack.ts`

### HazardsTable status values
| Value | Set by | Meaning |
|---|---|---|
| `PENDING` | ValidatorLambda | Written, awaiting orchestrator |
| `VERIFIED` | OrchestratorLambda | VLM confirmed, score ≥ 65 |
| `REJECTED` | OrchestratorLambda | VLM ran, score < 65 |
| `UNVERIFIED_VLM_FAILED` | OrchestratorLambda | VLM/S3 error, reward suspended |

---

## §2. VLM Integration (Nova Lite)

### OrchestratorLambda (`packages/backend/src/orchestrator/index.ts`)

**S3 fetch:**
```python
obj = s3.get_object(Bucket=FRAMES_BUCKET, Key=s3_key)
image_bytes = obj['Body'].read()
```

**Bedrock converse call:**
```python
response = bedrock.converse(
    modelId="amazon.nova-lite-v1:0",
    messages=[{
        "role": "user",
        "content": [
            {
                "image": {
                    "format": "jpeg",
                    "source": {"bytes": image_bytes}
                }
            },
            {
                "text": (
                    "Analyze this dashcam frame. Is this a genuine physical road hazard? "
                    "Return your reasoning and a confidence float (0.0 to 1.0). "
                    'Respond ONLY with valid JSON: {"reasoning": "...", "confidence": 0.8}'
                )
            }
        ]
    }]
)
vlm_text = response["output"]["message"]["content"][0]["text"]
vlm = json.loads(vlm_text)  # {"reasoning": str, "confidence": float}
```

---

## §3. Strict Fail-Closed VLM Quarantine

The ONNX edge confidence score **never authorises a token reward on its own**.

```python
try:
    # S3 fetch + Bedrock converse (§2)
    vlm_confidence = vlm["confidence"]
    vlm_reasoning  = vlm["reasoning"]
except Exception as e:
    # S3 failure, Bedrock timeout, JSON parse error — all treated identically
    await dynamodb.update_item(status="UNVERIFIED_VLM_FAILED")
    await write_trace(hazardId, reasoning="VLM unavailable. Edge ONNX confidence recorded. Reward suspended.",
                      vlm_confidence=None, total_score=None, verdict="UNVERIFIED_VLM_FAILED")
    return  # creditReward is NEVER called
```

**No fallback scoring. No partial rewards.** The treasury is protected.

---

## §4. Deterministic Scoring Math

Replaces `calculate_score` Bedrock tool and `query_hazards` inline score. Computed locally in the Orchestrator.

```python
# count = DynamoDB query: VERIFIED hazards at same geohash
discovery_bonus = 40 if count == 0 else min(count * 10, 30)
total_score     = discovery_bonus + (vlm_confidence * 60)
# Range: [0, 100]  Threshold: 65
```

### Score table
| Scenario | count | vlm_conf | bonus | total | verdict |
|---|---|---|---|---|---|
| First ever, VLM sure | 0 | 0.9 | 40 | 94 | ✅ VERIFIED |
| First ever, VLM unsure | 0 | 0.4 | 40 | 64 | ❌ REJECTED |
| Known location, VLM sure | 3 | 0.9 | 30 | 84 | ✅ VERIFIED |
| Known location, VLM unsure | 3 | 0.4 | 30 | 54 | ❌ REJECTED |
| VLM fails | any | — | — | — | ⚠️ UNVERIFIED_VLM_FAILED |

**Key fix**: First discoverers get `+40` bonus. A confident first detection scores 94 instead of the old 57.

### TracesTable item (V2 schema)
```json
{
  "traceId":          "orch-{geohash}-{ts}",
  "hazardId":         "{geohash}#{timestamp}",
  "vlm_reasoning":    "I can see a large pothole approximately 30cm wide...",
  "vlm_confidence":   0.87,
  "discovery_bonus":  40,
  "total_score":      92,
  "verdict":          "VERIFIED",
  "createdAt":        "ISO8601",
  "ttl":              604800
}
```

`calculate_score` tool is removed from `bedrock-router.py`. `query_hazards` is retained for the agent's network intelligence features but no longer used in the scoring path.

---

## §5. Frontend UI States & Traces

### HazardVerificationPanel — badge states
| DynamoDB status | Badge | Colour |
|---|---|---|
| `PENDING` (no poll yet) | `⏳ Pending` | yellow |
| `PENDING` (poll in-flight) | `◌ Processing` + spinner | accent |
| `VERIFIED` | `✓ Verified` | green |
| `REJECTED` | `✗ Rejected` | red |
| `UNVERIFIED_VLM_FAILED` | `⚠ Pending Review` | yellow |

### Polling logic
- After `202` response: immediately show `Processing` spinner
- Poll `GET /api/traces/{hazardId}` every 3 seconds
- Stop when status ∈ `{VERIFIED, REJECTED, UNVERIFIED_VLM_FAILED}` or after 60s timeout
- `GET /api/traces/{hazardId}` is a new Next.js proxy route (avoids CORS)

### "View Reasoning" button (replaces "Verify Hazard")
- Always visible on each hazard row
- On click: `useAgentTraceStore.setActiveHazardId(hazardId)`
- Switches right panel to "Agent Traces" tab
- `AgentTracesTab` reads `activeHazardId`, fetches trace from TracesTable, renders VLM card

### AgentTracesTab — VLM reasoning card (new V2 trace format)
```
┌─ VLM Analysis ─────────────────────────────────────────┐
│ "I can see a large pothole approximately 30cm wide..."  │
│                                                         │
│ VLM Confidence:  0.87                                   │
│ Discovery Bonus: +40  (first report at this location)   │
│ Total Score:     92 / 100                               │
│ Verdict:         ✓ VERIFIED                             │
└─────────────────────────────────────────────────────────┘
```
For `UNVERIFIED_VLM_FAILED` traces: render the suspended-reward message in yellow.

### `agentTraceStore.ts` additions
```typescript
activeHazardId: string | null;
setActiveHazardId: (id: string | null) => void;
```

---

## §6. Files Changed

| File | Change |
|---|---|
| `packages/infrastructure/lib/stacks/ingestion-stack.ts` | Add S3 bucket, grant read to Orchestrator, write to Validator |
| `packages/infrastructure/lib/stacks/intelligence-stack.ts` | Add `FRAMES_BUCKET_NAME` env var + `bedrock:InvokeModel` IAM |
| `packages/backend/src/validator/index.ts` | S3 upload, write `PENDING` + `s3_key`, return 202 |
| `packages/backend/src/orchestrator/index.ts` | S3 fetch, VLM converse, fail-closed quarantine, new scoring |
| `packages/backend/src/actions/bedrock-router.py` | Remove `calculate_score` tool |
| `packages/frontend/app/components/VideoUploader.tsx` | Extract `frame_base64` from canvas, include in payload |
| `packages/frontend/app/components/HazardVerificationPanel.tsx` | Polling, new badge states, "View Reasoning" button |
| `packages/frontend/app/components/AgentTracesTab.tsx` | Read `activeHazardId`, render VLM reasoning card |
| `packages/frontend/stores/agentTraceStore.ts` | Add `activeHazardId` + `setActiveHazardId` |
| `packages/frontend/app/api/traces/[hazardId]/route.ts` | **New** — Next.js proxy for `GET /traces/{hazardId}` |
| `packages/frontend/types/shared.ts` | Add `V2Trace` type |

### What is removed
- Synchronous Bedrock invocation from `verify-hazard-sync`
- `calculate_score` Bedrock tool
- Dual-threshold system (60 vs 70) — unified to 65
- ONNX-score-only reward path (fail-closed quarantine replaces it)

---

## §7. IAM & CDK Notes

**New permissions needed:**

| Lambda | Permission | Resource |
|---|---|---|
| ValidatorLambda | `s3:PutObject` | `VigiaHazardFramesBucket/*` |
| OrchestratorLambda | `s3:GetObject` | `VigiaHazardFramesBucket/*` |
| OrchestratorLambda | `bedrock:InvokeModel` | `amazon.nova-lite-v1:0` |

OrchestratorLambda already has `bedrock:InvokeAgent` — `InvokeModel` is the separate permission for the converse API.

---

*Awaiting your approval to proceed to Step 2 (backend) and Step 3 (frontend).*
