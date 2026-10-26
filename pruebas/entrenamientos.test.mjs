import assert from 'node:assert/strict';
import * as Ent from '../entrenamientos.js';

const obj = { tipo: 'objetivo', nombre: '2000 m', objetivo: { metrica: 'distancia', valor: 2000 } };
let p = Ent.progresoObjetivo(obj, { distancia: 500 }, 120);
assert.equal(p.fraccion, 0.25);
assert.equal(p.falta, 1500);
assert.equal(p.estimadoSeg, 360);
assert.equal(p.completo, false);
p = Ent.progresoObjetivo(obj, { distancia: 2010 }, 480);
assert.equal(p.completo, true);
assert.equal(p.hecho, 2000);
assert.equal(Ent.progresoObjetivo({ objetivo: { metrica: 'paladas', valor: 100 } }, { paladas: 40 }, 60).falta, 60);
assert.equal(Ent.describir(obj), 'Objetivo: 2000 m');

const bloques = Ent.serie({ reps: 3, trabajo: 60, wMin: 150, wMax: 180, descanso: 30 });
assert.equal(bloques.length, 5); // sin descanso después de la última repetición
assert.equal(bloques[1].metrica, '');
const ent = { tipo: 'intervalos', bloques };
assert.equal(Ent.duracionTotal(ent), 240);
assert.equal(Ent.bloqueEn(ent, 0).i, 0);
assert.equal(Ent.bloqueEn(ent, 60).i, 1);
assert.equal(Ent.bloqueEn(ent, 89).resta, 1);
assert.equal(Ent.bloqueEn(ent, 240), null);
assert.deepEqual(Ent.bandasPotencia(ent).map((b) => b.desde), [0, 90, 180]);
assert.equal(Ent.enRango(bloques[0], 140, 0), 'bajo');
assert.equal(Ent.enRango(bloques[0], 165, 0), 'dentro');
assert.equal(Ent.enRango(bloques[0], 200, 0), 'alto');
assert.equal(Ent.enRango(bloques[1], 0, 0), null);
assert.equal(Ent.tipoDe({ bloques: [] }), 'intervalos');
assert.equal(Ent.deMmss('3:15'), 195);
console.log('entrenamientos OK');
