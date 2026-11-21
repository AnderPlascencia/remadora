// Medir el modelo de rendimiento (etapa 17): CP y W′ solo con esfuerzos máximos (REN-P5) y el error de las
// predicciones de marcas a tope en un historial sintético (REN-P9). Si un cambio empeora el error, falla.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/estadisticas.js';
import * as Pr from '../src/prediccion.js';

const DIA = 864e5;
const T0 = new Date('2026-01-05T18:00').getTime();
// Remero sintético: CP 200 W y W′ 15 kJ (75 kg), P(t) = CP + W′/t. Distancia con la fórmula de Concept2.
const CP = 200;
const WP = 15000;
const P = (t, cp = CP) => cp + WP / t;
const v = (w) => Math.cbrt(w / 2.8);

// tramos: [[segundos o { m: metros }, watts], …] → sesión con una muestra por segundo.
function sesion(fecha, tramos, extra = {}) {
  const muestras = [];
  let t = 0;
  let dist = 0;
  for (const [dur, w] of tramos) {
    const fin = typeof dur === 'number' ? (x) => x >= dur : (x, d) => d >= dur.m;
    for (let i = 0, d0 = dist; !fin(i, dist - d0); i++) {
      t += 1;
      dist += v(w);
      muestras.push({ t, w, spm: 24, split: Math.round(500 / v(w)), dist: Math.round(dist * 10) / 10, fc: 0 });
    }
  }
  return { fecha, muestras, duracion: t, distancia: Math.round(dist), wattsProm: Math.round(muestras.reduce((a, x) => a + x.w, 0) / muestras.length), ...extra };
}
const conEsfuerzo = (fecha, segs, w) => sesion(fecha, [[300, 120], [segs, w], [300, 100]]);
const errW = (pc) => Math.round((100 * (pc.wPrima - WP)) / WP);

test('CP y W′: con una sola prueba de 20 min ya hay batería (W′ por defecto, avisada)', () => {
  const ss = [conEsfuerzo(T0, 1200, P(1200))];
  assert.equal(E.potenciaCritica(E.curvaHistorial(ss)), null, 'antes no salía');
  const pc = E.potenciaCriticaMax(ss, { peso: 75 });
  assert.equal(pc.estimada, true);
  assert.equal(pc.wPrima, 15000);
  assert.ok(Math.abs(pc.cp - CP) <= 2, `CP ${pc.cp}`);
  assert.equal(E.potenciaCriticaMax(ss).wPrima, E.W_PRIMA_DEFECTO, 'sin peso, la de serie');
});

test('CP y W′: los trozos de un esfuerzo más largo no cuentan (W′ de −48 % a ±5 %)', () => {
  const dos = [conEsfuerzo(T0, 1200, P(1200)), conEsfuerzo(T0 + 2 * DIA, 300, P(300))];
  const antes = E.potenciaCritica(E.curvaHistorial(dos));
  assert.ok(errW(antes) <= -30, `antes la W′ salía ${errW(antes)} %`);
  const ahora = E.potenciaCriticaMax(dos);
  assert.equal(ahora.estimada, false);
  assert.ok(Math.abs(errW(ahora)) <= 5, `W′ ${errW(ahora)} %`);
  assert.ok(Math.abs(ahora.cp - CP) <= 3, `CP ${ahora.cp}`);
  const cuatro = [180, 300, 720, 1200].map((s, i) => conEsfuerzo(T0 + i * 2 * DIA, s, P(s)));
  const pc4 = E.potenciaCriticaMax(cuatro);
  assert.ok(Math.abs(errW(pc4)) <= 5 && Math.abs(pc4.cp - CP) <= 3, JSON.stringify(pc4));
  // El mejor minuto dentro de un fondo largo casi igual de fuerte no es un esfuerzo máximo.
  const fondo = sesion(T0, [[300, 120], [1800, 180], [300, 100]]);
  assert.ok(!E.esfuerzosMaximos(fondo.muestras).some((p) => p.segs === 300));
  // Dos esfuerzos demasiado parecidos (5 y 10 min) no bastan para la recta: se usa el largo con W′ por defecto.
  assert.equal(E.potenciaCriticaMax([conEsfuerzo(T0, 300, P(300)), conEsfuerzo(T0 + DIA, 600, P(600))]).estimada, true);
});

// Medio año de un remero que mejora: fondos, series, una prueba de 2000 m cada 4 semanas y una de 5000 m cada 6.
function historial() {
  const ss = [];
  for (let sem = 0; sem < 26; sem++) {
    const cp = CP * (1 + 0.004 * sem);
    const f = (d) => T0 + (sem * 7 + d) * DIA;
    ss.push(sesion(f(0), [[300, 0.6 * cp], [1800, 0.75 * cp], [300, 0.5 * cp]]));
    ss.push(sesion(f(2), [[600, 0.6 * cp], ...Array.from({ length: 4 }, () => [[240, 1.15 * cp], [120, 0.5 * cp]]).flat(), [300, 0.5 * cp]]));
    if (sem % 4 === 3) ss.push(sesion(f(4), [[600, 0.6 * cp], [{ m: 2000 }, P(420, cp)], [300, 0.5 * cp]], { tipoPlan: 'prueba' }));
    else if (sem % 6 === 5) ss.push(sesion(f(4), [[600, 0.6 * cp], [{ m: 5000 }, P(1150, cp)], [300, 0.5 * cp]], { tipoPlan: 'prueba' }));
    else ss.push(sesion(f(4), [[300, 0.6 * cp], [2400, 0.7 * cp], [300, 0.5 * cp]]));
  }
  return ss;
}

test('predicciones: se registran las marcas a tope y el error no empeora', () => {
  const r = Pr.resumenPredicciones(Pr.backtest(historial()));
  console.log(`predicciones: ${r.n} marcas, MAPE ${r.mape} %, sesgo ${r.sesgo} %`);
  assert.ok(r.n >= 10, `marcas registradas: ${r.n}`);
  // ⚖ Valor de referencia del modelo actual (marca real de 90 días o ley de Paul). Si cambias el modelo y baja,
  // actualízalo; si sube, el cambio empeora las predicciones.
  const MAPE_REF = 1.4;
  assert.ok(r.mape <= MAPE_REF, `MAPE ${r.mape} % (referencia ${MAPE_REF} %)`);
});

test('predicciones: qué cuenta como marca a tope y el texto', () => {
  const previa = conEsfuerzo(T0, 1200, 210);
  const prueba = sesion(T0 + 7 * DIA, [[600, 120], [{ m: 2000 }, 240], [300, 100]], { tipoPlan: 'prueba' });
  const marcas = Pr.marcasATope(prueba, [previa]);
  assert.ok(marcas.some((m) => m.d === 2000), 'la prueba de 2000 m');
  assert.deepEqual(Pr.marcasATope(sesion(T0, [[600, 150]]), []), [], 'sin marca previa ni prueba, nada');
  const [p] = Pr.registrarPredicciones(prueba, [previa]).filter((x) => x.d === 2000);
  assert.ok(p.pred > 0 && p.real > 0 && Number.isFinite(p.error));
  assert.match(Pr.textoPrediccion({ d: 2000, pred: 465, real: 457, error: 1.8 }, (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`),
    /^Tus 2 km: la app predecía 7:45 y remaste 7:37 \(1.8 % de error\)\.$/);
});
