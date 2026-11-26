import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/programa.js';

const INICIO = '2026-01-05';
const plan = P.planPorMeta({ distancia: 2000, segundos: 470, semanas: 8, inicio: INICIO });
const buscar = (n) => plan.entrenamientos.find((e) => e.nombre === n);
const semanaDe = (f) => Math.floor((Date.parse(f) - Date.parse(INICIO)) / (7 * 864e5));
const porSemana = () => {
  const s = [];
  for (const d of plan.programa.dias) (s[semanaDe(d.fecha)] ||= []).push(buscar(d.ent) || { nombre: d.ent, prueba: /^Prueba/.test(d.ent) });
  return s;
};

test('plan por meta: sale del mismo motor, con una sola sesión dura por semana', () => {
  assert.equal(plan.split, 118);
  assert.match(plan.programa.nombre, /^Meta: 2000 m en 7:50/);
  assert.equal(plan.programa.conDescarga, true);
  assert.deepEqual(plan.programa.meta, { distancia: 2000, segundos: 470 });
  for (const [i, ses] of porSemana().entries()) {
    const duras = ses.filter((e) => e.prueba || P.esDura(e));
    assert.equal(duras.length, 1, `semana ${i + 1}: ${ses.map((e) => e.nombre).join(' / ')}`);
  }
  // La dura alterna umbral y ritmo; la prueba de la distancia cierra el plan.
  const nombres = porSemana().map((s) => s.map((e) => e.nombre));
  assert.ok(nombres[0].some((n) => /^Umbral/.test(n)));
  assert.ok(nombres[1].some((n) => /^Ritmo/.test(n)));
  assert.ok(nombres.at(-1).includes('Prueba 2000 m'));
  for (const e of plan.entrenamientos) if (e.bloques) assert.equal(e.splitMeta, 118, e.nombre);
});

test('plan por meta: 80/20 y topes de VO₂', () => {
  let suave = 0, intenso = 0;
  for (const e of porSemana().flat()) {
    if (!e.bloques) continue;
    const total = e.bloques.reduce((a, b) => a + P.segBloque(b), 0);
    const duro = P.segIntenso(e);
    intenso += duro; suave += total - duro;
    assert.ok(P.segVo2(e) <= 25 * 60, `${e.nombre}: ${P.segVo2(e)} s de VO₂`);
  }
  assert.ok(intenso / (suave + intenso) <= 0.25, `intenso ${Math.round((100 * intenso) / (suave + intenso))} %`);
});

test('plan por meta: cadencia guía por zona, sin tocar la cadencia pedida', () => {
  const fondo = plan.entrenamientos.find((e) => /^Fondo \d+ min a/.test(e.nombre));
  assert.deepEqual(fondo.bloques.find((b) => b.spmGuia).spmGuia, P.CADENCIA_GUIA.suave);
  const umbral = plan.entrenamientos.find((e) => /^Umbral/.test(e.nombre));
  assert.ok(umbral.bloques.some((b) => b.spmGuia?.[0] === 24));
  const firme = plan.entrenamientos.find((e) => /firme/.test(e.nombre));
  assert.ok(firme.bloques.some((b) => b.spmGuia?.[0] === P.CADENCIA_GUIA.firme[0]), 'el firme va a 20–24');
  const ritmo = plan.entrenamientos.find((e) => /^Ritmo/.test(e.nombre));
  assert.ok(ritmo.bloques.some((b) => b.spmGuia?.[0] === 28));
  for (const e of plan.entrenamientos) for (const b of e.bloques || []) assert.equal(b.spmMeta, undefined);
  // Un sprint no lleva guía, ni un bloque que ya pide cadencia.
  assert.equal(P.cadenciaGuia({ nombre: 'Sprint', duracion: 30, metrica: 'ftp', min: 150, max: 200 }), null);
  assert.equal(P.cadenciaGuia({ nombre: 'Trabajo', duracion: 600, metrica: 'ftp', min: 60, max: 70, spmMeta: [20, 22] }), null);
});

test('plan por meta: la semana de la prueba baja el volumen (afinamiento)', () => {
  const s = porSemana();
  const esfuerzo = (ses) => ses.filter((e) => !e.prueba).reduce((a, e) => a + P.esfuerzoSesion(e), 0);
  const final = s.length - 1;
  assert.ok(esfuerzo(s[final]) <= esfuerzo(s[final - 1]) * 0.75, `${esfuerzo(s[final])} vs ${esfuerzo(s[final - 1])}`);
});

test('plan por meta de 5 y 10 km: zonas desde el 2000 m equivalente y una dura por semana', () => {
  for (const [distancia, segundos] of [[5000, 1260], [10000, 2640]]) {
    const p = P.planPorMeta({ distancia, segundos, semanas: 8, inicio: INICIO });
    const ref = p.entrenamientos.find((e) => e.bloques).splitMeta;
    // El 2000 m equivalente es más rápido que el ritmo de la meta, y las zonas salen de él.
    assert.ok(ref < p.split, `${distancia}: ref ${ref} y meta ${p.split}`);
    const fondo = p.entrenamientos.find((e) => /^Fondo \d+ min a/.test(e.nombre));
    assert.deepEqual([fondo.bloques[1].min, fondo.bloques[1].max], [P.splitDePct(ref, 68), P.splitDePct(ref, 62)]);
    const umbral = p.entrenamientos.find((e) => /^Umbral/.test(e.nombre));
    assert.equal(umbral.bloques.find((b) => /^Umbral/.test(b.nombre)).min, P.splitDePct(ref, 100));
    const sem = [];
    for (const d of p.programa.dias) (sem[Math.floor((Date.parse(d.fecha) - Date.parse(INICIO)) / (7 * 864e5))] ||= []).push(p.entrenamientos.find((e) => e.nombre === d.ent) || { prueba: /^Prueba/.test(d.ent) });
    for (const [i, s] of sem.entries()) assert.equal(s.filter((e) => e.prueba || P.esDura(e)).length, 1, `${distancia}, semana ${i + 1}`);
    // Las series nunca van más lentas que la meta ni que el umbral + 1 s.
    for (const e of p.entrenamientos.filter((x) => /^Ritmo/.test(x.nombre))) {
      const b = e.bloques.find((x) => x.fin === 'distancia');
      assert.ok(b.max <= Math.min(p.split, P.splitDePct(ref, 100)) + 4, `${e.nombre}: ${b.min}–${b.max}`);
    }
  }
});
