/**
 * Dependency Graph Visualization
 * Uses D3.js force-directed graph to show tech tree dependencies
 */

import * as d3 from 'd3';
import { buildPrereqTree, findCriticalPath } from '../algorithms/graph.js';

/**
 * Render dependency graph with force-directed layout
 * @param {HTMLElement} container - DOM container
 * @param {Object} buildOrder - Build order array
 * @param {Object} database - Game database
 * @param {Object} options - Visualization options
 */
export function renderDependencyGraph(container, buildOrder, database, options = {}) {
  const {
    width = 800,
    height = 600,
    nodeRadius = 30,
  } = options;

  d3.select(container).selectAll('*').remove();

  if (!buildOrder || buildOrder.length === 0) {
    d3.select(container)
      .append('div')
      .text('No dependencies to visualize');
    return;
  }

  // Build graph data structure
  const { nodes, links } = buildGraphData(buildOrder);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'dependency-graph');

  const g = svg.append('g');

  // Add zoom behavior
  const zoom = d3
    .zoom()
    .scaleExtent([0.5, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

  svg.call(zoom);

  // Force simulation
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(100)
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(nodeRadius + 10));

  // Arrow markers for links
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', nodeRadius + 8)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 8)
    .attr('markerHeight', 8)
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', '#999');

  // Draw links
  const link = g
    .append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 2)
    .attr('marker-end', 'url(#arrowhead)');

  // Draw nodes
  const node = g
    .append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .call(
      d3
        .drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
    );

  // Node circles
  node
    .append('circle')
    .attr('r', nodeRadius)
    .attr('fill', (d) => getNodeColor(d))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

  // Node labels
  node
    .append('text')
    .attr('dy', 4)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', '#fff')
    .style('pointer-events', 'none')
    .style('font-weight', 'bold')
    .text((d) => truncateLabel(d.name, 10));

  // Tooltips
  node.append('title').text((d) => {
    let text = `${d.name}\nType: ${d.kind || 'unknown'}`;
    if (d.buildtime) text += `\nBuild time: ${d.buildtime}s`;
    if (d.mineral || d.gas) {
      text += `\nCost: ${d.mineral || 0}m ${d.gas || 0}g`;
    }
    if (d.requires && d.requires.length > 0) {
      text += `\nRequires: ${d.requires.join(', ')}`;
    }
    return text;
  });

  // Highlight on hover
  node
    .on('mouseover', function (event, d) {
      d3.select(this).select('circle').attr('stroke-width', 4);

      // Highlight connected nodes
      link
        .style('stroke-opacity', (l) =>
          l.source.id === d.id || l.target.id === d.id ? 1 : 0.1
        )
        .style('stroke-width', (l) =>
          l.source.id === d.id || l.target.id === d.id ? 3 : 2
        );

      node.style('opacity', (n) => (isConnected(d, n) ? 1 : 0.3));
    })
    .on('mouseout', function () {
      d3.select(this).select('circle').attr('stroke-width', 2);

      link.style('stroke-opacity', 0.6).style('stroke-width', 2);

      node.style('opacity', 1);
    });

  // Update positions on tick
  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  function isConnected(a, b) {
    if (a.id === b.id) return true;
    return links.some(
      (l) =>
        (l.source.id === a.id && l.target.id === b.id) ||
        (l.source.id === b.id && l.target.id === a.id)
    );
  }

  // Title
  svg
    .append('text')
    .attr('x', 10)
    .attr('y', 20)
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .text('Dependency Graph (drag nodes, scroll to zoom)');

  return svg.node();
}

/**
 * Render prerequisite tree as hierarchical tree layout
 * @param {HTMLElement} container
 * @param {Object} entity - Target entity
 * @param {Function} findEntity - Function to look up entities
 * @param {Object} options
 */
export function renderPrereqTree(container, entity, findEntity, options = {}) {
  const {
    width = 800,
    height = 600,
    nodeSize = 40,
  } = options;

  d3.select(container).selectAll('*').remove();

  // Build tree
  const tree = buildPrereqTree(entity, findEntity);

  if (!tree) {
    d3.select(container).append('div').text('No prerequisites');
    return;
  }

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'prereq-tree');

  const g = svg.append('g').attr('transform', `translate(${width / 2},40)`);

  // Create hierarchy
  const root = d3.hierarchy(tree);

  // Tree layout
  const treeLayout = d3
    .tree()
    .size([width - 100, height - 100])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

  treeLayout(root);

  // Center the tree
  const minX = d3.min(root.descendants(), (d) => d.x);
  const maxX = d3.max(root.descendants(), (d) => d.x);
  const centerOffset = -(minX + maxX) / 2;

  g.attr('transform', `translate(${width / 2 + centerOffset},40)`);

  // Links
  const link = g
    .selectAll('.link')
    .data(root.links())
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('fill', 'none')
    .attr('stroke', '#999')
    .attr('stroke-width', 2)
    .attr(
      'd',
      d3
        .linkVertical()
        .x((d) => d.x)
        .y((d) => d.y)
    );

  // Nodes
  const node = g
    .selectAll('.node')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', (d) => `translate(${d.x},${d.y})`);

  node
    .append('circle')
    .attr('r', nodeSize / 2)
    .attr('fill', (d) => (d.data.cyclic ? '#f44336' : getNodeColor(d.data)))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

  node
    .append('text')
    .attr('dy', 4)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('fill', '#fff')
    .style('font-weight', 'bold')
    .text((d) => truncateLabel(d.data.name, 12));

  node
    .append('text')
    .attr('dy', -nodeSize / 2 - 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '9px')
    .style('fill', '#666')
    .text((d) => (d.data.buildtime ? `${d.data.buildtime}s` : ''));

  // Highlight critical path
  if (options.highlightCriticalPath) {
    const criticalPath = findCriticalPath(
      tree,
      (name) => findEntity(name)?.buildtime || 0
    );

    if (criticalPath && criticalPath.path) {
      node
        .filter((d) => criticalPath.path.includes(d.data.name))
        .select('circle')
        .attr('stroke', '#ff9800')
        .attr('stroke-width', 4);
    }
  }

  // Title
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .text(`Prerequisites for ${entity.name}`);

  return svg.node();
}

/**
 * Build nodes and links from build order
 */
function buildGraphData(buildOrder) {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  buildOrder.forEach((item, i) => {
    const node = {
      id: `${item.name}-${i}`,
      name: item.name,
      kind: item.kind,
      buildtime: item.buildtime,
      mineral: item.mineral,
      gas: item.gas,
      requires: item.tech_tree?.requires || [],
    };

    nodes.push(node);
    nodeMap.set(item.name.toLowerCase(), node);
  });

  // Create links based on prerequisites
  nodes.forEach((node) => {
    if (node.requires && node.requires.length > 0) {
      node.requires.forEach((req) => {
        const sourceNode = nodeMap.get(req.toLowerCase());
        if (sourceNode) {
          links.push({
            source: sourceNode.id,
            target: node.id,
          });
        }
      });
    }
  });

  return { nodes, links };
}

/**
 * Get color for node based on type
 */
function getNodeColor(node) {
  const colors = {
    unit: '#4CAF50',
    building: '#2196F3',
    upgrade: '#FF9800',
    worker: '#9C27B0',
  };
  return colors[node.kind] || '#757575';
}

/**
 * Truncate label to max length
 */
function truncateLabel(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

export default {
  renderDependencyGraph,
  renderPrereqTree,
};
