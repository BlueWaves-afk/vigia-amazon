'use client';

import { useEconomicStore } from '@/stores/economicStore';
import { useEffect } from 'react';

const FONT_UI   = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

interface ROIWidgetProps { sessionId: string; }

export function ROIWidget({ sessionId }: ROIWidgetProps) {
  const { metrics, isLoading, fetchMetrics } = useEconomicStore();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT) return;
    fetchMetrics(sessionId);
    const interval = setInterval(() => fetchMetrics(sessionId), 30000);
    return () => clearInterval(interval);
  }, [sessionId, fetchMetrics]);

  const cardStyle: React.CSSProperties = {
    background: 'var(--c-panel)', border: '1px solid var(--c-border)',
    borderRadius: 6, padding: 12, fontFamily: FONT_UI,
  };

  if (isLoading && !metrics) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '0.72rem', color: 'var(--c-text-3)' }}>Loading metrics…</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '0.72rem', color: 'var(--c-text-3)' }}>No metrics available</div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '0.60rem', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 10 }}>
        City Health ROI — Last 7 Days
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '0.66rem', color: 'var(--c-text-2)', marginBottom: 3 }}>Hazards Detected</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: FONT_MONO, color: 'var(--c-text)', lineHeight: 1.1 }}>
            {metrics.totalHazardsDetected}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.66rem', color: 'var(--c-text-2)', marginBottom: 3 }}>ROI Multiplier</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: FONT_MONO, color: 'var(--c-green)', lineHeight: 1.1 }}>
            {metrics.roiMultiplier.toFixed(2)}×
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '0.66rem', color: 'var(--c-text-2)', marginBottom: 3 }}>Est. Repair Cost</div>
          <div style={{ fontSize: '0.90rem', fontFamily: FONT_MONO, color: 'var(--c-text)' }}>
            ${metrics.totalEstimatedRepairCost.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.66rem', color: 'var(--c-text-2)', marginBottom: 3 }}>Prevented Cost</div>
          <div style={{ fontSize: '0.90rem', fontFamily: FONT_MONO, color: 'var(--c-green)' }}>
            ${metrics.totalPreventedDamageCost.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 10 }}>
        <div style={{ fontSize: '0.60rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 6 }}>
          Breakdown
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'Potholes',  data: metrics.hazardBreakdown.POTHOLE  },
            { label: 'Debris',    data: metrics.hazardBreakdown.DEBRIS   },
            { label: 'Flooding',  data: metrics.hazardBreakdown.FLOODING },
          ].map(({ label, data }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem' }}>
              <span style={{ color: 'var(--c-text-2)' }}>{label}</span>
              <span style={{ fontFamily: FONT_MONO, color: 'var(--c-text)' }}>
                {data.count} × ${data.avgCost.toFixed(0)} avg
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
