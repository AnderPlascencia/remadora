// Ronda 2 (E1, E2, E3): la fatiga no miente. Tres pruebas fijas del informe del entrenador.
import assert from 'node:assert/strict';
import * as E from '../src/estadisticas.js';
import * as C from '../src/capacidades.js';
import * as I from '../src/intensidad.js';

const DIA = 864e5;
const ahora = Date.parse('2026-11-24T19:00'); // martes

// Carga constante: 3 sesiones de 60 de carga por semana (lunes, miércoles y sábado), durante n semanas.
const constante = (semanas) => {
  const ses = [];
  for (let d = semanas * 7; d >= 1; d--) {
    const t = ahora - d * DIA;
    if ([1, 3, 6].includes(new Date(t).getDay())) ses.push({ fecha: t, duracion: 3600, estres: 60 });
  }
  return ses;
};

// E2: con la misma carga cada semana, el ratio queda entre 0,9 y 1,1 desde la semana 4 (antes 1,6 a las 5).
for (const semanas of [5, 6, 8, 12, 20]) {
  const r = E.ratioCarga(constante(semanas), 200, ahora);
  assert.ok(r >= 0.9 && r <= 1.1, `ratio ${r} con ${semanas} semanas de carga constante`);
  // Tu semana normal queda dentro del rango seguro que se pinta en Hoy.
  const c = C.estadoCuerpo(constante(semanas), 200, ahora);
  assert.ok(c.semana >= c.seguro.min && c.semana <= c.seguro.max, `semana ${c.semana} fuera de ${JSON.stringify(c.seguro)}`);
}
{
  // A las 4 semanas justas todavía no hay ratio (pide 28 días de historial), pero el estado no sale cargado.
  const c = C.estadoCuerpo(constante(4), 200, ahora);
  assert.ok(['fresco', 'listo'].includes(c.clave), `estado ${c.clave} con carga constante`);
}

// E3: Hoy y la adaptación dan el mismo ratio, y la carga de hoy cuenta una sola vez.
{
  const ses = [...constante(6), { fecha: ahora - 2 * 36e5, duracion: 3600, estres: 100 }];
  const dia = E.forma(ses, 200, 1, ahora).at(-1);
  const c = C.estadoCuerpo(ses, 200, ahora);
  assert.equal(c.condicion, dia.condicion);
  assert.equal(c.fatiga, dia.fatiga);
  assert.equal(c.ratio, E.ratioCarga(ses, 200, ahora));
  assert.notEqual(c.clave, 'agotado', 'una sesión de 100 tras semanas de 180 no deja agotado');
}

// E1: dos fondos con IF 0,65 en la semana no apagan la intensidad; dos con un talento de intensidad, sí.
{
  const viejas = [{ fecha: ahora - 60 * DIA, duracion: 1800 }];
  const fondo = (dias) => ({ fecha: ahora - dias * DIA, duracion: 1800, wattsProm: 120, ftp: 200, intensidad: 0.65 });
  assert.equal(I.sesionesIntensasSemana([fondo(1), fondo(0.5)], 200, ahora), 0);
  assert.equal(I.permisoIntensidad({ sesiones: [...viejas, fondo(1), fondo(0.5)], ahora }).activa, true);
  const conTalento = (dias) => ({ ...fondo(dias), usoIntensidad: true });
  assert.equal(I.sesionesIntensasSemana([conTalento(1), conTalento(0.5)], 200, ahora), 2);
  // Las guardadas antes del cambio (intensidad: true) siguen contando.
  assert.equal(I.sesionesIntensasSemana([{ ...fondo(1), intensidad: true }], 200, ahora), 1);
}
