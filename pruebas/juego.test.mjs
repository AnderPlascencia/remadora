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

// Misiones, capítulos, talentos y tienda
{
  const d = J.misionesDelDia('2026-01-05');
  assert.equal(d.length, 3);
  assert.deepEqual(d.map((x) => x.texto), J.misionesDelDia('2026-01-05').map((x) => x.texto), 'misiones repetibles');
  assert.equal(J.misionesDelDia('2026-01-05', true).length, 4);
  assert.equal(J.lunesDe(Date.UTC(2026, 0, 8, 12)), '2026-01-05');

  // Capítulo 1: 2 sesiones + 3 km + Prueba 500 m
  const s1 = sesion(5, 160, 1200);
  const prueba = sesion(6, 260, 110, { entrenamiento: 'Prueba 500 m', tiempoMeta: 110, distancia: 500 });
  const e = J.estadoJuego([s1, prueba], { ftp: 200, per: { clase: 'vikingo' }, ahora: Date.UTC(2026, 0, 6, 20) });
  assert.equal(e.capitulosHechos, 1, 'jefe del capítulo 1 vencido');
  assert.ok(e.poseidos.has('casco-cuernos-oro'));
  assert.ok(e.logros.some((l) => l.tipo === 'jefe'));
  assert.equal(e.capitulo.n, 2);
  assert.ok(e.monedas >= 100);
  assert.equal(e.diarias.length, 3);

  // Talentos: requisitos y puntos
  const est = { atributos: { fuerza: 20 }, talentosLibres: 3 };
  assert.equal(J.motivoBloqueo('brazos-hierro', est, {}), null);
  assert.match(J.motivoBloqueo('turbo', est, {}), /Primero/);
  assert.equal(J.motivoBloqueo('turbo', est, { 'brazos-hierro': 1 }), null);
  assert.match(J.motivoBloqueo('critico', est, { 'brazos-hierro': 1, turbo: 1 }), /Fuerza 40/);
  // Talento aplicado solo desde que se aprende
  const conTal = J.estadoJuego([s1], { ftp: 200, per: { talentos: { pulmones: 0, 'pies-ligeros': 0 } } });
  assert.ok(conTal.porSesion.get(s1.fecha).detalle.some(([t]) => t === 'Pies ligeros') === false);
  assert.ok(conTal.talentosLibres <= conTal.talentos);

  const tienda = J.tiendaSemana('2026-01-05', new Set());
  assert.equal(tienda.length, 4);
  assert.deepEqual(tienda.map((x) => x.rareza), ['rara', 'rara', 'comun', 'comun']);
  console.log('juego extra OK', e.monedas, e.logros.map((l) => l.texto));
}
