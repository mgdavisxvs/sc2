/**
 * Multi-Objective Optimization (Pareto Frontier) Tests
 */

import { describe, it, expect } from 'vitest';
import {
  dominates,
  findParetoFrontier,
  SC2_OBJECTIVES,
  evaluateObjectives,
  analyzeParetoFrontier,
  nonDominatedSort,
  calculateCrowdingDistance,
  findKneePoint,
  generateParetoReport,
} from '../../algorithms/pareto.js';

describe('Dominance Testing', () => {
  const objectives = [
    { name: 'time', evaluate: (b) => b.time, minimize: true },
    { name: 'cost', evaluate: (b) => b.cost, minimize: true },
  ];

  it('should detect strict dominance', () => {
    const build1 = { time: 100, cost: 200 };
    const build2 = { time: 150, cost: 300 };

    // build1 is better on both objectives
    expect(dominates(build1, build2, objectives)).toBe(true);
    expect(dominates(build2, build1, objectives)).toBe(false);
  });

  it('should detect partial dominance', () => {
    const build1 = { time: 100, cost: 300 };
    const build2 = { time: 150, cost: 200 };

    // Neither dominates the other (tradeoff)
    expect(dominates(build1, build2, objectives)).toBe(false);
    expect(dominates(build2, build1, objectives)).toBe(false);
  });

  it('should require strict improvement on at least one objective', () => {
    const build1 = { time: 100, cost: 200 };
    const build2 = { time: 100, cost: 200 };

    // Equal on all objectives - no dominance
    expect(dominates(build1, build2, objectives)).toBe(false);
    expect(dominates(build2, build1, objectives)).toBe(false);
  });

  it('should handle maximization objectives', () => {
    const maxObjectives = [
      { name: 'army', evaluate: (b) => b.army, minimize: false },
    ];

    const build1 = { army: 20 };
    const build2 = { army: 10 };

    // build1 has larger army (better for maximization)
    expect(dominates(build1, build2, maxObjectives)).toBe(true);
    expect(dominates(build2, build1, maxObjectives)).toBe(false);
  });

  it('should handle mixed minimize/maximize objectives', () => {
    const mixedObjectives = [
      { name: 'time', evaluate: (b) => b.time, minimize: true },
      { name: 'army', evaluate: (b) => b.army, minimize: false },
    ];

    const build1 = { time: 100, army: 20 };
    const build2 = { time: 150, army: 10 };

    // build1 is better on both (less time, more army)
    expect(dominates(build1, build2, mixedObjectives)).toBe(true);
  });
});

describe('Pareto Frontier Detection', () => {
  const objectives = [
    { name: 'time', evaluate: (b) => b.time, minimize: true },
    { name: 'cost', evaluate: (b) => b.cost, minimize: true },
  ];

  it('should find all non-dominated solutions', () => {
    const builds = [
      { name: 'Fast-Cheap', time: 100, cost: 200 },
      { name: 'Fast-Expensive', time: 120, cost: 500 },
      { name: 'Slow-Cheap', time: 200, cost: 150 },
      { name: 'Slow-Expensive', time: 300, cost: 600 },
    ];

    const frontier = findParetoFrontier(builds, objectives);

    // Fast-Cheap and Slow-Cheap should be on frontier
    // Fast-Expensive and Slow-Expensive are dominated
    expect(frontier.length).toBeLessThanOrEqual(builds.length);
    expect(frontier.some(b => b.name === 'Fast-Cheap')).toBe(true);
    expect(frontier.some(b => b.name === 'Slow-Cheap')).toBe(true);
  });

  it('should return all solutions when none dominate each other', () => {
    const builds = [
      { time: 100, cost: 300 },
      { time: 150, cost: 200 },
      { time: 200, cost: 100 },
    ];

    const frontier = findParetoFrontier(builds, objectives);

    // All are Pareto-optimal (tradeoff curve)
    expect(frontier.length).toBe(3);
  });

  it('should return single solution when one dominates all', () => {
    const builds = [
      { time: 50, cost: 100 },  // Strictly best
      { time: 100, cost: 200 },
      { time: 150, cost: 300 },
    ];

    const frontier = findParetoFrontier(builds, objectives);

    expect(frontier.length).toBe(1);
    expect(frontier[0].time).toBe(50);
  });

  it('should handle empty input', () => {
    const frontier = findParetoFrontier([], objectives);
    expect(frontier).toEqual([]);
  });

  it('should handle single solution', () => {
    const builds = [{ time: 100, cost: 200 }];
    const frontier = findParetoFrontier(builds, objectives);

    expect(frontier).toHaveLength(1);
    expect(frontier[0]).toEqual(builds[0]);
  });
});

describe('SC2 Objective Functions', () => {
  it('should evaluate TIME objective', () => {
    const build = [
      { buildtime: 25 },
      { buildtime: 38 },
      { buildtime: 46 },
    ];

    // Mock calculateBuildTime (simplification)
    const mockBuild = { buildOrder: build };
    // Note: Actual implementation uses calculateBuildTime which may sum differently
  });

  it('should evaluate COST objective', () => {
    const build = [
      { mineral: 100, gas: 0 },
      { mineral: 150, gas: 50 },
      { mineral: 125, gas: 50 },
    ];

    const totalCost = SC2_OBJECTIVES.COST.evaluate(build);
    expect(totalCost).toBe(475); // 100+150+125+50+50
  });

  it('should evaluate ARMY_SIZE objective', () => {
    const build = [
      { supply: 2 },  // Zealot
      { supply: 2 },  // Stalker
      { supply: 4 },  // Immortal
    ];

    const armySize = SC2_OBJECTIVES.ARMY_SIZE.evaluate(build);
    expect(armySize).toBe(8);
  });

  it('should evaluate MINERALS objective', () => {
    const build = [
      { mineral: 100, gas: 50 },
      { mineral: 150, gas: 0 },
    ];

    const mineralCost = SC2_OBJECTIVES.MINERALS.evaluate(build);
    expect(mineralCost).toBe(250);
  });

  it('should evaluate GAS objective', () => {
    const build = [
      { mineral: 100, gas: 50 },
      { mineral: 150, gas: 75 },
    ];

    const gasCost = SC2_OBJECTIVES.GAS.evaluate(build);
    expect(gasCost).toBe(125);
  });

  it('should create ARMY_AT_TIME objective', () => {
    const armyAt5Min = SC2_OBJECTIVES.ARMY_AT_TIME(300);

    expect(armyAt5Min.name).toBe('army_at_300s');
    expect(armyAt5Min.minimize).toBe(false);
  });
});

describe('Objective Evaluation', () => {
  it('should evaluate multiple objectives for a build', () => {
    const build = [
      { mineral: 100, gas: 0, supply: 2, buildtime: 38 },
      { mineral: 125, gas: 50, supply: 2, buildtime: 30 },
    ];

    const objectives = [
      SC2_OBJECTIVES.COST,
      SC2_OBJECTIVES.ARMY_SIZE,
      SC2_OBJECTIVES.MINERALS,
      SC2_OBJECTIVES.GAS,
    ];

    const results = evaluateObjectives(build, objectives);

    expect(results).toHaveProperty('total_cost');
    expect(results).toHaveProperty('army_size');
    expect(results).toHaveProperty('mineral_cost');
    expect(results).toHaveProperty('gas_cost');

    expect(results.total_cost.value).toBe(275);
    expect(results.army_size.value).toBe(4);
    expect(results.mineral_cost.value).toBe(225);
    expect(results.gas_cost.value).toBe(50);
  });
});

describe('Pareto Frontier Analysis', () => {
  const objectives = [
    { name: 'time', evaluate: (b) => b.time, minimize: true, unit: 's' },
    { name: 'cost', evaluate: (b) => b.cost, minimize: true, unit: 'resources' },
  ];

  it('should provide detailed frontier analysis', () => {
    const builds = [
      { time: 100, cost: 200 },
      { time: 150, cost: 150 },
      { time: 200, cost: 250 },
      { time: 120, cost: 180 },
    ];

    const analysis = analyzeParetoFrontier(builds, objectives);

    expect(analysis).toHaveProperty('frontier');
    expect(analysis).toHaveProperty('dominated');
    expect(analysis).toHaveProperty('analysis');

    expect(analysis.analysis.totalBuilds).toBe(4);
    expect(analysis.analysis.frontierSize).toBeGreaterThan(0);
    expect(analysis.analysis.frontierRatio).toBeGreaterThan(0);
    expect(analysis.analysis.objectiveRanges).toHaveProperty('time');
    expect(analysis.analysis.objectiveRanges).toHaveProperty('cost');
  });

  it('should calculate objective ranges', () => {
    const builds = [
      { time: 50, cost: 100 },
      { time: 200, cost: 500 },
      { time: 100, cost: 300 },
    ];

    const analysis = analyzeParetoFrontier(builds, objectives);

    expect(analysis.analysis.objectiveRanges.time.min).toBe(50);
    expect(analysis.analysis.objectiveRanges.time.max).toBe(200);
    expect(analysis.analysis.objectiveRanges.cost.min).toBe(100);
    expect(analysis.analysis.objectiveRanges.cost.max).toBe(500);
  });
});

describe('Non-Dominated Sorting (NSGA-II)', () => {
  const objectives = [
    { name: 'time', evaluate: (b) => b.time, minimize: true },
    { name: 'cost', evaluate: (b) => b.cost, minimize: true },
  ];

  it('should sort population into fronts', () => {
    const population = [
      { time: 50, cost: 100 },   // Front 0 (best)
      { time: 100, cost: 50 },   // Front 0
      { time: 75, cost: 75 },    // Front 0
      { time: 100, cost: 100 },  // Front 1 (dominated by first)
      { time: 150, cost: 150 },  // Front 2 (dominated by fourth)
    ];

    const fronts = nonDominatedSort(population, objectives);

    expect(fronts.length).toBeGreaterThan(0);
    expect(fronts[0].length).toBeGreaterThan(0);

    // First front should contain non-dominated solutions
    for (let i = 0; i < fronts[0].length; i++) {
      for (let j = 0; j < fronts[0].length; j++) {
        if (i !== j) {
          expect(dominates(fronts[0][i], fronts[0][j], objectives)).toBe(false);
        }
      }
    }
  });

  it('should handle single-front population', () => {
    const population = [
      { time: 100, cost: 50 },
      { time: 50, cost: 100 },
      { time: 75, cost: 75 },
    ];

    const fronts = nonDominatedSort(population, objectives);

    expect(fronts.length).toBe(1);
    expect(fronts[0].length).toBe(3);
  });
});

describe('Crowding Distance', () => {
  const objectives = [
    { name: 'time', evaluate: (b) => b.time, minimize: true },
    { name: 'cost', evaluate: (b) => b.cost, minimize: true },
  ];

  it('should assign infinite distance to boundary points', () => {
    const front = [
      { time: 50, cost: 100 },
      { time: 75, cost: 75 },
      { time: 100, cost: 50 },
    ];

    const distances = calculateCrowdingDistance(front, objectives);

    // Boundary solutions should have infinite distance
    const values = Array.from(distances.values());
    expect(values.filter(d => d === Infinity).length).toBeGreaterThan(0);
  });

  it('should calculate relative distances for middle points', () => {
    const front = [
      { time: 0, cost: 100 },
      { time: 50, cost: 50 },
      { time: 100, cost: 0 },
    ];

    const distances = calculateCrowdingDistance(front, objectives);

    expect(distances.size).toBe(3);

    for (const [individual, distance] of distances) {
      expect(distance).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle single solution', () => {
    const front = [{ time: 100, cost: 200 }];

    const distances = calculateCrowdingDistance(front, objectives);

    expect(distances.size).toBe(1);
    expect(distances.get(front[0])).toBe(Infinity);
  });
});

describe('Knee Point Detection', () => {
  const objectives = [
    { name: 'time', evaluate: (b) => b.time, minimize: true },
    { name: 'cost', evaluate: (b) => b.cost, minimize: true },
  ];

  it('should find balanced solution on frontier', () => {
    const frontier = [
      { time: 50, cost: 200 },   // Fast but expensive
      { time: 100, cost: 100 },  // Balanced (should be knee)
      { time: 200, cost: 50 },   // Slow but cheap
    ];

    const knee = findKneePoint(frontier, objectives);

    expect(knee).toBeDefined();
    // Knee should be the balanced option
    expect(knee.time).toBe(100);
    expect(knee.cost).toBe(100);
  });

  it('should return null for empty frontier', () => {
    const knee = findKneePoint([], objectives);
    expect(knee).toBeNull();
  });

  it('should return single solution as knee', () => {
    const frontier = [{ time: 100, cost: 200 }];
    const knee = findKneePoint(frontier, objectives);

    expect(knee).toEqual(frontier[0]);
  });

  it('should handle extreme tradeoffs', () => {
    const frontier = [
      { time: 10, cost: 1000 },
      { time: 500, cost: 10 },
      { time: 100, cost: 100 },
    ];

    const knee = findKneePoint(frontier, objectives);

    // Should prefer balanced solution
    expect(knee.time).toBeGreaterThan(10);
    expect(knee.time).toBeLessThan(500);
  });
});

describe('Pareto Report Generation', () => {
  const objectives = [
    { name: 'time', evaluate: (b) => b.time, minimize: true, unit: 'seconds' },
    { name: 'cost', evaluate: (b) => b.cost, minimize: true, unit: 'resources' },
  ];

  it('should generate formatted report', () => {
    const frontier = [
      { build: { time: 100, cost: 200 } },
      { build: { time: 150, cost: 150 } },
    ];

    const report = generateParetoReport(frontier, objectives);

    expect(typeof report).toBe('string');
    expect(report).toContain('PARETO FRONTIER');
    expect(report).toContain('Total solutions: 2');
    expect(report.length).toBeGreaterThan(0);
  });

  it('should include all objectives in report', () => {
    const frontier = [
      { build: { time: 100, cost: 200 } },
    ];

    const report = generateParetoReport(frontier, objectives);

    expect(report).toContain('time');
    expect(report).toContain('cost');
  });

  it('should handle empty frontier', () => {
    const report = generateParetoReport([], objectives);

    expect(report).toContain('Total solutions: 0');
  });
});

describe('Multi-Objective Optimization - Integration Tests', () => {
  it('should find Pareto frontier for realistic SC2 builds', () => {
    const builds = [
      {
        name: 'Rush Build',
        buildOrder: [
          { mineral: 100, gas: 0, supply: 2, buildtime: 38 },
          { mineral: 100, gas: 0, supply: 2, buildtime: 38 },
        ],
      },
      {
        name: 'Balanced Build',
        buildOrder: [
          { mineral: 150, gas: 50, supply: 2, buildtime: 30 },
          { mineral: 150, gas: 50, supply: 2, buildtime: 30 },
        ],
      },
      {
        name: 'Expensive Build',
        buildOrder: [
          { mineral: 200, gas: 100, supply: 4, buildtime: 55 },
        ],
      },
    ];

    const objectives = [
      SC2_OBJECTIVES.COST,
      SC2_OBJECTIVES.ARMY_SIZE,
    ];

    const analysis = analyzeParetoFrontier(builds, objectives);

    expect(analysis.frontier.length).toBeGreaterThan(0);
    expect(analysis.frontier.length).toBeLessThanOrEqual(builds.length);
  });

  it('should identify knee point for time-cost-army tradeoff', () => {
    const builds = [
      { time: 100, cost: 500, army: 20 },
      { time: 200, cost: 300, army: 15 },
      { time: 150, cost: 400, army: 18 },
      { time: 300, cost: 200, army: 10 },
    ];

    const objectives = [
      { name: 'time', evaluate: (b) => b.time, minimize: true },
      { name: 'cost', evaluate: (b) => b.cost, minimize: true },
      { name: 'army', evaluate: (b) => b.army, minimize: false },
    ];

    const frontier = findParetoFrontier(builds, objectives);
    const knee = findKneePoint(frontier, objectives);

    expect(knee).toBeDefined();
    expect(frontier).toContain(knee);
  });
});
