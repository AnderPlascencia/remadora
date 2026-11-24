// «Rema contra mí» (etapa 25): tu sesión viaja dentro de un enlace, sin servidor. Quien lo abre la tiene como
// referencia en la carrera: un bote que rema exactamente lo que remaste tú, segundo a segundo cada 10 s.
// El enlace lleva tu nombre (el del héroe, si lo eliges), el entrenamiento, la fecha y los metros cada 10 s.
// No lleva pulso, peso ni nada más de ti.

export const PARAM = 'reto';
export const VERSION_RETO = 1;
export const PASO = 10; // segundos entre puntos
export const DURACION_MAX = 3 * 3600;
const NOMBRE_MAX = 40;
const ENT_MAX = 80;

// Base64 de URL (sin + / =) para que el enlace no se rompa al pegarlo.
function aBase64Url(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deBase64Url(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// Metros acumulados al final de cada tramo de PASO segundos (el último, al final de la sesión).
export function puntosDe(muestras = [], duracion = 0) {
  const fin = Math.min(DURACION_MAX, Math.round(duracion || muestras.at(-1)?.t || 0));
  const res = [];
  let j = 0;
  let ultimo = 0;
  for (let t = PASO; t < fin + PASO; t += PASO) {
    const hasta = Math.min(t, fin);
    while (j < muestras.length && muestras[j].t <= hasta) { if (Number.isFinite(muestras[j].dist)) ultimo = muestras[j].dist; j++; }
    res.push(Math.round(ultimo));
  }
  return res;
}

// Lo que va en el enlace: { v, n, e, f, T, d } con d en diferencias de metros entre puntos.
export function codificarReto(s, nombre = '') {
  if (!s?.muestras?.length) return null;
  const T = Math.min(DURACION_MAX, Math.round(s.duracion || s.muestras.at(-1).t || 0));
  if (T < 60) return null;
  const pts = puntosDe(s.muestras, T);
  const d = pts.map((x, i) => Math.max(0, x - (pts[i - 1] || 0)));
  const datos = { v: VERSION_RETO, n: String(nombre || '').slice(0, NOMBRE_MAX), e: String(s.entrenamiento || '').slice(0, ENT_MAX), f: Math.round(s.fecha / 864e5), T, d };
  return aBase64Url(JSON.stringify(datos));
}

// Devuelve { nombre, ent, fecha, duracion, distancia, muestras } o null si el texto no es un reto válido.
export function decodificarReto(texto) {
  if (typeof texto !== 'string' || texto.length > 20000) return null;
  let o;
  try { o = JSON.parse(deBase64Url(texto)); } catch { return null; }
  if (!o || o.v !== VERSION_RETO || !Array.isArray(o.d)) return null;
  const T = Number(o.T);
  if (!Number.isInteger(T) || T < 60 || T > DURACION_MAX) return null;
  if (o.d.length !== Math.ceil(T / PASO) || !o.d.every((x) => Number.isInteger(x) && x >= 0 && x <= 100)) return null;
  // Una muestra por segundo (como las sesiones guardadas), con los metros repartidos dentro de cada tramo.
  const muestras = [];
  let dist = 0;
  o.d.forEach((x, i) => {
    const desde = i * PASO;
    const hasta = Math.min(T, (i + 1) * PASO);
    for (let t = desde + 1; t <= hasta; t++) muestras.push({ t, dist: Math.round((dist + (x * (t - desde)) / (hasta - desde)) * 10) / 10 });
    dist += x;
  });
  return {
    nombre: typeof o.n === 'string' ? o.n.slice(0, NOMBRE_MAX) : '',
    ent: typeof o.e === 'string' ? o.e.slice(0, ENT_MAX) : '',
    fecha: Number.isFinite(o.f) ? o.f * 864e5 : null,
    duracion: T,
    distancia: dist,
    muestras,
  };
}

// El enlace se arma con la dirección desde la que abriste la app: así sirve donde esté publicada.
export function enlaceReto(base, s, nombre) {
  const c = codificarReto(s, nombre);
  if (!c) return null;
  const u = new URL(base);
  u.search = '';
  u.hash = '';
  u.searchParams.set(PARAM, c);
  return u.toString();
}

// Texto del mensaje que acompaña al enlace.
export function textoReto(s, nombre = '') {
  const km = (s.distancia || s.muestras?.at(-1)?.dist || 0).toLocaleString('es-MX');
  const min = Math.round((s.duracion || 0) / 60);
  const ent = s.entrenamiento ? ` en «${s.entrenamiento}»` : '';
  return `${nombre ? `${nombre} te reta` : 'Te reto'}: remé ${km} m en ${min} min${ent}. ¿Me alcanzas? Abre el enlace y rema contra mi sesión.`;
}
