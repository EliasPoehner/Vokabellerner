import { S, revealRadius, isDoorLocked } from './game';
import type { DungeonGrid, GridEnemy } from './types';

const TILE_SRC = 16;   // source tile size in spritesheet
const PITCH = 17;   // tile + 1px gap
const COLS = 12;   // columns in tilemap
const TILE_DST = 32;   // rendered tile size (2×)
const VIEW_W = 15;   // visible tiles horizontally
const VIEW_H = 11;   // visible tiles vertically (480×352 canvas)

// ── Tile indices (Kenney Tiny Dungeon tilemap, 0-based) ─────────────────────
// Change a sprite by editing the number here — look up the desired tile in
// kenney_tiny-dungeon/Tiles/tile_NNNN.png and use that number (no leading zeros).
const TILE = {
  FLOOR: 0,
  FLOOR_VARIANT_1: 12,
  FLOOR_VARIANT_2: 24,
  WALL: 40,
  EXIT: 39,
  CHEST: 89,
  PLAYER: 98,
  DOOR_LOCKED: 45,
};

// On average 1 in N floor tiles gets a decorative variant instead of the
// plain TILE.FLOOR — lower = more variety. Tune to taste.
const FLOOR_VARIANT_EVERY = 10;

// Enemies attempt one step every ENEMY_MOVE_INTERVAL_MS; only a fraction
// move on a given tick so they don't all step in lockstep. The fraction is
// scaled per enemy type via MOVE_PACE below (small/fast creatures roll more
// often and feel erratic, heavy/slow ones roll rarely).
const ENEMY_MOVE_INTERVAL_MS = 700;
const ENEMY_MOVE_CHANCE = 0.6;
const WANDER_DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

const MOVE_MAP: Record<string, [number, number]> = {
  'w': [0, -1], 'arrowup': [0, -1],
  's': [0, 1], 'arrowdown': [0, 1],
  'a': [-1, 0], 'arrowleft': [-1, 0],
  'd': [1, 0], 'arrowright': [1, 0],
};

// Once the player is within AGGRO_RADIUS (Chebyshev distance), an enemy
// starts chasing instead of wandering, and does so more reliably each tick.
// It keeps chasing — leaving its home room if needed — until the player
// gets past AGGRO_GIVE_UP_RADIUS, so fleeing through a doorway doesn't make
// it stop dead at the threshold. Bosses stay confined to their own room even
// while chasing — they're meant to hold their arena, not roam the floor.
const AGGRO_RADIUS = 5;
const AGGRO_GIVE_UP_RADIUS = 10;
const AGGRO_MOVE_CHANCE = 0.85;

// Brief "spotted you" marker shown the moment an enemy starts chasing.
const AGGRO_FLASH_MS = 700;

// Per-enemy-type pace multiplier, applied to both the idle wander and the
// aggro move chance — small fast creatures dart around often, big slow ones
// take rare, heavy steps. Missing names default to 1 (normal pace).
const MOVE_PACE: Record<string, number> = {
  'Fledermaus': 1.35,
  'Stachelratte': 1.25,
  'Assassin': 1.25,
  'Steingolem': 0.5,
  'Höhlentroll': 0.55,
  'Wächter': 0.6,
  'Turmherr': 0.5,
  'Burgwache': 0.6,
  'Drachenwächter': 0.55,
  'Kristalldrache': 0.5,
  'Zuckerkönigin': 0.6,
  'Bonbon-König': 0.5,
};
function movePaceFor(name: string): number {
  return MOVE_PACE[name] ?? 1;
}

// Visual slide duration after a step — shorter than the move interval so an
// enemy settles before its next decision (no pathfinding/line-of-sight,
// matches the simplicity of the rest of the dungeon AI). The player's own
// slide is quicker since discrete key presses should feel responsive.
const ENEMY_MOVE_ANIM_MS = 300;
const PLAYER_MOVE_ANIM_MS = 160;

// Auto-Pilot (Prestige-Upgrade): replaces manual WASD with BFS pathing toward
// the nearest enemy/chest/exit, at a noticeably faster pace than hand-driven
// movement — the whole point is a "fast-forward" feel between encounters.
const AUTOPILOT_MOVE_ANIM_MS = 70;

interface MoveAnim { fromX: number; fromY: number; toX: number; toY: number; startedAt: number; duration: number; }

// Deterministic per-coordinate pick (no Math.random() — render() runs every
// frame, a random pick here would make the floor flicker between variants).
function floorTileFor(tx: number, ty: number): number {
  const hash = Math.abs((tx * 374761393 + ty * 668265263) ^ ((tx + ty * 31) * 2654435761));
  const n = hash % FLOOR_VARIANT_EVERY;
  if (n === 0) return TILE.FLOOR_VARIANT_1;
  if (n === 1) return TILE.FLOOR_VARIANT_2;
  return TILE.FLOOR;
}

// Enemy sprite index by name (Kenney Tiny Dungeon tilemap, 0-based)
const ENEMY_TILE: Record<string, number> = {
  'Waldgoblin': 96,
  'Stachelratte': 96,
  'Waldgeist': 84,
  'Fledermaus': 86,
  'Steingolem': 97,
  'Höhlentroll': 97,
  'Kristalldrache': 100,
  'Geistersoldat': 84,
  'Bogenschütze': 86,
  'Magier': 84,
  'Wächter': 97,
  'Turmherr': 100,
  'Burgwache': 97,
  'Hofzauberer': 84,
  'Drachenwächter': 100,
  'Assassin': 99,
  'Zuckerkönigin': 99,
  'Bonbon-König': 100,
};

type Callback = () => void;

export class DungeonExplorer {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private sheet!: HTMLImageElement;
  private sheetReady = false;
  private rafId = 0;

  private keyDownListener: ((e: KeyboardEvent) => void) | null = null;
  private keyUpListener: ((e: KeyboardEvent) => void) | null = null;
  private blurListener: (() => void) | null = null;
  // Currently-held movement keys, in press order — Map preserves insertion
  // order, and re-setting an already-present key doesn't move it, so the
  // last entry is always the most recently pressed key that's still held.
  private heldKeys = new Map<string, [number, number]>();
  private onFightEnemy: ((id: string) => void) | null = null;
  private onOpenChest: ((id: string) => void) | null = null;
  private onNextFloor: Callback | null = null;
  private onCollectLoot: Callback | null = null;

  private camX = 0;
  private camY = 0;
  private doorFlashUntil = 0;
  private nextEnemyMoveAt = 0;
  private nextPlayerMoveAt = 0;
  private nextAutopilotMoveAt = 0;
  private enemyAnims = new Map<string, MoveAnim>();
  private playerAnim: MoveAnim | null = null;
  private chasing = new Set<string>(); // enemy ids currently pursuing the player (hysteresis via AGGRO_GIVE_UP_RADIUS)
  private aggroFlash = new Map<string, number>(); // enemy id -> timestamp until the "spotted you" marker is shown

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.sheet = new Image();
    this.sheet.src = 'kenney_tiny-dungeon/Tilemap/tilemap.png';
    this.sheet.onload = () => { this.sheetReady = true; };
  }

  startExploring(
    onFightEnemy: (id: string) => void,
    onOpenChest: (id: string) => void,
    onNextFloor: Callback,
    onCollectLoot: Callback,
  ): void {
    this.stopExploring(); // clean up any previous run

    this.onFightEnemy = onFightEnemy;
    this.onOpenChest = onOpenChest;
    this.onNextFloor = onNextFloor;
    this.onCollectLoot = onCollectLoot;

    const g = S.dungeon?.grid;
    if (g) {
      revealRadius(g.visited, g.playerX, g.playerY, 6); // camera is computed fresh every frame in render()
    }

    this.keyDownListener = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.keyUpListener = (e: KeyboardEvent) => this.handleKeyUp(e);
    // Alt-Tab / window-switching can drop the keyup for a still-held key —
    // without this, the player would keep "moving" in that direction forever.
    this.blurListener = () => this.heldKeys.clear();
    document.addEventListener('keydown', this.keyDownListener);
    document.addEventListener('keyup', this.keyUpListener);
    window.addEventListener('blur', this.blurListener);
    this.startLoop();
  }

  stopExploring(): void {
    if (this.keyDownListener) {
      document.removeEventListener('keydown', this.keyDownListener);
      this.keyDownListener = null;
    }
    if (this.keyUpListener) {
      document.removeEventListener('keyup', this.keyUpListener);
      this.keyUpListener = null;
    }
    if (this.blurListener) {
      window.removeEventListener('blur', this.blurListener);
      this.blurListener = null;
    }
    this.heldKeys.clear();
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.onFightEnemy = null;
    this.onOpenChest = null;
    this.onNextFloor = null;
    this.onCollectLoot = null;
    this.enemyAnims.clear(); // enemy ids restart per floor — stale anims would slide the wrong sprite
    this.playerAnim = null;
    this.chasing.clear();
    this.aggroFlash.clear();
    this.nextAutopilotMoveAt = 0;
  }

  private startLoop(): void {
    const loop = () => {
      this.updatePlayerMovement();
      this.updateEnemies();
      this.updateAutopilot();
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  // True if `enemy` may step onto (nx, ny): walkable, not occupied by the
  // player/another enemy/a chest, and never through a still-locked door.
  // While `restrictToHome` is true (idle wandering) the step must also stay
  // inside the enemy's home room and may not enter any doorway tile at all
  // — once chasing or returning home, unlocked doors are fair game so the
  // enemy can actually leave the room instead of stopping at the threshold.
  private canEnemyStepTo(g: DungeonGrid, enemy: GridEnemy, nx: number, ny: number, restrictToHome: boolean): boolean {
    if (restrictToHome) {
      if (!enemy.home) return false;
      const { x: rx, y: ry, w: rw, h: rh } = enemy.home;
      if (nx < rx + 1 || nx > rx + rw - 2 || ny < ry + 1 || ny > ry + rh - 2) return false; // room edges are walls
    }
    if (g.tiles[ny]?.[nx] !== 'floor') return false;
    if (nx === g.playerX && ny === g.playerY) return false; // player initiates combat by stepping onto the enemy, not vice versa
    if (g.enemies.some(o => o.alive && o.id !== enemy.id && o.x === nx && o.y === ny)) return false;
    if (g.chests.some(c => !c.opened && c.x === nx && c.y === ny)) return false;

    const door = (g.doors ?? []).find(d => d.x === nx && d.y === ny);
    if (door) {
      if (isDoorLocked(g, door)) return false; // never cross a still-locked door, chasing or not
      if (restrictToHome) return false;        // idle wandering doesn't loiter in doorways
    }
    return true;
  }

  // One cardinal step from `enemy` towards (targetX, targetY), or null if
  // both the primary and fallback axis are blocked. No real pathfinding —
  // tries the axis with the larger gap first, then the other.
  private stepToward(g: DungeonGrid, enemy: GridEnemy, targetX: number, targetY: number, restrictToHome: boolean): [number, number] | null {
    const ddx = targetX - enemy.x;
    const ddy = targetY - enemy.y;
    const primary: [number, number] = Math.abs(ddx) >= Math.abs(ddy) ? [Math.sign(ddx), 0] : [0, Math.sign(ddy)];
    const secondary: [number, number] = primary[0] !== 0 ? [0, Math.sign(ddy)] : [Math.sign(ddx), 0];
    for (const [cx, cy] of [primary, secondary]) {
      if (cx === 0 && cy === 0) continue;
      const nx = enemy.x + cx, ny = enemy.y + cy;
      if (this.canEnemyStepTo(g, enemy, nx, ny, restrictToHome)) return [nx, ny];
    }
    return null;
  }

  // Lets enemies wander randomly within their home room while idle, chase
  // the player — even out of the room, through corridors — once aggro'd,
  // and path back home before resuming idle wander after giving up the
  // chase. Purely cosmetic/flavor AI; doesn't affect combat/doors (those
  // still only trigger off player movement).
  private updateEnemies(): void {
    if (S.dungeon?.phase !== 'exploring') return;
    const now = performance.now();
    if (now < this.nextEnemyMoveAt) return;
    this.nextEnemyMoveAt = now + ENEMY_MOVE_INTERVAL_MS;

    const g = S.dungeon?.grid;
    if (!g) return;

    for (const enemy of g.enemies) {
      if (!enemy.alive || !enemy.home) continue;

      const pace = movePaceFor(enemy.def.name);
      // Bosses hold their arena — they chase within it, but never step out.
      const chaseRestrictedToHome = !!enemy.isBoss;

      const dist = Math.max(Math.abs(g.playerX - enemy.x), Math.abs(g.playerY - enemy.y));
      if (this.chasing.has(enemy.id)) {
        if (dist > AGGRO_GIVE_UP_RADIUS) this.chasing.delete(enemy.id);
      } else if (dist <= AGGRO_RADIUS) {
        this.chasing.add(enemy.id);
        this.aggroFlash.set(enemy.id, now + AGGRO_FLASH_MS); // just spotted the player — flash a marker
      }

      let step: [number, number] | null;
      if (this.chasing.has(enemy.id)) {
        if (Math.random() > Math.min(1, AGGRO_MOVE_CHANCE * pace)) continue;

        // Cardinally adjacent to the player? Attack instead of trying (and
        // failing) to step onto their tile — the enemy can open the fight
        // too, not just the player.
        const ddx = g.playerX - enemy.x, ddy = g.playerY - enemy.y;
        const adjacentToPlayer = (ddx === 0 && Math.abs(ddy) === 1) || (ddy === 0 && Math.abs(ddx) === 1);
        if (adjacentToPlayer) {
          this.onFightEnemy?.(enemy.id);
          return; // phase just left 'exploring' — stop processing this tick
        }

        step = this.stepToward(g, enemy, g.playerX, g.playerY, chaseRestrictedToHome);
      } else {
        const { x: rx, y: ry, w: rw, h: rh } = enemy.home;
        const inHome = enemy.x >= rx + 1 && enemy.x <= rx + rw - 2 && enemy.y >= ry + 1 && enemy.y <= ry + rh - 2;
        if (!inHome) {
          // Gave up the chase away from home — head back before wandering again.
          if (Math.random() > Math.min(1, AGGRO_MOVE_CHANCE * pace)) continue;
          step = this.stepToward(g, enemy, rx + Math.floor(rw / 2), ry + Math.floor(rh / 2), false);
        } else {
          if (Math.random() > Math.min(1, ENEMY_MOVE_CHANCE * pace)) continue;
          const [wx, wy] = WANDER_DIRS[Math.floor(Math.random() * WANDER_DIRS.length)];
          const nx = enemy.x + wx, ny = enemy.y + wy;
          step = this.canEnemyStepTo(g, enemy, nx, ny, true) ? [nx, ny] : null;
        }
      }
      if (!step) continue;

      const [nx, ny] = step;
      this.enemyAnims.set(enemy.id, { fromX: enemy.x, fromY: enemy.y, toX: nx, toY: ny, startedAt: now, duration: ENEMY_MOVE_ANIM_MS });
      enemy.x = nx;
      enemy.y = ny;
    }
  }

  // Auto-Pilot (Prestige-Upgrade 'autopilot'): drives the player toward the
  // nearest alive enemy, else the nearest unopened chest, else the exit —
  // combat/doors/loot all still go through the exact same hooks a manual
  // step would use, so nothing about those systems changes.
  private updateAutopilot(): void {
    if (!S.dungeonAutopilot || (S.prestigeUpgrades['autopilot'] ?? 0) <= 0) return;
    const d = S.dungeon;
    if (!d) return;

    if (d.phase === 'loot') {
      this.onCollectLoot?.();
      return;
    }
    if (d.phase !== 'exploring') return; // fighting/victory/defeat: nothing to navigate

    const now = performance.now();
    if (now < this.nextAutopilotMoveAt) return;

    const g = d.grid;
    if (!g) return;

    const dist = this.bfsDistances(g);
    const target = this.findAutopilotTarget(g, dist);
    if (!target) return;
    const step = this.bfsStepToward(g, dist, target);
    if (!step) return;

    this.nextAutopilotMoveAt = now + AUTOPILOT_MOVE_ANIM_MS;
    this.resolveStep(step[0], step[1], AUTOPILOT_MOVE_ANIM_MS, now);
  }

  // Picks the nearest target by priority — enemies first (clearing the room
  // that's gating the door), then chests, then the exit — using a BFS
  // distance map that's already been flood-filled out from the player over
  // walkable floor tiles (never through a still-locked door, same constraint
  // the player's own movement obeys).
  private findAutopilotTarget(g: DungeonGrid, dist: number[][]): { x: number; y: number } | null {
    const nearest = (candidates: { x: number; y: number }[]): { x: number; y: number } | null => {
      let best: { x: number; y: number } | null = null;
      let bestDist = Infinity;
      for (const c of candidates) {
        const dd = dist[c.y]?.[c.x] ?? -1;
        if (dd >= 0 && dd < bestDist) { bestDist = dd; best = c; }
      }
      return best;
    };

    const enemyTarget = nearest(g.enemies.filter(e => e.alive).map(e => ({ x: e.x, y: e.y })));
    if (enemyTarget) return enemyTarget;

    const chestTarget = nearest(g.chests.filter(c => !c.opened).map(c => ({ x: c.x, y: c.y })));
    if (chestTarget) return chestTarget;

    if (g.exitX >= 0 && (dist[g.exitY]?.[g.exitX] ?? -1) >= 0) return { x: g.exitX, y: g.exitY };
    return null;
  }

  // BFS distance map from the player's current tile, walkable = floor tiles
  // that aren't behind a still-locked door. -1 means unreached/unreachable.
  private bfsDistances(g: DungeonGrid): number[][] {
    const dist: number[][] = Array.from({ length: g.height }, () => new Array(g.width).fill(-1));
    dist[g.playerY][g.playerX] = 0;
    const queue: [number, number][] = [[g.playerX, g.playerY]];
    let qi = 0;
    while (qi < queue.length) {
      const [x, y] = queue[qi++];
      for (const [dx, dy] of WANDER_DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= g.width || ny < 0 || ny >= g.height) continue;
        if (dist[ny][nx] !== -1) continue;
        if (g.tiles[ny]?.[nx] !== 'floor') continue;
        const door = (g.doors ?? []).find(dr => dr.x === nx && dr.y === ny);
        if (door && isDoorLocked(g, door)) continue;
        dist[ny][nx] = dist[y][x] + 1;
        queue.push([nx, ny]);
      }
    }
    return dist;
  }

  // Backtracks the BFS distance map from `target` to the player to find the
  // first step direction — no full path is stored, just parent distances,
  // so this walks downhill one tile at a time until it's adjacent to the
  // player's own tile.
  private bfsStepToward(g: DungeonGrid, dist: number[][], target: { x: number; y: number }): [number, number] | null {
    if ((dist[target.y]?.[target.x] ?? -1) < 0) return null;

    let cx = target.x, cy = target.y;
    while (dist[cy][cx] > 1) {
      let stepped = false;
      for (const [dx, dy] of WANDER_DIRS) {
        const px = cx - dx, py = cy - dy;
        if (dist[py]?.[px] === dist[cy][cx] - 1) {
          cx = px; cy = py;
          stepped = true;
          break;
        }
      }
      if (!stepped) return null;
    }
    return [cx - g.playerX, cy - g.playerY];
  }

  private updateCamera(px: number, py: number, gw: number, gh: number): void {
    this.camX = Math.max(0, Math.min(px - Math.floor(VIEW_W / 2), gw - VIEW_W));
    this.camY = Math.max(0, Math.min(py - Math.floor(VIEW_H / 2), gh - VIEW_H));
  }

  private drawTile(idx: number, drawX: number, drawY: number): void {
    if (!this.sheetReady) return;
    const sx = (idx % COLS) * PITCH;
    const sy = Math.floor(idx / COLS) * PITCH;
    this.ctx.drawImage(this.sheet, sx, sy, TILE_SRC, TILE_SRC, drawX, drawY, TILE_DST, TILE_DST);
  }

  private drawLockedDoor(x: number, y: number): void {
    this.drawTile(TILE.DOOR_LOCKED, x, y);
  }

  render(): void {
    const g = S.dungeon?.grid;

    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!g || !this.sheetReady) return;

    const animNow = performance.now();
    let drawPlayerX = g.playerX, drawPlayerY = g.playerY;
    if (this.playerAnim) {
      const t = (animNow - this.playerAnim.startedAt) / this.playerAnim.duration;
      if (t >= 1) this.playerAnim = null;
      else {
        drawPlayerX = this.playerAnim.fromX + (this.playerAnim.toX - this.playerAnim.fromX) * t;
        drawPlayerY = this.playerAnim.fromY + (this.playerAnim.toY - this.playerAnim.fromY) * t;
      }
    }
    this.updateCamera(drawPlayerX, drawPlayerY, g.width, g.height); // camera tracks the (interpolated) player, so it glides too

    const { camX, camY } = this;

    // ── Terrain layer ──────────────────────────────────────────────────────
    // camX/camY can be fractional while the camera glides with the player,
    // but g.visited/g.tiles are indexed by whole tiles — loop over integer
    // tile coordinates and only use the fractional camera for the pixel
    // offset, otherwise every lookup misses and the floor/walls vanish.
    const camXInt = Math.floor(camX);
    const camYInt = Math.floor(camY);
    for (let ty = camYInt; ty <= camYInt + VIEW_H; ty++) {
      for (let tx = camXInt; tx <= camXInt + VIEW_W; tx++) {
        if (!g.visited[ty]?.[tx]) continue; // fog of war

        const drawX = (tx - camX) * TILE_DST;
        const drawY = (ty - camY) * TILE_DST;
        const tile = g.tiles[ty]?.[tx] ?? 'void';

        if (tile === 'floor') this.drawTile(floorTileFor(tx, ty), drawX, drawY);
        else if (tile === 'wall') this.drawTile(TILE.WALL, drawX, drawY);
      }
    }

    // ── Exit staircase ─────────────────────────────────────────────────────
    if (g.exitX >= 0 && g.visited[g.exitY]?.[g.exitX]) {
      const ex = g.exitX, ey = g.exitY;
      if (ex >= camX && ex < camX + VIEW_W && ey >= camY && ey < camY + VIEW_H) {
        this.drawTile(TILE.EXIT, (ex - camX) * TILE_DST, (ey - camY) * TILE_DST);
      }
    }

    // ── Doors (only drawn while locked — unlocked doors look like floor) ────
    for (const door of g.doors ?? []) {
      if (!g.visited[door.y]?.[door.x]) continue;
      if (!isDoorLocked(g, door)) continue;
      const { x: dx, y: dy } = door;
      if (dx >= camX && dx < camX + VIEW_W && dy >= camY && dy < camY + VIEW_H) {
        this.drawLockedDoor((dx - camX) * TILE_DST, (dy - camY) * TILE_DST);
      }
    }

    // ── Chests ────────────────────────────────────────────────────────────
    for (const chest of g.chests) {
      if (chest.opened) continue;
      const { x: cx, y: cy } = chest;
      if (!g.visited[cy]?.[cx]) continue;
      if (cx >= camX && cx < camX + VIEW_W && cy >= camY && cy < camY + VIEW_H) {
        this.drawTile(TILE.CHEST, (cx - camX) * TILE_DST, (cy - camY) * TILE_DST);
      }
    }

    // ── Enemies ───────────────────────────────────────────────────────────
    for (const enemy of g.enemies) {
      if (!enemy.alive) continue;
      const { x: ex, y: ey } = enemy;
      if (!g.visited[ey]?.[ex]) continue;

      let drawTileX = ex, drawTileY = ey;
      const anim = this.enemyAnims.get(enemy.id);
      if (anim) {
        const t = (animNow - anim.startedAt) / ENEMY_MOVE_ANIM_MS;
        if (t >= 1) this.enemyAnims.delete(enemy.id);
        else {
          drawTileX = anim.fromX + (anim.toX - anim.fromX) * t;
          drawTileY = anim.fromY + (anim.toY - anim.fromY) * t;
        }
      }

      if (ex >= camX && ex < camX + VIEW_W && ey >= camY && ey < camY + VIEW_H) {
        const tileIdx = ENEMY_TILE[enemy.def.name] ?? 96;
        const drawX = (drawTileX - camX) * TILE_DST;
        const drawY = (drawTileY - camY) * TILE_DST;
        this.drawTile(tileIdx, drawX, drawY);

        // "Spotted you" marker — briefly shown the moment this enemy starts chasing.
        const flashUntil = this.aggroFlash.get(enemy.id);
        if (flashUntil !== undefined) {
          if (animNow >= flashUntil) this.aggroFlash.delete(enemy.id);
          else {
            this.ctx.fillStyle = '#ff3b3b';
            this.ctx.font = 'bold 18px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('!', drawX + TILE_DST / 2, drawY - 4);
            this.ctx.textAlign = 'left';
          }
        }
      }
    }

    // ── Player ────────────────────────────────────────────────────────────
    if (drawPlayerX >= camX && drawPlayerX < camX + VIEW_W && drawPlayerY >= camY && drawPlayerY < camY + VIEW_H) {
      this.drawTile(TILE.PLAYER, (drawPlayerX - camX) * TILE_DST, (drawPlayerY - camY) * TILE_DST);
    }

    // ── HUD: floor indicator ───────────────────────────────────────────────
    this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
    this.ctx.fillRect(4, 4, 110, 20);
    this.ctx.fillStyle = '#ffe066';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`Etage ${g.floor} / ${g.totalFloors}`, 8, 18);

    // ── Locked-door bump flash ───────────────────────────────────────────
    if (performance.now() < this.doorFlashUntil) {
      this.ctx.fillStyle = 'rgba(220,40,40,0.18)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
      this.ctx.fillRect(0, this.canvas.height - 22, this.canvas.width, 22);
      this.ctx.fillStyle = '#ffd166';
      this.ctx.font = '12px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🔒 Erst alle Gegner im Raum besiegen!', this.canvas.width / 2, this.canvas.height - 7);
      this.ctx.textAlign = 'left';
    }
  }

  // Records which movement keys are currently held — actual stepping happens
  // once per frame in updatePlayerMovement(), not here. Driving movement off
  // the OS's keydown auto-repeat (as before) felt off: the browser waits
  // ~400-500ms before repeating, then fires much faster than our move
  // animation — so holding a key produced one instant step, a stutter, then
  // a burst. Polling held keys in the render loop makes every step land
  // exactly PLAYER_MOVE_ANIM_MS apart from the first one.
  private handleKeyDown(e: KeyboardEvent): void {
    if (S.dungeon?.phase !== 'exploring') return;
    if (S.dungeonAutopilot && (S.prestigeUpgrades['autopilot'] ?? 0) > 0) return; // Auto-Pilot has the wheel
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key.toLowerCase();
    const move = MOVE_MAP[key];
    if (!move) return;

    // Prevent page scroll on arrow keys
    if (e.key.startsWith('Arrow')) e.preventDefault();

    // Ignore the OS's auto-repeated keydowns for an already-held key — only
    // a genuinely new press should (re-)establish its place in press order.
    if (!this.heldKeys.has(key)) this.heldKeys.set(key, move);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.heldKeys.delete(e.key.toLowerCase());
  }

  private updatePlayerMovement(): void {
    if (S.dungeon?.phase !== 'exploring') return;
    if (S.dungeonAutopilot && (S.prestigeUpgrades['autopilot'] ?? 0) > 0) return; // Auto-Pilot has the wheel
    if (this.heldKeys.size === 0) return;

    const now = performance.now();
    if (now < this.nextPlayerMoveAt) return;
    this.nextPlayerMoveAt = now + PLAYER_MOVE_ANIM_MS;

    // Map iteration order = press order, so the last entry is the most
    // recently pressed key that's still held — lets the player redirect
    // smoothly mid-hold instead of being stuck on an older held key.
    let move: [number, number] | undefined;
    for (const v of this.heldKeys.values()) move = v;
    if (move) this.resolveStep(move[0], move[1], PLAYER_MOVE_ANIM_MS, now);
  }

  // Door/enemy/chest/exit resolution shared between manual (WASD) and
  // Auto-Pilot movement — only the throttle interval and slide duration
  // differ between the two callers.
  private resolveStep(dx: number, dy: number, durationMs: number, now: number): void {
    const g = S.dungeon?.grid;
    if (!g) return;

    const nx = g.playerX + dx;
    const ny = g.playerY + dy;

    if (nx < 0 || nx >= g.width || ny < 0 || ny >= g.height) return;
    if (g.tiles[ny]?.[nx] !== 'floor') return;

    // Locked door on target tile? Block passage until the room behind is cleared.
    const door = (g.doors ?? []).find(d => d.x === nx && d.y === ny);
    if (door && isDoorLocked(g, door)) {
      this.doorFlashUntil = performance.now() + 250;
      return;
    }

    // Enemy on target tile?
    const enemy = g.enemies.find(e => e.alive && e.x === nx && e.y === ny);
    if (enemy) {
      this.onFightEnemy?.(enemy.id);
      return;
    }

    // Chest on target tile?
    const chest = g.chests.find(c => !c.opened && c.x === nx && c.y === ny);
    if (chest) {
      this.onOpenChest?.(chest.id);
      return;
    }

    // Exit staircase?
    if (nx === g.exitX && ny === g.exitY) {
      this.onNextFloor?.();
      return;
    }

    // Move
    this.playerAnim = { fromX: g.playerX, fromY: g.playerY, toX: nx, toY: ny, startedAt: now, duration: durationMs };
    g.playerX = nx;
    g.playerY = ny;
    revealRadius(g.visited, nx, ny, 6);
  }
}
