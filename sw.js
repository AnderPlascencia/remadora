// Guarda la app en caché para que abra sin conexión. Cambia VERSION al publicar cambios.
const VERSION = 'remadora-0.6.1';
const ARCHIVOS = ['./', 'index.html', 'estilos.css', 'app.js', 'remadora.js', 'protocolo.js', 'variantes.js',
  'grafica.js', 'db.js', 'entrenamientos.js', 'estadisticas.js', 'voz.js', 'programa.js', 'fantasma.js', 'carrera.js', 'manifest.webmanifest', 'icono.svg', 'icono-192.png', 'icono-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request)
    .then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request)));
});
