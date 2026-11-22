import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularHuellas, conPrecarga, modulosDeArranque, textoHuellas } from '../tools/huellas.mjs';

// Etapa 19. huellas.json dice al service worker qué archivos cambiaron: si se queda viejo, una versión nueva podría
// quedarse con un archivo anterior. Si esta prueba falla, corre `npm test` (fuera del CI lo regenera) o
// `node tools/huellas.mjs`, y sube index.html y huellas.json.
const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('huellas.json está al día con lo que se publica', () => {
  assert.equal(leer('huellas.json'), textoHuellas(calcularHuellas()), 'huellas.json viejo: corre `node tools/huellas.mjs`');
  const h = JSON.parse(leer('huellas.json'));
  for (const f of ['index.html', 'src/app.js', 'src/version.js', 'assets/heroes/vikingo_novato.webp']) assert.match(h[f], /^[0-9a-f]{16}$/, f);
  assert.ok(!('sw.js' in h) && !('huellas.json' in h));
});

test('index.html precarga todos los módulos del arranque, y solo esos', () => {
  const html = leer('index.html');
  const enHtml = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(enHtml, modulosDeArranque().filter((m) => m !== 'src/app.js'), 'precarga vieja: corre `node tools/huellas.mjs`');
  assert.ok(!enHtml.includes('src/tarjeta-imagen.js'), 'lo que se carga al abrir algo no se precarga');
  assert.equal(conPrecarga(html, enHtml), html, 'regenerar no cambia nada');
});
