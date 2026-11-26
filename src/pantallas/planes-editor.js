// Editor de entrenamientos de Planes (nuevo, editar, copiar uno base). Sale de planes.js (ronda 2, etapa 10) para no
// pesar en la primera carga: se importa la primera vez que abres el editor.
import { formatoTiempo } from '../protocolo.js';
import { dibujarPerfil } from '../grafica.js';
import * as db from '../db.js';
import * as H from '../historial.js';
import * as Ent from '../entrenamientos.js';
import * as B from '../base.js';
import { $, ftp, ico, miles, toast } from '../ui.js';
import { paraPerfil } from './sesion.js';
import { guardarPrograma, leerPrograma } from './programa.js';
import { pintarEntrenamientos } from './planes.js';

// Los botones del editor se conectan una sola vez, la primera vez que se abre.
let escuchando = false;
function escuchar() {
  if (escuchando) return;
  escuchando = true;
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
      ? (await H.sinMuestras()).filter((x) => x.entrenamiento === anterior) : [];
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

let enEdicion = null;
const form = $('#editor-ent');

export function abrirEditor(ent) {
  escuchar();
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
