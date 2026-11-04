// Historial de sesiones: la única puerta a las sesiones guardadas.
// En la base, cada sesión va sin sus muestras («sesiones») y las muestras van aparte («muestras», misma clave).
// Aquí se juntan y se guardan en memoria: la lista se lee una vez y se vuelve a leer solo después de guardar,
// borrar o restaurar. El estado del juego (XP, nivel, misiones) se calcula una sola vez por versión de la lista.
import * as db from './db.js';
import { estadoJuego as calcularJuego } from './juego.js';

let generacion = 0;
let completas = null; // Promise de la lista con muestras, ordenada por fecha
let resumenes = null; // Promise de la lista sin muestras
let juego = null; // { clave, generacion, minuto, valor }
const entregadas = new WeakMap(); // lista que dio sesiones() → su versión
let largo = 0;
const avisos = new Set();

// Llama a fn cada vez que cambia el historial (para repintar lo que dependa de él).
export function alCambiar(fn) { avisos.add(fn); return () => avisos.delete(fn); }

export function invalidar() {
  generacion++;
  completas = null;
  resumenes = null;
  juego = null;
  for (const fn of avisos) { try { fn(); } catch { /* que un aviso no rompa los demás */ } }
}

export const version = () => generacion;

const porFecha = (t) => t.objectStore('sesiones').index('fecha').getAll();

// Sesiones sin muestras: para contar, buscar por fecha o listar, sin cargar cada segundo remado.
export function sinMuestras() {
  if (!resumenes) {
    const g = generacion;
    resumenes = db.tx(['sesiones'], 'readonly', porFecha).then((l) => l.map(({ muestras, ...s }) => s));
    resumenes.catch(() => { if (g === generacion) resumenes = null; });
  }
  return resumenes.then((l) => [...l]);
}

// Sesiones completas, con sus muestras, de la más vieja a la más nueva. Devuelve una lista nueva cada vez
// (se puede ordenar o filtrar), pero las sesiones son las mismas mientras no se guarde nada.
export function sesiones() {
  if (!completas) {
    const g = generacion;
    completas = db.tx(['sesiones', 'muestras'], 'readonly', (t) => {
      const ss = porFecha(t);
      const ms = t.objectStore('muestras').getAll();
      const claves = t.objectStore('muestras').getAllKeys();
      return () => {
        const mapa = new Map(claves.result.map((k, i) => [k, ms.result[i]]));
        // Una sesión con las muestras dentro (de antes de la v3 o escrita a mano) se respeta tal cual.
        return ss.result.map((s) => (s.muestras || !mapa.has(s.id) ? s : { ...s, muestras: mapa.get(s.id) }));
      };
    });
    completas.catch(() => { if (g === generacion) completas = null; });
  }
  return completas.then((l) => {
    const copia = [...l];
    entregadas.set(copia, generacion);
    largo = l.length;
    return copia;
  });
}

export async function obtener(id) {
  const [s, m] = await db.tx(['sesiones', 'muestras'], 'readonly', (t) => {
    const a = t.objectStore('sesiones').get(id);
    const b = t.objectStore('muestras').get(id);
    return () => [a.result, b.result];
  });
  if (!s) return s;
  return s.muestras || !m ? s : { ...s, muestras: m };
}

// Pone una sesión en una transacción abierta sobre «sesiones» y «muestras». La sesión se guarda sin muestras;
// las muestras van aparte con el id que le toca. alTerminar(id) recibe el id.
export function poner(t, sesion, alTerminar) {
  const { muestras, ...resto } = sesion;
  const req = t.objectStore('sesiones').put(resto);
  req.onsuccess = () => {
    if (muestras) t.objectStore('muestras').put(muestras, req.result);
    alTerminar?.(req.result);
  };
  return req;
}

// Guarda (o reemplaza) una sesión con sus muestras en una sola transacción y devuelve su id.
// No cambia el objeto que recibe.
export async function guardar(sesion) {
  try {
    return await db.tx(['sesiones', 'muestras'], 'readwrite', (t) => poner(t, sesion));
  } finally {
    invalidar();
  }
}

// Cambia solo los datos de la sesión (notas, esfuerzo…) sin volver a escribir sus muestras.
export async function actualizar(id, cambios) {
  try {
    return await db.tx(['sesiones'], 'readwrite', (t) => {
      const s = t.objectStore('sesiones');
      const req = s.get(id);
      req.onsuccess = () => { if (req.result) s.put({ ...req.result, ...cambios }); };
      return () => req.result && { ...req.result, ...cambios };
    });
  } finally {
    invalidar();
  }
}

export async function borrar(id) {
  try {
    await db.tx(['sesiones', 'muestras'], 'readwrite', (t) => {
      t.objectStore('sesiones').delete(id);
      t.objectStore('muestras').delete(id);
    });
  } finally {
    invalidar();
  }
}

// Estado del juego: se calcula una vez por versión del historial y por perfil, y se rehace como mucho cada
// minuto (las misiones de la semana dependen de la hora). Solo se reutiliza con una lista tal como la dio
// sesiones() (ordenada o no); con otra lista (filtrada o con una sesión de más) se calcula aparte.
export function estadoJuegoDe(lista, { ftp = 0, per = {} } = {}) {
  const clave = `${ftp}|${JSON.stringify(per)}`;
  const minuto = Math.floor(Date.now() / 60000);
  const propia = entregadas.get(lista) === generacion && lista.length === largo;
  if (propia && juego && juego.generacion === generacion && juego.clave === clave && juego.minuto === minuto) return juego.valor;
  const valor = calcularJuego(lista, { ftp, per });
  if (propia) juego = { clave, generacion, minuto, valor };
  return valor;
}
