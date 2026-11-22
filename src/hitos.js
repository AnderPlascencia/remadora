// El hito de una sesión (etapa 21, F8 y T3): el momento que vale la pena compartir y su propia tarjeta.
// Orden de importancia: jefe vencido > plan completo > subida de rango > semana del plan completa > récord >
// fantasma ganado por poco. Las sesiones normales no tienen hito: siguen con el botón de siempre, sin insistir.
import { estadoDias, lunesDe } from './programa.js';
import { claveDia } from './estadisticas.js';

export const POR_POCO_M = 25; // ganarle a un fantasma por menos de esto es un final de foto

// Plan completo y semana completa con esta sesión: se compara el plan antes y después de contarla.
// Devuelve { plan: { semanas, tira } | null, semana: { n, de } | null }. tira: lo hecho de cada semana (0 a 1).
export function hitosDelPlan(programa, previas, s) {
  const vacio = { plan: null, semana: null };
  if (!programa?.dias?.length || !s?.entrenamiento) return vacio;
  const ahora = s.fecha;
  const antes = estadoDias(programa, previas.filter((x) => x.fecha < s.fecha), ahora).filter((d) => !d.movido);
  const despues = estadoDias(programa, [...previas.filter((x) => x.fecha < s.fecha), s], ahora).filter((d) => !d.movido);
  const hechas = (l) => l.filter((d) => d.estado === 'hecho').length;
  if (hechas(despues) === hechas(antes)) return vacio; // esta sesión no era del plan
  const lunes = [...new Set(despues.map((d) => lunesDe(d.fecha)))].sort();
  const pendientes = despues.filter((d) => d.estado === 'hoy' || d.estado === 'pendiente').length;
  const plan = pendientes === 0 ? {
    semanas: lunes.length,
    tira: lunes.map((l) => { const sem = despues.filter((d) => lunesDe(d.fecha) === l); return sem.length ? hechas(sem) / sem.length : 0; }),
  } : null;
  const l = lunesDe(claveDia(s.fecha));
  const semDespues = despues.filter((d) => lunesDe(d.fecha) === l);
  const semAntes = antes.filter((d) => lunesDe(d.fecha) === l);
  const semana = semDespues.length && hechas(semDespues) === semDespues.length && hechas(semAntes) < semAntes.length
    ? { n: lunes.indexOf(l) + 1, de: lunes.length } : null;
  return { plan, semana };
}

// datos: { jefe: { nombre, premio }, rango: { nombre }, plan: { semanas, tira, nombre }, semana: { n, de },
// records: nuevosRecords (con anterior), rivales: [{ nombre, diferencia }] }.
// Devuelve { clave, kicker, texto, boton, tira? } o null. kicker va en la tarjeta; boton, en el resumen.
export function hitoDe(datos = {}) {
  const { jefe, rango, plan, semana, records = [], rivales = [] } = datos;
  if (jefe) return { clave: 'jefe', kicker: '¡JEFE VENCIDO!', texto: `${jefe.nombre} cae${jefe.premio ? ` · ${jefe.premio}` : ''}`, boton: `¡Venciste a ${jefe.nombre}! Compártelo` };
  if (plan) return { clave: 'plan', kicker: 'PLAN COMPLETO', texto: `${plan.semanas} semanas${plan.nombre ? ` de ${plan.nombre}` : ''}, de principio a fin`, boton: '¡Terminaste tu plan! Compártelo', tira: plan.tira };
  if (rango) return { clave: 'rango', kicker: 'NUEVO RANGO', texto: `Ahora es ${rango.nombre}`, boton: `¡Ahora eres ${rango.nombre}! Compártelo` };
  if (semana) return { clave: 'semana', kicker: 'SEMANA COMPLETA', texto: `Semana ${semana.n} de ${semana.de} del plan, sin faltar una`, boton: '¡Semana del plan completa! Compártela' };
  const r = records.find((x) => x.anterior != null && x.clave !== 'wmax');
  if (r) return { clave: 'record', kicker: 'RÉCORD PERSONAL', texto: '', boton: '¡Nuevo récord! Compártelo' };
  const pocos = rivales.filter((x) => Number.isFinite(x.diferencia) && x.diferencia > 0 && x.diferencia <= POR_POCO_M);
  if (pocos.length && rivales.every((x) => !Number.isFinite(x.diferencia) || x.diferencia > 0)) {
    const m = Math.min(...pocos.map((x) => x.diferencia));
    const quien = pocos.find((x) => x.diferencia === m).nombre.replace(/^Fantasma /, '').replace(/ \(.*\)$/, '');
    return { clave: 'fantasma', kicker: 'POR UN PELO', texto: `Le ganó a ${quien} por ${m} m`, boton: `¡Le ganaste a ${quien} por ${m} m! Compártelo` };
  }
  return null;
}
