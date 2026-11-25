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

// ⚖ Ronda 2, R2-6: ganarle a un reto (desde el 26 de noviembre) tiene su línea en el resumen, el botón para devolverlo
// y el mensaje dice por cuánto ganaste (en segundos: el reto es de distancia). El logro «Primer reto aceptado» sale sin XP.
test('ganarle a un reto: su línea en el resumen, el logro y el mensaje para devolverlo', async ({ page }) => {
  test.setTimeout(150_000);
  await page.clock.install({ time: new Date('2026-11-26T12:00:00') });
  await page.goto('./');
  // Un 500 m remado a 2 m/s: 250 s.
  const codigo = await page.evaluate(async () => {
    const F = await import('./src/fantasma.js');
    const muestras = Array.from({ length: 260 }, (_, i) => ({ t: i + 1, dist: (i + 1) * 2 }));
    return F.codificarReto({ fecha: Date.now() - 3 * 864e5, duracion: 260, entrenamiento: 'Prueba 500 m', muestras }, 'Ana');
  });
  // Desde «./» solo cambiaría el fragmento, sin recargar: se abre como enlace nuevo.
  await page.goto(`./?abrir=1#reto=${codigo}`);
  await expect(page.locator('#toast')).toContainText('te reta');
  await completarBienvenida(page);
  await avanzar(page, 4000);
  await page.evaluate(async () => (await import('./src/pantallas/heroe.js')).prepararEntrenamiento('base:prueba-500'));
  await expect(page.locator('#chips-rival [data-rival="reto"]')).toHaveAttribute('aria-pressed', 'true');
  await remar(page, 200_000);
  await page.locator('#fin-terminar').click();
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await expect(page.locator('#hoja-xp .xp-ganarte')).toContainText(/Le ganaste a Ana por \d+ s/);
  await expect(page.locator('#hoja-hito-texto')).toHaveText('¡Le ganaste a Ana! Devuélvele el reto');
  await page.locator('#hoja-xp .xp-desglose > summary').click();
  await expect(page.locator('#hoja-xp .xp-desglose')).toContainText('Logro: Primer reto aceptado');
  await page.evaluate(() => {
    window.__compartido = null;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (datos) => { window.__compartido = { text: datos.text, url: datos.url }; } });
  });
  await page.locator('#btn-compartir-img').click();
  await page.locator('#compartir-enviar').click();
  await expect.poll(() => page.evaluate(() => window.__compartido)).not.toBeNull();
  const enviado = await page.evaluate(() => window.__compartido);
  expect(enviado.text).toMatch(/^Le gané a tu reto, Ana, por \d+ s\. Remé [\d,]+ m en \d+ min en «Prueba 500 m»\. ¿Me alcanzas ahora\?/);
  expect(new URLSearchParams(new URL(enviado.url).hash.slice(1)).get('reto')).toBeTruthy();
});
