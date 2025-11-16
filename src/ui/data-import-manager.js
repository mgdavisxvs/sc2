/**
 * Enhanced Data Import Manager UI
 *
 * NEW FEATURES:
 * 1. Drag & Drop File Upload
 * 2. Import Preview Dialog
 * 3. Visual Validation Error Display
 * 4. Import from Clipboard
 * 5. Real-time Scraping Progress
 */

import { dataImporter } from '../data/data-importer.js';
import { getDataStatistics, validateGameData, sanitizeGameData } from '../data/data-validator.js';

/**
 * Create Enhanced Data Import Manager UI
 *
 * @param {HTMLElement} container - Container element
 * @returns {Object} - Manager interface
 */
export function createDataImportManager(container) {
  let currentView = 'main';
  let importInProgress = false;
  let scrapingProgress = {};

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
        <!-- Drag & Drop Overlay -->
        <div class="drag-drop-overlay" id="dragDropOverlay">
          <div class="drag-drop-content">
            <div class="drag-drop-icon">📁</div>
            <div class="drag-drop-text">Drop JSON file to import</div>
          </div>
        </div>

        <div class="import-header">
          <h2>SC2 Data Import Manager</h2>
          <div class="header-actions">
            <button class="btn-clipboard" id="pasteBtn" title="Paste JSON from clipboard (Ctrl/Cmd+V)">
              📋 Paste JSON
            </button>
            <button class="btn-export" id="exportDataBtn">Export Current Data</button>
          </div>
        </div>

        <div class="import-methods">
          <div class="import-method-card" data-method="file">
            <div class="method-icon">📁</div>
            <h3>File Upload</h3>
            <p>Drop file or click to browse</p>
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

        <!-- Enhanced Progress Display -->
        <div class="import-progress-enhanced" id="importProgressEnhanced" style="display: none;">
          <div class="progress-header">
            <span class="progress-title" id="progressTitle">Importing...</span>
            <button class="btn-close-progress" id="closeProgress">✕</button>
          </div>
          <div id="progressContent"></div>
        </div>
      </div>
    `;

    // Attach event listeners
    attachMainViewListeners();
    setupDragAndDrop();
    setupKeyboardShortcuts();

    // Load and display stats
    updateDataStats();
    updateHistory();
  }

  /**
   * Setup drag and drop functionality
   */
  function setupDragAndDrop() {
    const overlay = container.querySelector('#dragDropOverlay');
    const managerEl = container.querySelector('.data-import-manager');

    if (!overlay || !managerEl) return;

    let dragCounter = 0;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      managerEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Show overlay when dragging file over
    managerEl.addEventListener('dragenter', (e) => {
      dragCounter++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        overlay.classList.add('visible');
      }
    });

    managerEl.addEventListener('dragleave', (e) => {
      dragCounter--;
      if (dragCounter === 0) {
        overlay.classList.remove('visible');
      }
    });

    // Handle file drop
    managerEl.addEventListener('drop', async (e) => {
      dragCounter = 0;
      overlay.classList.remove('visible');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
          await importFromFileWithPreview(file);
        } else {
          showNotification('Please drop a JSON file', 'warning');
        }
      }
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  function setupKeyboardShortcuts() {
    const handleKeyPress = async (e) => {
      // Ctrl/Cmd + V - Paste from clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        // Only handle if not in an input field
        if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
          e.preventDefault();
          await importFromClipboard();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    // Store cleanup function
    container._keydownHandler = handleKeyPress;
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

    // Paste from clipboard button
    const pasteBtn = container.querySelector('#pasteBtn');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', () => importFromClipboard());
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
   * Import from clipboard
   */
  async function importFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();

      if (!text.trim()) {
        showNotification('Clipboard is empty', 'warning');
        return;
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        showNotification('Clipboard does not contain valid JSON', 'error');
        return;
      }

      // Show preview
      await showImportPreview(data, 'clipboard');
    } catch (error) {
      showNotification('Failed to read clipboard. Please grant permission.', 'error');
    }
  }

  /**
   * Show import preview dialog
   */
  async function showImportPreview(data, source = 'unknown') {
    // Get current data for comparison
    const currentData = await dataImporter.exportData();
    const currentStats = getDataStatistics(currentData);

    // Sanitize and validate new data
    const sanitized = sanitizeGameData(data);
    const validation = validateGameData(sanitized);
    const newStats = getDataStatistics(sanitized);

    // Calculate merged stats
    const mergedData = dataImporter.mergeGameData(currentData, sanitized);
    const mergedStats = getDataStatistics(mergedData);

    // Detect changes
    const changes = detectChanges(currentData, sanitized);

    const modal = createModal('Import Preview', `
      <div class="preview-container">
        ${validation.valid ? '' : `
          <div class="alert alert-error">
            <strong>⚠️ Validation Errors (${validation.errors.length})</strong>
            <div class="error-list">
              ${renderValidationErrors(validation.errors)}
            </div>
          </div>
        `}

        <div class="preview-stats-comparison">
          <div class="stats-column">
            <h4>Current Data</h4>
            <div class="stats-box">
              <div class="stat-row"><span>Units:</span> <strong>${currentStats.totals.units}</strong></div>
              <div class="stat-row"><span>Buildings:</span> <strong>${currentStats.totals.buildings}</strong></div>
              <div class="stat-row"><span>Upgrades:</span> <strong>${currentStats.totals.upgrades}</strong></div>
            </div>
          </div>

          <div class="stats-arrow">→</div>

          <div class="stats-column">
            <h4>After Import</h4>
            <div class="stats-box">
              <div class="stat-row">
                <span>Units:</span>
                <strong>${mergedStats.totals.units}</strong>
                ${mergedStats.totals.units !== currentStats.totals.units ?
                  `<span class="stat-diff ${mergedStats.totals.units > currentStats.totals.units ? 'positive' : 'negative'}">
                    ${mergedStats.totals.units > currentStats.totals.units ? '+' : ''}${mergedStats.totals.units - currentStats.totals.units}
                  </span>` : ''}
              </div>
              <div class="stat-row">
                <span>Buildings:</span>
                <strong>${mergedStats.totals.buildings}</strong>
                ${mergedStats.totals.buildings !== currentStats.totals.buildings ?
                  `<span class="stat-diff ${mergedStats.totals.buildings > currentStats.totals.buildings ? 'positive' : 'negative'}">
                    ${mergedStats.totals.buildings > currentStats.totals.buildings ? '+' : ''}${mergedStats.totals.buildings - currentStats.totals.buildings}
                  </span>` : ''}
              </div>
              <div class="stat-row">
                <span>Upgrades:</span>
                <strong>${mergedStats.totals.upgrades}</strong>
                ${mergedStats.totals.upgrades !== currentStats.totals.upgrades ?
                  `<span class="stat-diff ${mergedStats.totals.upgrades > currentStats.totals.upgrades ? 'positive' : 'negative'}">
                    ${mergedStats.totals.upgrades > currentStats.totals.upgrades ? '+' : ''}${mergedStats.totals.upgrades - currentStats.totals.upgrades}
                  </span>` : ''}
              </div>
            </div>
          </div>
        </div>

        ${changes.new.length > 0 ? `
          <div class="changes-section">
            <h4>✅ New Entities (${changes.new.length})</h4>
            <div class="changes-list">
              ${changes.new.slice(0, 10).map(entity => `
                <div class="change-item new">
                  <span class="change-name">${entity.name}</span>
                  <span class="change-type">${entity.race} • ${entity.type}</span>
                </div>
              `).join('')}
              ${changes.new.length > 10 ? `<div class="change-more">+${changes.new.length - 10} more</div>` : ''}
            </div>
          </div>
        ` : ''}

        ${changes.updated.length > 0 ? `
          <div class="changes-section">
            <h4>📝 Updated Entities (${changes.updated.length})</h4>
            <div class="changes-list">
              ${changes.updated.slice(0, 10).map(entity => `
                <div class="change-item updated">
                  <span class="change-name">${entity.name}</span>
                  <span class="change-details">${entity.changes}</span>
                </div>
              `).join('')}
              ${changes.updated.length > 10 ? `<div class="change-more">+${changes.updated.length - 10} more</div>` : ''}
            </div>
          </div>
        ` : ''}

        <div class="modal-actions">
          <button class="btn-secondary" id="cancelPreview">Cancel</button>
          <button class="btn-primary" id="confirmImport" ${!validation.valid ? 'disabled' : ''}>
            ${validation.valid ? 'Confirm Import' : 'Cannot Import (Validation Errors)'}
          </button>
        </div>
      </div>
    `, 'large');

    const confirmBtn = modal.querySelector('#confirmImport');
    const cancelBtn = modal.querySelector('#cancelPreview');

    confirmBtn?.addEventListener('click', async () => {
      modal.remove();
      await executeImport(sanitized, source);
    });

    cancelBtn?.addEventListener('click', () => modal.remove());
  }

  /**
   * Detect changes between current and new data
   */
  function detectChanges(currentData, newData) {
    const changes = { new: [], updated: [] };

    ['protoss', 'terran', 'zerg'].forEach(race => {
      if (!newData[race]) return;

      ['units', 'buildings', 'upgrades'].forEach(type => {
        if (!newData[race][type]) return;

        Object.entries(newData[race][type]).forEach(([key, entity]) => {
          const existing = currentData[race]?.[type]?.[key];

          if (!existing) {
            changes.new.push({
              name: entity.name,
              race: race,
              type: type
            });
          } else {
            // Check for changes
            const diff = [];
            if (existing.cost?.mineral !== entity.cost?.mineral) {
              diff.push(`minerals: ${existing.cost.mineral}→${entity.cost.mineral}`);
            }
            if (existing.cost?.gas !== entity.cost?.gas) {
              diff.push(`gas: ${existing.cost.gas}→${entity.cost.gas}`);
            }
            if (existing.time !== entity.time) {
              diff.push(`time: ${existing.time}→${entity.time}`);
            }

            if (diff.length > 0) {
              changes.updated.push({
                name: entity.name,
                changes: diff.join(', ')
              });
            }
          }
        });
      });
    });

    return changes;
  }

  /**
   * Render validation errors in a user-friendly format
   */
  function renderValidationErrors(errors) {
    // Group errors by entity path
    const grouped = {};
    errors.forEach(error => {
      // Extract entity path (e.g., "protoss.units.zealot")
      const match = error.match(/^([\w.]+)/);
      const path = match ? match[1] : 'general';

      if (!grouped[path]) {
        grouped[path] = [];
      }
      grouped[path].push(error);
    });

    return Object.entries(grouped).map(([path, pathErrors]) => `
      <div class="error-group">
        <div class="error-path">${path}</div>
        ${pathErrors.map(err => `
          <div class="error-item">
            <span class="error-icon">✗</span>
            <span class="error-message">${err.replace(path + '.', '')}</span>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  /**
   * Execute import after preview confirmation
   */
  async function executeImport(data, source) {
    try {
      setEnhancedProgress(true, 'Importing data...', {});
      const result = await dataImporter.importData(data, source);

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
      setEnhancedProgress(false);
    }
  }

  /**
   * Show file upload dialog
   */
  function showFileUploadDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.multiple = false;

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await importFromFileWithPreview(file);
      }
    });

    input.click();
  }

  /**
   * Import from file with preview
   */
  async function importFromFileWithPreview(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await showImportPreview(data, 'file');
    } catch (error) {
      showNotification(`Failed to read file: ${error.message}`, 'error');
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
      setEnhancedProgress(true, `Fetching from ${url}...`, {});

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setEnhancedProgress(false);

      await showImportPreview(data, 'url');
    } catch (error) {
      setEnhancedProgress(false);
      showNotification(`Import failed: ${error.message}`, 'error');
    }
  }

  /**
   * Import from Liquipedia with enhanced progress
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
        // Initialize progress
        scrapingProgress = {};
        selectedRaces.forEach(race => {
          scrapingProgress[race] = { status: 'pending', progress: 0, units: 0 };
        });

        setEnhancedProgress(true, 'Scraping Liquipedia...', scrapingProgress);

        // Listen to progress events
        const unsubscribe = dataImporter.on('scraping-progress', (progress) => {
          scrapingProgress[progress.race] = {
            status: progress.status,
            progress: progress.progress || 0,
            units: progress.units || 0
          };
          setEnhancedProgress(true, 'Scraping Liquipedia...', scrapingProgress);
        });

        const result = await dataImporter.importFromLiquipedia(selectedRaces);
        unsubscribe();

        setEnhancedProgress(false);

        showNotification(
          `Import successful! Scraped data for ${selectedRaces.join(', ')}`,
          'success'
        );

        updateDataStats();
        updateHistory();
      } catch (error) {
        setEnhancedProgress(false);
        showNotification(`Import failed: ${error.message}`, 'error');
      }
    });

    cancelBtn.addEventListener('click', () => modal.remove());
  }

  /**
   * Load template data
   */
  async function loadTemplate() {
    try {
      setEnhancedProgress(true, 'Loading template...', {});

      // Fetch template from scripts directory
      const response = await fetch('./scripts/sc2_data_template.json');
      if (!response.ok) {
        throw new Error('Template file not found');
      }

      const data = await response.json();
      setEnhancedProgress(false);

      await showImportPreview(data, 'template');
    } catch (error) {
      setEnhancedProgress(false);
      showNotification(`Failed to load template: ${error.message}`, 'error');
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
        setEnhancedProgress(true, `Importing patch ${version}...`, {});
        const result = await dataImporter.importBalancePatch(version);
        setEnhancedProgress(false);

        showNotification(
          `Patch ${version} imported successfully`,
          'success'
        );

        updateDataStats();
        updateHistory();
      } catch (error) {
        setEnhancedProgress(false);
        showNotification(`Import failed: ${error.message}`, 'error');
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

    historyContainer.innerHTML = `
      <div class="history-actions">
        <button class="btn-undo" id="undoLastImport" title="Undo last import/edit/delete">
          ↶ Undo Last Import
        </button>
        <button class="btn-manage" id="manageEntities" title="Browse, edit, and delete entities">
          ⚙ Manage Entities
        </button>
      </div>
      ${history.slice(0, 10).map(entry => {
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
      }).join('')}
    `;

    // Attach event listeners
    const undoBtn = container.querySelector('#undoLastImport');
    const manageBtn = container.querySelector('#manageEntities');

    undoBtn?.addEventListener('click', handleUndoLastImport);
    manageBtn?.addEventListener('click', showEntityBrowser);
  }

  /**
   * Set enhanced import progress with race-specific progress bars
   */
  function setEnhancedProgress(inProgress, message = '', progressData = {}) {
    importInProgress = inProgress;

    const progressContainer = container.querySelector('#importProgressEnhanced');
    const progressTitle = container.querySelector('#progressTitle');
    const progressContent = container.querySelector('#progressContent');

    if (!progressContainer) return;

    if (inProgress) {
      progressContainer.style.display = 'block';
      if (progressTitle) progressTitle.textContent = message;

      // Render race-specific progress bars
      if (Object.keys(progressData).length > 0) {
        progressContent.innerHTML = `
          <div class="race-progress-list">
            ${Object.entries(progressData).map(([race, data]) => `
              <div class="race-progress-item">
                <div class="race-progress-header">
                  <span class="race-name">${race.charAt(0).toUpperCase() + race.slice(1)}</span>
                  <span class="race-status ${data.status}">${data.status}</span>
                </div>
                <div class="race-progress-bar">
                  <div class="race-progress-fill" style="width: ${data.progress || 0}%"></div>
                </div>
                <div class="race-progress-info">
                  ${data.units > 0 ? `${data.units} entities scraped` : 'Waiting...'}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        progressContent.innerHTML = `
          <div class="simple-progress">
            <div class="simple-progress-bar">
              <div class="simple-progress-fill"></div>
            </div>
          </div>
        `;
      }
    } else {
      progressContainer.style.display = 'none';
      progressContent.innerHTML = '';
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

  /**
   * Handle undo last import
   */
  async function handleUndoLastImport() {
    try {
      setEnhancedProgress(true, 'Undoing last import...');

      const result = await dataImporter.undoLastImport();

      setEnhancedProgress(false);

      showNotification('Successfully undone last import', 'success');
      updateDataStats();
      updateHistory();
    } catch (error) {
      setEnhancedProgress(false);
      showNotification(error.message || 'Failed to undo import', 'error');
    }
  }

  /**
   * Show entity browser/manager
   */
  async function showEntityBrowser() {
    try {
      const entities = await dataImporter.getAllEntities();

      if (entities.length === 0) {
        showNotification('No entities to manage. Import data first.', 'info');
        return;
      }

      const modal = createModal('Manage Entities', `
        <div class="entity-browser">
          <div class="search-box">
            <input type="text" id="entitySearch" class="form-control"
                   placeholder="Search entities by name...">
          </div>

          <div class="entity-list" id="entityList">
            ${renderEntityList(entities)}
          </div>
        </div>
      `, 'large');

      const searchInput = modal.querySelector('#entitySearch');
      const entityList = modal.querySelector('#entityList');

      searchInput?.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length >= 2) {
          const filtered = await dataImporter.searchEntities(query);
          entityList.innerHTML = renderEntityList(filtered);
          attachEntityListListeners(modal);
        } else {
          entityList.innerHTML = renderEntityList(entities);
          attachEntityListListeners(modal);
        }
      });

      attachEntityListListeners(modal);
    } catch (error) {
      showNotification(error.message || 'Failed to load entities', 'error');
    }
  }

  /**
   * Render entity list HTML
   */
  function renderEntityList(entities) {
    if (entities.length === 0) {
      return '<div class="no-entities">No entities found</div>';
    }

    return `
      <table class="entity-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Race</th>
            <th>Type</th>
            <th>Cost</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${entities.map(entity => `
            <tr data-key="${entity.key}" data-race="${entity.race}" data-type="${entity.entityType}">
              <td>${entity.name}</td>
              <td>${entity.race}</td>
              <td>${entity.entityType}</td>
              <td>${entity.data.cost ? `${entity.data.cost.mineral}m ${entity.data.cost.gas}g` : '-'}</td>
              <td>
                <button class="btn-small btn-edit" title="Edit">✏️ Edit</button>
                <button class="btn-small btn-delete" title="Delete">🗑️ Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Attach event listeners to entity list
   */
  function attachEntityListListeners(modal) {
    const editButtons = modal.querySelectorAll('.btn-edit');
    const deleteButtons = modal.querySelectorAll('.btn-delete');

    editButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        const key = row.dataset.key;
        const race = row.dataset.race;
        const type = row.dataset.type;

        modal.remove();
        await showEditEntityDialog(race, type, key);
      });
    });

    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        const key = row.dataset.key;
        const race = row.dataset.race;
        const type = row.dataset.type;
        const name = row.querySelector('td:first-child').textContent;

        const confirmed = confirm(`Delete ${name} from ${race} ${type}?`);
        if (confirmed) {
          await handleDeleteEntity(race, type, key);
          modal.remove();
          showEntityBrowser(); // Refresh the browser
        }
      });
    });
  }

  /**
   * Show edit entity dialog
   */
  async function showEditEntityDialog(race, entityType, key) {
    try {
      const data = await dataImporter.exportData();
      const entity = data[race]?.[entityType]?.[key];

      if (!entity) {
        showNotification('Entity not found', 'error');
        return;
      }

      const modal = createModal('Edit Entity', `
        <div class="form-group">
          <label>Race:</label>
          <input type="text" class="form-control" value="${race}" disabled>
        </div>

        <div class="form-group">
          <label>Type:</label>
          <input type="text" class="form-control" value="${entityType}" disabled>
        </div>

        <div class="form-group">
          <label>Key:</label>
          <input type="text" class="form-control" value="${key}" disabled>
        </div>

        <div class="form-group">
          <label for="editEntityName">Name:</label>
          <input type="text" id="editEntityName" class="form-control"
                 value="${entity.name || key}">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="editEntityMineral">Minerals:</label>
            <input type="number" id="editEntityMineral" class="form-control"
                   value="${entity.cost?.mineral || 0}" min="0">
          </div>
          <div class="form-group">
            <label for="editEntityGas">Gas:</label>
            <input type="number" id="editEntityGas" class="form-control"
                   value="${entity.cost?.gas || 0}" min="0">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="editEntityTime">Build Time (s):</label>
            <input type="number" id="editEntityTime" class="form-control"
                   value="${entity.time || 0}" min="0">
          </div>
          <div class="form-group">
            <label for="editEntitySupply">Supply:</label>
            <input type="number" id="editEntitySupply" class="form-control"
                   value="${entity.supply?.required || 0}" min="0">
          </div>
        </div>

        <div class="form-group">
          <label for="editEntityRequires">Requirements (comma-separated):</label>
          <input type="text" id="editEntityRequires" class="form-control"
                 value="${entity.tech_tree?.requires?.join(', ') || ''}">
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" id="cancelBtn">Cancel</button>
          <button class="btn-primary" id="saveBtn">Save Changes</button>
        </div>
      `, 'large');

      const saveBtn = modal.querySelector('#saveBtn');
      const cancelBtn = modal.querySelector('#cancelBtn');

      saveBtn.addEventListener('click', async () => {
        const updatedEntity = {
          name: modal.querySelector('#editEntityName').value.trim(),
          cost: {
            mineral: parseInt(modal.querySelector('#editEntityMineral').value) || 0,
            gas: parseInt(modal.querySelector('#editEntityGas').value) || 0
          },
          time: parseInt(modal.querySelector('#editEntityTime').value) || 0,
          supply: {
            required: parseInt(modal.querySelector('#editEntitySupply').value) || 0
          },
          tech_tree: {
            requires: modal.querySelector('#editEntityRequires').value
              .split(',')
              .map(r => r.trim())
              .filter(r => r)
          }
        };

        modal.remove();
        await handleUpdateEntity(race, entityType, key, updatedEntity);
      });

      cancelBtn.addEventListener('click', () => modal.remove());
    } catch (error) {
      showNotification(error.message || 'Failed to load entity', 'error');
    }
  }

  /**
   * Handle entity update
   */
  async function handleUpdateEntity(race, entityType, key, entityData) {
    try {
      setEnhancedProgress(true, 'Updating entity...');

      await dataImporter.updateEntity(race, entityType, key, entityData);

      setEnhancedProgress(false);
      showNotification('Entity updated successfully', 'success');
      updateDataStats();
      updateHistory();
    } catch (error) {
      setEnhancedProgress(false);
      showNotification(error.message || 'Failed to update entity', 'error');
    }
  }

  /**
   * Handle entity deletion
   */
  async function handleDeleteEntity(race, entityType, key) {
    try {
      setEnhancedProgress(true, 'Deleting entity...');

      await dataImporter.deleteEntity(race, entityType, key);

      setEnhancedProgress(false);
      showNotification('Entity deleted successfully', 'success');
      updateDataStats();
      updateHistory();
    } catch (error) {
      setEnhancedProgress(false);
      showNotification(error.message || 'Failed to delete entity', 'error');
    }
  }

  // Subscribe to importer events
  dataImporter.on('import-success', () => {
    updateDataStats();
    updateHistory();
  });

  dataImporter.on('data-cleared', () => {
    updateDataStats();
  });

  dataImporter.on('entity-updated', () => {
    updateDataStats();
  });

  dataImporter.on('entity-deleted', () => {
    updateDataStats();
  });

  dataImporter.on('data-restored', () => {
    updateDataStats();
  });

  // Initial render
  renderMainView();

  return {
    destroy: () => {
      // Cleanup
      if (container._keydownHandler) {
        document.removeEventListener('keydown', container._keydownHandler);
      }
      container.innerHTML = '';
    }
  };
}
