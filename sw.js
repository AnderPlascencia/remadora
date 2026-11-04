// Guarda la app en caché para que abra sin conexión.
// La versión no se escribe aquí: src/app.js registra «sw.js?v=<versión de src/version.js>», así que cada versión
// nueva instala un service worker nuevo con su propia caché.
const VERSION = `remadora-${new URL(self.location.href).searchParams.get('v') || 'dev'}`;
const ARCHIVOS = ['./', 'index.html', 'src/estilos.css', 'src/app.js', 'src/estado.js', 'src/navegacion.js', 'src/registro.js', 'src/pantallas/ajustes.js', 'src/pantallas/preparar.js', 'src/pantallas/vivo.js', 'src/pantallas/sesion.js', 'src/pantallas/planes.js', 'src/pantallas/progreso.js', 'src/pantallas/heroe.js', 'src/pantallas/detalle.js', 'src/pantallas/programa.js', 'src/pantallas/inicio.js', 'src/pantallas/ayuda.js',
  'src/remadora.js', 'src/protocolo.js', 'src/variantes.js',
  'src/grafica.js', 'src/db.js', 'src/historial.js', 'src/entrenamientos.js', 'src/estadisticas.js', 'src/voz.js', 'src/programa.js', 'src/fantasma.js', 'src/carrera.js', 'src/efectos.js', 'src/juego.js', 'src/xp-carga.js', 'src/talentos.js', 'src/ventajas.js', 'src/base.js', 'src/objetos.js', 'src/consejos.js', 'src/capacidades.js', 'src/adaptacion.js', 'src/perfil.js', 'src/guia.js', 'src/ui.js', 'src/ajustes-guardados.js', 'src/respaldo.js', 'src/reloj.js', 'src/version.js', 'manifest.webmanifest', 'assets/marca/rower-logo.svg', 'assets/marca/rower-marca.svg', 'assets/marca/rower-marca-clara.svg', 'assets/marca/rower-192.png', 'assets/marca/rower-512.png', 'assets/fuentes/barlow-condensed-600.woff2', 'assets/fuentes/barlow-condensed-700.woff2'];

// Ilustraciones de los héroes (5 clases × 9 rangos, figura y retrato): ~1.7 MB. Se guardan aparte para que,
// si alguna falla, la app igual quede instalada; así los rangos que aún no has visto también salen sin conexión.
const CLASES = ['pirata', 'polinesio', 'romano', 'samurai', 'vikingo'];
const RANGOS = ['novato', 'aprendiz', 'combatiente', 'guerrero', 'veterano', 'elite', 'campeon', 'maestro', 'legendario'];
const HEROES = CLASES.flatMap((c) => RANGOS.flatMap((r) => [`assets/heroes/${c}_${r}.webp`, `assets/heroes/${c}_${r}_retrato.webp`]));
// Paisajes de la carrera renderizados en Blender (fiordo ~70 KB, laguna ~190 KB, miniaturas de la tienda ~15 KB);
// sin ellos se dibujan las formas sencillas.
const PAISAJE = ['assets/carrera/fiordo.webp', 'assets/carrera/orilla.webp', 'assets/carrera/costa.webp', 'assets/carrera/fiordo_mini.webp',
  'assets/carrera/laguna.webp', 'assets/carrera/laguna_orilla.webp', 'assets/carrera/laguna_costa.webp', 'assets/carrera/laguna_mini.webp',
  'assets/carrera/rival_vikingo.webp'];
// Los vídeos de la vista realista (~1,2 MB) son de una clase: no se precargan al instalar. La app los pide con un
// mensaje «precargar» cuando tu héroe es de esa clase (ver src/app.js).
const VIDEOS = { vikingo: ['assets/carrera/remo_vikingo.mp4', 'assets/carrera/remo_vikingo_v.mp4'] };

// Solo se guardan respuestas completas: ni errores (404, 500), ni respuestas opacas, ni trozos de un vídeo (206).
const sePuedeGuardar = (r) => !!r && r.ok && r.status !== 206;

async function guardarEnCache(peticion, respuesta) {
  if (!sePuedeGuardar(respuesta)) return;
  const c = await caches.open(VERSION);
  await c.put(peticion, respuesta);
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(ARCHIVOS.map((a) => new Request(a, { cache: 'reload' })))
      .then(() => Promise.all([...HEROES, ...PAISAJE].map((a) => c.add(a).catch(() => {})))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('remadora-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// { tipo: 'precargar', clase }: guarda los vídeos de esa clase para verlos sin conexión.
self.addEventListener('message', (e) => {
  if (e.data?.tipo !== 'precargar') return;
  const lista = VIDEOS[e.data.clase] || [];
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(lista.map(async (a) => {
    if (await c.match(a)) return;
    try { await guardarEnCache(a, await fetch(a)); } catch { /* sin conexión: otra vez será */ }
  }))));
});

const enAssets = (url) => url.origin === self.location.origin && url.pathname.startsWith(new URL('assets/', self.registration.scope).pathname);

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Imágenes, fuentes y vídeos (assets/) no cambian dentro de una versión: caché primero y red si no están.
  // Cada versión nueva estrena caché, así que una imagen cambiada llega con la versión siguiente.
  if (enAssets(url)) {
    e.respondWith(caches.match(e.request).then((guardada) => guardada || fetch(e.request).then((r) => {
      e.waitUntil(guardarEnCache(e.request, r.clone()));
      return r;
    })));
    return;
  }
  // El código y la página: red primero (para recibir actualizaciones) y caché si no hay conexión.
  // cache: 'no-cache' revalida con el servidor para no quedarse con archivos viejos del navegador.
  e.respondWith(fetch(e.request, { cache: 'no-cache' })
    .then((r) => { e.waitUntil(guardarEnCache(e.request, r.clone())); return r; })
    .catch(() => caches.match(e.request)));
});
