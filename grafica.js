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

// Carrera contra el fantasma: dos carriles con los botes en su posición real.
// La ventana sigue a los dos botes; si la meta está cerca se dibuja la línea de llegada.
export function dibujarCarrera(canvas, { yo, rival, meta = null, nombreRival = 'Fantasma', velocidad = 4 }) {
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
  const c = (v, d) => estilo.getPropertyValue(v).trim() || d;
  const colorTexto = c('--texto-suave', '#ccc');
  const colorYo = c('--primario', '#F97316');
  const colorRival = '#A5B4FC';
  ctx.lineWidth = 1;
  ctx.lineCap = 'butt';

  const dif = yo - rival;
  const arriba = Math.max(22, Math.min(40, alto * 0.16));
  const abajo = 22;
  // Con pantalla alta queda espacio para un mapa del recorrido completo debajo de la pista.
  const conMapa = alto > 360;
  const mapa = conMapa ? 100 : 0;
  const carril = Math.min(conMapa ? 120 : 80, (alto - arriba - abajo - mapa) / 2);
  const pista = carril * 2;
  const libre = alto - arriba - abajo - pista - mapa;
  const arribaPista = arriba + libre / 2;
  const izq = 12;
  const der = 12;
  const w = ancho - izq - der;

  // Ventana: muestra a los dos botes con margen; mínimo 60 m.
  const ventana = Math.max(60, Math.abs(dif) * 1.6 + 40);
  const centro = (yo + rival) / 2;
  const desde = Math.max(0, centro - ventana / 2);
  const X = (m) => izq + ((m - desde) / ventana) * w;

  // Agua
  const grad = ctx.createLinearGradient(0, arribaPista, 0, arribaPista + pista);
  grad.addColorStop(0, '#0B3A5B');
  grad.addColorStop(1, '#082A44');
  ctx.fillStyle = grad;
  ctx.fillRect(izq, arribaPista, w, pista);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(izq, arribaPista + carril); ctx.lineTo(izq + w, arribaPista + carril); ctx.stroke();
  ctx.setLineDash([]);

  // Marcas de distancia
  const paso = [10, 25, 50, 100, 250, 500].find((p) => ventana / p <= 6) || 1000;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let m = Math.ceil(desde / paso) * paso; m <= desde + ventana; m += paso) {
    const x = X(m);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(x, arribaPista); ctx.lineTo(x, arribaPista + pista); ctx.stroke();
    ctx.fillStyle = colorTexto;
    ctx.fillText(`${m} m`, x, arribaPista + pista + 16);
  }

  // Línea de meta
  if (meta != null && meta >= desde && meta <= desde + ventana) {
    const x = X(meta);
    const cuadro = 6;
    for (let y = arribaPista, i = 0; y < arribaPista + pista; y += cuadro, i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#111';
      ctx.fillRect(x - cuadro, y, cuadro, cuadro);
      ctx.fillStyle = i % 2 ? '#111' : '#fff';
      ctx.fillRect(x, y, cuadro, cuadro);
    }
  }

  // Botes: casco, remero y estela según la velocidad.
  const bote = (m, fila, colorBote, etiqueta, fantasma) => {
    const largo = Math.min(110, Math.max(56, w * 0.18));
    const x = Math.min(izq + w - 4, Math.max(izq + largo + 4, X(m)));
    const y = arribaPista + carril * (fila + 0.58);
    const altoB = Math.min(11, Math.max(7, carril * 0.16));
    const remo = Math.min(28, carril * 0.36);
    ctx.globalAlpha = fantasma ? 0.75 : 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      const largoEstela = Math.min(60, velocidad * 6) * (i / 3);
      ctx.beginPath();
      ctx.moveTo(x - largo - 2, y - altoB * 0.3 * i);
      ctx.lineTo(x - largo - 2 - largoEstela, y - altoB * 0.6 * i);
      ctx.moveTo(x - largo - 2, y + altoB * 0.3 * i);
      ctx.lineTo(x - largo - 2 - largoEstela, y + altoB * 0.6 * i);
      ctx.stroke();
    }
    ctx.fillStyle = colorBote;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - largo * 0.3, y - altoB, x - largo, y - altoB * 0.35);
    ctx.lineTo(x - largo, y + altoB * 0.35);
    ctx.quadraticCurveTo(x - largo * 0.3, y + altoB, x, y);
    ctx.fill();
    // Remos
    ctx.strokeStyle = colorBote;
    ctx.lineWidth = 2;
    const cx = x - largo * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, y); ctx.lineTo(cx - largo * 0.12, y - remo);
    ctx.moveTo(cx, y); ctx.lineTo(cx - largo * 0.12, y + remo);
    ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath(); ctx.arc(cx, y, altoB * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(etiqueta, izq + 6, arribaPista + carril * fila + 15);
  };
  bote(rival, 0, colorRival, nombreRival, true);
  bote(yo, 1, colorYo, 'Tú', false);

  if (conMapa) {
    const total = meta || Math.max(500, Math.ceil((Math.max(yo, rival) * 1.25) / 500) * 500);
    const y0 = arribaPista + pista + abajo + 58;
    const MX = (m) => izq + 10 + (Math.min(m, total) / total) * (w - 20);
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = colorTexto;
    ctx.fillText(meta ? 'Recorrido completo' : 'Recorrido', izq, y0 - 30);
    ctx.textAlign = 'right';
    ctx.fillText(`${total} m${meta ? ' (meta)' : ''}`, izq + w, y0 - 30);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(MX(0), y0); ctx.lineTo(MX(total), y0); ctx.stroke();
    ctx.strokeStyle = colorYo;
    ctx.beginPath(); ctx.moveTo(MX(0), y0); ctx.lineTo(MX(yo), y0); ctx.stroke();
    ctx.lineCap = 'butt';
    for (const [m, col, dy, et] of [[rival, colorRival, -1, nombreRival], [yo, colorYo, 1, 'Tú']]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(MX(m), y0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = MX(m) > izq + w * 0.7 ? 'right' : 'left';
      ctx.fillText(`${et} · ${Math.round(m)} m`, MX(m) + (ctx.textAlign === 'left' ? -8 : 8), y0 + (dy > 0 ? 26 : -13));
    }
  }

  // Encabezado: quién va adelante y por cuánto.
  const seg = velocidad > 0 ? Math.abs(dif) / velocidad : 0;
  const texto = Math.abs(dif) < 1 ? 'Empatados' : `${dif > 0 ? 'Vas adelante' : 'Vas atrás'} por ${Math.round(Math.abs(dif))} m (${seg.toFixed(1)} s)`;
  ctx.font = `800 ${Math.round(Math.min(20, arriba * 0.6))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = Math.abs(dif) < 1 ? '#F8FAFC' : dif > 0 ? c('--exito', '#22C55E') : '#FCA5A5';
  ctx.fillText(texto, ancho / 2, Math.max(arriba * 0.72, arribaPista - 12));
}
