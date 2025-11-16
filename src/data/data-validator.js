/**
 * Data Validator for SC2 Game Data
 *
 * Validates imported SC2 data against the expected schema.
 * Ensures data integrity before importing into IndexedDB.
 */

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Schema validators
 */
const validators = {
  /**
   * Validate cost object
   */
  cost: (cost, path = '') => {
    const errors = [];

    if (typeof cost !== 'object' || cost === null) {
      errors.push(`${path}.cost must be an object`);
      return errors;
    }

    if (typeof cost.mineral !== 'number' || cost.mineral < 0) {
      errors.push(`${path}.cost.mineral must be a non-negative number`);
    }

    if (typeof cost.gas !== 'number' || cost.gas < 0) {
      errors.push(`${path}.cost.gas must be a non-negative number`);
    }

    return errors;
  },

  /**
   * Validate supply object
   */
  supply: (supply, path = '') => {
    const errors = [];

    if (typeof supply !== 'object' || supply === null) {
      errors.push(`${path}.supply must be an object`);
      return errors;
    }

    if ('required' in supply && (typeof supply.required !== 'number' || supply.required < 0)) {
      errors.push(`${path}.supply.required must be a non-negative number`);
    }

    if ('provided' in supply && (typeof supply.provided !== 'number' || supply.provided < 0)) {
      errors.push(`${path}.supply.provided must be a non-negative number`);
    }

    return errors;
  },

  /**
   * Validate tech tree requirements
   */
  techTree: (techTree, path = '') => {
    const errors = [];

    if (typeof techTree !== 'object' || techTree === null) {
      errors.push(`${path}.tech_tree must be an object`);
      return errors;
    }

    if ('requires' in techTree) {
      if (!Array.isArray(techTree.requires)) {
        errors.push(`${path}.tech_tree.requires must be an array`);
      } else {
        techTree.requires.forEach((req, idx) => {
          if (typeof req !== 'string' || req.trim() === '') {
            errors.push(`${path}.tech_tree.requires[${idx}] must be a non-empty string`);
          }
        });
      }
    }

    return errors;
  },

  /**
   * Validate unit/building/upgrade object
   */
  entity: (entity, entityType, path = '') => {
    const errors = [];

    if (typeof entity !== 'object' || entity === null) {
      errors.push(`${path} must be an object`);
      return errors;
    }

    // Validate name
    if (typeof entity.name !== 'string' || entity.name.trim() === '') {
      errors.push(`${path}.name must be a non-empty string`);
    }

    // Validate cost (required for all entities)
    if ('cost' in entity) {
      errors.push(...validators.cost(entity.cost, path));
    } else {
      errors.push(`${path}.cost is required`);
    }

    // Validate build time (required for units and buildings)
    if (entityType === 'units' || entityType === 'buildings') {
      if (typeof entity.time !== 'number' || entity.time <= 0) {
        errors.push(`${path}.time must be a positive number`);
      }
    }

    // Validate supply (required for units)
    if (entityType === 'units') {
      if ('supply' in entity) {
        errors.push(...validators.supply(entity.supply, path));
      } else {
        errors.push(`${path}.supply is required for units`);
      }
    }

    // Validate supply provided (for buildings that provide supply)
    if (entityType === 'buildings' && 'supply' in entity) {
      errors.push(...validators.supply(entity.supply, path));
    }

    // Validate tech tree
    if ('tech_tree' in entity) {
      errors.push(...validators.techTree(entity.tech_tree, path));
    }

    return errors;
  },

  /**
   * Validate race data
   */
  race: (raceData, raceName) => {
    const errors = [];

    if (typeof raceData !== 'object' || raceData === null) {
      errors.push(`${raceName} must be an object`);
      return errors;
    }

    // Validate each entity type
    ['units', 'buildings', 'upgrades'].forEach(entityType => {
      if (entityType in raceData) {
        const entities = raceData[entityType];

        if (typeof entities !== 'object' || entities === null) {
          errors.push(`${raceName}.${entityType} must be an object`);
          return;
        }

        // Validate each entity
        Object.entries(entities).forEach(([key, entity]) => {
          const path = `${raceName}.${entityType}.${key}`;
          errors.push(...validators.entity(entity, entityType, path));
        });
      }
    });

    return errors;
  }
};

/**
 * Validate complete SC2 game data
 *
 * @param {Object} data - The game data to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validateGameData(data) {
  const errors = [];

  if (typeof data !== 'object' || data === null) {
    throw new ValidationError('Game data must be an object', ['Root data must be an object']);
  }

  // Validate each race
  const validRaces = ['protoss', 'terran', 'zerg'];
  validRaces.forEach(race => {
    if (race in data) {
      errors.push(...validators.race(data[race], race));
    }
  });

  // Check if at least one race has data
  const hasData = validRaces.some(race => race in data);
  if (!hasData) {
    errors.push('Data must contain at least one race (protoss, terran, or zerg)');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate partial data (for incremental updates)
 *
 * @param {Object} partialData - Partial data to validate
 * @param {string} path - Path in the data structure (e.g., "protoss.units.zealot")
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validatePartialData(partialData, path) {
  const errors = [];
  const parts = path.split('.');

  if (parts.length === 0) {
    return validateGameData(partialData);
  }

  // Parse path to determine what we're validating
  const [race, entityType, entityKey] = parts;

  if (!['protoss', 'terran', 'zerg'].includes(race)) {
    errors.push(`Invalid race: ${race}`);
  }

  if (!['units', 'buildings', 'upgrades'].includes(entityType)) {
    errors.push(`Invalid entity type: ${entityType}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate the entity
  if (entityKey) {
    errors.push(...validators.entity(partialData, entityType, path));
  } else if (entityType) {
    // Validating a collection of entities
    Object.entries(partialData).forEach(([key, entity]) => {
      errors.push(...validators.entity(entity, entityType, `${path}.${key}`));
    });
  } else if (race) {
    // Validating entire race
    errors.push(...validators.race(partialData, race));
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Sanitize and normalize game data
 *
 * @param {Object} data - Raw data to sanitize
 * @returns {Object} - Sanitized data
 */
export function sanitizeGameData(data) {
  if (typeof data !== 'object' || data === null) {
    return {};
  }

  const sanitized = {};
  const validRaces = ['protoss', 'terran', 'zerg'];

  validRaces.forEach(race => {
    if (race in data && typeof data[race] === 'object') {
      sanitized[race] = {};

      ['units', 'buildings', 'upgrades'].forEach(entityType => {
        if (entityType in data[race] && typeof data[race][entityType] === 'object') {
          sanitized[race][entityType] = {};

          Object.entries(data[race][entityType]).forEach(([key, entity]) => {
            if (typeof entity === 'object' && entity !== null) {
              sanitized[race][entityType][key] = {
                name: String(entity.name || '').trim(),
                cost: {
                  mineral: Math.max(0, Number(entity.cost?.mineral) || 0),
                  gas: Math.max(0, Number(entity.cost?.gas) || 0)
                }
              };

              // Add time if present
              if ('time' in entity) {
                sanitized[race][entityType][key].time = Math.max(0, Number(entity.time) || 0);
              }

              // Add supply if present
              if ('supply' in entity && typeof entity.supply === 'object') {
                sanitized[race][entityType][key].supply = {};
                if ('required' in entity.supply) {
                  sanitized[race][entityType][key].supply.required = Math.max(0, Number(entity.supply.required) || 0);
                }
                if ('provided' in entity.supply) {
                  sanitized[race][entityType][key].supply.provided = Math.max(0, Number(entity.supply.provided) || 0);
                }
              }

              // Add tech tree if present
              if ('tech_tree' in entity && typeof entity.tech_tree === 'object') {
                sanitized[race][entityType][key].tech_tree = {};
                if (Array.isArray(entity.tech_tree.requires)) {
                  sanitized[race][entityType][key].tech_tree.requires =
                    entity.tech_tree.requires
                      .filter(req => typeof req === 'string' && req.trim() !== '')
                      .map(req => req.trim());
                }
              }
            }
          });
        }
      });
    }
  });

  return sanitized;
}

/**
 * Get validation statistics for game data
 *
 * @param {Object} data - Game data
 * @returns {Object} - Statistics object
 */
export function getDataStatistics(data) {
  const stats = {
    races: {},
    totals: {
      units: 0,
      buildings: 0,
      upgrades: 0
    }
  };

  if (typeof data !== 'object' || data === null) {
    return stats;
  }

  ['protoss', 'terran', 'zerg'].forEach(race => {
    if (race in data && typeof data[race] === 'object') {
      stats.races[race] = {
        units: Object.keys(data[race].units || {}).length,
        buildings: Object.keys(data[race].buildings || {}).length,
        upgrades: Object.keys(data[race].upgrades || {}).length
      };

      stats.totals.units += stats.races[race].units;
      stats.totals.buildings += stats.races[race].buildings;
      stats.totals.upgrades += stats.races[race].upgrades;
    }
  });

  return stats;
}
