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
export const fcMax5De = (s) => s.fcMax5 ?? (s.muestras?.length ? fcMax5s(s.muestras) : s.res?.n ? s.res.fc5 : Math.max(0, Math.min(s.fcMax || 0, 230) - 2));
export const fcMaxDeHistorial = (sesiones) => Math.max(0, ...(sesiones || []).map(fcMax5De));

// ---------- Antes de remar: sueño y dolor ----------
export const PREGUNTAS_PREVIAS = {
  sueno: { texto: '¿Cómo dormiste?', opciones: [['bien', 'Bien'], ['regular', 'Regular'], ['mal', 'Mal']] },
  dolor: { texto: '¿Algún dolor o malestar?', opciones: [['no', 'No'], ['leve', 'Leve'], ['si', 'Sí']] },
};
// Etapa 27: con dolor o molestia se pregunta dónde, y cada zona trae su consejo.
export const ZONAS_DOLOR = [['espalda', 'Espalda baja'], ['rodillas', 'Rodillas'], ['hombros', 'Hombros o cuello'], ['munecas', 'Muñecas o manos'], ['costillas', 'Costillas'], ['otra', 'Otra']];
const CONSEJO_ZONA = {
  espalda: 'sin series ni cadencia alta, y con la espalda firme al final de la palada',
  rodillas: 'sin llegar del todo adelante: acorta la entrada',
  hombros: 'sin tirar de brazos: que empujen las piernas',
  munecas: 'con el agarre suelto y las muñecas planas',
  // E-4 (E15): la fractura por estrés de costilla es la lesión típica de quien sube volumen en remo.
  costillas: 'con menos volumen y menos resistencia. Si te duele al respirar hondo, consulta a un profesional',
};
const nombreZona = (z) => (ZONAS_DOLOR.find(([k]) => k === z)?.[1] || '').toLowerCase();
const DIA_MS = 864e5;
// Días con dolor o molestia de los últimos 7 (dolores: [{ dia: 'aaaa-mm-dd', dolor, zona }]), los de una zona si se da.
export function diasConDolor(dolores = [], hoy = new Date(), zona = null) {
  const desde = hoy.getTime() - 7 * DIA_MS;
  return (dolores || []).filter((d) => (d.dolor === 'leve' || d.dolor === 'si') && new Date(`${d.dia}T12:00`).getTime() > desde && (!zona || d.zona === zona));
}
// E-4 (E15): molestia de espalda baja 2 días o más en una semana. Hasta 7 días después de la última, nada de fuerza
// a cadencia baja, sprints con resistencia alta ni la Furia del berserker. Devuelve el día en que se levanta
// ('aaaa-mm-dd') o null.
export function espaldaCargadaHasta(dolores = [], hoy = new Date()) {
  const dias = (dolores || []).filter((d) => (d.dolor === 'leve' || d.dolor === 'si') && d.zona === 'espalda').map((d) => d.dia).sort();
  const ult = dias.at(-1);
  if (!ult) return null;
  const t = new Date(`${ult}T12:00`).getTime();
  if (t <= hoy.getTime() - 7 * DIA_MS || dias.filter((d) => new Date(`${d}T12:00`).getTime() > t - 7 * DIA_MS).length < 2) return null;
  const fin = new Date(t + 7 * DIA_MS);
  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`;
}
// Qué cambia según tus respuestas de hoy: el estado mínimo del cuerpo y por qué (null si nada).
// Dolor o enfermedad mandan sobre todo lo demás: no se entrena fuerte enfermo ni con dolor.
// resp.dolores: las respuestas de los últimos días; dos o más días con molestia en la misma zona dejan la semana suave.
export function efectoPrevio(resp, hoy = new Date()) {
  if (!resp) return null;
  const zona = resp.zona && resp.zona !== 'otra' ? resp.zona : null;
  const consejo = zona ? `: rema ${CONSEJO_ZONA[zona]}` : '';
  if (resp.dolor === 'si') return { clave: 'agotado', motivo: `Con dolor o malestar${zona ? ` en ${nombreZona(zona)}` : ''}, hoy descansa` };
  if (resp.dolor === 'leve') {
    const repetido = diasConDolor(resp.dolores, hoy, resp.zona || null).length >= 2;
    return { clave: 'cargado', repetido, motivo: repetido
      ? `Molestia en ${nombreZona(resp.zona) || 'el mismo sitio'} varios días esta semana: suave hasta que pase${consejo}. Si va a más o no se va en una semana, consulta a un profesional`
      : `Con una molestia leve, hoy suave (y para si va a más)${consejo}` };
  }
  // Sin responder hoy, pero con molestias en la misma zona 2 días de esta semana: aún sin duras (si hoy dices que
  // no te duele, manda tu respuesta).
  const zonas = new Map();
  for (const d of diasConDolor(resp.dolores, hoy)) zonas.set(d.zona || '', (zonas.get(d.zona || '') || 0) + 1);
  const [zRep] = [...zonas].find(([, n]) => n >= 2) || [];
  if (zRep != null && resp.dolor !== 'no') return { clave: 'cargado', repetido: true, motivo: `Tuviste molestias${zRep ? ` en ${nombreZona(zRep)}` : ''} 2 días o más esta semana: hoy mejor sin sesiones duras. Si ya no sientes nada, dilo en «Antes de remar»` };
  if (resp.sueno === 'mal') return { clave: 'cargado', motivo: 'Dormiste mal: hoy suave, la dura rinde más descansado' };
  return null;
}
