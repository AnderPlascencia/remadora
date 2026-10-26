// Conexión Bluetooth con la consola de la remadora (y modo demo con los mismos paquetes).
// Eventos: 'estado' (detail: texto), 'datos' (detail: objeto de parsePaquete), 'log' (detail: línea).

import {
  SERVICIO_IFIT, CARACT_ESCRITURA, CARACT_NOTIFICACION, SERVICIO_1400,
  hexABytes, bytesAHex, parsePaquete, paqueteRemada, paqueteMetricas,
} from './protocolo.js';
import { VARIANTES } from './variantes.js';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export class Remadora extends EventTarget {
  constructor() {
    super();
    this.dispositivo = null;
    this.escritura = null;
    this.cola = Promise.resolve();
    this.pollTimer = null;
    this.indicePoll = 0;
    this.demoTimer = null;
    this.conectada = false;
  }

  emitir(tipo, detail) {
    this.dispatchEvent(new CustomEvent(tipo, { detail }));
  }

  log(texto) {
    this.emitir('log', `${new Date().toISOString().slice(11, 23)} ${texto}`);
  }

  estado(texto) {
    this.emitir('estado', texto);
  }

  static soportado() {
    return 'bluetooth' in navigator;
  }

  async conectar(claveVariante) {
    const variante = VARIANTES[claveVariante] || VARIANTES.generica;
    this.estado('Buscando remadora…');
    this.dispositivo = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'I_RW' }],
      optionalServices: [SERVICIO_IFIT, SERVICIO_1400],
    });
    this.dispositivo.addEventListener('gattserverdisconnected', () => this.alDesconectar());

    this.estado('Conectando…');
    const servidor = await this.dispositivo.gatt.connect();
    const servicio = await servidor.getPrimaryService(SERVICIO_IFIT);
    this.escritura = await servicio.getCharacteristic(CARACT_ESCRITURA);
    const notif = await servicio.getCharacteristic(CARACT_NOTIFICACION);
    notif.addEventListener('characteristicvaluechanged', (e) => this.alRecibir(e.target.value, '1535'));
    await notif.startNotifications();
    this.log(`conectado a ${this.dispositivo.name} · variante ${claveVariante}`);

    // El servicio 1400 solo se escucha para diagnóstico; nunca se escribe en él.
    try {
      const s1400 = await servidor.getPrimaryService(SERVICIO_1400);
      for (const c of await s1400.getCharacteristics()) {
        if (!c.properties.notify) continue;
        const corto = c.uuid.slice(4, 8);
        c.addEventListener('characteristicvaluechanged', (e) => this.alRecibir(e.target.value, corto));
        await c.startNotifications();
      }
    } catch (err) {
      this.log(`servicio 1400 no disponible: ${err.message}`);
    }

    this.conectada = true;
    this.estado('Iniciando comunicación…');
    for (const hex of variante.init) {
      await this.escribir(hex);
      await espera(400);
    }
    this.estado('Conectada');
    this.iniciarPoll(variante.poll);
  }

  escribir(hex) {
    const tarea = this.cola.then(async () => {
      if (!this.escritura || !this.conectada) return;
      this.log(`>> ${hex}`);
      await this.escritura.writeValueWithResponse(hexABytes(hex));
    });
    this.cola = tarea.catch((err) => this.log(`error al escribir: ${err.message}`));
    return this.cola;
  }

  iniciarPoll(poll) {
    clearInterval(this.pollTimer);
    this.indicePoll = 0;
    this.pollTimer = setInterval(() => {
      this.escribir(poll[this.indicePoll]);
      this.indicePoll = (this.indicePoll + 1) % poll.length;
    }, 200);
  }

  alRecibir(dataView, origen) {
    const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
    this.log(`<< [${origen}] ${bytesAHex(bytes)}`);
    if (origen !== '1535') return;
    const datos = parsePaquete(bytes);
    if (datos) this.emitir('datos', datos);
  }

  alDesconectar() {
    clearInterval(this.pollTimer);
    this.conectada = false;
    this.log('desconectada');
    this.estado('Desconectada');
  }

  desconectar() {
    clearInterval(this.pollTimer);
    clearInterval(this.demoTimer);
    this.demoTimer = null;
    if (this.dispositivo?.gatt?.connected) this.dispositivo.gatt.disconnect();
    else this.alDesconectar();
  }

  // Modo demo: genera paquetes con el formato real y los pasa por el mismo decodificador.
  iniciarDemo() {
    this.conectada = true;
    this.estado('Modo demo');
    let t = 0;
    let distancia = 0;
    this.demoTimer = setInterval(() => {
      t += 0.5;
      const nivel = 8 + Math.round(4 * Math.sin(t / 40));
      const spm = Math.round(24 + 4 * Math.sin(t / 15));
      const watts = Math.round(120 + 40 * Math.sin(t / 15) + 6 * nivel + 10 * Math.random());
      const split = Math.round(500 / Math.cbrt(watts / 2.8));
      distancia += 500 / split / 2;
      for (const p of [paqueteRemada(spm, split), paqueteMetricas(watts, Math.floor(distancia), nivel)]) {
        this.alRecibir(new DataView(p.buffer), '1535');
      }
    }, 500);
  }
}

// Banda de pecho estándar (servicio Heart Rate 0x180D).
export class BandaCardiaca extends EventTarget {
  async conectar() {
    const disp = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    const serv = await (await disp.gatt.connect()).getPrimaryService('heart_rate');
    const c = await serv.getCharacteristic('heart_rate_measurement');
    c.addEventListener('characteristicvaluechanged', (e) => {
      const v = e.target.value;
      const fc = v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1);
      this.dispatchEvent(new CustomEvent('fc', { detail: fc }));
    });
    await c.startNotifications();
    disp.addEventListener('gattserverdisconnected', () => this.dispatchEvent(new CustomEvent('fc', { detail: 0 })));
    return disp.name;
  }
}
