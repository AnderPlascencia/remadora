// @ts-check
// Plan de meta (E-2, E7): tras la prueba de mitad, las zonas que quedan se rehacen desde tu marca real (no desde el
// split de partida) y los rangos vuelven al 100 % (el ajuste de antes era sobre las zonas viejas). Se carga solo con
// un plan de meta que todavía no lo hizo (revisarPlanAuto), fuera de la primera carga.
import * as E from './estadisticas.js';
import { ref2kDe } from './programa.js';
import { formatoMmss as mm } from './entrenamientos.js';

const DIA = 864e5;

// Las zonas de una sesión de meta con otra referencia: todo bloque en split escala con ella, salvo las series a
// ritmo de la meta (las de fin por distancia), que siguen al ritmo que buscas.
export function rehacerZonas(e, ref, nombre = e.nombre) {
  const k = ref / e.splitMeta;
  const bloques = e.bloques.map((b) => (b.metrica === 'split' && b.min > 0 && b.fin !== 'distancia'
    ? { ...b, min: Math.round(b.min * k), max: Math.round(b.max * k) } : { ...b }));
  return { ...e, nombre, splitMeta: ref, bloques };
}

// → { programa, entrenamientos (nuevos), avisos } o null si no toca (sin prueba de mitad remada, o ya hecho).
export function zonasTrasPrueba({ programa, sesiones = [], entrenamientos = [], ahora = Date.now() }) {
  if (!programa?.meta || programa.zonasDesde || !programa.dias?.length) return null;
  const orden = [...sesiones].sort((a, b) => a.fecha - b.fecha);
  const ultimoDia = programa.dias.at(-1).fecha;
  const mitad = programa.dias.find((d) => /^Prueba/.test(d.ent || '') && d.fecha < ultimoDia);
  if (!mitad) return null;
  const desde = new Date(`${programa.inicio}T00:00`).getTime();
  // La de mitad, remada como mucho una semana después de su día (la final se llama igual).
  const hasta = E.claveDia(new Date(`${mitad.fecha}T12:00`).getTime() + 7 * DIA);
  const prueba = orden.filter((s) => s.entrenamiento === mitad.ent && s.fecha >= desde && E.claveDia(s.fecha) <= hasta && E.claveDia(s.fecha) < ultimoDia).at(-1);
  const t = prueba && E.mejorTiempoDe(prueba, programa.meta.distancia);
  if (!(t > 0)) return null;
  const p = structuredClone(programa);
  const dia = E.claveDia(prueba.fecha);
  p.zonasDesde = dia;
  const ref = ref2kDe(p.meta.distancia, t, E.perfilDe(orden, { ahora }));
  const nuevos = [];
  const porNombre = (n) => entrenamientos.find((e) => e.nombre === n) || nuevos.find((e) => e.nombre === n);
  let cambiadas = 0;
  for (const d of p.dias) {
    const e = d.fecha > dia && d.ent && !/^Prueba/.test(d.ent) ? porNombre(d.ent) : null;
    if (!(e?.splitMeta > 0) || Math.abs(ref - e.splitMeta) < 2) continue;
    // El split del nombre también cambia (salvo en las series a ritmo de la meta).
    const k = ref / e.splitMeta;
    const base = /^Ritmo/.test(d.ent) ? d.ent : d.ent.replace(/\b(\d{1,2}):(\d\d)\b/g, (_, a, b) => mm(Math.round((Number(a) * 60 + Number(b)) * k)));
    const nombre = `${base} · tras la prueba`;
    if (!porNombre(nombre)) nuevos.push(rehacerZonas(e, ref, nombre));
    d.original ??= d.ent;
    d.ent = nombre;
    cambiadas++;
  }
  const avisos = [];
  if (cambiadas) {
    p.factor = 1;
    avisos.push(`Tu prueba de mitad dio ${mm(t)}: rehíce las zonas de lo que queda del plan desde esa marca (${mm(ref)} el 500 m de referencia).`);
    p.avisos = [...(p.avisos || []), ...avisos.map((texto) => ({ dia: E.claveDia(ahora), texto }))].slice(-10);
  }
  return { programa: p, entrenamientos: nuevos, avisos };
}
