// @ts-check
// Resumen de una sesión (etapa 23): lo que se saca de sus muestras y no depende del FTP del día, calculado una vez y
// guardado con la sesión (s.res). Así el historial, el héroe y los récords leen las sesiones sin sus muestras
// (historial.sinMuestras) y las muestras solo se cargan para el detalle, la carrera contra un fantasma o los
// análisis que miran cada segundo. Las funciones que leen el resumen (estadisticas.js: mejorTiempoDe, segundosCon…)
// dan lo mismo que con las muestras: lo comprueba pruebas/resumen.test.mjs.
// Si cambia lo que se guarda, se sube RESUMEN_V y el historial rehace los resúmenes viejos (ver historial.js).
import { mejorTiempo, mejorPotencia, potenciaNormalizada, esfuerzosMaximos, sumaEn, pulsoW, DURACIONES_CURVA } from './estadisticas.js';
import { DISTANCIAS_PREDICCION } from './entrenamientos.js';
import { DISTANCIAS_MARCA } from './prediccion.js';
import { fcMax5s } from './pulso.js';
import { ritmoEstable, sinPausasMuestras, recuperacionesFc } from './juego.js';
import { ventanasTecnica } from './tecnica.js';

export const RESUMEN_V = 2; // el mismo que historial.js
export const DISTANCIAS_RESUMEN = [...new Set([500, 1000, 2000, 5000, 6000, 10000, ...DISTANCIAS_PREDICCION, ...DISTANCIAS_MARCA])];
export const DURACIONES_RESUMEN = [...new Set([...DURACIONES_CURVA, 60, 240, 300, 600, 1200])];

// { v, n, t: {metros: s}, w: {segs: W}, np, em, hw: [[W, segundos]], act, conW, spm24, est, sp, rfc, fc5, tec, bw, pf }.
// pf: por cada pulso, [lpm, segundos, suma de vatios] (los watts a un pulso dado, v2). bw: por cada bloque, [segundos, suma de vatios] de sus muestras (lo que mira revisarFtp). cal: ver abajo.
// Una sesión sin muestras da { v, n: 0 }: así se sabe que ya está resumida.
export function resumir(s) {
  const m = s?.muestras;
  if (!m?.length) return { v: RESUMEN_V, n: 0 };
  const t = {};
  for (const d of DISTANCIAS_RESUMEN) t[d] = mejorTiempo(m, d);
  const w = {};
  for (const d of DURACIONES_RESUMEN) w[d] = mejorPotencia(m, d);
  const hist = new Map();
  for (const x of m) hist.set(x.w, (hist.get(x.w) || 0) + 1);
  return {
    v: RESUMEN_V,
    n: m.length,
    t,
    w,
    np: potenciaNormalizada(m),
    em: esfuerzosMaximos(m),
    hw: [...hist],
    act: m.filter((x) => x.w > 0 || x.spm > 0).length,
    conW: m.filter((x) => x.w > 0).length,
    spm24: m.filter((x) => x.spm >= 24).length,
    est: ritmoEstable(m),
    sp: sinPausasMuestras(m),
    rfc: recuperacionesFc(s),
    fc5: fcMax5s(m),
    tec: ventanasTecnica(s),
    bw: bloquesW(m, s.bloques),
    pf: pulsoW(m),
    // El calentamiento (minuto 4 y 5) de las sesiones con pulso: para «hoy vas más cargado que de costumbre».
    cal: m.some((x) => x.fc) ? m.slice(240, 301) : null,
  };
}

function bloquesW(m, bloques) {
  if (!bloques?.length) return [];
  let t = 0;
  return bloques.map((b) => { const ini = t; t += b.duracion || 0; return sumaEn(m, ini, t); });
}

export const resumenAlDia = (s) => s?.res?.v === RESUMEN_V;
