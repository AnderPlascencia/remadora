import assert from 'node:assert/strict';
import { PAISAJES, tienePaisaje, paisajeElegido, comprarPaisaje } from '../carrera.js';

// El fiordo es gratis y es el de siempre; la laguna cuesta 400 monedas
assert.equal(PAISAJES.fiordo.precio, 0);
assert.equal(PAISAJES.laguna.precio, 400);
assert.equal(paisajeElegido({}), 'fiordo');
assert.ok(tienePaisaje({}, 'fiordo'));
assert.ok(!tienePaisaje({}, 'laguna'));
assert.ok(!tienePaisaje({}, 'inventado'));

// Elegir un paisaje sin comprarlo (respaldo editado, compra perdida) no sirve: se queda el fiordo
assert.equal(paisajeElegido({ paisaje: 'laguna' }), 'fiordo');
assert.equal(paisajeElegido({ paisaje: 'inventado', paisajes: ['inventado'] }), 'fiordo');

// Sin monedas suficientes no se compra
assert.equal(comprarPaisaje({}, 'laguna', 399), null);
// Comprar suma lo gastado (así baja el saldo) y lo deja puesto
const per = { gastado: 120, paisajes: [] };
const cambios = comprarPaisaje(per, 'laguna', 400);
assert.deepEqual(cambios, { paisajes: ['laguna'], gastado: 520, paisaje: 'laguna' });
const despues = { ...per, ...cambios };
assert.equal(paisajeElegido(despues), 'laguna');
// No se cobra dos veces ni se compra lo que es gratis
assert.equal(comprarPaisaje(despues, 'laguna', 9999), null);
assert.equal(comprarPaisaje({}, 'fiordo', 9999), null);
// Volver al fiordo no hace perder la laguna
assert.ok(tienePaisaje({ ...despues, paisaje: 'fiordo' }, 'laguna'));

// Cada paisaje trae sus imágenes y todas las piezas que puede elegir la orilla 3D
for (const [id, x] of Object.entries(PAISAJES)) {
  for (const src of [x.panorama.src, x.orilla.src, x.costa, x.miniatura]) assert.ok(src.startsWith('assets/carrera/'), `${id}: ${src}`);
  const nombres = new Set([x.orilla.borde]);
  for (let r1 = 0; r1 < 1; r1 += 0.01) for (let r2 = 0; r2 < 1; r2 += 0.05) { nombres.add(x.orilla.elegir(r1, r2)); nombres.add(x.orilla.fondo(r2)); }
  for (const n of nombres) assert.ok(x.orilla.piezas[n], `${id}: falta la pieza ${n}`);
}
console.log('paisajes: ok');
