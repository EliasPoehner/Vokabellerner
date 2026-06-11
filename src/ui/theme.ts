import type { ThemeMode } from '../types.ts';

const THEMES: ThemeMode[] = ['system', 'light', 'dark'];
const ICONS: Record<ThemeMode, string> = { system: 'brightness_auto', light: 'light_mode', dark: 'dark_mode' };
const LABELS: Record<ThemeMode, string> = { system: 'System', light: 'Hell', dark: 'Dunkel' };

let mode: ThemeMode = (localStorage.getItem('hub-theme') as ThemeMode) || 'system';

export function applyTheme(m: ThemeMode): void {
  const html = document.documentElement;
  html.classList.remove('dark', 'light');
  if (m === 'dark') html.classList.add('dark');
  else if (m === 'light') html.classList.add('light');
  else html.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (icon) icon.textContent = ICONS[m];
  if (label) label.textContent = LABELS[m];
}

export function cycleTheme(): void {
  mode = THEMES[(THEMES.indexOf(mode) + 1) % THEMES.length];
  localStorage.setItem('hub-theme', mode);
  applyTheme(mode);
}

export function initTheme(): void {
  applyTheme(mode);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (mode === 'system') applyTheme('system');
  });
}
