import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

// Corre sw.js con un navegador de mentira: caches, fetch y los eventos del service worker.
const codigo = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const ORIGEN = 'https://app.test/remadora/';

// pantallas: lista de respuestas de cada pantalla abierta a «¿hay sesión en curso?» (true, false o null = no contesta).
function montar({ red = () => respuesta(200), pantallas = null } = {}) {
  const activaciones = [];
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
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (p) => m.delete(clave(p)),
    };
  };
  const oyentes = {};
  const pedidas = [];
  const ctx = {
    URL,
    console,
    crypto,
    Request: class { constructor(u) { this.url = new URL(typeof u === 'string' ? u : u.url, ORIGEN).href; this.method = 'GET'; } },
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
      skipWaiting: async () => { activaciones.push('skipWaiting'); },
      clients: {
        claim: () => {},
        ...(pantallas ? {
          matchAll: async () => pantallas.map((enCurso) => ({
            postMessage: (m, [puerto]) => {
              if (m.tipo === 'sesionEnCurso?' && enCurso != null) puerto.postMessage({ enCurso });
            },
          })),
        } : {}),
      },
    },
    ...(pantallas ? { MessageChannel, setTimeout, clearTimeout } : {}),
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
  const recurso = async (url) => (await ctx.caches.open('recursos-remadora')).match(url);
  return { disparar, guardado, recurso, almacenes, pedidas, activaciones, ctx };
}

function respuesta(status, cuerpo = 'x') {
  return {
    status, ok: status >= 200 && status < 300, cuerpo, clone() { return this; },
    arrayBuffer: async () => new TextEncoder().encode(String(cuerpo)).buffer,
    json: async () => JSON.parse(cuerpo),
  };
}
const huella = (t) => createHash('sha256').update(String(t)).digest('hex').slice(0, 16);
const pedir = (url, mode) => ({ request: { method: 'GET', url: new URL(url, ORIGEN).href, mode } });

test('la caché lleva la versión de la URL con que se registró sw.js', async () => {
  const sw = montar();
  await sw.disparar('install', {});
  assert.deepEqual([...sw.almacenes.keys()].sort(), ['recursos-remadora', 'remadora-9.9.9'], 'código con versión; imágenes y voces, sin ella');
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
  assert.ok(await sw.recurso('assets/carrera/remo_vikingo.mp4'));
  assert.ok(await sw.recurso('assets/carrera/remo_vikingo_v.mp4'));
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

test('assets/ y el código, con caché primero: el código de una versión no se mezcla con el de otra', async () => {
  let version = 1;
  const sw = montar({ red: () => respuesta(200, `v${version}`) });
  assert.equal((await sw.disparar('fetch', pedir('assets/heroes/pirata_novato.webp'))).cuerpo, 'v1');
  assert.equal((await sw.disparar('fetch', pedir('src/app.js'))).cuerpo, 'v1');
  version = 2;
  assert.equal((await sw.disparar('fetch', pedir('assets/heroes/pirata_novato.webp'))).cuerpo, 'v1');
  assert.equal((await sw.disparar('fetch', pedir('src/app.js'))).cuerpo, 'v1');
  // La consulta de la versión nueva (con «?…») siempre va a la red y no se guarda.
  assert.equal((await sw.disparar('fetch', pedir('src/version.js?comprobar=1'))).cuerpo, 'v2');
  assert.equal(await sw.guardado('src/version.js?comprobar=1'), undefined);
  // La página abierta desde un atajo (?atajo=hoy) es la misma página guardada.
  await sw.disparar('fetch', pedir('./', 'navigate'));
  assert.equal((await sw.disparar('fetch', pedir('./?atajo=hoy', 'navigate'))).cuerpo, 'v2');
});

test('una versión nueva sin arte nuevo solo baja lo que cambió (huellas.json)', async () => {
  // El servidor: cada archivo con su contenido; huellas.json con la huella de cada uno.
  const contenido = (u) => (u.endsWith('src/version.js') ? 'version-2' : `contenido de ${u.replace(ORIGEN, '')}`);
  const sw = montar({
    red: (u) => {
      const ruta = u.replace(ORIGEN, '');
      if (ruta === 'huellas.json') {
        const h = {};
        for (const r of ['index.html', 'src/app.js', 'src/version.js', 'assets/heroes/vikingo_novato.webp', 'assets/carrera/canon.webp']) h[r] = huella(contenido(ORIGEN + r));
        return respuesta(200, JSON.stringify(h));
      }
      return respuesta(200, contenido(u));
    },
  });
  // Lo que ya estaba: la versión anterior (código) y los recursos; version.js y un paisaje comprado, con otro contenido.
  const vieja = await sw.ctx.caches.open('remadora-9.9.8');
  for (const r of ['./', 'src/app.js']) await vieja.put(r, respuesta(200, contenido(ORIGEN + (r === './' ? '' : r))));
  await vieja.put('./', respuesta(200, contenido(`${ORIGEN}index.html`)));
  await vieja.put('src/version.js', respuesta(200, 'version-1'));
  const rec = await sw.ctx.caches.open('recursos-remadora');
  await rec.put('assets/heroes/vikingo_novato.webp', respuesta(200, contenido(`${ORIGEN}assets/heroes/vikingo_novato.webp`)));
  await rec.put('assets/carrera/canon.webp', respuesta(200, 'paisaje viejo'));
  await rec.put('assets/carrera/quitado.webp', respuesta(200, 'ya no existe'));

  await sw.disparar('install', {});
  const bajadas = sw.pedidas.map((u) => u.replace(ORIGEN, ''));
  assert.ok(bajadas.includes('huellas.json'));
  assert.ok(bajadas.includes('src/version.js'), 'lo que cambió se baja');
  for (const r of ['', 'src/app.js', 'assets/heroes/vikingo_novato.webp']) assert.ok(!bajadas.includes(r), `${r || './'} no cambió: se copia`);
  assert.equal((await sw.guardado('src/app.js')).cuerpo, 'contenido de src/app.js');
  assert.equal((await sw.guardado('src/version.js')).cuerpo, 'version-2');
  assert.ok(await sw.guardado('./'));
  assert.equal(await sw.recurso('assets/carrera/canon.webp'), undefined, 'el paisaje que cambió se vuelve a bajar al pedirlo');
  assert.equal(await sw.recurso('assets/carrera/quitado.webp'), undefined, 'lo que ya no existe se borra');
  assert.ok(await sw.recurso('assets/heroes/vikingo_novato.webp'));
});

test('sin huellas.json (sin red o un servidor viejo) se baja todo, como antes', async () => {
  const sw = montar({ red: (u) => (u.endsWith('huellas.json') ? respuesta(404) : respuesta(200, 'x')) });
  await sw.disparar('install', {});
  assert.ok(sw.pedidas.some((u) => u.endsWith('src/app.js')));
  assert.ok(sw.pedidas.some((u) => u.endsWith('assets/heroes/vikingo_novato.webp')));
  assert.ok(await sw.guardado('src/app.js'));
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
  assert.ok(await sw.recurso('assets/carrera/canon.webp'));
  assert.ok(await sw.recurso('assets/carrera/canon_orilla.webp'));
  assert.deepEqual(sw.pedidas.map((u) => u.replace(ORIGEN, '')), ['assets/carrera/canon.webp', 'assets/carrera/canon_orilla.webp']);
});

test('una versión nueva se activa al instalarse si nadie está remando (también con pantallas viejas que no contestan)', async () => {
  for (const pantallas of [null, [], [false], [null], [false, null]]) {
    const { disparar, activaciones } = montar({ pantallas });
    await disparar('install');
    assert.deepEqual(activaciones, ['skipWaiting'], JSON.stringify(pantallas));
  }
});

test('con una sesión en curso, la versión nueva espera a que la pantalla avise al terminar', async () => {
  const { disparar, activaciones } = montar({ pantallas: [false, true] });
  await disparar('install');
  assert.deepEqual(activaciones, []);
  await disparar('message', { data: { tipo: 'activar' } });
  assert.deepEqual(activaciones, ['skipWaiting']);
});
