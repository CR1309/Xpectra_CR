// Inserta botón Perfil dinámicamente (entre tema y salir) sin usar inline scripts
(function(){
  const onReady = () => {
    const topBar = document.getElementById('topBarBtns');
    if(topBar && !document.getElementById('perfilBtn')) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline-secondary';
      btn.id = 'perfilBtn';
      btn.innerHTML = '<i class="bi bi-person-circle"></i> <span class="btn-text d-none d-md-inline">Perfil</span>';
      btn.title = 'Mi Perfil';
      btn.setAttribute('aria-label','Mi Perfil');
      const logout = document.getElementById('logoutBtn');
      if (logout) topBar.insertBefore(btn, logout); else topBar.appendChild(btn);
    }
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else onReady();
})();
