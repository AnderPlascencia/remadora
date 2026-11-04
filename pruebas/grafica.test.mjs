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
