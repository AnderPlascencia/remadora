import assert from 'node:assert/strict';
import { metrosNuevos, instanteMeta, tiempoParado } from '../src/estadisticas.js';

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

// «Sin pausas» (talentos): una pausa guardada de 5 s o más la descarta aunque las muestras no tengan segundos quietos
import { sinPausas } from '../src/juego.js';
import { formatoMeta } from '../src/ui.js';
{
  const muestras = Array.from({ length: 700 }, (_, i) => ({ t: i + 1, w: 150, spm: 24 }));
  assert.equal(sinPausas({ muestras }), true);
  assert.equal(sinPausas({ muestras, pausas: [] }), true);
  assert.equal(sinPausas({ muestras, pausas: [{ ini: 0, fin: 3000 }] }), true);
  assert.equal(sinPausas({ muestras, pausas: [{ ini: 0, fin: 30000 }] }), false);
}
// Tiempo de meta con décimas
assert.equal(formatoMeta(92.8), '1:32.8');
assert.equal(formatoMeta(93), '1:33');
assert.equal(formatoMeta(59.96), '1:00');
assert.equal(formatoMeta(445.37), '7:25.4');
assert.equal(formatoMeta(null), '-');
