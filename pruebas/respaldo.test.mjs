import assert from 'node:assert/strict';
import { armarRespaldo, esRespaldo, planRestaurar, listaHumana, CLAVES_AJUSTES } from '../src/respaldo.js';

const guardados = { ftp: '180', personaje: '{"clase":"vikingo"}', ultimoRespaldo: '123' };
const leer = (k) => guardados[k] ?? null;
const sesion = { id: 7, fecha: 1000, distancia: 5000, pausas: [{ t: 60, ini: 1, fin: 31 }], version: '0.42.1' };
const r = armarRespaldo({ version: '0.42.1', sesiones: [sesion], entrenamientos: [{ id: 1, nombre: 'Mío' }], programa: null, leer, fecha: new Date(0) });
assert.equal(r.app, 'remadora');
assert.equal(r.fecha, '1970-01-01T00:00:00.000Z');
// Solo los ajustes conocidos (no la fecha del último respaldo)
assert.deepEqual(r.ajustes, { ftp: '180', personaje: '{"clase":"vikingo"}' });
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

// Héroe, plan y perfil distintos: se pregunta
const otro = { ...r, programa: { semanas: 8 }, ajustes: { ftp: '200', personaje: '{"clase":"pirata"}', tema: 'claro' } };
p = planRestaurar(otro, { sesiones: [], entrenamientos: [], programa: { semanas: 6 }, leer });
assert.deepEqual(p.distintos, ['el plan', 'el héroe', 'tus ajustes']);
assert.equal(listaHumana(p.distintos), 'el plan, el héroe y tus ajustes');
assert.equal(listaHumana(['el plan']), 'el plan');

console.log('respaldo: ok');
