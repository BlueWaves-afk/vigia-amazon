// Cost calculation utilities for maintenance reports

interface CostConfig {
  baseCosts: Record<string, number>;
  severityMultiplier: number;
  preventedDamageAverages: Record<string, number>;
}

const DEFAULT_CONFIG: CostConfig = {
  baseCosts: {
    POTHOLE: 150,
    DEBRIS: 50,
    FLOODING: 1000,
    ACCIDENT: 0, // Not repairable
  },
  severityMultiplier: 0.2, // 20% increase per severity level
  preventedDamageAverages: {
    POTHOLE: 300, // Average vehicle damage per pothole incident
    DEBRIS: 150,
    FLOODING: 2000,
    ACCIDENT: 5000,
  },
};

export function calculateRepairCost(
  type: string,
  severity: number,
  config: CostConfig = DEFAULT_CONFIG
): number {
  const baseCost = config.baseCosts[type] || 0;
  return Math.round(baseCost * (1 + severity * config.severityMultiplier));
}

export function calculatePreventedDamage(
  type: string,
  config: CostConfig = DEFAULT_CONFIG
): number {
  return config.preventedDamageAverages[type] || 0;
}

export function calculateROI(
  totalRepairCost: number,
  totalPreventedDamage: number
): number {
  if (totalRepairCost === 0) return 0;
  return Number((totalPreventedDamage / totalRepairCost).toFixed(2));
}
