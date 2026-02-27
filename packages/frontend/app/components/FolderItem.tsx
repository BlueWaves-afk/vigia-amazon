'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Video } from 'lucide-react';

interface FolderItemProps {
  label: string;
  icon: 'folder' | 'file' | 'video';
  depth?: number;
  isActive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function FolderItem({ label, icon, depth = 0, isActive, onClick, children }: FolderItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = !!children;

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
    onClick?.();
  };

  const IconComponent = icon === 'folder' 
    ? (isExpanded ? FolderOpen : Folder)
    : icon === 'video' 
    ? Video 
    : File;

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors ${
          isActive 
            ? 'bg-ide-hover border-l-2 border-ide-text' 
            : 'hover:bg-ide-hover'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren && (
          isExpanded ? (
            <ChevronDown className="w-3 h-3 text-ide-text-secondary flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-ide-text-secondary flex-shrink-0" />
          )
        )}
        <IconComponent className="w-3 h-3 text-ide-text-secondary flex-shrink-0" />
        <span className="text-ide-text truncate">{label}</span>
      </button>
      {isExpanded && children && (
        <div>{children}</div>
      )}
    </div>
  );
}
