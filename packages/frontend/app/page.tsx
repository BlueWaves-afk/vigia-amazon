'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, MapPin, Video, Terminal as TerminalIcon, Database, Radio, Server } from 'lucide-react';
import { VideoUploader }        from './components/VideoUploader';
import { LiveMap }              from './components/LiveMap';
import { LedgerTicker }         from './components/LedgerTicker';
import { ReasoningTraceViewer } from './components/ReasoningTraceViewer';
import { ConsoleViewer }        from './components/ConsoleViewer';
import { Sidebar }              from './components/Sidebar';
import { Breadcrumb }           from './components/Breadcrumb';
import { TopBar }               from './components/TopBar';
import { StatusBar }            from './components/StatusBar';
import { SettingsPanel }        from './components/SettingsPanel';
import { CommandPalette }       from './components/CommandPalette';
import { ToastContainer, toast } from './components/ToastSystem';
import { useSettings }          from './components/SettingsContext';
import { NewSessionView }       from './components/NewSessionView';
import { DetectionModeView }    from './components/DetectionModeView';
import { NetworkMapView }       from './components/NetworkMapView';

type MainTab    = 'map' | 'sentinel' | string;
type ConsoleTab = 'traces' | 'ledger' | 'console';

export default function Dashboard() {
  const { settings } = useSettings();
  const [activeMainTab,      setActiveMainTab]      = useState<MainTab | null>(null);
  const [explorerTabs,       setExplorerTabs]       = useState<Array<{id: string; label: string; session?: any; isNewSession?: boolean}>>([]);
  const [detectionTabs,      setDetectionTabs]      = useState<Array<{id: string; label: string; session?: any; isNewSession?: boolean}>>([]);
  const [explorerActiveTab,  setExplorerActiveTab]  = useState<MainTab | null>(null);
  const [detectionActiveTab, setDetectionActiveTab] = useState<MainTab | null>(null);
  const [activeConsoleTab,   setActiveConsoleTab]   = useState<ConsoleTab>('traces');
  const [consoleHeight,      setConsoleHeight]      = useState(220);
  const [settingsOpen,       setSettingsOpen]       = useState(false);
  const [cmdOpen,            setCmdOpen]            = useState(false);
  const [selectedSession,    setSelectedSession]    = useState<any>(null);
  const [sidebarActivity,    setSidebarActivity]    = useState<'explorer' | 'detection' | 'network' | 'maintenance'>('explorer');
  const [splitView,          setSplitView]          = useState<{ left: any; right: any } | null>(null);
  // Track which content tab is showing for crossfade key
  const [mainTabKey,         setMainTabKey]         = useState(0);
  const [consoleTabKey,      setConsoleTabKey]      = useState(0);

  // ── ⌘K global listener ───────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Custom events ─────────────────────────
  useEffect(() => {
    const handleMaintenanceReport = (event: CustomEvent) => {
      setSidebarActivity('maintenance');
      (window as any).__maintenanceHazard = event.detail.hazard;
    };
    const handleSplitView = (event: CustomEvent) => {
      setSplitView(event.detail);
      toast.info('Split View', 'Comparing two sessions side by side');
    };
    window.addEventListener('vigia-report-maintenance', handleMaintenanceReport as EventListener);
    window.addEventListener('vigia-split-view', handleSplitView as EventListener);
    return () => {
      window.removeEventListener('vigia-report-maintenance', handleMaintenanceReport as EventListener);
      window.removeEventListener('vigia-split-view', handleSplitView as EventListener);
    };
  }, []);

  const openTabs   = sidebarActivity === 'explorer' ? explorerTabs : sidebarActivity === 'detection' ? detectionTabs : [];
  const setOpenTabs = sidebarActivity === 'explorer' ? setExplorerTabs : sidebarActivity === 'detection' ? setDetectionTabs : () => {};

  // ── Console resize ────────────────────────
  const isDragging = useRef(false);
  const startY     = useRef(0);
  const startH     = useRef(0);

  const onResizeDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startH.current = consoleHeight;
    document.body.style.cursor = document.body.style.userSelect = '';
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setConsoleHeight(Math.max(80, Math.min(window.innerHeight * 0.55, startH.current + startY.current - ev.clientY)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [consoleHeight]);

  // ── Tab switching with crossfade key ──────
  const switchMainTab = useCallback((id: MainTab) => {
    setActiveMainTab(id);
    setMainTabKey(k => k + 1);
  }, []);

  const switchConsoleTab = useCallback((id: ConsoleTab) => {
    setActiveConsoleTab(id);
    setConsoleTabKey(k => k + 1);
  }, []);

  // ── Session handling ──────────────────────
  const handleSessionClick = (session: any) => {
    if (session.status === 'creating') {
      setSelectedSession(session);
      switchMainTab('map');
      return;
    }
    const existingTab = explorerTabs.find(t => t.id === session.sessionId);
    if (existingTab) {
      switchMainTab(session.sessionId);
      setSelectedSession(session);
    } else {
      const city   = session.location?.city   || 'Unknown';
      const region = session.location?.region || '';
      const label  = region ? `${city}, ${region}` : city;
      setExplorerTabs(prev => [...prev, { id: session.sessionId, label, session }]);
      switchMainTab(session.sessionId);
      setSelectedSession(session);
      toast.info('Session opened', label);
    }
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs as any);
    if (activeMainTab === tabId) {
      const next = newTabs[newTabs.length - 1];
      if (next) { switchMainTab(next.id); if (next.session) setSelectedSession(next.session); }
      else { setActiveMainTab(null); setSelectedSession(null); }
    }
  };

  const consoleTabs = [
    { id: 'traces'  as ConsoleTab, label: 'Agent Traces', icon: <Radio    size={13} /> },
    { id: 'ledger'  as ConsoleTab, label: 'DePIN Ledger', icon: <Database size={13} /> },
    { id: 'console' as ConsoleTab, label: 'Console',      icon: <Server   size={13} /> },
  ];

  // ── Tab button style ──────────────────────
  const tabBtn = (active: boolean): React.CSSProperties => ({
    position: 'relative', display: 'flex', alignItems: 'center', gap: 7,
    height: '100%', padding: '0 14px', minWidth: 110, flexShrink: 0,
    cursor: 'pointer', border: 'none',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    background: active ? 'var(--c-panel)' : 'transparent',
    color: active ? 'var(--c-text)' : 'var(--c-text-3)',
    fontSize: '0.76rem', fontWeight: active ? 500 : 400,
    fontFamily: 'IBM Plex Sans, sans-serif',
    transition: 'background 0.12s, color 0.12s',
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: 'var(--c-bg)',
      fontSize: `${settings.fontSize}px`,
      transition: 'background 0.18s, font-size 0.1s',
    }}>
      <TopBar
        onSettingsOpen={() => setSettingsOpen(true)}
        onCommandOpen={() => setCmdOpen(true)}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        <Sidebar
          onSentinelEyeClick={() => {
            if (!detectionTabs.find(t => t.id === 'sentinel'))
              setDetectionTabs(prev => [...prev, { id: 'sentinel', label: 'Detection Node' }]);
            switchMainTab('sentinel');
          }}
          isSentinelEyeActive={activeMainTab === 'sentinel'}
          onSettingsOpen={() => setSettingsOpen(true)}
          onSessionClick={handleSessionClick}
          onActivityChange={(activity) => {
            if (sidebarActivity === 'explorer') setExplorerActiveTab(activeMainTab);
            else setDetectionActiveTab(activeMainTab);
            setSidebarActivity(activity);
            if (activity === 'detection') {
              if (!detectionTabs.find(t => t.id === 'sentinel'))
                setDetectionTabs(prev => [...prev, { id: 'sentinel', label: 'Detection Node' }]);
              switchMainTab('sentinel'); setSelectedSession(null); return;
            }
            if (activity === 'network') { setActiveMainTab(null); setSelectedSession(null); return; }
            const tabs = explorerTabs;
            const saved = explorerActiveTab;
            if (saved && tabs.find(t => t.id === saved)) {
              switchMainTab(saved);
              const tab = tabs.find(t => t.id === saved);
              if (tab?.session) setSelectedSession(tab.session);
            } else if (tabs.length > 0) {
              switchMainTab(tabs[tabs.length - 1].id as MainTab);
              if (tabs[tabs.length - 1].session) setSelectedSession(tabs[tabs.length - 1].session);
            } else { setActiveMainTab(null); setSelectedSession(null); }
          }}
          onNewSessionClick={() => {
            const id = 'new-session-' + Date.now();
            setExplorerTabs(prev => [...prev, { id, label: 'New Session', isNewSession: true }]);
            switchMainTab(id);
          }}
          onRefreshSessions={() => { if ((window as any).__refreshSessions) (window as any).__refreshSessions(); }}
          onSessionsDeleted={(sessionIds) => {
            const newTabs = openTabs.filter(t => !sessionIds.includes(t.id));
            setOpenTabs(newTabs as any);
            if (activeMainTab && sessionIds.includes(activeMainTab)) {
              setActiveMainTab(null); setSelectedSession(null);
            }
            toast.success('Sessions deleted', `${sessionIds.length} session(s) removed`);
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

          {/* ── Main Tab Bar ─────────────── */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', height: 36, flexShrink: 0,
            background: 'var(--c-sidebar)', borderBottom: '1px solid var(--c-border)',
            overflowX: 'auto', overflowY: 'hidden',
          }}>
            {openTabs.map((tab) => {
              const active = activeMainTab === tab.id;
              const closeable = tab.id !== 'map' && tab.id !== 'sentinel';
              return (
                <button key={tab.id}
                  onClick={() => { switchMainTab(tab.id); if (tab.session) setSelectedSession(tab.session); else setSelectedSession(null); }}
                  style={tabBtn(active)}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {tab.id === 'map'      && <span style={{ color: active ? 'var(--c-accent-2)' : 'var(--c-text-3)' }}><MapPin size={12} /></span>}
                  {tab.id === 'sentinel' && <span style={{ color: active ? 'var(--c-accent-2)' : 'var(--c-text-3)' }}><Video  size={12} /></span>}
                  {tab.label}
                  {closeable && (
                    <span onClick={(e) => closeTab(tab.id, e)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 16, height: 16, marginLeft: 2, color: 'var(--c-text-3)',
                      cursor: 'pointer', borderRadius: 3, transition: 'background 0.1s, color 0.1s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)'; }}
                    >
                      <X size={10} />
                    </span>
                  )}
                  {active && <span className="tab-line" />}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
          </div>

          {activeMainTab === 'map' && (
            <Breadcrumb path={
              selectedSession?.status !== 'creating'
                ? ['World', selectedSession?.location?.country, selectedSession?.location?.region, selectedSession?.location?.city].filter(Boolean)
                : ['World', 'India', 'Odisha', 'Rourkela']
            } />
          )}

          {/* ── Main Content — crossfade ─── */}
          <div key={mainTabKey} className="panel-fade" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {sidebarActivity === 'network' ? (
              <NetworkMapView />
            ) : !activeMainTab ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', flexDirection: 'column', gap: 14,
                background: 'var(--c-bg)',
              }}>
                <MapPin size={48} style={{ color: 'var(--c-text-3)', opacity: 0.2 }} />
                <div style={{ fontSize: '1rem', color: 'var(--c-text-2)', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 600 }}>
                  {sidebarActivity === 'explorer' ? 'Explore Road Infrastructure' : 'Real-Time Hazard Detection'}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--c-text-3)', fontFamily: 'IBM Plex Sans, sans-serif', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
                  {sidebarActivity === 'explorer'
                    ? 'Select a session from the explorer or create a new one'
                    : 'Click Detection Node to upload dashcam footage'}
                </div>
              </div>
            ) : openTabs.find(t => t.id === activeMainTab)?.isNewSession ? (
              <NewSessionView
                onRefreshSessions={() => { if ((window as any).__refreshSessions) (window as any).__refreshSessions(); }}
                onSessionCreated={(session) => {
                  const newTabs = explorerTabs.map(t =>
                    t.id === activeMainTab
                      ? { id: session.sessionId, label: `${session.location?.city || 'Unknown'}${session.location?.region ? ', ' + session.location.region : ''}`, session }
                      : t
                  );
                  setExplorerTabs(newTabs);
                  switchMainTab(session.sessionId);
                  setSelectedSession(session);
                  toast.success('Session created', session.location?.city || 'New session ready');
                }}
              />
            ) : selectedSession?.status === 'creating' ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', flexDirection: 'column', gap: 16, background: 'var(--c-bg)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: '2px solid var(--c-border)',
                  borderTop: '2px solid var(--c-rose)',
                  animation: 'spin 0.9s linear infinite',
                }} />
                <div style={{ fontSize: '0.78rem', color: 'var(--c-text-2)', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  Creating session at {selectedSession.location?.name}...
                </div>
              </div>
            ) : activeMainTab === 'sentinel' ? (
              <DetectionModeView />
            ) : splitView ? (
              <div style={{ display: 'flex', height: '100%', gap: 1, background: 'var(--c-border)' }}>
                {[splitView.left, splitView.right].map((s, i) => (
                  <div key={i} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', top: 8, left: 8, zIndex: 10,
                      background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: 3,
                      fontSize: '0.68rem', color: '#fff', fontFamily: 'IBM Plex Sans, sans-serif',
                      border: '1px solid var(--c-rose-border)',
                    }}>
                      {s.location?.city || 'Session'} — {new Date(s.timestamp).toLocaleDateString()}
                    </div>
                    <LiveMap key={s.sessionId} selectedSession={s} />
                  </div>
                ))}
                <button onClick={() => { setSplitView(null); toast.info('Split view closed'); }} style={{
                  position: 'absolute', top: 8, right: 8, zIndex: 20,
                  background: 'var(--c-elevated)', border: '1px solid var(--c-rose-border)',
                  borderRadius: 3, padding: '4px 10px', color: 'var(--c-rose-2)',
                  fontSize: '0.70rem', cursor: 'pointer', fontFamily: 'IBM Plex Sans, sans-serif',
                }}>
                  Close Split
                </button>
              </div>
            ) : selectedSession ? (
              <LiveMap key={selectedSession?.sessionId || 'default'} selectedSession={selectedSession} />
            ) : null}
          </div>

          {/* ── Console ──────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, height: consoleHeight, borderTop: '1px solid var(--c-border)' }}>

            {/* Resize handle */}
            <div className="drag-handle-y" onMouseDown={onResizeDown} style={{
              height: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-sidebar)', cursor: 'ns-resize',
            }}>
              <div className="drag-pip" style={{ width: 24, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.08)', transition: 'background 0.15s' }} />
            </div>

            {/* Console Tab Bar */}
            <div style={{
              display: 'flex', alignItems: 'center', height: 34, flexShrink: 0,
              background: 'var(--c-sidebar)', borderBottom: '1px solid var(--c-border)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 12px', height: '100%',
                borderRight: '1px solid var(--c-border)', color: 'var(--c-text-3)',
              }}>
                <TerminalIcon size={11} />
                <span style={{ fontSize: '0.60rem', letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: 600 }}>
                  Console
                </span>
              </div>

              {consoleTabs.map((tab) => {
                const active = activeConsoleTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => switchConsoleTab(tab.id)} style={tabBtn(active)}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ color: active ? 'var(--c-rose)' : 'var(--c-text-3)' }}>{tab.icon}</span>
                    {tab.label}
                    {active && <span className="tab-line" />}
                  </button>
                );
              })}
              <div style={{ flex: 1 }} />
            </div>

            {/* Console content — crossfade */}
            <div key={consoleTabKey} className="panel-fade" style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', background: 'var(--c-deep)' }}>
              {activeConsoleTab === 'traces'  && <ReasoningTraceViewer />}
              {activeConsoleTab === 'ledger'  && <LedgerTicker />}
              {activeConsoleTab === 'console' && <ConsoleViewer />}
            </div>
          </div>
        </div>

        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>

      <StatusBar />

      {/* ── Overlays ─────────────────────── */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={(tab) => switchMainTab(tab as MainTab)}
        onSettingsOpen={() => setSettingsOpen(true)}
      />
      <ToastContainer />
    </div>
  );
}
