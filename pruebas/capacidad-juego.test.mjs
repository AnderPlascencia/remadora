import assert from 'node:assert/strict';
import * as J from '../src/juego.js';

// Fase 6: misiones por capacidad, atributo Gasto y jefes de prueba, con fecha de inicio.
const rit = { metros: 4000, min: 20, conRango: true, conPlan: true, conPulso: true, kcal: 250, kcalSemana: 800 };
const ids = (l) => l.map((m) => m.id.split(':').pop());

// Antes de la fecha: las misiones del día no cambian (se recalculan siempre desde el historial).
const antes = ids(J.misionesDelDia('2026-10-27', rit));
assert.deepEqual(antes, ids(J.misionesDelDia('2026-10-27', { ...rit, conPlan: false, conPulso: false })));
assert.ok(!antes.includes('plan'));

// Después: con plan, la sesión del plan siempre es una de las misiones; 5 en total.
for (let d = 2; d <= 15; d++) {
  const dia = `2026-11-${String(d).padStart(2, '0')}`;
  const l = J.misionesDelDia(dia, rit);
  assert.equal(l.length, 5, dia);
  assert.ok(ids(l).includes('plan'), `plan en ${dia}`);
  const ds = (new Date(`${dia}T12:00`).getDay() + 6) % 7;
  if (ds !== 1 && ds !== 3) assert.ok(!ids(l).some((i) => i === 'umbral' || i === 'vo2'), `sin intensidad ${dia}`);
}
// Tras un día duro, ni martes ni jueves piden intensidad.
for (const dia of ['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12']) {
  assert.ok(!ids(J.misionesDelDia(dia, rit, { cargaAyer: 90 })).some((i) => i === 'umbral' || i === 'vo2'));
}
// Sin plan no hay misión de plan.
assert.ok(!ids(J.misionesDelDia('2026-11-04', { ...rit, conPlan: false })).includes('plan'));

// Gasto solo entra en la elección del atributo semanal desde la fecha.
const atr = { fuerza: 30, agilidad: 20, resistencia: 50, recuperacion: 5, tecnica: 40, voluntad: 25, gasto: 1 };
assert.equal(J.atributoDeLaSemana(atr, { lunes: '2026-10-26' }), 'agilidad');
assert.equal(J.atributoDeLaSemana(atr, { lunes: '2026-11-02' }), 'gasto');
assert.ok(J.ATRIBUTOS.some((a) => a.clave === 'gasto'));

// Misión semanal de calorías solo desde la fecha y con gasto habitual.
assert.ok(!ids(J.misionesDeSemana('2026-10-26', null, rit)).includes('kcalsem'));
const conKcal = Array.from({ length: 8 }, (_, i) => J.misionesDeSemana(J.lunesDe(Date.UTC(2026, 10, 2 + 7 * i, 12)), null, rit)).some((l) => ids(l).includes('kcalsem'));
assert.ok(conKcal, 'kcalsem aparece alguna semana');

// El atributo Gasto sube 1 punto por cada 50 kcal.
const ses = (kcal) => ({ fecha: Date.UTC(2026, 10, 3, 12), duracion: 1200, distancia: 4800, paladas: 480, wattsProm: 140, kcal,
  muestras: Array.from({ length: 1200 }, (_, t) => ({ t: t + 1, w: 140, spm: 24, dist: (t + 1) * 4, split: 125 })) });
const e0 = J.estadoJuego([ses(0)], { ftp: 200, ahora: Date.UTC(2026, 10, 3, 18) });
const e1 = J.estadoJuego([ses(250)], { ftp: 200, ahora: Date.UTC(2026, 10, 3, 18) });
assert.ok(Math.abs((e1.atributos.gasto - e0.atributos.gasto) - 5) < 0.01, `gasto ${e1.atributos.gasto}`);
console.log('capacidad-juego OK', antes, ids(J.misionesDelDia('2026-11-03', rit)));
