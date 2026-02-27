import { VideoUploader } from './components/VideoUploader';
import { LiveMap } from './components/LiveMap';
import { LedgerTicker } from './components/LedgerTicker';
import { ReasoningTraceViewer } from './components/ReasoningTraceViewer';

export default function Dashboard() {
  return (
    <div className="h-screen bg-vigia-dark grid grid-cols-4 grid-rows-[1fr_80px] gap-2 p-2">
      {/* Zone A: Sentinel Eye (Left Panel - Data Genesis) */}
      <div className="col-span-1 bg-vigia-panel rounded-lg p-4 border border-gray-800 shadow-[0_0_15px_rgba(59,130,246,0.3)] overflow-y-auto">
        <h2 className="text-lg font-semibold text-vigia-accent mb-4">
          📹 Sentinel Eye
        </h2>
        <VideoUploader />
      </div>

      {/* Zone B: Cloud Swarm Logic (Center Panel - Intelligence) */}
      <div className="col-span-1 bg-vigia-panel rounded-lg border border-gray-800 shadow-[0_0_15px_rgba(59,130,246,0.3)] overflow-hidden">
        <h2 className="text-lg font-semibold text-vigia-accent p-4 pb-2 border-b border-gray-800">
          🧠 Cloud Swarm Logic
        </h2>
        <ReasoningTraceViewer />
      </div>

      {/* Zone C: Living Map (Main Background - Visualization) */}
      <div className="col-span-2 bg-vigia-dark rounded-lg border border-gray-800 shadow-[0_0_15px_rgba(59,130,246,0.3)] relative overflow-hidden">
        <LiveMap />
      </div>

      {/* Zone D: Road Health Ledger (Bottom Strip - DePIN) */}
      <div className="col-span-4 bg-vigia-panel rounded-lg px-4 py-2 border border-gray-800 shadow-[0_0_15px_rgba(59,130,246,0.3)] overflow-hidden">
        <div className="flex items-center gap-4">
          <span className="text-vigia-success font-semibold text-sm whitespace-nowrap">📊 DePIN Ledger:</span>
          <div className="flex-1">
            <LedgerTicker />
          </div>
        </div>
      </div>
    </div>
  );
}
