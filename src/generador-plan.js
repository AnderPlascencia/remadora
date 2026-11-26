// Generador de planes (por objetivo y hacia una meta). Va aparte de programa.js para no pesar en la primera carga:
// solo se usa al armar o rehacer un plan.
import { formatoMmss as mm, PRUEBAS, ACTIVACION } from './entrenamientos.js';
import {
  desdePlantilla, META_PCT, zonaSplit, centroZona, ref2kDe, OBJETIVOS_PLAN, objetivoPlan, NIVELES_PLAN, DIAS_PLAN,
  CAL, ENF, CAL_CORTO, ENF_CORTO, ronda, series, paso, reps, conCadencia, SESIONES, esDura, ordenarSemana, duracionPlan,
  VO2_MAX_SESION, VO2_MAX_SEMANA, SUBIDA_MAX, VUELTA_DESCARGA, AFINAMIENTO, AFINAMIENTO_MITAD, semanasDeBase,
  segVo2, segIntenso, segTrabajo, esfuerzoSesion,
} from './programa.js';

export function planPorMeta({ distancia, segundos, semanas, inicio, dias = 3, nivel = 'medio', ctx = {} }) {
  return planPorObjetivo({ objetivo: 'meta', nivel, dias, semanas, inicio, ctx, meta: { distancia, segundos } });
}

// Sesiones del plan hacia una meta, en split. Mismo formato que SESIONES: (p, k, ctx, semana) → entrenamiento.
// Las zonas (fondo, firme, umbral y calentamiento) salen del split de 2000 m equivalente a la meta (ley de Paul): así un
// 5 o 10 km no entrena el fondo y el umbral demasiado suaves. Las series de ritmo van al split de la propia meta.
function semanaMeta(split, distancia, ritmoMeta = split) {
  const cal = { nombre: 'Calentamiento', duracion: 480, metrica: 'split', ...zonaSplit(split, META_PCT.cal) };
  const descanso = (seg) => ({ nombre: 'Descanso', duracion: seg, metrica: '', min: 0, max: 0 });
  const fondoB = (seg) => ({ nombre: 'Fondo', duracion: seg, metrica: 'split', ...zonaSplit(split, META_PCT.fondo) });
  const minutos = (min, p, k) => ronda((min[0] + (min[1] - min[0]) * p) * k, 5);
  const fondo = (min) => (p, k) => {
    const m = minutos(min, p, k);
    return { nombre: `Fondo ${m} min a ${mm(centroZona(split, META_PCT.fondo))}`, enfoque: 'distancia', bloques: [cal, fondoB(m * 60), ENF] };
  };
  // Un fondo firme: tramos al 82–88 % dentro del fondo (el «tempo» del remo).
  const firme = (min) => (p, k) => {
    const m = minutos(min, p, k);
    const n = p < 0.5 ? 3 : 2;
    const t = p < 0.5 ? 6 : 10;
    const resto = Math.max(10, m - n * t);
    const tramos = Array.from({ length: n }, (_, i) => [
      { nombre: `Firme ${i + 1}/${n}`, duracion: t * 60, metrica: 'split', ...zonaSplit(split, META_PCT.firme) },
      ...(i < n - 1 ? [fondoB(120)] : []),
    ]).flat();
    return { nombre: `Fondo ${m} min con ${n} × ${t} min firme`, enfoque: 'distancia', bloques: [cal, fondoB(Math.round((resto / 2) * 60)), ...tramos, fondoB(Math.round((resto / 2) * 60)), ENF] };
  };
  const umbral = (p, k) => {
    const [n, min] = paso([[3, 8], [3, 10], [3, 12], [2, 15]], p);
    const r = reps(n, k);
    const bloques = Array.from({ length: r }, (_, i) => [
      { nombre: `Umbral ${i + 1}/${r}`, duracion: min * 60, metrica: 'split', ...zonaSplit(split, META_PCT.umbral) },
      ...(i < r - 1 ? [descanso(180)] : []),
    ]).flat();
    return { nombre: `Umbral a ${mm(centroZona(split, META_PCT.umbral))} ${r} × ${min} min`, enfoque: 'potencia', bloques: [cal, ...bloques, ENF] };
  };
  // Series a ritmo de la meta (6 × 500 m → 5 × 600 m → 4 × 750 m en un 2000 m): el split baja hasta el de la meta.
  const ritmo = (p, k) => {
    const [n, f] = paso([[6, 0.25], [5, 0.3], [4, 0.375]], p);
    const tramo = Math.max(100, Math.min(1000, Math.round((distancia * f) / 50) * 50));
    const r = reps(n, k);
    // En metas largas, las series van como mínimo al borde rápido del umbral.
    const sp = Math.min(ritmoMeta, zonaSplit(split, META_PCT.umbral).min) + Math.round(3 * (1 - p));
    const bloques = Array.from({ length: r }, (_, i) => [
      { nombre: `${tramo} m ${i + 1}/${r}`, fin: 'distancia', cantidad: tramo, duracion: 0, metrica: 'split', min: sp - 2, max: sp + 1 },
      ...(i < r - 1 ? [descanso(Math.round(tramo / 5) + 30)] : []),
    ]).flat();
    return { nombre: `Ritmo ${mm(sp)} · ${r} × ${tramo} m`, enfoque: 'potencia', bloques: [cal, ...ACTIVACION, ...bloques, ENF] };
  };
  return [(p, k, c, s) => (s % 2 === 0 ? umbral : ritmo)(p, k), fondo([40, 60]), firme([40, 55]), fondo([30, 45]), fondo([30, 40])];
}

// E8: la prueba de meta con 10 min de calentamiento, arranques y los primeros 500 m a 1–2 s del split meta.
export function pruebaMeta(distancia, split, ref) {
  const salida = Math.min(500, Math.round(distancia / 4));
  return {
    tipo: 'intervalos', nombre: `Prueba ${distancia} m`, prueba: true, enfoque: 'pruebas', distanciaPrueba: distancia,
    bloques: [
      { nombre: 'Calentamiento', duracion: 300, metrica: 'split', ...zonaSplit(ref, META_PCT.cal) },
      { nombre: 'Calentamiento progresivo', duracion: 300, metrica: 'split', ...zonaSplit(ref, META_PCT.fondo) },
      ...ACTIVACION,
      { nombre: 'Calentamiento: 3 min suaves', duracion: 180, metrica: '', min: 0, max: 0 },
      { nombre: `Prueba: primeros ${salida} m sin pasarte`, fin: 'distancia', cantidad: salida, duracion: 0, metrica: 'split', min: split + 1, max: split + 2 },
      { nombre: `Prueba: ${distancia - salida} m a tu ritmo`, fin: 'distancia', cantidad: distancia - salida, duracion: 0, metrica: 'split', min: split - 2, max: split + 1 },
      ENF,
    ],
  };
}

// Sesiones de cada plan por orden de prioridad: con 3 días se usan las 3 primeras, con 5 todas.
// E-3 (E11): con 3 días, 1 dura + 1 moderada (sweet spot o tempo) + 1 fondo; la 4.ª y la 5.ª son fondos suaves.
// En VO₂, el 30/15 sustituye a las series cada dos semanas solo con «Remo seguido», nunca además.
// Con 2 días (E10): 1 dura + 1 fondo (ver planPorObjetivo).
const SEMANA_TIPO = {
  base: [SESIONES.fondoPulso([30, 60]), (p, k, c) => (p >= 0.25 ? SESIONES.fondoTempo([35, 60]) : SESIONES.fondoPulso([35, 50]))(p, k, c), SESIONES.fondo([40, 75]), SESIONES.fondoPulso([30, 45]), SESIONES.fondo([30, 40])],
  vo2: [(p, k, c, s) => (c?.nivelPlan === 'alto' && p >= 0.34 && s % 2 === 1 ? SESIONES.treinta15 : SESIONES.vo2)(p, k, c), SESIONES.fondo([30, 45]), SESIONES.fondoTempo([35, 50]), SESIONES.fondo([30, 40]), SESIONES.fondoPulso([25, 35])],
  umbral: [SESIONES.umbral, SESIONES.fondo([40, 60]), SESIONES.sweet, SESIONES.fondo([30, 45]), SESIONES.fondoPulso([30, 40])],
  // Con 3 días, una es un fondo puro: sin base aeróbica la potencia no se sostiene ni se recupera.
  potencia: [SESIONES.sprints, SESIONES.fuerza, SESIONES.fondo([35, 50]), SESIONES.fondoPulso([25, 35]), SESIONES.arranques],
  calorias: [SESIONES.fondo([40, 70]), SESIONES.fondo([30, 45]), SESIONES.kcalSeries, SESIONES.kcalMeta, SESIONES.fondoPulso([30, 50])],
};
// Con 2 días: la dura y un fondo (en potencia, el fondo lleva la fuerza dentro).
const DOS_DIAS = { potencia: [SESIONES.sprints, SESIONES.fondoFuerza([35, 50])] };

// ctx = { kcalHabitual: kcal de una sesión normal, kcalSemana: kcal de una semana normal, sinHistorial,
//         minutosMax: tope de minutos por sesión (de tu perfil) }
// meta = { distancia, segundos }: plan hacia una marca (planPorMeta), con sus sesiones en split.
// ctx.diasSemana: tus días de remo (0 = lunes, etapa 13); si no cuadran con `dias`, los de DIAS_PLAN.
export function planPorObjetivo({ objetivo, nivel = 'medio', dias = 3, semanas = 6, inicio, ctx = {}, meta = null }) {
  const misDias = Array.isArray(ctx?.diasSemana) && ctx.diasSemana.length === dias && new Set(ctx.diasSemana).size === dias
    && ctx.diasSemana.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ? [...ctx.diasSemana].sort((a, b) => a - b) : DIAS_PLAN[dias];
  const split = meta ? Math.round((meta.segundos * 500) / meta.distancia) : null;
  // Referencia de las zonas: el split de 2000 m equivalente a la meta (en un 2000 m, el mismo).
  const ref = meta ? ref2kDe(meta.distancia, meta.segundos, ctx?.pc || null) : null;
  const obj = meta ? { clave: 'meta', prueba: 'meta' } : objetivoPlan(objetivo) || OBJETIVOS_PLAN[0];
  const pruebaDe = () => (meta ? pruebaMeta(meta.distancia, split, ref) : { ...structuredClone(PRUEBAS[obj.prueba]), enfoque: 'pruebas' });
  const vol = NIVELES_PLAN.find((n) => n.clave === nivel)?.volumen ?? 1;
  const cx = { ...ctx, nivelPlan: nivel };
  const tiposBase = SEMANA_TIPO.base.slice(0, dias);
  const tiposObj = (meta ? semanaMeta(ref, meta.distancia, split) : (dias === 2 && DOS_DIAS[obj.clave]) || SEMANA_TIPO[obj.clave]).slice(0, dias);
  const esDescarga = (s) => (s + 1) % 4 === 0 && s < semanas - 1;
  // E-3 (E12): la prueba de mitad va en la semana de descarga más cercana a la mitad (así no hay dos semanas flojas
  // seguidas); sin descarga (planes de menos de 5 semanas), no hay prueba de mitad.
  const descargas = Array.from({ length: semanas }, (_, x) => x).filter(esDescarga);
  const mitad = semanas >= 5 && descargas.length ? descargas.reduce((m, x) => (Math.abs(x - (semanas / 2 - 1)) < Math.abs(m - (semanas / 2 - 1)) ? x : m)) : -1;
  // E9: la primera semana con intensidad no es de descarga ni de prueba (la prueba va tras una semana normal con
  // intensidad).
  let base = meta ? 0 : semanasDeBase(obj.clave, nivel, semanas);
  while (base > 0 && (esDescarga(base) || base === mitad)) base--;
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
    const conPrueba = obj.prueba && (s === semanas - 1 || s === mitad);
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
    // E-1 (E4) y E-3: sin historial, la primera semana sin sesiones duras lleva un tramo de 12 min a tu ritmo fuerte en
    // un fondo: calibra el FTP del perfil sin llamarlo prueba (un fondo suave no lo cambia).
    if (s === 0 && !meta && ctx?.sinHistorial && !semana.some((e) => e.prueba || esDura(e))) {
      const j = semana.findLastIndex((e) => /^Fondo/.test(e.nombre));
      if (j >= 0) semana = semana.map((e, i) => (i === j ? construir(SESIONES.calibracion, p, k, s) : e));
    }
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
