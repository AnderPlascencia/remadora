// Guion de la voz del entrenador: qué decir según el tipo de sesión y su objetivo. Sin dependencias de la interfaz.
//
// Cada frase va en una de tres capas (voz.js decide si suena):
//   1 información (qué toca, cuánto falta, cuenta atrás): siempre suena.
//   2 corrección de intensidad o de técnica, con el foco del tipo de sesión.
//   3 motivación: ánimo del entrenador (y, más adelante, la clase y el juego).
// Tipos del guion: los de capacidades.js (fondo, umbral, vo2, sprint, tecnica, calorias, prueba) más
// 'recuperacion' (un fondo muy suave), 'objetivo' (distancia o paladas sin rangos) y 'libre' (sin entrenamiento).

export const CAPA = { info: 1, correccion: 2, animo: 3 };

const NOMBRES_TIPO = {
  fondo: 'Fondo', umbral: 'Umbral', vo2: 'VO2', sprint: 'Sprints', tecnica: 'Técnica', calorias: 'Gasto calórico',
  prueba: 'Prueba', recuperacion: 'Recuperación', objetivo: 'Meta', libre: 'Remo libre',
};
export const nombreTipo = (tipo) => NOMBRES_TIPO[tipo] || 'Sesión';

const TRABAJO = (b) => !!b && !b.guiado && !/^(calentamiento|enfriamiento|descanso|suave|activaci)/i.test(b.nombre || '');
export const esTrabajo = TRABAJO;
// Tipos con esfuerzos duros: en sus bloques de trabajo se calla la capa 2 y 3 en los últimos 10 s.
export const DUROS = new Set(['umbral', 'vo2', 'sprint', 'prueba']);
// Tipos donde nunca se pide más esfuerzo («aprieta») ni suena el juego.
export const SUAVES = new Set(['fondo', 'recuperacion', 'tecnica', 'libre']);

// Tipo del guion. tipoPlan: el de capacidades.tipoPlan(ent) (ya calculado en la sesión).
export function tipoGuion(ent, tipoPlan) {
  if (!ent) return 'libre';
  if (tipoPlan === 'prueba') return 'prueba';
  if (esRecuperacion(ent)) return 'recuperacion';
  if (tipoPlan) {
    // Un objetivo de distancia sin rangos no es un fondo: es una meta que se reparte.
    if (tipoPlan === 'fondo' && ent.objetivo && ent.objetivo.metrica !== 'kcal') return 'objetivo';
    return tipoPlan;
  }
  return ent.objetivo?.metrica === 'kcal' ? 'calorias' : 'objetivo';
}

// Recuperación: el nombre lo dice, o todo el trabajo va por debajo del 65 % del FTP o del 65 % del pulso de referencia.
export function esRecuperacion(ent) {
  if (/recupera|regenera|muy suave|fondo suave/i.test(ent?.nombre || '')) return true;
  const trabajo = (ent?.bloques || []).filter((b) => TRABAJO(b) && b.metrica);
  if (!trabajo.length) return false;
  return trabajo.every((b) => (b.metrica === 'ftp' && b.max <= 65) || (b.metrica === 'fcpct' && b.max <= 65));
}

const minutos = (seg) => {
  const m = Math.round(seg / 60);
  return m === 1 ? '1 minuto' : `${m} minutos`;
};

// Serie de un bloque de trabajo: { n, total } o null. Sale del nombre («Umbral 2/3»); en técnica, sin número
// en el nombre, cuenta todos los bloques de trabajo (la pirámide de paladas son 5 series de distinto largo).
export function serieDe(plan, i, tipo = '') {
  const b = plan?.[i];
  if (!TRABAJO(b)) return null;
  const m = (b.nombre || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (m && Number(m[2]) >= 2) return { n: Number(m[1]), total: Number(m[2]) };
  if (tipo !== 'tecnica') return null;
  const trabajo = plan.map((x, k) => [x, k]).filter(([x]) => TRABAJO(x));
  return trabajo.length >= 2 ? { n: trabajo.findIndex(([, k]) => k === i) + 1, total: trabajo.length } : null;
}

// ---------- Propósito al empezar ----------

// Para qué es la sesión y cómo debe sentirse. ent: el entrenamiento; plan: sus bloques ya normalizados.
// ctx: { carrera, objetivoPlan } (objetivoPlan = el texto del objetivo del plan, si la sesión es del plan).
export function proposito(tipo, ent, plan = null, { carrera = false, objetivoPlan = '' } = {}) {
  const trabajo = (plan || []).filter(TRABAJO);
  const series = trabajo.length;
  const durTrabajo = trabajo.reduce((a, b) => a + (b.duracion || 0), 0);
  const meta = objetivoPlan ? ` Suma para tu objetivo: ${objetivoPlan}.` : '';
  const vs = carrera ? ' Salida fuerte 20 paladas y luego a tu ritmo.' : '';
  switch (tipo) {
    case 'fondo':
      return `Fondo${durTrabajo ? ` de ${minutos(durTrabajo)}` : ''}. Debes poder hablar mientras remas. Hoy gana quien se contiene.${meta}`;
    case 'recuperacion':
      return `Recuperación. Muy suave: la sesión es para que mañana rindas.${meta}`;
    case 'umbral':
      return `Umbral${series > 1 ? `, ${series} series` : ''}. Incómodo pero sostenible, frases cortas, nada de sprints.${meta}`;
    case 'vo2':
      return `VO2${series > 1 ? `, ${series} series` : ''}. Duras de verdad. Respira profundo en los descansos.${meta}`;
    case 'sprint':
      return `Sprints${series > 1 ? `, ${series}` : ''}. Máxima potencia; los descansos son largos a propósito, respétalos.${meta}`;
    case 'tecnica':
      return `Técnica. Hoy importa cómo, no cuánto.${meta}`;
    case 'calorias':
      return `Gasto calórico. Ritmo que puedas sostener; las calorías salen de la constancia.${meta}`;
    case 'prueba':
      return 'Prueba. Reparte el esfuerzo: sal un poco por debajo y vacíate al final.';
    case 'objetivo': {
      const o = ent?.objetivo;
      const que = o?.metrica === 'distancia' ? `${o.valor} metros` : o?.metrica === 'paladas' ? `${o.valor} paladas` : '';
      return `Meta${que ? `: ${que}` : ''}. Reparte: los primeros minutos controlados.${vs}${meta}`;
    }
    default:
      return '';
  }
}

// ---------- Serie a serie ----------

// Frase extra al empezar una serie: «Serie 3 de 5» y, en la penúltima y la última, la del tipo.
export function inicioSerie(tipo, serie) {
  if (!serie) return '';
  const { n, total } = serie;
  const base = `Serie ${n} de ${total}`;
  if (n === total) {
    const ultima = { vo2: 'Última. Todo lo que queda', sprint: 'Último sprint, a tope', umbral: 'Última. Mantén el número hasta el final', prueba: '' }[tipo];
    return ultima ? `${base}. ${ultima}` : `${base}. La última`;
  }
  if (n === total - 1 && total >= 3) {
    const penultima = { umbral: 'Aquí se entrena el umbral. Mantén el número', vo2: 'Penúltima. Aguanta la técnica', sprint: 'Penúltimo. Misma potencia que el primero' }[tipo];
    if (penultima) return `${base}. ${penultima}`;
  }
  return base;
}

// A mitad de una serie por tiempo de 90 s o más.
export function mitadSerie(tipo) {
  if (tipo === 'umbral') return 'Mitad. Igual que el primer minuto';
  if (tipo === 'vo2' || tipo === 'sprint') return 'Mitad';
  if (tipo === 'prueba') return 'Mitad. Si vas bien, mantén';
  return '';
}

// Al empezar un descanso tras una serie dura: cómo fue y qué hacer ahora. datos: { pct, split, picoW }.
export function trasSerie(tipo, { pct = null, split = '', picoW = 0 } = {}) {
  if (tipo === 'sprint') return picoW ? `${Math.round(picoW)} watts. Descansa de verdad` : 'Descansa de verdad';
  if (tipo !== 'vo2' && tipo !== 'umbral') return '';
  const como = pct == null ? 'Serie hecha' : pct >= 70 ? 'Buena serie' : 'Serie hecha';
  return `${como}${split ? `, ${split} de media` : ''}. Suelta brazos, respira`;
}

// Últimos segundos de un descanso antes de una serie.
export const PREPARATE = 'Prepárate';

// ---------- Correcciones ----------

// Corrección cuando se sale del rango del bloque. Devuelve el texto o '' para callar.
// c: { rango: 'bajo'|'alto', potencia, pulso, cadencia (spm actual), spmMin, spmMax, serie: {n,total}|null,
//      enSerieSeg (segundos dentro del bloque), fueraSeg (segundos seguidos fuera), trabajo (bloque de trabajo) }
export function correccion(tipo, c) {
  const { rango, potencia = false, pulso = false, serie = null, enSerieSeg = 0, fueraSeg = 0, trabajo = true } = c;
  if (!rango || rango === 'dentro') return '';
  const subir = potencia ? 'Sube la potencia' : 'Sube el ritmo';
  const bajar = potencia ? 'Baja la potencia' : 'Baja el ritmo';
  if (!trabajo) {
    // Calentamientos y descansos no se corrigen, salvo remar fuerte en el descanso de sprints y VO2.
    return rango === 'alto' && (tipo === 'sprint' || tipo === 'vo2') ? 'Descanso de verdad, la próxima serie lo necesita' : '';
  }
  if (pulso) return rango === 'bajo' ? 'Pulso bajo, sube un poco' : (tipo === 'fondo' || tipo === 'recuperacion' ? 'Pulso alto, suelta un poco' : 'Pulso alto, baja la intensidad');
  if (c.cadencia && c.spmMin) {
    return rango === 'alto' ? `Cadencia ${Math.round(c.cadencia)}, la meta es ${c.spmMin} a ${c.spmMax}. Frena la vuelta`
      : `Cadencia ${Math.round(c.cadencia)}, sube a ${c.spmMin}. Empuja con las piernas`;
  }
  switch (tipo) {
    case 'recuperacion':
      return rango === 'alto' ? 'Demasiado fuerte para recuperar. Suelta' : '';
    case 'fondo':
      return rango === 'alto' ? 'Te pasas para un fondo. Suelta un poco' : 'Sube un poco, sin forzar';
    case 'umbral':
      if (rango === 'alto' && enSerieSeg <= 75) return `Sales muy fuerte, ${potencia ? 'baja 10 watts' : 'baja un poco'}. La serie se gana al final`;
      return rango === 'alto' ? bajar : subir;
    case 'vo2':
      if (rango === 'bajo') return fueraSeg >= 15 ? 'Sube, estás en umbral' : '';
      // Por encima: en las 2 primeras series no se dice nada; luego, que dosifique.
      if (!serie || serie.n <= 2) return '';
      return serie.total - serie.n >= 1 ? `Dosifica, quedan ${serie.total - serie.n + 1}` : '';
    case 'sprint':
      // En un sprint se rema a tope: no hay nada que corregir en voz.
      return '';
    default:
      return rango === 'alto' ? bajar : subir;
  }
}

// Ritmo que cae en una sesión sin rangos (meta de distancia o remo libre con ritmo objetivo).
export function ritmoCae(tipo, ritmoTexto = '') {
  if (tipo === 'recuperacion' || tipo === 'fondo' || tipo === 'tecnica') return '';
  return ritmoTexto ? `Vas más lento que tu ritmo objetivo de ${ritmoTexto}. Aprieta` : 'Estás bajando el ritmo. Aprieta';
}

// Fondo: cadencia demasiado alta.
export const CADENCIA_ALTA_FONDO = 'Baja la cadencia, alarga la palada';
// Fondo: la última cuarta parte, cuando suele subir el pulso.
export const DERIVA_FONDO = 'Si el pulso sube a los mismos watts es fatiga normal. Mantén los watts, no el pulso';
// Sprints: la potencia cae entre series.
export const CAE_POTENCIA = 'La potencia está cayendo. Alarga un poco el descanso';
// Pruebas: los 3 últimos minutos de un bloque largo.
export const VACIATE = 'Últimos 3 minutos, vacíate';

// ---------- Parciales y ánimos ----------

// Cada cuántos metros se dice el parcial (0 = nunca). bloque: el bloque en curso, o null.
export function parcialCada(tipo, bloque = null) {
  if (tipo === 'recuperacion' || tipo === 'sprint') return 0;
  // En series cortas el parcial interrumpe el esfuerzo.
  if (bloque && TRABAJO(bloque) && (bloque.fin || 'tiempo') === 'tiempo' && bloque.duracion < 90) return 0;
  if (tipo === 'vo2') return 0;
  if (tipo === 'fondo' || tipo === 'libre' || tipo === 'tecnica') return 1000;
  return 500;
}

// Cada cuántos segundos se recuerda el tiempo que queda (0 = nunca): recuperación y pruebas largas.
export function restanteCada(tipo) {
  return tipo === 'recuperacion' || tipo === 'prueba' ? 300 : 0;
}

// Consejos del entrenador para la capa 3, por tipo. Sin clase, se alternan con los ánimos de siempre.
const CONSEJOS = {
  fondo: ['Relaja hombros y manos', 'Respira por la nariz si puedes', 'Piernas, espalda, brazos', 'Palada larga, vuelta lenta', 'Así se construye el motor'],
  recuperacion: ['Suelta los hombros', 'Respira tranquilo', 'Suave también es entrenar'],
  libre: ['Piernas, espalda, brazos', 'Relaja hombros y manos', 'Palada larga, vuelta lenta'],
  tecnica: ['Piernas primero, brazos al final', 'Vuelta lenta: el doble de tiempo que la palada', 'Sin tirones en la entrada', 'Manos a la misma altura', 'Espalda firme al final de la palada'],
  umbral: ['Respira y mantén el número', 'Constancia: cada minuto igual', 'Relaja la cara y las manos'],
  calorias: ['Ritmo constante, las calorías salen solas', 'Piernas, espalda, brazos', 'Respira y mantén el ritmo'],
  objetivo: ['Palada larga y constante', 'Respira y mantén el ritmo', 'Piernas, espalda, brazos'],
};
// Tipos que no llevan capa 3 durante el trabajo.
export const SIN_ANIMO = new Set(['vo2', 'sprint', 'prueba']);
export function consejo(tipo, n) {
  const lista = CONSEJOS[tipo];
  return lista ? lista[n % lista.length] : '';
}

// Foco de técnica para un bloque sin consejo propio, rotando por el número de serie.
const FOCOS_TECNICA = ['Piernas primero, brazos al final', 'Vuelta lenta: el doble de tiempo que la palada', 'Sin tirones en la entrada'];
export const focoTecnica = (n) => FOCOS_TECNICA[n % FOCOS_TECNICA.length];

// ---------- Cierre ----------

// Si se cumplió el propósito, dicho como entrenador. d: { pctRango, series: [{ pct, picoW }], cadenciaPct, metros }.
export function cierre(tipo, d = {}) {
  const { pctRango = null, series = [] } = d;
  const enRango = series.filter((s) => s.pct != null && s.pct >= 70).length;
  const pct = pctRango != null ? `${pctRango} por ciento en rango` : '';
  switch (tipo) {
    case 'fondo':
      return pctRango == null ? 'Fondo terminado. Así se construye el motor'
        : pctRango >= 80 ? `Fondo bien hecho: ${pct}. Así se construye el motor` : `Fondo terminado: ${pct}. La próxima, más contenido`;
    case 'recuperacion':
      return pctRango == null || pctRango >= 80 ? 'Recuperación bien hecha. Mañana lo notarás' : 'Recuperación terminada. La próxima, todavía más suave';
    case 'umbral':
      return series.length ? `Umbral cumplido: ${enRango} de ${series.length} series en rango. Eso es control` : `Umbral terminado${pct ? `: ${pct}` : ''}`;
    case 'vo2':
      return series.length ? `VO2 terminado: ${enRango} de ${series.length} series en rango. Esto sube tu techo` : 'VO2 terminado. Esto sube tu techo';
    case 'sprint': {
      const picos = series.map((s) => s.picoW || 0).filter((w) => w > 0);
      if (!picos.length) return 'Sprints terminados';
      const mejor = Math.max(...picos);
      const caida = Math.max(0, Math.round((100 * (mejor - picos.at(-1))) / mejor));
      return `Sprints terminados. Pico de ${Math.round(mejor)} watts, ${caida} por ciento de caída al final`;
    }
    case 'tecnica':
      return d.cadenciaPct != null ? `Técnica terminada: cadencia en rango el ${d.cadenciaPct} por ciento del tiempo` : 'Técnica terminada';
    case 'prueba':
      return 'Prueba terminada';
    default:
      return pct ? `Entrenamiento completado. Estuviste en rango el ${pctRango} por ciento del tiempo` : 'Entrenamiento completado';
  }
}
