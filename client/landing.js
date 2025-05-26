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
            if (perfil) {
                if (perfil.Nombre_Completo && perfil.Nombre_Completo.trim().length > 0) {
                    nombre = perfil.Nombre_Completo;
                } else if (perfil.Nombre_Usuario) {
                    nombre = perfil.Nombre_Usuario;
                }
            } else if (user.Nombre_Usuario) {
                nombre = user.Nombre_Usuario;
            }
            if (document.getElementById('nombrePregunta')) document.getElementById('nombrePregunta').value = nombre;
            let correo = (perfil && perfil.Correo) ? perfil.Correo : (user.Correo || '');
            if (document.getElementById('correoPregunta')) document.getElementById('correoPregunta').value = correo;
        }
    } catch {}
});

// Enviar pregunta
document.getElementById('preguntaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nombre = document.getElementById('nombrePregunta').value.trim();
    const correo = document.getElementById('correoPregunta').value.trim();
    const mensaje = document.getElementById('mensajePregunta').value.trim();
    const msgDiv = document.getElementById('preguntaMsg');
    msgDiv.innerHTML = '';
    try {
        const res = await fetch('/api/preguntas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, mensaje })
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

// Fondo animado de partículas (opcional, solo visual, puedes agregar librería JS si lo deseas)
// Ejemplo simple de partículas (puedes quitar si no quieres JS extra)
(function(){
    const c = document.getElementById('bgParticles');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return; // Añadido para robustez
    let w = window.innerWidth, h = window.innerHeight;
    c.width = w; c.height = h;
    let particles = [];
    for(let i=0;i<32;i++){
        particles.push({
            x: Math.random()*w,
            y: Math.random()*h,
            r: 1.5+Math.random()*2.5,
            dx: -0.3+Math.random()*0.6,
            dy: -0.3+Math.random()*0.6,
            o: 0.08+Math.random()*0.12
        });
    }
    function draw(){
        ctx.clearRect(0,0,w,h);
        for(let p of particles){
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.r,0,2*Math.PI);
            ctx.fillStyle = `rgba(214,186,95,${p.o})`;
            ctx.fill();
            p.x += p.dx; p.y += p.dy;
            if(p.x<0||p.x>w) p.dx*=-1;
            if(p.y<0||p.y>h) p.dy*=-1;
        }
        requestAnimationFrame(draw);
    }
    draw();
    window.addEventListener('resize',()=>{
        w = window.innerWidth; h = window.innerHeight;
        c.width = w; c.height = h;
    });
})();
