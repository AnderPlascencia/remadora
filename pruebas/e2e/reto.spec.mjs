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
  // El reto va en el fragmento (#reto=): el navegador no lo manda al servidor.
  expect(url.search).toBe('');
  expect(new URLSearchParams(url.hash.slice(1)).get('reto')).toBeTruthy();

  // Otro teléfono abre el enlace, pasa la bienvenida y encuentra el reto encendido en su carril.
  const b = await otroTelefono();
  await b.clock.install({ time: new Date('2026-11-05T12:00:00') });
  await b.goto(`./${url.hash}`);
  await expect(b.locator('#toast')).toContainText('te reta');
  expect(new URL(b.url()).search).toBe('');
  expect(new URL(b.url()).hash).toBe('');
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

// QA-C3 de la ronda 2: un nombre con HTML no ejecuta nada en el aviso, los chips ni la carrera, y el enlace viejo
// (?reto=) sigue valiendo.
test('un reto con HTML en el nombre no ejecuta nada, y el enlace viejo con ?reto= sigue valiendo', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00') });
  await page.goto('./');
  const malo = '<img src=x onerror="window.__xss=1">🚣‍♀️ مرحبا';
  const codigo = await page.evaluate(async (n) => {
    const F = await import('./src/fantasma.js');
    const muestras = Array.from({ length: 600 }, (_, i) => ({ t: i + 1, dist: (i + 1) * 3.5 }));
    return F.codificarReto({ fecha: Date.now(), duracion: 600, entrenamiento: '<b onmouseover="window.__xss=1">Fondo</b>', muestras }, n);
  }, malo);
  await page.goto(`./?reto=${codigo}`);
  await expect(page.locator('#toast')).toContainText('te reta');
  expect(new URL(page.url()).search).toBe('');
  await completarBienvenida(page);
  await avanzar(page, 4000);
  await page.locator('#btn-cambiar').click();
  await page.locator('#modo-ent [data-modo="libre"]').click();
  const chip = page.locator('#chips-rival [data-rival="reto"]');
  await expect(chip).toContainText('<img');
  await page.locator('#btn-grabar').click();
  await avanzar(page, 5000);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('img[src="x"], b[onmouseover]').count()).toBe(0);
});

test('un enlace de reto dañado no rompe nada y avisa', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00') });
  await page.goto('./?reto=esto-no-es-un-reto');
  await expect(page.locator('#toast')).toHaveText('No se pudo leer el enlace del reto');
  expect(await page.evaluate(() => localStorage.getItem('retoActivo'))).toBeNull();
});
