// Riesgo de abandono (etapa 30): cuándo se avisa, cuándo no y que se pregunte una sola vez.
import assert from 'node:assert/strict';
import * as Hab from '../src/habito.js';
import * as E from '../src/estadisticas.js';
import * as C from '../src/capacidades.js';

const DIA = 864e5;
// Un miércoles a mediodía.
const ahora = new Date('2026-11-25T12:00').getTime();
const lunes = E.inicioPeriodo(ahora, 'semana');
// Sesiones en los días (desde el lunes de esta semana, negativos hacia atrás) indicados.
const en = (dias) => dias.map((d, i) => ({ id: i + 1, fecha: lunes + d * DIA + 10 * 36e5, duracion: 1800 }));
// 4 semanas de 3 sesiones (semanas -6 a -3), luego lo que se pida.
const regular = [];
for (let w = 6; w >= 3; w--) regular.push(-7 * w, -7 * w + 2, -7 * w + 4);

// Remando como siempre: nada.
const siempre = en([...regular, -14, -12, -10, -7, -5, -3, -1]);
assert.equal(Hab.riesgoAbandono(siempre, ahora), null);

// Baja a 1 por semana en las 2 últimas y 3 días sin remar: «baja».
const baja = Hab.riesgoAbandono(en([...regular, -11, -4]), ahora);
assert.equal(baja?.motivo, 'baja');
assert.equal(baja.base, 3);
assert.equal(baja.reciente, 1);
assert.match(Hab.textoRiesgo(baja), /1 vez por semana, antes 3 veces/);

// La misma baja, pero remó ayer (martes): todavía no.
assert.equal(Hab.riesgoAbandono(en([...regular, -11, -4, 1]), ahora), null);

// 9 días sin remar tras semanas regulares: «hueco».
const hueco = Hab.riesgoAbandono(en([...regular, -14, -12, -10, -7]), ahora);
assert.equal(hueco?.motivo, 'hueco');
assert.equal(hueco.dias, 9);
assert.match(Hab.textoRiesgo(hueco), /9 días sin remar/);

// 21 días o más: lo cubre el regreso, no se avisa.
assert.equal(Hab.riesgoAbandono(en(regular.filter((d) => d <= -21)), ahora), null);

// Quien remaba 1 vez por semana no está en riesgo por remar 1 vez por semana.
assert.equal(Hab.riesgoAbandono(en([-42, -35, -28, -21, -14, -7]), ahora), null);

// Con menos de 6 semanas de historial, nada.
assert.equal(Hab.riesgoAbandono(en([-28, -27, -25, -21, -20, -18]), ahora), null);

// Las sesiones del futuro (relojes cambiados) no cuentan.
assert.equal(Hab.riesgoAbandono(en([...regular, -11, -4, 5]), ahora)?.motivo, 'baja');

// Una sola vez: el día del aviso sigue visible hasta contestar; después, 6 semanas sin preguntar.
assert.equal(Hab.mostrarRiesgo(null, '2026-11-25'), true);
assert.equal(Hab.mostrarRiesgo({ dia: '2026-11-25' }, '2026-11-25'), true);
assert.equal(Hab.mostrarRiesgo({ dia: '2026-11-25', respondido: true }, '2026-11-25'), false);
assert.equal(Hab.mostrarRiesgo({ dia: '2026-11-25' }, '2026-11-26'), false);
assert.equal(Hab.mostrarRiesgo({ dia: '2026-11-25', respondido: true }, '2027-01-05'), false);
assert.equal(Hab.mostrarRiesgo({ dia: '2026-11-25', respondido: true }, '2027-01-06'), true);

// La monotonía de Datos avanzados y la del aviso salen del mismo cálculo.
const cargas = [50, 70, 50, 60, 0, 55, 50];
assert.equal(C.monotoniaDe(cargas), Math.round(Math.min(9, E.monotoniaCargas(cargas)) * 10) / 10);
assert.equal(E.monotoniaCargas([0, 0, 0]), null);
assert.equal(E.monotoniaCargas([40, 40, 40]), Infinity);
assert.equal(C.monotoniaDe([40, 40, 40, 40, 40, 40, 40]), 9, 'sin variación, el tope');

console.log('abandono: ok');
