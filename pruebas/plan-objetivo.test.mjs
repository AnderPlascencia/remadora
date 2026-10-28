import assert from 'node:assert/strict';
import * as P from '../programa.js';
import { EJEMPLOS } from '../entrenamientos.js';

const ctx = { split2k: 125, distHabitual: 6000 };
for (const o of P.OBJETIVOS_PLAN) {
  for (const dias of [2, 3, 4, 5]) {
    const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: o.clave, dias, semanas: 8, inicio: '2026-11-02', ctx });
    assert.equal(programa.dias.length, 8 * dias, `${o.clave} ${dias}`);
    const nombres = new Set(entrenamientos.map((e) => e.nombre));
    assert.ok(programa.dias.every((d) => nombres.has(d.ent)), 'cada día tiene su entrenamiento');
    if (o.prueba) assert.equal(programa.dias.at(-1).ent, o.prueba, 'termina con prueba');
  }
}
// La carga sube: la última semana pesa más que la primera
const { programa: pp } = P.planPorObjetivo({ objetivo: 'potencia', dias: 3, semanas: 6, inicio: '2026-11-02', ctx });
assert.equal(pp.dias[0].ent, 'VO2 6 × 1 min');
assert.equal(pp.dias[15].ent, 'VO2 8 × 1 min');
const { programa: pd } = P.planPorObjetivo({ objetivo: 'distancia', nivel: 'inicio', dias: 3, semanas: 4, inicio: '2026-11-02', ctx });
assert.equal(pd.dias[0].ent, '6500 m seguidos');
assert.equal(pd.dias.at(-3).ent, '9000 m seguidos', 'termina con la distancia más larga');
// Agrupación de los ejemplos
const g = Object.fromEntries(EJEMPLOS.map((e) => [e.nombre, P.enfoqueDe(e)]));
assert.equal(g['Prueba FTP 20 min'], 'pruebas');
assert.equal(g['Umbral 3 × 8 min (zona 4)'], 'potencia');
assert.equal(g['Ritmo 2:10 × 20 min'], 'ritmo');
assert.equal(g['Pirámide de paladas'], 'tecnica');
assert.equal(g['150 kcal'], 'calorias');
assert.equal(g['5000 m'], 'distancia');
console.log('plan por objetivo OK', g);
// v0.24: 1 día por semana y objetivo «Subir de nivel», con lo elegido guardado en el plan
{
  const { programa } = P.planPorObjetivo({ objetivo: 'nivel', dias: 1, semanas: 6, inicio: '2026-11-02', ctx: { ...ctx, sinHistorial: true } });
  assert.equal(programa.dias.length, 6);
  assert.ok(programa.dias.some((d) => d.ent === 'Prueba 500 m'), 'incluye la prueba que abre la historia');
  assert.deepEqual([programa.objetivo, programa.porSemana, programa.semanas, programa.sinHistorial], ['nivel', 1, 6, true]);
}
