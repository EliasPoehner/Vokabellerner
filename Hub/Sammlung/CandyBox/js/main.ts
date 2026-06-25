import { S, tick, eatCandies, throwCandies, buyItem, buyUpgrade, sellLollipops, sellAllLollipops, startQuest, closeQuest, resetState, prestige, buyPrestigeUpgrade, resolveEvent, toggleAutoHeal, toggleFightSpeed, toggleDungeonAutopilot, powerStrike, parry, useTrank, offlineGainOnLoad, getEatHeal, getPrestigeCostMult, craft, combine, loadFromServer, startDungeon, fightGridEnemy, openGridChest, goToNextFloor, collectDungeonLoot, dungeonHealRoom, dungeonShopBuy, dungeonShopLeave, useDungeonRunItem, closeDungeon, returnToDungeonMap } from './game';
import { render, checkReveal, showToast, refreshLeaderboard, resetRevealedUI, getBattleHotkeyButtons } from './ui';
import { DungeonExplorer } from './dungeon-explorer';
import { UPGRADES, EVENTS, PRESTIGE_UPGRADES, RECIPES, COMBOS, MATERIALS, RUN_ITEMS } from './data';

// ── Dungeon Explorer (singleton) ──────────────────────────────────────────────

const explorer = new DungeonExplorer();

function startExplorer(): void {
  const canvas = document.getElementById('dungeon-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  // Init only once (re-calling after first call is safe since sheet already loaded)
  if (!(explorer as any)._inited) {
    explorer.init(canvas);
    (explorer as any)._inited = true;
  }
  explorer.startExploring(
    (enemyId) => { fightGridEnemy(enemyId); render(); },
    (chestId) => { openGridChest(chestId); render(); },
    () => {
      goToNextFloor();
      render();
      startExplorer(); // restart with new grid
    },
    collectLootAndContinue,
  );
}

// Shared between the manual "Einsammeln"-button and Auto-Pilot, which
// triggers the same collection the instant a chest is opened.
function collectLootAndContinue(): void {
  const loot = S.dungeon?.pendingLoot;
  collectDungeonLoot();
  if (loot?.gold)    showToast(`+${loot.gold} 🪙 Gold`, 'ok');
  if (loot?.candies) showToast(`+${loot.candies} 🍬 Bonbons`, 'ok');
  if (loot?.runItem) {
    const def = RUN_ITEMS.find(r => r.id === loot!.runItem);
    showToast(`${def?.emoji ?? '🎁'} ${def?.name ?? 'Run-Item'} erhalten!`, 'ok');
  }
  render();
  if (S.dungeon?.phase === 'exploring') startExplorer();
}

function gameLoop(): void {
  const hpBefore        = S.hp;
  const phaseBefore     = S.activeQuest?.phase ?? null;
  const dungeonBefore   = S.dungeon?.phase ?? null;
  const eventBefore     = S.activeEvent;

  const newUnlocks = tick();

  const unlockMsgs: Record<string, string> = {
    throw:           '🍭 Neu: Du kannst Bonbons auf den Boden werfen!',
    lollipopField:   '🌱 Lutscher wachsen auf dem Boden!',
    sell:            '🍭 Du kannst jetzt Lutscher verkaufen!',
    shop:            '🛒 Der Laden hat geöffnet!',
    upgrades:        '🌾 Produktions-Upgrades verfügbar!',
    quests:          '🗺️ Quests freigeschaltet!',
    cave:            '🪨 Neue Quest & neue Shop-Items freigeschaltet!',
    tower:           '🏰 Neue Quest & neue Shop-Items freigeschaltet!',
    castle:          '👑 Endgame: Zuckerschloss + Kriegstrommel & Heldenmedaille!',
    prestige:        '💫 Du hast alles besiegt! Prestige verfügbar — wage den nächsten Zyklus.',
    materials_found: '💎 Erstes seltenes Material erbeutet! Baue eine Schmiede im Shop.',
    forge:           '⚒️ Schmiede errichtet! Kombiniere Boss-Materialien zu mächtigen Items.',
    upg_factory:     '🏭 Zuckerfabrik freigeschaltet!',
    upg_accelerator: '🚀 Bonbon-Beschleuniger freigeschaltet!',
    upg_empire:      '🏰 Bonbon-Imperium freigeschaltet!',
  };
  newUnlocks.forEach(id => { if (unlockMsgs[id]) showToast(unlockMsgs[id], 'ok'); });

  if (S.hp < hpBefore && S.activeQuest?.phase === 'fighting') {
    const el = document.getElementById('player-hp-fill');
    if (el) { el.classList.remove('flash-dmg'); void el.offsetWidth; el.classList.add('flash-dmg'); }
  }

  const curPhase = S.activeQuest?.phase ?? null;
  if (curPhase !== phaseBefore) {
    if (curPhase === 'victory') showToast('🎉 Quest gewonnen!', 'ok');
    if (curPhase === 'defeat')  showToast('💀 Quest verloren!', 'err');
  }

  const dungeonPhaseNow = S.dungeon?.phase ?? null;
  if (dungeonBefore === 'fighting' && dungeonPhaseNow === 'exploring') showToast('✅ Gegner besiegt!', 'ok');
  if (dungeonBefore !== 'victory'  && dungeonPhaseNow === 'victory') showToast('🏆 Dungeon abgeschlossen!', 'ok');
  if (dungeonBefore !== null && S.dungeon === null) {
    // Dungeon ended (defeat nulled it, or user closed)
    explorer.stopExploring();
  }

  if (!eventBefore && S.activeEvent === 'thief') {
    showToast('🦝 Ein Waschbär hat Bonbons gestohlen!', 'err');
  }

  render();
}

const COLLAPSIBLE_SECTIONS = ['sec-lollipops', 'sec-upgrades', 'sec-quests'];

function initCollapsible(): void {
  COLLAPSIBLE_SECTIONS.forEach(id => {
    const sec = document.getElementById(id);
    const title = sec?.querySelector('.section-title');
    if (!sec || !title) return;

    const chevron = document.createElement('span');
    chevron.className = 'section-chevron';
    chevron.textContent = '▾';
    title.appendChild(chevron);

    title.addEventListener('click', () => {
      const collapsed = sec.classList.toggle('cb-section--collapsed');
      chevron.textContent = collapsed ? '▸' : '▾';
    });
  });
}

async function init(): Promise<void> {
  render();
  checkReveal();
  initCollapsible();

  if (offlineGainOnLoad > 0) {
    showToast(`⏰ Offline: +${offlineGainOnLoad.toLocaleString('de-DE')} 🍬 Bonbons`, 'info');
  }

  await loadFromServer();
  render();
  checkReveal();
  refreshLeaderboard();

  setInterval(gameLoop, 1000);
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Quest-Kampf: Zahlen 1-9 lösen die jeweils nummerierte Aktionskarte aus
  // (Kraftstoß/Parieren/Tränke/Dungeon-Items — Reihenfolge siehe getBattleHotkeyButtons)
  if (S.activeQuest && /^[1-9]$/.test(e.key)) {
    const btn = getBattleHotkeyButtons()[Number(e.key) - 1];
    if (btn) { btn.click(); return; }
  }

  // Quest-Kampf: Enter bestätigt nach Sieg/Niederlage (Schließen / Nächster Raum)
  if (S.activeQuest && e.key === 'Enter') {
    const nextBtn  = document.querySelector('#battle-dungeon-next button') as HTMLButtonElement | null;
    const closeBtn = document.getElementById('btn-close-quest') as HTMLButtonElement | null;
    if (nextBtn && nextBtn.offsetParent !== null) { nextBtn.click(); return; }
    if (closeBtn && !closeBtn.disabled && closeBtn.offsetParent !== null) { closeBtn.click(); return; }
  }

  switch (e.key.toLowerCase()) {
    case 'e':
      (window as any).cbEat();
      break;
    case 't':
      if (S.unlocked.includes('throw')) (window as any).cbThrow();
      break;
    case 'f':
      if (S.activeQuest?.phase === 'fighting' && S.inventory.includes('battle_drum'))
        (window as any).cbToggleFightSpeed();
      break;
  }
});

// ── Global action bindings ────────────────────────────────────────────────────

(window as any).cbEat = () => {
  if (!eatCandies()) {
    if (S.candies < 10) showToast('Zu wenig Bonbons (10 benötigt)', 'err');
    else showToast('Du bist bereits bei voller HP!', 'info');
    return;
  }
  showToast(`+${getEatHeal()} ❤️ HP`, 'ok');
  render();
};

(window as any).cbThrow = () => {
  if (!throwCandies()) { showToast('Zu wenig Bonbons (10 benötigt)', 'err'); return; }
  showToast('🍭 Lutscher wächst…', 'info');
  render();
};

(window as any).cbThrow5 = () => {
  if (!throwCandies(5)) { showToast('Zu wenig Bonbons (50 benötigt)', 'err'); return; }
  showToast('🍭×5 Lutscher wachsen…', 'info');
  render();
};

(window as any).cbToggleAutoHeal = () => {
  toggleAutoHeal();
  showToast(S.autoHeal ? '💊 Auto-Heal aktiviert (< 50% HP)' : '💊 Auto-Heal deaktiviert', 'info');
  render();
};

(window as any).cbToggleFightSpeed = () => {
  toggleFightSpeed();
  showToast(S.fightSpeed === 2 ? '⚡ Kampfgeschwindigkeit: ×2' : '⚡ Kampfgeschwindigkeit: ×1', 'info');
  render();
};

(window as any).cbBuy = (id: string) => {
  const err = buyItem(id);
  if (err) { showToast(err, 'err'); return; }
  const item = [
    { id: 'sword',  name: '🗡️ Holzschwert' },
    { id: 'hat',    name: '🪖 Lederhut' },
    { id: 'shield', name: '🛡️ Holzschild' },
    { id: 'potion', name: '🧪 Bonbon-Trank' },
  ].find(i => i.id === id);
  showToast(`${item?.name ?? id} gekauft!`, 'ok');
  render();
};

(window as any).cbBuyUpgrade = (id: string) => {
  const err = buyUpgrade(id);
  if (err) { showToast(err, 'err'); return; }
  const upg = UPGRADES.find(u => u.id === id);
  showToast(`${upg?.emoji ?? ''} ${upg?.name ?? id} aktiviert! +${upg?.candyBonus ?? 0} 🍬/s`, 'ok');
  render();
};

(window as any).cbSellLollipops = () => {
  const err = sellLollipops();
  if (err) { showToast(err, 'err'); return; }
  showToast(`🍭 5 Lutscher → +${Math.round(15 * getPrestigeCostMult())} 🪙 Gold`, 'ok');
  render();
};

(window as any).cbSellAllLollipops = () => {
  const earned = sellAllLollipops();
  if (earned === 0) { showToast('Nicht genug Lutscher (5 benötigt)', 'err'); return; }
  showToast(`🍭 Alle verkauft → +${earned} 🪙 Gold`, 'ok');
  render();
};

(window as any).cbResolveEvent = (choiceIndex: number) => {
  const eventId = S.activeEvent;
  const result = resolveEvent(choiceIndex);

  if (result === 'no_gold') {
    showToast('Nicht genug Gold (20 🪙 benötigt)', 'err');
    render();
    return;
  }

  const def = EVENTS.find(e => e.id === eventId);
  if (eventId === 'merchant' && choiceIndex === 0) {
    showToast('🍭 +3 Lutscher erhalten!', 'ok');
  } else if (eventId === 'merchant' && choiceIndex !== 0) {
    showToast(`${def?.emoji ?? ''} Händler abgelehnt`, 'info');
  } else if (eventId === 'thief' && choiceIndex === 0) {
    if (result === 'goblin_caught') showToast('🦝 Erwischt! +25 🪙 Gold', 'ok');
    else showToast('🦝 Entkommen! −5 HP', 'err');
  } else if (eventId === 'thief' && choiceIndex !== 0) {
    showToast('😔 Bonbons verloren', 'info');
  } else if (eventId === 'fairy') {
    showToast('✨ +40 🍬 Bonbons!', 'ok');
  }

  render();
};

(window as any).cbQuest = (id: string) => {
  const err = startQuest(id);
  if (err) { showToast(err, 'err'); return; }
  render();
};

(window as any).cbUseTrank = (type: 'strength' | 'iron') => {
  const err = useTrank(type);
  if (err) { showToast(err, 'err'); return; }
  if (type === 'strength') showToast('💪 Krafttrank! +8 Angriff für 3 Runden', 'ok');
  else showToast('⚙️ Eisentrank! +4 Verteidigung für 3 Runden', 'ok');
  render();
};

(window as any).cbParry = () => {
  const err = parry();
  if (err) { showToast(err, 'err'); return; }
  showToast('🛡️ Parieren aktiv — nächster Treffer wird geblockt!', 'ok');
  render();
};

(window as any).cbPowerStrike = () => {
  const err = powerStrike();
  if (err) { showToast(err, 'err'); return; }
  showToast('⚡ Kraftstoß aufgeladen — nächster Angriff: 2× Schaden!', 'ok');
  render();
};

(window as any).cbCloseQuest = () => {
  closeQuest();
  const sec = document.getElementById('sec-battle');
  if (sec) sec.classList.add('cb-hidden');
  render();
};

(window as any).cbBuyPrestigeUpgrade = (id: string) => {
  const err = buyPrestigeUpgrade(id);
  if (err) { showToast(err, 'err'); return; }
  const upg = PRESTIGE_UPGRADES.find(u => u.id === id);
  const level = S.prestigeUpgrades[id] ?? 1;
  showToast(`${upg?.emoji ?? '⭐'} ${upg?.name ?? id} — Stufe ${level}!`, 'ok');
  render();
};

(window as any).cbPrestige = () => {
  if (!S.completedQuests.includes('candy_realm')) return;
  const next    = S.prestigeCount + 1;
  const hpPct   = Math.round(next * 30);
  const atkPct  = Math.round(next * 20);
  const multNext = (1 + next * 0.5).toFixed(1);
  const score   = Math.floor(S.stats.totalCandiesProduced).toLocaleString('de-DE');
  if (!confirm(
    `Prestige ${next} starten?\n\n` +
    `Dein Score wird eingereicht: ${score} 🍬 Bonbons\n\n` +
    `Alles wird zurückgesetzt (Items, Gold, Quests, Upgrades).\n` +
    `Gegner werden dauerhaft stärker: +${hpPct}% HP · +${atkPct}% Angriff\n` +
    `Bonbon-Produktion: ×${multNext} schneller im nächsten Zyklus\n\n` +
    `Fortfahren?`
  )) return;
  explorer.stopExploring(); // in case Prestige was clicked straight from a dungeon victory screen
  prestige();
  resetRevealedUI();
  showToast(`💫 Prestige ${S.prestigeCount}! Produktion ×${multNext} — Score eingereicht!`, 'ok');
  render();
  refreshLeaderboard();
};

(window as any).cbCraft = (id: string) => {
  const err = craft(id);
  if (err) { showToast(err, 'err'); }
  else {
    const recipe = RECIPES.find(r => r.id === id);
    showToast(`⚒️ ${recipe?.name ?? id} hergestellt!`, 'ok');
  }
  render();
};

(window as any).cbCombine = (id: string) => {
  const err = combine(id);
  if (err) { showToast(err, 'err'); }
  else {
    const combo = COMBOS.find(c => c.id === id);
    const resultMat = MATERIALS[combo?.resultMaterial ?? ''];
    showToast(`🔀 ${resultMat?.name ?? id} erzeugt!`, 'ok');
  }
  render();
};

(window as any).cbStartDungeon = (id: string) => {
  const err = startDungeon(id);
  if (err) { showToast(err, 'err'); return; }
  showToast('🗺️ Dungeon betreten! Bewege dich mit WASD.', 'info');
  render();
  startExplorer();
};

(window as any).cbDungeonCollectLoot = collectLootAndContinue;

(window as any).cbDungeonHeal = () => {
  dungeonHealRoom();
  showToast('❤️ Geheilt!', 'ok');
  render();
};

(window as any).cbDungeonShopBuy = (i: number) => {
  const err = dungeonShopBuy(i);
  if (err) { showToast(err, 'err'); return; }
  showToast('✅ Gekauft!', 'ok');
  render();
};

(window as any).cbDungeonShopLeave = () => {
  dungeonShopLeave();
  render();
};

(window as any).cbUseDungeonItem = (id: string) => {
  const err = useDungeonRunItem(id);
  if (err) { showToast(err, 'err'); return; }
  showToast(`✅ ${id} verwendet!`, 'ok');
  render();
};

(window as any).cbCloseDungeon = () => {
  explorer.stopExploring();
  closeDungeon();
  render();
};

(window as any).cbToggleShop = () => {
  document.getElementById('shop-modal')?.classList.toggle('cb-hidden');
};

(window as any).cbReturnToDungeonMap = () => {
  returnToDungeonMap();
  render();
};

(window as any).cbToggleDungeonAutopilot = () => {
  toggleDungeonAutopilot();
  render();
};

(window as any).cbReset = () => {
  if (!confirm('Spielstand wirklich löschen?')) return;
  resetState();
  location.reload();
};

document.addEventListener('DOMContentLoaded', init);
