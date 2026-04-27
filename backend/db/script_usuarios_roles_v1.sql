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

-- Roles iniciales (el campo `rol` del registro debe coincidir con `nombre`)
INSERT INTO rol (nombre, descripcion)
SELECT 'admin', 'Administrador del sistema'
WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'admin');

INSERT INTO rol (nombre, descripcion)
SELECT 'usuario', 'Usuario estándar'
WHERE NOT EXISTS (SELECT 1 FROM rol WHERE nombre = 'usuario');

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