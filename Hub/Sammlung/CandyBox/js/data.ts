import type { Item, UpgradeDef, QuestDef, EventDef, RecipeDef, ComboDef, RunItemDef } from './types';

export const ITEMS: Item[] = [
  // ── Basis-Ausrüstung (Shop-Start) ──────────────────────────────────────────
  {
    id: 'sword',
    name: 'Holzschwert',
    emoji: '🗡️',
    description: 'Ein einfaches Schwert. Schaltet Quests frei. +5 Angriff.',
    costCandies: 50,
  },
  {
    id: 'lucky_clover',
    name: 'Glückskleeblatt',
    emoji: '🍀',
    description: 'Verbessert deine Chancen bei Zufalls-Ereignissen deutlich.',
    costGold: 50,
    unlock: 'shop',
  },
  {
    id: 'offline_book',
    name: 'Tagebuch',
    emoji: '📓',
    description: 'Bonbons wachsen auch offline weiter — bis zu 1 Stunde.',
    costGold: 80,
    unlock: 'shop',
  },

  // ── Lutscherfeld (nach erstem Lutscher) ────────────────────────────────────
  {
    id: 'throw_training',
    name: 'Wurftraining',
    emoji: '🎯',
    description: 'Ermöglicht, 5 Lutscher auf einmal zu werfen.',
    costCandies: 200,
    unlock: 'lollipopField',
  },
  {
    id: 'market_stall',
    name: 'Marktstand',
    emoji: '🏪',
    description: 'Verkaufe alle Lutscher auf einmal statt immer 5er-Pakete.',
    costGold: 35,
    unlock: 'lollipopField',
  },
  {
    id: 'growth_fert',
    name: 'Wachstumsdünger',
    emoji: '🌱',
    description: 'Lutscher wachsen doppelt so schnell (8s statt 15s).',
    costCandies: 350,
    unlock: 'lollipopField',
  },

  // ── Kampftränke (nach Schwert-Kauf) ───────────────────────────────────────
  {
    id: 'strength_potion',
    name: 'Krafttrank',
    emoji: '💪',
    description: 'Im Kampf: −20 🍬 → +8 Angriff für 3 Runden. Bleibt dauerhaft im Besitz.',
    costGold: 30,
    unlock: 'quests',
  },
  {
    id: 'iron_potion',
    name: 'Eisentrank',
    emoji: '⚙️',
    description: 'Im Kampf: −15 🍬 → +4 Verteidigung für 3 Runden. Bleibt dauerhaft im Besitz.',
    costGold: 40,
    unlock: 'cave',
  },

  // ── Quests (nach Schwert-Kauf) ─────────────────────────────────────────────
  {
    id: 'hat',
    name: 'Lederhut',
    emoji: '🪖',
    description: 'Ein robuster Hut. +10 max. HP.',
    costCandies: 100,
    unlock: 'quests',
  },
  {
    id: 'shield',
    name: 'Holzschild',
    emoji: '🛡️',
    description: 'Schützt vor Angriffen. −2 Schaden pro Kampfrunde.',
    costGold: 80,
    unlock: 'quests',
  },
  {
    id: 'potion',
    name: 'Bonbon-Trank',
    emoji: '🧪',
    description: 'Heilt dich vollständig. Mehrfach kaufbar.',
    costGold: 15,
    repeatable: true,
    unlock: 'quests',
  },

  // ── Nach Wald-Quest (cave freigeschaltet) ──────────────────────────────────
  {
    id: 'heal_herbs',
    name: 'Heilkräuter',
    emoji: '🌿',
    description: 'Jeder Bonbon-Happen heilt 10 statt 5 HP.',
    costGold: 90,
    unlock: 'cave',
  },
  {
    id: 'autoheal_kit',
    name: 'Erste-Hilfe-Beutel',
    emoji: '🧳',
    description: 'Heilt automatisch wenn du unter 50 % HP fällst.',
    costGold: 160,
    unlock: 'cave',
  },

  // ── Nach Höhlen-Quest (tower freigeschaltet) ───────────────────────────────
  {
    id: 'steel_blade',
    name: 'Stahlklinge',
    emoji: '⚔️',
    description: 'Wertvolleres Metall. +8 Angriff (erfordert Holzschwert).',
    costGold: 220,
    unlock: 'tower',
    requiresItem: 'sword',
  },
  {
    id: 'iron_shield',
    name: 'Eisenschild',
    emoji: '🛡️',
    description: 'Massives Eisen. −3 weiterer Schaden (erfordert Holzschild).',
    costGold: 200,
    unlock: 'tower',
    requiresItem: 'shield',
  },
  {
    id: 'travel_pack',
    name: 'Reiserucksack',
    emoji: '🎒',
    description: 'Offline-Zeit auf 4 Stunden erhöht (erfordert Tagebuch).',
    costGold: 200,
    unlock: 'tower',
    requiresItem: 'offline_book',
  },

  // ── Nach Turm-Quest (castle freigeschaltet) ────────────────────────────────
  {
    id: 'battle_drum',
    name: 'Kriegstrommel',
    emoji: '🥁',
    description: 'Verdoppelt die Kampfgeschwindigkeit (umschaltbar).',
    costGold: 300,
    unlock: 'castle',
  },
  {
    id: 'hero_medal',
    name: 'Heldenmedaille',
    emoji: '🏅',
    description: '+15 max. HP und +5 Angriff. Belohnung für Tapferkeit.',
    costGold: 350,
    unlock: 'castle',
  },

  // ── Nach Vulkan-Quest ──────────────────────────────────────────────────────
  {
    id: 'dragon_scale',
    name: 'Drachenschuppe',
    emoji: '🐉',
    description: 'Legendäre Rüstungsplatte. +4 Verteidigung (erfordert Eisenschild).',
    costGold: 420,
    unlock: 'ice_palace',
    requiresItem: 'iron_shield',
  },

  // ── Nach Eispalast-Quest ───────────────────────────────────────────────────
  {
    id: 'ice_crown',
    name: 'Eiskrone',
    emoji: '👑',
    description: 'Krone aus ewigem Eis. +25 max. HP.',
    costGold: 580,
    unlock: 'candy_realm',
  },

  // ── Schmiede-Blaupause (nach Höhle, Tor zur Schmiede) ─────────────────────
  {
    id: 'forge_blueprint',
    name: 'Schmiede-Blaupause',
    emoji: '⚒️',
    description: 'Errichtet eine Schmiede. Bosse hinterlassen selten Materialien — kombiniere sie zu mächtigen Items.',
    costGold: 150,
    unlock: 'materials_found',
  },
];

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'farm',
    name: 'Bonbon-Farm',
    emoji: '🌾',
    description: 'Eine kleine Farm erzeugt automatisch Bonbons.',
    costCandies: 200,
    candyBonus: 1,
    unlock: 'upg_farm',
  },
  {
    id: 'factory',
    name: 'Zuckerfabrik',
    emoji: '🏭',
    description: 'Eine Fabrik produziert Bonbons en masse.',
    costCandies: 500,
    costGold: 20,
    candyBonus: 3,
    requires: 'farm',
    unlock: 'upg_factory',
  },
  {
    id: 'accelerator',
    name: 'Bonbon-Beschleuniger',
    emoji: '🚀',
    description: 'Hochmoderne Maschinen erhöhen die Produktion massiv. Erfordert Fabrik + Waldabenteuer.',
    costCandies: 600,
    costGold: 40,
    candyBonus: 5,
    requires: 'factory',
    unlock: 'upg_accelerator',
  },
  {
    id: 'candy_empire',
    name: 'Bonbon-Imperium',
    emoji: '🏰',
    description: 'Du beherrschst den gesamten Bonbon-Markt. Erfordert Beschleuniger + Höhlenexpedition.',
    costCandies: 1200,
    costGold: 120,
    candyBonus: 10,
    requires: 'accelerator',
    unlock: 'upg_empire',
  },
];

export const EVENTS: EventDef[] = [
  {
    id: 'merchant',
    emoji: '🧑‍🤝‍🧑',
    title: 'Reisender Händler',
    text: 'Ein Händler hält an und bietet dir 3 Lutscher für 20 Gold an.',
    choices: [
      { label: '💰 Kaufen (−20 🪙)' },
      { label: '👋 Ablehnen', secondary: true },
    ],
  },
  {
    id: 'thief',
    emoji: '🦝',
    title: 'Diebstahl!',
    text: 'Ein frecher Waschbär hat 30 Bonbons gestohlen! Er läuft gerade noch weg.',
    choices: [
      { label: '🏃 Verfolgen' },
      { label: '😔 Laufen lassen', secondary: true },
    ],
  },
  {
    id: 'fairy',
    emoji: '🧚',
    title: 'Zuckerfee',
    text: 'Eine Zuckerfee tanzt um dich herum und streut leuchtenden Bonbon-Staub!',
    choices: [
      { label: '✨ Danke schön!' },
    ],
  },
];

export const PRESTIGE_UPGRADES: Array<{ id: string; name: string; emoji: string; description: string; cost: number; maxLevel?: number }> = [
  { id: 'iron_skin',     name: 'Eisenhaut',  emoji: '🛡️', description: '+15 max HP dauerhaft pro Kauf', cost: 1 },
  { id: 'battle_spirit', name: 'Kampfgeist', emoji: '⚔️', description: '+3 Basisangriff dauerhaft pro Kauf', cost: 1 },
  { id: 'guardian',      name: 'Wächter',    emoji: '🗿',  description: '+2 Rüstung dauerhaft pro Kauf', cost: 1 },
  { id: 'sugar_blood',   name: 'Zuckerblut', emoji: '🩸', description: '+3 HP pro Essen dauerhaft pro Kauf', cost: 1 },
  { id: 'autopilot',     name: 'Auto-Pilot', emoji: '🧭', description: 'Dungeon-Bewegung läuft automatisch zum nächsten Ziel — Kämpfe bleiben wie gewohnt manuell.', cost: 3, maxLevel: 1 },
];

// ── Schmiede-System ────────────────────────────────────────────────────────

export const BOSS_DROPS: Record<string, string> = {
  forest:          'waldgeist_staub',
  cave:            'kristall_kern',
  tower:           'turm_siegel',
  castle:          'bonbon_krone',
  volcano:         'vulkan_stein',
  ice_palace:      'eis_splitter',
  candy_realm:     'goetter_essenz',
  swamp:           'hexen_trank',
  bandit_camp:     'raeuber_muenze',
  witch_tower:     'hexen_essenz',
  bandit_fortress: 'festungs_erz',
  crypt:           'grab_scherbe',
  dungeon_keep:    'kerker_kette',
  dragon_nest:     'drachen_seele',
  tundra:          'tundra_kristall',
};

export const BOSS_DROP_CHANCE: Record<string, number> = {
  forest: 0.25, cave: 0.25, swamp: 0.25, bandit_camp: 0.25,
  witch_tower: 0.25, bandit_fortress: 0.22,
  tower: 0.20, castle: 0.20,
  crypt: 0.20, dungeon_keep: 0.20,
  volcano: 0.15, ice_palace: 0.15, candy_realm: 0.15,
  dragon_nest: 0.15, tundra: 0.15,
};

export const MATERIALS: Record<string, { name: string; emoji: string }> = {
  waldgeist_staub: { name: 'Waldgeiststaub', emoji: '🌿' },
  kristall_kern:   { name: 'Kristallkern',   emoji: '💎' },
  turm_siegel:     { name: 'Turmsiegel',     emoji: '🔑' },
  bonbon_krone:    { name: 'Bonbonkrone',     emoji: '👑' },
  vulkan_stein:    { name: 'Vulkanstein',     emoji: '🌋' },
  eis_splitter:    { name: 'Eissplitter',     emoji: '❄️' },
  goetter_essenz:  { name: 'Götteressenz',   emoji: '✨' },
  hexen_trank:     { name: 'Hexentrank',      emoji: '🧪' },
  raeuber_muenze:  { name: 'Räubermünze',    emoji: '🪙' },
  hexen_essenz:    { name: 'Hexenessenz',     emoji: '🔮' },
  festungs_erz:    { name: 'Festungserz',     emoji: '⚙️' },
  grab_scherbe:    { name: 'Grabscherbe',     emoji: '🪦' },
  kerker_kette:    { name: 'Kerkerkette',     emoji: '⛓️' },
  drachen_seele:   { name: 'Drachenseele',    emoji: '🔥' },
  tundra_kristall: { name: 'Tundrakristall',  emoji: '🌨️' },
  // Kombi-Materialien (werden durch Kombinieren erzeugt)
  geist_kristall:  { name: 'Geistkristall',  emoji: '💫' },
  feuer_eis:       { name: 'Feuereis',        emoji: '🌊' },
};

export const RECIPES: RecipeDef[] = [
  {
    id: 'geister_sense',
    name: 'Geistersense',
    emoji: '🌙',
    description: 'Eine Waffe aus dem Stoff von Waldgeistern. +12 Angriff dauerhaft.',
    materials: { waldgeist_staub: 1 },
    result: { attackBonus: 12 },
    unlock: 'forest',
  },
  {
    id: 'geister_sense_plus',
    name: 'Geistersense+',
    emoji: '🌙',
    description: 'Aufgewertete Geistersense aus doppeltem Waldgeiststaub. +20 Angriff (ersetzt +12).',
    materials: { waldgeist_staub: 2 },
    result: { attackBonus: 20 },
    unlock: 'forest',
    requiresForged: 'geister_sense',
  },
  {
    id: 'kristall_panzer',
    name: 'Kristallpanzer',
    emoji: '💠',
    description: 'Aus dem Kern des Kristalldrachen geschmiedet. +6 Verteidigung.',
    materials: { kristall_kern: 1 },
    costGold: 40,
    result: { defense: 6 },
    unlock: 'cave',
  },
  {
    id: 'turm_amulett',
    name: 'Turm-Amulett',
    emoji: '🗝️',
    description: 'Das Siegel des Turmherrn, gebunden an Waldgeiststaub. +20 max. HP.',
    materials: { turm_siegel: 1, waldgeist_staub: 1 },
    result: { maxHp: 20 },
    unlock: 'tower',
  },
  {
    id: 'bonbon_ring',
    name: 'Bonbonkönigs-Ring',
    emoji: '💍',
    description: 'Die Krone des Königs, umgeschmiedet. +8 Bonbons/s dauerhaft.',
    materials: { bonbon_krone: 1, turm_siegel: 1 },
    result: { candyBonus: 8 },
    unlock: 'castle',
  },
  {
    id: 'vulkan_ruestung',
    name: 'Feuerrüstung',
    emoji: '🔥',
    description: 'Vulkanstein und Kristallkern, zu Rüstung verschmolzen. +5 Verteidigung, +15 max. HP.',
    materials: { vulkan_stein: 1, kristall_kern: 1 },
    result: { defense: 5, maxHp: 15 },
    unlock: 'volcano',
  },
  {
    id: 'eis_amulett',
    name: 'Eisgötter-Amulett',
    emoji: '🌌',
    description: 'Eissplitter und Götteressenz vereint. +30 max. HP, +3 Verteidigung.',
    materials: { eis_splitter: 1, goetter_essenz: 1 },
    result: { maxHp: 30, defense: 3 },
    unlock: 'candy_realm',
  },
  // ── Rezepte aus Kombi-Materialien ─────────────────────────────────────────
  {
    id: 'geist_klinge',
    name: 'Geistklinge',
    emoji: '💫',
    description: 'Aus Geistkristall geschmiedet — schneidet durch Materie und Magie. +15 Angriff, +10 max. HP.',
    materials: { geist_kristall: 1 },
    result: { attackBonus: 15, maxHp: 10 },
    unlock: 'cave',
  },
  {
    id: 'feuer_frost_harnisch',
    name: 'Feuer-Frost-Harnisch',
    emoji: '🌊',
    description: 'Glut und Eis formen unzerstörbare Rüstung. +8 Verteidigung, +20 max. HP.',
    materials: { feuer_eis: 1 },
    result: { defense: 8, maxHp: 20 },
    unlock: 'ice_palace',
  },
];

// ── Hybrid-Kombinationen ───────────────────────────────────────────────────

// ── Dungeon-System ─────────────────────────────────────────────────────────────

export const RUN_ITEMS: RunItemDef[] = [
  { id: 'war_horn',     name: 'Kriegshorn',          emoji: '📯', description: '+12 ATK für den Rest des Runs',          type: 'passive', subtype: 'permanent' },
  { id: 'steel_skin',   name: 'Stahlhaut-Tinktur',   emoji: '🧴', description: '+4 DEF für den Rest des Runs',           type: 'passive', subtype: 'permanent' },
  { id: 'fairy_shield', name: 'Feenschutz',           emoji: '🧚', description: 'Nächsten Treffer auf 0 reduzieren (1×)', type: 'passive', subtype: 'auto-1x' },
  { id: 'second_wind',  name: 'Zweite Chance',        emoji: '💨', description: 'Bei 0 HP: mit 5 HP überleben (1×)',      type: 'passive', subtype: 'auto-1x' },
  { id: 'life_potion',  name: 'Lebenstrank',          emoji: '❤️‍🔥', description: '+20 HP sofort (auf Map oder im Kampf)',  type: 'active' },
  { id: 'sugar_bomb',   name: 'Zuckerbombe',          emoji: '💣', description: '20 Sofortschaden an aktuellem Gegner',  type: 'active', useInCombat: true },
  { id: 'poison_candy', name: 'Vergiftetes Bonbon',   emoji: '☠️', description: 'Vergiftet Gegner für 6 Runden',         type: 'active', useInCombat: true },
  { id: 'greedy_chest', name: 'Gierige Kiste',        emoji: '🤑', description: '+50% Gold aus Kisten-Räumen',           type: 'passive', subtype: 'permanent' },
];

export const DUNGEON_CONFIG: Record<string, { middleRows: number }> = {
  forest:          { middleRows: 2 },
  swamp:           { middleRows: 2 },
  witch_tower:     { middleRows: 2 },
  cave:            { middleRows: 3 },
  bandit_camp:     { middleRows: 3 },
  bandit_fortress: { middleRows: 3 },
  tower:           { middleRows: 3 },
  crypt:           { middleRows: 3 },
  castle:          { middleRows: 3 },
  dungeon_keep:    { middleRows: 3 },
  volcano:         { middleRows: 4 },
  dragon_nest:     { middleRows: 4 },
  ice_palace:      { middleRows: 4 },
  tundra:          { middleRows: 4 },
  candy_realm:     { middleRows: 5 },
};

export const COMBOS: ComboDef[] = [
  {
    id: 'combo_geist_kristall',
    name: 'Geistkristall',
    emoji: '💫',
    description: 'Waldgeiststaub und Kristallkern verschmelzen zu einem magischen Hybrid-Kristall.',
    materials: { waldgeist_staub: 1, kristall_kern: 1 },
    resultMaterial: 'geist_kristall',
    unlock: 'cave',
  },
  {
    id: 'combo_feuer_eis',
    name: 'Feuereis',
    emoji: '🌊',
    description: 'Vulkanstein und Eissplitter bilden einen paradoxen Gleichgewichtsstoff.',
    materials: { vulkan_stein: 1, eis_splitter: 1 },
    resultMaterial: 'feuer_eis',
    unlock: 'ice_palace',
  },
];

export const QUESTS: QuestDef[] = [
  {
    id: 'forest',
    name: 'Der Wald',
    emoji: '🌲',
    description: 'Dunkle Kreaturen hausen im Wald.',
    requiredItem: 'sword',
    enemies: [
      { name: 'Waldgoblin',   emoji: '👺', maxHp: 12, attack: 3, poisonChance: 0.15 },
      { name: 'Stachelratte', emoji: '🐀', maxHp: 10, attack: 4 },
      { name: 'Waldgeist',    emoji: '👻', maxHp: 22, attack: 5, isBoss: true, specialMove: { name: 'Schreckensruf', damage: 3, stunPlayer: true, cooldown: 4 } },
    ],
    goldReward: 25,
    unlock: 'cave',
  },
  {
    id: 'cave',
    name: 'Die Höhle',
    emoji: '🪨',
    description: 'Tief in der Erde lauern mächtige Monster.',
    requiredItem: 'sword',
    enemies: [
      { name: 'Fledermaus',     emoji: '🦇', maxHp: 15, attack: 5, poisonChance: 0.30, specialMove: { name: 'Giftbiss', damage: 4, canPoison: true, cooldown: 3 } },
      { name: 'Steingolem',     emoji: '🪨', maxHp: 32, attack: 6, specialMove: { name: 'Felsenhieb', damage: 10, cooldown: 3 } },
      { name: 'Höhlentroll',    emoji: '👹', maxHp: 28, attack: 7, specialMove: { name: 'Keulenangriff', damage: 14, cooldown: 4 } },
      { name: 'Kristalldrache', emoji: '🐉', maxHp: 45, attack: 9, isBoss: true, specialMove: { name: 'Feuerhauch', damage: 16, pierceDefense: true, cooldown: 4 } },
    ],
    goldReward: 60,
    unlock: 'tower',
  },
  {
    id: 'tower',
    name: 'Der verlassene Turm',
    emoji: '🏰',
    description: 'Ein alter Turm, in dem finstere Wächter ihr Unwesen treiben.',
    requiredItem: 'sword',
    enemies: [
      { name: 'Geistersoldat',    emoji: '💀', maxHp: 25, attack: 8, specialMove: { name: 'Geisterwelle', damage: 5, stunPlayer: true, cooldown: 5 } },
      { name: 'Turm-Bogenschütze',emoji: '🏹', maxHp: 20, attack: 11, specialMove: { name: 'Präzisionsschuss', damage: 14, pierceDefense: true, cooldown: 4 } },
      { name: 'Turmmagier',       emoji: '🧙', maxHp: 30, attack: 10, specialMove: { name: 'Magieschlag', damage: 15, pierceDefense: true, cooldown: 3 } },
      { name: 'Turmwächter',      emoji: '🪖', maxHp: 38, attack: 11 },
      { name: 'Turmherr',         emoji: '👑', maxHp: 58, attack: 13, isBoss: true, specialMove: { name: 'Königliche Wut', damage: 20, stunPlayer: true, cooldown: 5 } },
    ],
    goldReward: 100,
    unlock: 'castle',
  },
  {
    id: 'castle',
    name: 'Das Zuckerschloss',
    emoji: '🏯',
    description: 'Die letzte Festung des Bonbon-Königs. Nur die Tapfersten wagen es.',
    requiredItem: 'sword',
    enemies: [
      { name: 'Burgwache',        emoji: '💂', maxHp: 28, attack: 11 },
      { name: 'Hofzauberer',      emoji: '🔮', maxHp: 35, attack: 12, specialMove: { name: 'Arkane Eruption', damage: 18, pierceDefense: true, cooldown: 4 } },
      { name: 'Drachenwächter',   emoji: '🐲', maxHp: 52, attack: 13, specialMove: { name: 'Drachenatem', damage: 22, pierceDefense: true, cooldown: 5 } },
      { name: 'Schattenassassin', emoji: '🥷', maxHp: 32, attack: 15, poisonChance: 0.20, specialMove: { name: 'Hinterhältiger Stich', damage: 20, pierceDefense: true, canPoison: true, cooldown: 3 } },
      { name: 'Zuckerkönigin',    emoji: '👸', maxHp: 68, attack: 14, isBoss: true, specialMove: { name: 'Schlaraffenland-Fluch', damage: 22, stunPlayer: true, cooldown: 4 } },
      { name: 'Bonbon-König',     emoji: '👑', maxHp: 90, attack: 17, isBoss: true, specialMove: { name: 'Königlicher Zorn', damage: 30, pierceDefense: true, stunPlayer: true, cooldown: 5 } },
    ],
    goldReward: 200,
    unlock: 'volcano',
  },

  // ── Seiten-Quest: Sumpf (nach Wald, benötigt Schild) ──────────────────────
  {
    id: 'swamp',
    name: 'Der giftige Sumpf',
    emoji: '🌿',
    description: 'Giftiger Morast und eklige Kreaturen. Bring einen Schild!',
    requiredItem: 'shield',
    enemies: [
      { name: 'Schlamm-Frosch',  emoji: '🐸', maxHp: 20, attack: 5, poisonChance: 0.30 },
      { name: 'Sumpfegel',       emoji: '🪱', maxHp: 22, attack: 6, specialMove: { name: 'Giftsog', damage: 6, canPoison: true, cooldown: 3 } },
      { name: 'Moosgeist',       emoji: '👻', maxHp: 28, attack: 7, specialMove: { name: 'Nebelschwaden', damage: 7, stunPlayer: true, cooldown: 4 } },
      { name: 'Sumpfhexe',       emoji: '🧙', maxHp: 44, attack: 9, isBoss: true, specialMove: { name: 'Hexenfluch', damage: 15, pierceDefense: true, cooldown: 4 } },
    ],
    goldReward: 45,
  },

  // ── Seiten-Quest: Räuberlager (nach Höhle) ────────────────────────────────
  {
    id: 'bandit_camp',
    name: 'Das Räuberlager',
    emoji: '⛺',
    description: 'Eine Räuberbande treibt Unfug am Waldrand.',
    requiredItem: 'sword',
    enemies: [
      { name: 'Wachtposten',       emoji: '🗡️', maxHp: 22, attack: 8 },
      { name: 'Räuber-Bogenschütze', emoji: '🏹', maxHp: 18, attack: 10, specialMove: { name: 'Pfeilregen', damage: 13, pierceDefense: true, cooldown: 3 } },
      { name: 'Räuberhauptmann',   emoji: '🥷', maxHp: 35, attack: 11, poisonChance: 0.15, specialMove: { name: 'Schmutziger Trick', damage: 10, stunPlayer: true, cooldown: 4 } },
      { name: 'Hinterhalt',        emoji: '🗡️', maxHp: 25, attack: 12 },
      { name: 'Räuberbaron',       emoji: '💰', maxHp: 56, attack: 13, isBoss: true, specialMove: { name: 'Banditenrage', damage: 20, pierceDefense: true, cooldown: 4 } },
    ],
    goldReward: 85,
  },

  // ── Ketten-Quest: Hexenturm (nach Sumpf) ──────────────────────────────────
  {
    id: 'witch_tower',
    name: 'Der Hexenturm',
    emoji: '🔮',
    description: 'Die Sumpfhexe hatte Meister. Ein finsterer Turm voll dunkler Magie.',
    requiredItem: 'shield',
    enemies: [
      { name: 'Hexen-Schüler',  emoji: '🧙', maxHp: 28, attack: 8, poisonChance: 0.20 },
      { name: 'Zauberspiegel',  emoji: '🪄', maxHp: 24, attack: 9, specialMove: { name: 'Magiestrahl', damage: 12, pierceDefense: true, cooldown: 3 } },
      { name: 'Fluchgeist',     emoji: '💀', maxHp: 36, attack: 10, specialMove: { name: 'Dunkler Fluch', damage: 10, stunPlayer: true, cooldown: 4 } },
      { name: 'Hexenmeister',   emoji: '👁️', maxHp: 55, attack: 12, isBoss: true, specialMove: { name: 'Hexenkessel', damage: 18, pierceDefense: true, canPoison: true, cooldown: 4 } },
    ],
    goldReward: 68,
  },

  // ── Ketten-Quest: Räuberfestung (nach Räuberlager) ────────────────────────
  {
    id: 'bandit_fortress',
    name: 'Die Räuberfestung',
    emoji: '🏯',
    description: 'Hinter dem Lager verbirgt sich eine befestigte Festung der Räubergilde.',
    requiredItem: 'sword',
    enemies: [
      { name: 'Festungswacht',       emoji: '🛡️', maxHp: 25, attack: 9 },
      { name: 'Armbrustschütze',     emoji: '🏹', maxHp: 20, attack: 11, specialMove: { name: 'Bolzensalve', damage: 14, pierceDefense: true, cooldown: 3 } },
      { name: 'Sprengmeister',       emoji: '💣', maxHp: 32, attack: 10, specialMove: { name: 'Pulverfass', damage: 16, stunPlayer: true, cooldown: 4 } },
      { name: 'Elitesoldat',         emoji: '⚔️', maxHp: 40, attack: 12 },
      { name: 'Festungskommandant',  emoji: '🎖️', maxHp: 68, attack: 14, isBoss: true, specialMove: { name: 'Kriegsschrei', damage: 20, stunPlayer: true, cooldown: 5 } },
    ],
    goldReward: 105,
  },

  // ── Seiten-Quest: Die Gruft (nach Turm) ───────────────────────────────────
  {
    id: 'crypt',
    name: 'Die Gruft',
    emoji: '🪦',
    description: 'Unter dem Turm liegt eine uralte Gruft voller Untote.',
    requiredItem: 'steel_blade',
    enemies: [
      { name: 'Grabzombie',    emoji: '🧟', maxHp: 30, attack: 10, poisonChance: 0.15 },
      { name: 'Skelettritter', emoji: '💀', maxHp: 35, attack: 11 },
      { name: 'Leichenwächter',emoji: '🪦', maxHp: 42, attack: 12, specialMove: { name: 'Todesgriff', damage: 14, stunPlayer: true, cooldown: 4 } },
      { name: 'Nekromant',     emoji: '🧙', maxHp: 38, attack: 13, specialMove: { name: 'Seelenraub', damage: 16, pierceDefense: true, cooldown: 3 } },
      { name: 'Grabkönig',     emoji: '👑', maxHp: 72, attack: 15, isBoss: true, specialMove: { name: 'Untote Armee', damage: 22, pierceDefense: true, stunPlayer: true, cooldown: 5 } },
    ],
    goldReward: 135,
  },

  // ── Seiten-Quest: Der Kerker (nach Schloss) ───────────────────────────────
  {
    id: 'dungeon_keep',
    name: 'Der Kerker',
    emoji: '⛓️',
    description: 'Unter dem Zuckerschloss liegt ein finsterer Kerker mit schrecklichen Wächtern.',
    requiredItem: 'hero_medal',
    enemies: [
      { name: 'Kerkermeister',  emoji: '🗝️', maxHp: 38, attack: 13 },
      { name: 'Kettensträfling',emoji: '⛓️', maxHp: 48, attack: 14 },
      { name: 'Wachsoldat',     emoji: '🛡️', maxHp: 44, attack: 14, specialMove: { name: 'Schildstoß', damage: 13, stunPlayer: true, cooldown: 4 } },
      { name: 'Peiniger',       emoji: '😈', maxHp: 52, attack: 15, poisonChance: 0.15, specialMove: { name: 'Dunkelfolter', damage: 18, pierceDefense: true, canPoison: true, cooldown: 3 } },
      { name: 'Schattenlord',   emoji: '🌑', maxHp: 88, attack: 17, isBoss: true, specialMove: { name: 'Schattenblitz', damage: 26, pierceDefense: true, stunPlayer: true, cooldown: 5 } },
    ],
    goldReward: 180,
  },

  // ── Vulkan (nach Schloss) ─────────────────────────────────────────────────
  {
    id: 'volcano',
    name: 'Der Vulkan',
    emoji: '🌋',
    description: 'Feuerspeiende Ungeheuer bewachen die glühenden Hänge.',
    requiredItem: 'steel_blade',
    enemies: [
      { name: 'Feuer-Imp',    emoji: '😈', maxHp: 38, attack: 13, specialMove: { name: 'Brandwurf', damage: 15, cooldown: 3 } },
      { name: 'Lavakröte',    emoji: '🐊', maxHp: 48, attack: 14, poisonChance: 0.15 },
      { name: 'Lava-Golem',   emoji: '🪨', maxHp: 68, attack: 15, specialMove: { name: 'Lavastrom', damage: 22, pierceDefense: true, cooldown: 4 } },
      { name: 'Feuerwächter', emoji: '🔥', maxHp: 58, attack: 16, specialMove: { name: 'Glutstoß', damage: 17, stunPlayer: true, cooldown: 4 } },
      { name: 'Vulkan-Drake', emoji: '🐲', maxHp: 95, attack: 18, isBoss: true, specialMove: { name: 'Inferno', damage: 30, pierceDefense: true, cooldown: 5 } },
    ],
    goldReward: 280,
    unlock: 'ice_palace',
  },

  // ── Seiten-Quest: Das Drachennest (nach Vulkan) ───────────────────────────
  {
    id: 'dragon_nest',
    name: 'Das Drachennest',
    emoji: '🐉',
    description: 'Tief im Vulkan brüten uralte Drachen. Nur mit Stahlklinge ratsam.',
    requiredItem: 'steel_blade',
    enemies: [
      { name: 'Drachenwelpe',      emoji: '🐣', maxHp: 48, attack: 14, specialMove: { name: 'Feuerspucken', damage: 13, cooldown: 3 } },
      { name: 'Lava-Wyrm',         emoji: '🐍', maxHp: 58, attack: 15, poisonChance: 0.15, specialMove: { name: 'Giftspucke', damage: 14, canPoison: true, cooldown: 3 } },
      { name: 'Drachenwächterin',  emoji: '🐲', maxHp: 72, attack: 17, specialMove: { name: 'Klauenangriff', damage: 19, stunPlayer: true, cooldown: 4 } },
      { name: 'Scharlachdrache',   emoji: '🔴', maxHp: 65, attack: 18, specialMove: { name: 'Blutflamme', damage: 22, pierceDefense: true, cooldown: 4 } },
      { name: 'Uralter Drache',    emoji: '🐉', maxHp: 115, attack: 21, isBoss: true, specialMove: { name: 'Höllenatmung', damage: 32, pierceDefense: true, cooldown: 5 } },
    ],
    goldReward: 360,
  },

  // ── Eispalast (nach Vulkan) ───────────────────────────────────────────────
  {
    id: 'ice_palace',
    name: 'Der Eispalast',
    emoji: '🧊',
    description: 'Ein Palast aus ewigem Eis, bewacht von frostigen Wächtern.',
    requiredItem: 'iron_shield',
    enemies: [
      { name: 'Eiszombie',    emoji: '🧟', maxHp: 42, attack: 14, specialMove: { name: 'Frostbiss', damage: 13, stunPlayer: true, cooldown: 4 } },
      { name: 'Eisgolem',     emoji: '🧊', maxHp: 72, attack: 16, specialMove: { name: 'Kältewelle', damage: 20, cooldown: 3 } },
      { name: 'Schneegeist',  emoji: '❄️', maxHp: 48, attack: 17, poisonChance: 0.20, specialMove: { name: 'Eissturm', damage: 16, pierceDefense: true, cooldown: 4 } },
      { name: 'Frostwache',   emoji: '🥶', maxHp: 62, attack: 18 },
      { name: 'Eisfürst',     emoji: '🧊', maxHp: 82, attack: 20, isBoss: true, specialMove: { name: 'Tiefkühlfluch', damage: 26, pierceDefense: true, cooldown: 4 } },
      { name: 'Eiskönigin',   emoji: '👸', maxHp: 105, attack: 21, isBoss: true, specialMove: { name: 'Blizzard', damage: 32, pierceDefense: true, stunPlayer: true, cooldown: 5 } },
    ],
    goldReward: 420,
    unlock: 'candy_realm',
  },

  // ── Seiten-Quest: Die Tundra (nach Eispalast) ────────────────────────────
  {
    id: 'tundra',
    name: 'Die Tundra',
    emoji: '🌨️',
    description: 'Ein endloser gefrorener Ödnis nördlich des Eispalastes. Eisschild empfohlen.',
    requiredItem: 'iron_shield',
    enemies: [
      { name: 'Eiswolf',         emoji: '🐺', maxHp: 55, attack: 16, poisonChance: 0.10, specialMove: { name: 'Rudelsturm', damage: 14, cooldown: 4 } },
      { name: 'Frostriese',      emoji: '🧊', maxHp: 78, attack: 18, specialMove: { name: 'Eisfaust', damage: 20, stunPlayer: true, cooldown: 4 } },
      { name: 'Schneeschamane',  emoji: '❄️', maxHp: 62, attack: 19, specialMove: { name: 'Blizzardruf', damage: 18, pierceDefense: true, cooldown: 3 } },
      { name: 'Mammut',          emoji: '🦣', maxHp: 90, attack: 20 },
      { name: 'Tundrakönig',     emoji: '🌨️', maxHp: 128, attack: 23, isBoss: true, specialMove: { name: 'Permafrost', damage: 30, pierceDefense: true, stunPlayer: true, cooldown: 5 } },
    ],
    goldReward: 510,
  },

  // ── Bonbon-Reich (finales Ende) ───────────────────────────────────────────
  {
    id: 'candy_realm',
    name: 'Das Bonbon-Reich',
    emoji: '🍬',
    description: 'Das Reich des Süßigkeitengottes. Nur Legenden überleben dies.',
    requiredItem: 'hero_medal',
    enemies: [
      { name: 'Zuckerwächter',       emoji: '🍭', maxHp: 52, attack: 16 },
      { name: 'Karamell-Troll',      emoji: '🧡', maxHp: 78, attack: 18, specialMove: { name: 'Karamell-Falle', damage: 22, stunPlayer: true, cooldown: 4 } },
      { name: 'Keks-Ritter',         emoji: '🍪', maxHp: 68, attack: 20, specialMove: { name: 'Zuckerschwert', damage: 24, pierceDefense: true, cooldown: 3 } },
      { name: 'Schokoladendrache',   emoji: '🍫', maxHp: 95, attack: 21, poisonChance: 0.20, specialMove: { name: 'Kakao-Inferno', damage: 28, pierceDefense: true, cooldown: 4 } },
      { name: 'Marzipan-Magier',     emoji: '🔮', maxHp: 72, attack: 20, specialMove: { name: 'Süßer Fluch', damage: 26, pierceDefense: true, stunPlayer: true, cooldown: 3 } },
      { name: 'Bonbon-Prinzessin',   emoji: '👸', maxHp: 115, attack: 23, isBoss: true, specialMove: { name: 'Zuckersturm', damage: 32, pierceDefense: true, cooldown: 4 } },
      { name: 'Süßigkeitengott',     emoji: '✨', maxHp: 145, attack: 26, isBoss: true, specialMove: { name: 'Göttlicher Zorn', damage: 38, pierceDefense: true, stunPlayer: true, cooldown: 5 } },
    ],
    goldReward: 650,
  },
];
