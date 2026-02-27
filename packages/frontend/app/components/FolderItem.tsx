'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Video,
} from 'lucide-react';

// ─────────────────────────────────────────────
// FolderItem — Dark IDE tree node
// ─────────────────────────────────────────────

interface FolderItemProps {
  label: string;
  icon: 'folder' | 'file' | 'video';
  depth?: number;
  isActive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function FolderItem({
  label,
  icon,
  depth = 0,
  isActive = false,
  onClick,
  children,
}: FolderItemProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = Boolean(children);
  const paddingLeft = 10 + depth * 14;

  function handleClick() {
    if (hasChildren) setExpanded((v) => !v);
    onClick?.();
  }

  function renderIcon() {
    if (icon === 'video') return <Video size={12} style={{ color: '#3B82F6', flexShrink: 0 }} />;
    if (icon === 'file')  return <FileText size={12} style={{ color: '#4B5563', flexShrink: 0 }} />;
    if (expanded)         return <FolderOpen size={12} style={{ color: '#8B95A1', flexShrink: 0 }} />;
    return <Folder size={12} style={{ color: '#4B5563', flexShrink: 0 }} />;
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-1.5 h-7 text-left relative transition-colors group"
        style={{
          paddingLeft,
          background: isActive ? 'rgba(37,99,235,0.14)' : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = '';
        }}
      >
        {/* Active left border */}
        {isActive && (
          <span
            className="absolute left-0 top-0 bottom-0 w-0.5"
            style={{ background: '#3B82F6' }}
          />
        )}

        {/* Chevron */}
        <span className="w-3 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            expanded
              ? <ChevronDown size={10} className="text-ide-text-tertiary" />
              : <ChevronRight size={10} className="text-ide-text-tertiary" />
          ) : null}
        </span>

        {renderIcon()}

        <span
          style={{
            fontSize: '0.76rem',
            color: isActive ? '#E2E8F0' : icon === 'video' ? '#8B95A1' : '#6B7280',
            fontWeight: isActive ? 500 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {label}
        </span>

        {/* Live badge for video */}
        {icon === 'video' && (
          <span
            className="mr-2 px-1 rounded text-white flex-shrink-0"
            style={{
              fontSize: '0.55rem',
              background: '#EF4444',
              fontWeight: 600,
              letterSpacing: '0.04em',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            LIVE
          </span>
        )}
      </button>

      {hasChildren && expanded && <div>{children}</div>}
    </div>
  );
}
