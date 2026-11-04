// Almacenamiento local (IndexedDB): sesiones remadas, entrenamientos creados y el estado de la app
// (la sesión en curso y la versión de los datos).
//
// Versiones de la base:
//   1: sesiones y entrenamientos.
//   2: almacén «estado» (claves sueltas: enCurso, versionDatos).
//   3: las muestras de cada sesión pasan a su propio almacén («muestras», con el id de la sesión como clave)
//      y «sesiones» gana un índice por fecha. Así listar el historial no carga cada segundo remado.

const NOMBRE = 'remadora';
const VERSION_BD = 3;
let dbPromesa = null;

// La app escucha estos avisos para decírselos a la persona (ver app.js).
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
      if (e.oldVersion < 3) separarMuestras(req.transaction);
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

// v3: crea «muestras» y el índice por fecha, y saca las muestras de cada sesión guardada. Corre dentro de la
// transacción de la actualización: si algo falla, la base se queda entera en la versión anterior.
function separarMuestras(t) {
  const db = t.db;
  const muestras = db.createObjectStore('muestras');
  const sesiones = t.objectStore('sesiones');
  sesiones.createIndex('fecha', 'fecha');
  sesiones.openCursor().onsuccess = (ev) => {
    const c = ev.target.result;
    if (!c) return;
    const { muestras: m, ...resto } = c.value;
    if (m) {
      muestras.put(m, c.primaryKey);
      c.update(resto);
    }
    c.continue();
  };
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
    t.onerror = () => reject(t.error || req?.error || new Error(`error en ${almacen}`));
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
