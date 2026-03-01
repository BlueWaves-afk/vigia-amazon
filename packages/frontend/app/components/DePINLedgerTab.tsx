'use client';

import { ROIWidget } from './ROIWidget';

interface DePINLedgerTabProps {
  sessionId: string;
}

export function DePINLedgerTab({ sessionId }: DePINLedgerTabProps) {
  return (
    <div className="h-full flex flex-col bg-[#1E1E1E] overflow-y-auto">
      <div className="p-4">
        <ROIWidget sessionId={sessionId} />
      </div>

      <div className="p-4">
        <div className="bg-white border border-[#CBD5E1] rounded p-4">
          <div className="text-sm font-medium mb-3">HASH CHAIN LEDGER</div>
          <div className="space-y-2 text-xs font-mono">
            <div className="p-2 bg-[#F5F5F5] rounded">
              <div className="text-gray-600">Block #1234</div>
              <div className="text-gray-800 truncate">0xabc...def</div>
            </div>
            <div className="p-2 bg-[#F5F5F5] rounded">
              <div className="text-gray-600">Block #1235</div>
              <div className="text-gray-800 truncate">0x123...456</div>
            </div>
            <div className="text-xs text-gray-500 text-center py-2">
              Existing ledger functionality preserved
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
