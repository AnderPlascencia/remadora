// Calibración honesta (E-1): un fondo suave nunca baja el FTP del perfil, el FTP estimado sube con la mediana de tus
// 3 mejores y solo cuentan como marca los tramos a tope (no el 2000 m de dentro de un fondo).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/estadisticas.js';
import * as P from '../src/programa.js';
import { resumir } from '../src/resumen.js';

const DIA = 864e5;
const AHORA = new Date('2026-12-01T12:00').getTime();
const v = (w) => Math.cbrt(w / 2.8);
let n = 0;
function sesion(fecha, tramos, extra = {}) {
  const muestras = [];
  let t = 0;
  let dist = 0;
  for (const [segs, w] of tramos) for (let i = 0; i < segs; i++) { t++; dist += v(w); muestras.push({ t, w, spm: 22, dist }); }
  return { id: `s${++n}`, fecha, muestras, duracion: t, distancia: Math.round(dist), wattsProm: Math.round(muestras.reduce((a, x) => a + x.w, 0) / t), ...extra };
}
// Seis fondos de 45 min a 140 W (con 5 min suaves al principio y al final).
const fondos = () => Array.from({ length: 6 }, (_, i) => sesion(AHORA - (2 + 3 * i) * DIA, [[300, 100], [2100, 140], [300, 100]]));
const sinMuestras = (s) => { const { muestras, ...r } = s; return { ...r, res: resumir(s) }; };

test('con solo fondos de 45 min, la predicción sale del modelo y no de una «marca»', () => {
  const ss = fondos();
  for (const d of [2000, 5000]) {
    const est = E.estimar(ss, d, { ahora: AHORA });
    assert.ok(est && est.fuente !== 'marca', `${d} m: ${JSON.stringify(est)}`);
    // El mismo resultado leyendo solo el resumen guardado (sin muestras).
    assert.deepEqual(E.estimar(ss.map(sinMuestras), d, { ahora: AHORA, pc: E.perfilDe(ss, { ahora: AHORA }) }), est);
    const meta = P.sugerirMeta(ss, d, 8, AHORA);
    assert.equal(meta.real, false, `${d} m: ${JSON.stringify(meta)}`);
  }
  // Ningún tramo de un fondo es una marca a tope, ni con muestras ni con su resumen.
  const pc = E.perfilDe(ss, { ahora: AHORA });
  for (const s of ss) for (const d of [2000, 5000]) {
    assert.equal(E.marcaATope(s, d, pc), null);
    assert.equal(E.marcaATope(sinMuestras(s), d, pc), null);
  }
});

test('una prueba de 2000 m sí cuenta como marca, también desde el resumen', () => {
  const ss = fondos();
  const prueba = sesion(AHORA - DIA, [[600, 110], [430, 250], [300, 100]], { tipoPlan: 'prueba' });
  const t = E.mejorTiempoDe(prueba, 2000);
  assert.equal(E.marcaATope(prueba, 2000, null), t);
  assert.equal(E.marcaATope(sinMuestras(prueba), 2000, null), t);
  const est = E.estimar([...ss, prueba], 2000, { ahora: AHORA });
  assert.equal(est.fuente, 'marca');
  assert.equal(est.t, t);
});

test('un fondo suave nunca baja el FTP del perfil; uno exigente sí lo ajusta', () => {
  const suave = sesion(AHORA, [[300, 100], [1200, 125], [300, 100]]);
  const op = { ftp: 200, estimado: true, dePerfil: true };
  assert.equal(E.esExigente(suave, 200), false);
  assert.equal(E.ftpAutomaticoDe(suave, [], op), null, 'el FTP del perfil se queda');
  // Con el pulso alto (o tu esfuerzo de 7 o más) el tramo es exigente: el FTP del perfil estaba alto y baja.
  const duroPulso = { ...suave, rpePulso: 8 };
  assert.equal(E.ftpAutomaticoDe(duroPulso, [], op), Math.round(125 * 0.95));
  // Con watts por encima del perfil, sube.
  const fuerte = sesion(AHORA, [[300, 100], [1200, 230], [300, 100]]);
  assert.equal(E.ftpAutomaticoDe(fuerte, [], op), Math.round(230 * 0.95));
  // Con un FTP de prueba, nada lo cambia solo.
  assert.equal(E.ftpAutomaticoDe(fuerte, [], { ftp: 200 }), null);
  // Sin FTP, la primera sesión de 10 min o más lo fija.
  assert.equal(E.ftpAutomaticoDe(suave, [], {}), Math.round(125 * 0.95));
  assert.equal(E.ftpAutomaticoDe(sesion(AHORA, [[500, 120]]), [], {}), null, 'menos de 10 min no cuenta');
});

test('el FTP estimado sube con la mediana de tus 3 mejores, no con un solo día bueno', () => {
  const de = (w, dias) => sesion(AHORA - dias * DIA, [[300, 100], [1200, w], [300, 100]]);
  const previas = [de(175, 9), de(180, 6), de(185, 3)];
  const op = { ftp: 180, estimado: true };
  // Un día de 260 W: las 3 mejores son 260, 185 y 180 → mediana 185·0,95 ≈ 176, no pasa de 180.
  assert.equal(E.ftpAutomaticoDe(de(260, 0), previas, op), null);
  // Tres días buenos sí lo suben.
  const buenas = [de(200, 9), de(205, 6), de(210, 3)];
  assert.equal(E.ftpAutomaticoDe(de(215, 0), buenas, op), Math.round(210 * 0.95));
});
