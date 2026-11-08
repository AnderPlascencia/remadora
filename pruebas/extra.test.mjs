import assert from 'node:assert/strict';
import * as E from '../src/estadisticas.js';
import * as P from '../src/programa.js';

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
// El día es una sugerencia: «B» (miércoles) sigue pendiente el jueves, atrasada, hasta que acaba la semana.
assert.deepEqual(est.map((d) => d.estado), ['hecho', 'pendiente', 'pendiente', 'pendiente']);
assert.equal(est[1].atrasada, true);
assert.deepEqual(P.cumplimiento(est), { hechos: 1, pasados: 1, total: 4 });
{
  // Remada otro día de la misma semana cuenta como hecha; la semana siguiente ya no.
  const otroDia = P.estadoDias(prog, [{ fecha: Date.parse('2026-10-31T09:00'), entrenamiento: 'B' }, { fecha: Date.parse('2026-11-02T09:00'), entrenamiento: 'B' }], Date.parse('2026-11-03T09:00'));
  assert.deepEqual(otroDia.map((d) => d.estado), ['perdido', 'hecho', 'pendiente', 'hecho']);
  assert.equal(otroDia[1].hechaEl, '2026-10-31');
  // Adelantada: «B» del miércoles remada el lunes cuenta, y el lunes «A» sigue pendiente.
  const adelantada = P.estadoDias(prog, [{ fecha: Date.parse('2026-11-02T09:00'), entrenamiento: 'B' }], Date.parse('2026-11-02T20:00'));
  assert.deepEqual(adelantada.slice(2).map((d) => d.estado), ['hoy', 'hecho']);
  // Dos sesiones iguales en la semana piden dos remadas.
  const doble = { nombre: 'D', inicio: '2026-11-02', dias: [{ fecha: '2026-11-02', ent: 'F' }, { fecha: '2026-11-05', ent: 'F' }] };
  assert.deepEqual(P.estadoDias(doble, [{ fecha: Date.parse('2026-11-03T09:00'), entrenamiento: 'F' }], Date.parse('2026-11-09T09:00')).map((d) => d.estado), ['hecho', 'perdido']);
}
// Repartir lo que falta: una por día y nunca dos duras seguidas.
assert.ok(P.caben(2, 1, 3) && !P.caben(2, 1, 3, true) && !P.caben(2, 0, 2) && P.caben(1, 1, 2, true));
{
  const dura = (d) => d.ent !== 'F';
  const r = P.repartirSemana([{ ent: 'V' }, { ent: 'F' }, { ent: 'U' }], 2, dura);
  assert.deepEqual(r.fuera.map((d) => d.ent), ['U'], 'en 2 días caben una dura y una suave');
  assert.equal(r.hoy.ent, 'V');
  const r2 = P.repartirSemana([{ ent: 'V' }, { ent: 'F' }, { ent: 'Prueba 2000 m' }], 2, dura);
  assert.deepEqual(r2.fuera.map((d) => d.ent), ['V'], 'la prueba no se quita mientras haya otra dura');
  assert.equal(P.repartirSemana([{ ent: 'V' }, { ent: 'F' }], 3, dura, { ayerDura: true }).hoy.ent, 'F', 'ayer duro: hoy la suave');
  assert.equal(P.repartirSemana([{ ent: 'V' }], 3, dura, { cansado: true }).hoy, null);
}
assert.equal(P.deHoy(prog, Date.parse('2026-10-28T20:00')).ent, 'B');
const p2k = P.desdePlantilla({ nombre: 'P', semanas: Array.from({ length: 6 }, (_, i) => ['A', 'B', i === 5 ? '2000 m' : 'C']), diasSemana: [0, 2, 5] }, '2026-10-26');
assert.equal(p2k.dias.length, 18);
assert.equal(p2k.dias[0].fecha, '2026-10-26');
assert.equal(p2k.dias.at(-1).ent, '2000 m');
console.log('extra OK');

// v0.7.0: predicción, calentamiento, insignias, recomendación, plan por meta
{
  const Ent = await import('../src/entrenamientos.js');
  const E = await import('../src/estadisticas.js');
  const P = await import('../src/programa.js');
  const assert = (await import('node:assert/strict')).default;
  // Ley de Paul: el split sube 5 s al duplicar la distancia
  assert.equal(Ent.predecir(2000, 480, 4000), Math.round((120 + 5) * 8));
  const con = Ent.conCalentamiento([{ nombre: 'X', duracion: 60, metrica: '', min: 0, max: 0 }], 5, 3);
  assert.equal(con.length, 3);
  assert.equal(con[0].duracion, 300);
  const sesiones = Array.from({ length: 10 }, (_, i) => ({ fecha: Date.UTC(2026, 0, 1 + i, 12), distancia: 5200, duracion: 1900, muestras: [] }));
  const ins = E.insignias(sesiones);
  const ganadas = new Set(ins.filter((x) => x.ganada).map((x) => x.clave));
  for (const k of ['primera', 'km5', 'min30', 'ses10', 'racha7']) assert.ok(ganadas.has(k), k);
  assert.ok(!ganadas.has('ses50'));
  const plan = P.planPorMeta({ distancia: 2000, segundos: 470, semanas: 8, inicio: '2026-01-05' });
  assert.equal(plan.split, 118);
  assert.ok(plan.programa.dias.length >= 23);
  assert.ok(plan.entrenamientos.some((e) => e.prueba));
  const muestras = Array.from({ length: 1300 }, (_, t) => ({ t, w: 200, dist: t * 4 }));
  assert.equal(E.ftpSugerido({ muestras }), 190);
  console.log('v0.7.0 ok');
}

// Racha por semanas: remar en días alternos no la rompe y una semana sin remar sí.
{
  const E2 = await import('../src/estadisticas.js');
  const dia = (iso) => ({ fecha: Date.parse(iso) });
  const ahora = Date.parse('2026-10-28T12:00');
  assert.equal(E2.rachaSemanas([dia('2026-10-26T09:00'), dia('2026-10-21T09:00'), dia('2026-10-13T09:00')], ahora), 3);
  assert.equal(E2.rachaSemanas([dia('2026-10-21T09:00'), dia('2026-10-13T09:00')], ahora), 2);
  assert.equal(E2.rachaSemanas([dia('2026-10-26T09:00'), dia('2026-10-07T09:00')], ahora), 1);
  assert.equal(E2.rachaSemanas([], ahora), 0);
}
