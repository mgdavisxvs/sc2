/**
 * Data Importer for SC2 Game Data
 *
 * Handles importing data from multiple sources:
 * 1. Liquipedia web scraping
 * 2. Community APIs (SC2ReplayStats, Rankedftw)
 * 3. Manual JSON file upload
 * 4. Balance patch updates
 * 5. Direct data entry
 */

import { validateGameData, sanitizeGameData, getDataStatistics } from './data-validator.js';
import { IndexedDBCache } from './indexeddb-cache.js';
import { enhancedLogger } from '../core/enhanced-logger.js';
import { ERROR_CODES } from '../core/error-codes.js';

/**
 * Data import error class
 */
export class ImportError extends Error {
  constructor(message, source = 'unknown', details = null) {
    super(message);
    this.name = 'ImportError';
    this.source = source;
    this.details = details;
  }
}

/**
 * Data Importer class
 */
export class DataImporter {
  constructor() {
    this.cache = new IndexedDBCache();
    this.importHistory = [];
    this.listeners = new Map();
  }

  /**
   * Initialize the importer
   */
  async init() {
    await this.cache.init();
    await this.loadImportHistory();
  }

  /**
   * Load import history from cache
   */
  async loadImportHistory() {
    try {
      const history = await this.cache.get('import-history');
      if (history) {
        this.importHistory = history;
      }
    } catch (error) {
      enhancedLogger.warn('Failed to load import history', { error: error.message });
    }
  }

  /**
   * Save import history to cache
   */
  async saveImportHistory() {
    try {
      await this.cache.set('import-history', this.importHistory, Infinity);
    } catch (error) {
      enhancedLogger.error('Failed to save import history', error, { code: ERROR_CODES.DATA_IMP_HISTORY_ERROR });
    }
  }

  /**
   * Add import to history
   */
  async addToHistory(source, result) {
    const entry = {
      source,
      timestamp: Date.now(),
      stats: result.stats,
      version: result.version || 'unknown',
      success: result.success
    };

    this.importHistory.unshift(entry);

    // Keep only last 50 imports
    if (this.importHistory.length > 50) {
      this.importHistory = this.importHistory.slice(0, 50);
    }

    await this.saveImportHistory();
    this.emit('history-updated', this.importHistory);
  }

  /**
   * Import from JSON file
   *
   * @param {File} file - File object from input
   * @returns {Promise<Object>} - Import result
   */
  async importFromFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      return await this.importData(data, 'file', { fileName: file.name });
    } catch (error) {
      throw new ImportError(
        'Failed to import from file',
        'file',
        { error: error.message, fileName: file?.name }
      );
    }
  }

  /**
   * Import from URL (JSON endpoint)
   *
   * @param {string} url - URL to fetch data from
   * @returns {Promise<Object>} - Import result
   */
  async importFromURL(url) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return await this.importData(data, 'url', { url });
    } catch (error) {
      throw new ImportError(
        'Failed to import from URL',
        'url',
        { error: error.message, url }
      );
    }
  }

  /**
   * Import from Liquipedia scraper
   *
   * @param {Array<string>} races - Races to scrape ['protoss', 'terran', 'zerg']
   * @returns {Promise<Object>} - Import result
   */
  async importFromLiquipedia(races = ['protoss', 'terran', 'zerg']) {
    try {
      const data = {};
      const totalRaces = races.length;

      for (let i = 0; i < races.length; i++) {
        const race = races[i];
        const progress = Math.round((i / totalRaces) * 100);

        this.emit('scraping-progress', {
          race,
          status: 'started',
          progress: progress,
          units: 0
        });

        const raceData = await this.scrapeLiquipediaRace(race);
        data[race] = raceData;

        const unitsCount = Object.keys(raceData.units || {}).length;
        const completedProgress = Math.round(((i + 1) / totalRaces) * 100);

        this.emit('scraping-progress', {
          race,
          status: 'completed',
          progress: completedProgress,
          units: unitsCount
        });
      }

      return await this.importData(data, 'liquipedia', { races });
    } catch (error) {
      throw new ImportError(
        'Failed to import from Liquipedia',
        'liquipedia',
        { error: error.message, races }
      );
    }
  }

  /**
   * Scrape single race from Liquipedia
   *
   * @param {string} race - Race to scrape
   * @returns {Promise<Object>} - Race data
   */
  async scrapeLiquipediaRace(race) {
    const raceCapitalized = race.charAt(0).toUpperCase() + race.slice(1);

    // Use CORS proxy for browser-based scraping
    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const targetUrl = `https://liquipedia.net/starcraft2/${raceCapitalized}_Units`;
    const url = proxyUrl + encodeURIComponent(targetUrl);

    const response = await fetch(url);
    const result = await response.json();

    if (!result.contents) {
      throw new Error('Failed to fetch Liquipedia page');
    }

    // Parse HTML (basic parsing in browser)
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.contents, 'text/html');

    // Extract unit data from tables
    const units = {};
    const tables = doc.querySelectorAll('table.wikitable');

    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
          const name = cells[0]?.textContent?.trim();
          const mineralText = cells[1]?.textContent?.trim();
          const gasText = cells[2]?.textContent?.trim();
          const timeText = cells[3]?.textContent?.trim();

          if (name && mineralText && gasText && timeText) {
            const key = name.toLowerCase().replace(/\s+/g, '');
            units[key] = {
              name: name,
              cost: {
                mineral: parseInt(mineralText) || 0,
                gas: parseInt(gasText) || 0
              },
              time: parseInt(timeText) || 0
            };
          }
        }
      });
    });

    return { units };
  }

  /**
   * Import from community APIs
   *
   * @param {string} apiName - API name ('sc2replaystats' or 'rankedftw')
   * @returns {Promise<Object>} - Import result
   */
  async importFromCommunityAPI(apiName) {
    try {
      let data;

      switch (apiName) {
        case 'sc2replaystats':
          data = await this.fetchSC2ReplayStats();
          break;
        case 'rankedftw':
          data = await this.fetchRankedFTW();
          break;
        default:
          throw new Error(`Unknown API: ${apiName}`);
      }

      return await this.importData(data, `api-${apiName}`, { apiName });
    } catch (error) {
      throw new ImportError(
        `Failed to import from ${apiName}`,
        `api-${apiName}`,
        { error: error.message, apiName }
      );
    }
  }

  /**
   * Fetch data from SC2ReplayStats
   * Note: This is a placeholder - actual API requires authentication
   */
  async fetchSC2ReplayStats() {
    // SC2ReplayStats doesn't have a public unit data API
    // This would need to use their replay analysis API
    throw new Error('SC2ReplayStats API requires authentication and replay data');
  }

  /**
   * Fetch data from Rankedftw
   * Note: This is a placeholder - they don't expose unit data API
   */
  async fetchRankedFTW() {
    // Rankedftw focuses on ladder statistics, not unit data
    throw new Error('Rankedftw does not provide unit data API');
  }

  /**
   * Import balance patch data
   *
   * @param {string} patchVersion - Patch version (e.g., "5.0.11")
   * @returns {Promise<Object>} - Import result
   */
  async importBalancePatch(patchVersion) {
    try {
      // Fetch patch notes from Liquipedia or Blizzard
      const patchData = await this.fetchBalancePatchData(patchVersion);

      return await this.importData(patchData, 'balance-patch', { patchVersion });
    } catch (error) {
      throw new ImportError(
        `Failed to import balance patch ${patchVersion}`,
        'balance-patch',
        { error: error.message, patchVersion }
      );
    }
  }

  /**
   * Fetch balance patch data
   *
   * @param {string} patchVersion - Patch version
   * @returns {Promise<Object>} - Patch data
   */
  async fetchBalancePatchData(patchVersion) {
    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const targetUrl = `https://liquipedia.net/starcraft2/Patch_${patchVersion}`;
    const url = proxyUrl + encodeURIComponent(targetUrl);

    const response = await fetch(url);
    const result = await response.json();

    if (!result.contents) {
      throw new Error('Failed to fetch balance patch data');
    }

    // Parse patch notes and extract changes
    // This is a simplified version - real implementation would need
    // sophisticated parsing of patch note format
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.contents, 'text/html');

    // Extract data from patch notes
    // Returns partial updates that will be merged with existing data
    return {
      metadata: {
        version: patchVersion,
        timestamp: Date.now()
      }
      // Actual unit changes would be extracted from patch notes
    };
  }

  /**
   * Import raw data object
   *
   * @param {Object} data - Raw data to import
   * @param {string} source - Source identifier
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Import result
   */
  async importData(data, source = 'unknown', metadata = {}) {
    try {
      // Store backup before importing (for undo)
      const existingData = await this.cache.getGameData() || {};
      await this.storeBackup(existingData);

      // Sanitize data
      const sanitized = sanitizeGameData(data);

      // Validate data
      const validation = validateGameData(sanitized);

      if (!validation.valid) {
        throw new ImportError(
          'Data validation failed',
          source,
          { errors: validation.errors, metadata }
        );
      }

      // Get statistics
      const stats = getDataStatistics(sanitized);

      // Merge with existing data
      const mergedData = this.mergeGameData(existingData.data || {}, sanitized);

      // Save to cache
      const version = metadata.patchVersion || metadata.version || new Date().toISOString();
      await this.cache.setGameData(mergedData, version);

      // Create result
      const result = {
        success: true,
        source,
        stats,
        version,
        metadata,
        validationErrors: []
      };

      // Add to history
      await this.addToHistory(source, result);

      // Emit success event
      this.emit('import-success', result);

      return result;
    } catch (error) {
      const result = {
        success: false,
        source,
        error: error.message,
        details: error.details,
        metadata
      };

      await this.addToHistory(source, result);
      this.emit('import-error', result);

      throw error;
    }
  }

  /**
   * Merge game data (new data takes precedence)
   *
   * @param {Object} existing - Existing data
   * @param {Object} newData - New data to merge
   * @returns {Object} - Merged data
   */
  mergeGameData(existing, newData) {
    const merged = { ...existing };

    ['protoss', 'terran', 'zerg'].forEach(race => {
      if (newData[race]) {
        if (!merged[race]) {
          merged[race] = {};
        }

        ['units', 'buildings', 'upgrades'].forEach(entityType => {
          if (newData[race][entityType]) {
            if (!merged[race][entityType]) {
              merged[race][entityType] = {};
            }

            // Merge entities (new data overwrites existing)
            merged[race][entityType] = {
              ...merged[race][entityType],
              ...newData[race][entityType]
            };
          }
        });
      }
    });

    return merged;
  }

  /**
   * Export current game data
   *
   * @returns {Promise<Object>} - Current game data
   */
  async exportData() {
    const cached = await this.cache.getGameData();
    return cached?.data || {};
  }

  /**
   * Export data as JSON file download
   */
  async exportAsFile(filename = 'sc2units.json') {
    const data = await this.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Clear all imported data
   */
  async clearData() {
    await this.cache.setGameData({}, '0.0.0');
    this.emit('data-cleared');
  }

  /**
   * Store backup of data for undo functionality
   * Keeps last 3 backups
   */
  async storeBackup(data) {
    try {
      const backups = await this.cache.get('data-backups') || [];

      backups.unshift({
        data: data.data,
        version: data.version,
        timestamp: Date.now()
      });

      // Keep only last 3 backups
      if (backups.length > 3) {
        backups.length = 3;
      }

      await this.cache.set('data-backups', backups, Infinity);
    } catch (error) {
      enhancedLogger.error('Failed to store backup', error, { code: ERROR_CODES.DATA_IMP_BACKUP_FAILED });
    }
  }

  /**
   * Undo last import by restoring previous backup
   */
  async undoLastImport() {
    try {
      const backups = await this.cache.get('data-backups') || [];

      if (backups.length === 0) {
        throw new Error('No backups available');
      }

      const backup = backups[0];
      await this.cache.setGameData(backup.data, backup.version);

      // Remove used backup
      backups.shift();
      await this.cache.set('data-backups', backups, Infinity);

      this.emit('data-restored', backup);

      return {
        success: true,
        timestamp: backup.timestamp,
        version: backup.version
      };
    } catch (error) {
      throw new ImportError(
        'Failed to undo import',
        'undo',
        { error: error.message }
      );
    }
  }

  /**
   * Get all entities from current data
   *
   * @returns {Promise<Array>} - Array of entities with metadata
   */
  async getAllEntities() {
    const data = await this.exportData();
    const entities = [];

    ['protoss', 'terran', 'zerg'].forEach(race => {
      if (!data[race]) return;

      ['units', 'buildings', 'upgrades'].forEach(entityType => {
        if (!data[race][entityType]) return;

        Object.entries(data[race][entityType]).forEach(([key, entity]) => {
          entities.push({
            key,
            race,
            entityType,
            data: entity,
            name: entity.name || key
          });
        });
      });
    });

    return entities;
  }

  /**
   * Search entities by name or key
   *
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Matching entities
   */
  async searchEntities(query) {
    const allEntities = await this.getAllEntities();
    const lowerQuery = query.toLowerCase();

    return allEntities.filter(entity => {
      return entity.key.toLowerCase().includes(lowerQuery) ||
             entity.name.toLowerCase().includes(lowerQuery);
    });
  }

  /**
   * Update an existing entity
   *
   * @param {string} race - Race (protoss, terran, zerg)
   * @param {string} entityType - Entity type (units, buildings, upgrades)
   * @param {string} key - Entity key
   * @param {Object} entityData - Updated entity data
   * @returns {Promise<Object>} - Update result
   */
  async updateEntity(race, entityType, key, entityData) {
    try {
      const cached = await this.cache.getGameData();
      const data = cached?.data || {};

      // Store backup before updating
      await this.storeBackup(cached);

      // Ensure structure exists
      if (!data[race]) data[race] = {};
      if (!data[race][entityType]) data[race][entityType] = {};

      // Validate the entity data
      const tempData = {
        [race]: {
          [entityType]: {
            [key]: entityData
          }
        }
      };

      const validation = validateGameData(tempData);
      if (!validation.valid) {
        throw new ImportError(
          'Entity validation failed',
          'update',
          { errors: validation.errors }
        );
      }

      // Update entity
      data[race][entityType][key] = entityData;

      // Save to cache
      await this.cache.setGameData(data, cached?.version || 'unknown');

      // Add to history
      const result = {
        success: true,
        source: 'update',
        stats: { updated: 1 },
        version: cached?.version
      };
      await this.addToHistory('update', result);

      this.emit('entity-updated', { race, entityType, key, data: entityData });

      return result;
    } catch (error) {
      throw new ImportError(
        `Failed to update entity ${key}`,
        'update',
        { error: error.message, race, entityType, key }
      );
    }
  }

  /**
   * Delete an entity
   *
   * @param {string} race - Race (protoss, terran, zerg)
   * @param {string} entityType - Entity type (units, buildings, upgrades)
   * @param {string} key - Entity key
   * @returns {Promise<Object>} - Delete result
   */
  async deleteEntity(race, entityType, key) {
    try {
      const cached = await this.cache.getGameData();
      const data = cached?.data || {};

      // Store backup before deleting
      await this.storeBackup(cached);

      // Check if entity exists
      if (!data[race]?.[entityType]?.[key]) {
        throw new Error('Entity not found');
      }

      // Delete entity
      delete data[race][entityType][key];

      // Clean up empty objects
      if (Object.keys(data[race][entityType]).length === 0) {
        delete data[race][entityType];
      }
      if (Object.keys(data[race]).length === 0) {
        delete data[race];
      }

      // Save to cache
      await this.cache.setGameData(data, cached?.version || 'unknown');

      // Add to history
      const result = {
        success: true,
        source: 'delete',
        stats: { deleted: 1 },
        version: cached?.version
      };
      await this.addToHistory('delete', result);

      this.emit('entity-deleted', { race, entityType, key });

      return result;
    } catch (error) {
      throw new ImportError(
        `Failed to delete entity ${key}`,
        'delete',
        { error: error.message, race, entityType, key }
      );
    }
  }

  /**
   * Bulk delete multiple entities
   *
   * @param {Array} entities - Array of {race, entityType, key}
   * @returns {Promise<Object>} - Delete result
   */
  async bulkDeleteEntities(entities) {
    try {
      const cached = await this.cache.getGameData();
      const data = cached?.data || {};

      // Store backup before deleting
      await this.storeBackup(cached);

      let deletedCount = 0;
      const errors = [];

      entities.forEach(({ race, entityType, key }) => {
        if (data[race]?.[entityType]?.[key]) {
          delete data[race][entityType][key];
          deletedCount++;

          // Clean up empty objects
          if (Object.keys(data[race][entityType]).length === 0) {
            delete data[race][entityType];
          }
          if (Object.keys(data[race]).length === 0) {
            delete data[race];
          }
        } else {
          errors.push(`Entity not found: ${race}.${entityType}.${key}`);
        }
      });

      // Save to cache
      await this.cache.setGameData(data, cached?.version || 'unknown');

      // Add to history
      const result = {
        success: true,
        source: 'bulk-delete',
        stats: { deleted: deletedCount },
        errors: errors.length > 0 ? errors : undefined,
        version: cached?.version
      };
      await this.addToHistory('bulk-delete', result);

      this.emit('entities-bulk-deleted', { count: deletedCount, errors });

      return result;
    } catch (error) {
      throw new ImportError(
        'Failed to bulk delete entities',
        'bulk-delete',
        { error: error.message }
      );
    }
  }

  /**
   * Duplicate an entity (clone)
   *
   * @param {string} race - Race
   * @param {string} entityType - Entity type
   * @param {string} sourceKey - Source entity key
   * @param {string} newKey - New entity key
   * @param {string} newName - New entity name
   * @returns {Promise<Object>} - Duplicate result
   */
  async duplicateEntity(race, entityType, sourceKey, newKey, newName) {
    try {
      const cached = await this.cache.getGameData();
      const data = cached?.data || {};

      // Store backup before duplicating
      await this.storeBackup(cached);

      // Check if source exists
      if (!data[race]?.[entityType]?.[sourceKey]) {
        throw new Error('Source entity not found');
      }

      // Check if target already exists
      if (data[race]?.[entityType]?.[newKey]) {
        throw new Error('Target entity key already exists');
      }

      // Clone the entity
      const sourceEntity = data[race][entityType][sourceKey];
      const newEntity = JSON.parse(JSON.stringify(sourceEntity));
      newEntity.name = newName;

      // Ensure structure exists
      if (!data[race]) data[race] = {};
      if (!data[race][entityType]) data[race][entityType] = {};

      // Add new entity
      data[race][entityType][newKey] = newEntity;

      // Save to cache
      await this.cache.setGameData(data, cached?.version || 'unknown');

      // Add to history
      const result = {
        success: true,
        source: 'duplicate',
        stats: { added: 1 },
        version: cached?.version
      };
      await this.addToHistory('duplicate', result);

      this.emit('entity-duplicated', { race, entityType, key: newKey, data: newEntity });

      return result;
    } catch (error) {
      throw new ImportError(
        `Failed to duplicate entity ${sourceKey}`,
        'duplicate',
        { error: error.message, race, entityType, sourceKey, newKey }
      );
    }
  }

  /**
   * Filter entities by multiple criteria
   *
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} - Filtered entities
   */
  async filterEntities(filters) {
    const allEntities = await this.getAllEntities();

    return allEntities.filter(entity => {
      // Filter by race
      if (filters.races && filters.races.length > 0) {
        if (!filters.races.includes(entity.race)) return false;
      }

      // Filter by type
      if (filters.types && filters.types.length > 0) {
        if (!filters.types.includes(entity.entityType)) return false;
      }

      // Filter by mineral cost range
      if (filters.mineralMin !== undefined) {
        const mineral = entity.data.cost?.mineral || 0;
        if (mineral < filters.mineralMin) return false;
      }
      if (filters.mineralMax !== undefined) {
        const mineral = entity.data.cost?.mineral || 0;
        if (mineral > filters.mineralMax) return false;
      }

      // Filter by gas cost range
      if (filters.gasMin !== undefined) {
        const gas = entity.data.cost?.gas || 0;
        if (gas < filters.gasMin) return false;
      }
      if (filters.gasMax !== undefined) {
        const gas = entity.data.cost?.gas || 0;
        if (gas > filters.gasMax) return false;
      }

      // Filter by build time range
      if (filters.timeMin !== undefined) {
        const time = entity.data.time || 0;
        if (time < filters.timeMin) return false;
      }
      if (filters.timeMax !== undefined) {
        const time = entity.data.time || 0;
        if (time > filters.timeMax) return false;
      }

      // Filter by name/key search
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchName = entity.name.toLowerCase().includes(query);
        const matchKey = entity.key.toLowerCase().includes(query);
        if (!matchName && !matchKey) return false;
      }

      return true;
    });
  }

  /**
   * Get detailed history entry
   *
   * @param {number} index - History index
   * @returns {Promise<Object>} - Detailed history entry
   */
  async getHistoryDetails(index) {
    const entry = this.importHistory[index];
    if (!entry) {
      throw new Error('History entry not found');
    }

    // Return enhanced entry with detailed stats
    return {
      ...entry,
      detailedStats: entry.stats,
      timestamp: new Date(entry.timestamp).toLocaleString(),
      canUndo: index === 0 // Can only undo the most recent
    };
  }

  /**
   * Get import history
   */
  getHistory() {
    return this.importHistory;
  }

  /**
   * Event subscription
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Emit event
   */
  emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          enhancedLogger.error(`Error in ${event} listener`, error, { event, code: ERROR_CODES.UI_EVENT_HANDLER_ERROR });
        }
      });
    }
  }
}

/**
 * Create global data importer instance
 */
export const dataImporter = new DataImporter();
