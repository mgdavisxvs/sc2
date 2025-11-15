/**
 * Build Order Comparison Dashboard
 * Visual interface for comparing multiple builds side-by-side
 */

import { compareBuilds, findCommonOpening, calculateSimilarity } from '../algorithms/build-comparison.js';
import { logger } from '../core/logger.js';

/**
 * Render build comparison dashboard
 * @param {HTMLElement} container - Container element
 * @param {Array<Object>} builds - Builds to compare (2-4 builds)
 */
export default function createComparisonDashboard(container, builds) {
  if (!container) {
    logger.error('Comparison dashboard: container is null');
    return;
  }

  if (!builds || builds.length < 2) {
    container.innerHTML = `
      <div class="text-center py-20">
        <div class="text-6xl mb-4">⚖️</div>
        <h3 class="text-xl font-semibold mb-2 text-slate-700 dark:text-slate-300">Select Builds to Compare</h3>
        <p class="text-slate-600 dark:text-slate-400">Choose 2-4 builds from your library to compare</p>
      </div>
    `;
    return;
  }

  if (builds.length > 4) {
    builds = builds.slice(0, 4); // Limit to 4 builds
  }

  // Run comparison analysis
  const analysis = compareBuilds(builds);

  if (analysis.error) {
    container.innerHTML = `
      <div class="text-center py-20 text-red-600">
        <div class="text-6xl mb-4">❌</div>
        <h3 class="text-xl font-semibold mb-2">Comparison Error</h3>
        <p>${analysis.error}</p>
      </div>
    `;
    return;
  }

  // Initialize with overview tab
  renderOverviewTab(container, builds, analysis);

  // Set up tab switching
  setupTabSwitching(container, builds, analysis);
}

/**
 * Setup tab switching
 * @param {HTMLElement} container - Container
 * @param {Array} builds - Builds
 * @param {Object} analysis - Analysis data
 */
function setupTabSwitching(container, builds, analysis) {
  const tabs = document.querySelectorAll('.comparison-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab styling
      tabs.forEach(t => {
        t.classList.remove('border-indigo-600', 'text-indigo-600');
        t.classList.add('border-transparent', 'text-slate-600', 'dark:text-slate-400');
      });

      tab.classList.remove('border-transparent', 'text-slate-600', 'dark:text-slate-400');
      tab.classList.add('border-indigo-600', 'text-indigo-600');

      // Render appropriate tab content
      const tabName = tab.dataset.tab;
      switch (tabName) {
        case 'overview':
          renderOverviewTab(container, builds, analysis);
          break;
        case 'side-by-side':
          renderSideBySideTab(container, builds, analysis);
          break;
        case 'differences':
          renderDifferencesTab(container, builds, analysis);
          break;
        case 'efficiency':
          renderEfficiencyTab(container, builds, analysis);
          break;
        case 'timings':
          renderTimingsTab(container, builds, analysis);
          break;
      }
    });
  });
}

/**
 * Render overview tab
 */
function renderOverviewTab(container, builds, analysis) {
  const winner = analysis.efficiency.winner;
  const commonOpening = findCommonOpening(builds);

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
        <h3 class="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">Comparing ${builds.length} Builds</h3>
        <p class="text-slate-700 dark:text-slate-300 text-sm">
          Side-by-side analysis with MRTS optimization insights
        </p>
      </div>

      <!-- Quick Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${analysis.builds.map((b, idx) => `
          <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border-2 ${winner.id === b.id ? 'border-green-500' : 'border-slate-200 dark:border-slate-700'} shadow-sm">
            <div class="flex items-start justify-between mb-2">
              <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Build ${idx + 1}</div>
              ${winner.id === b.id ? '<div class="text-xl">🏆</div>' : ''}
            </div>
            <div class="font-bold text-slate-900 dark:text-slate-100 mb-1 truncate" title="${b.name}">${b.name}</div>
            <div class="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div>${b.totalMinerals}m ${b.totalGas}g</div>
              <div>${b.totalSupply} supply</div>
              <div>${b.units} units</div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Overall Winner -->
      <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
        <div class="flex items-start gap-3">
          <span class="text-3xl">🏆</span>
          <div class="flex-1">
            <h4 class="font-semibold text-green-900 dark:text-green-100 mb-2">Most Efficient Overall</h4>
            <p class="text-sm text-green-800 dark:text-green-200 mb-2">
              <strong>"${winner.buildName}"</strong> ranks highest across all efficiency metrics
            </p>
            <div class="text-xs text-green-700 dark:text-green-300">
              Overall Score: ${winner.score} / ${builds.length * 6} (${(winner.normalizedScore * 100).toFixed(1)}%)
            </div>
          </div>
        </div>
      </div>

      <!-- Common Opening -->
      ${commonOpening.commonSteps > 0 ? `
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
          <div class="flex items-start gap-3">
            <span class="text-2xl">🔗</span>
            <div>
              <h4 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">Common Opening</h4>
              <p class="text-sm text-blue-800 dark:text-blue-200 mb-3">
                All builds share the first ${commonOpening.commonSteps} steps, then diverge at step ${commonOpening.divergenceStep}
              </p>
              <div class="space-y-1">
                ${commonOpening.opening.slice(0, 5).map((item, idx) => `
                  <div class="text-xs text-blue-700 dark:text-blue-300">
                    ${idx + 1}. ${item.name} (${item.mineral}m ${item.gas}g)
                  </div>
                `).join('')}
                ${commonOpening.opening.length > 5 ? `
                  <div class="text-xs text-blue-600 dark:text-blue-400">
                    ...and ${commonOpening.opening.length - 5} more
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      ` : `
        <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <div class="flex items-start gap-3">
            <span class="text-xl">⚠️</span>
            <div class="text-sm text-amber-800 dark:text-amber-200">
              These builds have completely different openings - they diverge from step 1
            </div>
          </div>
        </div>
      `}

      <!-- Key Recommendations -->
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Key Recommendations</h4>
        <div class="space-y-3">
          ${analysis.recommendations.map(rec => {
            const colorMap = {
              success: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', icon: '✅', textColor: 'text-green-900 dark:text-green-100' },
              info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: '💡', textColor: 'text-blue-900 dark:text-blue-100' },
              warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: '⚠️', textColor: 'text-amber-900 dark:text-amber-100' },
            };

            const colors = colorMap[rec.type] || colorMap.info;

            return `
              <div class="${colors.bg} rounded-lg p-4 border ${colors.border}">
                <div class="flex items-start gap-3">
                  <span class="text-xl">${colors.icon}</span>
                  <div>
                    <h5 class="font-semibold ${colors.textColor} mb-1">${rec.title}</h5>
                    <p class="text-sm ${colors.textColor.replace('900', '800').replace('100', '200')}">${rec.message}</p>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Similarity Matrix -->
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Build Similarity</h4>
        <div class="grid grid-cols-${builds.length} gap-2">
          ${builds.map((b1, i) => builds.map((b2, j) => {
            if (i === j) {
              return `<div class="aspect-square bg-slate-100 dark:bg-slate-900 rounded flex items-center justify-center text-xs font-bold">100%</div>`;
            } else if (i < j) {
              const similarity = calculateSimilarity(b1, b2);
              const percent = (similarity * 100).toFixed(0);
              const bgColor = similarity > 0.7 ? 'bg-green-100 dark:bg-green-900/30' :
                               similarity > 0.4 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                               'bg-red-100 dark:bg-red-900/30';
              return `<div class="aspect-square ${bgColor} rounded flex items-center justify-center text-xs font-semibold">${percent}%</div>`;
            } else {
              return `<div class="aspect-square bg-slate-50 dark:bg-slate-800 rounded"></div>`;
            }
          }).join('')).join('')}
        </div>
        <div class="mt-2 text-xs text-slate-600 dark:text-slate-400 text-center">
          Similarity based on unit composition and build sequence
        </div>
      </div>
    </div>
  `;
}

/**
 * Render side-by-side tab
 */
function renderSideBySideTab(container, builds, analysis) {
  const maxLength = Math.max(...builds.map(b => b.buildOrder.length));

  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 class="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">Side-by-Side Comparison</h3>
        <p class="text-slate-700 dark:text-slate-300 text-sm">
          Step-by-step breakdown of each build order
        </p>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-slate-100 dark:bg-slate-800">
              <th class="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 p-3 text-left text-sm font-semibold border-r-2 border-slate-300 dark:border-slate-600">Step</th>
              ${builds.map((b, idx) => `
                <th class="p-3 text-left text-sm font-semibold min-w-[200px]">
                  <div class="font-bold">${b.name}</div>
                  <div class="text-xs font-normal text-slate-600 dark:text-slate-400">${b.race}</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: maxLength }, (_, i) => {
              const stepBuilds = builds.map(b => b.buildOrder[i]);
              const allSame = stepBuilds.every((item, _, arr) =>
                item && arr[0] && item.name === arr[0].name
              );

              return `
                <tr class="${allSame ? 'bg-green-50 dark:bg-green-900/10' : 'bg-white dark:bg-slate-900'} border-b border-slate-200 dark:border-slate-700">
                  <td class="sticky left-0 z-10 ${allSame ? 'bg-green-50 dark:bg-green-900/10' : 'bg-white dark:bg-slate-900'} p-3 font-semibold text-sm border-r-2 border-slate-300 dark:border-slate-600">
                    ${i + 1}
                    ${allSame ? '<span class="ml-2 text-green-600">✓</span>' : ''}
                  </td>
                  ${stepBuilds.map(item => {
                    if (!item) {
                      return '<td class="p-3 text-slate-400 text-sm">—</td>';
                    }
                    return `
                      <td class="p-3">
                        <div class="font-medium text-sm text-slate-900 dark:text-slate-100">${item.name}</div>
                        <div class="text-xs text-slate-600 dark:text-slate-400">
                          ${item.mineral}m ${item.gas}g | ${item.supply} supply | ${item.buildtime}s
                        </div>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="bg-slate-100 dark:bg-slate-800 font-semibold">
              <td class="p-3 text-sm">Totals</td>
              ${analysis.builds.map(b => `
                <td class="p-3">
                  <div class="text-sm text-blue-600 dark:text-blue-400">${b.totalMinerals}m ${b.totalGas}g</div>
                  <div class="text-xs text-slate-600 dark:text-slate-400">${b.totalSupply} supply</div>
                </td>
              `).join('')}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

/**
 * Render differences tab
 */
function renderDifferencesTab(container, builds, analysis) {
  const diff = analysis.diff;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
        <h3 class="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">Build Differences</h3>
        <p class="text-slate-700 dark:text-slate-300 text-sm">
          Highlighting where builds diverge
        </p>
      </div>

      <!-- Summary Stats -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 text-center">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">${diff.commonalities.length}</div>
          <div class="text-sm text-slate-600 dark:text-slate-400">Common Steps</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 text-center">
          <div class="text-2xl font-bold text-red-600 dark:text-red-400">${diff.differences.length}</div>
          <div class="text-sm text-slate-600 dark:text-slate-400">Differences</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 text-center">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">${(diff.similarity * 100).toFixed(0)}%</div>
          <div class="text-sm text-slate-600 dark:text-slate-400">Similarity</div>
        </div>
      </div>

      ${diff.divergencePoint ? `
        <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
          <div class="flex items-center gap-2">
            <span class="text-xl">🔀</span>
            <span class="text-sm text-amber-800 dark:text-amber-200">
              Builds diverge at step <strong>${diff.divergencePoint}</strong>
            </span>
          </div>
        </div>
      ` : ''}

      <!-- Differences List -->
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Divergence Points</h4>
        <div class="space-y-3">
          ${diff.differences.length > 0 ? diff.differences.map(d => `
            <div class="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
              <div class="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">Step ${d.step}</div>
              <div class="grid grid-cols-${builds.length} gap-3">
                ${d.items.map(item => `
                  <div class="text-sm">
                    <div class="font-medium text-indigo-600 dark:text-indigo-400 mb-1">${item.buildName}</div>
                    <div class="text-slate-700 dark:text-slate-300">${item.item}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">${item.mineral}m ${item.gas}g</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('') : `
            <div class="text-center py-8 text-slate-500 dark:text-slate-400">
              No differences found - builds are identical!
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render efficiency tab
 */
function renderEfficiencyTab(container, builds, analysis) {
  const rankings = analysis.efficiency.rankings;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
        <h3 class="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">Efficiency Rankings</h3>
        <p class="text-slate-700 dark:text-slate-300 text-sm">
          Comparing builds across multiple efficiency metrics
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${Object.entries(rankings).map(([category, ranked]) => `
          <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <h4 class="font-semibold text-slate-900 dark:text-slate-100 mb-4">
              ${category.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
            </h4>
            <div class="space-y-2">
              ${ranked.map(r => {
                const medalEmoji = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '';
                return `
                  <div class="flex items-center justify-between p-2 rounded ${r.rank === 1 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-slate-50 dark:bg-slate-900'}">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-bold w-6">${medalEmoji || r.rank}</span>
                      <span class="text-sm font-medium text-slate-900 dark:text-slate-100">${r.buildName}</span>
                    </div>
                    <span class="text-sm text-slate-600 dark:text-slate-400">${r.value.toFixed(2)}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Overall Scores -->
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <h4 class="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Overall Efficiency Scores</h4>
        <div class="space-y-3">
          ${analysis.efficiency.overallScores.map((score, idx) => {
            const percent = score.normalizedScore * 100;
            return `
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium text-slate-900 dark:text-slate-100">${score.buildName}</span>
                  <span class="text-sm text-slate-600 dark:text-slate-400">${percent.toFixed(1)}%</span>
                </div>
                <div class="h-3 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                  <div class="h-full ${idx === 0 ? 'bg-green-500' : 'bg-blue-500'} transition-all" style="width: ${percent}%"></div>
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
 * Render timings tab
 */
function renderTimingsTab(container, builds, analysis) {
  const timings = analysis.timings;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
        <h3 class="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">Timing Analysis</h3>
        <p class="text-slate-700 dark:text-slate-300 text-sm">
          Compare army strength at key timing benchmarks
        </p>
      </div>

      <!-- Timing Benchmarks -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <h4 class="font-semibold text-slate-900 dark:text-slate-100 mb-4">3:00 Timing</h4>
          <div class="space-y-3">
            ${timings.timings.map(t => `
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-700 dark:text-slate-300">${t.buildName}</span>
                <div class="text-right">
                  <div class="text-sm font-semibold text-red-600 dark:text-red-400">${t.armyAtThree} army</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">${t.workersAtThree} workers</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <span class="text-xl">👑</span>
              <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">${timings.strongestAtThree.buildName}</span>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <h4 class="font-semibold text-slate-900 dark:text-slate-100 mb-4">4:00 Timing</h4>
          <div class="space-y-3">
            ${timings.timings.map(t => `
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-700 dark:text-slate-300">${t.buildName}</span>
                <div class="text-right">
                  <div class="text-sm font-semibold text-red-600 dark:text-red-400">${t.armyAtFour} army</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">${t.workersAtFour} workers</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <span class="text-xl">👑</span>
              <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">${timings.strongestAtFour.buildName}</span>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
          <h4 class="font-semibold text-slate-900 dark:text-slate-100 mb-4">5:00 Timing</h4>
          <div class="space-y-3">
            ${timings.timings.map(t => `
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-700 dark:text-slate-300">${t.buildName}</span>
                <div class="text-right">
                  <div class="text-sm font-semibold text-red-600 dark:text-red-400">${t.armyAtFive} army</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">${t.workersAtFive} workers</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div class="flex items-center gap-2">
              <span class="text-xl">👑</span>
              <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">${timings.strongestAtFive.buildName}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Strategic Insights -->
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <div class="flex items-start gap-3">
          <span class="text-2xl">💡</span>
          <div>
            <h4 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">Strategic Timing Insights</h4>
            <div class="text-sm text-blue-800 dark:text-blue-200 space-y-2">
              <p>
                <strong>${timings.strongestAtThree.buildName}</strong> has the strongest early aggression potential (3:00)
              </p>
              <p>
                <strong>${timings.strongestAtFive.buildName}</strong> reaches peak power by 5:00
              </p>
              <p class="text-xs">
                Choose builds based on opponent scouting and your preferred timing attack strategy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
