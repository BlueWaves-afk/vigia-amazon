'use client';

import { useState } from 'react';
import { Folder, Wrench } from 'lucide-react';
import { MapFileExplorer } from './MapFileExplorer';
import { MaintenancePanel } from './MaintenancePanel';

export function InnovationSidebar() {
  const [activeGroup, setActiveGroup] = useState<'files' | 'maintenance'>('files');

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* Activity bar */}
      <div style={{
        width: 44, background: 'var(--c-bg)',
        borderRight: '1px solid var(--c-border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {([
          { id: 'files',       icon: <Folder size={18} />,  title: 'Map File System' },
          { id: 'maintenance', icon: <Wrench size={18} />,  title: 'Maintenance'     },
        ] as const).map(({ id, icon, title }) => {
          const active = activeGroup === id;
          return (
            <button
              key={id}
              title={title}
              onClick={() => setActiveGroup(id)}
              style={{
                width: '100%', height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: active ? 'var(--c-accent-glow)' : 'transparent',
                color: active ? 'var(--c-accent-2)' : 'var(--c-text-3)',
                borderLeft: active ? '2px solid var(--c-accent-2)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color var(--dur-fast), background var(--dur-fast), border-color var(--dur-fast)',
              }}
              onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'var(--c-text-2)'; (e.currentTarget as HTMLElement).style.background = 'var(--c-hover)'; } }}
              onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'var(--c-text-3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
            >
              {icon}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {activeGroup === 'files'       && <MapFileExplorer />}
        {activeGroup === 'maintenance' && <MaintenancePanel />}
      </div>
    </div>
  );
}
