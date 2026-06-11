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

  // Tetris
  const tmodes: [string, string][] = [
    ['klassisch', '🎮 Klassisch'], ['blitz', '⚡ Blitz'], ['sprint', '🏁 Sprint'],
    ['ueberleben', '💀 Überleben'], ['unsichtbar', '👻 Unsichtbar'],
  ];
  const tRows = tmodes.map(([id, lbl]) => {
    const hi = parseInt(ls('tetris-hi-' + id) ?? '0') || 0;
    return row(lbl, hi > 0 ? fmt(hi) : '—', hi > 0 ? 'yellow' : undefined);
  }).join('');
  const spTetris = document.getElementById('sp-tetris');
  if (spTetris) spTetris.innerHTML = tRows;

  // Snake
  const snakeHi = parseInt(ls('snake-hi') ?? '0') || 0;
  const spSnake = document.getElementById('sp-snake');
  if (spSnake) spSnake.innerHTML = snakeHi > 0 ? row('Highscore', fmt(snakeHi), 'yellow') : noData();

  // 2048
  const g2Hi = parseInt(ls('2048-hi') ?? '0') || 0;
  const sp2048 = document.getElementById('sp-2048');
  if (sp2048) sp2048.innerHTML = g2Hi > 0 ? row('Highscore', fmt(g2Hi), 'yellow') : noData();

  // Asteroid
  let asteroidScores: { s: number }[] = [];
  try { asteroidScores = JSON.parse(ls('ab_hs') ?? '[]'); } catch { /* empty */ }
  const spAsteroid = document.getElementById('sp-asteroid');
  if (spAsteroid) spAsteroid.innerHTML = asteroidScores.length
    ? asteroidScores.slice(0, 5).map((e, i) => row('#' + (i + 1), fmt(e.s), i === 0 ? 'cyan' : 'yellow')).join('')
    : noData();

  // Runner
  let runnerData: Record<string, number> = { school: 0, city: 0, office: 0 };
  try { runnerData = { ...runnerData, ...JSON.parse(ls('rr_hs2') ?? '{}') }; } catch { /* empty */ }
  const runnerLabels: Record<string, string> = { school: '🏫 Schule', city: '🏙 Stadt', office: '🏢 Büro' };
  const hasRunner = Object.values(runnerData).some(v => v > 0);
  const spRunner = document.getElementById('sp-runner');
  if (spRunner) spRunner.innerHTML = hasRunner
    ? Object.entries(runnerLabels).map(([k, l]) => row(l, runnerData[k] > 0 ? fmt(runnerData[k]) : '—', runnerData[k] > 0 ? 'yellow' : undefined)).join('')
    : noData();

  // Flipautomat
  const flipHi = parseInt(ls('sc_hi') ?? '0') || 0;
  const spFlip = document.getElementById('sp-flipautomat');
  if (spFlip) spFlip.innerHTML = flipHi > 0 ? row('Highscore', fmt(flipHi), 'yellow') : noData();

  // Dorf (async)
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
    { k: 'holz', icon: '🪵', label: 'Holz', bar: '#c87941' },
    { k: 'stein', icon: '🪨', label: 'Stein', bar: '#9e9e9e' },
    { k: 'nahrung', icon: '🌾', label: 'Nahrung', bar: '#4ade80' },
    { k: 'gold', icon: '💰', label: 'Gold', bar: '#facc15' },
    { k: 'eisen', icon: '⚙️', label: 'Eisen', bar: '#78909c' },
    { k: 'kohle', icon: '🪨', label: 'Kohle', bar: '#607d8b' },
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
