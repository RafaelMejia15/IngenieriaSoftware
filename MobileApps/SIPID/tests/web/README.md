# Pruebas E2E (Web) con Playwright

Este directorio contiene las pruebas automatizadas *End-to-End* exclusivas para la versión Web de SIPID (React Native / Expo).

## 1. Prerrequisitos
Asegúrate de tener instalado Node.js.
Instala los navegadores de Playwright:
```bash
npx playwright install --with-deps
```

## 2. Configuración de Entorno
Crea un archivo `.env.test` en la raíz del frontend (`MobileApps/SIPID/`) con las siguientes variables (si aplican):
```env
BASE_URL=http://localhost:8081
```

## 3. Ejecución Local
Levanta la aplicación en una terminal:
```bash
pnpm web
```

En otra terminal, ejecuta las pruebas:
```bash
# Modo oculto (Headless - rápido)
pnpm test:e2e

# Modo visual (UI Interactiva - para depurar)
pnpm test:e2e:ui
```

## 4. Generación de Reportes
Tras ejecutar las pruebas, visualiza los resultados y los videos de fallo:
```bash
pnpm test:report
```

## Notas Técnicas sobre la Arquitectura de Pruebas
- **Selectores:** NUNCA uses selectores CSS. Usa `testID` en React Native y búscalo con `page.getByTestId('...')`. Expo lo transforma a `data-testid` en web.
- **API Mocking:** Para evitar contaminar la base de datos de PostgreSQL usando procedimientos almacenados, utilizamos `page.route()` para interceptar y simular respuestas del servidor (ej. simular el 401 Unauthorized o 200 OK con un token JWT mockeado).
