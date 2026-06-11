type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

const MODES: Record<PomodoroMode, { label: string; dur: number; color: string; glow: string }> = {
  work:       { label: 'Fokus-Phase',  dur: 25 * 60, color: '#ddb7ff', glow: 'rgba(221,183,255,0.15)' },
  shortBreak: { label: 'Kurze Pause', dur:  5 * 60, color: '#4edea3', glow: 'rgba(78,222,163,0.15)' },
  longBreak:  { label: 'Lange Pause', dur: 15 * 60, color: '#adc6ff', glow: 'rgba(173,198,255,0.15)' },
};

let _mode: PomodoroMode = 'work';
let _running = false;
let _timer: ReturnType<typeof setInterval> | null = null;
let _left = 25 * 60;
let _rounds = 0;

function render(): void {
  const m = MODES[_mode];
  const mins = String(Math.floor(_left / 60)).padStart(2, '0');
  const secs = String(_left % 60).padStart(2, '0');
  const time = document.getElementById('pomo-time');
  const label = document.getElementById('pomo-label');
  const rounds = document.getElementById('pomo-rounds');
  const ring = document.getElementById('pomo-ring');
  const modal = document.getElementById('pomo-modal');
  if (time) { time.textContent = mins + ':' + secs; time.style.color = m.color; }
  if (label) label.textContent = m.label;
  if (rounds) rounds.textContent = '🍅'.repeat(Math.min(_rounds, 8)) || '—';
  const frac = _left / MODES[_mode].dur;
  if (ring) { ring.style.strokeDashoffset = String(534 - 534 * (1 - frac)); ring.style.stroke = m.color; }
  if (modal) modal.style.boxShadow = `0 0 80px ${m.glow}, 0 30px 80px rgba(0,0,0,0.6)`;
}

export function pomoSetMode(mode: PomodoroMode): void {
  if (_running && _timer) { clearInterval(_timer); _running = false; }
  _mode = mode;
  _left = MODES[mode].dur;
  document.querySelectorAll<HTMLElement>('.pomo-tab').forEach(b => {
    b.style.background = b.dataset.mode === mode ? 'rgba(255,255,255,0.1)' : 'transparent';
    b.style.color = b.dataset.mode === mode ? '#dae2fd' : '#4b5563';
  });
  const btn = document.getElementById('pomo-btn');
  if (btn) btn.textContent = 'Start';
  render();
}

export function togglePomodoro(): void {
  const btn = document.getElementById('pomo-btn');
  if (_running) {
    if (_timer) clearInterval(_timer);
    _running = false;
    if (btn) btn.textContent = 'Fortsetzen';
  } else {
    _running = true;
    if (btn) btn.textContent = 'Pause';
    _timer = setInterval(() => {
      _left--;
      if (_left <= 0) {
        if (_timer) clearInterval(_timer);
        _running = false;
        if (_mode === 'work') {
          _rounds++;
          const isLong = _rounds % 4 === 0;
          if (btn) {
            btn.textContent = isLong ? 'Lange Pause starten' : 'Kurze Pause starten';
            btn.onclick = () => { pomoSetMode(isLong ? 'longBreak' : 'shortBreak'); togglePomodoro(); btn.onclick = togglePomodoro; };
          }
        } else {
          if (btn) {
            btn.textContent = 'Neue Runde starten';
            btn.onclick = () => { pomoSetMode('work'); togglePomodoro(); btn.onclick = togglePomodoro; };
          }
        }
        _left = 0;
      }
      render();
    }, 1000);
  }
}

export function resetPomodoro(): void {
  if (_timer) clearInterval(_timer);
  _running = false;
  _left = MODES[_mode].dur;
  const btn = document.getElementById('pomo-btn');
  if (btn) { btn.textContent = 'Start'; btn.onclick = togglePomodoro; }
  render();
}

export function openPomodoro(): void {
  const overlay = document.getElementById('pomo-overlay');
  if (overlay) overlay.style.display = 'flex';
  render();
}

export function closePomodoro(): void {
  const overlay = document.getElementById('pomo-overlay');
  if (overlay) overlay.style.display = 'none';
}
