const PHASES = [
  { name: 'Einatmen',  hint: 'Durch die Nase, tief in den Bauch', dur: 4, expand: true  as boolean | null },
  { name: 'Halten',    hint: 'Luft sanft anhalten',                dur: 4, expand: null  as boolean | null },
  { name: 'Ausatmen',  hint: 'Langsam durch den Mund',             dur: 4, expand: false as boolean | null },
  { name: 'Halten',    hint: 'Entspannt warten',                   dur: 4, expand: null  as boolean | null },
];
const TOTAL = 60;

let _running = false;
let _timer: ReturnType<typeof setInterval> | null = null;
let _tick: ReturnType<typeof setInterval> | null = null;
let _elapsed = 0;
let _phaseIdx = 0;
let _phaseEl = 0;

function setCircleSize(expanding: boolean | null, progress: number): void {
  const circle = document.getElementById('atem-circle') as HTMLElement | null;
  if (!circle) return;
  const big = 130, small = 70;
  let size: number;
  if (expanding === true) size = small + (big - small) * progress;
  else if (expanding === false) size = big - (big - small) * progress;
  else size = 100;
  circle.style.width = size + 'px';
  circle.style.height = size + 'px';
  const glow = expanding === true ? 0.1 + 0.3 * progress : 0.4 - 0.3 * progress;
  circle.style.boxShadow = `0 0 ${20 + 30 * glow}px rgba(78,222,163,${glow})`;
}

function stop(): void {
  _running = false;
  if (_timer) clearInterval(_timer);
  if (_tick) clearInterval(_tick);
  _timer = null;
  _tick = null;
}

export function resetAtem(): void {
  stop();
  _elapsed = 0; _phaseIdx = 0; _phaseEl = 0; _running = false;
  const ids: Record<string, string> = {
    'atem-btn': 'Start', 'atem-title': 'Bereit?',
    'atem-subtitle': '1 Minute Atemübung · Box Breathing',
    'atem-phase': 'Einatmen', 'atem-hint': 'Durch die Nase, tief in den Bauch',
    'atem-count': '4', 'atem-timeleft': '60 Sek. verbleibend',
  };
  for (const [id, val] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  const prog = document.getElementById('atem-progress') as HTMLElement | null;
  const ring = document.getElementById('atem-ring') as SVGElement | null;
  if (prog) prog.style.width = '0%';
  if (ring) ring.style.strokeDashoffset = '502';
  setCircleSize(false, 0);
}

function start(): void {
  _running = true;
  _tick = setInterval(() => {
    if (!_running) return;
    const phase = PHASES[_phaseIdx];
    const phaseProg = _phaseEl / phase.dur;
    setCircleSize(phase.expand, phaseProg);
    const totalProg = _elapsed / TOTAL;
    const ring = document.getElementById('atem-ring') as SVGElement | null;
    if (ring) ring.style.strokeDashoffset = String(502 - 502 * totalProg);
    const count = document.getElementById('atem-count');
    if (count) count.textContent = String(Math.ceil(phase.dur - _phaseEl));
  }, 50);

  _timer = setInterval(() => {
    if (!_running) return;
    _elapsed++; _phaseEl++;
    const pct = Math.min((_elapsed / TOTAL) * 100, 100);
    const prog = document.getElementById('atem-progress') as HTMLElement | null;
    const timeLeft = document.getElementById('atem-timeleft');
    if (prog) prog.style.width = pct + '%';
    if (timeLeft) timeLeft.textContent = Math.max(TOTAL - _elapsed, 0) + ' Sek. verbleibend';
    if (_phaseEl >= PHASES[_phaseIdx].dur) {
      _phaseEl = 0;
      _phaseIdx = (_phaseIdx + 1) % PHASES.length;
      const next = PHASES[_phaseIdx];
      const phase = document.getElementById('atem-phase');
      const hint = document.getElementById('atem-hint');
      if (phase) phase.textContent = next.name;
      if (hint) hint.textContent = next.hint;
    }
    if (_elapsed >= TOTAL) {
      stop();
      const btn = document.getElementById('atem-btn');
      const title = document.getElementById('atem-title');
      const subtitle = document.getElementById('atem-subtitle');
      const phase = document.getElementById('atem-phase');
      const hint = document.getElementById('atem-hint');
      const count = document.getElementById('atem-count');
      const finProg = document.getElementById('atem-progress') as HTMLElement | null;
      const finTimeLeft = document.getElementById('atem-timeleft');
      if (title) title.textContent = '✨ Geschafft!';
      if (subtitle) subtitle.textContent = 'Du hast 1 Minute durchgeatmet.';
      if (phase) phase.textContent = 'Wunderbar 🌿';
      if (hint) hint.textContent = 'Fühl wie sich dein Körper entspannt hat.';
      if (count) count.textContent = '✓';
      if (btn) {
        btn.textContent = 'Nochmal';
        btn.onclick = () => { resetAtem(); start(); if (btn) { btn.textContent = 'Pause'; btn.onclick = toggleAtemPause; } };
      }
      if (finProg) finProg.style.width = '100%';
      if (finTimeLeft) finTimeLeft.textContent = 'Abgeschlossen';
      setCircleSize(null, 0);
    }
  }, 1000);
}

export function toggleAtemPause(): void {
  const btn = document.getElementById('atem-btn');
  const title = document.getElementById('atem-title');
  const subtitle = document.getElementById('atem-subtitle');
  if (_running) {
    stop();
    if (btn) btn.textContent = 'Fortsetzen';
  } else {
    start();
    if (btn) btn.textContent = 'Pause';
    if (title) title.textContent = 'Atme mit mir';
    if (subtitle) subtitle.textContent = 'Lass deine Gedanken los…';
  }
}

export function openAtemPause(): void {
  const overlay = document.getElementById('atem-overlay');
  if (overlay) overlay.style.display = 'flex';
  resetAtem();
}

export function closeAtemPause(): void {
  const overlay = document.getElementById('atem-overlay');
  if (overlay) overlay.style.display = 'none';
  stop();
  resetAtem();
}
