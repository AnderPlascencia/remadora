// Punto de entrada: carga cada pantalla y la arranca en el mismo orden de siempre.
import { $, ajustes, marcarVersionNueva, reajustarTextos, vigilarCapas } from './ui.js';
import { estado } from './estado.js';
import { arrancarNavegacion, irA, vistaActiva } from './navegacion.js';
import { arrancarAjustes1, arrancarAjustes2, arrancarAjustes3, pintarPerfil } from './pantallas/ajustes.js';
import { arrancarPreparar, hayCarrera, recibirReto } from './pantallas/preparar.js';
import { abrirModoRemo, ajustarNumeros, arrancarVivo1, arrancarVivo2, dibujarVivo, vistaPrevia } from './pantallas/vivo.js';
import { arrancarRegistro } from './registro.js';
import * as Hab from './habito.js';
import { activarVersionEnEspera, actualizarBotones, arrancarSesion1, arrancarSesion2, ofrecerRecuperar } from './pantallas/sesion.js';
import { arrancarPlanes1, arrancarPlanes2, llenarSelectorEntrenamientos } from './pantallas/planes.js';
import { arrancarProgreso, pintarHistorial } from './pantallas/progreso.js';
import { arrancarHeroe, pintarLineaNivel, precargarRecursos } from './pantallas/heroe.js';
import { VERSION } from './version.js';
import { arrancarPrograma, limpiarSobrantesDePlan, pintarPrograma, revisarPlanAuto } from './pantallas/programa.js';
import { arrancarAyuda, mostrarConsejo } from './pantallas/ayuda.js';

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
arrancarPrograma();
arrancarAjustes3();
arrancarPlanes2();
arrancarSesion2();
// Ronda 2 (QA-F4): la bienvenida y el detalle de una sesión ya no van en la primera carga. La bienvenida se baja solo
// si falta hacerla; el detalle, al abrir una sesión (pone sus oyentes al cargarse).
if (ajustes.si('inicioHecho', false)) { ofrecerRecuperar(); mostrarConsejo('entrenar'); }
else import('./pantallas/inicio.js').then((m) => m.arrancarInicio());
arrancarAyuda();
pintarPerfil();
Hab.anotar('app');
vigilarCapas();

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
// Atajos del icono (etapa 16): «Entrenar hoy» y «Remo libre» abren el modo remo listo para empezar.
const parametros = new URLSearchParams(location.search);
const atajo = parametros.get('atajo');
// «Rema contra mí» (etapa 25): un enlace con #reto= trae la sesión de otra persona para remar contra ella. Va en el
// fragmento para que no llegue al servidor (ronda 2, INF-R5); los enlaces viejos con ?reto= siguen valiendo.
const enHash = new URLSearchParams(location.hash.slice(1)).get('reto');
const reto = enHash || parametros.get('reto');
if (atajo || reto) history.replaceState(history.state, '', location.pathname + (enHash ? '' : location.hash));
if (reto) recibirReto(reto);
limpiarSobrantesDePlan().then(() => llenarSelectorEntrenamientos()).then(revisarPlanAuto).then(() => abrirAtajo(atajo));
function abrirAtajo(a) {
  if ((a !== 'hoy' && a !== 'libre') || !ajustes.si('inicioHecho', false) || estado.sesion) return;
  irA('entrenar');
  if (a === 'libre') $('#modo-ent [data-modo="libre"]').click();
  abrirModoRemo();
}
dibujarVivo();
pintarLineaNivel();

// La versión va en la URL del service worker: es la de src/version.js y cada versión nueva instala uno nuevo.
// El código sale de la caché (abre al instante aunque la red sea lenta): aquí se mira en segundo plano si ya hay otra
// versión publicada y, si la hay, se instala para la próxima vez que abras la app (etapa 19).
async function buscarVersionNueva() {
  try {
    const texto = await (await fetch(`src/version.js?comprobar=${Date.now()}`, { cache: 'no-store' })).text();
    const nueva = texto.match(/VERSION = '([\d.]+)'/)?.[1];
    if (nueva && nueva !== VERSION) await navigator.serviceWorker.register(`sw.js?v=${nueva}`);
  } catch { /* sin conexión: se mira la próxima vez */ }
}
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register(`sw.js?v=${VERSION}`).then(() => { precargarRecursos(); activarVersionEnEspera(); buscarVersionNueva(); }).catch(() => {});
  // El service worker nuevo pregunta antes de activarse si hay una sesión en curso (si la hay, espera a que termine).
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.tipo === 'sesionEnCurso?') e.ports?.[0]?.postMessage({ enCurso: !!estado.sesion });
  });
  navigator.serviceWorker.startMessages?.();
  // Al actualizar, el mensaje anterior llega al service worker viejo, cuya caché borra el nuevo al activarse:
  // se repite cuando el nuevo toma el control para que los paisajes comprados sigan disponibles sin conexión.
  // Si ya había uno (no es la primera visita), es otra versión: las pantallas que se bajan al abrirlas recargan antes.
  const habia = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { precargarRecursos(); if (habia) marcarVersionNueva(); });
}
