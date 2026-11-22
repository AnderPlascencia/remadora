// Huellas de contenido para la caché del service worker (etapa 19) y la lista de precarga de módulos de index.html.
// - huellas.json: { «ruta publicada»: primeros 16 hex del SHA-256 }. Al instalar una versión nueva, sw.js copia de la
//   caché anterior todo lo que no cambió y solo baja lo distinto: una versión sin arte nuevo ya no vuelve a bajar las
//   imágenes, y el código que no cambió tampoco.
// - index.html: <link rel="modulepreload"> de todo lo que src/app.js importa al arrancar, para que el navegador los pida
//   todos a la vez en lugar de ir descubriéndolos módulo por módulo.
// Uso: node tools/huellas.mjs (lo corre `npm test` fuera del CI). En el CI, pruebas/huellas.test.mjs comprueba que
// están al día: si falla, corre `npm test` (o este archivo) y sube los cambios.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archivosAPublicar } from './publicar.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARCHIVO_HUELLAS = 'huellas.json';
// Lo que no lleva huella: el propio service worker (lo revisa el navegador) y el archivo de huellas.
const SIN_HUELLA = new Set(['sw.js', ARCHIVO_HUELLAS]);

export const huella = (datos) => createHash('sha256').update(datos).digest('hex').slice(0, 16);

export function calcularHuellas(raiz = RAIZ) {
  const res = {};
  for (const f of archivosAPublicar(raiz)) if (!SIN_HUELLA.has(f)) res[f] = huella(readFileSync(join(raiz, f)));
  return res;
}
export const textoHuellas = (h) => `${JSON.stringify(Object.fromEntries(Object.entries(h).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1)}\n`;

// Módulos que src/app.js carga al arrancar (los import estáticos, sin los import() que se cargan al abrir algo).
export function modulosDeArranque(raiz = RAIZ) {
  const vistos = new Set();
  const pendientes = ['src/app.js'];
  while (pendientes.length) {
    const f = pendientes.pop();
    if (vistos.has(f)) continue;
    vistos.add(f);
    const texto = readFileSync(join(raiz, f), 'utf8');
    for (const [, dep] of texto.matchAll(/^import[^'"]*['"](\.{1,2}\/[\w./-]+\.js)['"]/gm)) pendientes.push(posix.join(posix.dirname(f), dep));
  }
  return [...vistos].sort();
}

const INICIO = '<!-- precarga de módulos: la genera tools/huellas.mjs -->';
const FIN = '<!-- /precarga de módulos -->';
export function conPrecarga(html, modulos) {
  const bloque = `${INICIO}\n${modulos.map((m) => `  <link rel="modulepreload" href="${m}">`).join('\n')}\n  ${FIN}`;
  const i = html.indexOf(INICIO);
  if (i >= 0) return html.slice(0, i) + bloque + html.slice(html.indexOf(FIN) + FIN.length);
  // La primera vez: justo después de la hoja de estilos.
  return html.replace(/(<link rel="stylesheet" href="src\/estilos\.css">\n)/, `$1  ${bloque}\n`);
}

export function actualizar(raiz = RAIZ) {
  const rutaHtml = join(raiz, 'index.html');
  const html = readFileSync(rutaHtml, 'utf8');
  const nuevo = conPrecarga(html, modulosDeArranque(raiz).filter((m) => m !== 'src/app.js'));
  if (nuevo !== html) writeFileSync(rutaHtml, nuevo);
  // index.html cambia con la precarga: las huellas van después.
  const rutaH = join(raiz, ARCHIVO_HUELLAS);
  const texto = textoHuellas(calcularHuellas(raiz));
  let antes = '';
  try { antes = readFileSync(rutaH, 'utf8'); } catch { /* primera vez */ }
  if (texto !== antes) writeFileSync(rutaH, texto);
  return { html: nuevo !== html, huellas: texto !== antes };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // --local: en el CI no se toca nada (ahí la prueba comprueba que se subieron al día).
  if (process.argv.includes('--local') && process.env.CI) process.exit(0);
  const r = actualizar();
  if (r.html || r.huellas) console.log(`Actualizado: ${[r.html && 'index.html (precarga)', r.huellas && ARCHIVO_HUELLAS].filter(Boolean).join(' y ')}. Súbelo con tus cambios.`);
}
