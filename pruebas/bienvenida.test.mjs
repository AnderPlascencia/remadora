// Bienvenida en 3 toques y primera semana guiada (etapa 20).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Ci from '../src/cita.js';
import * as P from '../src/programa.js';
import * as Pf from '../src/perfil.js';

const ms = (k, h = '12:00') => new Date(`${k}T${h}`).getTime();

test('los días del plan vienen puestos y se dicen en una línea', () => {
  assert.equal(Ci.textoDiasPlan(3), '3 días por semana (lunes, miércoles y sábado), a las 19:00');
  assert.equal(Ci.textoDiasPlan(1, '07:30'), '1 día por semana (sábado), a las 07:30');
  assert.equal(Ci.textoDiasPlan(2), '2 días por semana (martes y viernes), a las 19:00');
});

test('primera semana: cuenta las sesiones de los primeros 7 días y cuántas llevas', () => {
  // Plan que empieza el lunes 23 nov 2026: lunes, miércoles y sábado de esa semana, y la siguiente.
  const prog = { inicio: '2026-11-23', dias: [
    { fecha: '2026-11-23', ent: 'A' }, { fecha: '2026-11-25', ent: 'B' }, { fecha: '2026-11-28', ent: 'C' },
    { fecha: '2026-11-30', ent: 'A' },
  ] };
  assert.deepEqual(P.primeraSemana(prog, [], ms('2026-11-23')), { total: 3, hechas: 0, actual: 1, completa: false });
  const una = [{ fecha: ms('2026-11-23', '19:00'), entrenamiento: 'A' }];
  assert.deepEqual(P.primeraSemana(prog, una, ms('2026-11-24')), { total: 3, hechas: 1, actual: 2, completa: false });
  const tres = [...una, { fecha: ms('2026-11-25', '19:00'), entrenamiento: 'B' }, { fecha: ms('2026-11-28', '19:00'), entrenamiento: 'C' }];
  assert.deepEqual(P.primeraSemana(prog, tres, ms('2026-11-29')), { total: 3, hechas: 3, actual: 3, completa: true });
  // Desde el día 8 del plan ya no es la primera semana; sin plan, tampoco.
  assert.equal(P.primeraSemana(prog, tres, ms('2026-11-30')), null);
  assert.equal(P.primeraSemana(null, [], ms('2026-11-23')), null);
});

test('perfil por partes: edad y peso en el resumen de las primeras sesiones, si faltan', () => {
  assert.equal(Pf.pedirEnResumen({ resumen: true, previas: 0 }), true);
  assert.equal(Pf.pedirEnResumen({ resumen: true, previas: 2, edad: 40 }), true);
  assert.equal(Pf.pedirEnResumen({ resumen: true, previas: 0, edad: 40, peso: 80 }), false);
  assert.equal(Pf.pedirEnResumen({ resumen: true, previas: Pf.POR_PARTES_SESIONES }), false);
  assert.equal(Pf.pedirEnResumen({ resumen: true, previas: 0, descartado: true }), false);
  assert.equal(Pf.pedirEnResumen({ resumen: false, previas: 0 }), false);
});
