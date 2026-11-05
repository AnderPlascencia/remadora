import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/guion-voz.js';
import { _reiniciar, configurarCantidad, dejaSonar, fijarSilencio, ESPERA_CAPA } from '../src/voz.js';
import { EJEMPLOS } from '../src/entrenamientos.js';
import { tipoPlan } from '../src/capacidades.js';

const ej = (nombre) => EJEMPLOS.find((e) => e.nombre === nombre);
const tipoDe = (ent) => G.tipoGuion(ent, tipoPlan(ent));

test('tipo del guion: cada entrenamiento de ejemplo cae en su tipo', () => {
  assert.equal(G.tipoGuion(null, null), 'libre');
  assert.equal(tipoDe(ej('Umbral 3 × 8 min (zona 4)')), 'umbral');
  assert.equal(tipoDe(ej('Tabata 8 × 20 s')), 'sprint');
  assert.equal(tipoDe(ej('4 × 500 m')), 'vo2');
  assert.equal(tipoDe(ej('Pirámide de paladas')), 'tecnica');
  assert.equal(tipoDe(ej('150 kcal')), 'calorias');
  assert.equal(tipoDe(ej('2000 m')), 'objetivo');
  assert.equal(tipoDe(ej('Prueba 2000 m')), 'prueba');
  assert.equal(tipoDe(ej('Zona 2 por pulso 30 min')), 'fondo');
});

test('recuperación: por el nombre o porque todo el trabajo es muy suave', () => {
  assert.equal(G.tipoGuion({ nombre: 'Fondo suave 20 min', bloques: [{ nombre: 'Fondo', duracion: 1200, metrica: 'ftp', min: 50, max: 70 }] }, 'fondo'), 'recuperacion');
  assert.equal(G.tipoGuion({ nombre: 'Rodaje', bloques: [{ nombre: 'Rodaje', duracion: 1200, metrica: 'ftp', min: 45, max: 60 }] }, 'fondo'), 'recuperacion');
  assert.equal(G.tipoGuion({ nombre: 'Fondo 40 min', bloques: [{ nombre: 'Fondo', duracion: 2400, metrica: 'ftp', min: 56, max: 75 }] }, 'fondo'), 'fondo');
});

test('propósito: dice para qué es la sesión y cómo sentirla', () => {
  const plan = [{ nombre: 'Calentamiento', duracion: 600 }, { nombre: 'Fondo', duracion: 2400, metrica: 'ftp', min: 56, max: 75 }];
  assert.match(G.proposito('fondo', {}, plan), /^Fondo de 40 minutos\. Debes poder hablar/);
  const vo2 = [1, 2, 3, 4, 5].flatMap((n) => [{ nombre: `Fuerte ${n}/5`, duracion: 180, metrica: 'ftp' }, { nombre: 'Descanso', duracion: 180 }]);
  assert.match(G.proposito('vo2', {}, vo2), /^VO2, 5 series\. Duras de verdad/);
  assert.match(G.proposito('objetivo', { objetivo: { metrica: 'distancia', valor: 2000 } }, null, { carrera: true }), /2000 metros.*Salida fuerte 20 paladas/);
  assert.equal(G.proposito('libre', null), '');
});

test('series: número de serie y frases de penúltima y última', () => {
  const plan = [{ nombre: 'Calentamiento' }, { nombre: 'Umbral 1/3' }, { nombre: 'Descanso' }, { nombre: 'Umbral 2/3' }, { nombre: 'Descanso' }, { nombre: 'Umbral 3/3' }];
  assert.equal(G.serieDe(plan, 0), null);
  assert.deepEqual(G.serieDe(plan, 3), { n: 2, total: 3 });
  assert.equal(G.inicioSerie('umbral', { n: 1, total: 3 }), 'Serie 1 de 3');
  assert.match(G.inicioSerie('umbral', { n: 2, total: 3 }), /Aquí se entrena el umbral/);
  assert.match(G.inicioSerie('vo2', { n: 5, total: 5 }), /Última\. Todo lo que queda/);
  // En técnica, sin número en el nombre, cuentan todos los bloques de trabajo (pirámide de paladas).
  const piramide = [{ nombre: 'Calentamiento' }, { nombre: '50 paladas' }, { nombre: 'Suave' }, { nombre: '100 paladas' }, { nombre: 'Suave' }, { nombre: '50 paladas' }];
  assert.deepEqual(G.serieDe(piramide, 3, 'tecnica'), { n: 2, total: 3 });
  assert.equal(G.serieDe(piramide, 3, 'fondo'), null);
  // Un bloque de trabajo único no es una serie.
  assert.equal(G.serieDe([{ nombre: 'Fondo' }], 0), null);
});

test('correcciones: cada tipo corrige lo suyo', () => {
  // Recuperación y fondo nunca piden apretar.
  assert.equal(G.correccion('recuperacion', { rango: 'bajo', potencia: true }), '');
  assert.match(G.correccion('recuperacion', { rango: 'alto', potencia: true }), /Demasiado fuerte para recuperar/);
  assert.match(G.correccion('fondo', { rango: 'alto', potencia: true }), /Suelta/);
  // Umbral: salir muy fuerte el primer minuto.
  assert.match(G.correccion('umbral', { rango: 'alto', potencia: true, enSerieSeg: 40 }), /Sales muy fuerte, baja 10 watts/);
  assert.equal(G.correccion('umbral', { rango: 'alto', potencia: true, enSerieSeg: 300 }), 'Baja la potencia');
  // VO2: por encima, silencio en las 2 primeras series; por debajo, solo tras 15 s.
  assert.equal(G.correccion('vo2', { rango: 'alto', potencia: true, serie: { n: 2, total: 5 } }), '');
  assert.match(G.correccion('vo2', { rango: 'alto', potencia: true, serie: { n: 3, total: 5 } }), /Dosifica, quedan 3/);
  assert.equal(G.correccion('vo2', { rango: 'bajo', potencia: true, fueraSeg: 8 }), '');
  assert.match(G.correccion('vo2', { rango: 'bajo', potencia: true, fueraSeg: 15 }), /estás en umbral/);
  // Sprints: en el descanso, descansar.
  assert.match(G.correccion('sprint', { rango: 'alto', potencia: true, trabajo: false }), /Descanso de verdad/);
  // Calentamientos y descansos de otros tipos no se corrigen.
  assert.equal(G.correccion('tecnica', { rango: 'alto', cadencia: 26, spmMin: 18, spmMax: 22, trabajo: false }), '');
  // Técnica: la cadencia con su número.
  assert.equal(G.correccion('tecnica', { rango: 'alto', cadencia: 26.4, spmMin: 18, spmMax: 22 }), 'Cadencia 26, la meta es 18 a 22. Frena la vuelta');
  assert.match(G.correccion('fondo', { rango: 'alto', pulso: true }), /Pulso alto, suelta/);
  assert.equal(G.correccion('fondo', { rango: 'dentro' }), '');
});

test('ritmo que cae: nunca «aprieta» en sesiones suaves', () => {
  assert.equal(G.ritmoCae('fondo'), '');
  assert.equal(G.ritmoCae('recuperacion'), '');
  assert.match(G.ritmoCae('objetivo', '2 05'), /ritmo objetivo de 2 05\. Aprieta/);
});

test('parciales: menos en fondo, ninguno en series cortas, sprints ni recuperación', () => {
  assert.equal(G.parcialCada('fondo'), 1000);
  assert.equal(G.parcialCada('objetivo'), 500);
  assert.equal(G.parcialCada('recuperacion'), 0);
  assert.equal(G.parcialCada('sprint'), 0);
  assert.equal(G.parcialCada('umbral', { nombre: 'Fuerte 1/8', duracion: 60, metrica: 'ftp' }), 0);
  assert.equal(G.parcialCada('umbral', { nombre: 'Umbral 1/3', duracion: 480, metrica: 'ftp' }), 500);
});

test('ánimos: consejos del tipo y nada en VO2, sprint ni pruebas', () => {
  assert.ok(G.SIN_ANIMO.has('vo2') && G.SIN_ANIMO.has('sprint') && G.SIN_ANIMO.has('prueba'));
  assert.equal(G.consejo('fondo', 0), 'Relaja hombros y manos');
  assert.equal(G.consejo('vo2', 0), '');
});

test('cierre: dice si se cumplió el propósito', () => {
  assert.match(G.cierre('fondo', { pctRango: 88 }), /^Fondo bien hecho: 88 por ciento en rango/);
  assert.match(G.cierre('fondo', { pctRango: 50 }), /más contenido/);
  assert.equal(G.cierre('vo2', { series: [{ pct: 90 }, { pct: 80 }, { pct: 40 }, { pct: 75 }, { pct: 72 }] }), 'VO2 terminado: 4 de 5 series en rango. Esto sube tu techo');
  assert.equal(G.cierre('sprint', { series: [{ picoW: 600 }, { picoW: 640 }, { picoW: 582 }] }), 'Sprints terminados. Pico de 640 watts, 9 por ciento de caída al final');
  assert.match(G.cierre('umbral', { series: [{ pct: 90 }, { pct: 60 }] }), /1 de 2 series en rango/);
  assert.match(G.cierre('objetivo', { pctRango: 70 }), /Entrenamiento completado\. Estuviste en rango el 70/);
});

test('voz: capas, cantidad de voz y silencio', () => {
  let ahora = 0;
  _reiniciar(() => ahora);
  // La información siempre suena.
  assert.ok(dejaSonar(1));
  // Solo datos: callan correcciones y ánimos.
  configurarCantidad('datos');
  assert.ok(!dejaSonar(2) && !dejaSonar(3));
  configurarCantidad('entrenador');
  assert.ok(dejaSonar(2) && !dejaSonar(3));
  configurarCantidad('completa');
  assert.ok(dejaSonar(3));
  // En silencio (últimos 10 s de un esfuerzo duro) solo la información.
  fijarSilencio(() => true);
  assert.ok(dejaSonar(1) && !dejaSonar(2) && !dejaSonar(3));
  fijarSilencio(null);
  assert.ok(dejaSonar(2));
  // Valor desconocido: completa.
  configurarCantidad('rara');
  assert.ok(dejaSonar(3));
  assert.equal(ESPERA_CAPA[3], 180);
});

test('voz: una de ánimo cada 3 min, una corrección cada 20 s y lo urgente corta lo menos importante', async () => {
  const dichas = [];
  let cortes = 0;
  globalThis.speechSynthesis = { speaking: false, cancel: () => { cortes++; }, speak(u) { this.speaking = true; dichas.push(u.text); }, getVoices: () => [] };
  globalThis.window = globalThis;
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  const { hablar } = await import('../src/voz.js');
  let ahora = 0;
  _reiniciar(() => ahora);
  assert.ok(hablar('Relaja hombros', { capa: 3 }));
  ahora = 60_000;
  // Sigue sonando la anterior (no llegó onend) y además no han pasado 3 min.
  assert.ok(!hablar('Piernas, espalda, brazos', { capa: 3 }));
  assert.ok(hablar('Baja la potencia', { capa: 2 }));
  assert.equal(cortes, 1, 'la corrección corta el ánimo que sonaba');
  ahora = 70_000;
  assert.ok(!hablar('Sube la potencia', { capa: 2 }), 'menos de 20 s desde la última corrección');
  ahora = 90_000;
  assert.ok(hablar('Sube la potencia', { capa: 2 }));
  assert.deepEqual(dichas, ['Relaja hombros', 'Baja la potencia', 'Sube la potencia']);
  delete globalThis.window; delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
});
