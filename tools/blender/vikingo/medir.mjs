// Mide un GLB sin dependencias: tamaño, triángulos, mallas, huesos, materiales, texturas y animaciones.
// Uso: node tools/blender/vikingo/medir.mjs archivo.glb [...]
import { readFileSync, statSync } from 'node:fs';

for (const ruta of process.argv.slice(2)) {
  const b = readFileSync(ruta);
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  const tris = json.meshes.reduce((t, m) => t + m.primitives.reduce((s, p) => s + json.accessors[p.indices].count / 3, 0), 0);
  const huesos = json.skins?.[0]?.joints.length || 0;
  const anims = (json.animations || []).map((a) => {
    const fin = Math.max(...a.samplers.map((s) => json.accessors[s.input].max?.[0] || 0));
    return `${a.name} ${fin.toFixed(2)} s`;
  });
  console.log(`${ruta}: ${(statSync(ruta).size / 1048576).toFixed(2)} MB · ${Math.round(tris)} triángulos · ${json.meshes.length} mallas · `
    + `${huesos} huesos · ${json.materials.length} materiales · ${(json.images || []).length} texturas · ${anims.join(', ')}`);
}
