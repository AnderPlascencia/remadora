// La voz y los avisos durante la sesión: eventos de la carrera, el entrenador (ritmo, ánimos, bloques y series),
// la capa de juego de la voz y el progreso hacia el objetivo.
import { formatoSplit, formatoTiempo } from '../protocolo.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import { hablar, tiempoHablado } from '../voz.js';
import * as G from '../guion-voz.js';
import * as VJ from '../voz-juego.js';
import { confeti } from '../efectos.js';
import * as J from '../juego.js';
import * as V from '../ventajas.js';
import { $, ajustes, formatoMeta, ftp, miles, pitido, VIBRA, vibrar } from '../ui.js';
import { estado } from '../estado.js';
import { carreraActual, velocidadReciente } from './vivo.js';
import { agregarLog } from '../registro.js';
import { estadoHeroe, leerPersonaje } from './heroe.js';
import { delProgramaHoy } from './programa.js';
import { actual, medidas, paraPerfil, remadora } from './sesion.js';

// Avisos que la carrera dibuja un momento: adelantos, te pasan y ventajas.
export function eventoCarrera(tipo, texto, detalle = '') {
  const lista = estado.sesion.eventosCarrera;
  lista.push({ id: (lista.at(-1)?.id || 0) + 1, tipo, texto, detalle });
  if (lista.length > 8) lista.shift();
}

// Adelantos: cuando cambia quién va delante entre tú y cada fantasma (con 1 m de margen para no parpadear).
export function vigilarAdelantos(t) {
  const miDist = estado.sesion.dist + V.metrosVentaja(estado.sesion.ventaja);
  const lados = estado.sesion.rivales.map((r, i) => {
    const d = miDist - E.distanciaEn(r.muestras, t);
    const antes = estado.sesion.lados?.[i] ?? 0;
    return d > 1 ? 1 : d < -1 ? -1 : antes;
  });
  if (estado.sesion.lados && t > 5) {
    lados.forEach((l, i) => {
      const antes = estado.sesion.lados[i];
      if (!antes || l === antes) return;
      const nombre = corto(estado.sesion.rivales[i].nombre);
      if (l > 0) {
        eventoCarrera('adelanto', `¡Adelantaste a ${nombre}!`);
        V.alAdelantar(estado.sesion.ventaja, t);
        hablar(`Adelantaste a ${nombre}`, { clave: `adelanto-${i}`, cadaSeg: 8 });
        vibrar([60, 40, 60]);
      } else {
        eventoCarrera('te-pasan', `${nombre} te adelantó`);
        hablar(`${nombre} te adelantó`, { clave: `adelanto-${i}`, cadaSeg: 8 });
        vibrar(250);
      }
    });
  }
  estado.sesion.lados = lados;
}

// Sprint final: en los últimos 250 m suena un tambor cada segundo (doble en los últimos 100 m).
export function tamborSprint() {
  const meta = estado.entrenamientoActivo?.objetivo?.metrica === 'distancia' ? estado.entrenamientoActivo.objetivo.valor : null;
  if (!meta || estado.sesion.tiempoMeta != null) return;
  const falta = meta - estado.sesion.dist;
  if (falta > 250 || falta <= 0) return;
  if (!estado.sesion.sprintAvisado) {
    estado.sesion.sprintAvisado = true;
    hablar('¡Sprint final! Últimos 250 metros', { urgente: true });
    vibrar([80, 60, 80, 60, 80]);
  }
  pitido(98, 0.14);
  if (falta <= 100) setTimeout(() => pitido(98, 0.12), 480);
}

export const corto = (nombre = '') => nombre.replace(/^Fantasma /, '').split(' (')[0];

const ANIMOS = ['¡Buen ritmo, sigue así!', 'Vas muy bien, mantén la técnica', 'Piernas, espalda, brazos. Así se rema', '¡Fuerte! Cada palada cuenta', 'Respira y mantén el ritmo'];

// Parciales de 500 m (con aviso por voz), ánimo de vez en cuando y aviso si el ritmo se cae.
export function coachRitmo(t) {
  const n = Math.floor(estado.sesion.dist / 500);
  if (n > estado.sesion.n500) {
    const seg = t - estado.sesion.t500;
    estado.sesion.parcial = { seg, n };
    estado.sesion.n500 = n;
    estado.sesion.t500 = t;
    const cada = G.parcialCada(estado.sesion.guion, bloqueEnCurso());
    if (cada && (n * 500) % cada === 0) hablar(`${n * 500} metros. Parcial ${splitHablado(seg)}${posicionHablada()}`, { clave: 'parcial', cadaSeg: 20 });
  }
  if (t % 240 === 0 && estado.sesion.fueraSeguidos === 0) {
    const animo = animoDelEntrenador();
    if (animo) hablar(animo, { clave: 'animo', cadaSeg: 200, capa: G.CAPA.animo });
  }
  avisosDeJuego(t);
  // En intervalos los descansos bajan el ritmo a propósito: ahí manda el aviso de rango.
  if (estado.sesion.plan || t < 60 || estado.sesion.dist < 100) return;
  const ref = estado.sesion.ritmo || (t * 500) / estado.sesion.dist;
  const v = velocidadReciente();
  const reciente = v > 0 ? 500 / v : Infinity;
  estado.sesion.lento = reciente > ref + (estado.sesion.ritmo ? 3 : 6) ? estado.sesion.lento + 1 : 0;
  if (estado.sesion.lento >= 20) {
    estado.sesion.lento = 0;
    const texto = G.ritmoCae(estado.sesion.guion, estado.sesion.ritmo ? splitHablado(estado.sesion.ritmo) : '');
    if (texto) hablar(texto, { clave: 'lento', cadaSeg: 60, capa: G.CAPA.correccion });
  }
}

// Bloque del plan que se está remando, o null.
function bloqueEnCurso() {
  const info = estado.sesion?.info;
  return info && !info.terminado ? info.bloque : null;
}

// Últimos 10 s de un esfuerzo duro: la voz solo cuenta (las capas 2 y 3 callan).
export function silencioDuro() {
  const s = estado.sesion;
  const b = bloqueEnCurso();
  return !!(s && b && G.DUROS.has(s.guion) && G.esTrabajo(b) && s.info.restaSeg > 0 && s.info.restaSeg <= 10);
}

// Con varios fantasmas, el parcial también dice el puesto («Vas 2º de 4. 12 metros atrás de…»).
function posicionHablada() {
  const s = estado.sesion;
  if (s.rivales.length < 2 || (s.salida && !s.salida.hecha)) return '';
  return `. ${carreraActual().texto.replace(/ · /g, '. ').replace(/(\d+) m /g, '$1 metros ')}`;
}

// Ánimo del entrenador cada 4 min: consejos del tipo de sesión; en las sesiones suaves, nunca «¡fuerte!».
// En VO2, sprints y pruebas no hay ánimos durante el trabajo.
function animoDelEntrenador() {
  const s = estado.sesion;
  if (G.SIN_ANIMO.has(s.guion)) return '';
  const k = s.nAnimo++;
  const suave = G.SUAVES.has(s.guion);
  // Con clase, sus frases (de calma o de esfuerzo según el momento) sustituyen a los ánimos de siempre
  // y, en los tipos suaves, se alternan con los consejos.
  const deClase = s.claseVoz ? VJ.fraseClase(s.claseVoz, VJ.momentoAnimo(suave, bloqueEnCurso()), s.frasesUsadas) : '';
  const consejo = G.consejo(s.guion, Math.floor(k / (suave && !deClase ? 1 : 2)));
  if (suave) return deClase && k % 2 === 1 ? deClase : consejo || deClase;
  return k % 2 === 0 && consejo ? consejo : deClase || ANIMOS[Math.floor(k / 2) % ANIMOS.length];
}

// ---------- Capa de juego de la voz (voz-juego.js) ----------

// Al terminar: misiones, jefe, hazaña de clase y XP de la sesión, detrás de «Sesión terminada».
export function decirResumenJuego(registro, previas) {
  try {
    const per = leerPersonaje();
    const antes = H.estadoJuegoDe(previas, { ftp: ftp(), per });
    const despues = J.estadoJuego([...previas.filter((x) => x.fecha !== registro.fecha), registro], { ftp: ftp(), per });
    const texto = VJ.resumenJuego(antes, despues, registro.fecha, J.claseDe(per.clase)?.clave || null);
    if (texto) hablar(texto);
  } catch (e) {
    agregarLog(`resumen de juego por voz: ${e?.message || e}`);
  }
}

// Aviso de juego en la capa 3, con sus reglas (uno cada 5 min, nunca en recuperación, pruebas ni trabajo de VO2
// o sprints). inicio: el aviso de arranque, que se dice aunque la sesión sea una prueba (es antes del esfuerzo).
export function hablarJuego(texto, t, { inicio = false } = {}) {
  const s = estado.sesion;
  if (!texto || !s) return false;
  if (!inicio && !VJ.juegoPuede(s.guion, { bloque: bloqueEnCurso(), t, ultimo: s.ultimoJuego })) return false;
  const dicho = hablar(texto, { clave: 'juego', capa: G.CAPA.animo });
  if (dicho) s.ultimoJuego = t;
  return dicho;
}

// Al empezar: jefe o racha, y los hitos de la hazaña de clase que esta sesión puede cruzar remando.
export async function prepararVozJuego(s) {
  try {
    const { h } = await estadoHeroe();
    if (estado.sesion !== s) return;
    const ent = estado.entrenamientoActivo;
    const cap = h.capitulo;
    const jefe = cap && cap.listo && ent && cap.preparar && ent.id === cap.preparar ? cap.jefe.nombre : '';
    s.hitosVoz = s.claseVoz ? VJ.hitosEnVivo(h.hazanas.find((x) => x.id === `clase-${s.claseVoz}`)) : [];
    s.hazanaVoz = s.claseVoz ? h.hazanas.find((x) => x.id === `clase-${s.claseVoz}`)?.nombre : '';
    s.misionPlanVoz = !!delProgramaHoy(s) && h.diarias.some((m) => m.id === 'plan' && !m.hecha);
    const aviso = VJ.avisoInicio({ racha: h.contexto?.racha || 0, jefe });
    // Se dice en cuanto calle la frase de arranque (la capa 3 no se pone en cola): lo intenta avisosDeJuego().
    s.avisoInicioVoz = aviso;
  } catch (e) {
    agregarLog(`voz de juego: ${e?.message || e}`);
  }
}

// Durante: hito de la hazaña de clase (paladas o km) y la misión del plan al 75 %.
function avisosDeJuego(t) {
  const s = estado.sesion;
  if (s.avisoInicioVoz) {
    if (hablarJuego(s.avisoInicioVoz, t, { inicio: true }) || t > 120) s.avisoInicioVoz = '';
    return;
  }
  const hito = s.hitosVoz?.[0];
  if (hito && (hito.medida === 'km' ? s.dist : s.paladas) >= hito.faltan) {
    // Si se cruzan dos hitos sin poder decirlo, se dice el último.
    while (s.hitosVoz[1] && (hito.medida === 'km' ? s.dist : s.paladas) >= s.hitosVoz[1].faltan) s.hitosVoz.shift();
    const pct = s.hitosVoz[0].pct;
    // El 100 % se dice aunque no toque (una vez en la vida); los demás esperan su turno.
    if (hablarJuego(VJ.textoHito(s.hazanaVoz, pct), t, { inicio: pct >= 100 })) s.hitosVoz.shift();
    return;
  }
  if (s.misionPlanVoz) {
    const total = (s.bloques || []).reduce((a, b) => a + (b.duracion || 0), 0);
    const avance = s.plan ? (total ? t / total : 0) : estado.entrenamientoActivo?.objetivo ? progresoActual(t).hecho / progresoActual(t).meta : 0;
    if (avance >= 0.75 && hablarJuego(VJ.MISION_PLAN_75, t)) s.misionPlanVoz = false;
  }
}

// «Atento al entrenador»: tras una corrección de rango, volver al rango en menos de 20 s cuenta como respondida.
function seguirCorreccion(t, rango) {
  const s = estado.sesion;
  if (s.correccionEn == null) return;
  if (t - s.correccionEn > 20) s.correccionEn = null;
  else if (rango === 'dentro') { s.atento++; s.correccionEn = null; }
}

// Último parcial de 500 m: verde si va al ritmo objetivo (o mejor que tu promedio), rojo si no.
export function textoParcial() {
  const p = estado.sesion?.parcial;
  if (!p) return { texto: estado.sesion?.ritmo ? `Objetivo ${formatoSplit(estado.sesion.ritmo)}` : '', corto: estado.sesion?.ritmo ? `Obj. ${formatoSplit(estado.sesion.ritmo)}` : '', clase: '' };
  const ref = estado.sesion.ritmo || (estado.sesion.t500 * 500) / Math.max(1, p.n * 500);
  const clase = estado.sesion.ritmo ? (p.seg <= ref ? 'ok' : 'mal') : (p.seg <= ref + 0.5 ? 'ok' : 'mal');
  return { texto: `Último 500 m ${formatoSplit(p.seg)}`, corto: `Últ. 500 ${formatoSplit(p.seg)}`, clase };
}

export function avanceObjetivo(t) {
  const p = progresoActual(t);
  if (p.completo && estado.sesion.tiempoMeta == null) {
    const previo = estado.sesion.avance.at(-2)?.[1] ?? 0;
    estado.sesion.tiempoMeta = E.instanteMeta(t, previo, estado.sesion.avance.at(-1)?.[1] ?? p.hecho, p.meta);
    pitido(1046, 0.4);
    vibrar([200, 100, 200, 100, 400]);
    hablar(`¡Meta cumplida! en ${tiempoHablado(t)}. ¿Sigues o terminas?`, { urgente: true });
    mostrarFin();
  } else if (!p.completo && p.fraccion >= 0.5 && !estado.sesion.mitadAvisada) {
    estado.sesion.mitadAvisada = true;
    const ritmo = t > 0 ? p.hecho / t : 0;
    const queda = ritmo > 0 ? Math.round(p.falta / ritmo / 60) : 0;
    hablar(`Vas a la mitad. Faltan ${Math.ceil(p.falta)} ${Ent.METRICAS_OBJETIVO[p.metrica].unidad === 'm' ? 'metros' : Ent.METRICAS_OBJETIVO[p.metrica].unidad}${queda >= 1 ? `. A este ritmo, unos ${queda === 1 ? '1 minuto' : `${queda} minutos`} más` : ''}`);
  }
}

// Al completar el entrenamiento se pregunta si seguir remando o terminar y guardar.
function mostrarFin() {
  const partes = [estado.sesion.tiempoMeta != null ? formatoMeta(estado.sesion.tiempoMeta) : formatoTiempo(estado.sesion.t), `${miles(estado.sesion.dist)} m`];
  if (estado.sesion.rival) partes.push(carreraActual().texto.replace(/^Vas /, ''));
  $('#fin-texto').textContent = partes.join(' · ');
  $('#fin-dialogo').hidden = false;
  $('#fin-terminar').focus();
  if (estado.sesion.rival && carreraActual().tono === 'adelante') confeti();
}
export function cerrarFin() { $('#fin-dialogo').hidden = true; }

export function progresoActual(t) {
  return Ent.progresoObjetivo(estado.entrenamientoActivo, { distancia: estado.sesion.dist, kcal: estado.sesion.kcal, paladas: estado.sesion.paladas }, t);
}

const splitHablado = (s) => `${Math.floor(s / 60)} ${String(s % 60).padStart(2, '0')}`;
function metaHablada(b) {
  const meta = metaHabladaSola(b);
  const spm = b.spmMeta || b.spmGuia;
  return spm ? `${meta}, a ${spm[0]} a ${spm[1]} golpes por minuto` : meta;
}
function metaHabladaSola(b) {
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

export function avanceBloque(t) {
  const info = Ent.avanzar(estado.sesion.estadoAv, estado.sesion.plan, medidas());
  estado.sesion.info = info;
  estado.sesion.bloques = paraPerfil(Ent.bloquesConDuracion(estado.sesion.estadoAv, estado.sesion.plan, medidas()));
  if (info.terminado) {
    if (estado.sesion.bloqueAnterior !== estado.sesion.plan.length) {
      cerrarSerie(t);
      estado.sesion.bloqueAnterior = estado.sesion.plan.length;
      estado.sesion.tiempoMeta = info.desde;
      pitido(1046, 0.4);
      vibrar([200, 100, 200]);
      const pct = estado.sesion.segConMeta ? Math.round((100 * estado.sesion.segEnRango) / estado.sesion.segConMeta) : null;
      const guion = estado.sesion.guion;
      hablar(`${G.cierre(guion, { pctRango: pct, series: estado.sesion.series, cadenciaPct: guion === 'tecnica' ? pct : null })}. ¿Sigues o terminas?`, { urgente: true });
      mostrarFin();
    }
    return;
  }
  const { i, bloque: b, resta } = info;
  const fin = Ent.finDe(b);
  if (i !== estado.sesion.bloqueAnterior) {
    if (estado.sesion.bloqueAnterior !== -1) { pitido(988, 0.25); vibrar(VIBRA.bloque); }
    const anterior = estado.sesion.bloqueAnterior;
    cerrarSerie(t);
    estado.sesion.bloqueAnterior = i;
    estado.sesion.fueraSeguidos = 0;
    estado.sesion.inicioBloque = { t: info.desde, dist: estado.sesion.dist, con: estado.sesion.segConMeta, dentro: estado.sesion.segEnRango, picoW: 0 };
    anunciarBloque(i, b, anterior);
    if (b.nivel && ajustes.si('resAuto', false)) {
      agregarLog(remadora.fijarResistencia(b.nivel) ? `resistencia automática: nivel ${b.nivel}` : `resistencia automática: nivel ${b.nivel} no válido o sin conexión`);
    }
  }
  if (estado.sesion.inicioBloque) estado.sesion.inicioBloque.picoW = Math.max(estado.sesion.inicioBloque.picoW, actual.watts);
  avisosDelBloque(i, b, fin, resta);
  if (fin === 'tiempo' && resta <= 3 && resta > 0) {
    pitido(660, 0.08);
    if (b.duracion > 10) hablar(String(resta), { urgente: true });
  }
  const cerca = fin === 'distancia' ? 100 : fin === 'paladas' ? 10 : 0;
  if (cerca && resta <= cerca && Ent.cantidadDe(b) > cerca * 1.5 && estado.sesion.avisoCerca !== i) {
    estado.sesion.avisoCerca = i;
    pitido(660, 0.1);
    hablar(fin === 'distancia' ? 'Últimos 100 metros' : 'Últimas 10 paladas', { urgente: true });
  }
  const rango = Ent.enRango(b, actual.watts, actual.spm, ftp(), actual.split, actual.fc);
  // Solo los bloques de trabajo y pasados sus primeros segundos cuentan para el % en rango.
  const cuenta = Ent.contarRango({ con: estado.sesion.segConMeta, dentro: estado.sesion.segEnRango, bajo: estado.sesion.segBajo || 0, alto: estado.sesion.segAlto || 0 }, b, rango, t - info.desde);
  Object.assign(estado.sesion, { segConMeta: cuenta.con, segEnRango: cuenta.dentro, segBajo: cuenta.bajo, segAlto: cuenta.alto });
  estado.sesion.fueraSeguidos = rango && rango !== 'dentro' ? estado.sesion.fueraSeguidos + 1 : 0;
  const s0 = estado.sesion;
  // Fuera del rango 10 s seguidos (y luego cada 30 s): vibración distinta para subir o bajar, sin mirar.
  const fuera = estado.sesion.fueraSeguidos;
  if (fuera >= 10 && (fuera - 10) % 30 === 0 && info.restaSeg > 4 && G.esTrabajo(b)) vibrar(rango === 'bajo' ? VIBRA.sube : VIBRA.baja);
  seguirCorreccion(t, rango);
  if (estado.sesion.fueraSeguidos >= 5 && info.restaSeg > 4) {
    const spm = b.metrica === 'spm';
    const texto = G.correccion(estado.sesion.guion, {
      rango, potencia: !!Ent.rangoWatts(b, ftp()), pulso: b.metrica === 'fc' || b.metrica === 'fcpct',
      cadencia: spm ? actual.spm : 0, spmMin: spm ? b.min : 0, spmMax: spm ? b.max : 0,
      serie: G.serieDe(estado.sesion.plan, i, estado.sesion.guion), enSerieSeg: t - info.desde, fueraSeg: estado.sesion.fueraSeguidos, trabajo: G.esTrabajo(b),
    });
    // La misma corrección, como mucho una vez por minuto (y cualquier corrección, una cada 20 s).
    if (texto && hablar(texto, { clave: `fuera:${texto.replace(/\d+/g, '#')}`, cadaSeg: 60, capa: G.CAPA.correccion }) && G.esTrabajo(b)) s0.correccionEn = t;
  }
}

// Al empezar un bloque: qué toca (nombre, meta y cantidad), la serie y, tras una serie dura, cómo fue.
function anunciarBloque(i, b, anterior) {
  const s = estado.sesion;
  const serie = G.serieDe(s.plan, i, s.guion);
  const nombre = (b.nombre || 'Intervalo').replace(/\s*\d+\s*\/\s*\d+\s*/g, ' ').trim();
  const extra = serie ? `. ${G.inicioSerie(s.guion, serie)}` : '';
  const consejo = b.consejo || (s.guion === 'tecnica' && G.esTrabajo(b) ? G.focoTecnica(serie ? serie.n - 1 : i) : '');
  hablar(`${nombre}${extra}. ${metaHablada(b)}, ${cantidadHablada(b)}${consejo ? `. ${consejo}` : ''}`, { urgente: true });
  const previa = anterior >= 0 ? s.plan[anterior] : null;
  const hecha = s.series.at(-1);
  if (previa && G.esTrabajo(previa) && !G.esTrabajo(b) && hecha) {
    const texto = G.trasSerie(s.guion, { pct: hecha.pct, split: hecha.split ? splitHablado(hecha.split) : '', picoW: hecha.picoW });
    if (texto) hablar(texto, { clave: 'tras-serie', capa: G.CAPA.correccion });
  }
}

// Guarda cómo fue el bloque de trabajo que acaba (en rango, pico de watts y split medio) para el cierre.
function cerrarSerie(t) {
  const s = estado.sesion;
  const ib = s.inicioBloque;
  const b = s.bloqueAnterior >= 0 ? s.plan?.[s.bloqueAnterior] : null;
  s.inicioBloque = null;
  if (!ib || !G.esTrabajo(b)) return;
  const con = s.segConMeta - ib.con;
  const metros = s.dist - ib.dist;
  const dur = t - ib.t;
  s.series.push({ pct: con > 0 ? Math.round((100 * (s.segEnRango - ib.dentro)) / con) : null, picoW: ib.picoW, split: metros > 0 && dur > 0 ? Math.round((500 * dur) / metros) : 0 });
  // Sprints: si el pico cae más de un 15 % frente al mejor en dos series seguidas, se avisa una vez.
  if (s.guion === 'sprint' && !s.avisos.caePotencia && s.series.length >= 3) {
    const mejor = Math.max(...s.series.map((x) => x.picoW || 0));
    if (mejor > 0 && s.series.slice(-2).every((x) => x.picoW < mejor * 0.85)) {
      s.avisos.caePotencia = true;
      hablar(G.CAE_POTENCIA, { clave: 'cae-potencia', capa: G.CAPA.correccion });
    }
  }
}

// Avisos que dependen de cuánto falta del bloque: mitad de serie, prepárate, tiempo que queda y el final de una prueba.
function avisosDelBloque(i, b, fin, resta) {
  const s = estado.sesion;
  if (fin !== 'tiempo' || !(b.duracion > 0) || resta <= 0) return;
  const dicho = (k) => { const clave = `${k}-${i}`; if (s.avisos[clave]) return true; s.avisos[clave] = true; return false; };
  const trabajo = G.esTrabajo(b);
  if (trabajo && b.duracion >= 90 && resta === Math.round(b.duracion / 2)) {
    const mitad = G.mitadSerie(s.guion);
    if (mitad && !dicho('mitad')) hablar(mitad, { capa: G.CAPA.info });
  }
  if (trabajo && s.guion === 'fondo' && b.duracion >= 1200 && resta === Math.round(b.duracion / 4) && !dicho('deriva')) {
    hablar(G.DERIVA_FONDO, { clave: 'deriva', capa: G.CAPA.correccion });
  }
  if (trabajo && s.guion === 'prueba' && b.duracion >= 600 && resta === 180 && !dicho('vaciate')) hablar(G.VACIATE, { capa: G.CAPA.info });
  const cada = G.restanteCada(s.guion);
  if (trabajo && cada && resta % cada === 0 && resta < b.duracion && resta > 180 && !dicho(`resta${resta}`)) hablar(`Quedan ${tiempoHablado(resta)}`, { capa: G.CAPA.info });
  // Los 30 s finales de una serie de 1 min o más: voz y vibración propia.
  if (trabajo && b.duracion >= 60 && resta === 30 && !dicho('ult30')) { hablar('Últimos 30 segundos', { capa: G.CAPA.info }); vibrar(VIBRA.ultimos30); }
  // Fin de un descanso antes de una serie: a 10 s, «Prepárate».
  if (!trabajo && b.duracion >= 30 && resta === 10 && G.esTrabajo(s.plan[i + 1]) && !dicho('prep')) hablar(G.PREPARATE, { capa: G.CAPA.info });
}
