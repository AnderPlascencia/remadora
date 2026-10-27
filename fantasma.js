// Fantasmas simulados: generan una sesión del entrenamiento elegido para remar contra ella.
// Cada fantasma tiene un FTP de referencia y rema cada intervalo a la intensidad relativa que
// pide el plan, con variaciones naturales de ritmo y cansancio en los tramos fuertes y largos.
import * as Ent from './entrenamientos.js';
import { distanciaEn } from './estadisticas.js';

export const NIVELES = {
  principiante: { nombre: 'Principiante', ftp: 110, spm: 22, fatiga: 0.08, variacion: 0.035 },
  intermedio: { nombre: 'Intermedio', ftp: 170, spm: 25, fatiga: 0.05, variacion: 0.025 },
  avanzado: { nombre: 'Avanzado', ftp: 250, spm: 28, fatiga: 0.03, variacion: 0.015 },
};

// Velocidad (m/s) a partir de watts con la fórmula estándar de remo: W = 2.8 · v³.
export const velocidad = (w) => (w > 0 ? Math.cbrt(w / 2.8) : 0);
export const splitDeWatts = (w) => (w > 0 ? Math.round(500 / velocidad(w)) : 0);
export const wattsDeVelocidad = (v) => 2.8 * v ** 3;

// Fracción del FTP que pide un bloque (para trasladarla al FTP del fantasma).
function intensidad(b, ftpUsuario) {
  const base = ftpUsuario || 170;
  if (b.prueba) return 1;
  if (b.metrica === 'ftp') return (b.min + b.max) / 200;
  if (b.metrica === 'watts') return (b.min + (b.max || b.min)) / 2 / base;
  if (b.metrica === 'split') return Ent.wattsDeSplit((b.min + b.max) / 2) / base;
  if (b.metrica === 'spm') return 0.75;
  return 0.6;
}

// Estilo de remo de cada clase rival: multiplica la potencia según el segundo t de una sesión de T segundos.
// Todos promedian cerca de 1, así que el FTP del rival marca su nivel y el estilo, cómo lo reparte.
export const ESTILOS = {
  vikingo: { texto: 'Sale muy fuerte y se cansa al final', f: (t, T) => 1.06 - 0.12 * (t / T) },
  pirata: { texto: 'Ritmo irregular, con acelerones por sorpresa', f: (t) => ((t + 40) % 150 < 20 ? 1.09 : 0.985) },
  samurai: { texto: 'Ritmo muy constante y un remate final controlado', f: (t, T) => (t / T > 0.92 ? 1.05 : 0.996) },
  polinesio: { texto: 'Empieza suave y termina más rápido de lo que empezó', f: (t, T) => 0.95 + 0.1 * (t / T) },
  romano: { texto: 'Ritmo de metrónomo con un ataque corto cada 5 min', f: (t) => (t % 300 >= 270 ? 1.07 : 0.993) },
};

// Perfil del fantasma: un nivel por nombre o uno a la medida { ftp, nombre, estilo? }.
function perfil(nivel) {
  if (typeof nivel === 'string') return { clave: nivel, ...NIVELES[nivel] };
  const ftp = nivel.ftp;
  const cercano = ftp < 140 ? NIVELES.principiante : ftp < 210 ? NIVELES.intermedio : NIVELES.avanzado;
  const estilo = ESTILOS[nivel.estilo] || null;
  // El samurái apenas varía; el pirata, mucho.
  const variacion = nivel.estilo === 'samurai' ? cercano.variacion / 2 : nivel.estilo === 'pirata' ? cercano.variacion * 1.6 : cercano.variacion;
  return { ...cercano, variacion, clave: 'personalizado', nombre: nivel.nombre || `${ftp} W`, ftp, estilo };
}

// Sesión simulada: { nivel, nombre, muestras: [{ t, dist, w, spm }] }.
export function simular(ent, nivel, ftpUsuario = 0) {
  const p = perfil(nivel);
  // Con estilo, primero se mide cuánto dura la sesión sin él para repartir el esfuerzo.
  const T = p.estilo ? simular(ent, { ...nivel, estilo: null }, ftpUsuario).muestras.length || 1 : 1;
  const estilo = p.estilo ? (tt) => p.estilo.f(tt, T) : () => 1;
  const muestras = [];
  let t = 0;
  let dist = 0;
  // Ruido suave y repetible: dos ondas lentas con fase fija por nivel.
  const fase = p.ftp * 0.37;
  const ruido = (tt) => p.variacion * (0.6 * Math.sin(tt / 37 + fase) + 0.4 * Math.sin(tt / 11.3 + 2 * fase));

  const remar = (rel, hasta, durEstimada) => {
    const w0 = p.ftp * rel;
    const cansa = rel >= 0.85 && durEstimada > 120;
    const t0 = t;
    const spm = Math.round(Math.min(36, Math.max(18, p.spm + (rel - 0.75) * 20)));
    while (!hasta(t, dist) && t < 4 * 3600) {
      const avance = Math.min(1, (t - t0) / durEstimada);
      const w = w0 * (1 + ruido(t) - (cansa ? p.fatiga * avance ** 1.5 : 0)) * estilo(t);
      t += 1;
      dist += velocidad(w);
      muestras.push({ t, dist: Math.round(dist * 10) / 10, w: Math.round(w), spm });
    }
  };

  if (ent && Ent.tipoDe(ent) === 'intervalos') {
    for (const b of ent.bloques) {
      const rel = intensidad(b, ftpUsuario);
      const t0 = t;
      const d0 = dist;
      const fin = Ent.finDe(b);
      if (fin === 'distancia') remar(rel, (_, d) => d - d0 >= b.cantidad, b.cantidad / velocidad(p.ftp * rel));
      else if (fin === 'paladas') {
        const dur = Math.round((b.cantidad * 60) / 24);
        remar(rel, (tt) => tt - t0 >= dur, dur);
      } else remar(rel, (tt) => tt - t0 >= b.duracion, b.duracion);
    }
  } else if (ent?.objetivo) {
    const rel = 0.9;
    const v = velocidad(p.ftp * rel);
    const { metrica, valor } = ent.objetivo;
    if (metrica === 'distancia') remar(rel, (_, d) => d >= valor, valor / v);
    else if (metrica === 'paladas') {
      const dur = Math.round((valor * 60) / 26);
      remar(rel, (tt) => tt >= dur, dur);
    } else {
      const dur = Math.round(valor / ((p.ftp * rel) / 0.2 / 4184 + 75 / 3600));
      remar(rel, (tt) => tt >= dur, dur);
    }
  } else {
    remar(0.8, (tt) => tt >= 3600, 3600);
  }
  return { nivel: p.clave, nombre: `Fantasma ${p.nombre.toLowerCase()}`, sintetico: true, ftp: p.ftp, muestras };
}

// Fantasma que termina el entrenamiento en `segundos` (solo si su duración depende del ritmo,
// es decir, objetivos de distancia o intervalos por distancia). null si no aplica.
export function simularPorTiempo(ent, segundos, ftpUsuario = 0) {
  const fin = (ftp) => simular(ent, { ftp }, ftpUsuario).muestras.length;
  if (fin(80) === fin(400)) return null;
  let lo = 30;
  let hi = 900;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fin(mid) > segundos) lo = mid; else hi = mid;
  }
  const ftp = Math.round(hi);
  const m = Math.floor(segundos / 60);
  const s = String(Math.round(segundos % 60)).padStart(2, '0');
  return { ...simular(ent, { ftp }, ftpUsuario), nivel: 'personalizado', nombre: `Fantasma ${m}:${s}` };
}

// Una sesión guardada, pero un porcentaje más rápida.
export function acelerar(sesion, pct) {
  const f = 1 + pct / 100;
  const total = sesion.muestras.at(-1).t;
  const muestras = [];
  for (let t = 1; t <= Math.ceil(total / f); t++) {
    const x = Math.min(total, t * f);
    const base = sesion.muestras[Math.min(sesion.muestras.length - 1, Math.max(0, Math.floor(x) - 1))];
    muestras.push({ t, dist: distanciaEn(sesion.muestras, x), w: 0, spm: Math.round((base.spm || sesion.spmProm || 24) * f) });
  }
  return { nivel: 'personalizado', nombre: `Tu mejor +${pct}%`, sintetico: true, muestras };
}

// Golpes por minuto del fantasma en el segundo t (para animar los remos).
export function spmEn(rival, t) {
  const m = rival.muestras;
  if (!m?.length) return 0;
  const i = Math.min(m.length - 1, Math.max(0, Math.floor(t) - 1));
  return m[i].spm ?? 24;
}

// Segundo en que el fantasma llega a `metros` (null si no llega).
export function tiempoA(rival, metros) {
  const m = rival.muestras;
  if (!m?.length || m.at(-1).dist < metros) return null;
  let lo = 0;
  let hi = m.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (m[mid].dist >= metros) hi = mid; else lo = mid + 1;
  }
  const b = m[lo];
  const a = m[lo - 1] || { t: 0, dist: 0 };
  return a.t + ((metros - a.dist) / (b.dist - a.dist || 1)) * (b.t - a.t);
}

// Proyección: con tu velocidad reciente, ¿cómo termina la carrera contra cada fantasma?
// yo = { t, dist, v }; meta en metros (objetivo de distancia) o duración total en segundos.
export function proyectar(yo, rivales, { meta = null, duracion = null } = {}) {
  if (!(yo.v > 0) || !rivales.length) return null;
  if (meta) {
    const miTiempo = yo.dist >= meta ? yo.t : yo.t + (meta - yo.dist) / yo.v;
    const filas = rivales.map((r) => ({ nombre: r.nombre, tiempo: tiempoA(r, meta) }));
    const lugar = 1 + filas.filter((f) => f.tiempo != null && f.tiempo < miTiempo).length;
    return { tipo: 'meta', miTiempo, filas: filas.map((f) => ({ ...f, diferencia: f.tiempo == null ? null : f.tiempo - miTiempo })), lugar, total: rivales.length + 1 };
  }
  if (duracion && duracion > yo.t) {
    const miDist = yo.dist + yo.v * (duracion - yo.t);
    const filas = rivales.map((r) => ({ nombre: r.nombre, dist: distanciaEn(r.muestras, duracion) }));
    const lugar = 1 + filas.filter((f) => f.dist > miDist).length;
    return { tipo: 'duracion', miDist, filas: filas.map((f) => ({ ...f, diferencia: miDist - f.dist })), lugar, total: rivales.length + 1 };
  }
  return null;
}
