export type ResourceKey = 'holz' | 'stein' | 'nahrung' | 'gold' | 'eisen' | 'kohle';
export type Resources = Record<ResourceKey, number>;

export interface BuildingDef {
  id: string;
  name: string;
  cat: string;
  desc: string;
  cost: Partial<Resources>;
  costMult: number;
  prod: Partial<Resources>;
  special?: string;
  workers: number;
  requires: Record<string, string | number>;
  color3d: number;
  shape: string;
  height: number;
}

export interface BuildingInstance {
  level: number;
  x: number | null;
  z: number | null;
  hp?: number;
}

export interface ResearchDef {
  id: string;
  name: string;
  branch: string;
  tier: number;
  effect: string;
  cost: Partial<Resources>;
  requires: string[];
  special: string;
  duration: number;
}

export interface ResearchState {
  done: boolean;
  progress?: number;
  duration?: number;
}

export interface ObstacleDef {
  id: string;
  name: string;
  type: string;
  cost: Partial<Resources>;
  yield: Partial<Resources>;
  hp: number;
  shape: string;
  color: number;
  desc: string;
}

export interface ObstacleInstance {
  id: string;
  x: number;
  z: number;
}

export interface SkillDef {
  id: string;
  name: string;
  effect: string;
  cost: number;
  requires: string | null;
}

export interface BelagerungState {
  roundsLeft: number;
  roundsTotal: number;
  nextAttackTick: number;
  currentWave?: number;
}

export interface GameState {
  day: number;
  tick: number;
  prestige: number;
  prestigeMult: number;
  res: Resources;
  pop: number;
  popTotal: number;
  popMax: number;
  buildings: Record<string, BuildingInstance[]>;
  research: Record<string, true | ResearchState>;
  activeResearch: string | null;
  eventsHandled: number;
  tier: number;
  moral: number;
  lager: Resources;
  modifiers: {
    nahrungMult: number;
    holzMult: number;
    steinMult: number;
    goldMult: number;
    eisenMult: number;
    defense: number;
  };
  nextEventTick: number;
  rathausAlive: boolean;
  roads: string[];
  obstacles: ObstacleInstance[];
  // Prestige skill tree (persists across resets)
  prestigePoints?: number;
  skills?: Record<string, boolean>;
  // Optional runtime state
  _seuche?: number;
  _popBuf?: number;
  _starveBuf?: number;
  _nahrungReduceFactor?: number;
  _gewaechshaus?: boolean;
  _banken?: boolean;
  _belagerung?: BelagerungState;
}

export interface GameCallbacks {
  notify(msg: string, type?: string): void;
  toggleRoad(key: string, gx: number, gz: number): void;
  removeObstacle(id: string, x: number, z: number): void;
  save(): void;
  upgradeCost(b: BuildingDef, level: number): Partial<Resources>;
}
