import { readFile } from 'node:fs/promises';
import { test, expect, abrirApp, completarBienvenida, remar, terminar, listar, esperarAviso } from './ayuda.mjs';

async function abrirRespaldo(page) {
  await page.locator('#tab-ajustes').click();
  const seccion = page.locator('details[data-seccion="respaldo"]');
  if ((await seccion.getAttribute('open')) === null) await seccion.locator('summary').click();
  await expect(page.locator('#btn-respaldo')).toBeVisible();
}

async function restaurar(page, archivo) {
  await page.locator('#in-restaurar').setInputFiles(archivo);
}

test('respaldo de ida y vuelta: lo guardado en un teléfono se restaura en otro sin duplicar', async ({ page, browser }, info) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await page.keyboard.press('Escape');
  const original = await listar(page, 'sesiones');
  expect(original).toHaveLength(1);

  await abrirRespaldo(page);
  const descarga = page.waitForEvent('download');
  await page.locator('#btn-respaldo').click();
  const archivo = info.outputPath('respaldo.json');
  await (await descarga).saveAs(archivo);
  await esperarAviso(page, /^Respaldo listo: 1 sesiones$/);

  const datos = JSON.parse(await readFile(archivo, 'utf8'));
  expect(datos.app).toBe('remadora');
  expect(datos.sesiones).toHaveLength(1);
  expect(datos.programa).toBeTruthy();
  expect(datos.ajustes.inicioHecho).toBe('1');
  expect(datos.ajustes.personaje).toBeTruthy();

  // Otro teléfono: navegador limpio.
  const ctx = await browser.newContext({ ...info.project.use });
  const otro = await ctx.newPage();
  const errores = [];
  otro.on('pageerror', (e) => errores.push(e.message));
  otro.on('dialog', (d) => d.accept());
  await otro.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }));
  await otro.goto('./');
  await otro.locator('#inicio-saltar').click();
  await abrirRespaldo(otro);
  await restaurar(otro, archivo);
  await expect(otro.locator('#toast')).toContainText('Restaurado: 1 sesiones');
  await otro.waitForLoadState();
  await expect.poll(() => listar(otro, 'sesiones').then((l) => l.length)).toBe(1);
  const [copia] = await listar(otro, 'sesiones');
  // Como viaja en el archivo: JSON no guarda claves undefined y -0 vuelve como 0 (la diferencia con un rival empatado).
  const sinId = ({ id, ...resto }) => JSON.parse(JSON.stringify(resto));
  expect(sinId(copia)).toEqual(sinId(original[0]));
  expect(await otro.evaluate(() => localStorage.getItem('inicioHecho'))).toBe('1');

  // Restaurar el mismo archivo otra vez no duplica nada.
  await abrirRespaldo(otro);
  await restaurar(otro, archivo);
  await expect(otro.locator('#toast')).toContainText('Restaurado: 0 sesiones');
  expect(await listar(otro, 'sesiones')).toHaveLength(1);
  expect(errores).toEqual([]);
  await ctx.close();
});

test('un archivo que no es respaldo se rechaza sin tocar los datos', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await abrirRespaldo(page);
  await restaurar(page, { name: 'notas.json', mimeType: 'application/json', buffer: Buffer.from('{"hola": 1}') });
  await esperarAviso(page, /^Ese archivo no es un respaldo de Rower$/);
  await restaurar(page, { name: 'roto.json', mimeType: 'application/json', buffer: Buffer.from('{roto') });
  await esperarAviso(page, /^Ese archivo no es un respaldo válido$/);
  expect(await listar(page, 'sesiones')).toHaveLength(0);
});
