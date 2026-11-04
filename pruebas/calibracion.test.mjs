// Etapa 8: planes bien calibrados (zonas, descargas, topes de VO₂, progresión y volumen por condición).
import assert from 'node:assert/strict';
import * as P from '../src/programa.js';
import * as B from '../src/base.js';
import * as Ent from '../src/entrenamientos.js';
import { esBloqueTrabajo } from '../src/entrenamientos.js';

const ctx = { kcalHabitual: 300, kcalSemana: 900 };
const porSemana = (programa, n) => Array.from({ length: programa.dias.length / n }, (_, s) => programa.dias.slice(s * n, s * n + n));

// (1) Plan de 2000 m: fondo a +20–30 s del split meta, umbral a +8–12 s, calentamiento sin pisar el fondo.
{
  const split = 118;
  const { programa, entrenamientos } = P.planPorMeta({ distancia: 2000, segundos: split * 4, semanas: 8, inicio: '2026-11-02' });
  const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
  const fondo = entrenamientos.find((e) => /^Fondo/.test(e.nombre));
  const bF = fondo.bloques.find((b) => b.nombre === 'Fondo');
  assert.deepEqual([bF.min, bF.max], [split + 20, split + 30], 'fondo a +20–30 s');
  const um = entrenamientos.find((e) => /^Umbral/.test(e.nombre)).bloques.find((b) => /^Umbral/.test(b.nombre));
  assert.deepEqual([um.min, um.max], [split + 8, split + 12], 'umbral a +8–12 s');
  const cal = fondo.bloques[0];
  assert.ok(cal.min > bF.max, `calentamiento (${cal.min}) más lento que el fondo (${bF.max})`);
  assert.ok(programa.conDescarga);
  // Descarga en la semana 4 y la última semana con un 30–40 % menos de trabajo.
  const trabajo = (sem) => sem.filter((d) => !buscar(d.ent).prueba).reduce((a, d) => a + P.segTrabajo(buscar(d.ent)), 0);
  const sems = porSemana(programa, 3);
  assert.ok(trabajo(sems[3]) < trabajo(sems[2]) * 0.85, 'semana 4 de descarga');
  assert.ok(trabajo(sems[7]) <= trabajo(sems[6]) * 0.7, 'la última semana afloja');
  assert.ok(buscar(sems[7].at(-1).ent).prueba, 'termina con la prueba');
  const sem = P.semanasPlan(programa, [], buscar, Date.parse('2026-11-03T10:00'));
  assert.ok(sem[3].descarga && !sem[2].descarga, 'la vista previa marca la descarga');
  // Las series de ritmo llevan arranques en el calentamiento.
  assert.ok(entrenamientos.find((e) => /^Ritmo/.test(e.nombre)).bloques.some((b) => /arranque progresivo/.test(b.nombre)));
}

// (2) Potencia con 3 días: una sesión es un fondo puro.
{
  const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: 'potencia', dias: 3, semanas: 6, inicio: '2026-11-02', ctx });
  for (const sem of porSemana(programa, 3)) {
    const ents = sem.map((d) => entrenamientos.find((e) => e.nombre === d.ent));
    assert.ok(ents.some((e) => /^Fondo \d+ min \(zona 2\)$/.test(e.nombre) || e.prueba), sem.map((d) => d.ent).join(', '));
  }
}

// (3) Topes de VO₂: hasta 25 min por sesión y unos 40 min por semana por encima del 106 % del FTP.
for (const objetivo of ['vo2', 'umbral', 'potencia', 'calorias']) {
  for (const nivel of ['inicio', 'medio', 'alto']) {
    for (const dias of [3, 5]) {
      const { programa, entrenamientos } = P.planPorObjetivo({ objetivo, nivel, dias, semanas: 8, inicio: '2026-11-02', ctx });
      const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
      for (const e of entrenamientos) if (!e.prueba) assert.ok(P.segVo2(e) <= P.VO2_MAX_SESION, `${e.nombre}: ${P.segVo2(e)} s`);
      for (const [s, sem] of porSemana(programa, dias).entries()) {
        const v = sem.filter((d) => !buscar(d.ent).prueba).reduce((a, d) => a + P.segVo2(buscar(d.ent)), 0);
        assert.ok(v <= P.VO2_MAX_SEMANA, `${objetivo} ${nivel} ${dias}d semana ${s + 1}: ${v} s`);
      }
    }
  }
}
// Los 30/15 se quedan en 13 por serie.
{
  const { entrenamientos } = P.planPorObjetivo({ objetivo: 'vo2', nivel: 'alto', dias: 5, semanas: 8, inicio: '2026-11-02', ctx });
  for (const e of entrenamientos.filter((x) => /30\/15/.test(x.nombre))) assert.ok(Number(e.nombre.match(/de (\d+) ×/)[1]) <= 13, e.nombre);
}

// (4) El trabajo semanal sube como mucho un 15 % respecto a la semana normal anterior.
for (const o of P.OBJETIVOS_PLAN) {
  for (const nivel of ['inicio', 'medio', 'alto']) {
    const dias = 4;
    const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: o.clave, nivel, dias, semanas: 10, inicio: '2026-11-02', ctx });
    const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
    const sem = porSemana(programa, dias);
    let previo = null;
    for (const [s, x] of sem.entries()) {
      if (x.some((d) => buscar(d.ent).prueba)) { previo = null; continue; }
      const t = x.reduce((a, d) => a + P.segTrabajo(buscar(d.ent)), 0);
      const descarga = (s + 1) % 4 === 0;
      if (previo && !descarga) assert.ok(t <= previo * P.SUBIDA_MAX + 1, `${o.clave} ${nivel} semana ${s + 1}: ${t} > ${previo} × 1.15`);
      if (!descarga) previo = t;
    }
  }
}
// Quien está empezando hace 3 semanas de base antes del plan de umbral.
{
  assert.equal(P.semanasDeBase('umbral', 'inicio', 8), 3);
  assert.equal(P.semanasDeBase('umbral', 'medio', 8), 0);
  assert.equal(P.semanasDeBase('base', 'inicio', 8), 0);
  const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: 'umbral', nivel: 'inicio', dias: 3, semanas: 8, inicio: '2026-11-02', ctx });
  const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
  assert.equal(programa.semanasBase, 3);
  const primeras = programa.dias.slice(0, 9).map((d) => buscar(d.ent));
  assert.ok(primeras.every((e) => P.segIntenso(e) === 0), primeras.map((e) => e.nombre).join(', '));
  assert.ok(programa.dias.slice(9).some((d) => /^Umbral/.test(d.ent)), 'después llega el umbral');
}

// (5) Resistencia según la experiencia, cadencia meta y arranques antes de lo intenso.
{
  const nivelDe = (nivel, re) => P.planPorObjetivo({ objetivo: 'potencia', nivel, dias: 3, semanas: 6, inicio: '2026-11-02', ctx })
    .entrenamientos.find((e) => re.test(e.nombre)).bloques.find((b) => b.nivel).nivel;
  assert.deepEqual(['inicio', 'medio', 'alto'].map((n) => nivelDe(n, /^Fuerza/)), [P.NIVEL_FUERZA.inicio, P.NIVEL_FUERZA.medio, P.NIVEL_FUERZA.alto]);
  assert.deepEqual(['inicio', 'medio', 'alto'].map((n) => nivelDe(n, /^Sprints/)), [P.NIVEL_SPRINT.inicio, P.NIVEL_SPRINT.medio, P.NIVEL_SPRINT.alto]);
  assert.ok(P.NIVEL_FUERZA.alto <= 14 && P.NIVEL_SPRINT.alto <= 16, 'resistencia limitada');
  const { entrenamientos } = P.planPorObjetivo({ objetivo: 'potencia', dias: 3, semanas: 6, inicio: '2026-11-02', ctx });
  const fuerza = entrenamientos.find((e) => /^Fuerza/.test(e.nombre)).bloques.find((b) => b.spmMeta);
  assert.deepEqual(fuerza.spmMeta, [18, 20]);
  assert.match(Ent.textoMeta(fuerza, 200), /a 18–20 golpes\/min$/);
  assert.doesNotMatch(Ent.textoMeta({ metrica: 'ftp', min: 56, max: 75 }, 200), /golpes/);
  // Antes de VO₂ y sprints hay arranques progresivos (que no cuentan como trabajo).
  const todos = ['vo2', 'potencia', 'calorias'].flatMap((o) => P.planPorObjetivo({ objetivo: o, nivel: 'alto', dias: 5, semanas: 8, inicio: '2026-11-02', ctx }).entrenamientos);
  for (const e of todos.filter((x) => !x.prueba && P.segVo2(x) > 0 && !/arranques$/.test(x.nombre))) {
    assert.ok(e.bloques.some((b) => /arranque progresivo/.test(b.nombre)), `${e.nombre} con activación`);
  }
  assert.ok(Ent.ACTIVACION.every((b) => !esBloqueTrabajo(b)), 'la activación es calentamiento');
}
// Los ejemplos van en % del FTP, del pulso o de la cadencia: nada en watts ni split fijos.
for (const e of Ent.EJEMPLOS) for (const b of e.bloques || []) assert.ok(!['watts', 'split'].includes(b.metrica), `${e.nombre}: ${b.nombre} en ${b.metrica}`);
assert.ok(!Ent.EJEMPLOS.some((e) => /2:10/.test(e.nombre)), 'sin ritmos fijos en el nombre');

// Volumen de los base: sale de la condición, no del nivel del héroe.
{
  assert.deepEqual([0, 14, 15, 24, 25, 39, 40, 80].map(B.escalonDeCondicion), [0, 0, 1, 1, 2, 2, 3, 3]);
  const umbral = (l) => l.find((x) => x.id === 'base:pot-mant').resumen;
  assert.equal(umbral(B.entrenamientosBase(70, 200, { condicion: 5 })), '3 × 6 min en umbral', 'nivel alto sin forma: volumen bajo');
  assert.equal(umbral(B.entrenamientosBase(1, 200, { condicion: 45 })), '5 × 8 min en umbral', 'nivel bajo con forma: volumen alto');
  assert.equal(umbral(B.entrenamientosBase(70, 200)), '5 × 8 min en umbral', 'sin condición, como antes');
  // La condición se calcula de las sesiones: sin entrenar es 0; con un mes entrenando, sube.
  const ahora = Date.parse('2026-11-04T12:00');
  assert.equal(B.condicionDe([], 200, ahora), 0);
  const sesiones = Array.from({ length: 30 }, (_, i) => ({ fecha: ahora - i * 864e5, estres: 70 }));
  assert.ok(B.condicionDe(sesiones, 200, ahora) >= 25);
  assert.equal(umbral(B.basesPara(1, 200, sesiones, ahora)), '4 × 8 min en umbral');
  assert.equal(B.entrenamientosBase(1, 200, { condicion: 0 }).find((x) => x.id === 'base:pot-mant').escalon, 0);
}
// «Ritmo 2000 m»: series de 500 m al 110–118 % del FTP (o su split), con activación.
{
  const r = (ftp, c) => B.entrenamientosBase(1, ftp, { condicion: c }).find((x) => x.id === 'base:rit-mejora');
  const sinFtp = r(0, 0);
  assert.equal(sinFtp.nombre, 'Ritmo 2000 m');
  assert.equal(sinFtp.resumen, '4 × 500 m a ritmo de 2000 m');
  const reps = sinFtp.bloques.filter((b) => /^500 m/.test(b.nombre));
  assert.ok(reps.every((b) => b.metrica === 'ftp' && b.min === 110 && b.max === 118 && b.cantidad === 500));
  assert.ok(sinFtp.bloques.some((b) => /arranque progresivo/.test(b.nombre)));
  assert.equal(r(0, 50).resumen, '8 × 500 m a ritmo de 2000 m');
  const conFtp = r(200, 0).bloques.find((b) => /^500 m/.test(b.nombre));
  assert.equal(conFtp.metrica, 'split');
  const crucero = r(200, 0) && B.entrenamientosBase(1, 200).find((x) => x.id === 'base:rit-mant').bloques[1];
  assert.ok(conFtp.max < crucero.min, 'más rápido que el crucero');
  assert.ok(B.entrenamientosBase(1, 200).find((x) => x.id === 'base:pot-mejora').bloques.some((b) => /arranque progresivo/.test(b.nombre)), 'VO2 máx con activación');
}
console.log('calibración OK');
