// ⚖ Ganarte a ti mismo (ronda 2, R2-6 y R2-7): tu yo pasado y el reto dan premio, y la mejora real pesa más.
// Todo desde GANARTE_DESDE: lo remado antes se cuenta con las reglas de antes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as GA from '../src/ganarte.js';
import { hitoDe } from '../src/hitos.js';
import { TIPOS, simular } from './sim-curva.mjs';

const D = 864e5;
const JUEVES = new Date('2026-11-26T19:00').getTime(); // el día del corte
const ANTES = new Date('2026-11-25T19:00').getTime();
const pasado = (diferencia, extra = {}) => ({ nombre: 'Tu yo de hace 7 semanas', clave: 'pasado', fecha: new Date('2026-10-08T19:00').getTime(), diferencia, ...extra });
const fondo = (fecha, extra = {}) => TIPOS.fondo30(fecha, extra, 200);
const juego = (ses) => J.estadoJuego(ses, { ftp: 200, per: {}, ahora: ses.at(-1).fecha + 36e5, calendario: null });
const deTipo = (h, tipo) => h.logros.filter((l) => l.tipo === tipo);

test('ganarle a tu yo de hace 7 semanas: +60 XP, una vez por semana y solo desde el corte', () => {
  const h = juego([fondo(JUEVES, { referencias: [pasado(42)] })]);
  const yo = deTipo(h, 'yo');
  assert.equal(yo.length, 1);
  assert.equal(yo[0].xp, GA.XP_YO_PASADO);
  assert.match(yo[0].texto, /^Le ganaste a tu yo del 8 de octubre por 42 m$/);
  // La segunda de la misma semana no paga; la de la semana siguiente sí.
  const tres = juego([JUEVES, JUEVES + D, JUEVES + 7 * D].map((f) => fondo(f, { referencias: [pasado(10)] })));
  assert.equal(deTipo(tres, 'yo').length, 2);
  // Antes del corte, perder, o no terminar la sesión: nada.
  assert.equal(deTipo(juego([fondo(ANTES, { referencias: [pasado(42)] })]), 'yo').length, 0);
  assert.equal(deTipo(juego([fondo(JUEVES, { referencias: [pasado(-5)] })]), 'yo').length, 0);
  assert.equal(deTipo(juego([fondo(JUEVES, { tiempoMeta: null, referencias: [pasado(42)] })]), 'yo').length, 0);
  // Las sesiones guardadas sin `clave` se reconocen por el nombre.
  assert.equal(deTipo(juego([fondo(JUEVES, { referencias: [pasado(42, { clave: undefined })] })]), 'yo').length, 1);
});

test('misión «Más que tu yo pasado»: con plan ocupa el lugar del rival; sin sesión de hace 6 a 8 semanas no sale', () => {
  const lunes = '2026-11-30';
  const ids = (rit) => J.misionesDeSemana(lunes, 'vikingo', rit).map((m) => m.clave);
  const rit = { sesSemana: 3, conPlan: true, pasado: true };
  assert.ok(ids(rit).includes('yopasado'));
  assert.ok(!ids(rit).includes('rival'));
  assert.ok(!ids({ ...rit, pasado: false }).includes('yopasado'));
  assert.ok(!J.misionesDeSemana('2026-11-23', 'vikingo', rit).some((m) => m.clave === 'yopasado'), 'la semana del corte sigue igual');
  // Sin plan, una semana sí y otra no.
  const libres = ['2026-11-30', '2026-12-07'].map((l) => J.misionesDeSemana(l, 'vikingo', { ...rit, conPlan: false }).some((m) => m.clave === 'yopasado'));
  assert.deepEqual(libres.sort(), [false, true]);
  // hayYoPasado: una sesión de hace 5 a 8 semanas del mismo entrenamiento que alguna reciente.
  const desde = new Date('2026-11-30T00:00').getTime();
  const viejas = [fondo(desde - 49 * D), fondo(desde - 3 * D)];
  assert.equal(GA.hayYoPasado(viejas, desde), true);
  assert.equal(GA.hayYoPasado([fondo(desde - 49 * D), TIPOS.umbral(desde - 3 * D, {}, 200)], desde), false);
});

test('la misión semanal se cumple ganándole a tu yo pasado', () => {
  // 7 semanas de fondos (lunes y jueves) y, la semana del 30 de noviembre, uno contra «Yo hace 7 semanas».
  const inicio = new Date('2026-10-12T19:00').getTime();
  const ses = Array.from({ length: 14 }, (_, i) => fondo(inicio + (Math.floor(i / 2) * 7 + (i % 2) * 3) * D));
  ses.push(fondo(new Date('2026-12-01T19:00').getTime(), { referencias: [pasado(30)] }));
  const h = J.estadoJuego(ses, { ftp: 200, per: {}, ahora: new Date('2026-12-02T12:00').getTime(), calendario: null });
  const m = h.semanales.find((x) => x.clave === 'yopasado');
  assert.ok(m, JSON.stringify(h.semanales.map((x) => x.clave)));
  assert.equal(m.hecha, true);
});

test('reto recibido: el logro «Primer reto aceptado» sin XP, y la tarjeta dice por cuánto ganaste', () => {
  const reto = (extra) => ({ nombre: 'Reto de Ana', clave: 'reto', fecha: null, diferencia: 12, ...extra });
  const h = juego([fondo(JUEVES, { referencias: [reto({ segundos: 4 })] })]);
  const logro = h.hazanas.find((x) => x.id === 'reto1');
  assert.equal(logro.hecha, true);
  assert.equal(h.logros.find((l) => l.texto === 'Logro: Primer reto aceptado').xp, 0);
  // Perderlo también es aceptarlo; antes del corte no cuenta.
  assert.equal(juego([fondo(JUEVES, { referencias: [reto({ diferencia: -30, segundos: -6 })] })]).hazanas.find((x) => x.id === 'reto1').hecha, true);
  assert.equal(juego([fondo(ANTES, { referencias: [reto({ segundos: 4 })] })]).hazanas.find((x) => x.id === 'reto1').hecha, false);
  // Con segundos manda el tiempo: llegar 3 s después es perder aunque al final remaras más metros.
  assert.equal(GA.retoRemado(fondo(JUEVES, { referencias: [reto({ segundos: -3 })] })).gano, false);
  const hito = hitoDe({ sesion: fondo(JUEVES, { referencias: [reto({ segundos: 4 })] }) });
  assert.deepEqual([hito.clave, hito.kicker, hito.texto], ['reto', 'RETO GANADO', 'Le ganó a Ana por 4 s']);
  assert.match(hito.boton, /Devuélvele el reto/);
  assert.equal(hitoDe({ sesion: fondo(JUEVES, { referencias: [pasado(42)] }) }).clave, 'pasado');
  assert.equal(hitoDe({ sesion: fondo(ANTES, { referencias: [reto({ segundos: 4 })] }) }), null);
});

test('mejora real: 1000 m, 500 m y eFTP cuentan, y paga 600 XP desde el corte', () => {
  const conTiempos = (t) => ({ muestras: [], res: { n: 1, t } });
  assert.match(GA.mejoraRealGanarte({ ...conTiempos({ 1000: 200 }) }, { t1000: 205 }, null), /1000 m un 2 % más rápido/);
  assert.match(GA.mejoraRealGanarte({ ...conTiempos({ 500: 90 }) }, { t500: 92 }, null), /500 m un 2 % más rápido/);
  assert.equal(GA.mejoraRealGanarte({ ...conTiempos({ 500: 91 }) }, { t500: 92 }, null), null);
  // eFTP: un 2 % sobre el de hace 6 semanas, con una sesión que lo empuja.
  const fuerte = { duracion: 1800, res: { n: 1800, w: { 1200: 200 } } };
  assert.match(GA.mejoraRealGanarte(fuerte, { eftpBase: 186 }, 190), /FTP estimado subió a 190 W/);
  assert.equal(GA.mejoraRealGanarte(fuerte, { eftpBase: 187 }, 190), null);
  assert.equal(GA.mejoraRealGanarte({ ...fuerte, res: { n: 1800, w: { 1200: 150 } } }, { eftpBase: 186 }, 190), null, 'una sesión suave no se lleva el premio');
  // En el juego: un 2000 m un 2 % más rápido paga 600 XP desde el corte (antes, 250).
  const dosMil = (fecha, seg) => ({ ...fondo(fecha), muestras: Array.from({ length: seg + 1 }, (_, t) => ({ t, w: 200, spm: 28, dist: (t * 2000) / seg })), duracion: seg, distancia: 2000 });
  const premios = (f) => juego([dosMil(f - 7 * D, 480), dosMil(f, 470)]).logros.filter((l) => l.tipo === 'mejora').map((l) => l.xp);
  assert.deepEqual(premios(JUEVES), [GA.XP_MEJORA_REAL_GANARTE]);
  assert.deepEqual(premios(ANTES), [J.XP_MEJORA_REAL]);
  // eftpEn: mediana de las 3 mejores de los últimos 90 días.
  const lista = [{ fecha: 0, w: 300 }, { fecha: 100 * D, w: 180 }, { fecha: 101 * D, w: 190 }, { fecha: 102 * D, w: 200 }];
  assert.equal(GA.eftpEn(lista, 102 * D), 190);
  assert.equal(GA.eftpEn(lista, 101 * D), null, 'con menos de 3 sesiones no hay eFTP');
});

test('escalera de fuerza: cada 5 W paga, y lo que ya pagaron los logros de +10 W no se cobra otra vez', () => {
  // +12 W antes del corte (gana «Más fuerte», +10 W) y +16 W después: solo paga el escalón de 15 W.
  const ses = [fondo(ANTES - 2 * D), fondo(ANTES - D, {}), fondo(JUEVES)];
  ses[0].ftp = 200; ses[1].ftp = 212; ses[2].ftp = 216;
  const h = juego(ses);
  assert.ok(h.hazanas.find((x) => x.id === 'ftp10')?.hecha, 'quien lo tiene lo conserva');
  assert.deepEqual(h.logros.filter((l) => /^Escalera/.test(l.texto)).map((l) => l.texto), ['Escalera de fuerza: tu FTP sube 15 W desde tu primera sesión con FTP']);
  assert.deepEqual([h.escaleraFtp.mejora, h.escaleraFtp.siguiente], [16, 20]);
  // Sin el logro de antes (+7 W), el escalón de 5 W sí se paga.
  ses[1].ftp = 207;
  assert.equal(juego(ses).logros.filter((l) => /^Escalera/.test(l.texto)).length, 3);
});

// R2-7: la métrica de la simulación (plan4, 2 años): de 3 premios por mejora a 8–12.
test('simulación de 2 años: entre 8 y 12 premios por mejora con plan4', () => {
  const { h } = simular('plan4');
  const n = h.logros.filter((l) => l.tipo === 'mejora').length;
  assert.ok(n >= 8 && n <= 12, `${n} premios`);
});
