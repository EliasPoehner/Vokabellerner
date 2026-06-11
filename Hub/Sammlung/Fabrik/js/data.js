// ============================================================
// ITEMS
// ============================================================
const ITEMS = {
  'iron-ore':    { name: 'Eisenerz',      icon: '🪨', color: '#b87333' },
  'copper-ore':  { name: 'Kupfererz',     icon: '🟠', color: '#cd7f32' },
  'coal':        { name: 'Kohle',         icon: '⬛', color: '#2d2d2d' },
  'stone':       { name: 'Stein',         icon: '🟫', color: '#8b7355' },
  'iron-plate':  { name: 'Eisenplatte',   icon: '🔩', color: '#8a8a8a' },
  'copper-plate':{ name: 'Kupferplatte',  icon: '🟤', color: '#b87333' },
  'stone-brick': { name: 'Steinziegel',   icon: '🧱', color: '#b5651d' },
  'iron-gear':   { name: 'Eisenzahnrad',  icon: '⚙️',  color: '#707070' },
  'copper-wire': { name: 'Kupferdraht',   icon: '〰️', color: '#cc8800' },
  'green-circuit':{ name: 'Grüne Schaltung', icon: '🟢', color: '#3a7d44' },
  'red-circuit': { name: 'Rote Schaltung',   icon: '🔴', color: '#c0392b' },
  'plastic':     { name: 'Kunststoff',    icon: '⬜', color: '#e8e8e8' },
  'steel-plate': { name: 'Stahlplatte',   icon: '🔧', color: '#5a5a5a' },
  'auto-science':{ name: 'Auto-Wissenschaft', icon: '🧪', color: '#4fc3f7' },
  'log-science': { name: 'Log-Wissenschaft',  icon: '🔬', color: '#81c784' },
  'chem-science':{ name: 'Chem-Wissenschaft', icon: '⚗️', color: '#ce93d8' },
  'rocket-part': { name: 'Raketenteil',   icon: '🚀', color: '#78909c' },
};

// ============================================================
// MACHINES
// ============================================================
const MACHINES = [
  {
    id: 'miner',
    name: 'Bergbau-Bohrer',
    category: 'extraction',
    icon: '⛏️',
    color: '#8b6914',
    energyKW: 0,
    desc: 'Platziere auf einem Erzvorkommen. Fördert automatisch Rohstoffe ohne Strom.',
    placesOn: ['iron-ore','copper-ore','coal','stone'],
    unlocked: true,
  },
  {
    id: 'stone-furnace',
    name: 'Steinkohle-Ofen',
    category: 'smelting',
    icon: '🔥',
    color: '#c0392b',
    energyKW: 0,
    desc: 'Schmilzt Erze zu Platten. Verbraucht Kohle als Brennstoff.',
    unlocked: true,
  },
  {
    id: 'electric-furnace',
    name: 'Elektroofen',
    category: 'smelting',
    icon: '⚡',
    color: '#2980b9',
    energyKW: 180,
    desc: 'Elektrisch betriebener Ofen. Kein Kohle-Bedarf, aber braucht Strom.',
    unlocked: false,
    requires: 'strom',
  },
  {
    id: 'assembler-1',
    name: 'Montageanlage 1',
    category: 'assembly',
    icon: '🏭',
    color: '#27ae60',
    energyKW: 75,
    desc: 'Baut Zwischenprodukte aus Grundmaterialien.',
    unlocked: false,
    requires: 'automatisierung',
  },
  {
    id: 'assembler-2',
    name: 'Montageanlage 2',
    category: 'assembly',
    icon: '🏗️',
    color: '#16a085',
    energyKW: 150,
    desc: 'Doppelt so schnell wie Montageanlage 1.',
    unlocked: false,
    requires: 'produktion',
  },
  {
    id: 'chemical-plant',
    name: 'Chemiefabrik',
    category: 'chemistry',
    icon: '⚗️',
    color: '#8e44ad',
    energyKW: 210,
    desc: 'Verarbeitet chemische Rezepte (Kunststoff, etc.).',
    unlocked: false,
    requires: 'chemie',
  },
  {
    id: 'steam-engine',
    name: 'Dampfmaschine',
    category: 'power',
    icon: '♨️',
    color: '#e67e22',
    energyKW: -900,
    desc: 'Erzeugt 900 kW. Verbraucht Kohle als Brennstoff.',
    unlocked: true,
    fuelItem: 'coal',
    fuelPerSec: 0.5,
  },
  {
    id: 'solar-panel',
    name: 'Solarpanel',
    category: 'power',
    icon: '☀️',
    color: '#f1c40f',
    energyKW: -60,
    desc: 'Erzeugt 60 kW ohne Brennstoff.',
    unlocked: false,
    requires: 'strom',
  },
  {
    id: 'lab',
    name: 'Labor',
    category: 'research',
    icon: '🔬',
    color: '#3498db',
    energyKW: 60,
    desc: 'Verbraucht Wissenschaftspakete für Forschung.',
    unlocked: true,
  },
  {
    id: 'rocket-silo',
    name: 'Raketensilo',
    category: 'goal',
    icon: '🚀',
    color: '#7f8c8d',
    energyKW: 400,
    desc: 'Sammelt 20 Raketenteile und startet die Rakete. Ziel des Spiels!',
    unlocked: false,
    requires: 'raketentech',
  },
  // Transport
  {
    id: 'belt',
    name: 'Förderband',
    category: 'transport',
    icon: '▶',
    color: '#e67e22',
    energyKW: 0,
    desc: 'Transportiert Items zwischen Gebäuden. R zum Drehen. Richtung: Eingang → Ausgang.',
    unlocked: true,
    throughput: 15,
  },
  {
    id: 'fast-belt',
    name: 'Schnellband',
    category: 'transport',
    icon: '▶▶',
    color: '#e74c3c',
    energyKW: 0,
    desc: 'Doppelt so schnell wie normales Förderband (30 Items/s).',
    unlocked: false,
    requires: 'logistik',
    throughput: 30,
  },
];

// ============================================================
// RECIPES
// ============================================================
const RECIPES = [
  // Smelting
  { id: 'smelt-iron',   machine: ['stone-furnace','electric-furnace'], time: 3.5, inputs: {'iron-ore':1},   outputs: {'iron-plate':1} },
  { id: 'smelt-copper', machine: ['stone-furnace','electric-furnace'], time: 3.5, inputs: {'copper-ore':1}, outputs: {'copper-plate':1} },
  { id: 'smelt-stone',  machine: ['stone-furnace','electric-furnace'], time: 3.5, inputs: {'stone':2},      outputs: {'stone-brick':1} },
  { id: 'smelt-steel',  machine: ['stone-furnace','electric-furnace'], time: 17.5,inputs: {'iron-plate':5}, outputs: {'steel-plate':1}, requires: 'strom' },

  // Basic assembly
  { id: 'iron-gear',    machine: ['assembler-1','assembler-2'], time: 0.5,  inputs: {'iron-plate':2},                     outputs: {'iron-gear':1} },
  { id: 'copper-wire',  machine: ['assembler-1','assembler-2'], time: 0.5,  inputs: {'copper-plate':1},                   outputs: {'copper-wire':2} },
  { id: 'green-circuit',machine: ['assembler-1','assembler-2'], time: 0.5,  inputs: {'iron-plate':1,'copper-wire':3},     outputs: {'green-circuit':1}, requires: 'elektronik' },
  { id: 'red-circuit',  machine: ['assembler-2'],               time: 6,    inputs: {'green-circuit':2,'copper-wire':4,'plastic':2}, outputs: {'red-circuit':1}, requires: 'produktion' },

  // Chemistry
  { id: 'plastic',      machine: ['chemical-plant'], time: 1, inputs: {'coal':1,'iron-plate':1},            outputs: {'plastic':2}, requires: 'chemie' },

  // Science packs
  { id: 'auto-science', machine: ['assembler-1','assembler-2'], time: 5, inputs: {'copper-plate':1,'iron-gear':1},        outputs: {'auto-science':1} },
  { id: 'log-science',  machine: ['assembler-1','assembler-2'], time: 6, inputs: {'iron-plate':1,'green-circuit':1},      outputs: {'log-science':1}, requires: 'elektronik' },
  { id: 'chem-science', machine: ['assembler-2'],               time: 24, inputs: {'plastic':2,'steel-plate':1,'red-circuit':1}, outputs: {'chem-science':1}, requires: 'chemie' },

  // Goal
  { id: 'rocket-part',  machine: ['assembler-2'], time: 30,
    inputs: {'iron-plate':10,'copper-plate':10,'plastic':10},
    outputs: {'rocket-part':1},
    requires: 'raketentech' },
];

// ============================================================
// TECH TREE
// ============================================================
const TECH_TREE = [
  {
    id: 'automatisierung',
    name: 'Automatisierung',
    icon: '⚙️',
    desc: 'Schaltet Montageanlage 1 frei.',
    cost: {'auto-science': 10},
    duration: 300,
    unlocks: ['assembler-1'],
    requires: [],
  },
  {
    id: 'logistik',
    name: 'Logistik',
    icon: '📦',
    desc: 'Verdoppelt Förderband-Kapazität (30 Items/s).',
    cost: {'auto-science': 15},
    duration: 400,
    unlocks: ['faster-belt'],
    requires: ['automatisierung'],
  },
  {
    id: 'elektronik',
    name: 'Elektronik',
    icon: '🔌',
    desc: 'Schaltet Grüne Schaltung und Log-Wissenschaft frei.',
    cost: {'auto-science': 20},
    duration: 500,
    unlocks: [],
    requires: ['automatisierung'],
  },
  {
    id: 'strom',
    name: 'Stromtechnik',
    icon: '⚡',
    desc: 'Schaltet Elektroofen und Solarpanel frei.',
    cost: {'auto-science': 25},
    duration: 600,
    unlocks: ['electric-furnace','solar-panel'],
    requires: ['automatisierung'],
  },
  {
    id: 'produktion',
    name: 'Produktion',
    icon: '🏭',
    desc: 'Schaltet Montageanlage 2 und Rote Schaltung frei.',
    cost: {'auto-science': 30, 'log-science': 20},
    duration: 800,
    unlocks: ['assembler-2'],
    requires: ['elektronik','logistik'],
  },
  {
    id: 'chemie',
    name: 'Chemietechnik',
    icon: '⚗️',
    desc: 'Schaltet Chemiefabrik und Kunststoff frei.',
    cost: {'auto-science': 40, 'log-science': 30},
    duration: 900,
    unlocks: ['chemical-plant'],
    requires: ['produktion'],
  },
  {
    id: 'raketentech',
    name: 'Raketenforschung',
    icon: '🚀',
    desc: 'Schaltet das Raketensilo frei. Endspiel!',
    cost: {'auto-science': 50, 'log-science': 50, 'chem-science': 50},
    duration: 2000,
    unlocks: ['rocket-silo'],
    requires: ['chemie'],
  },
];

// ============================================================
// RESOURCE PATCHES (template — game.js will place these)
// ============================================================
const RESOURCE_PATCHES = [
  { item: 'iron-ore',    count: 3 },
  { item: 'copper-ore',  count: 2 },
  { item: 'coal',        count: 2 },
  { item: 'stone',       count: 1 },
];
