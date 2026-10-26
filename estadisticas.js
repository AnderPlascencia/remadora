// Cálculos de seguimiento: récords, comparación con la sesión anterior y progreso por periodo.
// Una muestra de sesión es { t, w, spm, split, dist, nivel, fc } con t en segundos activos.

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
