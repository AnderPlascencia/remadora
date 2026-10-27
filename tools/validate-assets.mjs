#!/usr/bin/env node
// Validación técnica de los assets de personajes. No juzga la calidad artística.
// Comprueba estructura y nombres, archivos faltantes, dimensiones, transparencia,
// recortes en los bordes, metadatos y coherencia del manifiesto con los archivos.
// Uso: node tools/validate-assets.mjs [--json] [--strict]
//   --strict  trata como error que falte cualquiera de las 25 combinaciones.
// Sale con código 1 si hay errores.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CLASES, RANGOS, FORMATO } from './characters/spec.mjs';
import { archivos, clave, dirDe, DIR_PERSONAJES, leerAprobaciones, leerJson, RAIZ, RUTA_MANIFIESTO } from './lib/assets.mjs';
import { leerPng, analizarAlfa } from './lib/png.mjs';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const errores = [], avisos = [];
const filas = [];
const ESTADOS = ['pending', 'approved', 'rejected'];
const RAIZ_PERMITIDA = new Set([...Object.keys(CLASES), 'approvals.json', 'manifest.json', '_qa', '_source']);

// 1. Estructura: nada inesperado en la raíz ni en las carpetas de clase.
if (!existsSync(DIR_PERSONAJES)) errores.push('no existe assets/characters');
else for (const n of readdirSync(DIR_PERSONAJES)) if (!RAIZ_PERMITIDA.has(n)) errores.push(`assets/characters/${n}: nombre no permitido (clases: ${Object.keys(CLASES).join(', ')})`);
for (const clase of Object.keys(CLASES)) {
  const d = join(DIR_PERSONAJES, clase);
  if (!existsSync(d)) continue;
  for (const n of readdirSync(d)) if (!RANGOS.some((r) => r.id === n)) errores.push(`${clase}/${n}: rango no permitido (${RANGOS.map((r) => r.id).join(', ')})`);
}

// 2. Aprobaciones
const aprob = leerAprobaciones();
for (const [k, v] of Object.entries(aprob.registros)) {
  const [c, r] = k.split('/');
  if (!CLASES[c] || !RANGOS.some((x) => x.id === r)) errores.push(`approvals.json: clave inválida ${k}`);
  if (!ESTADOS.includes(v.estado)) errores.push(`approvals.json: ${k} tiene estado inválido "${v.estado}"`);
}

// 3. Cada combinación
function revisarPng(ruta, esperado, etiqueta, problemas, minTransparente = 0.2, soloEsquinasSup = false) {
  let png;
  try { png = leerPng(ruta); } catch (e) { problemas.push(`${etiqueta}: ${e.message}`); return; }
  if (png.ancho !== esperado.ancho || png.alto !== esperado.alto) problemas.push(`${etiqueta}: mide ${png.ancho}×${png.alto}, se esperaba ${esperado.ancho}×${esperado.alto}`);
  if (!png.alfa) { problemas.push(`${etiqueta}: sin canal alfa`); return; }
  const a = analizarAlfa(png);
  if (!a.caja) { problemas.push(`${etiqueta}: imagen vacía`); return; }
  if (a.transparentes < minTransparente) problemas.push(`${etiqueta}: solo ${(a.transparentes * 100).toFixed(1)} % transparente (¿fondo horneado?)`);
  // Un retrato de busto corta los hombros por abajo: solo se exigen transparentes las esquinas superiores.
  const esquinas = [[0, 0], [png.ancho - 1, 0], ...(soloEsquinasSup ? [] : [[0, png.alto - 1], [png.ancho - 1, png.alto - 1]])];
  if (esquinas.some(([x, y]) => png.rgba[(y * png.ancho + x) * 4 + 3] !== 0)) problemas.push(`${etiqueta}: esquinas no transparentes`);
  return a;
}
for (const clase of Object.keys(CLASES)) {
  for (const r of RANGOS) {
    const k = clave(clase, r.id);
    const dir = dirDe(clase, r.id);
    const estado = aprob.registros[k]?.estado;
    if (!existsSync(dir)) {
      if (estado) errores.push(`${k}: figura en approvals.json pero no hay archivos`);
      (strict ? errores : []).push(`${k}: falta`);
      filas.push({ k, estado: 'falta' });
      continue;
    }
    const problemas = [];
    const f = archivos(clase, r.id);
    const metaPre = leerJson(join(dir, f.meta), {});
    const raster = metaPre?.fuente?.tipo === 'imagen generada externamente';
    const esperados = raster ? [f.cuerpo, f.retrato, f.meta, metaPre.fuente.archivo].filter(Boolean) : [f.svg, f.cuerpo, f.retrato, f.meta];
    for (const n of esperados) if (!existsSync(join(dir, n))) problemas.push(`${k}: falta ${n}`);
    for (const n of readdirSync(dir)) if (![...esperados, f.notas].includes(n)) problemas.push(`${k}: archivo inesperado ${n}`);
    if (!raster && existsSync(join(dir, f.svg))) {
      const svg = readFileSync(join(dir, f.svg), 'utf8');
      if (!svg.trimStart().startsWith('<svg') || !svg.includes(`data-clase="${clase}"`) || !svg.includes(`data-rango="${r.id}"`)) problemas.push(`${k}: el SVG no corresponde a la clase o el rango`);
    }
    if (existsSync(join(dir, f.cuerpo))) {
      const a = revisarPng(join(dir, f.cuerpo), FORMATO.cuerpo, `${k} cuerpo`, problemas);
      if (a) {
        const m = FORMATO.margenMin, { x0, y0, x1, y1 } = a.caja;
        if (x0 < m || y0 < m || x1 > FORMATO.cuerpo.ancho - 1 - m || y1 > FORMATO.cuerpo.alto - 1 - m) problemas.push(`${k} cuerpo: el contenido toca el borde (posible recorte) caja ${x0},${y0}–${x1},${y1}`);
        const base = y1 / FORMATO.cuerpo.alto;
        if (Math.abs(base - FORMATO.pivote.y) > 0.03) avisos.push(`${k}: la base del personaje está en ${(base * 100).toFixed(1)} % de la altura (pivote ${FORMATO.pivote.y * 100} %)`);
      }
    }
    // El retrato es un busto: los hombros llenan la parte baja, así que se pide menos transparencia.
    if (existsSync(join(dir, f.retrato))) revisarPng(join(dir, f.retrato), FORMATO.retrato, `${k} retrato`, problemas, 0.05, true);
    const meta = leerJson(join(dir, f.meta), null);
    if (meta) {
      for (const campo of ['clase', 'rango', 'versionMaestro', 'herramienta', 'fuente', 'pivote']) if (meta[campo] == null) problemas.push(`${k}: meta.json sin "${campo}"`);
      if (meta.clase !== clase || meta.rango !== r.id) problemas.push(`${k}: meta.json no coincide con su carpeta`);
    }
    if (!estado) problemas.push(`${k}: no está registrado en approvals.json`);
    errores.push(...problemas);
    filas.push({ k, estado: problemas.length ? 'fallido' : estado });
  }
}

// 4. Manifiesto vs archivos reales
const man = leerJson(RUTA_MANIFIESTO, null);
if (!man) avisos.push('no hay manifest.json (ejecuta tools/build-manifest.mjs)');
else {
  const enDisco = new Set();
  for (const clase of Object.keys(CLASES)) for (const r of RANGOS) {
    const dir = dirDe(clase, r.id), f = archivos(clase, r.id);
    const fu = leerJson(join(dir, f.meta), {})?.fuente?.archivo;
    for (const n of [f.svg, f.cuerpo, f.retrato, fu].filter(Boolean)) if (existsSync(join(dir, n))) enDisco.add(join('assets/characters', clase, r.id, n));
  }
  const enMan = new Set(man.assets.map((a) => a.ruta));
  for (const a of man.assets) {
    if (!existsSync(join(RAIZ, a.ruta))) { errores.push(`manifest: ${a.ruta} no existe`); continue; }
    if (a.formato === 'png') {
      const p = leerPng(join(RAIZ, a.ruta), { pixeles: false });
      if (p.ancho !== a.dimensiones.ancho || p.alto !== a.dimensiones.alto) errores.push(`manifest: ${a.ruta} dice ${a.dimensiones.ancho}×${a.dimensiones.alto} y mide ${p.ancho}×${p.alto}`);
    }
    if (statSync(join(RAIZ, a.ruta)).size !== a.bytes) errores.push(`manifest: ${a.ruta} cambió desde que se generó el manifiesto`);
    const est = aprob.registros[clave(a.clase, a.rango)]?.estado || 'pending';
    if (a.estado !== est) errores.push(`manifest: ${a.ruta} dice "${a.estado}" y approvals.json "${est}"`);
  }
  for (const r of enDisco) if (!enMan.has(r)) errores.push(`manifest: falta ${r}`);
}

// 5. Reporte
const cuenta = (e) => filas.filter((f) => f.estado === e).length;
if (args.includes('--json')) console.log(JSON.stringify({ errores, avisos, filas }, null, 2));
else {
  const marca = { approved: '✓ aprobado', pending: '… pendiente', rejected: '✗ rechazado', fallido: '✗ fallido', falta: '· falta' };
  console.log('Clase/rango'.padEnd(26) + 'Estado');
  for (const f of filas) console.log(f.k.padEnd(26) + marca[f.estado]);
  console.log(`\nAprobados ${cuenta('approved')} · pendientes ${cuenta('pending')} · fallidos ${cuenta('fallido')} · rechazados ${cuenta('rejected')} · faltan ${cuenta('falta')} de ${filas.length}`);
  for (const a of avisos) console.log(`! ${a}`);
  for (const e of errores) console.log(`✗ ${e}`);
  console.log(errores.length ? `\n${errores.length} error(es)` : '\nSin errores técnicos. La aprobación artística es manual.');
}
process.exit(errores.length ? 1 : 0);
