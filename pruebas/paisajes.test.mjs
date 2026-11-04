import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PAISAJES, tienePaisaje, paisajeElegido, comprarPaisaje } from '../src/carrera.js';

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
// Las imágenes existen en el repo y el service worker las guarda para correr sin conexión
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
for (const [id, x] of Object.entries(PAISAJES)) {
  for (const src of [x.panorama.src, x.orilla.src, x.costa, x.miniatura]) {
    assert.ok(existsSync(new URL(`../${src}`, import.meta.url)), `${id}: no existe ${src}`);
    const [, nombre, sufijo] = src.match(/carrera\/([a-z]+?)(_orilla|_costa|_mini)?\.webp$/);
    assert.ok(sw.includes(src) || (sw.includes(`'${nombre}'`) && sw.includes(`'${sufijo || ''}'`)), `${id}: sw.js no guarda ${src}`);
  }
}

// Los cinco paisajes de la colección: propios (no variantes de color), a la venta y con precios distintos
const COLECCION = ['canon', 'otono', 'cerezos', 'glaciar', 'mediterraneo'];
for (const id of COLECCION) {
  const x = PAISAJES[id];
  assert.ok(x && !x.base && !x.filtro, `${id}: debe ser un paisaje propio`);
  assert.ok(x.precio >= 400 && x.precio <= 3000, `${id}: ${x.precio}`);
  assert.ok(x.panorama.src.endsWith(`${id}.webp`) && x.orilla.src.endsWith(`${id}_orilla.webp`));
  assert.equal(comprarPaisaje({}, id, x.precio - 1), null);
  assert.deepEqual(comprarPaisaje({ gastado: 0 }, id, x.precio), { paisajes: [id], gastado: x.precio, paisaje: id });
  assert.equal(paisajeElegido({ paisaje: id, paisajes: [id] }), id);
}
const precios = Object.values(PAISAJES).map((x) => x.precio);
assert.equal(new Set(precios).size, precios.length, 'dos paisajes con el mismo precio');
console.log('paisajes: ok');
