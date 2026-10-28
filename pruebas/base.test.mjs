import assert from 'node:assert/strict';
import * as B from '../base.js';
import { enfoqueDe } from '../programa.js';
import { esPrueba } from '../ventajas.js';

const n1 = B.entrenamientosBase(1, 200);
const n70 = B.entrenamientosBase(70, 200);
assert.equal(n1.length, 18, '15 base + 3 pruebas');
// 3 dificultades por sección
for (const sec of ['potencia', 'ritmo', 'distancia', 'tecnica', 'calorias']) {
  assert.deepEqual(n1.filter((x) => x.enfoque === sec).map((x) => x.dificultad), ['suave', 'mant', 'mejora'], sec);
}
// Cada uno cae en su sección y las pruebas siguen siendo pruebas
for (const x of n1) assert.equal(enfoqueDe(x), x.enfoque, x.nombre);
assert.ok(n1.filter((x) => x.enfoque === 'pruebas').every(esPrueba));
assert.ok(!n1.filter((x) => x.dificultad).some(esPrueba), 'los base no son pruebas');
// Nombres e ids fijos entre niveles (para comparar sesiones); el volumen crece
assert.deepEqual(n1.map((x) => x.nombre), n70.map((x) => x.nombre));
assert.deepEqual(n1.map((x) => x.id), n70.map((x) => x.id));
const umbral = (l) => l.find((x) => x.id === 'base:pot-mant');
assert.equal(umbral(n1).resumen, '3 × 6 min en umbral');
assert.equal(umbral(B.entrenamientosBase(25)).resumen, '4 × 6 min en umbral');
assert.equal(umbral(B.entrenamientosBase(45)).resumen, '4 × 8 min en umbral');
assert.equal(umbral(n70).resumen, '5 × 8 min en umbral');
assert.equal(n70.find((x) => x.id === 'base:dis-mant').bloques[1].cantidad, 9000);
assert.equal(n1.find((x) => x.id === 'base:cal-mejora').objetivo.valor, 300);
// Ritmo: con FTP pide split (más rápido = menos segundos); sin FTP, % del FTP
const crucero = n1.find((x) => x.id === 'base:rit-mant').bloques[1];
assert.equal(crucero.metrica, 'split');
assert.ok(crucero.min < crucero.max && crucero.min > 90 && crucero.max < 200, `${crucero.min}-${crucero.max}`);
assert.equal(B.entrenamientosBase(1, 0).find((x) => x.id === 'base:rit-mant').bloques[1].metrica, 'ftp');
// Resumen corto
assert.equal(B.resumenEnt(umbral(n1)), '37 min · 3 × 6 min en umbral');
assert.match(B.resumenEnt(n70.find((x) => x.id === 'base:dis-mejora')), /^1 h 18 min/);
assert.equal(B.resumenEnt({ tipo: 'objetivo', objetivo: { metrica: 'distancia', valor: 2000 } }), 'Meta: 2,000 m');
console.log('base OK');
