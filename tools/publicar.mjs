// Arma la carpeta que se publica (por defecto, publicar/): solo lo que la app carga en el teléfono.
// Uso: npm run publicar [-- <carpeta>]
// No sube nada a ningún sitio: la carpeta queda lista para subirla a mano (ver «Publicación» en el README).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// Lo que entra: la página, el manifest, el service worker, el código y los recursos.
export const INCLUIR = ['index.html', 'manifest.webmanifest', 'sw.js', 'src', 'assets'];
// Lo que nunca entra aunque esté dentro de lo anterior: fuentes de arte y herramientas de trabajo.
export const EXCLUIR = ['assets/characters', 'tools', 'docs', '.claude', 'pruebas', 'node_modules'];

const normal = (r) => r.split(sep).join('/');
export function debePublicarse(ruta) {
  const r = normal(ruta).replace(/^\.\//, '');
  if (EXCLUIR.some((x) => r === x || r.startsWith(`${x}/`))) return false;
  if (r.split('/').some((p) => p.startsWith('.'))) return false;
  return INCLUIR.some((x) => r === x || r.startsWith(`${x}/`));
}

// Lista de archivos a publicar, relativa a la raíz del repo.
export function archivosAPublicar(raiz = RAIZ) {
  const lista = [];
  const recorrer = (rel) => {
    const abs = join(raiz, rel);
    if (!existsSync(abs) || !debePublicarse(rel)) return;
    if (statSync(abs).isDirectory()) for (const f of readdirSync(abs)) recorrer(rel ? `${rel}/${f}` : f);
    else lista.push(normal(rel));
  };
  for (const x of INCLUIR) recorrer(x);
  return lista.sort();
}

export function publicar(destino = join(RAIZ, 'publicar'), raiz = RAIZ) {
  rmSync(destino, { recursive: true, force: true });
  const lista = archivosAPublicar(raiz);
  for (const f of lista) {
    mkdirSync(dirname(join(destino, f)), { recursive: true });
    cpSync(join(raiz, f), join(destino, f));
  }
  return lista;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const destino = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(RAIZ, 'publicar');
  const lista = publicar(destino);
  const bytes = lista.reduce((a, f) => a + statSync(join(destino, f)).size, 0);
  console.log(`${lista.length} archivos (${(bytes / 1e6).toFixed(1)} MB) en ${relative(process.cwd(), destino) || '.'}`);
}
