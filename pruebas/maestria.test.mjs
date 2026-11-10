import assert from 'node:assert/strict';
import * as M from '../src/maestria.js';
import * as J from '../src/juego.js';

// Etapa 7 del rediseño del héroe: maestría de clase del 1 al 10, una por clase.
assert.equal(M.SESIONES_MAESTRIA.length, M.MAESTRIA_MAX);
assert.deepEqual([0, 1, 7, 8, 259, 260, 999].map(M.nivelMaestria), [0, 1, 1, 2, 9, 10, 10]);
// Con 4 sesiones por semana, la 10 llega antes que el Legendario (unos 18 meses = 312 sesiones).
assert.ok(M.SESIONES_MAESTRIA.at(-1) / 4 < 78);
assert.equal(M.nombreMaestria(10), 'Gran maestro');
assert.deepEqual(M.maestriaDe(10), { nivel: 2, nombre: 'Aprendiz', sesiones: 10, desde: 8, hasta: 20, siguiente: 10 });
assert.equal(M.maestriaDe(300).siguiente, null);

// Historial de clases: la de antes cuenta desde siempre al cambiar por primera vez.
{
  const per = { clase: 'vikingo' };
  const h = M.conClaseNueva(per, 'romano', 1000);
  assert.deepEqual(h, [[0, 'vikingo'], [1000, 'romano']]);
  assert.equal(M.claseEn({ ...per, claseHist: h }, 500), 'vikingo');
  assert.equal(M.claseEn({ ...per, claseHist: h }, 2000), 'romano');
  assert.equal(M.claseEn({ clase: 'pirata' }, 5), 'pirata', 'sin historial, la de ahora');
  assert.deepEqual(M.conClaseNueva({ clase: 'romano', claseHist: h }, 'romano', 3000), h, 'elegir la misma no añade nada');
}

// En el juego: cada clase cuenta sus sesiones; las de menos de 10 min no; monedas solo desde MAESTRIA_DESDE.
{
  const dia = (k) => new Date(`${k}T18:00`).getTime();
  const ses = (k, extra = {}) => ({ fecha: dia(k), duracion: 1800, distancia: 7000, paladas: 720, wattsProm: 150, kcal: 300, ftp: 200, tiempoMeta: 1800, entrenamiento: 'Fondo', reglasXp: 3, ...extra });
  const dias = Array.from({ length: 12 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
  const sesiones = [...dias.map((k) => ses(k)), ses('2026-11-13', { duracion: 300 })];
  const per = { clase: 'romano', claseHist: [[0, 'vikingo'], [dia('2026-11-09') - 3600e3, 'romano']] };
  const h = J.estadoJuego(sesiones, { ftp: 200, per, ahora: dia('2026-11-14') });
  assert.equal(h.maestria.vikingo.sesiones, 8, 'del 1 al 8 con vikingo');
  assert.equal(h.maestria.vikingo.nivel, 2);
  assert.equal(h.maestria.romano.sesiones, 4, 'del 9 al 12 con romano; la de 5 min no cuenta');
  assert.equal(h.maestria.pirata.nivel, 0);
  const logros = h.logros.filter((l) => l.tipo === 'maestria');
  // Solo se pagan los niveles alcanzados desde el 11 de noviembre: el 1 del romano (día 9) no; ninguno lo pasa después.
  assert.deepEqual(logros.map((l) => l.texto), []);
  const h2 = J.estadoJuego([...sesiones, ...['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'].map((k) => ses(k))], { ftp: 200, per, ahora: dia('2026-11-19') });
  const l2 = h2.logros.filter((l) => l.tipo === 'maestria');
  assert.deepEqual(l2.map((l) => [l.texto, l.monedas]), [['Maestría 2 de Romano: Aprendiz', 100]]);
}
