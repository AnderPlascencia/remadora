// Remero, barca y remos realistas de cada clase en la carrera 2D y 3D: atlas de Blender (tools/blender/remo_agua).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { REMEROS_ATLAS, srcRemero } from '../src/carrera.js';

// Ancho y alto de un WebP (cabeceras VP8X, VP8L o VP8)
function medidas(ruta) {
  const b = readFileSync(ruta);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF', ruta);
  assert.equal(b.toString('ascii', 8, 12), 'WEBP', ruta);
  const tipo = b.toString('ascii', 12, 16);
  if (tipo === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tipo === 'VP8L') {
    const n = b.readUInt32LE(21);
    return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)];
  }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

for (const vista of ['3d', '2d']) {
  const A = REMEROS_ATLAS[vista];
  // Una palada entera, repartida en una rejilla sin huecos de más
  assert.ok(A.n >= 16, `${vista}: fotogramas`);
  assert.ok(A.cols * Math.ceil(A.n / A.cols) - A.n < A.cols, `${vista}: rejilla`);
  // El ancla (escálamo a ras de agua) cae dentro de la celda
  assert.ok(A.ancla[0] > 0 && A.ancla[0] < A.w && A.ancla[1] > 0 && A.ancla[1] < A.h, `${vista}: ancla`);
  for (const clase of ['vikingo', 'pirata', 'samurai', 'polinesio', 'romano']) {
    const src = srcRemero(vista, clase);
    assert.match(src, /^assets\/carrera\/remero(2d|3d)_[a-z]+\.webp$/);
    assert.ok(existsSync(src), `${src} existe`);
    // Cada atlas mide lo que dice REMEROS_ATLAS y no pasa de 300 KB (se descarga al salir esa clase)
    assert.deepEqual(medidas(src), [A.cols * A.w, Math.ceil(A.n / A.cols) * A.h], `${src}: medidas`);
    assert.ok(statSync(src).size < 300_000, `${src}: peso`);
  }
}

// El service worker no los precarga al instalar: precargarRecursos() pide solo los de tu clase
const sw = readFileSync('sw.js', 'utf8');
assert.ok(!/remero(2d|3d)_/.test(sw), 'sw.js no lista los atlas');
const heroe = readFileSync('src/pantallas/heroe.js', 'utf8');
assert.match(heroe, /srcRemero\('3d', clave\), srcRemero\('2d', clave\)/);
