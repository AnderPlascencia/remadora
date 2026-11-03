import { test, expect, abrirApp, completarBienvenida, remar, terminar, listar, enCurso, esperarAviso, avanzar } from './ayuda.mjs';

// Android puede cerrar la app a media sesión: al volver a abrirla se ofrece guardar lo remado.
test.beforeEach(async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await remar(page, 30_000);
  expect((await enCurso(page)).muestras.length).toBeGreaterThanOrEqual(20);
  await page.reload();
  await page.clock.runFor(1_000);
});

test('al recargar a media sesión se ofrece guardarla y se guarda una sola vez', async ({ page }) => {
  const dialogo = page.locator('#recuperar-dialogo');
  await expect(dialogo).toBeVisible();
  await expect(page.locator('#recuperar-texto')).toContainText(/0:[23]\d y \d+ m\. La app se cerró antes de terminarla\./);
  await page.locator('#recuperar-guardar').click();
  await expect(dialogo).toBeHidden();
  await expect(page.locator('#hoja-titulo')).toBeVisible();

  const sesiones = await listar(page, 'sesiones');
  expect(sesiones).toHaveLength(1);
  expect(sesiones[0].duracion).toBeGreaterThanOrEqual(20);
  expect(await enCurso(page)).toBeNull();

  await page.reload();
  await page.clock.runFor(1_000);
  await expect(dialogo).toBeHidden();
  expect(await listar(page, 'sesiones')).toHaveLength(1);
});

test('descartar la sesión recuperada no guarda nada', async ({ page }) => {
  await expect(page.locator('#recuperar-dialogo')).toBeVisible();
  await page.locator('#recuperar-descartar').click(); // el confirm() lo acepta la prueba
  await esperarAviso(page, /^Sesión descartada$/);
  expect(await listar(page, 'sesiones')).toHaveLength(0);
  expect(await enCurso(page)).toBeNull();
});

test('una copia dañada en el almacenamiento no rompe el arranque', async ({ page }) => {
  // La copia vive en IndexedDB (y en localStorage si IndexedDB falló): se dañan las dos.
  await page.evaluate(() => new Promise((ok) => {
    localStorage.setItem('sesionEnCurso', '{roto');
    const req = indexedDB.open('remadora');
    req.onsuccess = () => {
      const t = req.result.transaction('estado', 'readwrite');
      t.objectStore('estado').put('{roto', 'enCurso');
      t.oncomplete = () => { req.result.close(); ok(); };
    };
  }));
  await page.reload();
  await page.clock.runFor(1_000);
  await expect(page.locator('#recuperar-dialogo')).toBeHidden();
  await expect(page.locator('#btn-grabar')).toBeVisible();
});

test('seguir remando suma lo nuevo a la misma sesión', async ({ page }) => {
  const copia = await enCurso(page);
  await expect(page.locator('#recuperar-dialogo')).toBeVisible();
  // Tras reabrir la app no hay conexión: en la prueba, el modo demo hace de remadora.
  await page.evaluate(() => document.querySelector('#btn-demo').click());
  await expect(page.locator('#estado')).toHaveText('Modo demo');
  await page.locator('#recuperar-seguir').click();
  await expect(page.locator('#recuperar-dialogo')).toBeHidden();
  await expect(page.locator('#btn-grabar')).toContainText('Terminar');
  await avanzar(page, 20_000);
  const sigue = await enCurso(page);
  expect(sigue.inicio).toBe(copia.inicio);
  expect(sigue.t).toBeGreaterThan(copia.t + 10);
  expect(sigue.muestras.map((m) => m.t)).toEqual(sigue.muestras.map((_, i) => i + 1));
  // El tiempo con la app cerrada queda como una pausa ya cerrada.
  expect(sigue.pausas.some((p) => p.t === copia.t && p.fin != null)).toBe(true);

  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toBeVisible();
  const sesiones = await listar(page, 'sesiones');
  expect(sesiones).toHaveLength(1);
  expect(sesiones[0].fecha).toBe(copia.inicio);
  expect(sesiones[0].duracion).toBeGreaterThan(copia.t + 10);
  expect(await enCurso(page)).toBeNull();
});
