#!/usr/bin/env node
// Genera assets/characters/manifest.json a partir de los archivos que existen realmente.
// Idempotente: mismo contenido de entrada → mismo manifiesto (sin marcas de tiempo).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CLASES, RANGOS, FORMATO } from './characters/spec.mjs';
import { archivos, clave, dirDe, escribirJson, leerAprobaciones, leerJson, RAIZ, RUTA_MANIFIESTO } from './lib/assets.mjs';
import { leerPng } from './lib/png.mjs';

const aprob = leerAprobaciones();
const assets = [];
for (const clase of Object.keys(CLASES)) {
  for (const r of RANGOS) {
    const dir = dirDe(clase, r.id);
    if (!existsSync(dir)) continue;
    const f = archivos(clase, r.id);
    const meta = leerJson(join(dir, f.meta), {});
    const estado = aprob.registros[clave(clase, r.id)]?.estado || 'pending';
    const fuente = meta.fuente?.archivo || f.svg;
    for (const [tipo, nombre] of [['cuerpo', f.cuerpo], ['retrato', f.retrato], ['fuente', fuente]]) {
      const ruta = join(dir, nombre);
      if (!existsSync(ruta)) continue;
      const png = nombre.endsWith('.png') && tipo !== 'fuente' ? leerPng(ruta, { pixeles: false }) : null;
      assets.push({
        id: `${clase}.${r.id}.${tipo}`,
        clase, rango: r.id, nombre,
        ruta: relative(RAIZ, ruta),
        tipo,
        dimensiones: png ? { ancho: png.ancho, alto: png.alto } : nombre.endsWith('.svg') ? { viewBox: FORMATO.viewBox } : null,
        formato: png ? 'png' : nombre.split('.').pop(),
        transparencia: png ? png.alfa : true,
        bytes: statSync(ruta).size,
        fotogramas: 1,
        animaciones: [],
        duracionFotogramaMs: null,
        pivote: tipo === 'retrato' ? null : FORMATO.pivote,
        versionMaestro: meta.versionMaestro ?? null,
        estado,
        herramienta: meta.herramienta ?? null,
      });
    }
  }
}
const manifiesto = { schema: 1, generadoPor: 'tools/build-manifest.mjs', total: assets.length, assets };
escribirJson(RUTA_MANIFIESTO, manifiesto);
console.log(`✓ manifest.json con ${assets.length} assets`);
