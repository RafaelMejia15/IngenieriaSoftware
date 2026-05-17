-- Sprint 5: INACTIVA en convocatorias, ciclo de vida del expediente, hash/version en documentos, historial.

-- RF-06: estado INACTIVA en convocatoria
ALTER TABLE convocatoria DROP CONSTRAINT IF EXISTS convocatoria_estado_chk;
ALTER TABLE convocatoria ADD CONSTRAINT convocatoria_estado_chk CHECK (
    estado IN ('ABIERTA', 'INACTIVA', 'EN_EVALUACION', 'CERRADA_DICTAMINADA', 'DESIERTA')
);

UPDATE convocatoria
SET estado = 'INACTIVA'
WHERE estado = 'ABIERTA' AND fecha_fin < NOW();

-- RF-12 / RF-13: estados del expediente (postulacion)
UPDATE postulacion SET estado = 'EN_INTEGRACION' WHERE estado = 'RECIBIDA';
UPDATE postulacion SET estado = 'ACEPTADO' WHERE estado = 'ACEPTADA';
UPDATE postulacion SET estado = 'DESESTIMADO' WHERE estado = 'RECHAZADA';

ALTER TABLE postulacion DROP CONSTRAINT IF EXISTS postulacion_estado_chk;
ALTER TABLE postulacion ADD CONSTRAINT postulacion_estado_chk CHECK (
    estado IN (
        'EN_INTEGRACION',
        'ENVIADO',
        'EN_REVISION',
        'CON_OBSERVACIONES',
        'ACEPTADO',
        'DESESTIMADO'
    )
);

ALTER TABLE postulacion ALTER COLUMN estado SET DEFAULT 'EN_INTEGRACION';

ALTER TABLE postulacion
    ADD COLUMN IF NOT EXISTS enviada_en TIMESTAMPTZ;

-- RF-09 / RF-10: hash y versionado en documentos
ALTER TABLE postulacion_documento
    ADD COLUMN IF NOT EXISTS contenido_hash VARCHAR(64);

UPDATE postulacion_documento
SET contenido_hash = repeat('0', 64)
WHERE contenido_hash IS NULL;

ALTER TABLE postulacion_documento
    ALTER COLUMN contenido_hash SET NOT NULL;

ALTER TABLE postulacion_documento
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_postulacion_documento_hash
    ON postulacion_documento (id_postulacion, contenido_hash);

-- RF-13: auditoría de transiciones
CREATE TABLE IF NOT EXISTS postulacion_estado_historial (
    id_historial UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_postulacion UUID NOT NULL REFERENCES postulacion (id_postulacion) ON DELETE CASCADE,
    estado_anterior VARCHAR(32) NOT NULL,
    estado_nuevo VARCHAR(32) NOT NULL,
    id_usuario_actor UUID REFERENCES usuario (id_usuario) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    motivo TEXT
);

CREATE INDEX IF NOT EXISTS idx_postulacion_historial_postulacion
    ON postulacion_estado_historial (id_postulacion, creado_en DESC);
