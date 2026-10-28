// Ventajas en la carrera contra fantasmas: talentos II y objetos de la tienda.
// Solo cambian el resultado de la carrera (metros de ventaja); nunca tus metros, tiempos ni récords.
import { TOPE_TALENTOS_M } from './talentos.js';

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

const VENTANA = 60; // segundos para medir el ritmo estable
const CV_ESTABLE = 0.06;

// grados = { 'potencia-2': 0|1, … }; nombres = nombres de los talentos de la clase; final = { meta } o { duracion } si la carrera tiene final.
export function nuevaVentaja({ grados = {}, nombres = {}, ftp = 0, objeto = null, final = null } = {}) {
  return {
    grados, nombres, ftp, objeto, final,
    talentos: 0, objetoM: objeto === 'salida' ? 15 : 0,
    sobreFtp: 0, ultimaCarga: -Infinity, velocidades: [], segParejo: 0, ralentiza: 0, distAnt: 0,
    eventos: [],
  };
}

const estable = (vs) => {
  if (vs.length < VENTANA || vs.some((v) => v <= 0)) return false;
  const media = vs.reduce((a, v) => a + v, 0) / vs.length;
  const sd = Math.sqrt(vs.reduce((a, v) => a + (v - media) ** 2, 0) / vs.length);
  return sd / media < CV_ESTABLE;
};

// Un segundo de carrera: muestra = { t, w, dist }. Devuelve los metros de ventaja totales.
export function avanzarVentaja(e, { t, w, dist }) {
  const v = Math.max(0, dist - e.distAnt);
  e.distAnt = dist;
  e.velocidades.push(v);
  if (e.velocidades.length > VENTANA) e.velocidades.shift();
  const parejo = estable(e.velocidades);
  const sumar = (m, slot) => {
    const antes = e.talentos;
    e.talentos = Math.min(TOPE_TALENTOS_M, e.talentos + m);
    if (slot && e.talentos > antes) e.eventos.push({ t, slot, nombre: e.nombres[slot] || slot, m: Math.round((e.talentos - antes) * 10) / 10 });
  };
  // Potencia II: 20 s seguidos sobre el FTP → +15 m, como mucho una vez cada 2 min.
  if (e.grados['potencia-2'] && e.ftp > 0) {
    e.sobreFtp = w > e.ftp ? e.sobreFtp + 1 : 0;
    if (e.sobreFtp >= 20 && t - e.ultimaCarga >= 120) { sumar(15, 'potencia-2'); e.ultimaCarga = t; e.sobreFtp = 0; }
  }
  // Fondo II: cada 10 min a ritmo parejo → +10 m.
  if (e.grados['fondo-2'] && parejo && ++e.segParejo % 600 === 0) sumar(10, 'fondo-2');
  // Disciplina II: 60 s estables → durante 60 s los fantasmas reman un 1 % más lento (≈ 1 % de tu avance).
  if (e.grados['disciplina-2']) {
    if (e.ralentiza > 0) { e.ralentiza--; sumar(0.01 * v); } else if (parejo) {
      e.ralentiza = 60;
      e.velocidades = [];
      e.eventos.push({ t, slot: 'disciplina-2', nombre: e.nombres['disciplina-2'] || 'disciplina-2', m: 0 });
    }
  }
  // Objetos de la tienda
  if (e.objeto === 'viento' && t <= 120) e.objetoM += 0.02 * v;
  if (e.objeto === 'ancla' && e.final) {
    const alFinal = e.final.meta ? dist >= e.final.meta - 500 : t >= e.final.duracion - 180;
    if (alFinal) e.objetoM += 0.02 * v;
  }
  return metrosVentaja(e);
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
