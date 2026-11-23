import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DPR_MAX, FPS_MAX, densidadCarrera, medirCuadro, DENSIDAD_VENTANA, fpsTope, tocaPintar } from '../src/carrera.js';
import { DPR_MAX_GRAFICA } from '../src/grafica.js';

test('la carrera 2D y 3D pinta como mucho a densidad 2 y la realista a 1,5; las gráficas a 2', () => {
  assert.deepEqual(DPR_MAX, { '2d': 2, '3d': 2, real: 1.5 });
  assert.equal(DPR_MAX_GRAFICA, 2);
  // El teléfono de Ander es de densidad 4: baja a 2.
  assert.equal(densidadCarrera('2d', 4), 2);
  assert.equal(densidadCarrera('3d', 4), 2);
  assert.equal(densidadCarrera('real', 4), 1.5);
  // Una pantalla de menos densidad que el tope se queda como está.
  assert.equal(densidadCarrera('3d', 1.5), 1.5);
  assert.equal(densidadCarrera('2d', 1), 1);
});

test('los escalones bajan la densidad a 1,5 y a 1,25, nunca por debajo de 1', () => {
  assert.equal(densidadCarrera('3d', 4, 1), 1.5);
  assert.equal(densidadCarrera('3d', 4, 2), 1.25);
  assert.equal(densidadCarrera('3d', 4, 9), 1.25);
  assert.equal(densidadCarrera('real', 4, 2), 1);
});

const nueva = () => ({ modo: null, escalon: 0, n: 0, lentos: 0 });
const cuadros = (d, modo, ms, n = DENSIDAD_VENTANA) => { for (let i = 0; i < n; i++) medirCuadro(d, modo, ms); };

test('con la mayoría de cuadros lentos baja un escalón por cada 60 cuadros, y no más de dos', () => {
  const d = nueva();
  const lento3d = 1.5 * (1000 / FPS_MAX['3d']) + 5;
  cuadros(d, '3d', lento3d);
  assert.equal(d.escalon, 1);
  cuadros(d, '3d', lento3d);
  assert.equal(d.escalon, 2);
  cuadros(d, '3d', lento3d);
  assert.equal(d.escalon, 2);
});

test('los cuadros a su ritmo, los tirones sueltos y las pausas largas no bajan la densidad', () => {
  const d = nueva();
  cuadros(d, '3d', 1000 / FPS_MAX['3d']);
  assert.equal(d.escalon, 0);
  // Un tercio de tirones: no llega a los dos tercios.
  for (let i = 0; i < DENSIDAD_VENTANA; i++) medirCuadro(d, '3d', i % 3 === 0 ? 120 : 33);
  assert.equal(d.escalon, 0);
  // Pestaña oculta o lienzo fuera de la pantalla: huecos de segundos que no son cuadros lentos.
  cuadros(d, '3d', 2_000);
  assert.equal(d.escalon, 0);
  // 2D a 30 fps (33 ms) en un tope de 60 sí es lento.
  cuadros(d, '2d', 34);
  assert.equal(d.escalon, 1);
});

test('al cambiar de vista la densidad vuelve al máximo de la vista nueva', () => {
  const d = nueva();
  cuadros(d, '3d', 80);
  assert.equal(d.escalon, 1);
  medirCuadro(d, '2d', 16);
  assert.equal(d.modo, '2d');
  assert.equal(d.escalon, 0);
});

test('en pausa y con «Ahorro de batería» la carrera va a 30 fps, y el ahorro deja la densidad en 1,5', () => {
  assert.equal(fpsTope('2d'), 60);
  assert.equal(fpsTope('2d', true), 30, 'en pausa');
  assert.equal(fpsTope('2d', false, true), 30, 'con ahorro');
  assert.equal(fpsTope('3d', true, true), 30, 'la 3D ya iba a 30');
  // 2D en pausa: a 20 ms del último cuadro no toca pintar; a 33 ms sí.
  const c = { modo: '2d', estado: { pausa: true }, ultimoPintado: 1000 };
  assert.equal(tocaPintar(c, 1020), false);
  assert.equal(tocaPintar(c, 1033), true);
  assert.equal(tocaPintar({ ...c, estado: { pausa: false } }, 1020), true);
  assert.equal(densidadCarrera('2d', 4, 0, true), 1.5);
  assert.equal(densidadCarrera('real', 4, 0, true), 1.5);
  assert.equal(densidadCarrera('2d', 4, 2, true), 1, 'los escalones siguen bajando desde 1,5');
  assert.equal(densidadCarrera('2d', 1.25, 0, true), 1.25);
});

test('una 2D a 30 fps por pausa o ahorro no cuenta como lenta', () => {
  const d = nueva();
  for (let i = 0; i < DENSIDAD_VENTANA * 2; i++) medirCuadro(d, '2d', 34, fpsTope('2d', true));
  assert.equal(d.escalon, 0);
});
