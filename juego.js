// Héroe: tu personaje crece con tus entrenamientos reales.
// Todo se calcula desde el historial, así que las sesiones viejas también cuentan.
// Nada de esto cambia tus métricas reales: solo el juego.
import { gradosEn, puntosDeNivel, puntosGastados, talentosDe } from './talentos.js';
import { estres, claveDia, RECORDS, mejorTiempo } from './estadisticas.js';
import { objeto } from './objetos.js';
import { tiendaVentajas } from './ventajas.js';
export const PREMIO_INSIGNIA = 50;

export const ATRIBUTOS = [
  { clave: 'fuerza', nombre: 'Fuerza', detalle: 'Minutos en zona 4 o más y récords de potencia' },
  { clave: 'agilidad', nombre: 'Agilidad', detalle: 'Sprints y series cortas por encima de tu FTP' },
  { clave: 'resistencia', nombre: 'Resistencia', detalle: 'Minutos en zonas 2 y 3, sesiones de 20 min o más' },
  { clave: 'recuperacion', nombre: 'Recuperación', detalle: 'Pulso que baja en los descansos, días suaves y descansos a tiempo' },
  { clave: 'tecnica', nombre: 'Técnica', detalle: 'Tiempo en rango y buena distancia por palada' },
  { clave: 'voluntad', nombre: 'Voluntad', detalle: 'Rachas, entrenamientos completos y sesiones muy duras' },
];

// Cada clase tiene un atributo favorito que crece un 15 % más rápido.
export const CLASES = [
  { clave: 'vikingo', nombre: 'Vikingo', favorito: 'fuerza', lema: 'Cada palada es un hachazo.', icono: '<path d="M5 14a7 7 0 0 1 14 0v3H5z"/><path d="M5 13 2.5 6M19 13l2.5-7M9 17v3M15 17v3M12 7v4"/>' },
  { clave: 'pirata', nombre: 'Pirata', favorito: 'agilidad', lema: 'Rápido, impredecible y al abordaje.', icono: '<path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.3 4 3 5v3h8v-3c1.7-1 3-2.6 3-5a7 7 0 0 0-7-7z"/><path d="M9 10h.01M15 10h.01M10 18v3M14 18v3"/>' },
  { clave: 'samurai', nombre: 'Samurái', favorito: 'tecnica', lema: 'La forma perfecta vence a la fuerza.', icono: '<path d="M5 19 19 5l1.5-1.5M15 5l4 4M7 15l2 2M3.5 20.5 5 19"/>' },
  { clave: 'polinesio', nombre: 'Polinesio', favorito: 'resistencia', lema: 'El océano entero es tu camino.', icono: '<path d="M12 2v12"/><path d="M9.5 14h5l-1 6.5a1.5 1.5 0 0 1-3 0z"/><path d="M3 9c2 1.5 4 1.5 6 0M15 9c2 1.5 4 1.5 6 0"/>' },
  { clave: 'romano', nombre: 'Romano', favorito: 'voluntad', lema: 'No se rinde. Nunca.', icono: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="M12 7v10M8 11h8"/>' },
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
// Retos: el rango del rival respecto al tuyo y su FTP respecto al tuyo.
export const RETOS = {
  igual: { nombre: 'Rival de tu rango', rango: 0, ftp: 1 },
  superior: { nombre: 'Rival superior', rango: 1, ftp: 1.05 },
  inferior: { nombre: 'Rival inferior', rango: -1, ftp: 0.93 },
};
// Las opciones antiguas de fantasma pasan al reto equivalente.
export const RETO_ANTIGUO = { principiante: 'inferior', intermedio: 'igual', avanzado: 'superior' };
const otrasClases = (miClase) => CLASES.map((c) => c.clave).filter((k) => k !== claseDe(miClase)?.clave);
// La clase rival de la semana: la misma toda la semana, nunca la tuya.
export function rivalDeLaSemana(lunes, miClase) {
  const otras = otrasClases(miClase);
  return otras[Math.floor(azar(`r${lunes}`)() * otras.length)];
}
// Rivales para una sesión: el primero es siempre de la clase de la semana; el resto, de otras clases.
export function rivalesPara(retos, { miClase = null, nivel = 1, ftp = 150, lunes, semilla = '' } = {}) {
  const semana = rivalDeLaSemana(lunes, miClase);
  const r = azar(`n${lunes}${semilla}`);
  const resto = otrasClases(miClase).filter((k) => k !== semana).sort(() => r() - 0.5);
  const clases = [semana, ...resto];
  const mio = RANGOS.indexOf(rangoDe(nivel));
  return retos.map((reto, i) => {
    const def = RETOS[reto];
    const clase = clases[i % clases.length];
    const rango = RANGOS[Math.max(0, Math.min(RANGOS.length - 1, mio + def.rango))];
    const nombres = NOMBRES_RIVAL[clase];
    const nombre = nombres[Math.floor(r() * nombres.length)];
    return { reto, clase, rango: rango.id, ftp: Math.round(ftp * def.ftp), nombre: `${nombre} (${claseDe(clase).nombre} ${rango.nombre})` };
  });
}

// ---------- Talentos: por clase, en talentos.js ----------
export { talentosDe, gradosEn, motivoBloqueo, puntosDeNivel, puntosGastados, nombreRama, ramaFavorita, grado, RAMAS, NOMBRE_TIER, NIVEL_REQUERIDO } from './talentos.js';

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
  return { id: `${semilla}:${d.id}`, nombre: d.nombre, texto: d.texto(d.metas[k]), meta: d.metas[k], valor: d.valor, xp, monedas: monedasDe(xp) };
};
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
export function misionesDelDia(dia) {
  const semilla = `d${dia}`;
  const r = azar(semilla);
  return [crear(DIARIA_DIST, r, semilla), crear(DIARIA_DUR, r, semilla), ...elegir(DIARIAS, 3, semilla, r)];
}
export function misionesDeSemana(lunes, clase = null) {
  const semilla = `s${lunes}`;
  const r = azar(semilla);
  const tema = MISION_CLASE[claseDe(clase)?.clave];
  const rival = rivalDeLaSemana(lunes, clase);
  const reto = { id: 'rival', nombre: 'Rival de la semana', texto: () => `Gánale una carrera a un rival ${claseDe(rival).nombre.toLowerCase()}`, metas: [1], xp: [150], valor: (d) => d.vencidas.filter((k) => k === rival).length };
  return [crear(SEMANAL_RUTA, r, semilla), ...(tema ? [crear(tema, r, semilla)] : []), ...elegir(SEMANALES, tema ? 1 : 2, semilla, r), crear(reto, r, semilla)];
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
    req: [['sesiones', 2], ['km', 3]], jefe: { nombre: 'El Guardián del muelle', tipo: 'p500', texto: 'Completa la «Prueba 500 m»' }, monedas: 100, objeto: 'casco-cuernos-oro' },
  { nombre: 'Río arriba', historia: 'La corriente empuja en contra. Solo la constancia te lleva al nacimiento del río.',
    req: [['sesiones', 5], ['km', 15], ['z2min', 30]], jefe: { nombre: 'La Serpiente del río', tipo: 'p2000', texto: 'Completa una prueba de 2000 m' }, monedas: 150, objeto: 'sombrero-capitan' },
  { nombre: 'La tormenta', historia: 'El cielo se rompe. Rayos, olas y fantasmas en la niebla.',
    req: [['z4min', 30], ['fantasmas', 3]], jefe: { nombre: 'El Kraken', tipo: 'pftp', texto: 'Completa la «Prueba FTP 20 min»' }, monedas: 200, objeto: 'kabuto' },
  { nombre: 'Mar abierto', historia: 'Nada a la vista más que agua. Tu racha es tu brújula.',
    req: [['km', 50], ['racha', 4]], jefe: { nombre: 'El Dragón de los 500', tipo: 'mejor500', texto: 'Supera tu mejor 500 m' }, monedas: 250, objeto: 'corona-hielo' },
  { nombre: 'La leyenda', historia: 'Los bardos ya cantan tu nombre. Falta el último duelo.',
    req: [['km', 80], ['sesiones', 10]], jefe: { nombre: 'El Rey de los mares', tipo: 'mejor2000', texto: 'Supera tu mejor 2000 m' }, monedas: 300, objeto: 'armadura-gladiador' },
];
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
  { id: 'racha14', nombre: 'Dos semanas sin parar', texto: '14 días seguidos', meta: 14, valor: (g) => g.rachaMax, monedas: 250, objeto: 'capa-leyenda' },
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
  const rivales = s.rivales || (s.rival ? [s.rival] : []);
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

// Ganancia de una sesión: XP con detalle y puntos por atributo (antes del bono de clase).
function gananciaSesion(s, m, ctx) {
  const gr = ctx.grados || {};
  const nombre = (slot) => ctx.nombres?.[slot] || slot;
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
  if (m.ganados) detalle.push([m.ganados === 1 ? 'Fantasma vencido' : `${m.ganados} fantasmas vencidos`, 25 * Math.min(m.ganados, 3)]);
  if (ctx.racha > 1) detalle.push([`Racha de ${ctx.racha} días`, 5 * Math.min(ctx.racha, 7)]);
  if (s.ventajaUsada === 'estandarte' && m.ganados) detalle.push(['Estandarte', 25]);
  // Talentos de la clase (solo los grados aprendidos antes de esta sesión). Entre todos, como mucho +12 % de la distancia.
  const talento = (slot, cond, xp) => { if (gr[slot] && cond && xp > 0) detalle.push([nombre(slot), xp]); };
  talento('potencia-1', m.z4min >= 5, Math.round(base * 0.04 * gr['potencia-1']));
  talento('fondo-1', m.min >= 30, Math.round(base * 0.04 * gr['fondo-1']));
  talento('disciplina-1', m.estable, Math.round(base * 0.04 * gr['disciplina-1']));
  talento('potencia-3', ctx.records > 0, 25 * (gr['potencia-3'] || 0));
  talento('fondo-3', m.metros > 5000, 5 * (gr['fondo-3'] || 0) * Math.floor((m.metros - 5000) / 1000));
  return { xp: detalle.reduce((a, [, v]) => a + v, 0), detalle, atributos: at, carga };
}

// ---------- Estado completo del juego ----------
// per = { clase, nombre, arbol: { clase: { slot: [fechas] } }, inventario: { id: n }, gastado, equipo }
export function estadoJuego(sesiones, { ftp = 0, per = {}, ahora = Date.now() } = {}) {
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const fav = claseDe(per.clase)?.favorito;
  const claveClase = claseDe(per.clase)?.clave || null;
  const arbol = (claveClase && per.arbol?.[claveClase]) || {};
  const nombresTal = claveClase ? Object.fromEntries(talentosDe(claveClase).map((t) => [t.slot, t.nombre])) : {};
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
  const g = { clasesVencidas: new Set(), kmTotal: 0, kmMax: 0, minMax: 0, rachaMax: 0, mejor2000: null, nivel: 1, sesiones: 0, misiones: 0 };
  const cons = { semana: null, sesSemana: 0, mes: null, sesMes: 0, pagadoMes: false, semanasSeguidas: 0, ultimaSemanaOk: null };
  let xpSesion = 0; // XP de misiones, constancia y logros ganada en la sesión que se está procesando
  const dia = { clave: null, misiones: [], hechas: new Set(), d: null };
  const semana = { clave: null, misiones: [], hechas: new Set(), d: null };
  const nuevoAgg = () => ({ metros: 0, min: 0, kcal: 0, z2min: 0, z4min: 0, sobreSeg: 0, spm24min: 0, mejorPct: 0, ganados: 0, sesiones: 0, dias: new Set(),
    maxMetros: 0, maxMin: 0, estables: 0, diariasHechas: 0, vencidas: [] });
  let cap = 0;
  let capAgg = { sesiones: 0, km: 0, z2min: 0, z4min: 0, fantasmas: 0, racha: 0 };
  let capMejores = {};
  const hazanas = new Set();

  // Los premios que antes eran ropa dan ahora una insignia y 50 monedas más.
  const lograr = (fecha, tipo, texto, m0, obj, xpExtra = 0) => {
    const m = m0 + (obj ? PREMIO_INSIGNIA : 0);
    monedas += m;
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
    const gan = gananciaSesion(s, m, { grados, nombres: nombresTal, racha, records, cargaAyer: cargaDia.get(ayer) || 0, descansoATiempo, mppPromedio: mppN ? mppSuma / mppN : 0 });
    cargaDia.set(hoy, (cargaDia.get(hoy) || 0) + gan.carga);
    if (s.paladas) { mppSuma += s.distancia / s.paladas; mppN++; }
    const nivelAntes = nivelDe(xp);
    xpSesion = 0;
    xp += gan.xp;
    const ganancias = {};
    for (const [k, v] of Object.entries(gan.atributos)) {
      const total = v * (k === fav ? 1.15 : 1);
      atributos[k] += total;
      if (total >= 0.5) ganancias[k] = Math.round(total);
    }
    const monedasSesion = Math.floor(gan.xp / 50);
    monedas += monedasSesion;

    // Misiones del día y de la semana
    if (dia.clave !== hoy) Object.assign(dia, { clave: hoy, misiones: misionesDelDia(hoy), hechas: new Set(), d: nuevoAgg() });
    const lunes = lunesDe(s.fecha);
    if (semana.clave !== lunes) Object.assign(semana, { clave: lunes, misiones: misionesDeSemana(lunes, per.clase), hechas: new Set(), d: nuevoAgg() });
    for (const agg of [dia.d, semana.d]) {
      agg.metros += m.metros; agg.min += m.min; agg.kcal += m.kcal; agg.z2min += m.z2min; agg.z4min += m.z4min;
      agg.sobreSeg += m.sobreSeg; agg.spm24min += m.spm24min; agg.ganados += m.ganados; agg.sesiones++;
      agg.mejorPct = Math.max(agg.mejorPct, m.pct ?? 0);
      agg.maxMetros = Math.max(agg.maxMetros, m.metros); agg.maxMin = Math.max(agg.maxMin, m.min);
      if (m.estable) agg.estables++;
      agg.vencidas.push(...m.clasesVencidas);
      agg.dias.add(hoy);
    }
    revisar(s.fecha, dia);
    revisar(s.fecha, semana);

    // Constancia: semana, mes y bloques de 4 semanas
    const C = CONSTANCIA;
    const xpCons = (x) => Math.round(x * (1 + 0.1 * (grados['disciplina-3'] || 0)));
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
        lograr(s.fecha, 'jefe', `Venciste ${c.jefe.nombre.replace(/^El /, 'al ').replace(/^La /, 'a la ')} y terminaste «${c.nombre}»`, c.monedas, c.objeto);
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
    porSesion.set(s.fecha, { xp: gan.xp, xpExtra: xpSesion, detalle: gan.detalle, ganancias, nivelAntes, nivelDespues: nivelDe(xp), monedas: monedasSesion });
  }

  // Misiones de hoy y de esta semana aunque todavía no hayas remado.
  const hoy = claveDia(ahora);
  const lunes = lunesDe(ahora);
  const diaHoy = dia.clave === hoy ? dia : { misiones: misionesDelDia(hoy), hechas: new Set(), d: nuevoAgg() };
  const semanaHoy = semana.clave === lunes ? semana : { misiones: misionesDeSemana(lunes, per.clase), hechas: new Set(), d: nuevoAgg() };
  const vista = (gr) => gr.misiones.map((mi) => ({ id: mi.id, nombre: mi.nombre, texto: mi.texto, meta: mi.meta, monedas: mi.monedas, xp: mi.xp, hecha: gr.hechas.has(mi.id), valor: Math.min(mi.meta, mi.valor(gr.d)) }));

  const nivel = nivelDe(xp);
  const gastados = puntosGastados(arbol);
  const capitulo = cap < CAPITULOS.length ? {
    n: cap + 1, ...CAPITULOS[cap],
    progreso: CAPITULOS[cap].req.map(([k, v]) => ({ clave: k, texto: REQ_TEXTO[k], meta: v, valor: Math.min(v, Math.round(capAgg[k] * 10) / 10) })),
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
    hazanas: HAZANAS.map((h) => ({ ...h, hecha: hazanas.has(h.id), valor: Math.min(h.meta, Math.floor(h.valor(g))) })),
  };
}
export const progresoHeroe = (sesiones, { ftp = 0, clase = null } = {}) => estadoJuego(sesiones, { ftp, per: { clase } });

// Tienda de la semana: 4 de las 6 ventajas, iguales toda la semana.
export const tiendaSemana = (lunes) => tiendaVentajas(azar(`t${lunes}`));
export { objeto };
