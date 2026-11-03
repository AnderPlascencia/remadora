import assert from 'node:assert/strict';
import { crearReloj, MAX_SEG_PENDIENTES } from '../reloj.js';
import { ajustarLienzo } from '../grafica.js';

// Un tic por segundo: 1, y la fracción no se pierde (0,6 s + 0,6 s = 1 s).
let r = crearReloj(0);
assert.equal(r(1000), 1);
assert.equal(r(1600), 0);
assert.equal(r(2200), 1);
assert.equal(r(3000), 1);

// Temporizador frenado en segundo plano: un tic al minuto pone al día los 60 s.
r = crearReloj(0);
assert.equal(r(60_400), 60);
assert.equal(r(61_000), 1);

// Con tope (el teléfono dormido toda la noche) y la hora que va hacia atrás.
r = crearReloj(0);
assert.equal(r(10 * 3600 * 1000), MAX_SEG_PENDIENTES);
assert.equal(r(10 * 3600 * 1000 + 1000), 1);
r = crearReloj(5000);
assert.equal(r(2000), 0);
assert.equal(r(3000), 1);

// Densidad fraccionaria (Android 2.625): el lienzo se redimensiona una vez, no en cada dibujo.
const lienzo = { width: 300, height: 150 };
assert.equal(ajustarLienzo(lienzo, 393, 190, 2.625), true);
assert.deepEqual(lienzo, { width: 1032, height: 499 });
assert.equal(ajustarLienzo(lienzo, 393, 190, 2.625), false);
assert.equal(ajustarLienzo(lienzo, 400, 190, 2.625), true);
