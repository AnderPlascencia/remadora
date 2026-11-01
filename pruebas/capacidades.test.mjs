import assert from 'node:assert/strict';
import * as Cap from '../capacidades.js';

const ahora = Date.parse('2026-10-26T12:00');
const DIA = 864e5;
const sesion = (dias, segs, fw, extra = {}) => {
  const muestras = Array.from({ length: segs }, (_, t) => ({ t, ...fw(t), dist: t * 4, spm: 22 }));
  return { fecha: ahora - dias * DIA, duracion: segs, distancia: segs * 4, paladas: Math.round(segs / 60 * 22), kcal: Math.round(segs / 6), muestras, wattsProm: Math.round(muestras.reduce((a, x) => a + x.w, 0) / segs), ...extra };
};

// ---------- Tipo de sesión ----------
const fondo = sesion(1, 2400, (t) => ({ w: 140, fc: 130 + t / 600 }), { fcProm: 132 });
const umbral = sesion(2, 2400, (t) => ({ w: t > 600 && t < 1800 ? 200 : 120 }), { pctEnRango: 85 });
const vo2 = sesion(3, 2000, (t) => ({ w: t > 600 && t < 1200 && Math.floor(t / 120) % 2 ? 230 : 120 }));
const sprint = sesion(4, 900, (t) => ({ w: t % 120 < 15 ? 450 : 110 }));
assert.equal(Cap.tipoSesion(fondo, 200), 'fondo');
assert.equal(Cap.tipoSesion(umbral, 200), 'umbral');
assert.equal(Cap.tipoSesion(vo2, 200), 'vo2');
assert.equal(Cap.tipoSesion(sprint, 200), 'sprint');
assert.equal(Cap.tipoSesion({ ...umbral, enfoque: 'tecnica' }, 0), 'tecnica');
assert.equal(Cap.tipoSesion({ ...fondo, enfoque: 'calorias' }, 200), 'calorias');
assert.equal(Cap.tipoSesion({ ...fondo, pruebaWatts: 210 }, 200), 'prueba');

// ---------- Análisis ----------
const a = Cap.analisisSesion({ ...fondo, fcRec60: 25 }, { ftp: 200, fcMax: 190 });
assert.equal(a.tipo, 'fondo');
assert.equal(a.datos.length, 4);
assert.match(a.datos[0].valor, /132 lpm · Z2/);
assert.equal(a.datos.at(-1).valor, "25 lpm");
assert.ok(a.lectura.length > 10);
const u = Cap.analisisSesion(umbral, { ftp: 200 });
assert.equal(u.datos[0].valor, '20 min');
assert.match(u.lectura, /bien ejecutado/);
for (const s of [vo2, sprint, { ...fondo, enfoque: 'calorias' }, { ...fondo, enfoque: 'tecnica' }, { ...fondo, pruebaWatts: 210 }]) {
  assert.equal(Cap.analisisSesion(s, { ftp: 200 }).datos.length, 3);
}

// ---------- Capacidades ----------
// Hace 2 meses: 130 W a 133 lpm. Ahora: 150 W al mismo pulso. FTP de 190 a 200.
const viejas = [sesion(60, 1800, () => ({ w: 130, fc: 133 }), { ftp: 190, fcRec60: 18 }), sesion(55, 600, () => ({ w: 230 }), { ftp: 190 })];
const nuevas = [sesion(5, 1800, () => ({ w: 150, fc: 133 }), { ftp: 200, fcRec60: 24 }), sesion(3, 600, () => ({ w: 250 }), { ftp: 200 })];
const caps = Cap.capacidades([...viejas, ...nuevas], { ftp: 200, peso: 75, fcMax: 190, ahora });
const c = Object.fromEntries(caps.map((x) => [x.clave, x]));
assert.equal(c.base.valor, 150);
assert.equal(c.base.antes, 130);
assert.equal(c.base.mejora, true);
assert.equal(c.umbral.valor, 200);
assert.equal(c.umbral.cambio, 10);
assert.equal(c.vo2.valor, 43);
assert.ok(c.vo2.antes < 43);
assert.equal(c.recuperacion.valor, 24);
assert.equal(c.recuperacion.mejora, true);
assert.equal(c.tecnica.valor, 10.91);
assert.equal(c.base.como, 'Watts a 133 lpm');
const sinPulso = Cap.capacidades(nuevas, { ftp: 200, peso: 75, fcMax: 0, ahora });
assert.equal(sinPulso.find((x) => x.clave === 'base').valor, null);
assert.equal(Cap.capacidades([], { ahora }).every((x) => x.valor == null), true);

// ---------- Series semanales ----------
const motor = Cap.motorSemanal([...viejas, ...nuevas], 133, 10, ahora);
assert.equal(motor.length, 10);
assert.equal(motor.filter((m) => m.w).length, 2);
assert.equal(motor.at(-2).w, 150); // las sesiones de hace 3 y 5 días caen en la semana pasada
const gasto = Cap.gastoSemanal(nuevas, 4, ahora);
assert.equal(gasto.at(-2).kcal, 400);
const curvas = Cap.curvasComparadas([...viejas, ...nuevas], ahora);
assert.equal(curvas.ahora.find((p) => p.segs === 300).w, 250);
assert.equal(curvas.antes.find((p) => p.segs === 300).w, 230);

console.log('capacidades OK');

// ---------- Tipo del plan antes de remar ----------
const bloque = (min, max, metrica = 'ftp') => ({ nombre: 'Trabajo', duracion: 60, metrica, min, max });
const cal = { nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 70 };
assert.equal(Cap.tipoPlan(null), null);
assert.equal(Cap.tipoPlan({ bloques: [cal, bloque(110, 120)] }), 'vo2');
assert.equal(Cap.tipoPlan({ bloques: [cal, bloque(130, 160)] }), 'sprint');
assert.equal(Cap.tipoPlan({ bloques: [cal, bloque(91, 105)] }), 'umbral');
assert.equal(Cap.tipoPlan({ bloques: [cal, bloque(56, 75)] }), 'fondo');
assert.equal(Cap.tipoPlan({ bloques: [cal, bloque(20, 22, 'spm')] }), 'tecnica');
assert.equal(Cap.tipoPlan({ tipo: 'objetivo', objetivo: { metrica: 'kcal', valor: 300 } }), 'calorias');
assert.equal(Cap.tipoPlan({ tipo: 'objetivo', objetivo: { metrica: 'distancia', valor: 5000 } }), 'fondo');
assert.equal(Cap.tipoPlan({ pruebaFtp: true, bloques: [] }), 'prueba');
for (const claves of Object.values(Cap.CASILLAS_REMO)) assert.equal(claves.length, 5);
console.log('tipo de plan OK');

// Historial de capacidades, estado del cuerpo y recuperación.
{
  const DIA = 864e5;
  const ahora = Date.parse('2026-11-03T18:00');
  const mu = (segs, w) => Array.from({ length: segs }, (_, t) => ({ t, w, spm: 22, dist: t * 4 }));
  const s = (d, segs, w) => ({ fecha: ahora - d * DIA, duracion: segs, distancia: segs * 4, paladas: segs / 3, muestras: mu(segs, w), ftp: 200 });
  // 12 semanas de fondos que van subiendo de 130 a 160 W
  const ses = Array.from({ length: 40 }, (_, i) => s(84 - i * 2, 1800, 130 + Math.round(i * 0.75)));
  const h = Cap.historialCapacidades(ses, { ftp: 200, peso: 75, fcMax: 185, ahora });
  assert.equal(h.potencia.length, 12);
  const pot = h.potencia.filter((p) => p.valor != null).map((p) => p.valor);
  assert.ok(pot.at(-1) > pot[0], 'la potencia sube en el historial');
  const caps = Cap.capacidades(ses, { ftp: 200, peso: 75, ahora });
  const p = caps.find((c) => c.clave === 'potencia');
  assert.ok(p.pct > 0 && Number.isInteger(p.pct), `pct ${p.pct}`);
  assert.ok(caps.every((c) => c.entrena), 'cada capacidad dice cómo subirla');

  // Recuperación por carga de una sesión
  assert.equal(Cap.horasPorCarga(0), 0);
  assert.equal(Cap.horasPorCarga(50), 16);
  assert.equal(Cap.horasPorCarga(120), 36);
  assert.equal(Cap.textoRecuperacion(0), 'Listo para entrenar');
  assert.equal(Cap.textoRecuperacion(20), 'Recuperado en unas 20 h');
  assert.equal(Cap.textoRecuperacion(48), 'Recuperado en unos 2 días');

  // Rutina regular y un día de descanso: listo o fresco, sin horas pendientes.
  const regular = ses.filter((x) => x.fecha < ahora - 1.5 * DIA);
  const e1 = Cap.estadoCuerpo(regular, 200, ahora);
  assert.ok(['listo', 'fresco'].includes(e1.clave), e1.clave);
  assert.equal(e1.horas, 0);
  assert.ok(e1.seguro && e1.seguro.max > e1.seguro.min);
  // Tres días seguidos de 2 h fuertes: muy cansado, con días de recuperación y carga por encima de lo seguro.
  const duro = [...regular, ...[2, 1, 0.1].map((d) => s(d, 7200, 210))];
  const e2 = Cap.estadoCuerpo(duro, 200, ahora);
  assert.equal(e2.clave, 'agotado');
  assert.ok(e2.horas >= 48 && e2.horas <= 96, `horas ${e2.horas}`);
  assert.equal(Cap.textoRecuperacion(96), 'Necesitas unos 4 días suaves');
  assert.ok(e2.semana > e2.seguro.max);
  // Una sesión dura de hoy manda aunque la tendencia diga fresco.
  const e3 = Cap.estadoCuerpo([...regular, s(0.05, 3600, 230)], 200, ahora);
  assert.ok(e3.horas >= 12 && e3.clave !== 'fresco' && e3.clave !== 'listo', `${e3.clave} ${e3.horas}`);
  assert.equal(Cap.estadoCuerpo([], 200, ahora), null);
  console.log('cuerpo OK', e1.clave, e2.clave, e2.horas, e3.clave, e3.horas);
}
