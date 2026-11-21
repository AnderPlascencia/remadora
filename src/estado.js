// Estado compartido entre pantallas. Lo que solo usa una pantalla vive en su propio módulo.
export const estado = {
  escalaTrip: null, // puestos de la tripulación ya calculados (pintarClasificacion)
  tVivo: 0,
  sesion: null,
  guardando: false, // la sesión que terminó se está guardando (pantallas/sesion.js)
  entrenamientoPrevio: null,
  versionCorta: null, // «Solo tengo 15 / 20 min»: { valor (el del selector), min } para la próxima sesión
  entrenamientoActivo: null,
  baseActual: [],
  condicionBase: 0, // condición con la que se armaron los base
  elegirLoDeHoy: true,
  primerDia: false, // recién terminada la bienvenida: solo «Hoy toca» y Empezar, sin consejos ni opciones de carrera
  cacheSesiones: [],
  tendencia: 'potencia',
  atrAbierta: null,
  sesionAbierta: null,
};
