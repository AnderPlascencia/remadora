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
