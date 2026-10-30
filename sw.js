// Guarda la app en caché para que abra sin conexión. Cambia VERSION al publicar cambios.
const VERSION = 'remadora-0.29.0';
const ARCHIVOS = ['./', 'index.html', 'estilos.css', 'app.js', 'remadora.js', 'protocolo.js', 'variantes.js',
  'grafica.js', 'db.js', 'entrenamientos.js', 'estadisticas.js', 'voz.js', 'programa.js', 'fantasma.js', 'carrera.js', 'efectos.js', 'juego.js', 'talentos.js', 'ventajas.js', 'base.js', 'objetos.js', 'consejos.js', 'manifest.webmanifest', 'rower-logo.svg', 'rower-marca.svg', 'rower-marca-clara.svg', 'rower-192.png', 'rower-512.png', 'assets/fuentes/barlow-condensed-600.woff2', 'assets/fuentes/barlow-condensed-700.woff2'];

// Ilustraciones de los héroes (5 clases × 9 rangos, figura y retrato): ~1.7 MB. Se guardan aparte para que,
// si alguna falla, la app igual quede instalada; así los rangos que aún no has visto también salen sin conexión.
const CLASES = ['pirata', 'polinesio', 'romano', 'samurai', 'vikingo'];
const RANGOS = ['novato', 'aprendiz', 'combatiente', 'guerrero', 'veterano', 'elite', 'campeon', 'maestro', 'legendario'];
const HEROES = CLASES.flatMap((c) => RANGOS.flatMap((r) => [`assets/heroes/${c}_${r}.webp`, `assets/heroes/${c}_${r}_retrato.webp`]));
// Paisajes de la carrera renderizados en Blender (fiordo ~70 KB, laguna ~190 KB, miniaturas de la tienda ~15 KB);
// sin ellos se dibujan las formas sencillas.
const PAISAJE = ['assets/carrera/fiordo.webp', 'assets/carrera/orilla.webp', 'assets/carrera/costa.webp', 'assets/carrera/fiordo_mini.webp',
  'assets/carrera/laguna.webp', 'assets/carrera/laguna_orilla.webp', 'assets/carrera/laguna_costa.webp', 'assets/carrera/laguna_mini.webp',
  // vista realista del vikingo remando (tools/blender/remo_agua, ~700 KB el apaisado y ~450 KB el vertical)
  'assets/carrera/remo_vikingo.mp4', 'assets/carrera/remo_vikingo_v.mp4'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(ARCHIVOS.map((a) => new Request(a, { cache: 'reload' })))
      .then(() => Promise.all([...HEROES, ...PAISAJE].map((a) => c.add(a).catch(() => {})))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // cache: 'no-cache' revalida con el servidor para no quedarse con archivos viejos del navegador.
  e.respondWith(fetch(e.request, { cache: 'no-cache' })
    .then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request)));
});
