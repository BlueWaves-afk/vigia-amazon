'use client';

import { useEffect } from 'react';
import { useMapFileStore } from '../../stores/mapFileStore';

interface DiffMarkersLayerProps {
  map: any;
}

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
            'new', '#EF4444',
            'fixed', '#10B981',
            'worsened', '#F59E0B',
            '#CBD5E1',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
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
