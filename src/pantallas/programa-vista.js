// Vista Programa de Planes: el plan activo (resumen, semanas, calendario) o el asistente para crear uno. Sale de
// programa.js (ronda 2, etapa 10) para no pesar en la primera carga.
import * as db from '../db.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import * as P from '../programa.js';
import { confeti } from '../efectos.js';
import * as B from '../base.js';
import { $, COLOR_ZONA, citaGuardada, escaparHtml, ico, miles, perfil, toast } from '../ui.js';
import { PREGUNTAS_PREVIAS, ZONAS_DOLOR } from '../pulso.js';
import { estado } from '../estado.js';
import { asistente, leerMmss } from './preparar.js';
import {
  calcularDia, llenarSelectorEntrenamientos, obtenerEnt, pintarEntrenamientos, semanaDelPlan, usarEnt, valorDe,
} from './planes.js';
import { leerPersonaje, prepararEntrenamiento } from './heroe.js';

import { contextoPlan, guardarEntrenamientosDePlan, guardarPrograma, leerPrograma, limpiarSobrantesDePlan, pintarHoy } from './programa.js';

// Los botones del asistente y del plan se conectan una sola vez, la primera vez que se pinta la vista.
let escuchando = false;
function escuchar() {
  if (escuchando) return;
  escuchando = true;
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
  $('#pm-semanas').addEventListener('change', pintarPlanMeta);

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
}

export async function pintarPrograma() {
  escuchar();
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
  const sesiones = await H.sinMuestras();
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
  // Los días son una sugerencia: cuenta hacer las sesiones de la semana, el día que te venga bien.
  const ESTADO = { hecho: 'Hecha', perdido: 'No se hizo', hoy: 'Sugerida hoy', pendiente: 'Pendiente' };
  const diaCorto = (k) => new Date(`${k}T12:00`).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
  const buscarEnt = (n) => todos.find((e) => e.nombre === n) || estado.baseActual.find((e) => e.nombre === n);
  $('#semana-plan').innerHTML = semana.length ? semana.map((d) => {
    const e = buscarEnt(d.ent);
    const v = valorDe(d.ent, todos);
    const tipo = /^Prueba/.test(d.ent) ? 'Prueba' : e && P.esDura(e) ? 'Dura' : 'Suave';
    return `<li data-estado="${d.estado}"><span class="sp-dia">${d.hechaEl ? diaCorto(d.hechaEl) : d.diaCorto}</span><span class="sp-info"><b>${escaparHtml(d.ent)}</b><small>${tipo}${e ? ` · ${escaparHtml(B.resumenEnt(e).split(' · ')[0])}` : ''} · ${d.atrasada ? 'Pendiente, cuando puedas' : ESTADO[d.estado]}${d.estado === 'hecho' ? ' ✓' : ''}</small></span>${
      v && d.estado !== 'hecho' ? `<button type="button" class="boton chico" data-entrenar="${v}">Entrenar</button>` : ''}</li>`;
  }).join('') : '';
  const quedan = P.semanaFlexible(prog, sesiones);
  // Un plan que arranca la semana que viene no dice «no hay sesiones»: la tarjeta Hoy ya adelanta la primera.
  if (!semana.length) {
    const prox = quedan.futuras[0];
    $('#semana-plan').innerHTML = `<li class="vacio">${prox ? `Tu semana 1 empieza el ${diaPlan(prox.fecha)}.` : 'Esta semana no hay sesiones en tu plan.'}</li>`;
  }
  $('#semana-plan-nota').hidden = !semana.length;
  $('#semana-plan-nota').textContent = quedan.pendientes.length
    ? `Hechas ${semana.length - quedan.pendientes.length} de ${semana.length}. Los días son una sugerencia: haz las que faltan cuando te venga bien antes del domingo (te ${quedan.diasQuedan === 1 ? 'queda 1 día' : `quedan ${quedan.diasQuedan} días`}).`
    : `Semana completa: ${semana.length} de ${semana.length} ✓`;
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
  // La próxima: la primera que falta de la semana (los días son una sugerencia) o la primera de la siguiente.
  const fl = P.semanaFlexible(prog, sesiones);
  const prox = fl.pendientes[0] || fl.futuras[0] || null;
  const ent = dia?.ent ? buscar(dia.ent) : null;
  const mostrado = ent || (dia?.fuente === 'descanso' && prox ? buscar(prox.ent) : null);
  $('#plan-hoy-nombre').textContent = dia?.ent || (dia?.fuente === 'terminado' ? prog.nombre : 'Descanso');
  $('#plan-hoy-resumen').textContent = ent ? B.resumenEnt(ent)
    : dia?.fuente === 'descanso' && prox ? `Próxima: ${prox.ent} · ${fl.pendientes[0] ? 'esta semana, cuando quieras' : diaPlan(prox.fecha)}` : '';
  $('#plan-hoy-tira').innerHTML = tiraBloques(mostrado);
  $('#plan-hoy-tira').classList.toggle('apagada', !ent);
  $('#plan-hoy-porque').textContent = dia?.motivo || '';
  $('#plan-hoy-porque').hidden = !dia?.motivo;
  const v = ent && dia.fuente !== 'hecho' ? valorDe(dia.ent, todos) : null;
  // Vas al día: se puede adelantar la próxima de la semana en vez de descansar.
  const vAdelantar = !v && dia?.adelantar ? valorDe(dia.adelantar, todos) : null;
  const btn = $('#plan-hoy-btn');
  btn.hidden = !v && dia?.fuente !== 'descanso';
  btn.textContent = v ? 'Entrenar' : vAdelantar ? 'Adelantarla' : 'Remar suave igual';
  btn.classList.toggle('primario', !!v);
  btn.onclick = async () => { const e = await obtenerEnt(v || vAdelantar || dia.alternativa || 'base:dis-suave'); if (e) usarEnt(e); };
}

// Programa › Cómo sube tu plan y Lo que sigue: el esfuerzo de cada semana y las sesiones de las que vienen.
function pintarPlanFuturo(prog, sesiones, buscar) {
  const semanas = P.semanasPlan(prog, sesiones, buscar);
  const max = Math.max(1, ...semanas.map((s) => s.esfuerzo));
  const curva = $('#plan-curva');
  curva.style.setProperty('--n', semanas.length);
  curva.setAttribute('aria-label', 'Esfuerzo por semana: toca una para ver sus sesiones');
  curva.innerHTML = semanas.map((s) => `<button type="button" class="pc-semana${s.actual ? ' actual' : s.pasada ? ' pasada' : ''}${s.descarga ? ' descarga' : ''}" data-semana="${s.n}" title="Semana ${s.n}: ${minTexto(s.minutos)}">
      <span class="pc-min">${s.minutos >= 60 ? `${Math.round(s.minutos / 6) / 10}`.replace('.', ',') + ' h' : `${s.minutos}′`}</span>
      <span class="pc-barra" style="height:${Math.max(6, Math.round((s.esfuerzo / max) * 100))}%">${s.prueba ? '<b class="pc-prueba" aria-hidden="true">★</b>' : ''}</span>
      <span class="pc-n">${s.actual ? 'Hoy' : `S${s.n}`}</span><span class="solo-lector">: semana ${s.n}, ${minTexto(s.minutos)}${s.descarga ? ', descarga' : ''}${s.prueba ? ', con prueba' : ''}</span></button>`).join('');
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
    if (det) { $('#prog-curva').open = true; det.open = true; det.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (!(actual && Number(n) === actual.n)) $('#prog-calendario').open = true;
    (actual && Number(n) === actual.n ? $('#semana-plan-titulo') : $('#calendario')).scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  $('#as-nivel').innerHTML = P.NIVELES_PLAN.map((n) => `<button type="button" role="radio" class="chip" data-v="${n.clave}" aria-checked="${asistente.nivel === n.clave}">${n.nombre}</button>`).join('');
  $('#as-dias').innerHTML = [1, 2, 3, 4, 5].map((d) => `<button type="button" role="radio" class="chip" data-v="${d}" aria-checked="${asistente.dias === d}">${d} ${d === 1 ? 'día' : 'días'}</button>`).join('');
  $('#as-semanas').innerHTML = [4, 6, 8, 12].map((d) => `<button type="button" role="radio" class="chip" data-v="${d}" aria-checked="${asistente.semanas === d}">${d} semanas</button>`).join('');
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

// Plan automático: sugiere la meta desde tu marca reciente (o tu predicción más fiable) y lo que puedes mejorar
// según cuánto remas y las semanas del plan.
async function pintarPlanMeta() {
  const dist = Number($('#pm-dist').value);
  const semanas = Math.round(Number($('#pm-semanas').value)) || 8;
  if (!$('#pm-inicio').value) $('#pm-inicio').value = E.claveDia(Date.now());
  const sug = P.sugerirMeta(await H.sinMuestras(), dist, semanas);
  const pct = sug ? String(Math.round(sug.mejora * 1000) / 10).replace('.', ',') : '';
  $('#pm-info').textContent = sug
    ? `${sug.real ? 'Tu mejor' : sug.modelo ? 'Tu predicción (con tu curva de potencia) para' : `Tu predicción (desde tus ${miles(sug.desde)} m) para`} ${miles(dist)} m: ${Ent.formatoMmss(sug.t)}. Una meta realista en ${semanas} semanas: ${Ent.formatoMmss(sug.meta)} (un ${pct} % mejor${sug.nivel === 'inicio' ? ', al empezar se mejora rápido' : ''}).`
    : 'Aún no hay sesiones para sugerirte una meta: elige una que te rete.';
  $('#pm-tiempo').placeholder = sug ? Ent.formatoMmss(sug.meta) : '8:00';
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
  const nivel = P.nivelRemero(await H.sinMuestras());
  const { programa, entrenamientos } = P.planPorMeta({ distancia, segundos, semanas, inicio, nivel, dias: perfil().dias, ctx: { diasSemana: citaGuardada().dias } });
  await guardarEntrenamientosDePlan(entrenamientos);
  guardarPrograma(programa);
  estado.elegirLoDeHoy = true;
  toast(`Plan creado: ${programa.dias.length} sesiones en ${semanas} semanas`);
  pintarEntrenamientos();
  llenarSelectorEntrenamientos();
  pintarHoy();
}
