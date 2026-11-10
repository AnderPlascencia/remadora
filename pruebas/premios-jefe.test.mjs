import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as CB from '../src/coleccion-bote.js';

// Etapa 6.2 del rediseño del héroe: cada jefe de los capítulos 1–3 da, además de la insignia común, una pieza del
// bote de la clase con la que remabas al vencerlo.
const dia = (k) => new Date(`${k}T18:00`).getTime();
const ses = (k, extra = {}) => ({ fecha: dia(k), duracion: 1800, distancia: 7000, paladas: 720, wattsProm: 150, kcal: 300, ftp: 200, tiempoMeta: 1800, entrenamiento: 'Fondo', reglasXp: 3, ...extra });
const p500 = (k) => ses(k, { entrenamiento: 'Prueba 500 m', distancia: 500, duracion: 110, tiempoMeta: 110 });
const z2 = Array.from({ length: 900 }, () => ({ w: 150, spm: 22 }));
const p2000 = (k) => ses(k, { entrenamiento: 'Prueba 2000 m', distancia: 2000, duracion: 480, tiempoMeta: 480 });

// Todas las clases con saga tienen sus 3 piezas, con su imagen.
for (const c of ['vikingo', 'pirata', 'samurai', 'romano']) {
  for (const n of [1, 2, 3]) assert.ok(CB.PIEZAS[`${c}-jefe${n}`]?.imagen, `${c}-jefe${n}`);
}

{
  const sesiones = [ses('2026-11-01'), ses('2026-11-02'), p500('2026-11-03')];
  const h = J.estadoJuego(sesiones, { ftp: 200, per: { clase: 'vikingo' }, ahora: dia('2026-11-04') });
  assert.ok(h.capitulosHechos >= 1);
  assert.ok(h.piezasJefe.includes('vikingo-jefe1'), 'sin historial: la de la clase de ahora (también para quien ya lo había vencido)');
  assert.equal(h.porSesion.get(dia('2026-11-03')).jefe.pieza, 'vikingo-jefe1');
  assert.ok(CB.tienePieza({}, 'vikingo-jefe1', { jefes: new Set(h.piezasJefe) }));
  assert.ok(!CB.tienePieza({}, 'pirata-jefe1', { jefes: new Set(h.piezasJefe) }));
}

{
  // Cambias de clase entre el capítulo 1 y el 2: cada pieza es de la clase con la que lo venciste.
  const sesiones = [ses('2026-11-01'), ses('2026-11-02'), p500('2026-11-03'),
    ...['04', '05', '06', '07', '08'].map((d) => ses(`2026-11-${d}`, { muestras: z2 })), p2000('2026-11-09')];
  const per = { clase: 'samurai', claseHist: [[0, 'pirata'], [dia('2026-11-05'), 'samurai']] };
  const h = J.estadoJuego(sesiones, { ftp: 200, per, ahora: dia('2026-11-10') });
  assert.ok(h.capitulosHechos >= 2);
  assert.ok(h.piezasJefe.includes('pirata-jefe1'));
  assert.ok(h.piezasJefe.includes('samurai-jefe2'));
  assert.ok(!h.piezasJefe.includes('samurai-jefe1'));
}

{
  // Polinesio (saga pendiente de revisión cultural): de momento solo la insignia.
  const h = J.estadoJuego([ses('2026-11-01'), ses('2026-11-02'), p500('2026-11-03')], { ftp: 200, per: { clase: 'polinesio' }, ahora: dia('2026-11-04') });
  assert.ok(h.capitulosHechos >= 1);
  assert.deepEqual(h.piezasJefe, []);
}
