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
    RETURNING id_usuario INTO v_id;

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
