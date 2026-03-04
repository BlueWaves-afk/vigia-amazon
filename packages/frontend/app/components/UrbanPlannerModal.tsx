'use client';

import { useState } from 'react';
import { X, MapPin, Loader2, TrendingUp } from 'lucide-react';

const C = {
  bg: 'var(--c-bg)',
  panel: 'var(--c-panel)',
  border: 'var(--c-border)',
  text: 'var(--c-text)',
  textSec: 'var(--c-text-2)',
  textMut: 'var(--c-text-3)',
  accent: 'var(--c-accent-2)',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

const MONO = "'IBM Plex Mono', monospace";

interface UrbanPlannerModalProps {
  onClose: () => void;
}

export function UrbanPlannerModal({ onClose }: UrbanPlannerModalProps) {
  const [startLat, setStartLat] = useState('42.3601');
  const [startLon, setStartLon] = useState('-71.0589');
  const [endLat, setEndLat] = useState('42.3656');
  const [endLon, setEndLon] = useState('-71.0596');
  const [avoidPotholes, setAvoidPotholes] = useState(true);
  const [avoidDebris, setAvoidDebris] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const avoidTypes = [];
      if (avoidPotholes) avoidTypes.push('POTHOLE');
      if (avoidDebris) avoidTypes.push('DEBRIS');

      const response = await fetch('/api/agent/urban-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: { lat: parseFloat(startLat), lon: parseFloat(startLon) },
          end: { lat: parseFloat(endLat), lon: parseFloat(endLon) },
          constraints: { avoidHazardTypes: avoidTypes, maxDetourPercent: 20 },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: C.overlay,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        width: '90%',
        maxWidth: 700,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={18} style={{ color: C.accent }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: C.text }}>
              Urban Planner - Optimal Path Finder
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} style={{ color: C.textSec }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Start Point */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: C.text,
                marginBottom: 8,
              }}>
                Start Point
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="number"
                  step="0.0001"
                  value={startLat}
                  onChange={(e) => setStartLat(e.target.value)}
                  placeholder="Latitude"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: C.text,
                    fontSize: '0.85rem',
                    fontFamily: MONO,
                  }}
                />
                <input
                  type="number"
                  step="0.0001"
                  value={startLon}
                  onChange={(e) => setStartLon(e.target.value)}
                  placeholder="Longitude"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: C.text,
                    fontSize: '0.85rem',
                    fontFamily: MONO,
                  }}
                />
              </div>
            </div>

            {/* End Point */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: C.text,
                marginBottom: 8,
              }}>
                End Point
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="number"
                  step="0.0001"
                  value={endLat}
                  onChange={(e) => setEndLat(e.target.value)}
                  placeholder="Latitude"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: C.text,
                    fontSize: '0.85rem',
                    fontFamily: MONO,
                  }}
                />
                <input
                  type="number"
                  step="0.0001"
                  value={endLon}
                  onChange={(e) => setEndLon(e.target.value)}
                  placeholder="Longitude"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: C.text,
                    fontSize: '0.85rem',
                    fontFamily: MONO,
                  }}
                />
              </div>
            </div>

            {/* Constraints */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: C.text,
                marginBottom: 8,
              }}>
                Avoid Hazard Types
              </label>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={avoidPotholes}
                    onChange={(e) => setAvoidPotholes(e.target.checked)}
                  />
                  <span style={{ fontSize: '0.85rem', color: C.text }}>Potholes</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={avoidDebris}
                    onChange={(e) => setAvoidDebris(e.target.checked)}
                  />
                  <span style={{ fontSize: '0.85rem', color: C.text }}>Debris</span>
                </label>
              </div>
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              style={{
                padding: '12px 24px',
                background: isAnalyzing ? C.panel : C.accent,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                color: C.text,
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp size={16} />
                  Find Optimal Path & Calculate ROI
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div style={{
                padding: 12,
                background: 'var(--c-red-dim)',
                border: '1px solid rgba(240,96,108,0.3)',
                borderRadius: 4,
                fontSize: '0.76rem',
                color: 'var(--c-red)',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}>
                {error}
              </div>
            )}

            {/* Analysis Result */}
            {analysis && (
              <div style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: 16,
                maxHeight: 300,
                overflow: 'auto',
              }}>
                <div style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  color: C.text,
                  fontFamily: MONO,
                  whiteSpace: 'pre-wrap',
                }}>
                  {analysis}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
