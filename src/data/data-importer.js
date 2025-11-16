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
      console.warn('Failed to load import history:', error);
    }
  }

  /**
   * Save import history to cache
   */
  async saveImportHistory() {
    try {
      await this.cache.set('import-history', this.importHistory, Infinity);
    } catch (error) {
      console.error('Failed to save import history:', error);
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
      const existingData = await this.cache.getGameData() || {};
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
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }
}

/**
 * Create global data importer instance
 */
export const dataImporter = new DataImporter();
