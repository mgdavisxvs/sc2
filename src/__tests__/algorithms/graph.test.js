/**
 * Graph Algorithm Tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildDependencyGraph,
  detectCycles,
  topologicalSort,
  buildPrereqTree,
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
