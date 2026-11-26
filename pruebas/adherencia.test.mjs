// Adherencia (E-5 de la ronda 2): el plan se ofrece a la medida de lo que remas (E18) y los rangos suben aunque no
// marques el esfuerzo, si el pulso del trabajo va sobrado (E17).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/adaptacion.js';
import * as G from '../src/generador-plan.js';
import * as Hab from '../src/habito.js';
import { claveDia, pulsoTrabajoPct } from '../src/estadisticas.js';

const DIA = 864e5;
const ahora = Date.parse('2026-11-11T09:00'); // miércoles
const hoy = claveDia(ahora);
const dia = (d) => claveDia(ahora + d * DIA);

test('pulso medio del trabajo en % del máximo, sin el calentamiento', () => {
  const bloques = [{ nombre: 'Calentamiento', duracion: 300, metrica: 'ftp', min: 50, max: 60 }, { nombre: 'Umbral 1/1', duracion: 600, metrica: 'ftp', min: 95, max: 100 }];
  const muestras = Array.from({ length: 900 }, (_, t) => ({ t, fc: t < 300 ? 100 : 160 }));
  assert.equal(pulsoTrabajoPct(muestras, bloques, 200), 80);
  assert.equal(pulsoTrabajoPct(muestras, null, 200), null, 'sin bloques');
  assert.equal(pulsoTrabajoPct(muestras.map((x) => ({ t: x.t })), bloques, 200), null, 'sin pulso');
});

test('dos sesiones fuertes sobradas sin esfuerzo marcado: suben los rangos si el pulso del trabajo va bajo el 85 %', () => {
  const { programa: base, entrenamientos } = G.planPorObjetivo({ objetivo: 'umbral', dias: 3, semanas: 6, inicio: hoy, ctx: {} });
  const prog = { ...structuredClone(base), inicio: dia(-7) };
  const umbral = (d, extra) => ({ fecha: ahora + d * DIA, duracion: 1800, pctEnRango: 98, muestras: Array.from({ length: 1800 }, (_, t) => ({ t, w: 190 })), ...extra });
  const factor = (a, b) => A.revisarPlan({ programa: prog, sesiones: [umbral(-3, a), umbral(-1, b)], entrenamientos, ftp: 200, ahora }).programa.factor;
  assert.equal(factor({ fcPctTrabajo: 80 }, { fcPctTrabajo: 82 }), 1.03);
  assert.equal(factor({ fcPctTrabajo: 80 }, { fcPctTrabajo: 90 }), 1, 'una con el pulso alto');
  assert.equal(factor({}, {}), 1, 'sin pulso ni esfuerzo');
  assert.equal(factor({ fcPctTrabajo: 80 }, { fcPctTrabajo: 80, rpe: 8 }), 1, 'tu esfuerzo manda');
  assert.equal(factor({}, { rpe: 5 }), 1.03, 'con tu esfuerzo, como antes');
});

test('plan de 4 días con 2 semanas por debajo del 60 %: se ofrece una sola vez pasar a lo que remas', () => {
  // Plan de 4 días que empezó hace 3 semanas (lunes 19 de octubre… el lunes de esta semana es el 9 de noviembre).
  const inicio = claveDia(Date.parse('2026-10-19T12:00'));
  const { programa } = G.planPorObjetivo({ objetivo: 'umbral', dias: 4, semanas: 8, inicio, ctx: {} });
  const delPlan = (desde, hasta) => programa.dias.filter((d) => d.fecha >= desde && d.fecha < hasta);
  const hecho = (d) => ({ fecha: Date.parse(`${d.fecha}T08:00`), duracion: 1800, entrenamiento: d.ent });
  // Semanas del 26 de octubre y del 2 de noviembre: 2 de 4 hechas en cada una (50 %).
  const s1 = delPlan('2026-10-26', '2026-11-02');
  const s2 = delPlan('2026-11-02', '2026-11-09');
  const flojo = [...s1.slice(0, 2), ...s2.slice(0, 2)].map(hecho);
  const r = Hab.planAMedida(programa, flojo, ahora);
  assert.deepEqual(r, { media: 2, dias: 3 }, 'remas 2 por semana: un día menos cada vez');
  assert.match(Hab.textoAMedida(r), /Remas unas 2 veces por semana\. ¿Paso tu plan a 3 días\? Mantienes la sesión clave y quitas un fondo\./);
  // Con una de las dos semanas al 75 % no se ofrece.
  assert.equal(Hab.planAMedida(programa, [...s1.slice(0, 2), ...s2.slice(0, 3)].map(hecho), ahora), null);
  // Ya mostrado otro día, o respondido hoy: no vuelve.
  assert.equal(Hab.planAMedida({ ...programa, diasAMedida: { dia: dia(-1) } }, flojo, ahora), null);
  assert.equal(Hab.planAMedida({ ...programa, diasAMedida: { dia: hoy, respondido: true } }, flojo, ahora), null);
  assert.ok(Hab.planAMedida({ ...programa, diasAMedida: { dia: hoy } }, flojo, ahora), 'el mismo día sigue hasta responder');
  // Un plan de 2 días no baja más.
  const { programa: dos } = G.planPorObjetivo({ objetivo: 'umbral', dias: 2, semanas: 8, inicio, ctx: {} });
  assert.equal(Hab.planAMedida(dos, [], ahora), null);
});
