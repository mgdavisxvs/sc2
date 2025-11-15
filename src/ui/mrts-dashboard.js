/**
 * MRTS Analysis Dashboard
 * Integrates economic analysis (Marginal Rate of Technical Substitution) into the UI
 */

import {
  calculateMRTS,
  generateIsoquant,
  analyzeResourceSubstitution,
  analyzeTimeResourceTradeoff,
  calculateOptimalInputMix,
} from '../algorithms/mrts.js';

import {
  renderIsoquantCurves,
  renderMRTSSlopes,
  renderProductionPossibilityFrontier,
} from './mrts-viz.js';

import { logger } from '../core/logger.js';

/**
 * Render MRTS dashboard in container
 * @param {HTMLElement} container - Container element
 * @param {Array} buildOrder - Current build order
 * @param {string} race - Current race
 */
export default function createMRTSDashboard(container, buildOrder, race) {
  if (!container) {
    logger.error('MRTS dashboard: container is null');
    return;
  }

  if (!buildOrder || buildOrder.length === 0) {
    container.innerHTML = `
      <div class="text-center py-20">
        <div class="text-6xl mb-4">📊</div>
        <h3 class="text-xl font-semibold mb-2 text-slate-700 dark:text-slate-300">No Build Order</h3>
        <p class="text-slate-600 dark:text-slate-400">Add units and buildings to analyze resource tradeoffs</p>
      </div>
    `;
    return;
  }

  // Initialize with overview tab
  renderOverviewTab(container, buildOrder, race);

  // Set up tab switching
  setupTabSwitching(container, buildOrder, race);
}

/**
 * Setup tab switching for MRTS analysis
 * @param {HTMLElement} container - Container element
 * @param {Array} buildOrder - Build order
 * @param {string} race - Race
 */
function setupTabSwitching(container, buildOrder, race) {
  const tabs = document.querySelectorAll('.mrts-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab styling
      tabs.forEach(t => {
        t.classList.remove('border-orange-600', 'text-orange-600');
        t.classList.add('border-transparent', 'text-slate-600', 'dark:text-slate-400');
      });

      tab.classList.remove('border-transparent', 'text-slate-600', 'dark:text-slate-400');
      tab.classList.add('border-orange-600', 'text-orange-600');

      // Render appropriate tab content
      const tabName = tab.dataset.tab;
      switch (tabName) {
        case 'overview':
          renderOverviewTab(container, buildOrder, race);
          break;
        case 'mineral-gas':
          renderMineralGasTab(container, buildOrder, race);
          break;
        case 'time-cost':
          renderTimeCostTab(container, buildOrder, race);
          break;
        case 'recommendations':
          renderRecommendationsTab(container, buildOrder, race);
          break;
      }
    });
  });
}

/**
 * Calculate build totals
 * @param {Array} buildOrder - Build order
 * @returns {Object} Totals
 */
function calculateBuildTotals(buildOrder) {
  const totals = {
    totalMinerals: 0,
    totalGas: 0,
    totalSupply: 0,
    units: 0,
    buildings: 0,
    upgrades: 0,
  };

  buildOrder.forEach(item => {
    totals.totalMinerals += item.mineral || 0;
    totals.totalGas += item.gas || 0;
    totals.totalSupply += item.supply || 0;

    if (item.kind === 'unit') totals.units++;
    else if (item.kind === 'building') totals.buildings++;
    else if (item.kind === 'upgrade') totals.upgrades++;
  });

  return totals;
}

/**
 * Render overview tab
 * @param {HTMLElement} container - Container
 * @param {Array} buildOrder - Build order
 * @param {string} race - Race
 */
function renderOverviewTab(container, buildOrder, race) {
  const totals = calculateBuildTotals(buildOrder);

  // Calculate mineral-gas ratio
  const mineralGasRatio = totals.totalGas > 0
    ? (totals.totalMinerals / totals.totalGas).toFixed(2)
    : 'N/A';

  // Calculate resource efficiency
  const totalCost = totals.totalMinerals + totals.totalGas;
  const efficiency = totalCost > 0
    ? ((totals.totalSupply / totalCost) * 100).toFixed(2)
    : 0;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
        <h3 class="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">Economic Analysis Overview</h3>
        <p class="text-slate-700 dark:text-slate-300 text-sm">
          Analyzing resource tradeoffs using <strong>Marginal Rate of Technical Substitution (MRTS)</strong>
        </p>
        <p class="text-slate-600 dark:text-slate-400 text-xs mt-2">
          Race: <strong class="text-orange-600">${race.charAt(0).toUpperCase() + race.slice(1)}</strong> |
          Build Steps: <strong>${buildOrder.length}</strong>
        </p>
      </div>

      <!-- Resource Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Minerals</div>
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">${totals.totalMinerals}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Gas</div>
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">${totals.totalGas}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Supply</div>
          <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">${totals.totalSupply}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">M:G Ratio</div>
          <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">${mineralGasRatio}</div>
        </div>
      </div>

      <!-- Build Composition -->
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Build Composition</h4>
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div class="text-3xl mb-2">⚔️</div>
            <div class="text-2xl font-bold text-slate-900 dark:text-slate-100">${totals.units}</div>
            <div class="text-xs text-slate-600 dark:text-slate-400">Units</div>
          </div>
          <div class="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div class="text-3xl mb-2">🏛️</div>
            <div class="text-2xl font-bold text-slate-900 dark:text-slate-100">${totals.buildings}</div>
            <div class="text-xs text-slate-600 dark:text-slate-400">Buildings</div>
          </div>
          <div class="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div class="text-3xl mb-2">⚡</div>
            <div class="text-2xl font-bold text-slate-900 dark:text-slate-100">${totals.upgrades}</div>
            <div class="text-xs text-slate-600 dark:text-slate-400">Upgrades</div>
          </div>
        </div>
      </div>

      <!-- Economic Insights -->
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Economic Insights</h4>
        <div class="space-y-3 text-sm">
          <div class="flex items-start gap-3">
            <span class="text-xl">💰</span>
            <div>
              <div class="font-medium text-slate-900 dark:text-slate-100">Resource Efficiency</div>
              <div class="text-slate-600 dark:text-slate-400">
                ${efficiency} supply per 100 resources invested
              </div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-xl">⚖️</span>
            <div>
              <div class="font-medium text-slate-900 dark:text-slate-100">Mineral-Gas Balance</div>
              <div class="text-slate-600 dark:text-slate-400">
                ${totals.totalGas > 0
                  ? `Spending ${mineralGasRatio} minerals per 1 gas`
                  : 'No gas units - pure mineral build'}
              </div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-xl">📊</span>
            <div>
              <div class="font-medium text-slate-900 dark:text-slate-100">MRTS Analysis Available</div>
              <div class="text-slate-600 dark:text-slate-400">
                Switch to other tabs to see detailed resource substitution analysis,
                isoquant curves, and optimization recommendations
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- What is MRTS? -->
      <div class="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <h4 class="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">What is MRTS?</h4>
        <div class="text-sm text-slate-700 dark:text-slate-300 space-y-2">
          <p>
            <strong>Marginal Rate of Technical Substitution</strong> measures how much of one resource
            can be substituted for another while maintaining the same output level.
          </p>
          <p class="font-mono text-xs bg-white dark:bg-slate-800 p-2 rounded border">
            MRTS = -Δ(Resource₂) / Δ(Resource₁) along an isoquant
          </p>
          <p>
            For SC2: If MRTS(minerals→gas) = 2.5, you can trade 1 mineral for 2.5 gas
            while maintaining the same army value. This helps optimize resource allocation!
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render mineral-gas analysis tab
 * @param {HTMLElement} container - Container
 * @param {Array} buildOrder - Build order
 * @param {string} race - Race
 */
function renderMineralGasTab(container, buildOrder, race) {
  const totals = calculateBuildTotals(buildOrder);

  // For now, show a simpler visualization since we need multiple builds for true MRTS
  // In the future, this could compare with alternative builds from the library

  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 class="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">Mineral-Gas Substitution Analysis</h3>
        <p class="text-slate-700 dark:text-slate-300 text-sm">
          Analyzing the tradeoff between mineral-heavy and gas-heavy unit compositions
        </p>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Current Build Resources</h4>
        <div class="grid grid-cols-2 gap-6">
          <div>
            <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">Minerals</div>
            <div class="h-8 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
              <div class="h-full bg-blue-500" style="width: ${totals.totalMinerals > 0 ? 100 : 0}%"></div>
            </div>
            <div class="text-2xl font-bold mt-2 text-blue-600 dark:text-blue-400">${totals.totalMinerals}</div>
          </div>
          <div>
            <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">Gas</div>
            <div class="h-8 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
              <div class="h-full bg-green-500" style="width: ${totals.totalGas > 0 ? (totals.totalGas / totals.totalMinerals * 100) : 0}%"></div>
            </div>
            <div class="text-2xl font-bold mt-2 text-green-600 dark:text-green-400">${totals.totalGas}</div>
          </div>
        </div>
      </div>

      <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6 border border-amber-200 dark:border-amber-800">
        <div class="flex items-start gap-3">
          <span class="text-2xl">💡</span>
          <div>
            <h4 class="font-semibold text-amber-900 dark:text-amber-100 mb-2">Analysis Insight</h4>
            <p class="text-sm text-amber-800 dark:text-amber-200">
              ${totals.totalGas === 0
                ? 'This is a pure mineral build. Consider adding gas units for better cost efficiency and unit versatility.'
                : totals.totalMinerals / totals.totalGas > 5
                ? 'Mineral-heavy build. You have resources available for more gas units if needed.'
                : totals.totalMinerals / totals.totalGas < 2
                ? 'Gas-heavy build. Ensure you have enough mineral income to support continuous production.'
                : 'Balanced mineral-gas composition. Good resource allocation!'
              }
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Resource Distribution by Unit</h4>
        <div class="space-y-3">
          ${buildOrder.map((item, index) => {
            const mineralPercent = totals.totalMinerals > 0 ? (item.mineral / totals.totalMinerals * 100).toFixed(1) : 0;
            const gasPercent = totals.totalGas > 0 ? (item.gas / totals.totalGas * 100).toFixed(1) : 0;

            return `
              <div class="text-sm">
                <div class="font-medium text-slate-900 dark:text-slate-100 mb-1">
                  ${index + 1}. ${item.name}
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <div class="h-full bg-blue-500" style="width: ${mineralPercent}%"></div>
                    </div>
                    <span class="text-xs text-slate-600 dark:text-slate-400 w-16">${item.mineral}m (${mineralPercent}%)</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <div class="h-full bg-green-500" style="width: ${gasPercent}%"></div>
                    </div>
                    <span class="text-xs text-slate-600 dark:text-slate-400 w-16">${item.gas}g (${gasPercent}%)</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render time-cost analysis tab
 * @param {HTMLElement} container - Container
 * @param {Array} buildOrder - Build order
 * @param {string} race - Race
 */
function renderTimeCostTab(container, buildOrder, race) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
        <h3 class="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">Time-Cost Tradeoff Analysis</h3>
        <p class="text-slate-700 dark:text-slate-300 text-sm">
          Understanding the relationship between production time and resource investment
        </p>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Build Timeline</h4>
        <div class="space-y-3">
          ${buildOrder.map((item, index) => {
            const buildTime = item.buildtime || 0;
            const maxTime = Math.max(...buildOrder.map(i => i.buildtime || 0));
            const timePercent = maxTime > 0 ? (buildTime / maxTime * 100) : 0;

            return `
              <div class="text-sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-slate-900 dark:text-slate-100">
                    ${index + 1}. ${item.name}
                  </span>
                  <span class="text-xs text-slate-600 dark:text-slate-400">
                    ${buildTime}s | ${item.mineral}m ${item.gas}g
                  </span>
                </div>
                <div class="h-3 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
                  <div class="h-full bg-purple-500" style="width: ${timePercent}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <div class="flex items-start gap-3">
          <span class="text-2xl">⏱️</span>
          <div>
            <h4 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">Time Optimization</h4>
            <p class="text-sm text-blue-800 dark:text-blue-200">
              MRTS analysis can help determine if spending additional resources for faster production
              (e.g., extra production facilities, chrono boost) is worth the cost. For rush builds,
              time is critical. For macro builds, resource efficiency matters more.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render recommendations tab
 * @param {HTMLElement} container - Container
 * @param {Array} buildOrder - Build order
 * @param {string} race - Race
 */
function renderRecommendationsTab(container, buildOrder, race) {
  const totals = calculateBuildTotals(buildOrder);
  const mineralGasRatio = totals.totalGas > 0 ? totals.totalMinerals / totals.totalGas : Infinity;

  // Generate recommendations based on current build
  const recommendations = [];

  if (totals.totalGas === 0) {
    recommendations.push({
      type: 'warning',
      title: 'No Gas Units',
      message: 'Consider adding gas-based units for better army composition and flexibility.',
      priority: 'high',
    });
  } else if (mineralGasRatio > 5) {
    recommendations.push({
      type: 'info',
      title: 'Mineral-Heavy Build',
      message: 'You have excess mineral allocation. Gas units are generally more cost-efficient per supply.',
      priority: 'medium',
    });
  } else if (mineralGasRatio < 2) {
    recommendations.push({
      type: 'info',
      title: 'Gas-Heavy Build',
      message: 'Heavy gas investment. Ensure mineral income supports continuous production.',
      priority: 'medium',
    });
  }

  if (totals.buildings < 3) {
    recommendations.push({
      type: 'warning',
      title: 'Limited Production',
      message: 'Few production buildings detected. Consider adding more for sustained unit production.',
      priority: 'high',
    });
  }

  if (totals.upgrades === 0) {
    recommendations.push({
      type: 'info',
      title: 'No Upgrades',
      message: 'No upgrades in build order. Upgrades provide excellent long-term value.',
      priority: 'low',
    });
  }

  // Always include MRTS optimization recommendation
  recommendations.push({
    type: 'success',
    title: 'MRTS Optimization',
    message: 'To fully utilize MRTS analysis, save multiple build variations and compare their resource efficiency on isoquant curves.',
    priority: 'medium',
  });

  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
        <h3 class="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">Strategic Recommendations</h3>
        <p class="text-slate-700 dark:text-slate-300 text-sm">
          Economic insights and optimization suggestions based on MRTS principles
        </p>
      </div>

      <div class="space-y-4">
        ${recommendations.map(rec => {
          const colorMap = {
            success: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', icon: '✅', textColor: 'text-green-900 dark:text-green-100' },
            info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: '💡', textColor: 'text-blue-900 dark:text-blue-100' },
            warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: '⚠️', textColor: 'text-amber-900 dark:text-amber-100' },
          };

          const colors = colorMap[rec.type] || colorMap.info;

          return `
            <div class="${colors.bg} rounded-lg p-4 border ${colors.border}">
              <div class="flex items-start gap-3">
                <span class="text-2xl">${colors.icon}</span>
                <div class="flex-1">
                  <h4 class="font-semibold ${colors.textColor} mb-1">${rec.title}</h4>
                  <p class="text-sm ${colors.textColor.replace('900', '800').replace('100', '200')}">${rec.message}</p>
                  <div class="mt-2">
                    <span class="text-xs px-2 py-1 rounded ${colors.bg} border ${colors.border} ${colors.textColor}">
                      ${rec.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Economic Principles</h4>
        <div class="space-y-3 text-sm">
          <div class="flex items-start gap-3">
            <span class="text-orange-600 font-bold">1.</span>
            <div>
              <div class="font-medium text-slate-900 dark:text-slate-100">Diminishing Returns</div>
              <div class="text-slate-600 dark:text-slate-400">
                First units of a type are most efficient. Diversify unit composition for better MRTS.
              </div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-orange-600 font-bold">2.</span>
            <div>
              <div class="font-medium text-slate-900 dark:text-slate-100">Resource Balance</div>
              <div class="text-slate-600 dark:text-slate-400">
                Optimal when MRTS equals price ratio. Balance mineral and gas units for efficiency.
              </div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-orange-600 font-bold">3.</span>
            <div>
              <div class="font-medium text-slate-900 dark:text-slate-100">Time vs Cost</div>
              <div class="text-slate-600 dark:text-slate-400">
                Faster production costs more. Evaluate if time savings justify extra investment.
              </div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-orange-600 font-bold">4.</span>
            <div>
              <div class="font-medium text-slate-900 dark:text-slate-100">Worker-Army Tradeoff</div>
              <div class="text-slate-600 dark:text-slate-400">
                Each worker sacrificed for army has an opportunity cost. Balance economy and defense.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
