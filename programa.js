// Programas de varias semanas: una lista de días con el entrenamiento que toca.
// programa = { nombre, inicio: 'AAAA-MM-DD', dias: [{ fecha: 'AAAA-MM-DD', ent: nombre del entrenamiento }] }
import { claveDia } from './estadisticas.js';
import { formatoMmss as mm, PRUEBAS } from './entrenamientos.js';
import { tipoPlan } from './capacidades.js';

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

// Cada sesión recibe el avance del plan (p: 0 la primera semana, 1 la última), k (volumen del nivel,
// un 30 % menos en semana de descarga), el contexto (kcalHabitual) y el número de semana.
const SESIONES = {
  fondo: (min) => (p, k) => { const m = ronda((min[0] + (min[1] - min[0]) * p) * k, 5); return { nombre: `Fondo ${m} min (zona 2)`, enfoque: 'distancia', bloques: [CAL, { nombre: 'Fondo', duracion: m * 60, metrica: 'ftp', min: 56, max: 75 }, ENF] }; },
  // Fondo con techo de pulso (70 % del máximo): con un reloj de muñeca es lo más fiable.
  fondoPulso: (min) => (p, k) => { const m = ronda((min[0] + (min[1] - min[0]) * p) * k, 5); return { nombre: `Fondo ${m} min a pulso suave`, enfoque: 'distancia', bloques: [CAL, { nombre: 'Fondo a pulso controlado', duracion: m * 60, metrica: 'fcpct', min: 60, max: 70 }, ENF] }; },
  fondoTempo: (min) => (p, k) => {
    const m = ronda((min[0] + (min[1] - min[0]) * p) * k, 5); const n = p < 0.5 ? 3 : 2; const t = p < 0.5 ? 5 : 10;
    const resto = Math.max(5, m - n * t);
    return { nombre: `Fondo ${m} min con ${n} × ${t} min de tempo`, enfoque: 'distancia', bloques: [CAL, { nombre: 'Fondo', duracion: Math.round((resto / 2) * 60), metrica: 'ftp', min: 56, max: 75 }, ...series(n, { nombre: 'Tempo', duracion: t * 60, metrica: 'ftp', min: 76, max: 90 }, 180), { nombre: 'Fondo', duracion: Math.round((resto / 2) * 60), metrica: 'ftp', min: 56, max: 75 }, ENF] };
  },
  vo2: (p, k) => {
    const [n, dur, min, max] = paso([[5, 2, 110, 115], [6, 2, 110, 115], [5, 3, 108, 112], [4, 4, 106, 110]], p);
    const r = reps(n, k);
    return { nombre: `VO₂ ${r} × ${dur} min`, enfoque: 'potencia', bloques: [CAL, ...series(r, { nombre: 'Fuerte', duracion: dur * 60, metrica: 'ftp', min, max }, Math.min(180, dur * 60)), ENF] };
  },
  // Series de 30 s fuertes y 15 s suaves: mucho tiempo cerca del VO₂máx con poco desgaste.
  treinta15: (p, k) => {
    const n = reps(p < 0.5 ? 10 : 12, k);
    const serie = Array.from({ length: n }, (_, i) => [{ nombre: `30 s fuerte ${i + 1}/${n}`, duracion: 30, metrica: 'ftp', min: 115, max: 130 }, { nombre: 'Descanso', duracion: 15, metrica: 'ftp', min: 40, max: 55 }]).flat();
    return { nombre: `3 series de ${n} × 30/15`, enfoque: 'potencia', bloques: [CAL, ...serie, SUAVE(180), ...serie, SUAVE(180), ...serie, ENF] };
  },
  umbral: (p, k) => {
    const [n, min, lo, hi] = paso([[3, 8, 95, 100], [3, 10, 95, 100], [3, 12, 95, 100], [2, 15, 95, 100], [2, 20, 95, 100], [1, 30, 93, 97]], p);
    const r = n === 1 ? 1 : reps(n, k);
    return { nombre: `Umbral ${r} × ${min} min`, enfoque: 'potencia', bloques: [CAL, ...(r === 1 ? [{ nombre: 'Umbral', duracion: min * 60, metrica: 'ftp', min: lo, max: hi }] : series(r, { nombre: 'Umbral', duracion: min * 60, metrica: 'ftp', min: lo, max: hi }, 180)), ENF] };
  },
  umbralCorto: (p, k) => { const m = p < 0.5 || k < 0.4 ? 8 : 10; const r = reps(3, k); return { nombre: `Umbral ${r} × ${m} min`, enfoque: 'potencia', bloques: [CAL, ...series(r, { nombre: 'Umbral', duracion: m * 60, metrica: 'ftp', min: 91, max: 100 }, 180), ENF] }; },
  // Sweet spot (88–94 % del FTP): casi tanto estímulo como el umbral con menos fatiga.
  sweet: (p, k) => { const [n, m] = paso([[2, 12], [2, 15], [3, 12], [3, 15]], p); const r = reps(n, k); return { nombre: `Sweet spot ${r} × ${m} min`, enfoque: 'potencia', bloques: [CAL, ...series(r, { nombre: 'Sweet spot', duracion: m * 60, metrica: 'ftp', min: 88, max: 94 }, 240), ENF] }; },
  vo2Corto: (p, k) => { const r = reps(5, k); return { nombre: `VO₂ ${r} × 3 min`, enfoque: 'potencia', bloques: [CAL, ...series(r, { nombre: 'Fuerte', duracion: 180, metrica: 'ftp', min: 108, max: 112 }, 180), ENF] }; },
  sprints: (p, k) => {
    const [n, seg, minutos] = paso([[6, 15, 0], [8, 15, 0], [6, 20, 4], [8, 20, 5]], p);
    const r = reps(n, k);
    const extra = minutos ? [SUAVE(180), ...series(reps(minutos, k), { nombre: '1 min fuerte', duracion: 60, metrica: 'ftp', min: 120, max: 130 }, 120)] : [];
    return { nombre: `Sprints ${r} × ${seg} s${minutos ? ` + ${reps(minutos, k)} × 1 min` : ''}`, enfoque: 'potencia', bloques: [CAL, ...series(r, { nombre: 'Sprint a tope', duracion: seg, metrica: 'ftp', min: 140, max: 250, nivel: 18 }, 120), ...extra, ENF] };
  },
  // Fuerza-resistencia: cerca del umbral pero a cadencia baja, para que cada palada pese.
  fuerza: (p, k) => { const [n, m] = paso([[4, 3], [5, 3], [4, 4], [5, 4]], p); const r = reps(n, k); return { nombre: `Fuerza ${r} × ${m} min a 18 paladas/min`, enfoque: 'potencia', bloques: [CAL, ...series(r, { nombre: 'Fuerza a 18-20 paladas/min', duracion: m * 60, metrica: 'ftp', min: 88, max: 95, nivel: 16 }, 120), ENF] }; },
  arranques: (p, k) => {
    const m = ronda((30 + 15 * p) * k, 5); const n = p < 0.5 ? 4 : 6;
    const fondo = (min) => ({ nombre: 'Fondo', duracion: min * 60, metrica: 'ftp', min: 56, max: 75 });
    const arr = Array.from({ length: n }, (_, i) => [{ nombre: `Arranque ${i + 1}/${n}: 10 paladas a tope`, duracion: 20, metrica: 'ftp', min: 140, max: 250 }, { nombre: 'Suave', duracion: 100, metrica: 'ftp', min: 40, max: 60 }]).flat();
    return { nombre: `Fondo ${m} min + ${n} arranques`, enfoque: 'potencia', bloques: [CAL, fondo(Math.max(5, m - n * 2)), ...arr, ENF] };
  },
  kcalSeries: (p, k) => { const r = reps(8, k); const m = ronda(20 * k, 5); return { nombre: `${r} × 1 min + ${m} min de fondo`, enfoque: 'calorias', bloques: [CAL, ...series(r, { nombre: '1 min fuerte', duracion: 60, metrica: 'ftp', min: 105, max: 115 }, 60), SUAVE(120), { nombre: 'Fondo', duracion: m * 60, metrica: 'ftp', min: 56, max: 75 }, ENF] }; },
  kcalMeta: (p, k, ctx) => { const v = ronda((ctx.kcalHabitual || 250) * (1.1 + 0.6 * p) * Math.min(1, k + 0.2), 50); return { tipo: 'objetivo', nombre: `Quema ${v} kcal`, enfoque: 'calorias', objetivo: { metrica: 'kcal', valor: v } }; },
};
// Sesiones de cada plan por orden de prioridad: con 3 días se usan las 3 primeras, con 5 todas.
// La 4.ª y la 5.ª son siempre fondos suaves (80/20). Una función de la semana permite alternar sesiones.
const SEMANA_TIPO = {
  base: [SESIONES.fondoPulso([30, 60]), (p, k, c) => (p >= 0.25 ? SESIONES.fondoTempo([35, 60]) : SESIONES.fondoPulso([35, 50]))(p, k, c), SESIONES.fondo([40, 75]), SESIONES.fondoPulso([30, 45]), SESIONES.fondo([30, 40])],
  vo2: [SESIONES.vo2, SESIONES.fondo([30, 45]), (p, k, c) => (p >= 0.34 ? SESIONES.treinta15 : SESIONES.umbralCorto)(p, k, c), SESIONES.fondo([30, 40]), SESIONES.fondoPulso([25, 35])],
  umbral: [SESIONES.umbral, SESIONES.fondo([40, 60]), (p, k, c, s) => (s >= 4 && s % 2 === 0 ? SESIONES.vo2Corto : SESIONES.sweet)(p, k, c), SESIONES.fondo([30, 45]), SESIONES.fondoPulso([30, 40])],
  potencia: [SESIONES.sprints, SESIONES.fuerza, SESIONES.arranques, SESIONES.fondo([30, 45]), SESIONES.fondoPulso([25, 35])],
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
export const duracionPlan = (e) => (e.bloques || []).reduce((a, b) => a + (b.duracion || 0), 0);

// ctx = { kcalHabitual: kcal de una sesión normal, kcalSemana: kcal de una semana normal, sinHistorial,
//         minutosMax: tope de minutos por sesión (de tu perfil) }
export function planPorObjetivo({ objetivo, nivel = 'medio', dias = 3, semanas = 6, inicio, ctx = {} }) {
  const obj = objetivoPlan(objetivo) || OBJETIVOS_PLAN[0];
  const vol = NIVELES_PLAN.find((n) => n.clave === nivel)?.volumen ?? 1;
  const tipos = SEMANA_TIPO[obj.clave].slice(0, dias);
  const entrenamientos = [];
  const agregar = (ent) => {
    if (!entrenamientos.some((x) => x.nombre === ent.nombre)) entrenamientos.push(ent);
    return ent.nombre;
  };
  // Con tope de minutos (tu perfil), una sesión que se pasa se rehace con menos volumen hasta que quepa.
  const tope = ctx.minutosMax > 0 ? ctx.minutosMax * 60 : 0;
  const ajustar = (fn, p, k, s) => {
    let e = fn(p, k, ctx, s);
    for (let i = 0, kk = k; tope && i < 6 && duracionPlan(e) > tope; i++) {
      kk = Math.max(0.25, kk * Math.min(0.9, tope / duracionPlan(e)));
      e = fn(p, kk, ctx, s);
    }
    // Aún largo: calentamiento de 5 min y enfriamiento de 3 (el nombre no cambia, no los menciona).
    if (tope && duracionPlan(e) > tope) {
      e = { ...e, bloques: e.bloques.map((b) => (b === CAL ? CAL_CORTO : b === ENF ? ENF_CORTO : b)) };
    }
    return e;
  };
  const crear = (fn, p, k, s) => {
    let e = ajustar(fn, p, k, s);
    // Último recurso: una sesión más corta del mismo tipo (umbral largo → umbral corto, fondo con tempo → fondo).
    // Las pruebas no se recortan: miden siempre lo mismo.
    const otra = /^(Umbral|Sweet spot)/.test(e.nombre) ? SESIONES.umbralCorto : /^Fondo .*tempo/.test(e.nombre) ? SESIONES.fondo([20, 30]) : null;
    if (tope && duracionPlan(e) > tope && otra) e = ajustar(otra, p, k, s);
    return agregar({ tipo: e.tipo || 'intervalos', ...e });
  };
  const prueba = (nombre) => agregar({ ...structuredClone(PRUEBAS[nombre]), enfoque: 'pruebas' });
  let domingoDuro = false;
  const semanasPlan = Array.from({ length: semanas }, (_, s) => {
    // Descarga una de cada 4 semanas: la carga de la primera semana y un 30 % menos de volumen.
    const descarga = (s + 1) % 4 === 0 && s < semanas - 1;
    const p = descarga ? 0 : s / Math.max(1, semanas - 1);
    const k = vol * (descarga ? 0.7 : 1);
    const lista = tipos.map((fn) => crear(fn, p, k, s));
    const conPrueba = obj.prueba && (s === semanas - 1 || (semanas >= 6 && s === Math.floor(semanas / 2) - 1));
    // La prueba ocupa el lugar de la segunda sesión dura (así la semana no suma más intensidad);
    // en un plan sin sesiones duras, el de la última. Va al final de la semana, ya con la carga más baja.
    if (conPrueba) {
      const duras = lista.map((n, i) => (i > 0 && esDura(entrenamientos.find((e) => e.nombre === n)) ? i : -1)).filter((i) => i >= 0);
      lista.splice(duras.length ? duras.at(-1) : lista.length - 1, 1);
      lista.push(prueba(obj.prueba));
    }
    const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
    const orden = ordenarSemana(lista, DIAS_PLAN[dias], buscar, domingoDuro);
    domingoDuro = DIAS_PLAN[dias].at(-1) === 6 && esDura(buscar(orden.at(-1)));
    return orden;
  });
  const programa = desdePlantilla({ nombre: `Plan de ${obj.tema} · ${semanas} semanas`, semanas: semanasPlan, diasSemana: DIAS_PLAN[dias] }, inicio);
  // Lo elegido queda en el plan: sirve para armar el siguiente y para ajustarlo cuando haya historial.
  Object.assign(programa, { objetivo: obj.clave, nivel, porSemana: dias, semanas, sinHistorial: !!ctx?.sinHistorial, ...(tope ? { minutosMax: ctx.minutosMax } : {}) });
  // Plan de calorías: meta semanal que arranca en tu promedio y sube un 10 % por semana (un 20 % menos en la descarga).
  if (obj.clave === 'calorias') {
    const base = Math.max(300, ctx.kcalSemana || (ctx.kcalHabitual || 250) * dias);
    programa.metaKcal = Array.from({ length: semanas }, (_, s) => ronda(base * 1.1 ** s * ((s + 1) % 4 === 0 && s < semanas - 1 ? 0.8 : 1), 50));
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
  return { n, total, descarga: !!programa.objetivo && n % 4 === 0 && n < total };
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
      if (b.metrica === 'ftp') i = Math.min(1.5, (b.min + Math.min(b.max, b.min + 30)) / 200); // los sprints «a tope» no se disparan
      else if (b.metrica === 'fcpct') i = ((b.min + b.max) / 200) * 0.95;
      else if (b.prueba) i = b.duracion <= 120 ? 1.3 : b.duracion <= 600 ? 1.1 : 1;
      else i = 0.5;
    }
    return a + ((b.duracion || 0) / 3600) * i * i * 100;
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
    s.descarga = !!programa.objetivo && s.n % 4 === 0 && s.n < total;
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
