// «Rema contra mí»: la sesión va y vuelve por el enlace sin perder el ritmo, y un enlace roto no entra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fantasma.js';

// 45 min con un ritmo que cambia: 3,5 m/s y un tramo a 4,5 m/s.
const muestras = [];
let dist = 0;
for (let t = 1; t <= 2700; t++) { dist += t > 1200 && t <= 1500 ? 4.5 : 3.5; muestras.push({ t, dist: Math.round(dist * 10) / 10, w: 180, spm: 24, fc: 150 }); }
const sesion = { fecha: Date.parse('2026-11-23T20:00:00'), duracion: 2700, distancia: Math.round(dist), entrenamiento: 'Fondo 45 min (zona 2)', muestras };

test('ida y vuelta: misma distancia, mismo entrenamiento y la misma posición a cada minuto', () => {
  const url = R.enlaceReto('https://ejemplo.github.io/remadora/?atajo=hoy#x', sesion, 'Ander');
  assert.ok(url.startsWith('https://ejemplo.github.io/remadora/?reto='), url);
  assert.ok(url.length < 2000, `enlace de ${url.length} caracteres`);
  const r = R.decodificarReto(new URL(url).searchParams.get(R.PARAM_RETO));
  assert.equal(r.nombre, 'Ander');
  assert.equal(r.ent, 'Fondo 45 min (zona 2)');
  assert.equal(r.duracion, 2700);
  assert.ok(Math.abs(r.distancia - dist) <= 1);
  assert.equal(r.muestras.length, 2700);
  assert.equal(r.muestras.at(-1).t, 2700);
  for (let t = 60; t <= 2700; t += 60) assert.ok(Math.abs(r.muestras[t - 1].dist - muestras[t - 1].dist) <= 1.5, `segundo ${t}`);
  // No viaja nada más: ni pulso ni watts.
  assert.ok(r.muestras.every((m) => Object.keys(m).join() === 't,dist'));
});

test('un enlace dañado, de otra versión o con números raros no entra', () => {
  const bueno = R.codificarReto(sesion, 'A');
  assert.equal(R.decodificarReto(bueno.slice(0, -10)), null);
  assert.equal(R.decodificarReto('no-es-un-reto'), null);
  assert.equal(R.decodificarReto(''), null);
  const raro = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(R.decodificarReto(raro({ v: 2, T: 60, d: [10, 10, 10, 10, 10, 10] })), null, 'otra versión');
  assert.equal(R.decodificarReto(raro({ v: 1, T: 60, d: [10, 10, 10] })), null, 'faltan puntos');
  assert.equal(R.decodificarReto(raro({ v: 1, T: 60, d: [10, 10, 10, 10, 10, 500] })), null, '50 m/s');
  assert.equal(R.decodificarReto(raro({ v: 1, T: 20000, d: [] })), null, 'demasiado larga');
  assert.ok(R.decodificarReto(raro({ v: 1, T: 60, d: [30, 30, 30, 30, 30, 30] })), 'uno mínimo sí entra');
});

test('sesiones muy cortas o sin muestras no dan enlace; el texto invita sin datos de más', () => {
  assert.equal(R.codificarReto({ ...sesion, duracion: 30, muestras: muestras.slice(0, 30) }), null);
  assert.equal(R.codificarReto({ ...sesion, muestras: [] }), null);
  assert.match(R.textoReto(sesion, 'Ander'), /^Ander te reta: remé 9,750 m en 45 min en «Fondo 45 min \(zona 2\)»/);
  assert.match(R.textoReto(sesion), /^Te reto: /);
});
