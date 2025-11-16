# SC2 Build Lab v2.0 - User Guide

## 📖 Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Build Creation](#basic-build-creation)
3. [Interactive Tech Tree](#interactive-tech-tree)
4. [Build Library Management](#build-library-management)
5. [Build Comparison](#build-comparison)
6. [MRTS Economic Analysis](#mrts-economic-analysis)
7. [Advanced Features](#advanced-features)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Tips & Best Practices](#tips--best-practices)
10. [Technical Architecture](#technical-architecture)

---

## Getting Started

### Step 1: Load Game Data

**What you need:** `sc2units.json` file containing StarCraft 2 unit/building data

**Three ways to load:**

1. **Drag & Drop** (Easiest)
   - Drag `sc2units.json` file anywhere on the page
   - Drop overlay appears → release to load

2. **File Picker**
   - Click "Load JSON" button in header
   - Select `sc2units.json` from file browser

3. **Embedded Data** (Advanced)
   - Place JSON in `<script id="sc2-data">` tag
   - Auto-loads on page load

**What happens:**
```
Loading JSON... → Parsing data → Building database → Ready!
```

Status message shows: "Game data loaded ✓"

---

### Step 2: Select Your Race

Click one of the race tabs at the top:

- **🔵 Protoss** - Gateway, Robotics, Stargate units
- **🔴 Terran** - Barracks, Factory, Starport units
- **🟣 Zerg** - Spawning Pool, Roach Warren, Spire units

**What changes:**
- Unit cards update to show selected race
- Color scheme changes
- Build templates adjust
- Tech tree rebuilds for race

---

## Basic Build Creation

### Method 1: Manual Card Selection

**Step-by-step:**

1. **Browse Units/Buildings/Upgrades**
   - Click tabs: `Units` | `Buildings` | `Upgrades`
   - Scroll through available cards

2. **Search** (Optional)
   - Type in search box: "stalker", "marine", etc.
   - Cards filter in real-time

3. **Sort** (Optional)
   - Dropdown: Sort by Mineral/Gas/Supply/Build time
   - Helps find cheapest/fastest options

4. **Add to Build**
   - Click "Add" button on any card
   - Item appears in Build Order panel (right side)

5. **Reorder** (Optional)
   - Drag items in build list to reorder
   - Visual feedback during drag

6. **View Stats**
   - Total Minerals/Gas/Supply shown at bottom
   - Charts update automatically

**Visual Indicators:**

```
Card Colors:
- Green border = Can build (prerequisites met)
- Red/Yellow = Missing prerequisites
- Blue badge = Already in build
```

---

### Method 2: Interactive Tech Tree 🌳 (RECOMMENDED!)

**Why use this:** Auto-completes entire tech paths - no more missing prerequisites!

**Step-by-step:**

1. **Open Tech Tree**
   - Click "🌳 Tech Tree" button in header (purple-pink)
   - Full-screen modal opens

2. **Understand the Layout**
   ```
   Tier 0        Tier 1         Tier 2          Tier 3
   -------       -------        -------         -------
   Nexus    →    Gateway   →    Cyber Core  →   Twilight
                 Forge          Stargate        Templar Archives
   ```

3. **Color Coding**
   - 🟢 **Green** = Available (all prerequisites met)
   - 🔵 **Blue** = Already in your build
   - ⚪ **Gray** = Locked (missing prerequisites)

4. **Add Single Unit**
   - Click any GREEN node
   - Added to build instantly

5. **Auto-Complete Path** (THE MAGIC!)
   - **Shift+Click** any GRAY (locked) node
   - OR: Click locked node with "Auto-Complete" enabled
   - **Entire prerequisite chain added automatically!**

**Example:**

```
Want: Colossus (Tier 3, locked)
Shift+Click Colossus
Result: Auto-adds these in order:
  1. Gateway
  2. Cybernetics Core
  3. Robotics Facility
  4. Robotics Bay
  5. Colossus ✓
```

6. **Search in Tech Tree**
   - Type unit name in search box
   - Tree filters to matching nodes
   - Still shows tier structure

7. **Filter by Category**
   - Dropdown: All | Buildings | Units | Upgrades
   - Focuses tech tree on specific type

8. **Monitor Progress**
   - Top stats show: "✓ 15 available • ● 8 built • ⊗ 42 locked"
   - Updates as you add items

---

### Method 3: Auto Build Templates

**Quick start for common builds:**

1. Click "Auto Build" button in header
2. Loads race-specific template automatically
3. Example templates:
   - **Protoss**: Nexus, Gateway, Zealot, Pylon
   - **Terran**: Command Center, Barracks, Marine, SCV
   - **Zerg**: Hatchery, Spawning Pool, Drone, Zergling

---

## Build Library Management

### Saving Builds

**Step-by-step:**

1. **Create your build** (using any method above)

2. **Click "💾 Save" button** (green, in Build Order panel)

3. **Enter Build Details:**
   - **Name**: "4-Gate Rush", "1-1-1 Timing", etc.
   - **Description** (optional): "Fast Stalker pressure vs Zerg"
   - **Tags** (optional): "rush, pvz, 2-gate" (comma-separated)

4. **Confirm**
   - Build saved to IndexedDB
   - Available in library immediately

**What gets saved:**
```javascript
{
  name: "Your Build Name",
  description: "Description text",
  race: "protoss",
  tags: ["rush", "pvz"],
  buildOrder: [...], // Full item list
  stats: {
    totalMinerals: 1500,
    totalGas: 350,
    totalSupply: 45,
    units: 12,
    buildings: 8,
    upgrades: 2
  },
  createdAt: "2025-11-16T...",
  updatedAt: "2025-11-16T..."
}
```

---

### Browsing Library

**Step-by-step:**

1. **Click "📚 Library" button** (blue, in Build Order panel)

2. **Library Interface Opens:**
   ```
   [Search box] [Race filter] [Sort by] [⭐ Favorites]

   Tag filters: #rush #macro #timing

   [Grid of build cards...]
   ```

3. **Search Builds**
   - Type in search box
   - Searches: name, description, tags
   - Real-time filtering

4. **Filter by Race**
   - Dropdown: All Races | Protoss | Terran | Zerg
   - Shows only selected race

5. **Sort Builds**
   - Recently Updated (default)
   - Recently Created
   - Name (A-Z)

6. **Filter by Tags**
   - Click tag buttons above grid
   - Filter to specific strategies

7. **Favorites Filter**
   - Click "⭐ Favorites Only" button
   - Shows only starred builds

---

### Using Saved Builds

**Each build card shows:**
```
┌─────────────────────────────┐
│ Build Name            ⭐/☆  │ ← Click star to favorite
│ Protoss | 2 days ago        │
│                             │
│ Description text here...    │
│                             │
│ 25 steps | 15 units         │
│ 8 buildings | 1200m 400g    │
│                             │
│ #rush #pvz                  │ ← Tags
│                             │
│ [📂 Load] [✏️ Edit]         │
│ [📤 Export] [🗑️ Delete]     │
└─────────────────────────────┘
```

**Actions:**

1. **Load Build**
   - Click "📂 Load"
   - Clears current build
   - Loads saved build order
   - Library closes automatically

2. **Edit Build**
   - Click "✏️ Edit"
   - Dialog opens
   - Update name/description/tags
   - Save changes

3. **Export Build**
   - Click "📤 Export"
   - Downloads as JSON file
   - Share with friends or backup

4. **Delete Build**
   - Click "🗑️ Delete"
   - Confirmation dialog
   - Permanently removes

5. **Toggle Favorite**
   - Click ⭐/☆ in card header
   - Starred builds appear in favorites filter

---

### Bulk Operations

**Import Build:**
1. Click "📥 Import Build" (library header)
2. Select exported JSON file
3. Build added to library

**Export All:**
1. Click "📤 Export All" (library header)
2. Downloads backup of entire library
3. Filename: `sc2-builds-backup-{timestamp}.json`

**Clear All:**
1. Click "🗑️ Clear All" (library header)
2. ⚠️ **WARNING**: Deletes ALL builds!
3. Confirmation required
4. Cannot be undone

---

## Build Comparison

**Compare 2-4 builds side-by-side with economic analysis**

### Step-by-step:

1. **Open Library**
   - Click "📚 Library" button

2. **Select Builds to Compare**
   - **Checkbox** appears on each build card
   - Click checkboxes to select (2-4 builds)
   - "⚖️ Compare (N)" button appears when ≥2 selected

3. **Start Comparison**
   - Click "⚖️ Compare (N)" button
   - Comparison modal opens
   - Library closes

4. **Explore 5 Analysis Tabs:**

---

### Tab 1: Overview

**Shows:**
- Quick stats grid for all builds
- 🏆 **Overall efficiency winner** (based on 6 metrics)
- 🔗 **Common opening** (shared first N steps)
- 🎯 **Similarity matrix** (how similar builds are)
- 💡 **Key recommendations**

**Example:**
```
Build 1: 4-Gate Rush     Build 2: Blink Stalker
1000m 0g                 875m 350g
32 supply                28 supply

🏆 Winner: 4-Gate Rush (85% efficiency score)
🔗 Common Opening: First 8 steps shared, diverge at step 9
```

---

### Tab 2: Side-by-Side

**Shows:**
- Full step-by-step comparison table
- Each row = one step in build
- Green highlight = builds match at this step
- Totals row at bottom

**Table Structure:**
```
Step | Build 1         | Build 2         | Build 3
-----|-----------------|-----------------|----------------
1    | Pylon (100m)    | Pylon (100m)    | Pylon (100m)   ← Green
2    | Gateway (150m)  | Gateway (150m)  | Forge (150m)   ← Different
3    | Zealot (100m)   | Stalker (125m)  | Photon (150m)  ← Different
...
Total| 1000m 0g        | 875m 350g       | 900m 200g
```

---

### Tab 3: Differences

**Shows:**
- Number of common steps
- Number of differences
- Overall similarity %
- 🔀 **Divergence point** (where builds first differ)
- List of all differences with details

**Example:**
```
✓ 15 Common Steps
✗ 8 Differences
📊 65% Similarity

🔀 Builds diverge at step 9

Divergence Points:
  Step 9:
    Build 1: Twilight Council (150m 100g)
    Build 2: Robotics Facility (200m 100g)
```

---

### Tab 4: Efficiency

**Shows:**
- 6 efficiency rankings with medals:
  1. Cost Efficiency (supply per resource)
  2. Mineral Efficiency
  3. Gas Efficiency
  4. Economic Power (workers)
  5. Army Value (army supply)
  6. Build Speed (completion time)

- Overall efficiency score chart

**Example Rankings:**
```
Cost Efficiency:
  🥇 1. Build 1 - 4-Gate (2.14)
  🥈 2. Build 2 - Blink (1.98)
  🥉 3. Build 3 - Robo (1.85)

Mineral Efficiency:
  🥇 1. Build 2 - Blink (2.45)
  🥈 2. Build 1 - 4-Gate (2.31)
  ...
```

---

### Tab 5: Timings

**Shows:**
- Army strength at key timings:
  - **3:00** (early pressure)
  - **4:00** (mid-game timing)
  - **5:00** (late timing)

- Worker count at each timing
- 👑 Strongest build at each timing

**Example:**
```
3:00 Timing:
  Build 1: 12 army supply, 16 workers  👑
  Build 2: 8 army supply, 20 workers
  Build 3: 10 army supply, 18 workers

4:00 Timing:
  Build 1: 24 army supply, 20 workers
  Build 2: 18 army supply, 28 workers  👑
  Build 3: 20 army supply, 24 workers
```

**Strategic Insight:** Build 1 hits harder early, Build 2 stronger economy

---

## MRTS Economic Analysis

**Apply production economics theory to optimize build orders**

### What is MRTS?

**MRTS** = Marginal Rate of Technical Substitution

**In Economics:** Rate at which one input substitutes for another along an isoquant

**In SC2:** How many minerals can you trade for gas while maintaining same army value

**Formula:**
```
MRTS = -Δ(Resource₂) / Δ(Resource₁)

Example:
Build A: 1000m, 0g → 10 Zealots
Build B: 875m, 350g → 7 Stalkers (same army value)

MRTS = -350g / -125m = 2.8 gas per mineral
```

---

### Step-by-step:

1. **Create a Build Order**
   - Add units/buildings to build
   - At least 5-10 items recommended

2. **Click "📈 MRTS" button** (orange-red)
   - In Build Order panel

3. **MRTS Modal Opens with 4 Tabs:**

---

### Tab 1: Overview

**Shows:**
- Resource summary cards (minerals, gas, supply, ratio)
- Build composition (units/buildings/upgrades)
- Economic insights
- Resource efficiency metrics
- "What is MRTS?" explanation

**Example:**
```
Total Minerals: 1200
Total Gas: 400
Total Supply: 45
M:G Ratio: 3.0

Build Composition:
  ⚔️ 15 Units
  🏛️ 8 Buildings
  ⚡ 2 Upgrades

Economic Insights:
  💰 Resource Efficiency: 3.75 supply per 100 resources
  ⚖️ Mineral-Gas Balance: Spending 3.0 minerals per 1 gas
  📊 Balanced mineral-gas composition ✓
```

---

### Tab 2: Mineral-Gas

**Shows:**
- Current build resources breakdown
- Resource distribution by unit (bar charts)
- Balance analysis and recommendations

**Recommendations:**
```
✅ If gas abundant: Use gas-heavy units (Stalkers, Immortals)
✅ If minerals abundant: Use mineral-heavy units (Zealots)
✅ Optimal: MRTS = Gas Price / Mineral Price
```

**Example:**
```
Mineral-heavy build detected!
You have resources for more gas units.

Resource Distribution:
  1. Gateway (150m 0g) - 12.5% minerals, 0% gas
  2. Cybernetics Core (150m 50g) - 12.5% minerals, 12.5% gas
  3. Stalker (125m 50g) - 10.4% minerals, 12.5% gas
  ...
```

---

### Tab 3: Time-Cost

**Shows:**
- Build timeline with production times
- Time-cost tradeoff analysis
- MRTS for time vs resources

**Concept:**
```
Faster Production = More Cost

Example:
  Option A: 1 Robotics Facility → Immortal in 55s (200m 100g)
  Option B: 3 Robotics Facilities → Immortal in 55s (600m 300g)

MRTS(time→minerals) = 50 minerals per second saved

Decision: Worth extra cost if defending rush!
```

---

### Tab 4: Recommendations

**Shows:**
- Strategic recommendations based on MRTS analysis
- Priority-coded suggestions (High/Medium/Low)
- Economic principles explained
- Actionable optimization tips

**Example Recommendations:**
```
⚠️ HIGH PRIORITY: No Gas Units
  Consider adding gas-based units for better army composition

💡 MEDIUM PRIORITY: Mineral-Heavy Build
  Gas units are generally more cost-efficient per supply

✅ MEDIUM PRIORITY: MRTS Optimization
  To fully utilize MRTS, compare with alternative builds
```

---

## Advanced Features

### Visualizations 📊

**Access:** Click "📊 Visualize" button

**Three Visualization Types:**

1. **Gantt Chart Timeline**
   - Shows when each unit/building starts/completes
   - Color-coded by type
   - Reveals production bottlenecks

2. **Resource Curves**
   - Cumulative mineral/gas spending over time
   - Shows resource spikes
   - Identifies expensive timing windows

3. **Dependency Graph**
   - Force-directed graph showing prerequisites
   - Visual tech tree relationships
   - Helps understand build structure

---

### Export/Import

**Export Current Build:**
1. Click "Export Build" (header)
2. Downloads as `build-order.json`
3. Contains full build with metadata

**Copy Build:**
- **Copy (text)**: Plaintext numbered list
- **Copy (JSON)**: JSON format for developers

**Import (via Library):**
1. Open Library
2. Click "📥 Import Build"
3. Select exported JSON file

---

### Dark Mode

**Toggle:** Click "Dark" or "Theme" button in header

**Modes:**
- Light theme (default)
- Dark theme (dark backgrounds, light text)

**Persistence:** Theme choice saved to localStorage

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Shift+Click** (Tech Tree) | Auto-complete prerequisite path |
| **Drag** (Build List) | Reorder items in build |
| **Ctrl+F / Cmd+F** | Browser search (works in modals) |
| **Esc** | Close current modal (future feature) |

---

## Tips & Best Practices

### Building Effective Build Orders

1. **Start with Workers**
   - Add worker production early
   - Economic foundation crucial

2. **Don't Forget Production Buildings**
   - Gateways, Barracks, Hatcheries
   - Multiple needed for continuous production

3. **Plan Tech Path**
   - Use Tech Tree to visualize dependencies
   - Shift+click high-tier units to auto-add prereqs

4. **Balance Resources**
   - Check MRTS tab for mineral-gas ratio
   - Aim for 2:1 to 4:1 depending on composition

5. **Consider Timing**
   - 3:00 = Early pressure
   - 4:00 = Mid-game timing
   - 5:00 = Late game
   - Use comparison tool to see army strength at each

---

### Optimizing with MRTS

1. **Compare Alternatives**
   - Save multiple versions of build
   - Compare in comparison tool
   - MRTS shows which is more efficient

2. **Check Efficiency Rankings**
   - 6 different metrics matter
   - No single "best" build
   - Choose based on strategy (rush vs macro)

3. **Look for Diminishing Returns**
   - First stalkers very efficient (MRTS = 2.8)
   - Later stalkers less efficient (MRTS = 0.67)
   - Mix unit types for better MRTS

---

### Library Organization

1. **Use Descriptive Names**
   - ❌ "Build 1", "Test"
   - ✅ "4-Gate Rush vs Zerg", "Safe 1-1-1 Expand"

2. **Add Detailed Tags**
   - Strategy: #rush, #macro, #allin
   - Matchup: #pvt, #pvz, #pvp
   - Timing: #3min, #6min
   - Style: #gateway, #robo, #air

3. **Write Descriptions**
   - When to use: "vs early pool"
   - Key timings: "hits at 4:30"
   - Weaknesses: "weak to early aggression"

4. **Star Your Favorites**
   - Builds you use frequently
   - Proven tournament builds
   - Experimental builds that worked

5. **Regular Backups**
   - Export All monthly
   - Store backup file safely
   - IndexedDB can be cleared by browser

---

## Technical Architecture

### Code Structure

```
sc2/
├── index.html                 # Main HTML
├── src/
│   ├── main.js               # Entry point, event handlers
│   ├── core/
│   │   ├── state.js          # Global state management
│   │   ├── logger.js         # Logging utility
│   │   └── config.js         # Configuration
│   ├── algorithms/
│   │   ├── build-order.js    # Prerequisite checking
│   │   ├── graph.js          # Topological sort, cycles
│   │   ├── optimizer.js      # Branch & bound
│   │   ├── pareto.js         # Multi-objective optimization
│   │   ├── mrts.js           # MRTS calculations
│   │   ├── build-comparison.js # Comparison algorithms
│   │   └── tech-tree.js      # Tech tree graph
│   ├── ui/
│   │   ├── build.js          # Build list rendering
│   │   ├── charts.js         # D3 charts
│   │   ├── grid.js           # Card grid
│   │   ├── visualization-dashboard.js
│   │   ├── build-library.js
│   │   ├── mrts-dashboard.js
│   │   ├── build-comparison.js
│   │   └── tech-tree.js
│   ├── data/
│   │   ├── parser.js         # JSON parsing
│   │   ├── query.js          # Data queries
│   │   └── build-database.js # IndexedDB wrapper
│   └── utils/
│       └── dom.js            # DOM utilities
```

---

### Data Flow

**1. Loading Data:**
```
User uploads sc2units.json
  ↓
parser.js validates and normalizes
  ↓
GameDatabase builds indices
  ↓
state.norm stores normalized data
  ↓
UI renders cards
```

**2. Adding to Build:**
```
User clicks "Add" or Tech Tree node
  ↓
findMissingPrereqs() checks dependencies
  ↓
state.addToBuild() updates state
  ↓
renderBuildList() updates UI
  ↓
renderCharts() updates visualizations
```

**3. Saving Build:**
```
User clicks "💾 Save"
  ↓
getBuildDatabase() opens IndexedDB
  ↓
saveBuild() stores build + metadata
  ↓
IDB transaction committed
  ↓
Library updated
```

**4. MRTS Analysis:**
```
User clicks "📈 MRTS"
  ↓
calculateBuildMetrics() computes totals
  ↓
calculateMRTS() computes substitution rates
  ↓
renderMRTSDashboard() displays results
  ↓
User sees recommendations
```

---

### Technologies Used

**Frontend:**
- **Vanilla JavaScript** (ES6+ modules)
- **D3.js** - Charts and visualizations
- **Tailwind CSS** - Styling
- **IndexedDB** - Local database

**Algorithms:**
- **Graph Theory** - Topological sort, cycle detection
- **Economic Theory** - MRTS, Pareto optimality
- **Optimization** - Branch & bound, 2-approximation
- **Search** - BFS pathfinding

**Architecture Patterns:**
- **Modular ES6** - Clean imports/exports
- **State Management** - Centralized reactive state
- **Observer Pattern** - UI updates on state change
- **MVC** - Separation of concerns

---

## Troubleshooting

### Common Issues

**"No data loaded"**
- Solution: Load `sc2units.json` first
- Button: "Load JSON" in header

**"Build order is empty"**
- Solution: Add items before using MRTS/Visualize
- Use Tech Tree or card grid

**Items appear "locked"**
- Reason: Missing prerequisites
- Solution: Shift+click in Tech Tree to auto-complete

**Library not saving**
- Reason: Browser privacy settings
- Solution: Enable IndexedDB in browser settings

**Charts not rendering**
- Reason: D3.js script blocked
- Solution: Check browser console, allow CDN scripts

---

## Advanced Use Cases

### Tournament Preparation

1. **Build Library of Strategies**
   - Create builds for each matchup
   - Tag by opponent scouting scenarios
   - Example tags: #vs_early_pool, #vs_proxy, #vs_macro

2. **Compare Build Timings**
   - Compare your PvZ builds
   - Check which hits at 4:00 strongest
   - Adjust based on opponent's likely timing

3. **MRTS Optimization**
   - Find most resource-efficient build
   - Minimize waste between timings
   - Balance economy vs aggression

---

### Learning & Practice

1. **Copy Pro Builds**
   - Enter build from replay or guide
   - Save to library
   - Compare your execution vs theirs

2. **Experiment with Variations**
   - Modify saved build
   - Compare original vs modified
   - See efficiency impact

3. **Study Tech Trees**
   - Explore all possible tech paths
   - Understand race differences
   - Learn optimal unlocking sequences

---

## Support & Feedback

**Report Issues:**
- GitHub: https://github.com/anthropics/claude-code/issues

**Documentation:**
- MRTS_ANALYSIS.md - Economic theory details
- VISUALIZATION_FEATURES.md - Visualization guide
- ANALYSIS.md - Architecture decisions

---

## Version History

**v2.0** (Current)
- ✅ Interactive Tech Tree with auto-complete
- ✅ Build comparison tool (5 analysis tabs)
- ✅ MRTS economic analysis (4 tabs)
- ✅ Build library with IndexedDB
- ✅ Visualization dashboard
- ✅ Pareto frontier optimization
- ✅ Dark mode support

**v1.0** (Previous)
- Basic build order creation
- Card-based UI
- Simple charts
- Text export

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│                SC2 BUILD LAB CHEAT SHEET                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  GETTING STARTED:                                       │
│    1. Load sc2units.json                                │
│    2. Select race (Protoss/Terran/Zerg)                │
│    3. Build using cards OR tech tree                    │
│                                                         │
│  TECH TREE:                                             │
│    • 🟢 Green = Can build                               │
│    • 🔵 Blue = Already built                            │
│    • ⚪ Gray = Locked                                    │
│    • Shift+Click = Auto-complete!                       │
│                                                         │
│  BUILD LIBRARY:                                         │
│    • 💾 Save = Store build                              │
│    • 📚 Library = Browse/Load                           │
│    • ⭐ Star = Mark favorite                            │
│    • ⚖️ Compare = Select 2-4 builds                     │
│                                                         │
│  ANALYSIS:                                              │
│    • 📊 Visualize = Charts & graphs                     │
│    • 📈 MRTS = Economic analysis                        │
│    • ⚖️ Compare = Side-by-side                          │
│                                                         │
│  TIPS:                                                  │
│    • Use descriptive names & tags                       │
│    • Export backup monthly                              │
│    • Shift+click for auto-complete                      │
│    • Check MRTS for optimization                        │
│    • Compare alternatives before committing             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**Happy Building! 🎮⚔️🏆**
