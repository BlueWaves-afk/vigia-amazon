# Hazard Verification Pipeline Implementation

## Overview

Implemented a complete hazard verification pipeline that replaces the explorer component in the end-to-end live demo (detection mode) with a real-time hazard verification panel. The system tracks hazards through their lifecycle: detection → telemetry submission → cloud verification → removal.

## Architecture

### Frontend Components

#### 1. HazardVerificationPanel (`app/components/HazardVerificationPanel.tsx`)
- **Purpose**: Displays real-time hazard verification pipeline
- **Features**:
  - Lists detected hazards with status badges (pending, unverified, verifying, verified, rejected)
  - Expandable hazard details showing confidence, timestamp, verification score, and agent reasoning
  - Footer stats showing counts for pending, verifying, and verified hazards
  - Auto-removes verified/rejected hazards after 5 seconds
  - Polls agent trace API every 5 seconds (max 20 attempts = 100 seconds)

#### 2. DetectionModeView Updates (`app/components/DetectionModeView.tsx`)
- **Layout**: Three-panel layout with resizable dividers
  - Left: HazardVerificationPanel (20% width, 15-35% range)
  - Center: Detection Node / VideoUploader (45% width, 30-60% range)
  - Right: Live Map (35% width, flexible)
- **Interaction**: Independent resize handles for each panel

#### 3. VideoUploader Updates (`app/components/VideoUploader.tsx`)
- **Event Emissions**:
  - `hazard-detected`: Emitted when ONNX model detects a hazard
    - Payload: `{ type, lat, lon, confidence, timestamp }`
  - `telemetry-submitted`: Emitted after batch telemetry is sent to backend
    - Payload: `{ hazardIds: string[] }`

### Backend Components

#### 1. Agent Trace API (`packages/backend/src/traces/get-by-hazard.ts`)
- **Endpoint**: `GET /traces/{hazardId}`
- **Purpose**: Fetch agent verification trace for a specific hazard
- **Responses**:
  - `200`: Trace found with reasoning and verification score
  - `404`: Trace not found (agent hasn't processed yet)
  - `400`: Missing hazardId parameter
  - `500`: Internal server error

#### 2. DynamoDB GSI
- **Table**: AgentTracesTable
- **GSI**: HazardIdIndex
  - Partition Key: `hazardId` (STRING)
  - Sort Key: `createdAt` (STRING)
  - Projection: ALL
- **Purpose**: Enable efficient querying of traces by hazard ID

### Infrastructure Updates

#### CDK Changes (`packages/infrastructure/lib/stacks/`)

1. **intelligence-stack.ts**:
   - Added GSI to traces table for hazardId queries
   
2. **ingestion-stack.ts**:
   - Added Lambda function for GET /traces/{hazardId}
   - Added API Gateway route
   - Granted read permissions to traces table

## Data Flow

```
1. User uploads video → VideoUploader
2. ONNX detects hazard → Emit 'hazard-detected' event
3. HazardVerificationPanel receives event → Add hazard with status 'pending'
4. VideoUploader batches telemetry (5s interval) → Send to /telemetry
5. VideoUploader emits 'telemetry-submitted' event
6. HazardVerificationPanel receives event → Update status to 'unverified'
7. HazardVerificationPanel starts polling GET /traces/{hazardId}
8. Lambda Orchestrator processes hazard → Invokes Bedrock Agent
9. Bedrock Agent returns reasoning + score → Stored in traces table
10. HazardVerificationPanel receives trace → Update status to 'verified' or 'rejected'
11. After 5 seconds → Remove hazard from list
```

## Hazard Status Lifecycle

```
PENDING (yellow)
  ↓ (telemetry submitted)
UNVERIFIED (yellow)
  ↓ (polling started)
VERIFYING (blue, spinner)
  ↓ (agent trace received)
VERIFIED (green, score ≥ 70) OR REJECTED (red, score < 70)
  ↓ (5 second delay)
REMOVED (auto-cleanup)
```

## Testing

### Frontend Tests (`__tests__/HazardVerificationPanel.test.tsx`)
- ✅ Empty state rendering
- ✅ Hazard detection event handling
- ✅ Telemetry submission event handling
- ✅ Status transitions
- ✅ Agent trace polling with retries
- ✅ Verification score thresholds (≥70 = verified, <70 = rejected)
- ✅ Expandable hazard details with reasoning
- ✅ Footer stats updates
- ✅ Error handling

### Backend Tests (`__tests__/traces-get-by-hazard.test.ts`)
- ✅ Missing hazardId parameter (400)
- ✅ Trace not found (404)
- ✅ Successful trace retrieval (200)
- ✅ DynamoDB query parameters validation
- ✅ Most recent trace selection
- ✅ Error handling (500)
- ✅ CORS headers
- ✅ Special characters in hazardId

## Design Compliance

### Monochrome IDE Theme
- Background: `#141920` (dark bg)
- Panel: `#1E2530` (elevated surfaces)
- Border: `rgba(255,255,255,0.07)` (1px solid)
- Text: `#DDE3ED` (primary), `#7C8799` (secondary), `#3D4655` (muted)
- Accent colors (minimal use):
  - Blue: `#3B82F6` (verifying)
  - Green: `#0EA472` (verified)
  - Red: `#E5484D` (rejected)
  - Yellow: `#E9A23B` (pending/unverified)

### Typography
- UI elements: Inter font
- Data elements: JetBrains Mono font
- Font sizes: 0.6rem - 0.82rem

### Interactions
- Hover states: `rgba(255,255,255,0.03)` background
- Transitions: 150ms ease-in-out
- Expandable cards with chevron icons
- Status badges with color-coded backgrounds

## API Integration

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod
```

### API Endpoints Used
- `POST /telemetry` - Submit hazard telemetry
- `GET /traces/{hazardId}` - Fetch agent verification trace

## Performance Considerations

1. **Polling Strategy**:
   - 5-second intervals to avoid rate limiting
   - Maximum 20 attempts (100 seconds total)
   - Exponential backoff not needed (fixed interval sufficient)

2. **Auto-Cleanup**:
   - Verified/rejected hazards removed after 5 seconds
   - Prevents memory leaks from accumulating hazards

3. **Event-Driven Architecture**:
   - Decoupled components via custom events
   - No prop drilling or context pollution

## Future Enhancements

1. **WebSocket Integration**:
   - Replace polling with WebSocket for real-time trace updates
   - Reduce API calls and improve responsiveness

2. **Hazard Grouping**:
   - Group similar hazards by location (geohash clustering)
   - Reduce visual clutter in verification panel

3. **Verification History**:
   - Add "History" tab to view past verifications
   - Enable replay of agent reasoning

4. **Confidence Threshold Tuning**:
   - Allow users to adjust verification score threshold
   - Filter hazards by confidence level

5. **Export Functionality**:
   - Export verification results as CSV/JSON
   - Generate verification reports

## Deployment Checklist

- [ ] Deploy CDK infrastructure changes
  ```bash
  cd packages/infrastructure
  npm run cdk:deploy
  ```

- [ ] Verify GSI creation on AgentTracesTable
  ```bash
  aws dynamodb describe-table --table-name AgentTracesTable-* --query "Table.GlobalSecondaryIndexes"
  ```

- [ ] Test API endpoint
  ```bash
  curl https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod/traces/test-hazard-id
  ```

- [ ] Run frontend tests
  ```bash
  cd packages/frontend
  npm test HazardVerificationPanel
  ```

- [ ] Run backend tests
  ```bash
  cd packages/backend
  npm test traces-get-by-hazard
  ```

- [ ] Test end-to-end flow in browser
  1. Upload dashcam video
  2. Verify hazards appear in verification panel
  3. Wait for telemetry submission
  4. Verify status changes to "verifying"
  5. Wait for agent trace
  6. Verify status changes to "verified" or "rejected"
  7. Verify hazard is removed after 5 seconds

## Files Modified/Created

### Created
- `packages/frontend/app/components/HazardVerificationPanel.tsx`
- `packages/frontend/__tests__/HazardVerificationPanel.test.tsx`
- `packages/backend/src/traces/get-by-hazard.ts`
- `packages/backend/__tests__/traces-get-by-hazard.test.ts`
- `HAZARD_VERIFICATION_IMPLEMENTATION.md` (this file)

### Modified
- `packages/frontend/app/components/DetectionModeView.tsx`
- `packages/frontend/app/components/VideoUploader.tsx`
- `packages/infrastructure/lib/stacks/intelligence-stack.ts`
- `packages/infrastructure/lib/stacks/ingestion-stack.ts`
- `tasks_ui.md`

## Conclusion

The hazard verification pipeline is now fully implemented and tested. The system provides real-time visibility into the AI verification process, showing users exactly how their detected hazards are being processed by the cloud agent. The monochrome IDE design maintains consistency with the rest of the VIGIA RoadIntelligence IDE while providing clear visual feedback through status badges and expandable details.
