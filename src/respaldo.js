// Respaldo en archivo: qué se guarda y cómo se combina al restaurar, sin tocar la pantalla ni la base de datos.
//
// Formatos:
//   1 (sin campo «formato», hasta la v0.48): los ajustes como el texto de localStorage ('75', '1', '{"clase":…}').
//   2: «formato»: 2 y cada ajuste con su tipo (75, true, { clase: … }), según ajustes-guardados.js.
// Un respaldo viejo se convierte al formato actual antes de restaurarlo.
import { CLAVES_RESPALDO, aTexto, aTipo } from './ajustes-guardados.js';

export const FORMATO = 2;
export const CLAVES_AJUSTES = CLAVES_RESPALDO;
// Ajustes del perfil: si el respaldo trae otros, se pregunta antes de reemplazarlos.
const CLAVES_PERFIL = ['peso', 'ftp', 'edad', 'fcMax', 'metaSemana', 'sexo', 'altura', 'experiencia', 'diasSemana', 'minutosSesion'];

// leer(clave) devuelve el ajuste guardado como texto, o null si no existe.
export function armarRespaldo({ version, sesiones, entrenamientos, programa, leer, fecha = new Date() }) {
  return {
    app: 'remadora',
    formato: FORMATO,
    version,
    fecha: fecha.toISOString(),
    sesiones,
    entrenamientos,
    programa,
    ajustes: Object.fromEntries(CLAVES_AJUSTES.map((k) => [k, aTipo(k, leer(k))]).filter(([, v]) => v !== undefined)),
  };
}

export function esRespaldo(datos) {
  return datos?.app === 'remadora' && Array.isArray(datos.sesiones);
}

// Lleva un respaldo al formato actual. Devuelve { datos } o { error } si es de una versión más nueva de la app.
export function convertir(datos) {
  const formato = datos.formato ?? 1;
  if (!Number.isInteger(formato) || formato < 1) return { error: 'formato desconocido' };
  if (formato > FORMATO) return { error: 'nuevo' };
  let d = datos;
  if (formato < 2) {
    const ajustes = Object.fromEntries(Object.entries(d.ajustes || {})
      .map(([k, v]) => [k, aTipo(k, v)]).filter(([, v]) => v !== undefined));
    d = { ...d, formato: 2, ajustes };
  }
  return { datos: d };
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);

// Por qué una sesión del respaldo no se puede guardar (null si está bien). Se mira lo que usan el historial,
// los récords y el héroe: fecha, duración, distancia y muestras.
export function validarSesion(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'no es una sesión';
  if (!num(s.fecha) || s.fecha <= 0) return 'sin fecha';
  if (!num(s.duracion) || s.duracion < 0) return 'sin duración';
  if (!num(s.distancia) || s.distancia < 0) return 'sin distancia';
  if (s.entrenamiento != null && typeof s.entrenamiento !== 'string') return 'entrenamiento no válido';
  if (s.notas != null && typeof s.notas !== 'string') return 'notas no válidas';
  if (s.muestras != null) {
    if (!Array.isArray(s.muestras)) return 'muestras no válidas';
    for (const m of s.muestras) {
      if (!m || typeof m !== 'object' || !num(m.t)) return 'muestras no válidas';
      for (const k of ['w', 'spm', 'dist', 'fc', 'split']) if (m[k] != null && !num(m[k])) return 'muestras no válidas';
    }
  }
  return null;
}

// Qué traer de un respaldo (ya convertido) sin duplicar: sesiones por fecha de inicio y entrenamientos por
// nombre (sin su id, que lo pone la base de datos). `distintos` lista lo que ya existe y es otro, para preguntar
// antes de reemplazar; `invalidas` cuenta las sesiones dañadas que no se traen. Los ajustes salen como texto.
export function planRestaurar(datos, { sesiones, entrenamientos, programa, leer }) {
  const fechas = new Set(sesiones.map((s) => s.fecha));
  const nombres = new Set(entrenamientos.map((e) => e.nombre));
  const sinId = ({ id, ...resto }) => resto;
  const validas = datos.sesiones.filter((s) => validarSesion(s) == null);
  const sesionesNuevas = validas.filter((s) => !fechas.has(s.fecha)).map(sinId);
  const entNuevos = (Array.isArray(datos.entrenamientos) ? datos.entrenamientos : [])
    .filter((e) => e && typeof e.nombre === 'string' && !nombres.has(e.nombre)).map(sinId);
  const ajustesResp = Object.entries(datos.ajustes || {}).filter(([k]) => CLAVES_AJUSTES.includes(k))
    .map(([k, v]) => [k, aTexto(k, v)]).filter(([, v]) => v !== undefined);
  const cambia = (k, v) => leer(k) != null && leer(k) !== v;
  const distintos = [];
  if (datos.programa && programa && JSON.stringify(programa) !== JSON.stringify(datos.programa)) distintos.push('el plan');
  if (ajustesResp.some(([k, v]) => k === 'personaje' && cambia(k, v))) distintos.push('el héroe');
  if (ajustesResp.some(([k, v]) => CLAVES_PERFIL.includes(k) && cambia(k, v))) distintos.push('tus ajustes');
  return { sesionesNuevas, entNuevos, ajustesResp, distintos, invalidas: datos.sesiones.length - validas.length };
}

// «el plan, el héroe y tus ajustes»
export function listaHumana(cosas) {
  return cosas.join(', ').replace(/, ([^,]*)$/, ' y $1');
}
