// Héroe y tienda: personaje, nivel, atributos, árbol, tienda y paisajes.
import { PAISAJES, comprarPaisaje, paisajeElegido, tienePaisaje, usarPaisaje } from '../carrera.js';
import * as H from '../historial.js';
import { hablar } from '../voz.js';
import { confeti } from '../efectos.js';
import * as J from '../juego.js';
import * as O from '../objetos.js';
import * as V from '../ventajas.js';
import * as B from '../base.js';
import * as C from '../consejos.js';
import {
  $, ajustes, contarHasta, escaparHtml, fechaCorta, formatoMeta, ftp, ico, miles, sinMovimiento, toast, vibrar,
} from '../ui.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { pintarClasificacion } from './ajustes.js';
import { estimarFtp, pintarChips, srcRetratoRango } from './preparar.js';
import { pintarModoEnt, retratoPropio, vistaPrevia } from './vivo.js';
import { corto } from './sesion.js';
import { cerrarHoja, llenarSelectorEntrenamientos, obtenerEnt } from './planes.js';

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
  $('#vista-heroe').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-preparar]');
    if (!b) return;
    await prepararEntrenamiento(b.dataset.preparar, b.dataset.reto ? J.DIFICULTAD_RETO[b.dataset.reto] : null);
  });
  $('#linea-nivel').addEventListener('click', () => {
    if ($('#linea-nivel').dataset.talentos) seccionHeroe = 'talentos';
    irA('heroe');
  });
  $('#heroe-avisos').addEventListener('click', (e) => {
    if (e.target.closest('[data-aviso-xp]')) { ajustes.escribir('avisoXpLenta', '1'); pintarHeroe(); }
  });
  $('#niveles-carrusel').addEventListener('scroll', () => requestAnimationFrame(marcarNivel), { passive: true });
  document.querySelector('#hp-niveles').addEventListener('click', (e) => {
    const car = $('#niveles-carrusel');
    const paso = e.target.closest('[data-niv]');
    const ir = e.target.closest('[data-rango]');
    const i = Math.round(car.scrollLeft / car.clientWidth);
    if (paso) car.scrollTo({ left: (i + Number(paso.dataset.niv)) * car.clientWidth, behavior: 'smooth' });
    if (ir) car.scrollTo({ left: Number(ir.dataset.rango) * car.clientWidth, behavior: 'smooth' });
  });

  $('#clases').addEventListener('click', (e) => {
    const b = e.target.closest('[data-clase]');
    if (!b) return;
    claseElegida = b.dataset.clase;
    for (const x of document.querySelectorAll('#clases [data-clase]')) x.setAttribute('aria-checked', String(x === b));
    $('#btn-crear-heroe').disabled = false;
  });
  $('#btn-crear-heroe').addEventListener('click', () => {
    if (!claseElegida) return;
    guardarPersonaje({ clase: claseElegida, nombre: $('#heroe-nombre').value.trim() });
    precargarVideosDeClase();
    confeti();
    pintarHeroe();
  });
  $('#btn-cambiar-clase').addEventListener('click', () => {
    claseElegida = leerPersonaje().clase || null;
    guardarPersonaje({ clase: null });
    pintarHeroe();
  });
  document.querySelector('.heroe-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hp]');
    if (!b) return;
    seccionHeroe = b.dataset.hp;
    pintarHeroe();
  });
  $('#arbol').addEventListener('click', async (e) => {
    const ap = e.target.closest('[data-aprender]');
    if (ap) {
      const { per, h } = await estadoHeroe();
      const clave = J.claseDe(per.clase).clave;
      const slot = ap.dataset.aprender;
      const arbolClase = per.arbol?.[clave] || {};
      if (J.motivoBloqueo(slot, { nivel: h.nivel, libres: h.talentosLibres }, arbolClase, clave)) return;
      guardarPersonaje({ arbol: { ...(per.arbol || {}), [clave]: { ...arbolClase, [slot]: [...(arbolClase[slot] || []), Date.now()] } } });
      const t = J.talentosDe(clave).find((x) => x.slot === slot);
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
    if (!x || h.monedas < x.precio) return;
    const inv = per.inventario || {};
    guardarPersonaje({ inventario: { ...inv, [x.id]: (inv[x.id] || 0) + 1 }, gastado: (per.gastado || 0) + x.precio });
    vibrar(60);
    toast(`${x.nombre} a tu bolsa. Elígela en Entrenar antes de la carrera.`);
    pintarHeroe();
    pintarChips();
  });

  $('#tienda-paisajes').addEventListener('click', async (e) => {
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
      confeti();
      toast(`¡${PAISAJES[id].nombre} es tuyo! Ya lo verás en tu próxima carrera.`);
    }
    usarPaisaje(id);
    vibrar(60);
    pintarHeroe();
  });
  $('#hoja-atr').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-prox]');
    if (!b) return;
    cerrarHoja();
    await prepararEntrenamiento(b.dataset.prox, J.DIFICULTAD_RETO[b.dataset.reto] || null);
  });

  $('#hoja-xp').addEventListener('click', (e) => {
    if (e.target.closest('[data-ir-talentos]')) { cerrarHoja(); seccionHeroe = 'talentos'; irA('heroe'); return; }
    const b = e.target.closest('[data-clase-rapida]');
    if (!b || leerPersonaje().clase) return;
    const c = J.claseDe(b.dataset.claseRapida);
    guardarPersonaje({ clase: c.clave });
    confeti();
    b.closest('.xp-heroe').outerHTML = `<p class="aviso exito">¡Listo! Tu ${c.nombre} ya tiene esta experiencia. Ponle nombre en la pestaña Héroe.</p>`;
    pintarLineaNivel();
  });
}
export function inventario() { return leerPersonaje().inventario || {}; }
export function guardarPersonaje(cambios) {
  ajustes.escribir('personaje', JSON.stringify({ ...leerPersonaje(), ...cambios }));
}
const emblema = (c) => `<svg viewBox="0 0 24 24" aria-hidden="true">${c.icono}</svg>`;
// Ilustración del personaje según su clase y el rango de su nivel (assets/heroes, generados por tools/build-app-assets.py).
export const srcHeroe = (clave, nivel, retrato = false) => `assets/heroes/${clave}_${J.rangoDe(nivel).id}${retrato ? '_retrato' : ''}.webp`;
function figuraHeroe(per, nivel, ancho) {
  const c = J.claseDe(per.clase);
  const alto = Math.round((ancho * 420) / 360);
  return `<div class="heroe-figura" style="width:${ancho}px;height:${alto}px"><svg class="aura" viewBox="0 0 200 200" aria-hidden="true">${O.auraHeroe(per)}</svg>
    <img src="${srcHeroe(c.clave, nivel)}" width="${ancho}" height="${alto}" alt="${c.nombre} ${J.rangoDe(nivel).nombre}"></div>`;
}
// Gráfico de radar de los atributos (SVG, se adapta al tema con currentColor y variables).
function radarAtributos(at, fav) {
  const A = J.ATRIBUTOS;
  const R = 92;
  const max = Math.max(20, ...A.map((a) => at[a.clave] || 0)) * 1.1;
  const punto = (i, r) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / A.length;
    return [150 + r * Math.cos(ang), 130 + r * Math.sin(ang)];
  };
  const poli = (f) => A.map((a, i) => punto(i, f(a)).map((v) => v.toFixed(1)).join(',')).join(' ');
  const anillos = [0.25, 0.5, 0.75, 1].map((k) => `<polygon class="radar-anillo" points="${poli(() => R * k)}"/>`).join('');
  const ejes = A.map((a, i) => { const [x, y] = punto(i, R); return `<line class="radar-eje" x1="150" y1="130" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const etiquetas = A.map((a, i) => {
    const [x, y] = punto(i, R + 22);
    const ancla = Math.abs(x - 150) < 5 ? 'middle' : x > 150 ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${ancla}" class="radar-etq${a.clave === fav ? ' fav' : ''}">${a.nombre}${a.clave === fav ? ' ★' : ''}<tspan x="${x.toFixed(1)}" dy="15" class="radar-valor">${at[a.clave] || 0}</tspan></text>`;
  }).join('');
  const valores = A.map((a, i) => { const [x, y] = punto(i, (R * (at[a.clave] || 0)) / max); return `<circle class="radar-punto" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"/>`; }).join('');
  return `<svg viewBox="-40 -6 380 286" role="img" aria-label="Atributos: ${A.map((a) => `${a.nombre} ${at[a.clave] || 0}`).join(', ')}">
    ${anillos}${ejes}<polygon class="radar-area" points="${poli((a) => (R * (at[a.clave] || 0)) / max)}"/>${valores}${etiquetas}</svg>`;
}
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
let claseElegida = null;
let seccionHeroe = 'ficha';

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
function enSesiones(xp, h) {
  if (!(h.xpPorSesion > 0) || xp <= 0) return '';
  const n = Math.max(1, Math.ceil(xp / h.xpPorSesion));
  return `≈ ${n} ${n === 1 ? 'sesión' : 'sesiones'}`;
}
// «≈ 5 semanas a tu ritmo», con tus sesiones por semana de las últimas 4 semanas.
function enSemanas(xp, h) {
  const porSemana = h.ritmo?.sesSemana;
  if (!(h.xpPorSesion > 0) || !porSemana || xp <= 0) return '';
  const n = Math.max(1, Math.ceil(xp / (h.xpPorSesion * porSemana)));
  return `≈ ${n} ${n === 1 ? 'semana' : 'semanas'} a tu ritmo`;
}

export async function estadoHeroe() {
  const per = leerPersonaje();
  return { per, h: H.estadoJuegoDe(await H.sesiones(), { ftp: ftp(), per }) };
}

export async function pintarHeroe() {
  pintarLineaNivel();
  const per = leerPersonaje();
  const clase = J.claseDe(per.clase);
  $('#heroe-crear').hidden = !!clase;
  $('#heroe-ficha').hidden = !clase;
  if (!clase) {
    // La misma tarjeta que en la bienvenida: elegir clase se ve igual en los dos sitios.
    $('#clases').innerHTML = J.CLASES.map((c) => `<button type="button" class="clase-mini" role="radio" aria-checked="${c.clave === claseElegida}" data-clase="${c.clave}">
      <img src="${srcHeroe(c.clave, 1, true)}" width="56" height="56" alt=""><b>${c.nombre}</b><small>+15 % ${nombreAtributo(c.favorito)}</small><span class="lema">${c.para}</span></button>`).join('');
    $('#btn-crear-heroe').disabled = !claseElegida;
    if (per.nombre && !$('#heroe-nombre').value) $('#heroe-nombre').value = per.nombre;
    return;
  }
  const sesiones = await H.sesiones();
  const h = H.estadoJuegoDe(sesiones, { ftp: ftp(), per });
  $('#heroe-avatar').innerHTML = `<img src="${srcHeroe(clase.clave, h.nivel, true)}" width="84" height="84" alt="${clase.nombre} ${h.titulo}"><span class="emblema mini">${emblema(clase)}</span>`;
  // Sin nombre, el título es la clase y la línea de abajo no la repite.
  $('#heroe-titulo').textContent = per.nombre || clase.nombre;
  $('#heroe-clase').textContent = per.nombre ? `${clase.nombre} · Rango ${h.titulo}` : `Rango ${h.titulo}`;
  pintarClasificacion(sesiones);
  $('#heroe-monedas').innerHTML = `${icoMoneda}${miles(h.monedas)}`;
  $('#heroe-nivel').textContent = h.nivel;
  const pct = h.hasta ? (100 * (h.xp - h.desde)) / (h.hasta - h.desde) : 100;
  $('#heroe-xp-barra').style.width = `${pct}%`;
  const ses = h.hasta ? enSesiones(h.hasta - h.xp, h) : '';
  // El texto cuenta lo mismo que la barra (el avance dentro del nivel); el total va aparte.
  $('#heroe-xp-texto').textContent = h.hasta ? `${miles(h.xp - h.desde)} de ${miles(h.hasta - h.desde)} XP para el nivel ${h.nivel + 1}${ses ? ` (${ses})` : ''} · ${miles(h.xp)} en total` : `${miles(h.xp)} XP · nivel máximo`;
  $('.heroe-xp').setAttribute('aria-valuenow', String(Math.round(pct)));
  pintarAvisosHeroe(h, sesiones);
  for (const b of document.querySelectorAll('.heroe-tabs button')) {
    b.classList.toggle('activa', b.dataset.hp === seccionHeroe);
  }
  for (const el of document.querySelectorAll('.hp')) el.hidden = el.id !== `hp-${seccionHeroe}`;
  ({ ficha: pintarFicha, talentos: pintarTalentos, niveles: pintarNiveles, misiones: pintarMisiones, tienda: pintarTienda })[seccionHeroe](h, per, clase, sesiones);
}

// Aviso arriba del héroe: el cambio a la mitad de XP (una vez, y solo en Ficha: en las otras subpestañas tapaba el contenido).
// Los puntos de talento se anuncian en la línea de nivel.
function pintarAvisosHeroe(h, sesiones) {
  const avisos = [];
  const veterano = sesiones.some((x) => x.fecha < J.XP_LENTA_DESDE);
  if (seccionHeroe === 'ficha' && Date.now() >= J.XP_LENTA_DESDE && veterano && !ajustes.si('avisoXpLenta', false)) {
    avisos.push(`<div class="aviso info heroe-aviso"><span>Desde el 29 de octubre cada sesión, misión y logro da <b>la mitad de XP</b>. Tu nivel no cambia: solo cuesta más subir.</span><button type="button" class="boton chico" data-aviso-xp>Entendido</button></div>`);
  }
  $('#heroe-avisos').innerHTML = avisos.join('');
}

function pintarFicha(h, per, clase, sesiones) {
  $('#ficha-figura').innerHTML = figuraHeroe(per, h.nivel, 140);
  // Lo que te dan ahora los talentos aprendidos, en una línea cada uno.
  const arbol = per.arbol?.[clase.clave] || {};
  const tal = J.talentosDe(clase.clave).map((t) => ({ t, g: J.grado(arbol, clase.clave, t.slot) })).filter((x) => x.g > 0);
  $('#ficha-talentos-caja').hidden = !tal.length;
  $('#ficha-talentos').innerHTML = tal.map(({ t, g }) => `<li><b>${t.nombre}</b><span class="etq-tal ${t.tipo}">${t.tipo === 'xp' ? 'XP' : 'Carrera'}</span><span>${t.textoGrado(g)}</span></li>`).join('');
  $('#heroe-radar').innerHTML = radarAtributos(h.atributos, clase.favorito);
  // Sin banda de pulso, Recuperación casi no crece: no se recomienda (se explica en su ficha).
  const sinPulso = !sesiones.some((x) => x.fcProm > 0);
  const rec = J.recomendarPorAtributos(h.atributos, { sinPulso });
  const semana = J.atributosEntre(h, Date.now() - 7 * 864e5);
  const maximo = Math.max(1, ...Object.values(h.atributos));
  const f = ftp() || estimarFtp(sesiones);
  $('#heroe-atributos').innerHTML = J.ATRIBUTOS.map((a) => {
    const r = J.RECOMENDACION_ATRIBUTO[a.clave];
    const sube = semana[a.clave];
    const nota = a.clave === 'recuperacion' && sinPulso ? '<p class="suave">Sin banda de pulso solo crece con descansos y sesiones suaves.</p>' : '';
    return `<details class="atributo">
      <summary><span class="atr-nombre">${a.nombre}${a.clave === clase.favorito ? ' <span class="fav" title="Favorito de tu clase: crece un 15 % más">★ +15 %</span>' : ''}</span>
        <span class="atr-valor"><b>${miles(h.atributos[a.clave])}</b><small class="${sube ? 'sube' : ''}">${sube ? `+${miles(sube)} esta semana` : 'sin cambios esta semana'}</small></span>
        <span class="atr-barra" aria-hidden="true"><i style="width:${(100 * h.atributos[a.clave]) / maximo}%"></i></span>
        <span class="atr-titulo">${tituloCorto(a.clave, h.atributos[a.clave])}</span></summary>
      <ul>${J.comoSubir(a.clave, f).map((t) => `<li>${t}</li>`).join('')}</ul>${nota}
      <button type="button" class="boton chico${rec?.atributo.clave === a.clave ? ' primario' : ''}" data-preparar="${r.base || ''}" data-reto="${r.reto}">Entrenar ${a.nombre.toLowerCase()}: ${escaparHtml(r.entrenamiento || 'Remo libre suave')}</button>
    </details>`;
  }).join('');
  pintarSemanaHeroe(h, sesiones, f);
  $('#heroe-recomienda').innerHTML = rec ? `<p>Te conviene subir <b>${rec.atributo.nombre}</b>, tu atributo más bajo.<span class="solo-avanzado"> ${rec.texto}</span></p>
    <div class="fila-botones"><button type="button" class="boton primario" data-preparar="${rec.base || ''}" data-reto="${rec.reto}">
    Preparar: ${escaparHtml(rec.entrenamiento || 'Remo libre')} en ${J.DIFICULTADES[J.DIFICULTAD_RETO[rec.reto]].nombre}</button></div>`
    : ''; // Sin sesiones, «Esta semana» ya invita a remar la primera: no se repite aquí.
  // Héroe nuevo: los 7 atributos en una lista compacta, sin barras vacías ni «sin cambios esta semana».
  $('#heroe-atributos').classList.toggle('vacio', !Object.values(h.atributos).some((v) => v > 0));
  // Los premios de capítulos y logros son insignias.
  const premios = [...J.CAPITULOS.map((c) => [c.objeto, c.nombre]), ...J.HAZANAS.filter((x) => x.objeto).map((x) => [x.objeto, x.nombre])];
  const ganadas = premios.filter(([id]) => h.insignias.has(id)).length;
  $('#insignias-historia-resumen').textContent = `${ganadas} de ${premios.length}`;
  premios.sort(([a], [b]) => h.insignias.has(b) - h.insignias.has(a));
  $('#ficha-insignias').innerHTML = premios.map(([id, de]) => `<div class="insignia${h.insignias.has(id) ? '' : ' bloqueada'}"><span class="medalla">${ico('i-trofeo')}</span>
    <b>${O.objeto(id).nombre}</b><small>${de}</small></div>`).join('');
  const ult = [...sesiones].sort((a, b) => b.fecha - a.fecha).slice(0, 3);
  $('#heroe-sesiones').innerHTML = ult.length ? ult.map((x) => {
    const g = h.porSesion.get(x.fecha);
    return `<li><div><b>${fechaCorta(x.fecha)} · ${escaparHtml(x.entrenamiento || 'Remo libre')}</b> <span class="xp">+${miles(g.xp + g.xpExtra)} XP</span> <span class="monedas">${icoMoneda}${g.monedas}</span></div>
      <div class="chips-ganancia solo-avanzado">${Object.entries(g.ganancias).map(([k, v]) => `<span>${nombreAtributo(k)} +${v}</span>`).join('')}</div></li>`;
  }).join('') : '<li class="vacio">Tu primera sesión le dará experiencia a tu héroe.</li>';
}

// «Iniciado de la fuerza · 12 para Diestro».
function tituloCorto(clave, valor) {
  const t = J.tituloAtributo(clave, valor);
  const sig = t.siguiente ? `${miles(t.siguiente.faltan)} para <b>${t.siguiente.nombre.split(' ')[0]}</b>` : 'Título máximo';
  return `${t.actual ? `${t.actual} · ` : ''}${sig}`;
}
// Semana de héroe: la meta de atributo de la semana, una semana sugerida para equilibrarte y el título más cercano.
function pintarSemanaHeroe(h, sesiones, f) {
  const caja = $('#heroe-semana');
  const mi = h.semanales.find((m) => m.clave === 'atributo');
  const sinPulso = h.contexto.sinPulso;
  const flojos = J.ATRIBUTOS.filter((a) => !(sinPulso && a.clave === 'recuperacion'))
    .sort((a, b) => (h.atributos[a.clave] || 0) - (h.atributos[b.clave] || 0)).slice(0, 3);
  if (!mi && !Object.values(h.atributos).some((v) => v > 0)) { caja.innerHTML = '<p class="suave">Rema tu primera sesión y te armo una semana para equilibrar tu héroe.</p>'; return; }
  const o = opcConsejos(h, sesiones);
  const bases = estado.baseActual.length ? estado.baseActual : B.basesPara(h.nivel, ftp(), sesiones);
  const meta = mi ? `<div class="semana-meta${mi.hecha ? ' hecha' : ''}"><div class="fila-meta"><div><b>${mi.hecha ? '¡Meta cumplida!' : `Meta: sube ${nombreAtributo(mi.atributo)}`}</b><small>${escaparHtml(mi.texto)}</small></div>
      <span class="anillo grande" style="--p:${Math.round((100 * mi.valor) / mi.meta)}%"><i>${mi.valor}/${mi.meta}</i></span></div>
      <small class="premio">Premio: <b>+${miles(mi.xp)} XP</b> y ${icoMoneda}${mi.monedas}</small></div>` : '';
  const filas = flojos.map((a) => {
    const id = J.PREPARAR_ATRIBUTO[a.clave];
    const ent = bases.find((x) => x.id === id);
    const p = ent && previsionDe(ent, o);
    const pts = p?.seguro[a.clave];
    return `<li><div><b>${escaparHtml(ent?.nombre || 'Remo libre')}</b><small>Para ${a.nombre} · vas en ${miles(h.atributos[a.clave] || 0)}</small></div>
      <span class="cond-pts">${pts ? `+${pts} ${a.nombre.slice(0, 3)}.` : ''}</span><button type="button" class="boton chico" data-preparar="${id || ''}" data-reto="${J.RECOMENDACION_ATRIBUTO[a.clave].reto}">Preparar</button></li>`;
  }).join('');
  const cercano = J.ATRIBUTOS.map((a) => ({ a, t: J.tituloAtributo(a.clave, h.atributos[a.clave]) })).filter((x) => x.t.siguiente)
    .sort((x, y) => x.t.siguiente.faltan - y.t.siguiente.faltan)[0];
  caja.innerHTML = `${meta}<div class="solo-avanzado"><p class="etq-campo">Semana sugerida para equilibrarte</p><ul class="semana-sugerida">${filas}</ul></div>
    ${cercano ? `<p class="titulo-cerca">${ico('i-trofeo')}<span>${cercano.a.nombre} ${miles(h.atributos[cercano.a.clave] || 0)} → título <b>«${cercano.t.siguiente.nombre}»</b>. Te faltan ${miles(cercano.t.siguiente.faltan)}.</span></p>` : ''}`;
}

// «+1 / 2 / 3 XP»: resalta el valor del grado que tienes (o del siguiente, si aún no lo aprendiste).
function gradoResaltado(texto, g, max) {
  const i = Math.min(max, Math.max(1, g || 1)) - 1;
  return texto.replace(/[+−-]?\d+(?:,\d+)?(?: \/ \d+(?:,\d+)?)+/g, (serie) => serie.split(' / ')
    .map((v, k) => (k === i ? `<b class="grado-actual" title="${g ? 'Tu grado' : 'Al aprenderlo'}">${v}</b>` : `<span class="grado-otro">${v}</span>`)).join(' / '));
}
function pintarTalentos(h, per, clase) {
  const arbol = per.arbol?.[clase.clave] || {};
  const est = { nivel: h.nivel, libres: h.talentosLibres };
  const antiguo = J.tieneArbolAntiguo(arbol) && J.puntosGastados(arbol) === 0;
  const pts = (n) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;
  const guardados = h.talentosLibres - h.talentosPorRepartir;
  $('#talentos-libres').textContent = `${h.talentosPorRepartir > 0
    ? `Tienes ${pts(h.talentosPorRepartir)} de talento para repartir.${guardados > 0 ? ` Guardas ${pts(guardados)} más para cuando se abran otros talentos.` : ''}`
    : h.talentosLibres > 0 ? `Guardas ${pts(h.talentosLibres)}: ahora no hay ningún talento que puedas subir.` : 'Sin puntos libres.'} Ganas 1 punto cada 3 niveles.${antiguo ? ' Los talentos cambiaron: te devolvimos todos tus puntos para que los repartas de nuevo.' : ''}`;
  const fila = (t) => {
    const g = J.grado(arbol, clase.clave, t.slot);
    const motivo = J.motivoBloqueo(t.slot, est, arbol, clase.clave);
    const pips = Array.from({ length: t.max }, (_, i) => `<i class="${i < g ? 'lleno' : ''}"></i>`).join('');
    const accion = motivo
      ? `<span class="${g >= t.max ? 'ok-texto' : 'suave'}">${motivo}</span>`
      : `<button type="button" class="boton" data-aprender="${t.slot}">${g ? 'Subir de grado' : 'Aprender'} · ${t.coste} ${t.coste === 1 ? 'punto' : 'puntos'}</button>`;
    // Cuánto te daría el siguiente grado con lo que remas de verdad (solo los de XP).
    const xpEst = t.tipo === 'xp' && g < t.max ? J.xpTalentoEstimada(h, clase.clave, t.slot, g + 1) : null;
    const valor = xpEst == null ? '' : xpEst > 0
      ? `<p class="talento-valor">Con tus últimas sesiones: <b>≈ +${miles(xpEst)} XP por sesión</b>${g ? ' más' : ''}</p>`
      : '<p class="talento-valor nada">Con tus últimas sesiones no sumaría XP: no cumplen lo que pide.</p>';
    return `<div class="talento ${g ? 'aprendido' : motivo && g < t.max ? 'bloqueado' : 'disponible'}">
      <div class="talento-cab"><b>${t.nombre}</b><span class="etq-tal ${t.tipo}">${t.tipo === 'xp' ? 'XP' : 'Carrera'}</span><span class="pips" aria-label="Grado ${g} de ${t.max}">${pips}</span></div>
      <p>${gradoResaltado(t.texto, g, t.max)}</p>${valor}<div class="talento-pie"><small class="suave">Desde el nivel ${t.nivel}${g && g < t.max ? ` · Ahora: ${t.textoGrado(g).replace(/\.$/, '')}` : ''}</small>${accion}</div></div>`;
  };
  const ts = J.talentosDe(clase.clave);
  $('#arbol').innerHTML = `<div class="rama"><div class="rama-titulo"><b>${J.cualidadDe(clase.clave)}</b><span>${clase.nombre}</span></div>
      <p class="suave lema-tal">${J.lemaTalentos(clase.clave)} Solo cuentan en la XP y en las carreras contra fantasmas: tus métricas no cambian.</p>
      <h4 class="sub-tal">Mejoras de nivel</h4>${ts.filter((t) => !t.maestria).map(fila).join('')}
      <h4 class="sub-tal">Maestría</h4>${ts.filter((t) => t.maestria).map(fila).join('')}</div>`;
}

// Niveles: un panel por rango (del 1 al 90) con la ilustración del héroe en ese rango y lo que trae cada nivel.
function pintarNiveles(h, per, clase) {
  const R = J.RANGOS;
  const actual = R.indexOf(J.rangoDe(h.nivel));
  const abre = { 20: 'Se abren las mejoras de nivel 3 y 4 de tus talentos', 40: 'Se abre la maestría de tus talentos' };
  const filas = (desde, hasta) => {
    let html = '';
    for (let n = desde; n <= hasta; n++) {
      const extras = [];
      if (n > 1 && n % 3 === 0) extras.push('+1 punto de talento');
      if (abre[n]) extras.push(abre[n]);
      const estado = n < h.nivel ? 'hecho' : n === h.nivel ? 'actual' : '';
      html += `<li class="${estado}"><b>Nivel ${n}</b><span>${n === 1 ? 'Inicio' : `${miles(J.xpParaNivel(n))} XP`}</span>${extras.length ? `<em>${extras.join(' · ')}</em>` : ''}</li>`;
    }
    return html;
  };
  $('#niveles-carrusel').innerHTML = R.map((r, i) => {
    const hasta = i + 1 < R.length ? R[i + 1].nivel - 1 : J.NIVEL_MAX;
    const falta = J.xpParaNivel(r.nivel) - h.xp;
    const cuando = [enSesiones(falta, h), enSemanas(falta, h)].filter(Boolean).join(' · ');
    const estado = i < actual ? 'Alcanzado' : i === actual ? `Tu rango · nivel ${h.nivel}` : `Te faltan ${miles(falta)} XP${cuando ? `<br><small>${cuando}</small>` : ''}`;
    return `<section class="nivel-panel${i > actual ? ' futuro' : ''}${i === actual ? ' actual' : ''}" aria-label="${r.nombre}">
      <div class="nivel-figura"><img src="assets/heroes/${clase.clave}_${r.id}.webp" width="216" height="252" alt="${clase.nombre} ${r.nombre}" loading="lazy"></div>
      <h3>${r.nombre}</h3><p class="nivel-rango">Niveles ${r.nivel}–${hasta}</p><p class="nivel-estado">${i > actual ? '🔒 ' : ''}${estado}</p>
      <ul class="nivel-lista">${filas(r.nivel, hasta)}</ul></section>`;
  }).join('');
  $('#niveles-puntos').innerHTML = R.map((r, i) => `<button type="button" data-rango="${i}" aria-label="Ver ${r.nombre}"${i === actual ? ' class="tuyo"' : ''}></button>`).join('');
  const car = $('#niveles-carrusel');
  requestAnimationFrame(() => { car.scrollLeft = actual * car.clientWidth; marcarNivel(); });
}
function marcarNivel() {
  const car = $('#niveles-carrusel');
  const i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth));
  $('#niveles-puntos').querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
}

const NOMBRE_PRUEBA = { 'base:prueba-500': 'Prueba 500 m', 'base:prueba-2000': 'Prueba 2000 m', 'base:prueba-ftp': 'Prueba FTP 20 min' };
// Unidad de cada misión y logro, para que el avance diga «2.5 de 6 km» y no «2,500 de 6,000».
const UNIDAD_MISION = {
  impulso: 'm', distdia: 'm', nordica: 'm', tiempo: 'min', constante: 'min', zona2: 'min', umbral: 'min', vo2: 'min', fondo: 'min', oceano: 'min',
  kcal: 'kcal', kcalsem: 'kcal', corazon: 'lpm', rango: '%', ruta: 'km', disciplina: 'días', rumbo: 'sesiones', bushido: 'sesiones', dominio: 'misiones',
  gran: 'km', canal: 'km', km50: 'km', km100: 'km', hora: 'min', ses25: 'sesiones', racha14: 'semanas', clases4: 'clases',
  'cap-sesiones': 'sesiones', 'cap-km': 'km', 'cap-z2min': 'min', 'cap-z4min': 'min', 'cap-fantasmas': 'fantasmas', 'cap-racha': 'días',
};
const unaCifra = (v) => (Math.round(v * 10) / 10).toLocaleString('es-MX');
function avanceMision(m) {
  const u = UNIDAD_MISION[m.clave || String(m.id).split(':').pop()];
  if (u === 'm') return `${unaCifra(m.valor / 1000)} de ${unaCifra(m.meta / 1000)} km`;
  const valor = m.meta >= 100 ? miles(m.valor) : unaCifra(m.valor);
  return `${valor} de ${miles(m.meta)}${u ? (u === '%' ? ' %' : ` ${u}`) : ''}`;
}
function filaMision(m) {
  const pct = Math.min(100, (100 * m.valor) / m.meta);
  // Las misiones del día y de la semana tienen un atajo a Entrenar con lo que piden.
  const atajo = m.preparar != null && !m.hecha ? `<button type="button" class="enlace-boton" data-preparar="${m.preparar}">Hacer ahora ›</button>` : '';
  return `<li class="${m.hecha ? 'hecha' : ''}"><div class="mision-fila"><span>${m.hecha ? ico('i-check') : ''}${m.nombre ? `<b>${m.nombre}</b> · ` : ''}${m.texto}</span>
    <span class="recompensa">${m.xp ? `<span class="xp">+${miles(m.xp)} XP</span>` : ''}${m.monedas ? `<span class="monedas">${icoMoneda}${m.monedas}</span>` : ''}</span></div>
    <div class="progreso"><div style="width:${pct}%"></div></div><div class="mision-pie"><small>${avanceMision(m)}${m.premio ? ` · premio: <b>${m.premio}</b>` : ''}</small>${atajo}</div></li>`;
}

function pintarMisiones(h) {
  // Lo pendiente arriba; lo hecho baja y se ve como una sola línea.
  const pendientesPrimero = (l) => [...l].sort((a, b) => a.hecha - b.hecha);
  $('#mis-diarias').innerHTML = pendientesPrimero(h.diarias).map((m) => filaMision(m)).join('');
  $('#mis-semanales').innerHTML = pendientesPrimero(h.semanales).map((m) => filaMision(m)).join('');
  const c = h.capitulo;
  $('#mis-capitulo').innerHTML = c ? `<div class="cap-cabecera"><span class="etq">Capítulo ${c.n} de ${J.CAPITULOS.length}</span><b>${c.nombre}</b><p>${c.historia}</p><p class="cap-avance">${c.listo
      ? `Vence a ${c.jefe.nombre} para ${c.n < J.CAPITULOS.length ? `pasar al capítulo ${c.n + 1}` : 'terminar la historia'}.`
      : `El jefe se desbloquea al cumplir lo de abajo o al llegar al nivel ${c.nivel}.`}${c.pendiente ? ' Ya lo venciste antes de tiempo: en cuanto se desbloquee, el capítulo es tuyo con tu próxima sesión.' : ''}</p></div>
    <ul class="lista misiones">${c.progreso.map((r) => filaMision({ clave: `cap-${r.clave}`, texto: r.texto, meta: r.meta, valor: r.valor, monedas: '', hecha: r.valor >= r.meta })).join('')}</ul>
    <div class="jefe ${c.listo ? 'listo' : ''}">${ico('i-fuego')}<div><b>Jefe: ${c.jefe.nombre}</b><small>${c.jefe.texto}, ${J.OTRAS_FORMAS_JEFE}${
      c.listo ? ' · ¡ya puedes enfrentarlo!' : ` · se desbloquea al cumplir lo de arriba o en el nivel ${c.nivel}`}</small></div>
      <span class="premio"><span class="xp">+${miles(c.xp)} XP</span> ${icoMoneda}${c.monedas + J.PREMIO_INSIGNIA} + insignia</span>
      ${c.listo ? `<button type="button" class="boton primario jefe-boton" data-preparar="${c.preparar}">Enfrentar: ${NOMBRE_PRUEBA[c.preparar]}</button>` : ''}</div>`
    : '<p class="aviso exito">¡Terminaste la historia! Eres una leyenda de los mares.</p>';
  // Logros: primero los que te faltan, del más cercano al más lejano; los hechos al final.
  const avance = (x) => (x.hecha ? -1 : x.valor / x.meta);
  const logro = (x) => filaMision({ clave: x.id, nombre: x.nombre, texto: x.texto, meta: x.meta, valor: x.valor, xp: x.xp, monedas: x.monedas + (x.objeto ? J.PREMIO_INSIGNIA : 0), premio: x.objeto ? `insignia ${O.objeto(x.objeto).nombre}` : '', hecha: x.hecha });
  // Los logros hechos se guardan en un desplegable: arriba quedan solo los que te faltan.
  const hechos = h.hazanas.filter((x) => x.hecha);
  $('#mis-hazanas').innerHTML = h.hazanas.filter((x) => !x.hecha).sort((a, b) => avance(b) - avance(a)).map(logro).join('')
    + (hechos.length ? `<li class="hechos-grupo"><details><summary>${ico('i-check')}Completados <span class="seccion-resumen">${hechos.length}</span></summary><ul class="lista misiones">${hechos.map(logro).join('')}</ul></details></li>` : '');
}

const ICONO_VENTAJA = { salida: 'i-play', viento: 'i-sube', ancla: 'i-baja', segunda: 'i-corazon', estandarte: 'i-trofeo', mapa: 'i-fantasma' };
function pintarTienda(h, per) {
  const lunes = J.lunesDe(Date.now());
  const items = J.tiendaSemana(lunes);
  const inv = per.inventario || {};
  const sig = new Date(`${lunes}T12:00`);
  sig.setDate(sig.getDate() + 7);
  $('#tienda-info').innerHTML = `Tienes ${icoMoneda}<b>${miles(h.monedas)}</b>. Ventajas de un solo uso para tus carreras contra fantasmas: una por carrera y nunca en las pruebas. La tienda cambia el lunes ${sig.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}.`;
  $('#tienda').innerHTML = items.map((x) => `<div class="objeto ventaja"><span class="ventaja-ico">${ico(ICONO_VENTAJA[x.id])}</span><b>${x.nombre}</b><small>${x.texto}</small>
    <span class="monedas">${icoMoneda}${x.precio}</span>${inv[x.id] ? `<span class="tienes">Tienes ${inv[x.id]}</span>` : ''}
    <button type="button" class="boton chico" data-comprar="${x.id}" ${h.monedas < x.precio ? 'disabled' : ''}>${h.monedas < x.precio ? 'Te faltan monedas' : 'Comprar'}</button></div>`).join('');
  const elegido = paisajeElegido(per);
  $('#tienda-paisajes').innerHTML = Object.entries(PAISAJES).map(([id, x]) => {
    const tiene = tienePaisaje(per, id);
    const boton = id === elegido ? '<span class="paisaje-uso">En uso</span>'
      : tiene ? `<button type="button" class="boton chico" data-paisaje="${id}">Usar</button>`
        : `<button type="button" class="boton chico" data-paisaje="${id}" ${h.monedas < x.precio ? 'disabled' : ''}>${h.monedas < x.precio ? `Te faltan ${miles(x.precio - h.monedas)}` : 'Comprar'}</button>`;
    return `<div class="objeto paisaje${id === elegido ? ' activo' : ''}"><img src="${x.miniatura}" alt="" loading="lazy" width="320" height="138"><b>${x.nombre}</b><small>${x.texto}</small>
      <span class="monedas">${x.precio ? (tiene ? 'Comprado' : `${icoMoneda}${x.precio}`) : 'Gratis'}</span>${boton}</div>`;
  }).join('');
  const tengo = V.OBJETOS_VENTAJA.filter((x) => inv[x.id] > 0);
  $('#inventario').innerHTML = tengo.length ? tengo.map((x) => `<li><div class="mision-fila"><span><b>${x.nombre}</b> · ${x.texto}</span><span class="recompensa"><span class="xp">×${inv[x.id]}</span></span></div></li>`).join('')
    : '<li class="vacio">Aún no tienes ventajas. Cómpralas aquí y elígelas en Entrenar antes de la carrera.</li>';
}

// Pide al service worker que guarde los vídeos de tu clase (la vista realista) para verlos sin conexión.
// Los de las otras clases no se descargan.
export function precargarVideosDeClase() {
  const clase = leerPersonaje().clase;
  if (!clase || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ tipo: 'precargar', clase })).catch(() => {});
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
  const jefe = g.jefe ? `<div class="jefe-vencido" role="status">${ico('i-trofeo')}<div><b>¡Jefe vencido!</b><span>${escaparHtml(g.jefe.nombre)} cae y terminas el capítulo ${g.jefe.capitulo} de ${J.CAPITULOS.length}.</span><small>Insignia ${escaparHtml(O.objeto(g.jefe.objeto)?.nombre || '')}</small></div></div>` : '';
  caja.innerHTML = `${jefe}<span class="xp-total">+${miles(g.xp + g.xpExtra)} XP</span> <span class="monedas grande">${icoMoneda}+${miles(monedas)}</span>
    ${subio ? `<span class="subio">¡${clase ? clase.nombre : 'Tu héroe'} sube a nivel ${g.nivelDespues}!${ascenso ? ` Ahora es ${J.rangoDe(g.nivelDespues).nombre}.` : ''}</span>` : ''}
    ${puntos > 0 && clase && h.talentosPorRepartir > 0 ? `<span class="subio-talento">+${puntos} ${puntos === 1 ? 'punto' : 'puntos'} de talento <button type="button" class="boton chico primario" data-ir-talentos>Repartir</button></span>` : ''}
    <div class="progreso heroe-xp" role="progressbar" aria-label="Experiencia hacia el siguiente nivel"><div style="width:${h.hasta ? (100 * (h.xp - h.desde)) / (h.hasta - h.desde) : 100}%"></div></div>
    ${g.avisoDescanso ? '<p class="aviso-descanso suave">Hoy tocaba descanso: mañana tu sesión dura puede costarte más.</p>' : ''}
    <small class="xp-nivel">Nivel ${h.nivel}${h.hasta ? ` · faltan ${miles(h.hasta - h.xp)} XP para el ${h.nivel + 1}${ses ? ` (${ses})` : ''}` : ''}</small>
    <details class="xp-desglose"${resumen ? '' : ' open'}><summary>Cómo la ganaste${logros.length ? ` · ${logros.length} ${logros.length === 1 ? 'logro' : 'logros'}` : ''}</summary>
    ${logros.map((l) => `<div class="logro ${l.tipo}">${ico(l.tipo === 'jefe' || l.tipo === 'hazana' ? 'i-trofeo' : 'i-check')}<span>${l.texto}${l.objeto ? ` · insignia <b>${O.objeto(l.objeto).nombre}</b>` : ''}</span><span class="recompensa">${l.xp ? `<span class="xp">+${miles(l.xp)} XP</span>` : ''}<span class="monedas">${icoMoneda}${l.monedas}</span></span></div>`).join('')}
    <div class="chips-ganancia">${Object.entries(g.ganancias).map(([k, v]) => `<span>${nombreAtributo(k)} +${v}</span>`).join('')}</div>
    <ul>${g.detalle.map(([t, v]) => `<li><span>${t}</span><span>+${miles(v)}</span></li>`).join('')}</ul>
    ${J.usaCarga(s) ? '<p class="suave xp-mitad">La XP sale de la carga del entrenamiento (con tope diario) y de cumplir tu plan. Fantasmas, racha y talentos siguen a la mitad.</p>' : J.factorXp(s.fecha) < 1 ? '<p class="suave xp-mitad">Desde el 29 de octubre todo da la mitad de XP: estas cifras ya lo incluyen.</p>' : ''}</details>
    ${clase ? '' : `<div class="xp-heroe"><p>Elige tu héroe y quédate con esta experiencia:</p><div class="clases-mini">${J.CLASES.map((c) => `<button type="button" data-clase-rapida="${c.clave}"><img src="${srcHeroe(c.clave, 1, true)}" width="48" height="48" alt=""><span>${c.nombre}</span></button>`).join('')}</div></div>`}`;
  if (resumen) {
    const total = g.xp + g.xpExtra;
    contarHasta(caja.querySelector('.xp-total'), total, (v) => `+${miles(v)} XP`);
    const barra = caja.querySelector('.heroe-xp > div');
    const final = barra.style.width;
    const antes = subio || !h.hasta ? 0 : Math.max(0, (100 * (h.xp - total - h.desde)) / (h.hasta - h.desde));
    if (!sinMovimiento()) { barra.style.transition = 'none'; barra.style.width = `${antes}%`; void barra.offsetWidth; barra.style.transition = 'width 1.1s cubic-bezier(.2, .8, .2, 1)'; requestAnimationFrame(() => { barra.style.width = final; }); }
  }
  if (subio) hablar(ascenso ? `Subiste a nivel ${g.nivelDespues}. Ahora eres ${J.rangoDe(g.nivelDespues).nombre}` : `Subiste a nivel ${g.nivelDespues}`);
  if (resumen && logros.some((l) => l.tipo === 'jefe')) hablar('¡Jefe vencido!');
  return subio || logros.some((l) => l.tipo === 'jefe' || l.tipo === 'hazana');
}

// Al terminar: lo que lograste, lo que te quedó cerca (con sus puntos) y qué entrenar la próxima vez.
export function pintarAtrSesion(s, previas, resumen) {
  const caja = $('#hoja-atr');
  estado.atrAbierta = { s, previas, resumen };
  const per = leerPersonaje();
  const ant = previas.filter((x) => x.fecha < s.fecha && x.paladas > 0 && x.distancia > 0);
  const mpp = ant.length ? ant.reduce((a, x) => a + x.distancia / x.paladas, 0) / ant.length : 0;
  const f = ftp() || estimarFtp(previas) || 150;
  const r = C.analisis(s, { ftp: f, clase: per.clase || null, ctx: { mppPromedio: mpp } });
  let prox = '';
  if (resumen) {
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
