'use client';

import { PaneState, PaneId } from '@/types';
import { TabBar } from './TabBar';
import { MapPane } from './MapPane';
import { X } from 'lucide-react';

interface SplitViewProps {
  leftPane: PaneState;
  rightPane: PaneState | null;
  isSplit: boolean;
  onTabClick: (tabId: string, paneId: PaneId) => void;
  onTabClose: (tabId: string, paneId: PaneId) => void;
  onSplitRight: (tabId: string) => void;
  onCloseSplit: () => void;
  onRouteUpdate: (
    paneId: PaneId,
    tabId: string,
    partial: Partial<import('@/types').RouteState>
  ) => void;
}

// ─────────────────────────────────────────────
// Split Divider
// ─────────────────────────────────────────────

function SplitDivider() {
  return (
    <div
      className="w-px flex-shrink-0 relative transition-all"
      style={{ background: 'rgba(255,255,255,0.10)', cursor: 'col-resize', transition: 'background var(--transition-fast)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.18)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
    >
      <div
        className="absolute inset-y-0 -left-1 -right-1"
        style={{ cursor: 'col-resize' }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Pane Container
// ─────────────────────────────────────────────

interface PaneContainerProps {
  pane: PaneState;
  paneId: PaneId;
  showCloseButton?: boolean;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onSplitRight: (tabId: string) => void;
  onCloseSplit?: () => void;
  onRouteUpdate: (
    paneId: PaneId,
    tabId: string,
    partial: Partial<import('@/types').RouteState>
  ) => void;
}

function PaneContainer({
  pane,
  paneId,
  showCloseButton,
  onTabClick,
  onTabClose,
  onSplitRight,
  onCloseSplit,
  onRouteUpdate,
}: PaneContainerProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0">
      {/* Tab bar row */}
      <div className="flex items-stretch relative">
        <div className="flex-1 overflow-hidden">
          <TabBar
            tabs={pane.tabs}
            activeTabId={pane.activeTabId}
            paneId={paneId}
            onTabClick={onTabClick}
            onTabClose={onTabClose}
            onSplitRight={onSplitRight}
          />
        </div>

        {/* Close pane button */}
        {showCloseButton && onCloseSplit && (
          <button
            onClick={onCloseSplit}
            className="flex items-center justify-center w-7 flex-shrink-0 transition-colors"
            style={{
              background: '#161B22',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              color: '#4B5563',
            }}
            title="Close split"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
              (e.currentTarget as HTMLElement).style.color = '#EF4444';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#161B22';
              (e.currentTarget as HTMLElement).style.color = '#4B5563';
            }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Map */}
      <MapPane
        pane={pane}
        paneId={paneId}
        onRouteUpdate={onRouteUpdate}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// SplitView Component
// ─────────────────────────────────────────────

export function SplitView({
  leftPane,
  rightPane,
  isSplit,
  onTabClick,
  onTabClose,
  onSplitRight,
  onCloseSplit,
  onRouteUpdate,
}: SplitViewProps) {
  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* Left Pane */}
      <PaneContainer
        pane={leftPane}
        paneId="left"
        onTabClick={(id) => onTabClick(id, 'left')}
        onTabClose={(id) => onTabClose(id, 'left')}
        onSplitRight={onSplitRight}
        onRouteUpdate={onRouteUpdate}
      />

      {/* Right Pane (split) */}
      {isSplit && rightPane && (
        <>
          <SplitDivider />
          <PaneContainer
            pane={rightPane}
            paneId="right"
            showCloseButton
            onTabClick={(id) => onTabClick(id, 'right')}
            onTabClose={(id) => onTabClose(id, 'right')}
            onSplitRight={onSplitRight}
            onCloseSplit={onCloseSplit}
            onRouteUpdate={onRouteUpdate}
          />
        </>
      )}
    </div>
  );
}
