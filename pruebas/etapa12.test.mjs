import assert from 'node:assert/strict';
import * as J from '../src/juego.js';
import * as T from '../src/talentos.js';
import * as Tec from '../src/tecnica.js';
import { PAISAJES, VELAS, comprarVelas, tieneVelas, velasElegidas } from '../src/carrera.js';
import { registrada } from '../src/ajustes-guardados.js';
import { PERFILES } from './etapa12.perfiles.mjs';

// Etapa 12: misiones con peso, clases igualadas, monedas y colección, atributos de 6 semanas y Técnica nueva.
const FTP = 200;
const dia = (k, h = 18) => new Date(`${k}T${String(h).padStart(2, '0')}:00`).getTime();

// ---------- Técnica (fórmula del entrenador) ----------
// Muestras a 1 Hz: potencia w ± ruido (fracción) y cadencia spm ± desv.
const muestras = (seg, { w = 150, ruido = 0.03, spm = 24, dspm = 0.5, desde = 0 } = {}) => Array.from({ length: seg }, (_, i) => {
  const t = desde + i + 1;
  return { t, w: Math.round(w * (1 + ruido * Math.sin(t * 1.7))), spm: Math.round(spm + dspm * Math.sin(t * 0.9)), dist: t * 4, split: 125 };
});
{
  const parejo = { muestras: muestras(1200), ftp: FTP };
  const t = Tec.tecnicaDeSesion(parejo);
  assert.equal(t.ventanas, 39, '20 min sin los primeros 20 s = 39 ventanas de 30 s');
  assert.ok(t.tecnicas >= 38, `remo parejo: ${t.tecnicas}`);
  assert.ok(t.puntos > 11 && t.puntos <= 0.6 * 20 + 3, `${t.puntos}`);
  const irregular = Tec.tecnicaDeSesion({ muestras: muestras(1200, { ruido: 0.2 }), ftp: FTP });
  assert.equal(irregular.tecnicas, 0, 'la potencia que sube y baja un 20 % no es técnica');
  const cadencia = Tec.tecnicaDeSesion({ muestras: muestras(1200, { spm: 22, dspm: 4 }), ftp: FTP });
  assert.equal(cadencia.tecnicas, 0, 'cadencia que baila 4 golpes/min');
  // A 30 golpes/min, ±1,7 entra por el margen del 6 %.
  assert.ok(Tec.tecnicaDeSesion({ muestras: muestras(1200, { spm: 30, dspm: 2.4 }), ftp: FTP }).tecnicas > 30);
  const flojo = Tec.tecnicaDeSesion({ muestras: muestras(1200, { w: 100 }), ftp: FTP });
  assert.equal(flojo.ventanas, 0, 'por debajo del 55 % del FTP no cuenta');
  // Sin FTP: el 70 % de la mediana de la sesión.
  assert.ok(Tec.tecnicaDeSesion({ muestras: muestras(1200, { w: 100 }) }).tecnicas > 30);
  // Tope de 30 min técnicos: un fondo de 90 min no la dispara.
  const largo = Tec.tecnicaDeSesion({ muestras: muestras(5400), ftp: FTP });
  assert.equal(largo.minutos, Tec.TOPE_MIN);
  assert.equal(largo.puntos, 30 * 0.6 + 3);
  // Huecos o paladas a 0 dejan fuera su ventana.
  const conHueco = muestras(1200).filter((x) => x.t < 400 || x.t > 410);
  assert.ok(Tec.tecnicaDeSesion({ muestras: conHueco, ftp: FTP }).ventanas < 39);
  // Bloques: se quitan los primeros 20 s de cada uno, los de menos de 60 s y los descansos.
  const bloques = [
    { nombre: 'Serie', metrica: 'ftp', min: 85, max: 95, duracion: 140 }, // 20 s + 4 ventanas
    { nombre: 'Descanso', duracion: 60 },
    { nombre: 'Sprint', metrica: 'ftp', min: 120, max: 150, duracion: 30 },
    { nombre: 'Fuerza', metrica: 'ftp', min: 88, max: 95, spmMeta: [18, 20], duracion: 200 }, // 6 ventanas
  ];
  const s = { muestras: muestras(430, { w: 180 }), ftp: FTP, bloques };
  const tb = Tec.tecnicaDeSesion(s);
  assert.equal(tb.ventanas, 10);
  assert.equal(tb.tecnicas, 4, 'a 24 golpes/min no cumple la cadencia de 18–20 que pide Fuerza');
  const s18 = { ...s, muestras: muestras(430, { w: 180, spm: 19 }) };
  assert.equal(Tec.tecnicaDeSesion(s18).tecnicas, 10, 'remando a 19 sí');
  // En el juego: desde la etapa 12 la Técnica sale de aquí (antes, del rango y los metros por palada).
  const nueva = { fecha: dia('2026-11-10'), duracion: 1200, distancia: 4800, paladas: 480, wattsProm: 150, ftp: FTP, muestras: muestras(1200), pctEnRango: 0 };
  const a = J.atributosDeSesion(nueva, { ftp: FTP });
  assert.ok(Math.abs(a.tecnica - Tec.tecnicaDeSesion(nueva).puntos) < 1e-9);
  const vieja = { ...nueva, fecha: dia('2026-11-01'), pctEnRango: 50 };
  assert.ok(Math.abs(J.atributosDeSesion(vieja, { ftp: FTP }).tecnica - 20 * 0.5 * 0.6) < 0.01, 'las sesiones anteriores no cambian');
}

// ---------- Clases igualadas: unos 50 XP reales (100 nominales) por sesión con el perfil típico ----------
{
  const lleno = { m1: 3, m2: 3, m3: 3, m4: 3, maestria: 3 };
  for (const [clase, lista] of Object.entries(PERFILES)) {
    const media = lista.reduce((a, d) => a + T.xpTalentos(clase, lleno, d).reduce((x, [, v]) => x + v, 0), 0) / lista.length;
    assert.ok(media * J.FACTOR_XP_LENTA >= 45 && media * J.FACTOR_XP_LENTA <= 55, `${clase}: ${media * J.FACTOR_XP_LENTA} XP reales`);
  }
  // Las sesiones anteriores a la etapa 12 siguen con los valores de antes.
  assert.equal(T.valorDe('vikingo', 'm2', 3, true), 3);
  assert.equal(T.valorDe('vikingo', 'm2', 3), 7);
}

// ---------- Misiones ----------
{
  const rit = { metros: 5000, min: 30, conRango: true, conPlan: true, conPulso: true, kcal: 300, kcalSemana: 900, sesSemana: 3, kmSemana: 15 };
  const grupo = { plan: 'plan', suave: 'plan', deldia: 'plan', parejo: 'tec', ritmo: 'tec', rango: 'tec', fantasma: 'juego', renida: 'juego', altamar: 'juego' };
  for (let d = 4; d <= 30; d++) {
    const k = `2026-11-${String(d).padStart(2, '0')}`;
    const l = J.misionesDelDia(k, rit, { planHoy: d % 3 ? 'Umbral' : '' });
    assert.equal(l.length, 3, k);
    assert.deepEqual(l.map((m) => grupo[m.clave]), ['plan', 'tec', 'juego'], `una de cada grupo, sin dos casi iguales: ${k}`);
    // De ⅓ a ½ sesión de XP (una sesión típica da unos 300 reales; se pagan a la mitad).
    for (const m of l) assert.ok(m.xp * J.FACTOR_XP_LENTA >= 85 && m.xp * J.FACTOR_XP_LENTA <= 150, `${m.clave}: ${m.xp}`);
  }
  assert.equal(J.misionesDelDia('2026-11-10', rit, { planHoy: 'Umbral' })[0].clave, 'plan');
  assert.match(J.misionesDelDia('2026-11-10', rit, { planHoy: 'Umbral' })[0].texto, /«Umbral»/);
  assert.equal(J.misionesDelDia('2026-11-10', rit, { planHoy: '' })[0].clave, 'suave', 'en un descanso del plan, solo remo suave');
  assert.equal(J.misionesDelDia('2026-11-10', null)[0].clave, 'deldia', 'sin plan, la sesión que sugiere la app');
  assert.equal(J.misionesDelDia('2026-11-03', rit).length, 5, 'los días anteriores no cambian');
  // Semanales en la misma línea: plan, técnica, rival y clase, cada una de una sesión de XP.
  const sem = J.misionesDeSemana('2026-11-09', 'vikingo', rit);
  assert.deepEqual(sem.map((m) => m.clave), ['semplan', 'semparejo', 'rival', 'nordica']);
  assert.ok(sem.every((m) => m.xp === J.XP_MISION_SEMANAL));
  assert.equal(J.misionesDeSemana('2026-11-02', 'vikingo', rit)[0].clave, 'ruta', 'la semana en curso no cambia');
  // Una sesión del plan cumplida, pareja y con un fantasma vencido por poco completa las tres del día.
  const k = '2026-11-10';
  const s = { fecha: dia(k), duracion: 1800, distancia: 7000, paladas: 720, wattsProm: 150, ftp: FTP, muestras: muestras(1800), reglasXp: 3,
    entrenamiento: 'Umbral', delPrograma: true, delDia: 'plan', tiempoMeta: 1800, tipoPlan: 'umbral', pctEnRango: 85, pctAlto: 10, pctBajo: 5,
    rival: { nombre: 'Kenji (Samurái)', clase: 'samurai', dificultad: 'altamar', diferencia: 60 } };
  const h = J.estadoJuego([s], { ftp: FTP, calendario: { [k]: 'Umbral' }, ahora: s.fecha + 3600e3 });
  assert.ok(h.diarias.every((m) => m.hecha), h.diarias.map((m) => `${m.clave}:${m.valor}/${m.meta}`).join(' '));
}

// ---------- Monedas y colección ----------
{
  const nuevos = Object.values(PAISAJES).filter((p) => p.base);
  assert.ok(nuevos.length >= 6);
  for (const p of [...Object.values(PAISAJES).filter((x) => x.precio), ...Object.values(VELAS)]) assert.ok(p.precio >= 400 && p.precio <= 3000, `${p.nombre}: ${p.precio}`);
  assert.ok(Object.values(VELAS).length >= 5);
  const per = { velas: [], gastado: 100 };
  assert.equal(comprarVelas(per, 'oro', 2000), null, 'sin monedas no se compra');
  const c = comprarVelas(per, 'carmesi', 500);
  assert.deepEqual(c, { velas: ['carmesi'], gastado: 500, vela: 'carmesi' });
  assert.ok(tieneVelas(c, 'carmesi'));
  assert.equal(velasElegidas({ vela: 'oro' }), null, 'no se usan velas que no compraste');
  // Por sesión, la mitad de monedas desde la etapa 12; antes, igual que siempre.
  const ses = (k) => ({ fecha: dia(k), duracion: 1800, distancia: 7000, wattsProm: 150, ftp: FTP, reglasXp: 3 });
  const g = (k) => J.estadoJuego([ses(k)], { ftp: FTP }).porSesion.get(dia(k));
  const antes = g('2026-11-02');
  const ahora = g('2026-11-09');
  assert.equal(antes.monedas, Math.floor((antes.xp * 2) / 50));
  assert.equal(ahora.monedas, Math.floor(ahora.xp / 50));
}

// ---------- Puntos de talento sobrantes → monedas ----------
{
  const lleno = Object.fromEntries(T.SLOTS.map((k) => [k, [0, 0, 0]]));
  const muchas = Array.from({ length: 40 }, (_, i) => ({ fecha: dia('2026-09-01') + i * 864e5, duracion: 3600, distancia: 15000, wattsProm: 150 }));
  const h = J.estadoJuego(muchas, { per: { clase: 'vikingo', arbol: { vikingo: lleno } } });
  const sobran = T.puntosDeNivel(h.nivel) - 18;
  assert.ok(sobran > 0, `nivel ${h.nivel}`);
  assert.equal(h.puntosSobrantes, sobran);
  const h2 = J.estadoJuego(muchas, { per: { clase: 'vikingo', arbol: { vikingo: lleno }, puntosCanjeados: sobran } });
  assert.equal(h2.puntosSobrantes, 0);
  assert.equal(h2.monedas - h.monedas, sobran * J.MONEDAS_POR_PUNTO, 'los puntos canjeados dan monedas');
  assert.equal(h2.talentosLibres, 0);
}

// ---------- Atributos: lo que se ve son las últimas 6 semanas; los títulos, el acumulado ----------
{
  const ses = (k) => ({ fecha: dia(k), duracion: 1800, distancia: 7000, wattsProm: 150, ftp: FTP, muestras: muestras(1800) });
  const lista = [ses('2026-09-01'), ses('2026-11-10')];
  const h = J.estadoJuego(lista, { ftp: FTP, ahora: dia('2026-11-11') });
  assert.ok(h.atributosTotal.resistencia > h.atributos.resistencia, 'la de septiembre ya no cuenta en pantalla');
  assert.ok(h.atributos.resistencia > 0);
  const tarde = J.estadoJuego(lista, { ftp: FTP, ahora: dia('2027-01-30') });
  assert.equal(tarde.atributos.resistencia, 0, 'sin entrenar, baja');
  assert.equal(tarde.atributosTotal.resistencia, h.atributosTotal.resistencia, 'el acumulado (y los títulos) se queda');
  assert.match(J.TEXTO_ATRIBUTOS, /6 semanas/);
  assert.match(J.TEXTO_ATRIBUTOS, /baja/);
}

// Claves nuevas registradas.
assert.ok(registrada('avisoTriunfo12'));

console.log('etapa12 OK');
