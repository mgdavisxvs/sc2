/**
 * Build Comparison Algorithm Tests
 */

import { describe, it, expect } from 'vitest';
import {
  compareBuilds,
  findCommonOpening,
  calculateSimilarity,
} from '../../algorithms/build-comparison.js';

describe('compareBuilds', () => {
  it('should compare two builds successfully', () => {
    const builds = [
      {
        id: '1',
        name: '3-Gate Robo',
        race: 'Protoss',
        description: 'Standard macro build',
        buildOrder: [
          { name: 'Pylon', mineral: 100, gas: 0, supply: 0, kind: 'building', buildtime: 25 },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 65 },
          { name: 'Cybernetics Core', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 50 },
          { name: 'Stalker', mineral: 125, gas: 50, supply: 2, kind: 'unit', buildtime: 42 },
        ],
      },
      {
        id: '2',
        name: '4-Gate Rush',
        race: 'Protoss',
        description: 'Aggressive early game',
        buildOrder: [
          { name: 'Pylon', mineral: 100, gas: 0, supply: 0, kind: 'building', buildtime: 25 },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 65 },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 65 },
          { name: 'Zealot', mineral: 100, gas: 0, supply: 2, kind: 'unit', buildtime: 38 },
        ],
      },
    ];

    const result = compareBuilds(builds);

    expect(result).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.builds).toHaveLength(2);
    expect(result.diff).toBeDefined();
    expect(result.efficiency).toBeDefined();
    expect(result.recommendations).toBeDefined();
    expect(result.timings).toBeDefined();
  });

  it('should return error for insufficient builds', () => {
    const result = compareBuilds([{ name: 'Single Build' }]);

    expect(result.error).toBe('Need at least 2 builds to compare');
  });

  it('should return error for empty input', () => {
    const result = compareBuilds([]);

    expect(result.error).toBe('Need at least 2 builds to compare');
  });

  it('should calculate build metrics correctly', () => {
    const builds = [
      {
        id: '1',
        name: 'Test Build',
        race: 'Protoss',
        buildOrder: [
          { name: 'Probe', mineral: 50, gas: 0, supply: 1, kind: 'unit' },
          { name: 'Pylon', mineral: 100, gas: 0, supply: 0, kind: 'building' },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building' },
          { name: 'Zealot', mineral: 100, gas: 0, supply: 2, kind: 'unit' },
        ],
      },
      {
        id: '2',
        name: 'Another Build',
        race: 'Protoss',
        buildOrder: [
          { name: 'Probe', mineral: 50, gas: 0, supply: 1, kind: 'unit' },
        ],
      },
    ];

    const result = compareBuilds(builds);

    expect(result.builds[0].totalMinerals).toBe(400); // 50+100+150+100
    expect(result.builds[0].totalGas).toBe(0);
    expect(result.builds[0].units).toBe(2); // Probe, Zealot
    expect(result.builds[0].buildings).toBe(2); // Pylon, Gateway
    expect(result.builds[0].workers).toBe(1); // Probe
    expect(result.builds[0].army).toBe(1); // Zealot
  });

  it('should detect build sequence differences', () => {
    const builds = [
      {
        name: 'Build A',
        buildOrder: [
          { name: 'Pylon' },
          { name: 'Gateway' },
          { name: 'Cybernetics Core' },
        ],
      },
      {
        name: 'Build B',
        buildOrder: [
          { name: 'Pylon' },
          { name: 'Gateway' },
          { name: 'Forge' }, // Different
        ],
      },
    ];

    const result = compareBuilds(builds);

    expect(result.diff).toBeDefined();
    expect(result.diff.differences).toBeDefined();
    expect(result.diff.differences.length).toBeGreaterThan(0);
  });

  it('should calculate efficiency rankings', () => {
    const builds = [
      {
        name: 'Fast',
        buildOrder: [
          { name: 'Zealot', mineral: 100, gas: 0, supply: 2, kind: 'unit', buildtime: 38 },
        ],
      },
      {
        name: 'Slow',
        buildOrder: [
          { name: 'Stalker', mineral: 125, gas: 50, supply: 2, kind: 'unit', buildtime: 42 },
          { name: 'Stalker', mineral: 125, gas: 50, supply: 2, kind: 'unit', buildtime: 42 },
        ],
      },
    ];

    const result = compareBuilds(builds);

    expect(result.efficiency).toBeDefined();
    expect(result.efficiency.rankings).toBeDefined();
    expect(result.efficiency.winner).toBeDefined();
  });

  it('should generate comparison recommendations', () => {
    const builds = [
      {
        name: 'Build A',
        buildOrder: [
          { name: 'Probe', mineral: 50, gas: 0, kind: 'unit' },
          { name: 'Zealot', mineral: 100, gas: 0, kind: 'unit' },
        ],
      },
      {
        name: 'Build B',
        buildOrder: [
          { name: 'Probe', mineral: 50, gas: 0, kind: 'unit' },
          { name: 'Stalker', mineral: 125, gas: 50, kind: 'unit' },
        ],
      },
    ];

    const result = compareBuilds(builds);

    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('should compare timings across builds', () => {
    const builds = [
      {
        name: 'Early Rush',
        buildOrder: [
          { name: 'Zealot', mineral: 100, gas: 0, buildtime: 180, kind: 'unit' },
          { name: 'Zealot', mineral: 100, gas: 0, buildtime: 220, kind: 'unit' },
        ],
      },
      {
        name: 'Late Game',
        buildOrder: [
          { name: 'Stalker', mineral: 125, gas: 50, buildtime: 300, kind: 'unit' },
        ],
      },
    ];

    const result = compareBuilds(builds);

    expect(result.timings).toBeDefined();
  });
});

describe('findCommonOpening', () => {
  it('should find common opening sequence', () => {
    const builds = [
      {
        name: 'Build A',
        buildOrder: [
          { name: 'Pylon' },
          { name: 'Gateway' },
          { name: 'Cybernetics Core' },
          { name: 'Stalker' },
        ],
      },
      {
        name: 'Build B',
        buildOrder: [
          { name: 'Pylon' },
          { name: 'Gateway' },
          { name: 'Assimilator' }, // Diverges here
          { name: 'Zealot' },
        ],
      },
    ];

    const result = findCommonOpening(builds);

    expect(result).toBeDefined();
    expect(result.common).toBeDefined();
    expect(result.common.length).toBe(2); // Pylon, Gateway
    expect(result.divergencePoint).toBe(2);
  });

  it('should handle builds with no common opening', () => {
    const builds = [
      {
        name: 'Build A',
        buildOrder: [{ name: 'Pylon' }],
      },
      {
        name: 'Build B',
        buildOrder: [{ name: 'Gateway' }],
      },
    ];

    const result = findCommonOpening(builds);

    expect(result).toBeDefined();
    expect(result.common.length).toBe(0);
    expect(result.divergencePoint).toBe(0);
  });

  it('should handle empty build orders', () => {
    const builds = [
      { name: 'Empty A', buildOrder: [] },
      { name: 'Empty B', buildOrder: [] },
    ];

    const result = findCommonOpening(builds);

    expect(result).toBeDefined();
    expect(result.common.length).toBe(0);
  });

  it('should find full common sequence if builds are identical', () => {
    const buildOrder = [
      { name: 'Pylon' },
      { name: 'Gateway' },
      { name: 'Cybernetics Core' },
    ];

    const builds = [
      { name: 'Build A', buildOrder: [...buildOrder] },
      { name: 'Build B', buildOrder: [...buildOrder] },
    ];

    const result = findCommonOpening(builds);

    expect(result.common.length).toBe(3);
  });
});

describe('calculateSimilarity', () => {
  it('should calculate similarity between identical builds', () => {
    const build1 = {
      buildOrder: [
        { name: 'Pylon' },
        { name: 'Gateway' },
        { name: 'Zealot' },
      ],
    };

    const build2 = {
      buildOrder: [
        { name: 'Pylon' },
        { name: 'Gateway' },
        { name: 'Zealot' },
      ],
    };

    const similarity = calculateSimilarity(build1, build2);

    expect(similarity).toBeCloseTo(1.0, 2); // Perfect similarity
  });

  it('should calculate similarity between completely different builds', () => {
    const build1 = {
      buildOrder: [
        { name: 'Pylon' },
        { name: 'Gateway' },
      ],
    };

    const build2 = {
      buildOrder: [
        { name: 'Barracks' },
        { name: 'Marine' },
      ],
    };

    const similarity = calculateSimilarity(build1, build2);

    expect(similarity).toBeCloseTo(0.0, 2); // No similarity
  });

  it('should calculate similarity between partially similar builds', () => {
    const build1 = {
      buildOrder: [
        { name: 'Pylon' },
        { name: 'Gateway' },
        { name: 'Zealot' },
      ],
    };

    const build2 = {
      buildOrder: [
        { name: 'Pylon' },
        { name: 'Gateway' },
        { name: 'Stalker' },
      ],
    };

    const similarity = calculateSimilarity(build1, build2);

    expect(similarity).toBeGreaterThan(0.5); // Partially similar
    expect(similarity).toBeLessThan(1.0);
  });

  it('should handle different length builds', () => {
    const build1 = {
      buildOrder: [
        { name: 'Pylon' },
        { name: 'Gateway' },
      ],
    };

    const build2 = {
      buildOrder: [
        { name: 'Pylon' },
        { name: 'Gateway' },
        { name: 'Cybernetics Core' },
        { name: 'Stalker' },
      ],
    };

    const similarity = calculateSimilarity(build1, build2);

    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1.0);
  });

  it('should handle empty build orders', () => {
    const build1 = { buildOrder: [] };
    const build2 = { buildOrder: [{ name: 'Pylon' }] };

    const similarity = calculateSimilarity(build1, build2);

    expect(similarity).toBeCloseTo(0.0, 2);
  });

  it('should handle both empty build orders', () => {
    const build1 = { buildOrder: [] };
    const build2 = { buildOrder: [] };

    const similarity = calculateSimilarity(build1, build2);

    // Two empty builds could be considered similar or dissimilar
    // depending on implementation
    expect(Number.isFinite(similarity)).toBe(true);
  });
});

describe('Integration Tests - Build Comparison', () => {
  it('should perform full comparison workflow', () => {
    const builds = [
      {
        id: '1',
        name: 'Standard Opening',
        race: 'Protoss',
        description: 'Balanced build',
        buildOrder: [
          { name: 'Probe', mineral: 50, gas: 0, supply: 1, kind: 'unit', buildtime: 17 },
          { name: 'Pylon', mineral: 100, gas: 0, supply: 0, kind: 'building', buildtime: 25 },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 65 },
          { name: 'Assimilator', mineral: 75, gas: 0, supply: 0, kind: 'building', buildtime: 30 },
          { name: 'Cybernetics Core', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 50 },
          { name: 'Stalker', mineral: 125, gas: 50, supply: 2, kind: 'unit', buildtime: 42 },
        ],
      },
      {
        id: '2',
        name: 'Fast Expand',
        race: 'Protoss',
        description: 'Greedy economic build',
        buildOrder: [
          { name: 'Probe', mineral: 50, gas: 0, supply: 1, kind: 'unit', buildtime: 17 },
          { name: 'Pylon', mineral: 100, gas: 0, supply: 0, kind: 'building', buildtime: 25 },
          { name: 'Nexus', mineral: 400, gas: 0, supply: 0, kind: 'building', buildtime: 100 },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 65 },
        ],
      },
      {
        id: '3',
        name: '4-Gate All-In',
        race: 'Protoss',
        description: 'Aggressive timing attack',
        buildOrder: [
          { name: 'Probe', mineral: 50, gas: 0, supply: 1, kind: 'unit', buildtime: 17 },
          { name: 'Pylon', mineral: 100, gas: 0, supply: 0, kind: 'building', buildtime: 25 },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 65 },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 65 },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 65 },
          { name: 'Gateway', mineral: 150, gas: 0, supply: 0, kind: 'building', buildtime: 65 },
          { name: 'Zealot', mineral: 100, gas: 0, supply: 2, kind: 'unit', buildtime: 38 },
        ],
      },
    ];

    const result = compareBuilds(builds);

    // Verify all comparison components
    expect(result.builds).toHaveLength(3);
    expect(result.diff).toBeDefined();
    expect(result.efficiency).toBeDefined();
    expect(result.recommendations).toBeDefined();
    expect(result.timings).toBeDefined();

    // Verify metrics calculated correctly
    expect(result.builds.every(b => b.totalMinerals >= 0)).toBe(true);
    expect(result.builds.every(b => Number.isFinite(b.totalMinerals))).toBe(true);

    // Verify common opening detected
    const commonOpening = findCommonOpening(builds);
    expect(commonOpening.common.length).toBeGreaterThan(0); // All start with Probe + Pylon

    // Verify similarity calculations
    const sim01 = calculateSimilarity(builds[0], builds[1]);
    const sim02 = calculateSimilarity(builds[0], builds[2]);
    expect(Number.isFinite(sim01)).toBe(true);
    expect(Number.isFinite(sim02)).toBe(true);
  });

  it('should handle edge cases in comparison workflow', () => {
    // Minimal builds
    const minimalBuilds = [
      { name: 'A', buildOrder: [{ name: 'Pylon' }] },
      { name: 'B', buildOrder: [{ name: 'Gateway' }] },
    ];

    expect(() => compareBuilds(minimalBuilds)).not.toThrow();

    // Empty build orders
    const emptyBuilds = [
      { name: 'A', buildOrder: [] },
      { name: 'B', buildOrder: [] },
    ];

    expect(() => compareBuilds(emptyBuilds)).not.toThrow();
  });
});
