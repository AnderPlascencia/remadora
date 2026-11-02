import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// La versión que se ve en Ajustes y la de la caché deben ir juntas: si solo cambia una, el teléfono
// no descarga la versión nueva o muestra un número viejo (pasó en la v0.41.0).
const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const app = leer('app.js').match(/^const VERSION = '([\d.]+)';/m)?.[1];
const sw = leer('sw.js').match(/^const VERSION = 'remadora-([\d.]+)';/m)?.[1];
assert.ok(app, 'app.js sin VERSION');
assert.ok(sw, 'sw.js sin VERSION');
assert.equal(sw, app, `sw.js (${sw}) y app.js (${app}) tienen versiones distintas`);

// Todo módulo que la app importa debe estar en la caché sin conexión.
const archivos = [...leer('sw.js').matchAll(/'([\w./-]+\.(?:js|css|html|svg|png|webmanifest|woff2))'/g)].map((m) => m[1]);
const pendientes = ['app.js'];
const vistos = new Set();
while (pendientes.length) {
  const f = pendientes.pop();
  if (vistos.has(f)) continue;
  vistos.add(f);
  for (const [, dep] of leer(f).matchAll(/^import[^'"]*['"]\.\/([\w./-]+\.js)['"]/gm)) pendientes.push(dep);
}
for (const f of vistos) assert.ok(archivos.includes(f), `${f} no está en la caché de sw.js`);
for (const f of archivos) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `sw.js guarda ${f}, que no existe`);

console.log('version: ok', app);
