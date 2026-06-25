import rawEntries from '../../data/changelog.json';

interface ChangelogEntry {
  date: string;
  category: string;
  text: string;
}

const CATEGORY_CLASSES: Record<string, string> = {
  Hub:    'bg-primary/10 text-primary',
  Dorf:   'bg-tertiary/10 text-tertiary',
  Schule: 'bg-secondary/10 text-secondary',
  Infra:  'bg-secondary/10 text-secondary',
  Spiel:  'bg-tertiary/10 text-tertiary',
  Fix:    'bg-red-500/10 text-red-400',
};

const PREVIEW_COUNT = 8;
const entries = rawEntries as ChangelogEntry[];

function buildEntry(e: ChangelogEntry): HTMLElement {
  const div = document.createElement('div');
  div.className = 'flex items-start gap-md p-sm rounded-lg bg-surface-container-low';
  const cls = CATEGORY_CLASSES[e.category] ?? 'bg-primary/10 text-primary';
  div.innerHTML =
    `<span class="text-xs text-slate-500 font-mono whitespace-nowrap mt-0.5">${e.date}</span>` +
    `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${cls} whitespace-nowrap">${e.category}</span>` +
    `<span class="text-sm text-on-surface-variant">${e.text}</span>`;
  return div;
}

export function initChangelog(): void {
  const list = document.getElementById('neuigkeiten-list');
  if (list) {
    list.innerHTML = '';
    entries.slice(0, PREVIEW_COUNT).forEach(e => list.appendChild(buildEntry(e)));
  }

  const btn = document.getElementById('neuigkeiten-alle-btn');
  if (btn) {
    btn.style.display = entries.length > PREVIEW_COUNT ? 'flex' : 'none';
    btn.addEventListener('click', () => openChangelogModal());
  }
}

function openChangelogModal(): void {
  const existing = document.getElementById('changelog-modal');
  if (existing) { existing.style.display = 'flex'; return; }

  const modal = document.createElement('div');
  modal.id = 'changelog-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-md';
  modal.style.background = 'rgba(0,0,0,0.6)';
  modal.style.backdropFilter = 'blur(4px)';

  const panel = document.createElement('div');
  panel.className = 'glass-card rounded-xl flex flex-col w-full max-w-lg max-h-[80vh]';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between p-lg border-b border-white/5 shrink-0';
  header.innerHTML =
    `<div class="flex items-center gap-2">` +
      `<span class="material-symbols-outlined text-primary" style="font-size:20px">newspaper</span>` +
      `<h2 class="text-on-surface font-semibold text-base">Alle Neuigkeiten</h2>` +
      `<span class="text-xs text-on-surface-variant ml-1">(${entries.length})</span>` +
    `</div>` +
    `<button id="changelog-close-btn" class="text-on-surface-variant hover:text-on-surface transition-colors">` +
      `<span class="material-symbols-outlined" style="font-size:20px">close</span>` +
    `</button>`;

  const body = document.createElement('div');
  body.className = 'flex flex-col gap-xs p-lg overflow-y-auto flex-1';
  entries.forEach(e => body.appendChild(buildEntry(e)));

  panel.appendChild(header);
  panel.appendChild(body);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  const close = () => { modal.style.display = 'none'; };
  document.getElementById('changelog-close-btn')!.addEventListener('click', close);
  modal.addEventListener('click', (ev) => { if (ev.target === modal) close(); });
}
