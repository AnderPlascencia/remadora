import { test, expect, abrirApp, completarBienvenida, remar, terminar, listar } from './ayuda.mjs';

// El esfuerzo se marca con 5 botones grandes (escala CR10: 2, 4, 6, 8 y 10) y se puede afinar de 1 a 10.
test('el esfuerzo se marca con 5 botones grandes y se guarda en la escala CR10', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  const botones = page.locator('#rpe button');
  await expect(botones).toHaveCount(5);
  await expect(botones).toHaveText(['Fácil2', 'Moderado4', 'Duro6', 'Muy duro8', 'Máximo10']);
  for (const b of await botones.all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.locator('#rpe [data-rpe="6"]').click();
  await expect(page.locator('#rpe [data-rpe="6"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await listar(page, 'sesiones'))[0].rpe).toBe(6);
  // Afinar de 1 a 10: un 7 se guarda tal cual y en grande se marca el botón más cercano por arriba (8).
  await page.locator('#rpe-fino-caja summary').click();
  await page.locator('#rpe-fino [data-rpe="7"]').click();
  await expect.poll(async () => (await listar(page, 'sesiones'))[0].rpe).toBe(7);
  await expect(page.locator('#rpe [data-rpe="8"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rpe-texto')).toHaveText('7 de 10: Duro');
});
