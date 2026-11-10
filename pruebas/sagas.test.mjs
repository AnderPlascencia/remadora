import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as VJ from '../src/voz-juego.js';
import { aJefe } from '../src/sagas.js';

// Etapa 6 del rediseño del héroe: cada cultura vive su propia saga con los mismos 9 capítulos.
for (const [clase, lista] of Object.entries(J.SAGAS)) {
  assert.equal(lista.length, J.CAPITULOS.length, clase);
  for (const [historia, jefe] of lista) assert.ok(historia.length > 40 && jefe.length > 3, `${clase}: ${jefe}`);
  // Los requisitos, la prueba, el nivel y el premio no cambian; solo la historia y el jefe.
  J.CAPITULOS.forEach((c, i) => {
    const k = J.capituloDe(i, clase);
    assert.deepEqual([k.nombre, k.nivel, k.req, k.jefe.tipo, k.jefe.texto, k.objeto, k.xp], [c.nombre, c.nivel, c.req, c.jefe.tipo, c.jefe.texto, c.objeto, c.xp]);
    assert.equal(k.jefe.nombre, lista[i][1]);
  });
}
assert.equal(J.capituloDe(2, 'vikingo').jefe.nombre, 'La hafgufa', 'el kraken de las sagas es del vikingo');
// El polinesio sigue con la historia común hasta la revisión cultural; sin clase, también.
assert.ok(!J.SAGAS.polinesio);
assert.deepEqual(J.capituloDe(2, 'polinesio'), J.CAPITULOS[2]);
assert.deepEqual(J.capituloDe(0, null), J.CAPITULOS[0]);
// Los dioses de culturas vivas no se vencen: se cruza su tormenta o se visita su palacio.
assert.equal(J.capituloDe(2, 'samurai').jefe.nombre, 'La tormenta de Raijin');
assert.equal(J.capituloDe(7, 'samurai').jefe.nombre, 'El viaje al palacio de Ryūjin');
// La preposición con cada tipo de nombre.
assert.equal(aJefe('El kappa del río'), 'al kappa del río');
assert.equal(aJefe('La red de Rán'), 'a la red de Rán');
assert.equal(aJefe('Los piratas cilicios'), 'a los piratas cilicios');
assert.equal(aJefe('Surtr'), 'a Surtr');
assert.match(VJ.avisoInicio({ jefe: 'Jörmungandr' }), /^Hoy te enfrentas a Jörmungandr/);
