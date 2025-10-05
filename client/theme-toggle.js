(function(){
  const onReady = () => {
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    const root = document.documentElement;
    const STORAGE_KEY = 'xpectra-theme';
    const live = document.getElementById('themeLive');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const cycle = ['light','dark','contrast'];
    let current = localStorage.getItem(STORAGE_KEY) || (prefersDark ? 'dark' : 'light');
    if(!cycle.includes(current)) current = 'light';
    applyTheme(current);
    btn.addEventListener('click', () => {
      const idx = cycle.indexOf(current);
      current = cycle[(idx + 1) % cycle.length];
      applyTheme(current);
      localStorage.setItem(STORAGE_KEY, current);
    });
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        const idx = cycle.indexOf(current);
        current = cycle[(idx + 1) % cycle.length];
        applyTheme(current);
        localStorage.setItem(STORAGE_KEY, current);
      }
    });
    function applyTheme(mode){
      root.setAttribute('data-theme', mode);
      let icon = 'bi-moon', label = 'Cambiar a modo oscuro';
      if(mode === 'dark'){ icon = 'bi-sun'; label = 'Cambiar a modo alto contraste'; }
      else if(mode === 'contrast'){ icon = 'bi-eye'; label = 'Cambiar a modo claro'; }
      btn.innerHTML = `<i class="bi ${icon}"></i>`;
      btn.title = label; btn.setAttribute('aria-label', label);
      if(live) live.textContent = `Tema: ${mode}`;
    }
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else onReady();
})();
