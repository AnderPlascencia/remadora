// Guardar la sesión: la copia de la sesión en curso (para recuperarla si Android cierra la app), guardar la que
// terminó (historial, XP, récords, misiones y la tarjeta del fin) y el pulso de recuperación a los 60 s.
import { formatoTiempo } from '../protocolo.js';
import * as F from '../fantasma.js';
import * as db from '../db.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import { hablar } from '../voz.js';
import * as P from '../programa.js';
import * as V from '../ventajas.js';
import { VERSION } from '../version.js';
import { $, fcRef, ftp, miles, pitido, toast } from '../ui.js';
import { estado } from '../estado.js';
import { actualizarFcMax } from './ajustes.js';
import { fcMax5s } from '../pulso.js';
import { ftpAutomatico } from './preparar.js';
import { agregarLog, guardarRegistroSesion } from '../registro.js';
import { resumenDiagnostico } from '../diagnostico.js';
import { guardarPersonaje, inventario, pintarLineaNivel } from './heroe.js';
import { delProgramaHoy, pintarHoy, revisarPlanAuto } from './programa.js';
import { decirResumenJuego } from './sesion-voz.js';
import * as XC from '../xp-carga.js';
import { actual, fcFresca, remadora, sesionEnOtraPestana } from './sesion.js';

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
    pruebaFtp: s.pruebaFtp, versionCorta: s.versionCorta || null, plan: s.plan, estadoAv: s.estadoAv, pausas: s.pausas, fin: s.fin ?? null, guardada: Date.now(), xpCtx: s.xpCtx ?? null,
    ent: ent ? { nombre: ent.nombre, bloques: ent.bloques, objetivo: ent.objetivo, ...(ent.versionCorta ? { versionCorta: ent.versionCorta } : {}) } : null,
  };
}
export async function guardarSesionEnCurso(s = estado.sesion, ent = estado.entrenamientoActivo) {
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
export async function borrarSesionEnCurso() {
  try { localStorage.removeItem(CLAVE_EN_CURSO); } catch { /* nada */ }
  try { await db.borrarEstado('enCurso'); } catch (e) { agregarLog(`no se pudo borrar la copia de la sesión: ${e?.name || e}`); }
}
export async function leerSesionEnCurso() {
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
  if (await sesionEnOtraPestana()) { toast('Hay una sesión en curso en otra pestaña de la app'); return; }
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
export async function yaGuardada(s) {
  try { return (await H.sinMuestras()).some((x) => x.fecha === s.inicio); } catch { return false; }
}
// Lo que ya se había remado, para seguir en la misma sesión. El tiempo con la app cerrada queda como pausa:
// la que estaba abierta sigue abierta, o se abre una desde la última copia, y se cierra al volver a remar.
export function estadoReanudado(c) {
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
export async function guardarSesionTerminada(s, ent, { recuperada = false } = {}) {
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
    ...(s.versionCorta ? { versionCorta: s.versionCorta } : {}),
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
  // Cómo fue la app en esta sesión (latencia del dato, cuadros por segundo, Bluetooth): una recuperada no lo tiene.
  const diagnostico = recuperada ? null : resumenDiagnostico(remadora.estadisticas);
  if (diagnostico) registro.diagnostico = diagnostico;
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
    // Campo propio (ronda 2, E1): antes pisaba `intensidad`, que es el factor de intensidad (IF) de la sesión.
    if (V.usoIntensidad(s.ventaja)) registro.usoIntensidad = true;
    registro.rival = resumen(s.rival);
    if (s.rivales.length > 1) registro.rivales = s.rivales.map(resumen);
    // Terminar antes de completar el entrenamiento no gana la carrera: se guarda la diferencia, pero no cuenta como victoria.
    // En Remo libre no hay meta: cuenta si remaste al menos 5 minutos.
    if (ent ? s.tiempoMeta == null : s.t < 300) registro.carreraSinTerminar = true;
  }
  if (s.referencias?.length) {
    // clave (ronda 2, R2-6): qué referencia era, para premiar ganarle a tu yo pasado y al reto. En un reto a distancia
    // completo también se guarda por cuántos segundos llegaste antes (negativo: después).
    const metaDist = ent?.objetivo?.metrica === 'distancia' && s.tiempoMeta != null ? ent.objetivo.valor : null;
    registro.referencias = s.referencias.map((r) => {
      const ref = { nombre: r.nombre, clave: r.clave ?? null, fecha: r.fecha ?? null, diferencia: Math.round(s.dist - E.distanciaEn(r.muestras, s.t)) };
      const tr = r.clave === 'reto' && metaDist ? F.tiempoA(r, metaDist) : null;
      if (tr != null) ref.segundos = Math.round(tr - s.tiempoMeta);
      return ref;
    });
  }
  registro.marcas = E.marcasDeSesion(registro);
  // Primero se guarda, y solo después se lee el historial (récords, resumen, héroe): si leer cientos de sesiones con
  // sus muestras falla o se queda sin memoria, la sesión ya está a salvo.
  try {
    const id = await H.guardar(registro);
    if (registro.id == null && id != null) registro.id = id;
  } catch (e) {
    // La copia de la sesión en curso se queda: se puede volver a intentar ahora o al abrir la app.
    agregarLog(`no se pudo guardar la sesión: ${e?.name || ''} ${e?.message || e}`);
    toast('No se pudo guardar la sesión. Sigue a salvo: vuelve a intentarlo.', 6000, 'seguridad');
    ofrecerRecuperar();
    return false;
  }
  await borrarSesionEnCurso();
  if (!recuperada) guardarRegistroSesion(registro.fecha, registro.diagnostico);
  // Ronda 2 (QA-F4): el detalle de la sesión se carga aquí, con la sesión ya guardada (no va en la primera
  // carga). Sin conexión sale de la caché del service worker, como el resto.
  const { abrirSesion, fcParaEsfuerzo } = await import('./detalle.js');
  let previas = null;
  try {
    // Sin muestras: el resumen, los récords y el juego leen el resumen guardado de cada sesión (etapa 23).
    previas = (await H.sinMuestras()).filter((x) => x.id !== registro.id);
  } catch (e) {
    agregarLog(`sesión guardada, pero no se pudo leer el historial: ${e?.name || ''} ${e?.message || e}`);
  }
  if (registro.ventajaUsada) {
    const inv = inventario();
    guardarPersonaje({ inventario: { ...inv, [registro.ventajaUsada]: Math.max(0, (inv[registro.ventajaUsada] || 0) - 1) } });
  }
  pitido(660, 0.2);
  agregarLog(`sesión guardada: ${formatoTiempo(registro.duracion)}, ${registro.distancia} m`);
  const ftpAuto = ftpAutomatico(registro);
  // Con pulso, el esfuerzo según el pulso se guarda aparte (rpePulso) como sugerencia: el tuyo (rpe) lo marcas en el
  // resumen, y es el que usa la adaptación del plan.
  const porPulso = E.esfuerzoPorPulso(registro.muestras, { ...fcRef(), max: fcParaEsfuerzo() });
  if (porPulso) {
    Object.assign(registro, { rpePulso: porPulso.rpe, rpePct: porPulso.pct, trimp: porPulso.trimp });
    await H.actualizar(registro.id, { rpePulso: registro.rpePulso, rpePct: registro.rpePct, trimp: registro.trimp });
  }
  if (!previas) {
    // Sin historial no se puede calcular el resumen (récords, juego): la sesión está guardada y su detalle se abre igual.
    toast('Sesión guardada. El resumen completo estará en tu historial.', 6000);
    abrirSesion(registro, { ftpAuto });
    pintarHoy();
    return true;
  }
  const recs = E.nuevosRecords(registro, previas);
  // Lo que la app predecía antes de esta marca a tope (etapa 17): se guarda para medir el error del modelo.
  try {
    const Pr = await import('../prediccion.js');
    const pred = Pr.registrarPredicciones(registro, previas);
    if (pred.length) { registro.predicciones = pred; await H.actualizar(registro.id, { predicciones: pred }); }
  } catch (e) { agregarLog(`predicciones: ${e?.message || e}`); }
  if (!recuperada) hablar(`Sesión terminada. ${(registro.distancia / 1000).toFixed(1).replace('.', ' punto ')} kilómetros${recs.length ? `. ${recs.length === 1 ? 'Nuevo récord' : `${recs.length} récords nuevos`}` : ''}${porPulso ? `. Según tu pulso, un esfuerzo de ${porPulso.rpe} de 10. ¿Cómo lo sentiste tú?` : '. ¿Qué tan duro se sintió?'}`);
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
    const fresco = fcFresca();
    const rec = fresco ? E.recuperacionPulso(fcFin, actual.fc) : null;
    if (rec == null) return;
    registro.fcRec60 = rec;
    await H.actualizar(registro.id, { fcRec60: rec });
    agregarLog(`recuperación de pulso: ${rec} lpm en 60 s`);
  }, 60000);
}
