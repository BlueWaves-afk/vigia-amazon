'use client';

import { useMapFileStore } from '@/stores/mapFileStore';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { ScenarioBranch, Hazard } from '@/types/shared';

export function BranchLayer({ map }: { map: maplibregl.Map | null }) {
  const { files, activeFileId, updateBranchChanges } = useMapFileStore();
  const [routingResults, setRoutingResults] = useState<ScenarioBranch['routingResults'] | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const activeBranch = activeFileId && files.get(activeFileId) as ScenarioBranch | undefined;
  const isBranch = activeBranch && 'branchId' in activeBranch;

  useEffect(() => {
    if (!map || !isBranch || !activeBranch) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Render base hazards (from parent)
    const removedIds = new Set(activeBranch.simulatedChanges.removedHazards);
    activeBranch.hazards.forEach(hazard => {
      if (removedIds.has(hazard.id)) {
        // Render removed hazards with strikethrough style
        const el = document.createElement('div');
        el.className = 'w-3 h-3 rounded-full bg-gray-400 border-2 border-dashed border-white opacity-50';
        el.title = `Removed: ${hazard.type}`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([parseFloat(hazard.geohash.substring(0, 3)), parseFloat(hazard.geohash.substring(3))])
          .addTo(map);

        markersRef.current.push(marker);
      }
    });

    // Render added hazards with dashed border
    activeBranch.simulatedChanges.addedHazards.forEach(hazard => {
      const el = document.createElement('div');
      el.className = 'w-3 h-3 rounded-full bg-blue-500 border-2 border-dashed border-white';
      el.title = `Simulated: ${hazard.type} (Severity ${hazard.severity})`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([parseFloat(hazard.geohash.substring(0, 3)), parseFloat(hazard.geohash.substring(3))])
        .addTo(map);

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [map, isBranch, activeBranch]);

  const handleRecomputeRoutes = async () => {
    if (!activeBranch) return;

    setIsComputing(true);
    try {
      const apiEndpoint = process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT || 'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';
      const response = await fetch(`${apiEndpoint}/routing-agent/branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeBranch.branchId,
          hazards: activeBranch.hazards.filter(
            h => !activeBranch.simulatedChanges.removedHazards.includes(h.id)
          ).concat(activeBranch.simulatedChanges.addedHazards),
        }),
      });

      if (!response.ok) throw new Error('Failed to recompute routes');

      const results = await response.json();
      setRoutingResults(results);
    } catch (error) {
      console.error('Failed to recompute routes:', error);
    } finally {
      setIsComputing(false);
    }
  };

  const handleToggleHazard = (hazardId: string) => {
    if (!activeBranch) return;

    const removedHazards = activeBranch.simulatedChanges.removedHazards;
    const newRemovedHazards = removedHazards.includes(hazardId)
      ? removedHazards.filter(id => id !== hazardId)
      : [...removedHazards, hazardId];

    updateBranchChanges(activeBranch.branchId, {
      ...activeBranch.simulatedChanges,
      removedHazards: newRemovedHazards,
    });
  };

  if (!isBranch || !activeBranch) return null;

  return (
    <>
      <div className="absolute top-4 left-4 bg-white border border-[#CBD5E1] rounded p-3 shadow-lg z-10">
        <div className="text-xs font-medium mb-2 flex items-center gap-2">
          <span>🌿</span>
          <span>BRANCH: {activeBranch.branchName}</span>
        </div>
        <div className="text-xs text-gray-600 mb-2">
          <div>Added: {activeBranch.simulatedChanges.addedHazards.length}</div>
          <div>Removed: {activeBranch.simulatedChanges.removedHazards.length}</div>
        </div>
        <button
          onClick={handleRecomputeRoutes}
          disabled={isComputing}
          className="text-xs px-2 py-1 bg-white border border-[#CBD5E1] rounded hover:bg-gray-50 disabled:opacity-50 w-full"
        >
          {isComputing ? 'Computing...' : 'Recompute Routes'}
        </button>
      </div>

      {routingResults && (
        <div className="absolute top-32 left-4 bg-white border border-[#CBD5E1] rounded p-3 shadow-lg z-10">
          <div className="text-xs font-medium mb-2">LATENCY COMPARISON</div>
          <div className="text-xs space-y-1">
            <div>Baseline: {routingResults.baselineAvgLatency.toFixed(1)}s avg</div>
            <div>Branch: {routingResults.branchAvgLatency.toFixed(1)}s avg</div>
            <div className="font-medium">
              Delta: {routingResults.branchAvgLatency > routingResults.baselineAvgLatency ? '+' : ''}
              {((routingResults.branchAvgLatency - routingResults.baselineAvgLatency) / routingResults.baselineAvgLatency * 100).toFixed(1)}%
            </div>
            <div className="text-gray-600">Affected Routes: {routingResults.affectedRoutes}</div>
          </div>
        </div>
      )}
    </>
  );
}
