# VIGIA UI Portal Specification

## Architecture Context

The app uses a sidebar `ActivityBtn` system with four current groups:
`explorer | detection | network | maintenance`

We are adding one new group (`enterprise`) and upgrading two existing groups (`detection`, `network`).

---

## Phase A — Driver Copilot (Detection Group)

### Integration Point
File: `packages/frontend/app/components/DetectionModeView.tsx`

Add a **Rewards Widget** as a collapsible panel inside the Detection Activity Group, rendered below the `HazardVerificationPanel`.

### Data Source
- `GET /claim-signature` (POST with wallet_address) → `{ pending_balance, total_earned, nonce }`
- Add a `GET /rewards/:wallet_address` route (or read directly from the existing `/claim-signature` pre-flight) to display balance without consuming the nonce
- Env: `NEXT_PUBLIC_INNOVATION_API_URL` (already set)

### Widget: `RewardsWidget.tsx`

**State:**
```ts
pendingBalance: bigint      // from DynamoDB pending_balance
totalEarned: bigint         // from DynamoDB total_earned  
claimStatus: 'idle' | 'signing' | 'submitting' | 'confirmed' | 'error'
txHash: string | null
```

**Optimistic update rule:** On "Withdraw" click, immediately set `pendingBalance = 0n` in local state before the API call resolves. If the claim fails, restore the previous value.

**UI Layout:**
```
┌─────────────────────────────────────┐
│  ⬡ VGA REWARDS                      │
│  Pending:  1.00 VGA  [Withdraw →]   │
│  Lifetime: 3.00 VGA                 │
│  Wallet:   0x35b0...9427            │
│                                     │
│  [Withdraw to Wallet]               │
│  → calls POST /claim-signature      │
│  → user signs claimRewards() tx     │
│  → shows PolygonScan link on confirm│
└─────────────────────────────────────┘
```

**Withdraw Flow:**
1. `POST /claim-signature` → `{ amount, nonce, signature }`
2. Optimistically zero `pendingBalance` in UI
3. Call `contract.claimRewards(amount, nonce, signature)` via `window.ethereum`
4. Show spinner with "Submitting to Polygon Amoy..."
5. On confirm: show `txHash` with PolygonScan link
6. On error: restore `pendingBalance`, show error toast

**No MetaMask dependency for viewing** — balance display works without wallet connected.

---

## Phase B — Enterprise BME Console (New Activity Group)

### Integration Point
File: `packages/frontend/app/components/Sidebar.tsx`

Add new `ActivityBtn` for `enterprise` group (icon: `Flame`).

New file: `packages/frontend/app/components/EnterpriseDashboard.tsx`

### Data Sources
- `NEXT_PUBLIC_INNOVATION_API_URL/economic/metrics` — existing endpoint for supply stats
- Contract read: `totalSupply()`, `dataCredits(address)`, `balanceOf(address)`
- Contract: `0x8c45482788De4a5d496089AD057E8CE550971b62` (Polygon Amoy)
- RPC: `https://rpc-amoy.polygon.technology/`

### Layout: Three panels

**Panel 1 — Token Stats (read-only, no wallet needed)**
```
Total Supply:    999,999 VGA   (live from contract)
Total Burned:    1 VGA         (1,000,000 - totalSupply)
Your Credits:    0             (dataCredits[wallet] if connected)
```

**Panel 2 — Burn Furnace**
```
┌──────────────────────────────────┐
│  🔥 BURN FOR DATA CREDITS        │
│                                  │
│  Amount: [____] VGA              │
│                                  │
│  [Burn Tokens →]                 │
│                                  │
│  1 VGA = 1 Data Credit           │
│  Data Credits = API call quota   │
└──────────────────────────────────┘
```
- Calls `burnForDataCredits(amount)` via `window.ethereum`
- Animated flame SVG while tx is pending
- On confirm: increment `dataCredits` display optimistically

**Panel 3 — Burn History Feed**
- Last 10 `DataCreditsPurchased` events from contract logs
- Columns: `Enterprise | Amount Burned | Tx | Time`

---

## Phase C — Global Network Explorer (Network Group Update)

### Integration Point
File: `packages/frontend/app/components/NetworkMapView.tsx`

Replace the "Network Surveillance" tab content with a new `GlobalNetworkExplorer` component.

New file: `packages/frontend/app/components/GlobalNetworkExplorer.tsx`

### Data Sources
- `NEXT_PUBLIC_API_URL/hazards` — existing hazard feed
- Contract reads: `totalSupply()` (Polygon Amoy RPC, no wallet needed)
- `NEXT_PUBLIC_INNOVATION_API_URL/economic/metrics` — existing

### Layout: Three stat cards + live feed

**Stat Cards (top row)**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Total Supply │  │ Total Burned │  │ Verified     │
│ 999,999 VGA  │  │ 1 VGA        │  │ Hazards: 47  │
│ (live)       │  │ (deflation)  │  │ (last 24h)   │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Live Hazard Feed (scrolling)**
- Polls `GET /hazards?status=verified&limit=20` every 30s
- Columns: `Type | Location | Score | Time | Reward`
- `Reward` column shows ✅ if `rewardPending=true`, else —

---

## State Management Rules

1. **No SSM reads from frontend** — SSM is backend-only. Frontend reads from `NEXT_PUBLIC_*` env vars and the existing API endpoints.
2. **Contract address** — hardcode `0x8c45482788De4a5d496089AD057E8CE550971b62` in a single `constants.ts` file. Update when contract is redeployed.
3. **Wallet connection** — use `window.ethereum` directly (no wagmi/rainbowkit). All read operations work without wallet connected.
4. **Optimistic updates** — zero `pendingBalance` and increment `dataCredits` locally before tx confirms. Revert on error.
5. **Polling** — rewards balance polls every 15s. Network feed polls every 30s. Contract stats poll every 60s.

---

## New Files Summary

| File | Purpose |
|---|---|
| `components/RewardsWidget.tsx` | Phase A — pending balance + claim flow |
| `components/EnterpriseDashboard.tsx` | Phase B — burn furnace + data credits |
| `components/GlobalNetworkExplorer.tsx` | Phase C — supply stats + hazard feed |
| `lib/constants.ts` | Contract address, RPC URL, chain ID |
| `lib/contract.ts` | Minimal ethers read/write helpers |

## Modified Files Summary

| File | Change |
|---|---|
| `components/DetectionModeView.tsx` | Add `<RewardsWidget>` below verification panel |
| `components/Sidebar.tsx` | Add `enterprise` ActivityBtn |
| `components/NetworkMapView.tsx` | Replace surveillance tab with `<GlobalNetworkExplorer>` |
| `app/page.tsx` | Add `enterprise` to activity type union |
