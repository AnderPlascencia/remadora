import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as F from '../src/fantasma.js';
import * as O from '../src/objetos.js';

// Etapa 9: rivales justos, historia por nivel con jefes de varias formas, metas largas y nombres sin repetir.
const FTP = 200;
const dia = (k, h = 18) => new Date(`${k}T${String(h).padStart(2, '0')}:00`).getTime();
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// ---------- 1. Rivales justos ----------
// Metas de distancia: curva validada con el entrenador, interpolada sobre el logaritmo de la distancia.
assert.equal(F.relDistancia(500), 1.35);
assert.equal(F.relDistancia(300), 1.35, 'por debajo de 500 m, como el 500 m');
assert.equal(F.relDistancia(1000), 1.25);
assert.equal(F.relDistancia(2000), 1.12);
assert.equal(F.relDistancia(5000), 1.0);
assert.equal(F.relDistancia(42195), 0.85, 'por encima de 21 km se queda en el 85 %');
cerca(F.relDistancia(2001), 1.12, 0.001, 'sin escalón tras los 2000 m');
cerca(F.relDistancia(5001), 1.0, 0.001, 'sin escalón tras los 5000 m');
assert.ok(F.relDistancia(1500) < 1.25 && F.relDistancia(1500) > 1.12);
assert.equal(F.relDistancia(500, 1.15), 1.15, 'con FTP estimado lo corto se queda en el 115 %');
assert.equal(F.relDistancia(10000, 1.15), 0.92, 'el tope no sube lo largo');
// El fantasma rema el 2000 m cerca del 112 % de su FTP (el ruido y el estilo lo mueven poco).
{
  const r = F.simular({ nombre: '2000 m', tipo: 'objetivo', objetivo: { metrica: 'distancia', valor: 2000 } }, { ftp: FTP }, FTP);
  const media = r.muestras.reduce((a, x) => a + x.w, 0) / r.muestras.length;
  cerca(media / FTP, 1.12, 0.02, 'potencia media del rival en 2000 m');
  const conTope = F.simular({ nombre: '500 m', tipo: 'objetivo', objetivo: { metrica: 'distancia', valor: 500 } }, { ftp: FTP, tope: 1.15 }, FTP);
  cerca(conTope.muestras.reduce((a, x) => a + x.w, 0) / conTope.muestras.length / FTP, 1.15, 0.02, '500 m con FTP estimado');
}

// Remo libre: mediana de tus remos libres de 10 min o más de las últimas 6 semanas, en vatios equivalentes.
{
  const ahora = dia('2026-11-20');
  const libre = (k, min, metros, extra = {}) => ({ fecha: dia(k), duracion: min * 60, distancia: metros, ...extra });
  const w = (min, metros) => 2.8 * (metros / (min * 60)) ** 3;
  const lista = [
    libre('2026-11-02', 20, 4000), libre('2026-11-05', 30, 6600), libre('2026-11-10', 15, 3300),
    libre('2026-11-12', 5, 1500), // menos de 10 min: no cuenta
    libre('2026-11-13', 30, 9000, { entrenamiento: 'Umbral' }), // no es Remo libre
    libre('2026-09-01', 30, 9000), // hace más de 6 semanas
  ];
  assert.equal(J.ritmoLibre(lista, ahora), Math.round(w(30, 6600)), 'mediana de los tres válidos');
  assert.equal(J.ritmoLibre([], ahora), null);
  const base = { miClase: 'samurai', ftp: FTP, lunes: '2026-11-16', semilla: 'x' };
  const ritmo = 120;
  const costa = J.rivalesPara(3, { ...base, dificultad: 'costa', ritmo });
  assert.equal(costa[0].ftp, Math.round(ritmo / 0.8), 'en Costa el rival de la semana rema a tu ritmo');
  assert.deepEqual(costa.map((r) => r.ftp), [150, Math.round(150 * 0.97), Math.round(150 * 1.03)], 'los otros dos ±3 %');
  assert.equal(J.rivalesPara(1, { ...base, dificultad: 'bahia', ritmo })[0].ftp, Math.round(150 * 0.94));
  assert.equal(J.rivalesPara(1, { ...base, dificultad: 'altamar', ritmo })[0].ftp, Math.round(150 * 1.04));
  // Sin historial libre, como antes: del FTP.
  assert.equal(J.rivalesPara(1, { ...base, dificultad: 'costa' })[0].ftp, FTP);
  // El rival ya no lleva rango en el nombre (el retrato sí usa uno).
  for (const r of costa) {
    assert.match(r.nombre, /^[^()]+ \((Vikingo|Pirata|Polinesio|Romano)\)$/);
    assert.ok(J.RANGOS.some((x) => x.id === r.rango));
    assert.ok(J.CLASIFICACIONES.some((x) => x.nombre === r.clasificacion));
  }
}

// XP de fantasma según el margen sobre lo remado.
assert.equal(J.factorMargen(40, 2000), 1.5, '2 %');
assert.equal(J.factorMargen(100, 2000), 1, '5 %');
assert.equal(J.factorMargen(150, 2000), 0.75, '7,5 %');
assert.equal(J.factorMargen(400, 2000), 0.5, '20 %: una paliza paga la mitad');
{
  const carrera = (k, diferencia, reglasXp) => ({
    fecha: dia(k), duracion: 600, distancia: 2000, ftp: FTP, wattsProm: 150, reglasXp, entrenamiento: '2000 m', tiempoMeta: 600,
    rival: { nombre: 'Björn (Vikingo)', clase: 'vikingo', dificultad: 'altamar', diferencia },
  });
  const xpFantasma = (s) => {
    const h = J.estadoJuego([s], { ftp: FTP, ahora: s.fecha + 1e6 });
    return h.porSesion.get(s.fecha).detalle.find(([t]) => t.startsWith('Fantasma'))?.[1];
  };
  // Alta mar = 40, a la mitad por la XP lenta: reñida 30, paliza 10.
  assert.equal(xpFantasma(carrera('2026-11-09', 20, 3)), 30);
  assert.equal(xpFantasma(carrera('2026-11-09', 500, 3)), 10);
  assert.equal(xpFantasma(carrera('2026-11-09', 500, 2)), 20, 'una sesión con reglas de la etapa 6 no cambia');
}

// ---------- 5. Récords: 40 XP cada uno, hasta 120 ----------
{
  const muestras = (w, seg) => {
    const v = Math.cbrt(w / 2.8);
    return Array.from({ length: seg }, (_, t) => ({ t: t + 1, w, spm: 24, split: Math.round(500 / v), dist: Math.round((t + 1) * v * 10) / 10 }));
  };
  const s = (k, w, reglasXp) => {
    const m = muestras(w, 1500);
    return { fecha: dia(k), duracion: 1500, distancia: m.at(-1).dist, ftp: FTP, wattsProm: w, muestras: m, reglasXp };
  };
  const records = (reglasXp) => {
    const a = s('2026-11-09', 120, reglasXp);
    const b = s('2026-11-10', 170, reglasXp);
    const h = J.estadoJuego([a, b], { ftp: FTP, ahora: b.fecha + 1e6 });
    return h.porSesion.get(b.fecha).detalle.find(([t]) => /[Rr]écord/.test(t));
  };
  const [texto, xp] = records(3);
  assert.match(texto, /récords personales/);
  assert.equal(xp, J.XP_RECORD_TOPE, 'muchos récords a la vez topan en 120');
  assert.deepEqual(records(2), ['Récord personal', 50], 'con las reglas de la etapa 6, 50 fijos');
}

// ---------- 2. Historia ----------
assert.equal(J.CAPITULOS.length, 9, 'un capítulo por rango');
J.CAPITULOS.forEach((c, i) => {
  assert.ok(c.nivel >= J.RANGOS[i].nivel, `${c.nombre} se abre por nivel`);
  assert.ok(O.objeto(c.objeto)?.rareza === 'epica', `${c.nombre}: objeto épico exclusivo`);
});
assert.equal(new Set(J.CAPITULOS.map((c) => c.objeto)).size, 9, 'objetos sin repetir');
assert.equal(new Set(J.CAPITULOS.map((c) => c.jefe.nombre)).size, 9, 'jefes sin repetir');
assert.ok(J.CAPITULOS.find((c) => c.nombre === 'Mar abierto').req.includes(J.REQ_MAR_ABIERTO), 'la racha de Mar abierto está aislada (D3)');
{
  // Historial viejo (septiembre, XP completa): 14 remos de 5 km suben a nivel 20 o más.
  const viejo = Array.from({ length: 14 }, (_, i) => ({ fecha: dia(`2026-09-${String(i + 1).padStart(2, '0')}`), duracion: 1500, distancia: 5000, ftp: FTP, wattsProm: 150 }));
  const p500 = (k, reglasXp) => ({ fecha: dia(k), duracion: 100, distancia: 500, ftp: FTP, wattsProm: 300, entrenamiento: 'Prueba 500 m', tiempoMeta: 100, reglasXp });
  // Migración: un capítulo ganado con las reglas viejas se conserva, con su XP de antes.
  const legado = J.estadoJuego([...viejo, p500('2026-09-20')], { ftp: FTP, ahora: dia('2026-09-21') });
  assert.equal(legado.capitulosHechos, 1);
  assert.equal(legado.logros.find((l) => l.tipo === 'jefe').xp, 150);
  assert.ok(legado.nivel >= 20);
  // El capítulo 2 pide minutos en zona 2 que estas sesiones no tienen, pero se abre por nivel.
  assert.equal(legado.capitulo.n, 2);
  assert.ok(legado.capitulo.listo && legado.capitulo.porNivel);
  // Con las reglas viejas, ganar en Alta mar no vencía al jefe…
  const altamar = (k, reglasXp, diferencia = 30) => ({
    fecha: dia(k), duracion: 1200, distancia: 4000, ftp: FTP, wattsProm: 150, reglasXp, tiempoMeta: 1200, entrenamiento: '4000 m',
    rival: { nombre: 'Kenji (Samurái)', clase: 'samurai', dificultad: 'altamar', diferencia },
  });
  assert.equal(J.estadoJuego([...viejo, p500('2026-09-20'), altamar('2026-09-25')], { ftp: FTP }).capitulosHechos, 1);
  // …con las de la etapa 9, sí: es un hito con su XP (1300 a la mitad), su insignia y la marca para el resumen.
  const nueva = altamar('2026-11-09', 3);
  const h = J.estadoJuego([...viejo, p500('2026-09-20'), nueva], { ftp: FTP, ahora: nueva.fecha + 1e6 });
  assert.equal(h.capitulosHechos, 2);
  const jefe = h.logros.find((l) => l.tipo === 'jefe' && l.fecha === nueva.fecha);
  assert.equal(jefe.xp, 650);
  assert.equal(jefe.objeto, 'sombrero-capitan');
  assert.deepEqual(h.porSesion.get(nueva.fecha).jefe, { capitulo: 2, nombre: 'La Serpiente del río', objeto: 'sombrero-capitan' });
  // La sesión clave del plan cumplida también vence al jefe.
  const clave = { fecha: dia('2026-11-09'), duracion: 2700, distancia: 9000, ftp: FTP, wattsProm: 180, reglasXp: 3, entrenamiento: 'Umbral', delPrograma: true, delDia: 'plan', tiempoMeta: 2700, tipoPlan: 'umbral', pctEnRango: 80, pctAlto: 10, pctBajo: 10 };
  assert.ok(J.esSesionClave(clave));
  assert.equal(J.estadoJuego([...viejo, p500('2026-09-20'), clave], { ftp: FTP }).capitulosHechos, 2);
  assert.ok(!J.esSesionClave({ ...clave, tipoPlan: 'fondo' }), 'un fondo no es la sesión clave');
  assert.ok(!J.esSesionClave({ ...clave, pctEnRango: 50, pctAlto: 0, pctBajo: 50 }), 'terminada sin cumplir no vale');
}
{
  // Una prueba hecha antes de abrir el capítulo se guarda: el capítulo cae en cuanto se abre.
  const s = (k, extra = {}) => ({ fecha: dia(k), duracion: 600, distancia: 1500, ftp: FTP, wattsProm: 150, reglasXp: 3, ...extra });
  const prueba = s('2026-11-09', { distancia: 500, duracion: 100, entrenamiento: 'Prueba 500 m', tiempoMeta: 100 });
  const antes = J.estadoJuego([prueba], { ftp: FTP, ahora: prueba.fecha + 1e6 });
  assert.equal(antes.capitulosHechos, 0, '1 sesión y 0,5 km: el capítulo 1 aún no se abre');
  assert.ok(antes.capitulo.pendiente);
  const despues = J.estadoJuego([prueba, s('2026-11-10', { distancia: 3000 })], { ftp: FTP });
  assert.equal(despues.capitulosHechos, 1, 'con la segunda sesión se cumplen los requisitos y el jefe ya estaba vencido');
  assert.equal(despues.capitulo.pendiente, false);
}

// ---------- 3. Logros escalonados ----------
{
  const ids = new Set(J.HAZANAS.map((h) => h.id));
  for (const id of ['km250', 'km500', 'km1000', 'km2500', 'ses50', 'ses100', 'ses250', 'ses500', 'nivel40', 'nivel60', 'nivel80', 'semanas10', 'semanas20', 'ftp10', 'ftp25']) assert.ok(ids.has(id), id);
  assert.equal(ids.size, J.HAZANAS.length, 'ids sin repetir');
  assert.equal(new Set(J.HAZANAS.map((h) => h.nombre)).size, J.HAZANAS.length, 'nombres sin repetir');
  // «Aprendiz · nivel 10» ya no se ofrece con las reglas nuevas…
  const nuevas = Array.from({ length: 30 }, (_, i) => ({ fecha: dia('2026-11-09') + i * 864e5, duracion: 3600, distancia: 12000, ftp: FTP + (i >= 20 ? 12 : 0), wattsProm: 150, reglasXp: 3 }));
  const h = J.estadoJuego(nuevas, { ftp: FTP, ahora: nuevas.at(-1).fecha + 1e6 });
  assert.ok(h.nivel >= 10);
  assert.ok(!h.hazanas.some((x) => x.id === 'nivel10'), 'oculto y sin pagar con las reglas nuevas');
  assert.ok(h.hazanas.find((x) => x.id === 'km250').hecha, '360 km');
  assert.ok(h.hazanas.find((x) => x.id === 'ftp10').hecha, 'el FTP subió 12 W');
  assert.ok(!h.hazanas.find((x) => x.id === 'ftp25').hecha);
  // …pero quien lo ganó con las reglas viejas lo conserva.
  const viejas = nuevas.map((s, i) => ({ ...s, fecha: dia('2026-09-01') + i * 864e5, reglasXp: undefined }));
  const v = J.estadoJuego(viejas, { ftp: FTP, ahora: viejas.at(-1).fecha + 1e6 });
  assert.ok(v.hazanas.find((x) => x.id === 'nivel10')?.hecha);
}

// ---------- 4. Nombres: épicos para el rango, náuticos para la tripulación, sin repetir ----------
{
  const rangos = J.RANGOS.map((r) => r.nombre);
  const tripulacion = J.CLASIFICACIONES.map((c) => c.nombre);
  const atributos = J.TITULOS_ATRIBUTO.map(([, t]) => t);
  const todos = [...rangos, ...tripulacion, ...atributos];
  assert.equal(new Set(todos).size, todos.length, `sin repetidos: ${todos.join(', ')}`);
  for (const r of rangos) assert.ok(!J.HAZANAS.some((h) => h.nombre === r), `${r} no es también un logro`);
}

console.log('etapa9 OK');
