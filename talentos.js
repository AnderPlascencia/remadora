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
export const CLASES_TALENTO = {
  vikingo: {
    cualidad: 'Fuerza', bote: 'drakkar', lema: 'Cada palada es un hachazo: sus mejoras cuentan paladas.',
    talentos: {
      m1: { nombre: 'Golpe de hacha', tipo: 'carrera', g: [50, 40, 30], texto: (g) => `Cada ${g} paladas recibes 1 palada extra.` },
      m2: { nombre: 'Brazos de hacha', tipo: 'xp', g: [1, 2, 3], texto: (g) => `+${g} XP cada 10 paladas.` },
      m3: { nombre: 'Salida del drakkar', tipo: 'carrera', g: [0.5, 1, 1.5], texto: (g) => `Tus primeras 20 paladas de la carrera te dan ${coma(g)} m extra cada una.` },
      m4: { nombre: 'Saga de fuerza', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP al llegar a 500 paladas en una sesión.` },
      maestria: { nombre: 'Botín de la saga', tipo: 'xp', g: [25, 50, 75], texto: (g) => `+${g} XP cada 1000 paladas.` },
    },
  },
  pirata: {
    cualidad: 'Hurto', bote: 'balandra', lema: 'Les roba metros y botín a los fantasmas.',
    talentos: {
      m1: { nombre: 'Bolsa ligera', tipo: 'xp', g: [10, 20, 30], texto: (g) => `+${g} XP por cada fantasma vencido (hasta 3).` },
      m2: { nombre: 'Robar el viento', tipo: 'carrera', g: [30, 25, 20], texto: (g) => `Mientras vas detrás de un fantasma, cada ${g} paladas recibes 1 palada extra.` },
      m3: { nombre: 'Mano rápida', tipo: 'carrera', g: [3, 6, 9], texto: (g) => `Cada vez que adelantas a un fantasma le robas ${g} m.` },
      m4: { nombre: 'Botín escondido', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP en cada sesión con carrera contra fantasmas.` },
      maestria: { nombre: 'Tesoro del capitán', tipo: 'xp', g: [40, 80, 120], texto: (g) => `Si les ganas a todos los fantasmas de la carrera, +${g} XP.` },
    },
  },
  samurai: {
    cualidad: 'Técnica', bote: 'barca', lema: 'La forma perfecta: remar sin interrupciones y rematar con precisión.',
    talentos: {
      m1: { nombre: 'Corte limpio', tipo: 'carrera', g: [40, 35, 30], texto: (g) => `Cada ${g} paladas seguidas sin detenerte recibes 1 palada extra.` },
      m2: { nombre: 'Kata', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP si remas toda la sesión sin pausas (10 min o más).` },
      m3: { nombre: 'Kiai final', tipo: 'carrera', g: [1, 2, 3], texto: (g) => `En los últimos 200 m de una carrera a distancia, cada 50 m avanzas ${g} m más.` },
      m4: { nombre: 'Maestro del dojo', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP al terminar el entrenamiento que toca hoy en tu programa.` },
      maestria: { nombre: 'Senda del maestro', tipo: 'xp', g: [30, 60, 90], texto: (g) => `+${g} XP si terminas el entrenamiento del programa sin pausas.` },
    },
  },
  polinesio: {
    cualidad: 'Resistencia', bote: 'canoa', lema: 'El océano entero es su camino: sus mejoras crecen con los metros y los minutos.',
    talentos: {
      m1: { nombre: 'Estrella guía', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP en sesiones de 30 min o más.` },
      m2: { nombre: 'Lectura del oleaje', tipo: 'carrera', g: [1, 2, 3], texto: (g) => `Cada 250 m avanzas ${g} m más.` },
      m3: { nombre: 'Travesía', tipo: 'xp', g: [5, 10, 15], texto: (g) => `+${g} XP por cada kilómetro después del quinto.` },
      m4: { nombre: 'Corriente de marea', tipo: 'carrera', g: [2, 4, 6], texto: (g) => `Pasados los 2000 m, cada 500 m avanzas ${g} m más.` },
      maestria: { nombre: 'Gran travesía', tipo: 'xp', g: [30, 60, 90], texto: (g) => `+${g} XP en sesiones de 60 min o más.` },
    },
  },
  romano: {
    cualidad: 'Constancia', bote: 'trirreme', lema: 'No se rinde nunca: sus mejoras premian volver cada día y remar sin parar.',
    talentos: {
      m1: { nombre: 'Pax romana', tipo: 'xp', g: [15, 30, 45], texto: (g) => `+${g} XP desde tu tercera sesión de la semana.` },
      m2: { nombre: 'Hortator', tipo: 'carrera', g: [1, 2, 3], texto: (g) => `Cada minuto remado sin detenerte avanzas ${g} m más.` },
      m3: { nombre: 'Ley de la legión', tipo: 'xp', g: [5, 10, 15], texto: (g) => `+${g} XP por cada día de racha (hasta 7 días).` },
      m4: { nombre: 'Marcha de la legión', tipo: 'carrera', g: [3, 6, 9], texto: (g) => `Con 2 días de racha o más, empiezas la carrera ${g} m por delante.` },
      maestria: { nombre: 'Triunfo romano', tipo: 'xp', g: [75, 150, 225], texto: (g) => `Al completar 5 sesiones en una semana, +${g} XP (una vez por semana).` },
    },
  },
};

const coma = (n) => String(n).replace('.', ',');
const claveDe = (clase) => (CLASES_TALENTO[clase] ? clase : 'vikingo');
export const cualidadDe = (clase) => CLASES_TALENTO[claveDe(clase)].cualidad;
export const lemaTalentos = (clase) => CLASES_TALENTO[claveDe(clase)].lema;
export const nivelDeSlot = (slot) => NIVEL_SLOT[slot];
export const costeDe = (slot) => COSTE_SLOT[slot];

// Los 5 talentos de una clase, listos para pintar. porGrado: texto de cada grado («1 / 2 / 3»).
export function talentosDe(clase) {
  const c = CLASES_TALENTO[claveDe(clase)];
  return SLOTS.map((slot) => {
    const t = c.talentos[slot];
    return {
      slot, nombre: t.nombre, tipo: t.tipo, nivel: NIVEL_SLOT[slot], coste: COSTE_SLOT[slot], max: GRADOS_MAX, maestria: slot === 'maestria',
      g: t.g, texto: t.texto(t.g.map(coma).join(' / ')), textoGrado: (n) => t.texto(t.g[Math.max(0, n - 1)]),
    };
  });
}
// Valor del talento en su grado actual (0 si no se ha aprendido).
export function valorDe(clase, slot, grado) {
  const t = CLASES_TALENTO[claveDe(clase)].talentos[slot];
  return t && grado > 0 ? t.g[Math.min(grado, GRADOS_MAX) - 1] : 0;
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

// XP de los talentos en una sesión. d = { paladas, metros, min, ganados, rivales, sinPausas, delPrograma, racha, sesSemana }.
// Devuelve [[nombre, xp], …]. Todo lo de la sesión suma como mucho TOPE_TALENTOS_XP; el Triunfo romano va aparte.
export function xpTalentos(clase, grados, d) {
  const c = CLASES_TALENTO[claveDe(clase)];
  const v = (slot) => valorDe(clase, slot, grados?.[slot] || 0);
  const filas = [];
  const sumar = (slot, xp) => { if (xp > 0) filas.push([c.talentos[slot].nombre, Math.round(xp)]); };
  const k = claveDe(clase);
  if (k === 'vikingo') {
    sumar('m2', v('m2') * Math.floor(d.paladas / 10));
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
  const triunfo = k === 'romano' && d.sesSemana === 5 && v('maestria') ? [[c.talentos.maestria.nombre, v('maestria')]] : [];
  return [...recortadas, ...triunfo];
}
