// Un solo motor de predicción (etapa 18): tiempos con CP y W′, la marca real manda, Paul de respaldo, rango honesto
// y las mismas cifras en Detalle, en el asistente de metas y en Hoy.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/estadisticas.js';
import * as P from '../src/programa.js';

const DIA = 864e5;
const AHORA = new Date('2026-06-01T12:00').getTime();
const v = (w) => Math.cbrt(w / 2.8);
function sesion(fecha, tramos) {
  const muestras = [];
  let t = 0;
  let dist = 0;
  for (const [segs, w] of tramos) for (let i = 0; i < segs; i++) { t++; dist += v(w); muestras.push({ t, w, spm: 24, dist }); }
  return { fecha, muestras, duracion: t, distancia: Math.round(dist) };
}
const esfuerzo = (dias, segs, w) => sesion(AHORA - dias * DIA, [[300, 120], [segs, w], [300, 100]]);
const PC = { cp: 200, wPrima: 15000 };

test('tiempos del modelo: CP 200 W y W′ 15 kJ', () => {
  // ⚖ Valores de referencia (la auditoría daba 7:38 y 19:41 para este remero).
  assert.equal(R.tiempoPara(2000, PC), 458);
  assert.equal(R.tiempoPara(5000, PC), 1181);
  assert.ok(R.tiempoPara(10000, PC) > 2385, 'por encima de 30 min cae un poco más (Omni-PD)');
  assert.ok(R.potenciaEn(3600, PC) < PC.cp + PC.wPrima / 3600);
  assert.equal(R.tiempoPara(2000, null), null);
});

test('estimar: manda tu marca reciente, luego el modelo y, sin modelo, la ley de Paul', () => {
  const con = [esfuerzo(20, 180, 283), esfuerzo(15, 720, 221), esfuerzo(10, 1200, 212.5)];
  // Sin ningún 10 000 m remado: el modelo.
  const m = R.estimar(con, 10000, { ahora: AHORA });
  assert.equal(m.fuente, 'modelo');
  const ref = R.tiempoPara(10000, PC);
  assert.ok(Math.abs(m.t - ref) <= ref * 0.01, `10 000 m: ${m.t} frente a ${ref}`);
  assert.ok(m.bajo < m.t && m.alto > m.t);
  // Con un 2000 m remado en 90 días, manda tu marca (nunca más optimista que lo que remaste).
  assert.equal(R.estimar(con, 2000, { ahora: AHORA }).fuente, 'marca');
  // Solo remo suave sin esfuerzos máximos: ley de Paul desde la distancia más cercana.
  const suave = [sesion(AHORA - 5 * DIA, [[1500, 150], [900, 140]])];
  const p = R.estimar(suave, 10000, { ahora: AHORA, pc: null });
  assert.equal(p.fuente, 'paul');
  assert.equal(R.estimar([], 2000, { ahora: AHORA }), null);
  // Más error registrado, rango más ancho.
  const ancho = R.estimar(con, 10000, { ahora: AHORA, error: 5 });
  assert.ok(ancho.alto - ancho.bajo > m.alto - m.bajo);
});

test('las mismas cifras en el asistente de metas y en el motor', () => {
  const con = [esfuerzo(20, 180, 283), esfuerzo(15, 720, 221), esfuerzo(10, 1200, 212.5)];
  for (const d of [10000, 21097]) {
    const meta = P.sugerirMeta(con, d, 8, AHORA);
    assert.equal(meta.t, R.estimar(con, d, { ahora: AHORA }).t, `${d} m`);
    assert.equal(meta.modelo, true);
  }
});
