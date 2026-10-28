import assert from 'node:assert/strict';
import { esfuerzoPorPulso } from '../estadisticas.js';

const sesion = (seg, fc) => Array.from({ length: seg }, (_, t) => ({ t, w: 150, fc }));
// Sin pulso máximo o sin pulso: no se calcula (se pregunta)
assert.equal(esfuerzoPorPulso(sesion(600, 150), 0), null);
assert.equal(esfuerzoPorPulso(sesion(600, 0), 190), null);
// Menos de 5 min con pulso: no alcanza
assert.equal(esfuerzoPorPulso(sesion(200, 150), 190), null);
// Pulso solo en parte de la sesión (menos del 60 %): no alcanza
assert.equal(esfuerzoPorPulso([...sesion(400, 150), ...sesion(800, 0)], 190), null);
// 70 % → 5, 80 % → 7, 90 % → 9
assert.deepEqual(esfuerzoPorPulso(sesion(600, 133), 190), { rpe: 5, pct: 70 });
assert.equal(esfuerzoPorPulso(sesion(600, 152), 190).rpe, 7);
assert.equal(esfuerzoPorPulso(sesion(600, 171), 190).rpe, 9);
// Una sesión larga (más de 45 min) a buen pulso suma 1
assert.equal(esfuerzoPorPulso(sesion(3000, 152), 190).rpe, 8);
// Límites 1 y 10
assert.equal(esfuerzoPorPulso(sesion(600, 80), 190).rpe, 1);
assert.equal(esfuerzoPorPulso(sesion(600, 200), 190).rpe, 10);
console.log('esfuerzo ok');
