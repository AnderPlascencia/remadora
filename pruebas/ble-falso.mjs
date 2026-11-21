// Bluetooth falso para las pruebas: una remadora I_RW (servicio iFit y 1400) y el reloj simulado de node:test.
import { mock } from 'node:test';
import { CARACT_ESCRITURA, CARACT_NOTIFICACION, SERVICIO_IFIT, SERVICIO_1400, bytesAHex } from '../src/protocolo.js';

export class Caracteristica {
  constructor(uuid, { notify = false } = {}) { this.uuid = uuid; this.properties = { notify }; this.escritos = []; this.oncharacteristicvaluechanged = null; }
  async writeValueWithResponse(bytes) { this.escritos.push(bytesAHex(bytes)); }
  async startNotifications() {}
  emitir(bytes) { this.oncharacteristicvaluechanged?.({ target: { value: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength) } }); }
}

// Remadora falsa: `fallos` es cuántas veces seguidas falla gatt.connect() (Infinity = nunca vuelve).
export class Dispositivo extends EventTarget {
  constructor() {
    super();
    this.name = 'I_RW_PRUEBA';
    this.fallos = 0;
    this.colgado = false; // gatt.connect() no vuelve nunca
    this.conexiones = 0;
    this.escritura = new Caracteristica(CARACT_ESCRITURA);
    this.notificacion = new Caracteristica(CARACT_NOTIFICACION, { notify: true });
    this.diag = new Caracteristica('00001401-555e-e99c-e511-f9f4f8daeb24', { notify: true });
    const disp = this;
    this.gatt = {
      connected: false,
      async connect() {
        disp.conexiones += 1;
        if (disp.colgado) return new Promise(() => {});
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

// Avanza el reloj falso en pasos cortos y deja correr las promesas entre paso y paso.
export async function avanzar(ms, paso = 50) {
  for (let t = 0; t < ms; t += paso) {
    mock.timers.tick(paso);
    await new Promise((r) => setImmediate(r));
  }
}


// Banda de pulso falsa (servicio Heart Rate). `fallos` como en la remadora.
export class BandaFalsa extends EventTarget {
  constructor() {
    super();
    this.name = 'HRM_PRUEBA';
    this.fallos = 0;
    this.conexiones = 0;
    this.medida = new Caracteristica('heart_rate_measurement', { notify: true });
    const disp = this;
    this.gatt = {
      connected: false,
      async connect() {
        disp.conexiones += 1;
        if (disp.fallos > 0) { disp.fallos -= 1; throw new Error('GATT no disponible'); }
        this.connected = true;
        return { getPrimaryService: async () => ({ getCharacteristic: async () => disp.medida }) };
      },
      disconnect() { this.connected = false; disp.dispatchEvent(new Event('gattserverdisconnected')); },
    };
  }
  latido(fc) { this.medida.emitir(new Uint8Array([0, fc])); }
  perderSenal() { this.gatt.connected = false; this.dispatchEvent(new Event('gattserverdisconnected')); }
}

// Reproduce una grabación (paquetesDeTexto) con su ritmo real: cada paquete de la consola llega a la remadora falsa
// a los `ms` de su lugar en la grabación, contando desde ahora.
export function reproducir(disp, paquetes) {
  const llegan = paquetes.filter((p) => p.dir === '<<' && p.origen === '1535');
  for (const p of llegan) setTimeout(() => disp.notificacion.emitir(p.datos), p.ms);
  return llegan;
}
