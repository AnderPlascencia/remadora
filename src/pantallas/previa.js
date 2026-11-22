// Vista previa de la tienda: se carga solo al tocar «Vista previa», para no pesar en la primera carga.
import { COLORES_RIVAL, PAISAJES, VELAS, crearCarrera, equipoEnUso, paisajeElegido, usarEquipo, usarPaisaje } from '../carrera.js';
import * as J from '../juego.js';
import { PIEZAS } from '../coleccion-bote.js';
import { ico } from '../ui.js';
import { srcRetratoRango } from './preparar.js';
import { srcHeroe } from './heroe.js';

// Una carrera de muestra en una hoja: tu bote con la pieza puesta, o el paisaje elegido, contra tres rivales de las
// otras clases. Usa el mismo dibujo de la carrera (crearCarrera), así que se ve igual que en Entrenar. Al cerrar
// vuelven tu paisaje y tu equipo. Tocar la carrera alterna 2D y 3D.
let previa = null;
function cerrarPrevia() {
  if (!previa) return;
  const p = previa;
  previa = null;
  clearInterval(p.reloj);
  p.carrera.soltar();
  p.fondo.remove();
  document.removeEventListener('keydown', p.tecla);
  usarPaisaje(p.antes.paisaje);
  usarEquipo(p.antes.equipo);
  p.origen?.focus?.();
}
export function abrirPrevia(per, h, { titulo, paisaje = null, equipo = null, modo = '3d' }) {
  cerrarPrevia();
  const clase = J.claseDe(per.clase)?.clave || 'vikingo';
  const rango = J.rangoDe(h.nivel).id;
  const antes = { paisaje: paisajeElegido(per), equipo: equipoEnUso() };
  usarPaisaje(paisaje || antes.paisaje);
  if (equipo) usarEquipo(equipo);
  const fondo = document.createElement('div');
  fondo.className = 'hoja-fondo previa';
  fondo.innerHTML = `<div class="hoja" role="dialog" aria-modal="true" aria-labelledby="previa-titulo">
    <div class="hoja-cabecera"><h2 id="previa-titulo"></h2><button type="button" class="boton icono" data-cerrar aria-label="Cerrar">${ico('i-cerrar')}</button></div>
    <p class="ayuda">Así se vería en tu carrera. Toca la carrera para cambiar entre 2D y 3D.</p>
    <canvas class="grafica carrera" role="img" aria-label="Vista previa de la carrera"></canvas></div>`;
  fondo.querySelector('h2').textContent = `Vista previa: ${titulo}`;
  document.body.append(fondo);
  const lienzo = fondo.querySelector('canvas');
  const carrera = crearCarrera(lienzo);
  carrera.modo = modo;
  // Tres rivales de las otras clases a ritmos parecidos al tuyo: a paso parejo para que se vean bien los botes.
  const rivales = J.CLASES.filter((c) => c.clave !== clase).slice(0, 3).map((c, i) => {
    const v = [4.05, 4.3, 4.15][i];
    const muestras = Array.from({ length: 121 }, (_, k) => ({ t: k * 5, dist: v * k * 5 }));
    return { nombre: c.nombre, color: COLORES_RIVAL[i % COLORES_RIVAL.length], muestras, spmEn: () => 26, clase: c.clave, retrato: srcRetratoRango(c.clave, rango) };
  });
  let t = 20;
  const estadoEn = (s) => ({
    t: s, pausa: false, yo: { dist: 4.2 * s, v: 4.2, spm: 26 }, rivales, referencias: [], meta: null,
    cabecera: ['Vista previa', ''], tono: '', yoClase: clase, yoRetrato: srcHeroe(clase, h.nivel, true),
  });
  carrera.actualizar(estadoEn(t));
  const reloj = setInterval(() => {
    t = t >= 580 ? 20 : t + 1;
    carrera.actualizar(estadoEn(t));
  }, 1000);
  lienzo.addEventListener('click', () => {
    carrera.modo = carrera.modo === '2d' ? '3d' : '2d';
    carrera.actualizar(carrera.estado);
  });
  const tecla = (e) => { if (e.key === 'Escape') cerrarPrevia(); };
  document.addEventListener('keydown', tecla);
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-cerrar]')) cerrarPrevia();
  });
  previa = { fondo, carrera, reloj, tecla, antes, origen: document.activeElement };
  fondo.querySelector('[data-cerrar]').focus();
}

// Botón «Vista previa» de la tienda: data-previa es el paisaje o la pieza; data-tipo, el hueco del bote (vela, proa…).
export function desdeTienda(b, { per, h }, equipoActual) {
  const id = b.dataset.previa;
  if (!b.dataset.tipo) return abrirPrevia(per, h, { titulo: PAISAJES[id].nombre, paisaje: id });
  const equipo = equipoActual(per, h);
  if (equipo) abrirPrevia(per, h, { titulo: (PIEZAS[id] || VELAS[id]).nombre, equipo: { ...equipo, [b.dataset.tipo]: id } });
}
