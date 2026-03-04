'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ROIWidget } from './ROIWidget';

// ─────────────────────────────────────────────
// LedgerTicker — ALL API logic preserved from v1
// Visual layer updated to dark IDE style
// ─────────────────────────────────────────────

type LedgerEntry = {
  contributorId: string;
  credits: number;
  hazardId: string;
  timestamp: string;
};

export function LedgerTicker() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Original fetch logic preserved ────────
  const fetchEntries = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ledger`);
      const data = await response.json();
      setEntries(data.entries || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch ledger entries:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ide-text-secondary font-data" style={{ fontSize: '0.82rem' }}>
        <RefreshCw size={14} className="animate-spin" />
        <span>Loading ledger entries...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-ide-text-secondary font-data" style={{ fontSize: '0.82rem' }}>
        <span className="animate-pulse text-ide-accent-2">›</span>
        <span>Awaiting network consensus...</span>
      </div>
    );
  }

  return (
    <div className="font-data w-full h-full flex flex-col" style={{ fontSize: '0.78rem' }}>
      {/* ROI Widget */}
      <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <ROIWidget sessionId="current" />
      </div>

      {/* Ledger Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Timestamp', 'Contributor', 'Hazard Type', 'Location', 'Reward'].map((h, i) => (
                <th
                  key={h}
                  className="py-2 px-3 text-left font-medium uppercase tracking-widest"
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--c-text-3)',
                    letterSpacing: '0.08em',
                    textAlign: i === 4 ? 'right' : 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={`${entry.contributorId}-${entry.timestamp}-${index}`}
              className="transition-colors group"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
            >
              <td className="py-2 px-3" style={{ color: 'var(--c-text-2)' }}>
                {new Date(entry.timestamp).toLocaleTimeString()}
              </td>
              <td className="py-2 px-3" style={{ color: 'var(--c-text-2)', fontFamily: "'IBM Plex Mono', monospace" }}>
                {entry.contributorId.substring(0, 8)}
                <span style={{ color: 'var(--c-text-3)' }}>…</span>
              </td>
              <td className="py-2 px-3">
                <span
                  className="px-2 py-1 rounded"
                  style={{
                    background: 'var(--c-red-dim)',
                    color: 'var(--c-red)',
                    fontSize: '0.70rem',
                    fontWeight: 600,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  POTHOLE
                </span>
              </td>
              <td className="py-2 px-3" style={{ color: 'var(--c-text-2)', fontFamily: "'IBM Plex Mono', monospace" }}>
                {entry.hazardId.substring(0, 7)}
              </td>
              <td className="py-2 px-3 text-right">
                <span style={{ color: 'var(--c-green)', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {entry.credits}
                </span>
                <span style={{ color: 'var(--c-text-3)', fontFamily: "'IBM Plex Mono', monospace" }}> $VIGIA</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
