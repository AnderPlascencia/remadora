// Guía rápida y consejos de la primera visita a cada pestaña.
import * as G from '../guia.js';
import { $, ajustes, ico, toast } from '../ui.js';
import { estado } from '../estado.js';
import { irA } from '../navegacion.js';
import { abrirInicio } from './inicio.js';

// ---------- Guía rápida y consejos de la primera visita a cada pestaña ----------
const NOMBRE_VISTA = { entrenar: 'Entrenar', entrenamientos: 'Planes', heroe: 'Héroe', historial: 'Progreso', ajustes: 'Ajustes' };
let temaGuia = G.TEMAS[0].clave;
function pintarGuia() {
  const t = G.tema(temaGuia) || G.TEMAS[0];
  const i = G.TEMAS.indexOf(t);
  const sig = G.TEMAS[i + 1];
  $('#guia-chips').innerHTML = G.TEMAS.map((x) => `<button type="button" class="chip" role="tab" data-tema="${x.clave}" aria-pressed="${x === t}" aria-selected="${x === t}">${x.titulo}</button>`).join('');
  $('#guia-lista').innerHTML = `<article class="guia-tema">
    <div class="guia-cab">${ico(t.icono)}<div><h3>${t.titulo}</h3><p>${t.resumen}</p></div></div>
    <ul>${t.puntos.map((x) => `<li>${x}</li>`).join('')}</ul>
    <div class="fila-botones">
      <button type="button" class="boton" data-ir="${t.vista}">Ir a ${NOMBRE_VISTA[t.vista]}</button>
      ${sig ? `<button type="button" class="boton primario" data-tema="${sig.clave}">Siguiente: ${sig.titulo}</button>` : '<button type="button" class="boton primario" data-fin>Entendido</button>'}
    </div>
    <p class="guia-pie">${i + 1} de ${G.TEMAS.length}</p>
  </article>`;
  $('#guia-chips [aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function abrirGuia(clave = G.TEMAS[0].clave) {
  temaGuia = clave;
  pintarGuia();
  $('#guia').hidden = false;
  $('#guia .hoja').focus();
}
export function cerrarGuia() { $('#guia').hidden = true; }

// Al arrancar la app (en orden, desde app.js).
export function arrancarAyuda() {
  $('#guia').addEventListener('click', (e) => {
    if (e.target === $('#guia') || e.target.closest('#guia-cerrar, [data-fin]')) { cerrarGuia(); return; }
    const t = e.target.closest('[data-tema]');
    if (t) { temaGuia = t.dataset.tema; pintarGuia(); $('#guia .hoja').scrollTop = 0; return; }
    const ir = e.target.closest('[data-ir]');
    if (ir) { cerrarGuia(); irA(ir.dataset.ir); }
  });
  $('#btn-guia').addEventListener('click', () => abrirGuia());
  $('#btn-repetir-inicio').addEventListener('click', () => abrirInicio({ repetir: true }));
  $('#btn-consejos').addEventListener('click', () => {
    for (const v of Object.keys(G.CONSEJO_DE_VISTA)) ajustes.escribir(`consejo-${v}`, '0');
    ajustes.escribir('consejoModoRemo', '0');
    toast('Los consejos vuelven a salir al abrir cada pestaña');
    mostrarConsejo('ajustes');
  });
}
// Una tarjeta arriba de la pestaña la primera vez que la abres: qué hay aquí, con un botón a la guía.
export function mostrarConsejo(vista) {
  document.querySelectorAll('.consejo').forEach((x) => x.remove());
  const t = G.consejoDe(vista);
  // Ni a media sesión ni con el teléfono en horizontal: ahí cada línea de alto cuenta.
  if (!t || ajustes.si(`consejo-${vista}`, false) || !$('#inicio').hidden || estado.sesion || matchMedia('(orientation: landscape) and (max-height: 520px)').matches) return;
  const el = document.createElement('div');
  el.className = 'consejo';
  el.setAttribute('role', 'note');
  el.innerHTML = `${ico(t.icono)}<div class="consejo-texto"><b>${t.titulo}</b><span>${t.resumen}</span></div>
    <div class="consejo-botones"><button type="button" class="boton chico" data-guia="${t.clave}">Cómo funciona</button><button type="button" class="boton chico" data-entendido>Entendido</button></div>`;
  el.addEventListener('click', (e) => {
    const g = e.target.closest('[data-guia]');
    if (!g && !e.target.closest('[data-entendido]')) return;
    ajustes.escribir(`consejo-${vista}`, '1');
    el.remove();
    if (g) abrirGuia(g.dataset.guia);
  });
  $(`#vista-${vista}`).prepend(el);
}
