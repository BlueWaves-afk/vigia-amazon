'use client';

import { useRef, useEffect } from 'react';
import { X, MapPin, SplitSquareHorizontal, Copy, Pin } from 'lucide-react';
import { Tab, ContextMenuState, PaneId } from '@/types';

// ─────────────────────────────────────────────
// TabBar — VS Code–style file tabs
// ─────────────────────────────────────────────

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  paneId: PaneId;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onSplitRight: (tabId: string) => void;
}

export function TabBar({
  tabs,
  activeTabId,
  paneId,
  onTabClick,
  onTabClose,
  onSplitRight,
}: TabBarProps) {
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const contextState = useRef<ContextMenuState>({ visible: false, x: 0, y: 0, tabId: '', paneId });
  const menuEl = useRef<HTMLDivElement | null>(null);

  function showContextMenu(e: React.MouseEvent, tabId: string) {
    e.preventDefault();
    e.stopPropagation();
    const menu = menuEl.current;
    if (!menu) return;

    menu.style.display = 'block';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    contextState.current = { visible: true, x: e.clientX, y: e.clientY, tabId, paneId };
  }

  function hideContextMenu() {
    const menu = menuEl.current;
    if (menu) menu.style.display = 'none';
    contextState.current.visible = false;
  }

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuEl.current && !menuEl.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, []);

  return (
    <>
      {/* Tab Bar */}
      <div
        className="flex items-end h-8 flex-shrink-0 overflow-x-auto overflow-y-hidden"
        style={{
          background: '#161B22',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              onContextMenu={(e) => showContextMenu(e, tab.id)}
              className={`relative flex items-center gap-1.5 h-full flex-shrink-0 cursor-pointer group select-none transition-all ${isActive ? 'bg-tab-active text-text-primary font-semibold' : 'bg-tab-inactive text-text-secondary'} hover:bg-bg-hover rounded-t-sm focus:outline-none focus:ring-2 focus:ring-border-focus`}
              style={{
                minWidth: 100,
                maxWidth: 180,
                paddingLeft: 10,
                paddingRight: 10,
                fontSize: '0.75rem',
                transition: 'all var(--transition-fast)',
                borderBottom: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                zIndex: isActive ? 2 : 1,
              }}
            >
              <MapPin size={11} style={{ color: isActive ? '#3B82F6' : '#4B5563', flexShrink: 0 }} />
              <span
                className="flex-1 truncate"
                style={{
                  fontSize: '0.75rem',
                  color: isActive ? '#E2E8F0' : '#6B7280',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {tab.title}
              </span>

              {/* Close / dirty indicator */}
              {tab.isDirty ? (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: '#3B82F6' }}
                />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{
                    color: '#6B7280',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLElement).style.color = '#E2E8F0';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '';
                    (e.currentTarget as HTMLElement).style.color = '#6B7280';
                  }}
                >
                  <X size={10} />
                </button>
              )}

              {/* Active indicator */}
              {isActive && <span className="tab-active-indicator" />}
            </div>
          );
        })}

        {/* Spacer */}
        <div className="flex-1 h-full" />
      </div>

      {/* Context Menu (portal to body via ref) */}
      <div
        ref={menuEl}
        className="context-menu"
        style={{ display: 'none' }}
      >
        <div
          className="context-menu-item"
          onClick={() => {
            if (contextState.current.tabId) onSplitRight(contextState.current.tabId);
            hideContextMenu();
          }}
        >
          <SplitSquareHorizontal size={12} />
          Split Right
        </div>
        <div
          className="context-menu-item"
          onClick={() => {
            if (contextState.current.tabId) onTabClick(contextState.current.tabId);
            hideContextMenu();
          }}
        >
          <Pin size={12} />
          Pin Tab
        </div>
        <div className="context-menu-separator" />
        <div
          className="context-menu-item"
          onClick={() => {
            if (contextState.current.tabId) onTabClose(contextState.current.tabId);
            hideContextMenu();
          }}
        >
          <X size={12} />
          Close Tab
        </div>
        <div
          className="context-menu-item"
          onClick={() => {
            tabs.forEach((t) => {
              if (t.id !== contextState.current.tabId) onTabClose(t.id);
            });
            hideContextMenu();
          }}
        >
          <Copy size={12} />
          Close Others
        </div>
      </div>
    </>
  );
}
