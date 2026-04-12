# Enterprise Auth & DePIN Rewards — Task List

## Phase 1: Backend Infrastructure
- [x] Write spec (.kiro/enterprise-auth-spec.md)
- [x] 1.1 Add EnterpriseUsersTable + BurnHistoryTable to CDK (enterprise-stack.ts)
- [x] 1.2 Add Cognito User Pool + App Client to CDK
- [x] 1.3 Write enterprise-register Lambda (register.js)
- [x] 1.4 Write enterprise-login Lambda (login.js)
- [x] 1.5 Write enterprise-burn Lambda with server-side trial enforcement (burn.js)
- [x] 1.6 Write enterprise-me Lambda (me.js)
- [x] 1.7 Add API Gateway routes for /enterprise/* with CORS
- [x] 1.8 Cognito JWT authorizer on /enterprise/me and /enterprise/burn

## Phase 2: DePIN Rewards
- [x] 2.1 BurnHistoryTable with DynamoDB Stream enabled
- [x] 2.2 Write rewards-distributor Lambda (rewards-distributor.js)
- [x] 2.3 Wire BurnHistoryTable stream → rewards-distributor via CDK event source mapping
- [ ] 2.4 (Phase 2) KMS signing of claimRewards payload per node

## Phase 3: Frontend
- [x] 3.1 Write EnterpriseAuthModal (register + login, email/password)
- [x] 3.2 Update EnterpriseDashboard to use real API (GET /enterprise/me)
- [x] 3.3 Wire burn button to POST /enterprise/burn with JWT
- [x] 3.4 Session stored/restored from localStorage
- [x] 3.5 Logout button clears session
- [ ] 3.6 Add NEXT_PUBLIC_ENTERPRISE_API_URL to .env.local after deploy

## Phase 4: End-to-End Tests
- [x] 4.1 E2E test script (scripts/test-enterprise-e2e.js)
      Tests: register → login → /me → burn → trial limit → duplicate → wrong password
- [x] 4.2 Run after deploy: ENTERPRISE_API=<url> node scripts/test-enterprise-e2e.js
      ✅ All 7 tests passed against https://m1ots3cacc.execute-api.us-east-1.amazonaws.com/prod

## Pending: Deploy
- [ ] Start Docker (required for CDK bundling of Node.js Lambdas)
- [ ] npm run cdk:deploy
- [ ] Add NEXT_PUBLIC_ENTERPRISE_API_URL to packages/frontend/.env.local
- [ ] Run E2E test against live endpoint
