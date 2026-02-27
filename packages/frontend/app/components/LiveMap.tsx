'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Hazard = {
  lat: number;
  lon: number;
  geohash: string;
  hazardType: string;
  confidence: number;
  status: string;
  verificationScore?: number;
  timestamp: string;
};

export function LiveMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [showUnverified, setShowUnverified] = useState(true);

  const fetchHazards = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/hazards`);
      const data = await res.json();
      setHazards(data.hazards || []);
    } catch (e) {
      console.error('Failed to fetch hazards:', e);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapName = process.env.NEXT_PUBLIC_MAP_NAME || 'VigiaMap';
    const apiKey = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';

    const styleUrl = `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [-122.4194, 37.7749],
      zoom: 12,
      attributionControl: false,
    });

    // Ensure proper resize when container changes
    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize();
    });

    resizeObserver.observe(mapContainer.current);

    map.current.on('load', () => {
      map.current?.resize();
    });

    // Handle missing sprites silently
    map.current.on('styleimagemissing', (e) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const imageData = ctx.getImageData(0, 0, 1, 1);
        if (!map.current?.hasImage(e.id)) {
          map.current?.addImage(e.id, imageData);
        }
      }
    });

    fetchHazards();
    const interval = setInterval(fetchHazards, 30000);

    return () => {
      clearInterval(interval);
      resizeObserver.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Remove old markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    const filtered = hazards.filter((h) => {
      if (h.status === 'verified') return true;
      return showUnverified;
    });

    filtered.forEach((hazard) => {
      const el = document.createElement('div');

      // Clean UI marker styling
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '50%';
      el.style.background =
        hazard.status === 'verified' ? '#22c55e' : '#facc15'; // green vs yellow
      el.style.border = '2px solid rgba(0,0,0,0.6)';
      el.style.boxShadow = '0 0 6px rgba(0,0,0,0.4)';
      el.style.cursor = 'pointer';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([hazard.lon, hazard.lat])
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [hazards, showUnverified]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '500px',
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#0b1220',
      }}
    >
      <div
        ref={mapContainer}
        style={{
          position: 'absolute',
          inset: 0,
        }}
      />
    </div>
  );
}