// Punto de entrada: carga cada pantalla y la arranca en el mismo orden de siempre.
import { $, reajustarTextos } from './ui.js';
import { estado } from './estado.js';
import { arrancarNavegacion, vistaActiva } from './navegacion.js';
import { arrancarAjustes1, arrancarAjustes2, arrancarAjustes3, pintarPerfil } from './pantallas/ajustes.js';
import { arrancarPreparar, hayCarrera } from './pantallas/preparar.js';
import { ajustarNumeros, arrancarVivo1, arrancarVivo2, dibujarVivo, vistaPrevia } from './pantallas/vivo.js';
import { arrancarRegistro } from './registro.js';
import { actualizarBotones, arrancarSesion1, arrancarSesion2 } from './pantallas/sesion.js';
import { arrancarPlanes1, arrancarPlanes2, llenarSelectorEntrenamientos } from './pantallas/planes.js';
import { arrancarProgreso, pintarHistorial } from './pantallas/progreso.js';
import { arrancarHeroe, pintarLineaNivel } from './pantallas/heroe.js';
import { arrancarDetalle } from './pantallas/detalle.js';
import { arrancarPrograma, limpiarSobrantesDePlan, pintarPrograma, revisarPlanAuto } from './pantallas/programa.js';
import { arrancarInicio } from './pantallas/inicio.js';
import { arrancarAyuda } from './pantallas/ayuda.js';

arrancarNavegacion();
arrancarAjustes1();
arrancarPreparar();
arrancarVivo1();
arrancarAjustes2();
arrancarRegistro();
arrancarSesion1();
arrancarVivo2();
arrancarPlanes1();
arrancarProgreso();
arrancarHeroe();
arrancarDetalle();
arrancarPrograma();
arrancarAjustes3();
arrancarPlanes2();
arrancarSesion2();
arrancarInicio();
arrancarAyuda();
pintarPerfil();

const horizontalTel = matchMedia('(orientation: landscape) and (max-height: 520px)');
// Al girar a horizontal a mitad de una carrera, la pista se lleva a la vista igual que al empezar.
horizontalTel.addEventListener('change', () => {
  if (horizontalTel.matches && estado.sesion && hayCarrera() && vistaActiva('entrenar') && $('#modo-remo').hidden) {
    requestAnimationFrame(() => $('#carrera').scrollIntoView({ block: 'start' }));
  }
});
window.addEventListener('resize', () => {
  reajustarTextos();
  ajustarNumeros();
  if (vistaActiva('entrenar')) { dibujarVivo(); if (!estado.sesion) vistaPrevia(); }
  if (vistaActiva('historial')) pintarHistorial();
  if (vistaActiva('entrenamientos')) pintarPrograma();
});
actualizarBotones();
limpiarSobrantesDePlan().then(() => llenarSelectorEntrenamientos()).then(revisarPlanAuto);
dibujarVivo();
pintarLineaNivel();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
