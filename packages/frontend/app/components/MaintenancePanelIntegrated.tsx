'use client';

import { useEconomicStore } from '@/stores/economicStore';
import { useEffect, useState } from 'react';
import { AgentChatPanel } from './AgentChatPanel';
import type { MaintenanceReport } from '@/types/shared';

export function MaintenancePanel() {
  const { maintenanceQueue, isLoading, submitMaintenanceReport, fetchMaintenanceQueue, updateMaintenanceReportStatus } = useEconomicStore();
  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [queuedHazards, setQueuedHazards] = useState<any[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [queueLoading, setQueueLoading] = useState(true);

  useEffect(() => {
    // Load the current queue on entry.
    setQueueLoading(true);
    fetchMaintenanceQueue()
      .catch(() => undefined)
      .finally(() => setQueueLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Hydrate queue from sessionStorage (session-only; cleared on browser restart)
    try {
      const fromGlobal = (window as any).__maintenanceHazards;
      if (Array.isArray(fromGlobal) && fromGlobal.length) {
        setQueuedHazards(fromGlobal);
        if (!selectedHazard) setSelectedHazard(fromGlobal[0]);
        sessionStorage.setItem('vigia:maintenance:queuedHazards', JSON.stringify({ version: 1, hazards: fromGlobal }));
        return;
      }

      const raw = sessionStorage.getItem('vigia:maintenance:queuedHazards');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const hazards = Array.isArray(parsed?.hazards) ? parsed.hazards : [];
      setQueuedHazards(hazards);
      if (!selectedHazard && hazards.length) setSelectedHazard(hazards[0]);
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHazard) return;

    try {
      await submitMaintenanceReport({
        hazardId: selectedHazard.id,
        geohash: selectedHazard.geohash,
        type: selectedHazard.type,
        severity: selectedHazard.severity,
        reportedBy: 'current-user',
        reportedAt: Date.now(),
        status: 'PENDING',
        notes: notes || undefined,
        signature: '0xtemp',
      });
      setNotes('');
      setSelectedHazard(null);
    } catch (error) {
      console.error('Failed to submit report:', error);
    }
  };

  const C = {
    bg: 'var(--c-panel)',
    border: 'var(--c-border)',
    text: 'var(--c-text)',
    textSec: 'var(--c-text-2)',
    textMut: 'var(--c-text-3)',
    hover: 'var(--c-accent-glow)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: C.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div className="vigia-panel-header" style={{
        padding: '0 12px',
        height: 38,
        display: 'flex',
        alignItems: 'center',
        borderBottom: 'none',
      }}>
        <span style={{
          fontSize: '0.75rem',
          color: C.textSec,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          MAINTENANCE
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <style>{`@keyframes mt-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}`}</style>

        {/* Queued from map */}
        {!hydrated ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.7rem', color: C.textSec, fontWeight: 600, marginBottom: 8 }}>
              Queued Hazards
            </div>
            {[88, 72, 60].map((w, i) => (
              <div key={i} style={{
                padding: 8, marginBottom: 6,
                background: 'var(--v-hover)',
                border: '1px solid var(--v-border-default)',
                borderRadius: 3,
                opacity: 1 - i * 0.18,
              }}>
                <div style={{
                  height: 9, borderRadius: 3, width: `${w}%`, maxWidth: 120,
                  background: 'linear-gradient(90deg,var(--v-hover) 25%,var(--v-hover-md) 50%,var(--v-hover) 75%)',
                  backgroundSize: '200% 100%',
                  animation: `mt-shimmer 1.6s ease-in-out ${i * 0.1}s infinite`,
                  marginBottom: 5,
                }} />
                <div style={{
                  height: 7, borderRadius: 3, width: `${w * 0.5}%`, maxWidth: 70,
                  background: 'linear-gradient(90deg,var(--v-hover) 25%,var(--v-hover-md) 50%,var(--v-hover) 75%)',
                  backgroundSize: '200% 100%',
                  animation: `mt-shimmer 1.6s ease-in-out ${i * 0.1 + 0.05}s infinite`,
                }} />
              </div>
            ))}
          </div>
        ) : queuedHazards.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.7rem', color: C.textSec, fontWeight: 600, marginBottom: 8 }}>
              Queued Hazards ({queuedHazards.length})
            </div>
            {queuedHazards.slice(0, 20).map((h: any) => (
              <button
                key={String(h.id || h.hazardId || `${h.geohash}-${h.timestamp || ''}-${h.lat}-${h.lon}`)}
                onClick={() => setSelectedHazard(h)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 8,
                  marginBottom: 6,
                  background: selectedHazard?.id === h.id ? 'var(--c-accent-glow)' : 'var(--v-hover)',
                  border: `1px solid ${selectedHazard?.id === h.id ? 'var(--c-accent-glow-strong)' : 'var(--v-border-default)'}`,
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: '0.65rem',
                  fontFamily: 'var(--v-font-mono)',
                  color: selectedHazard?.id === h.id ? 'var(--c-accent-2)' : C.text,
                }}
              >
                <div style={{ opacity: selectedHazard?.id === h.id ? 1 : 0.9 }}>
                  {h.type || h.hazardType || 'HAZARD'}
                </div>
                <div style={{ color: selectedHazard?.id === h.id ? 'rgba(255,255,255,0.85)' : C.textMut }}>
                  {h.geohash || ''}
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedHazard ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '0.7rem', color: C.textSec, fontWeight: 600 }}>
              Report Hazard for Maintenance
            </div>
            
            <div style={{ fontSize: '0.65rem', color: C.textMut, fontFamily: "var(--v-font-mono)" }}>
              <div>ID: {selectedHazard.id}</div>
              <div>Type: {selectedHazard.type}</div>
              <div>Severity: {selectedHazard.severity}/5</div>
              <div>Location: {selectedHazard.geohash}</div>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Additional notes (optional)"
              style={{
                background: 'var(--v-hover)',
                border: `1px solid var(--v-border-default)`,
                borderRadius: 3,
                padding: 8,
                fontSize: '0.7rem',
                color: C.text,
                fontFamily: "var(--v-font-ui)",
                resize: 'vertical',
                minHeight: 60,
              }}
            />
            <div style={{ fontSize: '0.6rem', color: C.textMut }}>{notes.length}/500</div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.7rem',
                  background: 'var(--c-accent-glow)',
                  border: `1px solid var(--c-accent-glow-strong)`,
                  borderRadius: 3,
                  color: 'var(--c-accent-2)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {isLoading ? 'Submitting...' : 'Submit Report'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedHazard(null)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.7rem',
                  background: 'transparent',
                  border: `1px solid var(--v-border-default)`,
                  borderRadius: 3,
                  color: C.textSec,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div style={{ fontSize: '0.7rem', color: C.textMut, textAlign: 'center', padding: 20 }}>
            Select a queued hazard to report it for maintenance
          </div>
        )}

        {/* Queue */}
        <div style={{ marginTop: 20, paddingTop: 12, position: 'relative' }}>
          <div className="ide-divider" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
          <div style={{ fontSize: '0.7rem', color: C.textSec, fontWeight: 600, marginBottom: 8 }}>
            Maintenance Queue ({queueLoading ? '…' : maintenanceQueue.length})
          </div>
          {queueLoading ? (
            <>
              {[80, 64, 72, 56].map((w, i) => (
                <div key={i} style={{
                  padding: 8, marginBottom: 6,
                  background: 'var(--v-hover)',
                  border: '1px solid var(--v-border-default)',
                  borderRadius: 3,
                  opacity: 1 - i * 0.16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{
                      height: 9, borderRadius: 3, width: `${w}%`, maxWidth: 110,
                      background: 'linear-gradient(90deg,var(--v-hover) 25%,var(--v-hover-md) 50%,var(--v-hover) 75%)',
                      backgroundSize: '200% 100%',
                      animation: `mt-shimmer 1.6s ease-in-out ${i * 0.1}s infinite`,
                    }} />
                    <div style={{
                      height: 16, borderRadius: 3, width: 64, flexShrink: 0,
                      background: 'linear-gradient(90deg,var(--v-hover) 25%,var(--v-hover-md) 50%,var(--v-hover) 75%)',
                      backgroundSize: '200% 100%',
                      animation: `mt-shimmer 1.6s ease-in-out ${i * 0.1 + 0.05}s infinite`,
                    }} />
                  </div>
                  <div style={{
                    height: 7, borderRadius: 3, width: `${w * 0.45}%`, maxWidth: 60, marginTop: 5,
                    background: 'linear-gradient(90deg,var(--v-hover) 25%,var(--v-hover-md) 50%,var(--v-hover) 75%)',
                    backgroundSize: '200% 100%',
                    animation: `mt-shimmer 1.6s ease-in-out ${i * 0.1 + 0.1}s infinite`,
                  }} />
                  <div style={{
                    height: 14, borderRadius: 2, width: 48, marginTop: 5,
                    background: 'linear-gradient(90deg,var(--v-hover) 25%,var(--v-hover-md) 50%,var(--v-hover) 75%)',
                    backgroundSize: '200% 100%',
                    animation: `mt-shimmer 1.6s ease-in-out ${i * 0.1 + 0.15}s infinite`,
                  }} />
                </div>
              ))}
            </>
          ) : maintenanceQueue.slice(0, 10).map((report: MaintenanceReport) => (
            <div
              key={report.reportId}
              style={{
                padding: 8,
                marginBottom: 6,
                background: 'var(--v-hover)',
                border: `1px solid var(--v-border-default)`,
                borderRadius: 3,
                fontSize: '0.65rem',
                fontFamily: "var(--v-font-mono)",
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ color: C.text }}>{report.type} - ${report.estimatedCost}</div>
                {report.status !== 'COMPLETED' && report.status !== 'REJECTED' && (
                  <button
                    onClick={() => updateMaintenanceReportStatus({ reportId: report.reportId, status: 'COMPLETED' }).catch(() => undefined)}
                    disabled={isLoading}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.6rem',
                      background: 'transparent',
                      border: `1px solid var(--v-border-default)`,
                      borderRadius: 3,
                      color: C.textSec,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Mark finished
                  </button>
                )}
              </div>
              <div style={{ color: C.textMut }}>{report.geohash}</div>
              <div style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '2px 6px',
                background: report.status === 'COMPLETED' ? 'rgba(34,197,94,0.15)' : 'rgba(96,165,250,0.15)',
                color: report.status === 'COMPLETED' ? '#22C55E' : '#60A5FA',
                borderRadius: 2,
                fontSize: '0.6rem',
              }}>
                {report.status === 'COMPLETED' ? 'FINISHED' : report.status === 'REJECTED' ? 'REJECTED' : 'ACTIVE'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expose method to set hazard from outside */}
      <div ref={(el) => {
        if (el) (window as any).__setMaintenanceHazard = setSelectedHazard;
      }} style={{ display: 'none' }} />
      </div>
      <AgentChatPanel
        contextType="maintenance"
        context={{ queueLength: maintenanceQueue.length }}
      />
    </div>
  );
}
