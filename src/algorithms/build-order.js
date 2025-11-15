/**
 * Build Order Algorithms
 * Validation, prerequisite checking, and build order analysis
 */

import { STARTING_UNITS } from '../core/config.js';
import { norm } from '../utils/dom.js';
import { logger } from '../core/logger.js';

/**
 * Get prerequisites for an entity
 * @param {Object} entity - Entity object
 * @returns {Array} List of prerequisite names
 */
export function getPrerequisites(entity) {
  const req = entity?.tech_tree?.requires ||
              entity?.required ||
              entity?.buildfrom ||
              null;
  if (!req) return [];
  return Array.isArray(req) ? req.map(String) : [String(req)];
}

/**
 * Check for missing prerequisites
 * @param {Object} entity - Entity to check
 * @param {Array} currentBuild - Current build order
 * @param {string} race - Race name
 * @returns {Array} List of missing prerequisite names
 */
export function findMissingPrereqs(entity, currentBuild, race) {
  // Build set of available entities
  const available = new Set(
    (STARTING_UNITS[race] || []).map(norm)
  );

  // Add all successfully built items (not locked)
  for (const item of currentBuild) {
    if (!item.locked) {
      available.add(norm(item.name));
    }
  }

  // Check which prerequisites are missing
  const required = getPrerequisites(entity).map(norm);
  return required.filter(req => !available.has(req));
}

/**
 * Validate entire build order
 *
 * THEOREM: A build order B = [b₁, b₂, ..., bₙ] is valid if and only if
 *          for all i, prerequisites(bᵢ) ⊆ {b₁, b₂, ..., bᵢ₋₁} ∪ STARTING_UNITS
 *
 * COMPLEXITY: O(n×m) where n = build length, m = avg prerequisites per unit
 *
 * @param {Array} buildOrder - Build order to validate
 * @param {string} race - Race name
 * @returns {Object} { valid: boolean, firstError?: Object, missing?: Array }
 */
export function validateBuildOrder(buildOrder, race) {
  const available = new Set(
    (STARTING_UNITS[race] || []).map(norm)
  );

  for (let i = 0; i < buildOrder.length; i++) {
    const item = buildOrder[i];
    const missing = getPrerequisites(item)
      .map(norm)
      .filter(req => !available.has(req));

    if (missing.length > 0) {
      logger.warn(`Build order invalid at step ${i + 1}:`, item.name, 'missing:', missing);
      return {
        valid: false,
        firstError: item,
        errorIndex: i,
        missing,
      };
    }

    // Add this item to available set
    available.add(norm(item.name));
  }

  return { valid: true };
}

/**
 * Calculate resource costs over time
 * @param {Array} buildOrder - Build order
 * @returns {Array} Array of { step, mineral, gas, supply, cumulativeMineral, cumulativeGas, cumulativeSupply }
 */
export function analyzeBuildCosts(buildOrder) {
  let totalMineral = 0;
  let totalGas = 0;
  let totalSupply = 0;

  return buildOrder.map((item, i) => {
    totalMineral += item.mineral || 0;
    totalGas += item.gas || 0;
    totalSupply += item.supply || 0;

    return {
      step: i + 1,
      name: item.name,
      mineral: item.mineral || 0,
      gas: item.gas || 0,
      supply: item.supply || 0,
      cumulativeMineral: totalMineral,
      cumulativeGas: totalGas,
      cumulativeSupply: totalSupply,
    };
  });
}

/**
 * Calculate build time (simplified - assumes instant resources and single producer)
 * @param {Array} buildOrder - Build order
 * @returns {number} Total build time in game seconds
 */
export function calculateBuildTime(buildOrder) {
  let totalTime = 0;

  for (const item of buildOrder) {
    totalTime += item.buildtime || 0;
  }

  return totalTime;
}

/**
 * Analyze supply blocks
 * @param {Array} buildOrder - Build order
 * @param {string} race - Race name
 * @returns {Array} List of supply blocks { step, required, available }
 */
export function findSupplyBlocks(buildOrder, race) {
  const STARTING_SUPPLY = { protoss: 15, terran: 15, zerg: 14 };
  let currentSupply = STARTING_SUPPLY[race] || 15;
  let usedSupply = 0;
  const blocks = [];

  for (let i = 0; i < buildOrder.length; i++) {
    const item = buildOrder[i];
    const required = item.supply || 0;
    const provided = item.supplyoffer || 0;

    // Check if this would cause a supply block
    if (usedSupply + required > currentSupply) {
      blocks.push({
        step: i + 1,
        name: item.name,
        required: usedSupply + required,
        available: currentSupply,
        blocked: true,
      });
    }

    usedSupply += required;
    currentSupply += provided;
  }

  return blocks;
}

/**
 * Compare two build orders
 * @param {Array} build1 - First build order
 * @param {Array} build2 - Second build order
 * @returns {Object} Comparison metrics
 */
export function compareBuildOrders(build1, build2) {
  const costs1 = analyzeBuildCosts(build1);
  const costs2 = analyzeBuildCosts(build2);

  const final1 = costs1[costs1.length - 1] || { cumulativeMineral: 0, cumulativeGas: 0, cumulativeSupply: 0 };
  const final2 = costs2[costs2.length - 1] || { cumulativeMineral: 0, cumulativeGas: 0, cumulativeSupply: 0 };

  return {
    build1: {
      steps: build1.length,
      totalMineral: final1.cumulativeMineral,
      totalGas: final1.cumulativeGas,
      totalSupply: final1.cumulativeSupply,
      buildTime: calculateBuildTime(build1),
    },
    build2: {
      steps: build2.length,
      totalMineral: final2.cumulativeMineral,
      totalGas: final2.cumulativeGas,
      totalSupply: final2.cumulativeSupply,
      buildTime: calculateBuildTime(build2),
    },
    difference: {
      steps: build2.length - build1.length,
      mineral: final2.cumulativeMineral - final1.cumulativeMineral,
      gas: final2.cumulativeGas - final1.cumulativeGas,
      supply: final2.cumulativeSupply - final1.cumulativeSupply,
      time: calculateBuildTime(build2) - calculateBuildTime(build1),
    },
  };
}

/**
 * Generate build order summary
 * @param {Array} buildOrder - Build order
 * @param {string} race - Race name
 * @returns {Object} Summary statistics
 */
export function summarizeBuildOrder(buildOrder, race) {
  const costs = analyzeBuildCosts(buildOrder);
  const validation = validateBuildOrder(buildOrder, race);
  const supplyBlocks = findSupplyBlocks(buildOrder, race);
  const final = costs[costs.length - 1] || { cumulativeMineral: 0, cumulativeGas: 0, cumulativeSupply: 0 };

  return {
    steps: buildOrder.length,
    valid: validation.valid,
    totalCost: {
      mineral: final.cumulativeMineral,
      gas: final.cumulativeGas,
      supply: final.cumulativeSupply,
    },
    estimatedTime: calculateBuildTime(buildOrder),
    supplyBlocks: supplyBlocks.length,
    invalidSteps: validation.valid ? 0 : 1,
    composition: {
      units: buildOrder.filter(b => b.kind === 'unit').length,
      buildings: buildOrder.filter(b => b.kind === 'building').length,
      upgrades: buildOrder.filter(b => b.kind === 'upgrade').length,
    },
  };
}
