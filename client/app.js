document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('citaForm');
    const citasList = document.getElementById('citasList');
    const loginForm = document.getElementById('loginForm');
    const loginCard = document.getElementById('loginCard');
    const citaCard = document.getElementById('citaCard');
    const citasCard = document.getElementById('citasCard');
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutDiv = document.getElementById('logoutDiv');
    const registerForm = document.getElementById('registerForm');
    const registerCard = document.getElementById('registerCard');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');

    let token = localStorage.getItem('token') || null;
    let user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;

    // OCULTAR SIEMPRE LA BARRA DERECHA AL INICIAR
    const topBarBtns = document.getElementById('topBarBtns');
    if (topBarBtns) topBarBtns.style.display = 'none';

    function mostrarLogin(mostrar) {
        loginCard.style.display = mostrar ? '' : 'none';
        citaCard.style.display = mostrar ? 'none' : '';
        // Oculta los botones superiores cuando se muestra login/registro
        if (topBarBtns) topBarBtns.style.display = 'none';
        mostrarBarraDerecha(false);
        if (document.getElementById('leftBarBtns')) {
            document.getElementById('leftBarBtns').style.display = 'none';
        }
    }

    // Autocompletar formulario de cita con datos del perfil
    async function autocompletarCitaConPerfil() {
        if (!token || !user) return;
        try {
            const res = await fetch(`/api/usuarios/${user.ID_Usuario}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return;
            const perfil = await res.json();
            if (!perfil || Object.keys(perfil).length === 0) return;
            document.getElementById('Nombre').value = perfil.Nombre_Completo || perfil.Nombre_Usuario || '';
            document.getElementById('Apellido').value = ''; // Si tienes apellido separado, usa perfil.Apellido
            document.getElementById('Fecha_Nacimiento').value = perfil.Fecha_Nacimiento ? perfil.Fecha_Nacimiento.substring(0,10) : '';
            document.getElementById('Sexo').value = perfil.Sexo || '';
            document.getElementById('Direccion').value = perfil.Direccion || '';
            document.getElementById('Telefono').value = perfil.Telefono || '';
            document.getElementById('Correo_Electronico').value = perfil.Correo || '';
        } catch (error) {
            // No autocompleta si hay error
        }
    }

    // Cargar categorías dinámicamente al iniciar la app
    async function cargarCategorias() {
        const select = document.getElementById('Categoria_Estudio');
        if (!select) return;
        try {
            const res = await fetch('/api/categorias', {
                headers: token ? { 'Authorization': 'Bearer ' + token } : {}
            });
            if (!res.ok) return;
            const categorias = await res.json();
            select.innerHTML = '<option value="" disabled selected>Selecciona</option>' +
                categorias.map(cat => `<option value="${cat.ID_Categoria}">${cat.Nombre_Categoria}</option>`).join('');
            // Siempre deja la opción por defecto seleccionada al cargar
            select.selectedIndex = 0;
        } catch (e) {
            // Si falla, deja el select vacío
        }
    }

    // --- NUEVO: Mostrar informes propios del usuario ---
async function mostrarMisInformes() {
    if (!token || !user) return;
    const contenedor = document.getElementById('misInformesCont');
    if (!contenedor) return;
    contenedor.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    try {
        const res = await fetch('/api/informes/mios', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) {
            // Mostrar el error real del backend
            let msg = 'No se pudieron cargar tus informes.';
            try {
                const data = await res.json();
                msg = data.error || msg;
            } catch {}
            contenedor.innerHTML = `<div class="text-danger">${msg}</div>`;
            // Log para depuración
            console.error('Error /api/informes/mios', res.status, msg);
            return;
        }
        const informes = await res.json();
        if (!Array.isArray(informes) || informes.length === 0) {
            contenedor.innerHTML = `<div class="text-muted text-center py-4">No tienes informes registrados aún.</div>`;
            return;
        }
        let html = `
        <div class="table-responsive">
        <table class="table table-bordered table-hover align-middle">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Paciente</th>
                    <th>Fecha cita</th>
                    <th>Hora</th>
                    <th>Categoría</th>
                    <th>Diagnóstico</th>
                    <th>Fecha informe</th>
                    <th>Imagen</th>
                    <th>Descargar</th>
                </tr>
            </thead>
            <tbody>
        `;
        informes.forEach(inf => {
            html += `
                <tr>
                    <td>${inf.ID_Informe}</td>
                    <td>${inf.Paciente_Nombre} ${inf.Paciente_Apellido}</td>
                    <td>${inf.Fecha_Cita || ''}</td>
                    <td>${inf.Hora_Cita || ''}</td>
                    <td>${inf.Nombre_Categoria || ''}</td>
                    <td>${inf.Diagnostico ? inf.Diagnostico.substring(0, 60) + (inf.Diagnostico.length > 60 ? '…' : '') : ''}</td>
                    <td>${inf.Fecha_Informe || ''}</td>
                    <td>${inf.Imagen_URL ? `<a href="${inf.Imagen_URL}" target="_blank">Ver</a>` : ''}</td>
                    <td>
                        ${inf.Imagen_URL ? `<a href="/api/informes/${inf.ID_Informe}/descargar" class="btn btn-sm btn-success" title="Descargar imagen" onclick="console.log('Descargar informe', ${inf.ID_Informe})"><i class="bi bi-download"></i></a>` : ''}
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        contenedor.innerHTML = html;
    } catch (err) {
        contenedor.innerHTML = `<div class="text-danger">Error de conexión al cargar informes.</div>`;
    }
}

    function mostrarApp() {
        mostrarLogin(false);
        cargarCitas();
        setTimeout(autocompletarCitaConPerfil, 200); // Espera a que el DOM esté listo
        cargarCategorias();
        mostrarMisInformes(); // <-- NUEVO
    }

    // Alternar entre login y registro
    showRegisterBtn.addEventListener('click', () => {
        loginCard.style.display = 'none';
        registerCard.style.display = '';
        // Oculta los botones superiores en registro
        if (topBarBtns) topBarBtns.style.display = 'none';
        mostrarBarraDerecha(false);
        if (document.getElementById('leftBarBtns')) {
            document.getElementById('leftBarBtns').style.display = 'none';
        }
    });
    showLoginBtn.addEventListener('click', () => {
        registerCard.style.display = 'none';
        loginCard.style.display = '';
        // Oculta los botones superiores en login
        if (topBarBtns) topBarBtns.style.display = 'none';
        mostrarBarraDerecha(false);
        if (document.getElementById('leftBarBtns')) {
            document.getElementById('leftBarBtns').style.display = 'none';
        }
    });

    // Spinner global para feedback visual
    function mostrarSpinner(mostrar) {
        let spinner = document.getElementById('globalSpinner');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.id = 'globalSpinner';
            spinner.innerHTML = `<div class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="z-index:2000;background:rgba(255,255,255,0.7)">
                <div class="spinner-border text-primary" role="status" aria-live="polite" aria-label="Cargando...">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>`;
            document.body.appendChild(spinner);
        }
        spinner.style.display = mostrar ? '' : 'none';
    }

    // Centraliza mensajes de error
    function mostrarMensajeError(msg) {
        alert(msg);
    }

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Validación frontend
        const Correo = document.getElementById('loginCorreo').value;
        const Contrasena = document.getElementById('loginContrasena').value;
        if (!Correo || !Contrasena) {
            mostrarMensajeError('Correo y contraseña requeridos');
            return;
        }
        mostrarSpinner(true);
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Correo, Contrasena })
            });
            const data = await res.json();
            if (res.ok) {
                token = data.token;
                user = data.user;
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
                // Fuerza recarga del user desde localStorage antes de mostrar la app
                window.location.reload();
            } else {
                // Muestra el mensaje de error específico del backend
                mostrarMensajeError(data.error || 'Error de autenticación');
            }
        } catch {
            mostrarMensajeError('Error de conexión');
        } finally {
            mostrarSpinner(false);
        }
    });

    // Registro
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Validación frontend
        const Nombre_Usuario = document.getElementById('registerNombre').value;
        const Correo = document.getElementById('registerCorreo').value;
        const Contrasena = document.getElementById('registerContrasena').value;
        if (!Nombre_Usuario || !Correo || !Contrasena) {
            mostrarMensajeError('Todos los campos son obligatorios.');
            return;
        }
        if (Contrasena.length < 6) {
            mostrarMensajeError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        mostrarSpinner(true);
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Nombre_Usuario, Correo, Contrasena })
            });
            const data = await res.json();
            if (res.ok) {
                alert('Registro exitoso. Ahora puedes iniciar sesión.');
                registerCard.style.display = 'none';
                loginCard.style.display = '';
                // Oculta los botones superiores tras registro
                if (topBarBtns) topBarBtns.style.display = 'none';
                mostrarBarraDerecha(false);
                if (document.getElementById('leftBarBtns')) {
                    document.getElementById('leftBarBtns').style.display = 'none';
                }
            } else {
                mostrarMensajeError(data.error || 'Error en el registro');
            }
        } catch {
            mostrarMensajeError('Error de conexión');
        } finally {
            mostrarSpinner(false);
        }
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        token = null;
        user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (topBarBtns) topBarBtns.style.display = 'none';
        mostrarBarraDerecha(false); // OCULTA BARRA DERECHA AL CERRAR SESIÓN
        // Oculta también barra izquierda
        if (document.getElementById('leftBarBtns')) {
            document.getElementById('leftBarBtns').style.display = 'none';
        }
        mostrarLogin(true);
    });

    // Enviar formulario de cita (añade método y fecha de pago si aplica)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Deshabilita el botón para evitar doble submit
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        // Validación frontend robusta
        // Obtener valores de los campos
        const Nombre = document.getElementById('Nombre').value;
        const Apellido = document.getElementById('Apellido').value;
        const Fecha_Nacimiento = document.getElementById('Fecha_Nacimiento').value;
        const Sexo = document.getElementById('Sexo').value;
        const Direccion = document.getElementById('Direccion').value;
        const Telefono = document.getElementById('Telefono').value;
        const Correo_Electronico = document.getElementById('Correo_Electronico').value;
        const Fecha_Cita = document.getElementById('Fecha_Cita') ? document.getElementById('Fecha_Cita').value : '';
        const Hora_Cita = document.getElementById('Hora_Cita') ? document.getElementById('Hora_Cita').value : '';
        const Motivo = document.getElementById('Motivo') ? document.getElementById('Motivo').value : '';
        // OBTENER ID_Categoria del select
        const ID_Categoria = document.getElementById('Categoria_Estudio') ? document.getElementById('Categoria_Estudio').value : '';

        // Validar campos requeridos antes de enviar
        if (
            !Nombre || !Apellido || !Fecha_Nacimiento || !Sexo ||
            !Direccion || !Telefono || !Correo_Electronico ||
            !Fecha_Cita || !Hora_Cita || !ID_Categoria
        ) {
            mostrarMensajeError('Todos los campos son obligatorios.');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(Correo_Electronico)) {
            mostrarMensajeError('Correo electrónico inválido.');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        // Agregar validación de fecha
        function validarFecha(fecha) {
            const hoy = new Date();
            const fechaSeleccionada = new Date(fecha);
            return fechaSeleccionada >= hoy;
        }
        if (!validarFecha(Fecha_Cita)) {
            mostrarMensajeError('La fecha de la cita no puede ser anterior a hoy');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        mostrarSpinner(true);
        const nuevaCita = {
            Nombre,
            Apellido,
            Fecha_Nacimiento,
            Sexo,
            Direccion,
            Telefono,
            Correo_Electronico,
            Fecha_Cita,
            Hora_Cita,
            Motivo,
            ID_Categoria: Number(ID_Categoria) // Asegura que sea numérico
        };

        try {
            const response = await fetch('/api/citas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(nuevaCita)
            });

            if (response.ok) {
                form.reset();
                // Refresca la página para mostrar la nueva cita
                window.location.reload();
            } else {
                // Mostrar mensaje de error específico del backend si existe
                const errorData = await response.json();
                mostrarMensajeError(errorData.error || 'Error al guardar la cita. Intenta nuevamente.');
            }
        } catch (error) {
            mostrarMensajeError('Error de conexión con el servidor.');
        } finally {
            mostrarSpinner(false);
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    // Modal de edición
    let editModal, editForm;
    let editCitaId = null;

    function crearModalEdicion() {
        if (document.getElementById('editCitaModal')) return;
        // El modal de edición debe estar en index.html, aquí solo se referencia
        editModal = new bootstrap.Modal(document.getElementById('editCitaModal'));
        editForm = document.getElementById('editCitaForm');
        editForm.addEventListener('submit', guardarEdicionCita);
    }

    async function guardarEdicionCita(e) {
        e.preventDefault();
        const Fecha_Cita = document.getElementById('editFecha_Cita').value;
        const Hora_Cita = document.getElementById('editHora_Cita').value;
        const Motivo = document.getElementById('editMotivo').value;
        if (!Fecha_Cita || !Hora_Cita) {
            mostrarMensajeError('Fecha y hora obligatorias');
            return;
        }
        mostrarSpinner(true);
        try {
            // Actualiza la cita
            const res = await fetch(`/api/citas/${editCitaId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ Fecha_Cita, Hora_Cita, Motivo })
            });
            const data = await res.json();
            if (!res.ok) {
                mostrarMensajeError(data.error || 'Error al editar la cita');
                return;
            }
            editModal.hide();
            // Refresca la página tras editar
            window.location.reload();
        } catch {
            mostrarMensajeError('Error de conexión');
        } finally {
            mostrarSpinner(false);
        }
    }

    // Renderiza una cita con info de pago e informe
    async function renderCitaConInfo(cita, modoTab = false) {
        const puedeEditar = user && (user.Rol === 'admin' || cita.ID_Usuario === user.ID_Usuario);
        const esAdmin = user && user.Rol === 'admin';
        const estadoHtml = esAdmin
            ? `<select class="form-select form-select-sm ios-input estado-cita-select" data-cita-id="${cita.ID_Cita}" style="width:auto;display:inline-block;">
                    <option value="Pendiente" ${cita.Estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Confirmada" ${cita.Estado === 'Confirmada' ? 'selected' : ''}>Confirmada</option>
                    <option value="Cancelada" ${cita.Estado === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
                    <option value="Completada" ${cita.Estado === 'Completada' ? 'selected' : ''}>Completada</option>
                </select>`
            : `<span class="ios-badge" style="font-size:0.95em;">${cita.Estado || 'Pendiente'}</span>`;

        // Asegura que los atributos de los botones sean únicos para cada modo
        const editAttr = modoTab ? 'data-edit-cita-tab' : 'data-edit-cita';
        const deleteAttr = modoTab ? 'data-delete-cita-tab' : 'data-delete-cita';

        // Cambia aquí: usa solo clases y elimina estilos inline de fondo/borde
        return `
        <div class="neo-card ios-list-item animate__animated animate__fadeInUp p-3">
            <div class="d-flex align-items-center mb-2 gap-3">
                <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:48px;height:48px;background:var(--gradient-neo);">
                    <i class="bi bi-person-badge" style="font-size:1.7rem;color:var(--color-accent)"></i>
                </div>
                <div>
                    <div class="fw-bold" style="font-size:1.15em;">${cita.Nombre} ${cita.Apellido}</div>
                    <div class="text-secondary small"><i class="bi bi-envelope"></i> ${cita.Correo_Electronico}</div>
                </div>
                <div class="ms-auto d-flex align-items-center gap-2">
                    ${estadoHtml}
                    <button class="btn btn-sm btn-outline-info ios-btn" style="padding:0.2em 1em;font-size:1em;" data-galeria-cita="${cita.ID_Cita}" title="Ver galería"><i class="bi bi-images"></i></button>
                    ${puedeEditar ? `
                        <button class="btn btn-sm btn-outline-primary ios-btn" style="padding:0.2em 1em;font-size:1em;" ${editAttr}="${cita.ID_Cita}" title="Editar"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger ios-btn" style="padding:0.2em 1em;font-size:1em;" ${deleteAttr}="${cita.ID_Cita}" title="Eliminar"><i class="bi bi-trash"></i></button>
                    ` : ''}
                </div>
            </div>
            <div class="row g-2">
                <div class="col-12 col-md-6">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-calendar-event" style="color:var(--color-accent)"></i>
                        <span class="text-dark">${cita.Fecha_Cita || ''}</span>
                    </div>
                </div>
                <div class="col-12 col-md-6">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-clock" style="color:var(--color-accent)"></i>
                        <span class="text-dark">${cita.Hora_Cita || ''}</span>
                    </div>
                </div>
                <div class="col-12 mt-2">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-chat-left-text" style="color:var(--color-mid)"></i>
                        <span class="text-secondary">${cita.Motivo ? cita.Motivo : '<span class="fst-italic text-muted">Sin motivo</span>'}</span>
                    </div>
                </div>
                <div class="col-12 mt-2">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-geo-alt" style="color:var(--color-mid)"></i>
                        <span class="text-secondary">${cita.Direccion}</span>
                    </div>
                </div>
                <div class="col-12 col-md-6">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-telephone" style="color:var(--color-mid)"></i>
                        <span class="text-secondary">${cita.Telefono}</span>
                    </div>
                </div>
                <div class="col-12 col-md-6">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-gender-ambiguous" style="color:var(--color-mid)"></i>
                        <span class="text-secondary">${cita.Sexo}</span>
                    </div>
                </div>
                ${cita.UsuarioCorreo ? `
                <div class="col-12 mt-2">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-person-circle" style="color:var(--color-accent)"></i>
                        <span class="small text-secondary">Usuario: ${cita.UsuarioCorreo}</span>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        `;
    }

    // Sobrescribe cargarCitas para mostrar info de pago/informe
    async function cargarCitas() {
        if (!token) return;
        crearModalEdicion();
        if (!citasList) return;
        try {
            const response = await fetch('/api/citas', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    mostrarLogin(true);
                    return;
                }
                citasList.innerHTML = '<div class="text-danger">No se pudieron cargar las citas.</div>';
                return;
            }
            const citas = await response.json();
            // Renderiza cada cita con info de pago/informe
            const htmls = await Promise.all(citas.map(c => renderCitaConInfo(c, false)));
            citasList.innerHTML = htmls.join('');
            // Asignar eventos a los botones de editar/eliminar/estado
            document.querySelectorAll('[data-edit-cita]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = btn.getAttribute('data-edit-cita');
                    const cita = citas.find(c => c.ID_Cita == id);
                    if (cita) {
                        editCitaId = cita.ID_Cita;
                        document.getElementById('editFecha_Cita').value = cita.Fecha_Cita || '';
                        document.getElementById('editHora_Cita').value = cita.Hora_Cita || '';
                        document.getElementById('editMotivo').value = cita.Motivo || '';
                        editModal.show();
                    }
                });
            });
            document.querySelectorAll('[data-delete-cita]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = btn.getAttribute('data-delete-cita');
                    if (confirm('¿Seguro que deseas eliminar esta cita?')) {
                        try {
                            const res = await fetch(`/api/citas/${id}`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': 'Bearer ' + token
                                }
                            });
                            const data = await res.json();
                            if (res.ok) {
                                // Refresca la página tras borrar
                                window.location.reload();
                            } else {
                                mostrarMensajeError(data.error || 'No se pudo eliminar la cita');
                            }
                        } catch {
                            mostrarMensajeError('Error de conexión');
                        }
                    }
                });
            });
            document.querySelectorAll('.estado-cita-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const id = select.getAttribute('data-cita-id');
                    const nuevoEstado = select.value;
                    try {
                        const res = await fetch(`/api/citas/${id}/estado`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            },
                            body: JSON.stringify({ Estado: nuevoEstado })
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            mostrarMensajeError(data.error || 'No se pudo actualizar el estado');
                        } else {
                            cargarCitas();
                        }
                    } catch {
                        mostrarMensajeError('Error de conexión');
                    }
                });
            });
            document.querySelectorAll('[data-galeria-cita]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-galeria-cita');
                    abrirGaleriaModal(id);
                });
            });
        } catch (error) {
            console.error('Error:', error);
            mostrarMensajeError('Error al cargar las citas');
        }
    }

    // --- GALERÍA DE RADIOGRAFÍAS ---
    // Abre el modal y carga las radiografías de una cita
    async function abrirGaleriaModal(idCita) {
        if (!token) return;
        const galeriaBody = document.getElementById('galeriaBody');
        galeriaBody.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;
        try {
            const res = await fetch(`/api/radiografias/${idCita}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) {
                galeriaBody.innerHTML = `<div class="text-danger text-center">No se pudieron cargar las radiografías.</div>`;
                return;
            }
            const rads = await res.json();
            if (!rads || rads.length === 0) {
                galeriaBody.innerHTML = `<div class="text-center text-muted py-4"><i class="bi bi-image" style="font-size:2em"></i><br>Sin imágenes para esta cita.</div>`;
                return;
            }
            galeriaBody.innerHTML = `
                <div class="row g-4">
                    ${rads.map(r => `
                        <div class="col-12 col-md-6 col-lg-4">
                            <div class="card shadow-sm h-100">
                                <div class="card-body d-flex flex-column align-items-center">
                                    ${r.Imagen_URL
                                        ? `<img src="${r.Imagen_URL}" alt="Radiografía" style="max-width:100%;max-height:180px;border-radius:12px;box-shadow:0 2px 8px #b5fff633;">`
                                        : `<div class="text-muted text-center py-4"><i class="bi bi-image" style="font-size:2em"></i><br>Sin imagen</div>`
                                    }
                                    <div class="mt-2 fw-bold">${r.Nombre_Categoria || 'Sin categoría'}</div>
                                    <div class="small text-secondary">${r.Fecha_Realizacion ? r.Fecha_Realizacion.substring(0,10) : ''}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            galeriaBody.innerHTML = `<div class="text-danger text-center">Error al cargar la galería.</div>`;
        }
        new bootstrap.Modal(document.getElementById('galeriaModal')).show();
    }

    // Función utilitaria para normalizar texto (quita tildes, pasa a minúsculas, quita espacios extra)
    function normalizarTexto(txt) {
        return (txt || '')
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // quita tildes
            .replace(/\s+/g, ' ') // espacios múltiples a uno solo
            .trim()
            .toLowerCase();
    }

    // Sobrescribe mostrarCitasEnPestana para mostrar info de pago/informe
    async function mostrarCitasEnPestana() {
        if (!token) return;
        // Filtro solo para admin
        let filtroHtml = '';
        if (user && user.Rol === 'admin') {
            filtroHtml = `
            <div class="mb-3">
                <input type="text" class="form-control" id="filtroCitas" placeholder="Buscar por paciente, correo, motivo, dirección, estado, usuario...">
            </div>
            `;
            document.getElementById('citasListTab').innerHTML = filtroHtml;
        }
        try {
            const response = await fetch('/api/citas', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!response.ok) {
                document.getElementById('citasListTab').innerHTML = filtroHtml + '<div class="text-danger">No se pudieron cargar las citas.</div>';
                return;
            }
            const citas = await response.json();
            async function renderCitas(filtro = '') {
                const filtroNorm = normalizarTexto(filtro);
                // Filtra por todos los campos relevantes
                const filtradas = citas.filter(c => {
                    const campos = [
                        c.Nombre, c.Apellido, c.Correo_Electronico, c.Motivo, c.Direccion,
                        c.Telefono, c.Sexo, c.Estado, c.UsuarioCorreo
                    ];
                    return campos.some(val => normalizarTexto(val).includes(filtroNorm));
                });
                const htmls = await Promise.all(filtradas.map(c => renderCitaConInfo(c, true)));
                document.getElementById('citasListTab').innerHTML = filtroHtml + htmls.join('');
                // Asignar eventos a los botones de editar/eliminar/estado
                document.querySelectorAll('[data-edit-cita-tab]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = btn.getAttribute('data-edit-cita-tab');
                        const cita = citas.find(c => c.ID_Cita == id);
                        if (cita) {
                            editCitaId = cita.ID_Cita;
                            document.getElementById('editFecha_Cita').value = cita.Fecha_Cita || '';
                            document.getElementById('editHora_Cita').value = cita.Hora_Cita || '';
                            document.getElementById('editMotivo').value = cita.Motivo || '';
                            editModal.show();
                        }
                    });
                });
                document.querySelectorAll('[data-delete-cita-tab]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = btn.getAttribute('data-delete-cita-tab');
                        if (confirm('¿Seguro que deseas eliminar esta cita?')) {
                            try {
                                const res = await fetch(`/api/citas/${id}`, {
                                    method: 'DELETE',
                                    headers: {
                                        'Authorization': 'Bearer ' + token
                                    }
                                });
                                const data = await res.json();
                                if (res.ok) {
                                    renderCitas(document.getElementById('filtroCitas')?.value || '');
                                    cargarCitas();
                                } else {
                                    mostrarMensajeError(data.error || 'No se pudo eliminar la cita');
                                }
                            } catch {
                                mostrarMensajeError('Error de conexión');
                            }
                        }
                    });
                });
                document.querySelectorAll('.estado-cita-select').forEach(select => {
                    select.addEventListener('change', async (e) => {
                        const id = select.getAttribute('data-cita-id');
                        const nuevoEstado = select.value;
                        try {
                            const res = await fetch(`/api/citas/${id}/estado`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + token
                                },
                                body: JSON.stringify({ Estado: nuevoEstado })
                            });
                            const data = await res.json();
                            if (!res.ok) {
                                mostrarMensajeError(data.error || 'No se pudo actualizar el estado');
                            } else {
                                renderCitas(document.getElementById('filtroCitas')?.value || '');
                                cargarCitas();
                            }
                        } catch {
                            mostrarMensajeError('Error de conexión');
                        }
                    });
                });
                document.querySelectorAll('[data-galeria-cita]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.getAttribute('data-galeria-cita');
                        abrirGaleriaModal(id);
                    });
                });
            }
            await renderCitas();
            // Evento para el filtro
            if (user && user.Rol === 'admin') {
                document.getElementById('filtroCitas').addEventListener('input', function() {
                    renderCitas(this.value);
                });
            }
        } catch (error) {
            document.getElementById('citasListTab').innerHTML = filtroHtml + '<div class="text-danger">No se pudieron cargar las citas.</div>';
        }
    }

    // Crear pestaña/modal para citas programadas (accesible para todos)
    function crearPestanaCitas() {
        // El modal de citasTabModal debe estar en index.html
        // Aquí solo se referencia y se asignan eventos.
        if (document.getElementById('citasTabModal')) return;
        const modalHtml = `
        <div class="modal fade" id="citasTabModal" tabindex="-1" aria-labelledby="citasTabModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content ios-glass">
              <div class="modal-header">
                <h5 class="modal-title" id="citasTabModalLabel"><i class="bi bi-list-ul"></i> Citas Programadas</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
                <div id="citasListTab" class="d-flex flex-column gap-3"></div>
              </div>
            </div>
          </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Botón en la barra superior para abrir la pestaña/modal de citas
        if (!document.getElementById('citasTabBtn')) {
            const btn = document.createElement('button');
            btn.className = 'ios-btn';
            btn.id = 'citasTabBtn';
            btn.style = 'background:linear-gradient(90deg,#5e60ce 0%,#48bfe3 100%);color:#fff;padding:0.4em 1.2em;font-size:1em;';
            btn.innerHTML = '<i class="bi bi-list-ul"></i> Citas';
            btn.onclick = () => {
                mostrarCitasEnPestana();
                new bootstrap.Modal(document.getElementById('citasTabModal')).show();
            };
            // Insertar antes del botón de perfil
            document.getElementById('topBarBtns').insertBefore(btn, document.getElementById('perfilBtn'));
        }
    }

    // Mostrar todos los usuarios (solo admin) en una pestaña/modal separada
    function crearPestanaUsuarios() {
        // El modal de usuariosTabModal debe estar en index.html
        // Aquí solo se referencia y se asignan eventos.
        if (document.getElementById('usuariosTabModal')) return;
        const modalHtml = `
        <div class="modal fade" id="usuariosTabModal" tabindex="-1" aria-labelledby="usuariosTabModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content ios-glass">
              <div class="modal-header">
                <h5 class="modal-title" id="usuariosTabModalLabel"><i class="bi bi-people"></i> Usuarios Registrados</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
                <div id="usuariosList" class="row g-3"></div>
              </div>
            </div>
          </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Botón en la barra superior para abrir la pestaña/modal de usuarios
        if (!document.getElementById('usuariosTabBtn')) {
            const btn = document.createElement('button');
            btn.className = 'ios-btn';
            btn.id = 'usuariosTabBtn';
            btn.style = 'background:linear-gradient(90deg,#b28dff 0%,#b5fff6 100%);color:#fff;padding:0.4em 1.2em;font-size:1em;';
            btn.innerHTML = '<i class="bi bi-people"></i> Usuarios';
            btn.onclick = () => {
                mostrarUsuarios();
                new bootstrap.Modal(document.getElementById('usuariosTabModal')).show();
            };
            document.getElementById('topBarBtns').insertBefore(btn, document.getElementById('perfilBtn'));
        }
    }

    // Mostrar todos los usuarios (solo admin) en la pestaña/modal
    async function mostrarUsuarios() {
        if (!token || !user || user.Rol !== 'admin') {
            alert('Solo los administradores pueden ver la lista de usuarios.');
            return;
        }
        crearPestanaUsuarios();

        // Filtro de búsqueda solo para admin
        let filtroHtml = '';
        if (user && user.Rol === 'admin') {
            filtroHtml = `
            <div class="mb-3">
                <input type="text" class="form-control" id="filtroUsuarios" placeholder="Buscar usuario, correo, nombre, rol, teléfono...">
            </div>
            `;
            document.getElementById('usuariosList').innerHTML = filtroHtml;
        }

        try {
            const res = await fetch('/api/usuarios', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) {
                document.getElementById('usuariosList').innerHTML = filtroHtml + '<div class="text-danger">No autorizado o error al cargar usuarios.</div>';
                return;
            }
            const usuarios = await res.json();
            function renderUsuarios(filtro = '') {
                const filtroNorm = normalizarTexto(filtro);
                const filtrados = usuarios.filter(u => {
                    const campos = [
                        u.Nombre_Usuario, u.Correo, u.Nombre_Completo, u.Rol, u.Telefono, u.Direccion, u.Sexo
                    ];
                    return campos.some(val => normalizarTexto(val).includes(filtroNorm));
                });
                document.getElementById('usuariosList').innerHTML = filtroHtml + filtrados.map(u => `
                    <div class="col-12 col-md-6 col-lg-4">
                      <div class="ios-list-item d-flex flex-column align-items-center p-3 h-100" style="background:linear-gradient(120deg,#ffe6fa 0%,#b5fff6 100%);">
                        <img src="${u.Foto_Perfil ? u.Foto_Perfil : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.Nombre_Usuario || 'Usuario') + '&background=ffe6fa&color=b28dff&size=96'}"
                             alt="Foto" style="width:72px;height:72px;object-fit:cover;border-radius:50%;border:2px solid #b28dff;margin-bottom:10px;">
                        <div class="fw-bold mb-1" style="font-size:1.1em;">${u.Nombre_Usuario}</div>
                        <span class="badge bg-light text-dark mb-2">${u.Rol}</span>
                        <div class="w-100 small text-secondary mb-1"><i class="bi bi-envelope"></i> ${u.Correo}</div>
                        <div class="w-100 small text-secondary mb-1"><i class="bi bi-person"></i> ${u.Nombre_Completo || ''}</div>
                        <div class="w-100 small text-secondary mb-1"><i class="bi bi-telephone"></i> ${u.Telefono || ''}</div>
                        <div class="w-100 small text-secondary mb-1"><i class="bi bi-geo-alt"></i> ${u.Direccion || ''}</div>
                        <div class="w-100 small text-secondary mb-1"><i class="bi bi-calendar"></i> ${u.Fecha_Nacimiento ? u.Fecha_Nacimiento.substring(0,10) : ''}</div>
                        <div class="w-100 small text-secondary mb-2"><i class="bi bi-gender-ambiguous"></i> ${u.Sexo || ''}</div>
                        <div class="d-flex gap-2 w-100 justify-content-center">
                            <button class="btn btn-sm ios-btn" style="background:linear-gradient(90deg,#b5fff6 0%,#ffb5e8 100%);color:#b28dff;" data-ver-perfil="${u.ID_Usuario}" title="Ver/Editar"><i class="bi bi-person-lines-fill"></i></button>
                            <button class="btn btn-sm btn-danger" data-borrar-usuario="${u.ID_Usuario}" title="Borrar"><i class="bi bi-trash"></i></button>
                        </div>
                      </div>
                    </div>
                `).join('');
                document.querySelectorAll('[data-ver-perfil]').forEach(btn => {
                    btn.onclick = () => abrirPerfilModal(btn.getAttribute('data-ver-perfil'));
                });
                document.querySelectorAll('[data-borrar-usuario]').forEach(btn => {
                    btn.onclick = async () => {
                        const id = btn.getAttribute('data-borrar-usuario');
                        if (confirm('¿Seguro que deseas borrar este usuario?')) {
                            await borrarPerfil(Number(id));
                            // Refresca la página tras borrar usuario
                            window.location.reload();
                        }
                    };
                });
            }
            renderUsuarios();

            // Evento para el filtro
            if (user && user.Rol === 'admin') {
                document.getElementById('filtroUsuarios').addEventListener('input', function() {
                    renderUsuarios(this.value);
                });
            }
        } catch (error) {
            document.getElementById('usuariosList').innerHTML = filtroHtml + '<div class="text-danger">No se pudieron cargar los usuarios</div>';
        }
    }

    // Mostrar botón de perfil y asignar evento
    function mostrarBotonPerfil() {
        if (topBarBtns) topBarBtns.style.display = '';
        document.getElementById('perfilBtn').onclick = () => abrirPerfilModal(user.ID_Usuario);
        // Mostrar botón de informes solo para admin
        const adminBtn = document.getElementById('adminInformesBtn');
        if (adminBtn) {
            if (user && user.Rol === 'admin') {
                adminBtn.classList.remove('d-none');
            } else {
                adminBtn.classList.add('d-none');
            }
        }
    }

    // Abrir modal de perfil (propio o admin)
    async function abrirPerfilModal(id) {
        if (!token) return;
        const modal = new bootstrap.Modal(document.getElementById('perfilModal'));
        document.getElementById('perfilForm').reset();

        // Previsualización de foto
        const fotoInput = document.getElementById('perfilFoto');
        const fotoPreview = document.getElementById('perfilFotoPreview');
        let fotoBase64 = null;

        fotoInput.onchange = function () {
            const file = fotoInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    fotoPreview.src = e.target.result;
                    fotoBase64 = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
        // Click en label abre input file
        document.querySelector('label[for="perfilFoto"]').onclick = () => fotoInput.click();

        // Carga datos
        try {
            const res = await fetch(`/api/usuarios/${id}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const perfil = await res.json();
            document.getElementById('perfilNombreUsuario').value = perfil.Nombre_Usuario || '';
            document.getElementById('perfilNombreCompleto').value = perfil.Nombre_Completo || '';
            document.getElementById('perfilCorreo').value = perfil.Correo || '';
            document.getElementById('perfilTelefono').value = perfil.Telefono || '';
            document.getElementById('perfilDireccion').value = perfil.Direccion || '';
            document.getElementById('perfilFechaNacimiento').value = perfil.Fecha_Nacimiento ? perfil.Fecha_Nacimiento.substring(0,10) : '';
            document.getElementById('perfilSexo').value = perfil.Sexo || '';
            fotoPreview.src = perfil.Foto_Perfil || 'https://ui-avatars.com/api/?name=Usuario&background=ffe6fa&color=b28dff&size=96';

            // Guardar cambios
            document.getElementById('perfilForm').onsubmit = async function(e) {
                e.preventDefault();
                const datos = {
                    Nombre_Usuario: document.getElementById('perfilNombreUsuario').value,
                    Nombre_Completo: document.getElementById('perfilNombreCompleto').value,
                    Telefono: document.getElementById('perfilTelefono').value,
                    Direccion: document.getElementById('perfilDireccion').value,
                    Fecha_Nacimiento: document.getElementById('perfilFechaNacimiento').value,
                    Sexo: document.getElementById('perfilSexo').value,
                    Foto_Perfil: fotoBase64 // solo si se seleccionó una nueva
                };
                await guardarPerfil(Number(id), datos);
                modal.hide();
                if (user.Rol === 'admin') mostrarUsuarios();
            };
            // Borrar usuario
            document.getElementById('borrarPerfilBtn').onclick = async function() {
                if (confirm('¿Seguro que deseas borrar este perfil?')) {
                    await borrarPerfil(Number(id));
                    modal.hide();
                    if (user.Rol === 'admin') mostrarUsuarios();
                }
            };
            modal.show();
        } catch (error) {
            mostrarMensajeError('No se pudo cargar el perfil');
        }
    }

    async function guardarPerfil(id, datos) {
        if (!token) return;
        if (!datos.Foto_Perfil) delete datos.Foto_Perfil;
        try {
            const res = await fetch(`/api/usuarios/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify(datos)
            });
            const data = await res.json();
            if (!res.ok) {
                mostrarMensajeError(data.error || 'No se pudo actualizar el perfil');
            } else {
                // Refresca la página tras editar perfil
                window.location.reload();
            }
        } catch (error) {
            mostrarMensajeError('Error al actualizar el perfil');
        }
    }

    async function borrarPerfil(id) {
        if (!token) return;
        if (!confirm('¿Seguro que deseas borrar tu perfil?')) return;
        try {
            const res = await fetch(`/api/usuarios/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const data = await res.json();
            if (res.ok) {
                alert('Perfil eliminado');
                // Si es el propio usuario, cerrar sesión
                if (user.ID_Usuario === id) {
                    logoutBtn.click();
                } else {
                    // Refresca la página tras eliminar otro usuario
                    window.location.reload();
                }
            } else {
                mostrarMensajeError(data.error || 'No se pudo eliminar el perfil');
            }
        } catch (error) {
            mostrarMensajeError('Error al eliminar el perfil');
        }
    }

    async function agregarInfoPersonal(id, datos) {
        if (!token) return;
        try {
            const res = await fetch(`/api/usuarios/${id}/info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify(datos)
            });
            const data = await res.json();
            if (!res.ok) mostrarMensajeError(data.error || 'No se pudo agregar la información');
        } catch (error) {
            mostrarMensajeError('Error al agregar información');
        }
    }

    // Crear barra superior izquierda para pestañas de navegación (citas y usuarios)
    function crearBarraIzquierda() {
        // Si ya existe, primero la ocultamos y la limpiamos para evitar duplicados
        let leftBar = document.getElementById('leftBarBtns');
        if (!leftBar) {
            leftBar = document.createElement('div');
            leftBar.id = 'leftBarBtns';
            leftBar.className = 'd-flex flex-row gap-2 align-items-center';
            leftBar.style = `
                position: fixed;
                top: 18px;
                left: 24px;
                z-index: 1050;
                background: rgba(255,255,255,0.85);
                border-radius: 22px;
                box-shadow: 0 2px 16px #b5fff633;
                padding: 0.2em 0.7em;
                gap: 0.5em;
                align-items: center;
                display: none;
            `;
            document.body.appendChild(leftBar);
        }
        leftBar.innerHTML = ''; // Limpia los botones

        // Solo mostrar barra si hay sesión iniciada
        if (!token || !user) {
            leftBar.style.display = 'none';
            return;
        }
        leftBar.style.display = '';

        // Botón de Citas (todos los usuarios autenticados)
        if (!document.getElementById('citasTabBtn')) {
            const btnCitas = document.createElement('button');
            btnCitas.className = 'ios-btn';
            btnCitas.id = 'citasTabBtn';
            btnCitas.style = 'background:linear-gradient(90deg,#5e60ce 0%,#48bfe3 100%);color:#fff;padding:0.4em 1.2em;font-size:1em;';
            btnCitas.innerHTML = '<i class="bi bi-list-ul"></i> Citas';
            btnCitas.onclick = () => {
                mostrarCitasEnPestana();
                new bootstrap.Modal(document.getElementById('citasTabModal')).show();
            };
            leftBar.appendChild(btnCitas);
        }

        // Botón de Usuarios (solo admin)
        if (user && user.Rol === 'admin' && !document.getElementById('usuariosTabBtn')) {
            const btnUsuarios = document.createElement('button');
            btnUsuarios.className = 'ios-btn';
            btnUsuarios.id = 'usuariosTabBtn';
            btnUsuarios.style = 'background:linear-gradient(90deg,#b28dff 0%,#b5fff6 100%);color:#fff;padding:0.4em 1.2em;font-size:1em;';
            btnUsuarios.innerHTML = '<i class="bi bi-people"></i> Usuarios';
            btnUsuarios.onclick = () => {
                mostrarUsuarios();
                new bootstrap.Modal(document.getElementById('usuariosTabModal')).show();
            };
            leftBar.appendChild(btnUsuarios);
        }
    }

    // Mostrar/ocultar barra superior derecha (perfil/logout) según sesión
    function mostrarBarraDerecha(visible) {
        // Cambia de topBarBtns a authBtns para mostrar/ocultar ambos botones juntos
        const authBtns = document.getElementById('authBtns');
        if (authBtns) authBtns.style.display = visible ? '' : 'none';
        // Oculta también los botones de la barra izquierda si no hay sesión
        const leftBar = document.getElementById('leftBarBtns');
        if (leftBar) leftBar.style.display = visible ? '' : 'none';
    }

    // Mostrar login o app según estado
    // Refresca el user desde localStorage para asegurar el rol correcto
    token = localStorage.getItem('token') || null;
    user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;

    if (token && user) {
        mostrarApp();
        mostrarBotonPerfil();
        crearPestanaCitas();
        crearBarraIzquierda();
        mostrarBarraDerecha(true);
        if (user.Rol === 'admin') {
            crearPestanaUsuarios();
            // Ya no es necesario mostrar topBarBtns, ahora se usa authBtns
        } else {
            const usuariosTabBtn = document.getElementById('usuariosTabBtn');
            if (usuariosTabBtn) usuariosTabBtn.style.display = 'none';
        }
    } else {
        // Oculta los botones de sesión si no hay usuario autenticado
        mostrarBarraDerecha(false);
        if (document.getElementById('leftBarBtns')) {
            document.getElementById('leftBarBtns').style.display = 'none';
        }
        mostrarLogin(true);
    }
});