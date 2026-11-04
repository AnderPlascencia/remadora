// Inicio: bienvenida de la primera visita.
import { Remadora } from '../remadora.js';
import * as H from '../historial.js';
import * as E from '../estadisticas.js';
import * as P from '../programa.js';
import { confeti } from '../efectos.js';
import * as J from '../juego.js';
import * as Pf from '../perfil.js';
import { $, ajustes, fcMaxima, ftp, miles, perfil, toast } from '../ui.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { aplicarEdad, ofrecerFtpInicial, pintarClasificacion, pintarPerfil, rellenarPerfil, selVariante } from './ajustes.js';
import { asistente, guardarFtp } from './preparar.js';
import { agregarLog } from '../registro.js';
import { ofrecerRecuperar, remadora } from './sesion.js';
import { llenarSelectorEntrenamientos } from './planes.js';
import { guardarPersonaje, leerPersonaje, nombreAtributo, pintarLineaNivel, srcHeroe } from './heroe.js';
import { contextoPlan, guardarEntrenamientosDePlan, guardarPrograma, leerPrograma } from './programa.js';
import { mostrarConsejo } from './ayuda.js';

// ---------- Bienvenida: qué es la app, héroe, objetivo, perfil y conexión en 5 pasos ----------
// La primera vez sale sola; desde Ajustes › Ayuda se repite (sin el paso de conectar) con lo que ya tienes.
const inicio = { paso: 1, clase: null, objetivo: null, dias: 3, minutos: null, experiencia: '', sexo: '', repetir: false, objAntes: null };
const OBJETIVOS_INICIO = [...P.OBJETIVOS_PLAN, { clave: 'libre', nombre: 'Solo remar', texto: 'Sin plan: remo libre contra fantasmas.' }];
const ultimoPasoInicio = () => (inicio.repetir ? 4 : 5);
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
  const p = inicio.paso;
  const ultimo = ultimoPasoInicio();
  document.querySelectorAll('.inicio-paso').forEach((x) => { x.hidden = Number(x.dataset.paso) !== p; });
  document.querySelectorAll('#inicio-puntos span').forEach((x, i) => { x.classList.toggle('activo', i < p); x.hidden = i >= ultimo; });
  $('#inicio-clases').innerHTML = J.CLASES.map((c) => `<button type="button" class="clase-mini" role="radio" aria-checked="${c.clave === inicio.clase}" data-clase="${c.clave}">
    <img src="${srcHeroe(c.clave, 1, true)}" width="56" height="56" alt=""><b>${c.nombre}</b><small>+15 % ${nombreAtributo(c.favorito)}</small><span class="lema">${c.para}</span></button>`).join('');
  $('#inicio-objetivos').innerHTML = OBJETIVOS_INICIO.map((o) => `<button type="button" role="radio" class="opcion" data-obj="${o.clave}" aria-checked="${o.clave === inicio.objetivo}"><b>${o.nombre}</b><small>${o.texto}</small></button>`).join('');
  $('#inicio-dias').innerHTML = [1, 2, 3, 4, 5].map((d) => `<button type="button" role="radio" class="chip" data-dias="${d}" aria-pressed="${inicio.dias === d}">${d} ${d === 1 ? 'día' : 'días'}</button>`).join('');
  $('#inicio-minutos').innerHTML = Pf.MINUTOS.map((m) => `<button type="button" role="radio" class="chip" data-minutos="${m}" aria-pressed="${inicio.minutos === m}">${m ? `Hasta ${m} min` : 'Sin límite'}</button>`).join('');
  $('#inicio-experiencia').innerHTML = Pf.EXPERIENCIAS.map((x) => `<button type="button" role="radio" class="chip" data-exp="${x.clave}" aria-pressed="${inicio.experiencia === x.clave}" title="${x.texto}">${x.nombre}</button>`).join('');
  $('#inicio-sexo').innerHTML = Pf.SEXOS.map((x) => `<button type="button" role="radio" class="chip" data-sexo="${x.clave}" aria-pressed="${inicio.sexo === x.clave}">${x.nombre}</button>`).join('');
  $('#inicio-dias-campo').hidden = !inicio.objetivo || inicio.objetivo === 'libre';
  $('#inicio-obj-ayuda').textContent = inicio.repetir && leerPrograma()?.dias?.length
    ? 'Ya tienes un plan: si cambias el objetivo, los días o el tiempo, armo uno nuevo desde hoy.'
    : 'Con tu respuesta armo un plan de 6 semanas. Lo puedes cambiar cuando quieras en Planes.';
  notaPerfilInicio();
  const sig = $('#inicio-siguiente');
  sig.disabled = (p === 2 && !inicio.clase) || (p === 3 && !inicio.objetivo);
  // El botón deshabilitado dice qué falta, en vez de quedarse gris sin explicación.
  sig.textContent = p === 2 && !inicio.clase ? 'Elige un héroe para seguir' : p === 3 && !inicio.objetivo ? 'Elige un objetivo para seguir'
    : p === 1 ? (inicio.repetir ? 'Repasar' : 'Empezar') : p === 5 ? 'Lo haré después' : p === ultimo ? 'Guardar' : 'Siguiente';
  sig.classList.toggle('primario', p !== 5);
  $('#inicio-atras').hidden = p === 1;
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
    if (c || o || d || m || x || sx) pintarInicio();
    // Al elegir objetivo aparece la pregunta de los días: se trae a la vista (en horizontal quedaba oculta abajo).
    if (o && !$('#inicio-dias-campo').hidden) $('#inicio-dias-campo').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('#inicio').addEventListener('input', (e) => { if (e.target.matches('.inicio-numeros input')) notaPerfilInicio(); });
  $('#inicio-siguiente').addEventListener('click', () => {
    if (inicio.paso < ultimoPasoInicio()) { inicio.paso++; pintarInicio(); $('#inicio .inicio-cuerpo').scrollTop = 0; } else terminarInicio();
  });
  $('#inicio-atras').addEventListener('click', () => { inicio.paso = Math.max(1, inicio.paso - 1); pintarInicio(); });
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
  ajustes.escribir('inicioHecho', '1');
  cerrarInicio();
  const per = leerPersonaje();
  if (inicio.clase && (inicio.clase !== per.clase || $('#inicio-nombre').value.trim() !== (per.nombre || ''))) guardarPersonaje({ clase: inicio.clase, nombre: $('#inicio-nombre').value.trim() });
  await guardarPerfilInicio();
  let texto = inicio.clase && !repetir ? '¡Listo! Pulsa Empezar cuando quieras remar' : repetir ? 'Guardé tus cambios' : '';
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
  if (inicio.clase && !repetir) confeti(1200);
  if (texto) toast(texto, 4000);
}
export function abrirInicio({ repetir = false } = {}) {
  const p = perfil();
  const per = leerPersonaje();
  const prog = leerPrograma();
  const obj = prog?.dias?.length ? P.objetivoPlan(prog.objetivo)?.clave || null : null;
  Object.assign(inicio, {
    paso: 1, repetir, clase: repetir ? per.clase || null : null, objetivo: repetir ? obj || 'libre' : null, objAntes: repetir ? obj || 'libre' : null,
    dias: repetir && prog?.porSemana ? prog.porSemana : p.dias, minutos: p.minutos, experiencia: p.experiencia, sexo: p.sexo,
  });
  $('#inicio-nombre').value = repetir ? per.nombre || '' : '';
  for (const [sel, v] of [['#inicio-edad', p.edad], ['#inicio-peso', p.peso], ['#inicio-altura', p.altura], ['#inicio-ftp', ftp() && !ajustes.si('ftpEstimado', false) ? ftp() : 0]]) $(sel).value = v || '';
  pintarInicio();
  $('#inicio').hidden = false;
  $('#inicio .inicio-cuerpo').scrollTop = 0;
}
