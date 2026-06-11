import type { GameState } from './types';

export const S: GameState = {
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
    { id: 'boulder_mossy', x: 5, z: -3 }, { id: 'boulder_mossy', x: -2, z: 5 },
  ],
};
