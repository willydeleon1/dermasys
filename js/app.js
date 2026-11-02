/**
 * ============================================================================
 * DermaSys | Lógica Principal de Aplicación (iPadOS + macOS)
 * Dra. Doris Romero - Medicina Estética y Dermatología
 * M.P.P.S: 131642 | C.M: 13750
 * ============================================================================
 */

let currentPatientId = null;
let currentPrintPatient = null;
let currentPrintSubject = 'Informe Dermo-Estético | DermaSys - Dra. Doris Romero';
let faceCanvas = null;
let faceCtx = null;
let isDrawing = false;
let currentBrushColor = '#7c3aed';
let currentBrushLabel = 'Toxina Botulínica';
let faceStrokes = [];

document.addEventListener('DOMContentLoaded', async () => {
    actualizarIndicadorNube();
    await cargarDashboard();
    initFaceMapCanvas();
});

// ==================== NAVEGACIÓN SPA ====================
async function navegarA(vista, paramId = null) {
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.navbar-derma .nav-link').forEach(el => el.classList.remove('active'));

    const target = document.getElementById('view-' + vista);
    if (target) target.style.display = 'block';

    const navBtn = document.querySelector(`[data-nav="${vista}"]`);
    if (navBtn) navBtn.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (vista === 'dashboard') await cargarDashboard();
    if (vista === 'pacientes') await cargarTablaPacientes();
    if (vista === 'nuevo-paciente') prepararFormularioPaciente(paramId);
    if (vista === 'historia' && paramId) await cargarHistoriaPaciente(paramId);
    if (vista === 'nueva-consulta' && paramId) await prepararNuevaConsulta(paramId);
    if (vista === 'nuevo-egreso' && paramId) await prepararNuevoEgreso(paramId);
    if (vista === 'citas') await cargarAgendaCitas();
    if (vista === 'copiloto-ia') await prepararCopilotoIA(paramId);
}

function actualizarIndicadorNube() {
    const badge = document.getElementById('cloudStatusBadge');
    if (!badge) return;
    if (window.db.isCloud) {
        badge.className = 'badge bg-success text-white px-2 py-1';
        badge.innerHTML = '<i class="fa-solid fa-cloud-check me-1"></i> Supabase Cloud Activo';
    } else {
        badge.className = 'badge bg-warning text-dark px-2 py-1';
        badge.innerHTML = '<i class="fa-solid fa-laptop-medical me-1"></i> Modo Local (Click para conectar Supabase)';
    }
}

// ==================== 1. DASHBOARD ====================
async function cargarDashboard() {
    const [pacientes, consultas, citas, fotos] = await Promise.all([
        db.getAll('pacientes'),
        db.getAll('consultas', 'fecha_consulta', false),
        db.getAll('citas', 'fecha_cita', true),
        db.getAll('fotos_evolutivas')
    ]);

    document.getElementById('statTotalPacientes').innerText = pacientes.length;
    document.getElementById('statTotalConsultas').innerText = consultas.length;
    const citasActivas = citas.filter(c => c.estado !== 'Cancelada' && c.estado !== 'Completada');
    document.getElementById('statCitasPendientes').innerText = citasActivas.length;
    document.getElementById('statFotosEvolutivas').innerText = fotos.length;

    // Tabla de últimas consultas
    const tbody = document.getElementById('dashUltimasConsultas');
    if (consultas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Aún no hay consultas registradas.</td></tr>`;
    } else {
        tbody.innerHTML = consultas.slice(0, 6).map(c => {
            const p = pacientes.find(x => Number(x.id) === Number(c.paciente_id)) || { nombre_apellido: 'Paciente', cedula: '---' };
            return `
                <tr>
                    <td class="small text-muted font-monospace">${formatearFecha(c.fecha_consulta)}</td>
                    <td>
                        <a href="javascript:void(0)" onclick="navegarA('historia', ${p.id})" class="fw-bold text-dark text-decoration-none">${esc(p.nombre_apellido)}</a>
                        <div class="text-muted" style="font-size:0.75rem;">C.I: ${esc(p.cedula)} &bull; Fototipo ${esc(p.fototipo_fitzpatrick || 'III')}</div>
                    </td>
                    <td><span class="badge bg-derma-subtle text-derma border">${esc(c.tipo_consulta)}</span></td>
                    <td class="small text-truncate" style="max-width:240px;">${esc(c.procedimiento_realizado || c.diagnosticos || c.motivo_consulta)}</td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary" onclick="navegarA('historia', ${p.id})" title="Ver Expediente"><i class="fa-solid fa-folder-open"></i></button>
                            <button class="btn btn-outline-derma" onclick="verDocumentoConsulta(${c.id})" title="Imprimir / PDF Receta y Skincare"><i class="fa-solid fa-print"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Próximas citas en el dashboard
    const contCitas = document.getElementById('dashProximasCitas');
    if (citasActivas.length === 0) {
        contCitas.innerHTML = `<div class="text-center py-4 text-muted small">No hay citas pendientes programadas.</div>`;
    } else {
        contCitas.innerHTML = citasActivas.slice(0, 5).map(ct => {
            const p = pacientes.find(x => Number(x.id) === Number(ct.paciente_id)) || { nombre_apellido: 'Paciente', telefono: '' };
            return `
                <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div>
                        <span class="badge bg-light text-dark border font-monospace">${formatearFecha(ct.fecha_cita)} ${ct.hora_cita || ''}</span>
                        <div class="fw-bold small mt-1">${esc(p.nombre_apellido)}</div>
                        <div class="text-muted" style="font-size:0.75rem;">${esc(ct.tipo)}</div>
                    </div>
                    <button class="btn btn-sm btn-derma py-1 px-2" onclick="navegarA('nueva-consulta', ${p.id})">
                        Atender <i class="fa-solid fa-arrow-right ms-1"></i>
                    </button>
                </div>
            `;
        }).join('');
    }
}

// ==================== 2. DIRECTORIO Y REGISTRO DE PACIENTES ====================
async function cargarTablaPacientes() {
    const q = (document.getElementById('buscadorPacientes')?.value || '').toLowerCase().trim();
    const [pacientes, consultas] = await Promise.all([
        db.getAll('pacientes', 'nombre_apellido', true),
        db.getAll('consultas')
    ]);

    const filtrados = pacientes.filter(p =>
        (p.nombre_apellido || '').toLowerCase().includes(q) ||
        (p.cedula || '').toLowerCase().includes(q) ||
        (p.telefono || '').toLowerCase().includes(q)
    );

    const tbody = document.getElementById('tablaPacientesBody');
    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">No se encontraron pacientes registrados.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        const numCons = consultas.filter(c => Number(c.paciente_id) === Number(p.id)).length;
        const esProv = String(p.cedula).startsWith('PROV-');
        return `
            <tr>
                <td class="ps-3">
                    <div class="d-flex align-items-center gap-2">
                        <div style="width:38px;height:38px;border-radius:50%;background:#ede9fe;color:#6d28d9;display:flex;align-items:center;justify-content:center;font-weight:700;">
                            ${esc((p.nombre_apellido || 'P').charAt(0).toUpperCase())}
                        </div>
                        <div>
                            <a href="javascript:void(0)" onclick="navegarA('historia', ${p.id})" class="fw-bold text-dark text-decoration-none">${esc(p.nombre_apellido)}</a>
                            ${p.alergias_bool === 'Sí' ? `<span class="badge bg-danger-subtle text-danger ms-1" style="font-size:0.65rem;">Alergias</span>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    ${esProv ? `<span class="badge bg-warning-subtle text-dark border">Provisional</span>` : `<span class="badge bg-light text-dark border font-monospace">${esc(p.cedula)}</span>`}
                </td>
                <td>
                    <span>${p.edad || '--'} años</span>
                    <div class="text-muted" style="font-size:0.75rem;">${esc(p.sexo)}</div>
                </td>
                <td>
                    <span class="badge bg-derma-subtle text-derma border">Biotipo: ${esc(p.biotipo_cutaneo || 'Mixta')}</span>
                    <span class="badge bg-light text-dark border ms-1">Fitzpatrick ${esc(p.fototipo_fitzpatrick || 'III')}</span>
                </td>
                <td class="small">
                    <i class="fa-brands fa-whatsapp text-success me-1"></i> ${esc(p.telefono || 'N/D')}
                </td>
                <td class="text-end pe-3">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary" onclick="navegarA('historia', ${p.id})"><i class="fa-solid fa-folder-open me-1"></i> Historia (${numCons})</button>
                        <button class="btn btn-derma" onclick="navegarA('nueva-consulta', ${p.id})"><i class="fa-solid fa-wand-magic-sparkles me-1"></i> Consulta</button>
                        <button class="btn btn-outline-secondary" onclick="navegarA('nuevo-paciente', ${p.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function prepararFormularioPaciente(editId = null) {
    const form = document.getElementById('formPaciente');
    form.reset();
    document.getElementById('pac_id_edit').value = editId || '';
    document.getElementById('tituloFormPaciente').innerText = editId ? 'Editar Expediente Dermo-Estético' : 'Registrar Nuevo Paciente';

    if (editId) {
        const pacientes = await db.getAll('pacientes');
        const p = pacientes.find(x => Number(x.id) === Number(editId));
        if (p) {
            document.getElementById('pac_cedula').value = p.cedula || '';
            document.getElementById('pac_nombre').value = p.nombre_apellido || '';
            document.getElementById('pac_edad').value = p.edad || '';
            document.getElementById('pac_sexo').value = p.sexo || 'Femenino';
            document.getElementById('pac_fnac').value = p.fecha_nacimiento || '';
            document.getElementById('pac_telefono').value = p.telefono || '';
            document.getElementById('pac_correo').value = p.correo || '';
            document.getElementById('pac_ocupacion').value = p.ocupacion || '';
            document.getElementById('pac_direccion').value = p.direccion || '';
            document.getElementById('pac_biotipo').value = p.biotipo_cutaneo || 'Mixta';
            document.getElementById('pac_fitzpatrick').value = p.fototipo_fitzpatrick || 'III';
            document.getElementById('pac_glogau').value = p.escala_glogau || 'I - Leve';
            document.getElementById('pac_queloide').value = p.queloide_tendencia || 'No';
            document.getElementById('pac_spf').value = p.usa_protector_solar || 'Diario';
            document.getElementById('pac_alergias_bool').value = p.alergias_bool || 'No';
            document.getElementById('pac_alergias_desc').value = p.alergias_desc || '';
            document.getElementById('pac_ant_personales').value = p.ant_personales || '';
            document.getElementById('pac_ant_derma').value = p.ant_dermatologicos || '';
            document.getElementById('pac_proc_previos').value = p.procedimientos_previos || '';
            document.getElementById('pac_medicacion').value = p.medicacion_actual || '';
        }
    }
}

async function guardarPaciente(e) {
    e.preventDefault();
    const editId = document.getElementById('pac_id_edit').value;
    const cedula = document.getElementById('pac_cedula').value.trim();
    const nombre = document.getElementById('pac_nombre').value.trim();

    if (!cedula || !nombre) {
        Swal.fire('Campos requeridos', 'La Cédula y el Nombre Completo son obligatorios.', 'warning');
        return;
    }

    // Validación anti-duplicidad normalizada (V-123456 == 123456)
    const duplicado = await db.buscarDuplicadoCedula(cedula, editId || 0);
    if (duplicado) {
        Swal.fire({
            title: 'Paciente ya registrado',
            html: `La cédula <strong>${esc(cedula)}</strong> ya pertenece a:<br><strong class="text-derma fs-5">${esc(duplicado.nombre_apellido)}</strong> (C.I: ${esc(duplicado.cedula)})`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#6d28d9',
            confirmButtonText: 'Abrir su Historia Clínica',
            cancelButtonText: 'Corregir Cédula'
        }).then(res => {
            if (res.isConfirmed) navegarA('historia', duplicado.id);
        });
        return;
    }

    const payload = {
        cedula,
        cedula_normalizada: normalizarCedula(cedula),
        nombre_apellido: nombre,
        edad: parseInt(document.getElementById('pac_edad').value) || null,
        sexo: document.getElementById('pac_sexo').value,
        fecha_nacimiento: document.getElementById('pac_fnac').value || null,
        telefono: document.getElementById('pac_telefono').value.trim(),
        correo: document.getElementById('pac_correo').value.trim(),
        ocupacion: document.getElementById('pac_ocupacion').value.trim(),
        direccion: document.getElementById('pac_direccion').value.trim(),
        sede_id: 1,
        biotipo_cutaneo: document.getElementById('pac_biotipo').value,
        fototipo_fitzpatrick: document.getElementById('pac_fitzpatrick').value,
        escala_glogau: document.getElementById('pac_glogau').value,
        queloide_tendencia: document.getElementById('pac_queloide').value,
        usa_protector_solar: document.getElementById('pac_spf').value,
        alergias_bool: document.getElementById('pac_alergias_bool').value,
        alergias_desc: document.getElementById('pac_alergias_desc').value.trim(),
        ant_personales: document.getElementById('pac_ant_personales').value.trim(),
        ant_dermatologicos: document.getElementById('pac_ant_derma').value.trim(),
        procedimientos_previos: document.getElementById('pac_proc_previos').value.trim(),
        medicacion_actual: document.getElementById('pac_medicacion').value.trim()
    };

    try {
        let saved;
        if (editId) {
            saved = await db.update('pacientes', editId, payload);
        } else {
            saved = await db.insert('pacientes', payload);
        }
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Expediente guardado correctamente',
            showConfirmButton: false,
            timer: 2000
        });
        navegarA('historia', saved.id);
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
}

// ==================== 3. HISTORIA CLÍNICA DERMO-ESTÉTICA ====================
async function cargarHistoriaPaciente(pacienteId) {
    currentPatientId = Number(pacienteId);
    const [pacientes, todasConsultas, todasFotos, todosEgresos] = await Promise.all([
        db.getAll('pacientes'),
        db.getAll('consultas', 'fecha_consulta', false),
        db.getAll('fotos_evolutivas', 'fecha_foto', false),
        db.getAll('egresos', 'fecha_egreso', false)
    ]);

    const p = pacientes.find(x => Number(x.id) === currentPatientId);
    if (!p) return navegarA('pacientes');

    const consultas = todasConsultas.filter(c => Number(c.paciente_id) === currentPatientId);
    const fotos = todasFotos.filter(f => Number(f.paciente_id) === currentPatientId);
    const egresos = todosEgresos.filter(e => Number(e.paciente_id) === currentPatientId);

    // Header del paciente
    document.getElementById('histInicial').innerText = (p.nombre_apellido || 'P').charAt(0).toUpperCase();
    document.getElementById('histNombre').innerText = p.nombre_apellido;
    document.getElementById('histDatosSub').innerHTML = `
        <span><strong class="text-white">C.I:</strong> ${esc(p.cedula)}</span> &bull;
        <span><strong class="text-white">Edad:</strong> ${p.edad || '--'} años</span> &bull;
        <span><strong class="text-white">Biotipo:</strong> ${esc(p.biotipo_cutaneo || 'Mixta')}</span> &bull;
        <span><strong class="text-white">Fitzpatrick:</strong> Tipo ${esc(p.fototipo_fitzpatrick || 'III')}</span> &bull;
        <span><strong class="text-white">Glogau:</strong> ${esc(p.escala_glogau || 'I')}</span>
    `;

    // Ficha lateral
    document.getElementById('histFichaLateral').innerHTML = `
        <div class="mb-2"><strong class="text-secondary small d-block">Teléfono / WhatsApp:</strong> <span>${esc(p.telefono || 'No registrado')}</span></div>
        <div class="mb-2"><strong class="text-secondary small d-block">Correo:</strong> <span>${esc(p.correo || 'No registrado')}</span></div>
        <div class="mb-2"><strong class="text-secondary small d-block">Alergias:</strong> <span class="${p.alergias_bool === 'Sí' ? 'text-danger fw-bold' : ''}">${esc(p.alergias_bool)} ${p.alergias_desc ? ' - ' + esc(p.alergias_desc) : ''}</span></div>
        <div class="mb-2"><strong class="text-secondary small d-block">Cicatrización Queloidea:</strong> <span>${esc(p.queloide_tendencia || 'No')}</span></div>
        <div class="mb-2"><strong class="text-secondary small d-block">Uso Protector Solar:</strong> <span>${esc(p.usa_protector_solar || 'Ocasional')}</span></div>
        <hr>
        <div class="mb-2"><strong class="text-secondary small d-block">Antecedentes Dermatológicos:</strong><div class="p-2 bg-light rounded border small">${nl2br(p.ant_dermatologicos || 'Sin antecedentes registrados')}</div></div>
        <div class="mb-2"><strong class="text-secondary small d-block">Procedimientos Estéticos Previos:</strong><div class="p-2 bg-light rounded border small">${nl2br(p.procedimientos_previos || 'Ninguno referido')}</div></div>
        <div class="mb-0"><strong class="text-secondary small d-block">Medicación Actual:</strong><div class="p-2 bg-light rounded border small">${nl2br(p.medicacion_actual || 'Ninguna')}</div></div>
    `;

    // Contadores de pestañas
    document.getElementById('badgeCountConsultas').innerText = consultas.length;
    document.getElementById('badgeCountFotos').innerText = fotos.length;
    document.getElementById('badgeCountEgresos').innerText = egresos.length;

    // Renderizar Timeline de Consultas y Procedimientos
    const contCons = document.getElementById('histListaConsultas');
    if (consultas.length === 0) {
        contCons.innerHTML = `
            <div class="card-derma p-5 text-center text-muted">
                <i class="fa-solid fa-spa fa-3x mb-3 text-derma opacity-50"></i>
                <h5 class="fw-bold text-dark">Sin Consultas ni Procedimientos</h5>
                <p class="small">Inicie la primera evaluación dermatológica o procedimiento estético.</p>
                <div><button class="btn btn-derma" onclick="navegarA('nueva-consulta', ${p.id})"><i class="fa-solid fa-plus me-1"></i> Nueva Consulta / Procedimiento</button></div>
            </div>`;
    } else {
        contCons.innerHTML = consultas.map(c => `
            <div class="card-derma p-4 mb-3">
                <div class="d-flex flex-wrap justify-content-between align-items-center pb-2 mb-3 border-bottom gap-2">
                    <div>
                        <span class="fw-bold fs-6 text-dark"><i class="fa-regular fa-calendar text-derma me-1"></i> ${formatearFecha(c.fecha_consulta)}</span>
                        <span class="badge bg-derma ms-2">${esc(c.tipo_consulta)}</span>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-derma" onclick="verDocumentoConsulta(${c.id})">
                            <i class="fa-solid fa-print me-1"></i> Ver / PDF Receta & Skincare
                        </button>
                    </div>
                </div>

                <div class="row g-3">
                    <div class="col-md-6">
                        <strong class="small text-secondary d-block">Motivo & Evaluación Cutánea:</strong>
                        <div class="p-2 bg-light rounded border small">
                            <div><strong>Motivo:</strong> ${esc(c.motivo_consulta)}</div>
                            ${c.lesiones_elementales ? `<div><strong>Lesiones:</strong> ${esc(c.lesiones_elementales)}</div>` : ''}
                            ${c.zonas_afectadas ? `<div><strong>Zonas:</strong> ${esc(c.zonas_afectadas)}</div>` : ''}
                        </div>
                    </div>
                    <div class="col-md-6">
                        <strong class="small text-secondary d-block">Diagnóstico y Procedimiento Realizado:</strong>
                        <div class="p-2 bg-light rounded border small">
                            <div class="fw-bold text-dark">${nl2br(c.diagnosticos)}</div>
                            ${c.procedimiento_realizado ? `<div class="mt-1 text-derma fw-semibold"><i class="fa-solid fa-syringe me-1"></i> ${esc(c.procedimiento_realizado)}</div>` : ''}
                            ${c.producto_lote_unidades ? `<div class="text-muted" style="font-size:0.75rem;">${esc(c.producto_lote_unidades)}</div>` : ''}
                        </div>
                    </div>

                    ${c.mapa_facial_data ? `
                        <div class="col-md-4 text-center">
                            <strong class="small text-secondary d-block mb-1">Mapa Facial de Aplicación:</strong>
                            <img src="${c.mapa_facial_data}" class="img-fluid rounded border" style="max-height:170px;">
                        </div>
                    ` : ''}

                    <div class="col-md-${c.mapa_facial_data ? '8' : '12'}">
                        <div class="row g-2">
                            ${c.rutina_dia ? `
                                <div class="col-md-6">
                                    <div class="p-2 rounded border small" style="background:#fffbeb;border-color:#fde68a !important;">
                                        <strong class="text-warning-emphasis d-block"><i class="fa-solid fa-sun text-warning me-1"></i> Skincare Rutina Día:</strong>
                                        ${nl2br(c.rutina_dia)}
                                    </div>
                                </div>` : ''}
                            ${c.rutina_noche ? `
                                <div class="col-md-6">
                                    <div class="p-2 rounded border small bg-derma-subtle">
                                        <strong class="text-derma d-block"><i class="fa-solid fa-moon me-1"></i> Skincare Rutina Noche:</strong>
                                        ${nl2br(c.rutina_noche)}
                                    </div>
                                </div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Renderizar Galería Fotográfica Antes/Después y Estudios
    renderizarGaleriaFotos(fotos);

    // Renderizar Egresos
    renderizarListaEgresos(egresos);
}

// ==================== 4. MAPA ANATÓMICO INTERACTIVO (ROSTRO 3 VISTAS / CUERPO COMPLETO / FOTO REAL) ====================
let currentMapType = 'rostro';
const mapBgImages = {
    rostro: new Image(),
    cuerpo: new Image(),
    custom: null
};

function initFaceMapCanvas() {
    faceCanvas = document.getElementById('faceMapCanvas');
    if (!faceCanvas) return;
    faceCtx = faceCanvas.getContext('2d');

    mapBgImages.rostro.onload = () => { if (currentMapType === 'rostro') redibujarMapaFacial(); };
    mapBgImages.cuerpo.onload = () => { if (currentMapType === 'cuerpo') redibujarMapaFacial(); };
    mapBgImages.rostro.src = 'img/mapa_rostro.jpg';
    mapBgImages.cuerpo.src = 'img/mapa_cuerpo.jpg';

    dibujarEsquemaFacialBase();

    const getPos = (e) => {
        const rect = faceCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (faceCanvas.width / rect.width),
            y: (clientY - rect.top) * (faceCanvas.height / rect.height)
        };
    };

    const startDraw = (e) => {
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        faceStrokes.push({ color: currentBrushColor, points: [pos] });
        redibujarMapaFacial();
    };

    const moveDraw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        faceStrokes[faceStrokes.length - 1].points.push(pos);
        redibujarMapaFacial();
    };

    const endDraw = () => { isDrawing = false; };

    faceCanvas.addEventListener('mousedown', startDraw);
    faceCanvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);

    faceCanvas.addEventListener('touchstart', startDraw, { passive: false });
    faceCanvas.addEventListener('touchmove', moveDraw, { passive: false });
    faceCanvas.addEventListener('touchend', endDraw);
}

function cambiarFondoMapa(tipo, btnEl) {
    currentMapType = tipo;
    document.querySelectorAll('.btn-vista-mapa').forEach(b => {
        b.classList.remove('btn-derma');
        b.classList.add('btn-outline-derma');
    });
    if (btnEl) {
        btnEl.classList.remove('btn-outline-derma');
        btnEl.classList.add('btn-derma');
    }
    redibujarMapaFacial();
}

function cargarFotoPersonalizadaMapa(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            mapBgImages.custom = img;
            currentMapType = 'custom';
            const btns = document.querySelectorAll('.btn-vista-mapa');
            btns.forEach(b => { b.classList.remove('btn-derma'); b.classList.add('btn-outline-derma'); });
            if (btns[2]) { btns[2].classList.remove('btn-outline-derma'); btns[2].classList.add('btn-derma'); }
            redibujarMapaFacial();
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function seleccionarPincelMapa(color, label, btnEl) {
    currentBrushColor = color;
    currentBrushLabel = label;
    document.querySelectorAll('.btn-pincel-mapa').forEach(b => b.classList.remove('active', 'border-dark'));
    if (btnEl) btnEl.classList.add('active', 'border-dark');
}

function limpiarMapaFacial() {
    faceStrokes = [];
    dibujarEsquemaFacialBase();
}

function deshacerTrazoMapa() {
    faceStrokes.pop();
    redibujarMapaFacial();
}

function dibujarEsquemaFacialBase() {
    if (!faceCtx) return;
    const w = faceCanvas.width;
    const h = faceCanvas.height;
    faceCtx.clearRect(0, 0, w, h);

    // Fondo blanco clínico
    faceCtx.fillStyle = '#ffffff';
    faceCtx.fillRect(0, 0, w, h);

    const activeImg = mapBgImages[currentMapType];
    if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
        // Dibujar imagen manteniendo proporción centrada (contain)
        const scale = Math.min(w / activeImg.naturalWidth, h / activeImg.naturalHeight);
        const nw = activeImg.naturalWidth * scale;
        const nh = activeImg.naturalHeight * scale;
        const nx = (w - nw) / 2;
        const ny = (h - nh) / 2;
        faceCtx.drawImage(activeImg, nx, ny, nw, nh);
    }
}

function redibujarMapaFacial() {
    dibujarEsquemaFacialBase();
    faceStrokes.forEach(s => {
        faceCtx.strokeStyle = s.color;
        faceCtx.fillStyle = s.color;
        faceCtx.lineWidth = 4;
        faceCtx.lineCap = 'round';
        faceCtx.lineJoin = 'round';
        if (s.points.length === 1) {
            // Punto de aplicación con halo blanco para máxima visibilidad sobre rostro/cuerpo/foto
            faceCtx.beginPath();
            faceCtx.arc(s.points[0].x, s.points[0].y, 6, 0, Math.PI * 2);
            faceCtx.fill();
            faceCtx.lineWidth = 2;
            faceCtx.strokeStyle = '#ffffff';
            faceCtx.stroke();
        } else {
            faceCtx.beginPath();
            faceCtx.moveTo(s.points[0].x, s.points[0].y);
            s.points.forEach(pt => faceCtx.lineTo(pt.x, pt.y));
            faceCtx.stroke();
        }
    });
}

// ==================== 5. NUEVA CONSULTA Y PLANTILLAS SKINCARE ====================
async function prepararNuevaConsulta(pacienteId) {
    currentPatientId = Number(pacienteId);
    const pacientes = await db.getAll('pacientes');
    const p = pacientes.find(x => Number(x.id) === currentPatientId);
    if (!p) return navegarA('pacientes');

    document.getElementById('formConsulta').reset();
    document.getElementById('cons_paciente_id').value = p.id;
    document.getElementById('cons_fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('consBannerNombre').innerText = `${p.nombre_apellido} (C.I: ${p.cedula} • Biotipo: ${p.biotipo_cutaneo || 'Mixta'} • Fitzpatrick ${p.fototipo_fitzpatrick || 'III'})`;
    limpiarMapaFacial();
}

function cargarPlantillaSkincare(tipo) {
    const dia = document.getElementById('cons_rutina_dia');
    const noche = document.getElementById('cons_rutina_noche');
    const post = document.getElementById('cons_cuidados_post');

    const plantillas = {
        melasma: {
            d: "1. Limpiador Syndet Despigmentante: Lavar rostro por la mañana.\n2. Sérum Antioxidante (Vitamina C 15% + Ácido Ferúlico): 4 gotas en rostro seco.\n3. Protector Solar Dermatológico SPF 50+ con Color (Luz Visible / UVA / UVB): Aplicar cada 3 horas (8am, 11am, 2pm).",
            n: "1. Doble limpieza (Agua Micelar + Gel Limpiador).\n2. Fórmula Despigmentante (Ácido Tranexámico 3% + Niacinamida 5% + Ácido Kójico): Aplicar capa fina en zonas pigmentadas.\n3. Crema Hidratante Restauradora con Ceramidas a los 15 minutos."
        },
        acne: {
            d: "1. Gel Limpiador Seborregulador (Ácido Salicílico 2%): Lavar rostro mañana y noche.\n2. Gel-Crema Hidratante Oil-Free Matificante (Niacinamida 4%).\n3. Protector Solar Gel Toque Seco Oil-Control SPF 50+: Reaplicar cada 3 horas.",
            n: "1. Lavar rostro con Gel Seborregulador y secar a toques.\n2. Retinoide Tópico (Adapaleno 0.1% / Ácido Retinoico): Aplicar cantidad tamaño guisante en rostro evitando contorno de ojos y comisuras.\n3. Hidratante ligera no comedogénica."
        },
        antiaging: {
            d: "1. Espuma Limpiadora Hidratante Suave.\n2. Sérum Ácido Hialurónico Multimolecular + Vitamina B5 (en piel húmeda).\n3. Contorno de Ojos con Péptidos y Cafeína.\n4. Protector Solar Antiedad SPF 50+.",
            n: "1. Leche o Aceite Limpiador + Espuma.\n2. Sérum de Retinol Puro 0.3% / Bakuchiol: Aplicar 3 noches por semana e ir aumentando según tolerancia.\n3. Crema Nutritiva Nocturna con Péptidos y Ceramidas."
        },
        rosacea: {
            d: "1. Agua Micelar Piel Sensible / Limpiador Syndet sin jabón.\n2. Crema Calmante Anti-Rojeces (Ácido Azelaico 10% + Centella Asiática).\n3. Protector Solar 100% Mineral (Filtros Físicos) SPF 50+.",
            n: "1. Limpieza suave con agua fresca (no caliente).\n2. Ácido Azelaico 15% gel-crema en zonas con eritema o pápulas.\n3. Bálsamo Reparador de Barrera Cutánea (Pantenol + Agua Termal)."
        },
        post_toxina: {
            p: "• Mantener posición vertical (no acostarse ni bajar la cabeza) durante las primeras 4 horas.\n• No masajear, frotar ni presionar las zonas de aplicación.\n• No realizar ejercicio físico intenso, sauna, baño turco ni piscina por 48 horas.\n• Asistir a su cita de control fotográfico y evaluación a los 14 días."
        },
        post_relleno: {
            p: "• Aplicar frío local suave (compresa fría envuelta) 10 minutos cada 3 horas si hay inflamación.\n• Dormir boca arriba con la cabeza ligeramente elevada las primeras 2 noches.\n• No exponerse a sol directo, calor intenso ni ejercicio fuerte por 72 horas.\n• Avisar de inmediato a la Dra. Doris Romero si nota dolor intenso o cambio de coloración en la zona."
        }
    };

    const sel = plantillas[tipo];
    if (!sel) return;
    if (sel.d) dia.value = sel.d;
    if (sel.n) noche.value = sel.n;
    if (sel.p) post.value = sel.p;
}

async function guardarConsulta(e) {
    e.preventDefault();
    const pacId = Number(document.getElementById('cons_paciente_id').value);
    const mapaData = faceStrokes.length > 0 ? faceCanvas.toDataURL('image/jpeg', 0.85) : '';

    const payload = {
        paciente_id: pacId,
        fecha_consulta: document.getElementById('cons_fecha').value,
        tipo_consulta: document.getElementById('cons_tipo').value,
        motivo_consulta: document.getElementById('cons_motivo').value.trim(),
        enfermedad_actual: document.getElementById('cons_ea').value.trim(),
        lesiones_elementales: document.getElementById('cons_lesiones').value.trim(),
        zonas_afectadas: document.getElementById('cons_zonas').value.trim(),
        examen_dermatoscopico: document.getElementById('cons_dermatoscopia').value.trim(),
        diagnosticos: document.getElementById('cons_diagnosticos').value.trim(),
        procedimiento_realizado: document.getElementById('cons_procedimiento').value.trim(),
        producto_lote_unidades: document.getElementById('cons_lote').value.trim(),
        mapa_facial_data: mapaData,
        rutina_dia: document.getElementById('cons_rutina_dia').value.trim(),
        rutina_noche: document.getElementById('cons_rutina_noche').value.trim(),
        tratamiento_farmacologico: document.getElementById('cons_recipe').value.trim(),
        cuidados_post_procedimiento: document.getElementById('cons_cuidados_post').value.trim(),
        orden_laboratorio: document.getElementById('cons_laboratorio').value.trim(),
        proxima_consulta: document.getElementById('cons_proxima').value || null
    };

    const saved = await db.insert('consultas', payload);

    // Si programó próxima consulta, agendar automáticamente
    if (payload.proxima_consulta) {
        await db.insert('citas', {
            paciente_id: pacId,
            sede_id: 1,
            fecha_cita: payload.proxima_consulta,
            hora_cita: '10:00',
            tipo: 'Control Dermo-Estético',
            estado: 'Agendada',
            notas: 'Control derivado de consulta: ' + (payload.procedimiento_realizado || payload.diagnosticos)
        });
    }

    Swal.fire({
        title: '¡Consulta Guardada!',
        text: '¿Desea visualizar e imprimir la Rutina de Skincare y el Informe Médico?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: '#6d28d9',
        confirmButtonText: '<i class="fa-solid fa-print me-1"></i> Ver Receta y Skincare',
        cancelButtonText: 'Ir al Expediente'
    }).then(r => {
        if (r.isConfirmed) {
            verDocumentoConsulta(saved.id);
        } else {
            navegarA('historia', pacId);
        }
    });
}

// ==================== 6. GALERÍA FOTOGRÁFICA ANTES/DESPUÉS (CON COMPRESOR IPAD) ====================
function renderizarGaleriaFotos(fotos) {
    const cont = document.getElementById('histGaleriaFotos');
    const selAntes = document.getElementById('baSelectAntes');
    const selDespues = document.getElementById('baSelectDespues');

    if (fotos.length === 0) {
        cont.innerHTML = `<div class="col-12"><div class="card-derma p-4 text-center text-muted small">No hay fotografías ni estudios cargados aún.</div></div>`;
        document.getElementById('baComparatorCard').style.display = 'none';
        return;
    }

    // Si hay 2 o más fotos, activar el comparador deslizable Antes vs Después
    if (fotos.length >= 2) {
        document.getElementById('baComparatorCard').style.display = 'block';
        const opts = fotos.map(f => `<option value="${f.id}">${esc(f.etapa)} - ${esc(f.titulo)} (${formatearFecha(f.fecha_foto)})</option>`).join('');
        selAntes.innerHTML = opts;
        selDespues.innerHTML = opts;
        selAntes.value = fotos[fotos.length - 1].id; // Más antigua como Antes
        selDespues.value = fotos[0].id;               // Más reciente como Después
        actualizarComparadorBA(fotos);
    } else {
        document.getElementById('baComparatorCard').style.display = 'none';
    }

    cont.innerHTML = fotos.map(f => `
        <div class="col-md-6">
            <div class="card-derma h-100 p-3 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="badge bg-derma">${esc(f.etapa)}</span>
                    <span class="small text-muted font-monospace">${formatearFecha(f.fecha_foto)}</span>
                </div>
                <h6 class="fw-bold mb-1">${esc(f.titulo)} <span class="text-muted fw-normal small">(${esc(f.zona_anatomica)})</span></h6>
                <div class="text-center bg-light rounded border p-2 my-2">
                    <img src="${f.imagen_base64}" class="img-fluid rounded" style="max-height:190px;object-fit:contain;">
                </div>
                ${f.notas ? `<div class="small text-muted mb-2">${esc(f.notas)}</div>` : ''}
                ${f.interpretacion_ia ? `<div class="p-2 rounded border bg-derma-subtle small mb-2"><strong><i class="fa-solid fa-robot text-derma me-1"></i> Análisis IA:</strong><div>${f.interpretacion_ia}</div></div>` : ''}
                <div class="mt-auto pt-2 border-top d-flex gap-2">
                    <button class="btn btn-sm btn-outline-derma flex-fill" onclick="analizarFotoConGemini(${f.id})">
                        <i class="fa-solid fa-wand-magic-sparkles me-1"></i> Analizar con IA
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarFotoEvolutiva(${f.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function actualizarComparadorBA() {
    const fotos = (await db.getAll('fotos_evolutivas')).filter(f => Number(f.paciente_id) === currentPatientId);
    const idA = Number(document.getElementById('baSelectAntes').value);
    const idD = Number(document.getElementById('baSelectDespues').value);
    const fA = fotos.find(x => Number(x.id) === idA);
    const fD = fotos.find(x => Number(x.id) === idD);
    if (fA) document.getElementById('baImgAntes').src = fA.imagen_base64;
    if (fD) document.getElementById('baImgDespues').src = fD.imagen_base64;
}

function moverSliderBA(val) {
    document.getElementById('baOverlayAntes').style.width = val + '%';
}

async function subirFotoEvolutiva(e) {
    e.preventDefault();
    const fileInput = document.getElementById('foto_archivo');
    if (!fileInput.files || !fileInput.files[0]) return;

    Swal.fire({ title: 'Optimizando imagen clínica...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { dataUrl, sizeKB } = await comprimirImagenClinica(fileInput.files[0]);

    await db.insert('fotos_evolutivas', {
        paciente_id: currentPatientId,
        etapa: document.getElementById('foto_etapa').value,
        zona_anatomica: document.getElementById('foto_zona').value,
        titulo: document.getElementById('foto_titulo').value.trim(),
        fecha_foto: document.getElementById('foto_fecha').value,
        imagen_base64: dataUrl,
        notas: document.getElementById('foto_notas').value.trim() + ` (Optimizada: ${sizeKB} KB)`
    });

    Swal.close();
    bootstrap.Modal.getInstance(document.getElementById('modalSubirFoto')).hide();
    document.getElementById('formSubirFoto').reset();
    await cargarHistoriaPaciente(currentPatientId);
}

async function eliminarFotoEvolutiva(id) {
    await db.remove('fotos_evolutivas', id);
    await cargarHistoriaPaciente(currentPatientId);
}

// ==================== 7. DOCUMENTOS IMPRIMIBLES Y PDF (INFORME + SKINCARE DÍA/NOCHE) ====================
async function verDocumentoConsulta(consultaId) {
    const [consultas, pacientes] = await Promise.all([db.getAll('consultas'), db.getAll('pacientes')]);
    const c = consultas.find(x => Number(x.id) === Number(consultaId));
    if (!c) return;
    const p = pacientes.find(x => Number(x.id) === Number(c.paciente_id)) || {};

    const membrete = `
        <div class="sheet-header d-flex justify-content-between align-items-center">
            <div>
                <h3 class="serif-brand fw-bold mb-0" style="font-size:1.65rem;color:#1e1b4b;letter-spacing:1px;">DRA. DORIS ROMERO</h3>
                <div class="fw-bold" style="font-size:0.85rem;color:#6d28d9;letter-spacing:2px;text-transform:uppercase;">MEDICINA ESTÉTICA Y DERMATOLOGÍA</div>
                <div class="text-muted" style="font-size:0.75rem;">M.P.P.S: 131642 &bull; C.M: 13750</div>
            </div>
            <div class="text-end">
                <img src="img/logo_dr.svg" alt="Logo DR" style="height:68px;">
            </div>
        </div>
    `;

    const pieFirma = `
        <div class="sheet-footer">
            <div class="text-muted" style="font-size:10px;">
                DermaSys &bull; Dra. Doris Romero &bull; Emitido el ${formatearFecha(c.fecha_consulta)}
            </div>
            <div style="text-align:center;width:240px;">
                <div style="border-top:1px solid #1e1b4b;padding-top:4px;font-size:11px;font-weight:700;">
                    Dra. Doris Romero<br>
                    <span style="font-weight:normal;color:#64748b;font-size:10px;">Medicina Estética | M.P.P.S: 131642 - C.M: 13750</span>
                </div>
            </div>
        </div>
    `;

    let htmlSheets = `
        <!-- HOJA 1: INFORME DERMO-ESTÉTICO -->
        <div class="medical-sheet">
            ${membrete}
            <h4 class="text-center fw-bold mb-3" style="color:#1e1b4b;letter-spacing:1px;">INFORME MÉDICO DERMO-ESTÉTICO</h4>
            <div class="p-2 mb-3 bg-light rounded border small">
                <div class="row">
                    <div class="col-7"><strong>Paciente:</strong> ${esc(p.nombre_apellido)}</div>
                    <div class="col-5 text-end"><strong>C.I:</strong> ${esc(p.cedula)}</div>
                    <div class="col-4"><strong>Edad:</strong> ${p.edad || '--'} años</div>
                    <div class="col-4"><strong>Biotipo / Fototipo:</strong> ${esc(p.biotipo_cutaneo || 'Mixta')} (Fitzpatrick ${esc(p.fototipo_fitzpatrick || 'III')})</div>
                    <div class="col-4 text-end"><strong>Fecha:</strong> ${formatearFecha(c.fecha_consulta)}</div>
                </div>
            </div>

            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Motivo de Consulta y Evaluación Cutánea:</strong>
                <div class="p-2 rounded border mt-1">${nl2br(c.motivo_consulta)} ${c.enfermedad_actual ? '<br>' + nl2br(c.enfermedad_actual) : ''}</div>
            </div>

            ${c.lesiones_elementales || c.examen_dermatoscopico ? `
            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Hallazgos Clínicos / Dermatoscopia:</strong>
                <div class="p-2 rounded border mt-1">
                    ${c.lesiones_elementales ? `<div><strong>Lesiones:</strong> ${esc(c.lesiones_elementales)} (${esc(c.zonas_afectadas)})</div>` : ''}
                    ${c.examen_dermatoscopico ? `<div><strong>Dermatoscopia:</strong> ${esc(c.examen_dermatoscopico)}</div>` : ''}
                </div>
            </div>` : ''}

            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Impresión Diagnóstica:</strong>
                <div class="p-2 rounded border bg-derma-subtle fw-bold mt-1">${nl2br(c.diagnosticos)}</div>
            </div>

            ${c.procedimiento_realizado ? `
            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Procedimiento Realizado en Consultorio:</strong>
                <div class="p-2 rounded border mt-1">
                    <div class="fw-bold">${esc(c.procedimiento_realizado)}</div>
                    ${c.producto_lote_unidades ? `<div class="small text-muted">${esc(c.producto_lote_unidades)}</div>` : ''}
                </div>
            </div>` : ''}

            ${c.mapa_facial_data ? `
            <div class="text-center my-2">
                <div class="small fw-bold text-secondary mb-1">Esquema / Mapa Facial de Tratamiento:</div>
                <img src="${c.mapa_facial_data}" style="max-height:200px;border:1px solid #ddd6fe;border-radius:8px;">
            </div>` : ''}

            ${pieFirma}
        </div>

        <!-- HOJA 2: RUTINA DE SKINCARE (DÍA / NOCHE) Y RÉCIPE -->
        <div class="medical-sheet">
            ${membrete}
            <h4 class="text-center fw-bold mb-3" style="color:#6d28d9;letter-spacing:1px;">PLAN PERSONALIZADO DE SKINCARE & RÉCIPE</h4>
            <div class="p-2 mb-3 bg-light rounded border small d-flex justify-content-between">
                <span><strong>Paciente:</strong> ${esc(p.nombre_apellido)} (C.I: ${esc(p.cedula)})</span>
                <span><strong>Fecha:</strong> ${formatearFecha(c.fecha_consulta)}</span>
            </div>

            <div class="row g-3 mb-3">
                <div class="col-md-6">
                    <div class="p-3 rounded border h-100" style="background:#fffbeb;border-color:#fde68a !important;">
                        <h6 class="fw-bold text-warning-emphasis mb-2"><i class="fa-solid fa-sun text-warning me-1"></i> RUTINA DE DÍA (AM)</h6>
                        <div class="small">${nl2br(c.rutina_dia || 'Seguir indicaciones habituales.')}</div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="p-3 rounded border h-100 bg-derma-subtle">
                        <h6 class="fw-bold text-derma mb-2"><i class="fa-solid fa-moon me-1"></i> RUTINA DE NOCHE (PM)</h6>
                        <div class="small">${nl2br(c.rutina_noche || 'Seguir indicaciones habituales.')}</div>
                    </div>
                </div>
            </div>

            ${c.tratamiento_farmacologico ? `
            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Rp. / Tratamiento Farmacológico Adicional:</strong>
                <div class="p-3 rounded border mt-1 font-monospace small">${nl2br(c.tratamiento_farmacologico)}</div>
            </div>` : ''}

            ${c.cuidados_post_procedimiento ? `
            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Cuidados Post-Procedimiento:</strong>
                <div class="p-2 rounded border bg-light mt-1 small">${nl2br(c.cuidados_post_procedimiento)}</div>
            </div>` : ''}

            ${c.proxima_consulta ? `<div class="small fw-bold text-derma">Próximo Control Pautado: ${formatearFecha(c.proxima_consulta)}</div>` : ''}

            ${pieFirma}
        </div>
    `;

    currentPrintPatient = p;
    currentPrintSubject = `Informe Dermo-Estético y Rutina Skincare (${formatearFecha(c.fecha_consulta)}) | Dra. Doris Romero`;
    document.getElementById('printSheetsContainer').innerHTML = htmlSheets;
    document.getElementById('btnVolverDePrint').onclick = () => navegarA('historia', p.id);
    navegarA('print');
}

function exportarHojasAPDF(nombreBase = 'DermaSys_Documento') {
    const container = document.getElementById('printSheetsContainer');
    const opt = {
        margin: [8, 8, 8, 8],
        filename: `${nombreBase}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
    };
    html2pdf().set(opt).from(container).save();
}

async function enviarDocumentoActualPorCorreo() {
    const p = currentPrintPatient || {};
    const { value: emailDestino } = await Swal.fire({
        title: 'Enviar Informe por Correo',
        input: 'email',
        inputLabel: `Destinatario (${p.nombre_apellido || 'Paciente'})`,
        inputValue: p.correo || '',
        inputPlaceholder: 'paciente@gmail.com',
        showCancelButton: true,
        confirmButtonColor: '#6d28d9',
        confirmButtonText: '<i class="fa-solid fa-paper-plane me-1"></i> Enviar Ahora',
        cancelButtonText: 'Cancelar'
    });

    if (!emailDestino) return;

    const creds = db.getCreds();
    const htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;border:1px solid #ddd6fe;border-radius:12px;overflow:hidden;">
            <div style="background:#1e1b4b;color:#ffffff;padding:18px 24px;">
                <h2 style="margin:0;font-family:Georgia,serif;letter-spacing:1px;">DRA. DORIS ROMERO</h2>
                <div style="color:#c4b5fd;font-size:12px;">Medicina Estética y Dermatología &bull; M.P.P.S: 131642 | C.M: 13750 &bull; DermaSys</div>
            </div>
            <div style="padding:24px;color:#1e293b;">
                ${document.getElementById('printSheetsContainer').innerHTML}
            </div>
        </div>
    `;

    Swal.fire({ title: 'Enviando correo electrónico...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // Intentar endpoint serverless de Vercel (/api/enviar-correo) y fallback local XAMPP (enviar_correo_local.php)
    const endpoint = window.location.hostname.includes('vercel.app') ? '/api/enviar-correo' : 'enviar_correo_local.php';
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinatario: emailDestino,
                asunto: currentPrintSubject,
                html: htmlContent,
                smtpEmail: creds.smtpEmail,
                smtpPass: creds.smtpPass
            })
        });
        const data = await res.json();
        if (data.ok) {
            Swal.fire('¡Correo Enviado!', data.message, 'success');
        } else {
            Swal.fire({
                title: 'Atención Correo SMTP',
                text: data.error || 'Configure su correo Gmail y Contraseña de Aplicación de 16 letras en el botón Nube / Correo.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#6d28d9',
                confirmButtonText: 'Configurar Correo Ahora',
                cancelButtonText: 'Cerrar'
            }).then(r => {
                if (r.isConfirmed) abrirModalSupabase();
            });
        }
    } catch (err) {
        Swal.fire('Aviso', 'Verifique su configuración de correo en el botón superior Nube / Correo.', 'info');
    }
}

// ==================== 8. EGRESOS Y REPOSOS ====================
async function prepararNuevoEgreso(pacienteId) {
    currentPatientId = Number(pacienteId);
    const pacientes = await db.getAll('pacientes');
    const p = pacientes.find(x => Number(x.id) === currentPatientId);
    if (!p) return navegarA('pacientes');

    document.getElementById('formEgreso').reset();
    document.getElementById('eg_paciente_id').value = p.id;
    document.getElementById('eg_fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('egBannerNombre').innerText = `${p.nombre_apellido} (C.I: ${p.cedula})`;
}

async function guardarEgreso(e) {
    e.preventDefault();
    const pacId = Number(document.getElementById('eg_paciente_id').value);
    const payload = {
        paciente_id: pacId,
        sede_id: 1,
        fecha_egreso: document.getElementById('eg_fecha').value,
        tipo_atencion: document.getElementById('eg_tipo_atencion').value,
        conducta_egreso: document.getElementById('eg_conducta').value,
        diagnosticos_egreso: document.getElementById('eg_diagnosticos').value.trim(),
        nota_egreso: document.getElementById('eg_nota').value.trim(),
        comentarios_internos: document.getElementById('eg_internos').value.trim(),
        plan_tratamiento_egreso: document.getElementById('eg_plan').value.trim(),
        reposo_medico: document.getElementById('eg_reposo_switch').checked ? 'Sí' : 'No',
        reposo_dias: document.getElementById('eg_reposo_dias').value || null
    };
    const saved = await db.insert('egresos', payload);
    Swal.fire({
        title: 'Egreso Registrado',
        text: '¿Desea visualizar, imprimir o enviar por correo el Informe de Alta / Reposo?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: '#6d28d9',
        confirmButtonText: 'Ver / Enviar Informe',
        cancelButtonText: 'Volver al Expediente'
    }).then(r => {
        if (r.isConfirmed) {
            verDocumentoEgreso(saved.id);
        } else {
            navegarA('historia', pacId);
        }
    });
}

function renderizarListaEgresos(egresos) {
    const cont = document.getElementById('histListaEgresos');
    if (egresos.length === 0) {
        cont.innerHTML = `<div class="card-derma p-4 text-center text-muted small">No hay egresos registrados para este paciente.</div>`;
        return;
    }
    cont.innerHTML = egresos.map(eg => `
        <div class="card-derma p-3 mb-2">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <span class="badge bg-derma">${esc(eg.conducta_egreso)}</span>
                    <span class="small text-muted font-monospace ms-2">${formatearFecha(eg.fecha_egreso)}</span>
                </div>
                <button class="btn btn-sm btn-outline-derma" onclick="verDocumentoEgreso(${eg.id})">
                    <i class="fa-solid fa-print me-1"></i> Ver / PDF / Correo
                </button>
            </div>
            <div class="fw-bold mt-2">${esc(eg.diagnosticos_egreso)}</div>
            <div class="small text-muted mt-1">${nl2br(eg.nota_egreso)}</div>
            ${eg.reposo_medico === 'Sí' ? `<div class="badge bg-success-subtle text-success mt-2">Reposo Médico: ${eg.reposo_dias} días</div>` : ''}
        </div>
    `).join('');
}

async function verDocumentoEgreso(egresoId) {
    const [egresos, pacientes] = await Promise.all([db.getAll('egresos'), db.getAll('pacientes')]);
    const eg = egresos.find(x => Number(x.id) === Number(egresoId));
    if (!eg) return;
    const p = pacientes.find(x => Number(x.id) === Number(eg.paciente_id)) || {};

    currentPrintPatient = p;
    currentPrintSubject = `Informe de Alta / Reposo (${formatearFecha(eg.fecha_egreso)}) | Dra. Doris Romero`;

    const htmlSheet = `
        <div class="medical-sheet">
            <div class="sheet-header d-flex justify-content-between align-items-center">
                <div>
                    <h3 class="serif-brand fw-bold mb-0" style="font-size:1.65rem;color:#1e1b4b;letter-spacing:1px;">DRA. DORIS ROMERO</h3>
                    <div class="fw-bold" style="font-size:0.85rem;color:#6d28d9;letter-spacing:2px;text-transform:uppercase;">MEDICINA ESTÉTICA Y DERMATOLOGÍA</div>
                    <div class="text-muted" style="font-size:0.75rem;">M.P.P.S: 131642 &bull; C.M: 13750</div>
                </div>
                <div class="text-end">
                    <img src="img/logo_dr.svg" alt="Logo DR" style="height:68px;">
                </div>
            </div>
            <h4 class="text-center fw-bold mb-3" style="color:#1e1b4b;letter-spacing:1px;">INFORME MÉDICO DE ALTA / EGRESO</h4>
            <div class="p-2 mb-3 bg-light rounded border small d-flex justify-content-between">
                <span><strong>Paciente:</strong> ${esc(p.nombre_apellido)} (C.I: ${esc(p.cedula)})</span>
                <span><strong>Fecha:</strong> ${formatearFecha(eg.fecha_egreso)}</span>
            </div>
            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Modalidad y Conducta:</strong>
                <div class="p-2 rounded border mt-1">${esc(eg.tipo_atencion)} &mdash; <strong>${esc(eg.conducta_egreso)}</strong></div>
            </div>
            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Diagnóstico(s) de Egreso:</strong>
                <div class="p-2 rounded border bg-derma-subtle fw-bold mt-1">${nl2br(eg.diagnosticos_egreso)}</div>
            </div>
            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Resumen de Evolución y Procedimiento:</strong>
                <div class="p-2 rounded border mt-1">${nl2br(eg.nota_egreso)}</div>
            </div>
            ${eg.plan_tratamiento_egreso ? `
            <div class="mb-3">
                <strong class="text-derma small text-uppercase">Cuidados Domiciliarios e Indicaciones de Alta:</strong>
                <div class="p-2 rounded border mt-1">${nl2br(eg.plan_tratamiento_egreso)}</div>
            </div>` : ''}
            ${eg.reposo_medico === 'Sí' ? `
            <div class="p-3 rounded border border-success bg-success-subtle mb-3">
                <strong class="text-success"><i class="fa-solid fa-bed-pulse me-1"></i> CONSTANCIA DE REPOSO MÉDICO:</strong>
                <div>Se indica reposo físico y laboral/académico por <strong>${esc(eg.reposo_dias)} días continuos</strong> a partir del ${formatearFecha(eg.fecha_egreso)}.</div>
            </div>` : ''}
            <div class="sheet-footer">
                <div class="text-muted" style="font-size:10px;">
                    DermaSys &bull; Dra. Doris Romero &bull; Emitido el ${formatearFecha(eg.fecha_egreso)}
                </div>
                <div style="text-align:center;width:240px;">
                    <div style="border-top:1px solid #1e1b4b;padding-top:4px;font-size:11px;font-weight:700;">
                        Dra. Doris Romero<br>
                        <span style="font-weight:normal;color:#64748b;font-size:10px;">Medicina Estética | M.P.P.S: 131642 - C.M: 13750</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('printSheetsContainer').innerHTML = htmlSheet;
    document.getElementById('btnVolverDePrint').onclick = () => navegarA('historia', p.id);
    navegarA('print');
}

// ==================== 9. AGENDA DE CITAS Y PRE-REGISTRO WHATSAPP ====================
async function cargarAgendaCitas() {
    const [citas, pacientes] = await Promise.all([
        db.getAll('citas', 'fecha_cita', true),
        db.getAll('pacientes', 'nombre_apellido', true)
    ]);

    // Llenar selector de pacientes existentes
    const sel = document.getElementById('cita_paciente_existente');
    if (sel) {
        sel.innerHTML = `<option value="">Seleccionar paciente...</option>` +
            pacientes.map(p => `<option value="${p.id}">${esc(p.nombre_apellido)} (${esc(p.cedula)})</option>`).join('');
    }

    const tbody = document.getElementById('tablaCitasBody');
    if (citas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No hay citas registradas.</td></tr>`;
        return;
    }

    tbody.innerHTML = citas.map(c => {
        const p = pacientes.find(x => Number(x.id) === Number(c.paciente_id)) || { nombre_apellido: 'Paciente', cedula: '', telefono: '' };
        const telWa = String(p.telefono || '').replace(/\D/g, '').replace(/^0/, '58');
        const msgWa = encodeURIComponent(`Hola ${p.nombre_apellido}, le recordamos su cita con la Dra. Doris Romero (Medicina Estética y Dermatología) el día ${formatearFecha(c.fecha_cita)} ${c.hora_cita || ''}. Por favor confirmar su asistencia.`);
        return `
            <tr>
                <td class="ps-3 font-monospace fw-bold">${formatearFecha(c.fecha_cita)} <span class="text-muted fw-normal">${esc(c.hora_cita || '')}</span></td>
                <td>
                    <a href="javascript:void(0)" onclick="navegarA('historia', ${p.id})" class="fw-bold text-dark text-decoration-none">${esc(p.nombre_apellido)}</a>
                    <div class="small text-muted">${esc(p.cedula)}</div>
                </td>
                <td><span class="badge bg-derma-subtle text-derma border">${esc(c.tipo)}</span></td>
                <td><span class="badge bg-success">${esc(c.estado)}</span></td>
                <td>
                    <div class="d-flex flex-wrap gap-1">
                        ${p.telefono ? `<a href="https://wa.me/${telWa}?text=${msgWa}" target="_blank" class="btn btn-sm btn-outline-success" title="Recordatorio por WhatsApp"><i class="fa-brands fa-whatsapp me-1"></i> ${esc(p.telefono)}</a>` : ''}
                        <button class="btn btn-sm btn-outline-derma" onclick="enviarRecordatorioCitaCorreo(${c.id})" title="Enviar Recordatorio por Correo">
                            <i class="fa-solid fa-envelope"></i>
                        </button>
                    </div>
                </td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-derma" onclick="navegarA('nueva-consulta', ${p.id})"><i class="fa-solid fa-stethoscope me-1"></i> Atender</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function enviarRecordatorioCitaCorreo(citaId) {
    const [citas, pacientes] = await Promise.all([db.getAll('citas'), db.getAll('pacientes')]);
    const c = citas.find(x => Number(x.id) === Number(citaId));
    if (!c) return;
    const p = pacientes.find(x => Number(x.id) === Number(c.paciente_id)) || {};

    const { value: emailDestino } = await Swal.fire({
        title: 'Enviar Recordatorio de Cita por Correo',
        input: 'email',
        inputLabel: `Paciente: ${p.nombre_apellido || ''}`,
        inputValue: p.correo || '',
        inputPlaceholder: 'paciente@gmail.com',
        showCancelButton: true,
        confirmButtonColor: '#6d28d9',
        confirmButtonText: '<i class="fa-solid fa-paper-plane me-1"></i> Enviar Recordatorio',
        cancelButtonText: 'Cancelar'
    });
    if (!emailDestino) return;

    const creds = db.getCreds();
    const htmlRecordatorio = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd6fe;border-radius:12px;overflow:hidden;">
            <div style="background:#1e1b4b;color:#ffffff;padding:20px 24px;text-align:center;">
                <h2 style="margin:0;font-family:Georgia,serif;letter-spacing:1px;">DRA. DORIS ROMERO</h2>
                <div style="color:#c4b5fd;font-size:12px;margin-top:4px;">Medicina Estética y Dermatología &bull; M.P.P.S: 131642 | C.M: 13750</div>
            </div>
            <div style="padding:24px;color:#1e293b;">
                <h3 style="color:#6d28d9;margin-top:0;">Recordatorio de Cita Médica</h3>
                <p>Estimado(a) <strong>${esc(p.nombre_apellido)}</strong>,</p>
                <p>Le recordamos cordialmente los detalles de su próxima cita programada:</p>
                <div style="background:#f5f3ff;border-left:4px solid #6d28d9;padding:14px;border-radius:6px;margin:16px 0;">
                    <div><strong>Fecha:</strong> ${formatearFecha(c.fecha_cita)}</div>
                    ${c.hora_cita ? `<div><strong>Hora:</strong> ${esc(c.hora_cita)}</div>` : ''}
                    <div><strong>Tipo de Consulta:</strong> ${esc(c.tipo)}</div>
                    ${c.notas ? `<div><strong>Indicaciones:</strong> ${esc(c.notas)}</div>` : ''}
                </div>
                <p style="font-size:12px;color:#64748b;">Mensaje enviado automáticamente por <strong>DermaSys</strong>.</p>
            </div>
        </div>
    `;

    Swal.fire({ title: 'Enviando recordatorio...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const endpoint = window.location.hostname.includes('vercel.app') ? '/api/enviar-correo' : 'enviar_correo_local.php';
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinatario: emailDestino,
                asunto: `Recordatorio de Cita (${formatearFecha(c.fecha_cita)}) | Dra. Doris Romero - DermaSys`,
                html: htmlRecordatorio,
                smtpEmail: creds.smtpEmail,
                smtpPass: creds.smtpPass
            })
        });
        const data = await res.json();
        if (data.ok) {
            await db.update('citas', c.id, { recordatorio_enviado: true });
            Swal.fire('¡Recordatorio Enviado!', data.message, 'success');
        } else {
            Swal.fire('Error al enviar', data.error || 'No se pudo enviar el correo.', 'error');
        }
    } catch (e) {
        Swal.fire('Aviso', 'No se pudo conectar con el servidor de correo.', 'warning');
    }
}

async function enviarRecordatoriosProximosCorreo() {
    Swal.fire({ title: 'Verificando citas próximas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const [citas, pacientes] = await Promise.all([db.getAll('citas'), db.getAll('pacientes')]);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(hoy.getTime() + 2 * 86400000);

    const proximas = citas.filter(c => {
        if (c.estado === 'Cancelada' || c.estado === 'Completada') return false;
        const fc = new Date(c.fecha_cita + 'T00:00:00');
        return fc >= hoy && fc <= limite;
    });

    if (proximas.length === 0) {
        return Swal.fire('Sin citas en los próximos 2 días', 'No hay pacientes agendados para hoy, mañana o pasado mañana pendientes de recordatorio.', 'info');
    }

    const creds = db.getCreds();
    const endpoint = window.location.hostname.includes('vercel.app') ? '/api/enviar-correo' : 'enviar_correo_local.php';
    let enviados = 0;

    for (const c of proximas) {
        const p = pacientes.find(x => Number(x.id) === Number(c.paciente_id));
        if (!p || !p.correo) continue;
        const htmlRecordatorio = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd6fe;border-radius:12px;overflow:hidden;">
                <div style="background:#1e1b4b;color:#ffffff;padding:20px 24px;text-align:center;">
                    <h2 style="margin:0;font-family:Georgia,serif;letter-spacing:1px;">DRA. DORIS ROMERO</h2>
                    <div style="color:#c4b5fd;font-size:12px;margin-top:4px;">Medicina Estética y Dermatología &bull; M.P.P.S: 131642 | C.M: 13750</div>
                </div>
                <div style="padding:24px;color:#1e293b;">
                    <h3 style="color:#6d28d9;margin-top:0;">Recordatorio de Cita Médica</h3>
                    <p>Estimado(a) <strong>${esc(p.nombre_apellido)}</strong>,</p>
                    <p>Le recordamos cordialmente los detalles de su próxima cita programada:</p>
                    <div style="background:#f5f3ff;border-left:4px solid #6d28d9;padding:14px;border-radius:6px;margin:16px 0;">
                        <div><strong>Fecha:</strong> ${formatearFecha(c.fecha_cita)}</div>
                        ${c.hora_cita ? `<div><strong>Hora:</strong> ${esc(c.hora_cita)}</div>` : ''}
                        <div><strong>Tipo de Consulta:</strong> ${esc(c.tipo)}</div>
                        ${c.notas ? `<div><strong>Indicaciones:</strong> ${esc(c.notas)}</div>` : ''}
                    </div>
                    <p style="font-size:12px;color:#64748b;">Mensaje enviado por <strong>DermaSys</strong>.</p>
                </div>
            </div>
        `;
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinatario: p.correo,
                    asunto: `Recordatorio de Cita (${formatearFecha(c.fecha_cita)}) | Dra. Doris Romero - DermaSys`,
                    html: htmlRecordatorio,
                    smtpEmail: creds.smtpEmail,
                    smtpPass: creds.smtpPass
                })
            });
            const data = await res.json();
            if (data.ok) {
                enviados++;
                await db.update('citas', c.id, { recordatorio_enviado: true });
            }
        } catch (e) {}
    }

    Swal.fire('Proceso Completado', `Se enviaron ${enviados} recordatorio(s) por correo electrónico para los próximos 2 días.`, 'success');
}

async function exportarAgendaCitasPDF() {
    const [citas, pacientes] = await Promise.all([
        db.getAll('citas', 'fecha_cita', true),
        db.getAll('pacientes')
    ]);
    const filas = citas.map((c, i) => {
        const p = pacientes.find(x => Number(x.id) === Number(c.paciente_id)) || {};
        return `
            <tr>
                <td>${i + 1}</td>
                <td class="fw-bold">${formatearFecha(c.fecha_cita)} ${esc(c.hora_cita || '')}</td>
                <td>${esc(p.nombre_apellido || '')}</td>
                <td>${esc(p.cedula || '')}</td>
                <td>${esc(p.telefono || '')}</td>
                <td>${esc(c.tipo || '')}</td>
                <td>${esc(c.estado || '')}</td>
            </tr>
        `;
    }).join('');

    const htmlSheet = `
        <div class="medical-sheet">
            <div class="sheet-header d-flex justify-content-between align-items-center">
                <div>
                    <h3 class="serif-brand fw-bold mb-0" style="font-size:1.65rem;color:#1e1b4b;letter-spacing:1px;">DRA. DORIS ROMERO</h3>
                    <div class="fw-bold" style="font-size:0.85rem;color:#6d28d9;letter-spacing:2px;text-transform:uppercase;">MEDICINA ESTÉTICA Y DERMATOLOGÍA</div>
                    <div class="text-muted" style="font-size:0.75rem;">M.P.P.S: 131642 &bull; C.M: 13750</div>
                </div>
                <div class="text-end">
                    <img src="img/logo_dr.svg" alt="Logo DR" style="height:68px;">
                </div>
            </div>
            <h4 class="text-center fw-bold mb-3" style="color:#1e1b4b;">REPORTE DE PACIENTES AGENDADOS</h4>
            <table class="table table-bordered table-sm small align-middle">
                <thead style="background:#1e1b4b;color:#fff;">
                    <tr>
                        <th>#</th>
                        <th>Fecha / Hora</th>
                        <th>Paciente</th>
                        <th>Cédula</th>
                        <th>Teléfono</th>
                        <th>Motivo / Tipo</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas || '<tr><td colspan="7" class="text-center">Sin citas agendadas</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
    document.getElementById('printSheetsContainer').innerHTML = htmlSheet;
    document.getElementById('btnVolverDePrint').onclick = () => navegarA('citas');
    navegarA('print');
}

async function guardarCitaExpress(e) {
    e.preventDefault();
    const nombre = document.getElementById('cita_exp_nombre').value.trim();
    const tel = document.getElementById('cita_exp_tel').value.trim();
    let cedula = document.getElementById('cita_exp_cedula').value.trim();
    if (!cedula) cedula = 'PROV-' + Math.floor(100000 + Math.random() * 900000);

    let dup = await db.buscarDuplicadoCedula(cedula);
    let pacId;
    if (dup) {
        pacId = dup.id;
    } else {
        const nuevo = await db.insert('pacientes', {
            cedula,
            cedula_normalizada: normalizarCedula(cedula),
            nombre_apellido: nombre,
            telefono: tel,
            sexo: 'Femenino',
            biotipo_cutaneo: 'Mixta',
            fototipo_fitzpatrick: 'III'
        });
        pacId = nuevo.id;
    }

    await db.insert('citas', {
        paciente_id: pacId,
        sede_id: 1,
        fecha_cita: document.getElementById('cita_exp_fecha').value,
        hora_cita: document.getElementById('cita_exp_hora').value,
        tipo: document.getElementById('cita_exp_tipo').value,
        estado: 'Agendada',
        notas: document.getElementById('cita_exp_notas').value.trim()
    });

    bootstrap.Modal.getInstance(document.getElementById('modalAgendarCita')).hide();
    await cargarAgendaCitas();
    Swal.fire('Cita Agendada', 'El paciente quedó registrado en la agenda.', 'success');
}

async function guardarCitaExistente(e) {
    e.preventDefault();
    await db.insert('citas', {
        paciente_id: Number(document.getElementById('cita_paciente_existente').value),
        sede_id: 1,
        fecha_cita: document.getElementById('cita_ex_fecha').value,
        hora_cita: document.getElementById('cita_ex_hora').value,
        tipo: document.getElementById('cita_ex_tipo').value,
        estado: 'Agendada',
        notas: document.getElementById('cita_ex_notas').value.trim()
    });
    bootstrap.Modal.getInstance(document.getElementById('modalAgendarCita')).hide();
    await cargarAgendaCitas();
}

// ==================== 10. COPILOTO IA GEMINI (DERMATOLOGÍA MULTIMODAL) ====================
async function analizarFotoConGemini(fotoId) {
    const fotos = await db.getAll('fotos_evolutivas');
    const f = fotos.find(x => Number(x.id) === Number(fotoId));
    if (!f) return;

    const { geminiKey } = db.getCreds();
    Swal.fire({ title: 'Analizando imagen con Gemini IA...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const base64Raw = f.imagen_base64.split(',')[1];
        const prompt = `Eres un Médico Dermatólogo y Especialista en Medicina Estética asistiendo a la Dra. Doris Romero.
Analiza clínicamente esta imagen (${f.titulo} - Zona: ${f.zona_anatomica}):
1. Describe las lesiones elementales visibles, textura cutánea, discromías o signos de fotoenvejecimiento.
2. Sugiere diagnósticos diferenciales dermatológicos.
3. Propón un protocolo dermo-cosmético (activos de día y noche) y procedimientos de consultorio sugeridos.
Responde en HTML conciso usando <strong> y <ul><li>.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: 'image/jpeg', data: base64Raw } }
                    ]
                }]
            })
        });
        const data = await res.json();
        const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Análisis completado.';
        await db.update('fotos_evolutivas', fotoId, { interpretacion_ia: texto });
        Swal.close();
        await cargarHistoriaPaciente(currentPatientId);
    } catch (err) {
        Swal.fire('Aviso IA', 'No se pudo conectar con Gemini en este momento.', 'warning');
    }
}

async function prepararCopilotoIA() {
    // Listo para consultas rápidas
}

async function enviarPreguntaCopiloto() {
    const preg = document.getElementById('iaPromptInput').value.trim();
    if (!preg) return;
    const { geminiKey } = db.getCreds();
    const out = document.getElementById('iaRespuestaBox');
    out.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-derma"></div><div class="small mt-2">Consultando literatura dermatológica y protocolos estéticos...</div></div>`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Eres el Copiloto Clínico en Dermatología y Medicina Estética de la Dra. Doris Romero (M.P.P.S 131642 | C.M 13750). Responde de forma estructurada, precisa y profesional a la siguiente consulta clínica: ${preg}`
                    }]
                }]
            })
        });
        const data = await res.json();
        const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
        out.innerHTML = `<div class="p-3 bg-white rounded border">${nl2br(txt)}</div>`;
    } catch (e) {
        out.innerHTML = `<div class="alert alert-warning">Verifique su conexión a internet para consultar al Copiloto IA.</div>`;
    }
}

// ==================== CONFIGURACIÓN SUPABASE CLOUD Y CORREO ====================
function abrirModalSupabase() {
    const creds = db.getCreds();
    document.getElementById('sb_url_input').value = creds.url;
    document.getElementById('sb_key_input').value = creds.key;
    if (document.getElementById('smtp_email_input')) {
        document.getElementById('smtp_email_input').value = creds.smtpEmail || '';
        document.getElementById('smtp_pass_input').value = creds.smtpPass || '';
    }
    new bootstrap.Modal(document.getElementById('modalConfigSupabase')).show();
}

function guardarConfigSupabase(e) {
    e.preventDefault();
    const url = document.getElementById('sb_url_input').value.trim();
    const key = document.getElementById('sb_key_input').value.trim();
    const smtpEmail = document.getElementById('smtp_email_input')?.value.trim() || '';
    const smtpPass = document.getElementById('smtp_pass_input')?.value.trim() || '';
    db.saveCreds(url, key, undefined, smtpEmail, smtpPass);
    actualizarIndicadorNube();
    bootstrap.Modal.getInstance(document.getElementById('modalConfigSupabase')).hide();
    Swal.fire('Configuración Guardada', db.isCloud ? 'Conectado a Supabase Cloud y Correo configurado.' : 'Configuración guardada (Operando en Modo Local).', 'success');
    cargarDashboard();
}

// Helpers de formato
function esc(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}
function nl2br(str) {
    return esc(str).replace(/\n/g, '<br>');
}
function formatearFecha(f) {
    if (!f) return '---';
    const parts = String(f).split('T')[0].split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : f;
}
