// Etapa 27 (reducida): dolor por zona con ajuste de la semana, monotonía alta y piernas cansadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Pu from '../src/pulso.js';
import * as C from '../src/capacidades.js';
import * as E from '../src/estadisticas.js';
import * as A from '../src/adaptacion.js';

const hoy = new Date('2026-11-23T09:00');
const dia = (n) => E.claveDia(hoy.getTime() - n * 864e5);

test('dolor: la zona cambia el consejo y dos días con molestia en la misma zona dejan la semana suave', () => {
  const una = Pu.efectoPrevio({ sueno: 'bien', dolor: 'leve', zona: 'espalda', dolores: [{ dia: dia(0), dolor: 'leve', zona: 'espalda' }] }, hoy);
  assert.equal(una.clave, 'cargado');
  assert.ok(!una.repetido);
  assert.match(una.motivo, /espalda firme/);
  const dos = Pu.efectoPrevio({ sueno: 'bien', dolor: 'leve', zona: 'espalda', dolores: [{ dia: dia(3), dolor: 'leve', zona: 'espalda' }, { dia: dia(0), dolor: 'leve', zona: 'espalda' }] }, hoy);
  assert.ok(dos.repetido);
  assert.match(dos.motivo, /varios días.*profesional/);
  // Otra zona no se suma.
  assert.ok(!Pu.efectoPrevio({ dolor: 'leve', zona: 'rodillas', dolores: [{ dia: dia(3), dolor: 'leve', zona: 'espalda' }, { dia: dia(0), dolor: 'leve', zona: 'rodillas' }] }, hoy).repetido);
  // Sin responder hoy, la molestia repetida sigue pidiendo suave; si hoy dices que no, manda tu respuesta.
  const dolores = [{ dia: dia(4), dolor: 'leve', zona: 'hombros' }, { dia: dia(2), dolor: 'si', zona: 'hombros' }];
  assert.equal(Pu.efectoPrevio({ dolores }, hoy).clave, 'cargado');
  assert.equal(Pu.efectoPrevio({ dolores, sueno: 'bien', dolor: 'no' }, hoy), null);
  // Más de 7 días atrás ya no cuenta.
  assert.equal(Pu.efectoPrevio({ dolores: [{ dia: dia(9), dolor: 'leve', zona: 'hombros' }, { dia: dia(8), dolor: 'leve', zona: 'hombros' }] }, hoy), null);
  // Lo de antes sigue igual.
  assert.equal(Pu.efectoPrevio({ sueno: 'bien', dolor: 'si', zona: 'rodillas' }, hoy).clave, 'agotado');
  assert.equal(C.estadoCuerpo([], 0, hoy.getTime(), { previo: { dolores } }).clave, 'cargado');
});

test('monotonía: remar igual todos los días la marca; con días suaves o de descanso, no', () => {
  assert.ok(C.monotoniaDe([50, 52, 50, 51, 50, 49, 50]) > 2);
  assert.equal(C.monotoniaDe([80, 0, 40, 0, 90, 30, 0]), null);
  assert.equal(C.monotoniaDe([50, 50, 0, 0, 0, 50, 50]), null, 'menos de 5 días con carga');
});

test('monotonía alta: la suave de hoy pasa a descanso si la semana cabe igual', () => {
  const ent = (nombre, bloques) => ({ nombre, bloques });
  const entrenamientos = [ent('Fondo', [{ duracion: 1800, metrica: 'ftp', min: 60, max: 70 }])];
  const lunes = E.inicioPeriodo(hoy.getTime(), 'semana');
  const programa = { dias: [{ fecha: E.claveDia(hoy.getTime()), ent: 'Fondo' }, { fecha: E.claveDia(lunes + 5 * 864e5), ent: 'Fondo' }] };
  const base = A.sesionDelDia({ programa, entrenamientos, ftp: 160, cuerpo: { clave: 'listo' }, ahora: hoy.getTime() });
  assert.equal(base.ent, 'Fondo');
  const r = A.sesionDelDia({ programa, entrenamientos, ftp: 160, cuerpo: { clave: 'cargado', monotonia: 3.1 }, ahora: hoy.getTime() });
  assert.equal(r.fuente, 'descanso');
  assert.match(r.motivo, /muy pareja/);
});

test('piernas cansadas: misma potencia con más cadencia y menos trabajo por palada', () => {
  const muestras = (cae) => Array.from({ length: 1500 }, (_, k) => {
    const spm = 22 + (cae ? Math.round((6 * k) / 1500) : 0);
    return { t: k + 1, w: 180, spm, dist: k * 4 };
  });
  const s = (cae) => ({ duracion: 1500, muestras: muestras(cae) });
  const p = E.piernasCansadas(s(true));
  assert.ok(p && p.caida >= 10, JSON.stringify(p));
  assert.equal(E.piernasCansadas(s(false)), null);
  // Si bajan los watts no es lo mismo: es cansancio general, no se marca.
  const bajando = { duracion: 1500, muestras: muestras(true).map((x, k) => ({ ...x, w: 180 - Math.round((50 * k) / 1500) })) };
  assert.equal(E.piernasCansadas(bajando), null);
});
