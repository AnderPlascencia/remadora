import assert from 'node:assert/strict';
import * as CB from '../src/coleccion-bote.js';
import * as J from '../src/juego.js';
import { VELAS } from '../src/carrera.js';

// Etapa 15: colección de bote por clase (velas, mascarón y palas), igual para las 5 clases.
assert.deepEqual(CB.CLASES_COLECCION, J.CLASES.map((c) => c.clave));
for (const clase of CB.CLASES_COLECCION) {
  const lista = CB.piezasDe(clase);
  assert.equal(lista.length, 8, clase);
  assert.deepEqual(lista.map((x) => x.tipo), ['vela', 'vela', 'palas', 'vela', 'proa', 'vela', 'vela', 'proa']);
  assert.equal(lista.filter((x) => x.como.precio).reduce((a, x) => a + x.como.precio, 0), 4000, 'mismo coste en todas las clases');
  for (const x of lista) assert.match(x.tela, /^#[0-9A-F]{6}$/i) && assert.ok(x.emblema && x.nombre && x.texto);
  // La vela clásica conserva los colores de siempre del bote.
  assert.equal(CB.PIEZAS[`${clase}-clasica`].emblema.length > 0, true);
}

// Qué tienes: gratis, por nivel, por hazaña y comprado.
{
  const per = { piezas: ['vikingo-palas'] };
  const ctx = { nivel: 25, hazanas: new Set() };
  assert.ok(CB.tienePieza(per, 'vikingo-clasica', ctx));
  assert.ok(CB.tienePieza(per, 'vikingo-rango', ctx));
  assert.ok(!CB.tienePieza(per, 'vikingo-proa', ctx), 'el mascarón pide nivel 40');
  assert.ok(CB.tienePieza(per, 'vikingo-palas', ctx));
  assert.ok(!CB.tienePieza(per, 'vikingo-taller', ctx));
  assert.ok(!CB.tienePieza(per, 'vikingo-legendaria', ctx));
  assert.ok(CB.tienePieza(per, 'vikingo-legendaria', { nivel: 1, hazanas: new Set(['clase-vikingo']) }));
  assert.ok(CB.tienePieza(per, 'vikingo-proa-oro', { nivel: 1, hazanas: new Set(['clase-vikingo']) }));
}

// Comprar y equipar: se cobra una vez, se estrena en su clase y el equipo es por clase.
{
  const per = { gastado: 100, equipoBote: { pirata: { vela: 'pirata-rango' } } };
  assert.equal(CB.comprarPieza(per, 'vikingo-taller', 1199), null, 'faltan monedas');
  assert.equal(CB.comprarPieza(per, 'vikingo-rango', 9999), null, 'lo de nivel no se compra');
  const c = CB.comprarPieza(per, 'vikingo-taller', 1200);
  assert.deepEqual(c.piezas, ['vikingo-taller']);
  assert.equal(c.gastado, 1300);
  assert.equal(c.equipoBote.vikingo.vela, 'vikingo-taller');
  assert.equal(c.equipoBote.pirata.vela, 'pirata-rango', 'no toca el bote de otra clase');
  assert.equal(CB.comprarPieza({ ...per, ...c }, 'vikingo-taller', 5000), null, 'no se compra dos veces');
}

// Equipo: por defecto la clásica; lo que ya no tienes no se pone; las velas de color valen en cualquier bote.
{
  const ctx = { nivel: 10, hazanas: new Set() };
  const color = (id) => !!VELAS[id];
  assert.deepEqual(CB.equipoDe({}, 'samurai', ctx), { vela: 'samurai-clasica', proa: null, palas: null });
  assert.equal(CB.equipoDe({ equipoBote: { samurai: { vela: 'samurai-rango' } } }, 'samurai', ctx).vela, 'samurai-clasica', 'nivel 10 < 20');
  assert.equal(CB.equipoDe({ equipoBote: { samurai: { vela: 'samurai-rango' } } }, 'samurai', { nivel: 20 }).vela, 'samurai-rango');
  assert.equal(CB.equipoDe({ equipoBote: { samurai: { vela: 'vikingo-rango' } } }, 'samurai', { nivel: 90 }).vela, 'samurai-clasica', 'una vela de otra clase no');
  // Migración: la vela de color elegida antes (per.vela) sigue en tu bote.
  assert.equal(CB.equipoDe({ vela: 'oro', velas: ['oro'] }, 'romano', ctx, { velaDeColor: color }).vela, 'oro');
  assert.equal(CB.equipoDe({ vela: 'oro', velas: ['oro'], equipoBote: { romano: { vela: null } } }, 'romano', ctx, { velaDeColor: color }).vela, 'romano-clasica');
  const pr = CB.equipoDe({ equipoBote: { romano: { proa: 'romano-proa', palas: 'romano-palas' } }, piezas: ['romano-palas'] }, 'romano', { nivel: 40 });
  assert.deepEqual([pr.proa, pr.palas], ['romano-proa', 'romano-palas']);
}

// Rivales: Alta mar lleva la épica de su clase; los legendarios, la legendaria.
assert.equal(CB.velaDeRival('pirata', { dificultad: 'altamar' }).id, 'pirata-epica');
assert.equal(CB.velaDeRival('pirata', { dificultad: 'costa', rango: 'legendario' }).id, 'pirata-legendaria');
assert.equal(CB.velaDeRival('pirata', { dificultad: 'costa' }), null);
assert.equal(CB.velaDeRival(null, { dificultad: 'altamar' }), null);

// Hazañas de clase: una por clase, en el juego, y solo se cobran desde el día de la colección.
{
  assert.equal(J.HAZANAS_CLASE.length, 5);
  const FTP = 200;
  const dia = (k, h = 18) => new Date(`${k}T${String(h).padStart(2, '0')}:00`).getTime();
  const ses = (k, extra = {}) => ({ fecha: dia(k), duracion: 1800, distancia: 7000, paladas: 40000, wattsProm: 150, ftp: FTP, ...extra });
  const vieja = ses('2026-10-20');
  const antes = J.estadoJuego([vieja], { ftp: FTP, ahora: vieja.fecha + 3600e3, calendario: {} });
  const hz = antes.hazanas.find((x) => x.id === 'clase-vikingo');
  assert.equal(hz.valor, 40000);
  assert.ok(!hz.hecha);
  const lista = [vieja, ses('2026-10-21'), ses('2026-11-05')];
  const h = J.estadoJuego(lista, { ftp: FTP, ahora: lista.at(-1).fecha + 3600e3, calendario: {} });
  assert.ok(h.hazanas.find((x) => x.id === 'clase-vikingo').hecha, '80 000 paladas');
  const logro = h.logros.find((l) => l.texto.includes('Saga de las cien mil'));
  assert.equal(new Date(logro.fecha).toISOString().slice(0, 10), '2026-11-05', 'se cobra en la primera sesión desde el cambio');
  assert.equal(logro.monedas, 300);
}

// Ventajas del equipo (revisión de la tienda): cuanto más alta la pieza, más ventaja; con su tope en ventajas.js.
assert.equal(CB.bonoEquipo({ vela: 'vikingo-clasica' }), null);
assert.deepEqual(CB.bonoEquipo({ vela: 'vikingo-taller', proa: 'vikingo-proa', palas: 'vikingo-palas' }), { salida: 8, inicio: 0.01, porPaladas: 1, legendaria: null });
assert.deepEqual(CB.bonoEquipo({ vela: 'romano-legendaria', proa: 'romano-proa-oro' }), { salida: 15, inicio: 0.02, porPaladas: 0, legendaria: 'romano' });
assert.equal(CB.bonoEquipo({ vela: 'oro' }).salida, 12, 'las velas de color también dan salida');
for (const clase of CB.CLASES_COLECCION) {
  const salidas = ['clasica', 'rango', 'taller', 'epica', 'legendaria'].map((e) => CB.SALIDA_VELA[e]);
  assert.deepEqual(salidas, [...salidas].sort((a, b) => a - b), 'más alta, más ventaja');
  assert.match(CB.ventajaTexto(CB.PIEZAS[`${clase}-legendaria`]), /15 m por delante y \+/);
}
assert.equal(CB.ventajaTexto(VELAS.hielo, 'hielo'), 'Ventaja: empiezas 10 m por delante');
assert.equal(CB.ventajaTexto(CB.PIEZAS['pirata-palas']), 'Ventaja: +1 m cada 100 paladas');

// Monedas de las ventajas: Estandarte +10 y Botín +20 por fantasma, solo desde la revisión.
{
  const s = (k, v) => ({ fecha: new Date(`${k}T18:00`).getTime(), ventajaUsada: v });
  assert.equal(J.monedasDeVentaja(s('2026-11-05', 'botin'), { ganados: 3 }), 60);
  assert.equal(J.monedasDeVentaja(s('2026-11-05', 'estandarte'), { ganados: 1 }), 10);
  assert.equal(J.monedasDeVentaja(s('2026-11-05', 'botin'), { ganados: 0 }), 0);
  assert.equal(J.monedasDeVentaja(s('2026-10-30', 'botin'), { ganados: 3 }), 0);
}
console.log('coleccion OK');
