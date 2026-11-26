// I-2 (INF-R3): el respaldo de 600 sesiones de 30 min no carga el historial entero en memoria. Antes juntaba todas
// las sesiones con sus muestras: en Chromium de escritorio, 59 MB vivos y un pico de 135 MB (~270 MB medidos en el
// teléfono). Ahora van de 5 en 5 de la base al gzip: 3 MB vivos y un pico de 14 MB.
import { test, expect, abrirRespaldo } from './ayuda.mjs';
import { resumir } from '../../src/resumen.js';

const N = 600;
const SEG = 1800;
const muestras = Array.from({ length: SEG }, (_, k) => ({ t: k + 1, w: 150 + (k % 40), spm: 22 + (k % 5), split: 118 + (k % 6), dist: Math.round((k + 1) * 4.2), nivel: 8, fc: 120 + (k % 30) }));
// El mismo resumen para todas (si faltara, la app lo calcularía al abrir leyendo todas las muestras).
const res = resumir({ fecha: 1, duracion: SEG, distancia: 7560, muestras });

test('respaldo de 600 sesiones: el pico de memoria queda bajo 30 MB y el archivo trae todas', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('./manifest.webmanifest');
  await page.evaluate(async ({ N, SEG, muestras, res }) => {
    await new Promise((ok, mal) => {
      const req = indexedDB.open('remadora', 3);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('sesiones', { keyPath: 'id', autoIncrement: true }).createIndex('fecha', 'fecha');
        d.createObjectStore('entrenamientos', { keyPath: 'id', autoIncrement: true });
        d.createObjectStore('estado');
        d.createObjectStore('muestras');
      };
      req.onerror = () => mal(req.error);
      req.onsuccess = () => {
        const t = req.result.transaction(['sesiones', 'muestras', 'estado'], 'readwrite');
        const hoy = Date.parse('2026-11-03T08:00');
        for (let i = 0; i < N; i++) {
          const r = t.objectStore('sesiones').put({ fecha: hoy - (i + 1) * 0.4 * 864e5, duracion: SEG, distancia: 7560, wattsProm: 170, res });
          r.onsuccess = () => t.objectStore('muestras').put(muestras, r.result);
        }
        t.objectStore('estado').put(3, 'versionDatos');
        t.oncomplete = () => { req.result.close(); ok(); };
      };
    });
  }, { N, SEG, muestras, res });
  await page.evaluate(() => localStorage.setItem('inicioHecho', '1'));
  await page.goto('./');
  await expect(page.locator('#btn-grabar')).toBeVisible();
  // Progreso avisa cuántas sesiones quedarían sin respaldo.
  await page.locator('#tab-historial').click();
  await expect(page.locator('#aviso-respaldo')).toContainText(`Aún no guardas un respaldo: tienes ${N} sesiones sin respaldo.`);
  await abrirRespaldo(page);
  await page.waitForTimeout(1500);

  // Memoria del montón de JavaScript cada 50 ms mientras se arma el respaldo (CDP, en bytes).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const base = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  let pico = base;
  let midiendo = true;
  // Dos medidas: el pico tal cual (con la basura que V8 aún no recoge, que en el teléfono recoge antes porque tiene
  // menos memoria) y lo que de verdad queda vivo, recogiendo la basura cada 250 ms.
  let vivo = base;
  const medir = (async () => {
    for (let i = 0; midiendo; i++) {
      if (i % 5 === 4) { await cdp.send('HeapProfiler.collectGarbage'); vivo = Math.max(vivo, (await cdp.send('Runtime.getHeapUsage')).usedSize); }
      pico = Math.max(pico, (await cdp.send('Runtime.getHeapUsage')).usedSize);
      await new Promise((ok) => setTimeout(ok, 50));
    }
  })();
  const descarga = page.waitForEvent('download', { timeout: 180_000 });
  await page.locator('#btn-respaldo').click();
  const d = await descarga;
  midiendo = false;
  await medir;
  const mb = (x) => (x - base) / 2 ** 20;
  console.log(`respaldo de ${N} sesiones: vivo ${mb(vivo).toFixed(1)} MB, pico ${mb(pico).toFixed(1)} MB (sobre ${(base / 2 ** 20).toFixed(1)} MB)`);
  expect(mb(vivo)).toBeLessThan(30);
  expect(mb(pico)).toBeLessThan(30);
  // El archivo trae las 600, con sus muestras.
  const { gunzipSync } = await import('node:zlib');
  const { readFile } = await import('node:fs/promises');
  const ruta = test.info().outputPath('r.json.gz');
  await d.saveAs(ruta);
  const gz = await readFile(ruta);
  console.log(`archivo: ${(gz.length / 2 ** 20).toFixed(1)} MB comprimido`);
  const datos = JSON.parse(gunzipSync(gz).toString("utf8"));
  expect(datos.sesiones).toHaveLength(N);
  expect(datos.sesiones.every((s) => s.muestras?.length === SEG)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__avisos.join(' | '))).toContain(`Respaldo listo: ${N} sesiones`);
  // Con el respaldo al día, el aviso ya no sale.
  await page.locator('#tab-historial').click();
  await expect(page.locator('#aviso-respaldo')).toBeHidden();
});
