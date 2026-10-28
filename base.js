// Entrenamientos base: 5 secciones × 3 dificultades (suave, mantenimiento, mejora), generados al momento.
// La intensidad va en % del FTP (o golpes por minuto), así que siguen tu fuerza; el volumen crece con el rango del héroe.
// No se guardan en la base de datos: su id es «base:clave» y siempre se calculan para tu nivel actual.
import { EJEMPLOS, duracionTotal, soloTiempo, tipoDe } from './entrenamientos.js';

export const DIFICULTADES = [
  { clave: 'suave', nombre: 'Suave' },
  { clave: 'mant', nombre: 'Mantenimiento' },
  { clave: 'mejora', nombre: 'Mejora' },
];
export const nombreDificultad = (d) => DIFICULTADES.find((x) => x.clave === d)?.nombre || '';

// Escalón de volumen según el nivel: 1–19, 20–39, 40–59, 60–90.
export const escalonDe = (nivel) => (nivel >= 60 ? 3 : nivel >= 40 ? 2 : nivel >= 20 ? 1 : 0);
export const TEXTO_ESCALON = ['niveles 1–19', 'niveles 20–39', 'niveles 40–59', 'niveles 60–90'];

const CAL = { nombre: 'Calentamiento', duracion: 480, metrica: 'ftp', min: 56, max: 75 };
const CAL_CORTO = { ...CAL, duracion: 300 };
const ENF = { nombre: 'Enfriamiento', duracion: 300, metrica: '', min: 0, max: 0 };
const ENF_CORTO = { ...ENF, duracion: 180 };
const ftpB = (nombre, duracion, min, max) => ({ nombre, duracion, metrica: 'ftp', min, max });
const spmB = (nombre, duracion, min, max) => ({ nombre, duracion, metrica: 'spm', min, max });
const SUAVE = (s) => ftpB('Suave', s, 40, 55);

// Split (s/500 m) para un % del FTP: la inversa de W = 2.8 / (s/m)³.
const splitDe = (w) => Math.round(500 * (2.8 / w) ** (1 / 3));
// Bloque de ritmo: con FTP pide un split; sin FTP, el mismo esfuerzo en % del FTP.
function ritmoB(nombre, extra, pMin, pMax, ftp) {
  if (!ftp) return { nombre, ...extra, metrica: 'ftp', min: pMin, max: pMax };
  return { nombre, ...extra, metrica: 'split', min: splitDe((ftp * pMax) / 100), max: splitDe((ftp * pMin) / 100) };
}
// Series: reps × trabajo con descanso entre ellas (sin descanso al final).
const series = (reps, trabajo, descanso) => Array.from({ length: reps }, (_, i) => [
  trabajo(i + 1, reps), ...(i < reps - 1 && descanso ? [descanso] : []),
]).flat();
const min = (m) => `${m} min`;

// Cada base: clave, sección, dificultad, nombre fijo (para comparar sesiones), para qué sirve y cómo se arma en cada escalón.
const BASES = [
  { clave: 'pot-suave', enfoque: 'potencia', dificultad: 'suave', nombre: 'Activación de potencia', proposito: 'Despertar la fuerza sin cansarte.',
    armar: (e) => {
      const reps = [6, 8, 9, 10][e];
      return { resumen: `${reps} × 30 s fuertes`, bloques: [CAL, ...series(reps, (i, n) => ftpB(`30 s fuerte ${i}/${n}`, 30, 90, 100), SUAVE(90)), ENF] };
    } },
  { clave: 'pot-mant', enfoque: 'potencia', dificultad: 'mant', nombre: 'Umbral', proposito: 'Mantener tu FTP.',
    armar: (e) => {
      const [reps, m] = [[3, 6], [4, 6], [4, 8], [5, 8]][e];
      return { resumen: `${reps} × ${min(m)} en umbral`, bloques: [CAL, ...series(reps, (i, n) => ftpB(`Umbral ${i}/${n}`, m * 60, 91, 105), SUAVE(180)), ENF] };
    } },
  { clave: 'pot-mejora', enfoque: 'potencia', dificultad: 'mejora', nombre: 'VO2 máx', proposito: 'Subir tu FTP y tus watts máximos.',
    armar: (e) => {
      const reps = [6, 7, 8, 10][e];
      return { resumen: `${reps} × 2 min muy fuertes`, bloques: [CAL, ...series(reps, (i, n) => ftpB(`2 min fuerte ${i}/${n}`, 120, 106, 120), SUAVE(120)), ENF] };
    } },
  { clave: 'rit-suave', enfoque: 'ritmo', dificultad: 'suave', nombre: 'Ritmo cómodo', proposito: 'Remar suelto y relajado.',
    armar: (e, ftp) => {
      const m = [15, 20, 22, 26][e];
      return { resumen: `${min(m)} a ritmo cómodo`, bloques: [CAL_CORTO, ritmoB('Ritmo cómodo', { duracion: m * 60 }, 65, 75, ftp), ENF_CORTO] };
    } },
  { clave: 'rit-mant', enfoque: 'ritmo', dificultad: 'mant', nombre: 'Ritmo de crucero', proposito: 'Sostener tu ritmo de siempre.',
    armar: (e, ftp) => {
      const [reps, m] = [[3, 8], [4, 8], [3, 12], [4, 12]][e];
      return { resumen: `${reps} × ${min(m)} a ritmo de crucero`,
        bloques: [CAL, ...series(reps, (i, n) => ritmoB(`Crucero ${i}/${n}`, { duracion: m * 60 }, 80, 88, ftp), SUAVE(120)), ENF] };
    } },
  { clave: 'rit-mejora', enfoque: 'ritmo', dificultad: 'mejora', nombre: 'Ritmo de carrera', proposito: 'Bajar tu tiempo en 2000 m.',
    armar: (e, ftp) => {
      const reps = [4, 5, 6, 7][e];
      return { resumen: `${reps} × 1000 m a ritmo de carrera`,
        bloques: [CAL, ...series(reps, (i, n) => ritmoB(`1000 m ${i}/${n}`, { fin: 'distancia', cantidad: 1000, duracion: 0 }, 95, 102, ftp), SUAVE(180)), ENF] };
    } },
  { clave: 'dis-suave', enfoque: 'distancia', dificultad: 'suave', nombre: 'Fondo suave', proposito: 'Recuperar y sumar metros.',
    armar: (e) => {
      const m = [20, 25, 30, 35][e];
      return { resumen: `${min(m)} en zona 1–2`, bloques: [CAL_CORTO, ftpB('Fondo suave', m * 60, 55, 70), ENF_CORTO] };
    } },
  { clave: 'dis-mant', enfoque: 'distancia', dificultad: 'mant', nombre: 'Fondo', proposito: 'Mantener la base aeróbica.',
    armar: (e) => {
      const m = [5000, 6000, 7500, 9000][e];
      return { resumen: `${m.toLocaleString('es-MX')} m en zona 2`,
        bloques: [CAL_CORTO, { nombre: `Fondo ${m} m`, fin: 'distancia', cantidad: m, duracion: 0, metrica: 'ftp', min: 65, max: 75 }, ENF_CORTO] };
    } },
  { clave: 'dis-mejora', enfoque: 'distancia', dificultad: 'mejora', nombre: 'Fondo progresivo', proposito: 'Remar más lejos sin parar.',
    armar: (e) => {
      const [total, fin] = [[40, 15], [50, 18], [60, 20], [70, 25]][e];
      return { resumen: `${min(total)}: zona 2 y los últimos ${fin} en zona 3`,
        bloques: [CAL_CORTO, ftpB('Zona 2', (total - fin) * 60, 65, 75), ftpB('Zona 3', fin * 60, 76, 90), ENF_CORTO] };
    } },
  { clave: 'pal-suave', enfoque: 'tecnica', dificultad: 'suave', nombre: 'Técnica a 18–20 golpes', proposito: 'Cuidar la técnica sin prisa.',
    armar: (e) => {
      const m = [15, 20, 22, 26][e];
      return { resumen: `${min(m)} a 18–20 golpes/min`, bloques: [spmB('Calentamiento', 300, 18, 22), spmB('Palada larga', m * 60, 18, 20), ENF_CORTO] };
    } },
  { clave: 'pal-mant', enfoque: 'tecnica', dificultad: 'mant', nombre: 'Escalera de cadencia', proposito: 'Controlar la cadencia.',
    armar: (e) => {
      const m = [4, 5, 6, 7][e];
      const pasos = [20, 22, 24, 26];
      return { resumen: `${min(m)} a 20, 22, 24 y 26 golpes/min`,
        bloques: [spmB('Calentamiento', 300, 18, 22), ...pasos.flatMap((g, i) => [spmB(`${g} golpes/min`, m * 60, g - 1, g + 1), ...(i < pasos.length - 1 ? [spmB('Suave', 60, 18, 22)] : [])]), ENF_CORTO] };
    } },
  { clave: 'pal-mejora', enfoque: 'tecnica', dificultad: 'mejora', nombre: 'Paladas en pirámide', proposito: 'Potencia por palada a cadencia alta.',
    armar: (e) => {
      const f = [1, 1.25, 1.5, 1.75][e];
      const tramos = [50, 100, 150, 100, 50].map((n) => Math.round((n * f) / 10) * 10);
      return { resumen: `${tramos.join('-')} paladas a 26–30 golpes/min`,
        bloques: [spmB('Calentamiento', 300, 18, 22), ...tramos.flatMap((n, i) => [
          { nombre: `${n} paladas`, fin: 'paladas', cantidad: n, duracion: 0, metrica: 'spm', min: 26, max: 30 },
          ...(i < tramos.length - 1 ? [spmB('Suave', 60, 18, 22)] : [])]), ENF_CORTO] };
    } },
  { clave: 'cal-suave', enfoque: 'calorias', dificultad: 'suave', nombre: 'Calorías suaves', proposito: 'Moverte un rato sin exigirte.',
    objetivo: (e) => [100, 125, 150, 175][e] },
  { clave: 'cal-mant', enfoque: 'calorias', dificultad: 'mant', nombre: 'Calorías de mantenimiento', proposito: 'Mantener el gasto de la semana.',
    objetivo: (e) => [200, 250, 300, 350][e] },
  { clave: 'cal-mejora', enfoque: 'calorias', dificultad: 'mejora', nombre: 'Calorías a fondo', proposito: 'Quemar más en una sola sesión.',
    objetivo: (e) => [300, 375, 450, 525][e] },
];

// Las pruebas miden tu progreso: siempre iguales, sin dificultad.
const PRUEBAS = [
  ['prueba-500', 'Prueba 500 m', 'Mide tu mejor 500 m.'],
  ['prueba-2000', 'Prueba 2000 m', 'Mide tu mejor 2000 m.'],
  ['prueba-ftp', 'Prueba FTP 20 min', 'Calcula tu FTP para ajustar las intensidades.'],
].map(([clave, nombre, proposito]) => ({ ...structuredClone(EJEMPLOS.find((x) => x.nombre === nombre)), id: `base:${clave}`, base: true, enfoque: 'pruebas', dificultad: null, proposito, ...(clave === 'prueba-ftp' ? { resumen: '20 min a tu máximo sostenido' } : {}) }));
export const NOMBRES_PRUEBA = new Set(PRUEBAS.map((p) => p.nombre));

// Los 15 entrenamientos base para tu nivel y tu FTP, más las 3 pruebas.
export function entrenamientosBase(nivel = 1, ftp = 0) {
  const e = escalonDe(nivel);
  return BASES.map((b) => {
    const comun = { id: `base:${b.clave}`, base: true, nombre: b.nombre, enfoque: b.enfoque, dificultad: b.dificultad, proposito: b.proposito, escalon: e };
    if (b.objetivo) {
      const kcal = b.objetivo(e);
      return { ...comun, tipo: 'objetivo', objetivo: { metrica: 'kcal', valor: kcal }, resumen: `${kcal} kcal` };
    }
    const { resumen, bloques } = b.armar(e, ftp);
    return { ...comun, tipo: 'intervalos', bloques, resumen };
  }).concat(PRUEBAS.map((p) => structuredClone(p)));
}
export const esBase = (id) => typeof id === 'string' && id.startsWith('base:');

// Texto corto y útil: duración y qué se hace («≈ 37 min · 3 × 6 min en umbral»).
export function resumenEnt(ent, ritmo) {
  if (tipoDe(ent) === 'objetivo') {
    const { metrica, valor } = ent.objetivo;
    return `Meta: ${Number(valor).toLocaleString('es-MX')} ${{ distancia: 'm', kcal: 'kcal', paladas: 'paladas' }[metrica] || ''}`;
  }
  const seg = duracionTotal(ent, ritmo);
  const m = Math.round(seg / 60);
  const dur = `${soloTiempo(ent) ? '' : '≈ '}${m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`}`;
  if (ent.resumen) return `${dur} · ${ent.resumen}`;
  const trabajo = ent.bloques.filter((b) => !/calentamiento|enfriamiento|descanso|suave/i.test(b.nombre || ''));
  // Con calentamiento o enfriamiento, la duración es del total (el nombre suele decir solo el tramo de trabajo).
  const conExtras = ent.bloques.some((b) => /calentamiento|enfriamiento/i.test(b.nombre || ''));
  return `${dur}${conExtras ? ' en total' : ''} · ${trabajo.length} ${trabajo.length === 1 ? 'tramo' : 'tramos'} de trabajo`;
}
