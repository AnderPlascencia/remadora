// Utilidades de pantalla compartidas por toda la app: selector, iconos, ajustes guardados, avisos y sonidos.
import { formatoTiempo } from './protocolo.js';
import { token } from './grafica.js';
import { defectoTexto } from './ajustes-guardados.js';

export const $ = (sel) => document.querySelector(sel);
// Color de una variable CSS del tema, leído una vez (ver grafica.js); al cambiar de tema se llama olvidarTokens.
export const color = (v) => token(v);
export const ico = (id) => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
export const COLOR_ZONA = ['#94A3B8', '#38BDF8', '#22C55E', '#FACC15', '#F97316', '#EF4444'];

// Ajustes guardados en localStorage. Cada clave está en ajustes-guardados.js, con su valor por defecto: si no
// se pasa uno, se usa el del registro.
export const ajustes = {
  leer(clave, defecto = defectoTexto(clave)) {
    try { return localStorage.getItem(clave) ?? defecto; } catch { return defecto; }
  },
  escribir(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
  },
  num(clave, defecto) { return Number(this.leer(clave, defecto)) || defecto; },
  si(clave, defecto) { return this.leer(clave, defecto ? '1' : '0') === '1'; },
};
export const ftp = () => ajustes.num('ftp', 0);
export const fcMaxima = () => ajustes.num('fcMax', 0);
// Tu perfil (Ajustes › Tu perfil y la bienvenida). minutos: null si no lo has elegido, 0 = sin límite.
export function perfil() {
  const min = ajustes.leer('minutosSesion', '');
  return {
    edad: ajustes.num('edad', 0), sexo: ajustes.leer('sexo', ''), peso: Number(ajustes.leer('peso', '')) || 0,
    altura: ajustes.num('altura', 0), experiencia: ajustes.leer('experiencia', ''),
    dias: Math.min(5, Math.max(1, ajustes.num('diasSemana', 3))), minutos: min === '' ? null : Number(min) || 0,
  };
}

// Los nombres los escribe el usuario: siempre escapados al meterlos en HTML.
export function escaparHtml(t) { return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Animaciones cortas; con «reducir animaciones» del teléfono todo queda en su estado final.
export const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function contarHasta(el, total, formato = (v) => v, ms = 1100) {
  if (sinMovimiento()) { el.textContent = formato(total); return; }
  const t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = formato(Math.round(total * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
// Cambia el texto con un desvanecido breve, solo si cambió (para el split, que se lee en movimiento).
export function cambiarTexto(el, texto) {
  if (el.textContent === texto) return;
  el.textContent = texto;
  el.classList.remove('cambia');
  void el.offsetWidth;
  el.classList.add('cambia');
}

let toastTimer = null;
export function toast(texto, ms = 3000) {
  const t = $('#toast');
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export const fechaCorta = (ms) => new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

export const miles = (n) => Math.round(n).toLocaleString('es-MX');

export function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function marcaFecha(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

let audio = null;
export function pitido(frecuencia, segundos) {
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = frecuencia;
    g.gain.setValueAtTime(0.2, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + segundos);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + segundos);
  } catch { /* sin audio */ }
}

export function vibrar(patron) {
  try { navigator.vibrate?.(patron); } catch { /* sin vibración */ }
}

// Tiempo de meta: desde v0.42.1 se guarda con décimas (1:32.8), como en las remadoras de competición.
// Los tiempos enteros (sesiones anteriores, fantasmas) se ven igual que siempre.
export function formatoMeta(seg) {
  if (seg == null || !Number.isFinite(seg)) return '-';
  const d = Math.round(seg * 10) / 10;
  if (Number.isInteger(d)) return formatoTiempo(d);
  return `${formatoTiempo(Math.floor(d))}.${Math.round((d % 1) * 10)}`;
}

// Números que crecen (2:03:45, 42195 m, 12345 paladas): si el texto ya no cabe en su casilla se achica la
// letra en vez de salirse. Solo se mide cuando cambia el largo del texto o la pantalla (rotar, cambiar de vista).
let generacionAjuste = 0;
export function reajustarTextos() { generacionAjuste++; }
export function ajustarTexto(el, minimo = 0.55) {
  if (!el) return;
  const firma = `${generacionAjuste}|${el.textContent.length}`;
  if (el.dataset.ajuste === firma) return;
  el.style.fontSize = '';
  const ancho = el.clientWidth;
  if (!ancho) return; // oculto: se ajusta cuando se vea
  el.dataset.ajuste = firma;
  if (el.scrollWidth <= ancho + 1) return;
  const base = parseFloat(getComputedStyle(el).fontSize);
  el.style.fontSize = `${Math.max(base * minimo, Math.floor((base * ancho * 10) / el.scrollWidth) / 10)}px`;
}
