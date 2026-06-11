// ============================================================
// RENDERER — Canvas 2D  (Biopunk Redesign)
// ============================================================
const CELL = 48;
const CELL_HALF = CELL / 2;

let canvas, ctx;
let camX = 0, camY = 0, camZoom = 1;
let dragging = false, dragStart = { x: 0, y: 0 }, camStart = { x: 0, y: 0 };

// Placement state
let selectedMachine = null;
let beltDirection = 'right';
let selectedEntity = null;
let _hoverCell = null;

const DIRS      = ['right', 'down', 'left', 'up'];
const DIR_ARROW = { right: '→', left: '←', up: '↑', down: '↓' };
const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

function initRenderer() {
  canvas = document.getElementById('fabrik-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);

  camX = (canvas.width  / 2) - (GRID_SIZE * CELL / 2);
  camY = (canvas.height / 2) - (GRID_SIZE * CELL / 2);

  renderSidebar();
  renderInfoPanel(null);

  // Smooth animation loop (60fps)
  (function loop() { renderFrame(); requestAnimationFrame(loop); })();
}

function resizeCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
}

// ============================================================
// KEYBOARD
// ============================================================
function onKeyDown(e) {
  if (e.key === 'r' || e.key === 'R') {
    const idx = DIRS.indexOf(beltDirection);
    beltDirection = DIRS[(idx + 1) % 4];
    updateDirectionIndicator();
  }
  if (e.key === 'Escape') {
    selectedMachine = null;
    selectedEntity  = null;
    renderSidebar();
    renderInfoPanel(null);
  }
}

function updateDirectionIndicator() {
  const el = document.getElementById('belt-dir-indicator');
  if (el) el.textContent = `Richtung: ${DIR_ARROW[beltDirection]}  (R drehen)`;
  renderSidebar();
}

// ============================================================
// MAIN RENDER
// ============================================================
function renderFrame() {
  if (!S) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(camX, camY);
  ctx.scale(camZoom, camZoom);

  drawAtmosphere();
  drawGrid();
  drawResources();
  drawConnections();   // Bézier nerve paths
  drawBelts();
  drawEntities();      // circular nodes
  drawPlacementPreview();

  ctx.restore();
}

// ============================================================
// ATMOSPHERE — soft bioluminescent fog
// ============================================================
function drawAtmosphere() {
  const W = GRID_SIZE * CELL, H = GRID_SIZE * CELL;
  const pools = [
    { x: W * 0.15, y: H * 0.75, r: W * 0.4,  c: 'rgba(0,140,110,0.07)' },
    { x: W * 0.82, y: H * 0.20, r: W * 0.35, c: 'rgba(0,140,110,0.05)' },
    { x: W * 0.50, y: H * 0.50, r: W * 0.55, c: 'rgba(0,40,60,0.12)'   },
  ];
  for (const p of pools) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, p.c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

// ============================================================
// GRID
// ============================================================
function drawGrid() {
  ctx.strokeStyle = 'rgba(0,254,223,0.04)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= GRID_SIZE; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, GRID_SIZE * CELL); ctx.stroke();
  }
  for (let y = 0; y <= GRID_SIZE; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(GRID_SIZE * CELL, y * CELL); ctx.stroke();
  }
}

// ============================================================
// RESOURCES (ore patches)
// ============================================================
function drawResources() {
  for (const [key, item] of Object.entries(S.resources)) {
    const [x, y] = key.split(',').map(Number);
    const def = ITEMS[item];
    if (!def) continue;
    // Subtle tinted cell
    ctx.fillStyle = def.color + '30';
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    ctx.font = `${CELL * 0.38}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, x * CELL + CELL_HALF, y * CELL + CELL_HALF);
  }
}

// ============================================================
// BEZIER CONNECTIONS (nerve paths)
// ============================================================
function drawConnections() {
  if (!S.connections.length) return;
  const dashOffset = (Date.now() / 35) % 20;

  const drawn = new Set();
  for (const conn of S.connections) {
    const key = `${conn.fromId}-${conn.toId}`;
    if (drawn.has(key)) continue;
    drawn.add(key);

    const from = getEntity(conn.fromId);
    const to   = getEntity(conn.toId);
    if (!from || !to) continue;

    const x1 = from.x * CELL + CELL_HALF;
    const y1 = from.y * CELL + CELL_HALF;
    const x2 = to.x   * CELL + CELL_HALF;
    const y2 = to.y   * CELL + CELL_HALF;

    // Perpendicular offset for organic curve feel
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perp = { x: (-dy / len) * Math.min(len * 0.25, 60), y: (dx / len) * Math.min(len * 0.25, 60) };
    const cp1x = x1 + dx * 0.3 + perp.x, cp1y = y1 + dy * 0.3 + perp.y;
    const cp2x = x1 + dx * 0.7 + perp.x, cp2y = y1 + dy * 0.7 + perp.y;

    // Vein glow underlay
    ctx.save();
    ctx.strokeStyle = 'rgba(0,223,196,0.10)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    ctx.stroke();

    // Animated flowing dash
    ctx.shadowColor = '#00dfc4';
    ctx.shadowBlur = 10;
    ctx.setLineDash([7, 13]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = 'rgba(0,254,223,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// ============================================================
// BELT RENDERING  — vein / tube style
// ============================================================
function drawBelts() {
  const beltItems = new Map();
  for (const conn of S.connections) {
    const from = getEntity(conn.fromId);
    const to   = getEntity(conn.toId);
    if (!from || !to) continue;
    let cur = null;
    for (const vec of Object.values(DIR_VEC)) {
      const adj = getEntityAt(from.x + vec.dx, from.y + vec.dy);
      if (!adj || !isBeltType(adj.type)) continue;
      const iv = DIR_VEC[OPP_DIR[adj.direction || 'right']];
      if (adj.x + iv.dx === from.x && adj.y + iv.dy === from.y) { cur = adj; break; }
    }
    if (!cur) continue;
    const visited = new Set();
    while (cur && isBeltType(cur.type) && !visited.has(cur.id)) {
      beltItems.set(cur.id, ITEMS[conn.item]);
      visited.add(cur.id);
      const { dx, dy } = DIR_VEC[cur.direction || 'right'];
      cur = getEntityAt(cur.x + dx, cur.y + dy);
    }
  }
  for (const e of S.entities) {
    if (!isBeltType(e.type)) continue;
    drawBeltTile(e, beltItems.get(e.id));
  }
}

function drawBeltTile(e, itemDef) {
  const px = e.x * CELL, py = e.y * CELL;
  const dir = e.direction || 'right';
  const isFast = e.type === 'fast-belt';
  const cx = px + CELL_HALF, cy = py + CELL_HALF;
  const tubeR = CELL_HALF - 13;

  const vc = isFast ? 'rgba(255,185,90,' : 'rgba(0,254,223,';

  ctx.save();

  // Tube circle
  ctx.fillStyle = vc + '0.09)';
  ctx.beginPath();
  ctx.arc(cx, cy, tubeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = vc + '0.32)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Direction chevron
  ctx.translate(cx, cy);
  ctx.rotate(DIR_ANGLE[dir]);
  ctx.shadowColor = isFast ? 'rgba(255,185,90,0.8)' : 'rgba(0,254,223,0.8)';
  ctx.shadowBlur = 5;
  ctx.strokeStyle = vc + '0.88)';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-5, -4); ctx.lineTo(2, 0); ctx.lineTo(-5, 4);
  ctx.stroke();
  ctx.restore();

  // Item icon
  if (itemDef) {
    ctx.font = '9px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(itemDef.icon, cx, cy - tubeR + 5);
  }

  // Selection ring
  if (selectedEntity && selectedEntity.id === e.id) {
    ctx.strokeStyle = '#00fedf';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6);
  }
}

// ============================================================
// ENTITIES — circular bioluminescent nodes
// ============================================================
function drawEntities() {
  const now = Date.now();
  for (const e of S.entities) {
    if (isBeltType(e.type)) continue;
    const m = MACHINES.find(m => m.id === e.type);
    if (!m) continue;

    const cx = e.x * CELL + CELL_HALF;
    const cy = e.y * CELL + CELL_HALF;
    const r  = CELL_HALF - 5;
    const isSelected = selectedEntity && selectedEntity.id === e.id;

    ctx.save();

    // Outer pulse ring (active)
    if (e.active && !e.nopower) {
      const pulse = 0.35 + 0.35 * Math.sin(now / 1300 + e.id * 1.7);
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4 + pulse * 5, 0, Math.PI * 2);
      ctx.strokeStyle = m.color + '2a';
      ctx.lineWidth = 3;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
    }

    // Fill
    ctx.shadowBlur = e.active && !e.nopower ? 16 : 0;
    ctx.shadowColor = m.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = e.nopower ? 'rgba(147,0,10,0.45)'
      : e.active ? m.color + 'bb' : m.color + '44';
    ctx.fill();

    // Border ring
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isSelected ? '#00fedf'
      : e.nopower ? '#ffb4ab' : m.color + 'cc';
    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.stroke();
    ctx.restore();

    // Label above node (when zoomed in enough)
    if (camZoom > 0.55) {
      ctx.font = `700 ${Math.round(7 / camZoom * camZoom)}px "Plus Jakarta Sans", sans-serif`;
      ctx.font = '7px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = e.active ? 'rgba(0,254,223,0.85)' : 'rgba(185,202,197,0.55)';
      const label = (m.name.toUpperCase() + (e.active && !e.nopower ? ' ◉' : '')).slice(0, 18);
      ctx.fillText(label, cx, cy - r - 4);
    }

    // Machine icon
    ctx.font = `${CELL * 0.38}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = e.nopower ? '#ffb4ab' : '#fff';
    ctx.fillText(m.icon, cx, cy - 2);

    // Progress arc around the circle
    if (e.active && e.progress > 0) {
      const recipe = RECIPES.find(rec => rec.id === e.recipe);
      if (recipe) {
        const speedMult = m.id === 'assembler-2' ? 2 : 1;
        const total = recipe.time * 10 / speedMult;
        const pct   = e.progress / total;
        ctx.save();
        ctx.shadowColor = '#00fedf';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
        ctx.strokeStyle = '#00fedf';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }
    }

    // No-power warning
    if (e.nopower) {
      ctx.font = '10px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('⚡', cx + r - 3, cy - r + 1);
    }
  }
}

// ============================================================
// PLACEMENT PREVIEW
// ============================================================
function drawPlacementPreview() {
  if (!selectedMachine || !_hoverCell) return;
  const { x, y } = _hoverCell;
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
  const m = MACHINES.find(m => m.id === selectedMachine);
  if (!m) return;

  const occupied = !!S.grid[cellIndex(x, y)];
  let canPlace = !occupied;
  if (m.placesOn) {
    const res = S.resources[x + ',' + y];
    canPlace = !occupied && res && m.placesOn.includes(res);
  }

  const cx = x * CELL + CELL_HALF, cy = y * CELL + CELL_HALF;

  if (isBeltType(selectedMachine)) {
    ctx.fillStyle = canPlace ? 'rgba(0,254,223,0.15)' : 'rgba(255,180,171,0.15)';
    ctx.strokeStyle = canPlace ? '#00fedf' : '#ffb4ab';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
    // Direction arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(DIR_ANGLE[beltDirection]);
    ctx.strokeStyle = canPlace ? 'rgba(0,254,223,0.9)' : 'rgba(255,180,171,0.9)';
    ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -7); ctx.lineTo(6, 0); ctx.lineTo(-4, 7);
    ctx.stroke();
    ctx.restore();
  } else {
    // Circular preview for machines
    ctx.save();
    ctx.shadowColor = canPlace ? '#00fedf' : '#ffb4ab';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL_HALF - 5, 0, Math.PI * 2);
    ctx.fillStyle = canPlace ? 'rgba(0,254,223,0.2)' : 'rgba(255,180,171,0.2)';
    ctx.fill();
    ctx.strokeStyle = canPlace ? '#00fedf' : '#ffb4ab';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.font = `${CELL * 0.42}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(m.icon, cx, cy);
  }
}

// ============================================================
// MOUSE
// ============================================================
function canvasToGrid(cx, cy) {
  const gx = Math.floor((cx - camX) / (CELL * camZoom));
  const gy = Math.floor((cy - camY) / (CELL * camZoom));
  return { x: gx, y: gy };
}

function onMouseDown(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top;

  if (e.button === 2) {
    const cell = canvasToGrid(cx, cy);
    const ent  = getEntityAt(cell.x, cell.y);
    if (ent) { removeEntity(ent.id); selectedEntity = null; renderInfoPanel(null); }
    else { selectedMachine = null; renderSidebar(); }
    return;
  }

  if (e.button === 0) {
    const cell = canvasToGrid(cx, cy);
    if (selectedMachine) {
      const placed = placeEntity(selectedMachine, cell.x, cell.y);
      if (placed && isBeltType(selectedMachine)) { placed.direction = beltDirection; recalcConnections(); }
      if (!placed) notify('Kann hier nicht platziert werden');
      return;
    }
    const ent = getEntityAt(cell.x, cell.y);
    if (ent) {
      selectedEntity = ent;
      renderInfoPanel(ent);
    } else {
      selectedEntity = null;
      renderInfoPanel(null);
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      camStart  = { x: camX, y: camY };
    }
  }
}

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  _hoverCell = canvasToGrid(e.clientX - rect.left, e.clientY - rect.top);
  if (dragging) {
    camX = camStart.x + (e.clientX - dragStart.x);
    camY = camStart.y + (e.clientY - dragStart.y);
  }
}

function onMouseUp()  { dragging = false; }

function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  camZoom = Math.max(0.3, Math.min(2.5, camZoom * factor));
}

// ============================================================
// SIDEBAR (inside right panel)
// ============================================================
function renderSidebar(filterCat) {
  const sb = document.getElementById('sidebar');
  if (!sb) return;

  const categories = ['extraction','transport','smelting','assembly','chemistry','power','research','goal'];
  const catLabels = {
    extraction:'⛏️ Abbau', transport:'📦 Transport',
    smelting:'🔥 Schmelzen', assembly:'🏭 Montage',
    chemistry:'⚗️ Chemie', power:'⚡ Energie',
    research:'🔬 Forschung', goal:'🚀 Ziel',
  };

  let html = `<div class="sb-title">Gebäude platzieren</div>`;
  const cats = filterCat ? [filterCat] : categories;

  for (const cat of cats) {
    const machines = MACHINES.filter(m => m.category === cat);
    if (!machines.length) continue;
    html += `<div class="sb-cat">${catLabels[cat] || cat}</div>`;
    for (const m of machines) {
      const locked = !m.unlocked;
      const active = selectedMachine === m.id;
      html += `<button class="sb-btn${active?' active':''}${locked?' locked':''}"
        onclick="selectMachine('${m.id}')"
        title="${m.desc}${locked ? '\n🔒 '+m.requires : ''}">
        <span class="sb-icon">${m.icon}</span>
        <span class="sb-name">${m.name}</span>
        ${locked ? '<span class="sb-lock">🔒</span>' : ''}
      </button>`;
    }
  }

  // Belt direction control
  const isBeltSelected = selectedMachine && isBeltType(selectedMachine);
  html += `<div class="sb-divider"></div>`;
  if (isBeltSelected) {
    html += `<div class="belt-dir-box">
      Richtung: <strong>${DIR_ARROW[beltDirection]}</strong><br>
      <span class="belt-dir-hint">R = drehen</span>
      <div class="belt-dir-btns">
        ${DIRS.map(d => `<button class="dir-btn${beltDirection===d?' active':''}" onclick="setBeltDir('${d}')">${DIR_ARROW[d]}</button>`).join('')}
      </div>
    </div>`;
  }

  sb.innerHTML = html;
}

function selectMachine(id) {
  const m = MACHINES.find(m => m.id === id);
  if (!m || !m.unlocked) return;
  selectedMachine = selectedMachine === id ? null : id;
  renderSidebar();
}

function setBeltDir(dir) {
  beltDirection = dir;
  renderSidebar();
}

// ============================================================
// INFO PANEL (inspector, inside right panel)
// ============================================================
function renderInfoPanel(ent) {
  const panel = document.getElementById('info-panel');
  if (!panel) return;

  // Auto-switch tab
  if (typeof switchRightTab === 'function') {
    switchRightTab(ent ? 'inspect' : 'build');
  }

  if (!ent) {
    panel.innerHTML = '<div class="info-hint">Klicke ein Gebäude für Details.<br>Rechtsklick = Abbauen.<br><br><em>Förderbänder verbinden Gebäude:<br>Eingang ← Band → Ausgang</em></div>';
    return;
  }

  const m      = MACHINES.find(m => m.id === ent.type);
  const recipe = ent.recipe ? RECIPES.find(r => r.id === ent.recipe) : null;

  let html = `<div class="info-title">${m.icon} ${m.name}</div>`;

  if (isBeltType(ent.type)) {
    html += `<div class="info-row">Richtung: ${DIR_ARROW[ent.direction || 'right']}</div>
      <div class="info-label">Richtung ändern:</div>
      <div class="belt-dir-btns">
        ${DIRS.map(d => `<button class="dir-btn${(ent.direction||'right')===d?' active':''}" onclick="setBeltDirOnEntity(${ent.id},'${d}')">${DIR_ARROW[d]}</button>`).join('')}
      </div>`;
    html += `<button class="info-remove-btn" onclick="removeEntityById(${ent.id})">🗑️ Abbauen</button>`;
    panel.innerHTML = html;
    return;
  }

  html += `<div class="info-status ${ent.nopower?'error':ent.active?'ok':'warn'}">
    ${ent.nopower ? '⚡ Kein Strom' : ent.active ? '▶ Aktiv' : '⏸ Inaktiv'}
  </div>`;

  if (m.energyKW) {
    const sign = m.energyKW < 0 ? '+' : '-';
    html += `<div class="info-row">⚡ ${sign}${Math.abs(m.energyKW)} kW</div>`;
  }

  if (m.category === 'assembly' || m.category === 'chemistry' || m.category === 'smelting') {
    const available = RECIPES.filter(r => r.machine.includes(ent.type) && (!r.requires || S.research[r.requires]));
    html += `<div class="info-label">Rezept:</div>
      <select onchange="setRecipe(${ent.id}, this.value)" class="info-select">
        <option value="">— ${m.category==='smelting'?'auto':'wählen'} —</option>
        ${available.map(r => `<option value="${r.id}" ${ent.recipe===r.id?'selected':''}>${r.id}</option>`).join('')}
      </select>`;
  }

  if (recipe) {
    html += `<div class="info-label">Eingabe:</div><div class="info-items">`;
    Object.entries(recipe.inputs).forEach(([item, amt]) => {
      const def = ITEMS[item];
      html += `<div class="info-item">${def?.icon||''} ${def?.name||item} ×${amt}</div>`;
    });
    html += `</div><div class="info-label">Ausgabe:</div><div class="info-items">`;
    Object.entries(recipe.outputs).forEach(([item, amt]) => {
      const def = ITEMS[item];
      html += `<div class="info-item">${def?.icon||''} ${def?.name||item} ×${amt}</div>`;
    });
    html += `</div>`;
  }

  const invEntries = Object.entries(ent.inventory).filter(([, v]) => v > 0.01);
  if (invEntries.length) {
    html += `<div class="info-label">Lager:</div><div class="info-items">`;
    invEntries.forEach(([item, amt]) => {
      const def = ITEMS[item];
      html += `<div class="info-item">${def?.icon||''} ${def?.name||item}: ${amt.toFixed(1)}</div>`;
    });
    html += `</div>`;
  }

  const outConns = S.connections.filter(c => c.fromId === ent.id);
  if (outConns.length) {
    html += `<div class="info-label">Verbunden mit:</div>`;
    outConns.forEach(c => {
      const dest = getEntity(c.toId);
      const dm   = dest ? MACHINES.find(m => m.id === dest.type) : null;
      const def  = ITEMS[c.item];
      html += `<div class="info-conn">${def?.icon||''} ${def?.name||c.item} → ${dm?.icon||''} ${dm?.name||'?'}</div>`;
    });
  }

  html += `<button class="info-remove-btn" onclick="removeEntityById(${ent.id})">🗑️ Abbauen</button>`;
  panel.innerHTML = html;
}

function setRecipe(entityId, recipeId) {
  const e = getEntity(entityId);
  if (!e) return;
  e.recipe = recipeId || null;
  e.progress = 0;
  recalcConnections();
}

function setBeltDirOnEntity(id, dir) {
  const e = getEntity(id);
  if (!e) return;
  e.direction = dir;
  recalcConnections();
  renderInfoPanel(e);
}

function removeEntityById(id) {
  removeEntity(id);
  selectedEntity = null;
  renderInfoPanel(null);
}

// ============================================================
// RESEARCH PANEL (modal)
// ============================================================
function openResearchPanel() {
  const modal = document.getElementById('research-modal');
  if (!modal) return;
  let html = `<div class="modal-title">🔬 Forschungsbaum</div>
    <button class="modal-close" onclick="closeResearchPanel()">✕</button>`;

  for (const tech of TECH_TREE) {
    const done     = S.research[tech.id];
    const active   = S.activeResearch && S.activeResearch.id === tech.id;
    const canStart = !done && !active && !S.activeResearch && tech.requires.every(r => S.research[r]);
    const blocked  = tech.requires.some(r => !S.research[r]);
    const pct      = active ? Math.floor(S.activeResearch.progress / tech.duration * 100) : 0;
    const costStr  = Object.entries(tech.cost).map(([item, amt]) => `${ITEMS[item]?.icon||''}×${amt}`).join(' ');

    html += `<div class="tech-card ${done?'done':active?'active':blocked?'blocked':''}">
      <span class="tech-icon">${tech.icon}</span>
      <div class="tech-info">
        <div class="tech-name">${tech.name}</div>
        <div class="tech-desc">${tech.desc}</div>
        <div class="tech-cost">${costStr}</div>
        ${active ? `<div class="tech-progress"><div style="width:${pct}%"></div></div>${pct}%` : ''}
      </div>
      ${done ? '<span class="tech-done">✅</span>' :
        canStart ? `<button class="tech-start" onclick="startResearch('${tech.id}');closeResearchPanel()">▶ Starten</button>` :
        blocked  ? '<span class="tech-blocked">🔒</span>' : '<span class="tech-busy">⏳</span>'}
    </div>`;
  }

  modal.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;position:relative">${html}</div>`;
  modal.style.display = 'flex';
}

function closeResearchPanel() {
  const modal = document.getElementById('research-modal');
  if (modal) modal.style.display = 'none';
}

// ============================================================
// HELPERS
// ============================================================
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
