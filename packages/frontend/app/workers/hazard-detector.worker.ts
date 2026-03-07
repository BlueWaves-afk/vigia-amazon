import { expose } from 'comlink';
import * as ort from 'onnxruntime-web';

const baseUrl = self.location.origin;

// WASM path (required for Next.js / workers)
ort.env.wasm.wasmPaths = `${baseUrl}/ort/`;

const INPUT_SIZE = 320;
const CONF_THRESHOLD = 0.4;

// Define your classes here
const CLASSES = ['POTHOLE']; // extend if needed

class HazardDetectorWorker {
  private session: ort.InferenceSession | null = null;
  private privateKey: CryptoKey | null = null;

  // -------------------------
  // LOAD MODEL
  // -------------------------
  async loadModel() {
    try {
      const modelUrl = `${baseUrl}/models/yolo26_fp32.onnx`;

      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });

    } catch (e) {
      console.error('[Worker] Model load failed:', e);
    }
  }

  // -------------------------
  // SIGNING
  // -------------------------
  async importPrivateKey(pemKey: string) {
    try {
      const pem = pemKey
        .replace(/-----BEGIN EC PRIVATE KEY-----/, '')
        .replace(/-----END EC PRIVATE KEY-----/, '')
        .replace(/\s/g, '');

      const binary = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

      this.privateKey = await crypto.subtle.importKey(
        'pkcs8',
        binary,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
    } catch (e) {
      console.error('[Worker] Key import failed:', e);
    }
  }

  async signTelemetry(payload: any): Promise<string> {
    if (!this.privateKey) return 'TEST_MODE_SIGNATURE';

    const encoded = new TextEncoder().encode(JSON.stringify(payload));

    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      this.privateKey,
      encoded
    );

    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  }

  // -------------------------
  // SIZE PARSER (FIX)
  // -------------------------
  private parseSize(size: any) {
    let width = size?.width ?? size?.videoWidth ?? size;
    let height = size?.height ?? size?.videoHeight;

    if (!width || !height || isNaN(width) || isNaN(height)) {
      return { width: 640, height: 480 };
    }

    return { width, height };
  }

  // -------------------------
  // PREPROCESS (LETTERBOX)
  // -------------------------
  preprocess(frameBuffer: ArrayBuffer, size: any) {
    const { width, height } = this.parseSize(size);

    const rgba = new Uint8ClampedArray(frameBuffer);

    if (rgba.length !== 4 * width * height) {
      throw new Error(`Buffer size mismatch: got ${rgba.length}, expected ${4 * width * height} for ${width}x${height}`);
    }

    const scale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);

    const dx = Math.floor((INPUT_SIZE - newW) / 2);
    const dy = Math.floor((INPUT_SIZE - newH) / 2);

    const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
    const ctx = canvas.getContext('2d')!;

    // letterbox background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

    // source image
    const img = new ImageData(rgba, width, height);
    const tmp = new OffscreenCanvas(width, height);
    tmp.getContext('2d')!.putImageData(img, 0, 0);

    // draw resized
    ctx.drawImage(tmp, dx, dy, newW, newH);

    const resized = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

    // HWC → CHW
    const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      tensor[i] = resized[i * 4] / 255.0; // R
      tensor[i + INPUT_SIZE * INPUT_SIZE] = resized[i * 4 + 1] / 255.0; // G
      tensor[i + 2 * INPUT_SIZE * INPUT_SIZE] = resized[i * 4 + 2] / 255.0; // B
    }

    return { tensor, scale, dx, dy, srcW: width, srcH: height };
  }

  // -------------------------
  // MAIN INFERENCE
  // -------------------------
  async processFrame(
    frameBuffer: ArrayBuffer,
    size: any,
    gpsCoords: { lat: number; lon: number }
  ) {
    if (!this.session) return null;

    try {
      const prep = this.preprocess(frameBuffer, size);

      const inputTensor = new ort.Tensor(
        'float32',
        prep.tensor,
        [1, 3, INPUT_SIZE, INPUT_SIZE]
      );

      const results = await this.session.run({ images: inputTensor });

      const output = results.output0.data as Float32Array;
      const dims = results.output0.dims;

      const channels = dims[1];
      const N = dims[2];

      let best = null;
      let maxScore = 0;
      let bestClassIdx = 0;

      // YOLO decode
      for (let i = 0; i < N; i++) {
        for (let c = 4; c < channels; c++) {
          const score = output[c * N + i];

          if (score > CONF_THRESHOLD && score > maxScore) {
            maxScore = score;
            bestClassIdx = c - 4;

            best = {
              x: output[0 * N + i],
              y: output[1 * N + i],
              w: output[2 * N + i],
              h: output[3 * N + i]
            };
          }
        }
      }

      if (!best) return null;

      // YOLO outputs are already in pixel coords [0-320], not normalized
      const boxX = best.x;
      const boxY = best.y;
      const boxW = best.w;
      const boxH = best.h;
      
      // Remove letterbox padding and scale back to original image
      const cx = (boxX - prep.dx) / prep.scale;
      const cy = (boxY - prep.dy) / prep.scale;
      const bw = boxW / prep.scale;
      const bh = boxH / prep.scale;
      
      const telemetry = {
        hazardType: CLASSES[bestClassIdx] || 'UNKNOWN',
        lat: gpsCoords.lat,
        lon: gpsCoords.lon,
        timestamp: new Date().toISOString(),
        confidence: parseFloat(maxScore.toFixed(4))
      };

      const signature = await this.signTelemetry(telemetry);

      const bbox = {
        x: cx - bw / 2,
        y: cy - bh / 2,
        width: bw,
        height: bh
      };
      
      return {
        ...telemetry,
        signature,
        bbox
      };
    } catch (e) {
      console.error('[Worker] Inference error:', e);
      return null;
    }
  }
}

expose(new HazardDetectorWorker());