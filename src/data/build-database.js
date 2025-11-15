/**
 * Build Order Database
 * IndexedDB-based persistent storage for build orders
 */

import { logger } from '../core/logger.js';

const DB_NAME = 'SC2BuildLab';
const DB_VERSION = 1;
const STORE_NAME = 'builds';

/**
 * Build order database schema
 */
export class BuildDatabase {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info('Build database initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create builds store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: false,
          });

          // Create indexes for efficient querying
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('race', 'race', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('favorited', 'favorited', { unique: false });

          logger.info('Build store created with indexes');
        }
      };
    });
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save a build order
   * @param {Object} buildData - Build order data
   * @param {Object} metadata - Build metadata
   * @returns {Promise<Object>} Saved build
   */
  async saveBuild(buildData, metadata = {}) {
    if (!this.db) await this.init();

    const now = Date.now();
    const build = {
      id: metadata.id || this.generateId(),
      name: metadata.name || 'Untitled Build',
      description: metadata.description || '',
      race: metadata.race || 'protoss',
      tags: metadata.tags || [],
      buildOrder: buildData,
      version: metadata.version || 1,
      createdAt: metadata.createdAt || now,
      updatedAt: now,
      favorited: metadata.favorited || false,
      stats: metadata.stats || this.calculateStats(buildData),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(build);

      request.onsuccess = () => {
        logger.info('Build saved:', build.name);
        resolve(build);
      };

      request.onerror = () => {
        logger.error('Failed to save build:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get build by ID
   * @param {string} id - Build ID
   * @returns {Promise<Object|null>} Build or null
   */
  async getBuild(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        logger.error('Failed to get build:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all builds
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of builds
   */
  async getAllBuilds(options = {}) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let builds = request.result || [];

        // Apply filters
        if (options.race) {
          builds = builds.filter((b) => b.race === options.race);
        }

        if (options.tags && options.tags.length > 0) {
          builds = builds.filter((b) =>
            options.tags.some((tag) => b.tags.includes(tag))
          );
        }

        if (options.favorited) {
          builds = builds.filter((b) => b.favorited);
        }

        if (options.search) {
          const query = options.search.toLowerCase();
          builds = builds.filter(
            (b) =>
              b.name.toLowerCase().includes(query) ||
              b.description.toLowerCase().includes(query) ||
              b.tags.some((tag) => tag.toLowerCase().includes(query))
          );
        }

        // Sort
        const sortBy = options.sortBy || 'updatedAt';
        const sortOrder = options.sortOrder || 'desc';

        builds.sort((a, b) => {
          let aVal = a[sortBy];
          let bVal = b[sortBy];

          if (sortBy === 'name') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
          }

          if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
          }
        });

        // Pagination
        if (options.limit) {
          const offset = options.offset || 0;
          builds = builds.slice(offset, offset + options.limit);
        }

        resolve(builds);
      };

      request.onerror = () => {
        logger.error('Failed to get builds:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update build
   * @param {string} id - Build ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated build
   */
  async updateBuild(id, updates) {
    const build = await this.getBuild(id);

    if (!build) {
      throw new Error(`Build not found: ${id}`);
    }

    const updatedBuild = {
      ...build,
      ...updates,
      id: build.id, // Preserve ID
      createdAt: build.createdAt, // Preserve creation date
      updatedAt: Date.now(),
    };

    return this.saveBuild(updatedBuild.buildOrder, updatedBuild);
  }

  /**
   * Delete build
   * @param {string} id - Build ID
   * @returns {Promise<void>}
   */
  async deleteBuild(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        logger.info('Build deleted:', id);
        resolve();
      };

      request.onerror = () => {
        logger.error('Failed to delete build:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Toggle favorite status
   * @param {string} id - Build ID
   * @returns {Promise<Object>} Updated build
   */
  async toggleFavorite(id) {
    const build = await this.getBuild(id);

    if (!build) {
      throw new Error(`Build not found: ${id}`);
    }

    return this.updateBuild(id, { favorited: !build.favorited });
  }

  /**
   * Get all unique tags
   * @returns {Promise<Array<string>>} Array of tags
   */
  async getAllTags() {
    const builds = await this.getAllBuilds();
    const tagsSet = new Set();

    builds.forEach((build) => {
      build.tags.forEach((tag) => tagsSet.add(tag));
    });

    return Array.from(tagsSet).sort();
  }

  /**
   * Calculate build statistics
   * @param {Array} buildOrder - Build order array
   * @returns {Object} Statistics
   */
  calculateStats(buildOrder) {
    const stats = {
      totalSteps: buildOrder.length,
      units: 0,
      buildings: 0,
      upgrades: 0,
      totalMinerals: 0,
      totalGas: 0,
      totalSupply: 0,
      avgBuildTime: 0,
    };

    let totalBuildTime = 0;

    buildOrder.forEach((item) => {
      if (item.kind === 'unit') stats.units++;
      else if (item.kind === 'building') stats.buildings++;
      else if (item.kind === 'upgrade') stats.upgrades++;

      stats.totalMinerals += item.mineral || 0;
      stats.totalGas += item.gas || 0;
      stats.totalSupply += item.supply || 0;
      totalBuildTime += item.buildtime || 0;
    });

    if (buildOrder.length > 0) {
      stats.avgBuildTime = totalBuildTime / buildOrder.length;
    }

    return stats;
  }

  /**
   * Export build as JSON
   * @param {string} id - Build ID
   * @returns {Promise<Object>} Build data
   */
  async exportBuild(id) {
    const build = await this.getBuild(id);

    if (!build) {
      throw new Error(`Build not found: ${id}`);
    }

    return {
      version: '2.0',
      exportedAt: Date.now(),
      build,
    };
  }

  /**
   * Import build from JSON
   * @param {Object} data - Exported build data
   * @returns {Promise<Object>} Imported build
   */
  async importBuild(data) {
    if (!data.build) {
      throw new Error('Invalid import data: missing build');
    }

    const build = data.build;

    // Generate new ID to avoid conflicts
    const importedBuild = {
      ...build,
      id: this.generateId(),
      name: `${build.name} (imported)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return this.saveBuild(importedBuild.buildOrder, importedBuild);
  }

  /**
   * Create backup of all builds
   * @returns {Promise<Object>} Backup data
   */
  async createBackup() {
    const builds = await this.getAllBuilds();

    return {
      version: '2.0',
      backupDate: Date.now(),
      buildCount: builds.length,
      builds,
    };
  }

  /**
   * Restore from backup
   * @param {Object} backup - Backup data
   * @param {boolean} merge - Merge with existing or replace
   * @returns {Promise<number>} Number of builds restored
   */
  async restoreBackup(backup, merge = true) {
    if (!backup.builds || !Array.isArray(backup.builds)) {
      throw new Error('Invalid backup data');
    }

    // Clear existing if not merging
    if (!merge) {
      const existing = await this.getAllBuilds();
      for (const build of existing) {
        await this.deleteBuild(build.id);
      }
    }

    // Import all builds
    let imported = 0;
    for (const build of backup.builds) {
      try {
        // Generate new ID if merging to avoid conflicts
        const buildData = {
          ...build,
          id: merge ? this.generateId() : build.id,
        };

        await this.saveBuild(buildData.buildOrder, buildData);
        imported++;
      } catch (err) {
        logger.error('Failed to import build:', build.name, err);
      }
    }

    logger.info(`Restored ${imported}/${backup.builds.length} builds`);
    return imported;
  }

  /**
   * Clear all builds (dangerous!)
   * @returns {Promise<number>} Number of builds deleted
   */
  async clearAll() {
    const builds = await this.getAllBuilds();
    let deleted = 0;

    for (const build of builds) {
      await this.deleteBuild(build.id);
      deleted++;
    }

    logger.warn(`Cleared ${deleted} builds from database`);
    return deleted;
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} Database stats
   */
  async getStats() {
    const builds = await this.getAllBuilds();
    const tags = await this.getAllTags();

    const raceCount = {
      protoss: 0,
      terran: 0,
      zerg: 0,
    };

    builds.forEach((build) => {
      if (build.race in raceCount) {
        raceCount[build.race]++;
      }
    });

    return {
      totalBuilds: builds.length,
      favoriteBuilds: builds.filter((b) => b.favorited).length,
      totalTags: tags.length,
      raceCount,
      oldestBuild: builds.length > 0 ? Math.min(...builds.map((b) => b.createdAt)) : null,
      newestBuild: builds.length > 0 ? Math.max(...builds.map((b) => b.updatedAt)) : null,
    };
  }
}

// Singleton instance
let dbInstance = null;

/**
 * Get database instance
 * @returns {BuildDatabase}
 */
export function getBuildDatabase() {
  if (!dbInstance) {
    dbInstance = new BuildDatabase();
  }
  return dbInstance;
}

export default BuildDatabase;
