// Progreso: historial, tendencia, récords y resumen semanal.
import { formatoSplit, formatoTiempo } from '../protocolo.js';
import { dibujar, dibujarBarras } from '../grafica.js';
import * as db from '../db.js';
import * as E from '../estadisticas.js';
import * as P from '../programa.js';
import * as J from '../juego.js';
import * as Cap from '../capacidades.js';
import { $, ajustes, color, fcMaxima, fechaCorta, formatoMeta, ftp, ico, miles } from '../ui.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { avanzado, guardarRespaldo } from './ajustes.js';
import { horasYMin, leerPersonaje, srcHeroe } from './heroe.js';
import { abrirSesion } from './detalle.js';
import { leerPrograma } from './programa.js';

// ---------- Progreso ----------
let periodo = 'semana';

// Al arrancar la app (en orden, desde app.js).
export function arrancarProgreso() {

  document.querySelectorAll('.segmentado button').forEach((b) => b.addEventListener('click', () => {
    periodo = b.dataset.periodo;
    document.querySelectorAll('.segmentado button').forEach((x) => {
      x.classList.toggle('activo', x === b);
      x.setAttribute('aria-pressed', x === b);
    });
    pintarPeriodos();
  }));
  document.querySelectorAll('#seg-tendencia button').forEach((b) => b.addEventListener('click', () => {
    estado.tendencia = b.dataset.tend;
    document.querySelectorAll('#seg-tendencia button').forEach((x) => {
      x.classList.toggle('activo', x === b);
      x.setAttribute('aria-pressed', x === b);
    });
    pintarTendencia();
  }));
  $('#filtro-ent').addEventListener('change', () => pintarHistorial());
  $('#progreso-heroe').addEventListener('click', () => irA('heroe'));
}

export function formatoRecord(r, v) {
  if (r.tipo === 'tiempo') return formatoTiempo(v);
  return r.unidad === 'm' ? `${(v / 1000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : `${miles(v)} ${r.unidad}`;
}

function pintarPeriodos() {
  const n = periodo === 'semana' ? 8 : 6;
  const datos = E.resumenPeriodos(estado.cacheSesiones, periodo, n).map((p, i, arr) => ({
    etiqueta: periodo === 'semana' ? fechaCorta(p.inicio) : new Date(p.inicio).toLocaleDateString('es-MX', { month: 'short' }),
    valor: Math.round(p.metros / 100) / 10,
    resaltar: i === arr.length - 1,
  }));
  dibujarBarras($('#grafica-periodos'), datos, { color: color('--info'), formato: (v) => `${v}` });
  $('#grafica-periodos').setAttribute('aria-label', `Kilómetros por ${periodo}: ${datos.map((d) => `${d.etiqueta} ${d.valor}`).join(', ')}`);
}

const filtroCoincide = (s) => {
  const f = $('#filtro-ent').value;
  return f === '*' || (s.entrenamiento || '') === f;
};

export function pintarTendencia() {
  const orden = estado.cacheSesiones.filter(filtroCoincide).slice(0, 30).reverse();
  const x = (i) => i * 60;
  let series = [];
  let ley = '';
  let texto = '';
  if (estado.tendencia === 'potencia') {
    ley = '<span class="lw">Watts promedio</span><span class="lt">Split promedio (s/500 m)</span>';
    series = [
      { color: color('--watts'), eje: 'izq', puntos: orden.map((s, i) => [x(i), s.wattsProm]) },
      { color: color('--split'), eje: 'der', puntos: orden.map((s, i) => [x(i), s.splitProm]).filter(([, v]) => v > 0) },
    ];
  } else if (estado.tendencia === 'eficiencia') {
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
  dibujar($('#grafica-tendencia'), series, { sinEjeX: true, marcas: true, decimales: estado.tendencia !== 'potencia' });
}

export function pintarForma() {
  const datos = E.forma(estado.cacheSesiones, ftp(), 60);
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
    $('#forma-texto').textContent = (avanzado() ? `Condición ${hoy.condicion}, fatiga ${hoy.fatiga}, frescura ${hoy.frescura}. ${consejo}` : consejo) + textoCarga();
  }
  const textoForma = () => (hoy.frescura < -20 ? 'Cansado' : hoy.frescura > 10 ? 'Fresco' : 'Equilibrado');
  $('#forma-resumen').textContent = !(ftp() && hay) ? '' : avanzado() ? `Frescura ${hoy.frescura > 0 ? '+' : ''}${hoy.frescura}` : textoForma();
}

// Ratio agudo:crónico y reparto 80/20 de la semana, en una o dos frases.
function textoCarga() {
  const r = E.ratioCarga(estado.cacheSesiones, ftp());
  const d = E.distribucionIntensidad(estado.cacheSesiones, ftp());
  let t = '';
  if (r != null) {
    const zona = r > 1.5 ? 'muy por encima de lo seguro: baja la carga unos días' : r > 1.3 ? 'por encima de lo seguro (0,8–1,3): no subas más esta semana' : r < 0.8 ? 'por debajo de tu carga habitual: puedes subir un poco' : 'en la zona segura para progresar';
    t += avanzado() ? ` Ratio agudo:crónico ${r.toLocaleString('es-MX')}, ${zona}.` : ` Tu carga de esta semana está ${zona}.`;
  }
  if (d && d.segundos >= 1200) {
    t += avanzado() ? ` Reparto de 7 días: ${d.suave} % suave, ${d.medio} % medio, ${d.fuerte} % fuerte (lo ideal ronda 80 / 5 / 15).`
      : d.suave < 70 ? ' Esta semana casi todo fue fuerte: añade algún fondo suave.' : '';
  }
  return t;
}

// Mini gráfica (SVG) de una capacidad en las últimas semanas; se adapta al tema con currentColor.
function miniLinea(puntos) {
  const vals = puntos.map((p) => p.valor);
  const con = vals.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (con.length < 2) return '';
  const min = Math.min(...con.map(([, v]) => v));
  const max = Math.max(...con.map(([, v]) => v));
  const W = 100, H = 28;
  const x = (i) => (i / (vals.length - 1)) * W;
  const y = (v) => (max === min ? H / 2 : H - 3 - ((v - min) / (max - min)) * (H - 6));
  const d = con.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const [ui, uv] = con.at(-1);
  return `<svg class="mini-linea" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${x(ui)}" cy="${y(uv)}" r="2.5" fill="currentColor"/></svg>`;
}

// Cómo has mejorado: cada capacidad con su % frente a las 6 semanas anteriores y su evolución de 12 semanas.
// En sencillo se ve el nombre fácil y el %; con «Datos avanzados», también el valor técnico y cómo se mide.
function pintarCapacidades() {
  const opc = { ftp: ftp(), peso: ajustes.num('peso', 75), fcMax: fcMaxima() };
  const caps = Cap.capacidades(estado.cacheSesiones, opc);
  const hist = Cap.historialCapacidades(estado.cacheSesiones, opc);
  const fmt = (c, v) => (c.unidad === 'm/palada' ? v.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : c.unidad === 'ml/kg/min' || c.unidad === 'kJ' ? v.toLocaleString('es-MX', { minimumFractionDigits: 1 }) : miles(v));
  $('#capacidades').innerHTML = caps.map((c) => {
    const titulo = avanzado() ? c.nombre : c.simple;
    const sub = avanzado() || c.nombre === c.simple ? '' : `<span class="tecnico">${c.nombre}</span>`;
    if (c.valor == null) return `<div class="capacidad vacia"><div class="etq">${titulo}${sub}</div><div class="sub">${c.falta}</div></div>`;
    const pct = c.pct == null ? '<span class="igual">Nueva</span>'
      : c.pct === 0 ? '<span class="igual">= igual</span>'
        : `<span class="${c.pct > 0 ? 'mejor' : 'peor'}">${c.pct > 0 ? '▲ +' : '▼ '}${c.pct}%</span>`;
    const valor = `<div class="sub solo-avanzado">${fmt(c, c.valor)} ${c.unidad} · ${c.como}</div>`;
    return `<details class="capacidad ${c.pct > 0 ? 'sube' : c.pct < 0 ? 'baja' : ''}"><summary><div class="etq">${titulo}${sub}</div>
      <div class="valor">${pct}</div>${miniLinea(hist[c.clave])}${valor}</summary>
      <div class="sub como-subir">Para subirla: ${c.entrena.toLowerCase()}.</div></details>`;
  }).join('');
  const suben = caps.filter((c) => c.mejora).length;
  $('#capacidades-resumen').textContent = suben ? `${suben} ${suben === 1 ? 'sube' : 'suben'}` : '';
}

// Tu cuerpo hoy: semáforo de fatiga, horas hasta estar recuperado, consejo y carga de la semana contra tu rango seguro.
function pintarCuerpoHoy() {
  const caja = $('#cuerpo-hoy');
  const c = ftp() ? Cap.estadoCuerpo(estado.cacheSesiones, ftp()) : null;
  caja.hidden = !c;
  if (!c) return;
  caja.dataset.estado = c.clave;
  $('#cuerpo-estado').textContent = c.nombre;
  $('#cuerpo-recuperacion').textContent = Cap.textoRecuperacion(c.horas);
  $('#cuerpo-consejo').textContent = c.consejo + (avanzado() ? ` Condición ${c.condicion}, fatiga ${c.fatiga}, frescura ${c.frescura > 0 ? '+' : ''}${c.frescura}.` : '');
  const barra = (etq, valor, max, zona, nota) => `<div class="tm-fila"><span>${etq}</span><span>${nota}</span></div>
    <div class="ch-barra">${zona ? `<i class="ch-zona" style="left:${zona[0]}%;width:${zona[1] - zona[0]}%"></i>` : ''}<b style="width:${Math.min(100, valor)}%"></b></div>`;
  if (c.seguro) {
    const tope = c.seguro.max * 1.4;
    const pos = (v) => Math.round((100 * v) / tope);
    const zona = c.semana > c.seguro.max ? 'Pasada: baja unos días' : c.semana < c.seguro.min ? 'Puedes subir un poco' : 'En tu zona segura';
    $('#cuerpo-carga').innerHTML = barra('Esfuerzo de 7 días', pos(c.semana), 100, [pos(c.seguro.min), pos(c.seguro.max)], avanzado() ? `${c.semana} TSS · ratio ${c.ratio.toLocaleString('es-MX')}` : zona);
  } else $('#cuerpo-carga').innerHTML = '<p class="ayuda">Con 4 semanas de sesiones te diré cuánto esfuerzo aguantas sin pasarte.</p>';
  const r = c.reparto;
  $('#cuerpo-reparto').innerHTML = r && r.segundos >= 600
    ? barra('Suave (7 días)', r.suave, 100, [75, 85], r.suave < 70 ? 'Poco suave: añade un fondo' : `${r.suave}% (ideal cerca de 80%)`)
    : '';
}

// Curva de potencia: eje X por duraciones (5 s … 60 min), últimas 6 semanas contra lo anterior.
export function pintarCurva() {
  const { ahora, antes } = Cap.curvasComparadas(estado.cacheSesiones);
  const idx = (segs) => E.DURACIONES_CURVA.indexOf(segs);
  const etq = (segs) => (segs < 60 ? `${segs} s` : `${segs / 60} min`);
  dibujar($('#grafica-curva'), [
    { color: color('--watts'), eje: 'izq', puntos: ahora.map((p) => [idx(p.segs), p.w]) },
    { color: color('--split'), eje: 'izq', puntos: antes.map((p) => [idx(p.segs), p.w]) },
  ], { marcas: true, formatoX: (t) => etq(E.DURACIONES_CURVA[Math.round(t)] ?? 5) });
  const pc = E.potenciaCritica(ahora);
  $('#curva-texto').textContent = !ahora.length ? 'Rema unas sesiones para ver tu curva.'
    : pc && !avanzado() ? `Tu mejor media para cada duración. Puedes aguantar unos ${pc.cp} W casi sin cansarte; por encima gastas tu batería, que llega para unos ${Math.round(pc.wPrima / Math.max(1, pc.cp * 0.2))} s a ${Math.round(pc.cp * 1.2)} W.`
    : pc ? `Tu potencia crítica es ${pc.cp} W y tu batería anaeróbica (W′) ${(pc.wPrima / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} kJ. Por encima de ${pc.cp} W la gastas; por debajo se recarga.`
      : 'Cada punto es tu mejor media para esa duración. Con marcas de 3 y 12 min calculo tu potencia crítica.';
}

// Mi motor: watts a un pulso fijo (70 % del máximo), semana a semana. Si suben, el corazón rinde más.
export function pintarMotor() {
  const fcRef = fcMaxima() ? Math.round(fcMaxima() * 0.7) : 0;
  const datos = Cap.motorSemanal(estado.cacheSesiones, fcRef);
  dibujarBarras($('#grafica-motor'), datos.map((d, i) => ({ etiqueta: fechaCorta(d.inicio), valor: d.w || 0, resaltar: i === datos.length - 1 })), { color: color('--fc'), formato: (v) => `${v}` });
  const con = datos.filter((d) => d.w);
  $('#motor-resumen').textContent = con.length ? `${con.at(-1).w} W` : '';
  $('#motor-texto').textContent = !fcRef ? 'Pon tu edad en Ajustes › Pulso y zonas para medir tu motor.'
    : con.length < 2 ? `Watts que mueves a ${fcRef} lpm. Rema fondos con el reloj para ver cómo cambian.`
      : `Watts que mueves a ${fcRef} lpm. ${con.at(-1).w > con[0].w ? 'Suben: tu corazón rinde más con el mismo esfuerzo.' : 'Para que suban, suma fondos suaves en zona 2.'}`;
}

// Calorías por semana, con el promedio de las 4 anteriores.
export function pintarGasto() {
  const datos = Cap.gastoSemanal(estado.cacheSesiones);
  dibujarBarras($('#grafica-gasto'), datos.map((d, i) => ({ etiqueta: fechaCorta(d.inicio), valor: d.kcal, resaltar: i === datos.length - 1 })), { color: color('--primario'), formato: (v) => miles(v) });
  const esta = datos.at(-1).kcal;
  const prom = Math.round(datos.slice(-5, -1).reduce((a, d) => a + d.kcal, 0) / 4);
  const meta = P.metaKcalDe(leerPrograma());
  $('#gasto-resumen').textContent = meta ? `${miles(esta)} de ${miles(meta)} kcal` : `${miles(esta)} kcal`;
  $('#gasto-texto').textContent = meta ? `Meta de tu plan esta semana: ${miles(meta)} kcal${esta >= meta ? '. ¡Cumplida!' : `; te faltan ${miles(meta - esta)}`}.`
    : prom ? `Esta semana ${miles(esta)} kcal; tu promedio es ${miles(prom)}.` : 'Tus calorías de cada semana aparecerán aquí.';
}

export function pintarAvisoRespaldo(total) {
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

let sesionesVisibles = 10;
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
    <span class="ph-texto"><b><span class="sin-corte">Nivel ${h.nivel}</span> · <span class="sin-corte">${h.titulo}</span></b><small><span class="sin-corte">+${miles(esta.xp)} XP esta semana,</span> <span class="sin-corte">la pasada +${miles(pasada.xp)}</span></small></span>
    <span class="ph-barras-caja"><span class="ph-barras" role="img" aria-label="XP por semana, últimas 8 semanas">${semanas.map((x, i) => `<i class="${i === 7 ? 'actual' : ''}" style="height:${Math.max(4, (100 * x.xp) / max)}%" title="${fechaCorta(x.desde)}: ${miles(x.xp)} XP"></i>`).join('')}</span><small aria-hidden="true">XP · 8 semanas</small></span>
    <span aria-hidden="true">›</span>`;
}

export async function pintarHistorial() {
  const lista = (await db.listar('sesiones')).sort((a, b) => b.fecha - a.fecha);
  estado.cacheSesiones = lista;
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
  // Las sesiones van junto a «Esta semana» para que los km quepan enteros a la derecha.
  $('#semana-etq').textContent = `Esta semana · ${semana.sesiones} ${semana.sesiones === 1 ? 'sesión' : 'sesiones'}`;
  $('#semana-texto').textContent = `${km.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} de ${miles(meta)} km${km >= meta ? ' ✓' : ''}`;
  $('#semana-barra').style.width = `${Math.min(100, (100 * km) / meta)}%`;
  pintarAvisoRespaldo(lista.length);
  pintarHeroeProgreso(lista);
  pintarPeriodos();
  pintarForma();
  pintarCuerpoHoy();
  pintarCapacidades();
  for (const [sec, fn] of [['curva', pintarCurva], ['motor', pintarMotor], ['gasto', pintarGasto]]) {
    if (document.querySelector(`details[data-seccion="${sec}"]`).open) fn();
  }

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
  // Cuatro récords a la vista; el resto, al tocar «Ver todos».
  const PRINCIPALES = ['t2000', 't500', 'w20', 'dist'];
  const hay = E.RECORDS.filter((r) => recs[r.clave]).sort((a, b) => (PRINCIPALES.indexOf(a.clave) + 1 || 9) - (PRINCIPALES.indexOf(b.clave) + 1 || 9));
  const tarjeta = (r) => `<div class="record"><div class="etq">${r.nombre}</div>
    <div class="valor">${formatoRecord(r, recs[r.clave].valor)}</div><div class="sub">${fechaCorta(recs[r.clave].fecha)}</div></div>`;
  $('#records').innerHTML = hay.slice(0, 4).map(tarjeta).join('');
  $('#records-mas').hidden = hay.length <= 4;
  $('#records-resto').innerHTML = hay.slice(4).map(tarjeta).join('');
  $('#records-mas-texto').textContent = `Ver los ${hay.length} récords`;

  $('#historial-resumen').textContent = lista.length ? `${miles(lista.length)} ${lista.length === 1 ? 'sesión' : 'sesiones'}` : '';
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
    if (s.rpe) li.querySelector('.titulo').insertAdjacentHTML('beforeend', `<span class="rpe-chip solo-avanzado">Esfuerzo ${s.rpe}</span>`);
    li.querySelector('.suave').textContent = `${formatoTiempo(s.duracion)} · ${miles(s.distancia)} m · ${s.wattsProm} W · ${formatoSplit(s.splitProm)} /500 m${s.tiempoMeta != null ? ` · meta en ${formatoMeta(s.tiempoMeta)}` : ''}${s.notas ? ` · “${s.notas.slice(0, 40)}${s.notas.length > 40 ? '…' : ''}”` : ''}`;
    li.addEventListener('click', () => abrirSesion(s, { previas: lista.filter((x) => x.id !== s.id && x.fecha < s.fecha) }));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') li.click(); });
    ul.append(li);
  }
  const quedan = visibles.length - sesionesVisibles;
  if (quedan > 0) {
    const li = document.createElement('li');
    li.className = 'separador-plan';
    li.innerHTML = `<button type="button" class="boton">Ver ${Math.min(20, quedan)} más (quedan ${miles(quedan)})</button>`;
    li.querySelector('button').addEventListener('click', () => { sesionesVisibles += 20; pintarHistorial(); });
    ul.append(li);
  }
}
