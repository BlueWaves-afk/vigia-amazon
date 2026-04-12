# VIGIA Device Registry — Architecture Spec

**Status**: Awaiting approval before implementation  
**Replaces**: Static Secrets Manager public key (`PUBLIC_KEY_SECRET_ARN`)  
**Goal**: Every browser tab becomes a self-sovereign DePIN edge node with a unique ECDSA identity, dynamically registered and verified in the cloud.

---

## 1. DynamoDB Schema — `VigiaDeviceRegistry`

Provisioned in `ingestion-stack.ts` alongside `HazardsTable`.

| Attribute        | Type   | Role          |
|------------------|--------|---------------|
| `device_address` | String | Partition Key — EIP-55 checksummed Ethereum address (e.g. `0x3F8a...`) |
| `registered_at`  | String | ISO 8601 timestamp of first registration |

- Billing: `PAY_PER_REQUEST`
- No sort key needed — one record per device
- No TTL — registrations are permanent (devices don't expire)
- `removalPolicy: DESTROY` for dev; swap to `RETAIN` for prod

---

## 2. New Lambda — `POST /register-device`

**Stack**: `ingestion-stack.ts`  
**Runtime**: Node.js 20  
**File**: `packages/backend/functions/register-device/index.ts`

### Request
```json
{ "device_address": "0x3F8a..." }
```

### Logic
1. Validate `device_address` is a valid Ethereum address (42-char hex, `0x` prefix). Return `400` if not.
2. `PutItem` with `ConditionExpression: "attribute_not_exists(device_address)"` — idempotent, no error on re-registration (catch `ConditionalCheckFailedException` and return `200`).
3. Return `201` on first registration, `200` on duplicate.

### Response
```json
{ "status": "registered", "device_address": "0x3F8a..." }
```

### IAM
- Grant `dynamodb:PutItem` on `VigiaDeviceRegistry` only.
- No Secrets Manager access needed.

---

## 3. Verification Refactor — `verify-hazard-sync`

### What's removed
- `PUBLIC_KEY_SECRET_ARN` env var and all `SecretsManagerClient` / `getPublicKey()` / `verifyEdgeSignature()` logic.
- `cachedPublicKey` module-level variable.

### What replaces it

**Payload string** (must match exactly what the frontend signs):
```
VIGIA:{hazardType}:{lat}:{lon}:{timestamp}:{confidence}
```

**Recovery + registry check** (replaces the old sig block):
```typescript
import { ethers } from 'ethers';

const payloadStr = `VIGIA:${hazardType}:${lat}:${lon}:${timestamp}:${confidence}`;
const recovered  = ethers.verifyMessage(payloadStr, signature);  // recovers address

const { Item } = await dynamodb.send(new GetCommand({
  TableName: DEVICE_REGISTRY_TABLE,
  Key: { device_address: recovered },
}));

if (!Item) {
  return { statusCode: 401, body: JSON.stringify({ error: 'DEVICE_NOT_REGISTERED' }) };
}
// recovered address IS the driverWalletAddress — use it downstream
```

### Fail-closed behaviour
- `ethers.verifyMessage` throws on malformed signatures → caught by outer `try/catch` → `500` (acceptable; malformed input is not a valid device).
- Missing registry entry → `401 DEVICE_NOT_REGISTERED`.
- `TEST_MODE_SIGNATURE` bypass is **removed** — tests must use a real signed payload or mock the DynamoDB `GetCommand`.

### New env var
`DEVICE_REGISTRY_TABLE_NAME` — added to Lambda environment in CDK.

### IAM
- Grant `dynamodb:GetItem` on `VigiaDeviceRegistry`.
- Remove `secretsmanager:GetSecretValue` from the Lambda's role.

---

## 4. Frontend Hook — `useDeviceWallet`

**File**: `packages/frontend/app/hooks/useDeviceWallet.ts`

### State shape
```typescript
type DeviceWallet = {
  address: string;       // EIP-55 checksummed, e.g. "0x3F8a..."
  signPayload: (payloadStr: string) => Promise<string>;  // returns hex signature
  status: 'loading' | 'ready' | 'error';
}
```

### Logic (runs once on mount)
```
1. Check localStorage for key "vigia_device_pk"
2. If missing:
   a. ethers.Wallet.createRandom() → wallet
   b. localStorage.setItem("vigia_device_pk", wallet.privateKey)
   c. POST /register-device { device_address: wallet.address }
3. If present:
   a. new ethers.Wallet(storedKey) → wallet
4. Return { address, signPayload: (str) => wallet.signMessage(str), status: 'ready' }
```

### Signing contract
The hook's `signPayload` signs the exact string:
```
VIGIA:{hazardType}:{lat}:{lon}:{timestamp}:{confidence}
```
This must match the string reconstructed in `verify-hazard-sync` exactly.

---

## 5. Integration Points

### `DetectionModeView.tsx`
- Import and call `useDeviceWallet()` at the top of the component.
- Pass `address` and `signPayload` down to `VideoUploader` as props.
- Replace the hardcoded `DRIVER_WALLET` constant with `address` from the hook.
- Render the **Edge Node Badge** (see §6) in the Detection Node panel header.

### `VideoUploader.tsx`
- Accept new props: `deviceAddress: string`, `signPayload: (s: string) => Promise<string>`.
- In `sendToCloud`, before the `fetch`:
  ```typescript
  const payloadStr = `VIGIA:${hazardType}:${lat}:${lon}:${timestamp}:${confidence}`;
  const signature  = await signPayload(payloadStr);
  ```
- Replace `driverWalletAddress: detection.driverWalletAddress` with `deviceAddress`.

### `HazardVerificationPanel.tsx`
- Replace hardcoded `signature: 'TEST_MODE_SIGNATURE'` and hardcoded wallet with values from `useDeviceWallet` (passed as props or via a shared context).

---

## 6. Edge Node Badge UI

Rendered inside the "Detection Node" panel header in `DetectionModeView.tsx`.

```
🟢 Edge Node Authenticated   0x3F8a...
```

- Shown only when `status === 'ready'`
- Loading state: `⏳ Registering node...`
- Error state: `🔴 Node offline`
- Address display: first 6 chars + `...` (e.g. `0x3F8a...`)
- Style: monospace, small, right-aligned in the panel header bar — consistent with existing `ONNX v26 · 5 FPS` label style

---

## 7. Security Notes

- Private key lives in `localStorage` — acceptable for a browser-based DePIN demo. Production nodes would use a hardware secure element or KMS.
- `ethers.verifyMessage` uses EIP-191 personal sign prefix (`\x19Ethereum Signed Message:\n`). Both sides must use the same method.
- The registry is append-only and public (no auth on `/register-device`). Rate limiting via existing API Gateway throttle is sufficient for demo.
- `TEST_MODE` env var and `TEST_MODE_SIGNATURE` bypass are fully removed from the Lambda.

---

## 8. Files Changed Summary

| File | Change |
|------|--------|
| `packages/infrastructure/lib/stacks/ingestion-stack.ts` | Add `VigiaDeviceRegistry` table + `register-device` Lambda + API route |
| `packages/backend/functions/register-device/index.ts` | **New** |
| `packages/backend/functions/verify-hazard-sync/index.ts` | Remove Secrets Manager; add `ethers.verifyMessage` + registry `GetItem` |
| `packages/frontend/app/hooks/useDeviceWallet.ts` | **New** |
| `packages/frontend/app/components/DetectionModeView.tsx` | Call hook, render badge, pass props |
| `packages/frontend/app/components/VideoUploader.tsx` | Accept `deviceAddress`/`signPayload` props, sign before POST |
| `packages/frontend/app/components/HazardVerificationPanel.tsx` | Replace hardcoded wallet/sig |

---

*Awaiting your approval to proceed to Step 2 (backend implementation).*
