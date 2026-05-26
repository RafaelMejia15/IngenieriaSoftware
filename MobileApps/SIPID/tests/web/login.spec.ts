import { test, expect } from '@playwright/test';

test.describe('Flujo de Iniciar Sesión', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar LocalStorage para asegurar que el usuario no esté logueado
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
  });

  test('debe mostrar error con credenciales inválidas y restaurar el botón', async ({ page }) => {
    // 1. Mockear la respuesta del backend para simular un 401 Unauthorized
    await page.route('**/login', async (route) => {
      // Simular latencia de red
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: "Credenciales inválidas" }),
      });
    });

    await page.goto('/');

    // Usar los testIDs inyectados
    await page.getByTestId('login-input-email').fill('invalido@sipid.com');
    await page.getByTestId('login-input-password').fill('BadPassword123!');

    // El botón debe estar habilitado inicialmente
    const submitButton = page.getByTestId('login-button-submit');
    await expect(submitButton).toBeEnabled();

    // Click al botón
    await submitButton.click();

    // 2. Aserción: El contenedor de error debe ser visible
    const errorContainer = page.getByTestId('login-text-error');
    await expect(errorContainer).toBeVisible();

    // 3. Aserción: Texto esperado exacto
    await expect(errorContainer).toHaveText('Usuario o contraseña incorrecta');
  });

  test('debe redirigir al hub con credenciales válidas usando API Mocking', async ({ page }) => {
    // 1. Intercepción HTTP: Mockear respuesta 200 OK con token
    await page.route('**/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          msg: "OK",
          rol: "usuario",
          access_token: "mock-jwt-token-12345",
          token_type: "bearer"
        }),
      });
    });

    await page.goto('/');

    await page.getByTestId('login-input-email').fill('valido@sipid.com');
    await page.getByTestId('login-input-password').fill('GoodPassword123!');
    
    await page.getByTestId('login-button-submit').click();

    // 2. Aserción de Cambio de URL: Esperar redirección al Hub
    // En expo-router (web), la ruta /(tabs)/hub generalmente resuelve a /hub o similar.
    await page.waitForURL('**/hub');
    expect(page.url()).toContain('/hub');
  });
});
