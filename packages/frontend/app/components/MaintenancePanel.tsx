'use client';

import { useEconomicStore } from '@/stores/economicStore';
import { useState } from 'react';
import type { MaintenanceReport } from '@vigia/shared';

interface MaintenancePanelProps {
  prefilledHazard?: {
    hazardId: string;
    geohash: string;
    type: string;
    severity: number;
  };
}

export function MaintenancePanel({ prefilledHazard }: MaintenancePanelProps) {
  const { maintenanceQueue, isLoading, submitMaintenanceReport, fetchMaintenanceQueue } = useEconomicStore();
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(!!prefilledHazard);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefilledHazard) return;

    try {
      await submitMaintenanceReport({
        hazardId: prefilledHazard.hazardId,
        geohash: prefilledHazard.geohash,
        type: prefilledHazard.type as any,
        severity: prefilledHazard.severity,
        reportedBy: 'current-user', // TODO: Get from auth context
        reportedAt: Date.now(),
        status: 'PENDING',
        notes: notes || undefined,
        signature: 'temp-signature', // TODO: Sign with ECDSA
      });

      setNotes('');
      setShowForm(false);
    } catch (error) {
      console.error('Failed to submit report:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F5F5]">
      <div className="p-3 border-b border-[#CBD5E1]">
        <h3 className="text-xs font-medium text-gray-700">MAINTENANCE</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {showForm && prefilledHazard && (
          <div className="bg-white border border-[#CBD5E1] rounded p-3 mb-3">
            <div className="text-xs font-medium mb-2">Report Hazard for Maintenance</div>
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="text-xs font-mono">
                <div className="text-gray-600">Hazard ID:</div>
                <div>{prefilledHazard.hazardId}</div>
              </div>
              <div className="text-xs font-mono">
                <div className="text-gray-600">Type:</div>
                <div>{prefilledHazard.type}</div>
              </div>
              <div className="text-xs font-mono">
                <div className="text-gray-600">Severity:</div>
                <div>{prefilledHazard.severity}/5</div>
              </div>
              <div className="text-xs font-mono">
                <div className="text-gray-600">Location:</div>
                <div>Geohash {prefilledHazard.geohash}</div>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  Notes (optional, max 500 chars)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  className="w-full px-2 py-1 text-xs border border-[#CBD5E1] rounded font-mono"
                  rows={3}
                  placeholder="Additional details about the hazard..."
                />
                <div className="text-xs text-gray-500 mt-1">{notes.length}/500</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="text-xs px-3 py-1 bg-white border border-[#CBD5E1] rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  {isLoading ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs px-3 py-1 bg-white border border-[#CBD5E1] rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white border border-[#CBD5E1] rounded p-3">
          <div className="text-xs font-medium mb-2 flex items-center justify-between">
            <span>Maintenance Queue</span>
            <button
              onClick={() => fetchMaintenanceQueue()}
              className="text-xs px-2 py-1 bg-white border border-[#CBD5E1] rounded hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {maintenanceQueue.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">
              No maintenance reports
            </div>
          ) : (
            <div className="space-y-2">
              {maintenanceQueue.slice(0, 20).map((report) => (
                <div
                  key={report.reportId}
                  className="p-2 border border-[#CBD5E1] rounded text-xs font-mono"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">Report #{report.reportId.slice(-8)}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        report.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : report.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : report.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    {report.type} at {report.geohash}
                  </div>
                  <div className="text-gray-600">
                    Est. Cost: ${report.estimatedCost}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
