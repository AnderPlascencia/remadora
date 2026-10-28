import assert from 'node:assert/strict';
import { metrosNuevos } from '../estadisticas.js';

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
