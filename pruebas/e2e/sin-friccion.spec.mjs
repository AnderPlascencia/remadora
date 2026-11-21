// Etapa 16: empezar y seguir la sesión sin fricción.
import { test, expect, abrirApp, completarBienvenida, esperarAviso, avanzar } from './ayuda.mjs';

test('primer día sin ruido y Empezar desde el modo remo, con pulsación larga y «solo un número»', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  // El primer día: ni consejo de la pestaña ni opciones de carrera; las preguntas de antes de remar, encima de Empezar.
  await expect(page.locator('#vista-entrenar .consejo')).toHaveCount(0);
  await expect(page.locator('#opciones-carrera')).toBeHidden();
  expect(await page.evaluate(() => !!(document.querySelector('#antes-remar').compareDocumentPosition(document.querySelector('#btn-grabar')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

  // Con el teléfono ya en el soporte: Empezar está dentro del modo remo.
  await page.locator('#btn-modo-remo').click();
  const mr = page.locator('#modo-remo');
  await expect(mr).toBeVisible();
  await expect(page.locator('#mr-empezar')).toBeVisible();
  await expect(page.locator('#mr-terminar')).toBeHidden();
  await expect(page.locator('#mr-meta-texto')).toHaveText('Pulsa Empezar');
  await page.locator('#mr-empezar').click();
  await expect(page.locator('#mr-pausa')).toBeVisible();
  await expect(page.locator('#mr-empezar')).toBeHidden();
  await avanzar(page, 5_000);

  // Mantener pulsado pausa, sin buscar el botón.
  const caja = await page.locator('#mr-principal').boundingBox();
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.clock.runFor(700);
  await page.mouse.up();
  await expect(page.locator('#mr-pausa')).toContainText('Seguir');
  await page.locator('#mr-pausa').click();
  await expect(page.locator('#mr-pausa')).toContainText('Pausar');

  // La vista «solo un número» va justo después de los números grandes.
  await page.evaluate(() => localStorage.setItem('vistaRemo', 'numeros'));
  await page.locator('#mr-vista').click();
  await expect(mr).toHaveClass(/vista-uno/);
  await expect(page.locator('#modo-remo .mr-grid')).toBeHidden();
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#mr-watts')).fontSize))).toBeGreaterThanOrEqual(150);
  // Después de la primera sesión ya no es el primer día.
  expect(await page.evaluate(async () => (await import('/src/estado.js')).estado.primerDia)).toBe(false);
});

test('«Empezar al dar la primera palada» arranca la sesión con la primera potencia', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  await page.locator('#btn-modo-remo').click();
  await expect(page.locator('#mr-auto')).toBeVisible();
  await page.locator('#in-empezar-palada').check();
  await expect(page.locator('#mr-meta-texto')).toHaveText('Rema y empieza solo');
  expect(await page.evaluate(() => localStorage.getItem('empezarPalada'))).toBe('1');
  await avanzar(page, 4_000);
  await expect(page.locator('#mr-pausa')).toBeVisible();
  await expect(page.locator('#mr-auto')).toBeHidden();
});

test('los atajos del icono abren el modo remo listo para empezar', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  const nombre = await page.locator('#hoy-nombre').textContent();
  await page.goto('./?atajo=libre');
  await expect(page.locator('#modo-remo')).toBeVisible();
  await expect(page.locator('#mr-nombre')).toHaveText('Remo libre');
  expect(new URL(page.url()).search).toBe('');
  await page.goto('./?atajo=hoy');
  await expect(page.locator('#modo-remo')).toBeVisible();
  await expect(page.locator('#mr-empezar')).toBeVisible();
  expect(nombre).toBeTruthy();
  const manifiesto = await (await page.request.get('./manifest.webmanifest')).json();
  expect(manifiesto.shortcuts.map((a) => a.url)).toEqual(['./?atajo=hoy', './?atajo=libre']);
});
