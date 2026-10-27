#!/usr/bin/env node
// Importa una imagen generada externamente (IA o ilustración) al pipeline de personajes.
// Quita el fondo verde croma (#00B140 o similar), elimina el halo verde de los bordes,
// recorta al contenido y lo coloca en el lienzo estándar con los pies en el pivote.
// Uso:
//   node tools/ingest-character.mjs entrada/vikingo_novato.png --class vikingo --rank novato \
//     [--tool "nombre y versión"] [--prompt docs/PROMPT_CARDS.md#vikingo] [--no-key] [--force]
//   --no-key  la imagen ya trae transparencia; no se aplica croma.
// Reglas: igual que render-characters (no sobrescribe aprobados; rangos superiores exigen el maestro aprobado).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { CLASES, RANGOS, FORMATO, VERSION_MAESTRO } from './characters/spec.mjs';
import { archivos, clave, dirDe, escribirJson, leerAprobaciones, RUTA_APROBACIONES } from './lib/assets.mjs';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const entrada = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null;
const clase = opt('class'), rango = opt('rank');
const fallar = (m) => { console.error(`✗ ${m}`); process.exit(1); };
if (!entrada || !existsSync(entrada)) fallar('indica una imagen de entrada que exista');
if (!CLASES[clase]) fallar(`clase inválida: ${clase}`);
if (!RANGOS.some((r) => r.id === rango)) fallar(`rango inválido: ${rango}`);
const aprob = leerAprobaciones();
if (aprob.registros[clave(clase, rango)]?.estado === 'approved' && !args.includes('--force')) fallar(`${clase}/${rango} ya está aprobado; usa --force`);
if (rango !== RANGOS[0].id && aprob.registros[clave(clase, RANGOS[0].id)]?.estado !== 'approved') fallar(`el maestro ${clase}/${RANGOS[0].id} no está aprobado`);

const ext = extname(entrada).toLowerCase();
const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
const datos = `data:${mime};base64,${readFileSync(entrada).toString('base64')}`;
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage();
const res = await p.evaluate(async ({ datos, F, croma }) => {
  const img = new Image();
  img.src = datos;
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;
  const cv = new OffscreenCanvas(w, h), cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, w, h), px = d.data;
  if (croma) {
    // Color de fondo estimado con las esquinas.
    const muestras = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]].map(([x, y]) => { const o = (y * w + x) * 4; return [px[o], px[o + 1], px[o + 2]]; });
    const fondo = [0, 1, 2].map((i) => muestras.reduce((s, m) => s + m[i], 0) / muestras.length);
    if (!(fondo[1] > fondo[0] + 40 && fondo[1] > fondo[2] + 40)) return { error: `el fondo no parece verde croma (rgb ${fondo.map(Math.round).join(',')})` };
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], bl = px[i + 2];
      // "Verdosidad": cuánto supera el verde al mayor de rojo y azul.
      const v = g - Math.max(r, bl);
      const a = v > 70 ? 0 : v < 25 ? 1 : 1 - (v - 25) / 45;
      px[i + 3] = Math.round(px[i + 3] * a);
      if (a > 0 && v > 0) px[i + 1] = Math.max(r, bl) + Math.min(v, 6); // quita el halo verde
    }
    cx.putImageData(d, 0, 0);
  }
  // Caja del contenido
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { error: 'la imagen queda vacía al quitar el fondo' };
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  // Escala: de la cabeza (5 %) a los pies (pivote) del lienzo, sin salirse de los lados.
  const W = F.cuerpo.ancho, H = F.cuerpo.alto;
  const alto = H * (F.pivote.y - 0.05), esc = Math.min(alto / ch, (W - 2 * 12) / cw);
  const out = new OffscreenCanvas(W, H), o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  const dw = cw * esc, dh = ch * esc;
  o.drawImage(cv, x0, y0, cw, ch, W * F.pivote.x - dw / 2, H * F.pivote.y - dh, dw, dh);
  // Retrato: cuadrado sobre el 30 % superior del personaje.
  const lado = Math.min(dh * 0.3, W), rx = W * F.pivote.x - lado / 2, ry = H * F.pivote.y - dh - lado * 0.04;
  const ret = new OffscreenCanvas(F.retrato.ancho, F.retrato.alto), r = ret.getContext('2d');
  r.imageSmoothingQuality = 'high';
  r.drawImage(out, rx, ry, lado, lado, 0, 0, F.retrato.ancho, F.retrato.alto);
  // Conversión a base64 por trozos: expandir todo el buffer como argumentos desborda la pila.
  const aUrl = async (c) => {
    const b = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let bin = '';
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return `data:image/png;base64,${btoa(bin)}`;
  };
  return { cuerpo: await aUrl(out), retrato: await aUrl(ret), origen: { ancho: w, alto: h, caja: { x0, y0, x1, y1 } }, escala: esc };
}, { datos, F: FORMATO, croma: !args.includes('--no-key') }).catch((e) => ({ error: e.message }));
await b.close();
if (res.error) fallar(res.error);

const dir = dirDe(clase, rango);
mkdirSync(dir, { recursive: true });
const f = archivos(clase, rango);
const { writeFileSync } = await import('node:fs');
const guardar = (url, nombre) => writeFileSync(join(dir, nombre), Buffer.from(url.split(',')[1], 'base64'));
guardar(res.cuerpo, f.cuerpo);
guardar(res.retrato, f.retrato);
if (existsSync(join(dir, f.svg))) rmSync(join(dir, f.svg)); // la fuente ahora es raster
const fuente = `${clase}_${rango}_source${ext}`;
copyFileSync(entrada, join(dir, fuente));
escribirJson(join(dir, f.meta), {
  clase, rango, versionMaestro: VERSION_MAESTRO,
  herramienta: { nombre: 'tools/ingest-character.mjs', motor: 'Chromium canvas (croma, recorte, escala)', parametros: { croma: !args.includes('--no-key'), escala: Number(res.escala.toFixed(4)) } },
  fuente: { tipo: 'imagen generada externamente', archivo: fuente, generador: opt('tool') || 'sin indicar', prompt: opt('prompt') || 'sin indicar', origen: res.origen, licencia: 'según los términos del generador' },
  pivote: FORMATO.pivote,
});
if (!aprob.registros[clave(clase, rango)]) aprob.registros[clave(clase, rango)] = { estado: 'pending', version: VERSION_MAESTRO, notas: '' };
else aprob.registros[clave(clase, rango)].estado = 'pending';
escribirJson(RUTA_APROBACIONES, aprob);
console.log(`✓ ${clase}/${rango} importado (escala ${res.escala.toFixed(3)}). Ejecuta build-manifest y validate-assets.`);
