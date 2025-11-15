/**
 * Chart Rendering
 * D3-based visualizations for build analysis
 */

import * as d3 from 'd3';
import { state } from '../core/state.js';

/**
 * Render charts for build analysis
 */
export function renderCharts() {
  renderSupplyChart();
  renderResourceChart();
}

/**
 * Render supply vs step chart
 */
function renderSupplyChart() {
  const svg = d3.select('#chartSupply');
  if (svg.empty()) return;

  svg.selectAll('*').remove();

  const dataS = state.build.map((b, i) => ({ x: i + 1, y: b.supply || 0 }));
  const w = svg.node()?.clientWidth || 300;
  const h = svg.node()?.clientHeight || 120;
  const m = { t: 6, r: 6, b: 18, l: 24 };

  const x = d3
    .scaleLinear()
    .domain([1, Math.max(1, dataS.length || 1)])
    .range([m.l, w - m.r]);

  const totalSupply = d3.sum(dataS, d => d.y) || 0;
  const y = d3
    .scaleLinear()
    .domain([0, Math.max(2, totalSupply)])
    .nice()
    .range([h - m.b, m.t]);

  svg
    .append('g')
    .attr('class', 'd3-axis')
    .attr('transform', `translate(0,${h - m.b})`)
    .call(d3.axisBottom(x).ticks(5));

  svg
    .append('g')
    .attr('class', 'd3-axis')
    .attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4));

  const cum = dataS.map((_, i) => ({
    x: i + 1,
    y: d3.sum(dataS.slice(0, i + 1), d => d.y),
  }));

  svg
    .append('path')
    .attr(
      'd',
      d3
        .line()
        .x(d => x(d.x))
        .y(d => y(d.y))(cum)
    )
    .attr('fill', 'none')
    .attr('stroke', 'currentColor')
    .attr('stroke-width', 2);
}

/**
 * Render mineral and gas cumulative chart
 */
function renderResourceChart() {
  const svg = d3.select('#chartRes');
  if (svg.empty()) return;

  svg.selectAll('*').remove();

  const dataM = state.build.map((b, i) => ({ x: i + 1, y: b.mineral || 0 }));
  const dataG = state.build.map((b, i) => ({ x: i + 1, y: b.gas || 0 }));

  const w = svg.node()?.clientWidth || 300;
  const h = svg.node()?.clientHeight || 120;
  const m = { t: 6, r: 6, b: 18, l: 24 };

  const xm = d3
    .scaleLinear()
    .domain([1, Math.max(1, dataM.length || 1)])
    .range([m.l, w - m.r]);

  const ymax = Math.max(
    2,
    d3.sum(dataM, d => d.y) + d3.sum(dataG, d => d.y)
  );

  const yr = d3
    .scaleLinear()
    .domain([0, ymax])
    .nice()
    .range([h - m.b, m.t]);

  svg
    .append('g')
    .attr('class', 'd3-axis')
    .attr('transform', `translate(0,${h - m.b})`)
    .call(d3.axisBottom(xm).ticks(5));

  svg
    .append('g')
    .attr('class', 'd3-axis')
    .attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(yr).ticks(4));

  const cumM = dataM.map((_, i) => ({
    x: i + 1,
    y: d3.sum(dataM.slice(0, i + 1), d => d.y),
  }));

  const cumG = dataG.map((_, i) => ({
    x: i + 1,
    y: d3.sum(dataG.slice(0, i + 1), d => d.y),
  }));

  svg
    .append('path')
    .attr(
      'd',
      d3
        .line()
        .x(d => xm(d.x))
        .y(d => yr(d.y))(cumM)
    )
    .attr('fill', 'none')
    .attr('stroke', 'currentColor')
    .attr('stroke-width', 2)
    .attr('opacity', 0.9);

  svg
    .append('path')
    .attr(
      'd',
      d3
        .line()
        .x(d => xm(d.x))
        .y(d => yr(d.y))(cumG)
    )
    .attr('fill', 'none')
    .attr('stroke', 'currentColor')
    .attr('stroke-width', 2)
    .attr('opacity', 0.6);
}
