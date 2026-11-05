import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PIEZAS } from '../src/coleccion-bote.js';
import { EMBLEMAS_CON_DIBUJO, pintarTela, pintarIcono } from '../src/emblemas.js';

// Cada pieza de la colección (velas, mascarones y palas) tiene su emblema dibujado
const dibujados = new Set(EMBLEMAS_CON_DIBUJO);
for (const p of Object.values(PIEZAS)) assert.ok(dibujados.has(p.emblema), `${p.id}: falta el dibujo de ${p.emblema}`);

// Pintar no falla con un contexto de canvas mínimo (sin Path2D, como en Node)
const nada = () => {};
const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop: nada }) }, { get: (o, k) => (k in o ? o[k] : nada), set: () => true });
for (const p of Object.values(PIEZAS)) {
  if (p.tipo === 'vela') pintarTela(ctx, p, 96, 84, 1.5);
  else pintarIcono(ctx, p.emblema, 12, 12, 24, p.tela, p.marca, 1.5);
}

// La carrera usa la vela con emblema en la barca realista y el aro de tu bote
const carrera = readFileSync(new URL('../src/carrera.js', import.meta.url), 'utf8');
assert.match(carrera, /velaReal3d\(ctx, P,/);
assert.match(carrera, /if \(b\.yo\) aro3d\(/);
assert.match(carrera, /velaReal2d\(ctx, x, y, largo, ancho, b, deco, t,/);
console.log('emblemas: ok');

// Palas de tu colección sobre la barca realista: una punta por remo en cada fotograma de cada atlas
const { PALAS_ATLAS, REMEROS_ATLAS } = await import('../src/carrera.js');
for (const [vista, A] of Object.entries(REMEROS_ATLAS)) {
  assert.equal(PALAS_ATLAS[vista].length, A.n, `${vista}: un fotograma por celda`);
  for (const fr of PALAS_ATLAS[vista]) {
    assert.equal(fr.length, 2);
    for (const [x, y] of fr) assert.ok(x >= 0 && x <= A.w && y >= 0 && y <= A.h, `${vista}: punta fuera de la celda`);
  }
}
console.log('palas del atlas: ok');
