#!/usr/bin/env node
// Exporta personajes: SVG fuente + PNG de cuerpo entero + PNG de retrato, con meta.json.
// Uso:
//   node tools/render-characters.mjs                 # fase 1: los 5 maestros (principiante)
//   node tools/render-characters.mjs --class vikingo --rank combatiente
//   node tools/render-characters.mjs --force          # permite sobrescribir assets aprobados
// Reglas:
//   - Un rango distinto de principiante exige que el maestro de su clase esté aprobado.
//   - Nunca sobrescribe un asset con estado "approved" sin --force.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { personaje } from './characters/generator.mjs';
import { CLASES, RANGOS, FORMATO, VERSION_MAESTRO } from './characters/spec.mjs';
import { archivos, clave, dirDe, escribirJson, leerAprobaciones, RUTA_APROBACIONES } from './lib/assets.mjs';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const force = args.includes('--force');
const MAESTRO = 'principiante';

const clases = opt('class') ? [opt('class')] : Object.keys(CLASES);
const rangos = opt('rank') ? [opt('rank')] : [MAESTRO];
const aprob = leerAprobaciones();
const errores = [];
const trabajos = [];
for (const clase of clases) {
  if (!CLASES[clase]) { errores.push(`clase desconocida: ${clase}`); continue; }
  for (const rango of rangos) {
    if (!RANGOS.some((r) => r.id === rango)) { errores.push(`rango desconocido: ${rango}`); continue; }
    const reg = aprob.registros[clave(clase, rango)];
    if (rango !== MAESTRO && aprob.registros[clave(clase, MAESTRO)]?.estado !== 'approved') {
      errores.push(`${clase}/${rango}: el maestro ${clase}/${MAESTRO} no está aprobado`); continue;
    }
    if (reg?.estado === 'approved' && !force) { errores.push(`${clase}/${rango}: ya está aprobado; usa --force para regenerarlo`); continue; }
    trabajos.push({ clase, rango });
  }
}
if (errores.length) { console.error(errores.map((e) => `✗ ${e}`).join('\n')); if (!trabajos.length) process.exit(1); }

const { chromium } = require('playwright');
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
const [vx, vy, vw, vh] = FORMATO.viewBox;
async function png(svg, ancho, alto, ruta) {
  await pagina.setViewportSize({ width: ancho, height: alto });
  await pagina.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await pagina.screenshot({ path: ruta, omitBackground: true, clip: { x: 0, y: 0, width: ancho, height: alto } });
}
for (const { clase, rango } of trabajos) {
  const params = { rango, masa: 0, def: 0 };
  const dir = dirDe(clase, rango);
  mkdirSync(dir, { recursive: true });
  const f = archivos(clase, rango);
  const svg = personaje(clase, { ...params, ancho: FORMATO.cuerpo.ancho });
  writeFileSync(join(dir, f.svg), `${svg.replace(/\n\s+/g, '\n')}\n`);
  await png(svg, FORMATO.cuerpo.ancho, FORMATO.cuerpo.alto, join(dir, f.cuerpo));
  const [rx, ry, rw, rh] = FORMATO.recorteRetrato;
  const retrato = svg.replace(/viewBox="[^"]+" width="\d+" height="\d+"/, `viewBox="${rx} ${ry} ${rw} ${rh}" width="${FORMATO.retrato.ancho}" height="${FORMATO.retrato.alto}"`);
  await png(retrato, FORMATO.retrato.ancho, FORMATO.retrato.alto, join(dir, f.retrato));
  escribirJson(join(dir, f.meta), {
    clase, rango, versionMaestro: VERSION_MAESTRO,
    herramienta: { nombre: 'tools/characters/generator.mjs', motor: 'SVG + Chromium (Playwright)', parametros: params },
    fuente: { tipo: 'vector generado por código', licencia: 'propia del proyecto', proveedorExterno: null },
    viewBox: [vx, vy, vw, vh], pivote: FORMATO.pivote,
  });
  if (!aprob.registros[clave(clase, rango)]) aprob.registros[clave(clase, rango)] = { estado: 'pending', version: VERSION_MAESTRO, notas: '' };
  console.log(`✓ ${clase}/${rango}`);
}
await navegador.close();
escribirJson(RUTA_APROBACIONES, aprob);
