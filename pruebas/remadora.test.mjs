// Conexión Bluetooth con la consola (remadora.js) contra un navigator.bluetooth falso:
// saludo inicial, consultas periódicas, cambio de resistencia, datos recibidos, reconexión y modo demo.
import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Remadora } from '../src/remadora.js';
import { VARIANTES } from '../src/variantes.js';
import { SERVICIO_IFIT, CARACT_ESCRITURA, CARACT_NOTIFICACION, SERVICIO_1400, bytesAHex, hexABytes, nivelDesdeByte, paqueteMetricas, paqueteRemada } from '../src/protocolo.js';

const V = VARIANTES.generica;
const CABECERA_RESISTENCIA = 'fe 02 0d 02';

class Caracteristica {
  constructor(uuid, { notify = false } = {}) { this.uuid = uuid; this.properties = { notify }; this.escritos = []; this.oncharacteristicvaluechanged = null; }
  async writeValueWithResponse(bytes) { this.escritos.push(bytesAHex(bytes)); }
  async startNotifications() {}
  emitir(bytes) { this.oncharacteristicvaluechanged?.({ target: { value: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength) } }); }
}

// Remadora falsa: `fallos` es cuántas veces seguidas falla gatt.connect() (Infinity = nunca vuelve).
class Dispositivo extends EventTarget {
  constructor() {
    super();
    this.name = 'I_RW_PRUEBA';
    this.fallos = 0;
    this.conexiones = 0;
    this.escritura = new Caracteristica(CARACT_ESCRITURA);
    this.notificacion = new Caracteristica(CARACT_NOTIFICACION, { notify: true });
    this.diag = new Caracteristica('00001401-555e-e99c-e511-f9f4f8daeb24', { notify: true });
    const disp = this;
    this.gatt = {
      connected: false,
      async connect() {
        disp.conexiones += 1;
        if (disp.fallos > 0) { disp.fallos -= 1; throw new Error('GATT no disponible'); }
        this.connected = true;
        return {
          async getPrimaryService(uuid) {
            if (uuid === SERVICIO_IFIT) return { getCharacteristic: async (c) => (c === CARACT_ESCRITURA ? disp.escritura : disp.notificacion) };
            if (uuid === SERVICIO_1400) return { getCharacteristics: async () => [disp.diag] };
            throw new Error(`servicio ${uuid} no existe`);
          },
        };
      },
      disconnect() { this.connected = false; disp.dispatchEvent(new Event('gattserverdisconnected')); },
    };
  }
  // Se pierde la señal sin que nadie lo pida.
  perderSenal() { this.gatt.connected = false; this.dispatchEvent(new Event('gattserverdisconnected')); }
}

let disp;
let filtros;
let estados;
let datos;
let logs;

// Avanza el reloj falso en pasos cortos y deja correr las promesas entre paso y paso.
async function avanzar(ms, paso = 50) {
  for (let t = 0; t < ms; t += paso) {
    mock.timers.tick(paso);
    await new Promise((r) => setImmediate(r));
  }
}

function nuevaRemadora() {
  const r = new Remadora();
  r.addEventListener('estado', (e) => estados.push(e.detail));
  r.addEventListener('datos', (e) => datos.push(e.detail));
  r.addEventListener('log', (e) => logs.push(e.detail));
  return r;
}

async function conectada() {
  const r = nuevaRemadora();
  const promesa = r.conectar('generica');
  await avanzar(400 * V.init.length + 100);
  await promesa;
  return r;
}

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  disp = new Dispositivo();
  filtros = null;
  estados = [];
  datos = [];
  logs = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { bluetooth: { requestDevice: async (opciones) => { filtros = opciones; return disp; } } },
  });
});

afterEach(() => mock.timers.reset());

test('pide una remadora I_RW con los servicios iFit y 1400', async () => {
  assert.equal(Remadora.soportado(), true);
  await conectada();
  assert.deepEqual(filtros.filters, [{ namePrefix: 'I_RW' }]);
  assert.deepEqual(filtros.optionalServices, [SERVICIO_IFIT, SERVICIO_1400]);
});

test('manda el saludo inicial completo y en orden antes de decir «Conectada»', async () => {
  const r = await conectada();
  assert.deepEqual(disp.escritura.escritos.slice(0, V.init.length), V.init);
  assert.equal(r.conectada, true);
  assert.deepEqual(estados.slice(0, 4), ['Buscando remadora…', 'Conectando…', 'Iniciando comunicación…', 'Conectada']);
});

test('consulta la consola cada 200 ms repitiendo la secuencia de poll', async () => {
  await conectada();
  const antes = disp.escritura.escritos.length;
  await avanzar(200 * V.poll.length * 2);
  const poll = disp.escritura.escritos.slice(antes);
  assert.deepEqual(poll, [...V.poll, ...V.poll]);
});

test('el cambio de resistencia va entre mensajes completos, con su cabecera', async () => {
  const r = await conectada();
  await avanzar(200); // a mitad de un mensaje de 3 paquetes
  r.fijarResistencia(12);
  const antes = disp.escritura.escritos.length;
  await avanzar(200 * 6);
  const escritos = disp.escritura.escritos.slice(antes);
  const i = escritos.indexOf(CABECERA_RESISTENCIA);
  assert.ok(i >= 0, 'no mandó la cabecera de resistencia');
  assert.equal(escritos[i + 1], V.resistencia[11]);
  // Antes de la cabecera se terminó el mensaje en curso: los paquetes previos son un múltiplo de 3 desde el inicio del poll.
  assert.equal((disp.escritura.escritos.length - escritos.length + i - V.init.length) % 3, 0);
});

test('ignora resistencias fuera de 1 a 24', async () => {
  const r = await conectada();
  for (const n of [0, 25, -3, Number.NaN]) r.fijarResistencia(n);
  assert.equal(r.nivelPendiente, null);
  r.fijarResistencia(24.4);
  assert.equal(r.nivelPendiente, 24);
});

test('convierte las notificaciones de la consola en datos y descarta las del servicio de diagnóstico', async () => {
  await conectada();
  disp.notificacion.emitir(paqueteMetricas(180, 1234, 9));
  disp.notificacion.emitir(paqueteRemada(26, 118));
  disp.diag.emitir(paqueteMetricas(999, 1, 1));
  assert.equal(datos.length, 2);
  assert.equal(datos[0].tipo, 'metricas');
  assert.equal(datos[0].watts, 180);
  assert.equal(datos[0].distancia, 1234);
  assert.equal(datos[1].tipo, 'remada');
  assert.equal(datos[1].spm, 26);
});

test('si se pierde la señal reconecta con espera creciente y repite el saludo', async () => {
  await conectada();
  disp.fallos = 2;
  const escritosAntes = disp.escritura.escritos.length;
  disp.perderSenal();
  await avanzar(1000 + 2000 + 3000 + 400 * V.init.length + 200);
  assert.ok(estados.includes('Reconectando (1/5)…'));
  assert.ok(estados.includes('Reconectando (3/5)…'));
  assert.ok(!estados.includes('Reconectando (4/5)…'));
  assert.equal(estados.at(-1), 'Conectada');
  assert.ok(logs.some((l) => l.endsWith('reconectada')));
  assert.deepEqual(disp.escritura.escritos.slice(escritosAntes, escritosAntes + V.init.length), V.init);
});

test('tras 5 reintentos fallidos se rinde y queda desconectada', async () => {
  const r = await conectada();
  disp.fallos = Infinity;
  disp.perderSenal();
  await avanzar((1 + 2 + 3 + 4 + 5) * 1000 + 500);
  assert.equal(disp.conexiones, 1 + 5);
  assert.equal(estados.at(-1), 'Desconectada');
  assert.equal(r.reconectando, false);
  assert.equal(r.conectada, false);
});

test('al desconectar a mano no reintenta y deja de consultar', async () => {
  const r = await conectada();
  r.desconectar();
  const escritos = disp.escritura.escritos.length;
  await avanzar(5000);
  assert.equal(disp.conexiones, 1);
  assert.equal(estados.at(-1), 'Desconectada');
  assert.equal(disp.escritura.escritos.length, escritos);
});

test('el modo demo manda datos cada medio segundo con el mismo formato y se detiene al desconectar', async () => {
  const r = nuevaRemadora();
  r.iniciarDemo();
  assert.equal(estados.at(-1), 'Modo demo');
  await avanzar(2000);
  assert.equal(datos.length, 8, 'dos paquetes (remada y métricas) cada 500 ms');
  assert.ok(datos.filter((d) => d.tipo === 'metricas').every((d) => d.watts > 0));
  r.fijarResistencia(20);
  await avanzar(500);
  assert.equal(datos.at(-1).resistencia, 20);
  r.desconectar();
  const n = datos.length;
  await avanzar(2000);
  assert.equal(datos.length, n);
  assert.equal(r.demoTimer, null);
});

// Cambio de resistencia: tablas de comandos, reconexión, desconexión manual y confirmación de la consola.
test('cada variante tiene 24 comandos de resistencia bien formados y en orden creciente', () => {
  for (const [clave, v] of Object.entries(VARIANTES)) {
    assert.equal(v.resistencia.length, 24, `${clave}: niveles`);
    let anterior = 0;
    v.resistencia.forEach((hex, i) => {
      const b = hexABytes(hex);
      assert.equal(b.length, 20, `${clave} nivel ${i + 1}: largo`);
      assert.deepEqual([...b.slice(0, 9)], [0xff, 0x0d, 0x02, 0x04, 0x02, 0x09, 0x14, 0x09, 0x02], `${clave} nivel ${i + 1}: cabecera`);
      let suma = 0;
      for (let j = 6; j <= 13; j++) suma += b[j];
      assert.equal(suma & 0xff, b[14], `${clave} nivel ${i + 1}: suma de control`);
      const valor = b[11] | (b[12] << 8);
      assert.ok(valor > anterior, `${clave} nivel ${i + 1}: el valor sube con el nivel`);
      anterior = valor;
      // La consola informa el byte alto de ese valor: debe leerse como el mismo nivel.
      assert.equal(nivelDesdeByte(b[12]), i + 1, `${clave} nivel ${i + 1}: lectura de vuelta`);
    });
  }
});

test('manda el comando de su variante para los 24 niveles', async () => {
  const r = await conectada();
  for (let n = 1; n <= 24; n++) {
    assert.equal(r.fijarResistencia(n), true);
    const antes = disp.escritura.escritos.length;
    await avanzar(200 * 3);
    const escritos = disp.escritura.escritos.slice(antes);
    const i = escritos.indexOf(CABECERA_RESISTENCIA);
    assert.ok(i >= 0, `nivel ${n}: sin cabecera`);
    assert.equal(escritos[i + 1], V.resistencia[n - 1], `nivel ${n}: comando`);
  }
});

test('si se pide otro nivel antes de mandarlo, solo va el último', async () => {
  const r = await conectada();
  await avanzar(200);
  r.fijarResistencia(5);
  r.fijarResistencia(14);
  const antes = disp.escritura.escritos.length;
  await avanzar(200 * 6);
  const escritos = disp.escritura.escritos.slice(antes);
  assert.equal(escritos.filter((h) => h === CABECERA_RESISTENCIA).length, 1);
  assert.ok(escritos.includes(V.resistencia[13]));
  assert.ok(!escritos.includes(V.resistencia[4]));
});

test('sin conexión no acepta la resistencia', () => {
  const r = nuevaRemadora();
  assert.equal(r.fijarResistencia(10), false);
  assert.equal(r.nivelPendiente, null);
});

test('un cambio pedido durante la reconexión se manda al volver', async () => {
  const r = await conectada();
  disp.fallos = 1;
  disp.perderSenal();
  await avanzar(500);
  assert.equal(r.conectada, false);
  assert.equal(r.fijarResistencia(16), true);
  const antes = disp.escritura.escritos.length;
  await avanzar(1000 + 2000 + 400 * V.init.length + 200 * 6);
  const escritos = disp.escritura.escritos.slice(antes);
  const i = escritos.indexOf(CABECERA_RESISTENCIA);
  assert.ok(i >= V.init.length, 'se manda después del saludo, no en medio');
  assert.equal(escritos[i + 1], V.resistencia[15]);
});

test('al desconectar a mano se olvida el cambio pendiente', async () => {
  const r = await conectada();
  r.fijarResistencia(9);
  r.desconectar();
  assert.equal(r.nivelPendiente, null);
});

test('esperarResistencia confirma cuando la consola informa el nivel pedido y falla si no llega', async () => {
  const r = await conectada();
  const ok = r.esperarResistencia(12, 4000);
  disp.notificacion.emitir(paqueteMetricas(150, 100, 11));
  disp.notificacion.emitir(paqueteMetricas(150, 110, 12));
  assert.equal(await ok, true);
  const no = r.esperarResistencia(20, 4000);
  disp.notificacion.emitir(paqueteMetricas(150, 120, 12));
  await avanzar(4100);
  assert.equal(await no, false);
});
