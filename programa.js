// Programas de varias semanas: una lista de días con el entrenamiento que toca.
// programa = { nombre, inicio: 'AAAA-MM-DD', dias: [{ fecha: 'AAAA-MM-DD', ent: nombre del entrenamiento }] }
import { claveDia } from './estadisticas.js';
import { formatoMmss as mm } from './entrenamientos.js';

const DIA = 864e5;
const aFecha = (clave) => new Date(`${clave}T12:00:00`);

// Repite cada semana el mismo esquema. porDia: { 0..6 (0 = lunes): nombre }
export function generarSemanal(nombre, inicio, semanas, porDia) {
  const dias = [];
  const base = aFecha(inicio);
  for (let i = 0; i < semanas * 7; i++) {
    const d = new Date(base.getTime() + i * DIA);
    const diaSemana = (d.getDay() + 6) % 7;
    if (porDia[diaSemana]) dias.push({ fecha: claveDia(d.getTime()), ent: porDia[diaSemana] });
  }
  return { nombre, inicio, dias };
}

// Plantilla: mejorar 2000 m en 6 semanas (lunes, miércoles y sábado).
export const PLANTILLAS = [
  {
    nombre: 'Mejorar 2000 m en 6 semanas',
    descripcion: '3 días por semana: umbral, series de 500 m y ritmo. Prueba de 2000 m en las semanas 3 y 6.',
    semanas: [
      ['Umbral 3 × 8 min (zona 4)', 'Potencia 5 × 3 min', 'Ritmo 2:10 × 20 min'],
      ['Umbral 3 × 8 min (zona 4)', '4 × 500 m', 'Ritmo 2:10 × 20 min'],
      ['Umbral 3 × 8 min (zona 4)', 'Pirámide de paladas', '2000 m'],
      ['Umbral 3 × 8 min (zona 4)', '4 × 500 m', 'Escalera de potencia'],
      ['Potencia 5 × 3 min', '4 × 500 m', 'Ritmo 2:10 × 20 min'],
      ['Umbral 3 × 8 min (zona 4)', 'Pirámide de paladas', '2000 m'],
    ],
    diasSemana: [0, 2, 5],
  },
];

export function desdePlantilla(p, inicio) {
  const dias = [];
  const base = aFecha(inicio);
  const lunes = new Date(base.getTime() - ((base.getDay() + 6) % 7) * DIA);
  p.semanas.forEach((ents, s) => {
    ents.forEach((ent, j) => {
      const d = new Date(lunes.getTime() + (s * 7 + p.diasSemana[j]) * DIA);
      if (d >= base || claveDia(d.getTime()) === inicio) dias.push({ fecha: claveDia(d.getTime()), ent });
    });
  });
  return { nombre: p.nombre, inicio, dias };
}

// Estado de cada día: 'hecho' | 'perdido' | 'hoy' | 'pendiente'.
export function estadoDias(programa, sesiones, ahora = Date.now()) {
  const hoy = claveDia(ahora);
  const hechos = new Set(sesiones.map((s) => `${claveDia(s.fecha)}|${s.entrenamiento || ''}`));
  return programa.dias.map((d) => {
    let estado = 'pendiente';
    if (hechos.has(`${d.fecha}|${d.ent}`)) estado = 'hecho';
    else if (d.fecha === hoy) estado = 'hoy';
    else if (d.fecha < hoy) estado = 'perdido';
    return { ...d, estado };
  });
}

export function cumplimiento(estados) {
  const pasados = estados.filter((d) => d.estado === 'hecho' || d.estado === 'perdido');
  return { hechos: estados.filter((d) => d.estado === 'hecho').length, pasados: pasados.length, total: estados.length };
}

export function deHoy(programa, ahora = Date.now()) {
  if (!programa) return null;
  const hoy = claveDia(ahora);
  return programa.dias.find((d) => d.fecha === hoy) || null;
}

export function proximo(programa, ahora = Date.now()) {
  if (!programa) return null;
  const hoy = claveDia(ahora);
  return programa.dias.find((d) => d.fecha > hoy) || null;
}

// Plan automático hacia una meta: distancia en un tiempo, en N semanas, 3 días por semana.
// Crea sus propios entrenamientos a partir del split meta y los va endureciendo semana a semana.
export function planPorMeta({ distancia, segundos, semanas, inicio, diasSemana = [0, 2, 5] }) {
  const split = Math.round((segundos * 500) / distancia);
  const entrenamientos = [];
  const crear = (e) => { if (!entrenamientos.some((x) => x.nombre === e.nombre)) entrenamientos.push(e); return e.nombre; };
  const cal = { nombre: 'Calentamiento', duracion: 480, metrica: 'split', min: split + 14, max: split + 22 };
  const enf = { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 };
  const prueba = crear({ tipo: 'objetivo', nombre: `Prueba ${distancia} m`, prueba: true, objetivo: { metrica: 'distancia', valor: distancia } });
  const fondo = crear({
    tipo: 'intervalos', nombre: `Fondo a ${mm(split + 14)} × 20 min`,
    bloques: [cal, { nombre: 'Fondo', duracion: 1200, metrica: 'split', min: split + 11, max: split + 17 }, enf],
  });
  const umbral = crear({
    tipo: 'intervalos', nombre: `Umbral a ${mm(split + 6)} 3 × 8 min`,
    bloques: [cal, ...[1, 2, 3].flatMap((n) => [
      { nombre: `Umbral ${n}/3`, duracion: 480, metrica: 'split', min: split + 4, max: split + 8 },
      ...(n < 3 ? [{ nombre: 'Descanso', duracion: 180, metrica: '', min: 0, max: 0 }] : []),
    ]), enf],
  });
  const tramo = Math.max(100, Math.min(1000, Math.round(distancia / 4 / 100) * 100));
  const reps = Math.max(3, Math.min(8, Math.round((distancia * 1.25) / tramo)));
  const series = (sem) => {
    const extra = semanas > 1 ? Math.round(3 * (1 - sem / (semanas - 1))) : 0;
    const sp = split + extra;
    return crear({
      tipo: 'intervalos', nombre: `Ritmo ${mm(sp)} · ${reps} × ${tramo} m`,
      bloques: [cal, ...Array.from({ length: reps }, (_, i) => [
        { nombre: `${tramo} m ${i + 1}/${reps}`, fin: 'distancia', cantidad: tramo, duracion: 0, metrica: 'split', min: sp - 2, max: sp + 1 },
        ...(i < reps - 1 ? [{ nombre: 'Descanso', duracion: Math.round(tramo / 5) + 30, metrica: '', min: 0, max: 0 }] : []),
      ]).flat(), enf],
    });
  };
  const mitad = semanas >= 6 ? Math.floor(semanas / 2) - 1 : -1;
  const semanasPlan = Array.from({ length: semanas }, (_, s) => {
    if (s === semanas - 1) return [series(s), fondo, prueba];
    if (s === mitad) return [umbral, series(s), prueba];
    return [umbral, series(s), fondo];
  });
  const programa = desdePlantilla({ nombre: `Meta: ${distancia} m en ${mm(segundos)}`, semanas: semanasPlan, diasSemana }, inicio);
  return { programa, entrenamientos, split };
}

// ---------- Plan por objetivo: la app decide intensidades, ritmos y volúmenes ----------
// Las intensidades van en % de tu FTP (o en tu ritmo actual), así el plan se ajusta solo cuando mejoras.
export const OBJETIVOS_PLAN = [
  { clave: 'potencia', nombre: 'Potencia', texto: 'Sacar más watts: series cortas y fuertes, umbral y sprints.', prueba: 'Prueba FTP 20 min' },
  { clave: 'ritmo', nombre: 'Ritmo', texto: 'Ir más rápido en 2000 m: series a ritmo de carrera y umbral.', prueba: 'Prueba 2000 m' },
  { clave: 'distancia', nombre: 'Distancia', texto: 'Remar más lejos sin parar: fondo largo y tempo.', prueba: null },
  { clave: 'tecnica', nombre: 'Paladas y técnica', texto: 'Más metros por palada: control de paladas y ritmo parejo.', prueba: 'Prueba 500 m' },
];
export const NIVELES_PLAN = [
  { clave: 'inicio', nombre: 'Estoy empezando', volumen: 0.7 },
  { clave: 'medio', nombre: 'Remo a veces', volumen: 1 },
  { clave: 'alto', nombre: 'Remo seguido', volumen: 1.3 },
];
// Días de entreno según cuántos por semana (0 = lunes).
export const DIAS_PLAN = { 2: [1, 4], 3: [0, 2, 5], 4: [0, 1, 3, 5], 5: [0, 1, 3, 4, 6] };

const CAL = { nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 70 };
const ENF = { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 };
const SUAVE = (dur) => ({ nombre: 'Descanso', duracion: dur, metrica: 'ftp', min: 40, max: 55 });
const ronda = (x, paso) => Math.max(paso, Math.round(x / paso) * paso);
const series = (reps, trabajo, descanso) => Array.from({ length: reps }, (_, i) => [
  { ...trabajo, nombre: `${trabajo.nombre} ${i + 1}/${reps}` }, ...(i < reps - 1 ? [SUAVE(descanso)] : []),
]).flat();

// Cada tipo de sesión según la carga de la semana (c ≈ 0.7 … 1.6).
const SESIONES = {
  vo2: (c) => { const r = Math.round(4 + 3 * c); return { nombre: `VO2 ${r} × 1 min`, bloques: [CAL, ...series(r, { nombre: 'Fuerte', duracion: 60, metrica: 'ftp', min: 110, max: 120 }, 60), ENF] }; },
  sprints: (c) => { const r = Math.round(5 + 3 * c); return { nombre: `Sprints ${r} × 20 s`, bloques: [CAL, ...series(r, { nombre: 'Sprint', duracion: 20, metrica: 'ftp', min: 130, max: 160 }, 100), ENF] }; },
  umbral: (c) => { const m = Math.min(12, Math.round(4 + 4 * c)); return { nombre: `Umbral 3 × ${m} min`, bloques: [CAL, ...series(3, { nombre: 'Umbral', duracion: m * 60, metrica: 'ftp', min: 91, max: 105 }, 180), ENF] }; },
  tempo: (c) => { const m = ronda(12 + 12 * c, 2); return { nombre: `Tempo ${m} min`, bloques: [CAL, { nombre: 'Tempo', duracion: m * 60, metrica: 'ftp', min: 76, max: 90 }, ENF] }; },
  fondo: (c) => { const m = ronda(15 + 20 * c, 5); return { nombre: `Fondo ${m} min (zona 2)`, bloques: [CAL, { nombre: 'Fondo', duracion: m * 60, metrica: 'ftp', min: 56, max: 75 }, ENF] }; },
  largo: (c, ctx) => { const d = ronda(ctx.distHabitual * (0.8 + 0.5 * c), 500); return { tipo: 'objetivo', nombre: `${d} m seguidos`, objetivo: { metrica: 'distancia', valor: d } }; },
  ritmo: (c, ctx) => {
    const r = Math.round(3 + 2 * c); const sp = Math.round(ctx.split2k - 4 * (c - 0.8));
    return { nombre: `Ritmo ${mmss(sp)} · ${r} × 500 m`, bloques: [CAL, ...series(r, { nombre: '500 m', fin: 'distancia', cantidad: 500, duracion: 0, metrica: 'split', min: sp - 2, max: sp + 2 }, 120), ENF] };
  },
  paladas: (c) => { const r = Math.round(3 + 2 * c); return { nombre: `Control de paladas ${r} × 3 min`, bloques: [CAL, ...series(r, { nombre: 'A 20-22 paladas/min', duracion: 180, metrica: 'spm', min: 20, max: 22 }, 60), ENF] }; },
  cadencia: (c) => { const r = Math.round(4 + 2 * c); return { nombre: `Cambios de cadencia ${r} × 2 min`, bloques: [CAL, ...Array.from({ length: r }, (_, i) => ({ nombre: `${i % 2 ? 28 : 22} paladas/min ${i + 1}/${r}`, duracion: 120, metrica: 'spm', min: i % 2 ? 27 : 21, max: i % 2 ? 29 : 23 })), ENF] }; },
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
// Orden de prioridad de las sesiones de cada objetivo: con 2 días se usan las 2 primeras, con 5 todas.
const SEMANA_TIPO = {
  potencia: ['vo2', 'umbral', 'fondo', 'sprints', 'tempo'],
  ritmo: ['ritmo', 'umbral', 'fondo', 'tempo', 'vo2'],
  distancia: ['largo', 'fondo', 'tempo', 'fondo', 'umbral'],
  tecnica: ['paladas', 'fondo', 'cadencia', 'tempo', 'paladas'],
};
const ENFOQUE_SESION = { vo2: 'potencia', sprints: 'potencia', umbral: 'potencia', tempo: 'distancia', fondo: 'distancia', largo: 'distancia', ritmo: 'ritmo', paladas: 'tecnica', cadencia: 'tecnica' };

// ctx = { split2k: segundos/500 m de tu ritmo actual, distHabitual: metros de una sesión normal }
export function planPorObjetivo({ objetivo, nivel = 'medio', dias = 3, semanas = 6, inicio, ctx }) {
  const obj = OBJETIVOS_PLAN.find((o) => o.clave === objetivo);
  const vol = NIVELES_PLAN.find((n) => n.clave === nivel)?.volumen ?? 1;
  const tipos = SEMANA_TIPO[objetivo].slice(0, dias);
  const entrenamientos = [];
  const crear = (tipo, carga) => {
    const e = SESIONES[tipo](carga, ctx);
    const ent = { tipo: e.tipo || 'intervalos', ...e, enfoque: ENFOQUE_SESION[tipo] };
    if (!entrenamientos.some((x) => x.nombre === ent.nombre)) entrenamientos.push(ent);
    return ent.nombre;
  };
  const prueba = (nombre) => { if (!entrenamientos.some((x) => x.nombre === nombre)) entrenamientos.push({ ...EJEMPLO_PRUEBA[nombre], enfoque: 'pruebas' }); return nombre; };
  const semanasPlan = Array.from({ length: semanas }, (_, s) => {
    // Sube la carga cada semana y descarga una de cada 4 (un 30 % menos).
    const descarga = (s + 1) % 4 === 0 && s < semanas - 1;
    const carga = vol * (0.8 + 0.6 * (s / Math.max(1, semanas - 1))) * (descarga ? 0.7 : 1);
    const lista = tipos.map((t) => crear(t, carga));
    const conPrueba = obj.prueba && (s === semanas - 1 || (semanas >= 6 && s === Math.floor(semanas / 2) - 1));
    if (conPrueba) lista[lista.length - 1] = prueba(obj.prueba);
    if (objetivo === 'distancia' && s === semanas - 1) lista[0] = crear('largo', vol * 1.9);
    return lista;
  });
  const programa = desdePlantilla({ nombre: `Plan de ${obj.nombre.toLowerCase()} · ${semanas} semanas`, semanas: semanasPlan, diasSemana: DIAS_PLAN[dias] }, inicio);
  return { programa, entrenamientos };
}
const EJEMPLO_PRUEBA = {
  'Prueba FTP 20 min': { tipo: 'intervalos', nombre: 'Prueba FTP 20 min', pruebaFtp: true, bloques: [
    { nombre: 'Calentamiento', duracion: 600, metrica: 'ftp', min: 56, max: 75 },
    { nombre: 'Prueba: máximo sostenido', duracion: 1200, metrica: '', min: 0, max: 0, prueba: true }, ENF] },
  'Prueba 2000 m': { tipo: 'objetivo', nombre: 'Prueba 2000 m', prueba: true, objetivo: { metrica: 'distancia', valor: 2000 } },
  'Prueba 500 m': { tipo: 'objetivo', nombre: 'Prueba 500 m', prueba: true, objetivo: { metrica: 'distancia', valor: 500 } },
};

// Grupo de cada entrenamiento para ordenar la lista.
export const GRUPOS_ENT = [
  { clave: 'potencia', nombre: 'Potencia' }, { clave: 'ritmo', nombre: 'Ritmo' }, { clave: 'distancia', nombre: 'Distancia y resistencia' },
  { clave: 'tecnica', nombre: 'Paladas y técnica' }, { clave: 'calorias', nombre: 'Calorías' }, { clave: 'pruebas', nombre: 'Pruebas' },
];
export function enfoqueDe(ent) {
  if (ent.prueba || ent.pruebaFtp || (ent.bloques || []).some((b) => b.prueba)) return 'pruebas';
  if (ent.enfoque) return ent.enfoque;
  if (ent.tipo === 'objetivo' || ent.objetivo?.metrica) {
    return { distancia: 'distancia', kcal: 'calorias', paladas: 'tecnica' }[ent.objetivo?.metrica] || 'distancia';
  }
  const trabajo = (ent.bloques || []).filter((b) => b.metrica && !/calentamiento|enfriamiento|descanso|suave/i.test(b.nombre));
  if (!trabajo.length) return 'distancia';
  const cuenta = (m) => trabajo.filter((b) => b.metrica === m).length;
  if (cuenta('spm') * 2 >= trabajo.length) return 'tecnica';
  if (cuenta('split') * 2 >= trabajo.length) return 'ritmo';
  if (trabajo.some((b) => b.fin === 'paladas')) return 'tecnica';
  const intenso = trabajo.some((b) => (b.metrica === 'ftp' && b.min >= 88) || b.metrica === 'watts');
  return intenso ? 'potencia' : 'distancia';
}
