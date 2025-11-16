/**
 * Data Import Manager UI
 *
 * Comprehensive UI for importing SC2 game data from multiple sources:
 * 1. File upload (JSON)
 * 2. URL import
 * 3. Liquipedia scraping
 * 4. Community APIs
 * 5. Balance patch updates
 * 6. Manual data entry
 */

import { dataImporter } from '../data/data-importer.js';
import { getDataStatistics } from '../data/data-validator.js';

/**
 * Create Data Import Manager UI
 *
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Manager interface
 */
export function createDataImportManager(container) {
  let currentView = 'main';
  let importInProgress = false;

  // Initialize importer
  dataImporter.init().catch(error => {
    console.error('Failed to initialize data importer:', error);
  });

  /**
   * Render main view
   */
  function renderMainView() {
    container.innerHTML = `
      <div class="data-import-manager">
        <div class="import-header">
          <h2>SC2 Data Import Manager</h2>
          <button class="btn-export" id="exportDataBtn">Export Current Data</button>
        </div>

        <div class="import-methods">
          <div class="import-method-card" data-method="file">
            <div class="method-icon">📁</div>
            <h3>File Upload</h3>
            <p>Import from local JSON file</p>
            <button class="btn-primary">Choose File</button>
          </div>

          <div class="import-method-card" data-method="url">
            <div class="method-icon">🌐</div>
            <h3>URL Import</h3>
            <p>Import from remote JSON endpoint</p>
            <button class="btn-primary">Enter URL</button>
          </div>

          <div class="import-method-card" data-method="liquipedia">
            <div class="method-icon">📚</div>
            <h3>Liquipedia Scraper</h3>
            <p>Scrape latest data from Liquipedia</p>
            <button class="btn-primary">Start Scraping</button>
          </div>

          <div class="import-method-card" data-method="template">
            <div class="method-icon">📋</div>
            <h3>Use Template</h3>
            <p>Load pre-filled data template</p>
            <button class="btn-primary">Load Template</button>
          </div>

          <div class="import-method-card" data-method="patch">
            <div class="method-icon">🔄</div>
            <h3>Balance Patch</h3>
            <p>Import balance patch updates</p>
            <button class="btn-primary">Select Patch</button>
          </div>

          <div class="import-method-card" data-method="manual">
            <div class="method-icon">✏️</div>
            <h3>Manual Entry</h3>
            <p>Add or edit data manually</p>
            <button class="btn-primary">Enter Data</button>
          </div>
        </div>

        <div class="current-data-stats">
          <h3>Current Data Statistics</h3>
          <div id="dataStats">Loading...</div>
        </div>

        <div class="import-history">
          <h3>Import History</h3>
          <div id="historyList">No imports yet</div>
        </div>

        <div class="import-progress" id="importProgress" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <div class="progress-message" id="progressMessage"></div>
        </div>
      </div>
    `;

    // Attach event listeners
    attachMainViewListeners();

    // Load and display stats
    updateDataStats();
    updateHistory();
  }

  /**
   * Attach event listeners for main view
   */
  function attachMainViewListeners() {
    // Export button
    const exportBtn = container.querySelector('#exportDataBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          await dataImporter.exportAsFile('sc2units.json');
          showNotification('Data exported successfully', 'success');
        } catch (error) {
          showNotification(`Export failed: ${error.message}`, 'error');
        }
      });
    }

    // Method cards
    const cards = container.querySelectorAll('.import-method-card');
    cards.forEach(card => {
      const button = card.querySelector('button');
      const method = card.dataset.method;

      if (button) {
        button.addEventListener('click', () => {
          handleMethodSelection(method);
        });
      }
    });
  }

  /**
   * Handle import method selection
   */
  async function handleMethodSelection(method) {
    if (importInProgress) {
      showNotification('Import already in progress', 'warning');
      return;
    }

    switch (method) {
      case 'file':
        showFileUploadDialog();
        break;
      case 'url':
        showURLImportDialog();
        break;
      case 'liquipedia':
        await importFromLiquipedia();
        break;
      case 'template':
        await loadTemplate();
        break;
      case 'patch':
        showBalancePatchDialog();
        break;
      case 'manual':
        showManualEntryDialog();
        break;
    }
  }

  /**
   * Show file upload dialog
   */
  function showFileUploadDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await importFromFile(file);
      }
    });

    input.click();
  }

  /**
   * Import from file
   */
  async function importFromFile(file) {
    try {
      setImportProgress(true, `Importing from ${file.name}...`);

      const result = await dataImporter.importFromFile(file);

      showNotification(
        `Import successful! Added ${result.stats.totals.units} units, ` +
        `${result.stats.totals.buildings} buildings, ` +
        `${result.stats.totals.upgrades} upgrades`,
        'success'
      );

      updateDataStats();
      updateHistory();
    } catch (error) {
      showNotification(`Import failed: ${error.message}`, 'error');
    } finally {
      setImportProgress(false);
    }
  }

  /**
   * Show URL import dialog
   */
  function showURLImportDialog() {
    const modal = createModal('Import from URL', `
      <div class="form-group">
        <label for="importUrl">JSON Data URL:</label>
        <input type="url" id="importUrl" class="form-control"
               placeholder="https://example.com/sc2units.json">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="cancelBtn">Cancel</button>
        <button class="btn-primary" id="importBtn">Import</button>
      </div>
    `);

    const importBtn = modal.querySelector('#importBtn');
    const cancelBtn = modal.querySelector('#cancelBtn');
    const urlInput = modal.querySelector('#importUrl');

    importBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (url) {
        modal.remove();
        await importFromURL(url);
      }
    });

    cancelBtn.addEventListener('click', () => modal.remove());
  }

  /**
   * Import from URL
   */
  async function importFromURL(url) {
    try {
      setImportProgress(true, `Importing from ${url}...`);

      const result = await dataImporter.importFromURL(url);

      showNotification(
        `Import successful! Added ${result.stats.totals.units} units, ` +
        `${result.stats.totals.buildings} buildings, ` +
        `${result.stats.totals.upgrades} upgrades`,
        'success'
      );

      updateDataStats();
      updateHistory();
    } catch (error) {
      showNotification(`Import failed: ${error.message}`, 'error');
    } finally {
      setImportProgress(false);
    }
  }

  /**
   * Import from Liquipedia
   */
  async function importFromLiquipedia() {
    const modal = createModal('Import from Liquipedia', `
      <div class="form-group">
        <label>Select races to import:</label>
        <div class="checkbox-group">
          <label><input type="checkbox" name="race" value="protoss" checked> Protoss</label>
          <label><input type="checkbox" name="race" value="terran" checked> Terran</label>
          <label><input type="checkbox" name="race" value="zerg" checked> Zerg</label>
        </div>
      </div>
      <div class="alert alert-info">
        Note: Web scraping may take 30-60 seconds per race.
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="cancelBtn">Cancel</button>
        <button class="btn-primary" id="importBtn">Start Import</button>
      </div>
    `);

    const importBtn = modal.querySelector('#importBtn');
    const cancelBtn = modal.querySelector('#cancelBtn');
    const checkboxes = modal.querySelectorAll('input[name="race"]');

    importBtn.addEventListener('click', async () => {
      const selectedRaces = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      if (selectedRaces.length === 0) {
        showNotification('Please select at least one race', 'warning');
        return;
      }

      modal.remove();

      try {
        setImportProgress(true, 'Scraping Liquipedia...');

        // Listen to progress events
        const unsubscribe = dataImporter.on('scraping-progress', (progress) => {
          setImportProgress(
            true,
            `Scraping ${progress.race}... (${progress.status})`
          );
        });

        const result = await dataImporter.importFromLiquipedia(selectedRaces);
        unsubscribe();

        showNotification(
          `Import successful! Scraped data for ${selectedRaces.join(', ')}`,
          'success'
        );

        updateDataStats();
        updateHistory();
      } catch (error) {
        showNotification(`Import failed: ${error.message}`, 'error');
      } finally {
        setImportProgress(false);
      }
    });

    cancelBtn.addEventListener('click', () => modal.remove());
  }

  /**
   * Load template data
   */
  async function loadTemplate() {
    try {
      setImportProgress(true, 'Loading template...');

      // Fetch template from scripts directory
      const response = await fetch('./scripts/sc2_data_template.json');
      if (!response.ok) {
        throw new Error('Template file not found');
      }

      const data = await response.json();
      const result = await dataImporter.importData(data, 'template');

      showNotification(
        `Template loaded! Added ${result.stats.totals.units} units, ` +
        `${result.stats.totals.buildings} buildings, ` +
        `${result.stats.totals.upgrades} upgrades`,
        'success'
      );

      updateDataStats();
      updateHistory();
    } catch (error) {
      showNotification(`Failed to load template: ${error.message}`, 'error');
    } finally {
      setImportProgress(false);
    }
  }

  /**
   * Show balance patch dialog
   */
  function showBalancePatchDialog() {
    const modal = createModal('Import Balance Patch', `
      <div class="form-group">
        <label for="patchVersion">Patch Version:</label>
        <input type="text" id="patchVersion" class="form-control"
               placeholder="5.0.11">
        <small>Enter patch version (e.g., 5.0.11, 5.0.12)</small>
      </div>
      <div class="alert alert-info">
        Balance patch data will be merged with existing data.
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="cancelBtn">Cancel</button>
        <button class="btn-primary" id="importBtn">Import Patch</button>
      </div>
    `);

    const importBtn = modal.querySelector('#importBtn');
    const cancelBtn = modal.querySelector('#cancelBtn');
    const versionInput = modal.querySelector('#patchVersion');

    importBtn.addEventListener('click', async () => {
      const version = versionInput.value.trim();
      if (!version) {
        showNotification('Please enter a patch version', 'warning');
        return;
      }

      modal.remove();

      try {
        setImportProgress(true, `Importing patch ${version}...`);
        const result = await dataImporter.importBalancePatch(version);

        showNotification(
          `Patch ${version} imported successfully`,
          'success'
        );

        updateDataStats();
        updateHistory();
      } catch (error) {
        showNotification(`Import failed: ${error.message}`, 'error');
      } finally {
        setImportProgress(false);
      }
    });

    cancelBtn.addEventListener('click', () => modal.remove());
  }

  /**
   * Show manual entry dialog
   */
  function showManualEntryDialog() {
    const modal = createModal('Manual Data Entry', `
      <div class="form-group">
        <label for="entityRace">Race:</label>
        <select id="entityRace" class="form-control">
          <option value="protoss">Protoss</option>
          <option value="terran">Terran</option>
          <option value="zerg">Zerg</option>
        </select>
      </div>

      <div class="form-group">
        <label for="entityType">Type:</label>
        <select id="entityType" class="form-control">
          <option value="units">Unit</option>
          <option value="buildings">Building</option>
          <option value="upgrades">Upgrade</option>
        </select>
      </div>

      <div class="form-group">
        <label for="entityName">Name:</label>
        <input type="text" id="entityName" class="form-control" placeholder="Zealot">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="entityMineral">Minerals:</label>
          <input type="number" id="entityMineral" class="form-control" value="0" min="0">
        </div>
        <div class="form-group">
          <label for="entityGas">Gas:</label>
          <input type="number" id="entityGas" class="form-control" value="0" min="0">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="entityTime">Build Time (s):</label>
          <input type="number" id="entityTime" class="form-control" value="0" min="0">
        </div>
        <div class="form-group">
          <label for="entitySupply">Supply:</label>
          <input type="number" id="entitySupply" class="form-control" value="0" min="0">
        </div>
      </div>

      <div class="form-group">
        <label for="entityRequires">Requirements (comma-separated):</label>
        <input type="text" id="entityRequires" class="form-control"
               placeholder="Gateway, Cybernetics Core">
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" id="cancelBtn">Cancel</button>
        <button class="btn-primary" id="addBtn">Add Entity</button>
      </div>
    `, 'large');

    const addBtn = modal.querySelector('#addBtn');
    const cancelBtn = modal.querySelector('#cancelBtn');

    addBtn.addEventListener('click', async () => {
      const entity = {
        race: modal.querySelector('#entityRace').value,
        type: modal.querySelector('#entityType').value,
        name: modal.querySelector('#entityName').value.trim(),
        mineral: parseInt(modal.querySelector('#entityMineral').value) || 0,
        gas: parseInt(modal.querySelector('#entityGas').value) || 0,
        time: parseInt(modal.querySelector('#entityTime').value) || 0,
        supply: parseInt(modal.querySelector('#entitySupply').value) || 0,
        requires: modal.querySelector('#entityRequires').value
          .split(',')
          .map(r => r.trim())
          .filter(r => r)
      };

      if (!entity.name) {
        showNotification('Please enter an entity name', 'warning');
        return;
      }

      modal.remove();
      await addManualEntity(entity);
    });

    cancelBtn.addEventListener('click', () => modal.remove());
  }

  /**
   * Add manual entity
   */
  async function addManualEntity(entity) {
    try {
      const key = entity.name.toLowerCase().replace(/\s+/g, '');

      const data = {
        [entity.race]: {
          [entity.type]: {
            [key]: {
              name: entity.name,
              cost: {
                mineral: entity.mineral,
                gas: entity.gas
              },
              time: entity.time,
              supply: {
                required: entity.supply
              },
              tech_tree: {
                requires: entity.requires
              }
            }
          }
        }
      };

      const result = await dataImporter.importData(data, 'manual');

      showNotification(`${entity.name} added successfully!`, 'success');

      updateDataStats();
      updateHistory();
    } catch (error) {
      showNotification(`Failed to add entity: ${error.message}`, 'error');
    }
  }

  /**
   * Update data statistics display
   */
  async function updateDataStats() {
    const statsContainer = container.querySelector('#dataStats');
    if (!statsContainer) return;

    try {
      const data = await dataImporter.exportData();
      const stats = getDataStatistics(data);

      statsContainer.innerHTML = `
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${stats.totals.units}</div>
            <div class="stat-label">Total Units</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.totals.buildings}</div>
            <div class="stat-label">Total Buildings</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.totals.upgrades}</div>
            <div class="stat-label">Total Upgrades</div>
          </div>
        </div>

        <div class="race-stats">
          ${Object.entries(stats.races).map(([race, raceStats]) => `
            <div class="race-stat">
              <h4>${race.charAt(0).toUpperCase() + race.slice(1)}</h4>
              <div>${raceStats.units} units, ${raceStats.buildings} buildings, ${raceStats.upgrades} upgrades</div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (error) {
      statsContainer.innerHTML = '<div class="error">Failed to load statistics</div>';
    }
  }

  /**
   * Update history display
   */
  function updateHistory() {
    const historyContainer = container.querySelector('#historyList');
    if (!historyContainer) return;

    const history = dataImporter.getHistory();

    if (history.length === 0) {
      historyContainer.innerHTML = '<div class="no-history">No imports yet</div>';
      return;
    }

    historyContainer.innerHTML = history.slice(0, 10).map(entry => {
      const date = new Date(entry.timestamp);
      const status = entry.success ? '✓' : '✗';
      const statusClass = entry.success ? 'success' : 'error';

      return `
        <div class="history-item ${statusClass}">
          <span class="history-status">${status}</span>
          <span class="history-source">${entry.source}</span>
          <span class="history-time">${date.toLocaleString()}</span>
          ${entry.stats ? `
            <span class="history-stats">
              ${entry.stats.totals.units}U /
              ${entry.stats.totals.buildings}B /
              ${entry.stats.totals.upgrades}Up
            </span>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Set import progress
   */
  function setImportProgress(inProgress, message = '') {
    importInProgress = inProgress;

    const progressContainer = container.querySelector('#importProgress');
    const progressMessage = container.querySelector('#progressMessage');

    if (progressContainer) {
      progressContainer.style.display = inProgress ? 'block' : 'none';
    }

    if (progressMessage && message) {
      progressMessage.textContent = message;
    }
  }

  /**
   * Show notification
   */
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Create modal dialog
   */
  function createModal(title, content, size = 'medium') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-dialog modal-${size}">
        <div class="modal-header">
          <h3>${title}</h3>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    return modal;
  }

  // Subscribe to importer events
  dataImporter.on('import-success', () => {
    updateDataStats();
    updateHistory();
  });

  dataImporter.on('data-cleared', () => {
    updateDataStats();
  });

  // Initial render
  renderMainView();

  return {
    destroy: () => {
      container.innerHTML = '';
    }
  };
}
