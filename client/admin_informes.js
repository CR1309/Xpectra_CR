const token = localStorage.getItem('token');
let user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
if (!token || !user || user.Rol !== 'admin') {
    document.body.innerHTML = '<p class="error">No autenticado o no eres administrador. Inicia sesión como administrador.</p>';
    throw new Error('No autenticado o no eres administrador');
}

// Cargar citas pendientes
async function cargarCitas() {
    const select = document.getElementById('cita');
    select.innerHTML = '';
    document.getElementById('paciente-info').innerHTML = '';
    document.getElementById('msg').innerHTML = '';
    try {
        const res = await fetch('/api/citas-sin-informe', {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) {
            const data = await res.json();
            document.getElementById('msg').innerHTML = `<span class="error">${data.error || 'Error al cargar citas.'}</span>`;
            return;
        }
        const citas = await res.json();
        if (!Array.isArray(citas) || citas.length === 0) {
            select.innerHTML = '<option value="">No hay citas pendientes</option>';
            document.getElementById('msg').innerHTML = '<span class="success">No hay citas pendientes de informe.</span>';
            return;
        }
        select.innerHTML = '<option value="">Selecciona una cita</option>';
        citas.forEach(c => {
            const opt = document.createElement('option');
            // Incluye más detalles en el value para visualización
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
        document.getElementById('msg').innerHTML = `<span class="error">Error de conexión al cargar citas.</span>`;
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
    // Visualización más rica
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
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        document.getElementById('preview').innerHTML = `<img src="${ev.target.result}" width="200">`;
    };
    reader.readAsDataURL(file);
});

// Enviar formulario
document.getElementById('form-informe').addEventListener('submit', async function(e) {
    e.preventDefault();
    const select = document.getElementById('cita');
    if (!select.value) {
        document.getElementById('msg').innerHTML = `<span class="error">Selecciona una cita.</span>`;
        return;
    }
    const data = JSON.parse(select.value);
    const idRad = data.idRad;

    // 1. Subir imagen
    const imagen = document.getElementById('imagen').files[0];
    if (!imagen) {
        document.getElementById('msg').innerHTML = `<span class="error">Selecciona una imagen para subir.</span>`;
        return;
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
        document.getElementById('msg').innerHTML = `<span class="error">Error de conexión al subir imagen.</span>`;
        return;
    }
    if (!resp.success) {
        document.getElementById('msg').innerHTML = `<span class="error">${resp.error || 'Error al subir imagen.'}</span>`;
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
        document.getElementById('msg').innerHTML = `<span class="error">Error de conexión al guardar informe.</span>`;
        return;
    }
    if (resp.success) {
        document.getElementById('msg').innerHTML = `<span class="success">Informe guardado correctamente.</span>`;
        cargarCitas();
        document.getElementById('form-informe').reset();
        document.getElementById('preview').innerHTML = '';
    } else {
        document.getElementById('msg').innerHTML = `<span class="error">${resp.error || 'Error al guardar informe.'}</span>`;
    }
});

// Mostrar todos los informes existentes
async function cargarInformes() {
    const tbody = document.querySelector('#tabla-informes tbody');
    tbody.innerHTML = '<tr><td colspan="8">Cargando...</td></tr>';
    try {
        const res = await fetch('/api/informes', {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="8">Error al cargar informes.</td></tr>`;
            return;
        }
        const informes = await res.json();
        if (!Array.isArray(informes) || informes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8">No hay informes registrados.</td></tr>`;
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
                <td>${inf.Diagnostico ? inf.Diagnostico.substring(0, 60) + (inf.Diagnostico.length > 60 ? '…' : '') : ''}</td>
                <td>${inf.Fecha_Informe}</td>
                <td>${inf.Imagen_URL ? `<a href="${inf.Imagen_URL}" target="_blank">Ver</a>` : ''}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8">Error de conexión al cargar informes.</td></tr>`;
    }
}

// --- IA: TensorFlow/Teachable Machine ---
const IA_URL = "https://teachablemachine.withgoogle.com/models/YhRdippWD/";
let iaModel, iaMaxPredictions, iaLabelContainer;

// Deshabilitar el botón hasta que el modelo esté listo
const btnAnalizarIA = document.getElementById("analizar-ia");
btnAnalizarIA.disabled = true;

async function iaInit() {
    try {
        if (typeof tmImage === "undefined") {
            alert("No se ha cargado la librería Teachable Machine.");
            return;
        }
        const modelURL = IA_URL + "model.json";
        const metadataURL = IA_URL + "metadata.json";
        iaModel = await tmImage.load(modelURL, metadataURL);
        iaMaxPredictions = iaModel.getTotalClasses();
        iaLabelContainer = document.getElementById("ia-label-container");
        iaLabelContainer.innerHTML = "";
        // Título visual para resultados IA
        const iaTitle = document.createElement("div");
        iaTitle.className = "ia-result-title";
        iaTitle.innerHTML = "<strong>Resultados de la IA</strong>";
        iaLabelContainer.appendChild(iaTitle);
        // Contenedor de tarjetas de predicción
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
    // Encuentra la predicción principal
    const best = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
    // Actualiza las tarjetas visuales
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
    // Autocompletar campo IA_Prediccion con la clase de mayor probabilidad
    document.getElementById('IA_Prediccion').value = best.className + " (" + (best.probability*100).toFixed(1) + "%)";
}

btnAnalizarIA.addEventListener("click", async function() {
    if (!iaModel) {
        iaLabelContainer.innerHTML = "<div style='color:red'>El modelo IA no está listo. Espera unos segundos y vuelve a intentarlo.</div>";
        return;
    }
    const fileInput = document.getElementById("imagen");
    const file = fileInput.files[0];
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

iaInit();

// Inicializar
cargarCitas();
cargarInformes();
document.getElementById('Fecha_Informe').valueAsDate = new Date();
