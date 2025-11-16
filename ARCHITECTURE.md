# SC2 Build Lab - Technical Architecture

## 🏗️ System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Cards   │  │Tech Tree │  │  MRTS    │  │ Compare  │       │
│  │  Grid    │  │  Modal   │  │  Modal   │  │  Modal   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │      STATE MANAGER        │
        │   (Reactive Observable)   │
        └─────────────┬─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │    ALGORITHM LAYER        │
        │  ┌────────┐  ┌─────────┐  │
        │  │ MRTS   │  │ Pareto  │  │
        │  ├────────┤  ├─────────┤  │
        │  │ Graph  │  │Optimizer│  │
        │  ├────────┤  ├─────────┤  │
        │  │Compare │  │TechTree │  │
        │  └────────┘  └─────────┘  │
        └─────────────┬─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │       DATA LAYER          │
        │  ┌──────────────────────┐ │
        │  │   IndexedDB          │ │
        │  │  (Build Library)     │ │
        │  └──────────────────────┘ │
        │  ┌──────────────────────┐ │
        │  │   In-Memory Cache    │ │
        │  │  (Normalized Data)   │ │
        │  └──────────────────────┘ │
        └───────────────────────────┘
```

---

## 📁 Module Organization

### Core Modules

#### 1. `src/main.js` - Application Entry Point

**Purpose:** Bootstrap application, wire up event handlers

**Key Responsibilities:**
```javascript
// 1. Initialize theme
initTheme();

// 2. Load data (embedded or file)
const processed = loadEmbeddedData('sc2-data');
loadData(processed);

// 3. Setup event handlers
initEventHandlers();

// 4. Initial render
refreshDisplay();
```

**Event Handlers:**
- File input (drag & drop, file picker)
- Race tabs (protoss/terran/zerg)
- Section tabs (units/buildings/upgrades)
- Build controls (save, load, visualize, MRTS, compare)
- Tech tree (open/close)
- Auto build
- Export/import

**Data Flow:**
```
User Action → Event Handler → State Update → UI Re-render
```

---

#### 2. `src/core/state.js` - State Management

**Pattern:** Reactive Observable State

**Structure:**
```javascript
export const state = {
  // Data
  data: null,           // Raw JSON data
  norm: null,           // Normalized data
  race: 'protoss',      // Selected race
  section: 'units',     // Selected section

  // Build Order
  build: [],            // Current build items

  // UI State
  search: '',           // Search query
  sortKey: '',          // Sort criterion
  imageRoot: '',        // Image path prefix
  brokenImages: new Set(),

  // Methods
  addToBuild(item, locked, missing) { ... },
  removeBuild(index) { ... },
  clearBuild() { ... },
  set(key, value) { ... }
};
```

**Reactive Updates:**
```javascript
set(key, value) {
  this[key] = value;

  // Notify observers
  document.querySelectorAll('.section-tab').forEach(tab => {
    if (tab.dataset.section === value) {
      tab.classList.add('active');
    }
  });
}
```

---

#### 3. `src/core/logger.js` - Logging Utility

**Levels:** Info, Warn, Error

**Usage:**
```javascript
logger.info('Data loaded successfully');
logger.warn('Image not found:', path);
logger.error('Failed to save:', err);
```

**Production Mode:** Suppress non-critical logs

---

### Data Layer

#### 4. `src/data/parser.js` - Data Normalization

**Purpose:** Transform raw JSON into consistent structure

**Flow:**
```
Raw sc2units.json
  ↓
parseAndNormalize(json)
  ↓
{
  protoss: {
    units: { zealot: {...}, stalker: {...} },
    buildings: { gateway: {...}, nexus: {...} },
    upgrades: { charge: {...}, blink: {...} }
  },
  terran: { ... },
  zerg: { ... }
}
```

**Normalization Steps:**
1. Extract race-specific data
2. Categorize into units/buildings/upgrades
3. Flatten nested structures
4. Add computed fields (tech tier, dependencies)
5. Index by name for fast lookup

**Example Transform:**
```javascript
// Input (raw)
{
  "units": [
    {
      "name": "Zealot",
      "cost": { "mineral": 100, "gas": 0 },
      "tech_tree": { "requires": ["Gateway"] }
    }
  ]
}

// Output (normalized)
{
  protoss: {
    units: {
      zealot: {
        name: "Zealot",
        kind: "unit",
        mineral: 100,
        gas: 0,
        prerequisites: ["Gateway"],
        tier: 1
      }
    }
  }
}
```

---

#### 5. `src/data/query.js` - Data Queries

**Class:** `GameDatabase`

**Indices:**
```javascript
class GameDatabase {
  constructor(normalizedData) {
    this.data = normalizedData;
    this.byName = new Map();  // Fast name lookup
    this.byTier = new Map();  // Group by tech tier
    this.byKind = new Map();  // Group by kind (unit/building/upgrade)
  }
}
```

**Methods:**
```javascript
findByName(name)          // O(1) lookup
getAllOfKind(race, kind)  // Get all units/buildings/upgrades
getByTier(race, tier)     // Get items at tech tier N
```

**Usage:**
```javascript
const db = new GameDatabase(state.norm);
const stalker = db.findByName('Stalker');
const protossUnits = db.getAllOfKind('protoss', 'unit');
```

---

#### 6. `src/data/build-database.js` - IndexedDB Wrapper

**Purpose:** Persist builds to browser storage

**Schema:**
```javascript
// Database: sc2-builds (v1)
// Store: builds

Build {
  id: string,              // UUID
  name: string,            // User-provided name
  description: string,     // Optional description
  race: string,            // protoss/terran/zerg
  tags: string[],          // ['rush', 'pvz', ...]
  buildOrder: Item[],      // Full build order
  stats: {                 // Computed statistics
    totalMinerals: number,
    totalGas: number,
    totalSupply: number,
    units: number,
    buildings: number,
    upgrades: number
  },
  favorited: boolean,      // Star status
  createdAt: Date,
  updatedAt: Date
}
```

**API:**
```javascript
class BuildDatabase {
  async init()                          // Open DB connection
  async saveBuild(buildOrder, metadata) // Create/update build
  async getBuild(id)                    // Retrieve by ID
  async getAllBuilds(filters)           // Query with filters
  async deleteBuild(id)                 // Remove build
  async toggleFavorite(id)              // Toggle star
  async getAllTags()                    // Get unique tags
  async getStats()                      // Aggregate statistics
  async createBackup()                  // Export all builds
  async restoreBackup(data)             // Import builds
}
```

**Filters:**
```javascript
getAllBuilds({
  search: 'stalker',      // Text search
  race: 'protoss',        // Filter by race
  favorited: true,        // Only starred
  sortBy: 'updatedAt',    // Sort field
  sortOrder: 'desc'       // Sort direction
})
```

---

### Algorithm Layer

#### 7. `src/algorithms/build-order.js` - Prerequisite Checking

**Main Function:**
```javascript
findMissingPrereqs(item, currentBuild, race) {
  const built = new Set(currentBuild.map(i => i.name));
  const required = item.prerequisites || [];

  return required.filter(prereq => !built.has(prereq));
}
```

**Usage:**
```javascript
const missing = findMissingPrereqs(stalker, state.build, 'protoss');
// Returns: ['Gateway', 'Cybernetics Core'] if not yet built

if (missing.length > 0) {
  // Show warning or auto-complete
}
```

---

#### 8. `src/algorithms/graph.js` - Graph Algorithms

**Functions:**

**Topological Sort:**
```javascript
topologicalSort(nodes, edges) {
  // Kahn's algorithm
  // Returns: [tier0, tier1, tier2, ...]
}
```

**Cycle Detection:**
```javascript
detectCycles(graph) {
  // DFS with recursion stack
  // Returns: { hasCycles: boolean, cycles: [...] }
}
```

**Transitive Closure:**
```javascript
computeTransitiveClosure(graph) {
  // Floyd-Warshall
  // Returns: All-pairs reachability
}
```

**Usage:**
```javascript
const techTree = {
  nodes: [gateway, cyber, twilight],
  edges: [
    { from: 'gateway', to: 'cyber' },
    { from: 'cyber', to: 'twilight' }
  ]
};

const sorted = topologicalSort(techTree.nodes, techTree.edges);
// Returns: [gateway, cyber, twilight]
```

---

#### 9. `src/algorithms/mrts.js` - Economic Analysis

**Core Algorithm:**

```javascript
calculateMRTS(builds, input1, input2) {
  // 1. Sort builds by input1
  const sorted = builds.sort((a, b) =>
    a[input1] - b[input1]
  );

  // 2. Calculate MRTS between adjacent points
  const mrtsPoints = [];
  for (let i = 1; i < sorted.length; i++) {
    const delta1 = sorted[i][input1] - sorted[i-1][input1];
    const delta2 = sorted[i][input2] - sorted[i-1][input2];

    const mrts = -delta2 / delta1;  // Key formula!
    mrtsPoints.push({ mrts, ... });
  }

  // 3. Analyze for diminishing returns
  const diminishing = checkDiminishingReturns(mrtsPoints);

  return {
    points: mrtsPoints,
    averageMRTS: mean(mrtsPoints),
    diminishingReturns: diminishing
  };
}
```

**Economic Theory:**

```
Isoquant: Curve of constant output

Q = f(M, G)  where M=minerals, G=gas

MRTS = -(∂Q/∂G) / (∂Q/∂M) = slope of isoquant

Optimality: MRTS = P_G / P_M
```

**Example:**
```javascript
const builds = [
  { name: 'Zealots', minerals: 1000, gas: 0, supply: 40 },
  { name: 'Stalkers', minerals: 875, gas: 350, supply: 40 },
  { name: 'Immortals', minerals: 800, gas: 400, supply: 40 }
];

const analysis = calculateMRTS(builds, 'minerals', 'gas');
// analysis.averageMRTS = 2.14
// Interpretation: 1 mineral → 2.14 gas substitution rate
```

---

#### 10. `src/algorithms/build-comparison.js` - Comparison Engine

**Main Function:**
```javascript
compareBuilds(builds) {
  return {
    builds: builds.map(calculateBuildMetrics),
    mrts: calculateMRTSComparison(builds),
    diff: compareBuildSequences(builds),
    efficiency: calculateEfficiencyComparison(builds),
    recommendations: generateRecommendations(builds),
    timings: compareTimings(builds)
  };
}
```

**Sub-Algorithms:**

**Build Metrics:**
```javascript
calculateBuildMetrics(build) {
  return {
    totalMinerals: sum(build, 'mineral'),
    totalGas: sum(build, 'gas'),
    mineralGasRatio: totalMinerals / totalGas,
    supplyPerCost: totalSupply / (totalMinerals + totalGas),
    ...
  };
}
```

**Sequence Diff:**
```javascript
compareBuildSequences(builds) {
  const differences = [];
  const maxLength = max(builds.map(b => b.length));

  for (let i = 0; i < maxLength; i++) {
    const items = builds.map(b => b[i]);
    const names = items.map(item => item?.name);
    const unique = new Set(names);

    if (unique.size > 1) {
      differences.push({ step: i, items });
    }
  }

  return { differences, similarity: ... };
}
```

**Efficiency Rankings:**
```javascript
calculateEfficiencyComparison(builds) {
  const metrics = [
    'costEfficiency',
    'mineralEfficiency',
    'gasEfficiency',
    'economicPower',
    'armyValue',
    'buildSpeed'
  ];

  const rankings = {};
  metrics.forEach(metric => {
    rankings[metric] = rankByMetric(builds, metric);
  });

  // Calculate overall score
  const overallScores = builds.map(b => {
    let score = 0;
    Object.values(rankings).forEach(ranking => {
      const rank = ranking.findIndex(r => r.id === b.id);
      score += (builds.length - rank);  // Lower rank = more points
    });
    return { build: b, score };
  });

  return { rankings, overallScores };
}
```

---

#### 11. `src/algorithms/tech-tree.js` - Tech Tree Graph

**Graph Construction:**
```javascript
buildTechTree(gameData, race) {
  const nodes = [];
  const edges = [];

  // 1. Collect all entities
  ['units', 'buildings', 'upgrades'].forEach(category => {
    Object.entries(gameData[race][category]).forEach(([id, item]) => {
      nodes.push({
        id: `${category}-${id}`,
        name: item.name,
        prerequisites: item.tech_tree?.requires || []
      });
    });
  });

  // 2. Build edges from prerequisites
  nodes.forEach(node => {
    node.prerequisites.forEach(prereqName => {
      const prereqNode = nodes.find(n => n.name === prereqName);
      if (prereqNode) {
        edges.push({
          from: prereqNode.id,
          to: node.id
        });
      }
    });
  });

  // 3. Calculate tiers (topological levels)
  const tiers = calculateTechTiers(nodes, edges);

  return { nodes, edges, tiers };
}
```

**Tier Calculation:**
```javascript
calculateTechTiers(nodes, edges) {
  // BFS from nodes with no prerequisites
  const tiers = {};
  const tierMap = new Map();

  // Tier 0: No prerequisites
  const tier0 = nodes.filter(n => n.prerequisites.length === 0);
  tier0.forEach(n => tierMap.set(n.id, 0));
  tiers[0] = tier0;

  // Tier N: All prerequisites in tier < N
  let currentTier = 0;
  let changed = true;

  while (changed) {
    changed = false;
    currentTier++;
    tiers[currentTier] = [];

    nodes.forEach(node => {
      if (tierMap.has(node.id)) return;  // Already assigned

      const prereqTiers = node.prerequisites
        .map(p => tierMap.get(nodes.find(n => n.name === p).id))
        .filter(t => t !== undefined);

      if (prereqTiers.length === node.prerequisites.length) {
        // All prereqs assigned
        const maxPrereqTier = Math.max(...prereqTiers);
        tierMap.set(node.id, maxPrereqTier + 1);
        tiers[maxPrereqTier + 1].push(node);
        changed = true;
      }
    });
  }

  return tiers;
}
```

**Auto-Complete Path:**
```javascript
getAutoCompletePath(techTree, targetNodeId, currentBuild) {
  const builtNames = new Set(currentBuild.map(i => i.name));
  const target = techTree.nodeMap.get(targetNodeId);

  // BFS to find shortest path
  const queue = [[target]];
  const visited = new Set();

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[0];

    if (visited.has(node.id)) continue;
    visited.add(node.id);

    const missing = node.prerequisites.filter(p => !builtNames.has(p));

    if (missing.length === 0) {
      return path.reverse();  // Found complete path!
    }

    // Add prerequisite paths to queue
    missing.forEach(prereqName => {
      const prereqNode = techTree.nodes.find(n => n.name === prereqName);
      if (prereqNode) {
        queue.push([prereqNode, ...path]);
      }
    });
  }

  return [];
}
```

---

### UI Layer

#### 12. `src/ui/build.js` - Build List Rendering

**Main Function:**
```javascript
export function renderBuildList(animate = false) {
  const list = document.getElementById('buildList');
  list.innerHTML = '';

  state.build.forEach((item, index) => {
    const li = createBuildItem(item, index);
    if (animate) li.classList.add('fade-in');
    list.appendChild(li);
  });

  // Enable drag & drop reordering
  initDragAndDrop(list);
}
```

**Drag & Drop:**
```javascript
function initDragAndDrop(list) {
  let draggedIndex = null;

  list.addEventListener('dragstart', e => {
    draggedIndex = parseInt(e.target.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('drop', e => {
    e.preventDefault();
    const dropIndex = parseInt(e.target.closest('li').dataset.index);

    // Reorder array
    const item = state.build[draggedIndex];
    state.build.splice(draggedIndex, 1);
    state.build.splice(dropIndex, 0, item);

    renderBuildList(true);
  });
}
```

---

#### 13. `src/ui/charts.js` - D3 Visualizations

**Supply Chart:**
```javascript
export function renderCharts() {
  renderSupplyChart();
  renderResourceChart();
}

function renderSupplyChart() {
  const data = state.build.map((item, i) => ({
    step: i + 1,
    supply: state.build.slice(0, i + 1)
      .reduce((sum, it) => sum + (it.supply || 0), 0)
  }));

  const svg = d3.select('#chartSupply');
  const width = svg.node().clientWidth;
  const height = svg.node().clientHeight;

  const x = d3.scaleLinear()
    .domain([0, data.length])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.supply)])
    .range([height, 0]);

  const line = d3.line()
    .x(d => x(d.step))
    .y(d => y(d.supply));

  svg.selectAll('*').remove();
  svg.append('path')
    .datum(data)
    .attr('d', line)
    .attr('stroke', '#3b82f6')
    .attr('fill', 'none');
}
```

---

#### 14. `src/ui/tech-tree.js` - Tech Tree Visualization

**Layout:**
```javascript
function renderHierarchicalTree(canvas, techTree, nodes, availability) {
  // Group by tier
  const nodesByTier = {};
  Object.entries(techTree.tiers).forEach(([tier, tierNodes]) => {
    nodesByTier[tier] = tierNodes.filter(n =>
      nodes.some(node => node.id === n.id)
    );
  });

  // Create columns
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '40px';

  Object.keys(nodesByTier).forEach(tier => {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.gap = '12px';

    // Tier header
    const header = document.createElement('div');
    header.textContent = `Tier ${tier}`;
    column.appendChild(header);

    // Nodes
    nodesByTier[tier].forEach(node => {
      const nodeEl = createTechTreeNode(node, availability.get(node.id));
      column.appendChild(nodeEl);
    });

    container.appendChild(column);
  });

  canvas.appendChild(container);
}
```

**Node Element:**
```javascript
function createTechTreeNode(node, availability) {
  const nodeEl = document.createElement('div');

  // Color by status
  const colors = {
    available: { bg: '#d1fae5', border: '#10b981' },
    built: { bg: '#dbeafe', border: '#3b82f6' },
    locked: { bg: '#f1f5f9', border: '#cbd5e1' }
  };

  const { bg, border } = colors[availability.status];

  nodeEl.style.cssText = `
    padding: 12px;
    background: ${bg};
    border: 2px solid ${border};
    border-radius: 8px;
    cursor: ${availability.canBuild ? 'pointer' : 'not-allowed'};
  `;

  nodeEl.innerHTML = `
    <div style="font-weight: 600;">${node.name}</div>
    <div style="font-size: 11px;">${node.mineral}m ${node.gas}g</div>
  `;

  // Click handler
  nodeEl.addEventListener('click', (e) => {
    if (e.shiftKey || availability.status === 'locked') {
      // Auto-complete
      const path = getAutoCompletePath(techTree, node.id, state.build);
      path.forEach(n => onAddNode(n));
    } else if (availability.canBuild) {
      onAddNode(node);
    }
  });

  return nodeEl;
}
```

---

## 🔄 Data Flow Examples

### Example 1: Adding Unit to Build

```
1. User clicks "Add" on Stalker card

2. Event handler in main.js:
   tryAddToBuild(stalker)

3. Check prerequisites:
   const missing = findMissingPrereqs(stalker, state.build, 'protoss')
   // Returns: ['Gateway', 'Cybernetics Core']

4. Update state:
   state.addToBuild(stalker, locked=true, missing)

5. Re-render UI:
   renderBuildList()    // Update list
   renderCharts()       // Update charts

6. User sees:
   - Stalker in build list (yellow/locked)
   - Warning: "Missing: Gateway, Cybernetics Core"
   - Charts update with new totals
```

---

### Example 2: Tech Tree Auto-Complete

```
1. User Shift+clicks "Colossus" (gray/locked)

2. Event handler in tech-tree.js:
   onNodeClick(colossus, shiftKey=true)

3. Find prerequisite path:
   const path = getAutoCompletePath(techTree, 'colossus', state.build)
   // BFS search finds: [Gateway, Cyber, Robo, RoboBay, Colossus]

4. Add each node sequentially:
   path.forEach(node => {
     state.addToBuild(node, locked=false, [])
   })

5. Update tech tree:
   techTreeController.update(state.build)

6. Re-render with new availability:
   - Gateway: green → blue (built)
   - Cyber: gray → green (now available) → blue (built)
   - Robo: gray → green → blue
   - RoboBay: gray → green → blue
   - Colossus: gray → green → blue

7. User sees 5 items added to build in correct order!
```

---

### Example 3: Build Comparison

```
1. User opens Library, selects 3 builds with checkboxes

2. Clicks "⚖️ Compare (3)" button

3. Event handler fetches full build data:
   const builds = [];
   for (const id of selectedBuilds) {
     builds.push(await db.getBuild(id));
   }

4. Run comparison algorithm:
   const analysis = compareBuilds(builds)

5. Analysis computes:
   - Build metrics (totals, ratios)
   - MRTS between builds
   - Sequence differences
   - Efficiency rankings (6 metrics)
   - Timing comparisons (3:00, 4:00, 5:00)
   - Recommendations

6. Render comparison UI:
   createComparisonDashboard(container, builds)

7. User sees 5 tabs with comprehensive analysis:
   - Overview: Winner, similarity, recommendations
   - Side-by-Side: Full table comparison
   - Differences: Divergence points
   - Efficiency: Rankings with medals
   - Timings: Army strength at key times
```

---

## 🧪 Testing Strategy

### Unit Tests (Algorithm Layer)

```javascript
// Test MRTS calculation
test('calculateMRTS - mineral-gas substitution', () => {
  const builds = [
    { minerals: 1000, gas: 0, supply: 40 },
    { minerals: 875, gas: 350, supply: 40 }
  ];

  const result = calculateMRTS(builds, 'minerals', 'gas');

  expect(result.averageMRTS).toBeCloseTo(2.8);
});

// Test tech tree pathfinding
test('getAutoCompletePath - finds shortest path', () => {
  const techTree = buildTechTree(testData, 'protoss');
  const path = getAutoCompletePath(techTree, 'colossus', []);

  expect(path.map(n => n.name)).toEqual([
    'Gateway',
    'Cybernetics Core',
    'Robotics Facility',
    'Robotics Bay',
    'Colossus'
  ]);
});
```

### Integration Tests (Data Flow)

```javascript
test('Full workflow - add item to build', async () => {
  // 1. Load data
  const data = await loadTestData();
  loadData(data);

  // 2. Select race
  state.set('race', 'protoss');

  // 3. Add item
  const stalker = db.findByName('Stalker');
  tryAddToBuild(stalker);

  // 4. Verify state
  expect(state.build).toHaveLength(1);
  expect(state.build[0].name).toBe('Stalker');

  // 5. Verify UI
  const buildList = document.getElementById('buildList');
  expect(buildList.children).toHaveLength(1);
});
```

---

## 📊 Performance Optimizations

### 1. Lazy Rendering

Only render visible items:
```javascript
// Instead of rendering all 500 cards
cards.forEach(card => render(card));

// Render visible + buffer
const visible = cards.slice(scrollPos, scrollPos + 50);
visible.forEach(card => render(card));
```

### 2. Memoization

Cache expensive computations:
```javascript
const memoizedMRTS = memoize(calculateMRTS);

// First call: computes
const result1 = memoizedMRTS(builds);  // 50ms

// Second call with same input: cached
const result2 = memoizedMRTS(builds);  // <1ms
```

### 3. Debouncing

Delay expensive operations:
```javascript
searchInput.addEventListener('input', debounce(() => {
  refreshDisplay();  // Only called after user stops typing
}, 150));
```

### 4. IndexedDB Indexing

Fast queries with indices:
```javascript
const store = db.createObjectStore('builds', { keyPath: 'id' });
store.createIndex('race', 'race', { unique: false });
store.createIndex('favorited', 'favorited', { unique: false });
store.createIndex('updatedAt', 'updatedAt', { unique: false });

// Fast query
const index = store.index('race');
const builds = index.getAll('protoss');  // Uses index, not full scan
```

---

## 🔒 Security Considerations

### 1. Input Validation

```javascript
function saveBuild(buildOrder, metadata) {
  // Validate inputs
  if (!Array.isArray(buildOrder)) {
    throw new Error('Build order must be array');
  }

  if (metadata.name.length > 100) {
    throw new Error('Name too long');
  }

  // Sanitize HTML
  metadata.name = escapeHtml(metadata.name);
  metadata.description = escapeHtml(metadata.description);
}
```

### 2. XSS Prevention

```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Usage
card.innerHTML = `<h4>${escapeHtml(build.name)}</h4>`;
```

### 3. IndexedDB Transactions

```javascript
async function saveBuild(data) {
  const tx = db.transaction('builds', 'readwrite');

  try {
    await tx.objectStore('builds').put(data);
    await tx.complete;
  } catch (err) {
    tx.abort();
    throw err;
  }
}
```

---

## 🚀 Deployment

### Build Process

```bash
# No build required - vanilla ES6 modules
# Serve directly with static file server

# Development
python -m http.server 8000

# Production
# Deploy to static host (Netlify, Vercel, GitHub Pages)
```

### Browser Compatibility

**Minimum Requirements:**
- ES6 modules support
- IndexedDB
- Drag & Drop API
- Fetch API

**Supported Browsers:**
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

---

## 📚 Further Reading

- **MRTS_ANALYSIS.md** - Economic theory deep dive
- **VISUALIZATION_FEATURES.md** - Visualization details
- **USER_GUIDE.md** - Complete user manual
- **ANALYSIS.md** - Architecture decisions

---

**Architecture Version:** 2.0
**Last Updated:** 2025-11-16
