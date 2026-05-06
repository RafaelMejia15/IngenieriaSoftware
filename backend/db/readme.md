# Documentación del Schema `public` - Módulo de Autenticación y Usuarios

Este documento describe la estructura principal de la base de datos PostgreSQL para la gestión de usuarios, roles y flujos de seguridad del sistema.

## API (JWT)

Tras **Sprint 3**, el endpoint `POST /login` devuelve `access_token` y `token_type: bearer`. Las rutas de vacantes y catálogo exigen el encabezado:

`Authorization: Bearer <access_token>`

Variables de entorno: `JWT_SECRET`, `JWT_ALGORITHM` (por defecto `HS256`), `JWT_EXPIRE_MINUTES`.

- `GET /admin/convocatorias`: listado de todas las convocatorias (administrador); query `solo_activas=true` replica el filtro del aspirante.

## Vacante activa (Sprint 3, regla operativa)

Una convocatoria se considera **activa** para el buscador de aspirantes cuando:

- `estado = 'ABIERTA'` **y**
- `fecha_inicio <= now()` **y** `fecha_fin >= now()` (instante actual en UTC, comparación inclusiva en los extremos del rango configurado).

## 🗺️ Mapa del Schema `public`

### Tablas

* **`rol`**: Almacena los perfiles de autorización del sistema.
    * `id_rol` (UUID, PK)
    * `nombre` (VARCHAR, único)
    * `descripcion` (TEXT)
* **`usuario`**: Entidad central para el control de acceso.
    * `id_usuario` (UUID, PK)
    * `id_rol` (UUID, FK -> `rol.id_rol`)
    * `correo` (VARCHAR, único)
    * `password_hash` (VARCHAR)
    * `esta_activo` (BOOLEAN)
    * `fecha_registro` (TIMESTAMP)
    * `token_verificacion` (VARCHAR, opcional, con índice único)
    * `token_verificacion_expira` (TIMESTAMPTZ, opcional)
    * `token_recuperacion` (VARCHAR, opcional, con índice único)
    * `token_recuperacion_expira` (TIMESTAMPTZ, opcional)

### Funciones (Stored Procedures)

* `sp_obtener_usuario_login(p_correo)`: Recupera credenciales (hash) y estado del usuario, uniendo la información con su rol correspondiente para procesar el inicio de sesión.
* `sp_registrar_usuario(p_correo, p_password_hash, p_nombre_rol, p_token_verificacion, p_token_expira)`: Inserta un nuevo usuario inactivo con un token de verificación de correo. Previene correos duplicados y valida que el rol especificado exista.
* `sp_validar_usuario(p_token)`: Activa un usuario en el sistema y limpia los campos del token si este es válido y la fecha de expiración aún no se ha cumplido.
* `sp_solicitar_recuperacion_contrasena(p_correo, p_token, p_token_expira)`: Asigna un token de recuperación temporal a un usuario existente buscando por su correo (ignorando mayúsculas y espacios).
* `sp_restablecer_contrasena(p_token, p_password_hash)`: Actualiza el hash de la contraseña, limpia los tokens y devuelve el ID y rol del usuario si el token provisto es válido.

### **Sprint 3 – Convocatorias (subconjunto del modelo SISED)**

Script: [`script_sprint3_convocatorias.sql`](script_sprint3_convocatorias.sql). No incluye `ID_PROMOCION`, departamentos ni el árbol de reglas del PDF; solo flujo funcional y contratos de API.

* **`catalogo_requisito`**: Requisitos de documentación (código tipo P01, nombre, descripción).
* **`convocatoria`**: Vacante con `nombre`, `fecha_inicio`, `fecha_fin`, `estado` (valores alineados a SISED: `ABIERTA`, `EN_EVALUACION`, `CERRADA_DICTAMINADA`, `DESIERTA`), `creado_en`, `id_usuario_creador` (FK opcional a `usuario`).
* **`convocatoria_requisito`**: Vínculo N:M entre convocatoria y requisitos del catálogo; `obligatorio` (por defecto verdadero en Sprint 3).

---

## 🌱 Datos Iniciales (Seed Data)

El script principal garantiza la existencia de los roles fundamentales para la operación del sistema al hacer el despliegue inicial (mediante `INSERT ... WHERE NOT EXISTS`).

| Nombre de Rol | Descripción |
| :--- | :--- |
| `admin` | Administrador del sistema |
| `usuario` | Usuario estándar |

---

## 📈 Historial de Evolución del Schema

La arquitectura de este schema se ha desplegado en las siguientes fases lógicas para soportar los distintos requerimientos del ciclo de vida del usuario:

### **v1: Estructura Base**
* Creación de la tabla `rol` utilizando identificadores `UUID`.
* Creación de la tabla `usuario` con llave foránea hacia `rol`, configuración de restricciones de unicidad para el correo y campos por defecto (actividad y fechas).

### **v2: Soporte de Autenticación Básica (Login)**
* Creación de la función `sp_obtener_usuario_login` para facilitar la extracción del hash, estado de cuenta y nombre de rol en una sola llamada a la base de datos durante el proceso de autenticación.

### **v3: Flujos de Seguridad Completos (Registro, Verificación y Recuperación)**
* **Modificaciones de tablas:** Modificación de `usuario` (`ALTER TABLE`) para incluir campos de manejo de sesión asíncrona: `token_verificacion`, `token_verificacion_expira`, `token_recuperacion` y `token_recuperacion_expira`.
* **Creación de índices únicos (`UNIQUE INDEX`):** Implementados sobre los campos de los tokens para evitar colisiones cruzadas.
* **Verificación por correo:** Implementación de las funciones `sp_registrar_usuario` y `sp_validar_usuario` para asegurar que los correos pertenezcan al usuario.
* **Recuperación de contraseña:** Implementación de `sp_solicitar_recuperacion_contrasena` y `sp_restablecer_contrasena` para los flujos de "olvidé mi contraseña".

### **Sprint 3: Convocatorias y catálogo de requisitos**

* Tablas `catalogo_requisito`, `convocatoria`, `convocatoria_requisito` y seed de códigos P01–P10 (ver script `script_sprint3_convocatorias.sql`).
* Autenticación JWT en la API para separar rutas de administrador y aspirante (`usuario` en rol = aspirante en SISED).
