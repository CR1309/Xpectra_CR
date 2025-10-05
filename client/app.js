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
    const registerCorreoInput = document.getElementById('registerCorreo');
    const registerNombreInput = document.getElementById('registerNombre');
    const registerContrasenaInput = document.getElementById('registerContrasena');
    let correoCheckTimer = null;
    const registerCard = document.getElementById('registerCard');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const misInformesBtn = document.getElementById('misInformesBtn');
    const misInformesModal = document.getElementById('misInformesModal');
    const loginCorreoInput = document.getElementById('loginCorreo');
    const loginSubmitBtn = loginForm?.querySelector('button[type="submit"]');
    const loginHint = document.getElementById('loginHint');
    let loginStatusTimer = null;
    let loginStatusBackoffUntil = 0;

    let token = localStorage.getItem('token') || null;
    let user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;

    // Políticas de UI (deben reflejar las del backend)
    const POLICY_RESCHEDULE_MIN_HOURS = 4; // mismo valor que en el servidor por defecto
    const POLICY_CANCEL_MIN_HOURS = 6;     // mismo valor que en el servidor por defecto

    const topBarBtns = document.getElementById('topBarBtns');

    // Zona horaria local (El Salvador) = UTC-6, sin DST
    const TZ_OFFSET_MINUTES = -360;
    function toUtcMsFromLocal(fechaISO, horaHHmm) {
        const [y,m,d] = (fechaISO||'').split('-').map(Number);
        const [hh,mm] = (horaHHmm||'').split(':').map(Number);
        const naiveUtc = Date.UTC(y, (m-1), d, hh, mm, 0, 0);
        return naiveUtc - (TZ_OFFSET_MINUTES * 60 * 1000);
    }
    function horasHasta(fechaISO, horaHHmm) {
        try {
            const targetUtcMs = toUtcMsFromLocal(fechaISO, horaHHmm);
            const nowUtcMs = Date.now();
            return (targetUtcMs - nowUtcMs) / (1000*60*60);
        } catch { return Infinity; }
    }

    function mostrarLogin(mostrar) {
        loginCard.style.display = mostrar ? '' : 'none';
        citaCard.style.display = mostrar ? 'none' : '';
    // Mantén el header visible; solo oculta botones dependientes de sesión
    mostrarBarraDerecha(false);
        if (document.getElementById('leftBarBtns')) {
            document.getElementById('leftBarBtns').style.display = 'none';
        }
        // Oculta el botón de informes cuando no hay sesión
        if (misInformesBtn) misInformesBtn.style.display = 'none';
    }

    // Autocompletar formulario de cita con datos del perfil
    async function autocompletarCitaConPerfil() {
        if (!token || !user) return;
        try {
            const res = await fetch(`/api/usuarios/${user.ID_Usuario}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) {
                const data = await res.json();
                console.error('Error al obtener perfil:', res.status, data.error || 'Error desconocido');
                return;
            }
            const perfil = await res.json();
            if (!perfil || Object.keys(perfil).length === 0) return;
            document.getElementById('Nombre').value = perfil.Nombre_Usuario || '';
            // Solo autocompleta el correo, los demás campos se dejan vacíos
            document.getElementById('Correo_Electronico').value = perfil.Correo || '';
            // Los siguientes campos no existen en el perfil de usuario y deben dejarse vacíos
            document.getElementById('Apellido').value = '';
            document.getElementById('Fecha_Nacimiento').value = '';
            document.getElementById('Sexo').value = '';
            document.getElementById('Direccion').value = '';
            document.getElementById('Telefono').value = '';
        } catch (error) {
            console.error('Error de conexión al autocompletar perfil:', error);
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
            select.selectedIndex = 0;
        } catch (e) {
        }
    }

    // --- Mostrar informes propios del usuario ---
    async function mostrarMisInformes() {
        // Refresca user y token desde localStorage para asegurar que estén actualizados
        let token = localStorage.getItem('token') || null;
        let user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
        if (!token || !user) return;
        const contenedor = document.getElementById('misInformesCont');
        if (!contenedor) return;
        contenedor.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
        try {
            // Usa endpoint correcto según el rol
            const endpoint = user.Rol === 'admin' ? '/api/informes' : '/api/informes/mios';
            const res = await fetch(endpoint, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) {
                const data = await res.json();
                const msg = data.error || 'No se pudieron cargar tus informes.';
                contenedor.innerHTML = `<div class="text-danger">${msg}</div>`;
                return;
            }
            const informes = await res.json();
            if (!Array.isArray(informes) || informes.length === 0) {
                contenedor.innerHTML = `<div class="text-muted text-center py-4">No tienes informes registrados aún.</div>`;
                return;
            }

            // --- Filtros y búsqueda ---
            let html = `
            <div class="row mb-3">
                <div class="col-md-4 mb-2">
                    <input type="text" class="form-control" id="filtroInforme" placeholder="Buscar por paciente, diagnóstico, categoría...">
                </div>
                <div class="col-md-3 mb-2">
                    <input type="date" class="form-control" id="filtroFechaDesde" placeholder="Desde">
                </div>
                <div class="col-md-3 mb-2">
                    <input type="date" class="form-control" id="filtroFechaHasta" placeholder="Hasta">
                </div>
                <div class="col-md-2 mb-2 text-end">
                    <button class="btn btn-outline-secondary btn-sm" id="exportarInformesBtn"><i class="bi bi-file-earmark-pdf"></i> Exportar PDF</button>
                </div>
            </div>
            <div class="table-responsive">
            <table class="table table-bordered table-hover align-middle" id="tablaMisInformes">
                <thead class="table-light">
                    <tr>
                        <th>#</th>
                        <th>Paciente</th>
                        <th>Fecha cita</th>
                        <th>Hora</th>
                        <th>Categoría</th>
                        <th>Diagnóstico</th>
                        <th>Fecha informe</th>
                        <th>Imagen</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
            `;

            informes.forEach((inf, idx) => {
                html += `
                    <tr data-index="${idx}">
                        <td>${inf.ID_Informe}</td>
                        <td>${inf.Paciente_Nombre || ''} ${inf.Paciente_Apellido || ''}</td>
                        <td>${inf.Fecha_Cita || ''}</td>
                        <td>${inf.Hora_Cita || ''}</td>
                        <td>${inf.Nombre_Categoria || ''}</td>
                        <td>
                            <span class="d-inline-block text-truncate" style="max-width:120px;" title="${inf.Diagnostico || ''}">
                                ${inf.Diagnostico ? inf.Diagnostico.substring(0, 60) + (inf.Diagnostico.length > 60 ? '…' : '') : ''}
                            </span>
                        </td>
                        <td>${inf.Fecha_Informe || ''}</td>
                        <td>
                            ${inf.ID_Informe && inf.Imagen_URL 
                                ? `<a href="/api/informes/${inf.ID_Informe}/descargar" target="_blank" title="Descargar imagen"><i class="bi bi-download"></i></a>
                                   <button class="btn btn-link p-0 ms-2 ver-img-btn" data-img="${encodeURIComponent(inf.Imagen_URL)}" title="Ver imagen"><i class="bi bi-eye"></i></button>`
                                : '<span class="text-muted">Sin imagen</span>'}
                        </td>
                        <td>
                            <button class="btn btn-link p-0 detalles-btn" data-detalles="${idx}" title="Ver detalles"><i class="bi bi-chevron-down"></i></button>
                        </td>
                    </tr>
                    <tr class="detalles-row" style="display:none;background:#f9f9fc;">
                        <td colspan="9">
                            <div class="row">
                                <div class="col-md-6 mb-2">
                                    <b>Diagnóstico completo:</b><br>
                                    <span class="text-dark">${inf.Diagnostico || '<i>Sin diagnóstico</i>'}</span>
                                </div>
                                <div class="col-md-6 mb-2">
                                    <b>Recomendaciones:</b><br>
                                    <span class="text-dark">${inf.Recomendaciones || '<i>Sin recomendaciones</i>'}</span>
                                </div>
                                <div class="col-md-6 mb-2">
                                    <b>Predicción IA:</b><br>
                                    <span class="text-dark">${inf.IA_Prediccion || '<i>No disponible</i>'}</span>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
            contenedor.innerHTML = html;

            const normalizar = txt => (txt || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const tbody = contenedor.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr')).filter((_,i) => i%2===0); // solo filas principales

            function aplicarFiltros() {
                const filtro = normalizar(document.getElementById('filtroInforme').value);
                const desde = document.getElementById('filtroFechaDesde').value;
                const hasta = document.getElementById('filtroFechaHasta').value;
                rows.forEach((tr, idx) => {
                    const inf = informes[idx];
                    let visible = true;
                    if (filtro) {
                        const campos = [
                            inf.Paciente_Nombre, inf.Paciente_Apellido, inf.Diagnostico, inf.Nombre_Categoria, inf.Recomendaciones, inf.IA_Prediccion
                        ].map(normalizar).join(' ');
                        if (!campos.includes(filtro)) visible = false;
                    }
                    if (desde && inf.Fecha_Informe && inf.Fecha_Informe < desde) visible = false;
                    if (hasta && inf.Fecha_Informe && inf.Fecha_Informe > hasta) visible = false;
                    tr.style.display = visible ? '' : 'none';
                    // Oculta también la fila de detalles
                    const detallesRow = tr.nextElementSibling;
                    if (detallesRow) detallesRow.style.display = 'none';
                });
            }
            document.getElementById('filtroInforme').addEventListener('input', aplicarFiltros);
            document.getElementById('filtroFechaDesde').addEventListener('change', aplicarFiltros);
            document.getElementById('filtroFechaHasta').addEventListener('change', aplicarFiltros);

            // --- Detalles expandibles ---
            contenedor.querySelectorAll('.detalles-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = Number(btn.getAttribute('data-detalles'));
                    const tr = rows[idx];
                    const detallesRow = tr.nextElementSibling;
                    if (detallesRow.style.display === 'none') {
                        detallesRow.style.display = '';
                        btn.innerHTML = '<i class="bi bi-chevron-up"></i>';
                    } else {
                        detallesRow.style.display = 'none';
                        btn.innerHTML = '<i class="bi bi-chevron-down"></i>';
                    }
                });
            });

            // --- Ver imagen en modal ---
            contenedor.querySelectorAll('.ver-img-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const imgUrl = decodeURIComponent(btn.getAttribute('data-img'));
                    const modalHtml = `
                        <div class="modal fade" id="imgModal" tabindex="-1" aria-labelledby="imgModalLabel" aria-hidden="true">
                            <div class="modal-dialog modal-dialog-centered modal-lg">
                                <div class="modal-content ios-glass">
                                    <div class="modal-header">
                                        <h5 class="modal-title" id="imgModalLabel">Imagen de radiografía</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                                    </div>
                                    <div class="modal-body text-center">
                                        <img src="${imgUrl}" alt="Radiografía" style="max-width:100%;max-height:70vh;border-radius:12px;box-shadow:0 2px 8px #b5fff633;">
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    let modalDiv = document.getElementById('imgModal');
                    if (modalDiv) modalDiv.remove();
                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                    new bootstrap.Modal(document.getElementById('imgModal')).show();
                });
            });

            // --- Exportar a PDF ---
            document.getElementById('exportarInformesBtn').addEventListener('click', function() {
                // Evitar duplicar selector
                const existente = document.getElementById('selectorExportarInformes');
                if (existente) existente.remove();

                // UI mejorada – opciones avanzadas
                const total = informes.length;
                const selectorHtml = `
                                <div id="selectorExportarInformes" class="export-panel">
                                    <div class="row g-2 align-items-end">
                                        <div class="col-12 col-md-3">
                                            <label class="form-label mb-1">Alcance</label>
                                            <select class="form-select form-select-sm" id="cantidadExportarInformes" aria-label="Seleccionar alcance exportación">
                        <option value="visibles">Visibles</option>
                        <option value="todos">Todos (${total})</option>
                        <option value="rango">Rango...</option>
                      </select>
                    </div>
                    <div class="col-6 col-md-2 d-none" id="colDesde">
                      <label class="form-label mb-1">Desde #</label>
                      <input type="number" min="1" max="${total}" id="rangoDesde" class="form-control form-control-sm" placeholder="1">
                    </div>
                    <div class="col-6 col-md-2 d-none" id="colHasta">
                      <label class="form-label mb-1">Hasta #</label>
                      <input type="number" min="1" max="${total}" id="rangoHasta" class="form-control form-control-sm" placeholder="${total}">
                    </div>
                                        <div class="col-12 col-md-3">
                                            <label class="form-label mb-1">Formato</label>
                                            <select class="form-select form-select-sm" id="formatoExportarInformes" aria-label="Seleccionar formato exportación">
                        <option value="tabla">Tabla resumida</option>
                        <option value="detalle">Detalle individual</option>
                      </select>
                    </div>
                                        <div class="col-12 col-md-2">
                                            <button class="btn btn-primary btn-sm w-100" id="confirmarExportarInformes" aria-label="Generar exportación PDF"><i class="bi bi-filetype-pdf"></i> Exportar</button>
                    </div>
                  </div>
                                    <div class="export-actions">
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="checkbox" id="chkIncluirIA" checked>
                      <label class="form-check-label" for="chkIncluirIA">IA</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="checkbox" id="chkIncluirRecomendaciones" checked>
                      <label class="form-check-label" for="chkIncluirRecomendaciones">Recomendaciones</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="checkbox" id="chkIncluirCategoria" checked>
                      <label class="form-check-label" for="chkIncluirCategoria">Categoría</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="checkbox" id="chkIncluirFechas" checked>
                      <label class="form-check-label" for="chkIncluirFechas">Fechas</label>
                    </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input" type="checkbox" id="chkIncluirImagen">
                                            <label class="form-check-label" for="chkIncluirImagen">Imágenes</label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input" type="checkbox" id="chkPortada" checked>
                                            <label class="form-check-label" for="chkPortada">Portada</label>
                                        </div>
                                    </div>
                                    <div class="mt-2 row g-2 align-items-end">
                                        <div class="col-12 col-md-4">
                                            <label for="txtWatermark" class="form-label mb-1" style="font-size:.7rem;letter-spacing:.05em;">Texto Watermark</label>
                                            <input type="text" id="txtWatermark" class="form-control form-control-sm" placeholder="(vacío = sin marca)" maxlength="32" value="CONFIDENCIAL">
                                        </div>
                                        <div class="col-6 col-md-4">
                                            <label for="selWatermarkSize" class="form-label mb-1" style="font-size:.7rem;letter-spacing:.05em;">Tamaño</label>
                                            <select id="selWatermarkSize" class="form-select form-select-sm">
                                                <option value="small">Pequeño</option>
                                                <option value="medium" selected>Medio</option>
                                                <option value="large">Grande</option>
                                            </select>
                                        </div>
                                        <div class="col-6 col-md-4">
                                            <label for="rngWatermarkOpacity" class="form-label mb-1 d-flex justify-content-between" style="font-size:.7rem;letter-spacing:.05em;">Opacidad <span id="wmOpacityVal" style="font-variant-numeric:tabular-nums;">0.04</span></label>
                                            <input type="range" id="rngWatermarkOpacity" class="form-range" min="0" max="0.15" step="0.01" value="0.04">
                                        </div>
                                        <div class="col-6 col-md-4">
                                            <label for="inpWatermarkColor" class="form-label mb-1" style="font-size:.7rem;letter-spacing:.05em;">Color</label>
                                            <input type="color" id="inpWatermarkColor" class="form-control form-control-color form-control-sm" value="#000000" title="Color watermark">
                                        </div>
                                        <div class="col-6 col-md-4 d-flex align-items-end">
                                            <button class="btn btn-outline-secondary btn-sm w-100" id="btnResetWatermark" type="button">Restablecer</button>
                                        </div>
                                    </div>
                </div>`;
                contenedor.insertAdjacentHTML('afterbegin', selectorHtml);

                // Cargar configuración previa de watermark si existe
                try {
                    const cfg = JSON.parse(localStorage.getItem('exportWatermarkConfig')||'{}');
                    if (cfg.text !== undefined) document.getElementById('txtWatermark').value = cfg.text;
                    if (cfg.size) document.getElementById('selWatermarkSize').value = cfg.size;
                    if (cfg.opacity !== undefined) {
                        document.getElementById('rngWatermarkOpacity').value = cfg.opacity;
                        const span = document.getElementById('wmOpacityVal');
                        if (span) span.textContent = Number(cfg.opacity).toFixed(2);
                    }
                    if (cfg.color) document.getElementById('inpWatermarkColor').value = cfg.color;
                } catch(_e){}

                // Mostrar valor dinámico de opacidad
                const rngOp = document.getElementById('rngWatermarkOpacity');
                rngOp.addEventListener('input', ()=>{
                    const span = document.getElementById('wmOpacityVal');
                    if (span) span.textContent = Number(rngOp.value).toFixed(2);
                });

                // Botón reset watermark
                document.getElementById('btnResetWatermark').addEventListener('click', ()=>{
                    localStorage.removeItem('exportWatermarkConfig');
                    document.getElementById('txtWatermark').value = 'CONFIDENCIAL';
                    document.getElementById('selWatermarkSize').value = 'medium';
                    document.getElementById('rngWatermarkOpacity').value = '0.04';
                    document.getElementById('wmOpacityVal').textContent = '0.04';
                    document.getElementById('inpWatermarkColor').value = '#000000';
                });

                const cantidadSelect = document.getElementById('cantidadExportarInformes');
                const colDesde = document.getElementById('colDesde');
                const colHasta = document.getElementById('colHasta');
                cantidadSelect.addEventListener('change', () => {
                    const mostrar = cantidadSelect.value === 'rango';
                    colDesde.classList.toggle('d-none', !mostrar);
                    colHasta.classList.toggle('d-none', !mostrar);
                });

                document.getElementById('confirmarExportarInformes').addEventListener('click', () => {
                    const formato = document.getElementById('formatoExportarInformes').value;
                    const incIA = document.getElementById('chkIncluirIA').checked;
                    const incRec = document.getElementById('chkIncluirRecomendaciones').checked;
                    const incCat = document.getElementById('chkIncluirCategoria').checked;
                    const incFechas = document.getElementById('chkIncluirFechas').checked;
                    const incImg = document.getElementById('chkIncluirImagen').checked;
                    const incPortada = document.getElementById('chkPortada').checked;
                    const watermarkTextRaw = (document.getElementById('txtWatermark')?.value || '').trim();
                    const watermarkText = watermarkTextRaw.substring(0,32).replace(/[<>]/g,'');
                    const wmSizeKey = document.getElementById('selWatermarkSize').value;
                    const wmSizeMap = { small:80, medium:120, large:160 };
                    const wmSize = wmSizeMap[wmSizeKey] || 120;
                    const wmOpacity = parseFloat(document.getElementById('rngWatermarkOpacity').value) || 0.04;
                    const wmColorHexRaw = (document.getElementById('inpWatermarkColor').value || '#000000').trim();
                    const wmColorHex = /^#?[0-9a-fA-F]{6}$/.test(wmColorHexRaw) ? (wmColorHexRaw.startsWith('#')? wmColorHexRaw : '#'+wmColorHexRaw) : '#000000';
                    function hexToRgb(h){const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return {r,g,b};}
                    const {r:wmR,g:wmG,b:wmB} = hexToRgb(wmColorHex);
                    localStorage.setItem('exportWatermarkConfig', JSON.stringify({ text: watermarkText, size: wmSizeKey, opacity: wmOpacity, color: wmColorHex }));

                    let filasExportar;
                    if (cantidadSelect.value === 'todos') {
                        filasExportar = rows;
                    } else if (cantidadSelect.value === 'visibles') {
                        filasExportar = rows.filter(tr => tr.style.display !== 'none');
                    } else {
                        const desde = Number(document.getElementById('rangoDesde').value) - 1;
                        const hasta = Number(document.getElementById('rangoHasta').value) - 1;
                        if (isNaN(desde) || isNaN(hasta) || desde < 0 || hasta < 0 || desde > hasta || hasta >= informes.length) {
                            notify('Rango inválido.', { type: 'warning', icon: 'bi-exclamation-triangle' });
                            return;
                        }
                        filasExportar = rows.slice(desde, hasta + 1);
                    }
                    if (!filasExportar || filasExportar.length === 0) {
                        notify('No hay informes para exportar.', { type: 'warning', icon: 'bi-exclamation-triangle' });
                        return;
                    }
                    // Remover panel
                    const panel = document.getElementById('selectorExportarInformes');
                    if (panel) panel.remove();

                    // Preparar ventana
                    const fechaExport = new Date();
                    const win = window.open('', '', 'width=1400,height=1000');
                    const cssBase = `
                        body { font-family: 'Segoe UI', Arial, sans-serif; margin:34px 40px 40px; color:#222; background:#fff; position:relative; }
                        h1 { text-align:center; font-size:2.15em; margin:0 0 4px 0; letter-spacing:.5px; font-weight:700; }
                        h2 { font-size:1.2em; margin:28px 0 10px; font-weight:600; letter-spacing:.5px; }
                        .sub { text-align:center; font-size:.85em; color:#555; margin:0 0 26px; }
                        .doc-header { display:flex; align-items:center; gap:18px; border-bottom:2px solid #e0e4ea; padding-bottom:10px; margin-bottom:28px; }
                        .doc-header img { max-height:70px; }
                        .conf-banner { margin-left:auto; background:#4b505e; color:#fff; font-size:.55rem; padding:6px 12px; border-radius:6px; letter-spacing:.15em; font-weight:600; }
                        .watermark { position:fixed; top:40%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); font-size:120px; color:rgba(0,0,0,0.04); font-weight:700; pointer-events:none; z-index:0; text-transform:uppercase; }
                        .page-footer { position:fixed; bottom:6px; right:14px; font-size:.55rem; color:#555; z-index:1000; font-style:italic; }
                        .page-footer::after { content:'Página ' counter(page) ' de ' counter(pages); }
                        .summary-table { border-collapse:collapse; width:100%; font-size:.75em; margin:10px 0 24px; }
                        .summary-table th, .summary-table td { border:1px solid #d0d5dd; padding:6px 8px; }
                        .summary-table th { background:#f5f7fa; text-transform:uppercase; font-size:.6rem; letter-spacing:.05em; }
                        table { border-collapse:collapse; width:100%; font-size:0.78em; margin-bottom:30px; }
                        th,td { border:1px solid #d0d5dd; padding:6px 8px; vertical-align:top; }
                        th { background:#f5f7fa; font-weight:600; text-transform:uppercase; font-size:.63rem; letter-spacing:.06em; }
                        tr:nth-child(even) td { background:#fafbfc; }
                        .badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.55rem; font-weight:600; letter-spacing:.05em; }
                        .badge-danger { background:#ffe5e5; color:#b10000; }
                        .badge-warning { background:#fff5d9; color:#7a5a00; }
                        .badge-success { background:#e5f9ed; color:#0c6f3c; }
                        .card-detalle { border:1px solid #d0d5dd; border-radius:16px; padding:20px 22px 18px; margin-bottom:26px; box-shadow:0 4px 14px -4px rgba(0,0,0,0.08); position:relative; z-index:1; }
                        .card-detalle:not(:first-of-type) { page-break-before:always; }
                        .header-table { margin-top:10px; }
                        .footer { text-align:right; margin-top:40px; font-size:.65rem; color:#555; font-style:italic; }
                        .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px 14px; margin-top:6px; }
                        .kv { font-size:.65rem; color:#555; font-weight:600; letter-spacing:.04em; }
                        .kv span { display:block; font-size:.78rem; color:#111; font-weight:600; margin-top:2px; }
                        hr.sep { border:none; border-top:1px solid #eceff2; margin:14px 0 16px; }
                        .titulo-detalle { font-size:1.05em; font-weight:600; margin:0 0 2px 0; letter-spacing:.5px; }
                        .texto { white-space:pre-wrap; font-size:.68rem; line-height:1.35; }
                        .img-wrapper { margin-top:14px; text-align:center; }
                        .img-wrapper img { max-width:360px; max-height:260px; border:1px solid #d0d5dd; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
                        .confidential-note { font-size:.55rem; line-height:1.25; background:#fff5d9; border:1px solid #e0c574; padding:8px 10px; border-radius:8px; margin-top:10px; }
                        .legal { font-size:.55rem; line-height:1.3; opacity:.75; margin-top:24px; text-align:justify; }
                        .toc { font-size:.7rem; margin:20px 0 32px; }
                        .toc h2 { margin:0 0 8px; font-size:.8rem; }
                        .toc ul { list-style:none; padding:0; margin:0; columns:2; }
                        .toc li { margin:2px 0; }
                        @media print { body { margin:10mm; } .card-detalle { page-break-inside:avoid; } .watermark { color:rgba(0,0,0,0.05); } }
                    `;

                    // Funciones auxiliares
                    function clasificarSeveridad(diagnostico) {
                        if (!diagnostico) return { badge:'<span class="badge badge-success">NORMAL</span>', nivel: 'normal'};
                        const texto = diagnostico.toLowerCase();
                        if (/(covid|tubercul|neumon)/.test(texto)) return { badge:'<span class="badge badge-danger">ALERTA ALTA</span>', nivel:'alta'};
                        if (/(fractur)/.test(texto)) return { badge:'<span class="badge badge-danger">ALERTA ALTA</span>', nivel:'alta'};
                        if (/(posible|sospecha|infiltrad|incipiente)/.test(texto)) return { badge:'<span class="badge badge-warning">OBSERVACIÓN</span>', nivel:'media'};
                        return { badge:'<span class="badge badge-success">NORMAL</span>', nivel:'normal'};
                    }

                    // Construcción del documento
                    win.document.write('<html><head><title>Exportación de Informes</title><meta charset="utf-8"/><style>'+cssBase+'</style></head><body>');
                    const currentUser = (function(){try{return JSON.parse(localStorage.getItem('user')||'null');}catch(_e){return null;}})();
                    const userMeta = currentUser ? ` · Usuario: ${currentUser.Nombre_Usuario || ''} (${currentUser.Rol||''})` : '';
                    if (incPortada) {
                        if (watermarkText) {
                            win.document.write(`<div class=\"watermark\" style=\"font-size:${wmSize}px;color:rgba(${wmR},${wmG},${wmB},${wmOpacity});\">${watermarkText}</div>`);
                        }
                        win.document.write(`<div class="doc-header"><img src="img/p1.jpg" alt="Logo" onerror="this.outerHTML='<div style=&quot;font-size:1.1rem;font-weight:700;letter-spacing:.08em;&quot;>LOGO</div>'" /><div class="conf-banner">CONTENIDO PRIVADO</div></div>`);
                        win.document.write('<h1>Informe Clínico Consolidado</h1>');
                        win.document.write(`<div class=\"sub\">Generado: ${fechaExport.toLocaleString('es-ES')} · Registros: ${filasExportar.length}${userMeta}</div>`);
                        if (formato==='detalle' && filasExportar.length>3) {
                            win.document.write('<div class="toc"><h2>Índice</h2><ul>');
                            filasExportar.forEach(tr=>{const idx=Number(tr.getAttribute('data-index'));const inf=informes[idx];win.document.write(`<li>Informe #${inf.ID_Informe||''} - ${(inf.Paciente_Nombre||'')} ${(inf.Paciente_Apellido||'')}</li>`);});
                            win.document.write('</ul></div>');
                        }
                        win.document.write('<div class="confidential-note">Documento sujeto a confidencialidad. Su distribución o copia no autorizada está prohibida.</div>');
                        win.document.write('<div class="legal">La información aquí contenida está protegida por normativa de privacidad de datos. Cualquier interpretación clínica requiere validación profesional. Accesos indebidos serán registrados.</div>');
                        win.document.write('<div style="page-break-after:always;"></div>');
                    } else {
                        if (watermarkText) {
                            win.document.write(`<div class=\"watermark\" style=\"font-size:${wmSize}px;color:rgba(${wmR},${wmG},${wmB},${wmOpacity});\">${watermarkText}</div>`);
                        }
                        win.document.write('<h1>Informe Clínico Consolidado</h1>');
                        win.document.write(`<div class=\"sub\">Generado: ${fechaExport.toLocaleString('es-ES')} · Registros: ${filasExportar.length}${userMeta}</div>`);
                    }

                    if (formato === 'resumen') {
                        // Generar sólo resumen estadístico y opcionalmente breakdown por categoría
                        const datos = filasExportar.map(tr=>{const idx=Number(tr.getAttribute('data-index'));return informes[idx];});
                        let alta=0,media=0,normal=0; const cats={};
                        datos.forEach(inf=>{ const sev = clasificarSeveridad(inf.Diagnostico); if(sev.nivel==='alta') alta++; else if(sev.nivel==='media') media++; else normal++; if(inf.Nombre_Categoria){ cats[inf.Nombre_Categoria]=(cats[inf.Nombre_Categoria]||0)+1; } });
                        win.document.write('<h2>Resumen General</h2>');
                        win.document.write('<table class="summary-table"><thead><tr><th>Total</th><th>Alta</th><th>Observación</th><th>Normal</th></tr></thead><tbody>');
                        win.document.write(`<tr><td>${datos.length}</td><td>${alta}</td><td>${media}</td><td>${normal}</td></tr></tbody></table>`);
                        if (incCat && Object.keys(cats).length){
                            win.document.write('<h2>Distribución por Categoría</h2><table class="summary-table"><thead><tr><th>Categoría</th><th>Cantidad</th></tr></thead><tbody>');
                            Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([c,v])=>{win.document.write(`<tr><td>${c}</td><td>${v}</td></tr>`);});
                            win.document.write('</tbody></table>');
                        }
                    } else if (formato === 'tabla') {
                        win.document.write('<table class="header-table"><thead><tr>');
                        win.document.write('<th>#</th><th>Paciente</th>');
                        if (incCat) win.document.write('<th>Cat.</th>');
                        if (incFechas) win.document.write('<th>Fecha Cita</th><th>Hora</th><th>Fecha Inf.</th>');
                        win.document.write('<th>Diagnóstico</th>');
                        if (incIA) win.document.write('<th>IA</th>');
                        if (incRec) win.document.write('<th>Recomendaciones</th>');
                        win.document.write('</tr></thead><tbody>');
                        filasExportar.forEach(tr => {
                            const idx = Number(tr.getAttribute('data-index'));
                            const inf = informes[idx];
                            const sev = clasificarSeveridad(inf.Diagnostico);
                            win.document.write('<tr>');
                            win.document.write('<td>'+ (inf.ID_Informe||'') +'</td>');
                            win.document.write('<td>'+ (inf.Paciente_Nombre||'') +' '+ (inf.Paciente_Apellido||'') +'<br>'+ sev.badge +'</td>');
                            if (incCat) win.document.write('<td>'+ (inf.Nombre_Categoria||'') +'</td>');
                            if (incFechas) win.document.write('<td>'+ (inf.Fecha_Cita||'') +'</td><td>'+ (inf.Hora_Cita||'') +'</td><td>'+ (inf.Fecha_Informe||'') +'</td>');
                            win.document.write('<td>'+ (inf.Diagnostico||'').replace(/\n/g,'<br>') +'</td>');
                            if (incIA) win.document.write('<td>'+ (inf.IA_Prediccion||'') +'</td>');
                            if (incRec) win.document.write('<td>'+ (inf.Recomendaciones||'').replace(/\n/g,'<br>') +'</td>');
                            win.document.write('</tr>');
                        });
                        win.document.write('</tbody></table>');
                    } else {
                        // Detalle individual
                        filasExportar.forEach(tr => {
                            const idx = Number(tr.getAttribute('data-index'));
                            const inf = informes[idx];
                            const sev = clasificarSeveridad(inf.Diagnostico);
                            win.document.write('<div class="card-detalle">');
                            win.document.write(`<div class="titulo-detalle">Informe #${inf.ID_Informe || ''} ${sev.badge}</div>`);
                            win.document.write('<div class="grid">');
                            win.document.write(`<div class="kv">Paciente<span>${(inf.Paciente_Nombre||'') + ' ' + (inf.Paciente_Apellido||'')}</span></div>`);
                            if (incCat) win.document.write(`<div class="kv">Categoría<span>${inf.Nombre_Categoria||''}</span></div>`);
                            if (incFechas) {
                                win.document.write(`<div class="kv">Fecha Cita<span>${inf.Fecha_Cita||''}</span></div>`);
                                win.document.write(`<div class="kv">Hora Cita<span>${inf.Hora_Cita||''}</span></div>`);
                                win.document.write(`<div class="kv">Fecha Informe<span>${inf.Fecha_Informe||''}</span></div>`);
                            }
                            if (incIA) win.document.write(`<div class="kv">Predicción IA<span>${inf.IA_Prediccion||''}</span></div>`);
                            win.document.write('</div>'); // grid
                            win.document.write('<hr class="sep" />');
                            win.document.write('<div class="kv" style="margin-bottom:6px;">Diagnóstico</div>');
                            win.document.write('<div class="texto">'+ (inf.Diagnostico||'').replace(/\n/g,'<br>') +'</div>');
                            if (incRec) {
                                win.document.write('<div class="kv" style="margin:12px 0 6px;">Recomendaciones</div>');
                                win.document.write('<div class="texto">'+ (inf.Recomendaciones||'').replace(/\n/g,'<br>') +'</div>');
                            }
                            if (incImg && inf.Imagen_URL) {
                                win.document.write('<div class="img-wrapper"><img src="'+inf.Imagen_URL+'" alt="Radiografía Informe '+(inf.ID_Informe||'')+'"/></div>');
                            }
                            win.document.write('<div class="confidential-note">Uso interno. Difusión parcial o total sujeta a autorización.</div>');
                            win.document.write('</div>');
                        });
                    }

                    // Resumen final (omitido si formato resumen ya lo mostró)
                    if (formato !== 'resumen') {
                        const resumen = (function() {
                            const tot = filasExportar.length; let alta=0, media=0, normal=0;
                            filasExportar.forEach(tr => { const idx = Number(tr.getAttribute('data-index')); const inf = informes[idx]; const sev = clasificarSeveridad(inf.Diagnostico); if (sev.nivel==='alta') alta++; else if (sev.nivel==='media') media++; else normal++; });
                            return {tot, alta, media, normal};
                        })();
                        win.document.write(`<h2 style=\"font-size:1.2em;margin-top:10px;\">Resumen Estadístico</h2>`);
                        win.document.write(`<table style=\"width:auto;min-width:320px\"><thead><tr><th>Total</th><th>Alta</th><th>Observación</th><th>Normal</th></tr></thead><tbody>`);
                        win.document.write(`<tr><td>${resumen.tot}</td><td>${resumen.alta}</td><td>${resumen.media}</td><td>${resumen.normal}</td></tr>`);
                        win.document.write(`</tbody></table>`);
                    }

                    // Disclaimer
                    win.document.write('<div class="legal">Este documento es una exportación consolidada de informes clínicos. El contenido asistido por IA no sustituye el criterio médico presencial. La reproducción o distribución no autorizada puede constituir infracción legal.</div>');

                    win.document.write(`<div class=\"footer\">Exportado ${fechaExport.toLocaleString('es-ES')}${userMeta}</div>`);
                    win.document.write('<div class="page-footer"></div>');
                    win.document.write('</body></html>');
                    win.document.close();
                    win.focus();
                    win.print();
                });
            });

    } catch (err) {
        contenedor.innerHTML = `<div class="text-danger">Error de conexión al cargar informes.</div>`;
    }
}

    function mostrarApp() {
        mostrarLogin(false);
        cargarCitas();
        setTimeout(autocompletarCitaConPerfil, 200); 
        cargarCategorias();
        if (misInformesBtn) misInformesBtn.style.display = '';
    }

    // Alternar entre login y registro
    showRegisterBtn.addEventListener('click', () => {
        loginCard.style.display = 'none';
        registerCard.style.display = '';
    // Mantén el header visible; solo oculta botones dependientes de sesión
    mostrarBarraDerecha(false);
        if (document.getElementById('leftBarBtns')) {
            document.getElementById('leftBarBtns').style.display = 'none';
        }
        // Oculta el botón de informes en registro
        if (misInformesBtn) misInformesBtn.style.display = 'none';
    });
    showLoginBtn.addEventListener('click', () => {
        registerCard.style.display = 'none';
        loginCard.style.display = '';
    // Mantén el header visible; solo oculta botones dependientes de sesión
    mostrarBarraDerecha(false);
        if (document.getElementById('leftBarBtns')) {
            document.getElementById('leftBarBtns').style.display = 'none';
        }
        // Oculta el botón de informes en login
        if (misInformesBtn) misInformesBtn.style.display = 'none';
    });

    // Evento para abrir el modal de Mis Informes
    if (misInformesBtn && misInformesModal) {
        misInformesBtn.addEventListener('click', () => {
            // Refresca user y token antes de mostrar el modal
            token = localStorage.getItem('token') || null;
            user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
            new bootstrap.Modal(misInformesModal).show();
        });
        misInformesModal.addEventListener('shown.bs.modal', () => {
            mostrarMisInformes();
        });
    }

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
        notify(msg, { type: 'danger', autoHideMs: 4000, icon: 'bi-exclamation-octagon' });
    }

    // UI: Toast Bootstrap para feedback general
    function mostrarToast(mensaje, tipo = 'success', autoHideMs = 2500) {
        // Crear contenedor si no existe
        let cont = document.getElementById('toastContainer');
        if (!cont) {
            cont = document.createElement('div');
            cont.id = 'toastContainer';
            cont.className = 'toast-container position-fixed top-0 end-0 p-3';
            cont.style.zIndex = 2000;
            document.body.appendChild(cont);
        }
        const bg = tipo === 'success' ? 'bg-success' : tipo === 'warning' ? 'bg-warning text-dark' : 'bg-danger';
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-white border-0 ${bg}`;
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${mensaje}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
            </div>`;
        cont.appendChild(toastEl);
        const bsToast = new bootstrap.Toast(toastEl, { delay: autoHideMs });
        bsToast.show();
        // Retirar del DOM al ocultarse
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        return bsToast;
    }

    // UI: Panel de sugerencias de disponibilidad (estética iOS/neo)
    function mostrarSugerenciasPanel({ fechaSolicitada, horaSolicitada, suggestions }) {
        const prev = document.getElementById('panelSugerencias');
        if (prev) prev.remove();
        const panel = document.createElement('div');
        panel.id = 'panelSugerencias';
        panel.className = 'ios-glass soft-gradient-border sugerencias-panel';
        const listaBtns = (Array.isArray(suggestions) ? suggestions : []).map((s, i) => {
            const label = `${s.fecha} ${s.hora}`;
            return `<button type="button" class="ios-btn secondary sug-btn me-2 mb-2" data-aplicar-sug="${i}"><i class="bi bi-calendar-check"></i> <span>${label}</span></button>`;
        }).join('');
        panel.innerHTML = `
            <div class="sug-wrap">
                <div class="sug-title"><i class="bi bi-exclamation-triangle"></i> Horario ocupado: <b>${fechaSolicitada} ${horaSolicitada}</b></div>
                <div class="sug-sub">Elige una de estas opciones disponibles:</div>
                <div class="sug-buttons">${listaBtns || '<span class="text-muted">Sin sugerencias disponibles.</span>'}</div>
                <div class="sug-footer">
                    <small>Puedes seleccionar otra hora manualmente si prefieres.</small>
                    <button type="button" class="ios-btn secondary sug-close" data-cerrar-panel>Ocultar</button>
                </div>
            </div>`;
        const target = document.querySelector('#citaCard .card-body') || document.getElementById('citaCard') || document.body;
        target.insertBefore(panel, target.firstChild);
        panel.querySelectorAll('[data-aplicar-sug]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-aplicar-sug'));
                const s = suggestions[idx];
                if (!s) return;
                const f = document.getElementById('Fecha_Cita');
                const h = document.getElementById('Hora_Cita');
                if (f) f.value = s.fecha;
                if (h) h.value = s.hora;
                mostrarToast(`Aplicado: ${s.fecha} ${s.hora}`, 'success', 1800);
            });
        });
        panel.querySelector('[data-cerrar-panel]')?.addEventListener('click', () => panel.remove());
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
                // Mensajes enriquecidos con conteo y tiempos de bloqueo
                if (res.status === 401 && (typeof data.remainingAttempts !== 'undefined')) {
                    const attempts = Number(data.remainingAttempts);
                    const nextMin = Number(data.nextLockMinutes || 1);
                    mostrarMensajeError(`${data.error || 'Credenciales inválidas.'} Intentos restantes: ${attempts}. Próximo bloqueo temporal: ${nextMin} min.`);
                } else if (res.status === 429) {
                    const secs = Number(data.secondsLeft || 0);
                    const m = Math.floor(secs/60), s = secs % 60;
                    const human = m > 0 ? `${m}m ${s}s` : `${s}s`;
                    mostrarMensajeError(`${data.error || 'Cuenta bloqueada temporalmente.'} Tiempo restante: ${human}.`);
                } else {
                    // Muestra el mensaje de error específico del backend
                    mostrarMensajeError(data.error || 'Error de autenticación');
                }
            }
        } catch {
            mostrarMensajeError('Error de conexión');
        } finally {
            mostrarSpinner(false);
        }
    });

    // Consulta de estado de bloqueo por correo para UX (contador y deshabilitar botón)
    async function checkLoginStatus() {
        if (!loginCorreoInput || !loginSubmitBtn) return;
        const correo = (loginCorreoInput.value || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = 'Entrar';
            if (loginHint) loginHint.textContent = '';
            return;
        }
        // Evita consultas si está en backoff por 429
        if (Date.now() < loginStatusBackoffUntil) return;
        try {
            const res = await fetch(`/api/login/status?correo=${encodeURIComponent(correo)}`);
            const data = await res.json().catch(()=>({}));
            if (res.status === 429) {
                // Si el servidor rate-limitea, aplica backoff dinámico
                const retryAfter = Number(res.headers.get('Retry-After') || 5);
                loginStatusBackoffUntil = Date.now() + retryAfter*1000;
                return;
            }
            if (data.locked) {
                const secs = Number(data.secondsLeft || 0);
                loginSubmitBtn.disabled = true;
                const label = secs > 0 ? `Bloqueado ${Math.floor(secs/60)}m ${secs%60}s` : 'Bloqueado';
                loginSubmitBtn.textContent = label;
                if (loginHint) loginHint.textContent = '';
            } else {
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.textContent = 'Entrar';
                if (loginHint && typeof data.remainingAttempts !== 'undefined') {
                    const attempts = Number(data.remainingAttempts);
                    const nextMin = Number(data.nextLockMinutes || 1);
                    loginHint.textContent = `Intentos restantes: ${attempts}. Próximo bloqueo: ${nextMin} min.`;
                }
            }
        } catch {
            // Silencioso: no bloquear interacción por fallo de consulta
        }
    }
    if (loginCorreoInput) {
        loginCorreoInput.addEventListener('input', checkLoginStatus);
        // Temporizador que refresca cada 2 segundos
        loginStatusTimer = setInterval(checkLoginStatus, 2000);
    }

    // Registro
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Solo pide datos de usuario, no personales
        const Nombre_Usuario = registerNombreInput.value.trim();
        const Correo = registerCorreoInput.value.trim();
        const Contrasena = registerContrasenaInput.value;
        if (!Nombre_Usuario || !Correo || !Contrasena) {
            mostrarMensajeError('Todos los campos son obligatorios.');
            return;
        }
        if (Contrasena.length < 6) {
            mostrarMensajeError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (Nombre_Usuario.length < 3) {
            mostrarMensajeError('El nombre de usuario debe tener al menos 3 caracteres.');
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(Correo)) {
            mostrarMensajeError('Correo inválido.');
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
                notify('Registro exitoso. Ahora puedes iniciar sesión.', { type: 'success', autoHideMs: 3000, icon: 'bi-check-circle' });
                registerCard.style.display = 'none';
                loginCard.style.display = '';
                // Oculta los botones superiores tras registro
                if (topBarBtns) topBarBtns.classList.add('d-none');
                mostrarBarraDerecha(false);
                if (document.getElementById('leftBarBtns')) {
                    document.getElementById('leftBarBtns').style.display = 'none';
                }
            } else {
                if (res.status === 400) {
                    // Mensajes más claros
                    const reason = (data.details && Array.isArray(data.details) && data.details[0]?.msg) ? data.details[0].msg : data.error;
                    mostrarMensajeError(reason || 'Datos inválidos en el registro.');
                } else {
                    mostrarMensajeError(data.error || 'Error en el registro');
                }
            }
        } catch {
            mostrarMensajeError('Error de conexión');
        } finally {
            mostrarSpinner(false);
        }
    });

    // Validación en vivo: correo disponible
    async function checkCorreoDisponible() {
        if (!registerCorreoInput) return;
        const correo = registerCorreoInput.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(correo)) return; // espera formato válido
        try {
            const res = await fetch(`/api/usuarios/disponible?correo=${encodeURIComponent(correo)}`);
            const data = await res.json().catch(()=>({}));
            if (data && data.available === false) {
                notify('Ese correo ya está registrado.', { type: 'warning', autoHideMs: 2000, icon: 'bi-exclamation-triangle' });
            }
        } catch {}
    }
    if (registerCorreoInput) {
        registerCorreoInput.addEventListener('input', () => {
            clearTimeout(correoCheckTimer);
            correoCheckTimer = setTimeout(checkCorreoDisponible, 500);
        });
    }

    // Logout
    logoutBtn.addEventListener('click', () => {
        token = null;
        user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    mostrarBarraDerecha(false); // Oculta botones dependientes de sesión al cerrar
        // Oculta también barra izquierda
        const leftBar = document.getElementById('leftBarBtns');
        if (leftBar) leftBar.style.display = 'none';
        // Oculta botones de "Citas" y "Usuarios"
        const citasTabBtn = document.getElementById('citasTabBtn');
        const usuariosTabBtn = document.getElementById('usuariosTabBtn');
        if (citasTabBtn) citasTabBtn.style.display = 'none';
        if (usuariosTabBtn) usuariosTabBtn.style.display = 'none';
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
        const ID_Categoria = document.getElementById('Categoria_Estudio') ? Number(document.getElementById('Categoria_Estudio').value) : '';

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
            // Compara fecha local (UTC-6)
            const hoyLocalMs = toUtcMsFromLocal((() => {
                const nowUtc = Date.now();
                const nowLocal = new Date(nowUtc + TZ_OFFSET_MINUTES * 60 * 1000);
                const y = nowLocal.getUTCFullYear();
                const m = String(nowLocal.getUTCMonth()+1).padStart(2,'0');
                const d = String(nowLocal.getUTCDate()).padStart(2,'0');
                return `${y}-${m}-${d}`;
            })(), '00:00');
            const fechaMs = toUtcMsFromLocal(fecha, '00:00');
            return fechaMs >= hoyLocalMs;
        }
        if (!validarFecha(Fecha_Cita)) {
            mostrarMensajeError('La fecha de la cita no puede ser anterior a hoy');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        mostrarSpinner(true);

        // 1) Comprobar disponibilidad antes de enviar
        try {
            const dispRes = await fetch(`/api/disponibilidad?fecha=${encodeURIComponent(Fecha_Cita)}&hora=${encodeURIComponent(Hora_Cita)}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (dispRes.ok) {
                const disp = await dispRes.json();
                if (!disp.available) {
                    mostrarSpinner(false);
                    const sug = Array.isArray(disp.suggestions) ? disp.suggestions : [];
                    mostrarSugerenciasPanel({ fechaSolicitada: Fecha_Cita, horaSolicitada: Hora_Cita, suggestions: sug });
                    if (submitBtn) submitBtn.disabled = false;
                    return;
                }
            }
        } catch(_e) {
            // Si falla la comprobación, sigue el flujo normal
        }
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
            ID_Categoria
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
                // Feedback visual de éxito
                mostrarToast('Cita agendada con éxito', 'success', 1800);
                form.reset();
                // Recarga suave tras breve delay
                setTimeout(() => window.location.reload(), 600);
            } else if (response.status === 409) {
                // Conflicto por ocupación, mostrar sugerencias del backend
                const data = await response.json().catch(()=>({}));
                const sug = Array.isArray(data.suggestions) ? data.suggestions : [];
                mostrarSugerenciasPanel({ fechaSolicitada: Fecha_Cita, horaSolicitada: Hora_Cita, suggestions: sug });
            } else {
                // Mostrar mensaje de error específico del backend
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
        // Si el modal no existe, créalo dinámicamente
        if (!document.getElementById('editCitaModal')) {
            const modalHtml = `
            <div class="modal fade" id="editCitaModal" tabindex="-1" aria-labelledby="editCitaModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content ios-glass">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editCitaModalLabel">Editar Cita</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editCitaForm">
                                <div class="mb-3">
                                    <label for="editFecha_Cita" class="form-label">Fecha de la cita</label>
                                    <input type="date" class="form-control" id="editFecha_Cita" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editHora_Cita" class="form-label">Hora de la cita</label>
                                    <input type="time" class="form-control" id="editHora_Cita" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editMotivo" class="form-label">Motivo</label>
                                    <input type="text" class="form-control" id="editMotivo">
                                </div>
                                <button type="submit" class="btn btn-primary">Guardar cambios</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        // Inicializa el modal y el formulario
        editModal = new bootstrap.Modal(document.getElementById('editCitaModal'));
        editForm = document.getElementById('editCitaForm');
        // Evita múltiples listeners
        editForm.onsubmit = guardarEdicionCita;
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
            // Precheck: disponibilidad excluyendo esta misma cita
            try {
                const pre = await fetch(`/api/disponibilidad?fecha=${encodeURIComponent(Fecha_Cita)}&hora=${encodeURIComponent(Hora_Cita)}&excluirIdCita=${encodeURIComponent(editCitaId)}`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (pre.ok) {
                    const disp = await pre.json();
                    if (!disp.available) {
                        mostrarSpinner(false);
                        mostrarSugerenciasPanel({ fechaSolicitada: Fecha_Cita, horaSolicitada: Hora_Cita, suggestions: disp.suggestions });
                        return;
                    }
                }
            } catch(_) { /* si falla, seguimos con el PUT */ }
            // Actualiza la cita
            const res = await fetch(`/api/citas/${editCitaId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ Fecha_Cita, Hora_Cita, Motivo })
            });
            const data = await res.json().catch(()=>({}));
            if (!res.ok) {
                if (res.status === 409 && data.suggestions) {
                    mostrarSugerenciasPanel({ fechaSolicitada: Fecha_Cita, horaSolicitada: Hora_Cita, suggestions: data.suggestions });
                } else {
                    mostrarMensajeError(data.error || 'Error al editar la cita');
                }
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
        const isCompleted = (cita.Estado === 'Completada');
        const hrsLeft = horasHasta(cita.Fecha_Cita, cita.Hora_Cita);
        const bloqReagendar = isCompleted || (!esAdmin && hrsLeft < POLICY_RESCHEDULE_MIN_HOURS);
        const bloqCancelar = isCompleted || (!esAdmin && hrsLeft < POLICY_CANCEL_MIN_HOURS);
        const estadoHtml = esAdmin
            ? `<select class="form-select form-select-sm estado-cita-select" data-cita-id="${cita.ID_Cita}" style="width:auto;display:inline-block;">
                    <option value="Pendiente" ${cita.Estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Confirmada" ${cita.Estado === 'Confirmada' ? 'selected' : ''}>Confirmada</option>
                    <option value="Cancelada" ${cita.Estado === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
                    <option value="Completada" ${cita.Estado === 'Completada' ? 'selected' : ''}>Completada</option>
                </select>`
            : (() => { const st=cita.Estado||'Pendiente'; const cls= st==='Completada'?'bg-success': st==='Cancelada'?'bg-danger': st==='Confirmada'?'bg-primary':'bg-secondary'; return `<span class="badge ${cls}">${st}</span>`; })();

        // Asegura que los atributos de los botones sean únicos para cada modo
        const editAttr = modoTab ? 'data-edit-cita-tab' : 'data-edit-cita';
        const deleteAttr = modoTab ? 'data-delete-cita-tab' : 'data-delete-cita';

        // Botones simplificados y responsivos
        return `
        <div class="card mb-3 p-3">
            <div class="d-flex align-items-center mb-2 gap-3 flex-wrap">
                <div class="rounded-circle d-flex align-items-center justify-content-center bg-light" style="width:48px;height:48px;">
                    <i class="bi bi-person-badge fs-3 text-primary"></i>
                </div>
                <div>
                    <div class="fw-bold">${cita.Nombre} ${cita.Apellido}</div>
                    <div class="text-secondary small"><i class="bi bi-envelope"></i> ${cita.Correo_Electronico}</div>
                </div>
                <div class="ms-auto d-flex align-items-center gap-2 flex-wrap">
                    ${estadoHtml}
                    <button class="btn btn-outline-info btn-sm" data-galeria-cita="${cita.ID_Cita}" title="Ver galería"><i class="bi bi-images"></i></button>
                    ${puedeEditar ? `
                        <button class="btn btn-outline-primary btn-sm" ${bloqReagendar ? 'disabled' : ''} ${editAttr}="${cita.ID_Cita}" title="${bloqReagendar ? (isCompleted ? 'No puedes editar una cita completada' : `No puedes reagendar faltando menos de ${POLICY_RESCHEDULE_MIN_HOURS}h`) : 'Editar'}"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-outline-danger btn-sm" ${bloqCancelar ? 'disabled' : ''} ${deleteAttr}="${cita.ID_Cita}" title="${bloqCancelar ? (isCompleted ? 'No puedes cancelar una cita completada' : (esAdmin ? '' : `No puedes cancelar faltando menos de ${POLICY_CANCEL_MIN_HOURS}h`)) : (esAdmin ? 'Eliminar' : 'Cancelar')}"><i class="bi bi-trash"></i></button>
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

    // Sobrescribe cargarCitas para mostrar info de pago/informe (Fuera de uso)
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
                    if (user && user.Rol !== 'admin') {
                        if (!confirm('¿Seguro que deseas cancelar esta cita?')) return;
                        try {
                            const res = await fetch(`/api/citas/${id}/cancel`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });
                            const data = await res.json().catch(()=>({}));
                            if (res.ok) { notify('Cita cancelada.', { type: 'success' }); window.location.reload(); }
                            else { mostrarMensajeError(data.error || 'No se pudo cancelar la cita'); }
                        } catch { mostrarMensajeError('Error de conexión'); }
                    } else {
                        if (!confirm('¿Seguro que deseas eliminar esta cita?')) return;
                        try {
                            const res = await fetch(`/api/citas/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
                            const data = await res.json().catch(()=>({}));
                            if (res.ok) { notify('Cita eliminada correctamente.', { type: 'success' }); window.location.reload(); }
                            else { mostrarMensajeError(data.error || 'No se pudo eliminar la cita'); }
                        } catch { mostrarMensajeError('Error de conexión'); }
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

            // Notificar al usuario sobre citas completadas no notificadas
            notifyCompletedCitas(citas);
        } catch (error) {
            console.error('Error:', error);
            mostrarMensajeError('Error al cargar las citas');
        }
    }

    // Notifica citas completadas nuevas y permite abrir Mis Informes desde la tarjeta
    function notifyCompletedCitas(citas) {
        try {
            if (!Array.isArray(citas) || !user) return;
            const key = `notifiedCompletedCitas_${user.ID_Usuario}`;
            const notified = JSON.parse(localStorage.getItem(key) || '[]');
            const nuevos = citas.filter(c => c.Estado === 'Completada' && !notified.includes(c.ID_Cita));
            if (!nuevos.length) return;
            nuevos.forEach(c => {
                const card = notify(`Tu informe para la cita #${c.ID_Cita} está listo. <button class="ios-btn btn-sm" data-open-informes>Abrir Mis Informes</button>`, { type: 'success', autoHideMs: 8000, icon: 'bi-check-circle' });
                try {
                    const btn = card?.querySelector('[data-open-informes]');
                    if (btn && misInformesModal) {
                        btn.addEventListener('click', () => {
                            new bootstrap.Modal(misInformesModal).show();
                            mostrarMisInformes();
                        });
                    }
                } catch {}
                notified.push(c.ID_Cita);
            });
            // Guardar lista (con límite para no crecer sin fin)
            const MAX = 200;
            const unique = Array.from(new Set(notified)).slice(-MAX);
            localStorage.setItem(key, JSON.stringify(unique));
        } catch {}
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
            galeriaBody.innerHTML = rads.map(r => {
                const fecha = r.Fecha_Realizacion ? r.Fecha_Realizacion.substring(0,10) : '';
                const cat = r.Nombre_Categoria || 'Sin categoría';
                if (r.Imagen_URL) {
                    return `
                    <div class="gal-item">
                        <img class="gal-img" src="${r.Imagen_URL}" alt="Radiografía" data-img="${encodeURIComponent(r.Imagen_URL)}"/>
                        <div class="gal-meta"><div class="gal-cat">${cat}</div><div class="gal-date">${fecha}</div></div>
                    </div>`;
                } else {
                    return `
                    <div class="gal-item">
                        <div class="gal-placeholder"><i class="bi bi-image"></i><span>Sin imagen</span></div>
                        <div class="gal-meta"><div class="gal-cat">${cat}</div><div class="gal-date">${fecha}</div></div>
                    </div>`;
                }
            }).join('');
            // Delegación: click para ver imagen ampliada
            galeriaBody.onclick = (e) => {
                const imgEl = e.target.closest('.gal-img');
                if (!imgEl) return;
                const imgUrl = imgEl.getAttribute('src');
                const modalHtml = `
                        <div class="modal fade" id="imgModal" tabindex="-1" aria-labelledby="imgModalLabel" aria-hidden="true">
                            <div class="modal-dialog modal-dialog-centered modal-lg">
                                <div class="modal-content ios-glass">
                                    <div class="modal-header">
                                        <h5 class="modal-title" id="imgModalLabel">Radiografía</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                                    </div>
                                    <div class="modal-body text-center">
                                        <img src="${imgUrl}" alt="Radiografía" style="max-width:100%;max-height:70vh;border-radius:12px;box-shadow:0 2px 8px #b5fff633;">
                                    </div>
                                </div>
                            </div>
                        </div>`;
                let modalDiv = document.getElementById('imgModal');
                if (modalDiv) modalDiv.remove();
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                new bootstrap.Modal(document.getElementById('imgModal')).show();
            };
        } catch (error) {
            galeriaBody.innerHTML = `<div class="text-danger text-center">Error al cargar la galería.</div>`;
        }
        new bootstrap.Modal(document.getElementById('galeriaModal')).show();
    }

    // Función utilitaria para normalizar texto
    function normalizarTexto(txt) {
        return (txt || '')
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') 
            .replace(/\s+/g, ' ') 
            .trim()
            .toLowerCase();
    }

    // Sobrescribe mostrarCitasEnPestana
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
                        if (user && user.Rol !== 'admin') {
                            if (!confirm('¿Seguro que deseas cancelar esta cita?')) return;
                            try {
                                const res = await fetch(`/api/citas/${id}/cancel`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });
                                const data = await res.json().catch(()=>({}));
                                if (res.ok) { renderCitas(document.getElementById('filtroCitas')?.value || ''); cargarCitas(); }
                                else { mostrarMensajeError(data.error || 'No se pudo cancelar la cita'); }
                            } catch { mostrarMensajeError('Error de conexión'); }
                        } else {
                            if (!confirm('¿Seguro que deseas eliminar esta cita?')) return;
                            try {
                                const res = await fetch(`/api/citas/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
                                const data = await res.json().catch(()=>({}));
                                if (res.ok) { renderCitas(document.getElementById('filtroCitas')?.value || ''); cargarCitas(); }
                                else { mostrarMensajeError(data.error || 'No se pudo eliminar la cita'); }
                            } catch { mostrarMensajeError('Error de conexión'); }
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

    // Crear pestaña/modal para citas programadas
    function crearPestanaCitas() {
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
            btn.className = 'btn btn-outline-secondary left-bar-btn-adapt';
            btn.id = 'citasTabBtn';
            btn.innerHTML = '<i class="bi bi-list-ul"></i> <span class="btn-text">Citas</span>';
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
            btn.className = 'btn btn-outline-secondary left-bar-btn-adapt';
            btn.id = 'usuariosTabBtn';
            btn.innerHTML = '<i class="bi bi-people"></i> <span class="btn-text">Usuarios</span>';
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
            notify('Solo los administradores pueden ver la lista de usuarios.', { type: 'warning', icon: 'bi-exclamation-triangle' });
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
                        u.Nombre_Usuario, u.Correo, /*u.Nombre_Completo,*/ u.Rol /*, u.Telefono, u.Direccion, u.Sexo*/
                    ];
                    return campos.some(val => normalizarTexto(val).includes(filtroNorm));
                });
                document.getElementById('usuariosList').innerHTML = filtroHtml + filtrados.map(u => `
                    <div class="col-12 col-md-6 col-lg-4">
                      <div class="ios-list-item d-flex flex-column align-items-center p-3 h-100">
                        <span class="badge bg-light text-dark mb-2">${u.Rol}</span>
                        <div class="w-100 small text-secondary mb-1"><i class="bi bi-envelope"></i> ${u.Correo}</div>
                        <!--<div class="w-100 small text-secondary mb-1"><i class="bi bi-person"></i> ${u.Nombre_Completo || ''}</div>
                        <div class="w-100 small text-secondary mb-1"><i class="bi bi-telephone"></i> ${u.Telefono || ''}</div>
                        <div class="w-100 small text-secondary mb-1"><i class="bi bi-geo-alt"></i> ${u.Direccion || ''}</div>
                        <div class="w-100 small text-secondary mb-1"><i class="bi bi-calendar"></i> ${u.Fecha_Nacimiento ? u.Fecha_Nacimiento.substring(0,10) : ''}</div>
                        <div class="w-100 small text-secondary mb-2"><i class="bi bi-gender-ambiguous"></i> ${u.Sexo || ''}</div>-->
                        <div class="d-flex gap-2 w-100 justify-content-center">
                            <button class="btn btn-sm ios-btn" data-ver-perfil="${u.ID_Usuario}" title="Ver/Editar"><i class="bi bi-person-lines-fill"></i></button>
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
        document.getElementById('perfilBtn').onclick = () => abrirPerfilModal(user.ID_Usuario);
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
            document.getElementById('perfilCorreo').value = perfil.Correo || '';
            fotoPreview.src = perfil.Foto_Perfil || '/img/XPectra.png';

            // Guardar cambios
            document.getElementById('perfilForm').onsubmit = async function(e) {
                e.preventDefault();
                const datos = {
                    Nombre_Usuario: document.getElementById('perfilNombreUsuario').value,
                    Foto_Perfil: fotoBase64 // solo si se seleccionó una nueva
                };
                if (!datos.Foto_Perfil) delete datos.Foto_Perfil;
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
                notify('Perfil eliminado', { type: 'success' });
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
        let leftBar = document.getElementById('leftBarBtns');
        if (!leftBar) {
            leftBar = document.createElement('div');
            leftBar.id = 'leftBarBtns';
            leftBar.className = 'left-bar-btns d-flex flex-row gap-2 position-fixed p-2';
            leftBar.style = 'z-index:1040;';
            document.body.appendChild(leftBar);
        }
        leftBar.innerHTML = ''; // Limpia los botones

        // Solo mostrar barra si hay sesión iniciada
        if (!token || !user) {
            leftBar.style.display = 'none';
            return;
        }
        leftBar.style.display = '';

        // Botón de Volver a inicio
        if (!leftBar.querySelector('.left-bar-btn')) {
            const volverBtn = document.createElement('a');
            volverBtn.className = 'btn btn-outline-secondary mb-2 left-bar-btn';
            volverBtn.href = '/landing.html';
            volverBtn.setAttribute('aria-label', 'Volver a inicio');
            volverBtn.setAttribute('title', 'Volver a la página principal');
            volverBtn.innerHTML = '<i class="bi bi-arrow-left"></i> <span class="btn-text">Volver a inicio</span>';
            leftBar.appendChild(volverBtn);
        }

        // Botón de Informes (solo admin)
        if (user && user.Rol === 'admin' && !document.getElementById('adminInformesBtnLeft')) {
            const btnInformes = document.createElement('a');
            btnInformes.className = 'btn btn-outline-secondary mb-2';
            btnInformes.href = 'admin_informes.html';
            btnInformes.id = 'adminInformesBtnLeft';
            btnInformes.setAttribute('target', '_blank');
            btnInformes.setAttribute('rel', 'noopener');
            btnInformes.setAttribute('aria-label', 'Abrir informes');
            btnInformes.setAttribute('title', 'Abrir módulo de informes');
            btnInformes.innerHTML = '<i class="bi bi-file-earmark-medical"></i> <span class="btn-text">Informes</span>';
            leftBar.appendChild(btnInformes);
        }

        // Botón de Citas (todos los usuarios autenticados)
        if (!document.getElementById('citasTabBtn')) {
            const btnCitas = document.createElement('button');
            btnCitas.className = 'btn btn-outline-secondary mb-2';
            btnCitas.id = 'citasTabBtn';
            btnCitas.setAttribute('aria-label', 'Citas programadas');
            btnCitas.setAttribute('title', 'Ver citas programadas');
            btnCitas.innerHTML = '<i class="bi bi-list-ul"></i> <span class="btn-text">Citas</span>';
            btnCitas.onclick = () => {
                mostrarCitasEnPestana();
                new bootstrap.Modal(document.getElementById('citasTabModal')).show();
            };
            leftBar.appendChild(btnCitas);
        }
        // Botón de Usuarios (solo admin)
        if (user && user.Rol === 'admin' && !document.getElementById('usuariosTabBtn')) {
            const btnUsuarios = document.createElement('button');
            btnUsuarios.className = 'btn btn-outline-secondary mb-2';
            btnUsuarios.id = 'usuariosTabBtn';
            btnUsuarios.setAttribute('aria-label', 'Usuarios registrados');
            btnUsuarios.setAttribute('title', 'Ver usuarios registrados');
            btnUsuarios.innerHTML = '<i class="bi bi-people"></i> <span class="btn-text">Usuarios</span>';
            btnUsuarios.onclick = () => {
                mostrarUsuarios();
                new bootstrap.Modal(document.getElementById('usuariosTabModal')).show();
            };
            leftBar.appendChild(btnUsuarios);
        }
    }

    // Mostrar/ocultar barra superior derecha (perfil/logout) según sesión
    function mostrarBarraDerecha(visible) {
        if (topBarBtns) {
            if (visible) {
                topBarBtns.classList.remove('d-none');
            } else {
                topBarBtns.classList.add('d-none');
            }
        }
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
        } else {
            const usuariosTabBtn = document.getElementById('usuariosTabBtn');
            if (usuariosTabBtn) usuariosTabBtn.style.display = 'none';
        }
        // Muestra el botón de informes solo si hay sesión
        if (misInformesBtn) misInformesBtn.style.display = '';
    } else {
        // Oculta los botones de sesión si no hay usuario autenticado
        mostrarBarraDerecha(false);
        if (document.getElementById('leftBarBtns')) {
            document.getElementById('leftBarBtns').style.display = 'none';
        }
        mostrarLogin(true);
        // Oculta el botón de informes si no hay sesión
        if (misInformesBtn) misInformesBtn.style.display = 'none';
    }

    // Función para manejar la posición de las barras cuando hay modal abierto en móvil
    function ajustarBarrasConModal(abierto) {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (!isMobile) {
            document.body.classList.remove('modal-open-bar');
            if (topBarBtns) topBarBtns.classList.remove('modal-open-bar');
            const leftBar = document.getElementById('leftBarBtns');
            if (leftBar) leftBar.classList.remove('modal-open-bar');
            return;
        }
        if (abierto) {
            document.body.classList.add('modal-open-bar');
            if (topBarBtns) topBarBtns.classList.add('modal-open-bar');
            const leftBar = document.getElementById('leftBarBtns');
            if (leftBar) leftBar.classList.add('modal-open-bar');
        } else {
            document.body.classList.remove('modal-open-bar');
            if (topBarBtns) topBarBtns.classList.remove('modal-open-bar');
            const leftBar = document.getElementById('leftBarBtns');
            if (leftBar) leftBar.classList.remove('modal-open-bar');
        }
    }

    // Aplica el ajuste al abrir/cerrar cualquier modal principal
    ['editCitaModal', 'misInformesModal', 'perfilModal', 'galeriaModal', 'citasTabModal', 'usuariosTabModal'].forEach(id => {
        const modalEl = document.getElementById(id);
        if (modalEl) {
            modalEl.addEventListener('show.bs.modal', () => ajustarBarrasConModal(true));
            modalEl.addEventListener('hide.bs.modal', () => ajustarBarrasConModal(false));
        }
    });

// === DETECCIÓN AUTOMÁTICA DE MODO OSCURO DEL SISTEMA (respetando preferencia manual) ===
const THEME_KEY = 'xpectra-theme';
function aplicarTemaSistema() {
    // Si el usuario eligió un tema manualmente, no sobrescribir
    if (localStorage.getItem(THEME_KEY)) return;
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
}
// Aplica el tema del sistema solo si no hay preferencia manual
aplicarTemaSistema();
// Escucha cambios del sistema, pero no aplica si existe preferencia manual
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!localStorage.getItem(THEME_KEY)) aplicarTemaSistema();
});

// Eliminar cualquier botón de chatbot que pueda aparecer
function eliminarBotonesChatbot() {
    const botonesChatbot = document.querySelectorAll('.rx-chat-toggle, #rxChatToggle, [id*="chat"], [class*="chat-toggle"], [title*="radiólogo"], [title*="chat"]');
    botonesChatbot.forEach(boton => {
        if (boton) {
            boton.remove();
        }
    });
}

// Ejecutar eliminación de chatbot
eliminarBotonesChatbot();
// También revisar cada segundo por si aparece dinámicamente
setInterval(eliminarBotonesChatbot, 1000);

});