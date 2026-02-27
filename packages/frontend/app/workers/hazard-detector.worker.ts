import { expose } from 'comlink';
import * as ort from 'onnxruntime-web';
const baseUrl = self.location.origin;

// Force the absolute path so the Blob Worker's fetch() doesn't crash
ort.env.wasm.wasmPaths = `${baseUrl}/ort/`;
class HazardDetectorWorker {
  private session: ort.InferenceSession | null = null;
  private privateKey: CryptoKey | null = null;

  async loadModel() {
    try {
        const modelUrl = `${baseUrl}/models/yolo26_fp32.onnx`;
        this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
      });
      console.log('[Worker] ONNX model loaded successfully');
    } catch (error) {
      console.error('[Worker] Failed to load ONNX model:', error);
    }
  }

  async importPrivateKey(pemKey: string) {
    try {
      const pemContents = pemKey
        .replace(/-----BEGIN EC PRIVATE KEY-----/, '')
        .replace(/-----END EC PRIVATE KEY-----/, '')
        .replace(/\s/g, '');
      
      const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
      
      this.privateKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
      
      console.log('[Worker] Private key imported successfully');
    } catch (error) {
      console.error('[Worker] Failed to import private key:', error);
    }
  }

  async signTelemetry(payload: any): Promise<string> {
    // Test mode: use hardcoded signature if no key loaded
    if (!this.privateKey) {
      console.log('[Worker] Test mode: using TEST_MODE_SIGNATURE');
      return 'TEST_MODE_SIGNATURE';
    }

    const dataToSign = JSON.stringify({
      hazardType: payload.hazardType,
      lat: payload.lat,
      lon: payload.lon,
      timestamp: payload.timestamp,
      confidence: payload.confidence,
    });

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      this.privateKey,
      new TextEncoder().encode(dataToSign)
    );

    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  preprocessFrame(frameBuffer: ArrayBuffer): Float32Array {
    const uint8Array = new Uint8Array(frameBuffer);
    const float32Array = new Float32Array(3 * 320 * 320);
    
    // Convert RGBA to RGB and normalize to [0, 1]
    for (let i = 0; i < 320 * 320; i++) {
      float32Array[i] = uint8Array[i * 4] / 255.0;                    // R
      float32Array[320 * 320 + i] = uint8Array[i * 4 + 1] / 255.0;   // G
      float32Array[320 * 320 * 2 + i] = uint8Array[i * 4 + 2] / 255.0; // B
    }
    
    return float32Array;
  }

  async processFrame(
    frameBuffer: ArrayBuffer,
    gpsCoords: { lat: number; lon: number }
  ): Promise<any | null> {
    if (!this.session) return null;

    const startTime = performance.now();

    try {
      // Preprocess
      const input = this.preprocessFrame(frameBuffer);
      const tensor = new ort.Tensor('float32', input, [1, 3, 320, 320]);

      // Run inference
      const results = await this.session.run({ images: tensor });
      const output = results.output0.data as Float32Array;

      // Parse YOLO output: [batch, 84, 8400] -> [batch, 8400, 84]
      // 84 = [x, y, w, h, ...80 class scores]
      const numDetections = 8400;
      let bestDetection = null;
      let maxConfidence = 0.6; // Minimum threshold

      for (let i = 0; i < numDetections; i++) {
        const confidence = output[i * 84 + 4]; // Class 0 (pothole) confidence
        
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          bestDetection = {
            x: output[i * 84],
            y: output[i * 84 + 1],
            w: output[i * 84 + 2],
            h: output[i * 84 + 3],
            confidence,
          };
        }
      }

      const inferenceTime = performance.now() - startTime;

      if (bestDetection) {
        const telemetry = {
          hazardType: 'POTHOLE',
          lat: gpsCoords.lat,
          lon: gpsCoords.lon,
          timestamp: new Date().toISOString(),
          confidence: maxConfidence,
        };

        const signature = await this.signTelemetry(telemetry);
        
        console.log(`[Worker] Pothole detected: ${maxConfidence.toFixed(2)} (${inferenceTime.toFixed(0)}ms)`);

        return { 
          ...telemetry, 
          signature,
          bbox: {
            x: bestDetection.x - bestDetection.w / 2,
            y: bestDetection.y - bestDetection.h / 2,
            width: bestDetection.w,
            height: bestDetection.h
          }
        };
      }

      return null;
    } catch (error) {
      console.error('[Worker] Inference error:', error);
      return null;
    }
  }
}

expose(new HazardDetectorWorker());
