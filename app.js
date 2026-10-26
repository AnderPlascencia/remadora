import { Remadora, BandaCardiaca } from './remadora.js';
import { VARIANTES } from './variantes.js';
import { formatoSplit, formatoTiempo, kcalPorSegundo } from './protocolo.js';
import { dibujar, dibujarPerfil, dibujarBarras } from './grafica.js';
import * as db from './db.js';
import * as Ent from './entrenamientos.js';
import * as E from './estadisticas.js';
import { configurarVoz, hablar, tiempoHablado } from './voz.js';

const VERSION = '0.4.0';
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
  if (d.tipo === 'metricas') { actual.watts = d.watts; actual.distancia = d.distancia; actual.nivel = d.resistencia; }
});
banda.addEventListener('fc', (e) => { actual.fc = e.detail; });

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
let sesion = null;
let entrenamientoActivo = null;
let wakeLock = null;

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
}

// Terminar pide un segundo toque para evitar cortes accidentales mientras se rema.
function confirmarTerminar(boton) {
  if (boton.dataset.confirmar) { delete boton.dataset.confirmar; detenerSesion(); return; }
  boton.dataset.confirmar = '1';
  const span = boton.querySelector('span');
  const previo = span.textContent;
  span.textContent = 'Toca otra vez';
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

async function iniciarSesion() {
  const idEnt = Number($('#sel-entrenamiento').value) || null;
  entrenamientoActivo = idEnt ? await db.obtener('entrenamientos', idEnt) : null;
  const intervalos = entrenamientoActivo && Ent.tipoDe(entrenamientoActivo) === 'intervalos';
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
    entrenamiento: entrenamientoActivo ? entrenamientoActivo.nombre : null,
    pruebaFtp: !!entrenamientoActivo?.pruebaFtp,
    bloques: intervalos ? Ent.bloquesEnWatts(entrenamientoActivo.bloques, ftp()) : null,
    bloqueAnterior: -1,
    sinRemar: 0,
    empezo: false,
    pausaManual: false,
    perdida: false,
  };
  actualizarBotones();
  $('#bloque-actual').hidden = !entrenamientoActivo;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
  pitido(880, 0.15);
  if (entrenamientoActivo) hablar(`Comienza ${entrenamientoActivo.nombre}`);
  else hablar('Sesión iniciada');
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
    fcProm: m.some((x) => x.fc) ? prom('fc') : 0,
    entrenamiento: s.entrenamiento,
    tiempoMeta: s.tiempoMeta,
    pctEnRango: s.segConMeta ? Math.round((100 * s.segEnRango) / s.segConMeta) : null,
    bloques: s.bloques,
    muestras: m,
  };
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
  registro.marcas = E.marcasDeSesion(registro);
  const previas = await db.listar('sesiones');
  const id = await db.guardar('sesiones', registro);
  if (registro.id == null && id != null) registro.id = id;
  pitido(660, 0.2);
  agregarLog(`sesión guardada: ${formatoTiempo(registro.duracion)}, ${registro.distancia} m`);
  const recs = E.nuevosRecords(registro, previas);
  hablar(`Sesión terminada. ${(registro.distancia / 1000).toFixed(1).replace('.', ' punto ')} kilómetros${recs.length ? `. ${recs.length === 1 ? 'Nuevo récord' : `${recs.length} récords nuevos`}` : ''}`);
  abrirSesion(registro, { resumen: true, previas });
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
  if (!entrenamientoActivo) return;
  if (Ent.tipoDe(entrenamientoActivo) === 'objetivo') avanceObjetivo(t);
  else avanceBloque(t);
}

function avanceObjetivo(t) {
  const p = progresoActual(t);
  if (p.completo && sesion.tiempoMeta == null) {
    sesion.tiempoMeta = t;
    pitido(1046, 0.4);
    vibrar([200, 100, 200, 100, 400]);
    hablar(`¡Meta cumplida! en ${tiempoHablado(t)}`, { urgente: true });
  } else if (!p.completo && p.fraccion >= 0.5 && !sesion.mitadAvisada) {
    sesion.mitadAvisada = true;
    hablar(`Vas a la mitad. Faltan ${Math.ceil(p.falta)} ${Ent.METRICAS_OBJETIVO[p.metrica].unidad === 'm' ? 'metros' : Ent.METRICAS_OBJETIVO[p.metrica].unidad}`);
  }
}

function progresoActual(t) {
  return Ent.progresoObjetivo(entrenamientoActivo, { distancia: sesion.dist, kcal: sesion.kcal, paladas: sesion.paladas }, t);
}

function metaHablada(b) {
  const r = Ent.rangoWatts(b, ftp());
  if (r) return `${r.min} a ${r.max} watts`;
  if (b.metrica === 'spm') return `${b.min} a ${b.max} golpes por minuto`;
  return 'ritmo libre';
}

function avanceBloque(t) {
  const ent = entrenamientoActivo;
  const actualB = Ent.bloqueEn(ent, t);
  if (!actualB) {
    if (sesion.bloqueAnterior !== ent.bloques.length) {
      sesion.bloqueAnterior = ent.bloques.length;
      sesion.tiempoMeta = Ent.duracionTotal(ent);
      pitido(1046, 0.4);
      vibrar([200, 100, 200]);
      const pct = sesion.segConMeta ? Math.round((100 * sesion.segEnRango) / sesion.segConMeta) : null;
      hablar(`Entrenamiento completado${pct != null ? `. Estuviste en rango el ${pct} por ciento del tiempo` : ''}`, { urgente: true });
    }
    return;
  }
  const { i, bloque: b, resta } = actualB;
  if (i !== sesion.bloqueAnterior) {
    if (sesion.bloqueAnterior !== -1) { pitido(988, 0.25); vibrar(250); }
    sesion.bloqueAnterior = i;
    sesion.fueraSeguidos = 0;
    hablar(`${b.nombre || 'Intervalo'}. ${metaHablada(b)} durante ${tiempoHablado(b.duracion)}`, { urgente: true });
    if (b.nivel && ajustes.si('resAuto', false)) {
      remadora.fijarResistencia(b.nivel);
      agregarLog(`resistencia automática: nivel ${b.nivel}`);
    }
  }
  if (resta <= 3 && resta > 0) {
    pitido(660, 0.08);
    if (b.duracion > 10) hablar(String(resta), { urgente: true });
  }
  const rango = Ent.enRango(b, actual.watts, actual.spm, ftp());
  if (rango) {
    sesion.segConMeta += 1;
    if (rango === 'dentro') sesion.segEnRango += 1;
  }
  sesion.fueraSeguidos = rango && rango !== 'dentro' ? sesion.fueraSeguidos + 1 : 0;
  if (sesion.fueraSeguidos >= 5 && resta > 4) {
    const potencia = !!Ent.rangoWatts(b, ftp());
    const texto = rango === 'bajo' ? (potencia ? 'Sube la potencia' : 'Sube el ritmo') : (potencia ? 'Baja la potencia' : 'Baja el ritmo');
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

function pintar() {
  const t = sesion ? sesion.t : 0;
  const dist = sesion ? Math.round(sesion.dist) : (actual.distancia ?? 0);
  const f = ftp();
  const zona = Ent.zonaDe(actual.watts, f);
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
  $('#mr-estado').textContent = $('#pausa-aviso').textContent;
  const objPaladas = entrenamientoActivo?.objetivo?.metrica === 'paladas';
  $('#mr-extra-etq').textContent = objPaladas ? 'Calorías' : (entrenamientoActivo?.objetivo ? 'Paladas' : 'Calorías');
  $('#mr-extra').textContent = sesion ? Math.round(objPaladas || !entrenamientoActivo?.objetivo ? sesion.kcal : sesion.paladas) : 0;

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
}

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

function pintarBloque(t) {
  const ent = entrenamientoActivo;
  const f = ftp();
  const total = Ent.duracionTotal(ent);
  const puntos = sesion.muestras.map((x) => [x.t, x.w]);
  dibujarPerfil($('#grafica-perfil'), sesion.bloques, puntos, t);
  if (!$('#modo-remo').hidden) dibujarPerfil($('#mr-perfil'), sesion.bloques, puntos, t);
  const actualB = Ent.bloqueEn(ent, t);
  if (!actualB) {
    const pctRango = sesion.segConMeta ? `En rango ${Math.round((100 * sesion.segEnRango) / sesion.segConMeta)}% del tiempo` : '';
    $('#bloque-nombre').textContent = '¡Entrenamiento completado!';
    $('#bloque-resta').textContent = `+${formatoTiempo(t - total)}`;
    $('#bloque-meta').textContent = pctRango;
    $('#bloque-siguiente').textContent = '';
    $('#bloque-barra').style.width = '100%';
    $('#mr-nombre').textContent = '¡Completado!';
    $('#mr-meta-texto').textContent = pctRango;
    $('#mr-resta').textContent = `+${formatoTiempo(t - total)}`;
    $('#mr-resta-etq').textContent = 'extra';
    $('#mr-barra').style.width = '100%';
    marcarRango(null);
    return;
  }
  const { i, bloque: b, resta, siguiente } = actualB;
  const nombre = `${i + 1}/${ent.bloques.length} · ${b.nombre || 'Intervalo'}`;
  $('#bloque-nombre').textContent = nombre;
  $('#bloque-resta').textContent = formatoTiempo(resta);
  $('#bloque-meta').textContent = b.metrica ? `Meta: ${Ent.textoMeta(b, f)}` : 'Libre';
  $('#bloque-siguiente').textContent = siguiente ? `Sigue: ${siguiente.nombre || 'intervalo'} · ${Ent.textoMeta(siguiente, f)}` : 'Último intervalo';
  $('#bloque-barra').style.width = `${(100 * t) / total}%`;
  $('#mr-nombre').textContent = nombre;
  $('#mr-meta-texto').textContent = b.metrica ? Ent.textoMeta(b, f) : 'Libre';
  $('#mr-resta').textContent = formatoTiempo(resta);
  $('#mr-resta-etq').textContent = siguiente ? `luego ${Ent.textoMeta(siguiente, f)}` : 'último';
  $('#mr-barra').style.width = `${(100 * t) / total}%`;
  marcarRango(Ent.enRango(b, actual.watts, actual.spm, f), !!Ent.rangoWatts(b, f));
}

function dibujarVivo() {
  const metas = [];
  if (sesion && entrenamientoActivo && Ent.tipoDe(entrenamientoActivo) === 'intervalos') {
    const ab = Ent.bloqueEn(entrenamientoActivo, sesion.t);
    const r = ab && Ent.rangoWatts(ab.bloque, ftp());
    if (r) metas.push({ desde: tVivo - (sesion.t - ab.desde), hasta: tVivo + ab.resta, min: r.min, max: r.max || r.min, eje: 'izq' });
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
  $('#bloque-actual').hidden = !ent;
  const conPerfil = !!ent && Ent.tipoDe(ent) === 'intervalos';
  $('#perfil-vivo').hidden = !conPerfil;
  if (conPerfil) dibujarPerfil($('#grafica-perfil'), Ent.bloquesEnWatts(ent.bloques, ftp()));
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
    $('#bloque-resta').textContent = formatoTiempo(Ent.duracionTotal(ent));
    $('#bloque-meta').textContent = `${ent.bloques.length} intervalos · empieza: ${b.nombre || 'intervalo'} ${Ent.textoMeta(b, ftp())}`;
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
  actualizarBotones();
  try { mr.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {}); } catch { /* opcional */ }
  pintar();
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
  const lista = await db.listar('entrenamientos');
  const ul = $('#lista-ent');
  ul.innerHTML = '';
  if (!lista.length) ul.innerHTML = '<li class="vacio">Aún no tienes entrenamientos. Crea uno o agrega los ejemplos.</li>';
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
      <label><span class="mini">Tiempo (mm:ss)</span><input data-k="duracion" inputmode="numeric"></label>
      <label><span class="mini">Meta</span><select data-k="metrica">
        <option value="watts">Potencia (W)</option><option value="ftp">% de FTP</option><option value="spm">Golpes/min</option><option value="">Libre</option>
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
    q('duracion').value = Ent.formatoMmss(b.duracion);
    q('metrica').value = b.metrica || '';
    q('min').value = b.min || '';
    q('max').value = b.max || '';
    q('nivel').value = b.nivel || '';
    const unidadYZonas = () => {
      const m = b.metrica;
      fila.querySelector('.unidad').textContent = { watts: '(W)', ftp: '(% FTP)', spm: '(golpes/min)' }[m] || '';
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
      if (k === 'duracion') b.duracion = Math.max(5, Ent.deMmss(e.target.value));
      else if (k === 'min' || k === 'max') b[k] = Number(e.target.value) || 0;
      else if (k === 'nivel') {
        const n = Math.round(Number(e.target.value));
        if (n >= 1 && n <= 24) b.nivel = n; else delete b.nivel;
      } else b[k] = e.target.value;
      if (k === 'metrica') {
        if (b.metrica === 'ftp' && (b.min > 200 || !b.min)) { b.min = 56; b.max = 75; }
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
  if (form.tipo.value === 'intervalos') dibujarPerfil($('#grafica-editor'), Ent.bloquesEnWatts(enEdicion.bloques, ftp()));
  if (form.tipo.value === 'objetivo') {
    const m = Ent.METRICAS_OBJETIVO[form.obj_metrica.value];
    $('#ent-resumen').textContent = `La sesión termina al llegar a ${form.obj_valor.value || '?'} ${m.unidad}.`;
  } else {
    $('#ent-resumen').textContent = `${enEdicion.bloques.length} intervalos · duración total ${formatoTiempo(Ent.duracionTotal(enEdicion))}`;
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
    if (malo >= 0) { error(`En el intervalo ${malo + 1} el máximo es menor que el mínimo.`); return; }
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

async function pintarHistorial() {
  const lista = (await db.listar('sesiones')).sort((a, b) => b.fecha - a.fecha);
  cacheSesiones = lista;

  const dias = E.racha(lista);
  $('#racha').textContent = dias;
  $('#racha-etq').textContent = dias === 1 ? 'día seguido' : 'días seguidos';
  const semana = E.resumenPeriodos(lista, 'semana', 1)[0];
  const meta = ajustes.num('metaSemana', 10);
  const km = semana.metros / 1000;
  $('#semana-texto').textContent = `${km.toFixed(1)} de ${meta} km · ${semana.sesiones} ${semana.sesiones === 1 ? 'sesión' : 'sesiones'}`;
  $('#semana-barra').style.width = `${Math.min(100, (100 * km) / meta)}%`;
  pintarPeriodos();

  const orden = lista.slice(0, 30).reverse();
  dibujar($('#grafica-tendencia'), [
    { color: color('--watts'), eje: 'izq', puntos: orden.map((s, i) => [i * 60, s.wattsProm]) },
    { color: color('--split'), eje: 'der', puntos: orden.filter((s) => s.splitProm > 0).map((s) => [orden.indexOf(s) * 60, s.splitProm]) },
  ], { sinEjeX: true, marcas: true });

  const recs = E.calcularRecords(lista);
  $('#records').innerHTML = E.RECORDS.filter((r) => recs[r.clave]).map((r) => `<div class="record"><div class="etq">${r.nombre}</div>
    <div class="valor">${formatoRecord(r, recs[r.clave].valor)}</div><div class="sub">${fechaCorta(recs[r.clave].fecha)}</div></div>`).join('')
    || '';

  const ul = $('#lista-sesiones');
  ul.innerHTML = '';
  const totalM = lista.reduce((a, s) => a + s.distancia, 0);
  const totalT = lista.reduce((a, s) => a + s.duracion, 0);
  $('#resumen-historial').textContent = lista.length
    ? `${lista.length} ${lista.length === 1 ? 'sesión' : 'sesiones'} · ${(totalM / 1000).toFixed(1)} km · ${formatoTiempo(totalT)} en total`
    : '';
  if (!lista.length) ul.innerHTML = '<li class="vacio">Todavía no hay sesiones. Tu primera sesión aparecerá aquí.</li>';
  for (const s of lista) {
    const li = document.createElement('li');
    li.className = 'clic';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    const f = new Date(s.fecha);
    li.innerHTML = `<div class="info"><div class="titulo"></div><div class="suave"></div></div>${ico('i-baja')}`;
    li.querySelector('.ico').style.transform = 'rotate(-90deg)';
    li.querySelector('.titulo').textContent = `${f.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · ${s.entrenamiento || 'Remo libre'}`;
    li.querySelector('.suave').textContent = `${formatoTiempo(s.duracion)} · ${s.distancia} m · ${s.wattsProm} W · ${formatoSplit(s.splitProm)} /500 m${s.tiempoMeta != null ? ` · meta en ${formatoTiempo(s.tiempoMeta)}` : ''}`;
    li.addEventListener('click', () => abrirSesion(s, { previas: lista.filter((x) => x.id !== s.id && x.fecha < s.fecha) }));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') li.click(); });
    ul.append(li);
  }
}

// ---------- Resumen / detalle de sesión ----------
let sesionAbierta = null;

function abrirSesion(s, { resumen = false, previas = [] } = {}) {
  sesionAbierta = s;
  const hoja = $('#hoja');
  hoja.hidden = false;
  const f = new Date(s.fecha);
  $('#hoja-titulo').textContent = resumen ? '¡Sesión terminada!' : (s.entrenamiento || 'Remo libre');
  $('#hoja-sub').textContent = `${resumen && s.entrenamiento ? `${s.entrenamiento} · ` : ''}${f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}, ${f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;

  const recs = E.nuevosRecords(s, previas);
  $('#hoja-records').innerHTML = recs.map((r) => `<div class="record nuevo"><div class="etq">${ico('i-trofeo')}${resumen ? 'Nuevo récord' : 'Récord'}</div>
    <div class="valor">${formatoRecord(r, r.valor)}</div><div class="sub">${r.nombre}${r.anterior != null ? ` · antes ${formatoRecord(r, r.anterior)}` : ''}</div></div>`).join('');

  const hojaFtp = $('#hoja-ftp');
  hojaFtp.hidden = !s.pruebaWatts;
  if (s.pruebaWatts) {
    const nuevo = Ent.ftpDesdePrueba(s.pruebaWatts);
    hojaFtp.innerHTML = `Promedio en la prueba: <b>${s.pruebaWatts} W</b>. Tu FTP estimado es <b>${nuevo} W</b>${ftp() ? ` (antes ${ftp()} W)` : ''}.
      <div class="fila-botones"><button class="boton primario" id="btn-usar-ftp">Usar ${nuevo} W como FTP</button></div>`;
    $('#btn-usar-ftp').onclick = () => {
      ajustes.escribir('ftp', nuevo);
      $('#in-ftp').value = nuevo;
      pintarZonas();
      toast(`FTP actualizado a ${nuevo} W`);
      $('#btn-usar-ftp').disabled = true;
    };
  }

  const stats = [
    ['Duración', formatoTiempo(s.duracion)], ['Distancia', `${s.distancia} m`],
    ['Watts prom', s.wattsProm], ['Watts máx', s.wattsMax],
    ['Split prom', formatoSplit(s.splitProm)], ['Golpes/min', s.spmProm],
    ['Calorías', s.kcal], ['Paladas', s.paladas ?? '-'], ['Pulso prom', s.fcProm || '-'],
  ];
  if (s.tiempoMeta != null) stats.push(['Meta en', formatoTiempo(s.tiempoMeta)]);
  if (s.pctEnRango != null) stats.push(['En rango', `${s.pctEnRango}%`]);
  $('#hoja-stats').innerHTML = stats.map(([k, v]) => `<div class="metrica"><span class="etq">${k}</span><span class="valor">${v}</span></div>`).join('');

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

  requestAnimationFrame(() => {
    const m = s.muestras;
    dibujar($('#hoja-grafica'), [
      { color: color('--watts'), eje: 'izq', puntos: m.map((x) => [x.t, x.w]) },
      { color: color('--spm'), eje: 'der', puntos: m.map((x) => [x.t, x.spm]) },
    ]);
    $('#hoja-perfil').hidden = !s.bloques;
    if (s.bloques) dibujarPerfil($('#hoja-grafica-perfil'), s.bloques, m.map((x) => [x.t, x.w]));
  });
  $('#hoja-cerrar').focus();
}

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
});
actualizarBotones();
llenarSelectorEntrenamientos();
dibujarVivo();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
