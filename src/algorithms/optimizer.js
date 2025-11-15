/**
 * Build Order Optimizer
 * Implements Knuth's dynamic programming approach for optimal build orders
 */

import { STARTING_UNITS } from '../core/config.js';
import { norm } from '../utils/dom.js';
import { getPrerequisites } from './build-order.js';
import { logger } from '../core/logger.js';

/**
 * Check if an entity can be built given current state
 * @param {Object} entity - Entity to check
 * @param {Set} available - Set of available entities (normalized names)
 * @returns {boolean}
 */
function canBuild(entity, available) {
  const prereqs = getPrerequisites(entity).map(norm);
  return prereqs.every(req => available.has(req));
}

/**
 * Apply action to state (add entity to available set)
 * @param {Set} state - Current available entities
 * @param {Object} entity - Entity being built
 * @returns {Set} New state
 */
function applyAction(state, entity) {
  const newState = new Set(state);
  newState.add(norm(entity.name));
  return newState;
}

/**
 * Optimize build order using dynamic programming
 * Minimizes total build time to achieve target units
 *
 * ALGORITHM: Dynamic Programming with memoization
 * STATE: Set of available entities
 * ACTION: Build an entity from remaining targets
 * OBJECTIVE: Minimize total build time
 *
 * COMPLEXITY: O(2^n × n) where n = number of target units
 *             Exponential, but practical for small n (< 15)
 *
 * @param {Array} targetEntities - Entities to build (in any order)
 * @param {string} race - Race name
 * @param {Object} database - GameDatabase instance for lookups
 * @returns {Object} { buildOrder: [], totalTime: number, explored: number }
 */
export function optimizeBuildOrder(targetEntities, race, database) {
  const memo = new Map();
  let exploredStates = 0;

  // Initial state: starting units
  const initialAvailable = new Set(
    (STARTING_UNITS[race] || []).map(norm)
  );

  /**
   * Recursive DP function
   * @param {Set} available - Currently available entities
   * @param {Array} remaining - Remaining entities to build
   * @returns {Object} { time: number, order: [] }
   */
  function dp(available, remaining) {
    exploredStates++;

    // Base case: no more entities to build
    if (remaining.length === 0) {
      return { time: 0, order: [] };
    }

    // Create memoization key
    const availableKey = [...available].sort().join(',');
    const remainingKey = remaining.map(e => norm(e.name)).sort().join(',');
    const key = `${availableKey}|${remainingKey}`;

    if (memo.has(key)) {
      return memo.get(key);
    }

    let best = { time: Infinity, order: [] };

    // Try building each remaining entity
    for (let i = 0; i < remaining.length; i++) {
      const entity = remaining[i];

      // Can we build this entity?
      if (!canBuild(entity, available)) {
        continue; // Skip if prerequisites not met
      }

      // Build this entity
      const newAvailable = applyAction(available, entity);
      const newRemaining = [
        ...remaining.slice(0, i),
        ...remaining.slice(i + 1)
      ];

      // Recursively solve for remaining entities
      const subproblem = dp(newAvailable, newRemaining);

      const totalTime = (entity.buildtime || 0) + subproblem.time;

      // Update best solution
      if (totalTime < best.time) {
        best = {
          time: totalTime,
          order: [entity, ...subproblem.order]
        };
      }
    }

    memo.set(key, best);
    return best;
  }

  const result = dp(initialAvailable, targetEntities);

  logger.info('Optimizer explored', exploredStates, 'states');

  return {
    buildOrder: result.order,
    totalTime: result.time,
    explored: exploredStates,
  };
}

/**
 * Greedy build order (fast heuristic)
 * Always builds cheapest available entity
 *
 * @param {Array} targetEntities - Entities to build
 * @param {string} race - Race name
 * @param {Object} database - GameDatabase instance
 * @returns {Object} { buildOrder: [], totalTime: number }
 */
export function greedyBuildOrder(targetEntities, race, database) {
  const available = new Set(
    (STARTING_UNITS[race] || []).map(norm)
  );
  const remaining = [...targetEntities];
  const order = [];
  let totalTime = 0;

  while (remaining.length > 0) {
    // Find cheapest buildable entity
    let best = null;
    let bestIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const entity = remaining[i];
      if (canBuild(entity, available)) {
        const cost = (entity.mineral || 0) + (entity.gas || 0);
        const bestCost = best ? (best.mineral || 0) + (best.gas || 0) : Infinity;

        if (cost < bestCost) {
          best = entity;
          bestIndex = i;
        }
      }
    }

    if (best === null) {
      logger.error('Greedy build order failed: no buildable entities');
      break;
    }

    // Build this entity
    order.push(best);
    totalTime += best.buildtime || 0;
    available.add(norm(best.name));
    remaining.splice(bestIndex, 1);
  }

  return {
    buildOrder: order,
    totalTime,
  };
}

/**
 * A* search for optimal build order
 * Uses admissible heuristic (remaining build time)
 *
 * @param {Array} targetEntities - Entities to build
 * @param {string} race - Race name
 * @param {Object} database - GameDatabase instance
 * @returns {Object} { buildOrder: [], totalTime: number, explored: number }
 */
export function aStarBuildOrder(targetEntities, race, database) {
  // Priority queue (min-heap)
  const openSet = [];
  const closedSet = new Set();
  let exploredStates = 0;

  // Initial state
  const initialAvailable = new Set(
    (STARTING_UNITS[race] || []).map(norm)
  );

  const initialState = {
    available: initialAvailable,
    remaining: targetEntities,
    order: [],
    gScore: 0, // Actual cost so far
    fScore: 0, // Estimated total cost
  };

  openSet.push(initialState);

  while (openSet.length > 0) {
    exploredStates++;

    // Get state with lowest f-score
    openSet.sort((a, b) => a.fScore - b.fScore);
    const current = openSet.shift();

    // Goal test
    if (current.remaining.length === 0) {
      logger.info('A* explored', exploredStates, 'states');
      return {
        buildOrder: current.order,
        totalTime: current.gScore,
        explored: exploredStates,
      };
    }

    // Mark as explored
    const stateKey = [...current.available].sort().join(',') + '|' +
                     current.remaining.map(e => norm(e.name)).sort().join(',');
    if (closedSet.has(stateKey)) continue;
    closedSet.add(stateKey);

    // Expand neighbors
    for (let i = 0; i < current.remaining.length; i++) {
      const entity = current.remaining[i];

      if (!canBuild(entity, current.available)) continue;

      const newAvailable = applyAction(current.available, entity);
      const newRemaining = [
        ...current.remaining.slice(0, i),
        ...current.remaining.slice(i + 1)
      ];

      const gScore = current.gScore + (entity.buildtime || 0);
      const hScore = newRemaining.reduce((sum, e) => sum + (e.buildtime || 0), 0);
      const fScore = gScore + hScore;

      openSet.push({
        available: newAvailable,
        remaining: newRemaining,
        order: [...current.order, entity],
        gScore,
        fScore,
      });
    }
  }

  logger.warn('A* search failed to find solution');
  return {
    buildOrder: [],
    totalTime: Infinity,
    explored: exploredStates,
  };
}
