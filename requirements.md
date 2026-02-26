# VIGIA: System Requirements Specification
**Project**: Sentient Road Infrastructure System  
**Competition**: Amazon 10,000 AIdeas (Semi-Finalist)  
**Notation**: EARS (Easy Approach to Requirements Syntax)  
**Version**: 1.0  
**Date**: 2026-02-26

---

## 1. Functional Requirements

### 1.1 Edge Telemetry Generation (Zone 1)

**REQ-1.1.1**: WHEN a user uploads dashcam video footage, THE SYSTEM SHALL extract frames at 5 FPS and pass them to a dedicated Web Worker for processing.

**REQ-1.1.2**: WHEN a video frame is received by the Web Worker, THE SYSTEM SHALL perform object detection using YOLOv8-nano via ONNX Runtime Web to identify road hazards (potholes, debris, accidents).

**REQ-1.1.3**: IF a hazard is detected with confidence ≥ 0.6, THE SYSTEM SHALL generate a telemetry payload containing:
- Hazard type (enum: POTHOLE, DEBRIS, ACCIDENT, ANIMAL)
- Simulated GPS coordinates (latitude, longitude)
- Timestamp (ISO 8601 UTC)
- Confidence score (0.0–1.0)

**REQ-1.1.4**: WHEN a telemetry payload is generated, THE SYSTEM SHALL cryptographically sign it using the Web Crypto API (ECDSA P-256) within the Web Worker before transmission.

**REQ-1.1.5**: IF the user activates the Privacy Toggle, THE SYSTEM SHALL apply a client-side blur filter to faces and license plates in the video frames before any AI processing occurs.

**REQ-1.1.6**: WHEN telemetry payloads are ready for transmission, THE SYSTEM SHALL batch detections from a 5-second window and send a single HTTP POST request to the ingestion endpoint.

### 1.2 Ingestion & Validation (Zone 2)

**REQ-1.2.1**: WHEN the API Gateway receives a telemetry POST request, THE SYSTEM SHALL invoke a Lambda function to validate the payload schema (JSON Schema v7).

**REQ-1.2.2**: IF the cryptographic signature is invalid or the payload is malformed, THE SYSTEM SHALL reject the request with HTTP 400 and log the rejection reason.

**REQ-1.2.3**: WHEN a payload passes validation, THE SYSTEM SHALL compute a geohash (precision 7) from the GPS coordinates and write the record to DynamoDB with:
- Partition Key: `geohash`
- Sort Key: `timestamp`
- Attributes: `hazardType`, `lat`, `lon`, `confidence`, `signature`

### 1.3 Intelligence Layer (Zone 3)

**REQ-1.3.1**: WHEN a new hazard record is written to DynamoDB, THE SYSTEM SHALL check a cooldown table (TTL=300s) to determine if this geohash+hazardType combination was recently processed.

**REQ-1.3.2**: IF the hazard is NOT in the cooldown table, THE SYSTEM SHALL invoke the Bedrock Agent (Nova Lite) to execute the Auditor and Strategist reasoning loops.

**REQ-1.3.3**: WHEN the Bedrock Agent is invoked, THE SYSTEM SHALL:
- **Auditor Agent**: Query DynamoDB for similar hazards within 500m radius in the past 24 hours to calculate a verification score (0–100)
- **Strategist Agent**: Determine if the hazard requires immediate alert broadcast or passive logging

**REQ-1.3.4**: WHEN the Agent reasoning completes, THE SYSTEM SHALL store the reasoning trace (Thought→Action→Observation) in DynamoDB with a `traceId` linked to the original hazard record.

**REQ-1.3.5**: IF the verification score ≥ 70, THE SYSTEM SHALL mark the hazard as "verified" and trigger the DePIN ledger write.

### 1.4 Trust Layer (Zone 4)

**REQ-1.4.1**: WHEN a hazard is verified, THE SYSTEM SHALL write an append-only record to the DePIN ledger table in DynamoDB containing:
- `contributorId` (anonymized hash)
- `hazardId` (reference to Zone 3 record)
- `credits` (integer reward value)
- `previousHash` (SHA-256 of prior ledger entry)
- `currentHash` (SHA-256 of current entry + previousHash)

**REQ-1.4.2**: WHEN a new ledger entry is written, THE SYSTEM SHALL use a DynamoDB Stream to trigger a Lambda function that validates the hash chain integrity.

**REQ-1.4.3**: IF the hash chain is broken (currentHash does not match computed hash), THE SYSTEM SHALL raise a critical alert and halt further ledger writes.

### 1.5 Visualization & Routing (Zone 5)

**REQ-1.5.1**: WHEN a user requests a route from point A to point B, THE SYSTEM SHALL call Amazon Location Service once to retrieve the base route polyline.

**REQ-1.5.2**: WHEN the base route is received, THE SYSTEM SHALL:
- Decode the polyline into lat/lon coordinates
- Generate geohashes for points along the route (every 100m)
- Query DynamoDB for verified hazards matching those geohashes

**REQ-1.5.3**: WHEN hazards are retrieved, THE SYSTEM SHALL render the route on MapLibre GL JS with segments colored:
- **Red**: Within 50m of a verified hazard
- **Green**: No hazards detected

**REQ-1.5.4**: WHEN the map is displayed, THE SYSTEM SHALL overlay hazard markers with icons corresponding to hazard type and a tooltip showing verification score.

**REQ-1.5.5**: WHEN the DePIN ledger updates, THE SYSTEM SHALL display a scrolling ticker at the bottom of the UI showing recent verified contributions (e.g., "Contributor #842 earned 5 credits for Pothole").

---

## 2. Non-Functional Requirements

### 2.1 Performance

**REQ-2.1.1**: THE SYSTEM SHALL process video frames in the Web Worker without blocking the main UI thread (target: <16ms main thread tasks).

**REQ-2.1.2**: THE SYSTEM SHALL complete YOLOv8-nano inference on a 640×640 frame within 200ms on a mid-range laptop (Intel i5 or equivalent).

**REQ-2.1.3**: THE SYSTEM SHALL respond to API Gateway requests within 500ms (p95 latency).

**REQ-2.1.4**: THE SYSTEM SHALL render map tiles and route overlays within 1 second of user interaction.

### 2.2 Scalability

**REQ-2.2.1**: THE SYSTEM SHALL support up to 10,000 concurrent users during the community voting phase (March 13–20, 2026) without exceeding AWS Free Tier limits.

**REQ-2.2.2**: THE SYSTEM SHALL use DynamoDB on-demand billing to auto-scale read/write capacity during traffic spikes.

**REQ-2.2.3**: THE SYSTEM SHALL implement exponential backoff with jitter for Lambda retries on DynamoDB throttling errors.

### 2.3 Cost Constraints

**REQ-2.3.1**: THE SYSTEM SHALL operate within the AWS Free Tier for all services during the hackathon phase.

**REQ-2.3.2**: THE SYSTEM SHALL NOT exceed $200 in AWS credits during the community voting phase (March 13–20, 2026).

**REQ-2.3.3**: IF Bedrock API costs approach $50, THE SYSTEM SHALL automatically switch to serving pre-cached Agent reasoning traces from S3.

### 2.4 Security & Privacy

**REQ-2.4.1**: THE SYSTEM SHALL NOT transmit raw video frames to the backend; only JSON telemetry payloads SHALL be sent.

**REQ-2.4.2**: THE SYSTEM SHALL use HTTPS (TLS 1.3) for all API Gateway communication.

**REQ-2.4.3**: THE SYSTEM SHALL validate all cryptographic signatures using the public key stored in AWS Secrets Manager.

**REQ-2.4.4**: THE SYSTEM SHALL anonymize contributor IDs using SHA-256 hashing before writing to the DePIN ledger.

### 2.5 Reliability

**REQ-2.5.1**: THE SYSTEM SHALL achieve 99.5% uptime during the voting phase (maximum 36 minutes downtime over 7 days).

**REQ-2.5.2**: THE SYSTEM SHALL implement dead-letter queues (DLQ) for failed Lambda invocations with automatic retry after 5 minutes.

**REQ-2.5.3**: THE SYSTEM SHALL log all errors to CloudWatch Logs with structured JSON format for debugging.

---

## 3. Web Worker Architecture Requirements

### 3.1 Thread Isolation

**REQ-3.1.1**: THE SYSTEM SHALL execute all AI inference operations (YOLOv8 ONNX) exclusively within a dedicated Web Worker thread.

**REQ-3.1.2**: THE SYSTEM SHALL execute all cryptographic signing operations (Web Crypto API) exclusively within the Web Worker thread.

**REQ-3.1.3**: THE SYSTEM SHALL NOT perform any blocking operations (>16ms) on the main UI thread during video processing.

### 3.2 Communication Protocol

**REQ-3.2.1**: WHEN the main thread sends a video frame to the Web Worker, THE SYSTEM SHALL use transferable objects (ArrayBuffer) to avoid memory copying overhead.

**REQ-3.2.2**: WHEN the Web Worker completes inference, THE SYSTEM SHALL post a message to the main thread containing only the telemetry payload (not the raw frame).

**REQ-3.2.3**: THE SYSTEM SHALL use the `comlink` library to provide async/await syntax for Worker↔Main thread communication.

### 3.3 Resource Management

**REQ-3.3.1**: WHEN the ONNX model is loaded, THE SYSTEM SHALL cache it in the Web Worker memory for the duration of the session.

**REQ-3.3.2**: WHEN video processing is paused or stopped, THE SYSTEM SHALL terminate the Web Worker and release GPU/CPU resources.

**REQ-3.3.3**: IF the Web Worker crashes or becomes unresponsive, THE SYSTEM SHALL restart it automatically and notify the user via a toast message.

---

## 4. Acceptance Criteria

**AC-1**: A user can upload a 60-second dashcam video, and the UI remains responsive (no frame drops) during AI processing.

**AC-2**: The system detects at least 3 hazards in a test video with ≥0.6 confidence and displays them on the map.

**AC-3**: The Bedrock Agent reasoning trace is visible in the UI within 3 seconds of hazard detection.

**AC-4**: The DePIN ledger displays at least 10 verified contributions with valid hash chain integrity.

**AC-5**: A route from point A to point B is rendered with red/green segments based on hazard proximity within 2 seconds.

**AC-6**: The system operates for 7 days during the voting phase without exceeding $200 in AWS costs.

---

## 5. Out of Scope (Phase 1)

- Real-time GPS integration with mobile devices
- Multi-user collaboration features
- Historical hazard analytics dashboard
- Integration with municipal road maintenance APIs
- Production-grade authentication (AWS Cognito)
