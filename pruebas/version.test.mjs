import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';

// La versión vive en un solo lugar, src/version.js. sw.js la recibe en su URL (sw.js?v=…) y el CHANGELOG
// empieza por ella; si solo cambiara una, el teléfono no descargaría la versión nueva (pasó en la v0.41.0).
const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const app = leer('src/version.js').match(/^export const VERSION = '([\d.]+)';/m)?.[1];
assert.ok(app, 'src/version.js sin VERSION');
assert.ok(!/remadora-\d/.test(leer('sw.js')), 'sw.js no debe llevar la versión escrita');
assert.match(leer('src/app.js'), /serviceWorker\.register\(`sw\.js\?v=\$\{VERSION\}`\)/, 'src/app.js debe registrar sw.js?v=${VERSION}');
assert.ok(!/"version"/.test(leer('package.json')), 'package.json no debe llevar otra versión');
const changelog = leer('CHANGELOG.md').match(/^## (\d+\.\d+\.\d+)/m)?.[1];
assert.equal(changelog, app, `CHANGELOG.md empieza por ${changelog} y src/version.js dice ${app}`);

// La caché sin conexión (ARCHIVOS de sw.js) y los import de src/ deben coincidir: todo módulo que la app
// importa está en la caché, y todo .js de la caché lo importa alguien.
const archivos = [...leer('sw.js').matchAll(/'([\w./-]+\.(?:js|css|html|svg|png|webmanifest|woff2))'/g)].map((m) => m[1]);
const pendientes = ['src/app.js'];
const vistos = new Set();
while (pendientes.length) {
  const f = pendientes.pop();
  if (vistos.has(f)) continue;
  vistos.add(f);
  const texto = leer(f);
  assert.ok(!/\bimport\(/.test(texto), `${f} usa import() dinámico: la prueba no lo puede seguir`);
  for (const [, dep] of texto.matchAll(/^import[^'"]*['"](\.{1,2}\/[\w./-]+\.js)['"]/gm)) pendientes.push(posix.join(posix.dirname(f), dep));
}
for (const f of vistos) assert.ok(archivos.includes(f), `${f} no está en la caché de sw.js`);
for (const f of archivos) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `sw.js guarda ${f}, que no existe`);
for (const f of archivos.filter((a) => a.endsWith('.js'))) assert.ok(vistos.has(f), `sw.js guarda ${f}, que nadie importa`);
// Y no queda código suelto en src/ que nadie cargue.
const todos = ['src', 'src/pantallas'].flatMap((d) => readdirSync(new URL(`../${d}/`, import.meta.url)).filter((x) => x.endsWith('.js')).map((x) => `${d}/${x}`));
for (const f of todos) assert.ok(vistos.has(f), `${f} no lo importa nadie`);

console.log('version: ok', app);
