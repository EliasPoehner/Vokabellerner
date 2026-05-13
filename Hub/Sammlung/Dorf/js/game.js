    // ============================================================
    // PANEL TOGGLE
    // ============================================================
    let _panelOpen = false;
    let _panelFull = false;

    function togglePanel() {
      if (_panelFull) { _panelFull = false; _panelOpen = false; }
      else _panelOpen = !_panelOpen;
      _applyPanelState();
    }

    function togglePanelFullscreen() {
      if (!_panelOpen && !_panelFull) { _panelOpen = true; _panelFull = true; }
      else if (_panelFull) { _panelFull = false; _panelOpen = true; }
      else { _panelFull = true; }
      _applyPanelState();
    }

    function _applyPanelState() {
      const overlay = document.getElementById('panel-overlay');
      const edge = document.getElementById('panel-edge');
      overlay.classList.toggle('open', _panelOpen && !_panelFull);
      overlay.classList.toggle('fullscreen', _panelFull);
      // Arrow: ◀ closed, ▶ open side, ▶ fullscreen
      document.getElementById('edge-arrow').textContent = _panelOpen || _panelFull ? '▶' : '◀';
      // Fullscreen icon
      document.getElementById('edge-full-icon').textContent = _panelFull ? '⊡' : '⛶';
      // Shift edge tab when side panel is open (not fullscreen)
      edge.classList.toggle('shifted', _panelOpen && !_panelFull);
      // Hide edge tab in fullscreen
      edge.classList.toggle('hidden', _panelFull);
      // Re-render for layout change
      if (_panelOpen || _panelFull) renderTab(currentTab);
    }

    // ============================================================
    // STATE
    // ============================================================
    const S = {
      day: 1, tick: 0, prestige: 0, prestigeMult: 1,
      res: { holz: 10, stein: 6, nahrung: 20, gold: 15, eisen: 0, kohle: 0 },
      pop: 2, popTotal: 3, popMax: 10,
      buildings: {}, research: {}, activeResearch: null, eventsHandled: 0, tier: 0, moral: 80,
      lager: { holz: 150, stein: 60, nahrung: 50, gold: 999999, eisen: 30, kohle: 40 },
      modifiers: { nahrungMult: 1, holzMult: 1, steinMult: 1, goldMult: 1, eisenMult: 1, defense: 0 },
      nextEventTick: 0, rathausAlive: true, roads: [],
      obstacles: [
        { id: 'tree_pine', x: -5, z: 3 }, { id: 'tree_pine', x: 3, z: -5 },
        { id: 'tree_pine', x: -3, z: -4 }, { id: 'tree_pine', x: 5, z: 2 },
        { id: 'tree_pine', x: -4, z: 5 }, { id: 'tree_pine', x: 2, z: 6 },
        { id: 'boulder_mossy', x: 5, z: -3 }, { id: 'boulder_mossy', x: -2, z: 5 }
      ]
    };

    // ============================================================
    // CONSTANTS
    // ============================================================
    const LEVEL_MULT = [1.0, 1.3, 1.7, 2.2, 3.0];

    // ============================================================
    // GAME LOGIC (ported from original)
    // ============================================================
    function fmt(n) { n = Math.floor(n); if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1000) return (n / 1000).toFixed(1) + 'k'; return n + ''; }

    function notify(msg, type = 'info') {
      const el = document.getElementById('notify');
      el.textContent = msg; el.className = 'show';
      clearTimeout(el._t); el._t = setTimeout(() => el.className = '', 3000);
    }

    function log(msg, type = '') {
      const el = document.getElementById('log');
      const d = document.createElement('div'); d.className = 'log-entry' + (type ? ' ' + type : '');
      const t = document.createElement('span'); t.className = 'log-time'; t.textContent = 'T' + S.day;
      d.appendChild(t); d.appendChild(document.createTextNode(msg));
      el.prepend(d);
      while (el.children.length > 60) el.removeChild(el.lastChild);
    }

    function getBuildingCount(id) { return (S.buildings[id] || []).length; }
    function getBuildingLevel(id, idx) { return S.buildings[id]?.[idx]?.level || 1; }
    function hasResearch(id) { const v = S.research[id]; return v === true || (v && v.done === true); }
    function usedWorkers() { let u = 0; BUILDINGS.forEach(b => { u += getBuildingCount(b.id) * b.workers; }); return u; }
    function freeWorkers() { return Math.max(0, Math.floor(S.popTotal) - usedWorkers()); }
    function changeMoral(d) { S.moral = Math.max(0, Math.min(100, S.moral + d)); }

    function eventScale() { return 1 + S.tier * 0.5; }

    function getRoadBonus(gx, gz) {
      return 1.0;
    }

    function toggleRoad(key, gx, gz) {
      if (!S.roads) S.roads = [];
      const idx = S.roads.indexOf(key);
      if (idx >= 0) {
        S.roads.splice(idx, 1);
        removeRoadMesh(key);
        S.res.stein = Math.min((S.res.stein || 0) + 1, S.lager.stein);
        notify('Straße entfernt. (+1🪨)');
      } else {
        if ((S.res.stein || 0) < 2) { notify('Zu wenig Stein! (2🪨 nötig)', 'warning'); return; }
        S.res.stein -= 2;
        S.roads.push(key);
        addRoadMesh(key);
        notify('Straße gebaut.');
      }
      save();
    }

    function removeObstacle(id, x, z) {
      if (!S.obstacles) return;
      const idx = S.obstacles.findIndex(o => o.id === id && o.x === x && o.z === z);
      if (idx < 0) return;
      const obsDef = OBSTACLES.find(o => o.id === id);
      if (obsDef) {
        if (obsDef.cost && obsDef.cost.gold > 0) {
          if ((S.res.gold || 0) < obsDef.cost.gold) {
            notify(`Zu wenig Gold! (${obsDef.cost.gold}🪙 nötig)`, 'warning');
            return;
          }
          S.res.gold -= obsDef.cost.gold;
        }
        Object.entries(obsDef.yield || {}).forEach(([res, val]) => {
          S.res[res] = Math.min((S.res[res] || 0) + val, S.lager[res] || 999999);
        });
        const yieldStr = Object.entries(obsDef.yield || {}).map(([k, v]) => `+${v} ${k}`).join(', ');
        notify(`${obsDef.name} entfernt. ${yieldStr}`, 'good');
        log(`${obsDef.name} bei (${x},${z}) entfernt.`);
      }
      S.obstacles.splice(idx, 1);
      if (typeof triggerObstacleRemovalAnim === 'function') {
        triggerObstacleRemovalAnim(x, z, obsDef ? obsDef.type : 'tree');
      }
      // Free the grid cell
      if (typeof gridOccupied !== 'undefined') delete gridOccupied[x + ',' + z];
      save();
    }

    function getAdjacentMauer(gx, gz) {
      if (gx == null || gz == null) return null;
      const mauerInsts = S.buildings.mauer || [];
      for (let idx = 0; idx < mauerInsts.length; idx++) {
        const inst = mauerInsts[idx];
        if (inst.x == null || inst.z == null) continue;
        if (Math.abs(inst.x - gx) <= 1 && Math.abs(inst.z - gz) <= 1 && !(inst.x === gx && inst.z === gz)) {
          return { idx, inst };
        }
      }
      return null;
    }

    function repairMauer(idx) {
      const inst = (S.buildings.mauer || [])[idx];
      if (!inst) return;
      const missing = 3 - (inst.hp || 3);
      if (missing <= 0) { notify('Mauer ist bereits intakt!'); return; }
      const cost = missing * 5;
      if ((S.res.stein || 0) < cost) { notify('Zu wenig Stein! (' + cost + '🪨 nötig)', 'warning'); return; }
      S.res.stein -= cost;
      inst.hp = 3;
      log('Mauer repariert.', 'good');
      notify('Mauer repariert.', 'good');
      rebuild3D(); save();
    }

    function destroyBuildingOutermost() {
      const allInsts = [];
      for (const [id, instances] of Object.entries(S.buildings)) {
        if (!Array.isArray(instances)) continue;
        instances.forEach((inst, idx) => {
          allInsts.push({ id, idx, inst, dist: Math.sqrt((inst.x || 0) ** 2 + (inst.z || 0) ** 2) });
        });
      }
      if (!allInsts.length) return;
      allInsts.sort((a, b) => b.dist - a.dist);
      for (const target of allInsts) {
        if (target.id === 'rathaus') continue;
        if (target.id === 'mauer') continue;
        const wall = getAdjacentMauer(target.inst.x, target.inst.z);
        if (wall) {
          flashBuilding('mauer', wall.idx, 0xff6010, 400);
          wall.inst.hp = (wall.inst.hp || 3) - 1;
          if (wall.inst.hp <= 0) {
            const mx = (S.buildings.mauer[wall.idx] || {}).x, mz = (S.buildings.mauer[wall.idx] || {}).z;
            S.buildings.mauer.splice(wall.idx, 1);
            log('🛡 Stadtmauer [' + mx + ',' + mz + '] zerstört!', 'warning');
            notify('Stadtmauer zerstört!', 'warning');
            calcDefense();
          } else {
            const mi = S.buildings.mauer[wall.idx] || {};
            log('🛡 Mauer [' + (mi.x || '?') + ',' + (mi.z || '?') + '] hat den Angriff abgefangen (HP: ' + wall.inst.hp + '/3)', 'warning');
            notify('Mauer beschädigt! HP: ' + wall.inst.hp + '/3', 'warning');
          }
          setTimeout(function() { rebuild3D(); }, 450);
          return;
        }
        const b = BUILDINGS.find(x => x.id === target.id);
        const tx = target.inst.x, tz = target.inst.z;
        flashBuilding(target.id, target.idx, 0xff2020, 600);
        setTimeout(function() {
          S.buildings[target.id].splice(target.idx, 1);
          if (target.id === 'wohnhaus') S.popTotal = Math.max(2, S.popTotal - 3);
          log('⚔️ ' + (b ? b.name : target.id) + ' wurde zerstört (Pos: ' + tx + ',' + tz + ')!', 'warning');
          notify((b ? b.name : target.id) + ' wurde zerstört!', 'warning');
          calcDefense(); calcLager(); rebuild3D();
        }, 650);
        return;
      }
      log('✅ Angriff abgewehrt! Verteidigung ' + Math.round(S.modifiers.defense) + ' hält stand.', 'good');
    }

    function moralMult() { const base = 0.5 + (S.moral / 100) * 0.65; const bonus = S.moral >= 70 ? ((S.moral - 70) / 30) * 0.15 : 0; return base + bonus; }

    let _tempMods = {}, _tempModOrig = {};
    function applyModTemp(key, val, seconds) {
      if (!_tempMods[key]) _tempModOrig[key] = S.modifiers[key] || 1;
      S.modifiers[key] = val;
      clearTimeout(_tempMods[key]);
      _tempMods[key] = setTimeout(() => { S.modifiers[key] = _tempModOrig[key]; delete _tempMods[key]; delete _tempModOrig[key]; }, seconds * 1000);
    }

    function calcRates() {
      const rates = { holz: 0, stein: 0, nahrung: 0, gold: 0, eisen: 0, kohle: 0 };
      const m = S.modifiers;
      const seuche = S._seuche && Date.now() < S._seuche;
      const seucheIds = seuche ? (() => { const v = BUILDINGS.filter(b => getBuildingCount(b.id) > 0).map(b => b.id).sort(() => Math.random() - 0.5); return new Set(v.slice(0, 2)); })() : new Set();
      BUILDINGS.forEach(b => {
        const instances = S.buildings[b.id] || [];
        if (!instances.length) return;
        let skip = seucheIds.has(b.id) ? 1 : 0;
        instances.forEach(inst => {
          if (skip > 0) { skip--; return; }
          const lm = LEVEL_MULT[(inst.level || 1) - 1] || 1.0;
          Object.entries(b.prod || {}).forEach(([res, rate]) => { rates[res] += rate * lm; });
        });
      });
      const saegeAnz = getBuildingCount('saegemuehle');
      if (saegeAnz > 0) rates.holz *= (1 + 0.5 * saegeAnz);
      const totalBldg = Object.values(S.buildings).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0);
      const nahrungVerbrauch = (S.popTotal * 0.04 + totalBldg * 0.005) * (S._nahrungReduceFactor || 1.0);
      const mm = moralMult() * S.prestigeMult;
      rates.holz *= m.holzMult * mm; rates.stein *= m.steinMult * mm;
      rates.nahrung *= m.nahrungMult * mm; rates.gold *= m.goldMult * mm; rates.eisen *= m.eisenMult * mm;
      rates.kohle *= mm;
      rates.nahrung -= nahrungVerbrauch;
      rates.gold -= (getBuildingCount('wache') + getBuildingCount('mauer')) * 0.04;
      return rates;
    }

    function calcPopMax() {
      let cap = 4;
      cap += getBuildingCount('wohnhaus') * 3; cap += getBuildingCount('feld') * 1;
      cap += getBuildingCount('baeckerei') * 8; cap += getBuildingCount('markt') * 4;
      cap += getBuildingCount('lagerhaus') * 6; cap += getBuildingCount('kirche') * 10;
      cap += getBuildingCount('kathedrale') * 20;
      return Math.min(cap, hasResearch('gilden') ? 200 : 100);
    }

    function tickPop() {
      S.popMax = calcPopMax();
      if (S.res.nahrung > 8 && S.popTotal < S.popMax && S.moral >= 40) {
        const bB = getBuildingCount('baeckerei') * 0.004;
        // Accumulate growth in a fractional buffer, only add whole people
        if (!S._popBuf) S._popBuf = 0;
        S._popBuf += 0.001 + bB;
        if (S._popBuf >= 1) {
          const gain = Math.floor(S._popBuf);
          S.popTotal = Math.min(S.popTotal + gain, S.popMax);
          S._popBuf -= gain;
          if (gain > 0) log('+' + gain + ' Einwohner (' + Math.floor(S.popTotal) + '/' + S.popMax + ')', 'good');
        }
      }
      if (S.res.nahrung <= 0 && S.popTotal > 2) {
        if (!S._starveBuf) S._starveBuf = 0;
        S._starveBuf += 0.008;
        if (S._starveBuf >= 1) {
          const loss = Math.floor(S._starveBuf);
          S.popTotal = Math.max(2, S.popTotal - loss);
          S._starveBuf -= loss;
        }
        changeMoral(-0.05);
        if (Math.random() < 0.005) log('Hungersnot!', 'warning');
      }
      const defBonus = S.modifiers.defense > 4 ? 0.005 : 0;
      const kircheBonus = getBuildingCount('kirche') * 0.008 + getBuildingCount('kathedrale') * 0.015;
      const brauereiBonus = getBuildingCount('brauerei') * 0.006;
      const popStress = S.popTotal > S.popMax * 0.9 ? -0.02 : 0;
      changeMoral((defBonus + kircheBonus + brauereiBonus + popStress - 0.005) * 1);
      S.pop = Math.floor(freeWorkers());
    }

    function calcLager() {
      let h = 150, s = 60, n = 50, e = 30, k = 40;
      const lc = getBuildingCount('lagerhaus');
      h += lc * 80; s += lc * 50; n += lc * 40; e += lc * 25; k += lc * 30;
      if (hasResearch('ingenieure')) { h += 80; s += 80; n += 60; e += 40; k += 40; }
      S.lager = { holz: h, stein: s, nahrung: n, gold: 999999, eisen: e, kohle: k };
    }

    function calcDefense() {
      let def = 0;
      def += getBuildingCount('wache') * 1.5; def += getBuildingCount('mauer') * 4;
      def += getBuildingCount('soeldner') * 2.5; def += getBuildingCount('ruestkammer') * 3.5;
      if (hasResearch('taktik')) def += 2; if (hasResearch('ritter')) def += 5;
      S.modifiers.defense = def;
    }

    function checkTier() {
      let tier = 0;
      const total = Object.values(S.buildings).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0);
      const resTotal = Object.keys(S.research).filter(k => S.research[k]).length;
      if (total >= 5 && S.popTotal >= 5) tier = 1;
      if (total >= 14 && S.popTotal >= 18 && resTotal >= 3) tier = 2;
      if (total >= 22 && S.popTotal >= 35 && resTotal >= 7) tier = 3;
      if (tier > S.tier) {
        S.tier = tier; log('Aufgestiegen: ' + TIERS[tier] + '!', 'important');
        notify('Aufgestiegen: ' + TIERS[tier] + '!');
        document.getElementById('tier-badge').textContent = TIERS[tier];
        calcLager();
        if (typeof updateMapStage === 'function') updateMapStage(S.tier);
      }
      const allTier3 = ['gilden', 'ingenieure', 'feudalrecht'].every(r => hasResearch(r));
      const btn = document.getElementById('prestige-btn');
      if (allTier3 && S.tier >= 2) { btn.style.display = 'block'; btn.classList.add('new-available'); }
      else btn.style.display = 'none';
    }

    function canAfford(b, cnt) {
      const mult = Math.pow(b.costMult, cnt || 0);
      return Object.entries(b.cost).every(([res, val]) => (S.res[res] || 0) >= Math.ceil(val * mult));
    }

    function buildingMeetsReqs(b) {
      for (const [k, v] of Object.entries(b.requires || {})) {
        if (k.endsWith('_count')) { if (getBuildingCount(k.replace('_count', '')) < v) return false; }
        if (k === 'research') { if (!hasResearch(v)) return false; }
      }
      return true;
    }

    function upgradeCost(b, level) {
      const result = {};
      Object.entries(b.cost).forEach(([res, val]) => {
        result[res] = Math.ceil(val * 0.55 * (level * 0.8));
      });
      return result;
    }

    function upgradeBuilding(id, idx) {
      const b = BUILDINGS.find(x => x.id === id);
      const inst = S.buildings[id]?.[idx];
      if (!b || !inst) return false;
      const lvl = inst.level || 1;
      if (lvl >= 5) { notify('Maximales Level erreicht!', 'warning'); return false; }
      const cost = upgradeCost(b, lvl);
      if (!Object.entries(cost).every(([res, val]) => (S.res[res] || 0) >= val)) {
        notify('Zu wenig Ressourcen!', 'warning'); return false;
      }
      Object.entries(cost).forEach(([res, val]) => { S.res[res] -= val; });
      inst.level = lvl + 1;
      if (id === 'mauer') inst.hp = 3;
      log('Upgrade: ' + b.name + ' → Level ' + inst.level, 'good');
      notify(b.name + ' → Lv.' + inst.level, 'good');
      rebuild3D();
      save();
      return true;
    }

    function buyBuilding(id) {
      const b = BUILDINGS.find(x => x.id === id);
      if (!b || id === 'rathaus') return;
      if (!buildingMeetsReqs(b)) { notify('Voraussetzung fehlt!', 'warning'); return; }
      const cnt = getBuildingCount(id);
      if (!canAfford(b, cnt)) { notify('Zu wenig Ressourcen!', 'warning'); return; }
      if (freeWorkers() < b.workers) { notify('Nicht genug freie Arbeiter! (' + freeWorkers() + ' frei, ' + b.workers + ' nötig)', 'warning'); return; }
      if (!findFreeCell(id, true)) { notify('⛔ Kein Straßenzugang — baue erst Straßen in der Nähe.', 'warning'); return; }
      const mult = Math.pow(b.costMult, cnt);
      Object.entries(b.cost).forEach(([res, val]) => { S.res[res] -= Math.ceil(val * mult); });
      if (!S.buildings[id]) S.buildings[id] = [];
      const newInst = { level: 1, x: null, z: null };
      if (id === 'mauer') newInst.hp = 3;
      S.buildings[id].push(newInst);
      if (b.special === 'wohnhaus') { S.popTotal += 3; S.pop = freeWorkers(); }
      if (b.special === 'defense' || b.special === 'defense2') calcDefense();
      if (b.special === 'lager') calcLager();
      if (b.special === 'moralBoost') changeMoral(15);
      if (b.special === 'prestige') changeMoral(20);
      addBuilding3D(id);
      log('Gebaut: ' + b.name + ' (' + getBuildingCount(id) + '×)', 'good');
      checkTier(); renderTab(currentTab); save();
    }

    function buyResearch(id) {
      const r = RESEARCH.find(x => x.id === id);
      if (!r || hasResearch(id)) return;
      if (S.activeResearch) { notify('Bereits eine Forschung aktiv!', 'warning'); return; }
      if (!getBuildingCount('bibliothek')) { notify('Bibliothek zuerst bauen!', 'warning'); return; }
      if (r.requires.some(req => !hasResearch(req))) { notify('Vorherige Forschung nötig!', 'warning'); return; }
      if (!Object.entries(r.cost).every(([res, val]) => (S.res[res] || 0) >= val)) { notify('Zu wenig Ressourcen!', 'warning'); return; }
      Object.entries(r.cost).forEach(([res, val]) => { S.res[res] -= val; });
      S.activeResearch = id;
      S.research[id] = { done: false, progress: 0, duration: r.duration };
      log('Forschung begonnen: ' + r.name, 'good');
      notify(r.name + ' wird erforscht…', 'good');
      renderTab(currentTab); save();
    }

    function applyResearchSpecial(r) {
      const sp = r.special;
      if (sp === 'nahrungBoost') S.modifiers.nahrungMult *= 1.5;
      if (sp === 'goldBoost') S.modifiers.goldMult *= 1.6;
      if (sp === 'allBoost') { S.modifiers.holzMult *= 1.2; S.modifiers.steinMult *= 1.2; S.modifiers.nahrungMult *= 1.2; S.modifiers.goldMult *= 1.2; }
      if (sp === 'steinBoost') { S.modifiers.steinMult *= 1.4; calcLager(); }
      if (sp === 'defenseBoost') calcDefense();
      if (sp === 'feudal') { S.modifiers.goldMult *= 1.5; changeMoral(10); }
      // Landwirtschaft
      if (sp === 'nahrungBoost30') S.modifiers.nahrungMult *= 1.3;
      if (sp === 'nahrungVerbrauchReduce') S._nahrungReduceFactor = (S._nahrungReduceFactor || 1.0) * 0.8;
      if (sp === 'gewaechshaus') S._gewaechshaus = true;
      if (sp === 'nahrungBoost80') S.modifiers.nahrungMult *= 1.8;
      // Handel
      if (sp === 'goldBoost20') S.modifiers.goldMult *= 1.2;
      if (sp === 'goldBoost30') S.modifiers.goldMult *= 1.3;
      if (sp === 'allBoost15') { S.modifiers.holzMult *= 1.15; S.modifiers.steinMult *= 1.15; S.modifiers.nahrungMult *= 1.15; S.modifiers.goldMult *= 1.15; }
      if (sp === 'banken') S._banken = true;
    }

    let activeEvent = null;
    function triggerEvent() {
      if (activeEvent) return;
      const pool = EVENTS.filter(e =>
        (e.minTier === undefined || e.minTier <= S.tier) &&
        (!e.condition || e.condition())
      );
      const ev = pool[Math.floor(Math.random() * pool.length)];
      activeEvent = ev; S.eventsHandled++;
      let raidInfo = '';
      if (ev.id === 'raeuber' || ev.id === 'belagerung') {
        const attackerCount = 5 + S.tier * 3 + Math.floor(Math.random() * 8);
        const def = Math.round(S.modifiers.defense);
        const threshold = ev.id === 'belagerung' ? 15 : 6;
        const wins = def >= threshold;
        raidInfo = `<div class="raid-info">
    <div class="raid-stat">⚔️ Angreifer: <b>${attackerCount}</b> ${ev.id === 'belagerung' ? 'Soldaten' : 'Räuber'}</div>
    <div class="raid-stat">🛡 Deine Verteidigung: <b>${def}</b> (braucht ${threshold} zum Abwehren)</div>
    <div class="raid-result ${wins ? 'win' : 'lose'}">${wins ? '✅ Ihr seid stark genug!' : '❌ Zu schwach — ein Gebäude droht zerstört zu werden!'}</div>
  </div>`;
      }
      document.getElementById('event-inner').innerHTML = `
    <div class="event-title">⚠ ${ev.title}</div>
    <div class="event-text">${ev.text}</div>
    ${raidInfo}
    <div class="event-btns">${ev.options.map((o, i) => `<button class="event-btn" onclick="handleEvent(${i})">${o.text}</button>`).join('')}</div>`;
      document.getElementById('event-overlay').classList.add('visible');
      log('Ereignis: ' + ev.title, 'warning');
    }
    function handleEvent(idx) {
      if (!activeEvent) return;
      activeEvent.options[idx].fn();
      document.getElementById('event-overlay').classList.remove('visible');
      document.getElementById('event-inner').innerHTML = '';
      activeEvent = null; save();
    }

    function tick() {
      S.tick++;
      const rates = calcRates();
      Object.entries(rates).forEach(([res, rate]) => {
        const cap = S.lager[res] || 999999;
        S.res[res] = Math.max(0, Math.min((S.res[res] || 0) + rate / 10, cap));
      });
      tickPop(); calcDefense(); calcLager();
      if (S.activeResearch) {
        const ar = RESEARCH.find(x => x.id === S.activeResearch);
        const rs = S.research[S.activeResearch];
        if (ar && rs && !rs.done) {
          rs.progress++;
          if (rs.progress >= rs.duration) {
            S.research[S.activeResearch] = { done: true };
            S.activeResearch = null;
            applyResearchSpecial(ar);
            log('Erforscht: ' + ar.name, 'good');
            notify(ar.name + ': ' + ar.effect, 'good');
            checkTier(); renderTab(currentTab);
          }
        }
      }
      if (S._banken) S.res.gold = Math.min((S.res.gold || 0) + 0.02, 999999);
      if (S.tick % 200 === 0) { S.day++; document.getElementById('clock').textContent = 'Tag ' + S.day; }
      if (!S.nextEventTick) S.nextEventTick = S.tick + 1200 + Math.floor(Math.random() * 1200);
      if (S.tick >= S.nextEventTick) { triggerEvent(); S.nextEventTick = 0; }
      if (S._belagerung && S._belagerung.roundsLeft > 0 && S.tick >= S._belagerung.nextAttackTick) {
        if (!S._belagerung.currentWave) S._belagerung.currentWave = 1;
        else S._belagerung.currentWave++;
        S._belagerung.roundsLeft--;
        if (S.modifiers.defense >= 15) {
          log('✅ Belagerungsangriff Welle ' + S._belagerung.currentWave + ' abgewehrt! (Verteidigung: ' + Math.round(S.modifiers.defense) + ')', 'good');
        } else {
          destroyBuildingOutermost();
          log('⚔️ Belagerungsangriff Welle ' + S._belagerung.currentWave + ' trifft!', 'warning');
        }
        if (S._belagerung.roundsLeft <= 0) {
          delete S._belagerung;
          log('Belagerung beendet! Das Dorf hat überlebt.', 'good');
          notify('Belagerung überstanden!', 'good');
        } else {
          S._belagerung.nextAttackTick = S.tick + 200;
        }
      }
      if (S.tick % 500 === 0 && S.moral < 35) log('Moral sehr niedrig! Aufstand droht!', 'warning');
      if (S.tick % 300 === 0) {
        const cr = calcRates();
        ['holz', 'stein', 'nahrung', 'eisen', 'kohle'].forEach(r => {
          if (S.res[r] >= S.lager[r] * 0.95 && cr[r] > 0) log('Lager voll: ' + r + '!', 'warning');
        });
      }
      if (S.tick % 300 === 0) save();
      updateUI(rates);
    }

    function updateUI(rates) {
      const rs = ['holz', 'stein', 'nahrung', 'gold', 'eisen', 'kohle'];
      rs.forEach(r => {
        const el = document.getElementById('r-' + r), rr = document.getElementById('rr-' + r), rl = document.getElementById('rl-' + r);
        if (el) el.textContent = fmt(S.res[r] || 0);
        if (rl && S.lager[r] !== undefined && S.lager[r] < 999999) rl.textContent = '/' + fmt(S.lager[r]);
        if (rr) { const rate = rates[r]; rr.textContent = (rate >= 0 ? '+' : '') + rate.toFixed(1) + '/s'; rr.className = 'res-rate' + (rate < 0 ? ' neg' : ''); }
      });
      const fill = document.getElementById('pop-fill'), txt = document.getElementById('pop-text');
      if (fill) fill.style.width = Math.min(100, (S.popTotal / S.popMax) * 100) + '%';
      if (txt) txt.textContent = Math.floor(S.popTotal) + '/' + S.popMax + ' (' + freeWorkers() + '✓)';
      const siegeEl = document.getElementById('siege-banner');
      if (siegeEl) {
        if (S._belagerung) {
          siegeEl.style.display = 'block';
          const waveEl = document.getElementById('siege-wave');
          const totalEl = document.getElementById('siege-total');
          const countEl = document.getElementById('siege-countdown');
          if (waveEl) waveEl.textContent = S._belagerung.currentWave || 1;
          if (totalEl) totalEl.textContent = S._belagerung.roundsTotal || S._belagerung.roundsLeft;
          if (countEl) {
            const ticksLeft = S._belagerung.nextAttackTick - S.tick;
            countEl.textContent = Math.max(0, Math.ceil(ticksLeft / 10));
          }
        } else {
          siegeEl.style.display = 'none';
        }
      }

      // Re-render Forschungs-Tab live while research is active
      if (S.activeResearch && S.tick % 10 === 0 && currentTab === 'forschung') {
        renderTab('forschung');
      }
      // Live-update building affordability every 20 ticks (~2s)
      if (S.tick % 20 === 0 && currentTab === 'bauen') {
        document.querySelectorAll('.b-row[data-bid]').forEach(row => {
          const id = row.dataset.bid;
          const b = BUILDINGS.find(x => x.id === id);
          if (!b) return;
          const cnt = getBuildingCount(id);
          const meetsReqs = buildingMeetsReqs(b);
          const affordable = canAfford(b, cnt);
          const hasW = freeWorkers() >= b.workers;
          const lagerTooSmall = Object.entries(b.cost).some(([res, val]) => {
            const needed = Math.ceil(val * Math.pow(b.costMult, cnt));
            return S.lager[res] !== undefined && needed > S.lager[res];
          });
          const disabled = !meetsReqs || !affordable || !hasW || lagerTooSmall;
          row.classList.toggle('cant-afford', disabled);
          const costDiv = row.querySelector('.b-cost-inline');
          if (costDiv) costDiv.innerHTML = buildingCostHTML(b);
          const det = document.getElementById('det_' + id);
          if (det) {
            const warnEl = det.querySelector('.warn');
            const warnText = !meetsReqs ? '🔒 Voraussetzung fehlt' :
              lagerTooSmall ? '📦 Lager zu klein' :
              (!hasW && meetsReqs && affordable ? '👷 Keine freien Arbeiter' : '');
            if (warnEl && warnText) warnEl.textContent = warnText;
            else if (warnEl && !warnText) warnEl.textContent = '';
          }
        });
        // Update worker info bar
        const fw = freeWorkers();
        const fwEl = document.querySelector('.worker-info b');
        if (fwEl) {
          fwEl.textContent = fw;
          fwEl.style.color = fw <= 0 ? 'var(--red2)' : 'var(--gold2)';
        }
        const moralEl = document.querySelector('.worker-info span[data-moral]');
        if (moralEl) {
          const mc = S.moral < 40 ? 'var(--red2)' : S.moral < 60 ? 'var(--amber2)' : 'var(--green2)';
          moralEl.style.color = mc;
          moralEl.textContent = '⚖ ' + Math.round(S.moral);
        }
      }
    }

    // ============================================================
    // RENDER TAB
    // ============================================================
    let currentTab = 'bauen';
    function showTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.ptab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase().includes(tab.substring(0, 3))));
      renderTab(tab);
    }
    function renderTab(tab) {
      const el = document.getElementById('panel-content');
      if (tab === 'bauen') el.innerHTML = renderBauen();
      else if (tab === 'forschung') el.innerHTML = renderForschung();
      else if (tab === 'dorf') el.innerHTML = renderDorf();
    }

    function buildingCostHTML(b) {
      const cnt = getBuildingCount(b.id);
      const mult = Math.pow(b.costMult, cnt);
      const icons = { holz: '🪵', stein: '🪨', nahrung: '🌾', gold: '🪙', eisen: '⚙️', kohle: '🪨‍🔥' };
      return Object.entries(b.cost).filter(([, v]) => v > 0).map(([res, val]) => {
        const needed = Math.ceil(val * mult);
        const cls = (S.res[res] || 0) < needed ? 'cost-tag missing' : 'cost-tag';
        return `<span class="${cls}">${icons[res]}${needed}</span>`;
      }).join('');
    }

    function renderBauen() {
      const fw = freeWorkers();
      const wohnhint = getBuildingCount('wohnhaus') == 0 ? '<span style="color:var(--amber2);font-size:10px">💡 Wohnhaus bauen</span>' : '';
      const moralCol = S.moral < 40 ? 'var(--red2)' : S.moral < 60 ? 'var(--amber2)' : 'var(--green2)';
      const popBuf = S._popBuf || 0;
      const popProgress = S.popTotal < S.popMax && S.res.nahrung > 8 && S.moral >= 40 ? `<span style="font-size:10px;color:var(--blue2)" title="Wachstumsfortschritt">📈${Math.round(popBuf * 100)}%</span>` : '';
      const workerInfo = `<div class="worker-info">
    <span style="font-family:'Cinzel',serif;color:var(--gold)">👷 <b style="color:${fw <= 0 ? 'var(--red2)' : 'var(--gold2)'}">${fw}</b> frei / ${Math.floor(S.popTotal)}</span>
    <span data-moral style="color:${moralCol}">⚖ ${Math.round(S.moral)}</span>
    ${wohnhint}
    ${popProgress}
  </div>`;

      const cats = [
        { id: 'produktion', label: 'Produktion', color: '#5a8a40' },
        { id: 'verarbeitung', label: 'Verarbeitung', color: '#8a5a20' },
        { id: 'militaer', label: 'Militär', color: '#4060a0' },
        { id: 'gesellschaft', label: 'Gesellschaft', color: '#d4a840' },
      ];
      const icons = { holz: '🪵', stein: '🪨', nahrung: '🌾', gold: '🪙', eisen: '⚙️', kohle: '🪨‍🔥' };

      // Track which categories are open (default all open)
      if (!window._catOpen) window._catOpen = { produktion: true, verarbeitung: true, militaer: false, gesellschaft: false };

      const html = cats.map(cat => {
        const bldgs = BUILDINGS.filter(b => b.cat === cat.id && b.id !== 'rathaus');
        const isOpen = window._catOpen[cat.id];
        const availCount = bldgs.filter(b => buildingMeetsReqs(b) && canAfford(b, getBuildingCount(b.id)) && freeWorkers() >= b.workers).length;
        const builtCount = bldgs.reduce((s, b) => s + (getBuildingCount(b.id) || 0), 0);

        const rows = bldgs.map(b => {
          const cnt = getBuildingCount(b.id);
          const meetsReqs = buildingMeetsReqs(b);
          const affordable = canAfford(b, cnt);
          const hasW = freeWorkers() >= b.workers;
          const lagerTooSmall = Object.entries(b.cost).some(([res, val]) => {
            const needed = Math.ceil(val * Math.pow(b.costMult, cnt));
            return S.lager[res] !== undefined && needed > S.lager[res];
          });
          const disabled = !meetsReqs || !affordable || !hasW || lagerTooSmall;
          const col = '#' + b.color3d.toString(16).padStart(6, '0');
          const prodPos = Object.entries(b.prod || {}).filter(([, v]) => v > 0).map(([res, rate]) => icons[res] + '+' + rate.toFixed(1) + '/s').join(' ');
          const prodNeg = Object.entries(b.prod || {}).filter(([, v]) => v < 0).map(([res, rate]) => icons[res] + rate.toFixed(1) + '/s').join(' ');
          const warnLine = !meetsReqs ? `<div class="warn red">🔒 Voraussetzung fehlt</div>` :
            lagerTooSmall ? `<div class="warn amber">📦 Lager zu klein</div>` :
            !hasW && meetsReqs && affordable ? `<div class="warn amber">👷 Keine freien Arbeiter</div>` : '';
          const popLine = b.special === 'wohnhaus' ? `<span class="b-prod-tag" style="color:var(--blue2)">+3👤</span>` : '';
          const detailId = `det_${b.id}`;
          return `<div class="b-row ${disabled ? 'cant-afford' : ''}" data-bid="${b.id}" onclick="toggleDetail('${detailId}')">
        <div class="b-dot" style="background:${col}"></div>
        <div class="b-main">
          <div class="b-top">
            <span class="b-name">${b.name}</span>
            ${cnt > 0 ? `<span class="b-count-badge">${cnt}×</span>` : ''}
          </div>
          <div class="b-meta">
            <span class="b-workers">👷${b.workers}</span>
            ${prodPos ? `<span class="b-prod-tag">${prodPos}</span>` : ''}
            ${prodNeg ? `<span class="b-prod-neg">${prodNeg}</span>` : ''}
            ${popLine}
            <div class="b-cost-inline">${buildingCostHTML(b)}</div>
          </div>
        </div>
        <button class="b-build-btn" onclick="event.stopPropagation();buyBuilding('${b.id}')" title="Bauen">＋</button>
      </div>
      <div class="b-detail" id="${detailId}">
        ${b.desc}
        ${warnLine}
      </div>`;
        }).join('');

        const badge = availCount > 0 ? `<span style="color:var(--green2);font-size:9px">${availCount} verfügbar</span>` :
          builtCount > 0 ? `<span style="color:var(--muted);font-size:9px">${builtCount} gebaut</span>` : '';

        return `<div class="cat-wrapper">
      <div class="cat-header ${isOpen ? 'open' : ''}" onclick="toggleCat('${cat.id}',this)">
        <span><span style="display:inline-block;width:7px;height:7px;background:${cat.color};border-radius:50%;margin-right:6px;vertical-align:middle"></span>${cat.label}</span>
        <span style="display:flex;align-items:center;gap:8px">${badge}<span class="cat-arrow">▶</span></span>
      </div>
      <div class="cat-body" id="cat_${cat.id}" style="display:${isOpen ? 'block' : 'none'}">
        <div class="b-rows-grid">${rows}</div>
      </div>
    </div>`;
      }).join('');

      return workerInfo + html;
    }

    function toggleCat(id, headerEl) {
      window._catOpen[id] = !window._catOpen[id];
      const body = document.getElementById('cat_' + id);
      if (body) body.style.display = window._catOpen[id] ? 'block' : 'none';
      if (headerEl) headerEl.classList.toggle('open', window._catOpen[id]);
    }

    function toggleDetail(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('open');
    }

    function renderForschung() {
      if (!getBuildingCount('bibliothek')) return `<div style="text-align:center;padding:30px;color:var(--muted);font-style:italic;font-size:13px">Baut zuerst eine Bibliothek.</div>`;

      // Active research progress bar
      let activeBar = '';
      if (S.activeResearch) {
        const ar = RESEARCH.find(x => x.id === S.activeResearch);
        const rs = S.research[S.activeResearch];
        if (ar && rs) {
          const pct = Math.min(100, Math.floor((rs.progress / rs.duration) * 100));
          const secsLeft = Math.ceil((rs.duration - rs.progress) / 10);
          activeBar = `<div style="background:var(--bg2);border:1px solid var(--amber2);border-radius:3px;padding:8px 10px;margin-bottom:10px;">
            <div style="font-size:10px;color:var(--amber2);margin-bottom:4px;">⚗ Aktive Forschung: <b>${ar.name}</b> — ${secsLeft}s</div>
            <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:var(--amber2);transition:width 0.3s;"></div>
            </div>
          </div>`;
        }
      }

      const branches = [
        { id: 'wirtschaft', label: 'Wirtschaft', color: 'var(--green2)' },
        { id: 'technik', label: 'Technik & Bau', color: 'var(--blue2)' },
        { id: 'militaer', label: 'Militär & Recht', color: 'var(--amber2)' },
        { id: 'landwirtschaft', label: 'Landwirtschaft', color: 'var(--green2)' },
        { id: 'handel', label: 'Handel & Finanzen', color: 'var(--gold)' },
      ];
      const tree = branches.map(br => {
        const nodes = RESEARCH.filter(r => r.branch === br.id).sort((a, b) => a.tier - b.tier);
        if (!nodes.length) return '';
        return `<div class="research-branch">
      <div class="branch-title" style="color:${br.color}">${br.label}</div>
      <div class="research-row">${nodes.map((r, i) => {
          const done = hasResearch(r.id);
          const inProgress = S.activeResearch === r.id;
          const locked = !done && !inProgress && r.requires.some(req => !hasResearch(req));
          const ok = !locked && Object.entries(r.cost).every(([res, val]) => (S.res[res] || 0) >= val);
          const isActive = !done && !inProgress && !locked;
          let cls = 'research-node';
          if (done) cls += ' done';
          else if (inProgress) cls += ' active';
          else if (locked) cls += ' locked';
          else if (ok) cls += ' active';
          const costStr = Object.entries(r.cost).map(([res, val]) => ({ gold: '🪙', holz: '🪵', stein: '🪨', eisen: '⚙️', kohle: '🪨' }[res] + val)).join(' ');
          const progressBar = inProgress ? (() => {
            const rs = S.research[r.id]; const pct = rs ? Math.min(100, Math.floor(rs.progress / rs.duration * 100)) : 0;
            return `<div style="height:3px;background:var(--border);border-radius:2px;margin-top:3px;"><div style="height:100%;width:${pct}%;background:var(--amber2);"></div></div>`;
          })() : '';
          const clickable = isActive && !S.activeResearch;
          return `<div class="${cls}" onclick="${clickable ? 'buyResearch(\'' + r.id + '\')' : ''}">
          <div class="rn-name">${done ? '✓ ' : inProgress ? '⚗ ' : locked ? '🔒 ' : ''}${r.name}</div>
          <div class="rn-effect">${r.effect}</div>
          ${!done && !inProgress ? `<div class="rn-cost">${costStr}</div>` : ''}
          ${progressBar}
        </div>${i < nodes.length - 1 ? '<div class="arrow-connector">→</div>' : ''}`;
        }).join('')}</div>
    </div>`;
      }).join('');
      return activeBar + tree;
    }

    function renderDorf() {
      const rates = calcRates();
      const icons = { holz: '🪵', stein: '🪨', nahrung: '🌾', gold: '🪙', eisen: '⚙️', kohle: '🪨‍🔥' };
      const moralColor = S.moral < 40 ? 'var(--red2)' : S.moral < 60 ? 'var(--amber2)' : 'var(--green2)';
      const bldgList = Object.entries(S.buildings).filter(([, v]) => Array.isArray(v) && v.length > 0).map(([id, instances]) => {
        const b = BUILDINGS.find(x => x.id === id);
        return b ? `<div class="stat-row"><span class="stat-key">${b.name}</span><span class="stat-val">${instances.length}× (${instances.length * b.workers}👷)</span></div>` : '';
      }).join('');
      return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:10px">
    <div class="section-title" style="margin-bottom:6px">Produktion /s</div>
    ${Object.entries(rates).map(([res, rate]) => {
        const col = rate < 0 ? 'var(--red2)' : rate > 0 ? 'var(--green2)' : 'var(--muted)';
        return `<div class="stat-row"><span class="stat-key">${icons[res]} ${res}</span><span class="stat-val" style="color:${col}">${rate >= 0 ? '+' : ''}${rate.toFixed(2)}/s</span></div>`;
      }).join('')}
  </div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:10px;margin-bottom:10px">
    <div class="section-title" style="margin-bottom:6px">Dorfwerte</div>
    <div class="stat-row"><span class="stat-key">Moral</span><span class="stat-val" style="color:${moralColor}">${Math.round(S.moral)}/100</span></div>
    <div class="stat-row"><span class="stat-key">Bevölkerung</span><span class="stat-val">${Math.floor(S.popTotal)} / ${S.popMax}</span></div>
    <div class="stat-row"><span class="stat-key">Freie Arbeiter</span><span class="stat-val">${freeWorkers()}</span></div>
    <div class="stat-row"><span class="stat-key">Verteidigung</span><span class="stat-val">${S.modifiers.defense.toFixed(1)}</span></div>
    <div class="stat-row"><span class="stat-key">Prestige-Neustarts</span><span class="stat-val" style="color:var(--gold)">${S.prestige}×</span></div>
  </div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:10px">
    <div class="section-title" style="margin-bottom:6px">Gebäude</div>
    ${bldgList || '<div style="color:var(--muted);font-style:italic;font-size:11px">Keine Gebäude</div>'}
  </div>`;
    }

    function prestige() {
      if (!confirm('Prestige-Reset: Alles zurücksetzen? Das Dorf wird als Ruhm gezählt.')) return;
      S.prestige++; S.prestigeMult = 1.0;
      S.res = { holz: 10, stein: 6, nahrung: 20, gold: 15, eisen: 0, kohle: 0 };
      S.buildings = { rathaus: [{ level: 1, x: 0, z: 0 }] }; S.research = {};
      S.popTotal = 3; S.pop = 2; S.tier = 0; S.moral = 80;
      S.modifiers = { nahrungMult: 1, holzMult: 1, steinMult: 1, goldMult: 1, eisenMult: 1, defense: 0 };
      S.nextEventTick = 0; S.rathausAlive = true; S.roads = []; delete S._belagerung;
      calcLager(); S.popMax = calcPopMax();
      rebuild3D();
      document.getElementById('tier-badge').textContent = 'Weiler';
      document.getElementById('prestige-btn').style.display = 'none';
      log('Prestige #' + S.prestige + '! Das Dorf wird erinnert.', 'important');
      notify('Prestige #' + S.prestige + '! Neues Spiel.');
      renderTab(currentTab); save();
    }

    function resetGame() {
      if (!confirm('Spielstand wirklich löschen?')) return;
      try { localStorage.removeItem('dorfchronik_3d_v1'); } catch (e) { }
      location.reload();
    }

    function save() {
      try { localStorage.setItem('dorfchronik_3d_v1', JSON.stringify(S)); } catch (e) { }
    }

    function loadGame() {
      try {
        const raw = localStorage.getItem('dorfchronik_3d_v1');
        if (!raw) return;
        const saved = JSON.parse(raw);
        Object.assign(S, saved);
        S.prestigeMult = 1.0;
        if (!S.modifiers) S.modifiers = { nahrungMult: 1, holzMult: 1, steinMult: 1, goldMult: 1, eisenMult: 1, defense: 0 };
        if (S.moral === undefined) S.moral = 80;
        if (S.res.kohle === undefined) S.res.kohle = 0;
        if (S.rathausAlive === undefined) S.rathausAlive = true;
        if (!S.roads) S.roads = [];
        if (!S.obstacles) S.obstacles = [
          { id: 'tree_pine', x: -5, z: 3 }, { id: 'tree_pine', x: 3, z: -5 },
          { id: 'tree_pine', x: -3, z: -4 }, { id: 'tree_pine', x: 5, z: 2 },
          { id: 'tree_pine', x: -4, z: 5 }, { id: 'tree_pine', x: 2, z: 6 },
          { id: 'boulder_mossy', x: 5, z: -3 }, { id: 'boulder_mossy', x: -2, z: 5 }
        ];

        // Migrate old buildings format: { id: number } → { id: [{level, x, z}] }
        for (const [id, val] of Object.entries(S.buildings)) {
          if (typeof val === 'number') {
            S.buildings[id] = Array.from({ length: val }, () => ({ level: 1, x: null, z: null }));
          }
        }
        // Migrate old research format: true → { done: true }
        for (const [id, val] of Object.entries(S.research || {})) {
          if (val === true) S.research[id] = { done: true };
        }
        if (S.activeResearch === undefined) S.activeResearch = null;
        // Ensure mauer instances have hp
        if (S.buildings.mauer) {
          S.buildings.mauer.forEach(inst => { if (inst.hp === undefined) inst.hp = 3; });
        }
        // Don't restore mid-siege state across sessions
        delete S._belagerung;
        // Ensure rathaus exists at center
        if (!S.buildings.rathaus || S.buildings.rathaus.length === 0) {
          S.buildings.rathaus = [{ level: 1, x: 0, z: 0 }];
        } else {
          S.buildings.rathaus[0].x = 0;
          S.buildings.rathaus[0].z = 0;
        }

        document.getElementById('tier-badge').textContent = TIERS[S.tier] || 'Weiler';
        document.getElementById('clock').textContent = 'Tag ' + S.day;
        Object.keys(S.research || {}).filter(k => hasResearch(k)).forEach(id => {
          const r = RESEARCH.find(x => x.id === id); if (r) applyResearchSpecial(r);
        });
        calcDefense(); calcLager();
        S.popMax = calcPopMax();
        rebuild3D();
        if (typeof updateMapStage === 'function') updateMapStage(S.tier || 0);
        log('Spielstand geladen.', 'good');
      } catch (e) { console.warn('Load failed', e); }
    }

    // INIT
    loadGame();
    // New game: loadGame() returned early (no save) → place rathaus and build 3D scene
    if (!S.buildings.rathaus || S.buildings.rathaus.length === 0) {
      S.buildings.rathaus = [{ level: 1, x: 0, z: 0 }];
      S.rathausAlive = true;
      rebuild3D();
      if (typeof updateMapStage === 'function') updateMapStage(0);
    }
    calcLager();
    renderTab('bauen');
    log('Chronik beginnt. Baue dein Dorf!', 'important');
    setInterval(tick, 100);
