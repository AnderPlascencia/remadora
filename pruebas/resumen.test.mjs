// Etapa 23: el resumen guardado con cada sesión (s.res) da exactamente lo mismo que sus muestras. ⚖ Si esto falla,
// el héroe, los récords o la carga cambiarían al leer el historial sin muestras: XP, nivel y monedas no deben moverse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resumir, RESUMEN_V, resumenAlDia } from '../src/resumen.js';
import { RESUMEN_V as RESUMEN_V_HISTORIAL } from '../src/historial.js';
import * as E from '../src/estadisticas.js';
import * as J from '../src/juego.js';
import { tipoSesion } from '../src/capacidades.js';
import { tecnicaDeSesion } from '../src/tecnica.js';
import { fcMax5De, fcMaxDeHistorial } from '../src/pulso.js';
import * as P from '../src/programa.js';
import * as Pr from '../src/prediccion.js';
import { recuperacionComparada } from '../src/adaptacion.js';
import * as Tp from '../src/tarjeta-periodo.js';
import * as Cap from '../src/capacidades.js';
import * as Tj from '../src/tarjeta.js';
import * as Hab from '../src/habito.js';
import { RESPALDOS_VIEJOS } from './datos/respaldos-viejos.mjs';

const DIA = 864e5;
const INICIO = new Date('2026-07-06T19:00').getTime();
const AHORA = new Date('2027-01-20T12:00').getTime();

// Pseudoazar determinista.
function azar(semilla) {
  let x = semilla >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 2 ** 32; };
}

// Sesiones variadas: fondos, series con bloques (vatios, cadencia, FTP), sprints, pulso con caídas en los descansos,
// pausas, huecos de tiempo, paladas a 0, fantasmas y alguna sin muestras.
function historial(n = 90) {
  const r = azar(23);
  const out = [];
  for (let i = 0; i < n; i++) {
    const fecha = INICIO + i * 2 * DIA + Math.floor(r() * 5) * 3600e3;
    if (i % 17 === 9) { out.push({ fecha, duracion: 1800, distancia: 6000, wattsProm: 130, rpe: 6, entrenamiento: null }); continue; }
    const ftp = i % 5 === 0 ? 0 : 150 + (i % 4) * 10;
    const tipo = i % 4;
    const bloques = tipo === 1 ? [
      { duracion: 300, metrica: 'ftp', min: 55, max: 70 },
      ...Array.from({ length: 4 }, () => [{ duracion: 240, metrica: 'watts', min: 180, max: 200 }, { duracion: 90 }]).flat(),
      { duracion: 120, metrica: 'spm', min: 20, max: 22 },
    ] : tipo === 2 ? [{ duracion: 600, metrica: 'ftp', min: 60, max: 75, spmMeta: [20, 24] }, { duracion: 60 }, { duracion: 900, metrica: 'ftp', min: 80, max: 90 }] : null;
    const dur = bloques ? bloques.reduce((a, b) => a + b.duracion, 0) : 400 + Math.floor(r() * 2600);
    const muestras = [];
    let t = 0;
    let dist = 0;
    const base = 110 + Math.floor(r() * 80);
    for (let k = 0; k < dur; k++) {
      t += i % 7 === 3 && k === 500 ? 8 : 1; // un hueco de 8 s en algunas
      const enBloque = (() => { if (!bloques) return null; let a = 0; for (const b of bloques) { if (k < a + b.duracion) return b; a += b.duracion; } return null; })();
      let w = enBloque?.metrica === 'watts' ? 185 + Math.round(r() * 30 - 15) : enBloque && !enBloque.metrica ? 60 : base + Math.round(25 * Math.sin(k / (10 + i)) + r() * 10);
      if (tipo === 3 && k % 120 < 15) w = 380 + Math.floor(r() * 80);
      if (k > 30 && r() < 0.01) w = 0;
      const spm = w > 0 ? 18 + Math.floor(r() * 9) : 0;
      dist += w > 0 ? Math.cbrt(w / 2.8) : 0;
      const fc = i % 3 === 0 ? 0 : Math.round(110 + (w / 4) + (enBloque && !enBloque.metrica ? -25 * Math.min(1, (k % 400) / 60) : 0) + r() * 3);
      muestras.push({ t, w, spm, split: w > 0 ? Math.round(500 / Math.cbrt(w / 2.8)) : 0, dist: Math.round(dist), nivel: 5, ...(fc ? { fc } : {}) });
    }
    const s = {
      id: i + 1, fecha, duracion: t, distancia: Math.round(dist), muestras, ftp: ftp || undefined, bloques,
      wattsProm: Math.round(muestras.reduce((a, x) => a + x.w, 0) / muestras.length), wattsMax: Math.max(...muestras.map((x) => x.w)),
      kcal: Math.round(t * 0.2), paladas: Math.round(t * 0.37), entrenamiento: bloques ? ['', 'Umbral 4×4', 'Fondo técnico'][tipo] : i % 9 === 4 ? 'Prueba 2000 m' : null,
      tiempoMeta: bloques || i % 9 === 4 ? t : null, pctEnRango: bloques ? 40 + (i % 50) : null, pctBajo: bloques ? 30 : undefined, delPrograma: i % 2 === 0,
      pausas: i % 6 === 1 ? [{ t: 200, ini: fecha + 200e3, fin: fecha + 200e3 + (i % 12 === 1 ? 9000 : 3000) }] : [],
      rpe: i % 4 === 2 ? 7 : null, fcProm: i % 3 === 0 ? null : 140,
      rivales: i % 3 === 1 ? [{ nombre: 'Fantasma', diferencia: (i % 5) * 20 - 30, clase: ['vikingo', 'pirata', 'samurai'][i % 3], dificultad: i % 2 ? 'altamar' : 'costa' }] : undefined,
    };
    if (!s.ftp) delete s.ftp;
    if (!s.bloques) delete s.bloques;
    out.push(s);
  }
  return out;
}

const sinM = ({ muestras, ...s }) => ({ ...s, res: resumir({ ...s, muestras }) });
const todas = [...historial(), ...Object.values(RESPALDOS_VIEJOS).flatMap((f) => f().sesiones).filter((s) => Array.isArray(s.muestras))
  .map((s, i) => ({ ...s, id: 1000 + i }))];
const ligeras = todas.map(sinM);

test('el resumen se marca con su versión y una sesión sin muestras queda resumida', () => {
  assert.equal(RESUMEN_V_HISTORIAL, RESUMEN_V, 'historial.js y resumen.js usan la misma versión');
  assert.ok(ligeras.every(resumenAlDia));
  assert.deepEqual(resumir({ fecha: 1 }), { v: RESUMEN_V, n: 0 });
  assert.ok(ligeras.every((s) => JSON.stringify(s.res).length < 12000), 'el resumen ocupa poco');
});

test('por sesión: récords, potencias, carga, zonas, técnica, pausas y pulso dan lo mismo', () => {
  for (let i = 0; i < todas.length; i++) {
    const s = todas[i];
    const l = ligeras[i];
    const ctx = `sesión ${s.id}`;
    for (const r of E.RECORDS) assert.equal(r.calc(l), r.calc(s), `${ctx} ${r.clave}`);
    assert.deepEqual(E.marcasDeSesion(l), E.marcasDeSesion(s), ctx);
    assert.deepEqual(E.curvaDe(l), E.curvaPotencia(s.muestras), ctx);
    assert.deepEqual(E.maximosDe(l), E.esfuerzosMaximos(s.muestras), ctx);
    assert.equal(E.wattsFiables(l), E.wattsFiables(s), ctx);
    assert.equal(E.ftpDeSesion(l), E.ftpDeSesion(s), ctx);
    assert.equal(fcMax5De(l), fcMax5De(s), ctx);
    assert.equal(J.sinPausas(l), J.sinPausas(s), ctx);
    assert.equal(J.recuperacionesFc(l), J.recuperacionesFc(s), ctx);
    assert.equal(E.ftpSugerido(l), E.ftpSugerido(s), ctx);
    // El calentamiento que mira «hoy vas más cargado»: el de las sesiones con pulso.
    if (s.muestras?.length) assert.deepEqual(l.res.cal, s.muestras.some((x) => x.fc) ? s.muestras.slice(240, 301) : null, ctx);
    for (const ftp of [0, 140, 163, 200]) {
      const c = `${ctx} ftp ${ftp}`;
      assert.equal(E.estres(l, ftp), E.estres(s, ftp), c);
      assert.deepEqual(E.cargaDe(l, ftp), E.cargaDe(s, ftp), c);
      assert.equal(E.factorIntensidadDe(l, ftp), E.factorIntensidad(s.muestras, ftp), c);
      assert.equal(E.esDuraPorPotencia(l, ftp), E.esDuraPorPotencia(s, ftp), c);
      assert.equal(tipoSesion(l, ftp), tipoSesion(s, ftp), c);
      assert.deepEqual(tecnicaDeSesion(l, ftp), tecnicaDeSesion(s, ftp), c);
      assert.deepEqual(J.medidas(l, ftp), J.medidas(s, ftp), c);
    }
  }
});

test('con todo el historial: estado del juego (XP, nivel, monedas, misiones), récords y carga dan lo mismo', () => {
  for (const per of [{}, { clase: 'vikingo' }, { clase: 'samurai' }, { clase: 'romano' }]) {
    for (const ftp of [0, 165]) {
      const a = J.estadoJuego(todas, { ftp, per, ahora: AHORA, calendario: {}, metaSemanaKm: 20 });
      const b = J.estadoJuego(ligeras, { ftp, per, ahora: AHORA, calendario: {}, metaSemanaKm: 20 });
      assert.deepEqual(b, a, `${per.clase || 'sin clase'} ftp ${ftp}`);
    }
  }
  assert.deepEqual(E.calcularRecords(ligeras), E.calcularRecords(todas));
  assert.deepEqual(E.curvaHistorial(ligeras), E.curvaHistorial(todas));
  assert.deepEqual(E.curvaMaximos(ligeras), E.curvaMaximos(todas));
  assert.equal(fcMaxDeHistorial(ligeras), fcMaxDeHistorial(todas));
  for (const ftp of [0, 165]) {
    assert.deepEqual(E.forma(ligeras, ftp, 60, AHORA), E.forma(todas, ftp, 60, AHORA));
    assert.deepEqual(E.distribucionIntensidad(ligeras, ftp, 400, AHORA), E.distribucionIntensidad(todas, ftp, 400, AHORA));
    assert.equal(E.diasDeHistorial(ligeras, AHORA), E.diasDeHistorial(todas, AHORA));
  }
  const ahora = todas.at(-1).fecha + DIA;
  for (const d of [500, 1000, 2000, 5000, 6000, 10000, 21097]) assert.deepEqual(E.estimar(ligeras, d, { ahora }), E.estimar(todas, d, { ahora }), `${d} m`);
  assert.deepEqual(E.perfilDe(ligeras, { ahora }), E.perfilDe(todas, { ahora }));
  for (const d of [500, 1000, 2000, 5000, 6000, 10000]) assert.deepEqual(P.sugerirMeta(ligeras, d, 8, ahora), P.sugerirMeta(todas, d, 8, ahora), `meta ${d} m`);
  // Revisar el FTP mira la media de vatios de los bloques duros de las sesiones que se quedaron cortas.
  let revisadas = 0;
  for (let k = 20; k < todas.length - 10; k += 3) {
    const ah = todas[k].fecha + DIA;
    const a = E.revisarFtp(todas, 165, ah);
    if (a?.bajar) revisadas++;
    assert.deepEqual(E.revisarFtp(ligeras, 165, ah), a, `revisar FTP ${k}`);
    assert.deepEqual(Pr.marcasATope(todas[k], ligeras.slice(0, k)), Pr.marcasATope(todas[k], todas.slice(0, k)));
    const rc = (l) => { const r = recuperacionComparada(l.slice(0, k).map((s, j) => ({ ...s, fcRec60: j })), 165); return r && { ...r, ultima: r.ultima.id }; };
    assert.deepEqual(rc(ligeras), rc(todas));
  }
  assert.ok(revisadas > 0, 'alguna revisión propone bajar el FTP');
  for (const periodo of ['semana', 'mes']) {
    const inicio = E.inicioPeriodo(todas[40].fecha, periodo);
    assert.deepEqual(Tp.contenidoPeriodo(ligeras, periodo, inicio, { kcal: true }, { ftp: 165 }), Tp.contenidoPeriodo(todas, periodo, inicio, { kcal: true }, { ftp: 165 }), periodo);
  }
});

// Progreso y el resumen al terminar también leen la lista sin muestras: todo lo que pintan debe dar lo mismo.
test('Progreso y el resumen de la sesión: capacidades, curvas, constancia, insignias y tarjeta dan lo mismo', () => {
  const opc = { ftp: 165, peso: 75, fcMax: 190, ahora: AHORA };
  assert.ok(Cap.capacidades(todas, opc).find((c) => c.clave === 'base').valor > 0, 'hay watts a 150 lpm que comparar');
  const fallos = [];
  const igual = (f, txt) => { try { assert.deepEqual(f(ligeras), f(todas), txt); } catch (e) { fallos.push(txt); } };
  igual((l) => Cap.capacidades(l, opc), 'capacidades');
  igual((l) => Cap.historialCapacidades(l, opc), 'historial de capacidades');
  igual((l) => Cap.estadoCuerpo(l, 165, AHORA), 'estado del cuerpo');
  igual((l) => Cap.curvasComparadas(l, AHORA), 'curvas comparadas');
  igual((l) => Cap.motorSemanal(l, 150, 8, AHORA), 'motor');
  igual((l) => Cap.gastoSemanal(l, 8, AHORA), 'gasto');
  igual((l) => E.potenciaCriticaMax(l.filter((s) => s.fecha > AHORA - 400 * DIA), { peso: 75 }), 'potencia crítica');
  // Las predicciones se guardan con cada sesión al terminarla; el resumen solo las lee.
  const conPred = Pr.backtest(todas);
  assert.deepEqual(E.resumenPredicciones(conPred.map(sinM)), E.resumenPredicciones(conPred), 'predicciones');
  for (const periodo of ['semana', 'mes']) igual((l) => E.resumenPeriodos(l, periodo, 8, AHORA), periodo);
  igual((l) => E.rachaSemanas(l, AHORA), 'racha');
  igual((l) => E.ratioCarga(l, 165, AHORA), 'ratio de carga');
  igual((l) => E.insignias(l), 'insignias');
  igual((l) => E.ftpEstimadoDe(l), 'FTP estimado');
  igual((l) => E.factorSrpe(l, 165), 'factor sRPE');
  igual((l) => Hab.resumenHabito({ sesiones: l, eventos: [], programa: null, ftp: 165, ahora: AHORA }), 'constancia');
  // Al terminar: la sesión nueva trae sus muestras y las anteriores van sin ellas.
  for (let k = 30; k < todas.length; k += 7) {
    const s = todas[k];
    const antes = (l) => l.slice(0, k);
    igual((l) => E.nuevosRecords(s, antes(l)), `récords ${k}`);
    igual((l) => E.compararConAnterior(s, antes(l)), `anterior ${k}`);
    igual((l) => Pr.registrarPredicciones(s, antes(l)), `predicciones ${k}`);
    const ctx = (l) => ({ ftp: 165, records: E.nuevosRecords(s, antes(l)), marcas: E.calcularRecords(antes(l)), previas: antes(l) });
    igual((l) => Tj.contenidoTarjeta(s, {}, ctx(l)), `tarjeta ${k}`);
  }
  assert.deepEqual(fallos, []);
});

test('600 sesiones: la lista sin muestras pesa una fracción', () => {
  const muchas = [];
  for (let k = 0; k < 600; k++) {
    const b = todas[k % 90];
    muchas.push({ ...b, id: k + 1, fecha: b.fecha + k * DIA });
  }
  const pesa = (l) => JSON.stringify(l).length;
  const completa = pesa(muchas);
  const ligera = pesa(muchas.map(sinM));
  // Unos 2,4 millones de muestras como objetos (~200 MB en memoria) frente a un resumen por sesión.
  assert.ok(ligera * 12 < completa, `${Math.round(ligera / 1e6)} MB frente a ${Math.round(completa / 1e6)} MB en JSON`);
});
