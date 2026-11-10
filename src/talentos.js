// Talentos por clase: una cualidad por clase, 4 mejoras de nivel y una maestría, todas de 3 grados.
// Solo cuentan cosas fáciles de entender (paladas, metros, minutos, fantasmas, sesiones y racha) y dan números fijos.
// Nunca cambian tus métricas: dan XP o ventaja frente a los fantasmas en la carrera.

export const SLOTS = ['m1', 'm2', 'm3', 'm4', 'maestria'];
export const GRADOS_MAX = 3;
const COSTE_SLOT = { m1: 1, m2: 1, m3: 1, m4: 1, maestria: 2 }; // puntos por grado
const NIVEL_SLOT = { m1: 1, m2: 1, m3: 20, m4: 20, maestria: 40 };
const RANGO_NIVEL = { 20: 'Combatiente', 40: 'Veterano' };
// Un punto cada 3 niveles: 30 al nivel 90. Todo el árbol cuesta 18 (más o menos el nivel 54).
export const puntosDeNivel = (nivel) => Math.floor(nivel / 3);
// Ventaja máxima que dan los talentos en una carrera, en metros.
export const TOPE_TALENTOS_M = 40;
// XP máxima por sesión gracias a los talentos (el Triunfo romano, que es semanal, va aparte).
export const TOPE_TALENTOS_XP = 150;

// Por clase: cualidad, bote y sus 5 talentos. tipo: 'xp' o 'carrera'. g: lo que da cada grado.
// Etapa 12: las clases quedan igualadas en unos 100 XP nominales (50 reales) por sesión con el árbol completo y el
// perfil típico de cada clase (ver pruebas/etapa12.test.mjs). g0 y texto0: lo de antes, para las sesiones anteriores.
export const CLASES_TALENTO = {
  // Etapa 3 del rediseño (decisión de Ander): el vikingo premia la palada larga y potente (metros por palada frente a tu
  // media habitual), que es lo que mide Fuerza, en vez de contar paladas. gP y textoP: lo de antes, para las sesiones
  // anteriores a VIKINGO_PALADA_DESDE (que siguen contando paladas, con g0 antes de la etapa 12).
  vikingo: {
    cualidad: 'Fuerza', bote: 'drakkar', lema: 'Cada palada es un hachazo: sus mejoras premian la palada larga y potente.',
    talentos: {
      m1: { nombre: 'Golpe de hacha', tipo: 'carrera', g: [100, 80, 60], texto: (g) => `Cada ${g} paladas recibes 1 palada extra.` },
      m2: { nombre: 'Brazos de hacha', tipo: 'xp', g: [3, 6, 9], gP: [3, 5, 7], g0: [1, 2, 3], texto: (g) => `+${g} XP por cada kilómetro si tu palada media es al menos tan larga como la habitual.` },
      m3: { nombre: 'Salida del drakkar', tipo: 'carrera', g: [0.5, 1, 1.5], texto: (g) => `Tus primeras 20 paladas de la carrera te dan ${coma(g)} m extra cada una.` },
      m4: { nombre: 'Saga de fuerza', tipo: 'xp', g: [10, 20, 30], gP: [10, 20, 30], g0: [15, 30, 45], texto: (g) => `+${g} XP si tu palada media es un 3 % más larga que la habitual.` },
      maestria: { nombre: 'Botín de la saga', tipo: 'xp', g: [20, 40, 60], gP: [20, 40, 60], g0: [25, 50, 75], texto: (g) => `+${g} XP si remas 5 km o más con la palada al menos tan larga como la habitual.` },
    },
  },
  pirata: {
    cualidad: 'Hurto', bote: 'balandra', lema: 'Les roba metros y botín a los fantasmas.',
    talentos: {
      m1: { nombre: 'Bolsa ligera', tipo: 'xp', g: [8, 16, 24], g0: [10, 20, 30], texto: (g) => `+${g} XP por cada fantasma vencido (hasta 3).` },
      m2: { nombre: 'Robar el viento', tipo: 'carrera', g: [30, 25, 20], texto: (g) => `Mientras vas detrás de un fantasma, cada ${g} paladas recibes 1 palada extra.` },
      m3: { nombre: 'Mano rápida', tipo: 'carrera', g: [3, 6, 9], texto: (g) => `Cada vez que adelantas a un fantasma le robas ${g} m.` },
      m4: { nombre: 'Botín escondido', tipo: 'xp', g: [20, 40, 60], g0: [15, 30, 45], texto: (g) => `+${g} XP en cada sesión con carrera contra fantasmas.` },
      maestria: { nombre: 'Reparto del botín', tipo: 'xp', g: [40, 80, 120], texto: (g) => `Si les ganas a todos los fantasmas de la carrera, +${g} XP.` },
    },
  },
  samurai: {
    cualidad: 'Técnica', bote: 'kobaya', lema: 'La forma perfecta: remar sin interrupciones y rematar con precisión.',
    talentos: {
      m1: { nombre: 'Corte limpio', tipo: 'carrera', g: [40, 35, 30], texto: (g) => `Cada ${g} paladas seguidas sin detenerte recibes 1 palada extra.` },
      m2: { nombre: 'Kata', tipo: 'xp', g: [25, 50, 75], g0: [15, 30, 45], texto: (g) => `+${g} XP si remas toda la sesión sin pausas (10 min o más).` },
      m3: { nombre: 'Kiai final', tipo: 'carrera', g: [1, 2, 3], texto: (g) => `En los últimos 200 m de una carrera a distancia, cada 50 m avanzas ${g} m más.` },
      m4: { nombre: 'Maestro del dojo', tipo: 'xp', g: [20, 40, 60], g0: [15, 30, 45], texto: (g) => `+${g} XP al terminar el entrenamiento que toca hoy en tu programa.` },
      maestria: { nombre: 'Senda del maestro', tipo: 'xp', g: [30, 60, 90], texto: (g) => `+${g} XP si terminas el entrenamiento del programa sin pausas.` },
    },
  },
  polinesio: {
    cualidad: 'Resistencia', bote: 'canoa', lema: 'El océano entero es su camino: sus mejoras crecen con los metros y los minutos.',
    talentos: {
      m1: { nombre: 'Estrella guía', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP en sesiones de 30 min o más.` },
      m2: { nombre: 'Lectura del oleaje', tipo: 'carrera', g: [1, 2, 3], texto: (g) => `Cada 250 m avanzas ${g} m más.` },
      m3: { nombre: 'Más allá del horizonte', tipo: 'xp', g: [5, 10, 15], texto: (g) => `+${g} XP por cada kilómetro después del quinto.` },
      m4: { nombre: 'Corriente de marea', tipo: 'carrera', g: [2, 4, 6], texto: (g) => `Pasados los 2000 m, cada 500 m avanzas ${g} m más.` },
      maestria: { nombre: 'Viaje de altura', tipo: 'xp', g: [30, 60, 90], texto: (g) => `+${g} XP en sesiones de 60 min o más.` },
    },
  },
  romano: {
    cualidad: 'Constancia', bote: 'trirreme', lema: 'No se rinde nunca: sus mejoras premian volver cada día y remar sin parar.',
    talentos: {
      m1: { nombre: 'Semana de la flota', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP desde tu tercera sesión de la semana.` },
      m2: { nombre: 'Hortator', tipo: 'carrera', g: [1, 2, 3], texto: (g) => `Cada minuto remado sin detenerte avanzas ${g} m más.` },
      m3: { nombre: 'Ley de la flota', tipo: 'xp', g: [5, 10, 15], texto: (g) => `+${g} XP por cada día de racha del plan (hasta 7 días).` },
      m4: { nombre: 'Boga de la liburna', tipo: 'carrera', g: [3, 6, 9], texto: (g) => `Con 2 días de racha o más, empiezas la carrera ${g} m por delante.` },
      maestria: { nombre: 'Triunfo romano', tipo: 'xp', g: [75, 150, 225], texto: (g) => `Al completar 4 sesiones en una semana o llegar a tu meta semanal de km, +${g} XP (una vez por semana).` },
    },
  },
};

// Dos sendas por clase (etapa 4 del rediseño, decisión de Ander). Las mejoras 1 y 2 son de toda la clase; desde el
// nivel 20 eliges senda y sus mejoras 3, 4 y la maestría cambian. La senda A son los talentos de siempre (quien ya los
// tenía no pierde nada); la B, la otra cara de la misma cultura. Cambiar de senda es gratis: los grados se quedan
// en su casilla y valen para la senda que tengas. Todas siguen dentro de los topes (150 XP y 40 m por carrera).
export const NIVEL_SENDA = 20;
export const SENDAS = {
  vikingo: {
    a: { nombre: 'Timonel del drakkar', lema: 'La palada larga que cruzaba el mar del Norte.' },
    b: { nombre: 'Berserker', lema: 'La furia del primer golpe y las series que pide tu plan.', talentos: {
      m3: { nombre: 'Furia de salida', tipo: 'carrera', intensidad: true, g: [0.4, 0.7, 1], texto: (g) => `Una salida de 15 paladas por carrera: cada palada avanza ${coma(g)} m más. Si no vienes de calentar, cuenta desde el minuto 5.` },
      m4: { nombre: 'Grito de guerra', tipo: 'xp', g: [50, 100, 150], texto: (g) => `+${g} XP al cumplir una sesión clave de tu plan (umbral, VO₂, sprint o prueba).` },
      maestria: { nombre: 'Hambre de batalla', tipo: 'xp', g: [25, 50, 75], texto: (g) => `+${g} XP por cada fantasma vencido en carreras de 2000 m o menos (hasta 3).` },
    } },
  },
  pirata: {
    a: { nombre: 'Abordaje', lema: 'Adelantar y robar metros a los fantasmas.' },
    b: { nombre: 'Intendente', lema: 'Quien llevaba las cuentas del botín: victorias justas y en mar abierto.', talentos: {
      m3: { nombre: 'Cuentas claras', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP por cada fantasma vencido por menos del 5 % de lo remado (hasta 3).` },
      m4: { nombre: 'Partes del botín', tipo: 'xp', g: [20, 40, 60], texto: (g) => `+${g} XP en cada sesión en la que vences al menos a un fantasma.` },
      maestria: { nombre: 'Artículos del barco', tipo: 'xp', g: [40, 80, 120], texto: (g) => `+${g} XP si ganas una carrera en Alta mar.` },
    } },
  },
  samurai: {
    a: { nombre: 'Senda del dojo', lema: 'El plan cumplido y la sesión sin pausas.' },
    b: { nombre: 'Senda de la espada', lema: 'La precisión: cada palada dentro de su rango.', talentos: {
      m3: { nombre: 'Filo preciso', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP si mantienes el 80 % de un entrenamiento en tu rango de vatios.` },
      m4: { nombre: 'Mano firme', tipo: 'xp', g: [5, 10, 15], texto: (g) => `+${g} XP por cada 5 min de remo parejo (potencia y cadencia estables), hasta 30 min.` },
      maestria: { nombre: 'Iaidō', tipo: 'xp', g: [30, 60, 90], texto: (g) => `+${g} XP si terminas un entrenamiento sin pausas con el 90 % en tu rango.` },
    } },
  },
  polinesio: {
    a: { nombre: 'Hoʻokele, el navegante', lema: 'Travesías largas a ritmo constante.' },
    b: { nombre: 'Remero de carrera', lema: 'Las regatas de canoa: remontar y ganar.', talentos: {
      m3: { nombre: 'Remontada', tipo: 'carrera', intensidad: true, g: [1, 2, 3], texto: (g) => `En el último 10 % de una carrera a distancia, si vas por detrás, cada 50 m avanzas ${g} m más.` },
      m4: { nombre: 'Regata de canoas', tipo: 'xp', g: [10, 20, 30], texto: (g) => `+${g} XP por cada fantasma vencido (hasta 3).` },
      maestria: { nombre: 'Canoa ganadora', tipo: 'xp', g: [40, 80, 120], texto: (g) => `+${g} XP si les ganas a todos los fantasmas en una carrera de 5 km o más.` },
    } },
  },
  romano: {
    a: { nombre: 'Disciplina de la flota', lema: 'La semana del plan y la racha.' },
    b: { nombre: 'Harpax', lema: 'El arpón de Agripa en Nauloco (36 a. C.): alcanzar y enganchar al rival.', talentos: {
      m3: { nombre: 'Harpax', tipo: 'carrera', intensidad: true, g: [2, 4, 6], texto: (g) => `Cada vez que adelantas a un fantasma, avanzas ${g} m más (hasta 3 veces, con 90 s entre una y otra).` },
      m4: { nombre: 'Victoria de Nauloco', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP por cada fantasma vencido (hasta 3).` },
      maestria: { nombre: 'Corona naval', tipo: 'xp', g: [40, 80, 120], texto: (g) => `+${g} XP si ganas una carrera en Alta mar.` },
    } },
  },
};
export const SLOTS_SENDA = new Set(['m3', 'm4', 'maestria']);
// Senda de una clase en una fecha: per.senda = { clase: [[ms, 'a' | 'b'], …] } (cada cambio con su fecha).
export function sendaEn(per, clase, fecha = Infinity) {
  const lista = per?.senda?.[clase] || [];
  return lista.filter(([f]) => f <= fecha).at(-1)?.[1] || 'a';
}
export const talentoDe = (clase, slot, senda = 'a') => (senda === 'b' && SLOTS_SENDA.has(slot) && SENDAS[claveDe(clase)]?.b.talentos[slot]) || CLASES_TALENTO[claveDe(clase)].talentos[slot];
const coma = (n) => String(n).replace('.', ',');
const claveDe = (clase) => (CLASES_TALENTO[clase] ? clase : 'vikingo');
export const cualidadDe = (clase) => CLASES_TALENTO[claveDe(clase)].cualidad;
export const lemaTalentos = (clase) => CLASES_TALENTO[claveDe(clase)].lema;
export const nivelDeSlot = (slot) => NIVEL_SLOT[slot];
export const costeDe = (slot) => COSTE_SLOT[slot];

// Los 5 talentos de una clase, listos para pintar. porGrado: texto de cada grado («1 / 2 / 3»).
export function talentosDe(clase, senda = 'a') {
  return SLOTS.map((slot) => {
    const t = talentoDe(clase, slot, senda);
    return {
      slot, senda: SLOTS_SENDA.has(slot), intensidad: !!t.intensidad, nombre: t.nombre, tipo: t.tipo, nivel: NIVEL_SLOT[slot], coste: COSTE_SLOT[slot], max: GRADOS_MAX, maestria: slot === 'maestria',
      g: t.g, texto: t.texto(t.g.map(coma).join(' / ')), textoGrado: (n) => t.texto(t.g[Math.max(0, n - 1)]),
    };
  });
}
// Valor del talento en su grado actual (0 si no se ha aprendido). antes: con los valores de antes de la etapa 12;
// paladas: con los del vikingo que contaba paladas (antes de VIKINGO_PALADA_DESDE).
export function valorDe(clase, slot, grado, antes = false, paladas = false, senda = 'a') {
  const t = talentoDe(clase, slot, senda);
  if (!t || grado <= 0) return 0;
  const tabla = antes && t.g0 ? t.g0 : paladas && t.gP ? t.gP : t.g;
  return tabla[Math.min(grado, GRADOS_MAX) - 1];
}
export const VIKINGO_PALADA_DESDE = '2026-11-11';
// La palada de una sesión frente a tu media habitual (1 = igual de larga). 0 si no hay datos.
export const paladaRelativa = (d) => (d.paladas > 0 && d.mppMedia > 0 ? d.metros / d.paladas / d.mppMedia : 0);
// Triunfo romano: con 4 sesiones en la semana o al llegar a tu meta semanal de km, lo que pase antes (antes de la
// etapa 12, solo con 5 sesiones). Se paga en la sesión que lo consigue, una vez por semana.
export const SESIONES_TRIUNFO = 4;
export function ganaTriunfo(d) {
  if (d.antes) return d.sesSemana === 5;
  const meta = d.metaSemanaKm > 0 ? d.metaSemanaKm : Infinity;
  const ahora = d.sesSemana >= SESIONES_TRIUNFO || d.kmSemana >= meta;
  const antes = d.sesSemana - 1 >= SESIONES_TRIUNFO || d.kmSemana - d.metros / 1000 >= meta;
  return ahora && !antes;
}
// Puntos de talento sobrantes: los que ya no caben en el árbol completo. Se pueden cambiar por monedas.
export const MONEDAS_POR_PUNTO = 150;
export function puntosSobrantes(arbol, libres) {
  const falta = SLOTS.reduce((a, slot) => a + (GRADOS_MAX - Math.min(GRADOS_MAX, arbol?.[slot]?.length || 0)) * COSTE_SLOT[slot], 0);
  return Math.max(0, libres - falta);
}

// arbol = { slot: [fecha del grado 1, fecha del grado 2, …] } de la clase activa.
// Las claves del árbol anterior (potencia-1, fondo-2…) se ignoran: esos puntos quedan libres otra vez.
export function grado(arbol, clase, slot, fecha = Infinity) {
  if (!COSTE_SLOT[slot]) return 0;
  return Math.min(GRADOS_MAX, (arbol?.[slot] || []).filter((f) => f <= fecha).length);
}
export function puntosGastados(arbol) {
  return SLOTS.reduce((a, slot) => a + (arbol?.[slot]?.length || 0) * COSTE_SLOT[slot], 0);
}
// ¿Quedan puntos del árbol anterior? (para avisar de que se devolvieron)
export const tieneArbolAntiguo = (arbol) => Object.keys(arbol || {}).some((k) => !COSTE_SLOT[k]);
// Grados de todas las casillas en una fecha (para aplicar efectos solo desde que se aprendieron).
export function gradosEn(arbol, clase, fecha) {
  return Object.fromEntries(SLOTS.map((slot) => [slot, grado(arbol, clase, slot, fecha)]));
}

// null si se puede subir un grado; si no, el motivo.
export function motivoBloqueo(slot, { nivel, libres }, arbol, clase) {
  if (grado(arbol, clase, slot) >= GRADOS_MAX) return 'Ya está al máximo';
  const req = NIVEL_SLOT[slot];
  if (nivel < req) return `Se abre en el nivel ${req} (${RANGO_NIVEL[req]})`;
  const coste = COSTE_SLOT[slot];
  if (libres < coste) return `Necesitas ${coste} ${coste === 1 ? 'punto' : 'puntos'}`;
  return null;
}

// XP de los talentos en una sesión. d = { paladas, metros, min, ganados, rivales, sinPausas, delPrograma, racha, sesSemana,
// antes (sesión anterior a la etapa 12), kmSemana (con esta sesión), metaSemanaKm, palada (vikingo de palada larga),
// mppMedia (tus metros por palada habituales) }.
// Devuelve [[nombre, xp], …]. Todo lo de la sesión suma como mucho TOPE_TALENTOS_XP; el Triunfo romano va aparte.
export function xpTalentos(clase, grados, d) {
  const senda = d.senda === 'b' ? 'b' : 'a';
  const v = (slot) => valorDe(clase, slot, grados?.[slot] || 0, !!d.antes, !d.palada, senda);
  const filas = [];
  const sumar = (slot, xp) => { if (xp > 0) filas.push([talentoDe(clase, slot, senda).nombre, Math.round(xp)]); };
  const k = claveDe(clase);
  if (senda === 'b') {
    // Mejoras 1 y 2 de la clase (las de siempre).
    if (k === 'vikingo') { const rel = d.mppMedia > 0 ? paladaRelativa(d) : 1; if (rel >= 1) sumar('m2', v('m2') * Math.floor(d.metros / 1000)); }
    if (k === 'pirata') sumar('m1', v('m1') * Math.min(3, d.ganados));
    if (k === 'samurai' && d.sinPausas) sumar('m2', v('m2'));
    if (k === 'polinesio' && d.min >= 30) sumar('m1', v('m1'));
    if (k === 'romano' && d.sesSemana >= 3) sumar('m1', v('m1'));
    const g3 = Math.min(3, d.ganados || 0);
    if (k === 'vikingo') {
      if (d.clave) sumar('m4', v('m4'));
      if (d.metros <= 2000) sumar('maestria', v('maestria') * g3);
    } else if (k === 'pirata') {
      sumar('m3', v('m3') * Math.min(3, d.renidas || 0));
      if (d.ganados > 0) sumar('m4', v('m4'));
      if (d.altamar) sumar('maestria', v('maestria'));
    } else if (k === 'samurai') {
      if ((d.pctEnRango ?? 0) >= 80) sumar('m3', v('m3'));
      sumar('m4', v('m4') * Math.floor(Math.min(30, d.tecMin || 0) / 5));
      if (d.sinPausas && d.delPrograma && (d.pctEnRango ?? 0) >= 90) sumar('maestria', v('maestria'));
    } else if (k === 'polinesio') {
      sumar('m4', v('m4') * g3);
      if (d.rivales > 0 && d.ganados >= d.rivales && d.metros >= 5000) sumar('maestria', v('maestria'));
    } else {
      sumar('m4', v('m4') * g3);
      if (d.altamar) sumar('maestria', v('maestria'));
    }
  } else if (k === 'vikingo' && d.palada) {
    // Sin media habitual todavía (primeras sesiones), la palada cuenta como igual de larga.
    const rel = d.mppMedia > 0 ? paladaRelativa(d) : 1;
    if (rel >= 1) sumar('m2', v('m2') * Math.floor(d.metros / 1000));
    if (rel >= 1.03) sumar('m4', v('m4'));
    if (rel >= 1 && d.metros >= 5000) sumar('maestria', v('maestria'));
  } else if (k === 'vikingo') {
    sumar('m2', v('m2') * Math.floor(d.paladas / (d.antes ? 10 : 100)));
    if (d.paladas >= 500) sumar('m4', v('m4'));
    sumar('maestria', v('maestria') * Math.floor(d.paladas / 1000));
  } else if (k === 'pirata') {
    sumar('m1', v('m1') * Math.min(3, d.ganados));
    if (d.rivales > 0) sumar('m4', v('m4'));
    if (d.rivales > 0 && d.ganados >= d.rivales) sumar('maestria', v('maestria'));
  } else if (k === 'samurai') {
    if (d.sinPausas) sumar('m2', v('m2'));
    if (d.delPrograma) sumar('m4', v('m4'));
    if (d.delPrograma && d.sinPausas) sumar('maestria', v('maestria'));
  } else if (k === 'polinesio') {
    if (d.min >= 30) sumar('m1', v('m1'));
    if (d.metros > 5000) sumar('m3', v('m3') * Math.floor((d.metros - 5000) / 1000));
    if (d.min >= 60) sumar('maestria', v('maestria'));
  } else {
    if (d.sesSemana >= 3) sumar('m1', v('m1'));
    sumar('m3', v('m3') * Math.min(7, d.racha));
  }
  // Tope por sesión: se recorta la última fila que lo pase.
  let resto = TOPE_TALENTOS_XP;
  const recortadas = [];
  for (const [n, xp] of filas) {
    const x = Math.min(xp, resto);
    if (x > 0) recortadas.push([n, x]);
    resto -= x;
  }
  const triunfo = k === 'romano' && senda === 'a' && ganaTriunfo(d) && v('maestria') ? [[talentoDe(clase, 'maestria', senda).nombre, v('maestria')]] : [];
  return [...recortadas, ...triunfo];
}
