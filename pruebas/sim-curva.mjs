// Simulador de la curva: perfiles de uso de 2 años sobre estadoJuego real (lo usa pruebas/curva.sim.test.mjs).
// Sesiones sintéticas muy regulares: las misiones de técnica salen más fáciles que en la realidad, así que las cifras
// de misiones son un techo.
import * as J from '../src/juego.js';
import * as T from '../src/talentos.js';

const D = 864e5;
const FTP0 = 200;
const W = (m) => m * 60;
export const clave = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Una sesión hecha de bloques [[seg, %FTP, spm]] con muestras de 1 por segundo.
function sesion(fecha, bloques, extra = {}, ftp = FTP0) {
  const muestras = [];
  let t = 0, dist = 0, pal = 0, kj = 0;
  for (const [seg, p, spm] of bloques) for (let i = 0; i < seg; i++) {
    const w = Math.round(ftp * p * (1 + 0.02 * Math.sin(t / 7)));
    const v = (w / 2.8) ** (1 / 3);
    dist += v; pal += spm / 60; kj += w;
    muestras.push({ t, w, spm, split: Math.round(500 / v), fc: 0, d: Math.round(dist) });
    t++;
  }
  return { fecha, duracion: t, distancia: Math.round(dist), paladas: Math.round(pal), wattsProm: Math.round(kj / t), wattsMax: Math.max(...muestras.map((x) => x.w)),
    kcal: Math.round((kj / 1000) * 1.2 + (t / 60) * 1.5), muestras, ftp, reglasXp: 3, tiempoMeta: t, pctEnRango: 85, pctAlto: 5, pctBajo: 10, ...extra };
}
export const TIPOS = {
  umbral: (f, e, ftp) => sesion(f, [[W(10), 0.6, 22], [W(10), 0.95, 26], [W(3), 0.55, 20], [W(10), 0.95, 26], [W(3), 0.55, 20], [W(10), 0.95, 26], [W(8), 0.55, 20]], { entrenamiento: 'Umbral 3×10', tipoPlan: 'umbral', ...e }, ftp),
  vo2: (f, e, ftp) => sesion(f, [[W(10), 0.6, 22], ...Array.from({ length: 5 }, () => [[W(3), 1.12, 30], [W(3), 0.5, 20]]).flat(), [W(8), 0.55, 20]], { entrenamiento: 'VO2 5×3', tipoPlan: 'vo2', ...e }, ftp),
  fondo30: (f, e, ftp) => sesion(f, [[W(30), 0.68, 22]], { entrenamiento: 'Fondo 30', tipoPlan: 'fondo', ...e }, ftp),
  fondo45: (f, e, ftp) => sesion(f, [[W(45), 0.68, 22]], { entrenamiento: 'Fondo 45', tipoPlan: 'fondo', ...e }, ftp),
  fondo60: (f, e, ftp) => sesion(f, [[W(60), 0.68, 22]], { entrenamiento: 'Fondo 60', tipoPlan: 'fondo', ...e }, ftp),
  rec: (f, e, ftp) => sesion(f, [[W(25), 0.5, 20]], { entrenamiento: 'Recuperación', tipoPlan: 'recuperacion', ...e }, ftp),
  p2000: (f, e, ftp) => sesion(f, [[W(10), 0.6, 22], [450, 1.25, 31], [W(8), 0.5, 20]], { entrenamiento: 'Prueba 2000 m', tipoPlan: 'prueba', ...e }, ftp),
  p500: (f, e, ftp) => sesion(f, [[W(10), 0.6, 22], [100, 1.5, 34], [W(8), 0.5, 20]], { entrenamiento: 'Prueba 500 m', tipoPlan: 'prueba', ...e }, ftp),
  pftp: (f, e, ftp) => sesion(f, [[W(12), 0.6, 22], [W(20), 1.05, 28], [W(8), 0.5, 20]], { entrenamiento: 'Prueba FTP 20 min', tipoPlan: 'prueba', pruebaWatts: Math.round(ftp * 1.05), ...e }, ftp),
  libre30: (f, e, ftp) => sesion(f, [[W(30), 0.78, 24]], { entrenamiento: null, tiempoMeta: null, pctEnRango: null, pctAlto: null, pctBajo: null, ...e }, ftp),
};
const CLASES = ['vikingo', 'pirata', 'samurai', 'polinesio', 'romano'];
function azar(semilla) {
  let x = semilla;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}
function rivales(r, dif, n, miClase) {
  const otras = CLASES.filter((c) => c !== miClase);
  const pGana = { bahia: 0.9, costa: 0.6, altamar: 0.3 }[dif];
  return Array.from({ length: n }, (_, i) => ({ clase: otras[(i + Math.floor(r() * 4)) % 4], dificultad: dif, diferencia: r() < pGana ? Math.round(30 + r() * 200) : -Math.round(20 + r() * 150) }));
}
// Perfiles: días del plan [día de la semana (0 = lunes), tipo], sesiones sugeridas, libres contra fantasmas y pausas.
const PLAN4 = [[1, 'umbral'], [3, 'fondo45'], [5, 'vo2'], [6, 'fondo60']];
const PLAN6 = [[0, 'fondo45'], [1, 'umbral'], [2, 'rec'], [3, 'vo2'], [5, 'fondo60'], [6, 'fondo30']];
const PLAN3 = [[1, 'umbral'], [3, 'fondo45'], [6, 'fondo60']];
export const PERFILES = {
  plan4: { clase: 'vikingo', plan: PLAN4 },
  plan3libre1: { clase: 'pirata', plan: PLAN3, libres: [[4, 'costa']] },
  libre4: { clase: 'pirata', libres: [[0, 'costa'], [2, 'costa'], [4, 'altamar'], [6, 'costa']] },
  // Sin plan, dos fondos sugeridos por semana; cuando la app propone la prueba del jefe, la hace (sigueJefe).
  sugerida2: { clase: 'polinesio', sugeridas: [[1, 'fondo30'], [4, 'fondo45']], sigueJefe: true },
  plan6: { clase: 'romano', plan: PLAN6 },
  intermitente4: { clase: 'samurai', plan: PLAN4, pausa: (w) => w % 10 >= 7 },
  // El ritmo real de Ander (respaldo de noviembre): plan de 4 días del que hace algo más de la mitad, y una semana
  // sin remar cada 9.
  ander: { clase: 'vikingo', plan: PLAN4, hace: 0.55, pausa: (w) => w % 9 === 8 },
};
const pruebaDe = (w) => (w % 6 === 5 ? (w % 12 === 5 ? 'p2000' : 'pftp') : null);

// Las sesiones y el calendario del plan de `semanas` semanas desde el lunes `base` (ms).
export function generar(P, semanas, base, semilla = 7, cambios = new Map()) {
  const r = azar(semilla);
  const ses = [];
  const cal = {};
  for (let w = 0; w < semanas; w++) {
    const ftp = Math.round(FTP0 * (1 + 0.12 * Math.min(1, w / 52)));
    if (P.plan) for (let d = 0; d < 7; d++) cal[clave(base + (w * 7 + d) * D)] = '';
    if (P.pausa?.(w)) continue;
    const descarga = P.plan && w % 4 === 3;
    if (P.plan) P.plan.forEach(([d, tipo], i) => {
      let t = tipo;
      const pr = pruebaDe(w);
      if (i === 0 && pr) t = pr;
      if (descarga && (t === 'vo2' || t === 'umbral')) t = 'fondo30';
      const f = base + (w * 7 + d) * D;
      const s = TIPOS[t](f, { delPrograma: true, delDia: 'plan' }, ftp);
      cal[clave(f)] = s.entrenamiento;
      if (!P.hace || r() < P.hace) ses.push(s);
    });
    for (const [d, t] of P.sugeridas || []) {
      const f = base + (w * 7 + d) * D;
      ses.push(TIPOS[cambios.get(f) || t](f, { delDia: 'sugerida' }, ftp));
    }
    for (const [d, dif] of P.libres || []) ses.push(TIPOS.libre30(base + (w * 7 + d) * D + 3600e3, { rivales: rivales(r, dif, 3, P.clase) }, ftp));
  }
  return { ses: ses.sort((a, b) => a.fecha - b.fecha), cal };
}

// La sugerida propone la prueba del jefe tras SUGERIR_JEFE_DIAS con el capítulo abierto (adaptacion.js): con los
// niveles de una pasada, qué sugeridas pasan a ser esa prueba. Devuelve Map(fecha → tipo de sesión).
const PRUEBA_SIM = { 'base:prueba-500': 'p500', 'base:prueba-2000': 'p2000', 'base:prueba-ftp': 'pftp' };
function pruebasDeJefe(h, ses) {
  const cambios = new Map();
  let cap = 0, abierto = null, nivel = 1;
  for (const s of ses) {
    if (cap >= J.CAPITULOS.length) break;
    if (abierto == null && nivel >= J.CAPITULOS[cap].nivel) abierto = s.fecha;
    if (s.delDia === 'sugerida' && abierto != null && s.fecha - abierto >= J.SUGERIR_JEFE_DIAS * D) {
      cambios.set(s.fecha, PRUEBA_SIM[J.PRUEBA_JEFE[J.CAPITULOS[cap].jefe.tipo]]);
      cap++; abierto = null;
    }
    nivel = h.porSesion.get(s.fecha)?.nivelDespues || nivel;
  }
  return cambios;
}

// Talentos: reparto codicioso en la fecha en que se alcanza cada nivel.
function arbolDesde(h, clase) {
  const arbol = {};
  const orden = ['m2', 'm4', 'maestria', 'm1', 'm3'];
  let gastados = 0;
  for (const [fecha, p] of h.porSesion) {
    let libres = T.puntosDeNivel(p.nivelDespues) - gastados;
    for (const slot of orden) while (!T.motivoBloqueo(slot, { nivel: p.nivelDespues, libres }, arbol, clase)) {
      (arbol[slot] ||= []).push(fecha + 1000);
      const c = T.costeDe(slot);
      libres -= c; gastados += c;
    }
  }
  return arbol;
}

// Corre un perfil: estado del juego al final, con los talentos repartidos (pasadas = veces que se reparte).
export function simular(nombre, { semanas = 104, base = new Date('2026-11-23T19:00').getTime(), pasadas = 1 } = {}) {
  const P = PERFILES[nombre];
  let { ses, cal } = generar(P, semanas, base);
  const ahora = base + semanas * 7 * D;
  const opts = { ftp: FTP0, ahora, calendario: P.plan ? cal : null, metaSemanaKm: 20 };
  let per = { clase: P.clase, arbol: { [P.clase]: {} } };
  let h = J.estadoJuego(ses, { ...opts, per });
  // Quien sigue la sugerida hace la prueba del jefe cuando se la propone (dos vueltas: la prueba cambia los niveles).
  if (P.sigueJefe) for (let k = 0; k < 2; k++) {
    ({ ses } = generar(P, semanas, base, 7, pruebasDeJefe(h, ses)));
    h = J.estadoJuego(ses, { ...opts, per });
  }
  for (let k = 0; k < pasadas; k++) {
    per = { clase: P.clase, arbol: { [P.clase]: arbolDesde(h, P.clase) } };
    h = J.estadoJuego(ses, { ...opts, per });
  }
  const semanaDe = (f) => Math.floor((f - base) / (7 * D)) + 1;
  let legendario = null;
  for (const [f, p] of h.porSesion) if (p.nivelDespues >= 90) { legendario = semanaDe(f); break; }
  const xpSesiones = [...h.porSesion.values()].reduce((a, p) => a + p.xp + p.xpExtra, 0);
  const xpMisiones = h.logros.filter((l) => l.tipo === 'diaria' || l.tipo === 'semanal').reduce((a, l) => a + l.xp, 0);
  const finales = [...h.porSesion.entries()].filter(([f]) => semanaDe(f) > semanas - 8).map(([, p]) => p.xp + p.xpExtra);
  // Semana de cada jefe vencido y el hueco más largo sin jefe (contando desde el principio y hasta el final).
  const jefes = h.logros.filter((l) => l.tipo === 'jefe').map((l) => semanaDe(l.fecha));
  const bordes = [0, ...jefes, ...(jefes.length < J.CAPITULOS.length ? [semanas] : [])];
  const huecoMax = Math.max(...bordes.slice(1).map((j, i) => j - bordes[i]));
  return {
    h, ses, legendario, jefes, huecoMax, xpSesiones, xpMisiones, pctMisiones: xpSesiones ? (100 * xpMisiones) / xpSesiones : 0,
    xpSesionFinal: finales.reduce((a, b) => a + b, 0) / (finales.length || 1),
    diarias: h.logros.filter((l) => l.tipo === 'diaria'), diasDeRemo: new Set(ses.map((s) => clave(s.fecha))).size,
  };
}
