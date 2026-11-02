import assert from 'node:assert/strict';
import { metrosNuevos, instanteMeta, tiempoParado } from '../estadisticas.js';

// Filtro de saltos flexible: la consola se atrasa 7 s y se pone al día con 24 m (antes se perdían)
assert.equal(metrosNuevos(1534, 1558, 7), 24);
assert.equal(metrosNuevos(1534, 1560, 1), 0); // 26 m en un segundo sigue siendo un salto
assert.equal(metrosNuevos(1534, 1560, 2), 26);
// El atraso aceptado tiene tope: tras una pausa larga no entra un salto de cientos de metros
assert.equal(metrosNuevos(1000, 1400, 60), 0);
assert.equal(metrosNuevos(1500, 3, 5), 3); // reinicio de la consola, igual que antes

// Meta interpolada entre dos lecturas: 496 m en el segundo 92 y 501 m en el 93 → 92,8 s
assert.equal(instanteMeta(93, 496, 501, 500), 92.8);
assert.equal(instanteMeta(93, 495, 500, 500), 93);
assert.equal(instanteMeta(10, 0, 0, 500), 10); // sin avance no se inventa nada
assert.equal(instanteMeta(10, 600, 610, 500), 10);

// Tiempo parado con la lista de pausas guardada
assert.equal(tiempoParado(undefined), 0);
assert.equal(tiempoParado([{ ini: 1000, fin: 31000 }, { ini: 50000, fin: 62500 }]), 43);
assert.equal(tiempoParado([{ ini: 5000, fin: null }]), 0);

console.log('pausas-y-meta: ok');
