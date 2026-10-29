import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { PERSONAJES_3D, CLASES_3D, tiene3D, varianteDe, piezasOcultas, materialesDe, modeloDe } from '../personajes3d/config.js';
import { CLASES } from '../juego.js';

// Lee el JSON de un GLB (cabecera de 12 bytes + bloque JSON).
const gltf = (ruta) => {
  const b = readFileSync(new URL(`../${ruta}`, import.meta.url));
  assert.equal(b.toString('ascii', 0, 4), 'glTF', ruta);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
};

assert.ok(tiene3D('vikingo'));
assert.ok(!tiene3D('pirata'), 'las demás clases siguen con su ilustración');
assert.ok(!tiene3D('toString'), 'no confunde propiedades heredadas con clases');
for (const c of CLASES_3D) assert.ok(CLASES.some((x) => x.clave === c), `${c} es una clase del juego`);

// Variantes por nivel: 1, 5, 10, 15, 20 y la última se mantiene después.
assert.deepEqual(PERSONAJES_3D.vikingo.variantes.map((v) => v.desde), [1, 5, 10, 15, 20]);
assert.equal(varianteDe('vikingo', 1).desde, 1);
assert.equal(varianteDe('vikingo', 4).desde, 1);
assert.equal(varianteDe('vikingo', 5).desde, 5);
assert.equal(varianteDe('vikingo', 19).desde, 15);
assert.equal(varianteDe('vikingo', 90).desde, 20);
assert.equal(varianteDe('pirata', 10), null);

// El equipo se acumula: a más nivel, nunca hay más piezas ocultas.
let antes = Infinity;
for (const n of [1, 5, 10, 15, 20, 60]) {
  const o = piezasOcultas('vikingo', n, 'idle').size;
  assert.ok(o <= antes, `nivel ${n}`);
  antes = o;
}
assert.ok(piezasOcultas('vikingo', 1, 'idle').has('Capa'));
assert.ok(!piezasOcultas('vikingo', 10, 'idle').has('Capa'));
// El remo solo aparece al remar y el hacha se guarda.
assert.ok(piezasOcultas('vikingo', 20, 'idle').has('RemoMango'));
assert.ok(!piezasOcultas('vikingo', 20, 'rowing').has('RemoMango'));
assert.ok(piezasOcultas('vikingo', 20, 'rowing').has('HachaCabeza'));
assert.ok(!piezasOcultas('vikingo', 20, 'victory').has('HachaCabeza'));
assert.deepEqual(materialesDe('vikingo', 19), {});
assert.deepEqual(materialesDe('vikingo', 20), { HachaCabeza: 'Oro' });

// Calidad: pedida explícitamente o elegida por tamaño de lienzo y memoria.
const { alta, movil } = PERSONAJES_3D.vikingo.modelos;
assert.equal(modeloDe('vikingo', 'alta'), alta);
assert.equal(modeloDe('vikingo', 'movil'), movil);
assert.equal(modeloDe('vikingo', 'auto', { ancho: 220, ratio: 2.6 }), movil);
assert.equal(modeloDe('vikingo', 'auto', { ancho: 900, ratio: 2, memoria: 8 }), alta);
assert.equal(modeloDe('vikingo', 'auto', { ancho: 900, ratio: 2, memoria: 4 }), movil);

// Los GLB existen, pesan lo previsto y traen todo lo que la configuración nombra.
for (const [clase, p] of Object.entries(PERSONAJES_3D)) {
  for (const ruta of Object.values(p.modelos)) {
    assert.ok(statSync(new URL(`../${ruta}`, import.meta.url)).size < 4 * 1048576, `${ruta} < 4 MB`);
    const j = gltf(ruta);
    const nodos = new Set(j.nodes.map((n) => n.name));
    const piezas = [...p.variantes.flatMap((v) => [...v.agrega, ...Object.keys(v.materiales || {})]),
      ...Object.values(p.soloEn || {}).flat(), ...Object.values(p.ocultarEn || {}).flat()];
    for (const n of piezas) assert.ok(nodos.has(n), `${clase}: falta la pieza ${n} en ${ruta}`);
    const mats = new Set(j.materials.map((m) => m.name));
    for (const v of p.variantes) for (const m of Object.values(v.materiales || {})) assert.ok(mats.has(m), `falta el material ${m}`);
    const anims = j.animations.map((a) => a.name);
    for (const a of p.animaciones) assert.ok(anims.includes(a), `${clase}: falta la animación ${a} en ${ruta}`);
    const tris = j.meshes.reduce((t, m) => t + m.primitives.reduce((s, x) => s + j.accessors[x.indices].count / 3, 0), 0);
    assert.ok(tris < 60000, `${ruta}: ${tris} triángulos`);
    assert.ok(j.extensionsUsed.includes('EXT_meshopt_compression'), 'geometría comprimida con meshopt');
    assert.ok(j.images.every((im) => im.mimeType === 'image/webp'), 'texturas WebP');
  }
}
console.log('personajes3d ok');
