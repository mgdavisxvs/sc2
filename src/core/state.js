/**
 * Application State Management
 * Centralized state with reactive updates
 */

import { BrokenImageTracker } from '../utils/image.js';

/**
 * Application state
 */
class AppState {
  constructor() {
    this.data = null;          // raw JSON
    this.norm = null;          // normalized structure
    this.race = 'protoss';
    this.section = 'units';
    this.search = '';
    this.sortKey = '';
    this.imageRoot = '';
    this.build = [];           // current build order
    this.idMap = new Map();    // name -> card element
    this.brokenImages = new BrokenImageTracker();

    // Listeners for state changes
    this._listeners = new Map();
  }

  /**
   * Subscribe to state changes
   * @param {string} key - State key to watch
   * @param {Function} callback - Function to call on change
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);

    // Return unsubscribe function to prevent memory leaks
    return () => {
      const listeners = this._listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
        // Clean up empty listener sets
        if (listeners.size === 0) {
          this._listeners.delete(key);
        }
      }
    };
  }

  /**
   * Notify listeners of state change
   * @param {string} key - State key that changed
   * @param {*} value - New value
   */
  _notify(key, value) {
    const listeners = this._listeners.get(key);
    if (listeners) {
      listeners.forEach(fn => fn(value));
    }
  }

  /**
   * Set state value and notify listeners
   * @param {string} key - State key
   * @param {*} value - New value
   */
  set(key, value) {
    const oldValue = this[key];
    this[key] = value;
    if (oldValue !== value) {
      this._notify(key, value);
    }
  }

  /**
   * Reset state to initial values
   */
  reset() {
    this.build = [];
    this.search = '';
    this.sortKey = '';
    this.idMap.clear();
    this.brokenImages.clear();
  }

  /**
   * Add item to build order
   * @param {Object} item - Entity to add
   * @param {boolean} locked - Whether item is locked (missing prereqs)
   * @param {Array} missing - Missing prerequisites
   */
  addToBuild(item, locked = false, missing = []) {
    // INVARIANT: locked items must have non-empty missing array
    console.assert(
      !locked || (missing && missing.length > 0),
      'Locked items must have missing prerequisites'
    );

    // INVARIANT: costs must be non-negative
    console.assert(
      Number.isFinite(item.mineral) && item.mineral >= 0,
      'Mineral cost must be non-negative'
    );

    this.build.push({
      name: item.name,
      kind: item.kind,
      mineral: item.mineral ?? 0,
      gas: item.gas ?? 0,
      supply: item.supply ?? 0,
      buildtime: item.buildtime ?? 0,
      image: item.image,
      locked: !!locked,
      missing: missing || [],
    });

    this._notify('build', this.build);
  }

  /**
   * Remove item from build order by index
   * @param {number} index - Index to remove
   */
  removeFromBuild(index) {
    if (index >= 0 && index < this.build.length) {
      this.build.splice(index, 1);
      this._notify('build', this.build);
    }
  }

  /**
   * Clear entire build order
   */
  clearBuild() {
    this.build = [];
    this._notify('build', this.build);
  }

  /**
   * Reorder build items (drag and drop)
   * @param {number} fromIndex - Source index
   * @param {number} toIndex - Target index
   */
  reorderBuild(fromIndex, toIndex) {
    if (fromIndex !== toIndex &&
        fromIndex >= 0 && fromIndex < this.build.length &&
        toIndex >= 0 && toIndex < this.build.length) {
      const [item] = this.build.splice(fromIndex, 1);
      this.build.splice(toIndex, 0, item);
      this._notify('build', this.build);
    }
  }

  /**
   * Get total costs of current build
   * @returns {Object} { mineral, gas, supply }
   */
  getBuildTotals() {
    return this.build.reduce((acc, item) => ({
      mineral: acc.mineral + (item.mineral || 0),
      gas: acc.gas + (item.gas || 0),
      supply: acc.supply + (item.supply || 0),
    }), { mineral: 0, gas: 0, supply: 0 });
  }

  /**
   * Get locked (invalid) build items
   * @returns {Array}
   */
  getLockedItems() {
    return this.build.filter(b => b.locked);
  }
}

// Singleton instance
export const state = new AppState();
