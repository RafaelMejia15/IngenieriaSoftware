-- Sprint 6: validación documental, dictamen, auditoría aplicación, rol soporte_ti.

INSERT INTO rol (nombre, descripcion)
SELECT 'soporte_ti', 'Soporte técnico – consulta auditoría'
WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'soporte_ti');

-- Usuario de prueba soporte (password hash igual a admin@admin.com en maestro)
WITH rol_soporte AS (
    SELECT id_rol FROM rol WHERE nombre = 'soporte_ti' LIMIT 1
)
INSERT INTO usuario (id_rol, correo, password_hash, esta_activo)
SELECT
    r.id_rol,
    'soporte@soporte.com',
    '$2b$12$imu2hwlLpvax/XtTNK3XUuanFBGPvRPsLw1sEO84WsjUuU2Q8x57i',
    TRUE
FROM rol_soporte r
WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE correo = 'soporte@soporte.com');

ALTER TABLE postulacion
    ADD COLUMN IF NOT EXISTS cerrada_en TIMESTAMPTZ;

ALTER TABLE postulacion_documento
    ADD COLUMN IF NOT EXISTS comentario_observacion TEXT;
ALTER TABLE postulacion_documento
    ADD COLUMN IF NOT EXISTS validado_en TIMESTAMPTZ;
ALTER TABLE postulacion_documento
    ADD COLUMN IF NOT EXISTS id_usuario_validador UUID REFERENCES usuario (id_usuario) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS postulacion_documento_validacion_historial (
    id_historial UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_postulacion_documento UUID NOT NULL REFERENCES postulacion_documento (id_postulacion_documento) ON DELETE CASCADE,
    estado_anterior VARCHAR(32) NOT NULL,
    estado_nuevo VARCHAR(32) NOT NULL,
    comentario VARCHAR(500),
    id_usuario_actor UUID REFERENCES usuario (id_usuario) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_validacion_hist_doc
    ON postulacion_documento_validacion_historial (id_postulacion_documento, creado_en DESC);

CREATE TABLE IF NOT EXISTS auditoria_evento (
    id_evento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID REFERENCES usuario (id_usuario) ON DELETE SET NULL,
    accion VARCHAR(64) NOT NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip VARCHAR(45),
    detalle JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_registrado ON auditoria_evento (registrado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria_evento (accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria_evento (id_usuario);

UPDATE postulacion
SET cerrada_en = COALESCE(enviada_en, creada_en)
WHERE estado IN ('ACEPTADO', 'DESESTIMADO') AND cerrada_en IS NULL;
