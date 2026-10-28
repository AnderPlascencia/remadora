// Guarda la app en caché para que abra sin conexión. Cambia VERSION al publicar cambios.
const VERSION = 'remadora-0.15.0';
const ARCHIVOS = ['./', 'index.html', 'estilos.css', 'app.js', 'remadora.js', 'protocolo.js', 'variantes.js',
  'grafica.js', 'db.js', 'entrenamientos.js', 'estadisticas.js', 'voz.js', 'programa.js', 'fantasma.js', 'carrera.js', 'efectos.js', 'juego.js', 'talentos.js', 'ventajas.js', 'objetos.js', 'manifest.webmanifest', 'rower-logo.svg', 'rower-marca.svg', 'rower-192.png', 'rower-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS.map((a) => new Request(a, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
