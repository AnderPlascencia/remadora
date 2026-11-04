// Detalle de una sesión guardada: hoja con gráficas, notas, compartir y exportar.
import { formatoSplit, formatoTiempo } from '../protocolo.js';
import { dibujar, dibujarBarras, dibujarPerfil } from '../grafica.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import { confeti } from '../efectos.js';
import * as V from '../ventajas.js';
import * as Cap from '../capacidades.js';
import {
  $, COLOR_ZONA, ajustarTexto, ajustes, color, escaparHtml, fcMaxima, fcRef, fechaCorta, formatoMeta, ftp, ico, miles, toast,
} from '../ui.js';
import { estado } from '../estado.js';
import { avanzado } from './ajustes.js';
import { guardarFtp } from './preparar.js';
import { formatoRecord } from './progreso.js';
import { pintarAtrSesion, pintarPodio, pintarXpSesion } from './heroe.js';

// ---------- Resumen / detalle de sesión ----------
const TEXTO_RPE = ['', 'Muy fácil', 'Muy fácil', 'Fácil', 'Fácil', 'Moderado', 'Moderado', 'Duro', 'Duro', 'Muy duro', 'Máximo'];

async function guardarSesionAbierta() {
  if (estado.sesionAbierta?.id != null) await H.guardar(estado.sesionAbierta);
}

// Pulso máximo para el esfuerzo: el tuyo, o 220 − edad, o 190 como aproximación.
export const fcParaEsfuerzo = () => fcMaxima() || (ajustes.num('edad', 0) ? 220 - ajustes.num('edad', 0) : 190);
let corregirRpe = false;
function pintarRpe() {
  const s = estado.sesionAbierta;
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
      if (estado.atrAbierta?.s === s) pintarAtrSesion(s, estado.atrAbierta.previas, estado.atrAbierta.resumen);
    };
  });
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarDetalle() {
  $('#in-notas').addEventListener('change', async () => {
    if (!estado.sesionAbierta) return;
    estado.sesionAbierta.notas = $('#in-notas').value.trim();
    await guardarSesionAbierta();
    toast('Nota guardada');
  });
  $('#hoja-detalle').addEventListener('toggle', () => {
    if ($('#hoja-detalle').open && estado.sesionAbierta) requestAnimationFrame(() => dibujarHojaGraficas(estado.sesionAbierta));
    if ($('#hoja-detalle').open) requestAnimationFrame(() => $('#hoja-stats').querySelectorAll('.valor').forEach((el) => ajustarTexto(el)));
  });
}

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

export function abrirSesion(s, { resumen = false, previas = [], ftpAuto = null } = {}) {
  estado.sesionAbierta = s;
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

  pintarCapacidadSesion(s);

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
  if (s.tiempoMeta != null) stats.push(['Meta en', formatoMeta(s.tiempoMeta)]);
  const parado = E.tiempoParado(s.pausas);
  if (parado >= 5) stats.push([s.pausas.length > 1 ? `Parado (${s.pausas.length} pausas)` : 'Parado', formatoTiempo(parado)]);
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
  requestAnimationFrame(() => $('#hoja-stats').querySelectorAll('.valor').forEach((el) => ajustarTexto(el)));

  corregirRpe = false;
  pintarRpe();
  $('#in-notas').value = s.notas || '';
  $('#hoja-intervalos').innerHTML = tablaIntervalos(s);
  $('#hoja-prediccion').innerHTML = tablaPrediccion(s);

  const cmp = E.compararConAnterior(s, previas);
  const fmt = (c, v) => (c.clave === 'tiempoMeta' ? formatoMeta(v) : c.clave === 'splitProm' ? formatoTiempo(v) : `${v}${c.unidad && c.unidad !== 's' ? ` ${c.unidad}` : ''}`);
  const fmtDelta = (c) => {
    if (!c.delta) return '=';
    const signo = c.delta > 0 ? '+' : '−';
    // La meta se guarda con décimas: 2.4000000001 s se ve como 2.4 s.
    const abs = Math.round(Math.abs(c.delta) * 10) / 10;
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
// Qué capacidad entrenó la sesión, sus tres datos clave y una frase que los lee.
function pintarCapacidadSesion(s) {
  const caja = $('#hoja-capacidad');
  caja.hidden = !s.muestras?.length;
  if (caja.hidden) return;
  const a = Cap.analisisSesion(s, { ftp: ftp(), fcMax: fcRef() });
  // Si tus watts no se parecen al plan (un fondo remado a tirones), se dice así y no «Entrenaste Sprints».
  const nombre = avanzado() ? a.nombre : a.simple;
  const { etiqueta, plan } = Cap.tituloCapacidad(a.tipo, s.tipoPlan);
  const cab = `<span class="etq">${etiqueta}</span><b>${nombre}</b>`;
  const aviso = plan ? `<p class="ayuda hc-plan">El plan era de ${(avanzado() ? plan.nombre : plan.simple).toLowerCase()}; abajo, lo que dicen tus watts.</p>` : '';
  caja.innerHTML = `<div class="hc-cabecera">${cab}</div>${aviso}
    <div class="metricas compacta">${a.datos.map((d) => `<div class="metrica" title="${escaparHtml(d.ayuda)}"><span class="etq">${escaparHtml(d.etq)}</span><span class="valor">${d.valor}</span></div>`).join('')}</div>
    <p class="ayuda">${a.lectura}</p>`;
}
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
      const seg = E.tiempoEnZonasFc(m, fcRef());
      dibujarBarras($('#hoja-zonas-fc'), E.ZONAS_FC.map((z, i) => ({ etiqueta: `Z${z.n}`, valor: Math.round(seg[i] / 6) / 10, resaltar: seg[i] === Math.max(...seg) })), {
        color: color('--fc'), formato: (v) => `${v} min`,
      });
    }
  }
}
