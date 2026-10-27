// Generador vectorial de personajes (SVG), estilo ilustración semirrealista.
// Volumen con degradados por pieza (luz desde arriba a la izquierda), sombras y luces
// difuminadas recortadas a la piel, textura de piel, mechones de pelo y pliegues de tela.
// Cuerpo paramétrico: masa (hombros, brazos, cuello) y def (cintura, abdomen).
// Fase 1: solo está implementado el rango maestro (novato).
import { CLASES, RANGOS, FORMATO } from './spec.mjs';

export const mezcla = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
const r1 = (n) => Math.round(n * 10) / 10;
const pt = (x, y) => `${r1(x)} ${r1(y)}`;

// Porte por rango sobre la misma pose base: hombros, cabeza y apertura de piernas.
const PORTE = [
  { hombro: 3, cabeza: 3, ancho: -2, piernas: 0 },
  { hombro: 0, cabeza: 0, ancho: 0, piernas: 2 },
  { hombro: -1, cabeza: 0, ancho: 1, piernas: 3 },
  { hombro: -2, cabeza: -1, ancho: 2, piernas: 4 },
  { hombro: -2, cabeza: -1, ancho: 2, piernas: 5 },
];
const CANAS = [0, 0, 0, 0.22, 0.62];

// Pieza cilíndrica (miembro) entre dos puntos, con radios y abultamiento por lado.
function capsula(x1, y1, ra, x2, y2, rb, b1 = 0, b2 = 0) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const A1 = [x1 + nx * ra, y1 + ny * ra], A2 = [x2 + nx * rb, y2 + ny * rb];
  const B1 = [x1 - nx * ra, y1 - ny * ra], B2 = [x2 - nx * rb, y2 - ny * rb];
  const k = len / 3;
  return `M${pt(...A1)} C${pt(A1[0] + ux * k + nx * b1, A1[1] + uy * k + ny * b1)} ${pt(A2[0] - ux * k + nx * b1, A2[1] - uy * k + ny * b1)} ${pt(...A2)}
    C${pt(A2[0] + ux * rb * 1.3, A2[1] + uy * rb * 1.3)} ${pt(B2[0] + ux * rb * 1.3, B2[1] + uy * rb * 1.3)} ${pt(...B2)}
    C${pt(B2[0] - ux * k - nx * b2, B2[1] - uy * k - ny * b2)} ${pt(B1[0] + ux * k - nx * b2, B1[1] + uy * k - ny * b2)} ${pt(...B1)}
    C${pt(B1[0] - ux * ra * 1.3, B1[1] - uy * ra * 1.3)} ${pt(A1[0] - ux * ra * 1.3, A1[1] - uy * ra * 1.3)} ${pt(...A1)} Z`;
}

let uid = 0;

/**
 * Devuelve el SVG de un personaje.
 * @param {string} clase  id de clase (vikingo, pirata, samurai, polinesio, romano)
 * @param {object} o      { rango: id de rango, masa: 0-1, def: 0-1, ancho: px }
 */
export function personaje(clase, { rango = RANGOS[0].id, masa = 0, def = 0, ancho = 360 } = {}) {
  const c = CLASES[clase];
  if (!c) throw new Error(`Clase desconocida: ${clase}`);
  const t = RANGOS.findIndex((r) => r.id === rango);
  if (t < 0) throw new Error(`Rango desconocido: ${rango}`);
  if (t > 0) throw new Error(`El rango ${rango} se genera en la fase 3, tras aprobar el maestro de ${clase}`);
  const id = `${clase}${rango}${uid++}`;
  const piel = c.piel, P = c.paleta;
  const pelo = mezcla(c.pelo, '#D2D2D2', CANAS[t]);
  const porte = PORTE[t];
  const L = (a, b, k = masa) => a + (b - a) * k;
  const cx = 150;
  const linea = mezcla(piel, '#2A1208', 0.72);
  const sombra = mezcla(piel, '#3A140A', 0.5);
  const luz = '#FFF3E4';
  const defs = [];
  const grad = (nombre, x1, x2, base, { y1 = 0, y2 = 0, luzF = 0.16, osc = 0.3 } = {}) => {
    defs.push(`<linearGradient id="${id}${nombre}" gradientUnits="userSpaceOnUse" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}">
      <stop offset="0" stop-color="${mezcla(base, '#3A140A', osc * 0.45)}"/><stop offset=".12" stop-color="${mezcla(base, luz, luzF)}"/>
      <stop offset=".42" stop-color="${base}"/><stop offset=".78" stop-color="${mezcla(base, '#3A140A', osc)}"/>
      <stop offset=".93" stop-color="${mezcla(base, '#3A140A', osc * 1.15)}"/><stop offset="1" stop-color="${mezcla(base, '#3A140A', osc * 0.7)}"/></linearGradient>`);
    return `url(#${id}${nombre})`;
  };
  // Pieza con relleno, contorno fino y sombreado interior recortado a su forma.
  let n = 0;
  const forma = (d, fill, { borde = linea, ancho = 1.4, dentro = '', union = null } = {}) => {
    const k = `${id}k${n++}`;
    if (union) { union.push(d); ancho = 0; }
    if (dentro) defs.push(`<clipPath id="${k}"><path d="${d}"/></clipPath>`);
    return `<path d="${d}" fill="${fill}" stroke="${borde}" stroke-width="${ancho}" stroke-linejoin="round"/>${dentro ? `<g clip-path="url(#${k})">${dentro}</g>` : ''}`;
  };
  const bl = (d, color, op, s = 3) => `<path d="${d}" fill="${color}" opacity="${op}" filter="url(#${id}b${s})"/>`;
  const trazo = (d, color, op, w = 1.2, s = 0) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"${s ? ` filter="url(#${id}b${s})"` : ''}/>`;

  // ---------- Medidas ----------
  const sy = 92 + porte.hombro;
  const N = L(9, 14), S = L(45, 64) + porte.ancho, C = L(37, 50);
  const panza = Math.max(0, 1 - def * 2);
  const W = L(32, 26, def) + L(0, 3) + 3 * panza, H = L(33, 31, def) + L(0, 2);
  const dR = L(11, 17);
  const brazo = (s) => {
    const hx = cx + s * (S - 9), hy = sy + 14;
    const ex = cx + s * (S - 2 + L(0, 5)), ey = sy + 72;
    const wx = cx + s * (S + 1 + L(0, 7)), wy = sy + 124;
    return { hx, hy, ex, ey, wx, wy };
  };
  const pie = (s) => cx + s * (17 + porte.piernas);

  // ---------- Piel: piernas, brazos, torso, cuello ----------
  const capaPiel = [];
  const contorno = [];
  const pierna = (s) => {
    const muslo = capsula(cx + s * 16, 214, L(16, 19), cx + s * 17, 300, L(10, 11.5), s * L(2, 4), -s * 1);
    const gemelo = capsula(cx + s * 17, 300, L(9.5, 11), pie(s), 386, 5.5, s * L(3, 5), -s * 1.5);
    const g = grad(`pi${s}`, cx + s * 16 - 20, cx + s * 16 + 20, piel);
    return forma(muslo, g, { union: contorno, dentro: bl(`M${cx + s * 16 + 6} 220 l10 0 l-2 76 l-8 0z`, sombra, 0.25, 4) }) + forma(gemelo, g, { union: contorno });
  };
  const ladoBrazo = (s) => {
    const { hx, hy, ex, ey, wx, wy } = brazo(s);
    const ra = L(7.5, 11.5), rc = L(5.8, 10), rm = L(4.4, 6.6);
    const sup = capsula(hx + s * 1, hy - 3, dR * 0.95, ex, ey, rc, s * L(2, 5), -s * L(1.5, 3.5));
    const ant = capsula(ex, ey, rc, wx, wy, rm, s * L(2, 4), -s * L(1, 2));
    const gB = grad(`br${s}`, (hx + ex) / 2 - ra - 2, (hx + ex) / 2 + ra + 2, piel);
    const gA = grad(`an${s}`, (ex + wx) / 2 - rc - 2, (ex + wx) / 2 + rc + 2, piel);
    const mano = `M${pt(wx - 7.5, wy - 3)} C${pt(wx - 10, wy + 7)} ${pt(wx - 9, wy + 19)} ${pt(wx - 4, wy + 24)} C${pt(wx + 1, wy + 27)} ${pt(wx + 7.5, wy + 25)} ${pt(wx + 8.5, wy + 16)}
      C${pt(wx + 9.5, wy + 7)} ${pt(wx + 8.5, wy)} ${pt(wx + 7.5, wy - 3)}Z`;
    const pulgar = `M${pt(wx - s * 5, wy + 4)} q${-s * 4} 5 ${-s * 2} 10 q${s * 2} 2 ${s * 4} -2`;
    return forma(sup, gB, { union: contorno, dentro: `${bl(`M${pt(hx - s * dR * 0.5, hy - dR * 0.7)} q${s * dR * 0.8} -3 ${s * dR} ${dR * 0.7} q${-s * dR * 0.6} ${dR * 0.3} ${-s * dR} ${-dR * 0.3}z`, luz, 0.35, 2.5)}${bl(`M${pt(hx - s * dR * 0.9, hy + dR * 1.2)} q${s * dR} ${dR * 0.8} ${s * dR * 1.9} ${-dR * 0.2}`, sombra, 0.2 + 0.35 * masa, 2)}${bl(`M${pt(ex - s * 2, hy + 10)} l${s * -9} 4 l${s * -2} 44 l${s * 9} 2z`, sombra, 0.35, 3)}${bl(`M${pt(hx + s * 2, hy + 18)} q${s * 6} 18 ${s * 2} 36 l${s * 4} -2 q${s * 2} -20 ${-s * 3} -34z`, luz, 0.25 + 0.2 * masa, 3)}` })
      + forma(ant, gA, { union: contorno, dentro: bl(`M${pt(ex - s * 1, ey + 2)} l${s * -7} 2 l${s * -2} 46 l${s * 6} 0z`, sombra, 0.3, 3) })

      + forma(mano, grad(`ma${s}`, wx - 9, wx + 9, piel), { union: contorno, dentro: trazo(`M${pt(wx - 5, wy + 12)} q5 3 11 0 M${pt(wx - 5, wy + 7)} q5 3 11 0`, linea, 0.35, 0.9) })
      + trazo(pulgar, linea, 0.5, 1);
  };
  const torso = `M${pt(cx - N, sy - 14)} C${pt(cx - N - 6, sy - 6)} ${pt(cx - S + 16, sy - 6)} ${pt(cx - S + 6, sy + 1)}
    C${pt(cx - S + 2, sy + 10)} ${pt(cx - C - 4, sy + 20)} ${pt(cx - C - 2, sy + 34)} C${pt(cx - C + 1, sy + 58)} ${pt(cx - W - 4 * panza, 160)} ${pt(cx - W, 180)}
    C${pt(cx - W - 1, 196)} ${pt(cx - H, 200)} ${pt(cx - H, 216)} L${pt(cx + H, 216)} C${pt(cx + H, 200)} ${pt(cx + W + 1, 196)} ${pt(cx + W, 180)}
    C${pt(cx + W + 4 * panza, 160)} ${pt(cx + C - 1, sy + 58)} ${pt(cx + C + 2, sy + 34)} C${pt(cx + C + 4, sy + 20)} ${pt(cx + S - 2, sy + 10)} ${pt(cx + S - 6, sy + 1)}
    C${pt(cx + S - 16, sy - 6)} ${pt(cx + N + 6, sy - 6)} ${pt(cx + N, sy - 14)} Z`;
  const pecY = sy + 30 + 3 * (1 - masa);
  const abOp = Math.max(0, def - 0.3) * 1.2;
  const anat = [
    // Sombra lateral derecha y luz izquierda del torso
    bl(`M${pt(cx + C - 10, sy + 20)} C${pt(cx + C + 6, sy + 60)} ${pt(cx + W + 8, 170)} ${pt(cx + H, 216)} L${pt(cx + H + 10, 216)} L${pt(cx + C + 10, sy + 10)}Z`, sombra, 0.45, 6),
    bl(`M${pt(cx - C + 4, sy + 26)} C${pt(cx - C + 2, sy + 60)} ${pt(cx - W + 2, 150)} ${pt(cx - W + 4, 190)} L${pt(cx - W + 12, 190)} C${pt(cx - W + 10, 150)} ${pt(cx - C + 12, sy + 60)} ${pt(cx - C + 12, sy + 26)}Z`, luz, 0.18, 5),
    // Clavículas
    trazo(`M${pt(cx - 4, sy - 4)} Q${pt(cx - S * 0.45, sy - 8)} ${pt(cx - S + 14, sy - 3)} M${pt(cx + 4, sy - 4)} Q${pt(cx + S * 0.45, sy - 8)} ${pt(cx + S - 14, sy - 3)}`, sombra, 0.55, 2.2, 1),
    bl(`M${pt(cx - S + 16, sy - 2)} Q${pt(cx - S * 0.45, sy - 5)} ${pt(cx - 6, sy - 1)} L${pt(cx - 6, sy + 3)} Q${pt(cx - S * 0.45, sy)} ${pt(cx - S + 16, sy + 3)}Z`, luz, 0.35, 2),
    // Pectorales: sombra inferior y luz superior
    bl(`M${pt(cx - C + 6, pecY)} C${pt(cx - C + 10, pecY + 12 + 4 * masa)} ${pt(cx - 10, pecY + 14 + 4 * masa)} ${pt(cx - 1, pecY + 6)} L${pt(cx - 1, pecY + 12 + 4 * masa)} C${pt(cx - 12, pecY + 22 + 4 * masa)} ${pt(cx - C + 8, pecY + 18)} ${pt(cx - C + 4, pecY + 6)}Z`, sombra, 0.25 + 0.4 * masa, 2.5),
    bl(`M${pt(cx + C - 6, pecY)} C${pt(cx + C - 10, pecY + 12 + 4 * masa)} ${pt(cx + 10, pecY + 14 + 4 * masa)} ${pt(cx + 1, pecY + 6)} L${pt(cx + 1, pecY + 12 + 4 * masa)} C${pt(cx + 12, pecY + 22 + 4 * masa)} ${pt(cx + C - 8, pecY + 18)} ${pt(cx + C - 4, pecY + 6)}Z`, sombra, 0.35 + 0.45 * masa, 2.5),
    bl(`M${pt(cx - C + 10, sy + 8)} Q${pt(cx - 14, sy + 4)} ${pt(cx - 6, sy + 12)} Q${pt(cx - 12, pecY + 4)} ${pt(cx - C + 10, pecY)}Z`, luz, 0.18 + 0.2 * masa, 4),
    trazo(`M${pt(cx, sy + 4)} L${pt(cx, pecY + 10)}`, sombra, 0.2 + 0.5 * masa, 1.6, 1),
    // Pezones
    `<ellipse cx="${r1(cx - C * 0.55)}" cy="${r1(pecY + 6)}" rx="2.6" ry="2" fill="${mezcla(piel, '#7A3A2A', 0.35)}" opacity=".8"/><ellipse cx="${r1(cx + C * 0.55)}" cy="${r1(pecY + 6)}" rx="2.6" ry="2" fill="${mezcla(piel, '#7A3A2A', 0.42)}" opacity=".8"/>`,
    // Ombligo y vientre
    `<ellipse cx="${cx}" cy="182" rx="2" ry="3" fill="${sombra}" opacity=".7"/>`,
    bl(`M${pt(cx - W + 6, 196)} Q${pt(cx, 216 + 4 * panza)} ${pt(cx + W - 6, 196)} L${pt(cx + W - 4, 214)} L${pt(cx - W + 4, 214)}Z`, sombra, 0.18 + 0.2 * panza, 4),
    panza > 0 ? bl(`M${pt(cx - 18, 160)} Q${pt(cx - 4, 150)} ${pt(cx + 6, 162)} Q${pt(cx - 4, 172)} ${pt(cx - 18, 168)}Z`, luz, 0.22 * panza, 5) : '',
    // Oblicuos y línea alba
    bl(`M${pt(cx - W + 2, 170)} Q${pt(cx - W + 10, 196)} ${pt(cx - 10, 214)} L${pt(cx - 14, 214)} Q${pt(cx - W + 4, 200)} ${pt(cx - W - 2, 172)}Z M${pt(cx + W - 2, 170)} Q${pt(cx + W - 10, 196)} ${pt(cx + 10, 214)} L${pt(cx + 14, 214)} Q${pt(cx + W - 4, 200)} ${pt(cx + W + 2, 172)}Z`, sombra, 0.15 + 0.35 * def, 2),
  ];
  if (abOp > 0) {
    anat.push(trazo(`M${pt(cx, pecY + 16)} L${pt(cx, 196)}`, sombra, abOp * 0.7, 2, 1));
    for (let i = 0; i < 3; i++) {
      const y = pecY + 30 + i * 17;
      anat.push(trazo(`M${pt(cx - 15, y)} Q${pt(cx - 7, y + 3)} ${pt(cx - 1, y + 1)} M${pt(cx + 1, y + 1)} Q${pt(cx + 7, y + 3)} ${pt(cx + 15, y)}`, sombra, abOp * 0.6, 2, 1));
      anat.push(bl(`M${pt(cx - 13, y + 3)} q6 -1 10 2 l0 8 q-6 1 -10 -2z`, luz, abOp * 0.25, 2));
    }
  }
  const cuello = `M${pt(cx - N + 1, 60)} C${pt(cx - N, 72)} ${pt(cx - N - 1, sy - 12)} ${pt(cx - N - 3, sy - 8)} L${pt(cx + N + 3, sy - 8)} C${pt(cx + N + 1, sy - 12)} ${pt(cx + N, 72)} ${pt(cx + N - 1, 60)}Z`;
  const gT = grad('to', cx - S, cx + S, piel, { luzF: 0.12, osc: 0.24 });
  capaPiel.push(
    pierna(-1), pierna(1),
    forma(cuello, grad('cu', cx - N - 4, cx + N + 4, piel), { union: contorno, dentro: `${bl(`M${pt(cx - N - 4, 62)} L${pt(cx + N + 4, 62)} L${pt(cx + N + 4, 76)} Q${cx} 82 ${pt(cx - N - 4, 76)}Z`, sombra, 0.55, 3)}${trazo(`M${pt(cx - N + 3, 74)} L${pt(cx - 3, sy - 6)} M${pt(cx + N - 3, 74)} L${pt(cx + 3, sy - 6)}`, sombra, 0.25 + 0.3 * masa, 1.6, 1)}` }),
    forma(torso, gT, { union: contorno, dentro: anat.join('') }),
    ladoBrazo(-1), ladoBrazo(1),
  );

  // ---------- Cabeza ----------
  const hy = porte.cabeza;
  const jaw = L(15.5, 18);
  const cabezaD = `M${pt(cx, 12)} C${pt(cx + 15, 12)} ${pt(cx + 22, 22)} ${pt(cx + 22, 38)} C${pt(cx + 22, 47)} ${pt(cx + 21, 54)} ${pt(cx + jaw, 62)}
    C${pt(cx + 13, 70)} ${pt(cx + 7, 75)} ${pt(cx, 75.5)} C${pt(cx - 7, 75)} ${pt(cx - 13, 70)} ${pt(cx - jaw, 62)} C${pt(cx - 21, 54)} ${pt(cx - 22, 47)} ${pt(cx - 22, 38)}
    C${pt(cx - 22, 22)} ${pt(cx - 15, 12)} ${pt(cx, 12)}Z`;
  const ojo = (s, mirada) => {
    const x = cx + s * 8.6, y = 44;
    const blanco = `M${pt(x - 5, y)} Q${pt(x, y - 3.6)} ${pt(x + 5, y)} Q${pt(x, y + 2.8)} ${pt(x - 5, y)}Z`;
    const k = `${id}o${s}`;
    defs.push(`<clipPath id="${k}"><path d="${blanco}"/></clipPath>`);
    return `<path d="${blanco}" fill="#F3EEE6"/>
      <g clip-path="url(#${k})"><circle cx="${r1(x + mirada)}" cy="${y - 0.2}" r="2.5" fill="${c.ojos || '#5B4632'}"/><circle cx="${r1(x + mirada)}" cy="${y - 0.2}" r="1.2" fill="#140D08"/>
      <path d="M${pt(x - 5, y - 3)} L${pt(x + 5, y - 3)} L${pt(x + 5, y - 0.6)} Q${pt(x, y - 2.6)} ${pt(x - 5, y - 0.4)}Z" fill="#3A2416" opacity=".35"/></g>
      <circle cx="${r1(x + mirada - 0.8)}" cy="${r1(y - 1.1)}" r=".6" fill="#fff"/>
      <path d="M${pt(x - 5.6, y + 0.2)} Q${pt(x, y - 4.4)} ${pt(x + 5.4, y - 0.2)}" fill="none" stroke="#2A1810" stroke-width="1.3" stroke-linecap="round"/>
      ${trazo(`M${pt(x - 4.5, y + 1.6)} Q${pt(x, y + 3.4)} ${pt(x + 4.5, y + 1.4)}`, sombra, 0.45, 0.7)}
      ${trazo(`M${pt(x - 5, y - 5.2)} Q${pt(x, y - 7.4)} ${pt(x + 5, y - 5)}`, sombra, 0.35, 0.8)}`;
  };
  // Principiante: mirada inquieta (de reojo) y cejas algo levantadas por dentro.
  const cejas = [-1, 1].map((s) => {
    const x0 = cx + s * 3.5, x1 = cx + s * 14.5;
    return Array.from({ length: 9 }, (_, i) => {
      const f = i / 8, x = x0 + (x1 - x0) * f, y = 37.2 - 1.8 * Math.sin(f * Math.PI) - (1 - f) * 1.2;
      return `<path d="M${pt(x - s * 0.6, y + 1.6)} l${r1(s * 2.2)} -2.4" stroke="${mezcla(c.pelo, '#000000', 0.25)}" stroke-width="1.3" stroke-linecap="round"/>`;
    }).join('');
  }).join('');
  const cara = [
    // Volumen de la cara
    bl(`M${pt(cx + 8, 16)} C${pt(cx + 24, 22)} ${pt(cx + 24, 52)} ${pt(cx + jaw, 64)} C${pt(cx + 10, 74)} ${pt(cx + 4, 76)} ${pt(cx + 2, 76)} C${pt(cx + 14, 62)} ${pt(cx + 16, 40)} ${pt(cx + 8, 16)}Z`, sombra, 0.4, 3),
    bl(`M${pt(cx - 16, 24)} C${pt(cx - 10, 16)} ${pt(cx + 2, 16)} ${pt(cx + 4, 22)} C${pt(cx - 4, 22)} ${pt(cx - 12, 26)} ${pt(cx - 16, 34)}Z`, luz, 0.3, 3),
    // Cuencas de los ojos
    bl(`M${pt(cx - 15, 41)} Q${pt(cx - 8, 35)} ${pt(cx - 2, 41)} Q${pt(cx - 8, 46)} ${pt(cx - 15, 41)}Z M${pt(cx + 15, 41)} Q${pt(cx + 8, 35)} ${pt(cx + 2, 41)} Q${pt(cx + 8, 46)} ${pt(cx + 15, 41)}Z`, sombra, 0.32, 1.5),
    // Pómulos
    bl(`M${pt(cx - 18, 50)} q5 -4 10 -1 q-4 5 -10 4z`, luz, 0.3, 2),
    bl(`M${pt(cx + 9, 52)} q5 -2 9 0 q-2 5 -9 3z`, sombra, 0.25, 2),
    // Nariz
    bl(`M${pt(cx + 1.5, 42)} C${pt(cx + 4, 46)} ${pt(cx + 5, 51)} ${pt(cx + 4.5, 54)} L${pt(cx + 1.5, 55)}Z`, sombra, 0.4, 1),
    bl(`M${pt(cx - 1.2, 43)} L${pt(cx - 0.4, 52)} L${pt(cx - 2, 52)}Z`, luz, 0.5, 0.8),
    `<path d="M${pt(cx - 4.6, 54.3)} Q${pt(cx - 3, 52.4)} ${pt(cx - 1.2, 54.8)} Q${pt(cx, 55.8)} ${pt(cx + 1.2, 54.8)} Q${pt(cx + 3, 52.4)} ${pt(cx + 4.6, 54.3)}" fill="none" stroke="${linea}" stroke-width="1" stroke-linecap="round" opacity=".75"/>`,
    bl(`M${pt(cx - 4, 55.5)} Q${cx} 58 ${pt(cx + 4, 55.5)} L${pt(cx + 3, 57.5)} Q${cx} 59 ${pt(cx - 3, 57.5)}Z`, sombra, 0.35, 0.8),
    // Boca: tensa, ligeramente apretada
    `<path d="M${pt(cx - 6, 62.2)} Q${pt(cx - 2.5, 60.6)} ${pt(cx, 61.4)} Q${pt(cx + 2.5, 60.6)} ${pt(cx + 6, 62.2)} Q${cx} 62.8 ${pt(cx - 6, 62.2)}Z" fill="${mezcla(piel, '#8A3A30', 0.4)}"/>`,
    `<path d="M${pt(cx - 5.4, 62.4)} Q${cx} 66.4 ${pt(cx + 5.4, 62.4)} Q${cx} 63.4 ${pt(cx - 5.4, 62.4)}Z" fill="${mezcla(piel, '#A0524A', 0.3)}"/>`,
    trazo(`M${pt(cx - 6, 62.3)} Q${cx} 62.9 ${pt(cx + 6, 62.3)}`, '#3A1A12', 0.75, 0.9),
    bl(`M${pt(cx - 2.5, 63.8)} q2.5 1 5 0 l-0.5 1.2 q-2 0.8 -4 0z`, luz, 0.35, 0.6),
    bl(`M${pt(cx - 4, 67)} Q${cx} 69.5 ${pt(cx + 4, 67)} L${pt(cx + 3, 69)} Q${cx} 70.5 ${pt(cx - 3, 69)}Z`, sombra, 0.35, 1),
    // Pliegue nasogeniano suave (juventud) y sombra de la mandíbula
    trazo(`M${pt(cx + 5, 55)} Q${pt(cx + 8, 59)} ${pt(cx + 7.5, 62)}`, sombra, 0.18, 0.9, 0.5),
  ].join('');
  const orejas = [-1, 1].map((s) => forma(`M${pt(cx + s * 20.5, 40)} C${pt(cx + s * 26, 37)} ${pt(cx + s * 27, 48)} ${pt(cx + s * 24, 53)} C${pt(cx + s * 23, 55)} ${pt(cx + s * 21, 55)} ${pt(cx + s * 20.5, 52)}Z`,
    grad(`or${s}`, cx + s * 20, cx + s * 27, piel), { dentro: trazo(`M${pt(cx + s * 22, 42)} q${s * 3} 2 ${s * 1.4} 8`, sombra, 0.5, 1) })).join('');
  const vello = (op, desde = 52) => {
    let s = '';
    for (let y = desde; y <= 75; y += 1.7) for (let x = cx - 20; x <= cx + 20; x += 1.9) {
      const xx = x + (((y * 13 + x * 7) % 9) / 9 - 0.5) * 1.6;
      const dentroCara = ((xx - cx) / 20.5) ** 2 + ((y - 50) / 26) ** 2 < 1;
      const boca = Math.abs(xx - cx) < 8 && y > 59 && y < 67;
      if (dentroCara && !boca && (y > 58 || Math.abs(xx - cx) > 13)) s += `<circle cx="${r1(xx)}" cy="${r1(y)}" r=".42" fill="${mezcla(c.pelo, '#000000', 0.3)}" opacity="${op}"/>`;
    }
    return s;
  };

  // Mechones de pelo: un volumen base con degradado y trazos finos encima.
  const mechones = (base, lista, { claro = 0.25, oscuro = 0.35 } = {}) => {
    const gp = `${id}gp${n++}`;
    defs.push(`<linearGradient id="${gp}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mezcla(pelo, '#FFE9D0', claro)}"/><stop offset=".5" stop-color="${pelo}"/><stop offset="1" stop-color="${mezcla(pelo, '#120804', oscuro)}"/></linearGradient>`);
    return `${forma(base, `url(#${gp})`, { borde: mezcla(pelo, '#120804', 0.6), ancho: 1.2 })}
      ${lista.map((d, i) => trazo(d, i % 3 === 0 ? mezcla(pelo, '#FFE9D0', 0.3) : mezcla(pelo, '#120804', 0.35), i % 3 === 0 ? 0.6 : 0.55, i % 3 === 0 ? 0.8 : 1)).join('')}`;
  };
  const tela = (d, color, { pliegues = [], luzP = [], borde } = {}) => forma(d, grad(`te${n}`, cx - 60, cx + 60, color, { luzF: 0.1, osc: 0.32 }), {
    borde: borde || mezcla(color, '#140A04', 0.65), ancho: 1.3,
    dentro: `${pliegues.map((p) => bl(p, mezcla(color, '#140A04', 0.6), 0.45, 2)).join('')}${luzP.map((p) => bl(p, '#FFF6E8', 0.18, 2)).join('')}${`<rect x="-30" y="0" width="360" height="420" filter="url(#${id}ruido)" opacity=".18"/>`}`,
  });
  const cuero = (d, color = P.cuero) => forma(d, grad(`cu${n}`, cx - 50, cx + 50, color, { luzF: 0.18, osc: 0.35 }), { borde: mezcla(color, '#100804', 0.6), ancho: 1.2, dentro: `<rect x="-30" y="0" width="360" height="420" filter="url(#${id}ruido)" opacity=".22"/>` });
  const metal = (d, color = P.metal) => forma(d, grad(`me${n}`, cx - 30, cx + 30, color, { luzF: 0.55, osc: 0.45 }), { borde: mezcla(color, '#0A0A0A', 0.6), ancho: 1.1 });

  // Pantalón ancho hasta el tobillo (o corto)
  const pantalon = (color, { hasta = 384, ancho = 0, remiendo = false, vendas = null } = {}) => {
    const piernaP = (s) => {
      const x0 = cx + s * 1, x1 = cx + s * (H + 3 + ancho), xa = pie(s);
      const d = `M${pt(cx, 206)} L${pt(x1, 204)} C${pt(x1 + s * 4, 250)} ${pt(xa + s * (12 + ancho * 0.6), 320)} ${pt(xa + s * (10 + ancho * 0.4), hasta)} L${pt(xa - s * (10 + ancho * 0.4), hasta)}
        C${pt(xa - s * 9, 320)} ${pt(x0 + s * 6, 260)} ${pt(x0, 222)}Z`;
      return tela(d, color, {
        pliegues: [`M${pt(xa - s * 2, 236)} q${s * 4} 30 ${s * 1} 60 l${s * 3} 0 q${s * 2} -30 ${-s * 2} -60z`, `M${pt(cx + s * 4, 214)} l${s * 10} 10 l${s * 2} -2z`, `M${pt(xa - s * 8, hasta - 22)} q${s * 8} -4 ${s * 18} 2 l0 3 q${-s * 10} -4 ${-s * 18} 0z`],
        luzP: [`M${pt(xa + s * 8 - (s > 0 ? 16 : 0), 240)} l4 0 l2 60 l-4 0z`],
      });
    };
    const vend = vendas ? [-1, 1].map((s) => Array.from({ length: 6 }, (_, i) => {
      const y = 324 + i * 10, xa = pie(s);
      return tela(`M${pt(xa - 11, y)} L${pt(xa + 11, y + 4)} L${pt(xa + 11, y + 10)} L${pt(xa - 11, y + 6)}Z`, vendas);
    }).join('')).join('') : '';
    const rem = remiendo ? tela(`M${pt(cx - 30, 300)} l15 -1 l1 14 l-15 1z`, mezcla(color, '#000000', 0.2)) + trazo(`M${pt(cx - 29, 301)} l1 13 M${pt(cx - 16, 300)} l1 13`, '#E8DCC0', 0.6, 0.7) : '';
    const tiro = tela(`M${pt(cx - 10, 205)} L${pt(cx + 10, 205)} L${pt(cx + 3, 236)} L${pt(cx - 3, 236)}Z`, color);
    return `${tiro}${piernaP(-1)}${piernaP(1)}${rem}${vend}`;
  };
  const zapato = (color) => [-1, 1].map((s) => cuero(`M${pt(pie(s) - 10, 384)} C${pt(pie(s) - 12, 396)} ${pt(pie(s) - 10, 404)} ${pt(pie(s) + s * 2, 404)} C${pt(pie(s) + 12 + s * 4, 404)} ${pt(pie(s) + 13, 396)} ${pt(pie(s) + 10, 384)}Z`, color)).join('');
  const descalzo = () => [-1, 1].map((s) => forma(`M${pt(pie(s) - 7, 384)} C${pt(pie(s) - 10, 396)} ${pt(pie(s) - 9, 404)} ${pt(pie(s) + s * 3, 404)} C${pt(pie(s) + 11 + s * 3, 404)} ${pt(pie(s) + 10, 396)} ${pt(pie(s) + 7, 384)}Z`,
    grad(`pd${s}`, pie(s) - 10, pie(s) + 10, piel), { dentro: trazo(`M${pt(pie(s) - 6 + s * 4, 402)} l${s * 3} 0`, sombra, 0.4, 0.8) })).join('');
  const cinturon = (color, alto = 8, hebilla = null) => `${cuero(`M${pt(cx - H - 2, 202)} Q${cx} 207 ${pt(cx + H + 2, 202)} L${pt(cx + H + 2, 202 + alto)} Q${cx} ${207 + alto} ${pt(cx - H - 2, 202 + alto)}Z`, color)}${hebilla ? metal(`M${pt(cx - 5, 203)} h10 v${alto + 2} h-10z`, hebilla) : ''}`;
  const cuerda = (y = 204) => trazo(`M${pt(cx - H - 2, y)} Q${cx} ${y + 5} ${pt(cx + H + 2, y)}`, '#5A4630', 1, 4.2) + trazo(`M${pt(cx - H - 2, y)} Q${cx} ${y + 5} ${pt(cx + H + 2, y)}`, '#B59B6A', 1, 3) + trazo(`M${pt(cx + 6, y + 3)} l-3 14 M${pt(cx + 9, y + 3)} l3 12`, '#9C8458', 1, 2.4);

  // Arma en la mano derecha del personaje (izquierda en pantalla), inclinada hacia fuera.
  const { wx: ax, wy: ay0 } = brazo(-1);
  const ay = ay0 + 10;
  const mango = (x1, y1, x2, y2, w, color) => forma(capsula(x1, y1, w / 2, x2, y2, w / 2), grad(`ar${n}`, Math.min(x1, x2) - w, Math.max(x1, x2) + w, color, { luzF: 0.25, osc: 0.35 }), { borde: mezcla(color, '#100804', 0.6), ancho: 1.1, dentro: `<rect x="-30" y="0" width="360" height="420" filter="url(#${id}ruido)" opacity=".25"/>` });

  const clases = {
    vikingo: () => ({
      atras: mechones(`M${pt(cx - 21, 30)} C${pt(cx - 30, 60)} ${pt(cx - 30, 96)} ${pt(cx - 22, 112)} L${pt(cx + 22, 112)} C${pt(cx + 30, 96)} ${pt(cx + 30, 60)} ${pt(cx + 21, 30)}Z`,
        [-24, -20, -16, 16, 20, 24].map((x) => `M${pt(cx + x * 0.9, 40)} Q${pt(cx + x * 1.15, 76)} ${pt(cx + x * 0.98, 110)}`)),
      arma: `${mango(ax + 6, ay - 8, ax - 36, ay + 52, 4.4, '#8C6A44')}${metal(`M${pt(ax - 26, ay + 36)} C${pt(ax - 34, ay + 24)} ${pt(ax - 44, ay + 22)} ${pt(ax - 50, ay + 28)} C${pt(ax - 52, ay + 40)} ${pt(ax - 48, ay + 52)} ${pt(ax - 40, ay + 58)} L${pt(ax - 34, ay + 48)}Z`, P.metal)}`,
      ropa: `${pantalon(P.tela, { ancho: 4, remiendo: true, vendas: '#8C7A5B' })}${zapato('#6B5238')}${cinturon(P.cuero, 7, '#8B8F95')}`,
      cara: vello(0.22),
      cabeza: mechones(`M${pt(cx - 23, 44)} C${pt(cx - 26, 22)} ${pt(cx - 14, 8)} ${pt(cx + 2, 8)} C${pt(cx + 18, 8)} ${pt(cx + 27, 22)} ${pt(cx + 23, 44)} C${pt(cx + 20, 32)} ${pt(cx + 14, 26)} ${pt(cx + 8, 25)}
        L${pt(cx + 10, 33)} L${pt(cx + 2, 25)} L${pt(cx - 2, 33)} L${pt(cx - 6, 25)} L${pt(cx - 12, 31)} L${pt(cx - 12, 25)} C${pt(cx - 18, 28)} ${pt(cx - 21, 34)} ${pt(cx - 23, 44)}Z`,
        [`M${pt(cx - 16, 14)} Q${pt(cx - 6, 18)} ${pt(cx - 8, 30)}`, `M${pt(cx - 2, 10)} Q${pt(cx + 4, 18)} ${pt(cx + 1, 28)}`, `M${pt(cx + 10, 12)} Q${pt(cx + 18, 20)} ${pt(cx + 16, 32)}`, `M${pt(cx - 20, 22)} Q${pt(cx - 18, 30)} ${pt(cx - 21, 40)}`, `M${pt(cx + 20, 22)} Q${pt(cx + 22, 30)} ${pt(cx + 21, 42)}`, `M${pt(cx + 4, 12)} Q${pt(cx + 10, 18)} ${pt(cx + 8, 26)}`]),
    }),
    pirata: () => ({
      atras: mechones(`M${pt(cx + 14, 34)} C${pt(cx + 24, 46)} ${pt(cx + 26, 66)} ${pt(cx + 20, 84)} L${pt(cx + 16, 82)} C${pt(cx + 18, 66)} ${pt(cx + 16, 50)} ${pt(cx + 10, 40)}Z`, [`M${pt(cx + 17, 46)} Q${pt(cx + 21, 64)} ${pt(cx + 18, 80)}`]),
      arma: `${mango(ax + 6, ay - 8, ax - 30, ay + 46, 6.4, '#9C7A52')}${trazo(`M${pt(ax + 1, ay - 2)} l-4 6`, '#5A3E22', 0.8, 2)}`,
      ropa: `${pantalon('#5B6B7A', { hasta: 360, ancho: 2, remiendo: true })}${descalzo()}${cuerda()}
        ${[-1, 1].map((s) => tela(`M${pt(cx + s * (N + 1), sy - 12)} C${pt(cx + s * (S - 14), sy - 10)} ${pt(cx + s * (S + 2), sy - 2)} ${pt(cx + s * (S + 1), sy + 14)}
          C${pt(cx + s * (C + 4), sy + 50)} ${pt(cx + s * (W + 6), 168)} ${pt(cx + s * (H + 4), 206)} L${pt(cx + s * (H - 12), 208)} C${pt(cx + s * C * 0.5, 170)} ${pt(cx + s * C * 0.42, sy + 34)} ${pt(cx + s * 3, sy + 8)}Z`, P.tela,
          { pliegues: [`M${pt(cx + s * (C - 4), sy + 30)} q${s * 3} 30 ${s * 0} 70 l${s * 3} 0 q${s * 3} -40 ${-s * 1} -70z`, `M${pt(cx + s * (H - 8), 186)} l${s * 8} 18 l${s * 3} -1z`] })).join('')}
        ${tela(`M${pt(cx - 11, sy - 12)} Q${cx} ${sy - 2} ${pt(cx + 11, sy - 12)} L${pt(cx + 4, sy + 10)} L${pt(cx, sy + 4)} L${pt(cx - 4, sy + 10)}Z`, P.acento)}`,
      cara: `${vello(0.3)}${forma(`M${pt(cx + 22.5, 55)} a2.6 2.6 0 1 0 0.1 0`, 'none', { borde: P.metal, ancho: 1.2 })}`,
      cabeza: mechones(`M${pt(cx - 23, 42)} C${pt(cx - 26, 20)} ${pt(cx - 12, 8)} ${pt(cx + 2, 8)} C${pt(cx + 18, 8)} ${pt(cx + 26, 20)} ${pt(cx + 23, 42)} C${pt(cx + 20, 30)} ${pt(cx + 14, 26)} ${pt(cx + 10, 27)}
        L${pt(cx + 8, 33)} L${pt(cx + 3, 26)} L${pt(cx - 3, 32)} L${pt(cx - 6, 26)} L${pt(cx - 13, 30)} C${pt(cx - 18, 32)} ${pt(cx - 21, 36)} ${pt(cx - 23, 42)}Z`,
        [`M${pt(cx - 14, 13)} q8 6 4 16`, `M${pt(cx - 2, 10)} q6 8 2 18`, `M${pt(cx + 12, 13)} q6 8 2 16`, `M${pt(cx - 21, 24)} q2 8 -1 14`, `M${pt(cx + 20, 22)} q3 9 0 16`, `M${pt(cx + 4, 11)} q7 6 4 14`], { claro: 0.15 }),
    }),
    samurai: () => ({
      atras: '',
      arma: mango(ax + 8, ay - 10, ax - 40, ay + 44, 4.6, '#B08A5E'),
      ropa: `${pantalon(P.tela, { hasta: 372, ancho: 6, remiendo: true })}${[-1, 1].map((s) => trazo(`M${pt(pie(s) - 9, 392)} l18 4`, '#8C7440', 1, 2)).join('')}${zapato('#C8A85A')}
        ${tela(`M${pt(cx - H - 3, 198)} Q${cx} 204 ${pt(cx + H + 3, 198)} L${pt(cx + H + 3, 208)} Q${cx} 214 ${pt(cx - H - 3, 208)}Z`, '#E8E2D2')}`,
      cara: '',
      cabeza: `${mechones(`M${pt(cx - 23, 42)} C${pt(cx - 25, 18)} ${pt(cx - 12, 9)} ${pt(cx, 9)} C${pt(cx + 12, 9)} ${pt(cx + 25, 18)} ${pt(cx + 23, 42)} C${pt(cx + 20, 30)} ${pt(cx + 12, 24)} ${pt(cx, 24)} C${pt(cx - 12, 24)} ${pt(cx - 20, 30)} ${pt(cx - 23, 42)}Z`,
        [`M${pt(cx - 18, 18)} q8 -4 16 -2`, `M${pt(cx + 2, 14)} q8 0 14 6`, `M${pt(cx - 20, 30)} q4 -8 12 -10`, `M${pt(cx + 8, 18)} q8 4 12 12`], { claro: 0.3 })}
        ${mechones(`M${pt(cx - 10, 22)} C${pt(cx - 6, 30)} ${pt(cx + 2, 34)} ${pt(cx + 10, 30)} C${pt(cx + 6, 36)} ${pt(cx - 6, 36)} ${pt(cx - 10, 28)}Z`, [`M${pt(cx - 6, 26)} q6 6 12 4`])}
        ${mechones(`M${pt(cx - 4, 10)} C${pt(cx - 6, 2)} ${pt(cx + 6, 2)} ${pt(cx + 4, 10)}Z`, [])}
        ${tela(`M${pt(cx - 23, 30)} Q${cx} 24 ${pt(cx + 23, 30)} L${pt(cx + 23, 35)} Q${cx} 29 ${pt(cx - 23, 35)}Z`, '#F2EEE4')}<circle cx="${cx}" cy="30" r="2.2" fill="#B3261E"/>
        ${tela(`M${pt(cx + 22, 31)} L${pt(cx + 34, 26)} L${pt(cx + 32, 31)} L${pt(cx + 35, 37)} L${pt(cx + 22, 34)}Z`, '#F2EEE4')}`,
    }),
    polinesio: () => ({
      atras: '',
      arma: `${mango(ax + 2, ay - 70, ax - 16, ay + 8, 4.4, '#7A5536')}${forma(`M${pt(ax - 15, ay + 4)} C${pt(ax - 28, ay + 14)} ${pt(ax - 30, ay + 40)} ${pt(ax - 24, ay + 54)} C${pt(ax - 14, ay + 46)} ${pt(ax - 6, ay + 20)} ${pt(ax - 15, ay + 4)}Z`,
        grad(`re${n}`, ax - 30, ax - 6, '#8C6A44', { luzF: 0.25 }), { borde: '#3A2414', ancho: 1.1, dentro: `${trazo(`M${pt(ax - 15, ay + 8)} L${pt(ax - 22, ay + 48)}`, '#3A2414', 0.4, 1)}<rect x="-30" y="0" width="360" height="420" filter="url(#${id}ruido)" opacity=".25"/>` })}`,
      ropa: `${descalzo()}${tela(`M${pt(cx - H - 3, 198)} Q${cx} 204 ${pt(cx + H + 3, 198)} L${pt(cx + H + 2, 208)} Q${cx} 214 ${pt(cx - H - 2, 208)}Z`, P.tela)}
        ${tela(`M${pt(cx - 11, 208)} L${pt(cx + 11, 208)} L${pt(cx + 13, 244)} Q${cx} 248 ${pt(cx - 13, 244)}Z`, P.tela, { pliegues: [`M${pt(cx - 2, 212)} l2 30 l2 0 l-1 -30z`] })}
        ${Array.from({ length: 11 }, (_, i) => { const k = (i - 5) / 5; const x = cx + k * (N + 12), y = sy - 8 + (1 - k * k) * 12; return forma(`M${pt(x - 5, y)} Q${pt(x, y - 4)} ${pt(x + 5, y)} Q${pt(x, y + 4)} ${pt(x - 5, y)}Z`, grad(`lei${i}`, x - 5, x + 5, '#4C8C3A', { luzF: 0.3 }), { borde: '#1F3A14', ancho: 0.8 }); }).join('')}`,
      cara: '',
      cabeza: `${mechones(`M${pt(cx - 23, 42)} C${pt(cx - 25, 18)} ${pt(cx - 12, 9)} ${pt(cx, 9)} C${pt(cx + 12, 9)} ${pt(cx + 25, 18)} ${pt(cx + 23, 42)} C${pt(cx + 20, 28)} ${pt(cx + 12, 22)} ${pt(cx, 23)} C${pt(cx - 12, 22)} ${pt(cx - 20, 28)} ${pt(cx - 23, 42)}Z`,
        [`M${pt(cx - 18, 20)} q6 -6 14 -6`, `M${pt(cx + 4, 13)} q10 2 14 10`, `M${pt(cx - 21, 32)} q3 -10 10 -14`, `M${pt(cx + 20, 32)} q-2 -10 -10 -14`])}
        ${mechones(`M${pt(cx - 8, 10)} C${pt(cx - 10, -2)} ${pt(cx + 10, -2)} ${pt(cx + 8, 10)}Z`, [`M${pt(cx - 4, 2)} q4 -2 8 0`])}${trazo(`M${pt(cx - 7, 8)} L${pt(cx + 7, 8)}`, '#B59B6A', 1, 1.8)}`,
    }),
    romano: () => ({
      atras: '',
      arma: `${mango(ax + 4, ay - 4, ax - 30, ay + 44, 6.6, '#A88458')}${mango(ax - 2, ay - 12, ax + 10, ay + 2, 3.4, '#7A5A3A')}`,
      ropa: `${descalzo()}${[-1, 1].map((s) => trazo(`M${pt(pie(s) - 8, 388)} l16 4 M${pt(pie(s) - 8, 396)} l16 3`, '#6B4423', 0.9, 1.6)).join('')}
        ${tela(`M${pt(cx - H - 3, 200)} L${pt(cx + H + 3, 200)} L${pt(cx + H + 9, 252)} Q${cx} 256 ${pt(cx - H - 9, 252)}Z`, P.tela, { pliegues: [`M${pt(cx - 22, 210)} l-3 40 l3 0z`, `M${pt(cx + 4, 208)} l2 42 l3 0z`, `M${pt(cx + 26, 210)} l5 40 l3 0z`] })}${cuerda(202)}
        ${(() => { const { wx, wy } = brazo(1); const x = wx + 4, y = wy - 10; return forma(`M${pt(x, y - 34)} C${pt(x + 24, y - 34)} ${pt(x + 24, y + 34)} ${pt(x, y + 34)} C${pt(x - 24, y + 34)} ${pt(x - 24, y - 34)} ${pt(x, y - 34)}Z`, grad(`es${n}`, x - 22, x + 22, '#C8A46A', { luzF: 0.25, osc: 0.35 }),
          { borde: '#4A3418', ancho: 1.4, dentro: `${Array.from({ length: 9 }, (_, i) => trazo(`M${pt(x - 24, y - 30 + i * 8)} Q${pt(x, y - 26 + i * 8)} ${pt(x + 24, y - 30 + i * 8)}`, '#6B4E24', 0.45, 1.2)).join('')}${Array.from({ length: 7 }, (_, i) => trazo(`M${pt(x - 18 + i * 6, y - 34)} L${pt(x - 18 + i * 6, y + 34)}`, '#E8D4A0', 0.25, 0.8)).join('')}${trazo(`M${pt(x + 10, y - 30)} Q${pt(x + 24, y)} ${pt(x + 10, y + 30)}`, '#2A1A08', 0.4, 6, 3)}` })
          + forma(`M${pt(x - 6, y - 6)} a6 6 0 1 0 0.1 0`, grad(`um${n}`, x - 6, x + 6, '#8C6A44'), { borde: '#3A2414', ancho: 1 }); })()}`,
      cara: vello(0.18),
      cabeza: mechones(`M${pt(cx - 23, 40)} C${pt(cx - 25, 18)} ${pt(cx - 12, 10)} ${pt(cx, 10)} C${pt(cx + 12, 10)} ${pt(cx + 25, 18)} ${pt(cx + 23, 40)} C${pt(cx + 20, 30)} ${pt(cx + 14, 26)} ${pt(cx + 9, 26)}
        L${pt(cx + 7, 30)} L${pt(cx + 3, 26)} L${pt(cx - 1, 30)} L${pt(cx - 5, 26)} L${pt(cx - 10, 29)} C${pt(cx - 16, 30)} ${pt(cx - 21, 34)} ${pt(cx - 23, 40)}Z`,
        [`M${pt(cx - 16, 16)} q4 6 4 12`, `M${pt(cx - 4, 12)} q3 7 2 14`, `M${pt(cx + 8, 13)} q4 6 2 13`, `M${pt(cx + 18, 18)} q3 8 1 14`], { claro: 0.2 }),
    }),
  };
  const g = clases[clase]();

  const [vx, vy, vw, vh] = FORMATO.viewBox;
  const filtros = [0.5, 0.6, 0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 6].map((s) => `<filter id="${id}b${s}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${s}"/></filter>`).join('');
  const ruido = `<filter id="${id}ruido" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 1.2 -0.45"/></filter>`;
  const cuerpo = contorno.map((d) => `<path d="${d}" fill="${linea}" stroke="${linea}" stroke-width="2.8" stroke-linejoin="round"/>`).join('') + capaPiel.join('');
  const cabeza = `${orejas}${forma(cabezaD, grad('ca', cx - 23, cx + 23, piel, { luzF: 0.14, osc: 0.22 }), { dentro: `${cara}<rect x="-30" y="0" width="360" height="420" filter="url(#${id}ruido)" opacity=".12"/>` })}
    ${ojo(-1, 1.6)}${ojo(1, 1.6)}${cejas}${g.cara}${g.cabeza}`;
  return `<svg viewBox="${vx} ${vy} ${vw} ${vh}" width="${ancho}" height="${Math.round((ancho * vh) / vw)}" xmlns="http://www.w3.org/2000/svg" data-clase="${clase}" data-rango="${rango}">
    <defs>${filtros}${ruido}${defs.join('')}</defs>
    ${g.atras}${cuerpo}${g.ropa}${g.arma}${ladoMano(-1)}
    <g transform="translate(0 ${hy})">${cabeza}</g>
  </svg>`;

  // La mano que sujeta el arma se vuelve a dibujar encima del mango.
  function ladoMano(s) {
    const { wx, wy } = brazo(s);
    const mano = `M${pt(wx - 7.5, wy - 3)} C${pt(wx - 10, wy + 7)} ${pt(wx - 9, wy + 19)} ${pt(wx - 4, wy + 24)} C${pt(wx + 1, wy + 27)} ${pt(wx + 7.5, wy + 25)} ${pt(wx + 8.5, wy + 16)} C${pt(wx + 9.5, wy + 7)} ${pt(wx + 8.5, wy)} ${pt(wx + 7.5, wy - 3)}Z`;
    return forma(mano, grad(`mx${s}`, wx - 8, wx + 8, piel), { dentro: trazo(`M${pt(wx - 6, wy + 8)} q6 3 12 0 M${pt(wx - 6, wy + 13)} q6 3 12 0`, linea, 0.4, 0.9) });
  }
}
