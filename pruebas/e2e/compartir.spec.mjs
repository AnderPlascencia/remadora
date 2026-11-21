import { test, expect, abrirApp, completarBienvenida, esperarAviso, remar, terminar } from './ayuda.mjs';

// Etapa 15: la imagen se ve antes de compartirla, en el formato que elijas, y sin pulso ni calorías por defecto.
test('compartir imagen abre la vista previa con formatos y opciones, y Guardar la descarga', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await page.locator('#btn-compartir-img').click();
  const dlg = page.locator('#compartir-dialogo');
  await expect(dlg).toBeVisible();
  const img = page.locator('#compartir-img');
  const medida = () => img.evaluate((el) => (el.complete && el.naturalWidth ? `${el.naturalWidth}x${el.naturalHeight}` : ''));
  await expect.poll(medida).toBe('1080x1350');
  await expect(dlg.locator('button[data-formato="4:5"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#compartir-pulso')).not.toBeChecked();
  await expect(page.locator('#compartir-kcal')).not.toBeChecked();
  await dlg.locator('button[data-formato="9:16"]').click();
  await expect(dlg.locator('button[data-formato="9:16"]')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(medida).toBe('1080x1920');
  await dlg.locator('button[data-formato="1:1"]').click();
  await expect.poll(medida).toBe('1080x1080');
  await page.locator('#compartir-kcal').check();
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.locator('#compartir-guardar').click()]);
  expect(descarga.suggestedFilename()).toMatch(/^rower-.*-1x1\.png$/);
  // Escape cierra la vista previa y deja el resumen de la sesión abierto.
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(page.locator('#hoja')).toBeVisible();
  await expect(page.locator('#btn-compartir-img')).toBeFocused();
});
