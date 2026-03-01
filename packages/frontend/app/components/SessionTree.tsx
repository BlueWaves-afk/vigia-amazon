'use client';

import { useState, useEffect } from 'react';
import { TreeNodeComponent, TreeNode } from './TreeNode';
import { VFSManager, SessionFile } from '../lib/vfs-manager';

interface SessionTreeProps {
  vfsManager: VFSManager | null;
  onFileOpen?: (sessionId: string) => void;
}

export function SessionTree({ vfsManager, onFileOpen }: SessionTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['sessions']));
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (vfsManager) {
      loadSessions();
    }
  }, [vfsManager]);

  const loadSessions = async () => {
    if (!vfsManager) return;

    try {
      const sessions = await vfsManager.listSessions();
      const treeData = buildTree(sessions);
      setTree(treeData);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const buildTree = (sessions: SessionFile[]): TreeNode[] => {
    const root: TreeNode[] = [
      {
        id: 'sessions',
        label: 'Sessions',
        type: 'folder',
        depth: 0,
        children: [],
      },
    ];

    // Group sessions by location
    const locationMap = new Map<string, SessionFile[]>();
    
    sessions.forEach(session => {
      const location = session.location;
      const key = location ? 
        `${location.continent}/${location.country}/${location.region}/${location.city}` : 
        'Uncategorized';
      
      if (!locationMap.has(key)) {
        locationMap.set(key, []);
      }
      locationMap.get(key)!.push(session);
    });

    // Build tree structure
    locationMap.forEach((sessionList, locationKey) => {
      const parts = locationKey.split('/');
      let currentLevel = root[0].children!;
      let currentPath = 'sessions';

      parts.forEach((part, index) => {
        currentPath += `/${part}`;
        let folder = currentLevel.find(n => n.id === currentPath);

        if (!folder) {
          folder = {
            id: currentPath,
            label: part,
            type: 'folder',
            depth: index + 1,
            children: [],
          };
          currentLevel.push(folder);
        }

        currentLevel = folder.children!;
      });

      // Add session files
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
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSelect = (nodeId: string) => {
    setSelected(nodeId);
    
    // If it's a file, trigger open callback
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
    if (node?.type === 'file' && onFileOpen) {
      onFileOpen(nodeId);
    }
  };

  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query) return nodes;

    return nodes.map(node => {
      if (node.type === 'file') {
        return node.label.toLowerCase().includes(query.toLowerCase()) ? node : null;
      }

      const filteredChildren = node.children ? filterTree(node.children, query) : [];
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }

      return null;
    }).filter(Boolean) as TreeNode[];
  };

  const renderTree = (nodes: TreeNode[]) => {
    return nodes.map(node => (
      <TreeNodeComponent
        key={node.id}
        node={node}
        selected={selected === node.id}
        expanded={expanded.has(node.id)}
        onExpand={handleExpand}
        onSelect={handleSelect}
      />
    ));
  };

  const filteredTree = filterTree(tree, searchQuery);

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-2 border-b border-ide-border">
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-ide-bg border border-ide-border rounded focus:outline-none focus:border-ide-text"
        />
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredTree.length > 0 ? (
          renderTree(filteredTree)
        ) : (
          <div className="text-xs text-ide-text-secondary text-center py-4">
            {searchQuery ? 'No sessions found' : 'No sessions yet'}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="p-2 border-t border-ide-border">
        <button
          onClick={loadSessions}
          className="w-full px-2 py-1 text-xs bg-ide-panel border border-ide-border text-ide-text hover:bg-ide-hover rounded"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
