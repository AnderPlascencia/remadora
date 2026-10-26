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

// Intervalos por distancia, paladas y split
const mixto = [
  { nombre: 'A', duracion: 60, metrica: '' },
  { nombre: 'B', fin: 'distancia', cantidad: 500, duracion: 0, metrica: 'split', min: 120, max: 130 },
  { nombre: 'C', fin: 'paladas', cantidad: 20, duracion: 0, metrica: '' },
];
const av = Ent.crearAvance();
let info = Ent.avanzar(av, mixto, { t: 30, dist: 100, paladas: 12 });
assert.equal(info.i, 0);
assert.equal(info.resta, 30);
info = Ent.avanzar(av, mixto, { t: 61, dist: 210, paladas: 25, split: 125 });
assert.equal(info.i, 1);
assert.equal(av.duraciones[0], 60);
assert.equal(info.hecho, 0); // la distancia del bloque se cuenta desde que empezó
info = Ent.avanzar(av, mixto, { t: 120, dist: 450, paladas: 50, split: 125 });
assert.equal(info.resta, 260);
assert.equal(info.restaSeg, 65);
info = Ent.avanzar(av, mixto, { t: 190, dist: 712, paladas: 80 });
assert.equal(info.i, 2);
assert.equal(av.duraciones[1], 130);
info = Ent.avanzar(av, mixto, { t: 240, dist: 900, paladas: 100 });
assert.equal(info.terminado, true);
assert.deepEqual(Ent.bloquesConDuracion(av, mixto, { t: 240 }).map((b) => b.duracion), [60, 130, 50]);
assert.equal(Ent.enRango(mixto[1], 0, 0, 0, 135), 'bajo');
assert.equal(Ent.enRango(mixto[1], 0, 0, 0, 125), 'dentro');
assert.equal(Ent.enRango(mixto[1], 0, 0, 0, 110), 'alto');
assert.equal(Ent.textoMeta(mixto[1]), '2:00–2:10 /500 m');
assert.equal(Ent.wattsDeSplit(120), 203);
assert.equal(Ent.bloquesEnWatts([mixto[1]])[0].min, Ent.wattsDeSplit(130));
assert.equal(Ent.duracionEstimada(mixto[1]), 130);
assert.equal(Ent.duracionEstimada(mixto[2]), 50);
console.log('entrenamientos mixtos OK');
