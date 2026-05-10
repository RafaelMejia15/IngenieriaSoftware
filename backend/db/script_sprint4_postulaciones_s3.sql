-- Sprint 4: postulaciones, documentos (metadatos) y soporte evidencias-almacenamiento S3 (bucket en aplicación).

CREATE TABLE IF NOT EXISTS postulacion (
    id_postulacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_convocatoria UUID NOT NULL REFERENCES convocatoria (id_convocatoria) ON DELETE CASCADE,
    id_usuario UUID NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    estado VARCHAR(32) NOT NULL DEFAULT 'RECIBIDA',
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT postulacion_estado_chk CHECK (
        estado IN ('RECIBIDA', 'EN_REVISION', 'ACEPTADA', 'RECHAZADA')
    ),
    CONSTRAINT postulacion_unica_por_convocatoria_usuario UNIQUE (id_convocatoria, id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_postulacion_usuario ON postulacion (id_usuario);
CREATE INDEX IF NOT EXISTS idx_postulacion_convocatoria ON postulacion (id_convocatoria);

CREATE TABLE IF NOT EXISTS postulacion_documento (
    id_postulacion_documento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_postulacion UUID NOT NULL REFERENCES postulacion (id_postulacion) ON DELETE CASCADE,
    id_requisito UUID NOT NULL REFERENCES catalogo_requisito (id_requisito) ON DELETE RESTRICT,
    s3_bucket VARCHAR(255) NOT NULL,
    s3_key TEXT NOT NULL,
    nombre_original VARCHAR(512) NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    estado_validacion VARCHAR(32) NOT NULL DEFAULT 'PENDIENTE',
    subido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT postulacion_doc_validacion_chk CHECK (
        estado_validacion IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA')
    ),
    CONSTRAINT postulacion_doc_unico_requisito UNIQUE (id_postulacion, id_requisito)
);

CREATE INDEX IF NOT EXISTS idx_postulacion_documento_postulacion
    ON postulacion_documento (id_postulacion);
