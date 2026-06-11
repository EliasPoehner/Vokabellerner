let collapsed = localStorage.getItem('hub-sidebar') === 'collapsed';

function applyState(): void {
  const sidebar = document.getElementById('main-sidebar');
  const openBtn = document.getElementById('sidebar-open-btn');
  const toggleIcon = document.getElementById('sidebar-toggle-icon');
  if (!sidebar) return;

  if (collapsed) {
    sidebar.style.width = '4rem';
    sidebar.classList.add('collapsed');
    sidebar.querySelectorAll<HTMLElement>('.sidebar-label').forEach(el => { el.style.display = 'none'; });
    toggleIcon?.closest('button')?.setAttribute('style', 'display:none');
    openBtn?.classList.remove('hidden');
    sidebar.querySelectorAll<HTMLElement>('.nav-item').forEach(el => {
      el.style.justifyContent = 'center';
      el.style.paddingLeft = '0';
      el.style.paddingRight = '0';
    });
    const themeBtn = sidebar.querySelector<HTMLElement>('.border-t button');
    if (themeBtn) { themeBtn.style.justifyContent = 'center'; themeBtn.style.paddingLeft = '0'; themeBtn.style.paddingRight = '0'; }
  } else {
    sidebar.style.width = '16rem';
    sidebar.classList.remove('collapsed');
    sidebar.querySelectorAll<HTMLElement>('.sidebar-label').forEach(el => { el.style.display = ''; });
    if (toggleIcon) {
      const btn = toggleIcon.closest<HTMLElement>('button');
      if (btn) btn.style.display = '';
      toggleIcon.textContent = 'chevron_left';
    }
    openBtn?.classList.add('hidden');
    sidebar.querySelectorAll<HTMLElement>('.nav-item').forEach(el => {
      el.style.justifyContent = '';
      el.style.paddingLeft = '';
      el.style.paddingRight = '';
    });
    const themeBtn = sidebar.querySelector<HTMLElement>('.border-t button');
    if (themeBtn) { themeBtn.style.justifyContent = ''; themeBtn.style.paddingLeft = ''; themeBtn.style.paddingRight = ''; }
  }
}

export function toggleSidebar(): void {
  collapsed = !collapsed;
  localStorage.setItem('hub-sidebar', collapsed ? 'collapsed' : 'open');
  applyState();
}

export function initSidebar(): void {
  applyState();
}
