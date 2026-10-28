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
