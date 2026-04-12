# DePIN Blockchain Trust Layer Upgrade

**Date**: 2026-04-09  
**Status**: 🚧 IN PROGRESS  
**Competition**: Amazon 10,000 AIdeas (Semi-Finalist)

---

## 🎯 Objective

Replace the mocked DePIN ledger with a production-ready cryptographic trust layer backed by a real ERC20 token ($VIGIA) on Polygon Amoy testnet. The AWS KMS key is the sole minting authority.

---

## 🏗️ Architecture

```
Edge Node (Browser)
  └─ VideoUploader.tsx
       ├─ Uploads .pem key (or uses mock fallback)
       ├─ Signs payload: { hazardType, gps, timestamp, driverWalletAddress }
       └─ POST /telemetry  { ...payload, signature, driverWalletAddress }
              ↓
API Gateway → Validator Lambda (existing)
  └─ Verifies ECDSA signature (existing logic)
  └─ Writes hazard to DynamoDB with status=UNVERIFIED
              ↓
DynamoDB Stream → Orchestrator → Bedrock Agent
  └─ verify-hazard-sync Lambda (UPGRADED)
       ├─ Step A: Verify edge payload signature
       ├─ Step B: Mint 1 $VIGIA via KMS-signed tx (ethers v6 + AwsKmsSigner)
       └─ Step C: Save txHash to LedgerTable
              ↓
React Frontend
  └─ LedgerTicker.tsx (UPGRADED)
       └─ Reward column → clickable link to https://amoy.polygonscan.com/tx/{txHash}
```

---

## 📋 Task Breakdown

### Task 1: Frontend — Edge Data Provenance

**File**: `packages/frontend/app/components/VideoUploader.tsx`

**Changes**:
- Add `driverWalletAddress` state (text input, optional — defaults to mock address for demo)
- Pass `driverWalletAddress` into the telemetry payload sent to `/telemetry`
- The worker already signs `{ hazardType, lat, lon, timestamp, confidence }` — extend to include `driverWalletAddress` in the signed payload
- Worker file: `packages/frontend/app/workers/hazard-detector.worker.ts`
  - Update `signTelemetry()` to include `driverWalletAddress` in the signed object
  - Update `processFrame()` to accept and pass through `driverWalletAddress`

**Mock fallback**: If no `.pem` key uploaded, worker already returns `'TEST_MODE_SIGNATURE'` — keep this behavior.

---

### Task 2: Backend — Cryptographic Trust Layer

**File**: `packages/backend/functions/verify-hazard-sync/index.ts`

**New dependencies** (add to Lambda bundle):
- `ethers` v6
- `ethers-aws-kms-signer` (or `@rumblefishdev/eth-signer-kms`)

**Environment Variables** (add to CDK):
- `POLYGON_AMOY_RPC_URL` — Polygon Amoy JSON-RPC endpoint
- `KMS_KEY_ID` — AWS KMS asymmetric key ID (ECC_SECG_P256K1)
- `VIGIA_CONTRACT_ADDRESS` — deployed ERC20 contract address

**Step A — Signature Verification**:
- Extract `signature` and `driverWalletAddress` from the incoming request body
- Reconstruct the signed payload: `{ hazardType, lat, lon, timestamp, confidence, driverWalletAddress }`
- Verify using Node.js `crypto.createVerify('SHA256')` against the registered public key from Secrets Manager
- If invalid → return 400, do NOT mint

**Step B — Token Minting**:
- Use `AwsKmsSigner` with `KMS_KEY_ID` to create an ethers signer
- Connect to Polygon Amoy via `JsonRpcProvider(POLYGON_AMOY_RPC_URL)`
- Call `contract.mint(driverWalletAddress, ethers.parseUnits('1', 18))`
- Wrap in try/catch with 10s timeout — if RPC fails, log warning but do NOT throw (Bedrock agent must not hang)
- Return `txHash` from the transaction receipt

**Step C — Ledger Storage**:
- After successful mint, update the DynamoDB LedgerTable entry with `txHash`
- Also update the HazardsTable record to set `status: 'VERIFIED'` and `txHash`

**ERC20 ABI** (minimal, only what's needed):
```json
["function mint(address to, uint256 amount) external"]
```

---

### Task 3: Frontend — Real DePIN Ledger UI

**File**: `packages/frontend/app/components/LedgerTicker.tsx`

**Changes**:
- Add `txHash?: string` to the `LedgerEntry` type
- The `/api/ledger` route already fetches from DynamoDB — the `txHash` field will be present once Task 2 is deployed
- Update the "Reward" column: if `txHash` exists, render a `<a>` tag linking to `https://amoy.polygonscan.com/tx/{txHash}` with `target="_blank"` and an `ExternalLink` icon from lucide-react
- If no `txHash` (legacy entries), show plain `{credits} $VIGIA` as before

---

## 🔧 CDK Infrastructure Changes

**File**: `packages/infrastructure/lib/stacks/intelligence-stack.ts`

Add to `verifyHazardSyncFn` environment:
```typescript
POLYGON_AMOY_RPC_URL: process.env.POLYGON_AMOY_RPC_URL || '',
KMS_KEY_ID: process.env.KMS_KEY_ID || '',
VIGIA_CONTRACT_ADDRESS: process.env.VIGIA_CONTRACT_ADDRESS || '',
```

Add IAM policy to allow Lambda to call KMS:
```typescript
verifyHazardSyncFn.addToRolePolicy(new iam.PolicyStatement({
  actions: ['kms:Sign', 'kms:GetPublicKey'],
  resources: [`arn:aws:kms:*:*:key/${KMS_KEY_ID}`],
}));
```

---

## 🔒 Security Constraints

- KMS key is the ONLY minting authority — private key never leaves AWS
- `driverWalletAddress` is included in the signed payload to prevent address substitution attacks
- Signature verification happens BEFORE any blockchain call
- RPC failures are non-fatal (logged, not thrown) to prevent Bedrock agent timeouts

---

## 💰 Cost Impact

| Service | Cost | Notes |
|---------|------|-------|
| AWS KMS Sign | $0.03/10K requests | Negligible for demo |
| Polygon Amoy | Free | Testnet |
| Lambda extra runtime | ~50ms | ethers.js overhead |

---

## 🧪 Testing

### Test 1: Frontend Signing
1. Upload video without .pem → verify `driverWalletAddress` field appears in POST body
2. Upload video with .pem → verify signature changes from `TEST_MODE_SIGNATURE`

### Test 2: Lambda Minting
```bash
aws lambda invoke \
  --function-name VigiaStack-IntelligenceWithHazardsVerifyHazardSync-* \
  --payload '{"body":"{\"hazardId\":\"test\",\"driverWalletAddress\":\"0x...\",\"signature\":\"TEST_MODE_SIGNATURE\"}"}' \
  response.json
```
Verify `txHash` in response.

### Test 3: Ledger UI
1. Open DePIN Ledger tab
2. Verify entries with `txHash` show clickable PolygonScan link
3. Click link → opens `https://amoy.polygonscan.com/tx/{txHash}` in new tab

---

## 📁 Files Modified

| File | Change |
|------|--------|
| `packages/frontend/app/workers/hazard-detector.worker.ts` | Include `driverWalletAddress` in signed payload |
| `packages/frontend/app/components/VideoUploader.tsx` | Add wallet address input, pass to telemetry |
| `packages/backend/functions/verify-hazard-sync/index.ts` | Add sig verify + KMS mint + txHash storage |
| `packages/frontend/app/components/LedgerTicker.tsx` | Clickable txHash link in Reward column |
| `packages/infrastructure/lib/stacks/intelligence-stack.ts` | Add env vars + KMS IAM policy |

---

## ⚠️ Constraints

- Do NOT break `AgentTracesTab` or `LiveMap`
- Do NOT modify the Bedrock Agent action groups
- Lambda blockchain logic MUST have try/catch — RPC errors are non-fatal
- Keep `TEST_MODE_SIGNATURE` bypass for demo mode
- Maintain existing monochrome design system in UI changes

---

**Status**: Ready for implementation  
**Owner**: Lead Engineer  
**Reference**: Use this file for all future prompts/fixes related to the blockchain trust layer upgrade.
