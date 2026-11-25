import { test, expect, abrirApp, completarBienvenida, esperarAviso, remar, terminar, listar } from './ayuda.mjs';

// Etapa 14: «Solo tengo 15 / 20 min» arma una versión corta de la sesión del día que cuenta como media sesión del plan.
test('la versión corta de la sesión del día se elige en Hoy, se rema y se guarda como del plan a medias', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  await expect(page.locator('#hoy-etq')).toHaveText('Hoy toca');
  const nombre = await page.locator('#hoy-nombre').textContent();
  const corta = page.locator('#hoy-corta');
  await expect(page.locator('#hoy-mas-resumen')).toContainText('¿poco tiempo?');
  await page.locator('#hoy-mas > summary').click();
  await expect(corta).toBeVisible();
  const boton = corta.locator('[data-corta]').first();
  const min = Number(await boton.getAttribute('data-corta'));
  await boton.click();
  await expect(corta).toContainText(`Versión de ${min} min`);
  await expect(corta).toContainText('media sesión');
  await expect(page.locator('#hoy-nombre')).toHaveText(nombre, { timeout: 5000 });
  // Volver a la completa y otra vez a la corta.
  await corta.locator('[data-corta="0"]').click();
  await expect(corta).toContainText('¿Poco tiempo?');
  await corta.locator(`[data-corta="${min}"]`).click();
  await expect(corta).toContainText(`Versión de ${min} min`);
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  const [s] = await listar(page, 'sesiones');
  expect(s.entrenamiento).toBe(nombre);
  expect(s.versionCorta).toBe(min);
  // Después de la sesión, la próxima vuelve a ser la completa.
  expect(await page.evaluate(async () => (await import('/src/estado.js')).estado.versionCorta)).toBeNull();
});
