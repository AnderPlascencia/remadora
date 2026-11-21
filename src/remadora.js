// Conexión Bluetooth con la consola de la remadora (y modo demo con los mismos paquetes).
// Eventos: 'estado' (detail: texto), 'datos' (detail: objeto de parsePaquete), 'log' (detail: línea).

import {
  SERVICIO_IFIT, CARACT_ESCRITURA, CARACT_NOTIFICACION, SERVICIO_1400,
  hexABytes, parsePaquete, paqueteRemada, paqueteMetricas, parseMedidaPulso,
} from './protocolo.js';
import { VARIANTES } from './variantes.js';
import { paquetesConsola } from './diagnostico.js';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const CABECERA_RESISTENCIA = 'fe 02 0d 02';
const MAX_REINTENTOS = 5;
// Vigilante (0.80): con el GATT conectado y la persona remando, 4 s sin paquetes es una consola que no responde.
export const SIN_DATOS_MS = 4000;
// «Venía remando»: hubo potencia o paladas en los últimos 15 s (una consola quieta puede dejar de mandar).
export const REMANDO_MS = 15000;
// gatt.connect() a veces no vuelve nunca: se corta a los 10 s y cuenta como un reintento fallido.
export const CONEXION_MAX_MS = 10000;
// Con sesión en marcha la reconexión no se rinde; la espera crece de 1 en 1 s hasta este tope.
export const ESPERA_MAX_MS = 5000;

// Una promesa que falla si tarda más de `ms`.
export function conLimite(promesa, ms, que) {
  let t;
  return Promise.race([promesa, new Promise((_, mal) => { t = setTimeout(() => mal(new Error(`${que}: sin respuesta en ${ms / 1000} s`)), ms); })])
    .finally(() => clearTimeout(t));
}
// Una escritura a la consola que tarda más que esto se anota como lenta (la consulta va cada 200 ms).
export const ESCRITURA_LENTA_MS = 150;

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
    this.pendientes = 0; // escrituras en la cola sin terminar
    this.reloj = () => performance.now();
    // Hora para el vigilante (Date.now: en las pruebas se simula junto con los temporizadores).
    this.ahora = () => Date.now();
    this.ultimoPaquete = 0;
    this.ultimoRemando = -Infinity;
    this.vigilanteTimer = null;
    // Quien usa la remadora dice si hay una sesión en marcha: entonces la reconexión no se rinde.
    this.debeMantener = () => false;
    this.reiniciarEstadisticas();
  }

  // Escrituras, profundidad máxima de la cola, escrituras lentas y consultas que se saltaron por tener la cola ocupada.
  reiniciarEstadisticas() {
    this.estadisticas = { escrituras: 0, colaMax: 0, lentas: 0, saltadas: 0, msMax: 0 };
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
    const servidor = await conLimite(this.dispositivo.gatt.connect(), CONEXION_MAX_MS, 'gatt.connect');
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
    this.iniciarVigilante();
  }

  // Cada segundo: si la consola calla con el GATT conectado y venías remando, se fuerza la reconexión. Antes la
  // app esperaba al aviso de desconexión de Chrome, que con la consola colgada podía no llegar nunca.
  iniciarVigilante() {
    clearInterval(this.vigilanteTimer);
    this.ultimoPaquete = this.ahora();
    this.vigilanteTimer = setInterval(() => this.vigilar(), 1000);
  }

  vigilar() {
    if (!this.conectada || this.reconectando || this.demoTimer) return;
    const ahora = this.ahora();
    const callada = ahora - this.ultimoPaquete;
    if (callada < SIN_DATOS_MS || ahora - this.ultimoRemando > REMANDO_MS) return;
    clearInterval(this.vigilanteTimer);
    this.log(`la consola no responde: ${Math.round(callada / 1000)} s sin datos; se reconecta`);
    this.estado('La consola no responde');
    if (this.dispositivo?.gatt?.connected) this.dispositivo.gatt.disconnect();
    else this.alDesconectar();
  }

  escribir(hex) {
    this.pendientes += 1;
    const est = this.estadisticas;
    est.colaMax = Math.max(est.colaMax, this.pendientes);
    const tarea = this.cola.then(async () => {
      if (!this.escritura || !this.conectada) return;
      const bytes = hexABytes(hex);
      paquetesConsola.anotar('>>', '1535', bytes);
      const t0 = this.reloj();
      await this.escritura.writeValueWithResponse(bytes);
      const ms = this.reloj() - t0;
      est.escrituras += 1;
      est.msMax = Math.max(est.msMax, Math.round(ms));
      if (ms > ESCRITURA_LENTA_MS) {
        est.lentas += 1;
        // Solo las primeras y luego una de cada 50, para no llenar el registro si la consola va lenta toda la sesión.
        if (est.lentas <= 5 || est.lentas % 50 === 0) this.log(`escritura lenta: ${Math.round(ms)} ms (${est.lentas} en la sesión)`);
      }
    });
    this.cola = tarea.catch((err) => this.log(`error al escribir: ${err.message}`)).finally(() => { this.pendientes -= 1; });
    return this.cola;
  }

  // Las consultas son mensajes de 3 paquetes; un cambio de resistencia solo se intercala
  // entre mensajes completos para no romper el formato.
  iniciarPoll() {
    clearInterval(this.pollTimer);
    const poll = this.variante.poll;
    this.indicePoll = 0;
    this.pollTimer = setInterval(() => {
      // Contrapresión: si la escritura anterior no terminó, esta consulta se salta en vez de encolarse. Antes la cola
      // crecía sin límite cuando la consola tardaba, y el retraso de los datos se acumulaba durante la sesión.
      if (this.pendientes > 0) { this.estadisticas.saltadas += 1; return; }
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

  // Devuelve true si el nivel queda en cola para la consola (o para el modo demo).
  // Durante una reconexión se guarda y se manda en cuanto vuelve la consulta periódica.
  fijarResistencia(nivel) {
    nivel = Math.round(nivel);
    if (!(nivel >= 1 && nivel <= 24)) return false;
    if (this.demoTimer) { this.demoNivel = nivel; return true; }
    if (!this.conectada && !this.reconectando) return false;
    this.nivelPendiente = nivel;
    return true;
  }

  // Espera a que la consola informe el nivel pedido (byte de resistencia de los paquetes de métricas).
  // Resuelve { ok, metricas, visto, byte }: ok en cuanto llega el nivel; si pasan `ms` sin verlo, ok es false,
  // metricas cuenta los paquetes de métricas que llegaron y visto/byte son el último nivel informado y su byte crudo.
  esperarResistencia(nivel, ms = 4000) {
    return new Promise((resolver) => {
      let metricas = 0;
      let visto = null;
      let byte = null;
      const alDato = (e) => {
        if (e.detail.tipo !== 'metricas') return;
        metricas += 1;
        visto = e.detail.resistencia;
        byte = e.detail.byteResistencia ?? null;
        if (visto === nivel) terminar(true);
      };
      const terminar = (ok) => {
        clearTimeout(limite);
        this.removeEventListener('datos', alDato);
        resolver({ ok, metricas, visto, byte });
      };
      const limite = setTimeout(() => terminar(false), ms);
      this.addEventListener('datos', alDato);
    });
  }

  alRecibir(dataView, origen) {
    const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
    // Cada paquete va al búfer binario del diagnóstico, no al registro de texto (más de 10 líneas por segundo).
    paquetesConsola.anotar('<<', origen, bytes);
    if (origen !== '1535') return;
    this.ultimoPaquete = this.ahora();
    const datos = parsePaquete(bytes);
    if (!datos) return;
    if (datos.spm > 0 || datos.watts > 0) this.ultimoRemando = this.ultimoPaquete;
    this.emitir('datos', datos);
  }

  async alDesconectar() {
    if (this.reconectando && !this.conectada) return; // ya se está reconectando (aviso repetido de Chrome)
    clearInterval(this.pollTimer);
    clearInterval(this.vigilanteTimer);
    this.conectada = false;
    this.log('desconectada');
    if (this.cierreManual || !this.dispositivo) {
      this.nivelPendiente = null;
      this.estado('Desconectada');
      return;
    }
    // Se perdió la conexión sin que el usuario la cerrara: reintentar con espera creciente. Sin sesión se rinde
    // tras MAX_REINTENTOS; con una sesión en marcha sigue (antes se rendía a los 15 s y la sesión quedaba en pausa).
    this.reconectando = true;
    for (let intento = 1; (intento <= MAX_REINTENTOS || this.debeMantener()) && !this.cierreManual; intento++) {
      this.estado(this.debeMantener() ? `Reconectando (intento ${intento})…` : `Reconectando (${intento}/${MAX_REINTENTOS})…`);
      await espera(Math.min(1000 * intento, ESPERA_MAX_MS));
      if (this.cierreManual) break;
      try {
        await this.abrir();
        this.log('reconectada');
        return;
      } catch (err) {
        this.log(`reintento ${intento} falló: ${err.message}`);
      }
    }
    this.reconectando = false;
    this.nivelPendiente = null;
    this.estado('Desconectada');
  }

  desconectar() {
    this.cierreManual = true;
    clearInterval(this.vigilanteTimer);
    // Un cambio de resistencia sin mandar no debe aplicarse en la próxima conexión.
    this.nivelPendiente = null;
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
    // El aviso de estado va después de crear el temporizador: así el botón de Ajustes ya dice «Detener demo».
    this.estado('Modo demo');
  }
}

// Banda de pecho o reloj que transmite el pulso (servicio Heart Rate 0x180D).
// Eventos: 'fc' (lpm; 0 si el sensor no toca la piel o se desconecta), 'rr' (intervalos en ms, si el sensor los manda)
// y 'log'. Si se corta, reconecta como la remadora: con espera creciente, sin rendirse mientras haya sesión.
export class BandaCardiaca extends EventTarget {
  constructor() {
    super();
    this.dispositivo = null;
    this.cierreManual = false;
    this.reconectando = false;
    this.debeMantener = () => false;
  }

  log(texto) { this.dispatchEvent(new CustomEvent('log', { detail: `banda: ${texto}` })); }

  async conectar() {
    this.dispositivo = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    this.cierreManual = false;
    this.dispositivo.addEventListener('gattserverdisconnected', () => this.alDesconectar());
    await this.abrir();
    return this.dispositivo.name;
  }

  async abrir() {
    const serv = await (await conLimite(this.dispositivo.gatt.connect(), CONEXION_MAX_MS, 'gatt.connect')).getPrimaryService('heart_rate');
    const c = await serv.getCharacteristic('heart_rate_measurement');
    c.oncharacteristicvaluechanged = (e) => {
      const m = parseMedidaPulso(e.target.value);
      if (!m) return;
      this.dispatchEvent(new CustomEvent('fc', { detail: m.contacto === false ? 0 : m.fc }));
      if (m.rr.length && m.contacto !== false) this.dispatchEvent(new CustomEvent('rr', { detail: m.rr }));
    };
    await c.startNotifications();
  }

  async alDesconectar() {
    this.dispatchEvent(new CustomEvent('fc', { detail: 0 }));
    if (this.cierreManual || this.reconectando || !this.dispositivo) return;
    this.reconectando = true;
    this.log('se cortó; reconectando');
    for (let intento = 1; (intento <= MAX_REINTENTOS || this.debeMantener()) && !this.cierreManual; intento++) {
      await espera(Math.min(1000 * intento, ESPERA_MAX_MS));
      if (this.cierreManual) break;
      try {
        await this.abrir();
        this.log(`reconectada (intento ${intento})`);
        this.reconectando = false;
        return;
      } catch (err) {
        this.log(`reintento ${intento} falló: ${err.message}`);
      }
    }
    this.reconectando = false;
  }

  desconectar() {
    this.cierreManual = true;
    if (this.dispositivo?.gatt?.connected) this.dispositivo.gatt.disconnect();
  }
}
