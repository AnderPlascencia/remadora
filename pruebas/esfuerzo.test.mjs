import assert from 'node:assert/strict';
import { esfuerzoPorPulso, rpeSentido, rpePulsoDe, rpeDe } from '../src/estadisticas.js';

const sesion = (seg, fc) => Array.from({ length: seg }, (_, t) => ({ t, w: 150, fc }));
// Sin pulso máximo o sin pulso: no se calcula (se pregunta)
assert.equal(esfuerzoPorPulso(sesion(600, 150), 0), null);
assert.equal(esfuerzoPorPulso(sesion(600, 0), 190), null);
// Menos de 5 min con pulso: no alcanza
assert.equal(esfuerzoPorPulso(sesion(200, 150), 190), null);
// Pulso solo en parte de la sesión (menos del 60 %): no alcanza
assert.equal(esfuerzoPorPulso([...sesion(400, 150), ...sesion(800, 0)], 190), null);
// TRIMP de Edwards: la media de los pesos de cada zona (1 a 5) × 2. Sin pulso en reposo se usa el supuesto
// (57 lpm con 190): 133 lpm es zona 1, 152 zona 3 y 171 zona 4.
assert.deepEqual(esfuerzoPorPulso(sesion(600, 133), 190), { rpe: 2, pct: 70, trimp: 10 });
assert.equal(esfuerzoPorPulso(sesion(600, 152), 190).rpe, 6);
assert.equal(esfuerzoPorPulso(sesion(600, 171), 190).rpe, 8);
// Con tu pulso en reposo, por reserva de pulso.
assert.equal(esfuerzoPorPulso(sesion(600, 152), { max: 190, reposo: 70 }).rpe, 4, 'con un reposo de 70, 152 es el 68 % de la reserva: zona 2');
// Una sesión larga (más de 45 min) a buen pulso suma 1
assert.equal(esfuerzoPorPulso(sesion(3000, 152), 190).rpe, 7);
// Límites 1 y 10
assert.equal(esfuerzoPorPulso(sesion(600, 80), 190).rpe, 1);
assert.equal(esfuerzoPorPulso(sesion(600, 200), 190).rpe, 10);
// Series: 5 × 2 min en zona 5 con 2 min de descanso suave. El pulso medio (que usaba antes) da un 6 por los descansos;
// el tiempo fuerte manda: 10 min en zona 5 son un 8.
const series = Array.from({ length: 5 }, () => [...sesion(120, 185), ...sesion(120, 120)]).flat();
const calentamiento = sesion(300, 125);
assert.equal(esfuerzoPorPulso([...calentamiento, ...series], 190).rpe, 8);
// El tuyo y el del pulso van aparte; las sesiones de antes tenían el del pulso en rpe con rpeFuente 'pulso'.
assert.equal(rpeSentido({ rpe: 7, rpePulso: 5 }), 7);
assert.equal(rpePulsoDe({ rpe: 7, rpePulso: 5 }), 5);
assert.equal(rpeSentido({ rpePulso: 5 }), null);
assert.equal(rpeDe({ rpePulso: 5 }), 5);
assert.equal(rpeSentido({ rpe: 6, rpeFuente: 'pulso' }), null, 'el de antes no cuenta como tuyo');
assert.equal(rpePulsoDe({ rpe: 6, rpeFuente: 'pulso' }), 6);
assert.equal(rpeSentido({ rpe: 6, rpeFuente: 'tu' }), 6);
console.log('esfuerzo ok');
