import type { GameState, QuestRun, DungeonRun, DungeonGrid, GridEnemy, GridChest, GridDoor, DungeonRow, DungeonRoom, LootDrop, EnemyDef, DungeonShopOffer } from './types';
import { ITEMS, UPGRADES, QUESTS, EVENTS, PRESTIGE_UPGRADES, BOSS_DROPS, BOSS_DROP_CHANCE, MATERIALS, RECIPES, COMBOS, RUN_ITEMS, DUNGEON_CONFIG } from './data';

const SAVE_KEY = 'candybox_save_v1';
const EAT_COST = 10;
const BASE_EAT_HEAL = 5;
const EAT_COOLDOWN = 5;
const THROW_COST = 10;
const LOLLIPOP_COOLDOWN = 15;
const LOLLIPOP_COOLDOWN_FAST = 8;   // with growth_fert
const FIGHT_INTERVAL = 2;
const BASE_PLAYER_ATTACK = 9;
const SELL_LOLLIPOP_COUNT = 5;
const SELL_LOLLIPOP_GOLD = 15;
const EVENT_INTERVAL_MIN = 80;
const EVENT_INTERVAL_MAX = 120;
const OFFLINE_CAP_SECONDS = 3600;
const OFFLINE_CAP_EXTENDED = 14400; // with travel_pack (4h)

export let offlineGainOnLoad = 0;

export function createInitialState(): GameState {
  return {
    candies: 0,
    candyPerSec: 1,
    lollipops: 0,
    lollipopQueue: 0,
    lollipopCooldown: 0,
    gold: 0,
    hp: 20,
    maxHp: 20,
    defense: 0,
    inventory: [],
    upgrades: [],
    unlocked: ['candies'],
    activeQuest: null,
    dungeon: null,
    activeEvent: null,
    eventCooldown: EVENT_INTERVAL_MIN + Math.floor(Math.random() * (EVENT_INTERVAL_MAX - EVENT_INTERVAL_MIN)),
    completedQuests: [],
    eatCooldown: 0,
    prestigeCount: 0,
    prestigePoints: 0,
    prestigeUpgrades: {},
    prestigeCandyMult: 1,
    materials: {},
    forgedItems: [],
    autoHeal: false,
    fightSpeed: 1,
    dungeonAutopilot: false,
    lastSaved: 0,
    stats: { candiesEaten: 0, candiesThrown: 0, questsWon: 0, lollipopsSold: 0, totalCandiesProduced: 0, goldEarned: 0 },
  };
}

export let S: GameState = loadState();

export function saveState(): void {
  S.lastSaved = Date.now();
  const json = JSON.stringify(S);
  localStorage.setItem(SAVE_KEY, json);
  fetch('/api/saves/candybox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
  }).catch(() => { /* Server nicht erreichbar — localStorage reicht */ });
}

export async function loadFromServer(): Promise<void> {
  try {
    const res = await fetch('/api/saves/candybox');
    if (!res.ok) return;
    const parsed = await res.json() as Partial<GameState>;
    if (!parsed || typeof parsed !== 'object') return;
    // Server-Stand nur übernehmen wenn neuer als lokaler Stand
    if ((parsed.lastSaved ?? 0) <= S.lastSaved) return;
    const init = createInitialState();
    S = {
      ...init,
      ...parsed,
      autoHeal: parsed.autoHeal ?? false,
      fightSpeed: (parsed.fightSpeed === 2 ? 2 : 1),
      dungeonAutopilot: parsed.dungeonAutopilot ?? false,
      lastSaved: parsed.lastSaved ?? Date.now(),
      stats: { ...init.stats, ...(parsed.stats ?? {}) },
      materials:   (parsed as any).materials   ?? {},
      forgedItems: (parsed as any).forgedItems ?? [],
      dungeon:     (parsed as any).dungeon     ?? null,
    };
    if (S.activeQuest) {
      const aq = S.activeQuest as any;
      if (aq.roundCount === undefined)        S.activeQuest.roundCount = 0;
      if (aq.playerStunned === undefined)     S.activeQuest.playerStunned = false;
      if (aq.powerStrikeQueued === undefined) S.activeQuest.powerStrikeQueued = false;
      if (aq.blockQueued === undefined)       S.activeQuest.blockQueued = false;
      if (aq.blockCooldown === undefined)     S.activeQuest.blockCooldown = 0;
      if (aq.poisonRounds === undefined)      S.activeQuest.poisonRounds = 0;
      if (aq.attackBuff === undefined)        S.activeQuest.attackBuff = 0;
      if (aq.defenseBuff === undefined)       S.activeQuest.defenseBuff = 0;
    }
    // Migrate old map-based dungeon format
    if (S.dungeon && ((S.dungeon as any).phase === 'map' || (S.dungeon as any).map != null)) {
      S.dungeon = null;
      S.activeQuest = null;
    }
    if (S.dungeon && (S.dungeon as any).currentEnemyId === undefined) {
      (S.dungeon as any).currentEnemyId = null;
    }
    if (S.dungeon?.grid && (S.dungeon.grid as any).doors === undefined) {
      (S.dungeon.grid as any).doors = [];
    }
    // Dieselbe einmalige Migration wie in loadState()
    if (S.prestigeCount > 0) {
      const hpBonus  = (S.prestigeUpgrades['iron_skin'] ?? 0) * 15;
      const defBonus = (S.prestigeUpgrades['guardian']  ?? 0) * 2;
      S.maxHp    = Math.max(20, S.maxHp - hpBonus);
      S.hp       = Math.min(S.hp, S.maxHp);
      S.defense  = Math.max(0, S.defense - defBonus);
      S.prestigeCount    = 0;
      S.prestigePoints   = 0;
      S.prestigeUpgrades = {};
      S.prestigeCandyMult = 1;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch { /* Server nicht erreichbar */ }
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameState>;
      const init = createInitialState();
      const state: GameState = {
        ...init,
        ...parsed,
        autoHeal: parsed.autoHeal ?? false,
        fightSpeed: (parsed.fightSpeed === 2 ? 2 : 1),
        dungeonAutopilot: parsed.dungeonAutopilot ?? false,
        lastSaved: parsed.lastSaved ?? Date.now(),
        stats: { ...init.stats, ...(parsed.stats ?? {}) },
        materials:   (parsed as any).materials   ?? {},
        forgedItems: (parsed as any).forgedItems ?? [],
        dungeon:     (parsed as any).dungeon     ?? null,
      };

      // Einmalige Migration: Prestige-Exploit-Reset (läuft nur wenn prestigeCount > 0,
      // danach ist er 0 und die Bedingung ist nie wieder wahr)
      if (state.prestigeCount > 0) {
        const hpBonus  = (state.prestigeUpgrades['iron_skin'] ?? 0) * 15;
        const defBonus = (state.prestigeUpgrades['guardian']  ?? 0) * 2;
        state.maxHp    = Math.max(20, state.maxHp - hpBonus);
        state.hp       = Math.min(state.hp, state.maxHp);
        state.defense  = Math.max(0, state.defense - defBonus);
        state.prestigeCount    = 0;
        state.prestigePoints   = 0;
        state.prestigeUpgrades = {};
        state.prestigeCandyMult = 1;
      }

      // Backcompat: alte Speicherstände ohne prestigeCandyMult
      if (!(parsed as any).prestigeCandyMult && state.prestigeCount > 0) {
        state.prestigeCandyMult = 1 + state.prestigeCount * 0.5;
      }

      // Backcompat: alte Speicherstände haben neue QuestRun-Felder noch nicht
      if (state.activeQuest) {
        const aq = state.activeQuest as any;
        if (aq.roundCount === undefined)        state.activeQuest.roundCount = 0;
        if (aq.playerStunned === undefined)     state.activeQuest.playerStunned = false;
        if (aq.powerStrikeQueued === undefined) state.activeQuest.powerStrikeQueued = false;
        if (aq.blockQueued === undefined)       state.activeQuest.blockQueued = false;
        if (aq.blockCooldown === undefined)     state.activeQuest.blockCooldown = 0;
        if (aq.poisonRounds === undefined)      state.activeQuest.poisonRounds = 0;
        if (aq.attackBuff === undefined)        state.activeQuest.attackBuff = 0;
        if (aq.defenseBuff === undefined)       state.activeQuest.defenseBuff = 0;
      }

      // Migrate old map-based dungeon saves
      if (state.dungeon && ((state.dungeon as any).phase === 'map' || (state.dungeon as any).map != null)) {
        state.dungeon = null;
        state.activeQuest = null;
      }
      if (state.dungeon && (state.dungeon as any).currentEnemyId === undefined) {
        (state.dungeon as any).currentEnemyId = null;
      }
      if (state.dungeon?.grid && (state.dungeon.grid as any).doors === undefined) {
        (state.dungeon.grid as any).doors = [];
      }

      if (state.inventory.includes('offline_book')) {
        const cap = state.inventory.includes('travel_pack') ? OFFLINE_CAP_EXTENDED : OFFLINE_CAP_SECONDS;
        const now = Date.now();
        const secondsAway = Math.min((now - state.lastSaved) / 1000, cap);
        if (secondsAway > 5) {
          const gained = Math.floor(state.candyPerSec * secondsAway);
          state.candies += gained;
          state.stats.totalCandiesProduced += gained;
          offlineGainOnLoad = gained;
        }
      }

      return state;
    }
  } catch { /* corrupt save */ }
  return createInitialState();
}

export function resetState(): void {
  localStorage.removeItem(SAVE_KEY);
  fetch('/api/saves/candybox', { method: 'DELETE' }).catch(() => {});
  S = createInitialState();
  offlineGainOnLoad = 0;
}

export function prestige(): void {
  if (!S.completedQuests.includes('candy_realm')) return;
  const count    = S.prestigeCount + 1;
  const points   = S.prestigePoints + 1;
  const upgrades = { ...S.prestigeUpgrades };
  const scoreToSubmit = Math.floor(S.stats.totalCandiesProduced);
  resetState();
  S.prestigeCount    = count;
  S.prestigePoints   = points;
  S.prestigeUpgrades = upgrades;
  S.prestigeCandyMult = 1 + count * 0.5;
  // Reapply permanent stat bonuses from prestige upgrades to fresh stats
  const hpBonus  = (upgrades['iron_skin'] ?? 0) * 15;
  const defBonus = (upgrades['guardian']  ?? 0) * 2;
  S.maxHp   += hpBonus;
  S.hp       = S.maxHp;
  S.defense += defBonus;
  if (scoreToSubmit > 0) {
    fetch('/api/scores/candybox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: scoreToSubmit }),
    }).catch(() => {});
  }
  saveState();
}

export function buyPrestigeUpgrade(id: string): string | null {
  const def = PRESTIGE_UPGRADES.find(u => u.id === id);
  if (!def) return 'Unbekanntes Upgrade';
  if (def.maxLevel != null && (S.prestigeUpgrades[id] ?? 0) >= def.maxLevel) return 'Bereits erworben';
  if (S.prestigePoints < def.cost) return `Nicht genug Prestige-Punkte (${def.cost} benötigt)`;
  S.prestigePoints -= def.cost;
  S.prestigeUpgrades[id] = (S.prestigeUpgrades[id] ?? 0) + 1;
  if (id === 'iron_skin') { S.maxHp += 15; S.hp = Math.min(S.hp + 15, S.maxHp); }
  if (id === 'guardian')  { S.defense += 2; }
  // 'battle_spirit' and 'sugar_blood' take effect via calcPlayerAttack() / getEatHeal()
  saveState();
  return null;
}

export function getEatHeal(): number {
  const base = S.inventory.includes('heal_herbs') ? 10 : BASE_EAT_HEAL;
  return base + (S.prestigeUpgrades['sugar_blood'] ?? 0) * 3;
}

export function getPrestigeCostMult(): number {
  return 1 + S.prestigeCount * 0.5;
}

function lollipopCooldownDuration(): number {
  return S.inventory.includes('growth_fert') ? LOLLIPOP_COOLDOWN_FAST : LOLLIPOP_COOLDOWN;
}

function calcPlayerAttack(): number {
  let base = BASE_PLAYER_ATTACK + (S.prestigeUpgrades['battle_spirit'] ?? 0) * 3;
  if (S.inventory.includes('sword'))           base += 5;
  if (S.inventory.includes('steel_blade'))     base += 8;
  if (S.inventory.includes('hero_medal'))      base += 5;
  if (S.forgedItems.includes('geister_sense_plus')) base += 20;
  else if (S.forgedItems.includes('geister_sense'))  base += 12;
  if (S.activeQuest?.attackBuff && S.activeQuest.attackBuff > 0) base += 8;
  if (S.dungeon?.runItems.includes('war_horn')) base += 12;
  return Math.max(1, base + Math.floor(Math.random() * 5) - 2);
}

function checkUnlocks(): string[] {
  const gained: string[] = [];
  const add = (id: string) => { if (!S.unlocked.includes(id)) { S.unlocked.push(id); gained.push(id); } };

  if (S.candies >= 10) add('throw');
  if (S.lollipops >= 1) add('lollipopField');
  if (S.lollipops >= 5) add('sell');
  if (S.gold >= 1) add('shop');
  if (S.inventory.includes('sword')) add('quests');
  if (S.completedQuests.includes('forest')) add('cave');
  if (S.completedQuests.includes('cave'))   add('tower');
  if (S.completedQuests.includes('tower'))  add('castle');
  if (S.completedQuests.includes('castle')) add('volcano');
  // Seiten-Quests (erste Ebene)
  if (S.completedQuests.includes('forest') && S.inventory.includes('shield')) add('swamp');
  if (S.completedQuests.includes('cave'))   add('bandit_camp');
  if (S.completedQuests.includes('tower'))  add('crypt');
  if (S.completedQuests.includes('castle')) add('dungeon_keep');
  // Seiten-Quest-Ketten (zweite Ebene)
  if (S.completedQuests.includes('swamp'))         add('witch_tower');
  if (S.completedQuests.includes('bandit_camp'))   add('bandit_fortress');
  // Post-Vulkan
  if (S.completedQuests.includes('volcano'))    add('ice_palace');
  if (S.completedQuests.includes('volcano'))    add('dragon_nest');
  if (S.completedQuests.includes('ice_palace')) add('candy_realm');
  if (S.completedQuests.includes('ice_palace')) add('tundra');
  if (S.completedQuests.includes('candy_realm')) add('prestige');
  if (S.prestigeCount > 0) add('prestige_shop');
  if (Object.values(S.materials).some(v => v > 0)) add('materials_found');
  if (S.inventory.includes('forge_blueprint')) add('forge');

  // Produktions-Upgrades: Lutscher-Verkauf + Quest-Fortschritt (verzweigt)
  if (S.upgrades.includes('farm'))         { add('upg_farm'); add('upgrades'); }
  if (S.upgrades.includes('factory'))      add('upg_factory');
  if (S.upgrades.includes('accelerator'))  add('upg_accelerator');
  if (S.upgrades.includes('candy_empire')) add('upg_empire');
  if (S.stats.lollipopsSold >= 20) { add('upg_farm'); add('upgrades'); }
  if (S.stats.lollipopsSold >= 50 && S.upgrades.includes('farm'))                              add('upg_factory');
  if (S.upgrades.includes('factory')      && S.completedQuests.includes('forest'))             add('upg_accelerator');
  if (S.upgrades.includes('accelerator')  && S.completedQuests.includes('cave'))               add('upg_empire');

  return gained;
}

const POWER_STRIKE_COST = 20;
const BLOCK_COOLDOWN    = 4;
const POISON_DAMAGE     = 2;
const POISON_ROUNDS     = 4;
const CRIT_CHANCE_PLAYER = 0.15;
const CRIT_CHANCE_ENEMY  = 0.10;

function processFightRound(): void {
  const q = S.activeQuest!;
  if (q.phase !== 'fighting') return;
  const enemy = q.enemies[q.enemyIndex];

  q.roundCount++;
  if (q.blockCooldown > 0) q.blockCooldown--;

  // ── Gifttick ───────────────────────────────────────────────────────────────
  if (q.poisonRounds > 0) {
    const poisonDmg = S.inventory.includes('heal_herbs') ? 1 : POISON_DAMAGE;
    q.playerHp = Math.max(0, q.playerHp - poisonDmg);
    S.hp = q.playerHp;
    q.poisonRounds--;
    q.log.push(`🤢 Gifttick: −${poisonDmg} HP${q.poisonRounds > 0 ? ` (${q.poisonRounds} Runden verbleibend)` : ' (Vergiftung endet)'}`);
    if (q.playerHp <= 0) {
      if (S.dungeon?.secondWindAvailable) {
        S.dungeon.secondWindAvailable = false;
        q.playerHp = 5;
        S.hp = 5;
        q.log.push(`💨 Zweite Chance! Du überlebst mit 5 HP!`);
      } else {
        q.phase = 'defeat';
        S.hp = Math.ceil(S.maxHp * 0.35);
        q.playerHp = S.hp;
        if (S.dungeon) {
          S.dungeon.phase = 'defeat';
          S.dungeon = null;
        }
        q.log.push(`💀 Das Gift hat dich besiegt! Du überlebst mit ${S.hp} HP.`);
        return;
      }
    }
  }

  // ── Spieler greift an (außer betäubt) ──────────────────────────────────────
  if (q.playerStunned) {
    q.playerStunned = false;
    q.log.push(`😵 Du bist betäubt und kannst nicht angreifen!`);
  } else {
    let pDmg = calcPlayerAttack();
    const crit = Math.random() < CRIT_CHANCE_PLAYER;
    if (crit) pDmg = Math.floor(pDmg * 1.8);
    const powerStrike = q.powerStrikeQueued;
    if (powerStrike) { pDmg = Math.floor(pDmg * 2); q.powerStrikeQueued = false; }

    const suffix = (crit ? ' 💥 KRITISCH!' : '') + (powerStrike ? ' ⚡ Kraftstoß!' : '');
    enemy.hp = Math.max(0, enemy.hp - pDmg);
    q.log.push(`⚔️ Du triffst ${enemy.emoji} ${enemy.name} für ${pDmg} Schaden!${suffix}`);

    if (enemy.hp <= 0) {
      const bossLabel = enemy.isBoss ? ' 💀 BOSS besiegt!' : '';
      q.log.push(`✨ ${enemy.emoji} ${enemy.name} ist besiegt!${bossLabel}`);

      if (enemy.isBoss) {
        const matId = BOSS_DROPS[q.questId];
        const chance = BOSS_DROP_CHANCE[q.questId] ?? 0.20;
        if (matId && Math.random() < chance) {
          S.materials[matId] = (S.materials[matId] ?? 0) + 1;
          const mat = MATERIALS[matId];
          q.log.push(`💎 Seltener Fund! ${mat.emoji} ${mat.name} erbeutet!`);
        } else if (matId) {
          q.log.push(`✨ Kein seltenes Material dieses Mal.`);
        }
      }

      q.enemyIndex++;
      q.roundCount = 0;

      if (q.enemyIndex >= q.enemies.length) {
        q.phase = 'victory';
        const isDungeonRoom = q.dungeonRoomType != null;
        const isBossRoom    = q.dungeonRoomType === 'boss';

        if (!isDungeonRoom || isBossRoom) {
          const def = QUESTS.find(d => d.id === q.questId)!;
          const questGold = Math.round(def.goldReward * getPrestigeCostMult());
          S.gold += questGold;
          S.stats.goldEarned += questGold;
          if (!S.completedQuests.includes(q.questId)) S.completedQuests.push(q.questId);
          S.stats.questsWon++;
          checkUnlocks();
          q.log.push(`🎉 Quest abgeschlossen! +${questGold} 🪙 Gold`);
        } else {
          q.log.push(`✅ Raum geleert!`);
        }
        return;
      }

      const next = q.enemies[q.enemyIndex];
      q.log.push(`⚠️ Nächster Gegner: ${next.emoji} ${next.name} (${next.maxHp} HP)${next.isBoss ? ' ⚠️ BOSS!' : ''}`);
      if (next.specialMove) q.log.push(`⚡ Fähigkeit: ${next.specialMove.name} (alle ${next.specialMove.cooldown} Runden)`);
      if (next.poisonChance) q.log.push(`🤢 Kann vergiften!`);
      return;
    }
  }

  // ── Gegnervergiftung (poison_candy) ────────────────────────────────────────
  if ((q.enemyPoisonRounds ?? 0) > 0) {
    enemy.hp = Math.max(0, enemy.hp - 3);
    q.enemyPoisonRounds! -= 1;
    q.log.push(`☠️ Gift: ${enemy.emoji} ${enemy.name} erleidet 3 Schaden! (${q.enemyPoisonRounds} Runden verbleibend)`);
    if (enemy.hp <= 0) {
      q.log.push(`✨ ${enemy.emoji} ${enemy.name} ist am Gift gestorben!`);
      q.enemyIndex++;
      q.roundCount = 0;
      q.enemyPoisonRounds = 0;
      if (q.enemyIndex >= q.enemies.length) {
        q.phase = 'victory';
        if (!q.dungeonRoomType) {
          const def = QUESTS.find(d => d.id === q.questId)!;
          const questGold = Math.round(def.goldReward * getPrestigeCostMult());
          S.gold += questGold;
          S.stats.goldEarned += questGold;
          if (!S.completedQuests.includes(q.questId)) S.completedQuests.push(q.questId);
          S.stats.questsWon++;
          checkUnlocks();
          q.log.push(`🎉 Quest abgeschlossen! +${questGold} 🪙 Gold`);
        }
        return;
      }
      const next = q.enemies[q.enemyIndex];
      q.log.push(`⚠️ Nächster Gegner: ${next.emoji} ${next.name} (${next.maxHp} HP)`);
      return;
    }
  }

  // ── Gegner greift an ───────────────────────────────────────────────────────
  const special = enemy.specialMove;
  const useSpecial = !!(special && q.roundCount > 0 && q.roundCount % special.cooldown === 0);

  const dungeonSteelSkin = (S.dungeon?.runItems.includes('steel_skin') ?? false) ? 4 : 0;
  const defenseBonus = (q.defenseBuff > 0 ? 4 : 0) + dungeonSteelSkin;
  const fairyShield = S.dungeon?.fairyShieldActive ?? false;

  if (q.blockQueued || fairyShield) {
    q.blockQueued = false;
    if (fairyShield && S.dungeon) {
      S.dungeon.fairyShieldActive = false;
      q.log.push(`🧚 Feenschutz! Der Angriff von ${enemy.emoji} ${enemy.name} wird abgewehrt!`);
    } else {
      q.log.push(`🛡️ Pariert! Du blockst den Angriff von ${enemy.emoji} ${enemy.name}!`);
    }
  } else if (useSpecial) {
    const rawDmg = special!.damage;
    const eDmg = special!.pierceDefense
      ? Math.max(1, rawDmg)
      : Math.max(1, rawDmg - S.defense - defenseBonus - Math.floor(Math.random() * 2));
    q.playerHp = Math.max(0, q.playerHp - eDmg);
    S.hp = q.playerHp;
    const pierceSuffix = special!.pierceDefense ? ' (ignoriert Rüstung!)' : '';
    q.log.push(`⚠️ ${enemy.emoji} ${enemy.name}: ${special!.name}! ${eDmg} Schaden${pierceSuffix}`);
    if (special!.stunPlayer) {
      q.playerStunned = true;
      q.log.push(`😵 Du wirst betäubt — nächste Runde kein Angriff!`);
    }
    if (special!.canPoison) {
      q.poisonRounds = Math.max(q.poisonRounds, POISON_ROUNDS);
      q.log.push(`🤢 Du wirst vergiftet! (${POISON_ROUNDS} Runden)`);
    }
  } else {
    const crit = Math.random() < CRIT_CHANCE_ENEMY;
    const rawDmg = crit ? Math.floor(enemy.attack * 1.5) : enemy.attack;
    const eDmg = Math.max(1, rawDmg - S.defense - defenseBonus - Math.floor(Math.random() * 2));
    q.playerHp = Math.max(0, q.playerHp - eDmg);
    S.hp = q.playerHp;
    q.log.push(`💥 ${enemy.emoji} ${enemy.name} schlägt zurück: ${eDmg} Schaden!${crit ? ' 💥 Kritisch!' : ''}`);
    if (enemy.poisonChance && Math.random() < enemy.poisonChance) {
      q.poisonRounds = Math.max(q.poisonRounds, POISON_ROUNDS);
      q.log.push(`🤢 Du wirst vergiftet! (${POISON_ROUNDS} Runden)`);
    }
  }

  if (q.playerHp <= 0) {
    if (S.dungeon?.secondWindAvailable) {
      S.dungeon.secondWindAvailable = false;
      q.playerHp = 5;
      S.hp = 5;
      q.log.push(`💨 Zweite Chance! Du überlebst mit 5 HP!`);
    } else {
      q.phase = 'defeat';
      S.hp = Math.ceil(S.maxHp * 0.35);
      q.playerHp = S.hp;
      if (S.dungeon) {
        S.dungeon.phase = 'defeat';
        S.dungeon = null;
        q.log.push(`💀 Du wurdest im Dungeon besiegt! Du überlebst mit ${S.hp} HP.`);
      } else {
        q.log.push(`💀 Du wurdest besiegt! Du überlebst mit ${S.hp} HP.`);
      }
      return;
    }
  }

  // Buff-Tick am Rundenende (läuft nicht bei Sieg/Niederlage/Gegnerwechsel)
  if (q.attackBuff > 0) {
    q.attackBuff--;
    if (q.attackBuff === 0) q.log.push(`💪 Krafttrank-Wirkung endet.`);
  }
  if (q.defenseBuff > 0) {
    q.defenseBuff--;
    if (q.defenseBuff === 0) q.log.push(`⚙️ Eisentrank-Wirkung endet.`);
  }
}

function nextEventCooldown(): number {
  return EVENT_INTERVAL_MIN + Math.floor(Math.random() * (EVENT_INTERVAL_MAX - EVENT_INTERVAL_MIN));
}

function triggerRandomEvent(): void {
  if (!S.unlocked.includes('shop')) return;
  const def = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  S.activeEvent = def.id;

  if (def.id === 'thief') {
    const stolen = Math.min(Math.floor(S.candies), 30);
    S.candies = Math.max(0, S.candies - stolen);
  }
}

export function resolveEvent(choiceIndex: number): string | null {
  if (!S.activeEvent) return null;
  const eventId = S.activeEvent;

  if (eventId === 'merchant' && choiceIndex === 0) {
    if (S.gold < 20) return 'no_gold';
    S.gold -= 20;
    S.lollipops += 3;
  }

  let result: string | null = null;
  if (eventId === 'thief' && choiceIndex === 0) {
    const catchChance = S.inventory.includes('lucky_clover') ? 0.8 : 0.6;
    if (Math.random() < catchChance) {
      S.gold += 25;
      S.stats.goldEarned += 25;
      result = 'goblin_caught';
    } else {
      S.hp = Math.max(1, S.hp - 5);
      result = 'goblin_escaped';
    }
  }

  if (eventId === 'fairy') {
    const bonus = S.inventory.includes('lucky_clover') ? 60 : 40;
    S.candies += bonus;
    S.stats.totalCandiesProduced += bonus;
  }

  S.activeEvent = null;
  S.eventCooldown = nextEventCooldown();
  saveState();
  return result;
}

export function tick(): string[] {
  const produced = S.candyPerSec * S.prestigeCandyMult;
  S.candies += produced;
  S.stats.totalCandiesProduced += produced;

  if (S.eatCooldown > 0) S.eatCooldown--;

  if (S.autoHeal && S.eatCooldown === 0 && S.inventory.includes('autoheal_kit') && S.candies >= EAT_COST && S.hp < S.maxHp * 0.5) {
    const heal = getEatHeal();
    S.candies -= EAT_COST;
    S.hp = Math.min(S.maxHp, S.hp + heal);
    if (S.activeQuest) S.activeQuest.playerHp = S.hp;
    S.stats.candiesEaten += EAT_COST;
    S.eatCooldown = EAT_COOLDOWN;
  }

  if (S.lollipopCooldown > 0) {
    S.lollipopCooldown--;
    if (S.lollipopCooldown === 0 && S.lollipopQueue > 0) {
      S.lollipops++;
      S.lollipopQueue--;
      if (S.lollipopQueue > 0) S.lollipopCooldown = lollipopCooldownDuration();
    }
  }

  if (S.activeQuest?.phase === 'fighting') {
    S.activeQuest.fightTick++;
    if (S.activeQuest.fightTick >= FIGHT_INTERVAL) {
      S.activeQuest.fightTick = 0;
      processFightRound();
      if (S.fightSpeed === 2 && S.inventory.includes('battle_drum') && S.activeQuest?.phase === 'fighting') {
        processFightRound();
      }
    }
  }

  // Dungeon room victory detection (only when dungeon is still in 'fighting' phase)
  if (S.dungeon?.phase === 'fighting' && S.activeQuest?.phase === 'victory') {
    handleDungeonRoomVictory();
    // For non-boss: activeQuest is now null, dungeon phase is 'exploring' → render will hide battle UI
    // For boss: activeQuest stays, dungeon phase is 'victory'
  }

  if (!S.activeEvent && S.activeQuest?.phase !== 'fighting') {
    S.eventCooldown--;
    if (S.eventCooldown <= 0) {
      triggerRandomEvent();
    }
  }

  const gained = checkUnlocks();
  saveState();
  return gained;
}

// ── Dungeon System (Grid-basiert) ─────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 4294967296;
  };
}

const GRID_W = 40;
const GRID_H = 28;
const TOTAL_FLOORS = 2;

interface Rm { x: number; y: number; w: number; h: number; cx: number; cy: number; }

type DTile = import('./types').DungeonTile;
type DoorPos = { x: number; y: number } | null;

function placeRooms(rng: () => number): Rm[] {
  const rooms: Rm[] = [];
  const numRooms = 3 + Math.floor(rng() * 3); // 3–5
  for (let i = 0; i < numRooms; i++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const w  = 5 + Math.floor(rng() * 5);  // 5–9
      const h  = 4 + Math.floor(rng() * 4);  // 4–7
      const rx = 1 + Math.floor(rng() * (GRID_W - w - 2));
      const ry = 1 + Math.floor(rng() * (GRID_H - h - 2));
      const overlaps = rooms.some(r =>
        rx < r.x + r.w + 2 && rx + w + 2 > r.x &&
        ry < r.y + r.h + 2 && ry + h + 2 > r.y
      );
      if (!overlaps) {
        rooms.push({ x: rx, y: ry, w, h, cx: rx + Math.floor(w / 2), cy: ry + Math.floor(h / 2) });
        break;
      }
    }
  }
  return rooms;
}

// Carves room interiors (outer ring stays void/wall) and connects them with
// L-shaped corridors. doorPositions[i] = the single tile where the corridor
// from rooms[i-1] punches into rooms[i]'s wall ring — used below to gate
// passage behind cleared rooms.
function carveRoomsAndCorridors(rooms: Rm[]): { tiles: DTile[][]; doorPositions: DoorPos[] } {
  const tiles: DTile[][] = Array.from({ length: GRID_H }, () => Array(GRID_W).fill('void') as DTile[]);

  for (const rm of rooms) {
    for (let ry = rm.y + 1; ry < rm.y + rm.h - 1; ry++) {
      for (let rx = rm.x + 1; rx < rm.x + rm.w - 1; rx++) {
        tiles[ry][rx] = 'floor';
      }
    }
  }

  const doorPositions: DoorPos[] = new Array(rooms.length).fill(null);
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    let cx = a.cx, cy = a.cy;
    const mark = (x: number, y: number) => {
      if (y < 0 || y >= GRID_H || x < 0 || x >= GRID_W) return;
      tiles[y][x] = 'floor';
      if (!doorPositions[i] && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) {
        doorPositions[i] = { x, y };
      }
    };
    while (cx !== b.cx) { mark(cx, cy); cx += cx < b.cx ? 1 : -1; }
    while (cy !== b.cy) { mark(cx, cy); cy += cy < b.cy ? 1 : -1; }
    mark(cx, cy);
  }

  return { tiles, doorPositions };
}

// Counts floor tiles on a room's outer wall ring. A well-formed layout has
// exactly one punch per connection touching that room (1 for the first/last
// room, 2 for rooms in between) — anything else means a corridor scraped
// along/through the ring instead of punching a single clean doorway.
function ringFloorCount(tiles: DTile[][], rm: Rm): number {
  let count = 0;
  for (let x = rm.x; x < rm.x + rm.w; x++) {
    if (tiles[rm.y][x] === 'floor') count++;
    if (tiles[rm.y + rm.h - 1][x] === 'floor') count++;
  }
  for (let y = rm.y + 1; y < rm.y + rm.h - 1; y++) {
    if (tiles[y][rm.x] === 'floor') count++;
    if (tiles[y][rm.x + rm.w - 1] === 'floor') count++;
  }
  return count;
}

function isValidLayout(tiles: DTile[][], rooms: Rm[]): boolean {
  for (let i = 0; i < rooms.length; i++) {
    const expected = (i > 0 ? 1 : 0) + (i < rooms.length - 1 ? 1 : 0);
    if (ringFloorCount(tiles, rooms[i]) !== expected) return false;
  }
  return true;
}

function generateDungeonGrid(questId: string, seed: number, floor: number): DungeonGrid {
  const rng = seededRandom(seed + floor * 9973);

  const visited: boolean[][] = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(false));
  const enemies: GridEnemy[] = [];
  const chests: GridChest[] = [];

  // ── Room placement + corridor carving, retried until every room's wall ring
  //    has exactly the expected doorways (no stray holes from misaligned corridors) ─
  let rooms: Rm[] = [];
  let tiles: DTile[][] = [];
  let doorPositions: DoorPos[] = [];
  for (let layoutAttempt = 0; layoutAttempt < 40; layoutAttempt++) {
    const candidate = placeRooms(rng);
    if (candidate.length < 2) continue;
    const carved = carveRoomsAndCorridors(candidate);
    rooms = candidate;
    tiles = carved.tiles;
    doorPositions = carved.doorPositions;
    if (isValidLayout(tiles, rooms)) break;
  }

  // Guarantee a working layout (start + boss) if every randomized attempt failed
  if (rooms.length < 2) {
    rooms = [
      { x: 2, y: 2, w: 6, h: 5, cx: 5, cy: 4 },
      { x: 28, y: 18, w: 6, h: 5, cx: 31, cy: 20 },
    ];
    const carved = carveRoomsAndCorridors(rooms);
    tiles = carved.tiles;
    doorPositions = carved.doorPositions;
  }

  // ── Carve walls around floor tiles ────────────────────────────────────────
  const DIRS8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (tiles[y][x] !== 'void') continue;
      const adjFloor = DIRS8.some(([dy, dx]) => {
        const ny = y + dy, nx = x + dx;
        return ny >= 0 && ny < GRID_H && nx >= 0 && nx < GRID_W && tiles[ny][nx] === 'floor';
      });
      if (adjFloor) tiles[y][x] = 'wall';
    }
  }

  // ── Questdaten ────────────────────────────────────────────────────────────
  const questDef = QUESTS.find(q => q.id === questId)!;
  const nonBossEnemies = questDef.enemies.filter(e => !e.isBoss);
  const bossEnemyDefs  = questDef.enemies.filter(e =>  e.isBoss);
  const isBossFloor    = floor >= TOTAL_FLOORS;

  // ── Player spawn (center of first room) ───────────────────────────────────
  const startRoom = rooms[0];
  let playerX = startRoom.cx, playerY = startRoom.cy;

  // ── Exit position (in last room — on boss floor, no exit tile) ────────────
  const exitRoom = rooms[rooms.length - 1];
  let exitX = -1, exitY = -1;
  if (!isBossFloor) {
    exitX = exitRoom.cx;
    exitY = exitRoom.cy;
  }

  // ── Place enemies ─────────────────────────────────────────────────────────
  const hpMult  = 1 + 0.30 * S.prestigeCount;
  const atkMult = 1 + 0.20 * S.prestigeCount;
  let eid = 0;

  const middleRooms = rooms.slice(1, isBossFloor ? rooms.length : rooms.length - 1);
  const bossRoom    = isBossFloor ? rooms[rooms.length - 1] : null;

  // Tracks which enemy ids belong to which room (by index in `rooms`) so doors
  // can gate passage into the next room until the current one is cleared.
  const roomEnemies: string[][] = rooms.map(() => []);

  for (const rm of middleRooms) {
    const roomIndex = rooms.indexOf(rm);
    const count = 1 + Math.floor(rng() * 2);
    for (let e = 0; e < count; e++) {
      const base = nonBossEnemies[Math.floor(rng() * nonBossEnemies.length)] ?? questDef.enemies[0];
      const ex = rm.x + 1 + Math.floor(rng() * Math.max(1, rm.w - 2));
      const ey = rm.y + 1 + Math.floor(rng() * Math.max(1, rm.h - 2));
      const id = `e${eid++}`;
      enemies.push({
        id,
        x: ex, y: ey,
        def: { ...base, maxHp: Math.round(base.maxHp * hpMult), attack: Math.round(base.attack * atkMult) },
        alive: true,
        home: { x: rm.x, y: rm.y, w: rm.w, h: rm.h },
      });
      roomEnemies[roomIndex].push(id);
    }
  }

  if (bossRoom) {
    const roomIndex = rooms.indexOf(bossRoom);
    const bossBase = (bossEnemyDefs.length > 0 ? bossEnemyDefs : questDef.enemies.slice(-1))[0];
    const id = `e${eid++}`;
    enemies.push({
      id,
      x: bossRoom.cx, y: bossRoom.cy,
      def: { ...bossBase, maxHp: Math.round(bossBase.maxHp * hpMult), attack: Math.round(bossBase.attack * atkMult) },
      alive: true,
      isBoss: true,
      home: { x: bossRoom.x, y: bossRoom.y, w: bossRoom.w, h: bossRoom.h },
    });
    roomEnemies[roomIndex].push(id);
  }

  // ── Doors: lock passage into the next room until the room behind is cleared ─
  const doors: GridDoor[] = [];
  let did = 0;
  for (let i = 1; i < rooms.length; i++) {
    const guardEnemies = roomEnemies[i - 1];
    const pos = doorPositions[i];
    if (pos && guardEnemies.length > 0) {
      doors.push({ id: `door${did++}`, x: pos.x, y: pos.y, enemyIds: [...guardEnemies] });
    }
  }

  // ── Place chests (up to 2 in middle rooms, avoiding enemy positions) ───────
  let cid = 0;
  const chestRooms = [...middleRooms].sort(() => rng() - 0.5).slice(0, 2);
  for (const rm of chestRooms) {
    const cx = rm.x + Math.max(1, rm.w - 2);
    const cy = rm.y + 1;
    const taken = enemies.some(en => en.x === cx && en.y === cy) || (cx === playerX && cy === playerY);
    if (!taken && tiles[cy]?.[cx] === 'floor') {
      const baseGold = Math.floor((questDef.goldReward ?? 25) * 0.18);
      const roll = rng();
      let loot: LootDrop;
      if (roll < 0.5)      loot = { gold: baseGold + Math.floor(rng() * baseGold) };
      else if (roll < 0.8) loot = { candies: 20 + Math.floor(rng() * 30) };
      else                 loot = { runItem: RUN_ITEMS[Math.floor(rng() * RUN_ITEMS.length)].id };
      chests.push({ id: `c${cid++}`, x: cx, y: cy, loot, opened: false });
    }
  }

  // ── Reveal start room ─────────────────────────────────────────────────────
  revealRadius(visited, playerX, playerY, 6);

  return { width: GRID_W, height: GRID_H, tiles, enemies, chests, doors, exitX, exitY, playerX, playerY, visited, floor, totalFloors: TOTAL_FLOORS };
}

export function isDoorLocked(grid: DungeonGrid, door: GridDoor): boolean {
  return door.enemyIds.some(id => grid.enemies.find(e => e.id === id)?.alive);
}

export function revealRadius(visited: boolean[][], px: number, py: number, radius = 6): void {
  const h = visited.length, w = visited[0]?.length ?? 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = px + dx, ny = py + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) visited[ny][nx] = true;
    }
  }
}

function generateShopOffers(rng: () => number, questId: string): import('./types').DungeonShopOffer[] {
  const questDef = QUESTS.find(q => q.id === questId)!;
  const healCost = Math.round(questDef.goldReward * 0.12);
  const offers: import('./types').DungeonShopOffer[] = [{ type: 'heal', cost: healCost }];
  const shuffled = [...RUN_ITEMS].sort(() => rng() - 0.5);
  const itemCost = Math.round(questDef.goldReward * 0.15);
  for (let i = 0; i < 2 && i < shuffled.length; i++) {
    offers.push({ type: 'runItem', runItemId: shuffled[i].id, cost: itemCost });
  }
  return offers;
}

export function startDungeon(questId: string): string | null {
  if (S.activeQuest?.phase === 'fighting') return 'Du bist noch im Kampf!';
  if (S.dungeon) return 'Du bist bereits in einem Dungeon!';
  if (S.hp < Math.ceil(S.maxHp * 0.25)) return 'Du bist zu schwer verwundet (HP < 25%)';

  const def = QUESTS.find(q => q.id === questId);
  if (!def) return 'Unbekannte Quest';
  if (def.requiredItem && !S.inventory.includes(def.requiredItem)) return `Benötigt: ${def.requiredItem}`;
  if (questId !== 'forest' && !S.unlocked.includes(questId)) return 'Quest noch nicht freigeschaltet';

  S.activeQuest = null;
  const seed = Math.floor(Date.now() / 1000);
  const shopRng = seededRandom(seed + 1);
  const shopOffers = generateShopOffers(shopRng, questId);

  S.dungeon = {
    questId,
    seed,
    grid: generateDungeonGrid(questId, seed, 1),
    currentEnemyId: null,
    phase: 'exploring',
    runItems: [],
    runGold: 0,
    pendingLoot: null,
    shopOffers,
    fairyShieldActive: false,
    secondWindAvailable: false,
  };

  saveState();
  return null;
}

export function fightGridEnemy(enemyId: string): void {
  const d = S.dungeon;
  if (!d?.grid) return;
  const enemy = d.grid.enemies.find(e => e.id === enemyId);
  if (!enemy || !enemy.alive) return;

  d.currentEnemyId = enemyId;

  const scaledEnemy = {
    name:    enemy.def.name,
    emoji:   enemy.def.emoji,
    hp:      enemy.def.maxHp,
    maxHp:   enemy.def.maxHp,
    attack:  enemy.def.attack,
    isBoss:  enemy.isBoss,
    specialMove: enemy.def.specialMove,
    poisonChance: enemy.def.poisonChance,
  };

  const roomType = enemy.isBoss ? 'boss' : 'monster';
  S.activeQuest = {
    questId: d.questId,
    enemies: [scaledEnemy],
    enemyIndex: 0,
    playerHp: S.hp,
    log: [
      enemy.isBoss ? `💀 Boss-Kampf!` : `⚔️ Gegner-Raum!`,
      `👊 ${scaledEnemy.emoji} ${scaledEnemy.name} (${scaledEnemy.maxHp} HP)`,
      ...(scaledEnemy.specialMove ? [`⚡ Fähigkeit: ${scaledEnemy.specialMove.name} (alle ${scaledEnemy.specialMove.cooldown} Runden)`] : []),
    ],
    phase: 'fighting',
    fightTick: 0,
    roundCount: 0,
    playerStunned: false,
    powerStrikeQueued: false,
    blockQueued: false,
    blockCooldown: 0,
    poisonRounds: 0,
    attackBuff: 0,
    defenseBuff: 0,
    dungeonRoomType: roomType,
  };
  d.phase = 'fighting';
  saveState();
}

export function openGridChest(chestId: string): void {
  const d = S.dungeon;
  if (!d?.grid) return;
  const chest = d.grid.chests.find(c => c.id === chestId);
  if (!chest || chest.opened) return;

  chest.opened = true;
  let loot = { ...chest.loot };
  if (loot.gold && d.runItems.includes('greedy_chest')) {
    loot = { ...loot, gold: Math.round(loot.gold * 1.5) };
  }
  d.pendingLoot = loot;
  d.phase = 'loot';
  saveState();
}

export function goToNextFloor(): void {
  const d = S.dungeon;
  if (!d?.grid) return;
  const nextFloor = d.grid.floor + 1;
  d.grid = generateDungeonGrid(d.questId, d.seed + nextFloor * 7, nextFloor);
  d.currentEnemyId = null;
  d.phase = 'exploring';
  saveState();
}

function handleDungeonRoomVictory(): void {
  const d = S.dungeon;
  if (!d?.grid || !S.activeQuest) return;

  const enemy = d.grid.enemies.find(e => e.id === d.currentEnemyId);
  if (enemy) enemy.alive = false;
  d.currentEnemyId = null;

  if (enemy?.isBoss) {
    d.phase = 'victory';
    // S.activeQuest stays so battle section shows the victory screen
  } else {
    d.phase = 'exploring';
    S.activeQuest = null;
  }
}

export function returnToDungeonMap(): void {
  const d = S.dungeon;
  if (!d) return;
  // Called from "Zur Dungeon-Karte" after boss victory
  S.activeQuest = null;
  saveState();
}

export function collectDungeonLoot(): void {
  const d = S.dungeon;
  if (!d || d.phase !== 'loot' || !d.pendingLoot) return;

  const loot = d.pendingLoot;
  if (loot.gold)    { d.runGold += loot.gold; S.gold += loot.gold; S.stats.goldEarned += loot.gold; }
  if (loot.candies) { S.candies += loot.candies; }
  if (loot.runItem) {
    applyRunItem(d, loot.runItem);
  }

  d.pendingLoot = null;
  d.phase = 'exploring';
  saveState();
}

function applyRunItem(d: DungeonRun, itemId: string): void {
  if (!d.runItems.includes(itemId)) d.runItems.push(itemId);
  if (itemId === 'fairy_shield') d.fairyShieldActive = true;
  if (itemId === 'second_wind')  d.secondWindAvailable = true;
  if (itemId === 'life_potion') {
    S.hp = Math.min(S.maxHp, S.hp + 20);
    if (S.activeQuest) S.activeQuest.playerHp = S.hp;
    d.runItems = d.runItems.filter(i => i !== 'life_potion'); // consume immediately
  }
}

export function dungeonHealRoom(): void {
  const d = S.dungeon;
  if (!d || d.phase !== 'heal_room') return;
  const heal = Math.round(S.maxHp * 0.40);
  S.hp = Math.min(S.maxHp, S.hp + heal);
  d.phase = 'exploring';
  saveState();
}

export function dungeonShopBuy(offerIndex: number): string | null {
  const d = S.dungeon;
  if (!d || d.phase !== 'shop') return 'Kein aktiver Shop';
  const offer = d.shopOffers[offerIndex];
  if (!offer) return 'Ungültiges Angebot';
  if (S.gold < offer.cost) return `Nicht genug Gold (${offer.cost} 🪙 benötigt)`;

  S.gold -= offer.cost;
  if (offer.type === 'heal') {
    const heal = Math.round(S.maxHp * 0.50);
    S.hp = Math.min(S.maxHp, S.hp + heal);
  } else if (offer.type === 'runItem' && offer.runItemId) {
    applyRunItem(d, offer.runItemId);
  }
  // Remove offer
  d.shopOffers.splice(offerIndex, 1);
  saveState();
  return null;
}

export function dungeonShopLeave(): void {
  const d = S.dungeon;
  if (!d || d.phase !== 'shop') return;
  d.phase = 'exploring';
  saveState();
}

export function useDungeonRunItem(itemId: string): string | null {
  const d = S.dungeon;
  if (!d) return 'Kein aktiver Dungeon';
  const idx = d.runItems.indexOf(itemId);
  if (idx === -1) return 'Item nicht vorhanden';

  const def = RUN_ITEMS.find(r => r.id === itemId);
  if (!def || def.type !== 'active') return 'Nicht ein aktives Item';

  if (def.useInCombat && (!S.activeQuest || S.activeQuest.phase !== 'fighting')) {
    return 'Nur im Kampf verwendbar';
  }

  if (itemId === 'life_potion') {
    S.hp = Math.min(S.maxHp, S.hp + 20);
    if (S.activeQuest) S.activeQuest.playerHp = S.hp;
  } else if (itemId === 'sugar_bomb' && S.activeQuest) {
    const enemy = S.activeQuest.enemies[S.activeQuest.enemyIndex];
    if (enemy) {
      enemy.hp = Math.max(0, enemy.hp - 20);
      S.activeQuest.log.push(`💣 Zuckerbombe! 20 Schaden an ${enemy.emoji} ${enemy.name}!`);
    }
  } else if (itemId === 'poison_candy' && S.activeQuest) {
    S.activeQuest.poisonRounds = 6;
    S.activeQuest.enemyPoisonRounds = 6;
    S.activeQuest.log.push(`☠️ Vergiftetes Bonbon! Gegner vergiftet für 6 Runden.`);
  }

  d.runItems.splice(idx, 1);
  saveState();
  return null;
}

export function closeDungeon(): void {
  const d = S.dungeon;
  if (!d) return;
  if (d.phase === 'fighting') return;
  S.dungeon = null;
  S.activeQuest = null;
  saveState();
}

export function eatCandies(): boolean {
  if (S.candies < EAT_COST || S.hp >= S.maxHp || S.eatCooldown > 0) return false;
  const heal = getEatHeal();
  S.candies -= EAT_COST;
  S.hp = Math.min(S.maxHp, S.hp + heal);
  if (S.activeQuest) S.activeQuest.playerHp = S.hp;
  S.stats.candiesEaten += EAT_COST;
  S.eatCooldown = EAT_COOLDOWN;
  checkUnlocks();
  saveState();
  return true;
}

export function throwCandies(count: number = 1): boolean {
  const cost = THROW_COST * count;
  if (S.candies < cost) return false;
  S.candies -= cost;
  S.stats.candiesThrown += cost;
  S.lollipopQueue += count;
  if (S.lollipopCooldown === 0) S.lollipopCooldown = lollipopCooldownDuration();
  checkUnlocks();
  saveState();
  return true;
}

export function buyItem(itemId: string): string | null {
  const item = ITEMS.find(i => i.id === itemId);
  if (!item) return 'Unbekanntes Item';
  if (S.inventory.includes(itemId) && !item.repeatable) return 'Bereits gekauft';
  if (item.requiresItem && !S.inventory.includes(item.requiresItem)) {
    const req = ITEMS.find(i => i.id === item.requiresItem);
    return `Benötigt: ${req?.emoji ?? ''} ${req?.name ?? item.requiresItem}`;
  }
  const _buyMult = getPrestigeCostMult();
  const _buyCandies = item.costCandies ? Math.round(item.costCandies * _buyMult) : 0;
  const _buyGold    = item.costGold    ? Math.round(item.costGold    * _buyMult) : 0;
  if (_buyCandies && S.candies < _buyCandies)
    return `Nicht genug Bonbons (${_buyCandies} 🍬 benötigt)`;
  if (_buyGold && S.gold < _buyGold)
    return `Nicht genug Gold (${_buyGold} 🪙 benötigt)`;

  if (_buyCandies) S.candies -= _buyCandies;
  if (_buyGold)    S.gold    -= _buyGold;
  if (!S.inventory.includes(itemId)) S.inventory.push(itemId);

  if (itemId === 'hat')          { S.maxHp += 10; S.hp = Math.min(S.hp + 10, S.maxHp); }
  if (itemId === 'potion')       { S.hp = S.maxHp; }
  if (itemId === 'shield')       { S.defense += 2; }
  if (itemId === 'iron_shield')  { S.defense += 3; }
  if (itemId === 'hero_medal')   { S.maxHp += 15; S.hp = Math.min(S.hp + 15, S.maxHp); }
  if (itemId === 'dragon_scale') { S.defense += 4; }
  if (itemId === 'ice_crown')    { S.maxHp += 25; S.hp = Math.min(S.hp + 25, S.maxHp); }

  checkUnlocks();
  saveState();
  return null;
}

export function buyUpgrade(upgradeId: string): string | null {
  const upg = UPGRADES.find(u => u.id === upgradeId);
  if (!upg) return 'Unbekanntes Upgrade';
  if (S.upgrades.includes(upgradeId)) return 'Bereits aktiv';
  if (upg.requires && !S.upgrades.includes(upg.requires))
    return `Benötigt: ${UPGRADES.find(u => u.id === upg.requires)?.name}`;
  const _upgMult = getPrestigeCostMult();
  const _upgCandies = upg.costCandies ? Math.round(upg.costCandies * _upgMult) : 0;
  const _upgGold    = upg.costGold    ? Math.round(upg.costGold    * _upgMult) : 0;
  if (_upgCandies && S.candies < _upgCandies)
    return `Nicht genug Bonbons (${_upgCandies} 🍬 benötigt)`;
  if (_upgGold && S.gold < _upgGold)
    return `Nicht genug Gold (${_upgGold} 🪙 benötigt)`;

  if (_upgCandies) S.candies -= _upgCandies;
  if (_upgGold)    S.gold    -= _upgGold;
  S.upgrades.push(upgradeId);
  S.candyPerSec += upg.candyBonus;

  saveState();
  return null;
}

export function sellLollipops(): string | null {
  if (S.lollipops < SELL_LOLLIPOP_COUNT)
    return `Benötigt ${SELL_LOLLIPOP_COUNT} Lutscher`;
  S.lollipops -= SELL_LOLLIPOP_COUNT;
  const earned = Math.round(SELL_LOLLIPOP_GOLD * getPrestigeCostMult());
  S.gold += earned;
  S.stats.lollipopsSold += SELL_LOLLIPOP_COUNT;
  S.stats.goldEarned += earned;
  saveState();
  return null;
}

export function sellAllLollipops(): number {
  const batches = Math.floor(S.lollipops / SELL_LOLLIPOP_COUNT);
  if (batches === 0) return 0;
  S.lollipops -= batches * SELL_LOLLIPOP_COUNT;
  const earnedPerBatch = Math.round(SELL_LOLLIPOP_GOLD * getPrestigeCostMult());
  const earned = batches * earnedPerBatch;
  S.gold += earned;
  S.stats.lollipopsSold += batches * SELL_LOLLIPOP_COUNT;
  S.stats.goldEarned += earned;
  saveState();
  return earned;
}

export function toggleAutoHeal(): void {
  S.autoHeal = !S.autoHeal;
  saveState();
}

export function toggleFightSpeed(): void {
  S.fightSpeed = S.fightSpeed === 1 ? 2 : 1;
  saveState();
}

export function toggleDungeonAutopilot(): void {
  if ((S.prestigeUpgrades['autopilot'] ?? 0) <= 0) return;
  S.dungeonAutopilot = !S.dungeonAutopilot;
  saveState();
}

export function startQuest(questId: string): string | null {
  if (S.activeQuest?.phase === 'fighting') return 'Du bist noch im Kampf!';
  S.activeQuest = null; // beendet Quest-Ergebnis-Ansicht automatisch
  if (S.hp < Math.ceil(S.maxHp * 0.25)) return 'Du bist zu schwer verwundet (HP < 25%)';

  const def = QUESTS.find(q => q.id === questId);
  if (!def) return 'Unbekannte Quest';
  if (def.requiredItem && !S.inventory.includes(def.requiredItem))
    return `Benötigt: ${def.requiredItem}`;
  if (questId !== 'forest' && !S.unlocked.includes(questId))
    return 'Quest noch nicht freigeschaltet';

  const hpMult   = 1 + 0.30 * S.prestigeCount;
  const atkMult  = 1 + 0.20 * S.prestigeCount;
  const firstEnemy = def.enemies[0];
  S.activeQuest = {
    questId,
    enemies: def.enemies.map(e => ({
      ...e,
      hp:     Math.round(e.maxHp  * hpMult),
      maxHp:  Math.round(e.maxHp  * hpMult),
      attack: Math.round(e.attack * atkMult),
    })),
    enemyIndex: 0,
    playerHp: S.hp,
    log: [
      `🌟 Quest gestartet: ${def.name}`,
      `👊 Erster Gegner: ${firstEnemy.emoji} ${firstEnemy.name} (${firstEnemy.maxHp} HP)`,
      ...(firstEnemy.specialMove ? [`⚡ Fähigkeit: ${firstEnemy.specialMove.name} (alle ${firstEnemy.specialMove.cooldown} Runden)`] : []),
    ],
    phase: 'fighting',
    fightTick: 0,
    roundCount: 0,
    playerStunned: false,
    powerStrikeQueued: false,
    blockQueued: false,
    blockCooldown: 0,
    poisonRounds: 0,
    attackBuff: 0,
    defenseBuff: 0,
  };

  saveState();
  return null;
}

const STRENGTH_TRANK_COST = 20;
const IRON_TRANK_COST     = 15;

export function useTrank(type: 'strength' | 'iron'): string | null {
  if (!S.activeQuest || S.activeQuest.phase !== 'fighting') return 'Kein aktiver Kampf';
  const q = S.activeQuest;
  if (type === 'strength') {
    if (!S.inventory.includes('strength_potion')) return 'Krafttrank nicht im Inventar';
    if (S.candies < STRENGTH_TRANK_COST) return `Nicht genug Bonbons (${STRENGTH_TRANK_COST} benötigt)`;
    S.candies -= STRENGTH_TRANK_COST;
    q.attackBuff = 3;
    q.log.push(`💪 Krafttrank! +8 Angriff für 3 Runden.`);
  } else {
    if (!S.inventory.includes('iron_potion')) return 'Eisentrank nicht im Inventar';
    if (S.candies < IRON_TRANK_COST) return `Nicht genug Bonbons (${IRON_TRANK_COST} benötigt)`;
    S.candies -= IRON_TRANK_COST;
    q.defenseBuff = 3;
    q.log.push(`⚙️ Eisentrank! +4 Verteidigung für 3 Runden.`);
  }
  saveState();
  return null;
}

export function parry(): string | null {
  if (!S.activeQuest || S.activeQuest.phase !== 'fighting') return 'Kein aktiver Kampf';
  if (S.activeQuest.blockQueued) return 'Parieren bereits aktiv!';
  if (S.activeQuest.blockCooldown > 0) return `Parieren bereit in ${S.activeQuest.blockCooldown} Runden`;
  S.activeQuest.blockQueued = true;
  S.activeQuest.blockCooldown = BLOCK_COOLDOWN;
  saveState();
  return null;
}

export function powerStrike(): string | null {
  if (!S.activeQuest || S.activeQuest.phase !== 'fighting') return 'Kein aktiver Kampf';
  if (S.activeQuest.powerStrikeQueued) return 'Kraftstoß bereits aufgeladen!';
  if (S.candies < POWER_STRIKE_COST) return `Nicht genug Bonbons (${POWER_STRIKE_COST} 🍬 benötigt)`;
  S.candies -= POWER_STRIKE_COST;
  S.activeQuest.powerStrikeQueued = true;
  saveState();
  return null;
}

export function closeQuest(): void {
  if (!S.activeQuest || S.activeQuest.phase === 'fighting') return;
  S.activeQuest = null;
  saveState();
}

export function craft(recipeId: string): string | null {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return 'Unbekanntes Rezept';
  if (S.forgedItems.includes(recipeId)) return 'Bereits hergestellt';
  if (recipe.requiresForged && !S.forgedItems.includes(recipe.requiresForged)) {
    const base = RECIPES.find(r => r.id === recipe.requiresForged);
    return `Benötigt zuerst: ${base?.name ?? recipe.requiresForged}`;
  }

  for (const [matId, count] of Object.entries(recipe.materials)) {
    if ((S.materials[matId] ?? 0) < count) {
      const mat = MATERIALS[matId];
      return `Nicht genug ${mat?.emoji ?? ''} ${mat?.name ?? matId}`;
    }
  }
  if (recipe.costGold && S.gold < recipe.costGold)
    return `Nicht genug Gold (${recipe.costGold} 🪙 benötigt)`;

  for (const [matId, count] of Object.entries(recipe.materials)) {
    S.materials[matId] -= count;
  }
  if (recipe.costGold) S.gold -= recipe.costGold;

  S.forgedItems.push(recipeId);

  if (recipe.result.maxHp)   { S.maxHp += recipe.result.maxHp; S.hp = Math.min(S.hp + recipe.result.maxHp, S.maxHp); }
  if (recipe.result.defense) { S.defense += recipe.result.defense; }
  if (recipe.result.candyBonus) { S.candyPerSec += recipe.result.candyBonus; }
  // attackBonus: wirkt über S.forgedItems.includes() in calcPlayerAttack()

  checkUnlocks();
  saveState();
  return null;
}

export function combine(comboId: string): string | null {
  const combo = COMBOS.find(c => c.id === comboId);
  if (!combo) return 'Unbekannte Kombination';

  for (const [matId, count] of Object.entries(combo.materials)) {
    if ((S.materials[matId] ?? 0) < count) {
      const mat = MATERIALS[matId];
      return `Nicht genug ${mat?.emoji ?? ''} ${mat?.name ?? matId}`;
    }
  }

  for (const [matId, count] of Object.entries(combo.materials)) {
    S.materials[matId] -= count;
  }
  S.materials[combo.resultMaterial] = (S.materials[combo.resultMaterial] ?? 0) + 1;

  saveState();
  return null;
}
