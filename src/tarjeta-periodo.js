// Tarjetas de la semana y del mes para compartir (etapa 31, diseños que eligió Ander: «Tablero» la semanal y
// «Póster» la mensual). Lo que se ve: los km, el cambio contra el periodo anterior, una equivalencia con un lugar
// conocido, tiempo, calorías estimadas, plan cumplido, lo que mejoró (en el mes) y hasta 3 logros.
// Reglas del entrenador: nada en rojo (si bajó, el dato va en gris y se busca lo bueno), «Calorías estimadas»,
// mejoras solo con marcas reales y comparables, y en tercera persona porque la ven otros.
// Sin DOM: lo pinta tarjeta-imagen.js. Se carga al abrir «Compartir» en Progreso.
import { formatoSplit, formatoTiempo } from './protocolo.js';
import { RECORDS, calcularRecords, ftpSugerido, insignias, inicioPeriodo, mejorTiempo, rachaSemanas } from './estadisticas.js';
import { tipoSesion } from './capacidades.js';
import { DISTANCIAS, equivalencia } from './tarjeta.js';

const DIA = 864e5;
const miles = (n) => Math.round(n || 0).toLocaleString('es-MX');
const km1 = (m) => (m / 1000).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Fin (exclusivo) del periodo que empieza en «inicio».
export function finPeriodo(inicio, periodo) {
  const d = new Date(inicio);
  if (periodo === 'mes') d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 7);
  return d.getTime();
}
// Inicio del periodo anterior.
export function periodoAnterior(inicio, periodo) {
  const d = new Date(inicio);
  if (periodo === 'mes') d.setMonth(d.getMonth() - 1);
  else d.setDate(d.getDate() - 7);
  return d.getTime();
}

// «Semana del 16 al 22 de noviembre», «Semana del 30 de noviembre al 6 de diciembre», «Noviembre de 2026».
export function textoRango(inicio, periodo) {
  const a = new Date(inicio);
  if (periodo === 'mes') return `${MESES[a.getMonth()][0].toUpperCase()}${MESES[a.getMonth()].slice(1)} de ${a.getFullYear()}`;
  const b = new Date(finPeriodo(inicio, periodo) - DIA / 2);
  return a.getMonth() === b.getMonth()
    ? `Semana del ${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`
    : `Semana del ${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`;
}

// Qué periodo se ofrece al abrir: el actual, salvo en sus primeros días (lunes y martes; del 1 al 5 del mes), en que
// lo normal es presumir el que acaba de terminar. Si el elegido no tiene sesiones, el otro.
export function periodoSugerido(sesiones, periodo, ahora = Date.now()) {
  const actual = inicioPeriodo(ahora, periodo);
  const anterior = periodoAnterior(actual, periodo);
  const d = new Date(ahora);
  const alEmpezar = periodo === 'mes' ? d.getDate() <= 5 : [1, 2].includes(d.getDay());
  const hay = (ini) => sesiones.some((s) => s.fecha >= ini && s.fecha < finPeriodo(ini, periodo));
  const primero = alEmpezar ? anterior : actual;
  const otro = alEmpezar ? actual : anterior;
  return hay(primero) || !hay(otro) ? primero : otro;
}

function totales(sesiones) {
  const t = { metros: 0, segundos: 0, kcal: 0, sesiones: sesiones.length };
  for (const s of sesiones) { t.metros += s.distancia || 0; t.segundos += s.duracion || 0; t.kcal += s.kcal || 0; }
  return t;
}
const tiempoLargo = (seg) => { const m = Math.round(seg / 60); return m >= 60 ? [`${Math.floor(m / 60)} h ${m % 60}`, 'min'] : [`${m}`, 'min']; };
const pct = (a, b) => (b > 0 ? Math.round((a / b - 1) * 100) : null);
// Un cambio que sube: solo si es mejora (los que bajan no se ponen: nada en rojo).
const subePct = (a, b) => { const p = pct(a, b); return p != null && p >= 1 ? `+${p} %` : ''; };

// Lugares conocidos para los km de una semana o un mes: la misma distancia, una cuenta redonda o, si no, «más que».
export function equivalenciaPeriodo(metros) {
  const e = equivalencia({ distancia: metros });
  if (!e) return null;
  const sinMas = !/más de \d+ veces|campos? de fútbol/.test(e.texto);
  if (sinMas) return { texto: e.texto, detalle: e.detalle.replace(/^Remaste [^·]+· /, '').replace(/^./, (c) => c.toUpperCase()) };
  const corto = (m) => `${(m / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`;
  const x = DISTANCIAS.find((d) => metros / d.m >= 1.08 && metros / d.m < 1.9);
  if (x) return { texto: `Más que ${x.de}${/canal|estrecho|puente/i.test(x.de) ? ' de punta a punta' : ''}`, detalle: `${x.de[0].toUpperCase()}${x.de.slice(1)} mide ${corto(x.m)}` };
  return { texto: e.texto, detalle: e.detalle.replace(/^Remaste [^·]+· /, '').replace(/^./, (c) => c.toUpperCase()) };
}

// Sesiones del plan de esas fechas: { hechas, total } (null sin plan o sin sesiones del plan en el periodo).
// estados = estadoDias(programa, sesiones) de programa.js, ya calculado por quien llama.
export function planDelPeriodo(estados, inicio, fin) {
  const k0 = claveDia(inicio);
  const k1 = claveDia(fin - DIA / 2);
  // Las que aún no tocan (pendientes) no cuentan: a media semana no se lee como si faltaran.
  const dias = (estados || []).filter((d) => d.ent && !d.movido && d.fecha >= k0 && d.fecha <= k1 && d.estado !== 'pendiente');
  if (!dias.length) return null;
  return { hechas: dias.filter((d) => d.estado === 'hecho').length, total: dias.length };
}
function claveDia(ms) { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// Lo que mejoró en el mes, solo con marcas comparables: [nombre, antes, después, cambio].
export function avancesDelMes(sesiones, inicio, fin, ftp = 0) {
  const antes = sesiones.filter((s) => s.fecha < inicio);
  const del = sesiones.filter((s) => s.fecha >= inicio && s.fecha < fin);
  const out = [];
  // Mejor 2000 m: el tramo más rápido de 2000 m del mes contra el mejor de antes.
  const t2k = (lista) => Math.min(...lista.filter((s) => (s.distancia || 0) >= 2000 && s.muestras?.length).map((s) => mejorTiempo(s.muestras, 2000) || Infinity));
  const a2 = t2k(antes);
  const b2 = t2k(del);
  if (Number.isFinite(a2) && Number.isFinite(b2) && b2 < a2 - 0.5) out.push(['Mejor 2000 m', formatoTiempo(a2), formatoTiempo(b2), `−${Math.round(a2 - b2)} s`]);
  // Ritmo de una hora: solo con pruebas de FTP (la última de antes contra la mejor del mes).
  const prueba = (s) => s.pruebaFtp || s.pruebaWatts || /prueba.*ftp|ftp.*prueba/i.test(s.entrenamiento || '');
  const ftpDe = (s) => (s.pruebaWatts ? Math.round(s.pruebaWatts * 0.95) : ftpSugerido(s)) || 0;
  const pa = antes.filter(prueba).sort((x, y) => x.fecha - y.fecha).map(ftpDe).filter(Boolean).at(-1);
  const pb = Math.max(0, ...del.filter(prueba).map(ftpDe));
  if (pa && pb > pa) out.push(['Ritmo de una hora', `${pa} W`, `${pb} W`, `+${Math.round((pb / pa - 1) * 100)} %`]);
  // Split en los fondos: el promedio de los fondos de 10 min o más del mes contra los del mes anterior (2 o más cada uno).
  const ini0 = periodoAnterior(inicio, 'mes');
  const split = (lista) => {
    const f = lista.filter((s) => (s.duracion || 0) >= 600 && s.distancia > 0 && tipoSesion(s, ftp) === 'fondo');
    if (f.length < 2) return null;
    const t = totales(f);
    return (t.segundos / t.metros) * 500;
  };
  const sa = split(antes.filter((s) => s.fecha >= ini0));
  const sb = split(del);
  if (sa && sb && sb <= sa - 1) out.push(['Split en fondo', formatoSplit(sa), formatoSplit(sb), `−${Math.round(sa - sb)} s`]);
  return out;
}

// Logros del periodo, por prioridad y hasta 3: récords, jefe vencido, insignia, nivel y racha de semanas.
// juego = estadoJuego() (porSesion); los de juego van en turquesa (juego: true), los de esfuerzo en latón.
export function logrosDelPeriodo(sesiones, inicio, fin, { periodo = 'semana', juego = null, primeraSemanaPlan = null } = {}) {
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const del = orden.filter((s) => s.fecha >= inicio && s.fecha < fin);
  const out = [];
  // Récords: las marcas del periodo que superan todo lo de antes (sin la potencia de una palada).
  const previas = orden.filter((s) => s.fecha < inicio);
  if (previas.length) {
    const antes = calcularRecords(previas);
    const ahora = calcularRecords(del);
    const tipo = Object.fromEntries(RECORDS.map((r) => [r.clave, r.tipo]));
    const nuevos = ['t2000', 't5000', 't500', 'w20', 'w5', 'w1'].filter((k) => ahora[k] && antes[k] && (tipo[k] === 'tiempo' ? ahora[k].valor < antes[k].valor : ahora[k].valor > antes[k].valor));
    // El más importante con su marca (el orden de arriba: distancias antes que potencias) y cuántos más hubo.
    if (nuevos.length) {
      const k = nuevos[0];
      const nombre = { t500: '500 m', t2000: '2000 m', t5000: '5000 m', w1: '1 min', w5: '5 min', w20: '20 min' }[k];
      const v = k.startsWith('t') ? formatoTiempo(ahora[k].valor) : `${miles(ahora[k].valor)} W`;
      out.push({ icono: 'trofeo', texto: `Récord en ${nombre}: ${v}${nuevos.length > 1 ? ` y ${nuevos.length - 1} más` : ''}` });
    }
  }
  const g = del.map((s) => juego?.porSesion?.get(s.fecha)).filter(Boolean);
  const jefe = g.map((x) => x.jefe).filter(Boolean).at(-1);
  if (jefe) out.push({ icono: 'escudo', texto: `Venció a ${jefe.nombre.replace(/^(El|La) /, (m) => m.toLowerCase())}`.replace('a el ', 'al ') });
  const ins = insignias(orden, { primeraSemanaPlan }).filter((x) => x.ganada && x.fecha >= inicio && x.fecha < fin && x.clave !== 'primera');
  if (ins.length) out.push({ icono: 'estrella', texto: `Insignia «${ins.at(-1).nombre}»`, juego: true });
  if (g.length) {
    const a = g[0].nivelAntes;
    const b = g.at(-1).nivelDespues;
    if (a && b > a) out.push({ icono: 'estrella', texto: periodo === 'mes' ? `Nivel ${a} → ${b}` : `Subió al nivel ${b}`, juego: true });
  }
  const racha = rachaSemanas(orden.filter((s) => s.fecha < fin), fin - DIA / 2);
  if (racha >= 2) out.push({ icono: 'llama', texto: `${racha} semanas seguidas` });
  return out.slice(0, 3);
}

// Todo lo que va en la tarjeta. ctx: { juego, estados (estadoDias del plan), ftp, heroe, paisaje, primeraSemanaPlan, ahora }.
// opciones: { kcal, heroe }.
export function contenidoPeriodo(sesiones, periodo, inicio, opciones = {}, ctx = {}) {
  const fin = finPeriodo(inicio, periodo);
  const ini0 = periodoAnterior(inicio, periodo);
  const del = sesiones.filter((s) => s.fecha >= inicio && s.fecha < fin);
  const prev = sesiones.filter((s) => s.fecha >= ini0 && s.fecha < inicio);
  const t = totales(del);
  const t0 = totales(prev);
  const mes = periodo === 'mes';
  const nombreAntes = mes ? `en ${MESES[new Date(ini0).getMonth()]}` : 'la semana pasada';

  // El cambio de km: verde si sube; si baja, solo el dato de antes en gris; sin nada antes, «de regreso».
  let cambio = null;
  let antes = '';
  if (t0.metros > 0) {
    const p = pct(t.metros, t0.metros);
    if (p >= 1) cambio = `+${p} %`;
    antes = p >= 1 || p <= -1 ? `vs. ${km1(t0.metros)} km ${nombreAntes}` : `Lo mismo que ${nombreAntes}`;
  } else if (t.sesiones) antes = sesiones.some((s) => s.fecha < ini0) ? (mes ? 'Mes de regreso' : 'Semana de regreso') : (mes ? 'Su primer mes en Rower' : 'Su primera semana en Rower');

  const plan = planDelPeriodo(ctx.estados, inicio, fin);
  const estado = plan ? `${plan.hechas} de ${plan.total} sesiones del plan` : `${t.sesiones} ${t.sesiones === 1 ? 'sesión' : 'sesiones'}`;

  const fichas = [[...tiempoLargo(t.segundos), 'Tiempo', subePct(t.segundos, t0.segundos)]];
  if (opciones.kcal !== false && t.kcal > 0) fichas.push([miles(t.kcal), 'kcal', 'Calorías estimadas', subePct(t.kcal, t0.kcal)]);
  let historia = null;
  let avances = [];
  if (mes) {
    fichas.push([`${t.sesiones}`, '', 'Sesiones', t0.sesiones && t.sesiones > t0.sesiones ? `+${t.sesiones - t0.sesiones}` : '']);
    avances = avancesDelMes(sesiones, inicio, fin, ctx.ftp || 0);
  } else {
    // Split promedio: solo si ambas semanas tienen 2 sesiones o más (con una, depende de qué se remó).
    const sp = t.metros > 0 ? (t.segundos / t.metros) * 500 : 0;
    const sp0 = t0.metros > 0 && t0.sesiones >= 2 && t.sesiones >= 2 ? (t0.segundos / t0.metros) * 500 : 0;
    if (sp) fichas.push([formatoSplit(sp), '/500 m', 'Split promedio', sp0 && sp <= sp0 - 1 ? `−${Math.round(sp0 - sp)} s` : '']);
    fichas.push([plan ? `${plan.hechas} de ${plan.total}` : `${t.sesiones}`, '', plan ? 'Sesiones del plan' : 'Sesiones', '']);
    // Las 8 semanas que acaban en esta, y el promedio de las 4 anteriores (si 2 o más tuvieron remo).
    const barras = [];
    for (let i = 7, ini = inicio; i >= 0; i--, ini = periodoAnterior(ini, 'semana')) {
      const m = totales(sesiones.filter((s) => s.fecha >= ini && s.fecha < finPeriodo(ini, 'semana'))).metros;
      barras.unshift([`${new Date(ini).getDate()} ${MESES[new Date(ini).getMonth()].slice(0, 3)}`, Math.round(m / 100) / 10]);
    }
    const cuatro = barras.slice(3, 7).map((b) => b[1]);
    const prom = cuatro.filter((v) => v > 0).length >= 2 ? cuatro.reduce((a, b) => a + b, 0) / 4 : null;
    historia = { titulo: 'Últimas 8 semanas', barras, prom, promTexto: prom ? `promedio de 4 semanas: ${prom.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km` : '' };
  }
  if (mes) {
    const barras = [];
    for (let i = 5, ini = inicio; i >= 0; i--, ini = periodoAnterior(ini, 'mes')) {
      const m = totales(sesiones.filter((s) => s.fecha >= ini && s.fecha < finPeriodo(ini, 'mes'))).metros;
      barras.unshift([MESES[new Date(ini).getMonth()].slice(0, 3), Math.round(m / 100) / 10]);
    }
    historia = { titulo: 'Últimos 6 meses', barras, prom: null, promTexto: '' };
  }

  // Arriba, una etiqueta solo si es cierta: su mejor mes (o semana) del año, con 3 o más anteriores ese año.
  let kicker = '';
  const anio = new Date(inicio).getFullYear();
  const otros = [];
  for (let ini = periodoAnterior(inicio, periodo); new Date(ini).getFullYear() === anio; ini = periodoAnterior(ini, periodo)) {
    otros.push(totales(sesiones.filter((s) => s.fecha >= ini && s.fecha < finPeriodo(ini, periodo))).metros);
    if (otros.length > 60) break;
  }
  if (otros.filter((m) => m > 0).length >= 3 && t.metros > Math.max(...otros)) kicker = mes ? 'SU MEJOR MES DEL AÑO' : 'SU MEJOR SEMANA DEL AÑO';
  else if (plan && plan.hechas >= plan.total && fin <= (ctx.ahora ?? Date.now())) kicker = mes ? 'PLAN DEL MES COMPLETO' : 'SEMANA DEL PLAN COMPLETA';

  const xp = (del.map((s) => ctx.juego?.porSesion?.get(s.fecha)).filter(Boolean)).reduce((a, g) => a + (g.xp || 0) + (g.xpExtra || 0), 0);
  return {
    periodo, inicio, fin,
    rango: textoRango(inicio, periodo),
    km: km1(t.metros), metros: t.metros, sesiones: t.sesiones,
    cambio, antes, estado, kicker,
    equivalencia: equivalenciaPeriodo(t.metros),
    fichas, historia, avances,
    logros: logrosDelPeriodo(sesiones, inicio, fin, { periodo, juego: ctx.juego, primeraSemanaPlan: ctx.primeraSemanaPlan }),
    heroe: opciones.heroe === false || !ctx.heroe ? null : { ...ctx.heroe, xp },
    paisaje: ctx.paisaje || null,
  };
}
