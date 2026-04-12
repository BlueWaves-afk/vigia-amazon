# VIGIA Enterprise Auth & DePIN Rewards — Spec

## Overview
Add user registration/auth to the Enterprise dashboard so burns are tracked per user, API keys are tied to accounts, and node operators are rewarded from burn revenue.

---

## Architecture

```
[Frontend]
  RegisterModal / LoginModal (email + password)
        ↓
[AWS Cognito User Pool]
  - Email/password auth
  - JWT tokens (idToken, accessToken)
        ↓
[API Gateway + Lambda Authorizer]
  - Validates JWT on all /enterprise/* routes
  - Validates API key on all /v1/* data routes
        ↓
[DynamoDB: EnterpriseUsersTable]
  PK: userId (Cognito sub)
  Attributes: email, apiKey, trialVga, dataCredits, createdAt
        ↓
[DynamoDB: BurnHistoryTable]
  PK: userId, SK: timestamp
  Attributes: vgaBurned, creditsProvisioned, txHash, nodeRewardPool
        ↓
[DePIN Rewards Pipeline]
  BurnHistoryTable Stream → RewardsDistributorLambda
  → reads contributionPoints from HazardsTable
  → calls KMS to sign claimRewards payload for each node
```

---

## Session State (Frontend)

```ts
interface EnterpriseSession {
  userId: string;
  email: string;
  apiKey: string;
  trialVga: number;       // starts at 20, max 20
  dataCredits: number;    // starts at 0
  isTrialActive: boolean;
}
```

Stored in: `localStorage('vigia:enterprise:session')` after Cognito login.

---

## DynamoDB Tables

### EnterpriseUsersTable
| Key | Type | Notes |
|-----|------|-------|
| userId (PK) | String | Cognito sub |
| email | String | |
| apiKey | String | `vigia_live_[REDACTED]` |
| trialVga | Number | starts 20 |
| dataCredits | Number | starts 0 |
| createdAt | String | ISO 8601 |

### BurnHistoryTable
| Key | Type | Notes |
|-----|------|-------|
| userId (PK) | String | |
| timestamp (SK) | String | ISO 8601 |
| vgaBurned | Number | |
| creditsProvisioned | Number | vgaBurned * 1000 |
| txHash | String | mock or real Polygon tx |
| nodeRewardPool | Number | vgaBurned * 0.20 (20% to nodes) |

---

## Lambda Functions

### enterprise-register (POST /enterprise/register)
- Input: `{ email, password }`
- Creates Cognito user
- Creates EnterpriseUsersTable record with `trialVga: 20, dataCredits: 0, apiKey: vigia_live_[REDACTED]`
- Returns: `{ userId, apiKey, trialVga: 20, dataCredits: 0 }`

### enterprise-login (POST /enterprise/login)
- Input: `{ email, password }`
- Calls Cognito InitiateAuth
- Returns: `{ idToken, accessToken, userId, apiKey, trialVga, dataCredits }`

### enterprise-burn (POST /enterprise/burn) [JWT protected]
- Input: `{ vgaAmount }` (1–trialVga)
- Validates trialVga >= vgaAmount
- Deducts trialVga, adds dataCredits (vgaAmount * 1000)
- Writes BurnHistoryTable record
- Triggers node reward distribution (20% of burn)
- Returns: `{ trialVga, dataCredits, txHash, creditsProvisioned }`

### enterprise-me (GET /enterprise/me) [JWT protected]
- Returns current user state from DynamoDB

### rewards-distributor (DynamoDB Stream trigger on BurnHistoryTable)
- Reads nodeRewardPool from new burn record
- Scans HazardsTable for verified hazards, groups by contributorId
- Calculates proportional share per node
- Signs claimRewards payload with KMS for each node
- Writes to a NodeRewardsTable for nodes to claim

---

## API Key Authorizer
- Lambda authorizer on API Gateway
- Header: `x-api-key: vigia_live_...`
- Looks up apiKey in EnterpriseUsersTable (GSI on apiKey)
- Checks dataCredits > 0, deducts 1 per call
- Returns IAM Allow/Deny policy

---

## DePIN Rewards Flow

```
Enterprise burns 5 VGA
  → 5,000 data credits provisioned to enterprise
  → 1 VGA (20%) added to nodeRewardPool
  → RewardsDistributor reads last 24h verified hazards
  → Node A submitted 60% of verified hazards → gets 0.6 VGA reward
  → Node B submitted 40% → gets 0.4 VGA reward
  → KMS signs claimRewards(nodeAddress, amount, nonce)
  → Node calls claimRewards() on contract to receive VGA
```

---

## Frontend Changes

### RegisterModal / LoginModal
- Shown when `!session` in EnterpriseDashboard
- Email + password fields
- On success: stores session in localStorage, shows dashboard

### EnterpriseDashboard updates
- Reads real `trialVga` / `dataCredits` from API (`GET /enterprise/me`)
- Burn calls `POST /enterprise/burn` with JWT
- Burn history loaded from `BurnHistoryTable` via API
- API key shown from session

---

## Security
- Passwords handled entirely by Cognito (never stored in DynamoDB)
- JWT validated server-side on every protected route
- API keys stored hashed in DynamoDB, compared with bcrypt
- Trial limit enforced server-side (not just frontend clamp)
- Rate limit: 10 burns/hour per userId

---

## Out of Scope (Phase 2)
- Real Polygon transaction submission (currently mocked txHash)
- Stripe billing for paid tiers
- Node operator dashboard
