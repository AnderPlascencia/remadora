// I-3 (N5 de la ronda 2): si la app se cierra después de guardar la sesión y antes de descontar el objeto usado, el
// objeto se descuenta al volver a abrirla, una sola vez. Las sesiones de antes (sin `gasto`) no se tocan.
import { test, expect } from './ayuda.mjs';

const personaje = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('personaje') || '{}'));

test('el objeto de una sesión guardada sin descontar se descuenta al abrir, y solo una vez', async ({ page }) => {
  await page.goto('./manifest.webmanifest');
  const fecha = await page.evaluate(() => new Promise((ok, mal) => {
    const req = indexedDB.open('remadora', 4);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('sesiones', { keyPath: 'id', autoIncrement: true }).createIndex('fecha', 'fecha');
      d.createObjectStore('entrenamientos', { keyPath: 'id', autoIncrement: true });
      d.createObjectStore('estado');
      d.createObjectStore('muestras');
      d.createObjectStore('rr');
    };
    req.onerror = () => mal(req.error);
    req.onsuccess = () => {
      const t = req.result.transaction(['sesiones', 'muestras', 'estado'], 'readwrite');
      const muestras = Array.from({ length: 600 }, (_, i) => ({ t: i + 1, w: 150, spm: 24, split: 120, dist: Math.round((i + 1) * 4.2), nivel: 8, fc: 0 }));
      const f = Date.now() - 3 * 36e5;
      // La de hoy quedó guardada con su estandarte sin descontar; la de hace 3 días es de antes de I-3 (ya descontada).
      for (const s of [{ fecha: f, ventajaUsada: 'estandarte', gasto: 1 }, { fecha: f - 3 * 864e5, ventajaUsada: 'estandarte' }]) {
        const r = t.objectStore('sesiones').put({ ...s, duracion: 600, distancia: 2520, distFuente: 'watts', uid: crypto.randomUUID() });
        r.onsuccess = () => t.objectStore('muestras').put(muestras, r.result);
      }
      t.objectStore('estado').put(3, 'versionDatos');
      t.oncomplete = () => { req.result.close(); ok(f); };
    };
  }));
  await page.evaluate(() => {
    localStorage.setItem('inicioHecho', '1');
    localStorage.setItem('personaje', JSON.stringify({ clase: 'romano', nombre: '', tiendaVentajas: true, inventario: { estandarte: 2 } }));
  });
  await page.goto('./');
  await expect(page.locator('#btn-grabar')).toBeVisible();
  await expect.poll(async () => (await personaje(page)).inventario?.estandarte).toBe(1);
  expect((await personaje(page)).gastos).toEqual([fecha]);
  // Al volver a abrir no se descuenta otra vez.
  await page.reload();
  await expect(page.locator('#btn-grabar')).toBeVisible();
  await page.waitForTimeout(1000);
  expect((await personaje(page)).inventario.estandarte).toBe(1);
});
