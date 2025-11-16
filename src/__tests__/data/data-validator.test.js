/**
 * Tests for Data Validator
 */

import { describe, it, expect } from 'vitest';
import {
  validateGameData,
  validatePartialData,
  sanitizeGameData,
  getDataStatistics,
  ValidationError
} from '../../data/data-validator.js';

describe('DataValidator', () => {
  describe('validateGameData', () => {
    it('should validate correct data', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: 100, gas: 0 },
              supply: { required: 2 },
              time: 38,
              tech_tree: { requires: ['Gateway'] }
            }
          }
        }
      };

      const result = validateGameData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject data without races', () => {
      const data = {};

      const result = validateGameData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Data must contain at least one race (protoss, terran, or zerg)');
    });

    it('should reject entity without name', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              // Missing name
              cost: { mineral: 100, gas: 0 },
              supply: { required: 2 },
              time: 38
            }
          }
        }
      };

      const result = validateGameData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('should reject entity without cost', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              // Missing cost
              supply: { required: 2 },
              time: 38
            }
          }
        }
      };

      const result = validateGameData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('cost'))).toBe(true);
    });

    it('should reject unit without supply', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: 100, gas: 0 },
              // Missing supply
              time: 38
            }
          }
        }
      };

      const result = validateGameData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('supply'))).toBe(true);
    });

    it('should reject negative costs', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: -100, gas: 0 },
              supply: { required: 2 },
              time: 38
            }
          }
        }
      };

      const result = validateGameData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-negative'))).toBe(true);
    });

    it('should reject invalid tech tree requirements', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: 100, gas: 0 },
              supply: { required: 2 },
              time: 38,
              tech_tree: { requires: ['Gateway', 123, ''] } // Invalid: number and empty string
            }
          }
        }
      };

      const result = validateGameData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-empty string'))).toBe(true);
    });

    it('should validate multiple races', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: 100, gas: 0 },
              supply: { required: 2 },
              time: 38
            }
          }
        },
        terran: {
          units: {
            marine: {
              name: 'Marine',
              cost: { mineral: 50, gas: 0 },
              supply: { required: 1 },
              time: 25
            }
          }
        },
        zerg: {
          units: {
            zergling: {
              name: 'Zergling',
              cost: { mineral: 50, gas: 0 },
              supply: { required: 0.5 },
              time: 24
            }
          }
        }
      };

      const result = validateGameData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate buildings with supply provided', () => {
      const data = {
        protoss: {
          buildings: {
            pylon: {
              name: 'Pylon',
              cost: { mineral: 100, gas: 0 },
              time: 25,
              supply: { provided: 8 }
            }
          }
        }
      };

      const result = validateGameData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate upgrades', () => {
      const data = {
        protoss: {
          upgrades: {
            charge: {
              name: 'Charge',
              cost: { mineral: 100, gas: 100 },
              tech_tree: { requires: ['Twilight Council'] }
            }
          }
        }
      };

      const result = validateGameData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validatePartialData', () => {
    it('should validate single entity', () => {
      const data = {
        name: 'Zealot',
        cost: { mineral: 100, gas: 0 },
        supply: { required: 2 },
        time: 38
      };

      const result = validatePartialData(data, 'protoss.units.zealot');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate entity collection', () => {
      const data = {
        zealot: {
          name: 'Zealot',
          cost: { mineral: 100, gas: 0 },
          supply: { required: 2 },
          time: 38
        },
        stalker: {
          name: 'Stalker',
          cost: { mineral: 125, gas: 50 },
          supply: { required: 2 },
          time: 42
        }
      };

      const result = validatePartialData(data, 'protoss.units');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate entire race', () => {
      const data = {
        units: {
          zealot: {
            name: 'Zealot',
            cost: { mineral: 100, gas: 0 },
            supply: { required: 2 },
            time: 38
          }
        },
        buildings: {
          gateway: {
            name: 'Gateway',
            cost: { mineral: 150, gas: 0 },
            time: 65
          }
        }
      };

      const result = validatePartialData(data, 'protoss');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid race name', () => {
      const data = { name: 'Test' };
      const result = validatePartialData(data, 'invalid.units.test');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid race'))).toBe(true);
    });

    it('should reject invalid entity type', () => {
      const data = { name: 'Test' };
      const result = validatePartialData(data, 'protoss.invalid.test');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid entity type'))).toBe(true);
    });
  });

  describe('sanitizeGameData', () => {
    it('should sanitize valid data', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: 100, gas: 0 },
              supply: { required: 2 },
              time: 38
            }
          }
        }
      };

      const sanitized = sanitizeGameData(data);
      expect(sanitized.protoss.units.zealot.name).toBe('Zealot');
      expect(sanitized.protoss.units.zealot.cost.mineral).toBe(100);
    });

    it('should remove invalid fields', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: 100, gas: 0 },
              supply: { required: 2 },
              time: 38,
              invalidField: 'should be removed'
            }
          }
        }
      };

      const sanitized = sanitizeGameData(data);
      expect(sanitized.protoss.units.zealot.invalidField).toBeUndefined();
    });

    it('should convert numeric strings to numbers', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: '100', gas: '0' },
              supply: { required: '2' },
              time: '38'
            }
          }
        }
      };

      const sanitized = sanitizeGameData(data);
      expect(typeof sanitized.protoss.units.zealot.cost.mineral).toBe('number');
      expect(sanitized.protoss.units.zealot.cost.mineral).toBe(100);
    });

    it('should trim whitespace from strings', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: '  Zealot  ',
              cost: { mineral: 100, gas: 0 },
              supply: { required: 2 },
              time: 38,
              tech_tree: { requires: ['  Gateway  ', 'Cybernetics Core  '] }
            }
          }
        }
      };

      const sanitized = sanitizeGameData(data);
      expect(sanitized.protoss.units.zealot.name).toBe('Zealot');
      expect(sanitized.protoss.units.zealot.tech_tree.requires[0]).toBe('Gateway');
    });

    it('should ensure non-negative costs', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: -100, gas: -50 },
              supply: { required: 2 },
              time: 38
            }
          }
        }
      };

      const sanitized = sanitizeGameData(data);
      expect(sanitized.protoss.units.zealot.cost.mineral).toBe(0);
      expect(sanitized.protoss.units.zealot.cost.gas).toBe(0);
    });

    it('should filter out empty tech requirements', () => {
      const data = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: 100, gas: 0 },
              supply: { required: 2 },
              time: 38,
              tech_tree: { requires: ['Gateway', '', '  ', 'Cybernetics Core'] }
            }
          }
        }
      };

      const sanitized = sanitizeGameData(data);
      expect(sanitized.protoss.units.zealot.tech_tree.requires).toHaveLength(2);
      expect(sanitized.protoss.units.zealot.tech_tree.requires).toEqual([
        'Gateway',
        'Cybernetics Core'
      ]);
    });

    it('should handle null/undefined data', () => {
      expect(sanitizeGameData(null)).toEqual({});
      expect(sanitizeGameData(undefined)).toEqual({});
    });
  });

  describe('getDataStatistics', () => {
    it('should calculate statistics for single race', () => {
      const data = {
        protoss: {
          units: {
            zealot: { name: 'Zealot' },
            stalker: { name: 'Stalker' }
          },
          buildings: {
            gateway: { name: 'Gateway' }
          },
          upgrades: {
            charge: { name: 'Charge' }
          }
        }
      };

      const stats = getDataStatistics(data);

      expect(stats.races.protoss.units).toBe(2);
      expect(stats.races.protoss.buildings).toBe(1);
      expect(stats.races.protoss.upgrades).toBe(1);
      expect(stats.totals.units).toBe(2);
      expect(stats.totals.buildings).toBe(1);
      expect(stats.totals.upgrades).toBe(1);
    });

    it('should calculate statistics for multiple races', () => {
      const data = {
        protoss: {
          units: {
            zealot: { name: 'Zealot' },
            stalker: { name: 'Stalker' }
          }
        },
        terran: {
          units: {
            marine: { name: 'Marine' },
            marauder: { name: 'Marauder' },
            reaper: { name: 'Reaper' }
          }
        },
        zerg: {
          units: {
            zergling: { name: 'Zergling' }
          }
        }
      };

      const stats = getDataStatistics(data);

      expect(stats.totals.units).toBe(6);
      expect(stats.races.protoss.units).toBe(2);
      expect(stats.races.terran.units).toBe(3);
      expect(stats.races.zerg.units).toBe(1);
    });

    it('should handle empty data', () => {
      const stats = getDataStatistics({});

      expect(stats.totals.units).toBe(0);
      expect(stats.totals.buildings).toBe(0);
      expect(stats.totals.upgrades).toBe(0);
    });

    it('should handle partial data', () => {
      const data = {
        protoss: {
          units: {
            zealot: { name: 'Zealot' }
          }
          // No buildings or upgrades
        }
      };

      const stats = getDataStatistics(data);

      expect(stats.races.protoss.units).toBe(1);
      expect(stats.races.protoss.buildings).toBe(0);
      expect(stats.races.protoss.upgrades).toBe(0);
    });

    it('should handle null/undefined data', () => {
      const stats1 = getDataStatistics(null);
      const stats2 = getDataStatistics(undefined);

      expect(stats1.totals.units).toBe(0);
      expect(stats2.totals.units).toBe(0);
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with message', () => {
      const error = new ValidationError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ValidationError');
      expect(error.errors).toEqual([]);
    });

    it('should create ValidationError with errors array', () => {
      const errors = ['Error 1', 'Error 2'];
      const error = new ValidationError('Test error', errors);

      expect(error.message).toBe('Test error');
      expect(error.errors).toEqual(errors);
    });
  });
});
