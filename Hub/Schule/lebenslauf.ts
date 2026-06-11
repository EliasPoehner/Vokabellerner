import '../Style/hub.css';
import '../Style/hub-index.css';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

// ── Types ──────────────────────────────────────────────────────────────────

interface Personal {
  name: string; title: string; address: string;
  phone: string; email: string; website: string; photoDataUrl: string;
}
interface ExpEntry   { id: string; company: string; position: string; from: string; to: string; description: string; }
interface EduEntry   { id: string; school: string; degree: string; from: string; to: string; grade: string; }
interface SkillEntry { id: string; name: string; level: number; }
interface LangEntry  { id: string; name: string; level: string; }
interface ProjEntry  { id: string; title: string; description: string; link: string; }

interface CVData {
  personal: Personal;
  experience: ExpEntry[];
  education: EduEntry[];
  skills: SkillEntry[];
  languages: LangEntry[];
  projects: ProjEntry[];
  hobbies: string[];
  accentColor: string;
}

// ── Storage ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lebenslauf_v1';

function defaultData(): CVData {
  return {
    personal: { name: '', title: '', address: '', phone: '', email: '', website: '', photoDataUrl: '' },
    experience: [], education: [], skills: [], languages: [],
    projects: [], hobbies: [], accentColor: '#ddb7ff',
  };
}

function loadFromStorage(): CVData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultData(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultData();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveToStorage(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    flashSaved();
  }, 500);
}

function flashSaved(): void {
  const el = document.getElementById('saved-badge');
  if (!el) return;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 1500);
}

// ── State ──────────────────────────────────────────────────────────────────

let data: CVData = loadFromStorage();
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let eventsAttached = false;

function schedulePreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 150);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Form HTML builders ─────────────────────────────────────────────────────

function sectionBox(id: string, icon: string, title: string, inner: string): string {
  return `
    <div class="rounded-xl border border-slate-800 bg-surface-container-low overflow-hidden">
      <button type="button" data-toggle="${id}"
        class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-high transition-colors group">
        <span class="material-symbols-outlined text-primary flex-shrink-0" style="font-size:18px">${icon}</span>
        <span class="text-sm font-semibold text-on-surface">${title}</span>
        <span class="material-symbols-outlined ml-auto text-slate-500 flex-shrink-0 transition-transform duration-200"
              id="chev-${id}" style="font-size:18px;transform:rotate(180deg)">expand_more</span>
      </button>
      <div id="sec-${id}" class="px-4 pb-4 flex flex-col gap-3">${inner}</div>
    </div>`;
}

function fld(key: string, label: string, value: string, span2 = false): string {
  return `
    <div${span2 ? ' class="col-span-2"' : ''}>
      <label class="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1">${label}</label>
      <input type="text" data-key="${key}" value="${esc(value)}"
        class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-on-surface
               focus:border-primary/50 focus:ring-0 focus:outline-none transition-colors" />
    </div>`;
}

function fldItem(id: string, field: string, label: string, value: string, span2 = false): string {
  return `
    <div${span2 ? ' class="col-span-2"' : ''}>
      <label class="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1">${label}</label>
      <input type="text" data-item="${id}" data-field="${field}" value="${esc(value)}"
        class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-on-surface
               focus:border-primary/50 focus:ring-0 focus:outline-none transition-colors" />
    </div>`;
}

function itemCard(id: string, inner: string): string {
  return `
    <div class="relative rounded-lg border border-slate-700 bg-slate-900/60 p-3 group"
         draggable="true" data-item-id="${id}">
      <button type="button" data-delete="${id}"
        class="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 z-10">
        <span class="material-symbols-outlined" style="font-size:16px">close</span>
      </button>
      <div class="flex flex-col gap-2 pr-4">${inner}</div>
    </div>`;
}

function repeatSection(key: string, title: string, icon: string, itemsHtml: string): string {
  return sectionBox(key, icon, title, `
    <div id="list-${key}" class="flex flex-col gap-2">${itemsHtml}</div>
    <button type="button" data-add="${key}"
      class="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-secondary/80 transition-colors py-1 mt-1 self-start">
      <span class="material-symbols-outlined" style="font-size:16px">add_circle</span>
      Eintrag hinzufügen
    </button>`);
}

function buildPersonalHtml(): string {
  const p = data.personal;
  return sectionBox('personal', 'person', 'Persönliche Daten', `
    <div class="grid grid-cols-1 @[280px]:grid-cols-2 gap-2">
      ${fld('personal.name', 'Name', p.name, true)}
      ${fld('personal.title', 'Berufsbezeichnung', p.title, true)}
      ${fld('personal.address', 'Adresse', p.address, true)}
      ${fld('personal.phone', 'Telefon', p.phone)}
      ${fld('personal.email', 'E-Mail', p.email)}
      ${fld('personal.website', 'Website', p.website)}
    </div>
    <div>
      <label class="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1.5">Bewerbungsfoto</label>
      <div class="flex items-center gap-3">
        <div class="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
          ${p.photoDataUrl
            ? `<img src="${p.photoDataUrl}" class="w-full h-full object-cover" />`
            : `<span class="material-symbols-outlined text-slate-600" style="font-size:24px">person</span>`}
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="cursor-pointer px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/20 transition-colors">
            Foto wählen
            <input type="file" id="photo-input" accept="image/*" class="hidden" />
          </label>
          ${p.photoDataUrl
            ? `<button type="button" id="photo-remove" class="text-xs text-slate-500 hover:text-red-400 transition-colors text-left">Entfernen</button>`
            : ''}
        </div>
      </div>
    </div>`);
}

function buildExpHtml(e: ExpEntry): string {
  return itemCard(e.id, `
    <div class="grid grid-cols-1 @[280px]:grid-cols-2 gap-2">
      ${fldItem(e.id, 'company', 'Unternehmen', e.company, true)}
      ${fldItem(e.id, 'position', 'Position', e.position, true)}
      ${fldItem(e.id, 'from', 'Von', e.from)}
      ${fldItem(e.id, 'to', 'Bis / Heute', e.to)}
    </div>
    <div>
      <label class="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1">Beschreibung</label>
      <textarea data-item="${e.id}" data-field="description" rows="2"
        class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-on-surface
               focus:border-primary/50 focus:ring-0 focus:outline-none transition-colors resize-none">${esc(e.description)}</textarea>
    </div>`);
}

function buildEduHtml(e: EduEntry): string {
  return itemCard(e.id, `
    <div class="grid grid-cols-1 @[280px]:grid-cols-2 gap-2">
      ${fldItem(e.id, 'school', 'Schule / Universität', e.school, true)}
      ${fldItem(e.id, 'degree', 'Abschluss', e.degree, true)}
      ${fldItem(e.id, 'from', 'Von', e.from)}
      ${fldItem(e.id, 'to', 'Bis', e.to)}
      ${fldItem(e.id, 'grade', 'Note (optional)', e.grade)}
    </div>`);
}

function buildSkillHtml(s: SkillEntry): string {
  const dots = [1, 2, 3, 4, 5].map(n => `
    <button type="button" data-skill-dot="${s.id}:${n}" title="Level ${n}"
      class="w-3.5 h-3.5 rounded-full border transition-all ${n <= s.level
        ? 'bg-primary border-primary'
        : 'border-slate-600 hover:border-primary/50'}">
    </button>`).join('');
  return itemCard(s.id, `
    <div class="flex items-center gap-3">
      <input type="text" data-item="${s.id}" data-field="name" value="${esc(s.name)}"
        placeholder="Fähigkeit (z.B. TypeScript)"
        class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-on-surface
               focus:border-primary/50 focus:ring-0 focus:outline-none transition-colors" />
      <div class="flex items-center gap-1 flex-shrink-0">${dots}</div>
    </div>`);
}

function buildLangHtml(l: LangEntry): string {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Muttersprache'];
  const opts = levels.map(lv => `<option value="${lv}"${lv === l.level ? ' selected' : ''}>${lv}</option>`).join('');
  return itemCard(l.id, `
    <div class="flex items-center gap-2">
      <input type="text" data-item="${l.id}" data-field="name" value="${esc(l.name)}"
        placeholder="Sprache"
        class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-on-surface
               focus:border-primary/50 focus:ring-0 focus:outline-none transition-colors" />
      <select data-item="${l.id}" data-field="level"
        class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-on-surface
               focus:border-primary/50 focus:ring-0 focus:outline-none transition-colors flex-shrink-0">
        ${opts}
      </select>
    </div>`);
}

function buildProjHtml(pr: ProjEntry): string {
  return itemCard(pr.id, `
    ${fldItem(pr.id, 'title', 'Titel', pr.title)}
    ${fldItem(pr.id, 'link', 'Link (optional)', pr.link)}
    <div>
      <label class="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1">Beschreibung</label>
      <textarea data-item="${pr.id}" data-field="description" rows="2"
        class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-on-surface
               focus:border-primary/50 focus:ring-0 focus:outline-none transition-colors resize-none">${esc(pr.description)}</textarea>
    </div>`);
}

function buildHobbiesHtml(): string {
  const tags = data.hobbies.map(h => `
    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-on-surface-variant">
      ${esc(h)}
      <button type="button" data-del-hobby="${esc(h)}" class="text-slate-500 hover:text-red-400 transition-colors">
        <span class="material-symbols-outlined" style="font-size:11px;line-height:1;vertical-align:middle">close</span>
      </button>
    </span>`).join('');
  return sectionBox('hobbies', 'favorite', 'Hobbys', `
    <div id="hobby-tags" class="flex flex-wrap gap-2 min-h-[24px]">${tags}</div>
    <div class="flex gap-2">
      <input type="text" id="hobby-input" placeholder="Hobby eingeben, Enter drücken"
        class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-on-surface
               focus:border-primary/50 focus:ring-0 focus:outline-none transition-colors" />
      <button type="button" id="hobby-add"
        class="px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors flex-shrink-0">
        <span class="material-symbols-outlined" style="font-size:16px">add</span>
      </button>
    </div>`);
}

function buildFormHTML(): string {
  return `
    ${buildPersonalHtml()}
    ${repeatSection('experience', 'Berufserfahrung', 'work', data.experience.map(buildExpHtml).join(''))}
    ${repeatSection('education', 'Ausbildung', 'school', data.education.map(buildEduHtml).join(''))}
    ${repeatSection('skills', 'Fähigkeiten', 'psychology', data.skills.map(buildSkillHtml).join(''))}
    ${repeatSection('languages', 'Sprachen', 'translate', data.languages.map(buildLangHtml).join(''))}
    ${repeatSection('projects', 'Projekte', 'code', data.projects.map(buildProjHtml).join(''))}
    ${buildHobbiesHtml()}`;
}

// ── Form rendering ─────────────────────────────────────────────────────────

function renderForm(): void {
  const container = document.getElementById('panel-form');
  if (!container) return;
  container.innerHTML = buildFormHTML();
  if (!eventsAttached) {
    attachFormEvents(container);
    eventsAttached = true;
  }
}

// ── Event handling ─────────────────────────────────────────────────────────

function attachFormEvents(container: HTMLElement): void {

  // ── Clicks (delegation) ────────────────────────────────────────────
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Toggle section
    const toggleBtn = target.closest('[data-toggle]') as HTMLElement | null;
    if (toggleBtn) {
      const id = toggleBtn.dataset.toggle!;
      const sec  = document.getElementById(`sec-${id}`);
      const chev = document.getElementById(`chev-${id}`);
      if (sec) {
        const nowHidden = sec.classList.toggle('hidden');
        if (chev) chev.style.transform = nowHidden ? '' : 'rotate(180deg)';
      }
      return;
    }

    // Delete item
    const delBtn = target.closest('[data-delete]') as HTMLElement | null;
    if (delBtn) { deleteItem(delBtn.dataset.delete!); return; }

    // Add item
    const addBtn = target.closest('[data-add]') as HTMLElement | null;
    if (addBtn) { addItem(addBtn.dataset.add!); return; }

    // Skill dot
    const dotBtn = target.closest('[data-skill-dot]') as HTMLElement | null;
    if (dotBtn) {
      const [id, lvlStr] = dotBtn.dataset.skillDot!.split(':');
      const skill = data.skills.find(s => s.id === id);
      if (skill) {
        skill.level = parseInt(lvlStr, 10);
        updateSkillDots(id, skill.level);
        saveToStorage();
        schedulePreview();
      }
      return;
    }

    // Delete hobby
    const delHobby = target.closest('[data-del-hobby]') as HTMLElement | null;
    if (delHobby) {
      data.hobbies = data.hobbies.filter(h => h !== delHobby.dataset.delHobby);
      saveToStorage(); schedulePreview(); renderForm();
      return;
    }

    // Photo remove
    if (target.id === 'photo-remove' || target.closest('#photo-remove')) {
      data.personal.photoDataUrl = '';
      saveToStorage(); schedulePreview(); renderForm();
    }
  });

  // ── Input / change (delegation) ────────────────────────────────────
  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    if (target.dataset.key) {
      const [section, field] = target.dataset.key.split('.');
      (data as unknown as Record<string, Record<string, string>>)[section][field] = target.value;
    }

    if (target.dataset.item && target.dataset.field) {
      updateItemField(target.dataset.item, target.dataset.field, target.value);
    }

    saveToStorage();
    schedulePreview();
  });

  // ── Photo file input ───────────────────────────────────────────────
  container.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.id !== 'photo-input' || !target.files?.length) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      data.personal.photoDataUrl = ev.target?.result as string;
      saveToStorage(); schedulePreview(); renderForm();
    };
    reader.readAsDataURL(target.files[0]);
  });

  // ── Hobby input ────────────────────────────────────────────────────
  container.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'hobby-input' && (e as KeyboardEvent).key === 'Enter') {
      e.preventDefault();
      addHobby();
    }
  });

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'hobby-add' || target.closest('#hobby-add')) addHobby();
  }, true); // capture for the duplicate listener

  // ── Drag-to-reorder ────────────────────────────────────────────────
  setupDragAndDrop(container);
}

function addHobby(): void {
  const input = document.getElementById('hobby-input') as HTMLInputElement | null;
  if (!input) return;
  const val = input.value.trim();
  if (val && !data.hobbies.includes(val)) {
    data.hobbies.push(val);
    input.value = '';
    saveToStorage(); schedulePreview(); renderForm();
  }
}

function updateSkillDots(skillId: string, level: number): void {
  const card = document.querySelector(`[data-item-id="${skillId}"]`);
  if (!card) return;
  card.querySelectorAll('[data-skill-dot]').forEach(btn => {
    const [, n] = (btn as HTMLElement).dataset.skillDot!.split(':');
    const num = parseInt(n, 10);
    if (num <= level) {
      (btn as HTMLElement).classList.add('bg-primary', 'border-primary');
      (btn as HTMLElement).classList.remove('border-slate-600');
    } else {
      (btn as HTMLElement).classList.remove('bg-primary', 'border-primary');
      (btn as HTMLElement).classList.add('border-slate-600');
    }
  });
}

// ── CRUD helpers ───────────────────────────────────────────────────────────

type ArrayKey = 'experience' | 'education' | 'skills' | 'languages' | 'projects';
const ARR_KEYS: ArrayKey[] = ['experience', 'education', 'skills', 'languages', 'projects'];

function addItem(key: string): void {
  const id = uid();
  switch (key as ArrayKey) {
    case 'experience': data.experience.push({ id, company: '', position: '', from: '', to: '', description: '' }); break;
    case 'education':  data.education.push({ id, school: '', degree: '', from: '', to: '', grade: '' }); break;
    case 'skills':     data.skills.push({ id, name: '', level: 3 }); break;
    case 'languages':  data.languages.push({ id, name: '', level: 'A1' }); break;
    case 'projects':   data.projects.push({ id, title: '', description: '', link: '' }); break;
  }
  eventsAttached = false; // allow re-attach after re-render
  saveToStorage(); schedulePreview(); renderForm();
}

function deleteItem(id: string): void {
  for (const key of ARR_KEYS) {
    const arr = data[key] as { id: string }[];
    const idx = arr.findIndex(item => item.id === id);
    if (idx !== -1) {
      arr.splice(idx, 1);
      eventsAttached = false;
      saveToStorage(); schedulePreview(); renderForm();
      return;
    }
  }
}

function updateItemField(id: string, field: string, value: string): void {
  for (const key of ARR_KEYS) {
    const item = (data[key] as unknown as Record<string, string>[]).find(i => i.id === id);
    if (item) { item[field] = value; return; }
  }
}

// ── Drag-to-reorder ────────────────────────────────────────────────────────

function setupDragAndDrop(container: HTMLElement): void {
  let dragId: string | null = null;

  container.addEventListener('dragstart', (e) => {
    const el = (e.target as HTMLElement).closest('[data-item-id]') as HTMLElement | null;
    if (!el) return;
    dragId = el.dataset.itemId!;
    setTimeout(() => { el.style.opacity = '0.4'; }, 0);
    e.dataTransfer!.effectAllowed = 'move';
  });

  container.addEventListener('dragend', (e) => {
    const el = (e.target as HTMLElement).closest('[data-item-id]') as HTMLElement | null;
    if (el) el.style.opacity = '1';
    dragId = null;
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragId) return;
    const target = (e.target as HTMLElement).closest('[data-item-id]') as HTMLElement | null;
    if (!target || target.dataset.itemId === dragId) return;
    const targetId = target.dataset.itemId!;

    for (const key of ARR_KEYS) {
      const arr = data[key] as { id: string }[];
      const fromIdx = arr.findIndex(i => i.id === dragId);
      const toIdx   = arr.findIndex(i => i.id === targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        eventsAttached = false;
        saveToStorage(); schedulePreview(); renderForm();
        break;
      }
    }
  });
}

// ── Preview ────────────────────────────────────────────────────────────────

function renderPreview(): void {
  const preview = document.getElementById('cv-preview');
  if (!preview) return;

  const p  = data.personal;
  const ac = data.accentColor;

  const dots = (level: number) =>
    [1, 2, 3, 4, 5].map(n =>
      `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px;background:${n <= level ? ac : '#e5e7eb'};"></span>`
    ).join('');

  const divider = `<div style="height:1px;background:${ac};opacity:.25;flex:1;"></div>`;

  const section = (title: string, content: string) => `
    <div style="margin-top:22px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${ac};">${title}</span>
        ${divider}
      </div>
      ${content}
    </div>`;

  const expHtml = data.experience.map(e => `
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:13px;font-weight:600;">${esc(e.position) || '<em style="color:#9ca3af">Position</em>'}</span>
        <span style="font-size:11px;color:#6b7280;">${esc(e.from)}${e.to ? ' – ' + esc(e.to) : ''}</span>
      </div>
      <div style="font-size:12px;color:#6b7280;margin:1px 0 4px;">${esc(e.company)}</div>
      ${e.description ? `<div style="font-size:12px;color:#374151;line-height:1.55;">${esc(e.description)}</div>` : ''}
    </div>`).join('');

  const eduHtml = data.education.map(e => `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:13px;font-weight:600;">${esc(e.degree) || '<em style="color:#9ca3af">Abschluss</em>'}</span>
        <span style="font-size:11px;color:#6b7280;">${esc(e.from)}${e.to ? ' – ' + esc(e.to) : ''}</span>
      </div>
      <div style="font-size:12px;color:#6b7280;">${esc(e.school)}${e.grade ? ' · Note: ' + esc(e.grade) : ''}</div>
    </div>`).join('');

  const skillsHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;">
      ${data.skills.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;">${esc(s.name)}</span>
          <span style="display:flex;align-items:center;">${dots(s.level)}</span>
        </div>`).join('')}
    </div>`;

  const langsHtml = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${data.languages.map(l => `
        <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px 3px 10px;border-radius:9999px;border:1px solid ${ac};font-size:11px;">
          <span style="font-weight:600;">${esc(l.name)}</span>
          <span style="color:#9ca3af;">${esc(l.level)}</span>
        </span>`).join('')}
    </div>`;

  const projHtml = data.projects.map(pr => `
    <div style="margin-bottom:10px;">
      <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;">
        <span style="font-size:13px;font-weight:600;">${esc(pr.title)}</span>
        ${pr.link ? `<span style="font-size:11px;color:${ac};">${esc(pr.link)}</span>` : ''}
      </div>
      ${pr.description ? `<div style="font-size:12px;color:#374151;line-height:1.55;margin-top:2px;">${esc(pr.description)}</div>` : ''}
    </div>`).join('');

  const hobbiesHtml = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${data.hobbies.map(h => `
        <span style="padding:2px 10px;border-radius:9999px;background:#f3f4f6;font-size:12px;">${esc(h)}</span>`).join('')}
    </div>`;

  preview.innerHTML = `
    <div style="font-family:'Inter',system-ui,sans-serif;color:#111827;line-height:1.5;">

      <!-- Header -->
      <div style="display:flex;align-items:flex-start;gap:18px;padding-bottom:18px;border-bottom:2px solid ${ac};">
        ${p.photoDataUrl
          ? `<img src="${p.photoDataUrl}" style="width:76px;height:76px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid ${ac};" />`
          : ''}
        <div style="flex:1;min-width:0;">
          <h1 style="font-size:26px;font-weight:800;letter-spacing:-.02em;margin:0;line-height:1.1;">
            ${esc(p.name) || '<span style="color:#d1d5db;">Dein Name</span>'}
          </h1>
          ${p.title ? `<p style="font-size:14px;color:${ac};font-weight:600;margin:4px 0 8px;">${esc(p.title)}</p>` : '<div style="margin-bottom:8px;"></div>'}
          <div style="display:flex;flex-wrap:wrap;column-gap:16px;row-gap:2px;">
            ${p.address ? `<span style="font-size:11px;color:#6b7280;">${esc(p.address)}</span>` : ''}
            ${p.phone   ? `<span style="font-size:11px;color:#6b7280;">${esc(p.phone)}</span>` : ''}
            ${p.email   ? `<span style="font-size:11px;color:#6b7280;">${esc(p.email)}</span>` : ''}
            ${p.website ? `<span style="font-size:11px;color:${ac};">${esc(p.website)}</span>` : ''}
          </div>
        </div>
      </div>

      ${data.experience.length ? section('Berufserfahrung', expHtml)   : ''}
      ${data.education.length  ? section('Ausbildung',      eduHtml)   : ''}
      ${data.skills.length     ? section('Fähigkeiten',     skillsHtml): ''}
      ${data.languages.length  ? section('Sprachen',        langsHtml) : ''}
      ${data.projects.length   ? section('Projekte',        projHtml)  : ''}
      ${data.hobbies.length    ? section('Hobbys',          hobbiesHtml): ''}

      ${!p.name && !data.experience.length && !data.education.length
        ? `<div style="margin-top:60px;text-align:center;color:#9ca3af;font-size:14px;">
             Fülle das Formular links aus –<br>dein Lebenslauf erscheint hier live.
           </div>`
        : ''}
    </div>`;
}

// ── PDF Export ─────────────────────────────────────────────────────────────

async function exportPDF(): Promise<void> {
  const preview = document.getElementById('cv-preview');
  const btn = document.getElementById('btn-pdf') as HTMLButtonElement | null;
  if (!preview || !btn) return;

  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = '…';

  // On mobile the preview panel may be hidden — make it temporarily visible off-screen
  const panel = document.getElementById('panel-preview');
  let tempShown = false;
  if (panel && panel.style.display === 'none' || (panel && !panel.offsetParent && window.innerWidth < 768)) {
    panel.style.cssText = 'display:flex!important;position:fixed;top:-9999px;left:0;width:794px;z-index:-1;';
    tempShown = true;
  }

  try {
    const canvas = await html2canvas(preview, {
      useCORS: true, logging: false,
      backgroundColor: '#ffffff',
      windowWidth: preview.scrollWidth, windowHeight: preview.scrollHeight,
    } as Parameters<typeof html2canvas>[1]);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    const img  = canvas.toDataURL('image/jpeg', 0.96);

    if (pdfH <= 297) {
      pdf.addImage(img, 'JPEG', 0, 0, pdfW, pdfH);
    } else {
      // multi-page: slice image into A4-height chunks
      const pageHeightPx = (297 / pdfW) * canvas.width;
      let offsetY = 0;
      while (offsetY < canvas.height) {
        if (offsetY > 0) pdf.addPage();
        const sliceH = Math.min(pageHeightPx, canvas.height - offsetY);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceH;
        slice.getContext('2d')!.drawImage(canvas, 0, -offsetY);
        pdf.addImage(slice.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, pdfW, (sliceH * pdfW) / canvas.width);
        offsetY += pageHeightPx;
      }
    }

    const name = (data.personal.name || 'lebenslauf').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'lebenslauf';
    pdf.save(`cv-${name}.pdf`);
  } catch (err) {
    console.error(err);
    alert('PDF-Export fehlgeschlagen. Bitte erneut versuchen.');
  } finally {
    if (tempShown && panel) panel.style.cssText = '';
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

// ── Word Export ────────────────────────────────────────────────────────────

async function exportDocx(): Promise<void> {
  const btn = document.getElementById('btn-word') as HTMLButtonElement | null;
  if (!btn) return;

  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const p = data.personal;
    const children: ConstructorParameters<typeof Paragraph>[0][] = [];

    const h = (text: string): ConstructorParameters<typeof Paragraph>[0] => ({
      children: [new TextRun({ text, bold: true, size: 26, color: '4f46e5' })],
      spacing: { before: 240, after: 120 },
      border: { bottom: { style: 'single' as const, size: 6, color: 'c4b5fd', space: 4 } },
    });

    // Name
    children.push({ children: [new TextRun({ text: p.name || 'Lebenslauf', bold: true, size: 40 })], spacing: { after: 60 } });
    if (p.title) children.push({ children: [new TextRun({ text: p.title, size: 24, color: '6d28d9' })], spacing: { after: 80 } });

    const contact = [p.address, p.phone, p.email, p.website].filter(Boolean).join('  ·  ');
    if (contact) children.push({ children: [new TextRun({ text: contact, size: 18, color: '6b7280' })], spacing: { after: 200 } });

    if (data.experience.length) {
      children.push(h('BERUFSERFAHRUNG'));
      for (const e of data.experience) {
        children.push({ children: [new TextRun({ text: e.position, bold: true, size: 22 }), new TextRun({ text: e.from ? `   ${e.from}${e.to ? ' – ' + e.to : ''}` : '', size: 18, color: '6b7280' })], spacing: { after: 40 } });
        if (e.company) children.push({ children: [new TextRun({ text: e.company, size: 20, color: '6b7280' })], spacing: { after: 40 } });
        if (e.description) children.push({ children: [new TextRun({ text: e.description, size: 20 })], spacing: { after: 120 } });
      }
    }

    if (data.education.length) {
      children.push(h('AUSBILDUNG'));
      for (const e of data.education) {
        children.push({ children: [new TextRun({ text: e.degree, bold: true, size: 22 }), new TextRun({ text: e.from ? `   ${e.from}${e.to ? ' – ' + e.to : ''}` : '', size: 18, color: '6b7280' })], spacing: { after: 40 } });
        if (e.school) children.push({ children: [new TextRun({ text: e.school + (e.grade ? ` · Note: ${e.grade}` : ''), size: 20, color: '6b7280' })], spacing: { after: 120 } });
      }
    }

    if (data.skills.length) {
      children.push(h('FÄHIGKEITEN'));
      children.push({ children: [new TextRun({ text: data.skills.map(s => `${s.name} (${'●'.repeat(s.level)}${'○'.repeat(5 - s.level)})`).join('   ·   '), size: 20 })], spacing: { after: 120 } });
    }

    if (data.languages.length) {
      children.push(h('SPRACHEN'));
      children.push({ children: [new TextRun({ text: data.languages.map(l => `${l.name} (${l.level})`).join('   ·   '), size: 20 })], spacing: { after: 120 } });
    }

    if (data.projects.length) {
      children.push(h('PROJEKTE'));
      for (const pr of data.projects) {
        const runs: ConstructorParameters<typeof TextRun>[0][] = [{ text: pr.title, bold: true, size: 22 }];
        if (pr.link) runs.push({ text: `   ${pr.link}`, size: 18, color: '6d28d9' });
        children.push({ children: runs.map(r => new TextRun(r)), spacing: { after: 40 } });
        if (pr.description) children.push({ children: [new TextRun({ text: pr.description, size: 20 })], spacing: { after: 120 } });
      }
    }

    if (data.hobbies.length) {
      children.push(h('HOBBYS'));
      children.push({ children: [new TextRun({ text: data.hobbies.join(' · '), size: 20 })], spacing: { after: 120 } });
    }

    const doc = new Document({ sections: [{ children: children.map(c => new Paragraph(c)) }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = (p.name || 'lebenslauf').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'lebenslauf';
    a.href = url;
    a.download = `cv-${name}.docx`;
    a.click();
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error(err);
    alert('Word-Export fehlgeschlagen. Bitte erneut versuchen.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

// ── Accent color picker ────────────────────────────────────────────────────

function setupAccentPicker(): void {
  const picker = document.getElementById('accent-picker') as HTMLInputElement | null;
  const swatch = document.getElementById('accent-swatch');
  if (!picker) return;
  picker.value = data.accentColor;
  if (swatch) swatch.style.background = data.accentColor;

  picker.addEventListener('input', () => {
    data.accentColor = picker.value;
    if (swatch) swatch.style.background = picker.value;
    saveToStorage();
    schedulePreview();
  });
}

// ── Mobile tabs ────────────────────────────────────────────────────────────

function setupMobileTabs(): void {
  const tabForm    = document.getElementById('tab-form');
  const tabPreview = document.getElementById('tab-preview');
  const panelForm  = document.getElementById('panel-form');
  const panelPreview = document.getElementById('panel-preview');
  if (!tabForm || !tabPreview || !panelForm || !panelPreview) return;

  tabForm.addEventListener('click', () => {
    panelForm.style.display = '';
    panelPreview.style.display = 'none';
    tabForm.classList.replace('text-slate-500', 'text-primary');
    tabForm.classList.replace('border-transparent', 'border-primary');
    tabPreview.classList.replace('text-primary', 'text-slate-500');
    tabPreview.classList.replace('border-primary', 'border-transparent');
  });

  tabPreview.addEventListener('click', () => {
    panelForm.style.display = 'none';
    panelPreview.style.cssText = 'display:flex!important;';
    tabPreview.classList.replace('text-slate-500', 'text-primary');
    tabPreview.classList.replace('border-transparent', 'border-primary');
    tabForm.classList.replace('text-primary', 'text-slate-500');
    tabForm.classList.replace('border-primary', 'border-transparent');
  });
}

// ── Layout height fix ──────────────────────────────────────────────────────

function fixLayout(): void {
  const panel = document.getElementById('panel-form') as HTMLElement | null;
  const preview = document.getElementById('panel-preview') as HTMLElement | null;
  if (!panel) return;
  const top = Math.round(panel.getBoundingClientRect().top);
  const h = `${window.innerHeight - top}px`;
  panel.style.height = h;
  if (preview) preview.style.height = h;
}

// ── Init ───────────────────────────────────────────────────────────────────

function init(): void {
  renderForm();
  renderPreview();
  setupAccentPicker();
  setupMobileTabs();
  fixLayout();

  document.getElementById('btn-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-word')?.addEventListener('click', exportDocx);
  window.addEventListener('resize', fixLayout);
}

document.addEventListener('DOMContentLoaded', init);
