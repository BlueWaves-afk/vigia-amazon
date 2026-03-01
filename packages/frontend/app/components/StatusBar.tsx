'use client';

import { User, CheckCircle, AlertTriangle, Cpu, Wifi, Activity } from 'lucide-react';

// ─────────────────────────────────────────────
// StatusBar — Bottom application status bar
// ─────────────────────────────────────────────

export function StatusBar() {
  return (
    <div
      className="flex items-center justify-between flex-shrink-0 select-none"
      style={{ height: 26, background: '#0D1117', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Left */}
      <div className="flex items-center h-full">
        <div
          className="flex items-center gap-2 px-4 h-full"
          style={{ background: '#2563EB' }}
        >
          <User size={13} style={{ color: '#fff' }} />
          <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 500 }}>user</span>
        </div>

        <div className="flex items-center gap-2 px-4 h-full border-r border-ide-border">
          <CheckCircle size={13} className="text-ide-green" />
          <span className="text-ide-text-secondary" style={{ fontSize: '0.75rem' }}>No errors</span>
        </div>

        <div className="flex items-center gap-2 px-4 h-full border-r border-ide-border">
          <AlertTriangle size={13} className="text-ide-yellow" />
          <span className="text-ide-text-secondary" style={{ fontSize: '0.75rem' }}>7 hazards</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center h-full">
        <div className="flex items-center gap-2 px-4 h-full border-l border-ide-border">
          <Activity size={13} className="text-ide-text-tertiary" />
          <span className="text-ide-text-secondary font-data" style={{ fontSize: '0.75rem' }}>48 nodes</span>
        </div>
        <div className="flex items-center gap-2 px-4 h-full border-l border-ide-border">
          <Cpu size={13} className="text-ide-text-tertiary" />
          <span className="text-ide-text-secondary font-data" style={{ fontSize: '0.75rem' }}>ONNX · Active</span>
        </div>
        <div className="flex items-center gap-2 px-4 h-full border-l border-ide-border">
          <Wifi size={13} className="text-ide-text-tertiary" />
          <span className="text-ide-text-secondary font-data" style={{ fontSize: '0.75rem' }}>8ms</span>
        </div>
        <div className="flex items-center gap-2 px-4 h-full border-l border-ide-border">
          <span className="text-ide-text-secondary" style={{ fontSize: '0.75rem' }}>UTF-8 · GeoJSON</span>
        </div>
      </div>
    </div>
  );
}
