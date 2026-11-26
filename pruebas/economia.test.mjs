// Ronda 2, etapa 12: economía, colección e insignias (R2-13, R2-15, R2-16, R2-17 y R2-18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as CB from '../src/coleccion-bote.js';
import { VELAS } from '../src/carrera.js';
import { resumenEventos, TIPOS_EVENTO } from '../src/habito.js';
import { libroDeCuentas, simular } from './sim-curva.mjs';

const ANTES = new Date(`${J.ECONOMIA_DESDE}T12:00`).getTime() - 864e5;
const DESDE = new Date(`${J.ECONOMIA_DESDE}T12:00`).getTime();

test('libro de cuentas: las 12 primeras semanas dan entre el 11 y el 15,5 % de las monedas de 2 años', () => {
  for (const p of ['plan4', 'plan3', 'ander', 'libre4']) {
    const l = libroDeCuentas(p);
    assert.equal(l.total, l.monedas, `${p}: el libro cuadra con las monedas del juego`);
    assert.ok(l.pct12 >= 11 && l.pct12 <= 15.5, `${p}: ${l.pct12.toFixed(1)} % en las 12 primeras semanas`);
    // La sesión es una fuente fija que dura: nunca menos del 10 % del total.
    assert.ok(l.fuentes.sesion / l.total >= 0.1, `${p}: la sesión paga ${(100 * l.fuentes.sesion / l.total).toFixed(0)} %`);
    // El segundo año no se queda en nada (meta de la propuesta: 0,8; hoy 0,58–0,79).
    assert.ok(l.y2y1 >= 0.55, `${p}: segundo año / primero = ${l.y2y1.toFixed(2)}`);
  }
});

test('los logros de las primeras semanas pagan la mitad desde ECONOMIA_DESDE, y antes lo mismo que siempre', () => {
  const por = Object.fromEntries(J.HAZANAS.map((h) => [h.id, h]));
  assert.deepEqual(['primera', 'mision1', 'gran', 'canal'].map((id) => [J.monedasHazana(por[id], ANTES), J.monedasHazana(por[id], DESDE)]), [[20, 10], [20, 10], [60, 30], [150, 75]]);
  assert.equal(J.monedasHazana(por.km100, DESDE), por.km100.monedas, 'los escalones largos no cambian');
  // En el juego: la primera sesión paga 20 antes y 10 desde la fecha.
  const s = (f) => ({ fecha: f, duracion: 1800, distancia: 6000, paladas: 700, wattsProm: 150, muestras: [] });
  const pago = (f) => J.estadoJuego([s(f)], { ahora: f + 1000 }).logros.find((l) => l.texto === 'Logro: Primera travesía').monedas;
  assert.equal(pago(ANTES), 20);
  assert.equal(pago(DESDE), 10);
});

test('remo libre: ningún atributo se queda en 0 tras 8 semanas, y antes de la fecha nada cambia', () => {
  const r = simular('libre4', { semanas: 8, base: new Date('2026-11-30T19:00').getTime() });
  const ceros = Object.entries(r.h.atributos).filter(([, v]) => Math.round(v) === 0).map(([k]) => k);
  assert.deepEqual(ceros, []);
  // Recuperación ya no es casi cero con un plan: al menos el 25 % de la media de los demás.
  const p = simular('plan4', { semanas: 8, base: new Date('2026-11-30T19:00').getTime() }).h.atributos;
  const otros = Object.entries(p).filter(([k]) => !['recuperacion', 'gasto'].includes(k)).map(([, v]) => v);
  assert.ok(p.recuperacion >= 0.25 * (otros.reduce((a, b) => a + b, 0) / otros.length));
  // Antes de ECONOMIA_DESDE, el remo libre sigue sin sumar Fuerza, Agilidad ni Recuperación (las reglas nuevas no tocan
  // lo ya remado).
  const viejo = simular('libre4', { semanas: 3, base: new Date('2026-11-02T19:00').getTime() }).h.atributos;
  for (const k of ['fuerza', 'agilidad', 'recuperacion']) assert.equal(Math.round(viejo[k]), 0, k);
  // Y la guía lo dice.
  assert.ok(J.comoSubir('voluntad').some((t) => /sesión libre/.test(t)));
  assert.ok(J.comoSubir('recuperacion').some((t) => /días de descanso/.test(t)));
});

test('velas de color: solo aspecto, a la mitad de precio', () => {
  for (const id of Object.keys(VELAS)) {
    assert.equal(CB.bonoEquipo({ vela: id }), null, id);
    assert.ok(VELAS[id].precio <= 1250);
  }
  // Las de tu clase siguen dando su ventaja.
  assert.equal(CB.bonoEquipo({ vela: 'vikingo-epica' }).salida, 12);
});

test('ventajas de un solo uso: el registro cuenta las compradas y las usadas', () => {
  assert.ok(TIPOS_EVENTO.includes('ventajaCompra') && TIPOS_EVENTO.includes('ventajaUso'));
  const ahora = Date.now();
  const ev = [{ t: ahora - 1000, tipo: 'ventajaCompra', id: 'viento', n: 3 }, { t: ahora - 500, tipo: 'ventajaUso', id: 'viento' }, { t: ahora - 40 * 864e5, tipo: 'ventajaUso', id: 'viento' }];
  assert.deepEqual(resumenEventos(ev, [], 28, ahora).ventajas, { compradas: 3, usadas: 1 });
});
