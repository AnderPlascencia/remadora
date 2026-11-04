// Estado compartido entre pantallas. Lo que solo usa una pantalla vive en su propio módulo.
export const estado = {
  escalaTrip: null, // puestos de la tripulación ya calculados (pintarClasificacion)
  tVivo: 0,
  sesion: null,
  entrenamientoPrevio: null,
  entrenamientoActivo: null,
  baseActual: [],
  condicionBase: 0, // condición con la que se armaron los base
  elegirLoDeHoy: true,
  cacheSesiones: [],
  tendencia: 'potencia',
  atrAbierta: null,
  sesionAbierta: null,
};
