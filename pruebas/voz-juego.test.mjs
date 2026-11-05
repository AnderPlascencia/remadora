import assert from 'node:assert/strict';
import * as VJ from '../src/voz-juego.js';
import * as J from '../src/juego.js';
import * as XC from '../src/xp-carga.js';

// Etapa 2 de la voz: frases de clase, avisos de juego y «Atento al entrenador».

// Cada clase tiene al menos 2 frases de esfuerzo y 2 de calma, todas cortas (8 palabras como mucho).
for (const [clase, frases] of Object.entries(VJ.FRASES_CLASE)) {
  for (const m of ['esfuerzo', 'calma']) assert.ok(frases.filter(([, x]) => x === m).length >= 2, `${clase}: 2 de ${m}`);
  for (const [t] of frases) assert.ok(t.split(/\s+/).length <= 8, `${clase}: «${t}» es corta`);
}
assert.deepEqual(Object.keys(VJ.FRASES_CLASE).sort(), J.CLASES.map((c) => c.clave).sort(), 'una lista por clase');

// Sin repetir: salen todas las de un momento antes de volver a empezar; nunca una del otro momento.
{
  const usadas = new Set();
  const calma = VJ.FRASES_CLASE.samurai.filter(([, m]) => m === 'calma').map(([t]) => t);
  const dichas = calma.map(() => VJ.fraseClase('samurai', 'calma', usadas));
  assert.deepEqual([...dichas].sort(), [...calma].sort());
  assert.ok(calma.includes(VJ.fraseClase('samurai', 'calma', usadas)), 'después vuelve a empezar');
  assert.equal(VJ.fraseClase(null, 'calma'), '');
}

// Momento: calma en tipos suaves y en los descansos; esfuerzo en el trabajo.
assert.equal(VJ.momentoAnimo(true, { nombre: 'Umbral 1/3' }), 'calma');
assert.equal(VJ.momentoAnimo(false, { nombre: 'Descanso' }), 'calma');
assert.equal(VJ.momentoAnimo(false, { nombre: 'Umbral 1/3' }), 'esfuerzo');
assert.equal(VJ.momentoAnimo(false, null), 'esfuerzo');

// El juego calla en recuperación, pruebas y el trabajo de VO2; uno cada 5 minutos.
assert.equal(VJ.juegoPuede('recuperacion', { t: 900 }), false);
assert.equal(VJ.juegoPuede('prueba', { t: 900 }), false);
assert.equal(VJ.juegoPuede('vo2', { bloque: { nombre: 'VO2 2/5' }, t: 900 }), false);
assert.equal(VJ.juegoPuede('vo2', { bloque: { nombre: 'Descanso' }, t: 900 }), true);
assert.equal(VJ.juegoPuede('fondo', { t: 500, ultimo: 300 }), false);
assert.equal(VJ.juegoPuede('fondo', { t: 600, ultimo: 300 }), true);

// Al empezar: el jefe manda sobre la racha; racha desde 2 días.
assert.match(VJ.avisoInicio({ racha: 4, jefe: 'El Kraken' }), /^Hoy te enfrentas al Kraken/);
assert.equal(VJ.avisoInicio({ racha: 4 }), 'Si cumples hoy, llevas 4 días de racha');
assert.equal(VJ.avisoInicio({ racha: 1 }), '');

// Hitos en vivo: solo paladas (vikingo) y km (polinesio); cuánto falta para cada uno en esta sesión.
{
  const hz = { unidad: 'km', meta: 750, valor: 180, hecha: false };
  assert.deepEqual(VJ.hitosEnVivo(hz).map((h) => [h.pct, h.faltan]), [[25, 7500], [50, 195000], [75, 382500], [100, 570000]]);
  assert.deepEqual(VJ.hitosEnVivo({ unidad: 'paladas', meta: 75000, valor: 37000 }).map((h) => [h.pct, h.faltan]), [[50, 500], [75, 19250], [100, 38000]]);
  assert.deepEqual(VJ.hitosEnVivo({ unidad: 'fantasmas vencidos', meta: 60, valor: 1 }), []);
  assert.deepEqual(VJ.hitosEnVivo({ ...hz, hecha: true }), []);
}

// Rival a tiro: último 20 % de la carrera, entre 5 y 30 m por detrás.
assert.equal(VJ.rivalATiro({ dist: 1700, meta: 2000, dif: -12 }), 'Tu rival está a 12 metros. Lo tienes');
assert.equal(VJ.rivalATiro({ dist: 1500, meta: 2000, dif: -12 }), '');
assert.equal(VJ.rivalATiro({ dist: 1700, meta: 2000, dif: -45 }), '');
assert.equal(VJ.rivalATiro({ dist: 1700, meta: 2000, dif: 10 }), '');
assert.equal(VJ.rivalATiro({ dist: 1700, meta: 0, dif: -12 }), '');

// Resumen final: misión nueva, jefe, hito de hazaña cruzado y XP.
{
  const antes = { diarias: [{ id: 'plan', nombre: 'Fiel al plan', hecha: false }], semanales: [], hazanas: [{ id: 'clase-polinesio', nombre: 'Navegante del océano', meta: 750, valor: 180, hecha: false }] };
  const despues = {
    diarias: [{ id: 'plan', nombre: 'Fiel al plan', hecha: true }], semanales: [],
    hazanas: [{ id: 'clase-polinesio', nombre: 'Navegante del océano', meta: 750, valor: 190, hecha: false }],
    porSesion: new Map([[5, { xp: 230, xpExtra: 110, jefe: { nombre: 'La Serpiente del río' }, nivelAntes: 7, nivelDespues: 8 }]]),
  };
  assert.equal(VJ.resumenJuego(antes, despues, 5, 'polinesio'),
    'Misión cumplida: Fiel al plan. Venciste a la Serpiente del río. Navegante del océano: vas al 25 por ciento. Ganaste 340 de experiencia. Subes al nivel 8');
  assert.equal(VJ.resumenJuego(antes, { ...antes, porSesion: new Map() }, 5, 'polinesio'), '');
}

// «Atento al entrenador»: +20 XP visibles (40 nominal a la mitad) con 3 correcciones respondidas, desde el 5 de noviembre
// y nunca en pruebas.
{
  const FTP = 200;
  const ses = (k, extra = {}) => ({
    fecha: new Date(`${k}T18:00`).getTime(), duracion: 1800, distancia: 7500, ftp: FTP, wattsProm: 140, reglasXp: XC.REGLAS_XP_CARGA, entrenamiento: 'Fondo',
    muestras: Array.from({ length: 1800 }, (_, t) => ({ t: t + 1, w: 140, spm: 22, split: 120, dist: (t + 1) * 4 })), ...extra,
  });
  const linea = (s) => J.estadoJuego([s], { ftp: FTP, per: {}, ahora: s.fecha + 3600e3 }).porSesion.get(s.fecha).detalle.find(([k]) => k === 'Atento al entrenador')?.[1];
  assert.equal(linea(ses('2026-11-06', { atento: 3 })), 20);
  assert.equal(linea(ses('2026-11-06', { atento: 2 })), undefined);
  assert.equal(linea(ses('2026-11-04', { atento: 5 })), undefined, 'las sesiones de antes no cambian');
  assert.equal(linea(ses('2026-11-06', { atento: 5, tipoPlan: 'prueba' })), undefined);
  assert.equal(linea(ses('2026-11-06', { atento: 5, entrenamiento: 'Prueba 2000 m' })), undefined);
}
