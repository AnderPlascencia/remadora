// Pulso: una sola definición de las zonas, con pulso de reserva (Karvonen) si conoces tu pulso en reposo,
// y el pulso máximo que de verdad has alcanzado en vez de la fórmula 220 − edad. Sin dependencias.

// Zona 2 (fondo): del 60 al 70 % de tu reserva de pulso, o de tu pulso máximo si no hay pulso en reposo.
export const ZONA2 = { min: 60, max: 70 };

// Referencia de pulso: un número (pulso máximo) o { max, reposo }.
export const refPulso = (x) => (x && typeof x === 'object' ? { max: x.max || 0, reposo: x.reposo || 0 } : { max: x || 0, reposo: 0 });
// El pulso en reposo solo vale si es creíble (30 lpm o más y al menos 40 por debajo del máximo).
export const usaReserva = (ref) => { const r = refPulso(ref); return r.max > 0 && r.reposo >= 30 && r.reposo <= r.max - 40; };

// Pulso (lpm) para un % de la zona: reposo + % × (máximo − reposo), o % × máximo.
export function pulsoDePct(pct, ref) {
  const r = refPulso(ref);
  if (!r.max) return 0;
  return Math.round(usaReserva(r) ? r.reposo + ((r.max - r.reposo) * pct) / 100 : (r.max * pct) / 100);
}
// Al revés: qué % de la zona es un pulso.
export function pctDePulso(fc, ref) {
  const r = refPulso(ref);
  if (!fc || !r.max) return null;
  return usaReserva(r) ? (100 * (fc - r.reposo)) / (r.max - r.reposo) : (100 * fc) / r.max;
}
export const rangoZona2 = (ref) => ({ min: pulsoDePct(ZONA2.min, ref), max: pulsoDePct(ZONA2.max, ref) });

// Pulso máximo que usa la app y de dónde sale:
//  - 'manual': lo escribiste tú;
//  - 'observada': el más alto de tus sesiones (media de 5 s), en cuanto llega al 92 % de lo que da tu edad
//    (antes aún no has ido a tope y te dejaría zonas demasiado bajas);
//  - 'edad': 220 − edad, estimado.
// estimado: true si no sale de una medida tuya completa (la edad, o lo observado sin edad para contrastarlo).
export function fcMaxEfectiva({ manual = 0, edad = 0, observada = 0 } = {}) {
  if (manual > 0) return { fcMax: manual, fuente: 'manual', estimado: false };
  const deEdad = edad > 0 ? 220 - edad : 0;
  if (observada > 0 && (!deEdad || observada >= deEdad * 0.92)) return { fcMax: observada, fuente: 'observada', estimado: !deEdad };
  if (deEdad) return { fcMax: deEdad, fuente: 'edad', estimado: true };
  return { fcMax: 0, fuente: '', estimado: true };
}
export const TEXTO_FUENTE_FC = {
  manual: 'Lo escribiste tú.',
  observada: 'El más alto que has alcanzado en tus sesiones (media de 5 s). Sube solo si un día llegas más arriba.',
  edad: 'Estimado con tu edad (220 − edad): puede fallar 10 lpm o más. Con una prueba a tope y el reloj puesto se mide el tuyo.',
};

// Pulso máximo de una sesión: la mejor media de 5 s seguidos. Ignora lecturas imposibles y los picos sueltos
// (un segundo a más de 20 lpm de los dos de al lado), que dejan esa ventana sin contar.
export function fcMax5s(muestras) {
  const v = (muestras || []).map((x) => (x.fc > 0 && x.fc <= 230 ? x.fc : 0));
  const fcs = v.map((fc, i) => {
    const lejos = (o) => !o || Math.abs(fc - o) > 20;
    return fc && (i === 0 || i === v.length - 1 || !(lejos(v[i - 1]) && lejos(v[i + 1]))) ? fc : 0;
  });
  let mejor = 0;
  let suma = 0;
  let validos = 0;
  for (let i = 0; i < fcs.length; i++) {
    suma += fcs[i];
    if (fcs[i]) validos++;
    if (i >= 5) { suma -= fcs[i - 5]; if (fcs[i - 5]) validos--; }
    if (i >= 4 && validos === 5) mejor = Math.max(mejor, suma / 5);
  }
  return mejor ? Math.round(mejor) : 0;
}
// El más alto de todo el historial (usa el guardado en cada sesión; si no está, lo calcula de sus muestras).
// Las sesiones de antes de la v0.51 sin muestras a mano usan su pico menos 2 lpm (un pico suelto suele pasarse).
export const fcMax5De = (s) => s.fcMax5 ?? (s.muestras?.length ? fcMax5s(s.muestras) : Math.max(0, Math.min(s.fcMax || 0, 230) - 2));
export const fcMaxDeHistorial = (sesiones) => Math.max(0, ...(sesiones || []).map(fcMax5De));

// ---------- Antes de remar: sueño y dolor ----------
export const PREGUNTAS_PREVIAS = {
  sueno: { texto: '¿Cómo dormiste?', opciones: [['bien', 'Bien'], ['regular', 'Regular'], ['mal', 'Mal']] },
  dolor: { texto: '¿Algún dolor o malestar?', opciones: [['no', 'No'], ['leve', 'Leve'], ['si', 'Sí']] },
};
// Qué cambia según tus respuestas de hoy: el estado mínimo del cuerpo y por qué (null si nada).
// Dolor o enfermedad mandan sobre todo lo demás: no se entrena fuerte enfermo ni con dolor.
export function efectoPrevio(resp) {
  if (!resp) return null;
  if (resp.dolor === 'si') return { clave: 'agotado', motivo: 'Con dolor o malestar, hoy descansa' };
  if (resp.dolor === 'leve') return { clave: 'cargado', motivo: 'Con una molestia leve, hoy suave (y para si va a más)' };
  if (resp.sueno === 'mal') return { clave: 'cargado', motivo: 'Dormiste mal: hoy suave, la dura rinde más descansado' };
  return null;
}
