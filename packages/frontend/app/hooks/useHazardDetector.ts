'use client';

import { useEffect, useRef } from 'react';
import { wrap, Remote } from 'comlink';

type HazardDetectorWorker = {
  loadModel(): Promise<void>;
  importPrivateKey(pemKey: string): Promise<void>;
  processFrame(
    frameBuffer: ArrayBuffer,
    gpsCoords: { lat: number; lon: number }
  ): Promise<any | null>;
};

export function useHazardDetector() {
  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<Remote<HazardDetectorWorker> | null>(null);

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(
      new URL('../workers/hazard-detector.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    apiRef.current = wrap<HazardDetectorWorker>(workerRef.current);
    apiRef.current.loadModel();

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const loadPrivateKey = async (pemKey: string) => {
    await apiRef.current?.importPrivateKey(pemKey);
  };

  const processFrame = async (
    frameBuffer: ArrayBuffer,
    gpsCoords: { lat: number; lon: number }
  ) => {
    return apiRef.current?.processFrame(frameBuffer, gpsCoords);
  };

  return { processFrame, loadPrivateKey };
}
