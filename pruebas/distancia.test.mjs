import assert from 'node:assert/strict';
import * as E2 from '../estadisticas.js';
import { metrosNuevos, metrosPorWatts, distanciaPorWatts, debeQuedarSinTerminar } from '../estadisticas.js';

// Remo normal
assert.equal(metrosNuevos(100, 104), 4);
assert.equal(metrosNuevos(100, 100), 0);
// La consola se reinicia: cuenta desde 0
assert.equal(metrosNuevos(1500, 3), 3);
// Lectura falsa al pausar: 1500 → 0 → 1500 no suma 1500 metros de golpe
let dist = 0;
let previa = 1490;
for (const lectura of [1495, 1500, 0, 1500, 1504]) { dist += metrosNuevos(previa, lectura); previa = lectura; }
assert.equal(dist, 14);
// Baja a otra cifra que no es un reinicio: no suma
assert.equal(metrosNuevos(1500, 900), 0);
// Salto imposible en un segundo: no suma
assert.equal(metrosNuevos(200, 900), 0);
assert.equal(metrosNuevos(null, 50), 0);

{
// Distancia según watts: la misma fórmula que los fantasmas (W = 2,8 · v³)
assert.equal(metrosPorWatts(0), 0);
assert.ok(Math.abs(metrosPorWatts(2.8 * 4 ** 3) - 4) < 1e-9);

// Una sesión con la distancia de la consola (20 % de más) pasa a watts una sola vez
const w = 2.8 * 4 ** 3; // 4 m/s
const muestras = Array.from({ length: 100 }, (_, i) => ({ t: i + 1, w, spm: 24, split: 125, dist: Math.round((i + 1) * 4.8) }));
const vieja = { id: 1, distancia: 480, tiempoMeta: null, muestras, rival: { nombre: 'F', diferencia: 100 }, rivales: [{ nombre: 'F', diferencia: 100 }] };
const nueva = distanciaPorWatts(vieja);
assert.equal(nueva.distancia, 400);
assert.equal(nueva.distanciaConsola, 480);
assert.equal(nueva.distFuente, 'watts');
assert.equal(nueva.rival.diferencia, 20);
assert.equal(nueva.rivales[0].diferencia, 20);
assert.equal(nueva.marcas.dist, 400);
assert.equal(distanciaPorWatts(nueva), null);
// La diferencia se corrige en el momento en que se decidió la carrera (la meta), no al final
const conMeta = distanciaPorWatts({ ...vieja, tiempoMeta: 50 });
assert.equal(conMeta.rival.diferencia, 60);
assert.equal(conMeta.tiempoMeta, 50);

// Una reparación que deja la meta sin cumplir marca la carrera sin terminar
const salto = muestras.map((x) => ({ ...x, dist: x.t === 60 ? x.dist + 3000 : x.t > 60 ? x.dist + 3000 : x.dist }));
const rep = E2.repararSaltos({ ...vieja, entrenamiento: '6km', tiempoMeta: 80, distancia: salto.at(-1).dist, muestras: salto });
assert.equal(rep.tiempoMeta, null);
assert.equal(rep.carreraSinTerminar, true);
// Las ya reparadas antes de esta regla también se marcan, y solo si tenían fantasmas
assert.equal(debeQuedarSinTerminar({ reparada: true, entrenamiento: '6km', tiempoMeta: null, rival: {} }), true);
assert.equal(debeQuedarSinTerminar({ reparada: true, entrenamiento: '6km', tiempoMeta: null }), false);
assert.equal(debeQuedarSinTerminar({ reparada: true, entrenamiento: '6km', tiempoMeta: 900, rival: {} }), false);
assert.equal(debeQuedarSinTerminar({ reparada: true, entrenamiento: '6km', tiempoMeta: null, rival: {}, carreraSinTerminar: true }), false);
}
console.log('distancia ok');

// Reparación de una sesión guardada con saltos: 6 km que en realidad fueron ~4.1 km
import { repararSaltos } from '../estadisticas.js';
const muestras = [];
let d = 0;
for (let t = 1; t <= 1000; t++) { d += 4.1; muestras.push({ t, w: 150, spm: 24, split: 122, dist: Math.round(d) }); }
const real = muestras.at(-1).dist;
for (let i = 1; i <= 4; i++) muestras.push({ t: 1000 + i, w: 0, spm: 0, split: 0, dist: real + i * 500 });
muestras.push({ t: 1005, w: 0, spm: 0, split: 0, dist: real + 2000 });
const ses = { fecha: 1, duracion: 1005, distancia: real + 2000, tiempoMeta: 1003, muestras, rival: { nombre: 'X', diferencia: 1900 } };
const rep = repararSaltos(ses);
assert.equal(rep.distancia, real);
assert.equal(rep.distanciaOriginal, real + 2000);
assert.equal(rep.tiempoMeta, null);
assert.equal(rep.rival.diferencia, -100);
assert.equal(repararSaltos(rep), null);
assert.equal(repararSaltos({ muestras: muestras.slice(0, 1000) }), null);
console.log('reparación ok');
