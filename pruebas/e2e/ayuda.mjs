// Utilidades compartidas por las pruebas end to end.
import { readFile } from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';

// Cada página falla la prueba si lanza un error de JavaScript. Los avisos (toast) quedan en window.__avisos
// porque se reemplazan entre sí y duran 3 s. Compartir archivos se apaga para que el respaldo se descargue.
async function prepararPagina(page) {
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => {
    window.__avisos = [];
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    // «interactive» llega antes de que corran los módulos: no se pierde ningún aviso del arranque.
    document.addEventListener('readystatechange', () => {
      const t = document.getElementById('toast');
      if (document.readyState !== 'interactive' || !t) return;
      new MutationObserver(() => { if (!t.hidden && t.textContent) window.__avisos.push(t.textContent); })
        .observe(t, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    });
  });
  return errores;
}

export const test = base.extend({
  page: async ({ page }, usar) => {
    const errores = await prepararPagina(page);
    await usar(page);
    expect(errores, 'errores de JavaScript en la página').toEqual([]);
  },
  // otroTelefono(): una página en un navegador limpio (otro perfil, sin datos), preparada igual que `page`.
  otroTelefono: async ({ browser }, usar, info) => {
    const abiertos = [];
    await usar(async () => {
      const ctx = await browser.newContext({ ...info.project.use });
      const pagina = await ctx.newPage();
      abiertos.push({ ctx, errores: await prepararPagina(pagina) });
      return pagina;
    });
    for (const { ctx, errores } of abiertos) {
      await ctx.close();
      expect(errores, 'errores de JavaScript en otro teléfono').toEqual([]);
    }
  },
});
export { expect };

// Con el reloj simulado avanza en pasos de 10 s (el temporizador de la sesión corre cada segundo);
// sin él, espera de verdad.
export async function avanzar(page, ms, { reloj = true } = {}) {
  if (!reloj) { await page.waitForTimeout(ms); return; }
  for (let t = 0; t < ms; t += 10_000) await page.clock.runFor(Math.min(10_000, ms - t));
}

// El reloj simulado arranca siempre un miércoles a mediodía: con la fecha real, en domingo el plan de la
// bienvenida no tiene sesión y las pruebas que esperan «Hoy toca» fallaban según el día en que corrían.
export const INICIO_RELOJ = new Date('2026-11-04T12:00:00');

export async function abrirApp(page, { reloj = true } = {}) {
  if (reloj) await page.clock.install({ time: INICIO_RELOJ });
  await page.goto('./');
}

// Bienvenida con la primera opción de cada pregunta y el modo demo al final.
export async function completarBienvenida(page, opciones = {}) {
  const inicio = page.locator('#inicio');
  await expect(inicio).toBeVisible();
  for (let paso = 0; paso < 6; paso++) {
    for (const grupo of await page.locator('#inicio [role=radiogroup]:visible').all()) {
      const opcion = grupo.locator('button, [role=radio]').first();
      if (await opcion.count()) await opcion.click();
    }
    if (await page.locator('#inicio-demo').isVisible()) break;
    await page.locator('#inicio-siguiente').click();
    await avanzar(page, 500, opciones);
  }
  await page.locator('#inicio-demo').click();
  await expect(inicio).toBeHidden();
  await expect(page.locator('#estado')).toHaveText('Modo demo');
}

export const avisos = (page) => page.evaluate(() => window.__avisos);

// Avanza el reloj de a poco hasta que salga un aviso que cumpla `patron`.
export async function esperarAviso(page, patron, { hasta = 10_000, reloj = true } = {}) {
  // El límite cuenta en tiempo simulado y también en real: leer un archivo o IndexedDB no avanza con el reloj
  // simulado, y con varias pruebas a la vez puede tardar más que 40 vueltas del bucle.
  const finReal = Date.now() + 15_000;
  for (let t = 0; t <= hasta || Date.now() < finReal; t += 250) {
    const encontrado = (await avisos(page)).find((a) => patron.test(a));
    if (encontrado) return encontrado;
    if (t <= hasta) await avanzar(page, 250, { reloj });
    else await page.waitForTimeout(100);
  }
  throw new Error(`no salió el aviso ${patron}; salieron: ${JSON.stringify(await avisos(page))}`);
}

// Lee la base de datos de la app (IndexedDB «remadora»).
export function listar(page, almacen) {
  return page.evaluate((a) => new Promise((ok, mal) => {
    const req = indexedDB.open('remadora');
    req.onerror = () => mal(req.error);
    req.onsuccess = () => {
      const db = req.result;
      // Las sesiones se leen con sus muestras, que desde la v3 de la base van en su propio almacén.
      const juntar = a === 'sesiones' && db.objectStoreNames.contains('muestras');
      const t = db.transaction(juntar ? ['sesiones', 'muestras'] : a);
      const l = t.objectStore(a).getAll();
      const m = juntar ? t.objectStore('muestras') : null;
      const ms = m?.getAll();
      const ks = m?.getAllKeys();
      t.oncomplete = () => {
        db.close();
        if (!juntar) { ok(l.result); return; }
        const mapa = new Map(ks.result.map((k, i) => [k, ms.result[i]]));
        ok(l.result.map((s) => (s.muestras || !mapa.has(s.id) ? s : { ...s, muestras: mapa.get(s.id) })));
      };
      t.onerror = () => mal(t.error);
    };
  }), almacen);
}

// Cuántos registros hay en un almacén, sin traerlos (con 10 semanas de muestras, listar pesa varios MB).
export function contar(page, almacen) {
  return page.evaluate((a) => new Promise((ok, mal) => {
    const req = indexedDB.open('remadora');
    req.onerror = () => mal(req.error);
    req.onsuccess = () => {
      const c = req.result.transaction(a).objectStore(a).count();
      c.onsuccess = () => { req.result.close(); ok(c.result); };
      c.onerror = () => mal(c.error);
    };
  }), almacen);
}

// Lee una clave del almacén «estado» (sesión en curso, versión de los datos).
export function leerEstado(page, clave) {
  return page.evaluate((k) => new Promise((ok, mal) => {
    const req = indexedDB.open('remadora');
    req.onerror = () => mal(req.error);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('estado')) { db.close(); ok(null); return; }
      const l = db.transaction('estado').objectStore('estado').get(k);
      l.onsuccess = () => { db.close(); ok(l.result ?? null); };
      l.onerror = () => mal(l.error);
    };
  }), clave);
}

// La copia de la sesión en curso: en IndexedDB y, si falló, en localStorage.
export async function enCurso(page) {
  return (await leerEstado(page, 'enCurso'))
    ?? page.evaluate(() => { try { return JSON.parse(localStorage.getItem('sesionEnCurso') || 'null'); } catch { return null; } });
}

// Empieza la sesión que propone la tarjeta Hoy y rema `ms` en modo demo.
export async function remar(page, ms, opciones) {
  await page.locator('#btn-grabar').click();
  await avanzar(page, ms, opciones);
}

// Terminar pide dos toques.
export async function terminar(page) {
  const boton = page.locator('#btn-grabar');
  await boton.click();
  await expect(boton).toContainText('¿Terminar?');
  await boton.click();
}

// Ajustes › Respaldo, con la sección abierta.
export async function abrirRespaldo(page) {
  await page.locator('#tab-ajustes').click();
  const seccion = page.locator('details[data-seccion="respaldo"]');
  if ((await seccion.getAttribute('open')) === null) await seccion.locator('summary').click();
  await expect(page.locator('#btn-respaldo')).toBeVisible();
}

// Restaurar: `archivo` es una ruta o { name, mimeType, buffer }.
export async function restaurar(page, archivo) {
  await page.locator('#in-restaurar').setInputFiles(archivo);
}

// Guarda el respaldo (se descarga) en `ruta` y devuelve su contenido.
export async function guardarRespaldo(page, ruta) {
  const descarga = page.waitForEvent('download');
  await page.locator('#btn-respaldo').click();
  await (await descarga).saveAs(ruta);
  return JSON.parse(await readFile(ruta, 'utf8'));
}

// Ajustes de localStorage indicados, como texto (null si faltan).
export const leerAjustes = (page, claves) => page.evaluate((cs) => Object.fromEntries(cs.map((k) => [k, localStorage.getItem(k)])), claves);
