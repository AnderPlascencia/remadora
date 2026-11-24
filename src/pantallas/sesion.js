// Conexión con la remadora y la banda, ciclo de la sesión (grabar, pausa, tic y terminar). Guardar y recuperar la
// sesión está en sesion-guardar.js; la voz del entrenador y los avisos de la carrera, en sesion-voz.js.
import { BandaCardiaca, Remadora } from '../remadora.js';
import { kcalPorSegundo } from '../protocolo.js';
import * as F from '../fantasma.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import { fijarSilencio, hablar } from '../voz.js';
import * as G from '../guion-voz.js';
import * as VJ from '../voz-juego.js';
import * as P from '../programa.js';
import * as J from '../juego.js';
import * as V from '../ventajas.js';
import * as C from '../consejos.js';
import * as Cap from '../capacidades.js';
import * as Pf from '../perfil.js';
import { crearReloj } from '../reloj.js';
import { $, ajustes, escaparHtml, fcMaxima, fcRef, ftp, ico, perfil, pitido, previoHoy, toast, VIBRA, vibrar } from '../ui.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { repararSesiones, ritmoObjetivo, selVariante } from './ajustes.js';
import { crearReferencias, crearRivales, estimarFtp, hayCarrera, pintarChips } from './preparar.js';
import {
  abrirModoRemo, carreraEnt, carreraRemo, cerrarModoRemo, dibujarVivo, duracionCarrera, modoEnt, pintar, pintarAlLlegar, pintarModoEnt, retratoPropio, textoAntesDeEmpezar, vigilarTipoSesion, vistaPrevia,
} from './vivo.js';
import { agregarLog } from '../registro.js';
import { datoRecibido, fijarFuenteBle, iniciarBateria, numerosPintados, reiniciarDiagnostico } from '../diagnostico.js';
import { leyendaPerfil, obtenerEnt } from './planes.js';
import { pintarConstancia, pintarCurva, pintarForma, pintarGasto, pintarMotor, pintarTendencia } from './progreso.js';
import { estadoHeroe, inventario, leerPersonaje, nombreAtributo } from './heroe.js';
import { contextoXp, ftpDelPlan } from './programa.js';
import { bonoEquipo } from '../coleccion-bote.js';
import * as Hab from '../habito.js';
import { equipoEnUso } from '../carrera.js';
import { permisoIntensidad, FRASE_SIN_INTENSIDAD } from '../intensidad.js';
import {
  borrarSesionEnCurso, estadoReanudado, guardarSesionEnCurso, guardarSesionTerminada, leerSesionEnCurso, ofrecerRecuperar, yaGuardada,
} from './sesion-guardar.js';
import {
  avanceBloque, avanceObjetivo, cerrarFin, coachRitmo, corto, eventoCarrera, hablarJuego, prepararVozJuego, silencioDuro, tamborSprint, vigilarAdelantos,
} from './sesion-voz.js';
// Lo que otras pantallas importan de aquí desde antes de partir el archivo.
export { ofrecerRecuperar } from './sesion-guardar.js';
export { cerrarFin, corto, progresoActual, textoParcial } from './sesion-voz.js';

// ---------- Conexión y estado en vivo ----------
export const remadora = new Remadora();
const banda = new BandaCardiaca();
export const actual = { watts: 0, spm: 0, split: 0, distancia: null, nivel: null, fc: 0 };
export const vivo = { watts: [], spm: [] };
let ultimoDato = 0;
// Tramos sin datos de la remadora (más de 3 s): [desde, hasta]. Al ponerse al día tras una suspensión, los segundos
// que caen en un tramo así cuentan sin remar aunque el dato de ahora sea fresco (etapa 22: si no, el primer dato
// al despertar «remaba» los 10 minutos que el teléfono estuvo dormido).
const huecos = [];
const SIN_DATOS_MS = 3000;

// Al arrancar la app (en orden, desde app.js).
export function arrancarSesion1() {

  if (!Remadora.soportado()) {
    $('#aviso-bt').hidden = false;
    $('#btn-conectar').disabled = true;
    $('#btn-banda').disabled = true;
  }

  remadora.addEventListener('log', (e) => agregarLog(e.detail));
  banda.addEventListener('log', (e) => agregarLog(e.detail));
  // Con una sesión en marcha, la remadora y la banda reconectan sin rendirse.
  remadora.debeMantener = () => !!estado.sesion;
  banda.debeMantener = () => !!estado.sesion;
  fijarFuenteBle(() => remadora.estadisticas);
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
      if (texto === 'La consola no responde') hablar('La consola no responde, reconectando', { clave: 'reconectando', cadaSeg: 30 });
      if (texto.startsWith('Reconectando')) hablar('Conexión perdida, reconectando', { clave: 'reconectando', cadaSeg: 30 });
      if (texto === 'Conectada' && estado.sesion.perdida) { hablar('Reconectada'); toast('Reconectada: la sesión sigue', 3000, 'seguridad'); }
      estado.sesion.perdida = !conectada;
      if (texto === 'Desconectada') toast('Sin conexión. La sesión sigue en pausa: reconecta o termínala.', 3000, 'seguridad');
    }
    actualizarBotones();
    if (!estado.sesion) vistaPrevia();
  });
  remadora.addEventListener('datos', (e) => {
    const d = e.detail;
    const ahora = Date.now();
    if (ultimoDato && ahora - ultimoDato > SIN_DATOS_MS) {
      huecos.push([ultimoDato + SIN_DATOS_MS, ahora]);
      if (huecos.length > 20) huecos.shift();
    }
    ultimoDato = ahora;
    datoRecibido();
    if (d.tipo === 'remada') { actual.spm = d.spm; actual.split = d.split; }
    if (d.tipo === 'metricas') {
      actual.watts = d.watts; actual.distancia = d.distancia; actual.nivel = d.resistencia;
      // En modo demo, sin banda conectada, simula el pulso para poder probar las zonas.
      if (remadora.demoTimer && !bandaConectada) actual.fc = Math.round(actual.fc ? actual.fc + (Math.min(190, 95 + d.watts / 3) - actual.fc) * 0.05 : 100);
    }
    // Los números grandes se pintan en el siguiente cuadro, no en el siguiente tic (hasta 1 s antes).
    pintarAlLlegar();
    empezarAlRemar(d);
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
      if (d.dataset.seccion === 'constancia') pintarConstancia();
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
  // Etapa 16: empezar sin salir del modo remo (el teléfono ya está en el soporte).
  $('#mr-empezar').addEventListener('click', async () => {
    if (estado.sesion || $('#btn-grabar').disabled) return;
    if (!(await asegurarConexion())) return;
    iniciarSesion();
  });
  $('#in-empezar-palada').addEventListener('change', (e) => { ajustes.escribir('empezarPalada', e.target.checked ? '1' : '0'); actualizarBotones(); });
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
    Hab.anotar('sesionDescartada');
    toast('Sesión descartada');
  });
  setInterval(tic, 500);
  $('#fin-seguir').addEventListener('click', () => { cerrarFin(); hablar('Seguimos'); });
  $('#fin-terminar').addEventListener('click', () => { cerrarFin(); if (estado.sesion) detenerSesion(); });
}
let bandaConectada = false;
let ultimoFc = 0;
// Pulso recibido en los últimos 5 s (para la recuperación del pulso al terminar).
export const fcFresca = () => Date.now() - ultimoFc < 5000;
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
  // Antes de la sesión, el modo remo enseña Empezar (y la opción de empezar remando) en vez de Terminar y Pausar.
  $('#mr-empezar').hidden = !!estado.sesion;
  $('#mr-empezar').disabled = g.disabled;
  $('#mr-empezar').querySelector('span').textContent = remadora.conectada ? 'Empezar' : 'Conectar y empezar';
  $('#mr-terminar').hidden = !estado.sesion;
  $('#mr-pausa').hidden = !estado.sesion;
  $('#mr-auto').hidden = !!estado.sesion;
  $('#in-empezar-palada').checked = ajustes.si('empezarPalada', false);
  if (!estado.sesion && !$('#modo-remo').hidden) $('#mr-meta-texto').textContent = textoAntesDeEmpezar();
  $('#sel-entrenamiento').disabled = !!estado.sesion;
  // Antes de remar se muestra la tarjeta Preparar; durante la sesión, solo una línea de resumen.
  $('#preparar').hidden = !!estado.sesion;
  // El primer día (hasta la primera sesión), sin Opciones de carrera: solo «Hoy toca» y Empezar.
  $('#opciones-carrera').hidden = estado.primerDia;
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
// «Empezar al dar la primera palada» (etapa 16): con el modo remo abierto y la opción encendida, la primera
// potencia de la consola empieza la sesión. Nunca con otra capa encima ni sin entrenamiento elegido.
let arrancandoSola = false;
function empezarAlRemar(d) {
  if (estado.sesion || arrancandoSola || !(d.tipo === 'metricas' && d.watts > 0) || !ajustes.si('empezarPalada', false)) return;
  if ($('#modo-remo').hidden || $('#btn-grabar').disabled || [...document.querySelectorAll('.fin-fondo, .hoja-fondo')].some((x) => !x.hidden)) return;
  arrancandoSola = true;
  vibrar(VIBRA.gesto);
  Promise.resolve(iniciarSesion()).finally(() => { arrancandoSola = false; });
}

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
// Dos pestañas (etapa 22): mientras remas, esta pestaña tiene el candado «remadora-sesion». Otra pestaña con la app
// abierta ve la copia de la sesión en curso pero no la ofrece para guardar ni descartar, ni empieza otra encima.
const CANDADO = 'remadora-sesion';
let candado = null; // { soltar, suelto }
function tomarCandado() {
  if (candado || !navigator.locks?.request) return;
  const c = { soltar: null, suelto: false };
  candado = c;
  navigator.locks.request(CANDADO, () => (c.suelto ? undefined : new Promise((ok) => { c.soltar = ok; }))).catch(() => {});
}
function soltarCandado() {
  if (!candado) return;
  candado.suelto = true;
  candado.soltar?.();
  candado = null;
}
export async function sesionEnOtraPestana() {
  if (candado || !navigator.locks?.query) return false;
  try { return (await navigator.locks.query()).held.some((l) => l.name === CANDADO); } catch { return false; }
}

async function iniciarSesion(reanudar = null) {
  if (await sesionEnOtraPestana()) { toast('Ya estás remando en otra pestaña de la app: termina ahí o ciérrala'); return; }
  estado.primerDia = false;
  document.querySelectorAll('.consejo').forEach((x) => x.remove());
  estado.entrenamientoActivo = reanudar ? reanudar.ent : await obtenerEnt($('#sel-entrenamiento').value);
  const intervalos = estado.entrenamientoActivo && Ent.tipoDe(estado.entrenamientoActivo) === 'intervalos';
  const [calMin, enfMin] = ajustes.leer('guiado', '0-0').split('-').map(Number);
  const plan = reanudar ? reanudar.plan || null
    : intervalos ? Ent.normalizarBloques(Ent.conCalentamientoMinimo(Ent.conCalentamiento(estado.entrenamientoActivo.bloques, calMin, enfMin), P.esDura(estado.entrenamientoActivo)), ftpDelPlan(estado.entrenamientoActivo), fcRef()) : null;
  $('#perfil-vivo').hidden = !plan;
  if (plan) $('#vivo-leyenda').innerHTML = leyendaPerfil(estado.entrenamientoActivo.bloques, true);
  const rivales = reanudar ? [] : await crearRivales(estado.entrenamientoActivo);
  const referencias = reanudar ? [] : await crearReferencias(estado.entrenamientoActivo);
  const rival = rivales[0] || null;
  // Potencia crítica y W′ con lo mejor de los últimos 90 días: alimentan la batería anaeróbica en vivo.
  const recientes = (await H.sinMuestras()).filter((x) => x.fecha > Date.now() - 90 * 864e5);
  // Etapa 17: solo con esfuerzos máximos; con un único esfuerzo largo, la W′ va por defecto (antes salía null o −48 %).
  const pc = E.potenciaCriticaMax(recientes, { peso: perfil().peso });
  // Calentamientos de las últimas sesiones con pulso: para notar si hoy vas más cargado que de costumbre.
  const calentamientos = recientes.filter((x) => x.res?.cal).slice(-15).map((x) => ({ muestras: x.res.cal }));
  // El diagnóstico (latencia, cuadros por segundo, Bluetooth) se cuenta por sesión.
  if (!reanudar) { reiniciarDiagnostico(); iniciarBateria(); remadora.reiniciarEstadisticas(); }
  Hab.anotar('sesionInicio', { reanudada: !!reanudar, ent: estado.entrenamientoActivo?.nombre || null });
  tomarCandado();
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
    versionCorta: estado.entrenamientoActivo?.versionCorta || null,
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

// Una versión nueva de la app que llegó a mitad de la sesión espera instalada (sw.js) hasta que esta termina.
export function activarVersionEnEspera() {
  if (!('serviceWorker' in navigator) || estado.sesion) return;
  navigator.serviceWorker.getRegistration?.().then((r) => r?.waiting?.postMessage({ tipo: 'activar' })).catch(() => {});
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
  soltarCandado();
  estado.entrenamientoActivo = null;
  estado.versionCorta = null; // la versión corta vale para una sesión
  actualizarBotones();
  cerrarModoRemo();
  $('#pausa-aviso').hidden = true;
  $('#rival').hidden = true;
  $('#atr-vivo').hidden = true;
  $('#mr-atr').hidden = true;
  carreraEnt.detener();
  carreraRemo.detener();
  cerrarFin();
  // Mientras se guarda, la vista previa de Entrenar espera: no lee el historial a la vez que el guardado.
  estado.guardando = true;
  vistaPrevia();
  try { await wakeLock?.release(); } catch { /* nada */ }
  wakeLock = null;
  activarVersionEnEspera();
  if (!s || s.muestras.length < 10) { estado.guardando = false; await borrarSesionEnCurso(); if (s) Hab.anotar('sesionCorta', { seg: s.t }); toast('Sesión muy corta: no se guardó'); return; }
  try {
    // Primero la copia con el final de la sesión; se borra solo cuando la sesión quedó guardada.
    await guardarSesionEnCurso(s, ent);
    await guardarSesionTerminada(s, ent);
    Hab.anotar('sesionFin', { seg: s.t, completa: !s.plan || !!s.info?.terminado });
  } finally {
    estado.guardando = false;
  }
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
  const ahora = Date.now();
  const dato = { watts: actual.watts, spm: actual.spm };
  for (let i = 0; i < n; i++) {
    // El momento de este segundo: con varios pendientes, los primeros son de antes.
    const ts = ahora - (n - 1 - i) * 1000;
    if (ahora - ultimoDato > SIN_DATOS_MS) { actual.watts = 0; actual.spm = 0; }
    else if (huecos.some(([a, b]) => ts > a && ts < b)) { actual.watts = 0; actual.spm = 0; }
    else Object.assign(actual, dato);
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
  numerosPintados();
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
  estado.sesion.atr = { opc: { ftp: ftp() || estimarFtp(await H.sinMuestras()) || 150, clase: per.clase || null, ctx: h.contexto }, vistos: {}, ultimoPop: -99 };
}
function actualizarAtrVivo() {
  const a = estado.sesion?.atr;
  if (!a || !estado.sesion.muestras.length) return;
  const pct = estado.sesion.segConMeta ? Math.round((100 * estado.sesion.segEnRango) / estado.sesion.segConMeta) : null;
  const b = estado.sesion.info && !estado.sesion.info.terminado ? estado.sesion.info.bloque : null;
  const rw = b && Ent.rangoWatts(b, ftp());
  const v = C.enVivo(estado.sesion.muestras, {
    ...a.opc, pct, tipo: estado.sesion.tipoPlan ?? null, rango: rw ? { min: Math.round(rw.min), max: Math.round(rw.max) } : null,
    delPlan: !!estado.sesion.xpCtx?.delPlanSemana,
  });
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
  // Día suave del plan remado por encima del rango: el reto es una orden en ámbar («Baja a 84–135 W»).
  $('#atr-reto').classList.toggle('atencion', !!r.aviso);
  $('#mr-atr').classList.toggle('atencion', !!r.aviso);
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
      toast(`${ev.nombre}: +${m} m`, 3000, 'juego');
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
