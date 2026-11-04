import { readFile } from 'node:fs/promises';
import { test, expect, abrirApp, completarBienvenida, remar, terminar, listar } from './ayuda.mjs';

// La app solo registra el service worker en https (GitHub Pages); aquí se sirve por http, así que la prueba
// lo registra igual que src/app.js (sw.js?v=<versión>) y luego corta la red.
test('sin conexión la app abre desde la caché y una sesión se guarda igual', async ({ page, context }) => {
  await abrirApp(page);
  const v = (await readFile(new URL('../../src/version.js', import.meta.url), 'utf8')).match(/VERSION = '([^']+)'/)[1];
  const version = `remadora-${v}`;
  await page.evaluate(async (ver) => {
    await navigator.serviceWorker.register(`sw.js?v=${ver}`);
    await navigator.serviceWorker.ready;
  }, v);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30_000 }).toBe(true);
  expect(await page.evaluate(() => caches.keys())).toEqual([version]);
  const guardados = await page.evaluate(async (v) => (await (await caches.open(v)).keys()).map((r) => new URL(r.url).pathname), version);
  for (const f of ['/', '/src/app.js', '/src/estilos.css', '/src/carrera.js', '/manifest.webmanifest']) expect(guardados).toContain(f);
  // Los vídeos de la vista realista son de una clase: no se precargan al instalar.
  expect(guardados.filter((f) => f.endsWith('.mp4'))).toEqual([]);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#inicio-titulo')).toHaveText('Hola, soy Rower');
  await completarBienvenida(page);
  await remar(page, 20_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  expect(await listar(page, 'sesiones')).toHaveLength(1);
});
