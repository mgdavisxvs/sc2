/**
 * Interactive Tech Tree UI
 * Visual tech tree builder with auto-complete functionality
 */

import {
  buildTechTree,
  getNodeAvailability,
  getAutoCompletePath,
  filterTechTreeByCategory,
  searchTechTree,
} from '../algorithms/tech-tree.js';
import { logger } from '../core/logger.js';
import { showStatus } from './status.js';

/**
 * Create tech tree interface
 * @param {HTMLElement} container - Container element
 * @param {Object} gameData - Game data (normalized)
 * @param {string} race - Current race
 * @param {Array} buildOrder - Current build order
 * @param {Function} onAddNode - Callback when node is added
 * @returns {Object} Tech tree UI controller
 */
export default function createTechTreeUI(container, gameData, race, buildOrder, onAddNode) {
  if (!container || !gameData || !race) {
    logger.error('Tech tree: missing required parameters');
    return null;
  }

  // Build tech tree graph
  const techTree = buildTechTree(gameData, race);

  if (techTree.nodes.length === 0) {
    container.innerHTML = `
      <div class="text-center py-20">
        <div class="text-6xl mb-4">🌳</div>
        <h3 class="text-xl font-semibold mb-2 text-slate-700 dark:text-slate-300">No Tech Tree Data</h3>
        <p class="text-slate-600 dark:text-slate-400">Load game data to view tech tree</p>
      </div>
    `;
    return null;
  }

  // Create UI structure
  const ui = createTechTreeContainer(race);
  container.innerHTML = '';
  container.appendChild(ui.root);

  // State
  const state = {
    techTree,
    buildOrder: [...buildOrder],
    selectedCategory: 'all',
    searchQuery: '',
    autoCompleteEnabled: true,
  };

  // Render initial tree
  renderTechTree(ui, state, onAddNode);

  // Set up event listeners
  setupTechTreeEventListeners(ui, state, onAddNode);

  // Return controller
  return {
    update: (newBuildOrder) => {
      state.buildOrder = [...newBuildOrder];
      renderTechTree(ui, state, onAddNode);
    },
    destroy: () => {
      container.innerHTML = '';
    },
  };
}

/**
 * Create tech tree container structure
 * @param {string} race - Race
 * @returns {Object} UI elements
 */
function createTechTreeContainer(race) {
  const root = document.createElement('div');
  root.className = 'tech-tree-container';

  root.innerHTML = `
    <div class="tech-tree-header" style="padding: 20px; background: linear-gradient(to right, #667eea, #764ba2); color: white; border-radius: 12px 12px 0 0;">
      <h2 class="text-2xl font-bold mb-2">Interactive Tech Tree</h2>
      <p class="text-sm opacity-90">Click to add • Shift+Click for auto-complete path • Race: ${race.charAt(0).toUpperCase() + race.slice(1)}</p>
    </div>

    <div class="tech-tree-controls" style="padding: 16px; background: #f8f9fa; dark:background: #1a1a2e; border-bottom: 1px solid #e0e0e0;">
      <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
        <input
          id="techTreeSearch"
          type="search"
          placeholder="Search units, buildings, upgrades..."
          style="flex: 1; min-width: 250px; padding: 8px 12px; border: 1px solid #d0d0d0; border-radius: 6px; font-size: 14px;"
        />

        <select id="techTreeCategory" style="padding: 8px 12px; border: 1px solid #d0d0d0; border-radius: 6px; font-size: 14px; background: white;">
          <option value="all">All</option>
          <option value="buildings">Buildings</option>
          <option value="units">Units</option>
          <option value="upgrades">Upgrades</option>
        </select>

        <label style="display: flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer;">
          <input type="checkbox" id="autoCompleteToggle" checked style="width: 16px; height: 16px; cursor: pointer;" />
          <span>Auto-Complete Path</span>
        </label>

        <div id="techTreeStats" style="margin-left: auto; font-size: 13px; color: #666;">
          <!-- Stats will be inserted here -->
        </div>
      </div>
    </div>

    <div class="tech-tree-legend" style="padding: 12px 16px; background: #fff; dark:background: #0f172a; border-bottom: 1px solid #e0e0e0; display: flex; gap: 16px; font-size: 12px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="width: 16px; height: 16px; background: #10b981; border-radius: 4px;"></div>
        <span>Available</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="width: 16px; height: 16px; background: #94a3b8; border-radius: 4px;"></div>
        <span>Locked</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="width: 16px; height: 16px; background: #3b82f6; border-radius: 4px;"></div>
        <span>Built</span>
      </div>
    </div>

    <div id="techTreeCanvas" style="flex: 1; overflow: auto; padding: 20px; background: #fafafa; dark:background: #0b1220;">
      <!-- Tech tree will be rendered here -->
    </div>
  `;

  return {
    root,
    search: root.querySelector('#techTreeSearch'),
    category: root.querySelector('#techTreeCategory'),
    autoCompleteToggle: root.querySelector('#autoCompleteToggle'),
    stats: root.querySelector('#techTreeStats'),
    canvas: root.querySelector('#techTreeCanvas'),
  };
}

/**
 * Setup event listeners for tech tree controls
 * @param {Object} ui - UI elements
 * @param {Object} state - State object
 * @param {Function} onAddNode - Add node callback
 */
function setupTechTreeEventListeners(ui, state, onAddNode) {
  // Search
  ui.search.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTechTree(ui, state, onAddNode);
  });

  // Category filter
  ui.category.addEventListener('change', (e) => {
    state.selectedCategory = e.target.value;
    renderTechTree(ui, state, onAddNode);
  });

  // Auto-complete toggle
  ui.autoCompleteToggle.addEventListener('change', (e) => {
    state.autoCompleteEnabled = e.target.checked;
  });
}

/**
 * Render tech tree visualization
 * @param {Object} ui - UI elements
 * @param {Object} state - State object
 * @param {Function} onAddNode - Add node callback
 */
function renderTechTree(ui, state, onAddNode) {
  let displayTree = state.techTree;

  // Apply category filter
  if (state.selectedCategory !== 'all') {
    displayTree = filterTechTreeByCategory(state.techTree, state.selectedCategory);
  }

  // Apply search filter
  let displayNodes = displayTree.nodes;
  if (state.searchQuery) {
    displayNodes = searchTechTree(displayTree, state.searchQuery);
  }

  // Get availability for each node
  const availability = getNodeAvailability(state.techTree, state.buildOrder);

  // Update stats
  const availableCount = Array.from(availability.values()).filter(a => a.status === 'available').length;
  const builtCount = Array.from(availability.values()).filter(a => a.status === 'built').length;
  const lockedCount = Array.from(availability.values()).filter(a => a.status === 'locked').length;

  ui.stats.innerHTML = `
    <span style="color: #10b981;">✓ ${availableCount} available</span>
    <span style="color: #3b82f6;">● ${builtCount} built</span>
    <span style="color: #94a3b8;">⊗ ${lockedCount} locked</span>
  `;

  // Render hierarchical tree layout
  renderHierarchicalTree(ui.canvas, displayTree, displayNodes, availability, state, onAddNode);
}

/**
 * Render hierarchical tech tree layout
 * @param {HTMLElement} canvas - Canvas element
 * @param {Object} techTree - Full tech tree
 * @param {Array} nodes - Nodes to display
 * @param {Map} availability - Node availability map
 * @param {Object} state - State object
 * @param {Function} onAddNode - Add node callback
 */
function renderHierarchicalTree(canvas, techTree, nodes, availability, state, onAddNode) {
  canvas.innerHTML = '';

  // Group nodes by tier
  const nodesByTier = {};
  const nodeIds = new Set(nodes.map(n => n.id));

  Object.entries(techTree.tiers).forEach(([tier, tierNodes]) => {
    const filteredTierNodes = tierNodes.filter(n => nodeIds.has(n.id));
    if (filteredTierNodes.length > 0) {
      nodesByTier[tier] = filteredTierNodes;
    }
  });

  // Create tier columns
  const tiers = Object.keys(nodesByTier).sort((a, b) => parseInt(a) - parseInt(b));

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '40px';
  container.style.alignItems = 'flex-start';
  container.style.minWidth = 'min-content';

  tiers.forEach(tier => {
    const tierColumn = document.createElement('div');
    tierColumn.style.display = 'flex';
    tierColumn.style.flexDirection = 'column';
    tierColumn.style.gap = '12px';
    tierColumn.style.minWidth = '200px';

    // Tier header
    const tierHeader = document.createElement('div');
    tierHeader.style.fontWeight = 'bold';
    tierHeader.style.fontSize = '13px';
    tierHeader.style.color = '#666';
    tierHeader.style.marginBottom = '8px';
    tierHeader.style.textAlign = 'center';
    tierHeader.textContent = `Tier ${tier}`;
    tierColumn.appendChild(tierHeader);

    // Tier nodes
    nodesByTier[tier].forEach(node => {
      const nodeEl = createTechTreeNode(node, availability.get(node.id), state, onAddNode, techTree);
      tierColumn.appendChild(nodeEl);
    });

    container.appendChild(tierColumn);
  });

  canvas.appendChild(container);
}

/**
 * Create tech tree node element
 * @param {Object} node - Node data
 * @param {Object} avail - Availability status
 * @param {Object} state - State object
 * @param {Function} onAddNode - Add node callback
 * @param {Object} techTree - Full tech tree
 * @returns {HTMLElement} Node element
 */
function createTechTreeNode(node, avail, state, onAddNode, techTree) {
  const nodeEl = document.createElement('div');

  // Determine colors based on status
  let bgColor, borderColor, textColor, cursor;

  switch (avail.status) {
    case 'available':
      bgColor = '#d1fae5';
      borderColor = '#10b981';
      textColor = '#065f46';
      cursor = 'pointer';
      break;
    case 'built':
      bgColor = '#dbeafe';
      borderColor = '#3b82f6';
      textColor = '#1e40af';
      cursor = 'default';
      break;
    case 'locked':
    default:
      bgColor = '#f1f5f9';
      borderColor = '#cbd5e1';
      textColor = '#64748b';
      cursor = 'not-allowed';
      break;
  }

  nodeEl.style.cssText = `
    padding: 12px;
    background: ${bgColor};
    border: 2px solid ${borderColor};
    border-radius: 8px;
    cursor: ${cursor};
    transition: all 0.2s;
    position: relative;
  `;

  nodeEl.innerHTML = `
    <div style="font-weight: 600; font-size: 13px; color: ${textColor}; margin-bottom: 6px;">
      ${node.name}
    </div>
    <div style="font-size: 11px; color: ${textColor}; opacity: 0.8; margin-bottom: 6px;">
      ${node.kind} ${node.mineral}m ${node.gas}g
    </div>
    ${avail.status === 'locked' ? `
      <div style="font-size: 10px; color: #ef4444; margin-top: 6px;">
        Missing: ${avail.missing.join(', ')}
      </div>
    ` : ''}
  `;

  // Hover effect for available nodes
  if (avail.canBuild) {
    nodeEl.addEventListener('mouseenter', () => {
      nodeEl.style.transform = 'translateY(-2px)';
      nodeEl.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
    });

    nodeEl.addEventListener('mouseleave', () => {
      nodeEl.style.transform = 'translateY(0)';
      nodeEl.style.boxShadow = 'none';
    });
  }

  // Click handler
  nodeEl.addEventListener('click', (e) => {
    if (avail.status === 'built') {
      showStatus(`${node.name} already in build order`, 'info', 2000);
      return;
    }

    if (avail.status === 'locked' && !state.autoCompleteEnabled) {
      showStatus(`${node.name} requires: ${avail.missing.join(', ')}`, 'error', 3000);
      return;
    }

    // Check if shift key is pressed or auto-complete is enabled and node is locked
    if ((e.shiftKey || (state.autoCompleteEnabled && avail.status === 'locked'))) {
      // Auto-complete path
      const path = getAutoCompletePath(techTree, node.id, state.buildOrder);

      if (path.length > 0) {
        showStatus(`Adding ${path.length} items to complete tech path`, 'success', 2000);
        path.forEach(pathNode => {
          onAddNode({
            name: pathNode.name,
            kind: pathNode.kind,
            mineral: pathNode.mineral,
            gas: pathNode.gas,
            supply: pathNode.supply,
            buildtime: pathNode.buildtime,
            image: pathNode.image,
            required: pathNode.prerequisites,
          });
        });
      } else {
        showStatus(`No path needed for ${node.name}`, 'info', 2000);
      }
    } else if (avail.canBuild) {
      // Single node add
      onAddNode({
        name: node.name,
        kind: node.kind,
        mineral: node.mineral,
        gas: node.gas,
        supply: node.supply,
        buildtime: node.buildtime,
        image: node.image,
        required: node.prerequisites,
      });
      showStatus(`Added ${node.name}`, 'success', 1500);
    }
  });

  return nodeEl;
}
