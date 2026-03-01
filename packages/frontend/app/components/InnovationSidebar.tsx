'use client';

import { useState } from 'react';
import { Folder, Wrench } from 'lucide-react';
import { MapFileExplorer } from './MapFileExplorer';
import { MaintenancePanel } from './MaintenancePanel';

export function InnovationSidebar() {
  const [activeGroup, setActiveGroup] = useState<'files' | 'maintenance'>('files');

  return (
    <div className="h-full flex">
      {/* Activity Bar */}
      <div className="w-12 bg-[#0C1016] border-r border-[#CBD5E1] flex flex-col">
        <button
          onClick={() => setActiveGroup('files')}
          className={`w-full h-12 flex items-center justify-center ${
            activeGroup === 'files'
              ? 'text-white border-l-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          title="Map File System"
        >
          <Folder size={20} />
        </button>
        <button
          onClick={() => setActiveGroup('maintenance')}
          className={`w-full h-12 flex items-center justify-center ${
            activeGroup === 'maintenance'
              ? 'text-white border-l-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          title="Maintenance"
        >
          <Wrench size={20} />
        </button>
      </div>

      {/* Content Panel */}
      <div className="flex-1 w-64">
        {activeGroup === 'files' && <MapFileExplorer />}
        {activeGroup === 'maintenance' && <MaintenancePanel />}
      </div>
    </div>
  );
}
