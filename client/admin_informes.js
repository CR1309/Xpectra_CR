const token = localStorage.getItem('token');
let user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
if (!token || !user || user.Rol !== 'admin') {
    document.body.innerHTML = '<p class="error">No autenticado o no eres administrador. Inicia sesión como administrador.</p>';
    throw new Error('No autenticado o no eres administrador');
}

// Logout rápido (botón en header)
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/landing.html'; };
    }
    // Enlazar botón Perfil (se inserta dinámicamente en admin_informes.html)
    function bindPerfilBtn() {
        const btn = document.getElementById('perfilBtn');
        if (btn && !btn.dataset.bound) {
            btn.addEventListener('click', () => adminAbrirPerfilModal(user.ID_Usuario));
            btn.dataset.bound = '1';
        }
    }
    // Intentos para asegurar el enlace aunque el script inline lo inserte después
    bindPerfilBtn();
    setTimeout(bindPerfilBtn, 100);
    setTimeout(bindPerfilBtn, 500);
});

// Utilidad para mostrar mensajes y autolimpiar
function mostrarMsg(html, tipo = "info", timeout = 4000) {
    const msg = document.getElementById('msg');
    msg.innerHTML = `<span class="${tipo}">${html}</span>`;
    if (timeout > 0) setTimeout(() => { msg.innerHTML = ""; }, timeout);
}

// --- Perfil (admin) ---
async function adminAbrirPerfilModal(id) {
    if (!token) return;
    const modalEl = document.getElementById('perfilModal');
    if (!modalEl) return;
    const modal = new bootstrap.Modal(modalEl);
    const form = document.getElementById('perfilForm');
    const fotoInput = document.getElementById('perfilFoto');
    const fotoPreview = document.getElementById('perfilFotoPreview');
    let fotoBase64 = null;

    // Reset form y preview
    if (form) form.reset();
    if (fotoPreview) fotoPreview.src = '/img/XPectra.png';

    if (fotoInput) {
        fotoInput.onchange = function () {
            const file = fotoInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    if (fotoPreview) fotoPreview.src = e.target.result;
                    fotoBase64 = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
        // Click en label abre input file
        const label = document.querySelector('label[for="perfilFoto"]');
        if (label) label.onclick = () => fotoInput.click();
    }

    try {
        const res = await fetch(`/api/usuarios/${id}`, { headers: { Authorization: 'Bearer ' + token } });
        const perfil = await res.json();
        const nombreEl = document.getElementById('perfilNombreUsuario');
        const correoEl = document.getElementById('perfilCorreo');
        if (nombreEl) nombreEl.value = perfil.Nombre_Usuario || '';
        if (correoEl) correoEl.value = perfil.Correo || '';
        if (fotoPreview) fotoPreview.src = perfil.Foto_Perfil || fotoPreview.src;

        if (form) {
            form.onsubmit = async function (e) {
                e.preventDefault();
                const datos = {
                    Nombre_Usuario: nombreEl ? nombreEl.value : '',
                    Foto_Perfil: fotoBase64
                };
                if (!datos.Foto_Perfil) delete datos.Foto_Perfil;
                await adminGuardarPerfil(Number(id), datos);
                modal.hide();
            };
        }
        const borrarBtn = document.getElementById('borrarPerfilBtn');
        if (borrarBtn) {
            borrarBtn.onclick = async function () {
                if (confirm('¿Seguro que deseas borrar este perfil?')) {
                    await adminBorrarPerfil(Number(id));
                    modal.hide();
                }
            };
        }
        modal.show();
    } catch (e) {
        notify('No se pudo cargar el perfil', { type: 'danger' });
    }
}

async function adminGuardarPerfil(id, datos) {
    if (!token) return;
    if (!datos.Foto_Perfil) delete datos.Foto_Perfil;
    try {
        const res = await fetch(`/api/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify(datos)
        });
        const data = await res.json();
        if (!res.ok) {
            notify(data.error || 'No se pudo actualizar el perfil', { type: 'danger' });
        } else {
            // Refrescar para reflejar cambios (nombre/foto en UI)
            window.location.reload();
        }
    } catch (e) {
        notify('Error al actualizar el perfil', { type: 'danger' });
    }
}

async function adminBorrarPerfil(id) {
    if (!token) return;
    try {
        const res = await fetch(`/api/usuarios/${id}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();
        if (res.ok) {
            notify('Perfil eliminado', { type: 'success' });
            // Si el admin elimina su propio perfil, regresar a landing
            if (user && user.ID_Usuario === id) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/landing.html';
            } else {
                window.location.reload();
            }
        } else {
            notify(data.error || 'No se pudo eliminar el perfil', { type: 'danger' });
        }
    } catch (e) {
        notify('Error al eliminar el perfil', { type: 'danger' });
    }
}

// Cargar citas pendientes
async function cargarCitas() {
    const select = document.getElementById('cita');
    if (!select) return;
    select.innerHTML = '';
    document.getElementById('paciente-info').innerHTML = '';
    mostrarMsg('', 'info', 0);
    try {
        const res = await fetch('/api/citas-sin-informe', {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) {
            // Alternativa: Si hay error, muestra opción de recargar y no bloquea el select
            const data = await res.json().catch(() => ({}));
            select.innerHTML = '<option value="">Error al cargar citas. <Recargar></option>';
            mostrarMsg((data.error || 'Error al cargar citas.') + ' Intenta recargar la página.', 'error');
            return;
        }
        const citas = await res.json();
        if (!Array.isArray(citas) || citas.length === 0) {
            select.innerHTML = '<option value="">No hay citas pendientes</option>';
            mostrarMsg('No hay citas pendientes de informe.', 'success');
            return;
        }
        select.innerHTML = '<option value="">Selecciona una cita</option>';
        citas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify({
                idRad: c.ID_Radiografia,
                nombre: c.Nombre,
                apellido: c.Apellido,
                fecha: c.Fecha_Cita,
                hora: c.Hora_Cita,
                idCita: c.ID_Cita
            });
            opt.textContent = `#${c.ID_Cita} - ${c.Nombre} ${c.Apellido} | ${c.Fecha_Cita} ${c.Hora_Cita}`;
            select.appendChild(opt);
        });
        mostrarPaciente();
    } catch (err) {
        mostrarMsg('Error de conexión al cargar citas.', 'error');
    }
}

function mostrarPaciente() {
    const select = document.getElementById('cita');
    if (!select.value) {
        document.getElementById('paciente-info').innerHTML = '';
        return;
    }
    let data;
    try {
        data = JSON.parse(select.value);
    } catch {
        document.getElementById('paciente-info').innerHTML = '';
        return;
    }
    document.getElementById('paciente-info').innerHTML = `
        <strong>Cita #${data.idCita}</strong><br>
        <span>Paciente: <b>${data.nombre} ${data.apellido}</b></span><br>
        <span>Fecha: <b>${data.fecha}</b> | Hora: <b>${data.hora}</b></span>
    `;
}

document.getElementById('cita').addEventListener('change', mostrarPaciente);

// Vista previa de imagen
document.getElementById('imagen').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) {
        document.getElementById('preview').innerHTML = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(ev) {
        document.getElementById('preview').innerHTML = `<img src="${ev.target.result}" width="200">`;
    };
    reader.readAsDataURL(file);
});

// --- CÁMARA ---
// Referencias
const btnAbrirCamara = document.getElementById('abrir-camara');
const camaraContainer = document.getElementById('camara-container');
const videoCamara = document.getElementById('video-camara');
const btnCapturarFoto = document.getElementById('capturar-foto');
const btnCerrarCamara = document.getElementById('cerrar-camara');
const inputImagen = document.getElementById('imagen');
let streamCamara = null;
let imagenCapturadaBlob = null;

// Abrir cámara
btnAbrirCamara.addEventListener('click', async function() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        mostrarMsg('Tu dispositivo no soporta la cámara.', 'error');
        return;
    }
    try {
        streamCamara = await navigator.mediaDevices.getUserMedia({ video: true });
        videoCamara.srcObject = streamCamara;
        camaraContainer.style.display = 'block';
        btnAbrirCamara.style.display = 'none';
        inputImagen.value = ''; // Limpiar selección de archivo
        document.getElementById('preview').innerHTML = '';
        imagenCapturadaBlob = null;
    } catch (err) {
        mostrarMsg('No se pudo acceder a la cámara.', 'error');
    }
});

// Capturar foto
btnCapturarFoto.addEventListener('click', function() {
    const canvas = document.createElement('canvas');
    canvas.width = videoCamara.videoWidth || 220;
    canvas.height = videoCamara.videoHeight || 160;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoCamara, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
        imagenCapturadaBlob = blob;
        // Mostrar preview
        const url = URL.createObjectURL(blob);
        document.getElementById('preview').innerHTML = `<img src="${url}" width="200">`;
        // Limpiar input file
        inputImagen.value = '';
        mostrarMsg('Imagen capturada de la cámara. Puedes analizarla o guardarla.', 'success');
    }, 'image/jpeg', 0.95);
});

// Cerrar cámara
btnCerrarCamara.addEventListener('click', function() {
    if (streamCamara) {
        streamCamara.getTracks().forEach(track => track.stop());
        streamCamara = null;
    }
    camaraContainer.style.display = 'none';
    btnAbrirCamara.style.display = '';
});

// Si el usuario selecciona archivo, cerrar cámara y limpiar imagen capturada
inputImagen.addEventListener('change', function(e) {
    if (streamCamara) {
        btnCerrarCamara.click();
    }
    imagenCapturadaBlob = null;
    const file = e.target.files[0];
    if (!file) {
        document.getElementById('preview').innerHTML = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(ev) {
        document.getElementById('preview').innerHTML = `<img src="${ev.target.result}" width="200">`;
    };
    reader.readAsDataURL(file);
});

// Validación de campos antes de enviar
function validarFormulario() {
    const select = document.getElementById('cita');
    if (!select.value) return "Selecciona una cita.";
    // Modificado: permitir imagen de archivo o de cámara
    const imagenArchivo = document.getElementById('imagen').files[0];
    if (!imagenArchivo && !imagenCapturadaBlob) return "Selecciona una imagen para subir o usa la cámara.";
    const Diagnostico = document.getElementById('Diagnostico').value.trim();
    if (!Diagnostico) return "El campo Diagnóstico es obligatorio.";
    const Fecha_Informe = document.getElementById('Fecha_Informe').value;
    if (!Fecha_Informe) return "La fecha del informe es obligatoria.";
    return null;
}

// Enviar formulario
document.getElementById('form-informe').addEventListener('submit', async function(e) {
    e.preventDefault();
    const error = validarFormulario();
    if (error) {
        mostrarMsg(error, 'error');
        return;
    }
    const select = document.getElementById('cita');
    const data = JSON.parse(select.value);
    const idRad = data.idRad;

    // 1. Subir imagen (archivo o cámara)
    let imagen = document.getElementById('imagen').files[0];
    if (!imagen && imagenCapturadaBlob) {
        imagen = new File([imagenCapturadaBlob], 'captura.jpg', { type: 'image/jpeg' });
    }
    const formData = new FormData();
    formData.append('imagen', imagen);
    let urlImagen = '';
    let res;
    let resp;
    try {
        res = await fetch(`/api/radiografias/${idRad}/upload`, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
            body: formData
        });
        resp = await res.json();
    } catch (err) {
        mostrarMsg('Error de conexión al subir imagen.', 'error');
        return;
    }
    if (!resp.success) {
        mostrarMsg(resp.error || 'Error al subir imagen.', 'error');
        return;
    }
    urlImagen = resp.url;

    // 2. Crear informe
    const Diagnostico = document.getElementById('Diagnostico').value;
    const Recomendaciones = document.getElementById('Recomendaciones').value;
    const IA_Prediccion = document.getElementById('IA_Prediccion').value;
    const Fecha_Informe = document.getElementById('Fecha_Informe').value;
    try {
        res = await fetch('/api/informes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token
            },
            body: JSON.stringify({
                Diagnostico,
                Recomendaciones,
                Fecha_Informe,
                IA_Prediccion,
                ID_Radiografia: idRad
            })
        });
        resp = await res.json();
    } catch (err) {
        mostrarMsg('Error de conexión al guardar informe.', 'error');
        return;
    }
    if (resp.success) {
        mostrarMsg('Informe guardado correctamente.', 'success');
        cargarCitas();
        cargarInformes();
        document.getElementById('form-informe').reset();
        document.getElementById('preview').innerHTML = '';
        document.getElementById('ia-label-container').innerHTML = '';
        // Reiniciar fecha a hoy
        document.getElementById('Fecha_Informe').valueAsDate = new Date();
    } else {
        mostrarMsg(resp.error || 'Error al guardar informe.', 'error');
    }
});

// Mostrar todos los informes existentes
async function cargarInformes() {
    const tbody = document.querySelector('#tabla-informes tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9">Cargando...</td></tr>';
    try {
        const res = await fetch('/api/informes', {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="9">Error al cargar informes.</td></tr>`;
            return;
        }
        const informes = await res.json();
        window.__INFORMES_CACHE__ = informes; // cache global para filtrado
        if (!Array.isArray(informes) || informes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9">No hay informes registrados.</td></tr>`;
            return;
        }
        tbody.innerHTML = '';
        informes.forEach(inf => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${inf.ID_Informe}</td>
                <td>${inf.Paciente_Nombre} ${inf.Paciente_Apellido}</td>
                <td>${inf.Fecha_Cita}</td>
                <td>${inf.Hora_Cita}</td>
                <td>${inf.Nombre_Categoria || ''}</td>
                <td>
                    <span class="cell-truncate" title="${inf.Diagnostico || ''}">
                        ${inf.Diagnostico || ''}
                    </span>
                </td>
                <td>${inf.Fecha_Informe}</td>
                <td>${inf.Imagen_URL ? `<button type="button" class="btn btn-outline-info btn-sm" data-ver-imagen="${encodeURIComponent(inf.Imagen_URL)}" title="Ver imagen"><i class="bi bi-eye"></i></button>` : ''}</td>
                <td>
                    <button class="btn btn-outline-primary btn-sm me-1" title="Editar" data-edit-informe="${inf.ID_Informe}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" title="Eliminar" data-delete-informe="${inf.ID_Informe}">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Eventos para editar
        tbody.querySelectorAll('[data-edit-informe]').forEach(btn => {
            btn.onclick = async function() {
                const id = btn.getAttribute('data-edit-informe');
                abrirModalEditarInforme(id); // Esto ya abre el modal al hacer click en "Editar"
            };
        });
        // Eventos para eliminar
        tbody.querySelectorAll('[data-delete-informe]').forEach(btn => {
            btn.onclick = async function() {
                const id = btn.getAttribute('data-delete-informe');
                eliminarInforme(id, btn);
            };
        });
                // Eventos visor imagen
                tbody.querySelectorAll('[data-ver-imagen]').forEach(btn => {
                    btn.onclick = () => {
                        const url = decodeURIComponent(btn.getAttribute('data-ver-imagen'));
                        const body = document.getElementById('visorImagenBody');
                        if(body){
                            body.innerHTML = `<img src="${url}" alt="Radiografía" class="img-fluid rounded shadow" style="max-height:70vh;object-fit:contain;"/>`;
                            const modal = new bootstrap.Modal(document.getElementById('visorImagenModal'));
                            modal.show();
                        }
                    };
                });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="9">Error de conexión al cargar informes.</td></tr>`;
    }
}

// Filtrado de informes en cliente
function aplicarFiltroInformes() {
    const filtroTxt = (document.getElementById('filtroInformes')?.value || '').toLowerCase();
    const fDesde = document.getElementById('filtroFechaDesde')?.value || '';
    const fHasta = document.getElementById('filtroFechaHasta')?.value || '';
    const tbody = document.querySelector('#tabla-informes tbody');
    const datos = Array.isArray(window.__INFORMES_CACHE__) ? window.__INFORMES_CACHE__ : [];
    if(!tbody){ return; }
    if(datos.length === 0){ return; }
    const fil = datos.filter(inf => {
        const texto = [inf.Paciente_Nombre, inf.Paciente_Apellido, inf.Diagnostico, inf.Nombre_Categoria].join(' ').toLowerCase();
        if(filtroTxt && !texto.includes(filtroTxt)) return false;
        if(fDesde && (!inf.Fecha_Informe || inf.Fecha_Informe < fDesde)) return false;
        if(fHasta && (!inf.Fecha_Informe || inf.Fecha_Informe > fHasta)) return false;
        return true;
    });
    tbody.innerHTML = '';
    if(fil.length === 0){
        tbody.innerHTML = '<tr><td colspan="9">Sin resultados para el filtro aplicado.</td></tr>';
        return;
    }
    fil.forEach(inf => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${inf.ID_Informe}</td>
            <td>${inf.Paciente_Nombre} ${inf.Paciente_Apellido}</td>
            <td>${inf.Fecha_Cita}</td>
            <td>${inf.Hora_Cita}</td>
            <td>${inf.Nombre_Categoria || ''}</td>
            <td><span class="cell-truncate" title="${inf.Diagnostico || ''}">${inf.Diagnostico || ''}</span></td>
            <td>${inf.Fecha_Informe}</td>
            <td>${inf.Imagen_URL ? `<button type="button" class="btn btn-outline-info btn-sm" data-ver-imagen="${encodeURIComponent(inf.Imagen_URL)}" title="Ver imagen"><i class="bi bi-eye"></i></button>` : ''}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm me-1" title="Editar" data-edit-informe="${inf.ID_Informe}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-outline-danger btn-sm" title="Eliminar" data-delete-informe="${inf.ID_Informe}"><i class="bi bi-trash"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });
    // Reasignar eventos después de filtrar
    tbody.querySelectorAll('[data-edit-informe]').forEach(btn => btn.onclick = () => abrirModalEditarInforme(btn.getAttribute('data-edit-informe')));
    tbody.querySelectorAll('[data-delete-informe]').forEach(btn => btn.onclick = () => eliminarInforme(btn.getAttribute('data-delete-informe'), btn));
    tbody.querySelectorAll('[data-ver-imagen]').forEach(btn => {
        btn.onclick = () => {
            const url = decodeURIComponent(btn.getAttribute('data-ver-imagen'));
            const body = document.getElementById('visorImagenBody');
            if(body){
                body.innerHTML = `<img src="${url}" alt="Radiografía" class="img-fluid rounded shadow" style="max-height:70vh;object-fit:contain;"/>`;
                const modal = new bootstrap.Modal(document.getElementById('visorImagenModal'));
                modal.show();
            }
        };
    });
}

// Eventos de filtro
document.addEventListener('DOMContentLoaded', () => {
    ['filtroInformes','filtroFechaDesde','filtroFechaHasta'].forEach(id => {
        const el = document.getElementById(id);
        if(el){ el.addEventListener('input', aplicarFiltroInformes); }
    });
});

// Modal de edición de informe (inline, igual que Gestión de Citas)
function abrirModalEditarInforme(idInforme) {
    // Si ya existe el modal, elimínalo
    let modalDiv = document.getElementById('editInformeModal');
    if (modalDiv) modalDiv.remove();

    // Carga datos actuales
    fetch(`/api/informes/${idInforme}`, {
        headers: { Authorization: 'Bearer ' + token }
    })
    .then(res => res.ok ? res.json() : null)
    .then(informe => {
        if (!informe) {
            mostrarMsg('No se pudo cargar el informe.', 'error');
            return;
        }
        // Crea el modal
        const modalHtml = `
        <div class="modal fade" id="editInformeModal" tabindex="-1" aria-labelledby="editInformeModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content ios-glass">
              <div class="modal-header">
                <h5 class="modal-title" id="editInformeModalLabel"><i class="bi bi-file-earmark-medical"></i> Editar Informe</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
              <form id="editInformeForm">
                <div class="modal-body">
                  <div class="mb-3">
                    <label class="form-label">Diagnóstico</label>
                    <textarea class="form-control" id="editDiagnostico" required>${informe.Diagnostico || ''}</textarea>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Recomendaciones</label>
                    <textarea class="form-control" id="editRecomendaciones">${informe.Recomendaciones || ''}</textarea>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Predicción IA</label>
                    <input type="text" class="form-control" id="editIA_Prediccion" value="${informe.IA_Prediccion || ''}">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Fecha del informe</label>
                    <input type="date" class="form-control" id="editFecha_Informe" value="${informe.Fecha_Informe ? informe.Fecha_Informe.substring(0,10) : ''}" required>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                  <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('editInformeModal'));
        document.getElementById('editInformeForm').onsubmit = async function(e) {
            e.preventDefault();
            const Diagnostico = document.getElementById('editDiagnostico').value;
            const Recomendaciones = document.getElementById('editRecomendaciones').value;
            const IA_Prediccion = document.getElementById('editIA_Prediccion').value;
            const Fecha_Informe = document.getElementById('editFecha_Informe').value;
            try {
                const res = await fetch(`/api/informes/${idInforme}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        Diagnostico,
                        Recomendaciones,
                        IA_Prediccion,
                        Fecha_Informe
                    })
                });
                const resp = await res.json();
                if (resp.success) {
                    mostrarMsg('Informe actualizado correctamente.', 'success');
                    modal.hide();
                    cargarInformes();
                } else {
                    mostrarMsg(resp.error || 'Error al actualizar informe.', 'error');
                }
            } catch (err) {
                mostrarMsg('Error de conexión al actualizar informe.', 'error');
            }
        };
        modal.show();
    });
}

// Eliminar informe (con confirmación)
async function eliminarInforme(idInforme, btn) {
    if (!confirm("¿Estás seguro de que deseas eliminar este informe?")) return;
    try {
        const res = await fetch(`/api/informes/${idInforme}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
        });
        const resp = await res.json();
        if (resp.success) {
            mostrarMsg('Informe eliminado correctamente.', 'success');
            cargarInformes();
        } else {
            mostrarMsg(resp.error || 'Error al eliminar informe.', 'error');
        }
    } catch (err) {
        mostrarMsg('Error de conexión al eliminar informe.', 'error');
    }
}

// --- IA ---
// Agregar select para modelos IA
const IA_MODELS = {
    general: {
        name: "Torax",
        url: "https://teachablemachine.withgoogle.com/models/YhRdippWD/"
    },
    fracturas: {
        name: "General",
        url: "https://teachablemachine.withgoogle.com/models/kDI2V89NO/"
    }
};
let iaModel, iaMaxPredictions, iaLabelContainer, iaCurrentModelKey = "general";

// Reglas de mensajes sugeridos según modelo / clase / probabilidad.
// Ajusta los nombres de clases a los que realmente devuelve tu modelo (puedes verlos en las tarjetas que genera la IA).
const IA_DIAGNOSTIC_RULES = {
    // Modelo de tórax (key: general)
    general: {
        "Normal": [
            { min: 0.85, msg: "Radiografía de tórax sin hallazgos agudos evidentes. Parénquima pulmonar y estructuras óseas dentro de parámetros normales." },
            { min: 0.65, msg: "Hallazgos predominantemente dentro de límites normales. Continuar controles clínicos habituales." },
            { min: 0.00, msg: "Sin alteraciones radiográficas relevantes. Correlacionar con la clínica si persisten síntomas." }
        ],
        "Neumonia": [
            { min: 0.85, msg: "Alta probabilidad de consolidaciones/infiltrados compatibles con proceso infeccioso (neumonía). Recomendable correlación clínico-laboratorial." },
            { min: 0.65, msg: "Infiltrados sugestivos de proceso inflamatorio/infeccioso incipiente. Recomendar seguimiento radiográfico y clínico." },
            { min: 0.00, msg: "Opacidades leves no concluyentes. Sugerir vigilancia clínica." }
        ],
        "Tuberculosis": [
            { min: 0.85, msg: "Patrón radiográfico que podría ser compatible con proceso tuberculoso. Reforzar estudio con baciloscopía / pruebas específicas." },
            { min: 0.65, msg: "Alteraciones que podrían corresponder a proceso infeccioso crónico. Recomendar evaluación especializada." },
            { min: 0.00, msg: "Sin signos radiográficos concluyentes de tuberculosis activa." }
        ],
        "COVID_19": [
            { min: 0.85, msg: "Patrón compatible con infección viral (posible COVID-19). Correlacionar con resultados de pruebas diagnósticas." },
            { min: 0.65, msg: "Cambios intersticiales sutiles sugerentes de proceso viral. Recomendar seguimiento clínico y pruebas adicionales." },
            { min: 0.00, msg: "Sin hallazgos radiográficos concluyentes de proceso viral específico." }
        ]
    },
    // Modelo de fracturas (key: fracturas)
    fracturas: {
        "fracturadas": [
            { min: 0.85, msg: "Alta probabilidad de trazo de fractura. Sugerir confirmación con proyecciones adicionales y/o TC según criterio clínico." },
            { min: 0.60, msg: "Hallazgos sugestivos de posible línea de fractura incipiente. Recomendar nueva imagen o control evolutivo." },
            { min: 0.00, msg: "Sospecha leve no concluyente. Correlacionar con examen físico y dolor localizado." }
        ],
        "no-fracturadas": [
            { min: 0.80, msg: "No se evidencian signos radiográficos de fractura aguda." },
            { min: 0.60, msg: "Sin indicios claros de fractura. Recomendar observación clínica si persiste la sintomatología." },
            { min: 0.00, msg: "No se aprecian alteraciones óseas significativas. Valorar si requiere otros estudios según evolución." }
        ]
    }
};

function obtenerMensajeDiagnostico(modelKey, className, prob) {
    const reglasModelo = IA_DIAGNOSTIC_RULES[modelKey];
    if (reglasModelo && reglasModelo[className]) {
        const reglas = reglasModelo[className];
        // Busca la regla con min más alta que cumpla prob >= min
        const regla = reglas.find(r => prob >= r.min);
        if (regla) return regla.msg;
    }
    // Fallback genérico si no hay reglas definidas
    if (prob >= 0.85) return `Alta probabilidad de ${className}. Correlacionar con hallazgos clínicos.`;
    if (prob >= 0.60) return `Probables signos compatibles con ${className}. Considerar seguimiento.`;
    return `No hay evidencia concluyente de ${className}. Continuar observación clínica.`;
}

// Calcula severidad clínica relativa para asignar color.
// Regla: si la clase es claramente patológica (Neumonia, Tuberculosis, COVID_19, fracturadas) y prob alta => rojo.
// Prob media para esas clases => amarillo. Prob baja o clase "Normal" / "no-fracturadas" => verde.
// Si la clase es Normal pero prob < 0.60 y existe alguna otra clase patológica por encima de 0.30 se marca amarillo.
function calcularSeveridad(modelKey, className, prob) {
    // Normalizamos para cubrir acentos/diacríticos, guiones, espacios, underscores y mayúsculas.
    // Ej: "Neumonía" -> "neumonia", "COVID-19" -> "covid19".
    const normalizado = className
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // quita tildes/diacríticos
        .replace(/[\s_-]+/g, ''); // "COVID_19" / "COVID-19" -> "covid19"

    // Patrones considerados patológicos
    const patronesPatologicos = [
        'neumonia',
        'neumon',
        'tuberculosis',
        'covid19',
        'covid',
        'fracturadas',
        'fracturada',
        'fractura'
    ];
    const esPatologica = patronesPatologicos.some(p => normalizado.includes(p));

    // Reglas de severidad:
    // Patológica: >=0.85 rojo, >=0.60 amarillo, <0.60 verde
    // No patológica (Normal / no-fracturadas / similar): siempre verde (baja)
    if (esPatologica) {
        if (prob >= 0.85) return 'ia-severity-alta';
        if (prob >= 0.60) return 'ia-severity-media';
        return 'ia-severity-baja';
    }
    return 'ia-severity-baja';
}

function mostrarDiagnosticoSugerido(className, prob, modelKey) {
    let cont = document.getElementById('ia-diagnostico-sugerido');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'ia-diagnostico-sugerido';
        cont.style.marginTop = '10px';
        iaLabelContainer.appendChild(cont);
    }
    const mensaje = obtenerMensajeDiagnostico(modelKey, className, prob);
    const porcentaje = (prob * 100).toFixed(1);
    const sevClass = calcularSeveridad(modelKey, className, prob);
    cont.innerHTML = `
        <div class="ia-suggest-box ${sevClass}" data-severity="${sevClass}">
            <strong>Sugerencia IA (Diagnóstico)</strong>
            <em>${className}</em> (${porcentaje}%)<br>
            <span>${mensaje}</span><br>
            <button type="button" id="btn-aplicar-diagnostico" class="btn btn-sm btn-outline-primary mt-2">Aplicar al diagnóstico</button>
        </div>`;
    const btnAplicar = cont.querySelector('#btn-aplicar-diagnostico');
    btnAplicar.onclick = () => {
        const txt = document.getElementById('Diagnostico');
        // Si está vacío, lo llenamos; si ya tiene texto, agregamos una línea separada
        if (!txt.value.trim()) {
            txt.value = mensaje + `\n(IA: ${className} ${porcentaje}%)`;
        } else {
            txt.value += `\n\n${mensaje}\n(IA: ${className} ${porcentaje}%)`;
        }
        txt.focus();
    };
}

// --- Reglas de RECOMENDACIONES según modelo / clase / probabilidad ---
const IA_RECOMMENDATION_RULES = {
    general: {
        "Normal": [
            { min: 0.85, msg: "Continuar controles clínicos rutinarios. No se requieren estudios adicionales salvo criterio clínico." },
            { min: 0.65, msg: "Vigilar evolución de síntomas. Repetir imagen solo si hay empeoramiento clínico." },
            { min: 0.00, msg: "Observación clínica. Indicar retorno si aparecen nuevos signos respiratorios." }
        ],
        "Neumonia": [
            { min: 0.85, msg: "Correlacionar con laboratorio. Considerar inicio/ajuste de antibióticos según guías y control radiográfico en 7-10 días si persisten síntomas." },
            { min: 0.65, msg: "Seguimiento clínico estrecho. Reforzar hidratación y control de temperatura. Revaluar imagen si no mejora." },
            { min: 0.00, msg: "Monitorizar. Solicitar pruebas adicionales si la clínica se intensifica." }
        ],
        "Tuberculosis": [
            { min: 0.85, msg: "Derivar a programa de tuberculosis. Solicitar baciloscopía / PCR y aplicar medidas de aislamiento según normativa local." },
            { min: 0.65, msg: "Ampliar estudio con pruebas específicas (baciloscopía / IGRA). Evaluar factores de riesgo y sintomatología." },
            { min: 0.00, msg: "Si persiste sospecha clínica, completar estudio con pruebas específicas. Vigilar evolución." }
        ],
        "COVID_19": [
            { min: 0.85, msg: "Recomendar prueba confirmatoria (PCR/antígeno), aislamiento y monitorización de saturación O2. Indicar signos de alarma." },
            { min: 0.65, msg: "Correlacionar con clínica y pruebas. Reforzar medidas preventivas y seguimiento de síntomas." },
            { min: 0.00, msg: "No se descarta clínicamente. Considerar test diagnóstico si la clínica lo sugiere." }
        ]
    },
    fracturas: {
        "fracturadas": [
            { min: 0.85, msg: "Inmovilización inicial. Evaluación por traumatología. Considerar proyecciones adicionales o TC según dolor y localización." },
            { min: 0.60, msg: "Repetir radiografía o solicitar proyección adicional si persiste dolor localizado. Reposo relativo." },
            { min: 0.00, msg: "Control clínico y reevaluación si el dolor focal persiste o aumenta." }
        ],
        "no-fracturadas": [
            { min: 0.80, msg: "Manejo conservador (analgesia, reposo relativo). Retorno progresivo a actividad según tolerancia." },
            { min: 0.60, msg: "Observar evolución. Indicar medidas de protección y reevaluar si no mejora en 5-7 días." },
            { min: 0.00, msg: "No se requieren estudios adicionales inmediatos. Seguimiento clínico según síntomas." }
        ]
    }
};

function obtenerRecomendacion(modelKey, className, prob) {
    const reglasModelo = IA_RECOMMENDATION_RULES[modelKey];
    if (reglasModelo && reglasModelo[className]) {
        const reglas = reglasModelo[className];
        const regla = reglas.find(r => prob >= r.min);
        if (regla) return regla.msg;
    }
    if (prob >= 0.85) return `Recomendación: actuar según protocolo clínico para ${className} y confirmar con pruebas complementarias.`;
    if (prob >= 0.60) return `Recomendación: seguimiento clínico activo ante posible ${className}.`;
    return `Recomendación: observación y reevaluación si los síntomas cambian (sospecha de ${className} no concluyente).`;
}

function mostrarRecomendacionSugerida(className, prob, modelKey) {
    let cont = document.getElementById('ia-recomendacion-sugerida');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'ia-recomendacion-sugerida';
        cont.style.marginTop = '10px';
        iaLabelContainer.appendChild(cont);
    }
    const mensaje = obtenerRecomendacion(modelKey, className, prob);
    const porcentaje = (prob * 100).toFixed(1);
    const sevClass = calcularSeveridad(modelKey, className, prob);
    cont.innerHTML = `
        <div class="ia-suggest-box ${sevClass}" data-severity="${sevClass}">
            <strong>Recomendación IA</strong>
            <em>${className}</em> (${porcentaje}%)<br>
            <span>${mensaje}</span><br>
            <button type="button" id="btn-aplicar-recomendacion" class="btn btn-sm btn-outline-success mt-2">Aplicar a recomendaciones</button>
        </div>`;
    const btnAplicar = cont.querySelector('#btn-aplicar-recomendacion');
    btnAplicar.onclick = () => {
        const txt = document.getElementById('Recomendaciones');
        if (!txt.value.trim()) {
            txt.value = mensaje + `\n(IA: ${className} ${porcentaje}%)`;
        } else {
            txt.value += `\n\n${mensaje}\n(IA: ${className} ${porcentaje}%)`;
        }
        txt.focus();
    };
}

// Insertar select de modelos IA en el DOM
(function insertarSelectModelosIA() {
    const contenedor = document.getElementById("ia-label-container");
    if (!contenedor) return;
    const select = document.createElement("select");
    select.id = "ia-model-select";
    select.className = "form-select mb-2";
    for (const key in IA_MODELS) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = IA_MODELS[key].name;
        select.appendChild(opt);
    }
    contenedor.parentNode.insertBefore(select, contenedor);
    select.onchange = async function() {
        iaCurrentModelKey = select.value;
        // Esperar a que el modelo se cargue y el contenedor se inicialice
        await iaInit();
        // iaInit ya reconstruye el contenedor, solo limpiamos el input de predicción
        const iaPred = document.getElementById("IA_Prediccion");
        if (iaPred) iaPred.value = "";
    };
})();

const btnAnalizarIA = document.getElementById("analizar-ia");
btnAnalizarIA.disabled = true;

async function iaInit() {
    try {
        if (typeof tmImage === "undefined") {
            notify("No se ha cargado la librería Teachable Machine.", { type: 'warning' });
            return;
        }
        const modelURL = IA_MODELS[iaCurrentModelKey].url + "model.json";
        const metadataURL = IA_MODELS[iaCurrentModelKey].url + "metadata.json";
        iaModel = await tmImage.load(modelURL, metadataURL);
        iaMaxPredictions = iaModel.getTotalClasses();
        iaLabelContainer = document.getElementById("ia-label-container");
        iaLabelContainer.innerHTML = "";
        const iaTitle = document.createElement("div");
        iaTitle.className = "ia-result-title";
        iaTitle.innerHTML = `<strong>Resultados de la IA (${IA_MODELS[iaCurrentModelKey].name})</strong>`;
        iaLabelContainer.appendChild(iaTitle);
        const iaCards = document.createElement("div");
        iaCards.className = "ia-prediction-cards";
        iaLabelContainer.appendChild(iaCards);
        for (let i = 0; i < iaMaxPredictions; i++) {
            const card = document.createElement("div");
            card.className = "ia-prediction-card";
            iaCards.appendChild(card);
        }
        btnAnalizarIA.disabled = false;
    } catch (e) {
        iaLabelContainer = document.getElementById("ia-label-container");
        iaLabelContainer.innerHTML = "<div style='color:red'>Error cargando el modelo IA.</div>";
        btnAnalizarIA.disabled = true;
    }
}

async function iaPredictImage(imageElement) {
    if (!iaModel) {
        iaLabelContainer.innerHTML = "<div style='color:red'>El modelo IA no está listo. Espera unos segundos y vuelve a intentarlo.</div>";
        return;
    }
    const prediction = await iaModel.predict(imageElement);
    const best = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
    const iaCards = iaLabelContainer.querySelector(".ia-prediction-cards");
    iaCards.innerHTML = "";
    prediction.forEach(pred => {
        const card = document.createElement("div");
        card.className = "ia-prediction-card";
        if (pred.className === best.className) card.classList.add("ia-prediction-best");
        card.innerHTML = `
            <span class="ia-class">${pred.className}</span>
            <span class="ia-prob">${(pred.probability*100).toFixed(1)}%</span>
        `;
        iaCards.appendChild(card);
    });
    document.getElementById('IA_Prediccion').value = best.className + " (" + (best.probability*100).toFixed(1) + "%) [" + IA_MODELS[iaCurrentModelKey].name + "]";
    // Mostrar sugerencia diagnóstica
    mostrarDiagnosticoSugerido(best.className, best.probability, iaCurrentModelKey);
    // Mostrar recomendación sugerida
    mostrarRecomendacionSugerida(best.className, best.probability, iaCurrentModelKey);
    // Insertar disclaimer si no existe
    if (!document.getElementById('ia-disclaimer')) {
        const disc = document.createElement('div');
        disc.id = 'ia-disclaimer';
        disc.innerHTML = 'Aviso: Las sugerencias de IA son apoyo complementario y no reemplazan el juicio clínico profesional. Deben validarse con la historia clínica, examen físico y pruebas complementarias antes de emitir un informe definitivo.';
        iaLabelContainer.appendChild(disc);
    }
}

btnAnalizarIA.addEventListener("click", async function() {
    if (!iaModel) {
        iaLabelContainer.innerHTML = "<div style='color:red'>El modelo IA no está listo. Espera unos segundos y vuelve a intentarlo.</div>";
        return;
    }
    // Modificado: usar imagen de archivo o de cámara
    let file = inputImagen.files[0];
    if (!file && imagenCapturadaBlob) {
        // Convertir blob a objeto URL temporal para crear Image
        const url = URL.createObjectURL(imagenCapturadaBlob);
        const img = new Image();
        img.src = url;
        img.width = 200;
        img.height = 200;
        img.onload = function() {
            iaPredictImage(img);
            URL.revokeObjectURL(url);
        };
        return;
    }
    if (!file) {
        iaLabelContainer.innerHTML = "<div style='color:red'>Selecciona una imagen primero.</div>";
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.width = 200;
        img.height = 200;
        img.onload = function() {
            iaPredictImage(img);
        };
    };
    reader.readAsDataURL(file);
});

// Inicializar
window.addEventListener('DOMContentLoaded', () => {
    cargarCitas();
    cargarInformes();
    // Inicializar fecha a hoy
    const fechaInput = document.getElementById('Fecha_Informe');
    if (fechaInput) {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        fechaInput.value = `${yyyy}-${mm}-${dd}`;
    }
});
