/**
 * Data Normalizer
 * Transforms raw SC2 JSON into consistent normalized structure
 * Implements Wolfram's universal normalization pattern
 */

import { ENTITY_SCHEMAS } from '../core/config.js';
import { capWords, toArr } from '../utils/dom.js';

/**
 * Normalize entities of a specific type
 * @param {Object} raw - Raw data object
 * @param {string} kind - Entity kind (unit/building/upgrade)
 * @param {Array} races - List of races to process
 * @returns {Object} Normalized entities by race
 */
export function normalizeEntities(raw, kind, races) {
  const schema = ENTITY_SCHEMAS[kind];
  if (!schema) {
    throw new Error(`Unknown entity kind: ${kind}`);
  }

  const result = {};

  for (const race of races) {
    const raceObj = raw[kind]?.[race] || {};
    result[race] = {};

    for (const [name, obj] of Object.entries(raceObj)) {
      // Build normalized entity using schema
      const normalized = {
        id: obj.no ?? name,
        name: capWords(name),
        race,
        kind,
        tech_tree: {
          requires: toArr(obj.required),
          unlocks: [],
        },
        image: obj.image ?? null,
      };

      // Apply schema transformations
      for (const [key, fn] of Object.entries(schema)) {
        normalized[key] = fn(obj, race, name);
      }

      result[race][name] = Object.freeze(normalized);
    }
  }

  return result;
}

/**
 * Normalize complete SC2 dataset
 * @param {Object} raw - Raw SC2 JSON data
 * @returns {Object} Normalized structure
 */
export function normalizeData(raw) {
  const races = ['protoss', 'terran', 'zerg'];

  const normalized = {
    units: normalizeEntities(raw, 'unit', races),
    buildings: normalizeEntities(raw, 'building', races),
    upgrades: normalizeEntities(raw, 'upgrade', races),
  };

  // Build reverse tech tree (unlocks)
  buildUnlocksTree(normalized);

  return Object.freeze(normalized);
}

/**
 * Build reverse tech tree (what each entity unlocks)
 * @param {Object} normalized - Normalized data structure
 */
function buildUnlocksTree(normalized) {
  const races = ['protoss', 'terran', 'zerg'];

  for (const race of races) {
    const allEntities = [
      ...Object.values(normalized.units[race] || {}),
      ...Object.values(normalized.buildings[race] || {}),
      ...Object.values(normalized.upgrades[race] || {}),
    ];

    for (const entity of allEntities) {
      for (const req of entity.tech_tree.requires) {
        // Find the required entity
        const reqEntity = allEntities.find(e =>
          e.name.toLowerCase() === req.toLowerCase()
        );
        if (reqEntity) {
          reqEntity.tech_tree.unlocks.push(entity.name);
        }
      }
    }
  }
}

/**
 * Create ACTION_CONFIG for future optimizer
 * (Knuth's preparatory data structure)
 * @param {Object} normalized - Normalized data
 * @returns {Object} Action configuration by race
 */
export function createActionConfig(normalized) {
  const races = ['protoss', 'terran', 'zerg'];
  const config = {};

  for (const race of races) {
    config[race] = {};

    // Units
    for (const [name, unit] of Object.entries(normalized.units[race] || {})) {
      const key = name.replace(/ /g, '_');
      config[race][key] = {
        minerals: unit.cost.mineral,
        gas: unit.cost.gas,
        supply: unit.supply.required,
        time: unit.time,
        type: 'unit',
        requires: (unit.tech_tree.requires[0] || '')?.replace(/ /g, '_') || undefined,
        produces: unit.producer?.replace(/ /g, '_'),
      };
    }

    // Buildings
    for (const [name, building] of Object.entries(normalized.buildings[race] || {})) {
      const key = name.replace(/ /g, '_');
      config[race][key] = {
        minerals: building.cost.mineral,
        gas: building.cost.gas,
        supply_provided: building.supply.provided,
        time: building.time,
        type: 'building',
        requires: (building.tech_tree.requires[0] || '')?.replace(/ /g, '_') || undefined,
      };
    }

    // Upgrades
    for (const [name, upgrade] of Object.entries(normalized.upgrades[race] || {})) {
      const key = name.replace(/ /g, '_');
      config[race][key] = {
        minerals: upgrade.cost.mineral,
        gas: upgrade.cost.gas,
        time: upgrade.time,
        type: 'upgrade',
        requires: (upgrade.tech_tree.requires[0] || '')?.replace(/ /g, '_') || undefined,
        researched_at: upgrade.researchedAt?.replace(/ /g, '_'),
      };
    }
  }

  return config;
}
