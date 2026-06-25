let loaded = false;

function ls(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function fmtMs(ms: number | null): string {
  if (!ms || ms <= 0) return '—';
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h > 0) return h + 'h ' + (m % 60) + 'm';
  if (m > 0) return m + 'm ' + (s % 60) + 's';
  return s + 's';
}

function fmt(n: unknown): string {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('de-DE');
}

function fmtSprintTime(ms: unknown): string {
  const n = Number(ms);
  if (!n || isNaN(n) || !isFinite(n) || n <= 0) return '—';
  return (n / 1000).toFixed(2) + 's';
}

function row(label: string, value: string, accent?: string): string {
  const col = accent === 'yellow' ? 'text-yellow-400'
    : accent === 'cyan' ? 'text-cyan-400'
    : accent === 'green' ? 'text-green-400'
    : accent === 'pink' ? 'text-pink-400'
    : 'text-on-surface';
  return `<div class="flex justify-between items-baseline py-1.5 border-b border-white/5 last:border-0">
    <span class="text-slate-500 text-xs">${label}</span>
    <span class="font-mono font-bold text-xs ${col}">${value}</span>
  </div>`;
}

function noData(msg?: string): string {
  return `<p class="text-slate-600 text-xs py-2">${msg ?? 'Noch kein Score gespielt'}</p>`;
}

type ClassEntry = { name: string; score: number; date: string }
type ClassHs = Record<string, ClassEntry>
type LogEntry = { score: number; date: string }
type GameLog = Record<string, LogEntry>

/** Schlusslicht: nur relevant wenn mind. 2 Personen für das Spiel geloggt sind. */
function isWorst(log: GameLog | undefined, myName: string | null, lowerIsBetter = false): boolean {
  if (!log || !myName) return false;
  const entries = Object.entries(log);
  if (entries.length < 2) return false;
  const worst = entries.reduce((w, e) => {
    const better = lowerIsBetter ? e[1].score < w[1].score : e[1].score > w[1].score;
    return better ? w : e;
  });
  return worst[0] === myName;
}

function worstBadge(show: boolean): string {
  return show ? `<div class="text-[9px] text-red-400 mt-0.5">🔻 Schlusslicht</div>` : '';
}

/** Einfaches 2-Spalten-Widget: Mein Score links, Klassenbester rechts */
function scoreWidget(myVal: number | null, cls: ClassEntry | undefined, accent = 'yellow', worst = false): string {
  const myCol = accent === 'cyan' ? 'text-cyan-400' : 'text-yellow-400';
  const myStr = myVal && myVal > 0 ? fmt(myVal) : '—';
  const clsScore = cls ? fmt(cls.score) : '—';
  const clsName = cls ? `<div class="text-slate-500 text-[10px] mt-0.5 truncate">${cls.name}</div>` : '';
  return `<div class="grid grid-cols-2 gap-sm mt-xs">
    <div class="bg-white/5 rounded-lg p-sm text-center">
      <div class="text-[9px] text-slate-600 uppercase tracking-widest mb-xs">Ich</div>
      <div class="font-mono font-bold text-sm ${myCol}">${myStr}</div>
      ${worstBadge(worst)}
    </div>
    <div class="bg-white/5 rounded-lg p-sm text-center">
      <div class="text-[9px] text-slate-600 uppercase tracking-widest mb-xs">🏆 Klasse</div>
      <div class="font-mono font-bold text-sm text-green-400">${clsScore}</div>
      ${clsName}
    </div>
  </div>`;
}

/** Tabellen-Widget für Spiele mit mehreren Modi (Tetris, Runner) */
function modeTable(modes: { label: string; myVal: number; cls: ClassEntry | undefined; isTime?: boolean; worst?: boolean }[]): string {
  const rows = modes.map(m => {
    const f = m.isTime ? fmtSprintTime : fmt;
    const my = m.myVal > 0 ? `<span class="text-yellow-400">${f(m.myVal)}</span>` : `<span class="text-slate-600">—</span>`;
    const cl = m.cls
      ? `<span class="text-green-400">${f(m.cls.score)}</span><span class="text-slate-600 text-[10px] ml-1">${m.cls.name}</span>`
      : `<span class="text-slate-600">—</span>`;
    return `<div class="contents">
      <div class="text-slate-400 text-xs py-1.5 border-b border-white/5">${m.label}</div>
      <div class="font-mono text-xs py-1.5 border-b border-white/5 text-right">${my}${m.worst ? '<div class="text-[9px] text-red-400">🔻 Schlusslicht</div>' : ''}</div>
      <div class="font-mono text-xs py-1.5 border-b border-white/5 text-right">${cl}</div>
    </div>`;
  }).join('');
  return `<div class="grid mt-xs" style="grid-template-columns:1fr auto auto;gap:0 12px;">
    <div class="text-[9px] text-slate-600 uppercase tracking-widest pb-1 border-b border-white/10">Modus</div>
    <div class="text-[9px] text-slate-600 uppercase tracking-widest pb-1 border-b border-white/10 text-right">Ich</div>
    <div class="text-[9px] text-slate-600 uppercase tracking-widest pb-1 border-b border-white/10 text-right">🏆 Klasse</div>
    ${rows}
  </div>`;
}

export function toggleStatsPanel(): void {
  const panel = document.getElementById('stats-panel');
  const chevron = document.getElementById('stats-chevron');
  if (!panel || !chevron) return;
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  chevron.style.transform = open ? 'rotate(180deg)' : '';
  if (open && !loaded) loadStatsPanel(false);
}

export async function loadStatsPanel(force: boolean): Promise<void> {
  if (!force && loaded) return;
  loaded = true;

  // Alle Daten parallel laden
  let classHs: ClassHs = {};
  let asteroidSaves: { s: number }[] = [];
  let runnerSaves: Record<string, number> = { school: 0, city: 0, office: 0 };
  let myName: string | null = null;
  const gameLogs: Record<string, GameLog> = {};

  const LOGGED_GAMES = [
    'snake', '2048', 'asteroid', 'flipautomat', 'candybox',
    'runner-school', 'runner-city', 'runner-office',
    'tetris-klassisch', 'tetris-blitz', 'tetris-sprint', 'tetris-ueberleben', 'tetris-unsichtbar',
  ];

  await Promise.allSettled([
    fetch('/api/username')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.name === 'string') myName = d.name }),
    ...LOGGED_GAMES.map(g =>
      fetch('/api/highscores/' + g + '/log')
        .then(r => r.ok ? r.json() : {})
        .then(d => { gameLogs[g] = d as GameLog })
    ),
    fetch('/api/highscores')
      .then(r => r.ok ? r.json() : {})
      .then(d => { classHs = d as ClassHs }),
    fetch('/api/saves/asteroid-hs')
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) asteroidSaves = d as { s: number }[] }),
    fetch('/api/saves/runner-hs')
      .then(r => r.ok ? r.json() : {})
      .then(d => { if (d && typeof d === 'object') runnerSaves = { ...runnerSaves, ...(d as Record<string, number>) } }),
    fetch('/api/saves/snake-hi').then(r => r.ok ? r.json() : null)
      .then(d => { if (typeof d === 'number' && d > (parseInt(ls('snake-hi') ?? '0') || 0)) { try { localStorage.setItem('snake-hi', String(d)) } catch {} } }),
    fetch('/api/saves/2048-hi').then(r => r.ok ? r.json() : null)
      .then(d => { if (typeof d === 'number' && d > (parseInt(ls('2048-hi') ?? '0') || 0)) { try { localStorage.setItem('2048-hi', String(d)) } catch {} } }),
    fetch('/api/saves/flipautomat-hi').then(r => r.ok ? r.json() : null)
      .then(d => { if (typeof d === 'number' && d > (parseInt(ls('sc_hi') ?? '0') || 0)) { try { localStorage.setItem('sc_hi', String(d)) } catch {} } }),
    ...['klassisch', 'blitz', 'sprint', 'ueberleben', 'unsichtbar'].map(m => {
      const isSprint = m === 'sprint';
      const fallback = isSprint ? Infinity : 0;
      return fetch('/api/saves/tetris-hi-' + m).then(r => r.ok ? r.json() : null)
        .then(d => {
          if (typeof d !== 'number') return;
          const local = parseFloat(ls('tetris-hi-' + m) ?? String(fallback)) || fallback;
          const isBetter = isSprint ? d < local : d > local;
          if (isBetter) { try { localStorage.setItem('tetris-hi-' + m, String(d)) } catch {} }
        });
    }),
  ]);

  // ── Tetris ────────────────────────────────────────────────────────────────
  const tmodes = [
    { id: 'klassisch', label: '🎮 Klassisch' },
    { id: 'blitz',     label: '⚡ Blitz'     },
    { id: 'sprint',    label: '🏁 Sprint'    },
    { id: 'ueberleben',label: '💀 Überleben' },
    { id: 'unsichtbar',label: '👻 Unsichtbar'},
  ];
  const spTetris = document.getElementById('sp-tetris');
  if (spTetris) spTetris.innerHTML = modeTable(tmodes.map(m => ({
    label: m.label,
    myVal: parseFloat(ls('tetris-hi-' + m.id) ?? '0') || 0,
    cls: classHs['tetris-' + m.id],
    isTime: m.id === 'sprint',
    worst: isWorst(gameLogs['tetris-' + m.id], myName, m.id === 'sprint'),
  })));

  // ── Snake ─────────────────────────────────────────────────────────────────
  const snakeHi = parseInt(ls('snake-hi') ?? '0') || 0;
  const spSnake = document.getElementById('sp-snake');
  if (spSnake) spSnake.innerHTML = scoreWidget(snakeHi, classHs['snake'], 'yellow', isWorst(gameLogs['snake'], myName));

  // ── 2048 ──────────────────────────────────────────────────────────────────
  const g2Hi = parseInt(ls('2048-hi') ?? '0') || 0;
  const sp2048 = document.getElementById('sp-2048');
  if (sp2048) sp2048.innerHTML = scoreWidget(g2Hi, classHs['2048'], 'yellow', isWorst(gameLogs['2048'], myName));

  // ── Asteroid ──────────────────────────────────────────────────────────────
  const myBest = asteroidSaves.length > 0 ? asteroidSaves[0].s : 0;
  const spAsteroid = document.getElementById('sp-asteroid');
  if (spAsteroid) spAsteroid.innerHTML = scoreWidget(myBest, classHs['asteroid'], 'cyan', isWorst(gameLogs['asteroid'], myName));

  // ── Runner ────────────────────────────────────────────────────────────────
  const spRunner = document.getElementById('sp-runner');
  if (spRunner) spRunner.innerHTML = modeTable([
    { label: '🏫 Schule', myVal: runnerSaves.school ?? 0, cls: classHs['runner-school'], worst: isWorst(gameLogs['runner-school'], myName) },
    { label: '🏙 Stadt',  myVal: runnerSaves.city   ?? 0, cls: classHs['runner-city'],   worst: isWorst(gameLogs['runner-city'], myName)   },
    { label: '🏢 Büro',   myVal: runnerSaves.office  ?? 0, cls: classHs['runner-office'], worst: isWorst(gameLogs['runner-office'], myName) },
  ]);

  // ── Flipautomat ───────────────────────────────────────────────────────────
  const flipHi = parseInt(ls('sc_hi') ?? '0') || 0;
  const spFlip = document.getElementById('sp-flipautomat');
  if (spFlip) spFlip.innerHTML = scoreWidget(flipHi, classHs['flipautomat'], 'yellow', isWorst(gameLogs['flipautomat'], myName));

  // ── CandyBox ──────────────────────────────────────────────────────────────
  const spCandybox = document.getElementById('sp-candybox');
  if (spCandybox) {
    let cb: Record<string, unknown> | null = null;
    try { const raw = ls('candybox_save_v1'); if (raw) cb = JSON.parse(raw); } catch { /* empty */ }

    if (!cb) {
      spCandybox.innerHTML = noData('Kein Spielstand — starte Candy Box zuerst.');
    } else {
      const stats = (cb.stats as Record<string, number>) ?? {};
      const quests = (cb.completedQuests as string[]) ?? [];
      const upgrades = (cb.upgrades as string[]) ?? [];
      const questIcons: Record<string, string> = { forest: '🌲', cave: '🕳', tower: '🗼', castle: '🏰' };
      const upgradeIcons: Record<string, string> = { farm: '🌾', factory: '🏭', accelerator: '⚡', candy_empire: '👑' };
      const totalProduced = Math.floor(stats.totalCandiesProduced ?? 0);

      // Score automatisch einreichen wenn Panel geöffnet wird
      if (totalProduced > 0) {
        fetch('/api/highscores/candybox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: totalProduced }) }).catch(() => {});
      }

      spCandybox.innerHTML =
        scoreWidget(totalProduced, classHs['candybox'], 'yellow', isWorst(gameLogs['candybox'], myName)) +
        `<div class="border-t border-white/10 my-sm"></div>` +
        row('🍬 Bonbons/s', fmt(cb.candyPerSec), 'yellow') +
        row('🍭 Lutscher verkauft', fmt(stats.lollipopsSold)) +
        row('⚔️ Quests gewonnen', fmt(stats.questsWon)) +
        `<div class="flex gap-2 mt-sm">` +
        `<span class="text-[10px] text-slate-600">Upgrades:</span>` +
        `<span class="text-xs">${upgrades.length > 0 ? upgrades.map(u => upgradeIcons[u] ?? '·').join(' ') : '—'}</span>` +
        `<span class="text-[10px] text-slate-600 ml-auto">Quests:</span>` +
        `<span class="text-xs">${quests.length > 0 ? quests.map(q => questIcons[q] ?? '·').join(' ') : '—'}</span>` +
        `</div>`;
    }
  }

  // ── Dorf (async) ──────────────────────────────────────────────────────────
  const spDorf = document.getElementById('sp-dorf-inner');
  if (spDorf) spDorf.innerHTML = '<p class="text-slate-600 text-xs">Lade Spielstand…</p>';
  let dorf: Record<string, unknown> | null = null;
  try { const r = await fetch('/api/saves/dorf'); if (r.ok) dorf = await r.json(); } catch { /* offline */ }
  if (!dorf) { try { const raw = ls('dorfchronik_3d_v1'); if (raw) dorf = JSON.parse(raw); } catch { /* empty */ } }

  if (!spDorf) return;
  if (!dorf) { spDorf.innerHTML = noData('Kein Spielstand — starte das Dorf-Spiel zuerst.'); return; }

  const TIERS = ['Weiler', 'Dorf', 'Stadt', 'Königreich'];
  const tier = TIERS[(dorf.tier as number) ?? 0] ?? 'Weiler';
  const playtime = fmtMs(((dorf.tick as number) ?? 0) * 100);
  const moralRaw = Math.max(0, Math.min(100, Math.round((dorf.moral as number) ?? 60)));
  const moralColor = moralRaw >= 60 ? '#4ade80' : moralRaw >= 30 ? '#facc15' : '#f87171';
  const res = (dorf.res as Record<string, number>) ?? {};
  const lager = (dorf.lager as Record<string, number>) ?? {};
  const bcount = Object.values((dorf.buildings as Record<string, unknown[]>) ?? {}).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
  const rcount = Object.values((dorf.research as Record<string, unknown>) ?? {}).filter(v => v === true || (v && (v as Record<string, unknown>).done)).length;

  const resConf = [
    { k: 'holz',    icon: '🪵', label: 'Holz',    bar: '#c87941' },
    { k: 'stein',   icon: '🪨', label: 'Stein',   bar: '#9e9e9e' },
    { k: 'nahrung', icon: '🌾', label: 'Nahrung', bar: '#4ade80' },
    { k: 'gold',    icon: '💰', label: 'Gold',    bar: '#facc15' },
    { k: 'eisen',   icon: '⚙️', label: 'Eisen',   bar: '#78909c' },
    { k: 'kohle',   icon: '🪨', label: 'Kohle',   bar: '#607d8b' },
  ];

  const resHTML = resConf.map(r => {
    const cur = Math.floor(res[r.k] ?? 0), cap = Math.floor(lager[r.k] ?? 0);
    const pct = cap > 0 ? Math.min(100, cur / cap * 100).toFixed(0) : 0;
    return `<div>
      <div class="flex justify-between mb-0.5">
        <span class="text-slate-500 text-[10px]">${r.icon} ${r.label}</span>
        <span class="text-slate-400 text-[10px] font-mono">${fmt(cur)}<span class="text-slate-600"> / ${fmt(cap)}</span></span>
      </div>
      <div class="h-1 rounded-full bg-white/5 overflow-hidden">
        <div class="h-full rounded-full" style="width:${pct}%;background:${r.bar};"></div>
      </div>
    </div>`;
  }).join('');

  spDorf.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-lg gap-y-0 mb-md">
      ${row('Tag', fmt(dorf.day), 'cyan')}
      ${row('Spielzeit', playtime)}
      ${row('Tier', tier)}
      ${row('Prestige', fmt(dorf.prestige), 'pink')}
      ${row('Bevölkerung', fmt(dorf.pop) + ' / ' + fmt(dorf.popMax), 'green')}
      ${row('Gebäude', fmt(bcount))}
      ${row('Forschungen', fmt(rcount))}
      ${row('Ticks', fmt(dorf.tick))}
    </div>
    <div class="flex items-center gap-2 mb-md">
      <span class="text-slate-500 text-xs flex-shrink-0">Moral</span>
      <div class="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div class="h-full rounded-full transition-all" style="width:${moralRaw}%;background:${moralColor};box-shadow:0 0 6px ${moralColor};"></div>
      </div>
      <span class="text-xs font-bold font-mono" style="color:${moralColor};">${moralRaw}%</span>
    </div>
    <p class="text-slate-600 text-[10px] uppercase tracking-widest mb-2">Ressourcen</p>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-lg gap-y-3">${resHTML}</div>
  `;

  const lastUpdate = document.getElementById('stats-last-update');
  if (lastUpdate) lastUpdate.textContent = 'Zuletzt: ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
