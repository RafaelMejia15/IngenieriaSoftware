-- Creamos la tabla 'rol' con UUID
CREATE TABLE rol (
    id_rol UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT
);

-- Creamos la tabla 'usuario' con UUID y actualizamos la clave foránea
CREATE TABLE usuario (
    id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_rol UUID NOT NULL, -- La clave foránea también DEBE ser de tipo UUID
    correo VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    esta_activo BOOLEAN DEFAULT FALSE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    token_verificacion VARCHAR(64) UNIQUE,
    token_verificacion_expira TIMESTAMPTZ,
    token_recuperacion VARCHAR(64) UNIQUE,
    token_recuperacion_expira TIMESTAMPTZ,
    
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
);





WITH 
-- 1. Insertamos el rol 'admin' si no existe y capturamos su ID
inserted_admin_rol AS (
    INSERT INTO rol (nombre, descripcion)
    SELECT 'admin', 'Administrador del sistema'
    WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'admin')
    RETURNING id_rol
),
admin_rol AS (
    SELECT id_rol FROM inserted_admin_rol
    UNION ALL
    SELECT id_rol FROM rol WHERE nombre = 'admin'
    LIMIT 1
),

-- 2. Insertamos el rol 'usuario' si no existe y capturamos su ID
inserted_usuario_rol AS (
    INSERT INTO rol (nombre, descripcion)
    SELECT 'usuario', 'Usuario estándar'
    WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'usuario')
    RETURNING id_rol
),
usuario_rol AS (
    SELECT id_rol FROM inserted_usuario_rol
    UNION ALL
    SELECT id_rol FROM rol WHERE nombre = 'usuario'
    LIMIT 1
),

-- 3. Preparamos los datos de los usuarios que queremos insertar
nuevos_usuarios AS (
    SELECT 
        (SELECT id_rol FROM usuario_rol) AS id_rol, 
        'usuario@usuario.com' AS correo, 
        '$2b$12$imu2hwlLpvax/XtTNK3XUuanFBGPvRPsLw1sEO84WsjUuU2Q8x57i' AS password_hash
    UNION ALL
    SELECT 
        (SELECT id_rol FROM admin_rol) AS id_rol, 
        'admin@admin.com' AS correo, 
        '$2b$12$imu2hwlLpvax/XtTNK3XUuanFBGPvRPsLw1sEO84WsjUuU2Q8x57i' AS password_hash
)

-- 4. Ejecutamos un UNICO INSERT para ambos usuarios mapeando todo dentro del mismo bloque WITH
INSERT INTO usuario (id_rol, correo, password_hash, esta_activo)
SELECT nu.id_rol, nu.correo, nu.password_hash, TRUE
FROM nuevos_usuarios nu    
WHERE NOT EXISTS (
    SELECT 1 FROM usuario u WHERE u.correo = nu.correo
);




CREATE OR REPLACE FUNCTION sp_obtener_usuario_login(p_correo VARCHAR)
RETURNS TABLE (
    id_usuario UUID,
    password_hash VARCHAR,
    esta_activo BOOLEAN,
    nombre_rol VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id_usuario, 
        u.password_hash, 
        u.esta_activo, 
        r.nombre
    FROM usuario u
    INNER JOIN rol r ON u.id_rol = r.id_rol
    WHERE u.correo = p_correo;
END;
$$;

CREATE OR REPLACE FUNCTION sp_registrar_usuario(
    p_correo VARCHAR,
    p_password_hash VARCHAR,
    p_nombre_rol VARCHAR,
    p_token_verificacion VARCHAR,
    p_token_expira TIMESTAMPTZ
)
RETURNS TABLE (
    id_usuario UUID,
    password_hash VARCHAR,
    esta_activo BOOLEAN,
    nombre_rol VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_rol UUID;
    v_id_usuario UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM usuario WHERE correo = p_correo) THEN
        RAISE EXCEPTION 'El correo ya está registrado'
            USING ERRCODE = '23505';
    END IF;

    SELECT r.id_rol INTO v_id_rol
    FROM rol r
    WHERE r.nombre = p_nombre_rol
    LIMIT 1;

    IF v_id_rol IS NULL THEN
        RAISE EXCEPTION 'Rol no válido'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO usuario (
        id_rol, correo, password_hash, esta_activo,
        token_verificacion, token_verificacion_expira
    )
    VALUES (
        v_id_rol, p_correo, p_password_hash, FALSE,
        p_token_verificacion, p_token_expira
    )
    RETURNING usuario.id_usuario INTO v_id_usuario;

    RETURN QUERY
    SELECT
        u.id_usuario,
        u.password_hash,
        u.esta_activo,
        r.nombre
    FROM usuario u
    INNER JOIN rol r ON u.id_rol = r.id_rol
    WHERE u.id_usuario = v_id_usuario;
END;
$$;

CREATE OR REPLACE FUNCTION sp_validar_usuario(p_token VARCHAR)
RETURNS TABLE (
    id_usuario UUID,
    nombre_rol VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    UPDATE usuario
    SET
        esta_activo = TRUE,
        token_verificacion = NULL,
        token_verificacion_expira = NULL
    WHERE token_verificacion = p_token
      AND token_verificacion_expira IS NOT NULL
      AND token_verificacion_expira > NOW()
    RETURNING usuario.id_usuario INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido o expirado'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT u.id_usuario, r.nombre AS nombre_rol
    FROM usuario u
    INNER JOIN rol r ON u.id_rol = r.id_rol
    WHERE u.id_usuario = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION sp_solicitar_recuperacion_contrasena(
    p_correo VARCHAR,
    p_token VARCHAR,
    p_token_expira TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    n int;
BEGIN
    UPDATE usuario
    SET
        token_recuperacion = p_token,
        token_recuperacion_expira = p_token_expira
    WHERE lower(trim(correo)) = lower(trim(p_correo));

    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n > 0;
END;
$$;

CREATE OR REPLACE FUNCTION sp_restablecer_contrasena(
    p_token VARCHAR,
    p_password_hash VARCHAR
)
RETURNS TABLE (
    id_usuario UUID,
    nombre_rol VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    UPDATE usuario
    SET
        password_hash = p_password_hash,
        token_recuperacion = NULL,
        token_recuperacion_expira = NULL
    WHERE token_recuperacion = p_token
      AND token_recuperacion_expira IS NOT NULL
      AND token_recuperacion_expira > NOW()
    RETURNING usuario.id_usuario INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Token de recuperación inválido o expirado'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT u.id_usuario, r.nombre AS nombre_rol
    FROM usuario u
    INNER JOIN rol r ON u.id_rol = r.id_rol
    WHERE u.id_usuario = v_id;
END;
$$;





-- v2: verificación por correo (migrar BD existente; ejecutar una sola vez)
ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS token_verificacion VARCHAR(64);
ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS token_verificacion_expira TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_token_verificacion
    ON usuario (token_verificacion)
    WHERE token_verificacion IS NOT NULL;

CREATE OR REPLACE FUNCTION sp_registrar_usuario(
    p_correo VARCHAR,
    p_password_hash VARCHAR,
    p_nombre_rol VARCHAR,
    p_token_verificacion VARCHAR,
    p_token_expira TIMESTAMPTZ
)
RETURNS TABLE (
    id_usuario UUID,
    password_hash VARCHAR,
    esta_activo BOOLEAN,
    nombre_rol VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_rol UUID;
    v_id_usuario UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM usuario WHERE correo = p_correo) THEN
        RAISE EXCEPTION 'El correo ya está registrado'
            USING ERRCODE = '23505';
    END IF;

    SELECT r.id_rol INTO v_id_rol
    FROM rol r
    WHERE r.nombre = p_nombre_rol
    LIMIT 1;

    IF v_id_rol IS NULL THEN
        RAISE EXCEPTION 'Rol no válido'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO usuario (
        id_rol, correo, password_hash, esta_activo,
        token_verificacion, token_verificacion_expira
    )
    VALUES (
        v_id_rol, p_correo, p_password_hash, FALSE,
        p_token_verificacion, p_token_expira
    )
    RETURNING usuario.id_usuario INTO v_id_usuario;

    RETURN QUERY
    SELECT
        u.id_usuario,
        u.password_hash,
        u.esta_activo,
        r.nombre
    FROM usuario u
    INNER JOIN rol r ON u.id_rol = r.id_rol
    WHERE u.id_usuario = v_id_usuario;
END;
$$;

CREATE OR REPLACE FUNCTION sp_validar_usuario(p_token VARCHAR)
RETURNS TABLE (
    id_usuario UUID,
    nombre_rol VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    UPDATE usuario
    SET
        esta_activo = TRUE,
        token_verificacion = NULL,
        token_verificacion_expira = NULL
    WHERE token_verificacion = p_token
      AND token_verificacion_expira IS NOT NULL
      AND token_verificacion_expira > NOW()
    RETURNING usuario.id_usuario INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido o expirado'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT u.id_usuario, r.nombre AS nombre_rol
    FROM usuario u
    INNER JOIN rol r ON u.id_rol = r.id_rol
    WHERE u.id_usuario = v_id;
END;
$$;

-- v3: tokens de recuperación de contraseña (ejecutar una vez en BD existente)

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS token_recuperacion VARCHAR(64);
ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS token_recuperacion_expira TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_token_recuperacion
    ON usuario (token_recuperacion)
    WHERE token_recuperacion IS NOT NULL;

CREATE OR REPLACE FUNCTION sp_solicitar_recuperacion_contrasena(
    p_correo VARCHAR,
    p_token VARCHAR,
    p_token_expira TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    n int;
BEGIN
    UPDATE usuario
    SET
        token_recuperacion = p_token,
        token_recuperacion_expira = p_token_expira
    WHERE lower(trim(correo)) = lower(trim(p_correo));

    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n > 0;
END;
$$;

CREATE OR REPLACE FUNCTION sp_restablecer_contrasena(
    p_token VARCHAR,
    p_password_hash VARCHAR
)
RETURNS TABLE (
    id_usuario UUID,
    nombre_rol VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    UPDATE usuario
    SET
        password_hash = p_password_hash,
        token_recuperacion = NULL,
        token_recuperacion_expira = NULL
    WHERE token_recuperacion = p_token
      AND token_recuperacion_expira IS NOT NULL
      AND token_recuperacion_expira > NOW()
    RETURNING usuario.id_usuario INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Token de recuperación inválido o expirado'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT u.id_usuario, r.nombre AS nombre_rol
    FROM usuario u
    INNER JOIN rol r ON u.id_rol = r.id_rol
    WHERE u.id_usuario = v_id;
END;
$$;



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
