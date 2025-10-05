// Notificaciones tipo tarjeta con estética del sitio
// Uso: notify('Mensaje', { type: 'info'|'success'|'warning'|'danger', autoHideMs: 3000, icon: 'bi-info-circle' })
(function(){
  function ensureContainer(){
    let c = document.getElementById('notifyContainer');
    if(!c){
      c = document.createElement('div');
      c.id = 'notifyContainer';
      c.className = 'notify-container';
      document.body.appendChild(c);
    }
    return c;
  }

  function iconFor(type){
    switch(type){
      case 'success': return 'bi-check-circle';
      case 'warning': return 'bi-exclamation-triangle';
      case 'danger': return 'bi-exclamation-octagon';
      default: return 'bi-info-circle';
    }
  }

  function makeCard(message, opts){
    const type = opts.type || 'info';
    const icon = opts.icon || iconFor(type);
    const autoHideMs = Number(opts.autoHideMs ?? 3200);
    const card = document.createElement('div');
    card.className = `neo-card notify-card notify-${type}`;
    card.setAttribute('role','status');
    card.setAttribute('aria-live','polite');
    card.innerHTML = `
      <div class="notify-inner">
        <div class="notify-ico"><i class="bi ${icon}"></i></div>
        <div class="notify-msg">${message}</div>
        <button class="notify-close" aria-label="Cerrar notificación">&times;</button>
      </div>`;
    const closeBtn = card.querySelector('.notify-close');
    let hideTimer;
    function remove(){
      if (card.classList.contains('notify-hiding')) return;
      card.classList.add('notify-hiding');
      card.addEventListener('animationend', ()=> card.remove(), { once:true });
    }
    closeBtn.onclick = remove;
    if (autoHideMs > 0){ hideTimer = setTimeout(remove, autoHideMs); }
    // Pausa al pasar el mouse
    card.addEventListener('mouseenter', ()=>{ if(hideTimer) { clearTimeout(hideTimer); hideTimer = undefined; } });
    card.addEventListener('mouseleave', ()=>{ if(!hideTimer && autoHideMs>0){ hideTimer = setTimeout(remove, 1200); } });
    return card;
  }

  window.notify = function(message, opts={}){
    try {
      const c = ensureContainer();
      const card = makeCard(String(message), opts);
      c.appendChild(card);
      return card;
    } catch(_e){
      // Fallback silencioso en caso extremo
      try { console.warn('Notify fallback:', message); } catch{}
    }
  };
})();
