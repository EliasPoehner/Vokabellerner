import { S, getEatHeal, getPrestigeCostMult } from './game';
import { ITEMS, UPGRADES, QUESTS, EVENTS, PRESTIGE_UPGRADES, MATERIALS, RECIPES, COMBOS, RUN_ITEMS } from './data';
import type { QuestDef } from './types';

// ── Progress milestones ───────────────────────────────────────────────────────

const PROGRESS_MILESTONES = [
  'throw', 'lollipopField', 'sell', 'shop', 'upgrades', 'quests',
  'cave', 'tower', 'castle', 'volcano', 'ice_palace', 'candy_realm',
  'swamp', 'witch_tower', 'bandit_camp', 'bandit_fortress',
  'crypt', 'dungeon_keep', 'dragon_nest', 'tundra',
  'upg_farm', 'upg_factory', 'upg_accelerator', 'upg_empire',
];

// ── Reveal ──────────────────────────────────────────────────────────────────

const revealedSections = new Set<string>();

export function reveal(id: string): void {
  if (revealedSections.has(id)) return;
  revealedSections.add(id);
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('cb-hidden');
  el.classList.add('cb-reveal');
  setTimeout(() => el.classList.remove('cb-reveal'), 600);
}

export function checkReveal(): void {
  if (S.unlocked.includes('throw'))         reveal('sec-throw');
  if (S.unlocked.includes('lollipopField')) reveal('sec-lollipops');
  if (S.unlocked.includes('sell'))          reveal('btn-sell-lollipops');
  if (S.unlocked.includes('shop'))          reveal('btn-shop-open');
  if (S.unlocked.includes('upgrades'))      reveal('sec-upgrades');
  if (S.unlocked.includes('quests'))        reveal('sec-quests');
  if (S.unlocked.includes('prestige'))      reveal('sec-prestige');
  if (S.unlocked.includes('prestige_shop')) reveal('sec-prestige-shop');
  if (S.unlocked.includes('forge'))         reveal('sec-forge');
}

// Prestige resets S in-place (no page reload), but reveal() and several
// render functions only ever add content/visibility, never take it away —
// without this, Shop/Upgrades/Quests/Forge stay on screen showing the
// previous cycle's (now stale) data because their render functions early-
// return once the matching S.unlocked flag is gone. Mirrors what a fresh
// page load would naturally produce.
export function resetRevealedUI(): void {
  revealedSections.clear();
  collapsedCategories.clear();

  ['sec-throw', 'sec-lollipops', 'btn-sell-lollipops', 'btn-shop-open',
   'sec-upgrades', 'sec-quests', 'sec-forge', 'sec-prestige', 'sec-prestige-shop',
  ].forEach(id => document.getElementById(id)?.classList.add('cb-hidden'));

  document.getElementById('lollipop-field')?.replaceChildren();

  const shopGrid = document.getElementById('shop-grid');
  if (shopGrid) { shopGrid.replaceChildren(); delete shopGrid.dataset.rendered; }

  const upgradeGrid = document.getElementById('upgrade-grid');
  if (upgradeGrid) { upgradeGrid.replaceChildren(); delete upgradeGrid.dataset.rendered; }

  const questList = document.getElementById('quest-list');
  if (questList) { questList.replaceChildren(); delete questList.dataset.built; }

  document.getElementById('inventory-strip')?.classList.add('cb-hidden');
  const inventoryBadges = document.getElementById('inventory-badges');
  if (inventoryBadges) { inventoryBadges.replaceChildren(); delete inventoryBadges.dataset.inv; }

  document.getElementById('forge-inventory')?.classList.add('cb-hidden');
  ['forge-materials', 'forge-inv-badges', 'forge-recipes', 'forge-combos'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.replaceChildren();
    delete el.dataset.rendered;
    delete el.dataset.inv;
  });

  prevCandies = -1;
}

// ── Number helper ────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: decimals });
}

// ── Main render ──────────────────────────────────────────────────────────────

let prevCandies = -1;

export function render(): void {
  renderCandies();
  renderResources();
  renderHp();
  renderLollipops();
  renderShop();
  renderUpgrades();
  renderQuests();
  renderBattle();
  renderEventOverlay();
  renderEatBtn();
  renderStats();
  renderProgress();
  renderPrestige();
  renderPrestigeShop();
  renderLeaderboard();
  if (S.unlocked.includes('forge')) renderForge();
  renderDungeon();
  checkReveal();
}

function renderCandies(): void {
  const el = document.getElementById('candy-count')!;
  el.textContent = fmt(Math.floor(S.candies));
  if (S.candies !== prevCandies) {
    el.classList.remove('candy-bounce');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('candy-bounce');
    prevCandies = S.candies;
  }
  const rate = document.getElementById('candy-rate');
  if (rate) {
    const effective = S.candyPerSec * S.prestigeCandyMult;
    const rateStr = effective % 1 === 0 ? String(effective) : effective.toFixed(1);
    const multStr = S.prestigeCandyMult > 1 ? ` (×${S.prestigeCandyMult.toFixed(1)} Prestige)` : '';
    rate.textContent = `+${rateStr} pro Sekunde${multStr}`;
  }
}

function renderResources(): void {
  const gold = document.getElementById('gold-val');
  const lollipop = document.getElementById('lollipop-val');
  if (gold) gold.textContent = fmt(S.gold);
  if (lollipop) lollipop.textContent = fmt(S.lollipops);

  const queueEl = document.getElementById('lollipop-queue');
  if (queueEl) {
    if (S.lollipopQueue > 0) {
      queueEl.textContent = `(${S.lollipopQueue} wächst… ${S.lollipopCooldown}s)`;
      queueEl.style.display = 'inline';
    } else {
      queueEl.style.display = 'none';
    }
  }

  const matResEl = document.getElementById('res-materials');
  const matVal   = document.getElementById('materials-val');
  if (matResEl && matVal) {
    const ownedMats = Object.entries(S.materials).filter(([, v]) => v > 0);
    if (ownedMats.length > 0) {
      matResEl.classList.remove('cb-hidden');
      matVal.textContent = ownedMats.map(([id, count]) => {
        const mat = MATERIALS[id];
        return `${mat?.emoji ?? '?'} ×${count}`;
      }).join('  ');
    } else {
      matResEl.classList.add('cb-hidden');
    }
  }
}

function renderHp(): void {
  const fill = document.getElementById('player-hp-fill');
  const label = document.getElementById('player-hp-label');
  if (!fill || !label) return;
  const pct = S.maxHp > 0 ? (S.hp / S.maxHp) * 100 : 0;
  fill.style.width = `${pct}%`;
  fill.style.background = pct > 50 ? 'var(--c-mint)' : pct > 25 ? 'var(--c-yellow)' : 'var(--c-pink)';
  label.textContent = `${S.hp} / ${S.maxHp} HP`;
}

function renderLollipops(): void {
  if (!S.unlocked.includes('lollipopField')) return;
  const field = document.getElementById('lollipop-field');
  if (!field) return;

  const visible = Math.min(S.lollipops, 24);
  const current = field.querySelectorAll('.lollipop').length;

  if (visible > current) {
    for (let i = current; i < visible; i++) {
      field.appendChild(makeLollipop(i));
    }
  } else if (visible < current) {
    while (field.querySelectorAll('.lollipop').length > visible) {
      field.lastChild?.remove();
    }
  }

  const overflow = document.getElementById('lollipop-overflow');
  if (overflow) {
    overflow.textContent = S.lollipops > 24 ? `+${S.lollipops - 24} weitere` : '';
  }

  const canSell = S.lollipops >= 5;

  const sellBtn = document.getElementById('btn-sell-lollipops') as HTMLButtonElement | null;
  if (sellBtn && S.unlocked.includes('sell')) {
    sellBtn.disabled = !canSell;
    sellBtn.className = `cb-btn cb-btn-secondary${canSell ? '' : ' cb-btn-disabled'}`;
  }

  const sellAllBtn = document.getElementById('btn-sell-all-lollipops') as HTMLButtonElement | null;
  if (sellAllBtn) {
    const hasStall = S.inventory.includes('market_stall');
    sellAllBtn.classList.toggle('cb-hidden', !hasStall);
    if (hasStall) {
      sellAllBtn.disabled = !canSell;
      sellAllBtn.className = `cb-btn cb-btn-secondary${canSell ? '' : ' cb-btn-disabled'}`;
      const batches = Math.floor(S.lollipops / 5);
      const scaledGold = Math.round(15 * getPrestigeCostMult());
      sellAllBtn.title = canSell ? `${batches * 5} Lutscher → ${batches * scaledGold} 🪙 Gold` : '';
    }
  }
}

function makeLollipop(idx: number): HTMLElement {
  const colors = ['#ff6b9d', '#c44dff', '#4dffc3', '#ffe066', '#ff8c42', '#a78bfa'];
  const el = document.createElement('div');
  el.className = 'lollipop';
  el.style.animationDelay = `${(idx % 4) * 0.05}s`;
  el.innerHTML = `
    <div class="lollipop-head" style="background:conic-gradient(${colors[idx % 3]} 0 120deg,${colors[(idx+1)%3]} 120deg 240deg,${colors[(idx+2)%3]} 240deg 360deg)"></div>
    <div class="lollipop-stick"></div>
  `;
  return el;
}

const collapsedCategories = new Set<string>();

const SHOP_CATEGORIES: Array<{ unlock: string | undefined; label: string }> = [
  { unlock: undefined,       label: '⚔️ Grundausstattung'   },
  { unlock: 'lollipopField', label: '🍭 Lutscherfeld'       },
  { unlock: 'quests',        label: '🛡️ Kampfausrüstung'    },
  { unlock: 'cave',          label: '🌿 Abenteurer'         },
  { unlock: 'tower',         label: '⚔️ Fortgeschritten'    },
  { unlock: 'castle',        label: '🏆 Legendär'           },
  { unlock: 'ice_palace',    label: '🌋 Vulkan-Beute'         },
  { unlock: 'candy_realm',   label: '🧊 Eispalast-Beute'      },
];

function buildItemCard(item: (typeof ITEMS)[number]): HTMLElement {
  const _m = getPrestigeCostMult();
  const costParts: string[] = [];
  if (item.costCandies) costParts.push(`${Math.round(item.costCandies * _m)} 🍬`);
  if (item.costGold)    costParts.push(`${Math.round(item.costGold    * _m)} 🪙`);
  const reqItem = item.requiresItem ? ITEMS.find(i => i.id === item.requiresItem) : null;
  const reqHint = reqItem ? `<div class="item-req">Benötigt: ${reqItem.emoji} ${reqItem.name}</div>` : '';

  const card = document.createElement('div');
  card.className = 'item-card';
  card.id = `item-${item.id}`;
  card.innerHTML = `
    <div class="item-emoji">${item.emoji}</div>
    <div class="item-name">${item.name}</div>
    <div class="item-desc">${item.description}</div>
    ${reqHint}
    <div class="item-cost">${costParts.join(' + ')}</div>
    <button class="cb-btn" id="btn-buy-${item.id}" onclick="window.cbBuy('${item.id}')">
      Kaufen
    </button>
  `;
  return card;
}

function renderShop(): void {
  if (!S.unlocked.includes('shop')) return;
  const grid = document.getElementById('shop-grid');
  if (!grid) return;

  const visible = ITEMS.filter(item => !item.unlock || S.unlocked.includes(item.unlock));
  const visibleIds = visible.map(i => i.id).join(',');

  if (grid.dataset.rendered !== visibleIds) {
    grid.dataset.rendered = visibleIds;
    grid.innerHTML = '';

    SHOP_CATEGORIES.forEach(cat => {
      const catItems = visible.filter(item =>
        cat.unlock === undefined
          ? (!item.unlock || item.unlock === 'shop')
          : item.unlock === cat.unlock
      );
      if (catItems.length === 0) return;

      const section = document.createElement('div');
      section.className = 'shop-category';

      const header = document.createElement('div');
      header.className = 'shop-category-header';
      header.innerHTML = `<span>${cat.label}</span><span class="shop-category-chevron">▾</span>`;
      header.addEventListener('click', () => {
        if (collapsedCategories.has(cat.label)) {
          collapsedCategories.delete(cat.label);
        } else {
          collapsedCategories.add(cat.label);
        }
        section.classList.toggle('shop-category--collapsed', collapsedCategories.has(cat.label));
        const chevron = header.querySelector('.shop-category-chevron') as HTMLElement;
        if (chevron) chevron.textContent = collapsedCategories.has(cat.label) ? '▸' : '▾';
      });
      section.appendChild(header);

      const itemsGrid = document.createElement('div');
      itemsGrid.className = 'shop-category-items';
      catItems.forEach(item => itemsGrid.appendChild(buildItemCard(item)));
      section.appendChild(itemsGrid);
      grid.appendChild(section);
    });
  }

  visible.forEach(item => {
    const btn = document.getElementById(`btn-buy-${item.id}`) as HTMLButtonElement | null;
    const card = document.getElementById(`item-${item.id}`);
    if (!btn) return;
    const owned = S.inventory.includes(item.id) && !item.repeatable;
    const missingReq = item.requiresItem && !S.inventory.includes(item.requiresItem);
    const _sm = getPrestigeCostMult();
    const canAfford = (item.costCandies ? S.candies >= Math.round(item.costCandies * _sm) : true)
                   && (item.costGold    ? S.gold    >= Math.round(item.costGold    * _sm) : true);

    if (card) card.style.display = owned ? 'none' : '';

    btn.disabled = owned || !!missingReq || !canAfford;
    if (owned) {
      btn.textContent = '✓';
      btn.className = 'cb-btn cb-btn-owned';
    } else if (missingReq) {
      const req = ITEMS.find(i => i.id === item.requiresItem);
      btn.textContent = `🔒 ${req?.emoji ?? ''} ${req?.name ?? ''}`;
      btn.className = 'cb-btn cb-btn-disabled';
    } else {
      btn.textContent = 'Kaufen';
      btn.className = `cb-btn ${!canAfford ? 'cb-btn-disabled' : ''}`;
    }
  });

  // Update inventory strip
  const strip = document.getElementById('inventory-strip');
  const badges = document.getElementById('inventory-badges');
  if (strip && badges) {
    const ownedItems = ITEMS.filter(i => S.inventory.includes(i.id) && !i.repeatable);
    const invKey = ownedItems.map(i => i.id).join(',');
    if (badges.dataset.inv !== invKey) {
      badges.dataset.inv = invKey;
      badges.innerHTML = ownedItems.map(i =>
        `<span class="inv-badge"><span class="inv-badge-emoji">${i.emoji}</span>${i.name}</span>`
      ).join('');
      strip.classList.toggle('cb-hidden', ownedItems.length === 0);
    }
  }
}


function renderUpgrades(): void {
  if (!S.unlocked.includes('upgrades')) return;
  const grid = document.getElementById('upgrade-grid');
  if (!grid) return;

  const visible = UPGRADES.filter(u =>
    (!u.unlock  || S.unlocked.includes(u.unlock)) &&
    (!u.requires || S.upgrades.includes(u.requires))
  );
  const visibleIds = visible.map(u => u.id).join(',');

  if (grid.dataset.rendered !== visibleIds) {
    grid.dataset.rendered = visibleIds;
    grid.innerHTML = '';
    visible.forEach(upg => {
      const _um = getPrestigeCostMult();
      const costParts: string[] = [];
      if (upg.costCandies) costParts.push(`${Math.round(upg.costCandies * _um)} 🍬`);
      if (upg.costGold)    costParts.push(`${Math.round(upg.costGold    * _um)} 🪙`);

      const card = document.createElement('div');
      card.className = 'item-card';
      card.id = `upg-card-${upg.id}`;
      card.innerHTML = `
        <div class="item-emoji">${upg.emoji}</div>
        <div class="item-name">${upg.name}</div>
        <div class="item-desc">${upg.description}</div>
        <div class="item-desc upgrade-bonus">+${upg.candyBonus} 🍬/s</div>
        <div class="item-cost">${costParts.join(' + ')}</div>
        <button class="cb-btn" id="btn-upg-${upg.id}" onclick="window.cbBuyUpgrade('${upg.id}')">
          Kaufen
        </button>
      `;
      grid.appendChild(card);
    });
  }

  visible.forEach(upg => {
    const btn = document.getElementById(`btn-upg-${upg.id}`) as HTMLButtonElement | null;
    if (!btn) return;
    const owned = S.upgrades.includes(upg.id);
    const _am = getPrestigeCostMult();
    const canAfford = (!upg.costCandies || S.candies >= Math.round(upg.costCandies * _am))
                   && (!upg.costGold    || S.gold    >= Math.round(upg.costGold    * _am));
    btn.disabled = owned || !canAfford;
    btn.textContent = owned ? '✓ Aktiv' : 'Kaufen';
    btn.className = `cb-btn ${owned ? 'cb-btn-owned' : ''} ${!owned && !canAfford ? 'cb-btn-disabled' : ''}`;
  });
}

// Quest path tree: main-path quests → their side branches (in display order, top to bottom)
const QUEST_TREE: { main: string; sides: string[] }[] = [
  { main: 'forest',      sides: ['swamp', 'witch_tower'] },
  { main: 'cave',        sides: ['bandit_camp', 'bandit_fortress'] },
  { main: 'tower',       sides: ['crypt'] },
  { main: 'castle',      sides: ['dungeon_keep'] },
  { main: 'volcano',     sides: ['dragon_nest'] },
  { main: 'ice_palace',  sides: ['tundra'] },
  { main: 'candy_realm', sides: [] },
];

function buildQuestCard(q: QuestDef, type: 'main' | 'side'): HTMLElement {
  const card = document.createElement('div');
  card.id = `quest-${q.id}`;
  card.className = type === 'side' ? 'quest-card cb-hidden' : 'quest-card';
  const tagLabel = type === 'main' ? 'Hauptpfad' : 'Abzweigung';
  const tagClass = type === 'main' ? 'quest-tag-main' : 'quest-tag-side';
  card.innerHTML = `
    <span class="quest-tag ${tagClass}">${tagLabel}</span>
    <div class="quest-header">
      <span class="quest-emoji">${q.emoji}</span>
      <div>
        <div class="quest-name">${q.name}</div>
        <div class="quest-desc">${q.description}</div>
      </div>
      <div class="quest-reward">+${q.goldReward} 🪙</div>
    </div>
    <button class="cb-btn" id="btn-quest-${q.id}" onclick="window.cbStartDungeon('${q.id}')">
      🗺️ Dungeon betreten
    </button>
    <div class="quest-msg" id="quest-msg-${q.id}"></div>
    <div class="quest-done-badge cb-hidden" id="quest-done-${q.id}">✓ Abgeschlossen</div>
  `;
  return card;
}

function updateQuestCard(questId: string): void {
  const q = QUESTS.find(qd => qd.id === questId);
  if (!q) return;
  const card = document.getElementById(`quest-${questId}`);
  const btn = document.getElementById(`btn-quest-${questId}`) as HTMLButtonElement | null;
  const msg = document.getElementById(`quest-msg-${questId}`);
  const doneBadge = document.getElementById(`quest-done-${questId}`);
  if (!card || !btn || !msg) return;

  const hasItem = !q.requiredItem || S.inventory.includes(q.requiredItem);
  const active = S.activeQuest?.phase === 'fighting';
  const done = S.completedQuests.includes(questId);

  const rewardEl = card.querySelector('.quest-reward') as HTMLElement | null;
  if (rewardEl) rewardEl.textContent = `+${Math.round(q.goldReward * getPrestigeCostMult())} 🪙`;

  card.classList.toggle('quest-done', done);
  if (doneBadge) doneBadge.classList.toggle('cb-hidden', !done);

  btn.disabled = active || !hasItem;
  btn.textContent = done ? '🔁 Wiederholen' : '🗺️ Dungeon betreten';
  btn.className = `cb-btn${active || !hasItem ? ' cb-btn-disabled' : ''}`;

  if (!hasItem && q.requiredItem) {
    const reqItem = ITEMS.find(i => i.id === q.requiredItem);
    msg.textContent = reqItem ? `Benötigt: ${reqItem.emoji} ${reqItem.name}` : '';
  } else {
    msg.textContent = '';
  }
}

function renderQuests(): void {
  if (!S.unlocked.includes('quests')) return;
  const secQuests = document.getElementById('sec-quests');
  if (secQuests) secQuests.classList.toggle('cb-hidden', S.dungeon != null);
  const list = document.getElementById('quest-list');
  if (!list) return;

  // Build tree DOM structure once
  if (!list.dataset.built) {
    list.dataset.built = '1';
    QUEST_TREE.forEach((node, idx) => {
      if (idx > 0) {
        const conn = document.createElement('div');
        conn.className = 'quest-connector cb-hidden';
        conn.id = `quest-conn-${idx}`;
        conn.textContent = '▼';
        list.appendChild(conn);
      }

      const row = document.createElement('div');
      row.className = 'quest-tree-row cb-hidden';
      row.id = `quest-row-${idx}`;

      const mainQuest = QUESTS.find(q => q.id === node.main);
      if (mainQuest) {
        const mainCol = document.createElement('div');
        mainCol.className = 'quest-tree-main';
        mainCol.appendChild(buildQuestCard(mainQuest, 'main'));
        row.appendChild(mainCol);
      }

      if (node.sides.length > 0) {
        const sideCol = document.createElement('div');
        sideCol.className = 'quest-tree-side';
        sideCol.id = `quest-side-${idx}`;
        node.sides.forEach(sideId => {
          const sq = QUESTS.find(q => q.id === sideId);
          if (sq) sideCol.appendChild(buildQuestCard(sq, 'side'));
        });
        row.appendChild(sideCol);
      }

      list.appendChild(row);
    });
  }

  // Find last unlocked main-path index for preview
  let lastUnlockedIdx = -1;
  QUEST_TREE.forEach((node, idx) => {
    if (node.main === 'forest' || S.unlocked.includes(node.main)) lastUnlockedIdx = idx;
  });
  const previewIdx = lastUnlockedIdx + 1 < QUEST_TREE.length ? lastUnlockedIdx + 1 : -1;

  // Reveal rows and update card states
  QUEST_TREE.forEach((node, idx) => {
    const rowEl = document.getElementById(`quest-row-${idx}`);
    const connEl = document.getElementById(`quest-conn-${idx}`);
    const isUnlocked = node.main === 'forest' || S.unlocked.includes(node.main);
    const isPreview = idx === previewIdx;

    if ((isUnlocked || isPreview) && rowEl?.classList.contains('cb-hidden')) {
      rowEl.classList.remove('cb-hidden');
      if (isUnlocked) {
        rowEl.classList.add('cb-reveal');
        setTimeout(() => rowEl?.classList.remove('cb-reveal'), 600);
      }
    }
    if (rowEl) rowEl.classList.toggle('quest-row-preview', isPreview && !isUnlocked);

    if (idx > 0 && connEl?.classList.contains('cb-hidden') && (isUnlocked || isPreview)) {
      connEl.classList.remove('cb-hidden');
    }

    if (isUnlocked || isPreview) updateQuestCard(node.main);

    // Side quests: reveal individually when unlocked
    if (isUnlocked) {
      const anySideUnlocked = node.sides.some(s => S.unlocked.includes(s));
      if (anySideUnlocked && rowEl) rowEl.classList.add('has-side');

      node.sides.forEach(sideId => {
        const sideCard = document.getElementById(`quest-${sideId}`);
        if (S.unlocked.includes(sideId)) {
          if (sideCard?.classList.contains('cb-hidden')) {
            sideCard.classList.remove('cb-hidden');
            sideCard.classList.add('cb-reveal');
            setTimeout(() => sideCard?.classList.remove('cb-reveal'), 600);
          }
          updateQuestCard(sideId);
        }
      });
    }
  });
}

function renderBattle(): void {
  const q = S.activeQuest;
  const sec = document.getElementById('sec-battle');
  if (!sec) return;

  const backdrop = document.getElementById('dungeon-battle-backdrop');

  if (!q) {
    sec.classList.add('cb-hidden');
    sec.classList.remove('boss-encounter');
    backdrop?.classList.add('cb-hidden');
    return;
  }

  sec.classList.remove('cb-hidden');

  const isDungeonCombat = S.dungeon !== null;
  sec.classList.toggle('battle-dungeon-overlay', isDungeonCombat);
  backdrop?.classList.toggle('cb-hidden', !isDungeonCombat);

  const enemy = q.enemies[q.enemyIndex] ?? q.enemies[q.enemies.length - 1];

  if (enemy.isBoss && q.phase === 'fighting') {
    sec.classList.add('boss-encounter');
  } else if (q.phase !== 'fighting') {
    sec.classList.remove('boss-encounter');
  }

  const emojiEl = document.getElementById('battle-enemy-emoji');
  const nameEl  = document.getElementById('battle-enemy-name');
  const eFill   = document.getElementById('enemy-hp-fill');
  const eLabel  = document.getElementById('enemy-hp-label');
  if (emojiEl) emojiEl.textContent = enemy.emoji;
  if (nameEl)  nameEl.textContent  = enemy.isBoss ? `${enemy.name} 👑` : enemy.name;
  if (eFill) {
    const pct = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0;
    eFill.style.width = `${pct}%`;
    eFill.style.background = pct > 50 ? '#ff6b9d' : pct > 25 ? '#ffe066' : '#ff2255';
  }
  if (eLabel) eLabel.textContent = `${enemy.hp} / ${enemy.maxHp} HP`;

  const phaseEl = document.getElementById('battle-phase');
  if (phaseEl) {
    if (q.phase === 'fighting') phaseEl.textContent = enemy.isBoss ? '👑 Boss-Kampf!' : '⚔️ Kampf läuft…';
    else if (q.phase === 'victory') phaseEl.textContent = '🎉 Sieg!';
    else phaseEl.textContent = '💀 Niederlage';
  }

  const pFill2  = document.getElementById('player-hp-fill-2');
  const pLabel2 = document.getElementById('player-hp-label-2');
  const pct2 = S.maxHp > 0 ? (q.playerHp / S.maxHp) * 100 : 0;
  if (pFill2) {
    pFill2.style.width = `${pct2}%`;
    pFill2.style.background = pct2 > 50 ? 'var(--c-mint)' : pct2 > 25 ? 'var(--c-yellow)' : 'var(--c-pink)';
  }
  if (pLabel2) pLabel2.textContent = `${q.playerHp} / ${S.maxHp} HP`;

  const closeBtn = document.getElementById('btn-close-quest') as HTMLButtonElement | null;
  if (closeBtn) {
    closeBtn.disabled = q.phase === 'fighting';
    closeBtn.classList.toggle('cb-hidden', isDungeonCombat);
  }

  // Dungeon: "Nächster Raum" / "Zur Dungeon-Karte" nach Kampfende
  const dungeonNextEl = document.getElementById('battle-dungeon-next');
  if (dungeonNextEl) {
    if (isDungeonCombat && q.phase === 'victory') {
      dungeonNextEl.classList.remove('cb-hidden');
      const isDungeonDone = S.dungeon!.phase === 'victory';
      dungeonNextEl.innerHTML = isDungeonDone
        ? `<div class="dungeon-victory-banner">🏆 Boss besiegt! Dungeon abgeschlossen!</div>
           <button class="cb-btn" onclick="window.cbReturnToDungeonMap()">Zur Dungeon-Karte <span class="battle-hotkey battle-hotkey-inline">⏎</span></button>`
        : `<button class="cb-btn" onclick="window.cbReturnToDungeonMap()">⚔️ Nächster Raum <span class="battle-hotkey battle-hotkey-inline">⏎</span></button>`;
    } else {
      dungeonNextEl.classList.add('cb-hidden');
    }
  }

  const log = document.getElementById('battle-log');
  if (log && log.dataset.len !== String(q.log.length)) {
    log.dataset.len = String(q.log.length);
    log.innerHTML = q.log.slice(-20).map(l =>
      `<div class="log-entry">${l}</div>`
    ).join('');
    log.scrollTop = log.scrollHeight;
  }

  const prog = document.getElementById('battle-progress');
  if (prog) {
    prog.innerHTML = q.enemies.map((e, i) => {
      const cls = i < q.enemyIndex ? 'ep-done' : i === q.enemyIndex ? 'ep-active' : 'ep-pending';
      const bossMarker = e.isBoss ? '★' : '';
      return `<span class="ep ${cls}${e.isBoss ? ' ep-boss' : ''}" title="${e.name}">${e.emoji}${bossMarker}</span>`;
    }).join('');
  }

  // Kraftstoß-Karte
  const powerBtn = document.getElementById('btn-power-strike') as HTMLButtonElement | null;
  if (powerBtn) {
    const fighting = q.phase === 'fighting';
    const queued = fighting && q.powerStrikeQueued;
    const canAfford = S.candies >= 20;
    powerBtn.disabled = !fighting || queued || !canAfford;
    powerBtn.className = `battle-action-card battle-action-power${queued ? ' power-queued' : ''}${!fighting || !canAfford ? '' : ''}`;
    if (queued) {
      powerBtn.innerHTML = `<span class="battle-action-icon">⚡</span><span class="battle-action-title">Bereit!</span><span class="battle-action-sub">nächster Angriff ×2</span>`;
    } else {
      powerBtn.innerHTML = `<span class="battle-action-icon">⚡</span><span class="battle-action-title">Kraftstoß</span><span class="battle-action-sub">×2 Schaden · −20 🍬</span>`;
    }
  }

  // Parieren-Karte
  const parryBtn = document.getElementById('btn-parry') as HTMLButtonElement | null;
  const parrySub = document.getElementById('parry-sub');
  if (parryBtn) {
    const fighting = q.phase === 'fighting';
    const queued = fighting && q.blockQueued;
    const onCooldown = fighting && !queued && q.blockCooldown > 0;
    parryBtn.disabled = !fighting || queued || onCooldown;
    parryBtn.className = `battle-action-card battle-action-block${queued ? ' block-queued' : ''}${onCooldown ? ' block-cooldown' : ''}`;
    if (parrySub) {
      if (queued)       parrySub.textContent = 'nächster Treffer: 0';
      else if (onCooldown) parrySub.textContent = `bereit in ${q.blockCooldown} Runden`;
      else              parrySub.textContent = 'nächster Treffer: 0';
    }
  }

  // Kampftränke
  const hasStrength = S.inventory.includes('strength_potion');
  const hasIron     = S.inventory.includes('iron_potion');
  const trankRow    = document.getElementById('battle-trank-row');
  if (trankRow) trankRow.classList.toggle('cb-hidden', !hasStrength && !hasIron);

  const strengthBtn = document.getElementById('btn-strength-trank') as HTMLButtonElement | null;
  if (strengthBtn) {
    strengthBtn.classList.toggle('cb-hidden', !hasStrength);
    if (hasStrength) {
      const active   = q.attackBuff > 0;
      const canAfford = S.candies >= 20;
      strengthBtn.disabled = q.phase !== 'fighting' || !canAfford;
      strengthBtn.className = `battle-trank-btn battle-trank-attack${active ? ' trank-active' : ''}`;
      const sub = document.getElementById('strength-trank-sub');
      if (sub) sub.textContent = active ? `aktiv — ${q.attackBuff} Runden` : '+8 ATK · 3 Runden · −20 🍬';
    }
  }

  const ironBtn = document.getElementById('btn-iron-trank') as HTMLButtonElement | null;
  if (ironBtn) {
    ironBtn.classList.toggle('cb-hidden', !hasIron);
    if (hasIron) {
      const active    = q.defenseBuff > 0;
      const canAfford = S.candies >= 15;
      ironBtn.disabled = q.phase !== 'fighting' || !canAfford;
      ironBtn.className = `battle-trank-btn battle-trank-defense${active ? ' trank-active' : ''}`;
      const sub = document.getElementById('iron-trank-sub');
      if (sub) sub.textContent = active ? `aktiv — ${q.defenseBuff} Runden` : '+4 DEF · 3 Runden · −15 🍬';
    }
  }

  // Status-Bar (Betäubung / Kraftstoß / Parieren / Gift / Buffs)
  const statusEl = document.getElementById('battle-status');
  if (statusEl) {
    const tags: string[] = [];
    if (q.playerStunned)      tags.push('<span class="battle-status-tag status-stun">😵 Betäubt — kein Angriff!</span>');
    if (q.powerStrikeQueued)  tags.push('<span class="battle-status-tag status-power">⚡ Kraftstoß aufgeladen!</span>');
    if (q.blockQueued)        tags.push('<span class="battle-status-tag status-block">🛡️ Parieren aktiv!</span>');
    if (q.poisonRounds > 0)   tags.push(`<span class="battle-status-tag status-poison">🤢 Vergiftet (${q.poisonRounds} Runden)</span>`);
    if (q.attackBuff > 0)     tags.push(`<span class="battle-status-tag status-atk-buff">💪 +8 ATK (${q.attackBuff} Runden)</span>`);
    if (q.defenseBuff > 0)    tags.push(`<span class="battle-status-tag status-def-buff">⚙️ +4 DEF (${q.defenseBuff} Runden)</span>`);
    statusEl.innerHTML = tags.join('');
  }

  // Spezialangriff-Warnung
  const warnEl = document.getElementById('battle-special-warn');
  if (warnEl) {
    const special = enemy.specialMove;
    if (special && q.phase === 'fighting') {
      const roundsUntil = special.cooldown - (q.roundCount % special.cooldown);
      if (roundsUntil <= 2) {
        warnEl.textContent = roundsUntil === 1
          ? `⚠️ ${special.name} jetzt!`
          : `⚠️ ${special.name} in ${roundsUntil} Runden`;
        warnEl.classList.remove('cb-hidden');
      } else {
        warnEl.classList.add('cb-hidden');
      }
    } else {
      warnEl.classList.add('cb-hidden');
    }
  }

  // Dungeon run-items row (active items usable in combat)
  const runItemRow = document.getElementById('battle-run-item-row');
  if (runItemRow) {
    const combatItems = (S.dungeon?.runItems ?? []).filter(id => {
      const def = RUN_ITEMS.find(r => r.id === id);
      return def?.type === 'active' && def.useInCombat;
    });
    runItemRow.classList.toggle('cb-hidden', combatItems.length === 0);
    if (combatItems.length > 0) {
      runItemRow.innerHTML = combatItems.map(id => {
        const def = RUN_ITEMS.find(r => r.id === id)!;
        const canUse = q.phase === 'fighting';
        return `<button class="battle-trank-btn${canUse ? '' : ' cb-btn-disabled'}" ${canUse ? '' : 'disabled'} onclick="window.cbUseDungeonItem('${id}')">
          <span class="trank-icon">${def.emoji}</span>
          <div class="trank-info"><span class="trank-name">${def.name}</span><span class="trank-sub">${def.description}</span></div>
        </button>`;
      }).join('');
    }
  }

  // Speed toggle — only visible after buying Kriegstrommel
  const speedBtn = document.getElementById('btn-fight-speed') as HTMLButtonElement | null;
  if (speedBtn) {
    const hasDrum = S.inventory.includes('battle_drum');
    speedBtn.classList.toggle('cb-hidden', !hasDrum);
    if (hasDrum) {
      const fast = S.fightSpeed === 2;
      speedBtn.innerHTML = `${fast ? '⚡ ×2' : '⚡ ×1'} <span class="battle-hotkey battle-hotkey-inline">F</span>`;
      speedBtn.className = `cb-btn ${fast ? 'cb-btn-speed-active' : 'cb-btn-secondary'}`;
    }
  }

  // Zahlen-Hotkeys (1-9) für Kraftstoß / Parieren / Tränke / Dungeon-Items —
  // immer neu nummeriert nach den aktuell tatsächlich nutzbaren Aktionen,
  // damit Badge und Tastatur-Dispatch (main.ts) nie auseinanderlaufen.
  getBattleHotkeyButtons().forEach((btn, i) => {
    let badge = btn.querySelector<HTMLSpanElement>('.battle-hotkey');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'battle-hotkey';
      btn.appendChild(badge);
    }
    badge.textContent = String(i + 1);
  });
}

// Liefert die aktuell per Zahlentaste auslösbaren Kampf-Aktionsbuttons, in
// Anzeigereihenfolge. Gleiche Funktion wird in main.ts für den Tastatur-Dispatch
// genutzt, damit Badge-Nummer und ausgelöste Aktion immer übereinstimmen.
export function getBattleHotkeyButtons(): HTMLButtonElement[] {
  const fixedIds = ['btn-power-strike', 'btn-parry', 'btn-strength-trank', 'btn-iron-trank'];
  const buttons: HTMLButtonElement[] = [];
  for (const id of fixedIds) {
    const btn = document.getElementById(id) as HTMLButtonElement | null;
    if (btn && !btn.disabled && btn.offsetParent !== null) buttons.push(btn);
  }
  document.getElementById('battle-run-item-row')?.querySelectorAll('button').forEach(btn => {
    const b = btn as HTMLButtonElement;
    if (!b.disabled && b.offsetParent !== null) buttons.push(b);
  });
  return buttons;
}

function renderEventOverlay(): void {
  const overlay = document.getElementById('event-overlay')!;
  if (!S.activeEvent) {
    overlay.classList.add('cb-hidden');
    return;
  }
  overlay.classList.remove('cb-hidden');

  const def = EVENTS.find(e => e.id === S.activeEvent);
  if (!def) return;

  const emojiEl  = document.getElementById('event-emoji');
  const titleEl  = document.getElementById('event-title');
  const textEl   = document.getElementById('event-text');
  const choicesEl= document.getElementById('event-choices');

  if (emojiEl)  emojiEl.textContent  = def.emoji;
  if (titleEl)  titleEl.textContent  = def.title;
  if (textEl)   textEl.textContent   = def.text;

  if (choicesEl && choicesEl.dataset.eventId !== S.activeEvent) {
    choicesEl.dataset.eventId = S.activeEvent;
    choicesEl.innerHTML = def.choices.map((c, i) => {
      const cls = c.secondary ? 'cb-btn cb-btn-secondary' : 'cb-btn';
      return `<button class="${cls}" onclick="window.cbResolveEvent(${i})">${c.label}</button>`;
    }).join('');
  }
}

function renderStats(): void {
  const eaten  = document.getElementById('stat-eaten');
  const thrown = document.getElementById('stat-thrown');
  const sold   = document.getElementById('stat-sold');
  const quests = document.getElementById('stat-quests');
  const total  = document.getElementById('stat-total');
  const gold   = document.getElementById('stat-gold');
  if (eaten)  eaten.textContent  = fmt(S.stats.candiesEaten);
  if (thrown) thrown.textContent = fmt(S.stats.candiesThrown);
  if (sold)   sold.textContent   = fmt(S.stats.lollipopsSold);
  if (quests) quests.textContent = fmt(S.stats.questsWon);
  if (total)  total.textContent  = fmt(S.stats.totalCandiesProduced);
  if (gold)   gold.textContent   = fmt(S.stats.goldEarned);

  const goldRes = document.getElementById('res-gold');
  if (goldRes && S.gold > 0) goldRes.style.display = 'inline-flex';
}

function renderEatBtn(): void {
  const onCooldown  = S.eatCooldown > 0;
  const eatDisabled = S.candies < 10 || S.hp >= S.maxHp || onCooldown;
  const eatClass    = `cb-btn ${eatDisabled ? 'cb-btn-disabled' : 'cb-btn-pink'}`;
  const healAmt     = getEatHeal();

  const eatBtn = document.getElementById('btn-eat') as HTMLButtonElement | null;
  if (eatBtn) {
    eatBtn.disabled = eatDisabled;
    eatBtn.className = eatClass;
    if (onCooldown) {
      eatBtn.innerHTML = `🍬 Essen <span class="btn-hint cooldown-hint">${S.eatCooldown}s</span>`;
    } else {
      eatBtn.innerHTML = `🍬 Essen (−10) <span class="btn-hint">+${healAmt} HP</span>`;
    }
  }

  const eatBattleBtn = document.getElementById('btn-eat-battle') as HTMLButtonElement | null;
  if (eatBattleBtn) {
    eatBattleBtn.disabled = eatDisabled;
    eatBattleBtn.className = `battle-action-card battle-action-heal${eatDisabled ? '' : ''}`;
    const healSub = document.getElementById('battle-heal-sub');
    if (healSub) healSub.textContent = onCooldown ? `Cooldown ${S.eatCooldown}s` : `+${healAmt} HP · −10 🍬`;
  }

  // Auto-heal toggle — only visible after buying Erste-Hilfe-Beutel
  const autoHealBtn = document.getElementById('btn-autoheal') as HTMLButtonElement | null;
  if (autoHealBtn) {
    const hasKit = S.inventory.includes('autoheal_kit');
    autoHealBtn.classList.toggle('cb-hidden', !hasKit);
    if (hasKit) {
      autoHealBtn.textContent = S.autoHeal ? '💊 Auto-Heal: AN' : '💊 Auto-Heal: Aus';
      autoHealBtn.className = `cb-btn ${S.autoHeal ? 'cb-btn-autoheal-active' : 'cb-btn-secondary'}`;
    }
  }

  const throwBtn = document.getElementById('btn-throw') as HTMLButtonElement | null;
  if (throwBtn) {
    const throwDisabled = S.candies < 10;
    throwBtn.disabled = throwDisabled;
    throwBtn.className = `cb-btn cb-btn-purple ${throwDisabled ? 'cb-btn-disabled' : ''}`;
  }

  // ×5 throw — only visible after buying Wurftraining
  const throw5Btn = document.getElementById('btn-throw5') as HTMLButtonElement | null;
  if (throw5Btn) {
    const hasTraining = S.inventory.includes('throw_training');
    throw5Btn.classList.toggle('cb-hidden', !hasTraining);
    if (hasTraining) {
      const throw5Disabled = S.candies < 50;
      throw5Btn.disabled = throw5Disabled;
      throw5Btn.className = `cb-btn cb-btn-purple ${throw5Disabled ? 'cb-btn-disabled' : ''}`;
    }
  }

  const battleCount = document.getElementById('battle-candy-count');
  if (battleCount) battleCount.textContent = String(Math.floor(S.candies));
}

// ── Prestige ──────────────────────────────────────────────────────────────────

function renderPrestige(): void {
  // Badge in header (only when P > 0)
  const badge = document.getElementById('prestige-badge');
  if (badge) {
    if (S.prestigeCount > 0) {
      badge.textContent = `★ P${S.prestigeCount}`;
      badge.classList.remove('cb-hidden');
    } else {
      badge.classList.add('cb-hidden');
    }
  }

  // Difficulty label below discovery bar (only when P > 0)
  const diffLabel = document.getElementById('difficulty-label');
  if (diffLabel) {
    if (S.prestigeCount > 0) {
      const hpPct  = Math.round(S.prestigeCount * 30);
      const atkPct = Math.round(S.prestigeCount * 20);
      diffLabel.textContent = `⚔️ Prestige ${S.prestigeCount} — Gegner: +${hpPct}% HP · +${atkPct}% Angriff`;
      diffLabel.classList.remove('cb-hidden');
    } else {
      diffLabel.classList.add('cb-hidden');
    }
  }

  // Next-prestige difficulty hint in sec-prestige
  const nextDiff = document.getElementById('prestige-next-diff');
  if (nextDiff) {
    const next    = S.prestigeCount + 1;
    const hpPct   = Math.round(next * 30);
    const atkPct  = Math.round(next * 20);
    const multNext = (1 + next * 0.5).toFixed(1);
    nextDiff.innerHTML =
      `Prestige ${next}: +${hpPct}% Gegner-HP · +${atkPct}% Gegner-Angriff<br>` +
      `<span class="prestige-bonus-hint">🍬 Produktion ×${multNext} · 🪙 Quest-Gold ×${multNext} · Kosten ×${multNext}</span>`;
  }
}

// ── Prestige shop ─────────────────────────────────────────────────────────────

function renderPrestigeShop(): void {
  if (!S.unlocked.includes('prestige_shop')) return;

  const pointsEl = document.getElementById('prestige-points-display');
  if (pointsEl) {
    const pp = S.prestigePoints;
    pointsEl.textContent = pp === 1 ? '⭐ 1 Prestige-Punkt verfügbar' : `⭐ ${pp} Prestige-Punkte verfügbar`;
    pointsEl.classList.toggle('prestige-shop-points--empty', pp === 0);
  }

  const grid = document.getElementById('prestige-shop-grid');
  if (!grid) return;

  if (!grid.dataset.built) {
    grid.dataset.built = '1';
    PRESTIGE_UPGRADES.forEach(upg => {
      const card = document.createElement('div');
      card.className = 'prestige-upg-card';
      card.innerHTML = `
        <div class="prestige-upg-emoji">${upg.emoji}</div>
        <div class="prestige-upg-name">${upg.name}</div>
        <div class="prestige-upg-desc">${upg.description}</div>
        <div class="prestige-upg-cost">Kosten: ⭐ ${upg.cost}</div>
        <div class="prestige-upg-level" id="pupg-level-${upg.id}">—</div>
        <button class="cb-btn cb-btn-prestige-upg" id="btn-pupg-${upg.id}"
                onclick="window.cbBuyPrestigeUpgrade('${upg.id}')">
          ⭐ Kaufen
        </button>
      `;
      grid.appendChild(card);
    });
  }

  PRESTIGE_UPGRADES.forEach(upg => {
    const level     = S.prestigeUpgrades[upg.id] ?? 0;
    const maxedOut  = upg.maxLevel != null && level >= upg.maxLevel;
    const levelEl   = document.getElementById(`pupg-level-${upg.id}`);
    if (levelEl) levelEl.textContent = maxedOut ? 'Erworben' : level > 0 ? `Stufe ${level}` : 'Noch nicht erworben';

    const btn = document.getElementById(`btn-pupg-${upg.id}`) as HTMLButtonElement | null;
    if (!btn) return;
    if (maxedOut) {
      btn.disabled  = true;
      btn.className = 'cb-btn cb-btn-prestige-upg cb-btn-owned';
      btn.textContent = '✓ Erworben';
      return;
    }
    const canAfford = S.prestigePoints >= upg.cost;
    btn.disabled  = !canAfford;
    btn.className = `cb-btn cb-btn-prestige-upg${canAfford ? '' : ' cb-btn-disabled'}`;
    btn.textContent = '⭐ Kaufen';
  });
}

// ── Discovery progress ────────────────────────────────────────────────────────

function renderProgress(): void {
  const total = PROGRESS_MILESTONES.length + RECIPES.length;
  const found = PROGRESS_MILESTONES.filter(id => S.unlocked.includes(id)).length
              + RECIPES.filter(r => S.forgedItems.includes(r.id)).length;
  const pct = Math.round((found / total) * 100);
  const remaining = total - found;

  const pctEl = document.getElementById('discovery-pct');
  const fill  = document.getElementById('discovery-fill');
  const hint  = document.getElementById('discovery-hint');

  if (pctEl) pctEl.textContent = `${pct}%`;
  if (fill)  fill.style.width  = `${pct}%`;
  if (hint) {
    if (remaining === 0)      hint.textContent = '🏆 Alles entdeckt!';
    else if (remaining === 1) hint.textContent = 'Noch 1 Geheimnis verborgen';
    else                      hint.textContent = `Noch ${remaining} Geheimnisse verborgen`;
  }
}

// ── Forge ─────────────────────────────────────────────────────────────────────

function renderForge(): void {
  // ── Materialien-Übersicht ──────────────────────────────────────────────────
  const matEl = document.getElementById('forge-materials');
  if (matEl) {
    const ownedMats = Object.entries(S.materials).filter(([, v]) => v > 0);
    if (ownedMats.length === 0) {
      matEl.innerHTML = '<p class="forge-no-materials">Noch keine seltenen Materialien erbeutet. Besiege Bosse!</p>';
    } else {
      matEl.innerHTML = '<div class="forge-mat-list">' +
        ownedMats.map(([id, count]) => {
          const mat = MATERIALS[id];
          if (!mat) return '';
          return `<span class="forge-mat-badge">${mat.emoji} ${mat.name} <strong>×${count}</strong></span>`;
        }).join('') +
        '</div>';
    }
  }

  // ── Hergestellte Items ────────────────────────────────────────────────────
  const invEl     = document.getElementById('forge-inventory');
  const invBadges = document.getElementById('forge-inv-badges');
  if (invEl && invBadges) {
    const forged = RECIPES.filter(r => S.forgedItems.includes(r.id));
    invEl.classList.toggle('cb-hidden', forged.length === 0);
    const invKey = forged.map(r => r.id).join(',');
    if (invBadges.dataset.inv !== invKey) {
      invBadges.dataset.inv = invKey;
      invBadges.innerHTML = forged.map(r => {
        const bonusParts: string[] = [];
        if (r.result.attackBonus) bonusParts.push(`+${r.result.attackBonus} ⚔️`);
        if (r.result.defense)     bonusParts.push(`+${r.result.defense} 🛡️`);
        if (r.result.maxHp)       bonusParts.push(`+${r.result.maxHp} ❤️`);
        if (r.result.candyBonus)  bonusParts.push(`+${r.result.candyBonus}/s 🍬`);
        return `<span class="forge-inv-badge" title="${bonusParts.join(' · ')}">
          <span class="forge-inv-emoji">${r.emoji}</span>
          <span class="forge-inv-name">${r.name}</span>
          <span class="forge-inv-bonus">${bonusParts.join(' ')}</span>
        </span>`;
      }).join('');
    }
  }

  // ── Rezept-Grid ───────────────────────────────────────────────────────────
  const recipesEl = document.getElementById('forge-recipes');
  if (!recipesEl) return;

  const visibleRecipes = RECIPES.filter(r =>
    (!r.unlock || S.completedQuests.includes(r.unlock)) &&
    (!r.requiresForged || S.forgedItems.includes(r.requiresForged))
  );
  const cacheKey = visibleRecipes.map(r =>
    `${r.id}:${S.forgedItems.includes(r.id)}:${Object.entries(r.materials).map(([m, c]) => (S.materials[m] ?? 0) >= c).join(',')}`
  ).join('|');

  renderCombos();

  if (recipesEl.dataset.rendered === cacheKey) return;
  recipesEl.dataset.rendered = cacheKey;

  if (visibleRecipes.length === 0) {
    recipesEl.innerHTML = '<p class="forge-no-materials">Schließe mehr Quests ab, um Rezepte freizuschalten.</p>';
    return;
  }

  recipesEl.innerHTML = '<div class="forge-recipe-grid">' +
    visibleRecipes.map(recipe => {
      const done = S.forgedItems.includes(recipe.id);
      const canCraft = !done && Object.entries(recipe.materials).every(([m, c]) => (S.materials[m] ?? 0) >= c)
        && (!recipe.costGold || S.gold >= recipe.costGold);

      const matList = Object.entries(recipe.materials).map(([matId, need]) => {
        const mat = MATERIALS[matId];
        const have = S.materials[matId] ?? 0;
        const ok = have >= need;
        const cls = ok ? 'forge-req-ok' : 'forge-req-missing';
        return `<span class="${cls}">${mat?.emoji ?? ''} ${mat?.name ?? matId} ${have}/${need}</span>`;
      });
      if (recipe.costGold) {
        const goldOk = S.gold >= recipe.costGold;
        matList.push(`<span class="${goldOk ? 'forge-req-ok' : 'forge-req-missing'}">🪙 ${S.gold}/${recipe.costGold} Gold</span>`);
      }

      const bonusParts: string[] = [];
      if (recipe.result.attackBonus) bonusParts.push(`+${recipe.result.attackBonus} ⚔️`);
      if (recipe.result.defense)     bonusParts.push(`+${recipe.result.defense} 🛡️`);
      if (recipe.result.maxHp)       bonusParts.push(`+${recipe.result.maxHp} ❤️`);
      if (recipe.result.candyBonus)  bonusParts.push(`+${recipe.result.candyBonus}/s 🍬`);

      const cardCls = done ? 'forge-recipe-card forge-recipe-card--done'
        : canCraft ? 'forge-recipe-card forge-recipe-card--craftable'
        : 'forge-recipe-card';

      const btnLabel = done ? '✓ Hergestellt' : canCraft ? '⚒️ Herstellen' : '⚒️ Herstellen';
      const btnCls = done ? 'cb-btn cb-btn-disabled' : canCraft ? 'cb-btn cb-btn-forge' : 'cb-btn cb-btn-disabled';
      const upgradeBadge = recipe.requiresForged
        ? `<span class="forge-upgrade-badge">⬆ Aufwertung</span>`
        : '';

      return `<div class="${cardCls}">
        <div class="forge-recipe-header">
          <span class="forge-recipe-emoji">${recipe.emoji}</span>
          <span class="forge-recipe-name">${recipe.name}</span>
          ${upgradeBadge}
        </div>
        <div class="forge-recipe-desc">${recipe.description}</div>
        <div class="forge-recipe-bonus">${bonusParts.join(' · ')}</div>
        <div class="forge-req-list">${matList.join('')}</div>
        <button class="${btnCls}" ${done || !canCraft ? 'disabled' : ''}
          onclick="window.cbCraft('${recipe.id}')">${btnLabel}</button>
      </div>`;
    }).join('') +
    '</div>';
}

function renderCombos(): void {
  const combosEl = document.getElementById('forge-combos');
  if (!combosEl) return;

  const visibleCombos = COMBOS.filter(c => !c.unlock || S.completedQuests.includes(c.unlock));
  if (visibleCombos.length === 0) {
    combosEl.innerHTML = '';
    return;
  }

  const cacheKey = visibleCombos.map(c =>
    `${c.id}:${Object.entries(c.materials).map(([m, cnt]) => `${S.materials[m] ?? 0}/${cnt}`).join(',')}`
  ).join('|');
  if (combosEl.dataset.rendered === cacheKey) return;
  combosEl.dataset.rendered = cacheKey;

  combosEl.innerHTML = '<div class="forge-combo-header">🔀 Hybrid-Materialien</div>' +
    '<div class="forge-recipe-grid">' +
    visibleCombos.map(combo => {
      const canCombine = Object.entries(combo.materials).every(([m, c]) => (S.materials[m] ?? 0) >= c);
      const matList = Object.entries(combo.materials).map(([matId, need]) => {
        const mat = MATERIALS[matId];
        const have = S.materials[matId] ?? 0;
        const ok = have >= need;
        return `<span class="${ok ? 'forge-req-ok' : 'forge-req-missing'}">${mat?.emoji ?? ''} ${mat?.name ?? matId} ${have}/${need}</span>`;
      });
      const resultMat = MATERIALS[combo.resultMaterial];
      const cardCls = canCombine ? 'forge-recipe-card forge-recipe-card--craftable' : 'forge-recipe-card';
      const btnCls = canCombine ? 'cb-btn cb-btn-forge' : 'cb-btn cb-btn-disabled';
      return `<div class="${cardCls}">
        <div class="forge-recipe-header">
          <span class="forge-recipe-emoji">${combo.emoji}</span>
          <span class="forge-recipe-name">${combo.name}</span>
          <span class="forge-upgrade-badge">🔀 Hybrid</span>
        </div>
        <div class="forge-recipe-desc">${combo.description}</div>
        <div class="forge-recipe-bonus">→ ${resultMat?.emoji ?? ''} ${resultMat?.name ?? combo.resultMaterial}</div>
        <div class="forge-req-list">${matList.join('')}</div>
        <button class="${btnCls}" ${canCombine ? '' : 'disabled'}
          onclick="window.cbCombine('${combo.id}')">🔀 Kombinieren</button>
      </div>`;
    }).join('') +
    '</div>';
}

// ── Dungeon ───────────────────────────────────────────────────────────────────

function renderDungeon(): void {
  const sec = document.getElementById('sec-dungeon');
  if (!sec) return;

  const d = S.dungeon;
  if (!d) {
    sec.classList.add('cb-hidden');
    document.getElementById('dungeon-canvas-wrap')?.classList.add('cb-hidden');
    return;
  }
  sec.classList.remove('cb-hidden');

  // Header
  const questDef = QUESTS.find(q => q.id === d.questId);
  const titleEl  = document.getElementById('dungeon-title');
  const floorEl  = document.getElementById('dungeon-floor');
  if (titleEl) titleEl.textContent = `${questDef?.emoji ?? '🗺️'} ${questDef?.name ?? d.questId}`;
  const g = d.grid;
  if (floorEl) floorEl.textContent = g ? `Etage ${g.floor} / ${g.totalFloors}` : '';

  // Auto-Pilot toggle — only visible once the prestige upgrade is owned
  const autopilotBtn = document.getElementById('btn-dungeon-autopilot');
  if (autopilotBtn) {
    const owned = (S.prestigeUpgrades['autopilot'] ?? 0) > 0;
    autopilotBtn.classList.toggle('cb-hidden', !owned);
    autopilotBtn.textContent = `🧭 Autopilot: ${S.dungeonAutopilot ? 'AN' : 'AUS'}`;
    autopilotBtn.classList.toggle('cb-btn-autopilot-active', S.dungeonAutopilot);
  }

  // HP bar
  const hpFill  = document.getElementById('dungeon-player-hp-fill');
  const hpLabel = document.getElementById('dungeon-hp-label');
  const pct = S.maxHp > 0 ? (S.hp / S.maxHp) * 100 : 0;
  if (hpFill)  { hpFill.style.width = `${pct}%`; hpFill.style.background = pct > 50 ? 'var(--c-mint)' : pct > 25 ? 'var(--c-yellow)' : 'var(--c-pink)'; }
  if (hpLabel) hpLabel.textContent = `${S.hp} / ${S.maxHp} HP`;

  // Run gold
  const goldEl = document.getElementById('dungeon-run-gold');
  if (goldEl) goldEl.textContent = d.runGold > 0 ? `🪙 ${d.runGold} Dungeon-Gold erbeutet` : '';

  // Run items
  const itemsEl = document.getElementById('dungeon-run-items');
  if (itemsEl) {
    if (d.runItems.length === 0) {
      itemsEl.innerHTML = '<span style="font-size:11px;color:var(--c-muted)">Noch keine Run-Items</span>';
    } else {
      itemsEl.innerHTML = d.runItems.map(id => {
        const def = RUN_ITEMS.find(r => r.id === id);
        if (!def) return '';
        const canActivate = def.type === 'active';
        const cls = canActivate ? 'dungeon-run-tag run-tag-active run-tag-active-btn' : 'dungeon-run-tag run-tag-active';
        const onclick = canActivate ? `onclick="window.cbUseDungeonItem('${id}')"` : '';
        const extra = id === 'fairy_shield' && d.fairyShieldActive ? ' ✓' : id === 'second_wind' && d.secondWindAvailable ? ' ✓' : '';
        return `<span class="${cls}" title="${def.description}" ${onclick}>${def.emoji} ${def.name}${extra}</span>`;
      }).join('');
    }
  }

  // Canvas wrap: visible when exploring or fighting (canvas stays behind battle overlay)
  const canvasWrap = document.getElementById('dungeon-canvas-wrap');
  if (canvasWrap) {
    const showCanvas = d.phase === 'exploring' || d.phase === 'fighting';
    canvasWrap.classList.toggle('cb-hidden', !showCanvas);
  }

  // Actions panel
  const actionsEl = document.getElementById('dungeon-actions');
  if (!actionsEl) return;

  if (d.phase === 'loot' && d.pendingLoot) {
    actionsEl.classList.remove('cb-hidden');
    const loot = d.pendingLoot;
    const lootDesc = loot.runItem
      ? `Run-Item: ${RUN_ITEMS.find(r => r.id === loot.runItem)?.emoji} ${RUN_ITEMS.find(r => r.id === loot.runItem)?.name}`
      : loot.gold ? `+${loot.gold} 🪙 Gold`
      : `+${loot.candies} 🍬 Bonbons`;
    actionsEl.innerHTML = `
      <div class="dungeon-actions-title">📦 Kiste gefunden!</div>
      <div class="dungeon-loot-display">${loot.runItem ? RUN_ITEMS.find(r=>r.id===loot.runItem)?.emoji ?? '🎁' : loot.gold ? '🪙' : '🍬'}</div>
      <div class="dungeon-loot-desc">${lootDesc}</div>
      <button class="cb-btn" onclick="window.cbDungeonCollectLoot()">Einsammeln</button>
    `;
  } else if (d.phase === 'heal_room') {
    actionsEl.classList.remove('cb-hidden');
    const heal = Math.round(S.maxHp * 0.40);
    actionsEl.innerHTML = `
      <div class="dungeon-actions-title">❤️ Heilungsraum</div>
      <div class="dungeon-loot-desc">Du ruhst dich aus und heiltest +${heal} HP.</div>
      <button class="cb-btn cb-btn-pink" onclick="window.cbDungeonHeal()">Heilen</button>
    `;
  } else if (d.phase === 'shop') {
    actionsEl.classList.remove('cb-hidden');
    const offersHtml = d.shopOffers.map((offer, i) => {
      const canAfford = S.gold >= offer.cost;
      const label = offer.type === 'heal'
        ? `❤️ +50% HP heilen`
        : (() => { const def = RUN_ITEMS.find(r => r.id === offer.runItemId); return `${def?.emoji ?? '?'} ${def?.name ?? offer.runItemId}`; })();
      const desc = offer.type === 'heal' ? 'Vollheilung auf 50%' : RUN_ITEMS.find(r => r.id === offer.runItemId)?.description ?? '';
      return `<div class="dungeon-shop-offer">
        <div><div class="dungeon-shop-offer-name">${label}</div><div class="dungeon-shop-offer-desc">${desc}</div></div>
        <button class="cb-btn${canAfford ? '' : ' cb-btn-disabled'}" ${canAfford ? '' : 'disabled'} onclick="window.cbDungeonShopBuy(${i})">
          🪙 ${offer.cost}
        </button>
      </div>`;
    }).join('');
    actionsEl.innerHTML = `
      <div class="dungeon-actions-title">🛒 Dungeon-Shop</div>
      <div class="dungeon-shop-offers">${offersHtml || '<p style="color:var(--c-muted);font-size:12px">Alles verkauft</p>'}</div>
      <button class="cb-btn cb-btn-secondary" style="margin-top:10px" onclick="window.cbDungeonShopLeave()">Weitergehen</button>
    `;
  } else if (d.phase === 'victory') {
    actionsEl.classList.remove('cb-hidden');
    actionsEl.innerHTML = `
      <div class="dungeon-victory-banner">🏆 Dungeon abgeschlossen!</div>
      <button class="cb-btn" onclick="window.cbCloseDungeon()">Dungeon verlassen</button>
    `;
  } else if (d.phase === 'defeat') {
    actionsEl.classList.remove('cb-hidden');
    actionsEl.innerHTML = `
      <div class="dungeon-victory-banner" style="color:var(--c-pink)">💀 Im Dungeon gefallen</div>
      <button class="cb-btn cb-btn-secondary" onclick="window.cbCloseDungeon()">Aufgeben</button>
    `;
  } else {
    actionsEl.classList.add('cb-hidden');
  }

  // Close button: disable during fight
  const closeBtn = document.getElementById('btn-dungeon-close') as HTMLButtonElement | null;
  if (closeBtn) closeBtn.disabled = d.phase === 'fighting';
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

let leaderboardData: { name: string; score: number }[] = [];
let leaderboardPlayerName = '';

export async function refreshLeaderboard(): Promise<void> {
  try {
    const [scoresRes, nameRes] = await Promise.all([
      fetch('/api/scores/candybox'),
      fetch('/api/username'),
    ]);
    if (scoresRes.ok) leaderboardData = await scoresRes.json() as { name: string; score: number }[];
    if (nameRes.ok)   leaderboardPlayerName = ((await nameRes.json()) as { name: string }).name;
  } catch { /* server nicht erreichbar */ }
  renderLeaderboard();
}

function renderLeaderboard(): void {
  const el = document.getElementById('leaderboard-content');
  if (!el) return;

  if (leaderboardData.length === 0) {
    el.innerHTML = '<div class="leaderboard-empty">Noch keine Einträge — starte ein Prestige um deinen Score einzureichen!</div>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const rows = leaderboardData.map((entry, i) => {
    const medal  = medals[i] ?? `${i + 1}.`;
    const isMe   = leaderboardPlayerName && entry.name === leaderboardPlayerName;
    const cls    = isMe ? 'leaderboard-row leaderboard-row--me' : 'leaderboard-row';
    const score  = entry.score.toLocaleString('de-DE');
    return `<div class="${cls}">
      <span class="lb-rank">${medal}</span>
      <span class="lb-name">${isMe ? '<strong>' + entry.name + '</strong>' : entry.name}</span>
      <span class="lb-score">🍬 ${score}</span>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="leaderboard-list">${rows}</div>` +
    `<div class="leaderboard-hint">Bonbons produziert pro Prestige-Zyklus</div>`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

export function showToast(msg: string, type: 'ok' | 'err' | 'info' = 'info'): void {
  const container = document.getElementById('toast-container')!;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-in'));
  setTimeout(() => {
    toast.classList.remove('toast-in');
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// ── Shake / damage animations ─────────────────────────────────────────────────

export function shakeEnemy(): void {
  const el = document.getElementById('battle-enemy-emoji');
  if (!el) return;
  el.classList.remove('shake');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('shake');
}

export function shakePlayer(): void {
  const el = document.getElementById('player-hp-fill');
  if (!el) return;
  el.classList.remove('flash-dmg');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('flash-dmg');
}
