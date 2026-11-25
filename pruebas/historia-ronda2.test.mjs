// La historia para todos (ronda 2, R2-1 y R2-2): desde HISTORIA_DESDE el capítulo se abre solo por nivel, y sin
// plan también vencen al jefe una sugerida dura cumplida o 3 sugeridas cumplidas en una semana. Lo anterior no cambia.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as A from '../src/adaptacion.js';
import { TIPOS, simular } from './sim-curva.mjs';

const D = 864e5;
const NUEVA = new Date('2026-11-25T19:00').getTime(); // miércoles, el día del corte
const opts = (ahora) => ({ ftp: 200, per: { clase: 'vikingo' }, ahora, calendario: null });
// 14 fondos libres (sin plan ni sugerida) llevan al nivel 10 y abren el capítulo 1; luego, lo que se pruebe.
function tras14(base, extra) {
  const ses = Array.from({ length: 14 }, (_, i) => TIPOS.fondo60(base + i * D, {}, 200));
  const antes = J.estadoJuego(ses, opts(base + 14 * D));
  const h = J.estadoJuego([...ses, ...extra(base + 14 * D)], opts(base + 21 * D));
  return { antes, h };
}

test('el capítulo se abre al llegar a su nivel, y una sugerida dura cumplida vence al jefe', () => {
  const { antes, h } = tras14(NUEVA, (f) => [TIPOS.umbral(f, { delDia: 'sugerida' }, 200)]);
  assert.equal(antes.nivel, 10);
  assert.equal(antes.capitulo.listo, true);
  assert.equal(antes.capitulo.porNivel, true);
  assert.equal(h.capitulosHechos, 1);
  // Una dura libre (no sugerida) no basta, ni una sugerida suave.
  assert.equal(tras14(NUEVA, (f) => [TIPOS.umbral(f, {}, 200)]).h.capitulosHechos, 0);
  assert.equal(tras14(NUEVA, (f) => [TIPOS.fondo30(f, { delDia: 'sugerida' }, 200)]).h.capitulosHechos, 0);
});

test('3 sugeridas cumplidas en la misma semana vencen al jefe; 2, o 3 repartidas entre dos semanas, no', () => {
  const sug = (f, dias) => dias.map((k) => TIPOS.fondo30(f + k * D, { delDia: 'sugerida' }, 200));
  assert.equal(tras14(NUEVA, (f) => sug(f, [0, 1, 2])).h.capitulosHechos, 1); // mié, jue y vie
  assert.equal(tras14(NUEVA, (f) => sug(f, [0, 1])).h.capitulosHechos, 0);
  assert.equal(tras14(NUEVA, (f) => sug(f, [3, 4, 5])).h.capitulosHechos, 0); // sáb, dom y lun
  // Una sugerida no cumplida (fuera de rango) no cuenta.
  const mal = (f) => [0, 1, 2].map((k) => TIPOS.fondo30(f + k * D, { delDia: 'sugerida', pctEnRango: 30, pctAlto: 0, pctBajo: 70 }, 200));
  assert.equal(tras14(NUEVA, mal).h.capitulosHechos, 0);
});

test('desde el corte, los requisitos ya no abren el capítulo; uno que ya abrieron antes sigue abierto', () => {
  const dos = (base) => [TIPOS.fondo60(base, {}, 200), TIPOS.fondo60(base + D, {}, 200)]; // 2 sesiones y más de 3 km
  const antes = new Date('2026-11-20T19:00').getTime();
  const h = J.estadoJuego(dos(antes), opts(NUEVA + 5 * D));
  assert.ok(h.nivel < 10);
  assert.equal(h.capitulo.listo, true, 'abierto por requisitos antes del corte');
  assert.equal(h.capitulo.listoDesde, antes + D);
  const n = J.estadoJuego(dos(NUEVA), opts(NUEVA + 5 * D));
  assert.equal(n.capitulo.listo, false, 'después del corte, por requisitos no');
  assert.deepEqual(n.capitulo.progreso.map((r) => [r.clave, r.meta]), [['nivel', 10]]);
});

test('⚖ antes del corte la sugerida no vence al jefe (las reglas de antes no cambian)', () => {
  const base = new Date('2026-10-26T19:00').getTime();
  assert.equal(tras14(base, (f) => [TIPOS.umbral(f, { delDia: 'sugerida' }, 200)]).h.capitulosHechos, 0);
});

test('tras 14 días con el capítulo abierto, la sugerida propone la prueba del jefe (si no vienes cargado)', () => {
  const cap = { listo: true, listoDesde: NUEVA, preparar: 'base:prueba-500', jefe: { nombre: 'El Guardián del muelle' } };
  assert.equal(J.jefeParaSugerir(cap, NUEVA + 13 * D), null);
  assert.deepEqual(J.jefeParaSugerir(cap, NUEVA + 14 * D), { id: 'base:prueba-500', nombre: 'El Guardián del muelle', dias: 14 });
  assert.equal(J.jefeParaSugerir({ ...cap, listo: false }, NUEVA + 20 * D), null);
  const ahora = NUEVA + 14 * D;
  const jefe = J.jefeParaSugerir(cap, ahora);
  const ses = [TIPOS.fondo30(ahora - 3 * D, {}, 200)];
  const dia = A.sesionDelDia({ sesiones: ses, ftp: 200, jefe, ahora });
  assert.equal(dia.fuente, 'sugerida');
  assert.equal(dia.id, 'base:prueba-500');
  assert.match(dia.motivo, /Guardián del muelle/);
  // Ayer fue dura: hoy suave, el jefe espera.
  const ayerDura = [TIPOS.umbral(ahora - D, {}, 200)];
  assert.equal(A.sesionDelDia({ sesiones: ayerDura, ftp: 200, jefe, ahora }).id, 'base:dis-suave');
});

test('R2-20: los jefes de la historia en 2 años', () => {
  const plan4 = simular('plan4');
  assert.equal(plan4.jefes.length, 9, `plan4: ${plan4.jefes}`);
  assert.ok(plan4.huecoMax <= 17, `plan4: ${plan4.huecoMax} semanas sin jefe (${plan4.jefes})`);
  const seisMeses = plan4.jefes.filter((w) => w <= 26).length;
  assert.ok(seisMeses >= 4 && seisMeses <= 5, `plan4: ${seisMeses} jefes en 6 meses`);
  const sug = simular('sugerida2');
  assert.ok(sug.jefes.length >= 6, `sugerida2: ${sug.jefes.length} jefes (${sug.jefes})`);
  // El ritmo real de Ander: ningún jefe a más de 30 semanas del anterior (antes, 7 en 41 semanas y luego ninguno).
  const ander = simular('ander');
  assert.ok(ander.jefes.length >= 6 && ander.huecoMax <= 30, `ander: ${ander.jefes}`);
});
