/**
 * Image Utilities
 * Handles image paths, fallbacks, and error tracking
 */

// SVG fallback images for each race
export const FALLBACK_IMAGES = {
  protoss: 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22256%22 height=%22256%22><rect width=%22256%22 height=%22256%22 rx=%2224%22 fill=%22%232563eb%22/><circle cx=%22128%22 cy=%22128%22 r=%2276%22 fill=%22white%22 opacity=%220.2%22/><path d=%22M128 56c36 0 64 28 64 64s-28 64-64 64-64-28-64-64 28-64 64-64zm0 26c-21 0-38 17-38 38s17 38 38 38 38-17 38-38-17-38-38-38z%22 fill=%22white%22 opacity=%220.75%22/></svg>',
  terran:  'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22256%22 height=%22256%22><rect width=%22256%22 height=%22256%22 rx=%2224%22 fill=%22%23ef4444%22/><circle cx=%22128%22 cy=%22128%22 r=%2276%22 fill=%22white%22 opacity=%220.2%22/><path d=%22M128 56c36 0 64 28 64 64s-28 64-64 64-64-28-64-64 28-64 64-64zm0 26c-21 0-38 17-38 38s17 38 38 38 38-17 38-38-17-38-38-38z%22 fill=%22white%22 opacity=%220.75%22/></svg>',
  zerg:    'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22256%22 height=%22256%22><rect width=%22256%22 height=%22256%22 rx=%2224%22 fill=%22%236d28d9%22/><circle cx=%22128%22 cy=%22128%22 r=%2276%22 fill=%22white%22 opacity=%220.2%22/><path d=%22M128 56c36 0 64 28 64 64s-28 64-64 64-64-28-64-64 28-64 64-64zm0 26c-21 0-38 17-38 38s17 38 38 38 38-17 38-38-17-38-38-38z%22 fill=%22white%22 opacity=%220.75%22/></svg>',
  neutral: 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22256%22 height=%22256%22><rect width=%22256%22 height=%22256%22 rx=%2224%22 fill=%22%23334155%22/></svg>',
};

/**
 * Join path segments with proper encoding
 * @param {string} prefix - Path prefix
 * @param {string} path - Relative path
 * @returns {string} Joined and encoded path
 */
export function joinPath(prefix, path) {
  const a = (prefix || '').replace(/\\/g, '/').replace(/\/+$/, '');
  let b = (path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const joined = a ? `${a}/${b}` : b;
  return joined
    .split('/')
    .map(seg => {
      if (!seg) return seg;
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join('/');
}

/**
 * Get image URL or fallback
 * @param {Object} item - Entity with image property
 * @param {string} race - Race name for fallback
 * @param {string} imageRoot - Root path for images
 * @returns {string} Image URL
 */
export function imageOrFallback(item, race, imageRoot = '') {
  const src = item?.image || '';
  if (!src) return FALLBACK_IMAGES[race] || FALLBACK_IMAGES.neutral;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return src;
  return joinPath(imageRoot, src);
}

/**
 * Try alternate image extension (jpg <-> png)
 * @param {HTMLImageElement} imgEl - Image element
 * @param {string} origSrc - Original source URL
 * @param {string} race - Race for fallback
 * @param {Function} onBroken - Callback when image is broken
 * @returns {boolean} True if alternate was attempted
 */
export function tryAlternateExt(imgEl, origSrc, race, onBroken) {
  const i = origSrc.lastIndexOf('.');
  if (i <= 0) return false;
  const base = origSrc.slice(0, i);
  const ext  = origSrc.slice(i + 1).toLowerCase();
  const alt =
    ext === 'jpg' || ext === 'jpeg'
      ? `${base}.png`
      : ext === 'png'
      ? `${base}.jpg`
      : null;
  if (!alt) return false;
  const test = new Image();
  test.onload = () => { imgEl.src = alt; };
  test.onerror = () => {
    imgEl.src = FALLBACK_IMAGES[race] || FALLBACK_IMAGES.neutral;
    if (onBroken) onBroken(alt);
  };
  test.src = alt;
  return true;
}

/**
 * Broken image tracker
 */
export class BrokenImageTracker {
  constructor() {
    this.broken = new Set();
  }

  add(src) {
    this.broken.add(src);
  }

  has(src) {
    return this.broken.has(src);
  }

  clear() {
    this.broken.clear();
  }

  get size() {
    return this.broken.size;
  }

  toArray() {
    return [...this.broken];
  }

  toString() {
    return this.toArray().join('\n') || 'No broken images logged.';
  }
}
