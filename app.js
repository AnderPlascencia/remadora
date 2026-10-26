import { Remadora, BandaCardiaca } from './remadora.js';
import { VARIANTES } from './variantes.js';
import { formatoSplit, formatoTiempo, kcalPorSegundo } from './protocolo.js';
import { dibujar, dibujarPerfil } from './grafica.js';
import * as db from './db.js';
import * as Ent from './entrenamientos.js';

const VERSION = '0.3.0';
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
    if (b.dataset.vista === 'entrenar') { dibujarVivo(); vistaPrevia(); }
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
  else vistaPrevia();
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
    tVivoInicio: tVivo,
    distBase: actual.distancia,
    muestras: [],
    kcal: 0,
    paladas: 0,
    segConMeta: 0,
    segEnRango: 0,
    tiempoMeta: null,
    entrenamiento: entrenamientoActivo ? entrenamientoActivo.nombre : null,
    bloques: entrenamientoActivo && Ent.tipoDe(entrenamientoActivo) === 'intervalos' ? structuredClone(entrenamientoActivo.bloques) : null,
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
  vistaPrevia();
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
    paladas: Math.round(s.paladas),
    wattsProm: prom('w'),
    wattsMax: Math.max(...m.map((x) => x.w)),
    spmProm: prom('spm'),
    splitProm: conSplit.length ? Math.round(conSplit.reduce((a, x) => a + x.split, 0) / conSplit.length) : 0,
    fcProm: m.some((x) => x.fc) ? prom('fc') : 0,
    entrenamiento: s.entrenamiento,
    tiempoMeta: s.tiempoMeta,
    pctEnRango: s.segConMeta ? Math.round((100 * s.segEnRango) / s.segConMeta) : null,
    bloques: s.bloques,
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
    sesion.paladas += actual.spm / 60;
    sesion.muestras.push({
      t, w: actual.watts, spm: actual.spm, split: actual.split, dist, nivel: actual.nivel ?? 0, fc: actual.fc,
    });
    if (entrenamientoActivo) {
      if (Ent.tipoDe(entrenamientoActivo) === 'objetivo') actualizarObjetivo(t, dist);
      else {
        actualizarBloque(t);
        dibujarPerfil($('#grafica-perfil'), entrenamientoActivo.bloques, sesion.muestras.map((x) => [x.t, x.w]), t);
      }
    }
  }

  $('#m-watts').textContent = actual.watts;
  $('#m-nivel-etq').textContent = actual.nivel ? `· nivel ${actual.nivel}` : '';
  $('#m-split').textContent = formatoSplit(actual.split);
  $('#m-spm').textContent = actual.spm;
  $('#m-tiempo').textContent = formatoTiempo(t);
  $('#m-dist').textContent = sesion ? dist : (actual.distancia ?? 0);
  $('#m-paladas').textContent = sesion ? Math.round(sesion.paladas) : 0;
  $('#m-kcal').textContent = sesion ? Math.round(sesion.kcal) : 0;
  $('#m-fc').textContent = actual.fc || '-';
  if ($('#vista-entrenar').classList.contains('activa')) dibujarVivo();
}, 1000);

function dibujarVivo() {
  let metas = [];
  if (sesion && entrenamientoActivo && Ent.tipoDe(entrenamientoActivo) === 'intervalos') {
    metas = Ent.bandasPotencia(entrenamientoActivo).map((b) => ({
      desde: b.desde + sesion.tVivoInicio, hasta: b.hasta + sesion.tVivoInicio, min: b.min, max: b.max || b.min, eje: 'izq',
    }));
  }
  dibujar($('#grafica-vivo'), [
    { nombre: 'Watts', color: color('--watts'), eje: 'izq', puntos: vivo.watts },
    { nombre: 'Golpes/min', color: color('--spm'), eje: 'der', puntos: vivo.spm },
    { nombre: 'Split', color: color('--split'), eje: 'der', puntos: vivo.split.filter(([, v]) => v > 0 && v < 400).map(([t, v]) => [t, v / 4]) },
  ], { ventana: 300, metas });
}

// ---------- Entrenamiento en curso ----------
function marcarCaja(estadoRango) {
  const caja = $('#bloque-actual');
  caja.classList.toggle('dentro', estadoRango === 'dentro');
  caja.classList.toggle('fuera', estadoRango === 'bajo' || estadoRango === 'alto');
  const ind = $('#bloque-indicador');
  ind.className = `indicador ${estadoRango || ''}`;
  ind.textContent = { dentro: 'En rango', bajo: '▲ Sube la potencia', alto: '▼ Baja la potencia' }[estadoRango] || '';
}

function actualizarObjetivo(t, dist) {
  const ent = entrenamientoActivo;
  const p = Ent.progresoObjetivo(ent, { distancia: dist, kcal: sesion.kcal, paladas: sesion.paladas }, t);
  const unidad = Ent.METRICAS_OBJETIVO[p.metrica].unidad;
  $('#bloque-nombre').textContent = ent.nombre;
  $('#bloque-barra').style.width = `${100 * p.fraccion}%`;
  $('#bloque-siguiente').textContent = '';
  marcarCaja(null);
  if (p.completo) {
    if (sesion.tiempoMeta == null) {
      sesion.tiempoMeta = t;
      pitido(1046, 0.4);
      vibrar([200, 100, 200, 100, 400]);
    }
    $('#bloque-resta').textContent = formatoTiempo(sesion.tiempoMeta);
    $('#bloque-meta').textContent = `¡Meta cumplida! ${p.meta} ${unidad}`;
    $('#bloque-indicador').textContent = 'Puedes seguir remando o terminar la sesión';
    return;
  }
  $('#bloque-resta').textContent = `Faltan ${Math.ceil(p.falta)}`;
  $('#bloque-meta').textContent = `Llevas ${Math.floor(p.hecho)} de ${p.meta} ${unidad} · ${Math.floor(100 * p.fraccion)}%`;
  $('#bloque-siguiente').textContent = p.estimadoSeg != null ? `≈ ${formatoTiempo(p.estimadoSeg)} a este ritmo` : '';
}

// Muestra la meta del entrenamiento elegido antes de iniciar la sesión.
async function vistaPrevia() {
  if (sesion) return;
  const id = Number($('#sel-entrenamiento').value) || null;
  const ent = id ? await db.obtener('entrenamientos', id) : null;
  $('#bloque-actual').hidden = !ent;
  const conPerfil = !!ent && Ent.tipoDe(ent) === 'intervalos';
  $('#perfil-vivo').hidden = !conPerfil;
  if (conPerfil) dibujarPerfil($('#grafica-perfil'), ent.bloques);
  if (!ent) return;
  marcarCaja(null);
  $('#bloque-barra').style.width = '0%';
  $('#bloque-nombre').textContent = ent.nombre;
  if (Ent.tipoDe(ent) === 'objetivo') {
    const unidad = Ent.METRICAS_OBJETIVO[ent.objetivo.metrica].unidad;
    $('#bloque-resta').textContent = `Faltan ${ent.objetivo.valor}`;
    $('#bloque-meta').textContent = `Meta: ${ent.objetivo.valor} ${unidad}`;
  } else {
    const b = ent.bloques[0];
    $('#bloque-resta').textContent = formatoTiempo(Ent.duracionTotal(ent));
    $('#bloque-meta').textContent = `${ent.bloques.length} intervalos · empieza: ${b.nombre || 'intervalo'}${b.metrica === 'watts' ? ` ${b.min}–${b.max} W` : ''}`;
  }
  $('#bloque-siguiente').textContent = '';
  $('#bloque-indicador').textContent = remadora.conectada ? 'Pulsa Iniciar sesión para empezar' : 'Conecta la remadora y pulsa Iniciar sesión';
}
$('#sel-entrenamiento').addEventListener('change', vistaPrevia);

function actualizarBloque(t) {
  const ent = entrenamientoActivo;
  const total = Ent.duracionTotal(ent);
  const actualB = Ent.bloqueEn(ent, t);
  if (!actualB) {
    $('#bloque-nombre').textContent = '¡Entrenamiento completado!';
    $('#bloque-resta').textContent = formatoTiempo(t - total);
    $('#bloque-meta').textContent = sesion.segConMeta ? `En rango ${Math.round((100 * sesion.segEnRango) / sesion.segConMeta)}% del tiempo` : '';
    $('#bloque-siguiente').textContent = '';
    $('#bloque-barra').style.width = '100%';
    marcarCaja(null);
    if (sesion.bloqueAnterior !== ent.bloques.length) {
      sesion.bloqueAnterior = ent.bloques.length;
      sesion.tiempoMeta = total;
      pitido(1046, 0.4);
      vibrar([200, 100, 200]);
    }
    return;
  }
  const { i, bloque: b, resta, siguiente } = actualB;
  if (i !== sesion.bloqueAnterior) {
    if (sesion.bloqueAnterior !== -1) { pitido(988, 0.25); vibrar(250); }
    sesion.bloqueAnterior = i;
  }
  if (resta <= 3 && resta > 0) pitido(660, 0.08);
  $('#bloque-nombre').textContent = `${i + 1}/${ent.bloques.length} · ${b.nombre || 'Intervalo'}`;
  $('#bloque-resta').textContent = formatoTiempo(resta);
  const unidad = b.metrica === 'watts' ? 'W' : 'golpes/min';
  $('#bloque-meta').textContent = b.metrica ? `Meta: ${b.min}–${b.max} ${unidad}` : 'Libre';
  const sig = siguiente ? (siguiente.metrica ? `${siguiente.min}–${siguiente.max} ${siguiente.metrica === 'watts' ? 'W' : 'g/min'}` : 'libre') : '';
  $('#bloque-siguiente').textContent = siguiente ? `Sigue: ${siguiente.nombre || 'intervalo'} · ${sig}` : 'Último intervalo';
  $('#bloque-barra').style.width = `${(100 * t) / total}%`;
  const rango = Ent.enRango(b, actual.watts, actual.spm);
  if (rango) {
    sesion.segConMeta += 1;
    if (rango === 'dentro') sesion.segEnRango += 1;
  }
  marcarCaja(rango);
  if (rango && rango !== 'dentro' && b.metrica !== 'watts') {
    $('#bloque-indicador').textContent = rango === 'bajo' ? '▲ Sube el ritmo' : '▼ Baja el ritmo';
  }
}

// ---------- Editor de entrenamientos ----------
async function pintarEntrenamientos() {
  const lista = await db.listar('entrenamientos');
  const ul = $('#lista-ent');
  ul.innerHTML = '';
  if (!lista.length) ul.innerHTML = '<li class="suave">Aún no tienes entrenamientos. Crea uno o agrega los ejemplos.</li>';
  for (const ent of lista) {
    const li = document.createElement('li');
    li.innerHTML = '<div class="info"><div class="titulo"></div><div class="suave"></div></div>';
    li.querySelector('.titulo').textContent = ent.nombre;
    li.querySelector('.suave').textContent = Ent.describir(ent);
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
  if (sel.value !== previo) sel.value = '';
  vistaPrevia();
}

$('#btn-plantillas').addEventListener('click', async () => {
  const existentes = new Set((await db.listar('entrenamientos')).map((e) => e.nombre));
  for (const e of Ent.EJEMPLOS) if (!existentes.has(e.nombre)) await db.guardar('entrenamientos', structuredClone(e));
  pintarEntrenamientos();
});
$('#btn-nuevo-ent').addEventListener('click', () => abrirEditor({
  tipo: 'objetivo', nombre: '', objetivo: { metrica: 'distancia', valor: 2000 }, bloques: [],
}));
$('#btn-cancelar-ent').addEventListener('click', () => { $('#editor-ent').hidden = true; });

let enEdicion = null;
const form = $('#editor-ent');

function abrirEditor(ent) {
  enEdicion = structuredClone(ent);
  enEdicion.tipo = Ent.tipoDe(enEdicion);
  enEdicion.bloques = enEdicion.bloques || [];
  enEdicion.objetivo = enEdicion.objetivo || { metrica: 'distancia', valor: 2000 };
  form.nombre.value = enEdicion.nombre;
  form.tipo.value = enEdicion.tipo;
  form.obj_metrica.value = enEdicion.objetivo.metrica;
  form.obj_valor.value = enEdicion.objetivo.valor;
  form.hidden = false;
  mostrarTipo();
  pintarBloques();
  form.scrollIntoView({ behavior: 'smooth' });
}

function mostrarTipo() {
  enEdicion.tipo = form.tipo.value;
  $('#editor-objetivo').hidden = enEdicion.tipo !== 'objetivo';
  $('#editor-intervalos').hidden = enEdicion.tipo !== 'intervalos';
  if (enEdicion.tipo === 'intervalos' && !enEdicion.bloques.length) {
    enEdicion.bloques.push({ nombre: 'Calentamiento', duracion: 300, metrica: 'watts', min: 80, max: 120 });
    pintarBloques();
  }
  resumenEditor();
}
form.tipo.addEventListener('change', mostrarTipo);
form.obj_metrica.addEventListener('change', resumenEditor);
form.obj_valor.addEventListener('input', resumenEditor);

function pintarBloques() {
  const cont = $('#bloques');
  cont.innerHTML = '';
  enEdicion.bloques.forEach((b, i) => {
    const fila = document.createElement('div');
    fila.className = 'fila-bloque';
    fila.innerHTML = `
      <input data-k="nombre" placeholder="Nombre" maxlength="30">
      <input data-k="duracion" placeholder="Tiempo mm:ss" inputmode="numeric">
      <select data-k="metrica"><option value="watts">Potencia (W)</option><option value="spm">Golpes/min</option><option value="">Libre</option></select>
      <div class="par"><input data-k="min" type="number" placeholder="mín"><input data-k="max" type="number" placeholder="máx"></div>
      <button type="button" class="quitar">Quitar</button>`;
    fila.querySelector('[data-k=nombre]').value = b.nombre;
    fila.querySelector('[data-k=duracion]').value = Ent.formatoMmss(b.duracion);
    fila.querySelector('[data-k=metrica]').value = b.metrica;
    fila.querySelector('[data-k=min]').value = b.min || '';
    fila.querySelector('[data-k=max]').value = b.max || '';
    fila.addEventListener('change', (e) => {
      const k = e.target.dataset.k;
      if (k === 'duracion') b.duracion = Math.max(5, Ent.deMmss(e.target.value));
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
  if (!enEdicion) return;
  if (form.tipo.value === 'intervalos') dibujarPerfil($('#grafica-editor'), enEdicion.bloques);
  if (form.tipo.value === 'objetivo') {
    const m = Ent.METRICAS_OBJETIVO[form.obj_metrica.value];
    $('#ent-resumen').textContent = `La sesión termina al llegar a ${form.obj_valor.value || '?'} ${m.unidad}.`;
  } else {
    $('#ent-resumen').textContent = `${enEdicion.bloques.length} intervalos · duración total ${formatoTiempo(Ent.duracionTotal(enEdicion))}`;
  }
}

$('#btn-add-bloque').addEventListener('click', () => {
  const ultimo = enEdicion.bloques.at(-1);
  enEdicion.bloques.push({ nombre: '', duracion: 60, metrica: 'watts', min: ultimo?.min || 120, max: ultimo?.max || 150 });
  pintarBloques();
});
$('#btn-add-serie').addEventListener('click', () => {
  const n = (id) => Number($(id).value) || 0;
  const reps = n('#s-reps');
  const trabajo = Ent.deMmss($('#s-trabajo').value);
  if (!reps || !trabajo) { alert('Indica repeticiones y tiempo de trabajo'); return; }
  enEdicion.bloques.push(...Ent.serie({
    reps, trabajo, wMin: n('#s-wmin'), wMax: n('#s-wmax'),
    descanso: Ent.deMmss($('#s-descanso').value), dMin: n('#s-dmin'), dMax: n('#s-dmax'),
  }));
  $('#editor-intervalos details').open = false;
  pintarBloques();
});
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  enEdicion.nombre = form.nombre.value.trim();
  enEdicion.tipo = form.tipo.value;
  if (enEdicion.tipo === 'objetivo') {
    const valor = Number(form.obj_valor.value);
    if (!valor) { alert('Indica la cantidad de la meta'); return; }
    enEdicion.objetivo = { metrica: form.obj_metrica.value, valor };
    delete enEdicion.bloques;
  } else {
    if (!enEdicion.bloques.length) { alert('Agrega al menos un intervalo'); return; }
    for (const b of enEdicion.bloques) {
      if (b.metrica && b.max && b.max < b.min) { alert(`En "${b.nombre || 'un intervalo'}" el máximo es menor que el mínimo`); return; }
    }
    delete enEdicion.objetivo;
  }
  await db.guardar('entrenamientos', enEdicion);
  form.hidden = true;
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
    if (s.tiempoMeta != null) li.querySelector('.suave').append(` · meta en ${formatoTiempo(s.tiempoMeta)}`);
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
  if (s.paladas != null) stats.push(['Paladas', s.paladas]);
  if (s.tiempoMeta != null) stats.push(['Meta cumplida', formatoTiempo(s.tiempoMeta)]);
  if (s.pctEnRango != null) stats.push(['En rango', `${s.pctEnRango}%`]);
  $('#det-stats').innerHTML = stats.map(([k, v]) => `<div class="metrica"><span class="etq">${k}</span><span class="valor">${v}</span></div>`).join('');
  const m = s.muestras;
  dibujar($('#grafica-sesion'), [
    { color: color('--watts'), eje: 'izq', puntos: m.map((x) => [x.t, x.w]) },
    { color: color('--spm'), eje: 'der', puntos: m.map((x) => [x.t, x.spm]) },
  ]);
  $('#det-perfil').hidden = !s.bloques;
  if (s.bloques) dibujarPerfil($('#grafica-sesion-perfil'), s.bloques, m.map((x) => [x.t, x.w]));
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
