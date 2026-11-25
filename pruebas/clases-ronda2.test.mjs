// Clases justas (ronda 2, R2-10, R2-11 y R2-20): desde CLASES_JUSTAS_DESDE cada senda tiene 2 talentos que pagan
// con cualquier forma de remar, «Rumbo pirata» y «Dominio de Roma» piden lo que haces, y la hazaña de clase tiene
// dos caminos. Lo remado antes se cuenta con las reglas de antes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as T from '../src/talentos.js';
import { TIPOS, simular } from './sim-curva.mjs';

const D = 864e5;
const NUEVA = new Date('2026-11-26T19:00').getTime(); // jueves, el día del corte
const VIEJA = new Date('2026-11-12T19:00').getTime();
const total = (filas) => filas.reduce((a, [, v]) => a + v, 0);
const maximos = { m1: 3, m2: 3, m3: 3, m4: 3, maestria: 3 };
// Una sesión del plan cumplida con el 85 % en rango, sin carrera, y otra igual pero sugerida.
const plan = { paladas: 4000, metros: 9000, min: 45, ganados: 0, rivales: 0, sinPausas: false, delPrograma: true, racha: 0, sesSemana: 1, completa: true, pctEnRango: 85, justas: true };
const sugerida = { ...plan, delPrograma: false, sugerida: true };

test('el pirata cobra sus talentos con una sesión del plan en rango, solo desde el corte', () => {
  for (const senda of ['a', 'b']) {
    const nuevo = T.xpTalentos('pirata', maximos, { ...plan, senda });
    assert.ok(nuevo.length >= 2, `senda ${senda}: ${JSON.stringify(nuevo)}`);
    assert.equal(T.xpTalentos('pirata', maximos, { ...plan, senda, justas: false }).length, 0);
    // Fuera de rango, o sin cumplirla, no es botín.
    assert.equal(T.xpTalentos('pirata', maximos, { ...plan, senda, pctEnRango: 70 }).length, 0);
    assert.equal(T.xpTalentos('pirata', maximos, { ...plan, senda, completa: false }).length, 0);
  }
  // Bolsa ligera: sin carrera cuenta como 2 fantasmas; con carrera, los que venzas.
  assert.deepEqual(T.xpTalentos('pirata', { m1: 3 }, plan), [['Bolsa ligera', 48]]);
  assert.deepEqual(T.xpTalentos('pirata', { m1: 3 }, { ...plan, rivales: 3, ganados: 3 }), [['Bolsa ligera', 72]]);
});

test('cada clase y senda tiene al menos 2 talentos que pagan con el plan y con la sugerida', () => {
  for (const clase of ['vikingo', 'pirata', 'samurai', 'polinesio', 'romano']) for (const senda of ['a', 'b']) {
    // La sesión clave (umbral) y la palada larga cuentan como lo que son: una sesión normal del plan o sugerida.
    const d = { ...plan, senda, clave: true, palada: true, mppMedia: 9000 / 4000, sinPausas: true, tecMin: 20, racha: 3, semanasSeguidas: 3, sesSemana: 3 };
    for (const [forma, x] of [['plan', d], ['sugerida', { ...d, delPrograma: false, sugerida: true, racha: 0 }]]) {
      const filas = T.xpTalentos(clase, maximos, x);
      assert.ok(filas.length >= 2, `${clase} ${senda} con ${forma}: ${JSON.stringify(filas)}`);
    }
  }
});

test('romano y samurái: la sugerida cuenta para la Ley de la flota y el Maestro del dojo', () => {
  assert.deepEqual(T.xpTalentos('romano', { m3: 3 }, { ...sugerida, semanasSeguidas: 5 }), [['Ley de la flota', 75]]);
  assert.equal(T.xpTalentos('romano', { m3: 3 }, { ...sugerida, semanasSeguidas: 5, justas: false }).length, 0);
  assert.deepEqual(T.xpTalentos('samurai', { m4: 3 }, sugerida), [['Maestro del dojo', 60]]);
  assert.equal(T.xpTalentos('samurai', { m4: 3 }, { ...sugerida, justas: false }).length, 0);
});

test('«Rumbo pirata» pide tus sesiones de siempre y «Dominio de Roma» también cuenta las sesiones del plan', () => {
  const rit = { sesSemana: 3, conPlan: false };
  const lunes = (ms) => J.lunesDe(ms);
  const rumbo = (ms) => J.misionesDeSemana(lunes(ms), 'pirata', rit).find((m) => m.clave === 'rumbo');
  assert.equal(rumbo(VIEJA).meta, 4);
  assert.equal(rumbo(NUEVA + 4 * D).meta, 3);
  const dominio = J.misionesDeSemana(lunes(NUEVA + 4 * D), 'romano', rit).find((m) => m.clave === 'dominio');
  assert.match(dominio.texto, /sesiones del plan o sugeridas/);
});

test('hazaña de clase: con las reglas nuevas, 40 semanas con 2 sesiones bastan; lo de antes no cambia', () => {
  const sem = (base, n) => Array.from({ length: n }, (_, w) => [0, 2].map((d) => TIPOS.fondo30(base + (w * 7 + d) * D, {}, 200))).flat();
  // Desde el lunes siguiente al corte: 40 semanas con 2 fondos de 30 min dan la de cualquier clase.
  const lunes = new Date('2026-11-30T19:00').getTime();
  for (const clase of ['romano', 'pirata']) {
    const h = J.estadoJuego(sem(lunes, 40), { ftp: 200, per: { clase }, ahora: lunes + 40 * 7 * D, calendario: null });
    const hz = h.hazanas.find((x) => x.id === `clase-${clase}`);
    assert.equal(hz.hecha, true, clase);
    const h39 = J.estadoJuego(sem(lunes, 39), { ftp: 200, per: { clase }, ahora: lunes + 39 * 7 * D, calendario: null });
    const hz39 = h39.hazanas.find((x) => x.id === `clase-${clase}`);
    assert.equal(hz39.hecha, false, clase);
    assert.equal(hz39.unidad, 'semanas con 2 sesiones o más');
    assert.equal(hz39.valor, 39);
    assert.ok(hz39.caminos.length >= 2);
  }
  // Antes del corte, con la meta de antes: 400 min técnicos dan la del samurái (y quien la tiene, la conserva).
  const viejas = Array.from({ length: 16 }, (_, i) => TIPOS.fondo30(VIEJA - 15 * D + i * D, {}, 200));
  const h = J.estadoJuego(viejas, { ftp: 200, per: { clase: 'samurai' }, ahora: NUEVA + D, calendario: null });
  assert.equal(h.hazanas.find((x) => x.id === 'clase-samurai').hecha, true);
  // Las mismas sesiones desde el corte ya no bastan (ahora son 3000 min).
  const nuevas = viejas.map((s, i) => ({ ...s, fecha: NUEVA + i * D }));
  const h2 = J.estadoJuego(nuevas, { ftp: 200, per: { clase: 'samurai' }, ahora: NUEVA + 17 * D, calendario: null });
  assert.equal(h2.hazanas.find((x) => x.id === 'clase-samurai').hecha, false);
});

// R2-20: la prueba de clases en la simulación de 2 años (senda A, talentos repartidos al subir de nivel).
test('simulación de 2 años: ninguna clase por debajo del 95 % de la XP media y la hazaña entre las semanas 20 y 45', () => {
  for (const perfil of ['plan4', 'libre4', 'sugerida2']) {
    const r = ['vikingo', 'pirata', 'samurai', 'polinesio', 'romano'].map((clase) => [clase, simular(perfil, { clase })]);
    const media = r.reduce((a, [, x]) => a + x.h.xp, 0) / r.length;
    for (const [clase, x] of r) {
      assert.ok(x.h.xp >= 0.95 * media, `${perfil} ${clase}: ${Math.round((100 * x.h.xp) / media)} % de la media`);
      assert.ok(x.hazanaClase >= 20 && x.hazanaClase <= 45, `${perfil} ${clase}: hazaña en la semana ${x.hazanaClase}`);
    }
  }
});
