// ============================================================
// STATE
// ============================================================
const GRID_SIZE = 30;
const BELT_CAPACITY = 15;

// Direction helpers for belt adjacency tracing
const DIR_VEC = { right:{dx:1,dy:0}, left:{dx:-1,dy:0}, up:{dx:0,dy:-1}, down:{dx:0,dy:1} };
const OPP_DIR = { right:'left', left:'right', up:'down', down:'up' };
function isBeltType(t) { return t === 'belt' || t === 'fast-belt'; }

let S = null;
let _entityCounter = 0;

function defaultState() {
  return {
    tick: 0,
    grid: Array(GRID_SIZE * GRID_SIZE).fill(null),
    entities: [],
    connections: [],
    items: {},
    energy: { generated: 0, consumed: 0 },
    research: {},
    activeResearch: null,
    goal: { rocketParts: 0, launched: false },
    resources: {},
    _nextId: 1,
  };
}

function initGame() {
  const saved = localStorage.getItem('fabrik_save');
  if (saved) {
    try {
      S = JSON.parse(saved);
      _entityCounter = S._nextId || 1;
      recalcConnections(); // rebuild from belt layout, don't use stale saved connections
      notify('Spielstand geladen');
    } catch(e) {
      S = defaultState();
      placeResourcePatches();
    }
  } else {
    S = defaultState();
    placeResourcePatches();
  }
  window._tickInterval = setInterval(tick, 100);
}

// ============================================================
// RESOURCE PATCHES
// ============================================================
function placeResourcePatches() {
  const rng = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const occupied = new Set();

  function placeCluster(item, count) {
    let attempts = 0;
    const placed = [];
    while (placed.length < count && attempts < 200) {
      attempts++;
      const cx = rng(3, GRID_SIZE - 4);
      const cy = rng(3, GRID_SIZE - 4);
      const key = cx + ',' + cy;
      if (occupied.has(key)) continue;
      // Check nearby cluster overlap (min 5 cells apart from other patches)
      let tooClose = false;
      for (const oKey of occupied) {
        const [ox, oy] = oKey.split(',').map(Number);
        if (Math.abs(ox - cx) < 4 && Math.abs(oy - cy) < 4) { tooClose = true; break; }
      }
      if (tooClose) continue;
      // Place 3x3 cluster
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            const k = nx + ',' + ny;
            if (!occupied.has(k)) {
              occupied.add(k);
              if (!S.resources[k]) S.resources[k] = item;
            }
          }
        }
      }
      placed.push(key);
    }
  }

  RESOURCE_PATCHES.forEach(p => {
    for (let i = 0; i < p.count; i++) placeCluster(p.item, p.count);
  });
}

// ============================================================
// ENTITY MANAGEMENT
// ============================================================
function cellIndex(x, y) { return y * GRID_SIZE + x; }

function placeEntity(machineId, x, y, recipe) {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return null;
  const idx = cellIndex(x, y);
  if (S.grid[idx]) return null;

  const machine = MACHINES.find(m => m.id === machineId);
  if (!machine) return null;
  if (!machine.unlocked && !isTechUnlocked(machine.requires)) return null;

  // Miner must be placed on resource
  if (machine.placesOn) {
    const resKey = x + ',' + y;
    const res = S.resources[resKey];
    if (!res || !machine.placesOn.includes(res)) return null;
  }

  const id = S._nextId++;
  const entity = {
    id, type: machineId, x, y,
    recipe: recipe || null,
    direction: 'right', // used by belts; set by renderer after placement
    progress: 0,
    active: false,
    nopower: false,
    inventory: {},
    outputBuffer: {},
  };
  S.entities.push(entity);
  S.grid[idx] = id;
  recalcConnections();
  return entity;
}

function removeEntity(id) {
  S.entities = S.entities.filter(e => e.id !== id);
  S.grid = S.grid.map(v => v === id ? null : v);
  recalcConnections();
}

function getEntity(id) { return S.entities.find(e => e.id === id); }
function getEntityAt(x, y) {
  const id = S.grid[cellIndex(x, y)];
  return id ? getEntity(id) : null;
}

// ============================================================
// BELT-PATH CONNECTIONS (auto-generated from belt layout)
// ============================================================

function traceBeltChain(startBelt) {
  let current = startBelt;
  const visited = new Set([startBelt.id]);
  for (let i = 0; i < 200; i++) {
    const {dx, dy} = DIR_VEC[current.direction || 'right'];
    const next = getEntityAt(current.x + dx, current.y + dy);
    if (!next) return null;
    if (isBeltType(next.type)) {
      if (visited.has(next.id)) return null; // loop
      visited.add(next.id);
      current = next;
    } else {
      return next; // reached a machine
    }
  }
  return null;
}

function recalcConnections() {
  if (!S) return;
  S.connections = [];
  const machines = S.entities.filter(e => !isBeltType(e.type));
  for (const machine of machines) {
    for (const vec of Object.values(DIR_VEC)) {
      const adj = getEntityAt(machine.x + vec.dx, machine.y + vec.dy);
      if (!adj || !isBeltType(adj.type)) continue;
      // Belt input side must face this machine
      const inputVec = DIR_VEC[OPP_DIR[adj.direction || 'right']];
      if (adj.x + inputVec.dx !== machine.x || adj.y + inputVec.dy !== machine.y) continue;
      const dest = traceBeltChain(adj);
      if (!dest || dest.id === machine.id) continue;
      const item = getMainOutput(machine);
      if (!item) continue;
      const dup = S.connections.find(c => c.fromId===machine.id && c.toId===dest.id && c.item===item);
      if (dup) continue;
      const cap = adj.type === 'fast-belt' ? 30 : 15;
      S.connections.push({ fromId: machine.id, toId: dest.id, item, capacity: cap });
    }
  }
}

// ============================================================
// TICK LOOP
// ============================================================
function tick() {
  S.tick++;
  calcEnergy();
  tickEntities();
  tickResearch();
  if (S.tick % 300 === 0) save();
  updateHUD();
}

// ============================================================
// ENERGY
// ============================================================
function calcEnergy() {
  let gen = 0, con = 0;
  for (const e of S.entities) {
    const m = MACHINES.find(m => m.id === e.type);
    if (!m) continue;
    if (m.energyKW < 0) {
      // Generator
      if (m.fuelItem) {
        const fuelNeeded = m.fuelPerSec / 10;
        const available = S.items[m.fuelItem] || 0;
        if (available >= fuelNeeded) {
          S.items[m.fuelItem] = Math.max(0, available - fuelNeeded);
          gen += Math.abs(m.energyKW);
          e.active = true;
        } else {
          e.active = false;
        }
      } else {
        gen += Math.abs(m.energyKW);
        e.active = true;
      }
    } else if (m.energyKW > 0) {
      con += m.energyKW;
    }
  }
  S.energy.generated = gen;
  S.energy.consumed = con;
  const deficit = con > gen;
  for (const e of S.entities) {
    const m = MACHINES.find(m => m.id === e.type);
    if (!m || m.energyKW <= 0) continue;
    e.nopower = deficit;
  }
}

// ============================================================
// ENTITY TICKING
// ============================================================
function tickEntities() {
  for (const e of S.entities) {
    if (isBeltType(e.type)) continue; // belts handled via auto-connections
    if (e.nopower) continue;
    const m = MACHINES.find(m => m.id === e.type);
    if (!m) continue;

    switch (m.category) {
      case 'extraction': tickMiner(e, m); break;
      case 'smelting':   tickFurnace(e, m); break;
      case 'assembly':
      case 'chemistry':  tickAssembler(e, m); break;
      case 'research':   tickLab(e); break;
      case 'goal':       tickSilo(e); break;
    }
    // Push outputs into global items pool via connections
    pushOutputs(e);
    // Pull inputs from global items pool via connections
    pullInputs(e);
  }
}

function tickMiner(e, m) {
  const resKey = e.x + ',' + e.y;
  const resource = S.resources[resKey];
  if (!resource) return;
  e.active = true;
  // 0.5 items/s = 0.05 items/tick
  e.outputBuffer[resource] = (e.outputBuffer[resource] || 0) + 0.05;
}

function tickFurnace(e, m) {
  if (!e.recipe) {
    // Auto-detect recipe from inventory
    for (const r of RECIPES) {
      if (!r.machine.includes(e.type)) continue;
      if (r.requires && !S.research[r.requires]) continue;
      const canCraft = Object.entries(r.inputs).every(([item, amt]) =>
        (e.inventory[item] || 0) >= amt * (1 / (r.time * 10))
      );
      if (canCraft || Object.keys(e.inventory).some(k => Object.keys(r.inputs).includes(k))) {
        e.recipe = r.id;
        break;
      }
    }
  }
  if (!e.recipe) return;
  const recipe = RECIPES.find(r => r.id === e.recipe);
  if (!recipe) return;
  if (m.id === 'stone-furnace') {
    const coalNeeded = 0.05;
    if ((e.inventory['coal'] || 0) < coalNeeded) return;
    e.inventory['coal'] = (e.inventory['coal'] || 0) - coalNeeded;
  }
  craftTick(e, recipe, 1);
}

function tickAssembler(e, m) {
  if (!e.recipe) return;
  const recipe = RECIPES.find(r => r.id === e.recipe);
  if (!recipe) return;
  if (!recipe.machine.includes(e.type)) return;
  if (recipe.requires && !S.research[recipe.requires]) return;
  const speedMult = m.id === 'assembler-2' ? 2 : 1;
  craftTick(e, recipe, speedMult);
}

function craftTick(e, recipe, speedMult) {
  const ticksNeeded = recipe.time * 10 / speedMult;
  const needed = Object.entries(recipe.inputs).every(([item, amt]) =>
    (e.inventory[item] || 0) >= amt
  );
  if (!needed) { e.active = false; return; }
  e.active = true;
  e.progress += 1;
  if (e.progress >= ticksNeeded) {
    e.progress = 0;
    Object.entries(recipe.inputs).forEach(([item, amt]) => {
      e.inventory[item] = Math.max(0, (e.inventory[item] || 0) - amt);
    });
    Object.entries(recipe.outputs).forEach(([item, amt]) => {
      e.outputBuffer[item] = (e.outputBuffer[item] || 0) + amt;
    });
  }
}

function tickLab(e) {
  if (!S.activeResearch) { e.active = false; return; }
  const tech = TECH_TREE.find(t => t.id === S.activeResearch.id);
  if (!tech) return;
  const canFeed = Object.entries(tech.cost).every(([item, amt]) =>
    (e.inventory[item] || 0) >= 0.01
  );
  if (!canFeed) { e.active = false; return; }
  e.active = true;
  Object.keys(tech.cost).forEach(item => {
    e.inventory[item] = Math.max(0, (e.inventory[item] || 0) - 0.005);
  });
  S.activeResearch.progress += 1;
  if (S.activeResearch.progress >= tech.duration) {
    completeResearch(tech);
  }
}

function tickSilo(e) {
  const parts = Math.floor(S.items['rocket-part'] || 0);
  const needed = 20 - S.goal.rocketParts;
  if (needed <= 0) return;
  if (parts >= 1) {
    const take = Math.min(parts, needed);
    S.items['rocket-part'] = (S.items['rocket-part'] || 0) - take;
    S.goal.rocketParts += take;
    e.active = true;
  }
  if (S.goal.rocketParts >= 20 && !S.goal.launched) {
    S.goal.launched = true;
    setTimeout(() => showVictory(), 500);
  }
}

// ============================================================
// ITEM FLOW
// ============================================================
function pushOutputs(e) {
  const outConns = S.connections.filter(c => c.fromId === e.id);
  for (const conn of outConns) {
    const available = e.outputBuffer[conn.item] || 0;
    if (available <= 0) continue;
    const flowPerTick = conn.capacity / 10;
    const flow = Math.min(available, flowPerTick);
    e.outputBuffer[conn.item] -= flow;
    const dest = getEntity(conn.toId);
    if (dest) {
      dest.inventory[conn.item] = (dest.inventory[conn.item] || 0) + flow;
    } else {
      S.items[conn.item] = (S.items[conn.item] || 0) + flow;
    }
  }
  // Unconnected outputs go to global pool
  for (const [item, amt] of Object.entries(e.outputBuffer)) {
    if (amt > 0 && !S.connections.find(c => c.fromId === e.id && c.item === item)) {
      S.items[item] = (S.items[item] || 0) + amt;
      e.outputBuffer[item] = 0;
    }
  }
}

function pullInputs(e) {
  const inConns = S.connections.filter(c => c.toId === e.id);
  for (const conn of inConns) {
    const available = S.items[conn.item] || 0;
    if (available <= 0) continue;
    const flowPerTick = conn.capacity / 10;
    const flow = Math.min(available, flowPerTick);
    S.items[conn.item] -= flow;
    e.inventory[conn.item] = (e.inventory[conn.item] || 0) + flow;
  }
}

// ============================================================
// RESEARCH
// ============================================================
function startResearch(techId) {
  if (S.research[techId]) return;
  if (S.activeResearch) return;
  const tech = TECH_TREE.find(t => t.id === techId);
  if (!tech) return;
  if (tech.requires.some(r => !S.research[r])) return;
  S.activeResearch = { id: techId, progress: 0 };
}

function completeResearch(tech) {
  S.research[tech.id] = true;
  S.activeResearch = null;
  tech.unlocks.forEach(id => {
    const m = MACHINES.find(m => m.id === id);
    if (m) m.unlocked = true;
  });
  notify(`✅ Forschung abgeschlossen: ${tech.name}`);
  if (typeof renderSidebar === 'function') renderSidebar();
}

function tickResearch() {
  // Research ticking handled in tickLab; if no labs exist, tick slowly anyway
  if (!S.activeResearch) return;
  const labs = S.entities.filter(e => e.type === 'lab');
  if (labs.length === 0) {
    // No lab — no research progress
  }
}

function isTechUnlocked(requiresId) {
  if (!requiresId) return true;
  return !!S.research[requiresId];
}

function getMainOutput(entity) {
  const m = MACHINES.find(m => m.id === entity.type);
  if (!m) return null;
  if (m.category === 'extraction') {
    return S.resources[entity.x + ',' + entity.y] || null;
  }
  if (entity.recipe) {
    const r = RECIPES.find(r => r.id === entity.recipe);
    if (r) return Object.keys(r.outputs)[0];
  }
  return null;
}

// ============================================================
// SAVE / LOAD
// ============================================================
function save() {
  S._nextId = _entityCounter;
  localStorage.setItem('fabrik_save', JSON.stringify(S));
}

function newGame() {
  if (!confirm('Neues Spiel starten? Spielstand wird gelöscht.')) return;
  localStorage.removeItem('fabrik_save');
  S = defaultState();
  // Re-unlock base machines
  MACHINES.forEach(m => {
    if (m.unlocked === undefined) m.unlocked = false;
  });
  // Reset unlocked state to defaults
  MACHINES.filter(m => !m.requires).forEach(m => m.unlocked = true);
  placeResourcePatches();
  if (typeof initRenderer === 'function') initRenderer();
  notify('Neues Spiel gestartet');
}

// ============================================================
// HUD
// ============================================================
function updateHUD() {
  const el = id => document.getElementById(id);

  // Energy
  const eText = el('hud-energy-text');
  const eChip = el('hud-energy');
  if (eText) {
    const g = Math.round(S.energy.generated);
    const c = Math.round(S.energy.consumed);
    eText.textContent = `${g}/${c} kW`;
    if (eChip) eChip.style.color = c > g ? '#ffb4ab' : '';
  }

  // Research
  const rText = el('hud-research-text');
  if (rText) {
    if (S.activeResearch) {
      const tech = TECH_TREE.find(t => t.id === S.activeResearch.id);
      const pct = Math.floor(S.activeResearch.progress / tech.duration * 100);
      rText.textContent = `${tech.name} ${pct}%`;
    } else {
      rText.textContent = '—';
    }
  }

  // Goal
  const gText = el('hud-goal-text');
  if (gText) gText.textContent = `${S.goal.rocketParts}/20`;
}

// ============================================================
// VICTORY
// ============================================================
function showVictory() {
  const overlay = document.getElementById('victory-overlay');
  if (overlay) overlay.style.display = 'flex';
  save();
}

// ============================================================
// NOTIFY
// ============================================================
function notify(msg) {
  const el = document.getElementById('notify');
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.opacity = '0', 3000);
}
