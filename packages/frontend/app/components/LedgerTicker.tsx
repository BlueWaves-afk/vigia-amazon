'use client';

import { useEffect, useState } from 'react';

type LedgerEntry = {
  contributorId: string;
  credits: number;
  hazardId: string;
  timestamp: string;
};

export function LedgerTicker() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="text-ide-text-secondary font-data text-xs">
        &gt; Loading ledger...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-ide-text-secondary font-data text-xs">
        &gt; Awaiting network consensus...
      </div>
    );
  }

  return (
    <div className="font-data text-[10px]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ide-border text-ide-text-secondary text-left">
            <th className="py-2 px-3">Timestamp</th>
            <th className="py-2 px-3">Contributor</th>
            <th className="py-2 px-3">Hazard Type</th>
            <th className="py-2 px-3">Location</th>
            <th className="py-2 px-3 text-right">Reward</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr 
              key={`${entry.contributorId}-${entry.timestamp}-${index}`}
              className="border-b border-ide-border hover:bg-ide-hover transition-colors"
            >
              <td className="py-2 px-3 text-ide-text-tertiary">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </td>
              <td className="py-2 px-3 text-ide-text">
                {entry.contributorId.substring(0, 12)}...
              </td>
              <td className="py-2 px-3 text-ide-text">
                POTHOLE
              </td>
              <td className="py-2 px-3 text-ide-text-secondary">
                {entry.hazardId.substring(0, 7)}
              </td>
              <td className="py-2 px-3 text-right text-ide-text font-semibold">
                {entry.credits} $VIGIA
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
