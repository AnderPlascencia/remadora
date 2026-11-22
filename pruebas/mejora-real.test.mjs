import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as F from '../src/fantasma.js';
import * as XC from '../src/xp-carga.js';

// ⚖ Etapa 18: premio por mejora real (2 % en tu 2000 m, tu 5000 m o tu prueba de FTP), uno al mes, desde la fecha de corte.
const FTP = 200;
const dia = (k) => new Date(`${k}T18:00`).getTime();
// Un 2000 m remado en `seg` segundos a ritmo parejo.
const dosMil = (k, seg, extra = {}) => ({
  fecha: dia(k), duracion: seg, distancia: 2000, ftp: FTP, wattsProm: 2.8 * (2000 / seg) ** 3, reglasXp: XC.REGLAS_XP_CARGA,
  muestras: Array.from({ length: seg + 1 }, (_, t) => ({ t, w: 2.8 * (2000 / seg) ** 3, spm: 28, dist: (t * 2000) / seg })), ...extra,
});
const logros = (lista) => J.estadoJuego(lista, { ftp: FTP, per: {}, calendario: {}, ahora: lista.at(-1).fecha + 3600e3 }).logros.filter((l) => l.tipo === 'mejora');

assert.equal(J.MEJORA_REAL_DESDE, '2026-11-24');
// Antes de la fecha de corte no paga nada: la XP de las sesiones guardadas no cambia.
assert.deepEqual(logros([dosMil('2026-11-10', 480), dosMil('2026-11-20', 460)]), []);
// Desde la fecha de corte, un 2000 m un 2 % más rápido paga el premio grande.
{
  const l = logros([dosMil('2026-11-20', 480), dosMil('2026-11-25', 470)]);
  assert.equal(l.length, 1);
  assert.match(l[0].texto, /2000 m un 2 % más rápido/);
  assert.equal(l[0].xp, J.XP_MEJORA_REAL);
}
// Un 1 % no basta (es ruido o un buen día) y la primera marca tampoco: no hay contra qué mejorar.
assert.deepEqual(logros([dosMil('2026-11-20', 480), dosMil('2026-11-25', 476)]), []);
assert.deepEqual(logros([dosMil('2026-11-25', 470)]), []);
// Uno al mes: la segunda mejora de diciembre no paga, la de enero sí.
{
  const l = logros([dosMil('2026-11-20', 500), dosMil('2026-12-01', 488), dosMil('2026-12-15', 476), dosMil('2027-01-05', 465)]);
  assert.deepEqual(l.map((x) => new Date(x.fecha).getMonth()), [11, 0]);
}
// La prueba de FTP: un 2 % más de watts que tu mejor prueba anterior.
{
  const base = (k, w) => ({ ...dosMil(k, 480), distancia: 1000, muestras: [], pruebaWatts: w });
  assert.match(J.mejoraReal(base('2026-11-25', 204), { prueba: 200 }), /prueba de FTP un 2 % más fuerte/);
  assert.equal(J.mejoraReal(base('2026-11-25', 203), { prueba: 200 }), null);
}

// Rivales con tu curva: con CP y W′ medidos, la forma sale del motor, sin apartarse más de REL_MARGEN de la tabla.
{
  const pc = { cp: 200, wPrima: 15000, estimada: false };
  for (const d of [500, 1000, 2000, 10000, 21097]) {
    const r = F.relDistancia(d, null, pc);
    const base = F.relDistancia(d);
    assert.ok(r >= base * (1 - F.REL_MARGEN) - 1e-9 && r <= base * (1 + F.REL_MARGEN) + 1e-9, `${d} m dentro del margen`);
  }
  assert.equal(F.relDistancia(5000, null, pc), 1, 'el 5000 m sigue al 100 %');
  assert.ok(F.relDistancia(2000, null, pc) < F.relDistancia(2000), 'con esta curva el 2000 m pide menos que la tabla');
  assert.equal(F.relDistancia(2000, null, { ...pc, estimada: true }), F.relDistancia(2000), 'con W′ estimada, la tabla');
  assert.equal(F.relDistancia(500, 1.15, pc), 1.15, 'el tope del FTP estimado sigue mandando');
}
