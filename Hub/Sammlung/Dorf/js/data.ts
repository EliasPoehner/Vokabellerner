import type { BuildingDef, ResearchDef, ObstacleDef, SkillDef } from './types';

export const TIERS = ['Weiler', 'Dorf', 'Stadt', 'Königreich'] as const;

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'rathaus', name: 'Rathaus', cat: 'gesellschaft',
    desc: 'Das Herz des Dorfes. Kann nicht manuell gebaut oder bewegt werden.',
    cost: {}, costMult: 1, prod: {}, special: 'rathaus', workers: 0, requires: {},
    color3d: 0xd4a830, shape: 'hall', height: 2.5
  },
  {
    id: 'wohnhaus', name: 'Wohnhaus', cat: 'produktion',
    desc: 'Beherbergt 3 neue Einwohner. Kein Arbeiter nötig.',
    cost: { holz: 6, stein: 3 }, costMult: 1.4, prod: { nahrung: -0.2, gold: 0.1 }, special: 'wohnhaus', workers: 0, requires: {},
    color3d: 0xd4a840, shape: 'house', height: 1.4
  },
  {
    id: 'waldarbeiter', name: 'Waldarbeiter', cat: 'produktion',
    desc: '1 Arbeiter schlägt Holz und verkauft Späne.',
    cost: { holz: 0, nahrung: 2 }, costMult: 1.3, prod: { holz: 0.4, gold: -0.07 }, workers: 1, requires: {},
    color3d: 0x5a8a40, shape: 'hut', height: 1.0
  },
  {
    id: 'steinbruch', name: 'Steinbruch', cat: 'produktion',
    desc: '1 Arbeiter bricht Stein und verkauft Ausschuss.',
    cost: { holz: 6, nahrung: 2 }, costMult: 1.3, prod: { stein: 0.3, gold: -0.05 }, workers: 1, requires: {},
    color3d: 0x8a7a60, shape: 'quarry', height: 0.8
  },
  {
    id: 'feld', name: 'Feld', cat: 'produktion',
    desc: '1 Arbeiter baut Korn an und verkauft Überschüsse.',
    cost: { holz: 3 }, costMult: 1.25, prod: { nahrung: 0.7, gold: -0.04 }, workers: 1, requires: {},
    color3d: 0xc8a840, shape: 'farm', height: 0.5
  },
  {
    id: 'jaeger', name: 'Jägerposten', cat: 'produktion',
    desc: '2 Jäger durchkämmen den Wald. Bringt Nahrung & Gold.',
    cost: { holz: 10, stein: 2, gold: 3 }, costMult: 1.35, prod: { nahrung: 0.4, gold: 0.12 }, workers: 2, requires: {},
    color3d: 0x4a6830, shape: 'tower', height: 1.8
  },
  {
    id: 'saegemuehle', name: 'Sägemühle', cat: 'verarbeitung',
    desc: '2 Arbeiter – +50% Holzprod. global.',
    cost: { holz: 20, stein: 8, gold: 5 }, costMult: 1.6, prod: {}, special: 'holzBoost', workers: 2, requires: { waldarbeiter_count: 3 },
    color3d: 0x8a5a20, shape: 'mill', height: 1.6
  },
  {
    id: 'schmiede', name: 'Schmiede', cat: 'verarbeitung',
    desc: '2 Schmiede – verkauft Werkzeuge. Braucht Stein.',
    cost: { holz: 12, stein: 18, gold: 8 }, costMult: 1.5, prod: { gold: -0.35 }, workers: 2, requires: { steinbruch_count: 3 },
    color3d: 0x6a4a30, shape: 'forge', height: 1.4
  },
  {
    id: 'kohlerei', name: 'Köhlerei', cat: 'verarbeitung',
    desc: '2 Arbeiter – verbrennt Holz zu Kohle & Gold.',
    cost: { holz: 18, stein: 10, gold: 6 }, costMult: 1.45, prod: { kohle: 0.5, holz: -0.4, gold: -0.6 }, workers: 2, requires: { waldarbeiter_count: 2 },
    color3d: 0x303030, shape: 'kiln', height: 1.2
  },
  {
    id: 'bergwerk', name: 'Tiefbergwerk', cat: 'verarbeitung',
    desc: '3 Arbeiter – tiefer Steinabbau.',
    cost: { holz: 22, stein: 14, gold: 10 }, costMult: 1.55, prod: { stein: 1, holz: -0.5, gold: -0.08 }, workers: 3, requires: { steinbruch_count: 2 },
    color3d: 0x5a4a30, shape: 'mine', height: 1.0
  },
  {
    id: 'baeckerei', name: 'Bäckerei', cat: 'verarbeitung',
    desc: '1 Bäcker – verarbeitet Nahrung. Bev. wächst schneller. Mindestens 3 Felder',
    cost: { holz: 8, stein: 12, gold: 10 }, costMult: 1.4, prod: { nahrung: -2, gold: 0.2 }, special: 'popBoost', workers: 1, requires: { feld_count: 3 },
    color3d: 0xe8a050, shape: 'bakery', height: 1.1
  },
  {
    id: 'brauerei', name: 'Brauerei', cat: 'verarbeitung',
    desc: '2 Brauer – Bier hebt Stimmung & bringt Gold. Mindestens 2 Felder und 1 Markt',
    cost: { holz: 16, stein: 14, gold: 12 }, costMult: 1.5, prod: { nahrung: -1, gold: 0.45 }, special: 'brauerei', workers: 2, requires: { feld_count: 2, markt_count: 1 },
    color3d: 0xa06820, shape: 'brewery', height: 1.5
  },
  {
    id: 'schmelze', name: 'Schmelze', cat: 'verarbeitung',
    desc: '3 Arbeiter – verhüttet Eisen. Braucht Metallurgie. Mindestens 5 Steinbrüche',
    cost: { holz: 25, stein: 25, gold: 18 }, costMult: 1.7, prod: { eisen: 0.3, kohle: -0.5 }, workers: 3, requires: { steinbruch_count: 5, research: 'metallurgie' },
    color3d: 0xe06030, shape: 'smelter', height: 1.6
  },
  {
    id: 'wache', name: 'Wachposten', cat: 'militaer',
    desc: '2 Wächter – schützen das Dorf. Moral +5.',
    cost: { holz: 14, stein: 10, gold: 12 }, costMult: 1.4, prod: {}, special: 'defense', workers: 2, requires: {},
    color3d: 0x4060a0, shape: 'watchtower', height: 2.2
  },
  {
    id: 'mauer', name: 'Stadtmauer', cat: 'militaer',
    desc: '3 Wächter – starke Befestigung. Moral +10. Mindestens 2 Wachen',
    cost: { holz: 20, stein: 50, gold: 22 }, costMult: 1.9, prod: {}, special: 'defense2', workers: 3, requires: { wache_count: 2, research: 'taktik' },
    color3d: 0x708090, shape: 'wall', height: 2.0
  },
  {
    id: 'soeldner', name: 'Söldnerlager', cat: 'militaer',
    desc: '3 Söldner – starke Verteidigung, kostet Gold.',
    cost: { holz: 18, stein: 16, gold: 30 }, costMult: 1.6, prod: { gold: -0.18 }, special: 'defense', workers: 3, requires: { wache_count: 1 },
    color3d: 0x604040, shape: 'barracks', height: 1.4
  },
  {
    id: 'ruestkammer', name: 'Rüstkammer', cat: 'militaer',
    desc: '2 Waffenschmiede – mächtige Ausrüstung.',
    cost: { holz: 20, stein: 30, gold: 25, eisen: 8 }, costMult: 1.8, prod: { eisen: -0.12 }, special: 'defense2', workers: 2, requires: { schmelze_count: 1, research: 'taktik' },
    color3d: 0x506080, shape: 'armory', height: 1.6
  },
  {
    id: 'markt', name: 'Markt', cat: 'gesellschaft',
    desc: '2 Händler – Hauptgoldquelle.',
    cost: { holz: 12, stein: 6 }, costMult: 1.4, prod: { gold: 0.55, holz: -0.4, stein: -0.4 }, workers: 2, requires: { feld_count: 1 },
    color3d: 0xd4a840, shape: 'market', height: 1.0
  },
  {
    id: 'lagerhaus', name: 'Lagerhaus', cat: 'gesellschaft',
    desc: '1 Verwalter – erhöht alle Lager-Obergrenzen.',
    cost: { holz: 20, stein: 10, gold: 8 }, costMult: 1.5, prod: { gold: -1.05 }, special: 'lager', workers: 1, requires: { markt_count: 1 },
    color3d: 0xa08060, shape: 'warehouse', height: 1.3
  },
  {
    id: 'bibliothek', name: 'Bibliothek', cat: 'gesellschaft',
    desc: '2 Gelehrte – ermöglicht Forschung.',
    cost: { holz: 28, stein: 18, gold: 22 }, costMult: 2, prod: {}, special: 'unlockResearch', workers: 2, requires: { markt_count: 1 },
    color3d: 0x5a70a0, shape: 'library', height: 1.5
  },
  {
    id: 'kirche', name: 'Kirche', cat: 'gesellschaft',
    desc: '2 Priester – hebt Moral permanent +15.',
    cost: { holz: 32, stein: 28, gold: 32 }, costMult: 2, prod: {}, special: 'moralBoost', workers: 2, requires: { bibliothek_count: 1 },
    color3d: 0xd4d4f0, shape: 'church', height: 2.8
  },
  {
    id: 'kathedrale', name: 'Kathedrale', cat: 'gesellschaft',
    desc: '4 Priester – Moral +20, Goldbonus.',
    cost: { holz: 60, stein: 90, gold: 70, eisen: 12 }, costMult: 3, prod: { gold: 0.6 }, special: 'prestige', workers: 4, requires: { kirche_count: 1, research: 'kathedrale_tech' },
    color3d: 0xf0e8c0, shape: 'cathedral', height: 4.0
  },
];

export const RESEARCH: ResearchDef[] = [
  // Wirtschaft
  { id: 'bewaesserung', name: 'Bewässerung', branch: 'wirtschaft', tier: 1, effect: '+50% Nahrung', cost: { gold: 18, holz: 12 }, requires: [], special: 'nahrungBoost', duration: 300 },
  { id: 'gewuerzhandel', name: 'Gewürzhandel', branch: 'wirtschaft', tier: 2, effect: '+60% Gold', cost: { gold: 45, holz: 22 }, requires: ['bewaesserung'], special: 'goldBoost', duration: 600 },
  { id: 'gilden', name: 'Zünfte', branch: 'wirtschaft', tier: 3, effect: 'Alle Prod. +20%', cost: { gold: 90, eisen: 22 }, requires: ['gewuerzhandel'], special: 'allBoost', duration: 1200 },
  // Technik
  { id: 'metallurgie', name: 'Metallurgie', branch: 'technik', tier: 1, effect: 'Schmelze frei', cost: { gold: 22, stein: 18 }, requires: [], special: 'none', duration: 300 },
  { id: 'kathedrale_tech', name: 'Große Architektur', branch: 'technik', tier: 2, effect: 'Kathedrale bauen', cost: { gold: 55, eisen: 12 }, requires: ['metallurgie'], special: 'none', duration: 600 },
  { id: 'ingenieure', name: 'Ingenieure', branch: 'technik', tier: 3, effect: '+40% Stein', cost: { gold: 85, eisen: 32 }, requires: ['kathedrale_tech'], special: 'steinBoost', duration: 1200 },
  // Militär
  { id: 'taktik', name: 'Taktik', branch: 'militaer', tier: 1, effect: 'Mauer frei', cost: { gold: 28, holz: 22 }, requires: [], special: 'none', duration: 300 },
  { id: 'ritter', name: 'Ritter', branch: 'militaer', tier: 2, effect: '+5 Verteidigung', cost: { gold: 65, eisen: 22 }, requires: ['taktik'], special: 'defenseBoost', duration: 600 },
  { id: 'feudalrecht', name: 'Feudalrecht', branch: 'militaer', tier: 3, effect: '+50% Gold+Moral', cost: { gold: 110, eisen: 45 }, requires: ['ritter'], special: 'feudal', duration: 1200 },
  // Landwirtschaft
  { id: 'kompostwirtschaft', name: 'Kompostwirtschaft', branch: 'landwirtschaft', tier: 1, effect: '+30% Nahrung', cost: { gold: 20, holz: 10 }, requires: [], special: 'nahrungBoost30', duration: 300 },
  { id: 'fruchtfolge', name: 'Fruchtfolge', branch: 'landwirtschaft', tier: 2, effect: '−20% Nahrungsverbrauch', cost: { gold: 40, holz: 18 }, requires: ['kompostwirtschaft'], special: 'nahrungVerbrauchReduce', duration: 600 },
  { id: 'gewaechshaus', name: 'Gewächshaus', branch: 'landwirtschaft', tier: 3, effect: 'Nahrung wächst auch bei Dürre', cost: { gold: 75, stein: 20 }, requires: ['fruchtfolge'], special: 'gewaechshaus', duration: 900 },
  { id: 'plantagenwirtschaft', name: 'Plantagenwirtschaft', branch: 'landwirtschaft', tier: 4, effect: '+80% Nahrung', cost: { gold: 130, eisen: 15 }, requires: ['gewaechshaus'], special: 'nahrungBoost80', duration: 1200 },
  // Handel
  { id: 'fernhandel', name: 'Fernhandel', branch: 'handel', tier: 1, effect: '+20% Gold', cost: { gold: 25, holz: 15 }, requires: [], special: 'goldBoost20', duration: 300 },
  { id: 'muenzpraegung', name: 'Münzprägung', branch: 'handel', tier: 2, effect: '+30% Gold', cost: { gold: 50, stein: 20 }, requires: ['fernhandel'], special: 'goldBoost30', duration: 600 },
  { id: 'gildenwesen', name: 'Gildenwesen', branch: 'handel', tier: 3, effect: 'Alle Prod. +15%', cost: { gold: 95, eisen: 20 }, requires: ['muenzpraegung'], special: 'allBoost15', duration: 900 },
  { id: 'banken', name: 'Banken', branch: 'handel', tier: 4, effect: '+Gold aus Vorräten', cost: { gold: 150, eisen: 40 }, requires: ['gildenwesen'], special: 'banken', duration: 1200 },
];

export interface SkillBranch {
  id: string;
  label: string;
  color: string;
  skills: SkillDef[];
}

export const SKILLS: SkillBranch[] = [
  {
    id: 'wirtschaft', label: 'Wirtschaft', color: 'var(--green2)',
    skills: [
      { id: 'holzExperte',  name: 'Erfahrene Waldarbeiter', effect: '+25% Holzproduktion',  cost: 1, requires: null },
      { id: 'steinExperte', name: 'Effiziente Steinbrüche',  effect: '+25% Steinproduktion', cost: 1, requires: 'holzExperte' },
      { id: 'fruchtbBoden', name: 'Fruchtbarer Boden',       effect: '+35% Nahrungsproduktion', cost: 2, requires: 'steinExperte' },
      { id: 'handelsnetz',  name: 'Handelsnetz',              effect: '+40% Goldproduktion',  cost: 3, requires: 'fruchtbBoden' },
    ],
  },
  {
    id: 'militaer', label: 'Militär', color: 'var(--red2)',
    skills: [
      { id: 'befestigungskunst', name: 'Befestigungskunst', effect: '+3 Verteidigung dauerhaft',           cost: 1, requires: null },
      { id: 'kampftraining',     name: 'Kampftraining',     effect: 'Belagerung: −1 Angriffswelle',        cost: 1, requires: 'befestigungskunst' },
      { id: 'mauermeister',      name: 'Mauermeister',      effect: 'Mauer: +1 HP Maximum',                cost: 2, requires: 'kampftraining' },
      { id: 'kriegsstrategie',   name: 'Kriegsstrategie',   effect: '+30% Ressourcen aus Raubzug-Sieg',    cost: 3, requires: 'mauermeister' },
    ],
  },
  {
    id: 'gesellschaft', label: 'Gesellschaft', color: 'var(--blue2)',
    skills: [
      { id: 'gemeinschaftssinn',    name: 'Gemeinschaftssinn',    effect: '+8 Moral dauerhaft',                cost: 1, requires: null },
      { id: 'bevoelkerungswachstum', name: 'Bevölkerungswachstum', effect: '+1 Einwohner pro Wohnhaus',         cost: 1, requires: 'gemeinschaftssinn' },
      { id: 'meisterhandwerker',    name: 'Meisterhandwerker',    effect: 'Gebäude-Upgrades −25% billiger',    cost: 2, requires: 'bevoelkerungswachstum' },
      { id: 'forschungseifer',      name: 'Forschungseifer',      effect: 'Forschungszeit −30%',               cost: 3, requires: 'meisterhandwerker' },
    ],
  },
];

export const OBSTACLES: ObstacleDef[] = [
  {
    id: 'tree_pine', name: 'Tanne', type: 'tree',
    cost: {}, yield: { holz: 15 }, hp: 1, shape: 'pine', color: 0x3a5220,
    desc: 'Gibt 15 Holz beim Entfernen.'
  },
  {
    id: 'boulder_mossy', name: 'Moosiger Fels', type: 'stone',
    cost: { gold: 5 }, yield: { stein: 10 }, hp: 2, shape: 'rock', color: 0x708090,
    desc: 'Gibt 10 Stein beim Entfernen (kostet 5 Gold).'
  },
];
