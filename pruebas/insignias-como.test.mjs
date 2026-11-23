import assert from 'node:assert/strict';
import * as E from '../src/estadisticas.js';

// Insignias que dicen cómo se consiguen: cada una empieza por un verbo, lleva avance y se puede ganar hoy.
const dia = (k) => new Date(`${k}T18:00`).getTime();
const sesion = (k, extra = {}) => ({ fecha: dia(k), duracion: 1200, distancia: 3200, ...extra });
const por = (lista) => Object.fromEntries(E.insignias(lista).map((x) => [x.clave, x]));

// Cada insignia dice qué hacer con un verbo.
for (const x of E.INSIGNIAS) assert.match(x.detalle, /^(Rema|Guarda|Completa|Cumple|Gana)\b/, `${x.clave}: «${x.detalle}»`);

// «Rival avanzado» se gana con una carrera en Alta mar (los rivales a la medida ya no tienen nivel «avanzado»)…
{
  const rival = { nombre: 'Fantasma', nivel: 'personalizado', dificultad: 'altamar', diferencia: 12 };
  assert.equal(por([sesion('2026-11-20', { rivales: [rival] })]).avanzado.ganada, true);
  assert.equal(por([sesion('2026-11-20', { rivales: [{ ...rival, dificultad: 'costa' }] })]).avanzado.ganada, false);
  // …y quien la ganó con el rival avanzado de antes la conserva.
  assert.equal(por([sesion('2026-10-01', { rival: { nivel: 'avanzado', diferencia: 5 } })]).avanzado.ganada, true);
}

// El avance: lo que llevas hacia la meta, con su unidad y sin pasarse de ella.
{
  const i = por([sesion('2026-11-18'), sesion('2026-11-20', { distancia: 4100, duracion: 2400 })]);
  assert.equal(i.km5.valor, 4.1);
  assert.equal(i.km5.unidad, 'km');
  assert.equal(i.min30.valor, 30);
  assert.equal(i.ses10.valor, 2);
  assert.equal(i.tot100.valor, 7.3);
}
