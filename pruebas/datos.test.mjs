// Capa de datos (I-1 de la ronda 2, INF-R6): db.js e historial.js sobre una IndexedDB falsa (fake-indexeddb).
// Migración v2 → v3, transacciones que abortan, la caché por generación del historial y guardar/actualizar/borrar.
import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

const db = await import('../src/db.js');
const H = await import('../src/historial.js');
const { porLotes } = await import('../src/respaldo.js');

const abrirCrudo = (version, upgrade) => new Promise((ok, mal) => {
  const r = indexedDB.open('remadora', version);
  r.onupgradeneeded = (e) => upgrade?.(r.result, e, r.transaction);
  r.onsuccess = () => ok(r.result);
  r.onerror = () => mal(r.error);
});
const pedir = (r) => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });
const muestras = (n, w = 150) => Array.from({ length: n }, (_, t) => ({ t, w, dist: t * 4, spm: 22, fc: 0 }));
const avisos = [];
db.alAvisar((m) => avisos.push(m));
// Base vacía para la prueba siguiente: borrarla cierra la conexión de db.js (versionchange), que se reabre sola.
async function vaciar() {
  await new Promise((ok, mal) => { const r = indexedDB.deleteDatabase('remadora'); r.onsuccess = ok; r.onerror = () => mal(r.error); });
  H.invalidar();
}

test('migración v2 → v3: las muestras salen a su almacén y las sesiones ganan el índice por fecha', async () => {
  // Una base de la v2 (antes de que db.js la abra): sesiones con sus muestras dentro y el almacén de estado.
  const vieja = await abrirCrudo(2, (d) => {
    d.createObjectStore('sesiones', { keyPath: 'id', autoIncrement: true });
    d.createObjectStore('entrenamientos', { keyPath: 'id', autoIncrement: true });
    d.createObjectStore('estado');
  });
  const t = vieja.transaction(['sesiones', 'estado'], 'readwrite');
  t.objectStore('sesiones').put({ fecha: 2000, duracion: 60, muestras: muestras(60) });
  t.objectStore('sesiones').put({ fecha: 1000, duracion: 30 }); // sin muestras (escrita a mano)
  t.objectStore('estado').put(7, 'versionDatos');
  await new Promise((ok) => { t.oncomplete = ok; });
  vieja.close();

  assert.equal(await db.leerEstado('versionDatos'), 7, 'el estado sigue');
  const crudas = await db.listar('sesiones');
  assert.equal(crudas.length, 2);
  assert.ok(crudas.every((s) => !('muestras' in s)), 'ninguna sesión guarda sus muestras dentro');
  const m = await db.obtener('muestras', 1);
  assert.equal(m.length, 60);
  assert.equal(await db.obtener('muestras', 2), undefined);
  // El índice por fecha ordena el historial, y obtener() junta de nuevo las muestras.
  const lista = await H.sesiones();
  assert.deepEqual(lista.map((s) => s.fecha), [1000, 2000]);
  assert.equal(lista[1].muestras.length, 60);
  assert.equal((await H.obtener(1)).muestras.length, 60);
  assert.equal((await H.obtener(2)).muestras, undefined);
  assert.equal(await H.obtener(99), undefined);
});

test('una base nueva se crea en la v3 con sus cuatro almacenes', async () => {
  await vaciar();
  assert.ok(avisos.includes('versionNueva'), 'borrar la base cierra la conexión y lo avisa');
  assert.deepEqual(await db.listar('entrenamientos'), []);
  const d = await abrirCrudo(3);
  assert.deepEqual([...d.objectStoreNames].sort(), ['entrenamientos', 'estado', 'muestras', 'sesiones']);
  assert.ok(d.transaction('sesiones').objectStore('sesiones').indexNames.contains('fecha'));
  d.close();
});

test('tx: termina con su resultado, con un error o con un aborto, nunca se queda colgada', async () => {
  await vaciar();
  // Resultado de una petición, de una función o de un valor.
  const id = await db.guardar('entrenamientos', { nombre: 'A' });
  assert.equal(id, 1);
  assert.equal((await db.obtener('entrenamientos', id)).nombre, 'A');
  assert.deepEqual(await db.tx(['entrenamientos', 'estado'], 'readonly', (t) => { const r = t.objectStore('entrenamientos').count(); return () => r.result + 1; }), 2);
  assert.equal(await db.tx('estado', 'readonly', () => 'hola'), 'hola');
  // Un error dentro de fn aborta la transacción: lo que escribió no queda.
  await assert.rejects(db.tx('entrenamientos', 'readwrite', (s) => { s.put({ nombre: 'B' }); throw new Error('falla'); }), /falla/);
  assert.equal((await db.listar('entrenamientos')).length, 1);
  // Un aborto (como el de un disco lleno, que solo dispara abort) también termina la promesa.
  await assert.rejects(db.tx('entrenamientos', 'readwrite', (s) => { s.put({ nombre: 'C' }); s.transaction.abort(); }), (e) => e.name === 'AbortError');
  assert.equal((await db.listar('entrenamientos')).length, 1);
  // Una clave repetida con add(): error de la petición.
  await assert.rejects(db.tx('entrenamientos', 'readwrite', (s) => s.add({ id: 1, nombre: 'otra' })), (e) => e.name === 'ConstraintError');
  // Un almacén que no existe: la transacción ni se abre.
  await assert.rejects(db.tx('nada', 'readonly', (s) => s.getAll()), (e) => e.name === 'NotFoundError');
  // Borrar.
  await db.borrar('entrenamientos', id);
  assert.equal(await db.obtener('entrenamientos', id), undefined);
});

test('estado de la app: una clave, un valor', async () => {
  await db.guardarEstado('enCurso', { t: 5 });
  assert.deepEqual(await db.leerEstado('enCurso'), { t: 5 });
  await db.borrarEstado('enCurso');
  assert.equal(await db.leerEstado('enCurso'), undefined);
});

test('otra pestaña que actualiza la base: esta conexión se cierra, avisa y la siguiente operación la reabre', async () => {
  avisos.length = 0;
  await db.guardarEstado('x', 1);
  const nueva = await abrirCrudo(4);
  assert.deepEqual(avisos, ['versionNueva']);
  nueva.close();
  // La v4 de prueba no la conoce db.js: abrir con la v3 falla con VersionError y no deja la conexión rota.
  await assert.rejects(db.leerEstado('x'), (e) => e.name === 'VersionError');
  await vaciar();
  assert.equal(await db.leerEstado('x'), undefined, 'con la base rehecha vuelve a abrir');
});

test('historial: guarda las muestras aparte, cachea por generación y avisa al cambiar', async () => {
  await vaciar();
  let cambios = 0;
  const quitar = H.alCambiar(() => { cambios++; });
  H.alCambiar(() => { throw new Error('un aviso roto no rompe los demás'); });
  const sesion = { fecha: Date.parse('2026-11-02T08:00'), duracion: 120, distancia: 480, muestras: muestras(120) };
  const id = await H.guardar(sesion);
  assert.ok(sesion.muestras, 'no cambia el objeto que recibe');
  assert.equal(cambios, 1);
  assert.equal((await db.obtener('muestras', id)).length, 120);
  assert.ok(!('muestras' in (await db.obtener('sesiones', id))));

  // Caché: mientras no cambie nada, las mismas sesiones (en listas nuevas).
  const v = H.version();
  const a = await H.sesiones();
  const b = await H.sesiones();
  assert.notEqual(a, b);
  assert.equal(a[0], b[0]);
  assert.equal(a[0].muestras.length, 120);
  // Sin muestras: con su resumen, que se guarda para la próxima vez.
  const [ligera] = await H.sinMuestras();
  assert.ok(!('muestras' in ligera));
  assert.equal(ligera.res?.v, H.RESUMEN_V);
  assert.equal((await H.sinMuestras())[0], ligera, 'la misma sesión mientras no cambie nada');
  await new Promise((ok) => setTimeout(ok, 20)); // el resumen se escribe sin esperar
  assert.equal((await db.obtener('sesiones', id)).res?.v, H.RESUMEN_V);

  // Actualizar cambia los datos sin tocar las muestras; con bloques nuevos, el resumen se rehace.
  const act = await H.actualizar(id, { rpe: 6 });
  assert.equal(act.rpe, 6);
  assert.ok(H.version() > v);
  assert.equal((await db.obtener('muestras', id)).length, 120);
  assert.equal((await db.obtener('sesiones', id)).res?.v, H.RESUMEN_V);
  await H.actualizar(id, { bloques: [] });
  assert.equal((await db.obtener('sesiones', id)).res, null);
  assert.equal(await H.actualizar(999, { rpe: 1 }), undefined, 'una sesión que no existe');
  const c = await H.sesiones();
  assert.notEqual(c[0], a[0], 'tras guardar, sesiones nuevas');
  assert.equal(c[0].rpe, 6);

  // Reemplazar una sesión con muestras nuevas borra su resumen viejo.
  await H.guardar({ ...c[0], muestras: muestras(60, 200), res: { v: H.RESUMEN_V, viejo: true } });
  assert.ok(!(await db.obtener('sesiones', id)).res?.viejo);

  // Borrar quita la sesión y sus muestras.
  const antes = cambios;
  await H.borrar(id);
  assert.equal(cambios, antes + 1);
  assert.deepEqual(await H.sesiones(), []);
  assert.equal(await db.obtener('muestras', id), undefined);
  quitar();
  await H.guardar({ fecha: 1, duracion: 1 });
  assert.equal(cambios, antes + 1, 'alCambiar devuelve cómo dejar de escuchar');
});

test('poner dentro de otra transacción: la sesión y su gasto juntos (o nada)', async () => {
  await vaciar();
  let idPuesto = null;
  await db.tx(['sesiones', 'muestras', 'estado'], 'readwrite', (t) => {
    H.poner(t, { fecha: 5, duracion: 10, muestras: muestras(10) }, (i) => { idPuesto = i; });
    t.objectStore('estado').put({ oro: 1 }, 'inventario');
  });
  assert.equal(idPuesto, 1);
  assert.equal((await db.obtener('muestras', 1)).length, 10);
  // Si falla algo de la transacción, la sesión tampoco queda.
  await assert.rejects(db.tx(['sesiones', 'muestras', 'estado'], 'readwrite', (t) => {
    H.poner(t, { fecha: 6, duracion: 10, muestras: muestras(10) });
    t.objectStore('estado').put({ oro: 2 }, 'inventario');
    throw new Error('sin espacio');
  }));
  assert.equal((await db.listar('sesiones')).length, 1);
  assert.deepEqual(await db.leerEstado('inventario'), { oro: 1 });
});

test('si leer falla, la caché no se queda con el error', async () => {
  await vaciar();
  await H.guardar({ fecha: 1, duracion: 1 });
  const nueva = await abrirCrudo(4); // la base pasa a una versión que db.js no abre
  nueva.close();
  H.invalidar();
  await assert.rejects(H.sesiones());
  await assert.rejects(H.sinMuestras());
  await vaciar();
  assert.deepEqual(await H.sesiones(), [], 'reintenta en la siguiente llamada');
  assert.deepEqual(await H.sinMuestras(), []);
});

test('estado del juego: se calcula una vez por versión de la lista; una lista filtrada se calcula aparte', async () => {
  await vaciar();
  for (const d of [1, 2, 3]) await H.guardar({ fecha: Date.parse(`2026-11-0${d}T08:00`), duracion: 600, distancia: 2000, muestras: muestras(600) });
  const lista = await H.sesiones();
  const a = H.estadoJuegoDe(lista, { ftp: 200 });
  assert.equal(H.estadoJuegoDe(lista, { ftp: 200 }), a, 'la misma versión: el mismo estado');
  assert.notEqual(H.estadoJuegoDe(lista, { ftp: 210 }), a, 'otro perfil: se recalcula');
  const filtrada = lista.slice(1);
  assert.notEqual(H.estadoJuegoDe(filtrada, { ftp: 200 }), H.estadoJuegoDe(filtrada, { ftp: 200 }), 'una lista ajena no se cachea');
  await H.actualizar(lista[0].id, { rpe: 5 });
  assert.notEqual(H.estadoJuegoDe(lista, { ftp: 200 }), a, 'tras guardar, la lista vieja ya no es la de ahora');
});

test('porLotes recorre todas las sesiones con sus muestras, de n en n, sin tocar la caché del historial', async () => {
  await vaciar();
  for (let i = 0; i < 7; i++) await H.guardar({ fecha: 100 - i, duracion: 10, muestras: muestras(10 + i) });
  // Una de antes de la v3, con las muestras dentro.
  await db.guardar('sesiones', { fecha: 50, duracion: 5, muestras: muestras(5) });
  const v = H.version();
  const lotes = [];
  for await (const l of porLotes(3)) lotes.push(l);
  assert.deepEqual(lotes.map((l) => l.length), [3, 3, 2]);
  const todas = lotes.flat();
  assert.deepEqual(todas.map((s) => s.id), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(todas.map((s) => s.muestras.length), [10, 11, 12, 13, 14, 15, 16, 5]);
  assert.equal(H.version(), v, 'leer no invalida nada');
  // Con un múltiplo exacto de n no queda un lote vacío.
  const exactos = [];
  for await (const l of porLotes(4)) exactos.push(l.length);
  assert.deepEqual(exactos, [4, 4]);
  await vaciar();
  for await (const l of porLotes()) assert.fail(`sin sesiones no hay lotes (${l.length})`);
});
