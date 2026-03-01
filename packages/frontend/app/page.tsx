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
import { useSettings }          from './components/SettingsContext';
import { NewSessionView }       from './components/NewSessionView';
import { DetectionModeView }    from './components/DetectionModeView';
import { NetworkMapView }       from './components/NetworkMapView';

type MainTab    = 'map' | 'sentinel' | string; // Allow session IDs as tabs
type ConsoleTab = 'traces' | 'ledger' | 'console';

export default function Dashboard() {
  const { settings } = useSettings();
  const [activeMainTab,    setActiveMainTab]    = useState<MainTab | null>(null);
  const [explorerTabs,     setExplorerTabs]     = useState<Array<{id: string, label: string, session?: any, isNewSession?: boolean}>>([]);
  const [detectionTabs,    setDetectionTabs]    = useState<Array<{id: string, label: string, session?: any, isNewSession?: boolean}>>([]);
  const [explorerActiveTab, setExplorerActiveTab] = useState<MainTab | null>(null);
  const [detectionActiveTab, setDetectionActiveTab] = useState<MainTab | null>(null);
  const [activeConsoleTab, setActiveConsoleTab] = useState<ConsoleTab>('traces');
  const [consoleHeight,    setConsoleHeight]    = useState(220);
  const [settingsOpen,     setSettingsOpen]     = useState(false);
  const [selectedSession,  setSelectedSession]  = useState<any>(null);
  const [sidebarActivity,  setSidebarActivity]  = useState<'explorer' | 'detection' | 'network' | 'maintenance'>('explorer');
  const [splitView, setSplitView] = useState<{ left: any; right: any } | null>(null);

  // Listen for maintenance report requests from hazard clicks
  useEffect(() => {
    const handleMaintenanceReport = (event: CustomEvent) => {
      const { hazard } = event.detail;
      // Switch to maintenance activity
      setSidebarActivity('maintenance');
      
      // Store hazard data for pre-filling the form
      (window as any).__maintenanceHazard = hazard;
    };

    const handleSplitView = (event: CustomEvent) => {
      const { left, right } = event.detail;
      setSplitView({ left, right });
    };

    window.addEventListener('vigia-report-maintenance', handleMaintenanceReport as EventListener);
    window.addEventListener('vigia-split-view', handleSplitView as EventListener);
    
    return () => {
      window.removeEventListener('vigia-report-maintenance', handleMaintenanceReport as EventListener);
      window.removeEventListener('vigia-split-view', handleSplitView as EventListener);
    };
  }, []);

  // Get current tabs based on active activity
  const openTabs = sidebarActivity === 'explorer' ? explorerTabs : sidebarActivity === 'detection' ? detectionTabs : [];
  const setOpenTabs = sidebarActivity === 'explorer' ? setExplorerTabs : sidebarActivity === 'detection' ? setDetectionTabs : () => {};

  // ── Console resize ────────────────────────
  const isDragging  = useRef(false);
  const startY      = useRef(0);
  const startHeight = useRef(0);

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
      document.body.style.cursor = document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [consoleHeight]);

  const mainTabs = [
    { id: 'map'       as MainTab,    label: 'World Map',      icon: <MapPin size={14} /> },
    { id: 'sentinel'  as MainTab,    label: 'Detection Node', icon: <Video  size={14} /> },
  ];
  const consoleTabs = [
    { id: 'traces'    as ConsoleTab, label: 'Agent Traces', icon: <Radio    size={14} /> },
    { id: 'ledger'    as ConsoleTab, label: 'DePIN Ledger', icon: <Database size={14} /> },
    { id: 'console'   as ConsoleTab, label: 'Console',      icon: <Server   size={14} /> },
  ];

  const handleSessionClick = (session: any) => {
    if (session.status === 'creating') {
      setSelectedSession(session);
      setActiveMainTab('map');
      return;
    }

    // Check if tab already exists
    const existingTab = explorerTabs.find(t => t.id === session.sessionId);
    if (existingTab) {
      setActiveMainTab(session.sessionId);
      setSelectedSession(session);
    } else {
      // Create new tab with location name
      const city = session.location?.city || 'Unknown';
      const region = session.location?.region || '';
      const label = region ? `${city}, ${region}` : city;
      
      setExplorerTabs([...explorerTabs, { id: session.sessionId, label, session }]);
      setActiveMainTab(session.sessionId);
      setSelectedSession(session);
    }
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sidebarActivity === 'explorer') {
      const newTabs = explorerTabs.filter(t => t.id !== tabId);
      setExplorerTabs(newTabs);
      
      if (activeMainTab === tabId) {
        if (newTabs.length > 0) {
          setActiveMainTab(newTabs[newTabs.length - 1].id as MainTab);
        } else {
          setActiveMainTab(null);
          setSelectedSession(null);
        }
      }
    } else {
      const newTabs = detectionTabs.filter(t => t.id !== tabId);
      setDetectionTabs(newTabs);
      
      if (activeMainTab === tabId) {
        if (newTabs.length > 0) {
          setActiveMainTab(newTabs[newTabs.length - 1].id as MainTab);
        } else {
          setActiveMainTab(null);
          setSelectedSession(null);
        }
      }
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: 'var(--c-bg)',
      fontSize: `${settings.fontSize}px`,
      transition: 'background 0.2s, font-size 0.1s',
    }}>
      <TopBar onSettingsOpen={() => setSettingsOpen(true)} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        <Sidebar
          onSentinelEyeClick={() => {
            if (!detectionTabs.find(t => t.id === 'sentinel')) {
              setDetectionTabs([...detectionTabs, { id: 'sentinel', label: 'Detection Node' }]);
            }
            setActiveMainTab('sentinel');
          }}
          isSentinelEyeActive={activeMainTab === 'sentinel'}
          onSettingsOpen={() => setSettingsOpen(true)}
          onSessionClick={handleSessionClick}
          onActivityChange={(activity) => {
            // Save current active tab for current activity
            if (sidebarActivity === 'explorer') {
              setExplorerActiveTab(activeMainTab);
            } else {
              setDetectionActiveTab(activeMainTab);
            }
            
            setSidebarActivity(activity);
            
            // For detection activity, always show the detection view
            if (activity === 'detection') {
              if (!detectionTabs.find(t => t.id === 'sentinel')) {
                setDetectionTabs(prev => [...prev, { id: 'sentinel', label: 'Detection Node' }]);
              }
              setActiveMainTab('sentinel');
              setSelectedSession(null);
              return;
            }
            
            // For network activity, clear active tab to show network map
            if (activity === 'network') {
              setActiveMainTab(null);
              setSelectedSession(null);
              return;
            }
            
            // Restore active tab for explorer activity
            const tabs = explorerTabs;
            const savedActiveTab = explorerActiveTab;
            
            if (savedActiveTab && tabs.find(t => t.id === savedActiveTab)) {
              // Restore previously active tab
              setActiveMainTab(savedActiveTab);
              const tab = tabs.find(t => t.id === savedActiveTab);
              if (tab?.session) {
                setSelectedSession(tab.session);
              }
            } else if (tabs.length > 0) {
              // Fallback to last tab
              setActiveMainTab(tabs[tabs.length - 1].id as MainTab);
              if (tabs[tabs.length - 1].session) {
                setSelectedSession(tabs[tabs.length - 1].session);
              }
            } else {
              setActiveMainTab(null);
              setSelectedSession(null);
            }
          }}
          onNewSessionClick={() => {
            const newTabId = 'new-session-' + Date.now();
            setExplorerTabs([...explorerTabs, { id: newTabId, label: 'New Session', isNewSession: true }]);
            setActiveMainTab(newTabId);
          }}
          onRefreshSessions={() => {
            if ((window as any).__refreshSessions) {
              (window as any).__refreshSessions();
            }
          }}
          onSessionsDeleted={(sessionIds) => {
            // Close tabs for deleted sessions
            const newTabs = openTabs.filter(t => !sessionIds.includes(t.id));
            setOpenTabs(newTabs);
            
            // If active tab was deleted, switch to map
            if (activeMainTab && sessionIds.includes(activeMainTab)) {
              setActiveMainTab('map');
              setSelectedSession(null);
            }
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

          {/* Tab bar */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', height: 40, flexShrink: 0,
            background: 'var(--c-sidebar)', borderBottom: '1px solid var(--c-border)',
            overflowX: 'auto', overflowY: 'hidden',
          }}>
            {openTabs.map((tab) => {
              const active = activeMainTab === tab.id;
              const isCloseable = tab.id !== 'map' && tab.id !== 'sentinel';
              return (
                <button key={tab.id} onClick={() => {
                  setActiveMainTab(tab.id);
                  if (tab.session) setSelectedSession(tab.session);
                  else setSelectedSession(null);
                }} style={{
                  position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
                  height: '100%', padding: '0 16px', minWidth: 120, flexShrink: 0,
                  cursor: 'pointer', border: 'none',
                  borderRight: '1px solid rgba(255,255,255,0.06)',
                  background: active ? 'var(--c-panel)' : 'transparent',
                  color: active ? 'var(--c-text)' : 'var(--c-text-3)',
                  fontSize: '0.85rem', fontWeight: active ? 500 : 400,
                  fontFamily: 'Inter, sans-serif', transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {tab.id === 'map' && <span style={{ color: active ? 'var(--c-accent-2)' : 'var(--c-text-3)' }}><MapPin size={14} /></span>}
                  {tab.id === 'sentinel' && <span style={{ color: active ? 'var(--c-accent-2)' : 'var(--c-text-3)' }}><Video size={14} /></span>}
                  {tab.label}
                  {isCloseable && (
                    <span onClick={(e) => closeTab(tab.id, e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, marginLeft: 4, color: 'var(--c-text-3)', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)'}
                    >
                      <X size={12} />
                    </span>
                  )}
                  {active && <span className="tab-line" />}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
          </div>

          {activeMainTab === 'map' && (
            selectedSession && selectedSession.status !== 'creating'
              ? <Breadcrumb path={['World', selectedSession.location?.country || 'Unknown', selectedSession.location?.region || '', selectedSession.location?.city || ''].filter(Boolean)} />
              : <Breadcrumb path={['World', 'India', 'Odisha', 'Rourkela']} />
          )}

          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {sidebarActivity === 'network' ? (
              <NetworkMapView />
            ) : !activeMainTab ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                flexDirection: 'column',
                gap: 16,
                background: 'var(--c-bg)',
              }}>
                {sidebarActivity === 'explorer' ? (
                  <>
                    <MapPin size={64} style={{ color: 'var(--c-text-3)', opacity: 0.3 }} />
                    <div style={{ 
                      fontSize: '1.2rem', 
                      color: 'var(--c-text-2)', 
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                    }}>
                      Explore, Plan & Solve Road Infrastructure
                    </div>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: 'var(--c-text-3)', 
                      fontFamily: 'Inter, sans-serif',
                      textAlign: 'center',
                      maxWidth: 400,
                    }}>
                      Select a session from the explorer or create a new one to visualize hazards on the map
                    </div>
                  </>
                ) : (
                  <>
                    <Video size={64} style={{ color: 'var(--c-text-3)', opacity: 0.3 }} />
                    <div style={{ 
                      fontSize: '1.2rem', 
                      color: 'var(--c-text-2)', 
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                    }}>
                      Real-Time Hazard Detection
                    </div>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: 'var(--c-text-3)', 
                      fontFamily: 'Inter, sans-serif',
                      textAlign: 'center',
                      maxWidth: 400,
                    }}>
                      Click Detection Node to upload dashcam footage and detect potholes in real-time
                    </div>
                  </>
                )}
              </div>
            ) : openTabs.find(t => t.id === activeMainTab)?.isNewSession ? (
              <NewSessionView 
                onRefreshSessions={() => {
                  if ((window as any).__refreshSessions) {
                    (window as any).__refreshSessions();
                  }
                }}
                onSessionCreated={(session) => {
                  console.log('Session created:', session);
                  // Replace "New Session" tab with actual session
                  const newTabs = explorerTabs.map(t => 
                    t.id === activeMainTab 
                      ? { 
                          id: session.sessionId, 
                          label: `${session.location?.city || 'Unknown'}, ${session.location?.region || ''}`.replace(/, $/, ''),
                          session 
                        }
                      : t
                  );
                  console.log('New tabs:', newTabs);
                  setExplorerTabs(newTabs);
                  setActiveMainTab(session.sessionId);
                  setSelectedSession(session);
                  console.log('Selected session set to:', session);
                }}
              />
            ) : selectedSession?.status === 'creating' ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                flexDirection: 'column',
                gap: 16,
                background: 'var(--c-bg)',
              }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  border: '3px solid var(--c-border)', 
                  borderTop: '3px solid var(--c-accent)', 
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--c-text-2)', 
                  fontFamily: 'Inter, sans-serif',
                }}>
                  Creating session at {selectedSession.location?.name}...
                </div>
              </div>
            ) : activeMainTab === 'sentinel' ? (
              <DetectionModeView />
            ) : splitView ? (
              <div style={{ display: 'flex', height: '100%', gap: 1, background: 'var(--c-border)' }}>
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute', 
                    top: 8, 
                    left: 8, 
                    zIndex: 10,
                    background: 'rgba(0,0,0,0.8)',
                    padding: '4px 8px',
                    borderRadius: 3,
                    fontSize: '0.7rem',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {splitView.left.location?.city || 'Session'} - {new Date(splitView.left.timestamp).toLocaleDateString()}
                  </div>
                  <LiveMap key={splitView.left.sessionId} selectedSession={splitView.left} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute', 
                    top: 8, 
                    left: 8, 
                    zIndex: 10,
                    background: 'rgba(0,0,0,0.8)',
                    padding: '4px 8px',
                    borderRadius: 3,
                    fontSize: '0.7rem',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {splitView.right.location?.city || 'Session'} - {new Date(splitView.right.timestamp).toLocaleDateString()}
                  </div>
                  <LiveMap key={splitView.right.sessionId} selectedSession={splitView.right} />
                </div>
                <button
                  onClick={() => setSplitView(null)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 20,
                    background: 'rgba(0,0,0,0.8)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 3,
                    padding: '4px 8px',
                    color: '#fff',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  Close Split
                </button>
              </div>
            ) : selectedSession ? (
              <LiveMap key={selectedSession?.sessionId || 'default'} selectedSession={selectedSession} />
            ) : null}
          </div>

          {/* Console */}
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, height: consoleHeight, borderTop: '1px solid var(--c-border)' }}>
            <div className="drag-handle-y" onMouseDown={onResizeDown} style={{
              height: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--c-sidebar)', cursor: 'ns-resize',
            }}>
              <div className="drag-pip" style={{ width: 28, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.09)', transition: 'background 0.15s' }} />
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', height: 38, flexShrink: 0,
              background: 'var(--c-sidebar)', borderBottom: '1px solid var(--c-border)',
            }}>
              {consoleTabs.map((tab) => {
                const active = activeConsoleTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveConsoleTab(tab.id)} style={{
                    position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0 16px', height: '100%', cursor: 'pointer', border: 'none',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    background: active ? 'var(--c-panel)' : 'transparent',
                    color: active ? 'var(--c-text)' : 'var(--c-text-3)',
                    fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ color: active ? 'var(--c-accent-2)' : 'var(--c-text-3)' }}>{tab.icon}</span>
                    {tab.label}
                    {active && <span className="tab-line" />}
                  </button>
                );
              })}
              <div style={{ flex: 1 }} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', background: 'var(--c-deep)' }}>
              {activeConsoleTab === 'traces'   && <ReasoningTraceViewer />}
              {activeConsoleTab === 'ledger'   && <LedgerTicker />}
              {activeConsoleTab === 'console'  && <ConsoleViewer />}
            </div>
          </div>
        </div>

        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>

      <StatusBar />
    </div>
  );
}
