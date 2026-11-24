import { test, expect, abrirApp, completarBienvenida, esperarAviso, remar, terminar, avanzar } from './ayuda.mjs';

// Etapa 25, «Rema contra mí»: la imagen se comparte con un enlace; quien lo abre tiene esa sesión en su carril.
test('compartir manda el enlace del reto y quien lo abre rema contra esa sesión', async ({ page, otroTelefono }) => {
  test.setTimeout(120_000);
  await abrirApp(page);
  await completarBienvenida(page);
  await esperarAviso(page, /^Tu plan está listo/);
  await remar(page, 90_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await page.evaluate(() => {
    window.__compartido = null;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (datos) => { window.__compartido = { text: datos.text, url: datos.url, archivos: datos.files?.length || 0 }; } });
  });
  await page.locator('#btn-compartir-img').click();
  await expect(page.locator('#compartir-reto-campo')).toBeVisible();
  await expect(page.locator('#compartir-reto')).toBeChecked();
  await page.locator('#compartir-enviar').click();
  await expect.poll(() => page.evaluate(() => window.__compartido)).not.toBeNull();
  const enviado = await page.evaluate(() => window.__compartido);
  expect(enviado.archivos).toBe(1);
  expect(enviado.text).toMatch(/te reta: remé [\d,]+ m en \d+ min/);
  const url = new URL(enviado.url);
  expect(url.searchParams.get('reto')).toBeTruthy();

  // Otro teléfono abre el enlace, pasa la bienvenida y encuentra el reto encendido en su carril.
  const b = await otroTelefono();
  await b.clock.install({ time: new Date('2026-11-05T12:00:00') });
  await b.goto(`./?${url.searchParams.toString()}`);
  await expect(b.locator('#toast')).toContainText('te reta');
  expect(new URL(b.url()).search).toBe('');
  await completarBienvenida(b);
  await avanzar(b, 4000);
  await b.locator('#btn-cambiar').click();
  await b.locator('#modo-ent [data-modo="libre"]').click();
  const chip = b.locator('#chips-rival [data-rival="reto"]');
  await expect(chip).not.toHaveAttribute('hidden', '');
  await expect(chip).toHaveText(/^Reto de /);
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await b.locator('#btn-grabar').click();
  await expect.poll(() => b.evaluate(async () => !!(await import('./src/estado.js')).estado.sesion)).toBe(true);
  const refs = await b.evaluate(async () => (await import('./src/estado.js')).estado.sesion.referencias.map((r) => ({ clave: r.clave, n: r.muestras.length })));
  expect(refs).toContainEqual(expect.objectContaining({ clave: 'reto' }));
  expect(refs.find((r) => r.clave === 'reto').n).toBeGreaterThanOrEqual(80);
});

test('un enlace de reto dañado no rompe nada y avisa', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00') });
  await page.goto('./?reto=esto-no-es-un-reto');
  await expect(page.locator('#toast')).toHaveText('No se pudo leer el enlace del reto');
  expect(await page.evaluate(() => localStorage.getItem('retoActivo'))).toBeNull();
});
