// Diagnóstico local de la sesión: lo que tarda un dato de la consola en verse, los cuadros por segundo de la carrera,
// cómo va la cola de Bluetooth y los paquetes de la consola de los últimos ~30 min. Todo se queda en el teléfono:
// se ve en Ajustes › Diagnóstico, se guarda con cada sesión (y sale en el respaldo) y va en el registro descargable.

// Percentil p (0–100) de una lista de números; null si está vacía.
export function percentil(lista, p) {
  if (!lista.length) return null;
  const orden = [...lista].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[i];
}

// Muestras con tope: al llenarse se queda con una de cada dos (sigue representando toda la sesión, sin crecer).
export function crearMuestras(tope = 8000) {
  let datos = [];
  let paso = 1;
  let cuenta = 0;
  return {
    anotar(v) {
      if (!Number.isFinite(v)) return;
      cuenta += 1;
      if (cuenta % paso) return;
      datos.push(v);
      if (datos.length >= tope) { datos = datos.filter((_, i) => i % 2 === 0); paso *= 2; }
    },
    lista: () => datos,
    get n() { return cuenta; },
    vaciar() { datos = []; paso = 1; cuenta = 0; },
  };
}

// ---------- Latencia: dato recibido → números pintados ----------
const latencias = crearMuestras();
let llegada = null; // performance.now() del dato más viejo que aún no se ha pintado
export function datoRecibido(ahora = performance.now()) { if (llegada == null) llegada = ahora; }
export function numerosPintados(ahora = performance.now()) {
  if (llegada == null) return;
  latencias.anotar(ahora - llegada);
  llegada = null;
}

// ---------- Cuadros de la carrera, por vista ----------
const cuadros = {};
export function cuadroPintado(modo, intervalo) {
  if (!(intervalo > 0) || intervalo > 500) return;
  (cuadros[modo] ||= crearMuestras()).anotar(intervalo);
}

export function reiniciarDiagnostico() {
  latencias.vaciar();
  llegada = null;
  for (const m of Object.values(cuadros)) m.vaciar();
}

// Resumen de la sesión: latencia en ms (p50 y p95) y fps de cada vista (mediana y el peor 5 %).
export function resumenDiagnostico(ble = null) {
  const r = {};
  const l = latencias.lista();
  if (l.length) r.latencia = { p50: Math.round(percentil(l, 50)), p95: Math.round(percentil(l, 95)), n: latencias.n };
  const fps = {};
  for (const [modo, m] of Object.entries(cuadros)) {
    const lista = m.lista();
    if (lista.length < 30) continue;
    fps[modo] = { p50: Math.round(10000 / percentil(lista, 50)) / 10, p5: Math.round(10000 / percentil(lista, 95)) / 10, n: m.n };
  }
  if (Object.keys(fps).length) r.fps = fps;
  if (ble && ble.escrituras) r.ble = { ...ble };
  return Object.keys(r).length ? r : null;
}

export const NOMBRES_VISTA = { '2d': 'Carrera 2D', '3d': 'Carrera 3D', real: 'Carrera realista' };
// Líneas de texto para Ajustes y el registro.
export function textoDiagnostico(d) {
  if (!d) return [];
  const lineas = [];
  if (d.latencia) lineas.push(`Dato de la consola → pantalla: ${d.latencia.p50} ms (mediana), ${d.latencia.p95} ms (peor 5 %)`);
  for (const [modo, f] of Object.entries(d.fps || {})) lineas.push(`${NOMBRES_VISTA[modo] || modo}: ${f.p50} cuadros/s (peor 5 %: ${f.p5})`);
  if (d.ble) lineas.push(`Bluetooth: ${d.ble.escrituras} escrituras, cola máxima ${d.ble.colaMax}, ${d.ble.lentas} lentas (> 150 ms), ${d.ble.saltadas} consultas saltadas`);
  return lineas;
}

// ---------- Paquetes de la consola en un búfer circular binario ----------
// Cada paquete ocupa una casilla fija (hora aparte): 1 byte de largo, 1 de dirección y origen, y hasta 22 de datos.
// Con 36 000 casillas caben unos 30 min a 20 paquetes por segundo en menos de 1,2 MB. El texto se arma solo al
// descargar, así que en plena sesión no se crea ni una cadena por paquete.
const CASILLA = 24;
const DATOS_MAX = CASILLA - 2;
export const ORIGENES = ['1535', 'otro'];
export function crearBufferPaquetes(capacidad = 36000, copia = null) {
  const bytes = copia ? new Uint8Array(copia.bytes) : new Uint8Array(capacidad * CASILLA);
  const horas = copia ? new Float64Array(copia.horas) : new Float64Array(capacidad);
  let siguiente = copia?.siguiente ?? 0;
  let total = copia?.total ?? 0;
  if (copia) capacidad = horas.length;
  return {
    capacidad,
    get largo() { return Math.min(total, capacidad); },
    get total() { return total; },
    // dir: '>>' (a la consola) o '<<' (de la consola); origen: característica corta ('1535', '2ad2'…).
    anotar(dir, origen, datos, hora = Date.now()) {
      const base = siguiente * CASILLA;
      const n = Math.min(datos.length, DATOS_MAX);
      bytes[base] = datos.length > 255 ? 255 : datos.length;
      bytes[base + 1] = (dir === '>>' ? 0x80 : 0) | (origen === '1535' ? 0 : 1);
      bytes.set(datos.subarray ? datos.subarray(0, n) : datos.slice(0, n), base + 2);
      horas[siguiente] = hora;
      siguiente = (siguiente + 1) % capacidad;
      total += 1;
    },
    // Paquetes de más viejo a más nuevo: [{ hora, dir, origen, datos (Uint8Array), cortado }].
    *paquetes() {
      const n = Math.min(total, capacidad);
      const inicio = total > capacidad ? siguiente : 0;
      for (let k = 0; k < n; k++) {
        const i = (inicio + k) % capacidad;
        const base = i * CASILLA;
        const largo = bytes[base];
        const marca = bytes[base + 1];
        yield {
          hora: horas[i], dir: marca & 0x80 ? '>>' : '<<', origen: ORIGENES[marca & 1],
          datos: bytes.slice(base + 2, base + 2 + Math.min(largo, DATOS_MAX)), cortado: largo > DATOS_MAX,
        };
      }
    },
    texto() {
      const lineas = [];
      for (const p of this.paquetes()) {
        const hex = [...p.datos].map((b) => b.toString(16).padStart(2, '0')).join(' ');
        lineas.push(`${new Date(p.hora).toISOString().slice(11, 23)} ${p.dir}${p.dir === '<<' ? ` [${p.origen}]` : ''} ${hex}${p.cortado ? ' …' : ''}`);
      }
      return lineas.join('\n');
    },
    vaciar() { siguiente = 0; total = 0; },
    // Copia para guardar en IndexedDB (solo lo ocupado) y volver a leerla con crearBufferPaquetes(0, copia).
    instantanea() {
      const n = Math.min(total, capacidad);
      const orden = [...this.paquetes()];
      const b = new Uint8Array(n * CASILLA);
      const h = new Float64Array(n);
      orden.forEach((p, k) => {
        b[k * CASILLA] = p.cortado ? 255 : p.datos.length;
        b[k * CASILLA + 1] = (p.dir === '>>' ? 0x80 : 0) | (p.origen === '1535' ? 0 : 1);
        b.set(p.datos, k * CASILLA + 2);
        h[k] = p.hora;
      });
      return { bytes: b, horas: h, siguiente: 0, total: n };
    },
  };
}
export const paquetesConsola = crearBufferPaquetes();

// Lee el texto del registro (el de texto(), tal como se copia de Ajustes › Diagnóstico) y devuelve los paquetes con
// su hora relativa al primero, en ms: [{ ms, dir, origen, datos }]. Sirve para reproducir sesiones reales en las
// pruebas. Las líneas que no son paquetes se ignoran; un paquete cortado («…») se deja fuera porque está incompleto.
export function paquetesDeTexto(texto) {
  const lista = [];
  let primero = null;
  let previo = null;
  let dias = 0;
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^(\d\d):(\d\d):(\d\d)\.(\d{3}) (<<|>>)(?: \[(\w+)\])? ([0-9a-f ]+?)( …)?$/);
    if (!m || m[8]) continue;
    let ms = ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4] + dias * 864e5;
    if (previo != null && ms < previo - 3600e3) { dias += 1; ms += 864e5; } // pasó la medianoche
    previo = ms;
    primero ??= ms;
    lista.push({ ms: ms - primero, dir: m[5], origen: m[5] === '<<' ? (m[6] === '1535' ? '1535' : 'otro') : '1535', datos: Uint8Array.from(m[7].trim().split(' '), (h) => parseInt(h, 16)) });
  }
  return lista;
}

// La BLE de la remadora la pone sesion.js (este módulo no conoce la conexión).
let fuenteBle = () => null;
export function fijarFuenteBle(fn) { fuenteBle = fn; }
export const estadisticasBle = () => fuenteBle();
