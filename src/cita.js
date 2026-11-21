// Tu cita con el remo (etapa 13): qué días y a qué hora remas, la próxima cita y el plan para el calendario (.ics).
// Decir cuándo vas a hacer algo ayuda a hacerlo. Todo sin servidor: el recordatorio lo pone tu calendario.
import { DIAS_PLAN } from './programa.js';

export const HORA_DEFECTO = '19:00';
export const DIAS_NOMBRE = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']; // 0 = lunes
export const DIAS_CORTO = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const ALARMA_MIN = 30;
export const DURACION_DEFECTO_MIN = 45;
const DIA = 864e5;

const clave = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const aMs = (k) => new Date(`${k}T12:00`).getTime();
const diaSemana = (k) => (new Date(`${k}T12:00`).getDay() + 6) % 7;

// Hora válida «HH:MM» (o la de siempre).
export function horaValida(h) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || ''));
  if (!m || +m[1] > 23 || +m[2] > 59) return HORA_DEFECTO;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}
// Tus días (0 = lunes), en orden y sin repetir; si no hay o no cuadran con los días por semana, los del plan de serie.
export function diasDeCita(guardados, n = 3) {
  const porSemana = Math.min(5, Math.max(1, Math.round(n) || 3));
  const l = Array.isArray(guardados) ? [...new Set(guardados.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b) : [];
  return l.length === porSemana ? l : DIAS_PLAN[porSemana];
}
// Marcar o desmarcar un día: devuelve los días nuevos o null si no se puede (de 1 a 5 días).
export function alternarDia(dias, d) {
  const l = dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort((a, b) => a - b);
  return l.length >= 1 && l.length <= 5 ? l : null;
}

// La próxima cita: con plan, el próximo día con sesión (hoy si aún no remaste y no ha pasado la hora); sin plan,
// el próximo de tus días. Devuelve { fecha, hora, ent } o null.
export function proximaCita({ programa = null, dias = DIAS_PLAN[3], hora = HORA_DEFECTO, ahora = Date.now(), hechoHoy = false, movida = null } = {}) {
  const h = horaValida(hora);
  const hoy = clave(ahora);
  const [hh, mm] = h.split(':').map(Number);
  const pasada = new Date(ahora).getHours() * 60 + new Date(ahora).getMinutes() > hh * 60 + mm;
  const vale = (k) => k > hoy || (k === hoy && !hechoHoy && !pasada);
  // Una cita que cambiaste a mano manda mientras no haya pasado.
  if (movida?.fecha && vale(movida.fecha)) return { fecha: movida.fecha, hora: horaValida(movida.hora || h), ent: movida.ent || null, movida: true };
  if (programa?.dias?.length) {
    const d = programa.dias.find((x) => vale(x.fecha));
    return d ? { fecha: d.fecha, hora: h, ent: d.ent || null } : null;
  }
  for (let i = 0; i < 8; i++) {
    const k = clave(aMs(hoy) + i * DIA);
    if (dias.includes(diaSemana(k)) && vale(k)) return { fecha: k, hora: h, ent: null };
  }
  return null;
}
// «hoy, 19:00», «mañana, 19:00», «el jueves, 19:00» o «el 3 de diciembre, 19:00».
export function textoCita(c, ahora = Date.now()) {
  if (!c) return '';
  const n = Math.round((aMs(c.fecha) - aMs(clave(ahora))) / DIA);
  const f = new Date(`${c.fecha}T12:00`);
  const cuando = n === 0 ? 'hoy' : n === 1 ? 'mañana' : n < 7 ? `el ${DIAS_NOMBRE[diaSemana(c.fecha)]}` : `el ${f.getDate()} de ${f.toLocaleDateString('es-MX', { month: 'long' })}`;
  return `${cuando}, ${c.hora}`;
}

// ---------- Calendario (.ics) ----------
const escapar = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fechaIcs = (k, h) => `${k.replace(/-/g, '')}T${h.replace(':', '')}00`;
const sello = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
// Las líneas de más de 75 octetos se doblan (RFC 5545); aquí, por caracteres, que basta para el texto de la app.
const doblar = (l) => (l.length <= 74 ? l : l.match(/.{1,74}/g).join('\r\n '));

// citas: [{ fecha, hora, ent, min }]. Hora local «flotante» (sin zona): suena a esa hora estés donde estés.
export function ics(citas, { ahora = Date.now(), alarmaMin = ALARMA_MIN } = {}) {
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rower//Cita//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const c of citas) {
    const titulo = c.ent ? `Remo: ${c.ent}` : 'Remo';
    lineas.push('BEGIN:VEVENT', `UID:rower-${c.fecha}@rower.local`, `DTSTAMP:${sello(ahora)}`, `DTSTART:${fechaIcs(c.fecha, horaValida(c.hora))}`,
      `DURATION:PT${Math.max(5, Math.round(c.min || DURACION_DEFECTO_MIN))}M`, `SUMMARY:${escapar(titulo)}`,
      'DESCRIPTION:Tu cita con el remo. Abre Rower para empezar.',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(titulo)}`, `TRIGGER:-PT${alarmaMin}M`, 'END:VALARM', 'END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(doblar).join('\r\n') + '\r\n';
}
// Las citas de lo que queda del plan (desde hoy). duracion(ent) da los minutos de cada sesión, si se conocen.
export function citasDelPlan(programa, { hora = HORA_DEFECTO, ahora = Date.now(), duracion = () => null } = {}) {
  const hoy = clave(ahora);
  return (programa?.dias || []).filter((d) => d.fecha >= hoy && d.ent).map((d) => ({ fecha: d.fecha, hora: horaValida(hora), ent: d.ent, min: duracion(d.ent) }));
}
