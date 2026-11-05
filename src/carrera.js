// Carrera animada contra uno o varios fantasmas, en vista 2D (desde arriba) o 3D (desde atrás).
// Los datos llegan una vez por segundo; entre lecturas se interpola para que todo se mueva fluido
// a la frecuencia de pantalla. Los remos se animan al ritmo de golpes por minuto de cada bote.
import { distanciaEn } from './estadisticas.js';
import { PIEZAS, velaDeRival } from './coleccion-bote.js';
import { pintarTela, pintarIcono } from './emblemas.js';

const carreras = new Set();
let animando = false;
const sinMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const COLORES_RIVAL = ['#A5B4FC', '#F9A8D4', '#5EEAD4'];
const COLOR_YO = '#F2A33A';
const COLOR_RITMO = '#FACC15';
const SPRINT_M = 250;
// Paisajes de la carrera, renderizados en Blender (tools/blender/paisaje y tools/blender/paisaje/laguna):
// - panorama: fondo de la vista 3D y fila de su horizonte (ver tools/blender/paisaje/componer.py).
// - orilla: atlas de piezas de la orilla 3D (orilla.py + atlas.py): recorte, pie (fracción donde toca el suelo)
//   y alto en metros. elegir() decide qué pieza va en cada hueco; borde es la pieza pequeña junto al agua.
// - costa: orilla vista desde arriba para la vista 2D (costa.py), tira que se repite con el agua abajo.
// - colores: lo que se pinta mientras cargan las imágenes y las partes que no son imagen (agua, tierra).
export const PAISAJES = {
  fiordo: {
    nombre: 'Fiordo nórdico',
    texto: 'Montañas nevadas y bosque de pinos al atardecer.',
    precio: 0,
    miniatura: 'assets/carrera/fiordo_mini.webp',
    panorama: { src: 'assets/carrera/fiordo.webp', horizonte: 204 },
    costa: 'assets/carrera/costa.webp',
    orilla: {
      src: 'assets/carrera/orilla.webp',
      piezas: {
        pino_alto: { x: 0, y: 0, w: 381, h: 660, pie: [0.5, 0.996], m: 11.79 },
        pino_medio: { x: 383, y: 0, w: 277, h: 481, pie: [0.5, 0.995], m: 8.59 },
        abedul: { x: 662, y: 0, w: 114, h: 460, pie: [0.496, 0.994], m: 8.21 },
        abedul_verde: { x: 778, y: 0, w: 120, h: 368, pie: [0.5, 0.993], m: 6.57 },
        pino_bajo: { x: 0, y: 662, w: 225, h: 330, pie: [0.5, 0.993], m: 5.89 },
        casa: { x: 227, y: 662, w: 272, h: 267, pie: [0.502, 0.929], m: 4.78 },
        roca_grande: { x: 501, y: 662, w: 289, h: 126, pie: [0.5, 0.86], m: 2.25 },
        juncos: { x: 792, y: 662, w: 81, h: 82, pie: [0.5, 0.958], m: 1.46 },
        roca: { x: 0, y: 994, w: 180, h: 77, pie: [0.497, 0.778], m: 1.38 }
      },
      elegir: (r1, r2) => (r1 < 0.1 ? 'roca' : r1 < 0.16 ? 'roca_grande' : r1 < 0.19 && r2 < 0.5 ? 'casa'
        : r1 < 0.38 ? (r2 < 0.5 ? 'abedul' : 'abedul_verde') : r2 < 0.35 ? 'pino_alto' : r2 < 0.7 ? 'pino_medio' : 'pino_bajo'),
      fondo: (r2) => (r2 > 0.65 ? 'pino_alto' : 'pino_medio'),
      apartar: { casa: 4 },
      borde: 'juncos',
      // Las piezas son simétricas: en la orilla derecha se espejan a medias para variar
      espejo: (s, r) => s > 0 && r > 0.5
    },
    colores: {
      tierra2d: '#1F3A2A', agua2d: ['#0E4A70', '#0A3352'], cielo3d: ['#8FA6BC', '#C6D1DA'], agua3d: ['#1E2E3E', '#0A2236'],
      reflejo: '148,184,214', arena3d: '#6E6450', tierra3d: '#22362B', bruma: 230
    }
  },
  laguna: {
    nombre: 'Laguna tropical',
    texto: 'Agua turquesa, islas volcánicas, palmeras y faros.',
    precio: 400,
    miniatura: 'assets/carrera/laguna_mini.webp',
    panorama: { src: 'assets/carrera/laguna.webp', horizonte: 204 },
    costa: 'assets/carrera/laguna_costa.webp',
    orilla: {
      src: 'assets/carrera/laguna_orilla.webp',
      piezas: {
        palmera_alta: { x: 0, y: 0, w: 551, h: 830, pie: [0.501, 0.995], m: 12.96 },
        palmera_curva: { x: 0, y: 832, w: 618, h: 657, pie: [0.5, 0.995], m: 10.26 },
        palmera_baja: { x: 620, y: 832, w: 266, h: 443, pie: [0.5, 0.992], m: 6.92 },
        fare: { x: 0, y: 1491, w: 350, h: 330, pie: [0.501, 0.945], m: 5.16 },
        arbusto: { x: 352, y: 1491, w: 192, h: 130, pie: [0.5, 0.904], m: 2.03 },
        roca_grande: { x: 546, y: 1491, w: 340, h: 122, pie: [0.5, 0.835], m: 1.9 },
        arbusto_rosa: { x: 0, y: 1823, w: 144, h: 92, pie: [0.5, 0.895], m: 1.44 },
        roca: { x: 146, y: 1823, w: 184, h: 79, pie: [0.5, 0.75], m: 1.23 },
        canoa: { x: 332, y: 1823, w: 411, h: 59, pie: [0.5, 0.84], m: 0.92 },
        matas: { x: 745, y: 1823, w: 88, h: 54, pie: [0.5, 0.919], m: 0.84 }
      },
      elegir: (r1, r2) => (r1 < 0.07 ? 'roca' : r1 < 0.11 ? 'roca_grande' : r1 < 0.15 && r2 < 0.5 ? 'fare'
        : r1 < 0.19 && r2 < 0.5 ? 'canoa' : r1 < 0.36 ? (r2 < 0.5 ? 'arbusto' : 'arbusto_rosa')
          : r2 < 0.4 ? 'palmera_alta' : r2 < 0.75 ? 'palmera_curva' : 'palmera_baja'),
      fondo: (r2) => (r2 > 0.65 ? 'palmera_alta' : r2 > 0.45 ? 'palmera_curva' : 'arbusto'),
      apartar: { fare: 4, canoa: -1 },
      borde: 'matas',
      // Las palmeras se inclinan hacia +x: en la orilla derecha se espejan siempre para que miren al agua
      espejo: (s) => s > 0
    },
    colores: {
      tierra2d: '#C9A46C', agua2d: ['#1BA7B0', '#0E7C93'], cielo3d: ['#7FB2E0', '#CFE3F1'], agua3d: ['#4FA9BC', '#0E6F86'],
      reflejo: '190,230,240', arena3d: '#D9C08E', tierra3d: '#3F6A2C', bruma: 230
    }
  }
};
// Colección a largo plazo (etapa 12): variantes de los dos paisajes con otra hora, tiempo o estación, de 600 a
// 3000 monedas. Reusan las imágenes del paisaje base con un filtro de color (si el navegador no sabe filtrar el
// lienzo, se ven como el base) y sus propios colores de cielo y agua.
const variante = (base, extra) => ({ ...PAISAJES[base], ...extra, base, colores: { ...PAISAJES[base].colores, ...extra.colores } });
Object.assign(PAISAJES, {
  'fiordo-invierno': variante('fiordo', { nombre: 'Fiordo en invierno', texto: 'El mismo fiordo bajo la nieve, con luz blanca y fría.', precio: 600, filtro: 'saturate(.35) brightness(1.12) contrast(.95)',
    colores: { agua2d: ['#3E6A86', '#2A4F66'], cielo3d: ['#C9D4DE', '#E8EDF1'], agua3d: ['#4A6476', '#24394A'], reflejo: '214,224,232', tierra2d: '#D8DEE3' } }),
  'laguna-atardecer': variante('laguna', { nombre: 'Laguna al atardecer', texto: 'Sol bajo sobre la laguna: agua de cobre y palmeras a contraluz.', precio: 900, filtro: 'sepia(.45) saturate(1.5) hue-rotate(-12deg) brightness(.95)',
    colores: { agua2d: ['#C9773E', '#8A4B2A'], cielo3d: ['#F29A5B', '#FBD08B'], agua3d: ['#B86B3E', '#5E3322'], reflejo: '250,190,130' } }),
  'fiordo-tormenta': variante('fiordo', { nombre: 'Fiordo en tormenta', texto: 'Nubes de plomo y agua oscura: se rema igual, pero impone.', precio: 1300, filtro: 'grayscale(.55) brightness(.72) contrast(1.15)',
    colores: { agua2d: ['#2B3C48', '#18242D'], cielo3d: ['#59636C', '#8A939B'], agua3d: ['#26323B', '#111A21'], reflejo: '150,162,172' } }),
  'laguna-luna': variante('laguna', { nombre: 'Laguna de luna llena', texto: 'La laguna de noche, plateada por la luna.', precio: 1800, filtro: 'brightness(.5) saturate(.7) hue-rotate(185deg)',
    colores: { agua2d: ['#1A3A5C', '#0C2238'], cielo3d: ['#0F1E36', '#2B4468'], agua3d: ['#16324F', '#08172A'], reflejo: '170,190,230', tierra2d: '#3A4250' } }),
  'fiordo-aurora': variante('fiordo', { nombre: 'Fiordo bajo la aurora', texto: 'Noche polar con el cielo verde de la aurora boreal.', precio: 2400, filtro: 'brightness(.55) saturate(1.3) hue-rotate(115deg)',
    colores: { agua2d: ['#0E3B3A', '#06201F'], cielo3d: ['#08221F', '#1F6B55'], agua3d: ['#0C3330', '#041716'], reflejo: '120,230,180' } }),
  'laguna-dorada': variante('laguna', { nombre: 'Laguna dorada', texto: 'La laguna de las leyendas: agua y cielo de oro.', precio: 3000, filtro: 'sepia(.85) saturate(2.2) brightness(1.05)',
    colores: { agua2d: ['#C9A227', '#8C6D12'], cielo3d: ['#E8C45A', '#FBE7A1'], agua3d: ['#B8912A', '#6E5310'], reflejo: '255,225,140' } }),
});
// Colección de paisajes propios (v0.54.0): cinco escenarios con su panorama, su orilla 3D y su costa 2D, renderizados
// en Blender con tools/blender/paisaje/coleccion (objetos.py, temas.py, panorama.py, orilla.py y costa.py).
const propio = (id, x) => ({
  ...x,
  miniatura: `assets/carrera/${id}_mini.webp`,
  panorama: { src: `assets/carrera/${id}.webp`, horizonte: 204 },
  costa: `assets/carrera/${id}_costa.webp`,
  orilla: { src: `assets/carrera/${id}_orilla.webp`, ...x.orilla },
});
Object.assign(PAISAJES, {
  canon: propio('canon', {
    nombre: 'Cañón del desierto',
    texto: 'Mesetas rojas, saguaros y casas de adobe junto al río.',
    precio: 700,
    orilla: {
      piezas: {
        saguaro_alto: { x: 0, y: 0, w: 238, h: 651, pie: [0.5, 0.987], m: 10.18 },
        saguaro: { x: 240, y: 0, w: 144, h: 450, pie: [0.5, 0.985], m: 7.03 },
        mezquite: { x: 386, y: 0, w: 381, h: 327, pie: [0.5, 0.988], m: 5.11 },
        adobe: { x: 0, y: 653, w: 314, h: 284, pie: [0.5, 0.926], m: 4.44 },
        roca_grande: { x: 316, y: 653, w: 271, h: 152, pie: [0.5, 0.867], m: 2.37 },
        salvia: { x: 589, y: 653, w: 186, h: 109, pie: [0.5, 0.853], m: 1.7 },
        roca: { x: 777, y: 653, w: 135, h: 69, pie: [0.5, 0.776], m: 1.08 },
        barril: { x: 914, y: 653, w: 78, h: 69, pie: [0.506, 0.919], m: 1.08 },
        matas: { x: 0, y: 939, w: 79, h: 47, pie: [0.506, 0.918], m: 0.74 }
      },
      elegir: (r1, r2) => (r1 < 0.1 ? 'roca' : r1 < 0.17 ? 'roca_grande' : r1 < 0.21 && r2 < 0.5 ? 'adobe'
        : r1 < 0.42 ? (r2 < 0.5 ? 'salvia' : 'barril') : r2 < 0.35 ? 'saguaro_alto' : r2 < 0.65 ? 'saguaro' : 'mezquite'),
      fondo: (r2) => (r2 > 0.65 ? 'saguaro_alto' : r2 > 0.45 ? 'mezquite' : 'saguaro'),
      apartar: { adobe: 4 },
      borde: 'matas',
      espejo: (s, r) => s > 0 && r > 0.5
    },
    colores: {
      tierra2d: '#B8693A', agua2d: ['#3E7A78', '#2A5A5C'], cielo3d: ['#9DB6D6', '#D9DCDD'], agua3d: ['#4E6E7A', '#22404A'],
      reflejo: '210,195,170', arena3d: '#D9A878', tierra3d: '#A85A30', bruma: 230
    }
  }),
  otono: propio('otono', {
    nombre: 'Lago de otoño',
    texto: 'Bosque de arces rojos y dorados, cabañas de troncos y una canoa.',
    precio: 1100,
    orilla: {
      piezas: {
        pino: { x: 0, y: 0, w: 451, h: 752, pie: [0.5, 0.996], m: 11.75 },
        arce_rojo: { x: 0, y: 754, w: 607, h: 692, pie: [0.5, 0.992], m: 10.82 },
        arce_naranja: { x: 0, y: 1448, w: 514, h: 577, pie: [0.5, 0.992], m: 9.01 },
        abedul: { x: 516, y: 1448, w: 130, h: 523, pie: [0.5, 0.995], m: 8.16 },
        cabana: { x: 648, y: 1448, w: 374, h: 327, pie: [0.5, 0.935], m: 5.1 },
        roca_grande: { x: 0, y: 2027, w: 288, h: 121, pie: [0.5, 0.836], m: 1.89 },
        roca: { x: 290, y: 2027, w: 133, h: 72, pie: [0.5, 0.726], m: 1.13 },
        helechos: { x: 425, y: 2027, w: 81, h: 51, pie: [0.506, 0.918], m: 0.79 },
        canoa: { x: 508, y: 2027, w: 297, h: 42, pie: [0.5, 0.825], m: 0.66 }
      },
      elegir: (r1, r2) => (r1 < 0.08 ? 'roca' : r1 < 0.12 ? 'roca_grande' : r1 < 0.16 && r2 < 0.5 ? 'cabana'
        : r1 < 0.2 && r2 < 0.5 ? 'canoa' : r1 < 0.4 ? (r2 < 0.5 ? 'abedul' : 'arce_naranja')
          : r2 < 0.4 ? 'arce_rojo' : r2 < 0.7 ? 'pino' : 'arce_naranja'),
      fondo: (r2) => (r2 > 0.65 ? 'pino' : r2 > 0.45 ? 'arce_rojo' : 'arce_naranja'),
      apartar: { cabana: 4, canoa: -1 },
      borde: 'helechos',
      espejo: (s, r) => s > 0 && r > 0.5
    },
    colores: {
      tierra2d: '#6A4A22', agua2d: ['#1E4A6A', '#123552'], cielo3d: ['#A2B8D4', '#D6DEE6'], agua3d: ['#2E4A62', '#10263A'],
      reflejo: '230,170,120', arena3d: '#9E8E6A', tierra3d: '#6A3A1E', bruma: 230
    }
  }),
  cerezos: propio('cerezos', {
    nombre: 'Lago de los cerezos',
    texto: 'Cerezos en flor, toriis rojos y un volcán nevado al fondo.',
    precio: 1500,
    orilla: {
      piezas: {
        cerezo: { x: 0, y: 0, w: 590, h: 550, pie: [0.5, 0.988], m: 8.6 },
        pino: { x: 0, y: 552, w: 453, h: 500, pie: [0.499, 0.98], m: 7.81 },
        bambu: { x: 455, y: 552, w: 168, h: 464, pie: [0.5, 0.987], m: 7.24 },
        torii: { x: 0, y: 1054, w: 451, h: 358, pie: [0.5, 0.986], m: 5.59 },
        cerezo_chico: { x: 453, y: 1054, w: 352, h: 353, pie: [0.501, 0.988], m: 5.51 },
        linterna: { x: 807, y: 1054, w: 78, h: 145, pie: [0.5, 0.963], m: 2.27 },
        roca_grande: { x: 0, y: 1414, w: 267, h: 111, pie: [0.5, 0.818], m: 1.74 },
        roca: { x: 269, y: 1414, w: 150, h: 72, pie: [0.497, 0.726], m: 1.13 },
        iris: { x: 421, y: 1414, w: 87, h: 54, pie: [0.5, 0.931], m: 0.84 }
      },
      elegir: (r1, r2) => (r1 < 0.08 ? 'roca' : r1 < 0.12 ? 'roca_grande' : r1 < 0.16 && r2 < 0.5 ? 'torii'
        : r1 < 0.21 && r2 < 0.5 ? 'linterna' : r1 < 0.38 ? (r2 < 0.5 ? 'cerezo_chico' : 'bambu')
          : r2 < 0.5 ? 'cerezo' : r2 < 0.75 ? 'pino' : 'cerezo_chico'),
      fondo: (r2) => (r2 > 0.6 ? 'cerezo' : r2 > 0.4 ? 'pino' : 'bambu'),
      apartar: { torii: 3, linterna: -1 },
      borde: 'iris',
      // Los cerezos se inclinan hacia +x: en la orilla derecha se espejan siempre para que miren al agua
      espejo: (s) => s > 0
    },
    colores: {
      tierra2d: '#3E5A2C', agua2d: ['#2A6A8A', '#1A4E6A'], cielo3d: ['#9DB6D8', '#DCE3EC'], agua3d: ['#3E7088', '#173E54'],
      reflejo: '240,200,215', arena3d: '#BFB49A', tierra3d: '#3E5A2C', bruma: 230
    }
  }),
  glaciar: propio('glaciar', {
    nombre: 'Bahía glaciar',
    texto: 'Cumbres nevadas, témpanos a la deriva, iglús y pingüinos.',
    precio: 2100,
    orilla: {
      piezas: {
        tempano_alto: { x: 0, y: 0, w: 470, h: 694, pie: [0.5, 0.969], m: 10.83 },
        abeto: { x: 472, y: 0, w: 410, h: 612, pie: [0.5, 0.995], m: 9.57 },
        abeto_bajo: { x: 0, y: 696, w: 246, h: 414, pie: [0.5, 0.991], m: 6.46 },
        tempano: { x: 248, y: 696, w: 351, h: 361, pie: [0.499, 0.964], m: 5.64 },
        iglu: { x: 601, y: 696, w: 257, h: 149, pie: [0.5, 0.863], m: 2.33 },
        roca_grande: { x: 0, y: 1112, w: 297, h: 118, pie: [0.5, 0.833], m: 1.84 },
        roca: { x: 299, y: 1112, w: 159, h: 69, pie: [0.5, 0.719], m: 1.08 },
        pinguinos: { x: 460, y: 1112, w: 134, h: 53, pie: [0.5, 0.949], m: 0.83 },
        hielo: { x: 596, y: 1112, w: 95, h: 53, pie: [0.5, 0.859], m: 0.83 }
      },
      elegir: (r1, r2) => (r1 < 0.1 ? 'roca' : r1 < 0.16 ? 'roca_grande' : r1 < 0.2 && r2 < 0.5 ? 'iglu'
        : r1 < 0.25 && r2 < 0.5 ? 'pinguinos' : r1 < 0.42 ? (r2 < 0.5 ? 'tempano' : 'tempano_alto')
          : r2 < 0.55 ? 'abeto' : 'abeto_bajo'),
      fondo: (r2) => (r2 > 0.6 ? 'abeto' : r2 > 0.4 ? 'tempano_alto' : 'abeto_bajo'),
      apartar: { iglu: 4, pinguinos: -1 },
      borde: 'hielo',
      espejo: (s, r) => s > 0 && r > 0.5
    },
    colores: {
      tierra2d: '#DCE6EC', agua2d: ['#1E5A78', '#0E3E58'], cielo3d: ['#9CB6D6', '#DDE6EE'], agua3d: ['#2A5878', '#0C2E48'],
      reflejo: '210,230,245', arena3d: '#E8EEF2', tierra3d: '#C9D6DE', bruma: 240
    }
  }),
  mediterraneo: propio('mediterraneo', {
    nombre: 'Costa mediterránea',
    texto: 'Acantilados de caliza, cipreses, olivos y casitas blancas.',
    precio: 2700,
    orilla: {
      piezas: {
        cipres_alto: { x: 0, y: 0, w: 176, h: 760, pie: [0.5, 0.996], m: 11.88 },
        pinonero: { x: 178, y: 0, w: 589, h: 670, pie: [0.5, 0.994], m: 10.47 },
        cipres: { x: 769, y: 0, w: 116, h: 507, pie: [0.496, 0.995], m: 7.92 },
        olivo: { x: 0, y: 762, w: 404, h: 365, pie: [0.499, 0.979], m: 5.7 },
        casa: { x: 406, y: 762, w: 374, h: 359, pie: [0.5, 0.943], m: 5.6 },
        buganvilla: { x: 782, y: 762, w: 213, h: 130, pie: [0.5, 0.885], m: 2.03 },
        roca_grande: { x: 0, y: 1129, w: 287, h: 111, pie: [0.5, 0.822], m: 1.73 },
        roca: { x: 289, y: 1129, w: 157, h: 73, pie: [0.503, 0.729], m: 1.14 },
        barca: { x: 448, y: 1129, w: 322, h: 70, pie: [0.5, 0.844], m: 1.09 },
        lavanda: { x: 772, y: 1129, w: 80, h: 42, pie: [0.506, 0.915], m: 0.65 }
      },
      elegir: (r1, r2) => (r1 < 0.08 ? 'roca' : r1 < 0.12 ? 'roca_grande' : r1 < 0.17 && r2 < 0.5 ? 'casa'
        : r1 < 0.21 && r2 < 0.5 ? 'barca' : r1 < 0.36 ? (r2 < 0.5 ? 'buganvilla' : 'olivo')
          : r2 < 0.35 ? 'cipres_alto' : r2 < 0.6 ? 'cipres' : r2 < 0.8 ? 'olivo' : 'pinonero'),
      fondo: (r2) => (r2 > 0.7 ? 'pinonero' : r2 > 0.45 ? 'cipres_alto' : 'olivo'),
      apartar: { casa: 4, barca: -1 },
      borde: 'lavanda',
      // Los piñoneros se inclinan hacia +x: en la orilla derecha se espejan siempre
      espejo: (s) => s > 0
    },
    colores: {
      tierra2d: '#8A8A55', agua2d: ['#1E6FB0', '#0F4E8A'], cielo3d: ['#8FB6E6', '#D6E3F0'], agua3d: ['#2E6FA8', '#0B3E6E'],
      reflejo: '180,210,240', arena3d: '#E0D2B0', tierra3d: '#7A7A4A', bruma: 240
    }
  }),
});
let paisaje = PAISAJES.fiordo;
// Dibuja con el filtro de color del paisaje (las variantes); sin filtro, tal cual.
function conFiltro(ctx, dibujar) {
  if (!paisaje.filtro || !('filter' in ctx)) { dibujar(); return; }
  const antes = ctx.filter;
  ctx.filter = paisaje.filtro;
  dibujar();
  ctx.filter = antes;
}
export function usarPaisaje(id) { paisaje = PAISAJES[id] || PAISAJES.fiordo; }

// Paisajes de la tienda: los gratis (precio 0) los tiene todo el mundo; los demás se compran una vez con monedas.
// per es el personaje guardado: paisajes = ids comprados, paisaje = el elegido.
export const tienePaisaje = (per, id) => !!PAISAJES[id] && (PAISAJES[id].precio === 0 || (per.paisajes || []).includes(id));
export const paisajeElegido = (per = {}) => (tienePaisaje(per, per.paisaje) ? per.paisaje : 'fiordo');
// Cambios que hay que guardar en el personaje al comprar (y estrenar) un paisaje; null si no se puede.
export function comprarPaisaje(per, id, monedas) {
  const x = PAISAJES[id];
  if (!x || tienePaisaje(per, id) || monedas < x.precio) return null;
  return { paisajes: [...(per.paisajes || []), id], gastado: (per.gastado || 0) + x.precio, paisaje: id };
}
const DURA_EVENTO = 2600; // ms que se ve un aviso (adelanto, ventaja)

// Cada clase rema en su propio bote, con su bandera.
export const BOTES = {
  vikingo: { nombre: 'Drakkar vikingo', tela: '#B91C1C', marca: '#FDE68A' },
  pirata: { nombre: 'Balandra pirata', tela: '#111827', marca: '#F8FAFC' },
  samurai: { nombre: 'Barca samurái', tela: '#F8FAFC', marca: '#DC2626' },
  polinesio: { nombre: 'Canoa polinesia', tela: '#0EA5E9', marca: '#FDE047' },
  romano: { nombre: 'Trirreme romano', tela: '#7E22CE', marca: '#FACC15' },
};
// Velas y banderas de tu bote (etapa 12): colección de 400 a 2500 monedas. Solo cambian tu bote, nunca los rivales.
export const VELAS = {
  carmesi: { nombre: 'Velas carmesí', texto: 'Rojo de batalla con franjas negras.', precio: 400, tela: '#991B1B', marca: '#111827' },
  esmeralda: { nombre: 'Velas esmeralda', texto: 'Verde selva con remates de oro.', precio: 800, tela: '#047857', marca: '#FCD34D' },
  medianoche: { nombre: 'Velas de medianoche', texto: 'Azul noche con estrellas de plata.', precio: 1200, tela: '#1E1B4B', marca: '#E2E8F0' },
  hielo: { nombre: 'Velas de hielo', texto: 'Blanco glaciar con azul polar.', precio: 1800, tela: '#E0F2FE', marca: '#0284C7' },
  oro: { nombre: 'Velas de oro', texto: 'Para quien ya lo ha ganado todo.', precio: 2500, tela: '#CA8A04', marca: '#FEF3C7' },
};
export const tieneVelas = (per, id) => !!VELAS[id] && (per.velas || []).includes(id);
export const velasElegidas = (per = {}) => (tieneVelas(per, per.vela) ? per.vela : null);
export function comprarVelas(per, id, monedas) {
  const x = VELAS[id];
  if (!x || tieneVelas(per, id) || monedas < x.precio) return null;
  return { velas: [...(per.velas || []), id], gastado: (per.gastado || 0) + x.precio, vela: id };
}
// Equipo de tu bote (colección por clase, etapa 15): { vela, proa, palas } con ids de coleccion-bote.js (la vela
// también puede ser una vela de color de VELAS). Los rivales llevan la vela de su categoría (b.vela).
let equipoYo = null;
export function usarEquipo(equipo) { equipoYo = equipo || null; }
export const equipoEnUso = () => equipoYo;
// Lo que se dibuja de un bote: los colores de su clase y, si lleva pieza, su tela, su marca y su emblema
// (emblema, proa y palas: el dibujo de cada uno lo pone el arte; sin dibujo propio, basta con los colores).
const decoCache = new Map();
function decoDe(b) {
  const base = BOTES[b.clase];
  if (!base) return base;
  const vela = b.yo ? (equipoYo ? PIEZAS[equipoYo.vela] || VELAS[equipoYo.vela] : null) : b.vela;
  const proa = b.yo && equipoYo?.proa ? PIEZAS[equipoYo.proa] : null;
  const palas = b.yo && equipoYo?.palas ? PIEZAS[equipoYo.palas] : null;
  if (!vela && !proa && !palas) return base;
  const k = `${b.clase}|${vela?.nombre || ''}|${proa?.id || ''}|${palas?.id || ''}`;
  let d = decoCache.get(k);
  if (!d) {
    d = { ...base, ...(vela ? { tela: vela.tela, marca: vela.marca, emblema: vela.emblema || PIEZAS[`${b.clase}-clasica`]?.emblema, animado: !!vela.animado } : {}), proa, palas };
    decoCache.set(k, d);
  }
  return d;
}

// Retratos de los carriles: se cargan una vez y se pintan cuando ya llegaron.
const imagenes = new Map();
function imagen(src) {
  if (!src || typeof Image === 'undefined') return null;
  let im = imagenes.get(src);
  if (!im) {
    im = new Image();
    im.src = src;
    imagenes.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

function retrato(ctx, src, x, y, r, color) {
  const im = imagen(src);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (im) {
    ctx.clip();
    ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

// estado: { t, pausa, yo: { dist, v, spm }, rivales: [{ nombre, color, muestras, spmEn(t), clase?, retrato?, aviso? }], meta,
//   cabecera: [l1, l2], tono, lugar?, total?, cercanos?: [{ nombre, color, m, seg, delante }], yoClase?, yoRetrato?,
//   ventajaM?, eventos?: [{ id, tipo, texto, detalle }], ritmo?: { v, etiqueta }, referencias? }
export function crearCarrera(canvas) {
  const c = {
    canvas,
    modo: '2d',
    estado: null,
    recibido: 0,
    yoVista: null,
    ventana: 80,
    zoom: 0,
    fases: [],
    vistos: null,
    yoPantalla: null,
    ultimoCuadro: 0,
    actualizar(estado) {
      const previo = this.estado;
      // El reloj de interpolación solo se reinicia cuando avanza el segundo de la sesión.
      if (!previo || previo.t !== estado.t || previo.pausa !== estado.pausa) {
        this.recibido = performance.now();
        this.base = estado.yo.dist;
      }
      this.estado = estado;
      if (this.yoVista == null || Math.abs(this.yoVista - estado.yo.dist) > 40) this.yoVista = estado.yo.dist;
      arrancar();
    },
    detener() { this.estado = null; this.yoVista = null; this.vistos = null; this.centro = null; this.ventanaLista = false; this.charcos = []; this.alejar = 0; this.costa = null; },
  };
  carreras.add(c);
  // Fuera de la pantalla (al bajar en Entrenar) no se dibuja; al volver a verse, la animación sigue.
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver((entradas) => {
      c.fueraDeVista = !entradas.at(-1).isIntersecting;
      if (!c.fueraDeVista) arrancar();
    }).observe(canvas);
  }
  return c;
}

// Cuadros por segundo como mucho, según la vista. La 3D y la realista cuestan mucho más por cuadro (con la CPU
// 4× más lenta daban 22 y 11 fps frente a 35 en 2D) y a 30 fps se ven igual de fluidas; en un teléfono de 120 Hz
// esto también evita dibujar la 2D el doble de veces que se nota. La tolerancia de 4 ms absorbe el vaivén de
// requestAnimationFrame para que a 60 Hz se dibuje justo uno de cada dos cuadros.
export const FPS_MAX = { '2d': 60, '3d': 30, real: 30 };
export function tocaPintar(c, ahora) {
  const fps = FPS_MAX[c.modo] ?? 60;
  return !c.ultimoPintado || ahora - c.ultimoPintado >= 1000 / fps - 4;
}

function arrancar() {
  if (animando) return;
  animando = true;
  requestAnimationFrame(cuadro);
}

function cuadro(ahora) {
  let alguna = false;
  realPintado = false;
  let realEsperando = false;
  for (const c of carreras) {
    // tapado: otra pantalla la cubre entera (el modo remo encima de Entrenar), así que no se ve aunque esté «visible».
    if (!c.estado || !c.canvas.isConnected || c.canvas.hidden || c.canvas.offsetParent === null || c.fueraDeVista || c.tapado) continue;
    alguna = true;
    // Un cuadro que se salta por el límite de fps no cuenta como «sin vista realista»: el clip sigue.
    if (!tocaPintar(c, ahora)) { if (c.modo === 'real') realEsperando = true; continue; }
    c.ultimoPintado = ahora;
    pintarCarrera(c, ahora);
  }
  // El clip realista no sigue sonando por detrás (gasta batería) si ningún lienzo lo ha pintado.
  // Los que aún cargan siguen en autoplay: pausarlos dejaría el clip sin imagen.
  if (!realPintado && !realEsperando) for (const v of Object.values(videos)) if (v && !v.paused && v.readyState >= 2) v.pause();
  if (alguna) requestAnimationFrame(cuadro);
  else animando = false;
}

// Estado interpolado de este cuadro: posiciones de cada bote y fase de su palada.
function interpolar(c, ahora) {
  const e = c.estado;
  const dt = Math.min(0.1, c.ultimoCuadro ? (ahora - c.ultimoCuadro) / 1000 : 0);
  c.ultimoCuadro = ahora;
  const el = e.pausa ? 0 : Math.min(1.2, (ahora - c.recibido) / 1000);
  const objetivo = (c.base ?? e.yo.dist) + (e.pausa ? 0 : e.yo.v * el);
  c.yoVista += (objetivo - c.yoVista) * Math.min(1, dt * 8);
  if (sinMovimiento) c.yoVista = objetivo;
  const t = e.t + el;
  const botes = [{
    nombre: 'Tú', color: e.yoColor || COLOR_YO, dist: c.yoVista, spm: e.pausa ? 0 : e.yo.spm, v: e.pausa ? 0 : e.yo.v, yo: true,
    clase: e.yoClase || null, retrato: e.yoRetrato || null,
  }];
  e.rivales.forEach((r, i) => {
    const d = distanciaEn(r.muestras, t);
    const d2 = distanciaEn(r.muestras, t + 1);
    const v = e.pausa ? 0 : d2 - d;
    const spm = e.pausa || v <= 0 ? 0 : (r.spmEn ? r.spmEn(t) : 24);
    // Acelerón: va un 3 % más rápido que su media de los últimos 10 s.
    const media = t > 12 ? (d - distanciaEn(r.muestras, t - 10)) / 10 : 0;
    const acelera = !e.pausa && media > 0 && v > media * 1.03;
    botes.push({ nombre: r.nombre, color: r.color || COLORES_RIVAL[i % 3], dist: d, spm, v, clase: r.clase || null, retrato: r.retrato || null, aviso: r.aviso || null, acelera, vela: velaDeRival(r.clase, r) });
  });
  botes.forEach((b, i) => {
    c.fases[i] = ((c.fases[i] || 0) + (dt * b.spm) / 60) % 1;
    b.fase = c.fases[i];
    // Oleaje de la palada: el bote acelera al jalar y se frena al recobrar.
    if (!b.yo && b.spm && !sinMovimiento) b.dist += (b.v * 0.12 * (60 / b.spm) / (2 * Math.PI)) * Math.sin(2 * Math.PI * b.fase);
  });
  const ritmo = e.ritmo ? { dist: e.ritmo.v * t, etiqueta: e.ritmo.etiqueta } : null;
  const referencias = (e.referencias || []).map((r) => ({ dist: distanciaEn(r.muestras, t), etiqueta: r.etiqueta, discontinua: r.discontinua }));
  const falta = e.meta != null ? e.meta - c.yoVista : null;
  const sprint = falta != null && falta <= SPRINT_M && falta > 0 && !e.pausa;
  // Avisos activos: los que ya estaban al abrir la carrera no se repiten.
  if (!c.vistos) c.vistos = new Map((e.eventos || []).map((x) => [x.id, -Infinity]));
  for (const x of e.eventos || []) if (!c.vistos.has(x.id)) c.vistos.set(x.id, ahora);
  const eventos = (e.eventos || []).filter((x) => ahora - c.vistos.get(x.id) < DURA_EVENTO).map((x) => ({ ...x, edad: (ahora - c.vistos.get(x.id)) / DURA_EVENTO }));
  botes[0].brillo = eventos.some((x) => x.tipo === 'ventaja');
  return { botes, dt, t: ahora / 1000, ritmo, referencias, falta, sprint, eventos };
}

// Palada completa según la fase (0 = ataque, 0,38 = final). Empuje: piernas, luego espalda, luego brazos;
// recuperación al revés y el asiento despacio. asiento: −1 popa, +1 proa; tronco: +1 inclinado hacia la popa
// (ataque), −0,6 hacia atrás (final); brazos: 0 estirados, 1 recogidos; ang: ángulo del remo (radianes, + hacia
// la proa), que sale de dónde están las manos; agua: la pala está metida; pluma: 1 pala girada en horizontal.
const EMPUJE = 0.38;
const suave = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
function palada(fase, spm) {
  if (!spm) return { ang: -0.15, asiento: 0.6, tronco: 0, brazos: 0.3, agua: false, pluma: 1 };
  let asiento, tronco, brazos;
  if (fase < EMPUJE) {
    const p = fase / EMPUJE;
    asiento = -1 + 2 * suave(p / 0.6);
    tronco = 1 - 1.6 * suave((p - 0.25) / 0.55);
    brazos = suave((p - 0.55) / 0.45);
  } else {
    const q = (fase - EMPUJE) / (1 - EMPUJE);
    brazos = 1 - suave(q / 0.25);
    tronco = -0.6 + 1.6 * suave((q - 0.1) / 0.35);
    asiento = 1 - 2 * suave((q - 0.3) / 0.7);
  }
  const mano = 0.5 * asiento - 0.3 * tronco + 0.2 * (2 * brazos - 1); // −1 en el ataque, ≈ +0,9 en el final
  const pluma = fase < EMPUJE ? 0 : suave((fase - EMPUJE) / 0.06) * (1 - suave((fase - 0.92) / 0.08));
  return { ang: 0.125 - 0.725 * mano, asiento, tronco, brazos, agua: fase > 0.02 && fase < EMPUJE - 0.02, pluma };
}

// Colores del remero de cada clase: ropa y pelo (o tocado).
const REMEROS = {
  vikingo: { ropa: '#7C2D12', pelo: '#C2410C' },
  pirata: { ropa: '#1F2937', pelo: '#B91C1C' },
  samurai: { ropa: '#1E3A8A', pelo: '#111827' },
  polinesio: { ropa: '#0E7490', pelo: '#1C1917' },
  romano: { ropa: '#991B1B', pelo: '#A16207' },
};
const PIEL = '#E2B48C';

// Remero, barca y remos realistas de cada clase, renderizados en Blender (tools/blender/remo_agua: remo_agua.py
// --paso 24 --sprite --remo-corto --clase C, cámara carrera3d o cenital, y atlas_carrera.py). Un atlas por clase y
// vista con una palada entera: el fotograma sale de la fase. ancla es el escálamo a ras de agua; ppm, píxeles por metro
// del render en ese punto. Se descargan al pintar el primer bote de esa clase; mientras, se dibuja el bote vectorial.
export const REMEROS_ATLAS = {
  '3d': { w: 208, h: 127, cols: 4, n: 24, ancla: [104.0, 77.2], ppm: 53.25 },
  '2d': { w: 231, h: 163, cols: 4, n: 24, ancla: [93.2, 80.0], ppm: 39.0 },
};
// La barca de Blender mide 5,4 m: de la popa al escálamo 1,89 m y del escálamo a la proa 3,51 m.
const BARCA_REAL = { largo: 5.4, proa: 3.51 };
export const srcRemero = (vista, clase) => `assets/carrera/remero${vista}_${clase}.webp`;
function celdaRemero(vista, b) {
  if (!BOTES[b.clase]) return null;
  const im = imagen(srcRemero(vista, b.clase));
  if (!im) return null;
  const A = REMEROS_ATLAS[vista];
  // Parado, el remero espera con las palas planas (justo después del final de la palada)
  const f = Math.floor((b.spm ? b.fase : EMPUJE + 0.06) * A.n) % A.n;
  return { im, A, sx: (f % A.cols) * A.w, sy: Math.floor(f / A.cols) * A.h };
}

// La vista realista es un vídeo de 720 px de alto escalado: más de 1,5 píxeles por punto no se nota y
// cuesta mucho dibujarlo (con densidad 2,6 era el 70 % del tiempo de cada cuadro).
const DPR_MAX = { real: 1.5 };
function preparar(canvas, modo) {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX[modo] ?? Infinity);
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (!ancho || !alto) return null;
  if (canvas.width !== Math.round(ancho * dpr) || canvas.height !== Math.round(alto * dpr)) {
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  return { ctx, ancho, alto };
}

export function pintarCarrera(c, ahora = performance.now()) {
  const p = preparar(c.canvas, c.modo);
  if (!p) return;
  const datos = interpolar(c, ahora);
  const arriba = altoCabecera(c);
  if (c.modo === 'real' && c.estado.yoClase === 'vikingo' && pintarReal(c, p, datos, arriba)) { /* clip listo */ }
  else if (c.modo === '3d' || c.modo === 'real') pintar3d(c, p, datos, arriba);
  else pintar2d(c, p, datos, arriba);
  sprintFinal(c, p, datos, arriba);
  avisos(c, p, datos, arriba);
  cabecera(c, p);
  minimapa(c, p, datos, arriba);
  insignia(c, p);
}

// Pequeña pastilla en la esquina que recuerda que tocar cambia de vista.
const textoInsignia = (c) => (c.modo === '2d' ? 'Toca: 3D' : c.modo === '3d' && c.estado?.yoClase === 'vikingo' ? 'Toca: realista' : 'Toca: 2D');
// Ancho que ocupa la pastilla con su margen (el reloj de la derecha empieza antes).
function anchoInsignia(c, ctx) {
  ctx.font = '600 11px system-ui, sans-serif';
  return Math.max(76, ctx.measureText(textoInsignia(c)).width + 14 + 6);
}
function insignia(c, { ctx, ancho }) {
  const txt = textoInsignia(c);
  ctx.font = '600 11px system-ui, sans-serif';
  const w = ctx.measureText(txt).width + 14;
  const x = ancho - w - 6;
  const y = 6;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, 18, 9) : ctx.rect(x, y, w, 18);
  ctx.fill();
  ctx.fillStyle = '#CBD5E1';
  ctx.textAlign = 'center';
  ctx.fillText(txt, x + w / 2, y + 13);
}

// Alto de la cabecera más el minimapa: la pista empieza debajo.
const MINIMAPA = 16;
const ancha = (c) => (c.canvas.clientWidth || 0) >= 480;
function altoCaja(c) {
  const e = c.estado;
  // En pantallas anchas (horizontal) el reloj y la línea extra van a la derecha: la cabecera queda en dos filas.
  if (ancha(c)) return e.lugar || e.cabecera?.[1] ? 48 : 30;
  const extra = e.cabecera?.[1] ? 15 : 0;
  const reloj = e.reloj ? 20 : 0;
  return (e.lugar ? 48 : 30) + reloj + extra;
}
const altoCabecera = (c) => altoCaja(c) + MINIMAPA;

// Recorta un texto para que quepa en el ancho dado.
function cabe(ctx, txt, max) {
  if (max <= 0) return '';
  if (ctx.measureText(txt).width <= max) return txt;
  while (txt.length > 1 && ctx.measureText(`${txt}…`).width > max) txt = txt.slice(0, -1);
  return `${txt}…`;
}

const reloj = (s) => {
  const seg = Math.max(0, Math.round(s));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const ss = String(seg % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

// Escribe trozos de texto con su propio estilo uno tras otro; devuelve el ancho total.
function trozos(ctx, partes, x, y, medir = false) {
  let w = 0;
  for (const [txt, fuente, color] of partes) {
    ctx.font = fuente;
    if (!medir) { ctx.fillStyle = color; ctx.fillText(txt, x + w, y); }
    w += ctx.measureText(txt).width;
  }
  return w;
}

function partesReloj(r) {
  const p = [['⏱ ', '700 13px system-ui, sans-serif', '#CBD5E1'], [reloj(r.lleva), '800 15px system-ui, sans-serif', '#F8FAFC']];
  if (r.falta != null) {
    p.push(['   faltan ', '600 12px system-ui, sans-serif', '#CBD5E1']);
    p.push([`${r.porRitmo ? '≈' : ''}${reloj(r.falta)}`, '800 15px system-ui, sans-serif', '#FDE047']);
  }
  if (r.lugar && r.falta) p.push([`  · a este ritmo, ${r.lugar}º`, '600 12px system-ui, sans-serif', '#CBD5E1']);
  return p;
}

// En horizontal: reloj y línea extra alineados a la derecha. Devuelve hasta dónde puede llegar lo de la izquierda.
function ladoDerecho(c, ctx, ancho, l2) {
  const e = c.estado;
  const borde = ancho - anchoInsignia(c, ctx) - 6;
  let izq = borde;
  if (e.reloj) {
    const partes = partesReloj(e.reloj);
    const w = trozos(ctx, partes, 0, 0, true);
    izq = Math.min(izq, borde - w - 10);
    trozos(ctx, partes, borde - w, 20);
  }
  if (l2) {
    ctx.font = '600 11px system-ui, sans-serif';
    const max = Math.max(120, ancho * 0.45);
    const txt = cabe(ctx, l2, max);
    const w = ctx.measureText(txt).width;
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'left';
    ctx.fillText(txt, ancho - 10 - w, 40);
    izq = Math.min(izq, ancho - 10 - w - 10);
  }
  return izq;
}

function cabecera(c, { ctx, ancho }) {
  const e = c.estado;
  const [l1, l2] = e.cabecera || [];
  const alto = altoCaja(c);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
  ctx.fillRect(0, 0, ancho, alto + MINIMAPA);
  const color = { adelante: '#4ADE80', atras: '#FCA5A5' }[e.tono] || '#F8FAFC';
  const insigniaW = anchoInsignia(c, ctx) - 2;
  let y = 0;
  ctx.textAlign = 'left';
  if (e.lugar) {
    // Lugar en grande a la izquierda; a la derecha, el rival de delante y el de detrás.
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText(`${e.lugar}º`, 30, 29);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`de ${e.total}`, 30, 42);
    ctx.textAlign = 'left';
    const filas = e.cercanos || [];
    // Las filas llegan como mucho hasta la pastilla de la esquina (o hasta el reloj en horizontal).
    let derecha = ancho - insigniaW - 8;
    if (ancha(c)) derecha = ladoDerecho(c, ctx, ancho, l2);
    filas.forEach((f, i) => {
      const fy = filas.length === 1 ? 27 : 19 + i * 18;
      // Sin signo: «delante» o «detrás» ya dice el lado y así no choca con el signo de los carriles (que es el del rival).
      const tiempo = f.seg >= 60 ? `${Math.floor(f.seg / 60)}:${String(f.seg % 60).padStart(2, '0')}` : `${f.seg} s`;
      const num = `${f.m.toLocaleString('es-MX')} m${f.seg != null && f.m >= 1 ? ` · ${tiempo}` : ''}`;
      const flecha = f.delante ? '▲ ' : '▼ ';
      ctx.font = '800 13px system-ui, sans-serif';
      const wNum = ctx.measureText(num).width;
      ctx.font = '600 11px system-ui, sans-serif';
      const palabra = f.delante ? ' delante' : ' detrás';
      const wPal = ctx.measureText(palabra).width;
      ctx.font = '700 12px system-ui, sans-serif';
      const wFl = ctx.measureText(flecha).width;
      const libre = derecha - 64 - wFl - wNum - 6;
      const conPalabra = ctx.measureText(f.nombre).width + wPal <= libre;
      const nombre = cabe(ctx, f.nombre, conPalabra ? libre - wPal : libre);
      trozos(ctx, [
        [flecha, '700 12px system-ui, sans-serif', f.delante ? '#FCA5A5' : '#4ADE80'],
        [`${nombre} `, '700 12px system-ui, sans-serif', f.color],
        [` ${num}`, '800 13px system-ui, sans-serif', '#F8FAFC'],
        [conPalabra ? palabra : '', '600 11px system-ui, sans-serif', '#94A3B8'],
      ], 64, fy);
    });
    y = 48;
  } else if (l1) {
    ctx.textAlign = 'center';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(cabe(ctx, l1, ancho - 2 * insigniaW - 16), ancho / 2, 21);
    y = 30;
  }
  ctx.textAlign = 'left';
  if (ancha(c)) {
    if (!e.lugar) ladoDerecho(c, ctx, ancho, l2);
    return;
  }
  if (e.reloj) {
    const partes = partesReloj(e.reloj);
    const w = trozos(ctx, partes, 0, 0, true);
    trozos(ctx, partes, Math.max(8, (ancho - w) / 2), y + 14);
    y += 20;
  }
  if (l2) {
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'center';
    ctx.fillText(cabe(ctx, l2, ancho - 16), ancho / 2, y + 10);
  }
}

// Barra fina de 0 a la meta con un punto por bote.
function minimapa(c, { ctx, ancho }, { botes, referencias }, arriba) {
  const e = c.estado;
  const y = arriba - MINIMAPA / 2;
  const x0 = 14;
  const lejos = Math.max(...botes.map((b) => b.dist), ...referencias.map((r) => r.dist));
  const fin = e.meta ?? Math.max(200, Math.ceil((lejos * 1.25) / 100) * 100);
  // Sin meta, la etiqueta del final deja su propio espacio a la derecha para no cortarse.
  ctx.font = '600 9px system-ui, sans-serif';
  const etqFin = e.meta != null ? '' : fin >= 1000 ? `${(fin / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km` : `${fin} m`;
  const x1 = ancho - (etqFin ? Math.ceil(ctx.measureText(etqFin).width) + 8 : 22);
  const X = (m) => x0 + (Math.max(0, Math.min(fin, m)) / fin) * (x1 - x0);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  if (e.meta != null) {
    // Banderita a cuadros en la meta y tramo del sprint marcado.
    ctx.strokeStyle = 'rgba(239,68,68,0.55)';
    ctx.beginPath(); ctx.moveTo(X(e.meta - SPRINT_M), y); ctx.lineTo(x1, y); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = (i + (i > 1 ? 1 : 0)) % 2 ? '#111' : '#fff';
      ctx.fillRect(x1 + 4 + (i % 2) * 4, y - 4 + Math.floor(i / 2) * 4, 4, 4);
    }
  } else {
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.fillText(etqFin, x1 + 3, y + 3);
  }
  for (const r of referencias) {
    ctx.fillStyle = COLOR_RITMO;
    ctx.fillRect(X(r.dist) - 1, y - 5, 2, 10);
  }
  for (const b of [...botes.slice(1), botes[0]]) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(X(b.dist), y, b.yo ? 5 : 3.6, 0, Math.PI * 2); ctx.fill();
    if (b.yo) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
}

// Últimos 250 m: borde que late, contador grande y, al cruzar, el puesto de llegada.
function sprintFinal(c, { ctx, ancho, alto }, { falta, sprint, t }, arriba) {
  const e = c.estado;
  if (sprint) {
    const late = sinMovimiento ? 0.5 : 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
    ctx.strokeStyle = `rgba(239,68,68,${0.35 + 0.35 * late})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, arriba + 2, ancho - 4, alto - arriba - 4);
    // Contador del sprint en una pastilla arriba al centro, sin tapar los botes.
    const txt = `${Math.ceil(falta)} m`;
    ctx.font = '900 22px system-ui, sans-serif';
    const w = ctx.measureText(txt).width + 64;
    const y = arriba + 8;
    ctx.fillStyle = `rgba(127,29,29,${0.82 + 0.1 * late})`;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(ancho / 2 - w / 2, y, w, 30, 15) : ctx.rect(ancho / 2 - w / 2, y, w, 30);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.fillStyle = '#FECACA';
    ctx.fillText('SPRINT', ancho / 2 - w / 2 + 12, y + 19);
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.fillText(txt, ancho / 2 + w / 2 - 12, y + 23);
  } else if (falta != null && falta <= 0 && e.lugar) {
    const txt = `🏁 Llegaste ${e.lugar}º de ${e.total}`;
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(txt).width + 28;
    const y = arriba + (alto - arriba) * 0.5;
    ctx.fillStyle = 'rgba(2,6,23,0.78)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(ancho / 2 - w / 2, y - 22, w, 34, 17) : ctx.rect(ancho / 2 - w / 2, y - 22, w, 34);
    ctx.fill();
    ctx.fillStyle = e.lugar === 1 ? '#FACC15' : '#F8FAFC';
    ctx.fillText(txt, ancho / 2, y);
  }
}

// Adelantos (destello y aviso al centro) y ventajas (+15 m que sube desde tu bote).
function avisos(c, { ctx, ancho, alto }, { eventos }, arriba) {
  let fila = 0;
  for (const ev of eventos) {
    const a = sinMovimiento ? 1 : Math.min(1, (1 - ev.edad) * 3);
    if (ev.tipo === 'ventaja') {
      const p = c.yoPantalla;
      if (!p) continue;
      const sube = sinMovimiento ? 0 : ev.edad * 34;
      ctx.globalAlpha = a;
      ctx.font = '900 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(2,6,23,0.8)';
      ctx.strokeText(ev.texto, p.x, p.y - 14 - sube);
      ctx.fillStyle = '#FDE047';
      ctx.fillText(ev.texto, p.x, p.y - 14 - sube);
      if (ev.detalle) {
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.strokeText(ev.detalle, p.x, p.y - 2 - sube);
        ctx.fillText(ev.detalle, p.x, p.y - 2 - sube);
      }
      ctx.globalAlpha = 1;
      continue;
    }
    const bueno = ev.tipo === 'adelanto' || ev.tipo === 'salida';
    // Destello breve de toda la pista al principio del aviso.
    if (!sinMovimiento && ev.edad < 0.25) {
      ctx.fillStyle = bueno ? `rgba(74,222,128,${0.28 * (1 - ev.edad / 0.25)})` : `rgba(239,68,68,${0.28 * (1 - ev.edad / 0.25)})`;
      ctx.fillRect(0, arriba, ancho, alto - arriba);
    }
    ctx.globalAlpha = a;
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(ev.texto).width + 24;
    const y = arriba + (c.estado.meta != null && c.estado.meta - c.yoVista <= SPRINT_M ? 64 : 26) + fila * 32;
    ctx.fillStyle = bueno ? 'rgba(20,83,45,0.92)' : 'rgba(127,29,29,0.92)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(ancho / 2 - w / 2, y - 18, w, 27, 13) : ctx.rect(ancho / 2 - w / 2, y - 18, w, 27);
    ctx.fill();
    ctx.fillStyle = bueno ? '#BBF7D0' : '#FECACA';
    ctx.fillText(ev.texto, ancho / 2, y);
    ctx.globalAlpha = 1;
    fila++;
  }
}

// ---------- 2D: vista desde arriba, la cámara sigue tu bote ----------
function pintar2d(c, { ctx, ancho, alto }, { botes, dt, t, ritmo, referencias = [], sprint }, arriba) {
  const n = botes.length;
  const orilla = Math.min(30, alto * 0.07);
  const abajo = 18;
  const carril = Math.min(90, (alto - arriba - abajo - 2 * orilla) / n);
  const pista = carril * n;
  const y0 = arriba + orilla + Math.max(0, (alto - arriba - abajo - 2 * orilla - pista) / 2);
  const yo = botes[0];

  // Zoom automático: la ventana se abre para que quepan todos los botes y se centra entre el primero y el último.
  // Solo si alguno queda a más de 3 km se señala en el borde. En el sprint se acerca si no deja a nadie fuera.
  const dists = botes.map((b) => b.dist).filter((d) => Math.abs(d - yo.dist) < 3000);
  const minD = Math.min(...dists);
  const maxD = Math.max(...dists);
  const separacion = maxD - minD;
  let objetivo = Math.max(50, separacion * 1.45 + 30);
  if (sprint && separacion < 20) objetivo = Math.max(40, objetivo * 0.7);
  c.ventana += (objetivo - c.ventana) * Math.min(1, dt * 2);
  if (sinMovimiento || !c.ventanaLista) { c.ventana = objetivo; c.ventanaLista = true; }
  const ventana = c.ventana;
  // Centro relativo a tu bote, suavizado (así no tiembla con tu avance). El bote se dibuja hacia atrás desde la proa.
  const centroObj = (minD + maxD) / 2 - ventana * 0.04 - yo.dist;
  c.centro = c.centro == null || sinMovimiento ? centroObj : c.centro + (centroObj - c.centro) * Math.min(1, dt * 2);
  const X = (m) => ancho / 2 + ((m - yo.dist - c.centro) / ventana) * ancho;
  const M = (x) => yo.dist + c.centro + ((x - ancho / 2) / ancho) * ventana;
  const ppm = ancho / ventana;
  // Con la ventana muy abierta se dibujan menos olas, boyas y árboles.
  const escala = Math.max(1, ventana / 120);

  // Orillas: si sobra alto, la tierra llena el espacio en vez de dejar franjas vacías.
  const tierraArriba = Math.max(orilla, y0 - arriba);
  const tierraAbajo = Math.max(orilla, alto - abajo - (y0 + pista));
  ctx.fillStyle = paisaje.colores.tierra2d;
  ctx.fillRect(0, y0 - tierraArriba, ancho, tierraArriba);
  ctx.fillRect(0, y0 + pista, ancho, alto - (y0 + pista));
  const costa = imagen(paisaje.costa);
  if (costa) {
    // La tira avanza con tu bote: el desplazamiento se acumula en píxeles para que el zoom no la haga saltar.
    if (!c.costa || sinMovimiento) c.costa = { px: yo.dist * ppm, dist: yo.dist };
    c.costa.px += (yo.dist - c.costa.dist) * ppm;
    c.costa.dist = yo.dist;
    const tira = (y, h, volteada) => {
      // Escala mínima fija: con poca tierra se ve solo la franja junto al agua, sin encoger el bosque.
      const k = Math.max(0.45, h / costa.naturalHeight);
      const w = costa.naturalWidth * k;
      const sh = Math.min(costa.naturalHeight, h / k);
      const x0 = -(((c.costa.px % w) + w) % w);
      ctx.save();
      ctx.translate(0, y);
      if (volteada) ctx.scale(1, -1);
      conFiltro(ctx, () => { for (let x = x0; x < ancho; x += w) ctx.drawImage(costa, 0, costa.naturalHeight - sh, costa.naturalWidth, sh, x, -h, w + 0.5, h); });
      ctx.restore();
    };
    tira(y0, tierraArriba, false);
    tira(y0 + pista, tierraAbajo, true);
  } else {
    ctx.fillStyle = '#C2A878';
    ctx.fillRect(0, y0 - 3, ancho, 3);
    ctx.fillRect(0, y0 + pista, ancho, 3);
    // Árboles en la orilla, anclados al mundo (se desplazan al avanzar)
    ctx.fillStyle = '#2F6B3F';
    const pasoArbol = 9 * Math.ceil(escala);
    for (let m = Math.floor(M(0) / pasoArbol) * pasoArbol; m < M(ancho) + pasoArbol; m += pasoArbol) {
      const r = Math.min(orilla * 0.42, 6);
      ctx.beginPath(); ctx.arc(X(m), y0 - orilla / 2 - 1, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(X(m + pasoArbol / 2), y0 + pista + orilla / 2 + 1, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Agua
  const grad = ctx.createLinearGradient(0, y0, 0, y0 + pista);
  grad.addColorStop(0, paisaje.colores.agua2d[0]);
  grad.addColorStop(1, paisaje.colores.agua2d[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, y0, ancho, pista);

  // Olas ancladas al mundo, con un brillo que va y viene
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.2;
  const pasoOla = 4 * Math.ceil(escala);
  for (let fila = 0; fila < n * 3; fila++) {
    const y = y0 + (fila + 0.5) * (pista / (n * 3));
    const desf = (fila % 2) * 2;
    for (let m = Math.floor(M(0) / pasoOla) * pasoOla + desf; m < M(ancho) + pasoOla; m += pasoOla) {
      const brillo = sinMovimiento ? 0 : Math.sin(t * 1.6 + m * 0.9 + fila);
      if (brillo < 0) continue;
      const l = Math.min(10, ppm * 1.4);
      ctx.beginPath(); ctx.arc(X(m), y + 3, l, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
  }

  // Líneas de boyas entre carriles: puntos cada 5 m, rojos cada 25 m, boya grande cada 250 m
  const pasoBoya = escala > 8 ? 50 : escala > 3 ? 25 : 5;
  for (let k = 1; k < n; k++) {
    const y = y0 + k * carril;
    for (let m = Math.floor(M(0) / pasoBoya) * pasoBoya; m < M(ancho) + pasoBoya; m += pasoBoya) {
      if (m < 0) continue;
      const grande = m % 250 === 0;
      ctx.fillStyle = grande ? '#F2A33A' : m % 25 === 0 ? '#EF4444' : 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(X(m), y, grande ? 5 : Math.min(2.6, ppm * 0.35 + 1), 0, Math.PI * 2); ctx.fill();
    }
  }

  // Marcas de distancia
  const paso = [10, 25, 50, 100, 250, 500, 1000].find((q) => ventana / q <= 6) || 2000;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let m = Math.ceil(M(0) / paso) * paso; m <= M(ancho); m += paso) {
    if (m < 0) continue;
    const x = X(m);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + pista); ctx.stroke();
    // La etiqueta que no cabe entera en el borde no se escribe (antes salía cortada).
    const etq = `${m.toLocaleString('es-MX')} m`;
    const medio = ctx.measureText(etq).width / 2;
    if (x - medio < 2 || x + medio > ancho - 2) continue;
    // Con borde oscuro: se lee igual sobre la nieve del glaciar que sobre la tierra oscura del fiordo
    ctx.strokeStyle = 'rgba(15,23,42,0.7)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(etq, x, alto - 4);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(etq, x, alto - 4);
  }

  // Meta
  const meta = c.estado.meta;
  if (meta != null && X(meta) > -10 && X(meta) < ancho + 10) {
    const x = X(meta);
    const q = 6;
    for (let y = y0, i = 0; y < y0 + pista; y += q, i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#111';
      ctx.fillRect(x - q, y, q, Math.min(q, y0 + pista - y));
      ctx.fillStyle = i % 2 ? '#111' : '#fff';
      ctx.fillRect(x, y, q, Math.min(q, y0 + pista - y));
    }
  }

  // Línea del ritmo objetivo: dónde estarías remando justo a ese split
  if (ritmo && X(ritmo.dist) > -10 && X(ritmo.dist) < ancho + 10) {
    const x = X(ritmo.dist);
    ctx.strokeStyle = COLOR_RITMO;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + pista); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = x > ancho - 60 ? 'right' : 'left';
    ctx.fillStyle = COLOR_RITMO;
    ctx.fillText(ritmo.etiqueta, x + (x > ancho - 60 ? -4 : 4), y0 + pista - 4);
  } else if (ritmo) {
    const der = X(ritmo.dist) > ancho;
    const dif = Math.round(ritmo.dist - yo.dist);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = der ? 'right' : 'left';
    ctx.fillStyle = COLOR_RITMO;
    ctx.fillText(`${der ? '' : '◀ '}${ritmo.etiqueta} ${dif > 0 ? '+' : '−'}${Math.abs(dif)} m${der ? ' ▶' : ''}`, der ? ancho - 6 : 6, y0 + pista - 4);
  }

  // Referencias (tu anterior, tu mejor): línea amarilla solo en tu carril, el de abajo.
  const xsRef = referencias.map((r) => X(r.dist));
  const ocupados = [];
  referencias.forEach((r, k) => {
    const yA = y0 + carril * (n - 1) + 3;
    const yB = y0 + pista - 3;
    const x = X(r.dist);
    // Si dos líneas quedan juntas, cada etiqueta va de un lado para no encimarse.
    ctx.font = 'bold 11px system-ui, sans-serif';
    const wEtq = ctx.measureText(r.etiqueta).width + 16;
    const chocaDer = xsRef.some((ox, j) => j !== k && ox > x && ox < x + wEtq);
    const chocaIzq = xsRef.some((ox, j) => j !== k && ox < x && ox > x - wEtq);
    const aLaIzq = x > ancho - wEtq || (chocaDer && !chocaIzq);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = COLOR_RITMO;
    if (x > -10 && x < ancho + 10) {
      ctx.strokeStyle = COLOR_RITMO;
      ctx.lineWidth = 3;
      ctx.setLineDash(r.discontinua ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(x, yA); ctx.lineTo(x, yB); ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = aLaIzq ? 'right' : 'left';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(2,6,23,0.7)';
      // Si aun así choca con otra etiqueta, sube un renglón.
      const x0 = aLaIzq ? x - 5 - (wEtq - 16) : x + 5;
      let ty = yB - 4;
      while (ocupados.some((o) => o.y === ty && x0 < o.x1 + 4 && x0 + wEtq - 16 > o.x0 - 4)) ty -= 13;
      ocupados.push({ x0, x1: x0 + wEtq - 16, y: ty });
      ctx.strokeText(r.etiqueta, x + (aLaIzq ? -5 : 5), ty);
      ctx.fillText(r.etiqueta, x + (aLaIzq ? -5 : 5), ty);
    } else {
      const der = x > ancho;
      const dif = Math.round(r.dist - yo.dist);
      ctx.textAlign = der ? 'right' : 'left';
      // Fuera de la ventana: aviso en el borde con fondo, para leerse aunque pase tu bote.
      const txt = `${der ? '' : '◀ '}${r.etiqueta} ${dif > 0 ? '+' : '−'}${Math.abs(dif)} m${der ? ' ▶' : ''}`;
      const w = ctx.measureText(txt).width;
      const tx = der ? ancho - 6 : 6;
      const ty = yB - 4 - k * 14;
      ctx.fillStyle = 'rgba(2,6,23,0.7)';
      ctx.fillRect(der ? tx - w - 3 : tx - 3, ty - 10, w + 6, 13);
      ctx.fillStyle = COLOR_RITMO;
      ctx.fillText(txt, tx, ty);
    }
  });

  // Remolinos que deja cada pala al salir del agua: se quedan en su sitio del lago y se borran solos.
  c.charcos = (c.charcos || []).filter((h) => t - h.t < 2.4);
  for (const h of c.charcos) {
    const x = X(h.m);
    if (x < -20 || x > ancho + 20) continue;
    const k = (t - h.t) / 2.4;
    ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - k)})`;
    ctx.lineWidth = 1.2;
    const y = y0 + carril * (h.fila + 0.58) + h.dy * carril;
    for (const r of [0.5, 1]) {
      ctx.beginPath(); ctx.ellipse(x, y, (2 + 7 * k) * r, (1.4 + 4 * k) * r, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Botes: los rivales arriba, tú en el carril de abajo
  const orden = [...botes.slice(1), botes[0]];
  c.fasePrevia = c.fasePrevia || new Map();
  orden.forEach((b, fila) => {
    const y = y0 + carril * (fila + 0.58);
    const largo = Math.max(72, Math.min(150, ppm * 10));
    const x = X(b.dist);
    // Fuera de la ventana: la flecha va dentro de la pastilla de la diferencia, sin tapar el nombre.
    const fuera = x > ancho + largo * 0.2 ? 1 : x < -largo * 0.2 ? -1 : 0;
    etiqueta2d(ctx, b, yo, y0 + carril * fila, carril, ancho, c.estado, fuera);
    if (fuera) return;
    const remo = Math.min(carril * 0.4, 34);
    const pa = bote2d(ctx, x, y, largo, remo, b, ppm, t);
    // Al pasar del final de la palada, un remolino por pala.
    const antes = c.fasePrevia.get(b.nombre);
    c.fasePrevia.set(b.nombre, b.fase);
    if (!sinMovimiento && b.spm && antes != null && antes < EMPUJE && b.fase >= EMPUJE) {
      const anchoB = Math.max(7, largo * 0.09);
      for (const lado of [-1, 1]) {
        const bx = x - largo * 0.5 + Math.sin(pa.ang) * remo;
        const by = lado * (anchoB * 0.9 + Math.cos(pa.ang) * remo);
        c.charcos.push({ m: M(bx), fila, dy: by / carril, t });
      }
    }
    if (b.yo) c.yoPantalla = { x: x - largo * 0.5, y: y - carril * 0.2 };
  });
}

// Etiqueta del carril: retrato y nombre corto a la izquierda, diferencia a la derecha.
function etiqueta2d(ctx, b, yo, yCarril, carril, ancho, e, fuera = 0) {
  const r = Math.max(6, Math.min(10, carril * 0.17));
  const y = yCarril + r + 3;
  let x = 6;
  if (b.retrato || b.clase) {
    retrato(ctx, b.retrato, x + r, y, r, b.color);
    x += r * 2 + 5;
  }
  ctx.textAlign = 'left';
  const extra = b.acelera ? ' ⚡ acelera' : b.aviso ? ` ⚡ en ${b.aviso} s` : '';
  ctx.font = 'bold 12px system-ui, sans-serif';
  const wNombre = ctx.measureText(b.nombre).width;
  ctx.font = '700 11px system-ui, sans-serif';
  const wExtra = extra ? ctx.measureText(extra).width : 0;
  // Fondo oscuro para que el nombre se lea aunque pase un bote por debajo.
  ctx.fillStyle = 'rgba(2,6,23,0.55)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - 3, y - 8, wNombre + wExtra + 8, 16, 8) : ctx.rect(x - 3, y - 8, wNombre + wExtra + 8, 16);
  ctx.fill();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = b.color;
  ctx.fillText(b.nombre, x, y + 4);
  x += wNombre;
  // Acelerón en curso o anunciado por el Mapa del rival
  if (extra) {
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(extra, x, y + 4);
  }
  // Diferencia a la derecha del carril, en una pastilla
  let txt = '';
  let color = '#F8FAFC';
  if (b.yo) {
    if ((e.ventajaM || 0) >= 1) { txt = `⚑ +${Math.round(e.ventajaM)} m`; color = '#FDE047'; }
  } else {
    const d = Math.round(b.dist - yo.dist);
    txt = d === 0 ? 'parejos' : `${fuera < 0 ? '◀ ' : ''}${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('es-MX')} m${fuera > 0 ? ' ▶' : ''}`;
    color = d > 0 ? '#FCA5A5' : d < 0 ? '#86EFAC' : '#F8FAFC';
  }
  if (!txt) return;
  ctx.font = '800 12px system-ui, sans-serif';
  const w = ctx.measureText(txt).width + 12;
  const px = ancho - w - 6;
  const py = yCarril + 3;
  ctx.fillStyle = 'rgba(2,6,23,0.6)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(px, py, w, 17, 8) : ctx.rect(px, py, w, 17);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(txt, px + w / 2, py + 13);
}

// Bandera de popa que ondea.
function bandera2d(ctx, x, y, tam, deco, t) {
  const o = sinMovimiento ? 0 : Math.sin(t * 6 + x * 0.05) * tam * 0.18;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - tam * 0.2); ctx.stroke();
  ctx.fillStyle = deco.tela;
  ctx.beginPath();
  ctx.moveTo(x, y - tam * 0.2);
  ctx.quadraticCurveTo(x - tam * 0.5, y - tam * 0.2 + o, x - tam, y - tam * 0.05 + o);
  ctx.lineTo(x - tam, y + tam * 0.35 + o);
  ctx.quadraticCurveTo(x - tam * 0.5, y + tam * 0.45 + o, x, y + tam * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = deco.marca;
  ctx.beginPath(); ctx.arc(x - tam * 0.5, y + tam * 0.1 + o * 0.6, tam * 0.14, 0, Math.PI * 2); ctx.fill();
}

function bote2d(ctx, x, y, largo, remo, b, ppm, t) {
  const deco = decoDe(b);
  let ancho = Math.max(7, largo * 0.09);
  if (b.clase === 'pirata' || b.clase === 'romano') ancho *= 1.25;
  // Barca, remero y remos realistas vistos desde arriba, con la misma escala a lo largo y a lo ancho: como mucho el
  // largo del bote y que los remos (1,9 m desde el eje) no pasen del 60 % del carril (remo es el 40 %). La proa sigue
  // en x; el casco mide 1 m de manga.
  const real = celdaRemero('2d', b);
  const kx = real ? Math.min(largo / BARCA_REAL.largo, (remo * 1.5) / 1.9) / real.A.ppm : 0;
  const ky = kx;
  if (real) {
    largo = BARCA_REAL.largo * kx * real.A.ppm;
    ancho = 0.5 * kx * real.A.ppm;
  }
  ctx.globalAlpha = b.yo ? 1 : 0.88;
  // Estela en V que crece con la velocidad; con un acelerón, más espuma.
  const estela = Math.min(largo * 1.4, b.v * ppm * 3 * (b.acelera ? 1.4 : 1));
  if (estela > 2) {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.35 - i * 0.1})`;
      ctx.lineWidth = 1.5;
      const off = i * 4;
      ctx.beginPath();
      ctx.moveTo(x - largo - off, y - ancho * 0.4);
      ctx.lineTo(x - largo - estela - off, y - ancho * 1.6 - i * 3);
      ctx.moveTo(x - largo - off, y + ancho * 0.4);
      ctx.lineTo(x - largo - estela - off, y + ancho * 1.6 + i * 3);
      ctx.stroke();
    }
  }
  if (b.acelera) espuma2d(ctx, x, y, ancho, largo, t);
  // Brillo dorado cuando ganas metros con un talento
  if (b.brillo) {
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = sinMovimiento ? 14 : 12 + 8 * Math.sin(t * 10);
  }
  // Canoa polinesia: flotador lateral unido con dos varas
  if (b.clase === 'polinesio') {
    ctx.strokeStyle = '#E7D3A8';
    ctx.lineWidth = 1.5;
    const yAma = y - ancho * 2.6;
    for (const k of [0.3, 0.7]) { ctx.beginPath(); ctx.moveTo(x - largo * k, y); ctx.lineTo(x - largo * k, yAma); ctx.stroke(); }
    ctx.fillStyle = '#C9A46A';
    ctx.beginPath(); ctx.ellipse(x - largo * 0.5, yAma, largo * 0.32, ancho * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Trirreme: espolón de bronce en la proa
  if (b.clase === 'romano') {
    ctx.fillStyle = '#B45309';
    ctx.beginPath(); ctx.moveTo(x + largo * 0.1, y); ctx.lineTo(x - 2, y - ancho * 0.35); ctx.lineTo(x - 2, y + ancho * 0.35); ctx.fill();
  }
  if (real) {
    const { im, A, sx, sy } = real;
    const ex = x - largo * (BARCA_REAL.proa / BARCA_REAL.largo);
    ctx.drawImage(im, sx, sy, A.w, A.h, ex - A.ancla[0] * kx, y - A.ancla[1] * ky, A.w * kx, A.h * ky);
    ctx.shadowBlur = 0;
    if (deco) velaReal2d(ctx, x, y, largo, ancho, b, deco, t, kx * A.ppm);
    ctx.globalAlpha = 1;
    return palada(b.fase, b.spm);
  }
  // Casco (la barca samurái tiene la popa recta)
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  if (b.clase === 'samurai') {
    ctx.quadraticCurveTo(x - largo * 0.3, y - ancho, x - largo, y - ancho * 0.75);
    ctx.lineTo(x - largo, y + ancho * 0.75);
    ctx.quadraticCurveTo(x - largo * 0.3, y + ancho, x, y);
  } else {
    ctx.quadraticCurveTo(x - largo * 0.35, y - ancho, x - largo, y - ancho * 0.25);
    ctx.lineTo(x - largo, y + ancho * 0.25);
    ctx.quadraticCurveTo(x - largo * 0.35, y + ancho, x, y);
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  if (deco) decoracion2d(ctx, x, y, largo, ancho, b, deco, t);
  // Remos y remero, vistos desde arriba: mira a la popa (izquierda) y el cuerpo mueve los remos.
  const pa = palada(b.fase, b.spm);
  const px = x - largo * 0.5; // chumaceras
  const col = REMEROS[b.clase] || { ropa: '#475569', pelo: '#334155' };
  const dentro = ancho * 1.1; // del escálamo al puño
  const pala = Math.max(3.5, ancho * 0.6);
  const manos = [];
  for (const lado of [-1, 1]) {
    const ex = px;
    const ey = y + lado * ancho * 0.9;
    const bx = ex + Math.sin(pa.ang) * remo;
    const by = ey + lado * Math.cos(pa.ang) * remo;
    const hx = ex - Math.sin(pa.ang) * dentro;
    const hy = ey - lado * Math.cos(pa.ang) * dentro;
    manos.push([hx, hy]);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(bx, by); ctx.stroke();
    // Pala: cuadrada (ancha) en el agua, girada (fina) en la recuperación; deja un remolino al salir.
    ctx.fillStyle = deco?.palas ? (pa.agua ? deco.palas.tela : deco.palas.marca) : pa.agua ? b.color : 'rgba(226,232,240,0.95)';
    ctx.beginPath(); ctx.ellipse(bx, by, pala * 0.55, pala * (0.42 - 0.27 * pa.pluma) + 0.4, pa.ang * lado + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    if (b.spm && b.fase < 0.14 && !sinMovimiento) {
      const k = b.fase / 0.14;
      ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
      for (let g = 0; g < 5; g++) {
        const a = g * 1.3 + lado;
        ctx.beginPath(); ctx.arc(bx + Math.cos(a) * (2 + 7 * k), by + Math.sin(a) * (2 + 7 * k), 1.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Cuerpo: piernas al reposapiés, tronco que se inclina, brazos a los puños y cabeza.
  const u = ancho * 1.25; // el remero es algo más grande que el casco para que se lea
  const cadera = px + ancho * (0.6 + 0.45 * pa.asiento);
  const pie = px - ancho * 0.9;
  const tronco = u * Math.sin(pa.tronco * (pa.tronco > 0 ? 0.55 : 0.4));
  const hombro = cadera - tronco;
  const anchoH = u * 0.6;
  ctx.strokeStyle = col.ropa;
  ctx.lineWidth = Math.max(1.6, u * 0.32);
  for (const lado of [-1, 1]) {
    const rodilla = (cadera + pie) / 2 - Math.max(0, 1 - (cadera - pie) / (ancho * 2)) * ancho * 0.3;
    ctx.beginPath(); ctx.moveTo(cadera, y + lado * ancho * 0.22); ctx.lineTo(rodilla, y + lado * ancho * 0.36); ctx.lineTo(pie, y + lado * ancho * 0.28); ctx.stroke();
  }
  ctx.fillStyle = col.ropa;
  ctx.beginPath(); ctx.ellipse((cadera + hombro) / 2, y, Math.max(anchoH * 0.7, Math.abs(cadera - hombro) / 2 + anchoH * 0.5), anchoH, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PIEL;
  ctx.lineWidth = Math.max(1.2, u * 0.2);
  manos.forEach(([hx, hy], k) => {
    const sy = y + (k ? 1 : -1) * anchoH;
    const codo = [(hombro + hx) / 2 + pa.brazos * ancho * 0.25, (sy + hy) / 2 + (k ? 1 : -1) * pa.brazos * ancho * 0.35];
    ctx.beginPath(); ctx.moveTo(hombro, sy); ctx.lineTo(codo[0], codo[1]); ctx.lineTo(hx, hy); ctx.stroke();
  });
  const rc = Math.max(2.4, u * 0.4);
  ctx.fillStyle = PIEL;
  ctx.beginPath(); ctx.arc(hombro - rc * 0.3, y, rc, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col.pelo;
  ctx.beginPath(); ctx.arc(hombro - rc * 0.1, y, rc, Math.PI * 0.5, Math.PI * 1.5, true); ctx.fill();
  ctx.globalAlpha = 1;
  return pa;
}

// Adornos de cada clase sobre el casco 2D (dragón y escudos, vela, estandarte...) y bandera en la popa.
function decoracion2d(ctx, x, y, largo, ancho, b, deco, t, real = false) {
  if (b.clase === 'vikingo') {
    // Cabeza de dragón en la proa y escudos en las bordas
    ctx.fillStyle = deco.marca;
    ctx.beginPath(); ctx.arc(x + ancho * 0.5, y, ancho * 0.45, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 5 && !real; k++) {
      const sx = x - largo * (0.22 + k * 0.13);
      for (const s of [-1, 1]) {
        ctx.fillStyle = k % 2 ? deco.tela : deco.marca;
        ctx.beginPath(); ctx.arc(sx, y + s * ancho * 0.62, Math.max(1.6, ancho * 0.28), 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (b.clase === 'pirata') {
    // Botavara y vela vistas desde arriba
    ctx.strokeStyle = '#8B5E34';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - largo * 0.3, y); ctx.lineTo(x - largo * 0.75, y - ancho * 1.4); ctx.stroke();
    ctx.fillStyle = 'rgba(241,245,249,0.85)';
    ctx.beginPath(); ctx.moveTo(x - largo * 0.3, y); ctx.quadraticCurveTo(x - largo * 0.5, y - ancho * 2.2, x - largo * 0.75, y - ancho * 1.4); ctx.closePath(); ctx.fill();
  } else if (b.clase === 'romano') {
    ctx.strokeStyle = deco.tela;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - largo * 0.15, y); ctx.lineTo(x - largo * 0.9, y); ctx.stroke();
  } else if (b.clase === 'samurai') {
    ctx.fillStyle = deco.marca;
    ctx.beginPath(); ctx.arc(x - largo * 0.82, y, ancho * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  bandera2d(ctx, x - largo + 2, y, Math.max(7, ancho * 1.5), deco, t);
}

// Espuma en la proa de un rival que acelera.
function espuma2d(ctx, x, y, ancho, largo, t) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + (sinMovimiento ? 0 : t * 9);
    const lado = i % 2 ? 1 : -1;
    const dx = -((i * 7 + (sinMovimiento ? 0 : t * 40)) % (largo * 0.5));
    ctx.beginPath();
    ctx.arc(x + dx, y + lado * (ancho * 0.9 + Math.abs(Math.sin(a)) * ancho * 0.8), 1.2 + (i % 3) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- Realista: tu vikingo remando en el fiordo, renderizado en Cycles ----------
// Clip en bucle de dos paladas (3,2 s a 37,5 golpes/min) de tools/blender/remo_agua; se reproduce a tu ritmo
// (spm / 37,5) y se para en la pausa. Uno apaisado y otro vertical, cada uno con su cámara (camara.json del render)
// para proyectar encima a los rivales: tu bote está en x = 0 y los carriles rivales detrás, en x = carrilReal(i).
export const CLIPS_REAL = {
  ancho: { src: 'assets/carrera/remo_vikingo.mp4', margen: [-1.8, 4], camara: { camara: [7.5, -4.0, 3.6], mira: [-6.0, 1.0, 1.0], lente: 36, res: [960, 540] } },
  alto: { src: 'assets/carrera/remo_vikingo_v.mp4', margen: [-0.8, 3.5], camara: { camara: [7.0, -4.6, 3.9], mira: [-6.0, 0.8, 0.5], lente: 34, res: [540, 720] } },
};
// Bote rival: el mismo render sin agua sobre fondo transparente (remo_agua.py --sprite + atlas_rival.py), una palada.
export const RIVAL_REAL = {
  src: 'assets/carrera/rival_vikingo.webp', w: 465, h: 112, cols: 8, n: 48, ancla: [291.9, 70.7], escala: 0.55,
  camara: { camara: [7.5, -4.0, 3.6], mira: [-6.0, 1.0, 1.0], lente: 36, res: [960, 540] },
};
const AGUA_REAL = 0.2;
// El primer carril va más lejos para que los remos del rival no crucen por delante de tu remero.
const carrilReal = (i) => -(6 + 4.5 * (i - 1));
const SPM_CLIP = 37.5;
// Distancia a la que se pinta un rival: comprimida al margen que deja ver cada cámara (por detrás hay menos sitio,
// porque tu bote está a la derecha del cuadro) para que todos quepan; su etiqueta dice la diferencia real.
const distReal = (d, [atras, delante]) => (d >= 0 ? delante : atras) * Math.tanh(Math.abs(d) / 8);
const videos = {};
let realPintado = false;
// Se descarga entero como blob (pasa por la caché del service worker y se reproduce sin conexión y en Safari,
// que pide rangos que la caché no sirve).
function video(clave) {
  const v = videos[clave];
  if (v !== undefined) return v && v.readyState >= 2 ? v : null;
  if (typeof document === 'undefined' || typeof fetch !== 'function') return null;
  const el = document.createElement('video');
  // autoplay: sin él algunos navegadores solo cargan los metadatos y el clip nunca llega a tener imagen
  el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto'; el.autoplay = true;
  el.setAttribute('muted', ''); el.setAttribute('playsinline', '');
  videos[clave] = el;
  fetch(CLIPS_REAL[clave].src)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
    .then((b) => { el.src = URL.createObjectURL(b); el.load(); })
    .catch(() => { videos[clave] = null; });
  return null;
}

// Proyección de la cámara de Blender (sensor de 36 mm en el lado mayor): punto del mundo → píxel del render.
export function proyectarReal(cam, [px, py, pz]) {
  const [cx, cy, cz] = cam.camara;
  let f = [cam.mira[0] - cx, cam.mira[1] - cy, cam.mira[2] - cz];
  const nf = Math.hypot(...f); f = f.map((a) => a / nf);
  let r = [f[1], -f[0], 0];
  const nr = Math.hypot(...r); r = r.map((a) => a / nr);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d = [px - cx, py - cy, pz - cz];
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  const [W, H] = cam.res;
  const fpx = (cam.lente / 36) * Math.max(W, H);
  return { x: W / 2 + (fpx * (d[0] * r[0] + d[1] * r[1])) / z, y: H / 2 - (fpx * (d[0] * u[0] + d[1] * u[1] + d[2] * u[2])) / z, z, s: fpx / z };
}

// Devuelve false mientras el clip carga (se pinta la 3D en su lugar).
function pintarReal(c, { ctx, ancho, alto }, { botes }, arriba) {
  const util = alto - arriba;
  const clave = ancho / alto >= 1.15 ? 'ancho' : 'alto';
  for (const k of Object.keys(videos)) if (k !== clave && videos[k] && !videos[k].paused && videos[k].readyState >= 2) videos[k].pause();
  const v = video(clave);
  if (!v) return false;
  realPintado = true;
  const yo = botes[0];
  const ritmo = yo.spm && !sinMovimiento ? Math.min(2.5, Math.max(0.4, yo.spm / SPM_CLIP)) : 0;
  if (!ritmo) {
    if (!v.paused) v.pause();
  } else {
    if (Math.abs(v.playbackRate - ritmo) > 0.02) v.playbackRate = ritmo;
    if (v.paused) v.play().catch(() => {});
  }
  // Cubre todo el lienzo; tu remero abajo y algo a la derecha, y los carriles rivales encima, bajo la cabecera.
  const { camara: cam, margen } = CLIPS_REAL[clave];
  const vw = v.videoWidth, vh = v.videoHeight;
  const a = vw / cam.res[0];
  const k = Math.max(ancho / vw, alto / vh);
  // Encuadre: el recuadro que ocupan tu bote y los rivales (con su etiqueta), centrado bajo la cabecera.
  const pts = [[0, -2.4, 0], [0, 2.6, 0], [0, 0, 1.6]];
  botes.forEach((b, i) => {
    if (!b.yo) pts.push([carrilReal(i), distReal(b.dist - yo.dist, margen) - 1.5, 0], [carrilReal(i), distReal(b.dist - yo.dist, margen) + 1.5, 2.3]);
  });
  const ps = pts.map((p) => proyectarReal(cam, p));
  const cx = (Math.min(...ps.map((p) => p.x)) + Math.max(...ps.map((p) => p.x))) / 2;
  const arribaRivales = Math.min(...ps.map((p) => p.y));
  const tuAgua = proyectarReal(cam, [0, 0, AGUA_REAL]).y;
  // Si no cabe todo, manda que se vean los rivales (con sitio para la etiqueta) sin perder tu bote.
  const yCabe = arriba + util / 2 - ((arribaRivales + tuAgua) / 2) * a * k;
  const yRivales = Math.min(yCabe, arriba + 26 - arribaRivales * a * k);
  const yTu = alto - 24 - tuAgua * a * k;
  const x = Math.min(0, Math.max(ancho - vw * k, ancho / 2 - cx * a * k));
  const y = Math.min(0, Math.max(alto - vh * k, Math.max(yRivales, yTu)));
  ctx.drawImage(v, x, y, vw * k, vh * k);
  const aLienzo = (p) => ({ x: x + p.x * a * k, y: y + p.y * a * k, s: p.s * a * k });
  rivalesReal(ctx, botes, cam, margen, aLienzo, ancho, alto, arriba);
  // Sombra arriba para que la cabecera se lea sobre el agua clara
  const sombra = ctx.createLinearGradient(0, 0, 0, arriba + 40);
  sombra.addColorStop(0, 'rgba(2,6,23,0.55)');
  sombra.addColorStop(1, 'rgba(2,6,23,0)');
  ctx.fillStyle = sombra;
  ctx.fillRect(0, 0, ancho, arriba + 40);
  const cabeza = aLienzo(proyectarReal(cam, [0, 0, 1.5]));
  c.yoPantalla = { x: cabeza.x, y: cabeza.y };
  return true;
}

// Rivales en sus carriles, detrás de tu bote: el más lejano primero. Remando con su propia fase, con reflejo en el
// agua y etiqueta de nombre y diferencia (sustituye a la tabla de las otras vistas); si se salen por un lado, una
// flecha en el borde.
function rivalesReal(ctx, botes, cam, margen, aLienzo, ancho, alto, arriba) {
  const atlas = imagen(RIVAL_REAL.src);
  const ref = proyectarReal(RIVAL_REAL.camara, [0, 0, AGUA_REAL]);
  const lista = botes.map((b, i) => ({ b, i })).filter((x) => !x.b.yo).reverse();
  ctx.font = '700 12px system-ui, sans-serif';
  const etiquetas = [];
  const pendientes = [];
  for (const { b, i } of lista) {
    const d = b.dist - botes[0].dist;
    const carril = carrilReal(i);
    const dv = distReal(d, margen);
    const p = aLienzo(proyectarReal(cam, [carril, dv, AGUA_REAL]));
    const esc = p.s / (ref.s * RIVAL_REAL.escala);
    const w = RIVAL_REAL.w * esc, h = RIVAL_REAL.h * esc;
    const x0 = p.x - RIVAL_REAL.ancla[0] * esc, y0 = p.y - RIVAL_REAL.ancla[1] * esc;
    const dif = Math.round(d);
    const txtDif = dif === 0 ? 'parejos' : `${dif > 0 ? '+' : '−'}${Math.abs(dif).toLocaleString('es-MX')} m`;
    if (x0 + w < 0 || x0 > ancho || p.y < arriba - h * 0.2) {
      // Fuera de cuadro: flecha en el borde, a la altura de su carril
      const izq = x0 + w < 0;
      const yy = Math.max(arriba + 14, Math.min(alto - 14, p.y));
      const txt = `${izq ? '◀ ' : ''}${b.nombre} ${txtDif}${izq ? '' : ' ▶'}`;
      const tw = ctx.measureText(txt).width + 14;
      const xx = izq ? 6 : ancho - tw - 6;
      ctx.fillStyle = 'rgba(2,6,23,0.72)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(xx, yy - 10, tw, 20, 10) : ctx.rect(xx, yy - 10, tw, 20);
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.textAlign = 'left';
      ctx.fillText(txt, xx + 7, yy + 4);
      continue;
    }
    if (atlas) {
      const n = RIVAL_REAL.n;
      const f = b.spm && !sinMovimiento ? Math.floor((b.fase || 0) * n) % n : 0;
      const sx = (f % RIVAL_REAL.cols) * RIVAL_REAL.w, sy = Math.floor(f / RIVAL_REAL.cols) * RIVAL_REAL.h;
      // Reflejo: el mismo fotograma volteado bajo la línea de flotación, tenue
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.translate(0, 2 * p.y);
      ctx.scale(1, -1);
      ctx.drawImage(atlas, sx, sy, RIVAL_REAL.w, RIVAL_REAL.h, x0, y0, w, h);
      ctx.restore();
      ctx.drawImage(atlas, sx, sy, RIVAL_REAL.w, RIVAL_REAL.h, x0, y0, w, h);
    }
    pendientes.push({ b, cab: aLienzo(proyectarReal(cam, [carril, dv, 1.85])), txtDif });
  }
  // Etiquetas sobre la cabeza, después de todos los botes para que ninguno las tape
  for (const { b, cab, txtDif } of pendientes) {
    const txt = `${b.nombre} ${txtDif}`;
    const tw = ctx.measureText(txt).width + 12;
    const tx = Math.max(4, Math.min(ancho - tw - 4, cab.x - tw / 2));
    let ty = Math.max(arriba + 4, cab.y - 20);
    // Si pisa otra etiqueta, baja hasta quedar libre
    while (etiquetas.some((e) => tx < e.x + e.w && e.x < tx + tw && ty < e.y + 20 && e.y < ty + 20)) ty += 21;
    etiquetas.push({ x: tx, y: ty, w: tw });
    ctx.fillStyle = 'rgba(2,6,23,0.7)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(tx, ty, tw, 18, 9) : ctx.rect(tx, ty, tw, 18);
    ctx.fill();
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = b.color;
    ctx.textAlign = 'left';
    ctx.fillText(txt, tx + 6, ty + 13);
  }
}

// ---------- 3D: cámara detrás de tu bote ----------
// Número pseudoaleatorio fijo para cada posición del mundo (árboles, rocas).
const ruido = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function pintar3d(c, { ctx, ancho, alto }, { botes, t, ritmo, referencias = [], sprint, dt }, arriba) {
  const yo = botes[0];
  // En el sprint la cámara se acerca y baja.
  c.zoom += ((sprint ? 1 : 0) - c.zoom) * Math.min(1, (dt || 0) * 1.5);
  if (sinMovimiento) c.zoom = sprint ? 1 : 0;
  // Si hay distancia entre botes, la cámara se aleja y sube para que se vean todos (hasta 400 m de separación).
  const cerca = botes.map((b) => b.dist).filter((d) => Math.abs(d - yo.dist) < 400);
  const atrasM = Math.max(0, yo.dist - Math.min(...cerca));
  const separacion = Math.max(...cerca) - Math.min(...cerca);
  const alejarObj = separacion > 12 ? separacion : 0;
  c.alejar = (c.alejar || 0) + (alejarObj - (c.alejar || 0)) * Math.min(1, (dt || 0) * 1.2);
  if (sinMovimiento) c.alejar = alejarObj;
  const al = c.alejar;
  const camZ = yo.dist - 13 + c.zoom * 3.5 * (al < 12 ? 1 : 0) - Math.min(atrasM, al) - al * 0.12;
  const camH = 4.6 - c.zoom * (al < 12 ? 1 : 0) + al * 0.085;
  const alcance = Math.max(300, al + 80);
  // El horizonte y la escala se calculan con el alto que queda bajo la cabecera.
  const util = alto - arriba;
  const horizonte = arriba + util * 0.34; // deja ver las montañas del panorama bajo la cabecera
  const f = Math.min(util * 1.05, ancho * 1.15);
  const cx = ancho / 2;
  const carril = 3;
  // Tú en el centro; rivales a los lados
  const lado = (i) => (i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2) * carril);
  const lateral = botes.map((_, i) => lado(i));
  const minX = Math.min(...lateral) - carril / 2;
  const maxX = Math.max(...lateral) + carril / 2;
  // Escala horizontal: que todos los carriles quepan a la altura de tu bote, incluso en vertical.
  const extremo = Math.max(-minX, maxX) + 0.5;
  const fx = Math.min(f / 1.6, (ancho * 0.47 * 10) / extremo);
  const P = (x, z, h = 0) => {
    const d = z - camZ;
    if (d <= 0.3) return null;
    return { x: cx + (fx * x) / d, y: horizonte + (f * (camH - h)) / d, s: f / d, d };
  };

  // Cielo y fondo: panorama del fiordo renderizado en Blender (tools/blender/paisaje); mientras carga, degradados.
  const cielo = ctx.createLinearGradient(0, 0, 0, horizonte);
  cielo.addColorStop(0, paisaje.colores.cielo3d[0]);
  cielo.addColorStop(1, paisaje.colores.cielo3d[1]);
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, ancho, horizonte);
  const agua = ctx.createLinearGradient(0, horizonte, 0, alto);
  agua.addColorStop(0, paisaje.colores.agua3d[0]);
  agua.addColorStop(1, paisaje.colores.agua3d[1]);
  ctx.fillStyle = agua;
  ctx.fillRect(0, horizonte, ancho, alto - horizonte);
  const fiordo = imagen(paisaje.panorama.src);
  if (fiordo) {
    // 360° del panorama = 2π·f píxeles, con el horizonte de la imagen sobre el del lienzo y el frente centrado.
    const k = (2 * Math.PI * f) / fiordo.naturalWidth;
    const w = fiordo.naturalWidth * k;
    const h = fiordo.naturalHeight * k;
    const y = horizonte - paisaje.panorama.horizonte * k;
    let x = cx - w / 2;
    while (x > 0) x -= w;
    conFiltro(ctx, () => { for (; x < ancho; x += w) ctx.drawImage(fiordo, x, y, w, h); });
  } else {
    ctx.fillStyle = '#244634';
    ctx.beginPath();
    ctx.moveTo(0, horizonte);
    for (let x = 0; x <= ancho; x += 20) ctx.lineTo(x, horizonte - 18 - 10 * Math.sin(x / 140) - 6 * Math.sin(x / 53));
    ctx.lineTo(ancho, horizonte);
    ctx.fill();
  }
  // Reflejo del cielo cerca del horizonte
  const reflejo = ctx.createLinearGradient(0, horizonte, 0, horizonte + alto * 0.12);
  reflejo.addColorStop(0, `rgba(${paisaje.colores.reflejo},0.12)`);
  reflejo.addColorStop(1, `rgba(${paisaje.colores.reflejo},0)`);
  ctx.fillStyle = reflejo;
  ctx.fillRect(0, horizonte, ancho, alto * 0.12);

  // Orillas (franjas a los lados del canal) con arena en el borde
  const lejos = 400;
  const bordes = { [-1]: minX - 6, 1: maxX + 6 };
  for (const s of [-1, 1]) {
    const borde = bordes[s];
    const a = P(borde, camZ + 1.2);
    const b = P(borde, camZ + lejos);
    const a2 = P(borde + s * 0.8, camZ + 1.2);
    if (!a || !b || !a2) continue;
    // Se usan los puntos proyectados de verdad: con la cámara alta el borde cercano cae muy por debajo del lienzo.
    ctx.fillStyle = paisaje.colores.arena3d;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(a2.x, a2.y); ctx.fill();
    const lado = s < 0 ? Math.min(0, a2.x) : Math.max(ancho, a2.x);
    ctx.fillStyle = paisaje.colores.tierra3d;
    ctx.beginPath();
    ctx.moveTo(lado, Math.max(alto, a2.y));
    ctx.lineTo(a2.x, a2.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(lado, b.y);
    ctx.fill();
  }

  // Olas
  if (!sinMovimiento) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let z = Math.floor((camZ + 2) / 3) * 3; z < camZ + Math.min(alcance, 160); z += 3) {
      for (let x = minX - 4; x <= maxX + 4; x += 2.5) {
        if (Math.sin(t * 1.5 + z * 0.7 + x) < 0.3) continue;
        const q = P(x + (z % 2), z);
        if (!q) continue;
        const l = Math.min(14, q.s * 0.25);
        ctx.beginPath(); ctx.moveTo(q.x - l, q.y); ctx.lineTo(q.x + l, q.y); ctx.stroke();
      }
    }
  }

  // Marcas transversales de distancia y meta
  const paso = 50;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  let ultimaEtq = Infinity;
  const marcas = [];
  for (let m = Math.ceil(camZ / paso) * paso; m < camZ + alcance; m += paso) {
    if (m < 0) continue;
    const a = P(minX - 2, m);
    const b = P(maxX + 2, m);
    if (!a || !b) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, a.s * 0.02);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // Etiquetas solo mientras no se amontonan cerca del horizonte; se pintan al final, encima de todo.
    if (ultimaEtq - b.y >= 16 && b.x + 50 < ancho) {
      marcas.push({ txt: `${m} m`, x: b.x + 6, y: b.y + 4 });
      ultimaEtq = b.y;
    }
  }
  const meta = c.estado.meta;
  if (meta != null && meta - camZ < alcance && meta > camZ) {
    const a = P(minX - 2, meta);
    const b = P(maxX + 2, meta);
    if (a && b) {
      const cuadros = 16;
      const grueso = Math.max(2, a.s * 0.25);
      for (let i = 0; i < cuadros; i++) {
        ctx.fillStyle = i % 2 ? '#fff' : '#111';
        const x0 = a.x + ((b.x - a.x) * i) / cuadros;
        ctx.fillRect(x0, a.y - grueso / 2, (b.x - a.x) / cuadros + 1, grueso);
      }
      // Postes con pancarta de meta
      const pa = P(minX - 2, meta, 4);
      const pb = P(maxX + 2, meta, 4);
      if (pa && pb) {
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = Math.max(1, a.s * 0.06);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pa.x, pa.y); ctx.moveTo(b.x, b.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        const alto2 = Math.max(4, a.s * 0.5);
        for (let i = 0; i < cuadros; i++) {
          ctx.fillStyle = i % 2 ? '#111' : '#fff';
          ctx.fillRect(pa.x + ((pb.x - pa.x) * i) / cuadros, pa.y, (pb.x - pa.x) / cuadros + 1, alto2);
        }
      }
    }
  }

  if (ritmo && ritmo.dist - camZ < 300 && ritmo.dist > camZ + 0.5) {
    const a = P(minX - 2, ritmo.dist);
    const b = P(maxX + 2, ritmo.dist);
    if (a && b) {
      ctx.strokeStyle = COLOR_RITMO;
      ctx.lineWidth = Math.max(2, a.s * 0.08);
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = COLOR_RITMO;
      if (b.x + 70 < ancho) ctx.fillText(ritmo.etiqueta, b.x + 6, b.y - 6);
    }
  }

  // Referencias: línea amarilla de lado a lado de tu carril (el del centro). Etiquetas alternadas a izquierda y derecha.
  referencias.forEach((r, k) => {
    if (!(r.dist - camZ < 300 && r.dist > camZ + 0.5)) return;
    const a = P(-carril / 2 + 0.2, r.dist);
    const b = P(carril / 2 - 0.2, r.dist);
    if (!a || !b) return;
    ctx.strokeStyle = COLOR_RITMO;
    ctx.lineWidth = Math.max(3, a.s * 0.12);
    ctx.setLineDash(r.discontinua ? [8, 6] : []);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 12px system-ui, sans-serif';
    const izq = k % 2 === 0;
    ctx.textAlign = izq ? 'right' : 'left';
    ctx.fillStyle = COLOR_RITMO;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(2,6,23,0.7)';
    const x = izq ? a.x - 4 : b.x + 4;
    ctx.strokeText(r.etiqueta, x, a.y + 4);
    ctx.fillText(r.etiqueta, x, a.y + 4);
  });

  // Cuerdas de boyas entre carriles
  for (let k = 0; k <= botes.length; k++) {
    const x = minX + k * carril;
    for (let z = Math.ceil((camZ + 1) / 5) * 5; z < camZ + Math.max(160, al + 40); z += 5) {
      if (z < 0) continue;
      const q = P(x, z);
      if (!q) continue;
      const grande = z % 250 === 0;
      if (!grande && q.s < 2) continue;
      ctx.fillStyle = grande ? '#F2A33A' : z % 25 === 0 ? '#EF4444' : 'rgba(255,255,255,0.8)';
      // Tope de tamaño: las boyas que pasan junto a la cámara no deben tapar la parte baja de la pista.
      const r = Math.min(grande ? 9 : 4, Math.max(0.8, q.s * (grande ? 0.35 : 0.12)));
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Orilla: árboles, rocas, casas y juncos anclados al mundo, del más lejano al más cercano.
  // Con el atlas de Blender cargado se pintan sus piezas; mientras tanto, las formas sencillas de antes.
  const orilla = paisaje.orilla;
  const atlas = imagen(orilla.src);
  const pieza = (nombre, x, zz, espejo, alfa = 1) => {
    const q = orilla.piezas[nombre];
    const base = P(x, zz);
    if (!q || !base) return;
    const h = q.m * base.s;
    const w = (h * q.w) / q.h;
    if (base.x + w < 0 || base.x - w > ancho || h < 2) return;
    ctx.globalAlpha = alfa;
    if (espejo) {
      ctx.save();
      ctx.translate(base.x, 0);
      ctx.scale(-1, 1);
      conFiltro(ctx, () => ctx.drawImage(atlas, q.x, q.y, q.w, q.h, -q.pie[0] * w, base.y - q.pie[1] * h, w, h));
      ctx.restore();
    } else {
      conFiltro(ctx, () => ctx.drawImage(atlas, q.x, q.y, q.w, q.h, base.x - q.pie[0] * w, base.y - q.pie[1] * h, w, h));
    }
    ctx.globalAlpha = 1;
  };
  const PASO_ARBOL = 7;
  for (let z = Math.floor((camZ + 220) / PASO_ARBOL) * PASO_ARBOL; z > camZ + 1.5; z -= PASO_ARBOL) {
    for (const s of [-1, 1]) {
      const semilla = z * 0.37 + s * 11;
      const r1 = ruido(semilla);
      const x = bordes[s] + s * (1.5 + r1 * 5);
      const zz = z + ruido(semilla + 3) * PASO_ARBOL;
      if (atlas) {
        // Lejos se funden con la bruma del paisaje
        const alfa = Math.max(0, Math.min(1, (camZ + paisaje.colores.bruma - zz) / 60));
        const r2 = ruido(semilla + 9);
        const nombre = orilla.elegir(r1, r2);
        pieza(nombre, x + s * (orilla.apartar[nombre] || 0), zz, orilla.espejo(s, r2), alfa);
        // Un segundo árbol más atrás para que la orilla se vea tupida
        if (r2 > 0.3) pieza(orilla.fondo(r2), x + s * (4 + r2 * 4), zz + PASO_ARBOL * 0.5, orilla.espejo(s, r1), alfa);
        continue;
      }
      const base = P(x, zz);
      if (!base || base.x < -60 || base.x > ancho + 60) continue;
      if (r1 < 0.18) {
        // Roca
        ctx.fillStyle = '#5B6470';
        ctx.beginPath(); ctx.ellipse(base.x, base.y, base.s * 0.7, base.s * 0.35, 0, Math.PI, 0); ctx.fill();
        continue;
      }
      const altura = 3 + ruido(semilla + 7) * 4;
      const copa = P(x, zz, altura);
      if (!copa) continue;
      ctx.strokeStyle = '#4A3423';
      ctx.lineWidth = Math.max(1, base.s * 0.12);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(copa.x, copa.y + (base.y - copa.y) * 0.3); ctx.stroke();
      ctx.fillStyle = r1 > 0.6 ? '#2F6B3F' : '#245A34';
      if (r1 > 0.6) {
        // Pino
        ctx.beginPath();
        ctx.moveTo(copa.x, copa.y);
        ctx.lineTo(copa.x - base.s * 0.9, base.y - (base.y - copa.y) * 0.25);
        ctx.lineTo(copa.x + base.s * 0.9, base.y - (base.y - copa.y) * 0.25);
        ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(copa.x, copa.y + base.s * 0.5, base.s * 0.9, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Juncos al borde del agua
  ctx.strokeStyle = '#6B8F4E';
  for (let z = Math.ceil((camZ + 2) / 2) * 2; z < camZ + 60; z += 2) {
    for (const s of [-1, 1]) {
      if (ruido(z * 1.3 + s) < 0.5) continue;
      if (atlas) { pieza(orilla.borde, bordes[s] + s * 0.4, z, ruido(z) > 0.5); continue; }
      const a = P(bordes[s] + s * 0.3, z);
      const b = P(bordes[s] + s * 0.3, z, 0.9);
      if (!a || !b) continue;
      ctx.lineWidth = Math.max(0.8, a.s * 0.03);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + (sinMovimiento ? 0 : Math.sin(t * 2 + z) * a.s * 0.05), b.y); ctx.stroke();
    }
  }

  // Botes, del más lejano al más cercano
  const lista = botes.map((b, i) => ({ ...b, x: lateral[i] })).sort((a, b) => b.dist - a.dist);
  for (const b of lista) {
    // Los rivales que van justo detrás de ti se verían enormes y deformados: solo salen en la tabla.
    if (!b.yo && b.dist - camZ < 9) continue;
    if (b.yo && b.dist - camZ < 4.5) continue;
    bote3d(ctx, P, b, t);
    if (b.yo) {
      const q = P(b.x, b.dist, 0.8);
      if (q) c.yoPantalla = { x: q.x, y: q.y };
    }
  }
  // Distancias encima de árboles y botes, con fondo para leerse sobre cualquier cosa
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  // De cerca a lejos; cerca del horizonte se juntan, así que se salta la que pisaría a la anterior.
  let ultimaY = Infinity;
  for (const k of marcas.sort((a, b) => b.y - a.y)) {
    if (ultimaY - k.y < 20) continue;
    ultimaY = k.y;
    const w = ctx.measureText(k.txt).width + 10;
    ctx.fillStyle = 'rgba(2,6,23,0.6)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(k.x - 5, k.y - 12, w, 16, 8) : ctx.rect(k.x - 5, k.y - 12, w, 16);
    ctx.fill();
    ctx.fillStyle = '#F1F5F9';
    ctx.fillText(k.txt, k.x, k.y);
  }
  tabla3d(ctx, botes, yo, arriba, ancho);
}

// Diferencias de la vista 3D: todas juntas en la esquina, ordenadas por posición (también los que van detrás
// y no salen en cámara). Sobre cada bote solo queda una marca de su color.
function tabla3d(ctx, botes, yo, arriba, ancho, medir = false) {
  const filas = [...botes].sort((a, b) => b.dist - a.dist);
  const alto = 19;
  const r = 6.5;
  ctx.font = '700 12px system-ui, sans-serif';
  const maxNombre = Math.min(96, ancho * 0.24);
  const nombres = filas.map((b) => cabe(ctx, b.nombre, maxNombre));
  const wNombre = Math.max(...nombres.map((n) => ctx.measureText(n).width));
  ctx.font = '800 12px system-ui, sans-serif';
  const difs = filas.map((b) => {
    if (b.yo) return '';
    const d = Math.round(b.dist - yo.dist);
    return d === 0 ? 'parejos' : `${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('es-MX')} m`;
  });
  const wDif = Math.max(28, ...difs.map((d) => ctx.measureText(d).width));
  const w = 8 + r * 2 + 6 + wNombre + 10 + wDif + 8;
  const x0 = 6;
  const y0 = arriba + 6;
  if (medir) return { derecha: x0 + w, abajo: y0 + filas.length * alto + 6 };
  ctx.fillStyle = 'rgba(2,6,23,0.7)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x0, y0, w, filas.length * alto + 6, 10) : ctx.rect(x0, y0, w, filas.length * alto + 6);
  ctx.fill();
  filas.forEach((b, i) => {
    const y = y0 + 3 + i * alto + alto / 2;
    if (b.yo) {
      ctx.fillStyle = 'rgba(242,163,58,0.18)';
      ctx.fillRect(x0 + 2, y - alto / 2 + 1, w - 4, alto - 2);
    }
    retrato(ctx, b.retrato, x0 + 8 + r, y, r, b.color);
    ctx.textAlign = 'left';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = b.color;
    ctx.fillText(nombres[i], x0 + 8 + r * 2 + 6, y + 4);
    if (b.acelera || b.aviso) {
      ctx.fillStyle = '#FDE047';
      ctx.fillText('⚡', x0 + 8 + r * 2 + 6 + ctx.measureText(nombres[i]).width + 2, y + 4);
    }
    if (!b.yo) {
      const d = b.dist - yo.dist;
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = Math.round(d) > 0 ? '#FCA5A5' : Math.round(d) < 0 ? '#86EFAC' : '#F8FAFC';
      ctx.fillText(difs[i], x0 + w - 8, y + 4);
    }
  });
}

// Vela cuadrada vista desde atrás: un cuadrilátero de lado a lado entre dos alturas.
function vela3d(ctx, P, x, z, mitad, h0, h1, color, alfa) {
  const q = [P(x - mitad, z, h1), P(x + mitad, z, h1), P(x + mitad, z, h0), P(x - mitad, z, h0)];
  if (q.some((p) => !p)) return null;
  const previo = ctx.globalAlpha;
  ctx.globalAlpha = alfa;
  ctx.fillStyle = color;
  ctx.beginPath();
  q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = previo;
  return q;
}

function palo3d(ctx, P, x, z, h0, h1) {
  const a = P(x, z, h0);
  const b = P(x, z, h1);
  if (!a || !b) return null;
  ctx.strokeStyle = '#8B5E34';
  ctx.lineWidth = Math.max(1, a.s * 0.05);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  return b;
}

// Detalles de cada clase sobre el casco (en 3D).
function adornos3d(ctx, P, b, largo, t) {
  const deco = decoDe(b);
  const cerca = P(b.x, b.dist);
  if (!deco || !cerca) return;
  // Velas, mástiles y estandartes no se dibujan en tu bote (taparían la pista) y se desvanecen en los rivales cercanos.
  const lejania = b.yo ? 0 : Math.max(0, Math.min(1, (cerca.d - 14) / 10));
  const alfa = 0.9 * lejania;
  const altos = lejania > 0.05;
  ctx.globalAlpha = 1;
  const onda = sinMovimiento ? 0 : Math.sin(t * 5 + b.dist) * 0.12;
  if (b.clase === 'vikingo') {
    // Cuello y cabeza de dragón en la proa, escudos a los lados y vela a rayas
    const a = P(b.x, b.dist + largo * 0.5, 0.15);
    const c = P(b.x, b.dist + largo * 0.55, 1.3);
    if (a && c) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = Math.max(1.5, a.s * 0.1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x, c.y, c.x, c.y); ctx.stroke();
      ctx.fillStyle = deco.marca;
      ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(1.5, c.s * 0.14), 0, Math.PI * 2); ctx.fill();
    }
    // Escudos en las bordas del drakkar vectorial (la barca realista es más corta y no los lleva)
    for (let k = -2; k <= 2 && largo >= 8; k++) {
      for (const s of [-1, 1]) {
        const q = P(b.x + s * 0.42, b.dist + k * 0.9, 0.25);
        if (!q) continue;
        ctx.fillStyle = (k + 2) % 2 ? deco.tela : deco.marca;
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, q.s * 0.1), 0, Math.PI * 2); ctx.fill();
      }
    }
    if (altos) {
      ctx.globalAlpha = lejania;
      palo3d(ctx, P, b.x, b.dist + 1, 0.15, 2.4);
      for (let i = 0; i < 4; i++) vela3d(ctx, P, b.x, b.dist + 1, 0.85, 1.0 + i * 0.32, 1.32 + i * 0.32, i % 2 ? '#F8FAFC' : deco.tela, alfa);
    }
  } else if (b.clase === 'pirata' && altos) {
    // Mástil, vela triangular y bandera negra
    ctx.globalAlpha = lejania;
    const tope = palo3d(ctx, P, b.x, b.dist + 0.8, 0.15, 3.0);
    const q = [P(b.x, b.dist + 0.8, 2.8), P(b.x, b.dist + 0.8, 0.6), P(b.x + 0.1, b.dist - 2.4, 0.6)];
    if (!q.some((p) => !p)) {
      ctx.globalAlpha = alfa;
      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = lejania;
    }
    if (tope) bandera3d(ctx, tope, deco, onda);
  } else if (b.clase === 'samurai' && altos) {
    // Nobori: estandarte alto en la popa
    ctx.globalAlpha = lejania;
    const tope = palo3d(ctx, P, b.x, b.dist - largo * 0.45, 0.15, 2.6);
    if (tope) {
      const w = Math.max(3, tope.s * 0.35);
      const h = Math.max(8, tope.s * 1.1);
      ctx.fillStyle = deco.tela;
      ctx.fillRect(tope.x, tope.y, w, h);
      ctx.fillStyle = deco.marca;
      ctx.beginPath(); ctx.arc(tope.x + w / 2, tope.y + h * 0.3, w * 0.32, 0, Math.PI * 2); ctx.fill();
    }
  } else if (b.clase === 'polinesio') {
    // Flotador lateral y banderín
    const s = b.x > 0 ? 1 : -1;
    const q = [P(b.x + s * 1.4, b.dist + 2, 0.08), P(b.x + s * 1.55, b.dist, 0.08), P(b.x + s * 1.4, b.dist - 2, 0.08), P(b.x + s * 1.25, b.dist, 0.08)];
    if (!q.some((p) => !p)) {
      ctx.fillStyle = '#C9A46A';
      ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#E7D3A8';
      for (const dz of [1.2, -1.2]) {
        const a = P(b.x, b.dist + dz, 0.2);
        const z = P(b.x + s * 1.4, b.dist + dz, 0.15);
        if (a && z) { ctx.lineWidth = Math.max(1, a.s * 0.04); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke(); }
      }
    }
    if (altos) {
      ctx.globalAlpha = lejania;
      const tope = palo3d(ctx, P, b.x, b.dist - largo * 0.42, 0.15, 1.8);
      if (tope) bandera3d(ctx, tope, deco, onda);
    }
  } else if (b.clase === 'romano') {
    // Espolón y vela cuadrada púrpura
    const a = P(b.x, b.dist + largo * 0.5, 0.05);
    const z = P(b.x, b.dist + largo * 0.5 + 0.9, 0.02);
    if (a && z) {
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = Math.max(1.5, a.s * 0.12);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke();
    }
    const q = altos ? vela3d(ctx, P, b.x, b.dist + 0.6, 0.9, 1.1, 2.3, deco.tela, alfa) : null;
    if (q) {
      ctx.globalAlpha = lejania;
      palo3d(ctx, P, b.x, b.dist + 0.6, 0.15, 2.5);
      ctx.globalAlpha = alfa;
      ctx.fillStyle = deco.marca;
      const m = { x: (q[0].x + q[2].x) / 2, y: (q[0].y + q[2].y) / 2 };
      ctx.beginPath(); ctx.arc(m.x, m.y, Math.max(1.5, q[0].s * 0.18), 0, Math.PI * 2); ctx.fill();
    }
  }
  // En tu bote, en lugar de mástil, un banderín bajo en la popa.
  if (b.yo) {
    const tope = palo3d(ctx, P, b.x, b.dist - largo * 0.48, 0.15, 0.9);
    if (tope) bandera3d(ctx, tope, deco, onda);
  }
  ctx.globalAlpha = 1;
}

function bandera3d(ctx, tope, deco, onda) {
  const previo = ctx.globalAlpha;
  const w = Math.max(5, tope.s * 0.6);
  const h = Math.max(3, tope.s * 0.35);
  ctx.fillStyle = deco.tela;
  ctx.beginPath();
  ctx.moveTo(tope.x, tope.y);
  ctx.quadraticCurveTo(tope.x - w * 0.5, tope.y + h * onda * 3, tope.x - w, tope.y + h * onda * 2);
  ctx.lineTo(tope.x - w, tope.y + h + h * onda * 2);
  ctx.quadraticCurveTo(tope.x - w * 0.5, tope.y + h + h * onda * 3, tope.x, tope.y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = deco.marca;
  ctx.beginPath(); ctx.arc(tope.x - w * 0.5, tope.y + h * 0.5 + h * onda * 2, h * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = previo;
}

function bote3d(ctx, P, b, t) {
  // Con el atlas realista la barca mide lo que la de Blender y su centro va algo por delante del escálamo
  const real = celdaRemero('3d', b);
  const largo = real ? BARCA_REAL.largo : 8;
  const centro = real ? b.dist - 0.4 + BARCA_REAL.proa - largo / 2 : b.dist;
  const proa = P(b.x, centro + largo * 0.5);
  const popa = P(b.x, centro - largo * 0.5);
  if (!proa || !popa) return;
  const anchoCasco = b.clase === 'pirata' || b.clase === 'romano' ? 0.6 : 0.45;
  // Estela en V con espuma que se abre y se desvanece
  if (b.v > 0) {
    const fuerza = b.acelera ? 1.5 : 1;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.4 - i * 0.08) * Math.min(1, b.v / 3)})`;
      ctx.lineWidth = Math.max(1, popa.s * 0.03);
      for (const s of [-1, 1]) {
        const z0 = centro - largo * 0.5 - i * 2.5 * fuerza;
        const a = P(b.x + s * (0.25 + i * 0.45 * fuerza), z0);
        const z = P(b.x + s * (0.7 + i * 0.45 * fuerza + b.v * 0.3), z0 - 2.5 * fuerza);
        if (a && z) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke(); }
      }
    }
    // Rastro de espuma detrás de la popa
    for (let i = 0; i < 8; i++) {
      const zz = centro - largo * 0.5 - 0.6 - i * 1.4;
      const q = P(b.x + (sinMovimiento ? 0 : Math.sin(t * 3 + i) * 0.1), zz, 0);
      if (!q) continue;
      ctx.fillStyle = `rgba(255,255,255,${0.3 * (1 - i / 8) * Math.min(1, b.v / 3)})`;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(1, q.s * (0.25 + i * 0.05)), Math.max(0.5, q.s * 0.05), 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Ola de proa (más grande si acelera)
  if (b.v > 0) {
    const q = P(b.x, centro + largo * 0.5, 0.05);
    if (q) {
      ctx.fillStyle = `rgba(255,255,255,${b.acelera ? 0.8 : 0.35})`;
      const n = b.acelera ? 10 : 4;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI;
        const r = q.s * (b.acelera ? 0.5 : 0.3) * (0.7 + 0.3 * (sinMovimiento ? 1 : Math.abs(Math.sin(t * 8 + i))));
        ctx.beginPath(); ctx.arc(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r * 0.3 + q.s * 0.05, Math.max(0.8, q.s * 0.05), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  if (real) {
    if (b.yo) aro3d(ctx, P, b.x, centro, largo);
    remero3d(ctx, P, b, real, t);
    velaReal3d(ctx, P, { ...b, dist: centro }, largo, t);
    marcaRival3d(ctx, P, b);
    return;
  }
  // Casco como polígono proyectado
  const popaAncha = b.clase === 'samurai' ? 0.85 : 0.4;
  const puntos = [
    P(b.x, b.dist + largo * 0.5, 0.15),
    P(b.x + anchoCasco, b.dist, 0.15),
    P(b.x + anchoCasco * popaAncha, b.dist - largo * 0.5, 0.15),
    P(b.x - anchoCasco * popaAncha, b.dist - largo * 0.5, 0.15),
    P(b.x - anchoCasco, b.dist, 0.15),
  ];
  if (puntos.some((q) => !q)) return;
  ctx.globalAlpha = b.yo ? 1 : 0.9;
  if (b.brillo) {
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = sinMovimiento ? 18 : 16 + 10 * Math.sin(t * 10);
  }
  ctx.fillStyle = b.color;
  ctx.beginPath();
  puntos.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // Remos sobre el agua: salen de los puños (en las manos del remero) y pasan por los escálamos.
  const pa = palada(b.fase, b.spm);
  const { ang } = pa;
  const pivZ = b.dist - 0.4;
  // Medidas para que remo y pala quepan en el carril (medio carril = 1,5): escálamo a 0,55, fuera 0,75, pala 0,14.
  const escalamo = 0.55;
  const remo = 0.75;
  const dentro = 0.6;
  const puños = [];
  for (const s of [-1, 1]) {
    const m = P(b.x + s * (escalamo - Math.cos(ang) * dentro), pivZ - Math.sin(ang) * dentro, 0.45);
    const z = P(b.x + s * (escalamo + Math.cos(ang) * remo), pivZ + Math.sin(ang) * remo, pa.agua ? 0 : 0.3);
    puños.push(m);
    if (!m || !z) continue;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = Math.max(1, m.s * 0.05);
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(z.x, z.y); ctx.stroke();
    // Pala cuadrada en el agua, girada (fina) en la recuperación
    const palas = b.yo && equipoYo?.palas ? PIEZAS[equipoYo.palas] : null;
    ctx.fillStyle = palas ? (pa.agua ? palas.tela : palas.marca) : pa.agua ? b.color : '#E2E8F0';
    ctx.beginPath(); ctx.ellipse(z.x, z.y, Math.max(1.5, z.s * 0.14), Math.max(0.6, z.s * (0.05 + 0.06 * (1 - pa.pluma))), 0, 0, Math.PI * 2); ctx.fill();
    // Salpicadura al meter la pala y remolino al sacarla
    if (b.spm && !sinMovimiento && (b.fase < 0.14 || (b.fase > 0.36 && b.fase < 0.46))) {
      const k = b.fase < 0.14 ? b.fase / 0.14 : (b.fase - 0.36) / 0.1;
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
      for (let g = 0; g < 6; g++) {
        const ag = -Math.PI * (0.15 + 0.7 * (g / 5));
        const r = z.s * (0.1 + 0.18 * k);
        ctx.beginPath(); ctx.arc(z.x + Math.cos(ag) * r, z.y + Math.sin(ag) * r * (1 - k * 0.5), Math.max(0.8, z.s * 0.04), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  adornos3d(ctx, P, b, largo, t);
  ctx.globalAlpha = b.yo ? 1 : 0.9;
  // Remero: mira a la popa (a la cámara); el asiento se desliza, el tronco se inclina y los brazos van a los puños.
  const col = REMEROS[b.clase] || { ropa: '#475569', pelo: '#334155' };
  const asientoZ = pivZ + 0.25 + pa.asiento * 0.3;
  const incl = pa.tronco * 0.55;
  const hombroZ = asientoZ - Math.sin(incl) * 0.7;
  const hombroH = 0.3 + Math.cos(incl) * 0.7;
  const cadera = P(b.x, asientoZ, 0.3);
  const cuello = P(b.x, hombroZ, hombroH);
  if (cadera && cuello) {
    // Piernas hacia el reposapiés (más cerca de la cámara), con la rodilla arriba al recoger
    const pie = pivZ - 0.55;
    const doblez = Math.max(0, 1 - (asientoZ - pie) / 1.1);
    ctx.strokeStyle = col.ropa;
    ctx.lineWidth = Math.max(1.5, cadera.s * 0.1);
    for (const s of [-1, 1]) {
      const r = P(b.x + s * 0.16, (asientoZ + pie) / 2, 0.3 + doblez * 0.45);
      const f = P(b.x + s * 0.14, pie, 0.2);
      if (r && f) { ctx.beginPath(); ctx.moveTo(cadera.x + s * cadera.s * 0.12, cadera.y); ctx.lineTo(r.x, r.y); ctx.lineTo(f.x, f.y); ctx.stroke(); }
    }
    ctx.lineWidth = Math.max(2.5, cadera.s * 0.3);
    ctx.beginPath(); ctx.moveTo(cadera.x, cadera.y); ctx.lineTo(cuello.x, cuello.y); ctx.stroke();
    // Brazos
    ctx.strokeStyle = PIEL;
    ctx.lineWidth = Math.max(1.2, cuello.s * 0.07);
    [-1, 1].forEach((s, k) => {
      const h = P(b.x + s * 0.24, hombroZ, hombroH - 0.05);
      const m = puños[k];
      if (!h || !m) return;
      const codo = { x: (h.x + m.x) / 2 + s * pa.brazos * cuello.s * 0.18, y: (h.y + m.y) / 2 + pa.brazos * cuello.s * 0.06 };
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(codo.x, codo.y); ctx.lineTo(m.x, m.y); ctx.stroke();
    });
    // Cabeza con pelo
    const cab = P(b.x, hombroZ - Math.sin(incl) * 0.18, hombroH + 0.22);
    if (cab) {
      const r = Math.max(2, cab.s * 0.13);
      ctx.fillStyle = PIEL;
      ctx.beginPath(); ctx.arc(cab.x, cab.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col.pelo;
      ctx.beginPath(); ctx.arc(cab.x, cab.y, r, Math.PI, 0); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  marcaRival3d(ctx, P, b);
}

// Remero realista (atlas de Blender) visto desde la cámara de persecución. El render tiene la misma cámara que
// pintar3d a 12,6 m del escálamo; aquí se escala por la distancia real y, a lo ancho, como la pista (fx ≠ f).
// Fracción de la perspectiva real con la que se inclinan los botes de las calles laterales (aprobada con Ander)
const INCLINA_CALLE = 1;
// ---------- Etapa 2 de arte: vela con emblema y marca de tu bote (barca realista) ----------
// La tela (fondo, ribetes, emblema y pliegues) se pinta una vez en un canvas aparte; las animadas (legendarias)
// se repintan unas 8 veces por segundo.
const TELA_W = 96, TELA_H = 84;
const telas = new Map();
function telaDe(deco, t, clase) {
  if (typeof document === 'undefined') return null;
  // Sin vela de la colección, la clásica de su clase
  if (!deco.emblema) deco = PIEZAS[`${clase}-clasica`] || deco;
  const paso = deco.animado && !sinMovimiento ? Math.floor(t * 8) : 0;
  const k = `${deco.tela}|${deco.marca}|${deco.emblema || ''}`;
  let e = telas.get(k);
  if (!e) { const c = document.createElement('canvas'); c.width = TELA_W; c.height = TELA_H; e = { c, paso: -1 }; telas.set(k, e); }
  if (e.paso !== paso) {
    const g = e.c.getContext('2d');
    g.clearRect(0, 0, TELA_W, TELA_H);
    pintarTela(g, deco, TELA_W, TELA_H, paso / 8);
    e.paso = paso;
  }
  return e.c;
}

// Dibuja la tela en tiras verticales que ondean: la onda corre hacia atrás y va más rápida cuanto más rápido vas.
// (x, y) es la esquina de arriba a la izquierda; con `tumbada` la tela se pinta en horizontal (vista desde arriba,
// ondeando hacia la izquierda, que es la popa).
function telaOndeante(ctx, src, x, y, w, h, t, v, tumbada = false) {
  const N = 12;
  const f = 3 + Math.min(6, (v || 0) * 1.4);
  const amp = sinMovimiento ? 0 : (tumbada ? h : w) * 0.035;
  for (let i = 0; i < N; i++) {
    const o = Math.sin(t * f - i * 0.7) * amp * (i / N + 0.3);
    const luz = sinMovimiento ? 0 : Math.cos(t * f - i * 0.7) * 0.035;
    if (tumbada) {
      // i = 0 junto al mástil (a la derecha de la tela) y la punta libre a la izquierda
      const sx = TELA_W - (i + 1) * TELA_W / N;
      const dx = x + w - (i + 1) * w / N;
      ctx.drawImage(src, sx, 0, TELA_W / N + 0.5, TELA_H, dx - 0.3, y + o, w / N + 0.6, h);
      if (luz) { ctx.fillStyle = luz > 0 ? `rgba(255,255,255,${luz})` : `rgba(0,0,0,${-luz})`; ctx.fillRect(dx, y + o, w / N + 0.3, h); }
    } else {
      const sx = i * TELA_W / N;
      const dx = x + i * w / N;
      ctx.drawImage(src, sx, 0, TELA_W / N + 0.5, TELA_H, dx - 0.3, y + o, w / N + 0.6, h);
      if (luz) { ctx.fillStyle = luz > 0 ? `rgba(255,255,255,${luz})` : `rgba(0,0,0,${-luz})`; ctx.fillRect(dx, y + o, w / N + 0.3, h); }
    }
  }
}

// Aro blanco discontinuo sobre el agua alrededor de tu bote: se reconoce sin depender del color
function aro3d(ctx, P, x, z, largo) {
  const pts = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const q = P(x + Math.cos(a) * 0.75, z + Math.sin(a) * largo * 0.62, 0);
    if (!q) return;
    pts.push(q);
  }
  ctx.save();
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 5]); ctx.stroke();
  ctx.restore();
}

// Vela cuadrada con el emblema en un mástil a proa. En tu bote es algo más pequeña, opaca y va a un lado para no
// tapar a tu remero; en los rivales cercanos se aclara un poco para que se vea la pista.
function velaReal3d(ctx, P, b, largo, t) {
  const deco = decoDe(b);
  if (!deco) return;
  const zP = b.dist + largo * 0.5 - 1.2;
  const dx = b.yo ? 0.95 : 0;
  const w = b.yo ? 1.3 : 1.8;
  const [h0, h1] = b.yo ? [0.9, 2.05] : [1.0, 2.6];
  const base = P(b.x + dx, zP, 0.15);
  const tope = P(b.x + dx, zP, h1 + 0.2);
  const a = P(b.x + dx - w / 2, zP, h1);
  const c = P(b.x + dx + w / 2, zP, h0);
  if (!base || !tope || !a || !c) return;
  const cerca = P(b.x, b.dist);
  const lejania = b.yo || !cerca ? 1 : Math.max(0, Math.min(1, (cerca.d - 10) / 10));
  ctx.save();
  ctx.globalAlpha = b.yo ? 1 : 0.55 + 0.4 * lejania;
  // Mástil y verga
  ctx.strokeStyle = '#6B4423';
  ctx.lineWidth = Math.max(1.2, base.s * 0.05);
  ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tope.x, tope.y); ctx.stroke();
  const sesgo = (tope.x - base.x) / (tope.y - base.y || -1);
  ctx.beginPath(); ctx.moveTo(a.x + sesgo * (a.y - c.y) - 2, a.y); ctx.lineTo(c.x + sesgo * (a.y - c.y) + 2, a.y); ctx.stroke();
  // Tela con el emblema, inclinada como el mástil
  const src = telaDe(deco, t, b.clase);
  if (src) {
    ctx.transform(1, 0, sesgo, 1, -sesgo * c.y, 0);
    telaOndeante(ctx, src, a.x, a.y, c.x - a.x, c.y - a.y, t + b.dist * 0.3, b.v);
  }
  ctx.restore();
  // Mascarón de tu colección en la proa
  if (deco.proa) {
    const q = P(b.x, b.dist + largo * 0.5 - 0.1, 0.45);
    if (q) {
      const lado = Math.max(10, q.s * 0.55);
      ctx.fillStyle = 'rgba(2,6,23,0.55)';
      ctx.beginPath(); ctx.arc(q.x, q.y, lado * 0.62, 0, Math.PI * 2); ctx.fill();
      pintarIcono(ctx, deco.proa.emblema, q.x, q.y, lado, deco.proa.tela, deco.proa.marca, t);
    }
  }
}

// En 2D (vista cenital) la vela se ve tumbada, ondeando por detrás de la popa, con el emblema a la vista.
function velaReal2d(ctx, x, y, largo, ancho, b, deco, t, pxm) {
  const src = telaDe(deco, t, b.clase);
  const mastil = x - largo * 0.93;
  const w = (b.yo ? 1.25 : 1.0) * pxm;
  const h = w * TELA_H / TELA_W;
  if (src) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    telaOndeante(ctx, src, mastil - w, y - h / 2, w, h, t + x * 0.01, b.v, true);
    ctx.restore();
  }
  ctx.fillStyle = '#6B4423';
  ctx.beginPath(); ctx.arc(mastil, y, Math.max(1.5, pxm * 0.06), 0, Math.PI * 2); ctx.fill();
  if (b.yo) {
    // Aro discontinuo alrededor de tu bote
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.ellipse(x - largo * 0.5, y, largo * 0.6, Math.max(ancho * 1.6, pxm * 0.7), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (deco.proa) pintarIcono(ctx, deco.proa.emblema, x - pxm * 0.15, y, Math.max(10, pxm * 0.55), deco.proa.tela, deco.proa.marca, t);
  }
}

function remero3d(ctx, P, b, { im, A, sx, sy }, t) {
  const q = P(b.x, b.dist - 0.4, 0);
  const q1 = P(b.x + 1, b.dist - 0.4, 0);
  if (!q || !q1) return;
  const ky = q.s / A.ppm;
  const kx = Math.max(q1.x - q.x, q.s * 0.62) / A.ppm;
  ctx.globalAlpha = b.yo ? 1 : 0.92;
  if (b.brillo) {
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = sinMovimiento ? 18 : 16 + 10 * Math.sin(t * 10);
  }
  // El atlas está renderizado con la cámara justo detrás del bote. En las calles laterales se inclina hacia el punto de
  // fuga: las líneas a lo largo del bote siguen la perspectiva y las horizontales (remos) se quedan horizontales.
  const pa = P(b.x, b.dist + 1.6, 0);
  const pb = P(b.x, b.dist - 2.4, 0);
  const sesgo = INCLINA_CALLE * (pa && pb && Math.abs(pa.y - pb.y) > 0.5 ? (pa.x - pb.x) / (pa.y - pb.y) : 0);
  ctx.save();
  ctx.transform(1, 0, sesgo, 1, -sesgo * q.y, 0);
  ctx.drawImage(im, sx, sy, A.w, A.h, q.x - A.ancla[0] * kx, q.y - A.ancla[1] * ky, A.w * kx, A.h * ky);
  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// Marca del color del rival sobre su bote (las diferencias van en la tabla de la esquina)
function marcaRival3d(ctx, P, b) {
  if (!b.yo) {
    const q = P(b.x, b.dist, 1.9);
    if (q) {
      const m = Math.max(4, Math.min(7, q.s * 0.25));
      ctx.fillStyle = b.color;
      ctx.strokeStyle = 'rgba(2,6,23,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(q.x - m, q.y - m * 1.4); ctx.lineTo(q.x + m, q.y - m * 1.4); ctx.lineTo(q.x, q.y); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }
}
