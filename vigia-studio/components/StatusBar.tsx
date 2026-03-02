'use client';

import { GitBranch, AlertTriangle, CheckCircle, Activity, Cpu, Wifi } from 'lucide-react';

// ─────────────────────────────────────────────
// StatusBar — Bottom application status bar
// ─────────────────────────────────────────────

interface StatusBarProps {
  openTabCount: number;
  activeCityName?: string;
}

export function StatusBar({ openTabCount, activeCityName }: StatusBarProps) {
  return (
    <footer
      className="flex items-center justify-between h-7 px-4 text-2xs text-text-muted bg-bg-panel border-t border-border-subtle shadow-sm"
      style={{
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize: '0.68rem',
        letterSpacing: '-0.01em',
        boxShadow: '0 -1px 0 0 rgba(37,99,235,0.04)',
      }}
    >
      <div className="flex items-center gap-3">
        <span>Tabs: <span className="text-text-primary font-semibold">{openTabCount}</span></span>
        {activeCityName && (
          <span className="ml-2 text-accent-blue">Active: {activeCityName}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="opacity-60">VIGIA Studio</span>
        <span className="opacity-40">© 2026</span>
      </div>
    </footer>
  );
}
