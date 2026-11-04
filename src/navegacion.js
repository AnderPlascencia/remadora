// Navegación entre pestañas y ayudas emergentes.
import { $, toast } from './ui.js';
import { pintarClasificacion, pintarPerfil } from './pantallas/ajustes.js';
import { dibujarVivo, vistaPrevia } from './pantallas/vivo.js';
import { lineasLog } from './registro.js';
import { pintarEntrenamientos } from './pantallas/planes.js';
import { pintarHistorial } from './pantallas/progreso.js';
import { pintarHeroe } from './pantallas/heroe.js';
import { mostrarConsejo } from './pantallas/ayuda.js';

// ---------- Navegación ----------
export const vistaActiva = (v) => $(`#vista-${v}`).classList.contains('activa');
export function irA(vista) {
  document.querySelectorAll('.nav-inferior button').forEach((b) => {
    const activa = b.dataset.vista === vista;
    b.classList.toggle('activa', activa);
    b.setAttribute('aria-selected', activa);
  });
  document.querySelectorAll('.vista').forEach((v) => v.classList.toggle('activa', v.id === `vista-${vista}`));
  window.scrollTo(0, 0);
  if (vista === 'historial') pintarHistorial();
  if (vista === 'heroe') pintarHeroe();
  if (vista === 'entrenamientos') pintarEntrenamientos();
  if (vista === 'entrenar') { dibujarVivo(); vistaPrevia(); }
  if (vista === 'ajustes') pintarClasificacion();
  if (vista === 'ajustes') { $('#log').textContent = lineasLog.slice(-300).join('\n'); pintarPerfil(); }
  mostrarConsejo(vista);
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarNavegacion() {
  document.querySelectorAll('.nav-inferior button').forEach((b) => b.addEventListener('click', () => irA(b.dataset.vista)));
  document.addEventListener('click', (e) => {
    const q = e.target.closest('.ayuda-q');
    if (!q) return;
    e.preventDefault();
    e.stopPropagation();
    toast(AYUDAS[q.dataset.ayuda], 7000);
  }, true);
}

// Ayudas de un toque («?»): explican un término sin llenar la pantalla de párrafos.
const AYUDAS = {
  xp: 'Cada sesión da XP por metros (1 XP cada 10 m), entrenamientos completos, récords, fantasmas vencidos, misiones y logros. Desde el 29 de octubre todo da la mitad de XP. Cada 3 niveles ganas un punto de talento.',
  dificultad: 'Bahía, Costa y Alta mar cambian qué tan fuerte reman los fantasmas. Cuanto más difícil, más XP por cada uno que venzas.',
  referencia: 'Una línea amarilla en tu carril con tu sesión anterior o tu mejor marca de este entrenamiento: así ves si vas por delante.',
  ventaja: 'Objetos de la tienda que te dan metros extra en la carrera. Solo cuentan contra los fantasmas, nunca en tus estadísticas.',
  ftp: 'La potencia que aguantas cerca de una hora. La app la calcula sola con tus sesiones, y la Prueba FTP 20 min la afina: repítela cada 6 a 8 semanas. Los watts de la RW200 salen de su propia calibración: compáralos contigo, no con un Concept2 ni con otra máquina.',
};
