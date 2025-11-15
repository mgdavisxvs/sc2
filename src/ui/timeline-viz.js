/**
 * Build Order Timeline Visualization
 * Uses D3.js to create interactive Gantt chart of build order execution
 */

import * as d3 from 'd3';

/**
 * Creates a timeline visualization showing when each action starts/completes
 * @param {HTMLElement} container - DOM element to render into
 * @param {Object} simulationResult - Result from SC2Simulator.simulate()
 * @param {Object} options - Visualization options
 */
export function renderTimeline(container, simulationResult, options = {}) {
  const {
    width = 1200,
    height = 600,
    margin = { top: 40, right: 120, bottom: 60, left: 200 },
    barHeight = 30,
    barPadding = 5,
  } = options;

  // Clear previous visualization
  d3.select(container).selectAll('*').remove();

  const { timeline, completionTime, stats } = simulationResult;

  if (!timeline || timeline.length === 0) {
    d3.select(container)
      .append('div')
      .attr('class', 'empty-state')
      .text('No build order to visualize');
    return;
  }

  // Create SVG
  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', Math.max(height, timeline.length * (barHeight + barPadding) + margin.top + margin.bottom))
    .attr('class', 'timeline-viz');

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = timeline.length * (barHeight + barPadding);

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3
    .scaleLinear()
    .domain([0, completionTime])
    .range([0, chartWidth]);

  const yScale = d3
    .scaleBand()
    .domain(timeline.map((d, i) => i))
    .range([0, chartHeight])
    .padding(0.2);

  // Color scale by entity type
  const colorScale = d3
    .scaleOrdinal()
    .domain(['unit', 'building', 'upgrade', 'worker'])
    .range(['#4CAF50', '#2196F3', '#FF9800', '#9C27B0']);

  // X-axis (time)
  const xAxis = d3.axisBottom(xScale).tickFormat((d) => `${d.toFixed(0)}s`);

  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(xAxis)
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  // Add grid lines
  g.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .tickSize(-chartHeight)
        .tickFormat('')
    )
    .style('stroke-dasharray', '3,3')
    .style('opacity', 0.1);

  // Tooltip
  const tooltip = d3
    .select(container)
    .append('div')
    .attr('class', 'timeline-tooltip')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background-color', 'rgba(0, 0, 0, 0.8)')
    .style('color', 'white')
    .style('padding', '8px 12px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('z-index', 1000);

  // Draw timeline bars
  const bars = g
    .selectAll('.timeline-bar')
    .data(timeline)
    .enter()
    .append('g')
    .attr('class', 'timeline-bar');

  // Background bar (shows waiting time)
  bars
    .append('rect')
    .attr('x', (d) => xScale(d.startTime || 0))
    .attr('y', (d, i) => yScale(i))
    .attr('width', (d) => xScale((d.time || 0) - (d.startTime || 0)))
    .attr('height', yScale.bandwidth())
    .attr('fill', '#e0e0e0')
    .attr('opacity', 0.3);

  // Active bar (shows build time)
  bars
    .append('rect')
    .attr('x', (d) => xScale(d.startTime || 0))
    .attr('y', (d, i) => yScale(i))
    .attr('width', 0)
    .attr('height', yScale.bandwidth())
    .attr('fill', (d) => colorScale(d.kind || 'unit'))
    .attr('rx', 3)
    .attr('ry', 3)
    .transition()
    .duration(800)
    .delay((d, i) => i * 50)
    .attr('width', (d) => {
      const duration = (d.time || 0) - (d.startTime || 0);
      return Math.max(2, xScale(duration));
    });

  // Add labels
  bars
    .append('text')
    .attr('x', -5)
    .attr('y', (d, i) => yScale(i) + yScale.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .attr('class', 'bar-label')
    .style('font-size', '12px')
    .style('fill', '#333')
    .text((d) => d.action || d.name || 'Unknown');

  // Add time labels on bars
  bars
    .append('text')
    .attr('x', (d) => xScale(d.time || 0) + 5)
    .attr('y', (d, i) => yScale(i) + yScale.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('class', 'time-label')
    .style('font-size', '10px')
    .style('fill', '#666')
    .style('opacity', 0)
    .text((d) => `${(d.time || 0).toFixed(1)}s`)
    .transition()
    .duration(800)
    .delay((d, i) => i * 50 + 400)
    .style('opacity', 1);

  // Add interactivity
  bars
    .selectAll('rect')
    .on('mouseover', function (event, d) {
      d3.select(this).attr('opacity', 0.8);

      const tooltipHtml = `
        <strong>${d.action || d.name}</strong><br/>
        Type: ${d.kind || 'unknown'}<br/>
        Start: ${(d.startTime || 0).toFixed(1)}s<br/>
        Complete: ${(d.time || 0).toFixed(1)}s<br/>
        Duration: ${((d.time || 0) - (d.startTime || 0)).toFixed(1)}s
        ${d.waitTime ? `<br/>Wait: ${d.waitTime.toFixed(1)}s` : ''}
        ${d.reason ? `<br/><em>${d.reason}</em>` : ''}
      `;

      tooltip.html(tooltipHtml).style('visibility', 'visible');
    })
    .on('mousemove', function (event) {
      tooltip
        .style('top', event.pageY - 10 + 'px')
        .style('left', event.pageX + 10 + 'px');
    })
    .on('mouseout', function () {
      d3.select(this).attr('opacity', 1);
      tooltip.style('visibility', 'hidden');
    });

  // Add title
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .attr('class', 'chart-title')
    .style('font-size', '16px')
    .style('font-weight', 'bold')
    .text(`Build Order Timeline - ${completionTime.toFixed(1)}s total`);

  // Add legend
  const legend = svg
    .append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);

  const legendData = [
    { type: 'unit', label: 'Units' },
    { type: 'building', label: 'Buildings' },
    { type: 'upgrade', label: 'Upgrades' },
    { type: 'worker', label: 'Workers' },
  ];

  const legendItems = legend
    .selectAll('.legend-item')
    .data(legendData)
    .enter()
    .append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => `translate(0, ${i * 25})`);

  legendItems
    .append('rect')
    .attr('width', 18)
    .attr('height', 18)
    .attr('fill', (d) => colorScale(d.type))
    .attr('rx', 2);

  legendItems
    .append('text')
    .attr('x', 24)
    .attr('y', 9)
    .attr('dy', '0.35em')
    .style('font-size', '12px')
    .text((d) => d.label);

  // Add supply blocks markers
  if (stats.supplyBlocks && stats.supplyBlocks.length > 0) {
    const supplyBlockMarkers = g
      .selectAll('.supply-block-marker')
      .data(stats.supplyBlocks)
      .enter()
      .append('g')
      .attr('class', 'supply-block-marker');

    supplyBlockMarkers
      .append('line')
      .attr('x1', (d) => xScale(d.time))
      .attr('x2', (d) => xScale(d.time))
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', '#f44336')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.6);

    supplyBlockMarkers
      .append('text')
      .attr('x', (d) => xScale(d.time))
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#f44336')
      .style('font-weight', 'bold')
      .text('⚠ Supply Block');
  }

  return svg.node();
}

/**
 * Render resource curves over time
 * @param {HTMLElement} container - DOM element
 * @param {Object} simulationResult - Simulator result
 * @param {Object} options - Options
 */
export function renderResourceCurves(container, simulationResult, options = {}) {
  const {
    width = 1200,
    height = 300,
    margin = { top: 40, right: 120, bottom: 60, left: 60 },
  } = options;

  d3.select(container).selectAll('*').remove();

  const { timeline, completionTime, stats } = simulationResult;

  if (!timeline || timeline.length === 0) {
    return;
  }

  // Build resource data points
  const resourceData = buildResourceTimeSeries(simulationResult);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'resource-curves');

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3
    .scaleLinear()
    .domain([0, completionTime])
    .range([0, chartWidth]);

  const maxResource = d3.max(resourceData, (d) =>
    Math.max(d.minerals, d.gas, d.supplyUsed * 10)
  );

  const yScale = d3
    .scaleLinear()
    .domain([0, maxResource || 1000])
    .range([chartHeight, 0])
    .nice();

  // Axes
  const xAxis = d3.axisBottom(xScale).tickFormat((d) => `${d.toFixed(0)}s`);
  const yAxis = d3.axisLeft(yScale);

  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(xAxis);

  g.append('g').attr('class', 'y-axis').call(yAxis);

  // Grid
  g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale).tickSize(-chartWidth).tickFormat(''))
    .style('stroke-dasharray', '3,3')
    .style('opacity', 0.1);

  // Lines
  const mineralLine = d3
    .line()
    .x((d) => xScale(d.time))
    .y((d) => yScale(d.minerals))
    .curve(d3.curveMonotoneX);

  const gasLine = d3
    .line()
    .x((d) => xScale(d.time))
    .y((d) => yScale(d.gas))
    .curve(d3.curveMonotoneX);

  const supplyLine = d3
    .line()
    .x((d) => xScale(d.time))
    .y((d) => yScale(d.supplyUsed * 10))
    .curve(d3.curveStepAfter);

  // Draw lines with animation
  const paths = [
    { data: resourceData, line: mineralLine, color: '#4CAF50', label: 'Minerals' },
    { data: resourceData, line: gasLine, color: '#00BCD4', label: 'Gas' },
    { data: resourceData, line: supplyLine, color: '#FF9800', label: 'Supply (×10)' },
  ];

  paths.forEach(({ data, line, color, label }, i) => {
    const path = g
      .append('path')
      .datum(data)
      .attr('class', `line-${label.toLowerCase()}`)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', line);

    const totalLength = path.node().getTotalLength();

    path
      .attr('stroke-dasharray', totalLength + ' ' + totalLength)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1500)
      .delay(i * 200)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);
  });

  // Title
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .text('Resource Curves Over Time');

  // Legend
  const legend = svg
    .append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - margin.right + 10}, ${margin.top})`);

  paths.forEach(({ color, label }, i) => {
    const item = legend
      .append('g')
      .attr('transform', `translate(0, ${i * 25})`);

    item
      .append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', color)
      .attr('stroke-width', 2);

    item
      .append('text')
      .attr('x', 25)
      .attr('y', 0)
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .text(label);
  });

  return svg.node();
}

/**
 * Build time series data for resources
 * @param {Object} simulationResult
 * @returns {Array} Time series data
 */
function buildResourceTimeSeries(simulationResult) {
  const { timeline, stats } = simulationResult;

  // Simplified - in real implementation, track resource state at each event
  const points = [];

  timeline.forEach((event, i) => {
    points.push({
      time: event.time || 0,
      minerals: 50 + i * 20, // Placeholder - should come from simulator state
      gas: i * 10,
      supplyUsed: 12 + i * 2,
      supplyMax: 15 + Math.floor(i / 3) * 8,
    });
  });

  return points;
}

export default {
  renderTimeline,
  renderResourceCurves,
};
