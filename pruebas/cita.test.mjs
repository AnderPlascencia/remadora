// Tu cita (etapa 13): días y hora, la próxima cita, el .ics y el plan armado en tus días.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Ci from '../src/cita.js';
import * as P from '../src/programa.js';

const ms = (k, h = '12:00') => new Date(`${k}T${h}`).getTime();
const dia = (k) => (new Date(`${k}T12:00`).getDay() + 6) % 7;

test('días y hora: lo guardado si cuadra, si no los de serie', () => {
  assert.deepEqual(Ci.diasDeCita(null, 3), P.DIAS_PLAN[3]);
  assert.deepEqual(Ci.diasDeCita([4, 1, 1, 6], 3), [1, 4, 6]);
  assert.deepEqual(Ci.diasDeCita([1, 4], 3), P.DIAS_PLAN[3], 'no cuadra con los días por semana');
  assert.deepEqual(Ci.diasDeCita([9, 'x'], 1), P.DIAS_PLAN[1]);
  assert.deepEqual(Ci.alternarDia([0, 2], 4), [0, 2, 4]);
  assert.deepEqual(Ci.alternarDia([0, 2], 2), [0]);
  assert.equal(Ci.alternarDia([3], 3), null, 'al menos un día');
  assert.equal(Ci.alternarDia([0, 1, 2, 3, 4], 5), null, 'como mucho 5');
  assert.equal(Ci.horaValida('7:05'), '07:05');
  assert.equal(Ci.horaValida('25:00'), Ci.HORA_DEFECTO);
  assert.equal(Ci.horaValida(''), Ci.HORA_DEFECTO);
});

test('la próxima cita: hoy si aún no remaste y no pasó la hora; si no, el siguiente día', () => {
  // Martes 24 de noviembre de 2026; tus días: martes y jueves.
  const dias = [1, 3];
  assert.deepEqual(Ci.proximaCita({ dias, hora: '19:00', ahora: ms('2026-11-24', '10:00') }), { fecha: '2026-11-24', hora: '19:00', ent: null });
  assert.equal(Ci.proximaCita({ dias, hora: '19:00', ahora: ms('2026-11-24', '20:00') }).fecha, '2026-11-26', 'ya pasó la hora');
  assert.equal(Ci.proximaCita({ dias, hora: '19:00', ahora: ms('2026-11-24', '10:00'), hechoHoy: true }).fecha, '2026-11-26', 'ya remaste hoy');
  assert.equal(Ci.proximaCita({ dias: [1], ahora: ms('2026-11-24', '20:00') }).fecha, '2026-12-01', 'la semana que viene');
  // Con plan manda el plan.
  const programa = { dias: [{ fecha: '2026-11-23', ent: 'A' }, { fecha: '2026-11-27', ent: 'Fondo 45' }] };
  assert.deepEqual(Ci.proximaCita({ programa, dias, hora: '07:30', ahora: ms('2026-11-24') }), { fecha: '2026-11-27', hora: '07:30', ent: 'Fondo 45' });
  assert.equal(Ci.proximaCita({ programa: { dias: [{ fecha: '2026-11-20', ent: 'A' }] }, ahora: ms('2026-11-24') }), null, 'plan terminado');
  // Una cita movida a mano manda mientras no pase.
  const movida = { fecha: '2026-11-28', hora: '09:00', ent: 'Fondo 45' };
  assert.equal(Ci.proximaCita({ programa, movida, ahora: ms('2026-11-24') }).fecha, '2026-11-28');
  assert.equal(Ci.proximaCita({ programa: { dias: [...programa.dias, { fecha: '2026-12-01', ent: 'B' }] }, movida, ahora: ms('2026-11-29') }).fecha, '2026-12-01');
});

test('el texto de la cita', () => {
  const ahora = ms('2026-11-24');
  assert.equal(Ci.textoCita({ fecha: '2026-11-24', hora: '19:00' }, ahora), 'hoy, 19:00');
  assert.equal(Ci.textoCita({ fecha: '2026-11-25', hora: '19:00' }, ahora), 'mañana, 19:00');
  assert.equal(Ci.textoCita({ fecha: '2026-11-26', hora: '07:00' }, ahora), 'el jueves, 07:00');
  assert.match(Ci.textoCita({ fecha: '2026-12-03', hora: '19:00' }, ahora), /^el 3 de diciembre, 19:00$/);
  assert.equal(Ci.textoCita(null), '');
});

test('el .ics: un evento por sesión con aviso 30 min antes, a tu hora local', () => {
  const programa = { dias: [{ fecha: '2026-11-20', ent: 'Pasada' }, { fecha: '2026-11-24', ent: 'Umbral 3×10, a tope; sí' }, { fecha: '2026-11-26', ent: 'Fondo 45' }] };
  const citas = Ci.citasDelPlan(programa, { hora: '19:15', ahora: ms('2026-11-24'), duracion: (n) => (n === 'Fondo 45' ? 45 : null) });
  assert.equal(citas.length, 2, 'solo lo que queda');
  const t = Ci.ics(citas, { ahora: ms('2026-11-24') });
  assert.match(t, /^BEGIN:VCALENDAR\r\n/);
  assert.match(t, /END:VCALENDAR\r\n$/);
  assert.equal(t.match(/BEGIN:VEVENT/g).length, 2);
  assert.equal(t.match(/TRIGGER:-PT30M/g).length, 2);
  assert.match(t, /DTSTART:20261124T191500\r\n/);
  assert.match(t, /DURATION:PT45M/);
  assert.match(t, /SUMMARY:Remo: Umbral 3×10\\, a tope\\; sí/, 'texto escapado');
  assert.ok(t.split('\r\n').every((l) => l.length <= 75), 'líneas dobladas');
  assert.ok(!/\n(?<!\r\n)/.test(t.replace(/\r\n/g, '')), 'fin de línea CRLF');
});

test('el plan se arma en tus días, sin dos duras seguidas', () => {
  const base = { objetivo: 'umbral', nivel: 'medio', dias: 3, semanas: 6, inicio: '2026-11-23' };
  const { programa } = P.planPorObjetivo({ ...base, ctx: { diasSemana: [1, 3, 6] } });
  assert.deepEqual([...new Set(programa.dias.map((d) => dia(d.fecha)))].sort(), [1, 3, 6]);
  // Si no cuadran con los días por semana, los de serie.
  const serie = P.planPorObjetivo({ ...base, ctx: { diasSemana: [1, 3] } }).programa;
  assert.deepEqual([...new Set(serie.dias.map((d) => dia(d.fecha)))].sort(), P.DIAS_PLAN[3]);
  // Días seguidos (lunes, martes y miércoles): nunca dos duras en días seguidos.
  const { programa: seguidos, entrenamientos } = P.planPorObjetivo({ ...base, objetivo: 'vo2', ctx: { diasSemana: [0, 1, 2] } });
  const dura = (n) => P.esDura(entrenamientos.find((e) => e.nombre === n));
  const porFecha = new Map(seguidos.dias.map((d) => [d.fecha, d.ent]));
  for (const d of seguidos.dias) {
    const manana = new Date(ms(d.fecha) + 864e5);
    const k = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, '0')}-${String(manana.getDate()).padStart(2, '0')}`;
    if (porFecha.has(k)) assert.ok(!(dura(d.ent) && dura(porFecha.get(k))), `${d.fecha} y ${k}`);
  }
});
