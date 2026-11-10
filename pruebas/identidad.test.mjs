import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as T from '../src/talentos.js';

// Etapa 3 del rediseño del héroe: títulos de cada cultura y vikingo de palada larga.
// Títulos: uno por rango, junto al número de rango; el polinesio usa el común hasta la revisión cultural.
for (const [clase, lista] of Object.entries(J.TITULOS_CLASE)) assert.equal(lista.length, J.RANGOS.length, clase);
assert.equal(J.tituloDe(65, 'vikingo'), 'Jarl · rango 7');
assert.equal(J.tituloDe(1, 'samurai'), 'Komono · rango 1');
assert.equal(J.tituloDe(85, 'romano'), 'Praefectus classis · rango 9');
assert.equal(J.tituloDe(45, 'pirata'), 'Jefe de abordaje · rango 5');
assert.equal(J.tituloDe(65, 'polinesio'), 'Paladín', 'el polinesio sigue con el rango común');
assert.equal(J.tituloDe(65), 'Paladín', 'sin clase, el rango común');
assert.equal(J.nombreRango(25, 'gladiador'), 'Miles classiarius', 'las clases antiguas usan la de su espíritu');
// Ningún título choca con la escala de tripulación por FTP.
const tripulacion = new Set(J.CLASIFICACIONES.map((c) => c.nombre));
for (const lista of Object.values(J.TITULOS_CLASE)) for (const t of lista) assert.ok(!tripulacion.has(t), t);

// Vikingo: palada larga frente a tu media habitual.
const lleno = { m1: 3, m2: 3, m3: 3, m4: 3, maestria: 3 };
const vik = (metros, rel, extra = {}) => T.xpTalentos('vikingo', lleno, { palada: true, mppMedia: 10, metros, paladas: Math.round(metros / (10 * rel)), ...extra });
assert.deepEqual(vik(7000, 1), [['Brazos de hacha', 63], ['Botín de la saga', 60]]);
assert.deepEqual(vik(7000, 1.04), [['Brazos de hacha', 63], ['Saga de fuerza', 30], ['Botín de la saga', 57]], 'tope de 150 XP por sesión');
assert.deepEqual(vik(7000, 0.97), [], 'palada más corta que la habitual: nada');
assert.deepEqual(vik(4000, 1), [['Brazos de hacha', 36]], 'menos de 5 km: sin maestría');
assert.deepEqual(vik(3000, 1, { mppMedia: 0 }), [['Brazos de hacha', 27]], 'sin media habitual aún, cuenta como igual');
// Más paladas no paga más: remar corto y rápido para sumar paladas ya no sirve.
assert.ok(vik(7000, 0.9).length === 0);
// Las sesiones anteriores siguen contando paladas.
assert.deepEqual(T.xpTalentos('vikingo', lleno, { paladas: 1080, metros: 10800 }), [['Brazos de hacha', 70], ['Saga de fuerza', 30], ['Botín de la saga', 50]], 'antes: contaba paladas (con el tope de 150)');
console.log('identidad OK');
