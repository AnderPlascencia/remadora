// Programas de varias semanas: una lista de días con el entrenamiento que toca.
// programa = { nombre, inicio: 'AAAA-MM-DD', dias: [{ fecha: 'AAAA-MM-DD', ent: nombre del entrenamiento }] }
import { claveDia, marcaATope, mejorTiempoDe, nMuestras, potenciaCriticaMax, tiempoPara } from './estadisticas.js';

import { esBloqueTrabajo, ACTIVACION, predecir, DISTANCIAS_PREDICCION } from './entrenamientos.js';
import { tipoPlan, PCT_RITMO_META } from './capacidades.js';

const DIA = 864e5;
const aFecha = (clave) => new Date(`${clave}T12:00:00`);
// Semanas enteras entre dos fechas a mediodía, contando días (QA-F2: con horario de verano una semana mide 1 h más
// o menos, y dividir milisegundos entre 7 días dejaba el lunes en la semana anterior).
const semanasEntre = (a, b) => Math.floor(Math.round((b - a) / DIA) / 7);

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

// Arma un plan desde semanas de nombres: { nombre, semanas: [[ent, …], …], diasSemana: [0 = lunes, …] }.
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

// Lunes (AAAA-MM-DD) de la semana de una fecha AAAA-MM-DD.
export const lunesDe = (clave) => { const d = aFecha(clave); return claveDia(d.getTime() - ((d.getDay() + 6) % 7) * DIA); };

// Estado de cada sesión del plan: 'hecho' | 'perdido' | 'hoy' | 'pendiente'.
// El día de cada sesión es una sugerencia: cuenta como hecha si la remaste cualquier día de su semana (de lunes
// a domingo) y solo se pierde cuando la semana termina sin hacerla. Cada sesión remada cuenta una vez (dos fondos
// iguales piden dos fondos) y primero cuenta para la del mismo día. Añade hechaEl (el día en que la remaste) y
// atrasada (su día sugerido ya pasó y la semana sigue abierta).
export function estadoDias(programa, sesiones, ahora = Date.now()) {
  const hoy = claveDia(ahora);
  const lunesHoy = lunesDe(hoy);
  const remadas = new Map(); // 'lunes|nombre' → [días en que se remó, en orden]
  for (const s of [...sesiones].sort((a, b) => a.fecha - b.fecha)) {
    if (!s.entrenamiento) continue;
    const k = claveDia(s.fecha);
    const c = `${lunesDe(k)}|${s.entrenamiento}`;
    if (!remadas.has(c)) remadas.set(c, []);
    remadas.get(c).push(k);
  }
  const out = programa.dias.map((d) => ({ ...d }));
  const tomar = (d, exacto) => {
    const lista = remadas.get(`${lunesDe(d.fecha)}|${d.ent}`);
    const i = !lista?.length ? -1 : exacto ? lista.indexOf(d.fecha) : 0;
    return i < 0 ? null : lista.splice(i, 1)[0];
  };
  // Una sesión que la adaptación de antes pasó a otro día (movido) solo cuenta si se remó ese mismo día.
  for (const exacto of [true, false]) for (const d of out) if (!d.hechaEl && (exacto || !d.movido)) { const k = tomar(d, exacto); if (k) d.hechaEl = k; }
  for (const d of out) {
    if (d.hechaEl) d.estado = 'hecho';
    else if (lunesDe(d.fecha) < lunesHoy) d.estado = 'perdido';
    else d.estado = d.fecha === hoy ? 'hoy' : 'pendiente';
    if (!d.hechaEl && d.estado !== 'perdido' && d.fecha < hoy) d.atrasada = true;
  }
  return out;
}

// Lo que queda de la semana de una fecha: las sesiones del plan de esa semana, las que faltan (en el orden del plan)
// y los días que quedan contando hoy.
// «Tu primera semana · 1 de 3» (etapa 20): las sesiones de los primeros 7 días del plan y cuántas llevas. La que toca es
// la siguiente a las hechas. null fuera de esa semana o sin plan.
export function primeraSemana(programa, sesiones, ahora = Date.now()) {
  if (!programa?.inicio || !programa.dias?.length) return null;
  const fin = claveDia(aFecha(programa.inicio).getTime() + 7 * DIA);
  const hoy = claveDia(ahora);
  if (hoy < programa.inicio || hoy >= fin) return null;
  const semana = estadoDias(programa, sesiones, ahora).filter((d) => d.fecha < fin && !d.movido);
  if (!semana.length) return null;
  const hechas = semana.filter((d) => d.estado === 'hecho').length;
  return { total: semana.length, hechas, actual: Math.min(semana.length, hechas + 1), completa: hechas >= semana.length };
}

export function semanaFlexible(programa, sesiones, ahora = Date.now()) {
  const hoy = claveDia(ahora);
  const lunes = lunesDe(hoy);
  const dias = programa?.dias?.length ? estadoDias(programa, sesiones, ahora) : [];
  const semana = dias.filter((d) => lunesDe(d.fecha) === lunes && !d.movido);
  return {
    dias, semana,
    pendientes: semana.filter((d) => d.estado === 'hoy' || d.estado === 'pendiente'),
    futuras: dias.filter((d) => lunesDe(d.fecha) > lunes),
    diasQuedan: 7 - ((aFecha(hoy).getDay() + 6) % 7),
  };
}

// ¿Caben estas sesiones en n días? Una por día y nunca dos duras en días seguidos (si ayer fue dura, hoy tampoco).
export function caben(duras, suaves, n, ayerDura = false) {
  return duras + suaves <= n && duras <= Math.max(0, Math.floor((n - (ayerDura ? 1 : 0) + 1) / 2));
}

// Reparte lo que falta de la semana en los días que quedan. pendientes en el orden del plan; dura(d) → bool.
// Si no caben todas, se quedan fuera primero las duras de más (nunca la prueba si hay otra) y luego las suaves,
// empezando por las últimas. Para hoy, la primera (en orden) que deja el resto posible; con ayer duro o cansado,
// ninguna dura. Devuelve { hoy (o null), quedan, fuera, descansoOk: si descansar hoy también deja todo posible }.
export function repartirSemana(pendientes, diasQuedan, dura, { ayerDura = false, cansado = false } = {}) {
  const quedan = [...pendientes];
  const fuera = [];
  const cuenta = (lista) => { const h = lista.filter(dura).length; return [h, lista.length - h]; };
  const cabe = (lista, n, ayer) => caben(...cuenta(lista), n, ayer);
  const ultimo = (f) => quedan.findLastIndex(f);
  while (quedan.length && !cabe(quedan, diasQuedan, ayerDura)) {
    const [h] = cuenta(quedan);
    const sobranDuras = !caben(h, 0, diasQuedan, ayerDura);
    let i = sobranDuras ? ultimo((d) => dura(d) && !/^Prueba/.test(d.ent)) : ultimo((d) => !dura(d));
    if (i < 0) i = ultimo(sobranDuras ? dura : () => true);
    fuera.unshift(quedan.splice(i, 1)[0]);
  }
  let hoy = null;
  for (const d of quedan) {
    const h = dura(d);
    if (h && (ayerDura || cansado)) continue;
    if (cabe(quedan.filter((x) => x !== d), diasQuedan - 1, h)) { hoy = d; break; }
  }
  return { hoy, quedan, fuera, descansoOk: cabe(quedan, diasQuedan - 1, false) };
}

// ¿La sesión pertenece a la semana del plan en que se remó? (una sesión del plan, el día que sea de esa semana)
export function delPlanEnSuSemana(programa, s) {
  if (!programa?.dias?.length || !s?.entrenamiento) return false;
  const lunes = lunesDe(claveDia(s.inicio ?? s.fecha));
  return programa.dias.some((d) => d.ent === s.entrenamiento && lunesDe(d.fecha) === lunes);
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

// Plan automático hacia una meta: distancia en un tiempo, en N semanas (0.81: sobre el mismo motor que los planes por
// objetivo, con sus topes de carga, de VO₂ y de minutos). Una sola sesión dura por semana, que alterna umbral y
// series a ritmo de la meta; el resto son fondos (uno de ellos firme). Con 4 o 5 días se añaden fondos, nunca más
// intensidad. Zonas en % del FTP equivalente (E6), a split con la ley del cubo. Prueba a mitad y al final.
export const META_PCT = { cal: [50, 60], fondo: [62, 68], firme: [82, 88], umbral: [94, 100] };
export const splitDePct = (ref, pct) => Math.round(ref * (PCT_RITMO_META / pct) ** (1 / 3));
export const zonaSplit = (ref, [bajo, alto]) => ({ min: splitDePct(ref, alto), max: splitDePct(ref, bajo) });
export const centroZona = (ref, z) => splitDePct(ref, (z[0] + z[1]) / 2);
// Split de 2000 m equivalente a una meta: con tu curva (pc) del modelo; sin ella, de Paul (E16).
export function ref2kDe(distancia, segundos, pc = null) {
  if (distancia === 2000) return Math.round(segundos / 4);
  const a = pc ? tiempoPara(2000, pc) : null;
  const b = pc ? tiempoPara(distancia, pc) : null;
  const t2k = a && b ? (a * segundos) / b : predecir(distancia, segundos, 2000);
  return Math.round((t2k * 500) / 2000);
}

// ---------- Asistente de metas: de dónde partes y cuánto puedes mejorar ----------
// Mejora esperada del tiempo en 8 semanas según cuánto remas: quien empieza mejora mucho más que quien ya entrena.
// Con más o menos semanas se escala con la raíz (las primeras semanas rinden más que las últimas), hasta 1,5 veces.
export const MEJORA_META = { inicio: 0.06, medio: 0.04, alto: 0.025 };
export function nivelRemero(sesiones, ahora = Date.now()) {
  const n = (sesiones || []).filter((s) => s.fecha <= ahora).length;
  const ultimas = (sesiones || []).filter((s) => s.fecha <= ahora && s.fecha > ahora - 56 * DIA).length / 8;
  return n < 10 || ultimas < 1.5 ? 'inicio' : ultimas >= 3 ? 'alto' : 'medio';
}
export const mejoraMeta = (nivel, semanas = 8) => (MEJORA_META[nivel] ?? MEJORA_META.medio) * Math.min(1.5, Math.sqrt(Math.max(1, semanas) / 8));

// Tiempo del que partes en una distancia: tu marca real de los últimos 90 días; si no la hay, la predicción desde la
// distancia más cercana que hayas remado (la media de tus 3 mejores, pesando más las recientes), nunca la más
// optimista de todas. Sin nada en 90 días, lo mismo con todo el historial.
// → { t, real, desde (distancia de la que sale), nivel, meta (tiempo meta sugerido), mejora } o null.
export function sugerirMeta(sesiones, distancia, semanas = 8, ahora = Date.now()) {
  const nivel = nivelRemero(sesiones, ahora);
  const mejora = mejoraMeta(nivel, semanas);
  const con = (sesiones || []).filter((s) => s.fecha <= ahora && nMuestras(s));
  // E-1: solo cuentan los tramos a tope (no el 2000 m de dentro de un fondo).
  const marcas = (lista, d, pc) => lista.map((s) => ({ t: marcaATope(s, d, pc), edad: (ahora - s.fecha) / DIA })).filter((x) => x.t > 0);
  const partida = (lista) => {
    const pc = potenciaCriticaMax(lista);
    const real = marcas(lista, distancia, pc);
    if (real.length) return { t: Math.min(...real.map((x) => x.t)), real: true, desde: distancia };
    // Etapa 18: sin marca en esa distancia, el motor único (tu curva potencia–duración); la ley de Paul, de respaldo.
    const tm = pc ? tiempoPara(distancia, pc) : null;
    if (tm) return { t: tm, real: false, desde: null, modelo: true };
    // Ni marca ni modelo: desde una marca a tope o, si no hay ninguna, desde lo mejor que remaste.
    const crudas = (d) => lista.map((s) => ({ t: mejorTiempoDe(s, d), edad: (ahora - s.fecha) / DIA })).filter((x) => x.t > 0);
    const de = DISTANCIAS_PREDICCION.some((d) => d !== distancia && marcas(lista, d, pc).length) ? (d) => marcas(lista, d, pc) : crudas;
    const otras = DISTANCIAS_PREDICCION.filter((d) => d !== distancia)
      .map((d) => ({ d, m: de(d) })).filter((x) => x.m.length)
      .sort((a, b) => Math.abs(Math.log2(a.d / distancia)) - Math.abs(Math.log2(b.d / distancia)));
    if (!otras.length) return null;
    const { d, m } = otras[0];
    const tres = m.sort((a, b) => a.t - b.t).slice(0, 3);
    const peso = tres.map((x) => 0.5 ** (x.edad / 30));
    const t = tres.reduce((a, x, i) => a + predecir(d, x.t, distancia) * peso[i], 0) / peso.reduce((a, x) => a + x, 0);
    return { t: Math.round(t), real: false, desde: d };
  };
  const p = partida(con.filter((s) => s.fecha > ahora - 90 * DIA)) || partida(con);
  return p ? { ...p, nivel, mejora, meta: Math.round(p.t * (1 - mejora)) } : null;
}

// ---------- Plan por objetivo: la app decide intensidades, ritmos y volúmenes ----------
// Cinco planes, uno por capacidad física. Las intensidades van en % de tu FTP, así el plan se ajusta solo
// cuando mejoras. Una sola sesión dura por semana; con 3 días, además una moderada; con 4 o 5, fondos en zona 2.
// Los mismos nombres en el inicio guiado y en el asistente de Planes; «tema» es lo que va en el nombre del plan.
export const OBJETIVOS_PLAN = [
  { clave: 'base', nombre: 'Base aeróbica', tema: 'base aeróbica', texto: 'Aguantar más y mejor: fondos en zona 2 guiados por tu pulso. El plan que mejor va con un reloj.', prueba: 'Prueba de pulso fijo 30 min' },
  { clave: 'vo2', nombre: 'Subir mi VO₂máx', tema: 'VO₂máx', texto: 'Más capacidad de oxígeno: series de 2 a 4 min fuertes, fondo y umbral.', prueba: 'Prueba 5 min' },
  { clave: 'umbral', nombre: 'Subir mi FTP', tema: 'umbral', texto: 'Más potencia sostenida: bloques largos de umbral y sweet spot.', prueba: 'Prueba FTP 20 min' },
  { clave: 'potencia', nombre: 'Más fuerza y potencia', tema: 'potencia', texto: 'Más watts por palada: sprints, fuerza a cadencia baja y arranques.', prueba: 'Prueba de potencia' },
  { clave: 'calorias', nombre: 'Quemar calorías', tema: 'calorías', texto: 'Una meta semanal de calorías que sube poco a poco: mucho fondo y un día de series.', prueba: null },
];
// Planes de antes de la v0.35 → el plan nuevo con el mismo espíritu (para «Siguiente plan» y «Ajustar»).
export const OBJETIVOS_ANTIGUOS = { nivel: 'base', distancia: 'base', ritmo: 'umbral', tecnica: 'base' };
export const objetivoPlan = (clave) => OBJETIVOS_PLAN.find((o) => o.clave === (OBJETIVOS_ANTIGUOS[clave] || clave)) || null;
export const NIVELES_PLAN = [
  { clave: 'inicio', nombre: 'Estoy empezando', volumen: 0.7 },
  { clave: 'medio', nombre: 'Remo a veces', volumen: 1 },
  { clave: 'alto', nombre: 'Remo seguido', volumen: 1.3 },
];
// Días de entreno según cuántos por semana (0 = lunes).
export const DIAS_PLAN = { 1: [5], 2: [1, 4], 3: [0, 2, 5], 4: [0, 1, 3, 5], 5: [0, 1, 3, 4, 6] };

export const CAL = { nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 70 };
export const ENF = { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 };
const SUAVE = (dur) => ({ nombre: 'Descanso', duracion: dur, metrica: 'ftp', min: 40, max: 55 });
export const ronda = (x, paso) => Math.max(paso, Math.round(x / paso) * paso);
export const series = (reps, trabajo, descanso) => Array.from({ length: reps }, (_, i) => [
  { ...trabajo, nombre: `${trabajo.nombre} ${i + 1}/${reps}` }, ...(i < reps - 1 ? [SUAVE(descanso)] : []),
]).flat();
// Escoge de una progresión según el avance del plan (p de 0 a 1).
export const paso = (lista, p) => lista[Math.min(lista.length - 1, Math.floor(p * lista.length))];
export const reps = (n, k) => Math.max(2, Math.round(n * k));

// Nivel de resistencia de la consola (1–24) en fuerza y sprints, según la experiencia del plan.
export const NIVEL_FUERZA = { inicio: 10, medio: 12, alto: 14 };
export const NIVEL_SPRINT = { inicio: 12, medio: 14, alto: 16 };

// ---------- Cadencia guía (0.81) ----------
// Golpes por minuto que pide cada bloque de trabajo según su intensidad: fondo suave 18–22, fondo firme 20–24,
// umbral 24–28 y ritmo de 2 km 28–34; los sprints y arranques van libres. Es una guía (spmGuia): se muestra, se
// dice al empezar el bloque y avisa con suavidad si te pasas en un fondo, pero no cambia la XP de técnica (eso solo
// lo hace spmMeta, la cadencia obligatoria de los bloques de fuerza).
export const CADENCIA_GUIA = { suave: [18, 22], firme: [20, 24], umbral: [24, 28], ritmo: [28, 34] };
export { PCT_RITMO_META };
const medio = (b) => (b.min + Math.min(b.max, b.min + 30)) / 2;
// % del FTP equivalente de un bloque (null si no tiene meta de potencia o de split).
export function pctBloque(b, splitMeta = null) {
  if (b.metrica === 'ftp') return medio(b);
  if (b.metrica === 'fcpct') return ((b.min + b.max) / 2) * 0.95;
  if (b.metrica === 'split' && splitMeta > 0 && b.min > 0) return PCT_RITMO_META * (splitMeta / ((b.min + b.max) / 2)) ** 3;
  return null;
}
// Segundos de un bloque; los que acaban por distancia se estiman con su split.
export const segBloque = (b) => b.duracion || (b.fin === 'distancia' && b.cantidad > 0 && b.metrica === 'split' && b.min > 0 ? Math.round((b.cantidad / 500) * ((b.min + b.max) / 2)) : 0);
export function cadenciaGuia(b, splitMeta = null) {
  if (!esBloqueTrabajo(b) || b.spmMeta || b.spmGuia) return null;
  const pct = pctBloque(b, splitMeta);
  if (pct == null || pct >= 130 || (b.duracion > 0 && b.duracion < 60)) return null;
  return pct < 76 ? CADENCIA_GUIA.suave : pct < 92 ? CADENCIA_GUIA.firme : pct < 106 ? CADENCIA_GUIA.umbral : CADENCIA_GUIA.ritmo;
}
export const conCadencia = (e) => (e.bloques ? { ...e, bloques: e.bloques.map((b) => { const g = cadenciaGuia(b, e.splitMeta); return g ? { ...b, spmGuia: g } : b; }) } : e);


// Cada sesión recibe el avance del plan (p: 0 la primera semana, 1 la última), k (volumen del nivel,
// un 30 % menos en semana de descarga), el contexto (kcalHabitual) y el número de semana.
// UX2-21 (ronda 2, etapa 10): un solo patrón de nombre, «Fondo 30 min · suave»; la zona va en el detalle. Los planes
// ya guardados conservan sus nombres (identifican tus sesiones y récords).
// E-3 (E9): un fondo nunca baja de 25 min (uno de 10 no entrena nada), salvo que tu perfil ponga un tope menor.
export const FONDO_MIN = 25;
const minFondo = (ctx) => (ctx?.minutosMax > 0 ? Math.min(FONDO_MIN, Math.max(10, ctx.minutosMax - 13)) : FONDO_MIN);
const minutosFondo = (min, p, k, ctx) => Math.max(minFondo(ctx), ronda((min[0] + (min[1] - min[0]) * p) * k, 5));
export const SESIONES = {
  fondo: (min) => (p, k, ctx) => { const m = minutosFondo(min, p, k, ctx); return { nombre: `Fondo ${m} min · suave`, enfoque: 'distancia', bloques: [CAL, { nombre: 'Fondo', duracion: m * 60, metrica: 'ftp', min: 56, max: 75 }, ENF] }; },
  // Fondo con techo de pulso (70 % del máximo): con un reloj de muñeca es lo más fiable.
  fondoPulso: (min) => (p, k, ctx) => { const m = minutosFondo(min, p, k, ctx); return { nombre: `Fondo ${m} min · pulso suave`, enfoque: 'distancia', bloques: [CAL, { nombre: 'Fondo a pulso controlado', duracion: m * 60, metrica: 'fcpct', min: 60, max: 70 }, ENF] }; },
  fondoTempo: (min) => (p, k, ctx) => {
    const m = minutosFondo(min, p, k, ctx); const n = p < 0.5 ? 3 : 2; const t = p < 0.5 ? 5 : 10;
    const resto = Math.max(5, m - n * t);
    return { nombre: `Fondo ${m} min · ${n} × ${t} min de tempo`, enfoque: 'distancia', bloques: [CAL, { nombre: 'Fondo', duracion: Math.round((resto / 2) * 60), metrica: 'ftp', min: 56, max: 75 }, ...series(n, { nombre: 'Tempo', duracion: t * 60, metrica: 'ftp', min: 76, max: 90 }, 180), { nombre: 'Fondo', duracion: Math.round((resto / 2) * 60), metrica: 'ftp', min: 56, max: 75 }, ENF] };
  },
  vo2: (p, k) => {
    const [n, dur, min, max] = paso([[5, 2, 110, 115], [6, 2, 110, 115], [5, 3, 108, 112], [4, 4, 106, 110]], p);
    const r = reps(n, k);
    return { nombre: `VO₂ ${r} × ${dur} min`, enfoque: 'potencia', bloques: [CAL, ...ACTIVACION, ...series(r, { nombre: 'Fuerte', duracion: dur * 60, metrica: 'ftp', min, max }, Math.min(180, dur * 60)), ENF] };
  },
  // Series de 30 s fuertes y 15 s suaves: mucho tiempo cerca del VO₂máx con poco desgaste.
  treinta15: (p, k) => {
    // Como mucho 13 por serie (3 × 13 × 30 s ≈ 20 min fuertes): más ya no suma, solo cansa.
    const n = Math.min(13, reps(p < 0.5 ? 10 : 12, k));
    const serie = Array.from({ length: n }, (_, i) => [{ nombre: `30 s fuerte ${i + 1}/${n}`, duracion: 30, metrica: 'ftp', min: 115, max: 130 }, { nombre: 'Descanso', duracion: 15, metrica: 'ftp', min: 40, max: 55 }]).flat();
    return { nombre: `3 series de ${n} × 30/15`, enfoque: 'potencia', bloques: [CAL, ...ACTIVACION, ...serie, SUAVE(180), ...serie, SUAVE(180), ...serie, ENF] };
  },
  umbral: (p, k) => {
    // E10: pasos finos (3 × 8 → 3 × 9 → 3 × 10…): con una sola dura por semana el tope de subida no se atasca.
    const [n, min, lo, hi] = paso([[3, 8, 95, 100], [3, 9, 95, 100], [3, 10, 95, 100], [3, 11, 95, 100], [3, 12, 95, 100], [2, 15, 95, 100], [2, 18, 95, 100], [2, 20, 95, 100], [1, 30, 93, 97]], p);
    const r = n === 1 ? 1 : reps(n, k);
    return { nombre: `Umbral ${r} × ${min} min`, enfoque: 'potencia', bloques: [CAL, ...(r === 1 ? [{ nombre: 'Umbral', duracion: min * 60, metrica: 'ftp', min: lo, max: hi }] : series(r, { nombre: 'Umbral', duracion: min * 60, metrica: 'ftp', min: lo, max: hi }, 180)), ENF] };
  },
  umbralCorto: (p, k) => { const m = p < 0.5 || k < 0.4 ? 8 : 10; const r = reps(3, k); return { nombre: `Umbral ${r} × ${m} min`, enfoque: 'potencia', bloques: [CAL, ...series(r, { nombre: 'Umbral', duracion: m * 60, metrica: 'ftp', min: 91, max: 100 }, 180), ENF] }; },
  // Sweet spot (88–94 % del FTP): casi tanto estímulo como el umbral con menos fatiga.
  sweet: (p, k) => { const [n, m] = paso([[2, 12], [2, 15], [3, 12], [3, 15]], p); const r = reps(n, k); return { nombre: `Sweet spot ${r} × ${m} min`, enfoque: 'potencia', bloques: [CAL, ...series(r, { nombre: 'Sweet spot', duracion: m * 60, metrica: 'ftp', min: 88, max: 94 }, 240), ENF] }; },
  vo2Corto: (p, k) => { const r = reps(5, k); return { nombre: `VO₂ ${r} × 3 min`, enfoque: 'potencia', bloques: [CAL, ...ACTIVACION, ...series(r, { nombre: 'Fuerte', duracion: 180, metrica: 'ftp', min: 108, max: 112 }, 180), ENF] }; },
  // La resistencia de la consola sube con la experiencia: a cadencia baja y nivel alto la espalda carga mucho.
  sprints: (p, k, ctx = {}) => {
    const [n, seg, minutos] = paso([[6, 15, 0], [8, 15, 0], [6, 20, 4], [8, 20, 5]], p);
    const r = reps(n, k);
    const extra = minutos ? [SUAVE(180), ...series(reps(minutos, k), { nombre: '1 min fuerte', duracion: 60, metrica: 'ftp', min: 120, max: 130 }, 120)] : [];
    return { nombre: `Sprints ${r} × ${seg} s${minutos ? ` + ${reps(minutos, k)} × 1 min` : ''}`, enfoque: 'potencia', bloques: [CAL, ...ACTIVACION, ...series(r, { nombre: 'Sprint a tope', duracion: seg, metrica: 'ftp', min: 140, max: 250, nivel: NIVEL_SPRINT[ctx.nivelPlan] ?? 14 }, 120), ...extra, ENF] };
  },
  // Fuerza-resistencia: cerca del umbral pero a cadencia baja, para que cada palada pese.
  fuerza: (p, k, ctx = {}) => { const [n, m] = paso([[4, 3], [5, 3], [4, 4], [5, 4]], p); const r = reps(n, k); return { nombre: `Fuerza ${r} × ${m} min a 18 paladas/min`, enfoque: 'potencia', bloques: [CAL, ...series(r, { nombre: 'Fuerza a 18-20 paladas/min', duracion: m * 60, metrica: 'ftp', min: 88, max: 95, spmMeta: [18, 20], nivel: NIVEL_FUERZA[ctx.nivelPlan] ?? 12 }, 120), ENF] }; },
  // E10: con 2 días, la fuerza de potencia va dentro del fondo (1 min a cadencia baja): la semana sigue con un fondo.
  fondoFuerza: (min) => (p, k, ctx) => {
    const m = minutosFondo(min, p, k, ctx); const n = 4;
    const resto = Math.max(10, m - (n + (n - 1) * 2));
    const f = { nombre: 'Fondo', duracion: Math.round((resto / 2) * 60), metrica: 'ftp', min: 56, max: 75 };
    return { nombre: `Fondo ${m} min · ${n} × 1 min a 20 paladas`, enfoque: 'distancia', bloques: [CAL, f, ...series(n, { nombre: '1 min a 18-20 paladas/min', duracion: 60, metrica: 'ftp', min: 80, max: 88, spmMeta: [18, 20], nivel: NIVEL_FUERZA[ctx?.nivelPlan] ?? 12 }, 120), f, ENF] };
  },
  calibracion: (p, k, ctx) => {
    const m = Math.max(30, minutosFondo([30, 40], p, k, ctx));
    const f = (min) => ({ nombre: 'Fondo', duracion: min * 60, metrica: 'ftp', min: 56, max: 75 });
    return { nombre: `Fondo ${m} min · 12 min a tu ritmo fuerte`, enfoque: 'distancia', calibracion: true, bloques: [CAL, f(Math.round((m - 12) / 2)), { nombre: 'A tu ritmo fuerte: parejo, que te cueste (calibra tu FTP)', duracion: 720, metrica: 'ftp', min: 90, max: 105 }, f(Math.round((m - 12) / 2)), ENF] };
  },
  arranques: (p, k) => {
    const m = ronda((30 + 15 * p) * k, 5); const n = p < 0.5 ? 4 : 6;
    const fondo = (min) => ({ nombre: 'Fondo', duracion: min * 60, metrica: 'ftp', min: 56, max: 75 });
    const arr = Array.from({ length: n }, (_, i) => [{ nombre: `Arranque ${i + 1}/${n}: 10 paladas a tope`, duracion: 20, metrica: 'ftp', min: 140, max: 250 }, { nombre: 'Suave', duracion: 100, metrica: 'ftp', min: 40, max: 60 }]).flat();
    return { nombre: `Fondo ${m} min + ${n} arranques`, enfoque: 'potencia', bloques: [CAL, fondo(Math.max(5, m - n * 2)), ...arr, ENF] };
  },
  kcalSeries: (p, k) => { const r = reps(8, k); const m = ronda(20 * k, 5); return { nombre: `${r} × 1 min + ${m} min de fondo`, enfoque: 'calorias', bloques: [CAL, ...ACTIVACION, ...series(r, { nombre: '1 min fuerte', duracion: 60, metrica: 'ftp', min: 105, max: 115 }, 60), SUAVE(120), { nombre: 'Fondo', duracion: m * 60, metrica: 'ftp', min: 56, max: 75 }, ENF] }; },
  kcalMeta: (p, k, ctx) => { const v = ronda((ctx.kcalHabitual || 250) * (1.1 + 0.6 * p) * Math.min(1, k + 0.2), 50); return { tipo: 'objetivo', nombre: `Quema ${v} kcal`, enfoque: 'calorias', objetivo: { metrica: 'kcal', valor: v } }; },
};

export const CAL_CORTO = { ...CAL, duracion: 300 };
export const ENF_CORTO = { ...ENF, duracion: 180 };

// Tipos de sesión que cansan: entre dos de ellos conviene al menos un día de descanso o de fondo.
export const TIPOS_DUROS = new Set(['umbral', 'vo2', 'sprint', 'prueba']);
export const esDura = (ent) => TIPOS_DUROS.has(tipoPlan(ent));

// Reparte las sesiones de una semana entre sus días para que dos duras no caigan en días seguidos
// (domingoDuro: la semana anterior terminó el domingo con una dura, así el lunes no repite).
// Cambia lo mínimo posible el orden de prioridad, y la prueba, cuando la hay, se queda al final de la semana.
export function ordenarSemana(nombres, diasSemana, buscar, domingoDuro = false) {
  if (nombres.length < 2) return nombres;
  const duro = nombres.map((n) => esDura(buscar(n)));
  const seguidos = (a, b) => Math.abs(b - a) === 1;
  const fija = tipoPlan(buscar(nombres.at(-1))) === 'prueba' ? nombres.length - 1 : null;
  let mejor = null;
  const probar = (orden) => {
    const ds = orden.map((i) => duro[i]);
    let choques = domingoDuro && diasSemana[0] === 0 && ds[0] ? 1 : 0;
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) if (ds[i] && ds[j] && seguidos(diasSemana[i], diasSemana[j])) choques++;
    }
    const mueve = orden.reduce((a, x, i) => a + Math.abs(x - i), 0);
    const puntos = choques * 100 + mueve;
    if (!mejor || puntos < mejor.puntos) mejor = { puntos, orden };
  };
  const permutar = (resto, hecho) => {
    if (!resto.length) { probar(fija == null ? hecho : [...hecho, fija]); return; }
    resto.forEach((x, i) => permutar([...resto.slice(0, i), ...resto.slice(i + 1)], [...hecho, x]));
  };
  permutar(nombres.map((_, i) => i).filter((i) => i !== fija), []);
  return mejor.orden.map((i) => nombres[i]);
}

// Duración de una sesión del plan en segundos (las de meta de calorías van a tu ritmo: no cuentan).
export const duracionPlan = (e) => (e.bloques || []).reduce((a, b) => a + segBloque(b), 0);

// ---------- Topes de carga ----------
// Trabajo por encima del 106 % del FTP (VO₂ y más): hasta 25 min por sesión y unos 40 min por semana.
export const VO2_MAX_SESION = 25 * 60;
export const VO2_MAX_SEMANA = 40 * 60;
// La carga de una semana (trabajo en segundos y esfuerzo planificado, como el TSS) sube como mucho un 15 %
// respecto a la última semana normal; la semana que vuelve de una descarga, como mucho un 5 %.
export const SUBIDA_MAX = 1.15;
export const VUELTA_DESCARGA = 1.05;
// Volumen de las otras sesiones en la semana de una prueba (afinamiento): un 45 % menos antes de la final y un 20 %
// antes de la de mitad del plan.
export const AFINAMIENTO = 0.55;
export const AFINAMIENTO_MITAD = 0.8;
// Planes intensos: quien está empezando hace primero unas semanas de base aeróbica.
export const OBJETIVOS_INTENSOS = new Set(['umbral', 'vo2', 'potencia']);
export const semanasDeBase = (objetivo, nivel, semanas) => (nivel === 'inicio' && OBJETIVOS_INTENSOS.has(objetivo) ? Math.min(3, Math.floor(semanas / 2)) : 0);

// Segundos de trabajo por encima del 106 % del FTP (el punto medio del rango; los sprints «a tope» cuentan entero).
// En split (planes de meta) cuenta su equivalente (pctBloque).
export const segVo2 = (e) => (e?.bloques || [])
  .filter((b) => esBloqueTrabajo(b) && (b.metrica === 'ftp' || b.metrica === 'split') && pctBloque(b, e.splitMeta) >= 106)
  .reduce((a, b) => a + segBloque(b), 0);
// Segundos de trabajo intenso (desde el sweet spot, 88 % del FTP): lo que más cansa y lo que más debe subir despacio.
export const segIntenso = (e) => (e?.bloques || [])
  .filter((b) => esBloqueTrabajo(b) && (b.metrica === 'ftp' ? b.min >= 88 : b.metrica === 'split' && pctBloque(b, e.splitMeta) >= 88))
  .reduce((a, b) => a + segBloque(b), 0);
// Segundos de trabajo de una sesión: sin calentamiento, descansos ni enfriamiento (una meta de calorías, estimada).
export const segTrabajo = (e) => (e?.bloques?.length
  ? e.bloques.filter(esBloqueTrabajo).reduce((a, b) => a + segBloque(b), 0)
  : minutosSesion(e) * 60);

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

// Semana del plan en una fecha: las semanas van de lunes a domingo desde la del inicio (como el calendario).
// { n (1 = la primera), total, descarga } o null sin plan.
export function semanaDe(programa, ahora = Date.now()) {
  if (!programa?.dias?.length) return null;
  const ini = aFecha(programa.inicio);
  const lunes = ini.getTime() - ((ini.getDay() + 6) % 7) * DIA;
  const n = semanasEntre(lunes, aFecha(claveDia(ahora)).getTime()) + 1;
  const ultimo = aFecha(programa.dias.at(-1).fecha).getTime();
  const total = programa.semanas || semanasEntre(lunes, ultimo) + 1;
  return { n, total, descarga: !!(programa.objetivo || programa.conDescarga) && n % 4 === 0 && n < total };
}

// Meta de calorías de la semana de una fecha (o null si el plan no tiene).
export function metaKcalDe(programa, ahora = Date.now()) {
  if (!programa?.metaKcal) return null;
  const s = semanasEntre(aFecha(programa.inicio).getTime(), aFecha(claveDia(ahora)).getTime());
  return s >= 0 && s < programa.metaKcal.length ? programa.metaKcal[s] : null;
}

// Fondo suelto de m minutos (lo usa la adaptación del plan para cambiar o alargar una sesión).
export function sesionFondo(m, { pulso = false } = {}) {
  const e = (pulso ? SESIONES.fondoPulso : SESIONES.fondo)([m, m])(0, 1);
  return { tipo: 'intervalos', ...e };
}

// ---------- Vista previa del plan: semana a semana ----------
// Minutos estimados de una sesión. Las de meta (calorías, distancia) no tienen duración fija: se aproxima.
export function minutosSesion(e) {
  if (!e) return 0;
  const s = duracionPlan(e);
  if (s) return Math.round(s / 60);
  const o = e.objetivo || {};
  if (o.metrica === 'kcal') return Math.round(o.valor / 10); // ~600 kcal por hora a ritmo de fondo
  if (o.metrica === 'distancia') return Math.round(o.valor / 4 / 60); // ~2:05 cada 500 m
  if (o.metrica === 'tiempo') return Math.round(o.valor / 60);
  return 30;
}
// Esfuerzo de una sesión en puntos (como el TSS: 100 = una hora a tu FTP). Sirve para comparar semanas.
export function esfuerzoSesion(e) {
  if (!e) return 0;
  const bloques = e.bloques?.length ? e.bloques : [{ duracion: minutosSesion(e) * 60, intensidad: 0.75 }];
  const pts = bloques.reduce((a, b) => {
    let i = b.intensidad;
    if (i == null) {
      const pct = pctBloque(b, e.splitMeta);
      if (pct != null) i = Math.min(1.5, pct / 100); // los sprints «a tope» no se disparan
      else if (b.prueba) i = b.duracion <= 120 ? 1.3 : b.duracion <= 600 ? 1.1 : 1;
      else i = 0.5;
    }
    return a + (segBloque(b) / 3600) * i * i * 100;
  }, 0);
  return Math.round(pts);
}
// «Umbral 3 × 8 min» y «Umbral 3 × 10 min» son la misma familia: sirve para decir qué subió cada semana.
const familia = (n) => n.replace(/\d+([.,]\d+)?/g, '#');

// Semanas del plan con lo que toca cada día, sus minutos y su esfuerzo, para mostrar cómo progresa.
// buscar(nombre) → el entrenamiento. Devuelve [{ n, lunes, dias: [{ fecha, ent, estado, min, esfuerzo, dura,
// prueba, antes }], minutos, esfuerzo, descarga, prueba, actual, pasada }]; antes: la sesión de la misma familia
// de la semana anterior cuando cambió (p. ej. «Umbral 3 × 8 min» → «Umbral 3 × 10 min»).
export function semanasPlan(programa, sesiones, buscar, ahora = Date.now()) {
  if (!programa?.dias?.length) return [];
  const ini = aFecha(programa.inicio);
  const lunes0 = ini.getTime() - ((ini.getDay() + 6) % 7) * DIA;
  const hoy = aFecha(claveDia(ahora)).getTime();
  const actual = semanasEntre(lunes0, hoy);
  const semanas = [];
  for (const d of estadoDias(programa, sesiones, ahora)) {
    const i = semanasEntre(lunes0, aFecha(d.fecha).getTime());
    while (semanas.length <= i) {
      const n = semanas.length;
      semanas.push({ n: n + 1, lunes: claveDia(lunes0 + n * 7 * DIA), dias: [], actual: n === actual, pasada: n < actual });
    }
    const e = buscar(d.ent);
    const prueba = /^Prueba/.test(d.ent) || !!e?.prueba || !!e?.pruebaFtp;
    semanas[i].dias.push({ ...d, min: minutosSesion(e), esfuerzo: esfuerzoSesion(e), dura: prueba || (!!e && esDura(e)), prueba });
  }
  const total = semanas.length;
  semanas.forEach((s, i) => {
    // Una sesión que la adaptación pasó a otro día (movido) no cuenta dos veces.
    const cuentan = s.dias.filter((d) => !d.movido);
    s.minutos = cuentan.reduce((a, d) => a + d.min, 0);
    s.esfuerzo = cuentan.reduce((a, d) => a + d.esfuerzo, 0);
    s.sesiones = cuentan.length;
    s.prueba = s.dias.some((d) => d.prueba);
    s.descarga = !!(programa.objetivo || programa.conDescarga) && s.n % 4 === 0 && s.n < total;
    const previa = semanas[i - 1];
    if (!previa) return;
    const usados = new Set();
    for (const d of s.dias) {
      const j = previa.dias.findIndex((x, k) => !usados.has(k) && familia(x.ent) === familia(d.ent));
      if (j < 0) continue;
      usados.add(j);
      if (previa.dias[j].ent !== d.ent) d.antes = previa.dias[j].ent;
    }
  });
  return semanas;
}

// ---------- No perder a quien falla (etapa 14) ----------
// «Solo tengo 15 / 20 min»: una versión corta que conserva el estímulo clave. El calentamiento baja a 5 min y el
// enfriamiento a 3; del trabajo entra lo que quepa en su orden (2 de 4 series, por ejemplo), y un fondo se acorta.
// Mismo nombre que la original (cuenta como la sesión del plan) y versionCorta = minutos. null si ya cabe o no tiene bloques.
export const VERSION_CORTA_MIN = [15, 20];
export function versionCorta(ent, minutos) {
  const b = ent?.bloques || [];
  if (!b.length || !(minutos > 0) || duracionPlan(ent) <= minutos * 60 + 60) return null;
  const esCal = /^calentamiento/i.test(b[0].nombre || '');
  const esEnf = b.length > 1 && /^enfriamiento/i.test(b.at(-1).nombre || '');
  const cal = esCal ? { ...b[0], duracion: Math.min(b[0].duracion || 300, 300) } : null;
  const enf = esEnf ? { ...b.at(-1), duracion: Math.min(b.at(-1).duracion || 180, 180) } : null;
  const medio = b.slice(esCal ? 1 : 0, esEnf ? -1 : undefined);
  let resto = minutos * 60 - (cal ? segBloque(cal) : 0) - (enf ? segBloque(enf) : 0);
  const out = [];
  for (const x of medio) {
    const s = segBloque(x);
    if (s && s <= resto) { out.push(x); resto -= s; continue; }
    // No cabe entero: un bloque de tiempo largo (un fondo) se acorta; una serie, no (mejor 2 series enteras que 3 a medias).
    if (x.duracion && resto >= 120 && (x.duracion >= 600 || !out.some(esBloqueTrabajo))) out.push({ ...x, duracion: Math.round(resto / 60) * 60 });
    break;
  }
  while (out.length && !esBloqueTrabajo(out.at(-1))) out.pop(); // no termina en un descanso
  if (!out.some(esBloqueTrabajo)) return null;
  const n = medio.filter(esBloqueTrabajo).length;
  const k = out.filter(esBloqueTrabajo).length;
  return { ...ent, bloques: [...(cal ? [cal] : []), ...out, ...(enf ? [enf] : [])], versionCorta: minutos, resumenCorta: n > 1 ? `${k} de ${n} bloques de trabajo` : 'el trabajo acortado' };
}
// Una sesión con menos volumen para volver tras un parón: el trabajo dura `k` veces lo planeado (series de menos o
// más cortas) y los rangos de vatios bajan a `rangos`. Nombre propio, para que la adaptación la guarde aparte.
export function sesionDeVuelta(ent, k, rangos = 1, etiqueta = 'vuelta') {
  if (!ent?.bloques?.length) return null;
  const escala = (x) => {
    if (!esBloqueTrabajo(x)) return x;
    const y = { ...x };
    if (y.duracion) y.duracion = Math.max(30, Math.round((y.duracion * k) / 15) * 15);
    else if (y.cantidad) y.cantidad = Math.max(100, Math.round((y.cantidad * k) / 50) * 50);
    if (y.metrica === 'ftp' && rangos !== 1) { y.min = Math.round(y.min * rangos); if (y.max) y.max = Math.round(y.max * rangos); }
    return y;
  };
  const { id, ...resto } = ent;
  return { ...resto, nombre: `${ent.nombre} · ${etiqueta}`, bloques: ent.bloques.map(escala), dePlan: true };
}
