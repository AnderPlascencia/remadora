import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { FRASES_CLASE } from '../src/voz-juego.js';
import { GRABADAS, grabacionDe, RUTAS_GRABADAS } from '../src/voces-clase.js';
import { _reiniciar } from '../src/voz.js';

test('frases grabadas: cada ruta existe y se busca por el texto exacto', () => {
  assert.equal(Object.keys(GRABADAS.vikingo).length, 6);
  assert.equal(Object.keys(GRABADAS.romano).length, 5);
  assert.equal(Object.keys(GRABADAS.polinesio).length, 5);
  assert.equal(Object.keys(GRABADAS.samurai).length, 7);
  for (const r of RUTAS_GRABADAS) assert.ok(existsSync(new URL(`../${r}`, import.meta.url)), r);
  assert.equal(grabacionDe('Cada palada, un hachazo'), 'assets/voces/vikingo/frase-1.mp3');
  assert.equal(grabacionDe('Baja la potencia'), null);
  // El texto grabado es el de las frases de clase, tal cual.
  for (const [clase, frases] of Object.entries(GRABADAS)) {
    const textos = FRASES_CLASE[clase].map(([t]) => t);
    for (const t of Object.keys(frases)) assert.ok(textos.includes(t), `${clase}: ${t}`);
  }
});

test('voz: una frase grabada suena con su MP3; si falla, con la voz del navegador', async () => {
  const dichas = [];
  const audios = [];
  globalThis.speechSynthesis = { speaking: false, cancel() {}, speak(u) { dichas.push(u.text); }, getVoices: () => [] };
  globalThis.window = globalThis;
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  let falla = false;
  globalThis.Audio = class {
    constructor(src) { this.src = src; this.paused = true; this.ended = false; audios.push(this); }
    play() { if (falla) return Promise.reject(new Error('bloqueado')); this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  };
  const { hablar } = await import('../src/voz.js');
  _reiniciar(() => 0);
  assert.ok(hablar('Cada palada, un hachazo', { capa: 3 }));
  assert.equal(audios.length, 1);
  assert.equal(audios[0].src, 'assets/voces/vikingo/frase-1.mp3');
  assert.deepEqual(dichas, []);
  // Una corrección corta la grabación que suena.
  assert.ok(hablar('Baja la potencia', { capa: 2 }));
  assert.ok(audios[0].paused);
  assert.deepEqual(dichas, ['Baja la potencia']);
  // Si el navegador no deja reproducir, la frase la dice la voz del navegador.
  _reiniciar(() => 0);
  falla = true;
  assert.ok(hablar('Rema como quien abre el mar', { capa: 3 }));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(dichas, ['Baja la potencia', 'Rema como quien abre el mar']);
  delete globalThis.window; delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance; delete globalThis.Audio;
});
