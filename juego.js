// Héroe: tu personaje crece con tus entrenamientos reales.
// Todo se calcula desde el historial, así que las sesiones viejas también cuentan.
// Nada de esto cambia tus métricas reales: solo el juego.
import { gradosEn, puntosDeNivel, puntosGastados, xpTalentos } from './talentos.js';
import { estres, claveDia, RECORDS, mejorTiempo } from './estadisticas.js';
import { objeto } from './objetos.js';
import { tiendaVentajas } from './ventajas.js';
export const PREMIO_INSIGNIA = 50;

export const ATRIBUTOS = [
  { clave: 'fuerza', nombre: 'Fuerza', detalle: 'Minutos en zona 4 o más' },
  { clave: 'agilidad', nombre: 'Agilidad', detalle: 'Sprints y series cortas por encima de tu FTP' },
  { clave: 'resistencia', nombre: 'Resistencia', detalle: 'Minutos en zonas 2 y 3, sesiones de 20 min o más' },
  { clave: 'recuperacion', nombre: 'Recuperación', detalle: 'Pulso que baja en los descansos, días suaves y descansos a tiempo' },
  { clave: 'tecnica', nombre: 'Técnica', detalle: 'Tiempo en rango y buena distancia por palada' },
  { clave: 'voluntad', nombre: 'Voluntad', detalle: 'Rachas, entrenamientos completos y sesiones muy duras' },
];

// Cómo sube cada atributo, con tus vatios: lo mismo que calcula gananciaSesion, dicho en claro.
// f = tu FTP (0 si no lo tienes). Devuelve frases cortas, de la que más suma a la que menos.
const vatios = (f, pct) => (f ? `${Math.round(f * pct)} W` : `el ${Math.round(pct * 100)} % de tu FTP`);
export function comoSubir(clave, f = 0) {
  return {
    fuerza: [`Cada minuto por encima de ${vatios(f, 0.91)} (zona 4 o más): +1,2`],
    agilidad: [`Cada 20 s por encima de ${vatios(f, 1.06)}: +1`, 'Un 500 m a fondo en menos de 2:30: +5'],
    resistencia: [`Cada minuto entre ${vatios(f, 0.56)} y ${vatios(f, 0.9)} (zonas 2 y 3): +0,5`, 'Sesiones de 20 min o más: +4'],
    recuperacion: ['Un día de descanso después de un día duro: +4', `Una sesión suave (media por debajo de ${vatios(f, 0.75)}): +2, o +5 si ayer fue duro`, 'Con banda de pulso: +3 por cada descanso en que el pulso baja 20 lpm en un minuto'],
    tecnica: ['Cada minuto dentro del rango de un entrenamiento: hasta +0,6', 'Más metros por palada que tu media: +3'],
    voluntad: ['Terminar el entrenamiento completo: +3', 'Una sesión muy dura (esfuerzo 8 o más): +3', 'Cada día de racha: +0,5 (hasta 7)'],
  }[clave] || [];
}

// Cada clase tiene un atributo favorito que crece un 15 % más rápido.
export const CLASES = [
  { clave: 'vikingo', nombre: 'Vikingo', favorito: 'fuerza', lema: 'Cada palada es un hachazo.', para: 'Para sesiones largas: sus talentos cuentan paladas.', icono: '<path d="M5 14a7 7 0 0 1 14 0v3H5z"/><path d="M5 13 2.5 6M19 13l2.5-7M9 17v3M15 17v3M12 7v4"/>' },
  { clave: 'pirata', nombre: 'Pirata', favorito: 'agilidad', lema: 'Rápido, impredecible y al abordaje.', para: 'Para quien rema contra fantasmas.', icono: '<path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.3 4 3 5v3h8v-3c1.7-1 3-2.6 3-5a7 7 0 0 0-7-7z"/><path d="M9 10h.01M15 10h.01M10 18v3M14 18v3"/>' },
  { clave: 'samurai', nombre: 'Samurái', favorito: 'tecnica', lema: 'La forma perfecta vence a la fuerza.', para: 'Para quien sigue un plan y rema sin pausas.', icono: '<path d="M5 19 19 5l1.5-1.5M15 5l4 4M7 15l2 2M3.5 20.5 5 19"/>' },
  { clave: 'polinesio', nombre: 'Polinesio', favorito: 'resistencia', lema: 'El océano entero es tu camino.', para: 'Para sesiones de 30 min o más de 5 km.', icono: '<path d="M12 2v12"/><path d="M9.5 14h5l-1 6.5a1.5 1.5 0 0 1-3 0z"/><path d="M3 9c2 1.5 4 1.5 6 0M15 9c2 1.5 4 1.5 6 0"/>' },
  { clave: 'romano', nombre: 'Romano', favorito: 'voluntad', lema: 'No se rinde. Nunca.', para: 'Para quien rema 3 o más veces por semana.', icono: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="M12 7v10M8 11h8"/>' },
];
// Clases antiguas → clase nueva con el mismo espíritu. El héroe conserva XP, talentos y objetos.
export const CLASES_ANTIGUAS = { explorador: 'polinesio', monje: 'samurai', gladiador: 'romano' };
export const claseDe = (clave) => CLASES.find((c) => c.clave === (CLASES_ANTIGUAS[clave] || clave)) || null;

// 9 rangos de personaje, uno cada 10 niveles: Legendario en el 80 y 10 niveles más de recorrido.
export const NIVEL_MAX = 90;
// Del nivel 1 al 2 cuestan 200 XP y cada nivel siguiente cuesta un 5 % más que el anterior.
export const XP_PRIMER_NIVEL = 200;
export const XP_INCREMENTO = 1.05;
export const XP_POR_METROS = 10;
export const xpDelNivel = (n) => Math.round(XP_PRIMER_NIVEL * XP_INCREMENTO ** (n - 1)); // coste de n → n + 1
const XP_ACUMULADA = [0, 0];
for (let n = 2; n <= NIVEL_MAX; n++) XP_ACUMULADA[n] = XP_ACUMULADA[n - 1] + xpDelNivel(n - 1);
// XP total para llegar a un nivel.
export const xpParaNivel = (n) => XP_ACUMULADA[Math.min(Math.max(1, n), NIVEL_MAX)];
export function nivelDe(xp) {
  let n = 1;
  while (n < NIVEL_MAX && xp >= xpParaNivel(n + 1)) n++;
  return n;
}

// Rangos del personaje: uno cada 10 niveles. El título del héroe es el nombre del rango.
export const RANGOS = [
  { id: 'novato', nombre: 'Novato', nivel: 1 }, { id: 'aprendiz', nombre: 'Aprendiz', nivel: 10 },
  { id: 'combatiente', nombre: 'Combatiente', nivel: 20 }, { id: 'guerrero', nombre: 'Guerrero', nivel: 30 },
  { id: 'veterano', nombre: 'Veterano', nivel: 40 }, { id: 'campeon', nombre: 'Campeón', nivel: 50 },
  { id: 'elite', nombre: 'Élite', nivel: 60 }, { id: 'maestro', nombre: 'Maestro', nivel: 70 },
  { id: 'legendario', nombre: 'Legendario', nivel: 80 },
];
export const rangoDe = (nivel) => RANGOS.filter((r) => nivel >= r.nivel).at(-1);
export const tituloDe = (nivel) => rangoDe(nivel).nombre;

// ---------- Rivales: héroes de las otras clases, con el rango que te toca ----------
const NOMBRES_RIVAL = {
  vikingo: ['Björn', 'Eirik', 'Halvar', 'Sigrun'],
  pirata: ['Tess Marlow', 'Silas Crane', 'Rojo Calloway', 'Nell Duarte'],
  samurai: ['Kenji', 'Haruto', 'Takeshi', 'Ren'],
  polinesio: ['Kalani', 'Makoa', 'Keoni', 'Nalu'],
  romano: ['Marco Varo', 'Tito Galo', 'Lucio Brenno', 'Cayo Severo'],
};
// Clasificación de tripulación por FTP (de Grumete a Capitán): W/kg si hay peso, vatios si no. Decide cómo de constante rema tu rival.
export const CLASIFICACIONES = [
  { id: 'grumete', nombre: 'Grumete', wkg: 0, w: 0, perfil: { variacion: 0.035, fatiga: 0.08, spm: 22 }, altamar: 1.05 },
  { id: 'marinero', nombre: 'Marinero', wkg: 1.5, w: 100, perfil: { variacion: 0.028, fatiga: 0.06, spm: 24 }, altamar: 1.05 },
  { id: 'contramaestre', nombre: 'Contramaestre', wkg: 2, w: 150, perfil: { variacion: 0.022, fatiga: 0.045, spm: 25 }, altamar: 1.04 },
  { id: 'oficial', nombre: 'Primer oficial', wkg: 2.5, w: 200, perfil: { variacion: 0.017, fatiga: 0.035, spm: 27 }, altamar: 1.03 },
  { id: 'capitan', nombre: 'Capitán', wkg: 3, w: 250, perfil: { variacion: 0.012, fatiga: 0.025, spm: 28 }, altamar: 1.03 },
];
export function clasificacionDe(ftp, peso = 0) {
  const porPeso = peso > 0;
  const valor = porPeso ? ftp / peso : ftp;
  const i = CLASIFICACIONES.reduce((a, c, k) => (valor >= (porPeso ? c.wkg : c.w) ? k : a), 0);
  const sig = CLASIFICACIONES[i + 1];
  const falta = sig ? Math.max(0, Math.ceil((porPeso ? sig.wkg * peso : sig.w) - ftp)) : null;
  return { ...CLASIFICACIONES[i], indice: i, valor: Math.round(valor * 100) / 100, porPeso, siguiente: sig || null, faltaW: falta };
}
// Dificultad de los rivales en «Por objetivo» (en Remo libre siempre es Costa).
export const DIFICULTADES = {
  bahia: { nombre: 'Bahía', texto: 'Fácil: los rivales reman suave para ir parejos a ritmo tranquilo', rango: -1, xp: 15, ftp: () => 0.85, oscila: 0.03 },
  costa: { nombre: 'Costa', texto: 'Medio: los rivales reman a tu mismo nivel', rango: 0, xp: 25, ftp: () => 1, oscila: 0.03 },
  altamar: { nombre: 'Alta mar', texto: 'Difícil: los rivales reman un poco más fuerte que tú', rango: 1, xp: 40, ftp: (c) => c.altamar, oscila: 0.02 },
};
export const xpPorFantasma = (dificultad) => (DIFICULTADES[dificultad] || DIFICULTADES.costa).xp;
// Las opciones antiguas de fantasma (niveles fijos y retos) pasan a ser rivales de otra clase.
export const RETO_ANTIGUO = { principiante: 'bahia', intermedio: 'costa', avanzado: 'altamar', inferior: 'bahia', igual: 'costa', superior: 'altamar' };
const otrasClases = (miClase) => CLASES.map((c) => c.clave).filter((k) => k !== claseDe(miClase)?.clave);
// La clase rival de la semana: la misma toda la semana, nunca la tuya.
export function rivalDeLaSemana(lunes, miClase) {
  const otras = otrasClases(miClase);
  return otras[Math.floor(azar(`r${lunes}`)() * otras.length)];
}
// n rivales de clases distintas: el primero es siempre el de la semana. Su rango sale de tu nivel y su FTP del tuyo.
export function rivalesPara(n, { miClase = null, nivel = 1, ftp = 150, peso = 0, dificultad = 'costa', lunes, semilla = '' } = {}) {
  const semana = rivalDeLaSemana(lunes, miClase);
  const r = azar(`n${lunes}${semilla}`);
  const resto = otrasClases(miClase).filter((k) => k !== semana).sort(() => r() - 0.5);
  const clases = [semana, ...resto];
  const dif = DIFICULTADES[dificultad] || DIFICULTADES.costa;
  const cl = clasificacionDe(ftp, peso);
  const mio = RANGOS.indexOf(rangoDe(nivel));
  const rango = RANGOS[Math.max(0, Math.min(RANGOS.length - 1, mio + dif.rango))];
  return Array.from({ length: n }, (_, i) => {
    const clase = clases[i % clases.length];
    const nombres = NOMBRES_RIVAL[clase];
    const nombre = nombres[Math.floor(r() * nombres.length)];
    // Los rivales oscilan alrededor del nivel elegido: el de la semana justo en él, otro un poco por debajo y otro un poco por encima.
    const ftpRival = Math.round(ftp * (dif.ftp(cl) + [0, -1, 1][i % 3] * dif.oscila));
    return {
      dificultad, clase, rango: rango.id, ftp: ftpRival, clasificacion: clasificacionDe(ftpRival, peso).nombre, perfil: cl.perfil,
      nombre: `${nombre} (${claseDe(clase).nombre} ${rango.nombre})`,
    };
  });
}

// ---------- Talentos: por clase, en talentos.js ----------
export { talentosDe, gradosEn, motivoBloqueo, puntosDeNivel, puntosGastados, grado, cualidadDe, lemaTalentos, tieneArbolAntiguo, valorDe } from './talentos.js';

// ---------- Misiones ----------
// La distancia es la fuente principal de XP; las misiones dan variedad con recompensas moderadas:
// diarias 15–60 XP (la mitad de la propuesta inicial, para que la distancia pese más), semanales 150–250 XP. Ninguna exige intensidad alta.
const km = (m) => (m / 1000).toLocaleString('es-MX');
const monedasDe = (xp) => Math.max(5, Math.round(xp / 20) * 5);
// Diarias: siempre una de distancia y una de duración, más 3 variadas.
const DIARIA_DIST = { id: 'impulso', nombre: 'Primer impulso', texto: (m) => `Completa una sesión de al menos ${km(m)} km`, metas: [2000, 3000, 5000], xp: [25, 35, 50], valor: (d) => d.maxMetros };
const DIARIA_DUR = { id: 'tiempo', nombre: 'Tiempo en el agua', texto: (m) => `Rema ${m} min activos en una sesión`, metas: [10, 20, 30], xp: [15, 35, 60], valor: (d) => d.maxMin };
const DIARIAS = [
  { id: 'constante', nombre: 'Remero constante', texto: (m) => `Acumula ${m} min de remo activo hoy`, metas: [20, 30], xp: [30, 40], valor: (d) => d.min },
  { id: 'distdia', nombre: 'Travesía del día', texto: (m) => `Acumula ${km(m)} km hoy`, metas: [4000, 6000], xp: [35, 50], valor: (d) => d.metros },
  { id: 'fantasma', nombre: 'Caza de fantasmas', texto: () => 'Gánale a un fantasma', metas: [1], xp: [25], valor: (d) => d.ganados },
  { id: 'rango', nombre: 'En tu rango', texto: (m) => `Mantén el ${m} % de un entrenamiento en tu rango de vatios`, metas: [70, 80], xp: [40, 40], valor: (d) => d.mejorPct },
  { id: 'ritmo', nombre: 'Ritmo de crucero', texto: () => 'Completa 10 min o más con ritmo estable', metas: [1], xp: [40], valor: (d) => d.estables },
];
// Semanales: la ruta, una temática de tu clase y una de constancia o fondo.
const SEMANAL_RUTA = { id: 'ruta', nombre: 'La ruta del explorador', texto: (m) => `Acumula ${m} km esta semana`, metas: [10, 15, 20], xp: [150, 200, 250], valor: (d) => d.metros / 1000 };
const SEMANALES = [
  { id: 'disciplina', nombre: 'Disciplina de hierro', texto: (m) => `Entrena ${m} días distintos esta semana`, metas: [3], xp: [150], valor: (d) => d.dias.size },
  { id: 'fondo', nombre: 'Fondo', texto: (m) => `Completa una sesión de ${m} min activos`, metas: [45], xp: [200], valor: (d) => d.maxMin },
];
export const MISION_CLASE = {
  vikingo: { id: 'nordica', nombre: 'Travesía nórdica', texto: (m) => `Completa una sesión de ${km(m)} km`, metas: [6000], xp: [200], valor: (d) => d.maxMetros },
  pirata: { id: 'rumbo', nombre: 'Rumbo pirata', texto: (m) => `Completa ${m} sesiones esta semana`, metas: [4], xp: [200], valor: (d) => d.sesiones },
  samurai: { id: 'bushido', nombre: 'Camino del samurái', texto: (m) => `Completa ${m} sesiones con ritmo estable esta semana`, metas: [2], xp: [200], valor: (d) => d.estables },
  polinesio: { id: 'oceano', nombre: 'Travesía del océano', texto: (m) => `Completa una sesión de ${m} min activos`, metas: [40], xp: [200], valor: (d) => d.maxMin },
  romano: { id: 'dominio', nombre: 'Dominio de Roma', texto: (m) => `Completa ${m} misiones diarias esta semana`, metas: [6], xp: [200], valor: (d) => d.diariasHechas },
};

// Azar repetible: la misma fecha siempre da las mismas misiones.
function azar(semilla) {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
const crear = (d, r, semilla) => {
  const k = Math.floor(r() * d.metas.length);
  const xp = d.xp[k];
  return { id: `${semilla}:${d.id}`, clave: d.id, nombre: d.nombre, texto: d.texto(d.metas[k]), meta: d.metas[k], valor: d.valor, xp, monedas: monedasDe(xp) };
};

// Tu ritmo en las 4 semanas anteriores a `desde` (ms): las misiones se ajustan a lo que remas de verdad.
// Solo usa sesiones anteriores, así las misiones de un día o una semana no cambian mientras remas.
export function ritmoReciente(sesiones, desde) {
  const prev = sesiones.filter((s) => s.fecha < desde && s.fecha >= desde - 28 * 864e5);
  if (!prev.length) return null;
  const primera = Math.min(...prev.map((s) => s.fecha));
  const semanas = Math.max(1, Math.min(4, Math.ceil((desde - primera) / (7 * 864e5))));
  const med = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
  return {
    kmSemana: prev.reduce((a, s) => a + (s.distancia || 0), 0) / 1000 / semanas,
    sesSemana: prev.length / semanas,
    metros: med(prev.map((s) => s.distancia || 0)),
    min: med(prev.map((s) => (s.duracion || 0) / 60)),
    conRango: prev.some((s) => s.pctEnRango != null),
  };
}
// Deja las metas que caben en tu ritmo (con la XP de cada una); si ninguna cabe, una a tu medida con la XP más baja.
function aTuMedida(d, tope, paso) {
  const i = d.metas.map((m, k) => k).filter((k) => d.metas[k] <= tope);
  if (i.length) return { ...d, metas: i.map((k) => d.metas[k]), xp: i.map((k) => d.xp[k]) };
  return { ...d, metas: [Math.max(paso, Math.round(tope / paso) * paso)], xp: [d.xp[0]] };
}
const entre = (v, a, b) => Math.min(b, Math.max(a, v));
const min5 = (m) => entre(Math.floor(m / 5) * 5, 10, 60);
// Metas semanales a tu medida: lo que sueles hacer en una semana normal (un poco menos, para que se pueda),
// así premian la constancia; solo las de días y sesiones piden uno más que tu media.
const META_SEMANAL = {
  ruta: (r) => entre(Math.floor(r.kmSemana * 0.95), 3, 40),
  fondo: (r) => min5(r.min * 0.95),
  oceano: (r) => min5(r.min * 0.95),
  nordica: (r) => entre(Math.floor((r.metros * 0.95) / 500) * 500, 2000, 15000),
  disciplina: (r) => entre(Math.round(r.sesSemana) + 1, 2, 5),
  rumbo: (r) => entre(Math.round(r.sesSemana) + 1, 2, 5),
  dominio: (r) => entre(Math.round(r.sesSemana * 2), 2, 6),
};
const xpRuta = (km) => (km >= 20 ? 250 : km >= 12 ? 200 : 150);
function semanalATuMedida(d, rit) {
  const f = rit && META_SEMANAL[d.id];
  if (!f) return d;
  const meta = f(rit);
  return { ...d, metas: [meta], xp: [d.id === 'ruta' ? xpRuta(meta) : d.xp[0]] };
}
// Qué preparar al tocar «Hacer ahora» en una misión: un entrenamiento base o Remo libre contra fantasmas ('').
const PREPARAR_MISION = { rango: 'base:pot-mant', ritmo: 'base:rit-mant', bushido: 'base:rit-mant' };
const prepararMision = (mi) => (mi.clave === 'atributo' ? PREPARAR_ATRIBUTO[mi.atributo] : PREPARAR_MISION[mi.clave]) ?? '';
function elegir(pool, n, semilla, r = azar(semilla)) {
  const lista = [...pool];
  const salida = [];
  while (salida.length < n && lista.length) salida.push(crear(lista.splice(Math.floor(r() * lista.length), 1)[0], r, semilla));
  return salida;
}
export const lunesDe = (ms) => {
  const d = new Date(ms);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return claveDia(d.getTime());
};
// rit (opcional) = ritmoReciente(): con historial, las metas se ajustan a lo que remas y no salen misiones imposibles.
export function misionesDelDia(dia, rit = null) {
  const semilla = `d${dia}`;
  const r = azar(semilla);
  if (!rit) return [crear(DIARIA_DIST, r, semilla), crear(DIARIA_DUR, r, semilla), ...elegir(DIARIAS, 3, semilla, r)];
  const pool = DIARIAS
    .filter((d) => d.id !== 'rango' || rit.conRango)
    .map((d) => (d.id === 'distdia' ? aTuMedida(d, rit.metros * 1.3, 500) : d.id === 'constante' ? aTuMedida(d, rit.min * 1.3, 5) : d));
  return [crear(aTuMedida(DIARIA_DIST, rit.metros * 1.15, 500), r, semilla), crear(aTuMedida(DIARIA_DUR, rit.min * 1.15, 5), r, semilla), ...elegir(pool, 3, semilla, r)];
}
// Meta semanal de atributo (desde la semana del 26 de octubre de 2026): sube tu atributo más bajo.
// Las metas equivalen más o menos a una sesión pensada para ese atributo.
export const ATRIBUTO_SEMANAL_DESDE = '2026-10-26';
export const META_ATRIBUTO = { fuerza: 15, agilidad: 12, resistencia: 20, recuperacion: 6, tecnica: 15, voluntad: 8 };
export const PREPARAR_ATRIBUTO = { fuerza: 'base:pot-mant', agilidad: 'base:pot-mejora', resistencia: 'base:dis-mant', recuperacion: 'base:dis-suave', tecnica: 'base:rit-mant', voluntad: 'base:pal-mejora' };
// El atributo más bajo con el que trabajar la semana; sin banda de pulso no se elige Recuperación.
export function atributoDeLaSemana(atributos, { sinPulso = true } = {}) {
  const lista = ATRIBUTOS.filter((a) => !(sinPulso && a.clave === 'recuperacion'));
  if (!lista.some((a) => (atributos[a.clave] || 0) > 0)) return null;
  return lista.reduce((m, a) => ((atributos[a.clave] || 0) < (atributos[m.clave] || 0) ? a : m)).clave;
}
function misionAtributo(clave) {
  const a = ATRIBUTOS.find((x) => x.clave === clave);
  return { id: 'atributo', atributo: clave, nombre: 'Héroe equilibrado', texto: (m) => `Sube ${m} puntos de ${a.nombre} esta semana`, metas: [META_ATRIBUTO[clave]], xp: [150], valor: (d) => Math.floor(d.atr?.[clave] || 0) };
}
export function misionesDeSemana(lunes, clase = null, rit = null, atributo = null) {
  const semilla = `s${lunes}`;
  const r = azar(semilla);
  const tema = MISION_CLASE[claseDe(clase)?.clave];
  const rival = rivalDeLaSemana(lunes, clase);
  const reto = { id: 'rival', nombre: 'Rival de la semana', texto: () => `Gánale una carrera a un rival ${claseDe(rival).nombre.toLowerCase()}`, metas: [1], xp: [150], valor: (d) => d.vencidas.filter((k) => k === rival).length };
  // Con historial no se repiten dos misiones de una sesión larga (Fondo y la Travesía del océano).
  const pool = rit && tema?.id === 'oceano' ? SEMANALES.filter((d) => d.id !== 'fondo') : SEMANALES;
  const a = (d) => semanalATuMedida(d, rit);
  const lista = [crear(a(SEMANAL_RUTA), r, semilla), ...(tema ? [crear(a(tema), r, semilla)] : []), ...elegir(pool.map(a), tema ? 1 : 2, semilla, r), crear(reto, r, semilla)];
  if (atributo && lunes >= ATRIBUTO_SEMANAL_DESDE) lista.push({ ...crear(misionAtributo(atributo), r, semilla), atributo });
  return lista;
}

// Bonos de constancia: premian volver, nunca castigan descansar, y tienen tope.
export const CONSTANCIA = {
  primeraSemana: { texto: 'Primer entrenamiento de la semana', xp: 40 },
  semana3: { texto: '3 sesiones esta semana', xp: 150 },
  semana5: { texto: '5 sesiones esta semana', xp: 100 }, // completa 250 en total, no se suma a las 3
  mes12: { texto: '12 sesiones este mes', xp: 300 },
  bloque4: { texto: '4 semanas seguidas con 2 sesiones o más', xp: 400 },
};

// Capítulos de la historia: requisitos desde que empieza el capítulo y un jefe que es una prueba real.
export const CAPITULOS = [
  { nombre: 'El despertar', historia: 'Tu bote despierta en un muelle olvidado. Para zarpar, demuestra que puedes remar.',
    req: [['sesiones', 2], ['km', 3]], jefe: { nombre: 'El Guardián del muelle', tipo: 'p500', texto: 'Completa la «Prueba 500 m»' }, monedas: 100, objeto: 'casco-cuernos-oro', xp: 150 },
  { nombre: 'Río arriba', historia: 'La corriente empuja en contra. Solo la constancia te lleva al nacimiento del río.',
    req: [['sesiones', 5], ['km', 15], ['z2min', 30]], jefe: { nombre: 'La Serpiente del río', tipo: 'p2000', texto: 'Completa una prueba de 2000 m' }, monedas: 150, objeto: 'sombrero-capitan', xp: 200 },
  { nombre: 'La tormenta', historia: 'El cielo se rompe. Rayos, olas y fantasmas en la niebla.',
    req: [['z4min', 30], ['fantasmas', 3]], jefe: { nombre: 'El Kraken', tipo: 'pftp', texto: 'Completa la «Prueba FTP 20 min»' }, monedas: 200, objeto: 'kabuto', xp: 250 },
  { nombre: 'Mar abierto', historia: 'Nada a la vista más que agua. Tu racha es tu brújula.',
    req: [['km', 50], ['racha', 4]], jefe: { nombre: 'El Dragón de los 500', tipo: 'mejor500', texto: 'Supera tu mejor 500 m' }, monedas: 250, objeto: 'corona-hielo', xp: 300 },
  { nombre: 'La leyenda', historia: 'Los bardos ya cantan tu nombre. Falta el último duelo.',
    req: [['km', 80], ['sesiones', 10]], jefe: { nombre: 'El Rey de los mares', tipo: 'mejor2000', texto: 'Supera tu mejor 2000 m' }, monedas: 300, objeto: 'armadura-gladiador', xp: 400 },
];
// Entrenamiento que prepara el botón «Enfrentar» de cada jefe.
export const PRUEBA_JEFE = { p500: 'base:prueba-500', p2000: 'base:prueba-2000', pftp: 'base:prueba-ftp', mejor500: 'base:prueba-500', mejor2000: 'base:prueba-2000' };
export const REQ_TEXTO = { sesiones: 'Sesiones', km: 'Kilómetros', z2min: 'Minutos en zona 2', z4min: 'Minutos en zona 4+', fantasmas: 'Fantasmas vencidos', racha: 'Días seguidos' };

// Logros permanentes: una sola vez. Los hitos excepcionales dan entre 300 y 600 XP.
export const HAZANAS = [
  { id: 'primera', nombre: 'Primera travesía', texto: 'Registra tu primera sesión', meta: 1, valor: (g) => g.sesiones, xp: 100, monedas: 20 },
  { id: 'mision1', nombre: 'Primera misión', texto: 'Completa tu primera misión', meta: 1, valor: (g) => g.misiones, xp: 50, monedas: 20 },
  { id: 'gran', nombre: 'Gran travesía', texto: '8 km en una sesión', meta: 8, valor: (g) => g.kmMax, xp: 180, monedas: 60 },
  { id: 'canal', nombre: 'Cruzar el Canal de la Mancha', texto: '34 km en total', meta: 34, valor: (g) => g.kmTotal, monedas: 150, objeto: 'aura-fuego' },
  { id: 'km50', nombre: 'Cincuenta kilómetros', texto: '50 km en total', meta: 50, valor: (g) => g.kmTotal, xp: 300, monedas: 100 },
  { id: 'hora', nombre: 'La hora del remero', texto: '60 minutos en una sesión', meta: 60, valor: (g) => g.minMax, monedas: 150, objeto: 'cinta-campeon' },
  { id: 'ses25', nombre: 'Veinticinco entrenamientos', texto: 'Completa 25 sesiones', meta: 25, valor: (g) => g.sesiones, xp: 500, monedas: 150 },
  // Antes pedía 14 días seguidos, imposible remando de 1 a 4 veces por semana; quien ya los tenía la conserva.
  { id: 'racha14', nombre: 'Dos meses sin fallar', texto: 'Rema al menos una vez por semana 8 semanas seguidas', meta: 8, valor: (g) => Math.max(g.semanasMax, g.rachaMax >= 14 ? 8 : 0), monedas: 250, objeto: 'capa-leyenda' },
  { id: 'sub8', nombre: 'Bajo 8 minutos', texto: '2000 m en menos de 8:00', meta: 1, valor: (g) => (g.mejor2000 && g.mejor2000 < 480 ? 1 : 0), monedas: 200, objeto: 'aura-hielo' },
  { id: 'nivel10', nombre: 'Aprendiz', texto: 'Llega al nivel 10', meta: 10, valor: (g) => g.nivel, xp: 250, monedas: 100 },
  { id: 'clases4', nombre: 'Vence a las 4 clases', texto: 'Gánale una carrera a rivales de 4 clases distintas', meta: 4, valor: (g) => g.clasesVencidas.size, xp: 300, monedas: 100 },
  { id: 'km100', nombre: 'Cien kilómetros', texto: '100 km en total', meta: 100, valor: (g) => g.kmTotal, xp: 600, monedas: 300, objeto: 'bote-dorado' },
  { id: 'nivel25', nombre: 'Héroe de nivel 25', texto: 'Llega al nivel 25', meta: 25, valor: (g) => g.nivel, monedas: 300, objeto: 'aura-dorada' },
];

// ---------- Medidas de una sesión ----------
const ftpDe = (s, ftpActual) => s.ftp || ftpActual || Math.max(60, Math.round((s.wattsProm || 100) / 0.8));

// Descansos en que el pulso cayó al menos 20 lpm en el primer minuto.
function recuperacionesFc(s) {
  if (!s.bloques || !s.muestras?.some((x) => x.fc)) return 0;
  let desde = 0;
  let n = 0;
  for (const b of s.bloques) {
    if (!b.metrica && b.duracion >= 45) {
      const a = s.muestras.find((x) => x.t >= desde && x.fc);
      const z = s.muestras.find((x) => x.t >= desde + 60 && x.fc);
      if (a && z && a.fc - z.fc >= 20) n++;
    }
    desde += b.duracion || 0;
  }
  return n;
}

// Ritmo estable: 10 min o más con el split variando menos de un 6 % (sin el primer minuto).
export function ritmoEstable(muestras) {
  const v = (muestras || []).filter((x) => x.t > 60 && x.split > 0).map((x) => x.split);
  if (v.length < 600) return false;
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  const desv = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length);
  return desv / media < 0.06;
}

export function medidas(s, ftpActual) {
  const f = ftpDe(s, ftpActual);
  let z2 = 0;
  let z4 = 0;
  let sobre = 0;
  let spm24 = 0;
  for (const x of s.muestras || []) {
    const p = x.w / f;
    if (p >= 0.56 && p <= 0.9) z2++;
    if (p >= 0.91) z4++;
    if (p >= 1.0) sobre++;
    if (x.spm >= 24) spm24++;
  }
  // Una carrera abandonada antes de la meta no suma fantasmas vencidos.
  const rivales = s.carreraSinTerminar ? [] : s.rivales || (s.rival ? [s.rival] : []);
  // Minutos activos: con muestras (1 por segundo) se excluyen las pausas; sin ellas, la duración registrada.
  const activos = s.muestras?.length ? s.muestras.filter((x) => x.w > 0 || x.spm > 0).length / 60 : (s.duracion || 0) / 60;
  return {
    f, min: activos, metros: s.distancia || 0, kcal: s.kcal || 0, estable: ritmoEstable(s.muestras),
    automatica: !!s.muestras?.length,
    z2min: z2 / 60, z4min: z4 / 60, sobreSeg: sobre, spm24min: spm24 / 60,
    pct: s.pctEnRango, ganados: rivales.filter((r) => r.diferencia > 0).length,
    clasesVencidas: rivales.filter((r) => r.diferencia > 0 && r.clase).map((r) => r.clase),
    margenMin: Math.min(Infinity, ...rivales.filter((r) => r.diferencia > 0).map((r) => r.diferencia)),
    t500: s.muestras?.length ? mejorTiempo(s.muestras, 500) : null,
    t2000: s.muestras?.length ? mejorTiempo(s.muestras, 2000) : null,
  };
}

// Sesión sin pausas: 10 min o más sin quedarse 5 s quieto ni saltos de tiempo entre la primera y la última palada.
export function sinPausas(s) {
  const ms = s.muestras || [];
  const activa = (x) => x.w > 0 || x.spm > 0;
  const i0 = ms.findIndex(activa);
  let i1 = ms.length - 1;
  while (i1 >= 0 && !activa(ms[i1])) i1--;
  if (i0 < 0 || ms[i1].t - ms[i0].t < 600) return false;
  let quieto = 0;
  for (let i = i0; i <= i1; i++) {
    if (i > i0 && ms[i].t - ms[i - 1].t > 5) return false;
    quieto = activa(ms[i]) ? 0 : quieto + 1;
    if (quieto >= 5) return false;
  }
  return true;
}

// Desde v0.22.0 se sube de nivel más despacio: las sesiones (y sus misiones) desde esta fecha dan la mitad de XP.
// Las anteriores cuentan igual que antes, así nadie pierde el nivel que ya tenía. Las monedas no cambian.
export const XP_LENTA_DESDE = new Date(2026, 9, 29).getTime();
export const FACTOR_XP_LENTA = 0.5;
export const factorXp = (fecha) => (fecha >= XP_LENTA_DESDE ? FACTOR_XP_LENTA : 1);

// Lo que miran los talentos de XP en una sesión.
function datosTalento(s, m, ctx) {
  const rivales = s.carreraSinTerminar ? 0 : (s.rivales || (s.rival ? [s.rival] : [])).length;
  return {
    paladas: s.paladas || 0, metros: m.metros, min: m.min, ganados: m.ganados, rivales,
    sinPausas: sinPausas(s), delPrograma: !!s.delPrograma && s.tiempoMeta != null, racha: ctx.racha, sesSemana: ctx.sesSemana || 0,
  };
}

// Ganancia de una sesión: XP con detalle y puntos por atributo (antes del bono de clase).
function gananciaSesion(s, m, ctx) {
  const gr = ctx.grados || {};
  const at = { fuerza: 0, agilidad: 0, resistencia: 0, recuperacion: 0, tecnica: 0, voluntad: 0 };
  at.fuerza += m.z4min * 1.2;
  at.agilidad += (s.muestras || []).filter((x) => x.w / m.f >= 1.06).length / 20;
  at.resistencia += m.z2min * 0.5 + (s.duracion >= 1200 ? 4 : 0);
  if (s.distancia >= 400 && s.distancia <= 600 && s.duracion <= 150) at.agilidad += 5;
  const suave = s.wattsProm && s.wattsProm / m.f < 0.75;
  if (suave && ctx.cargaAyer >= 60) at.recuperacion += 5;
  else if (suave) at.recuperacion += 2;
  if (ctx.descansoATiempo) at.recuperacion += 4;
  at.recuperacion += recuperacionesFc(s) * 3;
  if (s.pctEnRango != null) at.tecnica += (m.min * s.pctEnRango) / 100 * 0.6;
  if (s.paladas && ctx.mppPromedio && s.distancia / s.paladas > ctx.mppPromedio * 1.02) at.tecnica += 3;
  const completo = s.tiempoMeta != null;
  if (completo) at.voluntad += 3;
  if (s.rpe >= 8) at.voluntad += 3;
  at.voluntad += Math.min(ctx.racha, 7) * 0.5;

  const carga = s.estres ?? estres(s, m.f) ?? Math.round(m.min * 0.8);
  // XP base: 1 por cada 10 m remados.
  const base = Math.floor(m.metros / XP_POR_METROS);
  const detalle = [['Distancia', base]];
  // Bonos ordinarios entre 25 y 150 XP, sin multiplicadores de toda la sesión.
  if (completo) detalle.push(['Entrenamiento completo', 50]);
  if (ctx.records) detalle.push(['Récord personal', 100]);
  // Cada fantasma vencido vale según su dificultad: Bahía 15, Costa 25 (y los demás fantasmas), Alta mar 40. Máximo 3.
  if (m.ganados) {
    const vencidos = (s.carreraSinTerminar ? [] : s.rivales || (s.rival ? [s.rival] : [])).filter((r) => r.diferencia > 0).slice(0, 3);
    detalle.push([m.ganados === 1 ? 'Fantasma vencido' : `${m.ganados} fantasmas vencidos`, vencidos.reduce((a, r) => a + xpPorFantasma(r.dificultad), 0)]);
  }
  if (ctx.racha > 1) detalle.push([`Racha de ${ctx.racha} días`, 5 * Math.min(ctx.racha, 7)]);
  if (s.ventajaUsada === 'estandarte' && m.ganados) detalle.push(['Estandarte', 25]);
  // Talentos de la clase (solo los grados aprendidos antes de esta sesión): números fijos con tope por sesión.
  if (ctx.clase) {
    const rivales = s.carreraSinTerminar ? 0 : (s.rivales || (s.rival ? [s.rival] : [])).length;
    detalle.push(...xpTalentos(ctx.clase, gr, datosTalento(s, m, ctx)));
  }
  const f = factorXp(s.fecha);
  const detalleXp = f === 1 ? detalle : detalle.map(([k, v]) => [k, Math.round(v * f)]);
  return { xp: detalleXp.reduce((a, [, v]) => a + v, 0), xpBase: detalle.reduce((a, [, v]) => a + v, 0), detalle: detalleXp, atributos: at, carga, datosTal: datosTalento(s, m, ctx) };
}

// ---------- Estado completo del juego ----------
// per = { clase, nombre, arbol: { clase: { slot: [fechas] } }, inventario: { id: n }, gastado, equipo }
export function estadoJuego(sesiones, { ftp = 0, per = {}, ahora = Date.now() } = {}) {
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const fav = claseDe(per.clase)?.favorito;
  const claveClase = claseDe(per.clase)?.clave || null;
  const arbol = (claveClase && per.arbol?.[claveClase]) || {};
  const sesPorSemana = new Map();
  const atributos = Object.fromEntries(ATRIBUTOS.map((a) => [a.clave, 0]));
  const mejores = {};
  const cargaDia = new Map();
  const dias = new Set();
  const porSesion = new Map();
  const logros = [];
  const premios = new Set();
  let xp = 0;
  let monedas = 0;
  let mppSuma = 0;
  let mppN = 0;
  const g = { clasesVencidas: new Set(), kmTotal: 0, kmMax: 0, minMax: 0, rachaMax: 0, semanas: 0, semanasMax: 0, ultimoLunes: null, mejor2000: null, nivel: 1, sesiones: 0, misiones: 0 };
  // Inicio del día y del lunes (ms) para ajustar las misiones a tu ritmo de las semanas anteriores.
  const inicioDia = (ms) => new Date(ms).setHours(0, 0, 0, 0);
  const inicioLunes = (lunes) => new Date(`${lunes}T00:00`).getTime();
  const cons = { semana: null, sesSemana: 0, mes: null, sesMes: 0, pagadoMes: false, semanasSeguidas: 0, ultimaSemanaOk: null };
  let xpSesion = 0; // XP de misiones, constancia y logros ganada en la sesión que se está procesando
  const dia = { clave: null, misiones: [], hechas: new Set(), d: null };
  const semana = { clave: null, misiones: [], hechas: new Set(), d: null };
  const nuevoAgg = () => ({ metros: 0, min: 0, kcal: 0, z2min: 0, z4min: 0, sobreSeg: 0, spm24min: 0, mejorPct: 0, ganados: 0, sesiones: 0, dias: new Set(),
    maxMetros: 0, maxMin: 0, estables: 0, diariasHechas: 0, vencidas: [], atr: Object.fromEntries(ATRIBUTOS.map((a) => [a.clave, 0])) });
  // Atributos antes de cada semana (para elegir la meta de atributo) y si ya usaste banda de pulso.
  let semAtr = { lunes: null, atr: null, pulso: false };
  let hayPulso = false;
  let cap = 0;
  let capAgg = { sesiones: 0, km: 0, z2min: 0, z4min: 0, fantasmas: 0, racha: 0 };
  let capMejores = {};
  const hazanas = new Set();

  // Los premios que antes eran ropa dan ahora una insignia y 50 monedas más.
  const lograr = (fecha, tipo, texto, m0, obj, xpExtra = 0) => {
    const m = m0 + (obj ? PREMIO_INSIGNIA : 0);
    monedas += m;
    xpExtra = Math.round(xpExtra * factorXp(fecha));
    xp += xpExtra;
    xpSesion += xpExtra;
    if (obj) premios.add(obj);
    logros.push({ fecha, tipo, texto, monedas: m, xp: xpExtra, objeto: obj || null });
  };
  const revisar = (fecha, grupo) => {
    for (const mi of grupo.misiones) {
      if (grupo.hechas.has(mi.id) || mi.valor(grupo.d) < mi.meta) continue;
      grupo.hechas.add(mi.id);
      g.misiones++;
      if (grupo === dia) semana.d.diariasHechas++;
      const pago = mi.monedas;
      lograr(fecha, grupo === dia ? 'diaria' : 'semanal', `${mi.nombre}: ${mi.texto}`, pago, null, mi.xp);
    }
  };

  for (const s of orden) {
    const hoy = claveDia(s.fecha);
    const ayer = claveDia(s.fecha - 864e5);
    const anteayer = claveDia(s.fecha - 2 * 864e5);
    const nuevoDia = !dias.has(hoy);
    dias.add(hoy);
    let racha = 0;
    for (let d = s.fecha; dias.has(claveDia(d)); d -= 864e5) racha++;
    const m = medidas(s, ftp);
    let records = 0;
    if (s.muestras?.length) {
      for (const r of RECORDS) {
        const v = r.calc(s);
        if (v == null) continue;
        const previo = mejores[r.clave];
        const mejor = previo == null || (r.tipo === 'tiempo' ? v < previo : v > previo);
        // Solo cuentan mejoras claras: 1 s en tiempos, 500 m en distancia y 2 % en vatios.
        const clara = previo != null && (r.tipo === 'tiempo' ? previo - v >= 1 : r.clave === 'dist' ? v - previo >= 500 : v >= previo * 1.02);
        if (clara) records++;
        if (mejor) mejores[r.clave] = v;
      }
    }
    const grados = claveClase ? gradosEn(arbol, claveClase, s.fecha) : {};
    const descansoATiempo = !dias.has(ayer) && (cargaDia.get(anteayer) || 0) >= 60;
    const lunesS = lunesDe(s.fecha);
    sesPorSemana.set(lunesS, (sesPorSemana.get(lunesS) || 0) + 1);
    if (semAtr.lunes !== lunesS) semAtr = { lunes: lunesS, atr: { ...atributos }, pulso: hayPulso };
    const gan = gananciaSesion(s, m, { grados, clase: claveClase, sesSemana: sesPorSemana.get(lunesS), racha, records, cargaAyer: cargaDia.get(ayer) || 0, descansoATiempo, mppPromedio: mppN ? mppSuma / mppN : 0 });
    cargaDia.set(hoy, (cargaDia.get(hoy) || 0) + gan.carga);
    if (s.paladas) { mppSuma += s.distancia / s.paladas; mppN++; }
    const nivelAntes = nivelDe(xp);
    xpSesion = 0;
    xp += gan.xp;
    const ganancias = {};
    const atrSesion = {};
    for (const [k, v] of Object.entries(gan.atributos)) {
      const total = v * (k === fav ? 1.15 : 1);
      atributos[k] += total;
      atrSesion[k] = total;
      if (total >= 0.5) ganancias[k] = Math.round(total);
    }
    if (s.fcProm > 0) hayPulso = true;
    const monedasSesion = Math.floor(gan.xpBase / 50);
    monedas += monedasSesion;

    // Misiones del día y de la semana
    if (dia.clave !== hoy) Object.assign(dia, { clave: hoy, misiones: misionesDelDia(hoy, ritmoReciente(orden, inicioDia(s.fecha))), hechas: new Set(), d: nuevoAgg() });
    const lunes = lunesDe(s.fecha);
    if (semana.clave !== lunes) Object.assign(semana, { clave: lunes, misiones: misionesDeSemana(lunes, per.clase, ritmoReciente(orden, inicioLunes(lunes)), atributoDeLaSemana(semAtr.atr, { sinPulso: !semAtr.pulso })), hechas: new Set(), d: nuevoAgg() });
    // Semanas seguidas con al menos una sesión
    if (g.ultimoLunes !== lunes) {
      const seguida = g.ultimoLunes && claveDia(inicioLunes(g.ultimoLunes) + 7 * 864e5 + 12 * 36e5) === lunes;
      g.semanas = seguida ? g.semanas + 1 : 1;
      g.ultimoLunes = lunes;
      g.semanasMax = Math.max(g.semanasMax, g.semanas);
    }
    for (const agg of [dia.d, semana.d]) {
      agg.metros += m.metros; agg.min += m.min; agg.kcal += m.kcal; agg.z2min += m.z2min; agg.z4min += m.z4min;
      agg.sobreSeg += m.sobreSeg; agg.spm24min += m.spm24min; agg.ganados += m.ganados; agg.sesiones++;
      agg.mejorPct = Math.max(agg.mejorPct, m.pct ?? 0);
      agg.maxMetros = Math.max(agg.maxMetros, m.metros); agg.maxMin = Math.max(agg.maxMin, m.min);
      if (m.estable) agg.estables++;
      agg.vencidas.push(...m.clasesVencidas);
      for (const [k, v] of Object.entries(atrSesion)) agg.atr[k] += v;
      agg.dias.add(hoy);
    }
    revisar(s.fecha, dia);
    revisar(s.fecha, semana);

    // Constancia: semana, mes y bloques de 4 semanas
    const C = CONSTANCIA;
    const xpCons = (x) => Math.round(x);
    if (cons.semana !== lunes) {
      const anterior = cons.semana;
      const ok = cons.sesSemana >= 2;
      cons.semanasSeguidas = ok && anterior && claveDia(new Date(anterior + 'T12:00').getTime() + 7 * 864e5) === lunes ? cons.semanasSeguidas : 0;
      Object.assign(cons, { semana: lunes, sesSemana: 0 });
      lograr(s.fecha, 'constancia', C.primeraSemana.texto, 10, null, xpCons(C.primeraSemana.xp));
    }
    cons.sesSemana++;
    if (cons.sesSemana === 2) {
      cons.semanasSeguidas++;
      if (cons.semanasSeguidas === 4) { lograr(s.fecha, 'constancia', C.bloque4.texto, 80, null, xpCons(C.bloque4.xp)); cons.semanasSeguidas = 0; }
    }
    if (cons.sesSemana === 3) lograr(s.fecha, 'constancia', C.semana3.texto, 30, null, xpCons(C.semana3.xp));
    if (cons.sesSemana === 5) lograr(s.fecha, 'constancia', C.semana5.texto, 20, null, xpCons(C.semana5.xp));
    const mes = hoy.slice(0, 7);
    if (cons.mes !== mes) Object.assign(cons, { mes, sesMes: 0, pagadoMes: false });
    if (++cons.sesMes >= 12 && !cons.pagadoMes) { cons.pagadoMes = true; lograr(s.fecha, 'constancia', C.mes12.texto, 60, null, xpCons(C.mes12.xp)); }

    // Capítulo de la historia
    g.kmTotal += m.metros / 1000;
    g.kmMax = Math.max(g.kmMax, m.metros / 1000);
    g.sesiones++;
    for (const k of m.clasesVencidas) g.clasesVencidas.add(k);
    g.minMax = Math.max(g.minMax, m.min);
    g.rachaMax = Math.max(g.rachaMax, racha);
    if (m.t2000) g.mejor2000 = g.mejor2000 == null ? m.t2000 : Math.min(g.mejor2000, m.t2000);
    g.nivel = nivelDe(xp);
    if (cap < CAPITULOS.length) {
      const c = CAPITULOS[cap];
      capAgg.sesiones++; capAgg.km += m.metros / 1000; capAgg.z2min += m.z2min; capAgg.z4min += m.z4min;
      capAgg.fantasmas += m.ganados; capAgg.racha = Math.max(capAgg.racha, racha);
      const listo = c.req.every(([k, v]) => capAgg[k] >= v);
      const nombre = s.entrenamiento || '';
      const vence = {
        p500: nombre.startsWith('Prueba 500') && s.tiempoMeta != null,
        p2000: (nombre.startsWith('Prueba 2000') || nombre === '2000 m') && s.tiempoMeta != null,
        pftp: !!s.pruebaWatts,
        mejor500: m.t500 != null && (capMejores.t500 == null || m.t500 < capMejores.t500),
        mejor2000: m.t2000 != null && (capMejores.t2000 == null || m.t2000 < capMejores.t2000),
      }[c.jefe.tipo];
      if (listo && vence) {
        lograr(s.fecha, 'jefe', `Venciste ${c.jefe.nombre.replace(/^El /, 'al ').replace(/^La /, 'a la ')} y terminaste «${c.nombre}»`, c.monedas, c.objeto, c.xp);
        cap++;
        capAgg = { sesiones: 0, km: 0, z2min: 0, z4min: 0, fantasmas: 0, racha: 0 };
        capMejores = { t500: mejores.t500, t2000: mejores.t2000 };
      }
    }
    // Logros: se revisan hasta que no salga ninguno nuevo (uno puede subir el nivel y desbloquear otro).
    for (let nuevo = true; nuevo;) {
      nuevo = false;
      g.nivel = nivelDe(xp);
      for (const h of HAZANAS) {
        if (!hazanas.has(h.id) && h.valor(g) >= h.meta) {
          hazanas.add(h.id);
          nuevo = true;
          lograr(s.fecha, 'hazana', `Logro: ${h.nombre}`, h.monedas, h.objeto, h.xp || 0);
        }
      }
    }
    porSesion.set(s.fecha, { xp: gan.xp, xpExtra: xpSesion, detalle: gan.detalle, ganancias, nivelAntes, nivelDespues: nivelDe(xp), monedas: monedasSesion, datosTal: gan.datosTal, grados });
  }

  // Misiones de hoy y de esta semana aunque todavía no hayas remado.
  const hoy = claveDia(ahora);
  const lunes = lunesDe(ahora);
  const diaHoy = dia.clave === hoy ? dia : { misiones: misionesDelDia(hoy, ritmoReciente(orden, inicioDia(ahora))), hechas: new Set(), d: nuevoAgg() };
  const atrHoy = atributoDeLaSemana(atributos, { sinPulso: !hayPulso });
  const semanaHoy = semana.clave === lunes ? semana : { misiones: misionesDeSemana(lunes, per.clase, ritmoReciente(orden, inicioLunes(lunes)), atrHoy), hechas: new Set(), d: nuevoAgg() };
  // La XP que se muestra es la que se paga hoy (desde el 29 de octubre, la mitad).
  const fHoy = factorXp(ahora);
  const vista = (gr) => gr.misiones.map((mi) => ({
    id: mi.id, clave: mi.clave, nombre: mi.nombre, texto: mi.texto, meta: mi.meta, monedas: mi.monedas, xp: Math.round(mi.xp * fHoy),
    hecha: gr.hechas.has(mi.id), valor: Math.min(mi.meta, mi.valor(gr.d)), preparar: prepararMision(mi), atributo: mi.atributo || null,
  }));
  // XP media de tus últimas 5 sesiones (con misiones y bonos): para decir cuántas sesiones faltan.
  const ultimas = [...porSesion.values()].slice(-5);
  const xpPorSesion = ultimas.length ? ultimas.reduce((a, x) => a + x.xp + x.xpExtra, 0) / ultimas.length : 0;

  const nivel = nivelDe(xp);
  const gastados = puntosGastados(arbol);
  const capitulo = cap < CAPITULOS.length ? {
    n: cap + 1, ...CAPITULOS[cap], xp: Math.round(CAPITULOS[cap].xp * fHoy),
    progreso: CAPITULOS[cap].req.map(([k, v]) => ({ clave: k, texto: REQ_TEXTO[k], meta: v, valor: Math.min(v, Math.round(capAgg[k] * 10) / 10) })),
    listo: CAPITULOS[cap].req.every(([k, v]) => capAgg[k] >= v),
    preparar: PRUEBA_JEFE[CAPITULOS[cap].jefe.tipo],
  } : null;
  return {
    xp,
    nivel,
    titulo: tituloDe(nivel),
    desde: xpParaNivel(nivel),
    hasta: nivel >= NIVEL_MAX ? null : xpParaNivel(nivel + 1),
    talentos: puntosDeNivel(nivel),
    talentosLibres: puntosDeNivel(nivel) - gastados,
    atributos: Object.fromEntries(Object.entries(atributos).map(([k, v]) => [k, Math.round(v)])),
    porSesion,
    logros,
    monedas: monedas - (per.gastado || 0),
    monedasGanadas: monedas,
    insignias: premios,
    diarias: vista(diaHoy),
    semanales: vista(semanaHoy),
    capitulo,
    capitulosHechos: cap,
    hazanas: HAZANAS.map((h) => ({ ...h, xp: Math.round((h.xp || 0) * fHoy), hecha: hazanas.has(h.id), valor: Math.min(h.meta, Math.floor(h.valor(g))) })),
    xpPorSesion,
    ritmo: ritmoReciente(orden, ahora),
    factorXp: fHoy,
    contexto: contextoHoy(orden, { ahora, dias, cargaDia, mppPromedio: mppN ? mppSuma / mppN : 0, sinPulso: !hayPulso }),
  };
}

// Lo que necesita una sesión de hoy para estimar sus atributos: racha si remas hoy, tu % en rango de siempre, etc.
function contextoHoy(orden, { ahora, dias, cargaDia, mppPromedio, sinPulso }) {
  let racha = 1;
  for (let d = ahora - 864e5; dias.has(claveDia(d)); d -= 864e5) racha++;
  const pcts = orden.filter((s) => s.pctEnRango != null).slice(-8).map((s) => s.pctEnRango);
  return {
    racha, mppPromedio, sinPulso, cargaAyer: cargaDia.get(claveDia(ahora - 864e5)) || 0,
    pctMedio: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
  };
}

// Puntos de atributo de una sesión suelta (con el 15 % del favorito de tu clase), sin decimales recortados.
// ctx = { racha, mppPromedio, cargaAyer, descansoATiempo } como en estadoJuego.
export function atributosDeSesion(s, { ftp = 0, clase = null, ctx = {} } = {}) {
  const m = medidas(s, ftp);
  const { atributos } = gananciaSesion(s, m, { racha: ctx.racha || 0, mppPromedio: ctx.mppPromedio || 0, cargaAyer: ctx.cargaAyer || 0, descansoATiempo: !!ctx.descansoATiempo });
  const fav = claseDe(clase)?.favorito;
  return Object.fromEntries(Object.entries(atributos).map(([k, v]) => [k, v * (k === fav ? 1.15 : 1)]));
}
export const factorAtributo = (clave, clase) => (claseDe(clase)?.favorito === clave ? 1.15 : 1);

// Títulos por atributo: «Aprendiz de la fuerza» a los 50 puntos… hasta «Leyenda de la fuerza».
export const TITULOS_ATRIBUTO = [[50, 'Aprendiz'], [150, 'Iniciado'], [400, 'Experto'], [1000, 'Maestro'], [2500, 'Leyenda']];
const DE_ATRIBUTO = { fuerza: 'de la fuerza', agilidad: 'de la agilidad', resistencia: 'de la resistencia', recuperacion: 'de la recuperación', tecnica: 'de la técnica', voluntad: 'de la voluntad' };
export function tituloAtributo(clave, valor) {
  const v = Math.round(valor || 0);
  const hechos = TITULOS_ATRIBUTO.filter(([m]) => v >= m);
  const sig = TITULOS_ATRIBUTO.find(([m]) => v < m);
  const nombre = (t) => `${t} ${DE_ATRIBUTO[clave]}`;
  return {
    actual: hechos.length ? nombre(hechos.at(-1)[1]) : null,
    siguiente: sig ? { nombre: nombre(sig[1]), meta: sig[0], faltan: sig[0] - v } : null,
  };
}
export const progresoHeroe = (sesiones, { ftp = 0, clase = null } = {}) => estadoJuego(sesiones, { ftp, per: { clase } });

// Tienda de la semana: 4 de las 6 ventajas, iguales toda la semana.
export const tiendaSemana = (lunes) => tiendaVentajas(azar(`t${lunes}`));
export { objeto };

// Cuándo cuesta más ganarle a cada clase rival (para la vista previa).
export const CUANDO_DIFICIL = {
  vikingo: 'Difícil en carreras cortas', pirata: 'Difícil cuando vas justo de margen', samurai: 'Difícil si te descontrolas al principio',
  polinesio: 'Difícil en carreras largas', romano: 'Difícil en intervalos',
};

// XP estimada de una sesión que aún no has remado: lo que sube tu XP total al añadirla al historial
// (incluye bonos, talentos, misiones, constancia y logros que completaría).
export function estimarXp(sesiones, hipotetica, opts = {}) {
  const antes = estadoJuego(sesiones, opts);
  const despues = estadoJuego([...sesiones, hipotetica], opts);
  const ps = despues.porSesion.get(hipotetica.fecha);
  return {
    total: despues.xp - antes.xp, sesion: ps.xp, extra: ps.xpExtra, detalle: ps.detalle,
    monedas: despues.monedasGanadas - antes.monedasGanadas, subeNivel: despues.nivel > antes.nivel ? despues.nivel : null,
    ganancias: ps.ganancias, contexto: antes.contexto, atributos: antes.atributos,
  };
}

// XP por sesión que sumaría subir un talento de XP a `gradoNuevo`, con tus últimas 8 sesiones (ya con la XP de hoy).
export function xpTalentoEstimada(h, clase, slot, gradoNuevo) {
  const ult = [...h.porSesion.values()].slice(-8);
  if (!ult.length) return null;
  const suma = (gr, d) => xpTalentos(clase, gr, d).reduce((a, [, v]) => a + v, 0);
  const extra = ult.reduce((a, p) => a + suma({ ...(p.grados || {}), [slot]: gradoNuevo }, p.datosTal) - suma(p.grados || {}, p.datosTal), 0);
  return Math.round((extra / ult.length) * (h.factorXp ?? 1));
}

// Puntos de cada atributo ganados entre `desde` y `hasta` (ms), sumando las sesiones.
export function atributosEntre(h, desde, hasta = Infinity) {
  const out = Object.fromEntries(ATRIBUTOS.map((a) => [a.clave, 0]));
  for (const [f, p] of h.porSesion) if (f >= desde && f < hasta) for (const [k, v] of Object.entries(p.ganancias)) out[k] += v;
  return out;
}

// Qué entrenar según el atributo más flojo: un entrenamiento base (se adapta a tu nivel) y un reto contra rivales.
// El reto elige la dificultad de los rivales: inferior = Bahía, igual = Costa, superior = Alta mar.
export const RECOMENDACION_ATRIBUTO = {
  fuerza: { base: 'base:pot-mant', entrenamiento: 'Umbral', reto: 'superior', texto: 'Series en zona 4. Un rival superior te obliga a apretar en cada bloque.' },
  agilidad: { base: 'base:pot-mejora', entrenamiento: 'VO2 máx', reto: 'igual', texto: 'Series cortas por encima de tu FTP. Si te toca un vikingo, aguanta su salida fuerte.' },
  resistencia: { base: 'base:dis-mant', entrenamiento: 'Fondo', reto: 'igual', texto: 'Distancia larga en zona 2. Un polinesio acelera al final: guarda fuerzas para el último tramo.' },
  recuperacion: { base: null, entrenamiento: null, reto: 'inferior', texto: 'Remo libre suave en zona 1 y 2, o un día de descanso. Un rival inferior para remar sin presión.' },
  tecnica: { base: 'base:rit-mant', entrenamiento: 'Ritmo de crucero', reto: 'igual', texto: 'Ritmo parejo y buena distancia por palada. Rema como un samurái: constante de principio a fin.' },
  voluntad: { base: 'base:pal-mejora', entrenamiento: 'Paladas en pirámide', reto: 'superior', texto: 'Termina el entrenamiento completo y cuida tu racha. Un rival superior pone a prueba tu voluntad.' },
};
export const DIFICULTAD_RETO = { inferior: 'bahia', igual: 'costa', superior: 'altamar' };
// sinPulso: sin banda de pulso, Recuperación casi no puede crecer; se recomienda el siguiente más bajo.
export function recomendarPorAtributos(atributos, { sinPulso = false } = {}) {
  const lista = ATRIBUTOS.filter((a) => !(sinPulso && a.clave === 'recuperacion')).map((a) => ({ ...a, valor: atributos[a.clave] || 0 }));
  if (!lista.some((a) => a.valor > 0)) return null;
  const flojo = lista.reduce((m, a) => (a.valor < m.valor ? a : m));
  return { atributo: flojo, ...RECOMENDACION_ATRIBUTO[flojo.clave] };
}
