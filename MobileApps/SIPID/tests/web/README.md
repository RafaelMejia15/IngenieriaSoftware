# Pruebas Automatizadas E2E (Web) con Playwright

Este directorio contiene las pruebas automatizadas *End-to-End* exclusivas para la versión Web de SIPID (React Native / Expo), diseñadas para evaluar **flujos reales integrados con el backend de producción**.

## 1. Prerrequisitos (Entorno Local)
Si deseas ejecutar las pruebas en tu computadora, asegúrate de tener instalado Node.js y los navegadores de Playwright:
```bash
pnpm exec playwright install --with-deps
```

## 2. Ejecución Local
Levanta la aplicación en una terminal (asegúrate de que tu Backend también esté corriendo):
```bash
pnpm web
```

En otra terminal, ejecuta las pruebas:
```bash
# Modo oculto (Headless - Ejecuta las pruebas y graba video)
pnpm test:e2e

# Modo visual (UI Interactiva - para depurar paso a paso)
pnpm test:e2e:ui
```

Tras ejecutar las pruebas, visualiza los resultados, pantallazos y videos de la ejecución local:
```bash
pnpm test:report
```

## 3. Ejecución en Producción (GitHub Actions)
La plataforma está configurada con un flujo de Integración Continua (CI) en GitHub Actions (`.github/workflows/playwright.yml`). 
Las pruebas se ejecutan automáticamente contra el entorno de **producción** en cada `push` o `pull_request` a la rama `main`.

### Configuración en GitHub
Para que el robot de GitHub sepa a qué URL pública debe entrar, debes configurar el siguiente secreto en tu repositorio:
1. Ve a **Settings > Secrets and variables > Actions**.
2. Agrega un "New repository secret".
3. **Name:** `PROD_URL`
4. **Secret:** `https://tudominio.com` (URL de tu frontend público).

### Obtener la Evidencia (Entregable)
Una vez que el flujo termine en GitHub, ve a la pestaña **Actions**, entra al flujo ejecutado y descarga el archivo `.zip` llamado `reporte-evidencia-playwright` en la sección de **Artifacts**. Contiene los videos interactivos, trazas y pantallazos HTML de la ejecución realizada directamente en producción.

## Notas Técnicas sobre la Arquitectura de Pruebas
- **Selectores:** NUNCA uses selectores CSS. Usa el prop `testID` en los componentes de React Native y búscalo con `page.getByTestId('...')`. Expo lo transforma automáticamente a `data-testid` en web.
- **Flujo Real Integrado:** Se eliminó el *API Mocking* intencionalmente. Las pruebas ahora realizan peticiones HTTP reales al backend (ya sea en `localhost` o en producción), garantizando que todo el flujo sistémico, desde la interfaz hasta la base de datos, opere correctamente.
- **Evidencia en Video:** Se implementó `slowMo: 800` en la configuración global de Playwright para simular una interacción a ritmo humano, permitiendo que la grabación de video resultante sea perfectamente auditable para revisiones y entregables.
