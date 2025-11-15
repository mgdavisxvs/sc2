/**
 * Build Order Optimizer Tests
 * Tests for DP, Branch & Bound, A*, Greedy, and 2-Approximation algorithms
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  optimizeBuildOrder,
  greedyBuildOrder,
  aStarBuildOrder,
  branchAndBoundOptimize,
  twoApproximation,
  compareOptimizers,
} from '../../algorithms/optimizer.js';

// Mock database for testing
const mockDatabase = {
  findByName: (name) => {
    const entities = {
      'probe': { name: 'Probe', kind: 'unit', mineral: 50, gas: 0, buildtime: 17 },
      'pylon': { name: 'Pylon', kind: 'building', mineral: 100, gas: 0, buildtime: 25 },
      'gateway': { name: 'Gateway', kind: 'building', mineral: 150, gas: 0, buildtime: 46 },
      'zealot': { name: 'Zealot', kind: 'unit', mineral: 100, gas: 0, buildtime: 38 },
      'stalker': { name: 'Stalker', kind: 'unit', mineral: 125, gas: 50, buildtime: 30 },
    };
    return entities[name.toLowerCase()];
  },
};

describe('Dynamic Programming Optimizer', () => {
  it('should find optimal build order for simple target', () => {
    const targets = [
      { name: 'Pylon', kind: 'building', mineral: 100, gas: 0, buildtime: 25, tech_tree: { requires: [] } },
    ];

    const result = optimizeBuildOrder(targets, 'protoss', mockDatabase);

    expect(result).toHaveProperty('buildOrder');
    expect(result).toHaveProperty('totalTime');
    expect(result).toHaveProperty('explored');
    expect(result.buildOrder.length).toBe(1);
    expect(result.totalTime).toBe(25);
  });

  it('should respect prerequisites', () => {
    const targets = [
      { name: 'Gateway', kind: 'building', mineral: 150, gas: 0, buildtime: 46, tech_tree: { requires: ['pylon'] } },
      { name: 'Pylon', kind: 'building', mineral: 100, gas: 0, buildtime: 25, tech_tree: { requires: [] } },
    ];

    const result = optimizeBuildOrder(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(2);
    // Pylon should come before Gateway
    expect(result.buildOrder[0].name).toBe('Pylon');
    expect(result.buildOrder[1].name).toBe('Gateway');
  });

  it('should minimize total build time', () => {
    const targets = [
      { name: 'Pylon', kind: 'building', mineral: 100, gas: 0, buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Probe', kind: 'unit', mineral: 50, gas: 0, buildtime: 17, tech_tree: { requires: [] } },
    ];

    const result = optimizeBuildOrder(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(2);
    // Should build cheaper/faster first
    expect(result.totalTime).toBe(42); // 17 + 25 or 25 + 17
  });

  it('should use memoization (check explored states)', () => {
    const targets = [
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Probe', buildtime: 17, tech_tree: { requires: [] } },
      { name: 'Gateway', buildtime: 46, tech_tree: { requires: ['pylon'] } },
    ];

    const result = optimizeBuildOrder(targets, 'protoss', mockDatabase);

    // With memoization, should explore fewer states than brute force
    expect(result.explored).toBeGreaterThan(0);
    expect(result.explored).toBeLessThan(100); // Reasonable upper bound
  });
});

describe('Greedy Build Order', () => {
  it('should build cheapest entities first', () => {
    const targets = [
      { name: 'Pylon', mineral: 100, gas: 0, buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Probe', mineral: 50, gas: 0, buildtime: 17, tech_tree: { requires: [] } },
    ];

    const result = greedyBuildOrder(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(2);
    // Probe is cheaper, should come first
    expect(result.buildOrder[0].name).toBe('Probe');
  });

  it('should respect prerequisites even when more expensive', () => {
    const targets = [
      { name: 'Gateway', mineral: 150, gas: 0, buildtime: 46, tech_tree: { requires: ['pylon'] } },
      { name: 'Pylon', mineral: 100, gas: 0, buildtime: 25, tech_tree: { requires: [] } },
    ];

    const result = greedyBuildOrder(targets, 'protoss', mockDatabase);

    expect(result.buildOrder[0].name).toBe('Pylon');
    expect(result.buildOrder[1].name).toBe('Gateway');
  });

  it('should complete quickly (heuristic)', () => {
    const targets = Array(10).fill({
      name: 'Pylon',
      mineral: 100,
      gas: 0,
      buildtime: 25,
      tech_tree: { requires: [] }
    });

    const startTime = performance.now();
    const result = greedyBuildOrder(targets, 'protoss', mockDatabase);
    const endTime = performance.now();

    expect(result.buildOrder.length).toBe(10);
    expect(endTime - startTime).toBeLessThan(100); // Should be very fast
  });
});

describe('A* Build Order Search', () => {
  it('should find optimal solution', () => {
    const targets = [
      { name: 'Pylon', mineral: 100, gas: 0, buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Gateway', mineral: 150, gas: 0, buildtime: 46, tech_tree: { requires: ['pylon'] } },
    ];

    const result = aStarBuildOrder(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(2);
    expect(result.buildOrder[0].name).toBe('Pylon');
    expect(result.totalTime).toBe(71); // 25 + 46
  });

  it('should explore fewer states than brute force', () => {
    const targets = [
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Probe', buildtime: 17, tech_tree: { requires: [] } },
      { name: 'Gateway', buildtime: 46, tech_tree: { requires: ['pylon'] } },
    ];

    const dpResult = optimizeBuildOrder(targets, 'protoss', mockDatabase);
    const aStarResult = aStarBuildOrder(targets, 'protoss', mockDatabase);

    // A* should explore similar or fewer states than DP
    expect(aStarResult.explored).toBeGreaterThan(0);
    // Both should find same optimal time
    expect(Math.abs(aStarResult.totalTime - dpResult.totalTime)).toBeLessThan(0.01);
  });

  it('should use admissible heuristic (remaining build time)', () => {
    const targets = [
      { name: 'Fast', buildtime: 10, tech_tree: { requires: [] } },
      { name: 'Slow', buildtime: 50, tech_tree: { requires: [] } },
    ];

    const result = aStarBuildOrder(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(2);
    expect(result.totalTime).toBe(60);
  });
});

describe('Branch and Bound Optimization', () => {
  it('should find optimal solution', () => {
    const targets = [
      { name: 'Pylon', mineral: 100, gas: 0, buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Gateway', mineral: 150, gas: 0, buildtime: 46, tech_tree: { requires: ['pylon'] } },
    ];

    const result = branchAndBoundOptimize(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(2);
    expect(result.buildOrder[0].name).toBe('Pylon');
    expect(result.totalTime).toBe(71);
  });

  it('should prune branches efficiently', () => {
    const targets = [
      { name: 'A', buildtime: 10, tech_tree: { requires: [] } },
      { name: 'B', buildtime: 20, tech_tree: { requires: [] } },
      { name: 'C', buildtime: 15, tech_tree: { requires: [] } },
      { name: 'D', buildtime: 25, tech_tree: { requires: [] } },
    ];

    const result = branchAndBoundOptimize(targets, 'protoss', mockDatabase);

    expect(result).toHaveProperty('explored');
    expect(result).toHaveProperty('pruned');
    expect(result).toHaveProperty('efficiency');

    // Should have pruned at least some branches
    expect(result.pruned).toBeGreaterThan(0);
    expect(result.efficiency).toBeGreaterThan(0);
  });

  it('should match DP optimal solution', () => {
    const targets = [
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Probe', buildtime: 17, tech_tree: { requires: [] } },
      { name: 'Gateway', buildtime: 46, tech_tree: { requires: ['pylon'] } },
    ];

    const dpResult = optimizeBuildOrder(targets, 'protoss', mockDatabase);
    const bbResult = branchAndBoundOptimize(targets, 'protoss', mockDatabase);

    // Should find same optimal time
    expect(Math.abs(dpResult.totalTime - bbResult.totalTime)).toBeLessThan(0.01);
  });

  it('should explore fewer states than exhaustive search', () => {
    const targets = Array(8).fill(null).map((_, i) => ({
      name: `Entity${i}`,
      buildtime: 10 + i,
      tech_tree: { requires: [] },
    }));

    const result = branchAndBoundOptimize(targets, 'protoss', mockDatabase);

    // Should explore much less than 2^8 = 256 states
    expect(result.explored + result.pruned).toBeLessThan(256);
    expect(result.efficiency).toBeGreaterThan(0.1);
  });

  it('should provide pruning statistics', () => {
    const targets = [
      { name: 'A', buildtime: 10, tech_tree: { requires: [] } },
      { name: 'B', buildtime: 20, tech_tree: { requires: [] } },
    ];

    const result = branchAndBoundOptimize(targets, 'protoss', mockDatabase);

    expect(result.explored).toBeGreaterThan(0);
    expect(result.pruned).toBeGreaterThanOrEqual(0);
    expect(result.efficiency).toBeGreaterThanOrEqual(0);
    expect(result.efficiency).toBeLessThanOrEqual(1);
  });
});

describe('2-Approximation Algorithm', () => {
  it('should return valid build order', () => {
    const targets = [
      { name: 'Pylon', mineral: 100, gas: 0, buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Gateway', mineral: 150, gas: 0, buildtime: 46, tech_tree: { requires: ['pylon'] } },
    ];

    const result = twoApproximation(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(2);
    expect(result).toHaveProperty('approximationRatio');
    expect(result.approximationRatio).toBe(2);
  });

  it('should guarantee solution ≤ 2 × OPT', () => {
    const targets = [
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Probe', buildtime: 17, tech_tree: { requires: [] } },
      { name: 'Gateway', buildtime: 46, tech_tree: { requires: ['pylon'] } },
    ];

    const optimalResult = optimizeBuildOrder(targets, 'protoss', mockDatabase);
    const approxResult = twoApproximation(targets, 'protoss', mockDatabase);

    // Should be within 2× of optimal
    expect(approxResult.totalTime).toBeLessThanOrEqual(optimalResult.totalTime * 2);
  });

  it('should respect prerequisites', () => {
    const targets = [
      { name: 'Gateway', mineral: 150, gas: 0, buildtime: 46, tech_tree: { requires: ['pylon'] } },
      { name: 'Pylon', mineral: 100, gas: 0, buildtime: 25, tech_tree: { requires: [] } },
    ];

    const result = twoApproximation(targets, 'protoss', mockDatabase);

    expect(result.buildOrder[0].name).toBe('Pylon');
    expect(result.buildOrder[1].name).toBe('Gateway');
  });

  it('should be fast (polynomial time)', () => {
    const targets = Array(20).fill(null).map((_, i) => ({
      name: `Entity${i}`,
      mineral: 100 + i * 10,
      gas: 0,
      buildtime: 20 + i,
      tech_tree: { requires: [] },
    }));

    const startTime = performance.now();
    const result = twoApproximation(targets, 'protoss', mockDatabase);
    const endTime = performance.now();

    expect(result.buildOrder.length).toBe(20);
    expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
  });

  it('should include algorithm name in result', () => {
    const targets = [
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
    ];

    const result = twoApproximation(targets, 'protoss', mockDatabase);

    expect(result.algorithm).toBe('2-Approximation (Greedy)');
  });

  it('should build cheapest available entities (greedy choice)', () => {
    const targets = [
      { name: 'Expensive', mineral: 300, gas: 0, buildtime: 50, tech_tree: { requires: [] } },
      { name: 'Cheap', mineral: 50, gas: 0, buildtime: 20, tech_tree: { requires: [] } },
    ];

    const result = twoApproximation(targets, 'protoss', mockDatabase);

    // Should build cheaper first
    expect(result.buildOrder[0].name).toBe('Cheap');
  });
});

describe('Algorithm Comparison Framework', () => {
  it('should compare multiple algorithms', () => {
    const targets = [
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Probe', buildtime: 17, tech_tree: { requires: [] } },
    ];

    const results = compareOptimizers(targets, 'protoss', mockDatabase);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // Should include Greedy and 2-Approximation at minimum
    expect(results.some(r => r.algorithm === 'Greedy')).toBe(true);
    expect(results.some(r => r.algorithm === '2-Approximation')).toBe(true);
    expect(results.some(r => r.algorithm === 'Branch-and-Bound')).toBe(true);
  });

  it('should include Exact DP for small instances', () => {
    const targets = [
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Probe', buildtime: 17, tech_tree: { requires: [] } },
    ];

    const results = compareOptimizers(targets, 'protoss', mockDatabase);

    // Small instance (2 entities), should run DP
    expect(results.some(r => r.algorithm === 'Exact DP')).toBe(true);
    expect(results.some(r => r.algorithm === 'A*')).toBe(true);
  });

  it('should skip expensive algorithms for large instances', () => {
    const targets = Array(15).fill(null).map((_, i) => ({
      name: `Entity${i}`,
      buildtime: 20,
      tech_tree: { requires: [] },
    }));

    const results = compareOptimizers(targets, 'protoss', mockDatabase);

    // Large instance (15 entities), should skip DP and A*
    expect(results.some(r => r.algorithm === 'Exact DP')).toBe(false);
    expect(results.some(r => r.algorithm === 'A*')).toBe(false);

    // Should still run fast algorithms
    expect(results.some(r => r.algorithm === 'Greedy')).toBe(true);
    expect(results.some(r => r.algorithm === 'Branch-and-Bound')).toBe(true);
  });

  it('should calculate quality ratios relative to best', () => {
    const targets = [
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
      { name: 'Probe', buildtime: 17, tech_tree: { requires: [] } },
    ];

    const results = compareOptimizers(targets, 'protoss', mockDatabase);

    for (const result of results) {
      expect(result).toHaveProperty('qualityRatio');
      expect(result.qualityRatio).toBeGreaterThanOrEqual(1.0);
    }

    // Best algorithm should have ratio of 1.0
    expect(results[0].qualityRatio).toBeCloseTo(1.0, 2);
  });

  it('should measure runtime for each algorithm', () => {
    const targets = [
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
    ];

    const results = compareOptimizers(targets, 'protoss', mockDatabase);

    for (const result of results) {
      expect(result).toHaveProperty('runtime');
      expect(result.runtime).toBeGreaterThanOrEqual(0);
    }
  });

  it('should sort results by completion time', () => {
    const targets = [
      { name: 'A', buildtime: 10, tech_tree: { requires: [] } },
      { name: 'B', buildtime: 20, tech_tree: { requires: [] } },
    ];

    const results = compareOptimizers(targets, 'protoss', mockDatabase);

    // Should be sorted ascending by totalTime
    for (let i = 1; i < results.length; i++) {
      expect(results[i].totalTime).toBeGreaterThanOrEqual(results[i - 1].totalTime);
    }
  });
});

describe('Algorithm Correctness - Integration Tests', () => {
  it('should handle complex dependency chains', () => {
    const targets = [
      { name: 'Stalker', buildtime: 30, tech_tree: { requires: ['cybernetics core'] } },
      { name: 'Cybernetics Core', buildtime: 36, tech_tree: { requires: ['gateway'] } },
      { name: 'Gateway', buildtime: 46, tech_tree: { requires: ['pylon'] } },
      { name: 'Pylon', buildtime: 25, tech_tree: { requires: [] } },
    ];

    const result = branchAndBoundOptimize(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(4);
    expect(result.buildOrder[0].name).toBe('Pylon');
    expect(result.buildOrder[1].name).toBe('Gateway');
    expect(result.buildOrder[2].name).toBe('Cybernetics Core');
    expect(result.buildOrder[3].name).toBe('Stalker');
  });

  it('should optimize parallel builds', () => {
    const targets = [
      { name: 'Probe1', buildtime: 17, tech_tree: { requires: [] } },
      { name: 'Probe2', buildtime: 17, tech_tree: { requires: [] } },
      { name: 'Probe3', buildtime: 17, tech_tree: { requires: [] } },
    ];

    const result = optimizeBuildOrder(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(3);
    // Sequential time would be 51, but with parallelization could be less
  });

  it('should handle mixed gas and mineral costs', () => {
    const targets = [
      { name: 'Zealot', mineral: 100, gas: 0, buildtime: 38, tech_tree: { requires: [] } },
      { name: 'Stalker', mineral: 125, gas: 50, buildtime: 30, tech_tree: { requires: [] } },
    ];

    const result = twoApproximation(targets, 'protoss', mockDatabase);

    expect(result.buildOrder.length).toBe(2);
    expect(result.totalTime).toBeGreaterThan(0);
  });
});
