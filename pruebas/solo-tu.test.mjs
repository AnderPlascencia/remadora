import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as E from '../src/estadisticas.js';
import * as XC from '../src/xp-carga.js';

// ⚖ Etapa 18: las marcas se miden contra ti mismo, no contra tiempos de Concept2 (la RW200 mide otros watts).
// «Bajo 8 / Bajo 7 minutos» se retiran desde la fecha de corte; quien ya los tiene los conserva.
const FTP = 200;
const dia = (k) => new Date(`${k}T18:00`).getTime();
const dosMil = (k, seg) => ({
  fecha: dia(k), duracion: seg, distancia: 2000, ftp: FTP, wattsProm: 2.8 * (2000 / seg) ** 3, reglasXp: XC.REGLAS_XP_CARGA,
  muestras: Array.from({ length: seg + 1 }, (_, t) => ({ t, w: 2.8 * (2000 / seg) ** 3, spm: 28, dist: (t * 2000) / seg })),
});
const ins = (lista) => Object.fromEntries(E.insignias(lista).map((x) => [x.clave, x.ganada]));
const juego = (lista) => J.estadoJuego(lista, { ftp: FTP, per: {}, calendario: {}, ahora: lista.at(-1).fecha + 3600e3 });
const hazana = (g, id) => g.hazanas.find((h) => h.id === id);

assert.equal(E.SOLO_TU_DESDE, '2026-11-24');
assert.equal(E.mejoraPct(500, 475), 5);
assert.equal(E.mejoraPct(0, 475), 0);

// Un 2000 m bajo 8 minutos antes del corte conserva su insignia y su logro (con el aura de hielo).
{
  const lista = [dosMil('2026-11-10', 470)];
  assert.equal(ins(lista).sub8, true);
  const g = juego(lista);
  assert.equal(hazana(g, 'sub8').hecha, true);
  assert.ok(g.logros.some((l) => l.texto === 'Logro: Bajo 8 minutos' && l.objeto === 'aura-hielo'));
}
// Después del corte, bajar de 8 minutos ya no da nada por sí solo, y las retiradas no se ven si no se tienen.
{
  const lista = [dosMil('2026-11-25', 470)];
  const i = ins(lista);
  assert.ok(!('sub8' in i) && !('sub7' in i), 'retiradas y no ganadas: no salen');
  const g = juego(lista);
  assert.equal(hazana(g, 'sub8'), undefined, 'logro oculto si no se tiene');
  assert.ok(!g.logros.some((l) => l.objeto === 'aura-hielo'));
}
// Contra ti mismo: 3 % y 6 % menos que tu primer 2000 m dan las insignias nuevas; 5 % da el logro con el aura.
{
  const lista = [dosMil('2026-11-20', 520), dosMil('2026-11-25', 503), dosMil('2026-11-28', 494), dosMil('2026-12-02', 488)];
  const i = ins(lista);
  assert.equal(i.mejor3, true);
  assert.equal(i.mejor6, true);
  const g = juego(lista);
  assert.equal(hazana(g, 'mejora2k').hecha, true);
  const l = g.logros.find((x) => x.texto === 'Logro: Más rápido que al empezar');
  assert.equal(l.objeto, 'aura-hielo');
  assert.equal(new Date(l.fecha).getDate(), 28, 'al llegar al 5 %');
}
// Una mejora del 5 % hecha antes del corte no se cobra hasta la siguiente sesión con 2000 m.
{
  const lista = [dosMil('2026-11-01', 520), dosMil('2026-11-10', 490)];
  assert.equal(ins(lista).mejor3, false);
  assert.equal(hazana(juego(lista), 'mejora2k').hecha, false);
}
console.log('solo-tu: ok');
