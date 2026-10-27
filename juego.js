// Héroe: tu personaje crece con tus entrenamientos reales.
// Todo se calcula desde el historial, así que las sesiones viejas también cuentan.
// Nada de esto cambia tus métricas reales: solo el juego.
import { estres, claveDia, RECORDS } from './estadisticas.js';

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
  { clave: 'explorador', nombre: 'Explorador', favorito: 'resistencia', lema: 'Ningún río es demasiado largo.', icono: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>' },
  { clave: 'monje', nombre: 'Monje', favorito: 'recuperacion', lema: 'Respira, recupera y vuelve más fuerte.', icono: '<path d="M20 12a8 8 0 1 1-3.3-6.5"/><path d="M12 8c-1.5 2-1.5 4 0 6 1.5-2 1.5-4 0-6zM8 12.5c1.2 1.4 2.5 1.8 4 1.5M16 12.5c-1.2 1.4-2.5 1.8-4 1.5"/>' },
  { clave: 'samurai', nombre: 'Samurái', favorito: 'tecnica', lema: 'La forma perfecta vence a la fuerza.', icono: '<path d="M5 19 19 5l1.5-1.5M15 5l4 4M7 15l2 2M3.5 20.5 5 19"/>' },
  { clave: 'gladiador', nombre: 'Gladiador', favorito: 'voluntad', lema: 'No se rinde. Nunca.', icono: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="M12 7v10M8 11h8"/>' },
];
export const claseDe = (clave) => CLASES.find((c) => c.clave === clave) || null;

export const NIVEL_MAX = 50;
// XP total para llegar a un nivel: con 3 sesiones por semana, nivel 10 en un mes y 30 en unos 6 meses.
export const xpParaNivel = (n) => Math.round(250 * Math.max(0, n - 1) ** 1.6);
export function nivelDe(xp) {
  let n = 1;
  while (n < NIVEL_MAX && xp >= xpParaNivel(n + 1)) n++;
  return n;
}

const TITULOS = [[1, 'Novato'], [5, 'Aprendiz'], [10, 'Remero'], [15, 'Veterano'], [20, 'Capitán'], [30, 'Campeón'], [40, 'Leyenda'], [50, 'Mito']];
export const tituloDe = (nivel) => TITULOS.filter(([n]) => nivel >= n).at(-1)[1];

// FTP para medir intensidad: el de la sesión, el actual o uno estimado con la propia sesión.
const ftpDe = (s, ftpActual) => s.ftp || ftpActual || Math.max(60, Math.round((s.wattsProm || 100) / 0.8));

// Segundos en que el pulso cayó al menos 20 lpm durante el primer minuto de cada descanso.
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

// Ganancia de una sesión: XP con detalle y puntos por atributo (antes del bono de clase).
function gananciaSesion(s, ctx) {
  const f = ftpDe(s, ctx.ftp);
  const m = s.muestras || [];
  let z2 = 0;
  let z4 = 0;
  let sobre = 0;
  for (const x of m) {
    const p = x.w / f;
    if (p >= 0.56 && p <= 0.9) z2++;
    if (p >= 0.91) z4++;
    if (p >= 1.06) sobre++;
  }
  const min = (seg) => seg / 60;
  const at = { fuerza: 0, agilidad: 0, resistencia: 0, recuperacion: 0, tecnica: 0, voluntad: 0 };
  at.fuerza += min(z4) * 1.2;
  at.agilidad += sobre / 20;
  at.resistencia += min(z2) * 0.5 + (s.duracion >= 1200 ? 4 : 0);
  if (s.distancia >= 400 && s.distancia <= 600 && s.duracion <= 150) at.agilidad += 5;
  const suave = s.wattsProm && s.wattsProm / f < 0.75;
  if (suave && ctx.cargaAyer >= 60) at.recuperacion += 5;
  else if (suave) at.recuperacion += 2;
  if (ctx.descansoATiempo) at.recuperacion += 4;
  at.recuperacion += recuperacionesFc(s) * 3;
  if (s.pctEnRango != null) at.tecnica += (min(s.duracion) * s.pctEnRango) / 100 * 0.6;
  if (s.paladas && ctx.mppPromedio && s.distancia / s.paladas > ctx.mppPromedio * 1.02) at.tecnica += 3;
  const completo = s.tiempoMeta != null;
  if (completo) at.voluntad += 3;
  if (s.rpe >= 8) at.voluntad += 3;
  at.voluntad += Math.min(ctx.racha, 7) * 0.5;

  const carga = s.estres ?? estres(s, f) ?? Math.round(min(s.duracion) * 0.8);
  const detalle = [['Esfuerzo', Math.round(carga * 18)]];
  if (completo) detalle.push(['Entrenamiento completo', 100]);
  if (ctx.records) detalle.push([ctx.records === 1 ? 'Récord' : `${ctx.records} récords`, 50 * ctx.records]);
  const ganados = (s.rivales || (s.rival ? [s.rival] : [])).filter((r) => r.diferencia > 0).length;
  if (ganados) detalle.push([ganados === 1 ? 'Fantasma vencido' : `${ganados} fantasmas vencidos`, 75 * ganados]);
  if (ctx.racha > 1) detalle.push([`Racha de ${ctx.racha} días`, 10 * Math.min(ctx.racha, 7)]);
  return { xp: detalle.reduce((a, [, v]) => a + v, 0), detalle, atributos: at, carga };
}

// Recorre el historial en orden y devuelve el estado del héroe y lo que ganó cada sesión.
export function progresoHeroe(sesiones, { ftp = 0, clase = null } = {}) {
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const fav = claseDe(clase)?.favorito;
  const atributos = Object.fromEntries(ATRIBUTOS.map((a) => [a.clave, 0]));
  const mejores = {};
  const cargaDia = new Map();
  const dias = new Set();
  const porSesion = new Map();
  let xp = 0;
  let mppSuma = 0;
  let mppN = 0;
  for (const s of orden) {
    const hoy = claveDia(s.fecha);
    const ayer = claveDia(s.fecha - 864e5);
    const anteayer = claveDia(s.fecha - 2 * 864e5);
    dias.add(hoy);
    let racha = 0;
    for (let d = s.fecha; dias.has(claveDia(d)); d -= 864e5) racha++;
    let records = 0;
    if (s.muestras?.length) {
      for (const r of RECORDS) {
        const v = r.calc(s);
        if (v == null) continue;
        const previo = mejores[r.clave];
        if (previo != null && (r.tipo === 'tiempo' ? v < previo : v > previo)) records++;
        if (previo == null || (r.tipo === 'tiempo' ? v < previo : v > previo)) mejores[r.clave] = v;
      }
    }
    const ctx = {
      ftp, racha, records,
      cargaAyer: cargaDia.get(ayer) || 0,
      descansoATiempo: !dias.has(ayer) && (cargaDia.get(anteayer) || 0) >= 60,
      mppPromedio: mppN ? mppSuma / mppN : 0,
    };
    const g = gananciaSesion(s, ctx);
    cargaDia.set(hoy, (cargaDia.get(hoy) || 0) + g.carga);
    if (s.paladas) { mppSuma += s.distancia / s.paladas; mppN++; }
    const nivelAntes = nivelDe(xp);
    xp += g.xp;
    const ganancias = {};
    for (const [k, v] of Object.entries(g.atributos)) {
      const total = v * (k === fav ? 1.15 : 1);
      atributos[k] += total;
      if (total >= 0.5) ganancias[k] = Math.round(total);
    }
    porSesion.set(s.fecha, { xp: g.xp, detalle: g.detalle, ganancias, nivelAntes, nivelDespues: nivelDe(xp) });
  }
  const nivel = nivelDe(xp);
  return {
    xp,
    nivel,
    titulo: tituloDe(nivel),
    desde: xpParaNivel(nivel),
    hasta: nivel >= NIVEL_MAX ? null : xpParaNivel(nivel + 1),
    talentos: nivel - 1,
    atributos: Object.fromEntries(Object.entries(atributos).map(([k, v]) => [k, Math.round(v)])),
    porSesion,
  };
}
