// Personajes 3D: qué modelo usa cada clase, sus animaciones y qué piezas lleva según el nivel.
// Es solo datos y funciones puras (se prueban en pruebas/personajes3d.test.mjs); el visor está en visor.js.
// Para añadir una clase, mira docs/personajes3d/NUEVA_CLASE.md.

const HACHA = ['HachaCabeza', 'HachaEmpunadura', 'HachaMango'];
const REMO = ['RemoMango', 'RemoPuno', 'RemoPuno.001'];

export const PERSONAJES_3D = {
  vikingo: {
    nombre: 'Vikingo',
    modelos: { alta: 'assets/personajes3d/vikingo/vikingo.glb', movil: 'assets/personajes3d/vikingo/vikingo_movil.glb' },
    altura: 1.95, // metros, pies en y = 0
    animaciones: ['preview', 'idle', 'rowing', 'victory'],
    // Piezas que solo se ven en una animación (el remo) y las que estorban en ella (el hacha al remar).
    soloEn: { rowing: REMO },
    ocultarEn: { rowing: [...HACHA, 'Cenefa'] }, // la cenefa es rígida y no sigue a la falda al sentarse
    // Equipo que se gana al subir de nivel: cada variante añade piezas a las anteriores.
    // Las piezas que no aparecen aquí (cuerpo, gambesón, falda, botas, hacha…) se ven siempre.
    variantes: [
      { desde: 1, nombre: 'Recluta', agrega: [] },
      { desde: 5, nombre: 'Remero de la saga', agrega: ['CorreaA', 'CorreaB', 'BrochePecho', 'BrochePechoNudo', 'Brazales'] },
      { desde: 10, nombre: 'Guerrero del fiordo', agrega: ['Capa', 'BrocheCapaL', 'BrocheCapaLNudo', 'BrocheCapaR', 'BrocheCapaRNudo', 'RodilleraL', 'RodilleraR', 'PelajeBotaL', 'PelajeBotaR'] },
      { desde: 15, nombre: 'Jarl', agrega: ['MantoPelaje', 'Tatuaje', 'TrenzaBarba'] },
      { desde: 20, nombre: 'Leyenda del norte', agrega: ['Cenefa', 'AnilloMoño'], materiales: { HachaCabeza: 'Oro' } },
    ],
  },
};

export const CLASES_3D = Object.keys(PERSONAJES_3D);
export const tiene3D = (clase) => Object.hasOwn(PERSONAJES_3D, clase);

// La variante que toca a un nivel (la última cuyo «desde» se alcanzó).
export function varianteDe(clase, nivel) {
  const v = PERSONAJES_3D[clase]?.variantes || [];
  return v.filter((x) => nivel >= x.desde).at(-1) || v[0] || null;
}

// Nombres de las piezas ocultas para una clase, nivel y animación.
export function piezasOcultas(clase, nivel, animacion) {
  const p = PERSONAJES_3D[clase];
  if (!p) return new Set();
  const ocultas = new Set(p.variantes.filter((v) => nivel < v.desde).flatMap((v) => v.agrega));
  for (const [anim, piezas] of Object.entries(p.soloEn || {})) if (anim !== animacion) piezas.forEach((n) => ocultas.add(n));
  for (const n of p.ocultarEn?.[animacion] || []) ocultas.add(n);
  return ocultas;
}

// Cambios de material acumulados hasta ese nivel: { pieza: nombreMaterial }.
export function materialesDe(clase, nivel) {
  const p = PERSONAJES_3D[clase];
  return Object.assign({}, ...(p?.variantes || []).filter((v) => nivel >= v.desde).map((v) => v.materiales || {}));
}

// Modelo según la calidad pedida: 'alta', 'movil' o 'auto' (pantallas pequeñas o con poca memoria usan el ligero).
export function modeloDe(clase, calidad = 'auto', entorno = {}) {
  const m = PERSONAJES_3D[clase]?.modelos;
  if (!m) return null;
  if (calidad === 'alta' || calidad === 'movil') return m[calidad];
  const { ancho = 1024, memoria = 8, ratio = 1 } = entorno;
  return ancho * ratio < 1000 || memoria <= 4 ? m.movil : m.alta;
}
