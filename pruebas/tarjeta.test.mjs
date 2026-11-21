// La imagen compartida (etapa 15): dato protagonista, línea honesta y lo que se enseña por defecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Tj from '../src/tarjeta.js';

const muestras = (n, w = 150) => Array.from({ length: n }, (_, t) => ({ t, w: t >= 100 && t < 160 ? 260 : w, spm: 24, split: 120, dist: t * 4, fc: 140 }));
const base = { fecha: new Date('2026-11-18T19:00').getTime(), distancia: 6200, duracion: 1500, splitProm: 121, wattsProm: 160, spmProm: 24, fcProm: 142, kcal: 310, muestras: muestras(1500) };

test('formatos y lo que sale por defecto: pulso y calorías apagados, héroe encendido', () => {
  assert.deepEqual(Tj.FORMATOS['9:16'], [1080, 1920]);
  assert.deepEqual(Tj.FORMATOS['4:5'], [1080, 1350]);
  assert.deepEqual(Tj.FORMATOS['1:1'], [1080, 1080]);
  assert.equal(Tj.OPCIONES_DEFECTO.pulso, false);
  assert.equal(Tj.OPCIONES_DEFECTO.kcal, false);
  const c = Tj.contenidoTarjeta(base, {}, { heroe: 'Ander · Jarl' });
  const etqs = c.secundarios.map(([e]) => e);
  assert.ok(!etqs.includes('Pulso prom') && !etqs.includes('Calorías'));
  assert.equal(c.heroe, 'Ander · Jarl');
  const todo = Tj.contenidoTarjeta(base, { pulso: true, kcal: true, heroe: false }, { heroe: 'Ander · Jarl' });
  assert.deepEqual(todo.secundarios.slice(-2), [['Pulso prom', '142 lpm'], ['Calorías', '310 kcal']]);
  assert.equal(todo.heroe, null);
});

test('línea honesta: completado, a medias, versión corta o nada en remo libre', () => {
  assert.equal(Tj.estadoSesion(base), null, 'remo libre');
  const plan = { ...base, entrenamiento: 'Fondo 25', bloques: [{ duracion: 1500 }] };
  assert.deepEqual(Tj.estadoSesion({ ...plan, tiempoMeta: 1500 }), { texto: '✓ Completado', completo: true });
  assert.deepEqual(Tj.estadoSesion({ ...plan, duracion: 120, bloques: [{ duracion: 120 }, { duracion: 1380 }] }), { texto: '2 de 25 min', completo: false });
  assert.equal(Tj.estadoSesion({ ...plan, tiempoMeta: 900, versionCorta: 15 }).texto, '✓ Versión corta de 15 min');
  assert.equal(Tj.estadoSesion({ ...plan, duracion: 600, versionCorta: 15 }).texto, '10 de 15 min · versión corta');
  assert.equal(Tj.estadoSesion({ ...plan, bloques: null }).texto, 'Sin terminar');
});

test('dato protagonista según la sesión', () => {
  assert.deepEqual(Tj.protagonista(base), { clave: 'distancia', etq: 'Distancia', valor: '6.20 km' });
  const k2 = { ...base, tipoPlan: 'prueba', distancia: 2000, duracion: 452 };
  assert.deepEqual(Tj.protagonista(k2), { clave: 'tiempo', etq: 'Prueba de 2000 m', valor: '7:32' });
  const c2k = Tj.contenidoTarjeta(k2);
  assert.equal(c2k.secundarios[0][0], 'Split /500 m', 'con la prueba de 2000 m, el split va primero');
  assert.ok(!c2k.secundarios.some(([e]) => e === 'Tiempo'), 'no repite el protagonista');
  const int = { ...base, entrenamiento: '6 × 1 min', bloques: [{ duracion: 60 }, { duracion: 60 }], pctEnRango: 84 };
  assert.equal(Tj.protagonista(int).valor, '84 %');
  assert.deepEqual(Tj.contenidoTarjeta(int).secundarios.find(([e]) => e === 'Mejor minuto'), ['Mejor minuto', '260 W']);
  const rec = [{ clave: 'w1', nombre: 'Potencia 1 min', tipo: 'valor', unidad: 'W', valor: 260 }, { clave: 't2000', nombre: 'Mejor 2000 m', tipo: 'tiempo', valor: 470 }];
  assert.deepEqual(Tj.protagonista(base, rec), { clave: 'record:t2000', etq: 'Récord · Mejor 2000 m', valor: '7:50' });
  assert.equal(Tj.contenidoTarjeta({ ...base, entrenamiento: null }).titulo, 'Remo libre');
  assert.equal(Tj.contenidoTarjeta(base).secundarios.length, 3);
});

test('semana del plan: «Semana 2 de 3 · sesión 2 de 3»', () => {
  const dias = ['2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23'].map((fecha) => ({ fecha, ent: 'Fondo' }));
  assert.equal(Tj.semanaDelPlan({ dias }, base.fecha), 'Semana 2 de 3 · sesión 2 de 3');
  assert.equal(Tj.semanaDelPlan({ dias }, new Date('2026-12-20T12:00').getTime()), null, 'fuera del plan');
  assert.equal(Tj.semanaDelPlan(null, base.fecha), null);
});
