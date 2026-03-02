'use client';

import { useEconomicStore } from '@/stores/economicStore';
import { useState } from 'react';

export function MaintenancePanel() {
  const { maintenanceQueue, isLoading, submitMaintenanceReport } = useEconomicStore();
  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [notes, setNotes] = useState('');

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
    hover: 'rgba(59,130,246,0.08)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      {/* Header */}
      <div style={{
        padding: '0 12px',
        height: 38,
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${C.border}`,
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
        {selectedHazard ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '0.7rem', color: C.textSec, fontWeight: 600 }}>
              Report Hazard for Maintenance
            </div>
            
            <div style={{ fontSize: '0.65rem', color: C.textMut, fontFamily: 'JetBrains Mono, monospace' }}>
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
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                padding: 8,
                fontSize: '0.7rem',
                color: C.text,
                fontFamily: 'Inter, sans-serif',
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
                  background: 'rgba(59,130,246,0.15)',
                  border: `1px solid rgba(59,130,246,0.3)`,
                  borderRadius: 3,
                  color: '#3B82F6',
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
                  border: `1px solid ${C.border}`,
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
            Click a hazard on the map to report it for maintenance
          </div>
        )}

        {/* Queue */}
        <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: '0.7rem', color: C.textSec, fontWeight: 600, marginBottom: 8 }}>
            Maintenance Queue ({maintenanceQueue.length})
          </div>
          {maintenanceQueue.slice(0, 10).map((report) => (
            <div
              key={report.reportId}
              style={{
                padding: 8,
                marginBottom: 6,
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                fontSize: '0.65rem',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <div style={{ color: C.text }}>{report.type} - ${report.estimatedCost}</div>
              <div style={{ color: C.textMut }}>{report.geohash}</div>
              <div style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '2px 6px',
                background: report.status === 'PENDING' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
                color: report.status === 'PENDING' ? '#EAB308' : '#22C55E',
                borderRadius: 2,
                fontSize: '0.6rem',
              }}>
                {report.status}
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
  );
}
