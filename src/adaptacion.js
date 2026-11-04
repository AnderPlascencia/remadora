// Adaptación automática del plan: revisa tus sesiones y cambia el plan sin preguntar.
// Cada cambio deja una frase en programa.avisos para explicarlo en la pantalla Hoy.
// Sin dependencias de la interfaz: recibe el plan y devuelve el plan nuevo.
import * as E from './estadisticas.js';
import { estadoDias, sesionFondo, semanaDe, TIPOS_DUROS } from './programa.js';
import { tipoPlan, tipoSesion } from './capacidades.js';

const DIA = 864e5;
const DURO = TIPOS_DUROS;
const FACTOR_MIN = 0.85;
const FACTOR_MAX = 1.15;
const media = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);

// Pulso y watts medios entre el minuto 4 y el 5 (todavía calentando).
export function pulsoCalentamiento(muestras) {
  const v = (muestras || []).filter((x) => x.t > 240 && x.t <= 300 && x.fc > 0 && x.w > 0);
  if (v.length < 45) return null;
  return { w: Math.round(media(v.map((x) => x.w))), fc: Math.round(media(v.map((x) => x.fc))) };
}

// Cuántos lpm más que de costumbre llevas en el calentamiento, a los mismos watts (±15 W).
// Hacen falta al menos 3 sesiones anteriores comparables; si no, null.
export function pulsoDeMas(muestras, previas) {
  const hoy = pulsoCalentamiento(muestras);
  if (!hoy) return null;
  const otras = previas.map((s) => pulsoCalentamiento(s.muestras)).filter((c) => c && Math.abs(c.w - hoy.w) <= 15);
  if (otras.length < 3) return null;
  return Math.round(hoy.fc - media(otras.map((c) => c.fc)));
}

// Recuperación de pulso de tu última sesión contra la media de las 5 anteriores del mismo tipo (fondo con fondo,
// series con series): tras un fondo el pulso baja menos que tras unas series, y mezclarlas daba falsas alarmas.
// Hacen falta 3 del mismo tipo; si no, null.
export function recuperacionComparada(sesiones, ftp = 0) {
  const recs = [...sesiones].filter((s) => s.fcRec60 != null).sort((a, b) => a.fecha - b.fecha);
  const ultima = recs.at(-1);
  if (!ultima) return null;
  // El tipo que guardó la sesión (el del plan) manda; si no lo tiene, se deduce de sus muestras.
  const tipoDe = (s) => s.tipoPlan || tipoSesion(s, ftp);
  const tipo = tipoDe(ultima);
  const iguales = recs.slice(0, -1).filter((s) => tipoDe(s) === tipo).slice(-5);
  if (iguales.length < 3) return null;
  return { ultima, tipo, media: Math.round(media(iguales.map((s) => s.fcRec60))), n: iguales.length };
}

// Una sesión dura que se quedó corta: menos del 60 % en rango y, de lo que quedó fuera, más por debajo que por encima.
// Las sesiones de antes de la v0.45 no separan bajo y alto: cuentan como antes (todo lo de fuera, por debajo).
export const corta = (s) => s.pctEnRango < 60 && !(s.pctAlto != null && s.pctAlto >= (s.pctBajo ?? 0));
// Una sesión dura que sobró: en rango más del 95 %, o un 25 % o más por encima del rango casi sin quedarse por debajo.
export const sobrada = (s) => s.pctEnRango > 95 || (s.pctAlto != null && s.pctAlto >= 25 && (s.pctBajo ?? 0) < 10);

// Revisa el plan. Devuelve { programa, entrenamientos, avisos } con lo que cambió, o null si no cambió nada.
// entrenamientos: los guardados (para saber qué toca cada día); los nuevos que haga falta crear vuelven en la respuesta.
// cuerpo: el estado de hoy (estadoCuerpo), con lo que respondiste antes de remar y la variabilidad del pulso.
export function revisarPlan({ programa, sesiones, entrenamientos = [], ftp = 0, cuerpo = null, ahora = Date.now() }) {
  if (!programa?.dias?.length) return null;
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const revision = `${E.claveDia(ahora)}:${orden.length}${cuerpo?.motivos?.length ? `:${cuerpo.clave}` : ''}`;
  if (programa.revision === revision) return null;
  const p = structuredClone(programa);
  p.revision = revision;
  p.factor ??= 1;
  p.extraFondo ??= 0;
  const nuevos = [];
  const avisos = [];
  const hoy = E.claveDia(ahora);
  const porNombre = (n) => entrenamientos.find((e) => e.nombre === n) || nuevos.find((e) => e.nombre === n);
  const tipoDe = (n) => tipoPlan(porNombre(n)) || (/^Fondo|^Quema/.test(n) ? 'fondo' : null);
  const cambiarDia = (dia, ent, motivo) => {
    if (!porNombre(ent.nombre)) nuevos.push(ent);
    dia.original ??= dia.ent;
    dia.ent = ent.nombre;
    avisos.push(motivo);
  };
  // Sesiones nuevas desde la última revisión: cada regla de cumplimiento las cuenta una sola vez.
  const ultima = p.ultimaSesion || 0;
  const recientes = orden.filter((s) => s.fecha > ultima);
  if (orden.length) p.ultimaSesion = orden.at(-1).fecha;
  const diaHoy = p.dias.find((d) => d.fecha === hoy);
  const hechoHoy = diaHoy && orden.some((s) => E.claveDia(s.fecha) === hoy && s.entrenamiento === diaHoy.ent);

  // 1. Cansancio: frescura muy baja, carga disparada o mala recuperación de pulso → hoy fondo suave en vez de duro.
  if (diaHoy && !hechoHoy && DURO.has(tipoDe(diaHoy.ent))) {
    const forma = ftp ? E.forma(orden, ftp, 1, ahora).at(-1) : null;
    const ratio = ftp ? E.ratioCarga(orden, ftp, ahora) : null;
    const rec = recuperacionComparada(orden, ftp);
    const recMala = rec && rec.ultima.fecha > ahora - 2 * DIA && rec.ultima.fcRec60 < 0.8 * rec.media;
    let motivo = null;
    const avisado = cuerpo?.motivos?.length && ['cargado', 'agotado'].includes(cuerpo.clave);
    if (avisado) motivo = cuerpo.motivos[0];
    else if (forma && forma.condicion >= 10 && forma.frescura < -30) motivo = `Vienes muy cansado (frescura ${forma.frescura})`;
    else if (ratio != null && ratio > 1.5) motivo = 'Tu carga de esta semana se disparó';
    else if (recMala) motivo = 'Tu pulso tardó más de lo normal en bajar la última vez';
    if (motivo) {
      const min = avisado && cuerpo.clave === 'agotado' ? 20 : 30;
      cambiarDia(diaHoy, sesionFondo(min, { pulso: true }), `${motivo}: cambié «${diaHoy.ent}» por un fondo muy suave de ${min} min${min === 20 ? ', o descansa' : ''}.`);
    }
  }

  // 2. Cumplimiento de las sesiones duras: dos seguidas por debajo del rango bajan los rangos un 3 %;
  //    dos fáciles (en rango casi siempre, o por encima con poco esfuerzo) los suben. Ir por encima no es fallar.
  const duras = orden.filter((s) => s.pctEnRango != null && DURO.has(tipoSesion(s, ftp)) && s.fecha >= new Date(`${p.inicio}T00:00`).getTime());
  const [a, b] = duras.slice(-2);
  if (a && b && recientes.includes(b)) {
    const ratio = ftp ? E.ratioCarga(orden, ftp, ahora) : null;
    const cargaOk = ratio == null || ratio <= 1.3;
    const facil = (b.rpe ?? 10) <= 6;
    if (corta(a) && corta(b) && p.factor > FACTOR_MIN) {
      p.factor = Math.max(FACTOR_MIN, Math.round(p.factor * 0.97 * 100) / 100);
      avisos.push('Dos sesiones fuertes seguidas te quedaste por debajo del rango: bajé tus rangos un 3 %.');
    } else if (facil && cargaOk && p.factor < FACTOR_MAX && sobrada(a) && sobrada(b)) {
      p.factor = Math.min(FACTOR_MAX, Math.round(p.factor * 1.03 * 100) / 100);
      avisos.push(a.pctEnRango > 95 && b.pctEnRango > 95
        ? 'Tus dos últimas sesiones fuertes fueron fáciles: subí tus rangos un 3 %.'
        : 'Tus dos últimas sesiones fuertes fueron por encima del rango y con poco esfuerzo: subí tus rangos un 3 %.');
    }
  }

  // 3. Base aeróbica: dos fondos seguidos con desacople bajo el 5 % en un tramo estable de 40 min o más
  //    → el próximo fondo dura 10 min más. Un desacople de 20 min no basta: casi nadie se despega tan pronto.
  const fondos = orden.filter((s) => s.desacople != null && (s.desacopleSeg ?? s.duracion ?? 0) >= E.DESACOPLE_FONDO_LARGO && tipoSesion(s, ftp) === 'fondo');
  const [f1, f2] = fondos.slice(-2);
  if (f1 && f2 && recientes.includes(f2) && f1.desacople < 5 && f2.desacople < 5 && p.extraFondo < 30) {
    const prox = p.dias.find((d) => d.fecha > hoy && /^Fondo (\d+) min/.test(d.ent) && !d.alargado);
    if (prox) {
      const min = Number(prox.ent.match(/^Fondo (\d+) min/)[1]) + 10;
      p.extraFondo += 10;
      prox.alargado = true;
      cambiarDia(prox, sesionFondo(min, { pulso: /pulso/.test(prox.ent) }), `Tu motor aeróbico va sobrado (desacople bajo el 5 %): tu próximo fondo dura ${min} min.`);
    }
  }

  // 4. Sesión dura perdida en los últimos 3 días: pasa a hoy si hoy toca fondo o descanso y ayer no fue duro.
  const estados = estadoDias(p, orden, ahora);
  const perdida = p.dias.filter((d, i) => estados[i].estado === 'perdido' && d.fecha >= E.claveDia(ahora - 3 * DIA) && !d.movido && DURO.has(tipoDe(d.ent))).at(-1);
  const ayerDuro = orden.some((s) => E.claveDia(s.fecha) === E.claveDia(ahora - DIA) && DURO.has(tipoSesion(s, ftp)));
  const hoyLibre = !diaHoy || (!hechoHoy && !DURO.has(tipoDe(diaHoy.ent)) && !avisos.length);
  if (perdida && hoyLibre && !ayerDuro && !orden.some((s) => E.claveDia(s.fecha) === hoy)) {
    perdida.movido = true;
    if (diaHoy) { diaHoy.original ??= diaHoy.ent; diaHoy.ent = perdida.ent; }
    else p.dias.push({ fecha: hoy, ent: perdida.ent, original: null });
    p.dias.sort((x, y) => (x.fecha < y.fecha ? -1 : 1));
    avisos.push(`No remaste «${perdida.ent}» el ${new Date(`${perdida.fecha}T12:00`).toLocaleDateString('es-MX', { weekday: 'long' })}: la pasé a hoy${diaHoy ? ' en lugar del fondo' : ''}.`);
  }

  // 5. Semana floja (menos de la mitad de lo planeado): el resto del plan se corre una semana para repetirla.
  const lunes = E.inicioPeriodo(ahora, 'semana');
  // Se recalcula: el paso 4 puede haber añadido o reordenado días.
  const semanaPasada = estadoDias(p, orden, ahora).map((d) => [d, d.estado]).filter(([d]) => { const t = new Date(`${d.fecha}T12:00`).getTime(); return t >= lunes - 7 * DIA && t < lunes; });
  const claveSemana = E.claveDia(lunes);
  if (semanaPasada.length >= 2 && p.repetida !== claveSemana && new Date(`${p.inicio}T12:00`).getTime() < lunes - 7 * DIA) {
    const hechas = semanaPasada.filter(([, e]) => e === 'hecho').length;
    if (hechas < semanaPasada.length / 2) {
      p.repetida = claveSemana;
      const repetir = semanaPasada.map(([d]) => ({ fecha: E.claveDia(new Date(`${d.fecha}T12:00`).getTime() + 7 * DIA), ent: d.ent, repetido: true }));
      for (const d of p.dias) if (d.fecha >= claveSemana) d.fecha = E.claveDia(new Date(`${d.fecha}T12:00`).getTime() + 7 * DIA);
      p.dias.push(...repetir);
      p.dias.sort((x, y) => (x.fecha < y.fecha ? -1 : 1));
      avisos.push(`La semana pasada hiciste ${hechas} de ${semanaPasada.length} sesiones: la repites esta semana y el plan termina una semana después.`);
    }
  }

  if (avisos.length) p.avisos = [...(p.avisos || []), ...avisos.map((texto) => ({ dia: hoy, texto }))].slice(-10);
  return { programa: p, entrenamientos: nuevos, avisos, cambio: avisos.length > 0 || p.ultimaSesion !== programa.ultimaSesion };
}

// ---------- Sesión del día ----------
// Decide qué remar hoy. Con plan, manda el plan: la sesión de hoy, o en un día libre una sesión de esta semana
// que se quedó sin hacer (si no junta dos duras). Sin plan, elige de los entrenamientos base con un esquema
// sencillo: como mucho 2 sesiones duras por semana, nunca dos duras seguidas, un fondo largo cada semana y
// suave cuando vienes cargado.
// Devuelve { fuente, ent (nombre, con plan) o id (base, sin plan), motivo, alternativa? } o null.
//   fuente: 'plan' | 'hecho' | 'recuperar' | 'descanso' | 'terminado' | 'sugerida'
// cuerpo: el resultado de estadoCuerpo (capacidades.js), o null si no hay FTP o datos.
const DIA_SEM = (clave) => new Date(`${clave}T12:00`).toLocaleDateString('es-MX', { weekday: 'long' });
export function sesionDelDia({ programa, sesiones = [], entrenamientos = [], ftp = 0, cuerpo = null, ahora = Date.now() }) {
  const hoy = E.claveDia(ahora);
  const ayer = E.claveDia(ahora - DIA);
  const manana = E.claveDia(ahora + DIA);
  const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
  const duro = (n) => DURO.has(tipoPlan(buscar(n))) || /^Prueba/.test(n);
  const remadoHoy = sesiones.some((s) => E.claveDia(s.fecha) === hoy);
  const ayerDuro = sesiones.some((s) => E.claveDia(s.fecha) === ayer && DURO.has(tipoSesion(s, ftp)));
  const cansado = cuerpo && (cuerpo.clave === 'cargado' || cuerpo.clave === 'agotado');

  if (programa?.dias?.length) {
    const dias = estadoDias(programa, sesiones, ahora);
    const diaHoy = dias.find((d) => d.fecha === hoy);
    const prox = dias.find((d) => d.fecha > hoy);
    const textoProx = prox ? `Próxima: ${prox.ent} (${DIA_SEM(prox.fecha)}).` : 'Era la última sesión del plan.';
    const sem = semanaDe(programa, ahora);
    const enSemana = sem.n >= 1 && sem.n <= sem.total ? `Semana ${sem.n} de ${sem.total}${sem.descarga ? ', de descarga: menos volumen para asimilar' : ''}` : '';
    if (diaHoy) {
      if (diaHoy.estado === 'hecho') return { fuente: 'hecho', ent: diaHoy.ent, motivo: `Ya remaste lo de hoy. ${textoProx}` };
      const rol = /^Prueba/.test(diaHoy.ent) ? 'Prueba: mide cuánto has mejorado'
        : duro(diaHoy.ent) ? 'La sesión clave de la semana: aquí se gana capacidad'
          : 'Suave: suma base aeróbica y te deja fresco para la próxima dura';
      return { fuente: 'plan', ent: diaHoy.ent, motivo: [rol, enSemana].filter(Boolean).join(' · ') };
    }
    if (!prox) return { fuente: 'terminado', ent: null, motivo: '' };
    // Plan recién creado que arranca otro día y sin ninguna sesión todavía (recién salido de la bienvenida):
    // no dice «Hoy descansas», adelanta la primera sesión del plan, o un fondo suave si la primera es dura.
    if (!sesiones.length && dias.every((x) => x.fecha > hoy)) {
      return duro(prox.ent)
        ? { fuente: 'sugerida', id: 'base:dis-suave', motivo: `Para empezar, un fondo suave y conoces la app. Tu plan arranca el ${DIA_SEM(prox.fecha)}.` }
        : { fuente: 'plan', ent: prox.ent, motivo: `Tu primera sesión: adelantas la del ${DIA_SEM(prox.fecha)} y el plan sigue igual.` };
    }
    if (remadoHoy) return { fuente: 'descanso', ent: null, motivo: `Hoy ya remaste. ${textoProx}` };
    // Sesiones de esta semana que no se hicieron (ni otro día): la más importante primero.
    const lunes = E.claveDia(E.inicioPeriodo(ahora, 'semana'));
    const hechas = new Set(sesiones.map((s) => s.entrenamiento));
    const pendientes = dias.filter((d) => d.estado === 'perdido' && d.fecha >= lunes && !d.movido && !hechas.has(d.ent))
      .sort((a, b) => Number(duro(b.ent)) - Number(duro(a.ent)) || (a.fecha < b.fecha ? 1 : -1));
    const mananaDuro = prox.fecha === manana && duro(prox.ent);
    for (const d of pendientes) {
      if (duro(d.ent) && (ayerDuro || mananaDuro || cansado)) continue;
      return { fuente: 'recuperar', ent: d.ent, motivo: `Se quedó sin hacer el ${DIA_SEM(d.fecha)}: hoy es buen día para recuperarla. ${textoProx}` };
    }
    const saltada = pendientes[0];
    const porque = saltada ? (mananaDuro ? 'mañana toca otra dura' : ayerDuro ? 'ayer fue dura' : 'vienes cargado') : '';
    return {
      fuente: 'descanso', ent: null, alternativa: 'base:dis-suave',
      motivo: saltada
        ? `Te quedó «${saltada.ent}», pero ${porque}: mejor no juntar dos duras. Hoy descansa o rema suave. ${textoProx}`
        : `Hoy descansas: el cuerpo mejora mientras se recupera. ${textoProx}`,
    };
  }

  // Sin plan: un esquema sencillo con los entrenamientos base.
  if (!sesiones.length) return null;
  const sugerir = (id, motivo) => ({ fuente: 'sugerida', id, motivo });
  if (remadoHoy) return sugerir('base:dis-suave', 'Ya remaste hoy: si quieres más, que sea suave.');
  if (cuerpo?.clave === 'agotado') return sugerir('base:dis-suave', 'Vienes muy cargado: hoy descansa o rema 20 min muy suave.');
  if (ayerDuro) return sugerir('base:dis-suave', 'Ayer fue una sesión dura: hoy suave para asimilarla.');
  if (cansado) return sugerir('base:dis-suave', 'Vas cargado: hoy suave y la próxima dura te saldrá mejor.');
  const semana = sesiones.filter((s) => s.fecha > ahora - 7 * DIA);
  const duras = semana.filter((s) => DURO.has(tipoSesion(s, ftp)));
  if (duras.length >= 2) return sugerir('base:dis-mant', `Ya llevas ${duras.length} sesiones duras en 7 días: hoy fondo (lo ideal es 80 % suave y 20 % duro).`);
  const fondoLargo = semana.some((s) => !DURO.has(tipoSesion(s, ftp)) && (s.duracion || 0) >= 40 * 60);
  if (semana.length >= 2 && !fondoLargo) return sugerir('base:dis-mejora', 'Esta semana aún no haces un fondo largo: es lo que más sube tu base.');
  const ultimaDura = [...sesiones].sort((a, b) => b.fecha - a.fecha).find((s) => DURO.has(tipoSesion(s, ftp)));
  const id = ultimaDura && tipoSesion(ultimaDura, ftp) === 'vo2' ? 'base:pot-mant' : 'base:pot-mejora';
  return sugerir(id, 'Estás descansado: buen día para una sesión fuerte.');
}

// Entrenamientos que dejó un plan y que el plan de ahora ya no usa (para borrarlos y no llenar tu lista).
export function sobrantesDePlan(programa, entrenamientos) {
  const usados = new Set((programa?.dias || []).flatMap((d) => [d.ent, d.original]).filter(Boolean));
  return entrenamientos.filter((e) => e.dePlan && !usados.has(e.nombre));
}
