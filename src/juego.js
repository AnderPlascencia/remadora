// Héroe: tu personaje crece con tus entrenamientos reales.
// Todo se calcula desde el historial, así que las sesiones viejas también cuentan.
// Nada de esto cambia tus métricas reales: solo el juego.
import { gradosEn, puntosDeNivel, puntosGastados, xpTalentos, SLOTS, GRADOS_MAX, costeDe, motivoBloqueo, puntosSobrantes, MONEDAS_POR_PUNTO } from './talentos.js';
import { estres, claveDia, RECORDS, mejorTiempo, factorIntensidad } from './estadisticas.js';
import { tipoSesion } from './capacidades.js';
import * as XC from './xp-carga.js';
import { tecnicaDeSesion, TOPE_MIN as TOPE_TECNICA_MIN } from './tecnica.js';
import { objeto } from './objetos.js';
import { hazanaDeClase } from './coleccion-bote.js';
import { tiendaVentajas, XP_ESTANDARTE, XP_ESTANDARTE_ANTES, MONEDAS_ESTANDARTE, XP_BITACORA, MONEDAS_BOTIN } from './ventajas.js';
export const PREMIO_INSIGNIA = 50;

// Cada atributo representa una capacidad física real (la que mide Progreso › Mis capacidades).
export const ATRIBUTOS = [
  { clave: 'fuerza', nombre: 'Fuerza', capacidad: 'Umbral (FTP)', detalle: 'Minutos en zona 4 o más' },
  { clave: 'agilidad', nombre: 'Agilidad', capacidad: 'VO₂máx y potencia', detalle: 'Sprints y series cortas por encima de tu FTP' },
  { clave: 'resistencia', nombre: 'Resistencia', capacidad: 'Base aeróbica', detalle: 'Minutos en zonas 2 y 3, sesiones de 20 min o más' },
  { clave: 'recuperacion', nombre: 'Recuperación', capacidad: 'Recuperación', detalle: 'Pulso que baja en los descansos, días suaves y descansos a tiempo' },
  { clave: 'tecnica', nombre: 'Técnica', capacidad: 'Técnica y economía', detalle: 'Potencia pareja palada a palada y cadencia estable' },
  { clave: 'voluntad', nombre: 'Voluntad', capacidad: 'Constancia', detalle: 'Rachas, entrenamientos completos y semanas del plan cumplidas' },
  { clave: 'gasto', nombre: 'Gasto', capacidad: 'Gasto calórico', detalle: 'Calorías quemadas' },
];
// Desde esta semana: atributo Gasto en la meta semanal, misiones por capacidad y pruebas del plan como jefes.
// Las semanas anteriores se calculan como antes, así nadie pierde XP ni cambia una misión ya hecha.
export const CAPACIDADES_DESDE = '2026-11-02';
// Los atributos que se ven son los de las últimas 6 semanas: si dejas de entrenar algo, baja.
export const VENTANA_ATRIBUTOS_DIAS = 42;
export const TEXTO_ATRIBUTOS = 'Muestran lo que has entrenado en las últimas 6 semanas: si dejas de trabajar uno, baja. Los títulos miran todo lo que has remado y no se pierden.';
// Etapa 12 (misiones con peso, talentos igualados, monedas, Técnica nueva): desde este día. Lo anterior no cambia,
// así nadie pierde XP, monedas ni títulos.
export const ETAPA12_DESDE = '2026-11-04';
export const esEtapa12 = (fecha) => claveDia(fecha) >= ETAPA12_DESDE;
// Racha del plan (decisión de Ander): desde este día la racha cuenta días seguidos cumpliendo el plan. Vale un día de
// plan con su sesión terminada y un descanso respetado (o en el que recuperaste una sesión del plan); un día fuera del
// calendario vale si remaste, como antes. Las sesiones anteriores siguen con la racha de días seguidos remando.
export const RACHA_PLAN_DESDE = '2026-11-04';

// Cómo sube cada atributo, con tus vatios: lo mismo que calcula gananciaSesion, dicho en claro.
// f = tu FTP (0 si no lo tienes). Devuelve frases cortas, de la que más suma a la que menos.
const vatios = (f, pct) => (f ? `${Math.round(f * pct)} W` : `el ${Math.round(pct * 100)} % de tu FTP`);
export function comoSubir(clave, f = 0) {
  return {
    fuerza: [`Cada minuto por encima de ${vatios(f, 0.91)} (zona 4 o más): +1,2`],
    agilidad: [`Cada 20 s por encima de ${vatios(f, 1.06)}: +1`, 'Un 500 m a fondo en menos de 2:30: +5'],
    resistencia: [`Cada minuto entre ${vatios(f, 0.56)} y ${vatios(f, 0.9)} (zonas 2 y 3): +0,5`, 'Sesiones de 20 min o más: +4'],
    recuperacion: ['Un día de descanso después de un día duro: +4', `Una sesión suave (media por debajo de ${vatios(f, 0.75)}): +2, o +5 si ayer fue duro`, 'Con banda de pulso: +3 por cada descanso en que el pulso baja 20 lpm en un minuto'],
    tecnica: [`Cada minuto con la potencia pareja (±8 %) y la cadencia estable, por encima de ${vatios(f, 0.55)}: +0,6 (hasta ${TOPE_TECNICA_MIN} min)`, 'Con el 70 % de la sesión así (10 min o más): +3', 'Si el bloque pide una cadencia, solo cuenta remando a esa cadencia'],
    voluntad: ['Terminar el entrenamiento completo: +3', 'Cumplir una semana entera de tu plan: +5', 'Cada día seguido cumpliendo el plan (sesiones y descansos): +0,5 (hasta 7)'],
    gasto: ['Cada 50 kcal quemadas: +1', 'Los fondos largos en zona 2 son lo que más quema con menos fatiga'],
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
// Vocabulario épico para el rango y náutico para la tripulación (CLASIFICACIONES), sin nombres repetidos con los
// títulos de atributo, los logros ni los talentos. Los id no cambian: nombran los retratos en assets/heroes.
export const RANGOS = [
  { id: 'novato', nombre: 'Novato', nivel: 1 }, { id: 'aprendiz', nombre: 'Aspirante', nivel: 10 },
  { id: 'combatiente', nombre: 'Combatiente', nivel: 20 }, { id: 'guerrero', nombre: 'Guerrero', nivel: 30 },
  { id: 'veterano', nombre: 'Veterano', nivel: 40 }, { id: 'campeon', nombre: 'Campeón', nivel: 50 },
  { id: 'elite', nombre: 'Paladín', nivel: 60 }, { id: 'maestro', nombre: 'Titán', nivel: 70 },
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
// factor: referencias más bajas para mujeres (perfil.factorClasificacion), 1 para el resto.
export function clasificacionDe(ftp, peso = 0, factor = 1) {
  const porPeso = peso > 0;
  const valor = porPeso ? ftp / peso : ftp;
  const umbral = (c) => (porPeso ? c.wkg : c.w) * factor;
  const i = CLASIFICACIONES.reduce((a, c, k) => (valor >= umbral(c) ? k : a), 0);
  const sig = CLASIFICACIONES[i + 1];
  const falta = sig ? Math.max(0, Math.ceil(umbral(sig) * (porPeso ? peso : 1) - ftp)) : null;
  return { ...CLASIFICACIONES[i], indice: i, valor: Math.round(valor * 100) / 100, porPeso, siguiente: sig || null, faltaW: falta };
}
// Qué significa cada puesto para quien lo ve: cómo reman los rivales de ese puesto.
export const TEXTO_PUESTO = {
  grumete: 'Rivales de remada irregular que se cansan pronto.',
  marinero: 'Rivales algo más parejos; aún aflojan al final.',
  contramaestre: 'Rivales de ritmo constante.',
  oficial: 'Rivales que casi no se cansan.',
  capitan: 'Rivales de remada de máquina, parejos hasta el final.',
};
// La escalera completa de puestos para dibujarla: umbral de cada uno (en W/kg y en tus watts),
// estado (pasado, actual, siguiente, futuro) y cuánto llevas del tramo hacia el siguiente (0 a 1).
export function escalaTripulacion(ftp, peso = 0, factor = 1) {
  const c = clasificacionDe(ftp, peso, factor);
  const porPeso = peso > 0;
  const umbralW = (x) => Math.round((porPeso ? x.wkg * peso : x.w) * factor);
  const filas = CLASIFICACIONES.map((x, i) => ({
    id: x.id, nombre: x.nombre, texto: TEXTO_PUESTO[x.id],
    wkg: Math.round(x.wkg * factor * 100) / 100, w: umbralW(x),
    estado: i < c.indice ? 'pasado' : i === c.indice ? 'actual' : i === c.indice + 1 ? 'siguiente' : 'futuro',
  }));
  const desde = filas[c.indice].w;
  const hasta = filas[c.indice + 1]?.w;
  const progreso = hasta ? Math.max(0, Math.min(1, (ftp - desde) / (hasta - desde))) : 1;
  return { ...c, filas, progreso };
}
// Dificultad de los rivales (en «Por objetivo» y en Remo libre con fantasmas).
export const DIFICULTADES = {
  bahia: { nombre: 'Bahía', texto: 'Fácil: los rivales reman suave para ir parejos a ritmo tranquilo', rango: -1, xp: 15, ftp: () => 0.85, oscila: 0.03 },
  costa: { nombre: 'Costa', texto: 'Medio: los rivales reman a tu mismo nivel', rango: 0, xp: 25, ftp: () => 1, oscila: 0.03 },
  altamar: { nombre: 'Alta mar', texto: 'Difícil: los rivales reman un poco más fuerte que tú', rango: 1, xp: 40, ftp: (c) => c.altamar, oscila: 0.02 },
};
export const xpPorFantasma = (dificultad) => (DIFICULTADES[dificultad] || DIFICULTADES.costa).xp;
// XP de un fantasma vencido según el margen sobre lo remado: hasta 2 % ×1,5; hasta 5 % ×1; hasta 10 % ×0,75; más, ×0,5.
export const MARGENES = [[0.02, 1.5], [0.05, 1], [0.1, 0.75], [Infinity, 0.5]];
export const factorMargen = (diferencia, distancia) => {
  const pct = distancia > 0 ? Math.abs(diferencia) / distancia : Infinity;
  return MARGENES.find(([tope]) => pct <= tope)[1];
};
// Las opciones antiguas de fantasma (niveles fijos y retos) pasan a ser rivales de otra clase.
export const RETO_ANTIGUO = { principiante: 'bahia', intermedio: 'costa', avanzado: 'altamar', inferior: 'bahia', igual: 'costa', superior: 'altamar' };
const otrasClases = (miClase) => CLASES.map((c) => c.clave).filter((k) => k !== claseDe(miClase)?.clave);
// La clase rival de la semana: la misma toda la semana, nunca la tuya.
export function rivalDeLaSemana(lunes, miClase) {
  const otras = otrasClases(miClase);
  return otras[Math.floor(azar(`r${lunes}`)() * otras.length)];
}
// Remo libre: tu ritmo de referencia es la mediana de tus remos libres de 10 min o más de las últimas 6 semanas,
// en vatios equivalentes a su distancia y su tiempo (W = 2,8 · v³). null si no hay ninguno: el rival rema entonces
// al 80 % de tu FTP, como antes. Validado con el entrenador (etapa 9).
export const RITMO_LIBRE_SEMANAS = 6;
export function ritmoLibre(sesiones, ahora = Date.now()) {
  const desde = ahora - RITMO_LIBRE_SEMANAS * 7 * 864e5;
  const w = sesiones
    .filter((s) => !s.entrenamiento && s.fecha >= desde && s.fecha < ahora && s.duracion >= 600 && s.distancia > 0)
    .map((s) => 2.8 * (s.distancia / s.duracion) ** 3)
    .sort((a, b) => a - b);
  if (!w.length) return null;
  const k = w.length >> 1;
  return Math.round(w.length % 2 ? w[k] : (w[k - 1] + w[k]) / 2);
}
// En Remo libre la dificultad mueve el ritmo del rival sobre tu ritmo de referencia.
export const LIBRE_DIFICULTAD = { bahia: 0.94, costa: 1, altamar: 1.04 };
const REL_LIBRE = 0.8; // fantasma.simular rema el Remo libre al 80 % de su FTP

// n rivales de clases distintas: el primero es siempre el de la semana. Su FTP sale del tuyo y la dificultad;
// en Remo libre con historial (ritmo = ritmoLibre), de tu ritmo real. Ya no llevan rango: su puesto de tripulación
// (que sale de su FTP) dice cómo reman.
export function rivalesPara(n, { miClase = null, nivel = 1, ftp = 150, peso = 0, factor = 1, dificultad = 'costa', lunes, semilla = '', ritmo = null } = {}) {
  const semana = rivalDeLaSemana(lunes, miClase);
  const r = azar(`n${lunes}${semilla}`);
  const resto = otrasClases(miClase).filter((k) => k !== semana).sort(() => r() - 0.5);
  const clases = [semana, ...resto];
  const dif = DIFICULTADES[dificultad] || DIFICULTADES.costa;
  const cl = clasificacionDe(ftp, peso, factor);
  // El rango solo elige el retrato (cómo se ve): el tuyo, uno menos en Bahía y uno más en Alta mar.
  const mio = RANGOS.indexOf(rangoDe(nivel));
  const rango = RANGOS[Math.max(0, Math.min(RANGOS.length - 1, mio + dif.rango))];
  const libre = ritmo > 0 ? (ritmo / REL_LIBRE) * (LIBRE_DIFICULTAD[dificultad] ?? 1) : null;
  return Array.from({ length: n }, (_, i) => {
    const clase = clases[i % clases.length];
    const nombres = NOMBRES_RIVAL[clase];
    const nombre = nombres[Math.floor(r() * nombres.length)];
    // Los rivales oscilan alrededor del nivel elegido: el de la semana justo en él, otro un poco por debajo y otro un poco por encima.
    const osc = [0, -1, 1][i % 3] * dif.oscila;
    const ftpRival = Math.round(libre ? libre * (1 + osc) : ftp * (dif.ftp(cl) + osc));
    return {
      dificultad, clase, rango: rango.id, ftp: ftpRival, clasificacion: clasificacionDe(ftpRival, peso, factor).nombre, perfil: cl.perfil,
      nombre: `${nombre} (${claseDe(clase).nombre})`,
    };
  });
}

// ---------- Talentos: por clase, en talentos.js ----------
export { talentosDe, gradosEn, motivoBloqueo, puntosDeNivel, puntosGastados, grado, cualidadDe, lemaTalentos, tieneArbolAntiguo, valorDe, MONEDAS_POR_PUNTO } from './talentos.js';

// ---------- Misiones ----------
// La distancia es la fuente principal de XP; las misiones dan variedad con recompensas moderadas:
// diarias 15–60 XP (la mitad de la propuesta inicial, para que la distancia pese más), semanales 150–250 XP. Ninguna exige intensidad alta.
const km = (m) => (m / 1000).toLocaleString('es-MX');
const miles = (n) => n.toLocaleString('es-MX');
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

// Misiones por capacidad (desde CAPACIDADES_DESDE). Las de intensidad (umbral y VO₂) solo salen martes y jueves
// y nunca después de un día duro: como mucho 2 por semana, para que las misiones no empujen a sobreentrenar.
const DIARIA_PLAN = { id: 'plan', nombre: 'Fiel al plan', texto: () => 'Completa la sesión de tu plan', metas: [1], xp: [40], valor: (d) => d.delPlan };
const DIARIAS_CAPACIDAD = [
  { id: 'zona2', nombre: 'Motor en marcha', texto: (m) => `Rema ${m} min suaves en zona 2 o 3`, metas: [20, 25], xp: [40, 45], valor: (d) => d.z2min },
  { id: 'kcal', nombre: 'Horno encendido', texto: (m) => `Quema ${m} kcal en una sesión`, metas: [250, 300, 400], xp: [30, 40, 50], valor: (d) => d.maxKcal },
];
const DIARIAS_INTENSIDAD = [
  { id: 'umbral', nombre: 'Al filo del umbral', texto: (m) => `Acumula ${m} min por encima del 91 % de tu FTP`, metas: [8, 10], xp: [45, 50], valor: (d) => d.z4min },
  { id: 'vo2', nombre: 'Pulmones de acero', texto: (m) => `Acumula ${m} min por encima del 106 % de tu FTP`, metas: [4, 6], xp: [45, 55], valor: (d) => d.vo2Seg / 60 },
];
const DIARIA_PULSO = { id: 'corazon', nombre: 'Corazón ágil', texto: (m) => `Que tu pulso baje ${m} lpm en el minuto tras terminar`, metas: [20], xp: [35], valor: (d) => d.mejorRec };
const SEMANAL_KCAL = { id: 'kcalsem', nombre: 'Horno de la semana', texto: (m) => `Quema ${m.toLocaleString('es-MX')} kcal esta semana`, metas: [1500], xp: [200], valor: (d) => d.kcal };

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
    conPlan: prev.some((s) => s.delPrograma),
    conPulso: prev.some((s) => s.fcProm > 0),
    kcal: med(prev.map((s) => s.kcal || 0)),
    kcalSemana: prev.reduce((a, s) => a + (s.kcal || 0), 0) / semanas,
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
  kcalsem: (r) => entre(Math.floor((r.kcalSemana * 0.95) / 100) * 100, 300, 6000),
};
const xpRuta = (km) => (km >= 20 ? 250 : km >= 12 ? 200 : 150);
function semanalATuMedida(d, rit) {
  const f = rit && META_SEMANAL[d.id];
  if (!f) return d;
  const meta = f(rit);
  return { ...d, metas: [meta], xp: [d.id === 'ruta' ? xpRuta(meta) : d.xp[0]] };
}
// Qué preparar al tocar «Hacer ahora» en una misión: un entrenamiento base o Remo libre contra fantasmas ('').
const PREPARAR_MISION = { rango: 'base:pot-mant', ritmo: 'base:rit-mant', bushido: 'base:rit-mant', parejo: 'base:rit-mant', semparejo: 'base:rit-mant', suave: 'base:dis-suave' };
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
// cargaAyer: carga de ayer (para no pedir intensidad tras un día duro).
// ---------- Misiones de la etapa 12: pocas y con peso ----------
// 3 diarias de ⅓ a ½ sesión de XP cada una (se pagan a la mitad, como todo desde el 29 de octubre): una de tu plan,
// una de técnica o ritmo y una de juego. Al ser de grupos distintos, nunca salen dos casi iguales el mismo día.
// Las monedas de las misiones bajan a 1 por cada 40 XP (la colección de paisajes y botes es a largo plazo).
const monedasMision12 = (xp) => Math.max(5, Math.round(xp / 40 / 5) * 5);
const crear12 = (d, r, semilla) => ({ ...crear(d, r, semilla), monedas: monedasMision12(d.xp[0]) });
export const XP_MISION_DIARIA = { plan: 220, tecnica: 200, juego: 180 };
const D12 = {
  plan: (nombre) => ({ id: 'plan', nombre: 'Fiel al plan', texto: () => `Cumple «${nombre}», la sesión de tu plan de hoy`, metas: [1], xp: [XP_MISION_DIARIA.plan], valor: (d) => d.delPlan }),
  descanso: { id: 'suave', nombre: 'Remo de recuperación', texto: () => 'Hoy toca descanso: si remas, que sea suave (15 min o más por debajo del 65 % de tu FTP)', metas: [1], xp: [XP_MISION_DIARIA.plan], valor: (d) => d.suaves },
  delDia: { id: 'deldia', nombre: 'La sesión del día', texto: () => 'Completa la sesión que te sugiere Entrenar', metas: [1], xp: [XP_MISION_DIARIA.plan], valor: (d) => d.delDia },
  tecnica: { id: 'parejo', nombre: 'Remo parejo', texto: (m) => `Rema ${m} min con la potencia pareja y la cadencia estable`, metas: [10, 15, 20], xp: [XP_MISION_DIARIA.tecnica, XP_MISION_DIARIA.tecnica, XP_MISION_DIARIA.tecnica], valor: (d) => d.tecMin },
  ritmo: { id: 'ritmo', nombre: 'Ritmo de crucero', texto: () => 'Completa 10 min o más con ritmo estable', metas: [1], xp: [XP_MISION_DIARIA.tecnica], valor: (d) => d.estables },
  rango: { id: 'rango', nombre: 'En tu rango', texto: (m) => `Mantén el ${m} % de un entrenamiento en tu rango de vatios`, metas: [80], xp: [XP_MISION_DIARIA.tecnica], valor: (d) => d.mejorPct },
  fantasma: { id: 'fantasma', nombre: 'Caza de fantasmas', texto: () => 'Gánale a un fantasma', metas: [1], xp: [XP_MISION_DIARIA.juego], valor: (d) => d.ganados },
  renida: { id: 'renida', nombre: 'Por un pelo', texto: () => 'Gánale a un fantasma por menos del 5 % de lo remado', metas: [1], xp: [XP_MISION_DIARIA.juego], valor: (d) => d.renidas },
  altamar: { id: 'altamar', nombre: 'Mar adentro', texto: () => 'Gana una carrera en Alta mar', metas: [1], xp: [XP_MISION_DIARIA.juego], valor: (d) => d.altamar },
};
// planHoy: el entrenamiento del plan para hoy, '' si hoy es descanso del plan y null sin plan.
function misionesDelDia12(dia, rit, planHoy) {
  const semilla = `d${dia}`;
  const r = azar(semilla);
  const plan = planHoy ? D12.plan(planHoy) : planHoy === '' ? D12.descanso : D12.delDia;
  const tecnica = [D12.tecnica, D12.ritmo, ...(rit?.conRango ? [D12.rango] : [])];
  const juego = [D12.fantasma, D12.renida, ...(rit ? [D12.altamar] : [])];
  return [crear12(plan, r, semilla), ...[tecnica, juego].map((pool) => crear12(pool[Math.floor(r() * pool.length)], r, semilla))];
}

export function misionesDelDia(dia, rit = null, { cargaAyer = 0, planHoy = null } = {}) {
  if (dia >= ETAPA12_DESDE) return misionesDelDia12(dia, rit, planHoy);
  const semilla = `d${dia}`;
  const r = azar(semilla);
  if (!rit) return [crear(DIARIA_DIST, r, semilla), crear(DIARIA_DUR, r, semilla), ...elegir(DIARIAS, 3, semilla, r)];
  let pool = DIARIAS
    .filter((d) => d.id !== 'rango' || rit.conRango)
    .map((d) => (d.id === 'distdia' ? aTuMedida(d, rit.metros * 1.3, 500) : d.id === 'constante' ? aTuMedida(d, rit.min * 1.3, 5) : d));
  const fijas = [crear(aTuMedida(DIARIA_DIST, rit.metros * 1.15, 500), r, semilla), crear(aTuMedida(DIARIA_DUR, rit.min * 1.15, 5), r, semilla)];
  if (dia < CAPACIDADES_DESDE) return [...fijas, ...elegir(pool, 3, semilla, r)];
  // Desde las misiones por capacidad: con plan activo, la sesión del plan es siempre una de las misiones.
  const diaSemana = (new Date(`${dia}T12:00`).getDay() + 6) % 7;
  const intensidad = (diaSemana === 1 || diaSemana === 3) && cargaAyer < 60;
  pool = [...pool, ...DIARIAS_CAPACIDAD.map((d) => (d.id === 'kcal' ? aTuMedida(d, rit.kcal * 1.2, 50) : d)), ...(intensidad ? DIARIAS_INTENSIDAD : []), ...(rit.conPulso ? [DIARIA_PULSO] : [])];
  const plan = rit.conPlan ? [crear(DIARIA_PLAN, r, semilla)] : [];
  return [...fijas, ...plan, ...elegir(pool, 3 - plan.length, semilla, r)];
}
// Meta semanal de atributo (desde la semana del 26 de octubre de 2026): sube tu atributo más bajo.
// Las metas equivalen más o menos a una sesión pensada para ese atributo.
export const ATRIBUTO_SEMANAL_DESDE = '2026-10-26';
export const META_ATRIBUTO = { fuerza: 15, agilidad: 12, resistencia: 20, recuperacion: 6, tecnica: 15, voluntad: 8, gasto: 10 };
export const PREPARAR_ATRIBUTO = { fuerza: 'base:pot-mant', agilidad: 'base:pot-mejora', resistencia: 'base:dis-mant', recuperacion: 'base:dis-suave', tecnica: 'base:rit-mant', voluntad: 'base:pal-mejora', gasto: 'base:cal-mant' };
// El atributo más bajo con el que trabajar la semana; sin banda de pulso no se elige Recuperación.
// Gasto entra en la elección desde CAPACIDADES_DESDE (lunes = la semana que se elige).
export function atributoDeLaSemana(atributos, { sinPulso = true, lunes = null } = {}) {
  const conGasto = lunes != null && lunes >= CAPACIDADES_DESDE;
  const lista = ATRIBUTOS.filter((a) => !(sinPulso && a.clave === 'recuperacion') && (conGasto || a.clave !== 'gasto'));
  if (!lista.some((a) => (atributos[a.clave] || 0) > 0)) return null;
  return lista.reduce((m, a) => ((atributos[a.clave] || 0) < (atributos[m.clave] || 0) ? a : m)).clave;
}
function misionAtributo(clave) {
  const a = ATRIBUTOS.find((x) => x.clave === clave);
  // Dice qué entrenar: sin eso la meta empujaba a meter sprints o zona 4 en cualquier sesión.
  const como = { recuperacion: 'con fondos muy suaves o un descanso tras un día duro', gasto: 'con fondos largos en zona 2' }[clave]
    || `con «${RECOMENDACION_ATRIBUTO[clave]?.entrenamiento}»`;
  return { id: 'atributo', atributo: clave, nombre: 'Héroe equilibrado', texto: (m) => `Sube ${m} puntos de ${a.nombre} esta semana ${como}`, metas: [META_ATRIBUTO[clave]], xp: [150], valor: (d) => Math.floor(d.atr?.[clave] || 0) };
}
// Semanales de la etapa 12: la misma línea que las diarias, cada una de una sesión de XP (400 nominales): tu plan,
// técnica, el rival de la semana y la misión de tu clase.
export const XP_MISION_SEMANAL = 400;
function misionesDeSemana12(lunes, clase, rit, reto) {
  const semilla = `s${lunes}`;
  const r = azar(semilla);
  const ses = entre(Math.round(rit?.sesSemana || 2), 2, 5);
  const plan = rit?.conPlan
    ? { id: 'semplan', nombre: 'Semana fiel', texto: (m) => `Cumple ${m} sesiones de tu plan esta semana`, metas: [ses], valor: (d) => d.delPlan }
    : { id: 'disciplina', nombre: 'Disciplina de hierro', texto: (m) => `Entrena ${m} días distintos esta semana`, metas: [entre(ses + 1, 2, 5)], valor: (d) => d.dias.size };
  const minTec = entre(Math.round((ses * 10) / 5) * 5, 15, 60);
  const tecnica = { id: 'semparejo', nombre: 'Semana pareja', texto: (m) => `Suma ${m} min de remo parejo esta semana`, metas: [minTec], valor: (d) => d.tecMin };
  const tema = MISION_CLASE[claseDe(clase)?.clave];
  const lista = [plan, tecnica, reto, ...(tema ? [semanalATuMedida(tema, rit)] : [])];
  return lista.map((d) => crear12({ ...d, xp: [XP_MISION_SEMANAL] }, r, semilla));
}

export function misionesDeSemana(lunes, clase = null, rit = null, atributo = null) {
  const semilla = `s${lunes}`;
  const r = azar(semilla);
  const tema = MISION_CLASE[claseDe(clase)?.clave];
  const rival = rivalDeLaSemana(lunes, clase);
  const reto = { id: 'rival', nombre: 'Rival de la semana', texto: () => `Gánale una carrera a un rival ${claseDe(rival).nombre.toLowerCase()}`, metas: [1], xp: [150], valor: (d) => d.vencidas.filter((k) => k === rival).length };
  if (lunes >= ETAPA12_DESDE) return misionesDeSemana12(lunes, clase, rit, reto);
  // Con historial no se repiten dos misiones de una sesión larga (Fondo y la Travesía del océano).
  let pool = rit && tema?.id === 'oceano' ? SEMANALES.filter((d) => d.id !== 'fondo') : SEMANALES;
  if (rit && lunes >= CAPACIDADES_DESDE && rit.kcalSemana >= 300) pool = [...pool, SEMANAL_KCAL];
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

// Capítulos de la historia: uno por rango (9 para los 90 niveles). Cada capítulo se abre cumpliendo sus requisitos
// (desde que empieza) o al llegar a su nivel, y se termina venciendo a su jefe. Desde las reglas de la etapa 9 el jefe
// se vence de tres formas: su prueba, la sesión clave del plan cumplida o una carrera ganada en Alta mar; y una prueba
// hecha antes de cumplir los requisitos se guarda hasta que el capítulo se abre. Las sesiones anteriores siguen las
// reglas de antes (solo la prueba, en la misma sesión que completa los requisitos), así nadie pierde un capítulo.
// xp: la nominal (se paga a la mitad desde el 29 de octubre, como todo); xpAntes: la de un jefe vencido con las reglas viejas.
// El requisito de racha de «Mar abierto»: días seguidos cumpliendo el plan (también los descansos respetados).
export const REQ_MAR_ABIERTO = ['racha', 4];
export const CAPITULOS = [
  { nombre: 'El despertar', historia: 'Tu bote despierta en un muelle olvidado. Para zarpar, demuestra que puedes remar.', nivel: 10,
    req: [['sesiones', 2], ['km', 3]], jefe: { nombre: 'El Guardián del muelle', tipo: 'p500', texto: 'Completa la «Prueba 500 m»' }, monedas: 100, objeto: 'casco-cuernos-oro', xp: 1200, xpAntes: 150 },
  { nombre: 'Río arriba', historia: 'La corriente empuja en contra. Solo la constancia te lleva al nacimiento del río.', nivel: 20,
    req: [['sesiones', 5], ['km', 15], ['z2min', 30]], jefe: { nombre: 'La Serpiente del río', tipo: 'p2000', texto: 'Completa una prueba de 2000 m' }, monedas: 150, objeto: 'sombrero-capitan', xp: 1300, xpAntes: 200 },
  { nombre: 'La tormenta', historia: 'El cielo se rompe. Rayos, olas y fantasmas en la niebla.', nivel: 30,
    req: [['z4min', 30], ['fantasmas', 3]], jefe: { nombre: 'El Kraken', tipo: 'pftp', texto: 'Completa la «Prueba FTP 20 min»' }, monedas: 200, objeto: 'kabuto', xp: 1400, xpAntes: 250 },
  { nombre: 'Mar abierto', historia: 'Nada a la vista más que agua. Tu constancia es tu brújula.', nivel: 40,
    req: [['km', 50], REQ_MAR_ABIERTO], jefe: { nombre: 'El Dragón de los 500', tipo: 'mejor500', texto: 'Supera tu mejor 500 m' }, monedas: 250, objeto: 'corona-hielo', xp: 1500, xpAntes: 300 },
  { nombre: 'El estrecho de niebla', historia: 'Entre dos acantilados, la niebla esconde a quien no quiere ser encontrado.', nivel: 50,
    req: [['km', 80], ['sesiones', 10]], jefe: { nombre: 'La Bruja de la niebla', tipo: 'mejor2000', texto: 'Supera tu mejor 2000 m' }, monedas: 300, objeto: 'armadura-gladiador', xp: 1600, xpAntes: 400 },
  { nombre: 'Las islas de fuego', historia: 'Volcanes que escupen lava al mar. El agua hierve alrededor de tu bote.', nivel: 60,
    req: [['km', 100], ['z4min', 60]], jefe: { nombre: 'El Titán de lava', tipo: 'pftp', texto: 'Completa la «Prueba FTP 20 min»' }, monedas: 350, objeto: 'yelmo-lava', xp: 1700 },
  { nombre: 'El mar helado', historia: 'El hielo cruje bajo el casco. Solo avanza quien no deja de remar.', nivel: 70,
    req: [['km', 120], ['sesiones', 15]], jefe: { nombre: 'El Leviatán de hielo', tipo: 'mejor500', texto: 'Supera tu mejor 500 m' }, monedas: 400, objeto: 'manto-escarcha', xp: 1800 },
  { nombre: 'El abismo', historia: 'Bajo tu quilla, un agua tan negra que no tiene fondo. Algo se mueve allí abajo.', nivel: 80,
    req: [['km', 150], ['fantasmas', 10]], jefe: { nombre: 'La Hidra del abismo', tipo: 'mejor2000', texto: 'Supera tu mejor 2000 m' }, monedas: 450, objeto: 'ancla-abismo', xp: 1900 },
  { nombre: 'La leyenda', historia: 'Los bardos ya cantan tu nombre. Falta el último duelo.', nivel: 88,
    req: [['km', 200], ['sesiones', 20]], jefe: { nombre: 'El Rey de los mares', tipo: 'pftp', texto: 'Completa la «Prueba FTP 20 min»' }, monedas: 500, objeto: 'corona-mares', xp: 2000 },
];
// Las otras dos formas de vencer a un jefe (reglas de la etapa 9).
export const OTRAS_FORMAS_JEFE = 'o cumple la sesión clave de tu plan (umbral, VO₂, sprint o prueba), o gana una carrera en Alta mar';
const TIPOS_CLAVE = new Set(['umbral', 'vo2', 'sprint', 'prueba']);
// Sesión clave del plan: la del día, de un tipo duro, cumplida (no solo terminada).
export const esSesionClave = (s) => !!s.delPrograma && TIPOS_CLAVE.has(s.tipoPlan) && XC.cumplimientoPlan(s) === 'cumplida';
export const ganaAltaMar = (s) => !s.carreraSinTerminar && (s.rivales || (s.rival ? [s.rival] : [])).some((r) => r.dificultad === 'altamar' && r.diferencia > 0);
// Entrenamiento que prepara el botón «Enfrentar» de cada jefe.
export const PRUEBA_JEFE = { p500: 'base:prueba-500', p2000: 'base:prueba-2000', pftp: 'base:prueba-ftp', mejor500: 'base:prueba-500', mejor2000: 'base:prueba-2000' };
export const REQ_TEXTO = { sesiones: 'Sesiones', km: 'Kilómetros', z2min: 'Minutos en zona 2', z4min: 'Minutos en zona 4+', fantasmas: 'Fantasmas vencidos', racha: 'Días seguidos cumpliendo el plan' };

// «Vence a las 4 clases» desde v0.44.1: cuántas clases distintas puedes contar si cada carrera aporta una sola
// (emparejamiento máximo entre carreras ganadas y clases vencidas en ellas). carreras = [[clase, …], …].
export const CLASES4_DESDE = '2026-11-04';
export function clasesEnCarrerasDistintas(carreras) {
  const dueno = new Map(); // clase → índice de la carrera que la cuenta
  const asignar = (i, vistas) => {
    for (const c of new Set(carreras[i])) {
      if (vistas.has(c)) continue;
      vistas.add(c);
      if (!dueno.has(c) || asignar(dueno.get(c), vistas)) { dueno.set(c, i); return true; }
    }
    return false;
  };
  carreras.forEach((_, i) => asignar(i, new Set()));
  return dueno.size;
}

// Logros permanentes: una sola vez. Los hitos excepcionales dan entre 300 y 600 XP.
export const COLECCION_DESDE = '2026-11-04';
// Monedas de las ventajas de la tienda (desde la revisión de la etapa 15): Estandarte y Botín del corsario.
export function monedasDeVentaja(s, m) {
  if (claveDia(s.fecha) < COLECCION_DESDE || !m.ganados) return 0;
  if (s.ventajaUsada === 'estandarte') return MONEDAS_ESTANDARTE;
  if (s.ventajaUsada === 'botin') return MONEDAS_BOTIN * m.ganados;
  return 0;
}
// «Atento al entrenador» (voz, etapa 2): respondiste a 3 o más correcciones de la voz volviendo al rango en menos
// de 20 s. Una vez por sesión y nunca en pruebas. 40 nominal: con la XP a la mitad se ve +20.
export const ATENTO_DESDE = '2026-11-05';
export const ATENTO_MIN = 3;
export const XP_ATENTO = 40;
export const esAtento = (s) => claveDia(s.fecha) >= ATENTO_DESDE && (s.atento || 0) >= ATENTO_MIN
  && s.tipoPlan !== 'prueba' && !/^Prueba/.test(s.entrenamiento || '');
// Minutos técnicos de las sesiones de antes de la etapa 12 (para la hazaña samurái), calculados una vez por sesión.
const cacheTecnica = new Map();
function minutosTecnicos(s, ftp) {
  if (!s.muestras?.length) return 0;
  const k = `${s.fecha}|${s.muestras.length}|${ftp}`;
  if (!cacheTecnica.has(k)) {
    if (cacheTecnica.size > 2000) cacheTecnica.clear();
    cacheTecnica.set(k, tecnicaDeSesion(s, ftp).minutos);
  }
  return cacheTecnica.get(k);
}
export const HAZANAS_CLASE = [
  ['vikingo', 'Saga de las cien mil', 'paladas', 75000, (g) => g.paladas],
  ['pirata', 'Terror de los siete mares', 'fantasmas vencidos', 60, (g) => g.fantasmas],
  ['samurai', 'El camino de la forma', 'minutos técnicos', 400, (g) => g.tecMin],
  ['polinesio', 'Navegante del océano', 'km', 750, (g) => g.kmTotal],
  ['romano', 'Pax romana', 'semanas del plan cumplidas', 10, (g) => g.semanasPlan],
].map(([clase, nombre, unidad, meta, valor]) => ({
  id: hazanaDeClase(clase), clase, nombre, unidad, meta, valor, xp: 1000, monedas: 300, desde: COLECCION_DESDE,
  texto: `${miles(meta)} ${unidad} en total: vela legendaria y mascarón dorado de ${clase === 'samurai' ? 'samurái' : clase}`,
}));
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
  // Retirado en la etapa 9 (repetía el nombre del rango): solo lo gana una sesión con las reglas de antes, y quien lo tiene lo conserva.
  { id: 'nivel10', nombre: 'Nivel 10', texto: 'Llega al nivel 10', meta: 10, valor: (g) => g.nivelAntiguo, xp: 250, monedas: 100, oculto: true },
  // Desde v0.44.1 cada clase cuenta solo en una carrera distinta (antes una carrera de 3 rivales daba 3 clases); quien ya lo tenía lo conserva.
  { id: 'clases4', nombre: 'Vence a las 4 clases', texto: 'Gana 4 carreras distintas, cada una contra un rival de otra clase', meta: 4, valor: (g) => Math.max(clasesEnCarrerasDistintas(g.carrerasGanadas), g.clasesAntiguas.size), xp: 300, monedas: 100 },
  { id: 'km100', nombre: 'Cien kilómetros', texto: '100 km en total', meta: 100, valor: (g) => g.kmTotal, xp: 600, monedas: 300, objeto: 'bote-dorado' },
  { id: 'nivel25', nombre: 'Héroe de nivel 25', texto: 'Llega al nivel 25', meta: 25, valor: (g) => g.nivel, monedas: 300, objeto: 'aura-dorada' },
  // Metas largas (etapa 9): escalones para meses y años de remo. XP nominal (desde el 29 de octubre se paga la mitad).
  ...[[250, 'Doscientos cincuenta kilómetros', 600, 150], [500, 'Quinientos kilómetros', 800, 200], [1000, 'Mil kilómetros', 1200, 300], [2500, 'La vuelta al Mediterráneo', 2000, 500]]
    .map(([meta, nombre, xp, monedas]) => ({ id: `km${meta}`, nombre, texto: `${miles(meta)} km en total`, meta, valor: (g) => g.kmTotal, xp, monedas })),
  ...[[50, 'Cincuenta entrenamientos', 600, 150], [100, 'Cien entrenamientos', 900, 250], [250, 'Doscientos cincuenta entrenamientos', 1500, 400], [500, 'Quinientos entrenamientos', 2500, 600]]
    .map(([meta, nombre, xp, monedas]) => ({ id: `ses${meta}`, nombre, texto: `Completa ${meta} sesiones`, meta, valor: (g) => g.sesiones, xp, monedas })),
  ...[[40, 600, 200], [60, 900, 300], [80, 1500, 500]]
    .map(([meta, xp, monedas]) => ({ id: `nivel${meta}`, nombre: `Héroe de nivel ${meta}`, texto: `Llega al nivel ${meta}`, meta, valor: (g) => g.nivel, xp, monedas })),
  ...[[10, 'Diez semanas al remo', 500, 150], [20, 'Veinte semanas al remo', 900, 300]]
    .map(([meta, nombre, xp, monedas]) => ({ id: `semanas${meta}`, nombre, texto: `Rema al menos una vez por semana ${meta} semanas seguidas`, meta, valor: (g) => g.semanasMax, xp, monedas })),
  // Hazañas de clase (etapa 15): dan la vela legendaria y el mascarón dorado de esa clase. Cuenta todo tu historial,
  // pero se cobran desde COLECCION_DESDE (quien ya las cumplía las cobra en su siguiente sesión).
  ...HAZANAS_CLASE,
  ...[[10, 'Más fuerte', 400, 100], [25, 'Mucho más fuerte', 800, 200], [50, 'Otro remero', 1200, 300]]
    .map(([meta, nombre, xp, monedas]) => ({ id: `ftp${meta}`, nombre, texto: `Sube tu FTP ${meta} W desde tu primera sesión con FTP`, meta, valor: (g) => g.ftpMejora, xp, monedas })),
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
  let vo2 = 0;
  for (const x of s.muestras || []) {
    const p = x.w / f;
    if (p >= 0.56 && p <= 0.9) z2++;
    if (p >= 0.91) z4++;
    if (p >= 1.0) sobre++;
    if (p >= 1.06) vo2++;
    if (x.spm >= 24) spm24++;
  }
  // Una carrera abandonada antes de la meta no suma fantasmas vencidos.
  const rivales = s.carreraSinTerminar ? [] : s.rivales || (s.rival ? [s.rival] : []);
  // Minutos activos: con muestras (1 por segundo) se excluyen las pausas; sin ellas, la duración registrada.
  const activos = s.muestras?.length ? s.muestras.filter((x) => x.w > 0 || x.spm > 0).length / 60 : (s.duracion || 0) / 60;
  return {
    f, min: activos, metros: s.distancia || 0, kcal: s.kcal || 0, estable: ritmoEstable(s.muestras),
    automatica: !!s.muestras?.length,
    z2min: z2 / 60, z4min: z4 / 60, sobreSeg: sobre, spm24min: spm24 / 60, vo2Seg: vo2,
    delPlan: s.delPrograma && s.tiempoMeta != null ? 1 : 0, fcRec60: s.fcRec60 ?? 0,
    pct: s.pctEnRango, ganados: rivales.filter((r) => r.diferencia > 0).length,
    clasesVencidas: rivales.filter((r) => r.diferencia > 0 && r.clase).map((r) => r.clase),
    margenMin: Math.min(Infinity, ...rivales.filter((r) => r.diferencia > 0).map((r) => r.diferencia)),
    t500: s.muestras?.length ? mejorTiempo(s.muestras, 500) : null,
    t2000: s.muestras?.length ? mejorTiempo(s.muestras, 2000) : null,
    // Etapa 12: la Técnica nueva y lo que miran sus misiones.
    tec: esEtapa12(s.fecha) ? tecnicaDeSesion(s, f) : null,
    delDia: XC.esDelDia(s) && s.tiempoMeta != null ? 1 : 0,
    suave: activos >= 15 && (s.intensidad ?? factorIntensidad(s.muestras, f) ?? (s.wattsProm || 0) / f) < 0.65 ? 1 : 0,
    renidas: rivales.filter((r) => r.diferencia > 0 && factorMargen(r.diferencia, s.distancia) >= 1).length,
    altamar: rivales.some((r) => r.diferencia > 0 && r.dificultad === 'altamar') ? 1 : 0,
  };
}

// Sesión sin pausas: 10 min o más sin quedarse 5 s quieto ni saltos de tiempo entre la primera y la última palada.
// Desde v0.42.1 las pausas se guardan aparte (y al pulsar Seguir ya no quedan segundos quietos en las muestras):
// una pausa de 5 s o más también la descarta.
export function sinPausas(s) {
  if (s.pausas?.some((p) => p.fin - p.ini >= 5000)) return false;
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
    antes: !esEtapa12(s.fecha), kmSemana: ctx.kmSemana ?? m.metros / 1000, metaSemanaKm: ctx.metaSemanaKm || 0,
  };
}

// Ganancia de una sesión: XP con detalle y puntos por atributo (antes del bono de clase).
function gananciaSesion(s, m, ctx) {
  const gr = ctx.grados || {};
  const at = { fuerza: 0, agilidad: 0, resistencia: 0, recuperacion: 0, tecnica: 0, voluntad: 0, gasto: 0 };
  at.gasto += (s.kcal || 0) / 50;
  at.fuerza += m.z4min * 1.2;
  at.agilidad += (s.muestras || []).filter((x) => x.w / m.f >= 1.06).length / 20;
  at.resistencia += m.z2min * 0.5 + (s.duracion >= 1200 ? 4 : 0);
  if (s.distancia >= 400 && s.distancia <= 600 && s.duracion <= 150) at.agilidad += 5;
  const suave = s.wattsProm && s.wattsProm / m.f < 0.75;
  if (suave && ctx.cargaAyer >= 60) at.recuperacion += 5;
  else if (suave) at.recuperacion += 2;
  if (ctx.descansoATiempo) at.recuperacion += 4;
  at.recuperacion += recuperacionesFc(s) * 3;
  if (m.tec) at.tecnica += m.tec.puntos;
  else {
    if (s.pctEnRango != null) at.tecnica += (m.min * s.pctEnRango) / 100 * 0.6;
    if (s.paladas && ctx.mppPromedio && s.distancia / s.paladas > ctx.mppPromedio * 1.02) at.tecnica += 3;
  }
  const completo = s.tiempoMeta != null;
  const nueva = XC.usaCarga(s);
  if (completo) at.voluntad += 3;
  // Con las reglas de carga ya no suma marcar un esfuerzo de 8 o más (empujaba a apretar en días suaves);
  // en su lugar, cada semana del plan cumplida da +5.
  if (!nueva && s.rpe >= 8) at.voluntad += 3;
  if (nueva) at.voluntad += 5 * (ctx.creditos?.semanas || 0);
  at.voluntad += Math.min(ctx.racha, 7) * 0.5;

  const carga = s.estres ?? estres(s, m.f) ?? Math.round(m.min * 0.8);
  if (nueva) return gananciaCarga(s, m, ctx, at, carga);
  // XP base: 1 por cada 10 m remados.
  const base = Math.floor(m.metros / XP_POR_METROS);
  const detalle = [['Distancia', base]];
  // Bonos ordinarios entre 25 y 150 XP, sin multiplicadores de toda la sesión.
  if (completo) detalle.push(['Entrenamiento completo', 50]);
  if (ctx.records) detalle.push(['Récord personal', 100]);
  // Las pruebas del plan son los jefes de cada capacidad: completarla da XP, y batir tu marca, más.
  if (claveDia(s.fecha) >= CAPACIDADES_DESDE && s.delPrograma && completo && /^Prueba/.test(s.entrenamiento || '')) {
    detalle.push(ctx.records ? ['Jefe de capacidad vencido', 75] : ['Prueba del plan', 40]);
  }
  // Cada fantasma vencido vale según su dificultad: Bahía 15, Costa 25 (y los demás fantasmas), Alta mar 40. Máximo 3.
  if (m.ganados) {
    const vencidos = (s.carreraSinTerminar ? [] : s.rivales || (s.rival ? [s.rival] : [])).filter((r) => r.diferencia > 0).slice(0, 3);
    detalle.push([m.ganados === 1 ? 'Fantasma vencido' : `${m.ganados} fantasmas vencidos`, vencidos.reduce((a, r) => a + xpPorFantasma(r.dificultad), 0)]);
  }
  if (ctx.racha > 1) detalle.push([`Racha de ${ctx.racha} días`, 5 * Math.min(ctx.racha, 7)]);
  if (s.ventajaUsada === 'estandarte' && m.ganados) detalle.push(['Estandarte', XP_ESTANDARTE_ANTES]);
  // Talentos de la clase (solo los grados aprendidos antes de esta sesión): números fijos con tope por sesión.
  if (ctx.clase) {
    const rivales = s.carreraSinTerminar ? 0 : (s.rivales || (s.rival ? [s.rival] : [])).length;
    detalle.push(...xpTalentos(ctx.clase, gr, datosTalento(s, m, ctx)));
  }
  const f = factorXp(s.fecha);
  const detalleXp = f === 1 ? detalle : detalle.map(([k, v]) => [k, Math.round(v * f)]);
  return { xp: detalleXp.reduce((a, [, v]) => a + v, 0), xpBase: detalle.reduce((a, [, v]) => a + v, 0), detalle: detalleXp, atributos: at, carga, datosTal: datosTalento(s, m, ctx) };
}

// Lo que no cambia con las reglas de carga: fantasmas, racha, Estandarte y talentos (con el factor de XP lenta).
function bonosDeJuego(s, m, ctx) {
  const detalle = [];
  if (m.ganados) {
    const vencidos = (s.carreraSinTerminar ? [] : s.rivales || (s.rival ? [s.rival] : [])).filter((r) => r.diferencia > 0).slice(0, 3);
    // Desde las reglas de la etapa 9, cuanto más reñida la victoria, más XP: una paliza paga la mitad.
    const valor = (r) => xpPorFantasma(r.dificultad) * (XC.usaReglas9(s) ? factorMargen(r.diferencia, s.distancia) : 1);
    detalle.push([m.ganados === 1 ? 'Fantasma vencido' : `${m.ganados} fantasmas vencidos`, Math.round(vencidos.reduce((a, r) => a + valor(r), 0))]);
  }
  if (ctx.racha > 1) detalle.push([`Racha de ${ctx.racha} días`, 5 * Math.min(ctx.racha, 7)]);
  const tiendaNueva = claveDia(s.fecha) >= COLECCION_DESDE;
  if (s.ventajaUsada === 'estandarte' && m.ganados) detalle.push(['Estandarte', tiendaNueva ? XP_ESTANDARTE : XP_ESTANDARTE_ANTES]);
  if (tiendaNueva && s.ventajaUsada === 'bitacora' && sinPausas(s) && !s.carreraSinTerminar) detalle.push(['Bitácora del capitán', XP_BITACORA]);
  if (esAtento(s)) detalle.push(['Atento al entrenador', XP_ATENTO]);
  if (ctx.clase) detalle.push(...xpTalentos(ctx.clase, ctx.grados || {}, datosTalento(s, m, ctx)));
  const f = factorXp(s.fecha);
  return detalle.map(([k, v]) => [k, Math.round(v * f)]);
}

export const XP_RECORD = 40;
export const XP_RECORD_TOPE = 120;
// Ganancia con las reglas de carga (acuerdo D1): XP base por carga con tope diario, gran recompensa por cumplir
// la sesión del día, descansos del plan respetados y semana cumplida. Sin «Entrenamiento completo» suelto ni
// récord de «Sesión más larga» (ctx.records ya no lo cuenta).
function gananciaCarga(s, m, ctx, at, carga) {
  const P = XC.XP_PLAN;
  const detalle = [['Carga del entrenamiento', XC.xpBaseCarga(ctx.cargaAntes || 0, carga)]];
  const delDia = XC.esDelDia(s) && !ctx.planPagado;
  const cumple = delDia ? XC.cumplimientoPlan(s) : null;
  if (cumple === 'cumplida') detalle.push([s.delDia === 'sugerida' ? 'Sesión del día cumplida' : 'Sesión del plan cumplida', P.cumplida]);
  else if (cumple === 'terminada') detalle.push(['Sesión del plan terminada', P.terminada]);
  else if (!XC.esDelDia(s) && !ctx.planPagado && XC.equivalePlan(s, ctx.tipo, carga)) detalle.push(['Equivale a la sesión del plan', P.equivalente]);
  if (cumple && /^Prueba/.test(s.entrenamiento || '')) detalle.push(ctx.records ? ['Prueba del plan con marca nueva', P.pruebaRecord] : ['Prueba del plan', P.prueba]);
  // Etapa 9: cada récord paga 40 XP, hasta 120 por sesión (antes 50 por muchos que fueran).
  if (ctx.records) {
    const nuevo = XC.usaReglas9(s);
    detalle.push([nuevo && ctx.records > 1 ? `${ctx.records} récords personales` : 'Récord personal', nuevo ? Math.min(XP_RECORD_TOPE, XP_RECORD * ctx.records) : 50]);
  }
  const cr = ctx.creditos || {};
  if (cr.descansos) detalle.push([cr.descansos === 1 ? 'Descanso del plan respetado' : `${cr.descansos} descansos del plan respetados`, P.descanso * cr.descansos]);
  if (cr.semanas) detalle.push([cr.semanas === 1 ? 'Semana del plan cumplida' : `${cr.semanas} semanas del plan cumplidas`, P.semana * cr.semanas]);
  const todo = [...detalle, ...bonosDeJuego(s, m, ctx)].filter(([, v]) => v > 0);
  const xp = todo.reduce((a, [, v]) => a + v, 0);
  // Monedas como antes: unas 1 por cada 25 XP que se ven.
  return { xp, xpBase: xp * 2, detalle: todo, atributos: at, carga, datosTal: datosTalento(s, m, ctx), pagaPlan: !!cumple };
}

// Calendario del plan que usa el juego (ver xp-carga.js). La app lo fija al arrancar y al cambiar de plan.
let calendarioPlan = null;
export const fijarCalendarioPlan = (cal) => { calendarioPlan = cal || null; };
// Meta semanal de km (Ajustes): la mira el Triunfo romano. La app la fija al arrancar y al cambiarla.
let metaSemanaJuego = 10;
export const fijarMetaSemana = (km) => { metaSemanaJuego = km > 0 ? km : 10; };

// ---------- Estado completo del juego ----------
// per = { clase, nombre, arbol: { clase: { slot: [fechas] } }, inventario: { id: n }, gastado, equipo }
export function estadoJuego(sesiones, { ftp = 0, per = {}, ahora = Date.now(), calendario = calendarioPlan, metaSemanaKm = metaSemanaJuego } = {}) {
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const cal = calendario || {};
  // Días del plan (descansos y semanas) que ya se cobraron, desde la primera sesión con reglas de carga.
  const primeraCarga = orden.find(XC.usaCarga);
  const desdeCarga = primeraCarga ? claveDia(primeraCarga.fecha) : null;
  const porDia = new Map(); // día → { carga, ifMax, hechas: [entrenamientos terminados] }
  for (const s of orden) {
    const k = claveDia(s.fecha);
    const d = porDia.get(k) || { carga: 0, ifMax: 0, hechas: [] };
    const f = s.ftp || ftp;
    d.carga += s.estres ?? estres(s, f) ?? Math.round(((s.duracion || 0) / 60) * 0.8);
    d.ifMax = Math.max(d.ifMax, s.intensidad ?? factorIntensidad(s.muestras, f) ?? (f && s.wattsProm ? s.wattsProm / f : 0));
    if (s.tiempoMeta != null && s.entrenamiento) d.hechas.push(s.entrenamiento);
    porDia.set(k, d);
  }
  const descansoRespetado = (k) => { const d = porDia.get(k); return !d || (d.carga <= XC.DESCANSO_CARGA_MAX && d.ifMax < XC.DESCANSO_IF_MAX); };
  // Racha del plan: días con la sesión del plan terminada (se va llenando sesión a sesión) y día anterior a tu primera sesión.
  const planHecho = new Set();
  const primerDia = orden.length ? claveDia(orden[0].fecha) : null;
  // Semana flexible: los días del plan son una sugerencia. En cada semana del calendario hay tantos descansos
  // como días sin sesión planeada; un día cuenta si remaste una sesión del plan (el día que sea) o si descansaste
  // y aún quedaban descansos en la semana. Un día de más sin remar queda pendiente: no suma ni corta mientras la
  // semana sigue abierta (aún puedes hacer esa sesión), y corta cuando la semana termina sin hacerla.
  // Remar fuerte otra cosa (sin ser sesión del plan) corta, como antes. Devuelve 'C' (cumplido), 'N' (pendiente) o 'X'.
  const estadoSemana = (lunes, refK) => {
    const out = new Map();
    const dias7 = Array.from({ length: 7 }, (_, i) => claveDia(diaMs(lunes) + i * 864e5)).filter((k) => k in cal);
    let descansos = dias7.filter((k) => !cal[k]).length;
    const cerrada = claveDia(diaMs(lunes) + 6 * 864e5) < refK;
    for (const k of dias7) {
      if (planHecho.has(k)) out.set(k, 'C');
      else if (!descansoRespetado(k)) out.set(k, 'X');
      else if (descansos > 0) { descansos--; out.set(k, 'C'); } else out.set(k, cerrada ? 'X' : 'N');
    }
    return out;
  };
  const estadoDiaRacha = (k, conDias, refK, cache) => {
    if (!(k in cal)) return conDias.has(k) ? 'C' : 'X';
    const lunes = lunesDe(diaMs(k));
    if (!cache.has(lunes)) cache.set(lunes, estadoSemana(lunes, refK));
    return cache.get(lunes).get(k);
  };
  // Racha hasta el día k: k suma si está cumplido; un día de plan aún sin hacer no la corta (el día no ha terminado),
  // pero remar fuerte en un descanso sí. refK: el día desde el que se mira (para saber qué semanas siguen abiertas).
  const rachaPlan = (k, conDias, abierto = true, refK = k) => {
    const cache = new Map();
    let r = 0;
    const hoyE = estadoDiaRacha(k, conDias, refK, cache);
    if (hoyE === 'C') r = 1;
    else if (!abierto || !(k in cal) || (!cal[k] && hoyE === 'X')) return 0;
    for (let d = claveDia(diaMs(k) - 864e5), n = 0; primerDia && d >= primerDia && n < 400; d = claveDia(diaMs(d) - 864e5), n++) {
      const e = estadoDiaRacha(d, conDias, refK, cache);
      if (e === 'X') break;
      if (e === 'C') r++;
    }
    return r;
  };
  const diaMs = (k) => new Date(`${k}T12:00`).getTime();
  // Semana del plan cumplida: todas sus sesiones terminadas (también otro día de esa semana) y todos sus descansos respetados.
  const semanaCumplida = (lunes) => {
    const dias = Array.from({ length: 7 }, (_, i) => claveDia(diaMs(lunes) + i * 864e5)).filter((k) => k in cal);
    const plan = dias.filter((k) => cal[k]);
    if (!plan.length) return false;
    // Cada sesión del plan tiene que estar hecha esa semana (dos fondos piden dos fondos), el día que sea.
    const cuenta = (lista) => lista.reduce((m, e) => m.set(e, (m.get(e) || 0) + 1), new Map());
    const hechas = cuenta(dias.flatMap((k) => porDia.get(k)?.hechas || []));
    const pide = cuenta(plan.map((k) => cal[k]));
    // Un descanso en el que recuperaste una sesión de esa semana no la rompe.
    const recuperada = (k) => (porDia.get(k)?.hechas || []).some((e) => pide.has(e));
    return [...pide].every(([e, n]) => (hechas.get(e) || 0) >= n) && dias.filter((k) => !cal[k] && k >= desdeCarga && !recuperada(k)).every(descansoRespetado);
  };
  let creditoHasta = desdeCarga; // primer día aún sin revisar
  const creditosAntesDe = (hoy) => {
    let descansos = 0;
    let semanas = 0;
    if (!creditoHasta) return { descansos, semanas };
    for (let k = creditoHasta; k < hoy; k = claveDia(diaMs(k) + 864e5)) {
      if (k in cal && !cal[k] && descansoRespetado(k)) descansos++;
      // Al cerrar un domingo se cobra su semana.
      if (new Date(diaMs(k)).getDay() === 0 && lunesDe(diaMs(k)) >= lunesDe(diaMs(desdeCarga)) && semanaCumplida(lunesDe(diaMs(k)))) semanas++;
    }
    creditoHasta = hoy > creditoHasta ? hoy : creditoHasta;
    return { descansos, semanas };
  };
  const planPagado = new Set(); // días en que ya se cobró la sesión del día
  const fav = claseDe(per.clase)?.favorito;
  const claveClase = claseDe(per.clase)?.clave || null;
  const arbol = (claveClase && per.arbol?.[claveClase]) || {};
  const sesPorSemana = new Map();
  const kmPorSemana = new Map();
  const atributos = Object.fromEntries(ATRIBUTOS.map((a) => [a.clave, 0]));
  const recientes = Object.fromEntries(ATRIBUTOS.map((a) => [a.clave, 0])); // las últimas 6 semanas
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
  const g = { clasesVencidas: new Set(), clasesAntiguas: new Set(), carrerasGanadas: [], kmTotal: 0, kmMax: 0, minMax: 0, rachaMax: 0, semanas: 0, semanasMax: 0, ultimoLunes: null, mejor2000: null, nivel: 1, nivelAntiguo: 1, sesiones: 0, misiones: 0, ftpInicial: null, ftpMejora: 0, paladas: 0, fantasmas: 0, tecMin: 0, semanasPlan: 0 };
  // Inicio del día y del lunes (ms) para ajustar las misiones a tu ritmo de las semanas anteriores.
  const inicioDia = (ms) => new Date(ms).setHours(0, 0, 0, 0);
  const inicioLunes = (lunes) => new Date(`${lunes}T00:00`).getTime();
  const cons = { semana: null, sesSemana: 0, mes: null, sesMes: 0, pagadoMes: false, semanasSeguidas: 0, ultimaSemanaOk: null };
  let xpSesion = 0; // XP de misiones, constancia y logros ganada en la sesión que se está procesando
  const dia = { clave: null, misiones: [], hechas: new Set(), d: null };
  const semana = { clave: null, misiones: [], hechas: new Set(), d: null };
  const nuevoAgg = () => ({ metros: 0, min: 0, kcal: 0, z2min: 0, z4min: 0, sobreSeg: 0, spm24min: 0, vo2Seg: 0, delPlan: 0, maxKcal: 0, mejorRec: 0, mejorPct: 0, ganados: 0, sesiones: 0, dias: new Set(),
    maxMetros: 0, maxMin: 0, estables: 0, diariasHechas: 0, vencidas: [], delDia: 0, suaves: 0, tecMin: 0, renidas: 0, altamar: 0, atr: Object.fromEntries(ATRIBUTOS.map((a) => [a.clave, 0])) });
  // Atributos antes de cada semana (para elegir la meta de atributo) y si ya usaste banda de pulso.
  let semAtr = { lunes: null, atr: null, pulso: false };
  let hayPulso = false;
  let cap = 0;
  let capAgg = { sesiones: 0, km: 0, z2min: 0, z4min: 0, fantasmas: 0, racha: 0 };
  let capMejores = {};
  let capPendiente = false; // forma de vencer al jefe ya hecha, a la espera de abrir el capítulo
  let jefeSesion = null;
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
    if (s.tiempoMeta != null && ((XC.esDelDia(s) && s.delDia !== 'sugerida') || (cal[hoy] && s.entrenamiento === cal[hoy]))) planHecho.add(hoy);
    let racha = 0;
    if (hoy >= RACHA_PLAN_DESDE) racha = rachaPlan(hoy, dias);
    else for (let d = s.fecha; dias.has(claveDia(d)); d -= 864e5) racha++;
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
        if (clara && !(XC.usaCarga(s) && r.clave === 'dist')) records++;
        if (mejor) mejores[r.clave] = v;
      }
    }
    const grados = claveClase ? gradosEn(arbol, claveClase, s.fecha) : {};
    const descansoATiempo = !dias.has(ayer) && (cargaDia.get(anteayer) || 0) >= 60;
    const lunesS = lunesDe(s.fecha);
    sesPorSemana.set(lunesS, (sesPorSemana.get(lunesS) || 0) + 1);
    kmPorSemana.set(lunesS, (kmPorSemana.get(lunesS) || 0) + m.metros / 1000);
    if (semAtr.lunes !== lunesS) semAtr = { lunes: lunesS, atr: { ...atributos }, pulso: hayPulso };
    const nueva = XC.usaCarga(s);
    const creditos = nueva ? creditosAntesDe(hoy) : null;
    const gan = gananciaSesion(s, m, {
      grados, clase: claveClase, sesSemana: sesPorSemana.get(lunesS), kmSemana: kmPorSemana.get(lunesS), metaSemanaKm, racha, records, cargaAyer: cargaDia.get(ayer) || 0, descansoATiempo, mppPromedio: mppN ? mppSuma / mppN : 0,
      cargaAntes: cargaDia.get(hoy) || 0, creditos, planPagado: planPagado.has(hoy), tipo: nueva ? tipoSesion(s, ftp) : null,
    });
    if (gan.pagaPlan) planPagado.add(hoy);
    // Remar fuerte en un descanso del plan: XP completa, pero el resumen avisa (y ese día no cuenta como descanso).
    const avisoDescanso = nueva && cal[hoy] === '' && !XC.esDelDia(s) && (gan.carga > XC.DESCANSO_CARGA_MAX || (porDia.get(hoy)?.ifMax || 0) >= XC.DESCANSO_IF_MAX);
    cargaDia.set(hoy, (cargaDia.get(hoy) || 0) + gan.carga);
    if (s.paladas) { mppSuma += s.distancia / s.paladas; mppN++; }
    const nivelAntes = nivelDe(xp);
    xpSesion = 0;
    jefeSesion = null;
    xp += gan.xp;
    const ganancias = {};
    const atrSesion = {};
    for (const [k, v] of Object.entries(gan.atributos)) {
      const total = v * (k === fav ? 1.15 : 1);
      atributos[k] += total;
      atrSesion[k] = total;
      if (total >= 0.5) ganancias[k] = Math.round(total);
    }
    if (s.fecha >= ahora - VENTANA_ATRIBUTOS_DIAS * 864e5 && s.fecha <= ahora) for (const [k, v] of Object.entries(atrSesion)) recientes[k] += v;
    if (s.fcProm > 0) hayPulso = true;
    // Etapa 12: la mitad de monedas por sesión (1 por cada 50 XP que se ven), para que la colección dure.
    const monedasSesion = Math.floor((esEtapa12(s.fecha) ? gan.xp : gan.xpBase) / 50) + monedasDeVentaja(s, m);
    monedas += monedasSesion;

    // Misiones del día y de la semana
    if (dia.clave !== hoy) Object.assign(dia, { clave: hoy, misiones: misionesDelDia(hoy, ritmoReciente(orden, inicioDia(s.fecha)), { cargaAyer: cargaDia.get(ayer) || 0, planHoy: hoy in cal ? cal[hoy] : null }), hechas: new Set(), d: nuevoAgg() });
    const lunes = lunesDe(s.fecha);
    if (semana.clave !== lunes) Object.assign(semana, { clave: lunes, misiones: misionesDeSemana(lunes, per.clase, ritmoReciente(orden, inicioLunes(lunes)), atributoDeLaSemana(semAtr.atr, { sinPulso: !semAtr.pulso, lunes })), hechas: new Set(), d: nuevoAgg() });
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
      agg.vo2Seg += m.vo2Seg; agg.delPlan += m.delPlan; agg.maxKcal = Math.max(agg.maxKcal, m.kcal); agg.mejorRec = Math.max(agg.mejorRec, m.fcRec60);
      agg.mejorPct = Math.max(agg.mejorPct, m.pct ?? 0);
      agg.delDia += m.delDia; agg.suaves += m.suave; agg.tecMin += m.tec?.minutos || 0; agg.renidas += m.renidas; agg.altamar += m.altamar;
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
    const monCons = (m) => (esEtapa12(s.fecha) ? m / 2 : m); // etapa 12: la constancia da la mitad de monedas
    if (cons.semana !== lunes) {
      const anterior = cons.semana;
      const ok = cons.sesSemana >= 2;
      cons.semanasSeguidas = ok && anterior && claveDia(new Date(anterior + 'T12:00').getTime() + 7 * 864e5) === lunes ? cons.semanasSeguidas : 0;
      Object.assign(cons, { semana: lunes, sesSemana: 0 });
      lograr(s.fecha, 'constancia', C.primeraSemana.texto, monCons(10), null, xpCons(C.primeraSemana.xp));
    }
    cons.sesSemana++;
    if (cons.sesSemana === 2) {
      cons.semanasSeguidas++;
      if (cons.semanasSeguidas === 4) { lograr(s.fecha, 'constancia', C.bloque4.texto, monCons(80), null, xpCons(C.bloque4.xp)); cons.semanasSeguidas = 0; }
    }
    if (cons.sesSemana === 3) lograr(s.fecha, 'constancia', C.semana3.texto, monCons(30), null, xpCons(C.semana3.xp));
    if (cons.sesSemana === 5) lograr(s.fecha, 'constancia', C.semana5.texto, monCons(20), null, xpCons(C.semana5.xp));
    const mes = hoy.slice(0, 7);
    if (cons.mes !== mes) Object.assign(cons, { mes, sesMes: 0, pagadoMes: false });
    if (++cons.sesMes >= 12 && !cons.pagadoMes) { cons.pagadoMes = true; lograr(s.fecha, 'constancia', C.mes12.texto, monCons(60), null, xpCons(C.mes12.xp)); }

    // Capítulo de la historia
    g.kmTotal += m.metros / 1000;
    g.paladas += s.paladas || 0;
    g.fantasmas += m.ganados || 0;
    g.tecMin += Math.min(TOPE_TECNICA_MIN, m.tec ? m.tec.minutos : minutosTecnicos(s, s.ftp || ftp));
    g.semanasPlan += creditos?.semanas || 0;
    g.kmMax = Math.max(g.kmMax, m.metros / 1000);
    g.sesiones++;
    for (const k of m.clasesVencidas) g.clasesVencidas.add(k);
    if (hoy < CLASES4_DESDE) for (const k of m.clasesVencidas) g.clasesAntiguas.add(k);
    if (m.clasesVencidas.length) g.carrerasGanadas.push(m.clasesVencidas);
    g.minMax = Math.max(g.minMax, m.min);
    g.rachaMax = Math.max(g.rachaMax, racha);
    if (m.t2000) g.mejor2000 = g.mejor2000 == null ? m.t2000 : Math.min(g.mejor2000, m.t2000);
    if (s.ftp > 0) {
      g.ftpInicial ??= s.ftp;
      g.ftpMejora = Math.max(g.ftpMejora, s.ftp - g.ftpInicial);
    }
    g.nivel = nivelDe(xp);
    if (cap < CAPITULOS.length) {
      const c = CAPITULOS[cap];
      const r9 = XC.usaReglas9(s);
      capAgg.sesiones++; capAgg.km += m.metros / 1000; capAgg.z2min += m.z2min; capAgg.z4min += m.z4min;
      capAgg.fantasmas += m.ganados; capAgg.racha = Math.max(capAgg.racha, racha);
      // Con las reglas nuevas el capítulo también se abre al llegar a su nivel.
      const listo = c.req.every(([k, v]) => capAgg[k] >= v) || (r9 && g.nivel >= c.nivel);
      const nombre = s.entrenamiento || '';
      const prueba = {
        p500: nombre.startsWith('Prueba 500') && s.tiempoMeta != null,
        p2000: (nombre.startsWith('Prueba 2000') || nombre === '2000 m') && s.tiempoMeta != null,
        pftp: !!s.pruebaWatts,
        mejor500: m.t500 != null && (capMejores.t500 == null || m.t500 < capMejores.t500),
        mejor2000: m.t2000 != null && (capMejores.t2000 == null || m.t2000 < capMejores.t2000),
      }[c.jefe.tipo];
      const vence = prueba || (r9 && (esSesionClave(s) || ganaAltaMar(s)));
      // Una forma de vencerlo hecha antes de abrir el capítulo se guarda para cuando se abra.
      if (r9 && vence && !listo) capPendiente = true;
      if (listo && (vence || capPendiente)) {
        const xpJefe = r9 ? c.xp : c.xpAntes ?? c.xp;
        lograr(s.fecha, 'jefe', `Venciste ${c.jefe.nombre.replace(/^El /, 'al ').replace(/^La /, 'a la ')} y terminaste «${c.nombre}»`, c.monedas, c.objeto, xpJefe);
        jefeSesion = { capitulo: cap + 1, nombre: c.jefe.nombre, objeto: c.objeto };
        cap++;
        capAgg = { sesiones: 0, km: 0, z2min: 0, z4min: 0, fantasmas: 0, racha: 0 };
        capMejores = { t500: mejores.t500, t2000: mejores.t2000 };
        capPendiente = false;
      }
    }
    // Logros: se revisan hasta que no salga ninguno nuevo (uno puede subir el nivel y desbloquear otro).
    for (let nuevo = true; nuevo;) {
      nuevo = false;
      g.nivel = nivelDe(xp);
      if (!XC.usaReglas9(s)) g.nivelAntiguo = g.nivel;
      for (const h of HAZANAS) {
        if (!hazanas.has(h.id) && h.valor(g) >= h.meta && !(h.desde && hoy < h.desde)) {
          hazanas.add(h.id);
          nuevo = true;
          lograr(s.fecha, 'hazana', `Logro: ${h.nombre}`, h.monedas, h.objeto, h.xp || 0);
        }
      }
    }
    porSesion.set(s.fecha, { xp: gan.xp, xpExtra: xpSesion, detalle: gan.detalle, ganancias, nivelAntes, nivelDespues: nivelDe(xp), monedas: monedasSesion, datosTal: gan.datosTal, grados, avisoDescanso, jefe: jefeSesion });
  }

  // Misiones de hoy y de esta semana aunque todavía no hayas remado.
  const hoy = claveDia(ahora);
  const lunes = lunesDe(ahora);
  const diaHoy = dia.clave === hoy ? dia : { misiones: misionesDelDia(hoy, ritmoReciente(orden, inicioDia(ahora)), { cargaAyer: cargaDia.get(claveDia(ahora - 864e5)) || 0, planHoy: hoy in cal ? cal[hoy] : null }), hechas: new Set(), d: nuevoAgg() };
  const atrHoy = atributoDeLaSemana(atributos, { sinPulso: !hayPulso, lunes });
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
  // Puntos canjeados por monedas (etapa 12): salen de los libres de todas las clases.
  const canjeados = per.puntosCanjeados || 0;
  const gastados = puntosGastados(arbol) + canjeados;
  monedas += canjeados * MONEDAS_POR_PUNTO;
  const capitulo = cap < CAPITULOS.length ? {
    n: cap + 1, ...CAPITULOS[cap], xp: Math.round(CAPITULOS[cap].xp * fHoy),
    progreso: CAPITULOS[cap].req.map(([k, v]) => ({ clave: k, texto: REQ_TEXTO[k], meta: v, valor: Math.min(v, Math.round(capAgg[k] * 10) / 10) })),
    listo: CAPITULOS[cap].req.every(([k, v]) => capAgg[k] >= v) || nivel >= CAPITULOS[cap].nivel,
    porNivel: nivel >= CAPITULOS[cap].nivel,
    pendiente: capPendiente,
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
    talentosPorRepartir: claveClase ? talentosPorRepartir(arbol, claveClase, nivel, puntosDeNivel(nivel) - gastados) : 0,
    puntosSobrantes: claveClase ? puntosSobrantes(arbol, puntosDeNivel(nivel) - gastados) : 0,
    // En pantalla, el nivel de las últimas 6 semanas (puede bajar); el acumulado solo da los títulos.
    atributos: Object.fromEntries(Object.entries(recientes).map(([k, v]) => [k, Math.round(v)])),
    atributosTotal: Object.fromEntries(Object.entries(atributos).map(([k, v]) => [k, Math.round(v)])),
    porSesion,
    logros,
    monedas: monedas - (per.gastado || 0),
    monedasGanadas: monedas,
    insignias: premios,
    diarias: vista(diaHoy),
    semanales: vista(semanaHoy),
    capitulo,
    capitulosHechos: cap,
    hazanas: HAZANAS.filter((h) => !h.oculto || hazanas.has(h.id)).map((h) => ({ ...h, xp: Math.round((h.xp || 0) * fHoy), hecha: hazanas.has(h.id), valor: Math.min(h.meta, Math.floor(h.valor(g))) })),
    xpPorSesion,
    ritmo: ritmoReciente(orden, ahora),
    factorXp: fHoy,
    contexto: contextoHoy(orden, { ahora, dias, cargaDia, mppPromedio: mppN ? mppSuma / mppN : 0, sinPulso: !hayPulso, rachaAyer: rachaPlan(claveDia(ahora - 864e5), dias, false, claveDia(ahora)) }),
  };
}

// Puntos de talento que puedes gastar ahora: los libres, hasta lo que cuestan los grados que ya están abiertos.
// 0 si no queda nada que subir (árbol completo, talentos aún cerrados por nivel o no te alcanza para la maestría).
export function talentosPorRepartir(arbol, clase, nivel, libres) {
  const subibles = SLOTS.filter((slot) => !motivoBloqueo(slot, { nivel, libres }, arbol, clase));
  if (!subibles.length) return 0;
  const abierto = SLOTS.filter((slot) => !motivoBloqueo(slot, { nivel, libres: Infinity }, arbol, clase))
    .reduce((a, slot) => a + (GRADOS_MAX - Math.min(GRADOS_MAX, arbol?.[slot]?.length || 0)) * costeDe(slot), 0);
  return Math.min(libres, abierto);
}

// Lo que necesita una sesión de hoy para estimar sus atributos: racha si remas hoy, tu % en rango de siempre, etc.
function contextoHoy(orden, { ahora, dias, cargaDia, mppPromedio, sinPulso, rachaAyer = 0 }) {
  let racha = 1;
  if (claveDia(ahora) >= RACHA_PLAN_DESDE) racha = rachaAyer + 1; // si cumples hoy lo del plan
  else for (let d = ahora - 864e5; dias.has(claveDia(d)); d -= 864e5) racha++;
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

// Títulos por atributo: «Iniciado de la fuerza» a los 50 puntos… hasta «Prodigio de la fuerza».
export const TITULOS_ATRIBUTO = [[50, 'Iniciado'], [150, 'Diestro'], [400, 'Experto'], [1000, 'Virtuoso'], [2500, 'Prodigio']];
const DE_ATRIBUTO = { fuerza: 'de la fuerza', agilidad: 'de la agilidad', resistencia: 'de la resistencia', recuperacion: 'de la recuperación', tecnica: 'de la técnica', voluntad: 'de la voluntad', gasto: 'del gasto' };
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
  tecnica: { base: 'base:rit-mant', entrenamiento: 'Ritmo de crucero', reto: 'igual', texto: 'Potencia pareja palada a palada y cadencia estable. Rema como un samurái: constante de principio a fin.' },
  voluntad: { base: 'base:pal-mejora', entrenamiento: 'Paladas en pirámide', reto: 'superior', texto: 'Termina el entrenamiento completo y cuida tu racha. Un rival superior pone a prueba tu voluntad.' },
  gasto: { base: 'base:cal-mant', entrenamiento: 'Calorías', reto: 'inferior', texto: 'Un fondo largo en zona 2: es lo que más calorías quema con menos fatiga.' },
};
export const DIFICULTAD_RETO = { inferior: 'bahia', igual: 'costa', superior: 'altamar' };
// sinPulso: sin banda de pulso, Recuperación casi no puede crecer; se recomienda el siguiente más bajo.
export function recomendarPorAtributos(atributos, { sinPulso = false } = {}) {
  const lista = ATRIBUTOS.filter((a) => !(sinPulso && a.clave === 'recuperacion') && !(a.clave === 'gasto' && atributos.gasto == null)).map((a) => ({ ...a, valor: atributos[a.clave] || 0 }));
  if (!lista.some((a) => a.valor > 0)) return null;
  const flojo = lista.reduce((m, a) => (a.valor < m.valor ? a : m));
  return { atributo: flojo, ...RECOMENDACION_ATRIBUTO[flojo.clave] };
}
export { usaCarga, REGLAS_XP_CARGA } from './xp-carga.js';
