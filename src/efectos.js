// Efectos visuales: confeti de celebración. La tarjeta para compartir está en tarjeta-imagen.js (se carga al abrirla).
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
