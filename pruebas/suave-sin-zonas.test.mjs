// Días suaves del plan (decisión de Ander, 23 nov): ir por encima de la zona 3 no da Fuerza ni Agilidad.
import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as C from '../src/consejos.js';

const ftp = 200;
// 30 min: 20 a 120 W y 10 a 220 W (por encima del 106 % del FTP).
const muestras = Array.from({ length: 1800 }, (_, t) => ({ t: t + 1, w: t < 1200 ? 120 : 220, spm: 22, dist: (t + 1) * 4 }));
const base = { duracion: 1800, distancia: 7200, muestras, wattsProm: 153, tiempoMeta: 1800, entrenamiento: 'Fondo 30 min (zona 2)' };
const dia = (k) => new Date(`${k}T10:00`).getTime();

const fondoPlan = { ...base, fecha: dia('2026-11-24'), tipoPlan: 'fondo', delPrograma: { fecha: '2026-11-24' } };
const a = J.atributosDeSesion(fondoPlan, { ftp });
assert.equal(J.esSuaveDelPlan(fondoPlan), true);
assert.equal(a.fuerza, 0, 'un fondo del plan remado fuerte no da Fuerza');
assert.equal(a.agilidad, 0, 'ni Agilidad');
assert.ok(a.resistencia > 0, 'la Resistencia sí cuenta');

// La misma sesión antes de la regla, fuera del plan o en un día duro sigue sumando como siempre.
for (const s of [{ ...fondoPlan, fecha: dia('2026-11-23') }, { ...fondoPlan, delPrograma: undefined }, { ...fondoPlan, tipoPlan: 'umbral' }, { ...fondoPlan, tipoPlan: null }]) {
  assert.equal(J.esSuaveDelPlan(s), false);
  const b = J.atributosDeSesion(s, { ftp });
  assert.ok(b.fuerza > 0 && b.agilidad > 0);
}

// El resumen lo dice como minutos por encima del rango, sin premio.
const r = C.analisis(fondoPlan, { ftp });
assert.ok(r.fuera && /min por encima de 182 W/.test(r.fuera.titulo));
assert.ok(!r.logros.some((x) => x.atributo === 'fuerza' || x.atributo === 'agilidad'));
assert.equal(C.analisis({ ...fondoPlan, tipoPlan: 'umbral' }, { ftp }).fuera, null);

// En vivo: por encima del rango en un fondo del plan, el reto es «Baja a …», en ámbar, y no suma Fuerza.
const vivo = muestras.slice(0, 1300);
const conRango = C.enVivo(vivo, { ftp, tipo: 'fondo', delPlan: true, ahora: dia('2026-11-24'), rango: { min: 112, max: 150 } });
assert.equal(conRango.reto.titulo, 'Baja a 112–150 W');
assert.equal(conRango.reto.aviso, true);
assert.equal(conRango.puntos.fuerza, 0);
const sinRango = C.enVivo(vivo, { ftp, tipo: 'fondo', delPlan: true, ahora: dia('2026-11-24') });
assert.equal(sinRango.reto.titulo, 'Baja a 112–180 W');
// Fuera del plan, el mismo fondo sigue con «Vuelve a tu rango».
assert.equal(C.enVivo(vivo, { ftp, tipo: 'fondo', rango: { min: 112, max: 150 } }).reto.titulo, 'Vuelve a tu rango: 112–150 W');
