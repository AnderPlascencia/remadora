// @ts-check
// Respaldo en archivo: qué se guarda y cómo se combina al restaurar, sin tocar la pantalla. De la base solo lee
// (porLotes), y se carga al guardar o restaurar: no pesa en la primera carga.
//
// Formatos:
//   1 (sin campo «formato», hasta la v0.48): los ajustes como el texto de localStorage ('75', '1', '{"clase":…}').
//   2: «formato»: 2 y cada ajuste con su tipo (75, true, { clase: … }), según ajustes-guardados.js.
// Un respaldo viejo se convierte al formato actual antes de restaurarlo.
import { CLAVES_RESPALDO, aTexto, aTipo } from './ajustes-guardados.js';
import * as db from './db.js';

export const FORMATO = 2;
export const CLAVES_AJUSTES = CLAVES_RESPALDO;
// Ajustes del perfil: si el respaldo trae otros, se pregunta antes de reemplazarlos.
const CLAVES_PERFIL = ['peso', 'ftp', 'edad', 'fcMax', 'metaSemana', 'sexo', 'altura', 'experiencia', 'diasSemana', 'minutosSesion'];

// leer(clave) devuelve el ajuste guardado como texto, o null si no existe.
// eventos: los del hábito (habito.js), para no perder la constancia al cambiar de teléfono.
export function armarRespaldo({ version, sesiones, entrenamientos, programa, leer, eventos = [], fecha = new Date() }) {
  return {
    app: 'remadora',
    formato: FORMATO,
    version,
    fecha: fecha.toISOString(),
    sesiones,
    entrenamientos,
    programa,
    eventos,
    ajustes: Object.fromEntries(CLAVES_AJUSTES.map((k) => [k, aTipo(k, leer(k))]).filter(([, v]) => v !== undefined)),
  };
}

export function esRespaldo(datos) {
  return datos?.app === 'remadora' && Array.isArray(datos.sesiones);
}

// Lleva un respaldo al formato actual. Devuelve { datos } o { error } si es de una versión más nueva de la app.
export function convertir(datos) {
  const formato = datos.formato ?? 1;
  if (!Number.isInteger(formato) || formato < 1) return { error: 'formato desconocido' };
  if (formato > FORMATO) return { error: 'nuevo' };
  let d = datos;
  if (formato < 2) {
    const ajustes = Object.fromEntries(Object.entries(d.ajustes || {})
      .map(([k, v]) => [k, aTipo(k, v)]).filter(([, v]) => v !== undefined));
    d = { ...d, formato: 2, ajustes };
  }
  return { datos: d };
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);

// Por qué una sesión del respaldo no se puede guardar (null si está bien). Se mira lo que usan el historial,
// los récords y el héroe: fecha, duración, distancia y muestras.
export function validarSesion(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'no es una sesión';
  if (!num(s.fecha) || s.fecha <= 0) return 'sin fecha';
  if (!num(s.duracion) || s.duracion < 0) return 'sin duración';
  if (!num(s.distancia) || s.distancia < 0) return 'sin distancia';
  if (s.entrenamiento != null && typeof s.entrenamiento !== 'string') return 'entrenamiento no válido';
  if (s.notas != null && typeof s.notas !== 'string') return 'notas no válidas';
  if (s.muestras != null) {
    if (!Array.isArray(s.muestras)) return 'muestras no válidas';
    for (const m of s.muestras) {
      if (!m || typeof m !== 'object' || !num(m.t)) return 'muestras no válidas';
      for (const k of ['w', 'spm', 'dist', 'fc', 'split']) if (m[k] != null && !num(m[k])) return 'muestras no válidas';
    }
  }
  return null;
}

// Qué traer de un respaldo (ya convertido) sin duplicar: sesiones por fecha de inicio (o por uid) y entrenamientos por
// nombre (sin su id, que lo pone la base de datos). `distintos` lista lo que ya existe y es otro, para preguntar
// antes de reemplazar; `invalidas` cuenta las sesiones dañadas que no se traen. Los ajustes salen como texto.
export function planRestaurar(datos, { sesiones, entrenamientos, programa, leer }) {
  const fechas = new Set(sesiones.map((s) => s.fecha));
  // I-3: también por uid, que viaja en los respaldos desde la v4 de la base.
  const uids = new Set(sesiones.map((s) => s.uid).filter(Boolean));
  const nombres = new Set(entrenamientos.map((e) => e.nombre));
  const sinId = ({ id, ...resto }) => resto;
  const validas = datos.sesiones.filter((s) => validarSesion(s) == null);
  const sesionesNuevas = validas.filter((s) => !fechas.has(s.fecha) && !(s.uid && uids.has(s.uid))).map(sinId);
  const entNuevos = (Array.isArray(datos.entrenamientos) ? datos.entrenamientos : [])
    .filter((e) => e && typeof e.nombre === 'string' && !nombres.has(e.nombre)).map(sinId);
  const ajustesResp = Object.entries(datos.ajustes || {}).filter(([k]) => CLAVES_AJUSTES.includes(k))
    .map(([k, v]) => [k, aTexto(k, v)]).filter(([, v]) => v !== undefined);
  const cambia = (k, v) => leer(k) != null && leer(k) !== v;
  const distintos = [];
  if (datos.programa && programa && JSON.stringify(programa) !== JSON.stringify(datos.programa)) distintos.push('el plan');
  if (ajustesResp.some(([k, v]) => k === 'personaje' && cambia(k, v))) distintos.push('el héroe');
  if (ajustesResp.some(([k, v]) => CLAVES_PERFIL.includes(k) && cambia(k, v))) distintos.push('tus ajustes');
  return { sesionesNuevas, entNuevos, ajustesResp, distintos, invalidas: datos.sesiones.length - validas.length };
}

// «el plan, el héroe y tus ajustes»
export function listaHumana(cosas) {
  return cosas.join(', ').replace(/, ([^,]*)$/, ' y $1');
}

// ---------- Archivo comprimido (etapa 23, P5) ----------
// El respaldo se escribe por trozos (una sesión cada vez, sin armar un texto gigante) y se comprime con gzip:
// 600 sesiones pasan de unos 65 MB a unos pocos. Restaurar acepta el .json.gz y el .json de siempre.
export const TIPO_GZ = 'application/gzip';

// I-2 (INF-R3): todas las sesiones con sus muestras, de n en n (por id; 5 por defecto), sin pasar por la caché de
// historial.js: el respaldo las escribe una a una al archivo y nunca tiene el historial entero en memoria.
/** @returns {AsyncGenerator<any[]>} */
export async function* porLotes(n = 5) {
  let desde = null;
  for (;;) {
    const { lote, ultimo } = await db.tx(['sesiones', 'muestras', 'rr'], 'readonly', (t) => {
      const ss = t.objectStore('sesiones').getAll(desde == null ? null : IDBKeyRange.lowerBound(desde, true), n);
      const lote = [];
      // Cada sesión con sus muestras y sus RR (I-3), que en la base van aparte.
      ss.onsuccess = () => ss.result.forEach((x, i) => {
        lote[i] = { ...x };
        for (const a of ['muestras', 'rr']) {
          if (x[a]) continue;
          const r = t.objectStore(a).get(x.id);
          r.onsuccess = () => { if (r.result) lote[i][a] = r.result; };
        }
      });
      return () => ({ lote, ultimo: ss.result.at(-1)?.id });
    });
    if (lote.length) yield lote;
    if (lote.length < n) return;
    desde = ultimo;
  }
}

/**
 * I-2 (INF-R3): el archivo del respaldo escrito en flujo, sesión por sesión, desde `lotes` (una función que da un
 * iterable asíncrono de listas de sesiones): con gzip, en memoria solo queda lo comprimido. Devuelve
 * { archivo, total } (total: cuántas sesiones van). Sin CompressionStream (o con comprimir: false), un .json.
 * @param {Record<string, any>} cabecera el respaldo sin sesiones @param {() => AsyncIterable<any[]>} lotes
 * @param {string} nombre sin extensión
 */
export async function archivoRespaldo(cabecera, lotes, nombre, { comprimir = true } = {}) {
  const enc = new TextEncoder();
  const { sesiones: _, ...resto } = cabecera;
  const it = lotes()[Symbol.asyncIterator]();
  let fase = 0;
  let total = 0;
  const flujo = new ReadableStream({
    async pull(c) {
      if (fase === 0) { fase = 1; c.enqueue(enc.encode(`${JSON.stringify(resto).slice(0, -1)},"sesiones":[`)); return; }
      const { value, done } = await it.next();
      if (done) { c.enqueue(enc.encode(']}')); c.close(); return; }
      c.enqueue(enc.encode(value.map((x) => `${total++ ? ',' : ''}${JSON.stringify(x)}`).join('')));
    },
    async cancel() { await it.return?.(); },
  });
  const gz = comprimir && typeof CompressionStream === 'function';
  const blob = await new Response(gz ? flujo.pipeThrough(new CompressionStream('gzip')) : flujo).blob();
  return { archivo: new File([blob], `${nombre}.json${gz ? '.gz' : ''}`, { type: gz ? TIPO_GZ : 'application/json' }), total };
}

/** Lee un archivo de respaldo, comprimido o no, y devuelve su JSON (lanza si no es JSON). @param {Blob} archivo */
export async function leerArchivo(archivo) {
  const cab = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
  const gz = cab[0] === 0x1f && cab[1] === 0x8b;
  const texto = gz ? await new Response(archivo.stream().pipeThrough(new DecompressionStream('gzip'))).text() : await archivo.text();
  return JSON.parse(texto);
}
