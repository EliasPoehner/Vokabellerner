/* ── Calendar week helper ── */
export function getKW(d: Date): number {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - dn);
  const yr = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  return Math.ceil((((u.getTime() - yr.getTime()) / 86400000) + 1) / 7);
}

/* ── Clock ── */
export function updateClock(): void {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const kw = getKW(now);

  const time = document.getElementById('dash-time');
  const dateChip = document.getElementById('dash-date-chip');
  const kwVal = document.getElementById('dash-kw-val');
  const kwBar = document.getElementById('dash-kw-bar') as HTMLElement | null;
  const greeting = document.getElementById('dash-greeting');
  const status = document.getElementById('dash-status');

  if (time) time.textContent = h + ':' + m;
  if (dateChip) dateChip.textContent = DAYS[now.getDay()] + ', ' + now.getDate() + '. ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
  if (kwVal) kwVal.textContent = 'KW ' + kw;
  if (kwBar) {
    let kwPct = 0;
    if (kw >= 36) kwPct = ((kw - 36) / 42) * 100;
    else if (kw <= 29) kwPct = ((kw + 16) / 42) * 100;
    kwBar.style.width = Math.min(100, Math.max(0, kwPct)) + '%';
  }
  const hr = now.getHours();
  const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  let greet = 'Guten Tag', stat = 'AKTUELLER STATUS: BEREIT';
  if (hr < 13) { greet = 'Guten Morgen'; stat = hr < 10 ? 'AKTUELLER STATUS: FRÜHSTART' : 'AKTUELLER STATUS: FOKUS'; }
  else if (hr >= 18) { greet = 'Guten Abend'; stat = 'AKTUELLER STATUS: FEIERABEND'; }
  if (greeting) greeting.textContent = greet + ' — heute ist ' + WT[now.getDay()] + '.';
  if (status) status.textContent = stat;
}

/* ── Ferien ── */
const FERIEN = [
  { name: 'Pfingstferien',    start: new Date(2025, 5, 7),   end: new Date(2025, 5, 20) },
  { name: 'Sommerferien',     start: new Date(2025, 6, 28),  end: new Date(2025, 8, 8)  },
  { name: 'Herbstferien',     start: new Date(2025, 9, 27),  end: new Date(2025, 10, 7) },
  { name: 'Weihnachtsferien', start: new Date(2025, 11, 24), end: new Date(2026, 0, 6)  },
  { name: 'Winterferien',     start: new Date(2026, 1, 16),  end: new Date(2026, 1, 20) },
  { name: 'Osterferien',      start: new Date(2026, 3, 2),   end: new Date(2026, 3, 17) },
  { name: 'Pfingstferien 26', start: new Date(2026, 4, 23),  end: new Date(2026, 5, 5)  },
  { name: 'Sommerferien 26',  start: new Date(2026, 6, 27),  end: new Date(2026, 8, 7)  },
];

function fmtD(d: Date): string {
  return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
}

export function updateFerien(): void {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const tageEl = document.getElementById('dash-ferien-tage');
  const nameEl = document.getElementById('dash-ferien-name');
  const datumEl = document.getElementById('dash-ferien-datum');
  const barEl = document.getElementById('dash-ferien-bar') as HTMLElement | null;

  for (const f of FERIEN) {
    if (now >= f.start && now <= f.end) {
      const left = Math.ceil((f.end.getTime() - now.getTime()) / 86400000);
      if (tageEl) tageEl.innerHTML = left + ' <span style="font-size:.875rem;font-weight:400;color:#4edea3;">Tage noch</span>';
      if (nameEl) nameEl.textContent = '🎉 ' + f.name + ' läuft!';
      if (datumEl) datumEl.textContent = fmtD(f.start) + ' – ' + fmtD(f.end);
      if (barEl) barEl.style.width = '100%';
      return;
    }
  }
  const next = FERIEN.find(f => f.start > now);
  if (!next) {
    [tageEl, nameEl, datumEl].forEach(el => { if (el) el.textContent = '—'; });
    return;
  }
  const days = Math.ceil((next.start.getTime() - now.getTime()) / 86400000);
  if (tageEl) tageEl.innerHTML = days + ' <span style="font-size:.875rem;font-weight:400;color:#ddb7ff;">Tage noch</span>';
  if (nameEl) nameEl.textContent = next.name;
  if (datumEl) datumEl.textContent = fmtD(next.start) + ' – ' + fmtD(next.end);
  let lastEnd = new Date(2025, 0, 1);
  for (const f of FERIEN) { if (f.end < next.start) lastEnd = f.end; }
  const pct = Math.min(100, Math.max(0, ((now.getTime() - lastEnd.getTime()) / (next.start.getTime() - lastEnd.getTime())) * 100));
  if (barEl) barEl.style.width = pct + '%';
}

/* ── Stundenplan ── */
interface Stunde { f: string; v: string; b: string }

const SP: Record<number, Stunde[]> = {
  1: [{ f: 'BwLog', v: '08:00', b: '08:45' }, { f: 'BwLog', v: '08:45', b: '09:30' },
      { f: 'Elektrotechnik', v: '13:45', b: '14:30' }, { f: 'Elektrotechnik', v: '14:45', b: '15:30' }],
  2: [{ f: 'Web', v: '08:00', b: '08:45' }, { f: 'Web', v: '08:45', b: '09:30' },
      { f: 'Sowe', v: '09:45', b: '10:30' }, { f: 'Sowe', v: '10:30', b: '11:15' },
      { f: 'BwLohn', v: '11:30', b: '12:15' }, { f: 'BwLohn', v: '12:15', b: '13:00' },
      { f: 'Datenbank', v: '13:45', b: '14:30' }, { f: 'Datenbank', v: '14:45', b: '15:30' },
      { f: 'BwFibu', v: '15:30', b: '16:15' }],
  3: [{ f: 'Deutsch', v: '08:00', b: '08:45' }, { f: 'Deutsch', v: '08:45', b: '09:30' },
      { f: 'KOM', v: '09:45', b: '10:30' }, { f: 'KOM', v: '10:30', b: '11:15' },
      { f: 'Java', v: '11:30', b: '12:15' }, { f: 'Java', v: '12:15', b: '13:00' },
      { f: 'DVT', v: '13:45', b: '14:30' }],
  4: [{ f: 'ABAP', v: '08:00', b: '08:45' }, { f: 'ABAP', v: '08:45', b: '09:30' },
      { f: 'BwLog', v: '09:45', b: '10:30' }, { f: 'BwLog', v: '10:30', b: '11:15' },
      { f: 'WiPuG', v: '11:30', b: '12:15' }, { f: 'WiPuG', v: '12:15', b: '13:00' },
      { f: 'Physik', v: '13:45', b: '14:30' }, { f: 'Physik', v: '14:45', b: '15:30' }],
  5: [{ f: 'BsWin', v: '08:00', b: '08:45' }, { f: 'BsWin', v: '08:45', b: '09:30' },
      { f: 'Physik', v: '13:00', b: '13:45' }],
};

const FICON: Record<string, string> = {
  BwLog: 'inventory', Elektrotechnik: 'bolt', Web: 'language', Sowe: 'groups',
  BwLohn: 'payments', Datenbank: 'database', BwFibu: 'receipt_long',
  Deutsch: 'g_translate', KOM: 'wifi', Java: 'code', DVT: 'developer_board',
  ABAP: 'terminal', WiPuG: 'business_center', Physik: 'science', BsWin: 'window',
};
const FCOL: Record<string, 'primary' | 'secondary' | 'tertiary'> = {
  BwLog: 'tertiary', Elektrotechnik: 'primary', Web: 'secondary', Sowe: 'tertiary',
  BwLohn: 'primary', Datenbank: 'secondary', BwFibu: 'tertiary',
  Deutsch: 'primary', KOM: 'secondary', Java: 'tertiary', DVT: 'primary',
  ABAP: 'secondary', WiPuG: 'tertiary', Physik: 'primary', BsWin: 'secondary',
};
const CMAP = {
  primary:   { bg: 'rgba(221,183,255,.12)', text: '#ddb7ff', bdr: '#ddb7ff' },
  secondary: { bg: 'rgba(78,222,163,.12)',  text: '#4edea3', bdr: '#4edea3' },
  tertiary:  { bg: 'rgba(173,198,255,.12)', text: '#adc6ff', bdr: '#adc6ff' },
};

const mOf = (t: string): number => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function updateStunden(): void {
  const now = new Date(), dow = now.getDay(), cur = now.getHours() * 60 + now.getMinutes();
  const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const dayEl = document.getElementById('dash-stunden-day');
  const grid = document.getElementById('dash-stunden-grid');
  if (dayEl) dayEl.textContent = WT[dow];
  if (!grid) return;
  const stunden = SP[dow];
  if (!stunden) {
    grid.innerHTML = `<div class="p-md bg-surface-container-high rounded-xl border-l-4 border-secondary flex items-center gap-md">
      <span class="material-symbols-outlined text-secondary p-sm rounded-lg bg-secondary/10" style="font-size:22px;font-variation-settings:'FILL' 1">weekend</span>
      <div><p class="font-label-md text-secondary">WOCHENENDE</p><p class="text-sm text-slate-400 mt-xs">Kein Unterricht heute 🎉</p></div></div>`;
    return;
  }
  // merge Doppelstunden
  interface Merged extends Stunde { doppel: boolean }
  const merged: Merged[] = [];
  for (const s of stunden) {
    const prev = merged[merged.length - 1];
    if (prev && prev.f === s.f) { prev.b = s.b; prev.doppel = true; }
    else merged.push({ ...s, doppel: false });
  }
  grid.innerHTML = merged.map(s => {
    const st = mOf(s.v), en = mOf(s.b);
    const col = FCOL[s.f] ?? 'primary', c = CMAP[col];
    let lbl = 'AUSSTEHEND', bdr = '#4d4354', opac = '', done = false;
    if (cur >= st && cur < en) { lbl = 'JETZT · ' + (en - cur) + ' min'; bdr = c.bdr; }
    else if (cur >= en) { lbl = 'ABGESCHLOSSEN'; bdr = '#4edea3'; opac = ' opacity-50'; done = true; }
    const icon = FICON[s.f] ?? 'book';
    const tc = done ? '#4edea3' : (cur >= st && cur < en ? c.text : '#988d9f');
    const doppelBadge = s.doppel
      ? `<span class="text-[10px] font-bold px-xs py-xs rounded" style="background:${c.bg};color:${c.text};">2× Std.</span>`
      : '';
    return `<div class="px-md py-sm bg-surface-container-high rounded-lg border-l-4 flex items-center gap-md${opac}" style="border-color:${bdr};">
      <span class="material-symbols-outlined rounded-md flex-shrink-0" style="font-size:16px;color:${c.text};background:${c.bg};padding:4px;">${icon}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-sm">
          <p class="text-on-surface font-semibold text-sm${done ? ' line-through text-slate-500' : ''}">${s.f}</p>
          ${doppelBadge}
        </div>
        <p class="text-xs text-slate-500">${s.v} – ${s.b} Uhr</p>
      </div>
      <span class="text-[10px] font-semibold flex-shrink-0" style="color:${tc};">${lbl}</span>
    </div>`;
  }).join('');
}

/* ── Quotes ── */
const QUOTES = [
  { text: 'Der Anfang ist die Hälfte des Ganzen.', author: 'Aristoteles' },
  { text: 'Wer aufhört zu lernen, ist alt. Wer lernt, bleibt jung.', author: 'Henry Ford' },
  { text: 'Man muss das Unmögliche versuchen, um das Mögliche zu erreichen.', author: 'Hermann Hesse' },
  { text: 'Bildung ist die mächtigste Waffe, mit der du die Welt verändern kannst.', author: 'Nelson Mandela' },
  { text: 'Der Weg ist das Ziel.', author: 'Konfuzius' },
  { text: 'Nur wer sein Ziel kennt, findet den Weg.', author: 'Laozi' },
  { text: 'Erfolg ist die Summe kleiner Bemühungen, die täglich wiederholt werden.', author: 'Robert Collier' },
];

export function showQuote(): void {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const el = document.getElementById('dash-quote');
  const au = document.getElementById('dash-quote-author');
  if (el) el.textContent = '„' + q.text + '"';
  if (au) au.textContent = '— ' + q.author;
}

/* ── Fun Facts ── */
const FACTS = [
  'Honig verdirbt nie – in ägyptischen Gräbern wurde 3000 Jahre alter Honig gefunden, der noch genießbar war.',
  'Oktopusse haben drei Herzen und blaues Blut.',
  'Ein Blitz ist etwa fünfmal heißer als die Oberfläche der Sonne.',
  'Wombats haben würfelförmigen Kot.',
  'Der Eiffelturm kann im Sommer bis zu 15 cm größer werden.',
  'Es gibt mehr mögliche Schachpartien als Atome im beobachtbaren Universum.',
  'Menschen teilen etwa 60 % ihrer DNA mit Bananen.',
  'Ameisen können das 50-fache ihres eigenen Körpergewichts tragen.',
  'Pinguine machen Heiratsanträge mit Steinen.',
  'Der Mond entfernt sich jedes Jahr etwa 3,8 cm von der Erde.',
  'Kühe haben beste Freunde und werden gestresst, wenn sie getrennt werden.',
  'Der längste aufgezeichnete Schluckauf dauerte 68 Jahre.',
  'Es gibt Pilze, die Zombies machen – sie übernehmen die Kontrolle über Insekten.',
  'Ein Tag auf dem Merkur dauert länger als sein Jahr.',
  'Katzen können keinen süßen Geschmack wahrnehmen.',
  'Ein Regenbogen ist eigentlich ein vollständiger Kreis.',
];
const FACT_EMOJIS = ['🍯','🐙','⚡','🐾','🗼','♟️','🍌','🐜','🐧','🌕','🐄','😤','🍄','🪐','🐱','🌈'];

let factIdx = Math.floor(Math.random() * FACTS.length);

export function showFact(): void {
  const el = document.getElementById('dash-fact');
  if (el) el.textContent = FACTS[factIdx];
}

export function nextFact(): void {
  factIdx = (factIdx + 1) % FACTS.length;
  showFact();
}

export function openFactPopup(): void {
  nextFact();
  const text = document.getElementById('fact-popup-text');
  const emoji = document.getElementById('fact-popup-emoji');
  if (text) text.textContent = FACTS[factIdx];
  if (emoji) emoji.textContent = FACT_EMOJIS[factIdx % FACT_EMOJIS.length];
  const overlay = document.getElementById('fact-overlay');
  if (overlay) overlay.style.display = 'flex';
}

export function closeFactPopup(): void {
  const overlay = document.getElementById('fact-overlay');
  if (overlay) overlay.style.display = 'none';
}
