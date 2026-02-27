'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

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
      <div className="flex items-center gap-2 text-ide-text-secondary font-data" style={{ fontSize: '0.72rem' }}>
        <RefreshCw size={11} className="animate-spin" />
        <span>Loading ledger entries...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-ide-text-secondary font-data" style={{ fontSize: '0.72rem' }}>
        <span className="animate-pulse text-ide-accent-2">›</span>
        <span>Awaiting network consensus...</span>
      </div>
    );
  }

  return (
    <div className="font-data w-full" style={{ fontSize: '0.68rem' }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {['Timestamp', 'Contributor', 'Hazard Type', 'Location', 'Reward'].map((h, i) => (
              <th
                key={h}
                className="py-1.5 px-3 text-left font-medium uppercase tracking-widest"
                style={{
                  fontSize: '0.6rem',
                  color: '#4B5563',
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
              <td className="py-1.5 px-3" style={{ color: '#4B5563' }}>
                {new Date(entry.timestamp).toLocaleTimeString()}
              </td>
              <td className="py-1.5 px-3" style={{ color: '#8B95A1' }}>
                {entry.contributorId.substring(0, 8)}
                <span style={{ color: '#4B5563' }}>…</span>
              </td>
              <td className="py-1.5 px-3">
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    color: '#EF4444',
                    fontSize: '0.62rem',
                    fontWeight: 500,
                  }}
                >
                  POTHOLE
                </span>
              </td>
              <td className="py-1.5 px-3" style={{ color: '#6B7280' }}>
                {entry.hazardId.substring(0, 7)}
              </td>
              <td className="py-1.5 px-3 text-right">
                <span style={{ color: '#10B981', fontWeight: 600 }}>
                  {entry.credits}
                </span>
                <span style={{ color: '#4B5563' }}> $VIGIA</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
