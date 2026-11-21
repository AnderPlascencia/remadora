// Pulso: una sola definición de las zonas, con pulso de reserva (Karvonen) si conoces tu pulso en reposo,
// y el pulso máximo que de verdad has alcanzado en vez de una fórmula por edad. Sin dependencias.

// Zona 2 (fondo): del 60 al 70 % de tu reserva de pulso.
export const ZONA2 = { min: 60, max: 70 };
// Sin pulso en reposo se supone el de un adulto típico, el 30 % del máximo (57 lpm con 190). Así las zonas son las
// mismas en promedio con y sin él (la zona 2 queda en el 72–79 % del máximo) y no saltan unos 20 lpm al darlo.
export const REPOSO_SUPUESTO = 0.3;

// Referencia de pulso: un número (pulso máximo) o { max, reposo }.
export const refPulso = (x) => (x && typeof x === 'object' ? { max: x.max || 0, reposo: x.reposo || 0 } : { max: x || 0, reposo: 0 });
// El pulso en reposo solo vale si es creíble (30 lpm o más y al menos 40 por debajo del máximo).
export const usaReserva = (ref) => { const r = refPulso(ref); return r.max > 0 && r.reposo >= 30 && r.reposo <= r.max - 40; };

// Pulso en reposo con el que se calculan las zonas: el tuyo o el supuesto.
export const reposoZonas = (ref) => { const r = refPulso(ref); return usaReserva(r) ? r.reposo : r.max * REPOSO_SUPUESTO; };
// Pulso (lpm) para un % de la zona: reposo + % × (máximo − reposo) (Karvonen).
export function pulsoDePct(pct, ref) {
  const r = refPulso(ref);
  if (!r.max) return 0;
  const rep = reposoZonas(r);
  return Math.round(rep + ((r.max - rep) * pct) / 100);
}
// Al revés: qué % de la zona es un pulso.
export function pctDePulso(fc, ref) {
  const r = refPulso(ref);
  if (!fc || !r.max) return null;
  const rep = reposoZonas(r);
  return (100 * (fc - rep)) / (r.max - rep);
}
// Cuántos lpm se mueve la zona 2 de una referencia a otra (para avisar al escribir el pulso en reposo).
export const cambioZona2 = (antes, despues) => {
  const a = rangoZona2(antes);
  const d = rangoZona2(despues);
  return Math.max(Math.abs(a.min - d.min), Math.abs(a.max - d.max));
};
export const rangoZona2 = (ref) => ({ min: pulsoDePct(ZONA2.min, ref), max: pulsoDePct(ZONA2.max, ref) });

// Pulso máximo que usa la app y de dónde sale:
//  - 'manual': lo escribiste tú;
//  - 'observada': el más alto de tus sesiones (media de 5 s), en cuanto llega al 92 % de lo que da tu edad
//    (antes aún no has ido a tope y te dejaría zonas demasiado bajas);
//  - 'edad': 208 − 0,7 × edad (Tanaka), estimado; la de 220 − edad se queda corta pasados los 40.
// estimado: true si no sale de una medida tuya completa (la edad, o lo observado sin edad para contrastarlo).
export const fcMaxDeEdad = (edad) => (edad > 0 ? Math.round(208 - 0.7 * edad) : 0);
export function fcMaxEfectiva({ manual = 0, edad = 0, observada = 0 } = {}) {
  if (manual > 0) return { fcMax: manual, fuente: 'manual', estimado: false };
  const deEdad = fcMaxDeEdad(edad);
  if (observada > 0 && (!deEdad || observada >= deEdad * 0.92)) return { fcMax: observada, fuente: 'observada', estimado: !deEdad };
  if (deEdad) return { fcMax: deEdad, fuente: 'edad', estimado: true };
  return { fcMax: 0, fuente: '', estimado: true };
}
export const TEXTO_FUENTE_FC = {
  manual: 'Lo escribiste tú.',
  observada: 'El más alto que has alcanzado en tus sesiones (media de 5 s). Sube solo si un día llegas más arriba.',
  edad: 'Estimado con tu edad (208 − 0,7 × edad): puede fallar 10 lpm o más. Con una prueba a tope y el reloj puesto se mide el tuyo.',
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
