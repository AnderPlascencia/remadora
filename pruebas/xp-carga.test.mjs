import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as XC from '../src/xp-carga.js';

// Etapa 6 (acuerdo D1): XP por carga con tope diario, sesión del plan, descansos y semana cumplida.
const FTP = 200;
const dia = (k, h = 18) => new Date(`${k}T${String(h).padStart(2, '0')}:00`).getTime();
// Sesión de `min` minutos a `pct` del FTP: la carga es min/60 · pct² · 100.
const ses = (k, min, pct, extra = {}) => ({
  fecha: dia(k, extra.hora ?? 18), duracion: min * 60, distancia: min * 250, ftp: FTP, wattsProm: FTP * pct, reglasXp: XC.REGLAS_XP_CARGA,
  muestras: Array.from({ length: min * 60 }, (_, t) => ({ t: t + 1, w: FTP * pct, spm: 22, split: 120, dist: (t + 1) * 4 })), ...extra,
});
const xpDe = (h, s, nombre) => h.porSesion.get(s.fecha).detalle.find(([k]) => k.startsWith(nombre))?.[1] ?? 0;
const estado = (lista, cal = {}) => J.estadoJuego(lista, { ftp: FTP, per: {}, calendario: cal, ahora: lista.at(-1).fecha + 3600e3 });

// Curva: 5 por punto hasta 30, 2,5 hasta 60, nada después; el tope es del día.
assert.equal(XC.XP_BASE_TOPE_DIA, 225);
assert.equal(XC.xpBaseCarga(0, 20), 100);
assert.equal(XC.xpBaseCarga(0, 40), 175);
assert.equal(XC.xpBaseCarga(0, 90), 225);
assert.equal(XC.xpBaseCarga(40, 40), 50, 'la segunda sesión del día solo llena el hueco hasta el tope');
{
  const a = ses('2026-11-09', 60, 0.8, { hora: 8 }); // 64 puntos
  const b = ses('2026-11-09', 30, 0.7, { hora: 19 });
  const h = estado([a, b]);
  assert.equal(xpDe(h, a, 'Carga'), 225);
  assert.equal(xpDe(h, b, 'Carga'), 0, 'remar dos veces no duplica el tope');
}

// Cumplida según el tipo de sesión.
assert.equal(XC.cumplimientoPlan({ tiempoMeta: 1, tipoPlan: 'fondo', pctEnRango: 75, pctAlto: 25, pctBajo: 0 }), 'terminada', 'en un fondo no vale pasarse');
assert.equal(XC.cumplimientoPlan({ tiempoMeta: 1, tipoPlan: 'fondo', pctEnRango: 80, pctAlto: 10, pctBajo: 10 }), 'cumplida');
assert.equal(XC.cumplimientoPlan({ tiempoMeta: 1, tipoPlan: 'umbral', pctEnRango: 55, pctAlto: 25, pctBajo: 20 }), 'cumplida', 'en una dura, por encima cuenta');
assert.equal(XC.cumplimientoPlan({ tiempoMeta: 1, tipoPlan: 'vo2', pctEnRango: 60, pctAlto: 5, pctBajo: 35 }), 'terminada', 'quedarse corto no vale');
assert.equal(XC.cumplimientoPlan({ tiempoMeta: 1, tipoPlan: 'fondo', pctEnRango: null }), 'cumplida', 'sin rango basta con terminar');
assert.equal(XC.cumplimientoPlan({ tiempoMeta: null, tipoPlan: 'fondo', pctEnRango: 90 }), null);

// Sesión del plan, sugerida sin plan, equivalente y prueba del plan.
{
  const plan = ses('2026-11-09', 45, 0.9, { entrenamiento: 'Umbral', delPrograma: true, delDia: 'plan', tiempoMeta: 2700, tipoPlan: 'umbral', pctEnRango: 80, pctAlto: 10, pctBajo: 10 });
  const corta = ses('2026-11-10', 30, 0.7, { entrenamiento: 'Fondo', delDia: 'sugerida', tiempoMeta: 1800, tipoPlan: 'fondo', pctEnRango: 70, pctAlto: 25, pctBajo: 5 });
  const h = estado([plan, corta]);
  assert.equal(xpDe(h, plan, 'Sesión del plan cumplida'), 150);
  assert.equal(xpDe(h, corta, 'Sesión del plan terminada'), 75, 'sugerida sin plan, pasada de rango en un fondo');
  assert.ok(!h.porSesion.get(plan.fecha).detalle.some(([k]) => k === 'Entrenamiento completo'), 'ya no hay «Entrenamiento completo» suelto');
  const sug = ses('2026-11-11', 30, 0.7, { entrenamiento: 'Fondo', delDia: 'sugerida', tiempoMeta: 1800 });
  assert.equal(xpDe(estado([sug]), sug, 'Sesión del día cumplida'), 150);
  const prueba = ses('2026-11-12', 20, 1, { entrenamiento: 'Prueba 2000 m', delPrograma: true, tiempoMeta: 1200, tipoPlan: 'prueba' });
  assert.equal(xpDe(estado([prueba]), prueba, 'Prueba del plan'), 60);
}
{
  // Plan: fondo de 25 puntos. Hecho otro fondo de 79 %, 100 % y 131 % de esa carga.
  const otro = (min) => ses('2026-11-09', min, 0.7, { planDelDia: { ent: 'Fondo', tipo: 'fondo', carga: 25 } });
  const xp = (min) => { const s = otro(min); return xpDe(estado([s]), s, 'Equivale'); };
  assert.equal(xp(23), 0, '19 puntos: 76 %');
  assert.equal(xp(31), 75, '25 puntos: 100 %');
  assert.equal(xp(41), 0, '33 puntos: 132 %');
}

// Descansos del plan y semana cumplida (lunes 9 a domingo 15).
const cal = { '2026-11-09': 'Umbral', '2026-11-10': '', '2026-11-11': 'Fondo', '2026-11-12': '', '2026-11-13': 'Fondo', '2026-11-14': '', '2026-11-15': '' };
const delPlan = (k, ent, pct = 0.75) => ses(k, 40, pct, { entrenamiento: ent, delPrograma: true, delDia: 'plan', tiempoMeta: 2400, tipoPlan: ent === 'Umbral' ? 'umbral' : 'fondo', pctEnRango: 85, pctAlto: 5, pctBajo: 10 });
{
  const semana = [delPlan('2026-11-09', 'Umbral', 0.9), delPlan('2026-11-11', 'Fondo'), delPlan('2026-11-13', 'Fondo'), delPlan('2026-11-16', 'Umbral', 0.9)];
  const h = estado(semana, cal);
  assert.equal(xpDe(h, semana[1], 'Descanso del plan respetado'), 60, 'martes de descanso');
  assert.equal(xpDe(h, semana[2], 'Descanso del plan respetado'), 60, 'jueves, cobrado el viernes');
  assert.equal(xpDe(h, semana[3], '2 descansos'), 120, 'sábado y domingo, cobrados el lunes');
  assert.equal(xpDe(h, semana[3], 'Semana del plan cumplida'), 200);
  assert.ok(h.porSesion.get(semana[3].fecha).ganancias.voluntad >= 5, 'la semana cumplida suma Voluntad');
  // Remar suave en un descanso (≤ 20 puntos e IF < 0,65) sigue contando como descanso.
  const suave = ses('2026-11-12', 30, 0.6);
  const h2 = estado([...semana.slice(0, 3), suave, semana[3]], cal);
  assert.equal(h2.porSesion.get(suave.fecha).avisoDescanso, false);
  assert.equal(xpDe(h2, semana[3], 'Semana del plan cumplida'), 200);
  // Remar fuerte en un descanso: XP base completa, aviso, y ni descanso ni semana cumplida.
  const fuerte = ses('2026-11-12', 40, 0.85);
  const h3 = estado([...semana.slice(0, 3), fuerte, semana[3]], cal);
  assert.equal(h3.porSesion.get(fuerte.fecha).avisoDescanso, true);
  assert.equal(xpDe(h3, fuerte, 'Carga'), XC.xpBaseCarga(0, 40 / 60 * 0.85 ** 2 * 100));
  assert.equal(xpDe(h3, semana[2], 'Descanso'), 0, 'el jueves no fue descanso');
  assert.equal(xpDe(h3, semana[3], '2 descansos'), 120);
  assert.equal(xpDe(h3, semana[3], 'Semana'), 0);
  // Una sesión del plan recuperada en un descanso de la misma semana no rompe la semana.
  const recuperada = { ...delPlan('2026-11-14', 'Fondo'), delDia: 'recuperar' };
  const h4 = estado([semana[0], semana[1], recuperada, semana[3]], cal);
  assert.equal(h4.porSesion.get(recuperada.fecha).avisoDescanso, false);
  assert.equal(xpDe(h4, semana[3], 'Semana del plan cumplida'), 200);
  // Si falta una sesión del plan, no hay semana cumplida.
  assert.equal(xpDe(estado([semana[0], semana[1], semana[3]], cal), semana[3], 'Semana'), 0);
}

// «Sesión más larga» ya no da récord con las reglas de carga.
{
  const a = ses('2026-11-09', 30, 0.7);
  const b = ses('2026-11-10', 60, 0.7, { muestras: ses('x', 60, 0.7).muestras.map((x) => ({ ...x })) });
  assert.equal(xpDe(estado([a, b]), b, 'Récord'), 0);
}

// Las sesiones antiguas (sin reglasXp) no cambian de XP.
{
  const vieja = { ...ses('2026-11-02', 30, 0.7), reglasXp: undefined, tiempoMeta: 1800 };
  const h = estado([vieja]);
  assert.equal(xpDe(h, vieja, 'Distancia'), Math.floor(vieja.distancia / 10 / 2));
  assert.equal(xpDe(h, vieja, 'Entrenamiento completo'), 25);
  assert.deepEqual(estado([vieja], cal).porSesion.get(vieja.fecha).detalle, h.porSesion.get(vieja.fecha).detalle);
}

// Calendario: un plan nuevo cambia de hoy en adelante y deja lo pasado como estaba.
{
  const viejo = XC.calendarioDe({ inicio: '2026-11-09', dias: [{ fecha: '2026-11-09', ent: 'A' }, { fecha: '2026-11-13', ent: 'B' }] });
  assert.deepEqual(viejo, { '2026-11-09': 'A', '2026-11-10': '', '2026-11-11': '', '2026-11-12': '', '2026-11-13': 'B' });
  const nuevo = XC.fusionarCalendario(viejo, { inicio: '2026-11-11', dias: [{ fecha: '2026-11-12', ent: 'C' }] }, '2026-11-11');
  assert.deepEqual(nuevo, { '2026-11-09': 'A', '2026-11-10': '', '2026-11-11': '', '2026-11-12': 'C' });
  assert.deepEqual(XC.fusionarCalendario(viejo, null, '2026-11-11'), { '2026-11-09': 'A', '2026-11-10': '' }, 'quitar el plan borra solo lo que venía');
}
console.log('xp-carga OK');
