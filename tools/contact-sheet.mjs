#!/usr/bin/env node
// Hoja de contacto para revisión visual: cada personaje sobre damero (transparencia),
// sobre el fondo de la app, en silueta y a los tamaños reales de uso.
// Uso: node tools/contact-sheet.mjs [--rank novato] [--class vikingo]
//   Sin --rank genera la hoja de los maestros; con --class compara los 5 rangos de una clase.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { CLASES, RANGOS, FORMATO } from './characters/spec.mjs';
import { archivos, dirDe, DIR_PERSONAJES } from './lib/assets.mjs';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const clase = opt('class');
const rango = opt('rank') || RANGOS[0].id;
const filas = clase ? RANGOS.map((r) => [clase, r.id]) : Object.keys(CLASES).map((k) => [k, rango]);
const datos = (ruta) => `data:image/png;base64,${readFileSync(ruta).toString('base64')}`;
const celdas = [];
for (const [c, r] of filas) {
  const f = archivos(c, r);
  const cuerpo = join(dirDe(c, r), f.cuerpo), retrato = join(dirDe(c, r), f.retrato);
  if (!existsSync(cuerpo)) { celdas.push(`<tr><th>${c}/${r}</th><td colspan="6" class="falta">falta</td></tr>`); continue; }
  const src = datos(cuerpo);
  celdas.push(`<tr><th>${CLASES[c].nombre}<small>${r}</small></th>
    <td class="dam"><img src="${src}" height="300"></td><td class="app"><img src="${src}" height="300"></td>
    <td class="app"><img src="${src}" height="300" style="filter:brightness(0)"></td>
    <td class="app tam">${FORMATO.tamanosJuego.slice().reverse().map((h) => `<img src="${src}" height="${h}">`).join('')}</td>
    <td class="dam"><img src="${datos(retrato)}" width="128"></td></tr>`);
}
const html = `<html><head><style>
body{margin:0;background:#E9EBE2;font:14px system-ui;color:#1A2014}table{border-collapse:separate;border-spacing:8px}
th{text-align:left;width:110px;font-size:16px}th small{display:block;font-weight:400;color:#56604A}
td{padding:6px;border-radius:6px;vertical-align:bottom}.dam{background:repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0 0/20px 20px}
.app{background:#111410}.tam img{margin-right:10px}.falta{background:#fdd;color:#900}
thead td{font-weight:600;font-size:12px;color:#56604A;padding:0 6px}</style></head><body><table>
<thead><tr><td></td><td>Transparencia</td><td>Fondo de la app</td><td>Silueta</td><td>Tamaños de uso: ${FORMATO.tamanosJuego.slice().reverse().join(' / ')} px</td><td>Retrato</td></tr></thead>
${celdas.join('')}</table></body></html>`;
const dirQa = join(DIR_PERSONAJES, '_qa');
mkdirSync(dirQa, { recursive: true });
const salida = join(dirQa, clase ? `contact_${clase}.png` : `contact_${rango}.png`);
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1180, height: 400 } });
await p.setContent(html);
await p.screenshot({ path: salida, fullPage: true });
await b.close();
console.log(`✓ ${salida}`);
