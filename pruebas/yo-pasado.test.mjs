// Etapa 32 (reducida): «Yo hace 7 semanas», tu misma sesión de hace 6 a 8 semanas como línea de referencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/estadisticas.js';

const AHORA = new Date('2026-11-23T12:00').getTime();
const SEM = 7 * 864e5;
const ses = (id, semanas, nombre = 'Umbral 3 × 8') => ({ id, fecha: AHORA - semanas * SEM, entrenamiento: nombre, duracion: 1800, distancia: 7000, muestras: [{ t: 1, w: 150, dist: 4 }] });

test('yo pasado: la sesión del mismo entrenamiento más cercana a 7 semanas, entre 6 y 8', () => {
  const lista = [ses(1, 1), ses(2, 5.5), ses(3, 6.2), ses(4, 7.3), ses(5, 8.6), ses(6, 7, 'Fondo')];
  assert.equal(E.elegirRival(lista, 'Umbral 3 × 8', 'pasado', AHORA).id, 4);
  // Fuera de la ventana no hay referencia.
  assert.equal(E.elegirRival([ses(1, 1), ses(2, 5.5), ses(5, 8.6)], 'Umbral 3 × 8', 'pasado', AHORA), null);
  // Solo cuenta el mismo entrenamiento y con muestras (o su resumen).
  assert.equal(E.elegirRival(lista, 'Fondo', 'pasado', AHORA).id, 6);
  const { muestras, ...sinM } = ses(7, 7);
  assert.equal(E.elegirRival([{ ...sinM, res: { n: 1 } }], 'Umbral 3 × 8', 'pasado', AHORA).id, 7);
  assert.equal(E.elegirRival([sinM], 'Umbral 3 × 8', 'pasado', AHORA), null);
  // Las de antes siguen igual.
  assert.equal(E.elegirRival(lista, 'Umbral 3 × 8', 'anterior', AHORA).id, 1);
});
