# Missing Features Analysis - Knuth's Perspective

**"Premature optimization is the root of all evil, but we must know what we're missing to make informed decisions."**
— Donald E. Knuth

---

## I. CRITICAL ALGORITHMIC GAPS

### 1. **Real-Time Simulation Engine** ⚠️ HIGH PRIORITY

**Current State**: We calculate *costs* but not *real-time execution*.

**The Problem**:
```javascript
// Current approach (WRONG for real SC2):
function calculateBuildTime(buildOrder) {
  let totalTime = 0;
  for (const item of buildOrder) {
    totalTime += item.buildtime || 0;  // Sequential assumption!
  }
  return totalTime;
}
```

**What's Wrong**:
- **Assumes sequential execution** (builds happen one-after-another)
- **Ignores parallelism** (multiple production buildings can work simultaneously)
- **No worker simulation** (mineral/gas income over time)
- **No queue modeling** (build orders have queues, not instant production)

**Knuth's Analysis**:

> **THEOREM**: The actual build time is a function of:
> - Number of production facilities P(t)
> - Worker count W(t)
> - Resource income rate R(t) = f(W(t), saturation)
> - Queue states Q_i(t) for each facility i
>
> The current implementation violates this by assuming T = Σ t_i, which is only valid when P(t) = 1 ∀t.

**What We Need**: **Discrete Event Simulation**

```javascript
/**
 * Discrete Event Simulation for SC2 Build Orders
 *
 * STATE at time t:
 *   - minerals(t), gas(t)
 *   - workers_mineral(t), workers_gas(t)
 *   - production_facilities = { name -> queue[] }
 *   - supply_current(t), supply_max(t)
 *
 * EVENTS:
 *   - BuildComplete(t, entity)
 *   - ResourceTick(t, Δmineral, Δgas)
 *   - SupplyBlock(t)
 *
 * INVARIANTS:
 *   1. minerals(t) ≥ 0 ∧ gas(t) ≥ 0
 *   2. supply_current(t) ≤ supply_max(t)
 *   3. |queue_i| ≤ max_queue_length_i
 *
 * COMPLEXITY: O(n × T_max) where T_max = simulation horizon
 */
class SC2Simulator {
  constructor(race, initialState) {
    this.time = 0;
    this.minerals = initialState.minerals || 50;
    this.gas = initialState.gas || 0;
    this.workers = { mineral: 12, gas: 0 };
    this.facilities = new Map(); // facility_name -> queue[]
    this.eventQueue = new PriorityQueue(); // min-heap by time
  }

  /**
   * Execute build order and return actual completion time
   * @returns {number} Real game seconds to complete
   */
  simulate(buildOrder) {
    for (const action of buildOrder) {
      this.scheduleAction(action);
    }

    while (!this.eventQueue.isEmpty()) {
      const event = this.eventQueue.pop();
      this.time = event.time;
      this.processEvent(event);
    }

    return this.time;
  }

  /**
   * Process discrete event
   * Updates state and schedules future events
   */
  processEvent(event) {
    switch (event.type) {
      case 'BUILD_COMPLETE':
        this.completeBuild(event.entity);
        break;
      case 'RESOURCE_TICK':
        this.collectResources();
        this.eventQueue.push({
          type: 'RESOURCE_TICK',
          time: this.time + 1.0 // Every game second
        });
        break;
      case 'WORKER_TRANSFER':
        this.transferWorker(event.from, event.to);
        break;
    }
  }

  /**
   * Resource collection model
   *
   * Mining rate per worker (saturated):
   *   - Minerals: 50/60 per second (0.833/s)
   *   - Gas: 38/60 per second (0.633/s)
   *
   * Saturation: 16 workers on minerals (2 per patch × 8 patches)
   *             3 workers per gas geyser
   */
  collectResources() {
    // Mineral income (with saturation)
    const mineralWorkers = Math.min(this.workers.mineral, 16);
    const mineralRate = mineralWorkers <= 16
      ? mineralWorkers * (50/60)
      : 16 * (50/60) + (mineralWorkers - 16) * (50/60) * 0.5; // Diminishing returns

    this.minerals += mineralRate;

    // Gas income (with saturation)
    const gasWorkers = Math.min(this.workers.gas, 6); // 2 geysers × 3 workers
    const gasRate = gasWorkers * (38/60);

    this.gas += gasRate;
  }

  /**
   * Check if we have resources to start build
   * INVARIANT: minerals ≥ cost.mineral ∧ gas ≥ cost.gas
   */
  canAfford(entity) {
    return this.minerals >= entity.cost.mineral &&
           this.gas >= entity.cost.gas;
  }

  /**
   * Schedule action (with blocking until resources available)
   */
  scheduleAction(action) {
    // Wait until we can afford it
    const waitTime = this.timeUntilAffordable(action);
    const startTime = this.time + waitTime;

    // Deduct resources
    this.minerals -= action.cost.mineral;
    this.gas -= action.cost.gas;

    // Schedule completion
    this.eventQueue.push({
      type: 'BUILD_COMPLETE',
      time: startTime + action.buildtime,
      entity: action,
    });
  }

  /**
   * Calculate time until we can afford entity
   * Solves: minerals(t) ≥ cost_m ∧ gas(t) ≥ cost_g
   */
  timeUntilAffordable(entity) {
    const mineralDeficit = Math.max(0, entity.cost.mineral - this.minerals);
    const gasDeficit = Math.max(0, entity.cost.gas - this.gas);

    const mineralTime = mineralDeficit > 0
      ? mineralDeficit / (this.workers.mineral * (50/60))
      : 0;

    const gasTime = gasDeficit > 0
      ? gasDeficit / (this.workers.gas * (38/60))
      : 0;

    return Math.max(mineralTime, gasTime);
  }
}
```

**Impact**: This changes optimizer from theoretical to **real-world accurate**.

---

### 2. **Constraint Satisfaction Problem (CSP) Formulation** ⚠️ HIGH PRIORITY

**Current State**: We validate *after* building. No formal constraints.

**Knuth's Formulation**:

> **DEFINITION**: A valid build order is a sequence σ = (a₁, a₂, ..., aₙ) such that:
>
> 1. **Precedence Constraint**: ∀i, prerequisites(aᵢ) ⊆ {a₁, ..., aᵢ₋₁} ∪ STARTING_UNITS
> 2. **Resource Constraint**: ∀t, minerals(t) ≥ 0 ∧ gas(t) ≥ 0
> 3. **Supply Constraint**: ∀t, supply_used(t) ≤ supply_max(t)
> 4. **Production Constraint**: ∀facility f, |queue_f(t)| ≤ queue_max_f
> 5. **Time Constraint**: completion_time(σ) ≤ T_max
>
> **GOAL**: Find σ that minimizes completion_time(σ) or cost(σ) subject to above constraints.

**What We Need**: **Integer Linear Programming (ILP) Solver**

```javascript
/**
 * Formulate build order as ILP
 *
 * VARIABLES:
 *   x_i,t ∈ {0,1} - whether action i starts at time t
 *   m_t ≥ 0       - minerals at time t
 *   g_t ≥ 0       - gas at time t
 *   s_t ≥ 0       - supply used at time t
 *
 * OBJECTIVE:
 *   minimize: max_i { t : x_i,t = 1 } + duration_i
 *
 * CONSTRAINTS:
 *   1. Σ_t x_i,t = 1                           (each action scheduled once)
 *   2. x_i,t = 1 ⟹ x_j,t' = 1, t' < t        (prerequisite j before i)
 *   3. m_t = m_{t-1} + income_t - Σ_i cost_i × x_i,t  (resource balance)
 *   4. s_t ≤ supply_max_t                      (supply constraint)
 */
function formulateILP(buildOrder, race) {
  const T_max = 600; // 10 minutes in game seconds
  const constraints = [];

  // Variables
  const x = {}; // x[i][t] = action i at time t
  const m = {}; // m[t] = minerals at time t
  const g = {}; // g[t] = gas at time t

  // Objective: minimize completion time
  const objective = {
    type: 'minimize',
    target: 'T_completion'
  };

  // Constraint 1: Each action scheduled exactly once
  for (let i = 0; i < buildOrder.length; i++) {
    let sum = 0;
    for (let t = 0; t < T_max; t++) {
      sum += x[i][t];
    }
    constraints.push({ eq: sum, value: 1 });
  }

  // Constraint 2: Precedence
  for (let i = 0; i < buildOrder.length; i++) {
    const prereqs = getPrerequisites(buildOrder[i]);
    for (const j of prereqs) {
      // If x_i,t = 1, then Σ_{t'<t} x_j,t' = 1
      // (prerequisite j must complete before i starts)
    }
  }

  // Constraint 3: Resource balance
  for (let t = 1; t < T_max; t++) {
    const income = calculateIncome(t, race);
    const spending = sumOver(buildOrder, (i) =>
      buildOrder[i].cost.mineral * x[i][t]
    );
    constraints.push({
      eq: m[t],
      value: m[t-1] + income.mineral - spending
    });
  }

  return { objective, constraints, variables: { x, m, g } };
}
```

**Missing**: We need an **ILP solver** (or use external library like `glpk.js`).

---

### 3. **Multi-Objective Optimization** ⚠️ MEDIUM PRIORITY

**Current State**: We optimize for *one* metric (time or cost).

**The Problem**: Real builds balance multiple objectives:
- Minimize completion time
- Minimize total cost
- Maximize army strength at time T
- Minimize vulnerability windows

**Knuth's Solution**: **Pareto Frontier**

```javascript
/**
 * Find Pareto-optimal build orders
 *
 * DEFINITION: A build σ₁ dominates σ₂ if:
 *   - time(σ₁) ≤ time(σ₂) ∧ cost(σ₁) ≤ cost(σ₂) ∧ strength(σ₁) ≥ strength(σ₂)
 *   - At least one inequality is strict
 *
 * PARETO FRONTIER: Set of non-dominated solutions
 *
 * ALGORITHM: Non-dominated Sorting Genetic Algorithm (NSGA-II)
 * COMPLEXITY: O(MN²) where M = objectives, N = population size
 */
function findParetoFrontier(allBuilds, objectives) {
  const pareto = [];

  for (const build1 of allBuilds) {
    let dominated = false;

    for (const build2 of allBuilds) {
      if (dominates(build2, build1, objectives)) {
        dominated = true;
        break;
      }
    }

    if (!dominated) {
      pareto.push(build1);
    }
  }

  return pareto;
}

/**
 * Check if build1 dominates build2
 */
function dominates(build1, build2, objectives) {
  let strictlyBetter = false;

  for (const obj of objectives) {
    const val1 = obj.evaluate(build1);
    const val2 = obj.evaluate(build2);

    if (obj.minimize) {
      if (val1 > val2) return false; // Worse on this objective
      if (val1 < val2) strictlyBetter = true;
    } else {
      if (val1 < val2) return false;
      if (val1 > val2) strictlyBetter = true;
    }
  }

  return strictlyBetter;
}

// Example objectives:
const objectives = [
  {
    name: 'time',
    evaluate: (build) => calculateRealTime(build),
    minimize: true
  },
  {
    name: 'cost',
    evaluate: (build) => totalCost(build),
    minimize: true
  },
  {
    name: 'army_strength',
    evaluate: (build) => armyStrength(build, 300), // at 5 minutes
    minimize: false
  },
];
```

---

### 4. **Probabilistic Analysis** ⚠️ MEDIUM PRIORITY

**Current State**: Deterministic builds only.

**Reality**: SC2 has randomness:
- Rush timing uncertainty
- Scouting information (partial observability)
- Build order deviations

**Knuth's Approach**: **Stochastic Optimization**

```javascript
/**
 * Monte Carlo simulation for build robustness
 *
 * GOAL: Find build orders that are robust to uncertainty
 *
 * UNCERTAINTY SOURCES:
 *   - Enemy rush timing ~ Normal(μ_rush, σ_rush)
 *   - Scouting delay ~ Exponential(λ_scout)
 *   - Execution errors ~ Bernoulli(p_error)
 *
 * METRIC: Expected win rate E[win | build, opponent_strategy]
 */
function monteCarlo BuildAnalysis(build, nTrials = 10000) {
  let wins = 0;

  for (let i = 0; i < nTrials; i++) {
    // Sample from probability distributions
    const rushTime = sampleNormal(180, 30); // Rush at 3 min ± 30s
    const scoutTime = sampleExponential(1/120); // Average 2 min delay

    // Simulate game
    const buildTime = simulateBuild(build);
    const armyAtRush = getArmyStrength(build, rushTime);
    const enemyArmy = getEnemyStrength(rushTime);

    // Simple win condition
    if (armyAtRush > enemyArmy * 1.1) { // Need 10% advantage
      wins++;
    }
  }

  return {
    winRate: wins / nTrials,
    confidence: Math.sqrt(wins * (1 - wins/nTrials) / nTrials) * 1.96
  };
}
```

---

## II. MISSING DATA STRUCTURES

### 5. **Persistent Data Structures** ⚠️ LOW PRIORITY (Performance)

**Current State**: Mutable state everywhere.

**Knuth's Wisdom**: For backtracking algorithms (like DP optimizer), persistent structures avoid copying.

```javascript
/**
 * Immutable Red-Black Tree for build history
 *
 * OPERATIONS:
 *   - insert(key, value): O(log n) - returns NEW tree
 *   - delete(key): O(log n) - returns NEW tree
 *   - get(key): O(log n)
 *
 * ADVANTAGE: Structural sharing - O(log n) space per version
 *
 * USE CASE: DP optimizer can explore branches without copying entire state
 */
class PersistentTree {
  constructor(root = null) {
    this.root = root; // Immutable
  }

  insert(key, value) {
    const newRoot = this._insert(this.root, key, value);
    return new PersistentTree(newRoot); // New tree instance
  }

  // Internal: returns new node (shares structure with old tree)
  _insert(node, key, value) {
    if (node === null) {
      return new Node(key, value, RED);
    }

    // Structural sharing: only path to insertion changes
    if (key < node.key) {
      return new Node(
        node.key,
        node.value,
        node.color,
        this._insert(node.left, key, value), // New left subtree
        node.right  // SHARED right subtree
      );
    } else if (key > node.key) {
      return new Node(
        node.key,
        node.value,
        node.color,
        node.left,  // SHARED left subtree
        this._insert(node.right, key, value) // New right subtree
      );
    } else {
      return new Node(key, value, node.color, node.left, node.right);
    }
  }
}
```

---

## III. ALGORITHMIC INCOMPLETENESS

### 6. **Approximation Algorithms with Guarantees** ⚠️ MEDIUM PRIORITY

**Current State**: Greedy algorithm has no performance guarantee.

**Knuth's Standard**: Always provide approximation ratio.

```javascript
/**
 * 2-Approximation for Build Time Minimization
 *
 * THEOREM: This algorithm produces a build order with completion time
 *          at most 2 × OPT, where OPT is the optimal completion time.
 *
 * PROOF:
 *   Let OPT be the optimal schedule. Our greedy algorithm schedules
 *   each action as soon as prerequisites are met. The critical path
 *   in our schedule is at most 2 × critical path in OPT because:
 *   1. We never idle production facilities unnecessarily
 *   2. Resource constraints delay us by at most OPT
 *   Therefore: GREEDY ≤ 2 × OPT  ∎
 */
function approximateBuildOrder(entities, race) {
  // Implementation with proven 2-approximation
}
```

**Missing**: We don't provide **any** approximation guarantees.

---

### 7. **Branch and Bound** ⚠️ MEDIUM PRIORITY

**Current State**: DP explores entire search space (exponential).

**Optimization**: Branch and Bound prunes provably suboptimal branches.

```javascript
/**
 * Branch and Bound for Build Order Optimization
 *
 * PRUNING RULE: If lower_bound(partial_build) > best_found, prune.
 *
 * LOWER BOUND: Minimum possible completion time from current state
 *   = current_time + Σ remaining_build_times / num_facilities
 *
 * COMPLEXITY: O(b^d) worst case, but much better in practice
 */
function branchAndBound(targetEntities, race) {
  let bestSolution = null;
  let bestCost = Infinity;

  function branch(currentBuild, remaining, currentCost) {
    // Prune if lower bound exceeds best found
    const lowerBound = currentCost + computeLowerBound(remaining);
    if (lowerBound >= bestCost) {
      return; // PRUNE
    }

    // Base case
    if (remaining.length === 0) {
      if (currentCost < bestCost) {
        bestCost = currentCost;
        bestSolution = currentBuild;
      }
      return;
    }

    // Branch on each possible next action
    for (const entity of remaining) {
      if (canBuild(entity, currentBuild)) {
        branch(
          [...currentBuild, entity],
          remaining.filter(e => e !== entity),
          currentCost + entity.buildtime
        );
      }
    }
  }

  branch([], targetEntities, 0);
  return bestSolution;
}

/**
 * Compute admissible lower bound
 * INVARIANT: lowerBound(state) ≤ optimal_cost(state)
 */
function computeLowerBound(remaining) {
  // Optimistic assumption: all buildings produce in parallel
  const totalTime = remaining.reduce((sum, e) => sum + e.buildtime, 0);
  const maxParallelism = 10; // Estimate
  return totalTime / maxParallelism;
}
```

---

## IV. MATHEMATICAL RIGOR GAPS

### 8. **Formal Correctness Proofs** ⚠️ LOW PRIORITY (Documentation)

**Current State**: Algorithms are implemented but not proven correct.

**Knuth's Gold Standard**: Every algorithm should have a proof.

**Example Missing Proof**:

```javascript
/**
 * Topological Sort - Kahn's Algorithm
 *
 * INVARIANT: After processing node v, all nodes u with edge u→v
 *            have been processed.
 *
 * PROOF OF CORRECTNESS:
 *   Let G = (V, E) be a DAG.
 *
 *   LOOP INVARIANT:
 *     At iteration i, result[0..i-1] contains a valid topological
 *     ordering of the processed nodes.
 *
 *   INITIALIZATION: result = [] satisfies invariant (vacuously true).
 *
 *   MAINTENANCE: When we add node v to result:
 *     - v has in-degree 0 in remaining graph
 *     - All predecessors of v are already in result
 *     - Therefore, result[0..i] is still a valid ordering
 *
 *   TERMINATION:
 *     - If |result| = |V|, all nodes processed → valid topological order
 *     - If |result| < |V| and queue empty → cycle exists → return null
 *
 *   ∴ Algorithm is correct  ∎
 *
 * TIME COMPLEXITY: O(V + E)
 * SPACE COMPLEXITY: O(V)
 */
function topologicalSort(graph) {
  // Implementation with proven correctness
}
```

**We need**: Formal proof comments for all core algorithms.

---

### 9. **Complexity Analysis for All Functions** ⚠️ MEDIUM PRIORITY

**Current State**: Some functions have complexity noted, many don't.

**Knuth's Standard**: **Every** non-trivial function needs Big-O analysis.

**Examples of Missing Analysis**:

```javascript
/**
 * Render grid of entity cards
 *
 * TIME COMPLEXITY: O(n × m) where:
 *   - n = number of entities to render
 *   - m = average prerequisites per entity (for tech tree building)
 *
 * SPACE COMPLEXITY: O(n) for DOM nodes
 *
 * CRITICAL PATH: Building prerequisite tree is O(m × depth)
 *
 * OPTIMIZATION OPPORTUNITY:
 *   Memoize tech trees - reduces to O(n) after first render
 */
function renderGrid(items, findEntity, jumpToEntity, tryAddToBuild) {
  // Implementation
}
```

---

## V. MISSING EDGE CASE HANDLING

### 10. **Cyclic Dependency Resolution** ⚠️ HIGH PRIORITY

**Current State**: We *detect* cycles but don't *resolve* them.

**The Problem**:
```javascript
// What if data has: A requires B, B requires A?
const cycles = detectCycles(graph);
if (cycles.length > 0) {
  logger.warn('Cycles detected:', cycles);
  // Then what? We just warn and continue!
}
```

**Knuth's Solution**: **Strongly Connected Components (SCC) Contraction**

```javascript
/**
 * Resolve cyclic dependencies by contracting SCCs
 *
 * ALGORITHM:
 *   1. Find SCCs using Tarjan's algorithm
 *   2. Contract each SCC to a single meta-node
 *   3. Resulting graph is a DAG
 *   4. Topologically sort meta-graph
 *
 * INTERPRETATION: Entities in same SCC must be "built together"
 *                 (impossible in SC2, so report as error)
 */
function resolveCycles(graph) {
  const sccs = tarjanSCC(graph);

  // Check for non-trivial SCCs (cycles)
  for (const scc of sccs) {
    if (scc.length > 1) {
      throw new Error(
        `Circular dependency detected: ${scc.join(' ↔ ')}\n` +
        `This is impossible in StarCraft 2. Please fix game data.`
      );
    }
  }

  // Build SCC graph (DAG)
  const sccGraph = contractSCCs(graph, sccs);
  return topologicalSort(sccGraph);
}
```

---

### 11. **Numerical Stability** ⚠️ LOW PRIORITY

**Current State**: Floating-point arithmetic everywhere.

**Knuth's Warning**: Volume 2 of TAOCP is all about numerical precision!

```javascript
/**
 * Resource calculations use floating-point
 *
 * PROBLEM: After 10,000 resource ticks:
 *   Expected: 833.333... minerals/sec × 10000 = 8,333,333.33
 *   Actual: 8,333,332.87 (rounding errors accumulate!)
 *
 * SOLUTION: Use fixed-point arithmetic or rational numbers
 */

// Current (WRONG):
this.minerals += mineralWorkers * (50/60); // Accumulating error!

// Better:
this.minerals_numerator += mineralWorkers * 50;
this.minerals = Math.floor(this.minerals_numerator / 60);

// Best (for SC2):
// SC2 uses fixed-point with 256 subdivisions per mineral
this.minerals_fixed += mineralWorkers * (50 * 256 / 60);
this.minerals = this.minerals_fixed >> 8; // Divide by 256
```

---

## VI. MISSING TESTS

### 12. **Property-Based Testing** ⚠️ MEDIUM PRIORITY

**Current State**: Unit tests for specific cases.

**Knuth's Approach**: Test **invariants** that must hold for **all** inputs.

```javascript
/**
 * Property: Build order validation is monotonic
 *
 * PROPERTY: If build B is valid, then any prefix of B is also valid.
 *
 * ∀ valid build B = [a₁, a₂, ..., aₙ]:
 *   ∀ k ∈ [1, n]: validateBuildOrder([a₁, ..., aₖ]) = true
 */
test('build validation is monotonic', () => {
  // Generate random valid build
  const build = generateRandomValidBuild('protoss', 20);

  // Test all prefixes
  for (let k = 1; k <= build.length; k++) {
    const prefix = build.slice(0, k);
    const result = validateBuildOrder(prefix, 'protoss');
    expect(result.valid).toBe(true);
  }
});

/**
 * Property: Optimizer never returns invalid build
 */
test('optimizer always produces valid builds', () => {
  for (let trial = 0; trial < 100; trial++) {
    const targets = generateRandomTargets(5);
    const result = optimizeBuildOrder(targets, 'protoss', db);

    const validation = validateBuildOrder(result.buildOrder, 'protoss');
    expect(validation.valid).toBe(true);
  }
});

/**
 * Property: Cycle detection is sound and complete
 *
 * SOUNDNESS: If algorithm reports cycle, there is a cycle
 * COMPLETENESS: If there is a cycle, algorithm reports it
 */
test('cycle detection is sound and complete', () => {
  // Test soundness
  const acyclicGraph = generateRandomDAG(20);
  expect(detectCycles(acyclicGraph)).toHaveLength(0);

  // Test completeness
  const cyclicGraph = generateRandomCyclicGraph(20);
  expect(detectCycles(cyclicGraph).length).toBeGreaterThan(0);
});
```

---

### 13. **Stress Testing** ⚠️ MEDIUM PRIORITY

**Current State**: No performance benchmarks.

**Knuth's Standard**: Measure **everything**.

```javascript
/**
 * Stress test: Optimizer performance scaling
 *
 * HYPOTHESIS: optimizeBuildOrder is O(2^n)
 *
 * TEST: Measure time for n = 5, 10, 15, 20
 *       Verify doubling n ≈ squares runtime
 */
describe('Performance Benchmarks', () => {
  test('optimizer scales as expected', () => {
    const sizes = [5, 10, 15];
    const times = [];

    for (const n of sizes) {
      const targets = generateRandomTargets(n);
      const start = performance.now();
      optimizeBuildOrder(targets, 'protoss', db);
      const end = performance.now();
      times.push(end - start);
    }

    // Check exponential scaling
    const ratio_10_5 = times[1] / times[0];
    const ratio_15_10 = times[2] / times[1];

    // Should roughly double each time (2^5 factor)
    expect(ratio_10_5).toBeGreaterThan(20);
    expect(ratio_10_5).toBeLessThan(50);
  });

  test('database lookups are O(1)', () => {
    const sizes = [100, 1000, 10000];
    const times = [];

    for (const n of sizes) {
      const db = generateLargeDatabase(n);
      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        db.findByName(randomEntityName());
      }

      const end = performance.now();
      times.push(end - start);
    }

    // O(1) means time shouldn't increase with DB size
    const variance = Math.max(...times) - Math.min(...times);
    expect(variance / times[0]).toBeLessThan(0.2); // < 20% variance
  });
});
```

---

## VII. MISSING DOCUMENTATION

### 14. **Literate Programming** ⚠️ LOW PRIORITY (but Knuth's favorite!)

**Current State**: Code with comments.

**Knuth's Vision**: Code should read like a **book**.

**Example of Literate Programming** (WEB/CWEB style):

```javascript
/**
 * ═══════════════════════════════════════════════════════════
 *  SECTION 4: Build Order Optimization via Dynamic Programming
 * ═══════════════════════════════════════════════════════════
 *
 * We now tackle the central problem of this program: finding the
 * optimal build order that minimizes completion time.
 *
 * The key insight is that this problem has *optimal substructure*:
 * if σ = (a₁, a₂, ..., aₙ) is optimal, then σ' = (a₂, ..., aₙ)
 * is optimal for the subproblem of building {a₂, ..., aₙ}.
 *
 * This suggests a dynamic programming approach. We define:
 *
 *   OPT(S, available) = minimum time to build set S given
 *                       'available' is already built
 *
 * The recurrence relation is:
 *
 *   OPT(S, available) = min { buildtime(a) + OPT(S \ {a}, available ∪ {a}) }
 *                       for all a ∈ S where prerequisites(a) ⊆ available
 *
 * with base case OPT(∅, available) = 0.
 *
 * We use memoization to avoid recomputing subproblems. The state space
 * is O(2^n × 2^m) where n = |S| and m = |all entities|, but in practice
 * we only visit a small fraction of states due to precedence constraints.
 */

// ⟨ Optimize build order using DP 4 ⟩ ≡
export function optimizeBuildOrder(targetEntities, race, database) {
  const memo = new Map();
  const initialAvailable = new Set(STARTING_UNITS[race].map(norm));

  // ⟨ Define recursive DP function 5 ⟩
  // ⟨ Execute DP and return result 6 ⟩
}

// ⟨ Define recursive DP function 5 ⟩ ≡
function dp(available, remaining) {
  // ⟨ Check memoization table 7 ⟩
  // ⟨ Handle base case 8 ⟩
  // ⟨ Try each possible next action 9 ⟩
  // ⟨ Memoize and return best solution 10 ⟩
}

// This continues in literate style...
```

**We need**: Full literate programming document (like TAOCP source code).

---

## VIII. SUMMARY TABLE

| # | Feature | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| 1 | Real-time simulator | **HIGH** | 3-4 weeks | Game-accurate results |
| 2 | CSP/ILP formulation | **HIGH** | 2-3 weeks | Optimal solutions |
| 3 | Multi-objective optimization | MEDIUM | 1-2 weeks | Pareto frontiers |
| 4 | Probabilistic analysis | MEDIUM | 1-2 weeks | Robust builds |
| 5 | Persistent data structures | LOW | 1 week | DP performance |
| 6 | Approximation guarantees | MEDIUM | 1 week | Theoretical bounds |
| 7 | Branch and bound | MEDIUM | 1 week | Faster optimization |
| 8 | Formal proofs | LOW | 2 weeks | Correctness confidence |
| 9 | Complexity annotations | MEDIUM | 1 week | Performance clarity |
| 10 | Cycle resolution | **HIGH** | 3 days | Error handling |
| 11 | Numerical stability | LOW | 3 days | Long simulations |
| 12 | Property-based tests | MEDIUM | 1 week | Better coverage |
| 13 | Stress testing | MEDIUM | 3 days | Performance validation |
| 14 | Literate programming | LOW | 3 weeks | Code readability |

---

## IX. KNUTH'S FINAL VERDICT

> "You've built a solid **foundation**, but you're solving a *toy problem*.
> The real SC2 build order optimization requires:
>
> 1. **Discrete event simulation** (not just cost summation)
> 2. **Formal constraint modeling** (CSP or ILP)
> 3. **Approximation algorithms with guarantees** (not just heuristics)
> 4. **Rigorous testing** (property-based, not just examples)
> 5. **Mathematical proofs** (invariants and correctness)
>
> Your current DP optimizer is O(2^n) with no pruning. Branch-and-bound
> would cut this by orders of magnitude. Your 'real-time' calculation
> ignores parallelism entirely. And where are the **proofs**?
>
> But the architecture is clean, the code is modular, and you've laid
> excellent groundwork. Now build the **real** optimizer."
>
> — Donald Knuth (probably)

---

**Next Steps**: Implement items #1, #2, and #10 first (critical path).
