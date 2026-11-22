// Inicio: bienvenida de la primera visita.
import { Remadora } from '../remadora.js';
import * as H from '../historial.js';
import * as E from '../estadisticas.js';
import * as P from '../programa.js';
import * as J from '../juego.js';
import * as Pf from '../perfil.js';
import { $, ajustes, citaGuardada, fcMaxima, ftp, miles, perfil, toast } from '../ui.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { aplicarEdad, ofrecerFtpInicial, pintarClasificacion, pintarPerfil, rellenarPerfil, selVariante } from './ajustes.js';
import { asistente, guardarFtp } from './preparar.js';
import { agregarLog } from '../registro.js';
import * as Hab from '../habito.js';
import { actualizarBotones, ofrecerRecuperar, remadora } from './sesion.js';
import { llenarSelectorEntrenamientos } from './planes.js';
import { guardarPersonaje, leerPersonaje, nombreAtributo, pintarLineaNivel, srcHeroe } from './heroe.js';
import { contextoPlan, guardarEntrenamientosDePlan, guardarPrograma, leerPrograma } from './programa.js';
import { mostrarConsejo } from './ayuda.js';
import * as Ci from '../cita.js';

// ---------- Bienvenida ----------
// La primera vez (etapa 20) son 3 toques hasta remar: el objetivo (con días y hora ya puestos), Conectar o Demo, y
// Empezar. El héroe se elige en el resumen de la primera sesión y el perfil se pide por partes cuando hace falta.
// Desde Ajustes › Ayuda se repite con lo que ya tienes: qué es la app, héroe, objetivo y perfil (sin conectar).
// Los pasos son las secciones data-paso del HTML: 1 qué es, 2 héroe, 3 objetivo, 4 perfil, 5 conectar.
const PASOS_PRIMERA = [3, 5];
const PASOS_REPETIR = [1, 2, 3, 4];
const inicio = { i: 0, pasos: PASOS_PRIMERA, clase: null, objetivo: null, dias: 3, minutos: null, experiencia: '', sexo: '', repetir: false, objAntes: null, verDias: false };
const OBJETIVOS_INICIO = [...P.OBJETIVOS_PLAN, { clave: 'libre', nombre: 'Solo remar', texto: 'Sin plan: remo libre contra fantasmas.' }];
const pasoInicio = () => inicio.pasos[inicio.i];
const esUltimoPaso = () => inicio.i === inicio.pasos.length - 1;
// Lee un número de la bienvenida: vacío o fuera de rango → null.
function numeroInicio(sel) {
  const el = $(sel);
  const v = Number(el.value);
  return el.value.trim() !== '' && Number.isFinite(v) && v >= Number(el.min) && v <= Number(el.max) ? Math.round(v) : null;
}
function perfilInicio() {
  return { ...perfil(), experiencia: inicio.experiencia, sexo: inicio.sexo, edad: numeroInicio('#inicio-edad') || 0, peso: numeroInicio('#inicio-peso') || 0, altura: numeroInicio('#inicio-altura') || 0 };
}
// Lo que la app hará con lo que escribes, en vivo.
function notaPerfilInicio() {
  const p = perfilInicio();
  const partes = [];
  if (p.edad) partes.push(`pulso máximo ${ajustes.si('fcMaxDeEdad', true) || !fcMaxima() ? Pf.fcMaxDeEdad(p.edad) : fcMaxima()} lpm`);
  const f = numeroInicio('#inicio-ftp');
  const fi = Pf.ftpInicial(p);
  if (f) partes.push(`FTP ${f} W`);
  else if (fi && (!ftp() || ajustes.si('ftpDePerfil', false)) && !(estado.cacheSesiones || []).length) partes.push(`FTP para empezar ≈ ${fi} W (lo afino con tu primera sesión)`);
  if (p.peso && p.edad && p.altura && (p.sexo === 'h' || p.sexo === 'm')) partes.push(`gasto en reposo ${miles(Math.round(Pf.basalPorHora(p) * 24))} kcal al día`);
  $('#inicio-perfil-nota').textContent = partes.length ? `Con esto: ${partes.join(' · ')}.` : '';
}
function pintarInicio() {
  const p = pasoInicio();
  const ultimo = esUltimoPaso();
  document.querySelectorAll('.inicio-paso').forEach((x) => { x.hidden = Number(x.dataset.paso) !== p; });
  document.querySelectorAll('#inicio-puntos span').forEach((x, i) => { x.classList.toggle('activo', i <= inicio.i); x.hidden = i >= inicio.pasos.length; });
  $('#inicio-clases').innerHTML = J.CLASES.map((c) => `<button type="button" class="clase-mini" role="radio" aria-checked="${c.clave === inicio.clase}" data-clase="${c.clave}">
    <img src="${srcHeroe(c.clave, 1, true)}" width="56" height="56" alt=""><b>${c.nombre}</b><small>+15 % ${nombreAtributo(c.favorito)}</small><span class="lema">${c.para}</span></button>`).join('');
  $('#inicio-objetivos').innerHTML = OBJETIVOS_INICIO.map((o) => `<button type="button" role="radio" class="opcion" data-obj="${o.clave}" aria-checked="${o.clave === inicio.objetivo}"><b>${o.nombre}</b><small>${o.texto}</small></button>`).join('');
  $('#inicio-dias').innerHTML = [1, 2, 3, 4, 5].map((d) => `<button type="button" role="radio" class="chip" data-dias="${d}" aria-checked="${inicio.dias === d}">${d} ${d === 1 ? 'día' : 'días'}</button>`).join('');
  $('#inicio-minutos').innerHTML = Pf.MINUTOS.map((m) => `<button type="button" role="radio" class="chip" data-minutos="${m}" aria-checked="${inicio.minutos === m}">${m ? `Hasta ${m} min` : 'Sin límite'}</button>`).join('');
  $('#inicio-experiencia').innerHTML = Pf.EXPERIENCIAS.map((x) => `<button type="button" role="radio" class="chip" data-exp="${x.clave}" aria-checked="${inicio.experiencia === x.clave}" title="${x.texto}">${x.nombre}</button>`).join('');
  $('#inicio-sexo').innerHTML = Pf.SEXOS.map((x) => `<button type="button" role="radio" class="chip" data-sexo="${x.clave}" aria-checked="${inicio.sexo === x.clave}">${x.nombre}</button>`).join('');
  // La primera vez los días vienen puestos: solo se ven si tocas «Cambiar» en el paso de conectar.
  $('#inicio-dias-campo').hidden = !inicio.objetivo || inicio.objetivo === 'libre' || (!inicio.repetir && !inicio.verDias);
  $('#inicio-hola').hidden = inicio.repetir;
  const resumen = $('#inicio-plan-resumen');
  resumen.hidden = inicio.repetir || !inicio.objetivo;
  const obj = OBJETIVOS_INICIO.find((o) => o.clave === inicio.objetivo);
  if (obj) {
    resumen.querySelector('span').innerHTML = inicio.objetivo === 'libre' ? `<b>${obj.nombre}</b>: ${obj.texto}`
      : `<b>${obj.nombre}</b> · ${Ci.textoDiasPlan(inicio.dias, citaGuardada().hora)}${inicio.minutos ? `, hasta ${inicio.minutos} min` : ''}.`;
  }
  $('#inicio-obj-ayuda').textContent = inicio.repetir && leerPrograma()?.dias?.length
    ? 'Ya tienes un plan: si cambias el objetivo, los días o el tiempo, armo uno nuevo desde hoy.'
    : 'Con tu respuesta armo un plan de 6 semanas. Lo puedes cambiar cuando quieras en Planes.';
  notaPerfilInicio();
  const sig = $('#inicio-siguiente');
  sig.disabled = (p === 2 && !inicio.clase) || (p === 3 && !inicio.objetivo);
  // El botón deshabilitado dice qué falta, en vez de quedarse gris sin explicación.
  sig.textContent = p === 2 && !inicio.clase ? 'Elige un héroe para seguir' : p === 3 && !inicio.objetivo ? 'Elige un objetivo para seguir'
    : p === 1 ? 'Repasar' : p === 5 ? 'Lo haré después' : ultimo ? 'Guardar' : 'Siguiente';
  sig.classList.toggle('primario', p !== 5);
  $('#inicio-atras').hidden = inicio.i === 0;
  $('#inicio-saltar').hidden = p === 5;
  $('#inicio-saltar').textContent = inicio.repetir ? 'Cerrar' : 'Saltar';
  if (p === 5 && !Remadora.soportado()) {
    $('#inicio-bt-texto').textContent = 'Este navegador no puede conectar con la remadora: abre la app en Chrome para Android. Mientras, pruébala en modo demo.';
    $('#inicio-conectar').hidden = true;
    $('#inicio-demo').classList.add('primario', 'grande');
  }
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarInicio() {
  $('#inicio').addEventListener('click', (e) => {
    const c = e.target.closest('[data-clase]');
    const o = e.target.closest('[data-obj]');
    const d = e.target.closest('[data-dias]');
    const m = e.target.closest('[data-minutos]');
    const x = e.target.closest('[data-exp]');
    const sx = e.target.closest('[data-sexo]');
    if (c) inicio.clase = c.dataset.clase;
    if (o) inicio.objetivo = o.dataset.obj;
    if (d) inicio.dias = Number(d.dataset.dias);
    if (m) inicio.minutos = Number(m.dataset.minutos);
    if (x) inicio.experiencia = x.dataset.exp;
    if (sx) inicio.sexo = sx.dataset.sexo;
    // La primera vez, tocar un objetivo ya es el toque 1: pasa directo a conectar con los días puestos.
    if (o && !inicio.repetir && !inicio.verDias) { avanzarInicio(); return; }
    if (c || o || d || m || x || sx) pintarInicio();
    // Al elegir objetivo aparece la pregunta de los días: se trae a la vista (en horizontal quedaba oculta abajo).
    if (o && !$('#inicio-dias-campo').hidden) $('#inicio-dias-campo').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('#inicio-cambiar').addEventListener('click', () => {
    inicio.verDias = true;
    inicio.i = inicio.pasos.indexOf(3);
    pintarInicio();
    $('#inicio .inicio-cuerpo').scrollTop = 0;
    if (!$('#inicio-dias-campo').hidden) $('#inicio-dias-campo').scrollIntoView({ block: 'nearest' });
  });
  $('#inicio').addEventListener('input', (e) => { if (e.target.matches('.inicio-numeros input')) notaPerfilInicio(); });
  $('#inicio-siguiente').addEventListener('click', () => { if (!esUltimoPaso()) avanzarInicio(); else terminarInicio(); });
  $('#inicio-atras').addEventListener('click', () => { inicio.i = Math.max(0, inicio.i - 1); pintarInicio(); });
  $('#inicio-saltar').addEventListener('click', () => (inicio.repetir ? cerrarInicio() : terminarInicio({ saltar: true })));
  $('#inicio-demo').addEventListener('click', () => { remadora.iniciarDemo(); terminarInicio(); });
  $('#inicio-conectar').addEventListener('click', async () => {
    try {
      await remadora.conectar(selVariante.value);
    } catch (err) {
      agregarLog(`error: ${err.message}`);
      $('#inicio-bt-texto').textContent = err.name === 'NotFoundError'
        ? 'No elegiste ninguna. Revisa que la consola esté encendida y vuelve a tocar Conectar.'
        : `No se pudo conectar (${err.message}). Vuelve a intentarlo o pruébala en modo demo.`;
      return;
    }
    if (remadora.conectada) terminarInicio();
  });
  (async () => {
    if (ajustes.si('inicioHecho', false)) { ofrecerRecuperar(); mostrarConsejo('entrenar'); return; }
    // Solo para quien empieza de cero: con héroe o sesiones guardadas, ya pasó por aquí.
    if (leerPersonaje().clase || (await H.sinMuestras()).length) { ajustes.escribir('inicioHecho', '1'); mostrarConsejo('entrenar'); return; }
    abrirInicio();
  })();
}
function avanzarInicio() {
  inicio.i = Math.min(inicio.pasos.length - 1, inicio.i + 1);
  if (!inicio.repetir) Hab.anotar('bienvenida', { paso: pasoInicio() });
  pintarInicio();
  $('#inicio .inicio-cuerpo').scrollTop = 0;
}
function cerrarInicio() { $('#inicio').hidden = true; }
// Guarda el perfil de la bienvenida (solo lo que escribiste; lo vacío no borra lo que ya tenías).
async function guardarPerfilInicio() {
  for (const [sel, clave] of [['#inicio-edad', 'edad'], ['#inicio-peso', 'peso'], ['#inicio-altura', 'altura']]) {
    const v = numeroInicio(sel);
    if (v != null) ajustes.escribir(clave, String(v));
  }
  if (inicio.experiencia) ajustes.escribir('experiencia', inicio.experiencia);
  if (inicio.sexo) ajustes.escribir('sexo', inicio.sexo);
  if (inicio.objetivo && inicio.objetivo !== 'libre') {
    ajustes.escribir('diasSemana', String(inicio.dias));
    if (inicio.minutos != null) ajustes.escribir('minutosSesion', String(inicio.minutos));
    asistente.dias = inicio.dias;
  }
  aplicarEdad();
  const f = numeroInicio('#inicio-ftp');
  if (f) { guardarFtp(f, false); ajustes.escribir('ftpDePerfil', '0'); } else await ofrecerFtpInicial();
  rellenarPerfil();
  pintarPerfil();
  pintarClasificacion();
}
// Guarda lo elegido (al saltar: héroe y perfil, sin plan) y deja la app lista para pulsar Empezar.
async function terminarInicio({ saltar = false } = {}) {
  const repetir = inicio.repetir;
  if (!repetir) Hab.anotar('bienvenidaFin', { paso: pasoInicio(), saltar });
  ajustes.escribir('inicioHecho', '1');
  if (!repetir) { estado.primerDia = true; actualizarBotones(); }
  cerrarInicio();
  const per = leerPersonaje();
  if (inicio.clase && (inicio.clase !== per.clase || $('#inicio-nombre').value.trim() !== (per.nombre || ''))) guardarPersonaje({ clase: inicio.clase, nombre: $('#inicio-nombre').value.trim() });
  await guardarPerfilInicio();
  let texto = repetir ? 'Guardé tus cambios' : saltar ? '' : '¡Listo! Pulsa Empezar cuando quieras remar';
  // Al repetir, el plan solo se rehace si cambió algo que lo define.
  const prog = leerPrograma();
  const cambia = !repetir || !prog?.dias?.length || inicio.objetivo !== inicio.objAntes || prog.porSemana !== inicio.dias || (inicio.minutos != null && (prog.minutosMax || 0) !== (inicio.minutos || 0));
  if (!saltar && inicio.objetivo && inicio.objetivo !== 'libre' && cambia) {
    const ctx = await contextoPlan();
    const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: inicio.objetivo, nivel: ctx.nivelSugerido, dias: inicio.dias, semanas: 6, inicio: E.claveDia(Date.now()), ctx });
    await guardarEntrenamientosDePlan(entrenamientos);
    guardarPrograma(programa);
    estado.elegirLoDeHoy = true;
    texto = `Tu plan está listo: ${programa.dias.length} sesiones en 6 semanas${ctx.minutosMax ? `, de hasta ${ctx.minutosMax} min` : ''}`;
  }
  irA('entrenar');
  await llenarSelectorEntrenamientos();
  pintarLineaNivel();
  pintarPerfil();
  // El primer día, sin ruido (etapa 16): ni confeti ni consejo de la pestaña; solo «Hoy toca», Empezar y un aviso.
  if (texto) toast(texto, 4000);
}
export function abrirInicio({ repetir = false } = {}) {
  const p = perfil();
  const per = leerPersonaje();
  const prog = leerPrograma();
  const obj = prog?.dias?.length ? P.objetivoPlan(prog.objetivo)?.clave || null : null;
  Object.assign(inicio, {
    i: 0, pasos: repetir ? PASOS_REPETIR : PASOS_PRIMERA, verDias: false, repetir, clase: repetir ? per.clase || null : null, objetivo: repetir ? obj || 'libre' : null, objAntes: repetir ? obj || 'libre' : null,
    dias: repetir && prog?.porSemana ? prog.porSemana : p.dias, minutos: p.minutos, experiencia: p.experiencia, sexo: p.sexo,
  });
  $('#inicio-nombre').value = repetir ? per.nombre || '' : '';
  for (const [sel, v] of [['#inicio-edad', p.edad], ['#inicio-peso', p.peso], ['#inicio-altura', p.altura], ['#inicio-ftp', ftp() && !ajustes.si('ftpEstimado', false) ? ftp() : 0]]) $(sel).value = v || '';
  pintarInicio();
  $('#inicio').hidden = false;
  $('#inicio .inicio-cuerpo').scrollTop = 0;
}
