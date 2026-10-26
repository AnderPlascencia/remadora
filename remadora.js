// Conexión Bluetooth con la consola de la remadora (y modo demo con los mismos paquetes).
// Eventos: 'estado' (detail: texto), 'datos' (detail: objeto de parsePaquete), 'log' (detail: línea).

import {
  SERVICIO_IFIT, CARACT_ESCRITURA, CARACT_NOTIFICACION, SERVICIO_1400,
  hexABytes, bytesAHex, parsePaquete, paqueteRemada, paqueteMetricas,
} from './protocolo.js';
import { VARIANTES } from './variantes.js';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const CABECERA_RESISTENCIA = 'fe 02 0d 02';
const MAX_REINTENTOS = 5;

export class Remadora extends EventTarget {
  constructor() {
    super();
    this.dispositivo = null;
    this.escritura = null;
    this.variante = VARIANTES.generica;
    this.cola = Promise.resolve();
    this.pollTimer = null;
    this.indicePoll = 0;
    this.demoTimer = null;
    this.conectada = false;
    this.reconectando = false;
    this.cierreManual = false;
    this.nivelPendiente = null;
    this.demoNivel = null;
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
    this.variante = VARIANTES[claveVariante] || VARIANTES.generica;
    this.cierreManual = false;
    this.estado('Buscando remadora…');
    this.dispositivo = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'I_RW' }],
      optionalServices: [SERVICIO_IFIT, SERVICIO_1400],
    });
    this.dispositivo.addEventListener('gattserverdisconnected', () => this.alDesconectar());
    this.log(`variante ${claveVariante}`);
    await this.abrir();
  }

  // Conecta (o reconecta) con el dispositivo ya elegido y repite el saludo inicial.
  async abrir() {
    this.estado(this.reconectando ? 'Reconectando…' : 'Conectando…');
    const servidor = await this.dispositivo.gatt.connect();
    const servicio = await servidor.getPrimaryService(SERVICIO_IFIT);
    this.escritura = await servicio.getCharacteristic(CARACT_ESCRITURA);
    const notif = await servicio.getCharacteristic(CARACT_NOTIFICACION);
    notif.oncharacteristicvaluechanged = (e) => this.alRecibir(e.target.value, '1535');
    await notif.startNotifications();
    this.log(`conectado a ${this.dispositivo.name}`);

    // El servicio 1400 solo se escucha para diagnóstico; nunca se escribe en él.
    try {
      const s1400 = await servidor.getPrimaryService(SERVICIO_1400);
      for (const c of await s1400.getCharacteristics()) {
        if (!c.properties.notify) continue;
        const corto = c.uuid.slice(4, 8);
        c.oncharacteristicvaluechanged = (e) => this.alRecibir(e.target.value, corto);
        await c.startNotifications();
      }
    } catch (err) {
      this.log(`servicio 1400 no disponible: ${err.message}`);
    }

    this.conectada = true;
    this.estado('Iniciando comunicación…');
    for (const hex of this.variante.init) {
      await this.escribir(hex);
      await espera(400);
    }
    this.reconectando = false;
    this.estado('Conectada');
    this.iniciarPoll();
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

  // Las consultas son mensajes de 3 paquetes; un cambio de resistencia solo se intercala
  // entre mensajes completos para no romper el formato.
  iniciarPoll() {
    clearInterval(this.pollTimer);
    const poll = this.variante.poll;
    this.indicePoll = 0;
    this.pollTimer = setInterval(() => {
      if (this.indicePoll % 3 === 0 && this.nivelPendiente != null) {
        const nivel = this.nivelPendiente;
        this.nivelPendiente = null;
        this.log(`cambio de resistencia a nivel ${nivel}`);
        this.escribir(CABECERA_RESISTENCIA);
        this.escribir(this.variante.resistencia[nivel - 1]);
        return;
      }
      this.escribir(poll[this.indicePoll]);
      this.indicePoll = (this.indicePoll + 1) % poll.length;
    }, 200);
  }

  fijarResistencia(nivel) {
    nivel = Math.round(nivel);
    if (!(nivel >= 1 && nivel <= 24)) return;
    if (this.demoTimer) { this.demoNivel = nivel; return; }
    if (this.conectada) this.nivelPendiente = nivel;
  }

  alRecibir(dataView, origen) {
    const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
    this.log(`<< [${origen}] ${bytesAHex(bytes)}`);
    if (origen !== '1535') return;
    const datos = parsePaquete(bytes);
    if (datos) this.emitir('datos', datos);
  }

  async alDesconectar() {
    clearInterval(this.pollTimer);
    this.conectada = false;
    this.log('desconectada');
    if (this.cierreManual || !this.dispositivo) {
      this.estado('Desconectada');
      return;
    }
    // Se perdió la conexión sin que el usuario la cerrara: reintentar con espera creciente.
    this.reconectando = true;
    for (let intento = 1; intento <= MAX_REINTENTOS && !this.cierreManual; intento++) {
      this.estado(`Reconectando (${intento}/${MAX_REINTENTOS})…`);
      await espera(1000 * intento);
      try {
        await this.abrir();
        this.log('reconectada');
        return;
      } catch (err) {
        this.log(`reintento ${intento} falló: ${err.message}`);
      }
    }
    this.reconectando = false;
    this.estado('Desconectada');
  }

  desconectar() {
    this.cierreManual = true;
    clearInterval(this.pollTimer);
    clearInterval(this.demoTimer);
    this.demoTimer = null;
    if (this.dispositivo?.gatt?.connected) this.dispositivo.gatt.disconnect();
    else { this.conectada = false; this.estado('Desconectada'); }
  }

  // Modo demo: genera paquetes con el formato real y los pasa por el mismo decodificador.
  // Cada 40 s simula una pausa de 8 s para probar la pausa automática.
  iniciarDemo() {
    this.conectada = true;
    this.cierreManual = false;
    this.estado('Modo demo');
    let t = 0;
    let distancia = 0;
    this.demoTimer = setInterval(() => {
      t += 0.5;
      const pausa = this.demoPausas && t % 40 > 32;
      const nivel = this.demoNivel ?? 8 + Math.round(4 * Math.sin(t / 40));
      const spm = pausa ? 0 : Math.round(24 + 4 * Math.sin(t / 15));
      const watts = pausa ? 0 : Math.round(120 + 40 * Math.sin(t / 15) + 6 * nivel + 10 * Math.random());
      const split = watts ? Math.round(500 / Math.cbrt(watts / 2.8)) : 0;
      if (split) distancia += 500 / split / 2;
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
