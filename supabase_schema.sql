-- ============================================================================
-- DermaSys | SISTEMA CLÍNICO DERMO-ESTÉTICO (SUPABASE POSTGRESQL SCHEMA)
-- Especialista: Dra. Doris Romero | Medicina Estética y Dermatología
-- M.P.P.S: 131642 | C.M: 13750
-- Instrucciones: Copie y pegue todo este script en "SQL Editor" de Supabase
-- y presione "RUN".
-- ============================================================================

-- 1. TABLA DE SEDES / CONSULTORIOS
CREATE TABLE IF NOT EXISTS public.sedes (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    direccion TEXT,
    telefono TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.sedes (id, nombre, direccion, telefono)
VALUES (1, 'Consultorio Principal - Dra. Doris Romero', 'Centro Médico / Unidad Dermo-Estética', '0414-0000000')
ON CONFLICT (id) DO NOTHING;

-- 2. TABLA DE PACIENTES (CON PERFIL DERMO-ESTÉTICO)
CREATE TABLE IF NOT EXISTS public.pacientes (
    id BIGSERIAL PRIMARY KEY,
    cedula TEXT NOT NULL UNIQUE,
    cedula_normalizada TEXT NOT NULL,
    nombre_apellido TEXT NOT NULL,
    edad INTEGER,
    sexo TEXT DEFAULT 'Femenino',
    fecha_nacimiento DATE,
    telefono TEXT,
    correo TEXT,
    direccion TEXT,
    ocupacion TEXT,
    sede_id BIGINT REFERENCES public.sedes(id) ON DELETE SET NULL,

    -- Perfil Cutáneo Dermo-Estético
    biotipo_cutaneo TEXT DEFAULT 'Mixta',          -- Eudérmica/Normal, Seca, Mixta, Grasa, Sensible/Rosácea
    fototipo_fitzpatrick TEXT DEFAULT 'III',       -- I, II, III, IV, V, VI
    escala_glogau TEXT DEFAULT 'I - Leve',         -- I, II, III, IV
    alergias_bool TEXT DEFAULT 'No',
    alergias_desc TEXT,
    queloide_tendencia TEXT DEFAULT 'No',          -- No, Sí, Desconoce
    usa_protector_solar TEXT DEFAULT 'Ocasional',  -- Diario, Ocasional, No usa
    exposicion_solar TEXT DEFAULT 'Moderada',

    -- Antecedentes Médicos y Estéticos
    ant_personales TEXT,
    ant_dermatologicos TEXT,                       -- Acné, Melasma, Rosácea, Dermatitis, Psoriasis, etc.
    procedimientos_previos TEXT,                   -- Toxina botulínica, Ác. Hialurónico, Bioestimuladores, Láser, Isotretinoína
    medicacion_actual TEXT,
    embarazo_lactancia TEXT DEFAULT 'No aplica',

    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pacientes_cedula_norm ON public.pacientes(cedula_normalizada);

-- 3. TABLA DE CONSULTAS Y PROCEDIMIENTOS DERMO-ESTÉTICOS
CREATE TABLE IF NOT EXISTS public.consultas (
    id BIGSERIAL PRIMARY KEY,
    paciente_id BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    fecha_consulta DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_consulta TEXT DEFAULT 'Primera Consulta', -- Primera Consulta, Control / Seguimiento, Procedimiento Estético

    -- Evaluación Clínica y Lesiones Elementales
    motivo_consulta TEXT,
    enfermedad_actual TEXT,
    lesiones_elementales TEXT,                     -- Máculas, Pápulas, Pústulas, Comedones, Nódulos, Melasma, Cicatrices, Ritides
    zonas_afectadas TEXT,                          -- Facial, Frontal, Glabelar, Periorbicular, Malar, Peribucal, Corporal, Capilar
    examen_dermatoscopico TEXT,
    diagnosticos TEXT,

    -- Procedimiento Realizado en Consultorio (Medicina Estética)
    procedimiento_realizado TEXT,                  -- Toxina Botulínica, Relleno Ác. Hialurónico, Peeling, Bioestimulador, PRP, etc.
    producto_lote_unidades TEXT,                   -- Marca, Lote, Fecha vencimiento, Unidades o ml aplicados por punto
    mapa_facial_data TEXT,                         -- Imagen PNG Base64 del Mapa Facial marcado con Apple Pencil / Dedo

    -- Prescripción Dermo-Cosmética (Skincare Día / Noche) y Farmacológica
    rutina_dia TEXT,                               -- Hoja Skincare Turno Día ☀️
    rutina_noche TEXT,                             -- Hoja Skincare Turno Noche 🌙
    tratamiento_farmacologico TEXT,                -- Récipe Médico (Oral / Tópico)
    cuidados_post_procedimiento TEXT,              -- Indicaciones post-toxina, post-peeling, post-relleno
    orden_laboratorio TEXT,                        -- Perfil hepático, lipídico, tiroideo, hormonal, biopsia

    proxima_consulta DATE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE GALERÍA FOTOGRÁFICA EVOLUTIVA (ANTES Y DESPUÉS + IA)
CREATE TABLE IF NOT EXISTS public.fotos_evolutivas (
    id BIGSERIAL PRIMARY KEY,
    paciente_id BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    consulta_id BIGINT REFERENCES public.consultas(id) ON DELETE SET NULL,
    etapa TEXT DEFAULT 'Antes (Inicial)',          -- Antes (Inicial), Control Intermedio, Después (Resultado), Estudio / Laboratorio
    zona_anatomica TEXT DEFAULT 'Rostro Completo',
    titulo TEXT NOT NULL,
    fecha_foto DATE NOT NULL DEFAULT CURRENT_DATE,
    imagen_base64 TEXT NOT NULL,                   -- Imagen optimizada (<180KB) o URL de Supabase Storage
    notas TEXT,
    interpretacion_ia TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA DE EGRESOS / ALTA DERMO-ESTÉTICA Y REPOSOS
CREATE TABLE IF NOT EXISTS public.egresos (
    id BIGSERIAL PRIMARY KEY,
    paciente_id BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    sede_id BIGINT REFERENCES public.sedes(id) ON DELETE SET NULL,
    fecha_egreso DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_atencion TEXT DEFAULT 'Procedimiento Ambulatorio',
    conducta_egreso TEXT NOT NULL,
    diagnosticos_egreso TEXT NOT NULL,
    nota_egreso TEXT NOT NULL,
    comentarios_internos TEXT,
    plan_tratamiento_egreso TEXT,
    recomendaciones_generales TEXT,
    reposo_medico TEXT DEFAULT 'No',
    reposo_dias INTEGER,
    reposo_desde DATE,
    reposo_hasta DATE,
    reposo_motivo TEXT,
    fecha_control DATE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE AGENDA DE CITAS
CREATE TABLE IF NOT EXISTS public.citas (
    id BIGSERIAL PRIMARY KEY,
    paciente_id BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    sede_id BIGINT REFERENCES public.sedes(id) ON DELETE SET NULL,
    fecha_cita DATE NOT NULL,
    hora_cita TEXT,
    tipo TEXT DEFAULT 'Primera Consulta',          -- Primera Consulta, Control Dermo, Procedimiento Estético
    estado TEXT DEFAULT 'Agendada',                -- Agendada, Confirmada, Completada, Cancelada
    notas TEXT,
    recordatorio_enviado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar permisos para la API de Supabase
ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_evolutivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso completo sedes" ON public.sedes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo pacientes" ON public.pacientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo consultas" ON public.consultas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo fotos" ON public.fotos_evolutivas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo egresos" ON public.egresos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso completo citas" ON public.citas FOR ALL USING (true) WITH CHECK (true);
