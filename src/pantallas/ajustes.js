// Pantalla de ajustes: perfil, preferencias, zonas, prueba de nivel, respaldo y reparaciones de datos.
import { VARIANTES } from '../variantes.js';
import { formatoSplit } from '../protocolo.js';
import * as db from '../db.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import { configurarVoz, hablar } from '../voz.js';
import { confeti } from '../efectos.js';
import * as J from '../juego.js';
import * as Pf from '../perfil.js';
import * as R from '../respaldo.js';
import { VERSION } from '../version.js';
import { olvidarTokens } from '../grafica.js';
import { $, COLOR_ZONA, ajustes, color, descargar, escaparHtml, ftp, ico, perfil, toast } from '../ui.js';
import { TEXTO_FUENTE_FC, fcMaxDeHistorial, fcMaxEfectiva } from '../pulso.js';
import { estado } from '../estado.js';
import { irA, vistaActiva } from '../navegacion.js';
import { asistente, estimarFtp, guardarFtp, leerMmss, pintarFtpEstado } from './preparar.js';
import { dibujarVivo, vistaPrevia } from './vivo.js';
import { agregarLog, anotarError } from '../registro.js';
import { remadora } from './sesion.js';
import { llenarSelectorEntrenamientos } from './planes.js';
import { pintarAvisoRespaldo, pintarHistorial } from './progreso.js';
import { guardarPrograma, leerPrograma, pintarHoy, rehacerPlan } from './programa.js';

// ---------- Ajustes ----------
export const selVariante = $('#sel-variante');

// Al arrancar la app (en orden, desde app.js).
export function arrancarAjustes1() {
  for (const [clave, v] of Object.entries(VARIANTES)) selVariante.add(new Option(v.nombre, clave));
  selVariante.value = ajustes.leer('variante', 'generica');
  selVariante.addEventListener('change', () => ajustes.escribir('variante', selVariante.value));
  campoNumero('#in-peso', 'peso', '75', () => { pintarClasificacion(); vistaPrevia(); alCambiarPerfil(); });
  campoNumero('#in-ftp', 'ftp', '', () => { ajustes.escribir('ftpEstimado', '0'); ajustes.escribir('ftpDePerfil', '0'); pintarFtpEstado(); pintarZonas(); pintarClasificacion(); vistaPrevia(); });
  campoNumero('#in-altura', 'altura', '', () => alCambiarPerfil());
  campoNumero('#in-meta-semana', 'metaSemana', '10', () => J.fijarMetaSemana(ajustes.num('metaSemana', 10)));
  // Escribirlo a mano lo fija; borrarlo vuelve al observado o a la edad.
  campoNumero('#in-fcmax', 'fcMax', '', () => {
    ajustes.escribir('fcMaxDeEdad', '0');
    ajustes.escribir('fcMaxFuente', ajustes.num('fcMax', 0) ? 'manual' : '');
    H.sesiones().then(actualizarFcMax);
  });
  campoNumero('#in-fcreposo', 'fcReposo', '');
  campoNumero('#in-edad', 'edad', '', () => { aplicarEdad(); alCambiarPerfil(); });
  campoSelect('#sel-sexo', 'sexo', '', () => { pintarClasificacion(); alCambiarPerfil(); });
  campoSelect('#sel-experiencia', 'experiencia', '', () => alCambiarPerfil());
  campoSelect('#sel-dias-perfil', 'diasSemana', '3', () => { asistente.dias = perfil().dias; alCambiarPerfil(); });
  campoSelect('#sel-minutos', 'minutosSesion', '', () => alCambiarPerfil());
  $('#perfil-usos').addEventListener('click', async (e) => {
    if (!e.target.closest('#btn-plan-perfil')) return;
    const prog = leerPrograma();
    if (prog) { await rehacerPlan(prog, { ajustar: true, dias: perfil().dias, aviso: 'Rehice tu plan con tu perfil' }); pintarPerfil(); }
  });
  interruptor('#in-voz', 'voz', true, (v) => { configurarVoz(v); if (v) hablar('Avisos por voz activados'); });
  interruptor('#in-modo-auto', 'modoAuto', false);
  interruptor('#in-pausa-auto', 'pausaAuto', true);
  interruptor('#in-atr-vivo', 'atrVivo', true);
  interruptor('#in-res-auto', 'resAuto', false);
  interruptor('#in-avanzado', 'avanzado', false, () => {
    aplicarAvanzado();
    pintarClasificacion();
    if (!avanzado() && estado.tendencia === 'tecnica') $('[data-tend="potencia"]').click();
  });
  aplicarAvanzado();
  configurarVoz(ajustes.si('voz', true));
  selVistaRemo.value = ajustes.leer('vistaRemo', 'numeros');
  selVistaRemo.addEventListener('change', () => ajustes.escribir('vistaRemo', selVistaRemo.value));
  selTema.value = ajustes.leer('tema', 'oscuro');
  selTema.addEventListener('change', () => { ajustes.escribir('tema', selTema.value); aplicarTema(); dibujarVivo(); });
  aplicarTema();
  selGuiado.value = ajustes.leer('guiado', '0-0');
  selGuiado.addEventListener('change', () => ajustes.escribir('guiado', selGuiado.value));
  inRitmo.value = ajustes.leer('ritmoObjetivo', '');
  inRitmo.addEventListener('change', () => {
    const v = leerMmss(inRitmo.value);
    inRitmo.value = v ? formatoSplit(v) : '';
    ajustes.escribir('ritmoObjetivo', inRitmo.value);
  });

  // Pantalla de bienvenida: se desvanece sola.
  setTimeout(() => $('#bienvenida')?.remove(), 1700);
}

function campoNumero(sel, clave, defecto, alCambiar) {
  const el = $(sel);
  el.value = ajustes.leer(clave, defecto);
  // Respeta el min y max del campo: un valor fuera de rango no se guarda y el campo vuelve a lo que tenía.
  el.addEventListener('change', () => {
    const texto = el.value.trim();
    const v = Number(texto);
    const min = Number(el.min);
    const max = Number(el.max);
    if (texto === '' ? defecto !== '' : !Number.isFinite(v) || v < min || v > max) {
      el.value = ajustes.leer(clave, defecto);
      const primero = el.closest('label')?.firstChild;
      const nombre = (primero?.firstChild ?? primero)?.textContent.trim() || 'El valor';
      toast(`${nombre}: escribe un número de ${min} a ${max}`);
      return;
    }
    ajustes.escribir(clave, texto === '' ? '' : String(Math.round(v)));
    el.value = ajustes.leer(clave, defecto);
    alCambiar?.();
  });
}
// Pulso máximo: el tuyo si lo escribiste; si no, el más alto de tus sesiones o, mientras no llegues cerca, 220 − edad.
// Las versiones de antes no guardaban la fuente: un pulso que no salió de la edad era tuyo.
export function fuenteFcMax() {
  const f = ajustes.leer('fcMaxFuente', '');
  if (f) return f;
  if (ajustes.si('fcMaxDeEdad', false)) return 'edad';
  return ajustes.num('fcMax', 0) ? 'manual' : '';
}
export function actualizarFcMax(sesiones = []) {
  if (fuenteFcMax() !== 'manual') {
    const r = fcMaxEfectiva({ edad: ajustes.num('edad', 0), observada: fcMaxDeHistorial(sesiones) });
    if (r.fcMax) {
      ajustes.escribir('fcMax', String(r.fcMax));
      ajustes.escribir('fcMaxFuente', r.fuente);
      ajustes.escribir('fcMaxDeEdad', r.fuente === 'edad' ? '1' : '0');
      $('#in-fcmax').value = r.fcMax;
    }
  }
  const f = fuenteFcMax();
  $('#fcmax-fuente').hidden = !f || f === 'manual';
  $('#fcmax-fuente').textContent = f === 'observada' ? 'observado' : 'estimado';
  $('#fcmax-ayuda').textContent = TEXTO_FUENTE_FC[f] || 'Si no lo escribes, la app usa el más alto que alcances en tus sesiones (o, mientras tanto, 220 menos tu edad).';
}
// La edad rellena el pulso máximo (220 − edad) si no lo has puesto a mano ni lo has alcanzado remando.
export function aplicarEdad() {
  if (!ajustes.num('edad', 0) || fuenteFcMax() === 'manual') return;
  H.sesiones().then(actualizarFcMax);
}
function campoSelect(sel, clave, defecto, alCambiar) {
  const el = $(sel);
  el.value = ajustes.leer(clave, defecto);
  el.addEventListener('change', () => { ajustes.escribir(clave, el.value); alCambiar?.(); });
}
// Vuelve a escribir los campos de Ajustes (tras la bienvenida o un respaldo).
export function rellenarPerfil() {
  for (const [sel, clave, def] of [['#in-edad', 'edad', ''], ['#in-peso', 'peso', '75'], ['#in-altura', 'altura', ''], ['#in-ftp', 'ftp', ''], ['#in-fcmax', 'fcMax', ''], ['#in-fcreposo', 'fcReposo', ''],
    ['#sel-sexo', 'sexo', ''], ['#sel-experiencia', 'experiencia', ''], ['#sel-dias-perfil', 'diasSemana', '3'], ['#sel-minutos', 'minutosSesion', '']]) $(sel).value = ajustes.leer(clave, def);
}
function alCambiarPerfil() { pintarPerfil(); ofrecerFtpInicial(); }
// Qué falta del perfil y para qué sirve; si tu plan no coincide con tus días o tu tiempo, ofrece rehacerlo.
export function pintarPerfil() {
  const p = perfil();
  const c = Pf.completitud(p);
  $('#perfil-resumen').textContent = c.faltan.length ? `${c.hechos} de ${c.total} datos` : 'Completo';
  const prog = leerPrograma();
  const distinto = prog?.objetivo && prog.dias?.length && (prog.porSemana !== p.dias || (p.minutos != null && (prog.minutosMax || 0) !== (p.minutos || 0)));
  $('#perfil-usos').innerHTML = (c.faltan.length
    ? `<p class="ayuda">Completa tu perfil para afinar la app:</p><ul class="lista-perfil">${c.faltan.map((u) => `<li>${escaparHtml(u.texto)}</li>`).join('')}</ul>`
    : '<p class="ayuda">Tu perfil se usa para tus calorías, pulso máximo, FTP inicial, puesto en la tripulación y para armar y ajustar tus planes.</p>')
    + (distinto ? `<div class="aviso suave-aviso perfil-plan"><span>Tu plan es de ${prog.porSemana} días${prog.minutosMax ? ` y sesiones de hasta ${prog.minutosMax} min` : ''}. ¿Lo rehago con ${p.dias} ${p.dias === 1 ? 'día' : 'días'}${p.minutos ? ` y hasta ${p.minutos} min` : ''}?</span><button type="button" id="btn-plan-perfil" class="boton chico">Rehacer plan</button></div>` : '');
}
// Sin sesiones ni FTP, el perfil da un FTP de arranque para que el plan y los rivales tengan watts con sentido.
// Queda como estimado y la primera sesión de 10 min o más lo reemplaza, suba o baje.
export async function ofrecerFtpInicial() {
  if (ftp() && !ajustes.si('ftpDePerfil', false)) return;
  if ((await H.sinMuestras()).length) return;
  const v = Pf.ftpInicial(perfil());
  if (!v || v === ftp()) return;
  guardarFtp(v, true);
  ajustes.escribir('ftpDePerfil', '1');
}

function interruptor(sel, clave, defecto, alCambiar) {
  const el = $(sel);
  el.checked = ajustes.si(clave, defecto);
  el.addEventListener('change', () => { ajustes.escribir(clave, el.checked ? '1' : '0'); alCambiar?.(el.checked); });
}
// Datos avanzados: nombres técnicos de zona, carga, W/kg, predicciones y tablas por tramo. Apagado, la app habla en sencillo.
export const avanzado = () => ajustes.si('avanzado', false);
const aplicarAvanzado = () => document.documentElement.toggleAttribute('data-avanzado', avanzado());
export const textoZona = (z) => (avanzado() ? `Z${z.n} ${z.nombre}` : `Zona ${z.n} · ${z.simple}`);
export const selVistaRemo = $('#sel-vista-remo');

// Tema: oscuro (por defecto), claro o alto contraste.
function aplicarTema() {
  const tema = ajustes.leer('tema', 'oscuro');
  if (tema === 'oscuro') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
  olvidarTokens();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color('--fondo') || '#0B1217');
}
const selTema = $('#sel-tema');
const selGuiado = $('#sel-guiado');

// Ritmo objetivo opcional (split /500 m): colorea los parciales y dibuja su línea en la carrera.
const inRitmo = $('#in-ritmo');
export const ritmoObjetivo = () => leerMmss(ajustes.leer('ritmoObjetivo', '')) || 0;

// Clasificación de tripulación por FTP (Grumete … Capitán): en la Ficha y en Ajustes, con aviso al subir.
export function pintarClasificacion(sesiones = null) {
  // Sin FTP escrito se estima con el historial, igual que en la Ficha, para que Ajustes no diga otra cosa.
  if (!sesiones && !ftp()) { H.sesiones().then((s) => pintarClasificacion(s)); return; }
  const peso = ajustes.num('peso', 75);
  const w = ftp() || (sesiones ? estimarFtp(sesiones) : 0);
  const caja = $('#clasificacion-ftp');
  if (!w) {
    caja.innerHTML = '<p class="ayuda">Tu puesto en la tripulación (de Grumete a Capitán) sale de tu FTP. Se calcula solo después de unas sesiones, o escríbelo arriba si lo conoces.</p><button type="button" class="boton chico" data-trip>Ver los 5 puestos</button>';
    $('#heroe-aguas').hidden = true;
    estado.escalaTrip = J.escalaTripulacion(0, peso, Pf.factorClasificacion(ajustes.leer('sexo', '')));
    estado.escalaTrip.sinFtp = true;
    return;
  }
  const c = J.escalaTripulacion(w, peso, Pf.factorClasificacion(ajustes.leer('sexo', '')));
  estado.escalaTrip = { ...c, ftp: w, peso, estimado: !ftp() || ajustes.si('ftpEstimado', false) };
  caja.innerHTML = `<span class="etq-campo">Tu puesto en la tripulación</span>${htmlTripMini(c)}
    <p class="trip-linea"><b>${c.nombre}</b>${c.siguiente ? ` · te faltan <b>${c.faltaW} W</b> de FTP para ${c.siguiente.nombre}` : ' · el puesto más alto'}</p>
    <button type="button" class="boton chico" data-trip>Qué es y cómo subir</button>`;
  $('#heroe-aguas').hidden = false;
  $('#heroe-aguas').textContent = `Tripulación: ${c.nombre} ›`;
  $('#heroe-aguas').setAttribute('aria-label', `Tu puesto en la tripulación: ${c.nombre}. Ver qué significa`);
  const vista = Number(ajustes.leer('clasificacionVista', '-1'));
  if (c.indice > vista) {
    if (vista >= 0) { toast(`¡Ascenso en la tripulación: ${c.nombre}!`); confeti(1800); }
    ajustes.escribir('clasificacionVista', String(c.indice));
  }
}

// Barra de 5 tramos (uno por puesto): los pasados llenos, el tuyo lleno hasta donde vas.
function htmlTripMini(e) {
  return `<div class="trip-barra" role="img" aria-label="Puesto ${e.indice + 1} de ${e.filas.length}: ${e.nombre}">${e.filas.map((f) => {
    const lleno = f.estado === 'pasado' ? 1 : f.estado === 'actual' ? (e.siguiente ? e.progreso : 1) : 0;
    return `<span class="trip-tramo ${f.estado}"><i style="width:${Math.round(lleno * 100)}%"></i></span>`;
  }).join('')}</div>`;
}
function abrirTripulacion() {
  if (!estado.escalaTrip) { pintarClasificacion(); }
  const e = estado.escalaTrip;
  if (!e) return;
  const mujer = ajustes.leer('sexo', '') === 'm';
  const filas = [...e.filas].reverse().map((f) => `<li class="trip-fila ${f.estado}">
      <span class="trip-marca">${f.estado === 'pasado' ? ico('i-check') : f.estado === 'actual' ? '★' : e.filas.indexOf(f) + 1}</span>
      <div><span><b>${f.nombre}</b>${f.estado === 'actual' ? '<span class="trip-tu">Tú</span>' : ''}</span>
        <small>${f.w ? (e.porPeso ? `Desde ${f.wkg.toFixed(1)} W/kg · ${f.w} W de FTP para ti` : `Desde ${f.w} W de FTP`) : 'Desde el primer día'}</small>
        <small class="trip-rivales">${f.texto}</small></div>
    </li>`).join('');
  const medida = e.sinFtp ? '' : e.porPeso
    ? `<p class="trip-cuenta">Tu FTP <b>${e.ftp} W</b>${e.estimado ? ' (estimado)' : ''} ÷ tu peso <b>${e.peso} kg</b> = <b>${e.valor.toFixed(2)} W/kg</b></p>`
    : `<p class="trip-cuenta">Tu FTP: <b>${e.ftp} W</b>. Pon tu peso en Ajustes para medirlo por kilo.</p>`;
  $('#trip-cuerpo').innerHTML = `
    <p class="ayuda">Tu puesto mide <b>cuánta fuerza sostienes por cada kilo</b> (tu FTP entre tu peso). Es distinto de tu rango de héroe: el rango sube con el nivel, remando; el puesto sube cuando de verdad eres más fuerte.</p>
    ${medida}
    ${e.sinFtp ? '' : `${htmlTripMini(e)}<p class="trip-linea">${e.siguiente ? `Llevas el <b>${Math.round(e.progreso * 100)} %</b> del camino a ${e.siguiente.nombre}: te faltan <b>${e.faltaW} W</b> de FTP.` : '¡Eres Capitán, el puesto más alto!'}</p>`}
    <ol class="trip-escalera">${filas}</ol>
    <p class="ayuda"><b>Para qué sirve:</b> tus rivales de la carrera son de tu mismo puesto, así que al subir reman más parejo y se cansan menos.${mujer ? ' Las referencias por kilo son un 18 % más bajas porque así lo pusiste en tu perfil.' : ''}</p>
    <p class="ayuda"><b>Cómo subir:</b> el plan «Subir mi FTP» y la Prueba FTP 20 min, que lo mide. Tu FTP también sube solo con sesiones de 10 min o más.</p>
    <div class="fila-botones"><button type="button" class="boton primario" data-ir-planes>Ver planes</button></div>`;
  $('#hoja-trip').hidden = false;
  $('#hoja-trip .hoja').focus();
}
export function cerrarTripulacion() { $('#hoja-trip').hidden = true; }

// Al arrancar la app (en orden, desde app.js).
export function arrancarAjustes2() {
  document.addEventListener('click', (e) => { if (e.target.closest('[data-trip], #heroe-aguas')) abrirTripulacion(); });
  $('#hoja-trip').addEventListener('click', (e) => {
    if (e.target === $('#hoja-trip') || e.target.closest('#trip-cerrar')) cerrarTripulacion();
    else if (e.target.closest('[data-ir-planes]')) { cerrarTripulacion(); irA('entrenamientos'); }
  });
  pintarZonas();
  pintarFtpEstado();
  H.sesiones().then(actualizarFcMax);
  for (let n = 1; n <= 24; n++) selNivel.add(new Option(`Resistencia ${n}`, n));
  selNivel.value = 8;
  $('#btn-nivel-prueba').addEventListener('click', () => {
    if (!remadora.conectada) { toast('Conecta la remadora primero'); return; }
    remadora.fijarResistencia(Number(selNivel.value));
    toast(`Resistencia ${selNivel.value} enviada. Revisa la consola.`);
  });
  $('#version-ajustes').textContent = VERSION;
}

export function pintarZonas() {
  const f = ftp();
  $('#tabla-zonas').innerHTML = `<thead><tr><th>Zona</th><th>% FTP</th><th>${f ? 'Watts' : ''}</th></tr></thead><tbody>${
    Ent.ZONAS.map((z) => `<tr><td><span class="z" style="background:${COLOR_ZONA[z.n - 1]}"></span>Z${z.n} ${z.nombre}</td><td>${z.min}–${z.max}%</td><td>${
      f ? `${Math.round((z.min * f) / 100)}–${Math.round((z.max * f) / 100)} W` : ''}</td></tr>`).join('')}</tbody>`;
  // Bandas del remo en 3 columnas (cabe a 360 px): banda, watts (o % del FTP sin FTP) y split.
  $('#tabla-bandas').innerHTML = `<thead><tr><th>Banda</th><th>${f ? 'Watts' : '% FTP'}</th><th>${f ? 'Split' : ''}</th></tr></thead><tbody>${
    E.bandasRemo(f).map((b) => `<tr><td><b>${b.clave}</b> ${b.nombre}</td><td>${f ? `${b.wMin}–${b.wMax}` : `${b.min}–${b.max}%`}</td><td>${
      f ? `${formatoSplit(b.splitRapido)}–${formatoSplit(b.splitLento)}` : ''}</td></tr>`).join('')}</tbody>`;
}

const selNivel = $('#sel-nivel-prueba');

// ---------- Respaldo ----------
export async function guardarRespaldo() {
  const datos = R.armarRespaldo({
    version: VERSION,
    sesiones: await H.sesiones(),
    entrenamientos: await db.listar('entrenamientos'),
    programa: leerPrograma(),
    leer: (k) => ajustes.leer(k, null),
  });
  const nombre = `rower-respaldo-${E.claveDia(Date.now())}.json`;
  const texto = JSON.stringify(datos);
  const archivo = new File([texto], nombre, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: 'Respaldo de Rower' });
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
  if (!R.esRespaldo(datos)) { toast('Ese archivo no es un respaldo de Rower'); return; }
  const conv = R.convertir(datos);
  if (conv.error) {
    toast(conv.error === 'nuevo' ? 'Ese respaldo es de una versión más nueva de Rower: actualiza la app y vuelve a intentarlo' : 'Ese archivo no es un respaldo válido', 5000);
    return;
  }
  datos = conv.datos;
  const { sesionesNuevas, entNuevos, ajustesResp, distintos, invalidas } = R.planRestaurar(datos, {
    sesiones: await H.sesiones(),
    entrenamientos: await db.listar('entrenamientos'),
    programa: leerPrograma(),
    leer: (k) => ajustes.leer(k, null),
  });
  // Todo en una transacción: si algo falla (disco lleno), no queda medio respaldo.
  try {
    await db.tx(['sesiones', 'muestras', 'entrenamientos'], 'readwrite', (t) => {
      for (const s of sesionesNuevas) H.poner(t, s);
      for (const e of entNuevos) t.objectStore('entrenamientos').put(e);
    });
  } catch (e) {
    anotarError('restaurar respaldo', e);
    toast('No se pudo restaurar el respaldo: no cambió nada. Libera espacio y vuelve a intentarlo.', 6000);
    return;
  } finally {
    H.invalidar();
  }
  if (invalidas) agregarLog(`respaldo: ${invalidas} sesiones dañadas no se trajeron`);
  const nS = sesionesNuevas.length;
  const nE = entNuevos.length;
  // Lo que falta se toma del respaldo; si el héroe, el plan o los ajustes ya existen y son otros, se pregunta.
  const reemplazar = distintos.length > 0 && confirm(`El respaldo trae ${R.listaHumana(distintos)} distintos a los de ahora. ¿Usar los del respaldo?`);
  if (datos.programa && (reemplazar || !leerPrograma())) guardarPrograma(datos.programa);
  for (const [k, v] of ajustesResp) {
    if (reemplazar || ajustes.leer(k, null) == null) ajustes.escribir(k, v);
  }
  toast(`Restaurado: ${nS} sesiones y ${nE} entrenamientos nuevos${reemplazar ? ', con el héroe, el plan y los ajustes del respaldo' : ''}${invalidas ? `. ${invalidas} ${invalidas === 1 ? 'sesión dañada no se trajo' : 'sesiones dañadas no se trajeron'}` : ''}`);
  // Con el héroe y los ajustes cambiados, lo más simple y seguro es volver a cargar la app.
  if (reemplazar) setTimeout(() => location.reload(), 1500);
  rellenarPerfil();
  pintarPerfil();
  llenarSelectorEntrenamientos();
  pintarHoy();
}

// Pide a Chrome que no borre el historial aunque al teléfono le falte espacio (una app instalada suele obtenerlo).
let datosProtegidos = null;
async function protegerDatos() {
  try {
    if (!navigator.storage?.persist) return;
    datosProtegidos = (await navigator.storage.persisted?.()) || (await navigator.storage.persist());
    agregarLog(`almacenamiento persistente: ${datosProtegidos ? 'sí' : 'no'}`);
  } catch { datosProtegidos = null; }
  pintarInfoRespaldo();
}
function pintarInfoRespaldo() {
  const ultimo = Number(ajustes.leer('ultimoRespaldo', 0));
  const proteccion = datosProtegidos === true ? ' Tus sesiones están protegidas en este teléfono.'
    : datosProtegidos === false ? ' Chrome podría borrar tus sesiones si falta espacio: guarda respaldos seguido.' : '';
  $('#respaldo-info').textContent = (ultimo
    ? `Último respaldo: ${new Date(ultimo).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.`
    : 'Todavía no has guardado un respaldo.') + proteccion;
  $('#respaldo-resumen').textContent = ultimo ? new Date(ultimo).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin respaldo';
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarAjustes3() {
  $('#btn-respaldo').addEventListener('click', guardarRespaldo);
  $('#btn-restaurar').addEventListener('click', () => $('#in-restaurar').click());
  $('#in-restaurar').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (archivo) { await restaurarRespaldo(archivo); await repararSesiones(); }
  });
  pintarInfoRespaldo();
  protegerDatos();
  migrarDatos();
}
// Reparaciones del historial: corren una sola vez por versión de los datos (antes recorrían y reescribían todo el
// historial en cada arranque). Sube VERSION_DATOS al agregar una reparación nueva. Un respaldo restaurado o una
// sesión recuperada de una versión vieja se reparan siempre, porque pueden traer sesiones en el formato anterior.
const VERSION_DATOS = 1;
async function migrarDatos() {
  try {
    const v = (await db.leerEstado('versionDatos')) || 0;
    if (v >= VERSION_DATOS) return;
    await repararSesiones();
    await db.guardarEstado('versionDatos', VERSION_DATOS);
    agregarLog(`datos: versión ${v} → ${VERSION_DATOS}`);
  } catch (e) {
    anotarError('migración de datos', e);
  }
}

// Sesiones guardadas con saltos falsos de distancia de la consola: se recortan a los metros reales una sola vez.
// Después, cada sesión guardada con la distancia de la consola pasa a la distancia según watts (una sola vez).
export async function repararSesiones() {
  let n = 0;
  let pasadas = 0;
  for (const s of await H.sesiones()) {
    let r = E.repararSaltos(s);
    if (r) {
      agregarLog(`sesión reparada: ${s.distancia} → ${r.distancia} m`);
      n++;
    } else if (E.debeQuedarSinTerminar(s)) {
      // Reparada antes de que la reparación marcara la carrera sin terminar.
      r = { ...s, carreraSinTerminar: true };
      agregarLog(`carrera sin terminar: sesión ${s.id}`);
    }
    const w = E.distanciaPorWatts(r || s);
    if (w) {
      agregarLog(`distancia según watts: ${(r || s).distancia} → ${w.distancia} m`);
      r = w;
      pasadas++;
    }
    if (r) await H.guardar(r);
  }
  if (!n && !pasadas) return;
  if (n) toast(n === 1 ? 'Reparé una sesión con metros falsos de la consola' : `Reparé ${n} sesiones con metros falsos de la consola`);
  else toast('Tu distancia ahora se calcula con tus watts, igual que la de los fantasmas', 5000);
  if (vistaActiva('historial')) pintarHistorial();
}
