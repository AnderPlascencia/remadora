import { writeFile } from 'node:fs/promises';
import {
  test, expect, abrirApp, completarBienvenida, remar, terminar, listar, esperarAviso,
  abrirRespaldo, restaurar, guardarRespaldo, leerAjustes, contar,
} from './ayuda.mjs';
import { CLAVES_RESPALDO, aTexto } from '../../src/ajustes-guardados.js';

const DIA = 86_400_000;
// Como viaja en el archivo: JSON no guarda claves undefined y -0 vuelve como 0 (la diferencia con un rival empatado).
const comoJson = (x) => JSON.parse(JSON.stringify(x));
const sinId = ({ id, ...resto }) => comoJson(resto);
const porFecha = (l) => [...l].sort((a, b) => a.fecha - b.fecha).map(sinId);

// Teléfono con una sesión real terminada (para tener el héroe, el plan y una sesión como las de la app).
async function conUnaSesion(page) {
  await abrirApp(page);
  await completarBienvenida(page);
  await remar(page, 30_000);
  await terminar(page);
  await expect(page.locator('#hoja-titulo')).toHaveText('¡Sesión terminada!');
  await page.keyboard.press('Escape');
  expect(await listar(page, 'sesiones')).toHaveLength(1);
}

// Si el respaldo trae otro héroe o plan, la app se recarga a los 1,5 s de restaurar: se espera a que pase.
async function asentado(p) {
  await p.waitForTimeout(2_000);
  await p.waitForLoadState();
}

// Navegador limpio que salta la bienvenida, listo para restaurar.
async function telefonoNuevo(otroTelefono) {
  const p = await otroTelefono();
  await p.goto('./');
  await p.locator('#inicio-saltar').click();
  await abrirRespaldo(p);
  return p;
}

// Diez semanas de historial (3 sesiones por semana, de 20 a 40 min, con una muestra por segundo) hechas a partir
// de una sesión real, para que tengan los mismos campos que guarda la app.
function historial(modelo, semanas = 10) {
  const hoy = modelo.fecha;
  const sesiones = [];
  for (let s = 0; s < semanas; s++) {
    for (const dia of [0, 2, 4]) {
      const i = sesiones.length;
      const duracion = 1200 + ((i * 397) % 1200);
      const base = 140 + (i % 7) * 8;
      let dist = 0;
      const muestras = Array.from({ length: duracion }, (_, k) => {
        const w = base + Math.round(20 * Math.sin(k / 30));
        const split = Math.round(500 / Math.cbrt(w / 2.8));
        dist += 500 / split;
        return { t: k + 1, w, spm: 22 + (k % 5), split, dist: Math.round(dist), nivel: 8, fc: 120 + Math.round(k / 60) };
      });
      const fecha = hoy - (semanas * 7 - (s * 7 + dia)) * DIA;
      sesiones.push({
        ...modelo, id: undefined, fecha, duracion, distancia: Math.round(dist), muestras,
        wattsProm: Math.round(muestras.reduce((a, m) => a + m.w, 0) / duracion), notas: `semana ${s + 1}`,
      });
    }
  }
  return comoJson(sesiones);
}

// Sesiones dañadas que restaurar debe dejar fuera.
const DANADAS = (modelo) => [
  { ...modelo, fecha: undefined },
  { ...modelo, fecha: modelo.fecha - 999 * DIA, distancia: '12 km' },
  { ...modelo, fecha: modelo.fecha - 998 * DIA, muestras: [{ t: 'uno', w: 100 }] },
];

test('respaldo de ida y vuelta: lo guardado en un teléfono se restaura en otro sin duplicar', async ({ page, otroTelefono }, info) => {
  await conUnaSesion(page);
  const original = await listar(page, 'sesiones');

  await abrirRespaldo(page);
  const archivo = info.outputPath('respaldo.json');
  const datos = await guardarRespaldo(page, archivo);
  await esperarAviso(page, /^Respaldo listo: 1 sesiones$/);
  expect(datos.app).toBe('remadora');
  expect(datos.formato).toBe(2);
  expect(datos.sesiones).toHaveLength(1);
  expect(datos.programa).toBeTruthy();
  expect(datos.ajustes.inicioHecho).toBe(true);
  expect(datos.ajustes.personaje).toBeTruthy();

  const otro = await telefonoNuevo(otroTelefono);
  await restaurar(otro, archivo);
  await expect(otro.locator('#toast')).toContainText('Restaurado: 1 sesiones');
  await asentado(otro);
  await expect.poll(() => contar(otro, 'sesiones'), { timeout: 30_000 }).toBe(1);
  expect(porFecha(await listar(otro, 'sesiones'))).toEqual(porFecha(original));
  expect(await otro.evaluate(() => localStorage.getItem('inicioHecho'))).toBe('1');

  // Restaurar el mismo archivo otra vez no duplica nada.
  await abrirRespaldo(otro);
  await restaurar(otro, archivo);
  await expect(otro.locator('#toast')).toContainText('Restaurado: 0 sesiones');
  expect(await listar(otro, 'sesiones')).toHaveLength(1);
});

test('10 semanas de historial y tus preferencias pasan completas a otro teléfono, en formato 2 y desde el formato 1', async ({ page, otroTelefono }, info) => {
  test.setTimeout(240_000);
  await conUnaSesion(page);
  // Preferencias que antes no viajaban en el respaldo, y otras con tipo número y sí/no.
  await page.evaluate(() => {
    localStorage.setItem('referencias', JSON.stringify(['anterior', 'mejor']));
    localStorage.setItem('fantasmaPerso', JSON.stringify({ modo: 'watts', valor: '185' }));
    localStorage.setItem('vistaCarrera', '3d');
    localStorage.setItem('peso', '82');
    localStorage.setItem('voz', '0');
  });

  // Se carga el historial: 30 sesiones buenas y 3 dañadas, que no entran.
  await abrirRespaldo(page);
  const base = await guardarRespaldo(page, info.outputPath('base.json'));
  const [modelo] = base.sesiones;
  const conHistorial = info.outputPath('historial.json');
  await writeFile(conHistorial, JSON.stringify({ ...base, sesiones: [...historial(modelo), ...DANADAS(modelo)] }));
  await restaurar(page, conHistorial);
  await esperarAviso(page, /^Restaurado: 30 sesiones y 0 entrenamientos nuevos\. 3 sesiones dañadas no se trajeron$/);
  const enA = await listar(page, 'sesiones');
  expect(enA).toHaveLength(31);
  expect(enA.every((s) => s.muestras?.length === s.duracion)).toBe(true);

  // Respaldo completo, con cada ajuste con su tipo.
  const archivo = info.outputPath('completo.json');
  const completo = await guardarRespaldo(page, archivo);
  await esperarAviso(page, /^Respaldo listo: 31 sesiones$/);
  expect(completo.formato).toBe(2);
  expect(completo.sesiones).toHaveLength(31);
  expect(completo.ajustes).toMatchObject({
    peso: 82, voz: false, vistaCarrera: '3d', inicioHecho: true,
    referencias: ['anterior', 'mejor'], fantasmaPerso: { modo: 'watts', valor: '185' },
  });
  expect(typeof completo.ajustes.personaje).toBe('object');
  const ajustesA = await leerAjustes(page, CLAVES_RESPALDO);

  // Formato 2 en un teléfono nuevo: las 31 sesiones con sus muestras y los mismos ajustes.
  const b = await telefonoNuevo(otroTelefono);
  await restaurar(b, archivo);
  await expect(b.locator('#toast')).toContainText('Restaurado: 31 sesiones');
  await expect.poll(() => contar(b, 'sesiones'), { timeout: 30_000 }).toBe(31);
  await asentado(b);
  expect(porFecha(await listar(b, 'sesiones'))).toEqual(porFecha(enA));
  expect(await leerAjustes(b, CLAVES_RESPALDO)).toEqual(ajustesA);

  // El mismo respaldo en formato 1 (sin «formato» y los ajustes como el texto de localStorage) da lo mismo.
  const viejo = info.outputPath('formato1.json');
  const { formato, ...sinFormato } = completo;
  await writeFile(viejo, JSON.stringify({
    ...sinFormato,
    ajustes: Object.fromEntries(Object.entries(completo.ajustes).map(([k, v]) => [k, aTexto(k, v)])),
  }));
  const c = await telefonoNuevo(otroTelefono);
  await restaurar(c, viejo);
  await expect(c.locator('#toast')).toContainText('Restaurado: 31 sesiones');
  await expect.poll(() => contar(c, 'sesiones'), { timeout: 30_000 }).toBe(31);
  await asentado(c);
  expect(porFecha(await listar(c, 'sesiones'))).toEqual(porFecha(enA));
  expect(await leerAjustes(c, CLAVES_RESPALDO)).toEqual(ajustesA);
});

test('si restaurar falla a mitad (disco lleno) no queda nada a medias, y al reintentar entra todo', async ({ page, otroTelefono }, info) => {
  test.setTimeout(180_000);
  await conUnaSesion(page);
  await abrirRespaldo(page);
  const base = await guardarRespaldo(page, info.outputPath('base.json'));
  const archivo = info.outputPath('historial.json');
  await writeFile(archivo, JSON.stringify({ ...base, sesiones: [...base.sesiones, ...historial(base.sesiones[0])] }));

  const d = await telefonoNuevo(otroTelefono);
  // Al guardar las muestras de la décima sesión se llena el disco: como con QuotaExceededError, la transacción
  // se aborta cuando ya entraron nueve sesiones.
  await d.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    let n = 0;
    window.__restaurarPut = () => { IDBObjectStore.prototype.put = put; };
    IDBObjectStore.prototype.put = function (...args) {
      const req = put.apply(this, args);
      if (this.name === 'muestras' && ++n === 10) this.transaction.abort();
      return req;
    };
  });
  await restaurar(d, archivo);
  await expect(d.locator('#toast')).toContainText('No se pudo restaurar el respaldo: no cambió nada');
  expect(await listar(d, 'sesiones')).toHaveLength(0);
  expect(await listar(d, 'muestras')).toHaveLength(0);
  expect(await listar(d, 'entrenamientos')).toHaveLength(0);

  await d.evaluate(() => window.__restaurarPut());
  await restaurar(d, archivo);
  await expect(d.locator('#toast')).toContainText('Restaurado: 31 sesiones');
  await expect.poll(() => contar(d, 'sesiones'), { timeout: 30_000 }).toBe(31);
});

test('un respaldo de una versión más nueva se rechaza sin tocar nada', async ({ page }) => {
  await abrirApp(page);
  await completarBienvenida(page);
  await abrirRespaldo(page);
  const antes = await leerAjustes(page, CLAVES_RESPALDO);
  const futuro = { app: 'remadora', formato: 3, version: '9.0.0', sesiones: [{ fecha: Date.now() - DIA, duracion: 60, distancia: 200 }], ajustes: { peso: 50 } };
  await restaurar(page, { name: 'futuro.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(futuro)) });
  await esperarAviso(page, /^Ese respaldo es de una versión más nueva de Rower/);
  expect(await listar(page, 'sesiones')).toHaveLength(0);
  expect(await leerAjustes(page, CLAVES_RESPALDO)).toEqual(antes);
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
