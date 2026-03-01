# Hazard Verification Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VIGIA Detection Mode                             │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │  Verification    │  │  Detection Node  │  │    Live Map      │     │
│  │     Panel        │  │  (VideoUploader) │  │  (Unverified)    │     │
│  │                  │  │                  │  │                  │     │
│  │  • Pending       │  │  • Upload Video  │  │  • Show Hazards  │     │
│  │  • Unverified    │  │  • ONNX Detect   │  │  • Real-time     │     │
│  │  • Verifying     │  │  • Send Batch    │  │  • Markers       │     │
│  │  • Verified      │  │                  │  │                  │     │
│  │  • Rejected      │  │                  │  │                  │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
│         ▲                      │                                        │
│         │                      │                                        │
│         │                      ▼                                        │
│         │              ┌──────────────┐                                │
│         │              │   Events     │                                │
│         │              │              │                                │
│         └──────────────┤ • detected   │                                │
│                        │ • submitted  │                                │
│                        └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ POST /telemetry
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         AWS Cloud Backend                                │
│                                                                          │
│  ┌──────────────────┐         ┌──────────────────┐                     │
│  │  API Gateway     │         │  Lambda          │                     │
│  │                  │────────▶│  Validator       │                     │
│  │  POST /telemetry │         │                  │                     │
│  │  GET /traces/:id │         └──────────────────┘                     │
│  └──────────────────┘                  │                               │
│                                        │ Write                          │
│                                        ▼                               │
│                          ┌──────────────────────┐                      │
│                          │  DynamoDB            │                      │
│                          │  Hazards Table       │                      │
│                          │                      │                      │
│                          │  • geohash (PK)      │                      │
│                          │  • timestamp (SK)    │                      │
│                          │  • hazardType        │                      │
│                          │  • lat, lon          │                      │
│                          │  • confidence        │                      │
│                          └──────────────────────┘                      │
│                                        │                               │
│                                        │ Stream                        │
│                                        ▼                               │
│                          ┌──────────────────────┐                      │
│                          │  Lambda              │                      │
│                          │  Orchestrator        │                      │
│                          │                      │                      │
│                          │  • Check Cooldown    │                      │
│                          │  • Invoke Agent      │                      │
│                          │  • Store Trace       │                      │
│                          └──────────────────────┘                      │
│                                        │                               │
│                                        │ Invoke                        │
│                                        ▼                               │
│                          ┌──────────────────────┐                      │
│                          │  Bedrock Agent       │                      │
│                          │  (Nova Lite)         │                      │
│                          │                      │                      │
│                          │  • Analyze Hazard    │                      │
│                          │  • Generate Reason   │                      │
│                          │  • Return Score      │                      │
│                          └──────────────────────┘                      │
│                                        │                               │
│                                        │ Write                         │
│                                        ▼                               │
│                          ┌──────────────────────┐                      │
│                          │  DynamoDB            │                      │
│                          │  Traces Table        │                      │
│                          │                      │                      │
│                          │  • traceId (PK)      │                      │
│                          │  • hazardId (GSI)    │                      │
│                          │  • reasoning         │                      │
│                          │  • score             │                      │
│                          └──────────────────────┘                      │
│                                        ▲                               │
│                                        │ Query                         │
│                                        │                               │
│  ┌──────────────────┐         ┌──────────────────┐                     │
│  │  API Gateway     │         │  Lambda          │                     │
│  │                  │────────▶│  Get Trace       │                     │
│  │  GET /traces/:id │         │                  │                     │
│  └──────────────────┘         └──────────────────┘                     │
│                                        │                               │
└────────────────────────────────────────┼───────────────────────────────┘
                                         │
                                         │ Poll (5s interval)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend Polling                                 │
│                                                                          │
│  HazardVerificationPanel.pollAgentTrace()                               │
│  • Retry every 5 seconds                                                │
│  • Max 20 attempts (100 seconds)                                        │
│  • Update status on success                                             │
│  • Remove hazard after verification                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Status Transition Flow

```
┌─────────────┐
│   PENDING   │  ← Hazard detected by ONNX
└──────┬──────┘
       │
       │ telemetry-submitted event
       ▼
┌─────────────┐
│ UNVERIFIED  │  ← Telemetry sent to backend
└──────┬──────┘
       │
       │ Start polling /traces/{hazardId}
       ▼
┌─────────────┐
│  VERIFYING  │  ← Waiting for agent trace
└──────┬──────┘
       │
       │ Agent trace received
       ▼
       ┌─────────────────┐
       │ Score ≥ 70?     │
       └────┬────────┬───┘
            │        │
       YES  │        │ NO
            ▼        ▼
    ┌──────────┐  ┌──────────┐
    │ VERIFIED │  │ REJECTED │
    └────┬─────┘  └────┬─────┘
         │             │
         │ 5s delay    │ 5s delay
         ▼             ▼
    ┌─────────────────────┐
    │  REMOVED (cleanup)  │
    └─────────────────────┘
```

## Event Flow Timeline

```
Time    Frontend                Backend                 Database
────────────────────────────────────────────────────────────────────
0ms     Video frame extracted
        ONNX detects pothole
        
100ms   emit('hazard-detected')
        Status: PENDING
        
5000ms  Batch telemetry ready
        POST /telemetry ────────▶ Validator Lambda
                                  Write to Hazards ────▶ DynamoDB
        
5100ms  emit('telemetry-submitted')
        Status: UNVERIFIED
        Start polling
        
5200ms  GET /traces/{id} ───────▶ Get Trace Lambda
                                  Query Traces ────────▶ DynamoDB
                                  ◀──── 404 (not ready)
        
10200ms GET /traces/{id} ───────▶ Get Trace Lambda
                                  Query Traces ────────▶ DynamoDB
                                  ◀──── 404 (not ready)
        
        [Meanwhile...]
                                  Stream trigger ───────▶ Orchestrator
                                  Invoke Bedrock ──────▶ Nova Lite
                                  ◀──── Reasoning + Score
                                  Write Trace ──────────▶ DynamoDB
        
15200ms GET /traces/{id} ───────▶ Get Trace Lambda
                                  Query Traces ────────▶ DynamoDB
                                  ◀──── 200 (trace found)
        
        Status: VERIFIED
        Display reasoning
        
20200ms Auto-remove hazard
        Status: REMOVED
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DetectionModeView                             │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ Verification Panel │  │ VideoUploader  │  │   LiveMap    │  │
│  │                    │  │                │  │              │  │
│  │ useEffect(() => {  │  │ processFrame() │  │ Display      │  │
│  │   listen(          │  │   ↓            │  │ markers      │  │
│  │     'detected'     │◀─┼───emit()       │  │              │  │
│  │   )                │  │                │  │              │  │
│  │ })                 │  │ sendBatch()    │  │              │  │
│  │                    │  │   ↓            │  │              │  │
│  │ useEffect(() => {  │  │   emit()       │  │              │  │
│  │   listen(          │◀─┼───'submitted' │  │              │  │
│  │     'submitted'    │  │                │  │              │  │
│  │   )                │  │                │  │              │  │
│  │   ↓                │  │                │  │              │  │
│  │   pollTrace()      │  │                │  │              │  │
│  │ })                 │  │                │  │              │  │
│  └────────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### Hazard (Frontend)
```typescript
interface Hazard {
  id: string;                    // "POTHOLE-2026-03-01T14:00:00.000Z"
  type: string;                  // "POTHOLE"
  lat: number;                   // 22.2604
  lon: number;                   // 84.8536
  confidence: number;            // 0.85
  timestamp: string;             // ISO 8601
  status: HazardStatus;          // "pending" | "unverified" | ...
  traceId?: string;              // "trace-123"
  reasoning?: string;            // Agent reasoning text
  verificationScore?: number;    // 0-100
}
```

### Agent Trace (Backend)
```typescript
interface AgentTrace {
  traceId: string;               // PK: "trace-123"
  hazardId: string;              // GSI: "POTHOLE-2026-03-01T14:00:00.000Z"
  reasoning: string;             // "Verified pothole with..."
  verificationScore: number;     // 85
  createdAt: string;             // ISO 8601
  ttl?: number;                  // Unix timestamp for auto-deletion
}
```

## Configuration

### Polling Parameters
```typescript
const POLL_INTERVAL = 5000;      // 5 seconds
const MAX_ATTEMPTS = 20;         // 100 seconds total
const REMOVAL_DELAY = 5000;      // 5 seconds after verification
```

### Verification Thresholds
```typescript
const VERIFIED_THRESHOLD = 70;   // Score ≥ 70 = verified
const REJECTED_THRESHOLD = 70;   // Score < 70 = rejected
```

### Panel Widths
```typescript
const LEFT_WIDTH = 20;           // 20% (15-35% range)
const CENTER_WIDTH = 45;         // 45% (30-60% range)
const RIGHT_WIDTH = 35;          // 35% (flexible)
```
