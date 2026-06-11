import { applyTheme, cycleTheme, initTheme } from './ui/theme.js';
import { toggleSidebar, initSidebar } from './ui/sidebar.js';
import { loadWeather } from './features/weather.js';
import { toggleStatsPanel, loadStatsPanel } from './features/stats.js';
import { openPomodoro, closePomodoro, pomoSetMode, togglePomodoro, resetPomodoro } from './features/pomodoro.js';
import { openFokusMusik, closeFokusMusik, playMusik, musikNav } from './features/musik.js';
import { openAtemPause, closeAtemPause, toggleAtemPause, resetAtem } from './features/atem.js';
import { updateClock, updateFerien, updateStunden, showQuote, showFact, nextFact, openFactPopup, closeFactPopup } from './pages/landing.js';
import { updateSchoolClock, toggleSchCat } from './pages/school.js';
import { ssToggleSubject, ssSelect, ssNav } from './pages/schulstoff.js';

/* ── Navigation ── */
const ALL_PAGES = ['landing', 'school', 'schulstoff', 'gaming', 'early-access'];

function goPage(id: string): void {
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
}

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
    toggleSchCat: typeof toggleSchCat;
    ssToggleSubject: typeof ssToggleSubject;
    ssSelect: typeof ssSelect;
    ssNav: typeof ssNav;
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
window.toggleSchCat = toggleSchCat;
window.ssToggleSubject = ssToggleSubject;
window.ssSelect = ssSelect;
window.ssNav = ssNav;

/* ── Init ── */
initTheme();
initSidebar();
updateClock();
updateFerien();
updateStunden();
showQuote();
showFact();
loadWeather();
updateSchoolClock();
setInterval(updateClock, 30000);
setInterval(updateStunden, 60000);
setInterval(updateSchoolClock, 30000);
