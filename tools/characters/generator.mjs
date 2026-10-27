// Generador vectorial de personajes (SVG) en estilo cartoon retro.
// Cuerpo paramétrico: masa (hombros, brazos, cuello, mandíbula) y def (cintura, abdomen).
// El rango cambia edad, pulcritud, cabello, vestuario y porte sobre la misma pose base.
// Fase 1: solo está implementado el rango maestro (principiante). Los demás rangos se
// derivan del maestro aprobado y se añaden en la fase 3.
import { CLASES, RANGOS, FORMATO } from './spec.mjs';

const INK = '#231A14';

export const mezcla = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

// Formas unidas: contorno grueso + relleno, para que la silueta tenga un solo contorno.
function capa(formas, color, borde = 0) {
  return formas.map((f) => {
    const fill = borde ? INK : color;
    const st = borde ? `stroke="${INK}" stroke-width="${borde}"` : '';
    if (f.t === 'tubo') return `<path d="${f.d}" fill="none" stroke="${fill}" stroke-width="${f.w + borde}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (f.t === 'circ') return `<circle cx="${f.x}" cy="${f.y}" r="${f.r}" fill="${fill}" ${st}/>`;
    if (f.t === 'elip') return `<ellipse cx="${f.x}" cy="${f.y}" rx="${f.rx}" ry="${f.ry}" fill="${fill}" ${st}/>`;
    return `<path d="${f.d}" fill="${fill}" ${st} stroke-linejoin="round"/>`;
  }).join('');
}
// Sombra de borde: luz arriba a la izquierda, sombra propia abajo a la derecha.
function bloque(formas, color, id, dx = -7, dy = -4) {
  const som = mezcla(color, '#4A2414', 0.32);
  return `<mask id="${id}"><rect x="-50" y="-50" width="400" height="520" fill="black"/>${capa(formas, '#fff')}</mask>
    ${capa(formas, INK, 7)}${capa(formas, som)}<g mask="url(#${id})" transform="translate(${dx} ${dy})">${capa(formas, color)}</g>`;
}
const pieza = (d, fill, w = 3.5) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const raya = (d, o = 1, w = 3, col = INK) => (o <= 0 ? '' : `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${Math.min(1, o).toFixed(2)}"/>`);

// Porte por rango: hombros, cabeza adelantada y apertura de piernas (misma pose base).
const PORTE = [
  { hombro: 5, cabeza: 4, piernas: 0 },
  { hombro: 1, cabeza: 0, piernas: 2 },
  { hombro: 0, cabeza: 0, piernas: 3 },
  { hombro: -2, cabeza: 0, piernas: 5 },
  { hombro: -3, cabeza: -1, piernas: 6 },
];
// Expresión por rango: alerta, decidido, confiado, dominante, sereno.
const EXPRESION = [
  { cejas: 'M120 76 Q130 68 141 72 M159 72 Q170 68 180 76', ojoRy: 11.5, pupila: 3.8, parpado: null, boca: 'M142 134 Q150 131 158 134' },
  { cejas: 'M121 76 Q131 73 142 77 M158 77 Q169 73 179 76', ojoRy: 10.5, pupila: 4.4, parpado: null, boca: 'M138 132 Q150 134 162 132' },
  { cejas: 'M121 77 Q131 71 141 75 M159 75 Q169 71 179 77', ojoRy: 10.5, pupila: 4.4, parpado: null, boca: 'M137 130 Q150 138 163 128' },
  { cejas: 'M120 74 Q131 74 142 80 M158 80 Q169 74 180 74', ojoRy: 10.5, pupila: 4.4, parpado: 90, boca: 'M138 132 Q152 135 162 129' },
  { cejas: 'M120 78 Q131 73 142 76 M158 76 Q169 73 180 78', ojoRy: 10.5, pupila: 4.4, parpado: 94, boca: 'M139 131 Q150 137 161 131' },
];
const CANAS = [0, 0, 0, 0.22, 0.62];

let uid = 0;

/**
 * Devuelve el SVG de un personaje.
 * @param {string} clase  id de clase (vikingo, pirata, samurai, polinesio, romano)
 * @param {object} o      { rango: id de rango, masa: 0-1, def: 0-1, ancho: px }
 */
export function personaje(clase, { rango = 'principiante', masa = 0, def = 0, ancho = 360 } = {}) {
  const c = CLASES[clase];
  if (!c) throw new Error(`Clase desconocida: ${clase}`);
  const t = RANGOS.findIndex((r) => r.id === rango);
  if (t < 0) throw new Error(`Rango desconocido: ${rango}`);
  if (t > 0) throw new Error(`El rango ${rango} se genera en la fase 3, tras aprobar el maestro de ${clase}`);
  const id = `${clase}-${rango}-${uid++}`;
  const piel = c.piel;
  const pelo = mezcla(c.pelo, '#D2D2D2', CANAS[t]);
  const P = c.paleta;
  const porte = PORTE[t];
  const L = (a, b, k = masa) => a + (b - a) * k;
  const cx = 150;

  // Medidas del cuerpo
  const sy = L(188, 172) + porte.hombro;
  const nw = L(15, 30), sw = L(56, 106), cw = L(50, 88);
  const bw = L(72, 50, def) + L(0, 4), hw = L(60, 50, def) + L(0, 3);
  const ua = L(20, 42), fa = L(18, 31), dr = L(10, 27);
  const geo = (s) => ({
    hx: cx + s * (sw - dr * 0.55), hy: sy + 12,
    ex: cx + s * (sw + L(0, 10)), ey: sy + 78,
    wx: cx + s * (sw + L(-2, 10) - 2), wy: sy + 138,
  });
  const brazo = (s) => {
    const { hx, hy, ex, ey, wx, wy } = geo(s);
    return [
      { t: 'tubo', d: `M${hx} ${hy} Q${ex + s * ua * 0.15} ${(hy + ey) / 2} ${ex} ${ey}`, w: ua },
      { t: 'tubo', d: `M${ex} ${ey} L${wx} ${wy}`, w: fa },
      { t: 'circ', x: hx + s * 2, y: hy + 2, r: dr },
      { t: 'circ', x: ex * 0.72 + wx * 0.28, y: ey * 0.72 + wy * 0.28 + 4, r: fa * 0.64 },
    ];
  };
  const mano = (s) => { const { wx, wy } = geo(s); return { t: 'circ', x: wx, y: wy + 12, r: L(12, 16) }; };
  const torso = `M${cx - nw} ${sy - 18} C${cx - nw} ${sy - 8} ${cx - sw + 18} ${sy - 10} ${cx - sw + 6} ${sy}
    C${cx - sw - 4} ${sy + 8} ${cx - cw - 2} ${sy + 30} ${cx - cw} ${sy + 48} C${cx - cw + 2} ${sy + 70} ${cx - bw} 235 ${cx - bw} 262
    C${cx - bw} 284 ${cx - hw - 2} 296 ${cx - hw} 312 L${cx + hw} 312 C${cx + hw + 2} 296 ${cx + bw} 284 ${cx + bw} 262
    C${cx + bw} 235 ${cx + cw - 2} ${sy + 70} ${cx + cw} ${sy + 48} C${cx + cw + 2} ${sy + 30} ${cx + sw + 4} ${sy + 8} ${cx + sw - 6} ${sy}
    C${cx + sw - 18} ${sy - 10} ${cx + nw} ${sy - 8} ${cx + nw} ${sy - 18} Z`;
  const cuello = { t: 'path', d: `M${cx - nw} 128 L${cx - nw} ${sy} L${cx + nw} ${sy} L${cx + nw} 128 Z` };
  const pie = (s) => cx + s * (L(30, 36) + porte.piernas);
  const piernas = [-1, 1].map((s) => ({ t: 'tubo', d: `M${cx + s * L(26, 30)} 300 L${pie(s)} 392`, w: L(30, 40) }));
  const cuerpo = [cuello, { t: 'path', d: torso }, ...brazo(-1), ...brazo(1), mano(1)];

  // Músculo: aparece con masa y definición
  const pecY = sy + 44;
  const det = [
    raya(`M${cx - 8} ${sy - 4} Q${cx - sw * 0.4} ${sy - 10} ${cx - sw + 22} ${sy - 4} M${cx + 8} ${sy - 4} Q${cx + sw * 0.4} ${sy - 10} ${cx + sw - 22} ${sy - 4}`, 0.25 + masa * 0.5, 2.4),
    raya(`M${cx - cw + 10} ${pecY - 4} C${cx - cw + 14} ${pecY + 14} ${cx - 14} ${pecY + 16} ${cx - 3} ${pecY + 6} M${cx + cw - 10} ${pecY - 4} C${cx + cw - 14} ${pecY + 14} ${cx + 14} ${pecY + 16} ${cx + 3} ${pecY + 6}`, 0.15 + masa, 3),
    raya(`M${cx} ${sy + 8} L${cx} ${pecY + 4}`, masa * 0.8, 2.4),
    ...[-1, 1].map((s) => raya(`M${cx + s * (sw - dr * 1.2)} ${sy + 4} Q${cx + s * (sw - dr * 0.7)} ${sy + 20 + dr * 0.5} ${cx + s * (sw - 4)} ${sy + 22 + dr * 0.8}`, masa * 1.3 - 0.2, 2.6)),
    ...[-1, 1].map((s) => raya(`M${cx + s * (cw - 2)} ${sy + 52} Q${cx + s * (cw - 4)} ${sy + 70} ${cx + s * (bw - 2)} ${sy + 92}`, 0.5, 2.4)),
  ];
  const abOp = (def - 0.35) * 2;
  if (abOp > 0) {
    det.push(raya(`M${cx} ${pecY + 18} L${cx} 286`, abOp, 2.6));
    for (let i = 0; i < 3; i++) {
      const y = pecY + 36 + i * L(22, 24, def);
      det.push(raya(`M${cx - 20 + i * 2} ${y} Q${cx - 10} ${y + 5} ${cx - 3} ${y + 2} M${cx + 3} ${y + 2} Q${cx + 10} ${y + 5} ${cx + 20 - i * 2} ${y}`, abOp, 2.6));
    }
  }
  const panza = Math.max(0, 1 - def * 2.2);
  if (panza > 0) {
    det.push(raya(`M${cx - bw + 10} 266 Q${cx} ${290 + 6 * panza} ${cx + bw - 10} 266`, panza * 0.8, 3));
    det.push(raya(`M${cx - 2} 258 q2 4 4 0`, panza, 2.4));
  }

  // Cabeza: misma estructura en todos los rangos; solo cambian expresión, edad y arreglo.
  const jaw = L(22, 40);
  const craneo = `M100 92 C100 20 200 20 200 92 C200 118 ${cx + jaw} 152 ${cx} 152 C${cx - jaw} 152 100 118 100 92 Z`;
  const cabezaF = [{ t: 'circ', x: 101, y: 98, r: 11 }, { t: 'circ', x: 199, y: 98, r: 11 }, { t: 'path', d: craneo }];
  const ex = EXPRESION[t];
  const ojos = `<ellipse cx="132" cy="94" rx="9" ry="${ex.ojoRy}" fill="#fff" stroke="${INK}" stroke-width="2.6"/><ellipse cx="168" cy="94" rx="9" ry="${ex.ojoRy}" fill="#fff" stroke="${INK}" stroke-width="2.6"/>
    <circle cx="133" cy="96" r="${ex.pupila}" fill="${INK}"/><circle cx="167" cy="96" r="${ex.pupila}" fill="${INK}"/><circle cx="134.4" cy="94.4" r="1.4" fill="#fff"/><circle cx="168.4" cy="94.4" r="1.4" fill="#fff"/>
    ${ex.parpado ? `<path d="M122 ${ex.parpado} Q132 ${ex.parpado - 5} 142 ${ex.parpado} L142 80 L122 80Z M158 ${ex.parpado} Q168 ${ex.parpado - 5} 178 ${ex.parpado} L178 80 L158 80Z" fill="${piel}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>` : ''}`;
  const nariz = `<ellipse cx="150" cy="111" rx="12" ry="10" fill="${mezcla(piel, '#C0504D', 0.18)}" stroke="${INK}" stroke-width="3"/><ellipse cx="146" cy="107" rx="3.5" ry="2.5" fill="#fff" opacity=".45"/>`;
  const edad = t >= 3 ? `${raya('M117 90 l-7 -3 M117 96 l-8 0 M183 90 l7 -3 M183 96 l8 0', 0.6, 2)}${raya('M137 117 Q132 126 136 136 M163 117 Q168 126 164 136', t === 4 ? 0.55 : 0.3, 2.2)}` : '';
  const vello = (op) => {
    let s = '';
    for (let y = 116; y <= 150; y += 5) for (let x = 106; x <= 194; x += 6) {
      const xx = x + ((y * 7) % 5) - 2;
      if (((xx - 150) / 48) ** 2 + ((y - 108) / 44) ** 2 < 1 && !(Math.abs(xx - 150) < 15 && y > 124 && y < 138) && (y > 122 || Math.abs(xx - 150) > 30)) s += `<circle cx="${xx}" cy="${y}" r="1.2" fill="${pelo}" opacity="${op}"/>`;
    }
    return s;
  };
  const greñas = (col = pelo) => `${pieza('M100 86 C94 44 108 26 124 30 L120 16 L136 24 L140 8 L153 22 L164 8 L168 26 L186 18 L181 34 C198 44 204 66 200 86 C190 64 172 54 150 56 C128 54 110 64 100 86Z', col)}${raya('M112 52 q8 -4 12 4 M176 50 q-6 -2 -10 6', 0.5, 2)}`;
  const casquete = (col = pelo) => pieza('M100 86 C96 32 204 32 200 86 C194 62 176 50 150 52 C126 50 108 60 100 86Z', col);

  // Ropa común
  const pantalon = (color, hasta = 392, ancho = 0) => piernas.map((f, i) => bloque([{ t: 'tubo', d: f.d.replace(' 300 ', ' 318 ').replace(/L(\S+) 392/, (m0, x) => `L${x} ${hasta}`), w: f.w + ancho }], color, `${id}pn${i}`, -6, 0)).join('');
  const calzado = (color) => [-1, 1].map((s) => pieza(`M${pie(s) - 18} 404 Q${pie(s) + s * 6} 384 ${pie(s) + 18} 404 Z`, color)).join('');
  const parche = (x, y, col) => `${pieza(`M${x} ${y} h14 v13 h-14z`, col, 2.4)}${raya(`M${x + 2} ${y + 3} h3 M${x + 9} ${y + 3} h3 M${x + 2} ${y + 10} h3 M${x + 9} ${y + 10} h3`, 0.6, 1.4)}`;
  const dobladillo = (y) => [-1, 1].map((s) => raya(`M${cx + s * 12} ${y} l${s * 6} 6 l${s * 6} -6 l${s * 6} 6 l${s * 6} -6 l${s * 6} 6 l${s * 6} -6`, 0.7, 2)).join('');
  const cuerda = (y = 300, col = '#B59B6A') => raya(`M${cx - hw - 2} ${y} Q${cx} ${y + 7} ${cx + hw + 2} ${y} M${cx + 8} ${y + 4} l-4 18 M${cx + 12} ${y + 4} l4 16`, 1, 5, col);
  const cinto = (color, alto = 14, y = 294) => pieza(`M${cx - hw - 3} ${y} Q${cx} ${y + 6} ${cx + hw + 3} ${y} L${cx + hw + 3} ${y + alto} Q${cx} ${y + alto + 6} ${cx - hw - 3} ${y + alto} Z`, color);
  const descalzo = calzado(mezcla(piel, '#000', 0.1));
  const sandalia = (col) => [-1, 1].map((s) => raya(`M${pie(s) - 14} 380 l28 8 M${pie(s) - 14} 390 l28 6`, 0.9, 3, col)).join('');

  // Arma en la mano derecha del personaje (izquierda en pantalla), apuntando al suelo.
  const { wx: ax, wy: awy } = geo(-1);
  const ay = awy + 12;
  const arma = (d, col, w, cabeza = '') => `${bloque([{ t: 'tubo', d, w }], col, `${id}ar`, -3, 0)}${cabeza}`;

  // Identidad de clase en el rango principiante.
  const clases = {
    vikingo: () => ({
      atras: pieza('M100 80 C88 130 96 168 110 182 L190 182 C204 168 212 130 200 80 Z', pelo),
      arma: arma(`M${ax + 10} ${ay - 12} L${ax - 44} ${ay + 50}`, '#8C6A44', 8, pieza(`M${ax - 30} ${ay + 34} L${ax - 50} ${ay + 18} Q${ax - 66} ${ay + 28} ${ax - 64} ${ay + 48} L${ax - 42} ${ay + 50} Z`, P.metal, 3)),
      ropa: `${pantalon(P.tela, 372)}${dobladillo(376)}${parche(cx - 44, 332, '#5E5040')}
        ${[-1, 1].map((s) => raya(`M${pie(s) - 14} 384 l28 6 M${pie(s) - 14} 394 l28 4`, 0.8, 2.6, '#8C7A5B')).join('')}${calzado('#6B5238')}${cinto(P.cuero)}${pieza(`M${cx - 7} 296 h14 v12 h-14Z`, '#8C7A5B', 2.6)}`,
      cara: vello(0.35),
      cabeza: greñas(),
    }),
    pirata: () => ({
      atras: bloque([{ t: 'tubo', d: `M${cx + 38} 70 Q${cx + 56} 110 ${cx + 46} 150`, w: 12 }], pelo, `${id}cola`, -3, 0),
      arma: arma(`M${ax + 10} ${ay - 12} L${ax - 36} ${ay + 44}`, '#9C7A52', 12, pieza(`M${ax + 4} ${ay - 22} l14 12 l-5 6 l-14 -12z`, '#7A5A3A', 2.6)),
      ropa: `${pantalon('#5B6B7A', 362)}${dobladillo(366)}${parche(cx + 30, 324, '#8C7A5B')}${descalzo}${cuerda(298)}
        ${[-1, 1].map((s) => pieza(`M${cx + s * (nw + 2)} ${sy - 16} C${cx + s * (sw - 20)} ${sy - 12} ${cx + s * (sw + 4)} ${sy - 2} ${cx + s * (sw - 2)} ${sy + 14}
          C${cx + s * (cw + 4)} ${sy + 60} ${cx + s * (bw + 4)} 250 ${cx + s * (hw + 6)} 300 L${cx + s * (hw - 18)} 300
          C${cx + s * cw * 0.5} 250 ${cx + s * cw * 0.5} ${sy + 40} ${cx + s * (nw - 2)} ${sy + 4} Z`, P.tela)).join('')}
        ${pieza(`M${cx - 18} ${sy - 14} Q${cx} ${sy + 4} ${cx + 18} ${sy - 14} L${cx + 6} ${sy + 18} L${cx - 2} ${sy + 4} Z`, P.acento, 3)}`,
      cara: `${vello(0.45)}<circle cx="202" cy="114" r="5" fill="none" stroke="${P.metal}" stroke-width="2.6"/>`,
      cabeza: greñas(),
    }),
    samurai: () => ({
      atras: '',
      arma: arma(`M${ax + 12} ${ay - 14} Q${ax - 20} ${ay + 18} ${ax - 52} ${ay + 46}`, '#B08A5E', 9),
      ropa: `${pantalon(P.tela, 356, 4)}${dobladillo(360)}
        ${[-1, 1].map((s) => raya(`M${pie(s) - 14} 382 l28 6`, 0.9, 3, '#C8A85A')).join('')}${calzado('#C8A85A')}
        ${bloque([{ t: 'path', d: `M${cx - hw - 4} 290 L${cx + hw + 4} 290 L${cx + hw + 5} 306 L${cx - hw - 5} 306 Z` }], '#E8E2D2', `${id}ob`, -4, 0)}`,
      cara: '',
      // Maegami: mechón frontal y coleta de joven antes del genpuku.
      cabeza: `${casquete()}${pieza('M124 42 C132 60 148 66 164 58 C156 74 136 74 124 58Z', pelo)}${pieza('M140 28 C138 10 162 10 160 28Z', pelo)}${pieza('M143 22 h14 v6 h-14z', '#E8E2D2', 2.2)}${pieza('M101 64 Q150 56 199 64 L199 74 Q150 66 101 74Z', '#F2EEE4', 3)}${pieza('M199 66 L220 60 L216 68 L222 76 L199 72Z', '#F2EEE4', 3)}`,
    }),
    polinesio: () => ({
      atras: '',
      arma: arma(`M${ax + 2} ${ay - 120} L${ax - 22} ${ay + 6}`, '#7A5536', 8, pieza(`M${ax - 21} ${ay} C${ax - 42} ${ay + 12} ${ax - 44} ${ay + 46} ${ax - 34} ${ay + 60} C${ax - 18} ${ay + 50} ${ax - 6} ${ay + 18} ${ax - 21} ${ay}Z`, '#8C6A44', 3)),
      // Malo: taparrabo de kapa, prenda masculina hawaiana documentada.
      ropa: `${descalzo}${bloque([{ t: 'path', d: `M${cx - hw - 4} 290 Q${cx} 298 ${cx + hw + 4} 290 L${cx + hw + 2} 306 Q${cx} 314 ${cx - hw - 2} 306 Z` }], P.tela, `${id}ma`, -4, 0)}
        ${bloque([{ t: 'path', d: `M${cx - 18} 304 L${cx + 18} 304 L${cx + 20} 352 L${cx - 20} 352 Z` }], P.tela, `${id}mf`, -4, 0)}${raya(`M${cx - 18} 346 h36`, 0.5, 2)}
        ${Array.from({ length: 9 }, (_, i) => { const k = (i - 4) / 4; const x = cx + k * (nw + 14), y = sy - 6 + (1 - k * k) * 16; return `<ellipse cx="${x}" cy="${y}" rx="8" ry="5" fill="#4C8C3A" stroke="${INK}" stroke-width="2" transform="rotate(${k * 40} ${x} ${y})"/>`; }).join('')}`,
      cara: '',
      cabeza: `${casquete()}${pieza('M134 34 C130 12 170 12 166 34Z', pelo)}${raya('M136 32 H164', 1, 3, '#B59B6A')}`,
    }),
    romano: () => ({
      atras: '',
      // Rudis: espada de madera de entrenamiento.
      arma: arma(`M${ax + 4} ${ay - 4} L${ax - 38} ${ay + 50}`, '#A88458', 12, pieza(`M${ax - 8} ${ay - 12} l18 14 l-5 6 l-18 -14z`, '#7A5A3A', 2.6)),
      ropa: `${descalzo}${sandalia('#8C6A44')}${bloque([{ t: 'path', d: `M${cx - hw - 4} 290 L${cx + hw + 4} 290 L${cx + hw + 12} 350 L${cx - hw - 12} 350 Z` }], P.tela, `${id}tu`, -6, 0)}
        ${raya(`M${cx - 30} 300 L${cx - 34} 348 M${cx + 6} 300 L${cx + 8} 348 M${cx + 34} 300 L${cx + 40} 348`, 0.35, 2)}${cuerda(292, '#8C7A5B')}
        ${(() => { const { wx, wy } = geo(1); const x = wx + 6, y = wy - 18; return `${bloque([{ t: 'elip', x, y, rx: 34, ry: 50 }], '#C8A46A', `${id}es`, -4, -2)}${raya(Array.from({ length: 7 }, (_, i) => `M${x - 30} ${y - 42 + i * 14} Q${x} ${y - 36 + i * 14} ${x + 30} ${y - 42 + i * 14}`).join(' '), 0.45, 2)}${raya(`M${x} ${y - 48} V${y + 48}`, 0.5, 2.4)}<circle cx="${x}" cy="${y}" r="8" fill="#8C6A44" stroke="${INK}" stroke-width="2.4"/>`; })()}`,
      cara: vello(0.3),
      cabeza: `${casquete()}${raya('M110 60 l6 8 M124 52 l4 10 M140 48 l2 10 M158 48 l-1 10 M174 52 l-4 10 M188 60 l-6 8', 0.8, 3, mezcla(pelo, '#000', 0.2))}`,
    }),
  };
  const g = clases[clase]();
  const [vx, vy, vw, vh] = FORMATO.viewBox;

  return `<svg viewBox="${vx} ${vy} ${vw} ${vh}" width="${ancho}" height="${Math.round((ancho * vh) / vw)}" xmlns="http://www.w3.org/2000/svg" data-clase="${clase}" data-rango="${rango}">
    ${g.atras}
    ${bloque(piernas, piel, `${id}pi`)}
    ${bloque(cuerpo, piel, `${id}cu`)}${det.join('')}
    ${g.ropa}
    ${g.arma}${bloque([mano(-1)], piel, `${id}mn`, -5, -3)}
    <g transform="translate(0 ${porte.cabeza})">
      ${bloque(cabezaF, piel, `${id}ca`, -6, -3)}
      ${raya(ex.cejas, 1, 5.5, mezcla(c.pelo, '#000', 0.2))}${ojos}${edad}
      ${g.cara}${nariz}${raya(ex.boca, 1, 3)}${g.cabeza}
    </g>
  </svg>`;
}
