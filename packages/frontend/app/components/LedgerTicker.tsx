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
    const interval = setInterval(fetchEntries, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="animate-pulse">⏳</div>
        <span>Loading ledger...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 italic">
        <span className="animate-pulse">⏺</span>
        <span>Awaiting network consensus...</span>
      </div>
    );
  }

  // Duplicate entries for seamless loop
  const displayEntries = [...entries, ...entries];

  return (
    <div className="relative overflow-hidden w-full">
      <div className="flex animate-marquee gap-8 whitespace-nowrap">
        {displayEntries.map((entry, index) => {
          // Extract hazard type from hazardId (format: geohash#timestamp)
          const hazardType = 'POTHOLE'; // Default, could parse from hazardId if stored
          
          return (
            <div
              key={`${entry.contributorId}-${entry.timestamp}-${index}`}
              className="inline-flex items-center gap-2 text-sm"
            >
              <span className="text-vigia-success font-semibold">✓ [Verified]</span>
              <span className="text-gray-300">
                Contributor <span className="text-vigia-accent font-mono">{entry.contributorId.substring(0, 8)}</span>
              </span>
              <span className="text-gray-400">earned</span>
              <span className="text-vigia-success font-bold">{entry.credits} $VIGIA</span>
              <span className="text-gray-400">for</span>
              <span className="text-vigia-danger">{hazardType}</span>
              <span className="text-gray-600 mx-4">|</span>
            </div>
          );
        })}
      </div>

      {/* Gradient fade on edges */}
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-vigia-panel to-transparent pointer-events-none"></div>
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-vigia-panel to-transparent pointer-events-none"></div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-marquee {
          animation: marquee 30s linear infinite;
        }

        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
