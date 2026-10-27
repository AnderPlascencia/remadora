// Talentos por clase: 3 ramas (Potencia, Fondo, Disciplina) con 3 talentos cada una.
// Las 5 clases comparten los mismos efectos para estar equilibradas; cambian nombres y ambientación.
// I: pasivo de 3 grados · II: activo en la carrera contra fantasmas · III: maestría de 3 grados.

export const RAMAS = [
  { clave: 'potencia', nombre: 'Potencia' },
  { clave: 'fondo', nombre: 'Fondo' },
  { clave: 'disciplina', nombre: 'Disciplina' },
];
export const GRADOS_MAX = { 1: 3, 2: 1, 3: 3 };
export const COSTE = { 1: 1, 2: 3, 3: 2 }; // puntos por grado
export const NIVEL_REQUERIDO = { 1: 1, 2: 20, 3: 40 }; // II en Combatiente, III en Veterano
export const NOMBRE_TIER = { 1: 'I', 2: 'II', 3: 'III' };
// Un punto cada 3 niveles: 30 al nivel 90. El árbol completo cuesta 36, así que hay que especializarse.
export const puntosDeNivel = (nivel) => Math.floor(nivel / 3);
// Ventaja máxima que dan los talentos en una carrera, en metros.
export const TOPE_TALENTOS_M = 30;

// Ambientación por clase: rama favorita, nombre del bote, nombres de ramas y talentos.
export const AMBIENTE = {
  vikingo: {
    favorita: 'potencia', bote: 'drakkar',
    ramas: { potencia: 'Furia berserker', fondo: 'Ruta del drakkar', disciplina: 'Juramento del clan' },
    nombres: {
      'potencia-1': 'Brazos de hacha', 'potencia-2': 'Grito de guerra', 'potencia-3': 'Botín de la saga',
      'fondo-1': 'Remo largo', 'fondo-2': 'Viento de popa', 'fondo-3': 'Más allá del fiordo',
      'disciplina-1': 'Escudo firme', 'disciplina-2': 'Tambor del drakkar', 'disciplina-3': 'Ley del clan',
    },
  },
  pirata: {
    favorita: 'fondo', bote: 'balandra',
    ramas: { potencia: 'Abordaje', fondo: 'Mar abierto', disciplina: 'Código pirata' },
    nombres: {
      'potencia-1': 'Al abordaje', 'potencia-2': 'Cañonazo', 'potencia-3': 'Cofre del botín',
      'fondo-1': 'Rumbo fijo', 'fondo-2': 'Viento a favor', 'fondo-3': 'Mapa del tesoro',
      'disciplina-1': 'Orden en cubierta', 'disciplina-2': 'Compás del contramaestre', 'disciplina-3': 'Parte justa',
    },
  },
  samurai: {
    favorita: 'disciplina', bote: 'barca',
    ramas: { potencia: 'Kiai', fondo: 'Camino largo', disciplina: 'Bushidō' },
    nombres: {
      'potencia-1': 'Corte rápido', 'potencia-2': 'Grito kiai', 'potencia-3': 'Filo perfecto',
      'fondo-1': 'Paso del peregrino', 'fondo-2': 'Respiración profunda', 'fondo-3': 'Senda del Tōkaidō',
      'disciplina-1': 'Zanshin', 'disciplina-2': 'Kata', 'disciplina-3': 'Maestro del dojo',
    },
  },
  polinesio: {
    favorita: 'fondo', bote: 'canoa',
    ramas: { potencia: 'Mana', fondo: 'Navegante de estrellas', disciplina: 'Canto del remo' },
    nombres: {
      'potencia-1': 'Brazos de koa', 'potencia-2': 'Ola grande', 'potencia-3': 'Fuerza del mana',
      'fondo-1': 'Corriente amiga', 'fondo-2': 'Estrella guía', 'fondo-3': 'Lectura del oleaje',
      'disciplina-1': 'Canto de remo', 'disciplina-2': 'Ritmo del pahu', 'disciplina-3': 'ʻOhana',
    },
  },
  romano: {
    favorita: 'disciplina', bote: 'trirreme',
    ramas: { potencia: 'Gladius', fondo: 'Vía romana', disciplina: 'Disciplina de la legión' },
    nombres: {
      'potencia-1': 'Brazo de legionario', 'potencia-2': 'Carga', 'potencia-3': 'Triunfo',
      'fondo-1': 'Marcha', 'fondo-2': 'Viento de Ostia', 'fondo-3': 'Todos los caminos',
      'disciplina-1': 'Testudo', 'disciplina-2': 'Hortator', 'disciplina-3': 'Cursus honorum',
    },
  },
};

// Efecto común de cada casilla (texto para la app).
const EFECTO = {
  'potencia-1': () => '+4 % de XP de distancia por grado en sesiones con 5 min o más en zona 4.',
  'fondo-1': () => '+4 % de XP de distancia por grado en sesiones de 30 min activos o más.',
  'disciplina-1': () => '+4 % de XP de distancia por grado en sesiones con ritmo estable.',
  'potencia-2': (b) => `En la carrera: 20 s seguidos por encima de tu FTP y tu ${b} gana 15 m frente a los fantasmas (como mucho una vez cada 2 min).`,
  'fondo-2': (b) => `En la carrera: cada 10 min a ritmo parejo, tu ${b} gana 10 m frente a los fantasmas.`,
  'disciplina-2': () => 'En la carrera: 60 s seguidos a ritmo estable y los fantasmas reman un 1 % más lento durante el minuto siguiente.',
  'potencia-3': () => 'El bono de récord personal da +25 XP por grado.',
  'fondo-3': () => '+5 XP por grado por cada kilómetro después del quinto.',
  'disciplina-3': () => 'Los bonos de constancia dan un 10 % más de XP por grado.',
};

const claveDe = (clase) => (AMBIENTE[clase] ? clase : 'vikingo');

// Los 9 talentos de una clase, listos para pintar.
export function talentosDe(clase) {
  const a = AMBIENTE[claveDe(clase)];
  return RAMAS.flatMap((r) => [1, 2, 3].map((tier) => {
    const slot = `${r.clave}-${tier}`;
    return { slot, rama: r.clave, tier, nombre: a.nombres[slot], texto: EFECTO[slot](a.bote), activa: tier === 2, max: GRADOS_MAX[tier], coste: COSTE[tier] };
  }));
}
export const nombreRama = (clase, rama) => AMBIENTE[claveDe(clase)].ramas[rama];
export const ramaFavorita = (clase) => AMBIENTE[claveDe(clase)].favorita;

// arbol = { slot: [fecha del grado 1, fecha del grado 2, …] } de la clase activa.
// La rama favorita trae el grado 1 de su talento I sin coste.
export function grado(arbol, clase, slot, fecha = Infinity) {
  const comprados = (arbol?.[slot] || []).filter((f) => f <= fecha).length;
  const gratis = slot === `${ramaFavorita(clase)}-1` ? 1 : 0;
  return Math.min(GRADOS_MAX[Number(slot.at(-1))], comprados + gratis);
}
export function puntosGastados(arbol) {
  return Object.entries(arbol || {}).reduce((a, [slot, fechas]) => a + fechas.length * (COSTE[Number(slot.at(-1))] || 0), 0);
}
// Grados de todas las casillas en una fecha (para aplicar efectos solo desde que se aprendieron).
export function gradosEn(arbol, clase, fecha) {
  return Object.fromEntries(talentosDe(clase).map((t) => [t.slot, grado(arbol, clase, t.slot, fecha)]));
}

// null si se puede subir un grado; si no, el motivo.
export function motivoBloqueo(slot, { nivel, libres }, arbol, clase) {
  const tier = Number(slot.at(-1));
  const rama = slot.slice(0, -2);
  if (grado(arbol, clase, slot) >= GRADOS_MAX[tier]) return 'Ya está al máximo';
  if (tier > 1 && grado(arbol, clase, `${rama}-${tier - 1}`) < 1) {
    return `Primero aprende ${AMBIENTE[claveDe(clase)].nombres[`${rama}-${tier - 1}`]}`;
  }
  if (nivel < NIVEL_REQUERIDO[tier]) return `Se abre en el nivel ${NIVEL_REQUERIDO[tier]} (${tier === 2 ? 'Combatiente' : 'Veterano'})`;
  if (libres < COSTE[tier]) return `Necesitas ${COSTE[tier]} ${COSTE[tier] === 1 ? 'punto' : 'puntos'}`;
  return null;
}
