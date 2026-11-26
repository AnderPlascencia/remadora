import assert from 'node:assert/strict';
import { armarRespaldo, esRespaldo, planRestaurar, listaHumana, CLAVES_AJUSTES, convertir, validarSesion, FORMATO } from '../src/respaldo.js';

const guardados = { ftp: '180', personaje: '{"clase":"vikingo"}', ultimoRespaldo: '123' };
const leer = (k) => guardados[k] ?? null;
const sesion = { id: 7, fecha: 1000, duracion: 1200, distancia: 5000, pausas: [{ t: 60, ini: 1, fin: 31 }], version: '0.42.1' };
const r = armarRespaldo({ version: '0.42.1', sesiones: [sesion], entrenamientos: [{ id: 1, nombre: 'Mío' }], programa: null, leer, fecha: new Date(0) });
assert.equal(r.app, 'remadora');
assert.equal(r.fecha, '1970-01-01T00:00:00.000Z');
// Solo los ajustes conocidos (no la fecha del último respaldo), cada uno con su tipo (formato 2)
assert.equal(r.formato, FORMATO);
assert.deepEqual(r.ajustes, { ftp: 180, personaje: { clase: 'vikingo' } });
// Entran también los rivales de referencia, el fantasma a tu medida y la vista de la carrera
for (const k of ['referencias', 'fantasmaPerso', 'vistaCarrera']) assert.ok(CLAVES_AJUSTES.includes(k), k);
assert.ok(CLAVES_AJUSTES.every((k) => !k.startsWith('ultimo')));
assert.ok(esRespaldo(JSON.parse(JSON.stringify(r))));
assert.ok(!esRespaldo({ app: 'otra', sesiones: [] }));
assert.ok(!esRespaldo(null));

// Restaurar en un teléfono que ya tiene esa sesión: no se duplica
let p = planRestaurar(r, { sesiones: [{ id: 3, fecha: 1000 }], entrenamientos: [], programa: null, leer });
assert.equal(p.sesionesNuevas.length, 0);
assert.equal(p.entNuevos.length, 1);
assert.equal(p.entNuevos[0].id, undefined);
assert.deepEqual(p.distintos, []);

// En un teléfono vacío entra todo, con las pausas y la versión, sin el id viejo
p = planRestaurar(r, { sesiones: [], entrenamientos: [{ nombre: 'Mío' }], programa: null, leer: () => null });
assert.equal(p.sesionesNuevas.length, 1);
assert.equal(p.sesionesNuevas[0].id, undefined);
assert.deepEqual(p.sesionesNuevas[0].pausas, sesion.pausas);
assert.equal(p.sesionesNuevas[0].version, '0.42.1');
assert.equal(p.entNuevos.length, 0);

// I-3: una sesión con el mismo uid tampoco se duplica (aunque su hora de inicio no coincida), y el uid viaja.
const conUid = { ...r, sesiones: [{ ...sesion, uid: 'u-1', rr: [800, 810] }, { ...sesion, fecha: 2000, uid: 'u-2' }] };
p = planRestaurar(conUid, { sesiones: [{ id: 3, fecha: 1500, uid: 'u-1' }], entrenamientos: [], programa: null, leer });
assert.deepEqual(p.sesionesNuevas.map((s) => s.uid), ['u-2']);
p = planRestaurar(conUid, { sesiones: [], entrenamientos: [], programa: null, leer });
assert.deepEqual(p.sesionesNuevas[0].rr, [800, 810], 'los RR del respaldo se traen');

// Héroe, plan y perfil distintos: se pregunta
// (un respaldo de formato 1, con los ajustes como texto, se convierte antes)
const viejo = { app: 'remadora', sesiones: [], programa: { semanas: 8 }, ajustes: { ftp: '200', personaje: '{"clase":"pirata"}', tema: 'claro', voz: '0', raro: 'x' } };
const conv = convertir(viejo);
assert.deepEqual(conv.datos.ajustes, { ftp: 200, personaje: { clase: 'pirata' }, tema: 'claro', voz: false });
assert.equal(conv.datos.formato, 2);
const otro = conv.datos;
p = planRestaurar(otro, { sesiones: [], entrenamientos: [], programa: { semanas: 6 }, leer });
assert.deepEqual(p.distintos, ['el plan', 'el héroe', 'tus ajustes']);
assert.equal(listaHumana(p.distintos), 'el plan, el héroe y tus ajustes');
assert.equal(listaHumana(['el plan']), 'el plan');

// Al restaurar, los ajustes vuelven a ser el texto de localStorage
assert.deepEqual(Object.fromEntries(p.ajustesResp), { ftp: '200', personaje: '{"clase":"pirata"}', tema: 'claro', voz: '0' });
// Un respaldo de una versión más nueva no se restaura a medias
assert.equal(convertir({ ...r, formato: FORMATO + 1 }).error, 'nuevo');
assert.equal(convertir(r).datos, r);

// Cada sesión se valida: las dañadas no entran y se cuentan
assert.equal(validarSesion(sesion), null);
assert.equal(validarSesion({ ...sesion, muestras: [{ t: 1, w: 120, dist: 4 }] }), null);
assert.ok(validarSesion(null));
assert.ok(validarSesion({ ...sesion, fecha: 'ayer' }));
assert.ok(validarSesion({ ...sesion, distancia: -5 }));
assert.ok(validarSesion({ ...sesion, muestras: 'muchas' }));
assert.ok(validarSesion({ ...sesion, muestras: [{ t: 1, w: '<img>' }] }));
assert.ok(validarSesion({ ...sesion, notas: { html: 'x' } }));
const conDañadas = { ...r, sesiones: [sesion, { ...sesion, fecha: 2000, duracion: null }, 'nada'] };
p = planRestaurar(conDañadas, { sesiones: [], entrenamientos: [], programa: null, leer: () => null });
assert.equal(p.sesionesNuevas.length, 1);
assert.equal(p.invalidas, 2);

console.log('respaldo: ok');

// Etapa 23 (P5) e I-2: el archivo va comprimido y en flujo, de lote en lote, y restaurar lee el comprimido y el JSON.
{
  const { archivoRespaldo, leerArchivo, TIPO_GZ } = await import('../src/respaldo.js');
  const muestras = Array.from({ length: 1800 }, (_, k) => ({ t: k + 1, w: 150 + (k % 40), spm: 22, split: 120, dist: k * 4, nivel: 5, fc: 130 }));
  const grande = armarRespaldo({ version: '0.108.0', sesiones: Array.from({ length: 30 }, (_, i) => ({ ...sesion, id: i, fecha: i * 1e6, muestras })), entrenamientos: [], programa: { semanas: 6 }, leer, fecha: new Date(0) });
  // Los lotes llegan de a 7, como los da porLotes(): se leen solo a medida que el archivo los pide.
  let pedidos = 0;
  const lotes = () => (async function* () { for (let i = 0; i < grande.sesiones.length; i += 7) { pedidos++; yield grande.sesiones.slice(i, i + 7); } })();
  const { archivo: comprimido, total } = await archivoRespaldo({ ...grande, sesiones: [] }, lotes, 'rower-respaldo-x');
  assert.equal(total, 30);
  assert.equal(pedidos, 5);
  assert.equal(comprimido.name, 'rower-respaldo-x.json.gz');
  assert.equal(comprimido.type, TIPO_GZ);
  const { archivo: json } = await archivoRespaldo(grande, lotes, 'rower-respaldo-x', { comprimir: false });
  assert.equal(json.name, 'rower-respaldo-x.json');
  assert.ok(comprimido.size * 8 < json.size, `${comprimido.size} B comprimido de ${json.size} B`);
  assert.deepEqual(await leerArchivo(comprimido), grande);
  assert.deepEqual(await leerArchivo(json), grande);
  // Sin sesiones también es un respaldo válido.
  const vacio = await archivoRespaldo(grande, () => (async function* () {})(), 'v');
  assert.deepEqual(await leerArchivo(vacio.archivo), { ...grande, sesiones: [] });
  await assert.rejects(leerArchivo(new Blob(['no es json'])));
}
