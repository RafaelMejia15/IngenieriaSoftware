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
    RETURNING id_usuario INTO v_id_usuario;

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
    RETURNING id_usuario INTO v_id;

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
