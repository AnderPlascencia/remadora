// @ts-check
// ⚖ Ganarte a ti mismo (ronda 2, R2-6 y R2-7): tu yo pasado, el reto devuelto, la mejora real y la escalera de fuerza.
// Desde GANARTE_DESDE; lo remado antes sigue con las reglas de antes. Detalle en CHANGELOG (0.130.0).
import { claveDia, mejorTiempoDe, nMuestras, ftpDeSesion } from './estadisticas.js';

export const GANARTE_DESDE = '2026-11-26';
export const esGanarte = (fecha) => claveDia(fecha) >= GANARTE_DESDE;
export const XP_YO_PASADO = 60;
export const MONEDAS_YO_PASADO = 15;
export const XP_MEJORA_REAL_GANARTE = 600;
export const MONEDAS_MEJORA_REAL_GANARTE = 80;
export const ESCALON_FTP_W = 5;
export const XP_ESCALON_FTP = 300;
export const MONEDAS_ESCALON_FTP = 50;
// eFTP: el de hace 6 semanas como base, con al menos 3 sesiones que lo estimen.
export const EFTP_SEMANAS = 6;
const D = 864e5;

// Qué referencia era: las sesiones guardadas antes de la etapa no traen `clave`, así que se deduce del nombre.
export function claveReferencia(r) {
  if (r?.clave) return r.clave;
  const n = r?.nombre || '';
  if (/^Tu yo de hace/.test(n)) return 'pasado';
  if (/^Reto de /.test(n)) return 'reto';
  if (/^Tu mejor/.test(n)) return 'mejor';
  return 'anterior';
}
// Una sesión que cuenta para ganarte: el entrenamiento completo o, en Remo libre, 10 min o más.
export const sesionCompleta = (s) => (s.entrenamiento ? s.tiempoMeta != null : (s.duracion || 0) >= 600);
const referencia = (s, clave) => (s.referencias || []).find((r) => claveReferencia(r) === clave) || null;
// La referencia «Yo hace 7 semanas» ganada en esta sesión, o null.
export function yoPasadoGanado(s) {
  const r = referencia(s, 'pasado');
  return r && sesionCompleta(s) && r.diferencia > 0 ? r : null;
}
// El reto recibido en esta sesión: { ref, gano } si lo remaste hasta el final, o null.
export function retoRemado(s) {
  const r = referencia(s, 'reto');
  return r && sesionCompleta(s) ? { ref: r, gano: r.segundos != null ? r.segundos > 0 : r.diferencia > 0 } : null;
}
export const nombreReto = (r) => (r?.nombre || '').replace(/^Reto de /, '').trim();
// «4 s» o «42 m»: por cuánto ganaste (en segundos si el reto era de distancia).
export function margen(r) {
  if (r?.segundos > 0) return `${Math.round(r.segundos)} s`;
  return `${Math.abs(Math.round(r?.diferencia || 0)).toLocaleString('es-MX')} m`;
}
const fechaLarga = (ms) => new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
export function textoYoPasado(r) {
  return `Le ganaste a tu yo${r.fecha ? ` del ${fechaLarga(r.fecha)}` : ' de hace 7 semanas'} por ${margen(r)}`;
}

// ¿Hay con qué ganarte esta semana? Una sesión de hace 5 a 8 semanas (con muestras) del mismo entrenamiento que
// alguna de las últimas 4 semanas: así «Yo hace 7 semanas» tendrá contra quién remar.
export function hayYoPasado(sesiones, desde) {
  const recientes = new Set(sesiones.filter((s) => s.fecha < desde && s.fecha >= desde - 28 * D).map((s) => s.entrenamiento || null));
  return sesiones.some((s) => s.fecha >= desde - 56 * D && s.fecha < desde - 35 * D && nMuestras(s) && recientes.has(s.entrenamiento || null));
}

// eFTP en un momento: la mediana de las 3 mejores de tus últimas 20 sesiones de los 90 días anteriores (como
// ftpEstimadoDe). lista: [{ fecha, w }] en orden. null si hay menos de 3 sesiones que lo estimen.
export function eftpEn(lista, t) {
  const w = [];
  for (let i = lista.length - 1; i >= 0 && w.length < 20; i--) {
    const x = lista[i];
    if (x.fecha > t) continue;
    if (x.fecha <= t - 90 * D) break;
    if (x.w > 0) w.push(x.w);
  }
  if (w.length < 3) return null;
  const tres = w.sort((a, b) => b - a).slice(0, 3);
  return Math.round(tres[1]);
}

const PCT = 0.02;
// Mejora real con las reglas nuevas. previos: { t500, t1000, t2000, t5000, prueba, eftpBase } antes de esta sesión, y
// eftp: el de ahora, contando esta sesión. Devuelve el texto del logro o null.
export function mejoraRealGanarte(s, previos, eftp) {
  if (nMuestras(s)) {
    for (const m of [2000, 5000, 1000, 500]) {
      const antes = previos[`t${m}`];
      const v = mejorTiempoDe(s, m);
      if (antes > 0 && v > 0 && v <= antes * (1 - PCT)) return `Mejora real: ${m} m un ${Math.round((1 - v / antes) * 100)} % más rápido`;
    }
  }
  if (previos.prueba > 0 && s.pruebaWatts >= previos.prueba * (1 + PCT)) return `Mejora real: tu prueba de FTP un ${Math.round((s.pruebaWatts / previos.prueba - 1) * 100)} % más fuerte`;
  // El eFTP sube con esta sesión: tiene que ser de las que lo empujan, no una suave del mismo día.
  const base = previos.eftpBase;
  if (base > 0 && eftp >= base * (1 + PCT) && ftpDeSesion(s) >= eftp * 0.97) return `Mejora real: tu FTP estimado subió a ${eftp} W (${Math.round((eftp / base - 1) * 100)} % más que hace ${EFTP_SEMANAS} semanas)`;
  return null;
}

// Escalera de fuerza: { mejora, escalon, siguiente } con la mejora de FTP en W desde tu primera sesión con FTP.
export function escaleraFtp(mejora) {
  const m = Math.max(0, Math.floor(mejora || 0));
  const escalon = Math.floor(m / ESCALON_FTP_W);
  return { mejora: m, escalon, siguiente: (escalon + 1) * ESCALON_FTP_W };
}
