// El hito de la sesión y su plantilla (etapa 21).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Hi from '../src/hitos.js';
import * as Tj from '../src/tarjeta.js';

const ms = (k, h = '19:00') => new Date(`${k}T${h}`).getTime();
const ses = (k, ent) => ({ fecha: ms(k), entrenamiento: ent, duracion: 1800, distancia: 6000, splitProm: 150, wattsProm: 150, spmProm: 24 });

test('el hito más importante gana', () => {
  const todo = { jefe: { nombre: 'El Kraken', premio: 'Mascarón para su bote' }, rango: { nombre: 'Jarl' }, semana: { n: 2, de: 6 }, records: [{ clave: 'd2000', anterior: 480 }] };
  assert.equal(Hi.hitoDe(todo).clave, 'jefe');
  assert.equal(Hi.hitoDe(todo).texto, 'El Kraken cae · Mascarón para su bote');
  assert.equal(Hi.hitoDe({ ...todo, jefe: null }).clave, 'rango');
  assert.equal(Hi.hitoDe({ ...todo, jefe: null, plan: { semanas: 6, tira: [1, 1, 1, 1, 1, 1], nombre: 'Mi 2000 m' } }).clave, 'plan');
  assert.equal(Hi.hitoDe({ semana: { n: 2, de: 6 }, records: todo.records }).clave, 'semana');
  assert.equal(Hi.hitoDe({ records: todo.records }).clave, 'record');
  // La primera marca (sin anterior) y la potencia máxima no son récord para compartir.
  assert.equal(Hi.hitoDe({ records: [{ clave: 'd2000', anterior: null }, { clave: 'wmax', anterior: 300 }] }), null);
});

test('fantasma por poco: solo si le ganaste a todos y a alguno por 25 m o menos', () => {
  assert.equal(Hi.hitoDe({ rivales: [{ nombre: 'Fantasma Kaito', diferencia: 12 }, { nombre: 'Haakon', diferencia: 80 }] }).texto, 'Le ganó a Kaito por 12 m');
  assert.equal(Hi.hitoDe({ rivales: [{ nombre: 'Kaito', diferencia: 12 }, { nombre: 'Haakon', diferencia: -5 }] }), null);
  assert.equal(Hi.hitoDe({ rivales: [{ nombre: 'Kaito', diferencia: 40 }] }), null);
  assert.equal(Hi.hitoDe({}), null);
});

test('semana y plan completos con la sesión que los cierra', () => {
  const prog = { inicio: '2026-11-23', dias: [
    { fecha: '2026-11-23', ent: 'A' }, { fecha: '2026-11-25', ent: 'B' },
    { fecha: '2026-11-30', ent: 'A' }, { fecha: '2026-12-02', ent: 'B' },
  ] };
  const s1 = ses('2026-11-23', 'A');
  const s2 = ses('2026-11-25', 'B');
  assert.deepEqual(Hi.hitosDelPlan(prog, [], s1), { plan: null, semana: null });
  assert.deepEqual(Hi.hitosDelPlan(prog, [s1], s2), { plan: null, semana: { n: 1, de: 2 } });
  const s3 = ses('2026-11-30', 'A');
  const s4 = ses('2026-12-02', 'B');
  const r = Hi.hitosDelPlan(prog, [s1, s2, s3], s4);
  assert.deepEqual(r.plan, { semanas: 2, tira: [1, 1] });
  assert.deepEqual(r.semana, { n: 2, de: 2 });
  // Una sesión que no es del plan no cierra nada.
  assert.deepEqual(Hi.hitosDelPlan(prog, [s1], ses('2026-11-25', 'Otra')), { plan: null, semana: null });
});

test('la tarjeta lleva el sello y la frase del hito; el récord conserva la suya', () => {
  const s = ses('2026-11-23', 'Fondo');
  const jefe = Hi.hitoDe({ jefe: { nombre: 'El Kraken', premio: '' } });
  const c = Tj.contenidoTarjeta(s, {}, { hito: jefe });
  assert.equal(c.protagonista.kicker, '¡JEFE VENCIDO!');
  assert.match(c.contexto, /^El Kraken cae/);
  assert.equal(c.hito, 'jefe');
  const plan = Tj.contenidoTarjeta(s, {}, { hito: Hi.hitoDe({ plan: { semanas: 6, tira: [1, 1, 0.5, 1, 1, 1] } }) });
  assert.deepEqual(plan.tira, [1, 1, 0.5, 1, 1, 1]);
  const sin = Tj.contenidoTarjeta(s, {}, { hito: Hi.hitoDe({ records: [{ clave: 'dist', anterior: 5000 }] }) });
  assert.equal(sin.tira, null);
  assert.notEqual(sin.protagonista.kicker, '¡JEFE VENCIDO!');
});
