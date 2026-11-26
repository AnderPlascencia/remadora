// Guarda la app en caché para que abra sin conexión.
// La versión no se escribe aquí: src/app.js registra «sw.js?v=<versión de src/version.js>», así que cada versión
// nueva instala un service worker nuevo con su propia caché.
const VERSION = `remadora-${new URL(self.location.href).searchParams.get('v') || 'dev'}`;
const ARCHIVOS = ['./', 'index.html', 'src/estilos.css', 'src/app.js', 'src/estado.js', 'src/navegacion.js', 'src/registro.js', 'src/pantallas/ajustes.js', 'src/pantallas/preparar.js', 'src/pantallas/vivo.js', 'src/pantallas/sesion.js', 'src/pantallas/sesion-guardar.js', 'src/pantallas/sesion-voz.js', 'src/pantallas/planes.js', 'src/pantallas/planes-editor.js', 'src/pantallas/compartir.js', 'src/pantallas/progreso.js', 'src/pantallas/heroe.js', 'src/pantallas/previa.js', 'src/pantallas/detalle.js', 'src/pantallas/resumen-xp.js', 'src/pantallas/programa.js', 'src/pantallas/programa-vista.js', 'src/pantallas/inicio.js', 'src/pantallas/ayuda.js',
  'src/remadora.js', 'src/protocolo.js', 'src/variantes.js',
  'src/grafica.js', 'src/db.js', 'src/historial.js', 'src/entrenamientos.js', 'src/estadisticas.js', 'src/voz.js', 'src/guion-voz.js', 'src/voz-juego.js', 'src/voces-clase.js', 'src/programa.js', 'src/fantasma.js', 'src/carrera.js', 'src/efectos.js', 'src/juego.js', 'src/ganarte.js', 'src/xp-carga.js', 'src/talentos.js', 'src/tecnica.js', 'src/coleccion-bote.js', 'src/emblemas.js', 'src/ventajas.js', 'src/intensidad.js', 'src/habilidades.js', 'src/sagas.js', 'src/maestria.js', 'src/base.js', 'src/objetos.js', 'src/consejos.js', 'src/capacidades.js', 'src/adaptacion.js', 'src/pulso.js', 'src/perfil.js', 'src/guia.js', 'src/ui.js', 'src/ajustes-guardados.js', 'src/respaldo.js', 'src/habito.js', 'src/cita.js', 'src/hitos.js', 'src/pantallas/heroe-vista.js', 'src/pantallas/progreso-vista.js', 'src/resumen.js', 'src/tarjeta.js', 'src/tarjeta-imagen.js', 'src/tarjeta-periodo.js', 'src/prediccion.js', 'src/meta-zonas.js', 'src/reloj.js', 'src/diagnostico.js', 'src/version.js', 'manifest.webmanifest', 'assets/marca/rower-logo.svg', 'assets/marca/rower-marca.svg', 'assets/marca/rower-marca-clara.svg', 'assets/marca/rower-192.png', 'assets/marca/rower-512.png', 'assets/fuentes/barlow-condensed-600.woff2', 'assets/fuentes/barlow-condensed-700.woff2'];

// Ilustraciones de los héroes (5 clases × 9 rangos, figura y retrato): ~1.7 MB. Se guardan aparte para que,
// si alguna falla, la app igual quede instalada; así los rangos que aún no has visto también salen sin conexión.
const CLASES = ['pirata', 'polinesio', 'romano', 'samurai', 'vikingo'];
const RANGOS = ['novato', 'aprendiz', 'combatiente', 'guerrero', 'veterano', 'elite', 'campeon', 'maestro', 'legendario'];
const HEROES = CLASES.flatMap((c) => RANGOS.flatMap((r) => [`assets/heroes/${c}_${r}.webp`, `assets/heroes/${c}_${r}_retrato.webp`]));
// Carrera: al instalar solo se guardan el fiordo (el paisaje gratis, el de siempre), las miniaturas de la tienda y
// los rivales. Cada paisaje comprado (~70-200 KB) se descarga al comprarlo y al abrir la app, con el mensaje
// «precargar» (ver precargarRecursos en src/pantallas/heroe.js); sin él se dibujan las formas sencillas.
const MINIATURAS = ['fiordo', 'laguna', 'canon', 'otono', 'cerezos', 'glaciar', 'mediterraneo'].map((p) => `assets/carrera/${p}_mini.webp`);
const PAISAJE = ['assets/carrera/fiordo.webp', 'assets/carrera/orilla.webp', 'assets/carrera/costa.webp',
  'assets/carrera/fiordo_suelo.webp', 'assets/carrera/fiordo_agua.webp', ...MINIATURAS,
  'assets/carrera/rival_vikingo.webp'];
// Los vídeos de la vista realista (~1,2 MB) son de una clase: no se precargan al instalar. La app los pide con un
// mensaje «precargar» cuando tu héroe es de esa clase (ver src/app.js).
const VIDEOS = { vikingo: ['assets/carrera/remo_vikingo.mp4', 'assets/carrera/remo_vikingo_v.mp4'] };

// Frases de clase grabadas (~100 KB por clase, ver src/voces-clase.js): se guardan al instalar, sin bloquearlo.
const VOCES = {
  vikingo: [1, 2, 3, 4, 5, 6].map((n) => `assets/voces/vikingo/frase-${n}.mp3`),
  romano: [1, 2, 3, 4, 5].map((n) => `assets/voces/romano/frase-${n}.mp3`),
  polinesio: [1, 2, 3, 4, 5].map((n) => `assets/voces/polinesio/frase-${n}.mp3`),
  samurai: [1, 2, 3, 4, 5, 6, 7].map((n) => `assets/voces/samurai/frase-${n}.mp3`),
  pirata: [1, 2, 3, 4, 5].map((n) => `assets/voces/pirata/frase-${n}.mp3`),
};

// Imágenes, voces y vídeos van en una caché sin versión (etapa 19): sobreviven a las actualizaciones y solo se vuelve a
// bajar lo que cambió. Lo dice huellas.json (lo genera tools/huellas.mjs): una huella del contenido de cada archivo.
// Con él, al instalar se copia de la caché lo que tiene la misma huella (también el código que no cambió) y solo se
// baja lo distinto. Sin huellas.json (sin red, o un servidor viejo) se baja todo, como antes.
const RECURSOS = 'recursos-remadora';
const HUELLAS = 'huellas.json';

// Solo se guardan respuestas completas: ni errores (404, 500), ni respuestas opacas, ni trozos de un vídeo (206).
const sePuedeGuardar = (r) => !!r && r.ok && r.status !== 206;

async function guardarEnCache(peticion, respuesta, cache = VERSION) {
  if (!sePuedeGuardar(respuesta)) return;
  const c = await caches.open(cache);
  await c.put(peticion, respuesta);
}

// Los primeros 16 hex del SHA-256 del contenido, como en tools/huellas.mjs.
async function huellaDe(r) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', await r.clone().arrayBuffer()));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function leerHuellas() {
  try {
    const r = await fetch(new Request(HUELLAS, { cache: 'reload' }));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
// «./» y «index.html» son la misma página; el resto, su ruta dentro de la app.
const BASE = new URL('./', self.location.href);
const rutaDe = (a) => new URL(a, BASE).pathname.slice(BASE.pathname.length) || 'index.html';

// Guarda «a» en la caché «destino»: si alguna caché ya lo tiene con la huella de ahora, lo copia; si no, lo baja.
async function traer(destino, a, huellas) {
  const esperada = huellas?.[rutaDe(a)];
  if (esperada) {
    const guardada = await caches.match(a);
    if (guardada && (await huellaDe(guardada)) === esperada) { await destino.put(a, guardada); return; }
  }
  const r = await fetch(new Request(a, { cache: 'reload' }));
  if (!sePuedeGuardar(r)) throw new Error(`${a}: ${r.status}`);
  await destino.put(a, r);
}
// Quita de los recursos lo que cambió o ya no existe (un paisaje comprado o un vídeo se vuelven a bajar al pedirlos).
async function limpiarRecursos(recursos, huellas) {
  for (const p of await recursos.keys()) {
    const esperada = huellas[rutaDe(p.url || p)];
    const r = await recursos.match(p);
    if (!esperada || !r || (await huellaDe(r)) !== esperada) await recursos.delete(p);
  }
}

// ¿Alguna pantalla abierta tiene una sesión en curso? Se pregunta a cada una por un canal propio; la que no contesta en
// 1,5 s (una versión anterior de la app, que no sabe contestar) cuenta como libre.
async function sesionEnCurso() {
  if (typeof self.clients.matchAll !== 'function' || typeof MessageChannel !== 'function') return false;
  const pantallas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const respuestas = pantallas.map((p) => new Promise((resolver) => {
    const canal = new MessageChannel();
    const fin = (enCurso) => { clearTimeout(tope); canal.port1.close(); resolver(enCurso); };
    const tope = setTimeout(() => fin(false), 1500);
    canal.port1.onmessage = (m) => fin(!!m.data?.enCurso);
    try { p.postMessage({ tipo: 'sesionEnCurso?' }, [canal.port2]); } catch { fin(false); }
  }));
  return (await Promise.all(respuestas)).some(Boolean);
}

// Una versión nueva no se activa a mitad de una sesión: al activarse borra la caché vieja, y la pantalla abierta (con
// el código viejo) se quedaría sin los paisajes y las imágenes que pida después. Espera a que la pantalla avise al
// terminar la sesión ({ tipo: 'activar' }), o a que se cierre la app.
// El código es todo o nada (si falta un archivo, no se instala); las imágenes y voces, cada una por su lado.
async function instalar() {
  const huellas = await leerHuellas();
  const codigo = await caches.open(VERSION);
  await Promise.all(ARCHIVOS.map((a) => traer(codigo, a, huellas)));
  const recursos = await caches.open(RECURSOS);
  if (huellas) await limpiarRecursos(recursos, huellas);
  await Promise.all([...HEROES, ...PAISAJE, ...Object.values(VOCES).flat()].map((a) => traer(recursos, a, huellas).catch(() => {})));
}
self.addEventListener('install', (e) => {
  e.waitUntil(instalar()
    .then(() => sesionEnCurso())
    .then((ocupada) => (ocupada ? undefined : self.skipWaiting())));
});

// Al activarse borra el código de las versiones anteriores; los recursos se quedan (ya se limpiaron al instalar).
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('remadora-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// { tipo: 'precargar', clase, archivos }: guarda los vídeos de esa clase y las imágenes de los paisajes que
// tienes, para verlos sin conexión. Solo se aceptan imágenes de assets/carrera/.
const IMAGEN_CARRERA = /^assets\/carrera\/[\w-]+\.webp$/;
self.addEventListener('message', (e) => {
  if (e.data?.tipo === 'activar') { e.waitUntil(self.skipWaiting()); return; }
  if (e.data?.tipo !== 'precargar') return;
  const archivos = Array.isArray(e.data.archivos) ? e.data.archivos.filter((a) => typeof a === 'string' && IMAGEN_CARRERA.test(a)) : [];
  const lista = [...new Set([...(VIDEOS[e.data.clase] || []), ...archivos])];
  e.waitUntil(caches.open(RECURSOS).then((c) => Promise.all(lista.map(async (a) => {
    if (await c.match(a)) return;
    try { await guardarEnCache(a, await fetch(a), RECURSOS); } catch { /* sin conexión: otra vez será */ }
  }))));
});

const enAssets = (url) => url.origin === self.location.origin && url.pathname.startsWith(new URL('assets/', self.registration.scope).pathname);

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Imágenes, fuentes y vídeos (assets/): caché primero y red si no están (y se guardan para la próxima).
  if (enAssets(url)) {
    e.respondWith(caches.match(e.request).then((guardada) => guardada || fetch(e.request).then((r) => {
      e.waitUntil(guardarEnCache(e.request, r.clone(), RECURSOS));
      return r;
    })));
    return;
  }
  // El código y la página salen de la caché de esta versión (etapa 19): abre al instante aunque la red sea lenta, y
  // nunca mezcla archivos de dos versiones. La versión nueva la busca la app en segundo plano (buscarVersionNueva en
  // src/app.js) y se instala para la próxima vez. Lo que no está en la caché va a la red; lo que lleva «?…» (como esa
  // consulta de la versión) no se guarda.
  const navegar = e.request.mode === 'navigate';
  e.respondWith(caches.open(VERSION)
    .then((c) => c.match(e.request, navegar ? { ignoreSearch: true } : undefined))
    .then((guardada) => guardada || fetch(e.request, { cache: 'no-cache' }).then((r) => {
      if (!url.search) e.waitUntil(guardarEnCache(e.request, r.clone()));
      return r;
    })));
});
