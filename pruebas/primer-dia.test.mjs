// Ronda 2, etapa 5: el resumen no titula como hecha una sesión cortada (UX2-17) y pide el esfuerzo tras las duras (E17).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cap from '../src/capacidades.js';

const bloques = [{ duracion: 600 }, { duracion: 1500 }, { duracion: 180 }]; // 38 min
const ref = { max: 190, reposo: 60 };

test('una sesión del plan cortada antes del 80 % dice cuánto hiciste', () => {
  assert.deepEqual(Cap.lecturaHonesta({ bloques, duracion: 59, tiempoMeta: null }, 'fondo', ref).corta, { hechos: 1, plan: 38 });
  // Terminada (con meta) o casi entera, no.
  assert.equal(Cap.lecturaHonesta({ bloques, duracion: 59, tiempoMeta: 59 }, 'fondo', ref).corta, null);
  assert.equal(Cap.lecturaHonesta({ bloques, duracion: 0.85 * 2280, tiempoMeta: null }, 'fondo', ref).corta, null);
  // Sin bloques (remo libre), tampoco.
  assert.equal(Cap.lecturaHonesta({ duracion: 59 }, 'fondo', ref).corta, null);
});

test('un fondo con el pulso medio en zona 4 o más lo dice; en zona 2, o en un umbral, no', () => {
  assert.equal(Cap.lecturaHonesta({ fcProm: 172, tipoPlan: 'fondo' }, 'fondo', ref).zonaAlta.n, 4);
  assert.equal(Cap.lecturaHonesta({ fcProm: 140, tipoPlan: 'fondo' }, 'fondo', ref).zonaAlta, null);
  assert.equal(Cap.lecturaHonesta({ fcProm: 172, tipoPlan: 'umbral' }, 'umbral', ref).zonaAlta, null);
});

test('el esfuerzo se pide tras una sesión dura que aún no lo tiene', () => {
  assert.equal(Cap.pideEsfuerzo({ tipoPlan: 'umbral' }, 200), true);
  assert.equal(Cap.pideEsfuerzo({ tipoPlan: 'umbral', rpe: 7 }, 200), false);
  // El de tu pulso no cuenta como tuyo.
  assert.equal(Cap.pideEsfuerzo({ tipoPlan: 'vo2', rpe: 7, rpeFuente: 'pulso' }, 200), true);
  assert.equal(Cap.pideEsfuerzo({ tipoPlan: 'fondo' }, 200), false);
});
