'use client';

import { useEconomicStore } from '@/stores/economicStore';
import { useEffect } from 'react';

interface ROIWidgetProps {
  sessionId: string;
}

export function ROIWidget({ sessionId }: ROIWidgetProps) {
  const { metrics, isLoading, fetchMetrics } = useEconomicStore();

  useEffect(() => {
    // Only fetch if innovation endpoint is configured
    if (!process.env.NEXT_PUBLIC_INNOVATION_API_ENDPOINT) {
      return;
    }

    fetchMetrics(sessionId);

    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchMetrics(sessionId);
    }, 30000);

    return () => clearInterval(interval);
  }, [sessionId, fetchMetrics]);

  if (isLoading && !metrics) {
    return (
      <div className="bg-white border border-[#CBD5E1] rounded p-4">
        <div className="text-xs text-gray-500">Loading metrics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white border border-[#CBD5E1] rounded p-4">
        <div className="text-xs text-gray-500">No metrics available</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#CBD5E1] rounded p-4">
      <div className="text-sm font-medium mb-3">CITY HEALTH ROI - Last 7 Days</div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-600 mb-1">Total Hazards Detected</div>
          <div className="text-2xl font-bold font-mono">{metrics.totalHazardsDetected}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">ROI Multiplier</div>
          <div className="text-2xl font-bold font-mono text-[#10B981]">{metrics.roiMultiplier.toFixed(2)}x</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-600 mb-1">Estimated Repair Cost</div>
          <div className="text-lg font-mono">${metrics.totalEstimatedRepairCost.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Prevented Damage Cost</div>
          <div className="text-lg font-mono text-[#10B981]">${metrics.totalPreventedDamageCost.toLocaleString()}</div>
        </div>
      </div>

      <div className="border-t border-[#CBD5E1] pt-3">
        <div className="text-xs font-medium mb-2">Breakdown by Type</div>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-gray-600">Potholes:</span>
            <span>
              {metrics.hazardBreakdown.POTHOLE.count} × ${metrics.hazardBreakdown.POTHOLE.avgCost.toFixed(0)} avg
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Debris:</span>
            <span>
              {metrics.hazardBreakdown.DEBRIS.count} × ${metrics.hazardBreakdown.DEBRIS.avgCost.toFixed(0)} avg
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Flooding:</span>
            <span>
              {metrics.hazardBreakdown.FLOODING.count} × ${metrics.hazardBreakdown.FLOODING.avgCost.toFixed(0)} avg
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
