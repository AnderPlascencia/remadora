// Lo que dice la imagen para compartir (etapa 15): un dato protagonista según el tipo de sesión, una línea honesta
// de cómo fue («✓ Completado» o «18 de 25 min») y pocos datos más. Sin DOM: lo pinta efectos.js (tarjetaSesion).
import { formatoSplit, formatoTiempo } from './protocolo.js';
import { mejorPotencia } from './estadisticas.js';

export const FORMATOS = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080] };
export const FORMATO_DEFECTO = '4:5';
// El pulso y las calorías son tuyos: apagados hasta que decidas enseñarlos. El héroe sí sale.
export const OPCIONES_DEFECTO = Object.freeze({ formato: FORMATO_DEFECTO, pulso: false, kcal: false, heroe: true });

const DIA = 864e5;
const miles = (n) => Math.round(n || 0).toLocaleString('es-MX');
const km = (m) => `${(m / 1000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
const claveDia = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lunesMs = (k) => { const d = new Date(`${k}T12:00`); return d.getTime() - ((d.getDay() + 6) % 7) * DIA; };

// Minutos planeados: la suma de los bloques (los hechos con lo que duraron y los que faltaban, estimados).
export function minutosPlan(s) {
  const seg = (s?.bloques || []).reduce((a, b) => a + (b.duracion || 0), 0);
  return seg > 0 ? Math.round(seg / 60) : null;
}

// Cómo fue, sin adornos. null si era remo libre (no había nada que completar).
export function estadoSesion(s) {
  if (!s?.entrenamiento) return null;
  const hecho = s.tiempoMeta != null;
  const min = Math.round((s.duracion || 0) / 60);
  if (s.versionCorta) return { texto: hecho ? `✓ Versión corta de ${s.versionCorta} min` : `${min} de ${s.versionCorta} min · versión corta`, completo: hecho };
  if (hecho) return { texto: '✓ Completado', completo: true };
  const plan = minutosPlan(s);
  return { texto: plan && plan > min ? `${min} de ${plan} min` : 'Sin terminar', completo: false };
}

// «Semana 2 de 6 · sesión 3» si la sesión era del plan. programa = { dias: [{ fecha, ent }] }.
export function semanaDelPlan(programa, fecha) {
  const dias = programa?.dias || [];
  if (!dias.length || !fecha) return null;
  const k = claveDia(fecha);
  const inicio = lunesMs(dias[0].fecha);
  if (k < dias[0].fecha || k > dias.at(-1).fecha) return null;
  const semana = Math.floor((lunesMs(k) - inicio) / (7 * DIA) + 0.5) + 1;
  const total = Math.floor((lunesMs(dias.at(-1).fecha) - inicio) / (7 * DIA) + 0.5) + 1;
  const deLaSemana = dias.filter((d) => d.ent && lunesMs(d.fecha) === lunesMs(k));
  const n = deLaSemana.filter((d) => d.fecha <= k).length;
  return `Semana ${semana} de ${total}${n ? ` · sesión ${Math.min(n, deLaSemana.length)} de ${deLaSemana.length}` : ''}`;
}

const valorRecord = (r) => (r.tipo === 'tiempo' ? formatoTiempo(r.valor) : r.unidad === 'm' ? km(r.valor) : `${miles(r.valor)} ${r.unidad}`);
const esIntervalos = (s) => (s.bloques || []).length > 1 && s.pctEnRango != null;
const esPrueba2k = (s) => s.tipoPlan === 'prueba' && s.distancia >= 1990 && s.distancia <= 2100;

// El dato que manda en la imagen: un récord, el tiempo de la prueba, lo bien que seguiste los intervalos o la distancia.
export function protagonista(s, records = []) {
  const r = records.find((x) => x.clave === 't2000') || records[0];
  if (r) return { clave: `record:${r.clave}`, etq: `Récord · ${r.nombre}`, valor: valorRecord(r) };
  if (esPrueba2k(s)) return { clave: 'tiempo', etq: 'Prueba de 2000 m', valor: formatoTiempo(s.duracion) };
  if (s.tipoPlan === 'prueba') return { clave: 'watts', etq: 'Prueba · watts promedio', valor: `${miles(s.wattsProm)} W` };
  if (esIntervalos(s)) return { clave: 'rango', etq: 'Tiempo en tu rango', valor: `${s.pctEnRango} %` };
  return { clave: 'distancia', etq: 'Distancia', valor: s.distancia >= 1000 ? km(s.distancia) : `${miles(s.distancia)} m` };
}

// Todo lo que va en la tarjeta. opciones: { pulso, kcal, heroe } · ctx: { records, semanaPlan, heroe, extra }.
export function contenidoTarjeta(s, opciones = {}, ctx = {}) {
  const o = { ...OPCIONES_DEFECTO, ...opciones };
  const prota = protagonista(s, ctx.records || []);
  const mejorMin = esIntervalos(s) && s.muestras?.length ? mejorPotencia(s.muestras, 60) : null;
  const pool = [
    ['distancia', 'Distancia', s.distancia >= 1000 ? km(s.distancia) : `${miles(s.distancia)} m`],
    ['tiempo', 'Tiempo', formatoTiempo(s.duracion)],
    ['split', 'Split /500 m', formatoSplit(s.splitProm)],
    ...(mejorMin ? [['mejorMin', 'Mejor minuto', `${miles(mejorMin)} W`]] : []),
    ['watts', 'Watts prom', `${miles(s.wattsProm)} W`],
    ['spm', 'Golpes/min', String(s.spmProm ?? '--')],
  ].filter(([k]) => k !== prota.clave);
  // Lo segundo que se mira: el split en la prueba de 2000 m y el mejor minuto en los intervalos.
  const segundo = { tiempo: 'split', rango: 'mejorMin' }[prota.clave];
  if (segundo) pool.sort((a, b) => (b[0] === segundo) - (a[0] === segundo));
  const secundarios = pool.slice(0, 3).map(([, etq, valor]) => [etq, valor]);
  if (o.pulso && s.fcProm) secundarios.push(['Pulso prom', `${s.fcProm} lpm`]);
  if (o.kcal && s.kcal) secundarios.push(['Calorías', `${miles(s.kcal)} kcal`]);
  return {
    titulo: s.entrenamiento || 'Remo libre',
    estado: estadoSesion(s),
    semanaPlan: ctx.semanaPlan || null,
    protagonista: { etq: prota.etq, valor: prota.valor },
    secundarios,
    extra: ctx.extra || '',
    heroe: o.heroe ? ctx.heroe || null : null,
  };
}
