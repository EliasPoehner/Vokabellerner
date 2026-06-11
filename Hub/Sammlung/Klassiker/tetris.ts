'use strict';

// ════════════════════════════════════════════════
// TETRIS  — requestAnimationFrame + delta-time
// ════════════════════════════════════════════════

// Globals defined in Klassiker.html inline script
declare let activeGame: string;
declare function getCanvasBg(): string;
declare function popHud(id: string): void;

interface Piece {
  shape: number[][];
  color: string;
  x: number;
  y: number;
}

interface PieceDef {
  shape: number[][];
  color: string;
}

type Board = (string | 0)[][];

const TW = 10, TH = 20, BS = 20;
const PIECES: PieceDef[] = [
  { shape: [[1, 1, 1, 1]], color: '#00f5ff' },
  { shape: [[1, 1], [1, 1]], color: '#ffe600' },
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#bc13fe' },
  { shape: [[1, 0, 0], [1, 1, 1]], color: '#ff6b35' },
  { shape: [[0, 0, 1], [1, 1, 1]], color: '#1e90ff' },
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#39ff14' },
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#ff006e' },
];
const KICKS_NORM: [number, number][] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]];
const KICKS_I: [number, number][] = [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]];
const PTS = [0, 100, 300, 500, 800];
const DAS_DELAY = 160, DAS_REPEAT = 45;

// Level 1=800ms, 2=580, 3=420, 5=220, 8=90, 10+=48ms
function levelSpeed(lvl: number): number { return Math.max(48, 800 * Math.pow(0.73, lvl - 1)); }

let tBoard: Board;
let tPiece: Piece | null;
let tNext: Piece;
let tBag: number[] | null;
let tScore: number, tLevel: number, tLines: number;
let tRunning = false, tRafId = 0, tLastTime = 0, tAccum = 0;
let tSoftDrop = false, tLockTimer = 0;
let tCanvas: HTMLCanvasElement, tCtx: CanvasRenderingContext2D, tNextCtx: CanvasRenderingContext2D;
let tKeys: Record<string, boolean> = {};
let dasLeft = 0, dasRight = 0;

// ── Modus / Perks / Events ────────────────────
let tMode = 'klassisch'; // 'klassisch'|'blitz'|'sprint'|'ueberleben'|'unsichtbar'
let tPerkGhost = true, tPerkHold = false, tPerkPreview3 = false, tPerkSoftLock = false;
let tEventsEnabled = false;
const tEventPool = ['erdbeben', 'zeitlupe', 'farbchaos', 'muellregen', 'dunkelheit', 'formwechsel'];
let tHold: PieceDef | null = null, tHoldUsed = false, tHoldCtx: CanvasRenderingContext2D | null = null;
let tPreviewCtxs: (CanvasRenderingContext2D | null)[] = [], tBagQueue: number[] = [];
let tBlitzTimeLeft = 120000, tSprintStart = 0, tSprintTime = 0;
let tEventShakeEnd = 0, tEventZeitlupeEnd = 0, tEventFarbchaosEnd = 0, tEventDunkelheitEnd = 0;
let tEventColors: string | null = null, tCanvasWrap: HTMLElement | null = null;
let tNextEventIn = Infinity;
const EVENT_MIN = 15000, EVENT_MAX = 30000;
let tHiScore = 0;

function tLoadHiScore(): void {
  try { tHiScore = parseInt(localStorage.getItem('tetris-hi-' + tMode) ?? '0') || 0; } catch { tHiScore = 0; }
  const el = document.getElementById('tetris-hiscore');
  if (el) el.textContent = String(tHiScore);
}

function tSaveHiScore(): boolean {
  if (tScore <= tHiScore) return false;
  tHiScore = tScore;
  try { localStorage.setItem('tetris-hi-' + tMode, String(tHiScore)); } catch {}
  const el = document.getElementById('tetris-hiscore');
  if (el) el.textContent = String(tHiScore);
  return true;
}

// ── Bag / Queue ───────────────────────────────

function makeBag(): number[] {
  const b = [...PIECES.keys()];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function tEnsureQueue(): void {
  while (tBagQueue.length < 4) tBagQueue.push(...makeBag());
}

function nextFromBag(): Piece {
  tEnsureQueue();
  const idx = tBagQueue.shift()!;
  const p = PIECES[idx];
  return {
    shape: p.shape.map(r => [...r]), color: p.color,
    x: Math.floor(TW / 2) - Math.floor(p.shape[0].length / 2), y: 0,
  };
}

// ── Init ──────────────────────────────────────

function initTetris(): void {
  tCanvas = document.getElementById('tetris-canvas') as HTMLCanvasElement;
  tCtx = tCanvas.getContext('2d')!;
  tNextCtx = (document.getElementById('next-canvas') as HTMLCanvasElement).getContext('2d')!;
  tCanvasWrap = document.getElementById('tetris-canvas-wrap');

  const holdCvs = document.getElementById('hold-canvas') as HTMLCanvasElement | null;
  tHoldCtx = holdCvs ? holdCvs.getContext('2d') : null;

  const p2 = document.getElementById('next-canvas-2') as HTMLCanvasElement | null;
  const p3 = document.getElementById('next-canvas-3') as HTMLCanvasElement | null;
  tPreviewCtxs = [tNextCtx, p2 ? p2.getContext('2d') : null, p3 ? p3.getContext('2d') : null];

  cancelAnimationFrame(tRafId);
  tRunning = false;

  const startBtn = document.getElementById('tetris-start-btn');
  if (startBtn) startBtn.textContent = 'Start';
  const overlay = document.getElementById('tetris-overlay');
  if (overlay) overlay.style.display = 'none';

  tLoadHiScore();
  tBoard = Array.from({ length: TH }, () => Array(TW).fill(0)) as Board;
  tScore = 0; tLevel = 1; tLines = 0;
  tBag = null; tBagQueue = []; tEnsureQueue();
  tNext = nextFromBag(); tPiece = null;
  tHold = null; tHoldUsed = false;
  tKeys = {}; dasLeft = 0; dasRight = 0; tAccum = 0; tSoftDrop = false; tLockTimer = 0;

  tBlitzTimeLeft = 120000;
  tSprintStart = 0; tSprintTime = 0;

  tEventShakeEnd = 0; tEventZeitlupeEnd = 0; tEventFarbchaosEnd = 0; tEventDunkelheitEnd = 0;
  tEventColors = null;
  tNextEventIn = tEventsEnabled ? (EVENT_MIN + Math.random() * (EVENT_MAX - EVENT_MIN)) : Infinity;

  if (tMode === 'ueberleben') tAddGarbageRows(4);
  if (tMode === 'unsichtbar') tPerkGhost = false;

  tUpdateHoldVisibility();
  tUpdatePreviewVisibility();
  tUpdateTimerBar();
  updateTetrisHUD();
  drawTetris();
  drawNextPiece();
}

// ── Spawn / Collide / Rotate ──────────────────

function tSpawn(): void {
  tPiece = { ...tNext, shape: tNext.shape.map(r => [...r]) };
  tNext = nextFromBag(); tLockTimer = 0;
  tHoldUsed = false;
  drawNextPiece();
  if (tCollides(tPiece, 0, 0)) tShowGameOver(false);
}

function tCollides(piece: Piece, dx: number, dy: number, shape?: number[][]): boolean {
  const s = shape ?? piece.shape;
  for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) {
    if (!s[r][c]) continue;
    const nx = piece.x + c + dx, ny = piece.y + r + dy;
    if (nx < 0 || nx >= TW || ny >= TH) return true;
    if (ny >= 0 && tBoard[ny][nx]) return true;
  }
  return false;
}

function tRotShape(s: number[][]): number[][] {
  return s[0].map((_, i) => s.map(r => r[i]).reverse());
}

function tryRotate(piece: Piece): boolean {
  const rot = tRotShape(piece.shape);
  const isI = rot.length === 1 || rot[0].length === 4;
  for (const [kx, ky] of (isI ? KICKS_I : KICKS_NORM)) {
    if (!tCollides(piece, kx, ky, rot)) { piece.shape = rot; piece.x += kx; piece.y += ky; return true; }
  }
  return false;
}

// ── Lock ──────────────────────────────────────

function tLock(): void {
  const now = performance.now();
  const farbchaosActive = tEventFarbchaosEnd > now;

  tPiece!.shape.forEach((row, r) => row.forEach((v, c) => {
    if (v && tPiece!.y + r >= 0) {
      const color = (farbchaosActive && tEventColors) ? tEventColors : tPiece!.color;
      tBoard[tPiece!.y + r][tPiece!.x + c] = color;
    }
  }));

  let cleared = 0;
  for (let r = TH - 1; r >= 0; r--) {
    if ((tBoard[r] as (string | 0)[]).every(v => v)) {
      tBoard.splice(r, 1);
      tBoard.unshift(Array(TW).fill(0) as (string | 0)[]);
      cleared++; r++;
    }
  }

  const gain = (PTS[cleared] ?? 0) * (tMode === 'blitz' ? 1 : tLevel);
  if (gain) { tScore += gain; popHud('tetris-score'); }

  tLines += cleared;

  if (tMode !== 'blitz') {
    const prevLvl = tLevel;
    tLevel = Math.floor(tLines / 10) + 1;
    if (tLevel !== prevLvl) {
      popHud('tetris-level');
      const flash = document.createElement('div');
      flash.className = 'level-flash';
      flash.innerHTML = `<span>LEVEL ${tLevel}!</span>`;
      document.getElementById('screen-tetris')!.appendChild(flash);
      setTimeout(() => flash.remove(), 1300);
    }
  }

  if (tMode === 'sprint' && tLines >= 40) {
    tSprintTime = performance.now() - tSprintStart;
    tShowGameOver(true);
    return;
  }

  updateTetrisHUD();
  tPiece = null; tAccum = 0; tLockTimer = 0;
  tSpawn();
}

// ── Toggle / Loop ─────────────────────────────

function tetrisToggle(): void {
  if (!tRunning) {
    tRunning = true;
    const startBtn = document.getElementById('tetris-start-btn');
    if (startBtn) startBtn.textContent = 'Pause';
    if (!tPiece) { tSpawn(); if (tMode === 'sprint') tSprintStart = performance.now(); }
    tLastTime = performance.now();
    tRafId = requestAnimationFrame(tetrisLoop);
  } else {
    tRunning = false; cancelAnimationFrame(tRafId);
    const startBtn = document.getElementById('tetris-start-btn');
    if (startBtn) startBtn.textContent = 'Weiter';
  }
}

function tetrisLoop(now: number): void {
  if (!tRunning) return;
  const dt = Math.min(now - tLastTime, 100);
  tLastTime = now;

  if (tMode === 'blitz') {
    tBlitzTimeLeft -= dt;
    tUpdateBlitzHUD();
    if (tBlitzTimeLeft <= 0) { tShowGameOver(false); return; }
  }

  if (tMode === 'sprint') {
    tUpdateSprintHUD();
  }

  if (tEventsEnabled) tickEvents(dt, now);

  const zeitlupeActive = tEventZeitlupeEnd > now;
  const speedMod = zeitlupeActive ? 0.5 : 1;
  const normalSpeed = levelSpeed(tLevel) / speedMod;
  const speed = tSoftDrop ? Math.max(50, normalSpeed / 10) : normalSpeed;
  const lockLimit = tPerkSoftLock ? 1000 : 500;

  tAccum += dt;
  if (tAccum >= speed && tPiece) {
    tAccum -= speed;
    if (!tCollides(tPiece, 0, 1)) {
      tPiece.y++;
      tLockTimer = 0;
    } else {
      tLockTimer += speed;
      if (tLockTimer >= lockLimit) tLock();
    }
  }

  if (tPiece) {
    if (tKeys['ArrowLeft'] || tKeys['a']) {
      dasLeft += dt;
      if (dasLeft >= DAS_DELAY && Math.floor((dasLeft - DAS_DELAY) / DAS_REPEAT) > Math.floor((dasLeft - DAS_DELAY - dt) / DAS_REPEAT))
        if (!tCollides(tPiece, -1, 0)) { tPiece.x--; tLockTimer = 0; }
    } else dasLeft = 0;
    if (tKeys['ArrowRight'] || tKeys['d']) {
      dasRight += dt;
      if (dasRight >= DAS_DELAY && Math.floor((dasRight - DAS_DELAY) / DAS_REPEAT) > Math.floor((dasRight - DAS_DELAY - dt) / DAS_REPEAT))
        if (!tCollides(tPiece, 1, 0)) { tPiece.x++; tLockTimer = 0; }
    } else dasRight = 0;
  }

  drawTetris();
  tRafId = requestAnimationFrame(tetrisLoop);
}

// ── Ghost / Draw ──────────────────────────────

function ghostRow(): number {
  if (!tPiece) return 0;
  let gy = tPiece.y;
  while (!tCollides(tPiece, 0, gy - tPiece.y + 1)) gy++;
  return gy;
}

function drawTetris(): void {
  const ctx = tCtx;
  const now = performance.now();
  ctx.fillStyle = getCanvasBg(); ctx.fillRect(0, 0, tCanvas.width, tCanvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  for (let r = 0; r < TH; r++) for (let c = 0; c < TW; c++) ctx.strokeRect(c * BS, r * BS, BS, BS);

  const dunkelheit = tEventDunkelheitEnd > now;
  const prevAlpha = ctx.globalAlpha;
  if (dunkelheit) ctx.globalAlpha = 0.15;

  const invisible = tMode === 'unsichtbar';
  for (let r = 0; r < TH; r++) for (let c = 0; c < TW; c++) {
    if (tBoard[r][c]) {
      if (invisible) {
        ctx.strokeStyle = tBoard[r][c] as string;
        ctx.lineWidth = 1;
        ctx.strokeRect(c * BS + 1, r * BS + 1, BS - 2, BS - 2);
      } else {
        drawBlock(ctx, c, r, tBoard[r][c] as string);
      }
    }
  }

  if (dunkelheit) ctx.globalAlpha = prevAlpha;

  if (tPiece && tRunning) {
    if (tPerkGhost && !invisible) {
      const gy = ghostRow();
      tPiece.shape.forEach((row, r) => row.forEach((v, c) => {
        if (v) {
          ctx.fillStyle = tPiece!.color + '28';
          ctx.fillRect((tPiece!.x + c) * BS + 1, (gy + r) * BS + 1, BS - 2, BS - 2);
        }
      }));
    }
    const drawColor = (tEventFarbchaosEnd > now && tEventColors) ? tEventColors : tPiece.color;
    tPiece.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) drawBlock(ctx, tPiece!.x + c, tPiece!.y + r, drawColor);
    }));
  }
}

function _drawPieceOnCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, piece: PieceDef | null): void {
  ctx.fillStyle = getCanvasBg(); ctx.fillRect(0, 0, w, h);
  if (!piece) return;
  const bs = 16, s = piece.shape;
  const ox = Math.floor((4 - s[0].length) / 2) * bs + 6;
  const oy = Math.floor((4 - s.length) / 2) * bs + 6;
  s.forEach((row, r) => row.forEach((v, c) => {
    if (v) {
      ctx.fillStyle = piece.color; ctx.fillRect(ox + c * bs + 1, oy + r * bs + 1, bs - 2, bs - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(ox + c * bs + 1, oy + r * bs + 1, bs - 2, 3);
    }
  }));
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x * BS + 1, y * BS + 1, BS - 2, BS - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x * BS + 1, y * BS + 1, BS - 2, 3);
  ctx.fillRect(x * BS + 1, y * BS + 1, 3, BS - 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x * BS + 1, (y + 1) * BS - 4, BS - 2, 3);
}

function drawNextPiece(): void {
  _drawPieceOnCanvas(tPreviewCtxs[0]!, 84, 84, tNext);
  if (tPerkPreview3) {
    tEnsureQueue();
    if (tPreviewCtxs[1]) _drawPieceOnCanvas(tPreviewCtxs[1], 84, 84, PIECES[tBagQueue[0]] ? { ...PIECES[tBagQueue[0]], shape: PIECES[tBagQueue[0]].shape.map(r => [...r]) } : null);
    if (tPreviewCtxs[2]) _drawPieceOnCanvas(tPreviewCtxs[2], 84, 84, PIECES[tBagQueue[1]] ? { ...PIECES[tBagQueue[1]], shape: PIECES[tBagQueue[1]].shape.map(r => [...r]) } : null);
  }
}

function drawHoldPiece(): void {
  if (!tHoldCtx) return;
  const piece = tHold ? { ...tHold, shape: tHold.shape.map(r => [...r]) } : null;
  _drawPieceOnCanvas(tHoldCtx, 84, 84, piece);
  if (tHoldUsed && piece) {
    tHoldCtx.fillStyle = 'rgba(0,0,0,0.5)';
    tHoldCtx.fillRect(0, 0, 84, 84);
  }
}

// ── HUD / Game Over ───────────────────────────

function updateTetrisHUD(): void {
  document.getElementById('tetris-score')!.textContent = String(tScore);
  document.getElementById('tetris-level')!.textContent = String(tLevel);
  const linesEl = document.getElementById('tetris-lines');
  if (linesEl) linesEl.textContent = tMode === 'sprint' ? `${tLines}/40` : String(tLines);
}

function tUpdateBlitzHUD(): void {
  const secs = Math.ceil(tBlitzTimeLeft / 1000);
  const fill = document.getElementById('tetris-timer-fill');
  const label = document.getElementById('tetris-timer-value');
  const bar = document.getElementById('tetris-timer-bar');
  if (label) label.textContent = secs + 's';
  if (fill) fill.style.width = (tBlitzTimeLeft / 120000 * 100) + '%';
  if (bar) bar.classList.toggle('danger', secs <= 20);
}

function tUpdateSprintHUD(): void {
  const elapsed = performance.now() - tSprintStart;
  const label = document.getElementById('tetris-timer-value');
  const fill = document.getElementById('tetris-timer-fill');
  if (label) label.textContent = (elapsed / 1000).toFixed(1) + 's';
  if (fill) fill.style.width = Math.min(tLines / 40 * 100, 100) + '%';
}

function tUpdateTimerBar(): void {
  const bar = document.getElementById('tetris-timer-bar');
  if (!bar) return;
  bar.style.display = (tMode === 'blitz' || tMode === 'sprint') ? 'flex' : 'none';
  const modeLabel = document.getElementById('tetris-timer-mode');
  if (modeLabel) modeLabel.textContent = tMode === 'blitz' ? '⏱ Blitz' : '🏁 Sprint';
}

function tShowGameOver(sprintWin: boolean): void {
  tRunning = false; cancelAnimationFrame(tRafId);
  const overlay = document.getElementById('tetris-overlay');
  const finalScore = document.getElementById('tetris-final-score');
  const overTime = document.getElementById('tetris-over-time');
  const newHi = document.getElementById('tetris-new-hi');
  if (finalScore) finalScore.textContent = String(tScore);
  if (overTime) {
    if (sprintWin) {
      overTime.style.display = 'block';
      overTime.textContent = 'Zeit: ' + (tSprintTime / 1000).toFixed(2) + 's';
    } else {
      overTime.style.display = 'none';
    }
  }
  const isNewHi = tSaveHiScore();
  if (newHi) newHi.style.display = isNewHi ? 'block' : 'none';
  if (overlay) overlay.style.display = 'flex';
  drawTetris();
}

// ── Hold ──────────────────────────────────────

function tDoHold(): void {
  if (!tPerkHold || !tPiece || tHoldUsed) return;
  tHoldUsed = true;
  const pieceIdx = PIECES.findIndex(p => p.color === tPiece!.color);
  const freshPiece = pieceIdx >= 0 ? PIECES[pieceIdx] : PIECES[0];
  if (!tHold) {
    tHold = { shape: freshPiece.shape.map(r => [...r]), color: freshPiece.color };
    tPiece = null; tAccum = 0; tLockTimer = 0;
    tSpawn();
  } else {
    const prev = tHold;
    tHold = { shape: freshPiece.shape.map(r => [...r]), color: freshPiece.color };
    tPiece = {
      shape: prev.shape.map(r => [...r]), color: prev.color,
      x: Math.floor(TW / 2) - Math.floor(prev.shape[0].length / 2), y: 0,
    };
    tLockTimer = 0;
  }
  drawHoldPiece();
}

// ── Garbage ───────────────────────────────────

function tAddGarbageRows(n: number): void {
  for (let i = 0; i < n; i++) {
    const gap = Math.floor(Math.random() * TW);
    const row = Array.from({ length: TW }, (_, c) => (c === gap ? 0 : '#4a4a6a')) as (string | 0)[];
    tBoard.splice(0, 1);
    tBoard.push(row);
  }
  if (tPiece && tCollides(tPiece, 0, 0)) tPiece.y--;
}

// ── Events ────────────────────────────────────

function tickEvents(dt: number, now: number): void {
  tNextEventIn -= dt;
  if (tNextEventIn <= 0) {
    const active = tEventPool.filter(e => {
      const cb = document.getElementById('evt-' + e) as HTMLInputElement | null;
      return cb ? cb.checked : true;
    });
    if (active.length > 0) triggerEvent(active[Math.floor(Math.random() * active.length)], now);
    tNextEventIn = EVENT_MIN + Math.random() * (EVENT_MAX - EVENT_MIN);
  }
  if (tCanvasWrap && tEventShakeEnd > 0 && now >= tEventShakeEnd) {
    tCanvasWrap.classList.remove('shaking'); tEventShakeEnd = 0;
  }
  if (tCanvasWrap && tEventZeitlupeEnd > 0 && now >= tEventZeitlupeEnd) {
    tCanvasWrap.classList.remove('zeitlupe'); tEventZeitlupeEnd = 0;
  }
  if (tEventFarbchaosEnd > 0 && now >= tEventFarbchaosEnd) {
    tEventFarbchaosEnd = 0; tEventColors = null;
  }
  if (tEventDunkelheitEnd > 0 && now >= tEventDunkelheitEnd) tEventDunkelheitEnd = 0;
  tHideBadge(now);
}

function triggerEvent(name: string, now: number): void {
  let duration = 0;
  if (name === 'erdbeben') {
    duration = 2000; tEventShakeEnd = now + duration;
    if (tCanvasWrap) tCanvasWrap.classList.add('shaking');
  } else if (name === 'zeitlupe') {
    duration = 5000; tEventZeitlupeEnd = now + duration;
    if (tCanvasWrap) tCanvasWrap.classList.add('zeitlupe');
  } else if (name === 'farbchaos') {
    duration = 10000; tEventFarbchaosEnd = now + duration;
    tEventColors = `hsl(${Math.floor(Math.random() * 360)},100%,60%)`;
  } else if (name === 'muellregen') {
    tAddGarbageRows(1);
  } else if (name === 'dunkelheit') {
    duration = 3000; tEventDunkelheitEnd = now + duration;
  } else if (name === 'formwechsel' && tPiece) {
    const p = PIECES[Math.floor(Math.random() * PIECES.length)];
    tPiece.shape = p.shape.map(r => [...r]);
    tPiece.color = p.color;
  }
  const badge = document.getElementById('tetris-event-badge');
  if (badge) {
    const labels: Record<string, string> = { erdbeben: '🌍 Erdbeben', zeitlupe: '🐢 Zeitlupe', farbchaos: '🎨 Farbchaos', muellregen: '🗑 Müllregen', dunkelheit: '🌑 Dunkelheit', formwechsel: '🔀 Formwechsel' };
    badge.textContent = labels[name] ?? name;
    badge.style.display = 'block';
    badge.classList.remove('pop');
    void badge.offsetWidth;
    badge.classList.add('pop');
    if (duration === 0) setTimeout(() => tHideBadge(performance.now()), 2000);
  }
}

function tHideBadge(now: number): void {
  const anyActive = tEventShakeEnd > now || tEventZeitlupeEnd > now || tEventFarbchaosEnd > now || tEventDunkelheitEnd > now;
  if (!anyActive) {
    const badge = document.getElementById('tetris-event-badge');
    if (badge) badge.style.display = 'none';
  }
}

// ── Setup Overlay ─────────────────────────────

function tSelectMode(mode: string, el: HTMLElement): void {
  tMode = mode;
  document.querySelectorAll('.mode-item').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function tetrisShowSetup(): void {
  tRunning = false; cancelAnimationFrame(tRafId);
  // Beide Overlays synchronisieren: Game-Over ausblenden, Setup einblenden
  const gameOver = document.getElementById('tetris-overlay');
  if (gameOver) gameOver.style.display = 'none';
  const setup = document.getElementById('tetris-setup-overlay');
  if (setup) setup.style.display = 'flex';
}

function tetrisStartFromSetup(): void {
  const overlay = document.getElementById('tetris-setup-overlay');
  if (overlay) overlay.style.display = 'none';

  tPerkGhost = (document.getElementById('perk-ghost') as HTMLInputElement | null)?.checked ?? true;
  tPerkHold = (document.getElementById('perk-hold') as HTMLInputElement | null)?.checked ?? false;
  tPerkPreview3 = (document.getElementById('perk-preview3') as HTMLInputElement | null)?.checked ?? false;
  tPerkSoftLock = (document.getElementById('perk-softlock') as HTMLInputElement | null)?.checked ?? false;
  tEventsEnabled = (document.getElementById('events-master') as HTMLInputElement | null)?.checked ?? false;

  initTetris();
  tetrisToggle();
}

function tUpdateHoldVisibility(): void {
  const panel = document.getElementById('tetris-hold-panel');
  if (panel) panel.style.display = tPerkHold ? 'flex' : 'none';
}

function tUpdatePreviewVisibility(): void {
  const p2 = document.getElementById('next-canvas-2')?.parentElement;
  const p3 = document.getElementById('next-canvas-3')?.parentElement;
  if (p2) p2.style.display = tPerkPreview3 ? 'block' : 'none';
  if (p3) p3.style.display = tPerkPreview3 ? 'block' : 'none';
}

// ── Keyboard ──────────────────────────────────

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (typeof activeGame === 'undefined' || activeGame !== 'tetris') return;
  tKeys[e.key] = true;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { tetrisToggle(); return; }
  if (!tRunning || !tPiece) return;
  if (e.key === 'ArrowLeft' || e.key === 'a') { if (!tCollides(tPiece, -1, 0)) { tPiece.x--; tLockTimer = 0; dasLeft = 0; } e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'd') { if (!tCollides(tPiece, 1, 0)) { tPiece.x++; tLockTimer = 0; dasRight = 0; } e.preventDefault(); }
  if (e.key === 'ArrowDown' || e.key === 's') { if (!tSoftDrop) { tSoftDrop = true; tAccum = 0; } e.preventDefault(); }
  if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z') { tryRotate(tPiece); e.preventDefault(); }
  if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') { tDoHold(); e.preventDefault(); }
  if (e.key === ' ') {
    e.preventDefault();
    const gy = ghostRow();
    tScore += 2 * (gy - tPiece.y);
    tPiece.y = gy; tLock();
  }
  drawTetris();
});

document.addEventListener('keyup', (e: KeyboardEvent) => {
  tKeys[e.key] = false;
  if (e.key === 'ArrowDown' || e.key === 's') tSoftDrop = false;
});

// Expose to global scope for inline script and HTML onclick handlers
declare global { interface Window { initTetris: typeof initTetris; tetrisToggle: typeof tetrisToggle; tetrisShowSetup: typeof tetrisShowSetup; tetrisStartFromSetup: typeof tetrisStartFromSetup; tSelectMode: typeof tSelectMode; drawTetris: typeof drawTetris; drawNextPiece: typeof drawNextPiece; tNext: Piece; } }
window.initTetris = initTetris;
window.tetrisToggle = tetrisToggle;
window.tetrisShowSetup = tetrisShowSetup;
window.tetrisStartFromSetup = tetrisStartFromSetup;
window.tSelectMode = tSelectMode;
window.drawTetris = drawTetris;
window.drawNextPiece = drawNextPiece;
Object.defineProperty(window, 'tNext', { get: () => tNext });
