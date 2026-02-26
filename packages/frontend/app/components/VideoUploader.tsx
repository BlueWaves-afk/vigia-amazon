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
};

export function VideoUploader() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetryBatch, setTelemetryBatch] = useState<SignedTelemetry[]>([]);
  const [privateKeyLoaded, setPrivateKeyLoaded] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const startProcessing = () => {
    if (!videoRef.current || !privateKeyLoaded) return;
    
    setIsProcessing(true);
    videoRef.current.play();

    // Extract frames at 5 FPS (every 200ms)
    intervalRef.current = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused) {
        const frameBuffer = extractFrame(videoRef.current);
        const result = await processFrame(frameBuffer, simulatedGPS);
        
        if (result) {
          setTelemetryBatch(prev => [...prev, result]);
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
          Upload Private Key (for testing)
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
          disabled={!privateKeyLoaded}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-vigia-accent file:text-white hover:file:bg-blue-600 disabled:opacity-50"
        />
      </div>

      {videoFile && (
        <>
          <video
            ref={videoRef}
            controls
            className="w-full rounded border border-gray-700"
          />

          <div className="flex gap-2">
            <button
              onClick={startProcessing}
              disabled={isProcessing || !privateKeyLoaded}
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

      {/* Telemetry Feed */}
      <div className="bg-black text-green-400 font-mono text-xs p-2 h-32 overflow-y-auto rounded">
        {telemetryBatch.map((t, i) => (
          <div key={i}>
            [{t.timestamp}] {t.hazardType} @ {t.lat.toFixed(4)},{t.lon.toFixed(4)} (conf: {t.confidence.toFixed(2)})
          </div>
        ))}
      </div>
    </div>
  );
}
