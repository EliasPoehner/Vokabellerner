const TRACKS = [
  { title: 'Lo-Fi Hip Hop Radio',    sub: 'Entspannt · zum Lernen',       id: 'jfKfPfyJRdk' },
  { title: 'Deep Focus Music',        sub: 'Alpha Waves · Konzentration',  id: 'WPni755-Krg' },
  { title: 'Jazz Café Vibes',         sub: 'Smooth Jazz · gemütlich',      id: 'vmDDOFXSgAs' },
  { title: 'Classical Study Music',   sub: 'Mozart & Bach · zeitlos',      id: 'mDaPyhKVGmA' },
  { title: 'Rainy Day Ambience',      sub: 'Regen & Donner · entspannt',   id: 'mPZkdNFkNps' },
  { title: 'Forest & Nature Sounds',  sub: 'Natur-Geräusche · beruhigend', id: 'xNN7iTA57jM' },
];

let idx = 0;

function render(): void {
  const t = TRACKS[idx];
  const title = document.getElementById('musik-title');
  const sub = document.getElementById('musik-sub');
  const counter = document.getElementById('musik-counter');
  if (title) title.textContent = t.title;
  if (sub) sub.textContent = t.sub;
  if (counter) counter.textContent = (idx + 1) + ' / ' + TRACKS.length;
  document.querySelectorAll<HTMLElement>('.musik-dot').forEach((d, i) => {
    d.style.background = i === idx ? '#ddb7ff' : 'rgba(255,255,255,0.15)';
    d.style.width = i === idx ? '18px' : '6px';
  });
}

export function playMusik(): void {
  const t = TRACKS[idx];
  const iframe = document.getElementById('musik-iframe') as HTMLIFrameElement | null;
  const playBtn = document.getElementById('musik-play-btn');
  const playerWrap = document.getElementById('musik-player-wrap');
  if (iframe) iframe.src = `https://www.youtube.com/embed/${t.id}?autoplay=1&mute=0&controls=1&rel=0`;
  if (playBtn) playBtn.style.display = 'none';
  if (playerWrap) playerWrap.style.display = 'block';
}

export function musikNav(dir: number): void {
  idx = (idx + dir + TRACKS.length) % TRACKS.length;
  const iframe = document.getElementById('musik-iframe') as HTMLIFrameElement | null;
  const playBtn = document.getElementById('musik-play-btn');
  const playerWrap = document.getElementById('musik-player-wrap');
  if (iframe) iframe.src = '';
  if (playBtn) playBtn.style.display = 'flex';
  if (playerWrap) playerWrap.style.display = 'none';
  render();
}

export function openFokusMusik(): void {
  const overlay = document.getElementById('musik-overlay');
  if (overlay) overlay.style.display = 'flex';
  render();
}

export function closeFokusMusik(): void {
  const overlay = document.getElementById('musik-overlay');
  if (overlay) overlay.style.display = 'none';
  const iframe = document.getElementById('musik-iframe') as HTMLIFrameElement | null;
  if (iframe) iframe.src = '';
}
