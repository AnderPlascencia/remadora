// Conexión con la remadora y la banda, ciclo de la sesión (grabar, pausa, tic, terminar, guardar y recuperar) y fin de sesión.
import { BandaCardiaca, Remadora } from '../remadora.js';
import { formatoSplit, formatoTiempo, kcalPorSegundo } from '../protocolo.js';
import * as F from '../fantasma.js';
import * as db from '../db.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import { fijarSilencio, hablar, tiempoHablado } from '../voz.js';
import * as G from '../guion-voz.js';
import * as VJ from '../voz-juego.js';
import * as P from '../programa.js';
import { confeti } from '../efectos.js';
import * as J from '../juego.js';
import * as V from '../ventajas.js';
import * as C from '../consejos.js';
import * as Cap from '../capacidades.js';
import * as Pf from '../perfil.js';
import { crearReloj } from '../reloj.js';
import { VERSION } from '../version.js';
import { $, ajustes, escaparHtml, fcMaxima, fcRef, formatoMeta, ftp, ico, miles, perfil, pitido, previoHoy, toast, vibrar } from '../ui.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { actualizarFcMax, repararSesiones, ritmoObjetivo, selVariante } from './ajustes.js';
import { fcMax5s } from '../pulso.js';
import { crearReferencias, crearRivales, estimarFtp, ftpAutomatico, hayCarrera, pintarChips } from './preparar.js';
import {
  abrirModoRemo, carreraActual, carreraEnt, carreraRemo, cerrarModoRemo, dibujarVivo, duracionCarrera, modoEnt, pintar, pintarModoEnt, retratoPropio, velocidadReciente, vigilarTipoSesion, vistaPrevia,
} from './vivo.js';
import { agregarLog } from '../registro.js';
import { leyendaPerfil, obtenerEnt } from './planes.js';
import { pintarCurva, pintarForma, pintarGasto, pintarMotor, pintarTendencia } from './progreso.js';
import { estadoHeroe, guardarPersonaje, inventario, leerPersonaje, nombreAtributo, pintarLineaNivel } from './heroe.js';
import { abrirSesion, fcParaEsfuerzo } from './detalle.js';
import { contextoXp, delProgramaHoy, ftpDelPlan, pintarHoy, revisarPlanAuto } from './programa.js';
import * as XC from '../xp-carga.js';
import { bonoEquipo } from '../coleccion-bote.js';
import { equipoEnUso } from '../carrera.js';
import { permisoIntensidad, FRASE_SIN_INTENSIDAD } from '../intensidad.js';

// ---------- Conexión y estado en vivo ----------
export const remadora = new Remadora();
const banda = new BandaCardiaca();
export const actual = { watts: 0, spm: 0, split: 0, distancia: null, nivel: null, fc: 0 };
export const vivo = { watts: [], spm: [] };
let ultimoDato = 0;

// Al arrancar la app (en orden, desde app.js).
export function arrancarSesion1() {

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
    $('#btn-conectar').classList.toggle('activo', conectada);
    $('#btn-demo').textContent = remadora.demoTimer ? 'Detener demo' : 'Modo demo';
    // El aviso de Bluetooth sobra mientras se usa el modo demo.
    if (!Remadora.soportado()) $('#aviso-bt').hidden = !!remadora.demoTimer;
    if (estado.sesion) {
      if (texto.startsWith('Reconectando')) hablar('Conexión perdida, reconectando', { clave: 'reconectando', cadaSeg: 30 });
      if (texto === 'Conectada' && estado.sesion.perdida) { hablar('Reconectada'); toast('Reconectada: la sesión sigue'); }
      estado.sesion.perdida = !conectada;
      if (texto === 'Desconectada') toast('Sin conexión. La sesión sigue en pausa: reconecta o termínala.');
    }
    actualizarBotones();
    if (!estado.sesion) vistaPrevia();
  });
  remadora.addEventListener('datos', (e) => {
    const d = e.detail;
    ultimoDato = Date.now();
    if (d.tipo === 'remada') { actual.spm = d.spm; actual.split = d.split; }
    if (d.tipo === 'metricas') {
      actual.watts = d.watts; actual.distancia = d.distancia; actual.nivel = d.resistencia;
      // En modo demo, sin banda conectada, simula el pulso para poder probar las zonas.
      if (remadora.demoTimer && !bandaConectada) actual.fc = Math.round(actual.fc ? actual.fc + (Math.min(190, 95 + d.watts / 3) - actual.fc) * 0.05 : 100);
    }
  });
  // Un pulso fuera de 30–240 lpm es un error de lectura de la banda: se ignora. Un 0 (sin contacto o
  // desconectada) borra el pulso, para no seguir guardando el último valor como si fuera real.
  banda.addEventListener('fc', (e) => {
    bandaConectada = true;
    if (e.detail === 0) actual.fc = 0;
    else if (e.detail >= 30 && e.detail <= 240) { actual.fc = e.detail; ultimoFc = Date.now(); }
  });
  // Los intervalos RR (si el sensor los manda) se guardan con la sesión para medir la variabilidad del pulso.
  banda.addEventListener('rr', (e) => { if (estado.sesion && !enPausa()) estado.sesion.rr.push(...e.detail); });

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
      toast(fcMaxima() ? `Pulso conectado: ${nombre}` : `Pulso conectado. Pon tu edad en Ajustes › Pulso y zonas para ver tus zonas de pulso`);
    } catch (err) { agregarLog(`banda: ${err.message}`); }
  });
  $('#btn-demo-aviso').addEventListener('click', () => { remadora.iniciarDemo(); irA('entrenar'); });
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
      if (d.dataset.seccion === 'curva') pintarCurva();
      if (d.dataset.seccion === 'motor') pintarMotor();
      if (d.dataset.seccion === 'gasto') pintarGasto();
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    if (!b) return;
    irA(b.dataset.ir);
    // Un enlace puede llevar también a una subpestaña (por ejemplo Planes › Programa).
    if (b.dataset.pt) document.querySelector(`.vista.activa [data-pt="${b.dataset.pt}"]`)?.click();
  });
  pintarChips();
  $('#btn-grabar').addEventListener('click', async (e) => {
    if (estado.sesion) { confirmarTerminar(e.currentTarget); return; }
    if (!(await asegurarConexion())) return;
    iniciarSesion();
  });
  $('#mr-terminar').addEventListener('click', (e) => confirmarTerminar(e.currentTarget));
  for (const b of ['#btn-pausa', '#mr-pausa']) {
    $(b).addEventListener('click', () => {
      if (!estado.sesion) return;
      estado.sesion.pausaManual = !estado.sesion.pausaManual;
      // Al pulsar Seguir la pausa pasa a automática hasta tu primera palada: así no se graban segundos en 0 W.
      if (!estado.sesion.pausaManual) {
        const auto = ajustes.si('pausaAuto', true);
        estado.sesion.sinRemar = auto ? 3 : 0;
        estado.sesion.trasSeguir = auto;
      }
      hablar(estado.sesion.pausaManual ? 'Pausa' : 'Seguimos', { urgente: true });
      actualizarBotones();
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarSesionEnCurso(); });
  window.addEventListener('pagehide', () => guardarSesionEnCurso());
  $('#recuperar-guardar').addEventListener('click', async () => {
    $('#recuperar-dialogo').hidden = true;
    const s = await leerSesionEnCurso();
    if (!s) return;
    if (await yaGuardada(s)) { await borrarSesionEnCurso(); return; }
    const guardada = await guardarSesionTerminada(s, s.ent, { recuperada: true });
    // Una copia de una versión anterior (sin distFuente) se pasa a la distancia según watts.
    if (guardada && s.distFuente !== 'watts') await repararSesiones();
  });
  $('#recuperar-seguir').addEventListener('click', async () => {
    $('#recuperar-dialogo').hidden = true;
    const s = await leerSesionEnCurso();
    if (!s || estado.sesion) return;
    if (await yaGuardada(s)) { await borrarSesionEnCurso(); return; }
    // La copia se queda hasta que la sesión se guarde: si algo falla al seguir, se puede volver a recuperar.
    if (!(await asegurarConexion())) { ofrecerRecuperar(); return; }
    irA('entrenar');
    await iniciarSesion(s);
  });
  $('#recuperar-descartar').addEventListener('click', async () => {
    if (!confirm('¿Descartar la sesión sin guardar? No se puede deshacer.')) return;
    $('#recuperar-dialogo').hidden = true;
    await borrarSesionEnCurso();
    toast('Sesión descartada');
  });
  setInterval(tic, 500);
  $('#fin-seguir').addEventListener('click', () => { cerrarFin(); hablar('Seguimos'); });
  $('#fin-terminar').addEventListener('click', () => { cerrarFin(); if (estado.sesion) detenerSesion(); });
}
let bandaConectada = false;
let ultimoFc = 0;
let wakeLock = null;

export function actualizarBotones() {
  const g = $('#btn-grabar');
  pintarModoEnt();
  // Empezar conecta la remadora si hace falta; con un entrenamiento, hay que elegirlo antes.
  g.disabled = !estado.sesion && ((!remadora.conectada && !Remadora.soportado()) || (modoEnt() === 'objetivo' && !$('#sel-entrenamiento').value));
  g.classList.toggle('primario', !estado.sesion);
  g.classList.toggle('peligro', !!estado.sesion);
  g.classList.toggle('lleno', !!estado.sesion);
  g.innerHTML = estado.sesion ? `${ico('i-stop')}<span>Terminar</span>` : `${ico('i-play')}<span>${remadora.conectada ? 'Empezar' : 'Conectar y empezar'}</span>`;
  $('#btn-pausa').hidden = !estado.sesion;
  const pausada = estado.sesion?.pausaManual;
  for (const b of [$('#btn-pausa'), $('#mr-pausa')]) {
    b.innerHTML = pausada ? `${ico('i-play')}<span>Seguir</span>` : `${ico('i-pausa')}<span>Pausar</span>`;
    b.setAttribute('aria-label', pausada ? 'Reanudar' : 'Pausar');
  }
  $('#mr-pausa').disabled = !estado.sesion;
  $('#mr-terminar').disabled = !estado.sesion;
  $('#sel-entrenamiento').disabled = !!estado.sesion;
  // Antes de remar se muestra la tarjeta Preparar; durante la sesión, solo una línea de resumen.
  $('#preparar').hidden = !!estado.sesion;
  // Las preguntas de antes de remar, nunca durante la sesión (al terminar, Hoy decide si siguen).
  if (estado.sesion) $('#antes-remar').hidden = true;
  $('#linea-nivel').hidden = !!estado.sesion || !$('#linea-nivel').textContent;
  // Métricas y gráfica solo con la remadora conectada o durante la sesión.
  const vivo = !!estado.sesion || remadora.conectada;
  if ($('#en-vivo').hidden === vivo) { $('#en-vivo').hidden = !vivo; if (vivo) requestAnimationFrame(dibujarVivo); }
  $('#resumen-sesion').hidden = !estado.sesion;
  if (estado.sesion) {
    const contra = estado.sesion.rivales.length ? ` · contra ${estado.sesion.rivales.map((r) => corto(r.nombre)).join(', ')}` : '';
    $('#resumen-sesion').textContent = `${estado.sesion.entrenamiento || 'Remo libre'}${contra}`;
  }
  pintarChips();
}

// Terminar pide un segundo toque para evitar cortes accidentales mientras se rema.
function confirmarTerminar(boton) {
  const span = boton.querySelector('span');
  // Al confirmar se devuelve el texto: si no, la siguiente sesión arranca con «¿Seguro?» en el botón.
  if (boton.dataset.confirmar) { span.textContent = boton.dataset.confirmar; delete boton.dataset.confirmar; detenerSesion(); return; }
  const previo = span.textContent;
  boton.dataset.confirmar = previo;
  span.textContent = '¿Terminar?';
  setTimeout(() => { if (boton.dataset.confirmar) { delete boton.dataset.confirmar; span.textContent = previo; } }, 3000);
}

// Conecta la remadora si hace falta. Devuelve false si no se pudo (o la persona canceló).
async function asegurarConexion() {
  if (remadora.conectada) return true;
  try {
    await remadora.conectar(selVariante.value);
  } catch (err) {
    agregarLog(`error: ${err.message}`);
    $('#estado').textContent = err.name === 'NotFoundError' ? 'Cancelado' : `Error: ${err.message}`;
    return false;
  }
  return remadora.conectada;
}

// Bloques listos para el perfil, con duración estimada para los que terminan por distancia o paladas.
export function paraPerfil(bloques) {
  return Ent.bloquesEnWatts(bloques.map((b) => ({ ...b, duracion: Ent.duracionEstimada(b) })), ftp());
}

export function medidas() {
  return { t: estado.sesion.t, dist: estado.sesion.dist, paladas: estado.sesion.paladas, split: actual.split, spm: actual.spm };
}

// Talentos de carrera de tu clase y la ventaja elegida de la bolsa para esta carrera.
function crearVentaja(ent, racha, recientes = []) {
  const per = leerPersonaje();
  const clave = per.clase ? J.claseDe(per.clase).clave : null;
  const grados = clave ? J.gradosEn(per.arbol?.[clave] || {}, clave, Date.now()) : {};
  let objeto = $('#sel-ventaja').value || null;
  if (objeto && (V.esPrueba(ent) || !(inventario()[objeto] > 0))) objeto = null;
  const meta = ent?.objetivo?.metrica === 'distancia' ? ent.objetivo.valor : null;
  const dur = meta ? null : duracionCarrera();
  const final = meta ? { meta } : dur ? { duracion: dur } : null;
  if (objeto && V.objetoVentaja(objeto)?.necesitaFinal && !final) { toast(`${V.objetoVentaja(objeto).nombre} solo sirve en carreras con final: no se gastará`); objeto = null; }
  if (objeto === 'talisman' && !clave) { toast('El Talismán necesita una clase: no se gastará'); objeto = null; }
  // Las piezas del bote solo dan ventaja en las carreras normales, nunca en las pruebas.
  const equipo = V.esPrueba(ent) ? null : bonoEquipo(equipoEnUso());
  // Senda del héroe (etapa 4) y permiso del entrenador para los talentos de intensidad.
  const senda = clave ? J.sendaEn(per, clave) : 'a';
  const f = ftp();
  const cuerpo = f ? Cap.estadoCuerpo(recientes, f, Date.now(), { previo: previoHoy() }) : null;
  const intensidad = permisoIntensidad({ sesiones: recientes, ftp: f, cuerpo, prueba: V.esPrueba(ent) });
  // Habilidad de clase (etapa 5): nunca en pruebas. FTP fiable = de una prueba de las últimas 8 semanas.
  const ftpFiable = recientes.some((x) => (x.pruebaWatts || x.pruebaFtp) && x.fecha > Date.now() - 56 * 864e5);
  const conPaladas = recientes.filter((x) => x.paladas > 0 && x.distancia > 0).slice(-20);
  const mppMedia = conPaladas.length ? conPaladas.reduce((a, x) => a + x.distancia / x.paladas, 0) / conPaladas.length : 0;
  const habilidad = clave && !V.esPrueba(ent) ? { ftp: f, ftpFiable, mppMedia } : null;
  return V.nuevaVentaja({ clase: clave, grados, objeto, final, racha, equipo, senda, intensidad, habilidad });
}

// Días seguidos contando hoy (la sesión que empieza ya cuenta).
// Racha del plan contando hoy (si cumples lo de hoy), la misma que da XP y voluntad.
async function rachaConHoy() {
  const { h } = await estadoHeroe();
  return h.contexto?.racha || 1;
}

// reanudar: la copia de una sesión que quedó a medias (al recuperar, «Seguir»). Se sigue en la misma sesión,
// con su entrenamiento, su plan y lo ya remado, sin fantasmas (no se guardan en la copia).
async function iniciarSesion(reanudar = null) {
  document.querySelectorAll('.consejo').forEach((x) => x.remove());
  estado.entrenamientoActivo = reanudar ? reanudar.ent : await obtenerEnt($('#sel-entrenamiento').value);
  const intervalos = estado.entrenamientoActivo && Ent.tipoDe(estado.entrenamientoActivo) === 'intervalos';
  const [calMin, enfMin] = ajustes.leer('guiado', '0-0').split('-').map(Number);
  const plan = reanudar ? reanudar.plan || null
    : intervalos ? Ent.normalizarBloques(Ent.conCalentamiento(estado.entrenamientoActivo.bloques, calMin, enfMin), ftpDelPlan(estado.entrenamientoActivo), fcRef()) : null;
  $('#perfil-vivo').hidden = !plan;
  if (plan) $('#vivo-leyenda').innerHTML = leyendaPerfil(estado.entrenamientoActivo.bloques, true);
  const rivales = reanudar ? [] : await crearRivales(estado.entrenamientoActivo);
  const referencias = reanudar ? [] : await crearReferencias(estado.entrenamientoActivo);
  const rival = rivales[0] || null;
  // Potencia crítica y W′ con lo mejor de los últimos 90 días: alimentan la batería anaeróbica en vivo.
  const recientes = (await H.sesiones()).filter((x) => x.fecha > Date.now() - 90 * 864e5);
  const pc = E.potenciaCritica(E.curvaHistorial(recientes));
  // Calentamientos de las últimas sesiones con pulso: para notar si hoy vas más cargado que de costumbre.
  const calentamientos = recientes.filter((x) => x.muestras?.some((m) => m.fc)).slice(-15).map((x) => ({ muestras: x.muestras.slice(240, 301) }));
  estado.sesion = {
    inicio: Date.now(),
    tipoPlan: Cap.tipoPlan(estado.entrenamientoActivo),
    pc,
    calentamientos,
    wBal: pc?.wPrima ?? 0,
    t: 0,
    dist: 0,
    // La distancia que cuenta es la de los watts (como la de los fantasmas); la de la consola se guarda aparte.
    distFuente: 'watts',
    distConsola: 0,
    distPrevia: actual.distancia,
    muestras: [],
    rr: [],
    kcal: 0,
    paladas: 0,
    segConMeta: 0,
    segEnRango: 0,
    segBajo: 0,
    segAlto: 0,
    fueraSeguidos: 0,
    tiempoMeta: null,
    mitadAvisada: false,
    avance: [],
    entrenamiento: estado.entrenamientoActivo ? estado.entrenamientoActivo.nombre : null,
    pruebaFtp: !!estado.entrenamientoActivo?.pruebaFtp,
    plan,
    estadoAv: plan ? Ent.crearAvance() : null,
    info: null,
    bloques: plan ? paraPerfil(plan) : null,
    bloqueAnterior: -1,
    avisoCerca: -1,
    rival,
    rivales,
    referencias,
    sinRemar: 0,
    empezo: false,
    pausaManual: false,
    // Cada pausa con su hora real de inicio y fin (ms) y el segundo de la sesión en que empezó.
    pausas: [],
    trasSeguir: false,
    ultimaSpm: 0,
    segConsola: 1,
    perdida: false,
    ritmo: ritmoObjetivo(),
    n500: 0,
    t500: 0,
    parcial: null,
    lento: 0,
    eventosCarrera: [],
    lados: null,
    sprintAvisado: false,
    // Voz del entrenador (guion-voz.js): tipo del guion, series hechas y avisos ya dichos.
    guion: G.tipoGuion(estado.entrenamientoActivo, Cap.tipoPlan(estado.entrenamientoActivo)),
    series: [],
    inicioBloque: null,
    avisos: {},
    nAnimo: 0,
    // Capa de juego de la voz (voz-juego.js): clase, frases ya dichas, último aviso, hitos y «Atento al entrenador».
    claseVoz: leerPersonaje().clase ? J.claseDe(leerPersonaje().clase)?.clave || null : null,
    frasesUsadas: new Set(),
    ultimoJuego: null,
    hitosVoz: [],
    misionPlanVoz: false,
    aTiroDicho: false,
    atento: 0,
    correccionEn: null,
    retrato: rival ? await retratoPropio() : null,
  };
  if (reanudar) Object.assign(estado.sesion, estadoReanudado(reanudar));
  // Si era la sesión del día y lo que tocaba en el plan: se anota al empezar (luego ya habría cambiado).
  if (!estado.sesion.xpCtx) {
    const actualSes = estado.sesion;
    contextoXp(estado.entrenamientoActivo, recientes, actualSes.inicio).then((c) => {
      actualSes.xpCtx ??= c;
      // Ni en las sesiones del plan (suaves o duras) ni en un día de descanso: ahí no hay talentos de intensidad.
      if (c.delDia || c.delPlanSemana || c.descanso) V.apagarIntensidad(actualSes.ventaja, c.descanso ? 'descanso' : 'plan');
    });
  }
  if (plan) estado.sesion.info = Ent.avanzar(estado.sesion.estadoAv, plan, medidas());
  prepararSalida();
  await prepararAtrVivo();
  if (rival) estado.sesion.ventaja = crearVentaja(estado.entrenamientoActivo, await rachaConHoy(), recientes);
  const cx = estado.sesion.xpCtx;
  if (cx && (cx.delDia || cx.delPlanSemana || cx.descanso)) V.apagarIntensidad(estado.sesion.ventaja, cx.descanso ? 'descanso' : 'plan');
  actualizarBotones();
  $('#bloque-actual').hidden = !estado.entrenamientoActivo;
  // Paladas y calorías solo se ven con «Datos avanzados» o si el entrenamiento las pide como meta.
  for (const el of document.querySelectorAll('[data-metrica]')) el.classList.toggle('pide', estado.entrenamientoActivo?.objetivo?.metrica === el.dataset.metrica);
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
  pitido(880, 0.15);
  const contra = rivales.length > 1 ? `. Remas contra ${rivales.length} fantasmas` : rival ? '. Remas contra tu fantasma' : '';
  fijarSilencio(silencioDuro);
  if (reanudar) hablar(`Seguimos con ${estado.entrenamientoActivo ? estado.entrenamientoActivo.nombre : 'tu sesión'}`);
  else if (estado.entrenamientoActivo) {
    // El propósito de la sesión se dice al empezar, mientras se calienta: ahí caben las frases largas.
    const prop = G.proposito(estado.sesion.guion, estado.entrenamientoActivo, plan, { carrera: !!rival });
    hablar(`Comienza ${estado.entrenamientoActivo.nombre}${contra}.${prop ? ` ${prop}` : ''}`);
  } else hablar(`Sesión iniciada${contra}`);
  if (!reanudar) prepararVozJuego(estado.sesion);
  if (ajustes.si('modoAuto', false)) abrirModoRemo();
  pintar();
  // En horizontal la carrera no cabe junto a los botones: se lleva a la vista al empezar.
  if (hayCarrera() && matchMedia('(orientation: landscape) and (max-height: 520px)').matches) {
    requestAnimationFrame(() => $('#carrera').scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
}

async function detenerSesion() {
  const s = estado.sesion;
  const ent = estado.entrenamientoActivo;
  if (s) {
    s.fin = Date.now();
    const abierta = s.pausas?.at(-1);
    if (abierta && abierta.fin == null) abierta.fin = s.fin;
  }
  estado.sesion = null;
  estado.entrenamientoActivo = null;
  actualizarBotones();
  cerrarModoRemo();
  $('#pausa-aviso').hidden = true;
  $('#rival').hidden = true;
  $('#atr-vivo').hidden = true;
  $('#mr-atr').hidden = true;
  carreraEnt.detener();
  carreraRemo.detener();
  cerrarFin();
  vistaPrevia();
  try { await wakeLock?.release(); } catch { /* nada */ }
  wakeLock = null;
  if (!s || s.muestras.length < 10) { await borrarSesionEnCurso(); toast('Sesión muy corta: no se guardó'); return; }
  // Primero la copia con el final de la sesión; se borra solo cuando la sesión quedó guardada.
  await guardarSesionEnCurso(s, ent);
  await guardarSesionTerminada(s, ent);
}

// ---------- Sesión en curso a salvo ----------
// Android puede cerrar la app en segundo plano o con el gesto de atrás: cada 10 s remados (y al ocultarse)
// se copia lo remado para ofrecer guardarlo al volver a abrir. La copia vive en IndexedDB (sin el límite de
// ~5 MB de localStorage ni el JSON.stringify en el hilo principal); si IndexedDB falla, se intenta en
// localStorage. La copia solo se borra cuando la sesión quedó guardada de verdad.
const CLAVE_EN_CURSO = 'sesionEnCurso';
function copiaEnCurso(s, ent) {
  return {
    inicio: s.inicio, t: s.t, dist: s.dist, distConsola: s.distConsola, distFuente: s.distFuente, kcal: s.kcal, paladas: s.paladas, muestras: s.muestras,
    segConMeta: s.segConMeta, segEnRango: s.segEnRango, segBajo: s.segBajo, segAlto: s.segAlto, tiempoMeta: s.tiempoMeta, entrenamiento: s.entrenamiento,
    pruebaFtp: s.pruebaFtp, plan: s.plan, estadoAv: s.estadoAv, pausas: s.pausas, fin: s.fin ?? null, guardada: Date.now(), xpCtx: s.xpCtx ?? null,
    ent: ent ? { nombre: ent.nombre, bloques: ent.bloques, objetivo: ent.objetivo } : null,
  };
}
async function guardarSesionEnCurso(s = estado.sesion, ent = estado.entrenamientoActivo) {
  if (!s || s.muestras.length < 10) return;
  const copia = copiaEnCurso(s, ent);
  try {
    await db.guardarEstado('enCurso', copia);
    try { localStorage.removeItem(CLAVE_EN_CURSO); } catch { /* nada */ }
  } catch (e) {
    agregarLog(`copia de la sesión en IndexedDB falló: ${e?.name || e}`);
    try { localStorage.setItem(CLAVE_EN_CURSO, JSON.stringify(copia)); } catch { /* sin espacio: se reintenta en 10 s */ }
  }
}
async function borrarSesionEnCurso() {
  try { localStorage.removeItem(CLAVE_EN_CURSO); } catch { /* nada */ }
  try { await db.borrarEstado('enCurso'); } catch (e) { agregarLog(`no se pudo borrar la copia de la sesión: ${e?.name || e}`); }
}
async function leerSesionEnCurso() {
  let s = null;
  try { s = await db.leerEstado('enCurso'); } catch { /* se mira en localStorage */ }
  if (s) return s;
  // Copias de versiones anteriores (o de cuando IndexedDB falló).
  try { return JSON.parse(localStorage.getItem(CLAVE_EN_CURSO) || 'null'); } catch { return null; }
}

// Al abrir la app con una sesión que quedó a medias, se ofrece guardarla (sin carrera: los fantasmas no se guardan).
export async function ofrecerRecuperar() {
  const s = await leerSesionEnCurso();
  if (!s || estado.sesion) return;
  if (!Array.isArray(s.muestras) || s.muestras.length < 10) { await borrarSesionEnCurso(); return; }
  // Ya está guardada (se guardó pero no se alcanzó a borrar la copia): no se ofrece dos veces.
  if (await yaGuardada(s)) { await borrarSesionEnCurso(); return; }
  const fin = s.muestras.at(-1);
  const f = new Date(s.inicio);
  const cuando = `${f.toLocaleDateString('es-MX', { weekday: 'long' })} a las ${f.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}`;
  $('#recuperar-texto').textContent = `${s.entrenamiento || 'Remo libre'} del ${cuando}: ${formatoTiempo(fin.t)} y ${miles(fin.dist)} m. La app se cerró antes de terminarla.`;
  $('#recuperar-dialogo').hidden = false;
  $('#recuperar-guardar').focus();
}
async function yaGuardada(s) {
  try { return (await H.sinMuestras()).some((x) => x.fecha === s.inicio); } catch { return false; }
}
// Lo que ya se había remado, para seguir en la misma sesión. El tiempo con la app cerrada queda como pausa:
// la que estaba abierta sigue abierta, o se abre una desde la última copia, y se cierra al volver a remar.
function estadoReanudado(c) {
  const m = c.muestras;
  const pausas = (c.pausas || []).map((p) => ({ ...p }));
  if (pausas.at(-1)?.fin !== null || !pausas.length) pausas.push({ t: c.t, ini: c.guardada || Date.now(), fin: null, motivo: 'cierre' });
  const n500 = Math.floor(c.dist / 500);
  const cruce = n500 ? m.find((x) => x.dist >= n500 * 500) : null;
  return {
    inicio: c.inicio, t: c.t, dist: c.dist, distConsola: c.distConsola || 0, kcal: c.kcal, paladas: c.paladas, muestras: m,
    segConMeta: c.segConMeta || 0, segEnRango: c.segEnRango || 0, segBajo: c.segBajo || 0, segAlto: c.segAlto || 0, tiempoMeta: c.tiempoMeta ?? null,
    estadoAv: c.estadoAv ?? estado.sesion.estadoAv, pruebaFtp: !!c.pruebaFtp, pausas, pausaPrevia: 'auto', reanudada: true, xpCtx: c.xpCtx ?? null,
    avance: estado.entrenamientoActivo?.objetivo?.metrica === 'distancia' ? m.map((x) => [x.t, x.dist]) : [],
    n500, t500: cruce ? cruce.t : 0, ultimaSpm: m.at(-1)?.spm || 0,
  };
}

// Arma el registro de una sesión terminada (o recuperada tras cerrar la app), lo guarda y abre su resumen.
async function guardarSesionTerminada(s, ent, { recuperada = false } = {}) {
  const m = s.muestras;
  const prom = (k) => Math.round(m.reduce((a, x) => a + x[k], 0) / m.length);
  const conSplit = m.filter((x) => x.split > 0);
  const registro = {
    fecha: s.inicio,
    duracion: m.at(-1).t,
    distancia: m.at(-1).dist,
    // Sin distFuente (una sesión a medias de una versión anterior) se pasa a watts al reparar sesiones.
    ...(s.distFuente === 'watts' ? { distFuente: 'watts', distanciaConsola: Math.round(s.distConsola || 0) } : {}),
    kcal: Math.round(s.kcal),
    paladas: Math.round(s.paladas),
    // Hora real de fin y pausas (una sesión recuperada cierra la última pausa a la hora en que se copió).
    horaFin: s.fin || s.guardada || null,
    pausas: (s.pausas || []).map((p) => ({ t: p.t, ini: p.ini, fin: Math.max(p.ini, p.fin ?? s.fin ?? s.guardada ?? p.ini), motivo: p.motivo })),
    version: VERSION,
    wattsProm: prom('w'),
    wattsMax: m.reduce((a, x) => Math.max(a, x.w), 0),
    spmProm: prom('spm'),
    splitProm: conSplit.length ? Math.round(conSplit.reduce((a, x) => a + x.split, 0) / conSplit.length) : 0,
    fcProm: m.some((x) => x.fc) ? Math.round(m.filter((x) => x.fc).reduce((a, x) => a + x.fc, 0) / m.filter((x) => x.fc).length) : 0,
    fcMax: m.reduce((a, x) => Math.max(a, x.fc || 0), 0),
    entrenamiento: s.entrenamiento,
    enfoque: ent ? P.enfoqueDe(ent) : null,
    tipoPlan: s.tipoPlan ?? null,
    tiempoMeta: s.tiempoMeta,
    delPrograma: delProgramaHoy(s),
    // Para el juego (xp-carga.js): reglas de XP por carga, si era la sesión del día y qué tocaba en el plan.
    ...(s.xpCtx || { reglasXp: XC.REGLAS_XP_CARGA }),
    ...(s.atento ? { atento: s.atento } : {}),
    pctEnRango: s.segConMeta ? Math.round((100 * s.segEnRango) / s.segConMeta) : null,
    // Lo que quedó fuera, separado: por debajo (te costó) o por encima (te sobró). La adaptación del plan lo usa.
    pctBajo: s.segConMeta ? Math.round((100 * (s.segBajo || 0)) / s.segConMeta) : null,
    pctAlto: s.segConMeta ? Math.round((100 * (s.segAlto || 0)) / s.segConMeta) : null,
    bloques: s.plan ? Ent.bloquesConDuracion(s.estadoAv, s.plan, { t: s.t, dist: s.dist, paladas: s.paladas }) : null,
    muestras: m,
    ftp: ftp() || null,
    rpe: null,
    notas: '',
  };
  registro.estres = E.estres(registro, registro.ftp);
  Object.assign(registro, {
    kj: E.trabajoKj(m),
    vi: E.variabilidadPotencia(m),
    intensidad: E.factorIntensidad(m, registro.ftp),
    derivaFc: E.derivaCardiaca(m),
  });
  // Desacople solo en el tramo principal estable (el bloque de trabajo más largo, o el remo libre sin sus extremos).
  const dsc = E.desacopleDe(m, registro.bloques);
  Object.assign(registro, { desacople: dsc?.pct ?? null, desacopleSeg: dsc?.seg ?? null });
  const fc5 = fcMax5s(m);
  if (fc5) registro.fcMax5 = fc5;
  // Recuperación de pulso a 60 s tras el último bloque de trabajo, si la sesión siguió un minuto más.
  const recTrabajo = E.recuperacionTrasTrabajo(m, registro.bloques);
  if (recTrabajo != null) Object.assign(registro, { fcRec60: recTrabajo, fcRecDe: 'trabajo' });
  if (s.rr?.length) { registro.rr = s.rr; registro.rmssd = E.rmssd(s.rr.slice(0, 180)); }
  if (s.ajusteCalentamiento) registro.ajusteCalentamiento = s.ajusteCalentamiento;
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
    const metaCarrera = ent?.objetivo?.metrica === 'distancia' ? ent.objetivo.valor : null;
    // En una carrera a distancia manda quién cruzó primero: lo remado después de la meta («Seguir remando»)
    // no adelanta a fantasmas que ya llegaron y se detuvieron.
    // Sin meta de distancia (intervalos o tiempo), la carrera se cierra al completar el plan: los fantasmas
    // se detienen ahí, así que los metros de «Seguir remando» tampoco cuentan.
    const metrosVs = (r) => {
      if (metaCarrera == null && s.tiempoMeta != null) return E.distanciaEn(m, s.tiempoMeta) - E.distanciaEn(r.muestras, s.tiempoMeta);
      if (metaCarrera == null || s.tiempoMeta == null) return s.dist - E.distanciaEn(r.muestras, s.t);
      const tr = F.tiempoA(r, metaCarrera);
      if (tr != null && tr < s.tiempoMeta) return E.distanciaEn(m, tr) - metaCarrera;
      return metaCarrera - E.distanciaEn(r.muestras, s.tiempoMeta);
    };
    const resumen = (r) => ({
      fecha: r.fecha ?? null, nivel: r.nivel ?? null, nombre: r.nombre, clase: r.clase ?? null, rango: r.rango ?? null, dificultad: r.dificultad ?? null,
      diferencia: V.diferenciaFinal(metrosVs(r), s.ventaja),
      tiempo: metaCarrera ? F.tiempoA(r, metaCarrera) : null,
    });
    if (s.ventaja && (V.metrosVentaja(s.ventaja) >= 0.5 || s.ventaja.objeto)) {
      registro.ventaja = { metros: Math.round(V.metrosVentaja(s.ventaja)), talentos: Math.round(s.ventaja.talentos), objeto: s.ventaja.objeto };
    }
    if (s.ventaja?.objeto) registro.ventajaUsada = s.ventaja.objeto;
    // Para el límite semanal de intensidad (2 sesiones duras o con intensidad por semana).
    if (V.usoIntensidad(s.ventaja)) registro.intensidad = true;
    registro.rival = resumen(s.rival);
    if (s.rivales.length > 1) registro.rivales = s.rivales.map(resumen);
    // Terminar antes de completar el entrenamiento no gana la carrera: se guarda la diferencia, pero no cuenta como victoria.
    // En Remo libre no hay meta: cuenta si remaste al menos 5 minutos.
    if (ent ? s.tiempoMeta == null : s.t < 300) registro.carreraSinTerminar = true;
  }
  if (s.referencias?.length) {
    registro.referencias = s.referencias.map((r) => ({ nombre: r.nombre, fecha: r.fecha ?? null, diferencia: Math.round(s.dist - E.distanciaEn(r.muestras, s.t)) }));
  }
  registro.marcas = E.marcasDeSesion(registro);
  let previas;
  try {
    previas = await H.sesiones();
    const id = await H.guardar(registro);
    if (registro.id == null && id != null) registro.id = id;
  } catch (e) {
    // La copia de la sesión en curso se queda: se puede volver a intentar ahora o al abrir la app.
    agregarLog(`no se pudo guardar la sesión: ${e?.name || ''} ${e?.message || e}`);
    toast('No se pudo guardar la sesión. Sigue a salvo: vuelve a intentarlo.', 6000);
    ofrecerRecuperar();
    return false;
  }
  await borrarSesionEnCurso();
  if (registro.ventajaUsada) {
    const inv = inventario();
    guardarPersonaje({ inventario: { ...inv, [registro.ventajaUsada]: Math.max(0, (inv[registro.ventajaUsada] || 0) - 1) } });
  }
  pitido(660, 0.2);
  agregarLog(`sesión guardada: ${formatoTiempo(registro.duracion)}, ${registro.distancia} m`);
  const ftpAuto = ftpAutomatico(registro);
  // Con pulso, el esfuerzo se calcula solo; sin pulso, se pregunta en el resumen.
  const porPulso = E.esfuerzoPorPulso(registro.muestras, fcParaEsfuerzo());
  if (porPulso) Object.assign(registro, { rpe: porPulso.rpe, rpeFuente: 'pulso', rpePct: porPulso.pct });
  if (porPulso) await H.actualizar(registro.id, { rpe: registro.rpe, rpeFuente: registro.rpeFuente, rpePct: registro.rpePct });
  const recs = E.nuevosRecords(registro, previas);
  if (!recuperada) hablar(`Sesión terminada. ${(registro.distancia / 1000).toFixed(1).replace('.', ' punto ')} kilómetros${recs.length ? `. ${recs.length === 1 ? 'Nuevo récord' : `${recs.length} récords nuevos`}` : ''}${porPulso ? `. Esfuerzo ${porPulso.rpe} de 10 según tu pulso` : '. ¿Qué tan duro se sintió?'}`);
  abrirSesion(registro, { resumen: true, previas, ftpAuto });
  if (!recuperada) setTimeout(() => decirResumenJuego(registro, previas), 0);
  await revisarPlanAuto();
  pintarHoy();
  pintarLineaNivel();
  if (!recuperada && registro.fcRec60 == null) medirRecuperacionPulso(registro);
  actualizarFcMax(previas.concat(registro));
  return true;
}

// Sigue leyendo el pulso un minuto después de terminar y guarda cuánto bajó (recuperación de pulso a 60 s).
function medirRecuperacionPulso(registro) {
  const fcFin = registro.muestras.at(-1)?.fc;
  if (!fcFin || registro.id == null) return;
  setTimeout(async () => {
    const fresco = Date.now() - ultimoFc < 5000;
    const rec = fresco ? E.recuperacionPulso(fcFin, actual.fc) : null;
    if (rec == null) return;
    registro.fcRec60 = rec;
    await H.actualizar(registro.id, { fcRec60: rec });
    agregarLog(`recuperación de pulso: ${rec} lpm en 60 s`);
  }, 60000);
}

// Un tic por segundo: lee el estado, avanza la sesión (si no está en pausa) y pinta.
// Los segundos salen del reloj (Date.now), no de contar tics: con la app en segundo plano Chrome frena los
// temporizadores (hasta uno por minuto) y se perdían tiempo y metros. Si pasaron varios segundos desde el
// último tic, se avanzan todos con el último dato recibido; si el dato ya es viejo, cuentan como pausa.
const segundosDelReloj = crearReloj();
let copiaPendiente = false;
function tic() {
  const n = segundosDelReloj();
  if (!n) return;
  if (n > 2 && estado.sesion) agregarLog(`reloj: ${n} s sin tic (app en segundo plano); se ponen al día`);
  for (let i = 0; i < n; i++) {
    if (Date.now() - ultimoDato > 3000) { actual.watts = 0; actual.spm = 0; }
    estado.tVivo += 1;
    for (const [k, v] of [['watts', actual.watts], ['spm', actual.spm]]) {
      vivo[k].push([estado.tVivo, v]);
      if (vivo[k].length > 600) vivo[k].shift();
    }
    if (estado.sesion) avanzarSesion();
  }
  // Una sola copia aunque se hayan puesto al día muchos segundos.
  if (copiaPendiente) { copiaPendiente = false; guardarSesionEnCurso(); }
  if (!Remadora.soportado()) $('#aviso-bt').hidden = !!remadora.demoTimer;
  pintar();
}

export function enPausa() {
  if (!estado.sesion) return false;
  if (estado.sesion.pausaManual) return 'manual';
  if (!remadora.conectada) return 'conexion';
  if (ajustes.si('pausaAuto', true) && (!estado.sesion.empezo || estado.sesion.sinRemar >= 3)) return 'auto';
  return false;
}

// Una pausa abierta sigue siendo la misma aunque cambie de motivo (manual → automática tras Seguir).
// La espera antes de la primera palada no cuenta como pausa.
function registrarPausa(pausa) {
  const ps = estado.sesion.pausas;
  const abierta = ps.at(-1)?.fin == null ? ps.at(-1) : null;
  if (pausa && !abierta && estado.sesion.t > 0) ps.push({ t: estado.sesion.t, ini: Date.now(), fin: null, motivo: pausa });
  else if (!pausa && abierta) abierta.fin = Date.now();
}

function avanzarSesion() {
  const remando = actual.spm > 0 || actual.watts > 0;
  estado.sesion.sinRemar = remando ? 0 : estado.sesion.sinRemar + 1;
  if (remando) estado.sesion.empezo = true;

  // Distancia de la consola, acumulada aunque reinicie su contador (por ejemplo tras reconectar). Solo informativa.
  if (actual.distancia != null) {
    if (estado.sesion.distPrevia == null) estado.sesion.distPrevia = actual.distancia;
    const m = E.metrosNuevos(estado.sesion.distPrevia, actual.distancia, estado.sesion.segConsola);
    if (m === 0 && actual.distancia !== estado.sesion.distPrevia) agregarLog(`distancia ignorada: ${estado.sesion.distPrevia} → ${actual.distancia} m`);
    estado.sesion.distConsola = (estado.sesion.distConsola || 0) + m;
    estado.sesion.segConsola = actual.distancia === estado.sesion.distPrevia ? (estado.sesion.segConsola || 1) + 1 : 1;
    estado.sesion.distPrevia = actual.distancia;
  }

  const pausa = enPausa();
  if (pausa !== estado.sesion.pausaPrevia) {
    // Tras pulsar Seguir ya se dijo «Seguimos»: no se repite al pasar a la pausa automática ni al volver a remar.
    const callar = estado.sesion.trasSeguir;
    if (pausa === 'auto' && estado.sesion.empezo && !callar) hablar('Pausa', { clave: 'pausa', cadaSeg: 10 });
    if (!pausa && estado.sesion.pausaPrevia === 'auto' && estado.sesion.t > 0 && !callar) hablar('Seguimos', { clave: 'seguimos', cadaSeg: 10 });
    if (!pausa) estado.sesion.trasSeguir = false;
    registrarPausa(pausa);
    estado.sesion.pausaPrevia = pausa;
  }
  if (pausa) return;

  estado.sesion.t += 1;
  const t = estado.sesion.t;
  estado.sesion.dist += E.metrosPorWatts(actual.watts);
  // Basal por segundo de tu perfil (Mifflin-St Jeor con edad, sexo y altura; si no, 1 kcal por kg y hora).
  estado.sesion.basal ??= Pf.basalPorHora(perfil()) / 3600;
  estado.sesion.kcal += kcalPorSegundo(actual.watts) + estado.sesion.basal;
  // Al reanudar llegan watts antes que el primer dato de palada: se usa la última cadencia en vez de 0.
  if (actual.spm > 0) estado.sesion.ultimaSpm = actual.spm;
  const spm = actual.spm > 0 ? actual.spm : actual.watts > 0 ? estado.sesion.ultimaSpm || 0 : 0;
  estado.sesion.paladas += spm / 60;
  estado.sesion.muestras.push({
    t, w: actual.watts, spm, split: actual.split, dist: Math.round(estado.sesion.dist), nivel: actual.nivel ?? 0, fc: actual.fc,
  });
  estado.sesion.wMax = Math.max(estado.sesion.wMax || 0, actual.watts);
  sincronizarSalida(t);
  const calentando = estado.sesion.salida && !estado.sesion.salida.hecha;
  coachRitmo(t);
  vigilarTipoSesion(t);
  if (t % 10 === 0) copiaPendiente = true;
  if (estado.sesion.ventaja && !calentando) {
    const miDist = estado.sesion.dist + V.metrosVentaja(estado.sesion.ventaja);
    const delante = estado.sesion.rivales.map((r) => E.distanciaEn(r.muestras, t) - miDist).filter((d) => d > 0);
    const detras = delante.length > 0;
    const brecha = detras ? Math.min(...delante) : null;
    V.avanzarVentaja(estado.sesion.ventaja, { t, dist: estado.sesion.dist, paladas: estado.sesion.paladas, spm: actual.spm, detras, w: actual.watts, brecha });
  }
  if (estado.sesion.rivales.length && !calentando) { vigilarAdelantos(t); tamborSprint(); }
  avisarTalentos();
  if (t % 5 === 0) actualizarAtrVivo();
  if (estado.sesion.rival && t % 60 === 0 && !calentando) {
    const dif = Math.round(estado.sesion.dist + V.metrosVentaja(estado.sesion.ventaja) - E.distanciaEn(estado.sesion.rival.muestras, t));
    const meta = estado.entrenamientoActivo?.objetivo?.metrica === 'distancia' ? estado.entrenamientoActivo.objetivo.valor : 0;
    const aTiro = estado.sesion.aTiroDicho ? '' : VJ.rivalATiro({ dist: estado.sesion.dist, meta, dif });
    if (aTiro && hablarJuego(aTiro, t)) estado.sesion.aTiroDicho = true;
    else if (Math.abs(dif) >= 5) hablar(`Vas ${Math.abs(dif)} metros ${dif > 0 ? 'adelante' : 'atrás'} de tu fantasma`, { clave: 'fantasma', cadaSeg: 50 });
  }
  if (!estado.entrenamientoActivo) return;
  if (Ent.tipoDe(estado.entrenamientoActivo) === 'objetivo') {
    estado.sesion.avance.push([t, { distancia: estado.sesion.dist, kcal: estado.sesion.kcal, paladas: estado.sesion.paladas }[estado.entrenamientoActivo.objetivo.metrica]]);
    avanceObjetivo(t);
  } else avanceBloque(t);
}

// Atributos en vivo: lo que llevas de los que se ganan remando, el siguiente punto y un aviso al sumar.
const ATR_VIVO = ['fuerza', 'agilidad', 'resistencia', 'tecnica'];
async function prepararAtrVivo() {
  $('#atr-vivo').hidden = true;
  $('#mr-atr').hidden = true;
  if (!estado.sesion || ajustes.leer('atrVivo', '1') !== '1') return;
  const { per, h } = await estadoHeroe();
  if (!estado.sesion) return;
  estado.sesion.atr = { opc: { ftp: ftp() || estimarFtp(await H.sesiones()) || 150, clase: per.clase || null, ctx: h.contexto }, vistos: {}, ultimoPop: -99 };
}
function actualizarAtrVivo() {
  const a = estado.sesion?.atr;
  if (!a || !estado.sesion.muestras.length) return;
  const pct = estado.sesion.segConMeta ? Math.round((100 * estado.sesion.segEnRango) / estado.sesion.segConMeta) : null;
  const b = estado.sesion.info && !estado.sesion.info.terminado ? estado.sesion.info.bloque : null;
  const rw = b && Ent.rangoWatts(b, ftp());
  const v = C.enVivo(estado.sesion.muestras, { ...a.opc, pct, tipo: estado.sesion.tipoPlan ?? null, rango: rw ? { min: Math.round(rw.min), max: Math.round(rw.max) } : null });
  if (!v) return;
  const subidas = ATR_VIVO.filter((k) => v.puntos[k] > (a.vistos[k] || 0));
  if (subidas.length && estado.sesion.t - a.ultimoPop >= 15) {
    const k = subidas.includes(v.reto.atributo) ? v.reto.atributo : subidas[0];
    const f = a.opc.ftp;
    const porque = { fuerza: `Otro tramo por encima de ${Math.round(f * 0.91)} W`, agilidad: `20 s por encima de ${Math.round(f * 1.06)} W`, resistencia: 'Minutos en zonas 2 y 3', tecnica: pct != null ? `En rango el ${pct} % del tiempo` : 'Buena palada' }[k];
    mostrarPopAtr(`+${v.puntos[k] - (a.vistos[k] || 0)} ${nombreAtributo(k)}`, `${porque}. Llevas +${v.puntos[k]} hoy.`);
    a.ultimoPop = estado.sesion.t;
  }
  for (const k of ATR_VIVO) a.vistos[k] = Math.max(a.vistos[k] || 0, v.puntos[k]);
  pintarAtrVivo(v);
}
function pintarAtrVivo(v) {
  const r = v.reto;
  const n = nombreAtributo(r.atributo);
  const anillo = `<span class="anillo" style="--p:${Math.round(r.progreso * 100)}%" aria-hidden="true"></span>`;
  const meta = r.faltanSeg ? `+1 ${n} en ${r.faltanSeg} s` : r.corto || `Suma ${n}`;
  // En Entrenar el título ya va al lado: si trae los watts, la meta no los repite.
  const metaCaja = !r.faltanSeg && /\d W\b/.test(r.titulo) ? `Suma ${n}` : meta;
  $('#atr-vivo').hidden = false;
  // Solo los atributos que ya sumaron hoy (o el del reto en curso): seis chips en +0 son ruido.
  $('#atr-vivo-chips').innerHTML = ATR_VIVO.filter((k) => v.puntos[k] > 0 || k === r.atributo).map((k) => `<span class="${k === r.atributo ? 'activo' : ''}">${nombreAtributo(k)} <b>+${v.puntos[k]}</b></span>`).join('');
  $('#atr-reto').innerHTML = `${anillo}<div><b>${escaparHtml(r.titulo)}</b><small>${escaparHtml(r.detalle)}</small></div><span class="cond-pts">${metaCaja}</span>`;
  const mr = $('#mr-atr');
  mr.hidden = false;
  // Una línea corta: el anillo es el avance hacia el próximo punto y va pegado a su texto; el resto, el total de hoy.
  const hoy = ATR_VIVO.reduce((a, k) => a + (v.puntos[k] || 0), 0);
  mr.innerHTML = `${anillo}<span><b>${meta}</b> · ${hoy ? `hoy +${hoy} ${hoy === 1 ? 'punto' : 'puntos'}` : 'aún sin puntos hoy'}</span>`;
  mr.title = `El anillo es lo que te falta para ${r.faltanSeg ? `+1 ${n}` : 'el próximo punto'}`;
}
let popAtrTimer = 0;
function mostrarPopAtr(titulo, detalle) {
  const el = $('#atr-pop');
  el.innerHTML = `${ico('i-sube')}<div><b>${titulo}</b><small>${escaparHtml(detalle)}</small></div>`;
  el.hidden = false;
  el.classList.toggle('en-remo', !$('#modo-remo').hidden);
  clearTimeout(popAtrTimer);
  popAtrTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

// Avisos de los talentos de carrera: los frecuentes (paladas extra, cada 250 m…) solo en la pista; los grandes, también con voz.
function avisarTalentos() {
  const v = estado.sesion.ventaja;
  if (!v) return;
  // Senda B con un talento de intensidad apagado por el cuerpo, la recuperación o la semana: se dice una vez.
  const conReserva = v.habilidad && v.habilidad.id !== v.habilidad.base;
  if (!v.avisoIntensidad && ['cuerpo', 'recuperacion', 'semana'].includes(v.intensidad.motivo) && (conReserva || (v.senda === 'b' && (v.grados.m3 || 0) > 0 && ['vikingo', 'polinesio', 'romano'].includes(v.clase)))) {
    v.avisoIntensidad = true;
    hablar(FRASE_SIN_INTENSIDAD, { clave: 'talento', cadaSeg: 15 });
  }
  for (const ev of v.eventos.slice(v.vistos)) {
    const m = ev.m >= 1 ? Math.round(ev.m) : ev.m.toFixed(1).replace('.', ',');
    eventoCarrera('ventaja', `+${m} m`, ev.nombre);
    if (!ev.discreto) {
      toast(`${ev.nombre}: +${m} m`);
      hablar(`${ev.nombre}: más ${m} metros`, { clave: 'talento', cadaSeg: 15 });
    }
  }
  v.vistos = v.eventos.length;
}

// Salida tras el calentamiento: si el plan empieza calentando y hay fantasmas, durante el calentamiento van a tu
// par y la carrera arranca cuando acaba. Cada segundo se rehacen sus muestras con la salida estimada; al llegar,
// se fijan con la salida real.
function prepararSalida() {
  const n = estado.sesion.plan ? F.bloquesCalentamiento(estado.sesion.plan) : 0;
  const fantasmas = [...estado.sesion.rivales, ...estado.sesion.referencias];
  if (!n || !fantasmas.length) return;
  const nSuyo = F.bloquesCalentamiento(estado.entrenamientoActivo?.bloques);
  for (const r of fantasmas) {
    r.original = r.muestras;
    // Simulados: su salida es el fin de su propio calentamiento. Sesiones guardadas: el mismo segundo que la tuya.
    r.salidaPropia = r.cortes ? (nSuyo ? r.cortes[nSuyo - 1] : 0) : null;
  }
  estado.sesion.salida = { n, hecha: false };
  sincronizarSalida(0);
}

function sincronizarSalida(t) {
  const s = estado.sesion.salida;
  if (!s || s.hecha) return;
  const hecha = estado.sesion.estadoAv.duraciones.length >= s.n;
  const durs = hecha ? estado.sesion.estadoAv.duraciones : Ent.bloquesConDuracion(estado.sesion.estadoAv, estado.sesion.plan, medidas()).map((b) => b.duracion);
  let tS = Math.round(durs.slice(0, s.n).reduce((a, x) => a + x, 0));
  let tuyas = estado.sesion.muestras;
  if (!hecha) {
    // Hasta la salida se supone que sigues a tu velocidad de los últimos 10 s.
    tS = Math.max(tS, t + 1);
    const m = estado.sesion.muestras;
    const v = m.length > 10 ? (m.at(-1).dist - m.at(-11).dist) / 10 : 0;
    tuyas = [...m, { t: tS, dist: estado.sesion.dist + v * (tS - t), spm: actual.spm, w: actual.watts }];
  }
  s.tS = tS;
  for (const r of [...estado.sesion.rivales, ...estado.sesion.referencias]) r.muestras = F.alinearSalida(r.original, tuyas, tS, r.salidaPropia ?? tS);
  if (hecha) {
    s.hecha = true;
    estado.sesion.lados = null;
    if (t > 0) {
      eventoCarrera('salida', '¡Salida! Empieza la carrera');
      hablar('Fin del calentamiento. ¡Salida! Empieza la carrera. Salida fuerte 20 paladas y luego a tu ritmo', { urgente: true });
    }
  }
}

// Avisos que la carrera dibuja un momento: adelantos, te pasan y ventajas.
function eventoCarrera(tipo, texto, detalle = '') {
  const lista = estado.sesion.eventosCarrera;
  lista.push({ id: (lista.at(-1)?.id || 0) + 1, tipo, texto, detalle });
  if (lista.length > 8) lista.shift();
}

// Adelantos: cuando cambia quién va delante entre tú y cada fantasma (con 1 m de margen para no parpadear).
function vigilarAdelantos(t) {
  const miDist = estado.sesion.dist + V.metrosVentaja(estado.sesion.ventaja);
  const lados = estado.sesion.rivales.map((r, i) => {
    const d = miDist - E.distanciaEn(r.muestras, t);
    const antes = estado.sesion.lados?.[i] ?? 0;
    return d > 1 ? 1 : d < -1 ? -1 : antes;
  });
  if (estado.sesion.lados && t > 5) {
    lados.forEach((l, i) => {
      const antes = estado.sesion.lados[i];
      if (!antes || l === antes) return;
      const nombre = corto(estado.sesion.rivales[i].nombre);
      if (l > 0) {
        eventoCarrera('adelanto', `¡Adelantaste a ${nombre}!`);
        V.alAdelantar(estado.sesion.ventaja, t);
        hablar(`Adelantaste a ${nombre}`, { clave: `adelanto-${i}`, cadaSeg: 8 });
        vibrar([60, 40, 60]);
      } else {
        eventoCarrera('te-pasan', `${nombre} te adelantó`);
        hablar(`${nombre} te adelantó`, { clave: `adelanto-${i}`, cadaSeg: 8 });
        vibrar(250);
      }
    });
  }
  estado.sesion.lados = lados;
}

// Sprint final: en los últimos 250 m suena un tambor cada segundo (doble en los últimos 100 m).
function tamborSprint() {
  const meta = estado.entrenamientoActivo?.objetivo?.metrica === 'distancia' ? estado.entrenamientoActivo.objetivo.valor : null;
  if (!meta || estado.sesion.tiempoMeta != null) return;
  const falta = meta - estado.sesion.dist;
  if (falta > 250 || falta <= 0) return;
  if (!estado.sesion.sprintAvisado) {
    estado.sesion.sprintAvisado = true;
    hablar('¡Sprint final! Últimos 250 metros', { urgente: true });
    vibrar([80, 60, 80, 60, 80]);
  }
  pitido(98, 0.14);
  if (falta <= 100) setTimeout(() => pitido(98, 0.12), 480);
}

export const corto = (nombre = '') => nombre.replace(/^Fantasma /, '').split(' (')[0];

const ANIMOS = ['¡Buen ritmo, sigue así!', 'Vas muy bien, mantén la técnica', 'Piernas, espalda, brazos. Así se rema', '¡Fuerte! Cada palada cuenta', 'Respira y mantén el ritmo'];

// Parciales de 500 m (con aviso por voz), ánimo de vez en cuando y aviso si el ritmo se cae.
function coachRitmo(t) {
  const n = Math.floor(estado.sesion.dist / 500);
  if (n > estado.sesion.n500) {
    const seg = t - estado.sesion.t500;
    estado.sesion.parcial = { seg, n };
    estado.sesion.n500 = n;
    estado.sesion.t500 = t;
    const cada = G.parcialCada(estado.sesion.guion, bloqueEnCurso());
    if (cada && (n * 500) % cada === 0) hablar(`${n * 500} metros. Parcial ${splitHablado(seg)}${posicionHablada()}`, { clave: 'parcial', cadaSeg: 20 });
  }
  if (t % 240 === 0 && estado.sesion.fueraSeguidos === 0) {
    const animo = animoDelEntrenador();
    if (animo) hablar(animo, { clave: 'animo', cadaSeg: 200, capa: G.CAPA.animo });
  }
  avisosDeJuego(t);
  // En intervalos los descansos bajan el ritmo a propósito: ahí manda el aviso de rango.
  if (estado.sesion.plan || t < 60 || estado.sesion.dist < 100) return;
  const ref = estado.sesion.ritmo || (t * 500) / estado.sesion.dist;
  const v = velocidadReciente();
  const reciente = v > 0 ? 500 / v : Infinity;
  estado.sesion.lento = reciente > ref + (estado.sesion.ritmo ? 3 : 6) ? estado.sesion.lento + 1 : 0;
  if (estado.sesion.lento >= 20) {
    estado.sesion.lento = 0;
    const texto = G.ritmoCae(estado.sesion.guion, estado.sesion.ritmo ? splitHablado(estado.sesion.ritmo) : '');
    if (texto) hablar(texto, { clave: 'lento', cadaSeg: 60, capa: G.CAPA.correccion });
  }
}

// Bloque del plan que se está remando, o null.
function bloqueEnCurso() {
  const info = estado.sesion?.info;
  return info && !info.terminado ? info.bloque : null;
}

// Últimos 10 s de un esfuerzo duro: la voz solo cuenta (las capas 2 y 3 callan).
function silencioDuro() {
  const s = estado.sesion;
  const b = bloqueEnCurso();
  return !!(s && b && G.DUROS.has(s.guion) && G.esTrabajo(b) && s.info.restaSeg > 0 && s.info.restaSeg <= 10);
}

// Con varios fantasmas, el parcial también dice el puesto («Vas 2º de 4. 12 metros atrás de…»).
function posicionHablada() {
  const s = estado.sesion;
  if (s.rivales.length < 2 || (s.salida && !s.salida.hecha)) return '';
  return `. ${carreraActual().texto.replace(/ · /g, '. ').replace(/(\d+) m /g, '$1 metros ')}`;
}

// Ánimo del entrenador cada 4 min: consejos del tipo de sesión; en las sesiones suaves, nunca «¡fuerte!».
// En VO2, sprints y pruebas no hay ánimos durante el trabajo.
function animoDelEntrenador() {
  const s = estado.sesion;
  if (G.SIN_ANIMO.has(s.guion)) return '';
  const k = s.nAnimo++;
  const suave = G.SUAVES.has(s.guion);
  // Con clase, sus frases (de calma o de esfuerzo según el momento) sustituyen a los ánimos de siempre
  // y, en los tipos suaves, se alternan con los consejos.
  const deClase = s.claseVoz ? VJ.fraseClase(s.claseVoz, VJ.momentoAnimo(suave, bloqueEnCurso()), s.frasesUsadas) : '';
  const consejo = G.consejo(s.guion, Math.floor(k / (suave && !deClase ? 1 : 2)));
  if (suave) return deClase && k % 2 === 1 ? deClase : consejo || deClase;
  return k % 2 === 0 && consejo ? consejo : deClase || ANIMOS[Math.floor(k / 2) % ANIMOS.length];
}

// ---------- Capa de juego de la voz (voz-juego.js) ----------

// Al terminar: misiones, jefe, hazaña de clase y XP de la sesión, detrás de «Sesión terminada».
function decirResumenJuego(registro, previas) {
  try {
    const per = leerPersonaje();
    const antes = H.estadoJuegoDe(previas, { ftp: ftp(), per });
    const despues = J.estadoJuego([...previas.filter((x) => x.fecha !== registro.fecha), registro], { ftp: ftp(), per });
    const texto = VJ.resumenJuego(antes, despues, registro.fecha, J.claseDe(per.clase)?.clave || null);
    if (texto) hablar(texto);
  } catch (e) {
    agregarLog(`resumen de juego por voz: ${e?.message || e}`);
  }
}

// Aviso de juego en la capa 3, con sus reglas (uno cada 5 min, nunca en recuperación, pruebas ni trabajo de VO2
// o sprints). inicio: el aviso de arranque, que se dice aunque la sesión sea una prueba (es antes del esfuerzo).
function hablarJuego(texto, t, { inicio = false } = {}) {
  const s = estado.sesion;
  if (!texto || !s) return false;
  if (!inicio && !VJ.juegoPuede(s.guion, { bloque: bloqueEnCurso(), t, ultimo: s.ultimoJuego })) return false;
  const dicho = hablar(texto, { clave: 'juego', capa: G.CAPA.animo });
  if (dicho) s.ultimoJuego = t;
  return dicho;
}

// Al empezar: jefe o racha, y los hitos de la hazaña de clase que esta sesión puede cruzar remando.
async function prepararVozJuego(s) {
  try {
    const { h } = await estadoHeroe();
    if (estado.sesion !== s) return;
    const ent = estado.entrenamientoActivo;
    const cap = h.capitulo;
    const jefe = cap && cap.listo && ent && cap.preparar && ent.id === cap.preparar ? cap.jefe.nombre : '';
    s.hitosVoz = s.claseVoz ? VJ.hitosEnVivo(h.hazanas.find((x) => x.id === `clase-${s.claseVoz}`)) : [];
    s.hazanaVoz = s.claseVoz ? h.hazanas.find((x) => x.id === `clase-${s.claseVoz}`)?.nombre : '';
    s.misionPlanVoz = !!delProgramaHoy(s) && h.diarias.some((m) => m.id === 'plan' && !m.hecha);
    const aviso = VJ.avisoInicio({ racha: h.contexto?.racha || 0, jefe });
    // Se dice en cuanto calle la frase de arranque (la capa 3 no se pone en cola): lo intenta avisosDeJuego().
    s.avisoInicioVoz = aviso;
  } catch (e) {
    agregarLog(`voz de juego: ${e?.message || e}`);
  }
}

// Durante: hito de la hazaña de clase (paladas o km) y la misión del plan al 75 %.
function avisosDeJuego(t) {
  const s = estado.sesion;
  if (s.avisoInicioVoz) {
    if (hablarJuego(s.avisoInicioVoz, t, { inicio: true }) || t > 120) s.avisoInicioVoz = '';
    return;
  }
  const hito = s.hitosVoz?.[0];
  if (hito && (hito.medida === 'km' ? s.dist : s.paladas) >= hito.faltan) {
    // Si se cruzan dos hitos sin poder decirlo, se dice el último.
    while (s.hitosVoz[1] && (hito.medida === 'km' ? s.dist : s.paladas) >= s.hitosVoz[1].faltan) s.hitosVoz.shift();
    const pct = s.hitosVoz[0].pct;
    // El 100 % se dice aunque no toque (una vez en la vida); los demás esperan su turno.
    if (hablarJuego(VJ.textoHito(s.hazanaVoz, pct), t, { inicio: pct >= 100 })) s.hitosVoz.shift();
    return;
  }
  if (s.misionPlanVoz) {
    const total = (s.bloques || []).reduce((a, b) => a + (b.duracion || 0), 0);
    const avance = s.plan ? (total ? t / total : 0) : estado.entrenamientoActivo?.objetivo ? progresoActual(t).hecho / progresoActual(t).meta : 0;
    if (avance >= 0.75 && hablarJuego(VJ.MISION_PLAN_75, t)) s.misionPlanVoz = false;
  }
}

// «Atento al entrenador»: tras una corrección de rango, volver al rango en menos de 20 s cuenta como respondida.
function seguirCorreccion(t, rango) {
  const s = estado.sesion;
  if (s.correccionEn == null) return;
  if (t - s.correccionEn > 20) s.correccionEn = null;
  else if (rango === 'dentro') { s.atento++; s.correccionEn = null; }
}

// Último parcial de 500 m: verde si va al ritmo objetivo (o mejor que tu promedio), rojo si no.
export function textoParcial() {
  const p = estado.sesion?.parcial;
  if (!p) return { texto: estado.sesion?.ritmo ? `Objetivo ${formatoSplit(estado.sesion.ritmo)}` : '', corto: estado.sesion?.ritmo ? `Obj. ${formatoSplit(estado.sesion.ritmo)}` : '', clase: '' };
  const ref = estado.sesion.ritmo || (estado.sesion.t500 * 500) / Math.max(1, p.n * 500);
  const clase = estado.sesion.ritmo ? (p.seg <= ref ? 'ok' : 'mal') : (p.seg <= ref + 0.5 ? 'ok' : 'mal');
  return { texto: `Último 500 m ${formatoSplit(p.seg)}`, corto: `Últ. 500 ${formatoSplit(p.seg)}`, clase };
}

function avanceObjetivo(t) {
  const p = progresoActual(t);
  if (p.completo && estado.sesion.tiempoMeta == null) {
    const previo = estado.sesion.avance.at(-2)?.[1] ?? 0;
    estado.sesion.tiempoMeta = E.instanteMeta(t, previo, estado.sesion.avance.at(-1)?.[1] ?? p.hecho, p.meta);
    pitido(1046, 0.4);
    vibrar([200, 100, 200, 100, 400]);
    hablar(`¡Meta cumplida! en ${tiempoHablado(t)}. ¿Sigues o terminas?`, { urgente: true });
    mostrarFin();
  } else if (!p.completo && p.fraccion >= 0.5 && !estado.sesion.mitadAvisada) {
    estado.sesion.mitadAvisada = true;
    const ritmo = t > 0 ? p.hecho / t : 0;
    const queda = ritmo > 0 ? Math.round(p.falta / ritmo / 60) : 0;
    hablar(`Vas a la mitad. Faltan ${Math.ceil(p.falta)} ${Ent.METRICAS_OBJETIVO[p.metrica].unidad === 'm' ? 'metros' : Ent.METRICAS_OBJETIVO[p.metrica].unidad}${queda >= 1 ? `. A este ritmo, unos ${queda === 1 ? '1 minuto' : `${queda} minutos`} más` : ''}`);
  }
}

// Al completar el entrenamiento se pregunta si seguir remando o terminar y guardar.
function mostrarFin() {
  const partes = [estado.sesion.tiempoMeta != null ? formatoMeta(estado.sesion.tiempoMeta) : formatoTiempo(estado.sesion.t), `${miles(estado.sesion.dist)} m`];
  if (estado.sesion.rival) partes.push(carreraActual().texto.replace(/^Vas /, ''));
  $('#fin-texto').textContent = partes.join(' · ');
  $('#fin-dialogo').hidden = false;
  $('#fin-terminar').focus();
  if (estado.sesion.rival && carreraActual().tono === 'adelante') confeti();
}
export function cerrarFin() { $('#fin-dialogo').hidden = true; }

export function progresoActual(t) {
  return Ent.progresoObjetivo(estado.entrenamientoActivo, { distancia: estado.sesion.dist, kcal: estado.sesion.kcal, paladas: estado.sesion.paladas }, t);
}

const splitHablado = (s) => `${Math.floor(s / 60)} ${String(s % 60).padStart(2, '0')}`;
function metaHablada(b) {
  const meta = metaHabladaSola(b);
  return b.spmMeta ? `${meta}, a ${b.spmMeta[0]} a ${b.spmMeta[1]} golpes por minuto` : meta;
}
function metaHabladaSola(b) {
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
  const info = Ent.avanzar(estado.sesion.estadoAv, estado.sesion.plan, medidas());
  estado.sesion.info = info;
  estado.sesion.bloques = paraPerfil(Ent.bloquesConDuracion(estado.sesion.estadoAv, estado.sesion.plan, medidas()));
  if (info.terminado) {
    if (estado.sesion.bloqueAnterior !== estado.sesion.plan.length) {
      cerrarSerie(t);
      estado.sesion.bloqueAnterior = estado.sesion.plan.length;
      estado.sesion.tiempoMeta = info.desde;
      pitido(1046, 0.4);
      vibrar([200, 100, 200]);
      const pct = estado.sesion.segConMeta ? Math.round((100 * estado.sesion.segEnRango) / estado.sesion.segConMeta) : null;
      const guion = estado.sesion.guion;
      hablar(`${G.cierre(guion, { pctRango: pct, series: estado.sesion.series, cadenciaPct: guion === 'tecnica' ? pct : null })}. ¿Sigues o terminas?`, { urgente: true });
      mostrarFin();
    }
    return;
  }
  const { i, bloque: b, resta } = info;
  const fin = Ent.finDe(b);
  if (i !== estado.sesion.bloqueAnterior) {
    if (estado.sesion.bloqueAnterior !== -1) { pitido(988, 0.25); vibrar(250); }
    const anterior = estado.sesion.bloqueAnterior;
    cerrarSerie(t);
    estado.sesion.bloqueAnterior = i;
    estado.sesion.fueraSeguidos = 0;
    estado.sesion.inicioBloque = { t: info.desde, dist: estado.sesion.dist, con: estado.sesion.segConMeta, dentro: estado.sesion.segEnRango, picoW: 0 };
    anunciarBloque(i, b, anterior);
    if (b.nivel && ajustes.si('resAuto', false)) {
      agregarLog(remadora.fijarResistencia(b.nivel) ? `resistencia automática: nivel ${b.nivel}` : `resistencia automática: nivel ${b.nivel} no válido o sin conexión`);
    }
  }
  if (estado.sesion.inicioBloque) estado.sesion.inicioBloque.picoW = Math.max(estado.sesion.inicioBloque.picoW, actual.watts);
  avisosDelBloque(i, b, fin, resta);
  if (fin === 'tiempo' && resta <= 3 && resta > 0) {
    pitido(660, 0.08);
    if (b.duracion > 10) hablar(String(resta), { urgente: true });
  }
  const cerca = fin === 'distancia' ? 100 : fin === 'paladas' ? 10 : 0;
  if (cerca && resta <= cerca && Ent.cantidadDe(b) > cerca * 1.5 && estado.sesion.avisoCerca !== i) {
    estado.sesion.avisoCerca = i;
    pitido(660, 0.1);
    hablar(fin === 'distancia' ? 'Últimos 100 metros' : 'Últimas 10 paladas', { urgente: true });
  }
  const rango = Ent.enRango(b, actual.watts, actual.spm, ftp(), actual.split, actual.fc);
  // Solo los bloques de trabajo y pasados sus primeros segundos cuentan para el % en rango.
  const cuenta = Ent.contarRango({ con: estado.sesion.segConMeta, dentro: estado.sesion.segEnRango, bajo: estado.sesion.segBajo || 0, alto: estado.sesion.segAlto || 0 }, b, rango, t - info.desde);
  Object.assign(estado.sesion, { segConMeta: cuenta.con, segEnRango: cuenta.dentro, segBajo: cuenta.bajo, segAlto: cuenta.alto });
  estado.sesion.fueraSeguidos = rango && rango !== 'dentro' ? estado.sesion.fueraSeguidos + 1 : 0;
  const s0 = estado.sesion;
  seguirCorreccion(t, rango);
  if (estado.sesion.fueraSeguidos >= 5 && info.restaSeg > 4) {
    const spm = b.metrica === 'spm';
    const texto = G.correccion(estado.sesion.guion, {
      rango, potencia: !!Ent.rangoWatts(b, ftp()), pulso: b.metrica === 'fc' || b.metrica === 'fcpct',
      cadencia: spm ? actual.spm : 0, spmMin: spm ? b.min : 0, spmMax: spm ? b.max : 0,
      serie: G.serieDe(estado.sesion.plan, i, estado.sesion.guion), enSerieSeg: t - info.desde, fueraSeg: estado.sesion.fueraSeguidos, trabajo: G.esTrabajo(b),
    });
    // La misma corrección, como mucho una vez por minuto (y cualquier corrección, una cada 20 s).
    if (texto && hablar(texto, { clave: `fuera:${texto.replace(/\d+/g, '#')}`, cadaSeg: 60, capa: G.CAPA.correccion }) && G.esTrabajo(b)) s0.correccionEn = t;
  }
}

// Al empezar un bloque: qué toca (nombre, meta y cantidad), la serie y, tras una serie dura, cómo fue.
function anunciarBloque(i, b, anterior) {
  const s = estado.sesion;
  const serie = G.serieDe(s.plan, i, s.guion);
  const nombre = (b.nombre || 'Intervalo').replace(/\s*\d+\s*\/\s*\d+\s*/g, ' ').trim();
  const extra = serie ? `. ${G.inicioSerie(s.guion, serie)}` : '';
  const consejo = b.consejo || (s.guion === 'tecnica' && G.esTrabajo(b) ? G.focoTecnica(serie ? serie.n - 1 : i) : '');
  hablar(`${nombre}${extra}. ${metaHablada(b)}, ${cantidadHablada(b)}${consejo ? `. ${consejo}` : ''}`, { urgente: true });
  const previa = anterior >= 0 ? s.plan[anterior] : null;
  const hecha = s.series.at(-1);
  if (previa && G.esTrabajo(previa) && !G.esTrabajo(b) && hecha) {
    const texto = G.trasSerie(s.guion, { pct: hecha.pct, split: hecha.split ? splitHablado(hecha.split) : '', picoW: hecha.picoW });
    if (texto) hablar(texto, { clave: 'tras-serie', capa: G.CAPA.correccion });
  }
}

// Guarda cómo fue el bloque de trabajo que acaba (en rango, pico de watts y split medio) para el cierre.
function cerrarSerie(t) {
  const s = estado.sesion;
  const ib = s.inicioBloque;
  const b = s.bloqueAnterior >= 0 ? s.plan?.[s.bloqueAnterior] : null;
  s.inicioBloque = null;
  if (!ib || !G.esTrabajo(b)) return;
  const con = s.segConMeta - ib.con;
  const metros = s.dist - ib.dist;
  const dur = t - ib.t;
  s.series.push({ pct: con > 0 ? Math.round((100 * (s.segEnRango - ib.dentro)) / con) : null, picoW: ib.picoW, split: metros > 0 && dur > 0 ? Math.round((500 * dur) / metros) : 0 });
  // Sprints: si el pico cae más de un 15 % frente al mejor en dos series seguidas, se avisa una vez.
  if (s.guion === 'sprint' && !s.avisos.caePotencia && s.series.length >= 3) {
    const mejor = Math.max(...s.series.map((x) => x.picoW || 0));
    if (mejor > 0 && s.series.slice(-2).every((x) => x.picoW < mejor * 0.85)) {
      s.avisos.caePotencia = true;
      hablar(G.CAE_POTENCIA, { clave: 'cae-potencia', capa: G.CAPA.correccion });
    }
  }
}

// Avisos que dependen de cuánto falta del bloque: mitad de serie, prepárate, tiempo que queda y el final de una prueba.
function avisosDelBloque(i, b, fin, resta) {
  const s = estado.sesion;
  if (fin !== 'tiempo' || !(b.duracion > 0) || resta <= 0) return;
  const dicho = (k) => { const clave = `${k}-${i}`; if (s.avisos[clave]) return true; s.avisos[clave] = true; return false; };
  const trabajo = G.esTrabajo(b);
  if (trabajo && b.duracion >= 90 && resta === Math.round(b.duracion / 2)) {
    const mitad = G.mitadSerie(s.guion);
    if (mitad && !dicho('mitad')) hablar(mitad, { capa: G.CAPA.info });
  }
  if (trabajo && s.guion === 'fondo' && b.duracion >= 1200 && resta === Math.round(b.duracion / 4) && !dicho('deriva')) {
    hablar(G.DERIVA_FONDO, { clave: 'deriva', capa: G.CAPA.correccion });
  }
  if (trabajo && s.guion === 'prueba' && b.duracion >= 600 && resta === 180 && !dicho('vaciate')) hablar(G.VACIATE, { capa: G.CAPA.info });
  const cada = G.restanteCada(s.guion);
  if (trabajo && cada && resta % cada === 0 && resta < b.duracion && resta > 180 && !dicho(`resta${resta}`)) hablar(`Quedan ${tiempoHablado(resta)}`, { capa: G.CAPA.info });
  // Fin de un descanso antes de una serie: a 10 s, «Prepárate».
  if (!trabajo && b.duracion >= 30 && resta === 10 && G.esTrabajo(s.plan[i + 1]) && !dicho('prep')) hablar(G.PREPARATE, { capa: G.CAPA.info });
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarSesion2() {

  // ---------- Utilidades ----------
  // El bloqueo de pantalla se pierde al cambiar de app; se recupera al volver si hay sesión.
  document.addEventListener('visibilitychange', async () => {
    if (estado.sesion && document.visibilityState === 'visible') {
      try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
    }
  });
}
