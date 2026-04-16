'use client';

import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { useAgentTraceStore } from '../../stores/agentTraceStore';

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

type HazardStatus = 'pending' | 'processing' | 'verified' | 'verified_no_reward' | 'rejected' | 'vlm_failed';

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
  deviceAddress?: string;
  signPayload?: (s: string) => Promise<string>;
}

export function HazardVerificationPanel({ onHazardDetected, deviceAddress, signPayload }: HazardVerificationPanelProps) {
  const [hazards, setHazards] = useState<Hazard[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('vigia-detected-hazards');
      if (saved) { try { return JSON.parse(saved); } catch { return []; } }
    }
    return [];
  });
  const [expandedHazard, setExpandedHazard] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hazardId: string } | null>(null);
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const { setActiveHazardId } = useAgentTraceStore();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('vigia-detected-hazards', JSON.stringify(hazards));
    }
  }, [hazards]);

  // Poll until terminal state — checks trace first, falls back to hazard status
  const startPolling = (hazardId: string) => {
    if (pollTimers.current[hazardId]) return;
    let elapsed = 0;
    pollTimers.current[hazardId] = setInterval(async () => {
      elapsed += 3;
      if (elapsed > 120) {
        // Timeout — mark as vlm_failed so it doesn't spin forever
        setHazards(prev => prev.map(h => h.id === hazardId && h.status === 'processing'
          ? { ...h, status: 'vlm_failed', reasoning: 'Verification timed out.' } : h));
        clearInterval(pollTimers.current[hazardId]); delete pollTimers.current[hazardId]; return;
      }
      try {
        // Primary: check trace via backend API Gateway directly
        const apiUrl = process.env.NEXT_PUBLIC_TELEMETRY_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${apiUrl}/traces/${encodeURIComponent(hazardId)}`);
        const data = await res.json();
        const trace = data.trace ?? (Array.isArray(data) ? data[0] : null) ?? data;
        if (trace?.verdict) {
          const verdict: string = trace.verdict;
          if (verdict === 'VERIFIED') {
            const status = trace.reward_skipped_reason ? 'verified_no_reward' : 'verified';
            setHazards(prev => prev.map(h => h.id === hazardId ? { ...h, status, verificationScore: trace.total_score, reasoning: trace.vlm_reasoning } : h));
          } else if (verdict === 'REJECTED') {
            setHazards(prev => prev.map(h => h.id === hazardId ? { ...h, status: 'rejected', verificationScore: trace.total_score, reasoning: trace.vlm_reasoning } : h));
          } else if (verdict === 'UNVERIFIED_VLM_FAILED') {
            setHazards(prev => prev.map(h => h.id === hazardId ? { ...h, status: 'vlm_failed', reasoning: trace.vlm_reasoning } : h));
          } else { return; }
          clearInterval(pollTimers.current[hazardId]); delete pollTimers.current[hazardId]; return;
        }
        // Fallback: check hazard status directly (handles cooldown-skipped hazards)
        const statusRes = await fetch(`/api/hazard-status/${encodeURIComponent(hazardId)}`);
        const { status } = await statusRes.json();
        if (status === 'VERIFIED') {
          setHazards(prev => prev.map(h => h.id === hazardId ? { ...h, status: 'verified' } : h));
          clearInterval(pollTimers.current[hazardId]); delete pollTimers.current[hazardId];
        } else if (status === 'REJECTED') {
          setHazards(prev => prev.map(h => h.id === hazardId ? { ...h, status: 'rejected' } : h));
          clearInterval(pollTimers.current[hazardId]); delete pollTimers.current[hazardId];
        } else if (status === 'UNVERIFIED_VLM_FAILED') {
          setHazards(prev => prev.map(h => h.id === hazardId ? { ...h, status: 'vlm_failed' } : h));
          clearInterval(pollTimers.current[hazardId]); delete pollTimers.current[hazardId];
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
  };

  // Listen for new hazard detections
  useEffect(() => {
    const handleDetection = (e: CustomEvent) => {
      const { type, lat, lon, confidence, timestamp } = e.detail;
      const geohash = encodeGeohash(lat, lon, 7);
      const hazardId = `${geohash}#${timestamp}`;
      setHazards(prev => {
        if (prev.some(h => h.id === hazardId)) return prev;
        return [{ id: hazardId, type, lat, lon, confidence, timestamp, status: 'pending' }, ...prev];
      });
    };
    // 202 accepted — switch to processing and start poll
    const handleAccepted = (e: CustomEvent) => {
      const { hazardId } = e.detail;
      setHazards(prev => prev.map(h => h.id === hazardId ? { ...h, status: 'processing' } : h));
      startPolling(hazardId);
    };
    window.addEventListener('hazard-detected', handleDetection as EventListener);
    window.addEventListener('hazard-accepted', handleAccepted as EventListener);
    return () => {
      window.removeEventListener('hazard-detected', handleDetection as EventListener);
      window.removeEventListener('hazard-accepted', handleAccepted as EventListener);
    };
  }, []);

  // Cleanup poll timers on unmount
  useEffect(() => () => { Object.values(pollTimers.current).forEach(clearInterval); }, []);

  const handleViewReasoning = (hazardId: string) => {
    setActiveHazardId(hazardId);
    // Signal parent to switch to Agent Traces tab
    window.dispatchEvent(new CustomEvent('open-agent-traces', { detail: { hazardId } }));
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const getStatusConfig = (status: HazardStatus) => {
    switch (status) {
      case 'pending':          return { icon: <Clock size={12} />,                             color: C.yellow, label: 'PENDING' };
      case 'processing':       return { icon: <Loader2 size={12} className="animate-spin" />,  color: C.accent, label: 'PROCESSING' };
      case 'verified':         return { icon: <CheckCircle size={12} />,                       color: C.green,  label: 'VERIFIED' };
      case 'verified_no_reward': return { icon: <CheckCircle size={12} />,                     color: C.yellow, label: 'VERIFIED · NO REWARD' };
      case 'rejected':         return { icon: <XCircle size={12} />,                           color: C.red,    label: 'REJECTED' };
      case 'vlm_failed':       return { icon: <AlertTriangle size={12} />,                     color: C.yellow, label: 'PENDING REVIEW' };
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
                    border: `1px solid ${hazard.status === 'processing' ? 'var(--c-accent-2)' : C.border}`,
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
                              VLM Reasoning:
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
                        <button
                          onClick={() => handleViewReasoning(hazard.id)}
                          style={{
                            marginTop: 8, width: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '5px 0', borderRadius: 3, cursor: 'pointer',
                            background: 'var(--c-elevated)', border: '1px solid var(--v-border-default)',
                            fontSize: '0.65rem', color: 'var(--c-accent-2)', fontFamily: "var(--v-font-mono)",
                          }}
                        >
                          <Eye size={11} /> View Reasoning
                        </button>
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
            {hazards.filter(h => h.status === 'pending' || h.status === 'processing' || h.status === 'vlm_failed').length}
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
            {hazards.filter(h => h.status === 'processing').length}
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
            {hazards.filter(h => h.status === 'verified' || h.status === 'verified_no_reward').length}
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
            boxShadow: 'var(--v-shadow-sm), 0 0 0 1px var(--c-rose-dim)',
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
              handleViewReasoning(contextMenu.hazardId);
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
            <Eye size={12} style={{ color: 'var(--c-rose-2)', flexShrink: 0 }} />
            View Reasoning
          </button>
        </div>
      )}
    </div>
  );
}
