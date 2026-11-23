// Progreso: historial, tendencia, récords y resumen semanal.
import { formatoTiempo } from '../protocolo.js';
import { $, ajustes, cargarVista, miles } from '../ui.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { guardarRespaldo } from './ajustes.js';
import { abrirCompartirPeriodo } from './planes.js';

// ---------- Progreso ----------
// Estado compartido con progreso-vista.js.
export const vp = { periodo: 'semana' };

// Al arrancar la app (en orden, desde app.js).
export function arrancarProgreso() {

  document.querySelectorAll('.segmentado button').forEach((b) => b.addEventListener('click', () => {
    vp.periodo = b.dataset.periodo;
    document.querySelectorAll('.segmentado button').forEach((x) => {
      x.classList.toggle('activo', x === b);
      x.setAttribute('aria-pressed', x === b);
    });
    pintarPeriodos();
    $('#btn-compartir-periodo span').textContent = vp.periodo === 'mes' ? 'Compartir mi mes' : 'Compartir mi semana';
  }));
  // Tarjeta de la semana o del mes para compartir (etapa 31).
  $('#btn-compartir-periodo').addEventListener('click', () => abrirCompartirPeriodo(vp.periodo));
  document.querySelectorAll('#seg-tendencia button').forEach((b) => b.addEventListener('click', () => {
    estado.tendencia = b.dataset.tend;
    document.querySelectorAll('#seg-tendencia button').forEach((x) => {
      x.classList.toggle('activo', x === b);
      x.setAttribute('aria-pressed', x === b);
    });
    pintarTendencia();
  }));
  $('#filtro-ent').addEventListener('change', () => pintarHistorial());
  $('#progreso-heroe').addEventListener('click', () => irA('heroe'));
}

export function formatoRecord(r, v) {
  if (r.tipo === 'tiempo') return formatoTiempo(v);
  return r.unidad === 'm' ? `${(v / 1000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : `${miles(v)} ${r.unidad}`;
}

export function pintarAvisoRespaldo(total) {
  const ultimo = Number(ajustes.leer('ultimoRespaldo', 0));
  const dias = ultimo ? Math.floor((Date.now() - ultimo) / 864e5) : null;
  const av = $('#aviso-respaldo');
  av.hidden = !(total >= 3 && (dias == null || dias >= 7));
  if (!av.hidden) {
    av.innerHTML = `${dias == null ? 'Aún no guardas un respaldo de tus sesiones.' : `Tu último respaldo fue hace ${dias} días.`}
      <div class="fila-botones"><button class="boton primario" id="btn-respaldo-aviso">Guardar respaldo ahora</button></div>`;
    $('#btn-respaldo-aviso').onclick = guardarRespaldo;
  }
}

// Lo que pinta la pestaña Progreso vive en progreso-vista.js y se baja al abrirla (o al pedir una gráfica).
const vista = async () => (await cargarVista(() => import('./progreso-vista.js'), 'Progreso', () => !!estado.sesion)) || {};
export const pintarHistorial = async () => (await vista()).pintarHistorial?.();
const pintarPeriodos = async () => (await vista()).pintarPeriodos?.();
export const pintarTendencia = async () => (await vista()).pintarTendencia?.();
export const pintarForma = async () => (await vista()).pintarForma?.();
export const pintarCurva = async () => (await vista()).pintarCurva?.();
export const pintarMotor = async () => (await vista()).pintarMotor?.();
export const pintarGasto = async () => (await vista()).pintarGasto?.();
export const pintarConstancia = async () => (await vista()).pintarConstancia?.();
