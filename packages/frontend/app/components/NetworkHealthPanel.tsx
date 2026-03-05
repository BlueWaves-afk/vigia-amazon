'use client';

import { useState } from 'react';
import { Activity, AlertCircle, Loader2 } from 'lucide-react';

const C = {
  bg: 'var(--c-bg)',
  panel: 'var(--c-panel)',
  border: 'var(--c-border)',
  text: 'var(--c-text)',
  textSec: 'var(--c-text-2)',
  textMut: 'var(--c-text-3)',
  accent: 'var(--c-accent-2)',
};

const MONO = 'var(--v-font-mono)';

export function NetworkHealthPanel() {
  const [geohash, setGeohash] = useState('drt2yzr');
  const [radiusKm, setRadiusKm] = useState(10);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!geohash.trim()) {
      setError('Geohash required');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch('/api/agent/network-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geohash: geohash.trim(), radiusKm }),
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
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: C.bg,
      padding: 16,
      gap: 16,
    }}>
      {/* Header */}
      <div className="vigia-panel-header" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingBottom: 12,
        borderBottom: 'none',
      }}>
        <Activity size={16} style={{ color: C.accent }} />
        <h3 style={{
          margin: 0,
          fontSize: '0.9rem',
          fontWeight: 600,
          color: C.text,
        }}>
          DePIN Network Health Analysis
        </h3>
      </div>

      {/* Input Form */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1 }}>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            color: C.textSec,
            marginBottom: 6,
            fontFamily: MONO,
          }}>
            Geohash (7 chars)
          </label>
          <input
            className="vigia-input"
            type="text"
            value={geohash}
            onChange={(e) => setGeohash(e.target.value)}
            placeholder="drt2yzr"
            maxLength={7}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: C.panel,
              border: `1px solid var(--v-border-default)`,
              borderRadius: 4,
              color: C.text,
              fontSize: '0.85rem',
              fontFamily: MONO,
            }}
          />
        </div>

        <div style={{ width: 120 }}>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            color: C.textSec,
            marginBottom: 6,
            fontFamily: MONO,
          }}>
            Radius (km)
          </label>
          <input
            className="vigia-input"
            type="number"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            min={1}
            max={50}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: C.panel,
              border: `1px solid var(--v-border-default)`,
              borderRadius: 4,
              color: C.text,
              fontSize: '0.85rem',
              fontFamily: MONO,
            }}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          style={{
            padding: '8px 20px',
            background: isAnalyzing ? C.panel : C.accent,
            border: `1px solid color-mix(in srgb, var(--v-accent) 30%, transparent)`,
            borderRadius: 4,
            color: C.text,
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {isAnalyzing && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {isAnalyzing ? 'Analyzing...' : 'Analyze Network'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: 12,
          background: 'var(--c-red-dim)',
          border: '1px solid rgba(240,96,108,0.3)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <AlertCircle size={16} style={{ color: 'var(--c-red)' }} />
          <span style={{ fontSize: '0.78rem', color: 'var(--c-red)' }}>{error}</span>
        </div>
      )}

      {/* Analysis Result */}
      {analysis && (
        <div style={{
          flex: 1,
          background: C.panel,
          border: `1px solid var(--v-border-default)`,
          borderRadius: 4,
          padding: 16,
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

      {/* Empty State */}
      {!analysis && !error && !isAnalyzing && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.textMut,
          fontSize: '0.85rem',
        }}>
          Enter a geohash and click "Analyze Network" to get started
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
