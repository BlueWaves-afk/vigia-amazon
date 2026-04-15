# Missing Features Spec

## Feature 1: "View Reasoning" Button in Driver Copilot

### What
Add a "View Reasoning" button to `RewardsWidget` that shows the Nova Lite VLM's
reasoning for the driver's most recently verified hazard.

### Why it adds value
- Demonstrates VLM anti-fraud transparency to judges
- Closes the loop: driver submits hazard → VLM analyzes → driver sees why it was
  accepted/rejected
- Infrastructure already exists: AgentTracesTable + /api/traces/[hazardId]

### Data flow
RewardsWidget fetches /rewards-balance → gets last_hazard_id from response
→ on button click: GET /api/traces/[hazardId]
→ renders reasoning steps inline

### Backend change needed
rewards-balance Lambda must return `last_hazard_id` in its response.
Check if it already does, otherwise add it from the RewardsLedger record.

### UI change
Add "View Reasoning" button below the balances in RewardsWidget.
On click: fetch traces, show in a small expandable panel (same style as
AgentChatPanel reasoning steps).

---

## Feature 2: Deflationary Tracker in GlobalNetworkExplorer

### What
Add a burn history sparkline and bonding curve price to GlobalNetworkExplorer,
making it a true "deflationary tracker" as claimed.

### Why it adds value
- Visually demonstrates the BME tokenomics in the public-facing explorer
- The Enterprise dashboard already has the bonding curve price — surfacing it
  in the public explorer reinforces the narrative
- Burn history from DynamoDB (BurnHistoryTable) is already available

### Data flow
GlobalNetworkExplorer fetches GET /enterprise/stats (already deployed)
→ reads totalBurnedVga, vgaPriceUsd, nodeRewardPoolVga, dbBurnedVga
→ renders alongside existing on-chain supply metric

### UI change
- Add "VGA Price" metric card (bonding curve, from /enterprise/stats)
- Add "Node Reward Pool" metric card
- Replace hardcoded TOTAL_SUPPLY_INITIAL with live data from /enterprise/stats
- Add formula tooltip: P = P₀ × (S₀ / S)

### No new backend needed
/enterprise/stats already returns everything required.

---

## What NOT to build

### 50k gas limit cap
Not worth it. ethers.js gas estimation is accurate for claimRewards().
A hardcoded cap risks failed transactions. The KMS-signed relayer pattern
(the real innovation) is already implemented.
