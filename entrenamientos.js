// Lógica de los entrenamientos, sin dependencias de la interfaz.
//
// Dos tipos:
//  - 'objetivo':   { tipo, nombre, objetivo: { metrica: 'kcal'|'distancia'|'paladas', valor } }
//  - 'intervalos': { tipo, nombre, bloques: [{ nombre, duracion (s), metrica: 'watts'|'spm'|'', min, max }] }

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
export function bandasPotencia(ent) {
  const bandas = [];
  let desde = 0;
  for (const b of ent.bloques || []) {
    if (b.metrica === 'watts') bandas.push({ desde, hasta: desde + b.duracion, min: b.min, max: b.max });
    desde += b.duracion;
  }
  return bandas;
}

// 'dentro' | 'bajo' | 'alto' | null (sin meta)
export function enRango(bloque, watts, spm) {
  if (!bloque || !bloque.metrica) return null;
  const v = bloque.metrica === 'watts' ? watts : spm;
  if (v < bloque.min) return 'bajo';
  if (bloque.max && v > bloque.max) return 'alto';
  return 'dentro';
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
