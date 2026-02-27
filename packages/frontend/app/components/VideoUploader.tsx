'use client';

import { useState, useRef, useEffect } from 'react';
import { useHazardDetector } from '../hooks/useHazardDetector';

export type SignedTelemetry = {
  hazardType: string;
  lat: number;
  lon: number;
  timestamp: string;
  confidence: number;
  signature: string;
  bbox?: { x: number; y: number; width: number; height: number };
};

export function VideoUploader() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetryBatch, setTelemetryBatch] = useState<SignedTelemetry[]>([]);
  const [privateKeyLoaded, setPrivateKeyLoaded] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [currentDetection, setCurrentDetection] = useState<SignedTelemetry | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { processFrame, loadPrivateKey } = useHazardDetector();

  // Simulated GPS coordinates (San Francisco)
  const simulatedGPS = { lat: 37.7749, lon: -122.4194 };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.src = url;
      }
    }
  };

  const handleKeyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      await loadPrivateKey(text);
      setPrivateKeyLoaded(true);
    }
  };

  const extractFrame = (video: HTMLVideoElement): ArrayBuffer => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, 640, 640);
    const imageData = ctx.getImageData(0, 0, 640, 640);
    return imageData.data.buffer;
  };

  const drawDetections = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // Match canvas size to video display size
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (currentDetection?.bbox) {
      const { x, y, width, height } = currentDetection.bbox;
      
      // Scale from 320x320 model input to video display size
      const scaleX = canvas.width / 320;
      const scaleY = canvas.height / 320;
      
      const x1 = x * scaleX;
      const y1 = y * scaleY;
      const w = width * scaleX;
      const h = height * scaleY;
      
      // Draw neon green bounding box
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, w, h);
      
      // Draw label
      const label = `POTHOLE ${(currentDetection.confidence * 100).toFixed(0)}%`;
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(label, x1, y1 - 5);
    }
  };

  const startProcessing = () => {
    if (!videoRef.current) return;
    
    setIsProcessing(true);
    setDetectionCount(0);
    videoRef.current.play();

    // Extract frames at 5 FPS (every 200ms)
    intervalRef.current = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused) {
        const frameBuffer = extractFrame(videoRef.current);
        const result = await processFrame(frameBuffer, simulatedGPS);
        
        if (result) {
          setTelemetryBatch(prev => [...prev, result]);
          setDetectionCount(prev => prev + 1);
          setCurrentDetection(result);
          
          // Clear detection after 100ms
          setTimeout(() => setCurrentDetection(null), 100);
        }
      }
    }, 200);
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  // Draw bounding boxes when detection changes
  useEffect(() => {
    drawDetections();
  }, [currentDetection]);

  // Send batch every 5 seconds
  useEffect(() => {
    if (!isProcessing) return;

    const batchInterval = setInterval(async () => {
      if (telemetryBatch.length > 0) {
        console.log('[Batch] Sending ${telemetryBatch.length} telemetry items');
        
        // Send to API Gateway (will implement in TASK-3.2)
        for (const telemetry of telemetryBatch) {
          try {
            const response = await fetch('${process.env.NEXT_PUBLIC_API_URL}/telemetry', {
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

        setTelemetryBatch([]);
      }
    }, 5000);

    return () => clearInterval(batchInterval);
  }, [isProcessing, telemetryBatch]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Upload Private Key (optional - test mode enabled)
        </label>
        <input
          type="file"
          accept=".pem"
          onChange={handleKeyUpload}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-vigia-accent file:text-white hover:file:bg-blue-600"
        />
        {privateKeyLoaded && (
          <p className="text-xs text-vigia-success mt-1">✓ Key loaded</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Upload Video
        </label>
        <input
          type="file"
          accept="video/*"
          onChange={handleUpload}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-vigia-accent file:text-white hover:file:bg-blue-600"
        />
      </div>

      {videoFile && (
        <>
          <div className="relative w-full h-[400px] bg-black rounded overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
            />
            
            {/* Canvas overlay for bounding boxes */}
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
            
            {/* Detection Counter Overlay */}
            {isProcessing && (
              <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-3 py-2 rounded border border-vigia-accent z-10">
                <div className="text-vigia-accent font-mono text-xs font-bold">
                  HAZARDS DETECTED: {detectionCount}
                </div>
              </div>
            )}

            {/* Live Scanning Indicator */}
            {isProcessing && (
              <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/80 backdrop-blur-sm px-3 py-2 rounded border border-red-500 z-10">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-500 font-mono text-xs font-bold">LIVE SCANNING</span>
              </div>
            )}

            {/* Telemetry Log Overlay */}
            {isProcessing && telemetryBatch.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 z-10">
                <div className="font-mono text-[10px] space-y-1 max-h-20 overflow-y-auto">
                  {telemetryBatch.slice(-3).map((t, i) => (
                    <div key={i} className="text-green-400 flex items-center gap-2">
                      <span className="text-gray-600">▸</span>
                      <span className="text-vigia-accent">{t.hazardType}</span>
                      <span className="text-gray-500">@</span>
                      <span className="text-gray-400">{t.lat.toFixed(4)},{t.lon.toFixed(4)}</span>
                      <span className="text-gray-600">|</span>
                      <span className="text-vigia-success">conf: {(t.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={startProcessing}
              disabled={isProcessing}
              className="px-4 py-2 bg-vigia-success text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Start Detection
            </button>
            <button
              onClick={stopProcessing}
              disabled={!isProcessing}
              className="px-4 py-2 bg-vigia-danger text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              Stop
            </button>
          </div>
        </>
      )}
    </div>
  );
}
