// La imagen para compartir (etapa 30, diseño «Póster»): arriba el paisaje del héroe con su figura de pie sobre el agua
// y el dato grande sobre el horizonte; abajo qué fue, qué tan duro, por qué importa y pocos datos más.
// contenido = contenidoTarjeta() de tarjeta.js. Se carga solo al abrir «Compartir imagen» (no pesa en el arranque).
import { FORMATOS } from './tarjeta.js';

// Colores de la app (estilos.css). Todo el texto pasa de 4,5:1 sobre el fondo.
const T = { fondo: '#0B1217', linea: '#22313B', texto: '#EDF1F2', suave: '#C2CDD2', tenue: '#8D9FA8', lat: '#E9A23B', ok: '#22C55E', okT: '#86EFAC', xp: '#5EEAD4', vacio: '#33464F', barra: '#2C3E49' };
const NUM = (p) => (t) => `${p} ${t}px "Barlow Condensed", system-ui, sans-serif`;
const TXT = (p) => (t) => `${p} ${t}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
// Retícula por formato: alto de la banda del paisaje, márgenes, tamaño del dato grande y del héroe (pies en «pie»).
const L = {
  '4:5': { B: 640, top: 56, pie: 1294, num: 230, hH: 500, pieH: 556, graf: 150 },
  '9:16': { B: 880, top: 228, pie: 1690, num: 250, hH: 520, pieH: 766, graf: 160 },
  '1:1': { B: 580, top: 52, pie: 1032, num: 210, hH: 440, pieH: 500, graf: 0 },
};
const M = 72;

const cargarImagen = (src) => new Promise((ok) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => ok(null);
  img.src = src;
});

// Escribe una línea que quepa: baja la letra hasta «minimo» y, si aún no cabe, recorta con «…». Devuelve el ancho.
function cabe(ctx, texto, x, y, ancho, fuente, tamano, minimo) {
  let t = tamano;
  ctx.font = fuente(t);
  while (t > minimo && ctx.measureText(texto).width > ancho) { t -= 2; ctx.font = fuente(t); }
  let corto = texto;
  while (corto.length > 1 && ctx.measureText(corto).width > ancho) corto = corto.slice(0, -2) + '…';
  ctx.fillText(corto, x, y);
  return ctx.measureText(corto).width;
}
// Hasta 2 líneas; si el texto tiene « · », corta ahí antes que a media frase.
function partir(ctx, t, max) {
  if (ctx.measureText(t).width <= max) return [t];
  const k = t.lastIndexOf(' · ');
  if (k > 0) { const a = t.slice(0, k); const b = t.slice(k + 3); if (ctx.measureText(a).width <= max && ctx.measureText(b).width <= max) return [a, b]; }
  const out = [];
  let l = '';
  for (const w of t.split(' ')) { const n = l ? `${l} ${w}` : w; if (ctx.measureText(n).width > max && l) { out.push(l); l = w; } else l = n; }
  out.push(l);
  return out.length > 2 ? [out[0], `${out.slice(1).join(' ').slice(0, 60)}…`] : out;
}
function pastilla(ctx, x, y, h, txt, font, fondo, color, pad) {
  ctx.font = font;
  const w = ctx.measureText(txt).width + 2 * pad;
  ctx.fillStyle = fondo;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, x + pad, y + h / 2 + 2);
  ctx.textBaseline = 'alphabetic';
  return w;
}
const degradado = (ctx, y0, y1, paradas) => { const g = ctx.createLinearGradient(0, y0, 0, y1); for (const [o, c] of paradas) g.addColorStop(o, c); return g; };
const linea = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };

// Medidor de intensidad: 5 barras que crecen, en latón las que tocan, y la palabra.
function medidor(ctx, x, yc, { nivel, palabra }) {
  const h = 48;
  ctx.font = TXT(700)(28);
  const w = 18 + 60 + 14 + ctx.measureText(palabra).width + 20;
  ctx.fillStyle = 'rgba(237,241,242,0.08)';
  ctx.strokeStyle = 'rgba(237,241,242,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, yc - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const bh = 8 + i * 5;
    ctx.fillStyle = i < nivel ? T.lat : T.vacio;
    ctx.beginPath();
    ctx.roundRect(x + 18 + i * 12, yc + 13 - bh, 8, bh, 2);
    ctx.fill();
  }
  ctx.fillStyle = T.texto;
  ctx.textBaseline = 'middle';
  ctx.fillText(palabra, x + 92, yc + 2);
  ctx.textBaseline = 'alphabetic';
}

function pintarPaisaje(ctx, img, W, B, p) {
  const hz = p.horizonte || img.height * 0.6;
  const s = Math.max((B * 0.74) / hz, W / img.width);
  const dy = B * 0.74 - hz * s;
  const x0 = Math.min(img.width * (p.desde ?? 0.06), img.width - W / s);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, B);
  ctx.clip();
  // Los paisajes pintados a mano (horizonte bajo) se suavizan un poco para que el texto mande.
  const filtro = [hz < 300 ? 'blur(1.5px) saturate(1.1)' : '', p.filtro || ''].join(' ').trim();
  if (filtro) ctx.filter = filtro;
  ctx.drawImage(img, x0, 0, W / s, img.height, 0, dy, W, img.height * s);
  if (dy > 0) ctx.drawImage(img, x0, 0, W / s, 1, 0, 0, W, dy + 1);
  ctx.restore();
}

function secundarios(ctx, x, y, w, items, gN) {
  const a = w / items.length;
  ctx.strokeStyle = T.linea;
  ctx.lineWidth = 2;
  items.forEach(([v, u, e], i) => {
    const px = x + i * a + (i ? 28 : 0);
    if (i) linea(ctx, x + i * a, y - gN * 0.85, x + i * a, y + 34);
    ctx.fillStyle = T.texto;
    const vw = cabe(ctx, v, px, y, a - 40, NUM(700), gN, gN * 0.6);
    if (u) { ctx.fillStyle = T.suave; ctx.font = NUM(600)(gN * 0.5); ctx.fillText(u, px + vw + 8, y); }
    ctx.fillStyle = T.suave;
    cabe(ctx, e, px, y + 34, a - 36, TXT(600), 24, 18);
  });
}

function grafica(ctx, x, y, w, h, pts, o) {
  const tMax = Math.max(o.tMax || 0, pts.at(-1)[0]) || 1;
  const ws = pts.map((p) => p[1]);
  const vMax = Math.max(...ws, o.rango?.max || 0) * 1.08 || 1;
  const vMin = Math.min(...ws, o.rango?.min ?? Infinity) * 0.75;
  const X = (t) => x + (t / tMax) * w;
  const Y = (v) => y + h - ((v - vMin) / (vMax - vMin || 1)) * h;
  if (o.rango) {
    ctx.fillStyle = 'rgba(34,197,94,0.30)';
    for (const [a, b] of o.rango.tramos) ctx.fillRect(X(a), Y(o.rango.max), X(Math.min(b, tMax)) - X(a), Y(o.rango.min) - Y(o.rango.max));
  }
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (const p of pts) ctx.lineTo(X(p[0]), Y(p[1]));
  ctx.lineTo(X(pts.at(-1)[0]), y + h);
  ctx.closePath();
  ctx.fillStyle = degradado(ctx, y, y + h, [[0, 'rgba(233,162,59,0.38)'], [1, 'rgba(233,162,59,0.02)']]);
  ctx.fill();
  ctx.strokeStyle = T.lat;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
  ctx.stroke();
  if (o.resto) {
    const [t, v] = pts.at(-1);
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = T.tenue;
    ctx.lineWidth = 3;
    linea(ctx, X(t), Y(v), x + w, Y(v));
    ctx.setLineDash([]);
    ctx.fillStyle = T.tenue;
    ctx.font = TXT(600)(22);
    ctx.textAlign = 'right';
    ctx.fillText(o.resto, x + w, Y(v) - 14);
    ctx.textAlign = 'left';
  }
  ctx.strokeStyle = T.linea;
  ctx.lineWidth = 2;
  linea(ctx, x, y + h + 1, x + w, y + h + 1);
}

// Una muestra cada 10 s promediada: la línea se lee y no tiembla.
function suavizar(puntos) {
  const out = [];
  for (let i = 0; i < puntos.length; i += 10) {
    const tramo = puntos.slice(i, i + 10);
    out.push([tramo[0][0], tramo.reduce((a, p) => a + p[1], 0) / tramo.length]);
  }
  return out;
}

// opciones = { formato: '9:16' | '4:5' | '1:1', fecha (texto), puntos: [[t, w]] }. Devuelve un PNG (Blob).
export async function tarjetaSesion(contenido, { formato = '4:5', fecha = '', puntos = [] } = {}) {
  const C = contenido;
  const fmt = FORMATOS[formato] ? formato : '4:5';
  const [W, H] = FORMATOS[fmt];
  const D = L[fmt];
  const cuadrado = fmt === '1:1';
  const P = C.protagonista;
  try { await Promise.all([document.fonts?.load('700 100px "Barlow Condensed"'), document.fonts?.load('600 40px "Barlow Condensed"')]); } catch { /* sin la letra, system-ui */ }
  const [marca, fondo, figura] = await Promise.all([
    cargarImagen('assets/marca/rower-marca.svg'),
    C.paisaje?.src ? cargarImagen(C.paisaje.src) : null,
    C.heroe?.src ? cargarImagen(C.heroe.src) : null,
  ]);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = T.fondo;
  ctx.fillRect(0, 0, W, H);

  // Paisaje arriba, oscurecido por arriba (marca) y fundido con el fondo por abajo.
  if (fondo) pintarPaisaje(ctx, fondo, W, D.B, C.paisaje);
  ctx.fillStyle = degradado(ctx, 0, D.top + 190, [[0, 'rgba(11,18,23,0.8)'], [1, 'rgba(11,18,23,0)']]);
  ctx.fillRect(0, 0, W, D.top + 190);
  ctx.fillStyle = degradado(ctx, D.B * 0.42, D.B, [[0, 'rgba(11,18,23,0)'], [0.6, 'rgba(11,18,23,0.7)'], [1, T.fondo]]);
  ctx.fillRect(0, D.B * 0.42, W, D.B * 0.58 + 1);
  if (marca) ctx.drawImage(marca, M, D.top, (marca.width / marca.height) * 46, 46);
  ctx.fillStyle = T.texto;
  ctx.font = TXT(600)(24);
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 10;
  if (fecha) ctx.fillText(fecha, M, D.top + 86);
  ctx.shadowBlur = 0;

  // El héroe a la derecha, de pie sobre el agua, con su XP al hombro y su nombre a los pies.
  const pie = D.pieH;
  let limite = W - M; // hasta dónde puede llegar el dato grande
  if (figura) {
    const h = D.hH;
    const w = (360 / 420) * h;
    const xH = W - w + 0.1 * w - M * 0.2;
    const cx = xH + w / 2;
    ctx.save();
    ctx.translate(cx, pie - 8);
    ctx.scale(1, 0.16);
    const sombra = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.3);
    sombra.addColorStop(0, 'rgba(0,0,0,0.65)');
    sombra.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sombra;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.3, 0, 7);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(figura, xH, pie - h * 0.976, w, h);
    if (C.heroe.xp > 0) {
      const t = `+${C.heroe.xp.toLocaleString('es-MX')} XP`;
      ctx.font = NUM(700)(34);
      pastilla(ctx, cx - w * 0.24 - (ctx.measureText(t).width + 32) + 20, pie - h * 0.62, 48, t, NUM(700)(34), T.xp, T.fondo, 16);
    }
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = T.texto;
    if (C.heroe.nombre) cabe(ctx, C.heroe.nombre, cx, pie + 34, w * 0.9, TXT(700), 26, 18);
    ctx.fillStyle = T.suave;
    if (C.heroe.linea) cabe(ctx, C.heroe.linea, cx, pie + 60, Math.min(w * 1.1, W - cx - 8) * 2 - 16, TXT(600), 20, 16);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    limite = xH + w * 0.2 - 20;
  }

  // El dato grande sobre el horizonte: latón si es un logro, blanco si quedó a medias.
  let y = pie;
  const color = P.blanco ? T.texto : T.lat;
  if (P.kicker) pastilla(ctx, M, y - D.num * 0.78 - 62, 42, P.kicker, TXT(800)(20), T.lat, T.fondo, 18);
  const hueco = (P.antes ? 220 : 0) + (P.unidad ? D.num * 0.5 : 0) + (P.de ? D.num * 0.9 : 0);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  let vw = M - 6 + cabe(ctx, P.valor, M - 6, y, Math.max(240, limite - M - hueco), NUM(700), D.num, D.num * 0.6);
  ctx.shadowBlur = 0;
  const tam = parseInt(ctx.font.match(/(\d+)px/)[1], 10);
  if (P.unidad) { ctx.fillStyle = color; ctx.font = NUM(700)(tam * 0.42); ctx.fillText(P.unidad, vw + 10, y); vw += 10 + ctx.measureText(P.unidad).width; }
  if (P.antes) {
    const xa = vw + 28;
    const ya = y - tam * 0.42;
    ctx.fillStyle = T.suave;
    ctx.font = NUM(600)(68);
    ctx.fillText(P.antes, xa, ya);
    const aw = ctx.measureText(P.antes).width;
    ctx.strokeStyle = T.suave;
    ctx.lineWidth = 5;
    linea(ctx, xa - 6, ya - 22, xa + aw + 6, ya - 22);
    if (P.delta) pastilla(ctx, xa, y - 60, 60, P.delta, NUM(700)(44), T.ok, T.fondo, 18);
  }
  if (P.de) { ctx.fillStyle = T.suave; ctx.font = NUM(600)(tam * 0.3); ctx.fillText(P.de, vw + 20, y); }
  if (P.etq) { y += 44; ctx.fillStyle = T.texto; cabe(ctx, P.etq, M, y, W - 2 * M, TXT(600), 30, 22); }
  if (P.parcial != null) {
    y += 34;
    const bw = Math.min(limite - M, 560);
    ctx.fillStyle = T.vacio;
    ctx.beginPath();
    ctx.roundRect(M, y, bw, 12, 6);
    ctx.fill();
    ctx.fillStyle = T.suave;
    ctx.beginPath();
    ctx.roundRect(M, y, Math.max(12, bw * P.parcial), 12, 6);
    ctx.fill();
    y += 12;
  }

  // Qué fue, qué tan duro y si se cumplió.
  y += cuadrado ? 96 : P.etq ? 92 : 100;
  ctx.fillStyle = T.texto;
  const tw = cabe(ctx, C.titulo, M, y, C.intensidad ? 600 : W - 2 * M, NUM(700), cuadrado ? 60 : 64, 40);
  if (C.intensidad) medidor(ctx, M + tw + 24, y - 22, C.intensidad);
  const estado = [C.estado?.texto, C.semanaPlan].filter(Boolean).join(' · ');
  if (estado) { y += 52; ctx.fillStyle = C.estado?.completo ? T.lat : T.suave; cabe(ctx, estado, M, y, W - 2 * M, TXT(600), 30, 22); }

  // Por qué importa: barra de latón y hasta 2 líneas.
  if (C.contexto) {
    y += cuadrado ? 62 : 72;
    ctx.font = TXT(600)(30);
    const lineas = partir(ctx, C.contexto, W - 2 * M - 30);
    ctx.fillStyle = T.lat;
    ctx.fillRect(M, y - 30, 6, lineas.length * 42 - 4);
    ctx.fillStyle = T.texto;
    lineas.forEach((l, i) => ctx.fillText(l, M + 28, y + i * 42));
    y += (lineas.length - 1) * 42;
  }

  if (C.parciales && !cuadrado) {
    // Prueba: split y watts apilados a la izquierda, parciales en barras a la derecha (la más rápida en latón).
    y += 92;
    const x0 = M + 430;
    const n = C.parciales.length;
    const wC = (W - M - x0) / n;
    const base = y + 262;
    ctx.fillStyle = T.suave;
    ctx.font = TXT(600)(24);
    ctx.fillText('Parciales /500 m', x0, y);
    const ts = C.parciales.map((p) => p.seg);
    const mn = Math.min(...ts);
    const mx = Math.max(...ts);
    C.parciales.forEach((p, i) => {
      const bh = 90 + ((mx - p.seg) / (mx - mn || 1)) * 90;
      const bx = x0 + i * wC + 6;
      const bw = wC - (n > 5 ? 10 : 24);
      const mejor = p.seg === mn;
      ctx.fillStyle = mejor ? T.lat : T.barra;
      ctx.beginPath();
      ctx.roundRect(bx, base - bh, bw, bh, [10, 10, 0, 0]);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = mejor ? T.lat : T.texto;
      cabe(ctx, p.texto, bx + bw / 2, base - bh - 12, wC - 4, NUM(700), 40, 24);
      ctx.fillStyle = T.tenue;
      cabe(ctx, p.metros, bx + bw / 2, base + 26, wC - 4, TXT(600), 18, 14);
      ctx.textAlign = 'left';
    });
    ctx.strokeStyle = T.linea;
    ctx.lineWidth = 2;
    linea(ctx, x0 - 30, y - 30, x0 - 30, base + 30);
    const paso = C.secundarios.length > 2 ? 100 : 144;
    C.secundarios.forEach(([v, u, e], i) => {
      const yy = y + 44 + i * paso;
      ctx.fillStyle = T.texto;
      ctx.font = NUM(700)(paso < 144 ? 60 : 72);
      ctx.fillText(v, M, yy + 30);
      const ancho = ctx.measureText(v).width;
      ctx.fillStyle = T.suave;
      ctx.font = NUM(600)(paso < 144 ? 30 : 36);
      ctx.fillText(u, M + ancho + 10, yy + 30);
      ctx.font = TXT(600)(paso < 144 ? 22 : 24);
      ctx.fillText(e, M, yy + 64);
    });
  } else {
    const g = !cuadrado && C.grafica && puntos.length > 30 ? C.grafica : null;
    if (g) {
      y += fmt === '9:16' ? 64 : 58;
      ctx.fillStyle = T.suave;
      ctx.font = TXT(600)(24);
      ctx.fillText('Potencia', M, y);
      if (g.rango) { ctx.fillStyle = T.okT; ctx.textAlign = 'right'; ctx.fillText('■ en su rango', W - M, y); ctx.textAlign = 'left'; }
      y += 20;
      grafica(ctx, M, y, W - 2 * M, D.graf, suavizar(puntos), g);
      y += D.graf;
    }
    y += cuadrado ? 130 : g ? 100 : 110;
    if (!g) { ctx.strokeStyle = T.linea; ctx.lineWidth = 2; linea(ctx, M, y - 84, W - M, y - 84); }
    // En el cuadrado no cabe tanto abajo: los datos se ajustan al pie.
    if (cuadrado) y = Math.min(y, D.pie - 110);
    secundarios(ctx, M, y, W - 2 * M, C.secundarios, cuadrado ? 76 : C.secundarios.length > 3 ? 52 : 60);
    y += 34;
  }

  // Podio de la carrera (solo en el formato alto: en los otros no cabe).
  if (C.podio && fmt === '9:16') {
    y += 50;
    ctx.fillStyle = T.suave;
    cabe(ctx, C.podio.texto, M, y, W - 2 * M, TXT(600), 24, 18);
    y += 18;
    const cw = (W - 2 * M) / 3;
    C.podio.filas.forEach(([pos, nombre, detalle, yo], i) => {
      const x = M + i * cw + (i ? 8 : 0);
      ctx.fillStyle = yo ? 'rgba(233,162,59,0.16)' : 'rgba(237,241,242,0.05)';
      ctx.beginPath();
      ctx.roundRect(x, y, cw - 8, 104, 14);
      ctx.fill();
      const px = x + 20;
      ctx.fillStyle = yo ? T.lat : T.suave;
      ctx.font = NUM(700)(52);
      ctx.fillText(`${pos}.º`, px, y + 62);
      const pw = ctx.measureText(`${pos}.º`).width;
      ctx.fillStyle = yo ? T.texto : T.suave;
      cabe(ctx, nombre, px + pw + 14, y + 48, cw - pw - 62, TXT(yo ? 700 : 600), 26, 18);
      ctx.fillStyle = yo ? T.lat : T.suave;
      cabe(ctx, yo ? 'su puesto' : detalle, px + pw + 14, y + 82, cw - pw - 62, TXT(600), 20, 16);
    });
  }

  // Pie.
  ctx.strokeStyle = T.linea;
  ctx.lineWidth = 2;
  linea(ctx, M, D.pie - 40, W - M, D.pie - 40);
  ctx.fillStyle = T.tenue;
  ctx.font = TXT(500)(22);
  ctx.fillText('Remado en Rower', M, D.pie);
  ctx.textAlign = 'right';
  ctx.fillText('NordicTrack RW200', W - M, D.pie);
  ctx.textAlign = 'left';
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}
