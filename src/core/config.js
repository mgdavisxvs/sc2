/**
 * Configuration & Constants
 * Game rules, starting conditions, and templates
 */

// Starting units for each race (considered "always available")
export const STARTING_UNITS = {
  protoss: ['nexus', 'pylon', 'probe'],
  terran:  ['command center', 'supply depot', 'scv'],
  zerg:    ['hatchery', 'overlord', 'drone'],
};

// Race color schemes
export const RACE_COLORS = {
  protoss: {
    primary: '#2563eb',
    light: '#eef2ff',
    dot: 'bg-protoss-500'
  },
  terran:  {
    primary: '#ef4444',
    light: '#fef2f2',
    dot: 'bg-terran-500'
  },
  zerg:    {
    primary: '#6d28d9',
    light: '#f5f3ff',
    dot: 'bg-zerg-500'
  },
};

// Auto-build templates (10-step basic builds)
export const AUTO_TEMPLATES = {
  protoss: [
    'nexus', 'probe', 'probe', 'pylon', 'gateway',
    'zealot', 'zealot', 'cybernetics core', 'stalker', 'stalker',
  ],
  terran: [
    'command center', 'scv', 'scv', 'supply depot', 'barracks',
    'marine', 'marine', 'refinery', 'factory', 'starport',
  ],
  zerg: [
    'hatchery', 'drone', 'drone', 'overlord', 'spawning pool',
    'queen', 'zergling', 'zergling', 'roach warren', 'roach',
  ],
};

// SC2 Game Rules (from Wolfram's analysis)
export const SC2_RULES = {
  // Worker mechanics
  WORKER_MINING_RATE: { mineral: 50/60, gas: 38/60 }, // per second
  WORKER_BUILD_LIMIT: { protoss: 1, terran: 1, zerg: Infinity },

  // Supply mechanics
  SUPPLY_CAP: 200,
  STARTING_SUPPLY: { protoss: 15, terran: 15, zerg: 14 },

  // Race-specific mechanics
  CHRONO_BOOST_MULTIPLIER: 1.5, // Protoss
  MULE_MINERAL_YIELD: 270,       // Terran
  LARVA_SPAWN_RATE: 1/15,        // Zerg (per second)
  LARVA_CAP_PER_HATCH: 3,        // Zerg
};

// Entity type schemas
export const ENTITY_SCHEMAS = {
  unit: {
    cost: (obj) => ({
      mineral: obj.mineral ?? 0,
      gas: obj.gas ?? 0
    }),
    supply: (obj) => ({
      required: obj.supply ?? 0,
      provided: obj.supplyoffer ?? 0
    }),
    time: (obj) => obj.buildtime ?? 0,
    producer: (obj) => obj.buildfrom ?? null,
  },
  building: {
    cost: (obj) => ({
      mineral: obj.mineral ?? 0,
      gas: obj.gas ?? 0
    }),
    supply: (obj) => ({
      required: 0,
      provided: obj.supplyoffer ?? 0
    }),
    time: (obj) => obj.buildtime ?? 0,
    producer: (obj, race, name) =>
      race === 'zerg' && !['hatchery', 'extractor'].includes(name)
        ? 'drone'
        : 'worker',
  },
  upgrade: {
    cost: (obj) => ({
      mineral: obj.mineral ?? 0,
      gas: obj.gas ?? 0
    }),
    time: (obj) => obj.researchtime ?? 0,
    researchedAt: (obj) => obj.researchedat ?? null,
  },
};
