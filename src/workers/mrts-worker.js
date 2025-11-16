/**
 * Web Worker for MRTS Calculations
 * Offloads heavy economic analysis computations to background thread
 */

// Import MRTS algorithms
// Note: In a real web worker, we'd need to use importScripts() or ES modules
// For now, we'll inline the necessary functions

/**
 * Get input value from build
 */
function getInputValue(build, input) {
  const mapping = {
    minerals: build.totalMinerals || 0,
    gas: build.totalGas || 0,
    time: build.totalTime || 0,
    supply: build.totalSupply || 0,
    workers: build.workerCount || build.workers || 0,
    army: build.armyValue || build.army || 0,
  };

  return mapping[input] || 0;
}

/**
 * Interpret MRTS value
 */
function interpretMRTS(mrts, input1, input2) {
  if (mrts > 1) {
    return `High substitution: ${mrts.toFixed(2)} ${input2} per 1 ${input1}`;
  } else if (mrts < 0.5) {
    return `Low substitution: ${mrts.toFixed(2)} ${input2} per 1 ${input1}`;
  } else {
    return `Moderate substitution: ${mrts.toFixed(2)} ${input2} per 1 ${input1}`;
  }
}

/**
 * Check for diminishing returns
 */
function checkDiminishingReturns(mrtsPoints) {
  if (mrtsPoints.length < 2) {
    return { detected: false };
  }

  let diminishing = true;
  for (let i = 1; i < mrtsPoints.length; i++) {
    if (mrtsPoints[i].mrts >= mrtsPoints[i - 1].mrts) {
      diminishing = false;
      break;
    }
  }

  return {
    detected: diminishing,
    description: diminishing
      ? 'MRTS is decreasing (diminishing marginal returns)'
      : 'MRTS is not consistently decreasing',
  };
}

/**
 * Generate MRTS summary
 */
function generateMRTSSummary(avgMRTS, input1, input2, diminishingReturns) {
  return `Average MRTS: ${avgMRTS.toFixed(2)} ${input2} per ${input1}. ${
    diminishingReturns.detected ? 'Diminishing returns detected.' : ''
  }`;
}

/**
 * Calculate MRTS between two inputs
 */
function calculateMRTS(builds, input1, input2) {
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
 * Generate isoquant
 */
function generateIsoquant(outputMetric, targetOutput, possibleBuilds) {
  const tolerance = targetOutput * 0.1; // 10% tolerance

  const isoquant = possibleBuilds.filter((build) => {
    const output = getInputValue(build, outputMetric);
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
 * Analyze time-resource tradeoff
 */
function analyzeTimeResourceTradeoff(builds) {
  const analysis = [];

  builds.forEach((build, idx) => {
    const totalCost = (build.totalMinerals || 0) + (build.totalGas || 0) * 2; // Gas weighted 2x
    const time = build.totalTime || 1;

    analysis.push({
      build: build.name || `Build ${idx + 1}`,
      totalCost,
      time,
      costPerSecond: totalCost / time,
      timeEfficiency: time / totalCost,
    });
  });

  return analysis;
}

// Worker message handler
self.addEventListener('message', (event) => {
  const { type, data, id } = event.data;

  try {
    let result;

    switch (type) {
      case 'calculateMRTS':
        result = calculateMRTS(data.builds, data.input1, data.input2);
        break;

      case 'generateIsoquant':
        result = generateIsoquant(
          data.outputMetric,
          data.targetOutput,
          data.possibleBuilds
        );
        break;

      case 'analyzeTimeResourceTradeoff':
        result = analyzeTimeResourceTradeoff(data.builds);
        break;

      case 'batchMRTS':
        // Calculate MRTS for multiple input pairs
        result = data.inputPairs.map((pair) =>
          calculateMRTS(data.builds, pair.input1, pair.input2)
        );
        break;

      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    // Send result back
    self.postMessage({
      id,
      type,
      status: 'success',
      result,
    });
  } catch (error) {
    self.postMessage({
      id,
      type,
      status: 'error',
      error: error.message,
    });
  }
});

// Worker ready notification
self.postMessage({ status: 'ready' });
