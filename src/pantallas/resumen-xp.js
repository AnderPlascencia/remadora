// XP, monedas y logros de la sesión en la hoja de resumen. Sale de heroe.js (ronda 2, etapa 7) para que no vaya en la
// primera carga: solo lo usa el detalle de la sesión, que ya se carga al abrirlo.
import * as J from '../juego.js';
import * as GA from '../ganarte.js';
import * as O from '../objetos.js';
import * as CB from '../coleccion-bote.js';
import { hablar } from '../voz.js';
import { $, contarHasta, escaparHtml, ico, miles, sinMovimiento } from '../ui.js';
import { enSesiones, icoMoneda, juegoConSesion, leerPersonaje, nombreAtributo, srcHeroe } from './heroe.js';

// ⚖ Ganarte a ti mismo: tu yo pasado y el reto tienen su propia línea en el resumen, fuera de «Cómo la ganaste».
function lineasGanarte(s, logros) {
  if (!GA.esGanarte(s.fecha)) return '';
  const filas = [];
  const yo = GA.yoPasadoGanado(s);
  if (yo) {
    const l = logros.find((x) => x.tipo === 'yo');
    filas.push(`${escaparHtml(GA.textoYoPasado(yo))}${l ? ` <span class="xp">+${miles(l.xp)} XP</span>` : ' <small>(el premio ya salió esta semana)</small>'}`);
  }
  const reto = GA.retoRemado(s);
  if (reto) {
    const quien = GA.nombreReto(reto.ref);
    filas.push(reto.gano ? `Le ganaste${quien ? ` a ${escaparHtml(quien)}` : ' al reto'} por ${GA.margen(reto.ref)}. Devuélvele el reto con tu sesión desde Compartir.`
      : `Remaste el reto${quien ? ` de ${escaparHtml(quien)}` : ''} hasta el final. ${reto.ref.segundos != null ? `Te faltaron ${Math.abs(reto.ref.segundos)} s` : `Te faltaron ${GA.margen(reto.ref)}`}: mándale el tuyo desde Compartir.`);
  }
  return filas.map((f) => `<p class="xp-ganarte">${ico('i-trofeo')}<span>${f}</span></p>`).join('');
}

// XP, monedas y logros que dio la sesión, en la hoja de resumen. Devuelve true si subiste de nivel o venciste a un jefe.
export function pintarXpSesion(s, previas, resumen) {
  const caja = $('#hoja-xp');
  const per = leerPersonaje();
  const clase = J.claseDe(per.clase);
  const h = juegoConSesion(previas, s, per);
  const g = h.porSesion.get(s.fecha);
  caja.hidden = !g;
  if (!g) return false;
  const logros = h.logros.filter((l) => l.fecha === s.fecha);
  const monedas = g.monedas + logros.reduce((a, l) => a + l.monedas, 0);
  const subio = resumen && g.nivelDespues > g.nivelAntes;
  const ascenso = subio && J.rangoDe(g.nivelDespues).id !== J.rangoDe(g.nivelAntes).id;
  const puntos = subio ? J.puntosDeNivel(g.nivelDespues) - J.puntosDeNivel(g.nivelAntes) : 0;
  const ses = h.hasta ? enSesiones(h.hasta - h.xp, h) : '';
  // Vencer a un jefe es un hito: tarjeta propia con su insignia, antes que todo lo demás.
  const jefe = g.jefe ? `<div class="jefe-vencido" role="status">${ico('i-trofeo')}<div><b>¡Jefe vencido!</b><span>${escaparHtml(g.jefe.nombre)} cae y terminas el capítulo ${g.jefe.capitulo} de ${J.CAPITULOS.length}.</span><small>Insignia ${escaparHtml(O.objeto(g.jefe.objeto)?.nombre || '')}${g.jefe.pieza ? ` y ${escaparHtml(CB.PIEZAS[g.jefe.pieza].nombre)} para tu bote` : ''}</small></div></div>` : '';
  // Sin héroe (la bienvenida ya no lo pide, etapa 20): elegirlo es lo primero del resumen, con la XP ya ganada.
  const eleccion = clase ? '' : `<div class="xp-heroe"><p><b>Elige tu héroe</b> y se queda con esta experiencia:</p><div class="clases-mini">${J.CLASES.map((c) => `<button type="button" data-clase-rapida="${c.clave}"><img src="${srcHeroe(c.clave, 1, true)}" width="48" height="48" alt=""><span>${c.nombre}</span></button>`).join('')}</div></div>`;
  caja.innerHTML = `${jefe}${eleccion}<span class="xp-total">+${miles(g.xp + g.xpExtra)} XP</span> <span class="monedas grande">${icoMoneda}+${miles(monedas)}</span>
    ${subio ? `<span class="subio">¡${clase ? clase.nombre : 'Tu héroe'} sube a nivel ${g.nivelDespues}!${ascenso ? ` Ahora es ${J.nombreRango(g.nivelDespues, per.clase)}.` : ''}</span>` : ''}
    ${puntos > 0 && clase && h.talentosPorRepartir > 0 ? `<span class="subio-talento">+${puntos} ${puntos === 1 ? 'punto' : 'puntos'} de talento <button type="button" class="boton chico primario" data-ir-talentos>Repartir</button></span>` : ''}
    <div class="progreso heroe-xp" role="progressbar" aria-label="Experiencia hacia el siguiente nivel"><div style="width:${h.hasta ? (100 * (h.xp - h.desde)) / (h.hasta - h.desde) : 100}%"></div></div>
    ${g.avisoDescanso ? '<p class="aviso-descanso suave">Hoy tocaba descanso: mañana tu sesión dura puede costarte más.</p>' : ''}
    ${lineasGanarte(s, logros)}
    <small class="xp-nivel">Nivel ${h.nivel}${h.hasta ? ` · faltan ${miles(h.hasta - h.xp)} XP para el ${h.nivel + 1}${ses ? ` (${ses})` : ''}` : ''}</small>
    <details class="xp-desglose"${resumen ? '' : ' open'}><summary>Cómo la ganaste${logros.length ? ` · ${logros.length} ${logros.length === 1 ? 'logro' : 'logros'}` : ''}</summary>
    ${logros.map((l) => `<div class="logro ${l.tipo}">${ico(['jefe', 'hazana', 'mejora', 'hito'].includes(l.tipo) ? 'i-trofeo' : 'i-check')}<span>${l.texto}${l.objeto ? ` · insignia <b>${O.objeto(l.objeto).nombre}</b>` : ''}</span><span class="recompensa">${l.xp ? `<span class="xp">+${miles(l.xp)} XP</span>` : ''}<span class="monedas">${icoMoneda}${l.monedas}</span></span></div>`).join('')}
    <div class="chips-ganancia">${Object.entries(g.ganancias).map(([k, v]) => `<span>${nombreAtributo(k)} +${v}</span>`).join('')}</div>
    <ul>${g.detalle.map(([t, v]) => `<li><span>${t}</span><span>+${miles(v)}</span></li>`).join('')}</ul>
    ${J.usaCarga(s) ? `<p class="suave xp-mitad">La XP sale de la carga del entrenamiento (con tope diario) y de cumplir tu plan. ${J.esUnaRacha(s.fecha) ? 'Fantasmas y talentos' : 'Fantasmas, racha y talentos'} siguen a la mitad.</p>` : J.factorXp(s.fecha) < 1 ? '<p class="suave xp-mitad">Desde el 29 de octubre todo da la mitad de XP: estas cifras ya lo incluyen.</p>' : ''}</details>`;
  if (resumen) {
    const total = g.xp + g.xpExtra;
    contarHasta(caja.querySelector('.xp-total'), total, (v) => `+${miles(v)} XP`);
    const barra = caja.querySelector('.heroe-xp > div');
    const final = barra.style.width;
    const antes = subio || !h.hasta ? 0 : Math.max(0, (100 * (h.xp - total - h.desde)) / (h.hasta - h.desde));
    if (!sinMovimiento()) { barra.style.transition = 'none'; barra.style.width = `${antes}%`; void barra.offsetWidth; barra.style.transition = 'width 1.1s cubic-bezier(.2, .8, .2, 1)'; requestAnimationFrame(() => { barra.style.width = final; }); }
  }
  if (subio) hablar(ascenso ? `Subiste a nivel ${g.nivelDespues}. Ahora eres ${J.nombreRango(g.nivelDespues, per.clase)}` : `Subiste a nivel ${g.nivelDespues}`);
  if (resumen && logros.some((l) => l.tipo === 'jefe')) hablar('¡Jefe vencido!');
  return subio || logros.some((l) => ['jefe', 'hazana', 'mejora', 'hito'].includes(l.tipo));
}

