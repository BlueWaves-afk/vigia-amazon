'use client';

import { FolderItem } from './FolderItem';

interface SidebarProps {
  onSentinelEyeClick: () => void;
  isSentinelEyeActive: boolean;
}

export function Sidebar({ onSentinelEyeClick, isSentinelEyeActive }: SidebarProps) {
  return (
    <div className="w-[260px] bg-ide-panel border-r border-ide-border flex flex-col">
      <div className="p-4 border-b border-ide-border">
        <h2 className="text-sm font-semibold text-ide-text">EXPLORER</h2>
      </div>
      <div className="flex-1 p-2 overflow-y-auto">
        <div className="space-y-1">
          <FolderItem label="Sessions" icon="folder">
            <FolderItem label="2026-02-27" icon="folder" depth={1}>
              <FolderItem label="Session-001" icon="file" depth={2} />
              <FolderItem label="Session-002" icon="file" depth={2} />
            </FolderItem>
          </FolderItem>

          <FolderItem label="Live Streams" icon="folder">
            <FolderItem 
              label="Sentinel Eye" 
              icon="video" 
              depth={1}
              isActive={isSentinelEyeActive}
              onClick={onSentinelEyeClick}
            />
          </FolderItem>
        </div>
      </div>
    </div>
  );
}
