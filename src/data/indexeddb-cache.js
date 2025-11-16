/**
 * IndexedDB Cache for Game Data
 * Provides persistent caching of game data and build orders
 */

const DB_NAME = 'sc2-build-lab';
const DB_VERSION = 1;

const STORES = {
  GAME_DATA: 'gameData',
  BUILDS: 'builds',
  SETTINGS: 'settings',
  CACHE: 'cache',
};

/**
 * IndexedDB Cache Manager
 */
export class IndexedDBCache {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize database
   */
  async init() {
    if (this.initialized && this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Game data store
        if (!db.objectStoreNames.contains(STORES.GAME_DATA)) {
          const gameDataStore = db.createObjectStore(STORES.GAME_DATA, {
            keyPath: 'id',
          });
          gameDataStore.createIndex('version', 'version', { unique: false });
          gameDataStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Builds store
        if (!db.objectStoreNames.contains(STORES.BUILDS)) {
          const buildsStore = db.createObjectStore(STORES.BUILDS, {
            keyPath: 'id',
          });
          buildsStore.createIndex('race', 'race', { unique: false });
          buildsStore.createIndex('name', 'name', { unique: false });
          buildsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        // Generic cache store
        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          const cacheStore = db.createObjectStore(STORES.CACHE, {
            keyPath: 'key',
          });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
          cacheStore.createIndex('ttl', 'ttl', { unique: false });
        }
      };
    });
  }

  /**
   * Store game data
   */
  async setGameData(data, version = '1.0') {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.GAME_DATA], 'readwrite');
      const store = transaction.objectStore(STORES.GAME_DATA);

      const gameData = {
        id: 'current',
        version,
        data,
        timestamp: Date.now(),
      };

      const request = store.put(gameData);

      request.onsuccess = () => resolve(gameData);
      request.onerror = () => reject(new Error('Failed to store game data'));
    });
  }

  /**
   * Get game data
   */
  async getGameData() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.GAME_DATA], 'readonly');
      const store = transaction.objectStore(STORES.GAME_DATA);
      const request = store.get('current');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };

      request.onerror = () => reject(new Error('Failed to get game data'));
    });
  }

  /**
   * Store build
   */
  async saveBuild(build) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.BUILDS], 'readwrite');
      const store = transaction.objectStore(STORES.BUILDS);

      const buildData = {
        ...build,
        timestamp: build.timestamp || Date.now(),
      };

      const request = store.put(buildData);

      request.onsuccess = () => resolve(buildData);
      request.onerror = () => reject(new Error('Failed to save build'));
    });
  }

  /**
   * Get all builds
   */
  async getAllBuilds() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.BUILDS], 'readonly');
      const store = transaction.objectStore(STORES.BUILDS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get builds'));
    });
  }

  /**
   * Get builds by race
   */
  async getBuildsByRace(race) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.BUILDS], 'readonly');
      const store = transaction.objectStore(STORES.BUILDS);
      const index = store.index('race');
      const request = index.getAll(race);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get builds by race'));
    });
  }

  /**
   * Delete build
   */
  async deleteBuild(buildId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.BUILDS], 'readwrite');
      const store = transaction.objectStore(STORES.BUILDS);
      const request = store.delete(buildId);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Failed to delete build'));
    });
  }

  /**
   * Set cache value with TTL
   */
  async setCache(key, value, ttlSeconds = 3600) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.CACHE], 'readwrite');
      const store = transaction.objectStore(STORES.CACHE);

      const cacheEntry = {
        key,
        value,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000,
        expiresAt: Date.now() + ttlSeconds * 1000,
      };

      const request = store.put(cacheEntry);

      request.onsuccess = () => resolve(cacheEntry);
      request.onerror = () => reject(new Error('Failed to set cache'));
    });
  }

  /**
   * Get cache value (respects TTL)
   */
  async getCache(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.CACHE], 'readonly');
      const store = transaction.objectStore(STORES.CACHE);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;

        if (!result) {
          resolve(null);
          return;
        }

        // Check if expired
        if (Date.now() > result.expiresAt) {
          // Expired - delete it
          this.deleteCache(key);
          resolve(null);
          return;
        }

        resolve(result.value);
      };

      request.onerror = () => reject(new Error('Failed to get cache'));
    });
  }

  /**
   * Delete cache entry
   */
  async deleteCache(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.CACHE], 'readwrite');
      const store = transaction.objectStore(STORES.CACHE);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error('Failed to delete cache'));
    });
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.CACHE], 'readwrite');
      const store = transaction.objectStore(STORES.CACHE);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result || [];
        const now = Date.now();

        const deletePromises = entries
          .filter((entry) => now > entry.expiresAt)
          .map((entry) => this.deleteCache(entry.key));

        Promise.all(deletePromises)
          .then(() => resolve(deletePromises.length))
          .catch(reject);
      };

      request.onerror = () => reject(new Error('Failed to clear expired cache'));
    });
  }

  /**
   * Get setting
   */
  async getSetting(key) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };

      request.onerror = () => reject(new Error('Failed to get setting'));
    });
  }

  /**
   * Set setting
   */
  async setSetting(key, value) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);

      const setting = { key, value, timestamp: Date.now() };
      const request = store.put(setting);

      request.onsuccess = () => resolve(setting);
      request.onerror = () => reject(new Error('Failed to set setting'));
    });
  }

  /**
   * Clear all data
   */
  async clearAll() {
    await this.init();

    const clearPromises = Object.values(STORES).map((storeName) => {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
      });
    });

    return Promise.all(clearPromises);
  }

  /**
   * Get database stats
   */
  async getStats() {
    await this.init();

    const stats = {};

    for (const storeName of Object.values(STORES)) {
      const count = await new Promise((resolve) => {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });

      stats[storeName] = { count };
    }

    return stats;
  }

  /**
   * Export all data
   */
  async exportData() {
    await this.init();

    const data = {};

    for (const storeName of Object.values(STORES)) {
      const storeData = await new Promise((resolve) => {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
      });

      data[storeName] = storeData;
    }

    return data;
  }

  /**
   * Import data
   */
  async importData(data) {
    await this.init();

    for (const [storeName, items] of Object.entries(data)) {
      if (!Object.values(STORES).includes(storeName)) {
        continue;
      }

      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        items.forEach((item) => {
          store.put(item);
        });

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(new Error(`Failed to import ${storeName}`));
      });
    }

    return true;
  }

  /**
   * Close database
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
let cacheInstance = null;

/**
 * Get cache instance
 */
export function getCache() {
  if (!cacheInstance) {
    cacheInstance = new IndexedDBCache();
  }
  return cacheInstance;
}

/**
 * Quick access functions
 */
export async function cacheGameData(data, version) {
  const cache = getCache();
  return cache.setGameData(data, version);
}

export async function getCachedGameData() {
  const cache = getCache();
  return cache.getGameData();
}

export async function cacheBuild(build) {
  const cache = getCache();
  return cache.saveBuild(build);
}

export async function getCachedBuilds(race = null) {
  const cache = getCache();
  return race ? cache.getBuildsByRace(race) : cache.getAllBuilds();
}
