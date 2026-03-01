'use client';

import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

const C = {
  bg: '#141920',
  panel: '#1E2530',
  border: 'rgba(255,255,255,0.07)',
  text: '#DDE3ED',
  textSec: '#7C8799',
  textMut: '#3D4655',
  accent: '#3B82F6',
  green: '#0EA472',
  red: '#E5484D',
  yellow: '#E9A23B',
};

// Simple Geohash Encoder (7 chars precision)
function encodeGeohash(lat: number, lon: number, precision: number = 7): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon > lonMid) {
        idx = (idx << 1) + 1;
        lonMin = lonMid;
      } else {
        idx = idx << 1;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat > latMid) {
        idx = (idx << 1) + 1;
        latMin = latMid;
      } else {
        idx = idx << 1;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

type HazardStatus = 'pending' | 'unverified' | 'verifying' | 'verified' | 'rejected';

interface Hazard {
  id: string;
  type: string;
  lat: number;
  lon: number;
  confidence: number;
  timestamp: string;
  status: HazardStatus;
  traceId?: string;
  reasoning?: string;
  verificationScore?: number;
}

interface HazardVerificationPanelProps {
  onHazardDetected?: (hazard: Omit<Hazard, 'id' | 'status'>) => void;
}

export function HazardVerificationPanel({ onHazardDetected }: HazardVerificationPanelProps) {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [expandedHazard, setExpandedHazard] = useState<string | null>(null);
  const [currentlyVerifying, setCurrentlyVerifying] = useState<string | null>(null);
  const processingQueue = useRef<string[]>([]);
  const lastProcessedTime = useRef<number>(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Listen for new hazard detections from VideoUploader
  useEffect(() => {
    const handleHazardDetection = (event: CustomEvent) => {
      const { type, lat, lon, confidence, timestamp } = event.detail;
      
      // Calculate geohash to match backend format (geohash#timestamp)
      const geohash = encodeGeohash(lat, lon, 7);
      const hazardId = `${geohash}#${timestamp}`;
      
      const newHazard: Hazard = {
        id: hazardId,
        type,
        lat,
        lon,
        confidence,
        timestamp,
        status: 'pending',
      };
      
      setHazards(prev => [newHazard, ...prev]);
      
      // Emit trace event
      window.dispatchEvent(new CustomEvent('vigia-trace', {
        detail: { 
          type: 'detection', 
          message: `Hazard detected: ${type} at ${lat.toFixed(4)}, ${lon.toFixed(4)} (confidence: ${(confidence * 100).toFixed(1)}%)` 
        }
      }));
    };

    window.addEventListener('hazard-detected', handleHazardDetection as EventListener);
    return () => window.removeEventListener('hazard-detected', handleHazardDetection as EventListener);
  }, []);

  // Listen for telemetry submission events
  useEffect(() => {
    const handleTelemetrySubmit = (event: CustomEvent) => {
      const { hazardIds } = event.detail;
      
      setHazards(prev => prev.map(h => 
        hazardIds.includes(h.id) && h.status === 'pending'
          ? { ...h, status: 'unverified' as HazardStatus }
          : h
      ));

      // Add to processing queue
      hazardIds.forEach((id: string) => {
        if (!processingQueue.current.includes(id)) {
          processingQueue.current.push(id);
          
          // Emit console event
          window.dispatchEvent(new CustomEvent('vigia-trace', {
            detail: { 
              type: 'info', 
              message: `📋 Hazard queued for verification: ${id.split('#')[0]}` 
            }
          }));
        }
      });

      // Process queue
      processNextHazard();
    };

    window.addEventListener('telemetry-submitted', handleTelemetrySubmit as EventListener);
    return () => window.removeEventListener('telemetry-submitted', handleTelemetrySubmit as EventListener);
  }, []);

  // Process next hazard in queue if cooldown allows
  const processNextHazard = () => {
    if (currentlyVerifying || processingQueue.current.length === 0) return;
    
    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessedTime.current;
    const cooldownMs = 35000; // 35 seconds
    
    if (timeSinceLastProcess < cooldownMs && lastProcessedTime.current > 0) {
      const waitTime = Math.ceil((cooldownMs - timeSinceLastProcess) / 1000);
      window.dispatchEvent(new CustomEvent('vigia-trace', {
        detail: { 
          type: 'info', 
          message: `⏳ Cooldown active: waiting ${waitTime}s before next verification` 
        }
      }));
      
      // Schedule next check
      setTimeout(processNextHazard, cooldownMs - timeSinceLastProcess);
      return;
    }
    
    // Process next hazard
    const nextHazardId = processingQueue.current.shift();
    if (nextHazardId) {
      setCurrentlyVerifying(nextHazardId);
      lastProcessedTime.current = now;
      pollAgentTrace(nextHazardId);
    }
  };

  const pollAgentTrace = async (hazardId: string) => {
    // Check if we should use simulation mode (when backend isn't available)
    const useSimulation = process.env.NEXT_PUBLIC_SIMULATE_AGENT === 'true'; // Backend is now operational
    
    if (useSimulation) {
      // Simulate agent verification with realistic timing
      console.log('[HazardVerificationPanel] Using simulation mode for:', hazardId);
      
      // Capture hazard confidence before async operations (avoid stale closure)
      const currentHazard = hazards.find(h => h.id === hazardId);
      const hazardConfidence = currentHazard?.confidence ?? 0.5;
      
      // Mark as verifying
      setHazards(prev => prev.map(h => 
        h.id === hazardId ? { ...h, status: 'verifying' as HazardStatus } : h
      ));
      
      // Simulate agent thinking time (2-4 seconds)
      const thinkTime = 2000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, thinkTime));
      
      // Simulate verification result (80% verified, 20% rejected based on confidence)
      const verificationScore = hazardConfidence >= 0.5 
        ? Math.floor(70 + Math.random() * 25) // 70-95 for high confidence
        : Math.floor(40 + Math.random() * 30); // 40-70 for low confidence
      
      const newStatus: HazardStatus = verificationScore >= 70 ? 'verified' : 'rejected';
      const reasoning = newStatus === 'verified' 
        ? `[Simulated] Hazard analysis complete. Visual features match pothole characteristics with ${verificationScore}% confidence. Road surface damage detected with clear boundary definition.`
        : `[Simulated] Hazard analysis inconclusive. Verification score ${verificationScore}% below threshold. May require additional telemetry data.`;
      
      setHazards(prev => prev.map(h => 
        h.id === hazardId 
          ? { ...h, status: newStatus, traceId: `sim-${Date.now()}`, reasoning, verificationScore }
          : h
      ));

      // Emit trace event for console viewer
      window.dispatchEvent(new CustomEvent('vigia-trace', {
        detail: { 
          type: 'verification', 
          message: `[SIM] Hazard ${hazardId.substring(0, 7)}... ${newStatus} (score: ${verificationScore})` 
        }
      }));

      // Emit agent trace update for ReasoningTraceViewer
      window.dispatchEvent(new CustomEvent('agent-trace-update', {
        detail: { 
          hazardId,
          reasoning,
          verificationScore
        }
      }));

      // Remove verified/rejected hazards after 5 seconds
      setTimeout(() => {
        setHazards(prev => prev.filter(h => h.id !== hazardId));
      }, 5000);
      
      return;
    }
    
    // Real API polling mode
    const maxAttempts = 30; // Poll for up to 60 seconds (2s intervals)
    let attempts = 0;
    
    // Mark as verifying and scroll to it
    setHazards(prev => prev.map(h => 
      h.id === hazardId ? { ...h, status: 'verifying' as HazardStatus } : h
    ));
    
    // Auto-expand and scroll to current hazard
    setExpandedHazard(hazardId);
    setTimeout(() => {
      const element = document.getElementById(`hazard-${hazardId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    // Emit agent thinking event
    window.dispatchEvent(new CustomEvent('vigia-trace', {
      detail: { 
        type: 'info', 
        message: `🤖 Agent analyzing hazard: ${hazardId.split('#')[0]}` 
      }
    }));

    const poll = async () => {
      attempts++;
      
      if (attempts === 1) {
        window.dispatchEvent(new CustomEvent('vigia-trace', {
          detail: { type: 'info', message: `🔍 Querying database for similar hazards...` }
        }));
      } else if (attempts === 5) {
        window.dispatchEvent(new CustomEvent('vigia-trace', {
          detail: { type: 'info', message: `⚙️ Agent calculating verification score...` }
        }));
      }
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod';
        // URL-encode the hazardId (especially the # character)
        const encodedHazardId = encodeURIComponent(hazardId);
        const response = await fetch(`${apiUrl}/traces/${encodedHazardId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            // Trace not ready yet, retry
            if (attempts < maxAttempts) {
              attempts++;
              setTimeout(poll, 2000); // Poll every 2 seconds for faster feedback
            } else {
              // Timeout - mark as unverified
              console.warn(`[HazardVerificationPanel] Trace not found after max attempts: ${hazardId}`);
              setHazards(prev => prev.map(h => 
                h.id === hazardId ? { ...h, status: 'unverified' as HazardStatus } : h
              ));
            }
          } else {
            // Other error (500, etc) - retry
            console.warn(`[HazardVerificationPanel] API error ${response.status} for ${hazardId}, retrying...`);
            if (attempts < maxAttempts) {
              attempts++;
              setTimeout(poll, 2000);
            } else {
              // Max retries on error - mark as unverified
              console.error(`[HazardVerificationPanel] API error after max attempts for ${hazardId}`);
              setHazards(prev => prev.map(h => 
                h.id === hazardId ? { ...h, status: 'unverified' as HazardStatus } : h
              ));
            }
          }
          return;
        }

        const data = await response.json();
        
        if (data.trace) {
          const { traceId, reasoning, verificationScore } = data.trace;
          const newStatus: HazardStatus = verificationScore >= 70 ? 'verified' : 'rejected';
          
          // Emit decision message
          window.dispatchEvent(new CustomEvent('vigia-trace', {
            detail: { 
              type: newStatus === 'verified' ? 'success' : 'warning', 
              message: `✅ Agent decision: ${newStatus.toUpperCase()} (score: ${verificationScore})` 
            }
          }));
          
          setHazards(prev => prev.map(h => 
            h.id === hazardId 
              ? { ...h, status: newStatus, traceId, reasoning, verificationScore }
              : h
          ));

          // Emit trace event for console viewer
          window.dispatchEvent(new CustomEvent('vigia-trace', {
            detail: { 
              type: 'verification', 
              message: `Hazard ${hazardId} ${newStatus} (score: ${verificationScore})` 
            }
          }));

          // Emit agent trace update for ReasoningTraceViewer
          window.dispatchEvent(new CustomEvent('agent-trace-update', {
            detail: { 
              hazardId,
              reasoning,
              verificationScore
            }
          }));

          // Remove verified/rejected hazards after 5 seconds
          setTimeout(() => {
            setHazards(prev => prev.filter(h => h.id !== hazardId));
          }, 5000);
          
          // Mark as no longer processing and process next in queue
          setCurrentlyVerifying(null);
          setTimeout(processNextHazard, 100);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          // Max attempts reached with valid response but no trace - mark as unverified
          console.warn('[HazardVerificationPanel] No trace found after max attempts:', hazardId);
          setHazards(prev => prev.map(h => 
            h.id === hazardId ? { ...h, status: 'unverified' as HazardStatus } : h
          ));
        }
      } catch (error) {
        // Network error or fetch failed - retry
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          console.error('[HazardVerificationPanel] Failed to fetch agent trace after max attempts:', hazardId);
          // Mark as unverified on network failure
          setHazards(prev => prev.map(h => 
            h.id === hazardId ? { ...h, status: 'unverified' as HazardStatus } : h
          ));
        }
      }
    };

    // Mark as verifying
    setHazards(prev => prev.map(h => 
      h.id === hazardId ? { ...h, status: 'verifying' as HazardStatus } : h
    ));

    poll();
  };

  const getStatusConfig = (status: HazardStatus) => {
    switch (status) {
      case 'pending':
        return { icon: <Clock size={12} />, color: C.yellow, label: 'PENDING' };
      case 'unverified':
        return { icon: <AlertTriangle size={12} />, color: C.yellow, label: 'UNVERIFIED' };
      case 'verifying':
        return { icon: <Loader2 size={12} className="animate-spin" />, color: C.accent, label: 'VERIFYING' };
      case 'verified':
        return { icon: <CheckCircle size={12} />, color: C.green, label: 'VERIFIED' };
      case 'rejected':
        return { icon: <XCircle size={12} />, color: C.red, label: 'REJECTED' };
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: C.bg,
      borderRight: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        height: 32,
        borderBottom: `1px solid ${C.border}`,
        background: C.panel,
      }}>
        <span style={{
          fontSize: '0.62rem',
          color: C.textMut,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontFamily: 'Inter, sans-serif',
        }}>
          VERIFICATION PIPELINE
        </span>
        <span style={{
          fontSize: '0.6rem',
          color: C.textSec,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {hazards.length} active
        </span>
      </div>

      {/* Hazard List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
      }}>
        {hazards.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
            color: C.textMut,
          }}>
            <AlertTriangle size={32} style={{ opacity: 0.3 }} />
            <div style={{
              fontSize: '0.75rem',
              fontFamily: 'Inter, sans-serif',
              textAlign: 'center',
            }}>
              No hazards detected yet
            </div>
            <div style={{
              fontSize: '0.65rem',
              fontFamily: 'Inter, sans-serif',
              textAlign: 'center',
              maxWidth: 200,
            }}>
              Upload dashcam footage to start detection
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hazards.map(hazard => {
              const statusConfig = getStatusConfig(hazard.status);
              const isExpanded = expandedHazard === hazard.id;
              
              return (
                <div
                  id={`hazard-${hazard.id}`}
                  key={hazard.id}
                  style={{
                    background: C.panel,
                    border: `1px solid ${currentlyVerifying === hazard.id ? '#3574F0' : C.border}`,
                    borderRadius: 4,
                    overflow: 'hidden',
                    transition: 'border-color 0.3s ease',
                  }}
                >
                  {/* Hazard Header */}
                  <button
                    onClick={() => setExpandedHazard(isExpanded ? null : hazard.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Expand Icon */}
                    <span style={{ color: C.textMut, flexShrink: 0 }}>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>

                    {/* Status Icon */}
                    <span style={{ color: statusConfig.color, flexShrink: 0 }}>
                      {statusConfig.icon}
                    </span>

                    {/* Hazard Info */}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{
                        fontSize: '0.72rem',
                        color: C.text,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                      }}>
                        {hazard.type}
                      </div>
                      <div style={{
                        fontSize: '0.62rem',
                        color: C.textMut,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {hazard.lat.toFixed(4)}, {hazard.lon.toFixed(4)}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span style={{
                      fontSize: '0.58rem',
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: `${statusConfig.color}22`,
                      color: statusConfig.color,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {statusConfig.label}
                    </span>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{
                      padding: '8px 10px',
                      borderTop: `1px solid ${C.border}`,
                      background: 'rgba(0,0,0,0.2)',
                    }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        fontSize: '0.65rem',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: C.textMut }}>Confidence:</span>
                          <span style={{ color: C.textSec }}>{(hazard.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: C.textMut }}>Timestamp:</span>
                          <span style={{ color: C.textSec }}>
                            {new Date(hazard.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {hazard.verificationScore !== undefined && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: C.textMut }}>Verification:</span>
                            <span style={{ 
                              color: hazard.verificationScore >= 70 ? C.green : C.red,
                              fontWeight: 600,
                            }}>
                              {hazard.verificationScore}/100
                            </span>
                          </div>
                        )}
                        {hazard.reasoning && (
                          <div style={{
                            marginTop: 6,
                            padding: 8,
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: 3,
                            border: `1px solid ${C.border}`,
                          }}>
                            <div style={{
                              fontSize: '0.6rem',
                              color: C.textMut,
                              marginBottom: 4,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}>
                              Agent Reasoning:
                            </div>
                            <div style={{
                              fontSize: '0.62rem',
                              color: C.textSec,
                              lineHeight: 1.4,
                              maxHeight: 100,
                              overflowY: 'auto',
                            }}>
                              {hazard.reasoning}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div style={{
        display: 'flex',
        borderTop: `1px solid ${C.border}`,
        background: C.panel,
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0',
          borderRight: `1px solid ${C.border}`,
        }}>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: C.yellow,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {hazards.filter(h => h.status === 'pending' || h.status === 'unverified').length}
          </span>
          <span style={{
            fontSize: '0.58rem',
            color: C.textMut,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontFamily: 'Inter, sans-serif',
          }}>
            PENDING
          </span>
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0',
          borderRight: `1px solid ${C.border}`,
        }}>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: C.accent,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {hazards.filter(h => h.status === 'verifying').length}
          </span>
          <span style={{
            fontSize: '0.58rem',
            color: C.textMut,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontFamily: 'Inter, sans-serif',
          }}>
            VERIFYING
          </span>
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0',
        }}>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: C.green,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {hazards.filter(h => h.status === 'verified').length}
          </span>
          <span style={{
            fontSize: '0.58rem',
            color: C.textMut,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontFamily: 'Inter, sans-serif',
          }}>
            VERIFIED
          </span>
        </div>
      </div>
    </div>
  );
}
