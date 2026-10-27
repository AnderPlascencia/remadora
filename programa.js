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
