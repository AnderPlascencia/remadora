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

// Cansancio: en un 2000 m la segunda mitad es algo más lenta que la primera.
const av = F.simular(d2k, 'principiante').muestras;
const mitad = av.findIndex((m) => m.dist >= 1000);
assert.ok(av.length - mitad > mitad, 'segunda mitad más lenta');
assert.ok(av[10].spm >= 18 && av[10].spm <= 36);
// Fantasma por tiempo objetivo
const ft = F.simularPorTiempo(d2k, 480);
assert.ok(Math.abs(ft.muestras.length - 480) <= 2, `termina en ${ft.muestras.length}`);
assert.equal(F.simularPorTiempo(umbral, 600), null);
// Acelerar una sesión 5 %
const base = { spmProm: 24, muestras: Array.from({ length: 420 }, (_, i) => ({ t: i + 1, dist: (i + 1) * 5 })) };
const rapido = F.acelerar(base, 5);
assert.equal(rapido.muestras.length, 400);
assert.equal(rapido.muestras.at(-1).dist, 2100);
// Proyección
const rival = F.simular(d2k, 'intermedio');
const tr = F.tiempoA(rival, 2000);
assert.ok(Math.abs(tr - rival.muestras.length) <= 1);
const pr = F.proyectar({ t: 100, dist: 450, v: 4.5 }, [rival], { meta: 2000 });
assert.equal(pr.lugar, 1);
assert.ok(pr.filas[0].diferencia > 0);
const pd = F.proyectar({ t: 100, dist: 300, v: 3 }, [s], { duracion: s.muestras.length });
assert.equal(pd.tipo, 'duracion');
console.log('fantasma realista OK');
