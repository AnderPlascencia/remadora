import assert from 'node:assert/strict';
import * as T from '../src/talentos.js';
import * as V from '../src/ventajas.js';
import * as I from '../src/intensidad.js';

// Etapa 4 del rediseño del héroe: dos sendas por clase desde el nivel 20, y los límites del entrenador para los
// talentos de intensidad (revisión del 10 nov 2026).
const lleno = { m1: 3, m2: 3, m3: 3, m4: 3, maestria: 3 };
const xp = (clase, d) => T.xpTalentos(clase, lleno, d).reduce((a, [, v]) => a + v, 0);
const nombres = (clase, d) => T.xpTalentos(clase, lleno, d).map(([n]) => n);

// ---------- La senda en el tiempo ----------
{
  const per = { senda: { vikingo: [[100, 'b'], [300, 'a']] } };
  assert.equal(T.sendaEn({}, 'vikingo'), 'a', 'sin elegir, la senda A (los talentos de siempre)');
  assert.equal(T.sendaEn(per, 'vikingo', 50), 'a');
  assert.equal(T.sendaEn(per, 'vikingo', 200), 'b');
  assert.equal(T.sendaEn(per, 'vikingo'), 'a', 'cambiar es gratis y se puede volver');
  assert.equal(T.sendaEn(per, 'pirata'), 'a', 'cada clase guarda la suya');
  assert.equal(T.NIVEL_SENDA, T.nivelDeSlot('m3'), 'la senda se elige cuando se abre la mejora 3');
}

// ---------- Cada clase tiene dos sendas; la B solo cambia las mejoras 3, 4 y la maestría ----------
for (const clase of ['vikingo', 'pirata', 'samurai', 'polinesio', 'romano']) {
  const S = T.SENDAS[clase];
  assert.ok(S.a.nombre && S.b.nombre && S.a.lema && S.b.lema, clase);
  const a = T.talentosDe(clase, 'a');
  const b = T.talentosDe(clase, 'b');
  assert.deepEqual(a.map((t) => t.nombre), T.talentosDe(clase).map((t) => t.nombre), `${clase}: la A son los de siempre`);
  for (const slot of ['m1', 'm2']) assert.equal(b.find((t) => t.slot === slot).nombre, a.find((t) => t.slot === slot).nombre, `${clase} ${slot}: tronco común`);
  for (const slot of ['m3', 'm4', 'maestria']) {
    const tb = b.find((t) => t.slot === slot);
    assert.notEqual(tb.nombre, a.find((t) => t.slot === slot).nombre, `${clase} ${slot}: otro talento en la senda B`);
    assert.ok(tb.senda && tb.g.length === 3, `${clase} ${slot}`);
  }
}
assert.equal(T.SENDAS.vikingo.b.nombre, 'Berserker');
assert.equal(T.SENDAS.romano.b.nombre, 'Harpax');
// Los de intensidad van marcados (el entrenador los limita); los de XP no.
assert.deepEqual(['vikingo', 'polinesio', 'romano'].map((c) => T.talentosDe(c, 'b').find((t) => t.slot === 'm3').intensidad), [true, true, true]);
assert.ok(T.talentosDe('pirata', 'b').every((t) => !t.intensidad));
assert.ok(T.talentosDe('vikingo', 'a').every((t) => !t.intensidad), 'la senda A no cambia');

// ---------- XP de la senda B ----------
{
  const base = { paladas: 600, metros: 6000, min: 30, ganados: 0, rivales: 0, sinPausas: false, delPrograma: false, racha: 1, sesSemana: 1, kmSemana: 6, metaSemanaKm: 40, palada: true, mppMedia: 10, senda: 'b' };
  // Berserker: Grito de guerra con una sesión clave del plan; Hambre de batalla por fantasma en 2000 m o menos.
  assert.ok(nombres('vikingo', { ...base, clave: true }).includes('Grito de guerra'));
  assert.ok(!nombres('vikingo', base).includes('Grito de guerra'));
  assert.equal(xp('vikingo', { ...base, metros: 2000, paladas: 200, rivales: 3, ganados: 1 }), 18 + 75);
  assert.ok(!nombres('vikingo', { ...base, metros: 5000, paladas: 500, rivales: 3, ganados: 2 }).includes('Hambre de batalla'), 'solo en carreras cortas');
  assert.ok(!nombres('vikingo', { ...base, clave: true }).includes('Saga de fuerza'), 'la Saga de fuerza es de la senda A');
  // Intendente: reñidas, botín y Alta mar.
  assert.deepEqual(nombres('pirata', { ...base, rivales: 3, ganados: 1, renidas: 1 }), ['Bolsa ligera', 'Cuentas claras', 'Partes del botín']);
  assert.ok(nombres('pirata', { ...base, rivales: 3, ganados: 1, altamar: 1 }).includes('Artículos del barco'));
  // Senda de la espada: % en rango y remo parejo.
  assert.ok(nombres('samurai', { ...base, pctEnRango: 80 }).includes('Filo preciso'));
  assert.ok(!nombres('samurai', { ...base, pctEnRango: 79 }).includes('Filo preciso'));
  assert.equal(T.xpTalentos('samurai', lleno, { ...base, tecMin: 45 }).find(([n]) => n === 'Mano firme')[1], 6 * 15, 'hasta 30 min');
  assert.ok(nombres('samurai', { ...base, sinPausas: true, delPrograma: true, pctEnRango: 90 }).includes('Iaidō'));
  // Remero de carrera: todos los fantasmas en 5 km o más.
  assert.ok(nombres('polinesio', { ...base, rivales: 2, ganados: 2, metros: 5000 }).includes('Canoa ganadora'));
  assert.ok(!nombres('polinesio', { ...base, rivales: 2, ganados: 1, metros: 8000 }).includes('Canoa ganadora'));
  // Harpax: sin Triunfo (es de la senda A), con Corona naval en Alta mar.
  assert.ok(!nombres('romano', { ...base, sesSemana: 4 }).includes('Triunfo romano'));
  assert.ok(nombres('romano', { ...base, senda: 'a', sesSemana: 4 }).includes('Triunfo romano'));
  assert.ok(nombres('romano', { ...base, altamar: 1, rivales: 1, ganados: 1 }).includes('Corona naval'));
  // El tope de 150 XP vale igual.
  assert.ok(xp('pirata', { ...base, rivales: 3, ganados: 3, renidas: 3, altamar: 1 }) <= T.TOPE_TALENTOS_XP);
  // Sin senda (sesiones de antes), todo sigue como estaba.
  const { senda, ...sinSenda } = base;
  assert.equal(xp('vikingo', sinSenda), xp('vikingo', { ...base, senda: 'a' }));
}

// ---------- Carrera: la senda B no arrastra los talentos de carrera de la A ----------
const correr = (e, seg, { spm = 24, mps = 4, detras = false, desde = 0 } = {}) => {
  for (let t = desde + 1; t <= desde + seg; t++) V.avanzarVentaja(e, { t, dist: t * mps, paladas: (t * spm) / 60, spm, detras });
};
const permiso = { activa: true, maxActivaciones: null, calentado: true };
{
  // Vikingo B: sin Salida del drakkar; Furia de salida de 15 paladas, 1 m cada una en el grado 3 (15 m, el sub-tope).
  const e = V.nuevaVentaja({ clase: 'vikingo', grados: lleno, senda: 'b', intensidad: permiso });
  correr(e, 60);
  const furia = e.eventos.filter((x) => x.nombre === 'Furia de salida');
  assert.equal(furia.length, 1, 'una sola salida por carrera');
  assert.equal(furia[0].m, 15);
  assert.ok(!e.eventos.some((x) => x.nombre === 'Salida del drakkar'));
  assert.ok(e.usoIntensidad);
  // Sin calentar, la salida espera al minuto 5.
  const f = V.nuevaVentaja({ clase: 'vikingo', grados: lleno, senda: 'b', intensidad: { ...permiso, calentado: false } });
  correr(f, 299);
  assert.ok(!f.eventos.some((x) => x.nombre === 'Furia de salida'), 'nada en frío en los primeros 5 min');
  correr(f, 60, { desde: 299 });
  assert.ok(f.eventos.some((x) => x.nombre === 'Furia de salida' && x.t >= 300));
  // Con el cuerpo cargado, la furia descansa.
  const g = V.nuevaVentaja({ clase: 'vikingo', grados: lleno, senda: 'b', intensidad: { activa: false, motivo: 'cuerpo', calentado: true } });
  correr(g, 60);
  assert.ok(!g.eventos.some((x) => x.nombre === 'Furia de salida'));
  assert.ok(!g.usoIntensidad);
  // La senda A sigue igual.
  const a = V.nuevaVentaja({ clase: 'vikingo', grados: lleno });
  correr(a, 60);
  assert.ok(a.eventos.some((x) => x.nombre === 'Salida del drakkar'));
}
{
  // Romano B: Harpax hasta 3 veces, con 90 s entre una y otra; sin Boga de la liburna.
  const e = V.nuevaVentaja({ clase: 'romano', grados: lleno, senda: 'b', racha: 5, intensidad: permiso });
  assert.equal(e.talentos, 0, 'la Boga de la liburna es de la senda A');
  for (const t of [10, 50, 100, 200, 300, 400]) V.alAdelantar(e, t);
  const h = e.eventos.filter((x) => x.nombre === 'Harpax');
  assert.deepEqual(h.map((x) => x.t), [10, 100, 200]);
  assert.equal(e.intM, 15, '3 × 6 m = 18, recortado al sub-tope de 15');
  // Primeras 4 semanas: una sola activación.
  const n = V.nuevaVentaja({ clase: 'romano', grados: lleno, senda: 'b', intensidad: { ...permiso, maxActivaciones: 1 } });
  for (const t of [10, 100, 200]) V.alAdelantar(n, t);
  assert.equal(n.eventos.filter((x) => x.nombre === 'Harpax').length, 1);
  // Apagada a mitad (sesión del plan): ya no cobra.
  const p = V.nuevaVentaja({ clase: 'romano', grados: lleno, senda: 'b', intensidad: permiso });
  V.apagarIntensidad(p, 'plan');
  V.alAdelantar(p, 10);
  assert.equal(p.talentos, 0);
  // Romano A: la Boga sigue.
  assert.equal(V.nuevaVentaja({ clase: 'romano', grados: lleno, racha: 5 }).talentos, 9);
}
{
  // Polinesio B: Remontada solo en el último 10 % y yendo por detrás; sin Corriente de marea.
  const e = V.nuevaVentaja({ clase: 'polinesio', grados: lleno, senda: 'b', final: { meta: 2000 }, intensidad: permiso });
  correr(e, 449, { mps: 4 });
  assert.ok(!e.eventos.some((x) => x.nombre === 'Remontada'), 'antes del último 10 % no hay remontada');
  correr(e, 60, { mps: 4, detras: true, desde: 449 });
  const r = e.eventos.filter((x) => x.nombre === 'Remontada').reduce((a, x) => a + x.m, 0);
  assert.equal(r, 12, '200 m = 4 tramos de 50 m × 3 m');
  const larga = V.nuevaVentaja({ clase: 'polinesio', grados: lleno, senda: 'b', final: { meta: 6000 }, intensidad: permiso });
  correr(larga, 1500, { mps: 4 });
  assert.ok(!larga.eventos.some((x) => x.nombre === 'Corriente de marea'), 'la Corriente de marea es de la senda A');
  assert.ok(larga.eventos.some((x) => x.nombre === 'Lectura del oleaje'), 'el tronco común sigue');
}
{
  // Pirata B: sus talentos son de XP, así que adelantar no roba metros (Mano rápida es de la senda A).
  const e = V.nuevaVentaja({ clase: 'pirata', grados: lleno, senda: 'b', intensidad: permiso });
  V.alAdelantar(e, 10);
  assert.equal(e.talentos, 0);
  const a = V.nuevaVentaja({ clase: 'pirata', grados: lleno });
  V.alAdelantar(a, 10);
  assert.equal(a.talentos, 9);
}

// ---------- Permiso de intensidad ----------
{
  const DIA = 864e5;
  const ahora = new Date(2026, 10, 12, 18).getTime(); // jueves
  const viejas = [{ fecha: ahora - 60 * DIA, duracion: 1800, estres: 40, muestras: [] }];
  const ok = I.permisoIntensidad({ sesiones: viejas, ftp: 200, cuerpo: { clave: 'listo', horas: 0 }, ahora });
  assert.equal(ok.activa, true);
  assert.equal(ok.maxActivaciones, null);
  assert.equal(ok.calentado, false);
  assert.equal(I.permisoIntensidad({ sesiones: viejas, cuerpo: { clave: 'cargado', horas: 0 }, ahora }).motivo, 'cuerpo');
  assert.equal(I.permisoIntensidad({ sesiones: viejas, cuerpo: { clave: 'agotado', horas: 0 }, ahora }).motivo, 'cuerpo');
  assert.equal(I.permisoIntensidad({ sesiones: viejas, cuerpo: { clave: 'listo', horas: 14 }, ahora }).motivo, 'recuperacion');
  assert.equal(I.permisoIntensidad({ sesiones: viejas, prueba: true, ahora }).motivo, 'prueba');
  // Dos sesiones con intensidad esta semana: la tercera ya no.
  const semana = [...viejas, { fecha: ahora - 2 * DIA, duracion: 1800, intensidad: true }, { fecha: ahora - DIA, duracion: 1800, intensidad: true }];
  assert.equal(I.permisoIntensidad({ sesiones: semana, ahora }).motivo, 'semana');
  // La de la semana pasada no cuenta.
  assert.equal(I.permisoIntensidad({ sesiones: [...viejas, { fecha: ahora - 5 * DIA, duracion: 1800, intensidad: true }, { fecha: ahora - DIA, duracion: 1800, intensidad: true }], ahora }).activa, true);
  // Las primeras 4 semanas, una sola activación.
  assert.equal(I.permisoIntensidad({ sesiones: [{ fecha: ahora - 10 * DIA, duracion: 1800, estres: 40 }], ahora }).maxActivaciones, 1);
  // Calentado: 5 min o más remados en la última hora.
  assert.equal(I.vieneCalentado([{ fecha: ahora - 20 * 60e3, duracion: 600 }], ahora), true);
  assert.equal(I.vieneCalentado([{ fecha: ahora - 20 * 60e3, duracion: 200 }], ahora), false);
  assert.equal(I.vieneCalentado([{ fecha: ahora - 3 * 3600e3, duracion: 600 }], ahora), false);
}
