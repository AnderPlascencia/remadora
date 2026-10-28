import assert from 'node:assert/strict';
import * as T from '../talentos.js';
import { sinPausas } from '../juego.js';

const base = { paladas: 0, metros: 0, min: 0, ganados: 0, rivales: 0, sinPausas: false, delPrograma: false, racha: 1, sesSemana: 1 };
const xp = (clase, grados, d) => T.xpTalentos(clase, grados, { ...base, ...d });

// Vikingo: Brazos de hacha cada 10 paladas, Saga de fuerza a las 500, Botín de la saga cada 1000
assert.deepEqual(xp('vikingo', { m2: 2, m4: 1, maestria: 1 }, { paladas: 1030 }), [['Brazos de hacha', 150]], 'tope de 150 XP');
assert.deepEqual(xp('vikingo', { m2: 1, m4: 1, maestria: 1 }, { paladas: 520 }), [['Brazos de hacha', 52], ['Saga de fuerza', 15]]);
// Pirata: fantasmas vencidos (hasta 3), sesión con carrera y ganarles a todos
assert.deepEqual(xp('pirata', { m1: 1, m4: 1, maestria: 1 }, { ganados: 2, rivales: 2 }), [['Bolsa ligera', 20], ['Botín escondido', 15], ['Tesoro del capitán', 40]]);
assert.deepEqual(xp('pirata', { maestria: 1 }, { ganados: 1, rivales: 2 }), []);
// Samurái: sin pausas y entrenamiento del programa
assert.deepEqual(xp('samurai', { m2: 1, m4: 2, maestria: 1 }, { sinPausas: true, delPrograma: true }), [['Kata', 15], ['Maestro del dojo', 30], ['Senda del maestro', 30]]);
// Polinesio: 30 min, km después del quinto y 60 min
assert.deepEqual(xp('polinesio', { m1: 1, m3: 1, maestria: 1 }, { min: 61, metros: 8200 }), [['Estrella guía', 15], ['Travesía', 15], ['Gran travesía', 30]]);
// Romano: tercera sesión de la semana, racha (hasta 7) y Triunfo semanal aparte del tope
assert.deepEqual(xp('romano', { m1: 3, m3: 3, maestria: 3 }, { sesSemana: 5, racha: 9 }), [['Pax romana', 45], ['Ley de la legión', 105], ['Triunfo romano', 225]]);
assert.deepEqual(xp('romano', { maestria: 1 }, { sesSemana: 6 }), [], 'el Triunfo se paga una vez por semana');
// Sin grados no hay nada
assert.deepEqual(xp('vikingo', {}, { paladas: 5000 }), []);

// Sesión sin pausas
const muestras = (n, hueco = -1) => Array.from({ length: n }, (_, i) => ({ t: i + 1, w: i >= hueco && i < hueco + 6 ? 0 : 120, spm: i >= hueco && i < hueco + 6 ? 0 : 24 }));
assert.ok(sinPausas({ muestras: muestras(700) }));
assert.ok(!sinPausas({ muestras: muestras(700, 300) }), 'pausa de 6 s');
assert.ok(!sinPausas({ muestras: muestras(400) }), 'menos de 10 min');
console.log('talentos OK');
