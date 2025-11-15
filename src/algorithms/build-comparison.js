/**
 * Build Order Comparison Algorithms
 * Compare multiple builds using MRTS analysis, diff detection, and efficiency metrics
 */

import { calculateMRTS } from './mrts.js';

/**
 * Compare multiple build orders
 * @param {Array<Object>} builds - Array of build objects with metadata
 * @returns {Object} Comparison analysis
 */
export function compareBuilds(builds) {
  if (!builds || builds.length < 2) {
    return { error: 'Need at least 2 builds to compare' };
  }

  const analysis = {
    builds: builds.map(calculateBuildMetrics),
    mrts: calculateMRTSComparison(builds),
    diff: compareBuildSequences(builds),
    efficiency: calculateEfficiencyComparison(builds),
    recommendations: generateComparisonRecommendations(builds),
    timings: compareTimings(builds),
  };

  return analysis;
}

/**
 * Calculate metrics for a single build
 * @param {Object} build - Build object
 * @returns {Object} Build metrics
 */
function calculateBuildMetrics(build) {
  const buildOrder = build.buildOrder || [];

  const metrics = {
    id: build.id,
    name: build.name,
    race: build.race,
    description: build.description,
    tags: build.tags || [],
    totalMinerals: 0,
    totalGas: 0,
    totalSupply: 0,
    totalTime: 0,
    units: 0,
    buildings: 0,
    upgrades: 0,
    workers: 0,
    army: 0,
    mineralGasRatio: 0,
    supplyPerCost: 0,
    averageCost: 0,
    composition: {},
  };

  buildOrder.forEach(item => {
    metrics.totalMinerals += item.mineral || 0;
    metrics.totalGas += item.gas || 0;
    metrics.totalSupply += item.supply || 0;
    metrics.totalTime = Math.max(metrics.totalTime, item.buildtime || 0);

    // Count by kind
    if (item.kind === 'unit') metrics.units++;
    else if (item.kind === 'building') metrics.buildings++;
    else if (item.kind === 'upgrade') metrics.upgrades++;

    // Count workers and army
    const workerNames = ['probe', 'scv', 'drone'];
    if (workerNames.some(w => item.name.toLowerCase().includes(w))) {
      metrics.workers++;
    } else if (item.kind === 'unit') {
      metrics.army++;
    }

    // Track composition
    metrics.composition[item.name] = (metrics.composition[item.name] || 0) + 1;
  });

  // Calculate derived metrics
  metrics.mineralGasRatio = metrics.totalGas > 0
    ? metrics.totalMinerals / metrics.totalGas
    : Infinity;

  const totalCost = metrics.totalMinerals + metrics.totalGas;
  metrics.supplyPerCost = totalCost > 0
    ? metrics.totalSupply / totalCost
    : 0;

  metrics.averageCost = buildOrder.length > 0
    ? totalCost / buildOrder.length
    : 0;

  metrics.buildOrder = buildOrder;

  return metrics;
}

/**
 * Calculate MRTS comparison between builds
 * @param {Array<Object>} builds - Builds to compare
 * @returns {Object} MRTS analysis
 */
function calculateMRTSComparison(builds) {
  const metrics = builds.map(calculateBuildMetrics);

  // Calculate MRTS for mineral-gas tradeoff
  const mineralGasMRTS = calculateMRTS(metrics, 'totalMinerals', 'totalGas');

  // Calculate MRTS for time-cost tradeoff
  const timeCostMRTS = calculateMRTS(
    metrics.map(m => ({
      ...m,
      totalCost: m.totalMinerals + m.totalGas,
    })),
    'totalTime',
    'totalCost'
  );

  return {
    mineralGas: mineralGasMRTS,
    timeCost: timeCostMRTS,
    isoquants: generateIsoquantData(metrics),
  };
}

/**
 * Generate isoquant data for visualization
 * @param {Array<Object>} metrics - Build metrics
 * @returns {Array<Object>} Isoquant data
 */
function generateIsoquantData(metrics) {
  // Group builds by similar army value (±10%)
  const armyGroups = {};

  metrics.forEach(m => {
    const armyKey = Math.round(m.totalSupply / 10) * 10;
    if (!armyGroups[armyKey]) {
      armyGroups[armyKey] = [];
    }
    armyGroups[armyKey].push(m);
  });

  // Create isoquant for each group
  return Object.entries(armyGroups).map(([supply, builds]) => ({
    targetSupply: parseInt(supply),
    builds: builds.sort((a, b) => a.totalMinerals - b.totalMinerals),
  }));
}

/**
 * Compare build sequences to find differences
 * @param {Array<Object>} builds - Builds to compare
 * @returns {Object} Diff analysis
 */
function compareBuildSequences(builds) {
  if (builds.length < 2) return { differences: [] };

  const buildOrders = builds.map(b => b.buildOrder || []);
  const maxLength = Math.max(...buildOrders.map(bo => bo.length));

  const differences = [];
  const commonalities = [];

  // Compare step by step
  for (let i = 0; i < maxLength; i++) {
    const stepItems = buildOrders.map(bo => bo[i]);
    const names = stepItems.map(item => item?.name).filter(Boolean);
    const uniqueNames = [...new Set(names)];

    if (uniqueNames.length > 1) {
      // Difference found
      differences.push({
        step: i + 1,
        items: builds.map((b, idx) => ({
          buildName: b.name,
          item: stepItems[idx]?.name || '(empty)',
          mineral: stepItems[idx]?.mineral || 0,
          gas: stepItems[idx]?.gas || 0,
        })),
        type: 'divergence',
      });
    } else if (uniqueNames.length === 1) {
      // Common step
      commonalities.push({
        step: i + 1,
        item: uniqueNames[0],
      });
    }
  }

  return {
    differences,
    commonalities,
    divergencePoint: differences.length > 0 ? differences[0].step : null,
    similarity: commonalities.length / maxLength,
  };
}

/**
 * Calculate efficiency comparison
 * @param {Array<Object>} builds - Builds to compare
 * @returns {Object} Efficiency comparison
 */
function calculateEfficiencyComparison(builds) {
  const metrics = builds.map(calculateBuildMetrics);

  // Rank by different efficiency metrics
  const rankings = {
    costEfficiency: rankByMetric(metrics, 'supplyPerCost', true),
    mineralEfficiency: rankByMetric(metrics, m => m.totalSupply / m.totalMinerals, true),
    gasEfficiency: rankByMetric(metrics, m => m.totalGas > 0 ? m.totalSupply / m.totalGas : 0, true),
    economicPower: rankByMetric(metrics, 'workers', true),
    armyValue: rankByMetric(metrics, 'army', true),
    buildSpeed: rankByMetric(metrics, 'totalTime', false), // Lower is better
  };

  // Calculate overall efficiency score
  const scores = metrics.map((m, idx) => {
    let score = 0;
    Object.values(rankings).forEach(ranking => {
      const rank = ranking.findIndex(r => r.id === m.id);
      score += (metrics.length - rank); // Higher rank = more points
    });
    return {
      buildName: m.name,
      id: m.id,
      score,
      normalizedScore: score / (metrics.length * Object.keys(rankings).length),
    };
  });

  scores.sort((a, b) => b.score - a.score);

  return {
    rankings,
    overallScores: scores,
    winner: scores[0],
  };
}

/**
 * Rank builds by a metric
 * @param {Array<Object>} metrics - Build metrics
 * @param {string|Function} metricKey - Metric to rank by
 * @param {boolean} higherIsBetter - Whether higher values are better
 * @returns {Array<Object>} Ranked builds
 */
function rankByMetric(metrics, metricKey, higherIsBetter = true) {
  const getValue = typeof metricKey === 'function'
    ? metricKey
    : (m) => m[metricKey] || 0;

  const ranked = metrics.map(m => ({
    id: m.id,
    buildName: m.name,
    value: getValue(m),
  }));

  ranked.sort((a, b) => higherIsBetter ? b.value - a.value : a.value - b.value);

  return ranked.map((r, idx) => ({
    ...r,
    rank: idx + 1,
  }));
}

/**
 * Generate comparison recommendations
 * @param {Array<Object>} builds - Builds to compare
 * @returns {Array<Object>} Recommendations
 */
function generateComparisonRecommendations(builds) {
  const metrics = builds.map(calculateBuildMetrics);
  const recommendations = [];

  // Find most cost-efficient build
  const costEfficient = metrics.reduce((best, current) =>
    current.supplyPerCost > best.supplyPerCost ? current : best
  );

  recommendations.push({
    type: 'success',
    title: 'Most Cost Efficient',
    message: `"${costEfficient.name}" provides the best supply per resource invested (${(costEfficient.supplyPerCost * 100).toFixed(2)} supply per 100 resources)`,
    buildId: costEfficient.id,
  });

  // Find most gas-efficient build
  const gasEfficient = metrics.reduce((best, current) => {
    const bestRatio = best.totalGas > 0 ? best.totalSupply / best.totalGas : 0;
    const currentRatio = current.totalGas > 0 ? current.totalSupply / current.totalGas : 0;
    return currentRatio > bestRatio ? current : best;
  });

  if (gasEfficient.totalGas > 0) {
    recommendations.push({
      type: 'info',
      title: 'Most Gas Efficient',
      message: `"${gasEfficient.name}" gets the most value from gas investment`,
      buildId: gasEfficient.id,
    });
  }

  // Find fastest build
  const fastest = metrics.reduce((best, current) =>
    current.totalTime < best.totalTime ? current : best
  );

  recommendations.push({
    type: 'info',
    title: 'Fastest Build',
    message: `"${fastest.name}" completes in ${fastest.totalTime}s`,
    buildId: fastest.id,
  });

  // Check for timing differences
  const timeDiffs = [];
  for (let i = 1; i < metrics.length; i++) {
    const diff = Math.abs(metrics[i].totalTime - metrics[0].totalTime);
    if (diff > 30) {
      timeDiffs.push({
        build1: metrics[0].name,
        build2: metrics[i].name,
        difference: diff,
      });
    }
  }

  if (timeDiffs.length > 0) {
    recommendations.push({
      type: 'warning',
      title: 'Significant Timing Difference',
      message: `${timeDiffs[0].build1} and ${timeDiffs[0].build2} differ by ${timeDiffs[0].difference}s - choose based on game situation`,
    });
  }

  // MRTS optimization recommendation
  const mineralGasVariance = calculateVariance(metrics.map(m => m.mineralGasRatio));
  if (mineralGasVariance > 2) {
    recommendations.push({
      type: 'success',
      title: 'Good Resource Diversity',
      message: 'These builds explore different mineral-gas tradeoffs. Use MRTS analysis to choose optimal build based on map and opponent.',
    });
  }

  return recommendations;
}

/**
 * Compare timing attacks
 * @param {Array<Object>} builds - Builds to compare
 * @returns {Object} Timing comparison
 */
function compareTimings(builds) {
  const metrics = builds.map(calculateBuildMetrics);

  const timings = metrics.map(m => ({
    buildName: m.name,
    id: m.id,
    completionTime: m.totalTime,
    armyAtThree: calculateArmyAtTime(m.buildOrder, 180), // 3:00
    armyAtFour: calculateArmyAtTime(m.buildOrder, 240),  // 4:00
    armyAtFive: calculateArmyAtTime(m.buildOrder, 300),  // 5:00
    workersAtThree: calculateWorkersAtTime(m.buildOrder, 180),
    workersAtFour: calculateWorkersAtTime(m.buildOrder, 240),
    workersAtFive: calculateWorkersAtTime(m.buildOrder, 300),
  }));

  return {
    timings,
    strongestAtThree: findStrongestAt(timings, 'armyAtThree'),
    strongestAtFour: findStrongestAt(timings, 'armyAtFour'),
    strongestAtFive: findStrongestAt(timings, 'armyAtFive'),
  };
}

/**
 * Calculate army value at specific time
 * @param {Array} buildOrder - Build order
 * @param {number} time - Time in seconds
 * @returns {number} Army supply
 */
function calculateArmyAtTime(buildOrder, time) {
  // Simplified: assume sequential production
  let currentTime = 0;
  let army = 0;

  const workerNames = ['probe', 'scv', 'drone'];

  for (const item of buildOrder) {
    currentTime += item.buildtime || 0;
    if (currentTime > time) break;

    if (item.kind === 'unit' && !workerNames.some(w => item.name.toLowerCase().includes(w))) {
      army += item.supply || 0;
    }
  }

  return army;
}

/**
 * Calculate workers at specific time
 * @param {Array} buildOrder - Build order
 * @param {number} time - Time in seconds
 * @returns {number} Worker count
 */
function calculateWorkersAtTime(buildOrder, time) {
  let currentTime = 0;
  let workers = 0;

  const workerNames = ['probe', 'scv', 'drone'];

  for (const item of buildOrder) {
    currentTime += item.buildtime || 0;
    if (currentTime > time) break;

    if (workerNames.some(w => item.name.toLowerCase().includes(w))) {
      workers++;
    }
  }

  return workers;
}

/**
 * Find strongest build at specific timing
 * @param {Array} timings - Timing data
 * @param {string} metric - Metric to compare
 * @returns {Object} Strongest build
 */
function findStrongestAt(timings, metric) {
  return timings.reduce((best, current) =>
    current[metric] > best[metric] ? current : best
  );
}

/**
 * Calculate variance of an array
 * @param {Array<number>} values - Values
 * @returns {number} Variance
 */
function calculateVariance(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Find common opening between builds
 * @param {Array<Object>} builds - Builds to compare
 * @returns {Object} Common opening analysis
 */
export function findCommonOpening(builds) {
  if (builds.length < 2) return { commonSteps: 0, opening: [] };

  const buildOrders = builds.map(b => b.buildOrder || []);
  const minLength = Math.min(...buildOrders.map(bo => bo.length));

  let commonSteps = 0;
  const opening = [];

  for (let i = 0; i < minLength; i++) {
    const items = buildOrders.map(bo => bo[i].name);
    const allSame = items.every(name => name === items[0]);

    if (allSame) {
      commonSteps++;
      opening.push(buildOrders[0][i]);
    } else {
      break; // Stop at first difference
    }
  }

  return {
    commonSteps,
    opening,
    divergenceStep: commonSteps + 1,
  };
}

/**
 * Calculate similarity score between two builds
 * @param {Object} build1 - First build
 * @param {Object} build2 - Second build
 * @returns {number} Similarity score (0-1)
 */
export function calculateSimilarity(build1, build2) {
  const bo1 = build1.buildOrder || [];
  const bo2 = build2.buildOrder || [];

  // Jaccard similarity of unit composition
  const units1 = new Set(bo1.map(item => item.name));
  const units2 = new Set(bo2.map(item => item.name));

  const intersection = new Set([...units1].filter(x => units2.has(x)));
  const union = new Set([...units1, ...units2]);

  const jaccardSimilarity = intersection.size / union.size;

  // Sequence similarity (Levenshtein-like)
  const maxLength = Math.max(bo1.length, bo2.length);
  let matches = 0;

  for (let i = 0; i < Math.min(bo1.length, bo2.length); i++) {
    if (bo1[i].name === bo2[i].name) {
      matches++;
    }
  }

  const sequenceSimilarity = matches / maxLength;

  // Combined score (weighted average)
  return (jaccardSimilarity * 0.4 + sequenceSimilarity * 0.6);
}
