// Habilidad de clase en carrera (etapa 5 del rediseño del héroe). Se activa sola cuando remas como lo haría tu
// cultura, sin tocar la pantalla, y da metros contra los fantasmas dentro del tope de 40 m de los talentos.
// Límites de la revisión del entrenador (10 nov 2026):
// - Solo en carreras y Remo libre: nunca en pruebas ni en sesiones del plan (ver apagarHabilidad).
// - Las de intensidad (Furia del berserker, ¡Al abordaje!) usan el permiso de intensidad (intensidad.js); si está
//   apagado, la clase usa su habilidad de constancia de reserva (vikingo → Timonel, pirata → Estrella guía).
// - Pago plano y sub-tope de 15 m por carrera para la habilidad. Ninguna de intensidad paga más que una de constancia.
// - Todo se mide sobre medias de 10 s (el dato bruto de la consola tiene ruido).

export const SUBTOPE_HABILIDAD_M = 15;

export const HABILIDADES = {
  furia: {
    nombre: 'Furia del berserker', intensidad: true, m: 4,
    texto: '20 s por encima del 110 % de tu FTP con la cadencia en 30 o menos: la fuerza va en cada palada. Hasta 2 veces por carrera (3 si pasa de 5 km), con 3 min entre una y otra.',
  },
  timonel: {
    nombre: 'Timonel', intensidad: false, m: 3,
    texto: '2 min con la palada un 5 % más larga que tu media y la cadencia en 24 o menos. Empuja con las piernas, con el mismo recorrido.',
  },
  abordaje: {
    nombre: '¡Al abordaje!', intensidad: true, m: 4,
    texto: 'A menos de 15 m detrás de un fantasma, 15 s un 10 % más fuerte que tu media de los últimos 30 s. Hasta 3 veces por carrera, con 90 s entre una y otra; no cuenta si te dejaste caer a propósito.',
  },
  zanshin: {
    nombre: 'Zanshin', intensidad: false, m: 6,
    texto: 'En los últimos 250 m de una carrera a distancia, la cadencia estable (±1) y los vatios sin caer más de un 10 %.',
  },
  estrella: {
    nombre: 'Estrella guía', intensidad: false, m: 3,
    texto: '4 min con el ritmo parejo, dentro de un ±2 %.',
  },
  pausarius: {
    nombre: 'Ritmo del pausarius', intensidad: false, m: 3,
    texto: '3 min con la cadencia de tus 2 primeros minutos (entre 18 y 28, ±1) y al menos el 60 % de tu FTP.',
  },
};

// Habilidad de una clase según su senda: el vikingo Berserker (senda B) tiene la Furia; el resto del vikingo, el Timonel.
export function habilidadDe(clase, senda = 'a') {
  if (clase === 'vikingo') return senda === 'b' ? 'furia' : 'timonel';
  return { pirata: 'abordaje', samurai: 'zanshin', polinesio: 'estrella', romano: 'pausarius' }[clase] || null;
}
// La de constancia que la sustituye cuando la intensidad descansa.
export const RESERVA = { furia: 'timonel', abordaje: 'estrella' };

const media = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);

// ftp: tu FTP; ftpFiable: viene de una prueba de las últimas 8 semanas (si no, el 110 % sale de tu media de 2 min + 15 %).
// mppMedia: tus metros por palada habituales. final = { meta } o { duracion }.
export function nuevaHabilidad({ clase, senda = 'a', ftp = 0, ftpFiable = true, mppMedia = 0, final = null, intensidadActiva = true } = {}) {
  const base = habilidadDe(clase, senda);
  if (!base) return null;
  const id = !intensidadActiva && RESERVA[base] ? RESERVA[base] : base;
  return {
    id, base, ftp, ftpFiable, mppMedia, final, apagada: false,
    m: 0, activaciones: [], hist: [], racha: 0, inicio: null, zanshin: null, objetivoSpm: null, eventos: [],
  };
}

export const apagarHabilidad = (h) => { if (h) h.apagada = true; };
export const nombreHabilidad = (h) => (h ? HABILIDADES[h.id].nombre : '');

// Cuánto se puede activar ahora una de intensidad (lo decide el permiso de la carrera: ventaja.intensidad).
function permitida(h, intensidad, t) {
  if (!HABILIDADES[h.id].intensidad) return true;
  if (!intensidad?.activa) return false;
  if (!intensidad.calentado && t < 300) return false;
  return true;
}

// Paga la habilidad: plano, con su sub-tope de 15 m. Devuelve los metros que se suman a la ventaja.
function pagar(h, t) {
  const m = Math.min(HABILIDADES[h.id].m, SUBTOPE_HABILIDAD_M - h.m);
  if (m <= 0) return 0;
  h.m += m;
  h.activaciones.push(t);
  h.eventos.push({ t, nombre: HABILIDADES[h.id].nombre, m });
  return m;
}

// Un segundo de carrera: { t, dist, paladas, spm, w, brecha (m hasta el fantasma de delante, o null) }.
// intensidad = ventaja.intensidad (activa, calentado, maxActivaciones); usadas = { talentos: activaciones de
// intensidad de los talentos en esta carrera, compartidas: las que comparten el contador (Mano rápida con el Abordaje) }.
// Devuelve los metros ganados.
export function avanzarHabilidad(h, { t, dist, paladas, spm = 0, w = 0, brecha = null }, intensidad = null, usadas = {}) {
  if (!h || h.apagada) return 0;
  h.hist.push({ t, dist, paladas, spm, w, brecha });
  if (h.hist.length > 300) h.hist.shift();
  const ult = (n) => h.hist.slice(-n);
  const m10 = (k) => media(ult(10).map((x) => x[k]));
  const ultima = h.activaciones.at(-1) ?? -Infinity;
  const intensa = HABILIDADES[h.id].intensidad;
  const maxInt = intensidad?.maxActivaciones;
  // Cupo: el propio de la habilidad (con las que comparten contador) y, las primeras 4 semanas, 1 de intensidad
  // por carrera contando también los talentos.
  const cupo = (max) => h.activaciones.length + (usadas.compartidas || 0) < max
    && (!intensa || maxInt == null || h.activaciones.length + (usadas.talentos || 0) < maxInt);
  switch (h.id) {
    case 'furia': {
      // Umbral: 110 % del FTP, o tu media de los últimos 2 min + 15 % si el FTP no es de una prueba reciente.
      const prev = h.hist.slice(-140, -20);
      const umbral = h.ftpFiable && h.ftp > 0 ? h.ftp * 1.1 : media(prev.map((x) => x.w)) * 1.15;
      const ok = umbral > 0 && w > umbral && spm > 0 && spm <= 30;
      h.racha = ok ? h.racha + 1 : 0;
      const max = (h.final?.meta || 0) > 5000 ? 3 : 2;
      if (h.racha >= 20 && t - ultima >= 180 && cupo(max) && permitida(h, intensidad, t)) { h.racha = 0; return pagar(h, t); }
      return 0;
    }
    case 'abordaje': {
      // Acelerón: 15 s un 10 % por encima de tu media de los 30 s anteriores, a menos de 15 m del fantasma.
      if (brecha == null || brecha > 15) { h.racha = 0; return 0; }
      if (!h.racha) h.refW = media(h.hist.slice(-31, -1).map((x) => x.w));
      h.racha = h.refW > 0 && w >= h.refW * 1.1 ? h.racha + 1 : 0;
      if (h.racha < 15) return 0;
      h.racha = 0;
      // No cobra si te dejaste caer: hace un minuto no ibas más de 5 m mejor que al empezar el acelerón.
      const antes = h.hist.length > 75 ? h.hist[h.hist.length - 76].brecha : null;
      const inicio = h.hist[h.hist.length - 15].brecha;
      const caido = antes == null ? false : antes < inicio - 5;
      if (caido || t - ultima < 90 || !cupo(3) || !permitida(h, intensidad, t)) return 0;
      return pagar(h, t);
    }
    case 'timonel': {
      const mpp = (() => { const a = ult(11); return a.length > 1 && a.at(-1).paladas - a[0].paladas > 0 ? (a.at(-1).dist - a[0].dist) / (a.at(-1).paladas - a[0].paladas) : 0; })();
      const ok = h.mppMedia > 0 && mpp >= h.mppMedia * 1.05 && m10('spm') > 0 && m10('spm') <= 24;
      h.racha = ok ? h.racha + 1 : 0;
      if (h.racha >= 120) { h.racha = 0; return pagar(h, t); }
      return 0;
    }
    case 'estrella': {
      // Ritmo de cada segundo (m/s) en medias de 10 s, frente a la media de los 4 min.
      const v = (a, b) => (b.t > a.t ? (b.dist - a.dist) / (b.t - a.t) : 0);
      const va = ult(11);
      const vel = va.length > 1 ? v(va[0], va.at(-1)) : 0;
      if (!h.inicio || vel <= 0) { h.inicio = vel > 0 ? { t, dist, vels: [vel] } : null; return 0; }
      h.inicio.vels.push(vel);
      const ref = (dist - h.inicio.dist) / Math.max(1, t - h.inicio.t);
      if (h.inicio.vels.some((x) => Math.abs(x / ref - 1) > 0.02) && t - h.inicio.t > 10) {
        // Se rompió el ritmo: empieza otro tramo desde aquí.
        h.inicio = { t, dist, vels: [vel] };
        return 0;
      }
      if (t - h.inicio.t >= 240) { h.inicio = null; return pagar(h, t); }
      return 0;
    }
    case 'pausarius': {
      // Objetivo: tu cadencia media de los 2 primeros minutos, entre 18 y 28.
      if (t <= 120) { if (t === 120) h.objetivoSpm = Math.min(28, Math.max(18, Math.round(media(h.hist.map((x) => x.spm).filter((x) => x > 0))))); return 0; }
      if (h.objetivoSpm == null) h.objetivoSpm = Math.min(28, Math.max(18, Math.round(media(h.hist.slice(0, 120).map((x) => x.spm).filter((x) => x > 0)) || 22)));
      const ok = Math.abs(m10('spm') - h.objetivoSpm) <= 1 && (!h.ftp || m10('w') >= h.ftp * 0.6);
      h.racha = ok ? h.racha + 1 : 0;
      if (h.racha >= 180) { h.racha = 0; return pagar(h, t); }
      return 0;
    }
    case 'zanshin': {
      const meta = h.final?.meta;
      if (!meta || h.zanshin?.hecho) return 0;
      if (dist >= meta - 250 && !h.zanshin) { h.zanshin = { spm: m10('spm'), w: m10('w'), ok: true }; return 0; }
      if (!h.zanshin) return 0;
      if (Math.abs(m10('spm') - h.zanshin.spm) > 1 || m10('w') < h.zanshin.w * 0.9) h.zanshin.ok = false;
      if (dist >= meta) { h.zanshin.hecho = true; return h.zanshin.ok ? pagar(h, t) : 0; }
      return 0;
    }
    default:
      return 0;
  }
}

// ¿Usó intensidad? (para el límite semanal)
export const usoIntensidad = (h) => !!h && HABILIDADES[h.id].intensidad && h.activaciones.length > 0;
