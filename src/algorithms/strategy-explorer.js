/**
 * Strategy Space Explorer
 * Implements Wolfram's computational experimentation approach
 * Generates and analyzes the space of all possible build orders
 */

import { STARTING_UNITS } from '../core/config.js';
import { norm } from '../utils/dom.js';
import { getPrerequisites, validateBuildOrder } from './build-order.js';
import { logger } from '../core/logger.js';

/**
 * Check if entity can be built given available entities
 * @param {Object} entity - Entity to check
 * @param {Set} available - Available entities
 * @returns {boolean}
 */
function canBuild(entity, available) {
  const prereqs = getPrerequisites(entity).map(norm);
  return prereqs.every(req => available.has(req));
}

/**
 * Check if entity meets constraints
 * @param {Object} entity - Entity to check
 * @param {Object} constraints - Constraint rules
 * @returns {boolean}
 */
function meetsConstraints(entity, constraints) {
  if (!constraints) return true;

  // Include/exclude specific units
  if (constraints.includeUnits && constraints.includeUnits.length > 0) {
    const included = constraints.includeUnits.map(norm);
    if (!included.includes(norm(entity.name))) {
      return false;
    }
  }

  if (constraints.excludeUnits && constraints.excludeUnits.length > 0) {
    const excluded = constraints.excludeUnits.map(norm);
    if (excluded.includes(norm(entity.name))) {
      return false;
    }
  }

  // Cost constraints
  if (constraints.maxCostPerUnit) {
    const cost = (entity.mineral || 0) + (entity.gas || 0);
    if (cost > constraints.maxCostPerUnit) {
      return false;
    }
  }

  // Kind constraints
  if (constraints.kinds && constraints.kinds.length > 0) {
    if (!constraints.kinds.includes(entity.kind)) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate total cost of build order
 * @param {Array} buildOrder - Build order
 * @returns {number} Total mineral + gas cost
 */
function totalCost(buildOrder) {
  return buildOrder.reduce((sum, item) =>
    sum + (item.mineral || 0) + (item.gas || 0), 0
  );
}

/**
 * Generate all valid build orders up to N steps
 * Uses generator pattern for memory efficiency
 *
 * WARNING: Computational complexity grows exponentially!
 * For n entities and k steps: O(n^k)
 *
 * @param {Array} allEntities - All available entities
 * @param {string} race - Race name
 * @param {number} maxSteps - Maximum build order length
 * @param {Object} constraints - Build constraints
 * @yields {Array} Valid build orders
 */
export function* generateBuildOrders(allEntities, race, maxSteps, constraints = {}) {
  const starting = new Set(
    (STARTING_UNITS[race] || []).map(norm)
  );

  let generatedCount = 0;
  const maxGenerate = constraints.maxResults || 10000; // Safety limit

  /**
   * Recursive generator
   */
  function* generate(currentBuild, available, remainingSteps) {
    // Yield current build if non-empty
    if (currentBuild.length > 0) {
      generatedCount++;
      yield [...currentBuild];

      // Safety check
      if (generatedCount >= maxGenerate) {
        logger.warn('Hit generation limit:', maxGenerate);
        return;
      }
    }

    // Base case: max steps reached
    if (remainingSteps === 0) {
      return;
    }

    // Find all buildable entities
    const buildable = allEntities.filter(entity =>
      canBuild(entity, available) &&
      meetsConstraints(entity, constraints)
    );

    // Try building each entity
    for (const entity of buildable) {
      const newBuild = [...currentBuild, entity];
      const newAvailable = new Set(available);
      newAvailable.add(norm(entity.name));

      // Pruning: check cost constraint
      if (constraints.maxCost) {
        if (totalCost(newBuild) > constraints.maxCost) {
          continue;
        }
      }

      yield* generate(newBuild, newAvailable, remainingSteps - 1);
    }
  }

  yield* generate([], starting, maxSteps);

  logger.info(`Generated ${generatedCount} build orders`);
}

/**
 * Explore strategy space and return top N builds by a metric
 *
 * @param {Array} allEntities - All available entities
 * @param {string} race - Race name
 * @param {number} maxSteps - Maximum build length
 * @param {Object} options - Exploration options
 * @returns {Array} Top build orders
 */
export function exploreStrategySpace(allEntities, race, maxSteps, options = {}) {
  const {
    constraints = {},
    topN = 10,
    sortBy = 'cost', // 'cost', 'time', 'supply'
  } = options;

  logger.info('Exploring strategy space...', { maxSteps, topN, sortBy });

  const builds = [];
  const generator = generateBuildOrders(allEntities, race, maxSteps, {
    ...constraints,
    maxResults: constraints.maxResults || 10000,
  });

  for (const build of generator) {
    builds.push(build);
  }

  // Sort by metric
  let sortFn;
  switch (sortBy) {
    case 'cost':
      sortFn = (a, b) => totalCost(a) - totalCost(b);
      break;
    case 'time':
      sortFn = (a, b) =>
        a.reduce((sum, e) => sum + (e.buildtime || 0), 0) -
        b.reduce((sum, e) => sum + (e.buildtime || 0), 0);
      break;
    case 'supply':
      sortFn = (a, b) =>
        a.reduce((sum, e) => sum + (e.supply || 0), 0) -
        b.reduce((sum, e) => sum + (e.supply || 0), 0);
      break;
    default:
      sortFn = (a, b) => totalCost(a) - totalCost(b);
  }

  builds.sort(sortFn);

  const topBuilds = builds.slice(0, topN);

  logger.info(`Explored ${builds.length} strategies, returning top ${topN}`);

  return topBuilds.map(build => ({
    build,
    cost: totalCost(build),
    time: build.reduce((sum, e) => sum + (e.buildtime || 0), 0),
    supply: build.reduce((sum, e) => sum + (e.supply || 0), 0),
    length: build.length,
  }));
}

/**
 * Find all builds that produce a specific army composition
 *
 * @param {Array} allEntities - All available entities
 * @param {string} race - Race name
 * @param {Object} targetComposition - e.g., { zealot: 5, stalker: 3 }
 * @param {number} maxSteps - Maximum build length
 * @returns {Array} Matching build orders
 */
export function findBuildsForComposition(allEntities, race, targetComposition, maxSteps) {
  const targetCounts = new Map();
  for (const [name, count] of Object.entries(targetComposition)) {
    targetCounts.set(norm(name), count);
  }

  const matchingBuilds = [];

  const generator = generateBuildOrders(allEntities, race, maxSteps, {
    maxResults: 50000,
  });

  for (const build of generator) {
    // Count units in this build
    const counts = new Map();
    for (const entity of build) {
      const name = norm(entity.name);
      counts.set(name, (counts.get(name) || 0) + 1);
    }

    // Check if matches target composition
    let matches = true;
    for (const [name, targetCount] of targetCounts) {
      if ((counts.get(name) || 0) < targetCount) {
        matches = false;
        break;
      }
    }

    if (matches) {
      matchingBuilds.push(build);
    }

    if (matchingBuilds.length >= 100) {
      break; // Safety limit
    }
  }

  logger.info(`Found ${matchingBuilds.length} builds matching composition`);

  return matchingBuilds.map(build => ({
    build,
    cost: totalCost(build),
    time: build.reduce((sum, e) => sum + (e.buildtime || 0), 0),
    length: build.length,
  }));
}

/**
 * Analyze strategy diversity
 * Clusters builds by similarity
 *
 * @param {Array} builds - List of build orders
 * @returns {Object} Diversity metrics
 */
export function analyzeStrategyDiversity(builds) {
  if (builds.length === 0) {
    return { uniqueSequences: 0, averageLength: 0, mostCommonUnits: [] };
  }

  // Count unique sequences
  const sequences = new Set();
  const unitCounts = new Map();
  let totalLength = 0;

  for (const build of builds) {
    const sequence = build.map(e => norm(e.name)).join(',');
    sequences.add(sequence);
    totalLength += build.length;

    for (const entity of build) {
      const name = norm(entity.name);
      unitCounts.set(name, (unitCounts.get(name) || 0) + 1);
    }
  }

  // Most common units
  const mostCommon = [...unitCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    uniqueSequences: sequences.size,
    totalBuilds: builds.length,
    averageLength: totalLength / builds.length,
    mostCommonUnits: mostCommon,
  };
}
