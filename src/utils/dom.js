/**
 * DOM Utilities
 * Simple helpers for DOM manipulation
 */

/**
 * Query selector shorthand
 * @param {string} sel - CSS selector
 * @param {Element|Document} el - Element to query from (default: document)
 * @returns {Element|null}
 */
export const $ = (sel, el = document) => el.querySelector(sel);

/**
 * Query selector all shorthand
 * @param {string} sel - CSS selector
 * @param {Element|Document} el - Element to query from (default: document)
 * @returns {Element[]}
 */
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/**
 * Create a comparator function for sorting by a key
 * @param {string} k - Key to sort by
 * @returns {Function} Comparator function
 */
export const by = (k) => (a, b) => ((a[k] ?? 1e12) - (b[k] ?? 1e12));

/**
 * Normalize string for comparison (lowercase, trimmed)
 * @param {string} s - String to normalize
 * @returns {string}
 */
export const norm = (s) => (s || '').toLowerCase().trim();

/**
 * Debounce function calls
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(fn, ms) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Capitalize first letter of each word
 * @param {string} s - String to capitalize
 * @returns {string}
 */
export const capWords = (s) =>
  (s || '')
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

/**
 * Convert to array if not already
 * @param {*} x - Value to convert
 * @returns {Array}
 */
export const toArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
