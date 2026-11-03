// Utilidades compartidas por las pruebas end to end.
import { test as base, expect } from '@playwright/test';

// Cada prueba falla si la página lanza un error de JavaScript. Los avisos (toast) quedan en window.__avisos
// porque se reemplazan entre sí y duran 3 s. Compartir archivos se apaga para que el respaldo se descargue.
export const test = base.extend({
  page: async ({ page }, usar) => {
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
    await usar(page);
    expect(errores, 'errores de JavaScript en la página').toEqual([]);
  },
});
export { expect };

// Con el reloj simulado avanza en pasos de 10 s (el temporizador de la sesión corre cada segundo);
// sin él, espera de verdad.
export async function avanzar(page, ms, { reloj = true } = {}) {
  if (!reloj) { await page.waitForTimeout(ms); return; }
  for (let t = 0; t < ms; t += 10_000) await page.clock.runFor(Math.min(10_000, ms - t));
}

export async function abrirApp(page, { reloj = true } = {}) {
  if (reloj) await page.clock.install();
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
  for (let t = 0; t <= hasta; t += 250) {
    const encontrado = (await avisos(page)).find((a) => patron.test(a));
    if (encontrado) return encontrado;
    await avanzar(page, 250, { reloj });
  }
  throw new Error(`no salió el aviso ${patron}; salieron: ${JSON.stringify(await avisos(page))}`);
}

// Lee la base de datos de la app (IndexedDB «remadora»).
export function listar(page, almacen) {
  return page.evaluate((a) => new Promise((ok, mal) => {
    const req = indexedDB.open('remadora');
    req.onerror = () => mal(req.error);
    req.onsuccess = () => {
      const l = req.result.transaction(a).objectStore(a).getAll();
      l.onsuccess = () => { req.result.close(); ok(l.result); };
      l.onerror = () => mal(l.error);
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
