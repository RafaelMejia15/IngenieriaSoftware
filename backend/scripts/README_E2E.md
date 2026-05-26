# Prueba automatizada E2E del API (backend)

Script que simula un flujo real contra el backend en ejecución, usando **httpx**.

## Flujo cubierto

1. **Login admin** → obtiene JWT.
2. **GET catálogo de requisitos** → toma un `id` de requisito.
3. **POST crear convocatoria** (vacante vigente con nombre único).
4. **Login aspirante** (`usuario`).
5. **POST postular** a esa convocatoria → expediente `EN_INTEGRACION`.
6. **POST postular otra vez** → debe responder **409** (duplicado).
7. **GET admin/convocatorias como aspirante** → debe responder **403**.
8. **POST subir documento PDF** (multipart) → **200** si S3 está configurado; si no, se omite con aviso.

## Requisitos

- Python 3.10+
- Backend corriendo (por defecto `http://localhost:8500`)
- Base de datos con usuarios seed (`admin@admin.com`, `usuario@usuario.com`)
- `pip install httpx`

Opcional para paso 8: variables `S3_BUCKET` y credenciales AWS en el contenedor backend.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `e2e_api_flow.py` | Script principal |
| `e2e_config.json` | Configuración (URL, credenciales) |
| `e2e_config.example.json` | Plantilla sin credenciales sensibles |
| `e2e_reports/e2e_report_*.json` | Evidencia JSON de cada ejecución |

## Instrucciones de uso

### 1. Levantar el stack

```bash
docker compose up -d db backend
```

Si el puerto **8500** ya está ocupado por otro servicio (respuesta `403 Acceso denegado: Cliente no autorizado`), levante este backend en otro puerto:

```bash
docker compose up -d db
docker compose run -d --name e2e-backend -p 8525:8500 backend
```

Luego use `--base-url http://localhost:8525` al ejecutar la prueba.

Aplicar esquema si es BD nueva:

```bash
docker compose cp backend/db/maestro.sql db:/tmp/maestro.sql
docker compose exec -T db psql -U automecture_user -d postgres -f /tmp/maestro.sql
```

### 2. Instalar dependencia

```bash
pip install httpx
```

### 3. Configurar (si cambia host o usuarios)

Editar `backend/scripts/e2e_config.json` o copiar desde el ejemplo:

```bash
copy backend\scripts\e2e_config.example.json backend\scripts\e2e_config.json
```

### 4. Ejecutar

Desde la raíz del repositorio:

```bash
python backend/scripts/e2e_api_flow.py
```

Con config explícita:

```bash
python backend/scripts/e2e_api_flow.py --config backend/scripts/e2e_config.json
```

Puerto alternativo:

```bash
python backend/scripts/e2e_api_flow.py --base-url http://localhost:8525
```

Código de salida: **0** si todos los pasos pasan; **1** si alguno falla; **2** si no hay conexión o falta config.

## Validaciones incluidas (requisitos de la entrega)

| Requisito | Cómo se valida |
|-----------|----------------|
| Código HTTP esperado | Cada paso define status esperado (200, 201, 409, 403) |
| Campo `msg` / equivalente | Login: `msg == "OK"` |
| Identificador creado | `id` convocatoria, `id_postulacion`, `id_postulacion_documento` |
| Mensaje de error | 409 postulación duplicada; 403 sin rol admin |
| Estructura JSON | Claves `access_token`, `rol`, `requisitos_obligatorios`, etc. |
| Dato enviado = consultado | Nombre de convocatoria y `id_convocatoria` tras postular |
| Operación inválida rechazada | Duplicado 409; aspirante en ruta admin 403 |
| Escenario exitoso | Crear vacante + postular |
| Escenario incorrecto | Pasos 6 y 7 |
| Evidencia | JSON en `e2e_reports/` + salida en consola |

### Última ejecución exitosa (evidencia)

- Archivo: `backend/scripts/e2e_reports/e2e_report_20260525_211111.json`
- Resultado: **9/9 pasos OK** (100%)
- Convocatoria creada: `215fbe77-c901-4bb3-9ba7-268c2a456e13`
- Postulación creada: `529ed208-95c0-45d0-bac8-91af1a80d2db`

## Credenciales por defecto (maestro.sql)

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Admin | admin@admin.com | 1234@abc |
| Aspirante | usuario@usuario.com | 1234@abc |

## Resultados

Tras cada ejecución se genera un archivo como:

`backend/scripts/e2e_reports/e2e_report_20260520_143022.json`

Contiene por paso: método, ruta, status esperado/real, lista de checks y vista previa de la respuesta JSON.
