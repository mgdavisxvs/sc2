/**
 * Data Parser
 * Loads and validates SC2 JSON data
 */

import { logger } from '../core/logger.js';
import { normalizeData, createActionConfig } from './normalizer.js';

/**
 * Validate SC2 data schema
 * @param {Object} raw - Raw JSON data
 * @returns {boolean} True if valid
 */
export function validateSchema(raw) {
  if (!raw || typeof raw !== 'object') {
    logger.error('Root is not an object');
    return false;
  }

  const requiredTop = ['unit', 'building', 'upgrade'];
  const missingTop = requiredTop.filter(k => !(k in raw));

  if (missingTop.length) {
    logger.warn('Top-level sections missing:', missingTop);
  }

  // Validate race structure
  const races = ['protoss', 'terran', 'zerg'];
  for (const section of requiredTop) {
    if (!raw[section]) continue;

    for (const race of races) {
      const raceData = raw[section][race];
      if (raceData && typeof raceData !== 'object') {
        logger.error(`Invalid ${race} ${section} data: not an object`);
        return false;
      }
    }
  }

  return true;
}

/**
 * Process SC2 data: validate, normalize, and create indices
 * @param {Object} raw - Raw JSON data
 * @returns {Object|null} Processed data or null if invalid
 */
export function processSC2Data(raw) {
  try {
    if (!validateSchema(raw)) {
      return null;
    }

    const normalized = normalizeData(raw);
    const actionConfig = createActionConfig(normalized);

    logger.info('Data processing complete');

    return {
      raw,
      normalized,
      actionConfig,
    };
  } catch (err) {
    logger.error('processSC2Data error:', err);
    return null;
  }
}

/**
 * Generate schema summary for display
 * @param {Object} raw - Raw JSON data
 * @returns {string} Summary text
 */
export function getSchemaSummary(raw) {
  if (!raw) return 'No JSON loaded.';

  const races = ['protoss', 'terran', 'zerg'];
  const sections = ['unit', 'building', 'upgrade'];
  const parts = [];

  for (const r of races) {
    const counts = sections.map(sec => {
      const obj = raw[sec]?.[r] || {};
      return Object.keys(obj).length;
    });
    parts.push(
      `${r[0].toUpperCase() + r.slice(1)}: U${counts[0]} / B${counts[1]} / Upg${counts[2]}`
    );
  }

  return parts.join('  ·  ');
}

/**
 * Load data from file
 * @param {File} file - File object
 * @returns {Promise<Object>} Processed data
 */
export async function loadFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    logger.info('Loading file:', file.name, file.type, file.size);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target.result);
        logger.info('JSON parsed successfully');
        const processed = processSC2Data(raw);

        if (processed) {
          resolve(processed);
        } else {
          reject(new Error('Invalid game data (see console)'));
        }
      } catch (err) {
        logger.error('JSON parse error:', err);
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = (err) => {
      logger.error('File read error:', err);
      reject(new Error('File read error'));
    };

    reader.readAsText(file);
  });
}

/**
 * Load data from embedded script tag
 * @param {string} scriptId - ID of script tag containing JSON
 * @returns {Object|null} Processed data or null
 */
export function loadEmbeddedData(scriptId) {
  try {
    const el = document.getElementById(scriptId);
    const txt = el?.textContent?.trim();

    if (txt && txt.startsWith('{')) {
      const raw = JSON.parse(txt);
      return processSC2Data(raw);
    }
  } catch (err) {
    logger.warn('Embedded JSON load failed:', err);
  }

  return null;
}
