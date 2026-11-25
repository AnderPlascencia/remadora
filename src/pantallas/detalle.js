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
  $, COLOR_ZONA, ajustarTexto, ajustes, color, escaparHtml, fcMaxima, fcRef, fechaCorta, formatoMeta, ftp, ico, miles, perfil, toast,
} from '../ui.js';
import { estado } from '../estado.js';
import { fcMaxDeEdad } from '../pulso.js';
import * as Pf from '../perfil.js';
import { aplicarEdad, avanzado, pintarPerfil } from './ajustes.js';
import { guardarFtp } from './preparar.js';
import { formatoRecord } from './progreso.js';
import { hitoSesion, leerPersonaje, pintarAtrSesion, pintarPodio, pintarXpSesion } from './heroe.js';

// ---------- Resumen / detalle de sesión ----------
// Escala CR10: los cinco botones grandes caen en 2, 4, 6, 8 y 10 con el mismo nombre.
const TEXTO_RPE = ['', 'Muy fácil', 'Fácil', 'Fácil', 'Moderado', 'Moderado', 'Duro', 'Duro', 'Muy duro', 'Muy duro', 'Máximo'];
const RPE_GRANDE = [[2, 'Fácil'], [4, 'Moderado'], [6, 'Duro'], [8, 'Muy duro'], [10, 'Máximo']];

async function guardarSesionAbierta() {
  if (estado.sesionAbierta?.id != null) await H.guardar(estado.sesionAbierta);
}

// Pulso máximo para el esfuerzo: el tuyo, o el de tu edad (Tanaka), o 190 como aproximación.
export const fcParaEsfuerzo = () => fcMaxima() || fcMaxDeEdad(ajustes.num('edad', 0)) || 190;
// Esfuerzo: lo marcas tú (1–10). Si la sesión tiene pulso, el esfuerzo según el pulso va como sugerencia aparte.
function pintarRpe() {
  const s = estado.sesionAbierta;
  const tuyo = E.rpeSentido(s);
  const pulso = E.rpePulsoDe(s);
  $('#hoja-esfuerzo-titulo').textContent = '¿Qué tan duro se sintió?';
  $('#rpe-auto').hidden = !pulso;
  if (pulso) {
    $('#rpe-auto').innerHTML = `<b class="rpe-valor">${pulso}</b><span>de 10 según tu pulso · ${TEXTO_RPE[pulso]}<small>Pulso medio al ${s.rpePct} % de tu máximo${fcMaxima() ? '' : ' (aproximado: pon tu edad en Ajustes › Pulso y zonas)'}. Es una sugerencia: marca abajo cómo lo sentiste tú.</small></span>`;
  }
  $('#rpe').hidden = false;
  // Cinco botones grandes que se guardan en la escala CR10 (2, 4, 6, 8 y 10); «Afinar» da el 1 a 10 entero.
  const grande = tuyo ? Math.min(10, Math.ceil(tuyo / 2) * 2) : null;
  $('#rpe').innerHTML = RPE_GRANDE.map(([v, t]) => `<button type="button" class="boton rpe-grande${grande === v ? ' activo' : ''}" data-rpe="${v}" aria-pressed="${grande === v}"><span>${t}</span><small>${v}</small></button>`).join('');
  $('#rpe-fino').innerHTML = Array.from({ length: 10 }, (_, i) => `<button type="button" class="boton${tuyo === i + 1 ? ' activo' : ''}" data-rpe="${i + 1}" aria-pressed="${tuyo === i + 1}">${i + 1}</button>`).join('');
  // Tras una sesión dura sin tu esfuerzo, se pide destacado: es lo que deja subir tus rangos del plan (E17).
  const pide = Cap.pideEsfuerzo(s, s.ftp || ftp());
  $('#hoja-esfuerzo').classList.toggle('pide', pide);
  // Sin nada que decir (aún sin marcar y no era dura), la línea se calla: deja sitio para tu héroe (UX2-15).
  $('#rpe-texto').textContent = tuyo ? `${tuyo} de 10: ${TEXTO_RPE[tuyo]}`
    : pide ? 'Un toque basta: en las sesiones duras, tu esfuerzo decide si suben tus rangos del plan.' : '';
  $('#rpe-texto').hidden = !$('#rpe-texto').textContent;
  document.querySelectorAll('#rpe button, #rpe-fino button').forEach((b) => {
    b.onclick = async () => {
      // Una sesión de antes con el esfuerzo del pulso en `rpe`: ese pasa a rpePulso y el tuyo queda en rpe.
      if (s.rpeFuente === 'pulso') { s.rpePulso ??= s.rpe; delete s.rpeFuente; }
      s.rpe = Number(b.dataset.rpe);
      pintarRpe();
      await guardarSesionAbierta();
      if (estado.atrAbierta?.s === s) pintarAtrSesion(s, estado.atrAbierta.previas, estado.atrAbierta.resumen);
    };
  });
}

// Al arrancar la app (en orden, desde app.js).
// Los oyentes se ponen al cargar el módulo (ya no va en la primera carga: ronda 2, QA-F4).
let arrancado = false;
export function arrancarDetalle() {
  if (arrancado) return;
  arrancado = true;
  arrancarPerfilPorPartes();
  // El hito de la sesión abre la misma imagen para compartir, ya con su plantilla.
  $('#btn-hito-compartir').addEventListener('click', () => $('#btn-compartir-img').click());
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
  // Etapa 17: con una marca a tope, lo que predecía la app y su error (en Datos avanzados).
  const acierto = avanzado() && s.predicciones?.length
    ? s.predicciones.map((p) => `<p class="ayuda prediccion-error">${escaparHtml(E.textoPrediccion(p, formatoTiempo))}</p>`).join('') : '';
  return acierto + tablaPrediccionPaul(s);
}
// Etapa 18: tus tiempos estimados con el motor único (estadisticas.js), con lo remado hasta esta sesión y un rango.
function tablaPrediccionPaul(s) {
  const hasta = [...(estado.cacheSesiones || []).filter((x) => x.fecha < s.fecha && x.id !== s.id), s];
  const op = { peso: perfil().peso, ahora: s.fecha + 1, error: E.resumenPredicciones(hasta)?.mape ?? null };
  const pc = E.perfilDe(hasta, op);
  const est = (d) => E.estimar(hasta, d, { ...op, pc });
  const dist = (d) => (d === 21097 ? 'Medio maratón' : d >= 1000 ? `${d / 1000} km` : `${d} m`);
  if (!avanzado()) {
    const d = [2000, 5000].find((x) => est(x));
    const e = d && est(d);
    return e ? `<p class="prediccion-corta">Tus ${dist(d)} estimados: <b>${formatoTiempo(e.t)}</b> (entre ${formatoTiempo(e.bajo)} y ${formatoTiempo(e.alto)}).</p>` : '';
  }
  const filas = Ent.DISTANCIAS_PREDICCION.map((d) => [d, est(d)]).filter(([, e]) => e).map(([d, e]) => `<tr><td>${dist(d)}</td><td>${formatoTiempo(e.t)}<small class="rango-pred"> ${formatoTiempo(e.bajo)}–${formatoTiempo(e.alto)}</small></td><td>${formatoSplit(Math.round((e.t * 500) / d))}</td></tr>`).join('');
  if (!filas) return '';
  const de = pc ? `Con tu curva de potencia: CP ${pc.cp} W y W′ ${(pc.wPrima / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} kJ${pc.estimada ? ' (estimada)' : ''}. Donde ya tienes marca de los últimos 90 días, manda tu marca.` : 'Con tus marcas de los últimos 90 días (ley de Paul).';
  return `<div class="prediccion"><h2>Tus tiempos estimados</h2><p class="ayuda">${de}</p>
    <table><thead><tr><th>Distancia</th><th>Tiempo</th><th>Split</th></tr></thead><tbody>${filas}</tbody></table></div>`;
}

// Perfil por partes (etapa 20): la bienvenida ya no lo pide; tras tus primeras sesiones, solo edad y peso, que es lo
// que cambia tus calorías y tu pulso máximo. «Ahora no» no vuelve a preguntar; el resto queda en Ajustes › Tu perfil.
function pintarPerfilPorPartes(resumen, previas) {
  const p = perfil();
  const caja = $('#hoja-tu-perfil');
  caja.hidden = !Pf.pedirEnResumen({ resumen, previas: previas.length, edad: p.edad, peso: p.peso, descartado: ajustes.si('perfilPorPartesNo', false) });
  $('#hoja-notas-titulo').textContent = caja.hidden ? 'Notas' : 'Notas · tu edad y peso';
  if (caja.hidden) return;
  $('#hp-edad').value = p.edad || '';
  $('#hp-peso').value = p.peso || '';
}
function numeroCampo(el) {
  const v = Number(el.value);
  return el.value.trim() !== '' && Number.isFinite(v) && v >= Number(el.min) && v <= Number(el.max) ? Math.round(v) : null;
}
function arrancarPerfilPorPartes() {
  $('#hp-guardar').addEventListener('click', () => {
    const edad = numeroCampo($('#hp-edad'));
    const peso = numeroCampo($('#hp-peso'));
    if (edad == null && peso == null) { toast('Escribe tu edad o tu peso'); return; }
    if (edad != null) ajustes.escribir('edad', String(edad));
    if (peso != null) ajustes.escribir('peso', String(peso));
    aplicarEdad();
    pintarPerfil();
    $('#hoja-tu-perfil').hidden = true;
    toast('Guardado en tu perfil');
  });
  $('#hp-no').addEventListener('click', () => { ajustes.escribir('perfilPorPartesNo', '1'); $('#hoja-tu-perfil').hidden = true; });
}

export function abrirSesion(s, { resumen = false, previas = [], ftpAuto = null } = {}) {
  estado.sesionAbierta = s;
  const hoja = $('#hoja');
  hoja.hidden = false;
  hoja.querySelector('.hoja').scrollTop = 0;
  const f = new Date(s.fecha);
  $('#hoja-titulo').textContent = resumen ? '¡Sesión terminada!' : (s.entrenamiento || 'Remo libre');
  // Al terminar, la primera línea es lo hecho: qué, cuánto tiempo, cuántos metros y a qué ritmo.
  const hecho = [s.entrenamiento || 'Remo libre', formatoTiempo(s.duracion || 0), s.distancia ? `${miles(s.distancia)} m` : '', s.splitProm ? `${formatoSplit(s.splitProm)}/500` : ''].filter(Boolean).join(' · ');
  if (resumen) $('#hoja-sub').textContent = hecho;
  else $('#hoja-sub').textContent = `${f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}, ${f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;

  const recs = E.nuevosRecords(s, previas);
  $('#hoja-records').innerHTML = recs.map((r) => `<div class="record nuevo"><div class="etq">${ico('i-trofeo')}${resumen ? 'Nuevo récord' : 'Récord'}</div>
    <div class="valor">${formatoRecord(r, r.valor)}</div><div class="sub">${r.nombre}${r.anterior != null ? ` · antes ${formatoRecord(r, r.anterior)}` : ''}</div></div>`).join('');
  // «Semana perfecta» sale de las semanas del plan cumplidas (el juego las cobra con la primera sesión de la semana
  // siguiente), así que se mira el estado del juego antes y después de esta sesión.
  const semanaPlan = (lista) => ({ primeraSemanaPlan: H.estadoJuegoDe(lista, { ftp: ftp(), per: leerPersonaje() }).racha?.primeraSemanaPlan ?? null });
  const antes = resumen ? new Set(E.insignias(previas, semanaPlan(previas)).filter((x) => x.ganada).map((x) => x.clave)) : new Set();
  const medallas = resumen ? E.insignias([...previas, s], semanaPlan([...previas, s])).filter((x) => x.ganada && !antes.has(x.clave)) : [];
  $('#hoja-records').insertAdjacentHTML('beforeend', medallas.map((x) => `<div class="record nuevo"><div class="etq">${ico('i-trofeo')}Nueva insignia</div>
    <div class="valor">${x.nombre}</div><div class="sub">${x.detalle}</div></div>`).join(''));
  const gano = !s.carreraSinTerminar && (s.rivales || (s.rival ? [s.rival] : [])).some((r) => r.diferencia > 0);
  pintarPodio(s);
  const subio = pintarXpSesion(s, previas, resumen);
  // Compártelo en el momento justo (etapa 21): tras un hito, el botón sale arriba; las sesiones normales no insisten.
  $('#hoja-hito').hidden = true;
  if (resumen) {
    hitoSesion(s, previas).then((hito) => {
      if (!hito || estado.sesionAbierta !== s) return;
      $('#hoja-hito-texto').textContent = hito.boton;
      $('#hoja-hito').hidden = false;
    }).catch(() => { /* sin hito */ });
  }
  pintarAtrSesion(s, previas, resumen);
  if (resumen && (recs.length || medallas.length || gano || subio)) setTimeout(confeti, 250);

  const hojaFtp = $('#hoja-ftp');
  // Sin prueba, el FTP solo se propone subir con la mediana de tus 3 mejores sesiones de los últimos 90 días
  // (esta incluida): un día bueno o un dato raro de la consola no lo infla.
  const sugerido = !s.pruebaWatts && ftp() ? E.ftpEstimadoDe([...previas.filter((x) => x.fecha > s.fecha - 90 * 864e5), s]) : null;
  const subeFtp = sugerido && sugerido >= ftp() + 3 && E.ftpDeSesion(s) >= sugerido * 0.97;
  hojaFtp.hidden = !s.pruebaWatts && !subeFtp && !ftpAuto;
  if (ftpAuto && !s.pruebaWatts) {
    hojaFtp.innerHTML = `${ftpAuto.antes ? `Tu FTP estimado sube a <b>${ftpAuto.nuevo} W</b> (antes ${ftpAuto.antes} W).` : `Calculé tu FTP con esta sesión: <b>${ftpAuto.nuevo} W</b>.`}
      Ahora tus entrenamientos te piden watts reales. Para afinarlo, haz la Prueba FTP 20 min cuando quieras.`;
  } else if (s.pruebaWatts || subeFtp) {
    const nuevo = s.pruebaWatts ? Ent.ftpDesdePrueba(s.pruebaWatts) : sugerido;
    const origen = s.pruebaWatts ? `Promedio en la prueba: <b>${s.pruebaWatts} W</b>.` : `Con esta sesión, tus 3 mejores de los últimos 90 días dan más que tu FTP actual.`;
    hojaFtp.innerHTML = `${origen} Tu FTP estimado es <b>${nuevo} W</b>${ftp() ? ` (antes ${ftp()} W)` : ''}.
      <div class="fila-botones"><button class="boton primario" id="btn-usar-ftp">Usar ${nuevo} W como FTP</button></div>`;
    $('#btn-usar-ftp').onclick = () => {
      guardarFtp(nuevo, !s.pruebaWatts);
      ajustes.escribir('ftpRevisado', String(Date.now()));
      toast(`FTP actualizado a ${nuevo} W`);
      $('#btn-usar-ftp').disabled = true;
    };
  }

  pintarCapacidadSesion(s);
  pintarPerfilPorPartes(resumen, previas);

  const tec = E.tecnica(s);
  const carga = E.cargaDe(s, ftp(), E.factorSrpe([...previas, s], ftp()));
  const stats = [
    ['Duración', formatoTiempo(s.duracion)], ['Distancia', `${miles(s.distancia)} m`],
    ['Watts prom', s.wattsProm], ['Watts máx', s.wattsMax],
    ['Split prom', formatoSplit(s.splitProm)], ['Golpes/min', s.spmProm],
    ['Calorías', s.kcal], ['Paladas', s.paladas ?? '-'],
    ['Metros/palada', tec.metrosPorPalada != null ? `${tec.metrosPorPalada.toLocaleString('es-MX')} m` : '-'],
  ];
  if (avanzado()) stats.push(['Trabajo/palada', tec.joulesPorPalada ? `${tec.joulesPorPalada} J` : '-']);
  stats.push(['Pulso prom', s.fcProm || '-']);
  if (s.fcMax) stats.push(['Pulso máx', s.fcMax]);
  if (tec.wattsPorLatido && avanzado()) stats.push(['Watts/latido', tec.wattsPorLatido]);
  if (carga.valor != null && avanzado()) stats.push([carga.fuente === 'esfuerzo' ? 'Carga (por esfuerzo)' : 'Carga', carga.valor]);
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
  const piernas = E.piernasCansadas(s);
  $('#hoja-piernas').hidden = !piernas;
  if (piernas) $('#hoja-piernas').textContent = `Piernas cansadas: entre el minuto ${Math.round(piernas.ini / 60)} y el ${Math.round(piernas.fin / 60)} sostuviste los watts subiendo la cadencia, pero cada palada movió un ${piernas.caida} % menos. Si se repite, toca más descanso o fondos más largos y suaves.`;

  pintarRpe();
  $('#in-notas').value = s.notas || '';
  $('#hoja-notas').open = !resumen && !!s.notas;
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
  // Una sesión del plan cortada no se titula como hecha, y un fondo con el pulso alto lo dice (UX2-17).
  const { corta, zonaAlta } = Cap.lecturaHonesta(s, a.tipo, fcRef());
  const cab = corta ? `<span class="etq">Empezaste</span><b>${nombre} · ${corta.hechos} de ${corta.plan} min</b>`
    : `<span class="etq">${etiqueta}</span><b>${nombre}</b>`;
  const pulso = zonaAlta ? `<p class="ayuda hc-pulso">Tu pulso medio fue de zona ${zonaAlta.n} (${zonaAlta.nombre.toLowerCase()}); los fondos rinden más en zona 2.</p>` : '';
  const aviso = (plan && !corta ? `<p class="ayuda hc-plan">El plan era de ${(avanzado() ? plan.nombre : plan.simple).toLowerCase()}; abajo, lo que dicen tus watts.</p>` : '') + pulso;
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

arrancarDetalle();
