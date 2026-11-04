// Sesión en vivo: carrera, números grandes, modo remo, gráficas y retos durante la sesión.
import { formatoSplit, formatoTiempo } from '../protocolo.js';
import { crearGraficaVivo, dibujarAvance, dibujarPerfil } from '../grafica.js';
import { crearCarrera } from '../carrera.js';
import * as F from '../fantasma.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import { hablar } from '../voz.js';
import * as J from '../juego.js';
import * as O from '../objetos.js';
import * as V from '../ventajas.js';
import * as Cap from '../capacidades.js';
import * as A from '../adaptacion.js';
import {
  $, COLOR_ZONA, ajustarTexto, ajustes, cambiarTexto, color, escaparHtml, fcMaxima, ftp, ico, miles, reajustarTextos, toast, vibrar,
} from '../ui.js';
import { estado } from '../estado.js';
import { vistaActiva } from '../navegacion.js';
import { avanzado, selVistaRemo, textoZona } from './ajustes.js';
import { hayCarrera, pintarSelVentaja, prepararPronto, srcRetratoRango } from './preparar.js';
import {
  actual, actualizarBotones, corto, enPausa, medidas, paraPerfil, progresoActual, remadora, textoParcial, vivo,
} from './sesion.js';
import { obtenerEnt } from './planes.js';
import { leerPersonaje, srcHeroe } from './heroe.js';
import { pintarHoy } from './programa.js';

// Dos lienzos de carrera animada: el de Entrenar y el del modo remo. Tocar alterna 2D, 3D y, con el vikingo,
// la vista realista (clip renderizado en Blender de tu personaje remando).
export const carreraEnt = crearCarrera($('#carrera'));
export const carreraRemo = crearCarrera($('#mr-grafica'));
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
  if (hayCarrera() && !$('#modo-remo').hidden && vistaRemo() === 'carrera') pintarGraficaRemo(estado.sesion.t);
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarVivo1() {
  aplicarModoCarrera();
  $('#carrera').addEventListener('click', alternarCarrera);
  $('#mr-grafica').addEventListener('click', () => {
    if (Date.now() - gestoHecho < 400) return;
    if (hayCarrera() && vistaRemo() === 'carrera') alternarCarrera();
  });
}

// ---------- Pintado ----------
// Cada texto lleva una versión corta para las casillas pequeñas (vista de carrera): «Baja», «Sube», «En rango».
function textoIndicador(rango, potencia) {
  const t = (largo, corto) => `<span class="ind-largo">${largo}</span><span class="ind-corto">${corto}</span>`;
  if (rango === 'dentro') return `${ico('i-check')}${t('En rango', 'En rango')}`;
  if (rango === 'bajo') return `${ico('i-arriba')}${t(potencia ? 'Sube la potencia' : 'Sube el ritmo', 'Sube')}`;
  if (rango === 'alto') return `${ico('i-abajo')}${t(potencia ? 'Baja la potencia' : 'Baja el ritmo', 'Baja')}`;
  return '';
}

// Calentamiento, enfriamiento, fondo y demás bloques suaves: salirse del rango es un aviso (ámbar), no una alarma (rojo).
function bloqueSuave(b) {
  if (!b) return false;
  if (/calent|enfri|fondo|recupera|suave|descanso|rodaje|vuelta a la calma/i.test(b.nombre || '')) return true;
  if (b.metrica === 'ftp') return (b.max ?? b.min) <= 76;
  if (b.metrica === 'fcpct') return (b.max ?? b.min) <= 75;
  if (b.metrica === 'fc') return b.zona != null ? b.zona <= 2 : false;
  return false;
}

function marcarRango(rango, potencia = true, suave = false) {
  const caja = $('#bloque-actual');
  caja.classList.toggle('dentro', rango === 'dentro');
  caja.classList.toggle('fuera', rango === 'bajo' || rango === 'alto');
  caja.classList.toggle('suave', !!suave);
  const ind = $('#bloque-indicador');
  ind.className = `indicador ${rango || ''}`;
  ind.innerHTML = textoIndicador(rango, potencia);
  const p = $('#mr-principal');
  p.classList.remove('dentro', 'bajo', 'alto');
  if (rango) p.classList.add(rango);
  p.classList.toggle('suave', !!suave);
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
export function velocidadReciente() {
  const m = estado.sesion.muestras;
  if (m.length < 5) return actual.split > 0 ? 500 / actual.split : 0;
  const a = m[Math.max(0, m.length - 21)];
  const b = m.at(-1);
  return b.t > a.t ? (b.dist - a.dist) / (b.t - a.t) : 0;
}

// Todo lo que muestra la carrera en este segundo: textos, tono y estado para el lienzo.
export function carreraActual() {
  const t = estado.sesion.t;
  const rs = estado.sesion.rivales;
  const refs = (estado.sesion.referencias || []).map((x) => ({ etiqueta: x.etiqueta, discontinua: x.discontinua, muestras: x.muestras, nombre: x.nombre }));
  const vsRef = refs.map((x) => {
    const d = Math.round(estado.sesion.dist - E.distanciaEn(x.muestras, t));
    return `${d > 0 ? '+' : ''}${d} m vs. ${x.etiqueta.toLowerCase()}`;
  }).join(' · ');
  if (!rs.length) {
    const x = refs[0];
    const d = Math.round(estado.sesion.dist - E.distanciaEn(x.muestras, t));
    const texto = d === 0 ? `Igual que ${x.nombre.toLowerCase()}` : `${Math.abs(d)} m ${d > 0 ? 'adelante' : 'atrás'} de ${x.nombre.toLowerCase()}`;
    const tono = d > 0 ? 'adelante' : d < 0 ? 'atras' : '';
    return {
      texto, tono, proyeccion: null,
      estado: {
        t, pausa: !!enPausa() || !estado.sesion.empezo, yo: { dist: estado.sesion.dist, v: actual.split > 0 ? 500 / actual.split : 0, spm: actual.spm },
        rivales: [], referencias: refs, meta: estado.entrenamientoActivo?.objetivo?.metrica === 'distancia' ? estado.entrenamientoActivo.objetivo.valor : null,
        cabecera: [texto, refs.length > 1 ? vsRef : ''], tono,
        reloj: relojCarrera(estado.entrenamientoActivo?.objetivo?.metrica === 'distancia' ? estado.entrenamientoActivo.objetivo.valor : null, velocidadReciente(), null),
        ritmo: estado.sesion.ritmo ? { v: 500 / estado.sesion.ritmo, etiqueta: `Ritmo ${formatoSplit(estado.sesion.ritmo)}` } : null,
        yoColor: O.objeto(leerPersonaje().equipo?.bote)?.color || null,
      },
    };
  }
  const obj = estado.entrenamientoActivo?.objetivo;
  const meta = obj?.metrica === 'distancia' ? obj.valor : null;
  const extra = V.metrosVentaja(estado.sesion.ventaja);
  const miDist = estado.sesion.dist + extra;
  // Después de cruzar la meta el puesto queda fijo: cuenta quién llegó primero, no lo remado de más.
  const tm = meta != null ? estado.sesion.tiempoMeta : null;
  // Sin meta de distancia, el plan completo cierra la carrera: lo que remes después no cuenta.
  const cierre = meta == null && estado.entrenamientoActivo ? estado.sesion.tiempoMeta : null;
  const difs = rs.map((r) => {
    if (cierre != null) return E.distanciaEn(estado.sesion.muestras, cierre) + extra - E.distanciaEn(r.muestras, cierre);
    if (tm == null) return miDist - E.distanciaEn(r.muestras, t);
    const tr = F.tiempoA(r, meta);
    return tr != null && tr < tm ? E.distanciaEn(estado.sesion.muestras, tr) + extra - meta : meta + extra - E.distanciaEn(r.muestras, tm);
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
  const tono = estado.sesion.salida && !estado.sesion.salida.hecha ? '' : rs.length > 1 ? (lugar === 1 ? 'adelante' : lugar === rs.length + 1 ? 'atras' : '') : (dif > 0 ? 'adelante' : dif < 0 ? 'atras' : '');

  // Diferencia en segundos con el primer fantasma: cuánto tardó él en llegar a donde estás tú.
  let l1 = texto;
  const tr = F.tiempoA(r, miDist);
  if (rs.length === 1 && estado.sesion.dist > 20 && tr != null && Math.abs(dif) >= 1) {
    const seg = Math.round(t - tr);
    if (seg !== 0) l1 = `${Math.abs(dif)} m ${dif > 0 ? 'adelante' : 'atrás'} · ${Math.abs(seg)} s`;
  } else if (rs.length === 1 && dif === 0) l1 = 'Empatados';
  else if (rs.length > 1) l1 = `${lugar}º de ${rs.length + 1} · ${dif > 0 ? '+' : ''}${dif} m vs. ${quien.replace(/^fantasma /, '')}`;

  const sal = estado.sesion.salida;
  const calentandoCarrera = !!(sal && !sal.hecha);
  if (calentandoCarrera) {
    // Calentando: todos a tu par; lo que importa es cuánto falta para la salida.
    // El tiempo que falta ya lo marca el reloj del intervalo: aquí no se repite (y no se desfasa un segundo).
    texto = 'Calentamiento · los fantasmas van a tu lado';
    l1 = 'En la salida';
  }
  const v = velocidadReciente();
  const p = estado.sesion.empezo && t >= 10 ? F.proyectar({ t, dist: miDist, v }, rs, { meta, duracion: duracionCarrera() }) : null;
  let l2 = '';
  if (p?.tipo === 'duracion') l2 = `Al final ≈ ${miles(Math.round(p.miDist))} m`;
  if (extra >= 1) l2 = `${l2 ? `${l2} · ` : ''}Ventaja +${Math.round(extra)} m`;
  if (vsRef) l2 = `${l2 ? `${l2} · ` : ''}${vsRef}`;
  const lienzo = {
    t,
    pausa: !!enPausa() || !estado.sesion.empezo,
    yo: { dist: miDist, v: actual.split > 0 ? 500 / actual.split : 0, spm: actual.spm },
    rivales: rs.map((x) => ({
      nombre: corto(x.nombre), color: x.color, muestras: x.muestras, spmEn: (tt) => F.spmEn(x, tt), clase: x.clase || null,
      retrato: x.clase && x.rango ? srcRetratoRango(x.clase, x.rango) : null,
      aviso: estado.sesion.ventaja?.objeto === 'mapa' ? V.proximoAceleron(x, t) : null,
    })),
    referencias: refs,
    meta,
    cabecera: [l1, l2],
    // Calentando no hay puestos: la cabecera dice cuánto falta para la salida.
    lugar: calentandoCarrera ? null : lugar, total: rs.length + 1, cercanos: cercanos(rs, difs, miDist, t),
    reloj: calentandoCarrera ? { ...relojCarrera(meta, v, p), lugar: null } : relojCarrera(meta, v, p),
    yoClase: J.claseDe(leerPersonaje().clase)?.clave || null,
    yoRetrato: estado.sesion.retrato,
    ventajaM: extra,
    eventos: estado.sesion.eventosCarrera,
    tono,
    ritmo: estado.sesion.ritmo ? { v: 500 / estado.sesion.ritmo, etiqueta: `Ritmo ${formatoSplit(estado.sesion.ritmo)}` } : null,
    yoColor: O.objeto(leerPersonaje().equipo?.bote)?.color || null,
  };
  return { texto, tono, estado: lienzo, proyeccion: p };
}

// Tiempo que llevas y el que falta a tu ritmo actual (con tus metros reales, sin la ventaja).
function relojCarrera(meta, v, p) {
  const t = estado.sesion.t;
  let falta = null;
  if (meta) {
    if (estado.sesion.dist >= meta) falta = 0;
    else if (estado.sesion.empezo && t >= 10 && v > 0) falta = Math.round((meta - estado.sesion.dist) / v);
  } else {
    const dur = duracionCarrera();
    if (dur && estado.entrenamientoActivo) falta = Math.max(0, dur - t);
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
export async function retratoPropio() {
  const per = leerPersonaje();
  const c = per.clase ? J.claseDe(per.clase) : null;
  if (!c) return null;
  const h = H.estadoJuegoDe(await H.sesiones(), { ftp: ftp(), per });
  return srcHeroe(c.clave, h.nivel || 1, true);
}

// Duración de la carrera para proyectar cuando la meta no es una distancia.
export function duracionCarrera() {
  const ent = estado.entrenamientoActivo;
  if (ent && Ent.tipoDe(ent) === 'intervalos' && Ent.soloTiempo(ent)) return Ent.duracionTotal(ent);
  // En remo libre contra fantasmas simulados no hay un final que proyectar.
  if (!ent && estado.sesion.rivales.every((r) => r.sintetico)) return null;
  return Math.max(...estado.sesion.rivales.map((r) => r.muestras.at(-1)?.t || 0));
}

export function pintar() {
  const t = estado.sesion ? estado.sesion.t : 0;
  // Sin sesión, distancia y tiempo en 0: antes la distancia de la consola corría con el tiempo parado.
  const dist = estado.sesion ? Math.round(estado.sesion.dist) : 0;
  const f = ftp();
  const zona = Ent.zonaDe(actual.watts, f);
  const zfc = E.zonaFc(actual.fc, ajustes.num('fcMax', 0));
  $('#m-watts').textContent = actual.watts;
  $('#m-nivel-etq').textContent = actual.nivel && avanzado() ? `· resistencia ${actual.nivel}` : '';
  $('#m-zona').textContent = zona ? textoZona(zona) : '';
  $('#m-zona').style.color = zona ? COLOR_ZONA[zona.n - 1] : '';
  cambiarTexto($('#m-split'), formatoSplit(actual.split));
  $('#m-spm').textContent = actual.spm;
  $('#m-tiempo').textContent = formatoTiempo(t);
  $('#m-dist').textContent = dist;
  $('#m-paladas').textContent = estado.sesion ? Math.round(estado.sesion.paladas) : 0;
  $('#m-kcal').textContent = estado.sesion ? Math.round(estado.sesion.kcal) : 0;
  $('#m-fc').textContent = actual.fc || '—';
  $('#m-fc-zona').textContent = zfc ? `lpm · Z${zfc.n} ${zfc.nombre}` : 'lpm';
  $('#m-fc-zona').style.color = zfc ? COLOR_ZONA[zfc.n] : '';
  $('#m-mpp').textContent = estado.sesion && estado.sesion.paladas >= 5 ? `${(estado.sesion.dist / estado.sesion.paladas).toFixed(1)} m/palada` : '— m/palada';
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
    auto: estado.sesion?.empezo ? 'En pausa: empieza a remar para continuar' : 'Listo: el tiempo empieza con tu primera palada',
    conexion: 'Sin conexión con la remadora: la sesión está en pausa',
  }[pausa] || '';

  // Modo remo
  $('#mr-watts').textContent = actual.watts;
  cambiarTexto($('#mr-split'), formatoSplit(actual.split));
  pintarCasillasRemo(t, dist, zfc);
  pintarEstimadoFin(t);
  if (!$('#modo-remo').hidden && vistaRemo() === 'rango') pintarRango();
  $('#mr-estado').textContent = $('#pausa-aviso').textContent;
  pintarRival();

  if (estado.sesion && estado.entrenamientoActivo) {
    if (Ent.tipoDe(estado.entrenamientoActivo) === 'objetivo') pintarObjetivo(t);
    else pintarBloque(t);
  } else if (estado.sesion) {
    $('#mr-nombre').textContent = 'Remo libre';
    $('#mr-meta-texto').textContent = zona ? textoZona(zona) : '';
    $('#mr-resta').textContent = formatoTiempo(t);
    $('#mr-resta-etq').textContent = 'tiempo';
    $('#mr-barra').style.width = '0%';
    marcarRango(null);
  }
  if (vistaActiva('entrenar')) dibujarVivo();
  if (!$('#modo-remo').hidden && vistaGrafica()) pintarGraficaRemo(t);
  ajustarNumeros();
}

// Casillas con números que crecen a lo largo de la sesión: se achican si ya no caben.
const NUMEROS_VIVOS = '#en-vivo .metrica .valor, #modo-remo .mr-valor, #modo-remo .mr-fin-c, #mr-watts, #mr-resta, #mr-rango-valor';
let numerosVivos = null;
export function ajustarNumeros() {
  numerosVivos ||= [...document.querySelectorAll(NUMEROS_VIVOS)];
  // El «fin ≈» no baja tanto: si aún no cabe se corta con «…».
  for (const el of numerosVivos) ajustarTexto(el, el.matches('.mr-fin-c') ? 0.8 : 0.55);
}

// Casillas del modo remo según lo que entrenas: en un fondo manda el pulso, en VO₂ la batería anaeróbica,
// en técnica los metros por palada… El split va siempre en la primera.
function valorCasilla(clave, t, dist, zfc) {
  const m = estado.sesion?.muestras || [];
  const objPaladas = estado.entrenamientoActivo?.objetivo?.metrica === 'paladas';
  switch (clave) {
    case 'spm': return ['Golpes/min', actual.spm];
    case 'tiempo': return ['Tiempo', formatoTiempo(t)];
    case 'dist': return ['Distancia', dist];
    case 'kcal': return ['Calorías', estado.sesion ? Math.round(estado.sesion.kcal) : 0];
    case 'extra': return estado.entrenamientoActivo?.objetivo && !objPaladas ? ['Paladas', estado.sesion ? Math.round(estado.sesion.paladas) : 0] : ['Calorías', estado.sesion ? Math.round(estado.sesion.kcal) : 0];
    case 'fc': return [zfc ? `Pulso · Z${zfc.n}` : 'Pulso', actual.fc || '—'];
    case 'kcalh': return ['kcal/hora', t >= 60 ? Math.round((estado.sesion.kcal * 3600) / t) : '—'];
    case 'wmax': return ['Watts máx', estado.sesion?.wMax || 0];
    case 'jpp': return ['J/palada', actual.spm ? `${Math.round((actual.watts * 60) / actual.spm)} J` : '—'];
    case 'mpp': {
      // Metros por palada de los últimos 30 s: responde a cómo remas ahora, no a toda la sesión.
      const v = m.slice(-30);
      const paladas = v.reduce((a, x) => a + x.spm / 60, 0);
      return ['m/palada', v.length >= 10 && paladas >= 3 ? ((v.at(-1).dist - v[0].dist) / paladas).toFixed(1) : '—'];
    }
    case 'bateria': return [avanzado() ? 'Batería (W′)' : 'Batería', estado.sesion?.pc ? `${Math.max(0, Math.round((100 * estado.sesion.wBal) / estado.sesion.pc.wPrima))}%` : '—'];
    default: return ['', ''];
  }
}

// Etiqueta corta fija para las casillas angostas (vista de carrera y horizontal): nunca se corta con «…».
const ETQ_CORTA = { spm: 'g/min', tiempo: 'Tiempo', dist: 'Dist.', kcal: 'kcal', fc: 'Pulso', kcalh: 'kcal/h', wmax: 'W máx', jpp: 'J/pal', mpp: 'm/pal', bateria: 'Batería' };
function pintarCasillasRemo(t, dist, zfc) {
  const claves = Cap.CASILLAS_REMO[estado.sesion?.tipoPlan || 'libre'];
  claves.forEach((clave, i) => {
    const [etq, valor] = valorCasilla(clave, t, dist, zfc);
    const corta = clave === 'extra' ? (etq === 'Paladas' ? 'Paladas' : 'kcal') : ETQ_CORTA[clave] || etq;
    const el = $(`#mr-c${i + 1}-etq`);
    if (el.dataset.etq !== etq) {
      el.dataset.etq = etq;
      el.innerHTML = `<span class="etq-larga">${escaparHtml(etq)}</span><span class="etq-corta">${escaparHtml(corta)}</span>`;
    }
    $(`#mr-c${i + 1}`).textContent = valor;
    $(`#mr-c${i + 1}`).style.color = clave === 'fc' && zfc ? COLOR_ZONA[zfc.n] : '';
  });
}

// Vista de rango: la meta del intervalo en grande y una barra con la franja buena y una aguja con tu valor.
// La derecha siempre es «más esfuerzo»: en el split (menos segundos = más rápido) la escala va al revés.
function medidaDeBloque(b) {
  const f = ftp();
  const rw = Ent.rangoWatts(b, f);
  if (rw) return { etq: 'Rango de potencia', valor: actual.watts, ...rw, unidad: 'W', txt: (x) => String(x), potencia: true };
  if (b.metrica === 'split') return { etq: 'Rango de split', valor: actual.split, min: b.min, max: b.max, unidad: '/500', txt: formatoSplit, alReves: true };
  if (b.metrica === 'spm') return { etq: 'Rango de golpes', valor: actual.spm, min: b.min, max: b.max, unidad: 'g/min', txt: (x) => String(x) };
  const rf = Ent.rangoFc(b, fcMaxima());
  if (rf) return { etq: 'Rango de pulso', valor: actual.fc || 0, ...rf, unidad: 'lpm', txt: (x) => String(x) };
  return null;
}

function pintarRango() {
  const info = estado.sesion?.info;
  const b = info && !info.terminado ? info.bloque : null;
  const m = b ? medidaDeBloque(b) : null;
  const caja = $('#mr-rango');
  caja.classList.remove('dentro', 'bajo', 'alto', 'libre', 'suave');
  const pctSes = estado.sesion?.segConMeta ? Math.round((100 * estado.sesion.segEnRango) / estado.sesion.segConMeta) : null;
  if (!m) {
    caja.classList.add('libre');
    $('#mr-rango-etq').textContent = info?.terminado ? 'Entrenamiento completado' : 'Intervalo libre';
    $('#mr-rango-meta').textContent = info?.siguiente ? `Luego ${Ent.textoMeta(info.siguiente, ftp(), fcMaxima())}` : '';
    $('#mr-rango-valor').textContent = actual.watts;
    $('#mr-rango-unidad').textContent = 'W';
    $('#mr-rango-ind').textContent = info?.terminado ? '' : 'Rema a tu gusto';
    $('#mr-rango-pie').textContent = pctSes != null ? `En rango ${pctSes}% de la sesión` : '';
    return;
  }
  const indicador = Ent.enRango(b, actual.watts, actual.spm, ftp(), actual.split, actual.fc);
  if (indicador) caja.classList.add(indicador);
  caja.classList.toggle('suave', bloqueSuave(b));
  $('#mr-rango-etq').textContent = m.etq;
  $('#mr-rango-meta').textContent = `${m.txt(m.min)}–${m.txt(m.max)} ${m.unidad}`;
  $('#mr-rango-valor').textContent = m.valor ? m.txt(m.valor) : '—';
  $('#mr-rango-unidad').textContent = m.unidad;
  $('#mr-rango-ind').innerHTML = textoIndicador(indicador, !!m.potencia);
  // Escala: la franja ocupa el 40 % central; a los lados, medio ancho de franja (o un 20 %) de margen.
  const ancho = Math.max(m.max - m.min, m.max * 0.1);
  const lo = m.min - ancho * 0.75;
  const hi = m.max + ancho * 0.75;
  const pos = (x) => { const p = (x - lo) / (hi - lo); return 100 * (m.alReves ? 1 - p : p); };
  const [a, z] = [pos(m.min), pos(m.max)].sort((x, y) => x - y);
  const banda = $('#mr-banda');
  banda.style.left = `${a}%`;
  banda.style.width = `${z - a}%`;
  $('#mr-banda-min').textContent = m.txt(m.alReves ? m.max : m.min);
  $('#mr-banda-max').textContent = m.txt(m.alReves ? m.min : m.max);
  $('#mr-aguja').style.left = `${Math.min(100, Math.max(0, m.valor ? pos(m.valor) : 0))}%`;
  const resta = Ent.textoResta(info);
  const sig = info.siguiente ? ` · luego ${Ent.textoMeta(info.siguiente, ftp(), fcMaxima())}` : '';
  $('#mr-rango-pie').textContent = `${resta} en este rango${sig}${pctSes != null ? ` · ${pctSes}% en rango` : ''}`;
}

// Estimado del final del entrenamiento si sigues al ritmo medio que llevas. Solo con un final conocido
// (objetivo o intervalos) y mientras no esté completado; en remo libre no hay final que estimar.
function estimadoFin(t) {
  if (!estado.sesion || !estado.entrenamientoActivo || t < 30 || !(estado.sesion.dist > 0)) return null;
  const ritmo = { split: (500 * t) / estado.sesion.dist, spm: (estado.sesion.paladas * 60) / t };
  let tFinal;
  let distFinal;
  let objetivo = null;
  if (Ent.tipoDe(estado.entrenamientoActivo) === 'objetivo') {
    const p = progresoActual(t);
    if (p.completo || p.estimadoSeg == null) return null;
    tFinal = t + p.estimadoSeg;
    objetivo = p.metrica;
    if (objetivo === 'distancia') distFinal = p.meta;
  } else {
    if (!estado.sesion.info || estado.sesion.info.terminado || !estado.sesion.plan) return null;
    tFinal = Ent.bloquesConDuracion(estado.sesion.estadoAv, estado.sesion.plan, { ...medidas(), ...ritmo }).reduce((a, b) => a + b.duracion, 0);
  }
  const e = Ent.estimarFin({ t, dist: estado.sesion.dist, kcal: estado.sesion.kcal, distFinal }, tFinal);
  if (!e) return null;
  // Lo que ya marca la meta no se estima: en 5000 m no tiene sentido «≈ 5000 m», ni el tiempo en un plan solo por tiempo.
  e.tiempoFijo = !objetivo && Ent.soloTiempo({ bloques: estado.sesion.plan });
  e.objetivo = objetivo;
  return e;
}

function pintarEstimadoFin(t) {
  const mr = $('#modo-remo');
  const e = mr.hidden ? null : estimadoFin(t);
  const partes = [];
  if (e) {
    // El tiempo total solo se estima si el plan no es de tiempo fijo (objetivos, intervalos por metros o paladas).
    if (!e.tiempoFijo) partes.push(['tiempo', formatoTiempo(e.tiempo)]);
    if (e.objetivo !== 'distancia') partes.push(['dist', `${miles(e.dist)} m`]);
    if (e.objetivo !== 'kcal') partes.push(['kcal', `${e.kcal} kcal`]);
    partes.push(['split', `${formatoSplit(e.split)}/500`]);
  }
  // «fin ≈ …» bajo la casilla que corresponde (tiempo, distancia, calorías)…
  const claves = Cap.CASILLAS_REMO[estado.sesion?.tipoPlan || 'libre'];
  const porClave = Object.fromEntries(partes);
  const enCasilla = new Set();
  claves.forEach((clave, i) => {
    const k = clave === 'extra' && !(estado.entrenamientoActivo?.objetivo && estado.entrenamientoActivo.objetivo.metrica !== 'paladas') ? 'kcal' : clave;
    const v = porClave[k];
    if (v) enCasilla.add(k);
    $(`#mr-c${i + 1}-fin`).textContent = v ? `fin ≈ ${v.replace(/ (m|kcal)$/, '')}` : '';
  });
  // …y en la cabecera solo lo que no tiene casilla (el tiempo total, el split medio): nada sale dos veces.
  const resto = partes.filter(([k]) => !enCasilla.has(k));
  const fin = $('#mr-fin');
  fin.textContent = resto.length ? `Al final ≈ ${resto.map(([k, v]) => (k === 'tiempo' ? `${v} total` : v)).join(' · ')}` : '';
  fin.hidden = !resto.length;
}

// Avisos por voz propios del tipo de sesión y saldo de la batería anaeróbica (W′), una vez por segundo.
export function vigilarTipoSesion(t) {
  if (estado.sesion.pc) {
    const { cp, wPrima } = estado.sesion.pc;
    const w = actual.watts;
    estado.sesion.wBal = Math.min(wPrima, w > cp ? estado.sesion.wBal - (w - cp) : estado.sesion.wBal + ((wPrima - estado.sesion.wBal) * (cp - w)) / wPrima);
    const pct = (100 * estado.sesion.wBal) / wPrima;
    if (pct < 20 && !estado.sesion.avisoBateria) { estado.sesion.avisoBateria = true; hablar('Batería anaeróbica al 20 por ciento. Dosifica', { clave: 'bateria', cadaSeg: 60 }); }
    if (pct > 60) estado.sesion.avisoBateria = false;
  }
  // Al minuto 5: si el pulso va 5 lpm o más por encima de lo normal a los mismos watts, hoy los rangos bajan un 5 %.
  if (t === 300 && estado.sesion.plan && estado.sesion.calentamientos?.length) {
    const deMas = A.pulsoDeMas(estado.sesion.muestras, estado.sesion.calentamientos);
    if (deMas != null && deMas >= 5) {
      for (const b of estado.sesion.plan) if (b.metrica === 'watts') { b.min = Math.round(b.min * 0.95); b.max = Math.round(b.max * 0.95); }
      estado.sesion.ajusteCalentamiento = deMas;
      hablar(`Hoy vas cargado: tu pulso va ${deMas} pulsaciones más alto de lo normal. Bajé los rangos un 5 por ciento`, { urgente: true });
      toast(`Hoy vas cargado (+${deMas} lpm): bajé los rangos un 5 %`, 5000);
    }
  }
  const tipo = estado.sesion.tipoPlan;
  if (tipo === 'fondo' && fcMaxima() && actual.fc) {
    // En un fondo el pulso no debería pasar del 75 % del máximo (zona 2) más de un minuto seguido.
    estado.sesion.fcAltaSeg = actual.fc > fcMaxima() * 0.75 ? (estado.sesion.fcAltaSeg || 0) + 1 : 0;
    if (estado.sesion.fcAltaSeg === 60) hablar('Pulso alto para un fondo. Baja un poco los watts', { clave: 'fc-fondo', cadaSeg: 180 });
  }
  if (tipo === 'calorias') {
    const cien = Math.floor(estado.sesion.kcal / 100);
    if (cien > (estado.sesion.kcalAvisadas || 0)) { estado.sesion.kcalAvisadas = cien; hablar(`${cien * 100} calorías`, { clave: 'kcal', cadaSeg: 30 }); }
  }
}

// Vista del modo remo: 'numeros', 'rango' (si el plan tiene rangos), 'grafica' o 'carrera' (si hay fantasma).
// La vista de rango solo existe si el plan marca rangos (potencia, split, golpes o pulso) en algún intervalo.
const hayRangos = () => !!(estado.sesion?.plan ? estado.sesion.plan.some((b) => b.metrica) : estado.entrenamientoActivo && Ent.tipoDe(estado.entrenamientoActivo) === 'intervalos' && estado.entrenamientoActivo.bloques?.some((b) => b.metrica));
function vistaRemo() {
  const v = ajustes.leer('vistaRemo', 'numeros');
  if (v === 'carrera' && !hayCarrera()) return 'grafica';
  if (v === 'rango' && !hayRangos()) return 'numeros';
  return v;
}
const vistaGrafica = () => vistaRemo() === 'grafica' || vistaRemo() === 'carrera';
let leyendaRemo = '';
function leyenda(html) {
  if (html !== leyendaRemo) { $('#mr-leyenda').innerHTML = html; leyendaRemo = html; }
}

function pintarGraficaRemo(t) {
  const canvas = $('#mr-grafica');
  if (vistaRemo() === 'carrera') {
    const clases = ['lcar', 'lcar2', 'lcar3'];
    leyenda(`<span class="lw">Tú</span>${estado.sesion.rivales.map((r, i) => `<span class="${clases[i]}">${escaparHtml(r.nombre.replace(/^Fantasma /, ''))}</span>`).join('')}`);
    canvas.setAttribute('aria-label', $('#mr-rival-texto').textContent);
    carreraRemo.actualizar(carreraActual().estado);
    return;
  }
  carreraRemo.detener();
  const ent = estado.sesion ? estado.entrenamientoActivo : null;
  const previa = !estado.sesion && $('#sel-entrenamiento').value ? estado.entrenamientoPrevio : null;
  const plan = ent || previa;
  if (plan && Ent.tipoDe(plan) === 'intervalos') {
    leyenda('<span class="lr">Rango objetivo</span><span class="lf">Fuera de rango</span><span class="lp">Tu potencia</span>');
    canvas.setAttribute('aria-label', 'Plan de potencia con tu potencia real');
    graficaRemo.reiniciar();
    dibujarPerfil(canvas, estado.sesion ? estado.sesion.bloques : paraPerfil(plan.bloques), estado.sesion ? estado.sesion.muestras.map((x) => [x.t, x.w]) : [], estado.sesion ? t : null);
  } else if (plan) {
    const unidad = Ent.METRICAS_OBJETIVO[plan.objetivo.metrica].unidad;
    leyenda(`<span class="lw">Llevas (${unidad})</span><span class="lr">Meta ${plan.objetivo.valor} ${unidad}</span><span class="lp">Proyección a tu ritmo</span>`);
    canvas.setAttribute('aria-label', `Avance hacia la meta de ${plan.objetivo.valor} ${unidad}`);
    const p = estado.sesion ? progresoActual(t) : null;
    graficaRemo.reiniciar();
    dibujarAvance(canvas, estado.sesion ? estado.sesion.avance : [], plan.objetivo.valor, p && !p.completo && p.estimadoSeg != null ? t + p.estimadoSeg : null);
  } else {
    leyenda('<span class="lw">Watts</span><span class="ls">Golpes/min</span>');
    canvas.setAttribute('aria-label', 'Watts y golpes por minuto de los últimos 5 minutos');
    graficaRemo(canvas, [
      { color: color('--watts'), eje: 'izq', puntos: vivo.watts },
      { color: color('--spm'), eje: 'der', puntos: vivo.spm },
    ], { ventana: 300 });
  }
}

// Orden al tocar el botón: números → gráfica → carrera (si hay fantasma) → números.
const vistasRemo = () => ['numeros', ...(hayRangos() ? ['rango'] : []), 'grafica', ...(hayCarrera() ? ['carrera'] : [])];
function siguienteVista() {
  const vs = vistasRemo();
  return vs[(vs.indexOf(vistaRemo()) + 1) % vs.length];
}

function aplicarVistaRemo() {
  const v = vistaRemo();
  reajustarTextos();
  $('#modo-remo').classList.toggle('vista-grafica', v === 'grafica' || v === 'carrera');
  $('#modo-remo').classList.toggle('vista-carrera', v === 'carrera');
  $('#modo-remo').classList.toggle('vista-rango', v === 'rango');
  const sig = siguienteVista();
  const b = $('#mr-vista');
  // El botón muestra la vista actual y unos puntos con su lugar en la vuelta; tocarlo pasa a la siguiente.
  const vistas = vistasRemo();
  const icono = { numeros: '<span class="num" aria-hidden="true">Vista</span>', rango: '<span class="num" aria-hidden="true">Vista</span>', grafica: '<span class="num" aria-hidden="true">Vista</span>', carrera: '<span class="num" aria-hidden="true">Vista</span>' };
  const nombre = { numeros: 'números grandes', rango: 'rango del intervalo', grafica: 'gráfica', carrera: 'carrera' };
  b.innerHTML = `${icono[v]}<span class="vista-puntos" aria-hidden="true">${vistas.map((x) => (x === v ? '●' : '○')).join('')}</span>`;
  b.setAttribute('aria-label', `Vista: ${nombre[v]}. Toca para cambiar a ${nombre[sig]}`);
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarVivo2() {
  $('#mr-vista').addEventListener('click', () => {
    ajustes.escribir('vistaRemo', siguienteVista());
    selVistaRemo.value = ajustes.leer('vistaRemo', 'numeros');
    aplicarVistaRemo();
    requestAnimationFrame(pintar);
  });
  // Lo que eliges a mano manda el resto del día: al volver a abrir la app no se cambia por la sesión del día.
  $('#sel-entrenamiento').addEventListener('change', () => { ajustes.escribir('ultimoEnt', $('#sel-entrenamiento').value); ajustes.escribir('eleccionDia', E.claveDia(Date.now())); vistaPrevia(); });
  $('#modo-ent').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if (!b || estado.sesion) return;
    const sel = $('#sel-entrenamiento');
    ajustes.escribir('modoEnt', b.dataset.modo);
    ajustes.escribir('eleccionDia', E.claveDia(Date.now()));
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
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12 || !estado.sesion) return;
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
  // Si el usuario sale de pantalla completa con el gesto de atrás, también sale del modo remo.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !$('#modo-remo').hidden) $('#modo-remo').hidden = true;
  });
}

function pintarObjetivo(t) {
  const ent = estado.entrenamientoActivo;
  const p = progresoActual(t);
  const unidad = Ent.METRICAS_OBJETIVO[p.metrica].unidad;
  const pct = `${100 * p.fraccion}%`;
  $('#bloque-nombre').textContent = ent.nombre;
  $('#mr-nombre').textContent = ent.nombre;
  $('#bloque-barra').style.width = pct;
  $('#mr-barra').style.width = pct;
  marcarRango(null);
  if (p.completo) {
    $('#bloque-resta').textContent = formatoTiempo(estado.sesion.tiempoMeta);
    $('#bloque-meta').textContent = `¡Meta cumplida! ${p.meta} ${unidad}`;
    $('#bloque-siguiente').textContent = '';
    $('#bloque-indicador').textContent = 'Puedes seguir remando o terminar la sesión';
    $('#mr-resta').textContent = formatoTiempo(estado.sesion.tiempoMeta);
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
  const info = estado.sesion.info;
  const puntos = estado.sesion.muestras.map((x) => [x.t, x.w]);
  dibujarPerfil($('#grafica-perfil'), estado.sesion.bloques, puntos, t);
  if (!$('#modo-remo').hidden && !vistaGrafica()) dibujarPerfil($('#mr-perfil'), estado.sesion.bloques, puntos, t);
  if (!info) return;
  if (info.terminado) {
    const pctRango = estado.sesion.segConMeta ? `En rango ${Math.round((100 * estado.sesion.segEnRango) / estado.sesion.segConMeta)}% del tiempo` : '';
    const extra = `+${formatoTiempo(t - (estado.sesion.tiempoMeta ?? t))}`;
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
  const nombre = `${i + 1}/${estado.sesion.plan.length} · ${b.nombre || 'Intervalo'}`;
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
  marcarRango(Ent.enRango(b, actual.watts, actual.spm, f, actual.split, actual.fc), !!Ent.rangoWatts(b, f), bloqueSuave(b));
}

// Las dos gráficas en vivo (Entrenar y modo remo) solo dibujan lo nuevo de cada segundo.
const graficaEntrenar = crearGraficaVivo();
const graficaRemo = crearGraficaVivo();
export function dibujarVivo() {
  const metas = [];
  const info = estado.sesion?.info;
  if (info && !info.terminado) {
    const r = Ent.bloquesEnWatts([info.bloque], ftp())[0];
    if (r.metrica === 'watts') metas.push({ desde: estado.tVivo - (estado.sesion.t - info.desde), hasta: estado.tVivo + info.restaSeg, min: r.min, max: r.max || r.min, eje: 'izq' });
  }
  graficaEntrenar($('#grafica-vivo'), [
    { nombre: 'Watts', color: color('--watts'), eje: 'izq', puntos: vivo.watts },
    { nombre: 'Golpes/min', color: color('--spm'), eje: 'der', puntos: vivo.spm },
  ], { ventana: 300, metas });
}

// Muestra la meta del entrenamiento elegido antes de iniciar la sesión.
// Solo pinta la última llamada: si se elige otra cosa mientras se lee un entrenamiento, gana lo último elegido.
let vistaTurno = 0;
export async function vistaPrevia() {
  if (estado.sesion) return;
  const turno = ++vistaTurno;
  const ent = await obtenerEnt($('#sel-entrenamiento').value);
  if (estado.sesion || turno !== vistaTurno) return;
  estado.entrenamientoPrevio = ent;
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

// Dos modos: Remo libre (sin entrenamiento) o Por objetivo (eliges un entrenamiento de tus planes).
export function modoEnt() { return $('#sel-entrenamiento').value ? 'objetivo' : ajustes.leer('modoEnt', 'libre'); }
export function pintarModoEnt() {
  const modo = modoEnt();
  for (const b of $('#modo-ent').querySelectorAll('button')) {
    b.setAttribute('aria-checked', String(b.dataset.modo === modo));
    b.disabled = !!estado.sesion;
  }
  $('#campo-ent').hidden = modo !== 'objetivo';
}

export function abrirModoRemo() {
  $('#modo-remo').hidden = false;
  if (!ajustes.si('consejoModoRemo', false)) { ajustes.escribir('consejoModoRemo', '1'); toast('Doble toque para pausar · desliza a los lados para cambiar de vista', 5000); }
  const intervalos = !!estado.sesion?.bloques || (!estado.sesion && !!estado.entrenamientoPrevio && Ent.tipoDe(estado.entrenamientoPrevio) === 'intervalos');
  $('#mr-perfil').hidden = !intervalos;
  if (!estado.sesion) {
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

export function cerrarModoRemo() {
  $('#modo-remo').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
