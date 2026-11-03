// Guía rápida: qué hace cada pantalla, en frases cortas. La muestran Ajustes › Ayuda y los consejos
// que salen la primera vez que abres cada pestaña. «vista» es la pestaña a la que lleva el botón «Ir».
export const TEMAS = [
  {
    clave: 'empezar', titulo: 'Primeros pasos', icono: 'i-bt', vista: 'entrenar',
    resumen: 'Conecta la remadora y, si quieres, tu reloj o banda de pulso.',
    puntos: [
      'Enciende la consola de la RW200 y toca el símbolo de Bluetooth arriba a la derecha.',
      'El corazón de la barra conecta un reloj o banda de pulso. Con pulso ves tus zonas y el esfuerzo de cada sesión.',
      'Sin remadora a mano, prueba todo con el modo demo (Ajustes › Diagnóstico).',
      'Instálala con el menú ⋮ de Chrome › Agregar a la pantalla principal: así funciona sin conexión.',
    ],
  },
  {
    clave: 'entrenar', titulo: 'Entrenar', icono: 'i-remo', vista: 'entrenar',
    resumen: 'La tarjeta Hoy te dice qué toca; pulsa Empezar y rema.',
    puntos: [
      'Hoy muestra la sesión de tu plan, o una recomendación según tu frescura. Con Cambiar eliges otra o Remo libre.',
      'Antes de remar ves lo que ganas seguro y los retos que puedes sumar a tu héroe.',
      'Si dejas de remar, la sesión se pausa sola. Si se cae el Bluetooth, se reconecta y no pierdes nada.',
      'Al terminar ves tus récords, la comparación con la vez anterior y qué entrenar la próxima vez.',
    ],
  },
  {
    clave: 'modo-remo', titulo: 'Modo remo', icono: 'i-expandir', vista: 'entrenar',
    resumen: 'Pantalla completa con números gigantes para leer mientras remas.',
    puntos: [
      'Ábrelo con el botón de pantalla completa (o actívalo siempre en Ajustes › Durante el entrenamiento).',
      'Doble toque para pausar; desliza a los lados para cambiar entre números, gráfica y carrera.',
      'Las flechas de sube y baja te dicen si vas dentro del rango del intervalo.',
      'Funciona en vertical y en horizontal.',
    ],
  },
  {
    clave: 'carrera', titulo: 'Carrera y fantasmas', icono: 'i-fantasma', vista: 'entrenar',
    resumen: 'Rema contra tu mejor marca, tu sesión anterior o rivales a tu nivel.',
    puntos: [
      'Elige hasta 3 fantasmas al preparar la sesión: tu mejor marca, la anterior o rivales simulados.',
      'Toca la carrera para cambiar entre la vista desde arriba y la 3D.',
      'Bahía, Costa y Alta mar cambian la dificultad; vencer da XP.',
    ],
  },
  {
    clave: 'planes', titulo: 'Planes', icono: 'i-lista', vista: 'entrenamientos',
    resumen: 'Entrenamientos listos y programas de varias semanas hacia tu objetivo.',
    puntos: [
      'Entrenamientos: toca uno para ver su perfil; con «Quiero subir…» se ordenan por el atributo que suben.',
      'Programa: el asistente arma un plan por objetivo (base, VO₂máx, FTP, potencia o calorías) o por tiempo meta.',
      'El plan usa tu perfil: los días que tienes, el tiempo por sesión y tu experiencia.',
      'Si te cansas o mejoras, el plan se ajusta solo; al terminarlo te propone el siguiente.',
    ],
  },
  {
    clave: 'heroe', titulo: 'Héroe', icono: 'i-heroe', vista: 'heroe',
    resumen: 'Tu personaje sube de nivel con cada sesión real.',
    puntos: [
      'XP: por metros, entrenamientos completos, récords, fantasmas vencidos y misiones. Cada 3 niveles ganas un talento.',
      'Siete atributos crecen según cómo remas: Fuerza, Agilidad, Resistencia, Recuperación, Técnica, Voluntad y Gasto.',
      'Misiones diarias y semanales, y jefes que son pruebas reales (Enfrentar).',
      'Las monedas compran ventajas para la carrera y paisajes nuevos en la tienda.',
      'Tu puesto en la tripulación (de Grumete a Capitán) sale de tu FTP, no del nivel.',
    ],
  },
  {
    clave: 'progreso', titulo: 'Progreso', icono: 'i-grafica', vista: 'historial',
    resumen: 'Cómo está tu cuerpo hoy y cuánto has mejorado.',
    puntos: [
      'Racha, meta semanal de kilómetros y récords.',
      'Tu forma: condición, fatiga y frescura según la carga de cada sesión.',
      'Toca una sesión del historial para ver gráficas, parciales, esfuerzo y notas; desde ahí la compartes como imagen o la exportas a Strava.',
      'Con «Datos avanzados» (Ajustes › Apariencia) ves W/kg, carga, zonas técnicas y predicciones.',
    ],
  },
  {
    clave: 'ajustes', titulo: 'Tu perfil y ajustes', icono: 'i-ajustes', vista: 'ajustes',
    resumen: 'Tu perfil hace que calorías, zonas y planes sean tuyos.',
    puntos: [
      'Edad: pulso máximo y zonas. Sexo, peso y altura: calorías más exactas y FTP inicial.',
      'Experiencia, días y tiempo por sesión: el volumen y la duración de tu plan.',
      'Avisos por voz, pausa automática, calentamiento guiado y tema claro u oscuro.',
      'Guarda un respaldo de vez en cuando: tus sesiones solo viven en este teléfono.',
    ],
  },
];
export const tema = (clave) => TEMAS.find((t) => t.clave === clave) || null;

// Consejo de la primera visita a cada pestaña: el tema principal de esa pestaña.
export const CONSEJO_DE_VISTA = { entrenar: 'entrenar', entrenamientos: 'planes', heroe: 'heroe', historial: 'progreso', ajustes: 'ajustes' };
export const consejoDe = (vista) => tema(CONSEJO_DE_VISTA[vista]);
