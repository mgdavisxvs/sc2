/**
 * Marginal Rate of Technical Substitution (MRTS) Analysis
 * Applies production economics to SC2 build order optimization
 *
 * MRTS = -Δ(Input₂) / Δ(Input₁) along an isoquant (constant output curve)
 */

import { logger } from '../core/logger.js';

/**
 * Calculate MRTS between two inputs
 * @param {Array} builds - Array of builds representing isoquant points
 * @param {string} input1 - First input dimension (e.g., 'minerals')
 * @param {string} input2 - Second input dimension (e.g., 'gas')
 * @returns {Object} MRTS analysis
 */
export function calculateMRTS(builds, input1, input2) {
  if (builds.length < 2) {
    return { mrts: null, error: 'Need at least 2 points for MRTS' };
  }

  // Sort by first input
  const sorted = [...builds].sort((a, b) => {
    const val1 = getInputValue(a, input1);
    const val2 = getInputValue(b, input1);
    return val1 - val2;
  });

  const mrtsPoints = [];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = sorted[i - 1];

    const delta1 = getInputValue(curr, input1) - getInputValue(prev, input1);
    const delta2 = getInputValue(curr, input2) - getInputValue(prev, input2);

    if (delta1 !== 0) {
      const mrts = -delta2 / delta1;

      mrtsPoints.push({
        point: i,
        input1Value: getInputValue(curr, input1),
        input2Value: getInputValue(curr, input2),
        delta1,
        delta2,
        mrts,
        interpretation: interpretMRTS(mrts, input1, input2),
      });
    }
  }

  // Calculate average MRTS
  const avgMRTS =
    mrtsPoints.reduce((sum, p) => sum + p.mrts, 0) / mrtsPoints.length;

  // Check for diminishing returns
  const diminishingReturns = checkDiminishingReturns(mrtsPoints);

  return {
    input1,
    input2,
    points: mrtsPoints,
    averageMRTS: avgMRTS,
    diminishingReturns,
    summary: generateMRTSSummary(avgMRTS, input1, input2, diminishingReturns),
  };
}

/**
 * Generate isoquants (constant output curves)
 * @param {string} outputMetric - What to hold constant (e.g., 'armyValue')
 * @param {number} targetOutput - Target output level
 * @param {Array} possibleBuilds - All possible build combinations
 * @returns {Array} Builds on the isoquant
 */
export function generateIsoquant(outputMetric, targetOutput, possibleBuilds) {
  const tolerance = targetOutput * 0.1; // 10% tolerance

  const isoquant = possibleBuilds.filter((build) => {
    const output = getOutputValue(build, outputMetric);
    return Math.abs(output - targetOutput) <= tolerance;
  });

  return {
    outputMetric,
    targetOutput,
    tolerance,
    builds: isoquant,
    count: isoquant.length,
  };
}

/**
 * Analyze resource substitution possibilities
 * @param {Object} build - Base build
 * @param {Object} substitutions - Substitution rules
 * @returns {Array} Alternative builds with substitutions
 */
export function analyzeResourceSubstitution(build, substitutions) {
  const alternatives = [];

  // Example: Zealots ↔ Stalkers
  const zealotCount = countUnit(build, 'Zealot');
  const stalkerCount = countUnit(build, 'Stalker');

  if (zealotCount >= 3) {
    // Substitute 3 Zealots (300m, 0g) → 2 Stalkers (250m, 100g)
    const alt = cloneBuild(build);
    removeUnits(alt, 'Zealot', 3);
    addUnits(alt, 'Stalker', 2);

    alternatives.push({
      type: 'mineral→gas',
      original: { zealots: zealotCount, stalkers: stalkerCount },
      modified: { zealots: zealotCount - 3, stalkers: stalkerCount + 2 },
      trade: { minerals: -50, gas: +100 },
      mrts: 100 / 50, // 2 gas per mineral saved
      build: alt,
    });
  }

  if (stalkerCount >= 2) {
    // Reverse: 2 Stalkers → 3 Zealots
    const alt = cloneBuild(build);
    removeUnits(alt, 'Stalker', 2);
    addUnits(alt, 'Zealot', 3);

    alternatives.push({
      type: 'gas→mineral',
      original: { zealots: zealotCount, stalkers: stalkerCount },
      modified: { zealots: zealotCount + 3, stalkers: stalkerCount - 2 },
      trade: { minerals: +50, gas: -100 },
      mrts: -50 / -100, // 0.5 minerals per gas saved
      build: alt,
    });
  }

  return alternatives;
}

/**
 * Calculate production efficiency frontier (Pareto + MRTS combined)
 * @param {Array} builds - All builds
 * @param {Array} objectives - Optimization objectives
 * @returns {Object} Efficiency analysis with MRTS
 */
export function calculateProductionEfficiency(builds, objectives) {
  // This integrates with existing Pareto frontier
  // Each point on Pareto frontier is an efficient production point
  // MRTS between adjacent Pareto points shows substitution rates

  const paretoBuilds = builds; // Simplified - would use findParetoFrontier

  const efficiencyAnalysis = {
    efficientBuilds: paretoBuilds.length,
    mrtsAnalysis: {},
  };

  // Calculate MRTS for each pair of objectives
  for (let i = 0; i < objectives.length; i++) {
    for (let j = i + 1; j < objectives.length; j++) {
      const obj1 = objectives[i].name;
      const obj2 = objectives[j].name;

      const mrts = calculateMRTS(paretoBuilds, obj1, obj2);
      efficiencyAnalysis.mrtsAnalysis[`${obj1}_${obj2}`] = mrts;
    }
  }

  return efficiencyAnalysis;
}

/**
 * Analyze time-resource tradeoffs
 * @param {Array} builds - Builds achieving same goal
 * @returns {Object} Time-cost MRTS
 */
export function analyzeTimeResourceTradeoff(builds) {
  // Sort builds by completion time
  const sorted = [...builds].sort((a, b) => a.completionTime - b.completionTime);

  const tradeoffs = [];

  for (let i = 1; i < sorted.length; i++) {
    const faster = sorted[i - 1];
    const slower = sorted[i];

    const timeSaved = slower.completionTime - faster.completionTime;
    const extraCost =
      faster.totalMinerals +
      faster.totalGas * 1.5 -
      (slower.totalMinerals + slower.totalGas * 1.5);

    const mrts = extraCost / timeSaved;

    tradeoffs.push({
      fasterBuild: faster.name,
      slowerBuild: slower.name,
      timeSaved,
      extraCost,
      mrts,
      interpretation: `Spending ${extraCost.toFixed(
        0
      )} resources saves ${timeSaved.toFixed(1)}s (${mrts.toFixed(
        1
      )} resources/second)`,
    });
  }

  return {
    tradeoffs,
    fastestBuild: sorted[0],
    cheapestBuild: sorted[sorted.length - 1],
    optimalBalance: findOptimalBalance(tradeoffs),
  };
}

/**
 * Worker-army tradeoff (critical for Zerg!)
 * @param {Array} builds - Builds with different drone/army ratios
 * @returns {Object} Worker-army MRTS
 */
export function analyzeWorkerArmyTradeoff(builds) {
  const analysis = builds.map((build) => {
    const workers = countWorkers(build);
    const armyUnits = countArmyUnits(build);
    const economicValue = workers * 50; // 50 minerals per worker
    const armyValue = calculateArmyValue(build);

    return {
      build,
      workers,
      armyUnits,
      economicValue,
      armyValue,
      totalValue: economicValue + armyValue,
    };
  });

  // Sort by workers
  analysis.sort((a, b) => a.workers - b.workers);

  const tradeoffs = [];

  for (let i = 1; i < analysis.length; i++) {
    const moreWorkers = analysis[i];
    const fewerWorkers = analysis[i - 1];

    const workerDiff = moreWorkers.workers - fewerWorkers.workers;
    const armyDiff = moreWorkers.armyUnits - fewerWorkers.armyUnits;

    const mrts = -armyDiff / workerDiff;

    tradeoffs.push({
      build: fewerWorkers.build.name,
      workers: fewerWorkers.workers,
      army: fewerWorkers.armyUnits,
      mrts,
      interpretation: `Each worker costs ${mrts.toFixed(
        1
      )} army supply (${armyDiff} army / ${workerDiff} workers)`,
    });
  }

  return {
    tradeoffs,
    recommendation: recommendWorkerArmyBalance(tradeoffs),
  };
}

/**
 * Calculate optimal input mix based on MRTS
 * @param {Object} prices - Input prices (e.g., {minerals: 1, gas: 1.5})
 * @param {Object} mrts - MRTS analysis
 * @returns {Object} Optimal input recommendation
 */
export function calculateOptimalInputMix(prices, mrts) {
  // At optimum: MRTS = Price ratio
  // MRTS(minerals→gas) should equal (P_gas / P_minerals)

  const priceRatio = prices.gas / prices.minerals;
  const currentMRTS = mrts.averageMRTS;

  let recommendation;

  if (Math.abs(currentMRTS - priceRatio) < 0.1) {
    recommendation = 'OPTIMAL: Current input mix is efficient';
  } else if (currentMRTS > priceRatio) {
    recommendation = `Use MORE ${mrts.input2}: MRTS (${currentMRTS.toFixed(
      2
    )}) > Price ratio (${priceRatio.toFixed(2)})`;
  } else {
    recommendation = `Use MORE ${mrts.input1}: MRTS (${currentMRTS.toFixed(
      2
    )}) < Price ratio (${priceRatio.toFixed(2)})`;
  }

  return {
    priceRatio,
    currentMRTS,
    optimal: Math.abs(currentMRTS - priceRatio) < 0.1,
    recommendation,
    explanation: generateOptimalityExplanation(
      currentMRTS,
      priceRatio,
      mrts.input1,
      mrts.input2
    ),
  };
}

/**
 * Helper: Get input value from build
 */
function getInputValue(build, inputName) {
  const inputMap = {
    minerals: () => build.totalMinerals || build.stats?.totalMinerals || 0,
    gas: () => build.totalGas || build.stats?.totalGas || 0,
    time: () => build.completionTime || 0,
    workers: () => countWorkers(build),
    supply: () => build.totalSupply || build.stats?.totalSupply || 0,
  };

  return inputMap[inputName] ? inputMap[inputName]() : 0;
}

/**
 * Helper: Get output value from build
 */
function getOutputValue(build, outputName) {
  const outputMap = {
    armyValue: () => calculateArmyValue(build),
    armySupply: () => countArmyUnits(build),
    economicPower: () => countWorkers(build) * 50,
    totalValue: () => calculateArmyValue(build) + countWorkers(build) * 50,
  };

  return outputMap[outputName] ? outputMap[outputName]() : 0;
}

/**
 * Helper: Count workers in build
 */
function countWorkers(build) {
  const buildOrder = build.buildOrder || build;
  if (!Array.isArray(buildOrder)) return 0;

  const workerNames = ['probe', 'scv', 'drone'];
  return buildOrder.filter((item) =>
    workerNames.includes(item.name?.toLowerCase())
  ).length;
}

/**
 * Helper: Count army units
 */
function countArmyUnits(build) {
  const buildOrder = build.buildOrder || build;
  if (!Array.isArray(buildOrder)) return 0;

  return buildOrder.filter((item) => item.kind === 'unit' && item.supply > 0).length;
}

/**
 * Helper: Calculate army value
 */
function calculateArmyValue(build) {
  const buildOrder = build.buildOrder || build;
  if (!Array.isArray(buildOrder)) return 0;

  return buildOrder
    .filter((item) => item.kind === 'unit')
    .reduce((sum, unit) => sum + (unit.mineral || 0) + (unit.gas || 0) * 1.5, 0);
}

/**
 * Helper: Count specific unit
 */
function countUnit(build, unitName) {
  const buildOrder = build.buildOrder || build;
  if (!Array.isArray(buildOrder)) return 0;

  return buildOrder.filter(
    (item) => item.name?.toLowerCase() === unitName.toLowerCase()
  ).length;
}

/**
 * Helper: Clone build
 */
function cloneBuild(build) {
  return JSON.parse(JSON.stringify(build));
}

/**
 * Helper: Remove units
 */
function removeUnits(build, unitName, count) {
  const buildOrder = build.buildOrder || build;
  let removed = 0;

  for (let i = buildOrder.length - 1; i >= 0 && removed < count; i--) {
    if (buildOrder[i].name?.toLowerCase() === unitName.toLowerCase()) {
      buildOrder.splice(i, 1);
      removed++;
    }
  }
}

/**
 * Helper: Add units
 */
function addUnits(build, unitName, count) {
  const buildOrder = build.buildOrder || build;
  // Simplified - would need full unit data
  for (let i = 0; i < count; i++) {
    buildOrder.push({ name: unitName, kind: 'unit' });
  }
}

/**
 * Interpret MRTS value
 */
function interpretMRTS(mrts, input1, input2) {
  if (mrts > 0) {
    return `1 ${input1} substitutes for ${mrts.toFixed(2)} ${input2}`;
  } else {
    return `Inverse relationship: ${Math.abs(mrts).toFixed(
      2
    )} ${input2} needed per ${input1}`;
  }
}

/**
 * Check for diminishing returns
 */
function checkDiminishingReturns(mrtsPoints) {
  if (mrtsPoints.length < 2) return false;

  // Diminishing returns = MRTS decreasing (in absolute value)
  const increasing = mrtsPoints.every(
    (p, i) => i === 0 || Math.abs(p.mrts) <= Math.abs(mrtsPoints[i - 1].mrts)
  );

  return {
    present: increasing,
    pattern: increasing ? 'Diminishing marginal returns detected' : 'Constant or increasing returns',
  };
}

/**
 * Generate MRTS summary
 */
function generateMRTSSummary(avgMRTS, input1, input2, diminishingReturns) {
  return {
    mainFinding: `Average substitution rate: ${Math.abs(avgMRTS).toFixed(
      2
    )} ${input2} per ${input1}`,
    returns: diminishingReturns.pattern,
    strategicImplication: getStrategicImplication(avgMRTS, input1, input2),
  };
}

/**
 * Get strategic implication
 */
function getStrategicImplication(mrts, input1, input2) {
  const implications = {
    'minerals-gas': () =>
      mrts > 2
        ? 'Gas-heavy composition is efficient'
        : 'Mineral-heavy composition is efficient',
    'time-minerals': () =>
      mrts > 20
        ? 'Fast production worth the cost'
        : 'Slower, cheaper production better',
    'workers-army': () =>
      mrts > 1.5
        ? 'Sacrifice workers for army (all-in)'
        : 'Keep economy (macro game)',
  };

  const key = `${input1}-${input2}`;
  return implications[key] ? implications[key]() : 'Optimize input mix for efficiency';
}

/**
 * Find optimal balance in time-resource tradeoff
 */
function findOptimalBalance(tradeoffs) {
  if (tradeoffs.length === 0) return null;

  // Find point where MRTS ≈ average (inflection point)
  const avgMRTS = tradeoffs.reduce((sum, t) => sum + t.mrts, 0) / tradeoffs.length;

  let closest = tradeoffs[0];
  let minDiff = Math.abs(tradeoffs[0].mrts - avgMRTS);

  tradeoffs.forEach((t) => {
    const diff = Math.abs(t.mrts - avgMRTS);
    if (diff < minDiff) {
      minDiff = diff;
      closest = t;
    }
  });

  return closest;
}

/**
 * Recommend worker-army balance
 */
function recommendWorkerArmyBalance(tradeoffs) {
  if (tradeoffs.length === 0) return 'Insufficient data';

  // High MRTS (>2): Losing many army per worker → keep workers
  // Low MRTS (<1): Losing few army per worker → can sacrifice workers

  const avgMRTS = tradeoffs.reduce((sum, t) => sum + t.mrts, 0) / tradeoffs.length;

  if (avgMRTS > 2) {
    return 'MACRO: High worker value - prioritize economy';
  } else if (avgMRTS < 1) {
    return 'AGGRESSIVE: Low worker value - can sacrifice for army';
  } else {
    return 'BALANCED: Moderate tradeoff - adapt to game state';
  }
}

/**
 * Generate optimality explanation
 */
function generateOptimalityExplanation(mrts, priceRatio, input1, input2) {
  if (Math.abs(mrts - priceRatio) < 0.1) {
    return `Your input mix is efficient! MRTS equals the price ratio.`;
  }

  if (mrts > priceRatio) {
    return `You're using too much ${input1}. Substitute towards ${input2} because ${input2} is relatively cheaper given current productivity.`;
  } else {
    return `You're using too much ${input2}. Substitute towards ${input1} because ${input1} is relatively cheaper given current productivity.`;
  }
}

export default {
  calculateMRTS,
  generateIsoquant,
  analyzeResourceSubstitution,
  calculateProductionEfficiency,
  analyzeTimeResourceTradeoff,
  analyzeWorkerArmyTradeoff,
  calculateOptimalInputMix,
};
