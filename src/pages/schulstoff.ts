let _currentSubjectId: string | null = null;
let _currentIdx = 0;
let _currentTotal = 0;

export function ssToggleSubject(id: string): void {
  const topics = document.getElementById(id);
  if (!topics) return;
  const btn = topics.previousElementSibling as HTMLElement | null;
  const chevron = btn?.querySelector<HTMLElement>('.ss-chevron');
  const isOpen = !topics.classList.contains('hidden');
  document.querySelectorAll<HTMLElement>('.ss-topics').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll<HTMLElement>('.ss-chevron').forEach(c => c.textContent = 'expand_more');
  if (isOpen) return;
  topics.classList.remove('hidden');
  if (chevron) chevron.textContent = 'expand_less';
}

export function ssSelect(subject: string, topic: string, path: string, idx: number, total: number): void {
  _currentIdx = idx;
  _currentTotal = total;
  _currentSubjectId = 'ss-linux';

  document.querySelectorAll<HTMLElement>('.ss-topic-btn').forEach(b => {
    b.classList.remove('bg-primary/10', 'text-primary');
    b.classList.add('text-slate-400');
  });
  const ev = window.event as MouseEvent | undefined;
  const target = ev?.target as HTMLElement | null;
  if (target) { target.classList.add('bg-primary/10', 'text-primary'); target.classList.remove('text-slate-400'); }

  const tb = document.getElementById('ss-topbar');
  if (tb) { tb.classList.remove('hidden'); tb.classList.add('flex'); }
  const breadSubject = document.getElementById('ss-bread-subject');
  const breadTopic = document.getElementById('ss-bread-topic');
  const counter = document.getElementById('ss-counter');
  const openBtn = document.getElementById('ss-open-btn') as HTMLAnchorElement | null;
  const prev = document.getElementById('ss-prev') as HTMLButtonElement | null;
  const next = document.getElementById('ss-next') as HTMLButtonElement | null;
  const iframe = document.getElementById('ss-iframe') as HTMLIFrameElement | null;
  const empty = document.getElementById('ss-empty');
  const viewer = document.getElementById('ss-viewer');

  if (breadSubject) breadSubject.textContent = subject;
  if (breadTopic) breadTopic.textContent = topic;
  if (counter) counter.textContent = (idx + 1) + ' / ' + total;
  if (openBtn) openBtn.href = path;
  if (prev) prev.disabled = idx === 0;
  if (next) next.disabled = idx === total - 1;
  if (iframe) iframe.src = path;
  if (empty) empty.classList.add('hidden');
  if (viewer) { viewer.classList.remove('hidden'); viewer.classList.add('flex'); }
}

export function ssNav(dir: number): void {
  if (!_currentSubjectId) return;
  const container = document.getElementById(_currentSubjectId);
  if (!container) return;
  const btns = container.querySelectorAll<HTMLButtonElement>('.ss-topic-btn');
  const next = _currentIdx + dir;
  if (next >= 0 && next < btns.length) {
    btns[next].click();
    btns[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
