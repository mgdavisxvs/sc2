/**
 * Build Order Algorithm Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateBuildOrder,
  findMissingPrereqs,
  analyzeBuildCosts,
  summarizeBuildOrder,
} from '../../algorithms/build-order.js';

describe('Build Order Validation', () => {
  it('should validate a correct Protoss build order', () => {
    const build = [
      { name: 'Probe', kind: 'unit', tech_tree: { requires: [] } },
      { name: 'Pylon', kind: 'building', tech_tree: { requires: [] } },
      { name: 'Gateway', kind: 'building', tech_tree: { requires: ['pylon'] } },
      { name: 'Zealot', kind: 'unit', tech_tree: { requires: ['gateway'] } },
    ];

    const result = validateBuildOrder(build, 'protoss');
    expect(result.valid).toBe(true);
  });

  it('should reject build order with missing prerequisites', () => {
    const build = [
      { name: 'Stalker', kind: 'unit', tech_tree: { requires: ['cybernetics core'] } },
    ];

    const result = validateBuildOrder(build, 'protoss');
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('cybernetics core');
  });

  it('should allow building after prerequisites are met', () => {
    const build = [
      { name: 'Pylon', kind: 'building', tech_tree: { requires: [] } },
      { name: 'Gateway', kind: 'building', tech_tree: { requires: ['pylon'] } },
      { name: 'Cybernetics Core', kind: 'building', tech_tree: { requires: ['gateway'] } },
      { name: 'Stalker', kind: 'unit', tech_tree: { requires: ['cybernetics core'] } },
    ];

    const result = validateBuildOrder(build, 'protoss');
    expect(result.valid).toBe(true);
  });
});

describe('Missing Prerequisites Detection', () => {
  it('should detect missing prerequisites for locked unit', () => {
    const entity = {
      name: 'Stalker',
      tech_tree: { requires: ['cybernetics core'] }
    };
    const currentBuild = [];

    const missing = findMissingPrereqs(entity, currentBuild, 'protoss');
    expect(missing).toContain('cybernetics core');
  });

  it('should return empty array when prerequisites are met', () => {
    const entity = {
      name: 'Zealot',
      tech_tree: { requires: ['gateway'] }
    };
    const currentBuild = [
      { name: 'Gateway', locked: false }
    ];

    const missing = findMissingPrereqs(entity, currentBuild, 'protoss');
    expect(missing).toHaveLength(0);
  });

  it('should work with starting units', () => {
    const entity = {
      name: 'Probe',
      tech_tree: { requires: ['nexus'] }
    };
    const currentBuild = [];

    const missing = findMissingPrereqs(entity, currentBuild, 'protoss');
    expect(missing).toHaveLength(0); // nexus is in starting units
  });
});

describe('Build Cost Analysis', () => {
  it('should calculate cumulative costs correctly', () => {
    const build = [
      { name: 'Probe', mineral: 50, gas: 0, supply: 1 },
      { name: 'Pylon', mineral: 100, gas: 0, supply: 0 },
      { name: 'Gateway', mineral: 150, gas: 0, supply: 0 },
    ];

    const analysis = analyzeBuildCosts(build);

    expect(analysis).toHaveLength(3);
    expect(analysis[0].cumulativeMineral).toBe(50);
    expect(analysis[1].cumulativeMineral).toBe(150);
    expect(analysis[2].cumulativeMineral).toBe(300);
  });

  it('should handle gas costs', () => {
    const build = [
      { name: 'Gateway', mineral: 150, gas: 0, supply: 0 },
      { name: 'Cybernetics Core', mineral: 150, gas: 50, supply: 0 },
    ];

    const analysis = analyzeBuildCosts(build);

    expect(analysis[1].cumulativeGas).toBe(50);
  });
});

describe('Build Order Summary', () => {
  it('should generate correct summary statistics', () => {
    const build = [
      { name: 'Probe', kind: 'unit', mineral: 50, gas: 0, supply: 1, buildtime: 17, tech_tree: { requires: [] } },
      { name: 'Pylon', kind: 'building', mineral: 100, gas: 0, supply: 0, buildtime: 25, tech_tree: { requires: [] } },
    ];

    const summary = summarizeBuildOrder(build, 'protoss');

    expect(summary.steps).toBe(2);
    expect(summary.valid).toBe(true);
    expect(summary.totalCost.mineral).toBe(150);
    expect(summary.totalCost.gas).toBe(0);
    expect(summary.estimatedTime).toBe(42);
    expect(summary.composition.units).toBe(1);
    expect(summary.composition.buildings).toBe(1);
  });
});
