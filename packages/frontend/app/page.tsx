'use client';

import { useState, useRef, useCallback } from 'react';
import { X, MapPin, Video, Terminal as TerminalIcon, Database, Radio, Server } from 'lucide-react';
import { VideoUploader } from './components/VideoUploader';
import { LiveMap } from './components/LiveMap';
import { LedgerTicker } from './components/LedgerTicker';
import { ReasoningTraceViewer } from './components/ReasoningTraceViewer';
import { Sidebar } from './components/Sidebar';
import { Breadcrumb } from './components/Breadcrumb';
import { TopBar } from './components/TopBar';
import { StatusBar } from './components/StatusBar';

// ─────────────────────────────────────────────
// Design tokens (inline — immune to Tailwind v4 resolution)
// ─────────────────────────────────────────────
const C = {
  bgBase:     '#0E1117',
  bgSidebar:  '#161B22',
  bgPanel:    '#1A1F28',
  bgDeep:     '#0A0D12',
  border:     'rgba(255,255,255,0.07)',
  accent:     '#2563EB',
  accentBrt:  '#3B82F6',
  textPri:    '#E2E8F0',
  textSec:    '#8B95A1',
  textMut:    '#4B5563',
  green:      '#10B981',
  red:        '#EF4444',
  yellow:     '#F59E0B',
} as const;

type MainTab    = 'map' | 'sentinel';
type ConsoleTab = 'traces' | 'ledger' | 'terminal';

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────

export default function Dashboard() {
  const [activeMainTab,    setActiveMainTab]    = useState<MainTab>('map');
  const [activeConsoleTab, setActiveConsoleTab] = useState<ConsoleTab>('traces');
  const [consoleHeight,    setConsoleHeight]    = useState(220);

  // ── Resize drag ───────────────────────────
  const isDragging   = useRef(false);
  const startY       = useRef(0);
  const startHeight  = useRef(0);

  const onResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current  = true;
    startY.current      = e.clientY;
    startHeight.current = consoleHeight;
    document.body.style.cursor     = 'ns-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - ev.clientY;
      setConsoleHeight(Math.max(80, Math.min(window.innerHeight * 0.55, startHeight.current + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [consoleHeight]);

  // ── Tab data ──────────────────────────────
  const mainTabs = [
    { id: 'map'      as MainTab, label: 'World Map',    icon: <MapPin size={11} /> },
    { id: 'sentinel' as MainTab, label: 'Sentinel Eye', icon: <Video  size={11} /> },
  ];
  const consoleTabs = [
    { id: 'traces'   as ConsoleTab, label: 'Agent Traces',  icon: <Radio    size={11} /> },
    { id: 'ledger'   as ConsoleTab, label: 'DePIN Ledger',  icon: <Database size={11} /> },
    { id: 'terminal' as ConsoleTab, label: 'Terminal',      icon: <Server   size={11} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', background: C.bgBase }}>

      {/* ── Top Bar ───────────────────────── */}
      <TopBar />

      {/* ── Main Body ─────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── Sidebar ───────────────────── */}
        <Sidebar
          onSentinelEyeClick={() => setActiveMainTab('sentinel')}
          isSentinelEyeActive={activeMainTab === 'sentinel'}
        />

        {/* ── Editor + Console ──────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

          {/* ── Main Tab Bar ────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            height: 32,
            flexShrink: 0,
            background: C.bgSidebar,
            borderBottom: `1px solid ${C.border}`,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}>
            {mainTabs.map((tab) => {
              const active = activeMainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveMainTab(tab.id)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: '100%',
                    padding: '0 16px',
                    minWidth: 120,
                    flexShrink: 0,
                    cursor: 'pointer',
                    border: 'none',
                    borderRight: `1px solid rgba(255,255,255,0.06)`,
                    background: active ? C.bgPanel : 'transparent',
                    color: active ? C.textPri : C.textMut,
                    fontSize: '0.74rem',
                    fontWeight: active ? 500 : 400,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ color: active ? C.accentBrt : C.textMut }}>{tab.icon}</span>
                  {tab.label}
                  <span style={{ color: C.textMut, marginLeft: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16 }}>
                    <X size={10} />
                  </span>
                  {active && (
                    <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: C.accentBrt }} />
                  )}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
          </div>

          {/* ── Breadcrumb (map only) ──── */}
          {activeMainTab === 'map' && (
            <Breadcrumb path={['World', 'India', 'Odisha', 'Rourkela']} />
          )}

          {/* ── Main Content ─────────── */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {activeMainTab === 'map' && <LiveMap />}
            {activeMainTab === 'sentinel' && (
              <div style={{ height: '100%', overflowY: 'auto', padding: 24, background: C.bgBase }}>
                <VideoUploader />
              </div>
            )}
          </div>

          {/* ── Bottom Console ──────────── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            height: consoleHeight,
            borderTop: `1px solid ${C.border}`,
          }}>
            {/* Resize handle */}
            <div
              className="resize-handle"
              onMouseDown={onResizeDown}
              style={{
                height: 12,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: C.bgSidebar,
                cursor: 'ns-resize',
              }}
            >
              <div
                className="resize-pip"
                style={{ width: 32, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.1)', transition: 'background 0.15s' }}
              />
            </div>

            {/* Console Tab Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              height: 32,
              flexShrink: 0,
              background: C.bgSidebar,
              borderBottom: `1px solid ${C.border}`,
            }}>
              {/* Label */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                height: '100%',
                borderRight: `1px solid ${C.border}`,
                color: C.textMut,
              }}>
                <TerminalIcon size={11} />
                <span style={{ fontSize: '0.66rem', letterSpacing: '0.06em' }}>CONSOLE</span>
              </div>

              {consoleTabs.map((tab) => {
                const active = activeConsoleTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveConsoleTab(tab.id)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0 14px',
                      height: '100%',
                      cursor: 'pointer',
                      border: 'none',
                      borderRight: `1px solid rgba(255,255,255,0.06)`,
                      background: active ? C.bgPanel : 'transparent',
                      color: active ? C.textPri : '#6B7280',
                      fontSize: '0.72rem',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ color: active ? C.accentBrt : C.textMut }}>{tab.icon}</span>
                    {tab.label}
                    {active && (
                      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: C.accentBrt }} />
                    )}
                  </button>
                );
              })}
              <div style={{ flex: 1 }} />
            </div>

            {/* Console Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              background: C.bgDeep,
            }}>
              {activeConsoleTab === 'traces'  && <ReasoningTraceViewer />}
              {activeConsoleTab === 'ledger'  && <LedgerTicker />}
              {activeConsoleTab === 'terminal' && (
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}>
                  {[
                    { text: 'System initialized',             color: '#6B7280' },
                    { text: 'Ready for telemetry ingestion',  color: '#6B7280' },
                    { text: 'ONNX Runtime: Loaded',           color: C.green   },
                    { text: 'Bedrock Agent: Connected',       color: C.green   },
                    { text: 'DynamoDB: Polling active',       color: C.green   },
                    { text: 'Edge swarm: 48 nodes online',    color: C.accentBrt },
                  ].map(({ text, color }, i) => (
                    <div key={i} className="log-line" style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ color: '#2D3440' }}>›</span>
                      <span style={{ color }}>{text}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <span style={{ color: '#2D3440' }}>›</span>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 14,
                        background: C.accent,
                        verticalAlign: 'text-bottom',
                        animation: 'status-pulse 1s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Bar ────────────────────── */}
      <StatusBar />
    </div>
  );
}
