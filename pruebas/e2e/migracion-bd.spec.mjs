import { test, expect, listar, leerEstado } from './ayuda.mjs';

// Quien ya tenía la app (base de datos versión 1) conserva su historial al pasar a la versión actual (3), con
// las muestras de cada sesión movidas a su propio almacén.
test('al actualizar la base de datos se conservan sesiones y entrenamientos', async ({ page }) => {
  await page.goto('./manifest.webmanifest');
  await page.evaluate(() => new Promise((ok, mal) => {
    const req = indexedDB.open('remadora', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('sesiones', { keyPath: 'id', autoIncrement: true });
      req.result.createObjectStore('entrenamientos', { keyPath: 'id', autoIncrement: true });
    };
    req.onerror = () => mal(req.error);
    req.onsuccess = () => {
      const t = req.result.transaction(['sesiones', 'entrenamientos'], 'readwrite');
      const muestras = Array.from({ length: 60 }, (_, i) => ({ t: i + 1, w: 150, spm: 24, split: 120, dist: Math.round((i + 1) * 4.2), nivel: 8, fc: 0 }));
      t.objectStore('sesiones').put({ fecha: Date.now() - 864e5, duracion: 60, distancia: 252, distFuente: 'watts', muestras });
      t.objectStore('entrenamientos').put({ nombre: 'Mío', bloques: [] });
      t.oncomplete = () => { req.result.close(); ok(); };
    };
  }));
  await page.evaluate(() => localStorage.setItem('inicioHecho', '1'));
  await page.goto('./');
  await expect(page.locator('#btn-grabar')).toBeVisible();
  await expect.poll(() => leerEstado(page, 'versionDatos')).toBe(1);
  const [s] = await listar(page, 'sesiones');
  expect(s.muestras).toHaveLength(60);
  expect((await listar(page, 'entrenamientos')).map((e) => e.nombre)).toContain('Mío');
  expect(await page.evaluate(() => new Promise((ok) => {
    const req = indexedDB.open('remadora');
    req.onsuccess = () => {
      const db = req.result;
      const t = db.transaction(['sesiones', 'muestras']);
      const crudas = t.objectStore('sesiones').getAll();
      const muestras = t.objectStore('muestras').getAll();
      const indices = [...t.objectStore('sesiones').indexNames];
      t.oncomplete = () => {
        db.close();
        ok({ version: db.version, conMuestras: crudas.result.filter((x) => x.muestras).length, aparte: muestras.result.map((m) => m.length), indices });
      };
    };
  }))).toEqual({ version: 3, conMuestras: 0, aparte: [60], indices: ['fecha'] });
});
