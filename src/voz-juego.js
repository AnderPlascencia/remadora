// Capa de juego de la voz (etapa 2 de los mensajes de voz): frases de cada clase y avisos del juego.
// Sin dependencias de la interfaz: la sesión decide cuándo llamar y voz.js si suena (todo va en la capa 3, ánimo).
//
// Reglas acordadas con el entrenador:
//  - Como mucho un aviso de juego cada 5 min; nunca en recuperación ni en pruebas, ni durante el trabajo de VO2 o
//    sprints, ni en los últimos 10 s de un esfuerzo (eso ya lo calla voz.js). La frase del entrenador va primero.
//  - Se dicen: racha y jefe al empezar, hitos de la hazaña de clase (25, 50, 75 y 100 %), la misión del plan al 75 %
//    de la sesión, «tu rival está a tiro» en el último 20 % de una carrera y el resumen de juego al terminar.
//  - La XP solo se dice en el resumen final; las piezas del bote nunca.
import { SIN_ANIMO, esTrabajo } from './guion-voz.js';

// ---------- Frases de clase ----------

// Cada frase lleva su momento: «esfuerzo» (trabajo de intervalos, metas, carreras) o «calma» (fondo, recuperación,
// técnica, remo libre y descansos). Cada clase tiene al menos 2 de cada.
const E = 'esfuerzo';
const C = 'calma';
export const FRASES_CLASE = {
  vikingo: [
    ['Cada palada, un hachazo', E], ['Rema como quien abre el mar', E], ['Los cuervos te miran: no aflojes', E],
    ['Fuerza en las piernas, guerrero', E], ['El Valhalla se gana palada a palada', C], ['Respira, guerrero; el mar espera', C],
  ],
  pirata: [
    ['Al abordaje, que se escapan', E], ['Viento en popa, marinero', C], ['Ese botín es tuyo', E],
    ['Rápido y sin aviso', E], ['Nadie le roba el tesoro a un pirata', C],
  ],
  samurai: [
    ['Forma perfecta, mente en calma', C], ['Cada palada igual que la anterior', C], ['Respira. Empuja. Recupera', C],
    ['La paciencia corta más que la espada', C], ['Sin prisa, sin pausa', C], ['Corta el agua. Ahora', E], ['Un solo corte, con todo', E],
  ],
  polinesio: [
    ['El océano entero es tu camino', C], ['Sigue las estrellas, navegante', C], ['Una ola más, y otra', E],
    ['Lejos se llega remando parejo', C], ['La isla está detrás del horizonte', E],
  ],
  romano: [
    ['Un romano no se rinde. Nunca', E], ['Paso de legión: firme y constante', C], ['Roma no se hizo en un día', C],
    ['Disciplina hoy, gloria mañana', E], ['Marca el ritmo, legionario', E],
  ],
};

// Momento del ánimo: calma en los tipos suaves y fuera de los bloques de trabajo; esfuerzo en el resto.
// suave: el tipo de sesión es de los que nunca piden más esfuerzo (guion-voz SUAVES).
export function momentoAnimo(suave, bloque = null) {
  if (suave) return C;
  if (bloque && !esTrabajo(bloque)) return C;
  return E;
}

// Frase de clase al azar, sin repetir en la sesión (usadas: Set que guarda la sesión). '' sin clase o sin frases.
export function fraseClase(clase, momento, usadas = new Set(), rnd = Math.random) {
  const todas = FRASES_CLASE[clase];
  if (!todas) return '';
  let libres = todas.filter(([t, m]) => m === momento && !usadas.has(t));
  if (!libres.length) {
    // Ya salieron todas las de este momento: vuelven a empezar.
    for (const [t, m] of todas) if (m === momento) usadas.delete(t);
    libres = todas.filter(([, m]) => m === momento);
  }
  if (!libres.length) return '';
  const [texto] = libres[Math.floor(rnd() * libres.length) % libres.length];
  usadas.add(texto);
  return texto;
}

// ---------- Cuándo puede sonar el juego ----------

export const ESPERA_JUEGO = 300;
const SIN_JUEGO = new Set(['recuperacion', 'prueba']);

// ¿Puede sonar ahora un aviso de juego? tipo: el del guion; bloque: el que se rema (o null);
// t: segundos de sesión; ultimo: t del último aviso de juego (o null).
export function juegoPuede(tipo, { bloque = null, t = 0, ultimo = null } = {}) {
  if (SIN_JUEGO.has(tipo)) return false;
  if (SIN_ANIMO.has(tipo) && esTrabajo(bloque)) return false;
  return ultimo == null || t - ultimo >= ESPERA_JUEGO;
}

// ---------- Al empezar ----------

const conArticulo = (nombre) => nombre.replace(/^El /, 'al ').replace(/^La /, 'a la ');

// Una sola frase al empezar: el jefe si lo enfrentas hoy y, si no, la racha (desde 2 días).
// jefe: nombre del jefe si esta sesión puede vencerlo; racha: días seguidos contando hoy.
export function avisoInicio({ racha = 0, jefe = '' } = {}) {
  if (jefe) return `Hoy te enfrentas ${conArticulo(jefe)}. Vence y abre el siguiente capítulo`;
  if (racha >= 2) return `Si cumples hoy, llevas ${racha} días de racha`;
  return '';
}

// ---------- Hazaña de clase ----------

export const HITOS = [25, 50, 75, 100];
// Hazañas que avanzan mientras remas (las demás se cuentan al guardar y van en el resumen final).
const EN_VIVO = { paladas: 'paladas', km: 'km' };

// Hitos que esta sesión puede cruzar en vivo. hazana: la de tu clase en estadoJuego().hazanas (con valor y meta).
// Devuelve [{ pct, faltan, medida }] (faltan: paladas o metros que quedan para el hito), o [] si no aplica.
export function hitosEnVivo(hazana) {
  if (!hazana || hazana.hecha) return [];
  const medida = EN_VIVO[hazana.unidad];
  if (!medida) return [];
  const valor = hazana.valor || 0;
  return HITOS.filter((p) => valor < (hazana.meta * p) / 100)
    .map((pct) => {
      const falta = (hazana.meta * pct) / 100 - valor;
      return { pct, medida, faltan: medida === 'km' ? falta * 1000 : falta };
    });
}

export function textoHito(nombre, pct) {
  return pct >= 100 ? `¡Hazaña cumplida! ${nombre}` : `${nombre}: vas al ${pct} por ciento`;
}

// ---------- Durante ----------

// Misión «Fiel al plan» cerca: al 75 % de la sesión del plan, si la misión de hoy sigue pendiente.
export const MISION_PLAN_75 = 'Tres cuartos de la sesión del plan. La misión Fiel al plan está cerca';

// Rival a tiro: en el último 20 % de una carrera a distancia, entre 5 y 30 m por detrás (dif < 0).
export function rivalATiro({ dist, meta, dif }) {
  if (!meta || dist < meta * 0.8 || dist >= meta) return '';
  if (dif > -5 || dif < -30) return '';
  return `Tu rival está a ${Math.round(-dif)} metros. Lo tienes`;
}

// ---------- Al terminar ----------

// Resumen de juego tras guardar. antes y despues: estadoJuego() sin y con la sesión; fecha: la de la sesión.
// Dice misiones cumplidas, jefe vencido, hito de hazaña de clase y la XP (solo aquí). '' si no hay nada.
export function resumenJuego(antes, despues, fecha, clase = null) {
  if (!antes || !despues) return '';
  const partes = [];
  const hechasAntes = new Set([...(antes.diarias || []), ...(antes.semanales || [])].filter((m) => m.hecha).map((m) => m.id));
  const nuevas = [...(despues.diarias || []), ...(despues.semanales || [])].filter((m) => m.hecha && !hechasAntes.has(m.id));
  if (nuevas.length === 1) partes.push(`Misión cumplida: ${nuevas[0].nombre}`);
  else if (nuevas.length > 1) partes.push(`${nuevas.length} misiones cumplidas`);
  const ses = despues.porSesion?.get?.(fecha);
  if (ses?.jefe) partes.push(`Venciste ${conArticulo(ses.jefe.nombre)}`);
  if (clase) {
    const id = `clase-${clase}`;
    const a = (antes.hazanas || []).find((h) => h.id === id);
    const d = (despues.hazanas || []).find((h) => h.id === id);
    if (a && d && !a.hecha) {
      const pct = (h) => (100 * (h.valor || 0)) / h.meta;
      const cruzado = HITOS.filter((p) => pct(a) < p && (pct(d) >= p || d.hecha)).at(-1);
      if (cruzado) partes.push(textoHito(d.nombre, d.hecha ? 100 : cruzado));
    }
  }
  if (ses) {
    const xp = Math.round((ses.xp || 0) + (ses.xpExtra || 0));
    if (xp > 0) partes.push(`Ganaste ${xp} de experiencia`);
    if (ses.nivelDespues > ses.nivelAntes) partes.push(`Subes al nivel ${ses.nivelDespues}`);
  }
  return partes.join('. ');
}
