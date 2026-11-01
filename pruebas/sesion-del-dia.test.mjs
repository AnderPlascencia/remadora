import assert from 'node:assert/strict';
import * as A from '../adaptacion.js';
import * as P from '../programa.js';
import { claveDia } from '../estadisticas.js';

const DIA = 864e5;
const muestras = (segs, w) => Array.from({ length: segs }, (_, t) => ({ t, w, fc: 0 }));
const lunes = Date.parse('2026-11-02T09:00');
const ctx = {};

// Periodización: nunca dos sesiones duras en días seguidos (contando domingo → lunes) si se puede evitar.
for (const o of P.OBJETIVOS_PLAN) {
  for (const dias of [3, 4, 5]) {
    const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: o.clave, dias, semanas: 8, inicio: '2026-11-02', ctx });
    const dura = (n) => P.esDura(entrenamientos.find((e) => e.nombre === n));
    for (let i = 1; i < programa.dias.length; i++) {
      const [a, b] = [programa.dias[i - 1], programa.dias[i]];
      const seguidos = (new Date(`${b.fecha}T12:00`) - new Date(`${a.fecha}T12:00`)) / DIA === 1;
      assert.ok(!(seguidos && dura(a.ent) && dura(b.ent)), `${o.clave} ${dias} días: ${a.fecha} ${a.ent} y ${b.ent}`);
    }
    // La prueba no suma intensidad: la semana con prueba tiene como mucho las mismas duras que la anterior.
    const semanas = Array.from({ length: 8 }, (_, s) => programa.dias.slice(s * dias, (s + 1) * dias).filter((d) => dura(d.ent)).length);
    assert.ok(semanas[7] <= Math.max(...semanas.slice(0, 7)), `${o.clave} ${dias}: ${semanas}`);
    assert.match(programa.dias.at(-1).ent, o.prueba ? /^Prueba/ : /./);
  }
}
// Potencia con 4 días: los sprints y la fuerza ya no caen lunes y martes.
{
  const { programa } = P.planPorObjetivo({ objetivo: 'potencia', dias: 4, semanas: 6, inicio: '2026-11-02', ctx });
  assert.deepEqual(programa.dias.slice(0, 4).map((d) => d.ent.split(' ')[0]), ['Sprints', 'Fondo', 'Fuerza', 'Fondo']);
}

// Sesión del día con plan.
const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: 'vo2', dias: 3, semanas: 6, inicio: '2026-11-02', ctx });
// Lunes: la sesión clave.
let d = A.sesionDelDia({ programa, entrenamientos, ahora: lunes });
assert.equal(d.fuente, 'plan');
assert.equal(d.ent, 'VO₂ 5 × 2 min');
assert.match(d.motivo, /clave.*Semana 1 de 6/);
// Hecha: lo dice y anuncia la próxima.
const hecha = { fecha: lunes + 3600e3, duracion: 2400, entrenamiento: 'VO₂ 5 × 2 min', muestras: muestras(2400, 200) };
d = A.sesionDelDia({ programa, entrenamientos, sesiones: [hecha], ahora: lunes + 5 * 3600e3 });
assert.equal(d.fuente, 'hecho');
assert.match(d.motivo, /Próxima: Fondo/);
// Martes (día libre) sin nada pendiente: descanso con alternativa suave.
d = A.sesionDelDia({ programa, entrenamientos, sesiones: [hecha], ahora: lunes + DIA });
assert.equal(d.fuente, 'descanso');
assert.equal(d.alternativa, 'base:dis-suave');
// Martes sin haber remado el lunes: recupera la sesión clave (mañana toca fondo).
d = A.sesionDelDia({ programa, entrenamientos, sesiones: [], ahora: lunes + DIA });
assert.equal(d.fuente, 'recuperar');
assert.equal(d.ent, 'VO₂ 5 × 2 min');
// Viernes sin el umbral del... (miércoles es fondo) → si mañana toca dura, no se recupera una dura.
const vie = lunes + 4 * DIA;
d = A.sesionDelDia({ programa, entrenamientos, sesiones: [hecha], ahora: vie });
assert.equal(d.fuente, 'recuperar', 'el fondo del miércoles se puede recuperar');
assert.match(d.ent, /^Fondo/);
const sinNada = A.sesionDelDia({ programa, entrenamientos, sesiones: [], ahora: vie });
assert.match(sinNada.ent, /^Fondo/, 'con mañana dura, se recupera el fondo, no la dura');
// Cansado: una dura pendiente no se propone.
d = A.sesionDelDia({ programa: { ...programa, dias: programa.dias.filter((x) => !/^Fondo/.test(x.ent)) }, entrenamientos, sesiones: [], cuerpo: { clave: 'cargado' }, ahora: lunes + 2 * DIA });
assert.equal(d.fuente, 'descanso');
assert.match(d.motivo, /cargado/);
// Plan terminado.
d = A.sesionDelDia({ programa, entrenamientos, ahora: lunes + 60 * DIA });
assert.equal(d.fuente, 'terminado');

// Sin plan: esquema 80/20 con los base.
const ses = (dias, w, dur = 1800) => ({ fecha: lunes - dias * DIA, duracion: dur, muestras: muestras(dur, w) });
assert.equal(A.sesionDelDia({ sesiones: [], ftp: 200, ahora: lunes }), null);
assert.equal(A.sesionDelDia({ sesiones: [ses(1, 230)], ftp: 200, ahora: lunes }).id, 'base:dis-suave', 'ayer duro');
assert.equal(A.sesionDelDia({ sesiones: [ses(2, 230), ses(4, 230)], ftp: 200, ahora: lunes }).id, 'base:dis-mant', 'dos duras en la semana');
assert.equal(A.sesionDelDia({ sesiones: [ses(2, 120), ses(4, 120)], ftp: 200, ahora: lunes }).id, 'base:dis-mejora', 'falta fondo largo');
assert.equal(A.sesionDelDia({ sesiones: [ses(2, 120, 3000)], ftp: 200, ahora: lunes }).id, 'base:pot-mejora', 'fresco: dura');
assert.equal(A.sesionDelDia({ sesiones: [ses(3, 120, 3000)], ftp: 200, cuerpo: { clave: 'agotado' }, ahora: lunes }).id, 'base:dis-suave');
assert.equal(A.sesionDelDia({ sesiones: [ses(0, 120)], ftp: 200, ahora: lunes + 3600e3 }).id, 'base:dis-suave', 'ya remó hoy');

// Limpieza: solo se borran los del plan que el plan de ahora no usa.
const ents = [{ id: 1, nombre: 'VO₂ 5 × 2 min', dePlan: true }, { id: 2, nombre: 'Ritmo 2:00 · 5 × 500 m', dePlan: true }, { id: 3, nombre: 'Mi 6k' }];
assert.deepEqual(A.sobrantesDePlan(programa, ents).map((e) => e.id), [2]);
assert.deepEqual(A.sobrantesDePlan(null, ents).map((e) => e.id), [1, 2]);
assert.equal(claveDia(lunes), '2026-11-02');
console.log('sesión del día OK');
{
  // Las semanas del plan van de lunes a domingo, como el calendario, aunque empiece a media semana.
  const { programa } = P.planPorObjetivo({ objetivo: 'vo2', dias: 3, semanas: 8, inicio: '2026-10-18', ctx: {} });
  assert.deepEqual(P.semanaDe(programa, Date.parse('2026-11-04T09:00')), { n: 4, total: 8, descarga: true });
  assert.equal(P.semanaDe(programa, Date.parse('2026-10-18T09:00')).n, 1);
  assert.equal(P.semanaDe(null), null);
}
