// Héroe y tienda: personaje, nivel, atributos, árbol, tienda y paisajes.
import { PAISAJES, VELAS, srcRemero, srcRemeroSolo, comprarPaisaje, comprarVelas, paisajeElegido, tienePaisaje, tieneVelas, usarPaisaje, usarEquipo } from '../carrera.js';
import * as CB from '../coleccion-bote.js';
import * as H from '../historial.js';
import * as db from '../db.js';
import { hablar } from '../voz.js';
import { fraseGrabadaAlAzar } from '../voces-clase.js';
import { confeti } from '../efectos.js';
import * as J from '../juego.js';
import * as O from '../objetos.js';
import * as V from '../ventajas.js';
import * as B from '../base.js';
import * as C from '../consejos.js';
import {
  $, ajustes, citaGuardada, contarHasta, descargar, escaparHtml, fechaCorta, formatoMeta, ftp, ico, miles, perfil, sinMovimiento, toast, vibrar,
} from '../ui.js';
import * as Ci from '../cita.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { pintarClasificacion } from './ajustes.js';
import { estimarFtp, pintarChips, srcRetratoRango } from './preparar.js';
import { pintarModoEnt, retratoPropio, vistaPrevia } from './vivo.js';
import { corto } from './sesion.js';
import { cerrarHoja, llenarSelectorEntrenamientos, obtenerEnt } from './planes.js';
import { HABILIDADES, habilidadDe, RESERVA } from '../habilidades.js';
import { proximo } from '../programa.js';
import * as E from '../estadisticas.js';
import { leerPrograma } from './programa.js';

// ---------- Héroe ----------
export function leerPersonaje() {
  try { return JSON.parse(ajustes.leer('personaje', 'null')) || {}; } catch { return {}; }
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarHeroe() {
  // La ropa dejó de venderse: se retira y se devuelven las monedas gastadas. El bote de la carrera se queda.
  {
    const per = leerPersonaje();
    if (per.clase && !per.tiendaVentajas) {
      const bote = per.equipo?.bote;
      ajustes.escribir('personaje', JSON.stringify({ ...per, compras: [], gastado: 0, inventario: {}, equipo: bote ? { bote } : {}, tiendaVentajas: true }));
    }
  }
  // Paisaje de la carrera: el fiordo es gratis; los demás se compran en la tienda.
  usarPaisaje(paisajeElegido(leerPersonaje()));
  aplicarEquipo();
  $('#vista-heroe').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-preparar]');
    if (!b) return;
    await prepararEntrenamiento(b.dataset.preparar, b.dataset.reto ? J.DIFICULTAD_RETO[b.dataset.reto] : null);
  });
  // Toca a tu héroe para oír una de sus frases con su voz (sirve también para comprobar que los audios están).
  for (const sel of ['#heroe-avatar', '#ficha-figura']) {
    const el = $(sel);
    el.addEventListener('click', oirHeroe);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oirHeroe(); } });
  }
  $('#linea-nivel').addEventListener('click', () => {
    if ($('#linea-nivel').dataset.talentos) { vh.seccion = 'camino'; vh.abrirTalentos = true; }
    irA('heroe');
  });
  $('#heroe-avisos').addEventListener('click', (e) => {
    if (e.target.closest('[data-aviso-xp]')) { ajustes.escribir('avisoXpLenta', '1'); pintarHeroe(); }
  });

  $('#clases').addEventListener('click', (e) => {
    const b = e.target.closest('[data-clase]');
    if (!b) return;
    vh.claseElegida = b.dataset.clase;
    for (const x of document.querySelectorAll('#clases [data-clase]')) x.setAttribute('aria-checked', String(x === b));
    $('#btn-crear-heroe').disabled = false;
  });
  $('#btn-crear-heroe').addEventListener('click', () => {
    if (!vh.claseElegida) return;
    // Maestría (etapa 7): cada cambio de clase queda con su fecha, para que cada una guarde sus sesiones.
    guardarPersonaje({ clase: vh.claseElegida, nombre: $('#heroe-nombre').value.trim(), claseHist: J.conClaseNueva(leerPersonaje(), vh.claseElegida) });
    aplicarEquipo();
    precargarRecursos();
    confeti();
    pintarHeroe();
  });
  $('#btn-cambiar-clase').addEventListener('click', () => {
    const per = leerPersonaje();
    vh.claseElegida = per.clase || null;
    // Sin historial, la clase de ahora cuenta desde siempre: se apunta antes de quitarla.
    const claseHist = per.claseHist?.length || !per.clase ? per.claseHist || [] : [[0, per.clase]];
    guardarPersonaje({ clase: null, claseHist });
    pintarHeroe();
  });
  document.querySelector('.heroe-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hp]');
    if (!b) return;
    vh.seccion = b.dataset.hp;
    pintarHeroe();
  });
  // Camino: la senda se elige en la tarjeta del siguiente hito o en Talentos y senda; los talentos, en su árbol.
  $('#hp-camino').addEventListener('click', async (e) => {
    // Senda (etapa 4): desde el nivel 20, gratis y cuando quieras. Los grados se quedan en su casilla.
    const se = e.target.closest('[data-senda]');
    if (se) {
      const { per, h } = await estadoHeroe();
      const clave = J.claseDe(per.clase).clave;
      const nueva = se.dataset.senda === 'b' ? 'b' : 'a';
      // La primera vez se puede confirmar la senda de siempre (la A) para dejar de verla como pendiente.
      if (h.nivel < J.NIVEL_SENDA || (J.sendaEn(per, clave) === nueva && per.senda?.[clave]?.length)) return;
      guardarPersonaje({ senda: { ...(per.senda || {}), [clave]: [...(per.senda?.[clave] || []), [Date.now(), nueva]] } });
      toast(`Ahora sigues la senda ${J.SENDAS[clave][nueva].nombre}`);
      vibrar(80);
      pintarHeroe();
      return;
    }
    const ap = e.target.closest('[data-aprender]');
    if (ap) {
      const { per, h } = await estadoHeroe();
      const clave = J.claseDe(per.clase).clave;
      const slot = ap.dataset.aprender;
      const arbolClase = per.arbol?.[clave] || {};
      if (J.motivoBloqueo(slot, { nivel: h.nivel, libres: h.talentosLibres }, arbolClase, clave)) return;
      guardarPersonaje({ arbol: { ...(per.arbol || {}), [clave]: { ...arbolClase, [slot]: [...(arbolClase[slot] || []), Date.now()] } } });
      const t = J.talentosDe(clave, J.sendaEn(per, clave)).find((x) => x.slot === slot);
      toast(`${t.nombre}: grado ${J.grado({ ...arbolClase, [slot]: [...(arbolClase[slot] || []), 0] }, clave, slot)}`);
      vibrar(80);
      pintarHeroe();
    }
  });
  $('#tienda').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-comprar]');
    if (!b) return;
    const { per, h } = await estadoHeroe();
    const x = J.tiendaSemana(J.lunesDe(Date.now())).find((y) => y.id === b.dataset.comprar);
    // Lote: 3 por el precio de 2,5.
    const lote = b.dataset.lote != null;
    const n = lote ? V.LOTE : 1;
    const precio = lote ? V.precioLote(x) : x.precio;
    if (!x || h.monedas < precio) return;
    const inv = per.inventario || {};
    guardarPersonaje({ inventario: { ...inv, [x.id]: (inv[x.id] || 0) + n }, gastado: (per.gastado || 0) + precio });
    vibrar(60);
    toast(`${lote ? `${n} × ` : ''}${x.nombre} a tu bolsa. Elígela en Entrenar antes de la carrera.`);
    pintarHeroe();
    pintarChips();
  });

  $('#tienda-paisajes').addEventListener('click', async (e) => {
    if (await previa(e)) return;
    const b = e.target.closest('[data-paisaje]');
    if (!b) return;
    const id = b.dataset.paisaje;
    const { per, h } = await estadoHeroe();
    if (tienePaisaje(per, id)) {
      guardarPersonaje({ paisaje: id });
      toast(`Tus carreras ahora son en: ${PAISAJES[id].nombre}.`);
    } else {
      const cambios = comprarPaisaje(per, id, h.monedas);
      if (!cambios) return;
      guardarPersonaje(cambios);
      precargarRecursos();
      confeti();
      toast(`¡${PAISAJES[id].nombre} es tuyo! Ya lo verás en tu próxima carrera.`);
    }
    usarPaisaje(id);
    vibrar(60);
    pintarHeroe();
  });
  // Colección del bote de tu clase: velas, mascarón y palas; y las velas de color, que valen para cualquier bote.
  $('#tienda-velas').addEventListener('click', async (e) => {
    if (await previa(e)) return;
    const b = e.target.closest('[data-pieza]');
    if (!b) return;
    const id = b.dataset.pieza;
    const tipo = b.dataset.tipo;
    const { per, h } = await estadoHeroe();
    const clase = J.claseDe(per.clase)?.clave;
    if (!clase) return;
    const ctx = ctxColeccion(h);
    const x = CB.PIEZAS[id] || VELAS[id];
    if (b.dataset.quitar != null) {
      guardarPersonaje(CB.equipar(per, clase, tipo, null));
      toast(tipo === 'vela' ? 'Tu bote vuelve a su vela clásica.' : `Quitaste ${x.nombre}.`);
    } else if (CB.PIEZAS[id] ? CB.tienePieza(per, id, ctx) : tieneVelas(per, id)) {
      guardarPersonaje(CB.equipar(per, clase, tipo, id));
      toast(`Tu bote ahora lleva: ${x.nombre}.`);
    } else {
      const cambios = CB.PIEZAS[id] ? CB.comprarPieza(per, id, h.monedas) : comprarVelas(per, id, h.monedas);
      if (!cambios) return;
      // Las velas de color se compran y se estrenan en el bote de tu clase.
      guardarPersonaje(CB.PIEZAS[id] ? cambios : { ...cambios, ...CB.equipar(per, clase, 'vela', id) });
      confeti();
      toast(`¡${x.nombre}: ${CB.PIEZAS[id]?.tipo === 'palas' ? 'son tuyas' : 'ya es tuyo'}! Lo verás en tu próxima carrera.`);
    }
    vibrar(60);
    await aplicarEquipo();
    pintarHeroe();
  });
  // Puntos de talento sobrantes (con el árbol completo): se cambian por monedas.
  $('#vista-heroe').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-canjear-puntos]')) return;
    const { per, h } = await estadoHeroe();
    if (!h.puntosSobrantes) return;
    guardarPersonaje({ puntosCanjeados: (per.puntosCanjeados || 0) + h.puntosSobrantes });
    toast(`Cambiaste ${h.puntosSobrantes} ${h.puntosSobrantes === 1 ? 'punto' : 'puntos'} de talento por ${miles(h.puntosSobrantes * J.MONEDAS_POR_PUNTO)} monedas.`);
    vibrar(60);
    pintarHeroe();
  });
  $('#hoja-atr').addEventListener('click', async (e) => {
    const c = e.target.closest('[data-cita]');
    if (c) { accionCita(c.dataset.cita); return; }
    const b = e.target.closest('[data-prox]');
    if (!b) return;
    cerrarHoja();
    await prepararEntrenamiento(b.dataset.prox, J.DIFICULTAD_RETO[b.dataset.reto] || null);
  });

  $('#hoja-xp').addEventListener('click', (e) => {
    if (e.target.closest('[data-ir-talentos]')) { cerrarHoja(); vh.seccion = 'camino'; vh.abrirTalentos = true; irA('heroe'); return; }
    const b = e.target.closest('[data-clase-rapida]');
    if (!b || leerPersonaje().clase) return;
    const c = J.claseDe(b.dataset.claseRapida);
    guardarPersonaje({ clase: c.clave });
    aplicarEquipo();
    confeti();
    b.closest('.xp-heroe').outerHTML = `<p class="aviso exito">¡Listo! Tu ${c.nombre} ya tiene esta experiencia. Ponle nombre en la pestaña Héroe.</p>`;
    pintarLineaNivel();
  });
}
export function inventario() { return leerPersonaje().inventario || {}; }
export function guardarPersonaje(cambios) {
  ajustes.escribir('personaje', JSON.stringify({ ...leerPersonaje(), ...cambios }));
}
export const emblema = (c) => `<svg viewBox="0 0 24 24" aria-hidden="true">${c.icono}</svg>`;
// Frase de tu héroe con su voz grabada. Suena aunque la voz de la sesión esté apagada: la pediste tú.
let audioHeroe = null;
let ultimaFrase = null;
export function oirHeroe() {
  const per = leerPersonaje();
  if (!per.clase) return;
  const f = fraseGrabadaAlAzar(J.claseDe(per.clase).clave, ultimaFrase);
  if (!f) { toast('Tu héroe todavía no tiene voz propia.'); return; }
  ultimaFrase = f.texto;
  audioHeroe?.pause();
  audioHeroe = new Audio(f.ruta);
  audioHeroe.play().catch(() => toast(`No se pudo reproducir «${f.texto}».`));
}

// Ilustración del personaje según su clase y el rango de su nivel (assets/heroes, generados por tools/build-app-assets.py).
export const srcHeroe = (clave, nivel, retrato = false) => `assets/heroes/${clave}_${J.rangoDe(nivel).id}${retrato ? '_retrato' : ''}.webp`;
// Deja listo en Entrenar un entrenamiento base (o Remo libre contra fantasmas con '') sin agregar copias a tu lista.
// dificultad: la de los rivales (null deja la que tenías).
export async function prepararEntrenamiento(baseId, dificultad = null) {
  const ent = baseId ? await obtenerEnt(baseId) : null;
  ajustes.escribir('ultimoEnt', ent ? ent.id : '');
  ajustes.escribir('modoEnt', ent ? 'objetivo' : 'libre');
  if (!ent) ajustes.escribir('libreFantasmas', '1');
  if (dificultad) ajustes.escribir('dificultad', dificultad);
  await llenarSelectorEntrenamientos();
  $('#sel-entrenamiento').value = ent ? ent.id : '';
  irA('entrenar');
  pintarModoEnt();
  vistaPrevia();
  pintarChips();
  const rivales = !ent?.prueba && !B.NOMBRES_PRUEBA.has(ent?.nombre) ? ` con rivales en ${J.DIFICULTADES[ajustes.leer('dificultad', 'costa')].nombre}` : '';
  toast(`Listo: ${ent ? ent.nombre : 'Remo libre'}${rivales}. Pulsa Empezar cuando quieras.`);
}
export const nombreAtributo = (k) => J.ATRIBUTOS.find((a) => a.clave === k)?.nombre || k;
// Opciones de los consejos de atributos con tu FTP, tu clase, tu contexto de hoy y tu atributo más bajo.
export function opcConsejos(h, sesiones = []) {
  return { ftp: ftp() || estimarFtp(sesiones) || 150, clase: leerPersonaje().clase || null, ctx: h.contexto || {}, debil: J.atributoDeLaSemana(h.atributos, { sinPulso: h.contexto?.sinPulso ?? true }) };
}
// Previsión de un entrenamiento, guardada mientras no cambien tu FTP, tu clase ni tu contexto.
const cachePrevision = new Map();
export function previsionDe(ent, o) {
  const clave = JSON.stringify([ent.id ?? null, ent.nombre, ent.bloques?.length, ent.objetivo, o.ftp, o.clase, o.ctx, o.debil, !!o.libre]);
  if (!cachePrevision.has(clave)) {
    if (cachePrevision.size > 80) cachePrevision.clear();
    cachePrevision.set(clave, C.prevision(ent, o));
  }
  return cachePrevision.get(clave);
}
// Chips de atributos: el destacado primero y en color.
export const chipsAtr = (gan, destacar = null, max = 4) => `<div class="chips-ganancia">${Object.entries(gan)
  .sort((a, b) => (b[0] === destacar) - (a[0] === destacar) || b[1] - a[1]).slice(0, max)
  .map(([k, v]) => `<span${k === destacar ? ' class="top" title="Tu atributo más bajo"' : ''}>${nombreAtributo(k)} +${miles(v)}${k === destacar ? ' · tu más bajo' : ''}</span>`).join('')}</div>`;
// Una condición con sus puntos: «Mantén el rango… +6 Técnica».
export const filaCond = (x, clase = '') => `<li class="cond ${clase}">${ico(x.icono || 'i-aviso')}<div><b>${escaparHtml(x.titulo)}</b>${x.detalle ? `<small>${escaparHtml(x.detalle)}</small>` : ''}</div><span class="cond-pts">${C.textoPuntos(x)}</span></li>`;
// Duraciones largas (totales): «174 h 55 min» en vez de «174:55:00».
export const horasYMin = (seg) => { const h = Math.floor(seg / 3600); const m = Math.round((seg % 3600) / 60); return h ? `${miles(h)} h ${m} min` : `${m} min`; };
export const icoMoneda = '<svg class="moneda" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>';
// Estado de la pantalla, compartido con heroe-vista.js. vh.abrirTalentos: al llegar desde «puntos de talento por
// repartir», Talentos y senda se abre solo.
export const vh = { claseElegida: null, seccion: 'camino', abrirTalentos: false };

// Línea de nivel en Entrenar y punto en la pestaña Héroe cuando hay talentos por repartir.
export async function pintarLineaNivel() {
  const { per, h } = await estadoHeroe();
  const clase = J.claseDe(per.clase);
  // Los puntos de talento se anuncian solo aquí, y solo si hay algo que subir con ellos.
  const libres = clase ? h.talentosPorRepartir : 0;
  const linea = $('#linea-nivel');
  const ses = h.hasta ? enSesiones(h.hasta - h.xp, h) : '';
  linea.innerHTML = clase
    ? `<img src="${srcHeroe(clase.clave, h.nivel, true)}" width="32" height="32" alt=""><span><b>Nivel ${h.nivel}</b>${h.hasta ? ` · faltan ${miles(h.hasta - h.xp)} XP${ses ? ` (${ses})` : ''}` : ''}${libres ? `<small class="nuevo">${libres} ${libres === 1 ? 'punto' : 'puntos'} de talento por repartir</small>` : ''}</span><span aria-hidden="true">›</span>`
    : `<span><b>Crea tu héroe</b> para subir de nivel con cada sesión</span><span aria-hidden="true">›</span>`;
  linea.dataset.talentos = libres > 0 ? '1' : '';
  linea.hidden = !!estado.sesion;
}

// «≈ 3 sesiones»: cuántas sesiones como tus últimas 5 hacen falta para juntar esa XP.
export function enSesiones(xp, h) {
  if (!(h.xpPorSesion > 0) || xp <= 0) return '';
  const n = Math.max(1, Math.ceil(xp / h.xpPorSesion));
  return `≈ ${n} ${n === 1 ? 'sesión' : 'sesiones'}`;
}
// La pantalla del héroe (ficha, camino, misiones, tienda) vive en heroe-vista.js y se baja al abrirla.
export async function pintarHeroe() {
  return (await import('./heroe-vista.js')).pintarHeroe();
}
export async function estadoHeroe() {
  const per = leerPersonaje();
  return { per, h: H.estadoJuegoDe(await H.sinMuestras(), { ftp: ftp(), per }) };
}

// Lo que la colección necesita del estado del juego: tu nivel, las hazañas cumplidas y las piezas ganadas a los jefes.
export const ctxColeccion = (h) => ({ nivel: h.nivel, hazanas: new Set(h.hazanas.filter((x) => x.hecha).map((x) => x.id)), jefes: new Set(h.piezasJefe || []) });
export const equipoActual = (per, h) => {
  const clase = J.claseDe(per.clase)?.clave;
  return clase ? CB.equipoDe(per, clase, ctxColeccion(h), { velaDeColor: (id) => tieneVelas(per, id) }) : null;
};
// Pone en la carrera el equipo del bote de tu clase.
export async function aplicarEquipo() {
  const { per, h } = await estadoHeroe();
  usarEquipo(equipoActual(per, h));
}

// «Vista previa» de un paisaje o una pieza: su código se baja solo al tocarla.
export async function previa(e) {
  const b = e.target.closest('[data-previa]');
  if (b) (await import('./previa.js')).desdeTienda(b, await estadoHeroe(), equipoActual);
  return !!b;
}
// Imágenes de los paisajes de pago que tienes (panorama, orilla, costa y texturas). Las variantes usan las de su paisaje base.
export function archivosDePaisajes(per) {
  const ids = Object.keys(PAISAJES).filter((id) => PAISAJES[id].precio > 0 && tienePaisaje(per, id));
  return [...new Set(ids.flatMap((id) => [PAISAJES[id].panorama?.src, PAISAJES[id].costa, PAISAJES[id].orilla?.src, PAISAJES[id].agua?.src, PAISAJES[id].espuma, PAISAJES[id].suelo3d?.src, PAISAJES[id].aguaTextura3d?.src]).filter(Boolean))];
}

// Pide al service worker que guarde para usarlos sin conexión los vídeos de tu clase (la vista realista) y los
// paisajes que compraste. Los de otras clases y los paisajes que no tienes no se descargan.
export function precargarRecursos() {
  const per = leerPersonaje();
  const archivos = archivosDePaisajes(per);
  // Tu remero realista en la carrera 2D y 3D (los de los rivales se descargan cuando salen)
  const clave = per.clase ? J.claseDe(per.clase)?.clave : null;
  if (clave) archivos.push(srcRemero('3d', clave), srcRemeroSolo(clave), srcRemero('2d', clave));
  if ((!per.clase && !archivos.length) || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ tipo: 'precargar', clase: per.clase || null, archivos })).catch(() => {});
}

// El juego con la sesión recién terminada: la hoja de resumen lo usa dos veces y se calcula una.
let juegoResumen = null;
function juegoConSesion(previas, s, per) {
  const clave = `${ftp()}|${JSON.stringify(per)}`;
  if (juegoResumen?.previas === previas && juegoResumen.s === s && juegoResumen.clave === clave) return juegoResumen.h;
  const h = J.estadoJuego([...previas.filter((x) => x.fecha !== s.fecha), s], { ftp: ftp(), per });
  juegoResumen = { previas, s, clave, h };
  return h;
}

// El hito de la sesión (etapa 21): jefe, plan o semana completos, rango, récord o fantasma por poco; null si no hubo.
// hitos.js se carga aquí, al terminar una sesión, y no al arrancar la app.
export async function hitoSesion(s, previas = []) {
  const Hi = await import('../hitos.js');
  const per = leerPersonaje();
  const g = juegoConSesion(previas, s, per).porSesion.get(s.fecha);
  const premio = g?.jefe ? (g.jefe.pieza ? `${CB.PIEZAS[g.jefe.pieza].nombre} para su bote` : O.objeto(g.jefe.objeto)?.nombre ? `insignia ${O.objeto(g.jefe.objeto).nombre}` : '') : '';
  const sube = g && per.clase && J.rangoDe(g.nivelDespues).id !== J.rangoDe(g.nivelAntes).id;
  const prog = leerPrograma();
  const { plan, semana } = Hi.hitosDelPlan(prog, previas, s);
  return Hi.hitoDe({
    jefe: g?.jefe ? { nombre: g.jefe.nombre, premio } : null,
    rango: sube ? { nombre: J.nombreRango(g.nivelDespues, per.clase) } : null,
    plan: plan ? { ...plan, nombre: prog.nombre || '' } : null,
    semana,
    records: E.nuevosRecords(s, previas),
    rivales: s.rivales || (s.rival ? [s.rival] : []),
  });
}

// XP, monedas y logros que dio la sesión, en la hoja de resumen. Devuelve true si subiste de nivel o venciste a un jefe.
export function pintarXpSesion(s, previas, resumen) {
  const caja = $('#hoja-xp');
  const per = leerPersonaje();
  const clase = J.claseDe(per.clase);
  const h = juegoConSesion(previas, s, per);
  const g = h.porSesion.get(s.fecha);
  caja.hidden = !g;
  if (!g) return false;
  const logros = h.logros.filter((l) => l.fecha === s.fecha);
  const monedas = g.monedas + logros.reduce((a, l) => a + l.monedas, 0);
  const subio = resumen && g.nivelDespues > g.nivelAntes;
  const ascenso = subio && J.rangoDe(g.nivelDespues).id !== J.rangoDe(g.nivelAntes).id;
  const puntos = subio ? J.puntosDeNivel(g.nivelDespues) - J.puntosDeNivel(g.nivelAntes) : 0;
  const ses = h.hasta ? enSesiones(h.hasta - h.xp, h) : '';
  // Vencer a un jefe es un hito: tarjeta propia con su insignia, antes que todo lo demás.
  const jefe = g.jefe ? `<div class="jefe-vencido" role="status">${ico('i-trofeo')}<div><b>¡Jefe vencido!</b><span>${escaparHtml(g.jefe.nombre)} cae y terminas el capítulo ${g.jefe.capitulo} de ${J.CAPITULOS.length}.</span><small>Insignia ${escaparHtml(O.objeto(g.jefe.objeto)?.nombre || '')}${g.jefe.pieza ? ` y ${escaparHtml(CB.PIEZAS[g.jefe.pieza].nombre)} para tu bote` : ''}</small></div></div>` : '';
  // Sin héroe (la bienvenida ya no lo pide, etapa 20): elegirlo es lo primero del resumen, con la XP ya ganada.
  const eleccion = clase ? '' : `<div class="xp-heroe"><p><b>Elige tu héroe</b> y se queda con esta experiencia:</p><div class="clases-mini">${J.CLASES.map((c) => `<button type="button" data-clase-rapida="${c.clave}"><img src="${srcHeroe(c.clave, 1, true)}" width="48" height="48" alt=""><span>${c.nombre}</span></button>`).join('')}</div></div>`;
  caja.innerHTML = `${jefe}${eleccion}<span class="xp-total">+${miles(g.xp + g.xpExtra)} XP</span> <span class="monedas grande">${icoMoneda}+${miles(monedas)}</span>
    ${subio ? `<span class="subio">¡${clase ? clase.nombre : 'Tu héroe'} sube a nivel ${g.nivelDespues}!${ascenso ? ` Ahora es ${J.nombreRango(g.nivelDespues, per.clase)}.` : ''}</span>` : ''}
    ${puntos > 0 && clase && h.talentosPorRepartir > 0 ? `<span class="subio-talento">+${puntos} ${puntos === 1 ? 'punto' : 'puntos'} de talento <button type="button" class="boton chico primario" data-ir-talentos>Repartir</button></span>` : ''}
    <div class="progreso heroe-xp" role="progressbar" aria-label="Experiencia hacia el siguiente nivel"><div style="width:${h.hasta ? (100 * (h.xp - h.desde)) / (h.hasta - h.desde) : 100}%"></div></div>
    ${g.avisoDescanso ? '<p class="aviso-descanso suave">Hoy tocaba descanso: mañana tu sesión dura puede costarte más.</p>' : ''}
    <small class="xp-nivel">Nivel ${h.nivel}${h.hasta ? ` · faltan ${miles(h.hasta - h.xp)} XP para el ${h.nivel + 1}${ses ? ` (${ses})` : ''}` : ''}</small>
    <details class="xp-desglose"${resumen ? '' : ' open'}><summary>Cómo la ganaste${logros.length ? ` · ${logros.length} ${logros.length === 1 ? 'logro' : 'logros'}` : ''}</summary>
    ${logros.map((l) => `<div class="logro ${l.tipo}">${ico(['jefe', 'hazana', 'mejora'].includes(l.tipo) ? 'i-trofeo' : 'i-check')}<span>${l.texto}${l.objeto ? ` · insignia <b>${O.objeto(l.objeto).nombre}</b>` : ''}</span><span class="recompensa">${l.xp ? `<span class="xp">+${miles(l.xp)} XP</span>` : ''}<span class="monedas">${icoMoneda}${l.monedas}</span></span></div>`).join('')}
    <div class="chips-ganancia">${Object.entries(g.ganancias).map(([k, v]) => `<span>${nombreAtributo(k)} +${v}</span>`).join('')}</div>
    <ul>${g.detalle.map(([t, v]) => `<li><span>${t}</span><span>+${miles(v)}</span></li>`).join('')}</ul>
    ${J.usaCarga(s) ? `<p class="suave xp-mitad">La XP sale de la carga del entrenamiento (con tope diario) y de cumplir tu plan. ${J.esUnaRacha(s.fecha) ? 'Fantasmas y talentos' : 'Fantasmas, racha y talentos'} siguen a la mitad.</p>` : J.factorXp(s.fecha) < 1 ? '<p class="suave xp-mitad">Desde el 29 de octubre todo da la mitad de XP: estas cifras ya lo incluyen.</p>' : ''}</details>`;
  if (resumen) {
    const total = g.xp + g.xpExtra;
    contarHasta(caja.querySelector('.xp-total'), total, (v) => `+${miles(v)} XP`);
    const barra = caja.querySelector('.heroe-xp > div');
    const final = barra.style.width;
    const antes = subio || !h.hasta ? 0 : Math.max(0, (100 * (h.xp - total - h.desde)) / (h.hasta - h.desde));
    if (!sinMovimiento()) { barra.style.transition = 'none'; barra.style.width = `${antes}%`; void barra.offsetWidth; barra.style.transition = 'width 1.1s cubic-bezier(.2, .8, .2, 1)'; requestAnimationFrame(() => { barra.style.width = final; }); }
  }
  if (subio) hablar(ascenso ? `Subiste a nivel ${g.nivelDespues}. Ahora eres ${J.nombreRango(g.nivelDespues, per.clase)}` : `Subiste a nivel ${g.nivelDespues}`);
  if (resumen && logros.some((l) => l.tipo === 'jefe')) hablar('¡Jefe vencido!');
  return subio || logros.some((l) => ['jefe', 'hazana', 'mejora'].includes(l.tipo));
}

// Al terminar: lo que lograste, lo que te quedó cerca (con sus puntos) y qué entrenar la próxima vez.
// Próxima sesión del plan después de la de hoy: { ent, fecha, cuando: 'mañana' | 'el jueves' | 'el 3 de diciembre' }.
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function proximaDelPlan(programa, ahora = Date.now()) {
  const d = programa && proximo(programa, ahora);
  if (!d) return null;
  const f = new Date(`${d.fecha}T12:00`);
  const dias = Math.round((f.getTime() - new Date(`${claveDiaLocal(ahora)}T12:00`).getTime()) / 864e5);
  const cuando = dias === 1 ? 'mañana' : dias < 7 ? `el ${DIAS_SEMANA[f.getDay()]}` : `el ${f.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`;
  return { ent: d.ent, fecha: d.fecha, cuando };
}
const claveDiaLocal = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const programaGuardado = () => { try { return JSON.parse(ajustes.leer('programa', 'null')); } catch { return null; } };

// ---------- Cierre con cita (etapa 13): «¿Cuándo remas la próxima?» ----------
function citaDeAhora() {
  const cg = citaGuardada();
  return Ci.proximaCita({ programa: programaGuardado(), dias: Ci.diasDeCita(cg.dias, perfil().dias), hora: cg.hora, movida: cg.movida, hechoHoy: true });
}
function citaResumen() {
  const c = citaDeAhora();
  if (!c) return '';
  return `<div class="cita-resumen" id="cita-resumen"><p>¿Cuándo remas la próxima? <b id="cita-texto">${escaparHtml(Ci.textoCita(c))}</b></p>
    <div class="acciones"><button type="button" class="boton chico" data-cita="ics">Añadir a mi calendario</button><button type="button" class="boton chico secundario" data-cita="mover">Cambiar</button></div>
    <div class="cita-mover" id="cita-mover" hidden></div></div>`;
}
function accionCita(accion) {
  const c = citaDeAhora();
  if (!c) return;
  if (accion === 'ics') { descargar(`rower-cita-${c.fecha}.ics`, Ci.ics([c]), 'text/calendar'); toast(`Cita ${Ci.textoCita(c)}: tu calendario te avisa 30 min antes`); return; }
  const caja = $('#cita-mover');
  if (accion === 'mover') {
    const opciones = Array.from({ length: 7 }, (_, i) => claveDiaLocal(Date.now() + (i + 1) * 864e5))
      .map((k) => `<option value="${k}"${k === c.fecha ? ' selected' : ''}>${escaparHtml(Ci.textoCita({ fecha: k, hora: '' }).replace(/, $/, ''))}</option>`).join('');
    caja.innerHTML = `<label class="campo">Día <select id="cita-dia">${opciones}</select></label><label class="campo">Hora <input type="time" id="cita-hora" value="${c.hora}"></label>
      <button type="button" class="boton chico" data-cita="guardar">Guardar</button>`;
    caja.hidden = false;
    $('#cita-dia').focus();
    return;
  }
  if (accion === 'guardar') {
    const nueva = { fecha: $('#cita-dia').value, hora: Ci.horaValida($('#cita-hora').value), ent: c.ent || null };
    ajustes.escribir('citaMovida', JSON.stringify(nueva));
    caja.hidden = true;
    $('#cita-texto').textContent = Ci.textoCita(nueva);
    toast(`Quedaste ${Ci.textoCita(nueva)}`);
  }
}

export async function pintarAtrSesion(s, previas, resumen) {
  const caja = $('#hoja-atr');
  estado.atrAbierta = { s, previas, resumen };
  const per = leerPersonaje();
  const ant = previas.filter((x) => x.fecha < s.fecha && x.paladas > 0 && x.distancia > 0);
  const mpp = ant.length ? ant.reduce((a, x) => a + x.distancia / x.paladas, 0) / ant.length : 0;
  const f = ftp() || estimarFtp(previas) || 150;
  const r = C.analisis(s, { ftp: f, clase: per.clase || null, ctx: { mppPromedio: mpp } });
  let prox = '';
  // Un solo «qué toca»: con plan, la próxima sesión del plan y su día (y qué atributo sube, como dato aparte);
  // sin plan, el entrenamiento que sube tu atributo más bajo.
  const sig = resumen ? proximaDelPlan(programaGuardado(), s.fecha) : null;
  if (sig) {
    const h = juegoConSesion(previas, s, per);
    const ent = (await db.listar('entrenamientos').catch(() => [])).find((e) => e.nombre === sig.ent) || estado.baseActual.find((e) => e.nombre === sig.ent) || null;
    const p = ent && previsionDe(ent, opcConsejos(h, previas));
    const top = p && Object.entries(p.seguro).sort((a, b) => b[1] - a[1])[0];
    prox = `<div class="proxima"><span class="etq">Para la próxima</span><p>Próxima de tu plan: <b>${escaparHtml(sig.ent)}</b>, ${sig.cuando}.${top ? ` Además sube tu ${nombreAtributo(top[0])}.` : ''}</p>
      ${p ? chipsAtr(p.seguro, null, 3) : ''}</div>`;
  } else if (resumen) {
    const h = juegoConSesion(previas, s, per);
    const rec = J.recomendarPorAtributos(h.atributos, { sinPulso: h.contexto.sinPulso });
    const bases = estado.baseActual.length ? estado.baseActual : B.basesPara(h.nivel, ftp(), previas);
    const ent = rec && bases.find((x) => x.id === (rec.base || J.PREPARAR_ATRIBUTO[rec.atributo.clave]));
    const p = ent && previsionDe(ent, opcConsejos(h, previas));
    if (p) {
      prox = `<div class="proxima"><span class="etq">Para la próxima</span><p><b>${escaparHtml(ent.nombre)}</b> sube tu ${rec.atributo.nombre}, tu atributo más bajo.</p>
        ${chipsAtr(p.seguro, rec.atributo.clave, 3)}<button type="button" class="boton chico" data-prox="${ent.id}" data-reto="${rec.reto}">Dejarlo listo para la próxima</button></div>`;
    }
  }
  if (resumen) prox += citaResumen();
  caja.hidden = !r.logros.length && !r.cerca.length && !prox;
  caja.innerHTML = `${r.logros.length ? `<h3>Lo que lograste</h3><ul class="lista-cond">${r.logros.map((x) => filaCond(x, 'hecho')).join('')}</ul>` : ''}
    ${r.cerca.length ? `<details class="mas-detalle"><summary>Te quedaste cerca <span class="seccion-resumen">${r.cerca.length}</span></summary><ul class="lista-cond">${r.cerca.map((x) => filaCond(x, 'cerca')).join('')}</ul></details>` : ''}${prox}`;
}

// Podio de la carrera contra fantasmas: puesto, tiempo (o diferencia) y XP de cada fantasma vencido.
export async function pintarPodio(s) {
  const caja = $('#hoja-podio');
  const rivales = s.rivales || (s.rival ? [s.rival] : []);
  caja.hidden = !rivales.length;
  if (!rivales.length) return;
  const filas = [
    { nombre: 'Tú', yo: true, pos: 0, tiempo: s.tiempoMeta, img: await retratoPropio() },
    ...rivales.map((r) => ({
      nombre: corto(r.nombre), pos: -r.diferencia, tiempo: r.tiempo, dif: r.diferencia,
      img: r.clase && r.rango ? srcRetratoRango(r.clase, r.rango) : null,
    })),
  ].sort((a, b) => b.pos - a.pos || (a.yo ? -1 : 1));
  const xp = s.carreraSinTerminar ? 0 : rivales.filter((r) => r.diferencia > 0 && r.clase).slice(0, 3).reduce((a, r) => a + J.xpPorFantasma(r.dificultad), 0);
  const lugar = filas.findIndex((f) => f.yo) + 1;
  // Sin tiempo, bajo tu nombre va tu clase (antes decía «Tú» dos veces); bajo los fantasmas, la diferencia.
  const tuClase = J.claseDe(leerPersonaje().clase)?.nombre || '';
  const dato = (f) => (f.tiempo != null ? formatoMeta(f.tiempo) : f.yo ? tuClase : `${f.dif > 0 ? '−' : '+'}${miles(Math.abs(f.dif))} m`);
  const bloque = (f, i) => `<div class="podio-puesto p${i + 1}${f.yo ? ' yo' : ''}">
      ${f.img ? `<img src="${f.img}" width="48" height="48" alt="">` : `<span class="podio-ico">${ico('i-fantasma')}</span>`}
      <b>${escaparHtml(f.nombre)}</b><small>${dato(f)}</small>
      <div class="podio-escalon">${i + 1}º</div></div>`;
  const top = filas.slice(0, 3);
  const orden = [top[1], top[0], top[2]].map((f) => (f ? bloque(f, filas.indexOf(f)) : '<div></div>')).join('');
  const titulo = s.carreraSinTerminar ? `Carrera sin terminar: ibas ${lugar}º de ${filas.length}` : lugar === 1 ? '¡Ganaste la carrera!' : `Llegaste ${lugar}º de ${filas.length}`;
  caja.innerHTML = `<h2>${titulo}</h2>
    <div class="podio-escena">${orden}</div>
    ${filas.slice(3).map((f, i) => `<p class="podio-resto">${i + 4}º ${escaparHtml(f.nombre)} · ${dato(f)}</p>`).join('')}
    ${xp ? `<p class="podio-xp">+${xp} XP por fantasmas vencidos</p>` : ''}`;
}
