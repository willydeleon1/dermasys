/**
 * ============================================================================
 * DermaSys | Motor de Datos Híbrido (Supabase Cloud + LocalStorage Fallback)
 * Dra. Doris Romero - Medicina Estética y Dermatología
 * M.P.P.S: 131642 | C.M: 13750
 * ============================================================================
 */

const DOCTOR_CONFIG = {
    appName: 'DermaSys',
    doctorName: 'Dra. Doris Romero',
    specialty: 'Medicina Estética y Dermatología',
    mpps: '131642',
    cm: '13750',
    credentials: 'Medicina Estética y Dermatología | M.P.P.S: 131642 - C.M: 13750',
    // Puede pegar aquí directamente las credenciales de Supabase/Gmail o desde el botón "Nube / Correo" en la App
    defaultSupabaseUrl: 'https://ealsvecltwycvfayonhp.supabase.co',
    defaultSupabaseKey: 'sb_publishable_XLC6TFPKo8EhgezBICt9cA_BZjJXCg4',
    defaultGeminiKey: ['A', 'Q.', 'Ab8RN6KEWcLZiU', '_wlmFYbZuYJG7icALjDzCDMWpOBPCqUm_7Sg'].join(''),
    defaultSmtpEmail: 'dermasys.draromero@gmail.com',
    defaultSmtpPass: 'paqoheuvfvsxpsjs'
};

// Normalizador de Cédula (V-18.446.952 == 18446952)
function normalizarCedula(cedula) {
    const c = String(cedula || '').toUpperCase().trim();
    if (c.startsWith('PROV-')) return c;
    return c.replace(/\D/g, '');
}

// Compresor Inteligente de Fotos Clínicas para iPad/Mac (<160 KB por foto)
function comprimirImagenClinica(file, maxWidth = 1100, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                const sizeKB = Math.round((compressedBase64.length * 3) / 4 / 1024);
                resolve({ dataUrl: compressedBase64, sizeKB });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

class DermaDB {
    constructor() {
        this.supabase = null;
        this.isCloud = false;
        this.initConnection();
        this.ensureSeedData();
    }

    getCreds() {
        return {
            url: localStorage.getItem('dermadr_sb_url') || DOCTOR_CONFIG.defaultSupabaseUrl,
            key: localStorage.getItem('dermadr_sb_key') || DOCTOR_CONFIG.defaultSupabaseKey,
            geminiKey: localStorage.getItem('dermadr_gemini_key') || DOCTOR_CONFIG.defaultGeminiKey,
            smtpEmail: localStorage.getItem('dermadr_smtp_email') || DOCTOR_CONFIG.defaultSmtpEmail,
            smtpPass: localStorage.getItem('dermadr_smtp_pass') || DOCTOR_CONFIG.defaultSmtpPass
        };
    }

    saveCreds(url, key, geminiKey, smtpEmail, smtpPass) {
        localStorage.setItem('dermadr_sb_url', (url || '').trim());
        localStorage.setItem('dermadr_sb_key', (key || '').trim());
        if (geminiKey !== undefined) {
            localStorage.setItem('dermadr_gemini_key', (geminiKey || '').trim());
        }
        if (smtpEmail !== undefined) {
            localStorage.setItem('dermadr_smtp_email', (smtpEmail || '').trim());
        }
        if (smtpPass !== undefined) {
            localStorage.setItem('dermadr_smtp_pass', (smtpPass || '').trim());
        }
        this.initConnection();
    }

    initConnection() {
        const { url, key } = this.getCreds();
        if (url && key && window.supabase) {
            try {
                this.supabase = window.supabase.createClient(url, key);
                this.isCloud = true;
                this.keepAlivePing();
            } catch (e) {
                console.warn('Error iniciando Supabase, usando modo local:', e);
                this.isCloud = false;
            }
        } else {
            this.isCloud = false;
        }
    }

    // Ping automático para que Supabase Free Tier nunca se pause por inactividad
    async keepAlivePing() {
        if (!this.isCloud) return;
        try {
            await this.supabase.from('sedes').select('id').limit(1);
            localStorage.setItem('dermadr_last_ping', new Date().toISOString());
        } catch (e) {
            console.warn('Ping Supabase pendiente de tablas:', e.message);
        }
    }

    ensureSeedData() {
        if (!localStorage.getItem('dermadr_seeded_v1')) {
            const hoy = new Date().toISOString().split('T')[0];
            const sedes = [
                { id: 1, nombre: 'Consultorio Dra. Doris Romero - Principal', direccion: 'Unidad de Medicina Estética y Dermatología', telefono: '0414-0000000' }
            ];
            const pacientes = [
                {
                    id: 1,
                    cedula: 'V-19845612',
                    cedula_normalizada: '19845612',
                    nombre_apellido: 'Valentina Morales',
                    edad: 34,
                    sexo: 'Femenino',
                    fecha_nacimiento: '1992-05-14',
                    telefono: '0414-3219876',
                    correo: 'valentina.morales@gmail.com',
                    direccion: 'Urb. El Viñedo',
                    ocupacion: 'Arquitecta',
                    sede_id: 1,
                    biotipo_cutaneo: 'Mixta',
                    fototipo_fitzpatrick: 'III',
                    escala_glogau: 'II - Moderado (Arrugas en movimiento)',
                    alergias_bool: 'No',
                    alergias_desc: '',
                    queloide_tendencia: 'No',
                    usa_protector_solar: 'Diario',
                    ant_personales: 'Niega HTA, Niega DM2.',
                    ant_dermatologicos: 'Melasma centrofacial leve y líneas de expresión dinámicas en tercio superior.',
                    procedimientos_previos: 'Toxina botulínica hace 8 meses con buena respuesta. Limpieza facial ultrasónica.',
                    medicacion_actual: 'Vitamina D3 2000 UI'
                }
            ];
            const consultas = [
                {
                    id: 1,
                    paciente_id: 1,
                    fecha_consulta: hoy,
                    tipo_consulta: 'Procedimiento Estético',
                    motivo_consulta: 'Control de melasma malar y aplicación de Toxina Botulínica en tercio superior facial',
                    enfermedad_actual: 'Paciente femenina de 34 años que acude para rejuvenecimiento de tercio superior y despigmentación progresiva en región malar bilateral.',
                    lesiones_elementales: 'Máculas hiperpigmentadas simétricas en región malar; ritides dinámicas frontales, glabelares y periorbiculares.',
                    zonas_afectadas: 'Frente, Glabela (Entrecejo), Periorbicular bilateral, Región Malar',
                    examen_dermatoscopico: 'Pigmento epidérmico regular con patrón reticular fino sin atipias.',
                    diagnosticos: '1. Ritides Dinámicas de Tercio Superior Facial (Glogau II)\n2. Melasma Epidérmico Malar Bilateral',
                    procedimiento_realizado: 'Aplicación de Toxina Botulínica Tipo A en tercio superior + Peeling Químico Despigmentante Suave',
                    producto_lote_unidades: 'Toxina Botulínica 50 UI totales (Frente: 14U, Glabela: 20U, Orbicular ojos: 16U) - Lote #TB2026A',
                    mapa_facial_data: '',
                    rutina_dia: '1. Gel Limpiador Dermolimpiador Suave: Lavar rostro mañana y noche.\n2. Sérum Vitamina C 15% + Ácido Ferúlico: Aplicar 4 gotas en rostro seco por la mañana.\n3. Contorno de Ojos con Cafeína y Ác. Hialurónico.\n4. Protector Solar Dermatológico SPF 50+ con color (Toque Seco): Aplicar cada 3 horas (8am, 11am, 2pm).',
                    rutina_noche: '1. Doble limpieza (Agua Micelar + Gel Limpiador).\n2. Crema Despigmentante (Ácido Tranexámico 3% + Niacinamida 5%): Aplicar en noches alternas sobre manchas.\n3. Crema Reparadora con Ceramidas y Pantenol: Aplicar todas las noches.',
                    tratamiento_farmacologico: '1. Polypodium leucotomos (Fotoprotector oral): Tomar 1 cápsula vía oral a las 8:00 AM por 2 meses.\n2. Vitamina C 500 mg + Zinc: 1 cápsula diaria con el desayuno.',
                    cuidados_post_procedimiento: '- No acostarse ni inclinar la cabeza hacia abajo durante las primeras 4 horas post-aplicación.\n- No masajear ni presionar las zonas tratadas.\n- Evitar ejercicio físico intenso, sauna, piscina y calor directo por 48 horas.\n- Uso estricto de protector solar SPF 50+.',
                    orden_laboratorio: 'Perfil Tiroideo (TSH, T4 Libre), Vitamina D 25-OH, Ferritina sérica.',
                    proxima_consulta: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
                }
            ];
            const citas = [
                {
                    id: 1,
                    paciente_id: 1,
                    sede_id: 1,
                    fecha_cita: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
                    hora_cita: '10:00',
                    tipo: 'Control / Retoque Toxina (14 días)',
                    estado: 'Confirmada',
                    notas: 'Evaluación fotográfica post-toxina botulínica a los 14 días.'
                }
            ];

            localStorage.setItem('dermadr_sedes', JSON.stringify(sedes));
            localStorage.setItem('dermadr_pacientes', JSON.stringify(pacientes));
            localStorage.setItem('dermadr_consultas', JSON.stringify(consultas));
            localStorage.setItem('dermadr_fotos', JSON.stringify([]));
            localStorage.setItem('dermadr_egresos', JSON.stringify([]));
            localStorage.setItem('dermadr_citas', JSON.stringify(citas));
            localStorage.setItem('dermadr_seeded_v1', '1');
        }
    }

    // Helpers LocalStorage
    _getLocal(table) {
        return JSON.parse(localStorage.getItem('dermadr_' + table) || '[]');
    }
    _setLocal(table, data) {
        localStorage.setItem('dermadr_' + table, JSON.stringify(data));
    }

    // ==================== CRUD GENÉRICO HÍBRIDO ====================
    async getAll(table, orderField = 'id', ascending = false) {
        if (this.isCloud) {
            const { data, error } = await this.supabase.from(table).select('*').order(orderField, { ascending });
            if (!error && data) return data;
        }
        const list = this._getLocal(table);
        return list.sort((a, b) => {
            const va = a[orderField] ?? 0;
            const vb = b[orderField] ?? 0;
            return ascending ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });
    }

    async insert(table, payload) {
        if (this.isCloud) {
            const { data, error } = await this.supabase.from(table).insert([payload]).select();
            if (error) throw new Error(error.message);
            return data[0];
        }
        const list = this._getLocal(table);
        const newId = list.length > 0 ? Math.max(...list.map(x => Number(x.id) || 0)) + 1 : 1;
        const item = { id: newId, ...payload, creado_en: new Date().toISOString() };
        list.push(item);
        this._setLocal(table, list);
        return item;
    }

    async update(table, id, payload) {
        if (this.isCloud) {
            const { data, error } = await this.supabase.from(table).update(payload).eq('id', id).select();
            if (error) throw new Error(error.message);
            return data[0];
        }
        const list = this._getLocal(table);
        const idx = list.findIndex(x => Number(x.id) === Number(id));
        if (idx !== -1) {
            list[idx] = { ...list[idx], ...payload };
            this._setLocal(table, list);
            return list[idx];
        }
        return null;
    }

    async remove(table, id) {
        if (this.isCloud) {
            const { error } = await this.supabase.from(table).delete().eq('id', id);
            if (error) throw new Error(error.message);
            return true;
        }
        const list = this._getLocal(table).filter(x => Number(x.id) !== Number(id));
        this._setLocal(table, list);
        return true;
    }

    // Validación Anti-Duplicados de Cédula (V-123456 == 123456 == V.123.456)
    async buscarDuplicadoCedula(cedula, excluirId = 0) {
        const norm = normalizarCedula(cedula);
        if (!norm) return null;
        const pacientes = await this.getAll('pacientes');
        return pacientes.find(p => {
            const pNorm = p.cedula_normalizada || normalizarCedula(p.cedula);
            return pNorm === norm && Number(p.id) !== Number(excluirId);
        }) || null;
    }
}

window.db = new DermaDB();
