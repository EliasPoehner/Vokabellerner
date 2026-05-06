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
      buildings: {}, research: {}, eventsHandled: 0, tier: 0, moral: 80,
      lager: { holz: 150, stein: 60, nahrung: 50, gold: 999999, eisen: 30, kohle: 40 },
      modifiers: { nahrungMult: 1, holzMult: 1, steinMult: 1, goldMult: 1, eisenMult: 1, defense: 0 },
      nextEventTick: 0, rathausAlive: true
    };

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
    function hasResearch(id) { return !!S.research[id]; }
    function usedWorkers() { let u = 0; BUILDINGS.forEach(b => { u += getBuildingCount(b.id) * b.workers; }); return u; }
    function freeWorkers() { return Math.max(0, Math.floor(S.popTotal) - usedWorkers()); }
    function changeMoral(d) { S.moral = Math.max(0, Math.min(100, S.moral + d)); }
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
        let cnt = getBuildingCount(b.id); if (!cnt) return;
        if (seucheIds.has(b.id)) cnt = Math.max(0, cnt - 1);
        Object.entries(b.prod || {}).forEach(([res, rate]) => { rates[res] += rate * cnt; });
      });
      const saegeAnz = getBuildingCount('saegemuehle');
      if (saegeAnz > 0) rates.holz *= (1 + 0.5 * saegeAnz);
      const totalBldg = Object.values(S.buildings).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0);
      const nahrungVerbrauch = S.popTotal * 0.04 + totalBldg * 0.005;
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

    function buyBuilding(id) {
      const b = BUILDINGS.find(x => x.id === id);
      if (!b || id === 'rathaus') return;
      if (!buildingMeetsReqs(b)) { notify('Voraussetzung fehlt!', 'warning'); return; }
      const cnt = getBuildingCount(id);
      if (!canAfford(b, cnt)) { notify('Zu wenig Ressourcen!', 'warning'); return; }
      if (freeWorkers() < b.workers) { notify('Nicht genug freie Arbeiter! (' + freeWorkers() + ' frei, ' + b.workers + ' nötig)', 'warning'); return; }
      const mult = Math.pow(b.costMult, cnt);
      Object.entries(b.cost).forEach(([res, val]) => { S.res[res] -= Math.ceil(val * mult); });
      if (!S.buildings[id]) S.buildings[id] = [];
      S.buildings[id].push({ level: 1, x: null, z: null });
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
      if (!getBuildingCount('bibliothek')) { notify('Bibliothek zuerst bauen!', 'warning'); return; }
      if (r.requires.some(req => !hasResearch(req))) { notify('Vorherige Forschung nötig!', 'warning'); return; }
      if (!Object.entries(r.cost).every(([res, val]) => (S.res[res] || 0) >= val)) { notify('Zu wenig Ressourcen!', 'warning'); return; }
      Object.entries(r.cost).forEach(([res, val]) => { S.res[res] -= val; });
      S.research[id] = true;
      applyResearchSpecial(r);
      log('Erforscht: ' + r.name, 'good');
      notify(r.name + ': ' + r.effect, 'good');
      checkTier(); renderTab(currentTab); save();
    }

    function applyResearchSpecial(r) {
      const sp = r.special;
      if (sp === 'nahrungBoost') S.modifiers.nahrungMult *= 1.5;
      if (sp === 'goldBoost') S.modifiers.goldMult *= 1.6;
      if (sp === 'allBoost') { S.modifiers.holzMult *= 1.2; S.modifiers.steinMult *= 1.2; S.modifiers.nahrungMult *= 1.2; S.modifiers.goldMult *= 1.2; }
      if (sp === 'steinBoost') { S.modifiers.steinMult *= 1.4; calcLager(); }
      if (sp === 'defenseBoost') calcDefense();
      if (sp === 'feudal') { S.modifiers.goldMult *= 1.5; changeMoral(10); }
    }

    let activeEvent = null;
    function triggerEvent() {
      if (activeEvent) return;
      const pool = EVENTS.filter(e => !e.condition || e.condition());
      const ev = pool[Math.floor(Math.random() * pool.length)];
      activeEvent = ev; S.eventsHandled++;
      document.getElementById('event-inner').innerHTML = `
    <div class="event-title">⚠ ${ev.title}</div>
    <div class="event-text">${ev.text}</div>
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
      if (S.tick % 200 === 0) { S.day++; document.getElementById('clock').textContent = 'Tag ' + S.day; }
      if (!S.nextEventTick) S.nextEventTick = S.tick + 1200 + Math.floor(Math.random() * 1200);
      if (S.tick >= S.nextEventTick) { triggerEvent(); S.nextEventTick = 0; }
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
        const el = document.getElementById('r-' + r), rr = document.getElementById('rr-' + r);
        if (el) el.textContent = fmt(S.res[r] || 0);
        if (rr) { const rate = rates[r]; rr.textContent = (rate >= 0 ? '+' : '') + rate.toFixed(1) + '/s'; rr.className = 'res-rate' + (rate < 0 ? ' neg' : ''); }
      });
      const fill = document.getElementById('pop-fill'), txt = document.getElementById('pop-text');
      if (fill) fill.style.width = Math.min(100, (S.popTotal / S.popMax) * 100) + '%';
      if (txt) txt.textContent = Math.floor(S.popTotal) + '/' + S.popMax + ' (' + freeWorkers() + '✓)';

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
      const branches = [
        { id: 'wirtschaft', label: 'Wirtschaft', color: 'var(--green2)' },
        { id: 'technik', label: 'Technik & Bau', color: 'var(--blue2)' },
        { id: 'militaer', label: 'Militär & Recht', color: 'var(--amber2)' },
      ];
      return branches.map(br => {
        const nodes = RESEARCH.filter(r => r.branch === br.id).sort((a, b) => a.tier - b.tier);
        return `<div class="research-branch">
      <div class="branch-title" style="color:${br.color}">${br.label}</div>
      <div class="research-row">${nodes.map((r, i) => {
          const done = hasResearch(r.id);
          const locked = !done && r.requires.some(req => !hasResearch(req));
          const ok = Object.entries(r.cost).every(([res, val]) => (S.res[res] || 0) >= val);
          let cls = 'research-node';
          if (done) cls += ' done'; else if (locked) cls += ' locked'; else if (ok) cls += ' active';
          const costStr = Object.entries(r.cost).map(([res, val]) => ({ gold: '🪙', holz: '🪵', stein: '🪨', eisen: '⚙️', kohle: '🪨‍🔥' }[res] + val)).join(' ');
          return `<div class="${cls}" onclick="${done || locked ? '' : 'buyResearch(\'' + r.id + '\')'}">
          <div class="rn-name">${done ? '✓ ' : locked ? '🔒 ' : ''} ${r.name}</div>
          <div class="rn-effect">${r.effect}</div>
          ${!done ? `<div class="rn-cost">${costStr}</div>` : ''}
        </div>${i < nodes.length - 1 ? '<div class="arrow-connector">→</div>' : ''}`;
        }).join('')}</div>
    </div>`;
      }).join('');
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
    <div class="stat-row"><span class="stat-key">Prestige</span><span class="stat-val" style="color:var(--gold)">×${S.prestigeMult.toFixed(1)}</span></div>
  </div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:10px">
    <div class="section-title" style="margin-bottom:6px">Gebäude</div>
    ${bldgList || '<div style="color:var(--muted);font-style:italic;font-size:11px">Keine Gebäude</div>'}
  </div>`;
    }

    function prestige() {
      if (!confirm('Prestige-Reset: Alles zurücksetzen, aber permanenter ×0.5 Bonus bleibt?')) return;
      S.prestige++; S.prestigeMult = 1 + S.prestige * 0.5;
      S.res = { holz: 10, stein: 6, nahrung: 20, gold: 15, eisen: 0, kohle: 0 };
      S.buildings = { rathaus: [{ level: 1, x: 0, z: 0 }] }; S.research = {};
      S.popTotal = 3; S.pop = 2; S.tier = 0; S.moral = 80;
      S.modifiers = { nahrungMult: 1, holzMult: 1, steinMult: 1, goldMult: 1, eisenMult: 1, defense: 0 };
      S.nextEventTick = 0; S.rathausAlive = true;
      calcLager(); S.popMax = calcPopMax();
      rebuild3D();
      document.getElementById('tier-badge').textContent = 'Weiler';
      document.getElementById('prestige-btn').style.display = 'none';
      log('Prestige! Mult: ×' + S.prestigeMult.toFixed(1), 'important');
      notify('Neues Spiel! ×' + S.prestigeMult.toFixed(1) + ' Bonus');
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
        S.prestigeMult = 1 + S.prestige * 0.5;
        if (!S.modifiers) S.modifiers = { nahrungMult: 1, holzMult: 1, steinMult: 1, goldMult: 1, eisenMult: 1, defense: 0 };
        if (S.moral === undefined) S.moral = 80;
        if (S.res.kohle === undefined) S.res.kohle = 0;
        if (S.rathausAlive === undefined) S.rathausAlive = true;

        // Migrate old buildings format: { id: number } → { id: [{level, x, z}] }
        for (const [id, val] of Object.entries(S.buildings)) {
          if (typeof val === 'number') {
            S.buildings[id] = Array.from({ length: val }, () => ({ level: 1, x: null, z: null }));
          }
        }
        // Ensure rathaus exists at center
        if (!S.buildings.rathaus || S.buildings.rathaus.length === 0) {
          S.buildings.rathaus = [{ level: 1, x: 0, z: 0 }];
        } else {
          S.buildings.rathaus[0].x = 0;
          S.buildings.rathaus[0].z = 0;
        }

        document.getElementById('tier-badge').textContent = TIERS[S.tier] || 'Weiler';
        document.getElementById('clock').textContent = 'Tag ' + S.day;
        Object.keys(S.research || {}).filter(k => S.research[k]).forEach(id => {
          const r = RESEARCH.find(x => x.id === id); if (r) applyResearchSpecial(r);
        });
        calcDefense(); calcLager();
        S.popMax = calcPopMax();
        rebuild3D();
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
    }
    calcLager();
    renderTab('bauen');
    log('Chronik beginnt. Baue dein Dorf!', 'important');
    setInterval(tick, 100);
