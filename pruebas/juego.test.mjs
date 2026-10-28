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
  assert.ok(d.every((x) => x.xp >= 15 && x.xp <= 60), 'diarias moderadas');
  assert.ok(d[0].texto.startsWith('Completa una sesión de al menos') && d[1].texto.includes('min activos'), 'una de distancia y una de duración');
  assert.deepEqual(d.map((x) => x.texto), J.misionesDelDia('2026-01-05').map((x) => x.texto), 'misiones repetibles');
  const sem = J.misionesDeSemana('2026-01-05', 'pirata');
  assert.equal(sem.length, 4);
  assert.ok(sem.some((x) => x.nombre === 'Rival de la semana'));
  // Rivales: nunca de tu clase, el primero es el de la semana, rango relativo al tuyo
  const rv = J.rivalesPara(['igual', 'superior', 'inferior'], { miClase: 'vikingo', nivel: 35, ftp: 200, lunes: '2026-01-05' });
  assert.equal(rv[0].clase, J.rivalDeLaSemana('2026-01-05', 'vikingo'));
  assert.ok(rv.every((x) => x.clase !== 'vikingo'));
  assert.equal(new Set(rv.map((x) => x.clase)).size, 3);
  assert.deepEqual(rv.map((x) => x.rango), ['guerrero', 'veterano', 'combatiente']);
  assert.deepEqual(rv.map((x) => x.ftp), [200, 210, 186]);
  assert.ok(sem.some((x) => x.nombre === 'Rumbo pirata'), 'misión temática de la clase');
  assert.ok(sem.every((x) => x.xp >= 150 && x.xp <= 250), 'semanales moderadas');
  assert.equal(J.lunesDe(Date.UTC(2026, 0, 8, 12)), '2026-01-05');

  // Capítulo 1: 2 sesiones + 3 km + Prueba 500 m
  const s1 = sesion(5, 160, 1200);
  const prueba = sesion(6, 260, 110, { entrenamiento: 'Prueba 500 m', tiempoMeta: 110, distancia: 500 });
  const e = J.estadoJuego([s1, prueba], { ftp: 200, per: { clase: 'vikingo' }, ahora: Date.UTC(2026, 0, 6, 20) });
  assert.equal(e.capitulosHechos, 1, 'jefe del capítulo 1 vencido');
  assert.ok(e.insignias.has('casco-cuernos-oro'), 'el premio del capítulo es una insignia');
  assert.ok(e.logros.find((l) => l.tipo === 'jefe').monedas === 100 + J.PREMIO_INSIGNIA);
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

  // Talentos por clase: puntos cada 3 niveles, requisitos por rango, rama favorita con grado gratis
  assert.equal(J.puntosDeNivel(90), 30);
  assert.equal(J.talentosDe('vikingo').length, 9);
  assert.equal(J.talentosDe('samurai').find((t) => t.slot === 'disciplina-2').nombre, 'Kata');
  assert.equal(J.grado({}, 'vikingo', 'potencia-1'), 1, 'la favorita trae un grado gratis');
  assert.equal(J.grado({}, 'vikingo', 'fondo-1'), 0);
  const est = { nivel: 10, libres: 3 };
  assert.equal(J.motivoBloqueo('fondo-1', est, {}, 'vikingo'), null);
  assert.match(J.motivoBloqueo('fondo-2', est, {}, 'vikingo'), /Primero/);
  assert.match(J.motivoBloqueo('potencia-2', est, {}, 'vikingo'), /nivel 20/);
  assert.equal(J.motivoBloqueo('potencia-2', { nivel: 20, libres: 3 }, {}, 'vikingo'), null);
  assert.match(J.motivoBloqueo('potencia-2', { nivel: 20, libres: 2 }, {}, 'vikingo'), /3 puntos/);
  assert.equal(J.puntosGastados({ 'fondo-1': [1, 2], 'potencia-2': [3] }), 5);
  // Un talento aplica solo desde que se aprende
  const largo = sesion(7, 150, 1900);
  const antes = J.estadoJuego([largo], { ftp: 200, per: { clase: 'vikingo', arbol: { vikingo: { 'fondo-1': [largo.fecha + 1] } } } });
  assert.ok(!antes.porSesion.get(largo.fecha).detalle.some(([t]) => t === 'Remo largo'));
  const despues = J.estadoJuego([largo], { ftp: 200, per: { clase: 'vikingo', arbol: { vikingo: { 'fondo-1': [0, 0] } } } });
  const remo = despues.porSesion.get(largo.fecha).detalle.find(([t]) => t === 'Remo largo');
  assert.equal(remo[1], Math.round(despues.porSesion.get(largo.fecha).detalle[0][1] * 0.08), '+4 % por grado');
  assert.equal(despues.talentosLibres, despues.talentos - 2);

  const tienda = J.tiendaSemana('2026-01-05');
  assert.equal(tienda.length, 4);
  assert.equal(new Set(tienda.map((x) => x.id)).size, 4);
  assert.deepEqual(tienda, J.tiendaSemana('2026-01-05'), 'igual toda la semana');
  console.log('juego extra OK', e.monedas, e.logros.map((l) => l.texto));
}

// XP estimada y recomendación por atributos
{
  const s1 = sesion(10, 150, 1800);
  const hip = sesion(11, 150, 1800, { tiempoMeta: 1800, rival: { nombre: 'X', clase: 'pirata', diferencia: 1 } });
  const est = J.estimarXp([s1], hip, { ftp: 200, per: { clase: 'vikingo' } });
  assert.ok(est.sesion >= 720 + 50 + 25, `xp de la sesión ${est.sesion}`);
  assert.equal(est.total, est.sesion + est.extra);
  const r = J.recomendarPorAtributos({ fuerza: 30, agilidad: 20, resistencia: 50, recuperacion: 5, tecnica: 40, voluntad: 25 });
  assert.equal(r.atributo.clave, 'recuperacion');
  assert.equal(r.reto, 'inferior');
  assert.equal(J.recomendarPorAtributos({}), null);
  console.log('estimar OK', est.total);
}
