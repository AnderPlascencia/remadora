import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Corre sw.js con un navegador de mentira: caches, fetch y los eventos del service worker.
const codigo = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const ORIGEN = 'https://app.test/remadora/';

function montar({ red = () => respuesta(200) } = {}) {
  const almacenes = new Map();
  const abrir = (n) => {
    if (!almacenes.has(n)) almacenes.set(n, new Map());
    const m = almacenes.get(n);
    const clave = (p) => new URL(typeof p === 'string' ? p : p.url, ORIGEN).href;
    return {
      put: async (p, r) => { m.set(clave(p), r); },
      match: async (p) => m.get(clave(p)),
      add: async (p) => { const r = await ctx.fetch(p); if (!r.ok) throw new Error('mal'); m.set(clave(p), r); },
      addAll: async (ps) => { for (const p of ps) await abrir(n).add(p); },
      keys: async () => [...m.keys()],
    };
  };
  const oyentes = {};
  const pedidas = [];
  const ctx = {
    URL,
    console,
    Request: class { constructor(u) { this.url = new URL(u, ORIGEN).href; this.method = 'GET'; } },
    fetch: async (p) => { const url = new URL(typeof p === 'string' ? p : p.url, ORIGEN).href; pedidas.push(url); return red(url); },
    caches: {
      open: async (n) => abrir(n),
      keys: async () => [...almacenes.keys()],
      delete: async (n) => almacenes.delete(n),
      match: async (p) => { for (const n of almacenes.keys()) { const r = await abrir(n).match(p); if (r) return r; } return undefined; },
    },
    self: {
      location: { href: `${ORIGEN}sw.js?v=9.9.9`, origin: 'https://app.test' },
      registration: { scope: ORIGEN },
      addEventListener: (t, fn) => { oyentes[t] = fn; },
      skipWaiting: () => {},
      clients: { claim: () => {} },
    },
  };
  vm.runInNewContext(codigo, ctx);
  const disparar = async (tipo, datos) => {
    const esperas = [];
    let respuestaP = null;
    oyentes[tipo]({ ...datos, waitUntil: (p) => esperas.push(p), respondWith: (p) => { respuestaP = p; } });
    const r = await respuestaP;
    await Promise.all(esperas);
    return r;
  };
  const guardado = async (url) => (await ctx.caches.open('remadora-9.9.9')).match(url);
  return { disparar, guardado, almacenes, pedidas };
}

function respuesta(status, cuerpo = 'x') {
  return { status, ok: status >= 200 && status < 300, cuerpo, clone() { return this; } };
}
const pedir = (url) => ({ request: { method: 'GET', url: new URL(url, ORIGEN).href } });

test('la caché lleva la versión de la URL con que se registró sw.js', async () => {
  const sw = montar();
  await sw.disparar('install', {});
  assert.deepEqual([...sw.almacenes.keys()], ['remadora-9.9.9']);
});

test('al instalar no se precargan los vídeos de ninguna clase', async () => {
  const sw = montar();
  await sw.disparar('install', {});
  assert.ok(sw.pedidas.some((u) => u.endsWith('src/app.js')));
  assert.ok(sw.pedidas.some((u) => u.endsWith('assets/heroes/vikingo_novato.webp')));
  assert.ok(!sw.pedidas.some((u) => u.endsWith('.mp4')));
});

test('los vídeos de tu clase se guardan cuando la app lo pide, y los de otra clase no', async () => {
  const sw = montar();
  await sw.disparar('message', { data: { tipo: 'precargar', clase: 'pirata' } });
  assert.ok(!sw.pedidas.some((u) => u.endsWith('.mp4')));
  await sw.disparar('message', { data: { tipo: 'precargar', clase: 'vikingo' } });
  assert.ok(await sw.guardado('assets/carrera/remo_vikingo.mp4'));
  assert.ok(await sw.guardado('assets/carrera/remo_vikingo_v.mp4'));
});

test('solo se guardan respuestas completas: ni 404 ni trozos de vídeo (206)', async () => {
  const estados = { 'src/roto.js': 404, 'assets/carrera/remo_vikingo.mp4': 206, 'src/app.js': 200 };
  const sw = montar({ red: (u) => respuesta(estados[u.replace(ORIGEN, '')] ?? 200) });
  await sw.disparar('fetch', pedir('src/roto.js'));
  await sw.disparar('fetch', pedir('assets/carrera/remo_vikingo.mp4'));
  await sw.disparar('fetch', pedir('src/app.js'));
  assert.equal(await sw.guardado('src/roto.js'), undefined);
  assert.equal(await sw.guardado('assets/carrera/remo_vikingo.mp4'), undefined);
  assert.ok(await sw.guardado('src/app.js'));
});

test('assets/ va con caché primero; el código, con red primero', async () => {
  let version = 1;
  const sw = montar({ red: () => respuesta(200, `v${version}`) });
  assert.equal((await sw.disparar('fetch', pedir('assets/heroes/pirata_novato.webp'))).cuerpo, 'v1');
  assert.equal((await sw.disparar('fetch', pedir('src/app.js'))).cuerpo, 'v1');
  version = 2;
  assert.equal((await sw.disparar('fetch', pedir('assets/heroes/pirata_novato.webp'))).cuerpo, 'v1');
  assert.equal((await sw.disparar('fetch', pedir('src/app.js'))).cuerpo, 'v2');
});

test('sin conexión, el código sale de la caché', async () => {
  let conRed = true;
  const sw = montar({ red: () => { if (!conRed) throw new TypeError('sin red'); return respuesta(200, 'app'); } });
  await sw.disparar('fetch', pedir('src/app.js'));
  conRed = false;
  assert.equal((await sw.disparar('fetch', pedir('src/app.js'))).cuerpo, 'app');
});

test('al instalar se guardan el fiordo y las miniaturas, pero no los paisajes de pago', async () => {
  const { PAISAJES } = await import('../src/carrera.js');
  const sw = montar();
  await sw.disparar('install', {});
  for (const [id, x] of Object.entries(PAISAJES)) {
    assert.ok(sw.pedidas.some((u) => u.endsWith(x.miniatura)), `miniatura de ${id}`);
    for (const f of [x.panorama.src, x.costa, x.orilla.src]) {
      const pedida = sw.pedidas.some((u) => u.endsWith(f));
      // Las variantes del fiordo usan sus imágenes, que van siempre (es el paisaje gratis).
      if (f.startsWith('assets/carrera/fiordo') || ['assets/carrera/orilla.webp', 'assets/carrera/costa.webp'].includes(f)) assert.ok(pedida, f);
      else assert.ok(!pedida, `${f} (${id}) no debería precargarse`);
    }
  }
});

test('los paisajes comprados se guardan cuando la app lo pide, y solo imágenes de la carrera', async () => {
  const sw = montar();
  await sw.disparar('message', { data: { tipo: 'precargar', clase: null, archivos: [
    'assets/carrera/canon.webp', 'assets/carrera/canon_orilla.webp', 'src/app.js', '../secreto.webp', 'https://otro.sitio/x.webp', 42,
  ] } });
  assert.ok(await sw.guardado('assets/carrera/canon.webp'));
  assert.ok(await sw.guardado('assets/carrera/canon_orilla.webp'));
  assert.deepEqual(sw.pedidas.map((u) => u.replace(ORIGEN, '')), ['assets/carrera/canon.webp', 'assets/carrera/canon_orilla.webp']);
});
