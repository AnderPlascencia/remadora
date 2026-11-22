// Lo que dice la imagen para compartir (etapas 15 y 30). Quien no rema no sabe si 226 W es mucho: la tarjeta dice
// qué tan fuerte fue (en palabras), contra qué se compara (su marca, su plan, el mes) y si lo cumplió. Un dato
// protagonista según el tipo de sesión, una línea de contexto y pocos datos más. En tercera persona: la ven otros.
// Sin DOM: lo pinta tarjeta-imagen.js. Las dos se cargan al abrir «Compartir imagen».
import { formatoSplit, formatoTiempo } from './protocolo.js';
import { factorIntensidad, mejorPotencia, parciales, resumenIntervalos, rpeSentido, wattsFiables } from './estadisticas.js';
import { esBloqueTrabajo, rangoWatts } from './entrenamientos.js';
import { tipoSesion } from './capacidades.js';

export const FORMATOS = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080] };
export const FORMATO_DEFECTO = '4:5';
// El pulso y las calorías son tuyos: apagados hasta que decidas enseñarlos. El héroe sí sale.
export const OPCIONES_DEFECTO = Object.freeze({ formato: FORMATO_DEFECTO, pulso: false, kcal: false, heroe: true });

const DIA = 864e5;
const miles = (n) => Math.round(n || 0).toLocaleString('es-MX');
const kmNum = (m) => (m / 1000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const km = (m) => `${kmNum(m)} km`;
const minutos = (seg) => Math.round((seg || 0) / 60);
const claveDia = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lunesMs = (k) => { const d = new Date(`${k}T12:00`); return d.getTime() - ((d.getDay() + 6) % 7) * DIA; };
// «6 s», «1:04»: una diferencia de tiempo corta.
const difTiempo = (seg) => (seg >= 60 ? formatoTiempo(seg) : `${Math.round(seg)} s`);
const duracionSerie = (seg) => (seg >= 60 && seg % 60 === 0 ? `${seg / 60} min` : seg >= 60 ? `${(seg / 60).toLocaleString('es-MX', { maximumFractionDigits: 1 })} min` : `${seg} s`);

// Minutos planeados: la suma de los bloques (los hechos con lo que duraron y los que faltaban, estimados).
export function minutosPlan(s) {
  const seg = (s?.bloques || []).reduce((a, b) => a + (b.duracion || 0), 0);
  return seg > 0 ? Math.round(seg / 60) : null;
}

// Cómo fue, sin adornos. null si era remo libre (no había nada que completar).
export function estadoSesion(s) {
  if (!s?.entrenamiento) return null;
  const hecho = s.tiempoMeta != null;
  const min = minutos(s.duracion);
  if (s.versionCorta) return { texto: hecho ? `✓ Versión corta de ${s.versionCorta} min` : `${min} de ${s.versionCorta} min · versión corta`, completo: hecho };
  if (hecho) return { texto: '✓ Completado', completo: true };
  const plan = minutosPlan(s);
  return { texto: plan && plan > min ? `${min} de ${plan} min` : 'Sin terminar', completo: false };
}

// «Semana 2 de 6 · sesión 3 de 3» si la sesión era del plan. programa = { dias: [{ fecha, ent }] }.
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

// Qué tan fuerte fue, en una palabra de un medidor de 5 (las fronteras de BANDAS_REMO). Con FTP y watts fiables,
// por el factor de intensidad; si no, por el esfuerzo que marcó el remero. Sin ninguno, null (no se pone).
export const PALABRAS_INTENSIDAD = ['Suave', 'Firme', 'Fuerte', 'Muy fuerte', 'A tope'];
const esPrueba = (s) => s.tipoPlan === 'prueba' || !!s.pruebaWatts || /^prueba/i.test(s.entrenamiento || '');
export function intensidad(s, ftp = 0) {
  let nivel = null;
  if (esPrueba(s) && s.tiempoMeta != null) nivel = 5;
  else {
    const f = s.ftp || ftp;
    const fi = f && wattsFiables(s) ? factorIntensidad(s.muestras, f) : null;
    if (fi != null) nivel = fi < 0.76 ? 1 : fi < 0.88 ? 2 : fi <= 1 ? 3 : fi <= 1.15 ? 4 : 5;
    else {
      const r = rpeSentido(s);
      if (r) nivel = r <= 3 ? 1 : r <= 5 ? 2 : r <= 7 ? 3 : r <= 8 ? 4 : 5;
    }
  }
  return nivel ? { nivel, palabra: PALABRAS_INTENSIDAD[nivel - 1] } : null;
}

// Qué clase de tarjeta toca: decide el dato grande y la línea de contexto.
export function tipoTarjeta(s, ftp = 0) {
  const est = estadoSesion(s);
  if (est && !est.completo) return 'cortada';
  if (s.pruebaWatts > 0) return 'ftp';
  if (esPrueba(s)) return 'prueba';
  const f = s.ftp || ftp;
  const t = s.tipoPlan || (s.muestras?.length ? tipoSesion(s, f) : 'fondo');
  if (t === 'vo2' && f && wattsFiables(s)) return 'vo2';
  if ((s.bloques || []).filter(esBloqueTrabajo).length > 1 && s.pctEnRango != null) return 'intervalos';
  if (t === 'tecnica' && s.spmProm > 0 && s.duracion > 0) return 'tecnica';
  return 'fondo';
}

const valorRecord = (r, v = r.valor) => (r.tipo === 'tiempo' ? formatoTiempo(v) : r.unidad === 'm' ? km(v) : `${miles(v)} ${r.unidad}`);
const sinWmax = (records) => (records || []).filter((r) => r.clave !== 'wmax');
// La distancia de una prueba, redondeada a la que se buscaba (2000 m, 5000 m…).
const distPrueba = (s) => Math.round((s.distancia || 0) / 100) * 100;
const claveDist = { 500: 't500', 2000: 't2000', 5000: 't5000' };
const distanciaGrande = (m) => (m >= 1000 ? { valor: kmNum(m), unidad: 'km' } : { valor: miles(m), unidad: 'm' });
const mismoMes = (a, b) => { const x = new Date(a); const y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth(); };
const metrosPorPalada = (s) => (s.spmProm > 0 && s.duracion > 0 ? s.distancia / ((s.spmProm * s.duracion) / 60) : null);
const series = (s) => resumenIntervalos(s).filter((f) => esBloqueTrabajo(f.bloque));
// Cuántas series acabaron dentro de su rango (80 % de sus segundos o más). Si la sesión no lo juzgó, se mira con
// los watts del rango (metas en watts o en % de FTP). → { dentro, total } o null.
function seriesEnRango(s, f) {
  const juzgadas = series(s).filter((x) => x.pctRango != null);
  if (juzgadas.length) return { dentro: juzgadas.filter((x) => x.pctRango >= 80).length, total: juzgadas.length };
  const pcts = [];
  let desde = 0;
  for (const b of s.bloques || []) {
    const r = esBloqueTrabajo(b) ? rangoWatts(b, f) : null;
    const tramo = r ? (s.muestras || []).filter((x) => x.t > desde && x.t <= desde + b.duracion) : [];
    if (tramo.length) pcts.push(tramo.filter((x) => x.w >= r.min && x.w <= r.max).length / tramo.length);
    desde += b.duracion || 0;
  }
  return pcts.length ? { dentro: pcts.filter((x) => x >= 0.8).length, total: pcts.length } : null;
}

// «6 series de 3 min» o null si no hay series.
function textoSeries(fs, umbral) {
  if (!fs.length) return null;
  const d = fs[0].bloque?.duracion;
  const iguales = d && fs.every((f) => f.bloque?.duracion === d);
  return `${fs.length} series${iguales ? ` de ${duracionSerie(d)}` : ''}${umbral ? ' al ritmo máximo que aguantaría una hora' : ''}`;
}

// El dato grande y la frase que lo explica. ctx: { ftp, records, marcas (sus mejores marcas antes), meta, previas }.
export function protagonista(s, ctx = {}) {
  const tipo = tipoTarjeta(s, ctx.ftp);
  const f = s.ftp || ctx.ftp || 0;
  const min = minutos(s.duracion);
  const records = sinWmax(ctx.records);
  const previas = (ctx.previas || []).filter((p) => p.fecha < s.fecha);
  const corta = (s.duracion || 0) < 300; // menos de 5 min: solo tiempo y distancia, sin contexto
  const p = { tipo, valor: '', unidad: '', antes: null, delta: null, kicker: null, etq: '', de: '', parcial: null, blanco: false, contexto: '' };

  if (tipo === 'cortada') {
    const plan = s.versionCorta || minutosPlan(s);
    Object.assign(p, { valor: String(min), unidad: 'min', de: 'remados', blanco: true, parcial: plan ? Math.min(1, min / plan) : null });
    const t = s.tipoPlan || tipoSesion(s, f);
    if (!corta) p.contexto = t === 'fondo' && (intensidad(s, f)?.nivel || 9) <= 2 ? `${min} min de fondo a ritmo de conversación` : `${km(s.distancia)} en ${min} min`;
    return p;
  }

  if (tipo === 'ftp') {
    const nuevo = Math.round(s.pruebaWatts * 0.95);
    const antes = s.ftp || ctx.ftp || 0;
    Object.assign(p, { valor: miles(nuevo), unidad: 'W', etq: 'su ritmo máximo para una hora (FTP)' });
    if (antes && antes !== nuevo) {
      const pct = Math.round((nuevo / antes - 1) * 100);
      Object.assign(p, { antes: miles(antes), delta: `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`, kicker: nuevo > antes ? 'NUEVO FTP' : null });
      p.contexto = pct > 0 ? `Su ritmo máximo para una hora subió ${pct} %: todo el plan se ajusta a este número` : 'Todo el plan se ajusta a este número';
    } else p.contexto = 'Todo el plan se ajusta a este número';
    return p;
  }

  if (tipo === 'prueba') {
    const d = distPrueba(s);
    const r = records.find((x) => x.clave === claveDist[d]);
    const tiempo = r?.valor ?? s.duracion;
    Object.assign(p, { valor: formatoTiempo(tiempo) });
    const partes = [];
    if (r) {
      p.kicker = r.anterior != null ? 'RÉCORD PERSONAL' : 'PRIMERA MARCA';
      if (r.anterior != null) {
        p.antes = formatoTiempo(r.anterior);
        p.delta = `−${difTiempo(r.anterior - r.valor)}`;
        partes.push(`${difTiempo(r.anterior - r.valor)} menos que su mejor marca`);
      }
    } else {
      const mejor = ctx.marcas?.[claveDist[d]]?.valor;
      if (mejor && mejor < tiempo) partes.push(`a ${difTiempo(tiempo - mejor)} de su mejor marca`);
    }
    const meta = ctx.meta;
    if (meta?.segundos && Math.abs((meta.distancia || 0) - d) < 50) {
      const falta = tiempo - meta.segundos;
      partes.push(falta > 0 ? `a ${difTiempo(falta)} de su meta de ${formatoTiempo(meta.segundos)}` : `meta de ${formatoTiempo(meta.segundos)} cumplida`);
    }
    if (!partes.length) {
      const ps = s.muestras?.length ? parciales(s.muestras, d > 3000 ? 1000 : 500) : [];
      if (ps.length > 1 && ps.at(-1).tiempo < Math.min(...ps.slice(0, -1).map((x) => x.tiempo))) partes.push('el último tramo fue el más rápido');
    }
    p.contexto = corta ? '' : partes.join(' · ');
    return p;
  }

  if (tipo === 'vo2') {
    const fuertes = minutos((s.muestras || []).filter((x) => x.w > f * 1.05).length);
    Object.assign(p, { valor: String(fuertes), unidad: 'min', de: 'muy fuertes', etq: 'por encima de su ritmo de una hora' });
    const txt = textoSeries(series(s));
    p.contexto = fuertes >= 12 && fuertes <= 20 ? `${txt ? `${txt} · ` : ''}la dosis que hace crecer los pulmones` : txt || '';
    return p;
  }

  if (tipo === 'intervalos') {
    const fs = series(s);
    Object.assign(p, { valor: String(s.pctEnRango), unidad: '%', etq: 'del tiempo en el ritmo exacto del plan' });
    const umbral = (s.tipoPlan || tipoSesion(s, f)) === 'umbral';
    const r = seriesEnRango(s, f);
    p.contexto = [textoSeries(fs, umbral), r ? `${r.dentro} de ${r.total} dentro de su rango` : null].filter(Boolean).join(' · ');
    return p;
  }

  if (tipo === 'tecnica') {
    const mpp = metrosPorPalada(s);
    Object.assign(p, { valor: mpp.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), unidad: 'm', de: 'por palada' });
    const antes = previas.filter((x) => tipoTarjeta(x, f) === 'tecnica').map(metrosPorPalada).filter(Boolean);
    p.contexto = antes.length >= 3 && mpp > Math.max(...antes) ? 'Más metros con cada palada: su mejor marca en técnica' : `${min} min de técnica a ${s.spmProm} golpes/min`;
    return p;
  }

  // Fondo y remo libre: la distancia, y lo primero que sea cierto de esta cascada.
  Object.assign(p, distanciaGrande(s.distancia || 0));
  const rDist = records.find((x) => x.clave === 'dist' && x.anterior != null);
  if (rDist) Object.assign(p, { kicker: 'RÉCORD PERSONAL', antes: kmNum(rDist.anterior) });
  if (corta) return p;
  const suave = (intensidad(s, f)?.nivel || 9) <= 2;
  const base = `${min} min ${s.entrenamiento ? 'sin parar' : 'continuos'}${suave ? ' a ritmo de fondo' : ''}`;
  const real = records.find((x) => x.anterior != null && x.clave !== 'dist' && x.clave !== 't500');
  let logro = real ? `su mejor ${real.nombre.replace(/^Mejor /, '').replace(/^Potencia /, '').toLowerCase()}: ${valorRecord(real)}` : null;
  const delMes = previas.filter((x) => mismoMes(x.fecha, s.fecha));
  if (!logro && s.duracion >= 1200 && s.muestras?.length) {
    const comparables = delMes.filter((x) => (x.duracion || 0) >= 1200 && x.muestras?.length);
    const w20 = mejorPotencia(s.muestras, 1200);
    if (comparables.length >= 3 && w20 > Math.max(...comparables.map((x) => mejorPotencia(x.muestras, 1200) || 0))) logro = 'sus mejores 20 min del mes';
  }
  if (!logro && !s.entrenamiento) {
    const libres = delMes.filter((x) => !x.entrenamiento);
    if (libres.length >= 3 && s.distancia > Math.max(...libres.map((x) => x.distancia || 0))) logro = 'su remo libre más largo del mes';
  }
  p.contexto = [base, logro].filter(Boolean).join(' · ');
  return p;
}

// Los datos de abajo: [valor, unidad, etiqueta]. Nunca repiten el dato grande.
function secundariosDe(s, tipo, f) {
  const dist = distanciaGrande(s.distancia || 0);
  const D = {
    distancia: [dist.valor, dist.unidad, 'Distancia'],
    tiempo: [formatoTiempo(s.duracion), '', 'Tiempo'],
    split: [formatoSplit(s.splitProm), '/500 m', tipo === 'prueba' ? 'Split promedio' : 'Split'],
    watts: [miles(s.wattsProm), 'W', tipo === 'prueba' ? 'Watts promedio' : 'Watts prom'],
  };
  const mejorSerie = () => { const fs = series(s); return fs.length ? [miles(Math.max(...fs.map((x) => x.w))), 'W', 'Mejor serie'] : null; };
  const lista = {
    prueba: [D.split, D.watts],
    ftp: [[miles(s.pruebaWatts), 'W', 'Watts de los 20 min'], D.split, D.distancia],
    intervalos: [mejorSerie(), D.distancia, D.tiempo],
    vo2: [mejorSerie(), s.pctEnRango != null ? [String(s.pctEnRango), '%', 'En su rango'] : D.distancia, D.tiempo],
    tecnica: [[String(s.spmProm), '', 'Golpes/min'], [miles((s.spmProm * s.duracion) / 60), '', 'Paladas'], D.distancia],
    cortada: [D.distancia, D.split, D.watts],
    fondo: [D.tiempo, D.split, D.watts],
  }[tipo];
  return lista.filter(Boolean);
}

// Potencia con las bandas del rango en las series (si hay FTP o metas en watts) y, si quedó a medias, lo que faltaba.
function graficaDe(s, tipo, f) {
  if (tipo === 'prueba' || !s.muestras?.length) return null;
  const g = { tMax: null, resto: null, rango: null };
  if (tipo === 'cortada') {
    const plan = (s.versionCorta || minutosPlan(s) || 0) * 60;
    if (plan > s.duracion) Object.assign(g, { tMax: plan, resto: `plan: ${Math.round(plan / 60)} min` });
  }
  const tramos = [];
  let desde = 0;
  let min = Infinity;
  let max = 0;
  for (const b of s.bloques || []) {
    const r = esBloqueTrabajo(b) ? rangoWatts(b, f) : null;
    if (r && s.bloques.length > 1) { tramos.push([desde, desde + b.duracion]); min = Math.min(min, r.min); max = Math.max(max, r.max); }
    desde += b.duracion || 0;
  }
  // Una sola banda para todas las series: solo si sus rangos se parecen.
  if (tramos.length && max <= min * 1.6) g.rango = { min, max, tramos };
  return g;
}

// «2.º de 3 · a 18 m de Kaito · 42 m delante de Haakon el Rojo» y las tarjetas del podio (3 como mucho, con su puesto).
export function podioDe(rivales, nombre = 'Su héroe') {
  const lista = (rivales || []).filter((r) => Number.isFinite(r.diferencia));
  if (!lista.length) return null;
  const limpio = (n) => n.replace(/^Fantasma /, '').replace(/ \(.*\)$/, '');
  // delante > 0: metros que el rival sacó de ventaja.
  const todos = [{ nombre, delante: 0, yo: true }, ...lista.map((r) => ({ nombre: limpio(r.nombre), delante: -r.diferencia }))]
    .sort((a, b) => b.delante - a.delante || (a.yo ? -1 : b.yo ? 1 : 0));
  const i = todos.findIndex((x) => x.yo);
  const desde = Math.max(0, Math.min(i - 1, todos.length - 3));
  const filas = todos.slice(desde, desde + 3).map((x, k) => [String(desde + k + 1), x.nombre, x.yo ? '' : x.delante > 0 ? `${miles(x.delante)} m delante` : `${miles(-x.delante)} m detrás`, !!x.yo]);
  const arriba = todos[i - 1];
  const abajo = todos[i + 1];
  const texto = [`${i + 1}.º de ${todos.length}`, arriba ? `a ${miles(arriba.delante)} m de ${arriba.nombre}` : null, abajo ? `${miles(-abajo.delante)} m delante de ${abajo.nombre}` : null].filter(Boolean).join(' · ');
  return { texto, filas };
}

// Todo lo que va en la tarjeta. opciones: { pulso, kcal, heroe }.
// ctx: { ftp, records (nuevosRecords, con anterior), marcas (calcularRecords de las previas), previas, meta: { distancia, segundos },
// semanaPlan, rivales: [{ nombre, diferencia }], heroe: { nombre, linea, src, xp }, paisaje: { src, horizonte, filtro },
// hito: hitoDe() de hitos.js }.
export function contenidoTarjeta(s, opciones = {}, ctx = {}) {
  const o = { ...OPCIONES_DEFECTO, ...opciones };
  const f = s.ftp || ctx.ftp || 0;
  const prota = protagonista(s, ctx);
  const { tipo, ...dato } = prota;
  let { contexto } = prota;
  // Plantilla por hito (etapa 21): el jefe, el plan, el rango, la semana o el fantasma por poco ponen su sello y su frase
  // delante. El récord ya tiene la suya (el dato grande con el anterior tachado).
  const hito = ctx.hito && ctx.hito.clave !== 'record' ? ctx.hito : null;
  if (hito) {
    dato.kicker = hito.kicker;
    if (hito.texto) contexto = [hito.texto, contexto].filter(Boolean).join(' · ');
  }
  const secundarios = secundariosDe(s, tipo, f);
  if (o.pulso && s.fcProm) secundarios.push([String(s.fcProm), 'lpm', 'Pulso prom']);
  if (o.kcal && s.kcal) secundarios.push([miles(s.kcal), 'kcal', 'kcal estimadas']);
  const ps = tipo === 'prueba' && s.muestras?.length ? parciales(s.muestras, distPrueba(s) > 3000 ? 1000 : 500) : [];
  return {
    tipo,
    titulo: s.entrenamiento || 'Remo libre',
    intensidad: intensidad(s, f),
    estado: estadoSesion(s),
    semanaPlan: ctx.semanaPlan || null,
    protagonista: dato,
    contexto,
    secundarios: secundarios.slice(0, tipo === 'prueba' ? 3 : 4),
    parciales: ps.length > 1 ? ps.slice(0, 10).map((x) => ({ texto: formatoSplit(x.split), metros: miles(x.metros), seg: x.split })) : null,
    grafica: graficaDe(s, tipo, f),
    podio: tipo === 'cortada' ? null : podioDe(ctx.rivales, ctx.heroe?.nombre),
    heroe: o.heroe ? ctx.heroe || null : null,
    paisaje: ctx.paisaje || null,
    hito: ctx.hito?.clave || null,
    tira: hito?.tira || null,
  };
}

// Tus metros en algo que cualquiera imagina. Ander la quiere para las tarjetas semanales y mensuales (etapa 30),
// no en la de la sesión: «La misma distancia que una carrera olímpica de remo»,
// «Como cruzar 3 veces el puente Golden Gate» o, si nada cuadra, campos de fútbol. Medidas públicas, redondeadas.
export const DISTANCIAS = [
  { m: 82000, de: 'el Canal de Panamá', cruzar: 'recorrer el Canal de Panamá' },
  { m: 42195, de: 'un maratón', cruzar: 'correr un maratón' },
  { m: 33000, de: 'el Canal de la Mancha (Dover–Calais)', cruzar: 'cruzar el Canal de la Mancha' },
  { m: 21097, de: 'un medio maratón', cruzar: 'correr un medio maratón' },
  { m: 14300, de: 'el Estrecho de Gibraltar', cruzar: 'cruzar el Estrecho de Gibraltar' },
  { m: 10000, de: 'el maratón de natación olímpico', cruzar: 'nadar el maratón olímpico de aguas abiertas' },
  { m: 6779, de: 'la carrera de remo Oxford vs. Cambridge', cruzar: 'remar la carrera Oxford vs. Cambridge' },
  { m: 3800, de: 'el Gran Canal de Venecia', cruzar: 'recorrer el Gran Canal de Venecia' },
  { m: 2737, de: 'el puente Golden Gate', cruzar: 'cruzar el puente Golden Gate' },
  { m: 2000, de: 'una carrera olímpica de remo', cruzar: 'remar una carrera olímpica' },
  { m: 1825, de: 'el puente de Brooklyn', cruzar: 'cruzar el puente de Brooklyn' },
  { m: 1500, de: 'el nado del triatlón olímpico', cruzar: 'nadar el tramo del triatlón olímpico' },
];
export const CAMPO_M = 105;
const del = (t) => t.replace(/^el /, 'del ').replace(/^(la|una|un) /, 'de $1 ');
export function equivalencia(s) {
  const d = s?.distancia || 0;
  if (!(d >= CAMPO_M)) return null;
  const corto = (m) => (m >= 1000 ? `${(m / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km` : `${miles(m)} m`);
  const con = (x, texto) => ({ texto, detalle: `Remaste ${corto(d)} · ${x.de} mide ${corto(x.m)}` });
  // Primero la misma distancia; luego cuántas veces cabe la más grande (de 2 a 5); luego la mitad; si no, campos.
  const igual = DISTANCIAS.find((x) => Math.abs(d / x.m - 1) <= 0.08);
  if (igual) return con(igual, `La misma distancia que ${igual.de}`);
  // Mejor una cuenta redonda («3 veces», «2 veces y media») que «más de 2 veces».
  const cabe = (x) => d / x.m >= 1.9 && d / x.m < 6;
  const redonda = (x) => Math.abs(d / x.m - Math.round((d / x.m) * 2) / 2) <= 0.06;
  const varias = DISTANCIAS.find((x) => cabe(x) && redonda(x)) || DISTANCIAS.find(cabe);
  if (varias) {
    const r = d / varias.m;
    const medio = Math.round(r * 2) / 2;
    const n = Math.floor(medio);
    return con(varias, `Como ${varias.cruzar} ${redonda(varias) ? `${n} veces${medio % 1 ? ' y media' : ''}` : `más de ${Math.floor(r)} veces`}`);
  }
  const mitad = DISTANCIAS.find((x) => Math.abs(d / x.m - 0.5) <= 0.05);
  if (mitad) return con(mitad, `La mitad ${del(mitad.de)}`);
  const n = Math.round(d / CAMPO_M);
  return { texto: `Como recorrer ${miles(n)} ${n === 1 ? 'campo' : 'campos'} de fútbol profesional`, detalle: `Remaste ${corto(d)} · un campo mide ${CAMPO_M} m` };
}
