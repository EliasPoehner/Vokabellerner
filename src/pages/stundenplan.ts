import { SP, FCOL, CMAP, FICON } from './landing.js';

// KlaTab API base — change if the school migrates the endpoint
const API_BASE = 'https://klatab.edvschule-plattling.de';
const CACHE_TTL = 30 * 60 * 1000;

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const STUNDEN_FALLBACK = [1, 2, 3, 4, 5, 6, 7, 8];
const TIMES_FALLBACK = ['07:45', '08:30', '09:15', '10:15', '11:00', '11:45', '12:30', '13:15'];

const CELL_COLORS = [
  { bg: 'rgba(221,183,255,.15)', fg: '#ddb7ff', border: 'rgba(221,183,255,.3)' },
  { bg: 'rgba(78,222,163,.12)',  fg: '#4edea3', border: 'rgba(78,222,163,.3)' },
  { bg: 'rgba(173,198,255,.12)', fg: '#adc6ff', border: 'rgba(173,198,255,.3)' },
  { bg: 'rgba(255,214,100,.1)',  fg: '#ffd664', border: 'rgba(255,214,100,.3)' },
];

// ── Types ───────────────────────────────────────────────────────────────────

interface GridCell {
  kuerzel: string;
  raum: string;
  lehrer: string;
  standin?: string;
  message?: string;
  colorIdx: number;
}

interface Merged { f: string; v: string; b: string; doppel: boolean }

interface ScheduleEntry { grid: (GridCell | null)[][]; fetchedAt: number }
type ScheduleCache = Record<string, ScheduleEntry>;
interface HoursCache { stunden: number[]; times: string[] }

interface ManualKlausur { id: string; fach: string; thema: string; datum: string; dauer: number }

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isoWeek(d: Date): { week: number; year: number } {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - dn);
  const yr = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil((((u.getTime() - yr.getTime()) / 86400000) + 1) / 7),
    year: u.getUTCFullYear(),
  };
}

function getMonday(d: Date): Date {
  const dow = d.getDay() || 7;
  const m = new Date(d);
  m.setDate(d.getDate() - dow + 1);
  return m;
}

function subjectColorIdx(subject: string): number {
  let h = 0;
  for (const c of (subject || '')) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h % CELL_COLORS.length;
}

function ls<T>(key: string, def: T): T {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) as T : def; }
  catch { return def; }
}
function lsSet(key: string, v: unknown) { localStorage.setItem(key, JSON.stringify(v)); }

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function el<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

const mOf = (t: string): number => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// ── Persisted state ──────────────────────────────────────────────────────────

const K = {
  user:          'sp-user',
  classId:       'sp-classId',
  classAlias:    'sp-classAlias',
  group:         'sp-group',
  scheduleCache: 'sp-schedule-cache',
  hoursCache:    'sp-hours-cache',
  klausuren:     'sp-klausuren',
} as const;

function getUser()    { return localStorage.getItem(K.user)       ?? ''; }
function getClassId() { return localStorage.getItem(K.classId)    ?? ''; }
function getAlias()   { return localStorage.getItem(K.classAlias) ?? ''; }
function getGroup()   { return localStorage.getItem(K.group)      ?? ''; }
function isConfigured() { return !!(getUser() || getClassId()); }
function getScheduleCache() { return ls<ScheduleCache>(K.scheduleCache, {}); }
function getHoursCache()    { return ls<HoursCache>(K.hoursCache, { stunden: STUNDEN_FALLBACK, times: TIMES_FALLBACK }); }
function getKlausuren()     { return ls<ManualKlausur[]>(K.klausuren, []); }

// ── Module state ─────────────────────────────────────────────────────────────

let _weekOffset  = 0;
let _loading     = false;
let _loadingKl   = false;
let _errorKl: string | null = null;
let _apiTests: Array<{ id: string; fach: string; thema: string; datum: string; lehrer?: string; raum?: string; vonStunde?: number; fromApi: true }> = [];
let _settingsOpen = false;
// true = API not reachable, SP fallback is active
let _usingFallback = false;

// ── SP fallback rendering ────────────────────────────────────────────────────

function mergeDay(stunden: { f: string; v: string; b: string }[]): Merged[] {
  const merged: Merged[] = [];
  for (const s of stunden) {
    const prev = merged[merged.length - 1];
    if (prev && prev.f === s.f) { prev.b = s.b; prev.doppel = true; }
    else merged.push({ ...s, doppel: false });
  }
  return merged;
}

function renderSpGrid(): void {
  const container = el('sp-grid-container');
  if (!container) return;

  // Build merged periods for each day (dow 1–5 = Mo–Fr)
  const days: Merged[][] = [1, 2, 3, 4, 5].map(d => SP[d] ? mergeDay(SP[d]) : []);

  // Collect all unique start times across all days, sorted
  const timeSet = new Set<string>();
  days.forEach(d => d.forEach(s => timeSet.add(s.v)));
  const times = [...timeSet].sort((a, b) => mOf(a) - mOf(b));

  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mo, 4=Fr

  let html = `<div style="overflow-x:auto;">
    <table style="border-collapse:collapse;width:100%;min-width:380px;table-layout:fixed;">
      <thead><tr>
        <th style="width:52px;padding:6px 4px 4px;font-size:10px;color:var(--on-surface-variant);font-weight:400;text-align:right;"></th>`;

  for (let i = 0; i < 5; i++) {
    const today = _weekOffset === 0 && i === todayIdx;
    html += `<th style="padding:6px 4px 4px;font-size:12px;font-weight:600;text-align:center;color:${today ? '#ddb7ff' : 'var(--on-surface)'};">${DAYS[i]}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const time of times) {
    // only render row if at least one day has a period starting at this time
    const rowPeriods = days.map(d => d.find(s => s.v === time) ?? null);
    if (!rowPeriods.some(Boolean)) continue;

    html += `<tr>
      <td style="padding:3px 4px;font-size:10px;color:var(--on-surface-variant);text-align:right;white-space:nowrap;vertical-align:middle;">${time}</td>`;

    for (let di = 0; di < 5; di++) {
      const period = rowPeriods[di];
      if (!period) { html += `<td style="padding:3px;"><div style="height:52px;"></div></td>`; continue; }

      const col = FCOL[period.f] ?? 'primary';
      const c   = CMAP[col];
      const icon = FICON[period.f] ?? 'book';

      html += `<td style="padding:3px;">
        <div style="padding:6px 8px;border-radius:8px;background:${c.bg};border:1px solid ${c.bdr}40;text-align:center;">
          <span class="material-symbols-outlined" style="font-size:14px;color:${c.text};display:block;font-variation-settings:'FILL' 1">${icon}</span>
          <div style="font-size:12px;font-weight:600;color:${c.text};margin-top:1px;">${period.f}</div>
          <div style="font-size:9px;color:${c.text};opacity:.6;">${period.v}–${period.b}</div>
          ${period.doppel ? `<div style="font-size:9px;font-weight:700;color:${c.text};opacity:.5;">2×</div>` : ''}
        </div>
      </td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// ── API grid builder ─────────────────────────────────────────────────────────

function buildGrid(apiDays: unknown[], maxPeriods = 8): (GridCell | null)[][] {
  const grid: (GridCell | null)[][] = Array.from({ length: 5 }, () => Array(maxPeriods).fill(null));
  for (const day of apiDays) {
    const d = day as { date: string; lessons?: Array<{ from: number; until: number; subject?: string; room?: string; teacher?: string; standin?: string; message?: string }> };
    const col = (new Date(d.date).getDay() + 6) % 7;
    if (col > 4) continue;
    for (const lesson of (d.lessons ?? [])) {
      for (let p = lesson.from; p <= lesson.until; p++) {
        if (p >= 1 && p <= maxPeriods) {
          grid[col][p - 1] = {
            kuerzel:  lesson.subject  ?? '',
            raum:     lesson.room     ?? '',
            lehrer:   lesson.teacher  ?? '',
            standin:  lesson.standin,
            message:  lesson.message,
            colorIdx: subjectColorIdx(lesson.subject ?? ''),
          };
        }
      }
    }
  }
  return grid;
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function resolveClass(): Promise<string | null> {
  const username = getUser();
  if (!username) return null;
  const [userInfo, basedata] = await Promise.all([
    apiGet(`/api/users/${encodeURIComponent(username)}`),
    apiGet('/api/basedata'),
  ]);
  const ud = ((userInfo as Record<string, unknown>).data ?? userInfo) as Record<string, unknown>;
  const bd = ((basedata as Record<string, unknown>).data ?? basedata) as Record<string, unknown>;
  const classList = (bd.class ?? bd.classes ?? []) as Array<Record<string, unknown>>;
  const resolvedId = ud.classid ?? ud.classId ?? ud.class_id ?? ud.klasse ?? ud.klassenid;
  const cls = classList.find(c => String(c.id) === String(resolvedId));
  if (!cls) throw new Error(`Klasse (id=${String(resolvedId)}) nicht in Basedata gefunden`);
  const classId = String(cls.id);
  const alias   = ((cls.alias ?? cls.name ?? cls.shortName ?? cls.short ?? '') as string).trim();
  const group   = String(ud.group ?? ud.gruppe ?? '').trim();
  localStorage.setItem(K.classId, classId);
  localStorage.setItem(K.classAlias, alias || classId);
  localStorage.setItem(K.group, group);
  renderSettings();
  return classId;
}

export async function fetchSchedule(force = false): Promise<void> {
  if (_loading) return;

  // If not configured at all, skip API and go straight to fallback
  if (!isConfigured()) {
    _usingFallback = true;
    setFallbackBanner(true);
    renderGrid();
    return;
  }

  let classId = getClassId();

  // Resolve class from username if needed
  if (!classId && getUser()) {
    setLoading(true);
    setFallbackBanner(false);
    try {
      classId = await resolveClass() ?? '';
    } catch (e) {
      // Class resolve failed → fallback
      _usingFallback = true;
      setLoading(false);
      setFallbackBanner(true, `Klasse nicht gefunden: ${(e as Error).message}`);
      renderGrid();
      return;
    }
  }

  const dd = displayDate();
  const { week, year } = isoWeek(dd);
  const cacheKey = `${week}-${year}`;
  const cache = getScheduleCache();

  if (!force && cache[cacheKey] && Date.now() - cache[cacheKey].fetchedAt < CACHE_TTL) {
    _usingFallback = false;
    setFallbackBanner(false);
    renderGrid();
    return;
  }

  setLoading(true);
  try {
    const groupParam = getGroup() ? `&group=${encodeURIComponent(getGroup())}` : '';
    const [data, hoursData] = await Promise.all([
      apiGet(`/api/class/${encodeURIComponent(classId)}/schedule?week=${week}&year=${year}${groupParam}`),
      apiGet('/api/hours').catch(() => null),
    ]);

    const days = Array.isArray(data) ? data : [];
    if (hoursData && Array.isArray(hoursData) && hoursData.length > 0) {
      const sorted = [...hoursData as Array<{ index: number; start: string }>].sort((a, b) => a.index - b.index);
      lsSet(K.hoursCache, { stunden: sorted.map((_, i) => i + 1), times: sorted.map(h => h.start) });
      lsSet(K.scheduleCache, { ...getScheduleCache(), [cacheKey]: { grid: buildGrid(days, sorted.length), fetchedAt: Date.now() } });
    } else {
      lsSet(K.scheduleCache, { ...getScheduleCache(), [cacheKey]: { grid: buildGrid(days), fetchedAt: Date.now() } });
    }
    _usingFallback = false;
    setFallbackBanner(false);
  } catch (e) {
    // API not reachable → fall back to SP data from landing page
    _usingFallback = true;
    setFallbackBanner(true, (e as Error).message);
  } finally {
    setLoading(false);
    renderGrid();
  }
}

export async function fetchKlausuren(): Promise<void> {
  const classId = getClassId();
  if (!classId) { renderKlausuren(); return; }
  _loadingKl = true;
  _errorKl   = null;
  renderKlausurenStatus();

  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await apiGet(`/api/class/${encodeURIComponent(classId)}/tests?date=${today}`);
    _apiTests = (Array.isArray(data) ? data : []).map((t: Record<string, unknown>) => ({
      id:        `api-${String(t.date)}-${String(t.subject)}-${String(t.from)}`,
      fach:      String(t.subject ?? ''),
      thema:     String(t.type    ?? ''),
      datum:     String(t.date    ?? ''),
      lehrer:    t.teacher != null ? String(t.teacher) : undefined,
      raum:      t.room    != null ? String(t.room)    : undefined,
      vonStunde: t.from    != null ? Number(t.from)    : undefined,
      fromApi:   true,
    }));
  } catch {
    // Klausuren-API not reachable — silently fall back to manual-only
    _apiTests = [];
  } finally {
    _loadingKl = false;
    renderKlausuren();
  }
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function displayDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + _weekOffset * 7);
  return d;
}

function setLoading(v: boolean) {
  _loading = v;
  const spinner = el('sp-loading');
  const btn     = el('sp-refresh-btn');
  if (spinner) spinner.style.display = v ? 'inline-flex' : 'none';
  if (btn) (btn as HTMLButtonElement).disabled = v;
}

function setFallbackBanner(show: boolean, reason?: string) {
  const banner = el('sp-fallback-banner');
  if (!banner) return;
  banner.style.display = show ? 'flex' : 'none';
  if (show && reason) {
    const detail = banner.querySelector('.sp-fallback-detail') as HTMLElement | null;
    if (detail) detail.textContent = reason;
  }
}

function renderSettings() {
  const display = el('sp-class-display');
  if (!display) return;
  const alias = getAlias();
  const id    = getClassId();
  display.textContent = alias ? `Klasse: ${alias}` : (id ? `ID: ${id}` : 'Nicht konfiguriert');
  const input = el<HTMLInputElement>('sp-user-input');
  if (input && !input.value) input.value = getUser();
}

function renderWeekNav() {
  const dd     = displayDate();
  const { week } = isoWeek(dd);
  const monday   = getMonday(dd);
  const label    = el('sp-week-label');
  if (label) label.textContent = `KW ${week} · ${monday.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
  const todayBtn = el('sp-today-btn');
  if (todayBtn) todayBtn.style.display = _weekOffset !== 0 ? 'inline' : 'none';
}

function renderGrid() {
  // If API is unavailable, render the SP fallback
  if (_usingFallback) {
    renderSpGrid();
    return;
  }

  const container = el('sp-grid-container');
  if (!container) return;

  const dd     = displayDate();
  const { week, year } = isoWeek(dd);
  const cache  = getScheduleCache();
  const cached = cache[`${week}-${year}`];
  const grid   = cached?.grid ?? null;
  const { stunden, times } = getHoursCache();
  const todayIdx = (new Date().getDay() + 6) % 7;

  if (!grid) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--on-surface-variant);font-size:13px;">
      ${isConfigured() ? 'Lade Stundenplan…' : 'Kein Stundenplan geladen.'}</div>`;
    return;
  }

  let html = `<div style="overflow-x:auto;">
    <table style="border-collapse:collapse;width:100%;min-width:380px;table-layout:fixed;">
      <thead><tr>
        <th style="width:48px;padding:6px 4px 4px;font-size:10px;color:var(--on-surface-variant);font-weight:400;text-align:right;"></th>`;

  for (let i = 0; i < 5; i++) {
    const today = _weekOffset === 0 && i === todayIdx;
    html += `<th style="padding:6px 4px 4px;font-size:12px;font-weight:600;text-align:center;color:${today ? '#ddb7ff' : 'var(--on-surface)'};">${DAYS[i]}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (let si = 0; si < stunden.length; si++) {
    const hasAny = [0,1,2,3,4].some(ti => grid[ti]?.[si]);
    if (!hasAny) continue;

    html += `<tr><td style="padding:3px 4px;font-size:10px;color:var(--on-surface-variant);text-align:right;white-space:nowrap;vertical-align:middle;">${times[si] ?? ''}</td>`;

    for (let ti = 0; ti < 5; ti++) {
      const cell = grid[ti]?.[si] ?? null;
      if (!cell) { html += `<td style="padding:3px;"><div style="height:44px;"></div></td>`; continue; }

      const msg         = (cell.message ?? '').toLowerCase();
      const isCancelled = !cell.kuerzel || msg.includes('entfall') || msg.includes('frei');
      const isSub       = !isCancelled && !!cell.standin;

      let bg: string, fg: string, border: string;
      if (isCancelled) { bg = 'rgba(255,255,255,.04)'; fg = 'rgba(255,255,255,.25)'; border = 'rgba(255,255,255,.08)'; }
      else if (isSub)  { bg = 'rgba(255,214,100,.09)'; fg = '#ffd664';               border = 'rgba(255,214,100,.25)'; }
      else             { ({ bg, fg, border } = CELL_COLORS[cell.colorIdx]); }

      html += `<td style="padding:3px;">
        <div style="padding:5px 6px;border-radius:8px;background:${bg};border:1px solid ${border};text-align:center;${isCancelled ? 'opacity:.4;' : ''}">
          <div style="font-size:12px;font-weight:600;color:${fg};${isCancelled ? 'text-decoration:line-through;' : ''}">${cell.kuerzel || '—'}</div>
          <div style="font-size:10px;color:${fg};opacity:.7;margin-top:1px;">${isSub ? (cell.lehrer || cell.raum) : cell.raum}</div>
          ${cell.message ? `<div style="font-size:9px;color:rgba(255,255,255,.35);margin-top:1px;line-height:1.2;">${cell.message}</div>` : ''}
        </div>
      </td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function renderKlausurenStatus() {
  const s = el('sp-kl-status');
  if (!s) return;
  if (_loadingKl) {
    s.style.display = 'flex';
    s.innerHTML = `<span style="font-size:12px;color:var(--on-surface-variant);">Lade Prüfungen aus Schulplan…</span>`;
  } else if (isConfigured() && _apiTests.length > 0) {
    s.style.display = 'flex';
    s.innerHTML = `<span style="font-size:12px;color:var(--on-surface-variant);">${_apiTests.length} Prüfung${_apiTests.length !== 1 ? 'en' : ''} aus Schulplan geladen</span>`;
  } else {
    s.style.display = 'none';
  }
}

function renderKlausuren() {
  renderKlausurenStatus();
  const upcomingEl = el('sp-kl-upcoming');
  const pastEl     = el('sp-kl-past');
  if (!upcomingEl || !pastEl) return;

  const klausuren  = getKlausuren();
  const configured = isConfigured();
  const now        = new Date();

  type AnyEntry = (typeof _apiTests[0] | ManualKlausur) & { fromApi?: true };
  const allUpcoming: AnyEntry[] = [
    ..._apiTests,
    ...(configured ? [] : klausuren.filter(k => new Date(k.datum) >= now)),
  ].sort((a, b) => a.datum.localeCompare(b.datum));

  const manualPast = klausuren
    .filter(k => new Date(k.datum) < now)
    .sort((a, b) => b.datum.localeCompare(a.datum));

  if (allUpcoming.length === 0) {
    upcomingEl.innerHTML = `<div style="text-align:center;padding:28px;color:var(--on-surface-variant);font-size:13px;">Keine bevorstehenden Prüfungen 🎉</div>`;
  } else {
    upcomingEl.innerHTML = allUpcoming.map(k => {
      const days   = Math.ceil((new Date(k.datum).getTime() - Date.now()) / 86400000);
      const urgent = days <= 3;
      const isApi  = (k as { fromApi?: true }).fromApi;
      const dt     = new Date(k.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
      const meta   = [
        dt,
        isApi && (k as typeof _apiTests[0]).vonStunde != null ? `${(k as typeof _apiTests[0]).vonStunde}. Stunde` : null,
        !isApi && (k as ManualKlausur).dauer ? `${(k as ManualKlausur).dauer} Min.` : null,
        (k as typeof _apiTests[0]).raum   ?? null,
        (k as typeof _apiTests[0]).lehrer ?? null,
      ].filter(Boolean).join(' · ');

      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:12px;border-left:3px solid ${urgent ? '#f87171' : 'rgba(221,183,255,.35)'};">
        <div style="text-align:center;flex-shrink:0;min-width:36px;">
          <div style="font-size:22px;font-weight:700;color:${urgent ? '#f87171' : '#ddb7ff'};line-height:1;">${days}</div>
          <div style="font-size:10px;color:var(--on-surface-variant);">Tage</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--on-surface);">${k.fach}${k.thema ? ` · ${k.thema}` : ''}</div>
          <div style="font-size:11px;color:var(--on-surface-variant);margin-top:2px;">${meta}</div>
        </div>
        ${!isApi ? `<button onclick="spDeleteKlausur('${k.id}')" title="Löschen"
          style="background:none;border:none;cursor:pointer;padding:4px;color:var(--on-surface-variant);display:inline-flex;border-radius:6px;"
          onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='var(--on-surface-variant)'">
          <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
        </button>` : ''}
      </div>`;
    }).join('');
  }

  if (manualPast.length === 0) {
    pastEl.style.display = 'none';
  } else {
    pastEl.style.display = 'block';
    const listEl = pastEl.querySelector('.sp-kl-past-list') as HTMLElement | null;
    if (listEl) listEl.innerHTML = manualPast.map(k => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--surface-container-low);border-radius:10px;opacity:.6;">
        <div style="flex:1;font-size:13px;color:var(--on-surface);">${k.fach}${k.thema ? ` · ${k.thema}` : ''}</div>
        <div style="font-size:11px;color:var(--on-surface-variant);font-family:monospace;">${k.datum}</div>
        <button onclick="spDeleteKlausur('${k.id}')" style="background:none;border:none;cursor:pointer;padding:2px;color:var(--on-surface-variant);display:inline-flex;"
          onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='var(--on-surface-variant)'">
          <span class="material-symbols-outlined" style="font-size:14px;">delete</span>
        </button>
      </div>`).join('');
  }
}

// ── Public functions (called from HTML) ──────────────────────────────────────

export function initStundenplan(): void {
  renderSettings();
  renderWeekNav();
  fetchSchedule();
  fetchKlausuren();
}

export function switchSpTab(tab: 'stundenplan' | 'pruefungen'): void {
  (['stundenplan', 'pruefungen'] as const).forEach(t => {
    const panel = el(`sp-panel-${t}`);
    const btn   = el(`sp-tab-${t}`);
    const active = t === tab;
    if (panel) panel.style.display = active ? 'block' : 'none';
    if (btn) {
      btn.style.background = active ? 'rgba(221,183,255,0.12)' : 'transparent';
      btn.style.color      = active ? '#ddb7ff' : '#988d9f';
      btn.style.fontWeight = active ? '600' : '400';
    }
  });
  if (tab === 'pruefungen' && isConfigured() && !_loadingKl && _apiTests.length === 0) {
    fetchKlausuren();
  }
}

export function spToggleSettings(): void {
  _settingsOpen = !_settingsOpen;
  const panel = el('sp-settings-panel');
  if (panel) panel.style.display = _settingsOpen ? 'block' : 'none';
}

export function spSaveSettings(): void {
  const input = el<HTMLInputElement>('sp-user-input');
  const user  = input?.value.trim() ?? '';
  localStorage.setItem(K.user, user);
  [K.classId, K.classAlias, K.group].forEach(k => localStorage.removeItem(k));
  _settingsOpen = false;
  const panel = el('sp-settings-panel');
  if (panel) panel.style.display = 'none';
  renderSettings();
  fetchSchedule(true);
  fetchKlausuren();
}

export function spPrevWeek(): void { _weekOffset--; renderWeekNav(); fetchSchedule(); }
export function spNextWeek(): void { _weekOffset++; renderWeekNav(); fetchSchedule(); }
export function spToday():    void { _weekOffset = 0; renderWeekNav(); fetchSchedule(); }
export function spRefresh():  void { fetchSchedule(true); }

export function spAddKlausur(e: Event): void {
  e.preventDefault();
  const fach  = (el<HTMLInputElement>('sp-kl-fach')?.value  ?? '').trim();
  const thema = (el<HTMLInputElement>('sp-kl-thema')?.value ?? '').trim();
  const datum = el<HTMLInputElement>('sp-kl-datum')?.value ?? '';
  const dauer = parseInt(el<HTMLInputElement>('sp-kl-dauer')?.value ?? '60') || 60;
  if (!fach || !datum) return;

  const list = getKlausuren();
  list.push({ id: `manual-${Date.now()}`, fach, thema, datum, dauer });
  lsSet(K.klausuren, list);

  const fachEl  = el<HTMLInputElement>('sp-kl-fach');
  const themaEl = el<HTMLInputElement>('sp-kl-thema');
  const datumEl = el<HTMLInputElement>('sp-kl-datum');
  if (fachEl)  fachEl.value  = '';
  if (themaEl) themaEl.value = '';
  if (datumEl) datumEl.value = '';
  renderKlausuren();
}

export function spDeleteKlausur(id: string): void {
  lsSet(K.klausuren, getKlausuren().filter(k => k.id !== id));
  renderKlausuren();
}
