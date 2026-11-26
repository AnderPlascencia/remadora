// Capacidades físicas: qué entrenó cada sesión, sus datos clave y cómo va cada capacidad en el tiempo.
// Sin dependencias de la interfaz. Las cifras salen de estadisticas.js; aquí solo se agrupan y se leen.
import * as E from './estadisticas.js';
import { pulsoDePct, refPulso, ZONA2, efectoPrevio } from './pulso.js';

const DIA = 864e5;
const VENTANA = 42 * DIA; // 6 semanas: lo que tarda en notarse un bloque de entrenamiento
const media = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
const decimal = (x, d = 1) => x.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- Tipo de sesión ----------

export const TIPOS = {
  fondo: { nombre: 'Base aeróbica', simple: 'Fondo' },
  umbral: { nombre: 'Umbral', simple: 'Ritmo fuerte sostenido' },
  vo2: { nombre: 'VO₂máx', simple: 'Series fuertes' },
  sprint: { nombre: 'Potencia y sprint', simple: 'Sprints' },
  tecnica: { nombre: 'Técnica', simple: 'Técnica' },
  calorias: { nombre: 'Gasto calórico', simple: 'Quemar calorías' },
  prueba: { nombre: 'Prueba', simple: 'Prueba' },
};

// Segundos remados por encima de una fracción del FTP (con las muestras o con el resumen de la sesión).
const segSobre = (s, ftp, frac) => E.segundosCon(s, (w) => w > ftp * frac);

// Qué capacidad entrenó la sesión, según cuánto tiempo pasó en cada intensidad.
export function tipoSesion(s, ftp) {
  const n = E.nMuestras(s);
  if (s.pruebaWatts || /^prueba/i.test(s.entrenamiento || '')) return 'prueba';
  if (s.enfoque === 'calorias' || /calor|kcal/i.test(s.entrenamiento || '')) return 'calorias';
  const f = s.ftp || ftp;
  if (f && n) {
    // Las series de VO₂ (106–120 %) pueden tener algún pico por encima: cuentan como VO₂ si ese tramo domina.
    if (segSobre(s, f, 1.05) - segSobre(s, f, 1.2) >= 240) return 'vo2';
    if (segSobre(s, f, 1.2) >= 60 && segSobre(s, f, 1.2) >= n * 0.03) return 'sprint';
    if (segSobre(s, f, 0.9) >= 600) return 'umbral';
  }
  if (s.enfoque === 'tecnica' || /palada|cadencia|técnica|tecnica/i.test(s.entrenamiento || '')) return 'tecnica';
  return 'fondo';
}

// ---------- Análisis de una sesión ----------

// Tres datos clave según el tipo, más la recuperación de pulso si se midió, y una frase que lo lee.
// datos: [{ etq, valor, ayuda }]. fcMax opcional (para la zona de pulso).
export function analisisSesion(s, { ftp = 0, fcMax = 0 } = {}) {
  const tipo = tipoSesion(s, ftp);
  const m = s.muestras || [];
  const f = s.ftp || ftp;
  const min = (seg) => `${Math.round(seg / 60)} min`;
  const datos = [];
  let lectura = '';
  const tec = E.tecnica(s);
  const desacople = s.desacople ?? E.desacople(m);
  if (tipo === 'fondo') {
    const zona = refPulso(fcMax).max && s.fcProm ? E.zonaFc(s.fcProm, fcMax) : null;
    datos.push({ etq: 'Pulso medio', valor: s.fcProm ? `${s.fcProm} lpm${zona ? ` · Z${zona.n}` : ''}` : '-', ayuda: 'En fondo conviene la zona 2.' });
    // Sin desacople (sesión corta o sin reloj) no se pinta un dato vacío: la lectura de abajo dice cómo medirlo.
    if (desacople != null) datos.push({ etq: 'Desacople', valor: `${decimal(desacople)} %`, ayuda: 'Cuánto se despegó el pulso de los watts entre la 1.ª y la 2.ª mitad.' });
    datos.push({ etq: 'Metros/palada', valor: tec.metrosPorPalada != null ? decimal(tec.metrosPorPalada) : '-', ayuda: 'Más metros con el mismo esfuerzo = mejor técnica.' });
    if (desacople == null) lectura = s.fcProm ? 'Rema 25 min o más seguidos con el reloj para medir tu motor aeróbico.' : 'Conecta el reloj para medir cómo responde tu corazón en los fondos.';
    else if (desacople < 5) lectura = 'Motor aeróbico sólido: tu pulso no se despegó de los watts.';
    else lectura = `Tu pulso subió un ${decimal(desacople)} % respecto a los watts: fondos más largos y suaves te harán aguantar mejor.`;
  } else if (tipo === 'umbral') {
    datos.push({ etq: 'En zona 4 o más', valor: f ? min(segSobre(s, f, 0.9)) : '-', ayuda: 'Minutos por encima del 90 % de tu FTP.' });
    const ifac = s.intensidad ?? E.factorIntensidad(m, f);
    datos.push({ etq: 'Intensidad', valor: ifac != null ? decimal(ifac, 2) : '-', ayuda: 'Potencia normalizada / FTP. 0,85–0,95 es una buena sesión de umbral.' });
    datos.push({ etq: 'En rango', valor: s.pctEnRango != null ? `${s.pctEnRango} %` : '-', ayuda: 'Tiempo dentro de la meta de cada intervalo.' });
    lectura = s.pctEnRango == null ? 'Sesión de umbral: la que más sube tu FTP.'
      : s.pctEnRango >= 80 ? 'Umbral bien ejecutado: así sube tu FTP.' : 'Te costó mantener el rango: la próxima vez empieza el bloque un poco más suave.';
  } else if (tipo === 'vo2') {
    datos.push({ etq: 'Sobre el 106 %', valor: f ? min(segSobre(s, f, 1.05)) : '-', ayuda: 'Para mejorar el VO₂máx sirven de 12 a 20 min en total.' });
    const w5 = E.mejorPotencia(m, 300);
    datos.push({ etq: 'Mejor 5 min', valor: w5 ? `${w5} W` : '-', ayuda: 'La potencia que mejor predice tu VO₂máx.' });
    datos.push({ etq: 'Pulso máx', valor: s.fcMax ? `${s.fcMax} lpm` : '-', ayuda: 'En series de VO₂ el pulso debería llegar cerca de tu máximo.' });
    const t = f ? segSobre(s, f, 1.05) : 0;
    lectura = t >= 720 ? 'Dosis completa de VO₂máx: descansa o rema suave mañana.' : 'Sesión de VO₂máx corta: suma minutos fuertes poco a poco, semana a semana.';
  } else if (tipo === 'sprint') {
    datos.push({ etq: 'Potencia máx', valor: s.wattsMax ? `${s.wattsMax} W` : '-', ayuda: 'El pico de la sesión.' });
    const w10 = E.mejorPotencia(m, 10);
    datos.push({ etq: 'Mejor 10 s', valor: w10 ? `${w10} W` : '-', ayuda: 'Tu potencia explosiva.' });
    datos.push({ etq: 'Trabajo/palada', valor: tec.joulesPorPalada ? `${tec.joulesPorPalada} J` : '-', ayuda: 'Fuerza media de cada palada.' });
    lectura = 'Sprints: suben tu fuerza por palada y tu arranque en las carreras.';
  } else if (tipo === 'tecnica') {
    datos.push({ etq: 'Metros/palada', valor: tec.metrosPorPalada ?? '-', ayuda: 'Cuánto avanzas con cada palada.' });
    datos.push({ etq: 'Golpes/min', valor: s.spmProm ?? '-', ayuda: 'Cadencia media.' });
    datos.push({ etq: 'En rango', valor: s.pctEnRango != null ? `${s.pctEnRango} %` : '-', ayuda: 'Tiempo dentro de la cadencia pedida.' });
    lectura = 'Técnica: paladas largas y parejas te dan metros gratis en cualquier sesión.';
  } else if (tipo === 'calorias') {
    datos.push({ etq: 'Calorías', valor: s.kcal ?? '-', ayuda: 'Estimadas con tus watts y tu peso.' });
    datos.push({ etq: 'Calorías/hora', valor: s.duracion ? Math.round((s.kcal * 3600) / s.duracion) : '-', ayuda: 'Ritmo de gasto.' });
    datos.push({ etq: 'Trabajo', valor: `${s.kj ?? E.trabajoKj(m)} kJ`, ayuda: `Energía que entregaste al volante: tu cuerpo gastó unas ${E.kcalDeKj(s.kj ?? E.trabajoKj(m))} kcal (1 kJ ≈ 1,2 kcal).` });
    lectura = 'Para quemar más, suma minutos en zona 2: es lo que más calorías da con menos fatiga.';
  } else {
    datos.push({ etq: 'Watts prom', valor: s.pruebaWatts ? `${s.pruebaWatts} W` : `${s.wattsProm} W`, ayuda: 'Media del tramo de prueba.' });
    datos.push({ etq: 'Pulso máx', valor: s.fcMax ? `${s.fcMax} lpm` : '-', ayuda: 'Sirve para afinar tu pulso máximo.' });
    datos.push({ etq: 'Esfuerzo', valor: E.rpeDe(s) ? `${E.rpeDe(s)} de 10${E.rpeSentido(s) ? '' : ' (pulso)'}` : '-', ayuda: 'Una prueba bien hecha debería sentirse 9 o 10.' });
    lectura = 'Prueba hecha: tus zonas y tus planes se recalculan con este resultado.';
  }
  if (s.fcRec60 != null) {
    datos.push({ etq: 'Pulso bajó en 1 min', valor: `${s.fcRec60} lpm`, ayuda: 'Lo que bajó tu pulso en el minuto siguiente a terminar. Más de 12 es normal; más de 30, muy bueno.' });
  }
  return { tipo, ...TIPOS[tipo], datos, lectura };
}

// Cómo se titula la capacidad entrenada en el resumen. Si los watts no se parecen al plan (un fondo remado a
// tirones), se dice «Tus watts parecieron de…» y se nombra el plan, en vez de un «Entrenaste Sprints» que lo contradice.
export function tituloCapacidad(tipo, tipoPlan) {
  const plan = tipoPlan && tipoPlan !== 'prueba' && tipoPlan !== tipo && TIPOS[tipoPlan] ? TIPOS[tipoPlan] : null;
  return { etiqueta: plan ? 'Tus watts parecieron de' : 'Entrenaste', plan };
}

// Resumen honesto (ronda 2, UX2-17): una sesión del plan cortada antes del 80 % no se titula como si se hubiera
// hecho («Fondo · 1 de 38 min»), y un fondo con el pulso medio en zona 4 o 5 lo dice sin regañar.
// Devuelve { corta: { hechos, plan } (minutos) | null, zonaAlta: zona de pulso | null }.
export function lecturaHonesta(s, tipo, ref) {
  const plan = (s.bloques || []).reduce((a, b) => a + (b.duracion || 0), 0);
  const corta = s.bloques?.length && s.tiempoMeta == null && plan > 0 && (s.duracion || 0) < 0.8 * plan
    ? { hechos: Math.max(1, Math.round((s.duracion || 0) / 60)), plan: Math.round(plan / 60) } : null;
  const suave = tipo === 'fondo' || ['fondo', 'recuperacion'].includes(s.tipoPlan);
  const z = suave && s.fcProm && ref ? E.zonaFc(s.fcProm, ref) : null;
  return { corta, zonaAlta: z && z.n >= 4 ? z : null };
}

// Esfuerzo tras las duras (E17, parte de UX): solo el 30 % de las sesiones lleva tu esfuerzo, y sin él tus rangos
// del plan no suben. Tras una sesión dura (del plan o por sus watts) que aún no lo tiene, el resumen lo pide con un toque.
const DURAS = new Set(['umbral', 'vo2', 'sprint', 'prueba']);
export function pideEsfuerzo(s, ftp) {
  if (!s || E.rpeSentido(s)) return false;
  const fi = ftp ? E.factorIntensidadDe(s, ftp) : null;
  return DURAS.has(s.tipoPlan) || (fi != null && fi >= 0.85);
}

// ---------- Capacidades en el tiempo ----------

const enVentana = (sesiones, desde, hasta) => sesiones.filter((s) => s.fecha >= desde && s.fecha < hasta);
const mejor = (ss, segs) => Math.max(0, ...ss.map((s) => E.mejorPotenciaDe(s, segs) || 0)) || null;

// Valor de cada capacidad en una ventana de sesiones (null si no hay datos suficientes).
function medir(ss, { ftp, peso, fcRef }) {
  const w5 = mejor(ss, 300);
  const pc = E.potenciaCritica(E.curvaHistorial(ss));
  const paladas = ss.reduce((a, s) => a + (s.paladas || 0), 0);
  const metros = ss.filter((s) => s.paladas).reduce((a, s) => a + (s.distancia || 0), 0);
  const recs = ss.filter((s) => s.fcRec60 != null).slice(-5).map((s) => s.fcRec60);
  return {
    base: fcRef ? E.wattsAPulsoDe(ss, fcRef) : null,
    umbral: ftp || null,
    vo2: E.vo2maxEstimado(w5, peso),
    anaerobica: pc ? Math.round(pc.wPrima / 100) / 10 : null,
    potencia: mejor(ss, 10),
    tecnica: paladas ? Math.round((100 * metros) / paladas) / 100 : null,
    recuperacion: recs.length ? Math.round(media(recs)) : null,
  };
}

export const CAPACIDADES = [
  { clave: 'base', nombre: 'Base aeróbica', simple: 'Motor', entrena: 'Fondos suaves largos', unidad: 'W', como: (c) => `Watts a ${c.fcRef} lpm`, falta: 'Necesita tu pulso: rema 20 min o más con banda o reloj conectado.' },
  { clave: 'umbral', nombre: 'Umbral (FTP)', simple: 'Ritmo sostenido', entrena: 'Bloques largos a ritmo fuerte', unidad: 'W', como: () => 'Potencia de una hora', falta: 'Haz la Prueba FTP 20 min o una sesión de 20 min.' },
  { clave: 'vo2', nombre: 'Índice de VO₂', simple: 'Pulmones', entrena: 'Series de 2 a 4 min muy fuertes', unidad: 'ml/kg/min', como: () => 'Índice con tu mejor 5 min: compáralo contigo, no es un VO₂máx de laboratorio', falta: 'Rema 5 min a fondo para calcularlo.' },
  { clave: 'anaerobica', nombre: 'Capacidad anaeróbica', simple: 'Batería', entrena: 'Series cortas por encima de tu ritmo', unidad: 'kJ', como: () => 'W′ con tus mejores marcas de 2 a 20 min', falta: 'Necesita marcas de dos duraciones, por ejemplo 3 y 12 min.' },
  { clave: 'potencia', nombre: 'Potencia y sprint', simple: 'Explosión', entrena: 'Sprints de 10 a 20 s', unidad: 'W', como: () => 'Mejor 10 s', falta: 'Haz un sprint de 10 s.' },
  { clave: 'tecnica', nombre: 'Técnica', simple: 'Técnica', entrena: 'Paladas largas y controladas', unidad: 'm/palada', como: () => 'Metros por palada', falta: 'Rema una sesión para medirla.' },
  { clave: 'recuperacion', nombre: 'Recuperación', simple: 'Recuperación', entrena: 'Fondos suaves y descanso', unidad: 'lpm', como: () => 'Lo que baja el pulso en 1 min', falta: 'Deja el reloj conectado 1 min después de terminar.' },
];

// Una tarjeta por capacidad: valor de las últimas 6 semanas, el de las 6 anteriores y si mejoró.
// ftpAntes: el FTP que tenías hace 6 semanas (lo guarda cada sesión).
export function capacidades(sesiones, { ftp = 0, peso = 0, fcMax = 0, ahora = Date.now() } = {}) {
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const fcRef = pulsoDePct(ZONA2.max, fcMax); // el techo de tu zona 2
  const recientes = enVentana(orden, ahora - VENTANA, ahora + 1);
  const previas = enVentana(orden, ahora - 2 * VENTANA, ahora - VENTANA);
  const ftpAntes = previas.map((s) => s.ftp).filter(Boolean).at(-1) || null;
  const ya = medir(recientes, { ftp, peso, fcRef });
  const antes = medir(previas, { ftp: ftpAntes, peso, fcRef });
  return CAPACIDADES.map((c) => {
    const valor = ya[c.clave];
    const previo = antes[c.clave];
    const cambio = valor != null && previo ? valor - previo : null;
    const pct = cambio != null ? Math.round((100 * cambio) / previo) : null;
    return { ...c, como: c.como({ fcRef }), valor, antes: previo, cambio, pct, mejora: cambio == null ? null : cambio > 0 };
  });
}

// Cada capacidad semana a semana: el valor de las 6 semanas que terminan ese domingo (null sin datos).
// Sirve para las mini gráficas de «Cómo has mejorado».
export function historialCapacidades(sesiones, { ftp = 0, peso = 0, fcMax = 0, semanas = 12, ahora = Date.now() } = {}) {
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const fcRef = pulsoDePct(ZONA2.max, fcMax); // el techo de tu zona 2
  const ventanas = lunes(semanas, ahora).map((ini, i, l) => {
    const fin = i === l.length - 1 ? ahora + 1 : ini + 7 * DIA;
    const ss = enVentana(orden, fin - VENTANA, fin);
    const ftpV = i === l.length - 1 ? ftp : ss.map((s) => s.ftp).filter(Boolean).at(-1) || null;
    return { inicio: ini, m: ss.length ? medir(ss, { ftp: ftpV, peso, fcRef }) : {} };
  });
  return Object.fromEntries(CAPACIDADES.map((c) => [c.clave, ventanas.map((v) => ({ inicio: v.inicio, valor: v.m[c.clave] ?? null }))]));
}

// ---------- Tu cuerpo hoy: fatiga, recuperación y carga segura ----------

export const ESTADOS_CUERPO = {
  fresco: { nombre: 'Fresco', consejo: 'Buen día para apretar o hacer una prueba.' },
  listo: { nombre: 'Listo', consejo: 'Puedes hacer la sesión de tu plan.' },
  cargado: { nombre: 'Cargado', consejo: 'Mejor algo suave o de técnica hoy.' },
  agotado: { nombre: 'Muy cansado', consejo: 'Descansa o rema muy suave 20 min.' },
};
// Frescura (condición − fatiga) a partir de la cual estás listo para una sesión normal.
const LISTO = -10;

// Horas de recuperación que suele pedir una sesión según su carga (TSS).
export function horasPorCarga(carga) {
  if (!(carga > 0)) return 0;
  return carga < 40 ? 8 : carga < 70 ? 16 : carga < 100 ? 24 : carga < 150 ? 36 : carga < 200 ? 48 : 72;
}

// Orden de los estados, del mejor al peor: las respuestas de antes de remar y la variabilidad del pulso
// solo pueden empeorar el estado, nunca mejorarlo.
const ORDEN_CUERPO = ['fresco', 'listo', 'cargado', 'agotado'];
const peor = (a, b) => (ORDEN_CUERPO.indexOf(b) > ORDEN_CUERPO.indexOf(a) ? b : a);

// Estado de hoy: nombre, horas hasta estar listo, carga de 7 días contra tu rango seguro y reparto suave/fuerte.
// previo: tus respuestas de hoy antes de remar ({ sueno, dolor }), o null. motivos: por qué empeoró el estado
// (dolor, sueño o variabilidad del pulso baja), para explicarlo en Hoy y en el plan.
export function estadoCuerpo(sesiones, ftp, ahora = Date.now(), { previo = null } = {}) {
  const dias = E.forma(sesiones, ftp, 60, ahora);
  const hoy = dias.at(-1);
  const efecto = efectoPrevio(previo);
  const hrv = E.variabilidadBaja(sesiones, ahora);
  if (!hoy || !dias.some((d) => d.carga > 0)) {
    // Sin carga registrada, tus respuestas siguen contando.
    return efecto ? { clave: efecto.clave, ...ESTADOS_CUERPO[efecto.clave], horas: 0, motivos: [efecto.motivo], ratio: null, seguro: null } : null;
  }
  // forma() ya suma la carga de hoy a la condición y la fatiga (antes se sumaba otra vez aquí: el estado salía un
  // escalón peor tras cualquier sesión, ronda 2 E3).
  const cond = hoy.condicion;
  const fat = hoy.fatiga;
  const fres = cond - fat;
  // Sin 4 semanas de historial, ni ratio ni rango seguro: la condición aún no refleja tu carga habitual.
  const conHistorial = E.diasDeHistorial(sesiones, ahora) >= E.DIAS_PARA_RATIO;
  const ratio = conHistorial && cond >= 5 ? fat / cond : null;
  let clave = fres > 5 ? 'fresco' : fres >= LISTO ? 'listo' : fres >= -25 ? 'cargado' : 'agotado';
  if (ratio != null && ratio > 1.5 && clave !== 'agotado') clave = 'cargado';
  // Recuperación: lo que pide cada sesión de los últimos 4 días según su carga (la más exigente cuenta entera
  // y las demás a la mitad), y como mínimo lo que tarda la fatiga acumulada en bajar, hasta 36 h. Tope: 4 días.
  let c = cond, f = fat, horasForma = 0;
  while (c - f < LISTO && horasForma < 36) { c -= c / 42 / 24; f -= f / 7 / 24; horasForma++; }
  const k = E.factorSrpe(sesiones, ftp);
  const restos = sesiones.filter((s) => s.fecha <= ahora && s.fecha > ahora - 4 * DIA).map((s) => {
    const carga = E.cargaDe(s, ftp, k).valor ?? 0;
    return Math.max(0, horasPorCarga(carga) - (ahora - s.fecha - (s.duracion || 0) * 1000) / 36e5);
  }).sort((a, b) => b - a);
  const horasSesiones = restos.length ? restos[0] + restos.slice(1).reduce((a, x) => a + x / 2, 0) : 0;
  const horas = Math.min(96, Math.ceil(Math.max(horasForma, horasSesiones)));
  // Una sesión dura reciente manda aunque la tendencia diga que estás fresco.
  if (horas >= 12 && (clave === 'fresco' || clave === 'listo')) clave = 'cargado';
  else if (horas > 0 && clave === 'fresco') clave = 'listo';
  const motivos = [];
  if (efecto) { clave = peor(clave, efecto.clave); motivos.push(efecto.motivo); }
  if (hrv?.baja) { clave = peor(clave, 'cargado'); motivos.push(`Tu variabilidad del pulso bajó (${hrv.hoy} ms, lo normal en ti es ${hrv.base})`); }
  const semana = dias.slice(-7).reduce((a, d) => a + d.carga, 0);
  // Monotonía (Foster): carga media de los 7 días entre su desviación. Remar casi igual todos los días, sin días
  // suaves ni de descanso, cansa más de lo que suma: con más de 2 y 5 días o más con carga, el próximo suave es descanso.
  const monotonia = monotoniaDe(dias.slice(-7).map((d) => d.carga));
  if (monotonia) { clave = peor(clave, 'cargado'); motivos.push('Tu semana fue muy pareja, sin días de descanso: hoy toca descansar o remar muy suave'); }
  const seguro = ratio != null ? { min: Math.round(cond * 7 * 0.8), max: Math.round(cond * 7 * 1.3) } : null;
  const reparto = E.distribucionIntensidad(sesiones, ftp, 7, ahora);
  return {
    clave, ...ESTADOS_CUERPO[clave], horas, ratio: ratio == null ? null : Math.round(ratio * 100) / 100,
    condicion: Math.round(cond), fatiga: Math.round(fat), frescura: Math.round(fres),
    semana: Math.round(semana), seguro, reparto, motivos, rmssd: hrv, monotonia,
  };
}

// Monotonía de 7 cargas diarias (con los días sin remar en 0), o null si no pasa de 2 o hay menos de 5 días con carga.
export function monotoniaDe(cargas) {
  if (cargas.length < 7 || cargas.filter((c) => c > 0).length < 5) return null;
  const v = E.monotoniaCargas(cargas);
  return v > 2 ? Math.round(Math.min(v, 9) * 10) / 10 : null;
}

// Texto corto de recuperación: «Listo para entrenar» o «Recuperado en unas 20 h» / «en 2 días».
export function textoRecuperacion(horas) {
  if (!horas) return 'Listo para entrenar';
  if (horas < 36) return `Recuperado en unas ${horas} h`;
  if (horas >= 96) return 'Necesitas unos 4 días suaves';
  return `Recuperado en unos ${Math.round(horas / 24)} días`;
}

// Lunes 00:00 de las últimas n semanas, del más antiguo al actual.
function lunes(n, ahora) {
  const inicio = E.inicioPeriodo(ahora, 'semana');
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() - 7 * (n - 1 - i));
    return d.getTime();
  });
}

// Watts a un pulso fijo, semana a semana (null en las semanas sin datos suficientes).
export function motorSemanal(sesiones, fcRef, n = 8, ahora = Date.now()) {
  return lunes(n, ahora).map((ini) => {
    const ss = enVentana(sesiones, ini, ini + 7 * DIA);
    return { inicio: ini, w: fcRef ? E.wattsAPulsoDe(ss, fcRef) : null };
  });
}

// Calorías por semana.
export function gastoSemanal(sesiones, n = 8, ahora = Date.now()) {
  return lunes(n, ahora).map((ini) => ({
    inicio: ini,
    kcal: Math.round(enVentana(sesiones, ini, ini + 7 * DIA).reduce((a, s) => a + (s.kcal || 0), 0)),
  }));
}

// Curva de potencia de las últimas 6 semanas contra la mejor anterior.
export function curvasComparadas(sesiones, ahora = Date.now()) {
  return {
    ahora: E.curvaHistorial(enVentana(sesiones, ahora - VENTANA, ahora + 1)),
    antes: E.curvaHistorial(sesiones.filter((s) => s.fecha < ahora - VENTANA)),
  };
}

// Split de la meta de un entrenamiento escrito en split: el que guarda el plan, o (en los guardados antes) el que
// sale de su calentamiento, que en los planes hacia una meta va de +32 a +45 s sobre la meta.
export const SPLIT_CAL_META = [32, 45];
// Equivalencia del split con el % del FTP en un plan de meta: el split de 2000 m (equivalente) de la meta es el 127 %.
export const PCT_RITMO_META = 127;
export function splitMetaDe(ent) {
  if (ent?.splitMeta > 0) return ent.splitMeta;
  const [a, b] = SPLIT_CAL_META;
  const cal = (ent?.bloques || []).find((x) => x.metrica === 'split' && x.nombre === 'Calentamiento' && x.min > 0 && x.max - x.min === b - a);
  return cal ? cal.min - a : null;
}

// Tipo de un entrenamiento antes de remarlo (para elegir qué datos mostrar en el modo remo).
// null = remo libre o sin meta clara: se usa la pantalla de siempre.
export function tipoPlan(ent) {
  if (!ent) return null;
  if (ent.prueba || ent.pruebaFtp) return 'prueba';
  if (ent.objetivo?.metrica === 'kcal' || ent.enfoque === 'calorias') return 'calorias';
  const trabajo = (ent.bloques || []).filter((b) => b.metrica && !/calentamiento|enfriamiento|descanso/i.test(b.nombre || ''));
  if (trabajo.some((b) => b.metrica === 'spm') || ent.enfoque === 'tecnica') return 'tecnica';
  const pct = Math.max(0, ...trabajo.filter((b) => b.metrica === 'ftp').map((b) => b.max));
  // Bloques en split (los planes hacia una meta): se comparan con el split de la meta. A ritmo de meta o más
  // rápido son series (vo2); a menos de 12 s más lento, umbral; más lento, fondo.
  const enSplit = trabajo.filter((b) => b.metrica === 'split' && b.min > 0);
  if (!pct && enSplit.length) {
    const meta = splitMetaDe(ent);
    if (meta) {
      // E-2 (E6): en % del FTP equivalente, con los mismos cortes que los bloques en % del FTP (y los mismos que
      // pctBloque, que usan los topes de intensidad): un «firme» de quien rema lento ya es umbral.
      const pctSplit = Math.max(...enSplit.map((b) => PCT_RITMO_META * (meta / ((b.min + b.max) / 2)) ** 3));
      return pctSplit > 105 ? 'vo2' : pctSplit > 90 ? 'umbral' : 'fondo';
    }
  }
  if (pct > 120) return 'sprint';
  if (pct > 105) return 'vo2';
  if (pct > 90) return 'umbral';
  if (trabajo.some((b) => b.metrica === 'fc' || b.metrica === 'fcpct') || pct > 0) return 'fondo';
  return ent.objetivo?.metrica === 'distancia' ? 'fondo' : null;
}

// Casillas del modo remo (además del split, que va siempre) para cada tipo de sesión.
// Las de las posiciones 1 y 3 son las que quedan a la vista en las vistas compactas.
export const CASILLAS_REMO = {
  libre: ['spm', 'tiempo', 'dist', 'extra', 'fc'],
  fondo: ['fc', 'tiempo', 'mpp', 'kcal', 'dist'],
  umbral: ['spm', 'tiempo', 'fc', 'kcal', 'dist'],
  vo2: ['bateria', 'tiempo', 'fc', 'dist', 'spm'],
  sprint: ['wmax', 'tiempo', 'jpp', 'dist', 'spm'],
  tecnica: ['spm', 'tiempo', 'mpp', 'dist', 'jpp'],
  calorias: ['kcal', 'tiempo', 'kcalh', 'dist', 'fc'],
  prueba: ['fc', 'tiempo', 'dist', 'spm', 'kcal'],
};
