// Efectos visuales: confeti de celebración y tarjeta de la sesión para compartir como imagen.
import { FORMATOS as MEDIDAS } from './tarjeta.js';
const sinMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORES = ['#F2A33A', '#F7C873', '#8FAE4A', '#38BDF8', '#F8FAFC', '#FACC15', '#EF4444'];

// Lluvia de confeti sobre toda la pantalla, sin bloquear toques.
export function confeti(duracion = 2600) {
  if (sinMovimiento) return;
  const lienzo = document.createElement('canvas');
  lienzo.className = 'confeti';
  lienzo.setAttribute('aria-hidden', 'true');
  document.body.append(lienzo);
  const dpr = window.devicePixelRatio || 1;
  const ancho = innerWidth;
  const alto = innerHeight;
  lienzo.width = ancho * dpr;
  lienzo.height = alto * dpr;
  const ctx = lienzo.getContext('2d');
  ctx.scale(dpr, dpr);
  const piezas = Array.from({ length: 140 }, () => ({
    x: ancho / 2 + (Math.random() - 0.5) * ancho * 0.3,
    y: alto * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -6 - Math.random() * 12,
    giro: Math.random() * Math.PI,
    vg: (Math.random() - 0.5) * 0.4,
    t: 5 + Math.random() * 6,
    color: COLORES[Math.floor(Math.random() * COLORES.length)],
  }));
  const inicio = performance.now();
  const cuadro = (ahora) => {
    const pasado = ahora - inicio;
    ctx.clearRect(0, 0, ancho, alto);
    ctx.globalAlpha = Math.max(0, Math.min(1, (duracion - pasado) / 600));
    for (const p of piezas) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.giro += p.vg;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.t / 2, -p.t / 4, p.t, p.t / 2);
      ctx.restore();
    }
    if (pasado < duracion) requestAnimationFrame(cuadro);
    else lienzo.remove();
  };
  requestAnimationFrame(cuadro);
}

const cargarImagen = (src) => new Promise((ok) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => ok(null);
  img.src = src;
});

// Escribe una línea que quepa en «ancho»: primero baja el tamaño de letra (hasta «minimo») y si aún no cabe,
// recorta con «…». Así un nombre largo no sale aplastado.
function textoQueCabe(ctx, texto, x, y, ancho, fuente, tamano, minimo) {
  let t = tamano;
  ctx.font = fuente(t);
  while (t > minimo && ctx.measureText(texto).width > ancho) { t -= 2; ctx.font = fuente(t); }
  let corto = texto;
  while (corto.length > 1 && ctx.measureText(corto).width > ancho) corto = corto.slice(0, -2) + '…';
  ctx.fillText(corto, x, y);
}

// Colores de la app (estilos.css). Todo el texto pasa de 4,5:1 sobre el fondo.
const T = { fondo: '#0B1217', panel: '#121D24', texto: '#EDF1F2', suave: '#C2CDD2', primario: '#E9A23B' };
const NUM = (peso) => (t) => `${peso} ${t}px "Barlow Condensed", system-ui, sans-serif`;
const TXT = (peso) => (t) => `${peso} ${t}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

// Tarjeta con el resumen de la sesión. contenido = contenidoTarjeta() de tarjeta.js.
// opciones = { formato: '9:16' | '4:5' | '1:1', fecha (texto), puntos: [[t, w]] }. Devuelve un PNG (Blob).
export async function tarjetaSesion(contenido, { formato = '4:5', fecha = '', puntos = [] } = {}) {
  const [W, H] = MEDIDAS[formato] || MEDIDAS['4:5'];
  const cuadrada = formato === '1:1';
  // En historias, el texto queda lejos de los bordes de arriba y abajo, donde la app pone su barra y su respuesta.
  const arriba = formato === '9:16' ? 250 : 72;
  const abajo = H - (formato === '9:16' ? 250 : 64);
  const M = 72;
  try { await Promise.all([document.fonts?.load('700 100px "Barlow Condensed"'), document.fonts?.load('600 40px "Barlow Condensed"')]); } catch { /* sin la letra, system-ui */ }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = T.fondo;
  ctx.fillRect(0, 0, W, H);
  const luz = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W);
  luz.addColorStop(0, 'rgba(233,162,59,0.16)');
  luz.addColorStop(1, 'rgba(233,162,59,0)');
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // Cabecera: la marca y la fecha.
  let y = arriba;
  const marca = await cargarImagen('assets/marca/rower-marca.svg');
  if (marca) ctx.drawImage(marca, M, y, (marca.width / marca.height) * 52, 52);
  else { ctx.fillStyle = T.texto; ctx.font = NUM(700)(56); ctx.fillText('ROWER', M, y + 48); }
  ctx.fillStyle = T.suave;
  ctx.font = TXT(500)(28);
  ctx.textAlign = 'right';
  ctx.fillText(fecha, W - M, y + 40, W - 2 * M - 260);
  ctx.textAlign = 'left';
  y += cuadrada ? 150 : 180;

  // Título y cómo fue.
  ctx.fillStyle = T.texto;
  textoQueCabe(ctx, contenido.titulo, M, y, W - 2 * M, NUM(700), 84, 52);
  y += 58;
  const linea = [contenido.estado?.texto, contenido.semanaPlan].filter(Boolean).join(' · ');
  if (linea) {
    ctx.fillStyle = contenido.estado?.completo ? T.primario : T.suave;
    textoQueCabe(ctx, linea, M, y, W - 2 * M, TXT(600), 32, 24);
    y += cuadrada ? 60 : 90;
  } else y += 30;

  // El dato protagonista.
  ctx.fillStyle = T.suave;
  textoQueCabe(ctx, contenido.protagonista.etq, M, y, W - 2 * M, TXT(600), 32, 24);
  const grande = cuadrada ? 170 : 220;
  y += grande * 0.82;
  ctx.fillStyle = T.primario;
  textoQueCabe(ctx, contenido.protagonista.valor, M, y, W - 2 * M, NUM(700), grande, 96);
  y += cuadrada ? 40 : 60;

  // Los demás datos, en cuadrícula.
  const cols = cuadrada ? 3 : 2;
  const gap = 20;
  const celda = (W - 2 * M - gap * (cols - 1)) / cols;
  const alto = cuadrada ? 132 : 150;
  contenido.secundarios.forEach(([etq, valor], i) => {
    const x = M + (i % cols) * (celda + gap);
    const yy = y + Math.floor(i / cols) * (alto + gap);
    ctx.fillStyle = T.panel;
    ctx.beginPath(); ctx.roundRect(x, yy, celda, alto, 22); ctx.fill();
    ctx.fillStyle = T.suave;
    textoQueCabe(ctx, etq, x + 26, yy + 44, celda - 52, TXT(600), 26, 20);
    ctx.fillStyle = T.texto;
    textoQueCabe(ctx, String(valor), x + 26, yy + alto - 30, celda - 52, NUM(700), cuadrada ? 60 : 70, 40);
  });
  y += Math.ceil(contenido.secundarios.length / cols) * (alto + gap) + 20;

  // Pie: lo extra (récord o rivales), el héroe y la marca de la máquina.
  const pie = [contenido.extra, contenido.heroe].filter(Boolean);
  const yPie = abajo - 44 - pie.length * 52;

  // La potencia de la sesión, si queda sitio (en 1:1 no: mejor pocos datos y grandes).
  const hGraf = Math.min(formato === '9:16' ? 340 : 240, yPie - y - 60);
  if (!cuadrada && puntos.length > 5 && hGraf >= 140) {
    const x0 = M;
    const y0 = y + 44;
    const w = W - 2 * M;
    const h = hGraf - 20;
    const tMax = puntos.at(-1)[0] || 1;
    const vMax = Math.max(...puntos.map((p) => p[1])) * 1.1 || 1;
    const paso = Math.max(1, Math.floor(puntos.length / 300));
    const px = (p) => [x0 + (p[0] / tMax) * w, y0 + h - (p[1] / vMax) * h];
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    for (let i = 0; i < puntos.length; i += paso) ctx.lineTo(...px(puntos[i]));
    ctx.lineTo(x0 + w, y0 + h);
    ctx.closePath();
    const area = ctx.createLinearGradient(0, y0, 0, y0 + h);
    area.addColorStop(0, 'rgba(233,162,59,0.45)');
    area.addColorStop(1, 'rgba(233,162,59,0.02)');
    ctx.fillStyle = area;
    ctx.fill();
    ctx.strokeStyle = T.primario;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < puntos.length; i += paso) { const [x, yy] = px(puntos[i]); if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); }
    ctx.stroke();
    ctx.fillStyle = T.suave;
    ctx.font = TXT(600)(26);
    ctx.fillText('Potencia (W)', x0, y0 - 14);
  }

  let yp = yPie + 40;
  for (const [i, t] of pie.entries()) {
    ctx.fillStyle = i === 0 && contenido.extra ? T.texto : T.suave;
    textoQueCabe(ctx, t, M, yp, W - 2 * M, TXT(700), 32, 22);
    yp += 52;
  }
  ctx.fillStyle = T.suave;
  ctx.font = TXT(500)(24);
  ctx.fillText('Remado en Rower', M, abajo);
  ctx.textAlign = 'right';
  ctx.fillText('NordicTrack RW200', W - M, abajo);
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}
