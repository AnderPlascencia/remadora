import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasoRedondo } from '../src/grafica.js';

test('la rejilla usa pasos redondos: 30 golpes/min dan 0, 10, 20, 30, 40', () => {
  assert.equal(pasoRedondo((30 * 1.15) / 4), 10);
  assert.equal(pasoRedondo((260 * 1.15) / 4), 75);
  assert.equal(pasoRedondo(0.4), 1);
  assert.equal(pasoRedondo(1200), 2000);
  for (const v of [3, 7, 12, 33, 80, 140, 420]) assert.ok(pasoRedondo(v) >= v);
});

test('la gráfica en vivo tiene un eje fijo de 5 min que salta de minuto en minuto', async () => {
  const { ventanaVivo } = await import('../src/grafica.js');
  assert.deepEqual(ventanaVivo(0), [0, 300]);
  assert.deepEqual(ventanaVivo(299), [0, 300]);
  assert.deepEqual(ventanaVivo(301), [60, 360]);
  assert.deepEqual(ventanaVivo(360), [60, 360]);
  assert.deepEqual(ventanaVivo(361), [120, 420]);
});

test('en vivo solo se repinta todo si cambia el marco; si no, lo nuevo o nada', async () => {
  const { planVivo } = await import('../src/grafica.js');
  assert.equal(planVivo(null, 'a', [5, 5]), 'todo');
  const previo = { firma: 'a', ultimos: [5, 5] };
  assert.equal(planVivo(previo, 'a', [5, 5]), 'nada');
  assert.equal(planVivo(previo, 'a', [6, 6]), 'nuevo');
  assert.equal(planVivo(previo, 'b', [6, 6]), 'todo');
  // Si los datos vuelven atrás (otra sesión), se repinta todo.
  assert.equal(planVivo(previo, 'a', [3, 3]), 'todo');
});
