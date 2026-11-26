// Prueba de la curva (etapa 12): el simulador de 2 años sobre estadoJuego real, más invariantes por propiedades.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as XC from '../src/xp-carga.js';
import { simular, TIPOS, clave } from './sim-curva.mjs';

const D = 864e5;
const MES = 365.25 / 12 / 7; // semanas por mes

// ⚖ R2-5 (decisión de Ander): desde RITMO3_DESDE la curva se calibra a 3 sesiones por semana. El plan de 3 días llega
// al 90 en lo que antes tardaba el de 4 (16 a 20 meses), y el de 4 llega antes.
test('plan de 3 días: nivel 90 entre 16 y 20 meses; el de 4, entre 12 y 16', () => {
  const r = simular('plan3');
  assert.ok(r.legendario >= 16 * MES && r.legendario <= 20 * MES, `plan3: semana ${r.legendario}`);
  const r4 = simular('plan4').legendario;
  assert.ok(r4 >= 12 * MES && r4 < 16 * MES, `plan4: semana ${r4}`);
});

test('plan de 4 días: llega al 90 en 2 años, con las misiones entre el 12 y el 20 % de la XP', () => {
  const r = simular('plan4');
  assert.ok(r.legendario, 'llega a Legendario en 2 años');
  assert.ok(r.pctMisiones >= 12 && r.pctMisiones <= 20, `misiones ${r.pctMisiones.toFixed(1)} % de la XP`);
  // Una diaria por día de remo, nunca más.
  const porDia = new Map();
  for (const d of r.diarias) porDia.set(clave(d.fecha), (porDia.get(clave(d.fecha)) || 0) + 1);
  assert.ok([...porDia.values()].every((n) => n === 1));
  // Ninguna diaria vale más que media sesión.
  for (const d of r.diarias) assert.ok(d.xp <= r.xpSesionFinal / 2, `${d.texto}: ${d.xp} XP`);
  // Ya no se paga el plan en las misiones.
  assert.ok(!r.h.logros.some((l) => /^(Fiel al plan|La sesión del día|Remo de recuperación|Semana fiel):/.test(l.texto)));
});

// Seguir el plan sigue rindiendo más: 4 días de remo libre tardan más que 3 días de plan.
test('remo libre 4 días: llega después que el plan de 3 días', () => {
  const r = simular('libre4');
  assert.ok(!r.legendario || r.legendario > simular('plan3').legendario, `Legendario en la semana ${r.legendario}`);
});

test('plan de 6 días: Legendario antes que con 4, pero no antes de 10 meses', () => {
  const r = simular('plan6');
  assert.ok(r.legendario && r.legendario >= 10 * MES && r.legendario < simular('plan4').legendario, `semana ${r.legendario}`);
});

test('⚖ XP: un historial anterior al corte da la misma XP y monedas que antes del cambio', () => {
  // Valores medidos con main antes de la etapa 12 (0.84.0): 8 semanas, del 28 de septiembre al 22 de noviembre.
  const base = new Date('2026-09-28T19:00').getTime();
  const esperado = { plan4: [84573, 6575, 36618], libre4: [63081, 5093, 24669], plan6: [98970, 7829, 45483] };
  for (const [n, [xp, monedas, xpSesiones]] of Object.entries(esperado)) {
    const r = simular(n, { semanas: 8, base });
    assert.deepEqual([r.h.xp, r.h.monedasGanadas, r.xpSesiones], [xp, monedas, xpSesiones], n);
  }
  // Antes del corte: 3 diarias y la carga de siempre.
  assert.equal(J.misionesDelDia('2026-11-22', null, { planHoy: 'Umbral' }).length, 3);
  assert.equal(XC.xpBaseCarga(0, 60, new Date('2026-11-22T19:00').getTime()), 225);
  assert.equal(XC.xpBaseCarga(0, 60, new Date('2026-11-23T19:00').getTime()), XC.XP_BASE_TOPE_DIA_PLENA);
});

// Historias al azar: mezcla de tipos, días y semanas de pausa.
function azar(semilla) {
  let x = semilla;
  return () => (x = (x * 48271) % 2147483647) / 2147483647;
}
function historiaAlAzar(semilla) {
  const r = azar(semilla);
  const base = new Date('2026-10-26T18:00').getTime() + Math.floor(r() * 14) * D; // cruza el corte
  const tipos = Object.keys(TIPOS);
  const ses = [];
  const cal = {};
  for (let d = 0; d < 70; d++) {
    const f = base + d * D + Math.floor(r() * 4) * 36e5;
    const delPlan = r() < 0.5;
    cal[clave(f)] = '';
    if (r() < 0.45) {
      const t = tipos[Math.floor(r() * tipos.length)];
      const s = TIPOS[t](f, delPlan && t !== 'libre30' ? { delPrograma: true, delDia: 'plan' } : { rivales: r() < 0.5 ? [{ clase: 'romano', dificultad: 'costa', diferencia: r() < 0.5 ? 50 : -50 }] : undefined });
      if (delPlan && t !== 'libre30') cal[clave(f)] = s.entrenamiento;
      ses.push(s);
    }
  }
  return { ses, cal, ahora: base + 71 * D };
}

test('propiedades: la XP nunca baja, el nivel nunca baja y las monedas nunca son negativas', () => {
  for (let semilla = 1; semilla <= 12; semilla++) {
    const { ses, cal, ahora } = historiaAlAzar(semilla * 7919);
    const clase = ['vikingo', 'pirata', 'samurai', 'polinesio', 'romano'][semilla % 5];
    const h = J.estadoJuego(ses, { ftp: 200, per: { clase }, ahora, calendario: semilla % 2 ? cal : null, metaSemanaKm: 20 });
    let nivel = 1;
    for (const p of h.porSesion.values()) {
      assert.ok(p.xp >= 0 && p.xpExtra >= 0, `semilla ${semilla}: XP de sesión negativa`);
      assert.ok(p.monedas >= 0, `semilla ${semilla}: monedas negativas`);
      assert.ok(p.nivelAntes >= nivel && p.nivelDespues >= p.nivelAntes, `semilla ${semilla}: el nivel bajó`);
      nivel = p.nivelDespues;
    }
    for (const l of h.logros) assert.ok(l.xp >= 0 && l.monedas >= 0, `semilla ${semilla}: ${l.texto}`);
    assert.ok(h.monedasGanadas >= 0 && h.xp >= 0);
    // Con un día más de historial, la XP no baja.
    const menos = J.estadoJuego(ses.slice(0, -1), { ftp: 200, per: { clase }, ahora, calendario: semilla % 2 ? cal : null, metaSemanaKm: 20 });
    assert.ok(h.xp >= menos.xp, `semilla ${semilla}: la XP bajó con una sesión más`);
  }
});

test('las diarias nuevas: la prueba que toca, la cadencia del bloque, el descanso de verdad y la capacidad más floja', () => {
  const dia = '2026-11-24'; // martes
  const rit = { conRango: true, conPlan: true, kcal: 300 };
  const una = (o) => J.misionesDelDia(dia, rit, o);
  assert.equal(una({ planHoy: 'Prueba FTP 20 min' })[0].clave, 'prueba');
  assert.equal(una({ planHoy: 'Umbral 3×10', cargaAyer: 90 })[0].clave, 'cadencia', 'el plan manda sobre el descanso');
  assert.equal(una({ planHoy: '', cargaAyer: 75 })[0].clave, 'recupera');
  assert.equal(una({ cargaAyer: 60 })[0].clave, 'recupera');
  for (const o of [{}, { planHoy: '' }, { planHoy: 'Fondo 45' }]) assert.equal(una(o).length, 1);
  // La capacidad más floja sale en un descanso del plan y nunca pide carreras en un día del plan.
  assert.equal(una({ planHoy: '', atributo: 'tecnica' })[0].clave, 'cap-tec');
  assert.equal(una({ planHoy: '', atributo: 'tecnica' })[0].atributo, 'tecnica');
  // La intensidad solo martes y jueves: el miércoles el umbral pasa a la base.
  assert.equal(J.misionesDelDia('2026-11-24', rit, { planHoy: '', atributo: 'fuerza' })[0].clave, 'cap-umbral');
  assert.equal(J.misionesDelDia('2026-11-25', rit, { planHoy: '', atributo: 'fuerza' })[0].clave, 'cap-base');
  // Sin «Semana fiel» con plan; sin plan sigue «Disciplina de hierro».
  const sem = J.misionesDeSemana('2026-11-23', 'vikingo', rit).map((m) => m.clave);
  assert.ok(!sem.includes('semplan') && !sem.includes('semparejo'), sem.join());
  assert.ok(J.misionesDeSemana('2026-11-23', 'vikingo', { ...rit, conPlan: false }).some((m) => m.clave === 'disciplina'));
  assert.ok(J.misionesDeSemana('2026-11-16', 'vikingo', rit).some((m) => m.clave === 'semplan'), 'la semana anterior no cambia');
});

