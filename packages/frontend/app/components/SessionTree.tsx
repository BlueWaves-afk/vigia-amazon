'use client';

import { useState, useEffect, useRef } from 'react';
import { TreeNodeComponent, TreeNode } from './TreeNode';
import { VFSManager, SessionFile } from '../lib/vfs-manager';
import { Search, RefreshCw } from 'lucide-react';

interface SessionTreeProps {
  vfsManager: VFSManager | null;
  onFileOpen?: (sessionId: string) => void;
}

const FONT_UI = 'var(--v-font-ui)';
const FONT_MONO = 'var(--v-font-mono)';

export function SessionTree({ vfsManager, onFileOpen }: SessionTreeProps) {
  const [tree,        setTree]        = useState<TreeNode[]>([]);
  const [selected,    setSelected]    = useState<string>('');
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set(['sessions']));
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing,  setRefreshing]  = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (vfsManager) loadSessions();
  }, [vfsManager]);

  const loadSessions = async () => {
    if (!vfsManager) return;
    setRefreshing(true);
    try {
      const sessions = await vfsManager.listSessions();
      setTree(buildTree(sessions));
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const buildTree = (sessions: SessionFile[]): TreeNode[] => {
    const root: TreeNode[] = [{
      id: 'sessions', label: 'Sessions',
      type: 'folder', depth: 0, children: [],
    }];

    const locationMap = new Map<string, SessionFile[]>();
    sessions.forEach(session => {
      const loc = session.location;
      const key = loc
        ? `${loc.continent}/${loc.country}/${loc.region}/${loc.city}`
        : 'Uncategorized';
      if (!locationMap.has(key)) locationMap.set(key, []);
      locationMap.get(key)!.push(session);
    });

    locationMap.forEach((sessionList, locationKey) => {
      const parts = locationKey.split('/');
      let currentLevel = root[0].children!;
      let currentPath = 'sessions';

      parts.forEach((part, index) => {
        currentPath += `/${part}`;
        let folder = currentLevel.find(n => n.id === currentPath);
        if (!folder) {
          folder = { id: currentPath, label: part, type: 'folder', depth: index + 1, children: [] };
          currentLevel.push(folder);
        }
        currentLevel = folder.children!;
      });

      sessionList.forEach(session => {
        currentLevel.push({
          id: session.sessionId,
          label: `${session.geohash7}_${new Date(session.timestamp).toLocaleString()}`,
          type: 'file',
          status: session.status,
          depth: parts.length + 1,
          metadata: session,
        });
      });
    });

    return root;
  };

  const handleExpand = (nodeId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  };

  const handleSelect = (nodeId: string) => {
    setSelected(nodeId);
    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === nodeId) return node;
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    const node = findNode(tree);
    if (node?.type === 'file' && onFileOpen) onFileOpen(nodeId);
  };

  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query) return nodes;
    return nodes.map(node => {
      if (node.type === 'file') {
        return node.label.toLowerCase().includes(query.toLowerCase()) ? node : null;
      }
      const filteredChildren = node.children ? filterTree(node.children, query) : [];
      return filteredChildren.length > 0 ? { ...node, children: filteredChildren } : null;
    }).filter(Boolean) as TreeNode[];
  };

  const renderTree = (nodes: TreeNode[]) =>
    nodes.map(node => (
      <TreeNodeComponent
        key={node.id}
        node={node}
        selected={selected === node.id}
        expanded={expanded.has(node.id)}
        onExpand={handleExpand}
        onSelect={handleSelect}
      />
    ));

  const filteredTree = filterTree(tree, searchQuery);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Search bar ──────────────────────── */}
      <div style={{
        padding: '6px 8px',
        borderBottom: '1px solid var(--v-border-default)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--c-input)',
          border: '1px solid var(--v-border-default)',
          borderRadius: 5,
          padding: '0 8px',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--v-accent) 50%, transparent)';
          (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--c-accent-glow)';
        }}
        onBlurCapture={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--v-border-default)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
        >
          <Search size={11} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Filter sessions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--c-text)',
              fontSize: '0.74rem',
              fontFamily: FONT_UI,
              padding: '5px 0',
              caretColor: 'var(--c-rose-2)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 14, height: 14, borderRadius: '50%', border: 'none',
                background: 'var(--v-hover-md)', color: 'var(--c-text-3)',
                cursor: 'pointer', fontSize: '0.6rem', flexShrink: 0,
              }}
            >✕</button>
          )}
        </div>
      </div>

      {/* ── Tree view ───────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px 8px' }}>
        {filteredTree.length > 0 ? (
          renderTree(filteredTree)
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '28px 16px', gap: 8,
          }}>
            <Search size={18} style={{ color: 'var(--c-text-3)', opacity: 0.35 }} />
            <span style={{
              fontSize: '0.72rem', color: 'var(--c-text-3)',
              fontFamily: FONT_UI, textAlign: 'center', lineHeight: 1.5,
            }}>
              {searchQuery ? 'No sessions match' : 'No sessions yet'}
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  fontSize: '0.68rem', color: 'var(--c-accent-2)',
                  fontFamily: FONT_UI, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Refresh button ──────────────────── */}
      <div className="vigia-sidebar-footer" style={{
        padding: '6px 8px',
        borderTop: 'none',
        flexShrink: 0,
      }}>
        <button
          onClick={loadSessions}
          disabled={refreshing}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '5px 0', borderRadius: 4,
            border: '1px solid var(--v-border-default)',
            background: 'var(--c-panel)',
            color: refreshing ? 'var(--c-text-3)' : 'var(--c-text-2)',
            fontSize: '0.72rem', cursor: refreshing ? 'default' : 'pointer',
            fontFamily: FONT_UI, transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            if (!refreshing) {
              (e.currentTarget as HTMLElement).style.background = 'var(--v-hover)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--c-rose-border)';
              (e.currentTarget as HTMLElement).style.color = 'var(--c-text)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--c-panel)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--v-border-default)';
            (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)';
          }}
        >
          <RefreshCw
            size={11}
            style={{
              color: refreshing ? 'var(--c-accent-2)' : 'var(--c-text-3)',
              animation: refreshing ? 'spin 0.9s linear infinite' : 'none',
            }}
          />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
