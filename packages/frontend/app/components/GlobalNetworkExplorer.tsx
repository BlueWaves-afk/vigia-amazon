'use client';

import { useState, useEffect, useCallback } from 'react';
import { readTotalSupply } from '../lib/contract';
import { API_URL, INNOVATION_API } from '../lib/constants';
import { Skeleton } from './Skeleton';

const C = {
  bg:      'var(--c-panel)',
  panel:   'var(--v-hover)',
  border:  'var(--v-border-default)',
  text:    'var(--c-text)',
  textMut: 'var(--c-text-3)',
  accent:  'var(--c-accent-2)',
  green:   'var(--c-green)',
  red:     'var(--c-red)',
};
const MONO = 'var(--v-font-mono)';
const TOTAL_SUPPLY_INITIAL = 1_000_000n * 10n ** 18n;
const fmt = (wei: bigint) => (Number(wei / 10n ** 15n) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 });

interface Hazard {
  hazardId?: string;
  hazardType: string;
  lat: number;
  lon: number;
  verificationScore?: number;
  status: string;
  timestamp: string;
  rewardPending?: boolean;
}

function ExplorerSkeleton() {
  return (
    <div style={{ height: '100%', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: MONO, overflow: 'hidden', padding: 8, gap: 8 }}>
      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <Skeleton width="60%" height={10} />
            <Skeleton width="75%" height={18} />
            <Skeleton width="45%" height={10} />
          </div>
        ))}
      </div>
      {/* Table */}
      <div style={{ flex: 1, background: C.panel, borderRadius: 8, border: `1px solid ${C.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="100%" height={1} style={{ background: C.border, margin: '4px 0' }} />
        <Skeleton count={10} height={18} />
      </div>
    </div>
  );
}

export function GlobalNetworkExplorer() {
  const [totalSupply,    setTotalSupply]    = useState<bigint>(TOTAL_SUPPLY_INITIAL);
  const [hazards,        setHazards]        = useState<Hazard[]>([]);
  const [verifiedCount,  setVerifiedCount]  = useState(0);
  const [loading,        setLoading]        = useState(true);

  const totalBurned = TOTAL_SUPPLY_INITIAL - totalSupply;

  const fetchData = useCallback(async () => {
    try {
      const [supplyRes, hazardRes] = await Promise.allSettled([
        readTotalSupply(),
        fetch(`/api/hazards?limit=20`).then(r => r.json()),
      ]);

      if (supplyRes.status === 'fulfilled') setTotalSupply(supplyRes.value);

      if (hazardRes.status === 'fulfilled') {
        const items: Hazard[] = hazardRes.value?.hazards ?? hazardRes.value ?? [];
        setHazards(items.slice(0, 20));
        setVerifiedCount(items.filter((h: Hazard) => h.status === 'verified' || h.status === 'VERIFIED').length);
      }
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  if (loading) {
    return <ExplorerSkeleton />;
  }

  return (
    <div style={{ height: '100%', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: MONO, overflow: 'hidden', padding: 8, gap: 8 }}>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[
          { label: 'TOTAL SUPPLY',    value: `${fmt(totalSupply)} VGA`,  sub: 'live · Polygon Amoy' },
          { label: 'TOTAL BURNED',    value: `${fmt(totalBurned)} VGA`,  sub: 'deflation metric', highlight: totalBurned > 0n },
          { label: 'VERIFIED (FEED)', value: String(verifiedCount),       sub: 'in current feed' },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '10px 14px',
          }}>
            <div style={{ fontSize: '0.58rem', color: C.textMut, marginBottom: 4, letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: highlight ? C.red : C.text }}>{value}</div>
            <div style={{ fontSize: '0.56rem', color: C.textMut, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Live Feed Table */}
      <div style={{ flex: 1, overflow: 'hidden', background: C.panel, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px 6px',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: C.accent, letterSpacing: '0.08em' }}>
            LIVE HAZARD FEED
          </span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'pulse 2s infinite', display: 'inline-block' }} />
          <span style={{ fontSize: '0.58rem', color: C.textMut }}>polls every 30s</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr 60px 80px 60px',
            gap: 8,
            padding: '4px 8px',
            fontSize: '0.56rem',
            color: C.textMut,
            letterSpacing: '0.06em',
            borderBottom: `1px solid ${C.border}`,
            marginBottom: 4,
          }}>
            <span>TYPE</span><span>LOCATION</span><span>SCORE</span><span>TIME</span><span>REWARD</span>
          </div>

          {hazards.length === 0 && !loading && (
            <div style={{ padding: '24px 8px', fontSize: '0.6rem', color: C.textMut, textAlign: 'center' }}>
              No hazards in feed
            </div>
          )}

          {hazards.map((h, i) => (
            <div key={h.hazardId ?? i} style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 60px 80px 60px',
              gap: 8,
              padding: '5px 8px',
              fontSize: '0.6rem',
              color: C.text,
              borderBottom: `1px solid ${C.border}`,
              alignItems: 'center',
            }}>
              <span style={{
                color: h.hazardType === 'POTHOLE' ? C.red : C.accent,
                fontWeight: 600,
                fontSize: '0.58rem',
              }}>
                {h.hazardType}
              </span>
              <span style={{ color: C.textMut, fontSize: '0.58rem' }}>
                {h.lat?.toFixed(4)}, {h.lon?.toFixed(4)}
              </span>
              <span style={{ color: h.verificationScore && h.verificationScore >= 70 ? C.green : C.textMut }}>
                {h.verificationScore ? `${Math.round(h.verificationScore)}/100` : '—'}
              </span>
              <span style={{ color: C.textMut, fontSize: '0.56rem' }}>
                {timeAgo(h.timestamp)}
              </span>
              <span style={{ color: h.rewardPending ? C.green : C.textMut }}>
                {h.rewardPending ? 'YES' : 'NO'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
