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
        el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#7A90AA;border:2px dashed rgba(255,255,255,0.3);opacity:0.5;';
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
      el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#5C8FF8;border:2px dashed rgba(255,255,255,0.4);box-shadow:0 0 6px #5C8FF880;';
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
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        background: 'var(--c-elevated)',
        border: '1px solid var(--c-border-md)',
        borderRadius: 6, padding: 12,
        boxShadow: 'var(--shadow-md)',
        fontFamily: "'IBM Plex Sans', sans-serif",
        minWidth: 180,
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--c-text)' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--c-green)', fontFamily: "'IBM Plex Mono', monospace" }}>⎇</span>
          <span>Branch: {activeBranch.branchName}</span>
        </div>
        <div style={{ fontSize: '0.70rem', color: 'var(--c-text-2)', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
          <div>Added: <span style={{ color: 'var(--c-text)' }}>{activeBranch.simulatedChanges.addedHazards.length}</span></div>
          <div>Removed: <span style={{ color: 'var(--c-text)' }}>{activeBranch.simulatedChanges.removedHazards.length}</span></div>
        </div>
        <button
          onClick={handleRecomputeRoutes}
          disabled={isComputing}
          style={{
            width: '100%', padding: '5px 0', fontSize: '0.70rem',
            background: isComputing ? 'var(--c-hover)' : 'var(--c-accent-glow)',
            border: '1px solid var(--c-border)',
            borderRadius: 4, cursor: isComputing ? 'not-allowed' : 'pointer',
            color: isComputing ? 'var(--c-text-3)' : 'var(--c-accent-2)',
            opacity: isComputing ? 0.6 : 1,
            fontFamily: "'IBM Plex Sans', sans-serif",
            transition: 'background var(--dur-fast)',
          }}
        >
          {isComputing ? 'Computing…' : 'Recompute Routes'}
        </button>
      </div>

      {routingResults && (
        <div style={{
          position: 'absolute', top: 160, left: 16, zIndex: 10,
          background: 'var(--c-elevated)',
          border: '1px solid var(--c-border-md)',
          borderRadius: 6, padding: 12,
          boxShadow: 'var(--shadow-md)',
          fontFamily: "'IBM Plex Sans', sans-serif",
          minWidth: 180,
        }}>
          <div style={{ fontSize: '0.60rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 8 }}>Latency Comparison</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--c-text-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Baseline: <span style={{ color: 'var(--c-text)', fontFamily: "'IBM Plex Mono', monospace" }}>{routingResults.baselineAvgLatency.toFixed(1)}s</span></div>
            <div>Branch: <span style={{ color: 'var(--c-text)', fontFamily: "'IBM Plex Mono', monospace" }}>{routingResults.branchAvgLatency.toFixed(1)}s</span></div>
            <div style={{ marginTop: 2 }}>
              Delta:{' '}
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
                color: routingResults.branchAvgLatency > routingResults.baselineAvgLatency ? 'var(--c-red)' : 'var(--c-green)',
              }}>
                {routingResults.branchAvgLatency > routingResults.baselineAvgLatency ? '+' : ''}
                {((routingResults.branchAvgLatency - routingResults.baselineAvgLatency) / routingResults.baselineAvgLatency * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ color: 'var(--c-text-3)' }}>Affected: {routingResults.affectedRoutes}</div>
          </div>
        </div>
      )}
    </>
  );
}
