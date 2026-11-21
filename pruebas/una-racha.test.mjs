// Una sola racha (etapa 5): desde UNA_RACHA_DESDE la racha del plan es solo un contador (sin XP ni Voluntad por día),
// remar fuerte en un descanso no la corta, «Semana perfecta» es una semana entera del plan y la misión de juego no sale
// en días con sesión del plan. Lo de antes no cambia.
import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as E from '../src/estadisticas.js';
import * as XC from '../src/xp-carga.js';

const FTP = 200;
const dia = (k, h = 18) => new Date(`${k}T${String(h).padStart(2, '0')}:00`).getTime();
const ses = (k, min, pct, extra = {}) => ({
  fecha: dia(k, extra.hora ?? 18), duracion: min * 60, distancia: min * 250, ftp: FTP, wattsProm: FTP * pct, reglasXp: XC.REGLAS_XP_CARGA,
  muestras: Array.from({ length: min * 60 }, (_, t) => ({ t: t + 1, w: FTP * pct, spm: 22, split: 120, dist: (t + 1) * 4 })), ...extra,
});
const plan = (k, ent, extra = {}) => ses(k, 30, 0.7, { entrenamiento: ent, delPrograma: true, delDia: 'plan', tiempoMeta: 1800, tipoPlan: 'fondo', ...extra });
const tieneRacha = (h, s) => h.porSesion.get(s.fecha).detalle.some(([k]) => k.startsWith('Racha de'));
const estado = (lista, cal, ahora = lista.at(-1).fecha + 3600e3) => J.estadoJuego(lista, { ftp: FTP, per: {}, calendario: cal, ahora });

assert.equal(J.UNA_RACHA_DESDE, '2026-11-22');
// Lu plan, Ma descanso, Mi plan, Ju descanso, Vi plan, Sá y Do descanso (semana del 23 de noviembre).
const cal = { '2026-11-23': 'A', '2026-11-24': '', '2026-11-25': 'B', '2026-11-26': '', '2026-11-27': 'C', '2026-11-28': '', '2026-11-29': '' };
{
  // La racha sigue contando, pero ya no paga XP.
  const lista = [plan('2026-11-23', 'A'), plan('2026-11-25', 'B'), plan('2026-11-27', 'C')];
  const h = estado(lista, cal);
  assert.equal(h.racha.dias, 5);
  assert.ok(!lista.some((s) => tieneRacha(h, s)), 'sin «Racha de N días» en la XP');
}
{
  // Remar fuerte en un descanso ya no la corta: ese día no suma (antes la racha volvía a empezar).
  const lista = [plan('2026-11-23', 'A'), ses('2026-11-24', 60, 0.9), plan('2026-11-25', 'B')];
  assert.equal(estado(lista, cal).racha.dias, 2);
}
{
  // Antes de la fecha de corte todo sigue igual: la racha paga XP y remar fuerte en un descanso la corta.
  const antes = { '2026-11-09': 'A', '2026-11-10': '', '2026-11-11': 'B', '2026-11-12': '' };
  const lista = [plan('2026-11-09', 'A'), plan('2026-11-11', 'B')];
  assert.ok(tieneRacha(estado(lista, antes), lista[1]));
  const corta = [plan('2026-11-09', 'A'), ses('2026-11-10', 60, 0.9), plan('2026-11-11', 'B')];
  assert.equal(estado(corta, antes).racha.dias, 1);
}
{
  // Voluntad: la racha ya no suma 0,5 por día.
  const ctx = { racha: 7, mppPromedio: 0, cargaAyer: 0 };
  const nueva = J.atributosDeSesion(plan('2026-11-25', 'B'), { ftp: FTP, ctx }).voluntad;
  const vieja = J.atributosDeSesion(plan('2026-11-11', 'B'), { ftp: FTP, ctx }).voluntad;
  assert.ok(vieja - nueva >= 3, `${vieja} → ${nueva}`);
}
{
  // Semana del plan cumplida: el juego la cobra con la primera sesión de la semana siguiente, y eso da «Semana perfecta».
  const cal2 = { ...cal, '2026-11-30': 'A', '2026-12-01': '' };
  const lista = [plan('2026-11-23', 'A'), plan('2026-11-25', 'B'), plan('2026-11-27', 'C'), plan('2026-11-30', 'A')];
  const h = estado(lista, cal2);
  assert.equal(h.racha.semanasPlan, 1);
  assert.equal(h.racha.primeraSemanaPlan, lista[3].fecha);
  const ins = E.insignias(lista, { primeraSemanaPlan: h.racha.primeraSemanaPlan });
  assert.ok(ins.find((x) => x.clave === 'racha7').ganada);
  assert.equal(E.INSIGNIAS.find((x) => x.clave === 'racha7').detalle, 'Completa una semana entera de tu plan');
  // 7 días seguidos remando ya no la dan…
  const siete = Array.from({ length: 7 }, (_, i) => ses(`2026-12-0${i + 1}`, 20, 0.6));
  assert.ok(!E.insignias(siete).find((x) => x.clave === 'racha7').ganada);
  // …pero la que se ganó así antes se conserva.
  const antes = Array.from({ length: 7 }, (_, i) => ses(`2026-11-0${i + 1}`, 20, 0.6));
  assert.ok(E.insignias(antes).find((x) => x.clave === 'racha7').ganada);
}
{
  // Misiones: un día con sesión del plan no pide carrera; un descanso o un día sin plan, sí puede.
  const rit = { metros: 5000, min: 30, conRango: true, conPlan: true, conPulso: true, kcal: 300, sesSemana: 3 };
  const juego = new Set(['fantasma', 'renida', 'altamar']);
  for (let d = 22; d <= 30; d++) {
    const k = `2026-11-${d}`;
    assert.ok(!J.misionesDelDia(k, rit, { planHoy: 'Umbral' }).some((m) => juego.has(m.clave)), k);
    assert.ok(J.misionesDelDia(k, rit, { planHoy: '' }).some((m) => juego.has(m.clave)), k);
  }
}
console.log('una-racha OK');
