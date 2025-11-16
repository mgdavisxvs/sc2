/**
 * Tests for Data Importer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataImporter, ImportError } from '../../data/data-importer.js';

describe('DataImporter', () => {
  let importer;

  beforeEach(async () => {
    importer = new DataImporter();
    await importer.init();
  });

  afterEach(async () => {
    await importer.clearData();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(importer).toBeDefined();
      expect(importer.cache).toBeDefined();
      expect(importer.importHistory).toEqual([]);
    });

    it('should load import history if available', async () => {
      const mockHistory = [
        { source: 'test', timestamp: Date.now(), success: true }
      ];
      await importer.cache.set('import-history', mockHistory, Infinity);

      const newImporter = new DataImporter();
      await newImporter.init();

      expect(newImporter.importHistory).toEqual(mockHistory);
    });
  });

  describe('importFromFile', () => {
    it('should import valid JSON file', async () => {
      const validData = {
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

      const file = new File(
        [JSON.stringify(validData)],
        'test.json',
        { type: 'application/json' }
      );

      const result = await importer.importFromFile(file);

      expect(result.success).toBe(true);
      expect(result.stats.totals.units).toBe(1);
      expect(result.source).toBe('file');
    });

    it('should reject invalid JSON', async () => {
      const file = new File(
        ['{ invalid json }'],
        'invalid.json',
        { type: 'application/json' }
      );

      await expect(importer.importFromFile(file)).rejects.toThrow(ImportError);
    });

    it('should reject file with validation errors', async () => {
      const invalidData = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              // Missing required cost field
              supply: { required: 2 },
              time: 38
            }
          }
        }
      };

      const file = new File(
        [JSON.stringify(invalidData)],
        'invalid.json',
        { type: 'application/json' }
      );

      await expect(importer.importFromFile(file)).rejects.toThrow(ImportError);
    });
  });

  describe('importFromURL', () => {
    it('should import from valid URL', async () => {
      const validData = {
        protoss: {
          units: {
            stalker: {
              name: 'Stalker',
              cost: { mineral: 125, gas: 50 },
              supply: { required: 2 },
              time: 42,
              tech_tree: { requires: ['Gateway', 'Cybernetics Core'] }
            }
          }
        }
      };

      // Mock fetch
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(validData)
        })
      );

      const result = await importer.importFromURL('https://example.com/data.json');

      expect(result.success).toBe(true);
      expect(result.stats.totals.units).toBe(1);
      expect(result.source).toBe('url');
    });

    it('should handle HTTP errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })
      );

      await expect(
        importer.importFromURL('https://example.com/missing.json')
      ).rejects.toThrow(ImportError);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error'))
      );

      await expect(
        importer.importFromURL('https://example.com/data.json')
      ).rejects.toThrow(ImportError);
    });
  });

  describe('importData', () => {
    it('should import and validate data', async () => {
      const data = {
        protoss: {
          units: {
            probe: {
              name: 'Probe',
              cost: { mineral: 50, gas: 0 },
              supply: { required: 1 },
              time: 17,
              tech_tree: { requires: ['Nexus'] }
            }
          }
        }
      };

      const result = await importer.importData(data, 'test');

      expect(result.success).toBe(true);
      expect(result.source).toBe('test');
      expect(result.stats.totals.units).toBe(1);
    });

    it('should merge with existing data', async () => {
      const data1 = {
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

      const data2 = {
        protoss: {
          units: {
            stalker: {
              name: 'Stalker',
              cost: { mineral: 125, gas: 50 },
              supply: { required: 2 },
              time: 42,
              tech_tree: { requires: ['Gateway', 'Cybernetics Core'] }
            }
          }
        }
      };

      await importer.importData(data1, 'test1');
      await importer.importData(data2, 'test2');

      const exported = await importer.exportData();

      expect(Object.keys(exported.protoss.units)).toHaveLength(2);
      expect(exported.protoss.units.zealot).toBeDefined();
      expect(exported.protoss.units.stalker).toBeDefined();
    });

    it('should overwrite existing entities', async () => {
      const data1 = {
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

      const data2 = {
        protoss: {
          units: {
            zealot: {
              name: 'Zealot',
              cost: { mineral: 150, gas: 0 }, // Updated cost
              supply: { required: 2 },
              time: 38,
              tech_tree: { requires: ['Gateway'] }
            }
          }
        }
      };

      await importer.importData(data1, 'test1');
      await importer.importData(data2, 'test2');

      const exported = await importer.exportData();

      expect(exported.protoss.units.zealot.cost.mineral).toBe(150);
    });
  });

  describe('mergeGameData', () => {
    it('should merge data from multiple races', () => {
      const existing = {
        protoss: {
          units: { zealot: { name: 'Zealot' } }
        }
      };

      const newData = {
        terran: {
          units: { marine: { name: 'Marine' } }
        }
      };

      const merged = importer.mergeGameData(existing, newData);

      expect(merged.protoss).toBeDefined();
      expect(merged.terran).toBeDefined();
      expect(merged.protoss.units.zealot).toBeDefined();
      expect(merged.terran.units.marine).toBeDefined();
    });

    it('should merge data within same race', () => {
      const existing = {
        protoss: {
          units: { zealot: { name: 'Zealot' } }
        }
      };

      const newData = {
        protoss: {
          units: { stalker: { name: 'Stalker' } },
          buildings: { gateway: { name: 'Gateway' } }
        }
      };

      const merged = importer.mergeGameData(existing, newData);

      expect(merged.protoss.units.zealot).toBeDefined();
      expect(merged.protoss.units.stalker).toBeDefined();
      expect(merged.protoss.buildings.gateway).toBeDefined();
    });
  });

  describe('exportData', () => {
    it('should export current data', async () => {
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

      await importer.importData(data, 'test');
      const exported = await importer.exportData();

      expect(exported).toEqual(expect.objectContaining({
        protoss: expect.objectContaining({
          units: expect.objectContaining({
            zealot: expect.objectContaining({
              name: 'Zealot'
            })
          })
        })
      }));
    });

    it('should return empty object when no data', async () => {
      const exported = await importer.exportData();
      expect(exported).toEqual({});
    });
  });

  describe('import history', () => {
    it('should add imports to history', async () => {
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

      await importer.importData(data, 'test');

      const history = importer.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].source).toBe('test');
      expect(history[0].success).toBe(true);
      expect(history[0].stats.totals.units).toBe(1);
    });

    it('should limit history to 50 entries', async () => {
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

      // Import 60 times
      for (let i = 0; i < 60; i++) {
        await importer.importData(data, `test-${i}`);
      }

      const history = importer.getHistory();
      expect(history).toHaveLength(50);
      expect(history[0].source).toBe('test-59'); // Most recent
    });
  });

  describe('event handling', () => {
    it('should emit import-success event', async () => {
      const mockCallback = vi.fn();
      importer.on('import-success', mockCallback);

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

      await importer.importData(data, 'test');

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          source: 'test'
        })
      );
    });

    it('should allow unsubscribing from events', async () => {
      const mockCallback = vi.fn();
      const unsubscribe = importer.on('import-success', mockCallback);

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

      await importer.importData(data, 'test1');
      expect(mockCallback).toHaveBeenCalledTimes(1);

      unsubscribe();

      await importer.importData(data, 'test2');
      expect(mockCallback).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('clearData', () => {
    it('should clear all data', async () => {
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

      await importer.importData(data, 'test');

      let exported = await importer.exportData();
      expect(Object.keys(exported)).toHaveLength(1);

      await importer.clearData();

      exported = await importer.exportData();
      expect(exported).toEqual({});
    });
  });
});
