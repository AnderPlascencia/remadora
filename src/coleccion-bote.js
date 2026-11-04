// Colección de bote por clase (etapa 15): 5 velas, mascarón (y su versión dorada) y palas para cada clase.
// Desde la revisión de la tienda, cada pieza da una ventaja pequeña en las carreras contra fantasmas (nunca en las
// pruebas ni en tus metros o récords), con un tope de 25 m por carrera para todo el equipo (TOPE_EQUIPO_M). Las 5 clases siguen la misma escalera, para que ninguna salga ganando:
// clásica (gratis), de rango (nivel 20), palas (600), de taller (1200), mascarón (nivel 40), épica (2200) y la
// legendaria con el mascarón dorado (hazaña de clase). El dibujo de cada emblema vive en carrera.js (campo emblema);
// sin dibujo propio, la pieza se pinta con sus colores.
// per (personaje guardado): piezas = ids comprados; equipoBote = { clase: { vela, proa, palas } }.
// ctx = { nivel, hazanas: Set de ids de hazaña } para lo que se gana remando.

export const NIVEL_RANGO = 20;
export const NIVEL_PROA = 40;
export const PRECIOS = { palas: 600, taller: 1200, epica: 2200 };
export const TIPOS = { vela: 'Vela', proa: 'Mascarón', palas: 'Palas' };
// Escalón de cada pieza en su clase, en el orden en que se suele conseguir.
export const ESCALONES = ['clasica', 'rango', 'palas', 'taller', 'proa', 'epica', 'legendaria', 'proa-oro'];
export const hazanaDeClase = (clase) => `clase-${clase}`;

const como = (escalon, clase) => ({
  clasica: { gratis: true },
  rango: { nivel: NIVEL_RANGO },
  palas: { precio: PRECIOS.palas },
  taller: { precio: PRECIOS.taller },
  proa: { nivel: NIVEL_PROA },
  epica: { precio: PRECIOS.epica },
  legendaria: { hazana: hazanaDeClase(clase) },
  'proa-oro': { hazana: hazanaDeClase(clase) },
})[escalon];
const tipoDe = (escalon) => (escalon === 'palas' ? 'palas' : escalon.startsWith('proa') ? 'proa' : 'vela');

// [escalón, nombre, texto, tela, marca, emblema]
const DATOS = {
  vikingo: [
    ['clasica', 'Franjas del norte', 'Lana roja a franjas crema, la vela de siempre del drakkar.', '#B91C1C', '#FDE68A', 'franjas'],
    ['rango', 'Cuervos de Odín', 'Crema con dos cuervos negros enfrentados.', '#F5E6C8', '#111827', 'cuervos'],
    ['palas', 'Escudos de guerra', 'Palas pintadas como escudos redondos, en cuartos rojos y blancos.', '#B91C1C', '#F8FAFC', 'escudo'],
    ['taller', 'Círculo de runas', 'Lana gris azulada con un anillo de runas talladas.', '#64748B', '#F8FAFC', 'runas'],
    ['proa', 'Cabeza de dragón', 'Un dragón de madera tallada en la roda.', '#7C4A21', '#3F2410', 'dragon'],
    ['epica', 'Lobo de invierno', 'Azul noche con la cabeza de un lobo blanco y escarcha en los bordes.', '#1E293B', '#F1F5F9', 'lobo'],
    ['legendaria', 'Fuego del Valhalla', 'Roja y dorada, con brasas que suben por la tela.', '#991B1B', '#FBBF24', 'brasas'],
    ['proa-oro', 'Dragón dorado', 'La cabeza de dragón, bañada en oro.', '#CA8A04', '#FEF3C7', 'dragon'],
  ],
  pirata: [
    ['clasica', 'Bandera negra', 'Lona negra con ribete blanco.', '#111827', '#F8FAFC', 'ribete'],
    ['rango', 'Jolly Roger', 'Negra con calavera y tibias blancas.', '#0F172A', '#F8FAFC', 'calavera'],
    ['palas', 'Calaveras', 'Palas negras con una calavera pequeña blanca.', '#111827', '#F8FAFC', 'calavera'],
    ['taller', 'Lona remendada', 'Lona beige gastada con parches cosidos.', '#D6C7A1', '#8B5E34', 'parches'],
    ['proa', 'Sirena', 'Una sirena tallada bajo el bauprés.', '#7C4A21', '#3F2410', 'sirena'],
    ['epica', 'Sables carmesí', 'Roja oscura con dos sables cruzados plateados.', '#7F1D1D', '#E2E8F0', 'sables'],
    ['legendaria', 'Kraken', 'Negra y morada con tentáculos verdes que brillan.', '#2E1065', '#4ADE80', 'kraken'],
    ['proa-oro', 'Sirena dorada', 'La sirena del bauprés, bañada en oro.', '#CA8A04', '#FEF3C7', 'sirena'],
  ],
  samurai: [
    ['clasica', 'Mon del clan', 'Blanca con el mon rojo del clan.', '#F8FAFC', '#DC2626', 'mon'],
    ['rango', 'Sol naciente', 'Blanca con un sol rojo y sus rayos.', '#F8FAFC', '#B91C1C', 'sol-naciente'],
    ['palas', 'Laca roja', 'Palas lacadas en rojo con el filo negro.', '#B91C1C', '#111827', 'filo'],
    ['taller', 'Gran ola', 'Índigo con una ola blanca estilizada.', '#1E3A8A', '#F8FAFC', 'ola'],
    ['proa', 'Grulla', 'Una grulla de madera lacada en la proa.', '#7C4A21', '#111827', 'grulla'],
    ['epica', 'Sakura', 'Rosa pálido con pétalos de cerezo.', '#FBCFE8', '#BE185D', 'sakura'],
    ['legendaria', 'Dragón de tormenta', 'Negra con un dragón dorado y relámpagos.', '#0B0B0F', '#FACC15', 'dragon-tormenta'],
    ['proa-oro', 'Grulla dorada', 'La grulla de la proa, bañada en oro.', '#CA8A04', '#FEF3C7', 'grulla'],
  ],
  polinesio: [
    ['clasica', 'Sol del Pacífico', 'Azul con un sol amarillo.', '#0EA5E9', '#FDE047', 'sol'],
    ['rango', 'Tapa', 'Fibra beige con triángulos y zigzags de tela tapa.', '#E7D3A8', '#6B3E1E', 'tapa'],
    ['palas', 'Olas talladas', 'Madera clara con olas grabadas.', '#D9B57A', '#7C4A21', 'olas'],
    ['taller', 'Honu', 'Verde mar con una tortuga marina.', '#0F766E', '#FDE68A', 'tortuga'],
    ['proa', 'Tiki', 'Un tiki tallado en la proa.', '#7C4A21', '#3F2410', 'tiki'],
    ['epica', 'Manta', 'Turquesa con una manta raya.', '#14B8A6', '#0F172A', 'manta'],
    ['legendaria', 'Estrellas del navegante', 'Índigo con constelaciones que titilan.', '#1E1B4B', '#F8FAFC', 'estrellas'],
    ['proa-oro', 'Tiki de jade y oro', 'El tiki de la proa, de jade y oro.', '#15803D', '#FACC15', 'tiki'],
  ],
  romano: [
    ['clasica', 'Púrpura imperial', 'Púrpura con una franja dorada.', '#7E22CE', '#FACC15', 'franja'],
    ['rango', 'SPQR', 'Roja con las letras SPQR doradas.', '#991B1B', '#FACC15', 'spqr'],
    ['palas', 'Escudo de la legión', 'Palas rojas con rayos dorados, como el escudo de un legionario.', '#991B1B', '#FACC15', 'rayos'],
    ['taller', 'Laureles', 'Blanca con una corona de laurel verde.', '#F8FAFC', '#15803D', 'laurel'],
    ['proa', 'Ojo de proa', 'Un ojo pintado en la proa y el espolón de bronce.', '#B45309', '#F8FAFC', 'ojo'],
    ['epica', 'Águila de la legión', 'Roja con un águila dorada de alas abiertas.', '#B91C1C', '#FACC15', 'aguila'],
    ['legendaria', 'Sol invicto', 'Dorada con un sol radiante que gira despacio.', '#CA8A04', '#FFF7ED', 'sol-invicto'],
    ['proa-oro', 'Espolón de oro', 'El ojo de proa con el espolón de oro.', '#CA8A04', '#FEF3C7', 'ojo'],
  ],
};

export const PIEZAS = {};
for (const [clase, lista] of Object.entries(DATOS)) {
  for (const [escalon, nombre, texto, tela, marca, emblema] of lista) {
    const id = `${clase}-${escalon}`;
    PIEZAS[id] = { id, clase, escalon, tipo: tipoDe(escalon), nombre, texto, tela, marca, emblema, animado: escalon === 'legendaria', como: como(escalon, clase) };
  }
}
export const CLASES_COLECCION = Object.keys(DATOS);
export const piezasDe = (clase) => ESCALONES.map((e) => PIEZAS[`${clase}-${e}`]).filter(Boolean);

// ¿Tienes la pieza? Lo gratis siempre, lo de nivel o hazaña cuando llegas y lo de tienda si lo compraste.
export function tienePieza(per = {}, id, { nivel = 1, hazanas = new Set() } = {}) {
  const x = PIEZAS[id];
  if (!x) return false;
  const c = x.como;
  if (c.gratis) return true;
  if (c.nivel) return nivel >= c.nivel;
  if (c.hazana) return hazanas.has(c.hazana);
  return (per.piezas || []).includes(id);
}

// Cómo se consigue, en una línea para la tienda.
export function comoSeConsigue(x) {
  const c = x.como;
  if (c.gratis) return 'Gratis con la clase';
  if (c.nivel) return `Se gana al llegar al nivel ${c.nivel}`;
  if (c.hazana) return 'Se gana con la hazaña de clase';
  return `${c.precio} monedas`;
}

// Cambios que hay que guardar al comprar una pieza (y estrenarla en el equipo de su clase); null si no se puede.
export function comprarPieza(per = {}, id, monedas) {
  const x = PIEZAS[id];
  if (!x?.como.precio || (per.piezas || []).includes(id) || monedas < x.como.precio) return null;
  return { piezas: [...(per.piezas || []), id], gastado: (per.gastado || 0) + x.como.precio, ...equipar(per, x.clase, x.tipo, id) };
}

// Cambios para equipar una pieza (id null: quitarla; en la vela, null vuelve a la clásica). La vela también acepta
// las velas de color de la tienda (id de VELAS en carrera.js), que valen para cualquier bote.
export function equipar(per = {}, clase, tipo, id) {
  const actual = per.equipoBote?.[clase] || {};
  return { equipoBote: { ...(per.equipoBote || {}), [clase]: { ...actual, [tipo]: id } } };
}

// Lo que lleva el bote de una clase: { vela, proa, palas }, cada uno un id de pieza (la vela puede ser una vela de
// color) o null. Lo que ya no tienes no se equipa. Sin elegir nada: la vela clásica, y la vela de color que tenías
// elegida antes de la colección (per.vela).
export function equipoDe(per = {}, clase, ctx = {}, { velaDeColor = () => false } = {}) {
  if (!DATOS[clase]) return { vela: null, proa: null, palas: null };
  const guardado = per.equipoBote?.[clase] || {};
  const vale = (id, tipo) => !!id && ((PIEZAS[id]?.clase === clase && PIEZAS[id].tipo === tipo && tienePieza(per, id, ctx)) || (tipo === 'vela' && velaDeColor(id)));
  const elegida = 'vela' in guardado ? guardado.vela : per.vela;
  return {
    vela: vale(elegida, 'vela') ? elegida : `${clase}-clasica`,
    proa: vale(guardado.proa, 'proa') ? guardado.proa : null,
    palas: vale(guardado.palas, 'palas') ? guardado.palas : null,
  };
}

// Vela de un rival según su categoría: los de Alta mar llevan la épica de su clase y los legendarios, la legendaria.
export function velaDeRival(clase, { dificultad = null, rango = null } = {}) {
  if (!DATOS[clase]) return null;
  if (rango === 'legendario') return PIEZAS[`${clase}-legendaria`];
  if (dificultad === 'altamar') return PIEZAS[`${clase}-epica`];
  return null;
}

// Ventaja de cada pieza en la carrera. Velas: metros de salida por escalón (la legendaria suma su efecto de clase);
// mascarón: un % más de distancia en los primeros 2 min; palas: 1 m cada 100 paladas.
export const SALIDA_VELA = { clasica: 0, rango: 5, taller: 8, epica: 12, legendaria: 15 };
export const SALIDA_VELA_COLOR = { carmesi: 4, esmeralda: 6, medianoche: 8, hielo: 10, oro: 12 };
export const INICIO_PROA = { proa: 0.01, 'proa-oro': 0.02 };
export const PALAS_M = 1;
export const EFECTO_LEGENDARIO = {
  vikingo: '+1 m cada 50 paladas',
  pirata: '+4 m cada vez que adelantas a un fantasma',
  samurai: '+1 m por cada minuto seguido remando sin pausas',
  polinesio: '+3 m cada 500 m',
  romano: '+2 m por día de racha del plan (hasta 7)',
};
export function ventajaTexto(x, id = x?.id) {
  if (!x) return '';
  if (!x.escalon) return SALIDA_VELA_COLOR[id] ? `Ventaja: empiezas ${SALIDA_VELA_COLOR[id]} m por delante` : '';
  if (x.tipo === 'palas') return `Ventaja: +${PALAS_M} m cada 100 paladas`;
  if (x.tipo === 'proa') return `Ventaja: +${INICIO_PROA[x.escalon] * 100} % de distancia en los primeros 2 min`;
  const m = SALIDA_VELA[x.escalon];
  if (!m) return 'Sin ventaja: la vela de siempre';
  return `Ventaja: empiezas ${m} m por delante${x.escalon === 'legendaria' ? ` y ${EFECTO_LEGENDARIO[x.clase]}` : ''}`;
}
// Lo que da el equipo en la carrera (para nuevaVentaja): { salida, inicio, porPaladas, legendaria } o null.
export function bonoEquipo(equipo) {
  if (!equipo) return null;
  const vela = PIEZAS[equipo.vela];
  const b = {
    salida: vela ? SALIDA_VELA[vela.escalon] || 0 : SALIDA_VELA_COLOR[equipo.vela] || 0,
    inicio: INICIO_PROA[PIEZAS[equipo.proa]?.escalon] || 0,
    porPaladas: PIEZAS[equipo.palas] ? PALAS_M : 0,
    legendaria: vela?.escalon === 'legendaria' ? vela.clase : null,
  };
  return b.salida || b.inicio || b.porPaladas || b.legendaria ? b : null;
}
