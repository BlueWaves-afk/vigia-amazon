'use client';

import { ChevronRight, Globe } from 'lucide-react';

interface BreadcrumbProps {
  path: string[];
}

// ─────────────────────────────────────────────
// Breadcrumb — Dark IDE file path bar
// ─────────────────────────────────────────────

export function Breadcrumb({ path }: BreadcrumbProps) {
  return (
    <div
      className="flex items-center gap-0 h-7 px-3 flex-shrink-0 select-none"
      style={{
        background: '#161B22',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <Globe size={11} className="text-ide-text-tertiary mr-2 flex-shrink-0" />
      {path.map((segment, i) => (
        <span key={segment} className="flex items-center gap-0">
          <span
            className="transition-colors cursor-default"
            style={{
              fontSize: '0.7rem',
              color: i === path.length - 1 ? '#E2E8F0' : '#4B5563',
              fontWeight: i === path.length - 1 ? 500 : 400,
            }}
            onMouseEnter={(e) => {
              if (i < path.length - 1)
                (e.currentTarget as HTMLElement).style.color = '#8B95A1';
            }}
            onMouseLeave={(e) => {
              if (i < path.length - 1)
                (e.currentTarget as HTMLElement).style.color = '#4B5563';
            }}
          >
            {segment}
          </span>
          {i < path.length - 1 && (
            <ChevronRight size={10} className="text-ide-text-tertiary mx-1 flex-shrink-0" />
          )}
        </span>
      ))}
    </div>
  );
}
