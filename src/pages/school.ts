import { getKW } from './landing.js';

export function updateSchoolClock(): void {
  const n = new Date();
  const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const h = n.getHours();
  const elG = document.getElementById('school-greeting');
  const elW = document.getElementById('school-weekday');
  const elT = document.getElementById('school-time');
  const elK = document.getElementById('school-kw');
  if (!elG) return;
  elG.textContent = h < 12 ? 'Guten Morgen ☀️' : h < 18 ? 'Guten Tag 🌤️' : 'Guten Abend 🌙';
  if (elW) elW.textContent = WT[n.getDay()];
  if (elT) elT.textContent = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  if (elK) elK.textContent = 'KW ' + getKW(n);
}

export function toggleSchCat(id: string): void {
  const body = document.getElementById(id);
  const chevron = document.getElementById(id + '-chevron');
  if (!body) return;
  const isOpen = !body.classList.contains('hidden');
  body.classList.toggle('hidden', isOpen);
  if (chevron) chevron.textContent = isOpen ? 'expand_more' : 'expand_less';
}
