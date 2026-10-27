import assert from 'node:assert/strict';
import * as J from '../juego.js';

assert.equal(J.xpParaNivel(1), 0);
assert.equal(J.nivelDe(0), 1);
assert.equal(J.nivelDe(J.xpParaNivel(10)), 10);
assert.equal(J.nivelDe(J.xpParaNivel(10) - 1), 9);
assert.equal(J.nivelDe(1e9), J.NIVEL_MAX);

// 30 min a 150 W con FTP 200: zona 2-3 → resistencia; luego series sobre FTP → fuerza y agilidad.
const sesion = (dia, w, dur, extra = {}) => ({
  fecha: Date.UTC(2026, 0, dia, 12), duracion: dur, distancia: dur * 4, paladas: dur / 2.5, wattsProm: w,
  muestras: Array.from({ length: dur }, (_, t) => ({ t: t + 1, w, spm: 24, dist: (t + 1) * 4, split: 125 })), ...extra,
});
const fondo = sesion(1, 150, 1800);
const series = sesion(2, 230, 600, { tiempoMeta: 600, rival: { nombre: 'Fantasma', diferencia: 12 } });
const h = J.progresoHeroe([series, fondo], { ftp: 200, clase: 'explorador' });
const g1 = h.porSesion.get(fondo.fecha);
const g2 = h.porSesion.get(series.fecha);
assert.ok(g1.ganancias.resistencia > 15, 'fondo da resistencia');
assert.ok(!g1.ganancias.fuerza);
assert.ok(g2.ganancias.fuerza >= 10 && g2.ganancias.agilidad >= 20, 'series dan fuerza y agilidad');
assert.ok(g2.detalle.some(([t]) => t === 'Fantasma vencido'));
assert.ok(g2.detalle.some(([t]) => t.startsWith('Racha')));
assert.ok(h.nivel >= 2);
// Bono de clase: el explorador gana 15 % más resistencia
const sin = J.progresoHeroe([fondo], { ftp: 200 });
assert.ok(h.atributos.resistencia > sin.atributos.resistencia);
// Una sesión típica de 30 min da alrededor de 400-900 XP
assert.ok(g1.xp > 300 && g1.xp < 1000, `xp ${g1.xp}`);
console.log('juego OK', h.nivel, h.atributos, g1.xp, g2.xp);
