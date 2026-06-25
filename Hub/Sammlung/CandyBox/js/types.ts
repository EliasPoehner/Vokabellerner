export interface Item {
  id: string;
  name: string;
  emoji: string;
  description: string;
  costCandies?: number;
  costGold?: number;
  repeatable?: boolean;
  unlock?: string;      // S.unlocked entry required to show this item in the shop
  requiresItem?: string; // other item id that must be in inventory first
}

export interface UpgradeDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  costCandies?: number;
  costGold?: number;
  candyBonus: number;
  requires?: string;
  unlock?: string; // S.unlocked entry required to show this upgrade
}

export interface EnemySpecialMove {
  name: string;
  damage: number;
  pierceDefense?: boolean;
  stunPlayer?: boolean;
  canPoison?: boolean;
  cooldown: number; // fires every N combat rounds (per enemy, resets on enemy switch)
}

export interface EnemyDef {
  name: string;
  emoji: string;
  maxHp: number;
  attack: number;
  isBoss?: boolean;
  specialMove?: EnemySpecialMove;
  poisonChance?: number; // 0-1 chance to poison on normal attack
}

export interface QuestDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  requiredItem?: string;
  enemies: EnemyDef[];
  goldReward: number;
  unlock?: string;
}

export interface EventChoice {
  label: string;
  secondary?: boolean;
}

export interface EventDef {
  id: string;
  emoji: string;
  title: string;
  text: string;
  choices: EventChoice[];
}

export interface ActiveEnemy {
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  attack: number;
  isBoss?: boolean;
  specialMove?: EnemySpecialMove;
  poisonChance?: number;
}

export interface QuestRun {
  questId: string;
  enemies: ActiveEnemy[];
  enemyIndex: number;
  playerHp: number;
  log: string[];
  phase: 'fighting' | 'victory' | 'defeat';
  fightTick: number;
  roundCount: number;         // combat rounds vs. current enemy (resets on enemy switch)
  playerStunned: boolean;     // player skips attack this round
  powerStrikeQueued: boolean; // next player attack deals 2x damage
  blockQueued: boolean;       // next enemy attack is blocked (0 damage)
  blockCooldown: number;      // rounds until parry can be used again
  poisonRounds: number;       // remaining rounds of poison ticking
  attackBuff: number;         // rounds of +8 ATK from Krafttrank
  defenseBuff: number;        // rounds of +4 DEF from Eisentrank
  enemyPoisonRounds?: number; // rounds of poison_candy on enemy
  dungeonRoomType?: 'monster' | 'elite' | 'boss';
}

export interface RecipeDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  materials: Record<string, number>;
  costGold?: number;
  result: {
    maxHp?: number;
    defense?: number;
    attackBonus?: number;
    candyBonus?: number;
  };
  unlock?: string;         // completedQuests entry required to show this recipe
  requiresForged?: string; // another recipe id that must be forged first (upgrade recipes)
}

export interface ComboDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  materials: Record<string, number>; // input materials consumed
  resultMaterial: string;            // output material id added to S.materials
  unlock?: string; // completedQuests entry required to show this combo
}

export interface RunItemDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  type: 'passive' | 'active';
  subtype?: 'permanent' | 'auto-1x';
  useInCombat?: boolean;
}

export interface LootDrop {
  gold?: number;
  candies?: number;
  runItem?: string;
}

export type DungeonTile = 'void' | 'floor' | 'wall';

export interface GridEnemy {
  id: string;
  x: number; y: number;
  def: EnemyDef;
  alive: boolean;
  isBoss?: boolean;
  home?: { x: number; y: number; w: number; h: number }; // room bounds the enemy wanders within
}

export interface GridChest {
  id: string;
  x: number; y: number;
  loot: LootDrop;
  opened: boolean;
}

export interface GridDoor {
  id: string;
  x: number; y: number;
  enemyIds: string[]; // door is locked while any of these enemies is still alive
}

export interface DungeonGrid {
  width: number; height: number;
  tiles: DungeonTile[][];   // [y][x]
  enemies: GridEnemy[];
  chests: GridChest[];
  doors: GridDoor[];
  exitX: number; exitY: number;
  playerX: number; playerY: number;
  visited: boolean[][];     // fog of war [y][x]
  floor: number;
  totalFloors: number;
}

export interface DungeonRoom {
  type: 'monster' | 'elite' | 'chest' | 'heal' | 'shop' | 'boss';
  cleared: boolean;
  accessible: boolean;
  enemies?: EnemyDef[];
  loot?: LootDrop;
}

export interface DungeonRow {
  rooms: DungeonRoom[];
  connections: number[][];
}

export interface DungeonShopOffer {
  type: 'runItem' | 'heal';
  runItemId?: string;
  cost: number;
}

export interface DungeonRun {
  questId: string;
  seed: number;
  grid: DungeonGrid | null;
  currentEnemyId: string | null;
  phase: 'exploring' | 'fighting' | 'loot' | 'shop' | 'heal_room' | 'victory' | 'defeat';
  runItems: string[];
  runGold: number;
  pendingLoot: LootDrop | null;
  shopOffers: DungeonShopOffer[];
  fairyShieldActive: boolean;
  secondWindAvailable: boolean;
  // Legacy fields kept for save-file backward compat (not used in new code)
  map?: DungeonRow[];
  currentRow?: number;
  currentCol?: number;
}

export interface GameState {
  candies: number;
  candyPerSec: number;
  lollipops: number;
  lollipopQueue: number;
  lollipopCooldown: number;
  gold: number;
  hp: number;
  maxHp: number;
  defense: number;
  inventory: string[];
  upgrades: string[];
  unlocked: string[];
  activeQuest: QuestRun | null;
  dungeon: DungeonRun | null;
  activeEvent: string | null;
  eventCooldown: number;
  completedQuests: string[];
  eatCooldown: number;
  prestigeCount: number;
  prestigePoints: number;
  prestigeUpgrades: Record<string, number>;
  prestigeCandyMult: number;
  materials: Record<string, number>;
  forgedItems: string[];
  autoHeal: boolean;
  fightSpeed: 1 | 2;
  dungeonAutopilot: boolean;
  lastSaved: number;
  stats: {
    candiesEaten: number;
    candiesThrown: number;
    questsWon: number;
    lollipopsSold: number;
    totalCandiesProduced: number;
    goldEarned: number;
  };
}
