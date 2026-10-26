// Programas de varias semanas: una lista de días con el entrenamiento que toca.
// programa = { nombre, inicio: 'AAAA-MM-DD', dias: [{ fecha: 'AAAA-MM-DD', ent: nombre del entrenamiento }] }
import { claveDia } from './estadisticas.js';

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
