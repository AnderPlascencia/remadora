import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  percentil, crearMuestras, crearBufferPaquetes, datoRecibido, numerosPintados, cuadroPintado,
  reiniciarDiagnostico, resumenDiagnostico, textoDiagnostico, consumoBateria,
} from '../src/diagnostico.js';

test('percentiles: mediana y peor 5 %', () => {
  const l = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentil(l, 50), 50);
  assert.equal(percentil(l, 95), 95);
  assert.equal(percentil([], 50), null);
});

test('las muestras no crecen sin límite y siguen cubriendo toda la sesión', () => {
  const m = crearMuestras(100);
  for (let i = 0; i < 10_000; i++) m.anotar(i);
  assert.ok(m.lista().length < 100);
  assert.equal(m.n, 10_000);
  assert.ok(m.lista().at(-1) > 9_000, 'conserva lo último');
  assert.ok(m.lista()[0] < 1_000, 'y lo primero');
});

test('latencia: cuenta desde el dato más viejo sin pintar hasta que se pintan los números', () => {
  reiniciarDiagnostico();
  datoRecibido(1000);
  datoRecibido(1200); // otro dato antes de pintar: no reinicia la espera
  numerosPintados(1400);
  numerosPintados(1500); // pintar sin dato nuevo no cuenta
  datoRecibido(2000);
  numerosPintados(2100);
  const r = resumenDiagnostico();
  assert.deepEqual(r.latencia, { p50: 100, p95: 400, n: 2 });
});

test('cuadros por segundo por vista, sin contar los huecos de pausa', () => {
  reiniciarDiagnostico();
  for (let i = 0; i < 100; i++) cuadroPintado('3d', i < 95 ? 1000 / 30 : 100);
  cuadroPintado('3d', 5_000);
  const r = resumenDiagnostico({ escrituras: 10, colaMax: 1, lentas: 0, saltadas: 0, msMax: 40 });
  assert.equal(r.fps['3d'].p50, 30);
  assert.equal(r.fps['3d'].p5, 30);
  assert.equal(r.fps['3d'].n, 100);
  assert.equal(r.ble.colaMax, 1);
  assert.equal(textoDiagnostico(r).length, 2); // sin latencia medida: solo cuadros y Bluetooth
});

test('el búfer de paquetes da la vuelta y conserva los más nuevos, en orden', () => {
  const b = crearBufferPaquetes(4);
  for (let i = 0; i < 6; i++) b.anotar(i % 2 ? '<<' : '>>', '1535', new Uint8Array([0xfe, i]), Date.UTC(2026, 0, 1, 10, 0, i));
  assert.equal(b.largo, 4);
  assert.equal(b.total, 6);
  const ps = [...b.paquetes()];
  assert.deepEqual(ps.map((p) => p.datos[1]), [2, 3, 4, 5]);
  assert.equal(ps[1].dir, '<<');
  assert.equal(b.texto().split('\n')[0], '10:00:02.000 >> fe 02');
  assert.equal(b.texto().split('\n')[1], '10:00:03.000 << [1535] fe 03');
});

test('paquetes largos se cortan con marca, y la copia guardada se lee igual', () => {
  const b = crearBufferPaquetes(3);
  b.anotar('<<', '2ad2', new Uint8Array(30).fill(7), 0);
  b.anotar('>>', '1535', new Uint8Array([1, 2, 3]), 1);
  const copia = b.instantanea();
  const leida = crearBufferPaquetes(0, copia);
  assert.equal(leida.texto(), b.texto());
  assert.match(b.texto(), /<< \[otro\] (07 ){21}07 …/);
});

test('el consumo de batería sale por hora y no cuenta si el teléfono cargó o la sesión fue muy corta', () => {
  const t0 = Date.parse('2026-11-23T20:00:00');
  const ini = { nivel: 0.8, t: t0, cargando: false };
  assert.deepEqual(consumoBateria(ini, { nivel: 0.74, t: t0 + 58 * 60e3, cargando: false }), { pct: 6, porHora: 6.2, min: 58 });
  assert.equal(consumoBateria({ ...ini, cargando: true }, { nivel: 0.74, t: t0 + 3600e3, cargando: false }), null, 'cargó al empezar');
  assert.equal(consumoBateria(ini, { nivel: 0.9, t: t0 + 3600e3, cargando: true }), null, 'cargó al terminar');
  assert.equal(consumoBateria(ini, { nivel: 0.79, t: t0 + 5 * 60e3, cargando: false }), null, 'menos de 6 min');
  assert.equal(consumoBateria(null, { nivel: 0.79, t: t0 + 3600e3 }), null, 'sin getBattery');
  assert.deepEqual(textoDiagnostico({ bateria: { pct: 6, porHora: 6.2, min: 58 } }), ['Batería: bajó 6 % en 58 min (6,2 % por hora)']);
});
