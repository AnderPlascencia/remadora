// ⚖ Ronda 2, etapa 9 (R2-4): del mes 7 en adelante sigue habiendo premios. Cofre a mitad de cada rango y escalones
// intermedios en las metas largas, todo desde HITOS_DESDE.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import { simular } from './sim-curva.mjs';

const D = 864e5;
const BASE = new Date('2026-11-23T19:00').getTime();
const sem = (f) => Math.floor((f - BASE) / (7 * D)) + 1;
const GRANDES = new Set(['jefe', 'hazana', 'maestria', 'mejora', 'hito']);

test('cofre de medio rango: 100 monedas al cruzar el 15, 25 … 85, solo desde el corte', () => {
  const { h } = simular('plan4');
  const cofres = h.logros.filter((l) => l.tipo === 'hito');
  assert.deepEqual(cofres.map((l) => Number(l.texto.match(/nivel (\d+)/)[1])), J.NIVELES_MEDIO_RANGO);
  assert.ok(cofres.every((l) => l.monedas === J.MONEDAS_MEDIO_RANGO && l.xp === 0));
  assert.match(cofres[0].texto, /^Cofre de medio rango: nivel 15, a medio camino de Karl$/);
  assert.match(cofres.at(-1).texto, /a medio camino del nivel máximo$/);
  // Antes del corte no hay cofres: la misma simulación empezando un año antes.
  const antes = simular('plan4', { semanas: 20, base: new Date('2025-11-24T19:00').getTime() }).h;
  assert.equal(antes.logros.filter((l) => l.tipo === 'hito').length, 0);
});

test('escalones intermedios: entre cada dos metas largas hay otra, y solo se cobran desde el corte', () => {
  const ids = new Set(J.HAZANAS.map((x) => x.id));
  for (const id of ['km750', 'km1750', 'km2000', 'ses75', 'ses150', 'ses350', 'semanas15', 'semanas30', 'semanas52', 'nivel50', 'nivel70']) {
    assert.ok(ids.has(id), id);
    assert.equal(J.HAZANAS.find((x) => x.id === id).desde, J.HITOS_DESDE, id);
  }
  // Sin repetir ids: la vista agrupa por serie y se quedaría con uno.
  assert.equal(ids.size, J.HAZANAS.length);
});

// La métrica de la etapa: premios grandes por sesión entre las semanas 27 y 104, de 0,06 a 0,12 o más con plan4.
test('simulación de 2 años: 0,12 o más premios grandes por sesión entre las semanas 27 y 104 con plan4', () => {
  for (const perfil of ['plan4', 'ander']) {
    const { h, ses } = simular(perfil);
    const n = h.logros.filter((l) => GRANDES.has(l.tipo) && sem(l.fecha) >= 27).length;
    const s = ses.filter((x) => sem(x.fecha) >= 27).length;
    assert.ok(n / s >= 0.12, `${perfil}: ${(n / s).toFixed(3)}`);
  }
});
