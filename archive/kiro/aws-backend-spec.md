# VIGIA AWS Backend Specification — BME Model

## DynamoDB: `VigiaRewardsLedger` Table

| Attribute | Type | Description |
|---|---|---|
| `wallet_address` (PK) | String | EIP-55 checksummed wallet address |
| `pending_balance` | Number | Tokens earned, not yet claimed (18-decimal integer as string) |
| `total_earned` | Number | Lifetime tokens earned (18-decimal integer as string) |
| `total_claimed` | Number | Lifetime tokens claimed |
| `last_updated` | String | ISO 8601 timestamp |
| `nonce` | Number | Monotonically increasing — prevents signature replay |

**Billing**: On-demand. **No TTL** (permanent reward records).

---

## Lambda 1: `verify-hazard-sync` (updated)

**Trigger**: API Gateway POST `/verify-hazard-sync`

**Current behavior**: Calls `ethers.js` → submits blockchain tx (gas cost to AWS).

**New behavior**:
1. Bedrock agent verifies hazard → `verificationScore >= 60`
2. If verified and `driverWalletAddress` present:
   - `UpdateItem` on `VigiaRewardsLedger`:
     - `ADD pending_balance :one` (1 token in wei = `1000000000000000000`)
     - `ADD total_earned :one`
     - `SET last_updated = :now`
     - `SET nonce = if_not_exists(nonce, :zero)` (initialize if new wallet)
3. Return `{ verificationScore, rewardPending: true }` — **no txHash**

**No ethers.js, no KMS calls, no blockchain interaction.**

---

## Lambda 2: `claim-signature` (new)

**Trigger**: API Gateway POST `/claim-signature`

**Request body**:
```json
{ "wallet_address": "0x35b0Ec7B2172d1a1C8367C312246786632DE9427" }
```

**Flow**:
1. Read `pending_balance` and `nonce` from `VigiaRewardsLedger`
2. Reject if `pending_balance == 0`
3. Construct EIP-191 message hash:
   ```
   keccak256(abi.encodePacked(wallet_address, amount, nonce, chainId))
   ```
4. Sign with `KMSSigner` (AWS KMS key `ad6343de-...`)
5. Atomically increment `nonce` in DynamoDB (prevents replay)
6. Zero out `pending_balance` (tokens are now "in-flight" for claim)
7. Return `{ amount, nonce, signature }`

**User then calls `claimRewards(amount, nonce, signature)` on-chain — user pays gas.**

---

## Environment Variables (both Lambdas)

```
REWARDS_LEDGER_TABLE_NAME   = VigiaRewardsLedger
KMS_KEY_ID                  = ad6343de-0e67-4502-a230-db2a6210e6a7
VIGIA_CONTRACT_ADDRESS      = <BME contract address after deployment>
CHAIN_ID                    = 80002
```

---

## API Routes Summary

| Method | Path | Lambda | Auth |
|---|---|---|---|
| POST | `/verify-hazard-sync` | verify-hazard-sync | None (existing) |
| POST | `/claim-signature` | claim-signature | None (wallet = identity) |
