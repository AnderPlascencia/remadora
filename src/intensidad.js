// Límites del entrenador para los talentos (y, en la etapa 5, las habilidades) de intensidad en carrera.
// Revisión del 10 nov 2026: la carga casi no ve los acelerones cortos, así que el límite va por activaciones,
// no por carga. Se apagan con el cuerpo cargado o agotado, con 12 h o más de recuperación pendiente, en una prueba
// y cuando ya llevas 2 sesiones duras (o con intensidad) en la semana. Las primeras 4 semanas, 1 activación.
import { tipoSesion } from './capacidades.js';
import { diasDeHistorial, DIAS_PARA_RATIO } from './estadisticas.js';

export const TIPOS_DUROS = new Set(['umbral', 'vo2', 'sprint', 'prueba']);
export const MAX_SEMANA_INTENSIDAD = 2;
export const HORAS_RECUPERACION_MAX = 12;
// Sub-tope de metros de los talentos de intensidad en una carrera (dentro de los 40 m de los talentos).
export const SUBTOPE_INTENSIDAD_M = 15;
// Remar fuerte en frío es el riesgo más claro: sin calentar, nada de intensidad en los primeros 5 min.
export const CALENTAR_SEG = 300;
const VENTANA_CALENTAR = 60 * 60e3;

function lunesDe(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// ¿Vienes de calentar? Al menos 5 min remados en la última hora (sesiones ya guardadas).
export function vieneCalentado(sesiones, ahora = Date.now()) {
  return (sesiones || []).some((s) => s.fecha < ahora && s.fecha + (s.duracion || 0) * 1000 >= ahora - VENTANA_CALENTAR && (s.duracion || 0) >= CALENTAR_SEG);
}

// Sesiones de esta semana (desde el lunes) que fueron duras o usaron un talento de intensidad.
export function sesionesIntensasSemana(sesiones, ftp, ahora = Date.now()) {
  const lunes = lunesDe(ahora);
  return (sesiones || []).filter((s) => s.fecha >= lunes && s.fecha < ahora && (s.intensidad || TIPOS_DUROS.has(tipoSesion(s, s.ftp || ftp)))).length;
}

// Permiso para la intensidad en la carrera que empieza. cuerpo = estadoCuerpo() de hoy (o null).
// Devuelve { activa, motivo, maxActivaciones (null = sin límite propio), calentado }.
export function permisoIntensidad({ sesiones = [], ftp = 0, cuerpo = null, prueba = false, ahora = Date.now() } = {}) {
  const calentado = vieneCalentado(sesiones, ahora);
  const maxActivaciones = diasDeHistorial(sesiones, ahora) < DIAS_PARA_RATIO ? 1 : null;
  const no = (motivo) => ({ activa: false, motivo, maxActivaciones, calentado });
  if (prueba) return no('prueba');
  if (cuerpo && (cuerpo.clave === 'cargado' || cuerpo.clave === 'agotado')) return no('cuerpo');
  if ((cuerpo?.horas || 0) >= HORAS_RECUPERACION_MAX) return no('recuperacion');
  if (sesionesIntensasSemana(sesiones, ftp, ahora) >= MAX_SEMANA_INTENSIDAD) return no('semana');
  return { activa: true, motivo: null, maxActivaciones, calentado };
}

// Frase de la voz cuando la intensidad está apagada (una vez por carrera).
export const FRASE_SIN_INTENSIDAD = 'Hoy tu furia descansa: rema y suma con la constancia.';
