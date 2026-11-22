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

// Etapa 31: desde Progreso se comparte la semana (Tablero) o el mes (Póster), con calorías y «esta / la anterior».
test('compartir mi semana y mi mes desde Progreso', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await page.reload();
  await page.locator('#tab-historial').click();
  const boton = page.locator('#btn-compartir-periodo');
  await expect(boton).toHaveText('Compartir mi semana');
  await boton.click();
  const dlg = page.locator('#compartir-dialogo');
  await expect(dlg).toBeVisible();
  const img = page.locator('#compartir-img');
  const medida = () => img.evaluate((el) => (el.complete && el.naturalWidth ? `${el.naturalWidth}x${el.naturalHeight}` : ''));
  await expect.poll(medida).toBe('1080x1350');
  await expect(dlg.locator('[data-cual="actual"]')).toHaveText('Esta semana');
  await expect(dlg.locator('[data-cual="actual"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#compartir-kcal')).toBeChecked();
  await expect(page.locator('#compartir-pulso').locator('xpath=..')).toBeHidden();
  await dlg.locator('button[data-formato="9:16"]').click();
  await expect.poll(medida).toBe('1080x1920');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.locator('#compartir-guardar').click()]);
  expect(descarga.suggestedFilename()).toMatch(/^rower-semana-.*-9x16\.png$/);
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await page.locator('.segmentado button[data-periodo="mes"]').click();
  await expect(boton).toHaveText('Compartir mi mes');
  await boton.click();
  await expect(dlg.locator('[data-cual="anterior"]')).toHaveText('El mes pasado');
  await expect.poll(medida).toBe('1080x1350');
  await page.keyboard.press('Escape');
  // La de la sesión vuelve a enseñar el pulso y no el selector de periodo.
  await expect(dlg.locator('#compartir-cual')).toBeHidden();
});

// Etapa 21: tras un hito (aquí, un récord de distancia) el resumen ofrece compartir arriba; una sesión normal no insiste.
test('el resumen ofrece compartir arriba solo tras un hito', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await expect(page.locator('#hoja-hito')).toBeHidden();
  await page.locator('#hoja-cerrar').click();
  await remar(page, 90_000);
  await terminar(page);
  await expect(page.locator('#hoja-hito')).toBeVisible();
  await expect(page.locator('#hoja-hito-texto')).toHaveText(/Compárte(lo|la)$/);
  await page.locator('#btn-hito-compartir').click();
  await expect(page.locator('#compartir-dialogo')).toBeVisible();
});
