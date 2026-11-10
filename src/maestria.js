// Maestría de clase (etapa 7 del rediseño del héroe, decisión D7.1 de Ander: primero la maestría). Cada clase tiene
// su propio nivel de maestría, del 1 al 10, que sube con las sesiones remadas con esa clase. Cambiar de clase no
// borra nada: cada una guarda su maestría, así que probar otra cultura no cuesta lo ganado.
// Ritmo: con 4 sesiones por semana, la maestría 10 llega en unos 15 meses, antes que el Legendario (unos 18).
// Las sesiones anteriores cuentan para el nivel; las monedas solo se pagan por los niveles alcanzados desde
// MAESTRIA_DESDE, para no dar de golpe un botín por el pasado.
export const MAESTRIA_DESDE = '2026-11-11';
export const MAESTRIA_MAX = 10;
// Sesiones con la clase para cada nivel (el 1 llega con la primera).
export const SESIONES_MAESTRIA = [1, 8, 20, 36, 56, 80, 110, 150, 200, 260];
export const MONEDAS_MAESTRIA = 50;
// Sesiones que cuentan: 10 min o más.
export const MIN_SEG_MAESTRIA = 600;
// Nombre de cada nivel: el del 10 es el de quien domina su cultura.
export const NOMBRES_MAESTRIA = ['Aprendiz', 'Aprendiz', 'Iniciado', 'Iniciado', 'Diestro', 'Diestro', 'Experto', 'Experto', 'Maestro', 'Gran maestro'];

export const nivelMaestria = (sesiones) => SESIONES_MAESTRIA.filter((x) => sesiones >= x).length;
export const monedasMaestria = (nivel) => MONEDAS_MAESTRIA * nivel;
export const nombreMaestria = (nivel) => (nivel > 0 ? NOMBRES_MAESTRIA[Math.min(MAESTRIA_MAX, nivel) - 1] : '');

// Clase con la que remabas en una fecha (ms). per.claseHist = [[ms, clase], …], cada cambio con su fecha;
// sin historial, la clase de ahora.
export function claseEn(per, fecha) {
  const h = per?.claseHist || [];
  if (!h.length) return per?.clase || null;
  return h.filter(([f]) => f <= fecha).at(-1)?.[1] ?? h[0][1];
}

// Historial de clases al elegir una nueva: si no lo había, la clase anterior cuenta desde siempre.
export function conClaseNueva(per, clase, ahora = Date.now()) {
  const h = per?.claseHist?.length ? per.claseHist : per?.clase ? [[0, per.clase]] : [];
  return h.at(-1)?.[1] === clase ? h : [...h, [ahora, clase]];
}

// Estado de la maestría de una clase con `n` sesiones: { nivel, nombre, sesiones, desde, hasta, siguiente }.
export function maestriaDe(n) {
  const nivel = nivelMaestria(n);
  const hasta = SESIONES_MAESTRIA[nivel] ?? null;
  return { nivel, nombre: nombreMaestria(nivel), sesiones: n, desde: SESIONES_MAESTRIA[nivel - 1] ?? 0, hasta, siguiente: hasta == null ? null : hasta - n };
}
