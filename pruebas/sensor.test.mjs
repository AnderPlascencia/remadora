// Sensor fiable (0.80): vigilante «la consola no responde», reconexión sin rendirse durante una sesión, límite de
// gatt.connect(), reconexión de la banda de pulso y reproducción de sesiones grabadas.
import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Remadora, BandaCardiaca, SIN_DATOS_MS, CONEXION_MAX_MS } from '../src/remadora.js';
import { VARIANTES } from '../src/variantes.js';
import { paqueteMetricas, paqueteRemada, parsePaquete } from '../src/protocolo.js';
import { paquetesDeTexto } from '../src/diagnostico.js';
import { BandaFalsa, Dispositivo, avanzar, reproducir } from './ble-falso.mjs';

const SALUDO_MS = 400 * VARIANTES.generica.init.length;
let disp;
let estados;
let datos;
let logs;

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 });
  disp = new Dispositivo();
  estados = [];
  datos = [];
  logs = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { bluetooth: { requestDevice: async () => disp } } });
});
afterEach(() => mock.timers.reset());

async function conectada({ sesion = false } = {}) {
  const r = new Remadora();
  r.debeMantener = () => sesion;
  r.addEventListener('estado', (e) => estados.push(e.detail));
  r.addEventListener('datos', (e) => datos.push(e.detail));
  r.addEventListener('log', (e) => logs.push(e.detail));
  const p = r.conectar('generica');
  await avanzar(SALUDO_MS + 100);
  await p;
  return r;
}
const remar = (w = 150) => { disp.notificacion.emitir(paqueteRemada(24, 120)); disp.notificacion.emitir(paqueteMetricas(w, 100, 8)); };

test('si la consola calla 4 s mientras remas, dice que no responde y reconecta sola', async () => {
  await conectada();
  remar();
  await avanzar(SIN_DATOS_MS - 1000);
  assert.ok(!estados.includes('La consola no responde'), 'aún no');
  await avanzar(2000);
  assert.ok(estados.includes('La consola no responde'));
  assert.ok(logs.some((l) => /la consola no responde: \d s sin datos/.test(l)));
  await avanzar(1000 + SALUDO_MS + 200);
  assert.equal(estados.at(-1), 'Conectada');
  assert.equal(disp.conexiones, 2);
});

test('con la remadora quieta, el silencio de la consola no dispara el vigilante', async () => {
  await conectada();
  disp.notificacion.emitir(paqueteMetricas(0, 100, 8));
  await avanzar(20_000);
  assert.ok(!estados.includes('La consola no responde'));
  assert.equal(disp.conexiones, 1);
});

test('con una sesión en marcha la reconexión no se rinde, y vuelve en cuanto la consola responde', async () => {
  const r = await conectada({ sesion: true });
  disp.fallos = Infinity;
  disp.perderSenal();
  await avanzar(60_000);
  assert.ok(disp.conexiones > 1 + 5, `${disp.conexiones} intentos`);
  assert.equal(r.reconectando, true);
  assert.match(estados.at(-1), /^Reconectando \(intento \d+\)…$/);
  // La espera entre intentos no pasa de 5 s.
  const antes = disp.conexiones;
  await avanzar(10_000);
  assert.ok(disp.conexiones - antes >= 2);
  disp.fallos = 0;
  await avanzar(5_000 + SALUDO_MS + 200);
  assert.equal(estados.at(-1), 'Conectada');
});

test('un gatt.connect() que no vuelve se corta a los 10 s y se reintenta', async () => {
  await conectada();
  disp.colgado = true;
  disp.perderSenal();
  await avanzar(1000 + CONEXION_MAX_MS + 100);
  assert.ok(logs.some((l) => /reintento 1 falló: gatt\.connect: sin respuesta en 10 s/.test(l)), logs.join('\n'));
  disp.colgado = false;
  await avanzar(2000 + SALUDO_MS + 200);
  assert.equal(estados.at(-1), 'Conectada');
});

test('la banda de pulso reconecta sola si se corta, y manda 0 mientras tanto', async () => {
  const hr = new BandaFalsa();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { bluetooth: { requestDevice: async () => hr } } });
  const banda = new BandaCardiaca();
  banda.debeMantener = () => true;
  const fc = [];
  const log = [];
  banda.addEventListener('fc', (e) => fc.push(e.detail));
  banda.addEventListener('log', (e) => log.push(e.detail));
  assert.equal(await banda.conectar(), 'HRM_PRUEBA');
  hr.latido(120);
  hr.fallos = 7;
  hr.perderSenal();
  assert.equal(fc.at(-1), 0);
  await avanzar(45_000);
  assert.equal(hr.conexiones, 1 + 8, 'siguió intentando pasados los 5 reintentos');
  hr.latido(131);
  assert.deepEqual(fc, [120, 0, 131]);
  assert.ok(log.some((l) => l === 'banda: reconectada (intento 8)'));
  // Al desconectarla a mano no reintenta.
  banda.desconectar();
  await avanzar(10_000);
  assert.equal(hr.conexiones, 9);
});

test('reproducir una grabación con un corte: llegan los mismos datos, el vigilante actúa y la sesión sigue', async () => {
  const grabacion = paquetesDeTexto(readFileSync(new URL('./grabaciones/sintetica-corte.txt', import.meta.url), 'utf8'));
  assert.equal(grabacion.length, 200);
  await conectada({ sesion: true });
  const llegan = reproducir(disp, grabacion);
  await avanzar(60_000);
  // Cada paquete grabado se decodifica igual que en la grabación (watts, metros y golpes).
  assert.deepEqual(datos.slice(-llegan.length), llegan.map((p) => parsePaquete(p.datos)));
  // En los 7 s sin datos la app no espera a Chrome: dice que la consola no responde y reconecta.
  assert.ok(estados.includes('La consola no responde'));
  assert.equal(estados.at(-1), 'Conectada');
  assert.equal(disp.conexiones, 2);
});
