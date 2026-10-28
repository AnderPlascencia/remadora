// Consejos de atributos: qué sube cada entrenamiento, qué puedes sumar si remas de cierta forma,
// cuánto te falta para el siguiente punto mientras remas y qué te quedó cerca al terminar.
// Usa las mismas reglas que juego.js (gananciaSesion), así los números coinciden con los que ganas.
import * as F from './fantasma.js';
import * as Ent from './entrenamientos.js';
import * as J from './juego.js';

const ftpO = (ftp) => ftp || 150;
const vatios = (f, k) => Math.round(f * k);
const redondear = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]).filter(([, v]) => v > 0));
const nombre = (k) => J.ATRIBUTOS.find((a) => a.clave === k)?.nombre || k;
const coma = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// Entrenamiento con metas de potencia, ritmo o cadencia: el tiempo en rango suma Técnica.
export function conRango(ent) {
  return !!ent && Ent.tipoDe(ent) === 'intervalos' && ent.bloques.some((b) => b.metrica && !/^fc/.test(b.metrica));
}

// Sesión imaginaria: el entrenamiento remado a tu FTP, completo.
export function sesionDePlan(ent, ftp = 0) {
  const f = ftpO(ftp);
  const muestras = F.simular(ent, { ftp: f }, f).muestras;
  if (!muestras.length) return null;
  const fin = muestras.at(-1);
  return {
    fecha: Date.now(), duracion: fin.t, distancia: Math.round(fin.dist), muestras, ftp: f,
    wattsProm: Math.round(muestras.reduce((a, x) => a + x.w, 0) / muestras.length), tiempoMeta: fin.t, entrenamiento: ent?.nombre || null,
  };
}

const es500 = (s) => s.distancia >= 400 && s.distancia <= 600;

// Lo que te da un entrenamiento: `seguro` si lo terminas como sueles remar, `extras` que puedes sumar
// (los del atributo `debil` primero) y `riesgo` si lo dejas a medias.
// ctx = estadoJuego().contexto: { racha, pctMedio, mppPromedio, cargaAyer }.
// libre: remo libre (el plan es solo una distancia de referencia), sin bono por terminar.
export function prevision(ent, { ftp = 0, clase = null, ctx = {}, debil = null, libre = false } = {}) {
  const s = sesionDePlan(ent, ftp);
  if (!s) return null;
  const f = s.ftp;
  const rango = conRango(ent);
  const prueba500 = es500(s);
  // El bono de 2:30 depende de ti: no se cuenta como seguro.
  const base = { ...s, pctEnRango: rango ? (ctx.pctMedio ?? 70) : null, duracion: prueba500 ? Math.max(s.duracion, 151) : s.duracion, tiempoMeta: libre ? null : s.tiempoMeta };
  const A = (x) => J.atributosDeSesion(x, { ftp: f, clase, ctx });
  const seg = A(base);
  const fa = (k) => J.factorAtributo(k, clase);
  const extras = [];
  if (rango && base.pctEnRango < 85) {
    const d = A({ ...base, pctEnRango: 85 }).tecnica - seg.tecnica;
    if (d >= 0.5) extras.push({ clave: 'rango', icono: 'i-diana', titulo: 'Mantén el rango el 85 % del tiempo', detalle: ctx.pctMedio != null ? `Tu media es ${ctx.pctMedio} %. Sigue el indicador verde.` : 'Sigue el indicador verde en cada tramo.', atributo: 'tecnica', puntos: d });
  }
  if (prueba500) extras.push({ clave: '500', icono: 'i-reloj', titulo: 'Bájalo de 2:30', detalle: 'Un 500 m en menos de 2:30 suma Agilidad.', atributo: 'agilidad', puntos: 5 * fa('agilidad') });
  const w106 = vatios(f, 1.06);
  if (!prueba500) extras.push(seg.agilidad < 0.5
    ? { clave: 'sprint', icono: 'i-rayo', titulo: `Un sprint de 20 s por encima de ${w106} W`, detalle: 'Al final, cuando ya estás caliente.', atributo: 'agilidad', puntos: fa('agilidad') }
    : { clave: 'sprint', icono: 'i-rayo', titulo: `Cada 20 s más por encima de ${w106} W`, detalle: 'Aprieta un poco más en las series fuertes.', atributo: 'agilidad', puntos: fa('agilidad') });
  if (seg.fuerza < 3) extras.push({ clave: 'zona4', icono: 'i-fuego', titulo: `Aguanta 2 min por encima de ${vatios(f, 0.91)} W`, detalle: 'Un tramo en zona 4 a mitad de la sesión.', atributo: 'fuerza', puntos: 2.4 * fa('fuerza') });
  if (base.duracion < 1200 && !/^Prueba/.test(ent?.nombre || '')) {
    const min = Math.ceil((1200 - base.duracion) / 60);
    extras.push({ clave: '20min', icono: 'i-reloj', titulo: `Rema ${min} min más, suave`, detalle: 'Las sesiones de 20 min o más suman Resistencia.', atributo: 'resistencia', puntos: 4 * fa('resistencia') });
  }
  if (ctx.mppPromedio > 0) extras.push({ clave: 'mpp', icono: 'i-sube', titulo: `Más de ${coma(ctx.mppPromedio * 1.02)} m por palada`, detalle: 'Palada larga y potente, sin subir la cadencia.', atributo: 'tecnica', puntos: 3 * fa('tecnica') });
  extras.push({ clave: 'esfuerzo', icono: 'i-fuego', titulo: 'Rema fuerte hasta el final', detalle: 'Si al terminar marcas esfuerzo 8 o más.', atributo: 'voluntad', puntos: 3 * fa('voluntad') });
  const orden = extras.map((x) => ({ ...x, puntos: Math.max(1, Math.round(x.puntos)) }))
    .sort((a, b) => (b.atributo === debil) - (a.atributo === debil) || b.puntos - a.puntos);
  const seguro = redondear(seg);
  const principal = Object.entries(seguro).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    seguro, principal, minutos: Math.round(base.duracion / 60),
    extras: orden.slice(0, 3),
    riesgo: !libre ? { titulo: 'Si lo dejas a medias', detalle: 'Pierdes el bono por terminarlo.', atributo: 'voluntad', puntos: -Math.round(3 * fa('voluntad')) } : null,
  };
}

// Los entrenamientos que más suben un atributo, de mayor a menor. Después, los que lo suben
// solo con un extra de 3 puntos o más (como bajar de 2:30 en el 500 m), con `si` = ese extra.
export function mejoresPara(clave, ents, opts = {}) {
  const todos = ents.map((ent) => ({ ent, p: prevision(ent, opts) })).filter((x) => x.p);
  const seguros = todos.filter((x) => (x.p.seguro[clave] || 0) > 0).sort((a, b) => b.p.seguro[clave] - a.p.seguro[clave]);
  const conExtra = todos.filter((x) => !(x.p.seguro[clave] > 0))
    .map((x) => ({ ...x, si: x.p.extras.find((e) => e.atributo === clave && e.puntos >= 3) }))
    .filter((x) => x.si).sort((a, b) => b.si.puntos - a.si.puntos);
  return [...seguros, ...conExtra];
}

// Mientras remas: lo que llevas de cada atributo y el siguiente punto que tienes más a mano.
// muestras = las de la sesión (1 por segundo); pct = % en rango hasta ahora (o null);
// rango = { min, max } en watts del tramo actual: el reto nunca te pide salirte de él.
export function enVivo(muestras, { ftp = 0, clase = null, ctx = {}, pct = null, rango = null } = {}) {
  const f = ftpO(ftp);
  if (!muestras.length) return null;
  const fin = muestras.at(-1);
  const s = { fecha: Date.now(), duracion: fin.t, distancia: fin.dist || 0, muestras, ftp: f, pctEnRango: pct, tiempoMeta: null,
    wattsProm: Math.round(muestras.reduce((a, x) => a + x.w, 0) / muestras.length) };
  const totales = J.atributosDeSesion(s, { ftp: f, clase, ctx });
  const ult = muestras.slice(-10);
  const w = ult.reduce((a, x) => a + x.w, 0) / ult.length;
  const p = w / f;
  // Puntos por segundo en cada zona (con el 15 % de tu clase).
  const zona = p >= 1.06 ? { atributo: 'agilidad', porSeg: 1 / 20, umbral: vatios(f, 1.06) }
    : p >= 0.91 ? { atributo: 'fuerza', porSeg: 1.2 / 60, umbral: vatios(f, 0.91) }
      : p >= 0.56 ? { atributo: 'resistencia', porSeg: 0.5 / 60, umbral: vatios(f, 0.56) } : null;
  let reto;
  const fuera = rango && ((rango.max && w > rango.max) || (rango.min && w < rango.min));
  if (fuera || (rango && zona && zona.umbral > (rango.max || Infinity))) {
    // Con un tramo marcado, lo que suma es quedarte en él: Técnica por cada minuto en rango.
    const v = totales.tecnica;
    const porSeg = (0.6 / 60) * J.factorAtributo('tecnica', clase);
    const falta = Math.floor(v) + 1 - v;
    const txt = rango.max ? `${rango.min}–${rango.max} W` : `${rango.min} W o más`;
    reto = {
      atributo: 'tecnica', puntos: 1, progreso: fuera ? 0 : 1 - falta, faltanSeg: fuera ? null : Math.max(1, Math.ceil(falta / porSeg)),
      titulo: fuera ? `Vuelve a tu rango: ${txt}` : `Quédate en ${txt}`,
      detalle: 'Cada minuto en rango suma Técnica.', corto: 'En rango sumas Técnica',
    };
  } else if (zona) {
    const v = totales[zona.atributo];
    const porSeg = zona.porSeg * J.factorAtributo(zona.atributo, clase);
    const falta = Math.floor(v) + 1 - v;
    reto = {
      atributo: zona.atributo, puntos: 1, progreso: 1 - falta, faltanSeg: Math.max(1, Math.ceil(falta / porSeg)),
      titulo: `Sigue por encima de ${zona.umbral} W`,
      detalle: zona.atributo === 'resistencia' ? `Por encima de ${vatios(f, 0.91)} W sumas Fuerza, más rápido.` : zona.atributo === 'fuerza' ? `Por encima de ${vatios(f, 1.06)} W sumas Agilidad.` : 'Sprint: cada 20 s es +1.',
    };
  } else {
    reto = { atributo: 'resistencia', puntos: 1, progreso: 0, faltanSeg: null, titulo: `Sube a ${vatios(f, 0.56)} W`, detalle: 'Desde ahí cada 2 min suma Resistencia.', corto: `Desde ${vatios(f, 0.56)} W sumas Resistencia` };
  }
  return { totales, puntos: Object.fromEntries(Object.entries(totales).map(([k, v]) => [k, Math.floor(v)])), reto };
}

// Al terminar: lo que lograste y lo que te quedó cerca (con los puntos que habrías sumado).
// ctx.mppPromedio = tu media de metros por palada antes de esta sesión.
export function analisis(s, { ftp = 0, clase = null, ctx = {} } = {}) {
  const f = s.ftp || ftpO(ftp);
  const A = (x) => J.atributosDeSesion(x, { ftp: f, clase, ctx });
  const real = A(s);
  const m = J.medidas(s, f);
  const fa = (k) => J.factorAtributo(k, clase);
  const logros = [];
  const cerca = [];
  const w91 = vatios(f, 0.91);
  const w106 = vatios(f, 1.06);
  if (s.tiempoMeta != null) logros.push({ icono: 'i-check', titulo: 'Terminaste el entrenamiento completo', atributo: 'voluntad', puntos: 3 * fa('voluntad') });
  else if (s.entrenamiento) cerca.push({ icono: 'i-aviso', titulo: 'No lo terminaste', detalle: 'Terminarlo completo suma Voluntad.', atributo: 'voluntad', puntos: 3 * fa('voluntad') });
  if (m.z4min >= 1) logros.push({ icono: 'i-fuego', titulo: `${Math.round(m.z4min)} min en zona 4`, detalle: `Por encima de ${w91} W.`, atributo: 'fuerza', puntos: real.fuerza });
  const agiSeg = (s.muestras || []).filter((x) => x.w / f >= 1.06).length;
  if (agiSeg >= 20) logros.push({ icono: 'i-rayo', titulo: `${agiSeg} s por encima de ${w106} W`, atributo: 'agilidad', puntos: (agiSeg / 20) * fa('agilidad') });
  else if (s.muestras?.length) cerca.push({ icono: 'i-rayo', titulo: agiSeg ? `Solo ${agiSeg} s por encima de ${w106} W` : `Nada por encima de ${w106} W`, detalle: 'Un sprint de 20 s al final ya cuenta.', atributo: 'agilidad', puntos: fa('agilidad') });
  if (s.pctEnRango != null) {
    if (s.pctEnRango >= 85) logros.push({ icono: 'i-diana', titulo: `En rango el ${s.pctEnRango} % del tiempo`, atributo: 'tecnica', puntos: (m.min * s.pctEnRango) / 100 * 0.6 * fa('tecnica') });
    else {
      const d = A({ ...s, pctEnRango: 85 }).tecnica - real.tecnica;
      if (d >= 0.5) cerca.push({ icono: 'i-diana', titulo: `En rango el ${s.pctEnRango} % (meta 85 %)`, detalle: 'Cuando el indicador salga de verde, vuelve al rango cuanto antes.', atributo: 'tecnica', puntos: d });
    }
  }
  if (s.duracion >= 1200 || m.z2min >= 5) logros.push({ icono: 'i-reloj', titulo: s.duracion >= 1200 ? `${Math.round(s.duracion / 60)} min remando` : `${Math.round(m.z2min)} min en zonas 2 y 3`, atributo: 'resistencia', puntos: real.resistencia });
  if (s.duracion >= 900 && s.duracion < 1200) cerca.push({ icono: 'i-reloj', titulo: `Te faltaron ${Math.ceil((1200 - s.duracion) / 60)} min para los 20`, detalle: 'Las sesiones de 20 min o más suman Resistencia.', atributo: 'resistencia', puntos: 4 * fa('resistencia') });
  if (es500(s)) {
    if (s.duracion <= 150) logros.push({ icono: 'i-rayo', titulo: '500 m en menos de 2:30', atributo: 'agilidad', puntos: 5 * fa('agilidad') });
    else if (s.duracion <= 175) cerca.push({ icono: 'i-reloj', titulo: `Te faltaron ${s.duracion - 150} s para bajar de 2:30`, detalle: 'Sal fuerte y aguanta el último tramo.', atributo: 'agilidad', puntos: 5 * fa('agilidad') });
  }
  if (s.rpe >= 8) logros.push({ icono: 'i-fuego', titulo: 'Sesión muy dura', atributo: 'voluntad', puntos: 3 * fa('voluntad') });
  else if (s.rpe == null && s.muestras?.length) cerca.push({ icono: 'i-fuego', titulo: '¿Fue muy dura? Márcalo abajo', detalle: 'Un esfuerzo de 8 o más suma Voluntad.', atributo: 'voluntad', puntos: 3 * fa('voluntad') });
  if (ctx.mppPromedio > 0 && s.paladas) {
    const mpp = s.distancia / s.paladas;
    const meta = ctx.mppPromedio * 1.02;
    if (mpp > meta) logros.push({ icono: 'i-sube', titulo: `${coma(mpp)} m por palada`, detalle: 'Más que tu media.', atributo: 'tecnica', puntos: 3 * fa('tecnica') });
    else if (mpp > meta * 0.95) cerca.push({ icono: 'i-sube', titulo: `${coma(mpp)} m por palada (meta ${coma(meta)})`, detalle: 'Palada más larga, sin subir la cadencia.', atributo: 'tecnica', puntos: 3 * fa('tecnica') });
  }
  if (real.recuperacion >= 1) logros.push({ icono: 'i-corazon', titulo: 'Sesión de recuperación', atributo: 'recuperacion', puntos: real.recuperacion });
  const fino = (l) => l.map((x) => ({ ...x, puntos: Math.max(1, Math.round(x.puntos)) })).sort((a, b) => b.puntos - a.puntos).slice(0, 3);
  return { logros: fino(logros), cerca: fino(cerca) };
}

export const textoPuntos = (x) => `${x.puntos > 0 ? '+' : '−'}${Math.abs(x.puntos)} ${nombre(x.atributo)}`;
