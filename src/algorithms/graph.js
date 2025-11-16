/**
 * Graph Algorithms
 * Implements Knuth's rigorous graph algorithms for tech trees
 * - Tarjan's algorithm for cycle detection
 * - Kahn's algorithm for topological sort
 * - Build tree construction with cycle prevention
 */

import { logger } from '../core/logger.js';
import { norm } from '../utils/dom.js';

/**
 * Build dependency graph from entities
 * @param {Array} entities - List of entities
 * @param {Function} getPrereqs - Function to get prerequisites for an entity
 * @returns {Map} Adjacency list (entity -> [dependencies])
 */
export function buildDependencyGraph(entities, getPrereqs) {
  const graph = new Map();

  for (const entity of entities) {
    const key = norm(entity.name);
    const deps = getPrereqs(entity).map(norm);
    graph.set(key, deps);
  }

  return graph;
}

/**
 * Detect cycles in dependency graph using Tarjan's algorithm
 * @param {Map} graph - Adjacency list
 * @returns {Array} List of strongly connected components (cycles)
 */
export function detectCycles(graph) {
  const index = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  let idx = 0;
  const cycles = [];

  function strongConnect(v) {
    index.set(v, idx);
    lowlink.set(v, idx);
    idx++;
    stack.push(v);
    onStack.add(v);

    const neighbors = graph.get(v) || [];
    for (const w of neighbors) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);

      // Check for multi-node cycles or self-loops
      const hasSelfLoop = component.length === 1 &&
                          (graph.get(component[0]) || []).includes(component[0]);

      if (component.length > 1 || hasSelfLoop) {
        cycles.push(component);
        logger.warn('Cycle detected:', component);
      }
    }
  }

  for (const v of graph.keys()) {
    if (!index.has(v)) {
      strongConnect(v);
    }
  }

  return cycles;
}

/**
 * Topological sort using Kahn's algorithm
 * @param {Map} graph - Adjacency list
 * @returns {Array|null} Sorted nodes or null if cycle exists
 */
export function topologicalSort(graph) {
  const inDegree = new Map();
  const result = [];
  const queue = [];

  // Initialize in-degrees
  for (const node of graph.keys()) {
    inDegree.set(node, 0);
  }

  // Build reverse graph for correct in-degree calculation
  // If A depends on B, then edge is B->A, so A's in-degree increases
  const reverseGraph = new Map();
  for (const node of graph.keys()) {
    reverseGraph.set(node, []);
  }

  for (const [node, deps] of graph) {
    for (const dep of deps) {
      // Ensure dep exists in reverse graph
      if (!reverseGraph.has(dep)) {
        reverseGraph.set(dep, []);
        inDegree.set(dep, 0);
      }
      // dep -> node edge in reverse graph
      reverseGraph.get(dep).push(node);
    }
  }

  // Calculate in-degrees from reverse graph
  for (const [node, dependents] of reverseGraph) {
    inDegree.set(node, (graph.get(node) || []).length);
  }

  // Find nodes with no dependencies
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  // Process queue
  while (queue.length) {
    const node = queue.shift();
    result.push(node);

    // Process nodes that depend on current node (use reverse graph)
    const dependents = reverseGraph.get(node) || [];
    for (const dependent of dependents) {
      inDegree.set(dependent, inDegree.get(dependent) - 1);
      if (inDegree.get(dependent) === 0) {
        queue.push(dependent);
      }
    }
  }

  // If result doesn't contain all nodes, there's a cycle
  const totalNodes = inDegree.size;
  if (result.length !== totalNodes) {
    logger.error('Topological sort failed: cycle detected');
    return null;
  }

  return result;
}

/**
 * Build prerequisite tree for an entity
 * @param {Object} entity - Entity to build tree for
 * @param {Function} findEntity - Function to find entity by name
 * @param {Set} seen - Set of seen entities (for cycle detection)
 * @returns {Object} Tree structure
 */
export function buildPrereqTree(entity, findEntity, seen = new Set()) {
  const key = `${entity.kind}:${norm(entity.name)}`;

  // Cycle detection
  if (seen.has(key)) {
    logger.warn('Cycle detected in prerequisite tree:', entity.name);
    return { name: entity.name, children: [], cyclic: true };
  }

  seen.add(key);

  const children = [];
  const requires = entity.tech_tree?.requires || entity.required || [];
  const reqList = Array.isArray(requires) ? requires : [requires].filter(Boolean);

  for (const reqName of reqList) {
    const reqEntity = findEntity(reqName);
    if (reqEntity) {
      children.push(buildPrereqTree(reqEntity, findEntity, new Set(seen)));
    } else {
      // Unknown prerequisite
      children.push({ name: reqName, kind: 'unknown', children: [] });
    }
  }

  seen.delete(key);

  return {
    name: entity.name,
    kind: entity.kind,
    children,
    cyclic: false,
  };
}

/**
 * Convert tree to HTML representation
 * @param {Object} node - Tree node
 * @param {number} depth - Current depth
 * @returns {string} HTML string
 */
export function treeToHtml(node, depth = 0) {
  const indent = '&nbsp;'.repeat(depth * 2);
  const id = `jump-${CSS.escape(norm(node.name))}`;
  const link = `<a href="#${id}" class="underline decoration-dotted hover:text-blue-600">${node.name}</a>`;

  if (node.cyclic) {
    return `<div class="flex items-center gap-2 text-red-600">${indent}${link} (cyclic)</div>`;
  }

  if (!node.children?.length) {
    return `<div class="flex items-center gap-2">${indent}${link}</div>`;
  }

  return (
    `<div class="flex items-center gap-2">${indent}${link}</div>` +
    node.children.map(ch => treeToHtml(ch, depth + 1)).join('')
  );
}

/**
 * Find critical path (longest path) in tech tree
 * Used to identify build time bottlenecks
 * @param {Object} tree - Prerequisite tree
 * @param {Function} getTime - Function to get build time for entity
 * @returns {Object} { path: [], totalTime: number }
 */
export function findCriticalPath(tree, getTime) {
  if (!tree.children || tree.children.length === 0) {
    return {
      path: [tree.name],
      totalTime: getTime(tree.name) || 0,
    };
  }

  // Find longest path through children
  let longestPath = { path: [], totalTime: 0 };

  for (const child of tree.children) {
    const childPath = findCriticalPath(child, getTime);
    if (childPath.totalTime > longestPath.totalTime) {
      longestPath = childPath;
    }
  }

  return {
    path: [tree.name, ...longestPath.path],
    totalTime: (getTime(tree.name) || 0) + longestPath.totalTime,
  };
}

/**
 * Get all paths from root to leaves
 * @param {Object} tree - Tree node
 * @param {Array} currentPath - Current path being built
 * @returns {Array} Array of paths
 */
export function getAllPaths(tree, currentPath = []) {
  const newPath = [...currentPath, tree.name];

  if (!tree.children || tree.children.length === 0) {
    return [newPath];
  }

  const paths = [];
  for (const child of tree.children) {
    paths.push(...getAllPaths(child, newPath));
  }

  return paths;
}

/**
 * Resolve cyclic dependencies with detailed error reporting
 *
 * ALGORITHM:
 *   1. Find SCCs using Tarjan's algorithm
 *   2. Check for non-trivial SCCs (cycles)
 *   3. For each cycle, generate actionable error message
 *   4. Contract SCCs to meta-nodes
 *   5. Return DAG of meta-nodes
 *
 * @param {Map} graph - Dependency graph
 * @param {Map} nameToEntity - Map of entity names to full entities
 * @returns {Object} { dag: Map, cycles: Array, errors: Array }
 * @throws {Error} If cycles are detected (impossible in SC2)
 */
export function resolveCyclicDependencies(graph, nameToEntity = new Map()) {
  const sccs = tarjanSCC(graph);
  const cycles = [];
  const errors = [];

  // Check for non-trivial SCCs (actual cycles)
  for (const scc of sccs) {
    if (scc.length > 1) {
      cycles.push(scc);

      // Generate detailed error message
      const cycleChain = [...scc, scc[0]].join(' → ');
      const errorMsg = generateCycleError(scc, nameToEntity);

      errors.push({
        type: 'CIRCULAR_DEPENDENCY',
        entities: scc,
        chain: cycleChain,
        message: errorMsg,
      });
    }
  }

  if (cycles.length > 0) {
    const errorMessage = errors.map(e => e.message).join('\n\n');
    throw new Error(
      `❌ Circular dependencies detected in game data:\n\n${errorMessage}\n\n` +
      `These circular dependencies are impossible in StarCraft 2.\n` +
      `Please fix the game data file.`
    );
  }

  // Build SCC graph (contract SCCs to single nodes)
  const sccGraph = contractSCCs(graph, sccs);

  return {
    dag: sccGraph,
    cycles: [],
    errors: [],
    sccs,
  };
}

/**
 * Tarjan's algorithm for finding Strongly Connected Components
 *
 * COMPLEXITY: O(V + E)
 *
 * @param {Map} graph - Adjacency list
 * @returns {Array} Array of SCCs (each SCC is an array of nodes)
 */
function tarjanSCC(graph) {
  const index = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  let idx = 0;
  const sccs = [];

  function strongConnect(v) {
    index.set(v, idx);
    lowlink.set(v, idx);
    idx++;
    stack.push(v);
    onStack.add(v);

    const neighbors = graph.get(v) || [];
    for (const w of neighbors) {
      if (!graph.has(w)) {
        // Node w doesn't exist in graph - skip
        continue;
      }

      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);

      sccs.push(component);
    }
  }

  for (const v of graph.keys()) {
    if (!index.has(v)) {
      strongConnect(v);
    }
  }

  return sccs;
}

/**
 * Generate detailed error message for a cycle
 *
 * @param {Array} cycle - Array of entity names in cycle
 * @param {Map} nameToEntity - Map of names to entities
 * @returns {string} Formatted error message
 */
function generateCycleError(cycle, nameToEntity) {
  const lines = [];
  lines.push(`Cycle found: ${cycle.join(' ↔ ')}`);
  lines.push('');
  lines.push('Dependency chain:');

  for (let i = 0; i < cycle.length; i++) {
    const current = cycle[i];
    const next = cycle[(i + 1) % cycle.length];

    const entity = nameToEntity.get(current);
    const kind = entity?.kind || 'unknown';

    lines.push(`  ${i + 1}. "${current}" (${kind}) requires "${next}"`);
  }

  lines.push('');
  lines.push('💡 Fix: Remove one of the "requires" dependencies above.');
  lines.push('   In StarCraft 2, tech trees must be acyclic (directed acyclic graph).');

  return lines.join('\n');
}

/**
 * Contract SCCs to meta-nodes, creating a DAG
 *
 * @param {Map} graph - Original graph
 * @param {Array} sccs - Array of SCCs
 * @returns {Map} DAG of meta-nodes
 */
function contractSCCs(graph, sccs) {
  // Create mapping: node -> SCC index
  const nodeToSCC = new Map();
  sccs.forEach((scc, index) => {
    scc.forEach(node => nodeToSCC.set(node, index));
  });

  // Build meta-graph
  const metaGraph = new Map();

  for (let i = 0; i < sccs.length; i++) {
    const metaDeps = new Set();

    // Collect all dependencies from nodes in this SCC
    for (const node of sccs[i]) {
      const deps = graph.get(node) || [];
      for (const dep of deps) {
        const depSCC = nodeToSCC.get(dep);
        if (depSCC !== undefined && depSCC !== i) {
          metaDeps.add(depSCC);
        }
      }
    }

    metaGraph.set(i, [...metaDeps]);
  }

  return metaGraph;
}

/**
 * Validate graph has no cycles and return errors if any
 *
 * @param {Map} graph - Dependency graph
 * @param {Map} nameToEntity - Map of names to entities
 * @returns {Object} { valid: boolean, errors: Array }
 */
export function validateDependencyGraph(graph, nameToEntity = new Map()) {
  try {
    resolveCyclicDependencies(graph, nameToEntity);
    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [{ type: 'CYCLE_DETECTED', message: error.message }],
    };
  }
}

/**
 * Find all cycles in a graph
 *
 * @param {Map} graph - Dependency graph
 * @returns {Array} Array of cycles
 */
export function findAllCycles(graph) {
  const sccs = tarjanSCC(graph);
  return sccs.filter(scc => scc.length > 1);
}

/**
 * Break cycles by removing minimal set of edges
 *
 * HEURISTIC: Remove edge with highest "centrality" in cycle
 *
 * @param {Map} graph - Graph with cycles
 * @returns {Object} { dag: Map, removedEdges: Array }
 */
export function breakCycles(graph) {
  const cycles = findAllCycles(graph);
  const removedEdges = [];
  const newGraph = new Map();

  // Copy graph
  for (const [node, deps] of graph) {
    newGraph.set(node, [...deps]);
  }

  // For each cycle, remove one edge
  for (const cycle of cycles) {
    if (cycle.length < 2) continue;

    // Remove edge from last to first (arbitrary choice)
    const from = cycle[cycle.length - 1];
    const to = cycle[0];

    const deps = newGraph.get(from) || [];
    const filtered = deps.filter(d => d !== to);
    newGraph.set(from, filtered);

    removedEdges.push({ from, to, cycle });
  }

  return { dag: newGraph, removedEdges };
}
