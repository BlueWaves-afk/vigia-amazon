'use client';

import { CheckCircle, AlertTriangle, Activity, Cpu, Wifi, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AgentUsageIndicator } from './AgentUsageIndicator';

// ─────────────────────────────────────────────
// Shared style constants
// ─────────────────────────────────────────────

const TEXT: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--v-font-ui)',
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

// ─────────────────────────────────────────────
// Separator — 1px vertical line
// ─────────────────────────────────────────────

function Sep() {
  return (
    <span style={{
      display: 'inline-block',
      width: 1,
      height: 14,
      background: 'var(--v-sb-sep)',
      flexShrink: 0,
      alignSelf: 'center',
    }} />
  );
}

// ─────────────────────────────────────────────
// StatusSegment — a clickable, hoverable cell
// ─────────────────────────────────────────────

function Seg({
  children,
  accent = false,
  onClick,
  title,
}: {
  children: React.ReactNode;
  accent?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const isInteractive = !!onClick;

  return (
    <div
      title={title}
      onClick={onClick}
      className={accent ? 'vsb-accent' : isInteractive ? 'vsb-seg' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 12px',
        height: '100%',
        flexShrink: 0,
        cursor: isInteractive ? 'pointer' : 'default',
        userSelect: 'none',
        ...(accent ? {
          background: 'var(--v-sb-accent-bg)',
          color: 'var(--v-sb-accent-text)',
        } : {
          background: 'transparent',
          color: 'var(--v-sb-text)',
        }),
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// ONNX pill badge
// ─────────────────────────────────────────────

function OnnxPill({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '1px 6px',
      borderRadius: 10,
      fontSize: 10,
      fontFamily: 'var(--v-font-ui)',
      fontWeight: 600,
      letterSpacing: '0.02em',
      lineHeight: 1,
      background: active ? 'var(--c-green-dim)' : 'var(--c-hover)',
      color:      active ? 'var(--v-success)'   : 'var(--v-sb-text)',
      border: `1px solid ${active ? 'var(--c-green)' : 'var(--c-border-md)'}`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: active ? 'var(--v-success)' : 'var(--v-sb-text)',
        flexShrink: 0,
      }} />
      {active ? 'Active' : 'Idle'}
    </span>
  );
}

// ─────────────────────────────────────────────
// StatusBar
// ─────────────────────────────────────────────

export function StatusBar() {
  const [metrics, setMetrics] = useState({
    hazards: 0,
    nodes: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics/dashboard');
        if (res.ok) {
          const data = await res.json();
          setMetrics({
            hazards: data.hazards?.total || 0,
            nodes: data.network?.activeNodes || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch status bar metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <footer
      className="vigia-statusbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 24,
        flexShrink: 0,
        userSelect: 'none',
        background: 'var(--v-sb-bg)',
      }}
    >
      {/* ── Left group ───────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>

        {/* Accent pill: location / connectivity */}
        <Seg accent title="Current location">
          <MapPin size={10} strokeWidth={2.2} style={{ color: 'var(--v-sb-accent-text)', flexShrink: 0 }} />
          <span style={{ ...TEXT, color: 'var(--v-sb-accent-text)', fontWeight: 600 }}>
            Rourkela · India · Online
          </span>
        </Seg>

        <Sep />

        {/* No errors */}
        <Seg onClick={() => {}} title="0 errors, 0 warnings">
          <CheckCircle size={10} strokeWidth={2.2} style={{ color: 'var(--v-success)', flexShrink: 0 }} />
          <span style={TEXT}>No errors</span>
        </Seg>

        <Sep />

        {/* Hazard count */}
        <Seg onClick={() => {}} title="Active hazard reports">
          <AlertTriangle size={10} strokeWidth={2.2} style={{ color: 'var(--v-accent)', flexShrink: 0 }} />
          <span style={TEXT}>{metrics.hazards} hazards</span>
        </Seg>

      </div>

      {/* ── Right group ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>

        {/* Network nodes */}
        <Seg onClick={() => {}} title="Connected DePIN nodes">
          <Activity size={10} strokeWidth={2.2} style={{ color: 'var(--v-accent)', flexShrink: 0 }} />
          <span style={TEXT}>{metrics.nodes} nodes</span>
        </Seg>

        <Sep />

        {/* ONNX runtime + pill */}
        <Seg onClick={() => {}} title="ONNX inference runtime">
          <Cpu size={10} strokeWidth={2.2} style={{ color: 'var(--v-sb-text)', flexShrink: 0 }} />
          <span style={TEXT}>ONNX</span>
          <OnnxPill active />
        </Seg>

        <Sep />

        {/* Agent Usage Indicator */}
        <AgentUsageIndicator />

        <Sep />

        {/* Latency */}
        <Seg title="API latency">
          <Wifi size={10} strokeWidth={2.2} style={{ color: 'var(--v-sb-text)', flexShrink: 0 }} />
          <span style={TEXT}>8ms</span>
        </Seg>

        <Sep />

        {/* Encoding */}
        <Seg title="File encoding and format">
          <span style={{ ...TEXT, color: 'var(--v-sb-text)', opacity: 0.7 }}>UTF-8 · GeoJSON</span>
        </Seg>

      </div>
    </footer>
  );
}
