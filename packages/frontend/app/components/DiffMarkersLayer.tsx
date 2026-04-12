'use client';

import { useEffect } from 'react';
import { useMapFileStore } from '../../stores/mapFileStore';

interface DiffMarkersLayerProps {
  map: any;
}

// Maplibre paint colors require raw color strings (resolved from CSS vars).
const getCssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

export function DiffMarkersLayer({ map }: DiffMarkersLayerProps) {
  const { diffState } = useMapFileStore();

  useEffect(() => {
    if (!map || !diffState) return;

    // Add diff markers source
    if (!map.getSource('diff-markers')) {
      map.addSource('diff-markers', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
    }

    // Build features from diff state
    const features = [
      ...diffState.changes.new.filter(h => h.lat && h.lon).map(h => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
        properties: { type: 'new', severity: h.severity, hazardType: h.type },
      })),
      ...diffState.changes.fixed.filter(h => h.lat && h.lon).map(h => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
        properties: { type: 'fixed', severity: h.severity, hazardType: h.type },
      })),
      ...diffState.changes.worsened.filter(({ after: h }) => h.lat && h.lon).map(({ after: h }) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
        properties: { type: 'worsened', severity: h.severity, hazardType: h.type },
      })),
    ];

    map.getSource('diff-markers').setData({
      type: 'FeatureCollection',
      features,
    });

    const clrNew = getCssVar('--c-red', '#F0606C');
    const clrFixed = getCssVar('--c-green', '#34D492');
    const clrWorsened = getCssVar('--c-yellow', '#E0A040');
    const clrStroke = getCssVar('--c-text', '#FFFFFF');
    const clrFallback = getCssVar('--c-text-2', '#CBD5E1');

    // Add layer if not exists
    if (!map.getLayer('diff-markers-layer')) {
      map.addLayer({
        id: 'diff-markers-layer',
        type: 'circle',
        source: 'diff-markers',
        paint: {
          'circle-radius': 8,
          'circle-color': [
            'match',
            ['get', 'type'],
            'new', clrNew,
            'fixed', clrFixed,
            'worsened', clrWorsened,
            clrFallback,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': clrStroke,
        },
      });
    }

    return () => {
      if (map.getLayer('diff-markers-layer')) {
        map.removeLayer('diff-markers-layer');
      }
      if (map.getSource('diff-markers')) {
        map.removeSource('diff-markers');
      }
    };
  }, [map, diffState]);

  return null;
}
