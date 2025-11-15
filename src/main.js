/**
 * SC2 Build Lab - Main Entry Point
 * Refactored modular architecture implementing Knuth, Wolfram, and Torvalds' improvements
 */

import { state } from './core/state.js';
import { logger } from './core/logger.js';
import { AUTO_TEMPLATES } from './core/config.js';
import { $, $$, by, debounce } from './utils/dom.js';
import { loadFromFile, loadEmbeddedData, getSchemaSummary } from './data/parser.js';
import { GameDatabase, flattenEntities } from './data/query.js';
import { findMissingPrereqs } from './algorithms/build-order.js';
import { renderGrid, renderExtras, jumpToEntity } from './ui/grid.js';
import { renderBuildList } from './ui/build.js';
import { renderCharts } from './ui/charts.js';
import { initTheme, applyRaceTheme } from './ui/theme.js';
import { showStatus } from './ui/status.js';

// Global database instance
let db = null;

/**
 * Try to add entity to build order with prerequisite checking
 * @param {Object} item - Entity to add
 */
function tryAddToBuild(item) {
  const missing = findMissingPrereqs(item, state.build, state.race);
  const locked = missing.length > 0;

  state.addToBuild(
    {
      ...item,
      image: item.image,
    },
    locked,
    missing
  );

  renderBuildList(true);
  renderCharts();
}

/**
 * Get and render current entities
 */
function refreshDisplay() {
  if (!state.norm) {
    logger.warn('No data loaded');
    return;
  }

  // Get entities for current race and section
  const items = flattenEntities(state.norm, state.race, state.section);

  // Filter by search
  let filtered = items;
  if (state.search) {
    const q = state.search.toLowerCase().trim();
    filtered = items.filter(it => it.name.toLowerCase().includes(q));
  }

  // Sort
  if (state.sortKey) {
    filtered.sort(by(state.sortKey));
  }

  // Render
  renderGrid(
    filtered,
    (name) => db?.findByName(name),
    jumpToEntity,
    tryAddToBuild
  );

  // Render extras
  const extras = state.data?.extras?.[state.race] || {};
  renderExtras(extras);

  // Apply theme
  applyRaceTheme(state.race, state.section);

  // Render build
  renderBuildList();
  renderCharts();
}

/**
 * Load and process SC2 data
 * @param {Object} processed - Processed data object
 */
function loadData(processed) {
  if (!processed) return;

  state.data = processed.raw;
  state.norm = processed.normalized;

  // Build database with indices
  db = new GameDatabase(processed.normalized);

  // Update summary
  const summary = getSchemaSummary(processed.raw);
  const summaryEl = $('#schemaSummary');
  if (summaryEl) summaryEl.textContent = summary;

  logger.info('Data loaded successfully');
}

/**
 * Initialize event handlers
 */
function initEventHandlers() {
  // File input
  const fileInput = $('#fileInput');
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showStatus('Loading JSON...');

    try {
      const processed = await loadFromFile(file);
      loadData(processed);
      refreshDisplay();
      showStatus('Game data loaded', 'success');
    } catch (err) {
      logger.error('Failed to load file:', err);
      showStatus(err.message, 'error', 4000);
    }

    e.target.value = null;
  });

  // Drag and drop
  window.addEventListener('dragenter', e => {
    e.preventDefault();
    $('#drop-overlay')?.classList.add('visible');
  });

  window.addEventListener('dragover', e => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', e => {
    if (e.target === document) {
      $('#drop-overlay')?.classList.remove('visible');
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    $('#drop-overlay')?.classList.remove('visible');

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    showStatus('Loading JSON...');

    try {
      const processed = await loadFromFile(file);
      loadData(processed);
      refreshDisplay();
      showStatus('Game data loaded', 'success');
    } catch (err) {
      logger.error('Failed to load file:', err);
      showStatus(err.message, 'error', 4000);
    }
  });

  // Race tabs
  $$('.race-tab').forEach(btn =>
    btn.addEventListener('click', () => {
      state.set('race', btn.dataset.race);
      refreshDisplay();
    })
  );

  // Section tabs
  $$('.section-tab').forEach(btn =>
    btn.addEventListener('click', () => {
      state.set('section', btn.dataset.section);
      refreshDisplay();
    })
  );

  // Search
  $('#searchInput')?.addEventListener('input', debounce(() => {
    state.search = $('#searchInput').value;
    refreshDisplay();
  }, 150));

  // Sort
  $('#sortSelect')?.addEventListener('change', () => {
    state.sortKey = $('#sortSelect').value;
    refreshDisplay();
  });

  // Image root
  $('#imgRoot')?.addEventListener('change', () => {
    state.imageRoot = $('#imgRoot').value.trim();
    refreshDisplay();
  });

  // Build controls
  $('#clearBuild')?.addEventListener('click', () => {
    state.clearBuild();
    renderBuildList();
    renderCharts();
  });

  $('#copyText')?.addEventListener('click', () => {
    const text = state.build
      .map((b, i) => `${i + 1}. ${b.kind}: ${b.name}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    showStatus('Build copied as text', 'success');
  });

  $('#copyJson')?.addEventListener('click', () => {
    navigator.clipboard.writeText(JSON.stringify(state.build, null, 2));
    showStatus('Build copied as JSON', 'success');
  });

  $('#exportBuild')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.build, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'build-order.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Auto build
  $('#autoBuild')?.addEventListener('click', () => {
    if (!state.data) {
      showStatus('Load sc2units.json first', 'error', 3000);
      return;
    }

    const template = AUTO_TEMPLATES[state.race] || [];
    if (!template.length) {
      showStatus('No template for this race', 'error', 3000);
      return;
    }

    state.clearBuild();

    template.forEach(name => {
      const entity = db?.findByName(name);
      if (entity) {
        const flattened = {
          name: entity.name,
          kind: entity.kind,
          mineral: entity.cost?.mineral || 0,
          gas: entity.cost?.gas || 0,
          supply: entity.supply?.required || 0,
          buildtime: entity.time || entity.build_time || 0,
          image: entity.image,
          required: entity.tech_tree?.requires || [],
        };
        tryAddToBuild(flattened);
      } else {
        logger.warn('Template entity not found:', name);
      }
    });

    showStatus('Auto build generated', 'success');
  });

  // Broken images
  $('#copyBroken')?.addEventListener('click', () => {
    navigator.clipboard.writeText(state.brokenImages.toString());
    showStatus('Broken image list copied', 'success');
  });
}

/**
 * Bootstrap application
 */
function bootstrap() {
  logger.info('SC2 Build Lab starting...');

  // Initialize theme
  initTheme();

  // Try to load embedded data
  const embedded = loadEmbeddedData('sc2-data');
  if (embedded) {
    loadData(embedded);
  }

  // Initial render
  refreshDisplay();

  // Setup event handlers
  initEventHandlers();

  logger.info('SC2 Build Lab ready');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// Export for console access
window.SC2BuildLab = {
  state,
  db: () => db,
  refresh: refreshDisplay,
  logger,
};
