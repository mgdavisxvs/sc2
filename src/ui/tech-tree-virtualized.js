/**
 * Virtualized Tech Tree Renderer
 * Only renders visible nodes for performance with large tech trees
 */

/**
 * Create virtualized tech tree renderer
 * @param {HTMLElement} container - Scroll container
 * @param {Array} nodes - All nodes
 * @param {Object} nodesByTier - Nodes grouped by tier
 * @param {Map} availability - Node availability map
 * @param {Object} state - State object
 * @param {Function} onAddNode - Add node callback
 * @param {Object} techTree - Full tech tree
 * @param {Function} createNodeFn - Function to create node element
 * @returns {Object} Virtualized renderer
 */
export function createVirtualizedTechTree(
  container,
  nodes,
  nodesByTier,
  availability,
  state,
  onAddNode,
  techTree,
  createNodeFn
) {
  // Constants
  const NODE_HEIGHT = 80; // Estimated node height with padding/margin
  const NODE_WIDTH = 200; // Node width
  const TIER_GAP = 40; // Gap between tiers
  const NODE_GAP = 12; // Gap between nodes
  const OVERSCAN = 2; // Number of extra nodes to render above/below viewport

  // Calculate layout
  const layout = calculateLayout(nodesByTier, NODE_HEIGHT, NODE_WIDTH, TIER_GAP, NODE_GAP);

  // Create viewport
  const viewport = document.createElement('div');
  viewport.style.cssText = `
    position: relative;
    width: ${layout.totalWidth}px;
    height: ${layout.totalHeight}px;
  `;

  container.appendChild(viewport);

  // State
  let visibleNodes = new Set();
  let renderedElements = new Map(); // nodeId -> element

  /**
   * Calculate which nodes should be visible
   */
  function calculateVisibleNodes() {
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const viewportHeight = container.clientHeight;
    const viewportWidth = container.clientWidth;

    const visible = new Set();

    Object.entries(layout.nodePositions).forEach(([nodeId, pos]) => {
      // Check if node is in viewport (with overscan)
      const inViewportY =
        pos.y + NODE_HEIGHT >= scrollTop - OVERSCAN * NODE_HEIGHT &&
        pos.y <= scrollTop + viewportHeight + OVERSCAN * NODE_HEIGHT;

      const inViewportX =
        pos.x + NODE_WIDTH >= scrollLeft &&
        pos.x <= scrollLeft + viewportWidth + NODE_WIDTH;

      if (inViewportY && inViewportX) {
        visible.add(nodeId);
      }
    });

    return visible;
  }

  /**
   * Render visible nodes
   */
  function render() {
    const newVisibleNodes = calculateVisibleNodes();

    // Remove nodes that are no longer visible
    visibleNodes.forEach((nodeId) => {
      if (!newVisibleNodes.has(nodeId)) {
        const element = renderedElements.get(nodeId);
        if (element && element.parentNode) {
          viewport.removeChild(element);
        }
        renderedElements.delete(nodeId);
      }
    });

    // Add newly visible nodes
    newVisibleNodes.forEach((nodeId) => {
      if (!visibleNodes.has(nodeId)) {
        const node = techTree.nodeMap.get(nodeId);
        const avail = availability.get(nodeId);
        const pos = layout.nodePositions[nodeId];

        if (node && avail && pos) {
          const element = createNodeFn(node, avail, state, onAddNode, techTree);

          // Position absolutely
          element.style.position = 'absolute';
          element.style.left = `${pos.x}px`;
          element.style.top = `${pos.y}px`;
          element.style.width = `${NODE_WIDTH}px`;

          viewport.appendChild(element);
          renderedElements.set(nodeId, element);
        }
      }
    });

    visibleNodes = newVisibleNodes;
  }

  // Initial render
  render();

  // Set up scroll listener with throttling
  let scrollTimeout = null;
  const handleScroll = () => {
    if (scrollTimeout) {
      return;
    }

    scrollTimeout = setTimeout(() => {
      render();
      scrollTimeout = null;
    }, 16); // ~60fps
  };

  container.addEventListener('scroll', handleScroll);

  // Return controller
  return {
    render,
    update: (newAvailability, newState) => {
      // Update state
      Object.assign(state, newState);

      // Re-render all visible nodes
      renderedElements.forEach((element, nodeId) => {
        if (element.parentNode) {
          viewport.removeChild(element);
        }
      });
      renderedElements.clear();
      visibleNodes.clear();

      render();
    },
    destroy: () => {
      container.removeEventListener('scroll', handleScroll);
      viewport.innerHTML = '';
      renderedElements.clear();
      visibleNodes.clear();
    },
    getStats: () => ({
      totalNodes: nodes.length,
      visibleNodes: visibleNodes.size,
      renderedElements: renderedElements.size,
    }),
  };
}

/**
 * Calculate layout positions for all nodes
 * @param {Object} nodesByTier - Nodes grouped by tier
 * @param {number} nodeHeight - Height of each node
 * @param {number} nodeWidth - Width of each node
 * @param {number} tierGap - Gap between tiers
 * @param {number} nodeGap - Gap between nodes
 * @returns {Object} Layout information
 */
function calculateLayout(nodesByTier, nodeHeight, nodeWidth, tierGap, nodeGap) {
  const nodePositions = {};
  let currentX = 0;
  let totalHeight = 0;

  const tiers = Object.keys(nodesByTier).sort((a, b) => parseInt(a) - parseInt(b));

  tiers.forEach((tier, tierIndex) => {
    const tierNodes = nodesByTier[tier];
    let currentY = 0;

    tierNodes.forEach((node, nodeIndex) => {
      nodePositions[node.id] = {
        x: currentX,
        y: currentY,
        tier: parseInt(tier),
      };

      currentY += nodeHeight + nodeGap;
    });

    // Update total height
    totalHeight = Math.max(totalHeight, currentY - nodeGap);

    // Move to next tier column
    currentX += nodeWidth + tierGap;
  });

  return {
    nodePositions,
    totalWidth: currentX - tierGap,
    totalHeight,
    tierCount: tiers.length,
  };
}

/**
 * Create virtualized container with scroll
 * @param {number} maxHeight - Maximum container height
 * @returns {HTMLElement} Container element
 */
export function createVirtualizedContainer(maxHeight = 600) {
  const container = document.createElement('div');
  container.style.cssText = `
    overflow: auto;
    max-height: ${maxHeight}px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    position: relative;
  `;

  return container;
}

/**
 * Performance monitoring for virtualized rendering
 */
export class VirtualizationMonitor {
  constructor() {
    this.metrics = {
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      peakVisibleNodes: 0,
      memoryEstimate: 0,
    };

    this.renderTimes = [];
  }

  startRender() {
    this.renderStart = performance.now();
  }

  endRender(visibleNodeCount) {
    const renderTime = performance.now() - this.renderStart;

    this.metrics.renderCount++;
    this.metrics.totalRenderTime += renderTime;
    this.metrics.averageRenderTime =
      this.metrics.totalRenderTime / this.metrics.renderCount;
    this.metrics.peakVisibleNodes = Math.max(
      this.metrics.peakVisibleNodes,
      visibleNodeCount
    );

    this.renderTimes.push(renderTime);

    // Keep only last 100 renders
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }

    // Estimate memory (very rough)
    this.metrics.memoryEstimate = visibleNodeCount * 2000; // ~2KB per node element
  }

  getMetrics() {
    return {
      ...this.metrics,
      p50RenderTime: this.getPercentile(50),
      p95RenderTime: this.getPercentile(95),
      p99RenderTime: this.getPercentile(99),
    };
  }

  getPercentile(p) {
    if (this.renderTimes.length === 0) return 0;

    const sorted = [...this.renderTimes].sort((a, b) => a - b);
    const index = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[index] || 0;
  }

  reset() {
    this.metrics = {
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      peakVisibleNodes: 0,
      memoryEstimate: 0,
    };
    this.renderTimes = [];
  }
}
