/**
 * Build Library UI
 * Interface for browsing, searching, and managing saved builds
 */

import { getBuildDatabase } from '../data/build-database.js';
import { logger } from '../core/logger.js';
import { showStatus } from './status.js';

// Track selected builds for comparison
const selectedBuilds = new Set();

/**
 * Render build library modal
 * @param {HTMLElement} container - Modal container
 * @param {Function} onLoadBuild - Callback when build is loaded
 * @param {Function} onCompareBuild - Callback when comparison is requested
 */
export default async function renderBuildLibrary(container, onLoadBuild, onCompareBuild) {
  const db = getBuildDatabase();

  try {
    await db.init();
  } catch (err) {
    logger.error('Failed to initialize database:', err);
    showStatus('Database error: ' + err.message, 'error');
    return;
  }

  // Clear container
  container.innerHTML = '';

  // Reset selected builds
  selectedBuilds.clear();

  // Create UI structure
  const ui = createLibraryUI();
  container.appendChild(ui.root);

  // Load and render builds
  await refreshBuildList(ui, db, onLoadBuild, onCompareBuild);

  // Set up event listeners
  setupEventListeners(ui, db, onLoadBuild, onCompareBuild);

  return ui;
}

/**
 * Create library UI structure
 */
function createLibraryUI() {
  const root = document.createElement('div');
  root.className = 'build-library';

  root.innerHTML = `
    <div class="library-header">
      <div class="search-bar">
        <input
          type="search"
          id="librarySearch"
          placeholder="Search builds..."
          class="search-input"
        />
        <select id="raceFilter" class="filter-select">
          <option value="">All Races</option>
          <option value="protoss">Protoss</option>
          <option value="terran">Terran</option>
          <option value="zerg">Zerg</option>
        </select>
        <select id="sortBy" class="filter-select">
          <option value="updatedAt">Recently Updated</option>
          <option value="createdAt">Recently Created</option>
          <option value="name">Name (A-Z)</option>
        </select>
        <button id="showFavoritesOnly" class="filter-btn" data-active="false">
          ⭐ Favorites Only
        </button>
      </div>

      <div class="tag-filters" id="tagFilters">
        <!-- Tags will be inserted here -->
      </div>

      <div class="library-actions">
        <button id="compareBuilds" class="action-btn" style="display: none; background: linear-gradient(to right, #6366f1, #8b5cf6); color: white;">
          ⚖️ Compare (<span id="compareCount">0</span>)
        </button>
        <button id="importBuild" class="action-btn">
          📥 Import Build
        </button>
        <button id="exportAll" class="action-btn">
          📤 Export All
        </button>
        <button id="clearAll" class="action-btn danger">
          🗑️ Clear All
        </button>
        <div class="stats" id="libraryStats"></div>
      </div>
    </div>

    <div class="library-content">
      <div id="buildGrid" class="build-grid">
        <!-- Build cards will be inserted here -->
      </div>

      <div id="emptyState" class="empty-state hidden">
        <div class="empty-icon">📚</div>
        <h3>No builds yet</h3>
        <p>Save your first build to get started!</p>
      </div>
    </div>
  `;

  return {
    root,
    search: root.querySelector('#librarySearch'),
    raceFilter: root.querySelector('#raceFilter'),
    sortBy: root.querySelector('#sortBy'),
    favoritesOnly: root.querySelector('#showFavoritesOnly'),
    tagFilters: root.querySelector('#tagFilters'),
    buildGrid: root.querySelector('#buildGrid'),
    emptyState: root.querySelector('#emptyState'),
    stats: root.querySelector('#libraryStats'),
    compareBtn: root.querySelector('#compareBuilds'),
    compareCount: root.querySelector('#compareCount'),
    importBtn: root.querySelector('#importBuild'),
    exportBtn: root.querySelector('#exportAll'),
    clearBtn: root.querySelector('#clearAll'),
  };
}

/**
 * Set up event listeners
 */
function setupEventListeners(ui, db, onLoadBuild, onCompareBuild) {
  // Search
  ui.search.addEventListener('input', () => {
    refreshBuildList(ui, db, onLoadBuild, onCompareBuild);
  });

  // Race filter
  ui.raceFilter.addEventListener('change', () => {
    refreshBuildList(ui, db, onLoadBuild, onCompareBuild);
  });

  // Sort
  ui.sortBy.addEventListener('change', () => {
    refreshBuildList(ui, db, onLoadBuild, onCompareBuild);
  });

  // Favorites only
  ui.favoritesOnly.addEventListener('click', () => {
    const isActive = ui.favoritesOnly.dataset.active === 'true';
    ui.favoritesOnly.dataset.active = !isActive;
    ui.favoritesOnly.classList.toggle('active');
    refreshBuildList(ui, db, onLoadBuild, onCompareBuild);
  });

  // Compare builds
  ui.compareBtn.addEventListener('click', async () => {
    if (selectedBuilds.size < 2) {
      showStatus('Select at least 2 builds to compare', 'error', 3000);
      return;
    }

    if (selectedBuilds.size > 4) {
      showStatus('Maximum 4 builds can be compared at once', 'error', 3000);
      return;
    }

    // Fetch full build data for selected IDs
    const builds = [];
    for (const id of selectedBuilds) {
      const build = await db.getBuild(id);
      if (build) builds.push(build);
    }

    if (onCompareBuild) {
      onCompareBuild(builds);
    }
  });

  // Import
  ui.importBtn.addEventListener('click', () => {
    importBuildDialog(db, () => refreshBuildList(ui, db, onLoadBuild, onCompareBuild));
  });

  // Export all
  ui.exportBtn.addEventListener('click', async () => {
    try {
      const backup = await db.createBackup();
      downloadJSON(backup, `sc2-builds-backup-${Date.now()}.json`);
      showStatus('Backup exported successfully', 'success');
    } catch (err) {
      logger.error('Export failed:', err);
      showStatus('Export failed: ' + err.message, 'error');
    }
  });

  // Clear all
  ui.clearBtn.addEventListener('click', async () => {
    if (
      !confirm(
        'Are you sure you want to delete ALL builds? This cannot be undone!'
      )
    ) {
      return;
    }

    try {
      const deleted = await db.clearAll();
      showStatus(`Deleted ${deleted} builds`, 'success');
      refreshBuildList(ui, db, onLoadBuild, onCompareBuild);
    } catch (err) {
      logger.error('Clear failed:', err);
      showStatus('Failed to clear builds: ' + err.message, 'error');
    }
  });
}

/**
 * Refresh build list
 */
async function refreshBuildList(ui, db, onLoadBuild, onCompareBuild) {
  const options = {
    search: ui.search.value.trim(),
    race: ui.raceFilter.value || undefined,
    sortBy: ui.sortBy.value || 'updatedAt',
    sortOrder: 'desc',
    favorited: ui.favoritesOnly.dataset.active === 'true' || undefined,
  };

  try {
    const builds = await db.getAllBuilds(options);
    const tags = await db.getAllTags();

    renderBuildCards(ui.buildGrid, builds, db, onLoadBuild, () =>
      refreshBuildList(ui, db, onLoadBuild, onCompareBuild), ui
    );
    renderTagFilters(ui.tagFilters, tags);
    renderStats(ui.stats, await db.getStats());

    // Show/hide empty state
    if (builds.length === 0) {
      ui.buildGrid.classList.add('hidden');
      ui.emptyState.classList.remove('hidden');
    } else {
      ui.buildGrid.classList.remove('hidden');
      ui.emptyState.classList.add('hidden');
    }
  } catch (err) {
    logger.error('Failed to load builds:', err);
    showStatus('Failed to load builds: ' + err.message, 'error');
  }
}

/**
 * Render build cards
 */
function renderBuildCards(container, builds, db, onLoadBuild, onRefresh, ui) {
  container.innerHTML = '';

  builds.forEach((build) => {
    const card = createBuildCard(build, db, onLoadBuild, onRefresh, ui);
    container.appendChild(card);
  });
}

/**
 * Create build card element
 */
function createBuildCard(build, db, onLoadBuild, onRefresh, ui) {
  const card = document.createElement('div');
  card.className = 'build-card';

  const raceColors = {
    protoss: '#2563eb',
    terran: '#ef4444',
    zerg: '#6d28d9',
  };

  const isSelected = selectedBuilds.has(build.id);

  card.innerHTML = `
    <div class="build-card-header" style="border-left: 4px solid ${
      raceColors[build.race] || '#666'
    }">
      <div class="build-card-title">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <input
            type="checkbox"
            class="select-build-checkbox"
            data-id="${build.id}"
            ${isSelected ? 'checked' : ''}
            style="width: 18px; height: 18px; cursor: pointer;"
          />
          <h4 style="margin: 0;">${escapeHtml(build.name)}</h4>
        </div>
        <button class="favorite-btn ${build.favorited ? 'active' : ''}" data-id="${
    build.id
  }">
          ${build.favorited ? '⭐' : '☆'}
        </button>
      </div>
      <div class="build-card-meta">
        <span class="race-badge ${build.race}">${capitalize(build.race)}</span>
        <span class="date">${formatDate(build.updatedAt)}</span>
      </div>
    </div>

    <div class="build-card-body">
      ${
        build.description
          ? `<p class="description">${escapeHtml(build.description)}</p>`
          : ''
      }

      <div class="stats-row">
        <div class="stat">
          <span class="stat-label">Steps</span>
          <span class="stat-value">${build.stats.totalSteps}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Units</span>
          <span class="stat-value">${build.stats.units}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Buildings</span>
          <span class="stat-value">${build.stats.buildings}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Cost</span>
          <span class="stat-value">${build.stats.totalMinerals}m ${
    build.stats.totalGas
  }g</span>
        </div>
      </div>

      ${
        build.tags.length > 0
          ? `
        <div class="tags">
          ${build.tags
            .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
            .join('')}
        </div>
      `
          : ''
      }
    </div>

    <div class="build-card-actions">
      <button class="action-btn-sm load-btn" data-id="${build.id}">
        📂 Load
      </button>
      <button class="action-btn-sm edit-btn" data-id="${build.id}">
        ✏️ Edit
      </button>
      <button class="action-btn-sm export-btn" data-id="${build.id}">
        📤 Export
      </button>
      <button class="action-btn-sm delete-btn" data-id="${build.id}">
        🗑️ Delete
      </button>
    </div>
  `;

  // Event listeners
  card.querySelector('.select-build-checkbox').addEventListener('change', (e) => {
    const id = e.target.dataset.id;
    if (e.target.checked) {
      selectedBuilds.add(id);
    } else {
      selectedBuilds.delete(id);
    }

    // Update compare button visibility and count
    if (ui) {
      ui.compareCount.textContent = selectedBuilds.size;
      if (selectedBuilds.size >= 2 && selectedBuilds.size <= 4) {
        ui.compareBtn.style.display = 'inline-block';
      } else {
        ui.compareBtn.style.display = 'none';
      }
    }
  });

  card.querySelector('.favorite-btn').addEventListener('click', async (e) => {
    try {
      await db.toggleFavorite(build.id);
      onRefresh();
    } catch (err) {
      logger.error('Failed to toggle favorite:', err);
    }
  });

  card.querySelector('.load-btn').addEventListener('click', () => {
    onLoadBuild(build);
    showStatus(`Loaded: ${build.name}`, 'success');
  });

  card.querySelector('.edit-btn').addEventListener('click', () => {
    editBuildDialog(build, db, onRefresh);
  });

  card.querySelector('.export-btn').addEventListener('click', async () => {
    try {
      const exported = await db.exportBuild(build.id);
      downloadJSON(exported, `${build.name.replace(/\s+/g, '-')}.json`);
      showStatus('Build exported', 'success');
    } catch (err) {
      logger.error('Export failed:', err);
      showStatus('Export failed: ' + err.message, 'error');
    }
  });

  card.querySelector('.delete-btn').addEventListener('click', async () => {
    if (!confirm(`Delete "${build.name}"?`)) return;

    try {
      await db.deleteBuild(build.id);
      showStatus('Build deleted', 'success');
      onRefresh();
    } catch (err) {
      logger.error('Delete failed:', err);
      showStatus('Delete failed: ' + err.message, 'error');
    }
  });

  return card;
}

/**
 * Render tag filters
 */
function renderTagFilters(container, tags) {
  container.innerHTML = '';

  if (tags.length === 0) return;

  const label = document.createElement('span');
  label.className = 'tag-label';
  label.textContent = 'Tags:';
  container.appendChild(label);

  tags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.className = 'tag-filter-btn';
    btn.textContent = tag;
    btn.dataset.tag = tag;

    // TODO: Implement tag filtering
    // btn.addEventListener('click', () => { ... });

    container.appendChild(btn);
  });
}

/**
 * Render library stats
 */
function renderStats(container, stats) {
  container.innerHTML = `
    <span>${stats.totalBuilds} builds</span>
    <span>•</span>
    <span>${stats.favoriteBuilds} ⭐</span>
    <span>•</span>
    <span>P:${stats.raceCount.protoss} T:${stats.raceCount.terran} Z:${stats.raceCount.zerg}</span>
  `;
}

/**
 * Edit build dialog
 */
function editBuildDialog(build, db, onRefresh) {
  const name = prompt('Build name:', build.name);
  if (!name) return;

  const description = prompt('Description (optional):', build.description);
  const tagsInput = prompt('Tags (comma-separated):', build.tags.join(', '));
  const tags = tagsInput ? tagsInput.split(',').map((t) => t.trim()) : [];

  db.updateBuild(build.id, { name, description, tags })
    .then(() => {
      showStatus('Build updated', 'success');
      onRefresh();
    })
    .catch((err) => {
      logger.error('Update failed:', err);
      showStatus('Update failed: ' + err.message, 'error');
    });
}

/**
 * Import build dialog
 */
function importBuildDialog(db, onRefresh) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.builds) {
        // Backup file
        const imported = await db.restoreBackup(data, true);
        showStatus(`Imported ${imported} builds`, 'success');
      } else if (data.build) {
        // Single build
        await db.importBuild(data);
        showStatus('Build imported', 'success');
      } else {
        throw new Error('Invalid file format');
      }

      onRefresh();
    } catch (err) {
      logger.error('Import failed:', err);
      showStatus('Import failed: ' + err.message, 'error');
    }
  });

  input.click();
}

/**
 * Download JSON file
 */
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Utility functions
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}

export default renderBuildLibrary;
