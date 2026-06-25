import { applyTheme, cycleTheme, initTheme } from './ui/theme.js';
import { toggleSidebar, initSidebar } from './ui/sidebar.js';
import { loadWeather } from './features/weather.js';
import { toggleStatsPanel, loadStatsPanel } from './features/stats.js';
import { openPomodoro, closePomodoro, pomoSetMode, togglePomodoro, resetPomodoro } from './features/pomodoro.js';
import { openFokusMusik, closeFokusMusik, playMusik, musikNav } from './features/musik.js';
import { openAtemPause, closeAtemPause, toggleAtemPause, resetAtem } from './features/atem.js';
import { updateClock, updateFerien, updateStunden, showQuote, showFact, nextFact, openFactPopup, closeFactPopup, showInlineFact, nextInlineFact } from './pages/landing.js';
import { initTipp, nextTipp, prevTipp } from './features/tipp.js';
import { updateSchoolClock, toggleSchCat } from './pages/school.js';
import { ssToggleSubject, ssSelect, ssNav } from './pages/schulstoff.js';
import { initStundenplan, switchSpTab, spToggleSettings, spSaveSettings, spPrevWeek, spNextWeek, spToday, spRefresh, spAddKlausur, spDeleteKlausur } from './pages/stundenplan.js';
import { initChangelog } from './features/changelog.js';

/* ── Info-Widget Tabs ── */
function switchInfoTab(tab: 'neuigkeiten' | 'tipp' | 'funfact'): void {
  const tabs = ['neuigkeiten', 'tipp', 'funfact'] as const;
  tabs.forEach(t => {
    const panel = document.getElementById('info-panel-' + t);
    const btn   = document.getElementById('info-tab-' + t);
    const active = t === tab;
    if (panel) panel.style.display = active ? 'flex' : 'none';
    if (btn) {
      btn.style.background = active ? 'rgba(221,183,255,0.12)' : 'transparent';
      btn.style.color      = active ? '#ddb7ff' : '#988d9f';
      btn.style.fontWeight = active ? '600' : '400';
    }
  });
  if (tab === 'tipp')    initTipp();
  if (tab === 'funfact') showInlineFact();
}

/* ── Navigation ── */
const ALL_PAGES = ['landing', 'school', 'schulstoff', 'stundenplan', 'gaming', 'early-access'];

function goPage(id: string, pushState = true): void {
  ALL_PAGES.forEach(p => document.getElementById('page-' + p)?.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('active');

  document.querySelectorAll<HTMLElement>('.nav-item').forEach(el => {
    el.classList.remove('nav-active');
    el.classList.add('text-slate-400', 'dark:text-slate-500');
  });
  const a = document.getElementById('nav-' + id);
  if (a) { a.classList.add('nav-active'); a.classList.remove('text-slate-400', 'dark:text-slate-500'); }

  document.querySelectorAll<HTMLElement>('.topnav-item').forEach(el => {
    el.classList.remove('text-purple-500', 'dark:text-purple-400', 'border-purple-500');
    el.classList.add('text-slate-400', 'dark:text-slate-500', 'border-transparent');
  });
  const tn = document.getElementById('topnav-' + id);
  if (tn) {
    tn.classList.remove('text-slate-400', 'dark:text-slate-500', 'border-transparent');
    tn.classList.add('text-purple-500', 'dark:text-purple-400', 'border-purple-500');
  }

  if (pushState) {
    const hash = id === 'landing' ? '' : '#' + id;
    history.pushState({ page: id }, '', location.pathname + hash);
  }
}

window.addEventListener('popstate', (e) => {
  const page = (e.state as { page?: string } | null)?.page
    ?? (location.hash.slice(1) || 'landing');
  const target = ALL_PAGES.includes(page) ? page : 'landing';
  goPage(target, false);
});

/* ── Expose to window (HTML onclick handlers) ── */
declare global {
  interface Window {
    goPage: typeof goPage;
    cycleTheme: typeof cycleTheme;
    toggleSidebar: typeof toggleSidebar;
    loadWeather: typeof loadWeather;
    toggleStatsPanel: typeof toggleStatsPanel;
    loadStatsPanel: typeof loadStatsPanel;
    openPomodoro: typeof openPomodoro;
    closePomodoro: typeof closePomodoro;
    pomoSetMode: typeof pomoSetMode;
    togglePomodoro: typeof togglePomodoro;
    resetPomodoro: typeof resetPomodoro;
    openFokusMusik: typeof openFokusMusik;
    closeFokusMusik: typeof closeFokusMusik;
    playMusik: typeof playMusik;
    musikNav: typeof musikNav;
    openAtemPause: typeof openAtemPause;
    closeAtemPause: typeof closeAtemPause;
    toggleAtemPause: typeof toggleAtemPause;
    resetAtem: typeof resetAtem;
    updateClock: typeof updateClock;
    showQuote: typeof showQuote;
    showFact: typeof showFact;
    nextFact: typeof nextFact;
    openFactPopup: typeof openFactPopup;
    closeFactPopup: typeof closeFactPopup;
    showInlineFact: typeof showInlineFact;
    nextInlineFact: typeof nextInlineFact;
    initTipp: typeof initTipp;
    nextTipp: typeof nextTipp;
    prevTipp: typeof prevTipp;
    switchInfoTab: typeof switchInfoTab;
    toggleSchCat: typeof toggleSchCat;
    ssToggleSubject: typeof ssToggleSubject;
    ssSelect: typeof ssSelect;
    ssNav: typeof ssNav;
    initStundenplan: typeof initStundenplan;
    switchSpTab: typeof switchSpTab;
    spToggleSettings: typeof spToggleSettings;
    spSaveSettings: typeof spSaveSettings;
    spPrevWeek: typeof spPrevWeek;
    spNextWeek: typeof spNextWeek;
    spToday: typeof spToday;
    spRefresh: typeof spRefresh;
    spAddKlausur: typeof spAddKlausur;
    spDeleteKlausur: typeof spDeleteKlausur;
  }
}

window.goPage = goPage;
window.cycleTheme = cycleTheme;
window.toggleSidebar = toggleSidebar;
window.loadWeather = loadWeather;
window.toggleStatsPanel = toggleStatsPanel;
window.loadStatsPanel = loadStatsPanel;
window.openPomodoro = openPomodoro;
window.closePomodoro = closePomodoro;
window.pomoSetMode = pomoSetMode;
window.togglePomodoro = togglePomodoro;
window.resetPomodoro = resetPomodoro;
window.openFokusMusik = openFokusMusik;
window.closeFokusMusik = closeFokusMusik;
window.playMusik = playMusik;
window.musikNav = musikNav;
window.openAtemPause = openAtemPause;
window.closeAtemPause = closeAtemPause;
window.toggleAtemPause = toggleAtemPause;
window.resetAtem = resetAtem;
window.updateClock = updateClock;
window.showQuote = showQuote;
window.showFact = showFact;
window.nextFact = nextFact;
window.openFactPopup = openFactPopup;
window.closeFactPopup = closeFactPopup;
window.showInlineFact = showInlineFact;
window.nextInlineFact = nextInlineFact;
window.initTipp = initTipp;
window.nextTipp = nextTipp;
window.prevTipp = prevTipp;
window.switchInfoTab = switchInfoTab;
window.toggleSchCat = toggleSchCat;
window.ssToggleSubject = ssToggleSubject;
window.ssSelect = ssSelect;
window.ssNav = ssNav;
window.initStundenplan = initStundenplan;
window.switchSpTab = switchSpTab;
window.spToggleSettings = spToggleSettings;
window.spSaveSettings = spSaveSettings;
window.spPrevWeek = spPrevWeek;
window.spNextWeek = spNextWeek;
window.spToday = spToday;
window.spRefresh = spRefresh;
window.spAddKlausur = spAddKlausur;
window.spDeleteKlausur = spDeleteKlausur;

/* ── Init ── */
initTheme();
initSidebar();

const initialPage = location.hash.slice(1);
if (initialPage && ALL_PAGES.includes(initialPage)) {
  goPage(initialPage, false);
}
history.replaceState(
  { page: initialPage && ALL_PAGES.includes(initialPage) ? initialPage : 'landing' },
  '',
  location.href
);
updateClock();
updateFerien();
updateStunden();
showQuote();
showFact();
loadWeather();
initChangelog();
initTipp();
showInlineFact();
updateSchoolClock();
initStundenplan();
setInterval(updateClock, 30000);
setInterval(updateStunden, 60000);
setInterval(updateSchoolClock, 30000);
