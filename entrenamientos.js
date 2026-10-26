// Lógica de los entrenamientos, sin dependencias de la interfaz.
//
// Dos tipos:
//  - 'objetivo':   { tipo, nombre, objetivo: { metrica: 'kcal'|'distancia'|'paladas', valor } }
//  - 'intervalos': { tipo, nombre, bloques: [{ nombre, duracion (s), metrica, min, max, nivel? }] }
//    metrica: 'watts' (min/max en W), 'ftp' (min/max en % del FTP), 'spm' (golpes/min) o '' (libre).
//    nivel (1-24, opcional): resistencia que se pide a la consola si la resistencia automática está activa.

// Zonas de potencia como % del FTP.
export const ZONAS = [
  { n: 1, nombre: 'Recuperación', min: 40, max: 55 },
  { n: 2, nombre: 'Resistencia', min: 56, max: 75 },
  { n: 3, nombre: 'Tempo', min: 76, max: 90 },
  { n: 4, nombre: 'Umbral', min: 91, max: 105 },
  { n: 5, nombre: 'VO2 máx', min: 106, max: 120 },
  { n: 6, nombre: 'Anaeróbica', min: 121, max: 150 },
];

export function zonaDe(watts, ftp) {
  if (!ftp || !watts) return null;
  const pct = (100 * watts) / ftp;
  return ZONAS.find((z) => pct <= z.max) || ZONAS.at(-1);
}

// Rango del bloque en watts (convierte % del FTP). null si el bloque no tiene meta de potencia.
export function rangoWatts(b, ftp) {
  if (b.metrica === 'watts') return { min: b.min, max: b.max };
  if (b.metrica === 'ftp' && ftp) return { min: Math.round((b.min * ftp) / 100), max: Math.round((b.max * ftp) / 100) };
  return null;
}

// Texto corto de la meta de un bloque.
export function textoMeta(b, ftp) {
  const r = rangoWatts(b, ftp);
  if (b.metrica === 'ftp') return r ? `${r.min}–${r.max} W (${b.min}–${b.max}% FTP)` : `${b.min}–${b.max}% FTP`;
  if (r) return `${r.min}–${r.max} W`;
  if (b.metrica === 'spm') return `${b.min}–${b.max} golpes/min`;
  return 'Libre';
}

export const METRICAS_OBJETIVO = {
  distancia: { nombre: 'Distancia', unidad: 'm' },
  kcal: { nombre: 'Calorías', unidad: 'kcal' },
  paladas: { nombre: 'Paladas', unidad: 'paladas' },
};

export function tipoDe(ent) {
  return ent.tipo || (ent.objetivo ? 'objetivo' : 'intervalos');
}

export function duracionTotal(ent) {
  return (ent.bloques || []).reduce((a, b) => a + b.duracion, 0);
}

export function describir(ent) {
  if (tipoDe(ent) === 'objetivo') {
    const m = METRICAS_OBJETIVO[ent.objetivo.metrica];
    return `Objetivo: ${ent.objetivo.valor} ${m.unidad}`;
  }
  return `${ent.bloques.length} intervalos · ${formatoMmss(duracionTotal(ent))}`;
}

// Progreso hacia la meta. avance = { distancia, kcal, paladas } acumulados en la sesión; t en segundos.
export function progresoObjetivo(ent, avance, t) {
  const { metrica, valor } = ent.objetivo;
  const hecho = Math.min(valor, avance[metrica] || 0);
  const fraccion = valor > 0 ? hecho / valor : 0;
  const ritmo = t > 5 && hecho > 0 ? hecho / t : 0;
  return {
    metrica,
    meta: valor,
    hecho,
    falta: valor - hecho,
    fraccion,
    completo: hecho >= valor,
    estimadoSeg: ritmo ? Math.round((valor - hecho) / ritmo) : null,
  };
}

// Bloque que toca en el segundo t. Devuelve null cuando ya terminaron todos.
export function bloqueEn(ent, t) {
  let desde = 0;
  for (let i = 0; i < ent.bloques.length; i++) {
    const b = ent.bloques[i];
    const hasta = desde + b.duracion;
    if (t < hasta) return { i, bloque: b, desde, hasta, resta: hasta - t, siguiente: ent.bloques[i + 1] || null };
    desde = hasta;
  }
  return null;
}

// Rangos de potencia de todos los bloques, en segundos desde el inicio, para dibujarlos en la gráfica.
export function bandasPotencia(ent, ftp) {
  const bandas = [];
  let desde = 0;
  for (const b of ent.bloques || []) {
    const r = rangoWatts(b, ftp);
    if (r) bandas.push({ desde, hasta: desde + b.duracion, min: r.min, max: r.max });
    desde += b.duracion;
  }
  return bandas;
}

// Bloques con la meta de potencia ya en watts (para dibujar el perfil).
export function bloquesEnWatts(bloques, ftp) {
  return bloques.map((b) => {
    const r = rangoWatts(b, ftp);
    return r ? { ...b, metrica: 'watts', min: r.min, max: r.max } : { ...b, metrica: b.metrica === 'spm' ? 'spm' : '' };
  });
}

// 'dentro' | 'bajo' | 'alto' | null (sin meta)
export function enRango(bloque, watts, spm, ftp) {
  if (!bloque || !bloque.metrica) return null;
  const r = rangoWatts(bloque, ftp);
  let min = bloque.min;
  let max = bloque.max;
  let v = spm;
  if (r) { min = r.min; max = r.max; v = watts; } else if (bloque.metrica !== 'spm') return null;
  if (v < min) return 'bajo';
  if (max && v > max) return 'alto';
  return 'dentro';
}

// FTP estimado a partir de una prueba de 20 min: 95 % de la potencia media.
export function ftpDesdePrueba(wattsPromedio20min) {
  return Math.round(wattsPromedio20min * 0.95);
}

// Serie de intervalos: reps × (trabajo con rango + descanso con rango opcional).
export function serie({ reps, trabajo, wMin, wMax, descanso, dMin, dMax }) {
  const bloques = [];
  for (let i = 0; i < reps; i++) {
    bloques.push({ nombre: `Trabajo ${i + 1}/${reps}`, duracion: trabajo, metrica: wMin || wMax ? 'watts' : '', min: wMin || 0, max: wMax || 0 });
    if (descanso > 0 && i < reps - 1) {
      bloques.push({ nombre: 'Descanso', duracion: descanso, metrica: dMin || dMax ? 'watts' : '', min: dMin || 0, max: dMax || 0 });
    }
  }
  return bloques;
}

export function formatoMmss(seg) {
  seg = Math.max(0, Math.round(seg));
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

export function deMmss(txt) {
  const p = String(txt).split(':').map((x) => parseInt(x, 10) || 0);
  return p.length > 1 ? p[0] * 60 + p[1] : p[0];
}

export const EJEMPLOS = [
  {
    tipo: 'intervalos',
    nombre: 'Prueba FTP 20 min',
    pruebaFtp: true,
    bloques: [
      { nombre: 'Calentamiento', duracion: 600, metrica: 'ftp', min: 56, max: 75 },
      { nombre: 'Prueba: máximo sostenido', duracion: 1200, metrica: '', min: 0, max: 0, prueba: true },
      { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    tipo: 'intervalos',
    nombre: 'Umbral 3 × 8 min (zona 4)',
    bloques: [
      { nombre: 'Calentamiento', duracion: 600, metrica: 'ftp', min: 56, max: 75 },
      ...serie({ reps: 3, trabajo: 480, wMin: 0, wMax: 0, descanso: 180 }).map((b) => (b.nombre.startsWith('Trabajo')
        ? { ...b, metrica: 'ftp', min: 91, max: 105 } : { ...b, metrica: 'ftp', min: 40, max: 55 })),
      { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 },
    ],
  },
  { tipo: 'objetivo', nombre: '2000 m', objetivo: { metrica: 'distancia', valor: 2000 } },
  { tipo: 'objetivo', nombre: '150 kcal', objetivo: { metrica: 'kcal', valor: 150 } },
  { tipo: 'objetivo', nombre: '500 paladas', objetivo: { metrica: 'paladas', valor: 500 } },
  {
    tipo: 'intervalos',
    nombre: 'Potencia 5 × 3 min',
    bloques: [
      { nombre: 'Calentamiento', duracion: 300, metrica: 'watts', min: 80, max: 120 },
      ...serie({ reps: 5, trabajo: 180, wMin: 160, wMax: 190, descanso: 90, dMin: 80, dMax: 110 }),
      { nombre: 'Enfriamiento', duracion: 180, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    tipo: 'intervalos',
    nombre: 'Escalera de potencia',
    bloques: [
      { nombre: 'Calentamiento', duracion: 240, metrica: 'watts', min: 80, max: 120 },
      { nombre: 'Escalón 1', duracion: 120, metrica: 'watts', min: 120, max: 140 },
      { nombre: 'Escalón 2', duracion: 120, metrica: 'watts', min: 140, max: 160 },
      { nombre: 'Escalón 3', duracion: 120, metrica: 'watts', min: 160, max: 180 },
      { nombre: 'Escalón 4', duracion: 120, metrica: 'watts', min: 180, max: 200 },
      { nombre: 'Enfriamiento', duracion: 180, metrica: '', min: 0, max: 0 },
    ],
  },
];
