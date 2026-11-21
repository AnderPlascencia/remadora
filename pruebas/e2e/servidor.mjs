// Servidor estático mínimo para las pruebas end to end: sirve la raíz del repositorio como GitHub Pages, también con
// gzip para el texto (HTML, JS, CSS, JSON, SVG), así el presupuesto de peso mide lo que de verdad baja el teléfono.
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const PUERTO = Number(process.env.PUERTO || 4173);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};
const COMPRIMIR = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg']);

createServer(async (req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = normalize(join(RAIZ, ruta));
  if (!archivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
  try {
    if (!(await stat(archivo)).isFile()) throw new Error('no es archivo');
    const tipo = extname(archivo);
    const cabeceras = { 'Content-Type': TIPOS[tipo] || 'application/octet-stream', 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' };
    let cuerpo = await readFile(archivo);
    if (COMPRIMIR.has(tipo) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      cuerpo = gzipSync(cuerpo);
      cabeceras['Content-Encoding'] = 'gzip';
    }
    res.writeHead(200, cabeceras);
    res.end(cuerpo);
  } catch {
    res.writeHead(404).end('no encontrado');
  }
}).listen(PUERTO, '127.0.0.1', () => console.log(`servidor de pruebas en http://127.0.0.1:${PUERTO}/`));
