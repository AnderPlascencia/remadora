import { Remadora, BandaCardiaca } from './remadora.js';
import { VARIANTES } from './variantes.js';
import { formatoSplit, formatoTiempo, kcalPorSegundo } from './protocolo.js';
import { dibujar } from './grafica.js';
import * as db from './db.js';

const VERSION = '0.1.0';
const $ = (sel) => document.querySelector(sel);
const color = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const ajustes = {
  leer(clave, defecto) {
    try { return localStorage.getItem(clave) ?? defecto; } catch { return defecto; }
  },
  escribir(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
  },
};

// ---------- Pestañas ----------
document.querySelectorAll('.pestanas button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.pestanas button').forEach((x) => x.classList.toggle('activa', x === b));
    document.querySelectorAll('.vista').forEach((v) => v.classList.toggle('activa', v.id === `vista-${b.dataset.vista}`));
    if (b.dataset.vista === 'historial') pintarHistorial();
    if (b.dataset.vista === 'entrenamientos') pintarEntrenamientos();
    if (b.dataset.vista === 'entrenar') dibujarVivo();
  });
});

// ---------- Ajustes y registro ----------
const selVariante = $('#sel-variante');
for (const [clave, v] of Object.entries(VARIANTES)) selVariante.add(new Option(v.nombre, clave));
selVariante.value = ajustes.leer('variante', 'generica');
selVariante.addEventListener('change', () => ajustes.escribir('variante', selVariante.value));
const inPeso = $('#in-peso');
inPeso.value = ajustes.leer('peso', '75');
inPeso.addEventListener('change', () => ajustes.escribir('peso', inPeso.value));
$('#version').textContent = VERSION;

const lineasLog = [];
let logPendiente = false;
function agregarLog(linea) {
  lineasLog.push(linea);
  if (lineasLog.length > 5000) lineasLog.splice(0, lineasLog.length - 5000);
  if (!logPendiente) {
    logPendiente = true;
    requestAnimationFrame(() => {
      logPendiente = false;
      if ($('#vista-ajustes').classList.contains('activa')) $('#log').textContent = lineasLog.slice(-300).join('\n');
    });
  }
}
$('#btn-log').addEventListener('click', () => descargar(`remadora-registro-${marcaFecha()}.txt`, lineasLog.join('\n'), 'text/plain'));
$('#btn-log-limpiar').addEventListener('click', () => { lineasLog.length = 0; $('#log').textContent = ''; });

// ---------- Estado en vivo ----------
const remadora = new Remadora();
const banda = new BandaCardiaca();
const actual = { watts: 0, spm: 0, split: 0, distancia: null, nivel: null, fc: 0 };
const vivo = { watts: [], spm: [], split: [] };
let tVivo = 0;
let ultimoDato = 0;

if (!Remadora.soportado()) {
  $('#aviso-bt').hidden = false;
  $('#btn-conectar').disabled = true;
  $('#btn-banda').disabled = true;
}

remadora.addEventListener('log', (e) => agregarLog(e.detail));
remadora.addEventListener('estado', (e) => {
  const el = $('#estado');
  el.textContent = e.detail;
  el.classList.toggle('ok', e.detail === 'Conectada' || e.detail === 'Modo demo');
  const conectada = remadora.conectada;
  $('#btn-conectar').textContent = conectada ? 'Desconectar' : 'Conectar remadora';
  $('#btn-grabar').disabled = !conectada;
  if (!conectada && sesion) detenerSesion();
});
remadora.addEventListener('datos', (e) => {
  const d = e.detail;
  ultimoDato = Date.now();
  if (d.tipo === 'remada') { actual.spm = d.spm; actual.split = d.split; }
  if (d.tipo === 'metricas') { actual.watts = d.watts; actual.distancia = d.distancia; actual.nivel = d.resistencia; }
});
banda.addEventListener('fc', (e) => { actual.fc = e.detail; });

$('#btn-conectar').addEventListener('click', async () => {
  if (remadora.conectada) { remadora.desconectar(); return; }
  try {
    await remadora.conectar(selVariante.value);
  } catch (err) {
    agregarLog(`error: ${err.message}`);
    $('#estado').textContent = err.name === 'NotFoundError' ? 'Cancelado' : `Error: ${err.message}`;
  }
});
$('#btn-banda').addEventListener('click', async () => {
  try {
    const nombre = await banda.conectar();
    agregarLog(`banda conectada: ${nombre}`);
  } catch (err) { agregarLog(`banda: ${err.message}`); }
});
$('#btn-demo').addEventListener('click', () => {
  if (remadora.conectada) remadora.desconectar();
  else remadora.iniciarDemo();
});

// ---------- Sesión ----------
let sesion = null;
let entrenamientoActivo = null;
let wakeLock = null;

$('#btn-grabar').addEventListener('click', () => (sesion ? detenerSesion() : iniciarSesion()));

async function iniciarSesion() {
  const idEnt = Number($('#sel-entrenamiento').value) || null;
  entrenamientoActivo = idEnt ? await db.obtener('entrenamientos', idEnt) : null;
  sesion = {
    inicio: Date.now(),
    distBase: actual.distancia,
    muestras: [],
    kcal: 0,
    entrenamiento: entrenamientoActivo ? entrenamientoActivo.nombre : null,
    bloqueAnterior: -1,
  };
  $('#btn-grabar').textContent = 'Terminar sesión';
  $('#btn-grabar').classList.add('grabando');
  $('#sel-entrenamiento').disabled = true;
  $('#bloque-actual').hidden = !entrenamientoActivo;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
  pitido(880, 0.15);
}

async function detenerSesion() {
  const s = sesion;
  sesion = null;
  entrenamientoActivo = null;
  $('#btn-grabar').textContent = 'Iniciar sesión';
  $('#btn-grabar').classList.remove('grabando');
  $('#sel-entrenamiento').disabled = false;
  $('#bloque-actual').hidden = true;
  try { await wakeLock?.release(); } catch { /* nada */ }
  if (!s || s.muestras.length < 10) return;
  const m = s.muestras;
  const prom = (k) => Math.round(m.reduce((a, x) => a + x[k], 0) / m.length);
  const conSplit = m.filter((x) => x.split > 0);
  const registro = {
    fecha: s.inicio,
    duracion: m.at(-1).t,
    distancia: m.at(-1).dist,
    kcal: Math.round(s.kcal),
    wattsProm: prom('w'),
    wattsMax: Math.max(...m.map((x) => x.w)),
    spmProm: prom('spm'),
    splitProm: conSplit.length ? Math.round(conSplit.reduce((a, x) => a + x.split, 0) / conSplit.length) : 0,
    fcProm: m.some((x) => x.fc) ? prom('fc') : 0,
    entrenamiento: s.entrenamiento,
    muestras: m,
  };
  await db.guardar('sesiones', registro);
  pitido(660, 0.2);
  agregarLog(`sesión guardada: ${formatoTiempo(registro.duracion)}, ${registro.distancia} m`);
}

// Un tic por segundo: actualiza pantalla, gráfica y, si hay sesión, guarda la muestra.
setInterval(() => {
  const sinDatos = Date.now() - ultimoDato > 3000;
  if (sinDatos) { actual.watts = 0; actual.spm = 0; }

  tVivo += 1;
  for (const [k, v] of [['watts', actual.watts], ['spm', actual.spm], ['split', actual.split]]) {
    vivo[k].push([tVivo, v]);
    if (vivo[k].length > 600) vivo[k].shift();
  }

  let t = 0;
  let dist = 0;
  if (sesion) {
    t = Math.round((Date.now() - sesion.inicio) / 1000);
    if (sesion.distBase == null && actual.distancia != null) sesion.distBase = actual.distancia;
    dist = actual.distancia != null && sesion.distBase != null ? Math.max(0, actual.distancia - sesion.distBase) : 0;
    sesion.kcal += kcalPorSegundo(actual.watts);
    sesion.muestras.push({
      t, w: actual.watts, spm: actual.spm, split: actual.split, dist, nivel: actual.nivel ?? 0, fc: actual.fc,
    });
    if (entrenamientoActivo) actualizarBloque(t);
  }

  $('#m-watts').textContent = actual.watts;
  $('#m-split').textContent = formatoSplit(actual.split);
  $('#m-spm').textContent = actual.spm;
  $('#m-tiempo').textContent = formatoTiempo(t);
  $('#m-dist').textContent = sesion ? dist : (actual.distancia ?? 0);
  $('#m-nivel').textContent = actual.nivel ?? '-';
  $('#m-kcal').textContent = sesion ? Math.round(sesion.kcal) : 0;
  $('#m-fc').textContent = actual.fc || '-';
  if ($('#vista-entrenar').classList.contains('activa')) dibujarVivo();
}, 1000);

function dibujarVivo() {
  dibujar($('#grafica-vivo'), [
    { nombre: 'Watts', color: color('--watts'), eje: 'izq', puntos: vivo.watts },
    { nombre: 'Golpes/min', color: color('--spm'), eje: 'der', puntos: vivo.spm },
    { nombre: 'Split', color: color('--split'), eje: 'der', puntos: vivo.split.filter(([, v]) => v > 0 && v < 400).map(([t, v]) => [t, v / 4]) },
  ], { ventana: 300 });
}

// ---------- Entrenamientos ----------
// Un entrenamiento es una lista de bloques: { nombre, duracion (s), metrica: 'watts'|'spm'|'', min, max }.
function bloquesPlanos(ent) {
  let inicio = 0;
  return ent.bloques.map((b) => {
    const r = { ...b, desde: inicio, hasta: inicio + b.duracion };
    inicio += b.duracion;
    return r;
  });
}

function actualizarBloque(t) {
  const bloques = bloquesPlanos(entrenamientoActivo);
  const total = bloques.at(-1).hasta;
  const i = bloques.findIndex((b) => t < b.hasta);
  const caja = $('#bloque-actual');
  if (i === -1) {
    $('#bloque-nombre').textContent = '¡Entrenamiento completado!';
    $('#bloque-resta').textContent = formatoTiempo(t - total);
    $('#bloque-meta').textContent = 'Sigue remando o termina la sesión';
    $('#bloque-siguiente').textContent = '';
    $('#bloque-barra').style.width = '100%';
    caja.classList.remove('fuera', 'dentro');
    if (sesion.bloqueAnterior !== bloques.length) { sesion.bloqueAnterior = bloques.length; pitido(1046, 0.4); vibrar([200, 100, 200]); }
    return;
  }
  const b = bloques[i];
  if (i !== sesion.bloqueAnterior) {
    if (sesion.bloqueAnterior !== -1) { pitido(988, 0.25); vibrar(250); }
    sesion.bloqueAnterior = i;
  }
  const resta = b.hasta - t;
  if (resta <= 3 && resta > 0) pitido(660, 0.08);
  $('#bloque-nombre').textContent = `${i + 1}/${bloques.length} · ${b.nombre || 'Bloque'}`;
  $('#bloque-resta').textContent = formatoTiempo(resta);
  const unidad = b.metrica === 'watts' ? 'W' : 'golpes/min';
  $('#bloque-meta').textContent = b.metrica ? `Meta: ${b.min}–${b.max} ${unidad}` : 'Sin meta';
  $('#bloque-siguiente').textContent = bloques[i + 1] ? `Sigue: ${bloques[i + 1].nombre || 'bloque'}` : 'Último bloque';
  $('#bloque-barra').style.width = `${(100 * t) / total}%`;
  const valor = b.metrica === 'watts' ? actual.watts : actual.spm;
  const dentro = !b.metrica || (valor >= b.min && valor <= b.max);
  caja.classList.toggle('dentro', b.metrica && dentro);
  caja.classList.toggle('fuera', b.metrica && !dentro);
}

const EJEMPLOS = [
  {
    nombre: 'Base aeróbica 20 min',
    bloques: [
      { nombre: 'Calentamiento', duracion: 300, metrica: 'spm', min: 18, max: 22 },
      { nombre: 'Ritmo constante', duracion: 900, metrica: 'spm', min: 22, max: 24 },
      { nombre: 'Enfriamiento', duracion: 120, metrica: '', min: 0, max: 0 },
    ],
  },
  {
    nombre: 'Intervalos 8 × 1 min',
    bloques: [
      { nombre: 'Calentamiento', duracion: 300, metrica: 'spm', min: 18, max: 22 },
      ...Array.from({ length: 8 }, () => [
        { nombre: 'Fuerte', duracion: 60, metrica: 'watts', min: 160, max: 220 },
        { nombre: 'Suave', duracion: 60, metrica: 'spm', min: 16, max: 20 },
      ]).flat(),
      { nombre: 'Enfriamiento', duracion: 180, metrica: '', min: 0, max: 0 },
    ],
  },
];

async function pintarEntrenamientos() {
  const lista = await db.listar('entrenamientos');
  const ul = $('#lista-ent');
  ul.innerHTML = '';
  if (!lista.length) ul.innerHTML = '<li class="suave">Aún no tienes entrenamientos. Crea uno o agrega los ejemplos.</li>';
  for (const ent of lista) {
    const total = ent.bloques.reduce((a, b) => a + b.duracion, 0);
    const li = document.createElement('li');
    li.innerHTML = `<div class="info"><div class="titulo"></div><div class="suave">${ent.bloques.length} bloques · ${formatoTiempo(total)}</div></div>`;
    li.querySelector('.titulo').textContent = ent.nombre;
    const editar = document.createElement('button');
    editar.textContent = 'Editar';
    editar.onclick = () => abrirEditor(ent);
    const quitar = document.createElement('button');
    quitar.textContent = 'Borrar';
    quitar.className = 'peligro';
    quitar.onclick = async () => { if (confirm(`¿Borrar "${ent.nombre}"?`)) { await db.borrar('entrenamientos', ent.id); pintarEntrenamientos(); } };
    li.append(editar, quitar);
    ul.append(li);
  }
  await llenarSelectorEntrenamientos(lista);
}

async function llenarSelectorEntrenamientos(lista) {
  lista = lista || (await db.listar('entrenamientos'));
  const sel = $('#sel-entrenamiento');
  const previo = sel.value;
  sel.length = 1;
  for (const ent of lista) sel.add(new Option(ent.nombre, ent.id));
  sel.value = previo;
}

$('#btn-plantillas').addEventListener('click', async () => {
  for (const e of EJEMPLOS) await db.guardar('entrenamientos', structuredClone(e));
  pintarEntrenamientos();
});
$('#btn-nuevo-ent').addEventListener('click', () => abrirEditor({ nombre: '', bloques: [{ nombre: 'Calentamiento', duracion: 300, metrica: '', min: 0, max: 0 }] }));
$('#btn-cancelar-ent').addEventListener('click', () => { $('#editor-ent').hidden = true; });

let enEdicion = null;
function abrirEditor(ent) {
  enEdicion = structuredClone(ent);
  const f = $('#editor-ent');
  f.nombre.value = enEdicion.nombre;
  f.hidden = false;
  pintarBloques();
  f.scrollIntoView({ behavior: 'smooth' });
}

const aMmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function deMmss(txt) {
  const p = String(txt).split(':').map((x) => parseInt(x, 10) || 0);
  return p.length > 1 ? p[0] * 60 + p[1] : p[0];
}

function pintarBloques() {
  const cont = $('#bloques');
  cont.innerHTML = '';
  enEdicion.bloques.forEach((b, i) => {
    const fila = document.createElement('div');
    fila.className = 'fila-bloque';
    fila.innerHTML = `
      <input data-k="nombre" placeholder="Nombre" maxlength="30">
      <input data-k="duracion" placeholder="mm:ss" inputmode="numeric">
      <select data-k="metrica"><option value="">Sin meta</option><option value="watts">Watts</option><option value="spm">Golpes/min</option></select>
      <div style="display:flex;gap:6px"><input data-k="min" type="number" placeholder="mín"><input data-k="max" type="number" placeholder="máx"></div>
      <button type="button" class="quitar">Quitar</button>`;
    fila.querySelector('[data-k=nombre]').value = b.nombre;
    fila.querySelector('[data-k=duracion]').value = aMmss(b.duracion);
    fila.querySelector('[data-k=metrica]').value = b.metrica;
    fila.querySelector('[data-k=min]').value = b.min || '';
    fila.querySelector('[data-k=max]').value = b.max || '';
    fila.addEventListener('change', (e) => {
      const k = e.target.dataset.k;
      if (k === 'duracion') b.duracion = Math.max(5, deMmss(e.target.value));
      else if (k === 'min' || k === 'max') b[k] = Number(e.target.value) || 0;
      else b[k] = e.target.value;
      resumenEditor();
    });
    fila.querySelector('.quitar').onclick = () => { enEdicion.bloques.splice(i, 1); pintarBloques(); };
    cont.append(fila);
  });
  resumenEditor();
}

function resumenEditor() {
  const total = enEdicion.bloques.reduce((a, b) => a + b.duracion, 0);
  $('#ent-resumen').textContent = `${enEdicion.bloques.length} bloques · duración total ${formatoTiempo(total)}`;
}

$('#btn-add-bloque').addEventListener('click', () => {
  enEdicion.bloques.push({ nombre: '', duracion: 60, metrica: '', min: 0, max: 0 });
  pintarBloques();
});
$('#btn-add-serie').addEventListener('click', () => {
  const reps = parseInt(prompt('¿Cuántas repeticiones?', '6'), 10);
  if (!reps) return;
  const trabajo = deMmss(prompt('Duración del trabajo (mm:ss)', '1:00'));
  const descanso = deMmss(prompt('Duración del descanso (mm:ss)', '1:00'));
  const meta = prompt('Meta de watts para el trabajo (mín-máx), o vacío', '150-200');
  const [min, max] = (meta || '').split('-').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < reps; i++) {
    enEdicion.bloques.push({ nombre: `Trabajo ${i + 1}`, duracion: trabajo, metrica: meta ? 'watts' : '', min, max });
    if (descanso) enEdicion.bloques.push({ nombre: 'Descanso', duracion: descanso, metrica: '', min: 0, max: 0 });
  }
  pintarBloques();
});
$('#editor-ent').addEventListener('submit', async (e) => {
  e.preventDefault();
  enEdicion.nombre = e.target.nombre.value.trim();
  if (!enEdicion.bloques.length) { alert('Agrega al menos un bloque'); return; }
  await db.guardar('entrenamientos', enEdicion);
  e.target.hidden = true;
  pintarEntrenamientos();
});

// ---------- Historial ----------
let sesionAbierta = null;

async function pintarHistorial() {
  const lista = (await db.listar('sesiones')).sort((a, b) => b.fecha - a.fecha);
  const ul = $('#lista-sesiones');
  ul.innerHTML = '';
  $('#detalle-sesion').hidden = true;
  const totalM = lista.reduce((a, s) => a + s.distancia, 0);
  const totalT = lista.reduce((a, s) => a + s.duracion, 0);
  $('#resumen-historial').textContent = lista.length
    ? `${lista.length} ${lista.length === 1 ? 'sesión' : 'sesiones'} · ${(totalM / 1000).toFixed(1)} km · ${formatoTiempo(totalT)} en total. Línea: watts promedio por sesión.`
    : 'Todavía no hay sesiones guardadas.';
  const orden = [...lista].reverse();
  dibujar($('#grafica-tendencia'), [
    { color: color('--watts'), eje: 'izq', puntos: orden.map((s, i) => [i * 60, s.wattsProm]) },
  ], { sinEjeX: true, marcas: true });
  for (const s of lista) {
    const li = document.createElement('li');
    const f = new Date(s.fecha);
    li.innerHTML = `<div class="info"><div class="titulo">${f.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · ${f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="suave">${formatoTiempo(s.duracion)} · ${s.distancia} m · ${s.wattsProm} W prom · ${formatoSplit(s.splitProm)} /500 m</div></div>`;
    if (s.entrenamiento) li.querySelector('.suave').append(` · ${s.entrenamiento}`);
    const ver = document.createElement('button');
    ver.textContent = 'Ver';
    ver.onclick = () => abrirSesion(s);
    li.append(ver);
    ul.append(li);
  }
}

function abrirSesion(s) {
  sesionAbierta = s;
  $('#detalle-sesion').hidden = false;
  $('#det-titulo').textContent = new Date(s.fecha).toLocaleString('es-MX');
  const stats = [
    ['Duración', formatoTiempo(s.duracion)], ['Distancia', `${s.distancia} m`],
    ['Watts prom', s.wattsProm], ['Watts máx', s.wattsMax],
    ['Split prom', formatoSplit(s.splitProm)], ['Golpes/min', s.spmProm],
    ['kcal (est.)', s.kcal], ['Pulso prom', s.fcProm || '-'],
  ];
  $('#det-stats').innerHTML = stats.map(([k, v]) => `<div class="metrica"><span class="etq">${k}</span><span class="valor">${v}</span></div>`).join('');
  const m = s.muestras;
  dibujar($('#grafica-sesion'), [
    { color: color('--watts'), eje: 'izq', puntos: m.map((x) => [x.t, x.w]) },
    { color: color('--spm'), eje: 'der', puntos: m.map((x) => [x.t, x.spm]) },
  ]);
  $('#detalle-sesion').scrollIntoView({ behavior: 'smooth' });
}

$('#btn-cerrar-det').addEventListener('click', () => { $('#detalle-sesion').hidden = true; });
$('#btn-borrar').addEventListener('click', async () => {
  if (sesionAbierta && confirm('¿Borrar esta sesión?')) { await db.borrar('sesiones', sesionAbierta.id); pintarHistorial(); }
});
$('#btn-csv').addEventListener('click', () => {
  const s = sesionAbierta;
  const filas = ['segundo,watts,golpes_min,split_s_500m,distancia_m,nivel,pulso'];
  for (const x of s.muestras) filas.push([x.t, x.w, x.spm, x.split, x.dist, x.nivel, x.fc].join(','));
  descargar(`remo-${marcaFecha(s.fecha)}.csv`, filas.join('\n'), 'text/csv');
});
$('#btn-tcx').addEventListener('click', () => {
  const s = sesionAbierta;
  const iso = (t) => new Date(s.fecha + t * 1000).toISOString();
  const puntos = s.muestras.map((x) => `<Trackpoint><Time>${iso(x.t)}</Time><DistanceMeters>${x.dist}</DistanceMeters>${x.fc ? `<HeartRateBpm><Value>${x.fc}</Value></HeartRateBpm>` : ''}<Cadence>${x.spm}</Cadence><Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Watts>${x.w}</Watts></TPX></Extensions></Trackpoint>`).join('');
  const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Other"><Id>${iso(0)}</Id><Lap StartTime="${iso(0)}"><TotalTimeSeconds>${s.duracion}</TotalTimeSeconds><DistanceMeters>${s.distancia}</DistanceMeters><Calories>${s.kcal}</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${puntos}</Track></Lap><Notes>Remo indoor</Notes></Activity></Activities></TrainingCenterDatabase>`;
  descargar(`remo-${marcaFecha(s.fecha)}.tcx`, tcx, 'application/vnd.garmin.tcx+xml');
});

// ---------- Utilidades ----------
function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function marcaFecha(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

let audio = null;
function pitido(frecuencia, segundos) {
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = frecuencia;
    g.gain.setValueAtTime(0.2, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + segundos);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + segundos);
  } catch { /* sin audio */ }
}

function vibrar(patron) {
  try { navigator.vibrate?.(patron); } catch { /* sin vibración */ }
}

window.addEventListener('resize', dibujarVivo);
llenarSelectorEntrenamientos();
dibujarVivo();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
