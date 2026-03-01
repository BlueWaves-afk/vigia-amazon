import type { MapFile, Hazard, DiffResult } from '../types/shared';

interface DiffWorkerMessage {
  type: 'COMPUTE_DIFF';
  fileA: MapFile;
  fileB: MapFile;
}

interface DiffWorkerResponse {
  type: 'DIFF_RESULT';
  result: DiffResult;
}

self.onmessage = (e: MessageEvent<DiffWorkerMessage>) => {
  const { type, fileA, fileB } = e.data;

  if (type !== 'COMPUTE_DIFF') return;

  const startTime = performance.now();

  // Create maps for O(1) lookup
  const hazardsA = new Map(fileA.hazards.map(h => [h.id, h]));
  const hazardsB = new Map(fileB.hazards.map(h => [h.id, h]));

  // Compute set differences
  const newHazards: Hazard[] = [];
  const fixedHazards: Hazard[] = [];
  const worsened: Array<{ before: Hazard; after: Hazard }> = [];
  const unchanged: Hazard[] = [];

  // Find new and worsened hazards
  for (const [id, hazardB] of hazardsB) {
    const hazardA = hazardsA.get(id);
    if (!hazardA) {
      newHazards.push(hazardB);
    } else if (hazardB.severity > hazardA.severity) {
      worsened.push({ before: hazardA, after: hazardB });
    } else if (hazardB.severity === hazardA.severity) {
      unchanged.push(hazardB);
    }
  }

  // Find fixed hazards
  for (const [id, hazardA] of hazardsA) {
    if (!hazardsB.has(id)) {
      fixedHazards.push(hazardA);
    }
  }

  const result: DiffResult = {
    fileA: { sessionId: fileA.sessionId, timestamp: fileA.timestamp },
    fileB: { sessionId: fileB.sessionId, timestamp: fileB.timestamp },
    changes: {
      new: newHazards,
      fixed: fixedHazards,
      worsened,
      unchanged,
    },
    summary: {
      totalNew: newHazards.length,
      totalFixed: fixedHazards.length,
      totalWorsened: worsened.length,
      netChange: newHazards.length - fixedHazards.length,
    },
  };

  const duration = performance.now() - startTime;
  console.log(`[DiffWorker] Computed diff in ${duration.toFixed(2)}ms`);

  const response: DiffWorkerResponse = { type: 'DIFF_RESULT', result };
  self.postMessage(response);
};
