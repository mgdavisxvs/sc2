/**
 * Visualization Dashboard
 * Combines timeline, resource curves, and dependency graph into unified interface
 */

import { renderTimeline, renderResourceCurves } from './timeline-viz.js';
import { renderDependencyGraph, renderPrereqTree } from './dependency-viz.js';
import { SC2Simulator } from '../algorithms/simulator.js';

/**
 * Create a complete visualization dashboard
 * @param {HTMLElement} container - Main container element
 * @param {Object} buildOrder - Build order array
 * @param {string} race - Player race
 * @param {Object} database - Game database
 * @param {Object} options - Options
 */
export function createVisualizationDashboard(
  container,
  buildOrder,
  race,
  database,
  options = {}
) {
  const {
    showTimeline = true,
    showResources = true,
    showDependencies = true,
    simulatorOptions = {},
  } = options;

  // Clear container
  container.innerHTML = '';
  container.className = 'visualization-dashboard';

  // Add CSS styles
  addDashboardStyles();

  // Create sections
  const sections = {
    controls: createSection(container, 'controls', 'Visualization Controls'),
    timeline: showTimeline
      ? createSection(container, 'timeline', 'Build Order Timeline')
      : null,
    resources: showResources
      ? createSection(container, 'resources', 'Resource Curves')
      : null,
    dependencies: showDependencies
      ? createSection(container, 'dependencies', 'Tech Dependencies')
      : null,
    stats: createSection(container, 'stats', 'Build Statistics'),
  };

  // Add controls
  renderControls(sections.controls.content, {
    onToggleTimeline: () => toggleSection(sections.timeline),
    onToggleResources: () => toggleSection(sections.resources),
    onToggleDependencies: () => toggleSection(sections.dependencies),
    onExport: () => exportVisualization(sections),
    onSimulate: () => regenerateVisualization(),
  });

  // Run simulation
  const simulator = new SC2Simulator(race, simulatorOptions);
  const simulationResult = simulator.simulate(buildOrder);

  // Render visualizations
  if (sections.timeline) {
    renderTimeline(sections.timeline.content, simulationResult, {
      width: sections.timeline.content.clientWidth || 1200,
    });
  }

  if (sections.resources) {
    renderResourceCurves(sections.resources.content, simulationResult, {
      width: sections.resources.content.clientWidth || 1200,
    });
  }

  if (sections.dependencies) {
    renderDependencyGraph(
      sections.dependencies.content,
      buildOrder,
      database,
      {
        width: sections.dependencies.content.clientWidth || 800,
      }
    );
  }

  // Render statistics
  renderStatistics(sections.stats.content, simulationResult, buildOrder);

  return {
    simulator,
    simulationResult,
    sections,
    refresh: () => regenerateVisualization(),
  };

  function regenerateVisualization() {
    createVisualizationDashboard(container, buildOrder, race, database, options);
  }
}

/**
 * Create a dashboard section
 */
function createSection(container, id, title) {
  const section = document.createElement('div');
  section.className = 'viz-section';
  section.id = `viz-${id}`;

  const header = document.createElement('div');
  header.className = 'viz-section-header';

  const titleEl = document.createElement('h3');
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'viz-toggle-btn';
  toggleBtn.textContent = '−';
  toggleBtn.onclick = () => toggleSection(section);
  header.appendChild(toggleBtn);

  const content = document.createElement('div');
  content.className = 'viz-section-content';

  section.appendChild(header);
  section.appendChild(content);
  container.appendChild(section);

  return { section, header, content, toggleBtn };
}

/**
 * Toggle section visibility
 */
function toggleSection(sectionObj) {
  if (!sectionObj) return;

  const content = sectionObj.content;
  const btn = sectionObj.toggleBtn;

  if (content.style.display === 'none') {
    content.style.display = 'block';
    btn.textContent = '−';
  } else {
    content.style.display = 'none';
    btn.textContent = '+';
  }
}

/**
 * Render control buttons
 */
function renderControls(container, callbacks) {
  const controlBar = document.createElement('div');
  controlBar.className = 'viz-control-bar';

  const buttons = [
    { label: 'Toggle Timeline', callback: callbacks.onToggleTimeline },
    { label: 'Toggle Resources', callback: callbacks.onToggleResources },
    { label: 'Toggle Dependencies', callback: callbacks.onToggleDependencies },
    { label: '📥 Export PNG', callback: callbacks.onExport },
    { label: '🔄 Re-simulate', callback: callbacks.onSimulate },
  ];

  buttons.forEach(({ label, callback }) => {
    const btn = document.createElement('button');
    btn.className = 'viz-control-btn';
    btn.textContent = label;
    btn.onclick = callback;
    controlBar.appendChild(btn);
  });

  container.appendChild(controlBar);
}

/**
 * Render build statistics
 */
function renderStatistics(container, simulationResult, buildOrder) {
  const { completionTime, stats, timeline } = simulationResult;

  const statsHtml = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Time</div>
        <div class="stat-value">${completionTime.toFixed(1)}s</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Total Actions</div>
        <div class="stat-value">${buildOrder.length}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Units Built</div>
        <div class="stat-value">${
          buildOrder.filter((a) => a.kind === 'unit').length
        }</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Buildings</div>
        <div class="stat-value">${
          buildOrder.filter((a) => a.kind === 'building').length
        }</div>
      </div>

      <div class="stat-card ${stats.supplyBlocks?.length > 0 ? 'stat-warning' : ''}">
        <div class="stat-label">Supply Blocks</div>
        <div class="stat-value">${stats.supplyBlocks?.length || 0}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Avg Build Time</div>
        <div class="stat-value">${
          (
            buildOrder.reduce((sum, a) => sum + (a.buildtime || 0), 0) /
            buildOrder.length
          ).toFixed(1)
        }s</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Total Minerals</div>
        <div class="stat-value">${buildOrder.reduce(
          (sum, a) => sum + (a.mineral || 0),
          0
        )}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Total Gas</div>
        <div class="stat-value">${buildOrder.reduce(
          (sum, a) => sum + (a.gas || 0),
          0
        )}</div>
      </div>
    </div>

    ${
      stats.supplyBlocks && stats.supplyBlocks.length > 0
        ? `
      <div class="supply-blocks-section">
        <h4>⚠️ Supply Blocks Detected:</h4>
        <ul class="supply-blocks-list">
          ${stats.supplyBlocks
            .map(
              (block) =>
                `<li>At ${block.time.toFixed(1)}s: ${
                  block.action
                } blocked (${block.supply} supply used)</li>`
            )
            .join('')}
        </ul>
      </div>
    `
        : '<div class="stat-success">✓ No supply blocks!</div>'
    }
  `;

  container.innerHTML = statsHtml;
}

/**
 * Export visualization as image
 */
function exportVisualization(sections) {
  alert('Export functionality requires html2canvas library.\nImplement PNG export here.');
  // TODO: Use html2canvas or similar to export visualizations
}

/**
 * Add dashboard CSS styles
 */
function addDashboardStyles() {
  if (document.getElementById('viz-dashboard-styles')) return;

  const style = document.createElement('style');
  style.id = 'viz-dashboard-styles';
  style.textContent = `
    .visualization-dashboard {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }

    .viz-section {
      background: white;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .viz-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .viz-section-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .viz-toggle-btn {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 5px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
    }

    .viz-toggle-btn:hover {
      background: rgba(255,255,255,0.3);
    }

    .viz-section-content {
      padding: 20px;
      overflow-x: auto;
    }

    .viz-control-bar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .viz-control-btn {
      padding: 10px 20px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .viz-control-btn:hover {
      background: #5568d3;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }

    .stat-warning {
      background: linear-gradient(135deg, #f44336 0%, #e91e63 100%);
    }

    .stat-success {
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      color: white;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      font-size: 16px;
      font-weight: 500;
    }

    .stat-label {
      font-size: 12px;
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: bold;
    }

    .supply-blocks-section {
      margin-top: 20px;
      padding: 15px;
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      border-radius: 4px;
    }

    .supply-blocks-section h4 {
      margin: 0 0 10px 0;
      color: #f57c00;
    }

    .supply-blocks-list {
      margin: 0;
      padding-left: 20px;
      color: #666;
    }

    .supply-blocks-list li {
      margin: 5px 0;
    }

    /* D3 visualization styles */
    .timeline-viz .bar-label {
      font-family: monospace;
    }

    .timeline-tooltip {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .dependency-graph .node circle {
      cursor: pointer;
      transition: all 0.2s;
    }

    .dependency-graph .node:hover circle {
      filter: brightness(1.2);
    }

    .grid line {
      stroke: #e0e0e0;
    }

    .x-axis, .y-axis {
      font-size: 12px;
    }

    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .viz-control-bar {
        flex-direction: column;
      }

      .viz-control-btn {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
}

export default createVisualizationDashboard;
