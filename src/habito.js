// Medir el hábito: con qué constancia remas, cuánto tardas en volver tras una pausa y qué pasa con la app
// (abrirla, empezar una sesión y dejarla, la bienvenida, compartir la imagen). Todo se queda en el teléfono:
// los eventos viven en el almacén «estado» de IndexedDB y van en el respaldo.
import * as db from './db.js';
import { cargaDe, claveDia, factorSrpe, inicioPeriodo, rpeSentido } from './estadisticas.js';
import * as P from './programa.js';

export const ESTADO_EVENTOS = 'eventosHabito';
export const EVENTOS_MAX = 3000;
// Tipos de evento. «sesionFin» lleva { completa } (false: terminada antes del final del plan del día).
export const TIPOS_EVENTO = ['app', 'sesionInicio', 'sesionFin', 'sesionCorta', 'sesionDescartada', 'bienvenida', 'bienvenidaFin', 'compartir'];
// Una pausa: 4 días o más sin remar. Un hueco largo: 8 días o más.
export const PAUSA_DIAS = 4;
export const HUECO_DIAS = 8;
const DIA = 864e5;

// ---------- Cálculos (puros) ----------

// Añade un evento a la lista sin pasar del máximo (se olvidan los más viejos).
export function agregarEvento(lista, ev, max = EVENTOS_MAX) {
  const nueva = [...(Array.isArray(lista) ? lista : []), ev];
  return nueva.length > max ? nueva.slice(nueva.length - max) : nueva;
}

// Junta dos listas de eventos sin repetir (mismo momento y tipo), en orden.
export function unirEventos(a = [], b = [], max = EVENTOS_MAX) {
  const vistos = new Set();
  const todos = [...(a || []), ...(b || [])].filter((e) => {
    if (!e || typeof e.t !== 'number' || !TIPOS_EVENTO.includes(e.tipo)) return false;
    const k = `${e.t}|${e.tipo}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).sort((x, y) => x.t - y.t);
  return todos.length > max ? todos.slice(todos.length - max) : todos;
}

// Sesiones de cada una de las últimas n semanas (de lunes a domingo), de la más antigua a la actual.
export function sesionesPorSemana(sesiones, n = 8, ahora = Date.now()) {
  const lunes = inicioPeriodo(ahora, 'semana');
  const cuentas = Array(n).fill(0);
  for (const s of sesiones) {
    const i = n - 1 - Math.round((lunes - inicioPeriodo(s.fecha, 'semana')) / (7 * DIA));
    if (i >= 0 && i < n) cuentas[i]++;
  }
  return cuentas;
}

// Días entre sesiones seguidas (por día de calendario), de las más viejas a las más nuevas.
function distanciasEntreDias(sesiones) {
  const dias = [...new Set(sesiones.map((s) => claveDia(s.fecha)))].sort();
  const res = [];
  for (let i = 1; i < dias.length; i++) res.push(Math.round((Date.parse(`${dias[i]}T12:00`) - Date.parse(`${dias[i - 1]}T12:00`)) / DIA));
  return res;
}
const mediana = (xs) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
};

// Pausas y vuelta: cuántas pausas (4+ días) y huecos largos (8+ días) hubo, la más larga, cuánto se tarda
// de normal en volver tras una pausa (mediana, en días) y los días desde la última sesión.
export function pausas(sesiones, ahora = Date.now()) {
  const d = distanciasEntreDias(sesiones);
  const largas = d.filter((x) => x >= PAUSA_DIAS);
  const ultima = sesiones.reduce((m, s) => Math.max(m, s.fecha), 0);
  return {
    pausas: largas.length,
    huecos: d.filter((x) => x >= HUECO_DIAS).length,
    masLarga: largas.length ? Math.max(...largas) : 0,
    vuelta: mediana(largas),
    diasSinRemar: ultima ? Math.round((Date.parse(`${claveDia(ahora)}T12:00`) - Date.parse(`${claveDia(ultima)}T12:00`)) / DIA) : null,
  };
}

// Riesgo de abandono (etapa 30): remabas con regularidad (2 o más por semana en las semanas de antes, hasta 4) y ahora
// mucho menos. «baja»: las 2 últimas semanas cerradas, a la mitad o menos, y 3 días o más sin remar. «hueco»: 7 días
// o más sin remar. Con 21 días o más ya no se avisa: lo cubre el regreso, que rehace el plan.
export const RIESGO = { semanasMin: 4, minBase: 2, caida: 0.5, diasBaja: 3, diasHueco: 7, diasRegreso: 21, silencio: 42 };
export function riesgoAbandono(sesiones, ahora = Date.now()) {
  if (sesiones.length < 6) return null;
  const primera = sesiones.reduce((m, s) => Math.min(m, s.fecha), Infinity);
  // Semanas cerradas desde la de tu primera sesión: hacen falta 4 (2 de base y las 2 últimas).
  const cerradas = Math.round((inicioPeriodo(ahora, 'semana') - inicioPeriodo(primera, 'semana')) / (7 * DIA));
  if (cerradas < RIESGO.semanasMin) return null;
  const sem = sesionesPorSemana(sesiones.filter((s) => s.fecha <= ahora), 7, ahora);
  const prom = (xs) => Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10;
  // La base: hasta 4 semanas antes de las 2 últimas, sin contar las de antes de empezar.
  const base = prom(sem.slice(Math.max(0, 6 - cerradas), 4));
  const reciente = prom(sem.slice(4, 6));
  const { diasSinRemar: dias } = pausas(sesiones.filter((s) => s.fecha <= ahora), ahora);
  if (base < RIESGO.minBase || dias == null || dias >= RIESGO.diasRegreso) return null;
  if (dias >= RIESGO.diasHueco) return { motivo: 'hueco', base, reciente, dias };
  if (dias >= RIESGO.diasBaja && reciente <= base * RIESGO.caida && sem[6] < base * RIESGO.caida) return { motivo: 'baja', base, reciente, dias };
  return null;
}
// Se pregunta una sola vez: el día que aparece y, después de contestar o de ese día, no vuelve en 6 semanas.
// `guardado` = { dia, respondido } del último aviso.
export function mostrarRiesgo(guardado, hoy) {
  if (!guardado?.dia) return true;
  if (guardado.dia === hoy) return !guardado.respondido;
  return Date.parse(`${hoy}T12:00`) - Date.parse(`${guardado.dia}T12:00`) >= RIESGO.silencio * DIA;
}
const vecesSemana = (n) => `${String(n).replace('.', ',')} ${n === 1 ? 'vez' : 'veces'} por semana`;
export function textoRiesgo(r) {
  const antes = r.motivo === 'hueco'
    ? `Llevas ${r.dias} días sin remar, y antes remabas ${vecesSemana(r.base)}.`
    : `Últimamente remas menos: ${vecesSemana(r.reciente)}, antes ${vecesSemana(r.base)}.`;
  return `${antes} Le pasa a todos. ¿Lo hacemos más fácil? Si prefieres parar unas semanas, también está bien: tu progreso te espera.`;
}

// Lo que dicen los eventos en los últimos `dias` días.
export function resumenEventos(eventos, sesiones, dias = 28, ahora = Date.now()) {
  const desde = ahora - dias * DIA;
  const ev = (eventos || []).filter((e) => e.t >= desde && e.t <= ahora);
  const de = (tipo) => ev.filter((e) => e.tipo === tipo);
  const empezadas = de('sesionInicio').filter((e) => !e.reanudada).length;
  const fines = de('sesionFin');
  const incompletas = fines.filter((e) => e.completa === false).length;
  const cortas = de('sesionCorta').length;
  const descartadas = de('sesionDescartada').length;
  const remadas = sesiones.filter((s) => s.fecha >= desde && s.fecha <= ahora).length;
  const pasos = de('bienvenida').map((e) => e.paso || 0);
  return {
    aperturas: de('app').length,
    diasConApp: new Set(de('app').map((e) => claveDia(e.t))).size,
    empezadas,
    terminadas: fines.length,
    // Dejadas: muy cortas para guardarse, descartadas al volver, sin acabar el plan del día o empezadas y nunca
    // terminadas (la app se cerró y no se recuperó).
    dejadas: cortas + descartadas + incompletas + Math.max(0, empezadas - fines.length - cortas - descartadas),
    compartidas: de('compartir').length,
    tasaCompartir: remadas ? Math.round((100 * de('compartir').length) / remadas) : null,
    bienvenida: { pasoMax: pasos.length ? Math.max(...pasos) : 0, terminada: de('bienvenidaFin').length > 0 },
  };
}

// De las sesiones de los últimos `dias`: % con carga conocida (watts o esfuerzo) y % con tu esfuerzo marcado.
export function datosDeCarga(sesiones, ftp = 0, dias = 28, ahora = Date.now()) {
  const l = sesiones.filter((s) => s.fecha > ahora - dias * DIA && s.fecha <= ahora);
  if (!l.length) return { sesiones: 0, pctCarga: null, pctEsfuerzo: null };
  const k = factorSrpe(sesiones, ftp);
  const pct = (n) => Math.round((100 * n) / l.length);
  return { sesiones: l.length, pctCarga: pct(l.filter((s) => cargaDe(s, ftp, k).valor != null).length), pctEsfuerzo: pct(l.filter((s) => rpeSentido(s)).length) };
}

// Todo junto para la tarjeta «Tu constancia».
export function resumenHabito({ sesiones = [], eventos = [], programa = null, ftp = 0, ahora = Date.now() } = {}) {
  const semanas = sesionesPorSemana(sesiones, 8, ahora);
  const cerradas = semanas.slice(0, -1);
  const primera = sesiones.reduce((m, s) => Math.min(m, s.fecha), Infinity);
  // Solo cuentan las semanas desde que empezaste a remar.
  const desdeInicio = Number.isFinite(primera)
    ? cerradas.slice(Math.max(0, cerradas.length - Math.ceil((inicioPeriodo(ahora, 'semana') - inicioPeriodo(primera, 'semana')) / (7 * DIA))))
    : [];
  const media = desdeInicio.length ? Math.round((10 * desdeInicio.reduce((a, b) => a + b, 0)) / desdeInicio.length) / 10 : null;
  let cumplimiento = null;
  if (programa?.dias?.length) {
    const c = P.cumplimiento(P.estadoDias(programa, sesiones, ahora));
    cumplimiento = { ...c, pct: c.pasados ? Math.round((100 * c.hechos) / c.pasados) : null };
  }
  return { semanas, media, cumplimiento, ...pausas(sesiones, ahora), eventos: resumenEventos(eventos, sesiones, 28, ahora), carga: datosDeCarga(sesiones, ftp, 28, ahora) };
}

// ---------- Guardar y leer ----------
// Las escrituras van en cola para que dos eventos seguidos no se pisen.
let cola = Promise.resolve();
export function anotar(tipo, datos = {}, t = Date.now()) {
  cola = cola.then(async () => {
    const lista = (await db.leerEstado(ESTADO_EVENTOS)) || [];
    await db.guardarEstado(ESTADO_EVENTOS, agregarEvento(lista, { t, tipo, ...datos }));
  }).catch(() => { /* medir nunca rompe la app */ });
  return cola;
}
export async function leerEventos() {
  await cola;
  try { return (await db.leerEstado(ESTADO_EVENTOS)) || []; } catch { return []; }
}
// Al restaurar un respaldo: los eventos del archivo se suman a los de este teléfono.
export async function restaurarEventos(eventos) {
  if (!Array.isArray(eventos) || !eventos.length) return 0;
  const antes = await leerEventos();
  const juntos = unirEventos(antes, eventos);
  await db.guardarEstado(ESTADO_EVENTOS, juntos);
  return juntos.length - antes.length;
}
