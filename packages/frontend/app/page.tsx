'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { VideoUploader } from './components/VideoUploader';
import { LiveMap } from './components/LiveMap';
import { LedgerTicker } from './components/LedgerTicker';
import { ReasoningTraceViewer } from './components/ReasoningTraceViewer';
import { Sidebar } from './components/Sidebar';
import { Breadcrumb } from './components/Breadcrumb';

export default function Dashboard() {
  const [consoleHeight, setConsoleHeight] = useState(200);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'traces' | 'ledger' | 'terminal'>('traces');
  const [activeMainTab, setActiveMainTab] = useState<'map' | 'sentinel'>('map');

  return (
    <div className="h-screen flex flex-col bg-ide-bg font-ui">
      {/* Main Container: Sidebar + Main Stage */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar 
          onSentinelEyeClick={() => setActiveMainTab('sentinel')}
          isSentinelEyeActive={activeMainTab === 'sentinel'}
        />

        {/* Main Stage */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <div className="h-10 bg-ide-panel border-b border-ide-border flex items-center px-2 gap-1">
            <button
              onClick={() => setActiveMainTab('map')}
              className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                activeMainTab === 'map'
                  ? 'bg-ide-bg border-b-2 border-ide-text'
                  : 'text-ide-text-secondary hover:bg-ide-hover'
              }`}
            >
              World Map
              {activeMainTab === 'map' && (
                <X className="w-3 h-3 hover:bg-ide-hover rounded" />
              )}
            </button>
            <button
              onClick={() => setActiveMainTab('sentinel')}
              className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                activeMainTab === 'sentinel'
                  ? 'bg-ide-bg border-b-2 border-ide-text'
                  : 'text-ide-text-secondary hover:bg-ide-hover'
              }`}
            >
              Sentinel Eye
              {activeMainTab === 'sentinel' && (
                <X className="w-3 h-3 hover:bg-ide-hover rounded" />
              )}
            </button>
          </div>

          {/* Breadcrumb Bar (only for map) */}
          {activeMainTab === 'map' && (
            <Breadcrumb path={['World', 'India', 'Odisha', 'Rourkela']} />
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            {activeMainTab === 'map' && <LiveMap />}
            {activeMainTab === 'sentinel' && (
              <div className="h-full overflow-y-auto p-4 bg-ide-bg">
                <VideoUploader />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Console */}
      <div
        className="border-t border-ide-border bg-ide-bg flex flex-col"
        style={{ height: `${consoleHeight}px` }}
      >
        {/* Console Tab Bar */}
        <div className="h-8 bg-ide-panel border-b border-ide-border flex items-center px-2">
          <button
            onClick={() => setActiveConsoleTab('traces')}
            className={`px-3 py-1 text-xs font-data transition-colors ${
              activeConsoleTab === 'traces'
                ? 'border-b-2 border-ide-text'
                : 'text-ide-text-secondary hover:bg-ide-hover'
            }`}
          >
            Agent Traces
          </button>
          <button
            onClick={() => setActiveConsoleTab('ledger')}
            className={`px-3 py-1 text-xs font-data transition-colors ${
              activeConsoleTab === 'ledger'
                ? 'border-b-2 border-ide-text'
                : 'text-ide-text-secondary hover:bg-ide-hover'
            }`}
          >
            DePIN Ledger
          </button>
          <button
            onClick={() => setActiveConsoleTab('terminal')}
            className={`px-3 py-1 text-xs font-data transition-colors ${
              activeConsoleTab === 'terminal'
                ? 'border-b-2 border-ide-text'
                : 'text-ide-text-secondary hover:bg-ide-hover'
            }`}
          >
            Terminal
          </button>
        </div>

        {/* Console Content */}
        <div className="flex-1 overflow-y-auto p-4 font-data text-xs bg-ide-bg">
          {activeConsoleTab === 'traces' && <ReasoningTraceViewer />}
          {activeConsoleTab === 'ledger' && <LedgerTicker />}
          {activeConsoleTab === 'terminal' && (
            <div className="text-ide-text-secondary space-y-1">
              <div>&gt; System initialized</div>
              <div>&gt; Ready for telemetry ingestion</div>
              <div>&gt; ONNX Runtime: Loaded</div>
              <div>&gt; Bedrock Agent: Connected</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
