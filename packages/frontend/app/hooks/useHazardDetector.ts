'use client';

import { useEffect, useRef } from 'react';
import { wrap, Remote } from 'comlink';

type HazardDetectorWorker = {
  loadModel(): Promise<void>;
  importPrivateKey(pemKey: string): Promise<void>;
  processFrame(
    frameBuffer: ArrayBuffer,
    size: { width: number; height: number },
    gpsCoords: { lat: number; lon: number }
  ): Promise<any | null>;
};

export function useHazardDetector() {
  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<Remote<HazardDetectorWorker> | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/hazard-detector.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current = worker;
    apiRef.current = wrap<HazardDetectorWorker>(worker);

    // Load model async (don’t block UI)
    apiRef.current.loadModel().catch(console.error);

    return () => {
      worker.terminate();
      workerRef.current = null;
      apiRef.current = null;
    };
  }, []);

  const loadPrivateKey = async (pemKey: string) => {
    if (!apiRef.current) return;
    await apiRef.current.importPrivateKey(pemKey);
  };

  /**
   * Pass frame + dimensions (CRITICAL)
   */
  const processFrame = async (
    frameBuffer: ArrayBuffer,
    width: number,
    height: number,
    gpsCoords: { lat: number; lon: number }
  ) => {
    if (!apiRef.current) return null;

    if (!width || !height) {
      console.warn('[HazardDetector] Invalid frame size:', width, height);
      return null;
    }

    return apiRef.current.processFrame(
      frameBuffer,
      { width, height }, // ✅ REQUIRED FIX
      gpsCoords
    );
  };

  return {
    processFrame,
    loadPrivateKey,
  };
}