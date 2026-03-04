'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, MapPin, Video, Terminal as TerminalIcon, Database, Radio } from 'lucide-react';
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
import { DiffView }             from './components/DiffView';
import { DetectionModeView }    from './components/DetectionModeView';
import { NetworkMapView }       from './components/NetworkMapView';
import { MaintenancePanel }     from './components/MaintenancePanelIntegrated';
import { AgentChatPanel }       from './components/AgentChatPanel';
import { NetworkHealthPanel }   from './components/NetworkHealthPanel';
import { UrbanPlannerModal }    from './components/UrbanPlannerModal';

type MainTab    = 'map' | 'sentinel' | string;
type ConsoleTab = 'traces' | 'ledger' | 'console' | 'network';

export default function Dashboard() {
  const { settings } = useSettings();
  const [activeMainTab,      setActiveMainTab]      = useState<MainTab | null>(null);
  const [explorerTabs,       setExplorerTabs]       = useState<Array<{id: string; label: string; session?: any; isNewSession?: boolean; isDirty?: boolean; diffMap?: any}>>([]);
  const [detectionTabs,      setDetectionTabs]      = useState<Array<{id: string; label: string; session?: any; isNewSession?: boolean; isDirty?: boolean; diffMap?: any}>>([]);
  const [explorerActiveTab,  setExplorerActiveTab]  = useState<MainTab | null>(null);
  const [detectionActiveTab, setDetectionActiveTab] = useState<MainTab | null>(null);
  const [activeConsoleTab,   setActiveConsoleTab]   = useState<ConsoleTab>('traces');
  const [consoleHeight,      setConsoleHeight]      = useState(220);
  const [settingsOpen,       setSettingsOpen]       = useState(false);
  const [cmdOpen,            setCmdOpen]            = useState(false);
  const [selectedSession,    setSelectedSession]    = useState<any>(null);
  const [sidebarActivity,    setSidebarActivity]    = useState<'explorer' | 'detection' | 'network' | 'maintenance'>('explorer');
  const [showUrbanPlanner,   setShowUrbanPlanner]   = useState(false);
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
      // Cmd+S / Ctrl+S to save active session
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveActiveSession();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeMainTab, explorerTabs, selectedSession]);

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
    const handleDiffCreated = (event: CustomEvent) => {
      const { diffMap } = event.detail;
      const diffId = diffMap.diffId;
      const label = diffMap.displayName;
      
      // Add diff tab
      setExplorerTabs(prev => [...prev, { 
        id: diffId, 
        label, 
        diffMap 
      }]);
      switchMainTab(diffId);
      toast.success('Diff Created', label);
    };
    
    window.addEventListener('vigia-report-maintenance', handleMaintenanceReport as EventListener);
    window.addEventListener('vigia-split-view', handleSplitView as EventListener);
    window.addEventListener('vigia-diff-created', handleDiffCreated as EventListener);
    return () => {
      window.removeEventListener('vigia-report-maintenance', handleMaintenanceReport as EventListener);
      window.removeEventListener('vigia-split-view', handleSplitView as EventListener);
      window.removeEventListener('vigia-diff-created', handleDiffCreated as EventListener);
    };
  }, []);

  const openTabs   = sidebarActivity === 'explorer' ? explorerTabs : sidebarActivity === 'detection' ? detectionTabs : [];
  const setOpenTabs = sidebarActivity === 'explorer' ? setExplorerTabs : sidebarActivity === 'detection' ? setDetectionTabs : () => {};

  // ── Save active session to VFSManager ────
  const saveActiveSession = async () => {
    console.log('saveActiveSession called', { activeMainTab, openTabs });
    const activeTab = openTabs.find(t => t.id === activeMainTab);
    console.log('Active tab:', activeTab);
    
    // Handle diff map save
    if (activeTab?.diffMap) {
      try {
        const { mapFileDB } = await import('@/lib/storage/mapFileDB');
        await mapFileDB.saveDiffMap(activeTab.diffMap);
        toast.success('Diff saved', activeTab.label);
        return;
      } catch (err) {
        console.error('Failed to save diff:', err);
        toast.error('Save failed', 'Could not save diff');
        return;
      }
    }
    
    if (!activeTab?.isDirty || !activeTab.session) {
      console.log('Not saving - no dirty tab or session');
      return;
    }

    try {
      // Get VFSManager instance from Sidebar
      const vfsManager = (window as any).__vfsManager;
      console.log('VFSManager:', vfsManager);
      
      if (!vfsManager) {
        toast.error('Save failed', 'VFS Manager not initialized');
        return;
      }

      // Convert MapFile to SessionData format
      const session = activeTab.session;
      const sessionData = {
        userId: 'default',
        geohash7: session.coverage.centerPoint.geohash,
        timestamp: new Date(session.temporal.createdAt).toISOString(),
        hazardCount: session.metadata.totalHazards,
        verifiedCount: session.hazards.filter((h: any) => h.status === 'verified').length,
        contributorId: 'user',
        status: session.temporal.status,
        location: session.location,
        hazards: session.hazards,
        metadata: {
          ...session.metadata,
          displayName: session.displayName, // Preserve displayName
          coverage: session.coverage, // Preserve coverage data
          temporal: session.temporal, // Preserve temporal data
        },
      };

      console.log('Saving session data:', sessionData);
      const saved = await vfsManager.createSession(sessionData);
      console.log('Session saved:', saved);

      // Delete from temporary storage (IndexedDB) since it's now in permanent storage
      const { useMapFileStore } = await import('@/stores/mapFileStore');
      await useMapFileStore.getState().deleteMapFile(session.sessionId);
      console.log('Deleted from temporary storage');

      // Mark as saved and update tab label
      const newTabs = openTabs.map(t =>
        t.id === activeMainTab ? { ...t, isDirty: false, label: session.displayName } : t
      );
      setOpenTabs(newTabs as any);

      // Refresh sidebar
      if ((window as any).__refreshSessions) {
        (window as any).__refreshSessions();
      }

      toast.success('Session saved', session.displayName);
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Save failed', String(err));
    }
  };

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
  const handleSessionClick = async (session: any) => {
    console.log('Session clicked:', session);
    
    if (session.status === 'creating') {
      setSelectedSession(session);
      switchMainTab('map');
      return;
    }
    
    // For temporary files, load full MapFile from IndexedDB
    let fullSession = session;
    if (session.isTemporary) {
      try {
        const { useMapFileStore } = await import('@/stores/mapFileStore');
        const mapFile = useMapFileStore.getState().files.get(session.sessionId);
        if (mapFile) {
          fullSession = mapFile;
          console.log('Loaded full MapFile:', fullSession);
        }
      } catch (err) {
        console.error('Failed to load full session:', err);
      }
    } else {
      // For saved sessions, reconstruct full session with coverage data from metadata
      if (session.metadata?.coverage) {
        fullSession = {
          ...session,
          coverage: session.metadata.coverage,
          temporal: session.metadata.temporal,
          displayName: session.metadata.displayName || session.displayName,
        };
        console.log('Reconstructed saved session:', fullSession);
      }
    }
    
    const existingTab = explorerTabs.find(t => t.id === fullSession.sessionId);
    if (existingTab) {
      switchMainTab(fullSession.sessionId);
      setSelectedSession(fullSession);
    } else {
      const label = fullSession.displayName || fullSession.metadata?.displayName || `${fullSession.location?.city || 'Unknown'}`;
      setExplorerTabs(prev => [...prev, { 
        id: fullSession.sessionId, 
        label, 
        session: fullSession,
        isDirty: session.isTemporary // Mark as dirty if temporary
      }]);
      switchMainTab(fullSession.sessionId);
      setSelectedSession(fullSession);
      toast.info('Session opened', label);
    }
  };

  const closeTab = async (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check if tab is dirty (unsaved)
    const tab = openTabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      const confirmed = window.confirm(`Do you want to save "${tab.label}" before closing?`);
      if (confirmed) {
        // Save before closing
        const prevActiveTab = activeMainTab;
        setActiveMainTab(tabId); // Temporarily set as active to save
        await saveActiveSession();
        setActiveMainTab(prevActiveTab);
      } else {
        // Delete temporary file from IndexedDB
        try {
          const { useMapFileStore } = await import('@/stores/mapFileStore');
          await useMapFileStore.getState().deleteMapFile(tabId);
          
          // Refresh sidebar to remove it
          if ((window as any).__refreshSessions) {
            (window as any).__refreshSessions();
          }
          
          toast.info('Discarded', `${tab.label} was not saved`);
        } catch (err) {
          console.error('Failed to delete temp file:', err);
        }
      }
    }
    
    const newTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs as any);
    if (activeMainTab === tabId) {
      const next = newTabs[newTabs.length - 1];
      if (next) { switchMainTab(next.id); if (next.session) setSelectedSession(next.session); }
      else { setActiveMainTab(null); setSelectedSession(null); }
    }
  };

  const consoleTabs = [
    { id: 'traces'  as ConsoleTab, label: 'Agent Traces', icon: <Radio        size={11} /> },
    { id: 'ledger'  as ConsoleTab, label: 'DePIN Ledger', icon: <Database      size={11} /> },
    { id: 'console' as ConsoleTab, label: 'Console',      icon: <TerminalIcon  size={11} /> },
  ];

  // ── Tab button style ──────────────────────
  const tabBtn = (active: boolean): React.CSSProperties => ({
    position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
    height: '100%', padding: '0 13px', minWidth: 100, flexShrink: 0,
    cursor: 'pointer', border: 'none',
    borderRight: 'none', // handled by .tab-sep CSS pseudo-element
    background: active ? 'var(--c-panel)' : 'transparent',
    color: active ? 'var(--c-text-2)' : 'var(--c-text-3)',
    fontSize: '0.72rem', fontWeight: active ? 500 : 400,
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    letterSpacing: '-0.01em',
    transition: 'background var(--dur-fast), color var(--dur-fast)',
    // active tab: rose top-inset glow + bottom flush with panel
    boxShadow: active
      ? 'inset 0 2px 0 var(--c-rose-2), inset 0 -1px 0 var(--c-panel), 0 0 18px rgba(154,106,170,0.10)'
      : 'none',
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
          {sidebarActivity !== 'network' && sidebarActivity !== 'maintenance' && (
          <div className="tab-bar" style={{
            display: 'flex', alignItems: 'stretch', height: 36, flexShrink: 0,
            overflowX: 'auto', overflowY: 'hidden',
          }}>
            {openTabs.map((tab) => {
              const active = activeMainTab === tab.id;
              const closeable = tab.id !== 'map' && tab.id !== 'sentinel';
              return (
                <button key={tab.id}
                  onClick={() => { switchMainTab(tab.id); if (tab.session) setSelectedSession(tab.session); else setSelectedSession(null); }}
                  className="tab-sep"
                  style={tabBtn(active)}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)'; }}
                  onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)'; } }}
                >
                  {tab.id === 'map'      && <span style={{ color: active ? 'var(--c-rose-2)' : 'var(--c-text-3)', display: 'flex' }}><MapPin size={11} /></span>}
                  {tab.id === 'sentinel' && <span style={{ color: active ? 'var(--c-rose-2)' : 'var(--c-text-3)', display: 'flex' }}><Video  size={11} /></span>}
                  {tab.isDirty && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--c-yellow)', flexShrink: 0, marginLeft: -2 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{tab.label}</span>
                  {closeable && (
                    <span onClick={(e) => closeTab(tab.id, e)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 15, height: 15, marginLeft: 1, color: 'var(--c-text-3)',
                      cursor: 'pointer', borderRadius: 3, flexShrink: 0,
                      transition: 'background var(--dur-fast), color var(--dur-fast)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover-md)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)'; }}
                    >
                      <X size={9} />
                    </span>
                  )}
                  {active && <span className="tab-line" />}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
          </div>
          )}

          {activeMainTab === 'map' && (
            <Breadcrumb path={
              selectedSession?.location
                ? ['World', selectedSession.location.country, selectedSession.location.state, selectedSession.location.city].filter(Boolean)
                : ['World', 'India', 'Odisha', 'Rourkela']
            } />
          )}

          {/* ── Main Content — crossfade ─── */}
          <div key={mainTabKey} className="panel-fade" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {sidebarActivity === 'maintenance' ? (
              <MaintenancePanel />
            ) : sidebarActivity === 'network' ? (
              <NetworkMapView />
            ) : !activeMainTab ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', flexDirection: 'column', gap: 12,
                background: 'var(--c-bg)',
                userSelect: 'none',
              }}>
                {/* Geometric icon mark — Kiro-style minimal */}
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'var(--c-sidebar)',
                  border: '1px solid var(--c-border-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}>
                  <MapPin size={20} style={{ color: 'var(--c-text-3)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '0.82rem', color: 'var(--c-text-2)',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 5,
                  }}>
                    {sidebarActivity === 'explorer' ? 'No session open' : 'Detection Node'}
                  </div>
                  <div style={{
                    fontSize: '0.70rem', color: 'var(--c-text-3)',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    lineHeight: 1.6,
                  }}>
                    {sidebarActivity === 'explorer'
                      ? 'Open a session from the file explorer'
                      : 'Select Detection from the activity bar'}
                  </div>
                </div>
                {/* Keyboard hint */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
                  padding: '5px 10px', borderRadius: 4,
                  background: 'var(--c-sidebar)', border: '1px solid var(--c-border)',
                }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--c-text-3)', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    Press
                  </span>
                  <kbd style={{
                    fontSize: '0.60rem', fontFamily: "'IBM Plex Mono', monospace",
                    color: 'var(--c-text-2)', background: 'var(--c-elevated)',
                    border: '1px solid var(--c-border-md)', borderRadius: 3,
                    padding: '1px 6px',
                  }}>⌘K</kbd>
                  <span style={{ fontSize: '0.65rem', color: 'var(--c-text-3)', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    to open command palette
                  </span>
                </div>
              </div>
            ) : openTabs.find(t => t.id === activeMainTab)?.diffMap ? (
              <DiffView diffMap={openTabs.find(t => t.id === activeMainTab)!.diffMap} />
            ) : openTabs.find(t => t.id === activeMainTab)?.isNewSession ? (
              <NewSessionView
                onRefreshSessions={() => { if ((window as any).__refreshSessions) (window as any).__refreshSessions(); }}
                onSessionCreated={async (session) => {
                  const newTabs = explorerTabs.map(t =>
                    t.id === activeMainTab
                      ? { id: session.sessionId, label: session.displayName, session, isDirty: true }
                      : t
                  );
                  setExplorerTabs(newTabs);
                  switchMainTab(session.sessionId);
                  setSelectedSession(session);
                  toast.success('Session created', `${session.displayName} (unsaved)`);
                  
                  // Trigger both refresh mechanisms
                  if ((window as any).__refreshSessions) (window as any).__refreshSessions();
                  
                  // Also refresh mapFileStore
                  const { useMapFileStore } = await import('@/stores/mapFileStore');
                  await useMapFileStore.getState().loadFiles();
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
                <div style={{ fontSize: '0.78rem', color: 'var(--c-text-2)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
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
                      fontSize: '0.68rem', color: '#fff', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
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
                  fontSize: '0.70rem', cursor: 'pointer', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                }}>
                  Close Split
                </button>
              </div>
            ) : selectedSession ? (
              <LiveMap key={selectedSession?.sessionId || 'default'} selectedSession={selectedSession} />
            ) : null}
          </div>

          {/* ── Console ──────────────────── */}
          {sidebarActivity !== 'network' && sidebarActivity !== 'maintenance' && (
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, height: consoleHeight, position: 'relative' }}>

            {/* Gradient top border + resize handle in one strip */}
            <div
              className="drag-handle-y"
              onMouseDown={onResizeDown}
              style={{
                height: 6, flexShrink: 0,
                background: 'var(--c-sidebar)',
                cursor: 'ns-resize',
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div className="drag-pip" style={{
                width: 28, height: 2, borderRadius: 2,
                background: 'var(--c-border-md)',
                transition: 'background var(--dur-fast), width var(--dur-fast)',
              }} />
            </div>

            {/* Console Tab Bar */}
            <div className="tab-bar" style={{
              display: 'flex', alignItems: 'stretch', height: 32, flexShrink: 0,
            }}>
              {consoleTabs.map((tab) => {
                const active = activeConsoleTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => switchConsoleTab(tab.id)}
                    className="tab-sep"
                    style={{
                      ...tabBtn(active),
                      fontSize: '0.60rem',
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      fontWeight: active ? 600 : 500,
                      gap: 5,
                      minWidth: 'auto',
                      padding: '0 12px',
                    }}
                    onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)'; }}}
                    onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)'; }}}
                  >
                    <span style={{ color: active ? 'var(--c-rose)' : 'var(--c-text-3)', display: 'flex' }}>{tab.icon}</span>
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
          )}
        </div>

        {sidebarActivity === 'explorer' && (
          <AgentChatPanel
            contextType="livemap"
            context={{ sessionId: selectedSession?.sessionId, city: selectedSession?.location?.city }}
          />
        )}

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
