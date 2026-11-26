// Generador de planes por objetivo (E-3): todos los objetivos, niveles y de 2 a 5 días. Ningún fondo de menos de
// 25 min, como mucho 1 dura por semana con 2 días, la primera intensidad nunca en semana de descarga ni de prueba,
// la prueba de mitad dentro de la descarga, las series de calorías cuentan como duras y las semanas no se
// desfasan con el horario de verano (QA-F2).
process.env.TZ = 'America/Los_Angeles'; // cambia la hora el 8 de marzo de 2026: dentro de los planes de abajo
import test from 'node:test';
import assert from 'node:assert/strict';
const P = await import('../src/programa.js');
const G = await import('../src/generador-plan.js');
const { tipoPlan } = await import('../src/capacidades.js');

const ctx = { kcalHabitual: 300, kcalSemana: 900 };
const NIVELES = ['inicio', 'medio', 'alto'];
const trabajoMin = (e) => (e.bloques || []).filter((b) => !/Calentamiento|Enfriamiento/.test(b.nombre || '')).reduce((a, b) => a + (b.duracion || 0), 0) / 60;
function* planes() {
  for (const o of P.OBJETIVOS_PLAN) for (const nivel of NIVELES) for (const dias of [2, 3, 4, 5]) for (const semanas of [4, 6, 8, 12]) {
    const { programa, entrenamientos } = G.planPorObjetivo({ objetivo: o.clave, nivel, dias, semanas, inicio: '2026-02-16', ctx });
    const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
    yield { id: `${o.clave}/${nivel}/${dias} días/${semanas} sem`, dias, semanas, programa, buscar, sem: P.semanasPlan(programa, [], buscar, Date.parse('2026-01-01T12:00')) };
  }
}

test('ningún fondo de menos de 25 min, con 2 días como mucho 1 dura, y la primera intensidad en una semana normal', () => {
  let n = 0;
  for (const { id, dias, semanas, sem, buscar } of planes()) {
    n++;
    assert.equal(sem.length, semanas, `${id}: semanas`);
    let primera = null;
    for (const [i, w] of sem.entries()) {
      // Con horario de verano cada semana sigue teniendo sus días (antes el lunes caía en la semana anterior).
      assert.equal(w.dias.length, dias, `${id}, semana ${i + 1}: ${w.dias.map((d) => d.fecha).join(' ')}`);
      const ents = w.dias.map((d) => buscar(d.ent));
      for (const e of ents) if (tipoPlan(e) === 'fondo' && !e.prueba && trabajoMin(e) > 0) assert.ok(trabajoMin(e) >= P.FONDO_MIN, `${id}, semana ${i + 1}: ${e.nombre} (${trabajoMin(e)} min)`);
      const duras = ents.filter((e) => e.prueba || P.esDura(e)).length;
      if (dias === 2) assert.ok(duras <= 1, `${id}, semana ${i + 1}: ${w.dias.map((d) => d.ent).join(' + ')}`);
      if (primera == null && ents.some((e) => !e.prueba && P.esDura(e))) {
        primera = i;
        assert.ok(!w.descarga && !w.prueba, `${id}: la primera intensidad (semana ${i + 1}) cae en ${w.descarga ? 'descarga' : 'prueba'}`);
      }
    }
  }
  assert.equal(n, 5 * 3 * 4 * 4);
});

test('la prueba de mitad va en la semana de descarga: no hay dos semanas flojas seguidas', () => {
  for (const { id, semanas, sem } of planes()) {
    if (!sem.some((w) => w.prueba)) continue;
    const mitad = sem.slice(0, -1).filter((w) => w.prueba);
    if (semanas >= 6) assert.ok(mitad.length === 1 && mitad[0].descarga, `${id}: ${sem.map((w) => `${w.prueba ? 'P' : ''}${w.descarga ? 'D' : ''}`).join('·')}`);
    else assert.equal(mitad.length, 0, `${id}: sin descarga no hay prueba de mitad`);
  }
});

test('con 2 días de potencia la semana lleva un fondo con la fuerza dentro', () => {
  const { programa, entrenamientos } = G.planPorObjetivo({ objetivo: 'potencia', nivel: 'medio', dias: 2, semanas: 6, inicio: '2026-11-02', ctx });
  const e = entrenamientos.find((x) => x.nombre === programa.dias[1].ent) || entrenamientos.find((x) => x.nombre === programa.dias[0].ent);
  const fondos = programa.dias.slice(0, 2).map((d) => entrenamientos.find((x) => x.nombre === d.ent)).filter((x) => tipoPlan(x) === 'fondo');
  assert.equal(fondos.length, 1, e.nombre);
  assert.ok(fondos[0].bloques.some((b) => b.spmMeta), 'con tramos a cadencia baja');
});

test('con 3 días hay 1 dura, 1 moderada y 1 fondo; el 30/15 solo sustituye a las series con «Remo seguido»', () => {
  for (const objetivo of ['vo2', 'umbral']) for (const nivel of NIVELES) {
    const { programa, entrenamientos } = G.planPorObjetivo({ objetivo, nivel, dias: 3, semanas: 8, inicio: '2026-11-02', ctx });
    const de = (d) => entrenamientos.find((x) => x.nombre === d.ent);
    for (let s = 0; s < 8; s++) {
      const semana = programa.dias.slice(s * 3, s * 3 + 3).map(de);
      assert.ok(semana.filter((e) => tipoPlan(e) === 'vo2').length <= 1, `${objetivo}/${nivel}, semana ${s + 1}: ${semana.map((e) => e.nombre).join(', ')}`);
      if (nivel !== 'alto') assert.ok(!semana.some((e) => /30\/15/.test(e.nombre)), `${objetivo}/${nivel}: sin 30/15`);
    }
  }
});

test('las series de un plan de calorías cuentan como dura', () => {
  const { entrenamientos } = G.planPorObjetivo({ objetivo: 'calorias', nivel: 'medio', dias: 3, semanas: 4, inicio: '2026-11-02', ctx });
  const series = entrenamientos.find((e) => /× 1 min/.test(e.nombre));
  assert.ok(series && P.esDura(series), series?.nombre);
  assert.ok(entrenamientos.filter((e) => /^Fondo/.test(e.nombre)).every((e) => !P.esDura(e)));
});

test('sin historial, la primera semana de un plan sin sesiones duras trae una sesión para calibrar el FTP', () => {
  const plan = (sinHistorial) => G.planPorObjetivo({ objetivo: 'base', nivel: 'inicio', dias: 3, semanas: 6, inicio: '2026-11-02', ctx: { ...ctx, sinHistorial } });
  const con = plan(true);
  const primera = con.programa.dias.slice(0, 3).map((d) => d.ent);
  assert.ok(primera.some((n) => /12 min a tu ritmo fuerte/.test(n)), primera.join(', '));
  assert.ok(con.programa.dias.slice(3).every((d) => !/ritmo fuerte/.test(d.ent)), 'solo en la primera semana');
  assert.ok(plan(false).programa.dias.every((d) => !/ritmo fuerte/.test(d.ent)), 'con historial no hace falta');
});
