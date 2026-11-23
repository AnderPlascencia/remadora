// Etapa 13: pulso y métricas.
import assert from 'node:assert/strict';
import * as Pu from '../src/pulso.js';
import * as E from '../src/estadisticas.js';
import * as Ent from '../src/entrenamientos.js';
import * as C from '../src/capacidades.js';
import * as A from '../src/adaptacion.js';
import { AJUSTES } from '../src/ajustes-guardados.js';

// (1) Una sola zona 2: 60–70 % de la reserva de pulso. Sin pulso en reposo se supone el 30 % del máximo, así la
// zona casi no se mueve al darlo (antes saltaba de 114–133 a 138–151 lpm).
assert.deepEqual(Pu.rangoZona2(190), { min: 137, max: 150 });
assert.deepEqual(Pu.rangoZona2({ max: 190, reposo: 60 }), { min: 138, max: 151 }, 'Karvonen');
assert.ok(Pu.cambioZona2(190, { max: 190, reposo: 60 }) <= 5, 'dar el pulso en reposo típico no mueve la zona');
assert.ok(Pu.cambioZona2(190, { max: 190, reposo: 40 }) > 5, 'uno muy bajo sí, y se avisa');
// Las 5 zonas usan la misma regla: sin reposo, la zona 2 va del 72 al 79 % del máximo.
assert.equal(Math.round((100 * Pu.rangoZona2(200).min) / 200), 72);
assert.equal(Math.round((100 * Pu.rangoZona2(200).max) / 200), 79);
assert.ok(!Pu.usaReserva({ max: 190, reposo: 170 }), 'un reposo imposible no cuenta');
assert.equal(E.zonaFc(145, { max: 190, reposo: 60 }).n, 2);
assert.equal(E.zonaFc(145, 190).n, 2, 'sin reposo, la misma zona que con un reposo típico');
assert.equal(E.zonaFc(155, 190).n, 3);
// Los bloques por % de pulso usan la misma referencia, y el texto dice cuál.
const b = { metrica: 'fcpct', min: 60, max: 70 };
assert.deepEqual(Ent.rangoFc(b, { max: 190, reposo: 60 }), Pu.rangoZona2({ max: 190, reposo: 60 }));
assert.deepEqual(Ent.rangoFc(b, 190), Pu.rangoZona2(190));
assert.match(Ent.textoMeta(b, 200, { max: 190, reposo: 60 }), /reserva de pulso/);
assert.match(Ent.textoMeta(b, 200, 190), /pulso máx/);
assert.equal(Ent.normalizarBloques([b], 200, { max: 190, reposo: 60 })[0].min, 138);
// Sin pulso en reposo, el texto dice el % del máximo que de verdad es (72–79 %).
assert.match(Ent.textoMeta(b, 200, 190), /137–150 lpm \(72–79% pulso máx\)/);
// Pulso máximo por edad con Tanaka (208 − 0,7 × edad): igual a los 40, 6 lpm más a los 60 que 220 − edad.
assert.equal(Pu.fcMaxDeEdad(40), 180);
assert.equal(Pu.fcMaxDeEdad(60), 166);
assert.equal(Pu.fcMaxDeEdad(20), 194);
// Pulso máximo: el observado en vez del de la edad, y se avisa cuando es estimado.
assert.deepEqual(Pu.fcMaxEfectiva({ edad: 40 }), { fcMax: 180, fuente: 'edad', estimado: true });
assert.deepEqual(Pu.fcMaxEfectiva({ edad: 40, observada: 186 }), { fcMax: 186, fuente: 'observada', estimado: false });
assert.equal(Pu.fcMaxEfectiva({ edad: 40, observada: 150 }).fuente, 'edad', 'un 150 no es tu máximo si nunca fuiste a tope');
assert.equal(Pu.fcMaxEfectiva({ manual: 175, edad: 40, observada: 186 }).fuente, 'manual');
assert.ok(Pu.fcMaxEfectiva({ observada: 186 }).estimado, 'sin edad no se puede contrastar');
const pico = Array.from({ length: 60 }, (_, t) => ({ t, fc: t === 30 ? 220 : 170 + Math.floor(t / 10) }));
assert.equal(Pu.fcMax5s(pico), 175, 'un pico suelto no cuenta');
assert.equal(Pu.fcMaxDeHistorial([{ fcMax5: 181 }, { muestras: pico }, { fcMax: 190 }]), 188, 'sesiones antiguas: pico menos 2');
assert.ok(AJUSTES.fcReposo && AJUSTES.fcMaxFuente && AJUSTES.antesDeRemar, 'claves registradas');

// (2) estimarFtp no se infla con un 500 m; el FTP también baja.
assert.equal(E.ftpEstimadoDe([{ fecha: 1, duracion: 95, wattsProm: 400 }, { fecha: 2, duracion: 1800, wattsProm: 200 }]), 190);
assert.equal(E.ftpEstimadoDe([{ fecha: 1, duracion: 900, wattsProm: 220 }]), 198);
assert.equal(E.ftpEstimadoDe([{ fecha: 1, duracion: 120, wattsProm: 300 }]), 0);
// Con muestras: el mejor tramo de 20 min (no la media con el calentamiento) y la mediana de las 3 mejores sesiones.
const conTramo = (fecha, w20, resto = 120) => ({ fecha, duracion: 2400, wattsProm: Math.round((w20 + resto) / 2),
  muestras: Array.from({ length: 2400 }, (_, t) => ({ t, w: t >= 600 && t < 1800 ? w20 : resto })) });
assert.equal(E.ftpDeSesion(conTramo(1, 200)), 190, '95 % de 200 W en 20 min, aunque la media sea de 160');
const corta = { fecha: 1, duracion: 900, muestras: Array.from({ length: 900 }, (_, t) => ({ t, w: t < 600 ? 220 : 100 })) };
assert.equal(E.ftpDeSesion(corta), 198, 'sin 20 min, el 90 % del mejor tramo de 10 min');
assert.equal(E.ftpEstimadoDe([conTramo(1, 200), conTramo(2, 210), conTramo(3, 300), conTramo(4, 180)]), 200, 'un día de 300 W no lo infla');
assert.equal(E.ftpEstimadoDe([conTramo(1, 200), conTramo(2, 300)]), 190, 'con dos, la más baja');
const ahora = Date.parse('2026-11-04T12:00');
const DIA = 864e5;
assert.equal(E.revisarFtp([{ fecha: ahora - 50 * DIA, pruebaFtp: true, pruebaWatts: 210 }], 200, ahora).repetir, 50);
assert.equal(E.revisarFtp([{ fecha: ahora - 20 * DIA, pruebaFtp: true }], 200, ahora), null);
const dura = (d, w) => ({ fecha: ahora - d * DIA, pctEnRango: 40, pctBajo: 55, pctAlto: 5,
  bloques: [{ nombre: 'Calentamiento', duracion: 600, metrica: 'watts', min: 112, max: 140 }, { nombre: 'Umbral', duracion: 1200, metrica: 'watts', min: 190, max: 200 }],
  muestras: Array.from({ length: 1800 }, (_, t) => ({ t, w: t < 600 ? 120 : w })) });
const rf = E.revisarFtp([dura(9, 175), dura(6, 178), dura(2, 176)], 200, ahora);
assert.equal(rf.bajar.cortas, 3);
assert.equal(rf.bajar.ftp, 181, 'baja a lo que de verdad sostuviste: 176 W de 195 pedidos');
assert.equal(E.revisarFtp([dura(9, 100), dura(6, 100), dura(2, 100)], 200, ahora).bajar.ftp, 170, 'como mucho un 15 % de golpe');
assert.equal(E.revisarFtp([dura(9, 175), dura(2, 176)], 200, ahora), null, 'con dos no basta');

// (3) Desacople solo en el bloque principal estable; recuperación tras el último bloque de trabajo.
{
  const bloques = [{ nombre: 'Calentamiento', duracion: 600 }, { nombre: 'Fondo', duracion: 2700, metrica: 'watts' }, { nombre: 'Enfriamiento', duracion: 300 }];
  // Calentamiento a 100 W con pulso bajo y enfriamiento con pulso alto: si contaran, falsearían el desacople.
  const m = Array.from({ length: 3600 }, (_, t) => ({ t, w: t < 600 ? 100 : t < 3300 ? 160 : 80, fc: t < 600 ? 100 : t < 3300 ? 140 : 150 }));
  const d = E.desacopleDe(m, bloques);
  assert.equal(d.pct, 0);
  assert.equal(d.seg, 2700 - 180, 'sin los 3 primeros min del bloque');
  assert.ok(d.seg >= E.DESACOPLE_FONDO_LARGO);
  assert.equal(E.desacople(m), 0, 'en remo libre, sin los extremos ni lo que no es estable');
  // Recuperación: 170 al final del bloque y 140 un minuto después, aunque el enfriamiento siga.
  const mr = Array.from({ length: 1500 }, (_, t) => ({ t, w: 150, fc: t < 1200 ? 170 : t < 1258 ? 170 - (t - 1200) / 2 : 140 }));
  assert.equal(E.recuperacionTrasTrabajo(mr, [{ nombre: 'Series', duracion: 1200 }, { nombre: 'Enfriamiento', duracion: 300 }]), 30);
  assert.equal(E.recuperacionTrasTrabajo(mr.slice(0, 1230), [{ nombre: 'Series', duracion: 1200 }, { nombre: 'Enfriamiento', duracion: 300 }]), null, 'sin el minuto después, se mide al terminar');
  // Se compara con sesiones del mismo tipo.
  const s = (d, tipoPlan, fcRec60) => ({ fecha: ahora - d * DIA, tipoPlan, fcRec60, duracion: 1800 });
  const rc = A.recuperacionComparada([s(9, 'vo2', 40), s(8, 'fondo', 15), s(7, 'vo2', 42), s(6, 'fondo', 16), s(5, 'vo2', 38), s(1, 'fondo', 14)]);
  assert.equal(rc, null, 'solo 2 fondos antes: no se compara con las series');
  const rc2 = A.recuperacionComparada([s(10, 'fondo', 18), s(9, 'vo2', 40), s(8, 'fondo', 15), s(7, 'vo2', 42), s(6, 'fondo', 16), s(1, 'fondo', 14)]);
  assert.deepEqual([rc2.tipo, rc2.n, rc2.media], ['fondo', 3, 16]);
}

// (4) Antes de remar y RMSSD: solo empeoran el estado del cuerpo.
assert.equal(Pu.efectoPrevio({ sueno: 'bien', dolor: 'si' }).clave, 'agotado');
assert.equal(Pu.efectoPrevio({ sueno: 'mal', dolor: 'no' }).clave, 'cargado');
assert.equal(Pu.efectoPrevio({ sueno: 'regular', dolor: 'no' }), null);
assert.equal(C.estadoCuerpo([], 0, ahora, { previo: { sueno: 'mal', dolor: 'no' } }).clave, 'cargado');
{
  const rr = (base, n = 200) => Array.from({ length: n }, (_, i) => 800 + (i % 2 ? base : -base));
  const ses = (d, a) => ({ fecha: ahora - d * DIA - 3600e3, duracion: 1800, estres: 40, rr: rr(a) });
  const normal = [10, 8, 6, 4, 2].map((d) => ses(d, 20));
  const vb = E.variabilidadBaja([...normal, ses(0.2, 8)], ahora);
  assert.ok(vb.baja && vb.base > vb.hoy, JSON.stringify(vb));
  assert.ok(!E.variabilidadBaja([...normal, ses(0.2, 19)], ahora).baja);
  const cuerpo = C.estadoCuerpo([...normal, ses(0.2, 8)], 200, ahora);
  assert.ok(['cargado', 'agotado'].includes(cuerpo.clave));
  assert.match(cuerpo.motivos[0], /variabilidad/);
  assert.ok(C.estadoCuerpo([...normal, ses(0.2, 20)], 200, ahora).motivos.length === 0);
}

// (5) Índice de VO₂ y (6) kJ → kcal, bandas con split, prueba FTP con activación y reparto.
assert.equal(C.CAPACIDADES.find((c) => c.clave === 'vo2').nombre, 'Índice de VO₂');
assert.equal(E.kcalDeKj(500), 600);
{
  const bandas = E.bandasRemo(200);
  assert.deepEqual(bandas.map((x) => x.clave), ['UT2', 'UT1', 'AT', 'TR', 'AN']);
  for (let i = 1; i < bandas.length; i++) assert.equal(bandas[i].min, bandas[i - 1].max + 1, 'sin huecos');
  assert.ok(bandas.every((x) => x.splitRapido < x.splitLento), 'split rápido con más watts');
  assert.ok(bandas[0].splitLento > bandas.at(-1).splitRapido);
  assert.equal(E.bandasRemo(0)[0].wMin, undefined);
}
for (const ent of [Ent.PRUEBAS['Prueba FTP 20 min'], Ent.EJEMPLOS.find((e) => e.nombre === 'Prueba FTP 20 min')]) {
  assert.ok(ent.bloques.some((x) => /arranque progresivo/.test(x.nombre)), 'activación antes de la prueba');
  const p = ent.bloques.find((x) => x.prueba);
  assert.equal(p.duracion, 1200);
  assert.match(p.consejo, /5 primeros minutos.*3 últimos/);
}
console.log('pulso OK');

// Sin edad ni pulso máximo, un bloque de pulso se rema en watts (zona 2 ≈ 56–75 % del FTP); con pulso, en lpm.
{
  const { normalizarBloques, pctFtpDeFcpct } = await import('../src/entrenamientos.js');
  assert.equal(pctFtpDeFcpct(60), 56);
  assert.equal(pctFtpDeFcpct(70), 75);
  assert.equal(pctFtpDeFcpct(65), 66);
  const [w] = normalizarBloques([{ nombre: 'Fondo', duracion: 1500, metrica: 'fcpct', min: 60, max: 70 }], 150, 0);
  assert.deepEqual([w.metrica, w.min, w.max], ['watts', 84, 113]);
  const [fc] = normalizarBloques([{ nombre: 'Fondo', duracion: 1500, metrica: 'fcpct', min: 60, max: 70 }], 150, 185);
  assert.equal(fc.metrica, 'fc');
  const [libre] = normalizarBloques([{ nombre: 'Fondo', duracion: 1500, metrica: 'fcpct', min: 60, max: 70 }], 0, 0);
  assert.equal(libre.metrica, '');
}
