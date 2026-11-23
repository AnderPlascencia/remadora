// Registro de predicciones y su error (etapa 17, REN-P9): cada vez que remas a tope un 500, 2000, 5000 o 10 000 m,
// se guarda lo que la app predecía antes de esa sesión. Así cualquier cambio del modelo se puede medir.
import { mejorPotencia, mejorTiempo, mejorTiempoDe, nMuestras, potenciaCriticaMax } from './estadisticas.js';
import { sugerirMeta } from './programa.js';
// Lo que pintan el detalle y Progreso vive en estadisticas.js (primera carga); este módulo se carga al terminar una marca.
export { resumenPredicciones, textoPrediccion } from './estadisticas.js';

export const DISTANCIAS_MARCA = [500, 2000, 5000, 10000];
const ordenar = (ss) => [...(ss || [])].sort((a, b) => a.fecha - b.fecha);

// A tope: un tramo parejo (no la mitad fuerte y el resto calentamiento), que no es un trozo de algo más largo igual de
// fuerte (un 500 dentro de una serie) y, fuera de las pruebas, que llega al 95 % de lo que aguantas en ese tiempo según
// tu CP y W′ (un 10 000 m de fondo no es un 10 000 m a tope aunque sea tu mejor).
const DIA = 864e5;
function aTope(muestras, t, pc, prueba) {
  const w = mejorPotencia(muestras, t);
  if (!w) return false;
  const largo = mejorPotencia(muestras, Math.round(t * 1.5));
  const parejo = w >= 0.93 * (mejorPotencia(muestras, Math.round(t / 2)) || w);
  if (!parejo || (largo != null && largo >= w * 0.97)) return false;
  return prueba || (!!pc && w >= 0.95 * (pc.cp + pc.wPrima / t));
}
// Distancias que la sesión remó a tope: en una prueba, o una marca nueva donde ya tenías marca.
export function marcasATope(s, previas = []) {
  const res = [];
  const pc = potenciaCriticaMax(previas.filter((x) => x.fecha < s.fecha && x.fecha > s.fecha - 90 * DIA));
  for (const d of DISTANCIAS_MARCA) {
    const t = s.muestras?.length ? mejorTiempo(s.muestras, d) : null;
    if (!t) continue;
    const antes = previas.map((x) => (nMuestras(x) ? mejorTiempoDe(x, d) : null)).filter((x) => x > 0);
    const record = antes.length > 0 && t < Math.min(...antes);
    if ((s.tipoPlan === 'prueba' || record) && aTope(s.muestras, t, pc, s.tipoPlan === 'prueba')) res.push({ d, real: t });
  }
  return res;
}

// Lo que la app predecía para `d` con lo remado antes (el mismo cálculo que el asistente de metas).
export function prediccionPara(previas, d, ahora) {
  const p = sugerirMeta(previas.filter((x) => x.fecha < ahora), d, 8, ahora);
  return p ? { pred: p.t, desde: p.desde, real: p.real } : null;
}

// Para guardar con la sesión: [{ d, pred, real, error (%, + si fuiste más rápido de lo previsto), desde }].
export function registrarPredicciones(s, previas = []) {
  return marcasATope(s, previas).map(({ d, real }) => {
    const p = prediccionPara(previas, d, s.fecha);
    if (!p) return null;
    return { d, pred: p.pred, real, error: Math.round((1000 * (p.pred - real)) / real) / 10, desde: p.desde };
  }).filter(Boolean);
}

// Recorre un historial como si cada sesión se acabara de remar: lo que habría quedado registrado.
export function backtest(sesiones) {
  const orden = ordenar(sesiones);
  return orden.map((s, i) => ({ ...s, predicciones: registrarPredicciones(s, orden.slice(0, i)) }));
}
