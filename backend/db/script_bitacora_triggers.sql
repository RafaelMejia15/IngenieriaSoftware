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
