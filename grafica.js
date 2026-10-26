// Gráfica de líneas en canvas, sin dependencias. Hasta dos ejes: izquierdo y derecho.
// series: [{ nombre, color, eje: 'izq'|'der', puntos: [[t, v], ...] }]

export function dibujar(canvas, series, opciones = {}) {
  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (canvas.width !== ancho * dpr || canvas.height !== alto * dpr) {
    canvas.width = ancho * dpr;
    canvas.height = alto * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);

  const estilo = getComputedStyle(document.documentElement);
  const colorTexto = estilo.getPropertyValue('--texto-suave').trim() || '#888';
  const colorRejilla = estilo.getPropertyValue('--rejilla').trim() || '#333';

  const m = { izq: 40, der: 40, arr: 10, aba: 22 };
  const w = ancho - m.izq - m.der;
  const h = alto - m.arr - m.aba;

  let tMin = Infinity;
  let tMax = -Infinity;
  for (const s of series) for (const [t] of s.puntos) { tMin = Math.min(tMin, t); tMax = Math.max(tMax, t); }
  if (!isFinite(tMin)) { tMin = 0; tMax = 60; }
  if (opciones.ventana) tMin = Math.max(tMin, tMax - opciones.ventana);
  if (tMax - tMin < 10) tMax = tMin + 10;

  const escalas = {};
  for (const eje of ['izq', 'der']) {
    let max = 0;
    for (const s of series) if (s.eje === eje) for (const [t, v] of s.puntos) if (t >= tMin) max = Math.max(max, v);
    for (const b of opciones.metas || []) if (b.eje === eje && b.hasta >= tMin && b.desde <= tMax) max = Math.max(max, b.max);
    escalas[eje] = max > 0 ? Math.ceil((max * 1.15) / 10) * 10 : 10;
  }

  const X = (t) => m.izq + ((t - tMin) / (tMax - tMin)) * w;
  const Y = (v, eje) => m.arr + h - (v / escalas[eje]) * h;

  ctx.font = '11px system-ui, sans-serif';
  ctx.strokeStyle = colorRejilla;
  ctx.fillStyle = colorTexto;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = m.arr + (h * i) / 4;
    ctx.beginPath(); ctx.moveTo(m.izq, y); ctx.lineTo(m.izq + w, y); ctx.stroke();
    const frac = 1 - i / 4;
    ctx.textAlign = 'right';
    if (series.some((s) => s.eje === 'izq')) ctx.fillText(Math.round(escalas.izq * frac), m.izq - 6, y + 4);
    ctx.textAlign = 'left';
    if (series.some((s) => s.eje === 'der')) ctx.fillText(Math.round(escalas.der * frac), m.izq + w + 6, y + 4);
  }

  ctx.textAlign = 'center';
  const pasos = opciones.sinEjeX ? -1 : 4;
  for (let i = 0; i <= pasos; i++) {
    const t = tMin + ((tMax - tMin) * i) / pasos;
    const seg = Math.round(t);
    ctx.fillText(`${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`, X(t), alto - 6);
  }

  // Bandas de meta del entrenamiento (opcional): [{ desde, hasta, min, max, eje }]
  for (const b of opciones.metas || []) {
    if (b.hasta < tMin) continue;
    ctx.fillStyle = 'rgba(60, 207, 145, 0.16)';
    const x0 = Math.max(X(b.desde), m.izq);
    const x1 = Math.min(X(b.hasta), m.izq + w);
    if (x1 <= x0) continue;
    ctx.fillRect(x0, Y(b.max, b.eje), x1 - x0, Y(b.min, b.eje) - Y(b.max, b.eje));
  }

  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let primero = true;
    for (const [t, v] of s.puntos) {
      if (t < tMin) continue;
      if (primero) { ctx.moveTo(X(t), Y(v, s.eje)); primero = false; } else ctx.lineTo(X(t), Y(v, s.eje));
    }
    ctx.stroke();
    if (opciones.marcas) {
      ctx.fillStyle = s.color;
      for (const [t, v] of s.puntos) {
        if (t < tMin) continue;
        ctx.beginPath(); ctx.arc(X(t), Y(v, s.eje), 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

}
