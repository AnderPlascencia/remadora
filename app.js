import { Remadora, BandaCardiaca } from './remadora.js';
import { VARIANTES } from './variantes.js';
import { formatoSplit, formatoTiempo, kcalPorSegundo } from './protocolo.js';
import { dibujar, dibujarPerfil, dibujarBarras, dibujarAvance } from './grafica.js';
import { crearCarrera, COLORES_RIVAL, PAISAJES, usarPaisaje, tienePaisaje, paisajeElegido, comprarPaisaje } from './carrera.js';
import * as F from './fantasma.js';
import * as db from './db.js';
import * as Ent from './entrenamientos.js';
import * as E from './estadisticas.js';
import { configurarVoz, hablar, tiempoHablado } from './voz.js';
import * as P from './programa.js';
import { confeti, tarjetaSesion } from './efectos.js';
import * as J from './juego.js';
import * as O from './objetos.js';
import * as V from './ventajas.js';
import * as B from './base.js';
import * as C from './consejos.js';

const VERSION = '0.29.0';
const $ = (sel) => document.querySelector(sel);
const color = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ico = (id) => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
const COLOR_ZONA = ['#94A3B8', '#38BDF8', '#22C55E', '#FACC15', '#F97316', '#EF4444'];

const ajustes = {
  leer(clave, defecto) {
    try { return localStorage.getItem(clave) ?? defecto; } catch { return defecto; }
  },
  escribir(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
  },
  num(clave, defecto) { return Number(this.leer(clave, defecto)) || defecto; },
  si(clave, defecto) { return this.leer(clave, defecto ? '1' : '0') === '1'; },
};
const ftp = () => ajustes.num('ftp', 0);
const fcMaxima = () => ajustes.num('fcMax', 0);

// Los nombres los escribe el usuario: siempre escapados al meterlos en HTML.
function escaparHtml(t) { return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Animaciones cortas; con «reducir animaciones» del teléfono todo queda en su estado final.
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function contarHasta(el, total, formato = (v) => v, ms = 1100) {
  if (sinMovimiento()) { el.textContent = formato(total); return; }
  const t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = formato(Math.round(total * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
// Cambia el texto con un desvanecido breve, solo si cambió (para el split, que se lee en movimiento).
function cambiarTexto(el, texto) {
  if (el.textContent === texto) return;
  el.textContent = texto;
  el.classList.remove('cambia');
  void el.offsetWidth;
  el.classList.add('cambia');
}

// ---------- Navegación ----------
const vistaActiva = (v) => $(`#vista-${v}`).classList.contains('activa');
function irA(vista) {
  document.querySelectorAll('.nav-inferior button').forEach((b) => {
    const activa = b.dataset.vista === vista;
    b.classList.toggle('activa', activa);
    b.setAttribute('aria-selected', activa);
  });
  document.querySelectorAll('.vista').forEach((v) => v.classList.toggle('activa', v.id === `vista-${vista}`));
  window.scrollTo(0, 0);
  if (vista === 'historial') pintarHistorial();
  if (vista === 'heroe') pintarHeroe();
  if (vista === 'entrenamientos') pintarEntrenamientos();
  if (vista === 'entrenar') { dibujarVivo(); vistaPrevia(); }
  if (vista === 'ajustes') pintarClasificacion();
  if (vista === 'ajustes') $('#log').textContent = lineasLog.slice(-300).join('\n');
}
document.querySelectorAll('.nav-inferior button').forEach((b) => b.addEventListener('click', () => irA(b.dataset.vista)));

let toastTimer = null;
function toast(texto, ms = 3000) {
  const t = $('#toast');
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
// Ayudas de un toque («?»): explican un término sin llenar la pantalla de párrafos.
const AYUDAS = {
  xp: 'Cada sesión da XP por metros (1 XP cada 10 m), entrenamientos completos, récords, fantasmas vencidos, misiones y logros. Desde el 29 de octubre todo da la mitad de XP. Cada 3 niveles ganas un punto de talento.',
  dificultad: 'Bahía, Costa y Alta mar cambian qué tan fuerte reman los fantasmas. Cuanto más difícil, más XP por cada uno que venzas.',
  referencia: 'Una línea amarilla en tu carril con tu sesión anterior o tu mejor marca de este entrenamiento: así ves si vas por delante.',
  ventaja: 'Objetos de la tienda que te dan metros extra en la carrera. Solo cuentan contra los fantasmas, nunca en tus estadísticas.',
  ftp: 'La potencia que aguantas cerca de una hora. La app la calcula sola con tus sesiones, y la Prueba FTP 20 min la afina.',
};
document.addEventListener('click', (e) => {
  const q = e.target.closest('.ayuda-q');
  if (!q) return;
  e.preventDefault();
  e.stopPropagation();
  toast(AYUDAS[q.dataset.ayuda], 7000);
}, true);

// ---------- Ajustes ----------
const selVariante = $('#sel-variante');
for (const [clave, v] of Object.entries(VARIANTES)) selVariante.add(new Option(v.nombre, clave));
selVariante.value = ajustes.leer('variante', 'generica');
selVariante.addEventListener('change', () => ajustes.escribir('variante', selVariante.value));

function campoNumero(sel, clave, defecto, alCambiar) {
  const el = $(sel);
  el.value = ajustes.leer(clave, defecto);
  // Respeta el min y max del campo: un valor fuera de rango no se guarda y el campo vuelve a lo que tenía.
  el.addEventListener('change', () => {
    const texto = el.value.trim();
    const v = Number(texto);
    const min = Number(el.min);
    const max = Number(el.max);
    if (texto === '' ? defecto !== '' : !Number.isFinite(v) || v < min || v > max) {
      el.value = ajustes.leer(clave, defecto);
      const primero = el.closest('label')?.firstChild;
      const nombre = (primero?.firstChild ?? primero)?.textContent.trim() || 'El valor';
      toast(`${nombre}: escribe un número de ${min} a ${max}`);
      return;
    }
    ajustes.escribir(clave, texto === '' ? '' : String(Math.round(v)));
    el.value = ajustes.leer(clave, defecto);
    alCambiar?.();
  });
}
campoNumero('#in-peso', 'peso', '75', () => { pintarClasificacion(); vistaPrevia(); });
campoNumero('#in-ftp', 'ftp', '', () => { ajustes.escribir('ftpEstimado', '0'); pintarFtpEstado(); pintarZonas(); pintarClasificacion(); vistaPrevia(); });
campoNumero('#in-meta-semana', 'metaSemana', '10');
campoNumero('#in-fcmax', 'fcMax', '');
// La edad rellena el pulso máximo (220 − edad) si no lo has puesto a mano.
campoNumero('#in-edad', 'edad', '', () => {
  const edad = ajustes.num('edad', 0);
  if (!edad || (ajustes.num('fcMax', 0) && !ajustes.si('fcMaxDeEdad', false))) return;
  ajustes.escribir('fcMax', String(220 - edad));
  ajustes.escribir('fcMaxDeEdad', '1');
  $('#in-fcmax').value = 220 - edad;
});
$('#in-fcmax').addEventListener('change', () => ajustes.escribir('fcMaxDeEdad', '0'));

function interruptor(sel, clave, defecto, alCambiar) {
  const el = $(sel);
  el.checked = ajustes.si(clave, defecto);
  el.addEventListener('change', () => { ajustes.escribir(clave, el.checked ? '1' : '0'); alCambiar?.(el.checked); });
}
interruptor('#in-voz', 'voz', true, (v) => { configurarVoz(v); if (v) hablar('Avisos por voz activados'); });
interruptor('#in-modo-auto', 'modoAuto', false);
interruptor('#in-pausa-auto', 'pausaAuto', true);
interruptor('#in-atr-vivo', 'atrVivo', true);
interruptor('#in-res-auto', 'resAuto', false);
// Datos avanzados: nombres técnicos de zona, carga, W/kg, predicciones y tablas por tramo. Apagado, la app habla en sencillo.
const avanzado = () => ajustes.si('avanzado', false);
const aplicarAvanzado = () => document.documentElement.toggleAttribute('data-avanzado', avanzado());
interruptor('#in-avanzado', 'avanzado', false, () => {
  aplicarAvanzado();
  pintarClasificacion();
  if (!avanzado() && tendencia === 'tecnica') $('[data-tend="potencia"]').click();
});
aplicarAvanzado();
const textoZona = (z) => (avanzado() ? `Z${z.n} ${z.nombre}` : `Zona ${z.n} · ${z.simple}`);
configurarVoz(ajustes.si('voz', true));
const selVistaRemo = $('#sel-vista-remo');
selVistaRemo.value = ajustes.leer('vistaRemo', 'numeros');
selVistaRemo.addEventListener('change', () => ajustes.escribir('vistaRemo', selVistaRemo.value));

// Tema: oscuro (por defecto), claro o alto contraste.
function aplicarTema() {
  const tema = ajustes.leer('tema', 'oscuro');
  if (tema === 'oscuro') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color('--fondo') || '#0B1217');
}
const selTema = $('#sel-tema');
selTema.value = ajustes.leer('tema', 'oscuro');
selTema.addEventListener('change', () => { ajustes.escribir('tema', selTema.value); aplicarTema(); dibujarVivo(); });
aplicarTema();
const selGuiado = $('#sel-guiado');
selGuiado.value = ajustes.leer('guiado', '0-0');
selGuiado.addEventListener('change', () => ajustes.escribir('guiado', selGuiado.value));

// Ritmo objetivo opcional (split /500 m): colorea los parciales y dibuja su línea en la carrera.
const inRitmo = $('#in-ritmo');
inRitmo.value = ajustes.leer('ritmoObjetivo', '');
inRitmo.addEventListener('change', () => {
  const v = leerMmss(inRitmo.value);
  inRitmo.value = v ? formatoSplit(v) : '';
  ajustes.escribir('ritmoObjetivo', inRitmo.value);
});
const ritmoObjetivo = () => leerMmss(ajustes.leer('ritmoObjetivo', '')) || 0;

// Pantalla de bienvenida: se desvanece sola.
setTimeout(() => $('#bienvenida')?.remove(), 1700);

// ---------- Fantasmas: hasta 3 a la vez, uno de ellos a tu medida ----------
const MAX_RIVALES = 3;
// Respuestas del asistente de plan por objetivo (en Planes).
const asistente = { objetivo: null, nivel: null, dias: 3, semanas: 6 };
// En «Por objetivo» siempre se compite contra 3 rivales de otras clases; en Remo libre, solo si lo activas.
const libreConFantasmas = () => modoEnt() === 'libre' && ajustes.leer('libreFantasmas', '1') === '1';
const conRivales = () => modoEnt() === 'objetivo' || libreConFantasmas();
function rivalesElegidos() {
  return conRivales() ? ['clase', 'clase', 'clase'] : [];
}
// Mi anterior y Mi mejor ya no son rivales: son líneas amarillas de referencia en tu carril.
function referenciasElegidas() {
  try {
    const guardadas = ajustes.leer('referencias', null);
    const v = JSON.parse(guardadas ?? ajustes.leer('rivales', '[]'));
    return Array.isArray(v) ? ['anterior', 'mejor'].filter((k) => v.includes(k)) : [];
  } catch { return []; }
}
const hayCarrera = () => !!(sesion && (sesion.rival || sesion.referencias?.length));
// Dificultad de los rivales de clase: se elige cuando hay rivales.
const dificultadActual = () => (conRivales() ? ajustes.leer('dificultad', 'costa') : 'costa');
function pintarDificultad() {
  const caja = $('#dificultad');
  $('#libre-fantasmas').hidden = modoEnt() !== 'libre';
  $('#in-libre-fantasmas').checked = libreConFantasmas();
  $('#in-libre-fantasmas').disabled = !!sesion;
  $('#bloque-rivales').hidden = !conRivales();
  if (!conRivales()) return;
  const actual = dificultadActual();
  caja.innerHTML = Object.entries(J.DIFICULTADES).map(([k, d]) => `<button type="button" role="radio" data-dif="${k}" aria-checked="${k === actual}" ${sesion ? 'disabled' : ''}>
    <b>${d.nombre}</b><small>${d.texto.split(': ')[0]} · ${d.xp} XP por rival vencido</small></button>`).join('');
}
$('#in-libre-fantasmas').addEventListener('change', (e) => {
  if (sesion) return;
  ajustes.escribir('libreFantasmas', e.target.checked ? '1' : '0');
  pintarChips();
});
$('#dificultad').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dif]');
  if (!b || sesion) return;
  ajustes.escribir('dificultad', b.dataset.dif);
  pintarChips();
});
function perso() {
  try { return { modo: 'ftp', valor: '', ...JSON.parse(ajustes.leer('fantasmaPerso', '{}')) }; } catch { return { modo: 'ftp', valor: '' }; }
}
const PERSO = {
  ftp: { etq: 'FTP del fantasma (W)', ayuda: () => `Rema cada intervalo a la intensidad del plan con ese FTP${ftp() ? ` (el tuyo es ${ftp()} W)` : ''}.`, ejemplo: () => String(Math.round((ftp() || 170) * 1.05)) },
  tiempo: { etq: 'Tiempo objetivo (mm:ss)', ayuda: () => 'Termina justo en ese tiempo. Solo para entrenamientos que acaban por distancia.', ejemplo: () => '7:30' },
  mejora: { etq: 'Más rápido que tu mejor (%)', ayuda: () => 'Tu mejor sesión de este entrenamiento, acelerada ese porcentaje.', ejemplo: () => '2' },
};
const leerMmss = (v) => {
  const m = /^\s*(\d{1,3}):([0-5]\d)\s*$/.exec(v || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function pintarChips() {
  const sel = rivalesElegidos();
  const nClase = sel.length;
  pintarDificultad();
  const refs = referenciasElegidas();
  for (const b of document.querySelectorAll('#chips-rival .chip')) {
    const activa = refs.includes(b.dataset.rival);
    b.setAttribute('aria-pressed', String(activa));
    b.style.setProperty('--chip', activa ? COLOR_REFERENCIA : '');
    b.disabled = !!sesion;
  }
  const semana = J.rivalDeLaSemana(J.lunesDe(Date.now()), leerPersonaje().clase);
  const dif = J.DIFICULTADES[dificultadActual()];
  $('#rival-semana').textContent = `Rival de la semana: ${J.claseDe(semana).nombre}. ${F.ESTILOS[semana].texto}.${nClase ? ` ${dif.nombre}: ${dif.texto.split(': ')[1]}.` : ''}${libreConFantasmas() ? ' Rema al menos 5 min para que cuente la carrera.' : ''}`;
  pintarSelVentaja(sel);
  pintarResumenCarrera();
  if (!sesion) prepararPronto();
  // Durante la sesión los fantasmas ya están en el agua: se ocultan las opciones.
  $('.fantasmas').hidden = !!sesion;
  const panel = $('#perso-panel');
  panel.hidden = true;
  const p = perso();
  const info = PERSO[p.modo] || PERSO.ftp;
  $('#perso-modo').value = p.modo;
  if (document.activeElement !== $('#perso-valor')) $('#perso-valor').value = p.valor;
  $('#perso-valor').placeholder = info.ejemplo();
  $('#perso-etq').textContent = info.etq;
  $('#perso-ayuda').textContent = info.ayuda();
  for (const el of panel.querySelectorAll('select, input')) el.disabled = !!sesion;
}
// Una línea con lo elegido en «Opciones de carrera», para no tener que abrirlas.
function pintarResumenCarrera() {
  const partes = [conRivales() ? `3 fantasmas · ${J.DIFICULTADES[dificultadActual()].nombre}` : 'Sin fantasmas'];
  const refs = referenciasElegidas();
  if (refs.length) partes.push(refs.map((k) => (k === 'anterior' ? 'Mi anterior' : 'Mi mejor')).join(' y '));
  const v = $('#sel-ventaja');
  if (!$('#ventaja-campo').hidden && v.value) partes.push(v.selectedOptions[0]?.textContent.split(' (')[0]);
  if (ritmoObjetivo()) partes.push(`ritmo ${formatoSplit(ritmoObjetivo())}`);
  $('#oc-resumen').textContent = partes.join(' · ');
}
// Selector de la ventaja de la tienda: solo con fantasmas, fuera de las pruebas y si tienes alguna.
function pintarSelVentaja(sel = rivalesElegidos()) {
  const inv = inventario();
  const tengo = V.OBJETOS_VENTAJA.filter((x) => inv[x.id] > 0);
  const campo = $('#ventaja-campo');
  campo.hidden = !sel.length || !tengo.length;
  if (campo.hidden) return;
  const prueba = V.esPrueba(entrenamientoPrevio);
  const actual = $('#sel-ventaja').value;
  $('#sel-ventaja').innerHTML = `<option value="">Sin ventaja</option>${tengo.map((x) => `<option value="${x.id}">${x.nombre} (tienes ${inv[x.id]})</option>`).join('')}`;
  $('#sel-ventaja').value = tengo.some((x) => x.id === actual) ? actual : '';
  $('#sel-ventaja').disabled = prueba || !!sesion;
  const x = V.objetoVentaja($('#sel-ventaja').value);
  $('#ventaja-ayuda').textContent = prueba ? 'En las pruebas y contra los jefes se rema sin ventajas.' : x ? `${x.texto} Se gasta al guardar la sesión.` : 'Una por carrera. Se gasta al guardar la sesión.';
}
$('#sel-ventaja').addEventListener('change', () => { pintarSelVentaja(); prepararPronto(); });
$('#chips-rival').addEventListener('click', (ev) => {
  const b = ev.target.closest('.chip');
  if (!b || b.disabled) return;
  const refs = referenciasElegidas();
  const nuevas = refs.includes(b.dataset.rival) ? refs.filter((k) => k !== b.dataset.rival) : [...refs, b.dataset.rival];
  ajustes.escribir('referencias', JSON.stringify(nuevas));
  pintarChips();
});
$('#perso-modo').addEventListener('change', () => {
  ajustes.escribir('fantasmaPerso', JSON.stringify({ modo: $('#perso-modo').value, valor: '' }));
  pintarChips();
});
$('#perso-valor').addEventListener('input', () => {
  ajustes.escribir('fantasmaPerso', JSON.stringify({ modo: $('#perso-modo').value, valor: $('#perso-valor').value.trim() }));
  prepararPronto();
});

// Crea los fantasmas elegidos para este entrenamiento, cada uno con su color.
async function crearRivales(ent, { vista = false } = {}) {
  const lista = [];
  let guardadas = null;
  const sesiones = async () => (guardadas ??= await db.listar('sesiones'));
  const elegidos = rivalesElegidos();
  // Rivales de otras clases: su rango sale de tu nivel y su FTP del tuyo.
  const nClase = elegidos.filter((k) => k === 'clase').length;
  let deClase = [];
  if (nClase) {
    const per = leerPersonaje();
    const h = J.estadoJuego(await sesiones(), { ftp: ftp(), per });
    const base = ftp() || estimarFtp(await sesiones()) || 150;
    deClase = J.rivalesPara(nClase, { miClase: per.clase, nivel: h.nivel, ftp: base, peso: ajustes.num('peso', 75), dificultad: dificultadActual(), lunes: J.lunesDe(Date.now()), semilla: new Date().toDateString() });
  }
  for (const clave of elegidos) {
    let r = null;
    if (clave === 'clase') {
      const d = deClase.shift();
      r = { ...F.simular(ent, { ftp: d.ftp, estilo: d.clase, perfil: d.perfil }, ftp()), nombre: d.nombre, clase: d.clase, rango: d.rango, dificultad: d.dificultad, clasificacion: d.clasificacion };
    }
    if (r) lista.push({ ...r, clave, color: COLORES_RIVAL[lista.length] });
  }
  return lista;
}

// Líneas de referencia en tu carril: tu sesión anterior y tu mejor marca de este entrenamiento.
const COLOR_REFERENCIA = '#FACC15';
async function crearReferencias(ent, { vista = false } = {}) {
  const refs = referenciasElegidas();
  if (!refs.length) return [];
  const sesiones = await db.listar('sesiones');
  const lista = [];
  for (const clave of refs) {
    const nombre = clave === 'mejor' ? 'Tu mejor marca' : 'Tu sesión anterior';
    const s = E.elegirRival(sesiones, ent?.nombre, clave);
    if (s) lista.push({ ...s, clave, nombre, etiqueta: clave === 'mejor' ? 'Mejor' : 'Anterior', discontinua: clave === 'mejor', color: COLOR_REFERENCIA });
    else if (vista) lista.push({ falta: true, clave, nombre, muestras: [], color: COLOR_REFERENCIA });
    else toast(`Aún no hay ${clave === 'mejor' ? 'una marca' : 'una sesión anterior'} de este entrenamiento para la referencia`);
  }
  return lista;
}

// ---------- Vista previa antes de remar: rivales elegidos y XP estimada ----------
let preparoTimer = null;
let preparoTurno = 0;
function prepararPronto() {
  clearTimeout(preparoTimer);
  preparoTimer = setTimeout(pintarPreparar, 150);
}
const srcRetratoRango = (clase, rango) => `assets/heroes/${clase}_${rango}_retrato.webp`;
const fechaMini = (f) => new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

function tarjetaRival(r) {
  if (r.clase) {
    const c = J.claseDe(r.clase);
    const rango = J.RANGOS.find((x) => x.id === r.rango);
    return `<div class="rival-tarjeta" style="--chip:${r.color}"><img src="${srcRetratoRango(r.clase, r.rango)}" width="56" height="56" alt="">
      <div><b>${escaparHtml(r.nombre.split(' (')[0])}</b><small>${c.nombre} ${rango?.nombre || ''} · ${J.DIFICULTADES[r.dificultad]?.nombre || ''} · ${r.clasificacion} · ${r.ftp} W</small>
      <span>${F.ESTILOS[r.clase].texto}. ${J.CUANDO_DIFICIL[r.clase]}.</span></div></div>`;
  }
  let detalle = '';
  if (r.falta) detalle = 'Aún no hay una sesión de este entrenamiento para usarla de referencia.';
  else if (r.fecha) detalle = `${fechaMini(r.fecha)} · ${miles(r.distancia ?? r.muestras.at(-1)?.dist ?? 0)} m en ${formatoTiempo(r.duracion ?? r.muestras.at(-1)?.t ?? 0)}`;
  else if (r.ftp) detalle = `Rema a ${r.ftp} W de FTP, sin estilo propio.`;
  return `<div class="rival-tarjeta${r.falta ? ' falta' : ''}" style="--chip:${r.color || 'var(--borde)'}"><span class="rival-ico">${ico('i-fantasma')}</span>
    <div><b>${escaparHtml(r.nombre.replace(/^Fantasma /, ''))}</b><span>${escaparHtml(detalle)}</span></div></div>`;
}

// Sesión que remarías si completas el plan a tu FTP: sirve para estimar la XP.
function sesionHipotetica(ent, rivales, sesiones) {
  const mio = ftp() || estimarFtp(sesiones) || 150;
  let plan = ent;
  if (!plan) {
    const dists = sesiones.slice(-10).map((x) => x.distancia).filter((d) => d > 0).sort((a, b) => a - b);
    plan = { tipo: 'objetivo', objetivo: { metrica: 'distancia', valor: dists[Math.floor(dists.length / 2)] || 5000 } };
  }
  const m = F.simular(plan, { ftp: mio }, mio).muestras.map((x) => ({ ...x, split: F.splitDeWatts(x.w) }));
  const fin = m.at(-1);
  const contra = rivales.map((r) => ({ nombre: r.nombre, clase: r.clase || null, dificultad: r.dificultad || null, diferencia: 1 }));
  return {
    fecha: Date.now(), duracion: fin.t, distancia: Math.round(fin.dist), muestras: m, wattsProm: Math.round(m.reduce((a, x) => a + x.w, 0) / m.length),
    entrenamiento: ent?.nombre || null, tiempoMeta: ent ? fin.t : null,
    rival: contra[0] || null, ...(contra.length > 1 ? { rivales: contra } : {}), ventajaUsada: $('#sel-ventaja').value || undefined,
  };
}

async function pintarPreparar() {
  if (sesion) return;
  const turno = ++preparoTurno;
  const ent = entrenamientoPrevio;
  const elegidos = rivalesElegidos();
  const rivales = elegidos.length ? await crearRivales(ent, { vista: true }) : [];
  const refs = await crearReferencias(ent, { vista: true });
  const sesiones = await db.listar('sesiones');
  if (turno !== preparoTurno || sesion) return;
  $('#rivales-vista').innerHTML = rivales.map(tarjetaRival).join('');
  $('#referencias-vista').innerHTML = refs.map(tarjetaRival).join('');
  const caja = $('#xp-estimada');
  caja.hidden = !ent && !rivales.length;
  if (caja.hidden) return;
  const reales = rivales.filter((r) => !r.falta);
  const hip = sesionHipotetica(ent, reales, sesiones);
  const est = J.estimarXp(sesiones, hip, { ftp: ftp(), per: leerPersonaje() });
  const condicion = [ent ? `completas «${escaparHtml(ent.nombre)}»` : `remas unos ${miles(hip.distancia)} m`, reales.length ? `vences a ${reales.length === 1 ? 'tu rival' : `tus ${reales.length} rivales`}` : ''].filter(Boolean).join(' y ');
  const partes = [...est.detalle.map(([k, v]) => [k, v]), ...(est.extra ? [['Misiones y logros', est.extra]] : [])].filter(([, v]) => v > 0);
  caja.innerHTML = `<div class="xp-cabecera">${ico('i-trofeo')}<div><b>≈ ${miles(est.total)} XP</b> <span class="monedas">${icoMoneda}${est.monedas}</span>
    <small>si ${condicion}${est.subeNivel ? ` · subirías al nivel ${est.subeNivel}` : ''}</small></div></div>
    <div class="xp-partes">${partes.map(([k, v]) => `<span>${k} <b>+${miles(v)}</b></span>`).join('')}</div>
    ${bloqueAtributos(ent, hip, est, sesiones)}`;
}

// Idea «antes de remar»: lo que ganas seguro y lo que puedes sumar si remas de cierta forma.
function bloqueAtributos(ent, hip, est, sesiones) {
  const o = opcConsejos(est, sesiones);
  const plan = ent || { nombre: 'Remo libre', tipo: 'objetivo', objetivo: { metrica: 'distancia', valor: hip.distancia } };
  const p = previsionDe(plan, { ...o, libre: !ent });
  if (!p || !Object.keys(p.seguro).length) return '';
  return `<div class="xp-atributos"><small>${ent ? 'Lo que ganas seguro si lo terminas' : 'Lo que ganarías remando como sueles'}:</small>${chipsAtr(p.seguro, o.debil, 6)}
    <small class="sumar-titulo">Y puedes sumar más:</small><ul class="lista-cond">${p.extras.map((x) => filaCond(x)).join('')}${p.riesgo ? filaCond(p.riesgo, 'riesgo') : ''}</ul></div>`;
}

// FTP automático: sin FTP (o con uno estimado), cada sesión de 10 min o más lo calcula o lo sube.
// Con 20 min, el 95 % de tus mejores 20 min; con menos, el 90 % de tu mejor potencia de 10 min.
function ftpAutomatico(s) {
  if (s.pruebaWatts || s.duracion < 600) return null;
  const estimado = ajustes.si('ftpEstimado', false);
  if (ftp() && !estimado) return null;
  const p10 = E.mejorPotencia(s.muestras || [], 600);
  const nuevo = E.ftpSugerido(s) || (p10 ? Math.round(p10 * 0.9) : 0);
  if (!nuevo || nuevo <= ftp()) return null;
  const antes = ftp();
  guardarFtp(nuevo, true);
  return { nuevo, antes };
}
function guardarFtp(valor, estimado) {
  ajustes.escribir('ftp', String(valor));
  ajustes.escribir('ftpEstimado', estimado ? '1' : '0');
  $('#in-ftp').value = valor;
  pintarFtpEstado();
  pintarZonas();
  pintarClasificacion();
}
function pintarFtpEstado() {
  $('#ftp-estimado').hidden = !(ftp() && ajustes.si('ftpEstimado', false));
}

// FTP aproximado sin prueba: el 95 % de la mejor media de watts de tus últimas 20 sesiones (por fecha,
// sin importar en qué orden venga la lista).
function estimarFtp(sesiones) {
  const w = [...sesiones].sort((a, b) => a.fecha - b.fecha).slice(-20).map((s) => s.wattsProm || 0).filter((x) => x > 0);
  return w.length ? Math.round(Math.max(...w) * 0.95) : 0;
}

async function fantasmaPerso(ent, sesiones) {
  const { modo, valor } = perso();
  if (modo === 'tiempo') {
    const seg = leerMmss(valor);
    if (!seg) { toast('Escribe el tiempo objetivo del fantasma como mm:ss'); return null; }
    const r = F.simularPorTiempo(ent, seg, ftp());
    if (!r) toast('El fantasma por tiempo necesita un entrenamiento que acabe por distancia');
    return r;
  }
  if (modo === 'mejora') {
    const pct = Math.min(20, Math.max(-20, Number(String(valor).replace(',', '.')) || 2));
    const mejor = E.elegirRival(await sesiones(), ent?.nombre, 'mejor');
    if (!mejor) { toast('Aún no tienes una marca de este entrenamiento para acelerarla'); return null; }
    return F.acelerar(mejor, pct);
  }
  const w = Math.round(Number(valor)) || Math.round((ftp() || 170) * 1.05);
  return { ...F.simular(ent, { ftp: w }, ftp()), nombre: `Fantasma ${w} W` };
}

// Dos lienzos de carrera animada: el de Entrenar y el del modo remo. Tocar alterna 2D, 3D y, con el vikingo,
// la vista realista (clip renderizado en Blender de tu personaje remando).
const carreraEnt = crearCarrera($('#carrera'));
const carreraRemo = crearCarrera($('#mr-grafica'));
const conVistaReal = () => J.claseDe(leerPersonaje().clase)?.clave === 'vikingo';
function aplicarModoCarrera() {
  let m = ajustes.leer('vistaCarrera', '2d');
  if (m !== '3d' && m !== 'real') m = '2d';
  if (m === 'real' && !conVistaReal()) m = '3d';
  carreraEnt.modo = m;
  carreraRemo.modo = m;
}
function alternarCarrera() {
  const m = carreraEnt.modo;
  ajustes.escribir('vistaCarrera', m === '2d' ? '3d' : m === '3d' && conVistaReal() ? 'real' : '2d');
  aplicarModoCarrera();
  if (hayCarrera() && !$('#modo-remo').hidden && vistaRemo() === 'carrera') pintarGraficaRemo(sesion.t);
}
aplicarModoCarrera();
$('#carrera').addEventListener('click', alternarCarrera);
$('#mr-grafica').addEventListener('click', () => {
  if (Date.now() - gestoHecho < 400) return;
  if (hayCarrera() && vistaRemo() === 'carrera') alternarCarrera();
});

// Clasificación de tripulación por FTP (Grumete … Capitán): en la Ficha y en Ajustes, con aviso al subir.
function pintarClasificacion(sesiones = null) {
  // Sin FTP escrito se estima con el historial, igual que en la Ficha, para que Ajustes no diga otra cosa.
  if (!sesiones && !ftp()) { db.listar('sesiones').then((s) => pintarClasificacion(s)); return; }
  const peso = ajustes.num('peso', 75);
  const w = ftp() || (sesiones ? estimarFtp(sesiones) : 0);
  const caja = $('#clasificacion-ftp');
  if (!w) {
    caja.textContent = 'Tu FTP se calcula solo después de unas sesiones (o escríbelo arriba si lo conoces). Con él sabrás tu puesto en la tripulación: Grumete, Marinero, Contramaestre, Primer oficial o Capitán.';
    $('#heroe-aguas').textContent = '';
    return;
  }
  const c = J.clasificacionDe(w, peso);
  const medida = c.porPeso ? `${c.valor.toFixed(1)} W/kg` : `${w} W`;
  const detalle = avanzado() ? ` (${medida}${ftp() ? '' : ', FTP estimado'})` : '';
  caja.textContent = `Tu puesto en la tripulación (sale de tu FTP, no del nivel): ${c.nombre}${detalle}.${c.siguiente ? ` Te faltan ${c.faltaW} W de FTP para ${c.siguiente.nombre}.` : ' Es el puesto más alto.'} Ajusta cómo reman tus rivales.`;
  $('#heroe-aguas').textContent = `Tripulación: ${avanzado() ? `${c.nombre} · ${medida}` : c.nombre}`;
  $('#heroe-aguas').title = 'Tu puesto en la tripulación sale de tu FTP; el rango sale de tu nivel.';
  const vista = Number(ajustes.leer('clasificacionVista', '-1'));
  if (c.indice > vista) {
    if (vista >= 0) { toast(`¡Ascenso en la tripulación: ${c.nombre}!`); confeti(1800); }
    ajustes.escribir('clasificacionVista', String(c.indice));
  }
}

function pintarZonas() {
  const f = ftp();
  $('#tabla-zonas').innerHTML = `<thead><tr><th>Zona</th><th>% FTP</th><th>${f ? 'Watts' : ''}</th></tr></thead><tbody>${
    Ent.ZONAS.map((z) => `<tr><td><span class="z" style="background:${COLOR_ZONA[z.n - 1]}"></span>Z${z.n} ${z.nombre}</td><td>${z.min}–${z.max}%</td><td>${
      f ? `${Math.round((z.min * f) / 100)}–${Math.round((z.max * f) / 100)} W` : ''}</td></tr>`).join('')}</tbody>`;
}
pintarZonas();
pintarFtpEstado();

const selNivel = $('#sel-nivel-prueba');
for (let n = 1; n <= 24; n++) selNivel.add(new Option(`Nivel ${n}`, n));
selNivel.value = 8;
$('#btn-nivel-prueba').addEventListener('click', () => {
  if (!remadora.conectada) { toast('Conecta la remadora primero'); return; }
  remadora.fijarResistencia(Number(selNivel.value));
  toast(`Nivel ${selNivel.value} enviado. Revisa la consola.`);
});
$('#version-ajustes').textContent = VERSION;

const lineasLog = [];
let logPendiente = false;
function agregarLog(linea) {
  lineasLog.push(linea);
  if (lineasLog.length > 5000) lineasLog.splice(0, lineasLog.length - 5000);
  if (!logPendiente) {
    logPendiente = true;
    requestAnimationFrame(() => {
      logPendiente = false;
      if (vistaActiva('ajustes')) $('#log').textContent = lineasLog.slice(-300).join('\n');
    });
  }
}
$('#btn-log').addEventListener('click', () => descargar(`remadora-registro-${marcaFecha()}.txt`, lineasLog.join('\n'), 'text/plain'));
$('#btn-log-limpiar').addEventListener('click', () => { lineasLog.length = 0; $('#log').textContent = ''; });

// ---------- Conexión y estado en vivo ----------
const remadora = new Remadora();
const banda = new BandaCardiaca();
const actual = { watts: 0, spm: 0, split: 0, distancia: null, nivel: null, fc: 0 };
const vivo = { watts: [], spm: [] };
let tVivo = 0;
let ultimoDato = 0;

if (!Remadora.soportado()) {
  $('#aviso-bt').hidden = false;
  $('#btn-conectar').disabled = true;
  $('#btn-banda').disabled = true;
}

remadora.addEventListener('log', (e) => agregarLog(e.detail));
remadora.addEventListener('estado', (e) => {
  const texto = e.detail;
  const el = $('#estado');
  el.textContent = texto;
  const conectada = remadora.conectada;
  el.classList.toggle('ok', texto === 'Conectada' || texto === 'Modo demo');
  el.classList.toggle('espera', /…$/.test(texto));
  $('#btn-conectar span').textContent = conectada || remadora.reconectando ? 'Desconectar' : 'Conectar remadora';
  $('#btn-conectar').classList.toggle('activo', conectada);
  $('#btn-demo').textContent = remadora.demoTimer ? 'Detener demo' : 'Modo demo';
  // El aviso de Bluetooth sobra mientras se usa el modo demo.
  if (!Remadora.soportado()) $('#aviso-bt').hidden = !!remadora.demoTimer;
  if (sesion) {
    if (texto.startsWith('Reconectando')) hablar('Conexión perdida, reconectando', { clave: 'reconectando', cadaSeg: 30 });
    if (texto === 'Conectada' && sesion.perdida) { hablar('Reconectada'); toast('Reconectada: la sesión sigue'); }
    sesion.perdida = !conectada;
    if (texto === 'Desconectada') toast('Sin conexión. La sesión sigue en pausa: reconecta o termínala.');
  }
  actualizarBotones();
  if (!sesion) vistaPrevia();
});
remadora.addEventListener('datos', (e) => {
  const d = e.detail;
  ultimoDato = Date.now();
  if (d.tipo === 'remada') { actual.spm = d.spm; actual.split = d.split; }
  if (d.tipo === 'metricas') {
    actual.watts = d.watts; actual.distancia = d.distancia; actual.nivel = d.resistencia;
    // En modo demo, sin banda conectada, simula el pulso para poder probar las zonas.
    if (remadora.demoTimer && !bandaConectada) actual.fc = Math.round(actual.fc ? actual.fc + (Math.min(190, 95 + d.watts / 3) - actual.fc) * 0.05 : 100);
  }
});
let bandaConectada = false;
// Un pulso fuera de 30–240 lpm es un error de lectura de la banda: se ignora.
banda.addEventListener('fc', (e) => { bandaConectada = true; if (e.detail >= 30 && e.detail <= 240) actual.fc = e.detail; });

$('#btn-conectar').addEventListener('click', async () => {
  if (remadora.conectada || remadora.reconectando) { remadora.desconectar(); return; }
  try {
    await remadora.conectar(selVariante.value);
  } catch (err) {
    agregarLog(`error: ${err.message}`);
    $('#estado').textContent = err.name === 'NotFoundError' ? 'Cancelado' : `Error: ${err.message}`;
  }
});
$('#btn-banda').addEventListener('click', async () => {
  try {
    const nombre = await banda.conectar();
    agregarLog(`banda conectada: ${nombre}`);
    toast(fcMaxima() ? `Pulso conectado: ${nombre}` : `Pulso conectado. Pon tu edad en Ajustes › Pulso y zonas para ver tus zonas de pulso`);
  } catch (err) { agregarLog(`banda: ${err.message}`); }
});
$('#btn-demo-aviso').addEventListener('click', () => { remadora.iniciarDemo(); irA('entrenar'); });
$('#btn-demo').addEventListener('click', () => {
  if (remadora.demoTimer) remadora.desconectar();
  else { remadora.iniciarDemo(); irA('entrenar'); }
});

// ---------- Sesión ----------
// Secciones plegables: recuerdan si estaban abiertas y redibujan su gráfica al abrirse.
for (const d of document.querySelectorAll('details.seccion')) {
  const clave = `seccion-${d.dataset.seccion}`;
  const guardado = ajustes.leer(clave, null);
  if (guardado != null) d.open = guardado === '1';
  d.addEventListener('toggle', () => {
    ajustes.escribir(clave, d.open ? '1' : '0');
    if (!d.open) return;
    if (d.dataset.seccion === 'forma') pintarForma();
    if (d.dataset.seccion === 'tendencia') pintarTendencia();
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ir]');
  if (b) irA(b.dataset.ir);
});

let sesion = null;
let entrenamientoPrevio = null;
let entrenamientoActivo = null;
let wakeLock = null;
pintarChips();

function actualizarBotones() {
  const g = $('#btn-grabar');
  pintarModoEnt();
  // Empezar conecta la remadora si hace falta; con un entrenamiento, hay que elegirlo antes.
  g.disabled = !sesion && ((!remadora.conectada && !Remadora.soportado()) || (modoEnt() === 'objetivo' && !$('#sel-entrenamiento').value));
  g.classList.toggle('primario', !sesion);
  g.classList.toggle('peligro', !!sesion);
  g.classList.toggle('lleno', !!sesion);
  g.innerHTML = sesion ? `${ico('i-stop')}<span>Terminar</span>` : `${ico('i-play')}<span>${remadora.conectada ? 'Empezar' : 'Conectar y empezar'}</span>`;
  $('#btn-pausa').hidden = !sesion;
  const pausada = sesion?.pausaManual;
  for (const b of [$('#btn-pausa'), $('#mr-pausa')]) {
    b.innerHTML = pausada ? `${ico('i-play')}<span>Seguir</span>` : `${ico('i-pausa')}<span>Pausar</span>`;
    b.setAttribute('aria-label', pausada ? 'Reanudar' : 'Pausar');
  }
  $('#mr-pausa').disabled = !sesion;
  $('#mr-terminar').disabled = !sesion;
  $('#sel-entrenamiento').disabled = !!sesion;
  // Antes de remar se muestra la tarjeta Preparar; durante la sesión, solo una línea de resumen.
  $('#preparar').hidden = !!sesion;
  $('#linea-nivel').hidden = !!sesion || !$('#linea-nivel').textContent;
  // Métricas y gráfica solo con la remadora conectada o durante la sesión.
  const vivo = !!sesion || remadora.conectada;
  if ($('#en-vivo').hidden === vivo) { $('#en-vivo').hidden = !vivo; if (vivo) requestAnimationFrame(dibujarVivo); }
  $('#resumen-sesion').hidden = !sesion;
  if (sesion) {
    const contra = sesion.rivales.length ? ` · contra ${sesion.rivales.map((r) => corto(r.nombre)).join(', ')}` : '';
    $('#resumen-sesion').textContent = `${sesion.entrenamiento || 'Remo libre'}${contra}`;
  }
  pintarChips();
}

// Terminar pide un segundo toque para evitar cortes accidentales mientras se rema.
function confirmarTerminar(boton) {
  const span = boton.querySelector('span');
  // Al confirmar se devuelve el texto: si no, la siguiente sesión arranca con «¿Seguro?» en el botón.
  if (boton.dataset.confirmar) { span.textContent = boton.dataset.confirmar; delete boton.dataset.confirmar; detenerSesion(); return; }
  const previo = span.textContent;
  boton.dataset.confirmar = previo;
  span.textContent = '¿Seguro?';
  setTimeout(() => { if (boton.dataset.confirmar) { delete boton.dataset.confirmar; span.textContent = previo; } }, 3000);
}

$('#btn-grabar').addEventListener('click', async (e) => {
  if (sesion) { confirmarTerminar(e.currentTarget); return; }
  if (!remadora.conectada) {
    try {
      await remadora.conectar(selVariante.value);
    } catch (err) {
      agregarLog(`error: ${err.message}`);
      $('#estado').textContent = err.name === 'NotFoundError' ? 'Cancelado' : `Error: ${err.message}`;
      return;
    }
    if (!remadora.conectada) return;
  }
  iniciarSesion();
});
$('#mr-terminar').addEventListener('click', (e) => confirmarTerminar(e.currentTarget));
for (const b of ['#btn-pausa', '#mr-pausa']) {
  $(b).addEventListener('click', () => {
    if (!sesion) return;
    sesion.pausaManual = !sesion.pausaManual;
    if (!sesion.pausaManual) sesion.sinRemar = 0;
    hablar(sesion.pausaManual ? 'Pausa' : 'Seguimos', { urgente: true });
    actualizarBotones();
  });
}

// Bloques listos para el perfil, con duración estimada para los que terminan por distancia o paladas.
function paraPerfil(bloques) {
  return Ent.bloquesEnWatts(bloques.map((b) => ({ ...b, duracion: Ent.duracionEstimada(b) })), ftp());
}

function medidas() {
  return { t: sesion.t, dist: sesion.dist, paladas: sesion.paladas, split: actual.split, spm: actual.spm };
}

// Talentos de carrera de tu clase y la ventaja elegida de la bolsa para esta carrera.
function crearVentaja(ent, racha) {
  const per = leerPersonaje();
  const clave = per.clase ? J.claseDe(per.clase).clave : null;
  const grados = clave ? J.gradosEn(per.arbol?.[clave] || {}, clave, Date.now()) : {};
  let objeto = $('#sel-ventaja').value || null;
  if (objeto && (V.esPrueba(ent) || !(inventario()[objeto] > 0))) objeto = null;
  const meta = ent?.objetivo?.metrica === 'distancia' ? ent.objetivo.valor : null;
  const dur = meta ? null : duracionCarrera();
  const final = meta ? { meta } : dur ? { duracion: dur } : null;
  if (objeto === 'ancla' && !final) { toast('El Ancla al rival solo sirve en carreras con final: no se gastará'); objeto = null; }
  return V.nuevaVentaja({ clase: clave, grados, objeto, final, racha });
}

// Días seguidos contando hoy (la sesión que empieza ya cuenta).
async function rachaConHoy() {
  const lista = await db.listar('sesiones');
  const hoy = E.claveDia(Date.now());
  const r = E.racha(lista);
  return lista.some((x) => E.claveDia(x.fecha) === hoy) ? r : r + 1;
}

async function iniciarSesion() {
  entrenamientoActivo = await obtenerEnt($('#sel-entrenamiento').value);
  const intervalos = entrenamientoActivo && Ent.tipoDe(entrenamientoActivo) === 'intervalos';
  const [calMin, enfMin] = ajustes.leer('guiado', '0-0').split('-').map(Number);
  const plan = intervalos ? Ent.normalizarBloques(Ent.conCalentamiento(entrenamientoActivo.bloques, calMin, enfMin), ftp(), fcMaxima()) : null;
  $('#perfil-vivo').hidden = !plan;
  if (plan) $('#vivo-leyenda').innerHTML = leyendaPerfil(entrenamientoActivo.bloques, true);
  const rivales = await crearRivales(entrenamientoActivo);
  const referencias = await crearReferencias(entrenamientoActivo);
  const rival = rivales[0] || null;
  sesion = {
    inicio: Date.now(),
    t: 0,
    dist: 0,
    distPrevia: actual.distancia,
    muestras: [],
    kcal: 0,
    paladas: 0,
    segConMeta: 0,
    segEnRango: 0,
    fueraSeguidos: 0,
    tiempoMeta: null,
    mitadAvisada: false,
    avance: [],
    entrenamiento: entrenamientoActivo ? entrenamientoActivo.nombre : null,
    pruebaFtp: !!entrenamientoActivo?.pruebaFtp,
    plan,
    estadoAv: plan ? Ent.crearAvance() : null,
    info: null,
    bloques: plan ? paraPerfil(plan) : null,
    bloqueAnterior: -1,
    avisoCerca: -1,
    rival,
    rivales,
    referencias,
    sinRemar: 0,
    empezo: false,
    pausaManual: false,
    perdida: false,
    ritmo: ritmoObjetivo(),
    n500: 0,
    t500: 0,
    parcial: null,
    lento: 0,
    eventosCarrera: [],
    lados: null,
    sprintAvisado: false,
    retrato: rival ? await retratoPropio() : null,
  };
  if (plan) sesion.info = Ent.avanzar(sesion.estadoAv, plan, medidas());
  await prepararAtrVivo();
  if (rival) sesion.ventaja = crearVentaja(entrenamientoActivo, await rachaConHoy());
  actualizarBotones();
  $('#bloque-actual').hidden = !entrenamientoActivo;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
  pitido(880, 0.15);
  const contra = rivales.length > 1 ? `. Remas contra ${rivales.length} fantasmas` : rival ? '. Remas contra tu fantasma' : '';
  if (entrenamientoActivo) hablar(`Comienza ${entrenamientoActivo.nombre}${contra}`);
  else hablar(`Sesión iniciada${contra}`);
  if (ajustes.si('modoAuto', false)) abrirModoRemo();
  pintar();
  // En horizontal la carrera no cabe junto a los botones: se lleva a la vista al empezar.
  if (hayCarrera() && matchMedia('(orientation: landscape) and (max-height: 520px)').matches) {
    requestAnimationFrame(() => $('#carrera').scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
}

async function detenerSesion() {
  const s = sesion;
  const ent = entrenamientoActivo;
  sesion = null;
  entrenamientoActivo = null;
  actualizarBotones();
  cerrarModoRemo();
  $('#pausa-aviso').hidden = true;
  $('#rival').hidden = true;
  $('#atr-vivo').hidden = true;
  $('#mr-atr').hidden = true;
  carreraEnt.detener();
  carreraRemo.detener();
  cerrarFin();
  vistaPrevia();
  try { await wakeLock?.release(); } catch { /* nada */ }
  wakeLock = null;
  borrarSesionEnCurso();
  if (!s || s.muestras.length < 10) { toast('Sesión muy corta: no se guardó'); return; }
  await guardarSesionTerminada(s, ent);
}

// ---------- Sesión en curso a salvo ----------
// Android puede cerrar la app en segundo plano o con el gesto de atrás: cada 10 s remados (y al ocultarse)
// se copia lo remado para ofrecer guardarlo al volver a abrir.
const CLAVE_EN_CURSO = 'sesionEnCurso';
function guardarSesionEnCurso() {
  const s = sesion;
  if (!s || s.muestras.length < 10) return;
  const ent = entrenamientoActivo;
  const copia = {
    inicio: s.inicio, t: s.t, dist: s.dist, kcal: s.kcal, paladas: s.paladas, muestras: s.muestras,
    segConMeta: s.segConMeta, segEnRango: s.segEnRango, tiempoMeta: s.tiempoMeta, entrenamiento: s.entrenamiento,
    pruebaFtp: s.pruebaFtp, plan: s.plan, estadoAv: s.estadoAv, guardada: Date.now(),
    ent: ent ? { nombre: ent.nombre, bloques: ent.bloques, objetivo: ent.objetivo } : null,
  };
  try { localStorage.setItem(CLAVE_EN_CURSO, JSON.stringify(copia)); } catch { /* sin espacio: se reintenta en 10 s */ }
}
function borrarSesionEnCurso() {
  try { localStorage.removeItem(CLAVE_EN_CURSO); } catch { /* nada */ }
}
function leerSesionEnCurso() {
  try { return JSON.parse(localStorage.getItem(CLAVE_EN_CURSO) || 'null'); } catch { return null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarSesionEnCurso(); });
window.addEventListener('pagehide', guardarSesionEnCurso);

// Al abrir la app con una sesión que quedó a medias, se ofrece guardarla (sin carrera: los fantasmas no se guardan).
function ofrecerRecuperar() {
  const s = leerSesionEnCurso();
  if (!s || sesion) return;
  if (!Array.isArray(s.muestras) || s.muestras.length < 10) { borrarSesionEnCurso(); return; }
  const fin = s.muestras.at(-1);
  const f = new Date(s.inicio);
  const cuando = `${f.toLocaleDateString('es-MX', { weekday: 'long' })} a las ${f.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}`;
  $('#recuperar-texto').textContent = `${s.entrenamiento || 'Remo libre'} del ${cuando}: ${formatoTiempo(fin.t)} y ${miles(fin.dist)} m. La app se cerró antes de terminarla.`;
  $('#recuperar-dialogo').hidden = false;
  $('#recuperar-guardar').focus();
}
$('#recuperar-guardar').addEventListener('click', async () => {
  const s = leerSesionEnCurso();
  $('#recuperar-dialogo').hidden = true;
  borrarSesionEnCurso();
  if (s) await guardarSesionTerminada(s, s.ent, { recuperada: true });
});
$('#recuperar-descartar').addEventListener('click', () => {
  if (!confirm('¿Descartar la sesión sin guardar? No se puede deshacer.')) return;
  $('#recuperar-dialogo').hidden = true;
  borrarSesionEnCurso();
  toast('Sesión descartada');
});

// Arma el registro de una sesión terminada (o recuperada tras cerrar la app), lo guarda y abre su resumen.
async function guardarSesionTerminada(s, ent, { recuperada = false } = {}) {
  const m = s.muestras;
  const prom = (k) => Math.round(m.reduce((a, x) => a + x[k], 0) / m.length);
  const conSplit = m.filter((x) => x.split > 0);
  const registro = {
    fecha: s.inicio,
    duracion: m.at(-1).t,
    distancia: m.at(-1).dist,
    kcal: Math.round(s.kcal),
    paladas: Math.round(s.paladas),
    wattsProm: prom('w'),
    wattsMax: m.reduce((a, x) => Math.max(a, x.w), 0),
    spmProm: prom('spm'),
    splitProm: conSplit.length ? Math.round(conSplit.reduce((a, x) => a + x.split, 0) / conSplit.length) : 0,
    fcProm: m.some((x) => x.fc) ? Math.round(m.filter((x) => x.fc).reduce((a, x) => a + x.fc, 0) / m.filter((x) => x.fc).length) : 0,
    fcMax: m.reduce((a, x) => Math.max(a, x.fc || 0), 0),
    entrenamiento: s.entrenamiento,
    tiempoMeta: s.tiempoMeta,
    delPrograma: delProgramaHoy(s),
    pctEnRango: s.segConMeta ? Math.round((100 * s.segEnRango) / s.segConMeta) : null,
    bloques: s.plan ? Ent.bloquesConDuracion(s.estadoAv, s.plan, { t: s.t, dist: s.dist, paladas: s.paladas }) : null,
    muestras: m,
    ftp: ftp() || null,
    rpe: null,
    notas: '',
  };
  registro.estres = E.estres(registro, registro.ftp);
  if (s.pruebaFtp && ent) {
    let desde = 0;
    for (const b of ent.bloques) {
      if (b.prueba) {
        const tramo = m.filter((x) => x.t >= desde && x.t < desde + b.duracion);
        if (tramo.length >= b.duracion * 0.95) registro.pruebaWatts = Math.round(tramo.reduce((a, x) => a + x.w, 0) / tramo.length);
      }
      desde += b.duracion;
    }
  }
  if (s.rival) {
    const metaCarrera = ent?.objetivo?.metrica === 'distancia' ? ent.objetivo.valor : null;
    // En una carrera a distancia manda quién cruzó primero: lo remado después de la meta («Seguir remando»)
    // no adelanta a fantasmas que ya llegaron y se detuvieron.
    // Sin meta de distancia (intervalos o tiempo), la carrera se cierra al completar el plan: los fantasmas
    // se detienen ahí, así que los metros de «Seguir remando» tampoco cuentan.
    const metrosVs = (r) => {
      if (metaCarrera == null && s.tiempoMeta != null) return E.distanciaEn(m, s.tiempoMeta) - E.distanciaEn(r.muestras, s.tiempoMeta);
      if (metaCarrera == null || s.tiempoMeta == null) return s.dist - E.distanciaEn(r.muestras, s.t);
      const tr = F.tiempoA(r, metaCarrera);
      if (tr != null && tr < s.tiempoMeta) return E.distanciaEn(m, tr) - metaCarrera;
      return metaCarrera - E.distanciaEn(r.muestras, s.tiempoMeta);
    };
    const resumen = (r) => ({
      fecha: r.fecha ?? null, nivel: r.nivel ?? null, nombre: r.nombre, clase: r.clase ?? null, rango: r.rango ?? null, dificultad: r.dificultad ?? null,
      diferencia: V.diferenciaFinal(metrosVs(r), s.ventaja),
      tiempo: metaCarrera ? F.tiempoA(r, metaCarrera) : null,
    });
    if (s.ventaja && (V.metrosVentaja(s.ventaja) >= 0.5 || s.ventaja.objeto)) {
      registro.ventaja = { metros: Math.round(V.metrosVentaja(s.ventaja)), talentos: Math.round(s.ventaja.talentos), objeto: s.ventaja.objeto };
    }
    if (s.ventaja?.objeto) registro.ventajaUsada = s.ventaja.objeto;
    registro.rival = resumen(s.rival);
    if (s.rivales.length > 1) registro.rivales = s.rivales.map(resumen);
    // Terminar antes de completar el entrenamiento no gana la carrera: se guarda la diferencia, pero no cuenta como victoria.
    // En Remo libre no hay meta: cuenta si remaste al menos 5 minutos.
    if (ent ? s.tiempoMeta == null : s.t < 300) registro.carreraSinTerminar = true;
  }
  if (s.referencias?.length) {
    registro.referencias = s.referencias.map((r) => ({ nombre: r.nombre, fecha: r.fecha ?? null, diferencia: Math.round(s.dist - E.distanciaEn(r.muestras, s.t)) }));
  }
  registro.marcas = E.marcasDeSesion(registro);
  if (registro.ventajaUsada) {
    const inv = inventario();
    guardarPersonaje({ inventario: { ...inv, [registro.ventajaUsada]: Math.max(0, (inv[registro.ventajaUsada] || 0) - 1) } });
  }
  const previas = await db.listar('sesiones');
  const id = await db.guardar('sesiones', registro);
  if (registro.id == null && id != null) registro.id = id;
  pitido(660, 0.2);
  agregarLog(`sesión guardada: ${formatoTiempo(registro.duracion)}, ${registro.distancia} m`);
  const ftpAuto = ftpAutomatico(registro);
  // Con pulso, el esfuerzo se calcula solo; sin pulso, se pregunta en el resumen.
  const porPulso = E.esfuerzoPorPulso(registro.muestras, fcParaEsfuerzo());
  if (porPulso) Object.assign(registro, { rpe: porPulso.rpe, rpeFuente: 'pulso', rpePct: porPulso.pct });
  if (porPulso) await db.guardar('sesiones', registro);
  const recs = E.nuevosRecords(registro, previas);
  if (!recuperada) hablar(`Sesión terminada. ${(registro.distancia / 1000).toFixed(1).replace('.', ' punto ')} kilómetros${recs.length ? `. ${recs.length === 1 ? 'Nuevo récord' : `${recs.length} récords nuevos`}` : ''}${porPulso ? `. Esfuerzo ${porPulso.rpe} de 10 según tu pulso` : '. ¿Qué tan duro se sintió?'}`);
  abrirSesion(registro, { resumen: true, previas, ftpAuto });
  pintarHoy();
  pintarLineaNivel();
}

// Un tic por segundo: lee el estado, avanza la sesión (si no está en pausa) y pinta.
setInterval(() => {
  if (Date.now() - ultimoDato > 3000) { actual.watts = 0; actual.spm = 0; }
  tVivo += 1;
  for (const [k, v] of [['watts', actual.watts], ['spm', actual.spm]]) {
    vivo[k].push([tVivo, v]);
    if (vivo[k].length > 600) vivo[k].shift();
  }
  if (sesion) avanzarSesion();
  if (!Remadora.soportado()) $('#aviso-bt').hidden = !!remadora.demoTimer;
  pintar();
}, 1000);

function enPausa() {
  if (!sesion) return false;
  if (sesion.pausaManual) return 'manual';
  if (!remadora.conectada) return 'conexion';
  if (ajustes.si('pausaAuto', true) && (!sesion.empezo || sesion.sinRemar >= 3)) return 'auto';
  return false;
}

function avanzarSesion() {
  const remando = actual.spm > 0 || actual.watts > 0;
  sesion.sinRemar = remando ? 0 : sesion.sinRemar + 1;
  if (remando) sesion.empezo = true;

  // Distancia acumulada aunque la consola reinicie su contador (por ejemplo tras reconectar).
  if (actual.distancia != null) {
    if (sesion.distPrevia == null) sesion.distPrevia = actual.distancia;
    const m = E.metrosNuevos(sesion.distPrevia, actual.distancia);
    if (m === 0 && actual.distancia !== sesion.distPrevia) agregarLog(`distancia ignorada: ${sesion.distPrevia} → ${actual.distancia} m`);
    sesion.dist += m;
    sesion.distPrevia = actual.distancia;
  }

  const pausa = enPausa();
  if (pausa !== sesion.pausaPrevia) {
    if (pausa === 'auto' && sesion.empezo) hablar('Pausa', { clave: 'pausa', cadaSeg: 10 });
    if (!pausa && sesion.pausaPrevia === 'auto' && sesion.t > 0) hablar('Seguimos', { clave: 'seguimos', cadaSeg: 10 });
    sesion.pausaPrevia = pausa;
  }
  if (pausa) return;

  sesion.t += 1;
  const t = sesion.t;
  const peso = ajustes.num('peso', 75);
  sesion.kcal += kcalPorSegundo(actual.watts) + peso / 3600;
  sesion.paladas += actual.spm / 60;
  sesion.muestras.push({
    t, w: actual.watts, spm: actual.spm, split: actual.split, dist: Math.round(sesion.dist), nivel: actual.nivel ?? 0, fc: actual.fc,
  });
  coachRitmo(t);
  if (t % 10 === 0) guardarSesionEnCurso();
  if (sesion.ventaja) {
    const miDist = sesion.dist + V.metrosVentaja(sesion.ventaja);
    const detras = sesion.rivales.some((r) => E.distanciaEn(r.muestras, t) > miDist);
    V.avanzarVentaja(sesion.ventaja, { t, dist: sesion.dist, paladas: sesion.paladas, spm: actual.spm, detras });
  }
  if (sesion.rivales.length) { vigilarAdelantos(t); tamborSprint(); }
  avisarTalentos();
  if (t % 5 === 0) actualizarAtrVivo();
  if (sesion.rival && t % 60 === 0) {
    const dif = Math.round(sesion.dist + V.metrosVentaja(sesion.ventaja) - E.distanciaEn(sesion.rival.muestras, t));
    if (Math.abs(dif) >= 5) hablar(`Vas ${Math.abs(dif)} metros ${dif > 0 ? 'adelante' : 'atrás'} de tu fantasma`, { clave: 'fantasma', cadaSeg: 50 });
  }
  if (!entrenamientoActivo) return;
  if (Ent.tipoDe(entrenamientoActivo) === 'objetivo') {
    sesion.avance.push([t, { distancia: sesion.dist, kcal: sesion.kcal, paladas: sesion.paladas }[entrenamientoActivo.objetivo.metrica]]);
    avanceObjetivo(t);
  } else avanceBloque(t);
}

// Atributos en vivo: lo que llevas de los que se ganan remando, el siguiente punto y un aviso al sumar.
const ATR_VIVO = ['fuerza', 'agilidad', 'resistencia', 'tecnica'];
async function prepararAtrVivo() {
  $('#atr-vivo').hidden = true;
  $('#mr-atr').hidden = true;
  if (!sesion || ajustes.leer('atrVivo', '1') !== '1') return;
  const { per, h } = await estadoHeroe();
  if (!sesion) return;
  sesion.atr = { opc: { ftp: ftp() || estimarFtp(await db.listar('sesiones')) || 150, clase: per.clase || null, ctx: h.contexto }, vistos: {}, ultimoPop: -99 };
}
function actualizarAtrVivo() {
  const a = sesion?.atr;
  if (!a || !sesion.muestras.length) return;
  const pct = sesion.segConMeta ? Math.round((100 * sesion.segEnRango) / sesion.segConMeta) : null;
  const b = sesion.info && !sesion.info.terminado ? sesion.info.bloque : null;
  const rw = b && Ent.rangoWatts(b, ftp());
  const v = C.enVivo(sesion.muestras, { ...a.opc, pct, rango: rw ? { min: Math.round(rw.min), max: Math.round(rw.max) } : null });
  if (!v) return;
  const subidas = ATR_VIVO.filter((k) => v.puntos[k] > (a.vistos[k] || 0));
  if (subidas.length && sesion.t - a.ultimoPop >= 15) {
    const k = subidas.includes(v.reto.atributo) ? v.reto.atributo : subidas[0];
    const f = a.opc.ftp;
    const porque = { fuerza: `Otro tramo por encima de ${Math.round(f * 0.91)} W`, agilidad: `20 s por encima de ${Math.round(f * 1.06)} W`, resistencia: 'Minutos en zonas 2 y 3', tecnica: pct != null ? `En rango el ${pct} % del tiempo` : 'Buena palada' }[k];
    mostrarPopAtr(`+${v.puntos[k] - (a.vistos[k] || 0)} ${nombreAtributo(k)}`, `${porque}. Llevas +${v.puntos[k]} hoy.`);
    a.ultimoPop = sesion.t;
  }
  for (const k of ATR_VIVO) a.vistos[k] = Math.max(a.vistos[k] || 0, v.puntos[k]);
  pintarAtrVivo(v);
}
function pintarAtrVivo(v) {
  const r = v.reto;
  const n = nombreAtributo(r.atributo);
  const anillo = `<span class="anillo" style="--p:${Math.round(r.progreso * 100)}%" aria-hidden="true"></span>`;
  const meta = r.faltanSeg ? `+1 ${n} en ${r.faltanSeg} s` : r.corto || `Suma ${n}`;
  $('#atr-vivo').hidden = false;
  $('#atr-vivo-chips').innerHTML = ATR_VIVO.map((k) => `<span class="${k === r.atributo ? 'activo' : ''}">${nombreAtributo(k)} <b>+${v.puntos[k]}</b></span>`).join('');
  $('#atr-reto').innerHTML = `${anillo}<div><b>${escaparHtml(r.titulo)}</b><small>${escaparHtml(r.detalle)}</small></div><span class="cond-pts">${meta}</span>`;
  const mr = $('#mr-atr');
  mr.hidden = false;
  mr.innerHTML = `${anillo}<span><b>${meta}</b> · ${ATR_VIVO.filter((k) => v.puntos[k] > 0).map((k) => `${nombreAtributo(k).slice(0, 3)}. +${v.puntos[k]}`).join(' · ') || 'Hoy: sin puntos aún'}</span>`;
}
let popAtrTimer = 0;
function mostrarPopAtr(titulo, detalle) {
  const el = $('#atr-pop');
  el.innerHTML = `${ico('i-sube')}<div><b>${titulo}</b><small>${escaparHtml(detalle)}</small></div>`;
  el.hidden = false;
  el.classList.toggle('en-remo', !$('#modo-remo').hidden);
  clearTimeout(popAtrTimer);
  popAtrTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

// Avisos de los talentos de carrera: los frecuentes (paladas extra, cada 250 m…) solo en la pista; los grandes, también con voz.
function avisarTalentos() {
  const v = sesion.ventaja;
  if (!v) return;
  for (const ev of v.eventos.slice(v.vistos)) {
    const m = ev.m >= 1 ? Math.round(ev.m) : ev.m.toFixed(1).replace('.', ',');
    eventoCarrera('ventaja', `+${m} m`, ev.nombre);
    if (!ev.discreto) {
      toast(`${ev.nombre}: +${m} m`);
      hablar(`${ev.nombre}: más ${m} metros`, { clave: 'talento', cadaSeg: 15 });
    }
  }
  v.vistos = v.eventos.length;
}

// Avisos que la carrera dibuja un momento: adelantos, te pasan y ventajas.
function eventoCarrera(tipo, texto, detalle = '') {
  const lista = sesion.eventosCarrera;
  lista.push({ id: (lista.at(-1)?.id || 0) + 1, tipo, texto, detalle });
  if (lista.length > 8) lista.shift();
}

// Adelantos: cuando cambia quién va delante entre tú y cada fantasma (con 1 m de margen para no parpadear).
function vigilarAdelantos(t) {
  const miDist = sesion.dist + V.metrosVentaja(sesion.ventaja);
  const lados = sesion.rivales.map((r, i) => {
    const d = miDist - E.distanciaEn(r.muestras, t);
    const antes = sesion.lados?.[i] ?? 0;
    return d > 1 ? 1 : d < -1 ? -1 : antes;
  });
  if (sesion.lados && t > 5) {
    lados.forEach((l, i) => {
      const antes = sesion.lados[i];
      if (!antes || l === antes) return;
      const nombre = corto(sesion.rivales[i].nombre);
      if (l > 0) {
        eventoCarrera('adelanto', `¡Adelantaste a ${nombre}!`);
        V.alAdelantar(sesion.ventaja, t);
        hablar(`Adelantaste a ${nombre}`, { clave: `adelanto-${i}`, cadaSeg: 8 });
        vibrar([60, 40, 60]);
      } else {
        eventoCarrera('te-pasan', `${nombre} te adelantó`);
        hablar(`${nombre} te adelantó`, { clave: `adelanto-${i}`, cadaSeg: 8 });
        vibrar(250);
      }
    });
  }
  sesion.lados = lados;
}

// Sprint final: en los últimos 250 m suena un tambor cada segundo (doble en los últimos 100 m).
function tamborSprint() {
  const meta = entrenamientoActivo?.objetivo?.metrica === 'distancia' ? entrenamientoActivo.objetivo.valor : null;
  if (!meta || sesion.tiempoMeta != null) return;
  const falta = meta - sesion.dist;
  if (falta > 250 || falta <= 0) return;
  if (!sesion.sprintAvisado) {
    sesion.sprintAvisado = true;
    hablar('¡Sprint final! Últimos 250 metros', { urgente: true });
    vibrar([80, 60, 80, 60, 80]);
  }
  pitido(98, 0.14);
  if (falta <= 100) setTimeout(() => pitido(98, 0.12), 480);
}

const corto = (nombre = '') => nombre.replace(/^Fantasma /, '').split(' (')[0];

const ANIMOS = ['¡Buen ritmo, sigue así!', 'Vas muy bien, mantén la técnica', 'Piernas, espalda, brazos. Así se rema', '¡Fuerte! Cada palada cuenta', 'Respira y mantén el ritmo'];

// Parciales de 500 m (con aviso por voz), ánimo de vez en cuando y aviso si el ritmo se cae.
function coachRitmo(t) {
  const n = Math.floor(sesion.dist / 500);
  if (n > sesion.n500) {
    const seg = t - sesion.t500;
    sesion.parcial = { seg, n };
    sesion.n500 = n;
    sesion.t500 = t;
    hablar(`${n * 500} metros. Parcial ${splitHablado(seg)}`, { clave: 'parcial', cadaSeg: 20 });
  }
  if (t % 240 === 0 && sesion.fueraSeguidos === 0) hablar(ANIMOS[(t / 240) % ANIMOS.length], { clave: 'animo', cadaSeg: 200 });
  // En intervalos los descansos bajan el ritmo a propósito: ahí manda el aviso de rango.
  if (sesion.plan || t < 60 || sesion.dist < 100) return;
  const ref = sesion.ritmo || (t * 500) / sesion.dist;
  const v = velocidadReciente();
  const reciente = v > 0 ? 500 / v : Infinity;
  sesion.lento = reciente > ref + (sesion.ritmo ? 3 : 6) ? sesion.lento + 1 : 0;
  if (sesion.lento >= 20) {
    sesion.lento = 0;
    hablar(sesion.ritmo ? `Vas más lento que tu ritmo objetivo de ${splitHablado(sesion.ritmo)}. Aprieta` : 'Estás bajando el ritmo. Aprieta', { clave: 'lento', cadaSeg: 60 });
  }
}

// Último parcial de 500 m: verde si va al ritmo objetivo (o mejor que tu promedio), rojo si no.
function textoParcial() {
  const p = sesion?.parcial;
  if (!p) return { texto: sesion?.ritmo ? `Objetivo ${formatoSplit(sesion.ritmo)}` : '', corto: sesion?.ritmo ? `Obj. ${formatoSplit(sesion.ritmo)}` : '', clase: '' };
  const ref = sesion.ritmo || (sesion.t500 * 500) / Math.max(1, p.n * 500);
  const clase = sesion.ritmo ? (p.seg <= ref ? 'ok' : 'mal') : (p.seg <= ref + 0.5 ? 'ok' : 'mal');
  return { texto: `Último 500 m ${formatoSplit(p.seg)}`, corto: `Últ. 500 ${formatoSplit(p.seg)}`, clase };
}

function avanceObjetivo(t) {
  const p = progresoActual(t);
  if (p.completo && sesion.tiempoMeta == null) {
    sesion.tiempoMeta = t;
    pitido(1046, 0.4);
    vibrar([200, 100, 200, 100, 400]);
    hablar(`¡Meta cumplida! en ${tiempoHablado(t)}. ¿Sigues o terminas?`, { urgente: true });
    mostrarFin();
  } else if (!p.completo && p.fraccion >= 0.5 && !sesion.mitadAvisada) {
    sesion.mitadAvisada = true;
    hablar(`Vas a la mitad. Faltan ${Math.ceil(p.falta)} ${Ent.METRICAS_OBJETIVO[p.metrica].unidad === 'm' ? 'metros' : Ent.METRICAS_OBJETIVO[p.metrica].unidad}`);
  }
}

// Al completar el entrenamiento se pregunta si seguir remando o terminar y guardar.
function mostrarFin() {
  const partes = [formatoTiempo(sesion.tiempoMeta ?? sesion.t), `${miles(sesion.dist)} m`];
  if (sesion.rival) partes.push(carreraActual().texto.replace(/^Vas /, ''));
  $('#fin-texto').textContent = partes.join(' · ');
  $('#fin-dialogo').hidden = false;
  $('#fin-terminar').focus();
  if (sesion.rival && carreraActual().tono === 'adelante') confeti();
}
function cerrarFin() { $('#fin-dialogo').hidden = true; }
$('#fin-seguir').addEventListener('click', () => { cerrarFin(); hablar('Seguimos'); });
$('#fin-terminar').addEventListener('click', () => { cerrarFin(); if (sesion) detenerSesion(); });

function progresoActual(t) {
  return Ent.progresoObjetivo(entrenamientoActivo, { distancia: sesion.dist, kcal: sesion.kcal, paladas: sesion.paladas }, t);
}

const splitHablado = (s) => `${Math.floor(s / 60)} ${String(s % 60).padStart(2, '0')}`;
function metaHablada(b) {
  const r = Ent.rangoWatts(b, ftp());
  if (r) return `${r.min} a ${r.max} watts`;
  if (b.metrica === 'split') return `split de ${splitHablado(b.min)} a ${splitHablado(b.max)}`;
  if (b.metrica === 'spm') return `${b.min} a ${b.max} golpes por minuto`;
  return 'ritmo libre';
}

function cantidadHablada(b) {
  const fin = Ent.finDe(b);
  if (fin === 'distancia') return `${b.cantidad} metros`;
  if (fin === 'paladas') return `${b.cantidad} paladas`;
  return `durante ${tiempoHablado(b.duracion)}`;
}

function avanceBloque(t) {
  const info = Ent.avanzar(sesion.estadoAv, sesion.plan, medidas());
  sesion.info = info;
  sesion.bloques = paraPerfil(Ent.bloquesConDuracion(sesion.estadoAv, sesion.plan, medidas()));
  if (info.terminado) {
    if (sesion.bloqueAnterior !== sesion.plan.length) {
      sesion.bloqueAnterior = sesion.plan.length;
      sesion.tiempoMeta = info.desde;
      pitido(1046, 0.4);
      vibrar([200, 100, 200]);
      const pct = sesion.segConMeta ? Math.round((100 * sesion.segEnRango) / sesion.segConMeta) : null;
      hablar(`Entrenamiento completado${pct != null ? `. Estuviste en rango el ${pct} por ciento del tiempo` : ''}. ¿Sigues o terminas?`, { urgente: true });
      mostrarFin();
    }
    return;
  }
  const { i, bloque: b, resta } = info;
  const fin = Ent.finDe(b);
  if (i !== sesion.bloqueAnterior) {
    if (sesion.bloqueAnterior !== -1) { pitido(988, 0.25); vibrar(250); }
    sesion.bloqueAnterior = i;
    sesion.fueraSeguidos = 0;
    hablar(`${b.nombre || 'Intervalo'}. ${metaHablada(b)}, ${cantidadHablada(b)}`, { urgente: true });
    if (b.nivel && ajustes.si('resAuto', false)) {
      remadora.fijarResistencia(b.nivel);
      agregarLog(`resistencia automática: nivel ${b.nivel}`);
    }
  }
  if (fin === 'tiempo' && resta <= 3 && resta > 0) {
    pitido(660, 0.08);
    if (b.duracion > 10) hablar(String(resta), { urgente: true });
  }
  const cerca = fin === 'distancia' ? 100 : fin === 'paladas' ? 10 : 0;
  if (cerca && resta <= cerca && Ent.cantidadDe(b) > cerca * 1.5 && sesion.avisoCerca !== i) {
    sesion.avisoCerca = i;
    pitido(660, 0.1);
    hablar(fin === 'distancia' ? 'Últimos 100 metros' : 'Últimas 10 paladas', { urgente: true });
  }
  const rango = Ent.enRango(b, actual.watts, actual.spm, ftp(), actual.split, actual.fc);
  if (rango) {
    sesion.segConMeta += 1;
    if (rango === 'dentro') sesion.segEnRango += 1;
  }
  sesion.fueraSeguidos = rango && rango !== 'dentro' ? sesion.fueraSeguidos + 1 : 0;
  if (sesion.fueraSeguidos >= 5 && info.restaSeg > 4) {
    const potencia = !!Ent.rangoWatts(b, ftp());
    const pulso = b.metrica === 'fc';
    const texto = pulso ? (rango === 'bajo' ? 'Pulso bajo, sube la intensidad' : 'Pulso alto, baja la intensidad')
      : rango === 'bajo' ? (potencia ? 'Sube la potencia' : 'Sube el ritmo') : (potencia ? 'Baja la potencia' : 'Baja el ritmo');
    hablar(texto, { clave: 'fuera', cadaSeg: 20 });
  }
}

// ---------- Pintado ----------
function textoIndicador(rango, potencia) {
  if (rango === 'dentro') return `${ico('i-check')}En rango`;
  if (rango === 'bajo') return `${ico('i-arriba')}${potencia ? 'Sube la potencia' : 'Sube el ritmo'}`;
  if (rango === 'alto') return `${ico('i-abajo')}${potencia ? 'Baja la potencia' : 'Baja el ritmo'}`;
  return '';
}

function marcarRango(rango, potencia = true) {
  const caja = $('#bloque-actual');
  caja.classList.toggle('dentro', rango === 'dentro');
  caja.classList.toggle('fuera', rango === 'bajo' || rango === 'alto');
  const ind = $('#bloque-indicador');
  ind.className = `indicador ${rango || ''}`;
  ind.innerHTML = textoIndicador(rango, potencia);
  const p = $('#mr-principal');
  p.classList.remove('dentro', 'bajo', 'alto');
  if (rango) p.classList.add(rango);
  $('#mr-indicador').innerHTML = textoIndicador(rango, potencia);
}

function pintarRival() {
  const r = hayCarrera();
  // En Entrenar la carrera ya muestra la diferencia: el aviso de texto queda solo para el modo remo.
  $('#rival').hidden = true;
  $('#mr-rival').hidden = !r;
  $('#carrera').hidden = !r;
  if (!r) { carreraEnt.detener(); return; }
  const c = carreraActual();
  $('#carrera').setAttribute('aria-label', c.texto);
  if (vistaActiva('entrenar')) carreraEnt.actualizar(c.estado);
  for (const [caja, span] of [['#rival', '#rival-texto'], ['#mr-rival', '#mr-rival-texto']]) {
    $(span).textContent = c.texto;
    $(caja).classList.toggle('adelante', c.tono === 'adelante');
    $(caja).classList.toggle('atras', c.tono === 'atras');
  }
}

// Velocidad reciente (m/s) con los últimos ~20 s, para proyectar la llegada.
function velocidadReciente() {
  const m = sesion.muestras;
  if (m.length < 5) return actual.split > 0 ? 500 / actual.split : 0;
  const a = m[Math.max(0, m.length - 21)];
  const b = m.at(-1);
  return b.t > a.t ? (b.dist - a.dist) / (b.t - a.t) : 0;
}

// Todo lo que muestra la carrera en este segundo: textos, tono y estado para el lienzo.
function carreraActual() {
  const t = sesion.t;
  const rs = sesion.rivales;
  const refs = (sesion.referencias || []).map((x) => ({ etiqueta: x.etiqueta, discontinua: x.discontinua, muestras: x.muestras, nombre: x.nombre }));
  const vsRef = refs.map((x) => {
    const d = Math.round(sesion.dist - E.distanciaEn(x.muestras, t));
    return `${d > 0 ? '+' : ''}${d} m vs. ${x.etiqueta.toLowerCase()}`;
  }).join(' · ');
  if (!rs.length) {
    const x = refs[0];
    const d = Math.round(sesion.dist - E.distanciaEn(x.muestras, t));
    const texto = d === 0 ? `Igual que ${x.nombre.toLowerCase()}` : `${Math.abs(d)} m ${d > 0 ? 'adelante' : 'atrás'} de ${x.nombre.toLowerCase()}`;
    const tono = d > 0 ? 'adelante' : d < 0 ? 'atras' : '';
    return {
      texto, tono, proyeccion: null,
      estado: {
        t, pausa: !!enPausa() || !sesion.empezo, yo: { dist: sesion.dist, v: actual.split > 0 ? 500 / actual.split : 0, spm: actual.spm },
        rivales: [], referencias: refs, meta: entrenamientoActivo?.objetivo?.metrica === 'distancia' ? entrenamientoActivo.objetivo.valor : null,
        cabecera: [texto, refs.length > 1 ? vsRef : ''], tono,
        reloj: relojCarrera(entrenamientoActivo?.objetivo?.metrica === 'distancia' ? entrenamientoActivo.objetivo.valor : null, velocidadReciente(), null),
        ritmo: sesion.ritmo ? { v: 500 / sesion.ritmo, etiqueta: `Ritmo ${formatoSplit(sesion.ritmo)}` } : null,
        yoColor: O.objeto(leerPersonaje().equipo?.bote)?.color || null,
      },
    };
  }
  const obj = entrenamientoActivo?.objetivo;
  const meta = obj?.metrica === 'distancia' ? obj.valor : null;
  const extra = V.metrosVentaja(sesion.ventaja);
  const miDist = sesion.dist + extra;
  // Después de cruzar la meta el puesto queda fijo: cuenta quién llegó primero, no lo remado de más.
  const tm = meta != null ? sesion.tiempoMeta : null;
  // Sin meta de distancia, el plan completo cierra la carrera: lo que remes después no cuenta.
  const cierre = meta == null && entrenamientoActivo ? sesion.tiempoMeta : null;
  const difs = rs.map((r) => {
    if (cierre != null) return E.distanciaEn(sesion.muestras, cierre) + extra - E.distanciaEn(r.muestras, cierre);
    if (tm == null) return miDist - E.distanciaEn(r.muestras, t);
    const tr = F.tiempoA(r, meta);
    return tr != null && tr < tm ? E.distanciaEn(sesion.muestras, tr) + extra - meta : meta + extra - E.distanciaEn(r.muestras, tm);
  });
  const lugar = 1 + difs.filter((d) => d < -0.5).length;
  // Con varios fantasmas se compara con el más cercano en la pelea: el que va justo delante o, si vas primero, el segundo.
  let iRef = 0;
  if (rs.length > 1) {
    const delante = difs.map((d, i) => [d, i]).filter(([d]) => d < -0.5);
    iRef = (delante.length ? delante.reduce((a, b) => (b[0] > a[0] ? b : a)) : difs.map((d, i) => [d, i]).reduce((a, b) => (b[0] < a[0] ? b : a)))[1];
  }
  const dif = Math.round(difs[iRef]);
  const r = rs[iRef];
  const quien = r.nivel && F.NIVELES[r.nivel] ? `fantasma ${F.NIVELES[r.nivel].nombre.toLowerCase()}` : (r.nombre || 'fantasma').replace(/^Fantasma/, 'fantasma');
  let texto = dif === 0 ? `Empatado con ${quien}` : `${Math.abs(dif)} m ${dif > 0 ? 'adelante' : 'atrás'} de ${quien}`;
  if (rs.length > 1) texto = `Vas ${lugar}º de ${rs.length + 1} · ${texto}`;
  // Verde solo si vas ganando, rojo solo si vas último; en medio, neutro.
  const tono = rs.length > 1 ? (lugar === 1 ? 'adelante' : lugar === rs.length + 1 ? 'atras' : '') : (dif > 0 ? 'adelante' : dif < 0 ? 'atras' : '');

  // Diferencia en segundos con el primer fantasma: cuánto tardó él en llegar a donde estás tú.
  let l1 = texto;
  const tr = F.tiempoA(r, miDist);
  if (rs.length === 1 && sesion.dist > 20 && tr != null && Math.abs(dif) >= 1) {
    const seg = Math.round(t - tr);
    if (seg !== 0) l1 = `${Math.abs(dif)} m ${dif > 0 ? 'adelante' : 'atrás'} · ${Math.abs(seg)} s`;
  } else if (rs.length === 1 && dif === 0) l1 = 'Empatados';
  else if (rs.length > 1) l1 = `${lugar}º de ${rs.length + 1} · ${dif > 0 ? '+' : ''}${dif} m vs. ${quien.replace(/^fantasma /, '')}`;

  const v = velocidadReciente();
  const p = sesion.empezo && t >= 10 ? F.proyectar({ t, dist: miDist, v }, rs, { meta, duracion: duracionCarrera() }) : null;
  let l2 = '';
  if (p?.tipo === 'duracion') l2 = `Al final ≈ ${miles(Math.round(p.miDist))} m`;
  if (extra >= 1) l2 = `${l2 ? `${l2} · ` : ''}Ventaja +${Math.round(extra)} m`;
  if (vsRef) l2 = `${l2 ? `${l2} · ` : ''}${vsRef}`;
  const estado = {
    t,
    pausa: !!enPausa() || !sesion.empezo,
    yo: { dist: miDist, v: actual.split > 0 ? 500 / actual.split : 0, spm: actual.spm },
    rivales: rs.map((x) => ({
      nombre: corto(x.nombre), color: x.color, muestras: x.muestras, spmEn: (tt) => F.spmEn(x, tt), clase: x.clase || null,
      retrato: x.clase && x.rango ? srcRetratoRango(x.clase, x.rango) : null,
      aviso: sesion.ventaja?.objeto === 'mapa' ? V.proximoAceleron(x, t) : null,
    })),
    referencias: refs,
    meta,
    cabecera: [l1, l2],
    lugar, total: rs.length + 1, cercanos: cercanos(rs, difs, miDist, t),
    reloj: relojCarrera(meta, v, p),
    yoClase: J.claseDe(leerPersonaje().clase)?.clave || null,
    yoRetrato: sesion.retrato,
    ventajaM: extra,
    eventos: sesion.eventosCarrera,
    tono,
    ritmo: sesion.ritmo ? { v: 500 / sesion.ritmo, etiqueta: `Ritmo ${formatoSplit(sesion.ritmo)}` } : null,
    yoColor: O.objeto(leerPersonaje().equipo?.bote)?.color || null,
  };
  return { texto, tono, estado, proyeccion: p };
}

// Tiempo que llevas y el que falta a tu ritmo actual (con tus metros reales, sin la ventaja).
function relojCarrera(meta, v, p) {
  const t = sesion.t;
  let falta = null;
  if (meta) {
    if (sesion.dist >= meta) falta = 0;
    else if (sesion.empezo && t >= 10 && v > 0) falta = Math.round((meta - sesion.dist) / v);
  } else {
    const dur = duracionCarrera();
    if (dur && entrenamientoActivo) falta = Math.max(0, dur - t);
  }
  return { lleva: t, falta, lugar: p?.lugar ?? null, total: p?.total ?? null, porRitmo: !!meta };
}

// Rival justo delante y justo detrás de ti, con la diferencia en metros y en segundos.
function cercanos(rs, difs, miDist, t) {
  const fila = (i, delante) => {
    if (i < 0) return null;
    const tr = F.tiempoA(rs[i], miDist);
    const seg = tr == null ? null : Math.round(Math.abs(t - tr));
    return { nombre: corto(rs[i].nombre), color: rs[i].color, m: Math.round(Math.abs(difs[i])), seg, delante };
  };
  let ad = -1;
  let at = -1;
  difs.forEach((d, i) => {
    if (d < 0 && (ad < 0 || d > difs[ad])) ad = i;
    if (d >= 0 && (at < 0 || d < difs[at])) at = i;
  });
  return [fila(ad, true), fila(at, false)].filter(Boolean);
}

// Retrato de tu héroe con su rango actual, para tu carril.
async function retratoPropio() {
  const per = leerPersonaje();
  const c = per.clase ? J.claseDe(per.clase) : null;
  if (!c) return null;
  const h = J.estadoJuego(await db.listar('sesiones'), { ftp: ftp(), per });
  return srcHeroe(c.clave, h.nivel || 1, true);
}

// Duración de la carrera para proyectar cuando la meta no es una distancia.
function duracionCarrera() {
  const ent = entrenamientoActivo;
  if (ent && Ent.tipoDe(ent) === 'intervalos' && Ent.soloTiempo(ent)) return Ent.duracionTotal(ent);
  // En remo libre contra fantasmas simulados no hay un final que proyectar.
  if (!ent && sesion.rivales.every((r) => r.sintetico)) return null;
  return Math.max(...sesion.rivales.map((r) => r.muestras.at(-1)?.t || 0));
}

function pintar() {
  const t = sesion ? sesion.t : 0;
  const dist = sesion ? Math.round(sesion.dist) : (actual.distancia ?? 0);
  const f = ftp();
  const zona = Ent.zonaDe(actual.watts, f);
  const zfc = E.zonaFc(actual.fc, ajustes.num('fcMax', 0));
  $('#m-watts').textContent = actual.watts;
  $('#m-nivel-etq').textContent = actual.nivel && avanzado() ? `· nivel ${actual.nivel}` : '';
  $('#m-zona').textContent = zona ? textoZona(zona) : '';
  $('#m-zona').style.color = zona ? COLOR_ZONA[zona.n - 1] : '';
  cambiarTexto($('#m-split'), formatoSplit(actual.split));
  $('#m-spm').textContent = actual.spm;
  $('#m-tiempo').textContent = formatoTiempo(t);
  $('#m-dist').textContent = dist;
  $('#m-paladas').textContent = sesion ? Math.round(sesion.paladas) : 0;
  $('#m-kcal').textContent = sesion ? Math.round(sesion.kcal) : 0;
  $('#m-fc').textContent = actual.fc || '-';
  $('#m-fc-zona').textContent = zfc ? `lpm · Z${zfc.n} ${zfc.nombre}` : 'lpm';
  $('#m-fc-zona').style.color = zfc ? COLOR_ZONA[zfc.n] : '';
  $('#m-mpp').textContent = sesion && sesion.paladas >= 5 ? (sesion.dist / sesion.paladas).toFixed(1) : '-';
  const par = textoParcial();
  for (const id of ['#m-parcial', '#mr-parcial']) {
    // En modo remo la casilla es angosta: texto corto en una línea para que no crezca ni mueva lo demás.
    $(id).textContent = id === '#mr-parcial' ? par.corto : par.texto;
    $(id).classList.toggle('ok', par.clase === 'ok');
    $(id).classList.toggle('mal', par.clase === 'mal');
  }

  const pausa = enPausa();
  $('#pausa-aviso').hidden = !pausa;
  $('#pausa-aviso').textContent = {
    manual: 'En pausa: pulsa Seguir para continuar',
    auto: sesion?.empezo ? 'En pausa: empieza a remar para continuar' : 'Listo: el tiempo empieza con tu primera palada',
    conexion: 'Sin conexión con la remadora: la sesión está en pausa',
  }[pausa] || '';

  // Modo remo
  $('#mr-watts').textContent = actual.watts;
  cambiarTexto($('#mr-split'), formatoSplit(actual.split));
  $('#mr-spm').textContent = actual.spm;
  $('#mr-tiempo').textContent = formatoTiempo(t);
  $('#mr-dist').textContent = dist;
  $('#mr-fc').textContent = actual.fc || '-';
  $('#mr-fc').style.color = zfc ? COLOR_ZONA[zfc.n] : '';
  $('#mr-estado').textContent = $('#pausa-aviso').textContent;
  const objPaladas = entrenamientoActivo?.objetivo?.metrica === 'paladas';
  $('#mr-extra-etq').textContent = objPaladas ? 'Calorías' : (entrenamientoActivo?.objetivo ? 'Paladas' : 'Calorías');
  $('#mr-extra').textContent = sesion ? Math.round(objPaladas || !entrenamientoActivo?.objetivo ? sesion.kcal : sesion.paladas) : 0;
  pintarRival();

  if (sesion && entrenamientoActivo) {
    if (Ent.tipoDe(entrenamientoActivo) === 'objetivo') pintarObjetivo(t);
    else pintarBloque(t);
  } else if (sesion) {
    $('#mr-nombre').textContent = 'Remo libre';
    $('#mr-meta-texto').textContent = zona ? textoZona(zona) : '';
    $('#mr-resta').textContent = formatoTiempo(t);
    $('#mr-resta-etq').textContent = 'tiempo';
    $('#mr-barra').style.width = '0%';
    marcarRango(null);
  }
  if (vistaActiva('entrenar')) dibujarVivo();
  if (!$('#modo-remo').hidden && vistaGrafica()) pintarGraficaRemo(t);
}

// Vista del modo remo: 'numeros', 'grafica' o 'carrera' (esta solo si hay fantasma).
function vistaRemo() {
  const v = ajustes.leer('vistaRemo', 'numeros');
  if (v === 'carrera' && !hayCarrera()) return 'grafica';
  return v;
}
const vistaGrafica = () => vistaRemo() !== 'numeros';
let leyendaRemo = '';
function leyenda(html) {
  if (html !== leyendaRemo) { $('#mr-leyenda').innerHTML = html; leyendaRemo = html; }
}

function pintarGraficaRemo(t) {
  const canvas = $('#mr-grafica');
  if (vistaRemo() === 'carrera') {
    const clases = ['lcar', 'lcar2', 'lcar3'];
    leyenda(`<span class="lw">Tú</span>${sesion.rivales.map((r, i) => `<span class="${clases[i]}">${escaparHtml(r.nombre.replace(/^Fantasma /, ''))}</span>`).join('')}`);
    canvas.setAttribute('aria-label', $('#mr-rival-texto').textContent);
    carreraRemo.actualizar(carreraActual().estado);
    return;
  }
  carreraRemo.detener();
  const ent = sesion ? entrenamientoActivo : null;
  const previa = !sesion && $('#sel-entrenamiento').value ? entrenamientoPrevio : null;
  const plan = ent || previa;
  if (plan && Ent.tipoDe(plan) === 'intervalos') {
    leyenda('<span class="lr">Rango objetivo</span><span class="lf">Fuera de rango</span><span class="lp">Tu potencia</span>');
    canvas.setAttribute('aria-label', 'Plan de potencia con tu potencia real');
    dibujarPerfil(canvas, sesion ? sesion.bloques : paraPerfil(plan.bloques), sesion ? sesion.muestras.map((x) => [x.t, x.w]) : [], sesion ? t : null);
  } else if (plan) {
    const unidad = Ent.METRICAS_OBJETIVO[plan.objetivo.metrica].unidad;
    leyenda(`<span class="lw">Llevas (${unidad})</span><span class="lr">Meta ${plan.objetivo.valor} ${unidad}</span><span class="lp">Proyección a tu ritmo</span>`);
    canvas.setAttribute('aria-label', `Avance hacia la meta de ${plan.objetivo.valor} ${unidad}`);
    const p = sesion ? progresoActual(t) : null;
    dibujarAvance(canvas, sesion ? sesion.avance : [], plan.objetivo.valor, p && !p.completo && p.estimadoSeg != null ? t + p.estimadoSeg : null);
  } else {
    leyenda('<span class="lw">Watts</span><span class="ls">Golpes/min</span>');
    canvas.setAttribute('aria-label', 'Watts y golpes por minuto de los últimos 5 minutos');
    dibujar(canvas, [
      { color: color('--watts'), eje: 'izq', puntos: vivo.watts },
      { color: color('--spm'), eje: 'der', puntos: vivo.spm },
    ], { ventana: 300 });
  }
}

// Orden al tocar el botón: números → gráfica → carrera (si hay fantasma) → números.
function siguienteVista() {
  const v = vistaRemo();
  if (v === 'numeros') return 'grafica';
  if (v === 'grafica' && hayCarrera()) return 'carrera';
  return 'numeros';
}

function aplicarVistaRemo() {
  const v = vistaRemo();
  $('#modo-remo').classList.toggle('vista-grafica', v !== 'numeros');
  $('#modo-remo').classList.toggle('vista-carrera', v === 'carrera');
  const sig = siguienteVista();
  const b = $('#mr-vista');
  b.classList.toggle('activo', v !== 'numeros');
  // El botón muestra la vista actual y unos puntos con su lugar en la vuelta; tocarlo pasa a la siguiente.
  const vistas = hayCarrera() ? ['numeros', 'grafica', 'carrera'] : ['numeros', 'grafica'];
  const icono = { numeros: '<span class="num" aria-hidden="true">123</span>', grafica: ico('i-grafica'), carrera: ico('i-fantasma') };
  const nombre = { numeros: 'números grandes', grafica: 'gráfica', carrera: 'carrera' };
  b.innerHTML = `${icono[v]}<span class="vista-puntos" aria-hidden="true">${vistas.map((x) => (x === v ? '●' : '○')).join('')}</span>`;
  b.setAttribute('aria-label', `Vista: ${nombre[v]}. Toca para cambiar a ${nombre[sig]}`);
}
$('#mr-vista').addEventListener('click', () => {
  ajustes.escribir('vistaRemo', siguienteVista());
  selVistaRemo.value = ajustes.leer('vistaRemo', 'numeros');
  aplicarVistaRemo();
  requestAnimationFrame(pintar);
});

function pintarObjetivo(t) {
  const ent = entrenamientoActivo;
  const p = progresoActual(t);
  const unidad = Ent.METRICAS_OBJETIVO[p.metrica].unidad;
  const pct = `${100 * p.fraccion}%`;
  $('#bloque-nombre').textContent = ent.nombre;
  $('#mr-nombre').textContent = ent.nombre;
  $('#bloque-barra').style.width = pct;
  $('#mr-barra').style.width = pct;
  marcarRango(null);
  if (p.completo) {
    $('#bloque-resta').textContent = formatoTiempo(sesion.tiempoMeta);
    $('#bloque-meta').textContent = `¡Meta cumplida! ${p.meta} ${unidad}`;
    $('#bloque-siguiente').textContent = '';
    $('#bloque-indicador').textContent = 'Puedes seguir remando o terminar la sesión';
    $('#mr-resta').textContent = formatoTiempo(sesion.tiempoMeta);
    $('#mr-resta-etq').textContent = 'meta cumplida';
    $('#mr-meta-texto').textContent = `¡Meta cumplida! ${p.meta} ${unidad}`;
    return;
  }
  $('#bloque-resta').textContent = `Faltan ${Math.ceil(p.falta)}`;
  $('#bloque-meta').textContent = `${Math.floor(p.hecho)} de ${p.meta} ${unidad} · ${Math.floor(100 * p.fraccion)}%`;
  $('#bloque-siguiente').textContent = p.estimadoSeg != null ? `≈ ${formatoTiempo(p.estimadoSeg)} para terminar` : '';
  $('#mr-resta').textContent = Math.ceil(p.falta);
  $('#mr-resta-etq').textContent = `${unidad} faltan`;
  $('#mr-meta-texto').textContent = `${Math.floor(p.hecho)} de ${p.meta} ${unidad}${p.estimadoSeg != null ? ` · ≈ ${formatoTiempo(p.estimadoSeg)}` : ''}`;
}

const textoSiguiente = (b, f) => `${b.nombre || 'intervalo'} · ${Ent.finDe(b) === 'tiempo' ? '' : `${Ent.textoCantidad(b)} · `}${Ent.textoMeta(b, f, fcMaxima())}`;

function pintarBloque(t) {
  const f = ftp();
  const info = sesion.info;
  const puntos = sesion.muestras.map((x) => [x.t, x.w]);
  dibujarPerfil($('#grafica-perfil'), sesion.bloques, puntos, t);
  if (!$('#modo-remo').hidden && !vistaGrafica()) dibujarPerfil($('#mr-perfil'), sesion.bloques, puntos, t);
  if (!info) return;
  if (info.terminado) {
    const pctRango = sesion.segConMeta ? `En rango ${Math.round((100 * sesion.segEnRango) / sesion.segConMeta)}% del tiempo` : '';
    const extra = `+${formatoTiempo(t - (sesion.tiempoMeta ?? t))}`;
    $('#bloque-nombre').textContent = '¡Entrenamiento completado!';
    $('#bloque-resta').textContent = extra;
    $('#bloque-meta').textContent = pctRango;
    $('#bloque-siguiente').textContent = '';
    $('#bloque-barra').style.width = '100%';
    $('#mr-nombre').textContent = '¡Completado!';
    $('#mr-meta-texto').textContent = pctRango;
    $('#mr-resta').textContent = extra;
    $('#mr-resta-etq').textContent = 'extra';
    $('#mr-barra').style.width = '100%';
    marcarRango(null);
    return;
  }
  const { i, bloque: b, siguiente } = info;
  const nombre = `${i + 1}/${sesion.plan.length} · ${b.nombre || 'Intervalo'}`;
  const resta = Ent.textoResta(info);
  const meta = b.metrica ? Ent.textoMeta(b, f, fcMaxima()) : 'Libre';
  $('#bloque-nombre').textContent = nombre;
  $('#bloque-resta').textContent = resta;
  $('#bloque-meta').textContent = b.metrica ? `Meta: ${meta}` : 'Libre';
  $('#bloque-siguiente').textContent = siguiente ? `Sigue: ${textoSiguiente(siguiente, f)}` : 'Último intervalo';
  $('#bloque-barra').style.width = `${100 * info.fraccion}%`;
  $('#mr-nombre').textContent = nombre;
  $('#mr-meta-texto').textContent = meta;
  $('#mr-resta').textContent = resta;
  $('#mr-resta-etq').textContent = siguiente ? `luego ${Ent.textoMeta(siguiente, f, fcMaxima())}` : 'último';
  $('#mr-barra').style.width = `${100 * info.fraccion}%`;
  marcarRango(Ent.enRango(b, actual.watts, actual.spm, f, actual.split, actual.fc), !!Ent.rangoWatts(b, f));
}

function dibujarVivo() {
  const metas = [];
  const info = sesion?.info;
  if (info && !info.terminado) {
    const r = Ent.bloquesEnWatts([info.bloque], ftp())[0];
    if (r.metrica === 'watts') metas.push({ desde: tVivo - (sesion.t - info.desde), hasta: tVivo + info.restaSeg, min: r.min, max: r.max || r.min, eje: 'izq' });
  }
  dibujar($('#grafica-vivo'), [
    { nombre: 'Watts', color: color('--watts'), eje: 'izq', puntos: vivo.watts },
    { nombre: 'Golpes/min', color: color('--spm'), eje: 'der', puntos: vivo.spm },
  ], { ventana: 300, metas });
}

// Muestra la meta del entrenamiento elegido antes de iniciar la sesión.
// Solo pinta la última llamada: si se elige otra cosa mientras se lee un entrenamiento, gana lo último elegido.
let vistaTurno = 0;
async function vistaPrevia() {
  if (sesion) return;
  const turno = ++vistaTurno;
  const ent = await obtenerEnt($('#sel-entrenamiento').value);
  if (sesion || turno !== vistaTurno) return;
  entrenamientoPrevio = ent;
  actualizarBotones();
  pintarHoy(ent);
  pintarSelVentaja();
  prepararPronto();
  // Antes de empezar, lo elegido se muestra en la tarjeta «Hoy».
  $('#bloque-actual').hidden = true;
  // El perfil se ve en «Ver detalles» antes de empezar, y en vivo durante la sesión.
  $('#perfil-vivo').hidden = true;
  if (!ent) return;
  marcarRango(null);
  $('#bloque-barra').style.width = '0%';
  $('#bloque-nombre').textContent = ent.nombre;
  if (Ent.tipoDe(ent) === 'objetivo') {
    const unidad = Ent.METRICAS_OBJETIVO[ent.objetivo.metrica].unidad;
    $('#bloque-resta').textContent = `Faltan ${ent.objetivo.valor}`;
    $('#bloque-meta').textContent = `Meta: ${ent.objetivo.valor} ${unidad}`;
  } else {
    const b = ent.bloques[0];
    $('#bloque-resta').textContent = `${Ent.soloTiempo(ent) ? '' : '≈ '}${formatoTiempo(Ent.duracionTotal(ent))}`;
    $('#bloque-meta').textContent = `${ent.bloques.length} intervalos · empieza: ${b.nombre || 'intervalo'} ${Ent.textoMeta(b, ftp(), fcMaxima())}`;
    if (ent.bloques.some((x) => x.metrica === 'ftp') && !ftp()) {
      $('#bloque-siguiente').textContent = 'Tus watts aparecen tras tu primera sesión de 10 min';
      $('#bloque-indicador').textContent = '';
      return;
    }
  }
  $('#bloque-siguiente').textContent = '';
  $('#bloque-indicador').textContent = remadora.conectada ? 'Pulsa Empezar' : 'Pulsa Conectar y empezar';
}
$('#sel-entrenamiento').addEventListener('change', () => { ajustes.escribir('ultimoEnt', $('#sel-entrenamiento').value); vistaPrevia(); });

// Dos modos: Remo libre (sin entrenamiento) o Por objetivo (eliges un entrenamiento de tus planes).
function modoEnt() { return $('#sel-entrenamiento').value ? 'objetivo' : ajustes.leer('modoEnt', 'libre'); }
function pintarModoEnt() {
  const modo = modoEnt();
  for (const b of $('#modo-ent').querySelectorAll('button')) {
    b.setAttribute('aria-checked', String(b.dataset.modo === modo));
    b.disabled = !!sesion;
  }
  $('#campo-ent').hidden = modo !== 'objetivo';
}
$('#modo-ent').addEventListener('click', (e) => {
  const b = e.target.closest('[data-modo]');
  if (!b || sesion) return;
  const sel = $('#sel-entrenamiento');
  ajustes.escribir('modoEnt', b.dataset.modo);
  if (b.dataset.modo === 'libre') {
    if (sel.value) ajustes.escribir('ultimoEntObjetivo', sel.value);
    sel.value = '';
  } else if (!sel.value) {
    sel.value = ajustes.leer('ultimoEntObjetivo', '');
    if (!sel.value) sel.value = '';
  }
  ajustes.escribir('ultimoEnt', sel.value);
  vistaPrevia();
  actualizarBotones();
});

// ---------- Modo remo ----------
$('#btn-modo-remo').addEventListener('click', abrirModoRemo);
$('#mr-salir').addEventListener('click', cerrarModoRemo);

function abrirModoRemo() {
  $('#modo-remo').hidden = false;
  const intervalos = !!sesion?.bloques || (!sesion && !!entrenamientoPrevio && Ent.tipoDe(entrenamientoPrevio) === 'intervalos');
  $('#mr-perfil').hidden = !intervalos;
  if (!sesion) {
    $('#mr-nombre').textContent = ($('#sel-entrenamiento').value && $('#sel-entrenamiento').selectedOptions[0]?.textContent) || 'Remo libre';
    $('#mr-meta-texto').textContent = 'Pulsa Empezar fuera de este modo';
    $('#mr-resta').textContent = '';
    $('#mr-resta-etq').textContent = '';
  }
  aplicarVistaRemo();
  actualizarBotones();
  const vistas = ajustes.num('ayudaGestos', 0);
  if (vistas < 3) { ajustes.escribir('ayudaGestos', vistas + 1); toast('Doble toque: pausa · Desliza: cambia la vista'); }
  // Pantalla completa sobre todo el documento: así el aviso de fin, los mensajes y el confeti siguen viéndose encima.
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {}); } catch { /* opcional */ }
  pintar();
}

// Gestos en el modo remo: doble toque pausa o sigue; deslizar a un lado cambia de vista.
let gestoHecho = 0;
{
  const mr = $('#modo-remo');
  let inicio = null;
  let ultimoToque = 0;
  mr.addEventListener('pointerdown', (e) => { inicio = e.target.closest('button, select, input') ? null : { x: e.clientX, y: e.clientY, t: Date.now() }; });
  mr.addEventListener('pointerup', (e) => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    const rapido = Date.now() - inicio.t < 600;
    inicio = null;
    if (rapido && Math.abs(dx) > 60 && Math.abs(dy) < 60) {
      gestoHecho = Date.now();
      ajustes.escribir('vistaRemo', siguienteVista());
      selVistaRemo.value = ajustes.leer('vistaRemo', 'numeros');
      aplicarVistaRemo();
      requestAnimationFrame(pintar);
      return;
    }
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12 || !sesion) return;
    // En la carrera un toque cambia 2D/3D: ahí el doble toque no pausa.
    if (e.target.id === 'mr-grafica' && vistaRemo() === 'carrera') return;
    const ahora = Date.now();
    if (ahora - ultimoToque < 350) {
      ultimoToque = 0;
      gestoHecho = ahora;
      $('#mr-pausa').click();
      vibrar(60);
    } else ultimoToque = ahora;
  });
}

function cerrarModoRemo() {
  $('#modo-remo').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
// Si el usuario sale de pantalla completa con el gesto de atrás, también sale del modo remo.
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && !$('#modo-remo').hidden) $('#modo-remo').hidden = true;
});

// ---------- Editor de entrenamientos ----------
// ---------- Planes: entrenamientos base (según tu nivel) y los tuyos ----------
let baseActual = [];
// Recalcula los base para tu nivel y tu FTP de ahora.
async function actualizarBase() {
  const { h } = await estadoHeroe();
  baseActual = B.entrenamientosBase(h.nivel, ftp());
  return h;
}
// Entrenamiento por el valor del selector: «base:…» se genera, un número se lee de la base de datos.
async function obtenerEnt(valor) {
  if (!valor) return null;
  if (B.esBase(valor)) {
    if (!baseActual.length) await actualizarBase();
    return baseActual.find((x) => x.id === valor) || null;
  }
  return (await db.obtener('entrenamientos', Number(valor))) || null;
}
// Tus entrenamientos guardados, sin las copias de las pruebas (las pruebas ya están entre los base).
const propios = (lista) => lista.filter((x) => !B.NOMBRES_PRUEBA.has(x.nombre));

const SECCIONES_ENT = [...P.GRUPOS_ENT.map((g) => ({ clave: g.clave, nombre: g.clave === 'distancia' ? 'Distancia' : g.clave === 'tecnica' ? 'Paladas' : g.nombre })), { clave: 'mios', nombre: 'Míos' }];

function usarEnt(ent) {
  $('#sel-entrenamiento').value = String(ent.id);
  ajustes.escribir('ultimoEnt', String(ent.id));
  ajustes.escribir('modoEnt', 'objetivo');
  irA('entrenar');
  vistaPrevia();
  toast(`${ent.nombre} listo para entrenar`);
}
// Copia editable de un entrenamiento base.
function copiarBase(ent) {
  const copia = structuredClone(ent);
  for (const k of ['id', 'base', 'escalon', 'resumen', 'proposito', 'dificultad', 'prueba', 'pruebaFtp']) delete copia[k];
  copia.nombre = `${ent.nombre} (mío)`;
  abrirEditor(copia);
}

let verDelPlan = false;
async function pintarEntrenamientos() {
  pintarPrograma();
  const pestana = ajustes.leer('pestanaPlanes', 'entrenamientos');
  document.querySelectorAll('[data-pt]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pt === pestana)));
  $('#pt-entrenamientos').hidden = pestana !== 'entrenamientos';
  $('#pt-programa').hidden = pestana !== 'programa';
  const h = await actualizarBase();
  const lista = propios(await db.listar('entrenamientos'));
  const sesiones = await db.listar('sesiones');
  const o = opcConsejos(h, sesiones);
  // «Quiero subir…»: con un atributo elegido, los entrenamientos se ordenan por lo que lo suben.
  const subir = ajustes.leer('subirAtr', '');
  $('#subir-atr').innerHTML = [['', 'Todo'], ...J.ATRIBUTOS.map((a) => [a.clave, a.nombre])]
    .map(([k, n]) => `<button type="button" class="chip" data-subir="${k}" aria-pressed="${k === subir}">${n}${k && k === o.debil ? ' <span class="punto-bajo" title="Tu atributo más bajo">•</span>' : ''}</button>`).join('');
  for (const id of ['#secciones-ent', '#base-nivel', '#base-tarjetas', '.mios-cabecera', '#lista-ent']) document.querySelector(id).hidden = !!subir;
  $('#subir-lista').hidden = !subir;
  if (subir) { pintarSubir(subir, h, o, lista); await llenarSelectorEntrenamientos(); return; }
  const seccion = ajustes.leer('seccionEnt', 'potencia');
  $('#secciones-ent').innerHTML = SECCIONES_ENT.map((x) => `<button type="button" class="chip" data-sec="${x.clave}" aria-pressed="${x.clave === seccion}">${x.nombre}</button>`).join('');
  // Tarjetas base de la sección
  const bases = baseActual.filter((x) => x.enfoque === seccion);
  $('#base-nivel').hidden = seccion === 'mios' || seccion === 'pruebas';
  $('#base-nivel').textContent = avanzado()
    ? `Ajustados a tu nivel ${h.nivel} (${B.TEXTO_ESCALON[B.escalonDe(h.nivel)]}): crecen cuando subes de rango.`
    : 'Hechos a tu nivel: crecen cuando subes de rango.';
  $('#base-tarjetas').innerHTML = bases.map((x) => `<article class="base-tarjeta ${x.dificultad || 'prueba'}" data-ver="${x.id}">
      ${x.dificultad ? `<span class="dif">${B.nombreDificultad(x.dificultad)}</span>` : ''}<button type="button" class="base-nombre" data-ver="${x.id}" aria-label="Ver detalles de ${escaparHtml(x.nombre)}">${escaparHtml(x.nombre)}<span aria-hidden="true">›</span></button>
      <p class="base-resumen">${B.resumenEnt(x)}</p><p class="base-para">${x.proposito}</p>
      ${chipsAtr(previsionDe(x, o)?.seguro || {}, o.debil, 3)}
      <div class="base-acciones"><button type="button" class="boton primario" data-usar="${x.id}">Entrenar</button>
      <button type="button" class="boton chico enlace-boton" data-copiar="${x.id}">Copiar y editar</button></div></article>`).join('');
  // Tus entrenamientos: los de la sección, o todos en «Míos»
  const mios = seccion === 'mios' ? lista : lista.filter((x) => P.enfoqueDe(x) === seccion);
  $('#mios-titulo').textContent = seccion === 'mios' ? 'Tus entrenamientos' : `Tus entrenamientos de ${SECCIONES_ENT.find((x) => x.clave === seccion).nombre.toLowerCase()}`;
  // Los del plan van al final y plegados: son muchos y ya se ven en la pestaña Plan.
  const prog = leerPrograma();
  const delPlan = mios.filter((x) => esDePlan(x, prog));
  const tuyos = mios.filter((x) => !esDePlan(x, prog));
  const ul = $('#lista-ent');
  const fila = (x) => `<li data-id="${x.id}"${esDePlan(x, prog) ? ` class="de-plan"${verDelPlan ? '' : ' hidden'}` : ''}>
      <div class="info clic" role="button" tabindex="0" data-ver="${x.id}" aria-label="Ver detalles de ${escaparHtml(x.nombre)}"><div class="titulo">${escaparHtml(x.nombre)}</div><div class="suave">${B.resumenEnt(x)}</div></div>
      <details class="menu-fila"><summary class="boton icono chico" aria-label="Opciones de ${escaparHtml(x.nombre)}">⋯</summary>
        <div class="menu-fila-caja"><button type="button" data-a="editar">${ico('i-editar')} Editar</button><button type="button" data-a="duplicar">${ico('i-copiar')} Duplicar</button>
        <button type="button" data-a="borrar" class="peligro">${ico('i-borrar')} Borrar</button></div></details></li>`;
  const vacio = `<li class="vacio">${seccion === 'mios' ? 'Aún no has creado entrenamientos.' : 'Aún no tienes entrenamientos propios aquí.'} Toca «+ Nuevo» o «Copiar y editar» en uno base.</li>`;
  ul.innerHTML = mios.length ? (tuyos.length ? tuyos.map(fila).join('') : vacio)
    + (delPlan.length ? `<li class="separador-plan"><button type="button" class="enlace-boton" id="btn-ver-del-plan" aria-expanded="${verDelPlan}">${verDelPlan ? 'Ocultar' : 'Ver'} los ${delPlan.length} de tu plan</button></li>${delPlan.map(fila).join('')}` : '')
    : vacio;
  await llenarSelectorEntrenamientos();
}

// Ranking de entrenamientos para un atributo (base y tuyos), con lo que suben y cómo sumar más.
function pintarSubir(clave, h, o, lista) {
  const a = J.ATRIBUTOS.find((x) => x.clave === clave);
  const ents = [...baseActual, ...lista.filter((x) => !esDePlan(x))];
  const mejores = C.mejoresPara(clave, ents, o).slice(0, 5);
  const valor = h.atributos[clave] || 0;
  const tit = J.tituloAtributo(clave, valor);
  const intro = `<p class="ayuda">Tu ${a.nombre} va en <b>${miles(valor)}</b>${clave === o.debil ? ': es tu atributo más bajo' : ''}.${tit.siguiente ? ` Con ${miles(tit.siguiente.faltan)} más serás <b>${tit.siguiente.nombre}</b>.` : ''}</p>`;
  const nota = clave === 'recuperacion'
    ? `<p class="aviso suave-aviso">Recuperación no sube apretando: rema suave (media por debajo de ${Math.round(o.ftp * 0.75)} W), descansa el día después de uno duro${h.contexto?.sinPulso ? ' o usa banda de pulso para que cuenten tus descansos' : ''}.</p>` : '';
  const tarjeta = (x, i) => {
    const { ent, p } = x;
    const extra = x.si || p.extras.find((e) => e.atributo === clave);
    return `<article class="base-tarjeta subir-tarjeta ${ent.dificultad || 'prueba'}" data-ver="${ent.id}">
      ${i === 0 && !x.si ? `<span class="dif mejor">El mejor para ${a.nombre}</span>` : ''}
      <div class="subir-fila"><button type="button" class="base-nombre" data-ver="${ent.id}" aria-label="Ver detalles de ${escaparHtml(ent.nombre)}">${escaparHtml(ent.nombre)}</button>
        <span class="subir-pts"><b>+${p.seguro[clave] || x.si.puntos}</b><small>${x.si ? 'si lo logras' : a.nombre}</small></span></div>
      <p class="base-resumen">${B.resumenEnt(ent)}</p>
      ${chipsAtr(p.seguro, clave, 4)}
      ${extra ? `<p class="subir-extra">${ico(extra.icono)}<span>${escaparHtml(extra.titulo)}: <b>${C.textoPuntos(extra)}</b></span></p>` : ''}
      <div class="base-acciones"><button type="button" class="boton primario" data-usar="${ent.id}">Entrenar</button></div></article>`;
  };
  $('#subir-lista').innerHTML = intro + nota + (mejores.length
    ? `<div class="base-tarjetas">${mejores.map(tarjeta).join('')}</div>`
    : `<p class="vacio">Ningún entrenamiento sube ${a.nombre} por sí solo. ${J.comoSubir(clave, o.ftp).join(' ')}</p>`);
}
$('#subir-atr').addEventListener('click', (e) => {
  const b = e.target.closest('[data-subir]');
  if (!b) return;
  ajustes.escribir('subirAtr', b.dataset.subir);
  pintarEntrenamientos();
});

document.querySelector('.planes-pestanas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pt]');
  if (!b) return;
  ajustes.escribir('pestanaPlanes', b.dataset.pt);
  $('#editor-ent').hidden = true;
  pintarEntrenamientos();
});
$('#secciones-ent').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sec]');
  if (!b) return;
  ajustes.escribir('seccionEnt', b.dataset.sec);
  pintarEntrenamientos();
});
$('#pt-entrenamientos').addEventListener('click', async (e) => {
  const usar = e.target.closest('[data-usar]');
  const copiar = e.target.closest('[data-copiar]');
  const accion = e.target.closest('[data-a]');
  if (copiar) { copiarBase(baseActual.find((x) => x.id === copiar.dataset.copiar)); return; }
  if (accion) {
    const id = Number(accion.closest('li').dataset.id);
    const ent = await db.obtener('entrenamientos', id);
    accion.closest('details').open = false;
    if (accion.dataset.a === 'editar') abrirEditor(ent);
    if (accion.dataset.a === 'duplicar') {
      const copia = structuredClone(ent);
      delete copia.id;
      copia.nombre = await nombreLibre(ent.nombre);
      delete copia.dePlan;
      await db.guardar('entrenamientos', copia);
      toast('Entrenamiento duplicado');
      pintarEntrenamientos();
    }
    if (accion.dataset.a === 'borrar' && confirm(`¿Borrar «${ent.nombre}»?`)) { await db.borrar('entrenamientos', id); toast('Entrenamiento borrado'); pintarEntrenamientos(); }
    return;
  }
  if (usar) {
    const v = usar.dataset.usar;
    const ent = await obtenerEnt(v);
    if (ent) usarEnt(ent);
    return;
  }
  const ver = e.target.closest('[data-ver]');
  if (ver) {
    const ent = await obtenerEnt(ver.dataset.ver);
    if (ent) abrirDetalleEnt(ent);
  }
});
$('#lista-ent').addEventListener('click', (e) => {
  if (!e.target.closest('#btn-ver-del-plan')) return;
  verDelPlan = !verDelPlan;
  pintarEntrenamientos();
});
$('#lista-ent').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-ver]')) { e.preventDefault(); e.target.click(); } });
// Un solo menú «⋯» abierto a la vez.
$('#lista-ent').addEventListener('toggle', (e) => {
  if (e.target.open) $('#lista-ent').querySelectorAll('details[open]').forEach((d) => { if (d !== e.target) d.open = false; });
}, true);

async function llenarSelectorEntrenamientos(lista) {
  lista = propios(lista || (await db.listar('entrenamientos')));
  if (!baseActual.length) await actualizarBase();
  const sel = $('#sel-entrenamiento');
  const previo = sel.value || ajustes.leer('ultimoEnt', '');
  sel.length = 1;
  sel.querySelectorAll('optgroup').forEach((g) => g.remove());
  // Por sección: primero los base de tu nivel y luego los tuyos.
  for (const g of P.GRUPOS_ENT) {
    const bases = baseActual.filter((x) => x.enfoque === g.clave);
    const ents = lista.filter((ent) => P.enfoqueDe(ent) === g.clave);
    if (!bases.length && !ents.length) continue;
    const og = document.createElement('optgroup');
    og.label = g.nombre;
    for (const x of bases) og.append(new Option(x.dificultad ? `${x.nombre} · ${B.nombreDificultad(x.dificultad)}` : x.nombre, x.id));
    for (const ent of ents) og.append(new Option(ent.nombre, ent.id));
    sel.append(og);
  }
  sel.value = previo;
  if (sel.value !== String(previo)) sel.value = '';
  // Al abrir la app (o al crear un plan), lo que toca hoy queda elegido: solo falta pulsar Empezar.
  if (elegirLoDeHoy && !sesion) {
    elegirLoDeHoy = false;
    const hoy = P.deHoy(leerPrograma());
    const opcion = hoy && [...sel.options].find((o) => o.textContent === hoy.ent);
    const hecho = hoy && (await db.listar('sesiones')).some((x) => E.claveDia(x.fecha) === hoy.fecha && x.entrenamiento === hoy.ent);
    if (opcion && !hecho) { sel.value = opcion.value; ajustes.escribir('ultimoEnt', sel.value); ajustes.escribir('modoEnt', 'objetivo'); }
  }
  vistaPrevia();
}
let elegirLoDeHoy = true;

$('#btn-nuevo-ent').addEventListener('click', () => abrirEditor({
  tipo: 'objetivo', nombre: '', objetivo: { metrica: 'distancia', valor: 2000 }, bloques: [],
}));
$('#btn-cancelar-ent').addEventListener('click', () => { form.hidden = true; });

let enEdicion = null;
const form = $('#editor-ent');

// El nombre identifica al entrenamiento en tus sesiones y récords: no se repite.
// «Remo (copia)» → «Remo (copia 2)», sin encadenar «(copia) (copia)».
async function nombreLibre(nombre) {
  const usados = new Set((await db.listar('entrenamientos')).map((e) => e.nombre));
  const base = nombre.replace(/ \((copia|mío)( \d+)?\)$/, '');
  for (let n = 1; ; n++) {
    const candidato = `${base} (copia${n > 1 ? ` ${n}` : ''})`;
    if (!usados.has(candidato)) return candidato;
  }
}

function abrirEditor(ent) {
  enEdicion = structuredClone(ent);
  enEdicion.tipo = Ent.tipoDe(enEdicion);
  enEdicion.bloques = enEdicion.bloques || [];
  enEdicion.objetivo = enEdicion.objetivo || { metrica: 'distancia', valor: 2000 };
  $('#editor-titulo').textContent = ent.id ? 'Editar entrenamiento' : 'Nuevo entrenamiento';
  form.nombre.value = enEdicion.nombre;
  form.tipo.value = enEdicion.tipo;
  form.obj_metrica.value = enEdicion.objetivo.metrica;
  form.obj_valor.value = enEdicion.objetivo.valor;
  $('#ent-error').textContent = '';
  form.hidden = false;
  mostrarTipo();
  pintarBloques();
  form.scrollIntoView({ behavior: 'smooth' });
}

function mostrarTipo() {
  enEdicion.tipo = form.tipo.value;
  $('#editor-objetivo').hidden = enEdicion.tipo !== 'objetivo';
  $('#editor-intervalos').hidden = enEdicion.tipo !== 'intervalos';
  if (enEdicion.tipo === 'intervalos' && !enEdicion.bloques.length) {
    enEdicion.bloques.push({ nombre: 'Calentamiento', duracion: 300, metrica: 'watts', min: 80, max: 120 });
    pintarBloques();
  }
  resumenEditor();
}
form.tipo.addEventListener('change', mostrarTipo);
form.obj_metrica.addEventListener('change', resumenEditor);
form.obj_valor.addEventListener('input', resumenEditor);

// Rangos razonables para lo que se escribe en un intervalo; fuera de ellos el valor no se acepta.
const LIMITES_META = { watts: [1, 2000], ftp: [1, 300], split: [60, 600], spm: [10, 60], fc: [40, 230], fcpct: [30, 110] };
const LIMITES_CANTIDAD = { tiempo: [5, 10800], distancia: [10, 100000], paladas: [1, 10000] };

function pintarBloques() {
  const cont = $('#bloques');
  cont.innerHTML = '';
  const bloques = enEdicion.bloques;
  bloques.forEach((b, i) => {
    const fila = document.createElement('div');
    fila.className = 'fila-bloque';
    fila.innerHTML = `
      <div class="nombre-bloque"><b>${i + 1}</b><input data-k="nombre" placeholder="Nombre del intervalo" aria-label="Nombre del intervalo ${i + 1}" maxlength="30"></div>
      <label><span class="mini">Termina por</span><select data-k="fin">
        <option value="tiempo">Tiempo</option><option value="distancia">Distancia</option><option value="paladas">Paladas</option>
      </select></label>
      <label><span class="mini etq-cantidad"></span><input data-k="cantidad" inputmode="numeric"></label>
      <label><span class="mini">Meta</span><select data-k="metrica">
        <option value="watts">Potencia (W)</option><option value="ftp">% de FTP</option><option value="split">Split (/500 m)</option><option value="spm">Golpes/min</option><option value="fc">Pulso (lpm)</option><option value="fcpct">% pulso máx</option><option value="">Libre</option>
      </select></label>
      <label><span class="mini">Rango <span class="unidad"></span></span><span class="par" style="margin:0"><input data-k="min" type="number" inputmode="numeric" placeholder="mín" aria-label="Mínimo"><input data-k="max" type="number" inputmode="numeric" placeholder="máx" aria-label="Máximo"></span></label>
      <label><span class="mini">Nivel (opcional)</span><input data-k="nivel" type="number" min="1" max="24" inputmode="numeric" placeholder="1–24"></label>
      <div class="zonas" hidden></div>
      <div class="controles">
        <button type="button" class="boton icono chico" data-a="subir" aria-label="Mover arriba" ${i === 0 ? 'disabled' : ''}>${ico('i-sube')}</button>
        <button type="button" class="boton icono chico" data-a="bajar" aria-label="Mover abajo" ${i === bloques.length - 1 ? 'disabled' : ''}>${ico('i-baja')}</button>
        <button type="button" class="boton icono chico" data-a="duplicar" aria-label="Duplicar intervalo">${ico('i-copiar')}</button>
        <button type="button" class="boton icono chico peligro" data-a="quitar" aria-label="Quitar intervalo">${ico('i-borrar')}</button>
      </div>`;
    const q = (k) => fila.querySelector(`[data-k=${k}]`);
    q('nombre').value = b.nombre || '';
    const fin = Ent.finDe(b);
    q('fin').value = fin;
    fila.querySelector('.etq-cantidad').textContent = { tiempo: 'Tiempo (mm:ss)', distancia: 'Metros', paladas: 'Paladas' }[fin];
    q('cantidad').value = fin === 'tiempo' ? Ent.formatoMmss(b.duracion) : (b.cantidad || '');
    q('metrica').value = b.metrica || '';
    const esSplit = b.metrica === 'split';
    for (const k of ['min', 'max']) {
      q(k).type = esSplit ? 'text' : 'number';
      q(k).placeholder = esSplit ? (k === 'min' ? '2:00' : '2:10') : (k === 'min' ? 'mín' : 'máx');
      q(k).value = b[k] ? (esSplit ? Ent.formatoMmss(b[k]) : b[k]) : '';
    }
    q('nivel').value = b.nivel || '';
    const unidadYZonas = () => {
      const m = b.metrica;
      fila.querySelector('.unidad').textContent = { watts: '(W)', ftp: '(% FTP)', split: '(mm:ss, rápido–lento)', spm: '(golpes/min)', fc: '(lpm)', fcpct: '(% pulso máx)' }[m] || '';
      q('min').disabled = !m;
      q('max').disabled = !m;
      const zonas = fila.querySelector('.zonas');
      zonas.hidden = m !== 'ftp';
      if (m === 'ftp') {
        const r = Ent.rangoWatts(b, ftp());
        zonas.innerHTML = Ent.ZONAS.map((z) => `<button type="button" data-z="${z.n}" title="${z.nombre}">Z${z.n}</button>`).join('')
          + `<span class="mini" style="align-self:center;margin-left:4px">${r ? `= ${r.min}–${r.max} W` : 'Define tu FTP en Ajustes'}</span>`;
        zonas.querySelectorAll('[data-z]').forEach((btn) => {
          btn.onclick = () => {
            const z = Ent.ZONAS[btn.dataset.z - 1];
            b.min = z.min; b.max = z.max;
            if (!b.nombre) b.nombre = `Zona ${z.n}`;
            pintarBloques();
          };
        });
      }
    };
    unidadYZonas();
    fila.addEventListener('change', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      const rechazar = (txt) => { $('#ent-error').textContent = `Intervalo ${i + 1}: ${txt}`; toast($('#ent-error').textContent, 4500); pintarBloques(); };
      if (k === 'cantidad') {
        const fin = Ent.finDe(b);
        const texto = e.target.value.trim();
        const v = fin === 'tiempo' ? (/^\d+(:\d{1,2})?$/.test(texto) ? Ent.deMmss(texto) : NaN) : Math.round(Number(texto));
        const [lo, hi] = LIMITES_CANTIDAD[fin];
        if (!(v >= lo && v <= hi)) {
          rechazar(fin === 'tiempo' ? `escribe el tiempo como mm:ss, de ${formatoTiempo(lo)} a ${formatoTiempo(hi)}.` : `escribe de ${miles(lo)} a ${miles(hi)} ${fin === 'distancia' ? 'metros' : 'paladas'}.`);
          return;
        }
        if (fin === 'tiempo') b.duracion = v; else b.cantidad = v;
      } else if (k === 'fin') {
        b.fin = e.target.value;
        if (b.fin === 'tiempo') { delete b.fin; delete b.cantidad; b.duracion = b.duracion || 60; } else {
          b.cantidad = b.fin === 'distancia' ? 500 : 50;
          b.duracion = 0;
        }
        pintarBloques();
        return;
      } else if (k === 'min' || k === 'max') {
        const texto = e.target.value.trim();
        const v = texto === '' ? 0 : b.metrica === 'split' ? (/^\d+:\d{1,2}$/.test(texto) ? Ent.deMmss(texto) : NaN) : Number(texto);
        const [lo, hi] = LIMITES_META[b.metrica] || [0, Infinity];
        if (v !== 0 && !(v >= lo && v <= hi)) {
          rechazar(b.metrica === 'split' ? `el split va de ${Ent.formatoMmss(lo)} a ${Ent.formatoMmss(hi)} (mm:ss).` : `el ${k === 'min' ? 'mínimo' : 'máximo'} va de ${lo} a ${hi}.`);
          return;
        }
        b[k] = Math.round(v);
      } else if (k === 'nivel') {
        const n = Math.round(Number(e.target.value));
        if (n >= 1 && n <= 24) b.nivel = n; else delete b.nivel;
      } else b[k] = e.target.value;
      if (k === 'metrica') {
        if (b.metrica === 'ftp' && (b.min > 200 || !b.min)) { b.min = 56; b.max = 75; }
        if (b.metrica === 'split') { b.min = 120; b.max = 130; }
        if (b.metrica === 'spm') { b.min = 22; b.max = 26; }
        if (b.metrica === 'fc') { b.min = 130; b.max = 150; }
        if (b.metrica === 'fcpct') { b.min = 60; b.max = 70; }
        pintarBloques();
        return;
      }
      if (k === 'min' || k === 'max') unidadYZonas();
      $('#ent-error').textContent = '';
      resumenEditor();
    });
    fila.querySelector('[data-a=subir]').onclick = () => { [bloques[i - 1], bloques[i]] = [bloques[i], bloques[i - 1]]; pintarBloques(); };
    fila.querySelector('[data-a=bajar]').onclick = () => { [bloques[i + 1], bloques[i]] = [bloques[i], bloques[i + 1]]; pintarBloques(); };
    fila.querySelector('[data-a=duplicar]').onclick = () => { bloques.splice(i + 1, 0, structuredClone(b)); pintarBloques(); };
    fila.querySelector('[data-a=quitar]').onclick = () => { bloques.splice(i, 1); pintarBloques(); };
    cont.append(fila);
  });
  resumenEditor();
}

function resumenEditor() {
  if (!enEdicion) return;
  if (form.tipo.value === 'intervalos') dibujarPerfil($('#grafica-editor'), paraPerfil(enEdicion.bloques));
  if (form.tipo.value === 'objetivo') {
    const m = Ent.METRICAS_OBJETIVO[form.obj_metrica.value];
    $('#ent-resumen').textContent = `La sesión termina al llegar a ${form.obj_valor.value || '?'} ${m.unidad}.`;
  } else {
    $('#ent-resumen').textContent = `${enEdicion.bloques.length} intervalos · duración total ${Ent.soloTiempo(enEdicion) ? '' : 'estimada ≈ '}${formatoTiempo(Ent.duracionTotal(enEdicion))}`;
  }
}

$('#btn-add-bloque').addEventListener('click', () => {
  const ultimo = enEdicion.bloques.at(-1);
  enEdicion.bloques.push({
    nombre: '', duracion: 60, metrica: ultimo?.metrica ?? 'watts', min: ultimo?.min || 120, max: ultimo?.max || 150,
  });
  pintarBloques();
});
$('#s-unidad').addEventListener('change', () => {
  const pct = $('#s-unidad').value === 'ftp';
  [['#s-wmin', 160, 91], ['#s-wmax', 190, 105], ['#s-dmin', '', 40], ['#s-dmax', '', 55]].forEach(([id, w, f]) => { $(id).value = pct ? f : w; });
});
$('#btn-add-serie').addEventListener('click', () => {
  const n = (id) => Number($(id).value) || 0;
  const reps = n('#s-reps');
  const trabajo = Ent.deMmss($('#s-trabajo').value);
  if (!reps || !trabajo) { $('#ent-error').textContent = 'Para la serie indica repeticiones y tiempo de trabajo.'; return; }
  $('#ent-error').textContent = '';
  const pct = $('#s-unidad').value === 'ftp';
  enEdicion.bloques.push(...Ent.serie({
    reps, trabajo, wMin: n('#s-wmin'), wMax: n('#s-wmax'),
    descanso: Ent.deMmss($('#s-descanso').value), dMin: n('#s-dmin'), dMax: n('#s-dmax'),
  }).map((b) => (pct && b.metrica ? { ...b, metrica: 'ftp' } : b)));
  $('#editor-intervalos details').open = false;
  pintarBloques();
});
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = (txt, foco) => { $('#ent-error').textContent = txt; foco?.focus(); };
  enEdicion.nombre = form.nombre.value.trim();
  if (!enEdicion.nombre) { error('Ponle un nombre al entrenamiento.', form.nombre); return; }
  const todos = await db.listar('entrenamientos');
  if (todos.some((e) => e.nombre === enEdicion.nombre && e.id !== enEdicion.id) || B.NOMBRES_PRUEBA.has(enEdicion.nombre)) {
    error('Ya tienes un entrenamiento con ese nombre: elige otro para no mezclar sus sesiones y récords.', form.nombre);
    return;
  }
  // Al renombrar, las sesiones y el plan pasan al nombre nuevo (si quieres) para no partir tu historial en dos.
  const anterior = enEdicion.id != null ? todos.find((e) => e.id === enEdicion.id)?.nombre : null;
  const renombrar = anterior && anterior !== enEdicion.nombre
    ? (await db.listar('sesiones')).filter((x) => x.entrenamiento === anterior) : [];
  enEdicion.tipo = form.tipo.value;
  if (enEdicion.tipo === 'objetivo') {
    const valor = Number(form.obj_valor.value);
    if (!(valor > 0)) { error('Indica la cantidad de la meta.', form.obj_valor); return; }
    enEdicion.objetivo = { metrica: form.obj_metrica.value, valor };
    delete enEdicion.bloques;
  } else {
    if (!enEdicion.bloques.length) { error('Agrega al menos un intervalo.'); return; }
    const malo = enEdicion.bloques.findIndex((b) => b.metrica && b.max && b.max < b.min);
    if (malo >= 0) { error(`En el intervalo ${malo + 1} el máximo es menor que el mínimo${enEdicion.bloques[malo].metrica === 'split' ? ' (en split, el mínimo es el ritmo más rápido)' : ''}.`); return; }
    const sinCantidad = enEdicion.bloques.findIndex((b) => !(Ent.cantidadDe(b) > 0));
    if (sinCantidad >= 0) { error(`Indica cuánto dura el intervalo ${sinCantidad + 1}.`); return; }
    delete enEdicion.objetivo;
  }
  $('#ent-error').textContent = '';
  if (renombrar.length && confirm(`Tienes ${renombrar.length} ${renombrar.length === 1 ? 'sesión' : 'sesiones'} de «${anterior}». ¿Pasarlas a «${enEdicion.nombre}» para que sigan juntas en tus récords y comparaciones?`)) {
    for (const x of renombrar) await db.guardar('sesiones', { ...x, entrenamiento: enEdicion.nombre });
  }
  const prog = anterior && leerPrograma();
  if (prog?.dias.some((d) => d.ent === anterior)) guardarPrograma({ ...prog, dias: prog.dias.map((d) => (d.ent === anterior ? { ...d, ent: enEdicion.nombre } : d)) });
  await db.guardar('entrenamientos', enEdicion);
  form.hidden = true;
  toast('Entrenamiento guardado');
  pintarEntrenamientos();
});

// ---------- Progreso ----------
let periodo = 'semana';
let cacheSesiones = [];

document.querySelectorAll('.segmentado button').forEach((b) => b.addEventListener('click', () => {
  periodo = b.dataset.periodo;
  document.querySelectorAll('.segmentado button').forEach((x) => {
    x.classList.toggle('activo', x === b);
    x.setAttribute('aria-pressed', x === b);
  });
  pintarPeriodos();
}));

function formatoRecord(r, v) {
  if (r.tipo === 'tiempo') return formatoTiempo(v);
  return r.unidad === 'm' ? `${(v / 1000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : `${miles(v)} ${r.unidad}`;
}
const fechaCorta = (ms) => new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

function pintarPeriodos() {
  const n = periodo === 'semana' ? 8 : 6;
  const datos = E.resumenPeriodos(cacheSesiones, periodo, n).map((p, i, arr) => ({
    etiqueta: periodo === 'semana' ? fechaCorta(p.inicio) : new Date(p.inicio).toLocaleDateString('es-MX', { month: 'short' }),
    valor: Math.round(p.metros / 100) / 10,
    resaltar: i === arr.length - 1,
  }));
  dibujarBarras($('#grafica-periodos'), datos, { color: color('--primario'), formato: (v) => `${v}` });
  $('#grafica-periodos').setAttribute('aria-label', `Kilómetros por ${periodo}: ${datos.map((d) => `${d.etiqueta} ${d.valor}`).join(', ')}`);
}

let tendencia = 'potencia';
document.querySelectorAll('#seg-tendencia button').forEach((b) => b.addEventListener('click', () => {
  tendencia = b.dataset.tend;
  document.querySelectorAll('#seg-tendencia button').forEach((x) => {
    x.classList.toggle('activo', x === b);
    x.setAttribute('aria-pressed', x === b);
  });
  pintarTendencia();
}));
$('#filtro-ent').addEventListener('change', () => pintarHistorial());

const filtroCoincide = (s) => {
  const f = $('#filtro-ent').value;
  return f === '*' || (s.entrenamiento || '') === f;
};

function pintarTendencia() {
  const orden = cacheSesiones.filter(filtroCoincide).slice(0, 30).reverse();
  const x = (i) => i * 60;
  let series = [];
  let ley = '';
  let texto = '';
  if (tendencia === 'potencia') {
    ley = '<span class="lw">Watts promedio</span><span class="lt">Split promedio (s/500 m)</span>';
    series = [
      { color: color('--watts'), eje: 'izq', puntos: orden.map((s, i) => [x(i), s.wattsProm]) },
      { color: color('--split'), eje: 'der', puntos: orden.map((s, i) => [x(i), s.splitProm]).filter(([, v]) => v > 0) },
    ];
  } else if (tendencia === 'eficiencia') {
    const con = orden.map((s, i) => [x(i), E.tecnica(s).wattsPorLatido]).filter(([, v]) => v);
    ley = '<span class="lfc">Watts por latido</span><span class="lw">Pulso promedio</span>';
    series = [
      { color: color('--fc'), eje: 'izq', puntos: con },
      { color: color('--watts'), eje: 'der', puntos: orden.map((s, i) => [x(i), s.fcProm]).filter(([, v]) => v) },
    ];
    texto = con.length ? 'Si los watts por latido suben, produces más potencia con el mismo esfuerzo del corazón: tu condición mejora.'
      : 'Conecta tu banda o reloj de pulso para ver esta tendencia.';
  } else {
    ley = '<span class="lmpp">Metros por palada</span><span class="ljp">Trabajo por palada (J)</span>';
    series = [
      { color: color('--exito'), eje: 'izq', puntos: orden.map((s, i) => [x(i), E.tecnica(s).metrosPorPalada]).filter(([, v]) => v) },
      { color: color('--split'), eje: 'der', puntos: orden.map((s, i) => [x(i), E.tecnica(s).joulesPorPalada]).filter(([, v]) => v) },
    ];
    texto = 'Más metros y más trabajo por palada con los mismos golpes por minuto indica paladas más eficientes.';
  }
  $('#leyenda-tendencia').innerHTML = ley;
  $('#tendencia-texto').textContent = texto;
  dibujar($('#grafica-tendencia'), series, { sinEjeX: true, marcas: true, decimales: tendencia !== 'potencia' });
}

function pintarForma() {
  const datos = E.forma(cacheSesiones, ftp(), 60);
  const hay = datos.some((d) => d.carga > 0);
  const fx = (t) => {
    const d = datos[Math.round(t)];
    return d ? new Date(`${d.dia}T12:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
  };
  dibujar($('#grafica-forma'), [
    { color: color('--cond'), eje: 'izq', puntos: datos.map((d, i) => [i, d.condicion]) },
    { color: color('--fat'), eje: 'izq', puntos: datos.map((d, i) => [i, d.fatiga]) },
    { color: color('--fres'), eje: 'izq', puntos: datos.map((d, i) => [i, Math.max(0, d.frescura)]) },
  ], { formatoX: fx });
  const hoy = datos.at(-1);
  if (!ftp()) $('#forma-texto').textContent = 'Define tu FTP en Ajustes para calcular la carga de cada sesión.';
  else if (!hay) $('#forma-texto').textContent = 'Aún no hay sesiones en los últimos 60 días.';
  else {
    let consejo = 'Vas equilibrado: cualquier entrenamiento del plan te queda bien.';
    if (hoy.frescura < -20) consejo = 'Vienes cansado: hoy toca algo suave o descansar.';
    else if (hoy.frescura > 10) consejo = 'Estás fresco: buen día para una prueba o una sesión fuerte.';
    $('#forma-texto').textContent = avanzado() ? `Condición ${hoy.condicion}, fatiga ${hoy.fatiga}, frescura ${hoy.frescura}. ${consejo}` : consejo;
  }
  const estado = () => (hoy.frescura < -20 ? 'Cansado' : hoy.frescura > 10 ? 'Fresco' : 'Equilibrado');
  $('#forma-resumen').textContent = !(ftp() && hay) ? '' : avanzado() ? `Frescura ${hoy.frescura > 0 ? '+' : ''}${hoy.frescura}` : estado();
}

function pintarAvisoRespaldo(total) {
  const ultimo = Number(ajustes.leer('ultimoRespaldo', 0));
  const dias = ultimo ? Math.floor((Date.now() - ultimo) / 864e5) : null;
  const av = $('#aviso-respaldo');
  av.hidden = !(total >= 3 && (dias == null || dias >= 7));
  if (!av.hidden) {
    av.innerHTML = `${dias == null ? 'Aún no guardas un respaldo de tus sesiones.' : `Tu último respaldo fue hace ${dias} días.`}
      <div class="fila-botones"><button class="boton primario" id="btn-respaldo-aviso">Guardar respaldo ahora</button></div>`;
    $('#btn-respaldo-aviso').onclick = guardarRespaldo;
  }
}

let sesionesVisibles = 50;
// Tarjeta del héroe en Progreso: nivel, XP de esta semana y de las 8 anteriores.
function pintarHeroeProgreso(lista) {
  const caja = $('#progreso-heroe');
  const per = leerPersonaje();
  const clase = J.claseDe(per.clase);
  caja.hidden = !clase || !lista.length;
  if (caja.hidden) return;
  const h = J.estadoJuego(lista, { ftp: ftp(), per });
  const lunes = new Date(`${J.lunesDe(Date.now())}T00:00`).getTime();
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const desde = lunes - (7 - i) * 7 * 864e5;
    let xp = 0;
    for (const [f, p] of h.porSesion) if (f >= desde && f < desde + 7 * 864e5) xp += p.xp + p.xpExtra;
    return { desde, xp };
  });
  const max = Math.max(1, ...semanas.map((x) => x.xp));
  const [pasada, esta] = semanas.slice(-2);
  caja.innerHTML = `<img src="${srcHeroe(clase.clave, h.nivel, true)}" width="44" height="44" alt="">
    <span class="ph-texto"><b>Nivel ${h.nivel} · ${h.titulo}</b><small>+${miles(esta.xp)} XP esta semana · la pasada +${miles(pasada.xp)}</small></span>
    <span class="ph-barras" role="img" aria-label="XP por semana, últimas 8 semanas">${semanas.map((x, i) => `<i class="${i === 7 ? 'actual' : ''}" style="height:${Math.max(4, (100 * x.xp) / max)}%" title="${fechaCorta(x.desde)}: ${miles(x.xp)} XP"></i>`).join('')}</span>
    <span aria-hidden="true">›</span>`;
}
$('#progreso-heroe').addEventListener('click', () => irA('heroe'));

async function pintarHistorial() {
  const lista = (await db.listar('sesiones')).sort((a, b) => b.fecha - a.fecha);
  cacheSesiones = lista;
  $('#progreso-vacio').hidden = lista.length > 0;
  $('#progreso-contenido').hidden = !lista.length;

  // Racha por semanas (una sesión por semana basta); si además llevas varios días seguidos, se menciona.
  const semanas = E.rachaSemanas(lista);
  const dias = E.racha(lista);
  $('#racha').textContent = semanas;
  $('#racha-etq').textContent = semanas === 1 ? 'semana seguida' : 'semanas seguidas';
  $('#racha-dias').textContent = dias >= 2 ? `y ${dias} días seguidos` : '';
  $('#racha-dias').hidden = dias < 2;
  const semana = E.resumenPeriodos(lista, 'semana', 1)[0];
  const meta = ajustes.num('metaSemana', 10);
  const km = semana.metros / 1000;
  $('#semana-texto').textContent = `${km.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} de ${miles(meta)} km${km >= meta ? ' ✓' : ''} · ${semana.sesiones} ${semana.sesiones === 1 ? 'sesión' : 'sesiones'}`;
  $('#semana-barra').style.width = `${Math.min(100, (100 * km) / meta)}%`;
  pintarAvisoRespaldo(lista.length);
  pintarHeroeProgreso(lista);
  pintarPeriodos();
  pintarForma();

  // Filtro por entrenamiento
  const sel = $('#filtro-ent');
  const previo = sel.value;
  const nombres = [...new Set(lista.map((s) => s.entrenamiento || ''))];
  sel.length = 1;
  for (const n of nombres) sel.add(new Option(n || 'Remo libre', n));
  sel.value = nombres.includes(previo) ? previo : '*';
  pintarTendencia();

  const ins = E.insignias(lista);
  $('#insignias-resumen').textContent = `${ins.filter((x) => x.ganada).length} de ${ins.length}`;
  $('#insignias').innerHTML = ins.map((x) => `<div class="insignia${x.ganada ? '' : ' bloqueada'}" title="${x.detalle}"><span class="medalla">${ico('i-trofeo')}</span>
    <b>${x.nombre}</b><small>${x.ganada ? fechaCorta(x.fecha) : x.detalle}</small></div>`).join('');

  const recs = E.calcularRecords(lista);
  $('#records').innerHTML = E.RECORDS.filter((r) => recs[r.clave]).map((r) => `<div class="record"><div class="etq">${r.nombre}</div>
    <div class="valor">${formatoRecord(r, recs[r.clave].valor)}</div><div class="sub">${fechaCorta(recs[r.clave].fecha)}</div></div>`).join('');

  const visibles = lista.filter(filtroCoincide);
  const ul = $('#lista-sesiones');
  ul.innerHTML = '';
  const totalM = visibles.reduce((a, s) => a + s.distancia, 0);
  const totalT = visibles.reduce((a, s) => a + s.duracion, 0);
  $('#resumen-historial').textContent = visibles.length
    ? `${visibles.length} ${visibles.length === 1 ? 'sesión' : 'sesiones'} · ${(totalM / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km · ${horasYMin(totalT)} en total`
    : '';
  if (!visibles.length) ul.innerHTML = '<li class="vacio">Todavía no hay sesiones. Tu primera sesión aparecerá aquí.</li>';
  // Con cientos de sesiones se pintan de 50 en 50 para que Progreso abra rápido.
  for (const s of visibles.slice(0, sesionesVisibles)) {
    const li = document.createElement('li');
    li.className = 'clic';
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    const f = new Date(s.fecha);
    li.innerHTML = `<div class="info"><div class="titulo"></div><div class="suave"></div></div>${ico('i-baja')}`;
    li.querySelector('.ico').style.transform = 'rotate(-90deg)';
    li.querySelector('.titulo').textContent = `${f.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · ${s.entrenamiento || 'Remo libre'}`;
    if (s.rpe) li.querySelector('.titulo').insertAdjacentHTML('beforeend', `<span class="rpe-chip">Esfuerzo ${s.rpe}</span>`);
    li.querySelector('.suave').textContent = `${formatoTiempo(s.duracion)} · ${miles(s.distancia)} m · ${s.wattsProm} W · ${formatoSplit(s.splitProm)} /500 m${s.tiempoMeta != null ? ` · meta en ${formatoTiempo(s.tiempoMeta)}` : ''}${s.notas ? ` · “${s.notas.slice(0, 40)}${s.notas.length > 40 ? '…' : ''}”` : ''}`;
    li.addEventListener('click', () => abrirSesion(s, { previas: lista.filter((x) => x.id !== s.id && x.fecha < s.fecha) }));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') li.click(); });
    ul.append(li);
  }
  const quedan = visibles.length - sesionesVisibles;
  if (quedan > 0) {
    const li = document.createElement('li');
    li.className = 'separador-plan';
    li.innerHTML = `<button type="button" class="boton">Ver ${Math.min(50, quedan)} más (quedan ${miles(quedan)})</button>`;
    li.querySelector('button').addEventListener('click', () => { sesionesVisibles += 50; pintarHistorial(); });
    ul.append(li);
  }
}

// ---------- Héroe ----------
function leerPersonaje() {
  try { return JSON.parse(ajustes.leer('personaje', 'null')) || {}; } catch { return {}; }
}
// La ropa dejó de venderse: se retira y se devuelven las monedas gastadas. El bote de la carrera se queda.
{
  const per = leerPersonaje();
  if (per.clase && !per.tiendaVentajas) {
    const bote = per.equipo?.bote;
    ajustes.escribir('personaje', JSON.stringify({ ...per, compras: [], gastado: 0, inventario: {}, equipo: bote ? { bote } : {}, tiendaVentajas: true }));
  }
}
function inventario() { return leerPersonaje().inventario || {}; }
function guardarPersonaje(cambios) {
  ajustes.escribir('personaje', JSON.stringify({ ...leerPersonaje(), ...cambios }));
}
// Paisaje de la carrera: el fiordo es gratis; los demás se compran en la tienda.
usarPaisaje(paisajeElegido(leerPersonaje()));
const emblema = (c) => `<svg viewBox="0 0 24 24" aria-hidden="true">${c.icono}</svg>`;
// Ilustración del personaje según su clase y el rango de su nivel (assets/heroes, generados por tools/build-app-assets.py).
const srcHeroe = (clave, nivel, retrato = false) => `assets/heroes/${clave}_${J.rangoDe(nivel).id}${retrato ? '_retrato' : ''}.webp`;
function figuraHeroe(per, nivel, ancho) {
  const c = J.claseDe(per.clase);
  const alto = Math.round((ancho * 420) / 360);
  return `<div class="heroe-figura" style="width:${ancho}px;height:${alto}px"><svg class="aura" viewBox="0 0 200 200" aria-hidden="true">${O.auraHeroe(per)}</svg>
    <img src="${srcHeroe(c.clave, nivel)}" width="${ancho}" height="${alto}" alt="${c.nombre} ${J.rangoDe(nivel).nombre}"></div>`;
}
// Gráfico de radar de los 6 atributos (SVG, se adapta al tema con currentColor y variables).
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
$('#vista-heroe').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-preparar]');
  if (!b) return;
  await prepararEntrenamiento(b.dataset.preparar, b.dataset.reto ? J.DIFICULTAD_RETO[b.dataset.reto] : null);
});
// Deja listo en Entrenar un entrenamiento base (o Remo libre contra fantasmas con '') sin agregar copias a tu lista.
// dificultad: la de los rivales (null deja la que tenías).
async function prepararEntrenamiento(baseId, dificultad = null) {
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
const nombreAtributo = (k) => J.ATRIBUTOS.find((a) => a.clave === k)?.nombre || k;
const miles = (n) => Math.round(n).toLocaleString('es-MX');
// Opciones de los consejos de atributos con tu FTP, tu clase, tu contexto de hoy y tu atributo más bajo.
function opcConsejos(h, sesiones = []) {
  return { ftp: ftp() || estimarFtp(sesiones) || 150, clase: leerPersonaje().clase || null, ctx: h.contexto || {}, debil: J.atributoDeLaSemana(h.atributos, { sinPulso: h.contexto?.sinPulso ?? true }) };
}
// Previsión de un entrenamiento, guardada mientras no cambien tu FTP, tu clase ni tu contexto.
const cachePrevision = new Map();
function previsionDe(ent, o) {
  const clave = JSON.stringify([ent.id ?? null, ent.nombre, ent.bloques?.length, ent.objetivo, o.ftp, o.clase, o.ctx, o.debil, !!o.libre]);
  if (!cachePrevision.has(clave)) {
    if (cachePrevision.size > 80) cachePrevision.clear();
    cachePrevision.set(clave, C.prevision(ent, o));
  }
  return cachePrevision.get(clave);
}
// Chips de atributos: el destacado primero y en color.
const chipsAtr = (gan, destacar = null, max = 4) => `<div class="chips-ganancia">${Object.entries(gan)
  .sort((a, b) => (b[0] === destacar) - (a[0] === destacar) || b[1] - a[1]).slice(0, max)
  .map(([k, v]) => `<span${k === destacar ? ' class="top"' : ''}>${nombreAtributo(k)} +${miles(v)}</span>`).join('')}</div>`;
// Una condición con sus puntos: «Mantén el rango… +6 Técnica».
const filaCond = (x, clase = '') => `<li class="cond ${clase}">${ico(x.icono || 'i-aviso')}<div><b>${escaparHtml(x.titulo)}</b>${x.detalle ? `<small>${escaparHtml(x.detalle)}</small>` : ''}</div><span class="cond-pts">${C.textoPuntos(x)}</span></li>`;
// Duraciones largas (totales): «174 h 55 min» en vez de «174:55:00».
const horasYMin = (seg) => { const h = Math.floor(seg / 3600); const m = Math.round((seg % 3600) / 60); return h ? `${miles(h)} h ${m} min` : `${m} min`; };
const icoMoneda = '<svg class="moneda" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>';
let claseElegida = null;
let seccionHeroe = 'ficha';

// Línea de nivel en Entrenar y punto en la pestaña Héroe cuando hay talentos por repartir.
async function pintarLineaNivel() {
  const { per, h } = await estadoHeroe();
  const clase = J.claseDe(per.clase);
  const libres = clase ? h.talentosLibres : 0;
  $('#tab-heroe').dataset.aviso = libres > 0 ? String(libres) : '';
  const linea = $('#linea-nivel');
  const ses = h.hasta ? enSesiones(h.hasta - h.xp, h) : '';
  linea.innerHTML = clase
    ? `<img src="${srcHeroe(clase.clave, h.nivel, true)}" width="32" height="32" alt=""><span><b>Nivel ${h.nivel}</b>${h.hasta ? ` · faltan ${miles(h.hasta - h.xp)} XP${ses ? ` (${ses})` : ''}` : ''}${libres ? `<small class="nuevo">${libres} ${libres === 1 ? 'punto' : 'puntos'} de talento por repartir</small>` : ''}</span><span aria-hidden="true">›</span>`
    : `<span><b>Crea tu héroe</b> para subir de nivel con cada sesión</span><span aria-hidden="true">›</span>`;
  linea.dataset.talentos = libres > 0 ? '1' : '';
  linea.hidden = !!sesion;
}
$('#linea-nivel').addEventListener('click', () => {
  if ($('#linea-nivel').dataset.talentos) seccionHeroe = 'talentos';
  irA('heroe');
});

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

async function estadoHeroe() {
  const per = leerPersonaje();
  return { per, h: J.estadoJuego(await db.listar('sesiones'), { ftp: ftp(), per }) };
}

async function pintarHeroe() {
  pintarLineaNivel();
  const per = leerPersonaje();
  const clase = J.claseDe(per.clase);
  $('#heroe-crear').hidden = !!clase;
  $('#heroe-ficha').hidden = !clase;
  if (!clase) {
    $('#clases').innerHTML = J.CLASES.map((c) => `<button type="button" class="clase" role="radio" aria-checked="${c.clave === claseElegida}" data-clase="${c.clave}">
      <img class="clase-retrato" src="${srcHeroe(c.clave, 1, true)}" width="84" height="84" alt=""><b>${c.nombre}</b><span class="fav">+15 % ${nombreAtributo(c.favorito)}</span><small>${c.lema} ${c.para}</small></button>`).join('');
    $('#btn-crear-heroe').disabled = !claseElegida;
    if (per.nombre && !$('#heroe-nombre').value) $('#heroe-nombre').value = per.nombre;
    return;
  }
  const sesiones = await db.listar('sesiones');
  const h = J.estadoJuego(sesiones, { ftp: ftp(), per });
  $('#heroe-avatar').innerHTML = `<img src="${srcHeroe(clase.clave, h.nivel, true)}" width="84" height="84" alt="${clase.nombre} ${h.titulo}"><span class="emblema mini">${emblema(clase)}</span>`;
  $('#heroe-titulo').textContent = per.nombre || `${clase.nombre} sin nombre`;
  $('#heroe-clase').textContent = `${clase.nombre} · Rango ${h.titulo}`;
  pintarClasificacion(sesiones);
  $('#heroe-monedas').innerHTML = `${icoMoneda}${miles(h.monedas)}`;
  $('#heroe-nivel').textContent = h.nivel;
  const pct = h.hasta ? (100 * (h.xp - h.desde)) / (h.hasta - h.desde) : 100;
  $('#heroe-xp-barra').style.width = `${pct}%`;
  const ses = h.hasta ? enSesiones(h.hasta - h.xp, h) : '';
  $('#heroe-xp-texto').textContent = h.hasta ? `${miles(h.xp)} XP · faltan ${miles(h.hasta - h.xp)} para el nivel ${h.nivel + 1}${ses ? ` (${ses})` : ''}` : `${miles(h.xp)} XP · nivel máximo`;
  pintarAvisosHeroe(h, sesiones);
  for (const b of document.querySelectorAll('.heroe-tabs button')) {
    b.classList.toggle('activa', b.dataset.hp === seccionHeroe);
    if (b.dataset.hp === 'talentos') b.dataset.aviso = h.talentosLibres > 0 ? h.talentosLibres : '';
  }
  for (const el of document.querySelectorAll('.hp')) el.hidden = el.id !== `hp-${seccionHeroe}`;
  ({ ficha: pintarFicha, talentos: pintarTalentos, niveles: pintarNiveles, misiones: pintarMisiones, tienda: pintarTienda })[seccionHeroe](h, per, clase, sesiones);
}

// Avisos arriba del héroe: el cambio a la mitad de XP (una vez) y los puntos de talento sin repartir.
function pintarAvisosHeroe(h, sesiones) {
  const avisos = [];
  const veterano = sesiones.some((x) => x.fecha < J.XP_LENTA_DESDE);
  if (Date.now() >= J.XP_LENTA_DESDE && veterano && !ajustes.si('avisoXpLenta', false)) {
    avisos.push(`<div class="aviso heroe-aviso"><span>Desde el 29 de octubre cada sesión, misión y logro da <b>la mitad de XP</b>. Tu nivel no cambia: solo cuesta más subir.</span><button type="button" class="boton chico" data-aviso-xp>Entendido</button></div>`);
  }
  if (h.talentosLibres > 0 && seccionHeroe !== 'talentos') {
    avisos.push(`<div class="aviso heroe-aviso"><span>Tienes <b>${h.talentosLibres} ${h.talentosLibres === 1 ? 'punto' : 'puntos'} de talento</b> sin usar. Dan más XP por sesión o ventaja en las carreras.</span><button type="button" class="boton chico primario" data-ir-talentos>Repartir</button></div>`);
  }
  $('#heroe-avisos').innerHTML = avisos.join('');
}
$('#heroe-avisos').addEventListener('click', (e) => {
  if (e.target.closest('[data-aviso-xp]')) { ajustes.escribir('avisoXpLenta', '1'); pintarHeroe(); }
  if (e.target.closest('[data-ir-talentos]')) { seccionHeroe = 'talentos'; pintarHeroe(); }
});

function pintarFicha(h, per, clase, sesiones) {
  $('#ficha-figura').innerHTML = figuraHeroe(per, h.nivel, 180);
  // Lo que te dan ahora los talentos aprendidos, en una línea cada uno.
  const arbol = per.arbol?.[clase.clave] || {};
  const tal = J.talentosDe(clase.clave).map((t) => ({ t, g: J.grado(arbol, clase.clave, t.slot) })).filter((x) => x.g > 0);
  $('#ficha-talentos').innerHTML = tal.length
    ? tal.map(({ t, g }) => `<li><b>${t.nombre}</b><span class="etq-tal ${t.tipo}">${t.tipo === 'xp' ? 'XP' : 'Carrera'}</span><span>${t.textoGrado(g)}</span></li>`).join('')
    : `<li class="vacio">Aún no tienes talentos. ${h.talentosLibres > 0 ? `Tienes ${h.talentosLibres} ${h.talentosLibres === 1 ? 'punto' : 'puntos'}: repártelos en la pestaña Talentos.` : 'Ganas 1 punto cada 3 niveles.'}</li>`;
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
    return `<details class="atributo"${rec?.atributo.clave === a.clave ? ' open' : ''}>
      <summary><span class="atr-nombre">${a.nombre}${a.clave === clase.favorito ? ' <span class="fav" title="Favorito de tu clase: crece un 15 % más">★ +15 %</span>' : ''}</span>
        <span class="atr-valor"><b>${miles(h.atributos[a.clave])}</b><small class="${sube ? 'sube' : ''}">${sube ? `+${miles(sube)} esta semana` : 'sin cambios esta semana'}</small></span>
        <span class="atr-barra" aria-hidden="true"><i style="width:${(100 * h.atributos[a.clave]) / maximo}%"></i></span>
        <span class="atr-titulo">${tituloCorto(a.clave, h.atributos[a.clave])}</span></summary>
      <ul>${J.comoSubir(a.clave, f).map((t) => `<li>${t}</li>`).join('')}</ul>${nota}
      <button type="button" class="boton chico${rec?.atributo.clave === a.clave ? ' primario' : ''}" data-preparar="${r.base || ''}" data-reto="${r.reto}">Entrenar ${a.nombre.toLowerCase()}: ${escaparHtml(r.entrenamiento || 'Remo libre suave')}</button>
    </details>`;
  }).join('');
  pintarSemanaHeroe(h, sesiones, f);
  $('#heroe-recomienda').innerHTML = rec ? `<p>Tu atributo más bajo es <b>${rec.atributo.nombre}</b>${semana[rec.atributo.clave] ? ` (+${miles(semana[rec.atributo.clave])} esta semana)` : ''}. ${rec.texto}</p>
    <div class="fila-botones"><button type="button" class="boton primario" data-preparar="${rec.base || ''}" data-reto="${rec.reto}">
    Preparar: ${escaparHtml(rec.entrenamiento || 'Remo libre')} en ${J.DIFICULTADES[J.DIFICULTAD_RETO[rec.reto]].nombre}</button></div>`
    : '<p class="suave">Rema tu primera sesión y te diré qué te conviene trabajar.</p>';
  // Los premios de capítulos y logros son insignias.
  const premios = [...J.CAPITULOS.map((c) => [c.objeto, c.nombre]), ...J.HAZANAS.filter((x) => x.objeto).map((x) => [x.objeto, x.nombre])];
  $('#ficha-insignias').innerHTML = premios.map(([id, de]) => `<div class="insignia${h.insignias.has(id) ? '' : ' bloqueada'}"><span class="medalla">${ico('i-trofeo')}</span>
    <b>${O.objeto(id).nombre}</b><small>${de}</small></div>`).join('');
  const ult = [...sesiones].sort((a, b) => b.fecha - a.fecha).slice(0, 5);
  $('#heroe-sesiones').innerHTML = ult.length ? ult.map((x) => {
    const g = h.porSesion.get(x.fecha);
    return `<li><div><b>${fechaCorta(x.fecha)} · ${escaparHtml(x.entrenamiento || 'Remo libre')}</b> <span class="xp">+${miles(g.xp + g.xpExtra)} XP</span> <span class="monedas">${icoMoneda}${g.monedas}</span></div>
      <div class="chips-ganancia">${Object.entries(g.ganancias).map(([k, v]) => `<span>${nombreAtributo(k)} +${v}</span>`).join('')}</div></li>`;
  }).join('') : '<li class="vacio">Tu primera sesión le dará experiencia a tu héroe.</li>';
}

// «Aprendiz de la fuerza · 12 para Iniciado».
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
  const bases = baseActual.length ? baseActual : B.entrenamientosBase(h.nivel, ftp());
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
  caja.innerHTML = `${meta}<p class="etq-campo">Semana sugerida para equilibrarte</p><ul class="semana-sugerida">${filas}</ul>
    ${cercano ? `<p class="titulo-cerca">${ico('i-trofeo')}<span>${cercano.a.nombre} ${miles(h.atributos[cercano.a.clave] || 0)} → título <b>«${cercano.t.siguiente.nombre}»</b>. Te faltan ${miles(cercano.t.siguiente.faltan)}.</span></p>` : ''}`;
}

function pintarTalentos(h, per, clase) {
  const arbol = per.arbol?.[clase.clave] || {};
  const est = { nivel: h.nivel, libres: h.talentosLibres };
  const antiguo = J.tieneArbolAntiguo(arbol) && J.puntosGastados(arbol) === 0;
  $('#talentos-libres').textContent = `${h.talentosLibres > 0
    ? `Tienes ${h.talentosLibres} ${h.talentosLibres === 1 ? 'punto' : 'puntos'} de talento.`
    : 'Sin puntos libres.'} Ganas 1 punto cada 3 niveles.${antiguo ? ' Los talentos cambiaron: te devolvimos todos tus puntos para que los repartas de nuevo.' : ''}`;
  const fila = (t) => {
    const g = J.grado(arbol, clase.clave, t.slot);
    const motivo = J.motivoBloqueo(t.slot, est, arbol, clase.clave);
    const pips = Array.from({ length: t.max }, (_, i) => `<i class="${i < g ? 'lleno' : ''}"></i>`).join('');
    const accion = motivo
      ? `<span class="${g >= t.max ? 'ok-texto' : 'suave'}">${motivo}</span>`
      : `<button type="button" class="boton ${g ? '' : 'primario'}" data-aprender="${t.slot}">${g ? 'Subir de grado' : 'Aprender'} · ${t.coste} ${t.coste === 1 ? 'punto' : 'puntos'}</button>`;
    // Cuánto te daría el siguiente grado con lo que remas de verdad (solo los de XP).
    const xpEst = t.tipo === 'xp' && g < t.max ? J.xpTalentoEstimada(h, clase.clave, t.slot, g + 1) : null;
    const valor = xpEst == null ? '' : xpEst > 0
      ? `<p class="talento-valor">Con tus últimas sesiones: <b>≈ +${miles(xpEst)} XP por sesión</b>${g ? ' más' : ''}</p>`
      : '<p class="talento-valor nada">Con tus últimas sesiones no sumaría XP: no cumplen lo que pide.</p>';
    return `<div class="talento ${g ? 'aprendido' : motivo && g < t.max ? 'bloqueado' : 'disponible'}">
      <div class="talento-cab"><b>${t.nombre}</b><span class="etq-tal ${t.tipo}">${t.tipo === 'xp' ? 'XP' : 'Carrera'}</span><span class="pips" aria-label="Grado ${g} de ${t.max}">${pips}</span></div>
      <p>${t.texto}</p>${valor}<div class="talento-pie"><small class="suave">Desde el nivel ${t.nivel}${g && g < t.max ? ` · Ahora: ${t.textoGrado(g).replace(/\.$/, '')}` : ''}</small>${accion}</div></div>`;
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
      html += `<li class="${estado}"><b>Nv ${n}</b><span>${n === 1 ? 'Inicio' : `${miles(J.xpParaNivel(n))} XP`}</span>${extras.length ? `<em>${extras.join(' · ')}</em>` : ''}</li>`;
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
$('#niveles-carrusel').addEventListener('scroll', () => requestAnimationFrame(marcarNivel), { passive: true });
document.querySelector('#hp-niveles').addEventListener('click', (e) => {
  const car = $('#niveles-carrusel');
  const paso = e.target.closest('[data-niv]');
  const ir = e.target.closest('[data-rango]');
  const i = Math.round(car.scrollLeft / car.clientWidth);
  if (paso) car.scrollTo({ left: (i + Number(paso.dataset.niv)) * car.clientWidth, behavior: 'smooth' });
  if (ir) car.scrollTo({ left: Number(ir.dataset.rango) * car.clientWidth, behavior: 'smooth' });
});

const NOMBRE_PRUEBA = { 'base:prueba-500': 'Prueba 500 m', 'base:prueba-2000': 'Prueba 2000 m', 'base:prueba-ftp': 'Prueba FTP 20 min' };
function filaMision(m) {
  const pct = Math.min(100, (100 * m.valor) / m.meta);
  const valor = m.meta >= 100 ? miles(m.valor) : Math.round(m.valor * 10) / 10;
  // Las misiones del día y de la semana tienen un atajo a Entrenar con lo que piden.
  const atajo = m.preparar != null && !m.hecha ? `<button type="button" class="enlace-boton" data-preparar="${m.preparar}">Hacer ahora ›</button>` : '';
  return `<li class="${m.hecha ? 'hecha' : ''}"><div class="mision-fila"><span>${m.hecha ? ico('i-check') : ''}${m.nombre ? `<b>${m.nombre}</b> · ` : ''}${m.texto}</span>
    <span class="recompensa">${m.xp ? `<span class="xp">+${miles(m.xp)} XP</span>` : ''}${m.monedas ? `<span class="monedas">${icoMoneda}${m.monedas}</span>` : ''}</span></div>
    <div class="progreso"><div style="width:${pct}%"></div></div><div class="mision-pie"><small>${valor} de ${miles(m.meta)}${m.premio ? ` · premio: <b>${m.premio}</b>` : ''}</small>${atajo}</div></li>`;
}

function pintarMisiones(h) {
  $('#mis-diarias').innerHTML = h.diarias.map((m) => filaMision(m)).join('');
  $('#mis-semanales').innerHTML = h.semanales.map((m) => filaMision(m)).join('');
  const c = h.capitulo;
  $('#mis-capitulo').innerHTML = c ? `<div class="cap-cabecera"><span class="etq">Capítulo ${c.n} de ${J.CAPITULOS.length}</span><b>${c.nombre}</b><p>${c.historia}</p></div>
    <ul class="lista misiones">${c.progreso.map((r) => filaMision({ texto: r.texto, meta: r.meta, valor: r.valor, monedas: '', hecha: r.valor >= r.meta })).join('')}</ul>
    <div class="jefe ${c.listo ? 'listo' : ''}">${ico('i-fuego')}<div><b>Jefe: ${c.jefe.nombre}</b><small>${c.jefe.texto}${
      c.listo ? ' · ¡ya puedes enfrentarlo!' : ' · se desbloquea al cumplir lo de arriba'}</small></div>
      <span class="premio"><span class="xp">+${miles(c.xp)} XP</span> ${icoMoneda}${c.monedas + J.PREMIO_INSIGNIA} + insignia</span>
      ${c.listo ? `<button type="button" class="boton primario jefe-boton" data-preparar="${c.preparar}">Enfrentar: ${NOMBRE_PRUEBA[c.preparar]}</button>` : ''}</div>`
    : '<p class="aviso exito">¡Terminaste la historia! Eres una leyenda de los mares.</p>';
  // Logros: primero los que te faltan, del más cercano al más lejano; los hechos al final.
  const avance = (x) => (x.hecha ? -1 : x.valor / x.meta);
  $('#mis-hazanas').innerHTML = [...h.hazanas].sort((a, b) => avance(b) - avance(a)).map((x) => filaMision({ nombre: x.nombre, texto: x.texto, meta: x.meta, valor: x.valor, xp: x.xp, monedas: x.monedas + (x.objeto ? J.PREMIO_INSIGNIA : 0), premio: x.objeto ? `insignia ${O.objeto(x.objeto).nombre}` : '', hecha: x.hecha })).join('');
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
    <span class="monedas">${icoMoneda}${x.precio}</span>
    <button type="button" class="boton chico primario" data-comprar="${x.id}" ${h.monedas < x.precio ? 'disabled' : ''}>${h.monedas < x.precio ? 'Te faltan monedas' : 'Comprar'}</button></div>`).join('');
  const elegido = paisajeElegido(per);
  $('#tienda-paisajes').innerHTML = Object.entries(PAISAJES).map(([id, x]) => {
    const tiene = tienePaisaje(per, id);
    const boton = id === elegido ? '<span class="paisaje-uso">En uso</span>'
      : tiene ? `<button type="button" class="boton chico" data-paisaje="${id}">Usar</button>`
        : `<button type="button" class="boton chico primario" data-paisaje="${id}" ${h.monedas < x.precio ? 'disabled' : ''}>${h.monedas < x.precio ? `Te faltan ${miles(x.precio - h.monedas)}` : 'Comprar'}</button>`;
    return `<div class="objeto paisaje${id === elegido ? ' activo' : ''}"><img src="${x.miniatura}" alt="" loading="lazy" width="320" height="138"><b>${x.nombre}</b><small>${x.texto}</small>
      <span class="monedas">${x.precio ? (tiene ? 'Comprado' : `${icoMoneda}${x.precio}`) : 'Gratis'}</span>${boton}</div>`;
  }).join('');
  const tengo = V.OBJETOS_VENTAJA.filter((x) => inv[x.id] > 0);
  $('#inventario').innerHTML = tengo.length ? tengo.map((x) => `<li><div class="mision-fila"><span><b>${x.nombre}</b> · ${x.texto}</span><span class="recompensa"><span class="xp">×${inv[x.id]}</span></span></div></li>`).join('')
    : '<li class="vacio">Aún no tienes ventajas. Cómpralas aquí y elígelas en Entrenar antes de la carrera.</li>';
}

$('#clases').addEventListener('click', (e) => {
  const b = e.target.closest('[data-clase]');
  if (!b) return;
  claseElegida = b.dataset.clase;
  for (const x of document.querySelectorAll('#clases .clase')) x.setAttribute('aria-checked', String(x === b));
  $('#btn-crear-heroe').disabled = false;
});
$('#btn-crear-heroe').addEventListener('click', () => {
  if (!claseElegida) return;
  guardarPersonaje({ clase: claseElegida, nombre: $('#heroe-nombre').value.trim() });
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

// XP, monedas y logros que dio la sesión, en la hoja de resumen. Devuelve true si subiste de nivel o venciste a un jefe.
function pintarXpSesion(s, previas, resumen) {
  const caja = $('#hoja-xp');
  const per = leerPersonaje();
  const clase = J.claseDe(per.clase);
  const h = J.estadoJuego([...previas.filter((x) => x.fecha !== s.fecha), s], { ftp: ftp(), per });
  const g = h.porSesion.get(s.fecha);
  caja.hidden = !g;
  if (!g) return false;
  const logros = h.logros.filter((l) => l.fecha === s.fecha);
  const monedas = g.monedas + logros.reduce((a, l) => a + l.monedas, 0);
  const subio = resumen && g.nivelDespues > g.nivelAntes;
  const ascenso = subio && J.rangoDe(g.nivelDespues).id !== J.rangoDe(g.nivelAntes).id;
  const puntos = subio ? J.puntosDeNivel(g.nivelDespues) - J.puntosDeNivel(g.nivelAntes) : 0;
  const ses = h.hasta ? enSesiones(h.hasta - h.xp, h) : '';
  caja.innerHTML = `<span class="xp-total">+${miles(g.xp + g.xpExtra)} XP</span> <span class="monedas grande">${icoMoneda}+${miles(monedas)}</span>
    ${subio ? `<span class="subio">¡${clase ? clase.nombre : 'Tu héroe'} sube a nivel ${g.nivelDespues}!${ascenso ? ` Ahora es ${J.rangoDe(g.nivelDespues).nombre}.` : ''}</span>` : ''}
    ${puntos > 0 && clase ? `<span class="subio-talento">+${puntos} ${puntos === 1 ? 'punto' : 'puntos'} de talento <button type="button" class="boton chico primario" data-ir-talentos>Repartir</button></span>` : ''}
    <div class="progreso heroe-xp" role="progressbar" aria-label="Experiencia hacia el siguiente nivel"><div style="width:${h.hasta ? (100 * (h.xp - h.desde)) / (h.hasta - h.desde) : 100}%"></div></div>
    <small class="xp-nivel">Nivel ${h.nivel}${h.hasta ? ` · faltan ${miles(h.hasta - h.xp)} XP para el ${h.nivel + 1}${ses ? ` (${ses})` : ''}` : ''}</small>
    <details class="xp-desglose"${resumen ? '' : ' open'}><summary>Cómo la ganaste${logros.length ? ` · ${logros.length} ${logros.length === 1 ? 'logro' : 'logros'}` : ''}</summary>
    ${logros.map((l) => `<div class="logro ${l.tipo}">${ico(l.tipo === 'jefe' || l.tipo === 'hazana' ? 'i-trofeo' : 'i-check')}<span>${l.texto}${l.objeto ? ` · insignia <b>${O.objeto(l.objeto).nombre}</b>` : ''}</span><span class="recompensa">${l.xp ? `<span class="xp">+${miles(l.xp)} XP</span>` : ''}<span class="monedas">${icoMoneda}${l.monedas}</span></span></div>`).join('')}
    <div class="chips-ganancia">${Object.entries(g.ganancias).map(([k, v]) => `<span>${nombreAtributo(k)} +${v}</span>`).join('')}</div>
    <ul>${g.detalle.map(([t, v]) => `<li><span>${t}</span><span>+${miles(v)}</span></li>`).join('')}</ul>
    ${J.factorXp(s.fecha) < 1 ? '<p class="suave xp-mitad">Desde el 29 de octubre todo da la mitad de XP: estas cifras ya lo incluyen.</p>' : ''}</details>
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
let atrAbierta = null;
function pintarAtrSesion(s, previas, resumen) {
  const caja = $('#hoja-atr');
  atrAbierta = { s, previas, resumen };
  const per = leerPersonaje();
  const ant = previas.filter((x) => x.fecha < s.fecha && x.paladas > 0 && x.distancia > 0);
  const mpp = ant.length ? ant.reduce((a, x) => a + x.distancia / x.paladas, 0) / ant.length : 0;
  const f = ftp() || estimarFtp(previas) || 150;
  const r = C.analisis(s, { ftp: f, clase: per.clase || null, ctx: { mppPromedio: mpp } });
  let prox = '';
  if (resumen) {
    const h = J.estadoJuego([...previas.filter((x) => x.fecha !== s.fecha), s], { ftp: ftp(), per });
    const rec = J.recomendarPorAtributos(h.atributos, { sinPulso: h.contexto.sinPulso });
    const bases = baseActual.length ? baseActual : B.entrenamientosBase(h.nivel, ftp());
    const ent = rec && bases.find((x) => x.id === (rec.base || J.PREPARAR_ATRIBUTO[rec.atributo.clave]));
    const p = ent && previsionDe(ent, opcConsejos(h, previas));
    if (p) {
      prox = `<div class="proxima"><span class="etq">Para la próxima</span><p><b>${escaparHtml(ent.nombre)}</b> sube tu ${rec.atributo.nombre}, tu atributo más bajo.</p>
        ${chipsAtr(p.seguro, rec.atributo.clave, 3)}<button type="button" class="boton chico" data-prox="${ent.id}" data-reto="${rec.reto}">Dejarlo listo para la próxima</button></div>`;
    }
  }
  caja.hidden = !r.logros.length && !r.cerca.length && !prox;
  caja.innerHTML = `${r.logros.length ? `<h3>Lo que lograste</h3><ul class="lista-cond">${r.logros.map((x) => filaCond(x, 'hecho')).join('')}</ul>` : ''}
    ${r.cerca.length ? `<h3>Te quedaste cerca</h3><ul class="lista-cond">${r.cerca.map((x) => filaCond(x, 'cerca')).join('')}</ul>` : ''}${prox}`;
}
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

// Podio de la carrera contra fantasmas: puesto, tiempo (o diferencia) y XP de cada fantasma vencido.
async function pintarPodio(s) {
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
  const dato = (f) => (f.tiempo != null ? formatoTiempo(Math.round(f.tiempo)) : f.yo ? 'Tú' : `${f.dif > 0 ? '−' : '+'}${miles(Math.abs(f.dif))} m`);
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

// ---------- Resumen / detalle de sesión ----------
let sesionAbierta = null;
const TEXTO_RPE = ['', 'Muy fácil', 'Muy fácil', 'Fácil', 'Fácil', 'Moderado', 'Moderado', 'Duro', 'Duro', 'Muy duro', 'Máximo'];

async function guardarSesionAbierta() {
  if (sesionAbierta?.id != null) await db.guardar('sesiones', sesionAbierta);
}

// Pulso máximo para el esfuerzo: el tuyo, o 220 − edad, o 190 como aproximación.
const fcParaEsfuerzo = () => fcMaxima() || (ajustes.num('edad', 0) ? 220 - ajustes.num('edad', 0) : 190);
let corregirRpe = false;
function pintarRpe() {
  const s = sesionAbierta;
  const auto = s.rpeFuente === 'pulso' && !corregirRpe;
  $('#hoja-esfuerzo-titulo').textContent = s.rpeFuente === 'pulso' ? 'Esfuerzo según tu pulso' : '¿Qué tan duro se sintió?';
  $('#rpe').hidden = auto;
  $('#rpe-auto').hidden = !auto;
  if (auto) {
    $('#rpe-auto').innerHTML = `<b class="rpe-valor">${s.rpe}</b><span>de 10 · ${TEXTO_RPE[s.rpe]}<small>Pulso medio al ${s.rpePct} % de tu máximo${fcMaxima() ? '' : ' (aproximado: pon tu edad en Ajustes › Pulso y zonas)'}</small></span>
      <button type="button" class="boton chico" id="btn-corregir-rpe">Corregir</button>`;
    $('#btn-corregir-rpe').onclick = () => { corregirRpe = true; pintarRpe(); };
    $('#rpe-texto').textContent = '';
    return;
  }
  $('#rpe').innerHTML = Array.from({ length: 10 }, (_, i) => `<button type="button" class="boton${s.rpe === i + 1 ? ' activo' : ''}" data-rpe="${i + 1}" aria-pressed="${s.rpe === i + 1}">${i + 1}</button>`).join('');
  $('#rpe-texto').textContent = s.rpe ? `${s.rpe}: ${TEXTO_RPE[s.rpe]}` : '1 = muy fácil, 10 = esfuerzo máximo';
  $('#rpe').querySelectorAll('button').forEach((b) => {
    b.onclick = async () => {
      s.rpe = Number(b.dataset.rpe);
      if (s.rpeFuente === 'pulso') s.rpeFuente = 'tu';
      corregirRpe = false;
      pintarRpe();
      await guardarSesionAbierta();
      if (atrAbierta?.s === s) pintarAtrSesion(s, atrAbierta.previas, atrAbierta.resumen);
    };
  });
}
$('#in-notas').addEventListener('change', async () => {
  if (!sesionAbierta) return;
  sesionAbierta.notas = $('#in-notas').value.trim();
  await guardarSesionAbierta();
  toast('Nota guardada');
});

function tablaIntervalos(s) {
  const filas = E.resumenIntervalos(s);
  if (filas.length) {
    return `<h2>Por intervalo</h2><div class="desliza"><table class="tabla"><thead><tr><th>Intervalo</th><th>Tiempo</th><th>m</th><th>W</th><th>Split</th><th>g/min</th><th>Rango</th></tr></thead><tbody>${
      filas.map((f) => `<tr><td>${escaparHtml(f.nombre)}${f.bloque.metrica ? `<br><span class="sub ayuda" style="margin:0">${Ent.textoMeta(f.bloque)}</span>` : ''}</td><td>${formatoTiempo(f.segundos)}</td><td>${f.metros}</td><td>${f.w}</td><td>${formatoSplit(f.split)}</td><td>${f.spm}</td><td class="${f.pctRango == null ? '' : f.pctRango >= 70 ? 'ok' : f.pctRango < 40 ? 'mal' : ''}">${f.pctRango == null ? '-' : `${f.pctRango}%`}</td></tr>`).join('')
    }</tbody></table></div>`;
  }
  const par = E.parciales(s.muestras, 500);
  if (par.length < 2 || !avanzado()) return '';
  const mejor = Math.min(...par.map((p) => p.split));
  return `<h2>Parciales de 500 m</h2><div class="desliza"><table class="tabla"><thead><tr><th>Tramo</th><th>Tiempo</th><th>Split</th><th>W</th><th>g/min</th></tr></thead><tbody>${
    par.map((p) => `<tr><td>${p.metros - 500}–${p.metros} m</td><td>${formatoTiempo(p.tiempo)}</td><td class="${p.split === mejor ? 'ok' : ''}">${formatoSplit(p.split)}</td><td>${p.w}</td><td>${p.spm}</td></tr>`).join('')
  }</tbody></table></div>`;
}

// Predicción de otras distancias con la ley de Paul (+5 s de split cada vez que se duplica la distancia).
function tablaPrediccion(s) {
  const base = [2000, 5000, 1000, 500].map((d) => [d, E.mejorTiempo(s.muestras || [], d)]).find(([, t]) => t);
  const [metros, seg] = base || [];
  if (!metros) return '';
  if (!avanzado()) {
    const d = [5000, 2000, 10000].find((x) => x !== metros);
    return `<p class="prediccion-corta">A este ritmo, tus ${d >= 1000 ? `${d / 1000} km` : `${d} m`} rondarían <b>${formatoTiempo(Ent.predecir(metros, seg, d))}</b>.</p>`;
  }
  const filas = Ent.DISTANCIAS_PREDICCION.filter((d) => d !== metros).map((d) => {
    const t = Ent.predecir(metros, seg, d);
    return `<tr><td>${d === 21097 ? 'Medio maratón' : `${d} m`}</td><td>${formatoTiempo(t)}</td><td>${formatoSplit(Math.round((t * 500) / d))}</td></tr>`;
  }).join('');
  return `<div class="prediccion"><h2>Predicción con este esfuerzo</h2><p class="ayuda">A partir de ${miles(metros)} m en ${formatoTiempo(seg)}.</p>
    <table><thead><tr><th>Distancia</th><th>Tiempo</th><th>Split</th></tr></thead><tbody>${filas}</tbody></table></div>`;
}

function abrirSesion(s, { resumen = false, previas = [], ftpAuto = null } = {}) {
  sesionAbierta = s;
  const hoja = $('#hoja');
  hoja.hidden = false;
  hoja.querySelector('.hoja').scrollTop = 0;
  const f = new Date(s.fecha);
  $('#hoja-titulo').textContent = resumen ? '¡Sesión terminada!' : (s.entrenamiento || 'Remo libre');
  $('#hoja-sub').textContent = `${resumen && s.entrenamiento ? `${s.entrenamiento} · ` : ''}${f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}, ${f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;

  const recs = E.nuevosRecords(s, previas);
  $('#hoja-records').innerHTML = recs.map((r) => `<div class="record nuevo"><div class="etq">${ico('i-trofeo')}${resumen ? 'Nuevo récord' : 'Récord'}</div>
    <div class="valor">${formatoRecord(r, r.valor)}</div><div class="sub">${r.nombre}${r.anterior != null ? ` · antes ${formatoRecord(r, r.anterior)}` : ''}</div></div>`).join('');
  const antes = new Set(E.insignias(previas).filter((x) => x.ganada).map((x) => x.clave));
  const medallas = resumen ? E.insignias([...previas, s]).filter((x) => x.ganada && !antes.has(x.clave)) : [];
  $('#hoja-records').insertAdjacentHTML('beforeend', medallas.map((x) => `<div class="record nuevo"><div class="etq">${ico('i-trofeo')}Nueva insignia</div>
    <div class="valor">${x.nombre}</div><div class="sub">${x.detalle}</div></div>`).join(''));
  const gano = !s.carreraSinTerminar && (s.rivales || (s.rival ? [s.rival] : [])).some((r) => r.diferencia > 0);
  pintarPodio(s);
  const subio = pintarXpSesion(s, previas, resumen);
  pintarAtrSesion(s, previas, resumen);
  if (resumen && (recs.length || medallas.length || gano || subio)) setTimeout(confeti, 250);

  const hojaFtp = $('#hoja-ftp');
  const sugerido = !s.pruebaWatts ? E.ftpSugerido(s) : null;
  const subeFtp = sugerido && sugerido > ftp() + 2;
  hojaFtp.hidden = !s.pruebaWatts && !subeFtp && !ftpAuto;
  if (ftpAuto && !s.pruebaWatts) {
    hojaFtp.innerHTML = `${ftpAuto.antes ? `Tu FTP estimado sube a <b>${ftpAuto.nuevo} W</b> (antes ${ftpAuto.antes} W).` : `Calculé tu FTP con esta sesión: <b>${ftpAuto.nuevo} W</b>.`}
      Ahora tus entrenamientos te piden watts reales. Para afinarlo, haz la Prueba FTP 20 min cuando quieras.`;
  } else if (s.pruebaWatts || subeFtp) {
    const nuevo = s.pruebaWatts ? Ent.ftpDesdePrueba(s.pruebaWatts) : sugerido;
    const origen = s.pruebaWatts ? `Promedio en la prueba: <b>${s.pruebaWatts} W</b>.` : `Tus mejores 20 min de esta sesión dan más que tu FTP actual.`;
    hojaFtp.innerHTML = `${origen} Tu FTP estimado es <b>${nuevo} W</b>${ftp() ? ` (antes ${ftp()} W)` : ''}.
      <div class="fila-botones"><button class="boton primario" id="btn-usar-ftp">Usar ${nuevo} W como FTP</button></div>`;
    $('#btn-usar-ftp').onclick = () => {
      guardarFtp(nuevo, !s.pruebaWatts);
      toast(`FTP actualizado a ${nuevo} W`);
      $('#btn-usar-ftp').disabled = true;
    };
  }

  const tec = E.tecnica(s);
  const estres = s.estres ?? E.estres(s, s.ftp || ftp());
  const stats = [
    ['Duración', formatoTiempo(s.duracion)], ['Distancia', `${miles(s.distancia)} m`],
    ['Watts prom', s.wattsProm], ['Watts máx', s.wattsMax],
    ['Split prom', formatoSplit(s.splitProm)], ['Golpes/min', s.spmProm],
    ['Calorías', s.kcal], ['Paladas', s.paladas ?? '-'],
    ['Metros/palada', tec.metrosPorPalada ?? '-'],
  ];
  if (avanzado()) stats.push(['Trabajo/palada', tec.joulesPorPalada ? `${tec.joulesPorPalada} J` : '-']);
  stats.push(['Pulso prom', s.fcProm || '-']);
  if (s.fcMax) stats.push(['Pulso máx', s.fcMax]);
  if (tec.wattsPorLatido && avanzado()) stats.push(['Watts/latido', tec.wattsPorLatido]);
  if (estres != null && avanzado()) stats.push(['Carga', estres]);
  if (s.tiempoMeta != null) stats.push(['Meta en', formatoTiempo(s.tiempoMeta)]);
  if (s.pctEnRango != null) stats.push(['En rango', `${s.pctEnRango}%`]);
  for (const r of s.rivales || (s.rival ? [s.rival] : [])) {
    stats.push([s.rivales ? `Vs. ${r.nombre.replace(/^Fantasma /, '')}` : 'Vs. fantasma', `${r.diferencia > 0 ? '+' : ''}${r.diferencia} m${s.ventaja ? ' ⚑' : ''}`]);
  }
  for (const r of s.referencias || []) stats.push([`Vs. ${r.nombre.replace(/^Tu /, 'tu ')}`, `${r.diferencia > 0 ? '+' : ''}${r.diferencia} m`]);
  if (s.ventaja) {
    const obj = V.objetoVentaja(s.ventaja.objeto);
    stats.push(['Ventaja ⚑', `${miles(s.ventaja.metros)} m${obj ? ` · ${obj.nombre}` : ''}`]);
  }
  $('#hoja-stats').innerHTML = stats.map(([k, v]) => `<div class="metrica"><span class="etq">${escaparHtml(k)}</span><span class="valor">${v}</span></div>`).join('');

  corregirRpe = false;
  pintarRpe();
  $('#in-notas').value = s.notas || '';
  $('#hoja-intervalos').innerHTML = tablaIntervalos(s);
  $('#hoja-prediccion').innerHTML = tablaPrediccion(s);

  const cmp = E.compararConAnterior(s, previas);
  const fmt = (c, v) => (c.clave === 'splitProm' || c.clave === 'tiempoMeta' ? formatoTiempo(v) : `${v}${c.unidad && c.unidad !== 's' ? ` ${c.unidad}` : ''}`);
  const fmtDelta = (c) => {
    if (!c.delta) return '=';
    const signo = c.delta > 0 ? '+' : '−';
    const abs = Math.abs(c.delta);
    return `${signo}${c.clave === 'splitProm' || c.clave === 'tiempoMeta' ? `${abs} s` : `${abs}${c.unidad && c.unidad !== 's' ? ` ${c.unidad}` : ''}`}`;
  };
  $('#hoja-comparacion').innerHTML = cmp && cmp.filas.length ? `<h2>Contra la vez anterior (${fechaCorta(cmp.fecha)})</h2>
    <table class="tabla"><thead><tr><th></th><th>Antes</th><th>Ahora</th><th>Cambio</th></tr></thead><tbody>${
      cmp.filas.map((c) => `<tr><td>${c.nombre}</td><td>${fmt(c, c.antes)}</td><td>${fmt(c, c.ahora)}</td><td class="${c.mejoro === true ? 'mejor' : c.mejoro === false ? 'peor' : ''}">${
        c.mejoro === true ? '▲ ' : c.mejoro === false ? '▼ ' : ''}${fmtDelta(c)}</td></tr>`).join('')}</tbody></table>` : '';

  // Al terminar, el detalle (récords, métricas y gráficas) va plegado; desde el historial se abre ya desplegado.
  const det = $('#hoja-detalle');
  det.open = !resumen;
  $('#hoja-detalle-titulo').textContent = recs.length + medallas.length
    ? `Ver detalle · ${recs.length + medallas.length} ${recs.length + medallas.length === 1 ? 'novedad' : 'novedades'} y métricas`
    : 'Ver detalle y métricas';
  if (det.open) requestAnimationFrame(() => dibujarHojaGraficas(s));
  $('#hoja-cerrar').focus();
}
$('#hoja-detalle').addEventListener('toggle', () => {
  if ($('#hoja-detalle').open && sesionAbierta) requestAnimationFrame(() => dibujarHojaGraficas(sesionAbierta));
});
// Gráficas de la hoja: se dibujan cuando el detalle está abierto (un lienzo plegado no tiene tamaño).
function dibujarHojaGraficas(s) {
  const fcMax = ajustes.num('fcMax', 0);
  const conFc = s.muestras.some((x) => x.fc);
  $('#hoja-fc').hidden = !(conFc && fcMax);
  {
    const m = s.muestras;
    const series = [
      { color: color('--watts'), eje: 'izq', puntos: m.map((x) => [x.t, x.w]) },
      { color: color('--spm'), eje: 'der', puntos: m.map((x) => [x.t, x.spm]) },
    ];
    if (conFc) series.push({ color: color('--fc'), eje: 'izq', puntos: m.filter((x) => x.fc).map((x) => [x.t, x.fc]) });
    const f = s.ftp || ftp();
    const zonas = f ? Ent.ZONAS.map((z) => ({ min: (z.min * f) / 100, max: (z.max * f) / 100, color: COLOR_ZONA[z.n - 1], etiqueta: `Z${z.n}` })) : [];
    let acum = 0;
    const divisiones = (s.bloques || []).map((b) => { acum += b.duracion || 0; return { t: acum }; });
    dibujar($('#hoja-grafica'), series, { zonas, divisiones });
    $('#hoja-perfil').hidden = !s.bloques;
    if (s.bloques) dibujarPerfil($('#hoja-grafica-perfil'), Ent.bloquesEnWatts(s.bloques, s.ftp || ftp()), m.map((x) => [x.t, x.w]));
    if (conFc && fcMax) {
      const seg = E.tiempoEnZonasFc(m, fcMax);
      dibujarBarras($('#hoja-zonas-fc'), E.ZONAS_FC.map((z, i) => ({ etiqueta: `Z${z.n}`, valor: Math.round(seg[i] / 6) / 10, resaltar: seg[i] === Math.max(...seg) })), {
        color: color('--fc'), formato: (v) => `${v} min`,
      });
    }
  }
}

// ---------- Programa ----------
function leerPrograma() {
  try { return JSON.parse(ajustes.leer('programa', 'null')); } catch { return null; }
}
function guardarPrograma(p) {
  if (p) ajustes.escribir('programa', JSON.stringify(p));
  else { try { localStorage.removeItem('programa'); } catch { /* nada */ } }
}

// Guarda los entrenamientos de un plan nuevo: los del mismo nombre se actualizan (así un plan nuevo no usa
// los objetivos viejos) y los de un plan anterior que ya no se usan se borran para no llenar tu lista.
async function guardarEntrenamientosDePlan(entrenamientos) {
  const anterior = new Set((leerPrograma()?.dias || []).map((d) => d.ent));
  const nuevos = new Set(entrenamientos.map((x) => x.nombre));
  const todos = await db.listar('entrenamientos');
  for (const x of entrenamientos) {
    const previo = todos.find((e) => e.nombre === x.nombre);
    await db.guardar('entrenamientos', { ...x, dePlan: true, ...(previo ? { id: previo.id } : {}) });
  }
  for (const e of todos) {
    if (!nuevos.has(e.nombre) && (e.dePlan || anterior.has(e.nombre)) && !B.NOMBRES_PRUEBA.has(e.nombre)) await db.borrar('entrenamientos', e.id);
  }
}
const esDePlan = (e, prog = leerPrograma()) => !!e.dePlan || !!prog?.dias.some((d) => d.ent === e.nombre);

// Agrega los entrenamientos de ejemplo que el programa necesita y aún no existen.
async function asegurarEntrenamientos(nombres) {
  const existentes = new Set((await db.listar('entrenamientos')).map((e) => e.nombre));
  for (const n of new Set(nombres)) {
    const ej = Ent.EJEMPLOS.find((e) => e.nombre === n);
    if (ej && !existentes.has(n)) await db.guardar('entrenamientos', structuredClone(ej));
  }
}

async function pintarPrograma() {
  const prog = leerPrograma();
  $('#programa-vacio').hidden = !!prog;
  $('#programa-activo').hidden = !prog;
  if (!prog) {
    $('#plantillas-programa').innerHTML = P.PLANTILLAS.map((p, i) => `<div class="plantilla"><div class="info"><b>${p.nombre}</b><div class="suave">${p.descripcion}</div></div>
      <button type="button" class="boton primario chico" data-p="${i}">Empezar</button></div>`).join('');
    $('#plantillas-programa').querySelectorAll('[data-p]').forEach((b) => {
      b.onclick = async () => {
        const p = P.PLANTILLAS[b.dataset.p];
        await asegurarEntrenamientos(p.semanas.flat());
        guardarPrograma(P.desdePlantilla(p, E.claveDia(Date.now())));
        toast('Programa creado');
        pintarEntrenamientos();
      };
    });
    pintarAsistente();
    if (!$('#p-inicio').value) $('#p-inicio').value = E.claveDia(Date.now());
    const ents = await db.listar('entrenamientos');
    const nombresDia = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const previos = [...$('#p-dias').querySelectorAll('select')].map((x) => x.value);
    $('#p-dias').innerHTML = nombresDia.map((d, i) => `<label>${d}<select data-dia="${i}"><option value="">Descanso</option>${
      ents.map((e) => `<option>${escaparHtml(e.nombre)}</option>`).join('')}</select></label>`).join('');
    $('#p-dias').querySelectorAll('select').forEach((x, i) => { x.value = previos[i] || ''; });
    return;
  }
  const sesiones = await db.listar('sesiones');
  const estados = P.estadoDias(prog, sesiones);
  const c = P.cumplimiento(estados);
  $('#prog-nombre').textContent = prog.nombre;
  $('#prog-cumple').textContent = `${c.hechos} de ${c.total} sesiones`;
  $('#prog-barra').style.width = `${(100 * c.hechos) / (c.total || 1)}%`;
  const porFecha = new Map(estados.map((d) => [d.fecha, d]));
  const primero = new Date(`${estados[0].fecha}T12:00`);
  const ultimo = new Date(`${estados.at(-1).fecha}T12:00`);
  const d = new Date(primero.getTime() - ((primero.getDay() + 6) % 7) * 864e5);
  const fin = new Date(ultimo.getTime() + (6 - ((ultimo.getDay() + 6) % 7)) * 864e5);
  const celdas = [];
  for (; d <= fin; d.setDate(d.getDate() + 1)) {
    const k = E.claveDia(d.getTime());
    const dia = porFecha.get(k);
    const hoy = k === E.claveDia(Date.now());
    const clase = dia ? dia.estado : `libre${hoy ? ' hoy' : ''}`;
    const marca = dia?.estado === 'hecho' ? ico('i-check') : '';
    celdas.push(`<button type="button" class="${clase}" data-k="${k}" aria-label="${new Date(d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}${dia ? `: ${escaparHtml(dia.ent)}` : ''}">${d.getDate()}${marca}</button>`);
  }
  $('#calendario').innerHTML = celdas.join('');
  const describirDia = (k) => {
    const dia = porFecha.get(k);
    const fecha = new Date(`${k}T12:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
    const est = { hecho: 'hecho', perdido: 'no se hizo', hoy: 'toca hoy', pendiente: 'pendiente' };
    $('#prog-dia').textContent = dia ? `${fecha}: ${dia.ent} (${est[dia.estado]})` : `${fecha}: descanso`;
  };
  $('#calendario').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      $('#calendario').querySelectorAll('.elegido').forEach((x) => x.classList.remove('elegido'));
      b.classList.add('elegido');
      describirDia(b.dataset.k);
    };
  });
  const hoyK = E.claveDia(Date.now());
  describirDia(porFecha.has(hoyK) ? hoyK : (P.proximo(prog)?.fecha || hoyK));
}

// ---------- Asistente de plan por objetivo ----------
// Ritmo actual y distancia habitual, sacados de tu historial (o de tu FTP) para que no tengas que escribirlos.
async function contextoPlan() {
  const sesiones = await db.listar('sesiones');
  let split2k = null;
  for (const x of sesiones.slice(-30)) {
    const t = x.muestras?.length ? E.mejorTiempo(x.muestras, 2000) : null;
    if (t && (!split2k || t / 4 < split2k)) split2k = t / 4;
  }
  const w = ftp() || estimarFtp(sesiones);
  if (!split2k) split2k = w ? F.splitDeWatts(w * 1.05) : 135;
  const dists = sesiones.slice(-10).map((x) => x.distancia).filter((d) => d > 0).sort((a, b) => a - b);
  const recientes = sesiones.filter((x) => x.fecha > Date.now() - 30 * 864e5).length;
  return { split2k: Math.round(split2k), distHabitual: dists[Math.floor(dists.length / 2)] || 4000, nivelSugerido: recientes < 4 ? 'inicio' : recientes < 10 ? 'medio' : 'alto', sinHistorial: sesiones.length < 3 };
}
// El plan por tiempo meta es una opción más del asistente: cambia las preguntas 2 a 4 por distancia y tiempo.
const OBJETIVOS_ASISTENTE = [...P.OBJETIVOS_PLAN, { clave: 'meta', nombre: 'Un tiempo meta', texto: 'Remar una distancia en un tiempo, por ejemplo 2000 m en 7:45.' }];
async function pintarAsistente() {
  const ctx = await contextoPlan();
  asistente.nivel ??= ctx.nivelSugerido;
  const marcar = (v, x) => `aria-checked="${v === x}"`;
  const meta = asistente.objetivo === 'meta';
  document.querySelectorAll('#asistente .as-normal').forEach((x) => { x.hidden = meta; });
  $('#as-meta').hidden = !meta;
  if (meta) pintarPlanMeta();
  $('#as-objetivo').innerHTML = OBJETIVOS_ASISTENTE.map((o) => `<button type="button" role="radio" class="opcion" data-v="${o.clave}" ${marcar(asistente.objetivo, o.clave)}><b>${o.nombre}</b><small>${o.texto}</small></button>`).join('');
  $('#as-nivel').innerHTML = P.NIVELES_PLAN.map((n) => `<button type="button" role="radio" class="chip" data-v="${n.clave}" aria-pressed="${asistente.nivel === n.clave}">${n.nombre}</button>`).join('');
  $('#as-dias').innerHTML = [1, 2, 3, 4, 5].map((d) => `<button type="button" role="radio" class="chip" data-v="${d}" aria-pressed="${asistente.dias === d}">${d} ${d === 1 ? 'día' : 'días'}</button>`).join('');
  $('#as-semanas').innerHTML = [4, 6, 8, 12].map((d) => `<button type="button" role="radio" class="chip" data-v="${d}" aria-pressed="${asistente.semanas === d}">${d} semanas</button>`).join('');
  $('#btn-asistente').disabled = !asistente.objetivo;
  const res = $('#as-resumen');
  res.hidden = !asistente.objetivo || meta;
  if (!asistente.objetivo || meta) return;
  const { programa } = P.planPorObjetivo({ ...asistente, inicio: E.claveDia(Date.now()), ctx });
  const primera = programa.dias.slice(0, asistente.dias).map((d) => d.ent);
  const ultima = programa.dias.slice(-asistente.dias).map((d) => d.ent);
  const o = P.OBJETIVOS_PLAN.find((x) => x.clave === asistente.objetivo);
  res.innerHTML = `<b>Tu plan: ${programa.dias.length} sesiones</b>
    <p>Semana 1: ${primera.join(' · ')}</p><p>Última semana: ${ultima.join(' · ')}</p>
    <small>La carga sube cada semana y cada 4 semanas hay una más suave para recuperar.${o.prueba ? ` Harás la «${o.prueba}» para medir tu avance.` : ''} Las intensidades van según tu FTP${asistente.objetivo === 'ritmo' ? ` y tu ritmo actual (${Ent.formatoMmss(ctx.split2k)} /500 m)` : ''}${asistente.objetivo === 'distancia' ? ` y tu distancia habitual (${miles(ctx.distHabitual)} m)` : ''}.</small>`;
}
$('#asistente').addEventListener('click', (e) => {
  const b = e.target.closest('[data-v]');
  if (!b) return;
  const grupo = b.parentElement.id.replace('as-', '');
  asistente[grupo] = grupo === 'dias' || grupo === 'semanas' ? Number(b.dataset.v) : b.dataset.v;
  pintarAsistente();
});
$('#btn-asistente').addEventListener('click', async () => {
  if (!asistente.objetivo) return;
  if (asistente.objetivo === 'meta') { crearPlanMeta(); return; }
  const { programa, entrenamientos } = P.planPorObjetivo({ ...asistente, inicio: E.claveDia(Date.now()), ctx: await contextoPlan() });
  await guardarEntrenamientosDePlan(entrenamientos);
  guardarPrograma(programa);
  elegirLoDeHoy = true;
  confeti(1500);
  toast(`Plan creado: ${programa.dias.length} sesiones en ${asistente.semanas} semanas`);
  pintarEntrenamientos();
  llenarSelectorEntrenamientos();
  pintarHoy();
});

// Plan automático: sugiere la meta a partir de tu mejor marca y predicción en esa distancia.
async function pintarPlanMeta() {
  const dist = Number($('#pm-dist').value);
  if (!$('#pm-inicio').value) $('#pm-inicio').value = E.claveDia(Date.now());
  const sesiones = await db.listar('sesiones');
  let mejor = null;
  for (const s of sesiones) {
    for (const d of [dist, ...Ent.DISTANCIAS_PREDICCION]) {
      const t = s.muestras?.length ? E.mejorTiempo(s.muestras, d) : null;
      if (t) {
        const pred = d === dist ? t : Ent.predecir(d, t, dist);
        if (!mejor || pred < mejor.t) mejor = { t: pred, real: d === dist };
      }
    }
  }
  $('#pm-info').textContent = mejor
    ? `${mejor.real ? 'Tu mejor' : 'Tu predicción para'} ${miles(dist)} m: ${Ent.formatoMmss(mejor.t)}. Una meta realista en 8 semanas: ${Ent.formatoMmss(Math.round(mejor.t * 0.96))}.`
    : 'Aún no hay sesiones para sugerirte una meta: elige una que te rete.';
  $('#pm-tiempo').placeholder = mejor ? Ent.formatoMmss(Math.round(mejor.t * 0.96)) : '8:00';
}
$('#pm-dist').addEventListener('change', pintarPlanMeta);
async function crearPlanMeta() {
  const distancia = Number($('#pm-dist').value);
  const segundos = leerMmss($('#pm-tiempo').value || $('#pm-tiempo').placeholder);
  const semanas = Math.round(Number($('#pm-semanas').value));
  const inicio = $('#pm-inicio').value;
  if (!segundos) { $('#pm-error').textContent = 'Escribe el tiempo meta como mm:ss, por ejemplo 7:45.'; return; }
  if (!(semanas >= 2 && semanas <= 16) || !inicio) { $('#pm-error').textContent = 'Elige entre 2 y 16 semanas y la fecha de inicio.'; return; }
  const split = (segundos * 500) / distancia;
  if (split < 80 || split > 200) { $('#pm-error').textContent = 'Ese tiempo da un ritmo fuera de lo posible: revisa la distancia y el tiempo.'; return; }
  $('#pm-error').textContent = '';
  const { programa, entrenamientos } = P.planPorMeta({ distancia, segundos, semanas, inicio });
  await guardarEntrenamientosDePlan(entrenamientos);
  guardarPrograma(programa);
  elegirLoDeHoy = true;
  toast(`Plan creado: ${programa.dias.length} sesiones en ${semanas} semanas`);
  pintarEntrenamientos();
  llenarSelectorEntrenamientos();
  pintarHoy();
}

$('#btn-crear-programa').addEventListener('click', async () => {
  const semanas = Number($('#p-semanas').value);
  const inicio = $('#p-inicio').value;
  const porDia = {};
  $('#p-dias').querySelectorAll('select').forEach((x) => { if (x.value) porDia[x.dataset.dia] = x.value; });
  if (!inicio || !(semanas >= 1)) { $('#p-error').textContent = 'Indica la fecha de inicio y cuántas semanas.'; return; }
  if (!Object.keys(porDia).length) { $('#p-error').textContent = 'Elige un entrenamiento para al menos un día.'; return; }
  $('#p-error').textContent = '';
  guardarPrograma(P.generarSemanal('Mi programa', inicio, Math.min(26, semanas), porDia));
  toast('Programa creado');
  pintarEntrenamientos();
});
$('#btn-quitar-programa').addEventListener('click', () => {
  if (!confirm('¿Quitar el programa? Tus sesiones no se borran.')) return;
  guardarPrograma(null);
  pintarEntrenamientos();
});

async function pintarRecomendacion() {
  const r = E.recomendacion(await db.listar('sesiones'), ftp());
  const el = $('#recomendacion');
  el.hidden = !r;
  if (r) { el.textContent = r.texto; el.className = `recomendacion ${r.tipo}`; }
}

// ¿La sesión es el entrenamiento que tocaba hoy en el programa? (para los talentos del samurái)
function delProgramaHoy(s) {
  const hoy = P.deHoy(leerPrograma(), s.inicio);
  return !!(hoy && s.entrenamiento && hoy.ent === s.entrenamiento) || undefined;
}

// Tarjeta «Hoy»: lo que vas a remar al pulsar Empezar, y una sugerencia si hay algo mejor que hacer.
let hoyTurno = 0;
async function pintarHoy(ent = entrenamientoPrevio) {
  const turno = ++hoyTurno;
  const sesiones = await db.listar('sesiones');
  if (turno !== hoyTurno) return;
  pintarRecomendacion();
  const prog = leerPrograma();
  const hoyProg = P.deHoy(prog);
  const hecho = hoyProg && sesiones.some((x) => E.claveDia(x.fecha) === hoyProg.fecha && x.entrenamiento === hoyProg.ent);
  const esDeHoy = !!(ent && hoyProg && ent.nombre === hoyProg.ent);
  $('#hoy-etq').textContent = esDeHoy ? (hecho ? 'Hoy toca · ya lo hiciste' : 'Hoy toca') : ent ? 'Tu entrenamiento' : 'Hoy';
  $('#hoy-nombre').textContent = ent ? ent.nombre : libreConFantasmas() ? 'Remo libre contra 3 fantasmas' : 'Remo libre';
  $('#hoy-resumen').textContent = ent ? [B.resumenEnt(ent), ent.proposito].filter(Boolean).join(' · ')
    : libreConFantasmas() ? 'Rema a tu aire: la carrera cuenta desde los 5 min.' : 'Rema a tu aire, sin meta.';
  $('#btn-hoy-detalle').hidden = !ent;
  const abierto = !!ent && ajustes.si('hoyDetalle', false);
  $('#btn-hoy-detalle').textContent = abierto ? 'Ocultar detalles' : 'Ver detalles';
  $('#btn-hoy-detalle').setAttribute('aria-expanded', String(abierto));
  $('#hoy-detalle-caja').hidden = !abierto;
  if (abierto) pintarBloquesEnt(ent, $('#hoy-perfil'), $('#hoy-bloques'), $('#hoy-leyenda'));
  // Sugerencia: lo del programa, afinar el FTP o crear un plan.
  const caja = $('#hoy-sugerencia');
  const [texto, boton] = [caja.querySelector('span'), caja.querySelector('button')];
  let sug = null;
  const prox = prog && !hoyProg ? P.proximo(prog) : null;
  const h = J.estadoJuego(sesiones, { ftp: ftp(), per: leerPersonaje() });
  const jefe = J.claseDe(leerPersonaje().clase) && h.capitulo?.listo ? h.capitulo : null;
  // Un plan armado sin historial se ajusta a lo que remas cuando ya hay 4 sesiones desde que empezó.
  const desdePlan = prog ? sesiones.filter((x) => E.claveDia(x.fecha) >= prog.inicio).length : 0;
  if (prog?.sinHistorial && prog.objetivo && desdePlan >= 4 && (hoyProg || prox)) {
    sug = { texto: 'Tu plan se armó sin historial. ¿Lo ajusto a lo que remas ahora?', boton: 'Ajustar', accion: () => rehacerPlan(prog, { ajustar: true }) };
  } else if (hoyProg && !hecho && !esDeHoy) {
    const opcion = [...$('#sel-entrenamiento').options].find((o) => o.textContent === hoyProg.ent);
    if (opcion) sug = { texto: `Tu plan dice: ${hoyProg.ent}`, boton: 'Elegir', accion: () => elegirEnt(opcion.value) };
  } else if (prog && !hoyProg && !prox) {
    sug = prog.objetivo
      ? { texto: `Terminaste «${prog.nombre}». ¡Bien hecho! El siguiente sube un poco la carga.`, boton: 'Siguiente plan', accion: () => rehacerPlan(prog) }
      : { texto: `Terminaste «${prog.nombre}». ¡Bien hecho!`, boton: 'Nuevo plan', accion: () => { ajustes.escribir('pestanaPlanes', 'programa'); irA('entrenamientos'); } };
  } else if (jefe && ent?.id !== jefe.preparar) {
    sug = { texto: `${jefe.jefe.nombre} te espera: ${jefe.jefe.texto.charAt(0).toLowerCase()}${jefe.jefe.texto.slice(1)} (+${miles(jefe.xp)} XP).`, boton: 'Enfrentar', accion: () => prepararEntrenamiento(jefe.preparar) };
  } else if (prog && !hoyProg) {
    sug = { texto: `Hoy descansas en tu plan. Próximo: ${prox.ent} (${new Date(`${prox.fecha}T12:00`).toLocaleDateString('es-MX', { weekday: 'long' })}).` };
  } else if (!prog && ajustes.si('ftpEstimado', false) && sesiones.length >= 3 && !sesiones.some((x) => x.pruebaWatts) && ent?.id !== 'base:prueba-ftp') {
    sug = { texto: 'Tu FTP es estimado. Afínalo con la Prueba FTP 20 min.', boton: 'Elegir', accion: () => elegirEnt('base:prueba-ftp') };
  } else if (!prog && sesiones.length >= 1 && !ent) {
    sug = { texto: '¿Quieres un plan? Se arma en un minuto.', boton: 'Crear plan', accion: () => { ajustes.escribir('pestanaPlanes', 'programa'); irA('entrenamientos'); } };
  }
  caja.hidden = !sug;
  if (sug) {
    texto.textContent = sug.texto;
    boton.hidden = !sug.boton;
    boton.textContent = sug.boton || '';
    boton.onclick = sug.accion || null;
  }
}
// Siguiente plan (un poco más de carga) o el mismo ajustado a tu historial, desde hoy.
async function rehacerPlan(prog, { ajustar = false } = {}) {
  const ctx = await contextoPlan();
  const orden = P.NIVELES_PLAN.map((n) => n.clave);
  const nivel = ajustar ? ctx.nivelSugerido : orden[Math.min(orden.length - 1, orden.indexOf(prog.nivel) + 1)] || 'medio';
  const restantes = Math.ceil((new Date(`${prog.dias.at(-1).fecha}T12:00`) - Date.now()) / (7 * 864e5));
  const semanas = ajustar ? Math.max(2, restantes) : prog.semanas || 6;
  const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: prog.objetivo, nivel, dias: prog.porSemana || 3, semanas, inicio: E.claveDia(Date.now()), ctx });
  await guardarEntrenamientosDePlan(entrenamientos);
  guardarPrograma(programa);
  elegirLoDeHoy = true;
  toast(ajustar ? `Ajusté tu plan a lo que remas: ${programa.dias.length} sesiones` : `Plan nuevo: ${programa.dias.length} sesiones en ${semanas} semanas`, 4000);
  await llenarSelectorEntrenamientos();
  pintarHoy();
}
// Elige un entrenamiento para la tarjeta «Hoy» (o Remo libre con '').
function elegirEnt(valor) {
  const sel = $('#sel-entrenamiento');
  sel.value = valor;
  ajustes.escribir('ultimoEnt', sel.value);
  ajustes.escribir('modoEnt', sel.value ? 'objetivo' : 'libre');
  vistaPrevia();
}
$('#btn-cambiar').addEventListener('click', () => {
  const abierto = $('#otra-cosa').hidden;
  $('#otra-cosa').hidden = !abierto;
  $('#btn-cambiar').setAttribute('aria-expanded', String(abierto));
  $('#btn-cambiar').textContent = abierto ? 'Listo' : 'Cambiar';
});
$('#btn-hoy-detalle').addEventListener('click', () => {
  ajustes.escribir('hoyDetalle', ajustes.si('hoyDetalle', false) ? '0' : '1');
  pintarHoy();
});

// ---------- Respaldo ----------
const CLAVES_AJUSTES = ['peso', 'ftp', 'ftpEstimado', 'edad', 'fcMax', 'fcMaxDeEdad', 'libreFantasmas', 'inicioHecho', 'metaSemana', 'voz', 'modoAuto', 'pausaAuto', 'resAuto', 'atrVivo', 'vistaRemo', 'variante', 'tema', 'guiado', 'ritmoObjetivo', 'personaje', 'avanzado'];

async function guardarRespaldo() {
  const datos = {
    app: 'remadora',
    version: VERSION,
    fecha: new Date().toISOString(),
    sesiones: await db.listar('sesiones'),
    entrenamientos: await db.listar('entrenamientos'),
    programa: leerPrograma(),
    ajustes: Object.fromEntries(CLAVES_AJUSTES.map((k) => [k, ajustes.leer(k, null)]).filter(([, v]) => v != null)),
  };
  const nombre = `rower-respaldo-${E.claveDia(Date.now())}.json`;
  const texto = JSON.stringify(datos);
  const archivo = new File([texto], nombre, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: 'Respaldo de Rower' });
    } else {
      descargar(nombre, texto, 'application/json');
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    descargar(nombre, texto, 'application/json');
  }
  ajustes.escribir('ultimoRespaldo', Date.now());
  pintarInfoRespaldo();
  toast(`Respaldo listo: ${datos.sesiones.length} sesiones`);
  if (vistaActiva('historial')) pintarAvisoRespaldo(datos.sesiones.length);
}

async function restaurarRespaldo(archivo) {
  let datos;
  try { datos = JSON.parse(await archivo.text()); } catch { toast('Ese archivo no es un respaldo válido'); return; }
  if (datos?.app !== 'remadora' || !Array.isArray(datos.sesiones)) { toast('Ese archivo no es un respaldo de Rower'); return; }
  const fechas = new Set((await db.listar('sesiones')).map((s) => s.fecha));
  let nS = 0;
  for (const s of datos.sesiones) {
    if (fechas.has(s.fecha)) continue;
    const copia = { ...s };
    delete copia.id;
    await db.guardar('sesiones', copia);
    nS++;
  }
  const nombres = new Set((await db.listar('entrenamientos')).map((e) => e.nombre));
  let nE = 0;
  for (const e of datos.entrenamientos || []) {
    if (nombres.has(e.nombre)) continue;
    const copia = { ...e };
    delete copia.id;
    await db.guardar('entrenamientos', copia);
    nE++;
  }
  // Lo que falta se toma del respaldo; si el héroe, el plan o los ajustes ya existen y son otros, se pregunta.
  const ajustesResp = Object.entries(datos.ajustes || {}).filter(([k]) => CLAVES_AJUSTES.includes(k));
  const distintos = [];
  if (datos.programa && leerPrograma() && JSON.stringify(leerPrograma()) !== JSON.stringify(datos.programa)) distintos.push('el plan');
  if (ajustesResp.some(([k, v]) => k === 'personaje' && ajustes.leer(k, null) != null && ajustes.leer(k, null) !== String(v))) distintos.push('el héroe');
  if (ajustesResp.some(([k, v]) => ['peso', 'ftp', 'edad', 'fcMax', 'metaSemana'].includes(k) && ajustes.leer(k, null) != null && ajustes.leer(k, null) !== String(v))) distintos.push('tus ajustes');
  const reemplazar = distintos.length > 0 && confirm(`El respaldo trae ${distintos.join(', ').replace(/, ([^,]*)$/, ' y $1')} distintos a los de ahora. ¿Usar los del respaldo?`);
  if (datos.programa && (reemplazar || !leerPrograma())) guardarPrograma(datos.programa);
  for (const [k, v] of ajustesResp) {
    if (reemplazar || ajustes.leer(k, null) == null) ajustes.escribir(k, v);
  }
  toast(`Restaurado: ${nS} sesiones y ${nE} entrenamientos nuevos${reemplazar ? ', con el héroe, el plan y los ajustes del respaldo' : ''}`);
  // Con el héroe y los ajustes cambiados, lo más simple y seguro es volver a cargar la app.
  if (reemplazar) setTimeout(() => location.reload(), 1500);
  llenarSelectorEntrenamientos();
  pintarHoy();
}

function pintarInfoRespaldo() {
  const ultimo = Number(ajustes.leer('ultimoRespaldo', 0));
  $('#respaldo-info').textContent = ultimo
    ? `Último respaldo: ${new Date(ultimo).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'Todavía no has guardado un respaldo.';
  $('#respaldo-resumen').textContent = ultimo ? new Date(ultimo).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin respaldo';
}
$('#btn-respaldo').addEventListener('click', guardarRespaldo);
$('#btn-restaurar').addEventListener('click', () => $('#in-restaurar').click());
$('#in-restaurar').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  if (archivo) { await restaurarRespaldo(archivo); await repararSesiones(); }
});
pintarInfoRespaldo();
repararSesiones();

// Sesiones guardadas con saltos falsos de distancia de la consola: se recortan a los metros reales una sola vez.
async function repararSesiones() {
  let n = 0;
  for (const s of await db.listar('sesiones')) {
    const r = E.repararSaltos(s);
    if (!r) continue;
    await db.guardar('sesiones', r);
    agregarLog(`sesión reparada: ${s.distancia} → ${r.distancia} m`);
    n++;
  }
  if (!n) return;
  toast(n === 1 ? 'Reparé una sesión con metros falsos de la consola' : `Reparé ${n} sesiones con metros falsos de la consola`);
  if (vistaActiva('historial')) pintarHistorial();
}

// ---------- Detalle de un entrenamiento: qué es, para qué sirve y sus bloques ----------
let entDetalle = null;
// Bloques en filas cortas: las series repetidas («Umbral 1/3», «Suave», «Umbral 2/3»…) se juntan en «3 × …».
function filasBloques(bloques, f, fc) {
  const firma = (b) => b && [b.nombre?.replace(/\s*\d+\/\d+$/, ''), Ent.finDe(b), Ent.cantidadDe(b), b.metrica, b.min, b.max].join('|');
  const nombre = (b) => b.nombre?.replace(/\s*\d+\/\d+$/, '') || 'Intervalo';
  const texto = (b) => `${Ent.textoCantidad(b)}${nombre(b) === Ent.textoCantidad(b) ? '' : ` · ${escaparHtml(nombre(b))}`} <span class="suave">${b.metrica ? Ent.textoMeta(b, f, fc) : 'libre'}</span>`;
  const filas = [];
  for (let i = 0; i < bloques.length;) {
    const [a, d] = [bloques[i], bloques[i + 1]];
    // Patrón trabajo + descanso repetido; la última serie va sin descanso.
    let n = 1;
    if (d && firma(d) !== firma(a) && !/^(suave|descanso|recupera)/i.test(nombre(a))) while (firma(bloques[i + n * 2 - 1]) === firma(d) && firma(bloques[i + n * 2]) === firma(a)) n++;
    if (n > 1) {
      filas.push(`<li><b class="veces">${n} ×</b> ${texto(a)}<small class="entre">con ${texto(d)} entre series</small></li>`);
      i += n * 2 - 1;
      continue;
    }
    let k = 1;
    while (firma(bloques[i + k]) === firma(a)) k++;
    filas.push(`<li>${k > 1 ? `<b class="veces">${k} ×</b> ` : ''}${texto(a)}</li>`);
    i += k;
  }
  return filas.join('');
}
function abrirDetalleEnt(ent) {
  entDetalle = ent;
  const base = B.esBase(ent.id);
  const secc = SECCIONES_ENT.find((x) => x.clave === (ent.enfoque || P.enfoqueDe(ent)));
  $('#he-titulo').textContent = ent.nombre;
  $('#he-sub').innerHTML = [ent.dificultad ? `<span class="dif ${ent.dificultad}">${B.nombreDificultad(ent.dificultad)}</span>` : '', secc?.nombre, B.resumenEnt(ent), base ? '' : 'Tuyo'].filter(Boolean).join(' · ');
  $('#he-para').textContent = ent.proposito || (base ? '' : 'Entrenamiento que creaste tú.');
  $('#he-para').hidden = !$('#he-para').textContent;
  $('#he-editar').textContent = base ? 'Copiar y editar' : 'Editar';
  $('#hoja-ent').hidden = false;
  pintarBloquesEnt(ent, $('#he-perfil'), $('#he-bloques'), $('#he-leyenda'));
  $('#hoja-ent .hoja').focus();
}
// Leyenda del perfil: solo lo que aparece en este entrenamiento.
function leyendaPerfil(bloques, conPotencia = false) {
  const conRango = bloques.some((b) => ['ftp', 'watts', 'split'].includes(b.metrica));
  const libres = bloques.some((b) => !['ftp', 'watts', 'split'].includes(b.metrica));
  const sinTiempo = bloques.some((b) => Ent.finDe(b) !== 'tiempo');
  return `${conRango ? '<span class="lr">Rango de potencia</span><span class="lf">Fuera de rango</span>' : ''}${libres ? '<span class="ll">Cualquier potencia</span>' : ''}${sinTiempo ? '<span class="ld">Sin tiempo fijo (≈)</span>' : ''}${conPotencia ? '<span class="lp">Tu potencia</span>' : ''}`;
}
// Perfil y bloques de un entrenamiento (en la hoja de detalle y en la tarjeta «Hoy»). El lienzo debe estar visible.
function pintarBloquesEnt(ent, canvas, lista, leyenda) {
  const intervalos = Ent.tipoDe(ent) === 'intervalos';
  if (intervalos) lista.innerHTML = filasBloques(ent.bloques, ftp(), fcMaxima());
  else {
    const m = Ent.METRICAS_OBJETIVO[ent.objetivo.metrica];
    lista.innerHTML = `<li>Meta: <b>${miles(ent.objetivo.valor)} ${m.unidad}</b> <span class="suave">al ritmo que quieras; termina al llegar.</span></li>`;
  }
  canvas.hidden = !intervalos;
  leyenda.hidden = !intervalos;
  if (!intervalos) return;
  leyenda.innerHTML = leyendaPerfil(ent.bloques);
  dibujarPerfil(canvas, paraPerfil(ent.bloques));
}
function cerrarDetalleEnt() { $('#hoja-ent').hidden = true; entDetalle = null; }
$('#he-cerrar').addEventListener('click', cerrarDetalleEnt);
$('#hoja-ent').addEventListener('click', (e) => { if (e.target === $('#hoja-ent')) cerrarDetalleEnt(); });
$('#he-entrenar').addEventListener('click', () => { const ent = entDetalle; cerrarDetalleEnt(); usarEnt(ent); });
$('#he-editar').addEventListener('click', () => {
  const ent = entDetalle;
  cerrarDetalleEnt();
  if (B.esBase(ent.id)) copiarBase(ent); else abrirEditor(ent);
});

function cerrarHoja() {
  $('#hoja').hidden = true;
  if (vistaActiva('historial')) pintarHistorial();
}
$('#hoja-cerrar').addEventListener('click', cerrarHoja);
$('#hoja').addEventListener('click', (e) => { if (e.target === $('#hoja')) cerrarHoja(); });
// Cierra lo que esté encima (detalle, hoja, modo remo). Devuelve false si no había nada abierto.
function cerrarLoDeEncima() {
  if (!$('#fin-dialogo').hidden) cerrarFin();
  else if (!$('#hoja-ent').hidden) cerrarDetalleEnt();
  else if (!$('#hoja').hidden) cerrarHoja();
  else if (!$('#modo-remo').hidden) cerrarModoRemo();
  else return false;
  return true;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarLoDeEncima(); });

// Botón Atrás de Android: cierra lo de encima o vuelve a Entrenar en vez de salir de la app.
// Con una sesión en marcha nunca sale; sin ella, sale al pulsar Atrás dos veces seguidas.
{
  let avisoSalir = 0;
  history.replaceState({ remadora: 'base' }, '');
  history.pushState({ remadora: 'guarda' }, '');
  window.addEventListener('popstate', () => {
    const bloqueo = !$('#inicio').hidden || !$('#recuperar-dialogo').hidden;
    if (!bloqueo && !cerrarLoDeEncima()) {
      if (!vistaActiva('entrenar')) irA('entrenar');
      else if (sesion) toast('Sesión en marcha: termínala antes de salir');
      else if (Date.now() - avisoSalir > 2500) { avisoSalir = Date.now(); toast('Pulsa Atrás otra vez para salir', 2500); }
      else { history.back(); return; }
    }
    history.pushState({ remadora: 'guarda' }, '');
  });
}

$('#btn-borrar').addEventListener('click', async () => {
  if (sesionAbierta && confirm('¿Borrar esta sesión?')) {
    await db.borrar('sesiones', sesionAbierta.id);
    toast('Sesión borrada');
    cerrarHoja();
  }
});
$('#btn-compartir-img').addEventListener('click', async (ev) => {
  const s = sesionAbierta;
  if (!s) return;
  const boton = ev.currentTarget;
  boton.disabled = true;
  const f = new Date(s.fecha);
  const stats = [['Distancia', `${miles(s.distancia)} m`], ['Tiempo', formatoTiempo(s.duracion)], ['Split prom', formatoSplit(s.splitProm)],
    ['Watts prom', `${s.wattsProm} W`], ['Golpes/min', s.spmProm], [s.fcProm ? 'Pulso prom' : 'Calorías', s.fcProm ? `${s.fcProm} lpm` : s.kcal]];
  const rivales = s.rivales || (s.rival ? [s.rival] : []);
  const recs = E.nuevosRecords(s, (cacheSesiones || []).filter((x) => x.id !== s.id && x.fecha < s.fecha));
  const extra = recs.length ? `Récord: ${recs[0].nombre} ${formatoRecord(recs[0], recs[0].valor)}`
    : rivales.length ? rivales.map((r) => `${r.diferencia > 0 ? '+' : ''}${r.diferencia} m vs. ${r.nombre.replace(/^Fantasma /, '')}`).join(' · ') : '';
  try {
    const blob = await tarjetaSesion({
      titulo: s.entrenamiento || 'Remo libre',
      fecha: f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      stats, extra, puntos: (s.muestras || []).map((x) => [x.t, x.w]),
    });
    const nombre = `rower-${marcaFecha(s.fecha)}.png`;
    const archivo = new File([blob], nombre, { type: 'image/png' });
    if (navigator.canShare?.({ files: [archivo] })) await navigator.share({ files: [archivo], title: 'Mi sesión en Rower' });
    else descargar(nombre, blob, 'image/png');
  } catch (err) {
    if (err.name !== 'AbortError') toast('No se pudo crear la imagen');
  } finally { boton.disabled = false; }
});

$('#btn-csv').addEventListener('click', () => {
  const s = sesionAbierta;
  const filas = ['segundo,watts,golpes_min,split_s_500m,distancia_m,nivel,pulso'];
  for (const x of s.muestras) filas.push([x.t, x.w, x.spm, x.split, x.dist, x.nivel, x.fc].join(','));
  descargar(`remo-${marcaFecha(s.fecha)}.csv`, filas.join('\n'), 'text/csv');
});
$('#btn-tcx').addEventListener('click', () => {
  const s = sesionAbierta;
  const iso = (t) => new Date(s.fecha + t * 1000).toISOString();
  const puntos = s.muestras.map((x) => `<Trackpoint><Time>${iso(x.t)}</Time><DistanceMeters>${x.dist}</DistanceMeters>${x.fc ? `<HeartRateBpm><Value>${x.fc}</Value></HeartRateBpm>` : ''}<Cadence>${x.spm}</Cadence><Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Watts>${x.w}</Watts></TPX></Extensions></Trackpoint>`).join('');
  const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Other"><Id>${iso(0)}</Id><Lap StartTime="${iso(0)}"><TotalTimeSeconds>${s.duracion}</TotalTimeSeconds><DistanceMeters>${s.distancia}</DistanceMeters><Calories>${s.kcal}</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${puntos}</Track></Lap><Notes>Remo indoor</Notes></Activity></Activities></TrainingCenterDatabase>`;
  descargar(`remo-${marcaFecha(s.fecha)}.tcx`, tcx, 'application/vnd.garmin.tcx+xml');
});

// ---------- Utilidades ----------
function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function marcaFecha(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

let audio = null;
function pitido(frecuencia, segundos) {
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = frecuencia;
    g.gain.setValueAtTime(0.2, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + segundos);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + segundos);
  } catch { /* sin audio */ }
}

function vibrar(patron) {
  try { navigator.vibrate?.(patron); } catch { /* sin vibración */ }
}

// El bloqueo de pantalla se pierde al cambiar de app; se recupera al volver si hay sesión.
document.addEventListener('visibilitychange', async () => {
  if (sesion && document.visibilityState === 'visible') {
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
  }
});

// ---------- Primer inicio: héroe, objetivo y conexión en 3 pasos ----------
const inicio = { paso: 1, clase: null, objetivo: null, dias: 3 };
const OBJETIVOS_INICIO = [...P.OBJETIVOS_PLAN, { clave: 'libre', nombre: 'Solo remar', texto: 'Sin plan: remo libre contra fantasmas.' }];
function pintarInicio() {
  const p = inicio.paso;
  document.querySelectorAll('.inicio-paso').forEach((x) => { x.hidden = Number(x.dataset.paso) !== p; });
  document.querySelectorAll('#inicio-puntos span').forEach((x, i) => x.classList.toggle('activo', i < p));
  $('#inicio-clases').innerHTML = J.CLASES.map((c) => `<button type="button" class="clase-mini" role="radio" aria-checked="${c.clave === inicio.clase}" data-clase="${c.clave}">
    <img src="${srcHeroe(c.clave, 1, true)}" width="56" height="56" alt=""><b>${c.nombre}</b><small>+15 % ${nombreAtributo(c.favorito)}</small><span class="lema">${c.para}</span></button>`).join('');
  $('#inicio-objetivos').innerHTML = OBJETIVOS_INICIO.map((o) => `<button type="button" role="radio" class="opcion" data-obj="${o.clave}" aria-checked="${o.clave === inicio.objetivo}"><b>${o.nombre}</b><small>${o.texto}</small></button>`).join('');
  $('#inicio-dias').innerHTML = [1, 2, 3, 4, 5].map((d) => `<button type="button" role="radio" class="chip" data-dias="${d}" aria-pressed="${inicio.dias === d}">${d} ${d === 1 ? 'día' : 'días'}</button>`).join('');
  $('#inicio-dias-campo').hidden = !inicio.objetivo || inicio.objetivo === 'libre';
  const sig = $('#inicio-siguiente');
  sig.disabled = (p === 1 && !inicio.clase) || (p === 2 && !inicio.objetivo);
  sig.textContent = p === 3 ? 'Lo haré después' : 'Siguiente';
  sig.classList.toggle('primario', p !== 3);
  $('#inicio-atras').hidden = p === 1;
  $('#inicio-saltar').hidden = p === 3;
  if (p === 3 && !Remadora.soportado()) {
    $('#inicio-bt-texto').textContent = 'Este navegador no tiene Bluetooth web: para conectar la remadora abre la app en Chrome para Android. Mientras, pruébala en modo demo.';
    $('#inicio-conectar').hidden = true;
    $('#inicio-demo').classList.add('primario', 'grande');
  }
}
$('#inicio').addEventListener('click', (e) => {
  const c = e.target.closest('[data-clase]');
  const o = e.target.closest('[data-obj]');
  const d = e.target.closest('[data-dias]');
  if (c) inicio.clase = c.dataset.clase;
  if (o) inicio.objetivo = o.dataset.obj;
  if (d) inicio.dias = Number(d.dataset.dias);
  if (c || o || d) pintarInicio();
  // Al elegir objetivo aparece la pregunta de los días: se trae a la vista (en horizontal quedaba oculta abajo).
  if (o && !$('#inicio-dias-campo').hidden) $('#inicio-dias-campo').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
$('#inicio-siguiente').addEventListener('click', () => {
  if (inicio.paso < 3) { inicio.paso++; pintarInicio(); $('#inicio .inicio-cuerpo').scrollTop = 0; } else terminarInicio();
});
$('#inicio-atras').addEventListener('click', () => { inicio.paso = Math.max(1, inicio.paso - 1); pintarInicio(); });
$('#inicio-saltar').addEventListener('click', () => terminarInicio({ saltar: true }));
$('#inicio-demo').addEventListener('click', () => { remadora.iniciarDemo(); terminarInicio(); });
$('#inicio-conectar').addEventListener('click', async () => {
  try {
    await remadora.conectar(selVariante.value);
  } catch (err) {
    agregarLog(`error: ${err.message}`);
    $('#inicio-bt-texto').textContent = err.name === 'NotFoundError'
      ? 'No elegiste ninguna. Revisa que la consola esté encendida y vuelve a tocar Conectar.'
      : `No se pudo conectar (${err.message}). Vuelve a intentarlo o pruébala en modo demo.`;
    return;
  }
  if (remadora.conectada) terminarInicio();
});
// Guarda lo elegido (al saltar, solo el héroe) y deja la app lista para pulsar Empezar.
async function terminarInicio({ saltar = false } = {}) {
  ajustes.escribir('inicioHecho', '1');
  $('#inicio').hidden = true;
  if (inicio.clase) guardarPersonaje({ clase: inicio.clase, nombre: $('#inicio-nombre').value.trim() });
  let texto = inicio.clase ? '¡Listo! Pulsa Empezar cuando quieras remar' : '';
  if (!saltar && inicio.objetivo && inicio.objetivo !== 'libre') {
    const ctx = await contextoPlan();
    const { programa, entrenamientos } = P.planPorObjetivo({ objetivo: inicio.objetivo, nivel: ctx.nivelSugerido, dias: inicio.dias, semanas: 6, inicio: E.claveDia(Date.now()), ctx });
    await guardarEntrenamientosDePlan(entrenamientos);
    guardarPrograma(programa);
    elegirLoDeHoy = true;
    texto = `Tu plan está listo: ${programa.dias.length} sesiones en 6 semanas`;
  }
  irA('entrenar');
  await llenarSelectorEntrenamientos();
  pintarLineaNivel();
  if (inicio.clase) confeti(1200);
  if (texto) toast(texto, 4000);
}
(async () => {
  if (ajustes.si('inicioHecho', false)) { ofrecerRecuperar(); return; }
  // Solo para quien empieza de cero: con héroe o sesiones guardadas, ya pasó por aquí.
  if (leerPersonaje().clase || (await db.listar('sesiones')).length) { ajustes.escribir('inicioHecho', '1'); return; }
  pintarInicio();
  $('#inicio').hidden = false;
})();

const horizontalTel = matchMedia('(orientation: landscape) and (max-height: 520px)');
// Al girar a horizontal a mitad de una carrera, la pista se lleva a la vista igual que al empezar.
horizontalTel.addEventListener('change', () => {
  if (horizontalTel.matches && sesion && hayCarrera() && vistaActiva('entrenar') && $('#modo-remo').hidden) {
    requestAnimationFrame(() => $('#carrera').scrollIntoView({ block: 'start' }));
  }
});
window.addEventListener('resize', () => {
  if (vistaActiva('entrenar')) { dibujarVivo(); if (!sesion) vistaPrevia(); }
  if (vistaActiva('historial')) pintarHistorial();
  if (vistaActiva('entrenamientos')) pintarPrograma();
});
actualizarBotones();
llenarSelectorEntrenamientos();
dibujarVivo();
pintarLineaNivel();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
