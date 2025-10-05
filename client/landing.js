// Mostrar botón de gestión de citas y cerrar sesión si hay sesión
document.addEventListener('DOMContentLoaded', async function() {
    const userLS = localStorage.getItem('user');
    if (localStorage.getItem('token')) {
        const gestionBtn = document.getElementById('gestionBtn');
        const logoutBtn = document.getElementById('landingLogoutBtn');
        if (gestionBtn) gestionBtn.style.display = '';
        if (logoutBtn) logoutBtn.style.display = '';
        document.querySelectorAll('.neo-btn').forEach(btn => {
            if (btn.innerText.includes('Iniciar sesión') || btn.innerText.includes('Registrarse')) {
                btn.style.display = 'none';
            }
        });
    }
    const logoutBtn = document.getElementById('landingLogoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = function() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
        };
    }

    // Autocompletar formulario de contacto con datos del usuario logueado
    try {
        const user = userLS ? JSON.parse(userLS) : null;
        if (user && localStorage.getItem('token')) {
            let perfil = null;
            try {
                const res = await fetch(`/api/usuarios/${user.ID_Usuario}`, {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                });
                if (res.ok) perfil = await res.json();
            } catch {}
            let nombre = '';
            let apellido = '';
            if (perfil) {
                if (perfil.Nombre_Usuario) {
                    nombre = perfil.Nombre_Usuario;
                }
                // El apellido solo se autocompleta si el perfil tiene ese campo (usualmente en paciente, no usuario)
                if (perfil.Apellido) {
                    apellido = perfil.Apellido;
                }
            } else if (user.Nombre_Usuario) {
                nombre = user.Nombre_Usuario;
                // No autocompletes apellido desde usuario, solo si está en perfil (paciente)
                apellido = '';
            }
            if (document.getElementById('nombrePregunta')) document.getElementById('nombrePregunta').value = nombre;
            if (document.getElementById('apellidoPregunta')) document.getElementById('apellidoPregunta').value = apellido;
            let correo = (perfil && perfil.Correo) ? perfil.Correo : (user.Correo || '');
            if (document.getElementById('correoPregunta')) document.getElementById('correoPregunta').value = correo;
        }
    } catch {}
});

// Enviar pregunta
const preguntaForm = document.getElementById('preguntaForm');
if (preguntaForm) {
    preguntaForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const nombre = document.getElementById('nombrePregunta')?.value.trim() || '';
        const apellido = document.getElementById('apellidoPregunta')?.value.trim() || '';
        const correo = document.getElementById('correoPregunta')?.value.trim() || '';
        const mensaje = document.getElementById('mensajePregunta')?.value.trim() || '';
        const msgDiv = document.getElementById('preguntaMsg');
        if (!nombre || !correo || !mensaje) {
            msgDiv.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle"></i> Todos los campos obligatorios deben estar completos.</span>';
            return;
        }
        msgDiv.innerHTML = '';
        try {
            const body = apellido ? { nombre, apellido, correo, mensaje } : { nombre, correo, mensaje };
            const res = await fetch('/api/preguntas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                msgDiv.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> ¡Pregunta enviada! Te responderemos pronto.</span>';
                this.reset();
            } else {
                msgDiv.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle"></i> Error al enviar la pregunta.</span>';
            }
        } catch {
            msgDiv.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle"></i> Error de conexión.</span>';
        }
    });
}

// Fondo animado de partículas (opcional, solo visual, puedes agregar librería JS si lo deseas)
// Ejemplo simple de partículas (puedes quitar si no quieres JS extra)
// (function(){
//     const c = document.getElementById('bgParticles');
//     if (!c) return;
//     const ctx = c.getContext('2d');
//     if (!ctx) return; // Añadido para robustez
//     let w = window.innerWidth, h = window.innerHeight;
//     c.width = w; c.height = h;
//     let particles = [];
//     for(let i=0;i<32;i++){
//         particles.push({
//             x: Math.random()*w,
//             y: Math.random()*h,
//             r: 1.5+Math.random()*2.5,
//             dx: -0.3+Math.random()*0.6,
//             dy: -0.3+Math.random()*0.6,
//             o: 0.08+Math.random()*0.12
//         });
//     }
//     function draw(){
//         ctx.clearRect(0,0,w,h);
//         for(let p of particles){
//             ctx.beginPath();
//             ctx.arc(p.x,p.y,p.r,0,2*Math.PI);
//             ctx.fillStyle = `rgba(214,186,95,${p.o})`;
//             ctx.fill();
//             p.x += p.dx; p.y += p.dy;
//             if(p.x<0||p.x>w) p.dx*=-1;
//             if(p.y<0||p.y>h) p.dy*=-1;
//         }
//         requestAnimationFrame(draw);
//     }
//     draw();
//     window.addEventListener('resize',()=>{
//         w = window.innerWidth; h = window.innerHeight;
//         c.width = w; c.height = h;
//     });
// })();

// Chatbot removido: se elimina lógica de ocultamiento.

// ================== TOGGLE TEMA (LIGHT / DARK / CONTRAST) ==================
(() => {
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    const root = document.documentElement;
    const STORAGE_KEY = 'xpectra-theme';
    const live = document.getElementById('themeLive');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem(STORAGE_KEY);
    const cycle = ['light','dark','contrast'];
    let current = saved || (prefersDark ? 'dark' : 'light');
    if(!cycle.includes(current)) current = 'light';
    applyTheme(current);
    btn.addEventListener('click', () => {
        const idx = cycle.indexOf(current);
        current = cycle[(idx + 1) % cycle.length];
        applyTheme(current);
        localStorage.setItem(STORAGE_KEY, current);
    });
    // Atajo de teclado: Alt+T para cambiar el tema
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
            // Siempre establece el atributo, incluido 'light', para evitar overrides del sistema
            root.setAttribute('data-theme', mode);
        let icon = 'bi-moon';
        let label = 'Cambiar a modo oscuro';
        if(mode === 'dark') { icon = 'bi-sun'; label = 'Cambiar a modo alto contraste'; }
        else if(mode === 'contrast') { icon = 'bi-eye'; label = 'Cambiar a modo claro'; }
        btn.innerHTML = `<i class="bi ${icon}"></i><span class="theme-toggle-label" aria-hidden="true">${mode}</span>`;
        btn.title = label;
        btn.setAttribute('aria-label', label);
        if(live) live.textContent = `Tema: ${mode}`;
    }
})();

// ================== MENÚ MÓVIL (HEADER) ==================
(() => {
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('primaryNav');
    if (!toggle || !nav) return;
    const open = () => {
        nav.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    };
    const close = () => {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    };
    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.contains('open');
        isOpen ? close() : open();
    });
    // Cierra menu al hacer clic en enlaces
    nav.addEventListener('click', (e) => {
        const t = e.target;
        if (t && t.tagName === 'A') close();
    });
    // Cierra al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!nav.classList.contains('open')) return;
        if (e.target === nav || e.target === toggle || nav.contains(e.target) || toggle.contains(e.target)) return;
        close();
    });
    // Cierra con ESC
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('open')) close();
    });
})();

// ================== FAQ ACCORDION ==================
(() => {
    const buttons = document.querySelectorAll('.faq-question');
    if(!buttons.length) return;
    buttons.forEach(btn => {
        btn.addEventListener('click', ()=>{
            const expanded = btn.getAttribute('aria-expanded') === 'true';
            const targetId = btn.getAttribute('aria-controls');
            const panel = document.getElementById(targetId);
            // Cerrar otros para modo acordeón exclusivo
            buttons.forEach(b => {
                if(b !== btn){
                    b.setAttribute('aria-expanded','false');
                    const pid = b.getAttribute('aria-controls');
                    const pv = document.getElementById(pid);
                    if(pv) pv.hidden = true;
                }
            });
            btn.setAttribute('aria-expanded', (!expanded).toString());
            if(panel) panel.hidden = expanded; // si estaba abierto lo oculto
            // Cambiar icono
            const icon = btn.querySelector('.toggle-icon');
            if(icon){
                if(expanded){ icon.classList.remove('bi-dash-lg'); icon.classList.add('bi-plus-lg'); }
                else { icon.classList.remove('bi-plus-lg'); icon.classList.add('bi-dash-lg'); }
            }
        });
    });
})();
