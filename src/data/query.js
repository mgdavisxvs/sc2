/**
 * Data Query Module
 * Implements Knuth's O(1) indexed lookups
 * Replaces O(n) linear searches with hash-based indices
 */

import { norm } from '../utils/dom.js';
import { logger } from '../core/logger.js';

/**
 * Database class with indexed lookups
 */
export class GameDatabase {
  constructor(normalized) {
    this.normalized = normalized;
    this.indices = this._buildIndices(normalized);
    logger.debug('Database indices built:', {
      byName: this.indices.byName.size,
      byRaceKind: this.indices.byRaceKind.size,
    });
  }

  /**
   * Build all indices for O(1) lookups
   * @param {Object} normalized - Normalized data
   * @returns {Object} Index maps
   */
  _buildIndices(normalized) {
    const byName = new Map();           // name -> entity
    const byRaceKind = new Map();       // race:kind -> [entities]
    const byId = new Map();             // id -> entity

    const races = ['protoss', 'terran', 'zerg'];
    const kinds = ['units', 'buildings', 'upgrades'];

    for (const race of races) {
      for (const kind of kinds) {
        const entities = normalized[kind]?.[race] || {};
        const key = `${race}:${kind}`;
        const list = [];

        for (const [name, entity] of Object.entries(entities)) {
          // Index by normalized name
          byName.set(norm(entity.name), entity);

          // Index by ID
          if (entity.id) {
            byId.set(entity.id, entity);
          }

          list.push(entity);
        }

        byRaceKind.set(key, list);
      }
    }

    return { byName, byRaceKind, byId };
  }

  /**
   * Find entity by name (O(1) lookup)
   * @param {string} name - Entity name
   * @returns {Object|null}
   */
  findByName(name) {
    return this.indices.byName.get(norm(name)) || null;
  }

  /**
   * Find entity by ID (O(1) lookup)
   * @param {string|number} id - Entity ID
   * @returns {Object|null}
   */
  findById(id) {
    return this.indices.byId.get(id) || null;
  }

  /**
   * Get all entities for a race and kind (O(1) lookup)
   * @param {string} race - Race name
   * @param {string} kind - Entity kind (units/buildings/upgrades)
   * @returns {Array}
   */
  getByRaceKind(race, kind) {
    const key = `${race}:${kind}`;
    return this.indices.byRaceKind.get(key) || [];
  }

  /**
   * Query entities with filters
   * @param {Object} options - Query options
   * @returns {Array}
   */
  query({ race, kind, costRange, supplyRange, search }) {
    let results = this.getByRaceKind(race, kind);

    // Filter by cost
    if (costRange) {
      results = results.filter(e => {
        const cost = e.cost?.mineral || 0;
        return cost >= (costRange.min || 0) &&
               cost <= (costRange.max || Infinity);
      });
    }

    // Filter by supply
    if (supplyRange) {
      results = results.filter(e => {
        const supply = e.supply?.required || 0;
        return supply >= (supplyRange.min || 0) &&
               supply <= (supplyRange.max || Infinity);
      });
    }

    // Filter by search term
    if (search) {
      const q = norm(search);
      results = results.filter(e => norm(e.name).includes(q));
    }

    return results;
  }

  /**
   * Get all entities as flat array
   * @returns {Array}
   */
  getAllEntities() {
    return [...this.indices.byName.values()];
  }

  /**
   * Get entity prerequisites
   * @param {Object} entity - Entity object
   * @returns {Array} List of required entity names
   */
  getPrerequisites(entity) {
    const req = entity?.tech_tree?.requires || entity?.buildfrom || [];
    return Array.isArray(req) ? req : [req].filter(Boolean);
  }

  /**
   * Get entities that this entity unlocks
   * @param {Object} entity - Entity object
   * @returns {Array} List of unlocked entity names
   */
  getUnlocks(entity) {
    return entity?.tech_tree?.unlocks || [];
  }
}

/**
 * Flatten entities for backward compatibility
 * @param {Object} normalized - Normalized data
 * @param {string} race - Race name
 * @param {string} section - Section (units/buildings/upgrades)
 * @returns {Array} Flat array of entities
 */
export function flattenEntities(normalized, race, section) {
  const entities = normalized[section]?.[race] || {};
  return Object.entries(entities).map(([name, entity]) => ({
    name: entity.name,
    kind: entity.kind,
    mineral: entity.cost?.mineral || 0,
    gas: entity.cost?.gas || 0,
    supply: entity.supply?.required || 0,
    buildtime: entity.time || entity.build_time || 0,
    buildfrom: entity.producer || entity.built_from,
    required: entity.tech_tree?.requires || [],
    image: entity.image || '',
  }));
}
