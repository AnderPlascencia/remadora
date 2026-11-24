import { readFileSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { test, expect, INICIO_RELOJ, abrirRespaldo, restaurar, contar } from './ayuda.mjs';
import { RESPALDOS_VIEJOS } from '../datos/respaldos-viejos.mjs';

// Etapa 22 (QA-12): respaldos con el formato de versiones viejas se restauran en la actual con los mismos totales,
// marcas, XP, nivel y monedas. Los números esperados están en pruebas/datos/esperado-respaldos.json: si un cambio
// los mueve a propósito (⚖ XP o recompensas), vuelve a escribirlos con ACTUALIZAR_DATOS=1 y explica el cambio.
const RUTA_ESPERADO = new URL('../datos/esperado-respaldos.json', import.meta.url);
const ACTUALIZAR = !!process.env.ACTUALIZAR_DATOS;
const esperado = ACTUALIZAR ? {} : JSON.parse(readFileSync(RUTA_ESPERADO, 'utf8'));

// Lo que mira la prueba, calculado en la página con el historial ya restaurado (y reparado).
// Con ligeras, la lista sin muestras (etapa 23): cada sesión con su resumen guardado da los mismos números.
const resumenEnLaPagina = (page, ligeras = false) => page.evaluate(async (ligeras) => {
  const H = await import('./src/historial.js');
  const E = await import('./src/estadisticas.js');
  const ses = ligeras ? await H.sinMuestras() : await H.sesiones();
  const per = JSON.parse(localStorage.getItem('personaje') || '{}');
  const h = H.estadoJuegoDe(ses, { ftp: Number(localStorage.getItem('ftp')) || 0, per });
  const records = Object.fromEntries(Object.entries(E.calcularRecords(ses)).map(([k, r]) => [k, r.valor]).sort());
  return {
    sesiones: ses.length,
    metros: ses.reduce((a, s) => a + s.distancia, 0),
    reparadas: ses.filter((s) => s.reparada).length,
    records, xp: h.xp, nivel: h.nivel, monedas: h.monedas, clase: per.clase || null,
  };
}, ligeras);

// Resúmenes guardados en la base (no solo en memoria), y de la versión actual.
const resumenesGuardados = (page) => page.evaluate(async () => {
  const db = await import('./src/db.js');
  const { RESUMEN_V } = await import('./src/resumen.js');
  const l = await db.listar('sesiones');
  return l.filter((s) => s.res?.v === RESUMEN_V && s.res.n > 0).length;
});

for (const [nombre, armar] of Object.entries(RESPALDOS_VIEJOS)) {
  test(`un respaldo de la ${nombre} se restaura con los mismos totales, marcas, XP y monedas`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const datos = armar();
    const archivo = info.outputPath(`respaldo-${nombre}.json`);
    await writeFile(archivo, JSON.stringify(datos));
    await page.clock.install({ time: INICIO_RELOJ });
    await page.goto('./');
    await page.locator('#inicio-saltar').click();
    await abrirRespaldo(page);
    await restaurar(page, archivo);
    const buenas = datos.sesiones.filter((s) => typeof s.duracion === 'number').length;
    await expect.poll(() => contar(page, 'sesiones'), { timeout: 30_000 }).toBe(buenas);
    // Con otro héroe, la app se recarga sola tras restaurar; luego corre la reparación del historial.
    await page.clock.runFor(3_000);
    await page.waitForLoadState();
    await page.clock.runFor(3_000);
    await expect.poll(async () => (await resumenEnLaPagina(page)).clase).toBe(datos.ajustes.personaje.clase ?? JSON.parse(datos.ajustes.personaje).clase);
    const r = await resumenEnLaPagina(page);
    if (ACTUALIZAR) {
      const todo = (() => { try { return JSON.parse(readFileSync(RUTA_ESPERADO, 'utf8')); } catch { return {}; } })();
      writeFileSync(RUTA_ESPERADO, `${JSON.stringify({ ...todo, [nombre]: r }, null, 2)}\n`);
      return;
    }
    // La reparación del historial corre tras restaurar y antes de la recarga: se espera a que termine (antes la prueba
    // leía a veces a media reparación y daba 1 m de diferencia).
    await expect.poll(() => resumenEnLaPagina(page), { timeout: 20_000 }).toEqual(esperado[nombre]);
    // ⚖ Etapa 23: sin muestras, con los resúmenes, salen los mismos totales, marcas, XP, nivel y monedas.
    expect(await resumenEnLaPagina(page, true)).toEqual(esperado[nombre]);
    await expect.poll(() => resumenesGuardados(page)).toBe(buenas);
  });
}
