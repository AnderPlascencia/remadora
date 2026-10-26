// Fantasmas simulados por nivel: generan una sesión "ideal" del entrenamiento elegido
// para remar contra ella. Cada nivel tiene un FTP de referencia y rema cada intervalo
// a la misma intensidad relativa que pide el plan.
import * as Ent from './entrenamientos.js';

export const NIVELES = {
  principiante: { nombre: 'Principiante', ftp: 110 },
  intermedio: { nombre: 'Intermedio', ftp: 170 },
  avanzado: { nombre: 'Avanzado', ftp: 250 },
};

// Velocidad (m/s) a partir de watts con la fórmula estándar de remo: W = 2.8 · v³.
export const velocidad = (w) => (w > 0 ? Math.cbrt(w / 2.8) : 0);
export const splitDeWatts = (w) => (w > 0 ? Math.round(500 / velocidad(w)) : 0);

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

// Sesión simulada: { nivel, nombre, muestras: [{ t, dist, w }] }.
export function simular(ent, nivel, ftpUsuario = 0) {
  const ref = NIVELES[nivel];
  const muestras = [];
  let t = 0;
  let dist = 0;
  const remar = (w, hasta) => {
    const v = velocidad(w);
    while (!hasta(t, dist) && t < 4 * 3600) {
      t += 1;
      dist += v;
      muestras.push({ t, dist: Math.round(dist), w: Math.round(w) });
    }
  };
  if (ent && Ent.tipoDe(ent) === 'intervalos') {
    for (const b of ent.bloques) {
      const w = ref.ftp * intensidad(b, ftpUsuario);
      const t0 = t;
      const d0 = dist;
      const fin = Ent.finDe(b);
      if (fin === 'distancia') remar(w, (_, d) => d - d0 >= b.cantidad);
      else if (fin === 'paladas') remar(w, (tt) => tt - t0 >= Math.round((b.cantidad * 60) / 24));
      else remar(w, (tt) => tt - t0 >= b.duracion);
    }
  } else if (ent?.objetivo) {
    const w = ref.ftp * 0.9;
    const { metrica, valor } = ent.objetivo;
    if (metrica === 'distancia') remar(w, (_, d) => d >= valor);
    else if (metrica === 'paladas') remar(w, (tt) => tt >= Math.round((valor * 60) / 26));
    else remar(w, (tt) => tt >= Math.round(valor / (w / 0.2 / 4184 + 75 / 3600)));
  } else {
    remar(ref.ftp * 0.8, (tt) => tt >= 3600);
  }
  return { nivel, nombre: `Fantasma ${ref.nombre.toLowerCase()}`, sintetico: true, muestras };
}
