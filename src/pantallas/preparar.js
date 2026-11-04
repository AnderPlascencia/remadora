// Entrenar antes de remar: elegir rivales, dificultad, ventaja y vista previa de la sesión.
import { formatoSplit, formatoTiempo } from '../protocolo.js';
import { COLORES_RIVAL } from '../carrera.js';
import * as F from '../fantasma.js';
import * as H from '../historial.js';
import * as E from '../estadisticas.js';
import * as J from '../juego.js';
import * as V from '../ventajas.js';
import * as Pf from '../perfil.js';
import { $, ajustes, escaparHtml, ftp, ico, miles, perfil, toast } from '../ui.js';
import { estado } from '../estado.js';
import { pintarClasificacion, pintarZonas, ritmoObjetivo } from './ajustes.js';
import { modoEnt } from './vivo.js';
import { chipsAtr, filaCond, icoMoneda, inventario, leerPersonaje, opcConsejos, previsionDe } from './heroe.js';
import { contextoXp } from './programa.js';

// ---------- Fantasmas: hasta 3 a la vez, uno de ellos a tu medida ----------
const MAX_RIVALES = 3;
// Una estimación no lleva metros exactos: «unos 5 km» y no «unos 5,003 m».
function distanciaRedonda(m) {
  if (m < 1000) return `${Math.round(m / 50) * 50} m`;
  return `${(Math.round(m / 500) / 2).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`;
}
// Respuestas del asistente de plan por objetivo (en Planes).
export const asistente = { objetivo: null, nivel: null, dias: perfil().dias, semanas: 6 };
// En «Por objetivo» siempre se compite contra 3 rivales de otras clases; en Remo libre, solo si lo activas.
export const libreConFantasmas = () => modoEnt() === 'libre' && ajustes.leer('libreFantasmas', '1') === '1';
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
export const hayCarrera = () => !!(estado.sesion && (estado.sesion.rival || estado.sesion.referencias?.length));
// Dificultad de los rivales de clase: se elige cuando hay rivales.
const dificultadActual = () => (conRivales() ? ajustes.leer('dificultad', 'costa') : 'costa');
function pintarDificultad() {
  const caja = $('#dificultad');
  $('#libre-fantasmas').hidden = modoEnt() !== 'libre';
  $('#in-libre-fantasmas').checked = libreConFantasmas();
  $('#in-libre-fantasmas').disabled = !!estado.sesion;
  $('#bloque-rivales').hidden = !conRivales();
  if (!conRivales()) return;
  const actual = dificultadActual();
  caja.innerHTML = Object.entries(J.DIFICULTADES).map(([k, d]) => `<button type="button" role="radio" data-dif="${k}" aria-checked="${k === actual}" ${estado.sesion ? 'disabled' : ''}>
    <b>${d.nombre}</b><small>${d.texto.split(': ')[0]} · ${d.xp} XP por rival vencido</small></button>`).join('');
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarPreparar() {
  $('#in-libre-fantasmas').addEventListener('change', (e) => {
    if (estado.sesion) return;
    ajustes.escribir('libreFantasmas', e.target.checked ? '1' : '0');
    pintarChips();
  });
  $('#dificultad').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dif]');
    if (!b || estado.sesion) return;
    ajustes.escribir('dificultad', b.dataset.dif);
    pintarChips();
  });
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
}
function perso() {
  try { return { modo: 'ftp', valor: '', ...JSON.parse(ajustes.leer('fantasmaPerso', '{}')) }; } catch { return { modo: 'ftp', valor: '' }; }
}
const PERSO = {
  ftp: { etq: 'FTP del fantasma (W)', ayuda: () => `Rema cada intervalo a la intensidad del plan con ese FTP${ftp() ? ` (el tuyo es ${ftp()} W)` : ''}.`, ejemplo: () => String(Math.round((ftp() || 170) * 1.05)) },
  tiempo: { etq: 'Tiempo objetivo (mm:ss)', ayuda: () => 'Termina justo en ese tiempo. Solo para entrenamientos que acaban por distancia.', ejemplo: () => '7:30' },
  mejora: { etq: 'Más rápido que tu mejor (%)', ayuda: () => 'Tu mejor sesión de este entrenamiento, acelerada ese porcentaje.', ejemplo: () => '2' },
};
export const leerMmss = (v) => {
  const m = /^\s*(\d{1,3}):([0-5]\d)\s*$/.exec(v || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function pintarChips() {
  const sel = rivalesElegidos();
  const nClase = sel.length;
  pintarDificultad();
  const refs = referenciasElegidas();
  for (const b of document.querySelectorAll('#chips-rival .chip')) {
    const activa = refs.includes(b.dataset.rival);
    b.setAttribute('aria-pressed', String(activa));
    b.style.setProperty('--chip', activa ? COLOR_REFERENCIA : '');
    b.disabled = !!estado.sesion;
  }
  const semana = J.rivalDeLaSemana(J.lunesDe(Date.now()), leerPersonaje().clase);
  const dif = J.DIFICULTADES[dificultadActual()];
  $('#rival-semana').textContent = `Rival de la semana: ${J.claseDe(semana).nombre}. ${F.ESTILOS[semana].texto}.${nClase ? ` ${dif.nombre}: ${dif.texto.split(': ')[1]}.` : ''}${libreConFantasmas() ? ' Rema al menos 5 min para que cuente la carrera.' : ''}`;
  pintarSelVentaja(sel);
  pintarResumenCarrera();
  if (!estado.sesion) prepararPronto();
  // Durante la sesión los fantasmas ya están en el agua: se ocultan las opciones.
  $('.fantasmas').hidden = !!estado.sesion;
  const panel = $('#perso-panel');
  panel.hidden = true;
  const p = perso();
  const info = PERSO[p.modo] || PERSO.ftp;
  $('#perso-modo').value = p.modo;
  if (document.activeElement !== $('#perso-valor')) $('#perso-valor').value = p.valor;
  $('#perso-valor').placeholder = info.ejemplo();
  $('#perso-etq').textContent = info.etq;
  $('#perso-ayuda').textContent = info.ayuda();
  for (const el of panel.querySelectorAll('select, input')) el.disabled = !!estado.sesion;
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
export function pintarSelVentaja(sel = rivalesElegidos()) {
  const inv = inventario();
  const tengo = V.OBJETOS_VENTAJA.filter((x) => inv[x.id] > 0);
  const campo = $('#ventaja-campo');
  campo.hidden = !sel.length || !tengo.length;
  if (campo.hidden) return;
  const prueba = V.esPrueba(estado.entrenamientoPrevio);
  const actual = $('#sel-ventaja').value;
  $('#sel-ventaja').innerHTML = `<option value="">Sin ventaja</option>${tengo.map((x) => `<option value="${x.id}">${x.nombre} (tienes ${inv[x.id]})</option>`).join('')}`;
  $('#sel-ventaja').value = tengo.some((x) => x.id === actual) ? actual : '';
  $('#sel-ventaja').disabled = prueba || !!estado.sesion;
  const x = V.objetoVentaja($('#sel-ventaja').value);
  $('#ventaja-ayuda').textContent = prueba ? 'En las pruebas y contra los jefes se rema sin ventajas.' : x ? `${x.texto} Se gasta al guardar la sesión.` : 'Una por carrera. Se gasta al guardar la sesión.';
}

// Crea los fantasmas elegidos para este entrenamiento, cada uno con su color.
export async function crearRivales(ent, { vista = false } = {}) {
  const lista = [];
  let guardadas = null;
  const sesiones = async () => (guardadas ??= await H.sesiones());
  const elegidos = rivalesElegidos();
  // Rivales de otras clases: su FTP sale del tuyo y, en Remo libre, de tu ritmo real de las últimas semanas.
  const nClase = elegidos.filter((k) => k === 'clase').length;
  let deClase = [];
  if (nClase) {
    const per = leerPersonaje();
    const h = H.estadoJuegoDe(await sesiones(), { ftp: ftp(), per });
    const base = ftp() || estimarFtp(await sesiones()) || 150;
    deClase = J.rivalesPara(nClase, { miClase: per.clase, nivel: h.nivel, ftp: base, peso: ajustes.num('peso', 75), factor: Pf.factorClasificacion(ajustes.leer('sexo', '')), dificultad: dificultadActual(), lunes: J.lunesDe(Date.now()), semilla: new Date().toDateString(), ritmo: ent ? null : J.ritmoLibre(await sesiones()) });
  }
  for (const clave of elegidos) {
    let r = null;
    if (clave === 'clase') {
      const d = deClase.shift();
      // Con un FTP estimado (sin prueba), las metas cortas no pasan del 115 %: un FTP de más daría un rival imposible.
      const tope = !ftp() || ajustes.si('ftpEstimado', false) ? 1.15 : null;
      r = { ...F.simular(ent, { ftp: d.ftp, estilo: d.clase, perfil: d.perfil, tope }, ftp()), nombre: d.nombre, clase: d.clase, rango: d.rango, dificultad: d.dificultad, clasificacion: d.clasificacion };
    }
    if (r) lista.push({ ...r, clave, color: COLORES_RIVAL[lista.length] });
  }
  return lista;
}

// Líneas de referencia en tu carril: tu sesión anterior y tu mejor marca de este entrenamiento.
const COLOR_REFERENCIA = '#FACC15';
export async function crearReferencias(ent, { vista = false } = {}) {
  const refs = referenciasElegidas();
  if (!refs.length) return [];
  const sesiones = await H.sesiones();
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
export function prepararPronto() {
  clearTimeout(preparoTimer);
  preparoTimer = setTimeout(pintarPreparar, 150);
}
export const srcRetratoRango = (clase, rango) => `assets/heroes/${clase}_${rango}_retrato.webp`;
const fechaMini = (f) => new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

function tarjetaRival(r) {
  if (r.clase) {
    const c = J.claseDe(r.clase);
    return `<div class="rival-tarjeta" style="--chip:${r.color}"><img src="${srcRetratoRango(r.clase, r.rango)}" width="56" height="56" alt="">
      <div><b>${escaparHtml(r.nombre.split(' (')[0])}</b><small>${c.nombre} · ${escaparHtml(r.clasificacion || '')} · ${r.ftp} W</small>
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
  if (estado.sesion) return;
  const turno = ++preparoTurno;
  const ent = estado.entrenamientoPrevio;
  const elegidos = rivalesElegidos();
  const rivales = elegidos.length ? await crearRivales(ent, { vista: true }) : [];
  const refs = await crearReferencias(ent, { vista: true });
  const sesiones = await H.sesiones();
  if (turno !== preparoTurno || estado.sesion) return;
  $('#rivales-vista').innerHTML = rivales.map(tarjetaRival).join('');
  $('#referencias-vista').innerHTML = refs.map(tarjetaRival).join('');
  const caja = $('#xp-estimada');
  caja.hidden = !ent && !rivales.length;
  if (caja.hidden) return;
  const reales = rivales.filter((r) => !r.falta);
  const hip = { ...sesionHipotetica(ent, reales, sesiones), ...(await contextoXp(ent, sesiones)) };
  if (turno !== preparoTurno || estado.sesion) return;
  const est = J.estimarXp(sesiones, hip, { ftp: ftp(), per: leerPersonaje() });
  const condicion = [ent ? `completas «${escaparHtml(ent.nombre)}»` : `remas unos ${distanciaRedonda(hip.distancia)}`, reales.length ? `vences a ${reales.length === 1 ? 'tu rival' : `tus ${reales.length} rivales`}` : ''].filter(Boolean).join(' y ');
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
    ${extrasPlegados([...p.extras.map((x) => filaCond(x)), ...(p.riesgo ? [filaCond(p.riesgo, 'riesgo')] : [])])}</div>`;
}

// «Y puedes sumar más»: un reto a la vista y los demás al tocar, para que la tarjeta no empuje el botón de empezar.
function extrasPlegados(filas) {
  if (!filas.length) return '';
  // Todo plegado: la tarjeta Hoy dice qué toca y cuánto ganas; los retos se abren al tocar.
  const retos = filas.filter((f) => !f.includes('cond riesgo')).length;
  return `<details class="mas-detalle"><summary>${retos === 1 ? 'Un reto para sumar más' : `${retos} retos para sumar más`}</summary><ul class="lista-cond">${filas.join('')}</ul></details>`;
}

// FTP automático: sin FTP (o con uno estimado), cada sesión de 10 min o más lo calcula o lo sube.
// Con 20 min, el 95 % de tus mejores 20 min; con menos, el 90 % de tu mejor potencia de 10 min.
export function ftpAutomatico(s) {
  if (s.pruebaWatts || s.duracion < 600) return null;
  const estimado = ajustes.si('ftpEstimado', false);
  if (ftp() && !estimado) return null;
  const p10 = E.mejorPotencia(s.muestras || [], 600);
  const nuevo = E.ftpSugerido(s) || (p10 ? Math.round(p10 * 0.9) : 0);
  const dePerfil = ajustes.si('ftpDePerfil', false);
  if (!nuevo || (nuevo <= ftp() && !dePerfil)) return null;
  const antes = ftp();
  guardarFtp(nuevo, true);
  ajustes.escribir('ftpDePerfil', '0');
  return { nuevo, antes };
}
export function guardarFtp(valor, estimado) {
  ajustes.escribir('ftp', String(valor));
  ajustes.escribir('ftpEstimado', estimado ? '1' : '0');
  $('#in-ftp').value = valor;
  pintarFtpEstado();
  pintarZonas();
  pintarClasificacion();
}
export function pintarFtpEstado() {
  $('#ftp-estimado').hidden = !(ftp() && ajustes.si('ftpEstimado', false));
}

// FTP aproximado sin prueba (estadisticas.js): no se infla con un 500 m.
export const estimarFtp = (sesiones) => E.ftpEstimadoDe(sesiones);

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
