/**
 * Tech Tree Builder & Analysis
 * Interactive tech tree with automatic prerequisite path completion
 */

import { topologicalSort } from './graph.js';
import { findMissingPrereqs } from './build-order.js';

/**
 * Build tech tree graph from game data
 * @param {Object} gameData - Normalized game data
 * @param {string} race - Race (protoss/terran/zerg)
 * @returns {Object} Tech tree graph
 */
export function buildTechTree(gameData, race) {
  if (!gameData || !race) {
    return { nodes: [], edges: [], tiers: {} };
  }

  const raceData = gameData[race];
  if (!raceData) {
    return { nodes: [], edges: [], tiers: {} };
  }

  const nodes = [];
  const edges = [];
  const nodeMap = new Map();
  const nodeByName = new Map(); // O(1) lookup by name

  // Collect all entities (units, buildings, upgrades)
  ['units', 'buildings', 'upgrades'].forEach(category => {
    const items = raceData[category] || {};
    Object.entries(items).forEach(([id, item]) => {
      const node = {
        id: `${category}-${id}`,
        name: item.name,
        kind: category.slice(0, -1), // units -> unit, buildings -> building
        category,
        image: item.image,
        mineral: item.cost?.mineral || 0,
        gas: item.cost?.gas || 0,
        supply: item.supply?.required || 0,
        buildtime: item.time || item.build_time || 0,
        prerequisites: item.tech_tree?.requires || [],
        data: item,
      };

      nodes.push(node);
      nodeMap.set(node.id, node);
      nodeByName.set(node.name, node); // Add name-based index
    });
  });

  // Build edges based on prerequisites - O(V + E) instead of O(E × V)
  nodes.forEach(node => {
    if (node.prerequisites && node.prerequisites.length > 0) {
      node.prerequisites.forEach(prereqName => {
        // O(1) lookup by name instead of O(n) find
        const prereqNode = nodeByName.get(prereqName);
        if (prereqNode) {
          edges.push({
            from: prereqNode.id,
            to: node.id,
            fromName: prereqNode.name,
            toName: node.name,
          });
        }
      });
    }
  });

  // Calculate tech tiers (topological levels)
  const tiers = calculateTechTiers(nodes, edges, nodeByName);

  return {
    nodes,
    edges,
    tiers,
    nodeMap,
    nodeByName, // Add for O(1) name-based lookups
  };
}

/**
 * Calculate tech tiers (levels) for visualization
 * @param {Array} nodes - Tech tree nodes
 * @param {Array} edges - Tech tree edges
 * @param {Map} nodeByName - Name-based node index for O(1) lookup
 * @returns {Object} Tier assignments
 */
function calculateTechTiers(nodes, edges, nodeByName) {
  const tiers = {};
  const tierAssignments = new Map();

  // Find nodes with no prerequisites (tier 0)
  const tier0 = nodes.filter(n => !n.prerequisites || n.prerequisites.length === 0);
  tier0.forEach(node => {
    tierAssignments.set(node.id, 0);
  });
  tiers[0] = tier0;

  // BFS to assign tiers
  let currentTier = 0;
  let changed = true;

  while (changed && currentTier < 20) {
    changed = false;
    currentTier++;
    tiers[currentTier] = [];

    nodes.forEach(node => {
      if (tierAssignments.has(node.id)) return; // Already assigned

      // Check if all prerequisites are assigned to lower tiers
      const prereqTiers = node.prerequisites
        .map(prereqName => {
          // O(1) lookup instead of O(n) find
          const prereqNode = nodeByName.get(prereqName);
          return prereqNode ? tierAssignments.get(prereqNode.id) : null;
        })
        .filter(t => t !== null && t !== undefined);

      if (prereqTiers.length === node.prerequisites.length) {
        // All prerequisites assigned
        const maxPrereqTier = Math.max(...prereqTiers);
        const nodeTier = maxPrereqTier + 1;
        tierAssignments.set(node.id, nodeTier);

        if (!tiers[nodeTier]) tiers[nodeTier] = [];
        tiers[nodeTier].push(node);
        changed = true;
      }
    });
  }

  // Any remaining nodes go to final tier
  nodes.forEach(node => {
    if (!tierAssignments.has(node.id)) {
      const finalTier = currentTier + 1;
      tierAssignments.set(node.id, finalTier);
      if (!tiers[finalTier]) tiers[finalTier] = [];
      tiers[finalTier].push(node);
    }
  });

  return tiers;
}

/**
 * Get available nodes based on current build
 * @param {Object} techTree - Tech tree graph
 * @param {Array} buildOrder - Current build order
 * @returns {Object} Availability status for each node
 */
export function getNodeAvailability(techTree, buildOrder) {
  const availability = new Map();
  const builtNames = new Set(buildOrder.map(item => item.name));

  techTree.nodes.forEach(node => {
    // Check if already built
    if (builtNames.has(node.name)) {
      availability.set(node.id, {
        status: 'built',
        canBuild: false,
        missing: [],
      });
      return;
    }

    // Check prerequisites
    const missingPrereqs = node.prerequisites.filter(prereq => !builtNames.has(prereq));

    if (missingPrereqs.length === 0) {
      availability.set(node.id, {
        status: 'available',
        canBuild: true,
        missing: [],
      });
    } else {
      availability.set(node.id, {
        status: 'locked',
        canBuild: false,
        missing: missingPrereqs,
      });
    }
  });

  return availability;
}

/**
 * Find prerequisite path to unlock a node
 * @param {Object} techTree - Tech tree graph
 * @param {string} targetNodeId - Target node ID
 * @param {Array} buildOrder - Current build order
 * @returns {Array} Path of nodes to build (in order)
 */
export function findPrerequisitePath(techTree, targetNodeId, buildOrder) {
  const targetNode = techTree.nodeMap.get(targetNodeId);
  if (!targetNode) return [];

  const builtNames = new Set(buildOrder.map(item => item.name));

  // If already built, return empty path
  if (builtNames.has(targetNode.name)) {
    return [];
  }

  // BFS to find shortest path
  const path = [];
  const visited = new Set();
  const queue = [[targetNode]];

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currentNode = currentPath[0];

    if (visited.has(currentNode.id)) continue;
    visited.add(currentNode.id);

    // Check if all prerequisites are built
    const missingPrereqs = currentNode.prerequisites.filter(prereq => !builtNames.has(prereq));

    if (missingPrereqs.length === 0) {
      // Found a valid path
      return currentPath.reverse();
    }

    // Add prerequisite nodes to queue
    missingPrereqs.forEach(prereqName => {
      // O(1) lookup instead of O(n) find
      const prereqNode = techTree.nodeByName.get(prereqName);
      if (prereqNode && !visited.has(prereqNode.id)) {
        queue.push([prereqNode, ...currentPath]);
      }
    });
  }

  return [];
}

/**
 * Get auto-complete build path for a node
 * @param {Object} techTree - Tech tree graph
 * @param {string} targetNodeId - Target node ID
 * @param {Array} buildOrder - Current build order
 * @returns {Array} Complete build path including target
 */
export function getAutoCompletePath(techTree, targetNodeId, buildOrder) {
  const path = findPrerequisitePath(techTree, targetNodeId, buildOrder);
  const targetNode = techTree.nodeMap.get(targetNodeId);

  if (!targetNode) return [];

  // Add target node to end of path
  if (!path.some(n => n.id === targetNodeId)) {
    path.push(targetNode);
  }

  return path;
}

/**
 * Filter tech tree by category
 * @param {Object} techTree - Tech tree graph
 * @param {string} category - Category to filter (units/buildings/upgrades)
 * @returns {Object} Filtered tech tree
 */
export function filterTechTreeByCategory(techTree, category) {
  const filteredNodes = techTree.nodes.filter(n => n.category === category);
  const nodeIds = new Set(filteredNodes.map(n => n.id));

  const filteredEdges = techTree.edges.filter(e =>
    nodeIds.has(e.from) && nodeIds.has(e.to)
  );

  const filteredTiers = {};
  Object.entries(techTree.tiers).forEach(([tier, nodes]) => {
    const filtered = nodes.filter(n => n.category === category);
    if (filtered.length > 0) {
      filteredTiers[tier] = filtered;
    }
  });

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    tiers: filteredTiers,
    nodeMap: techTree.nodeMap,
  };
}

/**
 * Search tech tree by name
 * @param {Object} techTree - Tech tree graph
 * @param {string} query - Search query
 * @returns {Array} Matching nodes
 */
export function searchTechTree(techTree, query) {
  if (!query || query.trim() === '') return techTree.nodes;

  const lowerQuery = query.toLowerCase().trim();
  return techTree.nodes.filter(node =>
    node.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get critical path (longest dependency chain) in tech tree
 * @param {Object} techTree - Tech tree graph
 * @returns {Array} Critical path nodes
 */
export function getCriticalPath(techTree) {
  // Find node with highest tier
  let maxTier = 0;
  let maxTierNode = null;

  Object.entries(techTree.tiers).forEach(([tier, nodes]) => {
    const tierNum = parseInt(tier);
    if (tierNum > maxTier && nodes.length > 0) {
      maxTier = tierNum;
      maxTierNode = nodes[0]; // Take first node from highest tier
    }
  });

  if (!maxTierNode) return [];

  // Backtrack to find longest path
  const path = [maxTierNode];
  let currentNode = maxTierNode;

  while (currentNode.prerequisites && currentNode.prerequisites.length > 0) {
    // Find prerequisite with highest tier
    const prereqNodes = currentNode.prerequisites
      .map(prereqName => techTree.nodeByName.get(prereqName)) // O(1) lookup
      .filter(Boolean);

    if (prereqNodes.length === 0) break;

    // Choose prerequisite from highest tier
    const prereqWithTiers = prereqNodes.map(n => {
      const tier = Object.entries(techTree.tiers).find(([t, nodes]) =>
        nodes.some(node => node.id === n.id)
      );
      return { node: n, tier: tier ? parseInt(tier[0]) : 0 };
    });

    prereqWithTiers.sort((a, b) => b.tier - a.tier);
    currentNode = prereqWithTiers[0].node;
    path.unshift(currentNode);
  }

  return path;
}

/**
 * Get dependency count for each node (how many things depend on it)
 * @param {Object} techTree - Tech tree graph
 * @returns {Map} Node ID -> dependency count
 */
export function getDependencyCounts(techTree) {
  const counts = new Map();

  // Initialize all nodes with 0
  techTree.nodes.forEach(node => counts.set(node.id, 0));

  // Count incoming edges
  techTree.edges.forEach(edge => {
    const count = counts.get(edge.from) || 0;
    counts.set(edge.from, count + 1);
  });

  return counts;
}

/**
 * Get popular nodes (most depended upon)
 * @param {Object} techTree - Tech tree graph
 * @param {number} limit - Number of popular nodes to return
 * @returns {Array} Popular nodes sorted by dependency count
 */
export function getPopularNodes(techTree, limit = 10) {
  const counts = getDependencyCounts(techTree);

  const nodesWithCounts = techTree.nodes.map(node => ({
    node,
    dependencyCount: counts.get(node.id) || 0,
  }));

  nodesWithCounts.sort((a, b) => b.dependencyCount - a.dependencyCount);

  return nodesWithCounts.slice(0, limit);
}

/**
 * Validate tech tree for cycles
 * @param {Object} techTree - Tech tree graph
 * @returns {Object} Validation result
 */
export function validateTechTree(techTree) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function detectCycle(nodeId, path = []) {
    if (recursionStack.has(nodeId)) {
      // Cycle detected
      const cycleStart = path.indexOf(nodeId);
      cycles.push(path.slice(cycleStart));
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    // Check all outgoing edges
    const outgoingEdges = techTree.edges.filter(e => e.from === nodeId);
    for (const edge of outgoingEdges) {
      if (detectCycle(edge.to, [...path])) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // Check each node
  techTree.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      detectCycle(node.id);
    }
  });

  return {
    valid: cycles.length === 0,
    cycles,
    message: cycles.length === 0
      ? 'Tech tree is valid (no cycles)'
      : `Found ${cycles.length} cycle(s) in tech tree`,
  };
}
