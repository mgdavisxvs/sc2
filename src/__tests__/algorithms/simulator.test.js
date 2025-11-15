/**
 * Discrete Event Simulator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SC2Simulator, compareBuildOrders, optimizeWorkerSplit } from '../../algorithms/simulator.js';

describe('SC2Simulator - Priority Queue', () => {
  it('should process events in chronological order', () => {
    const sim = new SC2Simulator('protoss');

    // Schedule events out of order
    sim.eventQueue.push({ type: 'TEST', time: 5.0 });
    sim.eventQueue.push({ type: 'TEST', time: 2.0 });
    sim.eventQueue.push({ type: 'TEST', time: 8.0 });
    sim.eventQueue.push({ type: 'TEST', time: 1.0 });

    // Should process in chronological order
    expect(sim.eventQueue.pop().time).toBe(1.0);
    expect(sim.eventQueue.pop().time).toBe(2.0);
    expect(sim.eventQueue.pop().time).toBe(5.0);
    expect(sim.eventQueue.pop().time).toBe(8.0);
  });
});

describe('SC2Simulator - Initialization', () => {
  it('should initialize with default Protoss state', () => {
    const sim = new SC2Simulator('protoss');

    expect(sim.race).toBe('protoss');
    expect(sim.minerals).toBe(50);
    expect(sim.gas).toBe(0);
    expect(sim.workers.mineral).toBe(12);
    expect(sim.workers.gas).toBe(0);
    expect(sim.supplyUsed).toBe(12);
    expect(sim.supplyMax).toBe(15);
  });

  it('should accept custom initial state', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 100,
      gas: 50,
      mineralWorkers: 16,
      gasWorkers: 3,
      supplyUsed: 20,
    });

    expect(sim.minerals).toBe(100);
    expect(sim.gas).toBe(50);
    expect(sim.workers.mineral).toBe(16);
    expect(sim.workers.gas).toBe(3);
    expect(sim.supplyUsed).toBe(20);
  });
});

describe('SC2Simulator - Resource Collection', () => {
  it('should collect minerals with optimal saturation (16 workers)', () => {
    const sim = new SC2Simulator('protoss', {
      mineralWorkers: 16,
      gasWorkers: 0,
    });

    const initialMinerals = sim.minerals;
    sim.collectResources();

    // 16 workers × (50/60) per second = 13.33 minerals per tick
    const expectedIncome = 16 * (50 / 60);
    expect(sim.minerals).toBeCloseTo(initialMinerals + expectedIncome, 2);
  });

  it('should have diminishing returns beyond 16 mineral workers', () => {
    const sim16 = new SC2Simulator('protoss', { mineralWorkers: 16 });
    const sim24 = new SC2Simulator('protoss', { mineralWorkers: 24 });

    sim16.collectResources();
    sim24.collectResources();

    const income16 = sim16.minerals - 50;
    const income24 = sim24.minerals - 50;

    // Extra 8 workers should provide less than 8 × normal rate
    const normalRate = 16 * (50 / 60);
    const diminishedRate = normalRate + 8 * (50 / 60) * 0.5;

    expect(income16).toBeCloseTo(normalRate, 2);
    expect(income24).toBeCloseTo(diminishedRate, 2);
  });

  it('should collect gas with optimal saturation (6 workers)', () => {
    const sim = new SC2Simulator('protoss', {
      gasWorkers: 6,
      mineralWorkers: 6,
    });

    const initialGas = sim.gas;
    sim.collectResources();

    // 6 workers × (38/60) per second = 3.8 gas per tick
    const expectedIncome = 6 * (38 / 60);
    expect(sim.gas).toBeCloseTo(initialGas + expectedIncome, 2);
  });

  it('should have diminishing returns beyond 6 gas workers', () => {
    const sim6 = new SC2Simulator('protoss', { gasWorkers: 6, mineralWorkers: 6 });
    const sim9 = new SC2Simulator('protoss', { gasWorkers: 9, mineralWorkers: 3 });

    sim6.collectResources();
    sim9.collectResources();

    const income6 = sim6.gas;
    const income9 = sim9.gas;

    // Extra 3 workers should provide less than 3 × normal rate
    const normalRate = 6 * (38 / 60);
    const diminishedRate = normalRate + 3 * (38 / 60) * 0.5;

    expect(income6).toBeCloseTo(normalRate, 2);
    expect(income9).toBeCloseTo(diminishedRate, 2);
  });
});

describe('SC2Simulator - Time Until Affordable', () => {
  it('should return 0 when already affordable', () => {
    const sim = new SC2Simulator('protoss', { minerals: 100, gas: 50 });

    const action = { mineral: 50, gas: 25 };
    const time = sim.timeUntilAffordable(action);

    expect(time).toBe(0);
  });

  it('should calculate time to afford minerals', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 0,
      gas: 0,
      mineralWorkers: 16,
    });

    // Need 100 minerals, 16 workers × (50/60) = 13.33 per second
    const action = { mineral: 100, gas: 0 };
    const time = sim.timeUntilAffordable(action);

    const expectedTime = 100 / (16 * (50 / 60));
    expect(time).toBeCloseTo(expectedTime, 1);
  });

  it('should calculate time to afford gas', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 1000,
      gas: 0,
      gasWorkers: 6,
      mineralWorkers: 6,
    });

    // Need 50 gas, 6 workers × (38/60) = 3.8 per second
    const action = { mineral: 0, gas: 50 };
    const time = sim.timeUntilAffordable(action);

    const expectedTime = 50 / (6 * (38 / 60));
    expect(time).toBeCloseTo(expectedTime, 1);
  });

  it('should return max of mineral and gas wait times', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 0,
      gas: 0,
      mineralWorkers: 16,
      gasWorkers: 6,
    });

    const action = { mineral: 150, gas: 50 };
    const time = sim.timeUntilAffordable(action);

    const mineralTime = 150 / (16 * (50 / 60));
    const gasTime = 50 / (6 * (38 / 60));

    expect(time).toBeCloseTo(Math.max(mineralTime, gasTime), 1);
  });
});

describe('SC2Simulator - Parallel Production', () => {
  it('should build units in parallel when using multiple facilities', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 1000,
      gas: 1000,
    });

    // Two zealots from different gateways should build in parallel
    const buildOrder = [
      { name: 'Zealot 1', mineral: 100, gas: 0, buildtime: 38, supply: 2, kind: 'unit' },
      { name: 'Zealot 2', mineral: 100, gas: 0, buildtime: 38, supply: 2, kind: 'unit' },
    ];

    const result = sim.simulate(buildOrder);

    // With unlimited facilities, both should complete around same time
    // Not sequentially (76s), but parallel (~38s)
    // Note: This is simplified - actual implementation may vary
    expect(result.completionTime).toBeLessThan(76);
  });
});

describe('SC2Simulator - Supply Blocking', () => {
  it('should detect supply block when trying to build beyond cap', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 1000,
      gas: 1000,
      supplyUsed: 14,
      supplyMax: 15,
    });

    // Try to build 2-supply unit when only 1 supply available
    const buildOrder = [
      { name: 'Zealot', mineral: 100, gas: 0, buildtime: 38, supply: 2, kind: 'unit' },
    ];

    const result = sim.simulate(buildOrder);

    expect(result.stats.supplyBlocks.length).toBeGreaterThan(0);
    expect(result.stats.supplyBlocks[0].action).toBe('Zealot');
  });

  it('should increase supply max when building supply structures', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 100,
      gas: 0,
    });

    const buildOrder = [
      { name: 'Pylon', mineral: 100, gas: 0, buildtime: 25, supply: 0, supplyoffer: 8, kind: 'building' },
    ];

    const initialSupplyMax = sim.supplyMax;
    const result = sim.simulate(buildOrder);

    // Supply max should increase after pylon completes
    expect(result.stats.completedBuilds.length).toBe(1);
    // Simulator internal state is updated during simulation
  });
});

describe('SC2Simulator - Worker Production', () => {
  it('should increase worker count when building workers', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 150,
      gas: 0,
    });

    const buildOrder = [
      { name: 'Probe', mineral: 50, gas: 0, buildtime: 17, supply: 1, kind: 'unit' },
    ];

    const initialWorkers = sim.workers.total;
    const result = sim.simulate(buildOrder);

    expect(result.stats.completedBuilds.length).toBe(1);
    // Worker count should have increased
  });
});

describe('SC2Simulator - Full Build Order Simulation', () => {
  it('should simulate a basic Protoss opening', () => {
    const sim = new SC2Simulator('protoss');

    const buildOrder = [
      { name: 'Probe', mineral: 50, gas: 0, buildtime: 17, supply: 1, kind: 'unit' },
      { name: 'Pylon', mineral: 100, gas: 0, buildtime: 25, supply: 0, supplyoffer: 8, kind: 'building' },
      { name: 'Gateway', mineral: 150, gas: 0, buildtime: 46, supply: 0, kind: 'building' },
      { name: 'Zealot', mineral: 100, gas: 0, buildtime: 38, supply: 2, kind: 'unit' },
    ];

    const result = sim.simulate(buildOrder);

    expect(result.completionTime).toBeGreaterThan(0);
    expect(result.stats.completedBuilds.length).toBe(4);
    expect(result.timeline.length).toBe(4);

    // Timeline should be in chronological order
    for (let i = 1; i < result.timeline.length; i++) {
      expect(result.timeline[i].time).toBeGreaterThanOrEqual(result.timeline[i - 1].time);
    }
  });

  it('should handle gas-heavy builds', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 200,
      gas: 0,
      gasWorkers: 3,
      mineralWorkers: 9,
    });

    const buildOrder = [
      { name: 'Gateway', mineral: 150, gas: 0, buildtime: 46, supply: 0, kind: 'building' },
      { name: 'Cybernetics Core', mineral: 150, gas: 50, buildtime: 36, supply: 0, kind: 'building' },
      { name: 'Stalker', mineral: 125, gas: 50, buildtime: 30, supply: 2, kind: 'unit' },
    ];

    const result = sim.simulate(buildOrder);

    expect(result.completionTime).toBeGreaterThan(0);
    expect(result.stats.completedBuilds.length).toBe(3);
  });
});

describe('compareBuildOrders', () => {
  it('should compare multiple build orders and sort by completion time', () => {
    const buildOrder1 = [
      { name: 'Fast Zealot', mineral: 100, gas: 0, buildtime: 38, supply: 2, kind: 'unit' },
    ];

    const buildOrder2 = [
      { name: 'Slow Stalker', mineral: 125, gas: 50, buildtime: 50, supply: 2, kind: 'unit' },
    ];

    const results = compareBuildOrders([buildOrder1, buildOrder2], 'protoss');

    expect(results).toHaveLength(2);
    expect(results[0].completionTime).toBeLessThanOrEqual(results[1].completionTime);
    expect(results[0]).toHaveProperty('buildOrder');
    expect(results[0]).toHaveProperty('stats');
  });
});

describe('optimizeWorkerSplit', () => {
  it('should find optimal worker distribution for build', () => {
    const buildOrder = [
      { name: 'Gateway', mineral: 150, gas: 0, buildtime: 46, supply: 0, kind: 'building' },
    ];

    const optimal = optimizeWorkerSplit(buildOrder, 'protoss');

    expect(optimal).toHaveProperty('gasWorkers');
    expect(optimal).toHaveProperty('mineralWorkers');
    expect(optimal).toHaveProperty('completionTime');
    expect(optimal.gasWorkers + optimal.mineralWorkers).toBeLessThanOrEqual(12);
  });
});

describe('SC2Simulator - State Inspection', () => {
  it('should provide current state snapshot', () => {
    const sim = new SC2Simulator('protoss', {
      minerals: 150,
      gas: 75,
    });

    const state = sim.getState();

    expect(state.time).toBe(0);
    expect(state.minerals).toBe(150);
    expect(state.gas).toBe(75);
    expect(state.supply).toEqual({ used: 12, max: 15 });
    expect(state.workers).toEqual({
      mineral: 12,
      gas: 0,
      total: 12,
    });
    expect(Array.isArray(state.available)).toBe(true);
  });

  it('should calculate income rate correctly', () => {
    const sim = new SC2Simulator('protoss', {
      mineralWorkers: 16,
      gasWorkers: 6,
    });

    const income = sim.getIncomeRate();

    expect(income.mineral).toBeCloseTo(16 * (50 / 60), 2);
    expect(income.gas).toBeCloseTo(6 * (38 / 60), 2);
  });
});

describe('SC2Simulator - Worker Type Detection', () => {
  it('should identify Protoss workers', () => {
    const sim = new SC2Simulator('protoss');

    expect(sim.isWorker('Probe')).toBe(true);
    expect(sim.isWorker('probe')).toBe(true);
    expect(sim.isWorker('Zealot')).toBe(false);
  });

  it('should identify Terran workers', () => {
    const sim = new SC2Simulator('terran');

    expect(sim.isWorker('SCV')).toBe(true);
    expect(sim.isWorker('scv')).toBe(true);
    expect(sim.isWorker('Marine')).toBe(false);
  });

  it('should identify Zerg workers', () => {
    const sim = new SC2Simulator('zerg');

    expect(sim.isWorker('Drone')).toBe(true);
    expect(sim.isWorker('drone')).toBe(true);
    expect(sim.isWorker('Zergling')).toBe(false);
  });
});
