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
      
      // Draw black bounding box (monochrome)
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, w, h);
      
      // Draw label with white background
      const label = `POTHOLE ${(currentDetection.confidence * 100).toFixed(0)}%`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(x1, y1 - 16, ctx.measureText(label).width + 8, 16);
      ctx.fillStyle = '#000000';
      ctx.font = '10px monospace';
      ctx.fillText(label, x1 + 4, y1 - 5);
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
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-ui text-ide-text-secondary mb-1">
          Upload Private Key (optional - test mode enabled)
        </label>
        <input
          type="file"
          accept=".pem"
          onChange={handleKeyUpload}
          className="block w-full text-xs text-ide-text-secondary file:mr-2 file:py-1 file:px-3 file:border file:border-ide-border file:text-xs file:bg-ide-panel file:text-ide-text hover:file:bg-ide-hover file:rounded"
        />
        {privateKeyLoaded && (
          <p className="text-xs text-ide-text mt-1">✓ Key loaded</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-ui text-ide-text-secondary mb-1">
          Upload Video
        </label>
        <input
          type="file"
          accept="video/*"
          onChange={handleUpload}
          className="block w-full text-xs text-ide-text-secondary file:mr-2 file:py-1 file:px-3 file:border file:border-ide-border file:text-xs file:bg-ide-panel file:text-ide-text hover:file:bg-ide-hover file:rounded"
        />
      </div>

      {videoFile && (
        <>
          <div className="relative w-full aspect-video bg-black border border-ide-border">
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
              <div className="absolute top-2 right-2 bg-ide-panel/90 backdrop-blur-sm px-2 py-1 border border-ide-border z-10">
                <div className="text-ide-text font-data text-[10px]">
                  HAZARDS: {detectionCount}
                </div>
              </div>
            )}

            {/* Live Scanning Indicator */}
            {isProcessing && (
              <div className="absolute top-2 left-2 flex items-center gap-2 bg-ide-panel/90 backdrop-blur-sm px-2 py-1 border border-ide-border z-10">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-500 font-data text-[10px]">LIVE</span>
              </div>
            )}

            {/* Telemetry Log Overlay */}
            {isProcessing && telemetryBatch.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-ide-panel/90 backdrop-blur-sm p-2 border-t border-ide-border z-10">
                <div className="font-data text-[9px] space-y-0.5 max-h-16 overflow-y-auto">
                  {telemetryBatch.slice(-3).map((t, i) => (
                    <div key={i} className="text-ide-text-secondary flex items-center gap-1">
                      <span className="text-ide-text-tertiary">&gt;</span>
                      <span className="text-ide-text">{t.hazardType}</span>
                      <span className="text-ide-text-tertiary">@</span>
                      <span>{t.lat.toFixed(4)},{t.lon.toFixed(4)}</span>
                      <span className="text-ide-text-tertiary">|</span>
                      <span>conf: {(t.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={startProcessing}
              disabled={isProcessing}
              className="px-3 py-1 text-xs font-ui bg-ide-panel border border-ide-border text-ide-text hover:bg-ide-hover disabled:opacity-50 transition-colors"
            >
              Start Detection
            </button>
            <button
              onClick={stopProcessing}
              disabled={!isProcessing}
              className="px-3 py-1 text-xs font-ui bg-ide-panel border border-ide-border text-ide-text hover:bg-ide-hover disabled:opacity-50 transition-colors"
            >
              Stop
            </button>
          </div>
        </>
      )}
    </div>
  );
}
