// Cálculos de seguimiento: récords, comparación con la sesión anterior y progreso por periodo.
// Una muestra de sesión es { t, w, spm, split, dist, nivel, fc } con t en segundos activos.
import { enRango } from './entrenamientos.js';

// Mayor potencia media sostenida durante `segs` segundos.
export function mejorPotencia(muestras, segs) {
  if (muestras.length < segs) return null;
  let suma = 0;
  let mejor = 0;
  for (let i = 0; i < muestras.length; i++) {
    suma += muestras[i].w;
    if (i >= segs) suma -= muestras[i - segs].w;
    if (i >= segs - 1) mejor = Math.max(mejor, suma / segs);
  }
  return Math.round(mejor);
}

// Menor tiempo (s) en el que se recorrieron `metros` dentro de la sesión.
export function mejorTiempo(muestras, metros) {
  let j = 0;
  let mejor = null;
  for (let i = 0; i < muestras.length; i++) {
    while (j < i && muestras[i].dist - muestras[j + 1].dist >= metros) j++;
    if (muestras[i].dist - muestras[j].dist >= metros) {
      const dt = muestras[i].t - muestras[j].t;
      if (mejor == null || dt < mejor) mejor = dt;
    }
  }
  return mejor;
}

// Definición de récords. tipo 'tiempo': menor es mejor; 'valor': mayor es mejor.
export const RECORDS = [
  { clave: 't500', nombre: 'Mejor 500 m', tipo: 'tiempo', calc: (s) => mejorTiempo(s.muestras, 500) },
  { clave: 't2000', nombre: 'Mejor 2000 m', tipo: 'tiempo', calc: (s) => mejorTiempo(s.muestras, 2000) },
  { clave: 't5000', nombre: 'Mejor 5000 m', tipo: 'tiempo', calc: (s) => mejorTiempo(s.muestras, 5000) },
  { clave: 'w1', nombre: 'Potencia 1 min', tipo: 'valor', unidad: 'W', calc: (s) => mejorPotencia(s.muestras, 60) },
  { clave: 'w5', nombre: 'Potencia 5 min', tipo: 'valor', unidad: 'W', calc: (s) => mejorPotencia(s.muestras, 300) },
  { clave: 'w20', nombre: 'Potencia 20 min', tipo: 'valor', unidad: 'W', calc: (s) => mejorPotencia(s.muestras, 1200) },
  { clave: 'wmax', nombre: 'Potencia máxima', tipo: 'valor', unidad: 'W', calc: (s) => s.wattsMax || null },
  { clave: 'dist', nombre: 'Sesión más larga', tipo: 'valor', unidad: 'm', calc: (s) => s.distancia || null },
];

const mejora = (r, nuevo, viejo) => viejo == null || (r.tipo === 'tiempo' ? nuevo < viejo : nuevo > viejo);

// Mejores marcas de una lista de sesiones: { clave: { valor, fecha, id } }
export function calcularRecords(sesiones) {
  const res = {};
  for (const s of sesiones) {
    for (const r of RECORDS) {
      const v = s.marcas?.[r.clave] ?? r.calc(s);
      if (v == null) continue;
      if (!res[r.clave] || mejora(r, v, res[r.clave].valor)) res[r.clave] = { valor: v, fecha: s.fecha, id: s.id };
    }
  }
  return res;
}

// Marcas de una sesión, para guardarlas con ella y no recalcularlas siempre.
export function marcasDeSesion(s) {
  const m = {};
  for (const r of RECORDS) {
    const v = r.calc(s);
    if (v != null) m[r.clave] = v;
  }
  return m;
}

// Récords que la sesión nueva supera respecto a las anteriores.
export function nuevosRecords(sesion, previas) {
  const antes = calcularRecords(previas);
  const marcas = sesion.marcas || marcasDeSesion(sesion);
  const lista = [];
  for (const r of RECORDS) {
    const v = marcas[r.clave];
    if (v == null) continue;
    const viejo = antes[r.clave]?.valor ?? null;
    if (mejora(r, v, viejo)) lista.push({ ...r, valor: v, anterior: viejo });
  }
  return lista;
}

// Diferencias con la última vez que se hizo el mismo entrenamiento (o null si no hay).
export function compararConAnterior(sesion, previas) {
  const anterior = previas
    .filter((p) => p.fecha < sesion.fecha && (p.entrenamiento || null) === (sesion.entrenamiento || null))
    .sort((a, b) => b.fecha - a.fecha)[0];
  if (!anterior) return null;
  const campos = [
    { clave: 'distancia', nombre: 'Distancia', unidad: 'm', mejor: 'mas' },
    { clave: 'wattsProm', nombre: 'Watts promedio', unidad: 'W', mejor: 'mas' },
    { clave: 'splitProm', nombre: 'Split promedio', unidad: 's', mejor: 'menos' },
    { clave: 'spmProm', nombre: 'Golpes/min', unidad: '', mejor: null },
    { clave: 'pctEnRango', nombre: 'En rango', unidad: '%', mejor: 'mas' },
    { clave: 'tiempoMeta', nombre: 'Tiempo a la meta', unidad: 's', mejor: 'menos' },
  ];
  const filas = [];
  for (const c of campos) {
    const a = anterior[c.clave];
    const b = sesion[c.clave];
    if (a == null || b == null || (c.clave === 'splitProm' && (!a || !b))) continue;
    const delta = b - a;
    const mejoro = c.mejor == null || delta === 0 ? null : (c.mejor === 'mas' ? delta > 0 : delta < 0);
    filas.push({ ...c, antes: a, ahora: b, delta, mejoro });
  }
  return { fecha: anterior.fecha, filas };
}

// Inicio de la semana (lunes 00:00) o del mes para una fecha.
export function inicioPeriodo(ms, periodo) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  if (periodo === 'mes') d.setDate(1);
  else d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// Totales de los últimos n periodos, del más antiguo al actual.
export function resumenPeriodos(sesiones, periodo, n, ahora = Date.now()) {
  const res = [];
  let inicio = inicioPeriodo(ahora, periodo);
  for (let i = 0; i < n; i++) {
    res.unshift({ inicio, metros: 0, segundos: 0, sesiones: 0 });
    const d = new Date(inicio);
    if (periodo === 'mes') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    inicio = d.getTime();
  }
  for (const s of sesiones) {
    const k = inicioPeriodo(s.fecha, periodo);
    const p = res.find((x) => x.inicio === k);
    if (!p) continue;
    p.metros += s.distancia || 0;
    p.segundos += s.duracion || 0;
    p.sesiones += 1;
  }
  return res;
}

// Días seguidos con al menos una sesión, contando hasta hoy (o ayer si hoy aún no hay).
export function racha(sesiones, ahora = Date.now()) {
  const dias = new Set(sesiones.map((s) => new Date(s.fecha).toDateString()));
  const d = new Date(ahora);
  if (!dias.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (dias.has(d.toDateString())) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// Semanas seguidas (de lunes a domingo) con al menos una sesión. La semana actual cuenta si ya remaste;
// si aún no, la racha sigue viva desde la semana pasada. Sirve a quien rema en días alternos.
export function rachaSemanas(sesiones, ahora = Date.now()) {
  const semanas = new Set(sesiones.map((s) => inicioPeriodo(s.fecha, 'semana')));
  const d = new Date(inicioPeriodo(ahora, 'semana'));
  if (!semanas.has(d.getTime())) d.setDate(d.getDate() - 7);
  let n = 0;
  while (semanas.has(d.getTime())) {
    n++;
    d.setDate(d.getDate() - 7);
  }
  return n;
}

// ---------- Resumen por intervalo y parciales ----------

// Una fila por intervalo con promedios y % del tiempo en rango. bloques ya con duración real en segundos.
export function resumenIntervalos(sesion) {
  if (!sesion.bloques) return [];
  const filas = [];
  let desde = 0;
  for (const b of sesion.bloques) {
    const hasta = desde + b.duracion;
    const tramo = sesion.muestras.filter((x) => x.t > desde && x.t <= hasta);
    if (tramo.length) {
      const prom = (k) => Math.round(tramo.reduce((a, x) => a + (x[k] || 0), 0) / tramo.length);
      const conSplit = tramo.filter((x) => x.split > 0);
      const juzgados = tramo.map((x) => enRango(b, x.w, x.spm, 0, x.split, x.fc)).filter(Boolean);
      filas.push({
        nombre: b.nombre || 'Intervalo',
        bloque: b,
        segundos: tramo.length,
        metros: tramo.at(-1).dist - (sesion.muestras.find((x) => x.t > desde)?.dist ?? 0),
        w: prom('w'),
        spm: prom('spm'),
        fc: tramo.some((x) => x.fc) ? prom('fc') : 0,
        split: conSplit.length ? Math.round(conSplit.reduce((a, x) => a + x.split, 0) / conSplit.length) : 0,
        pctRango: juzgados.length ? Math.round((100 * juzgados.filter((r) => r === 'dentro').length) / juzgados.length) : null,
      });
    }
    desde = hasta;
  }
  return filas;
}

// Parciales cada `cada` metros: tiempo, split, watts y golpes de cada tramo.
export function parciales(muestras, cada = 500) {
  const res = [];
  let inicio = { t: 0, dist: 0 };
  let tramo = [];
  for (const x of muestras) {
    tramo.push(x);
    if (x.dist - inicio.dist >= cada) {
      const t = x.t - inicio.t;
      res.push({
        n: res.length + 1,
        metros: (res.length + 1) * cada,
        tiempo: t,
        split: Math.round((t * 500) / (x.dist - inicio.dist)),
        w: Math.round(tramo.reduce((a, y) => a + y.w, 0) / tramo.length),
        spm: Math.round(tramo.reduce((a, y) => a + y.spm, 0) / tramo.length),
      });
      inicio = { t: x.t, dist: inicio.dist + cada };
      tramo = [];
    }
  }
  return res;
}

// ---------- Carga y forma ----------

// Potencia normalizada: media móvil de 30 s elevada a la 4, promediada y con raíz cuarta.
export function potenciaNormalizada(muestras) {
  if (muestras.length < 30) return muestras.length ? Math.round(muestras.reduce((a, x) => a + x.w, 0) / muestras.length) : 0;
  let suma = 0;
  let acum = 0;
  let n = 0;
  for (let i = 0; i < muestras.length; i++) {
    suma += muestras[i].w;
    if (i >= 30) suma -= muestras[i - 30].w;
    if (i >= 29) { acum += (suma / 30) ** 4; n++; }
  }
  return Math.round((acum / n) ** 0.25);
}

// Estrés de la sesión (100 = una hora a tu FTP).
export function estres(sesion, ftp) {
  if (!ftp || !sesion.muestras?.length) return null;
  const np = potenciaNormalizada(sesion.muestras);
  const intensidad = np / ftp;
  return Math.round(((sesion.duracion * np * intensidad) / (ftp * 3600)) * 100);
}

export const claveDia = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Forma: condición (promedio de 42 días), fatiga (7 días) y frescura (condición − fatiga) de los últimos `dias`.
export function forma(sesiones, ftp, dias = 60, ahora = Date.now()) {
  const porDia = new Map();
  let primero = ahora;
  for (const s of sesiones) {
    const v = s.estres ?? estres(s, s.ftp || ftp);
    if (v == null) continue;
    const k = claveDia(s.fecha);
    porDia.set(k, (porDia.get(k) || 0) + v);
    primero = Math.min(primero, s.fecha);
  }
  const res = [];
  let ctl = 0;
  let atl = 0;
  const d = new Date(Math.min(primero, ahora - dias * 864e5));
  d.setHours(12, 0, 0, 0);
  const fin = new Date(ahora);
  fin.setHours(12, 0, 0, 0);
  while (d <= fin) {
    const carga = porDia.get(claveDia(d.getTime())) || 0;
    const tsb = ctl - atl;
    ctl += (carga - ctl) / 42;
    atl += (carga - atl) / 7;
    res.push({ dia: claveDia(d.getTime()), carga, condicion: Math.round(ctl), fatiga: Math.round(atl), frescura: Math.round(tsb) });
    d.setDate(d.getDate() + 1);
  }
  return res.slice(-dias);
}

// ---------- Pulso ----------

export const ZONAS_FC = [
  { n: 1, nombre: 'Muy suave', min: 50, max: 60 },
  { n: 2, nombre: 'Suave', min: 60, max: 70 },
  { n: 3, nombre: 'Moderada', min: 70, max: 80 },
  { n: 4, nombre: 'Intensa', min: 80, max: 90 },
  { n: 5, nombre: 'Máxima', min: 90, max: 100 },
];

export function zonaFc(fc, fcMax) {
  if (!fc || !fcMax) return null;
  const pct = (100 * fc) / fcMax;
  if (pct < 50) return null;
  return ZONAS_FC.find((z) => pct < z.max) || ZONAS_FC.at(-1);
}

// Segundos en cada zona de pulso [z1..z5].
export function tiempoEnZonasFc(muestras, fcMax) {
  const res = [0, 0, 0, 0, 0];
  for (const x of muestras) {
    const z = zonaFc(x.fc, fcMax);
    if (z) res[z.n - 1] += 1;
  }
  return res;
}

// ---------- Técnica ----------

export function tecnica(s) {
  return {
    metrosPorPalada: s.paladas ? Math.round((100 * s.distancia) / s.paladas) / 100 : null,
    joulesPorPalada: s.spmProm ? Math.round((s.wattsProm * 60) / s.spmProm) : null,
    wattsPorLatido: s.fcProm ? Math.round((100 * s.wattsProm) / s.fcProm) / 100 : null,
  };
}

// ---------- Fantasma ----------

// Distancia de una sesión guardada en el segundo t (interpolada). Si ya terminó, su distancia final.
export function distanciaEn(muestras, t) {
  if (!muestras?.length) return 0;
  if (t >= muestras.at(-1).t) return muestras.at(-1).dist;
  let lo = 0;
  let hi = muestras.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (muestras[mid].t <= t) lo = mid; else hi = mid;
  }
  const a = muestras[lo];
  const b = muestras[hi];
  if (t <= a.t) return a.dist * (t / (a.t || 1));
  return a.dist + ((b.dist - a.dist) * (t - a.t)) / (b.t - a.t || 1);
}

// Sesión rival para el mismo entrenamiento: la anterior o la mejor.
export function elegirRival(sesiones, nombre, modo) {
  const mismas = sesiones.filter((s) => (s.entrenamiento || null) === (nombre || null) && s.muestras?.length);
  if (!mismas.length || !modo) return null;
  if (modo === 'anterior') return mismas.sort((a, b) => b.fecha - a.fecha)[0];
  const conMeta = mismas.filter((s) => s.tiempoMeta != null);
  if (conMeta.length) return conMeta.sort((a, b) => a.tiempoMeta - b.tiempoMeta)[0];
  return mismas.sort((a, b) => b.distancia / b.duracion - a.distancia / a.duracion)[0];
}

// ---------- Insignias ----------
// Cada insignia: { clave, nombre, detalle, ganada, fecha? }. Se calcula con todo el historial.
export const INSIGNIAS = [
  { clave: 'primera', nombre: 'Primera palada', detalle: 'Tu primera sesión guardada' },
  { clave: 'km5', nombre: '5 km de una', detalle: '5000 m en una sola sesión' },
  { clave: 'km10', nombre: '10 km de una', detalle: '10 000 m en una sola sesión' },
  { clave: 'min30', nombre: 'Media hora', detalle: '30 minutos remando en una sesión' },
  { clave: 'ses10', nombre: 'Constancia', detalle: '10 sesiones' },
  { clave: 'ses50', nombre: 'Veterano', detalle: '50 sesiones' },
  { clave: 'tot100', nombre: '100 km', detalle: '100 km en total' },
  { clave: 'racha7', nombre: 'Semana perfecta', detalle: '7 días seguidos remando' },
  { clave: 'fantasma', nombre: 'Cazafantasmas', detalle: 'Ganarle a un fantasma' },
  { clave: 'avanzado', nombre: 'Nivel avanzado', detalle: 'Ganarle al fantasma avanzado' },
  { clave: 'sub8', nombre: 'Bajo 8 minutos', detalle: '2000 m en menos de 8:00' },
  { clave: 'sub7', nombre: 'Bajo 7 minutos', detalle: '2000 m en menos de 7:00' },
];

export function insignias(sesiones) {
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const ganadas = {};
  let total = 0;
  const dias = new Set();
  const marca = (clave, s) => { if (!ganadas[clave]) ganadas[clave] = s.fecha; };
  orden.forEach((s, i) => {
    total += s.distancia || 0;
    marca('primera', s);
    if (s.distancia >= 5000) marca('km5', s);
    if (s.distancia >= 10000) marca('km10', s);
    if (s.duracion >= 1800) marca('min30', s);
    if (i + 1 >= 10) marca('ses10', s);
    if (i + 1 >= 50) marca('ses50', s);
    if (total >= 100000) marca('tot100', s);
    const rivales = s.carreraSinTerminar ? [] : s.rivales || (s.rival ? [s.rival] : []);
    if (rivales.some((r) => r.diferencia > 0)) marca('fantasma', s);
    if (rivales.some((r) => r.nivel === 'avanzado' && r.diferencia > 0)) marca('avanzado', s);
    const t2k = s.muestras?.length ? mejorTiempo(s.muestras, 2000) : null;
    if (t2k && t2k < 480) marca('sub8', s);
    if (t2k && t2k < 420) marca('sub7', s);
    dias.add(claveDia(s.fecha));
    let n = 0;
    for (let d = new Date(`${claveDia(s.fecha)}T12:00`); dias.has(claveDia(d.getTime())); d = new Date(d.getTime() - 864e5)) n++;
    if (n >= 7) marca('racha7', s);
  });
  return INSIGNIAS.map((x) => ({ ...x, ganada: !!ganadas[x.clave], fecha: ganadas[x.clave] ?? null }));
}

// Recomendación del día según la frescura (condición − fatiga).
export function recomendacion(sesiones, ftp, ahora = Date.now()) {
  if (!ftp || !sesiones.length) return null;
  const hoy = forma(sesiones, ftp, 42, ahora).at(-1);
  if (!hoy || (hoy.condicion === 0 && hoy.fatiga === 0)) return null;
  const f = hoy.frescura;
  if (f < -25) return { tipo: 'descanso', texto: 'Mucha fatiga acumulada: hoy toca descanso o 20 min muy suaves.', frescura: f };
  if (f < -10) return { tipo: 'suave', texto: 'Algo de fatiga: rema suave en zona 2 (Resistencia).', frescura: f };
  if (f > 10) return { tipo: 'fuerte', texto: 'Estás fresco: buen día para una prueba o intervalos fuertes.', frescura: f };
  return { tipo: 'normal', texto: 'Vas equilibrado: cualquier entrenamiento te queda bien.', frescura: f };
}

// FTP sugerido por una sesión sin prueba formal: 95 % de los mejores 20 min (si duró al menos 20 min).
export function ftpSugerido(sesion) {
  const p20 = mejorPotencia(sesion.muestras || [], 1200);
  return p20 ? Math.round(p20 * 0.95) : null;
}

// Metros nuevos según el contador de distancia de la consola, leído una vez por segundo.
// Se protege de lecturas falsas (por ejemplo al pausar, la consola puede mandar 0 y luego volver a su cifra):
//  - si el contador baja a casi 0, la consola se reinició y se cuenta desde ahí;
//  - si baja a otra cifra, o sube más de lo que se puede remar en un segundo, no suma nada y solo se resincroniza.
export const MAX_M_POR_SEGUNDO = 25;
export function metrosNuevos(previa, lectura) {
  if (lectura == null) return 0;
  if (previa == null) return 0;
  const d = lectura - previa;
  if (d >= 0) return d <= MAX_M_POR_SEGUNDO ? d : 0;
  return lectura <= MAX_M_POR_SEGUNDO ? lectura : 0;
}

// Repara una sesión guardada con saltos falsos de distancia (la consola llegó a mandar cientos de metros en un segundo).
// Entre dos muestras seguidas no se puede avanzar más de SALTO_MAX m ni retroceder; esos tramos no suman.
// Devuelve la sesión corregida o null si no tenía saltos.
export const SALTO_MAX = 50;
export function repararSaltos(s) {
  const m = s?.muestras || [];
  if (m.length < 2) return null;
  let previa = 0;
  let nueva = 0;
  let primerSalto = null;
  const muestras = m.map((x) => {
    const d = x.dist - previa;
    previa = x.dist;
    if (d < 0 || d > SALTO_MAX) primerSalto ??= x.t;
    else nueva += d;
    return { ...x, dist: Math.round(nueva) };
  });
  const quitado = (m.at(-1).dist || 0) - muestras.at(-1).dist;
  if (primerSalto == null || quitado < 1) return null;
  const ajustar = (r) => (r && r.diferencia != null ? { ...r, diferencia: Math.round(r.diferencia - quitado) } : r);
  const r = {
    ...s,
    muestras,
    distancia: muestras.at(-1).dist,
    distanciaOriginal: s.distanciaOriginal ?? s.distancia,
    reparada: true,
    // Si la meta se "cumplió" con el salto, no cuenta.
    tiempoMeta: s.tiempoMeta != null && primerSalto <= s.tiempoMeta ? null : s.tiempoMeta,
  };
  if (s.rival) r.rival = ajustar(s.rival);
  if (s.rivales) r.rivales = s.rivales.map(ajustar);
  if (s.referencias) r.referencias = s.referencias.map(ajustar);
  r.marcas = marcasDeSesion(r);
  return r;
}

// Esfuerzo (1–10) a partir del pulso: el pulso medio como % del máximo marca la base
// (60 % → 3, 70 % → 5, 80 % → 7, 90 % → 9) y una sesión larga a buen pulso suma 1.
// Hace falta pulso en al menos el 60 % de la sesión y 5 minutos con dato; si no, null.
export function esfuerzoPorPulso(muestras, fcMax) {
  if (!fcMax || !muestras?.length) return null;
  const con = muestras.filter((x) => x.fc > 0);
  if (con.length < 300 || con.length < muestras.length * 0.6) return null;
  const pct = (100 * con.reduce((a, x) => a + x.fc, 0)) / con.length / fcMax;
  let rpe = Math.round((pct - 45) / 5);
  if (muestras.length > 2700 && pct >= 70) rpe += 1;
  return { rpe: Math.max(1, Math.min(10, rpe)), pct: Math.round(pct) };
}
