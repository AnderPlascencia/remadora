// Plan de meta (E-2): zonas en % del FTP equivalente, la prueba con calentamiento y guía de ritmo, el ajuste de
// rangos también en split, las zonas rehechas tras la prueba de mitad y el 2000 m equivalente desde tu curva.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/programa.js';
import { zonasTrasPrueba } from '../src/meta-zonas.js';
import * as E from '../src/estadisticas.js';
import { normalizarBloques } from '../src/entrenamientos.js';
import { tipoPlan } from '../src/capacidades.js';

const INICIO = '2026-12-07';
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} frente a ${b}`);

test('con un 2000 m en 10:40 (2:40), el fondo queda en ~65 % del FTP, el firme en ~85 % y el umbral en ~97 %', () => {
  for (const split of [95, 117, 160]) {
    const { entrenamientos } = P.planPorMeta({ distancia: 2000, segundos: split * 4, semanas: 8, inicio: INICIO });
    const bloque = (re, nb) => { const e = entrenamientos.find((x) => re.test(x.nombre)); return [e, e.bloques.find((b) => nb.test(b.nombre))]; };
    const [ef, fondo] = bloque(/^Fondo \d+ min a/, /^Fondo$/);
    const [, firme] = bloque(/firme$/, /^Firme/);
    const [eu, umbral] = bloque(/^Umbral/, /^Umbral/);
    cerca(P.pctBloque(fondo, split), 65, 2, `fondo con ${split}`);
    cerca(P.pctBloque(firme, split), 85, 2, `firme con ${split}`);
    cerca(P.pctBloque(umbral, split), 97, 2, `umbral con ${split}`);
    // La clasificación dice lo mismo que los topes: el fondo es fondo y el umbral, umbral, también para quien rema lento.
    assert.equal(tipoPlan(ef), 'fondo');
    assert.equal(tipoPlan(eu), 'umbral');
  }
});

test('la prueba del plan lleva 10 min de calentamiento, arranques y los primeros 500 m sin pasarte', () => {
  const split = 120;
  const { entrenamientos } = P.planPorMeta({ distancia: 2000, segundos: split * 4, semanas: 8, inicio: INICIO });
  const prueba = entrenamientos.find((e) => /^Prueba/.test(e.nombre));
  assert.equal(prueba.tipo, 'intervalos');
  assert.equal(tipoPlan(prueba), 'prueba');
  const i = prueba.bloques.findIndex((b) => /^Prueba/.test(b.nombre));
  const antes = prueba.bloques.slice(0, i).reduce((a, b) => a + (b.duracion || 0), 0);
  assert.ok(antes >= 600 + 180, `calentamiento de ${antes} s`);
  assert.ok(prueba.bloques.slice(0, i).some((b) => /arranque/.test(b.nombre)), 'con arranques');
  const tramos = prueba.bloques.filter((b) => /^Prueba/.test(b.nombre));
  assert.equal(tramos.reduce((a, b) => a + b.cantidad, 0), 2000);
  assert.ok(tramos.every((b) => b.fin === 'distancia'));
  assert.deepEqual([tramos[0].cantidad, tramos[0].min, tramos[0].max], [500, split + 1, split + 2]);
  assert.equal(prueba.bloques.at(-1).nombre, 'Enfriamiento');
});

test('el ajuste de rangos del plan también llega a los bloques en split', () => {
  const b = { nombre: 'Umbral', duracion: 480, metrica: 'split', min: 130, max: 134 };
  const [mas] = normalizarBloques([b], 200, 0, { factorSplit: 1.03 });
  const k = 1.03 ** (1 / 3);
  assert.deepEqual([mas.min, mas.max], [Math.round(130 / k), Math.round(134 / k)]);
  assert.ok(mas.min < b.min, 'un 3 % más de potencia es un split más rápido');
  const [igual] = normalizarBloques([b], 200, 0, {});
  assert.deepEqual([igual.min, igual.max], [130, 134]);
});

test('el 2000 m equivalente de una meta de 5 km sale de tu curva cuando la hay (E16)', () => {
  const pc = { cp: 200, wPrima: 15000 };
  const t5 = E.tiempoPara(5000, pc);
  assert.equal(P.ref2kDe(5000, t5, pc), Math.round(E.tiempoPara(2000, pc) / 4));
  assert.ok(P.ref2kDe(5000, t5, null) > 0, 'sin curva, la ley de Paul');
  const ctx = { pc };
  const conPc = P.planPorMeta({ distancia: 5000, segundos: t5, semanas: 8, inicio: INICIO, ctx });
  assert.ok(conPc.entrenamientos.filter((e) => e.bloques).every((e) => e.splitMeta === Math.round(E.tiempoPara(2000, pc) / 4)));
});

test('tras la prueba de mitad, las zonas que quedan salen de tu marca real', () => {
  const split = 120;
  const { programa, entrenamientos } = P.planPorMeta({ distancia: 2000, segundos: split * 4, semanas: 8, inicio: INICIO });
  const ultimo = programa.dias.at(-1).fecha;
  const mitad = programa.dias.find((d) => /^Prueba/.test(d.ent) && d.fecha < ultimo);
  assert.ok(mitad, 'el plan tiene prueba de mitad');
  // La prueba sale 5 s por 500 m más lenta que la meta (8:20).
  const muestras = [];
  for (let t = 0; t <= 500; t++) muestras.push({ t, dist: t * 4, w: 180 });
  const fecha = new Date(`${mitad.fecha}T18:00`).getTime();
  const sesion = { id: 'p', fecha, entrenamiento: mitad.ent, duracion: 500, distancia: 2000, muestras };
  const ahora = fecha + 864e5;
  const r = zonasTrasPrueba({ programa: { ...programa, factor: 0.97 }, sesiones: [sesion], entrenamientos, ahora });
  assert.equal(r.programa.zonasDesde, mitad.fecha);
  assert.equal(r.programa.factor, 1, 'los rangos vuelven al 100 %');
  assert.ok(r.avisos.some((x) => /prueba de mitad dio 8:20/.test(x)), r.avisos.join(' | '));
  const despues = r.programa.dias.filter((d) => d.fecha > mitad.fecha && !/^Prueba/.test(d.ent));
  assert.ok(despues.length && despues.every((d) => / · tras la prueba$/.test(d.ent)), despues.map((d) => d.ent).join(', '));
  const fondo = r.entrenamientos.find((e) => /^Fondo \d+ min a/.test(e.nombre));
  assert.equal(fondo.splitMeta, 125);
  cerca(P.pctBloque(fondo.bloques.find((b) => b.nombre === 'Fondo'), 125), 65, 2, 'fondo con la marca real');
  // Lo de antes de la prueba no cambia, y la revisión no se repite.
  assert.ok(r.programa.dias.filter((d) => d.fecha <= mitad.fecha).every((d) => !/tras la prueba/.test(d.ent)));
  assert.equal(zonasTrasPrueba({ programa: r.programa, sesiones: [sesion], entrenamientos: [...entrenamientos, ...r.entrenamientos], ahora: ahora + 2 * 864e5 }), null);
});
