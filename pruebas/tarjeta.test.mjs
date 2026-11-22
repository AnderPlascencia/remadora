// La imagen compartida (etapa 15): dato protagonista, línea honesta y lo que se enseña por defecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Tj from '../src/tarjeta.js';

const muestras = (n, w = 150) => Array.from({ length: n }, (_, t) => ({ t, w: t >= 100 && t < 160 ? 260 : w, spm: 24, split: 120, dist: t * 4, fc: 140 }));
const base = { fecha: new Date('2026-11-18T19:00').getTime(), distancia: 6200, duracion: 1500, splitProm: 121, wattsProm: 160, spmProm: 24, fcProm: 142, kcal: 310, muestras: muestras(1500) };

test('formatos y lo que sale por defecto: pulso y calorías apagados, héroe encendido', () => {
  assert.deepEqual(Tj.FORMATOS['9:16'], [1080, 1920]);
  assert.deepEqual(Tj.FORMATOS['4:5'], [1080, 1350]);
  assert.deepEqual(Tj.FORMATOS['1:1'], [1080, 1080]);
  assert.equal(Tj.OPCIONES_DEFECTO.pulso, false);
  assert.equal(Tj.OPCIONES_DEFECTO.kcal, false);
  const heroe = { nombre: 'Ander', linea: 'Jarl · nivel 12', src: 'h.webp', xp: 120 };
  const c = Tj.contenidoTarjeta(base, {}, { heroe });
  const etqs = c.secundarios.map(([, , e]) => e);
  assert.ok(!etqs.includes('Pulso prom') && !etqs.includes('kcal estimadas'));
  assert.deepEqual(c.heroe, heroe);
  const todo = Tj.contenidoTarjeta(base, { pulso: true, kcal: true, heroe: false }, { heroe });
  assert.deepEqual(todo.secundarios.slice(-1), [['142', 'lpm', 'Pulso prom']], 'como mucho 4 datos abajo');
  assert.equal(todo.heroe, null);
  assert.deepEqual(Tj.contenidoTarjeta(base, { kcal: true }).secundarios.at(-1), ['310', 'kcal', 'kcal estimadas'], 'siempre «estimadas»');
});

test('línea honesta: completado, a medias, versión corta o nada en remo libre', () => {
  assert.equal(Tj.estadoSesion(base), null, 'remo libre');
  const plan = { ...base, entrenamiento: 'Fondo 25', bloques: [{ duracion: 1500 }] };
  assert.deepEqual(Tj.estadoSesion({ ...plan, tiempoMeta: 1500 }), { texto: '✓ Completado', completo: true });
  assert.deepEqual(Tj.estadoSesion({ ...plan, duracion: 120, bloques: [{ duracion: 120 }, { duracion: 1380 }] }), { texto: '2 de 25 min', completo: false });
  assert.equal(Tj.estadoSesion({ ...plan, tiempoMeta: 900, versionCorta: 15 }).texto, '✓ Versión corta de 15 min');
  assert.equal(Tj.estadoSesion({ ...plan, duracion: 600, versionCorta: 15 }).texto, '10 de 15 min · versión corta');
  assert.equal(Tj.estadoSesion({ ...plan, bloques: null }).texto, 'Sin terminar');
});

test('intensidad en palabras: por FTP, por el esfuerzo marcado o nada', () => {
  const parejo = (w, n = 1200) => ({ ...base, muestras: Array.from({ length: n }, (_, t) => ({ t, w, dist: t * 4 })) });
  assert.deepEqual(Tj.intensidad(parejo(140), 200), { nivel: 1, palabra: 'Suave' });
  assert.equal(Tj.intensidad(parejo(165), 200).palabra, 'Firme');
  assert.equal(Tj.intensidad(parejo(190), 200).palabra, 'Fuerte');
  assert.equal(Tj.intensidad(parejo(215), 200).palabra, 'Muy fuerte');
  assert.equal(Tj.intensidad(parejo(250), 200).palabra, 'A tope');
  assert.equal(Tj.intensidad({ ...parejo(150), rpe: 9 }, 0).palabra, 'A tope', 'sin FTP, el esfuerzo que marcó');
  assert.equal(Tj.intensidad(parejo(150), 0), null, 'sin ninguno, no se pone');
  assert.equal(Tj.intensidad({ ...base, tipoPlan: 'prueba', entrenamiento: 'Prueba 2000 m', tiempoMeta: 450 }, 200).palabra, 'A tope');
});

test('prueba de 2000 m: récord con la marca de antes, diferencia y meta del plan', () => {
  const k2 = { ...base, entrenamiento: 'Prueba 2000 m', tipoPlan: 'prueba', distancia: 2000, duracion: 462, tiempoMeta: 462 };
  const r2k = [{ clave: 't2000', nombre: 'Mejor 2000 m', tipo: 'tiempo', valor: 462, anterior: 468 }, { clave: 'wmax', nombre: 'Potencia máxima', tipo: 'valor', unidad: 'W', valor: 400, anterior: 380 }];
  const c = Tj.contenidoTarjeta(k2, {}, { records: r2k, meta: { distancia: 2000, segundos: 460 } });
  assert.equal(c.tipo, 'prueba');
  assert.deepEqual([c.protagonista.kicker, c.protagonista.valor, c.protagonista.antes, c.protagonista.delta], ['RÉCORD PERSONAL', '7:42', '7:48', '−6 s']);
  assert.equal(c.contexto, '6 s menos que su mejor marca · a 2 s de su meta de 7:40');
  assert.deepEqual(c.secundarios.map(([, , e]) => e), ['Split promedio', 'Watts promedio'], 'no repite el tiempo');
  assert.equal(c.intensidad.palabra, 'A tope');
  assert.equal(c.grafica, null, 'en la prueba van los parciales');
  const primera = Tj.contenidoTarjeta(k2, {}, { records: [{ ...r2k[0], anterior: null }] });
  assert.equal(primera.protagonista.kicker, 'PRIMERA MARCA');
  assert.equal(primera.protagonista.antes, null);
  const sinRecord = Tj.contenidoTarjeta(k2, {}, { marcas: { t2000: { valor: 455 } } });
  assert.equal(sinRecord.contexto, 'a 7 s de su mejor marca');
});

test('intervalos: % en rango, series dentro y bandas del rango en la gráfica', () => {
  const bloques = [{ nombre: 'Calentamiento', duracion: 100 }, ...Array.from({ length: 3 }, () => [{ nombre: 'Umbral', duracion: 60, metrica: 'watts', min: 240, max: 280 }, { nombre: 'Descanso', duracion: 60 }]).flat()];
  const m = Array.from({ length: 461 }, (_, t) => ({ t, w: t > 100 && (t - 100) % 120 <= 60 ? 260 : 120, spm: 24, dist: t * 4 }));
  const int = { ...base, entrenamiento: '3 × 1 min', bloques, muestras: m, duracion: 460, pctEnRango: 84, tiempoMeta: 460 };
  const c = Tj.contenidoTarjeta(int, {}, { ftp: 250 });
  assert.equal(c.tipo, 'intervalos');
  assert.deepEqual([c.protagonista.valor, c.protagonista.unidad, c.protagonista.etq], ['84', '%', 'del tiempo en el ritmo exacto del plan']);
  assert.match(c.contexto, /^3 series de 1 min · \d de 3 dentro de su rango$/);
  assert.equal(c.secundarios[0][2], 'Mejor serie');
  assert.equal(c.grafica.rango.tramos.length, 3);
});

test('remo libre: la distancia y la cascada de lo que sea cierto, sin «tú»', () => {
  const libre = (d, fecha = base.fecha) => ({ ...base, fecha, distancia: d, duracion: 2400, muestras: muestras(2400, 110) });
  const c = Tj.contenidoTarjeta(libre(8150), {}, { ftp: 210 });
  assert.equal(c.tipo, 'fondo');
  assert.deepEqual([c.protagonista.valor, c.protagonista.unidad], ['8.15', 'km']);
  assert.equal(c.titulo, 'Remo libre');
  assert.equal(c.contexto, '40 min continuos a ritmo de fondo', 'sin 3 sesiones del mes no presume');
  const previas = [5000, 6000, 7000].map((d, i) => libre(d, base.fecha - (i + 1) * 864e5));
  assert.equal(Tj.contenidoTarjeta(libre(8150), {}, { previas }).contexto, '40 min continuos · su remo libre más largo del mes');
  const rec = [{ clave: 't5000', nombre: 'Mejor 5000 m', tipo: 'tiempo', valor: 1180, anterior: 1200 }];
  assert.equal(Tj.contenidoTarjeta(libre(8150), {}, { records: rec }).contexto, '40 min continuos · su mejor 5000 m: 19:40');
  assert.equal(Tj.contenidoTarjeta({ ...libre(800), duracion: 200 }).contexto, '', 'menos de 5 min: sin contexto');
  for (const x of [c, Tj.contenidoTarjeta(libre(8150), {}, { previas })]) assert.doesNotMatch(x.contexto, /\b(tu|tú|te|ti)\b/i);
});

test('sin terminar: minutos remados en blanco, cuánto faltaba y sin podio', () => {
  const corto = { ...base, entrenamiento: 'Fondo 25 min', tipoPlan: 'fondo', duracion: 1080, bloques: [{ duracion: 1500 }], muestras: muestras(1080, 118) };
  const c = Tj.contenidoTarjeta(corto, {}, { ftp: 210, rivales: [{ nombre: 'Kaito', diferencia: -18 }] });
  assert.equal(c.tipo, 'cortada');
  assert.deepEqual([c.protagonista.valor, c.protagonista.unidad, c.protagonista.de, c.protagonista.blanco], ['18', 'min', 'remados', true]);
  assert.equal(c.protagonista.parcial, 18 / 25);
  assert.equal(c.estado.texto, '18 de 25 min');
  assert.equal(c.contexto, '18 min de fondo a ritmo de conversación');
  assert.equal(c.grafica.resto, 'plan: 25 min');
  assert.equal(c.podio, null);
});

test('prueba de FTP: el nuevo con el anterior tachado', () => {
  const ftp = { ...base, entrenamiento: 'Prueba FTP 20 min', pruebaWatts: 232, ftp: 210, tiempoMeta: 1500 };
  const c = Tj.contenidoTarjeta(ftp);
  assert.deepEqual([c.protagonista.valor, c.protagonista.antes, c.protagonista.delta, c.protagonista.kicker], ['220', '210', '+5 %', 'NUEVO FTP']);
  assert.match(c.contexto, /^Su ritmo máximo para una hora subió 5 %/);
});

test('podio en tercera persona', () => {
  const p = Tj.podioDe([{ nombre: 'Kaito', diferencia: -18 }, { nombre: 'Fantasma Haakon el Rojo (nivel 3)', diferencia: 42 }], 'Ander');
  assert.equal(p.texto, '2.º de 3 · a 18 m de Kaito · 42 m delante de Haakon el Rojo');
  assert.deepEqual(p.filas, [['1', 'Kaito', '18 m delante', false], ['2', 'Ander', '', true], ['3', 'Haakon el Rojo', '42 m detrás', false]]);
  assert.equal(Tj.podioDe([]), null);
});

test('semana del plan: «Semana 2 de 3 · sesión 2 de 3»', () => {
  const dias = ['2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23'].map((fecha) => ({ fecha, ent: 'Fondo' }));
  assert.equal(Tj.semanaDelPlan({ dias }, base.fecha), 'Semana 2 de 3 · sesión 2 de 3');
  assert.equal(Tj.semanaDelPlan({ dias }, new Date('2026-12-20T12:00').getTime()), null, 'fuera del plan');
  assert.equal(Tj.semanaDelPlan(null, base.fecha), null);
});

test('equivalencia: tus metros comparados con distancias conocidas', () => {
  const e = (d) => Tj.equivalencia({ distancia: d })?.texto;
  assert.equal(e(2000), 'La misma distancia que una carrera olímpica de remo');
  assert.equal(e(8150), 'Como cruzar el puente Golden Gate 3 veces', 'una cuenta redonda antes que «más de»');
  assert.equal(e(5000), 'Como remar una carrera olímpica 2 veces y media');
  assert.equal(e(4300), 'Como remar una carrera olímpica más de 2 veces');
  assert.equal(e(1000), 'La mitad de una carrera olímpica de remo');
  assert.equal(e(500), 'Como recorrer 5 campos de fútbol profesional');
  assert.equal(Tj.equivalencia({ distancia: 8150 }).detalle, 'Remaste 8.2 km · el puente Golden Gate mide 2.7 km');
  assert.equal(e(50), undefined);
  assert.equal(Tj.contenidoTarjeta({ distancia: 2000, duracion: 462 }).equivalencia, undefined, 'no va en la tarjeta de la sesión');
});

test('VO₂ y técnica: minutos muy fuertes y metros por palada', () => {
  const bloques = Array.from({ length: 8 }, () => [{ nombre: 'VO2', duracion: 120 }, { nombre: 'Descanso', duracion: 120 }]).flat();
  const m = Array.from({ length: 1921 }, (_, t) => ({ t, w: t % 240 < 120 ? 240 : 100, spm: 28, dist: t * 4 }));
  const vo2 = { ...base, entrenamiento: '8 × 2 min VO₂', tipoPlan: 'vo2', bloques, muestras: m, duracion: 1920, pctEnRango: 80, tiempoMeta: 1920 };
  const c = Tj.contenidoTarjeta(vo2, {}, { ftp: 200 });
  assert.equal(c.tipo, 'vo2');
  assert.deepEqual([c.protagonista.valor, c.protagonista.unidad, c.protagonista.de], ['16', 'min', 'muy fuertes']);
  assert.equal(c.contexto, '8 series de 2 min · la dosis que hace crecer los pulmones');
  const tec = { ...base, entrenamiento: 'Técnica: palada larga', tipoPlan: 'tecnica', distancia: 3000, duracion: 600, spmProm: 20, tiempoMeta: 600 };
  const t = Tj.contenidoTarjeta(tec);
  assert.equal(t.tipo, 'tecnica');
  assert.deepEqual([t.protagonista.valor, t.protagonista.de], ['15.0', 'por palada']);
  assert.equal(t.secundarios[1][0], '200', 'paladas totales');
});
