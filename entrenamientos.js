// Lógica de los entrenamientos, sin dependencias de la interfaz.
//
// Dos tipos:
//  - 'objetivo':   { tipo, nombre, objetivo: { metrica: 'kcal'|'distancia'|'paladas', valor } }
//  - 'intervalos': { tipo, nombre, bloques: [{ nombre, fin?, duracion (s), cantidad?, metrica, min, max, nivel? }] }
//    fin: 'tiempo' (por defecto, usa duracion), 'distancia' (cantidad en m) o 'paladas' (cantidad de paladas).
//    metrica: 'watts' (min/max en W), 'ftp' (min/max en % del FTP), 'split' (min/max en s por 500 m),
//    'spm' (golpes/min), 'fc' (pulso en lpm), 'fcpct' (% del pulso máximo) o '' (libre).
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

// Watts equivalentes a un split (s/500 m) con la fórmula estándar de remo: W = 2.8 / (s/m)³.
export function wattsDeSplit(split) {
  return split > 0 ? Math.round(2.8 / (split / 500) ** 3) : 0;
}

// Rango de pulso en lpm (convierte % del pulso máximo). null si el bloque no es por pulso.
export function rangoFc(b, fcMax) {
  if (b.metrica === 'fc') return { min: b.min, max: b.max };
  if (b.metrica === 'fcpct' && fcMax) return { min: Math.round((b.min * fcMax) / 100), max: Math.round((b.max * fcMax) / 100) };
  return null;
}

// Texto corto de la meta de un bloque.
export function textoMeta(b, ftp, fcMax = 0) {
  if (b.metrica === 'split') return `${formatoMmss(b.min)}–${formatoMmss(b.max)} /500 m`;
  if (b.metrica === 'fc') return `${b.min}–${b.max} lpm`;
  if (b.metrica === 'fcpct') {
    const r = rangoFc(b, fcMax);
    return r ? `${r.min}–${r.max} lpm (${b.min}–${b.max}% pulso máx)` : `${b.min}–${b.max}% pulso máx`;
  }
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

export const finDe = (b) => b.fin || 'tiempo';
export const cantidadDe = (b) => (finDe(b) === 'tiempo' ? b.duracion : b.cantidad);

// Segundos estimados de un bloque. ritmo: { split (s/500 m), spm }; por defecto 2:10 y 24 golpes/min.
export function duracionEstimada(b, ritmo = {}) {
  const fin = finDe(b);
  if (fin === 'distancia') return Math.round((b.cantidad * (ritmo.split || 130)) / 500);
  if (fin === 'paladas') return Math.round((b.cantidad * 60) / (ritmo.spm || 24));
  return b.duracion;
}

export function textoCantidad(b) {
  const fin = finDe(b);
  if (fin === 'distancia') return `${Number(b.cantidad).toLocaleString('es-MX')} m`;
  if (fin === 'paladas') return `${b.cantidad} paladas`;
  return formatoMmss(b.duracion);
}

export function duracionTotal(ent, ritmo) {
  return (ent.bloques || []).reduce((a, b) => a + duracionEstimada(b, ritmo), 0);
}

export const soloTiempo = (ent) => (ent.bloques || []).every((b) => finDe(b) === 'tiempo');

export function describir(ent) {
  if (tipoDe(ent) === 'objetivo') {
    const m = METRICAS_OBJETIVO[ent.objetivo.metrica];
    return `Objetivo: ${ent.objetivo.valor} ${m.unidad}`;
  }
  return `${ent.bloques.length} intervalos · ${soloTiempo(ent) ? '' : '≈ '}${formatoMmss(duracionTotal(ent))}`;
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

// Bloques con el % de FTP convertido a watts (lo que se guarda con la sesión).
export function normalizarBloques(bloques, ftp, fcMax = 0) {
  return bloques.map((b) => {
    if (b.metrica === 'fcpct') {
      const r = rangoFc(b, fcMax);
      return r ? { ...b, metrica: 'fc', min: r.min, max: r.max } : { ...b, metrica: '' };
    }
    if (b.metrica !== 'ftp') return { ...b };
    const r = rangoWatts(b, ftp);
    return r ? { ...b, metrica: 'watts', min: r.min, max: r.max } : { ...b, metrica: '' };
  });
}

// Bloques para dibujar el perfil: todo con meta de potencia queda en watts (el split se convierte).
export function bloquesEnWatts(bloques, ftp) {
  return normalizarBloques(bloques, ftp).map((b) => {
    if (b.metrica === 'watts') return b;
    if (b.metrica === 'split') return { ...b, metrica: 'watts', min: wattsDeSplit(b.max), max: wattsDeSplit(b.min) };
    return { ...b, metrica: b.metrica === 'spm' || b.metrica === 'fc' ? b.metrica : '' };
  });
}

// 'dentro' | 'bajo' | 'alto' | null (sin meta)
export function enRango(bloque, watts, spm, ftp, split = 0, fc = 0) {
  if (!bloque || !bloque.metrica) return null;
  if (bloque.metrica === 'fc') {
    if (!fc) return null;
    if (fc < bloque.min) return 'bajo';
    if (fc > bloque.max) return 'alto';
    return 'dentro';
  }
  if (bloque.metrica === 'split') {
    if (!split || split > bloque.max) return 'bajo';
    if (split < bloque.min) return 'alto';
    return 'dentro';
  }
  const r = rangoWatts(bloque, ftp);
  let min = bloque.min;
  let max = bloque.max;
  let v = spm;
  if (r) { min = r.min; max = r.max; v = watts; } else if (bloque.metrica !== 'spm') return null;
  if (v < min) return 'bajo';
  if (max && v > max) return 'alto';
  return 'dentro';
}

// Seguimiento de un entrenamiento por intervalos que pueden terminar por tiempo, distancia o paladas.
// m = { t, dist, paladas, split, spm } acumulados de la sesión (t en segundos activos).
export function crearAvance() {
  return { i: 0, inicio: { t: 0, dist: 0, paladas: 0 }, duraciones: [] };
}

function hechoEn(b, inicio, m) {
  const fin = finDe(b);
  if (fin === 'distancia') return m.dist - inicio.dist;
  if (fin === 'paladas') return m.paladas - inicio.paladas;
  return m.t - inicio.t;
}

export function avanzar(estado, bloques, m) {
  while (estado.i < bloques.length) {
    const b = bloques[estado.i];
    if (hechoEn(b, estado.inicio, m) < cantidadDe(b)) break;
    const tFin = finDe(b) === 'tiempo' ? estado.inicio.t + b.duracion : m.t;
    estado.duraciones.push(tFin - estado.inicio.t);
    estado.inicio = { t: tFin, dist: m.dist, paladas: m.paladas };
    estado.i += 1;
  }
  const est = bloques.map((b) => duracionEstimada(b, m));
  const total = est.reduce((a, x) => a + x, 0) || 1;
  if (estado.i >= bloques.length) {
    return { terminado: true, i: bloques.length, fraccion: 1, desde: estado.inicio.t };
  }
  const b = bloques[estado.i];
  const cantidad = cantidadDe(b);
  const hecho = Math.max(0, hechoEn(b, estado.inicio, m));
  const resta = cantidad - hecho;
  const fin = finDe(b);
  let restaSeg = resta;
  if (fin === 'distancia') restaSeg = (resta * (m.split || 130)) / 500;
  if (fin === 'paladas') restaSeg = (resta * 60) / (m.spm || 24);
  const previo = est.slice(0, estado.i).reduce((a, x) => a + x, 0);
  return {
    terminado: false,
    i: estado.i,
    bloque: b,
    siguiente: bloques[estado.i + 1] || null,
    desde: estado.inicio.t,
    hecho,
    resta,
    restaSeg: Math.max(0, Math.round(restaSeg)),
    fraccion: Math.min(1, (previo + (est[estado.i] * hecho) / (cantidad || 1)) / total),
  };
}

// Bloques con duración en segundos: real si ya terminaron, estimada si no (para gráficas y para guardar).
export function bloquesConDuracion(estado, bloques, m) {
  return bloques.map((b, i) => {
    if (i < estado.duraciones.length) return { ...b, duracion: estado.duraciones[i] };
    if (i === estado.i) {
      const info = avanzar({ ...estado, duraciones: [...estado.duraciones] }, bloques, m);
      const pasado = m.t - estado.inicio.t;
      return { ...b, duracion: Math.max(1, pasado + (info.restaSeg || 0)) };
    }
    return { ...b, duracion: duracionEstimada(b, m) };
  });
}

// Texto de lo que falta en el bloque, en su unidad.
export function textoResta(info) {
  const fin = finDe(info.bloque);
  if (fin === 'distancia') return `${Math.ceil(info.resta).toLocaleString('es-MX')} m`;
  if (fin === 'paladas') return `${Math.ceil(info.resta)} pal.`;
  return formatoMmss(info.resta);
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

// Calentamiento y enfriamiento guiados alrededor de un plan de intervalos (minutos; 0 = sin él).
// Si el plan ya los trae (por nombre), no se duplican.
export function conCalentamiento(bloques, calMin, enfMin) {
  const tiene = (txt) => bloques.some((b) => (b.nombre || '').toLowerCase().includes(txt));
  const res = [...bloques];
  if (calMin > 0 && !tiene('calentamiento')) res.unshift({ nombre: 'Calentamiento guiado', duracion: calMin * 60, metrica: 'ftp', min: 50, max: 65, guiado: true });
  if (enfMin > 0 && !tiene('enfriamiento')) res.push({ nombre: 'Enfriamiento guiado', duracion: enfMin * 60, metrica: 'ftp', min: 40, max: 55, guiado: true });
  return res;
}

// Predicción de tiempos con la ley de Paul: el split sube 5 s cada vez que la distancia se duplica.
export const DISTANCIAS_PREDICCION = [500, 1000, 2000, 5000, 6000, 10000, 21097];
export function predecir(metros, segundos, destino) {
  const split = (segundos * 500) / metros + 5 * Math.log2(destino / metros);
  return Math.round((split * destino) / 500);
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
  {
    tipo: 'intervalos',
    nombre: '4 × 500 m',
    bloques: [
      { nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 75 },
      ...[1, 2, 3, 4].flatMap((n) => [
        { nombre: `500 m fuerte ${n}/4`, fin: 'distancia', cantidad: 500, duracion: 0, metrica: 'ftp', min: 106, max: 120 },
        ...(n < 4 ? [{ nombre: 'Descanso', duracion: 120, metrica: 'ftp', min: 40, max: 55 }] : []),
      ]),
      { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    tipo: 'intervalos',
    nombre: 'Ritmo 2:10 × 20 min',
    bloques: [
      { nombre: 'Calentamiento', duracion: 300, metrica: 'split', min: 135, max: 150 },
      { nombre: 'Ritmo constante', duracion: 1200, metrica: 'split', min: 125, max: 130 },
      { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    tipo: 'intervalos',
    nombre: 'Pirámide de paladas',
    bloques: [
      { nombre: 'Calentamiento', duracion: 300, metrica: 'spm', min: 18, max: 22 },
      ...[50, 100, 150, 100, 50].flatMap((n, i, arr) => [
        { nombre: `${n} paladas`, fin: 'paladas', cantidad: n, duracion: 0, metrica: 'spm', min: 26, max: 30 },
        ...(i < arr.length - 1 ? [{ nombre: 'Suave', duracion: 60, metrica: 'spm', min: 18, max: 22 }] : []),
      ]),
      { nombre: 'Enfriamiento', duracion: 240, metrica: '', min: 0, max: 0 },
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
  { tipo: 'objetivo', nombre: 'Prueba 500 m', prueba: true, objetivo: { metrica: 'distancia', valor: 500 } },
  { tipo: 'objetivo', nombre: 'Prueba 2000 m', prueba: true, objetivo: { metrica: 'distancia', valor: 2000 } },
  { tipo: 'objetivo', nombre: '5000 m', objetivo: { metrica: 'distancia', valor: 5000 } },
  {
    tipo: 'intervalos',
    nombre: 'Pirámide 1-2-3-4-3-2-1 min',
    bloques: [
      { nombre: 'Calentamiento', duracion: 300, metrica: 'ftp', min: 56, max: 75 },
      ...[1, 2, 3, 4, 3, 2, 1].flatMap((m, i, arr) => [
        { nombre: `${m} min fuerte`, duracion: m * 60, metrica: 'ftp', min: 100, max: 115 },
        ...(i < arr.length - 1 ? [{ nombre: 'Suave', duracion: Math.max(60, m * 30), metrica: 'ftp', min: 40, max: 55 }] : []),
      ]),
      { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    tipo: 'intervalos',
    nombre: '30 min a 20 golpes (30r20)',
    bloques: [
      { nombre: 'Calentamiento', duracion: 300, metrica: 'spm', min: 18, max: 22 },
      { nombre: '30 min a 20 golpes', duracion: 1800, metrica: 'spm', min: 19, max: 21 },
      { nombre: 'Enfriamiento', duracion: 180, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    tipo: 'intervalos',
    nombre: '4 × 2000 m',
    bloques: [
      { nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 75 },
      ...[1, 2, 3, 4].flatMap((n) => [
        { nombre: `2000 m ${n}/4`, fin: 'distancia', cantidad: 2000, duracion: 0, metrica: 'ftp', min: 85, max: 95 },
        ...(n < 4 ? [{ nombre: 'Descanso', duracion: 300, metrica: 'ftp', min: 40, max: 55 }] : []),
      ]),
      { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    tipo: 'intervalos',
    nombre: 'Tabata 8 × 20 s',
    bloques: [
      { nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 75 },
      ...Array.from({ length: 8 }, (_, i) => [
        { nombre: `Sprint ${i + 1}/8`, duracion: 20, metrica: 'ftp', min: 140, max: 200 },
        ...(i < 7 ? [{ nombre: 'Descanso', duracion: 10, metrica: '', min: 0, max: 0 }] : []),
      ]).flat(),
      { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    tipo: 'intervalos',
    nombre: '8 × 500 m',
    bloques: [
      { nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 75 },
      ...Array.from({ length: 8 }, (_, i) => [
        { nombre: `500 m ${i + 1}/8`, fin: 'distancia', cantidad: 500, duracion: 0, metrica: 'ftp', min: 100, max: 112 },
        ...(i < 7 ? [{ nombre: 'Descanso', duracion: 90, metrica: 'ftp', min: 40, max: 55 }] : []),
      ]).flat(),
      { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    tipo: 'intervalos',
    nombre: 'Zona 2 por pulso 30 min',
    bloques: [
      { nombre: 'Calentamiento', duracion: 300, metrica: 'fcpct', min: 55, max: 65 },
      { nombre: 'Zona 2', duracion: 1800, metrica: 'fcpct', min: 60, max: 70 },
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
