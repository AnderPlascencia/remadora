import assert from 'node:assert/strict';
import * as E from '../estadisticas.js';
import * as Ent from '../entrenamientos.js';

// Sesión sintética: 600 s a 4 m/s, con 60 s a 300 W en el medio.
const muestras = Array.from({ length: 600 }, (_, t) => ({ t, w: t >= 200 && t < 260 ? 300 : 150, dist: t * 4, spm: 24 }));
assert.equal(E.mejorPotencia(muestras, 60), 300);
assert.equal(E.mejorPotencia(muestras, 1200), null);
assert.equal(E.mejorTiempo(muestras, 500), 125);
assert.equal(E.mejorTiempo(muestras, 5000), null);

const vieja = { id: 1, fecha: Date.parse('2026-10-20T10:00'), muestras: muestras.map((m) => ({ ...m, w: m.w - 20 })), wattsMax: 280, distancia: 2396, wattsProm: 140, splitProm: 130, entrenamiento: 'X' };
const nueva = { id: 2, fecha: Date.parse('2026-10-26T10:00'), muestras, wattsMax: 300, distancia: 2396, wattsProm: 160, splitProm: 125, entrenamiento: 'X' };
const recs = E.nuevosRecords(nueva, [vieja]);
assert.deepEqual(recs.map((r) => r.clave).sort(), ['w1', 'w5', 'wmax']);
const cmp = E.compararConAnterior(nueva, [vieja]);
const watts = cmp.filas.find((f) => f.clave === 'wattsProm');
assert.equal(watts.delta, 20);
assert.equal(watts.mejoro, true);
assert.equal(cmp.filas.find((f) => f.clave === 'splitProm').mejoro, true);
assert.equal(E.compararConAnterior({ ...nueva, entrenamiento: 'Otro' }, [vieja]), null);

const ahora = Date.parse('2026-10-26T12:00'); // lunes
const sems = E.resumenPeriodos([vieja, nueva], 'semana', 4, ahora);
assert.equal(sems.length, 4);
assert.equal(sems.at(-1).sesiones, 1);
assert.equal(sems.at(-2).sesiones, 1);
const dias = [0, 1, 2].map((d) => ({ fecha: ahora - d * 864e5 }));
assert.equal(E.racha(dias, ahora), 3);
assert.equal(E.racha(dias.slice(1), ahora), 2);
assert.equal(E.racha([], ahora), 0);

assert.deepEqual(Ent.rangoWatts({ metrica: 'ftp', min: 91, max: 105 }, 200), { min: 182, max: 210 });
assert.equal(Ent.enRango({ metrica: 'ftp', min: 91, max: 105 }, 170, 0, 200), 'bajo');
assert.equal(Ent.enRango({ metrica: 'ftp', min: 91, max: 105 }, 190, 0, 200), 'dentro');
assert.equal(Ent.zonaDe(150, 200).n, 2);
assert.equal(Ent.zonaDe(160, 200).n, 3);
assert.equal(Ent.ftpDesdePrueba(200), 190);
assert.equal(Ent.bloquesEnWatts([{ metrica: 'ftp', min: 50, max: 60, duracion: 10 }], 200)[0].max, 120);
console.log('estadisticas OK');
