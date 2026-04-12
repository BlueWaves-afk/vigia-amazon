'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, MapPin, Video, Terminal as TerminalIcon, Database, Radio, KeyRound, Sparkles } from 'lucide-react';
import { VideoUploader }        from './components/VideoUploader';
import { LiveMap }              from './components/LiveMap';
import { LedgerTicker }         from './components/LedgerTicker';
import { AgentTracesTab }      from './components/AgentTracesTab';
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
import { DetectionOnboarding } from './components/DetectionOnboarding';
import { ActivityOnboarding }  from './components/ActivityOnboarding';
import { NetworkMapView }       from './components/NetworkMapView';
import { MaintenancePanel }     from './components/MaintenancePanelIntegrated';
import { EnterpriseDashboard }  from './components/EnterpriseDashboard';
import { AgentChatPanel }       from './components/AgentChatPanel';
import { NetworkHealthPanel }   from './components/NetworkHealthPanel';
import { UrbanPlannerModal }    from './components/UrbanPlannerModal';
import { IntroPage, useIntroComplete } from './components/IntroPage';

type MainTab    = 'map' | 'sentinel' | string;
type ConsoleTab = 'traces' | 'ledger' | 'console' | 'network';

// Helper to generate diff analysis text
function generateDiffAnalysisText(diffMap: any) {
  if (!diffMap?.summary) return undefined;
  const { summary } = diffMap;
  
  let degradationLevel = 'MODERATE';
  if (summary.degradationScore > 70) degradationLevel = 'SEVERE';
  else if (summary.degradationScore > 50) degradationLevel = 'SIGNIFICANT';
  else if (summary.degradationScore > 30) degradationLevel = 'MODERATE';
  else degradationLevel = 'MINIMAL';
  
  const statusText = summary.netChange > 0 ? 'Infrastructure quality is declining and requires attention' : 'Infrastructure quality is stable or improving';
  const timeSpan = summary.timeSpanDays != null ? summary.timeSpanDays.toFixed(1) : 'N/A';
  const degradationScore = summary.degradationScore != null ? summary.degradationScore.toFixed(1) : 'N/A';
  
  return `**Diff Analysis** (Auto-generated from session comparison)

The road infrastructure has ${degradationLevel.toLowerCase()} changes over ${timeSpan} days. ${summary.totalNew || 0} new hazards detected, ${summary.totalFixed || 0} hazards fixed, and ${summary.totalWorsened || 0} hazards worsened. Net change: ${summary.netChange > 0 ? '+' : ''}${summary.netChange || 0} hazards.

Degradation Level: **${degradationLevel}** (Score: ${degradationScore}/100). ${statusText}.

**Recommendations:**
${summary.totalNew > 10 ? '• Immediate inspection required for newly identified hazards\n' : ''}${summary.totalWorsened > 5 ? '• Prioritize repair of worsening hazards to prevent further deterioration\n' : ''}${summary.degradationScore > 60 ? '• Allocate emergency maintenance budget for critical areas\n' : ''}${summary.totalFixed > 0 ? `• Continue maintenance efforts - ${summary.totalFixed} hazards successfully addressed\n` : ''}${summary.totalNew === 0 && summary.totalWorsened === 0 ? '• Continue regular monitoring\n• Schedule routine maintenance' : ''}`;
}

export default function Dashboard() {
  const { settings } = useSettings();
  const [introComplete, completeIntro] = useIntroComplete();
  const [activeMainTab,      setActiveMainTab]      = useState<MainTab | null>(null);
  const [explorerTabs,       setExplorerTabs]       = useState<Array<{id: string; label: string; session?: any; isNewSession?: boolean; isDirty?: boolean; diffMap?: any}>>([]);
  const [detectionTabs,      setDetectionTabs]      = useState<Array<{id: string; label: string; session?: any; isNewSession?: boolean; isDirty?: boolean; diffMap?: any}>>([]);
  const [explorerActiveTab,  setExplorerActiveTab]  = useState<MainTab | null>(null);
  const [detectionActiveTab, setDetectionActiveTab] = useState<MainTab | null>(null);
  const [activeConsoleTab,   setActiveConsoleTab]   = useState<ConsoleTab>('ledger');
  const [consoleHeight,      setConsoleHeight]      = useState(220);
  const [settingsOpen,       setSettingsOpen]       = useState(false);
  const [cmdOpen,            setCmdOpen]            = useState(false);
  const [selectedSession,    setSelectedSession]    = useState<any>(null);
  const [sidebarActivity,    setSidebarActivity]    = useState<'explorer' | 'detection' | 'network' | 'maintenance' | 'enterprise'>('explorer');
  const [showUrbanPlanner,   setShowUrbanPlanner]   = useState(false);
  const [splitView,          setSplitView]          = useState<{ left: any; right: any } | null>(null);
  const [detectionOnboarded, setDetectionOnboarded] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('vigia:detection:onboarded') === 'true'; } catch { return false; }
  });
  const [explorerOnboarded,  setExplorerOnboarded]  = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('vigia:explorer:onboarded') === 'true'; } catch { return false; }
  });
  const [enterpriseOnboarded, setEnterpriseOnboarded] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('vigia:enterprise:onboarded') === 'true'; } catch { return false; }
  });
  const [networkOnboarded,   setNetworkOnboarded]   = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('vigia:network:onboarded') === 'true'; } catch { return false; }
  });
  // Track which content tab is showing for crossfade key
  const [mainTabKey,         setMainTabKey]         = useState(0);
  const [consoleTabKey,      setConsoleTabKey]      = useState(0);

  // Persist tabs to sessionStorage (clears on browser close, persists on reload)
  const hasHydratedTabs = useRef(false);
  const TAB_STORAGE_KEY = 'vigia:tabs:v2';
  const DETECTION_ONBOARDING_KEY = 'vigia:detection:onboarded';
  const EXPLORER_ONBOARDING_KEY = 'vigia:explorer:onboarded';
  const ENTERPRISE_ONBOARDING_KEY = 'vigia:enterprise:onboarded';
  const NETWORK_ONBOARDING_KEY = 'vigia:network:onboarded';




  // Switch console to Agent Traces tab when "View Reasoning" is clicked
  useEffect(() => {
    const handler = () => setActiveConsoleTab('traces');
    window.addEventListener('open-agent-traces', handler);
    return () => window.removeEventListener('open-agent-traces', handler);
  }, []);

  type PersistedTab = {
    id: string;
    label: string;
    session?: any;
    diffMap?: any;
  };

  type PersistedTabsStateV2 = {
    version: 2;
    sidebarActivity: 'explorer' | 'detection' | 'network' | 'maintenance' | 'enterprise';
    explorerTabs: PersistedTab[];
    detectionTabs: PersistedTab[];
    activeMainTab: MainTab | null;
    explorerActiveTab?: MainTab | null;
    detectionActiveTab?: MainTab | null;
  };
  
  // Load tabs from sessionStorage on mount
  useEffect(() => {
    if (hasHydratedTabs.current) return;

    try {
      const savedRawV2 = sessionStorage.getItem(TAB_STORAGE_KEY);
      const savedRawLegacy = !savedRawV2 ? sessionStorage.getItem('vigia:tabs') : null;
      const savedRaw = savedRawV2 ?? savedRawLegacy;
      if (!savedRaw) return;

      const parsed = JSON.parse(savedRaw) as any;

      const data: Partial<PersistedTabsStateV2> = (parsed?.version === 2)
        ? parsed
        : {
            version: 2,
            sidebarActivity: parsed?.sidebarActivity,
            explorerTabs: parsed?.explorerTabs,
            detectionTabs: parsed?.detectionTabs,
            activeMainTab: parsed?.activeMainTab ?? null,
          };

      const safeTabs = (tabs: any): PersistedTab[] => {
        if (!Array.isArray(tabs)) return [];
        return tabs
          .filter((t) => t && typeof t.id === 'string' && typeof t.label === 'string')
          .map((t) => ({
            id: t.id,
            label: t.label,
            session: t.session,
            diffMap: t.diffMap,
          }));
      };

      const restoredExplorerTabs = safeTabs(data.explorerTabs);
      const restoredDetectionTabs = safeTabs(data.detectionTabs);

      const restoredActivity = (data.sidebarActivity === 'explorer' || data.sidebarActivity === 'detection' || data.sidebarActivity === 'network' || data.sidebarActivity === 'maintenance' || data.sidebarActivity === 'enterprise')
        ? data.sidebarActivity
        : 'explorer';

      // Resolve active tab to something that actually exists.
      let resolvedActiveMainTab: MainTab | null = data.activeMainTab ?? null;
      if (restoredActivity === 'explorer') {
        if (resolvedActiveMainTab && !restoredExplorerTabs.some(t => t.id === resolvedActiveMainTab)) {
          resolvedActiveMainTab = restoredExplorerTabs.length ? restoredExplorerTabs[restoredExplorerTabs.length - 1].id : null;
        }
      } else if (restoredActivity === 'detection') {
        if (resolvedActiveMainTab && !restoredDetectionTabs.some(t => t.id === resolvedActiveMainTab)) {
          resolvedActiveMainTab = restoredDetectionTabs.length ? restoredDetectionTabs[restoredDetectionTabs.length - 1].id : 'sentinel';
        }
      } else {
        resolvedActiveMainTab = null;
      }

      setSidebarActivity(restoredActivity);
      setExplorerTabs(restoredExplorerTabs as any);
      setDetectionTabs(restoredDetectionTabs as any);
      setExplorerActiveTab((data.explorerActiveTab ?? null) as any);
      setDetectionActiveTab((data.detectionActiveTab ?? null) as any);
      setActiveMainTab(resolvedActiveMainTab);

      // Rehydrate selected session from the active tab (keeps map content on refresh).
      if (restoredActivity === 'explorer' && resolvedActiveMainTab) {
        const tab = restoredExplorerTabs.find(t => t.id === resolvedActiveMainTab);
        setSelectedSession(tab?.session ?? null);
      } else {
        setSelectedSession(null);
      }

      // If we loaded legacy state, immediately migrate it to v2 so subsequent loads are consistent.
      if (!savedRawV2) {
        try {
          const payload: PersistedTabsStateV2 = {
            version: 2,
            explorerTabs: restoredExplorerTabs,
            detectionTabs: restoredDetectionTabs,
            activeMainTab: resolvedActiveMainTab,
            sidebarActivity: restoredActivity,
            explorerActiveTab: (data.explorerActiveTab ?? null) as any,
            detectionActiveTab: (data.detectionActiveTab ?? null) as any,
          };
          sessionStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(payload));
        } catch {
          // Best-effort migration only
        }
      }
    } catch {
      // Best-effort restore only
    } finally {
      // Mark hydration complete only AFTER attempting restore, so we don't overwrite stored tabs
      // with the initial empty state during the first mount.
      hasHydratedTabs.current = true;
    }
  }, []);

  // Save tabs to sessionStorage whenever they change
  useEffect(() => {
    if (!hasHydratedTabs.current) return;
    try {
      const isPersistableTab = (t: any) => {
        // Persist across reloads, but NOT unsaved/draft tabs.
        if (!t) return false;
        if (t.isDirty) return false;
        if (t.isNewSession) return false;
        return typeof t.id === 'string' && typeof t.label === 'string';
      };

      const toPersistedTab = (t: any): PersistedTab => ({
        id: t.id,
        label: t.label,
        session: t.session,
        diffMap: t.diffMap,
      });

      const persistedExplorerTabs = explorerTabs.filter(isPersistableTab).map(toPersistedTab);
      const persistedDetectionTabs = detectionTabs.filter(isPersistableTab).map(toPersistedTab);

      const activeIsPersisted = (
        sidebarActivity === 'explorer'
          ? persistedExplorerTabs.some(t => t.id === activeMainTab)
          : sidebarActivity === 'detection'
            ? persistedDetectionTabs.some(t => t.id === activeMainTab)
            : false
      );

      const payload: PersistedTabsStateV2 = {
        version: 2,
        explorerTabs: persistedExplorerTabs,
        detectionTabs: persistedDetectionTabs,
        activeMainTab: activeIsPersisted ? activeMainTab : null,
        sidebarActivity,
        explorerActiveTab,
        detectionActiveTab,
      };

      sessionStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      // Best-effort save only
    }
  }, [explorerTabs, detectionTabs, activeMainTab, sidebarActivity, explorerActiveTab, detectionActiveTab]);

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

      const payload = (event as any)?.detail;
      const hazards = Array.isArray(payload?.hazards) ? payload.hazards : null;
      const single = payload?.hazard;

      if (hazards && hazards.length) {
        (window as any).__maintenanceHazards = hazards;
        try {
          sessionStorage.setItem('vigia:maintenance:queuedHazards', JSON.stringify({ version: 1, hazards }));
        } catch {
          // best-effort
        }

        const setter = (window as any).__setMaintenanceHazard;
        if (typeof setter === 'function') setter(hazards[0]);
        return;
      }

      if (single) {
        (window as any).__maintenanceHazard = single;
        try {
          sessionStorage.setItem('vigia:maintenance:queuedHazards', JSON.stringify({ version: 1, hazards: [single] }));
        } catch {
          // best-effort
        }

        const setter = (window as any).__setMaintenanceHazard;
        if (typeof setter === 'function') setter(single);
      }
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
    const handleHazardSession = async (event: CustomEvent) => {
      const { lat, lon, hazardId } = event.detail;
      const geohash = hazardId.split('#')[0];
      
      // Fetch hazards for this geohash
      let hazardsData = [];
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_TELEMETRY_API_URL}/hazards?geohash=${geohash}`);
        if (response.ok) {
          const data = await response.json();
          hazardsData = data.hazards || [];
        }
      } catch (error) {
        console.error('Failed to fetch hazards:', error);
      }
      
      // Create a new session for this hazard
      const newSession = {
        sessionId: hazardId,
        geohash7: geohash,
        timestamp: new Date().toISOString(),
        location: { city: 'Hazard Location' },
        coverage: {
          centerPoint: { lat, lon },
          radiusKm: 1
        },
        hazards: hazardsData
      };
      
      // Add new tab
      const tabId = `hazard-${Date.now()}`;
      setExplorerTabs(prev => [...prev, {
        id: tabId,
        label: `Hazard ${geohash.substring(0, 8)}`,
        session: newSession
      }]);
      
      // Switch to explorer activity and select the new tab
      setSidebarActivity('explorer');
      switchMainTab(tabId);
      
      toast.success('Hazard Location', `Loaded ${hazardsData.length} hazards`);
    };
    
    window.addEventListener('vigia-report-maintenance', handleMaintenanceReport as EventListener);
    window.addEventListener('vigia-split-view', handleSplitView as EventListener);
    window.addEventListener('vigia-diff-created', handleDiffCreated as EventListener);
    window.addEventListener('create-hazard-session', handleHazardSession as unknown as EventListener);
    return () => {
      window.removeEventListener('vigia-report-maintenance', handleMaintenanceReport as EventListener);
      window.removeEventListener('vigia-split-view', handleSplitView as EventListener);
      window.removeEventListener('vigia-diff-created', handleDiffCreated as EventListener);
      window.removeEventListener('create-hazard-session', handleHazardSession as unknown as EventListener);
    };
  }, []);

  const openTabs   = sidebarActivity === 'explorer' ? explorerTabs : sidebarActivity === 'detection' ? detectionTabs : [];
  const setOpenTabs = sidebarActivity === 'explorer' ? setExplorerTabs : sidebarActivity === 'detection' ? setDetectionTabs : () => {};
  const isDetectionOnboardingActive = sidebarActivity === 'detection' && activeMainTab === 'detection-onboarding';
  const isExplorerOnboardingActive = sidebarActivity === 'explorer' && activeMainTab === 'explorer-onboarding';
  const isOnboardingActive = isDetectionOnboardingActive || isExplorerOnboardingActive;

  // ── Save active session to VFSManager ────
  const saveActiveSession = async () => {
    const activeTab = openTabs.find(t => t.id === activeMainTab);
    
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
    
    if (!activeTab?.session) return;

    try {
      // Get VFSManager instance from Sidebar
      const vfsManager = (window as any).__vfsManager;
      
      if (!vfsManager) {
        toast.error('Save failed', 'VFS Manager not initialized');
        return;
      }

      const session = activeTab.session;
      const sessionId = `${session.coverage.centerPoint.geohash}#${new Date(session.temporal.createdAt).toISOString()}`;

      // Save to localStorage (moves from sessionStorage)
      await vfsManager.saveSession(sessionId);

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
  const forceSwitchMainTab = useCallback((id: MainTab) => {
    setActiveMainTab(id);
    setMainTabKey(k => k + 1);
  }, []);

  const switchMainTab = useCallback((id: MainTab) => {
    if (id === 'sentinel' && !detectionOnboarded) {
      setActiveMainTab('detection-onboarding');
      setMainTabKey(k => k + 1);
      return;
    }
    if (sidebarActivity === 'explorer' && !explorerOnboarded && id !== 'explorer-onboarding') {
      setActiveMainTab('explorer-onboarding');
      setMainTabKey(k => k + 1);
      return;
    }
    forceSwitchMainTab(id);
  }, [detectionOnboarded, explorerOnboarded, forceSwitchMainTab, sidebarActivity]);

  useEffect(() => {
    if (!detectionOnboarded) {
      setDetectionTabs(prev => {
        const withoutSentinel = prev.filter(t => t.id !== 'sentinel');
        if (withoutSentinel.some(t => t.id === 'detection-onboarding')) return withoutSentinel;
        return [...withoutSentinel, { id: 'detection-onboarding', label: 'Onboarding' }];
      });
      if (sidebarActivity === 'detection') {
        switchMainTab('detection-onboarding');
      }
    } else {
      setDetectionTabs(prev => {
        const next = prev.filter(t => t.id !== 'detection-onboarding');
        if (next.some(t => t.id === 'sentinel')) return next;
        return [...next, { id: 'sentinel', label: 'Detection Node' }];
      });
    }
  }, [detectionOnboarded, sidebarActivity, switchMainTab]);

  useEffect(() => {
    if (!explorerOnboarded) {
      setExplorerTabs(prev => {
        if (prev.some(t => t.id === 'explorer-onboarding')) return prev;
        return [...prev, { id: 'explorer-onboarding', label: 'Onboarding' }];
      });
      if (sidebarActivity === 'explorer') {
        switchMainTab('explorer-onboarding');
      }
    } else {
      setExplorerTabs(prev => prev.filter(t => t.id !== 'explorer-onboarding'));
    }
  }, [explorerOnboarded, sidebarActivity, switchMainTab]);

  const switchConsoleTab = useCallback((id: ConsoleTab) => {
    setActiveConsoleTab(id);
    setConsoleTabKey(k => k + 1);
  }, []);

  const handleActivityChange = useCallback((activity: 'explorer' | 'detection' | 'network' | 'maintenance' | 'enterprise') => {
    if (sidebarActivity === 'explorer') setExplorerActiveTab(activeMainTab);
    else setDetectionActiveTab(activeMainTab);

    setSidebarActivity(activity);

    if (activity === 'detection') {
      if (!detectionOnboarded) {
        if (!detectionTabs.find(t => t.id === 'detection-onboarding')) {
          setDetectionTabs(prev => [...prev.filter(t => t.id !== 'sentinel'), { id: 'detection-onboarding', label: 'Onboarding' }]);
        }
        switchMainTab('detection-onboarding');
      } else {
        if (!detectionTabs.find(t => t.id === 'sentinel'))
          setDetectionTabs(prev => [...prev, { id: 'sentinel', label: 'Detection Node' }]);
        switchMainTab('sentinel');
      }
      setSelectedSession(null);
      return;
    }

    if (activity === 'network' || activity === 'maintenance') {
      setActiveMainTab(null);
      setSelectedSession(null);
      return;
    }

    const tabs = explorerTabs;
    const saved = explorerActiveTab;

    if (saved && tabs.find(t => t.id === saved)) {
      switchMainTab(saved);
      const tab = tabs.find(t => t.id === saved);
      if (tab?.session) setSelectedSession(tab.session);
    } else if (tabs.length > 0) {
      switchMainTab(tabs[tabs.length - 1].id as MainTab);
      if (tabs[tabs.length - 1].session) setSelectedSession(tabs[tabs.length - 1].session);
    } else {
      setActiveMainTab(null);
      setSelectedSession(null);
    }
  }, [
    activeMainTab,
    detectionTabs,
    explorerActiveTab,
    explorerTabs,
    sidebarActivity,
    switchMainTab,
  ]);

  const createNewSessionTab = useCallback(() => {
    if (sidebarActivity !== 'explorer') handleActivityChange('explorer');
    const id = 'new-session-' + Date.now();
    setExplorerTabs(prev => [...prev, { id, label: 'New Session', isNewSession: true }]);
    switchMainTab(id);
    setSelectedSession(null);
  }, [handleActivityChange, sidebarActivity, switchMainTab]);

  // ── Session handling ──────────────────────
  const handleSessionClick = async (session: any) => {
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

  // ── Main tab button style ─────────────────
  const tabBtn = (active: boolean): React.CSSProperties => ({
    position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
    height: '100%', padding: '0 14px', minWidth: 100, flexShrink: 0,
    cursor: 'pointer', border: 'none', outline: 'none',
    background: active ? 'var(--v-panel-bg)' : 'transparent',
    color: active ? 'var(--v-text-primary)' : 'var(--v-text-muted)',
    fontSize: '0.72rem', fontWeight: active ? 500 : 400,
    fontFamily: 'var(--v-font-ui)',
    letterSpacing: '-0.01em',
    transition: 'background 120ms ease, color 120ms ease',
  });

  // ── Detection tab button style (match network group) ─────────────
  const detectionTabBtn = (active: boolean): React.CSSProperties => ({
    position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
    height: '100%', padding: '0 14px', flexShrink: 0,
    cursor: 'pointer', border: 'none', outline: 'none',
    background: 'transparent',
    borderBottom: active ? '2px solid var(--c-accent-2)' : '2px solid transparent',
    color: active ? 'var(--c-accent-2)' : 'var(--c-text-3)',
    fontSize: '0.62rem', fontWeight: active ? 700 : 400,
    fontFamily: 'var(--v-font-mono)',
    letterSpacing: '0.05em', textTransform: 'uppercase',
    transition: 'color 120ms ease, border-color 120ms ease',
  });

  // ── Console tab button style ──────────────
  const consoleTabBtn = (active: boolean): React.CSSProperties => ({
    position: 'relative', display: 'flex', alignItems: 'center', gap: 5,
    height: '100%', padding: '0 12px', flexShrink: 0,
    cursor: 'pointer', border: 'none', outline: 'none',
    background: 'transparent',
    color: active ? 'var(--v-text-primary)' : 'var(--v-text-muted)',
    fontSize: '0.60rem', fontWeight: active ? 600 : 500,
    fontFamily: 'var(--v-font-ui)',
    letterSpacing: '0.07em', textTransform: 'uppercase',
    transition: 'color 120ms ease',
  });

  const explorerPanelStyle: React.CSSProperties = {
    flex: 1,
    height: '100%',
    margin: 8,
    background: 'var(--v-hover)',
    border: '1px solid var(--v-border-default)',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  };

  const wrapExplorerPanel = (child: React.ReactNode) => (
    sidebarActivity === 'explorer'
      ? <div style={explorerPanelStyle}>{child}</div>
      : child
  );

  /* ── Intro gate ───────────────────────────── */
  if (!introComplete) {
    return <IntroPage onComplete={completeIntro} />;
  }

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
        onNewSession={createNewSessionTab}
        onSaveSession={saveActiveSession}
        onActivityChange={handleActivityChange}
        onConsoleTab={(tab) => switchConsoleTab(tab as any)}
        onDropPinA={() => {
          if (typeof window !== 'undefined') {
            (window as any).__dropPinMode = 'A';
            (window as any).__setDropPinMode?.('A');
          }
        }}
        onDropPinB={() => {
          if (typeof window !== 'undefined') {
            (window as any).__dropPinMode = 'B';
            (window as any).__setDropPinMode?.('B');
          }
        }}
        onCalculateRoute={() => {
          if (typeof window !== 'undefined') {
            (window as any).__calculatePinRoute?.();
          }
        }}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        <Sidebar
          activity={sidebarActivity}
          hideExplorerPanel={isExplorerOnboardingActive}
          onSentinelEyeClick={() => {
            if (!detectionOnboarded) {
              if (!detectionTabs.find(t => t.id === 'detection-onboarding'))
                setDetectionTabs(prev => [...prev.filter(t => t.id !== 'sentinel'), { id: 'detection-onboarding', label: 'Onboarding' }]);
              switchMainTab('detection-onboarding');
            } else {
              if (!detectionTabs.find(t => t.id === 'sentinel'))
                setDetectionTabs(prev => [...prev, { id: 'sentinel', label: 'Detection Node' }]);
              switchMainTab('sentinel');
            }
          }}
          isSentinelEyeActive={activeMainTab === 'sentinel'}
          onSettingsOpen={() => setSettingsOpen(true)}
          onSessionClick={handleSessionClick}
          onActivityChange={(activity) => {
            handleActivityChange(activity);
          }}
          onNewSessionClick={createNewSessionTab}
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

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          minWidth: 0,
          background: (sidebarActivity === 'detection' || sidebarActivity === 'explorer') ? '#fff' : 'transparent',
        }}>

          {/* ── Main Tab Bar ─────────────── */}
          {sidebarActivity !== 'network' && sidebarActivity !== 'maintenance' && sidebarActivity !== 'enterprise' && (
          <div className={(sidebarActivity === 'detection' || sidebarActivity === 'explorer') ? undefined : 'tab-bar'} style={{
            display: 'flex', alignItems: 'stretch', height: 38, flexShrink: 0,
            overflowX: 'auto', overflowY: 'hidden',
            ...((sidebarActivity === 'detection' || sidebarActivity === 'explorer') ? {
              background: 'var(--v-hover)',
              border: '1px solid var(--v-border-default)',
              borderRadius: 8,
              margin: '8px 8px 0',
              padding: '0 16px',
            } : {}),
          }}>
            {openTabs.length === 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                fontStyle: 'italic',
                color: 'var(--c-text-3)',
                fontSize: '0.8rem',
              }}>
                no tab open
              </div>
            ) : openTabs.map((tab) => {
              const active = activeMainTab === tab.id;
              const closeable = tab.id !== 'map' && tab.id !== 'sentinel' && tab.id !== 'detection-onboarding' && tab.id !== 'explorer-onboarding' && !isOnboardingActive;
              return (
                <button key={tab.id}
                  onClick={() => {
                    if (isOnboardingActive && tab.id !== activeMainTab) return;
                    switchMainTab(tab.id);
                    if (tab.session) setSelectedSession(tab.session); else setSelectedSession(null);
                  }}
                  title={isOnboardingActive && tab.id !== activeMainTab ? 'Complete onboarding to unlock other tabs' : undefined}
                  className={(sidebarActivity === 'detection' || sidebarActivity === 'explorer') ? undefined : 'tab-sep'}
                  style={(sidebarActivity === 'detection' || sidebarActivity === 'explorer') ? detectionTabBtn(active) : tabBtn(active)}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = (sidebarActivity === 'detection' || sidebarActivity === 'explorer') ? 'transparent' : 'var(--v-hover)';
                      (e.currentTarget as HTMLElement).style.color = (sidebarActivity === 'detection' || sidebarActivity === 'explorer') ? 'var(--c-accent-2)' : 'var(--v-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = (sidebarActivity === 'detection' || sidebarActivity === 'explorer') ? 'var(--c-text-3)' : 'var(--v-text-muted)';
                    }
                  }}
                >
                  {tab.id === 'map'      && <span style={{ color: active ? 'var(--v-accent)' : 'var(--v-text-muted)', display: 'flex' }}><MapPin size={11} /></span>}
                  {tab.id === 'sentinel' && <span style={{ color: active ? 'var(--v-accent)' : 'var(--v-text-muted)', display: 'flex' }}><Video  size={11} /></span>}
                  {tab.id === 'detection-onboarding' && <span style={{ color: active ? 'var(--v-accent)' : 'var(--v-text-muted)', display: 'flex' }}><KeyRound size={11} /></span>}
                  {tab.id === 'explorer-onboarding' && <span style={{ color: active ? 'var(--v-accent)' : 'var(--v-text-muted)', display: 'flex' }}><Sparkles size={11} /></span>}
                  {tab.isDirty && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--v-warning)', flexShrink: 0, marginLeft: -2 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{tab.label}</span>
                  {closeable && (
                    <span onClick={(e) => closeTab(tab.id, e)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 15, height: 15, marginLeft: 1, color: 'var(--v-text-muted)',
                      cursor: 'pointer', borderRadius: 3, flexShrink: 0,
                      transition: 'background 120ms ease, color 120ms ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--v-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--v-text-primary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--v-text-muted)'; }}
                    >
                      <X size={9} />
                    </span>
                  )}
                  {active && sidebarActivity !== 'detection' && sidebarActivity !== 'explorer' && <span className="tab-line" />}
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
            ) : sidebarActivity === 'enterprise' && !enterpriseOnboarded ? (
              <ActivityOnboarding
                badge="Enterprise Operations"
                title="Enterprise Command Suite"
                subtitle="Portfolio-level oversight, anomaly detection, and stakeholder reporting."
                slides={[
                  {
                    id: 'executive',
                    title: 'Executive Briefings',
                    subtitle: 'Auto-generated summaries tuned for leadership review.',
                    gif: '/intro/screenshot-ledger.png',
                    bullets: ['Risk posture snapshots', 'Capital allocation signals', 'Regulatory audit context'],
                  },
                  {
                    id: 'ops',
                    title: 'Ops Health Dashboards',
                    subtitle: 'Live metrics for detection throughput and verification.',
                    gif: '/intro/screenshot-network.png',
                    bullets: ['Throughput by region', 'Latency and SLA tracking', 'Reward issuance health'],
                  },
                  {
                    id: 'insights',
                    title: 'Strategic Insights',
                    subtitle: 'Identify systemic issues before they escalate.',
                    gif: '/intro/screenshot-explorer.png',
                    bullets: ['Hotspot clustering', 'Maintenance backlog trends', 'Budget impact modeling'],
                  },
                ]}
                highlights={[
                  { title: 'Executive-ready outputs', detail: 'Exportable narratives and KPI summaries for stakeholder decks.' },
                  { title: 'Policy compliance', detail: 'Audit trails and SLA visibility embedded in every view.' },
                  { title: 'Fleet-wide visibility', detail: 'Aggregate detection activity across regions and vendors.' },
                ]}
                ctaLabel="Enter Enterprise"
                onComplete={() => {
                  localStorage.setItem(ENTERPRISE_ONBOARDING_KEY, 'true');
                  setEnterpriseOnboarded(true);
                }}
              />
            ) : sidebarActivity === 'enterprise' ? (
              <EnterpriseDashboard />
            ) : sidebarActivity === 'network' ? (
              networkOnboarded ? (
                <NetworkMapView />
              ) : (
                <ActivityOnboarding
                  badge="Geo Explorer"
                  title="Network Coverage Intelligence"
                  subtitle="Visualize fleet density, coverage gaps, and live hazard signals."
                  slides={[
                    {
                      id: 'coverage',
                      title: 'Coverage Heatmaps',
                      subtitle: 'Identify blind spots and over-saturated routes.',
                      gif: '/intro/screenshot-network.png',
                      bullets: ['Coverage by geohash', 'Signal drop-off alerts', 'Route completeness'],
                    },
                    {
                      id: 'routing',
                      title: 'Routing Intelligence',
                      subtitle: 'Pin routing for maintenance teams and planners.',
                      gif: '/intro/screenshot-network.png',
                      bullets: ['Priority path planning', 'Live incident context', 'Coordinated dispatch'],
                    },
                    {
                      id: 'verification',
                      title: 'Verification Lens',
                      subtitle: 'See verification status at a glance.',
                      gif: '/intro/screenshot-detection.png',
                      bullets: ['Pending queues', 'Verified vs rejected', 'Fraud signal overlays'],
                    },
                  ]}
                  highlights={[
                    { title: 'Geo-aware dashboards', detail: 'Layered intelligence across coverage, hazards, and maintenance.' },
                    { title: 'Rapid triage', detail: 'Pinpoint hotspots before field teams are deployed.' },
                    { title: 'Operational alignment', detail: 'Shareable views for planners and partners.' },
                  ]}
                  ctaLabel="Enter Geo Explorer"
                  onComplete={() => {
                    localStorage.setItem(NETWORK_ONBOARDING_KEY, 'true');
                    setNetworkOnboarded(true);
                  }}
                />
              )
            ) : !activeMainTab ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', flexDirection: 'column', gap: 12,
                background: 'white',
                userSelect: 'none',
              }}>
                {/* Geometric icon mark — Kiro-style minimal */}
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'var(--c-sidebar)',
                  border: '1px solid var(--c-border-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'none',
                }}>
                  <img src="/logo.svg" alt="VIGIA" style={{ width: 22, height: 22, opacity: 0.8 }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '0.82rem', color: 'var(--c-text-2)',
                    fontFamily: 'var(--v-font-ui)',
                    fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 5,
                  }}>
                    {sidebarActivity === 'explorer' ? 'No session open' : 'Detection Node'}
                  </div>
                  <div style={{
                    fontSize: '0.70rem', color: 'var(--c-text-3)',
                    fontFamily: 'var(--v-font-ui)',
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
                  <span style={{ fontSize: '0.65rem', color: 'var(--c-text-3)', fontFamily: 'var(--v-font-ui)' }}>
                    Press
                  </span>
                  <kbd style={{
                    fontSize: '0.60rem', fontFamily: 'var(--v-font-mono)',
                    color: 'var(--c-text-2)', background: 'var(--c-elevated)',
                    border: '1px solid var(--c-border-md)', borderRadius: 3,
                    padding: '1px 6px',
                  }}>⌘K</kbd>
                  <span style={{ fontSize: '0.65rem', color: 'var(--c-text-3)', fontFamily: 'var(--v-font-ui)' }}>
                    to open command palette
                  </span>
                </div>
              </div>
            ) : openTabs.find(t => t.id === activeMainTab)?.diffMap ? (
              wrapExplorerPanel(
                <DiffView diffMap={openTabs.find(t => t.id === activeMainTab)!.diffMap} />
              )
            ) : openTabs.find(t => t.id === activeMainTab)?.isNewSession ? (
              wrapExplorerPanel(
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
              )
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
                <div style={{ fontSize: '0.78rem', color: 'var(--c-text-2)', fontFamily: 'var(--v-font-ui)' }}>
                  Creating session at {selectedSession.location?.name}...
                </div>
              </div>
            ) : activeMainTab === 'detection-onboarding' ? (
              <DetectionOnboarding
                onComplete={() => {
                  localStorage.setItem(DETECTION_ONBOARDING_KEY, 'true');
                  setDetectionOnboarded(true);
                  setDetectionTabs(prev => {
                    const next = prev.filter(t => t.id !== 'detection-onboarding');
                    if (next.some(t => t.id === 'sentinel')) return next;
                    return [...next, { id: 'sentinel', label: 'Detection Node' }];
                  });
                  forceSwitchMainTab('sentinel');
                }}
              />
            ) : activeMainTab === 'explorer-onboarding' ? (
              <ActivityOnboarding
                badge="Geo Explorer"
                title="Geo Explorer Workspace"
                subtitle="Curate sessions, compare timelines, and surface infrastructure insights."
                slides={[
                  {
                    id: 'sessions',
                    title: 'Session Intelligence',
                    subtitle: 'Open, annotate, and compare recorded hazard sessions.',
                    gif: '/intro/screenshot-explorer.png',
                    bullets: ['Structured session folders', 'Change detection over time', 'Collaborative context notes'],
                  },
                  {
                    id: 'diff',
                    title: 'Diff Analytics',
                    subtitle: 'Quantify infrastructure change between time windows.',
                    gif: '/intro/screenshot-detection.png',
                    bullets: ['New vs fixed hazards', 'Degradation scoring', 'Auto-generated recommendations'],
                  },
                  {
                    id: 'insight',
                    title: 'Insight Narratives',
                    subtitle: 'Generate briefs for planners and stakeholders.',
                    gif: '/intro/screenshot-ledger.png',
                    bullets: ['Evidence-backed summaries', 'Exportable briefs', 'Audit-ready traceability'],
                  },
                ]}
                highlights={[
                  { title: 'Spatial context', detail: 'Navigate sessions by city, region, and coverage geometry.' },
                  { title: 'Decision support', detail: 'Diffs and analytics tailored for maintenance planning.' },
                  { title: 'Audit trail', detail: 'Structured notes and traceability baked into every session.' },
                ]}
                ctaLabel="Enter Geo Explorer"
                onComplete={() => {
                  localStorage.setItem(EXPLORER_ONBOARDING_KEY, 'true');
                  setExplorerOnboarded(true);
                  setExplorerTabs(prev => prev.filter(t => t.id !== 'explorer-onboarding'));
                  forceSwitchMainTab('map');
                }}
              />
            ) : activeMainTab === 'sentinel' ? (
              <DetectionModeView />
            ) : splitView ? (
              <div style={{
                display: 'flex',
                height: '100%',
                gap: sidebarActivity === 'explorer' ? 8 : 1,
                background: sidebarActivity === 'explorer' ? '#fff' : 'var(--c-border)',
                padding: sidebarActivity === 'explorer' ? 8 : 0,
              }}>
                {[splitView.left, splitView.right].map((s, i) => (
                  <div key={i} style={{
                    flex: 1,
                    overflow: 'hidden',
                    position: 'relative',
                    ...(sidebarActivity === 'explorer' ? {
                      background: 'var(--v-hover)',
                      border: '1px solid var(--v-border-default)',
                      borderRadius: 8,
                    } : {}),
                  }}>
                    <div style={{
                      position: 'absolute', top: 8, left: 8, zIndex: 10,
                      background: 'var(--c-overlay)', padding: '4px 8px', borderRadius: 3,
                      fontSize: '0.68rem', color: 'var(--c-text)', fontFamily: 'var(--v-font-ui)',
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
                  fontSize: '0.70rem', cursor: 'pointer', fontFamily: 'var(--v-font-ui)',
                }}>
                  Close Split
                </button>
              </div>
            ) : selectedSession ? (
              wrapExplorerPanel(
                <LiveMap key={selectedSession?.sessionId || 'default'} selectedSession={selectedSession} />
              )
            ) : null}
          </div>

          {/* ── Console ──────────────────── */}
          {sidebarActivity !== 'network' && sidebarActivity !== 'maintenance' && sidebarActivity !== 'enterprise' && activeMainTab !== 'detection-onboarding' && activeMainTab !== 'explorer-onboarding' && (
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, height: consoleHeight, position: 'relative' }}>

            {/* Resize handle — 4px strip, hover → indigo */}
            <div
              className="console-resize-handle"
              onMouseDown={onResizeDown}
            />

            {/* Console Tab Bar */}
            <div className="console-tab-bar" style={{
              display: 'flex', alignItems: 'stretch', height: 36,
            }}>
              {consoleTabs.map((tab) => {
                const active = activeConsoleTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => switchConsoleTab(tab.id)}
                    className="tab-sep"
                    style={consoleTabBtn(active)}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--v-text-secondary)'; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--v-text-muted)'; }}
                  >
                    <span style={{ color: active ? 'var(--v-accent)' : 'var(--v-text-muted)', display: 'flex' }}>{tab.icon}</span>
                    {tab.label}
                    {active && <span className="tab-line" />}
                  </button>
                );
              })}
              <div style={{ flex: 1 }} />
            </div>

            {/* Console content — crossfade + scanline texture */}
            <div key={consoleTabKey} className="panel-fade console-content" style={{ flex: 1, padding: '10px 14px' }}>
              {activeConsoleTab === 'traces'  && <AgentTracesTab />}
              {activeConsoleTab === 'ledger'  && <LedgerTicker />}
              {activeConsoleTab === 'console' && <ConsoleViewer />}
            </div>
          </div>
          )}
        </div>

        {sidebarActivity === 'explorer' && !isExplorerOnboardingActive && (
          <AgentChatPanel
            contextType="livemap"
            context={{ 
              sessionId: selectedSession?.sessionId, 
              city: selectedSession?.location?.city,
              diffAnalysis: (() => {
                const activeTab = explorerTabs.find(t => t.id === activeMainTab);
                const analysis = activeTab?.diffMap ? 
                  generateDiffAnalysisText(activeTab.diffMap) : undefined;
                return analysis;
              })(),
              currentDiff: (() => {
                const activeTab = explorerTabs.find(t => t.id === activeMainTab);
                if (!activeTab?.diffMap) return undefined;
                const dm = activeTab.diffMap;
                return {
                  displayName: dm.displayName,
                  sessionA: { id: dm.sessionA.sessionId, city: dm.sessionA.location?.city, timestamp: dm.sessionA.timestamp },
                  sessionB: { id: dm.sessionB.sessionId, city: dm.sessionB.location?.city, timestamp: dm.sessionB.timestamp },
                  summary: dm.summary,
                  changes: {
                    newCount: dm.changes.new?.length || 0,
                    fixedCount: dm.changes.fixed?.length || 0,
                    worsenedCount: dm.changes.worsened?.length || 0,
                    unchangedCount: dm.changes.unchanged?.length || 0,
                  }
                };
              })()
            }}
            availableSessions={explorerTabs.map(tab => ({
              sessionId: tab.session?.sessionId || tab.id,
              label: tab.label,
              geohash: tab.session?.geohash
            }))}
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
