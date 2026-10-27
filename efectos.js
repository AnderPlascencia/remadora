// Efectos visuales: confeti de celebración y tarjeta de la sesión para compartir como imagen.
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

// Tarjeta 1080×1350 con el resumen de la sesión. datos = { titulo, fecha, stats: [[etq, valor]], extra, puntos: [[t, w]] }
export async function tarjetaSesion(datos) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const fondo = ctx.createLinearGradient(0, 0, W, H);
  fondo.addColorStop(0, '#232C17');
  fondo.addColorStop(1, '#070906');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, H);
  // Franja diagonal en verde táctico y ámbar, los colores de Rower
  const fuego = ctx.createLinearGradient(0, 0, W, 0);
  fuego.addColorStop(0, '#8FAE4A');
  fuego.addColorStop(0.5, '#F2A33A');
  fuego.addColorStop(1, '#D9822B');
  ctx.fillStyle = fuego;
  ctx.globalAlpha = 0.14;
  ctx.beginPath(); ctx.moveTo(0, 1010); ctx.lineTo(W, 760); ctx.lineTo(W, 860); ctx.lineTo(0, 1110); ctx.fill();
  ctx.globalAlpha = 1;

  const logo = await cargarImagen('rower-logo.svg');
  const marca = await cargarImagen('rower-marca.svg');
  if (logo) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(72, 72, 120, 120, 26); ctx.clip();
    ctx.drawImage(logo, 72, 72, 120, 120);
    ctx.restore();
  }
  if (marca) ctx.drawImage(marca, 220, 92, (marca.width / marca.height) * 58, 58);
  ctx.fillStyle = '#9AA38C';
  ctx.font = '500 30px Inter, system-ui, sans-serif';
  ctx.fillText(datos.fecha, 222, 190);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 58px Inter, system-ui, sans-serif';
  ctx.fillText(datos.titulo, 72, 310, W - 144);
  ctx.fillStyle = fuego;
  ctx.fillRect(72, 336, 160, 10);

  // Cuadrícula de datos: 2 columnas
  datos.stats.slice(0, 6).forEach(([etq, valor], i) => {
    const x = 72 + (i % 2) * 480;
    const y = 400 + Math.floor(i / 2) * 170;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(x, y, 456, 146, 24); ctx.fill();
    ctx.fillStyle = '#9AA38C';
    ctx.font = '600 28px Inter, system-ui, sans-serif';
    ctx.fillText(etq, x + 30, y + 48);
    ctx.fillStyle = i === 0 ? '#F7C873' : '#F8FAFC';
    ctx.font = '900 64px Inter, system-ui, sans-serif';
    ctx.fillText(String(valor), x + 30, y + 118, 400);
  });

  // Potencia de la sesión
  const pts = datos.puntos || [];
  if (pts.length > 5) {
    const x0 = 72;
    const y0 = 940;
    const w = W - 144;
    const h = 220;
    const tMax = pts.at(-1)[0] || 1;
    const vMax = Math.max(...pts.map((p) => p[1])) * 1.1 || 1;
    const paso = Math.max(1, Math.floor(pts.length / 300));
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    for (let i = 0; i < pts.length; i += paso) ctx.lineTo(x0 + (pts[i][0] / tMax) * w, y0 + h - (pts[i][1] / vMax) * h);
    ctx.lineTo(x0 + w, y0 + h);
    ctx.closePath();
    const area = ctx.createLinearGradient(0, y0, 0, y0 + h);
    area.addColorStop(0, 'rgba(249,115,22,0.55)');
    area.addColorStop(1, 'rgba(249,115,22,0.02)');
    ctx.fillStyle = area;
    ctx.fill();
    ctx.strokeStyle = '#F2A33A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += paso) {
      const x = x0 + (pts[i][0] / tMax) * w;
      const y = y0 + h - (pts[i][1] / vMax) * h;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#9AA38C';
    ctx.font = '600 26px Inter, system-ui, sans-serif';
    ctx.fillText('Potencia (W)', x0, y0 - 16);
  }

  if (datos.extra) {
    ctx.fillStyle = '#FDBA74';
    ctx.font = '700 34px Inter, system-ui, sans-serif';
    ctx.fillText(datos.extra, 72, 1250, W - 144);
  }
  ctx.fillStyle = '#64748B';
  ctx.font = '500 24px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('NordicTrack RW200', W - 72, 1300);
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}
