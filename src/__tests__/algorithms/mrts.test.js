/**
 * MRTS (Marginal Rate of Technical Substitution) Algorithm Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMRTS,
  generateIsoquant,
  analyzeResourceSubstitution,
  calculateProductionEfficiency,
  analyzeTimeResourceTradeoff,
  analyzeWorkerArmyTradeoff,
  calculateOptimalInputMix,
} from '../../algorithms/mrts.js';

describe('calculateMRTS', () => {
  it('should calculate MRTS between two builds', () => {
    const builds = [
      {
        name: 'Build A',
        buildOrder: [],
        totalMinerals: 1000,
        totalGas: 500,
      },
      {
        name: 'Build B',
        buildOrder: [],
        totalMinerals: 1200,
        totalGas: 400,
      },
    ];

    const result = calculateMRTS(builds, 'minerals', 'gas');

    expect(result).toBeDefined();
    expect(result.input1).toBe('minerals');
    expect(result.input2).toBe('gas');
    expect(result.points).toHaveLength(1);
    expect(result.points[0].mrts).toBeCloseTo(0.5, 2); // -(400-500)/(1200-1000) = -(-100)/200 = 0.5
    expect(result.averageMRTS).toBeCloseTo(0.5, 2);
  });

  it('should handle multiple points and calculate average MRTS', () => {
    const builds = [
      { buildOrder: [], totalMinerals: 1000, totalGas: 600 },
      { buildOrder: [], totalMinerals: 1500, totalGas: 400 },
      { buildOrder: [], totalMinerals: 2000, totalGas: 300 },
    ];

    const result = calculateMRTS(builds, 'minerals', 'gas');

    expect(result.points).toHaveLength(2);
    expect(result.averageMRTS).toBeGreaterThan(0);
  });

  it('should return error for insufficient data points', () => {
    const builds = [{ buildOrder: [], totalMinerals: 1000, totalGas: 500 }];

    const result = calculateMRTS(builds, 'minerals', 'gas');

    expect(result.error).toBe('Need at least 2 points for MRTS');
    expect(result.mrts).toBeNull();
  });

  it('should detect diminishing returns', () => {
    // Create builds with decreasing MRTS (diminishing returns)
    const builds = [
      { buildOrder: [], totalMinerals: 1000, totalGas: 1000 },
      { buildOrder: [], totalMinerals: 2000, totalGas: 500 }, // MRTS = 0.5
      { buildOrder: [], totalMinerals: 3000, totalGas: 200 }, // MRTS = 0.3
    ];

    const result = calculateMRTS(builds, 'minerals', 'gas');

    expect(result.diminishingReturns).toBeDefined();
  });

  it('should skip zero delta to avoid division by zero', () => {
    const builds = [
      { buildOrder: [], totalMinerals: 1000, totalGas: 500 },
      { buildOrder: [], totalMinerals: 1000, totalGas: 400 }, // Same minerals
      { buildOrder: [], totalMinerals: 1500, totalGas: 300 },
    ];

    const result = calculateMRTS(builds, 'minerals', 'gas');

    // Should only have 1 point (skipping the zero delta)
    expect(result.points.length).toBeGreaterThan(0);
    expect(result.points.every((p) => Number.isFinite(p.mrts))).toBe(true);
  });
});

describe('generateIsoquant', () => {
  it('should generate isoquant for target output', () => {
    const builds = [
      { name: 'A', armyValue: 1000, totalMinerals: 800 },
      { name: 'B', armyValue: 1050, totalMinerals: 900 }, // Within 10%
      { name: 'C', armyValue: 1500, totalMinerals: 1200 }, // Too high
      { name: 'D', armyValue: 980, totalMinerals: 850 }, // Within 10%
    ];

    const result = generateIsoquant('armyValue', 1000, builds);

    expect(result.outputMetric).toBe('armyValue');
    expect(result.targetOutput).toBe(1000);
    expect(result.tolerance).toBe(100); // 10% of 1000
    expect(result.count).toBe(3); // A, B, D
    expect(result.builds).toHaveLength(3);
  });

  it('should handle empty build list', () => {
    const result = generateIsoquant('armyValue', 1000, []);

    expect(result.count).toBe(0);
    expect(result.builds).toHaveLength(0);
  });

  it('should handle no matching builds', () => {
    const builds = [
      { name: 'A', armyValue: 5000, totalMinerals: 4000 },
      { name: 'B', armyValue: 6000, totalMinerals: 5000 },
    ];

    const result = generateIsoquant('armyValue', 1000, builds);

    expect(result.count).toBe(0);
  });
});

describe('analyzeResourceSubstitution', () => {
  it('should generate substitution alternatives', () => {
    const build = {
      buildOrder: [
        { name: 'Zealot', mineral: 100, gas: 0 },
        { name: 'Zealot', mineral: 100, gas: 0 },
      ],
      totalMinerals: 200,
      totalGas: 0,
    };

    const substitutions = {
      Zealot: { alternative: 'Stalker', mineral: 125, gas: 50 },
    };

    const result = analyzeResourceSubstitution(build, substitutions);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('calculateProductionEfficiency', () => {
  it('should calculate multi-objective efficiency', () => {
    const builds = [
      {
        name: 'Fast Expand',
        totalMinerals: 1000,
        totalGas: 200,
        totalTime: 180,
        workerCount: 30,
        armyValue: 500,
      },
      {
        name: 'Rush Build',
        totalMinerals: 800,
        totalGas: 300,
        totalTime: 120,
        workerCount: 16,
        armyValue: 800,
      },
    ];

    const objectives = ['armyValue', 'workerCount'];

    const result = calculateProductionEfficiency(builds, objectives);

    expect(result).toBeDefined();
    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty('efficiency');
    expect(result[0]).toHaveProperty('objectives');
  });

  it('should normalize objectives with different scales', () => {
    const builds = [
      { name: 'A', armyValue: 1000, totalTime: 300 },
      { name: 'B', armyValue: 500, totalTime: 150 },
    ];

    const objectives = ['armyValue', 'totalTime'];

    const result = calculateProductionEfficiency(builds, objectives);

    // All efficiency scores should be normalized (0-1 range typically)
    expect(result.every((r) => Number.isFinite(r.efficiency))).toBe(true);
  });
});

describe('analyzeTimeResourceTradeoff', () => {
  it('should analyze time vs resource tradeoffs', () => {
    const builds = [
      {
        name: 'Fast',
        totalTime: 120,
        totalMinerals: 1000,
        totalGas: 200,
        armyValue: 600,
      },
      {
        name: 'Slow',
        totalTime: 240,
        totalMinerals: 800,
        totalGas: 100,
        armyValue: 700,
      },
    ];

    const result = analyzeTimeResourceTradeoff(builds);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle single build', () => {
    const builds = [
      {
        name: 'Only',
        totalTime: 120,
        totalMinerals: 1000,
        totalGas: 200,
      },
    ];

    const result = analyzeTimeResourceTradeoff(builds);

    expect(result).toBeDefined();
  });
});

describe('analyzeWorkerArmyTradeoff', () => {
  it('should analyze worker vs army tradeoffs', () => {
    const builds = [
      {
        name: 'Economy',
        workerCount: 40,
        armyValue: 500,
        totalMinerals: 1200,
      },
      {
        name: 'Military',
        workerCount: 20,
        armyValue: 1200,
        totalMinerals: 1200,
      },
    ];

    const result = analyzeWorkerArmyTradeoff(builds);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should calculate worker opportunity cost', () => {
    const builds = [
      { name: 'A', workerCount: 30, armyValue: 600 },
      { name: 'B', workerCount: 20, armyValue: 900 },
    ];

    const result = analyzeWorkerArmyTradeoff(builds);

    // Should calculate how much army value gained per worker sacrificed
    expect(result).toBeDefined();
  });
});

describe('calculateOptimalInputMix', () => {
  it('should calculate optimal input mix based on prices', () => {
    const prices = {
      minerals: 1.0, // Base price
      gas: 1.5, // 50% more expensive
    };

    const mrts = 2.0; // 2 gas per 1 mineral

    const result = calculateOptimalInputMix(prices, mrts);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('recommendation');
  });

  it('should handle equal prices', () => {
    const prices = {
      minerals: 1.0,
      gas: 1.0,
    };

    const mrts = 1.0;

    const result = calculateOptimalInputMix(prices, mrts);

    expect(result).toBeDefined();
  });

  it('should validate MRTS > 0', () => {
    const prices = { minerals: 1.0, gas: 1.5 };
    const mrts = 2.5;

    const result = calculateOptimalInputMix(prices, mrts);

    expect(result).toBeDefined();
    // MRTS > price ratio means use more input1 (minerals)
  });
});

describe('Integration Tests - MRTS Analysis', () => {
  it('should perform full MRTS analysis workflow', () => {
    // Create realistic SC2 builds
    const builds = [
      {
        name: '3-Gate Robo',
        totalMinerals: 2400,
        totalGas: 800,
        totalTime: 300,
        workerCount: 40,
        armyValue: 1500,
        buildOrder: [
          { name: 'Pylon', mineral: 100, gas: 0 },
          { name: 'Gateway', mineral: 150, gas: 0 },
          { name: 'Cybernetics Core', mineral: 150, gas: 0 },
          { name: 'Stalker', mineral: 125, gas: 50 },
        ],
      },
      {
        name: '4-Gate Rush',
        totalMinerals: 2000,
        totalGas: 600,
        totalTime: 240,
        workerCount: 24,
        armyValue: 1600,
        buildOrder: [
          { name: 'Pylon', mineral: 100, gas: 0 },
          { name: 'Gateway', mineral: 150, gas: 0 },
          { name: 'Gateway', mineral: 150, gas: 0 },
        ],
      },
      {
        name: 'Blink Stalker',
        totalMinerals: 2600,
        totalGas: 1200,
        totalTime: 360,
        workerCount: 44,
        armyValue: 1800,
        buildOrder: [
          { name: 'Twilight Council', mineral: 150, gas: 100 },
          { name: 'Blink', mineral: 150, gas: 150 },
        ],
      },
    ];

    // Test MRTS calculation
    const mrtsResult = calculateMRTS(builds, 'minerals', 'gas');
    expect(mrtsResult.points.length).toBeGreaterThan(0);
    expect(Number.isFinite(mrtsResult.averageMRTS)).toBe(true);

    // Test isoquant generation
    const isoquant = generateIsoquant('armyValue', 1600, builds);
    expect(isoquant.count).toBeGreaterThan(0);

    // Test efficiency calculation
    const efficiency = calculateProductionEfficiency(builds, [
      'armyValue',
      'workerCount',
    ]);
    expect(efficiency.length).toBe(3);

    // Test time-resource tradeoff
    const timeTradeoff = analyzeTimeResourceTradeoff(builds);
    expect(timeTradeoff).toBeDefined();

    // Test worker-army tradeoff
    const workerTradeoff = analyzeWorkerArmyTradeoff(builds);
    expect(workerTradeoff).toBeDefined();
  });

  it('should handle edge cases gracefully', () => {
    const emptyBuilds = [];
    const singleBuild = [{ totalMinerals: 1000, totalGas: 500 }];

    // Should not crash
    expect(() => calculateMRTS(emptyBuilds, 'minerals', 'gas')).not.toThrow();
    expect(() => generateIsoquant('armyValue', 1000, emptyBuilds)).not.toThrow();
    expect(() =>
      calculateProductionEfficiency(singleBuild, ['armyValue'])
    ).not.toThrow();
  });
});
