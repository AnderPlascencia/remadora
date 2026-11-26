// Planes que respetan la fatiga: tope de carga semanal, sesiones duras en split, calentamiento mínimo y metas
// realistas en el asistente.
import assert from 'node:assert/strict';
import * as P from '../src/programa.js';
import * as Ent from '../src/entrenamientos.js';
import { tipoPlan, splitMetaDe } from '../src/capacidades.js';

// ---------- Tope de subida por carga (esfuerzo planificado, como el TSS) ----------
// Para cada plan: ninguna semana pasa de 1,15 × la última semana normal (sin descarga ni prueba), la vuelta de una
// descarga como mucho +5 % y el ratio agudo:crónico simulado (esta semana / media de las 4 últimas) nunca pasa de 1,3.
// El esfuerzo de cada sesión va redondeado: se deja medio punto por sesión de margen.
// Excepción: «Subir mi FTP» para quien empieza, al pasar de la base al plan, ya tiene sus dos sesiones duras en el
// mínimo (2 × 8 min de umbral y 2 × 12 de sweet spot): ahí el salto llega a 1,35, con el ratio igualmente ≤ 1,3.
const antes = new Date('2025-12-01').getTime();
let planes = 0;
for (const o of P.OBJETIVOS_PLAN) for (const nivel of ['inicio', 'medio', 'alto']) for (const dias of [2, 3, 4, 5]) {
  for (const semanas of [4, 6, 8, 12]) for (const minutosMax of [0, 45]) {
    const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: o.clave, nivel, dias, semanas, inicio: '2026-01-05', ctx: { kcalHabitual: 300, minutosMax } });
    const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
    const sem = P.semanasPlan(programa, [], buscar, antes);
    const carga = sem.map((s) => s.esfuerzo);
    const id = `${o.clave}/${nivel}/${dias} días/${semanas} semanas/${minutosMax}: ${carga.join(' ')}`;
    const tope = o.clave === 'umbral' && nivel === 'inicio' ? 1.35 : P.SUBIDA_MAX;
    let ref = null;
    carga.forEach((c, i) => {
      const margen = sem[i].dias.length * 0.5;
      if (ref != null) {
        assert.ok(c <= ref * tope + margen, `semana ${i + 1} sobre 1,15 × la última normal (${ref}) · ${id}`);
        if (sem[i - 1]?.descarga && !sem[i].prueba && tope === P.SUBIDA_MAX) assert.ok(c <= ref * P.VUELTA_DESCARGA + margen, `vuelta de la descarga · ${id}`);
      }
      if (i >= 3) {
        const cronica = (carga[i] + carga[i - 1] + carga[i - 2] + carga[i - 3]) / 4;
        assert.ok(c / cronica <= 1.31, `ratio ${(c / cronica).toFixed(2)} en la semana ${i + 1} · ${id}`);
      }
      if (!sem[i].descarga && !sem[i].prueba) ref = c;
    });
    planes++;
  }
}
assert.equal(planes, 5 * 3 * 4 * 4 * 2);

// La carga sigue subiendo: el plan de VO₂ llega a sus series largas, solo que sin saltos.
{
  const { programa } = P.planPorObjetivo({ objetivo: 'vo2', dias: 3, semanas: 8, inicio: '2026-11-02', ctx: {} });
  assert.equal(programa.dias[18].ent, 'VO₂ 4 × 4 min');
}
// Con 1 o 2 días la prueba ocupa el lugar de la sesión dura: la semana de la prueba no tiene dos duras.
{
  const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: 'umbral', nivel: 'medio', dias: 2, semanas: 6, inicio: '2026-11-02', ctx: {} });
  const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
  const semana = programa.dias.slice(10, 12).map((d) => buscar(d.ent));
  assert.ok(semana.some((e) => e.pruebaFtp), 'la última semana tiene la prueba');
  assert.equal(semana.filter((e) => P.esDura(e)).length, 1, semana.map((e) => e.nombre).join(', '));
}

// ---------- Sesiones duras escritas en split (plan hacia una meta) ----------
{
  const { entrenamientos, split } = P.planPorMeta({ distancia: 2000, segundos: 480, semanas: 8, inicio: '2026-11-02' });
  assert.equal(split, 120);
  const de = (re) => entrenamientos.filter((e) => re.test(e.nombre));
  assert.ok(entrenamientos.every((e) => e.splitMeta === 120), 'cada sesión guarda el split de la meta');
  assert.ok(de(/^Umbral/).length && de(/^Umbral/).every((e) => tipoPlan(e) === 'umbral'));
  assert.ok(de(/^Ritmo/).length && de(/^Ritmo/).every((e) => tipoPlan(e) === 'vo2'));
  assert.ok(de(/^Fondo/).length && de(/^Fondo/).every((e) => tipoPlan(e) === 'fondo' && !P.esDura(e)));
  assert.ok(de(/^(Umbral|Ritmo|Prueba)/).every(P.esDura), 'umbral, series y prueba cuentan como duras');
  // Los guardados antes de la 0.81 no tienen splitMeta: sale del calentamiento (+32–45 s). Desde E-2 las zonas
  // van en % y las sesiones nuevas siempre guardan splitMeta.
  const viejo = { tipo: 'intervalos', nombre: 'Umbral a 2:10 3 × 8 min', bloques: [
    { nombre: 'Calentamiento', duracion: 480, metrica: 'split', min: 152, max: 165 },
    { nombre: 'Umbral 1/3', duracion: 480, metrica: 'split', min: 128, max: 132 }] };
  assert.equal(splitMetaDe(viejo), 120);
  assert.equal(tipoPlan(viejo), 'umbral');
}
// Una sesión tuya en split, sin el calentamiento de los planes de meta, no se clasifica a ciegas.
assert.equal(tipoPlan({ tipo: 'intervalos', nombre: 'Mía', bloques: [{ nombre: 'Calentamiento', duracion: 300, metrica: 'split', min: 140, max: 150 }, { nombre: 'Serie', duracion: 300, metrica: 'split', min: 110, max: 112 }] }), null);

// ---------- Calentamiento mínimo antes de lo duro ----------
{
  const serie = { nombre: 'Fuerte 1/4', duracion: 120, metrica: 'ftp', min: 110, max: 115 };
  // Sin calentamiento: se añaden 5 min progresivos al principio, con su explicación para la voz.
  const sin = Ent.conCalentamientoMinimo([serie], true);
  assert.equal(sin.length, 2);
  assert.equal(sin[0].duracion, Ent.CALENTAMIENTO_MIN);
  assert.equal(sin[0].consejo, Ent.CONSEJO_CALENTAMIENTO);
  assert.ok(!Ent.esBloqueTrabajo(sin[0]), 'el calentamiento no cuenta como serie');
  // Calentamiento corto (2 min): se completa hasta 5.
  const corto = Ent.conCalentamientoMinimo([{ nombre: 'Calentamiento', duracion: 120, metrica: 'ftp', min: 50, max: 65 }, serie], true);
  assert.equal(corto[0].duracion, 180);
  // Con 5 min o más, o en una sesión suave, no cambia nada.
  const bien = [{ nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 70 }, serie];
  assert.equal(Ent.conCalentamientoMinimo(bien, true), bien);
  assert.equal(Ent.conCalentamientoMinimo([serie], false).length, 1);
  // Las del plan y las pruebas ya lo traen.
  for (const e of Object.values(Ent.PRUEBAS)) assert.equal(Ent.conCalentamientoMinimo(e.bloques, true), e.bloques, e.nombre);
}

// ---------- Asistente de metas ----------
{
  const ahora = new Date('2026-11-20T10:00').getTime();
  const DIA = 864e5;
  // Muestras de una sesión a split constante (s / 500 m) durante `metros`.
  const sesion = (dias, metros, split) => {
    const muestras = [];
    for (let t = 0; (t * 500) / split < metros; t++) muestras.push({ t, dist: (t * 500) / split, w: 200 });
    muestras.push({ t: (metros * split) / 500, dist: metros, w: 200 });
    return { id: `s${dias}-${metros}`, fecha: ahora - dias * DIA, muestras };
  };
  // Sin sesiones no hay sugerencia.
  assert.equal(P.sugerirMeta([], 2000, 8, ahora), null);
  // Con una marca real reciente en la distancia, se parte de ella.
  const reales = [sesion(10, 2000, 120), sesion(20, 2000, 118)];
  const r = P.sugerirMeta(reales, 2000, 8, ahora);
  assert.ok(r.real && Math.abs(r.t - 472) <= 2, JSON.stringify(r));
  // Sin marca real: la predicción desde la distancia más cercana (1000 m antes que 500 m), no la más optimista.
  const otras = [sesion(5, 500, 100), sesion(8, 1000, 115), sesion(30, 1000, 117)];
  const p = P.sugerirMeta(otras, 2000, 8, ahora);
  assert.equal(p.real, false);
  assert.equal(p.desde, 1000);
  const optimista = Math.min(...[[500, 100], [1000, 115]].map(([d, s]) => Ent.predecir(d, (d / 500) * s, 2000)));
  assert.ok(p.t > optimista, `${p.t} no es la más optimista (${optimista})`);
  // Una marca real de hace más de 90 días no cuenta si hay datos recientes; sin datos recientes, sí.
  assert.equal(P.sugerirMeta([sesion(200, 2000, 110), sesion(10, 1000, 115)], 2000, 8, ahora).real, false);
  assert.equal(P.sugerirMeta([sesion(200, 2000, 110)], 2000, 8, ahora).real, true);
  // La mejora depende de cuánto remas: quien empieza, más; quien entrena seguido, menos.
  assert.equal(P.nivelRemero(reales, ahora), 'inicio');
  const seguido = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, fecha: ahora - (i * 2 + 1) * DIA }));
  assert.equal(P.nivelRemero(seguido, ahora), 'alto');
  assert.ok(P.mejoraMeta('inicio') >= 0.05 && P.mejoraMeta('inicio') <= 0.08);
  assert.ok(P.mejoraMeta('alto') >= 0.02 && P.mejoraMeta('alto') <= 0.03);
  assert.ok(P.mejoraMeta('medio', 4) < P.mejoraMeta('medio', 8) && P.mejoraMeta('medio', 16) < P.mejoraMeta('medio', 8) * 1.5 + 1e-9);
  assert.equal(r.meta, Math.round(r.t * (1 - r.mejora)));
}
console.log('fatiga-plan OK');
