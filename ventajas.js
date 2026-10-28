// Ventajas en la carrera contra fantasmas: talentos de carrera de tu clase y objetos de la tienda.
// Solo cambian el resultado de la carrera (metros de ventaja); nunca tus metros, tiempos, paladas ni récords.
import { TOPE_TALENTOS_M, CLASES_TALENTO, valorDe } from './talentos.js';

// Objetos de un solo uso. Ninguno vale más de 25 m o un 2 % de ritmo.
export const OBJETOS_VENTAJA = [
  { id: 'salida', nombre: 'Salida adelantada', texto: 'Empiezas 15 m por delante.', precio: 60 },
  { id: 'viento', nombre: 'Viento de cola', texto: 'Durante los primeros 2 min tu bote cuenta un 2 % más de distancia frente a los fantasmas.', precio: 80 },
  { id: 'ancla', nombre: 'Ancla al rival', texto: 'Los fantasmas reman un 2 % más lento en los últimos 3 min o 500 m. Solo en carreras con final.', precio: 100, necesitaFinal: true },
  { id: 'segunda', nombre: 'Segunda oportunidad', texto: 'Si pierdes por menos de 10 m, la carrera cuenta como empate.', precio: 120 },
  { id: 'estandarte', nombre: 'Estandarte', texto: '+25 XP si ganas la carrera.', precio: 70 },
  { id: 'mapa', nombre: 'Mapa del rival', texto: 'Ves cuándo va a acelerar el fantasma. No da metros.', precio: 50 },
];
export const objetoVentaja = (id) => OBJETOS_VENTAJA.find((x) => x.id === id) || null;

// Las pruebas (500 m, 2000 m, FTP) y los jefes de capítulo se reman sin objetos.
export const esPrueba = (ent) => !!ent && (ent.pruebaFtp || /^Prueba|^2000 m$/.test(ent.nombre || '') || (ent.bloques || []).some((b) => b.prueba));

// clase y grados = { m1: 0..3, … } de tu héroe; final = { meta } o { duracion } si la carrera tiene final; racha = días seguidos contando hoy.
export function nuevaVentaja({ clase = null, grados = {}, objeto = null, final = null, racha = 0 } = {}) {
  const e = {
    clase, grados, objeto, final,
    talentos: 0, objetoM: objeto === 'salida' ? 15 : 0,
    distAnt: 0, paladasAnt: 0, hist: [], cuenta: 0, salida: 0, activoSeg: 0, quieto: 0,
    eventos: [], vistos: 0,
  };
  const g = (slot) => (clase ? valorDe(clase, slot, grados[slot] || 0) : 0);
  // Marcha de la legión: con 2 días de racha o más, sales por delante.
  if (clase === 'romano' && racha >= 2 && g('m4')) sumar(e, g('m4'), 'm4', 0);
  return e;
}

const nombreDe = (e, slot) => CLASES_TALENTO[e.clase]?.talentos[slot]?.nombre || slot;
// Suma metros de talento con el tope por carrera. discreto: solo un aviso corto en la pista (sin voz).
function sumar(e, m, slot, t, discreto = false) {
  const antes = e.talentos;
  e.talentos = Math.min(TOPE_TALENTOS_M, e.talentos + m);
  const ganado = Math.round((e.talentos - antes) * 10) / 10;
  if (ganado > 0) e.eventos.push({ t, slot, nombre: nombreDe(e, slot), m: ganado, discreto });
}
// Metros de tu última palada (media de los últimos 10 s), para las paladas extra.
function metrosPorPalada(e, dist, paladas) {
  const h = e.hist;
  const viejo = h[0];
  if (viejo && paladas - viejo.paladas >= 1) return Math.min(15, (dist - viejo.dist) / (paladas - viejo.paladas));
  return paladas >= 1 ? Math.min(15, dist / paladas) : 0;
}
// Cuántas veces se cruzó un múltiplo de «cada» al pasar de «antes» a «ahora».
const cruces = (antes, ahora, cada) => Math.max(0, Math.floor(ahora / cada) - Math.floor(antes / cada));

// Un segundo de carrera: muestra = { t, dist, paladas, spm, detras } (detras: algún fantasma va por delante).
// Devuelve los metros de ventaja totales.
export function avanzarVentaja(e, { t, dist, paladas = 0, spm = 0, detras = false }) {
  const v = Math.max(0, dist - e.distAnt);
  const nuevas = Math.max(0, Math.floor(paladas) - Math.floor(e.paladasAnt));
  // «Sin detenerte»: se perdonan hasta 2 s sin palada (la consola a veces manda un 0 suelto).
  e.quieto = spm > 0 && v > 0 ? 0 : (e.quieto || 0) + 1;
  const activo = e.quieto < 3;
  const g = (slot) => (e.clase ? valorDe(e.clase, slot, e.grados[slot] || 0) : 0);
  const extra = (slot, n = 1) => sumar(e, n * metrosPorPalada(e, dist, paladas), slot, t, true);
  // Paladas extra: cada «g» paladas que cumplen la condición, 1 palada más.
  const contar = (slot, cumple) => {
    if (!g(slot)) return;
    if (!cumple) { if (slot === 'm1' && e.clase === 'samurai') e.cuenta = 0; return; }
    e.cuenta += nuevas;
    while (e.cuenta >= g(slot)) { e.cuenta -= g(slot); extra(slot); }
  };
  switch (e.clase) {
    case 'vikingo': {
      contar('m1', true);
      // Salida del drakkar: metros extra en cada una de tus primeras 20 paladas; un solo aviso al terminar.
      const k = Math.min(20, Math.floor(paladas)) - Math.min(20, Math.floor(e.paladasAnt));
      if (g('m3') && k > 0) {
        const antes = e.talentos;
        e.talentos = Math.min(TOPE_TALENTOS_M, e.talentos + k * g('m3'));
        e.salida += e.talentos - antes;
        if (Math.floor(paladas) >= 20 && e.salida > 0) { e.eventos.push({ t, slot: 'm3', nombre: nombreDe(e, 'm3'), m: Math.round(e.salida * 10) / 10 }); e.salida = 0; }
      }
      break;
    }
    case 'pirata': contar('m2', detras); break;
    case 'samurai': {
      contar('m1', activo);
      // Kiai final: en los últimos 200 m, cada 50 m.
      const meta = e.final?.meta;
      if (g('m3') && meta) {
        const xa = Math.max(0, e.distAnt - (meta - 200));
        const xb = Math.min(200, dist - (meta - 200));
        const n = xb > xa ? cruces(xa, xb, 50) : 0;
        if (n) sumar(e, n * g('m3'), 'm3', t, true);
      }
      break;
    }
    case 'polinesio': {
      const n = cruces(e.distAnt, dist, 250);
      if (g('m2') && n) sumar(e, n * g('m2'), 'm2', t, true);
      const n2 = dist > 2000 ? cruces(Math.max(2000, e.distAnt) - 2000, dist - 2000, 500) : 0;
      if (g('m4') && n2) sumar(e, n2 * g('m4'), 'm4', t, true);
      break;
    }
    case 'romano': {
      e.activoSeg = activo ? e.activoSeg + 1 : 0;
      if (g('m2') && e.activoSeg && e.activoSeg % 60 === 0) sumar(e, g('m2'), 'm2', t, true);
      break;
    }
    default:
  }
  e.hist.push({ dist, paladas });
  if (e.hist.length > 10) e.hist.shift();
  e.distAnt = dist;
  e.paladasAnt = paladas;
  // Objetos de la tienda
  if (e.objeto === 'viento' && t <= 120) e.objetoM += 0.02 * v;
  if (e.objeto === 'ancla' && e.final) {
    const alFinal = e.final.meta ? dist >= e.final.meta - 500 : t >= e.final.duracion - 180;
    if (alFinal) e.objetoM += 0.02 * v;
  }
  return metrosVentaja(e);
}

// Adelantaste a un fantasma: Mano rápida del pirata le roba metros.
export function alAdelantar(e, t) {
  if (e?.clase !== 'pirata') return;
  const m = valorDe('pirata', 'm3', e.grados.m3 || 0);
  if (m) sumar(e, m, 'm3', t);
}
export const metrosVentaja = (e) => (e ? e.talentos + e.objetoM : 0);

// Diferencia final con un fantasma, ya con la ventaja y la Segunda oportunidad.
export function diferenciaFinal(real, e) {
  const d = Math.round(real + metrosVentaja(e));
  return e?.objeto === 'segunda' && d < 0 && d > -10 ? 0 : d;
}

// Mapa del rival: segundos que faltan para que el fantasma acelere un 3 % o más (en los próximos 60 s), o null.
export function proximoAceleron(rival, t) {
  const m = rival.muestras || [];
  const vel = (a) => (m[a] && m[a - 10] ? (m[a].dist - m[a - 10].dist) / 10 : null);
  const i = Math.floor(t) - 1;
  const base = vel(i);
  if (!base) return null;
  for (let k = 5; k <= 60; k += 5) {
    const v = vel(i + k);
    if (v != null && v > base * 1.03) return k;
  }
  return null;
}

// Tienda de la semana: 4 de las 6 ventajas, iguales toda la semana.
export function tiendaVentajas(azar) {
  const lista = [...OBJETOS_VENTAJA];
  const salida = [];
  while (salida.length < 4) salida.push(lista.splice(Math.floor(azar() * lista.length), 1)[0]);
  return salida;
}
