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
    esta_activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
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