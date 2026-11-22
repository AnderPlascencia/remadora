// Tarjetas de la semana y del mes (etapa 31): cambio honesto, equivalencias, mejoras y logros.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Tp from '../src/tarjeta-periodo.js';

const DIA = 864e5;
const lunes = new Date('2026-11-16T00:00').getTime();
const ses = (fecha, distancia, duracion, extra = {}) => ({ fecha, distancia, duracion, kcal: Math.round(duracion / 6), muestras: [], ...extra });

test('rango de fechas y periodo anterior', () => {
  assert.equal(Tp.textoRango(lunes, 'semana'), 'Semana del 16 al 22 de noviembre');
  assert.equal(Tp.textoRango(new Date('2026-11-30T00:00').getTime(), 'semana'), 'Semana del 30 de noviembre al 6 de diciembre');
  assert.equal(Tp.textoRango(new Date('2026-11-01T00:00').getTime(), 'mes'), 'Noviembre de 2026');
  assert.equal(Tp.periodoAnterior(lunes, 'semana'), lunes - 7 * DIA);
  assert.equal(new Date(Tp.periodoAnterior(new Date('2026-11-01T00:00').getTime(), 'mes')).getMonth(), 9);
});

test('qué periodo se ofrece: el que acaba de terminar los lunes y martes, si tuvo remo', () => {
  const lista = [ses(lunes + 2 * DIA, 5000, 1500)];
  const lunesSig = lunes + 7 * DIA + 10 * 3600e3;
  assert.equal(Tp.periodoSugerido(lista, 'semana', lunesSig), lunes, 'el lunes, la semana pasada');
  assert.equal(Tp.periodoSugerido(lista, 'semana', lunes + 4 * DIA), lunes, 'el viernes, esta');
  assert.equal(Tp.periodoSugerido([ses(lunesSig, 5000, 1500)], 'semana', lunesSig + 3600e3), lunes + 7 * DIA, 'sin remo la pasada, esta');
});

test('equivalencias: lugar igual, cuenta redonda o «más que»', () => {
  assert.equal(Tp.equivalenciaPeriodo(28600).texto, 'Como cruzar el Estrecho de Gibraltar 2 veces');
  assert.equal(Tp.equivalenciaPeriodo(28600).detalle, 'El Estrecho de Gibraltar mide 14.3 km');
  assert.equal(Tp.equivalenciaPeriodo(96300).texto, 'Más que el Canal de Panamá de punta a punta');
  assert.equal(Tp.equivalenciaPeriodo(50), null);
});

test('cambio honesto: verde si sube, gris si baja, «de regreso» si no hubo nada antes', () => {
  const antes = [ses(lunes - 5 * DIA, 10000, 3000), ses(lunes - 3 * DIA, 10000, 3000)];
  const sube = Tp.contenidoPeriodo([...antes, ses(lunes + DIA, 15000, 4000), ses(lunes + 3 * DIA, 10000, 3000)], 'semana', lunes, {}, { ahora: lunes + 8 * DIA });
  assert.equal(sube.km, '25.0');
  assert.equal(sube.cambio, '+25 %');
  assert.equal(sube.antes, 'vs. 20.0 km la semana pasada');
  assert.deepEqual(sube.fichas[1], ['1,167', 'kcal', 'Calorías estimadas', '+17 %']);
  const baja = Tp.contenidoPeriodo([...antes, ses(lunes + DIA, 8000, 2400)], 'semana', lunes);
  assert.equal(baja.cambio, null, 'nada en rojo');
  assert.equal(baja.antes, 'vs. 20.0 km la semana pasada');
  assert.ok(baja.fichas.every(([, , , d]) => !d), 'sin cambios que bajan');
  const regreso = Tp.contenidoPeriodo([ses(lunes - 30 * DIA, 5000, 1500), ses(lunes + DIA, 5000, 1500)], 'semana', lunes);
  assert.equal(regreso.antes, 'Semana de regreso');
  assert.equal(Tp.contenidoPeriodo([ses(lunes + DIA, 5000, 1500)], 'semana', lunes).antes, 'Su primera semana en Rower');
  assert.equal(Tp.contenidoPeriodo([ses(lunes + DIA, 5000, 1500)], 'semana', lunes, { kcal: false }).fichas.find((f) => f[1] === 'kcal'), undefined, 'calorías apagables');
});

test('plan cumplido sin contar lo que aún no toca, y la gráfica de 8 semanas con su promedio', () => {
  const estados = [
    { fecha: '2026-11-16', ent: 'Fondo', estado: 'hecho' }, { fecha: '2026-11-18', ent: 'Umbral', estado: 'hecho' },
    { fecha: '2026-11-21', ent: 'Fondo', estado: 'pendiente' }, { fecha: '2026-11-23', ent: 'Fondo', estado: 'pendiente' },
  ];
  assert.deepEqual(Tp.planDelPeriodo(estados, lunes, lunes + 7 * DIA), { hechas: 2, total: 2 });
  const lista = [0, 1, 2, 3, 4].map((i) => ses(lunes - i * 7 * DIA + DIA, 10000 + i * 1000, 3000));
  const c = Tp.contenidoPeriodo(lista, 'semana', lunes, {}, { estados, ahora: lunes + 3 * DIA });
  assert.equal(c.estado, '2 de 2 sesiones del plan');
  assert.equal(c.kicker, '', 'la semana sigue abierta: aún no «completa»');
  assert.equal(c.historia.barras.length, 8);
  assert.deepEqual(c.historia.barras.at(-1), ['16 nov', 10]);
  assert.equal(c.historia.prom, (11 + 12 + 13 + 14) / 4);
});

test('el mes: lo que mejoró solo con marcas comparables', () => {
  const nov = new Date('2026-11-01T00:00').getTime();
  const tramo = (seg, metros) => Array.from({ length: seg + 1 }, (_, t) => ({ t, w: 200, dist: Math.round((t * metros) / seg) }));
  const lista = [
    ses(nov - 20 * DIA, 2000, 468, { muestras: tramo(468, 2000) }),
    ses(nov + 5 * DIA, 2000, 462, { muestras: tramo(462, 2000) }),
    ses(nov - 25 * DIA, 0, 1200, { pruebaWatts: 220, entrenamiento: 'Prueba FTP 20 min' }),
    ses(nov + 10 * DIA, 0, 1200, { pruebaWatts: 230, entrenamiento: 'Prueba FTP 20 min' }),
  ];
  const av = Tp.avancesDelMes(lista, nov, Tp.finPeriodo(nov, 'mes'));
  assert.deepEqual(av[0], ['Mejor 2000 m', '7:48', '7:42', '−6 s']);
  assert.deepEqual(av[1], ['Ritmo de una hora', '209 W', '219 W', '+5 %']);
  assert.deepEqual(Tp.avancesDelMes(lista.slice(1, 2), nov, Tp.finPeriodo(nov, 'mes')), [], 'sin marca de antes, no se presume');
});

test('logros: récords, jefe, nivel y racha, hasta 3 y en orden', () => {
  const tramo = (seg) => Array.from({ length: seg + 1 }, (_, t) => ({ t, w: 200, dist: Math.round((t * 2000) / seg) }));
  const lista = [
    ses(lunes - 14 * DIA, 2000, 470, { muestras: tramo(470) }),
    ses(lunes - 7 * DIA, 3000, 900),
    ses(lunes + DIA, 2000, 465, { muestras: tramo(465) }),
  ];
  const juego = { porSesion: new Map([[lunes + DIA, { xp: 300, nivelAntes: 11, nivelDespues: 12, jefe: { nombre: 'El Kraken' } }]]) };
  const l = Tp.logrosDelPeriodo(lista, lunes, lunes + 7 * DIA, { juego });
  assert.deepEqual(l.map((x) => x.texto), ['Récord en 2000 m: 7:45 y 1 más', 'Venció al Kraken', 'Subió al nivel 12']);
  assert.equal(l[2].juego, true, 'lo del juego, en turquesa');
  const c = Tp.contenidoPeriodo(lista, 'semana', lunes, {}, { juego, heroe: { nombre: 'Ander' } });
  assert.equal(c.heroe.xp, 300);
  assert.equal(Tp.contenidoPeriodo(lista, 'semana', lunes, { heroe: false }, { juego, heroe: { nombre: 'Ander' } }).heroe, null);
});
