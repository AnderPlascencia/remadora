// Avisos por voz con la síntesis del navegador.
// Un mismo aviso repetido (por ejemplo "sube la potencia") se limita a uno cada `cadaSeg` segundos.
//
// Cada aviso va en una capa (guion-voz.js): 1 información, 2 corrección, 3 ánimo. Cuando coinciden gana la de
// número más bajo: una frase de capa menor corta la que suena si es de capa mayor, y una de capa 3 no se pone
// en cola detrás de otra. Además:
//  - capa 2: como mucho una cada 20 s; capa 3: como mucho una cada 3 min.
//  - «Cantidad de voz» en Ajustes: 'datos' (solo capa 1), 'entrenador' (capas 1 y 2) o 'completa'.
//  - silencio: mientras la sesión lo pida (últimos 10 s de un esfuerzo duro), las capas 2 y 3 callan.

let activa = true;
let nivel = 'completa';
let silencio = () => false;
let ahoraFn = () => Date.now();
const ultimos = new Map();
const ultimaCapa = { 2: -Infinity, 3: -Infinity };
let sonando = null; // capa de la frase que suena ahora, o null

export const CANTIDADES = { datos: 1, entrenador: 2, completa: 3 };
export const ESPERA_CAPA = { 2: 20, 3: 180 };

export function configurarVoz(encendida) {
  activa = encendida;
  if (!encendida) window.speechSynthesis?.cancel();
}
export function configurarCantidad(valor) { nivel = CANTIDADES[valor] ? valor : 'completa'; }
// La sesión indica cuándo callar las capas 2 y 3. fn() → true para callar.
export function fijarSilencio(fn) { silencio = typeof fn === 'function' ? fn : () => false; }
// Solo para pruebas: reloj y estado iniciales.
export function _reiniciar(reloj = () => Date.now()) {
  ahoraFn = reloj; ultimos.clear(); ultimaCapa[2] = -Infinity; ultimaCapa[3] = -Infinity; sonando = null; silencio = () => false; nivel = 'completa'; activa = true;
}

// ¿Debe sonar? Sin efectos: lo usan hablar() y las pruebas.
export function dejaSonar(capa, { clave, cadaSeg = 0, ahora = ahoraFn() } = {}) {
  // Si el navegador ya no está hablando, nada suena (por si no llegó el aviso de fin, que en Android a veces falla).
  if (sonando != null && !globalThis.speechSynthesis?.speaking) sonando = null;
  if (capa > CANTIDADES[nivel]) return false;
  if (capa >= 2 && silencio()) return false;
  if (cadaSeg && clave != null && ultimos.has(clave) && ahora - ultimos.get(clave) < cadaSeg * 1000) return false;
  if (capa >= 2 && ahora - ultimaCapa[capa] < ESPERA_CAPA[capa] * 1000) return false;
  // Una de ánimo nunca se pone detrás de otra frase.
  if (capa === 3 && sonando != null) return false;
  return true;
}

export function hablar(texto, { clave = texto, cadaSeg = 0, urgente = false, capa = 1 } = {}) {
  if (!texto || !activa || !('speechSynthesis' in window)) return false;
  const ahora = ahoraFn();
  if (!dejaSonar(capa, { clave, cadaSeg, ahora })) return false;
  ultimos.set(clave, ahora);
  if (capa >= 2) ultimaCapa[capa] = ahora;
  // Lo más importante corta lo que suena si es menos importante.
  const corta = urgente || (sonando != null && capa < sonando);
  if (corta) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-MX';
  u.rate = 1.05;
  const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
  if (voz) u.voice = voz;
  sonando = corta || sonando == null ? capa : Math.min(sonando, capa);
  u.onend = u.onerror = () => { if (!speechSynthesis.speaking) sonando = null; };
  speechSynthesis.speak(u);
  return true;
}

// Número de segundos en palabras cortas: 90 -> "1 minuto 30".
export function tiempoHablado(seg) {
  seg = Math.round(seg);
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  if (!m) return `${s} segundos`;
  const min = m === 1 ? '1 minuto' : `${m} minutos`;
  return s ? `${min} ${s}` : min;
}
