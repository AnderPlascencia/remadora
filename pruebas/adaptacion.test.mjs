import assert from 'node:assert/strict';
import * as A from '../adaptacion.js';
import * as P from '../programa.js';
import { claveDia } from '../estadisticas.js';

const DIA = 864e5;
const ahora = Date.parse('2026-11-11T09:00'); // miércoles
const hoy = claveDia(ahora);
const dia = (d) => claveDia(ahora + d * DIA);
const { programa: base, entrenamientos } = P.planPorObjetivo({ objetivo: 'umbral', dias: 3, semanas: 6, inicio: hoy, ctx: {} });
const conHoy = (ent) => ({ ...structuredClone(base), inicio: dia(-7), dias: [...base.dias.filter((d) => d.fecha !== hoy), { fecha: hoy, ent }].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)) });
const muestras = (segs, w, fc = 0) => Array.from({ length: segs }, (_, t) => ({ t, w, fc }));
const ses = (d, extra) => ({ fecha: ahora + d * DIA, duracion: 1800, muestras: muestras(1800, 150), ...extra });

// Sin sesiones no cambia nada y una segunda revisión el mismo día no repite.
const r0 = A.revisarPlan({ programa: base, sesiones: [], entrenamientos, ftp: 200, ahora });
assert.equal(r0.avisos.length, 0);
assert.equal(A.revisarPlan({ programa: r0.programa, sesiones: [], entrenamientos, ftp: 200, ahora }), null);

// 1. Muy cansado: hoy tocaba umbral y pasa a fondo suave.
const pesadas = Array.from({ length: 30 }, (_, i) => ses(-30 + i, { muestras: muestras(1800, 150) }));
const reventado = [...pesadas, ...[-3, -2, -1].map((d) => ses(d, { duracion: 7200, muestras: muestras(7200, 230) }))];
const r1 = A.revisarPlan({ programa: conHoy('Umbral 3 × 8 min'), sesiones: reventado, entrenamientos, ftp: 200, ahora });
const hoyR1 = r1.programa.dias.find((d) => d.fecha === hoy);
assert.equal(hoyR1.ent, 'Fondo 30 min a pulso suave');
assert.equal(hoyR1.original, 'Umbral 3 × 8 min');
assert.equal(r1.entrenamientos[0].nombre, 'Fondo 30 min a pulso suave');
assert.match(r1.avisos[0], /cansado|carga/);
assert.equal(r1.programa.avisos.at(-1).dia, hoy);
// Un fondo no se toca aunque estés cansado.
const r1b = A.revisarPlan({ programa: conHoy('Fondo 40 min (zona 2)'), sesiones: reventado, entrenamientos, ftp: 200, ahora });
assert.equal(r1b.programa.dias.find((d) => d.fecha === hoy).ent, 'Fondo 40 min (zona 2)');

// 2. Dos sesiones de umbral fuera de rango → rangos un 3 % más bajos; dos fáciles → un 3 % más altos.
const umbral = (d, pct, rpe = 8) => ses(d, { pctEnRango: pct, rpe, muestras: muestras(1800, 190) });
const r2 = A.revisarPlan({ programa: conHoy('Fondo 40 min (zona 2)'), sesiones: [umbral(-3, 50), umbral(-1, 55)], entrenamientos, ftp: 200, ahora });
assert.equal(r2.programa.factor, 0.97);
const r3 = A.revisarPlan({ programa: conHoy('Fondo 40 min (zona 2)'), sesiones: [umbral(-3, 98, 5), umbral(-1, 97, 5)], entrenamientos, ftp: 200, ahora });
assert.equal(r3.programa.factor, 1.03);
// La misma pareja de sesiones no se cuenta dos veces.
const r3b = A.revisarPlan({ programa: { ...r3.programa, revision: 'otra' }, sesiones: [umbral(-3, 98, 5), umbral(-1, 97, 5)], entrenamientos, ftp: 200, ahora });
assert.equal(r3b.programa.factor, 1.03);

// 3. Dos fondos con desacople bajo → el próximo fondo dura 10 min más.
const fondo = (d) => ses(d, { desacople: 3, muestras: muestras(2400, 140) });
const r4 = A.revisarPlan({ programa: conHoy('Umbral 3 × 8 min'), sesiones: [fondo(-4), fondo(-2)], entrenamientos, ftp: 200, ahora });
const alargado = r4.programa.dias.find((d) => d.alargado);
assert.ok(alargado && alargado.fecha > hoy);
assert.equal(Number(alargado.ent.match(/\d+/)[0]), Number(alargado.original.match(/\d+/)[0]) + 10);
assert.equal(r4.programa.extraFondo, 10);

// 4. Sesión dura perdida ayer: pasa a hoy si hoy toca fondo.
const conPerdida = { ...structuredClone(base), dias: [{ fecha: dia(-1), ent: 'Umbral 3 × 8 min' }, { fecha: hoy, ent: 'Fondo 40 min (zona 2)' }, { fecha: dia(2), ent: 'Sweet spot 2 × 12 min' }] };
const r5 = A.revisarPlan({ programa: conPerdida, sesiones: [], entrenamientos, ftp: 200, ahora });
assert.equal(r5.programa.dias.find((d) => d.fecha === hoy).ent, 'Umbral 3 × 8 min');
assert.match(r5.avisos[0], /pasé a hoy/);
// Si ayer ya remaste algo duro, no se juntan dos días duros.
const r5b = A.revisarPlan({ programa: conPerdida, sesiones: [ses(-1, { entrenamiento: 'Otra', muestras: muestras(1800, 200) })], entrenamientos, ftp: 200, ahora });
assert.equal(r5b.programa.dias.find((d) => d.fecha === hoy).ent, 'Fondo 40 min (zona 2)');

// 5. Semana floja: 0 de 3 la semana pasada → se repite y el resto se corre 7 días.
const largo = P.planPorObjetivo({ objetivo: 'base', dias: 3, semanas: 4, inicio: '2026-10-26', ctx: {} }).programa;
const r6 = A.revisarPlan({ programa: largo, sesiones: [], entrenamientos, ftp: 200, ahora });
assert.equal(r6.programa.dias.length, largo.dias.length + 3);
assert.equal(r6.programa.dias.at(-1).fecha, claveDia(Date.parse(`${largo.dias.at(-1).fecha}T12:00`) + 7 * DIA));
assert.match(r6.avisos.at(-1), /0 de 3/);

// Regresión: hoy sin sesión en el plan y una dura perdida ayer → se añade el día de hoy sin romper el paso 5.
const sinHoy = { ...structuredClone(base), inicio: dia(-20), dias: [{ fecha: dia(-1), ent: 'Umbral 3 × 8 min' }, { fecha: dia(2), ent: 'Sweet spot 2 × 12 min' }] };
const r7 = A.revisarPlan({ programa: sinHoy, sesiones: [], entrenamientos, ftp: 200, ahora });
assert.equal(r7.programa.dias.find((d) => d.fecha === hoy).ent, 'Umbral 3 × 8 min');

// Pulso de calentamiento: 8 lpm más que en tres sesiones anteriores a los mismos watts.
const cal = (fc) => ({ muestras: Array.from({ length: 400 }, (_, t) => ({ t, w: 120, fc })) });
assert.equal(A.pulsoDeMas(cal(118).muestras, [cal(110), cal(110), cal(111)]), 8);
assert.equal(A.pulsoDeMas(cal(118).muestras, [cal(110)]), null);
console.log('adaptación OK');
