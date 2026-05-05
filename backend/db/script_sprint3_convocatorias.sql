-- Sprint 3: catálogo de requisitos, convocatorias (vacantes) y vínculo N:M
-- Requisitos: subconjunto estable alineado con CATALOGO REQUISITOS SISED (códigos P01…).

CREATE TABLE IF NOT EXISTS catalogo_requisito (
    id_requisito UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(32) NOT NULL UNIQUE,
    nombre VARCHAR(500) NOT NULL,
    descripcion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS convocatoria (
    id_convocatoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    estado VARCHAR(32) NOT NULL DEFAULT 'ABIERTA',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    id_usuario_creador UUID,
    CONSTRAINT convocatoria_estado_chk CHECK (
        estado IN ('ABIERTA', 'EN_EVALUACION', 'CERRADA_DICTAMINADA', 'DESIERTA')
    ),
    CONSTRAINT convocatoria_fechas_chk CHECK (fecha_inicio <= fecha_fin),
    CONSTRAINT convocatoria_usuario_fk FOREIGN KEY (id_usuario_creador)
        REFERENCES usuario (id_usuario) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_convocatoria_fechas_estado
    ON convocatoria (estado, fecha_inicio, fecha_fin);

CREATE TABLE IF NOT EXISTS convocatoria_requisito (
    id_convocatoria UUID NOT NULL REFERENCES convocatoria (id_convocatoria) ON DELETE CASCADE,
    id_requisito UUID NOT NULL REFERENCES catalogo_requisito (id_requisito) ON DELETE RESTRICT,
    obligatorio BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_convocatoria, id_requisito)
);

-- Seed catálogo (subconjunto; descripciones resumidas)
INSERT INTO catalogo_requisito (codigo, nombre, descripcion) VALUES
    ('P01', 'ESCOLARIDAD', 'Título o grado o documento comprobatorio de escolaridad.')
   ,('P02', 'CEDULA_PROF', 'Cédula profesional.')
   ,('P03', 'CERT_ESTUD__CART_PAS', 'Certificado de estudios o carta pasante.')
   ,('P04', 'HORARIO_ACT', 'Horario de actividades del semestre anterior y actual.')
   ,('P05', 'LIBERACION_ACT', 'Hoja de liberación de actividades del último semestre concluido.')
   ,('P06', 'TALONES_PAGO', 'Talón(es) de pago de la última quincena.')
   ,('P07', 'CONSTANCIA_NOMB', 'Constancia(s) de nombramiento(s) de la(s) clave(s) a promover.')
   ,('P08', 'AUTORIZACION_SABATICO', 'Oficio de autorización (año sabático).')
   ,('P09', 'ELABORACION_APUNTES', 'Elaboración de apuntes (evidencias según lineamientos).')
   ,('P10', 'ELABORACION_TEXTOS', 'Elaboración de textos o material académico.')
ON CONFLICT (codigo) DO NOTHING;
