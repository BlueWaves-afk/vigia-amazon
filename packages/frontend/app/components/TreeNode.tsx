'use client';

import { ChevronRight, ChevronDown, Folder, FolderOpen, File, CheckCircle, AlertTriangle, Archive } from 'lucide-react';

export interface TreeNode {
  id: string;
  label: string;
  type: 'folder' | 'file';
  icon?: string;
  status?: 'draft' | 'finalized' | 'archived';
  children?: TreeNode[];
  depth: number;
  metadata?: any;
}

interface TreeNodeProps {
  node: TreeNode;
  selected: boolean;
  expanded: boolean;
  onExpand: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onContextMenu?: (nodeId: string, event: React.MouseEvent) => void;
}

export function TreeNodeComponent({ node, selected, expanded, onExpand, onSelect, onContextMenu }: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      onExpand(node.id);
    }
    onSelect(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(node.id, e);
  };

  const getStatusIcon = () => {
    if (node.type === 'folder') {
      return expanded ? <FolderOpen className="w-3 h-3" /> : <Folder className="w-3 h-3" />;
    }
    
    switch (node.status) {
      case 'finalized':
        return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'archived':
        return <Archive className="w-3 h-3 text-ide-text-tertiary" />;
      default:
        return <File className="w-3 h-3" />;
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors ${
          selected 
            ? 'bg-ide-hover border-l-2 border-ide-text' 
            : 'hover:bg-ide-hover'
        }`}
        style={{ paddingLeft: `${8 + node.depth * 16}px` }}
      >
        {hasChildren && (
          expanded ? (
            <ChevronDown className="w-3 h-3 text-ide-text-secondary flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-ide-text-secondary flex-shrink-0" />
          )
        )}
        <span className="text-ide-text-secondary flex-shrink-0">
          {getStatusIcon()}
        </span>
        <span className="text-ide-text truncate font-ui">{node.label}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              selected={selected}
              expanded={false}
              onExpand={onExpand}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}
