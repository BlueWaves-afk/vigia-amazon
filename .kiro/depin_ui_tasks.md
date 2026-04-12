# VIGIA DePIN UI Tasks

## Phase A — Driver Copilot (Detection Group)

- [x] Create `.kiro/ui-portal-spec.md`
- [x] Create `packages/frontend/app/lib/constants.ts`
- [x] Create `packages/frontend/app/lib/contract.ts`
- [x] Create `packages/backend/functions/rewards-balance/index.ts` (GET /rewards-balance)
- [x] Wire `/rewards-balance` route in CDK innovation stack + deployed ✅
- [x] Create `packages/frontend/app/components/RewardsWidget.tsx`
- [x] Integrate `<RewardsWidget>` into `DetectionModeView.tsx`

## Phase B — Enterprise BME Console (New Activity Group)

- [x] Create `packages/frontend/app/components/EnterpriseDashboard.tsx`
- [x] Add `Flame` icon + `enterprise` ActivityBtn to `Sidebar.tsx`
- [x] Add `enterprise` to activity type union in `Sidebar.tsx` + `page.tsx`
- [x] Import + render `<EnterpriseDashboard>` in `page.tsx`
- [x] Hide tab bar / file tree for enterprise activity (same as network/maintenance)
- [x] Fix tsconfig target ES2017 → ES2020 for BigInt literals
- [x] Add Burn History Feed (last 10 DataCreditsPurchased events from contract logs)
- [x] Build passes ✅

## Phase C — Global Network Explorer (Network Group Update)

- [x] Create `packages/frontend/app/components/GlobalNetworkExplorer.tsx`
- [x] Add `activeTab` state to `NetworkMapView.tsx`
- [x] Replace "Network Surveillance" title with two-tab bar (`Network Surveillance` | `Global Explorer`)
- [x] Render `<GlobalNetworkExplorer>` when explorer tab active, map when surveillance tab active
- [x] Stats row hidden when on explorer tab
- [x] Build passes ✅
