// Utilidades compartidas: rutas, nombres y registro de aprobaciones de personajes.
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_PERSONAJES = join(RAIZ, 'assets', 'characters');
export const RUTA_APROBACIONES = join(DIR_PERSONAJES, 'approvals.json');
export const RUTA_MANIFIESTO = join(DIR_PERSONAJES, 'manifest.json');

export const clave = (clase, rango) => `${clase}/${rango}`;
export const archivos = (clase, rango) => ({
  svg: `${clase}_${rango}.svg`,
  cuerpo: `${clase}_${rango}_full.png`,
  retrato: `${clase}_${rango}_portrait.png`,
  meta: 'meta.json',
  notas: 'notes.md',
});
export const dirDe = (clase, rango) => join(DIR_PERSONAJES, clase, rango);

export function leerJson(ruta, porDefecto) {
  if (!existsSync(ruta)) return porDefecto;
  return JSON.parse(readFileSync(ruta, 'utf8'));
}
// Escritura atómica: primero a un temporal y luego se renombra, para no dejar JSON a medias.
export function escribirJson(ruta, datos) {
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(datos, null, 2)}\n`);
  renameSync(tmp, ruta);
}
export const leerAprobaciones = () => leerJson(RUTA_APROBACIONES, { version: 1, registros: {} });
