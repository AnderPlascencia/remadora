import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as XC from '../src/xp-carga.js';

// Racha del plan (decisión de Ander): cuentan los días de plan cumplidos y los días de descanso cumplidos.
const FTP = 200;
const dia = (k, h = 18) => new Date(`${k}T${String(h).padStart(2, '0')}:00`).getTime();
const ses = (k, min, pct, extra = {}) => ({
  fecha: dia(k, extra.hora ?? 18), duracion: min * 60, distancia: min * 250, ftp: FTP, wattsProm: FTP * pct, reglasXp: XC.REGLAS_XP_CARGA,
  muestras: Array.from({ length: min * 60 }, (_, t) => ({ t: t + 1, w: FTP * pct, spm: 22, split: 120, dist: (t + 1) * 4 })), ...extra,
});
const plan = (k, ent, extra = {}) => ses(k, 30, 0.7, { entrenamiento: ent, delPrograma: true, delDia: 'plan', tiempoMeta: 1800, tipoPlan: 'fondo', ...extra });
const rachaDe = (h, s) => Number(h.porSesion.get(s.fecha).detalle.find(([k]) => k.startsWith('Racha de'))?.[0].match(/\d+/)[0] ?? 0);
const estado = (lista, cal) => J.estadoJuego(lista, { ftp: FTP, per: {}, calendario: cal, ahora: lista.at(-1).fecha + 3600e3 });

// Lu plan, Ma descanso, Mi plan, Ju descanso, Vi plan: remando 3 días, la racha es de 5 (los descansos cuentan).
const cal = { '2026-11-09': 'A', '2026-11-10': '', '2026-11-11': 'B', '2026-11-12': '', '2026-11-13': 'C', '2026-11-14': '', '2026-11-15': 'D' };
{
  const lista = [plan('2026-11-09', 'A'), plan('2026-11-11', 'B'), plan('2026-11-13', 'C')];
  const h = estado(lista, cal);
  assert.deepEqual(lista.map((s) => rachaDe(h, s)), [0, 3, 5], 'el primer día solo es racha 1 (sin bono)');
  assert.equal(h.contexto.racha, 5, 'la estimación de hoy cuenta hoy cumplido');
}
// Un descanso con remo suave (≤ 20 de carga) sigue siendo descanso cumplido.
{
  const lista = [plan('2026-11-09', 'A'), ses('2026-11-10', 15, 0.5), plan('2026-11-11', 'B')];
  assert.equal(rachaDe(estado(lista, cal), lista[2]), 3);
}
// Remar fuerte en el descanso lo rompe: esa sesión no tiene racha y la siguiente empieza de nuevo.
{
  const lista = [plan('2026-11-09', 'A'), ses('2026-11-10', 60, 0.9), plan('2026-11-11', 'B'), plan('2026-11-13', 'C')];
  const h = estado(lista, cal);
  assert.equal(rachaDe(h, lista[1]), 0);
  assert.equal(rachaDe(h, lista[2]), 0, 'racha 1 de nuevo');
  assert.equal(rachaDe(h, lista[3]), 3);
}
// Un día de plan sin su sesión corta la racha; remar otra cosa ese día no lo arregla.
{
  const lista = [plan('2026-11-09', 'A'), ses('2026-11-11', 30, 0.7), plan('2026-11-13', 'C')];
  const h = estado(lista, cal);
  assert.equal(rachaDe(h, lista[1]), 2, 'el día de plan aún abierto no corta: Lu + Ma');
  assert.equal(rachaDe(h, lista[2]), 2, 'Mi sin la sesión del plan corta: Ju + Vi');
}
// Recuperar en un descanso la sesión del plan cuenta ese descanso.
{
  const lista = [plan('2026-11-09', 'A'), plan('2026-11-10', 'B', { delPrograma: false, delDia: 'recuperar', tipoPlan: 'umbral' }), plan('2026-11-11', 'B')];
  assert.equal(rachaDe(estado(lista, cal), lista[2]), 3);
}
// Semana flexible: hacer la sesión otro día de su semana no corta la racha.
{
  // B (miércoles) se rema el jueves: el miércoles cuenta como uno de los 3 descansos de la semana.
  const lista = [plan('2026-11-09', 'A'), plan('2026-11-12', 'B'), plan('2026-11-13', 'C')];
  const h = estado(lista, cal);
  assert.deepEqual(lista.map((s) => rachaDe(h, s)), [0, 4, 5]);
}
{
  // Cuatro días sin remar con solo 3 descansos: el cuarto queda pendiente (no suma ni corta) mientras la semana sigue.
  const lista = [plan('2026-11-09', 'A'), plan('2026-11-14', 'B'), plan('2026-11-15', 'C')];
  const h = estado(lista, cal);
  assert.deepEqual(lista.map((s) => rachaDe(h, s)), [0, 5, 6]);
  // Cerrada la semana sin la cuarta sesión, el día que faltó corta: el lunes siguiente cuenta sáb + dom + lun.
  const con = [...lista, plan('2026-11-16', 'A')];
  assert.equal(rachaDe(estado(con, { ...cal, '2026-11-16': 'A' }), con.at(-1)), 3);
}
// Fuera del calendario (sin plan) vale remar ese día, como antes.
{
  const lista = [ses('2026-11-09', 30, 0.7), ses('2026-11-10', 30, 0.7), ses('2026-11-11', 30, 0.7)];
  assert.equal(rachaDe(estado(lista, {}), lista[2]), 3);
}
// Las sesiones de antes del cambio siguen con la racha de días remando: los descansos no suman.
{
  const viejo = { '2026-10-26': 'A', '2026-10-27': '', '2026-10-28': 'B' };
  const lista = [plan('2026-10-26', 'A'), plan('2026-10-28', 'B')];
  assert.equal(rachaDe(estado(lista, viejo), lista[1]), 0);
}
// «Mar abierto» pide 4 días seguidos cumpliendo el plan.
assert.deepEqual(J.REQ_MAR_ABIERTO, ['racha', 4]);
assert.equal(J.REQ_TEXTO.racha, 'Días seguidos cumpliendo el plan');
