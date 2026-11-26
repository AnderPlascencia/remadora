// Compartir imagen (etapa 15) y la tarjeta de la semana o del mes (etapa 31). Sale de planes.js (ronda 2, etapa 9) para
// no pesar en la primera carga: se importa la primera vez que tocas «Compartir».
import * as H from '../historial.js';
import * as E from '../estadisticas.js';
import * as P from '../programa.js';
import * as J from '../juego.js';
import * as GA from '../ganarte.js';
import * as Hab from '../habito.js';
import * as R from '../fantasma.js';
import { $, descargar, ftp, marcaFecha, toast } from '../ui.js';
import { estado } from '../estado.js';
import { estadoHeroe, hitoSesion, srcHeroe } from './heroe.js';
import { PAISAJES, paisajeElegido } from '../carrera.js';
import { leerPrograma } from './programa.js';

// Los botones del diálogo se conectan una sola vez, al abrirlo por primera vez.
let escuchando = false;
function escuchar() {
  if (escuchando) return;
  escuchando = true;
  $('#compartir-cual').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cual]');
    if (!b || compartir?.tipo !== 'periodo') return;
    compartir.inicio = b.dataset.cual === 'actual' ? compartir.actual : compartir.anterior;
    compartir.anotado = false;
    pintarCompartir();
  });
  $('#compartir-formatos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-formato]');
    if (!b || !compartir) return;
    compartir.opciones.formato = b.dataset.formato;
    pintarCompartir();
  });
  for (const [id, k] of [['#compartir-heroe', 'heroe'], ['#compartir-pulso', 'pulso'], ['#compartir-kcal', 'kcal']]) {
    $(id).addEventListener('change', (e) => { if (compartir) { compartir.opciones[k] = e.target.checked; pintarCompartir(); } });
  }
  $('#compartir-cerrar').addEventListener('click', cerrarCompartir);
  $('#compartir-dialogo').addEventListener('click', (e) => { if (e.target === $('#compartir-dialogo')) cerrarCompartir(); });
  $('#compartir-guardar').addEventListener('click', async () => {
    const listo = await imagenCompartir();
    if (!listo) return;
    descargar(listo.nombre, listo.blob, 'image/png');
    anotarCompartir('guardar');
  });
  $('#compartir-enviar').addEventListener('click', async (ev) => {
    // El botón se toma antes de esperar: después del await, ev.currentTarget ya es null (fallaba con la imagen lenta).
    const boton = ev.currentTarget;
    const listo = await imagenCompartir();
    if (!listo) return;
    boton.disabled = true;
    try {
      const archivo = new File([listo.blob], listo.nombre, { type: 'image/png' });
      const titulo = compartir?.tipo === 'periodo' ? (compartir.periodo === 'mes' ? 'Mi mes en Rower' : 'Mi semana en Rower') : 'Mi sesión en Rower';
      const extra = textoCompartir();
      if (navigator.canShare?.({ files: [archivo] })) await navigator.share({ files: [archivo], title: titulo, ...extra });
      else if (extra.url && navigator.share) await navigator.share({ title: titulo, ...extra });
      else descargar(listo.nombre, listo.blob, 'image/png');
      anotarCompartir('compartir');
    } catch (err) {
      if (err.name !== 'AbortError') toast('No se pudo compartir la imagen');
    } finally { boton.disabled = false; }
  });
}

// ---------- Compartir imagen ----------
let compartir = null; // { s, opciones, ctx, blob, url, turno }
const hitoSeguro = async (s, previas) => { try { return await hitoSesion(s, previas); } catch { return null; } };
export async function abrirCompartir(s) {
  escuchar();
  if (!s) return;
  // La tarjeta y su pintor se cargan aquí, no al arrancar la app.
  let Tj;
  try { Tj = await import('../tarjeta.js'); } catch { toast('No se pudo crear la imagen'); return; }
  const previas = (estado.cacheSesiones || []).filter((x) => x.id !== s.id && x.fecha < s.fecha);
  const programa = s.delPrograma ? leerPrograma() : null;
  let heroe = null;
  let paisaje = null;
  try {
    const { per, h } = await estadoHeroe();
    const g = h.porSesion.get(s.fecha);
    const nivel = g?.nivelDespues || h.nivel;
    const clase = J.claseDe(per.clase);
    if (clase) heroe = { nombre: per.nombre || clase.nombre, linea: `${J.tituloDe(nivel, per.clase)} · nivel ${nivel}`, src: srcHeroe(clase.clave, nivel), xp: g ? g.xp + (g.xpExtra || 0) : 0 };
    const p = PAISAJES[paisajeElegido(per)];
    if (p?.panorama) paisaje = { src: p.panorama.src, horizonte: p.panorama.horizonte, filtro: p.filtro || null };
  } catch { /* sin héroe */ }
  compartir = {
    s, Tj, opciones: { ...Tj.OPCIONES_DEFECTO }, blob: null, url: null, turno: 0,
    ctx: {
      ftp: ftp(), records: E.nuevosRecords(s, previas), marcas: E.calcularRecords(previas), previas,
      meta: programa?.meta || null, semanaPlan: programa ? Tj.semanaDelPlan(programa, s.fecha) : null,
      rivales: s.rivales || (s.rival ? [s.rival] : []), heroe, paisaje, hito: await hitoSeguro(s, previas),
    },
  };
  $('#compartir-heroe').checked = true;
  $('#compartir-heroe').closest('label').hidden = !heroe;
  $('#compartir-pulso').checked = false;
  $('#compartir-pulso').closest('label').hidden = !s.fcProm;
  $('#compartir-kcal').checked = false;
  // «Rema contra mí» (etapa 25): con la imagen va un enlace para remar contra esta sesión.
  compartir.reto = R.codificarReto(s) ? { nombre: heroe?.nombre || '' } : null;
  $('#compartir-reto').checked = true;
  $('#compartir-reto-campo').hidden = !compartir.reto;
  $('#compartir-dialogo').hidden = false;
  pintarCompartir();
}
// Lo que acompaña a la imagen al compartirla: el texto y el enlace del reto, si está elegido.
function textoCompartir() {
  const c = compartir;
  if (c?.tipo === 'periodo' || !c?.reto || !$('#compartir-reto').checked) return {};
  const nombre = $('#compartir-heroe').checked ? c.reto.nombre : '';
  const url = R.enlaceReto(location.href, c.s, nombre);
  if (!url) return {};
  // ⚖ Reto ganado (R2-6): el mensaje dice por cuánto, y el enlace es tu sesión para que te lo devuelvan.
  const reto = GA.esGanarte(c.s.fecha) ? GA.retoRemado(c.s) : null;
  const quien = reto ? GA.nombreReto(reto.ref) : '';
  const text = reto?.gano ? `Le gané a${quien ? ` tu reto, ${quien},` : ' tu reto'} por ${GA.margen(reto.ref)}. ${R.textoReto(c.s, nombre).replace(/^(.* te reta|Te reto): remé/, 'Remé').replace('¿Me alcanzas?', '¿Me alcanzas ahora?')}` : R.textoReto(c.s, nombre);
  return { text, url };
}
// Tarjeta de la semana o del mes (etapa 31): la misma vista previa, con «esta / la anterior» en vez de pulso.
export async function abrirCompartirPeriodo(periodo) {
  escuchar();
  let Tp;
  try { Tp = await import('../tarjeta-periodo.js'); } catch { toast('No se pudo crear la imagen'); return; }
  const sesiones = await H.sinMuestras();
  if (!sesiones.length) { toast('Rema una sesión y aquí podrás compartir tu avance'); return; }
  let heroe = null;
  let paisaje = null;
  let juego = null;
  let primeraSemanaPlan = null;
  try {
    const { per, h } = await estadoHeroe();
    juego = h;
    primeraSemanaPlan = h.racha?.primeraSemanaPlan ?? null;
    const clase = J.claseDe(per.clase);
    if (clase) heroe = { nombre: per.nombre || clase.nombre, linea: `${J.tituloDe(h.nivel, per.clase)} · nivel ${h.nivel}`, nivel: h.nivel, src: srcHeroe(clase.clave, h.nivel), retrato: srcHeroe(clase.clave, h.nivel, true) };
    const p = PAISAJES[paisajeElegido(per)];
    if (p?.panorama) paisaje = { src: p.panorama.src, horizonte: p.panorama.horizonte, filtro: p.filtro || null };
  } catch { /* sin héroe */ }
  const programa = leerPrograma();
  const actual = E.inicioPeriodo(Date.now(), periodo);
  const anterior = Tp.periodoAnterior(actual, periodo);
  compartir = {
    tipo: 'periodo', periodo, Tp, sesiones, actual, anterior,
    inicio: Tp.periodoSugerido(sesiones, periodo),
    opciones: { formato: '4:5', heroe: true, kcal: true }, blob: null, url: null, turno: 0,
    ctx: { juego, primeraSemanaPlan, heroe, paisaje, ftp: ftp(), estados: programa?.dias?.length ? P.estadoDias(programa, sesiones) : null },
  };
  const cual = $('#compartir-cual');
  cual.hidden = false;
  cual.querySelector('[data-cual="actual"]').textContent = periodo === 'mes' ? 'Este mes' : 'Esta semana';
  cual.querySelector('[data-cual="anterior"]').textContent = periodo === 'mes' ? 'El mes pasado' : 'La semana pasada';
  $('#compartir-heroe').checked = true;
  $('#compartir-heroe').closest('label').hidden = !heroe;
  $('#compartir-pulso').closest('label').hidden = true;
  $('#compartir-kcal').checked = true;
  $('#compartir-img').alt = periodo === 'mes' ? 'Vista previa de la imagen de tu mes' : 'Vista previa de la imagen de tu semana';
  $('#compartir-dialogo').hidden = false;
  pintarCompartir();
}

// Rehace la imagen con lo elegido; si cambias algo mientras se pinta, gana lo último.
async function pintarCompartir() {
  const c = compartir;
  if (!c) return null;
  for (const b of document.querySelectorAll('#compartir-formatos [data-formato]')) b.setAttribute('aria-checked', String(b.dataset.formato === c.opciones.formato));
  if (c.tipo === 'periodo') for (const b of document.querySelectorAll('#compartir-cual [data-cual]')) b.setAttribute('aria-checked', String((b.dataset.cual === 'actual' ? c.actual : c.anterior) === c.inicio));
  const turno = ++c.turno;
  c.blob = null;
  c.listo = (async () => {
    const s = c.s;
    const { tarjetaSesion, tarjetaPeriodo } = await import('../tarjeta-imagen.js');
    const blob = c.tipo === 'periodo'
      ? await tarjetaPeriodo(c.Tp.contenidoPeriodo(c.sesiones, c.periodo, c.inicio, c.opciones, c.ctx), { formato: c.opciones.formato })
      : await tarjetaSesion(c.Tj.contenidoTarjeta(s, c.opciones, c.ctx), {
        formato: c.opciones.formato,
        fecha: new Date(s.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        puntos: (s.muestras || []).map((x) => [x.t, x.w]),
      });
    if (turno !== c.turno || compartir !== c) return null;
    if (c.url) URL.revokeObjectURL(c.url);
    c.blob = blob;
    c.url = URL.createObjectURL(blob);
    const img = $('#compartir-img');
    img.src = c.url;
    img.dataset.vista = c.opciones.formato;
    return blob;
  })().catch(() => { toast('No se pudo crear la imagen'); return null; });
  return c.listo;
}
async function imagenCompartir() {
  const c = compartir;
  if (!c) return null;
  const blob = c.blob || await c.listo;
  if (!blob || compartir !== c) return null;
  const marca = c.tipo === 'periodo' ? `${c.periodo}-${marcaFecha(c.inicio)}` : marcaFecha(c.s.fecha);
  return { blob, nombre: `rower-${marca}-${c.opciones.formato.replace(':', 'x')}.png` };
}
// Una vez por vista previa, para que guardar y luego compartir no cuente doble en la tasa de compartir.
function anotarCompartir(como) {
  if (!compartir || compartir.anotado) return;
  compartir.anotado = true;
  if (compartir.tipo === 'periodo') Hab.anotar('compartir', { periodo: compartir.periodo, inicio: compartir.inicio, formato: compartir.opciones.formato, como });
  else Hab.anotar('compartir', { sesion: compartir.s.fecha, formato: compartir.opciones.formato, como });
}
export function cerrarCompartir() {
  if (compartir?.url) URL.revokeObjectURL(compartir.url);
  compartir = null;
  $('#compartir-cual').hidden = true;
  $('#compartir-reto-campo').hidden = true;
  $('#compartir-img').alt = 'Vista previa de la imagen de tu sesión';
  $('#compartir-img').removeAttribute('src');
  $('#compartir-dialogo').hidden = true;
}
