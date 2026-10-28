import assert from 'node:assert/strict';
import * as C from '../consejos.js';
import * as J from '../juego.js';
import * as B from '../base.js';

const bases = B.entrenamientosBase(10, 180);
const porId = (id) => bases.find((x) => x.id === id);
const opc = { ftp: 180, clase: 'samurai', ctx: { pctMedio: 62, mppPromedio: 9.5, racha: 1 } };

// Previsión: VO2 máx sube Agilidad; Fondo no; el rango y el esfuerzo dan extras con puntos.
{
  const vo2 = C.prevision(porId('base:pot-mejora'), opc);
  assert.ok(vo2.seguro.agilidad > 20, 'VO2 máx sube mucho la Agilidad');
  assert.equal(vo2.principal, 'agilidad');
  const fondo = C.prevision(porId('base:dis-mant'), opc);
  assert.ok(!fondo.seguro.agilidad, 'Fondo no sube Agilidad');
  assert.ok(fondo.seguro.resistencia > 10, 'Fondo sube Resistencia');
  assert.ok(fondo.extras.length <= 3 && fondo.extras.every((x) => x.puntos >= 1 && x.titulo), 'extras con puntos');
  const rango = C.prevision(porId('base:rit-mant'), opc).extras.find((x) => x.clave === 'rango');
  assert.ok(rango && rango.atributo === 'tecnica', 'mantener el rango suma Técnica');
  assert.equal(fondo.riesgo.puntos, -Math.round(3 * 1), 'dejarlo a medias quita el bono de Voluntad');
}
// El atributo débil va primero en los extras.
{
  const p = C.prevision(porId('base:dis-mant'), { ...opc, debil: 'agilidad' });
  assert.equal(p.extras[0].atributo, 'agilidad');
}
// Prueba 500 m: el bono de 2:30 no se da por seguro, se ofrece como extra.
{
  const p = C.prevision(porId('base:prueba-500'), opc);
  assert.ok(!p.seguro.agilidad, 'sin bono seguro');
  assert.ok(p.extras.some((x) => x.clave === '500' && x.puntos === 5));
}
// Remo libre: sin bono por terminar ni riesgo.
{
  const p = C.prevision({ nombre: 'Remo libre', tipo: 'objetivo', objetivo: { metrica: 'distancia', valor: 5000 } }, { ...opc, libre: true });
  assert.equal(p.riesgo, null);
}
// Ranking: para Agilidad gana VO2 máx; los que solo suben con un extra van después y lo dicen.
{
  const r = C.mejoresPara('agilidad', bases, opc);
  assert.equal(r[0].ent.id, 'base:pot-mejora');
  const i500 = r.findIndex((x) => x.ent.id === 'base:prueba-500');
  assert.ok(i500 > 0 && r[i500].si, 'la Prueba 500 m aparece con su condición');
}
// En vivo: puntos al día y un reto que no te saca de tu rango.
{
  const muestras = Array.from({ length: 300 }, (_, i) => ({ t: i + 1, w: i < 150 ? 120 : 200, spm: 24, dist: i * 4 }));
  const v = C.enVivo(muestras, { ftp: 180, clase: 'samurai' });
  assert.equal(v.reto.atributo, 'agilidad', 'por encima de 191 W el reto es Agilidad');
  assert.ok(v.puntos.agilidad >= 7 && v.reto.faltanSeg > 0);
  const enTramo = C.enVivo(muestras, { ftp: 180, rango: { min: 100, max: 135 }, pct: 50 });
  assert.equal(enTramo.reto.atributo, 'tecnica', 'fuera del tramo suave: vuelve al rango');
  assert.match(enTramo.reto.titulo, /Vuelve a tu rango: 100–135 W/);
}
// Al terminar: logros y cosas que quedaron cerca.
{
  const muestras = Array.from({ length: 1100 }, (_, i) => ({ t: i + 1, w: 170, spm: 24, dist: i * 4 }));
  const s = { fecha: Date.now(), duracion: 1100, distancia: 4400, muestras, wattsProm: 170, tiempoMeta: null, entrenamiento: 'Umbral', pctEnRango: 60, paladas: 450, rpe: null };
  const r = C.analisis(s, { ftp: 180, ctx: { mppPromedio: 9.9 } });
  const titulos = r.cerca.map((x) => x.titulo).join(' | ');
  assert.ok(r.logros.some((x) => x.atributo === 'fuerza'), 'minutos en zona 4');
  assert.ok(r.cerca.length > 0 && r.cerca.length <= 3, titulos);
  assert.ok(r.cerca.every((x) => x.puntos >= 1));
}
// Meta semanal de atributo desde el 26 de octubre de 2026, sobre tu atributo más bajo.
{
  assert.equal(J.atributoDeLaSemana({ fuerza: 10, agilidad: 2, resistencia: 30, recuperacion: 0, tecnica: 5, voluntad: 9 }), 'agilidad', 'sin pulso no elige Recuperación');
  assert.equal(J.atributoDeLaSemana({ fuerza: 10, agilidad: 2, resistencia: 30, recuperacion: 0, tecnica: 5, voluntad: 9 }, { sinPulso: false }), 'recuperacion');
  assert.equal(J.atributoDeLaSemana({}), null);
  const antes = J.misionesDeSemana('2026-10-19', 'samurai', null, 'agilidad');
  assert.ok(!antes.some((m) => m.clave === 'atributo'), 'antes de la fecha no hay meta');
  const sem = J.misionesDeSemana('2026-11-02', 'samurai', null, 'agilidad');
  const sinAtr = J.misionesDeSemana('2026-11-02', 'samurai', null, null);
  const m = sem.find((x) => x.clave === 'atributo');
  assert.ok(m && m.meta === J.META_ATRIBUTO.agilidad && m.xp === 150);
  assert.deepEqual(sem.slice(0, -1).map((x) => x.id), sinAtr.map((x) => x.id), 'las demás misiones no cambian');
}
// Títulos por atributo.
{
  assert.deepEqual(J.tituloAtributo('fuerza', 10), { actual: null, siguiente: { nombre: 'Aprendiz de la fuerza', meta: 50, faltan: 40 } });
  assert.equal(J.tituloAtributo('tecnica', 420).actual, 'Experto de la técnica');
  assert.equal(J.tituloAtributo('voluntad', 3000).siguiente, null);
}
console.log('consejos: ok');
