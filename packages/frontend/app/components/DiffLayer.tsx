'use client';

import { useMapFileStore } from '@/stores/mapFileStore';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

export function DiffLayer({ map }: { map: maplibregl.Map | null }) {
  const { diffState, clearDiff } = useMapFileStore();
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!map || !diffState) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add new hazard markers (RED)
    diffState.changes.new.forEach(hazard => {
      const el = document.createElement('div');
      el.className = 'w-3 h-3 rounded-full bg-[#EF4444] border-2 border-white';
      el.title = `New: ${hazard.type} (Severity ${hazard.severity})`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([parseFloat(hazard.geohash.substring(0, 3)), parseFloat(hazard.geohash.substring(3))])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Add fixed hazard markers (GREEN)
    diffState.changes.fixed.forEach(hazard => {
      const el = document.createElement('div');
      el.className = 'w-3 h-3 rounded-full bg-[#10B981] border-2 border-white';
      el.title = `Fixed: ${hazard.type}`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([parseFloat(hazard.geohash.substring(0, 3)), parseFloat(hazard.geohash.substring(3))])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Add worsened hazard markers (ORANGE)
    diffState.changes.worsened.forEach(({ before, after }) => {
      const el = document.createElement('div');
      el.className = 'w-3 h-3 rounded-full bg-[#F59E0B] border-2 border-white';
      el.title = `Worsened: ${after.type} (${before.severity} → ${after.severity})`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([parseFloat(after.geohash.substring(0, 3)), parseFloat(after.geohash.substring(3))])
        .addTo(map);

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [map, diffState]);

  if (!diffState) return null;

  return (
    <div className="absolute top-4 left-4 bg-white border border-[#CBD5E1] rounded p-3 shadow-lg z-10">
      <div className="text-xs font-medium mb-2">DIFF ANALYSIS</div>
      <div className="flex gap-4 text-xs mb-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#EF4444]"></div>
          <span>+{diffState.summary.totalNew} New</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
          <span>-{diffState.summary.totalFixed} Fixed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
          <span>{diffState.summary.totalWorsened} Worsened</span>
        </div>
      </div>
      <div className="text-xs text-gray-600 mb-2">
        Net Change: {diffState.summary.netChange > 0 ? '+' : ''}{diffState.summary.netChange}
      </div>
      <div className="flex gap-2">
        <button
          onClick={clearDiff}
          className="text-xs px-2 py-1 bg-white border border-[#CBD5E1] rounded hover:bg-gray-50"
        >
          Clear Diff
        </button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(diffState, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diff-${Date.now()}.json`;
            a.click();
          }}
          className="text-xs px-2 py-1 bg-white border border-[#CBD5E1] rounded hover:bg-gray-50"
        >
          Export Diff
        </button>
      </div>
    </div>
  );
}
