// Programas de varias semanas: una lista de días con el entrenamiento que toca.
// programa = { nombre, inicio: 'AAAA-MM-DD', dias: [{ fecha: 'AAAA-MM-DD', ent: nombre del entrenamiento }] }
import { claveDia, mejorTiempoDe, nMuestras, potenciaCriticaMax, tiempoPara } from './estadisticas.js';

import { formatoMmss as mm, PRUEBAS, esBloqueTrabajo, ACTIVACION, predecir, DISTANCIAS_PREDICCION } from './entrenamientos.js';
import { tipoPlan, SPLIT_CAL_META } from './capacidades.js';

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
// intensidad. Zonas desde el split de la meta: fondo (UT2) a +20–30 s, firme a +13–17 s, umbral (AT) a +8–12 s y el
// calentamiento más suave que el fondo (+32–45 s). Prueba a mitad y al final, con afinamiento la semana de la prueba.
export const META_FONDO = [20, 30];
export const META_FIRME = [13, 17];
export const META_UMBRAL = [8, 12];
export const META_CAL = SPLIT_CAL_META;
export function planPorMeta({ distancia, segundos, semanas, inicio, dias = 3, nivel = 'medio', ctx = {} }) {
  return planPorObjetivo({ objetivo: 'meta', nivel, dias, semanas, inicio, ctx, meta: { distancia, segundos } });
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
  const marcas = (lista, d) => lista.map((s) => ({ t: mejorTiempoDe(s, d), edad: (ahora - s.fecha) / DIA })).filter((x) => x.t > 0);
  const partida = (lista) => {
    const real = marcas(lista, distancia);
    if (real.length) return { t: Math.min(...real.map((x) => x.t)), real: true, desde: distancia };
    // Etapa 18: sin marca en esa distancia, el motor único (tu curva potencia–duración); la ley de Paul, de respaldo.
    const pc = potenciaCriticaMax(lista);
    const tm = pc ? tiempoPara(distancia, pc) : null;
    if (tm) return { t: tm, real: false, desde: null, modelo: true };
    const otras = DISTANCIAS_PREDICCION.filter((d) => d !== distancia)
      .map((d) => ({ d, m: marcas(lista, d) })).filter((x) => x.m.length)
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
// cuando mejoras. Con más de 3 días por semana se añaden fondos en zona 2, nunca más intensidad (80/20).
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

const CAL = { nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 70 };
const ENF = { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 };
const SUAVE = (dur) => ({ nombre: 'Descanso', duracion: dur, metrica: 'ftp', min: 40, max: 55 });
const ronda = (x, paso) => Math.max(paso, Math.round(x / paso) * paso);
const series = (reps, trabajo, descanso) => Array.from({ length: reps }, (_, i) => [
  { ...trabajo, nombre: `${trabajo.nombre} ${i + 1}/${reps}` }, ...(i < reps - 1 ? [SUAVE(descanso)] : []),
]).flat();
// Escoge de una progresión según el avance del plan (p de 0 a 1).
const paso = (lista, p) => lista[Math.min(lista.length - 1, Math.floor(p * lista.length))];
const reps = (n, k) => Math.max(2, Math.round(n * k));

// Nivel de resistencia de la consola (1–24) en fuerza y sprints, según la experiencia del plan.
export const NIVEL_FUERZA = { inicio: 10, medio: 12, alto: 14 };
export const NIVEL_SPRINT = { inicio: 12, medio: 14, alto: 16 };

// ---------- Cadencia guía (0.81) ----------
// Golpes por minuto que pide cada bloque de trabajo según su intensidad: fondo suave 18–22, fondo firme 20–24,
// umbral 24–28 y ritmo de 2 km 28–34; los sprints y arranques van libres. Es una guía (spmGuia): se muestra, se
// dice al empezar el bloque y avisa con suavidad si te pasas en un fondo, pero no cambia la XP de técnica (eso solo
// lo hace spmMeta, la cadencia obligatoria de los bloques de fuerza).
export const CADENCIA_GUIA = { suave: [18, 22], firme: [20, 24], umbral: [24, 28], ritmo: [28, 34] };
// Equivalencia del split con el % del FTP en un plan de meta: el umbral (+10 s del split meta) cae en el 100 %.
export const PCT_RITMO_META = 127;
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

// Sesiones del plan hacia una meta, en split. Mismo formato que SESIONES: (p, k, ctx, semana) → entrenamiento.
// Las zonas (fondo, firme, umbral y calentamiento) salen del split de 2000 m equivalente a la meta (ley de Paul): así un
// 5 o 10 km no entrena el fondo y el umbral demasiado suaves. Las series de ritmo van al split de la propia meta.
function semanaMeta(split, distancia, ritmoMeta = split) {
  const cal = { nombre: 'Calentamiento', duracion: 480, metrica: 'split', min: split + META_CAL[0], max: split + META_CAL[1] };
  const descanso = (seg) => ({ nombre: 'Descanso', duracion: seg, metrica: '', min: 0, max: 0 });
  const fondoB = (seg) => ({ nombre: 'Fondo', duracion: seg, metrica: 'split', min: split + META_FONDO[0], max: split + META_FONDO[1] });
  const minutos = (min, p, k) => ronda((min[0] + (min[1] - min[0]) * p) * k, 5);
  const fondo = (min) => (p, k) => {
    const m = minutos(min, p, k);
    return { nombre: `Fondo ${m} min a ${mm(split + 25)}`, enfoque: 'distancia', bloques: [cal, fondoB(m * 60), ENF] };
  };
  // Un fondo firme: tramos a +13–17 s dentro del fondo (el «tempo» del remo).
  const firme = (min) => (p, k) => {
    const m = minutos(min, p, k);
    const n = p < 0.5 ? 3 : 2;
    const t = p < 0.5 ? 6 : 10;
    const resto = Math.max(10, m - n * t);
    const tramos = Array.from({ length: n }, (_, i) => [
      { nombre: `Firme ${i + 1}/${n}`, duracion: t * 60, metrica: 'split', min: split + META_FIRME[0], max: split + META_FIRME[1] },
      ...(i < n - 1 ? [fondoB(120)] : []),
    ]).flat();
    return { nombre: `Fondo ${m} min con ${n} × ${t} min firme`, enfoque: 'distancia', bloques: [cal, fondoB(Math.round((resto / 2) * 60)), ...tramos, fondoB(Math.round((resto / 2) * 60)), ENF] };
  };
  const umbral = (p, k) => {
    const [n, min] = paso([[3, 8], [3, 10], [3, 12], [2, 15]], p);
    const r = reps(n, k);
    const bloques = Array.from({ length: r }, (_, i) => [
      { nombre: `Umbral ${i + 1}/${r}`, duracion: min * 60, metrica: 'split', min: split + META_UMBRAL[0], max: split + META_UMBRAL[1] },
      ...(i < r - 1 ? [descanso(180)] : []),
    ]).flat();
    return { nombre: `Umbral a ${mm(split + 10)} ${r} × ${min} min`, enfoque: 'potencia', bloques: [cal, ...bloques, ENF] };
  };
  // Series a ritmo de la meta (6 × 500 m → 5 × 600 m → 4 × 750 m en un 2000 m): el split baja hasta el de la meta.
  const ritmo = (p, k) => {
    const [n, f] = paso([[6, 0.25], [5, 0.3], [4, 0.375]], p);
    const tramo = Math.max(100, Math.min(1000, Math.round((distancia * f) / 50) * 50));
    const r = reps(n, k);
    // En metas largas (10 km) el ritmo de la meta queda por debajo del umbral: las series van como mínimo a +8 s del
    // 2000 m equivalente, para que sigan siendo la sesión que sube el ritmo.
    const sp = Math.min(ritmoMeta, split + 8) + Math.round(3 * (1 - p));
    const bloques = Array.from({ length: r }, (_, i) => [
      { nombre: `${tramo} m ${i + 1}/${r}`, fin: 'distancia', cantidad: tramo, duracion: 0, metrica: 'split', min: sp - 2, max: sp + 1 },
      ...(i < r - 1 ? [descanso(Math.round(tramo / 5) + 30)] : []),
    ]).flat();
    return { nombre: `Ritmo ${mm(sp)} · ${r} × ${tramo} m`, enfoque: 'potencia', bloques: [cal, ...ACTIVACION, ...bloques, ENF] };
  };
  return [(p, k, c, s) => (s % 2 === 0 ? umbral : ritmo)(p, k), fondo([40, 60]), firme([40, 55]), fondo([30, 45]), fondo([30, 40])];
}

// Cada sesión recibe el avance del plan (p: 0 la primera semana, 1 la última), k (volumen del nivel,
// un 30 % menos en semana de descarga), el contexto (kcalHabitual) y el número de semana.
// UX2-21 (ronda 2, etapa 10): un solo patrón de nombre, «Fondo 30 min · suave»; la zona va en el detalle. Los planes
// ya guardados conservan sus nombres (identifican tus sesiones y récords).
const SESIONES = {
  fondo: (min) => (p, k) => { const m = ronda((min[0] + (min[1] - min[0]) * p) * k, 5); return { nombre: `Fondo ${m} min · suave`, enfoque: 'distancia', bloques: [CAL, { nombre: 'Fondo', duracion: m * 60, metrica: 'ftp', min: 56, max: 75 }, ENF] }; },
  // Fondo con techo de pulso (70 % del máximo): con un reloj de muñeca es lo más fiable.
  fondoPulso: (min) => (p, k) => { const m = ronda((min[0] + (min[1] - min[0]) * p) * k, 5); return { nombre: `Fondo ${m} min · pulso suave`, enfoque: 'distancia', bloques: [CAL, { nombre: 'Fondo a pulso controlado', duracion: m * 60, metrica: 'fcpct', min: 60, max: 70 }, ENF] }; },
  fondoTempo: (min) => (p, k) => {
    const m = ronda((min[0] + (min[1] - min[0]) * p) * k, 5); const n = p < 0.5 ? 3 : 2; const t = p < 0.5 ? 5 : 10;
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
    const [n, min, lo, hi] = paso([[3, 8, 95, 100], [3, 10, 95, 100], [3, 12, 95, 100], [2, 15, 95, 100], [2, 20, 95, 100], [1, 30, 93, 97]], p);
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
  arranques: (p, k) => {
    const m = ronda((30 + 15 * p) * k, 5); const n = p < 0.5 ? 4 : 6;
    const fondo = (min) => ({ nombre: 'Fondo', duracion: min * 60, metrica: 'ftp', min: 56, max: 75 });
    const arr = Array.from({ length: n }, (_, i) => [{ nombre: `Arranque ${i + 1}/${n}: 10 paladas a tope`, duracion: 20, metrica: 'ftp', min: 140, max: 250 }, { nombre: 'Suave', duracion: 100, metrica: 'ftp', min: 40, max: 60 }]).flat();
    return { nombre: `Fondo ${m} min + ${n} arranques`, enfoque: 'potencia', bloques: [CAL, fondo(Math.max(5, m - n * 2)), ...arr, ENF] };
  },
  kcalSeries: (p, k) => { const r = reps(8, k); const m = ronda(20 * k, 5); return { nombre: `${r} × 1 min + ${m} min de fondo`, enfoque: 'calorias', bloques: [CAL, ...ACTIVACION, ...series(r, { nombre: '1 min fuerte', duracion: 60, metrica: 'ftp', min: 105, max: 115 }, 60), SUAVE(120), { nombre: 'Fondo', duracion: m * 60, metrica: 'ftp', min: 56, max: 75 }, ENF] }; },
  kcalMeta: (p, k, ctx) => { const v = ronda((ctx.kcalHabitual || 250) * (1.1 + 0.6 * p) * Math.min(1, k + 0.2), 50); return { tipo: 'objetivo', nombre: `Quema ${v} kcal`, enfoque: 'calorias', objetivo: { metrica: 'kcal', valor: v } }; },
};
// Sesiones de cada plan por orden de prioridad: con 3 días se usan las 3 primeras, con 5 todas.
// La 4.ª y la 5.ª son siempre fondos suaves (80/20). Una función de la semana permite alternar sesiones.
const SEMANA_TIPO = {
  base: [SESIONES.fondoPulso([30, 60]), (p, k, c) => (p >= 0.25 ? SESIONES.fondoTempo([35, 60]) : SESIONES.fondoPulso([35, 50]))(p, k, c), SESIONES.fondo([40, 75]), SESIONES.fondoPulso([30, 45]), SESIONES.fondo([30, 40])],
  vo2: [SESIONES.vo2, SESIONES.fondo([30, 45]), (p, k, c) => (p >= 0.34 ? SESIONES.treinta15 : SESIONES.umbralCorto)(p, k, c), SESIONES.fondo([30, 40]), SESIONES.fondoPulso([25, 35])],
  umbral: [SESIONES.umbral, SESIONES.fondo([40, 60]), (p, k, c, s) => (s >= 4 && s % 2 === 0 ? SESIONES.vo2Corto : SESIONES.sweet)(p, k, c), SESIONES.fondo([30, 45]), SESIONES.fondoPulso([30, 40])],
  // Con 3 días, una es un fondo puro: sin base aeróbica la potencia no se sostiene ni se recupera.
  potencia: [SESIONES.sprints, SESIONES.fuerza, SESIONES.fondo([35, 50]), SESIONES.fondoPulso([25, 35]), SESIONES.arranques],
  calorias: [SESIONES.fondo([40, 70]), SESIONES.fondo([30, 45]), SESIONES.kcalSeries, SESIONES.kcalMeta, SESIONES.fondoPulso([30, 50])],
};

const CAL_CORTO = { ...CAL, duracion: 300 };
const ENF_CORTO = { ...ENF, duracion: 180 };

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

// ctx = { kcalHabitual: kcal de una sesión normal, kcalSemana: kcal de una semana normal, sinHistorial,
//         minutosMax: tope de minutos por sesión (de tu perfil) }
// meta = { distancia, segundos }: plan hacia una marca (planPorMeta), con sus sesiones en split.
// ctx.diasSemana: tus días de remo (0 = lunes, etapa 13); si no cuadran con `dias`, los de DIAS_PLAN.
export function planPorObjetivo({ objetivo, nivel = 'medio', dias = 3, semanas = 6, inicio, ctx = {}, meta = null }) {
  const misDias = Array.isArray(ctx?.diasSemana) && ctx.diasSemana.length === dias && new Set(ctx.diasSemana).size === dias
    && ctx.diasSemana.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ? [...ctx.diasSemana].sort((a, b) => a - b) : DIAS_PLAN[dias];
  const split = meta ? Math.round((meta.segundos * 500) / meta.distancia) : null;
  // Referencia de las zonas: el split de 2000 m equivalente a la meta (en un 2000 m, el mismo).
  const ref = meta ? (meta.distancia === 2000 ? split : Math.round((predecir(meta.distancia, meta.segundos, 2000) * 500) / 2000)) : null;
  const obj = meta ? { clave: 'meta', prueba: 'meta' } : objetivoPlan(objetivo) || OBJETIVOS_PLAN[0];
  const pruebaDe = () => (meta
    ? { tipo: 'objetivo', nombre: `Prueba ${meta.distancia} m`, prueba: true, objetivo: { metrica: 'distancia', valor: meta.distancia } }
    : { ...structuredClone(PRUEBAS[obj.prueba]), enfoque: 'pruebas' });
  const vol = NIVELES_PLAN.find((n) => n.clave === nivel)?.volumen ?? 1;
  const cx = { ...ctx, nivelPlan: nivel };
  const tiposBase = SEMANA_TIPO.base.slice(0, dias);
  const tiposObj = (meta ? semanaMeta(ref, meta.distancia, split) : SEMANA_TIPO[obj.clave]).slice(0, dias);
  const base = meta ? 0 : semanasDeBase(obj.clave, nivel, semanas);
  const entrenamientos = [];
  // Cada sesión de un plan de meta guarda el split de la meta: con él se sabe cuáles son duras (umbral y series).
  const agregar = (ent) => {
    if (!entrenamientos.some((x) => x.nombre === ent.nombre)) entrenamientos.push(meta ? { ...ent, splitMeta: ref } : ent);
    return ent.nombre;
  };
  // Con tope de minutos (tu perfil), una sesión que se pasa se rehace con menos volumen hasta que quepa.
  const tope = cx.minutosMax > 0 ? cx.minutosMax * 60 : 0;
  const ajustar = (fn, p, k, s) => {
    let e = fn(p, k, cx, s);
    for (let i = 0, kk = k; tope && i < 6 && duracionPlan(e) > tope; i++) {
      kk = Math.max(0.25, kk * Math.min(0.9, tope / duracionPlan(e)));
      e = fn(p, kk, cx, s);
    }
    // Aún largo: calentamiento de 5 min y enfriamiento de 3 (el nombre no cambia, no los menciona).
    if (tope && duracionPlan(e) > tope) {
      e = { ...e, bloques: e.bloques.map((b) => (b === CAL ? CAL_CORTO : b === ENF ? ENF_CORTO : b)) };
    }
    return e;
  };
  // Arma una sesión sin guardarla todavía (la semana puede rehacerla con menos volumen).
  const construir = (fn, p, k, s) => {
    let e = ajustar(fn, p, k, s);
    // Último recurso: una sesión más corta del mismo tipo (umbral largo → umbral corto, fondo con tempo → fondo).
    // Las pruebas no se recortan: miden siempre lo mismo.
    const otra = meta ? null : /^(Umbral|Sweet spot)/.test(e.nombre) ? SESIONES.umbralCorto : /^Fondo .*tempo/.test(e.nombre) ? SESIONES.fondo([20, 30]) : null;
    if (tope && duracionPlan(e) > tope && otra) e = ajustar(otra, p, k, s);
    // Tope de trabajo por encima del 106 % del FTP en una sesión.
    const conMeta = (x) => (meta ? { ...x, splitMeta: ref } : x);
    for (let i = 0, kk = k; i < 6 && segVo2(conMeta(e)) > VO2_MAX_SESION; i++) { kk *= 0.85; e = ajustar(fn, p, kk, s); }
    return conCadencia(conMeta({ tipo: e.tipo || 'intervalos', ...e }));
  };
  // Una semana con sus sesiones en orden de prioridad, respetando el tope de VO₂ semanal.
  const armarSemana = (fns, p, k, s) => {
    const ks = fns.map(() => k);
    const lista = fns.map((fn, j) => construir(fn, p, ks[j], s));
    for (let i = 0; i < 8; i++) {
      const total = lista.reduce((a, e) => a + segVo2(e), 0);
      if (total <= VO2_MAX_SEMANA) break;
      const j = lista.reduce((m, e, x) => (segVo2(e) > segVo2(lista[m]) ? x : m), 0);
      ks[j] *= 0.85;
      lista[j] = construir(fns[j], p, ks[j], s);
    }
    return lista;
  };
  const trabajoDe = (lista) => lista.reduce((a, e) => a + segTrabajo(e), 0);
  const intensoDe = (lista) => lista.reduce((a, e) => a + segIntenso(e), 0);
  const esfuerzoDe = (lista) => lista.reduce((a, e) => a + esfuerzoSesion(e), 0);
  // Cabe si el trabajo total sube como mucho un 15 %, el intenso un 15 % (o 5 min, para que los pasos chicos avancen)
  // y el esfuerzo planificado un 15 % (un 5 % al volver de una descarga): el trabajo intenso pesa más que los minutos.
  let subida = SUBIDA_MAX;
  const cabe = (lista) => trabajoDe(lista) <= previo.total * SUBIDA_MAX
    && intensoDe(lista) <= Math.max(previo.intenso * SUBIDA_MAX, previo.intenso + 300)
    && esfuerzoDe(lista) <= previo.esfuerzo * subida + 0.5;
  const esDescarga = (s) => (s + 1) % 4 === 0 && s < semanas - 1;
  // El avance de cada semana normal (sin descarga) dentro de su fase: 0 en la primera, 1 en la última.
  const avance = Array.from({ length: semanas }, (_, s) => {
    if (esDescarga(s)) return 0;
    const fase = Array.from({ length: semanas }, (_, x) => x).filter((x) => !esDescarga(x) && (x < base) === (s < base));
    return fase.length > 1 ? fase.indexOf(s) / (fase.length - 1) : 0;
  });
  let domingoDuro = false;
  let previo = null; // trabajo total e intenso de la última semana normal (sin descarga), en segundos
  let pPrevio = 0;
  let intensoUlt = 0;
  const semanasPlan = Array.from({ length: semanas }, (_, s) => {
    // Descarga una de cada 4 semanas: la carga de la primera semana y un 30 % menos de volumen.
    const descarga = esDescarga(s);
    const enBase = s < base;
    const fns = enBase ? tiposBase : tiposObj;
    // El avance va de 0 a 1 dentro de cada fase (la base y el plan); al pasar del uno al otro empieza de nuevo.
    if (s === base && base) pPrevio = 0;
    const meta = avance[s];
    const k = vol * (descarga ? 0.7 : 1);
    let p = meta;
    const conPrueba = obj.prueba && (s === semanas - 1 || (semanas >= 6 && s === Math.floor(semanas / 2) - 1));
    // La prueba ocupa el lugar de la última sesión dura (así la semana no suma más intensidad: con 1 o 2 días
    // no quedan dos duras); en un plan sin sesiones duras, el de la última. Va al final de la semana.
    const conLaPrueba = (lista) => {
      if (!conPrueba) return lista;
      const duras = lista.map((e, i) => (esDura(e) ? i : -1)).filter((i) => i >= 0);
      const quitar = duras.length ? duras.at(-1) : lista.length - 1;
      return [...lista.filter((_, i) => i !== quitar), pruebaDe()];
    };
    // Afinamiento (0.81): la semana de una prueba el resto de sesiones lleva menos volumen, sin quitar su intensidad,
    // para llegar fresco a medir: un 45 % menos antes de la prueba final y un 20 % antes de la de mitad (más no deja
    // subir la carga después sin un salto). Si la semana ya es de descarga, la prueba de mitad no recorta más.
    const af = s === semanas - 1 ? AFINAMIENTO : AFINAMIENTO_MITAD;
    const kPrueba = (kk) => (descarga ? kk * Math.min(1, af / 0.7) : kk * af);
    const armar = (q, kk) => conLaPrueba(armarSemana(fns, q, conPrueba ? kPrueba(kk) : kk, s));
    let semana = armar(p, k);
    subida = s > 0 && esDescarga(s - 1) ? VUELTA_DESCARGA : SUBIDA_MAX;
    // La carga sube poco a poco: si la semana (con su prueba, si la tiene) se pasa del tope sobre la última normal,
    // se avanza menos.
    if (previo != null && !cabe(semana)) {
      let mejor = null;
      // Primero el mayor avance que quepa, con el volumen del nivel o hasta un 20 % menos (los pasos son discretos:
      // sin recortar un poco el volumen la semana se quedaría igual varias semanas seguidas).
      for (let i = 1; !descarga && !mejor && meta > pPrevio && i <= 12; i++) {
        const q = pPrevio + ((meta - pPrevio) * (12 - i)) / 12;
        for (const f of [1, 0.9, 0.8]) {
          const otra = armar(q, k * f);
          if (cabe(otra)) { mejor = { q, otra }; break; }
        }
      }
      if (mejor) { p = mejor.q; semana = mejor.otra; } else if (!descarga) { p = Math.min(p, pPrevio); semana = armar(p, k); }
      // Aun sin avanzar puede pasarse (una sesión que alterna con otra más larga, el paso de la base al plan o una
      // prueba): se recorta el volumen del resto de la semana.
      for (let i = 0, kk = k; i < 6 && !cabe(semana); i++) { kk *= 0.9; semana = armar(p, kk); }
    }
    // La última semana normal es la referencia de la siguiente; las de descarga y las de prueba no lo son
    // (así la vuelta de una descarga o de una prueba no sube dos escalones de golpe).
    // El intenso se compara con la más alta de las dos últimas semanas normales: algunos planes alternan
    // una sesión cada semana (sweet spot y VO₂) y no por eso la carga debe bajar a la mitad.
    if (!descarga && !conPrueba) { previo = { total: trabajoDe(semana), intenso: Math.max(intensoDe(semana), intensoUlt), esfuerzo: esfuerzoDe(semana) }; intensoUlt = intensoDe(semana); pPrevio = p; }
    const lista = semana.map(agregar);
    const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
    const orden = ordenarSemana(lista, misDias, buscar, domingoDuro);
    domingoDuro = misDias.at(-1) === 6 && esDura(buscar(orden.at(-1)));
    return orden;
  });
  if (meta) {
    const programa = desdePlantilla({ nombre: `Meta: ${meta.distancia} m en ${mm(meta.segundos)}`, semanas: semanasPlan, diasSemana: misDias }, inicio);
    Object.assign(programa, { conDescarga: true, meta: { distancia: meta.distancia, segundos: meta.segundos }, porSemana: dias, nivel });
    return { programa, entrenamientos, split };
  }
  const programa = desdePlantilla({ nombre: `Plan de ${obj.tema} · ${semanas} semanas`, semanas: semanasPlan, diasSemana: misDias }, inicio);
  // Lo elegido queda en el plan: sirve para armar el siguiente y para ajustarlo cuando haya historial.
  Object.assign(programa, { objetivo: obj.clave, nivel, porSemana: dias, semanas, sinHistorial: !!ctx?.sinHistorial, ...(tope ? { minutosMax: ctx.minutosMax } : {}), ...(base ? { semanasBase: base } : {}) });
  // Plan de calorías: meta semanal que arranca en tu promedio y sube un 10 % por semana (un 20 % menos en la descarga).
  if (obj.clave === 'calorias') {
    const kb = Math.max(300, ctx.kcalSemana || (ctx.kcalHabitual || 250) * dias);
    programa.metaKcal = Array.from({ length: semanas }, (_, s) => ronda(kb * 1.1 ** s * ((s + 1) % 4 === 0 && s < semanas - 1 ? 0.8 : 1), 50));
  }
  return { programa, entrenamientos };
}
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
  const n = Math.floor((aFecha(claveDia(ahora)).getTime() - lunes) / (7 * DIA)) + 1;
  const ultimo = aFecha(programa.dias.at(-1).fecha).getTime();
  const total = programa.semanas || Math.floor((ultimo - lunes) / (7 * DIA)) + 1;
  return { n, total, descarga: !!(programa.objetivo || programa.conDescarga) && n % 4 === 0 && n < total };
}

// Meta de calorías de la semana de una fecha (o null si el plan no tiene).
export function metaKcalDe(programa, ahora = Date.now()) {
  if (!programa?.metaKcal) return null;
  const s = Math.floor((ahora - aFecha(programa.inicio).getTime()) / (7 * DIA));
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
  const actual = Math.floor((hoy - lunes0) / (7 * DIA));
  const semanas = [];
  for (const d of estadoDias(programa, sesiones, ahora)) {
    const i = Math.floor((aFecha(d.fecha).getTime() - lunes0) / (7 * DIA));
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
