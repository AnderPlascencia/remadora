// XP por carga y por cumplir el plan (acuerdo D1 entre recompensas y el entrenador, etapa 6).
// Solo las sesiones guardadas con reglasXp 2 o más se cuentan así; las anteriores siguen igual.
// Los valores de aquí son los que se pagan tal cual (no pasan por el factor de XP lenta).
import { claveDia } from './estadisticas.js';

// 2: XP por carga (etapa 6). 3: además fantasmas según el margen, récords con tope y jefes con varias formas
// de vencerlos (etapa 9). Las sesiones nuevas guardan la última versión; cada regla mira desde qué versión aplica.
export const REGLAS_XP_CARGA = 3;
export const usaCarga = (s) => (s?.reglasXp || 0) >= 2;
export const usaReglas9 = (s) => (s?.reglasXp || 0) >= 3;

// XP base: 5 por punto de carga hasta 30, 2,5 de 30 a 60 y nada por encima. El tope es del día, no de cada sesión.
export const CARGA_TOPE_DIA = 60;
const curva = (p) => 5 * Math.min(p, 30) + 2.5 * Math.max(0, Math.min(p, CARGA_TOPE_DIA) - 30);
export const XP_BASE_TOPE_DIA = curva(CARGA_TOPE_DIA); // 225
// cargaAntes = carga de las sesiones anteriores del mismo día.
export const xpBaseCarga = (cargaAntes, carga) => Math.round(curva(cargaAntes + Math.max(0, carga)) - curva(cargaAntes));

export const XP_PLAN = { cumplida: 150, terminada: 75, equivalente: 75, prueba: 60, pruebaRecord: 120, descanso: 60, semana: 200 };

// Descanso respetado: sin sesión, o solo recuperación (≤ 20 puntos de carga en el día e IF < 0,65 en cada sesión).
export const DESCANSO_CARGA_MAX = 20;
export const DESCANSO_IF_MAX = 0.65;

// ¿La sesión del plan está cumplida? Depende del tipo: en lo suave no vale pasarse; en lo duro no vale quedarse corto.
// Sin rango de vatios (pctEnRango null), basta con terminarla. Devuelve 'cumplida', 'terminada' o null (sin terminar).
const DURAS = new Set(['umbral', 'vo2', 'sprint']);
export function cumplimientoPlan(s) {
  if (s.tiempoMeta == null) return null;
  if (s.pctEnRango == null) return 'cumplida';
  const enRango = s.pctEnRango || 0;
  const alto = s.pctAlto || 0;
  const bajo = s.pctBajo ?? Math.max(0, 100 - enRango - alto);
  const ok = DURAS.has(s.tipoPlan) ? enRango + alto >= 70 && bajo <= 30 : s.tipoPlan === 'prueba' ? true : enRango >= 70 && alto <= 20;
  return ok ? 'cumplida' : 'terminada';
}
// La sesión era la del día: la del plan (también recuperada esa semana) o, sin plan, la que sugería la app.
export const esDelDia = (s) => !!s.delPrograma || ['plan', 'recuperar', 'sugerida'].includes(s.delDia);
// Equivale a la del plan: mismo tipo y entre el 80 % y el 130 % de la carga planificada.
export function equivalePlan(s, tipo, carga) {
  const p = s.planDelDia;
  if (!p?.carga || !p.tipo || tipo !== p.tipo) return false;
  const r = carga / p.carga;
  return r >= 0.8 && r <= 1.3;
}

// ---------- Calendario del plan ----------
// { 'AAAA-MM-DD': nombre del entrenamiento, o '' si ese día es descanso del plan }.
// Se guarda aparte del programa para que cambiar o quitar el plan no reescriba los días ya pasados.
const DIA = 864e5;
const aMs = (clave) => new Date(`${clave}T12:00:00`).getTime();
export function calendarioDe(programa) {
  const cal = {};
  if (!programa?.dias?.length) return cal;
  const ent = new Map(programa.dias.map((d) => [d.fecha, d.ent]));
  const fin = programa.dias.at(-1).fecha;
  for (let t = aMs(programa.inicio || programa.dias[0].fecha); claveDia(t) <= fin; t += DIA) cal[claveDia(t)] = ent.get(claveDia(t)) || '';
  return cal;
}
// Al cambiar de plan: lo anterior a hoy se queda como estaba; de hoy en adelante manda el plan nuevo (o nada si se quitó).
export function fusionarCalendario(viejo, programa, hoy) {
  const out = {};
  for (const [k, v] of Object.entries(viejo || {})) if (k < hoy) out[k] = v;
  for (const [k, v] of Object.entries(calendarioDe(programa))) if (k >= hoy || !(k in out)) out[k] = v;
  return out;
}
