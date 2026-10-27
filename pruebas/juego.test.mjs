import assert from 'node:assert/strict';
import * as J from '../juego.js';

assert.equal(J.xpParaNivel(1), 0);
assert.equal(J.xpParaNivel(2), 200);
assert.equal(J.xpParaNivel(3), 410);
assert.equal(J.xpDelNivel(10), Math.round(200 * 1.05 ** 9));
assert.equal(J.nivelDe(0), 1);
assert.equal(J.nivelDe(J.xpParaNivel(10)), 10);
assert.equal(J.nivelDe(J.xpParaNivel(10) - 1), 9);
assert.equal(J.nivelDe(1e9), J.NIVEL_MAX);
assert.equal(J.NIVEL_MAX, 90);
assert.equal(J.tituloDe(9), 'Novato');
assert.equal(J.tituloDe(10), 'Aprendiz');
assert.equal(J.tituloDe(79), 'Maestro');
assert.equal(J.tituloDe(80), 'Legendario');
assert.equal(J.tituloDe(90), 'Legendario');
assert.equal(J.rangoDe(35).id, 'guerrero');
// Clases: 5 nuevas; las antiguas se migran sin perder nada
assert.deepEqual(J.CLASES.map((c) => c.clave), ['vikingo', 'pirata', 'samurai', 'polinesio', 'romano']);
assert.equal(J.claseDe('explorador').clave, 'polinesio');
assert.equal(J.claseDe('monje').clave, 'samurai');
assert.equal(J.claseDe('gladiador').clave, 'romano');

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
// Bono de clase: el explorador (ahora polinesio) gana 15 % más resistencia
const sin = J.progresoHeroe([fondo], { ftp: 200 });
assert.ok(h.atributos.resistencia > sin.atributos.resistencia);
// 1 XP por cada 10 m: 7200 m de fondo dan 720 XP de base
assert.deepEqual(g1.detalle[0], ['Distancia', 720]);
console.log('juego OK', h.nivel, h.atributos, g1.xp, g2.xp);

// Misiones, capítulos, talentos y tienda
{
  const d = J.misionesDelDia('2026-01-05');
  assert.equal(d.length, 5);
  assert.ok(d.every((x) => x.xp >= 30 && x.xp <= 120), 'diarias moderadas');
  assert.ok(d[0].texto.startsWith('Completa una sesión de al menos') && d[1].texto.includes('min activos'), 'una de distancia y una de duración');
  assert.deepEqual(d.map((x) => x.texto), J.misionesDelDia('2026-01-05').map((x) => x.texto), 'misiones repetibles');
  assert.equal(J.misionesDelDia('2026-01-05', true).length, 6);
  const sem = J.misionesDeSemana('2026-01-05', 'pirata');
  assert.equal(sem.length, 3);
  assert.ok(sem.some((x) => x.nombre === 'Rumbo pirata'), 'misión temática de la clase');
  assert.ok(sem.every((x) => x.xp >= 150 && x.xp <= 250), 'semanales moderadas');
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
  assert.equal(e.diarias.length, 5);
  // Logros y constancia dan XP aparte de la sesión
  assert.ok(e.logros.some((l) => l.texto === 'Logro: Primera travesía' && l.xp === 100));
  assert.ok(e.logros.some((l) => l.tipo === 'constancia' && l.xp === 40), 'primer entrenamiento de la semana');
  assert.ok(e.logros.some((l) => l.tipo === 'diaria' && l.xp > 0), 'las misiones dan XP');
  const ps = e.porSesion.get(s1.fecha);
  assert.ok(ps.xpExtra >= 140, `xp extra ${ps.xpExtra}`);

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
