// Planes: lista de entrenamientos, editor y hoja de detalle de un entrenamiento.
import { formatoSplit, formatoTiempo } from '../protocolo.js';
import { dibujarPerfil } from '../grafica.js';
import * as db from '../db.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as E from '../estadisticas.js';
import * as P from '../programa.js';
import { tarjetaSesion } from '../efectos.js';
import * as J from '../juego.js';
import * as B from '../base.js';
import * as C from '../consejos.js';
import * as Cap from '../capacidades.js';
import * as A from '../adaptacion.js';
import { $, ajustes, descargar, escaparHtml, fcMaxima, ftp, ico, marcaFecha, miles, toast } from '../ui.js';
import { estado } from '../estado.js';
import { irA, vistaActiva } from '../navegacion.js';
import { avanzado, cerrarTripulacion } from './ajustes.js';
import { cerrarModoRemo, vistaPrevia } from './vivo.js';
import { cerrarFin, paraPerfil } from './sesion.js';
import { formatoRecord, pintarHistorial } from './progreso.js';
import { chipsAtr, estadoHeroe, opcConsejos, previsionDe } from './heroe.js';
import { esDePlan, guardarPrograma, leerPrograma, pintarPrograma } from './programa.js';
import { cerrarGuia } from './ayuda.js';

// ---------- Editor de entrenamientos ----------
// ---------- Planes: entrenamientos base (según tu nivel) y los tuyos ----------
// Recalcula los base para tu condición y tu FTP de ahora.
async function actualizarBase() {
  const { h } = await estadoHeroe();
  const sesiones = await H.sesiones();
  estado.condicionBase = B.condicionDe(sesiones, ftp());
  estado.baseActual = B.entrenamientosBase(h.nivel, ftp(), { condicion: estado.condicionBase });
  return h;
}
// Entrenamiento por el valor del selector: «base:…» se genera, un número se lee de la base de datos.
export async function obtenerEnt(valor) {
  if (!valor) return null;
  if (B.esBase(valor)) {
    if (!estado.baseActual.length) await actualizarBase();
    return estado.baseActual.find((x) => x.id === valor) || null;
  }
  return (await db.obtener('entrenamientos', Number(valor))) || null;
}
// Tus entrenamientos guardados, sin las copias de las pruebas (las pruebas ya están entre los base).
const propios = (lista) => lista.filter((x) => !B.NOMBRES_PRUEBA.has(x.nombre));

const SECCIONES_ENT = [...P.GRUPOS_ENT.map((g) => ({ clave: g.clave, nombre: g.clave === 'distancia' ? 'Distancia' : g.clave === 'tecnica' ? 'Paladas' : g.nombre })), { clave: 'mios', nombre: 'Míos' }];

export function usarEnt(ent) {
  ajustes.escribir('eleccionDia', E.claveDia(Date.now()));
  $('#sel-entrenamiento').value = String(ent.id);
  ajustes.escribir('ultimoEnt', String(ent.id));
  ajustes.escribir('modoEnt', 'objetivo');
  irA('entrenar');
  vistaPrevia();
  toast(`${ent.nombre} listo para entrenar`);
}
// Copia editable de un entrenamiento base.
function copiarBase(ent) {
  const copia = structuredClone(ent);
  for (const k of ['id', 'base', 'escalon', 'resumen', 'proposito', 'dificultad', 'prueba', 'pruebaFtp']) delete copia[k];
  copia.nombre = `${ent.nombre} (mío)`;
  abrirEditor(copia);
}

export async function pintarEntrenamientos() {
  pintarPrograma();
  const pestana = ajustes.leer('pestanaPlanes', 'entrenamientos');
  document.querySelectorAll('.planes-pestanas [data-pt]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pt === pestana)));
  $('#pt-entrenamientos').hidden = pestana !== 'entrenamientos';
  $('#pt-programa').hidden = pestana !== 'programa';
  const h = await actualizarBase();
  const lista = propios(await db.listar('entrenamientos'));
  const sesiones = await H.sesiones();
  const o = opcConsejos(h, sesiones);
  // «Quiero subir…»: con un atributo elegido, los entrenamientos se ordenan por lo que lo suben.
  const subir = ajustes.leer('subirAtr', '');
  $('#subir-atr').innerHTML = [['', 'Todo'], ...J.ATRIBUTOS.map((a) => [a.clave, a.nombre])]
    .map(([k, n]) => `<button type="button" class="chip" data-subir="${k}" aria-pressed="${k === subir}">${n}${k && k === o.debil ? ' <span class="punto-bajo" title="Tu atributo más bajo">•</span>' : ''}</button>`).join('');
  for (const id of ['#secciones-etq', '#secciones-ent', '#base-nivel', '#base-tarjetas', '.mios-cabecera', '#lista-ent']) document.querySelector(id).hidden = !!subir;
  $('#subir-lista').hidden = !subir;
  if (subir) { pintarSubir(subir, h, o, lista); await llenarSelectorEntrenamientos(); return; }
  const seccion = ajustes.leer('seccionEnt', 'potencia');
  $('#secciones-ent').innerHTML = SECCIONES_ENT.map((x) => `<button type="button" class="chip" data-sec="${x.clave}" aria-pressed="${x.clave === seccion}">${x.nombre}</button>`).join('');
  // Tarjetas base de la sección
  const bases = estado.baseActual.filter((x) => x.enfoque === seccion);
  $('#base-nivel').hidden = seccion === 'mios' || seccion === 'pruebas';
  $('#base-nivel').textContent = avanzado()
    ? `Ajustados a tu condición ${estado.condicionBase || 0} (${B.TEXTO_CONDICION[B.escalonDeCondicion(estado.condicionBase || 0)]}): crecen cuando entrenas con constancia y bajan si lo dejas un tiempo.`
    : 'Ajustados a tu forma de las últimas semanas: crecen cuando entrenas con constancia y bajan si lo dejas un tiempo.';
  $('#base-tarjetas').innerHTML = bases.map((x) => `<article class="base-tarjeta ${x.dificultad || 'prueba'}" data-ver="${x.id}">
      ${x.dificultad ? `<span class="dif">${B.nombreDificultad(x.dificultad)}</span>` : ''}<button type="button" class="base-nombre" data-ver="${x.id}" aria-label="Ver detalles de ${escaparHtml(x.nombre)}">${escaparHtml(x.nombre)}<span aria-hidden="true">›</span></button>
      <p class="base-resumen">${B.resumenEnt(x)}</p><p class="base-para">${x.proposito}</p>
      ${chipsAtr(previsionDe(x, o)?.seguro || {}, o.debil, 3)}
      <div class="base-acciones"><button type="button" class="boton" data-usar="${x.id}">Entrenar</button>
      <button type="button" class="boton chico" data-copiar="${x.id}">Copiar y editar</button></div></article>`).join('');
  // Tus entrenamientos: los de la sección, o todos en «Míos»
  const mios = seccion === 'mios' ? lista : lista.filter((x) => P.enfoqueDe(x) === seccion);
  $('#mios-titulo').textContent = seccion === 'mios' ? 'Tus entrenamientos' : `Tus entrenamientos de ${SECCIONES_ENT.find((x) => x.clave === seccion).nombre.toLowerCase()}`;
  // Los que arma un plan no se listan aquí (cambian cada semana y llenarían la lista): están en Programa.
  const prog = leerPrograma();
  const tuyos = mios.filter((x) => !x.dePlan);
  const ul = $('#lista-ent');
  const fila = (x) => `<li data-id="${x.id}">
      <div class="info clic" role="button" tabindex="0" data-ver="${x.id}" aria-label="Ver detalles de ${escaparHtml(x.nombre)}"><div class="titulo">${escaparHtml(x.nombre)}</div><div class="suave">${escaparHtml(B.resumenEnt(x))}</div></div>
      <details class="menu-fila"><summary class="boton icono chico" aria-label="Opciones de ${escaparHtml(x.nombre)}">⋯</summary>
        <div class="menu-fila-caja"><button type="button" data-a="editar">${ico('i-editar')} Editar</button><button type="button" data-a="duplicar">${ico('i-copiar')} Duplicar</button>
        <button type="button" data-a="borrar" class="peligro">${ico('i-borrar')} Borrar</button></div></details></li>`;
  const vacio = `<li class="vacio">${seccion === 'mios' ? 'Aún no has creado entrenamientos.' : 'Aún no tienes entrenamientos propios aquí.'} Toca «+ Nuevo» o «Copiar y editar» en uno base.</li>`;
  ul.innerHTML = (tuyos.length ? tuyos.map(fila).join('') : vacio)
    + (prog ? '<li class="separador-plan"><button type="button" class="enlace-boton" id="btn-ver-del-plan">Las sesiones de tu plan están en Programa ›</button></li>' : '');
  await llenarSelectorEntrenamientos();
}

// Ranking de entrenamientos para un atributo (base y tuyos), con lo que suben y cómo sumar más.
function pintarSubir(clave, h, o, lista) {
  const a = J.ATRIBUTOS.find((x) => x.clave === clave);
  const ents = [...estado.baseActual, ...lista.filter((x) => !esDePlan(x))];
  const mejores = C.mejoresPara(clave, ents, o).slice(0, 5);
  const valor = h.atributos[clave] || 0;
  // El título mira el acumulado; el valor que se ve, las últimas 6 semanas.
  const tit = J.tituloAtributo(clave, h.atributosTotal?.[clave] ?? valor);
  const intro = `<p class="ayuda">Tu ${a.nombre} va en <b>${miles(valor)}</b> en las últimas 6 semanas${clave === o.debil ? ': es tu atributo más bajo' : ''}.${tit.siguiente ? ` Con ${miles(tit.siguiente.faltan)} más serás <b>${tit.siguiente.nombre}</b>.` : ''}</p>`;
  const nota = clave === 'recuperacion'
    ? `<p class="aviso suave-aviso">Recuperación no sube apretando: rema suave (media por debajo de ${Math.round(o.ftp * 0.75)} W), descansa el día después de uno duro${h.contexto?.sinPulso ? ' o usa banda de pulso para que cuenten tus descansos' : ''}.</p>` : '';
  const tarjeta = (x, i) => {
    const { ent, p } = x;
    const extra = x.si || p.extras.find((e) => e.atributo === clave);
    return `<article class="base-tarjeta subir-tarjeta ${escaparHtml(ent.dificultad || 'prueba')}" data-ver="${ent.id}">
      ${i === 0 && !x.si ? `<span class="dif mejor">El mejor para ${a.nombre}</span>` : ''}
      <div class="subir-fila"><button type="button" class="base-nombre" data-ver="${ent.id}" aria-label="Ver detalles de ${escaparHtml(ent.nombre)}">${escaparHtml(ent.nombre)}</button>
        <span class="subir-pts"><b>+${p.seguro[clave] || x.si.puntos}</b><small>${x.si ? 'si lo logras' : a.nombre}</small></span></div>
      <p class="base-resumen">${escaparHtml(B.resumenEnt(ent))}</p>
      ${chipsAtr(p.seguro, clave, 4)}
      ${extra ? `<p class="subir-extra">${ico(extra.icono)}<span>${escaparHtml(extra.titulo)}: <b>${C.textoPuntos(extra)}</b></span></p>` : ''}
      <div class="base-acciones"><button type="button" class="boton primario" data-usar="${ent.id}">Entrenar</button></div></article>`;
  };
  $('#subir-lista').innerHTML = intro + nota + (mejores.length
    ? `<div class="base-tarjetas">${mejores.map(tarjeta).join('')}</div>`
    : `<p class="vacio">Ningún entrenamiento sube ${a.nombre} por sí solo. ${J.comoSubir(clave, o.ftp).join(' ')}</p>`);
}

// Al arrancar la app (en orden, desde app.js).
export function arrancarPlanes1() {
  $('#subir-atr').addEventListener('click', (e) => {
    const b = e.target.closest('[data-subir]');
    if (!b) return;
    ajustes.escribir('subirAtr', b.dataset.subir);
    pintarEntrenamientos();
  });

  document.querySelector('.planes-pestanas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pt]');
    if (!b) return;
    ajustes.escribir('pestanaPlanes', b.dataset.pt);
    $('#editor-ent').hidden = true;
    pintarEntrenamientos();
  });
  $('#secciones-ent').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sec]');
    if (!b) return;
    ajustes.escribir('seccionEnt', b.dataset.sec);
    pintarEntrenamientos();
  });
  $('#pt-entrenamientos').addEventListener('click', async (e) => {
    const usar = e.target.closest('[data-usar]');
    const copiar = e.target.closest('[data-copiar]');
    const accion = e.target.closest('[data-a]');
    if (copiar) { copiarBase(estado.baseActual.find((x) => x.id === copiar.dataset.copiar)); return; }
    if (accion) {
      const id = Number(accion.closest('li').dataset.id);
      const ent = await db.obtener('entrenamientos', id);
      accion.closest('details').open = false;
      if (accion.dataset.a === 'editar') abrirEditor(ent);
      if (accion.dataset.a === 'duplicar') {
        const copia = structuredClone(ent);
        delete copia.id;
        copia.nombre = await nombreLibre(ent.nombre);
        delete copia.dePlan;
        await db.guardar('entrenamientos', copia);
        toast('Entrenamiento duplicado');
        pintarEntrenamientos();
      }
      if (accion.dataset.a === 'borrar' && confirm(`¿Borrar «${ent.nombre}»?`)) { await db.borrar('entrenamientos', id); toast('Entrenamiento borrado'); pintarEntrenamientos(); }
      return;
    }
    if (usar) {
      const v = usar.dataset.usar;
      const ent = await obtenerEnt(v);
      if (ent) usarEnt(ent);
      return;
    }
    const ver = e.target.closest('[data-ver]');
    if (ver) {
      const ent = await obtenerEnt(ver.dataset.ver);
      if (ent) abrirDetalleEnt(ent);
    }
  });
  $('#lista-ent').addEventListener('click', (e) => {
    if (!e.target.closest('#btn-ver-del-plan')) return;
    ajustes.escribir('pestanaPlanes', 'programa');
    pintarEntrenamientos();
    window.scrollTo({ top: 0 });
  });
  $('#lista-ent').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-ver]')) { e.preventDefault(); e.target.click(); } });
  // Un solo menú «⋯» abierto a la vez.
  $('#lista-ent').addEventListener('toggle', (e) => {
    if (e.target.open) $('#lista-ent').querySelectorAll('details[open]').forEach((d) => { if (d !== e.target) d.open = false; });
  }, true);

  $('#btn-nuevo-ent').addEventListener('click', () => abrirEditor({
    tipo: 'objetivo', nombre: '', objetivo: { metrica: 'distancia', valor: 2000 }, bloques: [],
  }));
  $('#btn-cancelar-ent').addEventListener('click', () => { form.hidden = true; });
  form.tipo.addEventListener('change', mostrarTipo);
  form.obj_metrica.addEventListener('change', resumenEditor);
  form.obj_valor.addEventListener('input', resumenEditor);

  $('#btn-add-bloque').addEventListener('click', () => {
    const ultimo = enEdicion.bloques.at(-1);
    enEdicion.bloques.push({
      nombre: '', duracion: 60, metrica: ultimo?.metrica ?? 'watts', min: ultimo?.min || 120, max: ultimo?.max || 150,
    });
    pintarBloques();
  });
  $('#s-unidad').addEventListener('change', () => {
    const pct = $('#s-unidad').value === 'ftp';
    [['#s-wmin', 160, 91], ['#s-wmax', 190, 105], ['#s-dmin', '', 40], ['#s-dmax', '', 55]].forEach(([id, w, f]) => { $(id).value = pct ? f : w; });
  });
  $('#btn-add-serie').addEventListener('click', () => {
    const n = (id) => Number($(id).value) || 0;
    const reps = n('#s-reps');
    const trabajo = Ent.deMmss($('#s-trabajo').value);
    if (!reps || !trabajo) { $('#ent-error').textContent = 'Para la serie indica repeticiones y tiempo de trabajo.'; return; }
    $('#ent-error').textContent = '';
    const pct = $('#s-unidad').value === 'ftp';
    enEdicion.bloques.push(...Ent.serie({
      reps, trabajo, wMin: n('#s-wmin'), wMax: n('#s-wmax'),
      descanso: Ent.deMmss($('#s-descanso').value), dMin: n('#s-dmin'), dMax: n('#s-dmax'),
    }).map((b) => (pct && b.metrica ? { ...b, metrica: 'ftp' } : b)));
    $('#editor-intervalos details').open = false;
    pintarBloques();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = (txt, foco) => { $('#ent-error').textContent = txt; foco?.focus(); };
    enEdicion.nombre = form.nombre.value.trim();
    if (!enEdicion.nombre) { error('Ponle un nombre al entrenamiento.', form.nombre); return; }
    const todos = await db.listar('entrenamientos');
    if (todos.some((e) => e.nombre === enEdicion.nombre && e.id !== enEdicion.id) || B.NOMBRES_PRUEBA.has(enEdicion.nombre)) {
      error('Ya tienes un entrenamiento con ese nombre: elige otro para no mezclar sus sesiones y récords.', form.nombre);
      return;
    }
    // Al renombrar, las sesiones y el plan pasan al nombre nuevo (si quieres) para no partir tu historial en dos.
    const anterior = enEdicion.id != null ? todos.find((e) => e.id === enEdicion.id)?.nombre : null;
    const renombrar = anterior && anterior !== enEdicion.nombre
      ? (await H.sesiones()).filter((x) => x.entrenamiento === anterior) : [];
    enEdicion.tipo = form.tipo.value;
    if (enEdicion.tipo === 'objetivo') {
      const valor = Number(form.obj_valor.value);
      if (!(valor > 0)) { error('Indica la cantidad de la meta.', form.obj_valor); return; }
      enEdicion.objetivo = { metrica: form.obj_metrica.value, valor };
      delete enEdicion.bloques;
    } else {
      if (!enEdicion.bloques.length) { error('Agrega al menos un intervalo.'); return; }
      const malo = enEdicion.bloques.findIndex((b) => b.metrica && b.max && b.max < b.min);
      if (malo >= 0) { error(`En el intervalo ${malo + 1} el máximo es menor que el mínimo${enEdicion.bloques[malo].metrica === 'split' ? ' (en split, el mínimo es el ritmo más rápido)' : ''}.`); return; }
      const sinCantidad = enEdicion.bloques.findIndex((b) => !(Ent.cantidadDe(b) > 0));
      if (sinCantidad >= 0) { error(`Indica cuánto dura el intervalo ${sinCantidad + 1}.`); return; }
      delete enEdicion.objetivo;
    }
    $('#ent-error').textContent = '';
    if (renombrar.length && confirm(`Tienes ${renombrar.length} ${renombrar.length === 1 ? 'sesión' : 'sesiones'} de «${anterior}». ¿Pasarlas a «${enEdicion.nombre}» para que sigan juntas en tus récords y comparaciones?`)) {
      for (const x of renombrar) await H.actualizar(x.id, { entrenamiento: enEdicion.nombre });
    }
    const prog = anterior && leerPrograma();
    if (prog?.dias.some((d) => d.ent === anterior)) guardarPrograma({ ...prog, dias: prog.dias.map((d) => (d.ent === anterior ? { ...d, ent: enEdicion.nombre } : d)) });
    await db.guardar('entrenamientos', enEdicion);
    form.hidden = true;
    toast('Entrenamiento guardado');
    pintarEntrenamientos();
  });
}

export async function llenarSelectorEntrenamientos(lista) {
  const todos = lista || (await db.listar('entrenamientos'));
  lista = propios(todos);
  if (!estado.baseActual.length) await actualizarBase();
  const sesiones = await H.sesiones();
  const prog = leerPrograma();
  const sel = $('#sel-entrenamiento');
  const previo = sel.value || ajustes.leer('ultimoEnt', '');
  sel.length = 1;
  sel.querySelectorAll('optgroup').forEach((g) => g.remove());
  // Primero tu plan, solo lo de esta semana (con el día): las variantes de otras semanas no se listan.
  const semana = prog ? semanaDelPlan(prog, sesiones) : [];
  if (semana.length) {
    const og = document.createElement('optgroup');
    og.label = 'Tu plan esta semana';
    for (const d of semana) {
      const v = valorDe(d.ent, todos);
      if (v) og.append(new Option(`${d.diaCorto} · ${d.ent}${d.estado === 'hecho' ? ' ✓' : ''}`, v));
    }
    if (og.children.length) sel.append(og);
  }
  // Por sección: primero los base de tu nivel y luego los tuyos (sin los del plan).
  for (const g of P.GRUPOS_ENT) {
    const bases = estado.baseActual.filter((x) => x.enfoque === g.clave);
    const ents = lista.filter((ent) => P.enfoqueDe(ent) === g.clave && !ent.dePlan);
    if (!bases.length && !ents.length) continue;
    const og = document.createElement('optgroup');
    og.label = g.nombre;
    for (const x of bases) og.append(new Option(x.dificultad ? `${x.nombre} · ${B.nombreDificultad(x.dificultad)}` : x.nombre, x.id));
    for (const ent of ents) og.append(new Option(ent.nombre, ent.id));
    sel.append(og);
  }
  sel.value = previo;
  if (sel.value !== String(previo)) sel.value = '';
  // Al abrir la app (o al crear un plan), la sesión del día queda elegida: solo falta pulsar Empezar.
  // Si hoy ya elegiste otra cosa a mano, se respeta.
  if (estado.elegirLoDeHoy && !estado.sesion) {
    estado.elegirLoDeHoy = false;
    const dia = await calcularDia(sesiones, todos);
    const v = dia && ['plan', 'recuperar', 'sugerida'].includes(dia.fuente) ? (dia.id || valorDe(dia.ent, todos)) : null;
    if (v && ajustes.leer('eleccionDia', '') !== E.claveDia(Date.now()) && [...sel.options].some((o) => o.value === v)) {
      sel.value = v; ajustes.escribir('ultimoEnt', sel.value); ajustes.escribir('modoEnt', 'objetivo');
    }
  }
  vistaPrevia();
}
// Valor del selector para un entrenamiento por su nombre: las pruebas son las base; el resto, los guardados.
export function valorDe(nombre, todos = []) {
  if (!nombre) return null;
  const b = estado.baseActual.find((x) => x.enfoque === 'pruebas' && x.nombre === nombre);
  if (b) return b.id;
  const e = todos.find((x) => x.nombre === nombre);
  return e ? String(e.id) : null;
}
// Días del plan de la semana actual (de lunes a domingo), con su estado.
export function semanaDelPlan(prog, sesiones) {
  const lunes = E.claveDia(E.inicioPeriodo(Date.now(), 'semana'));
  const domingo = E.claveDia(E.inicioPeriodo(Date.now(), 'semana') + 6.5 * 864e5);
  return P.estadoDias(prog, sesiones).filter((d) => d.fecha >= lunes && d.fecha <= domingo)
    .map((d) => ({ ...d, diaCorto: new Date(`${d.fecha}T12:00`).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '') }));
}
// La sesión del día (ver adaptacion.js): lo que toca según tu plan o, sin plan, según tu semana y tu cuerpo.
export async function calcularDia(sesiones, todos) {
  sesiones ??= await H.sesiones();
  todos ??= await db.listar('entrenamientos');
  const f = ftp();
  return A.sesionDelDia({ programa: leerPrograma(), sesiones, entrenamientos: [...todos, ...estado.baseActual], ftp: f, cuerpo: f ? Cap.estadoCuerpo(sesiones, f) : null });
}

let enEdicion = null;
const form = $('#editor-ent');

// El nombre identifica al entrenamiento en tus sesiones y récords: no se repite.
// «Remo (copia)» → «Remo (copia 2)», sin encadenar «(copia) (copia)».
async function nombreLibre(nombre) {
  const usados = new Set((await db.listar('entrenamientos')).map((e) => e.nombre));
  const base = nombre.replace(/ \((copia|mío)( \d+)?\)$/, '');
  for (let n = 1; ; n++) {
    const candidato = `${base} (copia${n > 1 ? ` ${n}` : ''})`;
    if (!usados.has(candidato)) return candidato;
  }
}

function abrirEditor(ent) {
  enEdicion = structuredClone(ent);
  enEdicion.tipo = Ent.tipoDe(enEdicion);
  enEdicion.bloques = enEdicion.bloques || [];
  enEdicion.objetivo = enEdicion.objetivo || { metrica: 'distancia', valor: 2000 };
  $('#editor-titulo').textContent = ent.id ? 'Editar entrenamiento' : 'Nuevo entrenamiento';
  form.nombre.value = enEdicion.nombre;
  form.tipo.value = enEdicion.tipo;
  form.obj_metrica.value = enEdicion.objetivo.metrica;
  form.obj_valor.value = enEdicion.objetivo.valor;
  $('#ent-error').textContent = '';
  form.hidden = false;
  mostrarTipo();
  pintarBloques();
  form.scrollIntoView({ behavior: 'smooth' });
}

function mostrarTipo() {
  enEdicion.tipo = form.tipo.value;
  $('#editor-objetivo').hidden = enEdicion.tipo !== 'objetivo';
  $('#editor-intervalos').hidden = enEdicion.tipo !== 'intervalos';
  if (enEdicion.tipo === 'intervalos' && !enEdicion.bloques.length) {
    enEdicion.bloques.push({ nombre: 'Calentamiento', duracion: 300, metrica: 'watts', min: 80, max: 120 });
    pintarBloques();
  }
  resumenEditor();
}

// Rangos razonables para lo que se escribe en un intervalo; fuera de ellos el valor no se acepta.
const LIMITES_META = { watts: [1, 2000], ftp: [1, 300], split: [60, 600], spm: [10, 60], fc: [40, 230], fcpct: [30, 110] };
const LIMITES_CANTIDAD = { tiempo: [5, 10800], distancia: [10, 100000], paladas: [1, 10000] };

function pintarBloques() {
  const cont = $('#bloques');
  cont.innerHTML = '';
  const bloques = enEdicion.bloques;
  bloques.forEach((b, i) => {
    const fila = document.createElement('div');
    fila.className = 'fila-bloque';
    fila.innerHTML = `
      <div class="nombre-bloque"><b>${i + 1}</b><input data-k="nombre" placeholder="Nombre del intervalo" aria-label="Nombre del intervalo ${i + 1}" maxlength="30"></div>
      <label><span class="mini">Termina por</span><select data-k="fin">
        <option value="tiempo">Tiempo</option><option value="distancia">Distancia</option><option value="paladas">Paladas</option>
      </select></label>
      <label><span class="mini etq-cantidad"></span><input data-k="cantidad" inputmode="numeric"></label>
      <label><span class="mini">Meta</span><select data-k="metrica">
        <option value="watts">Potencia (W)</option><option value="ftp">% de FTP</option><option value="split">Split (/500 m)</option><option value="spm">Golpes/min</option><option value="fc">Pulso (lpm)</option><option value="fcpct">% pulso máx</option><option value="">Libre</option>
      </select></label>
      <label><span class="mini">Rango <span class="unidad"></span></span><span class="par" style="margin:0"><input data-k="min" type="number" inputmode="numeric" placeholder="mín" aria-label="Mínimo"><input data-k="max" type="number" inputmode="numeric" placeholder="máx" aria-label="Máximo"></span></label>
      <label><span class="mini">Nivel (opcional)</span><input data-k="nivel" type="number" min="1" max="24" inputmode="numeric" placeholder="1–24"></label>
      <div class="zonas" hidden></div>
      <div class="controles">
        <button type="button" class="boton icono chico" data-a="subir" aria-label="Mover arriba" ${i === 0 ? 'disabled' : ''}>${ico('i-sube')}</button>
        <button type="button" class="boton icono chico" data-a="bajar" aria-label="Mover abajo" ${i === bloques.length - 1 ? 'disabled' : ''}>${ico('i-baja')}</button>
        <button type="button" class="boton icono chico" data-a="duplicar" aria-label="Duplicar intervalo">${ico('i-copiar')}</button>
        <button type="button" class="boton icono chico peligro" data-a="quitar" aria-label="Quitar intervalo">${ico('i-borrar')}</button>
      </div>`;
    const q = (k) => fila.querySelector(`[data-k=${k}]`);
    q('nombre').value = b.nombre || '';
    const fin = Ent.finDe(b);
    q('fin').value = fin;
    fila.querySelector('.etq-cantidad').textContent = { tiempo: 'Tiempo (mm:ss)', distancia: 'Metros', paladas: 'Paladas' }[fin];
    q('cantidad').value = fin === 'tiempo' ? Ent.formatoMmss(b.duracion) : (b.cantidad || '');
    q('metrica').value = b.metrica || '';
    const esSplit = b.metrica === 'split';
    for (const k of ['min', 'max']) {
      q(k).type = esSplit ? 'text' : 'number';
      q(k).placeholder = esSplit ? (k === 'min' ? '2:00' : '2:10') : (k === 'min' ? 'mín' : 'máx');
      q(k).value = b[k] ? (esSplit ? Ent.formatoMmss(b[k]) : b[k]) : '';
    }
    q('nivel').value = b.nivel || '';
    const unidadYZonas = () => {
      const m = b.metrica;
      fila.querySelector('.unidad').textContent = { watts: '(W)', ftp: '(% FTP)', split: '(mm:ss, rápido–lento)', spm: '(golpes/min)', fc: '(lpm)', fcpct: '(% pulso máx)' }[m] || '';
      q('min').disabled = !m;
      q('max').disabled = !m;
      const zonas = fila.querySelector('.zonas');
      zonas.hidden = m !== 'ftp';
      if (m === 'ftp') {
        const r = Ent.rangoWatts(b, ftp());
        zonas.innerHTML = Ent.ZONAS.map((z) => `<button type="button" data-z="${z.n}" title="${z.nombre}">Z${z.n}</button>`).join('')
          + `<span class="mini" style="align-self:center;margin-left:4px">${r ? `= ${r.min}–${r.max} W` : 'Define tu FTP en Ajustes'}</span>`;
        zonas.querySelectorAll('[data-z]').forEach((btn) => {
          btn.onclick = () => {
            const z = Ent.ZONAS[btn.dataset.z - 1];
            b.min = z.min; b.max = z.max;
            if (!b.nombre) b.nombre = `Zona ${z.n}`;
            pintarBloques();
          };
        });
      }
    };
    unidadYZonas();
    fila.addEventListener('change', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      const rechazar = (txt) => { $('#ent-error').textContent = `Intervalo ${i + 1}: ${txt}`; toast($('#ent-error').textContent, 4500); pintarBloques(); };
      if (k === 'cantidad') {
        const fin = Ent.finDe(b);
        const texto = e.target.value.trim();
        const v = fin === 'tiempo' ? (/^\d+(:\d{1,2})?$/.test(texto) ? Ent.deMmss(texto) : NaN) : Math.round(Number(texto));
        const [lo, hi] = LIMITES_CANTIDAD[fin];
        if (!(v >= lo && v <= hi)) {
          rechazar(fin === 'tiempo' ? `escribe el tiempo como mm:ss, de ${formatoTiempo(lo)} a ${formatoTiempo(hi)}.` : `escribe de ${miles(lo)} a ${miles(hi)} ${fin === 'distancia' ? 'metros' : 'paladas'}.`);
          return;
        }
        if (fin === 'tiempo') b.duracion = v; else b.cantidad = v;
      } else if (k === 'fin') {
        b.fin = e.target.value;
        if (b.fin === 'tiempo') { delete b.fin; delete b.cantidad; b.duracion = b.duracion || 60; } else {
          b.cantidad = b.fin === 'distancia' ? 500 : 50;
          b.duracion = 0;
        }
        pintarBloques();
        return;
      } else if (k === 'min' || k === 'max') {
        const texto = e.target.value.trim();
        const v = texto === '' ? 0 : b.metrica === 'split' ? (/^\d+:\d{1,2}$/.test(texto) ? Ent.deMmss(texto) : NaN) : Number(texto);
        const [lo, hi] = LIMITES_META[b.metrica] || [0, Infinity];
        if (v !== 0 && !(v >= lo && v <= hi)) {
          rechazar(b.metrica === 'split' ? `el split va de ${Ent.formatoMmss(lo)} a ${Ent.formatoMmss(hi)} (mm:ss).` : `el ${k === 'min' ? 'mínimo' : 'máximo'} va de ${lo} a ${hi}.`);
          return;
        }
        b[k] = Math.round(v);
      } else if (k === 'nivel') {
        const n = Math.round(Number(e.target.value));
        if (n >= 1 && n <= 24) b.nivel = n; else delete b.nivel;
      } else b[k] = e.target.value;
      if (k === 'metrica') {
        if (b.metrica === 'ftp' && (b.min > 200 || !b.min)) { b.min = 56; b.max = 75; }
        if (b.metrica === 'split') { b.min = 120; b.max = 130; }
        if (b.metrica === 'spm') { b.min = 22; b.max = 26; }
        if (b.metrica === 'fc') { b.min = 130; b.max = 150; }
        if (b.metrica === 'fcpct') { b.min = 60; b.max = 70; }
        pintarBloques();
        return;
      }
      if (k === 'min' || k === 'max') unidadYZonas();
      $('#ent-error').textContent = '';
      resumenEditor();
    });
    fila.querySelector('[data-a=subir]').onclick = () => { [bloques[i - 1], bloques[i]] = [bloques[i], bloques[i - 1]]; pintarBloques(); };
    fila.querySelector('[data-a=bajar]').onclick = () => { [bloques[i + 1], bloques[i]] = [bloques[i], bloques[i + 1]]; pintarBloques(); };
    fila.querySelector('[data-a=duplicar]').onclick = () => { bloques.splice(i + 1, 0, structuredClone(b)); pintarBloques(); };
    fila.querySelector('[data-a=quitar]').onclick = () => { bloques.splice(i, 1); pintarBloques(); };
    cont.append(fila);
  });
  resumenEditor();
}

function resumenEditor() {
  if (!enEdicion) return;
  if (form.tipo.value === 'intervalos') dibujarPerfil($('#grafica-editor'), paraPerfil(enEdicion.bloques));
  if (form.tipo.value === 'objetivo') {
    const m = Ent.METRICAS_OBJETIVO[form.obj_metrica.value];
    $('#ent-resumen').textContent = `La sesión termina al llegar a ${form.obj_valor.value || '?'} ${m.unidad}.`;
  } else {
    $('#ent-resumen').textContent = `${enEdicion.bloques.length} intervalos · duración total ${Ent.soloTiempo(enEdicion) ? '' : 'estimada ≈ '}${formatoTiempo(Ent.duracionTotal(enEdicion))}`;
  }
}

// ---------- Detalle de un entrenamiento: qué es, para qué sirve y sus bloques ----------
let entDetalle = null;
// Bloques en filas cortas: las series repetidas («Umbral 1/3», «Suave», «Umbral 2/3»…) se juntan en «3 × …».
function filasBloques(bloques, f, fc) {
  const firma = (b) => b && [b.nombre?.replace(/\s*\d+\/\d+$/, ''), Ent.finDe(b), Ent.cantidadDe(b), b.metrica, b.min, b.max].join('|');
  const nombre = (b) => b.nombre?.replace(/\s*\d+\/\d+$/, '') || 'Intervalo';
  const texto = (b) => `${Ent.textoCantidad(b)}${nombre(b) === Ent.textoCantidad(b) ? '' : ` · ${escaparHtml(nombre(b))}`} <span class="suave">${b.metrica ? Ent.textoMeta(b, f, fc) : 'libre'}</span>`;
  const filas = [];
  for (let i = 0; i < bloques.length;) {
    const [a, d] = [bloques[i], bloques[i + 1]];
    // Patrón trabajo + descanso repetido; la última serie va sin descanso.
    let n = 1;
    if (d && firma(d) !== firma(a) && !/^(suave|descanso|recupera)/i.test(nombre(a))) while (firma(bloques[i + n * 2 - 1]) === firma(d) && firma(bloques[i + n * 2]) === firma(a)) n++;
    if (n > 1) {
      filas.push(`<li><b class="veces">${n} ×</b> ${texto(a)}<small class="entre">con ${texto(d)} entre series</small></li>`);
      i += n * 2 - 1;
      continue;
    }
    let k = 1;
    while (firma(bloques[i + k]) === firma(a)) k++;
    filas.push(`<li>${k > 1 ? `<b class="veces">${k} ×</b> ` : ''}${texto(a)}</li>`);
    i += k;
  }
  return filas.join('');
}
function abrirDetalleEnt(ent) {
  entDetalle = ent;
  const base = B.esBase(ent.id);
  const secc = SECCIONES_ENT.find((x) => x.clave === (ent.enfoque || P.enfoqueDe(ent)));
  $('#he-titulo').textContent = ent.nombre;
  $('#he-sub').innerHTML = [ent.dificultad ? `<span class="dif ${escaparHtml(ent.dificultad)}">${B.nombreDificultad(ent.dificultad)}</span>` : '', secc?.nombre, escaparHtml(B.resumenEnt(ent)), base ? '' : 'Tuyo'].filter(Boolean).join(' · ');
  $('#he-para').textContent = ent.proposito || (base ? '' : 'Entrenamiento que creaste tú.');
  $('#he-para').hidden = !$('#he-para').textContent;
  $('#he-editar').textContent = base ? 'Copiar y editar' : 'Editar';
  $('#hoja-ent').hidden = false;
  pintarBloquesEnt(ent, $('#he-perfil'), $('#he-bloques'), $('#he-leyenda'));
  $('#hoja-ent .hoja').focus();
}
// Leyenda del perfil: solo lo que aparece en este entrenamiento.
export function leyendaPerfil(bloques, conPotencia = false) {
  const conRango = bloques.some((b) => ['ftp', 'watts', 'split'].includes(b.metrica));
  const libres = bloques.some((b) => !['ftp', 'watts', 'split'].includes(b.metrica));
  const sinTiempo = bloques.some((b) => Ent.finDe(b) !== 'tiempo');
  return `${conRango ? '<span class="lr">Rango de potencia</span><span class="lf">Fuera de rango</span>' : ''}${libres ? '<span class="ll">Cualquier potencia</span>' : ''}${sinTiempo ? '<span class="ld">Sin tiempo fijo (≈)</span>' : ''}${conPotencia ? '<span class="lp">Tu potencia</span>' : ''}`;
}
// Perfil y bloques de un entrenamiento (en la hoja de detalle y en la tarjeta «Hoy»). El lienzo debe estar visible.
export function pintarBloquesEnt(ent, canvas, lista, leyenda) {
  const intervalos = Ent.tipoDe(ent) === 'intervalos';
  if (intervalos) lista.innerHTML = filasBloques(ent.bloques, ftp(), fcMaxima());
  else {
    const m = Ent.METRICAS_OBJETIVO[ent.objetivo.metrica];
    lista.innerHTML = `<li>Meta: <b>${miles(ent.objetivo.valor)} ${m.unidad}</b> <span class="suave">al ritmo que quieras; termina al llegar.</span></li>`;
  }
  canvas.hidden = !intervalos;
  leyenda.hidden = !intervalos;
  if (!intervalos) return;
  leyenda.innerHTML = leyendaPerfil(ent.bloques);
  dibujarPerfil(canvas, paraPerfil(ent.bloques));
}
function cerrarDetalleEnt() { $('#hoja-ent').hidden = true; entDetalle = null; }

// Al arrancar la app (en orden, desde app.js).
export function arrancarPlanes2() {
  $('#he-cerrar').addEventListener('click', cerrarDetalleEnt);
  $('#hoja-ent').addEventListener('click', (e) => { if (e.target === $('#hoja-ent')) cerrarDetalleEnt(); });
  $('#he-entrenar').addEventListener('click', () => { const ent = entDetalle; cerrarDetalleEnt(); usarEnt(ent); });
  $('#he-editar').addEventListener('click', () => {
    const ent = entDetalle;
    cerrarDetalleEnt();
    if (B.esBase(ent.id)) copiarBase(ent); else abrirEditor(ent);
  });
  $('#hoja-cerrar').addEventListener('click', cerrarHoja);
  $('#hoja').addEventListener('click', (e) => { if (e.target === $('#hoja')) cerrarHoja(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarLoDeEncima(); });

  // Botón Atrás de Android: cierra lo de encima o vuelve a Entrenar en vez de salir de la app.
  // Con una sesión en marcha nunca sale; sin ella, sale al pulsar Atrás dos veces seguidas.
  {
    let avisoSalir = 0;
    history.replaceState({ remadora: 'base' }, '');
    history.pushState({ remadora: 'guarda' }, '');
    window.addEventListener('popstate', () => {
      const bloqueo = !$('#inicio').hidden || !$('#recuperar-dialogo').hidden;
      if (!bloqueo && !cerrarLoDeEncima()) {
        if (!vistaActiva('entrenar')) irA('entrenar');
        else if (estado.sesion) toast('Sesión en marcha: termínala antes de salir');
        else if (Date.now() - avisoSalir > 2500) { avisoSalir = Date.now(); toast('Pulsa Atrás otra vez para salir', 2500); }
        else { history.back(); return; }
      }
      history.pushState({ remadora: 'guarda' }, '');
    });
  }

  $('#btn-borrar').addEventListener('click', async () => {
    if (estado.sesionAbierta && confirm('¿Borrar esta sesión?')) {
      await H.borrar(estado.sesionAbierta.id);
      toast('Sesión borrada');
      cerrarHoja();
    }
  });
  $('#btn-compartir-img').addEventListener('click', async (ev) => {
    const s = estado.sesionAbierta;
    if (!s) return;
    const boton = ev.currentTarget;
    boton.disabled = true;
    const f = new Date(s.fecha);
    const stats = [['Distancia', `${miles(s.distancia)} m`], ['Tiempo', formatoTiempo(s.duracion)], ['Split prom', formatoSplit(s.splitProm)],
      ['Watts prom', `${s.wattsProm} W`], ['Golpes/min', s.spmProm], [s.fcProm ? 'Pulso prom' : 'Calorías', s.fcProm ? `${s.fcProm} lpm` : s.kcal]];
    const rivales = s.rivales || (s.rival ? [s.rival] : []);
    const recs = E.nuevosRecords(s, (estado.cacheSesiones || []).filter((x) => x.id !== s.id && x.fecha < s.fecha));
    const extra = recs.length ? `Récord: ${recs[0].nombre} ${formatoRecord(recs[0], recs[0].valor)}`
      : rivales.length ? rivales.map((r) => `${r.diferencia > 0 ? '+' : ''}${r.diferencia} m vs. ${r.nombre.replace(/^Fantasma /, '')}`).join(' · ') : '';
    try {
      const blob = await tarjetaSesion({
        titulo: s.entrenamiento || 'Remo libre',
        fecha: f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        stats, extra, puntos: (s.muestras || []).map((x) => [x.t, x.w]),
      });
      const nombre = `rower-${marcaFecha(s.fecha)}.png`;
      const archivo = new File([blob], nombre, { type: 'image/png' });
      if (navigator.canShare?.({ files: [archivo] })) await navigator.share({ files: [archivo], title: 'Mi sesión en Rower' });
      else descargar(nombre, blob, 'image/png');
    } catch (err) {
      if (err.name !== 'AbortError') toast('No se pudo crear la imagen');
    } finally { boton.disabled = false; }
  });

  $('#btn-csv').addEventListener('click', () => {
    const s = estado.sesionAbierta;
    const filas = ['segundo,watts,golpes_min,split_s_500m,distancia_m,nivel,pulso'];
    for (const x of s.muestras) filas.push([x.t, x.w, x.spm, x.split, x.dist, x.nivel, x.fc].join(','));
    descargar(`remo-${marcaFecha(s.fecha)}.csv`, filas.join('\n'), 'text/csv');
  });
  $('#btn-tcx').addEventListener('click', () => {
    const s = estado.sesionAbierta;
    const iso = (t) => new Date(s.fecha + t * 1000).toISOString();
    const puntos = s.muestras.map((x) => `<Trackpoint><Time>${iso(x.t)}</Time><DistanceMeters>${x.dist}</DistanceMeters>${x.fc ? `<HeartRateBpm><Value>${x.fc}</Value></HeartRateBpm>` : ''}<Cadence>${x.spm}</Cadence><Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Watts>${x.w}</Watts></TPX></Extensions></Trackpoint>`).join('');
    const tcx = `<?xml version="1.0" encoding="UTF-8"?>
  <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Other"><Id>${iso(0)}</Id><Lap StartTime="${iso(0)}"><TotalTimeSeconds>${s.duracion}</TotalTimeSeconds><DistanceMeters>${s.distancia}</DistanceMeters><Calories>${s.kcal}</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${puntos}</Track></Lap><Notes>Remo indoor</Notes></Activity></Activities></TrainingCenterDatabase>`;
    descargar(`remo-${marcaFecha(s.fecha)}.tcx`, tcx, 'application/vnd.garmin.tcx+xml');
  });
}

export function cerrarHoja() {
  $('#hoja').hidden = true;
  if (vistaActiva('historial')) pintarHistorial();
}
// Cierra lo que esté encima (detalle, hoja, modo remo). Devuelve false si no había nada abierto.
function cerrarLoDeEncima() {
  if (!$('#fin-dialogo').hidden) cerrarFin();
  else if (!$('#guia').hidden) cerrarGuia();
  else if (!$('#hoja-trip').hidden) cerrarTripulacion();
  else if (!$('#hoja-ent').hidden) cerrarDetalleEnt();
  else if (!$('#hoja').hidden) cerrarHoja();
  else if (!$('#modo-remo').hidden) cerrarModoRemo();
  else return false;
  return true;
}
