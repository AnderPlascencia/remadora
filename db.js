// Almacenamiento local (IndexedDB): sesiones remadas y entrenamientos creados.

const NOMBRE = 'remadora';
let dbPromesa = null;

function abrir() {
  if (dbPromesa) return dbPromesa;
  dbPromesa = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('sesiones', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('entrenamientos', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromesa;
}

async function tx(almacen, modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(almacen, modo);
    const req = fn(t.objectStore(almacen));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const guardar = (almacen, obj) => tx(almacen, 'readwrite', (s) => s.put(obj));
export const borrar = (almacen, id) => tx(almacen, 'readwrite', (s) => s.delete(id));
export const obtener = (almacen, id) => tx(almacen, 'readonly', (s) => s.get(id));
export const listar = (almacen) => tx(almacen, 'readonly', (s) => s.getAll());
