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
    if (opciones.decimales && max > 0 && max < 20) escalas[eje] = Math.ceil(max * 1.15 * 2) / 2;
    else escalas[eje] = max > 0 ? Math.ceil((max * 1.15) / 10) * 10 : 10;
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
    const num = (v) => (escalas.izq < 20 && opciones.decimales ? v.toFixed(1) : Math.round(v));
    const numD = (v) => (escalas.der < 20 && opciones.decimales ? v.toFixed(1) : Math.round(v));
    if (series.some((s) => s.eje === 'izq')) ctx.fillText(num(escalas.izq * frac), m.izq - 6, y + 4);
    ctx.textAlign = 'left';
    if (series.some((s) => s.eje === 'der')) ctx.fillText(numD(escalas.der * frac), m.izq + w + 6, y + 4);
  }

  ctx.textAlign = 'center';
  const pasos = opciones.sinEjeX ? -1 : 4;
  for (let i = 0; i <= pasos; i++) {
    const t = tMin + ((tMax - tMin) * i) / pasos;
    const seg = Math.round(t);
    ctx.fillText(opciones.formatoX ? opciones.formatoX(t) : `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`, X(t), alto - 6);
  }

  // Bandas de meta del entrenamiento (opcional): [{ desde, hasta, min, max, eje }]
  for (const b of opciones.metas || []) {
    if (b.hasta < tMin) continue;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
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

// Perfil completo de un entrenamiento por intervalos: eje X = tiempo del entrenamiento,
// eje Y = watts. Cada intervalo con meta de potencia pinta su rango en verde y el resto en rojo.
// puntos: [[t, watts], ...] de la sesión (opcional); ahora: segundo actual (opcional).
export function dibujarPerfil(canvas, bloques, puntos = [], ahora = null) {
  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (!ancho || !alto) return;
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

  const total = bloques.reduce((a, b) => a + b.duracion, 0) || 60;
  const tFin = Math.max(total, puntos.length ? puntos.at(-1)[0] : 0);
  let maxW = 0;
  for (const b of bloques) if (b.metrica === 'watts') maxW = Math.max(maxW, b.max || b.min);
  for (const [, v] of puntos) maxW = Math.max(maxW, v);
  const yMax = Math.max(50, Math.ceil((maxW * 1.25) / 50) * 50);

  const m = { izq: 40, der: 12, arr: 10, aba: 22 };
  const w = ancho - m.izq - m.der;
  const h = alto - m.arr - m.aba;
  const X = (t) => m.izq + (t / tFin) * w;
  const Y = (v) => m.arr + h - (Math.min(v, yMax) / yMax) * h;

  // Intervalos: rojo fuera del rango, verde dentro, gris si es libre.
  let desde = 0;
  for (const b of bloques) {
    const x0 = X(desde);
    const x1 = X(desde + b.duracion);
    const activo = ahora != null && ahora >= desde && ahora < desde + b.duracion;
    if (b.metrica === 'watts') {
      const max = b.max || yMax;
      ctx.fillStyle = activo ? 'rgba(239, 68, 68, 0.38)' : 'rgba(239, 68, 68, 0.2)';
      ctx.fillRect(x0, m.arr, x1 - x0, h);
      ctx.fillStyle = activo ? 'rgba(34, 197, 94, 0.8)' : 'rgba(34, 197, 94, 0.5)';
      ctx.fillRect(x0, Y(max), x1 - x0, Y(b.min) - Y(max));
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.fillRect(x0, m.arr, x1 - x0, h);
    }
    ctx.strokeStyle = colorRejilla;
    ctx.beginPath(); ctx.moveTo(x1, m.arr); ctx.lineTo(x1, m.arr + h); ctx.stroke();
    desde += b.duracion;
  }

  // Eje Y en watts
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = colorTexto;
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = (yMax * i) / 4;
    ctx.fillText(Math.round(v), m.izq - 6, Y(v) + 4);
  }

  // Eje X en minutos
  ctx.textAlign = 'center';
  const paso = [60, 120, 300, 600, 900, 1800].find((p) => tFin / p <= 6) || 3600;
  for (let t = 0; t <= tFin; t += paso) ctx.fillText(`${Math.round(t / 60)}m`, X(t), alto - 6);

  // Potencia real
  if (puntos.length) {
    ctx.strokeStyle = estilo.getPropertyValue('--texto').trim() || '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    puntos.forEach(([t, v], i) => (i ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v))));
    ctx.stroke();
  }

  // Marca de "ahora"
  if (ahora != null && ahora <= tFin) {
    ctx.strokeStyle = estilo.getPropertyValue('--acento').trim() || '#39f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(ahora), m.arr); ctx.lineTo(X(ahora), m.arr + h); ctx.stroke();
  }
}

// Barras simples con etiqueta debajo y valor encima. datos: [{ etiqueta, valor, resaltar }]
export function dibujarBarras(canvas, datos, { color = '#F97316', formato = (v) => v } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (!ancho || !alto) return;
  canvas.width = ancho * dpr;
  canvas.height = alto * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  const estilo = getComputedStyle(document.documentElement);
  const colorTexto = estilo.getPropertyValue('--texto-suave').trim() || '#888';
  const colorRejilla = estilo.getPropertyValue('--rejilla').trim() || '#333';
  const m = { izq: 8, der: 8, arr: 20, aba: 22 };
  const w = ancho - m.izq - m.der;
  const h = alto - m.arr - m.aba;
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const paso = w / Math.max(1, datos.length);
  const anchoBarra = Math.min(36, paso * 0.6);
  ctx.strokeStyle = colorRejilla;
  ctx.beginPath(); ctx.moveTo(m.izq, m.arr + h); ctx.lineTo(m.izq + w, m.arr + h); ctx.stroke();
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  datos.forEach((d, i) => {
    const cx = m.izq + paso * (i + 0.5);
    const bh = (d.valor / max) * h;
    ctx.globalAlpha = d.resaltar ? 1 : 0.55;
    ctx.fillStyle = color;
    ctx.fillRect(cx - anchoBarra / 2, m.arr + h - bh, anchoBarra, bh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colorTexto;
    if (d.valor) ctx.fillText(formato(d.valor), cx, m.arr + h - bh - 5);
    ctx.fillText(d.etiqueta, cx, alto - 6);
  });
}

// Avance hacia una meta: acumulado contra tiempo, línea de meta y proyección punteada al ritmo actual.
// puntos: [[t, acumulado], ...]; estimadoFin: segundo en que se llegaría a la meta (o null).
export function dibujarAvance(canvas, puntos, meta, estimadoFin = null) {
  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (!ancho || !alto) return;
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
  const colorLinea = estilo.getPropertyValue('--primario').trim() || '#F97316';
  const colorMeta = estilo.getPropertyValue('--exito').trim() || '#22C55E';

  const ultimo = puntos.at(-1) || [0, 0];
  const tFin = Math.max(60, ultimo[0], estimadoFin && estimadoFin < ultimo[0] * 4 ? estimadoFin : 0) * 1.05;
  const yMax = Math.max(meta, ultimo[1]) * 1.1 || 10;
  const m = { izq: 44, der: 12, arr: 12, aba: 22 };
  const w = ancho - m.izq - m.der;
  const h = alto - m.arr - m.aba;
  const X = (t) => m.izq + (t / tFin) * w;
  const Y = (v) => m.arr + h - (v / yMax) * h;

  ctx.font = '12px system-ui, sans-serif';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = (yMax * i) / 4;
    ctx.strokeStyle = colorRejilla;
    ctx.beginPath(); ctx.moveTo(m.izq, Y(v)); ctx.lineTo(m.izq + w, Y(v)); ctx.stroke();
    ctx.fillStyle = colorTexto;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(v), m.izq - 6, Y(v) + 4);
  }
  ctx.textAlign = 'center';
  const paso = [60, 120, 300, 600, 900, 1800].find((p) => tFin / p <= 6) || 3600;
  for (let t = 0; t <= tFin; t += paso) ctx.fillText(`${Math.round(t / 60)}m`, X(t), alto - 6);

  // Meta
  ctx.strokeStyle = colorMeta;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(m.izq, Y(meta)); ctx.lineTo(m.izq + w, Y(meta)); ctx.stroke();

  // Proyección
  if (estimadoFin != null && ultimo[1] < meta) {
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = colorTexto;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(ultimo[0]), Y(ultimo[1])); ctx.lineTo(X(Math.min(estimadoFin, tFin)), Y(estimadoFin <= tFin ? meta : ultimo[1] + ((meta - ultimo[1]) * (tFin - ultimo[0])) / (estimadoFin - ultimo[0]))); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Avance real
  if (puntos.length) {
    ctx.strokeStyle = colorLinea;
    ctx.lineWidth = 3;
    ctx.beginPath();
    puntos.forEach(([t, v], i) => (i ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v))));
    ctx.stroke();
    ctx.fillStyle = colorLinea;
    ctx.beginPath(); ctx.arc(X(ultimo[0]), Y(ultimo[1]), 5, 0, Math.PI * 2); ctx.fill();
  }
}
