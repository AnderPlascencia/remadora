// Programa de entrenamiento: asistente, semanas del plan y lo de hoy.
import * as F from '../fantasma.js';
import * as db from '../db.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import * as P from '../programa.js';
import { confeti } from '../efectos.js';
import * as J from '../juego.js';
import * as XC from '../xp-carga.js';
import * as B from '../base.js';
import * as Cap from '../capacidades.js';
import * as A from '../adaptacion.js';
import * as Pf from '../perfil.js';
import { $, COLOR_ZONA, ajustes, escaparHtml, ftp, ico, miles, perfil, toast } from '../ui.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { asistente, estimarFtp, leerMmss, libreConFantasmas } from './preparar.js';
import { vistaPrevia } from './vivo.js';
import { agregarLog } from '../registro.js';
import {
  calcularDia, llenarSelectorEntrenamientos, obtenerEnt, pintarBloquesEnt, pintarEntrenamientos, semanaDelPlan, usarEnt, valorDe,
} from './planes.js';
import { leerPersonaje, prepararEntrenamiento } from './heroe.js';

// ---------- Programa ----------
export function leerPrograma() {
  try { return JSON.parse(ajustes.leer('programa', 'null')); } catch { return null; }
}
export function guardarPrograma(p) {
  // Un plan nuevo elige su sesión de hoy aunque antes hubieras elegido otra cosa a mano.
  if (p && p.inicio !== leerPrograma()?.inicio) ajustes.escribir('eleccionDia', '');
  if (p) ajustes.escribir('programa', JSON.stringify(p));
  else { try { localStorage.removeItem('programa'); } catch { /* nada */ } }
  // El calendario del juego (sesiones y descansos del plan) guarda los días pasados tal como eran.
  guardarCalendario(XC.fusionarCalendario(leerCalendario(), p, E.claveDia(Date.now())));
}
function leerCalendario() {
  try { return JSON.parse(ajustes.leer('calendarioPlan', 'null')); } catch { return null; }
}
function guardarCalendario(cal) {
  ajustes.escribir('calendarioPlan', JSON.stringify(cal));
  J.fijarCalendarioPlan(cal);
}
// Al arrancar: el calendario guardado o, la primera vez, el del plan actual.
{
  const cal = leerCalendario();
  if (cal) J.fijarCalendarioPlan(cal);
  else guardarCalendario(XC.calendarioDe(leerPrograma()));
  // La meta semanal de km también la mira el juego (Triunfo romano).
  J.fijarMetaSemana(ajustes.num('metaSemana', 10));
}

// Lo que el juego necesita saber de una sesión al guardarla (o al estimar su XP antes de remar):
// si era la sesión del día (del plan, recuperada o sugerida sin plan) y, si hay sesión del plan hoy, su tipo y su carga.
export async function contextoXp(ent, sesiones, inicio = Date.now()) {
  const out = { reglasXp: XC.REGLAS_XP_CARGA };
  try {
    const todos = await db.listar('entrenamientos');
    const dia = await calcularDia(sesiones, todos);
    if (dia && ent && ((dia.ent && dia.ent === ent.nombre) || (dia.id && String(dia.id) === String(ent.id)))) {
      if (['plan', 'recuperar', 'sugerida'].includes(dia.fuente)) out.delDia = dia.fuente;
    }
    const hoy = P.deHoy(leerPrograma(), inicio);
    const plan = hoy && (todos.find((x) => x.nombre === hoy.ent) || estado.baseActual.find((x) => x.nombre === hoy.ent));
    const f = ftp();
    if (plan && f) {
      const sim = F.simular(plan, { ftp: f }, f).muestras;
      if (sim.length) out.planDelDia = { ent: plan.nombre, tipo: Cap.tipoPlan(plan), carga: E.estres({ duracion: sim.length, muestras: sim }, f) };
    }
  } catch (e) { agregarLog(`contextoXp: ${e.message}`); }
  return out;
}

// Guarda los entrenamientos de un plan nuevo: los del mismo nombre se actualizan (así un plan nuevo no usa
// los objetivos viejos) y los de un plan anterior que ya no se usan se borran para no llenar tu lista.
export async function guardarEntrenamientosDePlan(entrenamientos) {
  const anterior = new Set((leerPrograma()?.dias || []).map((d) => d.ent));
  const nuevos = new Set(entrenamientos.map((x) => x.nombre));
  const todos = await db.listar('entrenamientos');
  for (const x of entrenamientos) {
    const previo = todos.find((e) => e.nombre === x.nombre);
    await db.guardar('entrenamientos', { ...x, dePlan: true, ...(previo ? { id: previo.id } : {}) });
  }
  for (const e of todos) {
    if (!nuevos.has(e.nombre) && (e.dePlan || anterior.has(e.nombre)) && !B.NOMBRES_PRUEBA.has(e.nombre)) await db.borrar('entrenamientos', e.id);
  }
}
export const esDePlan = (e, prog = leerPrograma()) => !!e.dePlan || !!prog?.dias.some((d) => d.ent === e.nombre);

export async function pintarPrograma() {
  const prog = leerPrograma();
  $('#programa-vacio').hidden = !!prog;
  $('#programa-activo').hidden = !prog;
  if (!prog) {
    pintarAsistente();
    if (!$('#p-inicio').value) $('#p-inicio').value = E.claveDia(Date.now());
    const ents = await db.listar('entrenamientos');
    const nombresDia = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const previos = [...$('#p-dias').querySelectorAll('select')].map((x) => x.value);
    $('#p-dias').innerHTML = nombresDia.map((d, i) => `<label>${d}<select data-dia="${i}"><option value="">Descanso</option>${
      ents.map((e) => `<option>${escaparHtml(e.nombre)}</option>`).join('')}</select></label>`).join('');
    $('#p-dias').querySelectorAll('select').forEach((x, i) => { x.value = previos[i] || ''; });
    return;
  }
  const sesiones = await H.sesiones();
  const estados = P.estadoDias(prog, sesiones);
  const c = P.cumplimiento(estados);
  $('#prog-nombre').textContent = prog.nombre;
  $('#prog-cumple').textContent = `${c.hechos} de ${c.total} sesiones`;
  $('#prog-barra').style.width = `${(100 * c.hechos) / (c.total || 1)}%`;
  // La semana actual con lo que toca cada día, y el esquema del plan en una línea.
  const todos = await db.listar('entrenamientos');
  const semana = semanaDelPlan(prog, sesiones);
  const sem = P.semanaDe(prog);
  $('#semana-plan-titulo').textContent = sem.n >= 1 && sem.n <= sem.total ? `Semana ${sem.n} de ${sem.total}${sem.descarga ? ' · de descarga, más suave' : ''}` : 'Esta semana';
  const ESTADO = { hecho: 'Hecha', perdido: 'No se hizo', hoy: 'Hoy', pendiente: 'Próxima' };
  const buscarEnt = (n) => todos.find((e) => e.nombre === n) || estado.baseActual.find((e) => e.nombre === n);
  $('#semana-plan').innerHTML = semana.length ? semana.map((d) => {
    const e = buscarEnt(d.ent);
    const v = valorDe(d.ent, todos);
    const tipo = /^Prueba/.test(d.ent) ? 'Prueba' : e && P.esDura(e) ? 'Dura' : 'Suave';
    return `<li data-estado="${d.estado}"><span class="sp-dia">${d.diaCorto}</span><span class="sp-info"><b>${escaparHtml(d.ent)}</b><small>${tipo}${e ? ` · ${escaparHtml(B.resumenEnt(e).split(' · ')[0])}` : ''} · ${ESTADO[d.estado]}${d.estado === 'hecho' ? ' ✓' : ''}</small></span>${
      v && d.estado !== 'hecho' ? `<button type="button" class="boton chico" data-entrenar="${v}">Entrenar</button>` : ''}</li>`;
  }).join('') : '<li class="vacio">Esta semana no hay sesiones en tu plan.</li>';
  pintarPlanHoy(prog, sesiones, todos);
  pintarPlanFuturo(prog, sesiones, buscarEnt);
  const porSemana = prog.porSemana || Math.round(prog.dias.length / Math.max(1, prog.semanas || 1));
  const primeras = prog.dias.slice(0, porSemana).map((d) => buscarEnt(d.ent)).filter(Boolean);
  const duras = primeras.filter((e) => P.esDura(e)).length;
  $('#prog-esquema').hidden = !prog.objetivo;
  $('#prog-esquema').textContent = `Cada semana: ${duras} ${duras === 1 ? 'sesión dura' : 'sesiones duras'} y ${porSemana - duras} ${porSemana - duras === 1 ? 'suave' : 'suaves'}, nunca dos duras seguidas. La carga sube semana a semana y cada 4 hay una de descarga.`;
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
    celdas.push(`<button type="button" class="${clase}" data-k="${k}" aria-label="${new Date(d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}${dia ? `: ${escaparHtml(dia.ent)}` : ''}">${d.getDate()}${marca}</button>`);
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

// Tira de bloques de una sesión: el ancho es el tiempo y la altura y el color, lo fuerte que es.
function tiraBloques(ent) {
  const bloques = (ent?.bloques || []).filter((b) => b.duracion > 0);
  if (!bloques.length) return '';
  const pct = (b) => (b.metrica === 'ftp' ? (b.min + Math.min(b.max, b.min + 30)) / 2
    : b.metrica === 'fcpct' ? (b.min + b.max) / 2 - 5 : b.prueba ? (b.duracion <= 120 ? 130 : 105) : 45);
  return bloques.map((b) => {
    const v = pct(b);
    const z = Ent.ZONAS.findIndex((x) => v <= x.max);
    return `<i style="flex-grow:${b.duracion};height:${Math.round(25 + Math.min(75, (v / 140) * 75))}%;background:${COLOR_ZONA[z < 0 ? 5 : z]}"></i>`;
  }).join('');
}
const minTexto = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
const diaPlan = (k) => { const d = new Date(`${k}T12:00`); const f = (o) => d.toLocaleDateString('es-MX', o).replace('.', ''); return `${f({ weekday: 'short' })} ${d.getDate()} ${f({ month: 'short' })}`; };

// Programa › Hoy: la sesión del día (ya con lo que ajustó el plan) o el descanso y la próxima.
async function pintarPlanHoy(prog, sesiones, todos) {
  const caja = $('#plan-hoy');
  const dia = await calcularDia(sesiones, todos);
  const buscar = (n) => todos.find((e) => e.nombre === n) || estado.baseActual.find((e) => e.nombre === n);
  const ETQ = { plan: 'Hoy toca', hecho: 'Hoy · ya lo hiciste ✓', recuperar: 'Hoy, para recuperar', descanso: 'Hoy descansas', terminado: 'Plan terminado' };
  caja.dataset.fuente = dia?.fuente || '';
  $('#plan-hoy-etq').textContent = ETQ[dia?.fuente] || 'Hoy';
  const prox = P.proximo(prog);
  const ent = dia?.ent ? buscar(dia.ent) : null;
  const mostrado = ent || (dia?.fuente === 'descanso' && prox ? buscar(prox.ent) : null);
  $('#plan-hoy-nombre').textContent = dia?.ent || (dia?.fuente === 'terminado' ? prog.nombre : 'Descanso');
  $('#plan-hoy-resumen').textContent = ent ? B.resumenEnt(ent)
    : dia?.fuente === 'descanso' && prox ? `Próxima: ${prox.ent} · ${diaPlan(prox.fecha)}` : '';
  $('#plan-hoy-tira').innerHTML = tiraBloques(mostrado);
  $('#plan-hoy-tira').classList.toggle('apagada', !ent);
  $('#plan-hoy-porque').textContent = dia?.motivo || '';
  $('#plan-hoy-porque').hidden = !dia?.motivo;
  const v = ent && dia.fuente !== 'hecho' ? valorDe(dia.ent, todos) : null;
  const btn = $('#plan-hoy-btn');
  btn.hidden = !v && dia?.fuente !== 'descanso';
  btn.textContent = v ? 'Entrenar' : 'Remar suave igual';
  btn.classList.toggle('primario', !!v);
  btn.onclick = async () => { const e = await obtenerEnt(v || dia.alternativa || 'base:dis-suave'); if (e) usarEnt(e); };
}

// Programa › Cómo sube tu plan y Lo que sigue: el esfuerzo de cada semana y las sesiones de las que vienen.
function pintarPlanFuturo(prog, sesiones, buscar) {
  const semanas = P.semanasPlan(prog, sesiones, buscar);
  const max = Math.max(1, ...semanas.map((s) => s.esfuerzo));
  const curva = $('#plan-curva');
  curva.style.setProperty('--n', semanas.length);
  curva.setAttribute('aria-label', `Esfuerzo por semana: ${semanas.map((s) => `semana ${s.n}, ${minTexto(s.minutos)}${s.descarga ? ', descarga' : ''}${s.prueba ? ', con prueba' : ''}`).join('; ')}`);
  curva.innerHTML = semanas.map((s) => `<button type="button" class="pc-semana${s.actual ? ' actual' : s.pasada ? ' pasada' : ''}${s.descarga ? ' descarga' : ''}" data-semana="${s.n}" title="Semana ${s.n}: ${minTexto(s.minutos)}">
      <span class="pc-min">${s.minutos >= 60 ? `${Math.round(s.minutos / 6) / 10}`.replace('.', ',') + ' h' : `${s.minutos}′`}</span>
      <span class="pc-barra" style="height:${Math.max(6, Math.round((s.esfuerzo / max) * 100))}%">${s.prueba ? '<b class="pc-prueba" aria-hidden="true">★</b>' : ''}</span>
      <span class="pc-n">${s.actual ? 'Hoy' : `S${s.n}`}</span></button>`).join('');
  const actual = semanas.find((s) => s.actual);
  const pico = semanas.reduce((a, s) => (s.esfuerzo > a.esfuerzo ? s : a), semanas[0]);
  const ultima = semanas.at(-1);
  $('#plan-curva-texto').textContent = [
    actual ? `Esta semana: ${minTexto(actual.minutos)} en ${actual.sesiones} ${actual.sesiones === 1 ? 'sesión' : 'sesiones'}.` : '',
    pico && pico !== actual ? `La semana más exigente es la ${pico.n} (${minTexto(pico.minutos)}).` : actual && pico === actual ? 'Esta es la semana más exigente del plan.' : '',
    ultima?.prueba ? `En la última (semana ${ultima.n}) mides cuánto mejoraste con una prueba.` : '',
  ].filter(Boolean).join(' ');
  // Lo que sigue: de la próxima semana al final. Con el plan terminado no queda nada.
  const futuras = semanas.filter((s) => !s.pasada && !s.actual);
  $('#plan-sigue-titulo').hidden = !futuras.length;
  document.querySelector('.plan-estimado').hidden = !futuras.length;
  const f = prog.factor && prog.factor !== 1 ? Math.round((prog.factor - 1) * 100) : 0;
  $('#plan-factor').textContent = f ? `Ahora mismo tus rangos van un ${Math.abs(f)} % más ${f > 0 ? 'altos' : 'bajos'} según cómo te fue.` : '';
  const ESTADO = { hecho: 'Hecha ✓', perdido: 'No se hizo' };
  $('#plan-sigue').innerHTML = futuras.map((s, i) => {
    // Se compara con la última semana normal: tras una descarga, subir es lo esperado y no dice nada.
    const previa = semanas.slice(0, s.n - 1).reverse().find((x) => !x.descarga);
    const cambio = previa?.esfuerzo ? Math.round(((s.esfuerzo - previa.esfuerzo) / previa.esfuerzo) * 100) : 0;
    const chips = [
      s.descarga ? '<span class="ps-chip descarga">Descarga: más suave para asimilar</span>' : '',
      s.prueba ? '<span class="ps-chip prueba">★ Prueba</span>' : '',
      !s.descarga && cambio >= 3 ? `<span class="ps-chip sube">+${cambio} % de carga</span>` : '',
      !s.descarga && cambio <= -3 ? `<span class="ps-chip baja">−${-cambio} % de carga</span>` : '',
    ].join('');
    const dias = s.dias.map((d) => {
      const e = buscar(d.ent);
      const tipo = d.prueba ? 'Prueba' : d.dura ? 'Dura' : 'Suave';
      return `<li data-tipo="${tipo.toLowerCase()}"><span class="sp-dia">${diaPlan(d.fecha).replace(/^(\S+) /, '$1<br>')}</span><span class="sp-info"><b>${escaparHtml(d.ent)}</b>
        <small>${tipo} · ${d.min} min${d.antes ? ` · <span class="ps-antes">antes: ${escaparHtml(d.antes)}</span>` : ''}${ESTADO[d.estado] ? ` · ${ESTADO[d.estado]}` : ''}</small>
        <span class="tira-bloques chica" aria-hidden="true">${tiraBloques(e)}</span></span></li>`;
    }).join('');
    return `<details class="ps-semana${s.descarga ? ' descarga' : ''}" data-semana="${s.n}"${i === 0 ? ' open' : ''}>
      <summary><span class="ps-tit"><b>Semana ${s.n}</b><small>${diaPlan(s.lunes).replace(/^\S+ /, '')} · ${s.sesiones} ${s.sesiones === 1 ? 'sesión' : 'sesiones'} · ${minTexto(s.minutos)}</small></span><span class="ps-chips">${chips}</span></summary>
      <ol class="semana-plan">${dias}</ol></details>`;
  }).join('');
  curva.onclick = (ev) => {
    const b = ev.target.closest('[data-semana]');
    if (!b) return;
    const n = b.dataset.semana;
    const det = $('#plan-sigue').querySelector(`[data-semana="${n}"]`);
    if (det) { det.open = true; det.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    (actual && Number(n) === actual.n ? $('#semana-plan-titulo') : $('#calendario')).scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

// ---------- Asistente de plan por objetivo ----------
// Ritmo actual y distancia habitual, sacados de tu historial (o de tu FTP) para que no tengas que escribirlos.
export async function contextoPlan() {
  const sesiones = await H.sesiones();
  let split2k = null;
  for (const x of sesiones.slice(-30)) {
    const t = x.muestras?.length ? E.mejorTiempo(x.muestras, 2000) : null;
    if (t && (!split2k || t / 4 < split2k)) split2k = t / 4;
  }
  const w = ftp() || estimarFtp(sesiones);
  if (!split2k) split2k = w ? F.splitDeWatts(w * 1.05) : 135;
  const dists = sesiones.slice(-10).map((x) => x.distancia).filter((d) => d > 0).sort((a, b) => a - b);
  const recientes = sesiones.filter((x) => x.fecha > Date.now() - 30 * 864e5).length;
  const kcals = sesiones.slice(-10).map((x) => x.kcal).filter((k) => k > 0).sort((a, b) => a - b);
  const kcalMes = sesiones.filter((x) => x.fecha > Date.now() - 28 * 864e5).reduce((a, x) => a + (x.kcal || 0), 0);
  // Tu perfil: la experiencia decide el volumen mientras no hay historial, y el tiempo por sesión pone un tope.
  const pf = Pf.ctxPlanDePerfil(perfil(), { sinHistorial: sesiones.length < 3 });
  return {
    minutosMax: pf.minutosMax || 0,
    split2k: Math.round(split2k), distHabitual: dists[Math.floor(dists.length / 2)] || 4000,
    kcalHabitual: kcals[Math.floor(kcals.length / 2)] || 250, kcalSemana: Math.round(kcalMes / 4),
    nivelSugerido: pf.nivel || (recientes < 4 ? 'inicio' : recientes < 10 ? 'medio' : 'alto'), sinHistorial: sesiones.length < 3,
  };
}
// El plan por tiempo meta es una opción más del asistente: cambia las preguntas 2 a 4 por distancia y tiempo.
const OBJETIVOS_ASISTENTE = [...P.OBJETIVOS_PLAN, { clave: 'meta', nombre: 'Un tiempo meta', texto: 'Remar una distancia en un tiempo, por ejemplo 2000 m en 7:45.' }];
async function pintarAsistente() {
  const ctx = await contextoPlan();
  asistente.nivel ??= ctx.nivelSugerido;
  const marcar = (v, x) => `aria-checked="${v === x}"`;
  const meta = asistente.objetivo === 'meta';
  document.querySelectorAll('#asistente .as-normal').forEach((x) => { x.hidden = meta; });
  $('#as-meta').hidden = !meta;
  if (meta) pintarPlanMeta();
  $('#as-objetivo').innerHTML = OBJETIVOS_ASISTENTE.map((o) => `<button type="button" role="radio" class="opcion" data-v="${o.clave}" ${marcar(asistente.objetivo, o.clave)}><b>${o.nombre}</b><small>${o.texto}</small></button>`).join('');
  $('#as-nivel').innerHTML = P.NIVELES_PLAN.map((n) => `<button type="button" role="radio" class="chip" data-v="${n.clave}" aria-pressed="${asistente.nivel === n.clave}">${n.nombre}</button>`).join('');
  $('#as-dias').innerHTML = [1, 2, 3, 4, 5].map((d) => `<button type="button" role="radio" class="chip" data-v="${d}" aria-pressed="${asistente.dias === d}">${d} ${d === 1 ? 'día' : 'días'}</button>`).join('');
  $('#as-semanas').innerHTML = [4, 6, 8, 12].map((d) => `<button type="button" role="radio" class="chip" data-v="${d}" aria-pressed="${asistente.semanas === d}">${d} semanas</button>`).join('');
  $('#btn-asistente').disabled = !asistente.objetivo;
  const res = $('#as-resumen');
  res.hidden = !asistente.objetivo || meta;
  if (!asistente.objetivo || meta) return;
  const { programa } = P.planPorObjetivo({ ...asistente, inicio: E.claveDia(Date.now()), ctx });
  const primera = programa.dias.slice(0, asistente.dias).map((d) => d.ent);
  const ultima = programa.dias.slice(-asistente.dias).map((d) => d.ent);
  const o = P.objetivoPlan(asistente.objetivo);
  res.innerHTML = `<b>Tu plan: ${programa.dias.length} sesiones</b>
    <p>Semana 1: ${primera.join(' · ')}</p><p>Última semana: ${ultima.join(' · ')}</p>
    <small>La carga sube cada semana y cada 4 semanas hay una más suave para recuperar.${o.prueba ? ` Harás la «${o.prueba}» para medir tu avance.` : ''} ${ctx.minutosMax ? ` Ninguna sesión pasa de ${ctx.minutosMax} min, como pusiste en tu perfil.` : ''} Las intensidades van según tu FTP${asistente.objetivo === 'base' ? ' y tu pulso máximo' : ''}${asistente.objetivo === 'calorias' ? `; la meta de la primera semana parte de lo que quemas ahora (${miles(Math.max(300, ctx.kcalSemana || ctx.kcalHabitual * asistente.dias))} kcal)` : ''}. Si te cansas o mejoras, el plan se ajusta solo.</small>`;
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarPrograma() {
  $('#asistente').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    const grupo = b.parentElement.id.replace('as-', '');
    asistente[grupo] = grupo === 'dias' || grupo === 'semanas' ? Number(b.dataset.v) : b.dataset.v;
    pintarAsistente();
  });
  $('#btn-asistente').addEventListener('click', async () => {
    if (!asistente.objetivo) return;
    if (asistente.objetivo === 'meta') { crearPlanMeta(); return; }
    const { programa, entrenamientos } = P.planPorObjetivo({ ...asistente, inicio: E.claveDia(Date.now()), ctx: await contextoPlan() });
    await guardarEntrenamientosDePlan(entrenamientos);
    guardarPrograma(programa);
    estado.elegirLoDeHoy = true;
    confeti(1500);
    toast(`Plan creado: ${programa.dias.length} sesiones en ${asistente.semanas} semanas`);
    pintarEntrenamientos();
    llenarSelectorEntrenamientos();
    pintarHoy();
  });
  $('#pm-dist').addEventListener('change', pintarPlanMeta);

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
  $('#btn-quitar-programa').addEventListener('click', async () => {
    if (!confirm('¿Quitar el programa? Tus sesiones no se borran.')) return;
    guardarPrograma(null);
    await limpiarSobrantesDePlan();
    pintarEntrenamientos();
  });
  $('#semana-plan').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-entrenar]');
    if (!b) return;
    const ent = await obtenerEnt(b.dataset.entrenar);
    if (ent) usarEnt(ent);
  });
  $('#btn-cambiar').addEventListener('click', () => {
    const abierto = $('#otra-cosa').hidden;
    $('#otra-cosa').hidden = !abierto;
    $('#btn-cambiar').setAttribute('aria-expanded', String(abierto));
    $('#btn-cambiar').textContent = abierto ? 'Listo' : 'Cambiar';
  });
  $('#btn-ver-plan').addEventListener('click', () => { ajustes.escribir('pestanaPlanes', 'programa'); ajustes.escribir('subirAtr', ''); irA('entrenamientos'); });
  $('#btn-hoy-detalle').addEventListener('click', () => {
    ajustes.escribir('hoyDetalle', ajustes.si('hoyDetalle', false) ? '0' : '1');
    pintarHoy();
  });
}

// Plan automático: sugiere la meta a partir de tu mejor marca y predicción en esa distancia.
async function pintarPlanMeta() {
  const dist = Number($('#pm-dist').value);
  if (!$('#pm-inicio').value) $('#pm-inicio').value = E.claveDia(Date.now());
  const sesiones = await H.sesiones();
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
    ? `${mejor.real ? 'Tu mejor' : 'Tu predicción para'} ${miles(dist)} m: ${Ent.formatoMmss(mejor.t)}. Una meta realista en 8 semanas: ${Ent.formatoMmss(Math.round(mejor.t * 0.96))}.`
    : 'Aún no hay sesiones para sugerirte una meta: elige una que te rete.';
  $('#pm-tiempo').placeholder = mejor ? Ent.formatoMmss(Math.round(mejor.t * 0.96)) : '8:00';
}
async function crearPlanMeta() {
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
  await guardarEntrenamientosDePlan(entrenamientos);
  guardarPrograma(programa);
  estado.elegirLoDeHoy = true;
  toast(`Plan creado: ${programa.dias.length} sesiones en ${semanas} semanas`);
  pintarEntrenamientos();
  llenarSelectorEntrenamientos();
  pintarHoy();
}
// Borra los entrenamientos que dejó un plan anterior y que el de ahora ya no usa (tus sesiones no se tocan).
export async function limpiarSobrantesDePlan() {
  const sobran = A.sobrantesDePlan(leerPrograma(), await db.listar('entrenamientos'));
  for (const e of sobran) await db.borrar('entrenamientos', e.id);
  if (sobran.length) agregarLog(`limpieza: ${sobran.length} entrenamientos de planes anteriores`);
  return sobran.length;
}

async function pintarRecomendacion() {
  const r = E.recomendacion(await H.sesiones(), ftp());
  const el = $('#recomendacion');
  // «Vas equilibrado» no pide nada: solo se muestra cuando hay algo que cambiar hoy.
  el.hidden = !r || r.tipo === 'normal';
  if (r) { el.textContent = r.texto; el.className = `recomendacion ${r.tipo}`; }
}

// ¿La sesión es el entrenamiento que tocaba hoy en el programa? (para los talentos del samurái)
export function delProgramaHoy(s) {
  const hoy = P.deHoy(leerPrograma(), s.inicio);
  return !!(hoy && s.entrenamiento && hoy.ent === s.entrenamiento) || undefined;
}

// Tarjeta «Hoy»: lo que vas a remar al pulsar Empezar, y una sugerencia si hay algo mejor que hacer.
let hoyTurno = 0;
export async function pintarHoy(ent = estado.entrenamientoPrevio) {
  const turno = ++hoyTurno;
  const [sesiones, todos] = await Promise.all([H.sesiones(), db.listar('entrenamientos')]);
  if (turno !== hoyTurno) return;
  const prog = leerPrograma();
  const dia = await calcularDia(sesiones, todos);
  if (turno !== hoyTurno) return;
  // La sesión del día ya tiene en cuenta tu frescura: la recomendación general solo sale sin ella.
  if (dia) $('#recomendacion').hidden = true; else pintarRecomendacion();
  const valorDia = dia ? (dia.id || valorDe(dia.ent, todos)) : null;
  const esDelDia = !!(ent && valorDia && String(ent.id) === valorDia);
  const ETQ = { plan: 'Hoy toca', hecho: 'Hoy toca · ya lo hiciste', recuperar: 'Para recuperar hoy', sugerida: 'Sugerido para hoy' };
  $('#hoy-etq').textContent = esDelDia ? ETQ[dia.fuente] || 'Hoy' : ent ? 'Tu entrenamiento' : dia?.fuente === 'descanso' ? 'Hoy descansas' : 'Hoy';
  $('#hoy-nombre').textContent = ent ? ent.nombre : libreConFantasmas() ? 'Remo libre contra 3 fantasmas' : 'Remo libre';
  $('#hoy-resumen').textContent = ent ? [B.resumenEnt(ent), ent.proposito].filter(Boolean).join(' · ')
    : libreConFantasmas() ? 'Rema a tu aire: la carrera cuenta desde los 5 min.' : 'Rema a tu aire, sin meta.';
  // Por qué toca esto hoy (o por qué hoy se descansa).
  const porque = dia?.motivo && (esDelDia || (!ent && dia.fuente === 'descanso')) ? dia.motivo : '';
  $('#hoy-porque').hidden = !porque;
  $('#hoy-porque').textContent = porque;
  $('#btn-ver-plan').hidden = !prog || !dia || !['plan', 'hecho', 'recuperar', 'descanso'].includes(dia.fuente);
  // Lo que la adaptación cambió hoy, y si tus rangos del plan van más bajos o más altos.
  const avisosHoy = (prog?.avisos || []).filter((x) => x.dia === E.claveDia(Date.now())).map((x) => x.texto);
  const factor = prog?.factor && prog.factor !== 1 ? Math.round((prog.factor - 1) * 100) : 0;
  if (factor && esDelDia && dia.ent) avisosHoy.push(`Tus rangos del plan van un ${Math.abs(factor)} % más ${factor > 0 ? 'altos' : 'bajos'} según cómo te fue.`);
  // Semáforo de fatiga en una línea, para no apretar de más.
  const cuerpo = ftp() ? Cap.estadoCuerpo(sesiones, ftp()) : null;
  $('#hoy-cuerpo').hidden = !cuerpo;
  if (cuerpo) {
    $('#hoy-cuerpo').dataset.estado = cuerpo.clave;
    $('#hoy-cuerpo').textContent = `${cuerpo.nombre} · ${cuerpo.horas ? Cap.textoRecuperacion(cuerpo.horas).toLowerCase() : 'puedes entrenar'}`;
  }
  $('#hoy-ajuste').hidden = !avisosHoy.length;
  $('#hoy-ajuste').textContent = avisosHoy.join(' ');
  $('#btn-hoy-detalle').hidden = !ent;
  const abierto = !!ent && ajustes.si('hoyDetalle', false);
  $('#btn-hoy-detalle').textContent = abierto ? 'Ocultar detalles' : 'Ver detalles';
  $('#btn-hoy-detalle').setAttribute('aria-expanded', String(abierto));
  $('#hoy-detalle-caja').hidden = !abierto;
  if (abierto) pintarBloquesEnt(ent, $('#hoy-perfil'), $('#hoy-bloques'), $('#hoy-leyenda'));
  // Sugerencia: volver a lo del día, ajustar o seguir el plan, un jefe en un día libre, afinar el FTP o crear un plan.
  const caja = $('#hoy-sugerencia');
  const [texto, boton] = [caja.querySelector('span'), caja.querySelector('button')];
  let sug = null;
  const h = H.estadoJuegoDe(sesiones, { ftp: ftp(), per: leerPersonaje() });
  const jefe = J.claseDe(leerPersonaje().clase) && h.capitulo?.listo ? h.capitulo : null;
  // El jefe es una prueba a tope: solo se propone si hoy no toca otra cosa del plan y estás fresco.
  const jefeHoy = jefe && ent?.id !== jefe.preparar && !['plan', 'recuperar'].includes(dia?.fuente)
    && !(cuerpo && ['cargado', 'agotado'].includes(cuerpo.clave)) && !(dia?.fuente === 'sugerida' && /suave|dis-mant/.test(dia.id));
  // Un plan armado sin historial se ajusta a lo que remas cuando ya hay 4 sesiones desde que empezó.
  const desdePlan = prog ? sesiones.filter((x) => E.claveDia(x.fecha) >= prog.inicio).length : 0;
  if (prog?.sinHistorial && prog.objetivo && desdePlan >= 4 && dia?.fuente !== 'terminado') {
    sug = { texto: 'Tu plan se armó sin historial. ¿Lo ajusto a lo que remas ahora?', boton: 'Ajustar', accion: () => rehacerPlan(prog, { ajustar: true }) };
  } else if (valorDia && !esDelDia && dia.fuente !== 'hecho') {
    const que = { plan: 'Tu plan dice', recuperar: 'Puedes recuperar', sugerida: 'Te sugiero' }[dia.fuente] || 'Hoy';
    const nombre = dia.ent || estado.baseActual.find((x) => x.id === dia.id)?.nombre || '';
    sug = { texto: `${que}: ${nombre}.${dia.fuente === 'sugerida' ? ` ${dia.motivo}` : ''}`, boton: 'Elegir', accion: () => elegirEnt(valorDia) };
  } else if (dia?.fuente === 'terminado') {
    sug = prog.objetivo
      ? { texto: `Terminaste «${prog.nombre}». ¡Bien hecho! El siguiente sube un poco la carga.`, boton: 'Siguiente plan', accion: () => rehacerPlan(prog) }
      : { texto: `Terminaste «${prog.nombre}». ¡Bien hecho!`, boton: 'Nuevo plan', accion: () => { ajustes.escribir('pestanaPlanes', 'programa'); irA('entrenamientos'); } };
  } else if (jefeHoy) {
    sug = { texto: `${jefe.jefe.nombre} te espera: ${jefe.jefe.texto.charAt(0).toLowerCase()}${jefe.jefe.texto.slice(1)} (+${miles(jefe.xp)} XP).`, boton: 'Enfrentar', accion: () => prepararEntrenamiento(jefe.preparar) };
  } else if (dia?.fuente === 'descanso' && dia.alternativa && !ent) {
    sug = { texto: '¿Quieres remar igual? Que sea suave.', boton: 'Fondo suave', accion: () => elegirEnt(dia.alternativa) };
  } else if (!prog && ajustes.si('ftpEstimado', false) && sesiones.length >= 3 && !sesiones.some((x) => x.pruebaWatts) && ent?.id !== 'base:prueba-ftp') {
    sug = { texto: 'Tu FTP es estimado. Afínalo con la Prueba FTP 20 min.', boton: 'Elegir', accion: () => elegirEnt('base:prueba-ftp') };
  } else if (!prog && sesiones.length >= 3) {
    sug = { texto: 'Con un plan, cada día sabrás qué remar y la carga subirá sola.', boton: 'Crear plan', accion: () => { ajustes.escribir('pestanaPlanes', 'programa'); irA('entrenamientos'); } };
  }
  caja.hidden = !sug;
  if (sug) {
    texto.textContent = sug.texto;
    boton.hidden = !sug.boton;
    boton.textContent = sug.boton || '';
    boton.onclick = sug.accion || null;
  }
}
// Adaptación automática: revisa el plan al abrir la app y después de cada sesión, y lo cambia sin preguntar.
// Lo que cambió se explica en la tarjeta Hoy.
export async function revisarPlanAuto() {
  const prog = leerPrograma();
  if (!prog?.dias?.length || estado.sesion) return;
  const [sesiones, ents] = await Promise.all([H.sesiones(), db.listar('entrenamientos')]);
  const r = A.revisarPlan({ programa: prog, sesiones, entrenamientos: ents, ftp: ftp() });
  if (!r) return;
  for (const e of r.entrenamientos) if (!ents.some((x) => x.nombre === e.nombre)) await db.guardar('entrenamientos', { ...e, dePlan: true });
  guardarPrograma(r.programa);
  if (r.avisos.length) {
    agregarLog(`plan ajustado: ${r.avisos.join(' | ')}`);
    if (r.entrenamientos.length || r.avisos.some((x) => /hoy/.test(x))) { estado.elegirLoDeHoy = true; await llenarSelectorEntrenamientos(); }
    pintarHoy();
  }
}
// FTP con el que se calculan los watts de un entrenamiento del plan: la adaptación lo sube o baja un 3 % cada vez.
export function ftpDelPlan(ent) {
  const f = leerPrograma()?.factor;
  return ent && esDePlan(ent) && f ? Math.round(ftp() * f) : ftp();
}

// Siguiente plan (un poco más de carga) o el mismo ajustado a tu historial, desde hoy.
export async function rehacerPlan(prog, { ajustar = false, dias = null, aviso = '' } = {}) {
  const ctx = await contextoPlan();
  const orden = P.NIVELES_PLAN.map((n) => n.clave);
  const nivel = ajustar ? ctx.nivelSugerido : orden[Math.min(orden.length - 1, orden.indexOf(prog.nivel) + 1)] || 'medio';
  const restantes = Math.ceil((new Date(`${prog.dias.at(-1).fecha}T12:00`) - Date.now()) / (7 * 864e5));
  const semanas = ajustar ? Math.max(2, restantes) : prog.semanas || 6;
  const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: prog.objetivo, nivel, dias: dias || prog.porSemana || 3, semanas, inicio: E.claveDia(Date.now()), ctx });
  await guardarEntrenamientosDePlan(entrenamientos);
  guardarPrograma(programa);
  estado.elegirLoDeHoy = true;
  toast(aviso ? `${aviso}: ${programa.dias.length} sesiones` : ajustar ? `Ajusté tu plan a lo que remas: ${programa.dias.length} sesiones` : `Plan nuevo: ${programa.dias.length} sesiones en ${semanas} semanas`, 4000);
  await llenarSelectorEntrenamientos();
  pintarHoy();
}
// Elige un entrenamiento para la tarjeta «Hoy» (o Remo libre con '').
function elegirEnt(valor) {
  const sel = $('#sel-entrenamiento');
  sel.value = valor;
  ajustes.escribir('eleccionDia', E.claveDia(Date.now()));
  ajustes.escribir('ultimoEnt', sel.value);
  ajustes.escribir('modoEnt', sel.value ? 'objetivo' : 'libre');
  vistaPrevia();
}
