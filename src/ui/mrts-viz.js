/**
 * MRTS Visualization Components
 * Renders isoquants, production possibility frontiers, and substitution curves
 */

import * as d3 from 'd3';
import { calculateMRTS, analyzeTimeResourceTradeoff } from '../algorithms/mrts.js';

/**
 * Render isoquant curves (constant output, varying inputs)
 * @param {HTMLElement} container - Container element
 * @param {Array} isoquants - Array of isoquant data
 * @param {Object} options - Visualization options
 */
export function renderIsoquantCurves(container, isoquants, options = {}) {
  const {
    width = 800,
    height = 600,
    margin = { top: 40, right: 120, bottom: 60, left: 80 },
    xLabel = 'Minerals',
    yLabel = 'Gas',
  } = options;

  d3.select(container).selectAll('*').remove();

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'isoquant-viz');

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Find data ranges
  let allPoints = [];
  isoquants.forEach((iso) => {
    allPoints = allPoints.concat(iso.builds);
  });

  const xExtent = d3.extent(allPoints, (d) => d.totalMinerals || 0);
  const yExtent = d3.extent(allPoints, (d) => d.totalGas || 0);

  // Scales
  const xScale = d3
    .scaleLinear()
    .domain([0, xExtent[1] * 1.1])
    .range([0, chartWidth]);

  const yScale = d3
    .scaleLinear()
    .domain([0, yExtent[1] * 1.1])
    .range([chartHeight, 0]);

  // Color scale for different isoquants
  const colorScale = d3
    .scaleOrdinal()
    .domain(isoquants.map((_, i) => i))
    .range(d3.schemeCategory10);

  // Axes
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale));

  g.append('g').attr('class', 'y-axis').call(d3.axisLeft(yScale));

  // Axis labels
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', height - 10)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .text(xLabel);

  svg
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', 15)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .text(yLabel);

  // Draw isoquant curves
  isoquants.forEach((isoquant, i) => {
    const line = d3
      .line()
      .x((d) => xScale(d.totalMinerals || 0))
      .y((d) => yScale(d.totalGas || 0))
      .curve(d3.curveCatmullRom);

    // Sort points for smooth curve
    const sorted = isoquant.builds.sort((a, b) => (a.totalMinerals || 0) - (b.totalMinerals || 0));

    // Draw curve
    g.append('path')
      .datum(sorted)
      .attr('class', `isoquant-${i}`)
      .attr('fill', 'none')
      .attr('stroke', colorScale(i))
      .attr('stroke-width', 2)
      .attr('d', line);

    // Draw points
    g.selectAll(`.point-${i}`)
      .data(sorted)
      .enter()
      .append('circle')
      .attr('class', `point-${i}`)
      .attr('cx', (d) => xScale(d.totalMinerals || 0))
      .attr('cy', (d) => yScale(d.totalGas || 0))
      .attr('r', 5)
      .attr('fill', colorScale(i))
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // Label
    const lastPoint = sorted[sorted.length - 1];
    g.append('text')
      .attr('x', xScale(lastPoint.totalMinerals || 0) + 10)
      .attr('y', yScale(lastPoint.totalGas || 0))
      .style('font-size', '12px')
      .style('fill', colorScale(i))
      .text(`Output: ${isoquant.targetOutput}`);
  });

  // Title
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px')
    .style('font-weight', 'bold')
    .text('Isoquant Curves - Resource Substitution');

  return svg.node();
}

/**
 * Render MRTS slope visualization
 * @param {HTMLElement} container - Container
 * @param {Object} mrtsAnalysis - MRTS analysis result
 * @param {Object} options - Options
 */
export function renderMRTSSlopes(container, mrtsAnalysis, options = {}) {
  const {
    width = 800,
    height = 400,
    margin = { top: 40, right: 40, bottom: 60, left = 80 },
  } = options;

  d3.select(container).selectAll('*').remove();

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const points = mrtsAnalysis.points || [];

  if (points.length === 0) {
    g.append('text')
      .attr('x', chartWidth / 2)
      .attr('y', chartHeight / 2)
      .attr('text-anchor', 'middle')
      .text('No MRTS data available');
    return;
  }

  // Scales
  const xScale = d3
    .scaleLinear()
    .domain([0, points.length - 1])
    .range([0, chartWidth]);

  const yExtent = d3.extent(points, (d) => Math.abs(d.mrts));
  const yScale = d3
    .scaleLinear()
    .domain([0, yExtent[1] * 1.1])
    .range([chartHeight, 0]);

  // Axes
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .ticks(points.length)
        .tickFormat((d) => `Point ${d + 1}`)
    );

  g.append('g').attr('class', 'y-axis').call(d3.axisLeft(yScale));

  // Draw bars
  g.selectAll('.mrts-bar')
    .data(points)
    .enter()
    .append('rect')
    .attr('class', 'mrts-bar')
    .attr('x', (d, i) => xScale(i) - 20)
    .attr('y', (d) => yScale(Math.abs(d.mrts)))
    .attr('width', 40)
    .attr('height', (d) => chartHeight - yScale(Math.abs(d.mrts)))
    .attr('fill', (d) => (d.mrts > 0 ? '#4CAF50' : '#f44336'))
    .attr('opacity', 0.7);

  // Value labels
  g.selectAll('.mrts-label')
    .data(points)
    .enter()
    .append('text')
    .attr('class', 'mrts-label')
    .attr('x', (d, i) => xScale(i))
    .attr('y', (d) => yScale(Math.abs(d.mrts)) - 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .text((d) => d.mrts.toFixed(2));

  // Average line
  const avgMRTS = mrtsAnalysis.averageMRTS;
  g.append('line')
    .attr('x1', 0)
    .attr('x2', chartWidth)
    .attr('y1', yScale(Math.abs(avgMRTS)))
    .attr('y2', yScale(Math.abs(avgMRTS)))
    .attr('stroke', '#FF9800')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5');

  g.append('text')
    .attr('x', chartWidth - 10)
    .attr('y', yScale(Math.abs(avgMRTS)) - 5)
    .attr('text-anchor', 'end')
    .style('font-size', '12px')
    .style('fill', '#FF9800')
    .text(`Avg: ${avgMRTS.toFixed(2)}`);

  // Title
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px')
    .style('font-weight', 'bold')
    .text(
      `MRTS: ${mrtsAnalysis.input1} → ${mrtsAnalysis.input2} Substitution Rates`
    );

  return svg.node();
}

/**
 * Render production possibility frontier
 * @param {HTMLElement} container - Container
 * @param {Array} builds - All possible builds
 * @param {Object} options - Options
 */
export function renderProductionPossibilityFrontier(container, builds, options = {}) {
  const {
    width = 800,
    height = 600,
    margin = { top: 40, right: 40, bottom: 60, left: 80 },
    xMetric = 'workers',
    yMetric = 'armyValue',
    xLabel = 'Workers (Economic Power)',
    yLabel = 'Army Value',
  } = options;

  d3.select(container).selectAll('*').remove();

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Extract values
  const points = builds.map((b) => ({
    build: b,
    x: getMetricValue(b, xMetric),
    y: getMetricValue(b, yMetric),
  }));

  // Find frontier (Pareto optimal points)
  const frontier = points.filter((p1) => {
    return !points.some((p2) => p2.x > p1.x && p2.y > p1.y);
  });

  // Sort frontier by x
  frontier.sort((a, b) => a.x - b.x);

  // Scales
  const xScale = d3
    .scaleLinear()
    .domain([0, d3.max(points, (d) => d.x) * 1.1])
    .range([0, chartWidth]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(points, (d) => d.y) * 1.1])
    .range([chartHeight, 0]);

  // Axes
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale));

  g.append('g').attr('class', 'y-axis').call(d3.axisLeft(yScale));

  // Axis labels
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', height - 10)
    .attr('text-anchor', 'middle')
    .text(xLabel);

  svg
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', 15)
    .attr('text-anchor', 'middle')
    .text(yLabel);

  // Draw all points (gray)
  g.selectAll('.all-point')
    .data(points)
    .enter()
    .append('circle')
    .attr('class', 'all-point')
    .attr('cx', (d) => xScale(d.x))
    .attr('cy', (d) => yScale(d.y))
    .attr('r', 4)
    .attr('fill', '#ccc')
    .attr('opacity', 0.5);

  // Draw frontier curve
  const line = d3
    .line()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.y))
    .curve(d3.curveCatmullRom);

  g.append('path')
    .datum(frontier)
    .attr('class', 'frontier')
    .attr('fill', 'none')
    .attr('stroke', '#2196F3')
    .attr('stroke-width', 3)
    .attr('d', line);

  // Draw frontier points
  g.selectAll('.frontier-point')
    .data(frontier)
    .enter()
    .append('circle')
    .attr('class', 'frontier-point')
    .attr('cx', (d) => xScale(d.x))
    .attr('cy', (d) => yScale(d.y))
    .attr('r', 6)
    .attr('fill', '#2196F3')
    .attr('stroke', 'white')
    .attr('stroke-width', 2);

  // Title
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px')
    .style('font-weight', 'bold')
    .text('Production Possibility Frontier');

  // Efficiency note
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', height - margin.bottom + 40)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#666')
    .text(
      `${frontier.length} efficient builds on frontier (blue) | ${
        points.length - frontier.length
      } inefficient builds (gray)`
    );

  return svg.node();
}

/**
 * Render time-cost tradeoff curve
 * @param {HTMLElement} container - Container
 * @param {Array} builds - Builds with time and cost data
 * @param {Object} options - Options
 */
export function renderTimeCostradeoff(container, builds, options = {}) {
  const { width = 800, height = 400 } = options;

  const analysis = analyzeTimeResourceTradeoff(builds);

  d3.select(container).selectAll('*').remove();

  const html = `
    <div class="tradeoff-analysis" style="padding: 20px; background: white; border-radius: 8px;">
      <h3 style="margin-top: 0;">Time-Cost Tradeoff Analysis</h3>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0;">
        <div style="padding: 15px; background: #e3f2fd; border-radius: 6px;">
          <div style="font-size: 12px; color: #666;">Fastest Build</div>
          <div style="font-size: 18px; font-weight: bold; color: #1976d2;">
            ${analysis.fastestBuild?.name || 'N/A'}
          </div>
          <div style="font-size: 14px; margin-top: 5px;">
            ${analysis.fastestBuild?.completionTime?.toFixed(1)}s
          </div>
        </div>

        <div style="padding: 15px; background: #f3e5f5; border-radius: 6px;">
          <div style="font-size: 12px; color: #666;">Cheapest Build</div>
          <div style="font-size: 18px; font-weight: bold; color: #7b1fa2;">
            ${analysis.cheapestBuild?.name || 'N/A'}
          </div>
          <div style="font-size: 14px; margin-top: 5px;">
            ${analysis.cheapestBuild?.totalMinerals || 0}m ${
    analysis.cheapestBuild?.totalGas || 0
  }g
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
            <th style="padding: 10px; text-align: left;">Comparison</th>
            <th style="padding: 10px; text-align: right;">Time Saved</th>
            <th style="padding: 10px; text-align: right;">Extra Cost</th>
            <th style="padding: 10px; text-align: right;">MRTS (cost/time)</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.tradeoffs
            .map(
              (t) => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px;">${t.fasterBuild} vs ${t.slowerBuild}</td>
              <td style="padding: 10px; text-align: right; color: #4CAF50;">
                ${t.timeSaved.toFixed(1)}s
              </td>
              <td style="padding: 10px; text-align: right; color: #f44336;">
                ${t.extraCost.toFixed(0)} resources
              </td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">
                ${t.mrts.toFixed(1)} res/s
              </td>
            </tr>
            <tr>
              <td colspan="4" style="padding: 5px 10px; font-size: 12px; color: #666;">
                ${t.interpretation}
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      ${
        analysis.optimalBalance
          ? `
        <div style="margin-top: 20px; padding: 15px; background: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px;">
          <strong>💡 Optimal Balance:</strong> ${analysis.optimalBalance.interpretation}
        </div>
      `
          : ''
      }
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Helper: Get metric value from build
 */
function getMetricValue(build, metric) {
  const metrics = {
    workers: () => countWorkers(build),
    armyValue: () => calculateArmyValue(build),
    armySupply: () =>
      build.buildOrder?.filter((i) => i.kind === 'unit').reduce((s, i) => s + (i.supply || 0), 0) ||
      0,
    totalMinerals: () => build.totalMinerals || 0,
    totalGas: () => build.totalGas || 0,
  };

  return metrics[metric] ? metrics[metric]() : 0;
}

function countWorkers(build) {
  const workerNames = ['probe', 'scv', 'drone'];
  return (
    build.buildOrder?.filter((i) => workerNames.includes(i.name?.toLowerCase())).length || 0
  );
}

function calculateArmyValue(build) {
  return (
    build.buildOrder
      ?.filter((i) => i.kind === 'unit')
      .reduce((sum, i) => sum + (i.mineral || 0) + (i.gas || 0) * 1.5, 0) || 0
  );
}

export default {
  renderIsoquantCurves,
  renderMRTSSlopes,
  renderProductionPossibilityFrontier,
  renderTimeCostTradeoff,
};
