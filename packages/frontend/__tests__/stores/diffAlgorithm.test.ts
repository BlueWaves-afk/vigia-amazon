import { describe, it, expect, beforeEach } from '@jest/globals';
import type { MapFile, Hazard } from '@vigia/shared';

// Mock diff worker
function computeDiff(fileA: MapFile, fileB: MapFile) {
  const hazardsA = new Map(fileA.hazards.map(h => [h.id, h]));
  const hazardsB = new Map(fileB.hazards.map(h => [h.id, h]));

  const newHazards: Hazard[] = [];
  const fixedHazards: Hazard[] = [];
  const worsened: Array<{ before: Hazard; after: Hazard }> = [];

  for (const [id, hazardB] of hazardsB) {
    const hazardA = hazardsA.get(id);
    if (!hazardA) {
      newHazards.push(hazardB);
    } else if (hazardB.severity > hazardA.severity) {
      worsened.push({ before: hazardA, after: hazardB });
    }
  }

  for (const [id, hazardA] of hazardsA) {
    if (!hazardsB.has(id)) {
      fixedHazards.push(hazardA);
    }
  }

  return { new: newHazards, fixed: fixedHazards, worsened };
}

describe('Diff Algorithm', () => {
  let fileA: MapFile;
  let fileB: MapFile;

  beforeEach(() => {
    fileA = {
      version: '1.0',
      sessionId: 'session-a',
      timestamp: Date.now(),
      hazards: [
        { id: 'h1', geohash: '7tg3v2k', type: 'POTHOLE', severity: 3, timestamp: Date.now(), signature: 'sig1', contributorId: 'c1' },
        { id: 'h2', geohash: '7tg3v2l', type: 'DEBRIS', severity: 2, timestamp: Date.now(), signature: 'sig2', contributorId: 'c2' },
      ],
      metadata: { totalHazards: 2, geohashBounds: [], contributors: [] },
    };

    fileB = {
      version: '1.0',
      sessionId: 'session-b',
      timestamp: Date.now(),
      hazards: [
        { id: 'h1', geohash: '7tg3v2k', type: 'POTHOLE', severity: 4, timestamp: Date.now(), signature: 'sig1', contributorId: 'c1' },
        { id: 'h3', geohash: '7tg3v2m', type: 'FLOODING', severity: 5, timestamp: Date.now(), signature: 'sig3', contributorId: 'c3' },
      ],
      metadata: { totalHazards: 2, geohashBounds: [], contributors: [] },
    };
  });

  it('should detect new hazards', () => {
    const result = computeDiff(fileA, fileB);
    expect(result.new).toHaveLength(1);
    expect(result.new[0].id).toBe('h3');
  });

  it('should detect fixed hazards', () => {
    const result = computeDiff(fileA, fileB);
    expect(result.fixed).toHaveLength(1);
    expect(result.fixed[0].id).toBe('h2');
  });

  it('should detect worsened hazards', () => {
    const result = computeDiff(fileA, fileB);
    expect(result.worsened).toHaveLength(1);
    expect(result.worsened[0].before.severity).toBe(3);
    expect(result.worsened[0].after.severity).toBe(4);
  });

  it('should handle identical files', () => {
    const result = computeDiff(fileA, fileA);
    expect(result.new).toHaveLength(0);
    expect(result.fixed).toHaveLength(0);
    expect(result.worsened).toHaveLength(0);
  });

  it('should handle disjoint files', () => {
    const fileC: MapFile = {
      ...fileA,
      hazards: [
        { id: 'h4', geohash: '7tg3v2n', type: 'ACCIDENT', severity: 5, timestamp: Date.now(), signature: 'sig4', contributorId: 'c4' },
      ],
    };
    const result = computeDiff(fileA, fileC);
    expect(result.new).toHaveLength(1);
    expect(result.fixed).toHaveLength(2);
  });
});
