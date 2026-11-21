import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/estadisticas.js';
import { datosDeCarga } from '../src/habito.js';

const DIA = 864e5;
const AHORA = Date.parse('2026-11-21T12:00');
// Sesión con watts constantes (una muestra por segundo).
const conWatts = (dias, w, seg = 1800, extra = {}) => ({
  fecha: AHORA - dias * DIA, duracion: seg, distancia: seg * 4, wattsProm: w,
  muestras: Array.from({ length: seg }, (_, t) => ({ t: t + 1, w, dist: t * 4 })), ...extra,
});

test('sRPE: esfuerzo × minutos, con el factor de serie o calibrado a ti', () => {
  const s = { fecha: AHORA, duracion: 3600, rpe: 7 };
  assert.equal(E.srpe(s), 420);
  assert.deepEqual(E.cargaDe(s, 0), { valor: Math.round(420 * E.FACTOR_SRPE), fuente: 'esfuerzo' }); // ≈ 100: una hora a tu FTP
  assert.deepEqual(E.cargaDe({ fecha: AHORA, duracion: 3600 }, 200), { valor: null, fuente: null });
  // Watts que no llegan (consola sin potencia): manda el esfuerzo aunque haya FTP.
  const sinW = { ...conWatts(0, 0, 1200), rpe: 5 };
  assert.equal(E.wattsFiables(sinW), false);
  assert.equal(E.cargaDe(sinW, 200).fuente, 'esfuerzo');
  // Con watts fiables y FTP, la de potencia.
  assert.deepEqual(E.cargaDe(conWatts(0, 200, 3600, { rpe: 7 }), 200), { valor: 100, fuente: 'potencia' });
  // Calibración: tres sesiones con watts y esfuerzo. 1 h al FTP sentida como 5 → 100 / 300.
  const tres = [1, 2, 3].map((d) => conWatts(d, 200, 3600, { rpe: 5 }));
  assert.equal(Math.round(E.factorSrpe(tres, 200) * 1000), 333);
  assert.equal(E.factorSrpe(tres.slice(0, 2), 200), E.FACTOR_SRPE, 'con menos de 3, el de serie');
});

test('la forma cuenta las sesiones sin FTP por su esfuerzo', () => {
  const s = [{ fecha: AHORA - DIA, duracion: 3600, rpe: 7 }];
  const f = E.forma(s, 0, 3, AHORA);
  assert.ok(f.find((d) => d.carga > 0));
  assert.ok(E.diasDeHistorial(s, AHORA) >= 1);
});

test('FTP vivo: sube con tus 3 mejores, baja si la CP cae o si llevas 21 días sin duras', () => {
  // Tres sesiones de 30 min a 230 W: eFTP 95 % de 230 = 219 > 200 → propone subir.
  const buenas = [3, 6, 9].map((d) => conWatts(d, 230));
  assert.deepEqual(E.revisarFtp(buenas, 200, AHORA).subir, { ftp: 219 });
  // Recién revisado: no se propone durante 14 días.
  assert.equal(E.revisarFtp(buenas, 200, AHORA, { revisado: AHORA - 5 * DIA }), null);
  assert.ok(E.revisarFtp(buenas, 200, AHORA, { revisado: AHORA - 15 * DIA }).subir);
  // 30 días sin duras (la última, hace 30 días a 200 W; después solo fondos a 130 W).
  const parado = [conWatts(30, 200, 1500), conWatts(10, 130), conWatts(5, 130)];
  assert.deepEqual(E.revisarFtp(parado, 200, AHORA).bajarSinDuras, { ftp: 190, dias: 30 });
  // CP: hace 3–4 meses 210 W en 25 min (con un arranque fuerte); ahora, con una dura, 185 W → cae ~12 %.
  const arranque = (s) => ({ ...s, muestras: s.muestras.map((m) => (m.t <= 90 ? { ...m, w: Math.round(m.w * 1.6) } : m)) });
  const antes = [95, 110, 125].map((d) => arranque(conWatts(d, 210, 1500)));
  const ahora = [arranque(conWatts(5, 185, 1500))];
  const r = E.revisarFtp([...antes, ...ahora], 200, AHORA);
  assert.ok(r.bajarCp && r.bajarCp.caida >= 10 && r.bajarCp.ftp < 190, JSON.stringify(r));
  assert.equal(E.esDuraPorPotencia(conWatts(0, 180, 1300), 200), true);
  assert.equal(E.esDuraPorPotencia(conWatts(0, 150, 1300), 200), false);
});

test('qué parte de tus sesiones tiene carga y esfuerzo', () => {
  const s = [conWatts(1, 200, 1800), { fecha: AHORA - 2 * DIA, duracion: 1200, rpe: 4 }, { fecha: AHORA - 3 * DIA, duracion: 1200 }];
  assert.deepEqual(datosDeCarga(s, 200, 28, AHORA), { sesiones: 3, pctCarga: 67, pctEsfuerzo: 33 });
  assert.deepEqual(datosDeCarga([], 200, 28, AHORA), { sesiones: 0, pctCarga: null, pctEsfuerzo: null });
});
