// Programa de entrenamiento: asistente, semanas del plan y lo de hoy.
import * as F from '../fantasma.js';
import * as db from '../db.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import * as P from '../programa.js';
import * as J from '../juego.js';
import * as XC from '../xp-carga.js';
import * as B from '../base.js';
import * as Cap from '../capacidades.js';
import * as A from '../adaptacion.js';
import * as Hab from '../habito.js';
import * as Pf from '../perfil.js';
import * as Ci from '../cita.js';
import { $, ajustes, citaGuardada, escaparHtml, ftp, miles, perfil, previoHoy, toast } from '../ui.js';
import { PREGUNTAS_PREVIAS, ZONAS_DOLOR } from '../pulso.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { estimarFtp, guardarFtp, libreConFantasmas } from './preparar.js';
import { vistaPrevia } from './vivo.js';
import { agregarLog } from '../registro.js';
import {
  calcularDia, llenarSelectorEntrenamientos, pintarBloquesEnt, valorDe,
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
    // Adelantar la próxima sesión de la semana también es hacer lo del plan.
    if (dia?.adelantar && ent?.nombre === dia.adelantar) out.delDia = 'plan';
    // Día de descanso del plan: los talentos de intensidad descansan también.
    if (dia?.fuente === 'descanso' && !out.delDia) out.descanso = true;
    // Una sesión del plan que aún faltaba esta semana (el día que sea): cuenta como del programa.
    const prog = leerPrograma();
    if (prog && ent) out.delPlanSemana = P.semanaFlexible(prog, sesiones, inicio).pendientes.some((d) => d.ent === ent.nombre);
    // La sesión del plan de hoy: la que ofrece la semana flexible, o la sugerida para este día.
    const nombreHoy = (dia && ['plan', 'recuperar'].includes(dia.fuente) && dia.ent) || dia?.adelantar || P.deHoy(prog, inicio)?.ent;
    const plan = nombreHoy && (todos.find((x) => x.nombre === nombreHoy) || estado.baseActual.find((x) => x.nombre === nombreHoy));
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

const DIA_LARGO = (k) => `el ${new Date(`${k}T12:00`).toLocaleDateString('es-MX', { weekday: 'long' })}`;
// La vista Programa (resumen, semanas, calendario) y el asistente viven en programa-vista.js: se cargan al abrirlos.
export async function pintarPrograma() { (await import('./programa-vista.js')).pintarPrograma(); }

// ---------- Asistente de plan por objetivo ----------
// Ritmo actual y distancia habitual, sacados de tu historial (o de tu FTP) para que no tengas que escribirlos.
export async function contextoPlan() {
  const sesiones = await H.sinMuestras();
  let split2k = null;
  // E-1: tu ritmo de 2000 m sale de un 2000 m a tope, no del de dentro de un fondo.
  const pc = E.potenciaCriticaMax(sesiones.slice(-30));
  for (const x of sesiones.slice(-30)) {
    const t = E.nMuestras(x) ? E.marcaATope(x, 2000, pc) : null;
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
    diasSemana: citaGuardada().dias,
    minutosMax: pf.minutosMax || 0,
    split2k: Math.round(split2k), distHabitual: dists[Math.floor(dists.length / 2)] || 4000,
    kcalHabitual: kcals[Math.floor(kcals.length / 2)] || 250, kcalSemana: Math.round(kcalMes / 4),
    nivelSugerido: pf.nivel || (recientes < 4 ? 'inicio' : recientes < 10 ? 'medio' : 'alto'), sinHistorial: sesiones.length < 3,
  };
}
// Al arrancar la app (en orden, desde app.js).
export function arrancarPrograma() {
  $('#antes-remar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-antes]');
    if (b) { responderAntes(b.dataset.antes, b.dataset.valor); return; }
    if (e.target.closest('#antes-cambiar')) { estado.antesAbierto = true; H.sinMuestras().then(pintarAntes); }
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
  // «Solo tengo 15 / 20 min»: la versión corta vale para la próxima sesión con lo elegido; 0 vuelve a la completa.
  $('#hoy-mas').open = ajustes.si('hoyMas', false);
  $('#hoy-mas').addEventListener('toggle', () => ajustes.escribir('hoyMas', $('#hoy-mas').open ? '1' : ''));
  $('#hoy-corta').addEventListener('click', (e) => {
    const b = e.target.closest('[data-corta]');
    if (!b) return;
    const min = Number(b.dataset.corta);
    estado.versionCorta = min ? { valor: $('#sel-entrenamiento').value, min } : null;
    vistaPrevia();
  });
}

// Borra los entrenamientos que dejó un plan anterior y que el de ahora ya no usa (tus sesiones no se tocan).
export async function limpiarSobrantesDePlan() {
  const sobran = A.sobrantesDePlan(leerPrograma(), await db.listar('entrenamientos'));
  for (const e of sobran) await db.borrar('entrenamientos', e.id);
  if (sobran.length) agregarLog(`limpieza: ${sobran.length} entrenamientos de planes anteriores`);
  return sobran.length;
}

async function pintarRecomendacion() {
  const r = E.recomendacion(await H.sinMuestras(), ftp());
  const el = $('#recomendacion');
  // «Vas equilibrado» no pide nada: solo se muestra cuando hay algo que cambiar hoy.
  el.hidden = !r || r.tipo === 'normal';
  if (r) { el.textContent = r.texto; el.className = `recomendacion ${r.tipo}`; }
}

// ¿La sesión es el entrenamiento que tocaba hoy en el programa? (para los talentos del samurái)
// Los días del plan son una sugerencia: cuenta una sesión del plan que aún faltaba en su semana (lo mira
// contextoXp al empezar); sin ese dato, la sesión del plan de su semana.
export function delProgramaHoy(s) {
  if (s.xpCtx && 'delPlanSemana' in s.xpCtx) return s.xpCtx.delPlanSemana || undefined;
  return P.delPlanEnSuSemana(leerPrograma(), s) || undefined;
}

// Tarjeta «Hoy»: lo que vas a remar al pulsar Empezar, y una sugerencia si hay algo mejor que hacer.
let hoyTurno = 0;
export async function pintarHoy(ent = estado.entrenamientoPrevio) {
  const turno = ++hoyTurno;
  const [sesiones, todos] = await Promise.all([H.sinMuestras(), db.listar('entrenamientos')]);
  if (turno !== hoyTurno) return;
  const prog = leerPrograma();
  const dia = await calcularDia(sesiones, todos);
  if (turno !== hoyTurno) return;
  // La sesión del día ya tiene en cuenta tu frescura: la recomendación general solo sale sin ella.
  if (dia) $('#recomendacion').hidden = true; else pintarRecomendacion();
  const valorDia = dia ? (dia.id || valorDe(dia.ent, todos)) : null;
  const esDelDia = !!(ent && valorDia && String(ent.id) === valorDia);
  const hoyK = E.claveDia(Date.now());
  // Lo de hoy ya está hecho: si la sesión del plan seguía elegida sola (no a mano), Empezar pasa a Remo libre
  // para no invitar a repetirla, y la tarjeta se cierra con la próxima.
  if (dia?.fuente === 'hecho' && esDelDia && ajustes.leer('eleccionDia', '') !== hoyK) { elegirEnt(''); return; }
  const cerrada = !!prog && !ent && (dia?.fuente === 'hecho' || (dia?.fuente === 'descanso' && sesiones.some((x) => E.claveDia(x.fecha) === hoyK)));
  $('#preparar').classList.toggle('hecho-hoy', cerrada);
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
  // La primera semana guiada (etapa 20): cuántas llevas de las de tus primeros 7 días.
  const s1 = P.primeraSemana(prog, sesiones);
  $('#hoy-semana1').hidden = !s1;
  if (s1) {
    const puntos = Array.from({ length: s1.total }, (_, i) => `<i class="${i < s1.hechas ? 'hecho' : ''}"></i>`).join('');
    $('#hoy-semana1').innerHTML = `<span>${s1.completa ? `Primera semana completa · ${s1.total} de ${s1.total} ✓` : `Tu primera semana · ${s1.actual} de ${s1.total}`}</span><span class="s1-puntos" aria-hidden="true">${puntos}</span>`;
  }
  // Lo que la adaptación cambió hoy, y si tus rangos del plan van más bajos o más altos.
  const avisosHoy = (prog?.avisos || []).filter((x) => x.dia === E.claveDia(Date.now())).map((x) => x.texto);
  const factor = prog?.factor && prog.factor !== 1 ? Math.round((prog.factor - 1) * 100) : 0;
  if (factor && esDelDia && dia.ent) avisosHoy.push(`Tus rangos del plan van un ${Math.abs(factor)} % más ${factor > 0 ? 'altos' : 'bajos'} según cómo te fue.`);
  // Semáforo de fatiga en una línea, para no apretar de más.
  // Sin FTP no hay carga que medir, pero lo que respondiste antes de remar sigue contando.
  const cuerpo = Cap.estadoCuerpo(ftp() ? sesiones : [], ftp(), Date.now(), { previo: previoHoy() });
  // Fuera del «Más» solo si vienes cargado o agotado: es el aviso antes de empezar (UX2-4).
  const avisoCuerpo = !!cuerpo && ['cargado', 'agotado'].includes(cuerpo.clave);
  $('#hoy-cuerpo').hidden = !avisoCuerpo;
  if (cuerpo) {
    $('#hoy-cuerpo').dataset.estado = cuerpo.clave;
    const motivo = cuerpo.motivos?.[0];
    $('#hoy-cuerpo').textContent = `${cuerpo.nombre} · ${motivo || (cuerpo.horas ? Cap.textoRecuperacion(cuerpo.horas).toLowerCase() : 'puedes entrenar')}`;
  }
  $('#hoy-ajuste').hidden = !avisosHoy.length;
  $('#hoy-ajuste').textContent = avisosHoy.join(' ');
  // En ámbar si el cambio de hoy vino de cómo te encuentras (atención, no error).
  $('#hoy-ajuste').classList.toggle('atencion', !!cuerpo?.motivos?.length);
  pintarAntes(sesiones);
  // Tu próxima cita (etapa 13): el día y la hora en que quedaste contigo.
  const cg = citaGuardada();
  const cita = Ci.proximaCita({ programa: prog, dias: Ci.diasDeCita(cg.dias, perfil().dias), hora: cg.hora, movida: cg.movida, hechoHoy: sesiones.some((x) => E.claveDia(x.fecha) === hoyK) });
  $('#hoy-cita').hidden = !cita || cerrada;
  $('#hoy-cita').textContent = cita ? `Tu próxima cita: ${Ci.textoCita(cita)}${cita.ent && cita.fecha !== hoyK ? ` · ${cita.ent}` : ''}` : '';
  if (cerrada) {
    // «Hecho ✓ · Próxima: el sábado, 19:00», con la sesión debajo. El motivo y la cita dirían lo mismo otra vez.
    const fl = P.semanaFlexible(prog, sesiones);
    const prox = fl.pendientes[0] || fl.futuras[0] || null;
    const cuando = cita && cita.fecha !== hoyK ? Ci.textoCita(cita) : prox ? (fl.pendientes[0] ? 'esta semana' : DIA_LARGO(prox.fecha)) : '';
    const proxEnt = cita?.ent && cita.fecha !== hoyK ? cita.ent : prox?.ent;
    $('#hoy-etq').textContent = 'Hoy';
    $('#hoy-nombre').textContent = 'Hecho ✓';
    const proxima = cuando ? `Próxima: ${cuando}${proxEnt ? ` · ${proxEnt}` : ''}.` : 'Era la última sesión del plan.';
    $('#hoy-resumen').textContent = `${proxima} Si quieres más, Empezar abre un Remo libre suave.`;
    $('#hoy-porque').hidden = true;
  }
  // Tu meta a la vista (etapa 18): con un plan hacia una meta, tu tiempo estimado hoy frente a la meta.
  const meta = prog?.meta;
  const est = meta ? E.estimar(sesiones, meta.distancia, { peso: perfil().peso }) : null;
  $('#hoy-meta').hidden = !est;
  if (est) {
    const d = meta.distancia >= 1000 ? `${meta.distancia / 1000} km` : `${meta.distancia} m`;
    const falta = est.t - meta.segundos;
    $('#hoy-meta').textContent = `Tus ${d} estimados: ${Ent.formatoMmss(est.t)} → meta ${Ent.formatoMmss(meta.segundos)}${falta > 0 ? ` (te faltan ${falta} s)` : ' (¡ya la tienes a tu alcance!)'}`;
  }
  // «Solo tengo 15 / 20 min» (etapa 14): con la sesión del día elegida, una versión corta que conserva el estímulo.
  const corta = $('#hoy-corta');
  const vc = estado.versionCorta && String(estado.versionCorta.valor) === String(valorDia) ? estado.versionCorta : null;
  if (vc && ent?.versionCorta) {
    corta.innerHTML = `<span>Versión de ${vc.min} min: ${escaparHtml(ent.resumenCorta)}. Cuenta como media sesión del plan.</span><button type="button" class="enlace-boton" data-corta="0">Sesión completa</button>`;
  } else {
    const base = esDelDia && ent && !ent.versionCorta ? ent : null;
    const opciones = base ? P.VERSION_CORTA_MIN.filter((m) => P.versionCorta(base, m)) : [];
    corta.innerHTML = opciones.length ? `<span>¿Poco tiempo?</span>${opciones.map((m) => `<button type="button" class="boton chico secundario" data-corta="${m}">Solo tengo ${m} min</button>`).join('')}` : '';
  }
  corta.hidden = !corta.innerHTML;
  // Lo que guarda el «Más», en una línea: así se sabe qué hay sin abrirlo.
  const enMas = [cuerpo && !avisoCuerpo ? cuerpo.nombre : '', !corta.hidden && !vc ? '¿poco tiempo?' : '', !$('#antes-remar').hidden && !previoHoy()?.sueno ? 'antes de remar' : '', ent ? 'XP y detalles' : 'XP'].filter(Boolean);
  $('#hoy-mas-resumen').textContent = enMas.join(' · ');
  // Con la versión corta elegida, el «Más» se abre: es lo que vas a remar.
  if (vc) $('#hoy-mas').open = true;
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
  // El FTP también baja: repetir la prueba cada 6–8 semanas, y bajarlo si varias sesiones duras se quedan cortas.
  const revFtp = ftp() ? E.revisarFtp(sesiones, ftp(), Date.now(), { revisado: ajustes.num('ftpRevisado', 0) }) : null;
  const revisado = () => ajustes.escribir('ftpRevisado', String(Date.now()));
  const usarFtp = (v) => { guardarFtp(v, true); revisado(); toast(`FTP: ${v} W. Tus zonas se ajustan solas`); pintarHoy(); };
  const noFtp = () => { revisado(); pintarHoy(); };
  // Un plan armado sin historial se ajusta a lo que remas cuando ya hay 4 sesiones desde que empezó.
  const hoyClave = E.claveDia(Date.now());
  let riesgo = null;
  if (!estado.sesion && !sesiones.some((x) => E.claveDia(x.fecha) === hoyClave)) {
    let previo = null;
    try { previo = JSON.parse(ajustes.leer('riesgoAbandono', 'null')); } catch { /* sin aviso previo */ }
    riesgo = Hab.mostrarRiesgo(previo, hoyClave) ? Hab.riesgoAbandono(sesiones) : null;
    if (riesgo && previo?.dia !== hoyClave) ajustes.escribir('riesgoAbandono', JSON.stringify({ dia: hoyClave }));
  }
  const desdePlan = prog ? sesiones.filter((x) => E.claveDia(x.fecha) >= prog.inicio).length : 0;
  if (prog?.proponerRehacer === E.claveDia(Date.now()) && prog.objetivo) {
    // Regreso tras 3 semanas o más (etapa 14): rehacer el plan desde hoy, a tu nivel de ahora.
    sug = { texto: A.textoRegreso('largo', prog.regreso?.dias ?? 21), boton: 'Rehacer plan', accion: () => rehacerPlan(prog, { ajustar: true, aviso: 'Rehice tu plan desde hoy' }) };
  } else if (prog?.sinHistorial && prog.objetivo && desdePlan >= 4 && dia?.fuente !== 'terminado') {
    sug = { texto: 'Tu plan se armó sin historial. ¿Lo ajusto a lo que remas ahora?', boton: 'Ajustar', accion: () => rehacerPlan(prog, { ajustar: true }) };
  } else if (riesgo) {
    // Riesgo de abandono (etapa 30): una sola vez, con una salida fácil y sin reproches.
    const n = prog?.objetivo ? prog.porSemana || 3 : 0;
    const fin = () => { ajustes.escribir('riesgoAbandono', JSON.stringify({ dia: hoyClave, respondido: true })); };
    sug = n >= 3
      ? { texto: Hab.textoRiesgo(riesgo), boton: `Bajar a ${n - 1} días`, accion: () => { fin(); rehacerPlan(prog, { ajustar: true, dias: n - 1, aviso: `Tu plan ahora es de ${n - 1} días por semana` }); }, no: () => { fin(); pintarHoy(); } }
      : { texto: `${Hab.textoRiesgo(riesgo)} Una sesión suave y corta también cuenta.`, boton: 'Fondo suave', accion: () => { fin(); elegirEnt('base:dis-suave'); pintarHoy(); }, no: () => { fin(); pintarHoy(); } };
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
  } else if (revFtp?.bajar) {
    sug = { texto: `Tus últimas ${revFtp.bajar.cortas} sesiones fuertes se quedaron cortas. ¿Bajo tu FTP a ${revFtp.bajar.ftp} W? Tus zonas se ajustan solas.`, boton: 'Bajar', accion: () => { guardarFtp(revFtp.bajar.ftp, true); toast(`FTP: ${revFtp.bajar.ftp} W`); pintarHoy(); } };
  } else if (revFtp?.subir) {
    sug = { texto: `Tus mejores sesiones recientes dan un FTP de ${revFtp.subir.ftp} W (ahora ${ftp()} W). ¿Lo subo?`, boton: `Subir a ${revFtp.subir.ftp} W`, accion: () => usarFtp(revFtp.subir.ftp), no: noFtp };
  } else if (revFtp?.bajarCp) {
    sug = { texto: `Tu potencia crítica bajó un ${revFtp.bajarCp.caida} % en las últimas 6 semanas. ¿Bajo tu FTP a ${revFtp.bajarCp.ftp} W para que las sesiones vuelvan a salir?`, boton: 'Bajar', accion: () => usarFtp(revFtp.bajarCp.ftp), no: noFtp };
  } else if (revFtp?.bajarSinDuras && !(revFtp.repetir && ent?.id !== 'base:prueba-ftp')) {
    sug = { texto: `Llevas ${revFtp.bajarSinDuras.dias} días sin una sesión dura: tu FTP real puede haber bajado. ¿Lo bajo a ${revFtp.bajarSinDuras.ftp} W, o prefieres hacer la prueba?`, boton: 'Bajar', accion: () => usarFtp(revFtp.bajarSinDuras.ftp), no: noFtp };
  } else if (revFtp?.repetir && ent?.id !== 'base:prueba-ftp' && !['plan', 'recuperar'].includes(dia?.fuente)) {
    sug = { texto: `Tu última prueba FTP fue hace ${Math.round(revFtp.repetir / 7)} semanas: repítela para que tus zonas sigan siendo las tuyas.`, boton: 'Elegir', accion: () => elegirEnt('base:prueba-ftp') };
  } else if (dia?.fuente === 'descanso' && dia.adelantar && valorDe(dia.adelantar, todos) && ent?.nombre !== dia.adelantar) {
    sug = { texto: `Vas al día. Si te apetece, adelanta «${dia.adelantar}».`, boton: 'Adelantar', accion: () => elegirEnt(valorDe(dia.adelantar, todos)) };
  } else if (dia?.fuente === 'descanso' && dia.alternativa && !ent) {
    sug = { texto: '¿Quieres remar igual? Que sea suave.', boton: 'Fondo suave', accion: () => elegirEnt(dia.alternativa) };
  } else if (!prog && ajustes.si('ftpEstimado', false) && sesiones.length >= 3 && !sesiones.some((x) => x.pruebaWatts) && ent?.id !== 'base:prueba-ftp') {
    sug = { texto: 'Tu FTP es estimado. Afínalo con la Prueba FTP 20 min.', boton: 'Elegir', accion: () => elegirEnt('base:prueba-ftp') };
  } else if (!prog && sesiones.length >= 3) {
    sug = { texto: 'Con un plan, cada día sabrás qué remar y la carga subirá sola.', boton: 'Crear plan', accion: () => { ajustes.escribir('pestanaPlanes', 'programa'); irA('entrenamientos'); } };
  }
  caja.hidden = !sug;
  const no = caja.querySelector('.sug-no');
  no.hidden = !sug?.no;
  no.onclick = sug?.no || null;
  if (sug) {
    texto.textContent = sug.texto;
    boton.hidden = !sug.boton;
    boton.textContent = sug.boton || '';
    boton.onclick = sug.accion || null;
  }
}
// ---------- Antes de remar: sueño y dolor (opcional) ----------
// Solo antes de la primera sesión del día y nunca durante una. Responder recalcula tu estado y la sesión de hoy.
function pintarAntes(sesiones) {
  const hoy = E.claveDia(Date.now());
  const caja = $('#antes-remar');
  const yaRemo = sesiones.some((x) => E.claveDia(x.fecha) === hoy);
  caja.hidden = !!estado.sesion || yaRemo;
  if (caja.hidden) return;
  const r = previoHoy() || {};
  const conDolor = r.dolor === 'leve' || r.dolor === 'si';
  const completo = r.sueno && r.dolor && (!conDolor || r.zona) && !estado.antesAbierto;
  $('#antes-preguntas').hidden = completo;
  $('#antes-plegado').hidden = !completo;
  if (completo) {
    const sueno = { bien: 'Dormiste bien', regular: 'Dormiste regular', mal: 'Dormiste mal' }[r.sueno];
    const zona = conDolor && r.zona !== 'otra' ? ` en ${(ZONAS_DOLOR.find(([k]) => k === r.zona)?.[1] || '').toLowerCase()}` : '';
    const dolor = { no: 'sin dolor', leve: 'molestia leve', si: 'con dolor o malestar' }[r.dolor] + zona;
    $('#antes-plegado span').textContent = `${sueno} · ${dolor}`;
    return;
  }
  // Con dolor o molestia, también dónde (etapa 27): cambia el consejo y, si se repite, la semana.
  const preguntas = Object.entries(PREGUNTAS_PREVIAS);
  if (conDolor) preguntas.push(['zona', { texto: '¿Dónde?', opciones: ZONAS_DOLOR }]);
  $('#antes-preguntas').innerHTML = preguntas.map(([clave, q]) => `<div class="antes-pregunta" role="group" aria-label="${q.texto}">
      <span>${q.texto}</span><div class="antes-chips">${q.opciones.map(([v, t]) => `<button type="button" class="chip" data-antes="${clave}" data-valor="${v}" aria-pressed="${r[clave] === v}">${t}</button>`).join('')}</div></div>`).join('');
}
async function responderAntes(clave, valor) {
  const hoy = E.claveDia(Date.now());
  const { dolores: _, ...antes } = previoHoy() || {};
  const r = { ...antes, dia: hoy, [clave]: valor };
  if (r.dolor === 'no') delete r.zona;
  ajustes.escribir('antesDeRemar', JSON.stringify(r));
  if (r.dolor) {
    // Registro de las últimas 4 semanas, una entrada por día: así una molestia que se repite ajusta la semana.
    let dolores = [];
    try { dolores = JSON.parse(ajustes.leer('dolores', '[]')) || []; } catch { /* vacío */ }
    const desde = E.claveDia(Date.now() - 28 * 864e5);
    dolores = dolores.filter((d) => d.dia !== hoy && d.dia > desde);
    dolores.push({ dia: hoy, dolor: r.dolor, ...(r.zona ? { zona: r.zona } : {}) });
    ajustes.escribir('dolores', JSON.stringify(dolores));
  }
  if (r.sueno && r.dolor && (r.dolor === 'no' || r.zona)) estado.antesAbierto = false;
  await revisarPlanAuto();
  pintarHoy();
}

// Adaptación automática: revisa el plan al abrir la app y después de cada sesión, y lo cambia sin preguntar.
// Lo que cambió se explica en la tarjeta Hoy.
export async function revisarPlanAuto() {
  const prog = leerPrograma();
  if (!prog?.dias?.length || estado.sesion) return;
  const [sesiones, ents] = await Promise.all([H.sinMuestras(), db.listar('entrenamientos')]);
  const cuerpo = Cap.estadoCuerpo(ftp() ? sesiones : [], ftp(), Date.now(), { previo: previoHoy() });
  const r = A.revisarPlan({ programa: prog, sesiones, entrenamientos: ents, ftp: ftp(), cuerpo });
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
