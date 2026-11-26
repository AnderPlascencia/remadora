// No perder a quien falla (etapa 14): versión corta, protocolo de regreso, escudos de racha y sesión de regreso.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/programa.js';
import * as A from '../src/adaptacion.js';
import * as XC from '../src/xp-carga.js';
import * as J from '../src/juego.js';
import { TIPOS, clave } from './sim-curva.mjs';

const D = 864e5;
const ms = (k, h = '19:00') => new Date(`${k}T${h}`).getTime();
const mas = (k, n) => clave(ms(k, '12:00') + n * D);
const plan = P.planPorObjetivo({ objetivo: 'umbral', nivel: 'medio', dias: 3, semanas: 6, inicio: '2026-11-23' });
const ent = (n) => plan.entrenamientos.find((e) => e.nombre === n);

test('«Solo tengo 15 / 20 min»: conserva el calentamiento, el trabajo que cabe y el enfriamiento', () => {
  const umbral = plan.entrenamientos.find((e) => /^Umbral/.test(e.nombre));
  const c = P.versionCorta(umbral, 20);
  assert.equal(c.nombre, umbral.nombre, 'mismo nombre: cuenta como la sesión del plan');
  assert.equal(c.versionCorta, 20);
  assert.ok(P.duracionPlan(c) <= 20 * 60, `${P.duracionPlan(c)} s`);
  assert.match(c.bloques[0].nombre, /^Calentamiento/);
  assert.match(c.bloques.at(-1).nombre, /^Enfriamiento/);
  // Las series entran enteras, no a medias.
  const serie = umbral.bloques.find((b) => /^Umbral/.test(b.nombre));
  assert.ok(c.bloques.filter((b) => /^Umbral/.test(b.nombre)).every((b) => b.duracion === serie.duracion));
  assert.match(c.resumenCorta, /de \d+ bloques de trabajo/);
  // Un fondo se acorta; algo que ya cabe no tiene versión corta.
  const fondo = plan.entrenamientos.find((e) => /^Fondo/.test(e.nombre));
  assert.ok(P.duracionPlan(P.versionCorta(fondo, 15)) <= 15 * 60);
  assert.equal(P.versionCorta({ nombre: 'x', bloques: [{ nombre: 'Fondo', duracion: 900 }] }, 15), null);
  // Paga como la sesión del plan hecha a medias.
  assert.equal(XC.cumplimientoPlan({ tiempoMeta: 1200, pctEnRango: 95, versionCorta: 20 }), 'terminada');
  assert.equal(XC.cumplimientoPlan({ tiempoMeta: 1200, pctEnRango: 95 }), 'cumplida');
});

test('protocolo de regreso: 5–9 días, la primera al 80 %; 10–20, una semana al 65 % con rangos al 95 %; 21+, rehacer', () => {
  assert.equal(A.tramoRegreso(4), null);
  assert.equal(A.tramoRegreso(5), 'corto');
  assert.equal(A.tramoRegreso(10), 'medio');
  assert.equal(A.tramoRegreso(21), 'largo');
  assert.equal(A.diasFuera([{ fecha: ms('2026-11-20') }], ms('2026-12-01')), 10);
  assert.equal(A.diasFuera([], ms('2026-12-01')), null);
  const umbral = plan.entrenamientos.find((e) => /^Umbral/.test(e.nombre));
  const v = P.sesionDeVuelta(umbral, 0.65, 0.95);
  assert.match(v.nombre, / · vuelta$/);
  const t = umbral.bloques.findIndex((b) => /^Umbral/.test(b.nombre));
  assert.ok(Math.abs(v.bloques[t].duracion - umbral.bloques[t].duracion * 0.65) <= 15);
  assert.equal(v.bloques[t].min, Math.round(umbral.bloques[t].min * 0.95));
  assert.equal(v.bloques[0].duracion, umbral.bloques[0].duracion, 'el calentamiento no cambia');

  // Plan del 23 de noviembre; remaste la primera semana y vuelves el 14 de diciembre (lunes) tras 13 días.
  const prog = structuredClone(plan.programa);
  const hechas = prog.dias.filter((d) => d.fecha < '2026-11-30').map((d) => ({ fecha: ms(d.fecha), entrenamiento: d.ent, tiempoMeta: 1800, duracion: 1800 }));
  const ahora = ms('2026-12-14', '08:00');
  const r = A.revisarPlan({ programa: prog, sesiones: hechas, entrenamientos: plan.entrenamientos, ahora });
  const semana = r.programa.dias.filter((d) => d.fecha >= '2026-12-14' && d.fecha <= '2026-12-20');
  assert.ok(semana.length && semana.every((d) => / · vuelta$/.test(d.ent) || /^Prueba/.test(d.ent)), semana.map((d) => d.ent).join());
  assert.ok(r.avisos.some((x) => /Bienvenido de vuelta tras \d+ días/.test(x)));
  assert.ok(!r.avisos.some((x) => /perdiste|racha/i.test(x)), 'sin reproches');
  assert.ok(r.entrenamientos.some((e) => / · vuelta$/.test(e.nombre)));
  // Una vez por parón.
  const otra = A.revisarPlan({ programa: { ...r.programa, revision: null }, sesiones: hechas, entrenamientos: [...plan.entrenamientos, ...r.entrenamientos], ahora: ahora + D });
  assert.ok(!(otra?.avisos || []).some((x) => /Bienvenido/.test(x)));
  // 6 días fuera: solo la primera sesión va al 80 %.
  const corto = A.revisarPlan({ programa: structuredClone(plan.programa), sesiones: hechas.slice(0, 2), entrenamientos: plan.entrenamientos, ahora: ms('2026-12-02', '08:00') });
  assert.equal(corto.programa.dias.filter((d) => / · vuelta$/.test(d.ent)).length, 1);
  // 3 semanas o más: se propone rehacer el plan.
  const largo = A.revisarPlan({ programa: structuredClone(plan.programa), sesiones: hechas, entrenamientos: plan.entrenamientos, ahora: ms('2026-12-28', '08:00') });
  assert.equal(largo.programa.proponerRehacer, '2026-12-28');
  // Sin plan: un fondo suave.
  const sin = A.sesionDelDia({ sesiones: hechas, ahora });
  assert.equal(sin.id, 'base:dis-suave');
  assert.match(sin.motivo, /^Bienvenido de vuelta/);
});

// Sesiones del plan de 3 días (lunes, miércoles y viernes) con su calendario.
function conPlan(semanas, inicio, saltar = new Set()) {
  const cal = {};
  const ses = [];
  for (let w = 0; w < semanas; w++) for (let d = 0; d < 7; d++) {
    const k = mas(inicio, w * 7 + d);
    if ([0, 2, 4].includes(d)) {
      cal[k] = 'Fondo 30';
      if (!saltar.has(k)) ses.push(TIPOS.fondo30(ms(k), { delPrograma: true, delDia: 'plan' }));
    } else cal[k] = '';
  }
  return { cal, ses };
}

test('escudos: una semana del plan cumplida guarda uno, y salva un día perdido sin cortar la racha', () => {
  // Del 23 de noviembre, 3 semanas; en la segunda falta la sesión del lunes 30.
  const { cal, ses } = conPlan(3, '2026-11-23', new Set(['2026-11-30']));
  const h = J.estadoJuego(ses, { ftp: 200, per: {}, ahora: ms('2026-12-11', '21:00'), calendario: cal });
  assert.equal(h.racha.salvados, 1, 'el escudo salvó el día');
  assert.ok(h.racha.dias >= 12, `racha ${h.racha.dias}`);
  // La misma historia antes de la fecha de corte: sin escudos, la racha se corta.
  const antes = conPlan(3, '2026-10-26', new Set(['2026-11-02']));
  const ha = J.estadoJuego(antes.ses, { ftp: 200, per: {}, ahora: ms('2026-11-13', '21:00'), calendario: antes.cal });
  assert.equal(ha.racha.salvados, 0);
  assert.ok(ha.racha.dias < h.racha.dias, `${ha.racha.dias} < ${h.racha.dias}`);
  // Como mucho 2 guardados.
  const largo = conPlan(5, '2026-11-23');
  assert.equal(J.estadoJuego(largo.ses, { ftp: 200, per: {}, ahora: ms('2026-12-27', '21:00'), calendario: largo.cal }).racha.escudos, J.ESCUDOS_MAX);
});

test('sesión de regreso: tras 10 días o más, las 3 primeras pagan como la del día (desde la fecha de corte)', () => {
  const libre = (k) => TIPOS.libre30(ms(k));
  const ses = ['2026-11-23', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11'].map(libre);
  const h = J.estadoJuego(ses, { ftp: 200, per: {}, ahora: ms('2026-12-12') });
  const regreso = ses.map((s) => h.porSesion.get(s.fecha).detalle.find(([k]) => k === 'Sesión de regreso')?.[1] ?? 0);
  const pago = Math.round(XC.XP_PLAN.cumplida * J.FACTOR_RITMO3); // desde RITMO3_DESDE (R2-5), un 25 % más
  assert.deepEqual(regreso, [0, pago, pago, pago, 0]);
  // Antes del corte, nada.
  const viejas = ['2026-11-01', '2026-11-16', '2026-11-17'].map(libre);
  const hv = J.estadoJuego(viejas, { ftp: 200, per: {}, ahora: ms('2026-11-18') });
  assert.ok(viejas.every((s) => !hv.porSesion.get(s.fecha).detalle.some(([k]) => k === 'Sesión de regreso')));
  // Una sesión del plan ya pagada no cobra además el regreso.
  const delPlan = [TIPOS.fondo30(ms('2026-11-23')), TIPOS.fondo30(ms('2026-12-08'), { delPrograma: true, delDia: 'plan' })];
  const hp = J.estadoJuego(delPlan, { ftp: 200, per: {}, ahora: ms('2026-12-09') });
  const det = hp.porSesion.get(delPlan[1].fecha).detalle.map(([k]) => k);
  assert.ok(det.includes('Sesión del plan cumplida') && !det.includes('Sesión de regreso'), det.join());
});
