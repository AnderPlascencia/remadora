// Registro de diagnóstico: log, errores y avisos de la base de datos.
import * as db from './db.js';
import { $, descargar, marcaFecha, toast } from './ui.js';
import { vistaActiva } from './navegacion.js';
import { crearBufferPaquetes, estadisticasBle, paquetesConsola, resumenDiagnostico, textoDiagnostico } from './diagnostico.js';

export const lineasLog = [];
let logPendiente = false;
export function agregarLog(linea) {
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
// Errores que nadie atrapó: quedan en el registro (Ajustes) y se avisa una vez cada 30 s, en vez de dejar una
// pantalla a medias sin rastro.
let ultimoAvisoError = 0;
export function anotarError(origen, e) {
  const texto = e?.stack || e?.message || String(e);
  agregarLog(`error (${origen}): ${texto}`);
  if (Date.now() - ultimoAvisoError < 30000) return;
  ultimoAvisoError = Date.now();
  toast('Algo falló. Quedó anotado en el registro de Ajustes.', 4000);
}

// ---------- Registro de cada sesión ----------
// Al guardar una sesión se guardan también su diagnóstico y su registro (texto y paquetes de la consola) en IndexedDB:
// se conservan las 3 últimas, para diagnosticar un fallo aunque la app se haya cerrado después.
const ESTADO_SESIONES = 'registroSesiones';
const SESIONES_GUARDADAS = 3;
export async function guardarRegistroSesion(fecha, diagnostico = null) {
  try {
    const previos = (await db.leerEstado(ESTADO_SESIONES)) || [];
    const nuevo = { fecha, diagnostico, lineas: lineasLog.slice(-2000), paquetes: paquetesConsola.instantanea() };
    await db.guardarEstado(ESTADO_SESIONES, [...previos.filter((r) => r.fecha !== fecha), nuevo].slice(-SESIONES_GUARDADAS));
  } catch (e) {
    lineasLog.push(`no se pudo guardar el registro de la sesión: ${e?.name || e}`);
  }
}
async function registrosGuardados() {
  try { return (await db.leerEstado(ESTADO_SESIONES)) || []; } catch { return []; }
}

// Diagnóstico de la sesión de ahora (o la última de esta apertura); si no hay, el de la última sesión guardada.
export async function pintarDiagnostico() {
  const el = $('#diag-sesion');
  if (!el) return;
  let d = resumenDiagnostico(estadisticasBle());
  let titulo = 'Esta sesión';
  if (!d) {
    const ultimo = (await registrosGuardados()).filter((r) => r.diagnostico).at(-1);
    d = ultimo?.diagnostico || null;
    if (ultimo) titulo = `Sesión del ${new Date(ultimo.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
  }
  const lineas = textoDiagnostico(d);
  el.textContent = lineas.length ? `${titulo}: ${lineas.join(' · ')}.` : 'Aún no hay medidas: se toman mientras remas.';
}

async function textoRegistro() {
  const partes = [lineasLog.join('\n')];
  const ahora = textoDiagnostico(resumenDiagnostico(estadisticasBle()));
  if (ahora.length) partes.push(`--- Diagnóstico de esta sesión ---\n${ahora.join('\n')}`);
  partes.push(`--- Paquetes de la consola (los ${paquetesConsola.largo} más recientes) ---\n${paquetesConsola.texto()}`);
  for (const r of (await registrosGuardados()).reverse()) {
    const cuando = new Date(r.fecha).toLocaleString('es-MX');
    partes.push(`=== Sesión guardada del ${cuando} ===\n${textoDiagnostico(r.diagnostico).join('\n')}\n${(r.lineas || []).join('\n')}`);
    if (r.paquetes) partes.push(`--- Paquetes de esa sesión ---\n${crearBufferPaquetes(0, r.paquetes).texto()}`);
  }
  return partes.join('\n\n');
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarRegistro() {
  window.addEventListener('error', (e) => anotarError('error', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => anotarError('promesa', e.reason));
  db.alAvisar((tipo) => {
    if (tipo === 'versionNueva') { agregarLog('base de datos: otra pestaña tiene una versión nueva'); toast('Hay una versión nueva de Rower abierta. Recarga esta pantalla.', 6000); }
    if (tipo === 'bloqueada') { agregarLog('base de datos: actualización bloqueada por otra pestaña'); toast('Cierra las otras pestañas de Rower para terminar de actualizar tus datos.', 6000); }
  });
  $('#btn-log').addEventListener('click', async () => descargar(`remadora-registro-${marcaFecha()}.txt`, await textoRegistro(), 'text/plain'));
  $('#btn-log-limpiar').addEventListener('click', () => { lineasLog.length = 0; paquetesConsola.vaciar(); $('#log').textContent = ''; });
}
