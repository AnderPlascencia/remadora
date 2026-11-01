import assert from 'node:assert/strict';
import * as P from '../programa.js';
import { EJEMPLOS } from '../entrenamientos.js';

const ctx = { kcalHabitual: 300, kcalSemana: 900 };
const fcpctOFtp = (b) => !b.metrica || ['ftp', 'fcpct'].includes(b.metrica);
for (const o of P.OBJETIVOS_PLAN) {
  for (const dias of [1, 2, 3, 4, 5]) {
    const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: o.clave, dias, semanas: 8, inicio: '2026-11-02', ctx });
    assert.equal(programa.dias.length, 8 * dias, `${o.clave} ${dias}`);
    const nombres = new Set(entrenamientos.map((e) => e.nombre));
    assert.ok(programa.dias.every((d) => nombres.has(d.ent)), 'cada día tiene su entrenamiento');
    if (o.prueba) assert.equal(programa.dias.at(-1).ent, o.prueba, 'termina con prueba');
    // Todo va en % del FTP o del pulso máximo: el plan se ajusta solo cuando cambian.
    assert.ok(entrenamientos.every((e) => (e.bloques || []).every(fcpctOFtp)), `${o.clave}: intensidades relativas`);
    assert.equal(programa.objetivo, o.clave);
  }
}
// 80/20: con 5 días, la 4.ª y 5.ª sesión de cada semana son suaves.
for (const o of P.OBJETIVOS_PLAN) {
  const { programa } = P.planPorObjetivo({ objetivo: o.clave, dias: 5, semanas: 4, inicio: '2026-11-02', ctx });
  const extras = programa.dias.filter((_, i) => i % 5 >= 3 && i < 15).map((d) => d.ent);
  assert.ok(extras.every((n) => /^Fondo|^Quema/.test(n)), `${o.clave}: ${extras}`); // «Quema N kcal» es al ritmo que quieras
}
// La carga sube y la semana 4 descarga.
const { programa: pv } = P.planPorObjetivo({ objetivo: 'vo2', dias: 3, semanas: 8, inicio: '2026-11-02', ctx });
assert.equal(pv.dias[0].ent, 'VO₂ 5 × 2 min');
assert.equal(pv.dias[9].ent, 'VO₂ 4 × 2 min', 'semana 4 de descarga');
assert.equal(pv.dias[18].ent, 'VO₂ 4 × 4 min');
const { programa: pu } = P.planPorObjetivo({ objetivo: 'umbral', dias: 3, semanas: 8, inicio: '2026-11-02', ctx });
assert.equal(pu.dias[0].ent, 'Umbral 3 × 8 min');
assert.equal(pu.dias[18].ent, 'Umbral 1 × 30 min');
assert.ok(pu.dias.filter((d) => d.ent === 'Prueba FTP 20 min').length === 2, 'prueba a mitad y al final');
// Nivel: empezar pide menos volumen.
const { programa: pi } = P.planPorObjetivo({ objetivo: 'base', nivel: 'inicio', dias: 3, semanas: 4, inicio: '2026-11-02', ctx });
assert.equal(pi.dias[0].ent, 'Fondo 20 min a pulso suave');
// Calorías: meta semanal que sube un 10 % y baja en la descarga.
const { programa: pc, entrenamientos: ec } = P.planPorObjetivo({ objetivo: 'calorias', dias: 4, semanas: 6, inicio: '2026-11-02', ctx });
assert.deepEqual(pc.metaKcal, [900, 1000, 1100, 950, 1300, 1450]);
assert.equal(P.metaKcalDe(pc, Date.parse('2026-11-10T12:00')), 1000);
assert.equal(P.metaKcalDe(pc, Date.parse('2026-10-10T12:00')), null);
assert.ok(ec.some((e) => e.objetivo?.metrica === 'kcal'), 'incluye una sesión con meta de calorías');
assert.equal(P.metaKcalDe(pv), null);
// Los planes de antes se rehacen con el plan nuevo equivalente.
assert.equal(P.objetivoPlan('ritmo').clave, 'umbral');
assert.equal(P.objetivoPlan('nivel').clave, 'base');
assert.equal(P.planPorObjetivo({ objetivo: 'distancia', dias: 2, semanas: 2, inicio: '2026-11-02', ctx }).programa.objetivo, 'base');
// Agrupación de los ejemplos
const g = Object.fromEntries(EJEMPLOS.map((e) => [e.nombre, P.enfoqueDe(e)]));
assert.equal(g['Prueba FTP 20 min'], 'pruebas');
assert.equal(g['Umbral 3 × 8 min (zona 4)'], 'potencia');
assert.equal(g['Pirámide de paladas'], 'tecnica');
assert.equal(g['150 kcal'], 'calorias');
assert.equal(g['5000 m'], 'distancia');
{
  const { programa } = P.planPorObjetivo({ objetivo: 'base', dias: 1, semanas: 6, inicio: '2026-11-02', ctx: { ...ctx, sinHistorial: true } });
  assert.equal(programa.dias.length, 6);
  assert.deepEqual([programa.objetivo, programa.porSemana, programa.semanas, programa.sinHistorial], ['base', 1, 6, true]);
}
console.log('plan por objetivo OK');

// Vista previa del plan: semanas con minutos y esfuerzo, la descarga marcada y qué subió respecto a la anterior.
{
  const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: 'umbral', dias: 3, semanas: 8, inicio: '2026-11-02', ctx });
  const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
  const sem = P.semanasPlan(programa, [], buscar, new Date('2026-11-03T10:00').getTime());
  assert.equal(sem.length, 8);
  assert.equal(sem[0].lunes, '2026-11-02');
  assert.ok(sem[0].actual && !sem[1].actual && !sem[0].pasada);
  assert.ok(sem.every((s) => s.sesiones === 3 && s.minutos > 0 && s.esfuerzo > 0));
  assert.ok(sem[3].descarga && sem[3].esfuerzo < sem[2].esfuerzo, 'semana 4 de descarga, más suave');
  assert.ok(sem[7].prueba, 'termina con prueba');
  assert.equal(sem[1].dias.find((d) => /^Umbral/.test(d.ent)).antes, undefined, 'igual que la semana anterior');
  assert.equal(sem[2].dias.find((d) => /^Umbral/.test(d.ent)).antes, 'Umbral 3 × 8 min');
  assert.ok(sem[5].esfuerzo > sem[1].esfuerzo, 'la carga sube');
  // Una sesión que la adaptación pasó a otro día no cuenta dos veces.
  const movido = structuredClone(programa);
  movido.dias[0].movido = true;
  movido.dias.push({ fecha: '2026-11-03', ent: movido.dias[0].ent });
  movido.dias.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  assert.equal(P.semanasPlan(movido, [], buscar, new Date('2026-11-03T10:00').getTime())[0].sesiones, 3);
  assert.equal(P.minutosSesion({ tipo: 'objetivo', objetivo: { metrica: 'kcal', valor: 300 } }), 30);
}
