import assert from 'node:assert/strict';
import * as J from '../src/juego.js';

// Etapa 2 del rediseño del héroe: curva por sesiones, 18 meses hasta el final, nadie pierde nivel.
const dia = (k, h = 18) => new Date(`${k}T${String(h).padStart(2, '0')}:00`).getTime();

// 1 sesión por nivel al empezar y unas 310 sesiones hasta Legendario (nivel 80): 18 meses a 4 por semana.
assert.equal(J.sesionesPorNivel(1), 1);
assert.ok(J.sesionesPorNivel(79) > 7 && J.sesionesPorNivel(79) < 8);
let total = 0;
for (let n = 1; n < 80; n++) total += J.sesionesPorNivel(n);
const meses = total / 4 / (52 / 12);
assert.ok(Math.abs(meses - J.MESES_LEGENDARIO) < 1, `meses hasta Legendario: ${meses}`);
// Cada nivel cuesta más que el anterior y nunca más de 9 sesiones.
for (let n = 2; n < J.NIVEL_MAX; n++) {
  assert.ok(J.xpDelNivel(n) >= J.xpDelNivel(n - 1), `nivel ${n}`);
  assert.ok(J.xpDelNivel(n) <= 9 * J.XP_SESION_REF);
}
assert.equal(J.nivelCurvaAntes(200), 2, 'la curva de antes sigue para las sesiones viejas');

// Paso de curva: mismo nivel y misma parte del siguiente, sin quitar XP.
for (const xp of [0, 150, 2205, 5000, 12463, 30000, 90000, 150000]) {
  const nuevo = xp + J.ajusteDeCurva(xp);
  assert.ok(J.ajusteDeCurva(xp) >= 0);
  assert.ok(J.nivelDe(nuevo) >= J.nivelCurvaAntes(xp), `xp ${xp}: ${J.nivelDe(nuevo)} vs ${J.nivelCurvaAntes(xp)}`);
}
assert.equal(J.nivelDe(5000 + J.ajusteDeCurva(5000)), J.nivelCurvaAntes(5000), 'por debajo del 77 conservas el nivel exacto');

// Con el historial: el mismo nivel antes y después del cambio, y las sesiones nuevas suben con la curva nueva.
const ses = (k, extra = {}) => ({ fecha: dia(k), duracion: 1800, distancia: 7000, paladas: 720, wattsProm: 150, kcal: 300, ftp: 200, tiempoMeta: 1800, entrenamiento: 'Fondo', reglasXp: 3, ...extra });
{
  const viejas = ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-07', '2026-11-09'].map((k) => ses(k));
  const antes = J.estadoJuego(viejas, { ftp: 200, ahora: dia('2026-11-10', 22) });
  const despues = J.estadoJuego(viejas, { ftp: 200, ahora: dia('2026-11-12', 9) });
  assert.equal(antes.ajusteCurva, 0);
  assert.equal(despues.nivel, antes.nivel, 'conservas el nivel');
  assert.ok(despues.xp >= antes.xp, 'nadie pierde XP');
  assert.ok(despues.ajusteCurva > 0);
  assert.ok(despues.xp >= despues.desde && despues.xp < despues.hasta, 'la barra cuadra con la curva nueva');
  const otra = J.estadoJuego([...viejas, ses('2026-11-12')], { ftp: 200, ahora: dia('2026-11-12', 22) });
  const ps = otra.porSesion.get(dia('2026-11-12'));
  assert.ok(ps.nivelAntes >= antes.nivel, 'el cambio no se ve como una subida de nivel falsa');
}

// Una semana del plan cumplida vence al jefe (desde la curva nueva).
{
  const cal = { '2026-11-16': 'Fondo', '2026-11-17': '', '2026-11-18': 'Fondo', '2026-11-19': '', '2026-11-20': '', '2026-11-21': '', '2026-11-22': '' };
  const plan = (k) => ses(k, { delPrograma: true, delDia: 'plan', tipoPlan: 'fondo' });
  const lista = [plan('2026-11-16'), plan('2026-11-18'), ses('2026-11-23')];
  const con = J.estadoJuego(lista, { ftp: 200, ahora: dia('2026-11-23', 22), calendario: cal });
  const sin = J.estadoJuego(lista, { ftp: 200, ahora: dia('2026-11-23', 22), calendario: {} });
  assert.equal(sin.capitulosHechos, 0, 'sin plan cumplido, el jefe sigue esperando');
  assert.equal(con.capitulosHechos, 1, 'la semana del plan cumplida vence al jefe');
}
console.log('curva OK');
