// Ventajas en la carrera contra fantasmas: talentos de carrera de tu clase y objetos de la tienda.
// Solo cambian el resultado de la carrera (metros de ventaja); nunca tus metros, tiempos, paladas ni récords.
import { TOPE_TALENTOS_M, valorDe, talentoDe, SLOTS_SENDA } from './talentos.js';
import { SUBTOPE_INTENSIDAD_M } from './intensidad.js';

// Objetos de un solo uso (etapa 15: 12 en vez de 6, y algo más fuertes). Ninguno vale más de 30 m o un 3 % de ritmo.
// Paga XP_ESTANDARTE con el factor de XP de hoy (la mitad desde el 29 de octubre): el texto dice lo que llega.
export const OBJETOS_VENTAJA = [
  { id: 'salida', nombre: 'Salida adelantada', texto: 'Empiezas 20 m por delante.', precio: 60 },
  { id: 'viento', nombre: 'Viento de cola', texto: 'Durante los primeros 2 min tu bote cuenta un 3 % más de distancia frente a los fantasmas.', precio: 80 },
  { id: 'ancla', nombre: 'Ancla al rival', texto: 'Los fantasmas reman un 2 % más lento en los últimos 3 min o 500 m. Solo en carreras con final.', precio: 100, necesitaFinal: true },
  { id: 'segunda', nombre: 'Segunda oportunidad', texto: 'Si pierdes por menos de 15 m, la carrera cuenta como empate.', precio: 120 },
  { id: 'estandarte', nombre: 'Estandarte', texto: '+25 XP y 10 monedas si ganas la carrera.', precio: 70 },
  { id: 'mapa', nombre: 'Mapa del rival', texto: 'Ves cuándo va a acelerar el fantasma. No da metros.', precio: 40 },
  { id: 'corriente', nombre: 'Corriente favorable', texto: 'Toda la carrera cuentas un 1,5 % más de distancia (hasta 30 m).', precio: 110 },
  { id: 'aire', nombre: 'Segundo aire', texto: 'Si vas por detrás en el último minuto o los últimos 250 m, cuentas un 3 % más. Solo en carreras con final.', precio: 90, necesitaFinal: true },
  { id: 'cuerno', nombre: 'Cuerno de guerra', texto: 'Cada vez que adelantas a un fantasma, +5 m (hasta 3 veces).', precio: 70 },
  { id: 'botin', nombre: 'Botín del bucanero', texto: '+20 monedas por cada fantasma que venzas.', precio: 60 },
  { id: 'bitacora', nombre: 'Bitácora del capitán', texto: '+20 XP si terminas la carrera sin pausas.', precio: 50 },
  { id: 'talisman', nombre: 'Talismán de la clase', texto: 'Los talentos de carrera de tu clase rinden un 25 % más y su tope sube de 40 a 50 m.', precio: 130, necesitaClase: true },
];
// XP del Estandarte y de la Bitácora antes del factor de XP lenta. El Estandarte pagaba 25 hasta la etapa 15.
export const XP_ESTANDARTE_ANTES = 25;
export const XP_ESTANDARTE = 50;
export const MONEDAS_ESTANDARTE = 10;
export const XP_BITACORA = 40;
export const MONEDAS_BOTIN = 20;
// Ventajas que se venden en lote: 3 por el precio de 2,5.
export const LOTE = 3;
export const precioLote = (x) => Math.round(x.precio * 2.5);
// Tope de los metros que dan las piezas de tu bote (velas, mascarón y palas) en una carrera.
export const TOPE_EQUIPO_M = 25;
export const objetoVentaja = (id) => OBJETOS_VENTAJA.find((x) => x.id === id) || null;

// Las pruebas (500 m, 2000 m, FTP) y los jefes de capítulo se reman sin objetos.
export const esPrueba = (ent) => !!ent && (ent.pruebaFtp || /^Prueba|^2000 m$/.test(ent.nombre || '') || (ent.bloques || []).some((b) => b.prueba));

// clase y grados = { m1: 0..3, … } de tu héroe; final = { meta } o { duracion } si la carrera tiene final; racha = días seguidos cumpliendo el plan, contando hoy.
// equipo = lo que dan las piezas de tu bote: { salida, inicio, porPaladas, legendaria } (ver bonoEquipo).
// senda = 'a' | 'b' (etapa 4). intensidad = { activa, maxActivaciones, calentado } de permisoIntensidad(): los talentos
// de intensidad de la senda B solo cuentan con permiso, con su sub-tope de 15 m y su número de activaciones.
export function nuevaVentaja({ clase = null, grados = {}, objeto = null, final = null, racha = 0, equipo = null, senda = 'a', intensidad = null } = {}) {
  const e = {
    clase, grados, objeto, final, equipo,
    talentos: 0, objetoM: objeto === 'salida' ? 20 : 0, equipoM: 0, cuernos: 0,
    tope: objeto === 'talisman' ? 50 : TOPE_TALENTOS_M, factor: objeto === 'talisman' ? 1.25 : 1,
    distAnt: 0, paladasAnt: 0, hist: [], cuenta: 0, salida: 0, activoSeg: 0, quieto: 0, equipoPal: 0, equipoLeg: 0,
    eventos: [], vistos: 0,
    senda: senda === 'b' ? 'b' : 'a', intensidad: { activa: true, maxActivaciones: null, calentado: false, ...(intensidad || {}) },
    intM: 0, activaciones: 0, usoIntensidad: false, furia: null, harpax: [], remontada: 0,
  };
  if (equipo?.salida) sumarEquipo(e, equipo.salida, 'Velas', 0);
  // Sol Indiges (vela legendaria romana): metros por día de racha del plan.
  if (equipo?.legendaria === 'romano') sumarEquipo(e, 2 * Math.min(7, racha), 'Sol Indiges', 0);
  const g = (slot) => gradoA(e, slot);
  // Boga de la liburna: con 2 días de racha o más, sales por delante.
  if (clase === 'romano' && racha >= 2 && g('m4')) sumar(e, g('m4'), 'm4', 0);
  return e;
}

const nombreDe = (e, slot) => (e.clase ? talentoDe(e.clase, slot, e.senda).nombre : slot);
// Valor de un talento de la senda A (o del tronco común). En la senda B, las mejoras 3, 4 y la maestría son otras.
const gradoA = (e, slot) => (e.clase && !(e.senda === 'b' && SLOTS_SENDA.has(slot)) ? valorDe(e.clase, slot, e.grados[slot] || 0) : 0);
const gradoB = (e, slot) => (e.clase && e.senda === 'b' ? valorDe(e.clase, slot, e.grados[slot] || 0, false, false, 'b') : 0);
// ¿Se puede activar ahora un talento de intensidad? (permiso del día, calentamiento y número de activaciones)
function puedeIntensidad(e, t) {
  const p = e.intensidad;
  if (!p.activa) return false;
  if (!p.calentado && t < 300) return false;
  return p.maxActivaciones == null || e.activaciones < p.maxActivaciones;
}
// Metros de un talento de intensidad: una activación más y su sub-tope de 15 m dentro de los 40 m.
function sumarIntensidad(e, m, slot, t, discreto = false) {
  const x = Math.min(m, SUBTOPE_INTENSIDAD_M - e.intM);
  if (x <= 0) return;
  e.intM += x;
  e.usoIntensidad = true;
  sumar(e, x, slot, t, discreto);
}
// Apaga la intensidad a mitad de camino (cuando se sabe que es una sesión del plan o un día de descanso).
export function apagarIntensidad(e, motivo) {
  if (e) e.intensidad = { ...e.intensidad, activa: false, motivo };
}
// Suma metros de talento con el tope por carrera. discreto: solo un aviso corto en la pista (sin voz).
function sumar(e, m, slot, t, discreto = false) {
  const antes = e.talentos;
  e.talentos = Math.min(e.tope ?? TOPE_TALENTOS_M, e.talentos + m * (e.factor || 1));
  const ganado = Math.round((e.talentos - antes) * 10) / 10;
  if (ganado > 0) e.eventos.push({ t, slot, nombre: nombreDe(e, slot), m: ganado, discreto });
}
// Metros de las piezas de tu bote, con su propio tope por carrera.
function sumarEquipo(e, m, nombre, t, discreto = true) {
  const antes = e.equipoM;
  e.equipoM = Math.min(TOPE_EQUIPO_M, e.equipoM + m);
  const ganado = Math.round((e.equipoM - antes) * 10) / 10;
  if (ganado > 0) e.eventos.push({ t, slot: 'equipo', nombre, m: ganado, discreto });
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
  const g = (slot) => gradoA(e, slot);
  const gB = (slot) => gradoB(e, slot);
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
        e.talentos = Math.min(e.tope ?? TOPE_TALENTOS_M, e.talentos + k * g('m3') * (e.factor || 1));
        e.salida += e.talentos - antes;
        if (Math.floor(paladas) >= 20 && e.salida > 0) { e.eventos.push({ t, slot: 'm3', nombre: nombreDe(e, 'm3'), m: Math.round(e.salida * 10) / 10 }); e.salida = 0; }
      }
      // Berserker · Furia de salida: una salida de 15 paladas por carrera (desde el minuto 5 si no vienes de calentar).
      if (gB('m3') && !e.furia?.hecha && nuevas > 0) {
        if (!e.furia && puedeIntensidad(e, t)) { e.furia = { desde: Math.floor(e.paladasAnt), n: 0 }; e.activaciones++; }
        if (e.furia) {
          e.furia.n = Math.min(15, Math.floor(paladas) - e.furia.desde);
          if (e.furia.n >= 15) { e.furia.hecha = true; sumarIntensidad(e, 15 * gB('m3'), 'm3', t); }
        }
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
      // Remero de carrera · Remontada: en el último 10 % de la distancia, si vas por detrás, cada 50 m.
      const meta = e.final?.meta;
      if (gB('m3') && meta && detras) {
        const ini = meta * 0.9;
        const n3 = dist > ini ? cruces(Math.max(ini, e.distAnt) - ini, Math.min(meta, dist) - ini, 50) : 0;
        if (n3 && (e.remontada || puedeIntensidad(e, t))) {
          if (!e.remontada) e.activaciones++;
          e.remontada += n3;
          sumarIntensidad(e, n3 * gB('m3'), 'm3', t, true);
        }
      }
      break;
    }
    case 'romano': {
      e.activoSeg = activo ? e.activoSeg + 1 : 0;
      if (g('m2') && e.activoSeg && e.activoSeg % 60 === 0) sumar(e, g('m2'), 'm2', t, true);
      break;
    }
    default:
  }
  // Piezas del bote: mascarón (un % en los primeros 2 min), palas (metros cada 100 paladas) y efecto legendario.
  const q = e.equipo;
  if (q) {
    if (q.inicio && t <= 120) {
      const antes = e.equipoM;
      e.equipoM = Math.min(TOPE_EQUIPO_M, e.equipoM + q.inicio * v);
      e.mascaron = (e.mascaron || 0) + e.equipoM - antes;
      // Un solo aviso al terminar los 2 min.
      if (t >= 120 && e.mascaron > 0) { e.eventos.push({ t, slot: 'equipo', nombre: 'Mascarón', m: Math.round(e.mascaron * 10) / 10, discreto: true }); e.mascaron = 0; }
    }
    if (q.porPaladas && nuevas) {
      e.equipoPal += nuevas;
      while (e.equipoPal >= 100) { e.equipoPal -= 100; sumarEquipo(e, q.porPaladas, 'Palas', t); }
    }
    if (q.legendaria === 'vikingo' && nuevas && cruces(e.paladasAnt, paladas, 50)) sumarEquipo(e, cruces(e.paladasAnt, paladas, 50), 'Fuego del Valhalla', t);
    if (q.legendaria === 'samurai') {
      e.equipoLeg = activo ? e.equipoLeg + 1 : 0;
      if (e.equipoLeg && e.equipoLeg % 60 === 0) sumarEquipo(e, 1, 'Dragón de tormenta', t);
    }
    if (q.legendaria === 'polinesio') { const n = cruces(e.distAnt, dist, 500); if (n) sumarEquipo(e, 3 * n, 'Estrellas del navegante', t); }
  }
  e.hist.push({ dist, paladas });
  if (e.hist.length > 10) e.hist.shift();
  e.distAnt = dist;
  e.paladasAnt = paladas;
  // Objetos de la tienda
  if (e.objeto === 'viento' && t <= 120) e.objetoM += 0.03 * v;
  if (e.objeto === 'corriente') e.objetoM = Math.min(30, e.objetoM + 0.015 * v);
  if (e.objeto === 'aire' && e.final && detras) {
    const alFinal = e.final.meta ? dist >= e.final.meta - 250 : t >= e.final.duracion - 60;
    if (alFinal) e.objetoM += 0.03 * v;
  }
  if (e.objeto === 'ancla' && e.final) {
    const alFinal = e.final.meta ? dist >= e.final.meta - 500 : t >= e.final.duracion - 180;
    if (alFinal) e.objetoM += 0.02 * v;
  }
  return metrosVentaja(e);
}

// Adelantaste a un fantasma: Mano rápida del pirata le roba metros.
export function alAdelantar(e, t) {
  if (!e) return;
  // Cuerno de guerra: +5 m al adelantar, hasta 3 veces. Kraken (vela legendaria pirata): +4 m.
  if (e.objeto === 'cuerno' && e.cuernos < 3) { e.cuernos++; e.objetoM += 5; e.eventos.push({ t, slot: 'objeto', nombre: 'Cuerno de guerra', m: 5 }); }
  if (e.equipo?.legendaria === 'pirata') sumarEquipo(e, 4, 'Kraken', t, false);
  // Harpax (romano, senda B): hasta 3 veces por carrera, con 90 s entre una y otra.
  const h = gradoB(e, 'm3');
  if (e.clase === 'romano' && h && e.harpax.length < 3 && (!e.harpax.length || t - e.harpax.at(-1) >= 90) && puedeIntensidad(e, t)) {
    e.harpax.push(t);
    e.activaciones++;
    sumarIntensidad(e, h, 'm3', t);
  }
  if (e.clase !== 'pirata') return;
  const m = gradoA(e, 'm3');
  if (m) sumar(e, m, 'm3', t);
}
export const metrosVentaja = (e) => (e ? e.talentos + e.objetoM + (e.equipoM || 0) : 0);

// Diferencia final con un fantasma, ya con la ventaja y la Segunda oportunidad.
export function diferenciaFinal(real, e) {
  const d = Math.round(real + metrosVentaja(e));
  return e?.objeto === 'segunda' && d < 0 && d > -15 ? 0 : d;
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
  while (salida.length < 6) salida.push(lista.splice(Math.floor(azar() * lista.length), 1)[0]);
  return salida;
}
