// Arreglos rápidos del juego (ronda 2, etapa 7): R2-8 (la diaria del plan a tu medida), R2-14 (precios de los paisajes,
// en etapa12.test) y R2-19 (lo que dice cada logro, jefe y misión es lo que se paga).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import { simular } from './sim-curva.mjs';

const hist = (ent, parejos, rangos = []) => parejos.map((parejo, i) => ({ ent, parejo, rango: rangos[i] ?? null }));

test('R2-8: la diaria del plan pide tu % parejo de siempre en esa sesión (percentil 35), con 3 sesiones o más', () => {
  assert.equal(J.diariaATuMedida(hist('Fondo 45', [80, 90]), 'Fondo 45'), null, 'con 2 sesiones, la de antes');
  const m = J.diariaATuMedida(hist('Fondo 45', [60, 70, 75, 80, 85, 90, 95, 72, 88, 66], [90, 95, 99, 97, 92, 94, 96, 98, 91, 93]), 'Fondo 45');
  assert.deepEqual(m, { parejo: 72, rango: 93 });
  // Con 20 sesiones repartidas, la meta se cumple en 13 de 20 (65 %, la propuesta pedía 60–75 %).
  const v = Array.from({ length: 20 }, (_, i) => 50 + 2 * i);
  const meta = J.diariaATuMedida(hist('F', v), 'F').parejo;
  assert.equal(v.filter((x) => x >= meta).length, 13);
  // Solo cuentan las de esa misma sesión, y la meta no baja del 40 % ni pasa del 95 %.
  assert.equal(J.diariaATuMedida(hist('Otra', [99, 99, 99]), 'Fondo 45'), null);
  assert.equal(J.diariaATuMedida(hist('F', [10, 12, 15]), 'F').parejo, 40);
  assert.equal(J.diariaATuMedida(hist('F', [100, 100, 100]), 'F').parejo, 95);
});

test('R2-8: desde el corte, un día de plan con historia sale la diaria a tu medida; antes, la de siempre', () => {
  const medida = { parejo: 72, rango: 93 };
  const ids = (dia) => J.misionesDelDia(dia, null, { planHoy: 'Fondo 45', medida }).map((x) => x.clave);
  assert.deepEqual(ids('2026-11-25'), ['cadencia']);
  const dias = ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'].map((d) => J.misionesDelDia(d, null, { planHoy: 'Fondo 45', medida })[0]);
  assert.ok(dias.every((x) => ['parejo-medida', 'rango-medida'].includes(x.clave)));
  assert.ok(dias.some((x) => x.clave === 'rango-medida') && dias.some((x) => x.clave === 'parejo-medida'), 'alterna');
  assert.match(dias.find((x) => x.clave === 'parejo-medida').texto, /el 72 % de la sesión/);
  // Las pruebas del plan siguen igual.
  assert.equal(J.misionesDelDia('2026-11-27', null, { planHoy: 'Prueba 2000 m', medida })[0].clave, 'prueba');
});

test('R2-19: los logros, jefes y misiones semanales pagan lo que dicen (xpReal)', () => {
  const { h } = simular('plan4');
  const fecha = h.logros.at(-1).fecha;
  assert.equal(J.xpReal(400, fecha), 200);
  let vistos = 0;
  for (const l of h.logros) {
    const hz = l.tipo === 'hazana' && J.HAZANAS.find((x) => l.texto === `Logro: ${x.nombre}`);
    if (hz) { assert.equal(l.xp, J.xpReal(hz.xp, l.fecha), l.texto); vistos++; }
    if (l.tipo === 'jefe') { const c = J.CAPITULOS.find((x) => l.texto.endsWith(`«${x.nombre}»`)); assert.equal(l.xp, J.xpReal(c.xp, l.fecha), l.texto); vistos++; }
    if (l.tipo === 'semanal' && l.fecha >= new Date('2026-11-04').getTime()) { assert.equal(l.xp, J.xpReal(J.XP_MISION_SEMANAL, l.fecha), l.texto); vistos++; }
  }
  assert.ok(vistos > 50, `${vistos} premios comprobados`);
  // Lo que se muestra hoy es lo mismo que se pagaría hoy.
  for (const x of h.hazanas) assert.equal(x.xp, J.xpReal(J.HAZANAS.find((y) => y.id === x.id).xp, fecha + 36e5));
});
