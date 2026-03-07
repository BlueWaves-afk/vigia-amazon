'use client';

import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronRight, Search } from 'lucide-react';

const C = {
  bg:       'var(--c-bg)',
  panel:    'var(--c-panel)',
  elevated: 'var(--c-elevated)',
  border:   'var(--c-border)',
  text:     'var(--c-text)',
  textSec:  'var(--c-text-2)',
  textMut:  'var(--c-text-3)',
  accent:   'var(--c-accent-2)',
  green:    'var(--c-green)',
  red:      'var(--c-red)',
  yellow:   'var(--c-yellow)',
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
  const [hazards, setHazards] = useState<Hazard[]>(() => {
    // Load from sessionStorage on mount
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('vigia-detected-hazards');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });
  const [expandedHazard, setExpandedHazard] = useState<string | null>(null);
  const [currentlyVerifying, setCurrentlyVerifying] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hazardId: string } | null>(null);
  const processingQueue = useRef<string[]>([]);
  const lastProcessedTime = useRef<number>(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Save to sessionStorage whenever hazards change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('vigia-detected-hazards', JSON.stringify(hazards));
    }
  }, [hazards]);

  // Listen for new hazard detections from VideoUploader
  useEffect(() => {
    const handleHazardDetection = (event: CustomEvent) => {
      const { type, lat, lon, confidence, timestamp } = event.detail;
      
      // Calculate geohash to match backend format (geohash#timestamp)
      const geohash = encodeGeohash(lat, lon, 7);
      const hazardId = `${geohash}#${timestamp}`;
      
      // Check if hazard already exists
      setHazards(prev => {
        if (prev.some(h => h.id === hazardId)) {
          return prev; // Skip duplicate
        }
        
        const newHazard: Hazard = {
          id: hazardId,
          type,
          lat,
          lon,
          confidence,
          timestamp,
          status: 'pending',
        };
        
        return [newHazard, ...prev];
      });
      
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

  // Manual verification handler
  const handleVerifyHazard = async (hazardId: string) => {
    const currentHazard = hazards.find(h => h.id === hazardId);
    if (!currentHazard || currentHazard.status !== 'pending') return;

    // Mark as verifying
    setHazards(prev => prev.map(h => 
      h.id === hazardId ? { ...h, status: 'verifying' as HazardStatus } : h
    ));

    // Emit verification start event
    window.dispatchEvent(new CustomEvent('verification-start', {
      detail: { hazardId }
    }));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_TELEMETRY_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod';
      
      const response = await fetch(`${apiUrl}/verify-hazard-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hazardId,
          hazardType: currentHazard.type,
          lat: currentHazard.lat,
          lon: currentHazard.lon,
          confidence: currentHazard.confidence,
          timestamp: currentHazard.timestamp,
          geohash: hazardId.split('#')[0],
        }),
      });

      if (!response.ok) throw new Error(`Verification failed: ${response.status}`);

      const result = await response.json();
      const { traceId, steps, verificationScore, reasoning } = result;

      // Emit steps one by one with delays to simulate streaming
      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, i === 0 ? 0 : 800)); // 800ms between steps
        window.dispatchEvent(new CustomEvent('verification-step', { 
          detail: { step: steps[i] } 
        }));
      }

      // Wait a bit then emit complete with reasoning
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const finalStatus = verificationScore >= 70 ? 'VERIFIED' : 'UNVERIFIED';
      const reasoningText = reasoning || (verificationScore >= 70 
        ? 'Hazard meets verification criteria' 
        : 'Hazard does not meet verification criteria');
      
      window.dispatchEvent(new CustomEvent('verification-complete', {
        detail: { traceId, steps, verificationScore }
      }));
      
      // Emit final reasoning trace
      window.dispatchEvent(new CustomEvent('vigia-trace', {
        detail: { 
          type: 'verification', 
          message: `${finalStatus}: ${currentHazard.type} (score: ${verificationScore}/100)\nReasoning: ${reasoningText}` 
        }
      }));

      const newStatus: HazardStatus = verificationScore >= 70 ? 'verified' : 'rejected';
      setHazards(prev => prev.map(h => 
        h.id === hazardId ? { ...h, status: newStatus, traceId, reasoning, verificationScore } : h
      ));

      // Don't auto-remove - let user see the results

    } catch (error) {
      console.error('[HazardVerificationPanel] Verification error:', error);
      setHazards(prev => prev.map(h => 
        h.id === hazardId ? { ...h, status: 'rejected' as HazardStatus, reasoning: 'Verification failed' } : h
      ));
      // Don't auto-remove on error either
    }
  };

  // Remove auto-queue logic - verification is now manual only

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
      borderRight: `1px solid var(--v-border-default)`,
    }}>
      {/* Header */}
      <div className="vigia-panel-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        height: 32,
        borderBottom: 'none',
        background: C.panel,
      }}>
        <span style={{
          fontSize: '0.62rem',
          color: C.textMut,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontFamily: "var(--v-font-ui)",
        }}>
          VERIFICATION PIPELINE
        </span>
        <span style={{
          fontSize: '0.6rem',
          color: C.textSec,
          fontFamily: "var(--v-font-mono)",
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
              fontFamily: "var(--v-font-ui)",
              textAlign: 'center',
            }}>
              No hazards detected yet
            </div>
            <div style={{
              fontSize: '0.65rem',
              fontFamily: "var(--v-font-ui)",
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
                    border: `1px solid ${currentlyVerifying === hazard.id ? 'var(--c-accent-2)' : C.border}`,
                    borderRadius: 4,
                    overflow: 'hidden',
                    transition: 'border-color 0.3s ease',
                  }}
                >
                  {/* Hazard Header */}
                  <button
                    onClick={() => setExpandedHazard(isExpanded ? null : hazard.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (hazard.status === 'pending') {
                        setContextMenu({ x: e.clientX, y: e.clientY, hazardId: hazard.id });
                      }
                    }}
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
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-hover)')}
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
                        fontFamily: "var(--v-font-ui)",
                        fontWeight: 500,
                      }}>
                        {hazard.type}
                      </div>
                      <div style={{
                        fontSize: '0.62rem',
                        color: C.textMut,
                        fontFamily: "var(--v-font-mono)",
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
                      fontFamily: "var(--v-font-mono)",
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
                      borderTop: `1px solid var(--v-border-subtle)`,
                      background: 'var(--c-elevated)',
                    }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        fontSize: '0.65rem',
                        fontFamily: "var(--v-font-mono)",
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
                            background: 'var(--c-elevated)',
                            borderRadius: 3,
                            border: `1px solid var(--v-border-default)`,
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
      <div className="vigia-sidebar-footer" style={{
        display: 'flex',
        borderTop: 'none',
        background: C.panel,
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0',
          borderRight: `1px solid var(--v-border-subtle)`,
        }}>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: C.yellow,
            fontFamily: "var(--v-font-mono)",
          }}>
            {hazards.filter(h => h.status === 'pending' || h.status === 'unverified').length}
          </span>
          <span style={{
            fontSize: '0.58rem',
            color: C.textMut,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontFamily: "var(--v-font-ui)",
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
          borderRight: `1px solid var(--v-border-subtle)`,
        }}>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: C.accent,
            fontFamily: "var(--v-font-mono)",
          }}>
            {hazards.filter(h => h.status === 'verifying').length}
          </span>
          <span style={{
            fontSize: '0.58rem',
            color: C.textMut,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontFamily: "var(--v-font-ui)",
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
            fontFamily: "var(--v-font-mono)",
          }}>
            {hazards.filter(h => h.status === 'verified').length}
          </span>
          <span style={{
            fontSize: '0.58rem',
            color: C.textMut,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontFamily: "var(--v-font-ui)",
          }}>
            VERIFIED
          </span>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--c-elevated)',
            border: '1px solid var(--v-rose-border)',
            borderRadius: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18), 0 0 0 1px rgba(154,106,170,0.12)',
            zIndex: 1000,
            minWidth: 172,
            padding: '3px 0',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Menu header label */}
          <div style={{
            padding: '4px 10px 5px',
            fontSize: '0.58rem',
            color: 'var(--c-text-3)',
            fontFamily: "var(--v-font-mono)",
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--v-border-subtle)',
            marginBottom: 3,
          }}>
            Hazard Actions
          </div>

          <button
            onClick={() => {
              handleVerifyHazard(contextMenu.hazardId);
              setContextMenu(null);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '0.7rem',
              color: 'var(--c-text)',
              fontFamily: "var(--v-font-ui)",
              transition: 'background 0.1s',
              borderLeft: '2px solid transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--c-hover)';
              e.currentTarget.style.borderLeftColor = 'var(--c-rose-2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderLeftColor = 'transparent';
            }}
          >
            <Search size={12} style={{ color: 'var(--c-rose-2)', flexShrink: 0 }} />
            Verify Hazard
          </button>
        </div>
      )}
    </div>
  );
}
