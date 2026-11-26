// Prevención (E-4 de la ronda 2): piernas cansadas en el estado del cuerpo y en el plan (E14), zona costillas y
// espalda repetida sin fuerza a cadencia baja ni sprints pesados durante 7 días (E15).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/adaptacion.js';
import * as G from '../src/generador-plan.js';
import { piernasRecientes } from '../src/capacidades.js';
import { ZONAS_DOLOR, efectoPrevio, espaldaCargadaHasta } from '../src/pulso.js';
import { claveDia } from '../src/estadisticas.js';

const DIA = 864e5;
const ahora = Date.parse('2026-11-11T09:00'); // miércoles
const hoy = claveDia(ahora);
const dia = (d) => claveDia(ahora + d * DIA);
// Plan de potencia de 3 días: sprints, fuerza a 18 paladas/min y un fondo.
const { programa: base, entrenamientos } = G.planPorObjetivo({ objetivo: 'potencia', dias: 3, semanas: 6, inicio: dia(-9), ctx: {} });
const fuerza = entrenamientos.find((e) => /^Fuerza/.test(e.nombre)).nombre;
const sprints = entrenamientos.find((e) => /^Sprints/.test(e.nombre)).nombre;
const fondo = entrenamientos.find((e) => /^Fondo/.test(e.nombre)).nombre;
const plan = (dias) => ({ ...structuredClone(base), dias: dias.map(([d, ent]) => ({ fecha: dia(d), ent })) });
const ses = (d, extra = {}) => ({ fecha: ahora + d * DIA, duracion: 1800, entrenamiento: fondo, ...extra });

test('las sesiones de fuerza a cadencia baja y los sprints pesados cargan la espalda; un fondo no', () => {
  const por = (n) => entrenamientos.find((e) => e.nombre === n);
  assert.ok(A.cargaLumbar(por(fuerza)) && A.cargaLumbar(por(sprints)));
  assert.ok(!A.cargaLumbar(por(fondo)));
});

test('piernas cansadas en la última sesión (≤ 36 h): el estado lo dice y la próxima fuerza o sprints pasa a fondo', () => {
  assert.equal(piernasRecientes([ses(-1, { piernas: 12 })], ahora)?.piernas, 12);
  assert.equal(piernasRecientes([ses(-2, { piernas: 12 })], ahora), null, 'hace más de 36 h');
  assert.equal(piernasRecientes([ses(-1, { piernas: 12 }), ses(-0.5)], ahora), null, 'solo cuenta la última');
  assert.equal(piernasRecientes([ses(-1, { piernas: 8 })], ahora), null);
  const r = A.revisarPlan({ programa: plan([[-1, fondo], [0, fondo], [1, fuerza], [3, sprints]]), sesiones: [ses(-1, { piernas: 12 })], entrenamientos, ftp: 200, ahora });
  const dias = r.programa.dias;
  assert.match(dias.find((d) => d.fecha === dia(1)).ent, /^Fondo 30 min/);
  assert.equal(dias.find((d) => d.fecha === dia(3)).ent, sprints, 'solo la próxima');
  assert.ok(r.avisos.some((a) => /piernas/.test(a)));
  // Una segunda revisión con la misma sesión no cambia otra.
  const r2 = A.revisarPlan({ programa: { ...r.programa, revision: null }, sesiones: [ses(-1, { piernas: 12 })], entrenamientos: [...entrenamientos, ...r.entrenamientos], ftp: 200, ahora });
  assert.equal(r2.programa.dias.find((d) => d.fecha === dia(3)).ent, sprints);
});

test('espalda 2 días en una semana: 7 días desde la última sin fuerza a cadencia baja ni sprints', () => {
  const m = (d, dolor = 'leve', zona = 'espalda') => ({ dia: dia(d), dolor, zona });
  assert.equal(espaldaCargadaHasta([m(-3), m(-1)], new Date(ahora)), dia(6));
  assert.equal(espaldaCargadaHasta([m(-1)], new Date(ahora)), null, 'un solo día');
  assert.equal(espaldaCargadaHasta([m(-3, 'leve', 'rodillas'), m(-1, 'leve', 'rodillas')], new Date(ahora)), null, 'otra zona');
  assert.equal(espaldaCargadaHasta([m(-12), m(-9)], new Date(ahora)), null, 'ya pasaron 7 días');
  assert.equal(espaldaCargadaHasta([m(-14), m(-6)], new Date(ahora)), null, 'más de una semana entre las dos');
  const previo = { dolores: [m(-3), m(-1)] };
  const r = A.revisarPlan({ programa: plan([[0, fondo], [1, fuerza], [3, sprints], [7, fuerza]]), sesiones: [ses(-1)], entrenamientos, ftp: 200, previo, ahora });
  const ent = (d) => r.programa.dias.find((x) => x.fecha === dia(d)).ent;
  assert.match(ent(1), /^Fondo 30 min/);
  assert.match(ent(3), /^Fondo 30 min/);
  assert.equal(ent(7), fuerza, 'pasados los 7 días vuelve');
  assert.equal(ent(0), fondo);
  assert.ok(r.avisos.some((a) => /espalda/.test(a)));
});

test('la zona costillas existe y trae su consejo', () => {
  assert.ok(ZONAS_DOLOR.some(([k]) => k === 'costillas'));
  const e = efectoPrevio({ dolor: 'leve', zona: 'costillas', dolores: [] }, new Date(ahora));
  assert.match(e.motivo, /menos resistencia.*respirar hondo/);
});
