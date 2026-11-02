// Respaldo en archivo: qué se guarda y cómo se combina al restaurar, sin tocar la pantalla ni la base de datos.

export const CLAVES_AJUSTES = ['peso', 'ftp', 'ftpEstimado', 'ftpDePerfil', 'edad', 'sexo', 'altura', 'experiencia', 'diasSemana', 'minutosSesion', 'fcMax', 'fcMaxDeEdad', 'libreFantasmas', 'inicioHecho', 'metaSemana', 'voz', 'modoAuto', 'pausaAuto', 'resAuto', 'atrVivo', 'vistaRemo', 'variante', 'tema', 'guiado', 'ritmoObjetivo', 'personaje', 'avanzado'];
// Ajustes del perfil: si el respaldo trae otros, se pregunta antes de reemplazarlos.
const CLAVES_PERFIL = ['peso', 'ftp', 'edad', 'fcMax', 'metaSemana', 'sexo', 'altura', 'experiencia', 'diasSemana', 'minutosSesion'];

// leer(clave) devuelve el ajuste guardado como texto, o null si no existe.
export function armarRespaldo({ version, sesiones, entrenamientos, programa, leer, fecha = new Date() }) {
  return {
    app: 'remadora',
    version,
    fecha: fecha.toISOString(),
    sesiones,
    entrenamientos,
    programa,
    ajustes: Object.fromEntries(CLAVES_AJUSTES.map((k) => [k, leer(k)]).filter(([, v]) => v != null)),
  };
}

export function esRespaldo(datos) {
  return datos?.app === 'remadora' && Array.isArray(datos.sesiones);
}

// Qué traer de un respaldo sin duplicar: sesiones por fecha de inicio y entrenamientos por nombre (sin su id,
// que lo pone la base de datos). `distintos` lista lo que ya existe y es otro, para preguntar antes de reemplazar.
export function planRestaurar(datos, { sesiones, entrenamientos, programa, leer }) {
  const fechas = new Set(sesiones.map((s) => s.fecha));
  const nombres = new Set(entrenamientos.map((e) => e.nombre));
  const sinId = ({ id, ...resto }) => resto;
  const sesionesNuevas = datos.sesiones.filter((s) => !fechas.has(s.fecha)).map(sinId);
  const entNuevos = (datos.entrenamientos || []).filter((e) => !nombres.has(e.nombre)).map(sinId);
  const ajustesResp = Object.entries(datos.ajustes || {}).filter(([k]) => CLAVES_AJUSTES.includes(k));
  const cambia = (k, v) => leer(k) != null && leer(k) !== String(v);
  const distintos = [];
  if (datos.programa && programa && JSON.stringify(programa) !== JSON.stringify(datos.programa)) distintos.push('el plan');
  if (ajustesResp.some(([k, v]) => k === 'personaje' && cambia(k, v))) distintos.push('el héroe');
  if (ajustesResp.some(([k, v]) => CLAVES_PERFIL.includes(k) && cambia(k, v))) distintos.push('tus ajustes');
  return { sesionesNuevas, entNuevos, ajustesResp, distintos };
}

// «el plan, el héroe y tus ajustes»
export function listaHumana(cosas) {
  return cosas.join(', ').replace(/, ([^,]*)$/, ' y $1');
}
