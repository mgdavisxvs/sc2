/**
 * Graph Algorithm Tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildDependencyGraph,
  detectCycles,
  topologicalSort,
  buildPrereqTree,
  resolveCyclicDependencies,
  validateDependencyGraph,
  findAllCycles,
  breakCycles,
  findCriticalPath,
  getAllPaths,
} from '../../algorithms/graph.js';

describe('Dependency Graph Construction', () => {
  it('should build graph from entities', () => {
    const entities = [
      { name: 'Zealot', tech_tree: { requires: ['gateway'] } },
      { name: 'Gateway', tech_tree: { requires: ['pylon'] } },
      { name: 'Pylon', tech_tree: { requires: [] } },
    ];

    const getPrereqs = (e) => e.tech_tree.requires;
    const graph = buildDependencyGraph(entities, getPrereqs);

    expect(graph.size).toBe(3);
    expect(graph.get('zealot')).toEqual(['gateway']);
    expect(graph.get('gateway')).toEqual(['pylon']);
    expect(graph.get('pylon')).toEqual([]);
  });
});

describe('Cycle Detection (Tarjan)', () => {
  it('should detect no cycles in valid tech tree', () => {
    const graph = new Map([
      ['zealot', ['gateway']],
      ['gateway', ['pylon']],
      ['pylon', []],
    ]);

    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });

  it('should detect self-cycle', () => {
    const graph = new Map([
      ['a', ['a']], // Self-cycle
    ]);

    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should detect cycle in chain', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']], // Cycle back to a
    ]);

    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe('Topological Sort (Kahn)', () => {
  it('should sort acyclic graph', () => {
    const graph = new Map([
      ['zealot', ['gateway']],
      ['gateway', ['pylon']],
      ['pylon', []],
    ]);

    const sorted = topologicalSort(graph);

    expect(sorted).not.toBeNull();
    expect(sorted).toHaveLength(3);

    // Pylon should come before Gateway
    const pylonIdx = sorted.indexOf('pylon');
    const gatewayIdx = sorted.indexOf('gateway');
    expect(pylonIdx).toBeLessThan(gatewayIdx);

    // Gateway should come before Zealot
    const zealotIdx = sorted.indexOf('zealot');
    expect(gatewayIdx).toBeLessThan(zealotIdx);
  });

  it('should return null for cyclic graph', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]);

    const sorted = topologicalSort(graph);
    expect(sorted).toBeNull();
  });
});

describe('Prerequisite Tree Building', () => {
  const mockFindEntity = (name) => {
    const entities = {
      'zealot': { name: 'Zealot', kind: 'unit', tech_tree: { requires: ['gateway'] } },
      'gateway': { name: 'Gateway', kind: 'building', tech_tree: { requires: ['pylon'] } },
      'pylon': { name: 'Pylon', kind: 'building', tech_tree: { requires: [] } },
    };
    return entities[name.toLowerCase()];
  };

  it('should build correct prerequisite tree', () => {
    const entity = { name: 'Zealot', kind: 'unit', tech_tree: { requires: ['gateway'] } };

    const tree = buildPrereqTree(entity, mockFindEntity);

    expect(tree.name).toBe('Zealot');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].name).toBe('Gateway');
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].name).toBe('Pylon');
  });

  it('should handle entity with no prerequisites', () => {
    const entity = { name: 'Pylon', kind: 'building', tech_tree: { requires: [] } };

    const tree = buildPrereqTree(entity, mockFindEntity);

    expect(tree.name).toBe('Pylon');
    expect(tree.children).toHaveLength(0);
  });

  it('should detect cycles in tech tree', () => {
    const cyclicFindEntity = (name) => {
      if (name.toLowerCase() === 'a') {
        return { name: 'A', kind: 'unit', tech_tree: { requires: ['b'] } };
      }
      if (name.toLowerCase() === 'b') {
        return { name: 'B', kind: 'unit', tech_tree: { requires: ['a'] } };
      }
      return null;
    };

    const entity = { name: 'A', kind: 'unit', tech_tree: { requires: ['b'] } };

    const tree = buildPrereqTree(entity, cyclicFindEntity);

    expect(tree.cyclic).toBe(false); // Root is not cyclic
    expect(tree.children[0].cyclic).toBe(true); // Child detects cycle
  });
});

describe('Cyclic Dependency Resolution', () => {
  it('should pass validation for acyclic graph', () => {
    const graph = new Map([
      ['zealot', ['gateway']],
      ['gateway', ['pylon']],
      ['pylon', []],
    ]);

    const nameToEntity = new Map([
      ['zealot', { name: 'Zealot', kind: 'unit' }],
      ['gateway', { name: 'Gateway', kind: 'building' }],
      ['pylon', { name: 'Pylon', kind: 'building' }],
    ]);

    expect(() => {
      resolveCyclicDependencies(graph, nameToEntity);
    }).not.toThrow();
  });

  it('should throw detailed error for cyclic dependencies', () => {
    const graph = new Map([
      ['stalker', ['cybernetics core']],
      ['cybernetics core', ['stalker']],
    ]);

    const nameToEntity = new Map([
      ['stalker', { name: 'Stalker', kind: 'unit' }],
      ['cybernetics core', { name: 'Cybernetics Core', kind: 'building' }],
    ]);

    expect(() => {
      resolveCyclicDependencies(graph, nameToEntity);
    }).toThrow(/Circular dependencies detected/);
  });

  it('should generate actionable error messages', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]);

    const nameToEntity = new Map([
      ['a', { name: 'A', kind: 'unit' }],
      ['b', { name: 'B', kind: 'building' }],
      ['c', { name: 'C', kind: 'upgrade' }],
    ]);

    try {
      resolveCyclicDependencies(graph, nameToEntity);
      expect(true).toBe(false); // Should have thrown
    } catch (error) {
      expect(error.message).toContain('Circular dependencies');
      expect(error.message).toContain('💡 Fix:');
      expect(error.message).toContain('directed acyclic graph');
    }
  });

  it('should detect multiple separate cycles', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['a']],
      ['x', ['y']],
      ['y', ['x']],
      ['z', []],
    ]);

    const nameToEntity = new Map();

    expect(() => {
      resolveCyclicDependencies(graph, nameToEntity);
    }).toThrow();
  });

  it('should return SCC information for valid graphs', () => {
    const graph = new Map([
      ['a', []],
      ['b', ['a']],
      ['c', ['b']],
    ]);

    const result = resolveCyclicDependencies(graph);

    expect(result).toHaveProperty('dag');
    expect(result).toHaveProperty('cycles');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('sccs');
    expect(result.cycles).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('Dependency Graph Validation', () => {
  it('should validate acyclic graph', () => {
    const graph = new Map([
      ['zealot', ['gateway']],
      ['gateway', ['pylon']],
      ['pylon', []],
    ]);

    const result = validateDependencyGraph(graph);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject cyclic graph', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);

    const result = validateDependencyGraph(graph);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].type).toBe('CYCLE_DETECTED');
  });

  it('should provide error details', () => {
    const graph = new Map([
      ['stalker', ['cybernetics core']],
      ['cybernetics core', ['stalker']],
    ]);

    const nameToEntity = new Map([
      ['stalker', { name: 'Stalker', kind: 'unit' }],
      ['cybernetics core', { name: 'Cybernetics Core', kind: 'building' }],
    ]);

    const result = validateDependencyGraph(graph, nameToEntity);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toHaveProperty('message');
    expect(result.errors[0].message).toContain('Circular');
  });
});

describe('Find All Cycles', () => {
  it('should find no cycles in acyclic graph', () => {
    const graph = new Map([
      ['a', []],
      ['b', ['a']],
      ['c', ['b']],
    ]);

    const cycles = findAllCycles(graph);

    expect(cycles).toHaveLength(0);
  });

  it('should find single cycle', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]);

    const cycles = findAllCycles(graph);

    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0].length).toBe(3);
  });

  it('should find all cycles in graph with multiple cycles', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['a']],
      ['x', ['y']],
      ['y', ['x']],
    ]);

    const cycles = findAllCycles(graph);

    expect(cycles.length).toBe(2);
  });

  it('should detect self-loops', () => {
    const graph = new Map([
      ['a', ['a']],
    ]);

    const cycles = findAllCycles(graph);

    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe('Break Cycles', () => {
  it('should not modify acyclic graph', () => {
    const graph = new Map([
      ['a', []],
      ['b', ['a']],
      ['c', ['b']],
    ]);

    const result = breakCycles(graph);

    expect(result.removedEdges).toHaveLength(0);
    expect(result.dag.size).toBe(3);
  });

  it('should remove edges to break cycles', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]);

    const result = breakCycles(graph);

    expect(result.removedEdges.length).toBeGreaterThan(0);

    // Resulting graph should be acyclic
    const cycles = findAllCycles(result.dag);
    expect(cycles).toHaveLength(0);
  });

  it('should record removed edges', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);

    const result = breakCycles(graph);

    expect(result.removedEdges).toHaveLength(1);
    expect(result.removedEdges[0]).toHaveProperty('from');
    expect(result.removedEdges[0]).toHaveProperty('to');
    expect(result.removedEdges[0]).toHaveProperty('cycle');
  });

  it('should break multiple cycles', () => {
    const graph = new Map([
      ['a', ['b']],
      ['b', ['a']],
      ['x', ['y']],
      ['y', ['x']],
    ]);

    const result = breakCycles(graph);

    expect(result.removedEdges.length).toBeGreaterThanOrEqual(2);

    const cycles = findAllCycles(result.dag);
    expect(cycles).toHaveLength(0);
  });
});

describe('Critical Path Analysis', () => {
  const mockGetTime = (name) => {
    const times = {
      'Pylon': 25,
      'Gateway': 46,
      'Zealot': 38,
      'Cybernetics Core': 36,
      'Stalker': 30,
    };
    return times[name] || 0;
  };

  it('should find critical path in simple tree', () => {
    const tree = {
      name: 'Zealot',
      children: [
        {
          name: 'Gateway',
          children: [
            { name: 'Pylon', children: [] }
          ]
        }
      ]
    };

    const result = findCriticalPath(tree, mockGetTime);

    expect(result.path).toContain('Zealot');
    expect(result.path).toContain('Gateway');
    expect(result.path).toContain('Pylon');
    expect(result.totalTime).toBe(25 + 46 + 38); // 109
  });

  it('should find longest path through multiple branches', () => {
    const tree = {
      name: 'Root',
      children: [
        {
          name: 'Gateway',
          children: [{ name: 'Pylon', children: [] }]
        },
        {
          name: 'Stalker',
          children: [
            {
              name: 'Cybernetics Core',
              children: [{ name: 'Gateway', children: [] }]
            }
          ]
        }
      ]
    };

    const result = findCriticalPath(tree, mockGetTime);

    // Should find the longer path through Stalker
    expect(result.path).toContain('Stalker');
    expect(result.totalTime).toBeGreaterThan(0);
  });

  it('should handle leaf nodes', () => {
    const tree = {
      name: 'Pylon',
      children: []
    };

    const result = findCriticalPath(tree, mockGetTime);

    expect(result.path).toEqual(['Pylon']);
    expect(result.totalTime).toBe(25);
  });
});

describe('Get All Paths', () => {
  it('should return single path for linear tree', () => {
    const tree = {
      name: 'A',
      children: [
        {
          name: 'B',
          children: [
            { name: 'C', children: [] }
          ]
        }
      ]
    };

    const paths = getAllPaths(tree);

    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(['A', 'B', 'C']);
  });

  it('should return multiple paths for branching tree', () => {
    const tree = {
      name: 'Root',
      children: [
        { name: 'A', children: [] },
        { name: 'B', children: [] },
        { name: 'C', children: [] }
      ]
    };

    const paths = getAllPaths(tree);

    expect(paths).toHaveLength(3);
    expect(paths).toContainEqual(['Root', 'A']);
    expect(paths).toContainEqual(['Root', 'B']);
    expect(paths).toContainEqual(['Root', 'C']);
  });

  it('should handle nested branching', () => {
    const tree = {
      name: 'Root',
      children: [
        {
          name: 'A',
          children: [
            { name: 'A1', children: [] },
            { name: 'A2', children: [] }
          ]
        },
        {
          name: 'B',
          children: [
            { name: 'B1', children: [] }
          ]
        }
      ]
    };

    const paths = getAllPaths(tree);

    expect(paths).toHaveLength(3);
    expect(paths).toContainEqual(['Root', 'A', 'A1']);
    expect(paths).toContainEqual(['Root', 'A', 'A2']);
    expect(paths).toContainEqual(['Root', 'B', 'B1']);
  });

  it('should return single path for leaf node', () => {
    const tree = {
      name: 'Leaf',
      children: []
    };

    const paths = getAllPaths(tree);

    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual(['Leaf']);
  });
});
