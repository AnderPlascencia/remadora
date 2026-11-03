// Avisos por voz con la síntesis del navegador.
// Un mismo aviso repetido (por ejemplo "sube la potencia") se limita a uno cada `cadaSeg` segundos.

let activa = true;
const ultimos = new Map();

export function configurarVoz(encendida) {
  activa = encendida;
  if (!encendida) window.speechSynthesis?.cancel();
}

export function hablar(texto, { clave = texto, cadaSeg = 0, urgente = false } = {}) {
  if (!activa || !('speechSynthesis' in window)) return;
  const ahora = Date.now();
  if (cadaSeg && ultimos.has(clave) && ahora - ultimos.get(clave) < cadaSeg * 1000) return;
  ultimos.set(clave, ahora);
  if (urgente) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-MX';
  u.rate = 1.05;
  const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
  if (voz) u.voice = voz;
  speechSynthesis.speak(u);
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
