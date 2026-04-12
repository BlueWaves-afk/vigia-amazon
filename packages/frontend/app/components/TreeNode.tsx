'use client';

import { ChevronRight, ChevronDown, Folder, FolderOpen, File, CheckCircle, AlertTriangle, Archive, Clock } from 'lucide-react';

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

const FONT_UI = 'var(--v-font-ui)';
const FONT_MONO = 'var(--v-font-mono)';

export function TreeNodeComponent({ node, selected, expanded, onExpand, onSelect, onContextMenu }: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    if (hasChildren) onExpand(node.id);
    onSelect(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(node.id, e);
  };

  const getIcon = () => {
    if (node.type === 'folder') {
      return expanded
        ? <FolderOpen size={13} style={{ color: 'var(--c-text-2)', flexShrink: 0 }} />
        : <Folder     size={13} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />;
    }
    switch (node.status) {
      case 'finalized': return <CheckCircle size={13} style={{ color: 'var(--c-green)',  flexShrink: 0 }} />;
      case 'archived':  return <Archive     size={13} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />;
      default:          return <Clock       size={13} style={{ color: 'var(--c-accent-2)', flexShrink: 0 }} />;
    }
  };

  const rowStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingLeft: 8 + node.depth * 14,
    paddingRight: 8,
    border: 'none',
    borderRadius: 4,
    background: selected ? 'var(--c-accent-glow)' : 'transparent',
    cursor: 'pointer',
    transition: 'background 0.1s',
    fontFamily: FONT_UI,
  };

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={rowStyle}
        onMouseEnter={(e) => {
          if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)';
        }}
        onMouseLeave={(e) => {
          if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {/* Active accent line */}
        {selected && (
          <span style={{
            position: 'absolute', left: 0, top: 3, bottom: 3,
            width: 2, borderRadius: 1,
            background: 'var(--c-accent-2)',
          }} />
        )}

        {/* Chevron */}
        <span style={{ width: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {hasChildren
            ? (expanded
              ? <ChevronDown  size={11} style={{ color: 'var(--c-text-3)' }} />
              : <ChevronRight size={11} style={{ color: 'var(--c-text-3)' }} />)
            : null}
        </span>

        {/* Icon */}
        {getIcon()}

        {/* Label */}
        <span style={{
          flex: 1,
          fontSize: '0.76rem',
          fontFamily: node.type === 'file' ? FONT_MONO : FONT_UI,
          color: selected
            ? 'var(--c-text)'
            : node.type === 'folder'
              ? 'var(--c-text)'
              : 'var(--c-text-2)',
          fontWeight: node.type === 'folder' ? 500 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
          letterSpacing: node.type === 'folder' ? '-0.01em' : '0',
        }}>
          {node.label}
        </span>

        {/* Status badge for files */}
        {node.type === 'file' && node.status === 'finalized' && (
          <span style={{
            fontSize: '0.56rem', fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--c-green)',
            background: 'var(--c-green-dim)', border: '1px solid var(--c-green)',
            borderRadius: 3, padding: '1px 4px', flexShrink: 0,
            fontFamily: FONT_UI,
          }}>
            OK
          </span>
        )}
      </button>

      {/* Children — animated */}
      {expanded && hasChildren && (
        <div className="tree-child-enter">
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
