// @ts-check
// Almacenamiento local (IndexedDB): sesiones remadas, entrenamientos creados y el estado de la app
// (la sesión en curso y la versión de los datos).
//
// Versiones de la base:
//   1: sesiones y entrenamientos.
//   2: almacén «estado» (claves sueltas: enCurso, versionDatos).
//   3: las muestras de cada sesión pasan a su propio almacén («muestras», con el id de la sesión como clave)
//      y «sesiones» gana un índice por fecha. Así listar el historial no carga cada segundo remado.
//   4: los intervalos RR de la banda de pulso pasan a su propio almacén («rr», misma clave), fuera de la lista
//      ligera, y cada sesión recibe un `uid` estable para no duplicarla al restaurar (I-3, INF-R4 reducida).

const NOMBRE = 'remadora';
const VERSION_BD = 4;
let dbPromesa = null;

// La app escucha estos avisos para decírselos a la persona (ver app.js).
/** @type {(motivo: string) => void} */
let avisar = () => {};
export function alAvisar(fn) { avisar = fn; }

function abrir() {
  if (dbPromesa) return dbPromesa;
  dbPromesa = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE, VERSION_BD);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('sesiones', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('entrenamientos', { keyPath: 'id', autoIncrement: true });
      }
      if (e.oldVersion < 2) db.createObjectStore('estado');
      if (e.oldVersion < 4) separarSesiones(req.transaction, e.oldVersion);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Otra pestaña con una versión más nueva quiere actualizar la base: se cierra esta conexión para no
      // bloquearla, y la próxima operación la vuelve a abrir.
      db.onversionchange = () => { db.close(); dbPromesa = null; avisar('versionNueva'); };
      db.onclose = () => { dbPromesa = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromesa = null; reject(req.error); };
    // Una pestaña vieja abierta impide actualizar la base: la apertura espera hasta que se cierre.
    req.onblocked = () => avisar('bloqueada');
  });
  return dbPromesa;
}

// v3: crea «muestras» y el índice por fecha, y saca las muestras de cada sesión guardada.
// v4 (I-3): crea «rr», saca los RR de cada sesión y le da su uid.
// Una sola pasada por las sesiones (dos cursores a la vez sobre el mismo almacén se pisarían). Corre dentro de la
// transacción de la actualización: si algo falla, la base se queda entera en la versión anterior.
function separarSesiones(t, desde) {
  const sesiones = t.objectStore('sesiones');
  if (desde < 3) {
    t.db.createObjectStore('muestras');
    sesiones.createIndex('fecha', 'fecha');
  }
  const muestras = t.objectStore('muestras');
  const rr = t.db.createObjectStore('rr');
  sesiones.openCursor().onsuccess = (ev) => {
    const c = ev.target.result;
    if (!c) return;
    const { muestras: m, rr: r, ...resto } = c.value;
    if (m) muestras.put(m, c.primaryKey);
    if (Array.isArray(r) && r.length) rr.put(r, c.primaryKey);
    if (m || r !== undefined || !resto.uid) c.update({ ...resto, uid: resto.uid || nuevoUid() });
    c.continue();
  };
}

// Un identificador al azar por sesión (UUID v4). Sin crypto.randomUUID (página sin https), uno parecido con
// getRandomValues.
export function nuevoUid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Una transacción termina siempre: con su resultado (complete) o con un error (error o abort). Un disco lleno
// (QuotaExceededError) solo dispara abort, y sin escucharlo la promesa no terminaba nunca.
export async function tx(almacen, modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    let t;
    try {
      t = db.transaction(almacen, modo);
    } catch (e) {
      reject(e);
      return;
    }
    let req;
    // Con varios almacenes, fn recibe la transacción y devuelve una petición, una función o un valor.
    const varios = Array.isArray(almacen);
    const leer = () => (typeof req === 'function' ? req() : req instanceof IDBRequest ? req.result : req);
    t.oncomplete = () => resolve(leer());
    // El error llega desde la petición que falló (e.target): con varias peticiones, req es solo la última.
    t.onerror = (e) => reject(e?.target?.error || t.error || req?.error || new Error(`error en ${almacen}`));
    t.onabort = () => reject(t.error || new DOMException(`transacción abortada en ${almacen}`, 'AbortError'));
    try {
      req = fn(varios ? t : t.objectStore(almacen));
    } catch (e) {
      try { t.abort(); } catch { /* ya terminó */ }
      reject(e);
    }
  });
}

export const guardar = (almacen, obj) => tx(almacen, 'readwrite', (s) => s.put(obj));
export const borrar = (almacen, id) => tx(almacen, 'readwrite', (s) => s.delete(id));
export const obtener = (almacen, id) => tx(almacen, 'readonly', (s) => s.get(id));
export const listar = (almacen) => tx(almacen, 'readonly', (s) => s.getAll());

// Estado de la app: un valor por clave.
export const leerEstado = (clave) => tx('estado', 'readonly', (s) => s.get(clave));
export const guardarEstado = (clave, valor) => tx('estado', 'readwrite', (s) => s.put(valor, clave));
export const borrarEstado = (clave) => tx('estado', 'readwrite', (s) => s.delete(clave));
