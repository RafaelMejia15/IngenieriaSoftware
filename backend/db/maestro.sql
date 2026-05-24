CREATE DATABASE automecture_database
    OWNER automecture_user
    ENCODING 'UTF8'
    TEMPLATE template0;

-- Requiere cliente psql: el resto del script corre dentro de la BD nueva.
\connect automecture_database

-- =============================================================================
-- Esquema y datos (schema public)
-- =============================================================================

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

-- Bitácora (auditoría) por tabla: espejo de columnas + metadatos de operación.
-- Ejecutar después de maestro.sql / sprints en BD existente.
-- Las tablas bitacora_* no tienen triggers (evita recursión).

-- ---------------------------------------------------------------------------
-- Utilidad: usuario de aplicación opcional vía SET LOCAL app.id_usuario = '...'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bitacora_usuario_app()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(NULLIF(current_setting('app.id_usuario', true), ''), SESSION_USER);
$$;

-- ---------------------------------------------------------------------------
-- rol
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora_rol (
    id_bitacora UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_db TEXT NOT NULL DEFAULT SESSION_USER,
    id_usuario_app TEXT,
    registro_anterior JSONB,
    id_rol UUID,
    nombre VARCHAR(255),
    descripcion TEXT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_rol_registrado ON bitacora_rol (registrado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_rol_id_rol ON bitacora_rol (id_rol);

CREATE OR REPLACE FUNCTION fn_bitacora_rol()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO bitacora_rol (
            operacion, id_usuario_app, id_rol, nombre, descripcion
        ) VALUES (
            'INSERT', fn_bitacora_usuario_app(), NEW.id_rol, NEW.nombre, NEW.descripcion
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO bitacora_rol (
            operacion, id_usuario_app, registro_anterior, id_rol, nombre, descripcion
        ) VALUES (
            'UPDATE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            NEW.id_rol, NEW.nombre, NEW.descripcion
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO bitacora_rol (
            operacion, id_usuario_app, registro_anterior, id_rol, nombre, descripcion
        ) VALUES (
            'DELETE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            OLD.id_rol, OLD.nombre, OLD.descripcion
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_rol ON rol;
CREATE TRIGGER trg_bitacora_rol
    AFTER INSERT OR UPDATE OR DELETE ON rol
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_rol();

-- ---------------------------------------------------------------------------
-- usuario
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora_usuario (
    id_bitacora UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_db TEXT NOT NULL DEFAULT SESSION_USER,
    id_usuario_app TEXT,
    registro_anterior JSONB,
    id_usuario UUID,
    id_rol UUID,
    correo VARCHAR(255),
    password_hash VARCHAR(255),
    esta_activo BOOLEAN,
    fecha_registro TIMESTAMP,
    token_verificacion VARCHAR(64),
    token_verificacion_expira TIMESTAMPTZ,
    token_recuperacion VARCHAR(64),
    token_recuperacion_expira TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bitacora_usuario_registrado ON bitacora_usuario (registrado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario_id ON bitacora_usuario (id_usuario);

CREATE OR REPLACE FUNCTION fn_bitacora_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO bitacora_usuario (
            operacion, id_usuario_app,
            id_usuario, id_rol, correo, password_hash, esta_activo, fecha_registro,
            token_verificacion, token_verificacion_expira,
            token_recuperacion, token_recuperacion_expira
        ) VALUES (
            'INSERT', fn_bitacora_usuario_app(),
            NEW.id_usuario, NEW.id_rol, NEW.correo, NEW.password_hash, NEW.esta_activo, NEW.fecha_registro,
            NEW.token_verificacion, NEW.token_verificacion_expira,
            NEW.token_recuperacion, NEW.token_recuperacion_expira
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO bitacora_usuario (
            operacion, id_usuario_app, registro_anterior,
            id_usuario, id_rol, correo, password_hash, esta_activo, fecha_registro,
            token_verificacion, token_verificacion_expira,
            token_recuperacion, token_recuperacion_expira
        ) VALUES (
            'UPDATE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            NEW.id_usuario, NEW.id_rol, NEW.correo, NEW.password_hash, NEW.esta_activo, NEW.fecha_registro,
            NEW.token_verificacion, NEW.token_verificacion_expira,
            NEW.token_recuperacion, NEW.token_recuperacion_expira
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO bitacora_usuario (
            operacion, id_usuario_app, registro_anterior,
            id_usuario, id_rol, correo, password_hash, esta_activo, fecha_registro,
            token_verificacion, token_verificacion_expira,
            token_recuperacion, token_recuperacion_expira
        ) VALUES (
            'DELETE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            OLD.id_usuario, OLD.id_rol, OLD.correo, OLD.password_hash, OLD.esta_activo, OLD.fecha_registro,
            OLD.token_verificacion, OLD.token_verificacion_expira,
            OLD.token_recuperacion, OLD.token_recuperacion_expira
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_usuario ON usuario;
CREATE TRIGGER trg_bitacora_usuario
    AFTER INSERT OR UPDATE OR DELETE ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_usuario();

-- ---------------------------------------------------------------------------
-- catalogo_requisito
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora_catalogo_requisito (
    id_bitacora UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_db TEXT NOT NULL DEFAULT SESSION_USER,
    id_usuario_app TEXT,
    registro_anterior JSONB,
    id_requisito UUID,
    codigo VARCHAR(32),
    nombre VARCHAR(500),
    descripcion TEXT,
    creado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bitacora_catalogo_req_reg ON bitacora_catalogo_requisito (registrado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_catalogo_req_id ON bitacora_catalogo_requisito (id_requisito);

CREATE OR REPLACE FUNCTION fn_bitacora_catalogo_requisito()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO bitacora_catalogo_requisito (
            operacion, id_usuario_app,
            id_requisito, codigo, nombre, descripcion, creado_en
        ) VALUES (
            'INSERT', fn_bitacora_usuario_app(),
            NEW.id_requisito, NEW.codigo, NEW.nombre, NEW.descripcion, NEW.creado_en
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO bitacora_catalogo_requisito (
            operacion, id_usuario_app, registro_anterior,
            id_requisito, codigo, nombre, descripcion, creado_en
        ) VALUES (
            'UPDATE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            NEW.id_requisito, NEW.codigo, NEW.nombre, NEW.descripcion, NEW.creado_en
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO bitacora_catalogo_requisito (
            operacion, id_usuario_app, registro_anterior,
            id_requisito, codigo, nombre, descripcion, creado_en
        ) VALUES (
            'DELETE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            OLD.id_requisito, OLD.codigo, OLD.nombre, OLD.descripcion, OLD.creado_en
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_catalogo_requisito ON catalogo_requisito;
CREATE TRIGGER trg_bitacora_catalogo_requisito
    AFTER INSERT OR UPDATE OR DELETE ON catalogo_requisito
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_catalogo_requisito();

-- ---------------------------------------------------------------------------
-- convocatoria
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora_convocatoria (
    id_bitacora UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_db TEXT NOT NULL DEFAULT SESSION_USER,
    id_usuario_app TEXT,
    registro_anterior JSONB,
    id_convocatoria UUID,
    nombre TEXT,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    estado VARCHAR(32),
    creado_en TIMESTAMPTZ,
    id_usuario_creador UUID
);

CREATE INDEX IF NOT EXISTS idx_bitacora_convocatoria_reg ON bitacora_convocatoria (registrado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_convocatoria_id ON bitacora_convocatoria (id_convocatoria);

CREATE OR REPLACE FUNCTION fn_bitacora_convocatoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO bitacora_convocatoria (
            operacion, id_usuario_app,
            id_convocatoria, nombre, fecha_inicio, fecha_fin, estado, creado_en, id_usuario_creador
        ) VALUES (
            'INSERT', fn_bitacora_usuario_app(),
            NEW.id_convocatoria, NEW.nombre, NEW.fecha_inicio, NEW.fecha_fin, NEW.estado, NEW.creado_en, NEW.id_usuario_creador
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO bitacora_convocatoria (
            operacion, id_usuario_app, registro_anterior,
            id_convocatoria, nombre, fecha_inicio, fecha_fin, estado, creado_en, id_usuario_creador
        ) VALUES (
            'UPDATE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            NEW.id_convocatoria, NEW.nombre, NEW.fecha_inicio, NEW.fecha_fin, NEW.estado, NEW.creado_en, NEW.id_usuario_creador
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO bitacora_convocatoria (
            operacion, id_usuario_app, registro_anterior,
            id_convocatoria, nombre, fecha_inicio, fecha_fin, estado, creado_en, id_usuario_creador
        ) VALUES (
            'DELETE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            OLD.id_convocatoria, OLD.nombre, OLD.fecha_inicio, OLD.fecha_fin, OLD.estado, OLD.creado_en, OLD.id_usuario_creador
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_convocatoria ON convocatoria;
CREATE TRIGGER trg_bitacora_convocatoria
    AFTER INSERT OR UPDATE OR DELETE ON convocatoria
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_convocatoria();

-- ---------------------------------------------------------------------------
-- convocatoria_requisito
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora_convocatoria_requisito (
    id_bitacora UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_db TEXT NOT NULL DEFAULT SESSION_USER,
    id_usuario_app TEXT,
    registro_anterior JSONB,
    id_convocatoria UUID,
    id_requisito UUID,
    obligatorio BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_bitacora_conv_req_reg ON bitacora_convocatoria_requisito (registrado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_conv_req_conv ON bitacora_convocatoria_requisito (id_convocatoria);

CREATE OR REPLACE FUNCTION fn_bitacora_convocatoria_requisito()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO bitacora_convocatoria_requisito (
            operacion, id_usuario_app,
            id_convocatoria, id_requisito, obligatorio
        ) VALUES (
            'INSERT', fn_bitacora_usuario_app(),
            NEW.id_convocatoria, NEW.id_requisito, NEW.obligatorio
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO bitacora_convocatoria_requisito (
            operacion, id_usuario_app, registro_anterior,
            id_convocatoria, id_requisito, obligatorio
        ) VALUES (
            'UPDATE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            NEW.id_convocatoria, NEW.id_requisito, NEW.obligatorio
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO bitacora_convocatoria_requisito (
            operacion, id_usuario_app, registro_anterior,
            id_convocatoria, id_requisito, obligatorio
        ) VALUES (
            'DELETE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            OLD.id_convocatoria, OLD.id_requisito, OLD.obligatorio
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_convocatoria_requisito ON convocatoria_requisito;
CREATE TRIGGER trg_bitacora_convocatoria_requisito
    AFTER INSERT OR UPDATE OR DELETE ON convocatoria_requisito
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_convocatoria_requisito();

-- ---------------------------------------------------------------------------
-- postulacion
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora_postulacion (
    id_bitacora UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_db TEXT NOT NULL DEFAULT SESSION_USER,
    id_usuario_app TEXT,
    registro_anterior JSONB,
    id_postulacion UUID,
    id_convocatoria UUID,
    id_usuario UUID,
    estado VARCHAR(32),
    creada_en TIMESTAMPTZ,
    enviada_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bitacora_postulacion_reg ON bitacora_postulacion (registrado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_postulacion_id ON bitacora_postulacion (id_postulacion);

CREATE OR REPLACE FUNCTION fn_bitacora_postulacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO bitacora_postulacion (
            operacion, id_usuario_app,
            id_postulacion, id_convocatoria, id_usuario, estado, creada_en, enviada_en
        ) VALUES (
            'INSERT', fn_bitacora_usuario_app(),
            NEW.id_postulacion, NEW.id_convocatoria, NEW.id_usuario, NEW.estado, NEW.creada_en, NEW.enviada_en
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO bitacora_postulacion (
            operacion, id_usuario_app, registro_anterior,
            id_postulacion, id_convocatoria, id_usuario, estado, creada_en, enviada_en
        ) VALUES (
            'UPDATE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            NEW.id_postulacion, NEW.id_convocatoria, NEW.id_usuario, NEW.estado, NEW.creada_en, NEW.enviada_en
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO bitacora_postulacion (
            operacion, id_usuario_app, registro_anterior,
            id_postulacion, id_convocatoria, id_usuario, estado, creada_en, enviada_en
        ) VALUES (
            'DELETE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            OLD.id_postulacion, OLD.id_convocatoria, OLD.id_usuario, OLD.estado, OLD.creada_en, OLD.enviada_en
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_postulacion ON postulacion;
CREATE TRIGGER trg_bitacora_postulacion
    AFTER INSERT OR UPDATE OR DELETE ON postulacion
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_postulacion();

-- ---------------------------------------------------------------------------
-- postulacion_documento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora_postulacion_documento (
    id_bitacora UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_db TEXT NOT NULL DEFAULT SESSION_USER,
    id_usuario_app TEXT,
    registro_anterior JSONB,
    id_postulacion_documento UUID,
    id_postulacion UUID,
    id_requisito UUID,
    s3_bucket VARCHAR(255),
    s3_key TEXT,
    nombre_original VARCHAR(512),
    content_type VARCHAR(255),
    tamano_bytes BIGINT,
    estado_validacion VARCHAR(32),
    subido_en TIMESTAMPTZ,
    contenido_hash VARCHAR(64),
    version INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bitacora_post_doc_reg ON bitacora_postulacion_documento (registrado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_post_doc_id ON bitacora_postulacion_documento (id_postulacion_documento);

CREATE OR REPLACE FUNCTION fn_bitacora_postulacion_documento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO bitacora_postulacion_documento (
            operacion, id_usuario_app,
            id_postulacion_documento, id_postulacion, id_requisito,
            s3_bucket, s3_key, nombre_original, content_type, tamano_bytes,
            estado_validacion, subido_en, contenido_hash, version
        ) VALUES (
            'INSERT', fn_bitacora_usuario_app(),
            NEW.id_postulacion_documento, NEW.id_postulacion, NEW.id_requisito,
            NEW.s3_bucket, NEW.s3_key, NEW.nombre_original, NEW.content_type, NEW.tamano_bytes,
            NEW.estado_validacion, NEW.subido_en, NEW.contenido_hash, NEW.version
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO bitacora_postulacion_documento (
            operacion, id_usuario_app, registro_anterior,
            id_postulacion_documento, id_postulacion, id_requisito,
            s3_bucket, s3_key, nombre_original, content_type, tamano_bytes,
            estado_validacion, subido_en, contenido_hash, version
        ) VALUES (
            'UPDATE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            NEW.id_postulacion_documento, NEW.id_postulacion, NEW.id_requisito,
            NEW.s3_bucket, NEW.s3_key, NEW.nombre_original, NEW.content_type, NEW.tamano_bytes,
            NEW.estado_validacion, NEW.subido_en, NEW.contenido_hash, NEW.version
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO bitacora_postulacion_documento (
            operacion, id_usuario_app, registro_anterior,
            id_postulacion_documento, id_postulacion, id_requisito,
            s3_bucket, s3_key, nombre_original, content_type, tamano_bytes,
            estado_validacion, subido_en, contenido_hash, version
        ) VALUES (
            'DELETE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            OLD.id_postulacion_documento, OLD.id_postulacion, OLD.id_requisito,
            OLD.s3_bucket, OLD.s3_key, OLD.nombre_original, OLD.content_type, OLD.tamano_bytes,
            OLD.estado_validacion, OLD.subido_en, OLD.contenido_hash, OLD.version
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_postulacion_documento ON postulacion_documento;
CREATE TRIGGER trg_bitacora_postulacion_documento
    AFTER INSERT OR UPDATE OR DELETE ON postulacion_documento
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_postulacion_documento();

-- ---------------------------------------------------------------------------
-- postulacion_estado_historial
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora_postulacion_estado_historial (
    id_bitacora UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_db TEXT NOT NULL DEFAULT SESSION_USER,
    id_usuario_app TEXT,
    registro_anterior JSONB,
    id_historial UUID,
    id_postulacion UUID,
    estado_anterior VARCHAR(32),
    estado_nuevo VARCHAR(32),
    id_usuario_actor UUID,
    creado_en TIMESTAMPTZ,
    motivo TEXT
);

CREATE INDEX IF NOT EXISTS idx_bitacora_post_hist_reg ON bitacora_postulacion_estado_historial (registrado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_post_hist_id ON bitacora_postulacion_estado_historial (id_historial);

CREATE OR REPLACE FUNCTION fn_bitacora_postulacion_estado_historial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO bitacora_postulacion_estado_historial (
            operacion, id_usuario_app,
            id_historial, id_postulacion, estado_anterior, estado_nuevo,
            id_usuario_actor, creado_en, motivo
        ) VALUES (
            'INSERT', fn_bitacora_usuario_app(),
            NEW.id_historial, NEW.id_postulacion, NEW.estado_anterior, NEW.estado_nuevo,
            NEW.id_usuario_actor, NEW.creado_en, NEW.motivo
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO bitacora_postulacion_estado_historial (
            operacion, id_usuario_app, registro_anterior,
            id_historial, id_postulacion, estado_anterior, estado_nuevo,
            id_usuario_actor, creado_en, motivo
        ) VALUES (
            'UPDATE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            NEW.id_historial, NEW.id_postulacion, NEW.estado_anterior, NEW.estado_nuevo,
            NEW.id_usuario_actor, NEW.creado_en, NEW.motivo
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO bitacora_postulacion_estado_historial (
            operacion, id_usuario_app, registro_anterior,
            id_historial, id_postulacion, estado_anterior, estado_nuevo,
            id_usuario_actor, creado_en, motivo
        ) VALUES (
            'DELETE', fn_bitacora_usuario_app(), to_jsonb(OLD),
            OLD.id_historial, OLD.id_postulacion, OLD.estado_anterior, OLD.estado_nuevo,
            OLD.id_usuario_actor, OLD.creado_en, OLD.motivo
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_postulacion_estado_historial ON postulacion_estado_historial;
CREATE TRIGGER trg_bitacora_postulacion_estado_historial
    AFTER INSERT OR UPDATE OR DELETE ON postulacion_estado_historial
    FOR EACH ROW EXECUTE FUNCTION fn_bitacora_postulacion_estado_historial();


-- backend/db/procedimientos_negocio.sql
-- Archivo exclusivo con 21 Procedimientos Almacenados (PROCEDURE) para lógica de negocio
-- basados en el modelo de base de datos de maestro.sql

-- =====================================================================================
-- SECCIÓN 1: GESTIÓN DE ROLES Y USUARIOS
-- =====================================================================================

-- 1. sp_crear_rol
CREATE OR REPLACE PROCEDURE sp_crear_rol(
    IN p_nombre VARCHAR,
    IN p_descripcion TEXT,
    INOUT p_id_rol UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO rol (nombre, descripcion)
    VALUES (p_nombre, p_descripcion)
    RETURNING id_rol INTO p_id_rol;
END;
$$;

-- 2. sp_actualizar_rol
CREATE OR REPLACE PROCEDURE sp_actualizar_rol(
    IN p_id_rol UUID,
    IN p_nombre VARCHAR,
    IN p_descripcion TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE rol
    SET nombre = p_nombre,
        descripcion = p_descripcion
    WHERE id_rol = p_id_rol;
END;
$$;

-- 3. sp_eliminar_rol
CREATE OR REPLACE PROCEDURE sp_eliminar_rol(
    IN p_id_rol UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM rol
    WHERE id_rol = p_id_rol;
END;
$$;

-- 4. sp_asignar_rol_usuario
CREATE OR REPLACE PROCEDURE sp_asignar_rol_usuario(
    IN p_id_usuario UUID,
    IN p_id_rol UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE usuario
    SET id_rol = p_id_rol
    WHERE id_usuario = p_id_usuario;
END;
$$;

-- 5. sp_actualizar_estado_usuario
CREATE OR REPLACE PROCEDURE sp_actualizar_estado_usuario(
    IN p_id_usuario UUID,
    IN p_esta_activo BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE usuario
    SET esta_activo = p_esta_activo
    WHERE id_usuario = p_id_usuario;
END;
$$;

-- =====================================================================================
-- SECCIÓN 2: CATÁLOGOS DE REQUISITOS
-- =====================================================================================

-- 6. sp_crear_catalogo_requisito
CREATE OR REPLACE PROCEDURE sp_crear_catalogo_requisito(
    IN p_codigo VARCHAR,
    IN p_nombre VARCHAR,
    IN p_descripcion TEXT,
    INOUT p_id_requisito UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO catalogo_requisito (codigo, nombre, descripcion)
    VALUES (p_codigo, p_nombre, p_descripcion)
    RETURNING id_requisito INTO p_id_requisito;
END;
$$;

-- 7. sp_actualizar_catalogo_requisito
CREATE OR REPLACE PROCEDURE sp_actualizar_catalogo_requisito(
    IN p_id_requisito UUID,
    IN p_nombre VARCHAR,
    IN p_descripcion TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE catalogo_requisito
    SET nombre = p_nombre,
        descripcion = p_descripcion
    WHERE id_requisito = p_id_requisito;
END;
$$;

-- 8. sp_eliminar_catalogo_requisito
CREATE OR REPLACE PROCEDURE sp_eliminar_catalogo_requisito(
    IN p_id_requisito UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM catalogo_requisito
    WHERE id_requisito = p_id_requisito;
END;
$$;

-- =====================================================================================
-- SECCIÓN 3: GESTIÓN DE CONVOCATORIAS
-- =====================================================================================

-- 9. sp_crear_convocatoria
CREATE OR REPLACE PROCEDURE sp_crear_convocatoria(
    IN p_nombre TEXT,
    IN p_fecha_inicio TIMESTAMPTZ,
    IN p_fecha_fin TIMESTAMPTZ,
    IN p_id_usuario_creador UUID,
    INOUT p_id_convocatoria UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_fecha_inicio > p_fecha_fin THEN
        RAISE EXCEPTION 'La fecha de inicio no puede ser posterior a la fecha de fin' USING ERRCODE = '22023';
    END IF;

    INSERT INTO convocatoria (nombre, fecha_inicio, fecha_fin, estado, id_usuario_creador)
    VALUES (p_nombre, p_fecha_inicio, p_fecha_fin, 'ABIERTA', p_id_usuario_creador)
    RETURNING id_convocatoria INTO p_id_convocatoria;
END;
$$;

-- 10. sp_actualizar_estado_convocatoria
CREATE OR REPLACE PROCEDURE sp_actualizar_estado_convocatoria(
    IN p_id_convocatoria UUID,
    IN p_estado VARCHAR
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE convocatoria
    SET estado = p_estado
    WHERE id_convocatoria = p_id_convocatoria;
END;
$$;

-- 11. sp_extender_convocatoria
CREATE OR REPLACE PROCEDURE sp_extender_convocatoria(
    IN p_id_convocatoria UUID,
    IN p_nueva_fecha_fin TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE convocatoria
    SET fecha_fin = p_nueva_fecha_fin,
        estado = CASE 
            WHEN estado = 'INACTIVA' AND p_nueva_fecha_fin > NOW() THEN 'ABIERTA' 
            ELSE estado 
        END
    WHERE id_convocatoria = p_id_convocatoria;
END;
$$;

-- 12. sp_cancelar_convocatoria
CREATE OR REPLACE PROCEDURE sp_cancelar_convocatoria(
    IN p_id_convocatoria UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE convocatoria
    SET estado = 'DESIERTA'
    WHERE id_convocatoria = p_id_convocatoria;
END;
$$;

-- 13. sp_marcar_convocatorias_inactivas_batch
CREATE OR REPLACE PROCEDURE sp_marcar_convocatorias_inactivas_batch(
    INOUT p_filas_afectadas INTEGER DEFAULT 0
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE convocatoria
    SET estado = 'INACTIVA'
    WHERE estado = 'ABIERTA' 
      AND fecha_fin < NOW();
      
    GET DIAGNOSTICS p_filas_afectadas = ROW_COUNT;
END;
$$;

-- 14. sp_agregar_requisito_convocatoria
CREATE OR REPLACE PROCEDURE sp_agregar_requisito_convocatoria(
    IN p_id_convocatoria UUID,
    IN p_id_requisito UUID,
    IN p_obligatorio BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO convocatoria_requisito (id_convocatoria, id_requisito, obligatorio)
    VALUES (p_id_convocatoria, p_id_requisito, p_obligatorio)
    ON CONFLICT (id_convocatoria, id_requisito) 
    DO UPDATE SET obligatorio = EXCLUDED.obligatorio;
END;
$$;

-- 15. sp_eliminar_requisito_convocatoria
CREATE OR REPLACE PROCEDURE sp_eliminar_requisito_convocatoria(
    IN p_id_convocatoria UUID,
    IN p_id_requisito UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM convocatoria_requisito
    WHERE id_convocatoria = p_id_convocatoria
      AND id_requisito = p_id_requisito;
END;
$$;

-- =====================================================================================
-- SECCIÓN 4: POSTULACIONES Y CICLO DE VIDA
-- =====================================================================================

-- 16. sp_crear_postulacion
CREATE OR REPLACE PROCEDURE sp_crear_postulacion(
    IN p_id_convocatoria UUID,
    IN p_id_usuario UUID,
    INOUT p_id_postulacion UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO postulacion (id_convocatoria, id_usuario, estado)
    VALUES (p_id_convocatoria, p_id_usuario, 'EN_INTEGRACION')
    RETURNING id_postulacion INTO p_id_postulacion;
END;
$$;

-- 17. sp_actualizar_estado_postulacion
CREATE OR REPLACE PROCEDURE sp_actualizar_estado_postulacion(
    IN p_id_postulacion UUID,
    IN p_nuevo_estado VARCHAR,
    IN p_id_usuario_actor UUID,
    IN p_motivo TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_estado_anterior VARCHAR(32);
BEGIN
    SELECT estado INTO v_estado_anterior
    FROM postulacion WHERE id_postulacion = p_id_postulacion FOR UPDATE;
    
    IF FOUND AND v_estado_anterior != p_nuevo_estado THEN
        UPDATE postulacion
        SET estado = p_nuevo_estado
        WHERE id_postulacion = p_id_postulacion;
        
        INSERT INTO postulacion_estado_historial (
            id_postulacion, estado_anterior, estado_nuevo, id_usuario_actor, motivo
        ) VALUES (
            p_id_postulacion, v_estado_anterior, p_nuevo_estado, p_id_usuario_actor, p_motivo
        );
    END IF;
END;
$$;

-- 18. sp_enviar_postulacion
CREATE OR REPLACE PROCEDURE sp_enviar_postulacion(
    IN p_id_postulacion UUID,
    IN p_id_usuario_actor UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_estado_actual VARCHAR(32);
BEGIN
    SELECT estado INTO v_estado_actual FROM postulacion WHERE id_postulacion = p_id_postulacion;
    
    IF v_estado_actual != 'EN_INTEGRACION' AND v_estado_actual != 'CON_OBSERVACIONES' THEN
        RAISE EXCEPTION 'La postulación no está en un estado válido para enviarse.' USING ERRCODE = '22023';
    END IF;

    UPDATE postulacion
    SET enviada_en = NOW()
    WHERE id_postulacion = p_id_postulacion;

    CALL sp_actualizar_estado_postulacion(p_id_postulacion, 'ENVIADO', p_id_usuario_actor, 'Envío de expediente completo por el usuario');
END;
$$;

-- =====================================================================================
-- SECCIÓN 5: EVIDENCIAS Y DOCUMENTOS DE POSTULACIÓN
-- =====================================================================================

-- 19. sp_registrar_documento_postulacion
CREATE OR REPLACE PROCEDURE sp_registrar_documento_postulacion(
    IN p_id_postulacion UUID,
    IN p_id_requisito UUID,
    IN p_s3_bucket VARCHAR,
    IN p_s3_key TEXT,
    IN p_nombre_original VARCHAR,
    IN p_content_type VARCHAR,
    IN p_tamano_bytes BIGINT,
    IN p_contenido_hash VARCHAR,
    INOUT p_id_doc UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_version INT;
BEGIN
    SELECT id_postulacion_documento, version INTO p_id_doc, v_version
    FROM postulacion_documento 
    WHERE id_postulacion = p_id_postulacion AND id_requisito = p_id_requisito;

    IF p_id_doc IS NOT NULL THEN
        UPDATE postulacion_documento
        SET s3_bucket = p_s3_bucket,
            s3_key = p_s3_key,
            nombre_original = p_nombre_original,
            content_type = p_content_type,
            tamano_bytes = p_tamano_bytes,
            contenido_hash = p_contenido_hash,
            estado_validacion = 'PENDIENTE',
            subido_en = NOW(),
            version = v_version + 1
        WHERE id_postulacion_documento = p_id_doc;
    ELSE
        INSERT INTO postulacion_documento (
            id_postulacion, id_requisito, s3_bucket, s3_key, nombre_original, 
            content_type, tamano_bytes, contenido_hash, version
        ) VALUES (
            p_id_postulacion, p_id_requisito, p_s3_bucket, p_s3_key, p_nombre_original, 
            p_content_type, p_tamano_bytes, p_contenido_hash, 1
        ) RETURNING id_postulacion_documento INTO p_id_doc;
    END IF;
END;
$$;

-- 20. sp_validar_documento_postulacion
CREATE OR REPLACE PROCEDURE sp_validar_documento_postulacion(
    IN p_id_postulacion_documento UUID,
    IN p_estado_validacion VARCHAR
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE postulacion_documento
    SET estado_validacion = p_estado_validacion
    WHERE id_postulacion_documento = p_id_postulacion_documento;
END;
$$;

-- 21. sp_eliminar_documento_postulacion
CREATE OR REPLACE PROCEDURE sp_eliminar_documento_postulacion(
    IN p_id_postulacion_documento UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM postulacion_documento
    WHERE id_postulacion_documento = p_id_postulacion_documento;
END;
$$;

-- =============================================================================
-- Sprint 6: validación documental, dictamen, auditoría aplicación, soporte_ti
-- =============================================================================

INSERT INTO rol (nombre, descripcion)
SELECT 'soporte_ti', 'Soporte técnico – consulta auditoría'
WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'soporte_ti');

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