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

      if (component.length > 1) {
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
    if (!inDegree.has(node)) inDegree.set(node, 0);
  }

  // Calculate in-degrees
  for (const [node, deps] of graph) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
    }
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

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If result doesn't contain all nodes, there's a cycle
  if (result.length !== graph.size) {
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
