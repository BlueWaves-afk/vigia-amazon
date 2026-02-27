'use client';

import { GitBranch, CheckCircle, AlertTriangle, Cpu, Wifi, Activity } from 'lucide-react';

// ─────────────────────────────────────────────
// StatusBar — Bottom application status bar
// ─────────────────────────────────────────────

export function StatusBar() {
  return (
    <div
      className="flex items-center justify-between h-5 flex-shrink-0 select-none"
      style={{ background: '#0D1117', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Left */}
      <div className="flex items-center h-full">
        <div
          className="flex items-center gap-1.5 px-3 h-full"
          style={{ background: '#2563EB' }}
        >
          <GitBranch size={10} style={{ color: '#fff' }} />
          <span style={{ fontSize: '0.6rem', color: '#fff', fontWeight: 500 }}>main</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 h-full border-r border-ide-border">
          <CheckCircle size={10} className="text-ide-green" />
          <span className="text-ide-text-secondary" style={{ fontSize: '0.6rem' }}>No errors</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 h-full border-r border-ide-border">
          <AlertTriangle size={10} className="text-ide-yellow" />
          <span className="text-ide-text-secondary" style={{ fontSize: '0.6rem' }}>7 hazards</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center h-full">
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-ide-border">
          <Activity size={10} className="text-ide-text-tertiary" />
          <span className="text-ide-text-secondary font-data" style={{ fontSize: '0.6rem' }}>48 nodes</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-ide-border">
          <Cpu size={10} className="text-ide-text-tertiary" />
          <span className="text-ide-text-secondary font-data" style={{ fontSize: '0.6rem' }}>ONNX · Active</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-ide-border">
          <Wifi size={10} className="text-ide-text-tertiary" />
          <span className="text-ide-text-secondary font-data" style={{ fontSize: '0.6rem' }}>8ms</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 h-full border-l border-ide-border">
          <span className="text-ide-text-secondary" style={{ fontSize: '0.6rem' }}>UTF-8 · GeoJSON</span>
        </div>
      </div>
    </div>
  );
}
