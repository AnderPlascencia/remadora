import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { debePublicarse, archivosAPublicar } from '../tools/publicar.mjs';

test('lo que se publica deja fuera las fuentes de arte, las herramientas, los documentos y .claude', () => {
  for (const r of ['index.html', 'sw.js', 'manifest.webmanifest', 'src/app.js', 'src/pantallas/vivo.js', 'assets/heroes/vikingo_novato.webp']) assert.ok(debePublicarse(r), r);
  for (const r of ['assets/characters/vikingo/x.png', 'tools/publicar.mjs', 'docs/STYLE_GUIDE.md', '.claude/skills/x.md', 'pruebas/sw.test.mjs', 'README.md', 'package.json', 'node_modules/x/y.js']) {
    assert.ok(!debePublicarse(r), r);
  }
});

test('todo lo que la app y el service worker piden está en lo publicado', () => {
  const lista = new Set(archivosAPublicar());
  assert.ok(![...lista].some((f) => /^(assets\/characters|tools|docs|\.claude)\//.test(f)));
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const pedidos = [...sw.matchAll(/'((?:src|assets)\/[\w./-]+\.\w+)'/g)].map((m) => m[1]);
  // Héroes: 5 clases × 9 rangos, figura y retrato, armados en sw.js con plantillas.
  const clases = sw.match(/const CLASES = \[([^\]]+)\]/)[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1));
  const rangos = sw.match(/const RANGOS = \[([^\]]+)\]/)[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1));
  for (const c of clases) for (const r of rangos) pedidos.push(`assets/heroes/${c}_${r}.webp`, `assets/heroes/${c}_${r}_retrato.webp`);
  const faltan = pedidos.filter((f) => !lista.has(f));
  assert.deepEqual(faltan, []);
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) assert.ok(lista.has(f), f);
});

test('las fuentes de arte que van por Git LFS están guardadas como puntero, sin tocar las de antes', async () => {
  const { execFileSync } = await import('node:child_process');
  const git = (...a) => execFileSync('git', a, { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  let archivos;
  try { archivos = git('ls-files', '-z').split('\0').filter(Boolean); } catch { return; } // sin git (copia suelta)
  const attrs = git('check-attr', 'filter', '--', ...archivos).trim().split('\n');
  const enLfs = attrs.filter((l) => l.endsWith(': filter: lfs')).map((l) => l.split(': filter:')[0]);
  for (const f of enLfs) {
    const inicio = git('cat-file', '-p', `HEAD:${f}`).slice(0, 40);
    assert.ok(inicio.startsWith('version https://git-lfs'), `${f} debería estar en LFS`);
  }
});
