import { test, expect } from '@playwright/test';

test.describe('Flujo de Iniciar Sesión (Flujo Real)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Limpiar LocalStorage para asegurar que el usuario no esté logueado
    await page.evaluate(() => window.localStorage.clear());
  });

  test('debe mostrar error con credenciales inválidas (Consultando Backend Real)', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('login-input-email').fill('usuario_que_no_existe@sipid.com');
    await page.getByTestId('login-input-password').fill('PasswordIncorrecta123!');

    // El botón debe estar habilitado inicialmente
    const submitButton = page.getByTestId('login-button-submit');
    await expect(submitButton).toBeEnabled();

    // Ejecutar acción
    await submitButton.click();

    // Aserción: El contenedor de error debe ser visible tras recibir el error del backend
    const errorContainer = page.getByTestId('login-text-error');
    await expect(errorContainer).toBeVisible();

    // Aserción: Texto esperado exacto
    await expect(errorContainer).toHaveText('Usuario o contraseña incorrecta');

    // Evidencia fotográfica
    await page.screenshot({ path: 'test-results/evidencia-login-error.png' });
  });

  test('debe redirigir al hub con credenciales válidas (Consultando Backend Real)', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('login-input-email').fill('admin@admin.com');
    await page.getByTestId('login-input-password').fill('1234@abc');

    await page.getByTestId('login-button-submit').click();

    await page.waitForURL('**/hub');
    expect(page.url()).toContain('/hub');

    // Validar existencia de elemento en la nueva pantalla
    await expect(page.getByText('Administrador de Convocatorias')).toBeVisible();

    // Evidencia fotográfica
    await page.screenshot({ path: 'test-results/evidencia-login-exito.png' });
  });
});
