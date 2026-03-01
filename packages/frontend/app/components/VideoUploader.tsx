'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Film, Key, Play, Square,
  AlertTriangle, CheckCircle, Cpu,
  FileVideo, X, Zap,
} from 'lucide-react';
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

// ─────────────────────────────────────────────
// JetBrains IDE Design Tokens
// ─────────────────────────────────────────────

const C = {
  bg:       '#1E1F22',      // JetBrains dark bg
  panel:    '#2B2D30',      // Tool window bg
  elevated: '#3C3F41',      // Elevated surfaces
  border:   '#393B40',      // Border color
  borderMd: '#4E5157',      // Medium border
  text:     '#BCBEC4',      // Primary text
  textSec:  '#8C8C8C',      // Secondary text  
  textMut:  '#5E6060',      // Muted text
  accent:   '#3574F0',      // JetBrains blue
  accentBrt:'#589DF6',      // Bright blue
  green:    '#59A869',      // Success green
  red:      '#F75464',      // Error red
  yellow:   '#E8BF6A',      // Warning yellow
};

const FONT = "'JetBrains Mono', 'Fira Code', 'Consolas', monospace";

// ─────────────────────────────────────────────
// DropZone
// ─────────────────────────────────────────────

interface DropZoneProps {
  accept:     string;
  onFile:     (f: File) => void;
  label:      string;
  sublabel?:  string;
  icon:       React.ReactNode;
  file?:      File | null;
  compact?:   boolean;
}

function DropZone({ accept, onFile, label, sublabel, icon, file, compact }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, [onFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        borderRadius: 3,
        padding: compact ? '8px 12px' : '14px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        position: 'relative',
        background: C.bg,
        border: `1px solid ${dragOver ? C.accent : C.border}`,
        transition: 'border-color 0.15s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      <div style={{
        width: compact ? 28 : 36,
        height: compact ? 28 : 36,
        borderRadius: 3,
        background: file ? 'rgba(89,168,105,0.15)' : C.elevated,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s',
        color: file ? C.green : dragOver ? C.accentBrt : C.textMut,
      }}>
        {file ? <CheckCircle size={compact ? 12 : 14} /> : icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.72rem', color: C.text, fontWeight: 500, fontFamily: FONT }}>
          {file ? file.name : label}
        </div>
        {file ? (
          <div style={{ fontSize: '0.65rem', color: C.textSec, fontFamily: FONT, marginTop: 2 }}>
            {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'unknown'}
          </div>
        ) : (
          <div style={{ fontSize: '0.65rem', color: C.textMut, fontFamily: FONT, marginTop: 2 }}>
            {sublabel ?? 'Drag & drop or click to browse'}
          </div>
        )}
      </div>

      {file && (
        <div style={{
          fontSize: '0.6rem', padding: '2px 6px', borderRadius: 2,
          background: 'rgba(89,168,105,0.15)', color: C.green,
          fontFamily: FONT, fontWeight: 600,
          flexShrink: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Ready
        </div>
      )}

      {!file && (
        <div style={{ color: C.textMut, flexShrink: 0 }}>
          <Upload size={12} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Detection stat badge
// ─────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 2, padding: '6px 12px',
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderRadius: 3, flex: 1,
    }}>
      <span style={{ fontSize: '0.9rem', fontWeight: 500, color, fontFamily: FONT, lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: '0.6rem', color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: FONT }}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// VideoUploader — ALL original logic preserved
// ─────────────────────────────────────────────

export function VideoUploader() {
  const [videoFile,       setVideoFile]       = useState<File | null>(null);
  const [videoUrl,        setVideoUrl]        = useState<string | null>(null);
  const [isProcessing,    setIsProcessing]    = useState(false);
  const [telemetryBatch,  setTelemetryBatch]  = useState<SignedTelemetry[]>([]);
  const [privateKeyLoaded, setPrivateKeyLoaded] = useState(false);
  const [detectionCount,  setDetectionCount]  = useState(0);
  const [currentDetection, setCurrentDetection] = useState<SignedTelemetry | null>(null);
  const [totalSent,       setTotalSent]       = useState(0);
  const [videoReady,      setVideoReady]      = useState(false);
  const [videoLoading,    setVideoLoading]    = useState(false);
  const [videoError,      setVideoError]      = useState<string | null>(null);
  const [videoDuration,   setVideoDuration]   = useState<number>(0);
  const [videoElement,    setVideoElement]    = useState<HTMLVideoElement | null>(null);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { processFrame, loadPrivateKey } = useHazardDetector();

  const simulatedGPS = { lat: 37.7749, lon: -122.4194 };

  // Callback ref to capture video element when it mounts
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoElement(node);
  }, []);

  // ── Handle video file selection ───────
  const handleVideoFile = useCallback((file: File) => {
    // Cleanup previous video URL
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    
    // Reset states
    setVideoReady(false);
    setVideoLoading(true);
    setVideoError(null);
    setVideoDuration(0);
    setDetectionCount(0);
    setTelemetryBatch([]);
    setCurrentDetection(null);
    
    // Create new URL and set file
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoFile(file);
  }, [videoUrl]);

  // ── Set up video when URL changes and video element exists ───────
  useEffect(() => {
    if (!videoUrl || !videoElement) {
      console.log('[VideoUploader] Waiting for video element or URL', { videoUrl: !!videoUrl, videoElement: !!videoElement });
      return;
    }
    
    const video = videoElement;
    
    console.log('[VideoUploader] Setting up video with URL:', videoUrl);
    
    const handleLoadedMetadata = () => {
      console.log('[VideoUploader] Metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
      setVideoDuration(video.duration);
    };
    
    const handleCanPlay = () => {
      console.log('[VideoUploader] Video can play');
      setVideoLoading(false);
      setVideoReady(true);
    };
    
    const handleLoadedData = () => {
      console.log('[VideoUploader] Video data loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
      // Seek to first frame to show thumbnail
      if (video.currentTime === 0) {
        video.currentTime = 0.001;
      }
    };
    
    const handleError = () => {
      console.error('[VideoUploader] Video failed to load');
      setVideoLoading(false);
      setVideoError('Failed to load video. Please try a different file.');
    };
    
    // Add event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    
    // Set source and load
    video.src = videoUrl;
    video.load();
    
    // Cleanup
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl, videoElement]);

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const handleKeyFile = async (file: File) => {
    const text = await file.text();
    await loadPrivateKey(text);
    setPrivateKeyLoaded(true);
  };

  const extractFrame = (video: HTMLVideoElement): ArrayBuffer => {
    const canvas = document.createElement('canvas');
    // Use actual video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer;
  };

  const drawDetections = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    const ctx    = canvas.getContext('2d')!;
    canvas.width  = video.clientWidth;
    canvas.height = video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentDetection?.bbox) {
      const { x, y, width, height } = currentDetection.bbox;
      
      console.log('[VideoUploader] Drawing bbox:', { x, y, width, height });
      console.log('[VideoUploader] Video dimensions:', video.videoWidth, 'x', video.videoHeight);
      console.log('[VideoUploader] Canvas dimensions:', canvas.width, 'x', canvas.height);
      
      // Bbox is already in original video dimensions, scale to canvas display size
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      
      const x1 = x * scaleX;
      const y1 = y * scaleY;
      const w  = width * scaleX;
      const h  = height * scaleY;
      
      console.log('[VideoUploader] Scaled bbox:', { x1, y1, w, h });

      // Glowing box for dark theme
      ctx.strokeStyle = '#3574F0';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = 'rgba(53,116,240,0.5)';
      ctx.shadowBlur  = 6;
      ctx.strokeRect(x1, y1, w, h);
      ctx.shadowBlur  = 0;

      // Corner marks
      const cs = 8;
      ctx.strokeStyle = '#3574F0';
      ctx.lineWidth   = 2;
      [
        [x1, y1, x1+cs, y1, x1, y1+cs],
        [x1+w-cs, y1, x1+w, y1, x1+w, y1+cs],
        [x1, y1+h-cs, x1, y1+h, x1+cs, y1+h],
        [x1+w-cs, y1+h, x1+w, y1+h, x1+w, y1+h-cs],
      ].forEach(([ax, ay, bx, by, cx, cy]) => {
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke();
      });

      // Label
      const label = `POTHOLE  ${(currentDetection.confidence * 100).toFixed(0)}%`;
      ctx.font = '9px JetBrains Mono, Consolas, monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = '#2B2D30';
      ctx.fillRect(x1, y1 - 16, tw + 8, 14);
      ctx.fillStyle = '#3574F0';
      ctx.fillText(label, x1 + 4, y1 - 5);
    }
  };

  const startProcessing = () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    setDetectionCount(0);
    videoRef.current.play();
    intervalRef.current = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused) {
        const frameBuffer = extractFrame(videoRef.current);
        const width = videoRef.current.videoWidth || 640;
        const height = videoRef.current.videoHeight || 640;
        const result = await processFrame(frameBuffer, width, height, { lat: simulatedGPS.lat, lon: simulatedGPS.lon });
        if (result) {
          setTelemetryBatch(prev => [...prev, result]);
          setDetectionCount(prev => prev + 1);
          setCurrentDetection(result);
          setTimeout(() => setCurrentDetection(null), 100);
        }
      }
    }, 200);
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    videoRef.current?.pause();
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => { drawDetections(); }, [currentDetection]);

  // Batch send — original logic preserved
  useEffect(() => {
    if (!isProcessing) return;
    const batchInterval = setInterval(async () => {
      // Use functional update to get latest state without dependency
      setTelemetryBatch(currentBatch => {
        console.log('[VideoUploader] Batch check - telemetry count:', currentBatch.length);
        if (currentBatch.length > 0) {
          console.log('[VideoUploader] Sending batch of', currentBatch.length, 'telemetry items');
          // Send telemetry sequentially to avoid rate limits
          (async () => {
            for (const telemetry of currentBatch) {
              try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/telemetry`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(telemetry),
                });
                if (!response.ok) {
                  console.error('Failed to send telemetry:', await response.text());
                  window.dispatchEvent(new CustomEvent('vigia-trace', {
                    detail: { type: 'error', message: `Telemetry submission failed: ${response.statusText}` }
                  }));
                } else {
                  setTotalSent(p => p + 1);
                  console.log('[VideoUploader] Telemetry sent:', telemetry.hazardType, 'confidence:', telemetry.confidence);
                  window.dispatchEvent(new CustomEvent('vigia-trace', {
                    detail: { 
                      type: 'success', 
                      message: `Telemetry sent: ${telemetry.hazardType} (confidence: ${(telemetry.confidence * 100).toFixed(1)}%)`
                    }
                  }));
                }
              } catch (error) {
                console.error('Network error:', error);
                window.dispatchEvent(new CustomEvent('vigia-trace', {
                  detail: { type: 'error', message: `Network error: ${error}` }
                }));
              }
            }
          })();
          return []; // Clear batch
        }
        return currentBatch; // Keep batch
      });
    }, 5000);
    return () => clearInterval(batchInterval);
  }, [isProcessing]); // Remove telemetryBatch dependency

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Page header ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <Film size={14} style={{ color: C.accent }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 500, color: C.text, fontFamily: FONT }}>
              Sentinel Eye
            </span>
          </div>
          <p style={{ fontSize: '0.68rem', color: C.textMut, fontFamily: FONT, margin: 0 }}>
            ONNX inference · real-time detection · edge telemetry
          </p>
        </div>

        {isProcessing && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 8px', borderRadius: 3,
            background: 'rgba(247,84,100,0.12)',
            border: `1px solid ${C.border}`,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.red }} className="pulse" />
            <span style={{ fontSize: '0.65rem', color: C.red, fontFamily: FONT, fontWeight: 500 }}>
              SCANNING
            </span>
          </div>
        )}
      </div>

      {/* ── Upload section ────────────────── */}
      <div style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '6px 12px',
          borderBottom: `1px solid ${C.border}`,
          background: C.elevated,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Upload size={10} style={{ color: C.textMut }} />
          <span style={{ fontSize: '0.65rem', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: FONT, fontWeight: 500 }}>
            Input Files
          </span>
        </div>

        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <DropZone
            accept="video/*"
            onFile={handleVideoFile}
            label="Drop video file here"
            sublabel="MP4, MOV, AVI — Drag & drop or click to browse"
            icon={<FileVideo size={18} />}
            file={videoFile}
          />
          <DropZone
            accept=".pem"
            onFile={handleKeyFile}
            label="Drop private key (.pem)"
            sublabel="Optional — test mode enabled without key"
            icon={<Key size={16} />}
            file={null}
            compact
          />
          {privateKeyLoaded && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 2,
              background: 'rgba(89,168,105,0.1)',
              border: `1px solid ${C.border}`,
            }}>
              <CheckCircle size={10} style={{ color: C.green }} />
              <span style={{ fontSize: '0.65rem', color: C.green, fontFamily: FONT }}>
                Private key loaded · signing enabled
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Video + detection ─────────────── */}
      {videoFile && (
        <>
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 3,
            overflow: 'hidden',
          }}>
            {/* Video toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px',
              borderBottom: `1px solid ${C.border}`,
              background: C.elevated,
            }}>
              <Film size={10} style={{ color: C.textMut }} />
              <span style={{ fontSize: '0.65rem', color: C.textSec, fontFamily: FONT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {videoFile.name}
              </span>
              {videoReady && videoDuration > 0 && (
                <span style={{ 
                  fontSize: '0.6rem', 
                  color: C.textMut, 
                  fontFamily: FONT,
                  padding: '1px 5px',
                  background: C.bg,
                  borderRadius: 2,
                }}>
                  {Math.floor(videoDuration / 60)}:{String(Math.floor(videoDuration % 60)).padStart(2, '0')}
                </span>
              )}
              {videoReady && videoElement && (
                <span style={{ 
                  fontSize: '0.6rem', 
                  color: C.textMut, 
                  fontFamily: FONT,
                  padding: '1px 5px',
                  background: C.bg,
                  borderRadius: 2,
                }}>
                  {videoElement.videoWidth}×{videoElement.videoHeight}
                </span>
              )}
              <button
                onClick={() => { 
                  if (videoUrl) {
                    URL.revokeObjectURL(videoUrl);
                  }
                  setVideoFile(null); 
                  setVideoUrl(null);
                  setVideoReady(false);
                  setVideoLoading(false);
                  setVideoError(null);
                  setVideoDuration(0);
                  stopProcessing(); 
                }}
                style={{
                  background: 'none', border: 'none',
                  color: C.textMut, cursor: 'pointer', display: 'flex', padding: 2,
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = C.red}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = C.textMut}
              >
                <X size={12} />
              </button>
            </div>

            {/* Video canvas */}
            <div style={{ position: 'relative', background: '#18191B', aspectRatio: '16/9' }}>
              <video 
                ref={videoCallbackRef} 
                playsInline
                muted
                preload="metadata"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain', 
                  display: 'block',
                  opacity: videoReady ? 1 : 0,
                  transition: 'opacity 0.15s',
                }} 
              />
              <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

              {/* Loading overlay */}
              {videoLoading && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: C.bg,
                  gap: 10,
                }}>
                  <div className="spinner" style={{
                    width: 24, height: 24,
                    border: `2px solid ${C.border}`,
                    borderTopColor: C.accent,
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <span style={{ fontSize: '0.68rem', color: C.textMut, fontFamily: FONT }}>
                    Loading video...
                  </span>
                </div>
              )}

              {/* Error overlay */}
              {videoError && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: C.bg,
                  gap: 8,
                }}>
                  <AlertTriangle size={20} style={{ color: C.red }} />
                  <span style={{ fontSize: '0.68rem', color: C.red, fontFamily: FONT, textAlign: 'center', maxWidth: 200 }}>
                    {videoError}
                  </span>
                </div>
              )}

              {/* LIVE badge */}
              {isProcessing && (
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 6px', borderRadius: 2,
                  background: 'rgba(30,31,34,0.92)',
                  border: `1px solid ${C.border}`,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.red }} className="pulse" />
                  <span style={{ fontSize: '0.6rem', color: C.red, fontFamily: FONT, fontWeight: 500, letterSpacing: '0.04em' }}>
                    LIVE
                  </span>
                </div>
              )}

              {/* Detection counter */}
              {isProcessing && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  padding: '3px 6px', borderRadius: 2,
                  background: 'rgba(30,31,34,0.92)',
                  border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Zap size={9} style={{ color: C.yellow }} />
                    <span style={{ fontSize: '0.6rem', color: C.text, fontFamily: FONT }}>
                      {detectionCount} detections
                    </span>
                  </div>
                </div>
              )}

              {/* Telemetry log overlay */}
              {isProcessing && telemetryBatch.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(30,31,34,0.95)',
                  borderTop: `1px solid ${C.border}`,
                  padding: '5px 8px',
                }}>
                  {telemetryBatch.slice(-3).map((t, i) => (
                    <div key={i} className="log-line" style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: '0.6rem', color: C.textSec,
                      fontFamily: FONT,
                      marginBottom: i < 2 ? 2 : 0,
                    }}>
                      <span style={{ color: C.textMut }}>›</span>
                      <span style={{ color: C.red }}>{t.hazardType}</span>
                      <span style={{ color: C.textMut }}>@</span>
                      <span>{t.lat.toFixed(4)},{t.lon.toFixed(4)}</span>
                      <span style={{ color: C.textMut }}>│</span>
                      <span style={{ color: C.accent }}>conf: {(t.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Stats row ─────────────────── */}
          {isProcessing && (
            <div style={{ display: 'flex', gap: 6 }}>
              <StatBadge label="Detections" value={detectionCount} color={C.red}    />
              <StatBadge label="Transmitted" value={totalSent}     color={C.green}  />
              <StatBadge label="Queued"      value={telemetryBatch.length} color={C.yellow} />
              <StatBadge label="FPS"         value="5"             color={C.accent} />
            </div>
          )}

          {/* ── Controls ──────────────────── */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={startProcessing}
              disabled={isProcessing || !videoReady}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 3,
                border: 'none',
                background: (isProcessing || !videoReady) ? C.elevated : C.accent,
                color: (isProcessing || !videoReady) ? C.textMut : '#fff',
                fontSize: '0.7rem', fontWeight: 500,
                cursor: (isProcessing || !videoReady) ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
                transition: 'all 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!isProcessing && videoReady) (e.currentTarget as HTMLElement).style.background = '#4A8AF4';
              }}
              onMouseLeave={(e) => {
                if (!isProcessing && videoReady) (e.currentTarget as HTMLElement).style.background = C.accent;
              }}
            >
              <Play size={12} />
              Start Detection
            </button>

            <button
              onClick={stopProcessing}
              disabled={!isProcessing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 3,
                border: `1px solid ${C.border}`,
                background: isProcessing ? 'rgba(247,84,100,0.1)' : C.panel,
                color: isProcessing ? C.red : C.textMut,
                fontSize: '0.7rem', fontWeight: 500,
                cursor: !isProcessing ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
                transition: 'all 0.1s',
              }}
            >
              <Square size={12} />
              Stop
            </button>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 8px', borderRadius: 2,
                background: C.bg,
                border: `1px solid ${C.border}`,
              }}>
                <Cpu size={10} style={{ color: C.textMut }} />
                <span style={{ fontSize: '0.62rem', color: C.textMut, fontFamily: FONT }}>
                  ONNX · 5fps · edge-signed
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
