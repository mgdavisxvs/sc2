/**
 * Multi-Objective Optimization
 * Implements Pareto frontier analysis for build orders
 *
 * Objectives:
 * - Minimize completion time
 * - Minimize total cost (minerals + gas)
 * - Maximize army strength at time T
 * - Minimize vulnerability windows
 */

import { logger } from '../core/logger.js';
import { analyzeBuildCosts, calculateBuildTime } from './build-order.js';

/**
 * Check if build1 dominates build2 on all objectives
 *
 * DEFINITION: build1 dominates build2 if:
 *   - build1 is better or equal on all objectives
 *   - build1 is strictly better on at least one objective
 *
 * @param {Object} build1 - First build evaluation
 * @param {Object} build2 - Second build evaluation
 * @param {Array} objectives - List of objective functions
 * @returns {boolean}
 */
export function dominates(build1, build2, objectives) {
  let strictlyBetter = false;

  for (const obj of objectives) {
    const val1 = obj.evaluate(build1);
    const val2 = obj.evaluate(build2);

    if (obj.minimize) {
      if (val1 > val2) return false; // Worse on this objective
      if (val1 < val2) strictlyBetter = true;
    } else {
      // Maximize
      if (val1 < val2) return false; // Worse on this objective
      if (val1 > val2) strictlyBetter = true;
    }
  }

  return strictlyBetter;
}

/**
 * Find Pareto frontier (non-dominated solutions)
 *
 * ALGORITHM: Compare all pairs, remove dominated solutions
 * COMPLEXITY: O(M × N²) where M = objectives, N = solutions
 *
 * @param {Array} builds - Array of build orders
 * @param {Array} objectives - Objective functions
 * @returns {Array} Pareto-optimal builds
 */
export function findParetoFrontier(builds, objectives) {
  const paretoSet = [];

  for (const build1 of builds) {
    let dominated = false;

    for (const build2 of builds) {
      if (build1 === build2) continue;

      if (dominates(build2, build1, objectives)) {
        dominated = true;
        break;
      }
    }

    if (!dominated) {
      paretoSet.push(build1);
    }
  }

  logger.info(`Pareto frontier: ${paretoSet.length} / ${builds.length} solutions are non-dominated`);

  return paretoSet;
}

/**
 * Default objective functions for SC2 build orders
 */
export const SC2_OBJECTIVES = {
  /**
   * Minimize completion time
   */
  TIME: {
    name: 'completion_time',
    evaluate: (build) => calculateBuildTime(build.buildOrder || build),
    minimize: true,
    unit: 'seconds',
  },

  /**
   * Minimize total resource cost
   */
  COST: {
    name: 'total_cost',
    evaluate: (build) => {
      const order = build.buildOrder || build;
      return order.reduce((sum, item) =>
        sum + (item.mineral || 0) + (item.gas || 0), 0
      );
    },
    minimize: true,
    unit: 'resources',
  },

  /**
   * Maximize total supply (army size)
   */
  ARMY_SIZE: {
    name: 'army_size',
    evaluate: (build) => {
      const order = build.buildOrder || build;
      return order.reduce((sum, item) =>
        sum + (item.supply || 0), 0
      );
    },
    minimize: false,
    unit: 'supply',
  },

  /**
   * Minimize mineral cost only
   */
  MINERALS: {
    name: 'mineral_cost',
    evaluate: (build) => {
      const order = build.buildOrder || build;
      return order.reduce((sum, item) => sum + (item.mineral || 0), 0);
    },
    minimize: true,
    unit: 'minerals',
  },

  /**
   * Minimize gas cost only
   */
  GAS: {
    name: 'gas_cost',
    evaluate: (build) => {
      const order = build.buildOrder || build;
      return order.reduce((sum, item) => sum + (item.gas || 0), 0);
    },
    minimize: true,
    unit: 'gas',
  },

  /**
   * Army strength at specific time
   * @param {number} timepoint - Time in seconds
   */
  ARMY_AT_TIME: (timepoint) => ({
    name: `army_at_${timepoint}s`,
    evaluate: (build) => {
      const order = build.buildOrder || build;
      const costs = analyzeBuildCosts(order);

      let strength = 0;
      for (const step of costs) {
        if (step.cumulativeTime <= timepoint) {
          strength += step.supply || 0;
        }
      }

      return strength;
    },
    minimize: false,
    unit: 'supply',
  }),
};

/**
 * Analyze build order on multiple objectives
 *
 * @param {Object} build - Build order
 * @param {Array} objectives - Objectives to evaluate
 * @returns {Object} Objective values
 */
export function evaluateObjectives(build, objectives) {
  const results = {};

  for (const obj of objectives) {
    results[obj.name] = {
      value: obj.evaluate(build),
      unit: obj.unit,
      minimize: obj.minimize,
    };
  }

  return results;
}

/**
 * Find Pareto frontier with detailed analysis
 *
 * @param {Array} builds - Build orders to analyze
 * @param {Array} objectives - Objectives to optimize
 * @returns {Object} { frontier: [], dominated: [], analysis: {} }
 */
export function analyzeParetoFrontier(builds, objectives) {
  // Evaluate all builds
  const evaluated = builds.map(build => ({
    build,
    objectives: evaluateObjectives(build, objectives),
  }));

  // Find non-dominated solutions
  const frontier = [];
  const dominated = [];

  for (let i = 0; i < evaluated.length; i++) {
    let isDominated = false;

    for (let j = 0; j < evaluated.length; j++) {
      if (i === j) continue;

      if (dominates(evaluated[j].build, evaluated[i].build, objectives)) {
        isDominated = true;
        dominated.push(evaluated[i]);
        break;
      }
    }

    if (!isDominated) {
      frontier.push(evaluated[i]);
    }
  }

  // Calculate statistics
  const analysis = {
    totalBuilds: builds.length,
    frontierSize: frontier.length,
    dominatedCount: dominated.length,
    frontierRatio: frontier.length / builds.length,
    objectiveRanges: {},
  };

  // Calculate range for each objective
  for (const obj of objectives) {
    const values = evaluated.map(e => obj.evaluate(e.build));
    analysis.objectiveRanges[obj.name] = {
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }

  logger.info('Pareto Frontier Analysis:');
  logger.info(`  Total builds: ${analysis.totalBuilds}`);
  logger.info(`  Frontier size: ${analysis.frontierSize} (${(analysis.frontierRatio * 100).toFixed(1)}%)`);
  logger.info(`  Dominated: ${analysis.dominatedCount}`);

  return {
    frontier,
    dominated,
    analysis,
  };
}

/**
 * Non-dominated Sorting (for NSGA-II)
 *
 * Sorts population into fronts based on dominance
 *
 * @param {Array} population - Population to sort
 * @param {Array} objectives - Objectives
 * @returns {Array} Array of fronts (each front is an array of individuals)
 */
export function nonDominatedSort(population, objectives) {
  const fronts = [[]];
  const dominatedCount = new Map(); // How many individuals dominate this one
  const dominatesMap = new Map(); // Which individuals this one dominates

  // Calculate dominance relationships
  for (let i = 0; i < population.length; i++) {
    dominatedCount.set(i, 0);
    dominatesMap.set(i, []);

    for (let j = 0; j < population.length; j++) {
      if (i === j) continue;

      if (dominates(population[i], population[j], objectives)) {
        dominatesMap.get(i).push(j);
      } else if (dominates(population[j], population[i], objectives)) {
        dominatedCount.set(i, dominatedCount.get(i) + 1);
      }
    }

    // If not dominated by anyone, add to first front
    if (dominatedCount.get(i) === 0) {
      fronts[0].push(i);
    }
  }

  // Build subsequent fronts
  let frontIndex = 0;
  while (fronts[frontIndex].length > 0) {
    const nextFront = [];

    for (const i of fronts[frontIndex]) {
      for (const j of dominatesMap.get(i)) {
        dominatedCount.set(j, dominatedCount.get(j) - 1);

        if (dominatedCount.get(j) === 0) {
          nextFront.push(j);
        }
      }
    }

    if (nextFront.length > 0) {
      fronts.push(nextFront);
    }

    frontIndex++;
  }

  // Map indices back to actual individuals
  return fronts.filter(f => f.length > 0).map(front =>
    front.map(idx => population[idx])
  );
}

/**
 * Calculate crowding distance for diversity preservation
 *
 * Used in NSGA-II to maintain diverse Pareto frontier
 *
 * @param {Array} front - Front to calculate distances for
 * @param {Array} objectives - Objectives
 * @returns {Map} Individual -> crowding distance
 */
export function calculateCrowdingDistance(front, objectives) {
  const distances = new Map();

  // Initialize distances to 0
  for (const individual of front) {
    distances.set(individual, 0);
  }

  // Calculate distance for each objective
  for (const obj of objectives) {
    // Sort by this objective
    const sorted = [...front].sort((a, b) => {
      const valA = obj.evaluate(a);
      const valB = obj.evaluate(b);
      return obj.minimize ? valA - valB : valB - valA;
    });

    // Boundary points get infinite distance
    distances.set(sorted[0], Infinity);
    distances.set(sorted[sorted.length - 1], Infinity);

    // Calculate range
    const minVal = obj.evaluate(sorted[0]);
    const maxVal = obj.evaluate(sorted[sorted.length - 1]);
    const range = maxVal - minVal;

    if (range === 0) continue;

    // Calculate crowding distance for middle points
    for (let i = 1; i < sorted.length - 1; i++) {
      const prev = obj.evaluate(sorted[i - 1]);
      const next = obj.evaluate(sorted[i + 1]);

      const distance = (next - prev) / range;
      distances.set(sorted[i], distances.get(sorted[i]) + distance);
    }
  }

  return distances;
}

/**
 * Find knee point on Pareto frontier
 *
 * Knee point = solution with best balance across objectives
 *
 * @param {Array} frontier - Pareto frontier
 * @param {Array} objectives - Objectives
 * @returns {Object} Knee point solution
 */
export function findKneePoint(frontier, objectives) {
  if (frontier.length === 0) return null;
  if (frontier.length === 1) return frontier[0];

  // Normalize objectives to [0, 1]
  const normalized = frontier.map(build => {
    const values = {};

    for (const obj of objectives) {
      values[obj.name] = obj.evaluate(build);
    }

    return { build, values };
  });

  // Calculate range for each objective
  const ranges = {};
  for (const obj of objectives) {
    const values = normalized.map(n => n.values[obj.name]);
    ranges[obj.name] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  // Normalize values
  for (const item of normalized) {
    for (const obj of objectives) {
      const range = ranges[obj.name].max - ranges[obj.name].min;
      if (range > 0) {
        item.values[obj.name] = (item.values[obj.name] - ranges[obj.name].min) / range;
        if (!obj.minimize) {
          item.values[obj.name] = 1 - item.values[obj.name];
        }
      } else {
        item.values[obj.name] = 0;
      }
    }
  }

  // Find point closest to ideal (all 0s after normalization for minimization)
  let bestDistance = Infinity;
  let kneePoint = normalized[0].build;

  for (const item of normalized) {
    const distance = Math.sqrt(
      Object.values(item.values).reduce((sum, val) => sum + val * val, 0)
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      kneePoint = item.build;
    }
  }

  return kneePoint;
}

/**
 * Generate report comparing Pareto frontier solutions
 *
 * @param {Array} frontier - Pareto frontier
 * @param {Array} objectives - Objectives
 * @returns {string} Formatted report
 */
export function generateParetoReport(frontier, objectives) {
  const lines = [];

  lines.push('═'.repeat(80));
  lines.push('PARETO FRONTIER ANALYSIS');
  lines.push('═'.repeat(80));
  lines.push('');
  lines.push(`Total solutions: ${frontier.length}`);
  lines.push('');

  // Table header
  const header = ['#', 'Build', ...objectives.map(obj => obj.name)];
  lines.push(header.join('\t'));
  lines.push('─'.repeat(80));

  // Each solution
  frontier.forEach((item, index) => {
    const build = item.build || item;
    const values = objectives.map(obj =>
      obj.evaluate(build).toFixed(2) + ' ' + obj.unit
    );

    const buildName = build.buildOrder
      ? build.buildOrder.map(e => e.name).slice(0, 3).join(', ') + '...'
      : 'Build ' + (index + 1);

    lines.push([index + 1, buildName, ...values].join('\t'));
  });

  lines.push('');
  lines.push('═'.repeat(80));

  return lines.join('\n');
}
