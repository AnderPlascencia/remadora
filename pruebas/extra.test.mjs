import assert from 'node:assert/strict';
import * as E from '../estadisticas.js';
import * as P from '../programa.js';

const muestras = Array.from({ length: 600 }, (_, i) => ({ t: i + 1, w: 200, spm: 24, split: 125, dist: (i + 1) * 4, fc: 150 }));
const s = { fecha: Date.parse('2026-10-20T10:00'), duracion: 600, distancia: 2400, paladas: 240, wattsProm: 200, spmProm: 24, fcProm: 150, muestras,
  bloques: [{ nombre: 'A', duracion: 300, metrica: 'watts', min: 150, max: 190 }, { nombre: 'B', duracion: 300, metrica: 'split', min: 120, max: 130 }] };
const filas = E.resumenIntervalos(s);
assert.equal(filas.length, 2);
assert.equal(filas[0].pctRango, 0);
assert.equal(filas[1].pctRango, 100);
assert.equal(filas[0].segundos, 300);
assert.equal(E.parciales(muestras).length, 4);
assert.equal(E.parciales(muestras)[0].split, 125);
assert.equal(E.potenciaNormalizada(muestras), 200);
assert.equal(E.estres(s, 200), 17); // 10 min a FTP ≈ 16.7
const f = E.forma([s], 200, 10, Date.parse('2026-10-26T10:00'));
assert.equal(f.length, 10);
assert.ok(f.at(-1).condicion >= 0 && f.find((d) => d.dia === '2026-10-20').carga === 17);
assert.deepEqual(E.tiempoEnZonasFc(muestras, 180), [0, 0, 0, 600, 0]);
assert.equal(E.zonaFc(150, 180).n, 4);
assert.deepEqual(E.tecnica(s), { metrosPorPalada: 10, joulesPorPalada: 500, wattsPorLatido: 1.33 });
assert.equal(E.distanciaEn(muestras, 100.5), 402);
assert.equal(E.distanciaEn(muestras, 9999), 2400);
const s2 = { ...s, fecha: s.fecha + 864e5, distancia: 2000, entrenamiento: 'X' };
const s3 = { ...s, fecha: s.fecha + 2 * 864e5, distancia: 2600, entrenamiento: 'X' };
assert.equal(E.elegirRival([s, s2, s3], 'X', 'anterior'), s3);
assert.equal(E.elegirRival([s, s2, s3], 'X', 'mejor'), s3);
assert.equal(E.elegirRival([s2, { ...s3, tiempoMeta: 500 }, { ...s3, tiempoMeta: 480, id: 9 }], 'X', 'mejor').id, 9);

const prog = P.generarSemanal('Mío', '2026-10-26', 2, { 0: 'A', 2: 'B' });
assert.deepEqual(prog.dias.map((d) => d.fecha), ['2026-10-26', '2026-10-28', '2026-11-02', '2026-11-04']);
const est = P.estadoDias(prog, [{ fecha: Date.parse('2026-10-26T09:00'), entrenamiento: 'A' }], Date.parse('2026-10-29T09:00'));
assert.deepEqual(est.map((d) => d.estado), ['hecho', 'perdido', 'pendiente', 'pendiente']);
assert.deepEqual(P.cumplimiento(est), { hechos: 1, pasados: 2, total: 4 });
assert.equal(P.deHoy(prog, Date.parse('2026-10-28T20:00')).ent, 'B');
const p2k = P.desdePlantilla(P.PLANTILLAS[0], '2026-10-26');
assert.equal(p2k.dias.length, 18);
assert.equal(p2k.dias[0].fecha, '2026-10-26');
assert.equal(p2k.dias.at(-1).ent, '2000 m');
console.log('extra OK');
