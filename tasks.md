# VIGIA: Implementation Task Plan
**Project**: Sentient Road Infrastructure System  
**Competition**: Amazon 10,000 AIdeas (Semi-Finalist)  
**Strategy**: Thin-Thread MVP → Incremental Feature Expansion  
**Version**: 1.0  
**Date**: 2026-02-26

---

## Implementation Philosophy

**Thin-Thread MVP**: Build a complete vertical slice from video upload to cloud verification before expanding horizontally. This ensures we have a working demo early and can iterate based on testing.

**Dependency-First Sequencing**: Start with infrastructure (Zone 2) before frontend (Zone 1) to enable immediate integration testing.

**Property-Based Testing**: Use PBT to verify EARS requirements with generated test cases, not just happy-path examples.

---

## Phase 0: Project Scaffolding (Day 1)

### TASK-0.1: Repository Setup
**Priority**: P0 (Blocker)  
**Estimated Time**: 2 hours  
**Dependencies**: None

**Subtasks**:
- [ ] Initialize monorepo structure with npm workspaces
  ```
  vigia-amazon/
  ├── packages/
  │   ├── frontend/          # Next.js app
  │   ├── backend/           # Lambda functions
  │   ├── infrastructure/    # AWS CDK
  │   └── shared/            # Shared types/utils
  ├── docs/
  ├── tests/
  └── package.json
  ```
- [ ] Configure TypeScript with strict mode for all packages
- [ ] Set up ESLint + Prettier with shared config
- [ ] Create `.env.example` with required environment variables
- [ ] Initialize Git with `.gitignore` (node_modules, .env, cdk.out)

**Acceptance Criteria**:
- `npm install` succeeds in root directory
- `npm run lint` passes with no errors
- All packages can import from `@vigia/shared`

---

### TASK-0.2: AWS CDK Infrastructure Skeleton
**Priority**: P0 (Blocker)  
**Estimated Time**: 3 hours  
**Dependencies**: TASK-0.1  
**Requirements**: Foundation for all backend tasks

**Subtasks**:
- [ ] Install AWS CDK v2 and initialize app: `cdk init app --language=typescript`
- [ ] Create stack structure:
  ```typescript
  // lib/vigia-stack.ts
  export class VigiaStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
      super(scope, id, props);
      
      // Placeholder constructs (will be populated in later tasks)
      const ingestionStack = new IngestionStack(this, 'Ingestion');
      const intelligenceStack = new IntelligenceStack(this, 'Intelligence');
      const trustStack = new TrustStack(this, 'Trust');
      const visualizationStack = new VisualizationStack(this, 'Visualization');
    }
  }
  ```
- [ ] Configure CDK context for dev/prod environments
- [ ] Set up CDK deployment script: `npm run cdk:deploy`
- [ ] Bootstrap CDK in target AWS account: `cdk bootstrap`

**Acceptance Criteria**:
- `cdk synth` generates CloudFormation template without errors
- `cdk deploy` creates empty stack in AWS account
- Stack outputs are visible in CloudFormation console

---

## Phase 1: Zone 2 - Ingestion Funnel (Days 2-3)

### TASK-1.1: DynamoDB Hazards Table
**Priority**: P0 (Blocker)  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-0.2  
**Requirements**: REQ-1.2.3

**Subtasks**:
- [ ] Define DynamoDB table construct in CDK:
  ```typescript
  const hazardsTable = new Table(this, 'HazardsTable', {
    partitionKey: { name: 'geohash', type: AttributeType.STRING },
    sortKey: { name: 'timestamp', type: AttributeType.STRING },
    billingMode: BillingMode.ON_DEMAND,
    stream: StreamViewType.NEW_AND_OLD_IMAGES,
    timeToLiveAttribute: 'ttl',
    removalPolicy: RemovalPolicy.DESTROY, // Dev only
  });
  
  hazardsTable.addGlobalSecondaryIndex({
    indexName: 'status-timestamp-index',
    partitionKey: { name: 'status', type: AttributeType.STRING },
    sortKey: { name: 'timestamp', type: AttributeType.STRING },
    projectionType: ProjectionType.ALL,
  });
  ```
- [ ] Export table name and ARN as stack outputs
- [ ] Deploy and verify table creation in DynamoDB console

**Acceptance Criteria**:
- Table exists with correct partition/sort keys
- GSI `status-timestamp-index` is active
- TTL attribute is configured
- DynamoDB Stream is enabled

**Testing** (PBT):
- [ ] Generate random geohash strings (precision 7) and verify table accepts them
- [ ] Generate timestamps in various ISO 8601 formats and verify parsing

---

### TASK-1.2: API Gateway REST Endpoint
**Priority**: P0 (Blocker)  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-0.2  
**Requirements**: REQ-1.2.1

**Subtasks**:
- [ ] Create API Gateway construct in CDK:
  ```typescript
  const api = new RestApi(this, 'VigiaAPI', {
    restApiName: 'VIGIA Telemetry API',
    description: 'Ingestion endpoint for hazard telemetry',
    deployOptions: {
      stageName: 'prod',
      throttlingRateLimit: 100,
      throttlingBurstLimit: 200,
    },
    defaultCorsPreflightOptions: {
      allowOrigins: Cors.ALL_ORIGINS, // Restrict in prod
      allowMethods: Cors.ALL_METHODS,
    },
  });
  ```
- [ ] Create `/telemetry` resource with POST method
- [ ] Configure request validation with JSON Schema model:
  ```typescript
  const telemetryModel = api.addModel('TelemetryModel', {
    contentType: 'application/json',
    schema: {
      type: JsonSchemaType.OBJECT,
      required: ['hazardType', 'lat', 'lon', 'timestamp', 'confidence', 'signature'],
      properties: {
        hazardType: { type: JsonSchemaType.STRING, enum: ['POTHOLE', 'DEBRIS', 'ACCIDENT', 'ANIMAL'] },
        lat: { type: JsonSchemaType.NUMBER, minimum: -90, maximum: 90 },
        lon: { type: JsonSchemaType.NUMBER, minimum: -180, maximum: 180 },
        timestamp: { type: JsonSchemaType.STRING, format: 'date-time' },
        confidence: { type: JsonSchemaType.NUMBER, minimum: 0, maximum: 1 },
        signature: { type: JsonSchemaType.STRING },
      },
    },
  });
  ```
- [ ] Export API endpoint URL as stack output

**Acceptance Criteria**:
- API Gateway endpoint is accessible via HTTPS
- POST to `/telemetry` returns 400 for invalid JSON
- CORS headers are present in OPTIONS response

**Testing** (PBT):
- [ ] Generate random valid telemetry payloads and verify 200 response (after Lambda integration)
- [ ] Generate invalid payloads (missing fields, out-of-range values) and verify 400 response

---

### TASK-1.3: Secrets Manager for Public Key
**Priority**: P0 (Blocker)  
**Estimated Time**: 1 hour  
**Dependencies**: TASK-0.2  
**Requirements**: REQ-2.4.3

**Subtasks**:
- [ ] Generate ECDSA P-256 key pair locally:
  ```bash
  openssl ecparam -name prime256v1 -genkey -noout -out private-key.pem
  openssl ec -in private-key.pem -pubout -out public-key.pem
  ```
- [ ] Store public key in Secrets Manager via CDK:
  ```typescript
  const publicKeySecret = new Secret(this, 'PublicKeySecret', {
    secretName: 'vigia-public-key',
    description: 'ECDSA P-256 public key for telemetry signature verification',
    secretStringValue: SecretValue.unsafePlainText(publicKeyPem), // Load from file
  });
  ```
- [ ] Store private key securely (NOT in repo) for frontend testing
- [ ] Export secret ARN as stack output

**Acceptance Criteria**:
- Secret exists in Secrets Manager console
- Secret value contains valid PEM-encoded public key
- Private key is stored in password manager (not committed to Git)

---

### TASK-1.4: Lambda Validator Function
**Priority**: P0 (Blocker)  
**Estimated Time**: 4 hours  
**Dependencies**: TASK-1.1, TASK-1.2, TASK-1.3  
**Requirements**: REQ-1.2.1, REQ-1.2.2, REQ-1.2.3

**Subtasks**:
- [ ] Create Lambda function in `packages/backend/src/validator/index.ts`:
  ```typescript
  import { APIGatewayProxyHandler } from 'aws-lambda';
  import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
  import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
  import { createVerify } from 'crypto';
  import ngeohash from 'ngeohash';
  
  const dynamodb = new DynamoDBClient({});
  const secretsManager = new SecretsManagerClient({});
  let cachedPublicKey: string | null = null;
  
  export const handler: APIGatewayProxyHandler = async (event) => {
    // Parse and validate payload
    const payload = JSON.parse(event.body || '{}');
    
    // Verify signature
    const publicKey = await getPublicKey();
    const isValid = verifySignature(payload, publicKey);
    if (!isValid) {
      return { statusCode: 400, body: JSON.stringify({ error: 'INVALID_SIGNATURE' }) };
    }
    
    // Compute geohash
    const geohash = ngeohash.encode(payload.lat, payload.lon, 7);
    
    // Write to DynamoDB
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.HAZARDS_TABLE_NAME,
      Item: {
        geohash: { S: geohash },
        timestamp: { S: payload.timestamp },
        hazardType: { S: payload.hazardType },
        lat: { N: payload.lat.toString() },
        lon: { N: payload.lon.toString() },
        confidence: { N: payload.confidence.toString() },
        signature: { S: payload.signature },
        status: { S: 'pending' },
        ttl: { N: (Math.floor(Date.now() / 1000) + 86400 * 30).toString() },
      },
    }));
    
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  };
  ```
- [ ] Add Lambda construct to CDK with environment variables
- [ ] Grant Lambda permissions: DynamoDB PutItem, Secrets Manager GetSecretValue
- [ ] Integrate Lambda with API Gateway POST method
- [ ] Deploy and test with curl

**Acceptance Criteria**:
- Lambda function deploys successfully
- POST to `/telemetry` with valid signature returns 200
- POST with invalid signature returns 400
- DynamoDB table contains new hazard record after successful POST

**Testing** (PBT):
- [ ] Use `fast-check` to generate 1000 random valid payloads and verify all succeed
- [ ] Generate payloads with corrupted signatures and verify all fail
- [ ] Test geohash computation with boundary coordinates (poles, antimeridian)

---

## Phase 2: Zone 1 - Web Worker Scaffolding (Days 3-4)

### TASK-2.1: Next.js Frontend Setup
**Priority**: P0 (Blocker)  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-0.1  
**Requirements**: REQ-1.1.1

**Subtasks**:
- [ ] Initialize Next.js 14 with App Router in `packages/frontend`:
  ```bash
  npx create-next-app@latest frontend --typescript --tailwind --app
  ```
- [ ] Configure Tailwind with dark mode and Kiro-inspired design tokens:
  ```javascript
  // tailwind.config.js
  module.exports = {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          'vigia-dark': '#0a0a0a',
          'vigia-panel': '#1a1a1a',
          'vigia-accent': '#3b82f6',
          'vigia-danger': '#ef4444',
          'vigia-success': '#10b981',
        },
      },
    },
  };
  ```
- [ ] Create 4-zone dashboard layout in `app/page.tsx`:
  ```tsx
  export default function Dashboard() {
    return (
      <div className="h-screen bg-vigia-dark grid grid-cols-4 grid-rows-[1fr_80px]">
        <div className="col-span-1 bg-vigia-panel p-4">{/* Zone A: Sentinel Eye */}</div>
        <div className="col-span-1 bg-vigia-panel p-4">{/* Zone B: Swarm Logic */}</div>
        <div className="col-span-2 bg-vigia-dark p-4">{/* Zone C: Living Map */}</div>
        <div className="col-span-4 bg-vigia-panel p-2">{/* Zone D: Ledger Ticker */}</div>
      </div>
    );
  }
  ```
- [ ] Set up environment variables for API Gateway endpoint

**Acceptance Criteria**:
- `npm run dev` starts Next.js dev server on localhost:3000
- Dashboard layout renders with 4 zones visible
- Dark mode is active by default

---

### TASK-2.2: Web Worker Infrastructure
**Priority**: P0 (Blocker)  
**Estimated Time**: 3 hours  
**Dependencies**: TASK-2.1  
**Requirements**: REQ-3.1.1, REQ-3.2.1

**Subtasks**:
- [ ] Install Comlink: `npm install comlink`
- [ ] Create Web Worker file `public/workers/hazard-detector.worker.ts`:
  ```typescript
  import { expose } from 'comlink';
  
  class HazardDetectorWorker {
    private model: any = null;
    
    async loadModel() {
      // Placeholder: Will load ONNX model in TASK-2.3
      console.log('Model loading...');
    }
    
    async processFrame(frameBuffer: ArrayBuffer, gpsCoords: { lat: number; lon: number }) {
      // Placeholder: Will implement inference in TASK-2.3
      return null;
    }
  }
  
  expose(new HazardDetectorWorker());
  ```
- [ ] Configure Next.js to support Web Workers (add to `next.config.js`):
  ```javascript
  module.exports = {
    webpack: (config) => {
      config.module.rules.push({
        test: /\.worker\.ts$/,
        use: { loader: 'worker-loader' },
      });
      return config;
    },
  };
  ```
- [ ] Create React hook `useHazardDetector` to manage Worker lifecycle:
  ```typescript
  import { wrap } from 'comlink';
  
  export function useHazardDetector() {
    const workerRef = useRef<Worker | null>(null);
    const apiRef = useRef<any>(null);
    
    useEffect(() => {
      workerRef.current = new Worker(new URL('/workers/hazard-detector.worker.ts', import.meta.url));
      apiRef.current = wrap(workerRef.current);
      apiRef.current.loadModel();
      
      return () => workerRef.current?.terminate();
    }, []);
    
    const processFrame = async (frameBuffer: ArrayBuffer, gpsCoords: any) => {
      return apiRef.current?.processFrame(frameBuffer, gpsCoords);
    };
    
    return { processFrame };
  }
  ```

**Acceptance Criteria**:
- Web Worker loads without errors in browser console
- `useHazardDetector` hook successfully communicates with Worker
- Worker can be terminated and restarted without memory leaks

**Testing** (PBT):
- [ ] Send 1000 random ArrayBuffers to Worker and verify no crashes
- [ ] Test Worker termination and restart 100 times to check for memory leaks

---

### TASK-2.3: Video Upload & Frame Extraction
**Priority**: P0 (Blocker)  
**Estimated Time**: 3 hours  
**Dependencies**: TASK-2.1, TASK-2.2  
**Requirements**: REQ-1.1.1

**Subtasks**:
- [ ] Create video upload component in Zone A:
  ```tsx
  export function VideoUploader() {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setVideoFile(file);
        const url = URL.createObjectURL(file);
        if (videoRef.current) videoRef.current.src = url;
      }
    };
    
    return (
      <div>
        <input type="file" accept="video/*" onChange={handleUpload} />
        <video ref={videoRef} controls className="w-full mt-4" />
      </div>
    );
  }
  ```
- [ ] Implement frame extraction at 5 FPS using Canvas API:
  ```typescript
  function extractFrame(video: HTMLVideoElement): ArrayBuffer {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, 640, 640);
    const imageData = ctx.getImageData(0, 0, 640, 640);
    return imageData.data.buffer;
  }
  
  // Extract frames every 200ms (5 FPS)
  const interval = setInterval(() => {
    if (videoRef.current && !videoRef.current.paused) {
      const frameBuffer = extractFrame(videoRef.current);
      processFrame(frameBuffer, simulatedGPS);
    }
  }, 200);
  ```
- [ ] Add simulated GPS coordinates (hardcoded for MVP):
  ```typescript
  const simulatedGPS = { lat: 37.7749, lon: -122.4194 }; // San Francisco
  ```

**Acceptance Criteria**:
- User can upload a video file and see it in the player
- Frames are extracted at 5 FPS when video is playing
- Frame extraction does not block the main UI thread (verified with Chrome DevTools Performance tab)

**Testing** (PBT):
- [ ] Test with videos of various resolutions and verify frames are resized to 640×640
- [ ] Test with videos of various durations (1s to 5min) and verify no memory leaks

---

### TASK-2.4: Web Crypto API Signing
**Priority**: P0 (Blocker)  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-2.2, TASK-1.3  
**Requirements**: REQ-1.1.4, REQ-3.1.2

**Subtasks**:
- [ ] Import private key into Web Worker (for testing only; in production, use device-specific keys):
  ```typescript
  async function importPrivateKey(pemKey: string) {
    const pemContents = pemKey.replace(/-----BEGIN EC PRIVATE KEY-----/, '')
                               .replace(/-----END EC PRIVATE KEY-----/, '')
                               .replace(/\s/g, '');
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    return await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }
  ```
- [ ] Implement signing function in Web Worker:
  ```typescript
  async function signTelemetry(payload: any, privateKey: CryptoKey): Promise<string> {
    const dataToSign = JSON.stringify({
      hazardType: payload.hazardType,
      lat: payload.lat,
      lon: payload.lon,
      timestamp: payload.timestamp,
      confidence: payload.confidence,
    });
    
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(dataToSign)
    );
    
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }
  ```
- [ ] Update `processFrame` to return signed telemetry payload

**Acceptance Criteria**:
- Web Worker can sign telemetry payloads without errors
- Signature is a valid base64-encoded string
- Lambda validator accepts the signature (integration test)

**Testing** (PBT):
- [ ] Generate 1000 random telemetry payloads, sign them, and verify Lambda accepts all
- [ ] Corrupt signatures (flip random bits) and verify Lambda rejects all

---

## Phase 3: Thin-Thread MVP Integration (Day 5)

### TASK-3.1: YOLOv8-nano ONNX Model Integration
**Priority**: P1 (Critical Path)  
**Estimated Time**: 4 hours  
**Dependencies**: TASK-2.2  
**Requirements**: REQ-1.1.2, REQ-2.1.2

**Subtasks**:
- [ ] Download YOLOv8-nano pre-trained model and convert to ONNX:
  ```bash
  pip install ultralytics
  yolo export model=yolov8n.pt format=onnx
  ```
- [ ] Host ONNX model in `public/models/yolov8n.onnx`
- [ ] Install ONNX Runtime Web: `npm install onnxruntime-web`
- [ ] Load model in Web Worker:
  ```typescript
  import * as ort from 'onnxruntime-web';
  
  async loadModel() {
    this.model = await ort.InferenceSession.create('/models/yolov8n.onnx', {
      executionProviders: ['wasm'],
    });
  }
  ```
- [ ] Implement inference function:
  ```typescript
  async processFrame(frameBuffer: ArrayBuffer, gpsCoords: { lat: number; lon: number }) {
    const startTime = performance.now();
    
    // Preprocess: Convert RGBA to RGB, normalize
    const input = preprocessFrame(frameBuffer);
    
    // Run inference
    const feeds = { images: new ort.Tensor('float32', input, [1, 3, 640, 640]) };
    const results = await this.model.run(feeds);
    
    // Postprocess: Extract detections with conf >= 0.6
    const detections = postprocessResults(results);
    
    const inferenceTime = performance.now() - startTime;
    
    if (detections.length > 0) {
      const hazard = detections[0]; // Take highest confidence
      const telemetry = {
        hazardType: mapClassToHazardType(hazard.class),
        lat: gpsCoords.lat,
        lon: gpsCoords.lon,
        timestamp: new Date().toISOString(),
        confidence: hazard.confidence,
      };
      
      const signature = await this.signTelemetry(telemetry);
      return { ...telemetry, signature };
    }
    
    return null;
  }
  ```
- [ ] Map YOLO classes to hazard types (use classes 0-3 as proxies for POTHOLE, DEBRIS, etc.)

**Acceptance Criteria**:
- ONNX model loads in Web Worker without errors
- Inference completes in <200ms on mid-range laptop
- Detections with confidence ≥ 0.6 are returned as telemetry payloads

**Testing** (PBT):
- [ ] Test with 100 random images and verify inference time is consistently <200ms
- [ ] Test with images containing no objects and verify no false positives

---

### TASK-3.2: Telemetry Transmission to API Gateway
**Priority**: P1 (Critical Path)  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-2.4, TASK-1.4  
**Requirements**: REQ-1.1.6

**Subtasks**:
- [ ] Implement batching logic in main thread:
  ```typescript
  const telemetryBatch: SignedTelemetry[] = [];
  
  const processFrame = async (frameBuffer: ArrayBuffer, gpsCoords: any) => {
    const result = await apiRef.current?.processFrame(frameBuffer, gpsCoords);
    if (result) {
      telemetryBatch.push(result);
    }
  };
  
  // Send batch every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (telemetryBatch.length > 0) {
        await sendBatch(telemetryBatch);
        telemetryBatch.length = 0; // Clear batch
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  ```
- [ ] Implement `sendBatch` function:
  ```typescript
  async function sendBatch(batch: SignedTelemetry[]) {
    for (const telemetry of batch) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telemetry),
        });
        
        if (!response.ok) {
          console.error('Failed to send telemetry:', await response.text());
        }
      } catch (error) {
        console.error('Network error:', error);
      }
    }
  }
  ```
- [ ] Display telemetry feed in Zone A (terminal UI):
  ```tsx
  <div className="bg-black text-green-400 font-mono text-xs p-2 h-32 overflow-y-auto">
    {telemetryBatch.map((t, i) => (
      <div key={i}>{`[${t.timestamp}] ${t.hazardType} @ ${t.lat},${t.lon} (conf: ${t.confidence})`}</div>
    ))}
  </div>
  ```

**Acceptance Criteria**:
- Telemetry payloads are batched and sent every 5 seconds
- Successful POST requests return 200 from API Gateway
- Terminal UI displays sent telemetry in real-time

**Testing** (PBT):
- [ ] Simulate network failures and verify retries with exponential backoff
- [ ] Test with batches of varying sizes (1-100 items) and verify all are sent

---

### TASK-3.3: End-to-End Thin-Thread Test
**Priority**: P1 (Critical Path)  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-3.1, TASK-3.2  
**Requirements**: All REQ-1.x

**Subtasks**:
- [ ] Create test video with known objects (use sample dashcam footage)
- [ ] Upload video in frontend and verify:
  1. Frames are extracted at 5 FPS
  2. ONNX inference detects hazards
  3. Telemetry is signed and batched
  4. POST requests succeed (200 response)
  5. DynamoDB contains hazard records
- [ ] Query DynamoDB table and verify records match sent telemetry
- [ ] Check CloudWatch Logs for Lambda execution logs

**Acceptance Criteria**:
- Complete flow from video upload to DynamoDB write succeeds
- No errors in browser console or CloudWatch Logs
- Latency from frame extraction to DynamoDB write is <1 second (p95)

---

## Phase 4: Zone 3 - Intelligence Core (Days 6-7)

### TASK-4.1: DynamoDB Cooldown Table
**Priority**: P1 (Critical Path)  
**Estimated Time**: 1 hour  
**Dependencies**: TASK-1.1  
**Requirements**: REQ-1.3.1

**Subtasks**:
- [ ] Create cooldown table in CDK:
  ```typescript
  const cooldownTable = new Table(this, 'CooldownTable', {
    partitionKey: { name: 'cooldownKey', type: AttributeType.STRING },
    billingMode: BillingMode.ON_DEMAND,
    timeToLiveAttribute: 'ttl',
    removalPolicy: RemovalPolicy.DESTROY,
  });
  ```
- [ ] Deploy and verify TTL is enabled

**Acceptance Criteria**:
- Table exists with `cooldownKey` as partition key
- TTL attribute is configured to auto-delete expired records

---

### TASK-4.2: Agent Traces Table
**Priority**: P1  
**Estimated Time**: 1 hour  
**Dependencies**: TASK-1.1  
**Requirements**: REQ-1.3.4

**Subtasks**:
- [ ] Create agent traces table in CDK:
  ```typescript
  const tracesTable = new Table(this, 'AgentTracesTable', {
    partitionKey: { name: 'traceId', type: AttributeType.STRING },
    billingMode: BillingMode.ON_DEMAND,
    timeToLiveAttribute: 'ttl',
  });
  ```

**Acceptance Criteria**:
- Table exists and is queryable

---

### TASK-4.3: Bedrock Agent Action Group Lambdas
**Priority**: P1  
**Estimated Time**: 4 hours  
**Dependencies**: TASK-1.1  
**Requirements**: REQ-1.3.3

**Subtasks**:
- [ ] Create `query-hazards` Lambda (Python):
  ```python
  import boto3
  import ngeohash
  from geopy.distance import geodesic
  from datetime import datetime, timedelta
  
  dynamodb = boto3.resource('dynamodb')
  table = dynamodb.Table(os.environ['HAZARDS_TABLE_NAME'])
  
  def lambda_handler(event, context):
      geohash = event['geohash']
      radius_meters = event['radiusMeters']
      hours_back = event['hoursBack']
      
      center_lat, center_lon = ngeohash.decode(geohash)
      neighbors = ngeohash.neighbors(geohash)
      
      hazards = []
      for gh in [geohash] + neighbors:
          response = table.query(
              KeyConditionExpression='geohash = :gh',
              FilterExpression='#status = :verified',
              ExpressionAttributeNames={'#status': 'status'},
              ExpressionAttributeValues={':gh': gh, ':verified': 'verified'}
          )
          hazards.extend(response['Items'])
      
      # Filter by distance and time
      cutoff_time = datetime.now() - timedelta(hours=hours_back)
      filtered = [h for h in hazards if 
                  geodesic((center_lat, center_lon), (h['lat'], h['lon'])).meters <= radius_meters
                  and datetime.fromisoformat(h['timestamp']) >= cutoff_time]
      
      return {'statusCode': 200, 'body': {'hazards': filtered, 'count': len(filtered)}}
  ```
- [ ] Create `calculate-score` Lambda (Python):
  ```python
  def lambda_handler(event, context):
      similar_hazards = event['similarHazards']
      
      count_score = min(len(similar_hazards) * 20, 40)
      avg_confidence = sum(h['confidence'] for h in similar_hazards) / len(similar_hazards) if similar_hazards else 0
      confidence_score = avg_confidence * 30
      
      recent_count = sum(1 for h in similar_hazards if is_within_hours(h['timestamp'], 6))
      temporal_score = min(recent_count * 10, 30)
      
      total_score = count_score + confidence_score + temporal_score
      
      return {
          'statusCode': 200,
          'body': {
              'verificationScore': round(total_score, 2),
              'breakdown': {
                  'countScore': count_score,
                  'confidenceScore': confidence_score,
                  'temporalScore': temporal_score
              }
          }
      }
  ```
- [ ] Add Lambda constructs to CDK with DynamoDB read permissions
- [ ] Deploy and test with sample inputs

**Acceptance Criteria**:
- Both Lambdas deploy successfully
- `query-hazards` returns correct hazards within radius
- `calculate-score` returns score between 0-100

**Testing** (PBT):
- [ ] Generate random geohashes and verify query returns valid results
- [ ] Generate random hazard lists and verify score calculation is deterministic

---

### TASK-4.4: Bedrock Agent Configuration
**Priority**: P1  
**Estimated Time**: 3 hours  
**Dependencies**: TASK-4.3  
**Requirements**: REQ-1.3.2, REQ-1.3.3

**Subtasks**:
- [ ] Create Bedrock Agent via AWS Console (CDK support limited):
  - Name: `vigia-auditor-strategist`
  - Model: Amazon Nova Lite
  - Instructions: (Copy from design.md Section 5.3)
- [ ] Create Action Group `QueryAndVerify`:
  - Add `query-hazards` Lambda
  - Add `calculate-score` Lambda
  - Define OpenAPI schema for input/output
- [ ] Test Agent in Bedrock console with sample prompt
- [ ] Note Agent ID and Alias ID for Lambda orchestrator

**Acceptance Criteria**:
- Agent responds to test prompts with ReAct reasoning
- Agent successfully invokes both action group Lambdas
- Reasoning trace is visible in Bedrock console

---

### TASK-4.5: Lambda Agent Orchestrator
**Priority**: P1  
**Estimated Time**: 4 hours  
**Dependencies**: TASK-4.1, TASK-4.2, TASK-4.4  
**Requirements**: REQ-1.3.1, REQ-1.3.2, REQ-1.3.4, REQ-1.3.5

**Subtasks**:
- [ ] Create orchestrator Lambda (Python) triggered by DynamoDB Stream:
  ```python
  import boto3
  import json
  from datetime import datetime
  
  dynamodb = boto3.resource('dynamodb')
  bedrock_agent = boto3.client('bedrock-agent-runtime')
  
  cooldown_table = dynamodb.Table(os.environ['COOLDOWN_TABLE_NAME'])
  traces_table = dynamodb.Table(os.environ['TRACES_TABLE_NAME'])
  hazards_table = dynamodb.Table(os.environ['HAZARDS_TABLE_NAME'])
  
  def lambda_handler(event, context):
      for record in event['Records']:
          if record['eventName'] != 'INSERT':
              continue
          
          hazard = record['dynamodb']['NewImage']
          geohash = hazard['geohash']['S']
          hazard_type = hazard['hazardType']['S']
          cooldown_key = f"{geohash}#{hazard_type}"
          
          # Check cooldown
          response = cooldown_table.get_item(Key={'cooldownKey': cooldown_key})
          if 'Item' in response:
              print(f"Skipping duplicate hazard: {cooldown_key}")
              continue
          
          # Invoke Bedrock Agent
          prompt = f"""New hazard detected:
          - Type: {hazard_type}
          - Location: {hazard['lat']['N']}, {hazard['lon']['N']} (geohash: {geohash})
          - Confidence: {hazard['confidence']['N']}
          - Timestamp: {hazard['timestamp']['S']}
          
          Verify this hazard and return your reasoning."""
          
          agent_response = bedrock_agent.invoke_agent(
              agentId=os.environ['BEDROCK_AGENT_ID'],
              agentAliasId=os.environ['BEDROCK_AGENT_ALIAS_ID'],
              sessionId=f"session-{geohash}",
              inputText=prompt
          )
          
          # Parse response
          result = parse_agent_response(agent_response)
          
          # Update hazard status
          if result['verificationScore'] >= 70:
              hazards_table.update_item(
                  Key={'geohash': geohash, 'timestamp': hazard['timestamp']['S']},
                  UpdateExpression='SET #status = :verified, verificationScore = :score',
                  ExpressionAttributeNames={'#status': 'status'},
                  ExpressionAttributeValues={':verified': 'verified', ':score': result['verificationScore']}
              )
              
              # Trigger DePIN ledger write (will implement in TASK-5.1)
          
          # Store reasoning trace
          traces_table.put_item(Item={
              'traceId': result['traceId'],
              'hazardId': f"{geohash}#{hazard['timestamp']['S']}",
              'reasoning': result['reasoning'],
              'verificationScore': result['verificationScore'],
              'createdAt': datetime.now().isoformat(),
              'ttl': int(datetime.now().timestamp()) + 86400 * 7
          })
          
          # Write cooldown entry
          cooldown_table.put_item(Item={
              'cooldownKey': cooldown_key,
              'processedAt': datetime.now().isoformat(),
              'ttl': int(datetime.now().timestamp()) + 300
          })
  ```
- [ ] Add Lambda construct to CDK with DynamoDB Stream trigger
- [ ] Grant permissions: DynamoDB read/write, Bedrock InvokeAgent
- [ ] Deploy and test with manual DynamoDB insert

**Acceptance Criteria**:
- Lambda is triggered when new hazard is inserted
- Bedrock Agent is invoked successfully
- Hazard status is updated to "verified" if score ≥ 70
- Reasoning trace is stored in traces table
- Cooldown entry prevents duplicate processing

**Testing** (PBT):
- [ ] Insert 100 random hazards and verify all are processed
- [ ] Insert duplicate hazards within 5 minutes and verify they are skipped

---

## Phase 5: Zone 4 - Trust Layer (Day 8)

### TASK-5.1: DePIN Ledger Table
**Priority**: P2  
**Estimated Time**: 1 hour  
**Dependencies**: TASK-1.1  
**Requirements**: REQ-1.4.1

**Subtasks**:
- [ ] Create ledger table in CDK with append-only IAM policy
- [ ] Deploy and verify permissions

**Acceptance Criteria**:
- Table exists with stream enabled
- UpdateItem and DeleteItem are denied by IAM

---

### TASK-5.2: Hash Chain Validator Lambda
**Priority**: P2  
**Estimated Time**: 3 hours  
**Dependencies**: TASK-5.1  
**Requirements**: REQ-1.4.2, REQ-1.4.3

**Subtasks**:
- [ ] Create validator Lambda (Node.js) triggered by ledger stream:
  ```typescript
  import { DynamoDBStreamHandler } from 'aws-lambda';
  import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
  import { createHash } from 'crypto';
  
  const dynamodb = new DynamoDBClient({});
  
  export const handler: DynamoDBStreamHandler = async (event) => {
      for (const record of event.Records) {
          if (record.eventName !== 'INSERT') continue;
          
          const newEntry = record.dynamodb!.NewImage!;
          
          // Get previous entry
          const response = await dynamodb.send(new QueryCommand({
              TableName: process.env.LEDGER_TABLE_NAME,
              Limit: 2,
              ScanIndexForward: false,
              KeyConditionExpression: 'ledgerId = :id',
              ExpressionAttributeValues: {':id': {S: newEntry.ledgerId.S}}
          }));
          
          const previousHash = newEntry.previousHash.S;
          
          // Compute expected hash
          const dataToHash = JSON.stringify({
              contributorId: newEntry.contributorId.S,
              hazardId: newEntry.hazardId.S,
              credits: newEntry.credits.N,
              timestamp: newEntry.timestamp.S,
              previousHash
          });
          
          const expectedHash = createHash('sha256').update(dataToHash).digest('hex');
          
          if (expectedHash !== newEntry.currentHash.S) {
              console.error('HASH CHAIN BROKEN!');
              // Raise SNS alert
          }
      }
  };
  ```
- [ ] Add SNS topic for critical alerts
- [ ] Deploy and test with manual ledger inserts

**Acceptance Criteria**:
- Lambda validates hash chain correctly
- Broken chain triggers SNS alert

**Testing** (PBT):
- [ ] Insert 1000 valid ledger entries and verify all pass validation
- [ ] Insert entries with corrupted hashes and verify alerts are raised

---

### TASK-5.3: Integrate DePIN Ledger with Orchestrator
**Priority**: P2  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-4.5, TASK-5.1  
**Requirements**: REQ-1.3.5, REQ-1.4.1

**Subtasks**:
- [ ] Update orchestrator Lambda to write to ledger when hazard is verified:
  ```python
  if result['verificationScore'] >= 70:
      # Get previous ledger entry for hash chain
      response = ledger_table.query(
          Limit=1,
          ScanIndexForward=False,
          KeyConditionExpression='ledgerId = :id',
          ExpressionAttributeValues={':id': 'ledger'}
      )
      
      previous_hash = response['Items'][0]['currentHash'] if response['Items'] else '0' * 64
      
      # Compute current hash
      ledger_entry = {
          'ledgerId': 'ledger',
          'timestamp': datetime.now().isoformat(),
          'contributorId': hash_contributor_id(hazard['signature']['S']),
          'hazardId': f"{geohash}#{hazard['timestamp']['S']}",
          'credits': 5,
          'previousHash': previous_hash
      }
      
      current_hash = hashlib.sha256(json.dumps(ledger_entry).encode()).hexdigest()
      ledger_entry['currentHash'] = current_hash
      
      ledger_table.put_item(Item=ledger_entry)
  ```

**Acceptance Criteria**:
- Verified hazards trigger ledger writes
- Hash chain is maintained correctly

---

## Phase 6: Zone 5 - Visualization (Days 9-10)

### TASK-6.1: Amazon Location Service Setup
**Priority**: P2  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-0.2  
**Requirements**: REQ-1.5.1

**Subtasks**:
- [ ] Create Location Service map and route calculator in CDK
- [ ] Export map name and calculator name as outputs
- [ ] Configure Cognito Identity Pool for unauthenticated access (frontend)

**Acceptance Criteria**:
- Map and route calculator are created
- Frontend can access Location Service APIs

---

### TASK-6.2: MapLibre GL JS Integration
**Priority**: P2  
**Estimated Time**: 3 hours  
**Dependencies**: TASK-6.1, TASK-2.1  
**Requirements**: REQ-1.5.4

**Subtasks**:
- [ ] Install MapLibre: `npm install maplibre-gl`
- [ ] Create map component in Zone C:
  ```tsx
  import maplibregl from 'maplibre-gl';
  import { useEffect, useRef } from 'react';
  
  export function LiveMap() {
      const mapContainer = useRef<HTMLDivElement>(null);
      const map = useRef<maplibregl.Map | null>(null);
      
      useEffect(() => {
          if (!mapContainer.current) return;
          
          map.current = new maplibregl.Map({
              container: mapContainer.current,
              style: `https://maps.geo.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/maps/v0/maps/${process.env.NEXT_PUBLIC_MAP_NAME}/style-descriptor`,
              center: [-122.4194, 37.7749],
              zoom: 12
          });
          
          return () => map.current?.remove();
      }, []);
      
      return <div ref={mapContainer} className="w-full h-full" />;
  }
  ```

**Acceptance Criteria**:
- Map renders in Zone C
- User can pan and zoom

---

### TASK-6.3: Route Hazard Analyzer Lambda
**Priority**: P2  
**Estimated Time**: 4 hours  
**Dependencies**: TASK-6.1, TASK-1.1  
**Requirements**: REQ-1.5.2, REQ-1.5.3

**Subtasks**:
- [ ] Create analyzer Lambda (Python) with API Gateway trigger
- [ ] Implement route analysis logic (see design.md Section 4.5.2)
- [ ] Add caching with DynamoDB TTL
- [ ] Deploy and test with sample routes

**Acceptance Criteria**:
- Lambda returns route segments with colors
- Hazards within 50m are flagged as red

**Testing** (PBT):
- [ ] Generate random routes and verify all segments are colored
- [ ] Test with routes near known hazards and verify correct flagging

---

### TASK-6.4: Frontend Route Visualization
**Priority**: P2  
**Estimated Time**: 3 hours  
**Dependencies**: TASK-6.2, TASK-6.3  
**Requirements**: REQ-1.5.3, REQ-1.5.4

**Subtasks**:
- [ ] Add route request UI (origin/destination inputs)
- [ ] Call Location Service to get base route
- [ ] Call analyzer Lambda to get hazard data
- [ ] Render colored route segments on map
- [ ] Add hazard markers with tooltips

**Acceptance Criteria**:
- User can request route A→B
- Route is rendered with red/green segments
- Hazard markers are clickable with tooltips

---

## Phase 7: UI Polish & Analytics (Days 11-12)

### TASK-7.1: Reasoning Trace Visualization (Zone B)
**Priority**: P2  
**Estimated Time**: 3 hours  
**Dependencies**: TASK-4.5  
**Requirements**: REQ-1.3.4

**Subtasks**:
- [ ] Create API endpoint to fetch reasoning traces
- [ ] Build trace viewer component with ReAct formatting
- [ ] Add auto-scroll and syntax highlighting

**Acceptance Criteria**:
- Reasoning traces are displayed in real-time
- ReAct pattern (Thought→Action→Observation) is clearly formatted

---

### TASK-7.2: DePIN Ledger Ticker (Zone D)
**Priority**: P2  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-5.1  
**Requirements**: REQ-1.5.5

**Subtasks**:
- [ ] Create API endpoint to fetch recent ledger entries
- [ ] Build scrolling ticker component
- [ ] Add auto-refresh every 10 seconds

**Acceptance Criteria**:
- Ticker displays recent contributions
- Auto-scrolls horizontally

---

### TASK-7.3: Privacy Toggle & Blur Filter
**Priority**: P3  
**Estimated Time**: 3 hours  
**Dependencies**: TASK-2.3  
**Requirements**: REQ-1.1.5

**Subtasks**:
- [ ] Add privacy toggle button in Zone A
- [ ] Implement Canvas blur filter in Web Worker
- [ ] Add lightweight face/plate detection (optional, use placeholder regions for MVP)

**Acceptance Criteria**:
- Toggle activates blur filter
- Blurred frames are processed by ONNX

---

### TASK-7.4: Custom Analytics Dashboard
**Priority**: P3  
**Estimated Time**: 4 hours  
**Dependencies**: TASK-1.1, TASK-5.1  
**Requirements**: Custom analytics (design.md Section 2)

**Subtasks**:
- [ ] Install Recharts: `npm install recharts`
- [ ] Create analytics API endpoints (hazard counts by type, verification rates)
- [ ] Build chart components (bar chart, line chart)
- [ ] Add to dashboard (new zone or modal)

**Acceptance Criteria**:
- Charts display real-time system metrics
- Data updates every 30 seconds

---

## Phase 8: Testing & Optimization (Days 13-14)

### TASK-8.1: Property-Based Testing Suite
**Priority**: P1  
**Estimated Time**: 6 hours  
**Dependencies**: All implementation tasks  
**Requirements**: All REQ-*

**Subtasks**:
- [ ] Install fast-check: `npm install --save-dev fast-check`
- [ ] Write PBT tests for:
  - Geohash computation (boundary cases)
  - Signature verification (random payloads)
  - Hash chain validation (random ledger entries)
  - Route analysis (random polylines)
- [ ] Run 10,000 test cases per property
- [ ] Fix any discovered edge cases

**Acceptance Criteria**:
- All PBT tests pass with 10,000 iterations
- No edge cases cause crashes or incorrect behavior

---

### TASK-8.2: Load Testing with Artillery
**Priority**: P1  
**Estimated Time**: 4 hours  
**Dependencies**: All implementation tasks  
**Requirements**: REQ-2.2.1, REQ-2.3.2

**Subtasks**:
- [ ] Install Artillery: `npm install --save-dev artillery`
- [ ] Create load test script (see design.md Section 9.3)
- [ ] Run test simulating 500 concurrent users
- [ ] Monitor CloudWatch metrics during test
- [ ] Verify cost remains under $5

**Acceptance Criteria**:
- p95 latency < 500ms
- Error rate < 1%
- No DynamoDB throttling
- Cost < $5 for test duration

---

### TASK-8.3: End-to-End Integration Tests
**Priority**: P1  
**Estimated Time**: 4 hours  
**Dependencies**: All implementation tasks  
**Requirements**: Acceptance Criteria (requirements.md Section 4)

**Subtasks**:
- [ ] Install Playwright: `npm install --save-dev @playwright/test`
- [ ] Write E2E tests for all 6 acceptance criteria
- [ ] Run tests in CI/CD pipeline
- [ ] Generate test report

**Acceptance Criteria**:
- All 6 acceptance criteria pass
- Tests run in <5 minutes

---

## Phase 9: Deployment & Documentation (Day 15)

### TASK-9.1: AWS Amplify Frontend Deployment
**Priority**: P0  
**Estimated Time**: 2 hours  
**Dependencies**: TASK-2.1  
**Requirements**: Deployment (design.md Section 8)

**Subtasks**:
- [ ] Create Amplify app in CDK
- [ ] Connect to GitHub repository
- [ ] Configure build settings
- [ ] Deploy and verify

**Acceptance Criteria**:
- Frontend is accessible via Amplify URL
- All features work in production

---

### TASK-9.2: CloudWatch Dashboards & Alarms
**Priority**: P1  
**Estimated Time**: 3 hours  
**Dependencies**: All implementation tasks  
**Requirements**: REQ-2.3.3, Monitoring (design.md Section 10)

**Subtasks**:
- [ ] Create CloudWatch dashboard with all metrics
- [ ] Set up alarms for cost, errors, latency
- [ ] Configure SNS notifications
- [ ] Test alarms with simulated failures

**Acceptance Criteria**:
- Dashboard displays all system metrics
- Alarms trigger correctly

---

### TASK-9.3: Demo Video & Documentation
**Priority**: P0  
**Estimated Time**: 4 hours  
**Dependencies**: TASK-9.1  
**Requirements**: Competition submission

**Subtasks**:
- [ ] Record 3-minute demo video showing:
  1. Video upload and hazard detection
  2. Bedrock Agent reasoning trace
  3. Route visualization with hazard avoidance
  4. DePIN ledger ticker
- [ ] Write README.md with setup instructions
- [ ] Create architecture diagram (export from design.md)
- [ ] Prepare competition submission materials

**Acceptance Criteria**:
- Demo video is clear and under 3 minutes
- README includes all setup steps
- Submission is ready for voting phase

---

## Summary: Critical Path

**Days 1-5 (Thin-Thread MVP)**:
TASK-0.1 → TASK-0.2 → TASK-1.1 → TASK-1.2 → TASK-1.3 → TASK-1.4 → TASK-2.1 → TASK-2.2 → TASK-2.3 → TASK-2.4 → TASK-3.1 → TASK-3.2 → TASK-3.3

**Days 6-8 (Intelligence & Trust)**:
TASK-4.1 → TASK-4.2 → TASK-4.3 → TASK-4.4 → TASK-4.5 → TASK-5.1 → TASK-5.2 → TASK-5.3

**Days 9-10 (Visualization)**:
TASK-6.1 → TASK-6.2 → TASK-6.3 → TASK-6.4

**Days 11-12 (Polish)**:
TASK-7.1 → TASK-7.2 → TASK-7.3 → TASK-7.4

**Days 13-14 (Testing)**:
TASK-8.1 → TASK-8.2 → TASK-8.3

**Day 15 (Deployment)**:
TASK-9.1 → TASK-9.2 → TASK-9.3

**Total Estimated Time**: 15 days (120 hours)

---

## Risk Mitigation

**Risk 1**: ONNX inference too slow on low-end devices  
**Mitigation**: Use WebGL backend, reduce model size, or skip frames dynamically

**Risk 2**: Bedrock Agent costs exceed budget  
**Mitigation**: Implement cost monitoring and auto-switch to cached traces at $40

**Risk 3**: DynamoDB throttling during load test  
**Mitigation**: Use on-demand billing, implement exponential backoff

**Risk 4**: Amazon Location Service free tier exhausted  
**Mitigation**: Cache routes aggressively, limit demo usage

**Risk 5**: Web Worker compatibility issues in Safari  
**Mitigation**: Test early on Safari, use polyfills if needed
