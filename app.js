import { Remadora, BandaCardiaca } from './remadora.js';
import { VARIANTES } from './variantes.js';
import { formatoSplit, formatoTiempo, kcalPorSegundo } from './protocolo.js';
import { dibujar, dibujarPerfil, dibujarBarras, dibujarAvance } from './grafica.js';
import { crearCarrera, COLORES_RIVAL } from './carrera.js';
import * as F from './fantasma.js';
import * as db from './db.js';
import * as Ent from './entrenamientos.js';
import * as E from './estadisticas.js';
import { configurarVoz, hablar, tiempoHablado } from './voz.js';
import * as P from './programa.js';
import { confeti, tarjetaSesion } from './efectos.js';
import * as J from './juego.js';
import * as O from './objetos.js';

const VERSION = '0.9.1';
const $ = (sel) => document.querySelector(sel);
const color = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ico = (id) => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
const COLOR_ZONA = ['#94A3B8', '#38BDF8', '#22C55E', '#FACC15', '#F97316', '#EF4444'];

const ajustes = {
  leer(clave, defecto) {
    try { return localStorage.getItem(clave) ?? defecto; } catch { return defecto; }
  },
  escribir(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
  },
  num(clave, defecto) { return Number(this.leer(clave, defecto)) || defecto; },
  si(clave, defecto) { return this.leer(clave, defecto ? '1' : '0') === '1'; },
};
const ftp = () => ajustes.num('ftp', 0);
const fcMaxima = () => ajustes.num('fcMax', 0);

// ---------- Navegación ----------
const vistaActiva = (v) => $(`#vista-${v}`).classList.contains('activa');
function irA(vista) {
  document.querySelectorAll('.nav-inferior button').forEach((b) => {
    const activa = b.dataset.vista === vista;
    b.classList.toggle('activa', activa);
    b.setAttribute('aria-selected', activa);
  });
  document.querySelectorAll('.vista').forEach((v) => v.classList.toggle('activa', v.id === `vista-${vista}`));
  window.scrollTo(0, 0);
  if (vista === 'historial') pintarHistorial();
  if (vista === 'heroe') pintarHeroe();
  if (vista === 'entrenamientos') pintarEntrenamientos();
  if (vista === 'entrenar') { dibujarVivo(); vistaPrevia(); }
  if (vista === 'ajustes') $('#log').textContent = lineasLog.slice(-300).join('\n');
}
document.querySelectorAll('.nav-inferior button').forEach((b) => b.addEventListener('click', () => irA(b.dataset.vista)));

let toastTimer = null;
function toast(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

// ---------- Ajustes ----------
const selVariante = $('#sel-variante');
for (const [clave, v] of Object.entries(VARIANTES)) selVariante.add(new Option(v.nombre, clave));
selVariante.value = ajustes.leer('variante', 'generica');
selVariante.addEventListener('change', () => ajustes.escribir('variante', selVariante.value));

function campoNumero(sel, clave, defecto, alCambiar) {
  const el = $(sel);
  el.value = ajustes.leer(clave, defecto);
  el.addEventListener('change', () => { ajustes.escribir(clave, el.value); alCambiar?.(); });
}
campoNumero('#in-peso', 'peso', '75');
campoNumero('#in-ftp', 'ftp', '', () => { pintarZonas(); vistaPrevia(); });
campoNumero('#in-meta-semana', 'metaSemana', '10');
campoNumero('#in-fcmax', 'fcMax', '');

function interruptor(sel, clave, defecto, alCambiar) {
  const el = $(sel);
  el.checked = ajustes.si(clave, defecto);
  el.addEventListener('change', () => { ajustes.escribir(clave, el.checked ? '1' : '0'); alCambiar?.(el.checked); });
}
interruptor('#in-voz', 'voz', true, (v) => { configurarVoz(v); if (v) hablar('Avisos por voz activados'); });
interruptor('#in-modo-auto', 'modoAuto', false);
interruptor('#in-pausa-auto', 'pausaAuto', true);
interruptor('#in-res-auto', 'resAuto', false);
configurarVoz(ajustes.si('voz', true));
const selVistaRemo = $('#sel-vista-remo');
selVistaRemo.value = ajustes.leer('vistaRemo', 'numeros');
selVistaRemo.addEventListener('change', () => ajustes.escribir('vistaRemo', selVistaRemo.value));

// Tema: oscuro (por defecto), claro o alto contraste.
function aplicarTema() {
  const tema = ajustes.leer('tema', 'oscuro');
  if (tema === 'oscuro') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color('--fondo') || '#0F172A');
}
const selTema = $('#sel-tema');
selTema.value = ajustes.leer('tema', 'oscuro');
selTema.addEventListener('change', () => { ajustes.escribir('tema', selTema.value); aplicarTema(); dibujarVivo(); });
aplicarTema();
const selGuiado = $('#sel-guiado');
selGuiado.value = ajustes.leer('guiado', '0-0');
selGuiado.addEventListener('change', () => ajustes.escribir('guiado', selGuiado.value));

// Ritmo objetivo opcional (split /500 m): colorea los parciales y dibuja su línea en la carrera.
const inRitmo = $('#in-ritmo');
inRitmo.value = ajustes.leer('ritmoObjetivo', '');
inRitmo.addEventListener('change', () => {
  const v = leerMmss(inRitmo.value);
  inRitmo.value = v ? formatoSplit(v) : '';
  ajustes.escribir('ritmoObjetivo', inRitmo.value);
});
const ritmoObjetivo = () => leerMmss(ajustes.leer('ritmoObjetivo', '')) || 0;

// Pantalla de bienvenida: se desvanece sola.
setTimeout(() => $('#bienvenida')?.remove(), 1400);

// ---------- Fantasmas: hasta 3 a la vez, uno de ellos a tu medida ----------
const MAX_RIVALES = 3;
function rivalesElegidos() {
  try {
    const v = JSON.parse(ajustes.leer('rivales', '[]'));
    return Array.isArray(v) ? v.slice(0, MAX_RIVALES) : [];
  } catch { return []; }
}
function perso() {
  try { return { modo: 'ftp', valor: '', ...JSON.parse(ajustes.leer('fantasmaPerso', '{}')) }; } catch { return { modo: 'ftp', valor: '' }; }
}
const PERSO = {
  ftp: { etq: 'FTP del fantasma (W)', ayuda: () => `Rema cada intervalo a la intensidad del plan con ese FTP${ftp() ? ` (el tuyo es ${ftp()} W)` : ''}.`, ejemplo: () => String(Math.round((ftp() || 170) * 1.05)) },
  tiempo: { etq: 'Tiempo objetivo (mm:ss)', ayuda: () => 'Termina justo en ese tiempo. Solo para entrenamientos que acaban por distancia.', ejemplo: () => '7:30' },
  mejora: { etq: 'Más rápido que tu mejor (%)', ayuda: () => 'Tu mejor sesión de este entrenamiento, acelerada ese porcentaje.', ejemplo: () => '2' },
};
const leerMmss = (v) => {
  const m = /^\s*(\d{1,3}):([0-5]\d)\s*$/.exec(v || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function pintarChips() {
  const sel = rivalesElegidos();
  for (const b of document.querySelectorAll('#chips-rival .chip')) {
    const i = sel.indexOf(b.dataset.rival);
    b.setAttribute('aria-pressed', String(i >= 0));
    b.style.setProperty('--chip', i >= 0 ? COLORES_RIVAL[i] : '');
    b.disabled = !!sesion || (i < 0 && sel.length >= MAX_RIVALES);
  }
  // Durante la sesión los fantasmas ya están en el agua: se ocultan las opciones.
  $('.fantasmas').hidden = !!sesion;
  const panel = $('#perso-panel');
  panel.hidden = !sel.includes('perso');
  const p = perso();
  const info = PERSO[p.modo] || PERSO.ftp;
  $('#perso-modo').value = p.modo;
  if (document.activeElement !== $('#perso-valor')) $('#perso-valor').value = p.valor;
  $('#perso-valor').placeholder = info.ejemplo();
  $('#perso-etq').textContent = info.etq;
  $('#perso-ayuda').textContent = info.ayuda();
  for (const el of panel.querySelectorAll('select, input')) el.disabled = !!sesion;
}
$('#chips-rival').addEventListener('click', (ev) => {
  const b = ev.target.closest('.chip');
  if (!b || b.disabled) return;
  const sel = rivalesElegidos();
  const i = sel.indexOf(b.dataset.rival);
  if (i >= 0) sel.splice(i, 1); else sel.push(b.dataset.rival);
  ajustes.escribir('rivales', JSON.stringify(sel));
  pintarChips();
});
$('#perso-modo').addEventListener('change', () => {
  ajustes.escribir('fantasmaPerso', JSON.stringify({ modo: $('#perso-modo').value, valor: '' }));
  pintarChips();
});
$('#perso-valor').addEventListener('input', () => {
  ajustes.escribir('fantasmaPerso', JSON.stringify({ modo: $('#perso-modo').value, valor: $('#perso-valor').value.trim() }));
});

// Crea los fantasmas elegidos para este entrenamiento, cada uno con su color.
async function crearRivales(ent) {
  const lista = [];
  let guardadas = null;
  const sesiones = async () => (guardadas ??= await db.listar('sesiones'));
  for (const clave of rivalesElegidos()) {
    let r = null;
    if (F.NIVELES[clave]) r = F.simular(ent, clave, ftp());
    else if (clave === 'anterior' || clave === 'mejor') {
      r = E.elegirRival(await sesiones(), ent?.nombre, clave);
      if (r) r = { ...r, nombre: clave === 'mejor' ? 'Tu mejor marca' : 'Tu sesión anterior' };
      else toast(`Aún no hay ${clave === 'mejor' ? 'una marca' : 'una sesión anterior'} de este entrenamiento para el fantasma`);
    } else if (clave === 'perso') r = await fantasmaPerso(ent, sesiones);
    if (r) lista.push({ ...r, clave, color: COLORES_RIVAL[lista.length] });
  }
  return lista;
}

async function fantasmaPerso(ent, sesiones) {
  const { modo, valor } = perso();
  if (modo === 'tiempo') {
    const seg = leerMmss(valor);
    if (!seg) { toast('Escribe el tiempo objetivo del fantasma como mm:ss'); return null; }
    const r = F.simularPorTiempo(ent, seg, ftp());
    if (!r) toast('El fantasma por tiempo necesita un entrenamiento que acabe por distancia');
    return r;
  }
  if (modo === 'mejora') {
    const pct = Math.min(20, Math.max(-20, Number(String(valor).replace(',', '.')) || 2));
    const mejor = E.elegirRival(await sesiones(), ent?.nombre, 'mejor');
    if (!mejor) { toast('Aún no tienes una marca de este entrenamiento para acelerarla'); return null; }
    return F.acelerar(mejor, pct);
  }
  const w = Math.round(Number(valor)) || Math.round((ftp() || 170) * 1.05);
  return { ...F.simular(ent, { ftp: w }, ftp()), nombre: `Fantasma ${w} W` };
}

// Dos lienzos de carrera animada: el de Entrenar y el del modo remo. Tocar alterna 2D y 3D.
const carreraEnt = crearCarrera($('#carrera'));
const carreraRemo = crearCarrera($('#mr-grafica'));
function aplicarModoCarrera() {
  const m = ajustes.leer('vistaCarrera', '2d') === '3d' ? '3d' : '2d';
  carreraEnt.modo = m;
  carreraRemo.modo = m;
}
function alternarCarrera() {
  ajustes.escribir('vistaCarrera', carreraEnt.modo === '3d' ? '2d' : '3d');
  aplicarModoCarrera();
  if (sesion?.rival && !$('#modo-remo').hidden && vistaRemo() === 'carrera') pintarGraficaRemo(sesion.t);
}
aplicarModoCarrera();
$('#carrera').addEventListener('click', alternarCarrera);
$('#mr-grafica').addEventListener('click', () => {
  if (Date.now() - gestoHecho < 400) return;
  if (sesion?.rival && vistaRemo() === 'carrera') alternarCarrera();
});

function pintarZonas() {
  const f = ftp();
  $('#tabla-zonas').innerHTML = `<thead><tr><th>Zona</th><th>% FTP</th><th>${f ? 'Watts' : ''}</th></tr></thead><tbody>${
    Ent.ZONAS.map((z) => `<tr><td><span class="z" style="background:${COLOR_ZONA[z.n - 1]}"></span>Z${z.n} ${z.nombre}</td><td>${z.min}–${z.max}%</td><td>${
      f ? `${Math.round((z.min * f) / 100)}–${Math.round((z.max * f) / 100)} W` : ''}</td></tr>`).join('')}</tbody>`;
}
pintarZonas();

const selNivel = $('#sel-nivel-prueba');
for (let n = 1; n <= 24; n++) selNivel.add(new Option(`Nivel ${n}`, n));
selNivel.value = 8;
$('#btn-nivel-prueba').addEventListener('click', () => {
  if (!remadora.conectada) { toast('Conecta la remadora primero'); return; }
  remadora.fijarResistencia(Number(selNivel.value));
  toast(`Nivel ${selNivel.value} enviado. Revisa la consola.`);
});
$('#version-barra').textContent = `v${VERSION}`;
$('#version-ajustes').textContent = VERSION;

const lineasLog = [];
let logPendiente = false;
function agregarLog(linea) {
  lineasLog.push(linea);
  if (lineasLog.length > 5000) lineasLog.splice(0, lineasLog.length - 5000);
  if (!logPendiente) {
    logPendiente = true;
    requestAnimationFrame(() => {
      logPendiente = false;
      if (vistaActiva('ajustes')) $('#log').textContent = lineasLog.slice(-300).join('\n');
    });
  }
}
$('#btn-log').addEventListener('click', () => descargar(`remadora-registro-${marcaFecha()}.txt`, lineasLog.join('\n'), 'text/plain'));
$('#btn-log-limpiar').addEventListener('click', () => { lineasLog.length = 0; $('#log').textContent = ''; });

// ---------- Conexión y estado en vivo ----------
const remadora = new Remadora();
const banda = new BandaCardiaca();
const actual = { watts: 0, spm: 0, split: 0, distancia: null, nivel: null, fc: 0 };
const vivo = { watts: [], spm: [] };
let tVivo = 0;
let ultimoDato = 0;

if (!Remadora.soportado()) {
  $('#aviso-bt').hidden = false;
  $('#btn-conectar').disabled = true;
  $('#btn-banda').disabled = true;
}

remadora.addEventListener('log', (e) => agregarLog(e.detail));
remadora.addEventListener('estado', (e) => {
  const texto = e.detail;
  const el = $('#estado');
  el.textContent = texto;
  const conectada = remadora.conectada;
  el.classList.toggle('ok', texto === 'Conectada' || texto === 'Modo demo');
  el.classList.toggle('espera', /…$/.test(texto));
  $('#btn-conectar span').textContent = conectada || remadora.reconectando ? 'Desconectar' : 'Conectar remadora';
  $('#btn-demo').textContent = remadora.demoTimer ? 'Detener demo' : 'Modo demo';
  // El aviso de Bluetooth sobra mientras se usa el modo demo.
  if (!Remadora.soportado()) $('#aviso-bt').hidden = !!remadora.demoTimer;
  if (sesion) {
    if (texto.startsWith('Reconectando')) hablar('Conexión perdida, reconectando', { clave: 'reconectando', cadaSeg: 30 });
    if (texto === 'Conectada' && sesion.perdida) { hablar('Reconectada'); toast('Reconectada: la sesión sigue'); }
    sesion.perdida = !conectada;
    if (texto === 'Desconectada') toast('Sin conexión. La sesión sigue en pausa: reconecta o termínala.');
  }
  actualizarBotones();
  if (!sesion) vistaPrevia();
});
remadora.addEventListener('datos', (e) => {
  const d = e.detail;
  ultimoDato = Date.now();
  if (d.tipo === 'remada') { actual.spm = d.spm; actual.split = d.split; }
  if (d.tipo === 'metricas') {
    actual.watts = d.watts; actual.distancia = d.distancia; actual.nivel = d.resistencia;
    // En modo demo, sin banda conectada, simula el pulso para poder probar las zonas.
    if (remadora.demoTimer && !bandaConectada) actual.fc = Math.round(actual.fc ? actual.fc + (95 + d.watts / 3 - actual.fc) * 0.05 : 100);
  }
});
let bandaConectada = false;
banda.addEventListener('fc', (e) => { bandaConectada = true; actual.fc = e.detail; });

$('#btn-conectar').addEventListener('click', async () => {
  if (remadora.conectada || remadora.reconectando) { remadora.desconectar(); return; }
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
    toast(`Pulso conectado: ${nombre}`);
  } catch (err) { agregarLog(`banda: ${err.message}`); }
});
$('#btn-demo').addEventListener('click', () => {
  if (remadora.demoTimer) remadora.desconectar();
  else { remadora.iniciarDemo(); irA('entrenar'); }
});

// ---------- Sesión ----------
// Secciones plegables: recuerdan si estaban abiertas y redibujan su gráfica al abrirse.
for (const d of document.querySelectorAll('details.seccion')) {
  const clave = `seccion-${d.dataset.seccion}`;
  const guardado = ajustes.leer(clave, null);
  if (guardado != null) d.open = guardado === '1';
  d.addEventListener('toggle', () => {
    ajustes.escribir(clave, d.open ? '1' : '0');
    if (!d.open) return;
    if (d.dataset.seccion === 'forma') pintarForma();
    if (d.dataset.seccion === 'tendencia') pintarTendencia();
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ir]');
  if (b) irA(b.dataset.ir);
});

let sesion = null;
let entrenamientoPrevio = null;
let entrenamientoActivo = null;
let wakeLock = null;
pintarChips();

function actualizarBotones() {
  const g = $('#btn-grabar');
  g.disabled = !sesion && !remadora.conectada;
  g.classList.toggle('primario', !sesion);
  g.classList.toggle('peligro', !!sesion);
  g.classList.toggle('lleno', !!sesion);
  g.innerHTML = sesion ? `${ico('i-stop')}<span>Terminar</span>` : `${ico('i-play')}<span>Iniciar sesión</span>`;
  $('#btn-pausa').hidden = !sesion;
  const pausada = sesion?.pausaManual;
  for (const b of [$('#btn-pausa'), $('#mr-pausa')]) {
    b.innerHTML = pausada ? `${ico('i-play')}<span>Seguir</span>` : `${ico('i-pausa')}<span>Pausar</span>`;
    b.setAttribute('aria-label', pausada ? 'Reanudar' : 'Pausar');
  }
  $('#mr-pausa').disabled = !sesion;
  $('#mr-terminar').disabled = !sesion;
  $('#sel-entrenamiento').disabled = !!sesion;
  // Antes de remar se muestra la tarjeta Preparar; durante la sesión, solo una línea de resumen.
  $('#preparar').hidden = !!sesion;
  $('#resumen-sesion').hidden = !sesion;
  if (sesion) {
    const contra = sesion.rivales.length ? ` · contra ${sesion.rivales.map((r) => r.nombre.replace(/^Fantasma /, '')).join(', ')}` : '';
    $('#resumen-sesion').textContent = `${sesion.entrenamiento || 'Remo libre'}${contra}`;
  }
  pintarChips();
}

// Terminar pide un segundo toque para evitar cortes accidentales mientras se rema.
function confirmarTerminar(boton) {
  if (boton.dataset.confirmar) { delete boton.dataset.confirmar; detenerSesion(); return; }
  boton.dataset.confirmar = '1';
  const span = boton.querySelector('span');
  const previo = span.textContent;
  span.textContent = '¿Seguro?';
  setTimeout(() => { if (boton.dataset.confirmar) { delete boton.dataset.confirmar; span.textContent = previo; } }, 3000);
}

$('#btn-grabar').addEventListener('click', (e) => (sesion ? confirmarTerminar(e.currentTarget) : iniciarSesion()));
$('#mr-terminar').addEventListener('click', (e) => confirmarTerminar(e.currentTarget));
for (const b of ['#btn-pausa', '#mr-pausa']) {
  $(b).addEventListener('click', () => {
    if (!sesion) return;
    sesion.pausaManual = !sesion.pausaManual;
    if (!sesion.pausaManual) sesion.sinRemar = 0;
    hablar(sesion.pausaManual ? 'Pausa' : 'Seguimos', { urgente: true });
    actualizarBotones();
  });
}

// Bloques listos para el perfil, con duración estimada para los que terminan por distancia o paladas.
function paraPerfil(bloques) {
  return Ent.bloquesEnWatts(bloques.map((b) => ({ ...b, duracion: Ent.duracionEstimada(b) })), ftp());
}

function medidas() {
  return { t: sesion.t, dist: sesion.dist, paladas: sesion.paladas, split: actual.split, spm: actual.spm };
}

async function iniciarSesion() {
  const idEnt = Number($('#sel-entrenamiento').value) || null;
  entrenamientoActivo = idEnt ? await db.obtener('entrenamientos', idEnt) : null;
  const intervalos = entrenamientoActivo && Ent.tipoDe(entrenamientoActivo) === 'intervalos';
  const [calMin, enfMin] = ajustes.leer('guiado', '0-0').split('-').map(Number);
  const plan = intervalos ? Ent.normalizarBloques(Ent.conCalentamiento(entrenamientoActivo.bloques, calMin, enfMin), ftp(), fcMaxima()) : null;
  const rivales = await crearRivales(entrenamientoActivo);
  const rival = rivales[0] || null;
  sesion = {
    inicio: Date.now(),
    t: 0,
    dist: 0,
    distPrevia: actual.distancia,
    muestras: [],
    kcal: 0,
    paladas: 0,
    segConMeta: 0,
    segEnRango: 0,
    fueraSeguidos: 0,
    tiempoMeta: null,
    mitadAvisada: false,
    avance: [],
    entrenamiento: entrenamientoActivo ? entrenamientoActivo.nombre : null,
    pruebaFtp: !!entrenamientoActivo?.pruebaFtp,
    plan,
    estadoAv: plan ? Ent.crearAvance() : null,
    info: null,
    bloques: plan ? paraPerfil(plan) : null,
    bloqueAnterior: -1,
    avisoCerca: -1,
    rival,
    rivales,
    sinRemar: 0,
    empezo: false,
    pausaManual: false,
    perdida: false,
    ritmo: ritmoObjetivo(),
    n500: 0,
    t500: 0,
    parcial: null,
    lento: 0,
  };
  if (plan) sesion.info = Ent.avanzar(sesion.estadoAv, plan, medidas());
  actualizarBotones();
  $('#bloque-actual').hidden = !entrenamientoActivo;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
  pitido(880, 0.15);
  const contra = rivales.length > 1 ? `. Remas contra ${rivales.length} fantasmas` : rival ? '. Remas contra tu fantasma' : '';
  if (entrenamientoActivo) hablar(`Comienza ${entrenamientoActivo.nombre}${contra}`);
  else hablar(`Sesión iniciada${contra}`);
  if (ajustes.si('modoAuto', false)) abrirModoRemo();
  pintar();
}

async function detenerSesion() {
  const s = sesion;
  const ent = entrenamientoActivo;
  sesion = null;
  entrenamientoActivo = null;
  actualizarBotones();
  cerrarModoRemo();
  $('#pausa-aviso').hidden = true;
  $('#rival').hidden = true;
  carreraEnt.detener();
  carreraRemo.detener();
  cerrarFin();
  vistaPrevia();
  try { await wakeLock?.release(); } catch { /* nada */ }
  wakeLock = null;
  if (!s || s.muestras.length < 10) { toast('Sesión muy corta: no se guardó'); return; }
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
    fcProm: m.some((x) => x.fc) ? Math.round(m.filter((x) => x.fc).reduce((a, x) => a + x.fc, 0) / m.filter((x) => x.fc).length) : 0,
    fcMax: Math.max(0, ...m.map((x) => x.fc || 0)),
    entrenamiento: s.entrenamiento,
    tiempoMeta: s.tiempoMeta,
    pctEnRango: s.segConMeta ? Math.round((100 * s.segEnRango) / s.segConMeta) : null,
    bloques: s.plan ? Ent.bloquesConDuracion(s.estadoAv, s.plan, { t: s.t, dist: s.dist, paladas: s.paladas }) : null,
    muestras: m,
    ftp: ftp() || null,
    rpe: null,
    notas: '',
  };
  registro.estres = E.estres(registro, registro.ftp);
  if (s.pruebaFtp && ent) {
    let desde = 0;
    for (const b of ent.bloques) {
      if (b.prueba) {
        const tramo = m.filter((x) => x.t >= desde && x.t < desde + b.duracion);
        if (tramo.length >= b.duracion * 0.95) registro.pruebaWatts = Math.round(tramo.reduce((a, x) => a + x.w, 0) / tramo.length);
      }
      desde += b.duracion;
    }
  }
  if (s.rival) {
    const resumen = (r) => ({
      fecha: r.fecha ?? null, nivel: r.nivel ?? null, nombre: r.nombre, diferencia: Math.round(s.dist - E.distanciaEn(r.muestras, s.t)),
    });
    registro.rival = resumen(s.rival);
    if (s.rivales.length > 1) registro.rivales = s.rivales.map(resumen);
  }
  registro.marcas = E.marcasDeSesion(registro);
  const previas = await db.listar('sesiones');
  const id = await db.guardar('sesiones', registro);
  if (registro.id == null && id != null) registro.id = id;
  pitido(660, 0.2);
  agregarLog(`sesión guardada: ${formatoTiempo(registro.duracion)}, ${registro.distancia} m`);
  const recs = E.nuevosRecords(registro, previas);
  hablar(`Sesión terminada. ${(registro.distancia / 1000).toFixed(1).replace('.', ' punto ')} kilómetros${recs.length ? `. ${recs.length === 1 ? 'Nuevo récord' : `${recs.length} récords nuevos`}` : ''}. ¿Qué tan duro se sintió?`);
  abrirSesion(registro, { resumen: true, previas });
  pintarHoyToca();
}

// Un tic por segundo: lee el estado, avanza la sesión (si no está en pausa) y pinta.
setInterval(() => {
  if (Date.now() - ultimoDato > 3000) { actual.watts = 0; actual.spm = 0; }
  tVivo += 1;
  for (const [k, v] of [['watts', actual.watts], ['spm', actual.spm]]) {
    vivo[k].push([tVivo, v]);
    if (vivo[k].length > 600) vivo[k].shift();
  }
  if (sesion) avanzarSesion();
  if (!Remadora.soportado()) $('#aviso-bt').hidden = !!remadora.demoTimer;
  pintar();
}, 1000);

function enPausa() {
  if (!sesion) return false;
  if (sesion.pausaManual) return 'manual';
  if (!remadora.conectada) return 'conexion';
  if (ajustes.si('pausaAuto', true) && (!sesion.empezo || sesion.sinRemar >= 3)) return 'auto';
  return false;
}

function avanzarSesion() {
  const remando = actual.spm > 0 || actual.watts > 0;
  sesion.sinRemar = remando ? 0 : sesion.sinRemar + 1;
  if (remando) sesion.empezo = true;

  // Distancia acumulada aunque la consola reinicie su contador (por ejemplo tras reconectar).
  if (actual.distancia != null) {
    if (sesion.distPrevia == null) sesion.distPrevia = actual.distancia;
    const d = actual.distancia - sesion.distPrevia;
    sesion.dist += d >= 0 ? d : actual.distancia;
    sesion.distPrevia = actual.distancia;
  }

  const pausa = enPausa();
  if (pausa !== sesion.pausaPrevia) {
    if (pausa === 'auto' && sesion.empezo) hablar('Pausa', { clave: 'pausa', cadaSeg: 10 });
    if (!pausa && sesion.pausaPrevia === 'auto' && sesion.t > 0) hablar('Seguimos', { clave: 'seguimos', cadaSeg: 10 });
    sesion.pausaPrevia = pausa;
  }
  if (pausa) return;

  sesion.t += 1;
  const t = sesion.t;
  const peso = ajustes.num('peso', 75);
  sesion.kcal += kcalPorSegundo(actual.watts) + peso / 3600;
  sesion.paladas += actual.spm / 60;
  sesion.muestras.push({
    t, w: actual.watts, spm: actual.spm, split: actual.split, dist: Math.round(sesion.dist), nivel: actual.nivel ?? 0, fc: actual.fc,
  });
  coachRitmo(t);
  if (sesion.rival && t % 60 === 0) {
    const dif = Math.round(sesion.dist - E.distanciaEn(sesion.rival.muestras, t));
    if (Math.abs(dif) >= 5) hablar(`Vas ${Math.abs(dif)} metros ${dif > 0 ? 'adelante' : 'atrás'} de tu fantasma`, { clave: 'fantasma', cadaSeg: 50 });
  }
  if (!entrenamientoActivo) return;
  if (Ent.tipoDe(entrenamientoActivo) === 'objetivo') {
    sesion.avance.push([t, { distancia: sesion.dist, kcal: sesion.kcal, paladas: sesion.paladas }[entrenamientoActivo.objetivo.metrica]]);
    avanceObjetivo(t);
  } else avanceBloque(t);
}

const ANIMOS = ['¡Buen ritmo, sigue así!', 'Vas muy bien, mantén la técnica', 'Piernas, espalda, brazos. Así se rema', '¡Fuerte! Cada palada cuenta', 'Respira y mantén el ritmo'];

// Parciales de 500 m (con aviso por voz), ánimo de vez en cuando y aviso si el ritmo se cae.
function coachRitmo(t) {
  const n = Math.floor(sesion.dist / 500);
  if (n > sesion.n500) {
    const seg = t - sesion.t500;
    sesion.parcial = { seg, n };
    sesion.n500 = n;
    sesion.t500 = t;
    hablar(`${n * 500} metros. Parcial ${splitHablado(seg)}`, { clave: 'parcial', cadaSeg: 20 });
  }
  if (t % 240 === 0 && sesion.fueraSeguidos === 0) hablar(ANIMOS[(t / 240) % ANIMOS.length], { clave: 'animo', cadaSeg: 200 });
  // En intervalos los descansos bajan el ritmo a propósito: ahí manda el aviso de rango.
  if (sesion.plan || t < 60 || sesion.dist < 100) return;
  const ref = sesion.ritmo || (t * 500) / sesion.dist;
  const v = velocidadReciente();
  const reciente = v > 0 ? 500 / v : Infinity;
  sesion.lento = reciente > ref + (sesion.ritmo ? 3 : 6) ? sesion.lento + 1 : 0;
  if (sesion.lento >= 20) {
    sesion.lento = 0;
    hablar(sesion.ritmo ? `Vas más lento que tu ritmo objetivo de ${splitHablado(sesion.ritmo)}. Aprieta` : 'Estás bajando el ritmo. Aprieta', { clave: 'lento', cadaSeg: 60 });
  }
}

// Último parcial de 500 m: verde si va al ritmo objetivo (o mejor que tu promedio), rojo si no.
function textoParcial() {
  const p = sesion?.parcial;
  if (!p) return { texto: sesion?.ritmo ? `Objetivo ${formatoSplit(sesion.ritmo)}` : '', clase: '' };
  const ref = sesion.ritmo || (sesion.t500 * 500) / Math.max(1, p.n * 500);
  const clase = sesion.ritmo ? (p.seg <= ref ? 'ok' : 'mal') : (p.seg <= ref + 0.5 ? 'ok' : 'mal');
  return { texto: `Último 500 m ${formatoSplit(p.seg)}`, clase };
}

function avanceObjetivo(t) {
  const p = progresoActual(t);
  if (p.completo && sesion.tiempoMeta == null) {
    sesion.tiempoMeta = t;
    pitido(1046, 0.4);
    vibrar([200, 100, 200, 100, 400]);
    hablar(`¡Meta cumplida! en ${tiempoHablado(t)}. ¿Sigues o terminas?`, { urgente: true });
    mostrarFin();
  } else if (!p.completo && p.fraccion >= 0.5 && !sesion.mitadAvisada) {
    sesion.mitadAvisada = true;
    hablar(`Vas a la mitad. Faltan ${Math.ceil(p.falta)} ${Ent.METRICAS_OBJETIVO[p.metrica].unidad === 'm' ? 'metros' : Ent.METRICAS_OBJETIVO[p.metrica].unidad}`);
  }
}

// Al completar el entrenamiento se pregunta si seguir remando o terminar y guardar.
function mostrarFin() {
  const partes = [formatoTiempo(sesion.tiempoMeta ?? sesion.t), `${Math.round(sesion.dist)} m`];
  if (sesion.rival) partes.push(carreraActual().texto.replace(/^Vas /, ''));
  $('#fin-texto').textContent = partes.join(' · ');
  $('#fin-dialogo').hidden = false;
  $('#fin-terminar').focus();
  if (sesion.rival && carreraActual().tono === 'adelante') confeti();
}
function cerrarFin() { $('#fin-dialogo').hidden = true; }
$('#fin-seguir').addEventListener('click', () => { cerrarFin(); hablar('Seguimos'); });
$('#fin-terminar').addEventListener('click', () => { cerrarFin(); if (sesion) detenerSesion(); });

function progresoActual(t) {
  return Ent.progresoObjetivo(entrenamientoActivo, { distancia: sesion.dist, kcal: sesion.kcal, paladas: sesion.paladas }, t);
}

const splitHablado = (s) => `${Math.floor(s / 60)} ${String(s % 60).padStart(2, '0')}`;
function metaHablada(b) {
  const r = Ent.rangoWatts(b, ftp());
  if (r) return `${r.min} a ${r.max} watts`;
  if (b.metrica === 'split') return `split de ${splitHablado(b.min)} a ${splitHablado(b.max)}`;
  if (b.metrica === 'spm') return `${b.min} a ${b.max} golpes por minuto`;
  return 'ritmo libre';
}

function cantidadHablada(b) {
  const fin = Ent.finDe(b);
  if (fin === 'distancia') return `${b.cantidad} metros`;
  if (fin === 'paladas') return `${b.cantidad} paladas`;
  return `durante ${tiempoHablado(b.duracion)}`;
}

function avanceBloque(t) {
  const info = Ent.avanzar(sesion.estadoAv, sesion.plan, medidas());
  sesion.info = info;
  sesion.bloques = paraPerfil(Ent.bloquesConDuracion(sesion.estadoAv, sesion.plan, medidas()));
  if (info.terminado) {
    if (sesion.bloqueAnterior !== sesion.plan.length) {
      sesion.bloqueAnterior = sesion.plan.length;
      sesion.tiempoMeta = info.desde;
      pitido(1046, 0.4);
      vibrar([200, 100, 200]);
      const pct = sesion.segConMeta ? Math.round((100 * sesion.segEnRango) / sesion.segConMeta) : null;
      hablar(`Entrenamiento completado${pct != null ? `. Estuviste en rango el ${pct} por ciento del tiempo` : ''}. ¿Sigues o terminas?`, { urgente: true });
      mostrarFin();
    }
    return;
  }
  const { i, bloque: b, resta } = info;
  const fin = Ent.finDe(b);
  if (i !== sesion.bloqueAnterior) {
    if (sesion.bloqueAnterior !== -1) { pitido(988, 0.25); vibrar(250); }
    sesion.bloqueAnterior = i;
    sesion.fueraSeguidos = 0;
    hablar(`${b.nombre || 'Intervalo'}. ${metaHablada(b)}, ${cantidadHablada(b)}`, { urgente: true });
    if (b.nivel && ajustes.si('resAuto', false)) {
      remadora.fijarResistencia(b.nivel);
      agregarLog(`resistencia automática: nivel ${b.nivel}`);
    }
  }
  if (fin === 'tiempo' && resta <= 3 && resta > 0) {
    pitido(660, 0.08);
    if (b.duracion > 10) hablar(String(resta), { urgente: true });
  }
  const cerca = fin === 'distancia' ? 100 : fin === 'paladas' ? 10 : 0;
  if (cerca && resta <= cerca && Ent.cantidadDe(b) > cerca * 1.5 && sesion.avisoCerca !== i) {
    sesion.avisoCerca = i;
    pitido(660, 0.1);
    hablar(fin === 'distancia' ? 'Últimos 100 metros' : 'Últimas 10 paladas', { urgente: true });
  }
  const rango = Ent.enRango(b, actual.watts, actual.spm, ftp(), actual.split, actual.fc);
  if (rango) {
    sesion.segConMeta += 1;
    if (rango === 'dentro') sesion.segEnRango += 1;
  }
  sesion.fueraSeguidos = rango && rango !== 'dentro' ? sesion.fueraSeguidos + 1 : 0;
  if (sesion.fueraSeguidos >= 5 && info.restaSeg > 4) {
    const potencia = !!Ent.rangoWatts(b, ftp());
    const pulso = b.metrica === 'fc';
    const texto = pulso ? (rango === 'bajo' ? 'Pulso bajo, sube la intensidad' : 'Pulso alto, baja la intensidad')
      : rango === 'bajo' ? (potencia ? 'Sube la potencia' : 'Sube el ritmo') : (potencia ? 'Baja la potencia' : 'Baja el ritmo');
    hablar(texto, { clave: 'fuera', cadaSeg: 20 });
  }
}

// ---------- Pintado ----------
function textoIndicador(rango, potencia) {
  if (rango === 'dentro') return `${ico('i-check')}En rango`;
  if (rango === 'bajo') return `${ico('i-arriba')}${potencia ? 'Sube la potencia' : 'Sube el ritmo'}`;
  if (rango === 'alto') return `${ico('i-abajo')}${potencia ? 'Baja la potencia' : 'Baja el ritmo'}`;
  return '';
}

function marcarRango(rango, potencia = true) {
  const caja = $('#bloque-actual');
  caja.classList.toggle('dentro', rango === 'dentro');
  caja.classList.toggle('fuera', rango === 'bajo' || rango === 'alto');
  const ind = $('#bloque-indicador');
  ind.className = `indicador ${rango || ''}`;
  ind.innerHTML = textoIndicador(rango, potencia);
  const p = $('#mr-principal');
  p.classList.remove('dentro', 'bajo', 'alto');
  if (rango) p.classList.add(rango);
  $('#mr-indicador').innerHTML = textoIndicador(rango, potencia);
}

function pintarRival() {
  const r = sesion?.rival;
  // En Entrenar la carrera ya muestra la diferencia: el aviso de texto queda solo para el modo remo.
  $('#rival').hidden = true;
  $('#mr-rival').hidden = !r;
  $('#carrera').hidden = !r;
  if (!r) { carreraEnt.detener(); return; }
  const c = carreraActual();
  $('#carrera').setAttribute('aria-label', c.texto);
  if (vistaActiva('entrenar')) carreraEnt.actualizar(c.estado);
  for (const [caja, span] of [['#rival', '#rival-texto'], ['#mr-rival', '#mr-rival-texto']]) {
    $(span).textContent = c.texto;
    $(caja).classList.toggle('adelante', c.tono === 'adelante');
    $(caja).classList.toggle('atras', c.tono === 'atras');
  }
}

// Velocidad reciente (m/s) con los últimos ~20 s, para proyectar la llegada.
function velocidadReciente() {
  const m = sesion.muestras;
  if (m.length < 5) return actual.split > 0 ? 500 / actual.split : 0;
  const a = m[Math.max(0, m.length - 21)];
  const b = m.at(-1);
  return b.t > a.t ? (b.dist - a.dist) / (b.t - a.t) : 0;
}

// Todo lo que muestra la carrera en este segundo: textos, tono y estado para el lienzo.
function carreraActual() {
  const t = sesion.t;
  const rs = sesion.rivales;
  const obj = entrenamientoActivo?.objetivo;
  const meta = obj?.metrica === 'distancia' ? obj.valor : null;
  const difs = rs.map((r) => sesion.dist - E.distanciaEn(r.muestras, t));
  const lugar = 1 + difs.filter((d) => d < -0.5).length;
  const dif = Math.round(difs[0]);
  const r = rs[0];
  const quien = r.nivel && F.NIVELES[r.nivel] ? `fantasma ${F.NIVELES[r.nivel].nombre.toLowerCase()}` : (r.nombre || 'fantasma').replace(/^Fantasma/, 'fantasma');
  let texto = dif === 0 ? `Empatado con ${quien}` : `${Math.abs(dif)} m ${dif > 0 ? 'adelante' : 'atrás'} de ${quien}`;
  if (rs.length > 1) texto = `Vas ${lugar}º de ${rs.length + 1} · ${texto}`;
  // Verde solo si vas ganando, rojo solo si vas último; en medio, neutro.
  const tono = rs.length > 1 ? (lugar === 1 ? 'adelante' : lugar === rs.length + 1 ? 'atras' : '') : (dif > 0 ? 'adelante' : dif < 0 ? 'atras' : '');

  // Diferencia en segundos con el primer fantasma: cuánto tardó él en llegar a donde estás tú.
  let l1 = texto;
  const tr = F.tiempoA(r, sesion.dist);
  if (rs.length === 1 && sesion.dist > 20 && tr != null && Math.abs(dif) >= 1) {
    const seg = Math.round(t - tr);
    if (seg !== 0) l1 = `${Math.abs(dif)} m ${dif > 0 ? 'adelante' : 'atrás'} · ${Math.abs(seg)} s`;
  } else if (rs.length === 1 && dif === 0) l1 = 'Empatados';
  else if (rs.length > 1) l1 = `${lugar}º de ${rs.length + 1} · ${dif > 0 ? '+' : ''}${dif} m vs. ${quien.replace(/^fantasma /, '')}`;

  const v = velocidadReciente();
  const p = sesion.empezo && t >= 10 ? F.proyectar({ t, dist: sesion.dist, v }, rs, { meta, duracion: duracionCarrera() }) : null;
  let l2 = '';
  if (p?.tipo === 'meta') l2 = `A este ritmo llegas en ${formatoTiempo(Math.round(p.miTiempo))} · ${p.lugar}º de ${p.total}`;
  else if (p?.tipo === 'duracion') {
    const d = Math.round(p.filas[0].diferencia);
    l2 = `Al final: ${Math.round(p.miDist)} m · ${d >= 0 ? '+' : ''}${d} m vs. ${rs.length > 1 ? quien.replace(/^fantasma /, '') : 'fantasma'} · ${p.lugar}º de ${p.total}`;
  }
  const estado = {
    t,
    pausa: !!enPausa() || !sesion.empezo,
    yo: { dist: sesion.dist, v: actual.split > 0 ? 500 / actual.split : 0, spm: actual.spm },
    rivales: rs.map((x) => ({ nombre: x.nombre.replace(/^Fantasma /, ''), color: x.color, muestras: x.muestras, spmEn: (tt) => F.spmEn(x, tt) })),
    meta,
    cabecera: [l1, l2],
    tono,
    ritmo: sesion.ritmo ? { v: 500 / sesion.ritmo, etiqueta: `Ritmo ${formatoSplit(sesion.ritmo)}` } : null,
    yoColor: O.objeto(leerPersonaje().equipo?.bote)?.color || null,
  };
  return { texto, tono, estado, proyeccion: p };
}

// Duración de la carrera para proyectar cuando la meta no es una distancia.
function duracionCarrera() {
  const ent = entrenamientoActivo;
  if (ent && Ent.tipoDe(ent) === 'intervalos' && Ent.soloTiempo(ent)) return Ent.duracionTotal(ent);
  // En remo libre contra fantasmas simulados no hay un final que proyectar.
  if (!ent && sesion.rivales.every((r) => r.sintetico)) return null;
  return Math.max(...sesion.rivales.map((r) => r.muestras.at(-1)?.t || 0));
}

function pintar() {
  const t = sesion ? sesion.t : 0;
  const dist = sesion ? Math.round(sesion.dist) : (actual.distancia ?? 0);
  const f = ftp();
  const zona = Ent.zonaDe(actual.watts, f);
  const zfc = E.zonaFc(actual.fc, ajustes.num('fcMax', 0));
  $('#m-watts').textContent = actual.watts;
  $('#m-nivel-etq').textContent = actual.nivel ? `· nivel ${actual.nivel}` : '';
  $('#m-zona').textContent = zona ? `Z${zona.n} ${zona.nombre}` : '';
  $('#m-zona').style.color = zona ? COLOR_ZONA[zona.n - 1] : '';
  $('#m-split').textContent = formatoSplit(actual.split);
  $('#m-spm').textContent = actual.spm;
  $('#m-tiempo').textContent = formatoTiempo(t);
  $('#m-dist').textContent = dist;
  $('#m-paladas').textContent = sesion ? Math.round(sesion.paladas) : 0;
  $('#m-kcal').textContent = sesion ? Math.round(sesion.kcal) : 0;
  $('#m-fc').textContent = actual.fc || '-';
  $('#m-fc-zona').textContent = zfc ? `lpm · Z${zfc.n} ${zfc.nombre}` : 'lpm';
  $('#m-fc-zona').style.color = zfc ? COLOR_ZONA[zfc.n] : '';
  $('#m-mpp').textContent = sesion && sesion.paladas >= 5 ? (sesion.dist / sesion.paladas).toFixed(1) : '-';
  const par = textoParcial();
  for (const id of ['#m-parcial', '#mr-parcial']) {
    $(id).textContent = par.texto;
    $(id).classList.toggle('ok', par.clase === 'ok');
    $(id).classList.toggle('mal', par.clase === 'mal');
  }

  const pausa = enPausa();
  $('#pausa-aviso').hidden = !pausa;
  $('#pausa-aviso').textContent = {
    manual: 'En pausa: pulsa Seguir para continuar',
    auto: sesion?.empezo ? 'En pausa: empieza a remar para continuar' : 'Listo: el tiempo empieza con tu primera palada',
    conexion: 'Sin conexión con la remadora: la sesión está en pausa',
  }[pausa] || '';

  // Modo remo
  $('#mr-watts').textContent = actual.watts;
  $('#mr-split').textContent = formatoSplit(actual.split);
  $('#mr-spm').textContent = actual.spm;
  $('#mr-tiempo').textContent = formatoTiempo(t);
  $('#mr-dist').textContent = dist;
  $('#mr-fc').textContent = actual.fc || '-';
  $('#mr-fc').style.color = zfc ? COLOR_ZONA[zfc.n] : '';
  $('#mr-estado').textContent = $('#pausa-aviso').textContent;
  const objPaladas = entrenamientoActivo?.objetivo?.metrica === 'paladas';
  $('#mr-extra-etq').textContent = objPaladas ? 'Calorías' : (entrenamientoActivo?.objetivo ? 'Paladas' : 'Calorías');
  $('#mr-extra').textContent = sesion ? Math.round(objPaladas || !entrenamientoActivo?.objetivo ? sesion.kcal : sesion.paladas) : 0;
  pintarRival();

  if (sesion && entrenamientoActivo) {
    if (Ent.tipoDe(entrenamientoActivo) === 'objetivo') pintarObjetivo(t);
    else pintarBloque(t);
  } else if (sesion) {
    $('#mr-nombre').textContent = 'Remo libre';
    $('#mr-meta-texto').textContent = zona ? `Z${zona.n} ${zona.nombre}` : '';
    $('#mr-resta').textContent = formatoTiempo(t);
    $('#mr-resta-etq').textContent = 'tiempo';
    $('#mr-barra').style.width = '0%';
    marcarRango(null);
  }
  if (vistaActiva('entrenar')) dibujarVivo();
  if (!$('#modo-remo').hidden && vistaGrafica()) pintarGraficaRemo(t);
}

// Vista del modo remo: 'numeros', 'grafica' o 'carrera' (esta solo si hay fantasma).
function vistaRemo() {
  const v = ajustes.leer('vistaRemo', 'numeros');
  if (v === 'carrera' && !sesion?.rival) return 'grafica';
  return v;
}
const vistaGrafica = () => vistaRemo() !== 'numeros';
let leyendaRemo = '';
function leyenda(html) {
  if (html !== leyendaRemo) { $('#mr-leyenda').innerHTML = html; leyendaRemo = html; }
}

function pintarGraficaRemo(t) {
  const canvas = $('#mr-grafica');
  if (vistaRemo() === 'carrera') {
    const clases = ['lcar', 'lcar2', 'lcar3'];
    leyenda(`<span class="lw">Tú</span>${sesion.rivales.map((r, i) => `<span class="${clases[i]}">${r.nombre.replace(/^Fantasma /, '')}</span>`).join('')}`);
    canvas.setAttribute('aria-label', $('#mr-rival-texto').textContent);
    carreraRemo.actualizar(carreraActual().estado);
    return;
  }
  carreraRemo.detener();
  const ent = sesion ? entrenamientoActivo : null;
  const previa = !sesion && Number($('#sel-entrenamiento').value) ? entrenamientoPrevio : null;
  const plan = ent || previa;
  if (plan && Ent.tipoDe(plan) === 'intervalos') {
    leyenda('<span class="lr">Rango objetivo</span><span class="lf">Fuera de rango</span><span class="lp">Tu potencia</span>');
    canvas.setAttribute('aria-label', 'Plan de potencia con tu potencia real');
    dibujarPerfil(canvas, sesion ? sesion.bloques : paraPerfil(plan.bloques), sesion ? sesion.muestras.map((x) => [x.t, x.w]) : [], sesion ? t : null);
  } else if (plan) {
    const unidad = Ent.METRICAS_OBJETIVO[plan.objetivo.metrica].unidad;
    leyenda(`<span class="lw">Llevas (${unidad})</span><span class="lr">Meta ${plan.objetivo.valor} ${unidad}</span><span class="lp">Proyección a tu ritmo</span>`);
    canvas.setAttribute('aria-label', `Avance hacia la meta de ${plan.objetivo.valor} ${unidad}`);
    const p = sesion ? progresoActual(t) : null;
    dibujarAvance(canvas, sesion ? sesion.avance : [], plan.objetivo.valor, p && !p.completo && p.estimadoSeg != null ? t + p.estimadoSeg : null);
  } else {
    leyenda('<span class="lw">Watts</span><span class="ls">Golpes/min</span>');
    canvas.setAttribute('aria-label', 'Watts y golpes por minuto de los últimos 5 minutos');
    dibujar(canvas, [
      { color: color('--watts'), eje: 'izq', puntos: vivo.watts },
      { color: color('--spm'), eje: 'der', puntos: vivo.spm },
    ], { ventana: 300 });
  }
}

// Orden al tocar el botón: números → gráfica → carrera (si hay fantasma) → números.
function siguienteVista() {
  const v = vistaRemo();
  if (v === 'numeros') return 'grafica';
  if (v === 'grafica' && sesion?.rival) return 'carrera';
  return 'numeros';
}

function aplicarVistaRemo() {
  const v = vistaRemo();
  $('#modo-remo').classList.toggle('vista-grafica', v !== 'numeros');
  $('#modo-remo').classList.toggle('vista-carrera', v === 'carrera');
  const sig = siguienteVista();
  const b = $('#mr-vista');
  b.classList.toggle('activo', v !== 'numeros');
  b.innerHTML = { numeros: '<span class="num" aria-hidden="true">123</span>', grafica: ico('i-grafica'), carrera: ico('i-fantasma') }[sig];
  b.setAttribute('aria-label', { numeros: 'Cambiar a números grandes', grafica: 'Cambiar a vista de gráfica', carrera: 'Cambiar a vista de carrera' }[sig]);
}
$('#mr-vista').addEventListener('click', () => {
  ajustes.escribir('vistaRemo', siguienteVista());
  selVistaRemo.value = ajustes.leer('vistaRemo', 'numeros');
  aplicarVistaRemo();
  requestAnimationFrame(pintar);
});

function pintarObjetivo(t) {
  const ent = entrenamientoActivo;
  const p = progresoActual(t);
  const unidad = Ent.METRICAS_OBJETIVO[p.metrica].unidad;
  const pct = `${100 * p.fraccion}%`;
  $('#bloque-nombre').textContent = ent.nombre;
  $('#mr-nombre').textContent = ent.nombre;
  $('#bloque-barra').style.width = pct;
  $('#mr-barra').style.width = pct;
  marcarRango(null);
  if (p.completo) {
    $('#bloque-resta').textContent = formatoTiempo(sesion.tiempoMeta);
    $('#bloque-meta').textContent = `¡Meta cumplida! ${p.meta} ${unidad}`;
    $('#bloque-siguiente').textContent = '';
    $('#bloque-indicador').textContent = 'Puedes seguir remando o terminar la sesión';
    $('#mr-resta').textContent = formatoTiempo(sesion.tiempoMeta);
    $('#mr-resta-etq').textContent = 'meta cumplida';
    $('#mr-meta-texto').textContent = `¡Meta cumplida! ${p.meta} ${unidad}`;
    return;
  }
  $('#bloque-resta').textContent = `Faltan ${Math.ceil(p.falta)}`;
  $('#bloque-meta').textContent = `Llevas ${Math.floor(p.hecho)} de ${p.meta} ${unidad} · ${Math.floor(100 * p.fraccion)}%`;
  $('#bloque-siguiente').textContent = p.estimadoSeg != null ? `≈ ${formatoTiempo(p.estimadoSeg)} a este ritmo` : '';
  $('#mr-resta').textContent = Math.ceil(p.falta);
  $('#mr-resta-etq').textContent = `${unidad} faltan`;
  $('#mr-meta-texto').textContent = `${Math.floor(p.hecho)} de ${p.meta} ${unidad}${p.estimadoSeg != null ? ` · ≈ ${formatoTiempo(p.estimadoSeg)}` : ''}`;
}

const textoSiguiente = (b, f) => `${b.nombre || 'intervalo'} · ${Ent.finDe(b) === 'tiempo' ? '' : `${Ent.textoCantidad(b)} · `}${Ent.textoMeta(b, f, fcMaxima())}`;

function pintarBloque(t) {
  const f = ftp();
  const info = sesion.info;
  const puntos = sesion.muestras.map((x) => [x.t, x.w]);
  dibujarPerfil($('#grafica-perfil'), sesion.bloques, puntos, t);
  if (!$('#modo-remo').hidden && !vistaGrafica()) dibujarPerfil($('#mr-perfil'), sesion.bloques, puntos, t);
  if (!info) return;
  if (info.terminado) {
    const pctRango = sesion.segConMeta ? `En rango ${Math.round((100 * sesion.segEnRango) / sesion.segConMeta)}% del tiempo` : '';
    const extra = `+${formatoTiempo(t - (sesion.tiempoMeta ?? t))}`;
    $('#bloque-nombre').textContent = '¡Entrenamiento completado!';
    $('#bloque-resta').textContent = extra;
    $('#bloque-meta').textContent = pctRango;
    $('#bloque-siguiente').textContent = '';
    $('#bloque-barra').style.width = '100%';
    $('#mr-nombre').textContent = '¡Completado!';
    $('#mr-meta-texto').textContent = pctRango;
    $('#mr-resta').textContent = extra;
    $('#mr-resta-etq').textContent = 'extra';
    $('#mr-barra').style.width = '100%';
    marcarRango(null);
    return;
  }
  const { i, bloque: b, siguiente } = info;
  const nombre = `${i + 1}/${sesion.plan.length} · ${b.nombre || 'Intervalo'}`;
  const resta = Ent.textoResta(info);
  const meta = b.metrica ? Ent.textoMeta(b, f, fcMaxima()) : 'Libre';
  $('#bloque-nombre').textContent = nombre;
  $('#bloque-resta').textContent = resta;
  $('#bloque-meta').textContent = b.metrica ? `Meta: ${meta}` : 'Libre';
  $('#bloque-siguiente').textContent = siguiente ? `Sigue: ${textoSiguiente(siguiente, f)}` : 'Último intervalo';
  $('#bloque-barra').style.width = `${100 * info.fraccion}%`;
  $('#mr-nombre').textContent = nombre;
  $('#mr-meta-texto').textContent = meta;
  $('#mr-resta').textContent = resta;
  $('#mr-resta-etq').textContent = siguiente ? `luego ${Ent.textoMeta(siguiente, f, fcMaxima())}` : 'último';
  $('#mr-barra').style.width = `${100 * info.fraccion}%`;
  marcarRango(Ent.enRango(b, actual.watts, actual.spm, f, actual.split, actual.fc), !!Ent.rangoWatts(b, f));
}

function dibujarVivo() {
  const metas = [];
  const info = sesion?.info;
  if (info && !info.terminado) {
    const r = Ent.bloquesEnWatts([info.bloque], ftp())[0];
    if (r.metrica === 'watts') metas.push({ desde: tVivo - (sesion.t - info.desde), hasta: tVivo + info.restaSeg, min: r.min, max: r.max || r.min, eje: 'izq' });
  }
  dibujar($('#grafica-vivo'), [
    { nombre: 'Watts', color: color('--watts'), eje: 'izq', puntos: vivo.watts },
    { nombre: 'Golpes/min', color: color('--spm'), eje: 'der', puntos: vivo.spm },
  ], { ventana: 300, metas });
}

// Muestra la meta del entrenamiento elegido antes de iniciar la sesión.
async function vistaPrevia() {
  if (sesion) return;
  const id = Number($('#sel-entrenamiento').value) || null;
  const ent = id ? await db.obtener('entrenamientos', id) : null;
  if (sesion) return;
  entrenamientoPrevio = ent;
  $('#bloque-actual').hidden = !ent;
  const conPerfil = !!ent && Ent.tipoDe(ent) === 'intervalos';
  $('#perfil-vivo').hidden = !conPerfil;
  if (conPerfil) dibujarPerfil($('#grafica-perfil'), paraPerfil(ent.bloques));
  if (!ent) return;
  marcarRango(null);
  $('#bloque-barra').style.width = '0%';
  $('#bloque-nombre').textContent = ent.nombre;
  if (Ent.tipoDe(ent) === 'objetivo') {
    const unidad = Ent.METRICAS_OBJETIVO[ent.objetivo.metrica].unidad;
    $('#bloque-resta').textContent = `Faltan ${ent.objetivo.valor}`;
    $('#bloque-meta').textContent = `Meta: ${ent.objetivo.valor} ${unidad}`;
  } else {
    const b = ent.bloques[0];
    $('#bloque-resta').textContent = `${Ent.soloTiempo(ent) ? '' : '≈ '}${formatoTiempo(Ent.duracionTotal(ent))}`;
    $('#bloque-meta').textContent = `${ent.bloques.length} intervalos · empieza: ${b.nombre || 'intervalo'} ${Ent.textoMeta(b, ftp(), fcMaxima())}`;
    if (ent.bloques.some((x) => x.metrica === 'ftp') && !ftp()) {
      $('#bloque-siguiente').textContent = 'Define tu FTP en Ajustes para ver los watts';
      $('#bloque-indicador').textContent = '';
      return;
    }
  }
  $('#bloque-siguiente').textContent = '';
  $('#bloque-indicador').textContent = remadora.conectada ? 'Pulsa Iniciar sesión para empezar' : 'Conecta la remadora y pulsa Iniciar sesión';
}
$('#sel-entrenamiento').addEventListener('change', () => { ajustes.escribir('ultimoEnt', $('#sel-entrenamiento').value); vistaPrevia(); });

// ---------- Modo remo ----------
$('#btn-modo-remo').addEventListener('click', abrirModoRemo);
$('#mr-salir').addEventListener('click', cerrarModoRemo);

function abrirModoRemo() {
  const mr = $('#modo-remo');
  mr.hidden = false;
  const intervalos = !!sesion?.bloques || (!sesion && !$('#perfil-vivo').hidden);
  $('#mr-perfil').hidden = !intervalos;
  if (!sesion) {
    $('#mr-nombre').textContent = $('#sel-entrenamiento').selectedOptions[0]?.textContent || 'Remo libre';
    $('#mr-meta-texto').textContent = 'Pulsa Iniciar sesión fuera de este modo';
    $('#mr-resta').textContent = '';
    $('#mr-resta-etq').textContent = '';
  }
  aplicarVistaRemo();
  actualizarBotones();
  const vistas = ajustes.num('ayudaGestos', 0);
  if (vistas < 3) { ajustes.escribir('ayudaGestos', vistas + 1); toast('Doble toque: pausa · Desliza: cambia la vista'); }
  try { mr.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {}); } catch { /* opcional */ }
  pintar();
}

// Gestos en el modo remo: doble toque pausa o sigue; deslizar a un lado cambia de vista.
let gestoHecho = 0;
{
  const mr = $('#modo-remo');
  let inicio = null;
  let ultimoToque = 0;
  mr.addEventListener('pointerdown', (e) => { inicio = e.target.closest('button, select, input') ? null : { x: e.clientX, y: e.clientY, t: Date.now() }; });
  mr.addEventListener('pointerup', (e) => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    const rapido = Date.now() - inicio.t < 600;
    inicio = null;
    if (rapido && Math.abs(dx) > 60 && Math.abs(dy) < 60) {
      gestoHecho = Date.now();
      ajustes.escribir('vistaRemo', siguienteVista());
      selVistaRemo.value = ajustes.leer('vistaRemo', 'numeros');
      aplicarVistaRemo();
      requestAnimationFrame(pintar);
      return;
    }
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12 || !sesion) return;
    // En la carrera un toque cambia 2D/3D: ahí el doble toque no pausa.
    if (e.target.id === 'mr-grafica' && vistaRemo() === 'carrera') return;
    const ahora = Date.now();
    if (ahora - ultimoToque < 350) {
      ultimoToque = 0;
      gestoHecho = ahora;
      $('#mr-pausa').click();
      vibrar(60);
    } else ultimoToque = ahora;
  });
}

function cerrarModoRemo() {
  $('#modo-remo').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
// Si el usuario sale de pantalla completa con el gesto de atrás, también sale del modo remo.
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && !$('#modo-remo').hidden) $('#modo-remo').hidden = true;
});

// ---------- Editor de entrenamientos ----------
async function pintarEntrenamientos() {
  pintarPrograma();
  const lista = await db.listar('entrenamientos');
  const ul = $('#lista-ent');
  ul.innerHTML = '';
  if (!lista.length) {
    ul.innerHTML = `<li class="vacio vacio-grande">${ico('i-lista')}<h3>Aún no tienes entrenamientos</h3>
      <p>Empieza con los ejemplos (2000 m, intervalos, prueba FTP…) y luego ajústalos a tu gusto.</p>
      <button type="button" class="boton primario" data-ejemplos>Agregar ejemplos</button></li>`;
    ul.querySelector('[data-ejemplos]').addEventListener('click', () => $('#btn-plantillas').click());
  }
  for (const ent of lista) {
    const li = document.createElement('li');
    li.innerHTML = `<div class="info clic" role="button" tabindex="0"><div class="titulo"></div><div class="suave"></div></div>
      <div class="acciones">
        <button class="boton icono chico" data-a="editar" aria-label="Editar">${ico('i-editar')}</button>
        <button class="boton icono chico" data-a="duplicar" aria-label="Duplicar">${ico('i-copiar')}</button>
        <button class="boton icono chico peligro" data-a="borrar" aria-label="Borrar">${ico('i-borrar')}</button>
      </div>`;
    li.querySelector('.titulo').textContent = ent.nombre;
    if (ent.pruebaFtp) li.querySelector('.titulo').insertAdjacentHTML('beforeend', '<span class="etiqueta">FTP</span>');
    li.querySelector('.suave').textContent = Ent.describir(ent);
    const usar = () => {
      $('#sel-entrenamiento').value = ent.id;
      ajustes.escribir('ultimoEnt', ent.id);
      irA('entrenar');
      toast(`${ent.nombre} listo para entrenar`);
    };
    li.querySelector('.info').addEventListener('click', usar);
    li.querySelector('.info').addEventListener('keydown', (e) => { if (e.key === 'Enter') usar(); });
    li.querySelector('[data-a=editar]').onclick = () => abrirEditor(ent);
    li.querySelector('[data-a=duplicar]').onclick = async () => {
      const copia = structuredClone(ent);
      delete copia.id;
      copia.nombre = `${ent.nombre} (copia)`;
      await db.guardar('entrenamientos', copia);
      toast('Entrenamiento duplicado');
      pintarEntrenamientos();
    };
    li.querySelector('[data-a=borrar]').onclick = async () => {
      if (confirm(`¿Borrar "${ent.nombre}"?`)) { await db.borrar('entrenamientos', ent.id); pintarEntrenamientos(); }
    };
    ul.append(li);
  }
  await llenarSelectorEntrenamientos(lista);
}

async function llenarSelectorEntrenamientos(lista) {
  lista = lista || (await db.listar('entrenamientos'));
  const sel = $('#sel-entrenamiento');
  const previo = sel.value || ajustes.leer('ultimoEnt', '');
  sel.length = 1;
  for (const ent of lista) sel.add(new Option(ent.nombre, ent.id));
  sel.value = previo;
  if (sel.value !== String(previo)) sel.value = '';
  vistaPrevia();
  pintarHoyToca();
}

$('#btn-plantillas').addEventListener('click', async () => {
  const existentes = new Set((await db.listar('entrenamientos')).map((e) => e.nombre));
  let n = 0;
  for (const e of Ent.EJEMPLOS) if (!existentes.has(e.nombre)) { await db.guardar('entrenamientos', structuredClone(e)); n++; }
  toast(n ? `${n} ejemplos agregados` : 'Los ejemplos ya estaban');
  pintarEntrenamientos();
});
$('#btn-nuevo-ent').addEventListener('click', () => abrirEditor({
  tipo: 'objetivo', nombre: '', objetivo: { metrica: 'distancia', valor: 2000 }, bloques: [],
}));
$('#btn-cancelar-ent').addEventListener('click', () => { form.hidden = true; });

let enEdicion = null;
const form = $('#editor-ent');

function abrirEditor(ent) {
  enEdicion = structuredClone(ent);
  enEdicion.tipo = Ent.tipoDe(enEdicion);
  enEdicion.bloques = enEdicion.bloques || [];
  enEdicion.objetivo = enEdicion.objetivo || { metrica: 'distancia', valor: 2000 };
  $('#editor-titulo').textContent = ent.id ? 'Editar entrenamiento' : 'Nuevo entrenamiento';
  form.nombre.value = enEdicion.nombre;
  form.tipo.value = enEdicion.tipo;
  form.obj_metrica.value = enEdicion.objetivo.metrica;
  form.obj_valor.value = enEdicion.objetivo.valor;
  $('#ent-error').textContent = '';
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
  const bloques = enEdicion.bloques;
  bloques.forEach((b, i) => {
    const fila = document.createElement('div');
    fila.className = 'fila-bloque';
    fila.innerHTML = `
      <div class="nombre-bloque"><b>${i + 1}</b><input data-k="nombre" placeholder="Nombre del intervalo" aria-label="Nombre del intervalo ${i + 1}" maxlength="30"></div>
      <label><span class="mini">Termina por</span><select data-k="fin">
        <option value="tiempo">Tiempo</option><option value="distancia">Distancia</option><option value="paladas">Paladas</option>
      </select></label>
      <label><span class="mini etq-cantidad"></span><input data-k="cantidad" inputmode="numeric"></label>
      <label><span class="mini">Meta</span><select data-k="metrica">
        <option value="watts">Potencia (W)</option><option value="ftp">% de FTP</option><option value="split">Split (/500 m)</option><option value="spm">Golpes/min</option><option value="fc">Pulso (lpm)</option><option value="fcpct">% pulso máx</option><option value="">Libre</option>
      </select></label>
      <label><span class="mini">Rango <span class="unidad"></span></span><span class="par" style="margin:0"><input data-k="min" type="number" inputmode="numeric" placeholder="mín" aria-label="Mínimo"><input data-k="max" type="number" inputmode="numeric" placeholder="máx" aria-label="Máximo"></span></label>
      <label><span class="mini">Nivel (opcional)</span><input data-k="nivel" type="number" min="1" max="24" inputmode="numeric" placeholder="1–24"></label>
      <div class="zonas" hidden></div>
      <div class="controles">
        <button type="button" class="boton icono chico" data-a="subir" aria-label="Mover arriba" ${i === 0 ? 'disabled' : ''}>${ico('i-sube')}</button>
        <button type="button" class="boton icono chico" data-a="bajar" aria-label="Mover abajo" ${i === bloques.length - 1 ? 'disabled' : ''}>${ico('i-baja')}</button>
        <button type="button" class="boton icono chico" data-a="duplicar" aria-label="Duplicar intervalo">${ico('i-copiar')}</button>
        <button type="button" class="boton icono chico peligro" data-a="quitar" aria-label="Quitar intervalo">${ico('i-borrar')}</button>
      </div>`;
    const q = (k) => fila.querySelector(`[data-k=${k}]`);
    q('nombre').value = b.nombre || '';
    const fin = Ent.finDe(b);
    q('fin').value = fin;
    fila.querySelector('.etq-cantidad').textContent = { tiempo: 'Tiempo (mm:ss)', distancia: 'Metros', paladas: 'Paladas' }[fin];
    q('cantidad').value = fin === 'tiempo' ? Ent.formatoMmss(b.duracion) : (b.cantidad || '');
    q('metrica').value = b.metrica || '';
    const esSplit = b.metrica === 'split';
    for (const k of ['min', 'max']) {
      q(k).type = esSplit ? 'text' : 'number';
      q(k).placeholder = esSplit ? (k === 'min' ? '2:00' : '2:10') : (k === 'min' ? 'mín' : 'máx');
      q(k).value = b[k] ? (esSplit ? Ent.formatoMmss(b[k]) : b[k]) : '';
    }
    q('nivel').value = b.nivel || '';
    const unidadYZonas = () => {
      const m = b.metrica;
      fila.querySelector('.unidad').textContent = { watts: '(W)', ftp: '(% FTP)', split: '(mm:ss, rápido–lento)', spm: '(golpes/min)', fc: '(lpm)', fcpct: '(% pulso máx)' }[m] || '';
      q('min').disabled = !m;
      q('max').disabled = !m;
      const zonas = fila.querySelector('.zonas');
      zonas.hidden = m !== 'ftp';
      if (m === 'ftp') {
        const r = Ent.rangoWatts(b, ftp());
        zonas.innerHTML = Ent.ZONAS.map((z) => `<button type="button" data-z="${z.n}" title="${z.nombre}">Z${z.n}</button>`).join('')
          + `<span class="mini" style="align-self:center;margin-left:4px">${r ? `= ${r.min}–${r.max} W` : 'Define tu FTP en Ajustes'}</span>`;
        zonas.querySelectorAll('[data-z]').forEach((btn) => {
          btn.onclick = () => {
            const z = Ent.ZONAS[btn.dataset.z - 1];
            b.min = z.min; b.max = z.max;
            if (!b.nombre) b.nombre = `Zona ${z.n}`;
            pintarBloques();
          };
        });
      }
    };
    unidadYZonas();
    fila.addEventListener('change', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      if (k === 'cantidad') {
        if (Ent.finDe(b) === 'tiempo') b.duracion = Math.max(5, Ent.deMmss(e.target.value));
        else b.cantidad = Math.max(1, Math.round(Number(e.target.value)) || 0);
      } else if (k === 'fin') {
        b.fin = e.target.value;
        if (b.fin === 'tiempo') { delete b.fin; delete b.cantidad; b.duracion = b.duracion || 60; } else {
          b.cantidad = b.fin === 'distancia' ? 500 : 50;
          b.duracion = 0;
        }
        pintarBloques();
        return;
      } else if (k === 'min' || k === 'max') b[k] = b.metrica === 'split' ? Ent.deMmss(e.target.value) : (Number(e.target.value) || 0);
      else if (k === 'nivel') {
        const n = Math.round(Number(e.target.value));
        if (n >= 1 && n <= 24) b.nivel = n; else delete b.nivel;
      } else b[k] = e.target.value;
      if (k === 'metrica') {
        if (b.metrica === 'ftp' && (b.min > 200 || !b.min)) { b.min = 56; b.max = 75; }
        if (b.metrica === 'split') { b.min = 120; b.max = 130; }
        if (b.metrica === 'spm') { b.min = 22; b.max = 26; }
        if (b.metrica === 'fc') { b.min = 130; b.max = 150; }
        if (b.metrica === 'fcpct') { b.min = 60; b.max = 70; }
        pintarBloques();
        return;
      }
      if (k === 'min' || k === 'max') unidadYZonas();
      resumenEditor();
    });
    fila.querySelector('[data-a=subir]').onclick = () => { [bloques[i - 1], bloques[i]] = [bloques[i], bloques[i - 1]]; pintarBloques(); };
    fila.querySelector('[data-a=bajar]').onclick = () => { [bloques[i + 1], bloques[i]] = [bloques[i], bloques[i + 1]]; pintarBloques(); };
    fila.querySelector('[data-a=duplicar]').onclick = () => { bloques.splice(i + 1, 0, structuredClone(b)); pintarBloques(); };
    fila.querySelector('[data-a=quitar]').onclick = () => { bloques.splice(i, 1); pintarBloques(); };
    cont.append(fila);
  });
  resumenEditor();
}

function resumenEditor() {
  if (!enEdicion) return;
  if (form.tipo.value === 'intervalos') dibujarPerfil($('#grafica-editor'), paraPerfil(enEdicion.bloques));
  if (form.tipo.value === 'objetivo') {
    const m = Ent.METRICAS_OBJETIVO[form.obj_metrica.value];
    $('#ent-resumen').textContent = `La sesión termina al llegar a ${form.obj_valor.value || '?'} ${m.unidad}.`;
  } else {
    $('#ent-resumen').textContent = `${enEdicion.bloques.length} intervalos · duración total ${Ent.soloTiempo(enEdicion) ? '' : 'estimada ≈ '}${formatoTiempo(Ent.duracionTotal(enEdicion))}`;
  }
}

$('#btn-add-bloque').addEventListener('click', () => {
  const ultimo = enEdicion.bloques.at(-1);
  enEdicion.bloques.push({
    nombre: '', duracion: 60, metrica: ultimo?.metrica ?? 'watts', min: ultimo?.min || 120, max: ultimo?.max || 150,
  });
  pintarBloques();
});
$('#s-unidad').addEventListener('change', () => {
  const pct = $('#s-unidad').value === 'ftp';
  [['#s-wmin', 160, 91], ['#s-wmax', 190, 105], ['#s-dmin', '', 40], ['#s-dmax', '', 55]].forEach(([id, w, f]) => { $(id).value = pct ? f : w; });
});
$('#btn-add-serie').addEventListener('click', () => {
  const n = (id) => Number($(id).value) || 0;
  const reps = n('#s-reps');
  const trabajo = Ent.deMmss($('#s-trabajo').value);
  if (!reps || !trabajo) { $('#ent-error').textContent = 'Para la serie indica repeticiones y tiempo de trabajo.'; return; }
  $('#ent-error').textContent = '';
  const pct = $('#s-unidad').value === 'ftp';
  enEdicion.bloques.push(...Ent.serie({
    reps, trabajo, wMin: n('#s-wmin'), wMax: n('#s-wmax'),
    descanso: Ent.deMmss($('#s-descanso').value), dMin: n('#s-dmin'), dMax: n('#s-dmax'),
  }).map((b) => (pct && b.metrica ? { ...b, metrica: 'ftp' } : b)));
  $('#editor-intervalos details').open = false;
  pintarBloques();
});
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = (txt, foco) => { $('#ent-error').textContent = txt; foco?.focus(); };
  enEdicion.nombre = form.nombre.value.trim();
  if (!enEdicion.nombre) { error('Ponle un nombre al entrenamiento.', form.nombre); return; }
  enEdicion.tipo = form.tipo.value;
  if (enEdicion.tipo === 'objetivo') {
    const valor = Number(form.obj_valor.value);
    if (!(valor > 0)) { error('Indica la cantidad de la meta.', form.obj_valor); return; }
    enEdicion.objetivo = { metrica: form.obj_metrica.value, valor };
    delete enEdicion.bloques;
  } else {
    if (!enEdicion.bloques.length) { error('Agrega al menos un intervalo.'); return; }
    const malo = enEdicion.bloques.findIndex((b) => b.metrica && b.max && b.max < b.min);
    if (malo >= 0) { error(`En el intervalo ${malo + 1} el máximo es menor que el mínimo${enEdicion.bloques[malo].metrica === 'split' ? ' (en split, el mínimo es el ritmo más rápido)' : ''}.`); return; }
    const sinCantidad = enEdicion.bloques.findIndex((b) => !(Ent.cantidadDe(b) > 0));
    if (sinCantidad >= 0) { error(`Indica cuánto dura el intervalo ${sinCantidad + 1}.`); return; }
    delete enEdicion.objetivo;
  }
  $('#ent-error').textContent = '';
  await db.guardar('entrenamientos', enEdicion);
  form.hidden = true;
  toast('Entrenamiento guardado');
  pintarEntrenamientos();
});

// ---------- Progreso ----------
let periodo = 'semana';
let cacheSesiones = [];

document.querySelectorAll('.segmentado button').forEach((b) => b.addEventListener('click', () => {
  periodo = b.dataset.periodo;
  document.querySelectorAll('.segmentado button').forEach((x) => {
    x.classList.toggle('activo', x === b);
    x.setAttribute('aria-pressed', x === b);
  });
  pintarPeriodos();
}));

function formatoRecord(r, v) {
  if (r.tipo === 'tiempo') return formatoTiempo(v);
  return r.unidad === 'm' ? `${(v / 1000).toFixed(2)} km` : `${v} ${r.unidad}`;
}
const fechaCorta = (ms) => new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

function pintarPeriodos() {
  const n = periodo === 'semana' ? 8 : 6;
  const datos = E.resumenPeriodos(cacheSesiones, periodo, n).map((p, i, arr) => ({
    etiqueta: periodo === 'semana' ? fechaCorta(p.inicio) : new Date(p.inicio).toLocaleDateString('es-MX', { month: 'short' }),
    valor: Math.round(p.metros / 100) / 10,
    resaltar: i === arr.length - 1,
  }));
  dibujarBarras($('#grafica-periodos'), datos, { color: color('--primario'), formato: (v) => `${v}` });
  $('#grafica-periodos').setAttribute('aria-label', `Kilómetros por ${periodo}: ${datos.map((d) => `${d.etiqueta} ${d.valor}`).join(', ')}`);
}

let tendencia = 'potencia';
document.querySelectorAll('#seg-tendencia button').forEach((b) => b.addEventListener('click', () => {
  tendencia = b.dataset.tend;
  document.querySelectorAll('#seg-tendencia button').forEach((x) => {
    x.classList.toggle('activo', x === b);
    x.setAttribute('aria-pressed', x === b);
  });
  pintarTendencia();
}));
$('#filtro-ent').addEventListener('change', () => pintarHistorial());

const filtroCoincide = (s) => {
  const f = $('#filtro-ent').value;
  return f === '*' || (s.entrenamiento || '') === f;
};

function pintarTendencia() {
  const orden = cacheSesiones.filter(filtroCoincide).slice(0, 30).reverse();
  const x = (i) => i * 60;
  let series = [];
  let ley = '';
  let texto = '';
  if (tendencia === 'potencia') {
    ley = '<span class="lw">Watts promedio</span><span class="lt">Split promedio (s/500 m)</span>';
    series = [
      { color: color('--watts'), eje: 'izq', puntos: orden.map((s, i) => [x(i), s.wattsProm]) },
      { color: color('--split'), eje: 'der', puntos: orden.map((s, i) => [x(i), s.splitProm]).filter(([, v]) => v > 0) },
    ];
  } else if (tendencia === 'eficiencia') {
    const con = orden.map((s, i) => [x(i), E.tecnica(s).wattsPorLatido]).filter(([, v]) => v);
    ley = '<span class="lfc">Watts por latido</span><span class="lw">Pulso promedio</span>';
    series = [
      { color: color('--fc'), eje: 'izq', puntos: con },
      { color: color('--watts'), eje: 'der', puntos: orden.map((s, i) => [x(i), s.fcProm]).filter(([, v]) => v) },
    ];
    texto = con.length ? 'Si los watts por latido suben, produces más potencia con el mismo esfuerzo del corazón: tu condición mejora.'
      : 'Conecta tu banda o reloj de pulso para ver esta tendencia.';
  } else {
    ley = '<span class="lmpp">Metros por palada</span><span class="ljp">Trabajo por palada (J)</span>';
    series = [
      { color: color('--exito'), eje: 'izq', puntos: orden.map((s, i) => [x(i), E.tecnica(s).metrosPorPalada]).filter(([, v]) => v) },
      { color: color('--split'), eje: 'der', puntos: orden.map((s, i) => [x(i), E.tecnica(s).joulesPorPalada]).filter(([, v]) => v) },
    ];
    texto = 'Más metros y más trabajo por palada con los mismos golpes por minuto indica paladas más eficientes.';
  }
  $('#leyenda-tendencia').innerHTML = ley;
  $('#tendencia-texto').textContent = texto;
  dibujar($('#grafica-tendencia'), series, { sinEjeX: true, marcas: true, decimales: tendencia !== 'potencia' });
}

function pintarForma() {
  const datos = E.forma(cacheSesiones, ftp(), 60);
  const hay = datos.some((d) => d.carga > 0);
  const fx = (t) => {
    const d = datos[Math.round(t)];
    return d ? new Date(`${d.dia}T12:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
  };
  dibujar($('#grafica-forma'), [
    { color: color('--cond'), eje: 'izq', puntos: datos.map((d, i) => [i, d.condicion]) },
    { color: color('--fat'), eje: 'izq', puntos: datos.map((d, i) => [i, d.fatiga]) },
    { color: color('--fres'), eje: 'izq', puntos: datos.map((d, i) => [i, Math.max(0, d.frescura)]) },
  ], { formatoX: fx });
  const hoy = datos.at(-1);
  if (!ftp()) $('#forma-texto').textContent = 'Define tu FTP en Ajustes para calcular la carga de cada sesión.';
  else if (!hay) $('#forma-texto').textContent = 'Aún no hay sesiones en los últimos 60 días.';
  else {
    let consejo = 'Vas equilibrado.';
    if (hoy.frescura < -20) consejo = 'Llevas mucha fatiga acumulada: considera un día suave o de descanso.';
    else if (hoy.frescura > 10) consejo = 'Estás fresco: buen momento para una prueba o una sesión fuerte.';
    $('#forma-texto').textContent = `Condición ${hoy.condicion}, fatiga ${hoy.fatiga}, frescura ${hoy.frescura}. ${consejo}`;
  }
  $('#forma-resumen').textContent = ftp() && hay ? `Frescura ${hoy.frescura > 0 ? '+' : ''}${hoy.frescura}` : '';
}

function pintarAvisoRespaldo(total) {
  const ultimo = Number(ajustes.leer('ultimoRespaldo', 0));
  const dias = ultimo ? Math.floor((Date.now() - ultimo) / 864e5) : null;
  const av = $('#aviso-respaldo');
  av.hidden = !(total >= 3 && (dias == null || dias >= 7));
  if (!av.hidden) {
    av.innerHTML = `${dias == null ? 'Aún no guardas un respaldo de tus sesiones.' : `Tu último respaldo fue hace ${dias} días.`}
      <div class="fila-botones"><button class="boton primario" id="btn-respaldo-aviso">Guardar respaldo ahora</button></div>`;
    $('#btn-respaldo-aviso').onclick = guardarRespaldo;
  }
}

async function pintarHistorial() {
  const lista = (await db.listar('sesiones')).sort((a, b) => b.fecha - a.fecha);
  cacheSesiones = lista;
  $('#progreso-vacio').hidden = lista.length > 0;
  $('#progreso-contenido').hidden = !lista.length;

  const dias = E.racha(lista);
  $('#racha').textContent = dias;
  $('#racha-etq').textContent = dias === 1 ? 'día seguido' : 'días seguidos';
  const semana = E.resumenPeriodos(lista, 'semana', 1)[0];
  const meta = ajustes.num('metaSemana', 10);
  const km = semana.metros / 1000;
  $('#semana-texto').textContent = `${km.toFixed(1)} de ${meta} km · ${semana.sesiones} ${semana.sesiones === 1 ? 'sesión' : 'sesiones'}`;
  $('#semana-barra').style.width = `${Math.min(100, (100 * km) / meta)}%`;
  pintarAvisoRespaldo(lista.length);
  pintarPeriodos();
  pintarForma();

  // Filtro por entrenamiento
  const sel = $('#filtro-ent');
  const previo = sel.value;
  const nombres = [...new Set(lista.map((s) => s.entrenamiento || ''))];
  sel.length = 1;
  for (const n of nombres) sel.add(new Option(n || 'Remo libre', n));
  sel.value = nombres.includes(previo) ? previo : '*';
  pintarTendencia();

  const ins = E.insignias(lista);
  $('#insignias-resumen').textContent = `${ins.filter((x) => x.ganada).length} de ${ins.length}`;
  $('#insignias').innerHTML = ins.map((x) => `<div class="insignia${x.ganada ? '' : ' bloqueada'}" title="${x.detalle}"><span class="medalla">${ico('i-trofeo')}</span>
    <b>${x.nombre}</b><small>${x.ganada ? fechaCorta(x.fecha) : x.detalle}</small></div>`).join('');

  const recs = E.calcularRecords(lista);
  $('#records').innerHTML = E.RECORDS.filter((r) => recs[r.clave]).map((r) => `<div class="record"><div class="etq">${r.nombre}</div>
    <div class="valor">${formatoRecord(r, recs[r.clave].valor)}</div><div class="sub">${fechaCorta(recs[r.clave].fecha)}</div></div>`).join('');

  const visibles = lista.filter(filtroCoincide);
  const ul = $('#lista-sesiones');
  ul.innerHTML = '';
  const totalM = visibles.reduce((a, s) => a + s.distancia, 0);
  const totalT = visibles.reduce((a, s) => a + s.duracion, 0);
  $('#resumen-historial').textContent = visibles.length
    ? `${visibles.length} ${visibles.length === 1 ? 'sesión' : 'sesiones'} · ${(totalM / 1000).toFixed(1)} km · ${formatoTiempo(totalT)} en total`
    : '';
  if (!visibles.length) ul.innerHTML = '<li class="vacio">Todavía no hay sesiones. Tu primera sesión aparecerá aquí.</li>';
  for (const s of visibles) {
    const li = document.createElement('li');
    li.className = 'clic';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    const f = new Date(s.fecha);
    li.innerHTML = `<div class="info"><div class="titulo"></div><div class="suave"></div></div>${ico('i-baja')}`;
    li.querySelector('.ico').style.transform = 'rotate(-90deg)';
    li.querySelector('.titulo').textContent = `${f.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · ${s.entrenamiento || 'Remo libre'}`;
    if (s.rpe) li.querySelector('.titulo').insertAdjacentHTML('beforeend', `<span class="rpe-chip">Esfuerzo ${s.rpe}</span>`);
    li.querySelector('.suave').textContent = `${formatoTiempo(s.duracion)} · ${s.distancia} m · ${s.wattsProm} W · ${formatoSplit(s.splitProm)} /500 m${s.tiempoMeta != null ? ` · meta en ${formatoTiempo(s.tiempoMeta)}` : ''}${s.notas ? ` · “${s.notas.slice(0, 40)}${s.notas.length > 40 ? '…' : ''}”` : ''}`;
    li.addEventListener('click', () => abrirSesion(s, { previas: lista.filter((x) => x.id !== s.id && x.fecha < s.fecha) }));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') li.click(); });
    ul.append(li);
  }
}

// ---------- Héroe ----------
function leerPersonaje() {
  try { return JSON.parse(ajustes.leer('personaje', 'null')) || {}; } catch { return {}; }
}
function guardarPersonaje(cambios) {
  ajustes.escribir('personaje', JSON.stringify({ ...leerPersonaje(), ...cambios }));
}
const emblema = (c) => `<svg viewBox="0 0 24 24" aria-hidden="true">${c.icono}</svg>`;
const nombreAtributo = (k) => J.ATRIBUTOS.find((a) => a.clave === k)?.nombre || k;
const miles = (n) => Math.round(n).toLocaleString('es-MX');
const icoMoneda = '<svg class="moneda" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>';
let claseElegida = null;
let seccionHeroe = 'ficha';
let talentoElegido = null;

async function estadoHeroe() {
  const per = leerPersonaje();
  return { per, h: J.estadoJuego(await db.listar('sesiones'), { ftp: ftp(), per }) };
}

async function pintarHeroe() {
  const per = leerPersonaje();
  const clase = J.claseDe(per.clase);
  $('#heroe-crear').hidden = !!clase;
  $('#heroe-ficha').hidden = !clase;
  if (!clase) {
    $('#clases').innerHTML = J.CLASES.map((c) => `<button type="button" class="clase" role="radio" aria-checked="${c.clave === claseElegida}" data-clase="${c.clave}">
      <span class="emblema">${emblema(c)}</span><b>${c.nombre}</b><span class="fav">+15 % ${nombreAtributo(c.favorito)}</span><small>${c.lema}</small></button>`).join('');
    $('#btn-crear-heroe').disabled = !claseElegida;
    if (per.nombre && !$('#heroe-nombre').value) $('#heroe-nombre').value = per.nombre;
    return;
  }
  const sesiones = await db.listar('sesiones');
  const h = J.estadoJuego(sesiones, { ftp: ftp(), per });
  $('#heroe-avatar').innerHTML = O.dibujarHeroe(per, { tam: 84 }) + `<span class="emblema mini">${emblema(clase)}</span>`;
  $('#heroe-titulo').textContent = per.nombre || `${clase.nombre} sin nombre`;
  $('#heroe-clase').textContent = `${clase.nombre} · ${h.titulo}`;
  $('#heroe-monedas').innerHTML = `${icoMoneda}${miles(h.monedas)}`;
  $('#heroe-nivel').textContent = h.nivel;
  const pct = h.hasta ? (100 * (h.xp - h.desde)) / (h.hasta - h.desde) : 100;
  $('#heroe-xp-barra').style.width = `${pct}%`;
  $('#heroe-xp-texto').textContent = h.hasta ? `${miles(h.xp)} XP · faltan ${miles(h.hasta - h.xp)} para el nivel ${h.nivel + 1}` : `${miles(h.xp)} XP · nivel máximo`;
  for (const b of document.querySelectorAll('.heroe-tabs button')) {
    b.classList.toggle('activa', b.dataset.hp === seccionHeroe);
    if (b.dataset.hp === 'talentos') b.dataset.aviso = h.talentosLibres > 0 ? h.talentosLibres : '';
  }
  for (const el of document.querySelectorAll('.hp')) el.hidden = el.id !== `hp-${seccionHeroe}`;
  ({ ficha: pintarFicha, talentos: pintarTalentos, misiones: pintarMisiones, armario: pintarArmario, tienda: pintarTienda })[seccionHeroe](h, per, clase, sesiones);
}

function pintarFicha(h, per, clase, sesiones) {
  const max = Math.max(50, ...Object.values(h.atributos));
  $('#heroe-atributos').innerHTML = J.ATRIBUTOS.map((a) => `<div class="atributo${a.clave === clase.favorito ? ' fav' : ''}">
    <div class="fila"><b>${a.nombre}${a.clave === clase.favorito ? ' ★' : ''}</b><span class="valor">${h.atributos[a.clave]}</span></div>
    <div class="at-barra"><div style="width:${(100 * h.atributos[a.clave]) / max}%"></div></div><small>${a.detalle}</small></div>`).join('');
  const ult = [...sesiones].sort((a, b) => b.fecha - a.fecha).slice(0, 5);
  $('#heroe-sesiones').innerHTML = ult.length ? ult.map((x) => {
    const g = h.porSesion.get(x.fecha);
    return `<li><div><b>${fechaCorta(x.fecha)} · ${x.entrenamiento || 'Remo libre'}</b> <span class="xp">+${miles(g.xp)} XP</span> <span class="monedas">${icoMoneda}${g.monedas}</span></div>
      <div class="chips-ganancia">${Object.entries(g.ganancias).map(([k, v]) => `<span>${nombreAtributo(k)} +${v}</span>`).join('')}</div></li>`;
  }).join('') : '<li class="vacio">Tu primera sesión le dará experiencia a tu héroe.</li>';
}

function pintarTalentos(h, per) {
  const apr = per.talentos || {};
  $('#talentos-libres').textContent = h.talentosLibres > 0
    ? `Tienes ${h.talentosLibres} ${h.talentosLibres === 1 ? 'punto' : 'puntos'} de talento. Cada nivel de héroe te da uno.`
    : 'Sin puntos libres: sube de nivel para ganar más.';
  $('#arbol').innerHTML = J.ATRIBUTOS.map((a) => {
    const ts = J.TALENTOS.filter((t) => t.atributo === a.clave);
    const elegido = ts.find((t) => t.id === talentoElegido);
    const nodos = ts.map((t) => {
      const estado = apr[t.id] != null ? 'aprendido' : J.motivoBloqueo(t.id, h, apr) ? 'bloqueado' : 'disponible';
      return `<button type="button" class="nodo ${estado}${t.id === talentoElegido ? ' elegido' : ''}" data-talento="${t.id}">
        <span class="nodo-nivel">${['I', 'II', 'III'][t.nivel - 1]}</span><b>${t.nombre}</b><small>${t.activa ? 'Activa' : 'Pasiva'} · ${J.COSTO_TALENTO[t.nivel]} pt</small></button>`;
    }).join('<span class="enlace" aria-hidden="true"></span>');
    let detalle = '';
    if (elegido) {
      const motivo = apr[elegido.id] != null ? null : J.motivoBloqueo(elegido.id, h, apr);
      detalle = `<div class="nodo-detalle"><p>${elegido.texto}${elegido.activa ? ' <em>Se activa cuando llegue la carrera de tu héroe.</em>' : ''}</p>${
        apr[elegido.id] != null ? '<span class="ok-texto">Aprendido</span>'
          : motivo ? `<span class="suave">${motivo}</span>`
            : `<button type="button" class="boton primario" data-aprender="${elegido.id}">Aprender (${J.COSTO_TALENTO[elegido.nivel]} ${J.COSTO_TALENTO[elegido.nivel] === 1 ? 'punto' : 'puntos'})</button>`}</div>`;
    }
    return `<div class="rama"><div class="rama-titulo"><b>${a.nombre}</b><span>${h.atributos[a.clave]}</span></div><div class="nodos">${nodos}</div>${detalle}</div>`;
  }).join('');
}

function filaMision(m) {
  const pct = Math.min(100, (100 * m.valor) / m.meta);
  const valor = m.meta >= 100 ? miles(m.valor) : Math.round(m.valor * 10) / 10;
  return `<li class="${m.hecha ? 'hecha' : ''}"><div class="mision-fila"><span>${m.hecha ? ico('i-check') : ''}${m.texto}</span>
    ${m.monedas ? `<span class="monedas">${icoMoneda}${m.monedas}</span>` : ''}</div>
    <div class="progreso"><div style="width:${pct}%"></div></div><small>${valor} de ${miles(m.meta)}${m.premio ? ` · premio: <b>${m.premio}</b>` : ''}</small></li>`;
}

function pintarMisiones(h) {
  $('#mis-diarias').innerHTML = h.diarias.map((m) => filaMision(m)).join('');
  $('#mis-semanales').innerHTML = h.semanales.map((m) => filaMision(m)).join('');
  const c = h.capitulo;
  $('#mis-capitulo').innerHTML = c ? `<div class="cap-cabecera"><span class="etq">Capítulo ${c.n} de ${J.CAPITULOS.length}</span><b>${c.nombre}</b><p>${c.historia}</p></div>
    <ul class="lista misiones">${c.progreso.map((r) => filaMision({ texto: r.texto, meta: r.meta, valor: r.valor, monedas: '', hecha: r.valor >= r.meta })).join('')}</ul>
    <div class="jefe ${c.progreso.every((r) => r.valor >= r.meta) ? 'listo' : ''}">${ico('i-fuego')}<div><b>Jefe: ${c.jefe.nombre}</b><small>${c.jefe.texto}${
      c.progreso.every((r) => r.valor >= r.meta) ? ' · ¡ya puedes enfrentarlo!' : ' · se desbloquea al cumplir lo de arriba'}</small></div>
      <span class="premio">${icoMoneda}${c.monedas} + ${O.objeto(c.objeto).nombre}</span></div>`
    : '<p class="aviso exito">¡Terminaste la historia! Eres una leyenda de los mares.</p>';
  $('#mis-hazanas').innerHTML = h.hazanas.map((x) => filaMision({ texto: `${x.nombre}: ${x.texto}`, meta: x.meta, valor: x.valor, monedas: x.monedas, premio: O.objeto(x.objeto).nombre, hecha: x.hecha })).join('');
}

function tarjetaObjeto(x, per, { accion = '', extra = '' } = {}) {
  const prueba = { ...per, equipo: { ...(per.equipo || {}), [x.ranura]: x.id } };
  const vista = x.ranura === 'bote' ? `<span class="bote-muestra" style="background:${x.color}"></span>` : O.dibujarHeroe(prueba, { tam: 72 });
  const r = O.RAREZAS[x.rareza];
  return `<div class="objeto" style="--rareza:${r.color}">${vista}<b>${x.nombre}</b><small>${r.nombre}</small>${extra}${accion}</div>`;
}

function pintarArmario(h, per) {
  const equipo = per.equipo || {};
  $('#armario-vista').innerHTML = O.dibujarHeroe(per, { tam: 180 });
  $('#pieles').innerHTML = O.PIELES.map((c, i) => `<button type="button" class="piel" role="radio" aria-checked="${(per.piel ?? 1) === i}" data-piel="${i}" style="background:${c}" aria-label="Tono ${i + 1}"></button>`).join('');
  $('#armario').innerHTML = O.RANURAS.map((r) => {
    const mios = O.OBJETOS.filter((x) => x.ranura === r.clave && h.poseidos.has(x.id));
    const items = mios.map((x) => tarjetaObjeto(x, per, {
      accion: `<button type="button" class="boton chico${equipo[r.clave] === x.id ? ' primario' : ''}" data-equipar="${x.id}">${equipo[r.clave] === x.id ? 'Puesto' : 'Ponerme'}</button>`,
    })).join('');
    return `<h3>${r.nombre}${r.clave === 'bote' ? ' <small>(se ve en la carrera)</small>' : ''}</h3><div class="objetos">${items || '<p class="suave">Aún no tienes nada aquí. Mira la tienda o las misiones.</p>'}</div>`;
  }).join('');
  $('#colecciones').innerHTML = O.COLECCIONES.map((c) => {
    const todos = O.OBJETOS.filter((x) => x.coleccion === c.clave);
    const tengo = todos.filter((x) => h.poseidos.has(x.id)).length;
    return `<div class="coleccion${tengo === todos.length ? ' completa' : ''}"><b>${c.nombre}</b><span>${tengo} de ${todos.length}</span>
      <div class="at-barra"><div style="width:${(100 * tengo) / todos.length}%"></div></div></div>`;
  }).join('');
}

function pintarTienda(h, per) {
  const lunes = J.lunesDe(Date.now());
  const items = J.tiendaSemana(lunes, h.poseidos);
  const sig = new Date(`${lunes}T12:00`);
  sig.setDate(sig.getDate() + 7);
  $('#tienda-info').innerHTML = `Tienes ${icoMoneda}<b>${miles(h.monedas)}</b>. La tienda cambia el lunes ${sig.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}. Ganas monedas con cada sesión y con las misiones.`;
  $('#tienda').innerHTML = items.length ? items.map((x) => tarjetaObjeto(x, per, {
    extra: `<span class="monedas">${icoMoneda}${x.precio}</span>`,
    accion: `<button type="button" class="boton chico primario" data-comprar="${x.id}" ${h.monedas < x.precio ? 'disabled' : ''}>${h.monedas < x.precio ? 'Te faltan monedas' : 'Comprar'}</button>`,
  })).join('') : '<p class="suave">Ya tienes todo lo de la tienda. ¡Vuelve el lunes!</p>';
}

$('#clases').addEventListener('click', (e) => {
  const b = e.target.closest('[data-clase]');
  if (!b) return;
  claseElegida = b.dataset.clase;
  for (const x of document.querySelectorAll('#clases .clase')) x.setAttribute('aria-checked', String(x === b));
  $('#btn-crear-heroe').disabled = false;
});
$('#btn-crear-heroe').addEventListener('click', () => {
  if (!claseElegida) return;
  guardarPersonaje({ clase: claseElegida, nombre: $('#heroe-nombre').value.trim() });
  confeti();
  pintarHeroe();
});
$('#btn-cambiar-clase').addEventListener('click', () => {
  claseElegida = leerPersonaje().clase || null;
  guardarPersonaje({ clase: null });
  pintarHeroe();
});
document.querySelector('.heroe-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-hp]');
  if (!b) return;
  seccionHeroe = b.dataset.hp;
  pintarHeroe();
});
$('#arbol').addEventListener('click', async (e) => {
  const ap = e.target.closest('[data-aprender]');
  if (ap) {
    const { per, h } = await estadoHeroe();
    if (J.motivoBloqueo(ap.dataset.aprender, h, per.talentos || {})) return;
    guardarPersonaje({ talentos: { ...(per.talentos || {}), [ap.dataset.aprender]: Date.now() } });
    toast(`Aprendiste ${J.talento(ap.dataset.aprender).nombre}`);
    vibrar(80);
    pintarHeroe();
    return;
  }
  const n = e.target.closest('[data-talento]');
  if (n) { talentoElegido = talentoElegido === n.dataset.talento ? null : n.dataset.talento; pintarHeroe(); }
});
$('#pieles').addEventListener('click', (e) => {
  const b = e.target.closest('[data-piel]');
  if (b) { guardarPersonaje({ piel: Number(b.dataset.piel) }); pintarHeroe(); }
});
$('#armario').addEventListener('click', (e) => {
  const b = e.target.closest('[data-equipar]');
  if (!b) return;
  const x = O.objeto(b.dataset.equipar);
  const equipo = { ...(leerPersonaje().equipo || {}) };
  if (equipo[x.ranura] === x.id) delete equipo[x.ranura];
  else equipo[x.ranura] = x.id;
  guardarPersonaje({ equipo });
  pintarHeroe();
});
$('#tienda').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-comprar]');
  if (!b) return;
  const { per, h } = await estadoHeroe();
  const x = J.tiendaSemana(J.lunesDe(Date.now()), h.poseidos).find((y) => y.id === b.dataset.comprar);
  if (!x || h.monedas < x.precio) return;
  guardarPersonaje({ compras: [...(per.compras || []), x.id], gastado: (per.gastado || 0) + x.precio, equipo: { ...(per.equipo || {}), [x.ranura]: x.id } });
  confeti(1500);
  toast(`${x.nombre}: ¡ya es tuyo y te lo pusiste!`);
  pintarHeroe();
});

// XP, monedas y logros que dio la sesión, en la hoja de resumen. Devuelve true si subiste de nivel o venciste a un jefe.
function pintarXpSesion(s, previas, resumen) {
  const caja = $('#hoja-xp');
  const per = leerPersonaje();
  const clase = J.claseDe(per.clase);
  const h = J.estadoJuego([...previas.filter((x) => x.fecha !== s.fecha), s], { ftp: ftp(), per });
  const g = h.porSesion.get(s.fecha);
  caja.hidden = !g;
  if (!g) return false;
  const logros = h.logros.filter((l) => l.fecha === s.fecha);
  const monedas = g.monedas + logros.reduce((a, l) => a + l.monedas, 0);
  const subio = resumen && g.nivelDespues > g.nivelAntes;
  caja.innerHTML = `<span class="xp-total">+${miles(g.xp)} XP</span> <span class="monedas grande">${icoMoneda}+${miles(monedas)}</span>
    ${subio ? `<span class="subio">¡${clase ? clase.nombre : 'Tu héroe'} sube a nivel ${g.nivelDespues}!</span>` : ''}
    ${logros.map((l) => `<div class="logro ${l.tipo}">${ico(l.tipo === 'jefe' || l.tipo === 'hazana' ? 'i-trofeo' : 'i-check')}<span>${l.texto}${l.objeto ? ` · ganaste <b>${O.objeto(l.objeto).nombre}</b>` : ''}</span><span class="monedas">${icoMoneda}${l.monedas}</span></div>`).join('')}
    <div class="chips-ganancia">${Object.entries(g.ganancias).map(([k, v]) => `<span>${nombreAtributo(k)} +${v}</span>`).join('')}</div>
    <ul>${g.detalle.map(([t, v]) => `<li><span>${t}</span><span>+${miles(v)}</span></li>`).join('')}</ul>
    ${clase ? '' : '<p class="ayuda">Crea tu héroe en la pestaña Héroe para darle vida a esta experiencia.</p>'}`;
  if (subio) hablar(`Subiste a nivel ${g.nivelDespues}`);
  if (resumen && logros.some((l) => l.tipo === 'jefe')) hablar('¡Jefe vencido!');
  return subio || logros.some((l) => l.tipo === 'jefe' || l.tipo === 'hazana');
}

// ---------- Resumen / detalle de sesión ----------
let sesionAbierta = null;
const TEXTO_RPE = ['', 'Muy fácil', 'Muy fácil', 'Fácil', 'Fácil', 'Moderado', 'Moderado', 'Duro', 'Duro', 'Muy duro', 'Máximo'];

async function guardarSesionAbierta() {
  if (sesionAbierta?.id != null) await db.guardar('sesiones', sesionAbierta);
}

function pintarRpe() {
  const s = sesionAbierta;
  $('#rpe').innerHTML = Array.from({ length: 10 }, (_, i) => `<button type="button" class="boton${s.rpe === i + 1 ? ' activo' : ''}" data-rpe="${i + 1}" aria-pressed="${s.rpe === i + 1}">${i + 1}</button>`).join('');
  $('#rpe-texto').textContent = s.rpe ? `${s.rpe}: ${TEXTO_RPE[s.rpe]}` : '1 = muy fácil, 10 = esfuerzo máximo';
  $('#rpe').querySelectorAll('button').forEach((b) => {
    b.onclick = async () => {
      s.rpe = Number(b.dataset.rpe);
      pintarRpe();
      await guardarSesionAbierta();
    };
  });
}
$('#in-notas').addEventListener('change', async () => {
  if (!sesionAbierta) return;
  sesionAbierta.notas = $('#in-notas').value.trim();
  await guardarSesionAbierta();
  toast('Nota guardada');
});

function tablaIntervalos(s) {
  const filas = E.resumenIntervalos(s);
  if (filas.length) {
    return `<h2>Por intervalo</h2><div class="desliza"><table class="tabla"><thead><tr><th>Intervalo</th><th>Tiempo</th><th>m</th><th>W</th><th>Split</th><th>g/min</th><th>Rango</th></tr></thead><tbody>${
      filas.map((f) => `<tr><td>${f.nombre}${f.bloque.metrica ? `<br><span class="sub ayuda" style="margin:0">${Ent.textoMeta(f.bloque)}</span>` : ''}</td><td>${formatoTiempo(f.segundos)}</td><td>${f.metros}</td><td>${f.w}</td><td>${formatoSplit(f.split)}</td><td>${f.spm}</td><td class="${f.pctRango == null ? '' : f.pctRango >= 70 ? 'ok' : f.pctRango < 40 ? 'mal' : ''}">${f.pctRango == null ? '-' : `${f.pctRango}%`}</td></tr>`).join('')
    }</tbody></table></div>`;
  }
  const par = E.parciales(s.muestras, 500);
  if (par.length < 2) return '';
  const mejor = Math.min(...par.map((p) => p.split));
  return `<h2>Parciales de 500 m</h2><div class="desliza"><table class="tabla"><thead><tr><th>Tramo</th><th>Tiempo</th><th>Split</th><th>W</th><th>g/min</th></tr></thead><tbody>${
    par.map((p) => `<tr><td>${p.metros - 500}–${p.metros} m</td><td>${formatoTiempo(p.tiempo)}</td><td class="${p.split === mejor ? 'ok' : ''}">${formatoSplit(p.split)}</td><td>${p.w}</td><td>${p.spm}</td></tr>`).join('')
  }</tbody></table></div>`;
}

// Predicción de otras distancias con la ley de Paul (+5 s de split cada vez que se duplica la distancia).
function tablaPrediccion(s) {
  const base = [2000, 5000, 1000, 500].map((d) => [d, E.mejorTiempo(s.muestras || [], d)]).find(([, t]) => t);
  const [metros, seg] = base || [];
  if (!metros) return '';
  const filas = Ent.DISTANCIAS_PREDICCION.filter((d) => d !== metros).map((d) => {
    const t = Ent.predecir(metros, seg, d);
    return `<tr><td>${d === 21097 ? 'Medio maratón' : `${d} m`}</td><td>${formatoTiempo(t)}</td><td>${formatoSplit(Math.round((t * 500) / d))}</td></tr>`;
  }).join('');
  return `<div class="prediccion"><h2>Predicción con este esfuerzo</h2><p class="ayuda">A partir de ${metros} m en ${formatoTiempo(seg)}.</p>
    <table><thead><tr><th>Distancia</th><th>Tiempo</th><th>Split</th></tr></thead><tbody>${filas}</tbody></table></div>`;
}

function abrirSesion(s, { resumen = false, previas = [] } = {}) {
  sesionAbierta = s;
  const hoja = $('#hoja');
  hoja.hidden = false;
  hoja.querySelector('.hoja').scrollTop = 0;
  const f = new Date(s.fecha);
  $('#hoja-titulo').textContent = resumen ? '¡Sesión terminada!' : (s.entrenamiento || 'Remo libre');
  $('#hoja-sub').textContent = `${resumen && s.entrenamiento ? `${s.entrenamiento} · ` : ''}${f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}, ${f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;

  const recs = E.nuevosRecords(s, previas);
  $('#hoja-records').innerHTML = recs.map((r) => `<div class="record nuevo"><div class="etq">${ico('i-trofeo')}${resumen ? 'Nuevo récord' : 'Récord'}</div>
    <div class="valor">${formatoRecord(r, r.valor)}</div><div class="sub">${r.nombre}${r.anterior != null ? ` · antes ${formatoRecord(r, r.anterior)}` : ''}</div></div>`).join('');
  const antes = new Set(E.insignias(previas).filter((x) => x.ganada).map((x) => x.clave));
  const medallas = resumen ? E.insignias([...previas, s]).filter((x) => x.ganada && !antes.has(x.clave)) : [];
  $('#hoja-records').insertAdjacentHTML('beforeend', medallas.map((x) => `<div class="record nuevo"><div class="etq">${ico('i-trofeo')}Nueva insignia</div>
    <div class="valor">${x.nombre}</div><div class="sub">${x.detalle}</div></div>`).join(''));
  const gano = (s.rivales || (s.rival ? [s.rival] : [])).some((r) => r.diferencia > 0);
  const subio = pintarXpSesion(s, previas, resumen);
  if (resumen && (recs.length || medallas.length || gano || subio)) setTimeout(confeti, 250);

  const hojaFtp = $('#hoja-ftp');
  const sugerido = !s.pruebaWatts ? E.ftpSugerido(s) : null;
  const subeFtp = sugerido && sugerido > ftp() + 2;
  hojaFtp.hidden = !s.pruebaWatts && !subeFtp;
  if (s.pruebaWatts || subeFtp) {
    const nuevo = s.pruebaWatts ? Ent.ftpDesdePrueba(s.pruebaWatts) : sugerido;
    const origen = s.pruebaWatts ? `Promedio en la prueba: <b>${s.pruebaWatts} W</b>.` : `Tus mejores 20 min de esta sesión dan más que tu FTP actual.`;
    hojaFtp.innerHTML = `${origen} Tu FTP estimado es <b>${nuevo} W</b>${ftp() ? ` (antes ${ftp()} W)` : ''}.
      <div class="fila-botones"><button class="boton primario" id="btn-usar-ftp">Usar ${nuevo} W como FTP</button></div>`;
    $('#btn-usar-ftp').onclick = () => {
      ajustes.escribir('ftp', nuevo);
      $('#in-ftp').value = nuevo;
      pintarZonas();
      toast(`FTP actualizado a ${nuevo} W`);
      $('#btn-usar-ftp').disabled = true;
    };
  }

  const tec = E.tecnica(s);
  const estres = s.estres ?? E.estres(s, s.ftp || ftp());
  const stats = [
    ['Duración', formatoTiempo(s.duracion)], ['Distancia', `${s.distancia} m`],
    ['Watts prom', s.wattsProm], ['Watts máx', s.wattsMax],
    ['Split prom', formatoSplit(s.splitProm)], ['Golpes/min', s.spmProm],
    ['Calorías', s.kcal], ['Paladas', s.paladas ?? '-'],
    ['Metros/palada', tec.metrosPorPalada ?? '-'], ['Trabajo/palada', tec.joulesPorPalada ? `${tec.joulesPorPalada} J` : '-'],
    ['Pulso prom', s.fcProm || '-'],
  ];
  if (s.fcMax) stats.push(['Pulso máx', s.fcMax]);
  if (tec.wattsPorLatido) stats.push(['Watts/latido', tec.wattsPorLatido]);
  if (estres != null) stats.push(['Carga', estres]);
  if (s.tiempoMeta != null) stats.push(['Meta en', formatoTiempo(s.tiempoMeta)]);
  if (s.pctEnRango != null) stats.push(['En rango', `${s.pctEnRango}%`]);
  for (const r of s.rivales || (s.rival ? [s.rival] : [])) {
    stats.push([s.rivales ? `Vs. ${r.nombre.replace(/^Fantasma /, '')}` : 'Vs. fantasma', `${r.diferencia > 0 ? '+' : ''}${r.diferencia} m`]);
  }
  $('#hoja-stats').innerHTML = stats.map(([k, v]) => `<div class="metrica"><span class="etq">${k}</span><span class="valor">${v}</span></div>`).join('');

  pintarRpe();
  $('#in-notas').value = s.notas || '';
  $('#hoja-intervalos').innerHTML = tablaIntervalos(s);
  $('#hoja-prediccion').innerHTML = tablaPrediccion(s);

  const cmp = E.compararConAnterior(s, previas);
  const fmt = (c, v) => (c.clave === 'splitProm' || c.clave === 'tiempoMeta' ? formatoTiempo(v) : `${v}${c.unidad && c.unidad !== 's' ? ` ${c.unidad}` : ''}`);
  const fmtDelta = (c) => {
    if (!c.delta) return '=';
    const signo = c.delta > 0 ? '+' : '−';
    const abs = Math.abs(c.delta);
    return `${signo}${c.clave === 'splitProm' || c.clave === 'tiempoMeta' ? `${abs} s` : `${abs}${c.unidad && c.unidad !== 's' ? ` ${c.unidad}` : ''}`}`;
  };
  $('#hoja-comparacion').innerHTML = cmp && cmp.filas.length ? `<h2>Contra la vez anterior (${fechaCorta(cmp.fecha)})</h2>
    <table class="tabla"><thead><tr><th></th><th>Antes</th><th>Ahora</th><th>Cambio</th></tr></thead><tbody>${
      cmp.filas.map((c) => `<tr><td>${c.nombre}</td><td>${fmt(c, c.antes)}</td><td>${fmt(c, c.ahora)}</td><td class="${c.mejoro === true ? 'mejor' : c.mejoro === false ? 'peor' : ''}">${
        c.mejoro === true ? '▲ ' : c.mejoro === false ? '▼ ' : ''}${fmtDelta(c)}</td></tr>`).join('')}</tbody></table>` : '';

  const fcMax = ajustes.num('fcMax', 0);
  const conFc = s.muestras.some((x) => x.fc);
  $('#hoja-fc').hidden = !(conFc && fcMax);
  requestAnimationFrame(() => {
    const m = s.muestras;
    const series = [
      { color: color('--watts'), eje: 'izq', puntos: m.map((x) => [x.t, x.w]) },
      { color: color('--spm'), eje: 'der', puntos: m.map((x) => [x.t, x.spm]) },
    ];
    if (conFc) series.push({ color: color('--fc'), eje: 'izq', puntos: m.filter((x) => x.fc).map((x) => [x.t, x.fc]) });
    const f = s.ftp || ftp();
    const zonas = f ? Ent.ZONAS.map((z) => ({ min: (z.min * f) / 100, max: (z.max * f) / 100, color: COLOR_ZONA[z.n - 1], etiqueta: `Z${z.n}` })) : [];
    let acum = 0;
    const divisiones = (s.bloques || []).map((b) => { acum += b.duracion || 0; return { t: acum }; });
    dibujar($('#hoja-grafica'), series, { zonas, divisiones });
    $('#hoja-perfil').hidden = !s.bloques;
    if (s.bloques) dibujarPerfil($('#hoja-grafica-perfil'), Ent.bloquesEnWatts(s.bloques, s.ftp || ftp()), m.map((x) => [x.t, x.w]));
    if (conFc && fcMax) {
      const seg = E.tiempoEnZonasFc(m, fcMax);
      dibujarBarras($('#hoja-zonas-fc'), E.ZONAS_FC.map((z, i) => ({ etiqueta: `Z${z.n}`, valor: Math.round(seg[i] / 6) / 10, resaltar: seg[i] === Math.max(...seg) })), {
        color: color('--fc'), formato: (v) => `${v} min`,
      });
    }
  });
  $('#hoja-cerrar').focus();
}

// ---------- Programa ----------
function leerPrograma() {
  try { return JSON.parse(ajustes.leer('programa', 'null')); } catch { return null; }
}
function guardarPrograma(p) {
  if (p) ajustes.escribir('programa', JSON.stringify(p));
  else { try { localStorage.removeItem('programa'); } catch { /* nada */ } }
}

// Agrega los entrenamientos de ejemplo que el programa necesita y aún no existen.
async function asegurarEntrenamientos(nombres) {
  const existentes = new Set((await db.listar('entrenamientos')).map((e) => e.nombre));
  for (const n of new Set(nombres)) {
    const ej = Ent.EJEMPLOS.find((e) => e.nombre === n);
    if (ej && !existentes.has(n)) await db.guardar('entrenamientos', structuredClone(ej));
  }
}

async function pintarPrograma() {
  const prog = leerPrograma();
  $('#programa-vacio').hidden = !!prog;
  $('#programa-activo').hidden = !prog;
  if (!prog) {
    $('#plantillas-programa').innerHTML = P.PLANTILLAS.map((p, i) => `<div class="plantilla"><div class="info"><b>${p.nombre}</b><div class="suave">${p.descripcion}</div></div>
      <button type="button" class="boton primario chico" data-p="${i}">Empezar</button></div>`).join('');
    $('#plantillas-programa').querySelectorAll('[data-p]').forEach((b) => {
      b.onclick = async () => {
        const p = P.PLANTILLAS[b.dataset.p];
        await asegurarEntrenamientos(p.semanas.flat());
        guardarPrograma(P.desdePlantilla(p, E.claveDia(Date.now())));
        toast('Programa creado');
        pintarEntrenamientos();
      };
    });
    if (!$('#p-inicio').value) $('#p-inicio').value = E.claveDia(Date.now());
    const ents = await db.listar('entrenamientos');
    const nombresDia = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const previos = [...$('#p-dias').querySelectorAll('select')].map((x) => x.value);
    $('#p-dias').innerHTML = nombresDia.map((d, i) => `<label>${d}<select data-dia="${i}"><option value="">Descanso</option>${
      ents.map((e) => `<option>${e.nombre.replace(/</g, '&lt;')}</option>`).join('')}</select></label>`).join('');
    $('#p-dias').querySelectorAll('select').forEach((x, i) => { x.value = previos[i] || ''; });
    return;
  }
  const sesiones = await db.listar('sesiones');
  const estados = P.estadoDias(prog, sesiones);
  const c = P.cumplimiento(estados);
  $('#prog-nombre').textContent = prog.nombre;
  $('#prog-cumple').textContent = `${c.hechos} de ${c.total} sesiones`;
  $('#prog-barra').style.width = `${(100 * c.hechos) / (c.total || 1)}%`;
  const porFecha = new Map(estados.map((d) => [d.fecha, d]));
  const primero = new Date(`${estados[0].fecha}T12:00`);
  const ultimo = new Date(`${estados.at(-1).fecha}T12:00`);
  const d = new Date(primero.getTime() - ((primero.getDay() + 6) % 7) * 864e5);
  const fin = new Date(ultimo.getTime() + (6 - ((ultimo.getDay() + 6) % 7)) * 864e5);
  const celdas = [];
  for (; d <= fin; d.setDate(d.getDate() + 1)) {
    const k = E.claveDia(d.getTime());
    const dia = porFecha.get(k);
    const hoy = k === E.claveDia(Date.now());
    const clase = dia ? dia.estado : `libre${hoy ? ' hoy' : ''}`;
    const marca = dia?.estado === 'hecho' ? ico('i-check') : '';
    celdas.push(`<button type="button" class="${clase}" data-k="${k}" aria-label="${new Date(d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}${dia ? `: ${dia.ent}` : ''}">${d.getDate()}${marca}</button>`);
  }
  $('#calendario').innerHTML = celdas.join('');
  const describirDia = (k) => {
    const dia = porFecha.get(k);
    const fecha = new Date(`${k}T12:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
    const est = { hecho: 'hecho', perdido: 'no se hizo', hoy: 'toca hoy', pendiente: 'pendiente' };
    $('#prog-dia').textContent = dia ? `${fecha}: ${dia.ent} (${est[dia.estado]})` : `${fecha}: descanso`;
  };
  $('#calendario').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      $('#calendario').querySelectorAll('.elegido').forEach((x) => x.classList.remove('elegido'));
      b.classList.add('elegido');
      describirDia(b.dataset.k);
    };
  });
  const hoyK = E.claveDia(Date.now());
  describirDia(porFecha.has(hoyK) ? hoyK : (P.proximo(prog)?.fecha || hoyK));
}

// Plan automático: sugiere la meta a partir de tu mejor marca y predicción en esa distancia.
async function pintarPlanMeta() {
  const dist = Number($('#pm-dist').value);
  if (!$('#pm-inicio').value) $('#pm-inicio').value = E.claveDia(Date.now());
  const sesiones = await db.listar('sesiones');
  let mejor = null;
  for (const s of sesiones) {
    for (const d of [dist, ...Ent.DISTANCIAS_PREDICCION]) {
      const t = s.muestras?.length ? E.mejorTiempo(s.muestras, d) : null;
      if (t) {
        const pred = d === dist ? t : Ent.predecir(d, t, dist);
        if (!mejor || pred < mejor.t) mejor = { t: pred, real: d === dist };
      }
    }
  }
  $('#pm-info').textContent = mejor
    ? `${mejor.real ? 'Tu mejor' : 'Tu predicción para'} ${dist} m: ${Ent.formatoMmss(mejor.t)}. Una meta realista en 8 semanas: ${Ent.formatoMmss(Math.round(mejor.t * 0.96))}.`
    : 'Aún no hay sesiones para sugerirte una meta: elige una que te rete.';
  $('#pm-tiempo').placeholder = mejor ? Ent.formatoMmss(Math.round(mejor.t * 0.96)) : '8:00';
}
$('#pm-dist').addEventListener('change', pintarPlanMeta);
$('#plan-meta').addEventListener('toggle', () => { if ($('#plan-meta').open) pintarPlanMeta(); });
$('#btn-plan-meta').addEventListener('click', async () => {
  const distancia = Number($('#pm-dist').value);
  const segundos = leerMmss($('#pm-tiempo').value || $('#pm-tiempo').placeholder);
  const semanas = Math.round(Number($('#pm-semanas').value));
  const inicio = $('#pm-inicio').value;
  if (!segundos) { $('#pm-error').textContent = 'Escribe el tiempo meta como mm:ss, por ejemplo 7:45.'; return; }
  if (!(semanas >= 2 && semanas <= 16) || !inicio) { $('#pm-error').textContent = 'Elige entre 2 y 16 semanas y la fecha de inicio.'; return; }
  const split = (segundos * 500) / distancia;
  if (split < 80 || split > 200) { $('#pm-error').textContent = 'Ese tiempo da un ritmo fuera de lo posible: revisa la distancia y el tiempo.'; return; }
  $('#pm-error').textContent = '';
  const { programa, entrenamientos } = P.planPorMeta({ distancia, segundos, semanas, inicio });
  const existentes = new Set((await db.listar('entrenamientos')).map((e) => e.nombre));
  for (const e of entrenamientos) if (!existentes.has(e.nombre)) await db.guardar('entrenamientos', e);
  guardarPrograma(programa);
  toast(`Plan creado: ${programa.dias.length} sesiones en ${semanas} semanas`);
  pintarEntrenamientos();
  llenarSelectorEntrenamientos();
  pintarHoyToca();
});

$('#btn-crear-programa').addEventListener('click', async () => {
  const semanas = Number($('#p-semanas').value);
  const inicio = $('#p-inicio').value;
  const porDia = {};
  $('#p-dias').querySelectorAll('select').forEach((x) => { if (x.value) porDia[x.dataset.dia] = x.value; });
  if (!inicio || !(semanas >= 1)) { $('#p-error').textContent = 'Indica la fecha de inicio y cuántas semanas.'; return; }
  if (!Object.keys(porDia).length) { $('#p-error').textContent = 'Elige un entrenamiento para al menos un día.'; return; }
  $('#p-error').textContent = '';
  guardarPrograma(P.generarSemanal('Mi programa', inicio, Math.min(26, semanas), porDia));
  toast('Programa creado');
  pintarEntrenamientos();
});
$('#btn-quitar-programa').addEventListener('click', () => {
  if (!confirm('¿Quitar el programa? Tus sesiones no se borran.')) return;
  guardarPrograma(null);
  pintarEntrenamientos();
});

async function pintarRecomendacion() {
  const r = E.recomendacion(await db.listar('sesiones'), ftp());
  const el = $('#recomendacion');
  el.hidden = !r;
  if (r) { el.textContent = r.texto; el.className = `recomendacion ${r.tipo}`; }
}

async function pintarHoyToca() {
  pintarRecomendacion();
  const prog = leerPrograma();
  const hoy = P.deHoy(prog);
  const caja = $('#hoy-toca');
  caja.hidden = !prog;
  if (!prog) return;
  const sel = $('#sel-entrenamiento');
  if (hoy) {
    const hecho = (await db.listar('sesiones')).some((s) => E.claveDia(s.fecha) === hoy.fecha && s.entrenamiento === hoy.ent);
    caja.classList.toggle('hecho', hecho);
    caja.querySelector('.etq').textContent = hecho ? 'Hoy: hecho' : 'Hoy toca';
    $('#hoy-toca-nombre').textContent = hoy.ent;
    const opcion = [...sel.options].find((o) => o.textContent === hoy.ent);
    $('#btn-hoy-toca').hidden = hecho || !opcion || sel.value === opcion.value;
    $('#btn-hoy-toca').onclick = () => {
      sel.value = opcion.value;
      ajustes.escribir('ultimoEnt', opcion.value);
      vistaPrevia();
      $('#btn-hoy-toca').hidden = true;
    };
  } else {
    const prox = P.proximo(prog);
    caja.classList.remove('hecho');
    caja.querySelector('.etq').textContent = prox ? 'Hoy descansas · próximo' : 'Programa terminado';
    $('#hoy-toca-nombre').textContent = prox ? `${prox.ent} (${new Date(`${prox.fecha}T12:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' })})` : prog.nombre;
    $('#btn-hoy-toca').hidden = true;
  }
}

// ---------- Respaldo ----------
const CLAVES_AJUSTES = ['peso', 'ftp', 'fcMax', 'metaSemana', 'voz', 'modoAuto', 'pausaAuto', 'resAuto', 'vistaRemo', 'variante', 'tema', 'guiado', 'ritmoObjetivo', 'personaje'];

async function guardarRespaldo() {
  const datos = {
    app: 'remadora',
    version: VERSION,
    fecha: new Date().toISOString(),
    sesiones: await db.listar('sesiones'),
    entrenamientos: await db.listar('entrenamientos'),
    programa: leerPrograma(),
    ajustes: Object.fromEntries(CLAVES_AJUSTES.map((k) => [k, ajustes.leer(k, null)]).filter(([, v]) => v != null)),
  };
  const nombre = `rw200-respaldo-${E.claveDia(Date.now())}.json`;
  const texto = JSON.stringify(datos);
  const archivo = new File([texto], nombre, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: 'Respaldo de RW200' });
    } else {
      descargar(nombre, texto, 'application/json');
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    descargar(nombre, texto, 'application/json');
  }
  ajustes.escribir('ultimoRespaldo', Date.now());
  pintarInfoRespaldo();
  toast(`Respaldo listo: ${datos.sesiones.length} sesiones`);
  if (vistaActiva('historial')) pintarAvisoRespaldo(datos.sesiones.length);
}

async function restaurarRespaldo(archivo) {
  let datos;
  try { datos = JSON.parse(await archivo.text()); } catch { toast('Ese archivo no es un respaldo válido'); return; }
  if (datos?.app !== 'remadora' || !Array.isArray(datos.sesiones)) { toast('Ese archivo no es un respaldo de RW200'); return; }
  const fechas = new Set((await db.listar('sesiones')).map((s) => s.fecha));
  let nS = 0;
  for (const s of datos.sesiones) {
    if (fechas.has(s.fecha)) continue;
    const copia = { ...s };
    delete copia.id;
    await db.guardar('sesiones', copia);
    nS++;
  }
  const nombres = new Set((await db.listar('entrenamientos')).map((e) => e.nombre));
  let nE = 0;
  for (const e of datos.entrenamientos || []) {
    if (nombres.has(e.nombre)) continue;
    const copia = { ...e };
    delete copia.id;
    await db.guardar('entrenamientos', copia);
    nE++;
  }
  if (datos.programa && !leerPrograma()) guardarPrograma(datos.programa);
  for (const [k, v] of Object.entries(datos.ajustes || {})) {
    if (CLAVES_AJUSTES.includes(k) && ajustes.leer(k, null) == null) ajustes.escribir(k, v);
  }
  toast(`Restaurado: ${nS} sesiones y ${nE} entrenamientos nuevos`);
  llenarSelectorEntrenamientos();
  pintarHoyToca();
}

function pintarInfoRespaldo() {
  const ultimo = Number(ajustes.leer('ultimoRespaldo', 0));
  $('#respaldo-info').textContent = ultimo
    ? `Último respaldo: ${new Date(ultimo).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'Todavía no has guardado un respaldo.';
  $('#respaldo-resumen').textContent = ultimo ? new Date(ultimo).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin respaldo';
}
$('#btn-respaldo').addEventListener('click', guardarRespaldo);
$('#btn-restaurar').addEventListener('click', () => $('#in-restaurar').click());
$('#in-restaurar').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  if (archivo) await restaurarRespaldo(archivo);
});
pintarInfoRespaldo();

function cerrarHoja() {
  $('#hoja').hidden = true;
  if (vistaActiva('historial')) pintarHistorial();
}
$('#hoja-cerrar').addEventListener('click', cerrarHoja);
$('#hoja').addEventListener('click', (e) => { if (e.target === $('#hoja')) cerrarHoja(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#hoja').hidden) cerrarHoja();
  else if (!$('#modo-remo').hidden) cerrarModoRemo();
});

$('#btn-borrar').addEventListener('click', async () => {
  if (sesionAbierta && confirm('¿Borrar esta sesión?')) {
    await db.borrar('sesiones', sesionAbierta.id);
    toast('Sesión borrada');
    cerrarHoja();
  }
});
$('#btn-compartir-img').addEventListener('click', async (ev) => {
  const s = sesionAbierta;
  if (!s) return;
  const boton = ev.currentTarget;
  boton.disabled = true;
  const f = new Date(s.fecha);
  const stats = [['Distancia', `${s.distancia} m`], ['Tiempo', formatoTiempo(s.duracion)], ['Split prom', formatoSplit(s.splitProm)],
    ['Watts prom', `${s.wattsProm} W`], ['Golpes/min', s.spmProm], [s.fcProm ? 'Pulso prom' : 'Calorías', s.fcProm ? `${s.fcProm} lpm` : s.kcal]];
  const rivales = s.rivales || (s.rival ? [s.rival] : []);
  const recs = E.nuevosRecords(s, (cacheSesiones || []).filter((x) => x.id !== s.id && x.fecha < s.fecha));
  const extra = recs.length ? `Récord: ${recs[0].nombre} ${formatoRecord(recs[0], recs[0].valor)}`
    : rivales.length ? rivales.map((r) => `${r.diferencia > 0 ? '+' : ''}${r.diferencia} m vs. ${r.nombre.replace(/^Fantasma /, '')}`).join(' · ') : '';
  try {
    const blob = await tarjetaSesion({
      titulo: s.entrenamiento || 'Remo libre',
      fecha: f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      stats, extra, puntos: (s.muestras || []).map((x) => [x.t, x.w]),
    });
    const nombre = `rw200-${marcaFecha(s.fecha)}.png`;
    const archivo = new File([blob], nombre, { type: 'image/png' });
    if (navigator.canShare?.({ files: [archivo] })) await navigator.share({ files: [archivo], title: 'Mi sesión en RW200' });
    else descargar(nombre, blob, 'image/png');
  } catch (err) {
    if (err.name !== 'AbortError') toast('No se pudo crear la imagen');
  } finally { boton.disabled = false; }
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

// El bloqueo de pantalla se pierde al cambiar de app; se recupera al volver si hay sesión.
document.addEventListener('visibilitychange', async () => {
  if (sesion && document.visibilityState === 'visible') {
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
  }
});

window.addEventListener('resize', () => {
  if (vistaActiva('entrenar')) { dibujarVivo(); if (!sesion) vistaPrevia(); }
  if (vistaActiva('historial')) pintarHistorial();
  if (vistaActiva('entrenamientos')) pintarPrograma();
});
actualizarBotones();
llenarSelectorEntrenamientos();
dibujarVivo();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
