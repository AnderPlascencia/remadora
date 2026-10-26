import assert from 'node:assert/strict';
import * as F from '../fantasma.js';
import { EJEMPLOS } from '../entrenamientos.js';

const d2k = EJEMPLOS.find((e) => e.nombre === '2000 m');
const tiempos = Object.keys(F.NIVELES).map((n) => F.simular(d2k, n).muestras.at(-1).t);
assert.ok(tiempos[0] > tiempos[1] && tiempos[1] > tiempos[2], 'avanzado más rápido');
assert.ok(tiempos[1] > 400 && tiempos[1] < 600, `intermedio 2k en ${tiempos[1]} s`);
assert.ok(F.simular(d2k, 'avanzado').muestras.at(-1).dist >= 2000);
const umbral = EJEMPLOS.find((e) => e.nombre.startsWith('Umbral'));
const s = F.simular(umbral, 'intermedio', 200);
assert.equal(s.muestras.length, umbral.bloques.reduce((a, b) => a + b.duracion, 0));
const quinientos = EJEMPLOS.find((e) => e.nombre === '4 × 500 m');
assert.ok(F.simular(quinientos, 'principiante').muestras.at(-1).dist > 2000);
assert.equal(F.simular(null, 'intermedio').muestras.length, 3600);
assert.equal(F.splitDeWatts(203), 120);
console.log('fantasma OK');
