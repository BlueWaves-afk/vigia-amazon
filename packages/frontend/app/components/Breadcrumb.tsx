'use client';

import { ChevronRight } from 'lucide-react';

interface BreadcrumbProps {
  path: string[];
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  return (
    <div className="h-8 px-4 bg-ide-panel border-b border-ide-border flex items-center gap-2">
      {path.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-xs text-ide-text-secondary font-ui">{item}</span>
          {index < path.length - 1 && (
            <ChevronRight className="w-3 h-3 text-ide-text-tertiary" />
          )}
        </div>
      ))}
    </div>
  );
}
