# VIGIA Burn-and-Mint Equilibrium (BME) Architecture

## Token Economy Overview

The BME model eliminates AWS wallet gas costs entirely by shifting all on-chain transactions to the user/enterprise side. The KMS wallet only signs claim authorizations off-chain.

---

## Tokenomics Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                     VIGIA Token Flow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. EARN (off-chain, zero gas)                                  │
│     Edge Node detects hazard → Bedrock verifies → Lambda        │
│     increments pending_balance in DynamoDB                      │
│     (no blockchain call, no gas cost to AWS)                    │
│                                                                 │
│  2. CLAIM (user pays gas)                                       │
│     User calls /api/claim → Lambda reads pending_balance,       │
│     generates KMS-signed ECDSA authorization → User submits     │
│     claimRewards(amount, signature) on-chain → Treasury         │
│     transfers tokens to user wallet                             │
│                                                                 │
│  3. BURN (enterprise pays gas)                                  │
│     Enterprise calls burnForDataCredits(amount) → Tokens        │
│     burned from supply → Enterprise receives Data Credits       │
│     (off-chain API access quota)                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Roles

| Actor | Action | Gas Payer |
|---|---|---|
| Edge Node (browser) | Detects hazard, submits telemetry | None |
| AWS Lambda | Verifies hazard, updates DynamoDB | None |
| AWS KMS | Signs claim authorization | None |
| User/Driver | Calls `claimRewards()` on-chain | User |
| Enterprise | Calls `burnForDataCredits()` on-chain | Enterprise |

## Key Invariant

The KMS Treasury wallet (`0x4588...`) **never submits transactions**. It only signs messages. Gas costs to AWS = $0.
