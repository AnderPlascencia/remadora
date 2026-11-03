// Registro de diagnóstico: log, errores y avisos de la base de datos.
import * as db from './db.js';
import { $, descargar, marcaFecha, toast } from './ui.js';
import { vistaActiva } from './navegacion.js';

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

// Al arrancar la app (en orden, desde app.js).
export function arrancarRegistro() {
  window.addEventListener('error', (e) => anotarError('error', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => anotarError('promesa', e.reason));
  db.alAvisar((tipo) => {
    if (tipo === 'versionNueva') { agregarLog('base de datos: otra pestaña tiene una versión nueva'); toast('Hay una versión nueva de Rower abierta. Recarga esta pantalla.', 6000); }
    if (tipo === 'bloqueada') { agregarLog('base de datos: actualización bloqueada por otra pestaña'); toast('Cierra las otras pestañas de Rower para terminar de actualizar tus datos.', 6000); }
  });
  $('#btn-log').addEventListener('click', () => descargar(`remadora-registro-${marcaFecha()}.txt`, lineasLog.join('\n'), 'text/plain'));
  $('#btn-log-limpiar').addEventListener('click', () => { lineasLog.length = 0; $('#log').textContent = ''; });
}
