// Pantalla del héroe: ficha, camino (talentos y rangos), misiones, colección y tienda. Se carga al abrir la pestaña
// Héroe (ver pintarHeroe en heroe.js); lo que usan otras pantallas se queda en heroe.js.
import { PAISAJES, VELAS, paisajeElegido, tienePaisaje, tieneVelas, usarEquipo } from '../carrera.js';
import * as CB from '../coleccion-bote.js';
import * as H from '../historial.js';
import * as J from '../juego.js';
import * as O from '../objetos.js';
import * as V from '../ventajas.js';
import * as B from '../base.js';
import {
  $, ajustes, escaparHtml, fechaCorta, ftp, ico, miles, toast, 
} from '../ui.js';
import { estado } from '../estado.js';
import { pintarClasificacion } from './ajustes.js';
import { estimarFtp } from './preparar.js';
import { HABILIDADES, habilidadDe, RESERVA } from '../habilidades.js';

import { ctxColeccion, emblema, enSesiones, equipoActual, fichaInsignia, icoMoneda, leerPersonaje, nombreAtributo, opcConsejos, pintarLineaNivel, previsionDe, srcHeroe, vh } from './heroe.js';

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
// Maestría de la clase (etapa 7): nivel del 1 al 10 y cuántas sesiones faltan para el siguiente.
function pintarMaestria(m, clase) {
  const el = $('#heroe-maestria');
  if (!el || !m) return;
  const pct = m.hasta == null ? 100 : Math.round(((m.sesiones - m.desde) / (m.hasta - m.desde)) * 100);
  const sig = m.hasta == null ? 'Dominas tu cultura.' : `${m.siguiente} ${m.siguiente === 1 ? 'sesión' : 'sesiones'} más para el nivel ${m.nivel + 1}.`;
  el.innerHTML = `<div class="maestria-cab"><b>Maestría de ${clase.nombre}: ${m.nivel ? `${m.nivel} de ${J.MAESTRIA_MAX} · ${m.nombre}` : 'sin empezar'}</b></div>
    <div class="progreso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Avance de la maestría"><div style="width:${pct}%"></div></div>
    <small class="suave">${sig} Cuentan las sesiones de 10 min o más con esta clase; si cambias, cada clase guarda la suya.</small>`;
}

export async function pintarHeroe() {
  pintarLineaNivel();
  const per = leerPersonaje();
  const clase = J.claseDe(per.clase);
  $('#heroe-crear').hidden = !!clase;
  $('#heroe-ficha').hidden = !clase;
  if (!clase) {
    // La misma tarjeta que en la bienvenida: elegir clase se ve igual en los dos sitios.
    $('#clases').innerHTML = J.CLASES.map((c) => `<button type="button" class="clase-mini" role="radio" aria-checked="${c.clave === vh.claseElegida}" data-clase="${c.clave}">
      <img src="${srcHeroe(c.clave, 1, true)}" width="56" height="56" alt=""><b>${c.nombre}</b><small>+15 % ${nombreAtributo(c.favorito)}</small><span class="lema">${c.para}</span></button>`).join('');
    $('#btn-crear-heroe').disabled = !vh.claseElegida;
    if (per.nombre && !$('#heroe-nombre').value) $('#heroe-nombre').value = per.nombre;
    // La maestría de cada clase: cambiar no borra lo ganado con las otras.
    if (per.claseHist?.length) {
      const hm = H.estadoJuegoDe(await H.sinMuestras(), { ftp: ftp(), per }).maestria;
      for (const b of document.querySelectorAll('#clases [data-clase]')) {
        const m = hm[b.dataset.clase];
        if (m?.nivel) b.insertAdjacentHTML('beforeend', `<small class="maestria-mini">Maestría ${m.nivel} · ${m.nombre}</small>`);
      }
    }
    return;
  }
  const sesiones = await H.sinMuestras();
  const h = H.estadoJuegoDe(sesiones, { ftp: ftp(), per });
  $('#heroe-avatar').innerHTML = `<img src="${srcHeroe(clase.clave, h.nivel, true)}" width="84" height="84" alt="${clase.nombre} ${h.titulo}"><span class="emblema mini">${emblema(clase)}</span>`;
  // Sin nombre, el título es la clase y la línea de abajo no la repite.
  $('#heroe-titulo').textContent = per.nombre || clase.nombre;
  $('#heroe-clase').textContent = J.TITULOS_CLASE[clase.clave] ? `${clase.nombre} · ${h.titulo}` : per.nombre ? `${clase.nombre} · Rango ${h.titulo}` : `Rango ${h.titulo}`;
  pintarClasificacion(sesiones);
  pintarMaestria(h.maestria[clase.clave], clase);
  $('#heroe-monedas').innerHTML = `${icoMoneda}${miles(h.monedas)}`;
  $('#heroe-nivel').textContent = h.nivel;
  const pct = h.hasta ? (100 * (h.xp - h.desde)) / (h.hasta - h.desde) : 100;
  $('#heroe-xp-barra').style.width = `${pct}%`;
  const ses = h.hasta ? enSesiones(h.hasta - h.xp, h) : '';
  // El texto cuenta lo mismo que la barra (el avance dentro del nivel); el total va aparte.
  // Una línea: cuándo llega el siguiente nivel y el avance que marca la barra. El total de XP está en la guía («?»).
  $('#heroe-xp-texto').textContent = h.hasta ? `${miles(h.xp - h.desde)} / ${miles(h.hasta - h.desde)} XP${ses ? ` · subes en ${ses}` : ''}` : `${miles(h.xp)} XP · nivel máximo`;
  $('.heroe-xp').setAttribute('aria-valuenow', String(Math.round(pct)));
  pintarAvisosHeroe(h, sesiones);
  for (const b of document.querySelectorAll('.heroe-tabs button')) {
    b.classList.toggle('activa', b.dataset.hp === vh.seccion);
    b.setAttribute('aria-selected', String(b.dataset.hp === vh.seccion));
  }
  for (const el of document.querySelectorAll('.hp')) el.hidden = el.id !== `hp-${vh.seccion}`;
  ({ ficha: pintarFicha, camino: pintarCamino, misiones: pintarMisiones, tienda: pintarTienda })[vh.seccion](h, per, clase, sesiones);
}

// Aviso arriba del héroe: el cambio a la mitad de XP (una vez, y solo en Ficha: en las otras subpestañas tapaba el contenido).
// Los puntos de talento se anuncian en la línea de nivel.
function pintarAvisosHeroe(h, sesiones) {
  const avisos = [];
  const veterano = sesiones.some((x) => x.fecha < J.XP_LENTA_DESDE);
  if (vh.seccion === 'ficha' && Date.now() >= J.XP_LENTA_DESDE && veterano && !ajustes.si('avisoXpLenta', false)) {
    avisos.push(`<div class="aviso info heroe-aviso"><span>Desde el 29 de octubre cada sesión, misión y logro da <b>la mitad de XP</b>. Tu nivel no cambia: solo cuesta más subir.</span><button type="button" class="boton chico" data-aviso-xp>Entendido</button></div>`);
  }
  $('#heroe-avisos').innerHTML = avisos.join('');
}

function pintarFicha(h, per, clase, sesiones) {
  $('#ficha-figura').innerHTML = figuraHeroe(per, h.nivel, 140);
  // Lo que te dan ahora los talentos aprendidos, en una línea cada uno.
  const arbol = per.arbol?.[clase.clave] || {};
  const tal = J.talentosDe(clase.clave, J.sendaEn(per, clase.clave)).map((t) => ({ t, g: J.grado(arbol, clase.clave, t.slot) })).filter((x) => x.g > 0);
  $('#ficha-talentos-caja').hidden = !tal.length;
  $('#ficha-talentos').innerHTML = tal.map(({ t, g }) => `<li><b>${t.nombre}</b><span class="etq-tal ${t.tipo}">${t.tipo === 'xp' ? 'XP' : 'Carrera'}</span><span>${t.textoGrado(g)}</span></li>`).join('');
  $('#heroe-radar').innerHTML = radarAtributos(h.atributos, clase.favorito);
  // Sin banda de pulso, Recuperación casi no crece: no se recomienda (se explica en su ficha).
  const sinPulso = !sesiones.some((x) => x.fcProm > 0);
  const rec = J.recomendarPorAtributos(h.atributos, { sinPulso });
  const semana = J.atributosEntre(h, Date.now() - 7 * 864e5);
  const maximo = Math.max(1, ...Object.values(h.atributos));
  const hayAlguno = Object.values(h.atributos).some((v) => v > 0);
  const f = ftp() || estimarFtp(sesiones);
  $('#heroe-atributos').innerHTML = J.ATRIBUTOS.map((a) => {
    const r = J.RECOMENDACION_ATRIBUTO[a.clave];
    const sube = semana[a.clave];
    const nota = a.clave === 'recuperacion' && sinPulso ? '<p class="suave">Sin banda de pulso solo crece con descansos y sesiones suaves.</p>' : '';
    // Un atributo que aún no has entrenado no se muestra como un 0 eterno: dice «sin entrenar aún» y viene abierto,
    // con el botón al entrenamiento que lo sube a la vista (en un héroe nuevo, con todo a 0, no: sería ruido).
    const sinEntrenar = !h.atributos[a.clave] && hayAlguno;
    return `<details class="atributo${sinEntrenar ? ' sin-entrenar' : ''}"${sinEntrenar ? ' open' : ''}>
      <summary><span class="atr-nombre">${a.nombre}${a.clave === clase.favorito ? ' <span class="fav" title="Favorito de tu clase: crece un 15 % más">★ +15 %</span>' : ''}</span>
        <span class="atr-valor">${sinEntrenar ? '<b class="atr-sin">Sin entrenar aún</b>' : `<b>${miles(h.atributos[a.clave])}</b><small class="${sube ? 'sube' : ''}">${sube ? `+${miles(sube)} esta semana` : 'sin cambios esta semana'}</small>`}</span>
        <span class="atr-barra" aria-hidden="true"><i style="width:${(100 * h.atributos[a.clave]) / maximo}%"></i></span>
        <span class="atr-titulo">${tituloCorto(a.clave, h.atributosTotal[a.clave])}</span></summary>
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
  $('#heroe-atributos-nota').textContent = J.TEXTO_ATRIBUTOS;
  pintarInsigniasHistoria(h, per);
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
// Insignias de la historia: los jefes de los capítulos y los logros con premio. Cada ficha dice qué la gana («Cómo»),
// cuánto llevas y, si ya es tuya, cuándo la ganaste. Un mismo objeto es una sola ficha (el aura de hielo tiene dos logros).
function pintarInsigniasHistoria(h, per) {
  const fechaDe = (obj) => h.logros.find((l) => l.objeto === obj)?.fecha;
  const fichas = J.CAPITULOS.map((c0, i) => {
    const c = J.capituloDe(i, per.clase);
    const ganada = h.insignias.has(c.objeto);
    const actual = !ganada && i === h.capitulosHechos && h.capitulo;
    const avance = ganada ? null : actual
      ? (h.capitulo.listo ? { texto: `¡Ya puedes enfrentarlo! También vale cumplir la sesión clave de tu plan, ganar en Alta mar o cumplir una semana del plan.` }
        : { texto: `Se abre al cumplir ${h.capitulo.progreso.map((r) => avanceMision({ clave: `cap-${r.clave}`, meta: r.meta, valor: r.valor })).join(' · ')}, o en el nivel ${c.nivel}` })
      : { texto: `Antes, termina el capítulo ${i}.` };
    return { objeto: c.objeto, titulo: `Capítulo ${i + 1} · ${c.nombre}`, ganada, pasado: ganada, orden: ganada ? 2 : actual ? 0.5 : 1 + i / 100,
      como: ganada ? `Venciste a ${c.jefe.nombre}` : `Vence a ${c.jefe.nombre}: ${c.jefe.texto.charAt(0).toLowerCase()}${c.jefe.texto.slice(1)}`, avance };
  });
  const porObjeto = new Map();
  for (const x of h.hazanas.filter((y) => y.objeto)) {
    const previa = porObjeto.get(x.objeto);
    // Del mismo objeto: la ganada, o si ninguna, la que aún se puede ganar.
    if (!previa || (x.hecha && !previa.hecha) || (!previa.hecha && previa.oculto)) porObjeto.set(x.objeto, x);
  }
  for (const x of porObjeto.values()) {
    const ganada = h.insignias.has(x.objeto);
    fichas.push({ objeto: x.objeto, titulo: x.nombre, ganada, orden: ganada ? 2 : 1 - x.valor / x.meta,
      como: x.texto, avance: ganada ? null : { texto: avanceMision({ clave: x.id, meta: x.meta, valor: x.valor }), pct: (100 * x.valor) / x.meta } });
  }
  fichas.sort((a, b) => a.orden - b.orden);
  $('#insignias-historia-resumen').textContent = `${fichas.filter((x) => x.ganada).length} de ${fichas.length}`;
  $('#ficha-insignias').innerHTML = fichas.map((x) => fichaInsignia({
    nombre: x.titulo, como: x.como, ganada: x.ganada, fecha: fechaDe(x.objeto), avance: x.avance, premio: O.objeto(x.objeto)?.nombre, pasado: x.pasado,
  })).join('');
}

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
  const cercano = J.ATRIBUTOS.map((a) => ({ a, t: J.tituloAtributo(a.clave, h.atributosTotal[a.clave]) })).filter((x) => x.t.siguiente)
    .sort((x, y) => x.t.siguiente.faltan - y.t.siguiente.faltan)[0];
  caja.innerHTML = `${meta}<div class="solo-avanzado"><p class="etq-campo">Semana sugerida para equilibrarte</p><ul class="semana-sugerida">${filas}</ul></div>
    ${cercano ? `<p class="titulo-cerca">${ico('i-trofeo')}<span>${cercano.a.nombre} ${miles(h.atributosTotal[cercano.a.clave] || 0)} en total → título <b>«${cercano.t.siguiente.nombre}»</b>. Te faltan ${miles(cercano.t.siguiente.faltan)}.</span></p>` : ''}`;
}

// «+1 / 2 / 3 XP»: resalta el valor del grado que tienes (o del siguiente, si aún no lo aprendiste).
function gradoResaltado(texto, g, max) {
  const i = Math.min(max, Math.max(1, g || 1)) - 1;
  return texto.replace(/[+−-]?\d+(?:,\d+)?(?: \/ \d+(?:,\d+)?)+/g, (serie) => serie.split(' / ')
    .map((v, k) => (k === i ? `<b class="grado-actual" title="${g ? 'Tu grado' : 'Al aprenderlo'}">${v}</b>` : `<span class="grado-otro">${v}</span>`)).join(' / '));
}
// Habilidad de clase (etapa 5): se activa sola en carreras y Remo libre, nunca en pruebas ni en sesiones del plan.
function habilidadHtml(clave, senda) {
  const id = habilidadDe(clave, senda);
  if (!id) return '';
  const hab = HABILIDADES[id];
  const res = RESERVA[id] ? HABILIDADES[RESERVA[id]] : null;
  const nota = hab.intensidad
    ? `De intensidad: descansa con el cuerpo cargado y tras 2 sesiones duras en la semana; ese día usas ${res ? `«${res.nombre}»` : 'la constancia'}.`
    : 'De constancia: siempre activa.';
  return `<div class="habilidad-clase"><div class="talento-cab"><b>${hab.nombre}</b><span class="etq-tal carrera">Habilidad</span>${hab.intensidad ? '<span class="etq-tal intensidad">Intensidad</span>' : ''}</div>
      <p>${hab.texto} Se activa sola en carreras y Remo libre (no en pruebas ni en sesiones del plan) y da hasta 15 m por carrera.</p><p class="suave">${nota}</p></div>`;
}
function pintarTalentos(h, per, clase) {
  const arbol = per.arbol?.[clase.clave] || {};
  const senda = J.sendaEn(per, clase.clave);
  const est = { nivel: h.nivel, libres: h.talentosLibres };
  const antiguo = J.tieneArbolAntiguo(arbol) && J.puntosGastados(arbol) === 0;
  const pts = (n) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;
  const guardados = h.talentosLibres - h.talentosPorRepartir;
  $('#talentos-libres').textContent = `${h.talentosPorRepartir > 0
    ? `Tienes ${pts(h.talentosPorRepartir)} de talento para repartir.${guardados > 0 ? ` Guardas ${pts(guardados)} más para cuando se abran otros talentos.` : ''}`
    : h.talentosLibres > 0 ? `Guardas ${pts(h.talentosLibres)}: ahora no hay ningún talento que puedas subir.` : 'Sin puntos libres.'} Ganas 1 punto cada 3 niveles.${antiguo ? ' Los talentos cambiaron: te devolvimos todos tus puntos para que los repartas de nuevo.' : ''}`;
  // Con el árbol lleno, los puntos que sobran se cambian por monedas (no hay otra cosa que hacer con ellos).
  const canje = $('#talentos-canje');
  if (canje) {
    canje.hidden = !h.puntosSobrantes;
    canje.innerHTML = h.puntosSobrantes ? `<span>Te sobran ${pts(h.puntosSobrantes)}: ya no caben en tu árbol. Cámbialos por ${icoMoneda}${miles(h.puntosSobrantes * J.MONEDAS_POR_PUNTO)} (${J.MONEDAS_POR_PUNTO} por punto).</span> <button type="button" class="boton chico" data-canjear-puntos>Cambiar</button>` : '';
  }
  // Aviso único del cambio del Triunfo romano (etapa 12).
  if (clase.clave === 'romano' && !ajustes.si('avisoTriunfo12', false)) {
    ajustes.escribir('avisoTriunfo12', '1');
    toast('Cambio en tu Triunfo romano: ahora se gana con 4 sesiones en la semana o al llegar a tu meta semanal de km.', 6000);
  }
  const fila = (t) => {
    const g = J.grado(arbol, clase.clave, t.slot);
    const motivo = J.motivoBloqueo(t.slot, est, arbol, clase.clave);
    const pips = Array.from({ length: t.max }, (_, i) => `<i class="${i < g ? 'lleno' : ''}"></i>`).join('');
    const accion = motivo
      ? `<span class="${g >= t.max ? 'ok-texto' : 'suave'}">${motivo}</span>`
      : `<button type="button" class="boton" data-aprender="${t.slot}">${g ? 'Subir de grado' : 'Aprender'} · ${t.coste} ${t.coste === 1 ? 'punto' : 'puntos'}</button>`;
    // Cuánto te daría el siguiente grado con lo que remas de verdad (solo los de XP).
    const xpEst = t.tipo === 'xp' && g < t.max ? J.xpTalentoEstimada(h, clase.clave, t.slot, g + 1, senda) : null;
    const valor = xpEst == null ? '' : xpEst > 0
      ? `<p class="talento-valor">Con tus últimas sesiones: <b>≈ +${miles(xpEst)} XP por sesión</b>${g ? ' más' : ''}</p>`
      : '<p class="talento-valor nada">Con tus últimas sesiones no sumaría XP: no cumplen lo que pide.</p>';
    return `<div class="talento ${g ? 'aprendido' : motivo && g < t.max ? 'bloqueado' : 'disponible'}">
      <div class="talento-cab"><b>${t.nombre}</b><span class="etq-tal ${t.tipo}">${t.tipo === 'xp' ? 'XP' : 'Carrera'}</span>${t.intensidad ? '<span class="etq-tal intensidad" title="Talento de intensidad: descansa con el cuerpo cargado, en las sesiones del plan y tras 2 sesiones duras en la semana">Intensidad</span>' : ''}<span class="pips" aria-label="Grado ${g} de ${t.max}">${pips}</span></div>
      <p>${gradoResaltado(t.texto, g, t.max)}</p>${valor}<div class="talento-pie"><small class="suave">Desde el nivel ${Math.max(t.nivel, PRIMER_PUNTO)}${g && g < t.max ? ` · Ahora: ${t.textoGrado(g).replace(/\.$/, '')}` : ''}</small>${accion}</div></div>`;
  };
  const ts = J.talentosDe(clase.clave, senda);
  // Dos sendas desde el nivel 20: cambian las mejoras 3, 4 y la maestría. Cambiar es gratis.
  const sendas = J.SENDAS[clase.clave] ? `<h4 class="sub-tal">Tu senda</h4>${tarjetaSendas(clase.clave, senda, h.nivel)}` : '';
  const comun = ts.filter((t) => !t.maestria && !t.senda);
  const deSenda = ts.filter((t) => !t.maestria && t.senda);
  $('#arbol').innerHTML = `<div class="rama"><div class="rama-titulo"><b>${J.cualidadDe(clase.clave)}</b><span>${clase.nombre}</span></div>
      ${habilidadHtml(clase.clave, senda)}
      <h4 class="sub-tal">Mejoras de nivel</h4>${comun.map(fila).join('')}${sendas}${deSenda.map(fila).join('')}
      <h4 class="sub-tal">Maestría</h4>${ts.filter((t) => t.maestria).map(fila).join('')}</div>`;
}

// ---------- Camino de la clase ----------
// Talentos y Rangos en una vista: el siguiente hito arriba y una línea del nivel 1 al 90 con el título de cada rango,
// las mejoras que se abren, la pieza del bote por nivel y el jefe de cada capítulo.
const PRIMER_PUNTO = 3; // puntosDeNivel = floor(nivel / 3): el primer punto de talento llega en el nivel 3
const NIVEL_PIEZA = { 1: 'clasica', [CB.NIVEL_RANGO]: 'rango', [CB.NIVEL_PROA]: 'proa' };

// Hitos de una clase, en orden: uno por rango más el jefe final. Cada etiqueta: [texto, tipo, conseguida].
export function hitosDeClase(clave, senda, { nivel = 1, capitulosHechos = 0 } = {}) {
  const ts = J.talentosDe(clave, senda);
  const talento = (pred) => ts.filter(pred).map((t) => t.nombre);
  const hitos = J.RANGOS.map((r, i) => {
    const etqs = [];
    const abre = r.nivel === 1 ? talento((t) => t.nivel === 1 && !t.maestria)
      : r.nivel === J.NIVEL_SENDA ? talento((t) => t.nivel === J.NIVEL_SENDA && !t.maestria)
        : r.nivel === 40 ? talento((t) => t.maestria) : [];
    for (const n of abre) etqs.push([r.nivel === 40 ? `Maestría: ${n}` : n, 'talento-e']);
    const pieza = NIVEL_PIEZA[r.nivel] && CB.PIEZAS[`${clave}-${NIVEL_PIEZA[r.nivel]}`];
    if (pieza) etqs.push([`${CB.TIPOS[pieza.tipo]} ${pieza.nombre}`, 'pieza']);
    const cap = J.CAPITULOS.findIndex((c) => c.nivel === r.nivel);
    if (cap >= 0) etqs.push([`Jefe: ${J.capituloDe(cap, clave).jefe.nombre}${cap < capitulosHechos ? ' · vencido' : nivel >= r.nivel ? ' · por vencer' : ''}`, 'jefe', cap < capitulosHechos]);
    const titulo = J.nombreRango(r.nivel, clave) + (r.nivel === J.NIVEL_SENDA ? ' · eliges senda' : '');
    return { nivel: r.nivel, rango: r.id, titulo, etqs: etqs.map(([txt, tipo, ok]) => ({ txt, tipo, ok: ok ?? nivel >= r.nivel })) };
  });
  const fin = J.CAPITULOS.length - 1;
  if (!hitos.some((x) => x.nivel === J.CAPITULOS[fin].nivel)) {
    const n = J.CAPITULOS[fin].nivel;
    hitos.push({ nivel: n, titulo: 'Último capítulo', etqs: [{ txt: `Jefe final: ${J.capituloDe(fin, clave).jefe.nombre}${fin < capitulosHechos ? ' · vencido' : nivel >= n ? ' · por vencer' : ''}`, tipo: 'jefe', ok: fin < capitulosHechos }] });
  }
  return hitos;
}

// El jefe lleva candado hasta su nivel (puede abrirse antes cumpliendo su capítulo, ver Misiones) y espadas después.
const etiquetasHito = (x, nivel) => (x.etqs.length ? `<div class="hito-etqs">${x.etqs.map((e) => `<span class="etq-hito ${e.tipo}${e.ok ? ' ok' : ''}">${e.tipo === 'jefe' ? (e.ok || nivel >= x.nivel ? '⚔ ' : '🔒 ') : ''}${escaparHtml(e.txt)}</span>`).join('')}</div>` : '');
// Las dos sendas: la tuya marcada y, desde el nivel 20, botón para cambiar (en la tarjeta del 20, en las dos).
const tarjetaSendas = (clave, senda, nivel, confirmar = false) => {
  const S = J.SENDAS[clave];
  return `<div class="sendas">${['a', 'b'].map((k) => {
    const tuya = !confirmar && senda === k;
    const pie = tuya ? '<span class="ok-texto">Tu senda</span>' : nivel >= J.NIVEL_SENDA ? `<button type="button" class="boton chico" data-senda="${k}">Seguir esta senda</button>` : `<span class="suave">Se elige en el nivel ${J.NIVEL_SENDA}</span>`;
    const intensa = Object.values(S[k].talentos || {}).some((t) => t.intensidad);
    return `<div class="senda${tuya ? ' activa' : ''}"><b>${S[k].nombre}${intensa ? ' ⚡' : ''}</b><p class="suave">${S[k].lema}</p>${pie}</div>`;
  }).join('')}</div>`;
};

function pintarCamino(h, per, clase) {
  const clave = clase.clave;
  const senda = J.sendaEn(per, clave);
  const hitos = hitosDeClase(clave, senda, h);
  const S = J.SENDAS[clave];
  const sinElegir = S && h.nivel >= J.NIVEL_SENDA && !per.senda?.[clave]?.length;
  const sig = hitos.find((x) => x.nivel > h.nivel);
  const caja = $('#camino-siguiente');
  if (sinElegir) {
    caja.innerHTML = `<div class="eti">Nivel ${J.NIVEL_SENDA} · ${escaparHtml(J.nombreRango(J.NIVEL_SENDA, clave))}</div><h3>Elige tu senda</h3>
      <p>Cambia tus mejoras 3, 4 y la maestría. Puedes cambiar gratis cuando quieras: tus grados se conservan.</p>${tarjetaSendas(clave, senda, h.nivel, true)}`;
  } else if (sig) {
    const falta = J.xpParaNivel(sig.nivel) - h.xp;
    const cuando = enSesiones(falta, h);
    const resumen = sig.etqs.filter((e) => e.tipo !== 'jefe').map((e) => e.txt).join(' · ');
    const jefe = sig.etqs.find((e) => e.tipo === 'jefe');
    caja.innerHTML = `<div class="eti">Siguiente hito · nivel ${sig.nivel}${cuando ? ` · ${cuando}` : ''}</div>
      <h3>${sig.nivel === J.NIVEL_SENDA && S ? 'Eliges tu senda' : escaparHtml(sig.titulo)}</h3>
      <p>${escaparHtml([sig.nivel === J.NIVEL_SENDA && S ? J.nombreRango(sig.nivel, clave) : '', resumen, jefe ? `se abre ${jefe.txt.replace(/^Jefe/, 'el jefe')}` : ''].filter(Boolean).join(' · '))}</p>
      ${sig.nivel === J.NIVEL_SENDA && S ? tarjetaSendas(clave, senda, h.nivel) : ''}`;
  } else {
    caja.innerHTML = `<div class="eti">Nivel ${h.nivel}</div><h3>Recorriste todo el camino</h3><p>${miles(h.xp)} XP en total.</p>`;
  }
  $('#camino-ident').innerHTML = `<span class="etq-hito talento-e">${escaparHtml(J.cualidadDe(clave))} · +15 % ${escaparHtml(nombreAtributo(clase.favorito))}</span><span>${J.lemaTalentos(clave)}</span>`;

  // La línea: lo pasado en turquesa, «Estás aquí» entre dos hitos y lo que falta apagado.
  const sigPunto = h.nivel < J.NIVEL_MAX ? Math.max(PRIMER_PUNTO, (Math.floor(h.nivel / 3) + 1) * 3) : null;
  const aqui = `<li class="hito aqui" aria-current="step"><span class="hito-nodo">${h.nivel}</span><div class="hito-cuerpo"><b>Estás aquí</b>
    <small>${sigPunto && sigPunto <= J.NIVEL_MAX ? `Siguiente punto de talento en el nivel ${sigPunto}` : 'Nivel máximo'}</small></div></li>`;
  let html = '';
  let puesto = false;
  for (const x of hitos) {
    if (!puesto && x.nivel > h.nivel) { html += aqui; puesto = true; }
    if (x.nivel === h.nivel) puesto = true;
    const hecho = x.nivel <= h.nivel;
    const img = x.rango ? `<img src="assets/heroes/${clave}_${x.rango}_retrato.webp" width="36" height="36" alt="" loading="lazy">` : '';
    html += `<li class="hito ${hecho ? 'hecho' : 'futuro'}${x.nivel === h.nivel ? ' aqui' : ''}"${x.nivel === h.nivel ? ' aria-current="step"' : ''}><span class="hito-nodo">${x.nivel}</span>
      <div class="hito-cuerpo"><b>${img}${escaparHtml(x.titulo)}</b>${x.nivel === h.nivel && sigPunto ? `<small>Estás aquí · siguiente punto de talento en el nivel ${sigPunto}</small>` : ''}${etiquetasHito(x, h.nivel)}</div></li>`;
  }
  if (!puesto) html += aqui;
  $('#camino-linea').innerHTML = html;

  const det = $('#camino-talentos');
  const pts = h.talentosPorRepartir;
  $('#camino-talentos-resumen').textContent = pts > 0 ? `${pts} ${pts === 1 ? 'punto' : 'puntos'} por repartir` : S ? `Senda: ${S[senda].nombre}` : '';
  $('#camino-talentos-resumen').classList.toggle('nuevo', pts > 0);
  if (vh.abrirTalentos) det.open = true;
  vh.abrirTalentos = false;
  pintarTalentos(h, per, clase);
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
// Las metas en escalera (km250, ses100, nivel40, semanas10, ftp25…) sacan la unidad de su clave.
const UNIDAD_ESCALERA = [[/^km\d/, 'km'], [/^ses\d/, 'sesiones'], [/^semanas\d/, 'semanas'], [/^ftp\d/, 'W'], [/^mejora/, '%']];
const unidadDe = (clave) => UNIDAD_MISION[clave] || UNIDAD_ESCALERA.find(([re]) => re.test(clave))?.[1];
function avanceMision(m) {
  const clave = m.clave || String(m.id).split(':').pop();
  if (/^nivel\d/.test(clave)) return `Nivel ${m.valor} de ${m.meta}`;
  const u = m.unidad || unidadDe(clave);
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
  $('#mis-capitulo').innerHTML = c ? `<div class="cap-cabecera"><span class="etq">Capítulo ${c.n} de ${J.CAPITULOS.length}</span><b>${c.nombre}</b><p>${c.historia}</p>${c.pendiente ? '<p class="cap-avance">Ya lo venciste antes de tiempo: en cuanto se desbloquee, el capítulo es tuyo con tu próxima sesión.</p>' : ''}</div>
    <ul class="lista misiones">${c.progreso.map((r) => filaMision({ clave: `cap-${r.clave}`, texto: r.texto, meta: r.meta, valor: r.valor, monedas: '', hecha: r.valor >= r.meta })).join('')}</ul>
    <div class="jefe ${c.listo ? 'listo' : ''}">${ico('i-fuego')}<div><b>Jefe: ${c.jefe.nombre}</b><small>${c.jefe.texto}, ${J.OTRAS_FORMAS_JEFE}${
      c.listo ? ' · ¡ya puedes enfrentarlo!' : ` · se desbloquea al cumplir lo de arriba o en el nivel ${c.nivel}`}</small></div>
      <span class="premio"><span class="xp">+${miles(c.xp)} XP</span> ${icoMoneda}${c.monedas + J.PREMIO_INSIGNIA} + insignia ${O.objeto(c.objeto)?.nombre || ''}</span>
      ${c.listo ? `<button type="button" class="boton primario jefe-boton" data-preparar="${c.preparar}">Enfrentar: ${NOMBRE_PRUEBA[c.preparar]}</button>` : ''}</div>`
    : '<p class="aviso exito">¡Terminaste la historia! Eres una leyenda de los mares.</p>';
  // Logros: primero los que te faltan, del más cercano al más lejano; los hechos al final.
  const avance = (x) => (x.hecha ? -1 : x.valor / x.meta);
  const logro = (x) => filaMision({ clave: x.id, nombre: x.nombre, texto: x.texto, meta: x.meta, valor: x.valor, xp: x.xp, monedas: x.monedas + (x.objeto ? J.PREMIO_INSIGNIA : 0), premio: x.objeto ? `insignia ${O.objeto(x.objeto).nombre}` : '', hecha: x.hecha });
  // Los logros hechos se guardan en un desplegable: arriba quedan solo los que te faltan.
  const hechos = h.hazanas.filter((x) => x.hecha);
  // Solo los 3 más cercanos a la vista; el resto, plegado.
  const faltan = h.hazanas.filter((x) => !x.hecha).sort((a, b) => avance(b) - avance(a));
  $('#mis-hazanas').innerHTML = faltan.slice(0, 3).map(logro).join('')
    + (faltan.length > 3 ? `<li class="hechos-grupo"><details><summary>Ver los otros ${faltan.length - 3} <span class="seccion-resumen"></span></summary><ul class="lista misiones">${faltan.slice(3).map(logro).join('')}</ul></details></li>` : '')
    + (hechos.length ? `<li class="hechos-grupo"><details><summary>${ico('i-check')}Completados <span class="seccion-resumen">${hechos.length}</span></summary><ul class="lista misiones">${hechos.map(logro).join('')}</ul></details></li>` : '');
}

// Muestra de la pieza: su ilustración (piezas de jefe) o sus dos colores
const muestraDe = (x) => (x.imagen
  ? `<img class="velas-muestra ilustrada" src="${x.imagen}" alt="" loading="lazy" width="56" height="36">`
  : `<span class="velas-muestra" aria-hidden="true" style="background:linear-gradient(90deg, ${x.tela} 0 70%, ${x.marca} 70%)"></span>`);
function pintarColeccion(h, per) {
  const clase = J.claseDe(per.clase);
  const caja = $('#tienda-velas');
  if (!clase) {
    $('#coleccion-hazana').innerHTML = '';
    caja.innerHTML = '<p class="vacio">Elige una clase para ver la colección de tu bote.</p>';
    return;
  }
  const ctx = ctxColeccion(h);
  const equipo = equipoActual(per, h);
  usarEquipo(equipo);
  const hz = h.hazanas.find((x) => x.id === CB.hazanaDeClase(clase.clave));
  $('#coleccion-titulo').textContent = `Tu bote: colección ${clase.nombre.toLowerCase()}`;
  $('#coleccion-hazana').innerHTML = hz ? `<div class="mision-fila"><span><b>Hazaña: ${hz.nombre}</b></span><small>${hz.hecha ? 'cumplida' : `${miles(hz.valor)} de ${miles(hz.meta)} ${hz.unidad}`}</small></div>
    <div class="progreso" role="progressbar" aria-label="Avance de la hazaña de clase" aria-valuemin="0" aria-valuemax="${hz.meta}" aria-valuenow="${hz.valor}" aria-valuetext="${miles(hz.valor)} de ${miles(hz.meta)} ${hz.unidad}"><div style="width:${Math.min(100, (hz.valor / hz.meta) * 100)}%"></div></div>` : '';
  // Ficha corta: muestra, nombre, precio o estado y un botón. Lo demás (qué es, su ventaja, qué falta y la vista
  // previa) se abre al tocar la muestra o el nombre.
  const ficha = (x, tipo, tiene, enUso, falta) => {
    const precio = x.como?.precio ?? x.precio;
    const boton = enUso
      ? (tipo === 'vela' && x.id === `${clase.clave}-clasica` ? '<span class="paisaje-uso">En uso</span>'
        : `<span class="paisaje-uso">En uso</span><button type="button" class="boton chico" data-pieza="${x.id}" data-tipo="${tipo}" data-quitar>Quitar</button>`)
      : tiene ? `<button type="button" class="boton chico" data-pieza="${x.id}" data-tipo="${tipo}">Usar</button>`
        : falta ? `<span class="bloqueada">${falta.corto}</span>`
          : `<button type="button" class="boton chico" data-pieza="${x.id}" data-tipo="${tipo}" ${h.monedas < precio ? 'disabled' : ''}>Comprar</button>`;
    const estado = falta ? '' : x.como?.gratis ? 'Gratis' : tiene ? (precio ? 'Comprado' : 'Ganado') : precio ? `${icoMoneda}${miles(precio)}` : '';
    const ventaja = CB.ventajaTexto(CB.PIEZAS[x.id] || x, x.id);
    const ver = enUso ? '' : `<button type="button" class="boton chico" data-previa="${x.id}" data-tipo="${tipo}">${ico('i-play')}Vista previa</button>`;
    return tarjeta(`velas${enUso ? ' activo' : ''}${tiene ? '' : ' sin-tener'}`, `${muestraDe(x)}<b>${x.nombre}</b>`, estado, boton,
      `<small>${CB.TIPOS[tipo]} · ${x.texto}</small>${ventaja ? `<small class="ventaja-pieza">${ventaja}</small>` : ''}${falta ? `<small>${falta.largo}</small>` : ''}${!tiene && !falta && precio > h.monedas ? `<small>Te faltan ${icoMoneda}${miles(precio - h.monedas)}</small>` : ''}${ver}`);
  };
  const faltaDe = (x) => (x.como.nivel ? { corto: `Nivel ${x.como.nivel}`, largo: `Llega al nivel ${x.como.nivel}.` }
    : x.como.hazana ? { corto: 'Hazaña', largo: hz ? `Cumple la hazaña «${hz.nombre}»: ${miles(hz.meta)} ${hz.unidad} en total. Llevas ${miles(hz.valor)}.` : 'Cumple la hazaña de tu clase.' }
      : x.como.jefe ? { corto: `Jefe ${x.como.jefe}`, largo: `Vence a ${J.capituloDe(x.como.jefe - 1, per.clase).jefe.nombre}, el jefe del capítulo ${x.como.jefe}.` } : null);
  const propias = CB.piezasDe(clase.clave, ctx).map((x) => {
    const tiene = CB.tienePieza(per, x.id, ctx);
    return ficha(x, x.tipo, tiene, equipo[x.tipo] === x.id, tiene || x.como.precio ? null : faltaDe(x));
  });
  const deColor = Object.entries(VELAS).map(([id, x]) => ficha({ ...x, id }, 'vela', tieneVelas(per, id), equipo.vela === id, null));
  caja.innerHTML = `${propias.join('')}<h3 class="tienda-sub">Velas de color · para cualquier bote</h3>${deColor.join('')}`;
}

// Una tarjeta de la tienda: la cara (muestra y nombre) abre el detalle; precio y botón siempre a la vista.
let detalles = 0;
function tarjeta(clases, cara, estado, boton, detalle) {
  const id = `td-${++detalles}`;
  return `<div class="objeto ${clases}"><button type="button" class="objeto-cara" data-detalle aria-expanded="false" aria-controls="${id}">${cara}</button>
    ${estado ? `<span class="monedas">${estado}</span>` : ''}${boton}<div id="${id}" class="objeto-detalle" hidden>${detalle}</div></div>`;
}
const ICONO_VENTAJA = { salida: 'i-play', viento: 'i-sube', ancla: 'i-baja', segunda: 'i-corazon', estandarte: 'i-trofeo', mapa: 'i-fantasma', corriente: 'i-remo', aire: 'i-rayo', cuerno: 'i-voz', botin: 'i-diana', bitacora: 'i-reloj', talisman: 'i-fuego' };
function pintarTienda(h, per) {
  const lunes = J.lunesDe(Date.now());
  const items = J.tiendaSemana(lunes);
  const inv = per.inventario || {};
  const sig = new Date(`${lunes}T12:00`);
  sig.setDate(sig.getDate() + 7);
  for (const b of document.querySelectorAll('[data-tienda]')) {
    b.classList.toggle('activo', b.dataset.tienda === vh.tienda);
    b.setAttribute('aria-pressed', String(b.dataset.tienda === vh.tienda));
  }
  for (const el of document.querySelectorAll('#hp-tienda .ts')) el.hidden = el.id !== `ts-${vh.tienda}`;
  detalles = 0;
  $('#tienda-info').innerHTML = `Tienes ${icoMoneda}<b>${miles(h.monedas)}</b>`;
  $('#ventajas-info').textContent = `Una por carrera contra fantasmas, nunca en las pruebas. Cambian el lunes ${sig.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}.`;
  $('#tienda').innerHTML = items.map((x) => tarjeta('ventaja', `<span class="ventaja-ico">${ico(ICONO_VENTAJA[x.id])}</span><b>${x.nombre}</b>`,
    `${icoMoneda}${x.precio}${inv[x.id] ? ` <span class="tienes">· tienes ${inv[x.id]}</span>` : ''}`,
    `<button type="button" class="boton chico" data-comprar="${x.id}" ${h.monedas < x.precio ? 'disabled' : ''}>Comprar</button>`,
    `<small>${x.texto}</small>${x.precio > h.monedas ? `<small>Te faltan ${icoMoneda}${miles(x.precio - h.monedas)}</small>` : ''}<button type="button" class="boton chico lote" data-comprar="${x.id}" data-lote ${h.monedas < V.precioLote(x) ? 'disabled' : ''}>${V.LOTE} por ${icoMoneda}${V.precioLote(x)}</button>`)).join('');
  const elegido = paisajeElegido(per);
  // Ordenados por precio: la colección se lee como una escalera, del gratis al más caro.
  $('#tienda-paisajes').innerHTML = Object.entries(PAISAJES).sort(([, a], [, b]) => a.precio - b.precio).map(([id, x]) => {
    const tiene = tienePaisaje(per, id);
    const boton = id === elegido ? '<span class="paisaje-uso">En uso</span>'
      : tiene ? `<button type="button" class="boton chico" data-paisaje="${id}">Usar</button>`
        : `<button type="button" class="boton chico" data-paisaje="${id}" ${h.monedas < x.precio ? 'disabled' : ''}>Comprar</button>`;
    return tarjeta(`paisaje${id === elegido ? ' activo' : ''}`, `<img src="${x.miniatura}" alt="" loading="lazy" width="320" height="138"${x.filtro ? ` style="filter:${x.filtro}"` : ''}><b>${x.nombre}</b>`,
      x.precio ? (tiene ? 'Comprado' : `${icoMoneda}${x.precio}`) : 'Gratis', boton,
      `<small>${x.texto}</small>${!tiene && x.precio > h.monedas ? `<small>Te faltan ${icoMoneda}${miles(x.precio - h.monedas)}</small>` : ''}${id === elegido ? '' : `<button type="button" class="boton chico" data-previa="${id}">${ico('i-play')}Vista previa</button>`}`);
  }).join('');
  pintarColeccion(h, per);
  const tengo = V.OBJETOS_VENTAJA.filter((x) => inv[x.id] > 0);
  $('#inventario').innerHTML = tengo.length ? tengo.map((x) => `<li><div class="mision-fila"><span><b>${x.nombre}</b> · ${x.texto}</span><span class="recompensa"><span class="xp">×${inv[x.id]}</span></span></div></li>`).join('')
    : '<li class="vacio">Aún no tienes ventajas. Elígelas en Entrenar antes de la carrera.</li>';
}

