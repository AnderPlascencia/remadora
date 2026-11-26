// Adaptación automática del plan: revisa tus sesiones y cambia el plan sin preguntar.
// Cada cambio deja una frase en programa.avisos para explicarlo en la pantalla Hoy.
// Sin dependencias de la interfaz: recibe el plan y devuelve el plan nuevo.
import * as E from './estadisticas.js';
import { estadoDias, repartirSemana, semanaFlexible, sesionDeVuelta, sesionFondo, semanaDe, TIPOS_DUROS } from './programa.js';
import { tipoPlan, tipoSesion, piernasRecientes } from './capacidades.js';
import { espaldaCargadaHasta } from './pulso.js';

const DIA = 864e5;
const DURO = TIPOS_DUROS;
const FACTOR_MIN = 0.85;
const FACTOR_MAX = 1.15;
// E-4: lo que más carga la espalda baja: fuerza a cadencia baja (≤ 20 paladas/min) y sprints con la resistencia de la
// consola en 12 o más.
export const cargaLumbar = (ent) => (ent?.bloques || []).some((b) => (b.spmMeta && b.spmMeta[1] <= 20) || (b.nivel >= 12 && b.min >= 120));
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

// ---------- Protocolo de regreso (etapa 14) ----------
// Días sin remar hasta hoy (por día de calendario, sin contar hoy) y qué tramo de vuelta toca: 5 a 9 días, la
// primera sesión al 80 %; 10 a 20, una semana de vuelta al 65 % con los rangos un 5 % más bajos; 21 o más, rehacer
// el plan desde hoy. Sin reproches: se dice «bienvenido de vuelta» y nada de lo perdido.
export const REGRESO = { corto: 5, medio: 10, largo: 21 };
export const VUELTA = { corto: { k: 0.8, rangos: 1 }, medio: { k: 0.65, rangos: 0.95 } };
export function diasFuera(sesiones, ahora = Date.now()) {
  const hoy = E.claveDia(ahora);
  const antes = sesiones.filter((s) => E.claveDia(s.fecha) < hoy);
  if (!antes.length) return null;
  const ultima = E.claveDia(Math.max(...antes.map((s) => s.fecha)));
  return Math.round((new Date(`${hoy}T12:00`) - new Date(`${ultima}T12:00`)) / DIA) - 1;
}
export const tramoRegreso = (dias) => (dias == null ? null : dias >= REGRESO.largo ? 'largo' : dias >= REGRESO.medio ? 'medio' : dias >= REGRESO.corto ? 'corto' : null);
export function textoRegreso(tramo, dias) {
  if (tramo === 'corto') return `Bienvenido de vuelta. Tu primera sesión va al 80 % para retomar con buen pie.`;
  if (tramo === 'medio') return `Bienvenido de vuelta tras ${dias} días. Esta semana va al 65 % y con los rangos un 5 % más bajos: así el cuerpo se pone al día sin lesiones.`;
  if (tramo === 'largo') return `Bienvenido de vuelta tras ${dias} días. Lo mejor es rehacer el plan desde hoy, que empiece a tu nivel de ahora.`;
  return '';
}

// Revisa el plan. Devuelve { programa, entrenamientos, avisos } con lo que cambió, o null si no cambió nada.
// entrenamientos: los guardados (para saber qué toca cada día); los nuevos que haga falta crear vuelven en la respuesta.
// cuerpo: el estado de hoy (estadoCuerpo), con lo que respondiste antes de remar y la variabilidad del pulso.
// previo: tus respuestas de antes de remar con las molestias de los últimos días (previoHoy), o null.
export function revisarPlan({ programa, sesiones, entrenamientos = [], ftp = 0, cuerpo = null, previo = null, ahora = Date.now() }) {
  if (!programa?.dias?.length) return null;
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const revision = `${E.claveDia(ahora)}:${orden.length}${cuerpo?.motivos?.length ? `:${cuerpo.clave}` : ''}${espaldaCargadaHasta(previo?.dolores, new Date(ahora)) ? ':espalda' : ''}`;
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
  // Hecha hoy o ya otro día de su semana (los días del plan son una sugerencia).
  const hechoHoy = diaHoy && estadoDias(p, orden, ahora)[p.dias.indexOf(diaHoy)].estado === 'hecho';

  // 1. Cansancio: frescura muy baja, carga disparada o mala recuperación de pulso → hoy fondo suave en vez de duro.
  if (diaHoy && !hechoHoy && DURO.has(tipoDe(diaHoy.ent))) {
    const forma = ftp ? E.forma(orden, ftp, 1, ahora).at(-1) : null;
    const ratio = ftp ? E.ratioCarga(orden, ftp, ahora) : null;
    const rec = recuperacionComparada(orden, ftp);
    const recMala = rec && rec.ultima.fecha > ahora - 2 * DIA && rec.ultima.fcRec60 < 0.8 * rec.media;
    let motivo = null;
    const avisado = cuerpo?.motivos?.length && ['cargado', 'agotado'].includes(cuerpo.clave);
    if (avisado) motivo = cuerpo.motivos[0];
    // El mismo umbral que «Agotado» en el estado del cuerpo: condición menos fatiga de hoy, por debajo de −25
    // (antes era la frescura de ayer bajo −30, y Hoy y el plan podían decir cosas distintas el mismo día).
    else if (forma && forma.condicion >= 10 && forma.condicion - forma.fatiga < -25) motivo = `Vienes muy cansado (frescura ${forma.condicion - forma.fatiga})`;
    else if (ratio != null && ratio > 1.5) motivo = 'Tu carga de esta semana se disparó';
    else if (recMala) motivo = 'Tu pulso tardó más de lo normal en bajar la última vez';
    if (motivo) {
      const min = avisado && cuerpo.clave === 'agotado' ? 20 : 30;
      cambiarDia(diaHoy, sesionFondo(min, { pulso: true }), `${motivo}: cambié «${diaHoy.ent}» por un fondo muy suave de ${min} min${min === 20 ? ', o descansa' : ''}.`);
    }
  }

  // 1b. E-4 (E14): piernas cansadas al final de la última sesión → la próxima de fuerza o sprints, un fondo.
  // E15: molestia de espalda 2 días o más en la semana → 7 días sin fuerza a cadencia baja ni sprints pesados.
  const estados = estadoDias(p, orden, ahora);
  const pendiente = (d) => d.fecha >= hoy && estados[p.dias.indexOf(d)]?.estado !== 'hecho';
  const piernas = piernasRecientes(orden, ahora);
  if (piernas && p.piernasDe !== piernas.fecha) {
    p.piernasDe = piernas.fecha;
    const prox = p.dias.find((d) => pendiente(d) && (cargaLumbar(porNombre(d.ent)) || tipoDe(d.ent) === 'sprint'));
    if (prox && prox.fecha <= E.claveDia(ahora + 2 * DIA)) cambiarDia(prox, sesionFondo(30), `Tus piernas acabaron cansadas en tu última sesión: cambié «${prox.ent}» por un fondo de 30 min.`);
  }
  const espalda = espaldaCargadaHasta(previo?.dolores, new Date(ahora));
  if (espalda) {
    const cambiar = p.dias.filter((d) => pendiente(d) && d.fecha < espalda && cargaLumbar(porNombre(d.ent)));
    for (const d of cambiar) { d.original ??= d.ent; const f = sesionFondo(30); if (!porNombre(f.nombre)) nuevos.push(f); d.ent = f.nombre; }
    if (cambiar.length) avisos.push(`Tuviste molestias de espalda varios días: hasta el ${espalda.slice(8)}/${espalda.slice(5, 7)}, las sesiones de fuerza a cadencia baja y los sprints pasan a fondos de 30 min.`);
  }

  // 2. Cumplimiento de las sesiones duras: dos seguidas por debajo del rango bajan los rangos un 3 %;
  //    dos fáciles (en rango casi siempre, o por encima con poco esfuerzo) los suben. Ir por encima no es fallar.
  const duras = orden.filter((s) => s.pctEnRango != null && DURO.has(tipoSesion(s, ftp)) && s.fecha >= new Date(`${p.inicio}T00:00`).getTime());
  const [a, b] = duras.slice(-2);
  if (a && b && recientes.includes(b)) {
    const ratio = ftp ? E.ratioCarga(orden, ftp, ahora) : null;
    const cargaOk = ratio == null || ratio <= 1.3;
    // Solo cuenta el esfuerzo que diste tú: sin él (o con solo el del pulso) no se suben los rangos.
    const facil = (E.rpeSentido(b) ?? 10) <= 6;
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

  // 4. (Ya no se mueven sesiones perdidas a otro día: la semana es flexible y la sesión del día ofrece lo que
  //    falte de la semana cuando encaja; ver sesionDelDia.)

  // 5. Semana floja (menos de la mitad de lo planeado): el resto del plan se corre una semana para repetirla.
  const lunes = E.inicioPeriodo(ahora, 'semana');
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

  // 6. Regreso tras un parón (una vez por parón): sesiones más ligeras o, tras 3 semanas, rehacer el plan. Va después
  //    de la semana floja, que ya alarga el plan repitiendo la semana: la que se repite es la que se aligera.
  const fuera = diasFuera(orden, ahora);
  const tramo = tramoRegreso(fuera);
  const ultimaAntes = orden.filter((s) => E.claveDia(s.fecha) < hoy).at(-1);
  if (tramo && ultimaAntes && p.regreso?.tras !== E.claveDia(ultimaAntes.fecha)) {
    p.regreso = { tras: E.claveDia(ultimaAntes.fecha), dia: hoy, tramo, dias: fuera };
    const hasta = E.claveDia(ahora + 6 * DIA);
    const pendientes = estadoDias(p, orden, ahora).filter((d) => d.fecha >= hoy && d.estado !== 'hecho' && d.ent && !/^Prueba/.test(d.ent) && !/ · vuelta$/.test(d.ent));
    const cuales = tramo === 'corto' ? pendientes.slice(0, 1) : tramo === 'medio' ? pendientes.filter((d) => d.fecha <= hasta) : [];
    for (const d of cuales) {
      const v = porNombre(d.ent) && sesionDeVuelta(porNombre(d.ent), VUELTA[tramo].k, VUELTA[tramo].rangos);
      const dia = v && p.dias.find((x) => x.fecha === d.fecha && x.ent === d.ent);
      if (!dia) continue;
      if (!porNombre(v.nombre)) nuevos.push(v);
      dia.original ??= dia.ent;
      dia.ent = v.nombre;
    }
    // Tras 3 semanas o más lo dice la sugerencia de Hoy, con el botón para rehacer el plan.
    if (tramo === 'largo') p.proponerRehacer = hoy; else avisos.push(textoRegreso(tramo, fuera));
  }

  if (avisos.length) p.avisos = [...(p.avisos || []), ...avisos.map((texto) => ({ dia: hoy, texto }))].slice(-10);
  return { programa: p, entrenamientos: nuevos, avisos, cambio: avisos.length > 0 || p.ultimaSesion !== programa.ultimaSesion };
}

// ---------- Sesión del día ----------
// Decide qué remar hoy. Con plan, manda la semana del plan, no el día: ofrece lo que falta de la semana en su orden
// (lo atrasado primero) si encaja con los días que quedan, sin juntar dos duras en días seguidos ni proponer una dura
// si vienes cargado. Si vas al día y hay margen, hoy se descansa y se puede adelantar la próxima (adelantar). Sin plan, elige de los entrenamientos base con un esquema
// sencillo: como mucho 2 sesiones duras por semana, nunca dos duras seguidas, un fondo largo cada semana y
// suave cuando vienes cargado.
// Devuelve { fuente, ent (nombre, con plan) o id (base, sin plan), motivo, alternativa? } o null.
//   fuente: 'plan' | 'hecho' | 'recuperar' | 'descanso' | 'terminado' | 'sugerida'
// cuerpo: el resultado de estadoCuerpo (capacidades.js), o null si no hay FTP o datos.
// jefe: sin plan, el jefe que lleva 2 semanas esperando (juego.jefeParaSugerir): la sugerida propone su prueba.
const DIA_SEM = (clave) => new Date(`${clave}T12:00`).toLocaleDateString('es-MX', { weekday: 'long' });
export function sesionDelDia({ programa, sesiones = [], entrenamientos = [], ftp = 0, cuerpo = null, jefe = null, ahora = Date.now() }) {
  const hoy = E.claveDia(ahora);
  const ayer = E.claveDia(ahora - DIA);
  const buscar = (n) => entrenamientos.find((e) => e.nombre === n);
  const duro = (n) => DURO.has(tipoPlan(buscar(n))) || /^Prueba/.test(n);
  const remadoHoy = sesiones.some((s) => E.claveDia(s.fecha) === hoy);
  // Dura por sus watts (con FTP) o porque era una sesión dura del plan (sin FTP no hay watts que medir).
  const ayerDuro = sesiones.some((s) => E.claveDia(s.fecha) === ayer && (DURO.has(tipoSesion(s, ftp)) || (!!s.entrenamiento && duro(s.entrenamiento))));
  const cansado = cuerpo && (cuerpo.clave === 'cargado' || cuerpo.clave === 'agotado');

  if (programa?.dias?.length) {
    // Los días del plan son una sugerencia: lo que cuenta es hacer las sesiones de la semana (ver estadoDias).
    const { dias, semana, pendientes, futuras, diasQuedan } = semanaFlexible(programa, sesiones, ahora);
    const sem = semanaDe(programa, ahora);
    const enSemana = sem.n >= 1 && sem.n <= sem.total ? `Semana ${sem.n} de ${sem.total}${sem.descarga ? ', de descarga: menos volumen para asimilar' : ''}` : '';
    const n = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`;
    const textoProx = (lista) => (lista.length ? `Próxima: ${lista[0].ent}${lista.length > 1 ? ` (te quedan ${lista.length} esta semana)` : ''}.`
      : futuras.length ? `Semana completa ✓. Próxima: ${futuras[0].ent}, desde el lunes.` : 'Era la última sesión del plan.');
    const hechaHoy = semana.find((d) => d.hechaEl === hoy);
    if (hechaHoy) return { fuente: 'hecho', ent: hechaHoy.ent, motivo: `Ya remaste lo de hoy. ${textoProx(pendientes)}` };
    if (!pendientes.length && !futuras.length) return { fuente: 'terminado', ent: null, motivo: '' };
    // Plan recién creado que arranca otro día y sin ninguna sesión todavía (recién salido de la bienvenida):
    // no dice «Hoy descansas», adelanta la primera sesión del plan, o un fondo suave si la primera es dura.
    const prox = dias.find((d) => d.fecha > hoy);
    if (!sesiones.length && prox && dias.every((x) => x.fecha > hoy)) {
      return duro(prox.ent)
        ? { fuente: 'sugerida', id: 'base:dis-suave', motivo: `Para empezar, un fondo suave y conoces la app. Tu plan arranca el ${DIA_SEM(prox.fecha)}.` }
        : { fuente: 'plan', ent: prox.ent, motivo: `Tu primera sesión: adelantas la del ${DIA_SEM(prox.fecha)} y el plan sigue igual.` };
    }
    if (remadoHoy) return { fuente: 'descanso', ent: null, motivo: `Hoy ya remaste. ${textoProx(pendientes)}` };
    if (!pendientes.length) return { fuente: 'descanso', ent: null, alternativa: 'base:dis-suave', motivo: `Hoy descansas: el cuerpo mejora mientras se recupera. ${textoProx(pendientes)}` };

    const r = repartirSemana(pendientes, diasQuedan, (d) => duro(d.ent), { ayerDura: ayerDuro, cansado });
    const margen = `Te ${pendientes.length === 1 ? 'queda' : 'quedan'} ${n(pendientes.length, 'sesión', 'sesiones')} en ${n(diasQuedan, 'día', 'días')}`;
    const fuera = r.fuera.length ? ` No caben todas sin juntar dos duras: ${r.fuera.map((d) => `«${d.ent}»`).join(' y ')} ${r.fuera.length === 1 ? 'se queda' : 'se quedan'} fuera esta semana.` : '';
    const d = r.hoy;
    // Vas al día y hay margen: hoy se descansa, pero puedes adelantar la próxima (los días son una sugerencia).
    if (d && d.fecha > hoy && r.descansoOk) {
      return {
        fuente: 'descanso', ent: null, alternativa: 'base:dis-suave', adelantar: d.ent,
        motivo: `Vas al día: hoy descansas. Si te apetece, adelanta «${d.ent}» (sugerida el ${DIA_SEM(d.fecha)}). ${margen}.${fuera}`,
      };
    }
    // Semana muy pareja (monotonía alta, etapa 27): si la de hoy es suave y la semana cabe igual, hoy se descansa.
    if (d && cuerpo?.monotonia && !duro(d.ent) && !d.atrasada && diasQuedan > pendientes.length) {
      return { fuente: 'descanso', ent: null, alternativa: 'base:dis-suave', motivo: `Tu semana fue muy pareja, sin días de descanso: hoy descansa y «${d.ent}» cabe otro día. ${margen}.${fuera}` };
    }
    if (d) {
      const rol = /^Prueba/.test(d.ent) ? 'Prueba: mide cuánto has mejorado'
        : duro(d.ent) ? 'La sesión clave de la semana: aquí se gana capacidad'
          : 'Suave: suma base aeróbica y te deja fresco para la próxima dura';
      const cuando = d.atrasada ? `Se quedó pendiente del ${DIA_SEM(d.fecha)}: hoy es buen día para hacerla. `
        : d.fecha > hoy ? `Adelantas la del ${DIA_SEM(d.fecha)}: así te cabe la semana. ` : '';
      return { fuente: d.atrasada ? 'recuperar' : 'plan', ent: d.ent, motivo: `${[rol, enSemana].filter(Boolean).join(' · ')}. ${cuando}${margen}.${fuera}` };
    }
    // Nada encaja hoy: lo que queda es duro y ayer fue duro, o vienes cargado.
    const saltada = r.quedan[0] || pendientes[0];
    const porque = cansado ? 'vienes cargado' : ayerDuro ? 'ayer fue dura' : 'hoy no encaja';
    return {
      fuente: 'descanso', ent: null, alternativa: 'base:dis-suave',
      motivo: `Te queda «${saltada.ent}», pero ${porque}: mejor no juntar dos duras. Hoy descansa o rema suave. ${margen}.${fuera}`,
    };
  }

  // Sin plan: un esquema sencillo con los entrenamientos base.
  if (!sesiones.length) return null;
  const sugerir = (id, motivo) => ({ fuente: 'sugerida', id, motivo });
  if (remadoHoy) return sugerir('base:dis-suave', 'Ya remaste hoy: si quieres más, que sea suave.');
  // De vuelta tras un parón: un fondo suave para retomar.
  const fueraSin = diasFuera(sesiones, ahora);
  if (tramoRegreso(fueraSin)) return sugerir('base:dis-suave', `Bienvenido de vuelta${fueraSin >= REGRESO.medio ? ` tras ${fueraSin} días` : ''}: hoy un fondo suave para retomar sin prisa.`);
  if (cuerpo?.clave === 'agotado') return sugerir('base:dis-suave', 'Vienes muy cargado: hoy descansa o rema 20 min muy suave.');
  if (cuerpo?.monotonia) return sugerir('base:dis-suave', 'Tu semana fue muy pareja, sin días de descanso: hoy descansa o rema 20 min muy suave.');
  if (ayerDuro) return sugerir('base:dis-suave', 'Ayer fue una sesión dura: hoy suave para asimilarla.');
  if (cansado) return sugerir('base:dis-suave', 'Vas cargado: hoy suave y la próxima dura te saldrá mejor.');
  if (jefe?.id) return sugerir(jefe.id, `Hoy, ${jefe.nombre}: lleva ${jefe.dias} días esperándote. Esta prueba lo vence y mide cuánto mejoraste.`);
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
