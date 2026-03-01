import { describe, it, expect } from '@jest/globals';

const BASE_COSTS: Record<string, number> = {
  POTHOLE: 150,
  DEBRIS: 50,
  FLOODING: 1000,
  ACCIDENT: 0,
};

function calculateRepairCost(type: string, severity: number): number {
  const baseCost = BASE_COSTS[type] || 0;
  return Math.round(baseCost * (1 + severity * 0.2));
}

describe('Cost Calculator', () => {
  it('should calculate pothole repair cost correctly', () => {
    expect(calculateRepairCost('POTHOLE', 1)).toBe(180); // 150 * 1.2
    expect(calculateRepairCost('POTHOLE', 3)).toBe(240); // 150 * 1.6
    expect(calculateRepairCost('POTHOLE', 5)).toBe(300); // 150 * 2.0
  });

  it('should calculate debris repair cost correctly', () => {
    expect(calculateRepairCost('DEBRIS', 1)).toBe(60); // 50 * 1.2
    expect(calculateRepairCost('DEBRIS', 3)).toBe(80); // 50 * 1.6
  });

  it('should calculate flooding repair cost correctly', () => {
    expect(calculateRepairCost('FLOODING', 1)).toBe(1200); // 1000 * 1.2
    expect(calculateRepairCost('FLOODING', 5)).toBe(2000); // 1000 * 2.0
  });

  it('should return 0 for accident type', () => {
    expect(calculateRepairCost('ACCIDENT', 5)).toBe(0);
  });

  it('should handle unknown hazard types', () => {
    expect(calculateRepairCost('UNKNOWN', 3)).toBe(0);
  });

  it('should scale linearly with severity', () => {
    const cost1 = calculateRepairCost('POTHOLE', 1);
    const cost2 = calculateRepairCost('POTHOLE', 2);
    const cost3 = calculateRepairCost('POTHOLE', 3);
    
    expect(cost2 - cost1).toBe(30); // 20% of 150
    expect(cost3 - cost2).toBe(30); // 20% of 150
  });
});
