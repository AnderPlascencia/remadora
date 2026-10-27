// Carrera animada contra uno o varios fantasmas, en vista 2D (desde arriba) o 3D (desde atrás).
// Los datos llegan una vez por segundo; entre lecturas se interpola para que todo se mueva fluido
// a la frecuencia de pantalla. Los remos se animan al ritmo de golpes por minuto de cada bote.
import { distanciaEn } from './estadisticas.js';

const carreras = new Set();
let animando = false;
const sinMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const COLORES_RIVAL = ['#A5B4FC', '#F9A8D4', '#FDE68A'];
const COLOR_YO = '#F97316';

// estado: { t, pausa, yo: { dist, v, spm }, rivales: [{ nombre, color, muestras, spm(t) }], meta, cabecera: [l1, l2], tono, ritmo?: { v, etiqueta } }
export function crearCarrera(canvas) {
  const c = {
    canvas,
    modo: '2d',
    estado: null,
    recibido: 0,
    yoVista: null,
    ventana: 80,
    fases: [],
    ultimoCuadro: 0,
    actualizar(estado) {
      const previo = this.estado;
      // El reloj de interpolación solo se reinicia cuando avanza el segundo de la sesión.
      if (!previo || previo.t !== estado.t || previo.pausa !== estado.pausa) {
        this.recibido = performance.now();
        this.base = estado.yo.dist;
      }
      this.estado = estado;
      if (this.yoVista == null || Math.abs(this.yoVista - estado.yo.dist) > 40) this.yoVista = estado.yo.dist;
      arrancar();
    },
    detener() { this.estado = null; this.yoVista = null; },
  };
  carreras.add(c);
  return c;
}

function arrancar() {
  if (animando) return;
  animando = true;
  requestAnimationFrame(cuadro);
}

function cuadro(ahora) {
  let alguna = false;
  for (const c of carreras) {
    if (!c.estado || !c.canvas.isConnected || c.canvas.hidden || c.canvas.offsetParent === null) continue;
    alguna = true;
    pintarCarrera(c, ahora);
  }
  if (alguna) requestAnimationFrame(cuadro);
  else animando = false;
}

// Estado interpolado de este cuadro: posiciones de cada bote y fase de su palada.
function interpolar(c, ahora) {
  const e = c.estado;
  const dt = Math.min(0.1, c.ultimoCuadro ? (ahora - c.ultimoCuadro) / 1000 : 0);
  c.ultimoCuadro = ahora;
  const el = e.pausa ? 0 : Math.min(1.2, (ahora - c.recibido) / 1000);
  const objetivo = (c.base ?? e.yo.dist) + (e.pausa ? 0 : e.yo.v * el);
  c.yoVista += (objetivo - c.yoVista) * Math.min(1, dt * 8);
  if (sinMovimiento) c.yoVista = objetivo;
  const t = e.t + el;
  const botes = [{ nombre: 'Tú', color: e.yoColor || COLOR_YO, dist: c.yoVista, spm: e.pausa ? 0 : e.yo.spm, v: e.pausa ? 0 : e.yo.v, yo: true }];
  e.rivales.forEach((r, i) => {
    const d = distanciaEn(r.muestras, t);
    const d2 = distanciaEn(r.muestras, t + 1);
    const v = e.pausa ? 0 : d2 - d;
    const spm = e.pausa || v <= 0 ? 0 : (r.spmEn ? r.spmEn(t) : 24);
    botes.push({ nombre: r.nombre, color: r.color || COLORES_RIVAL[i % 3], dist: d, spm, v });
  });
  botes.forEach((b, i) => {
    c.fases[i] = ((c.fases[i] || 0) + (dt * b.spm) / 60) % 1;
    b.fase = c.fases[i];
    // Oleaje de la palada: el bote acelera al jalar y se frena al recobrar.
    if (!b.yo && b.spm && !sinMovimiento) b.dist += (b.v * 0.12 * (60 / b.spm) / (2 * Math.PI)) * Math.sin(2 * Math.PI * b.fase);
  });
  const ritmo = e.ritmo ? { dist: e.ritmo.v * t, etiqueta: e.ritmo.etiqueta } : null;
  return { botes, dt, t: ahora / 1000, ritmo };
}

// Ángulo del remo (radianes, + hacia la proa) y posición del asiento (−1 popa, +1 proa) según la fase.
function palada(fase, spm) {
  if (!spm) return { ang: -0.15, asiento: 0.6 };
  const empuje = 0.38;
  if (fase < empuje) {
    const p = fase / empuje;
    const s = 0.5 - 0.5 * Math.cos(Math.PI * p);
    return { ang: 0.85 - 1.45 * s, asiento: -1 + 2 * s };
  }
  const p = (fase - empuje) / (1 - empuje);
  const s = 0.5 - 0.5 * Math.cos(Math.PI * p);
  return { ang: -0.6 + 1.45 * s, asiento: 1 - 2 * s };
}

function preparar(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (!ancho || !alto) return null;
  if (canvas.width !== Math.round(ancho * dpr) || canvas.height !== Math.round(alto * dpr)) {
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  return { ctx, ancho, alto };
}

export function pintarCarrera(c, ahora = performance.now()) {
  const p = preparar(c.canvas);
  if (!p) return;
  const datos = interpolar(c, ahora);
  if (c.modo === '3d') pintar3d(c, p, datos);
  else pintar2d(c, p, datos);
  insignia(c, p, cabecera(c, p));
}

// Pequeña pastilla en la esquina que recuerda que tocar cambia de vista.
function insignia(c, { ctx, ancho }, arriba) {
  const txt = c.modo === '3d' ? 'Toca: 2D' : 'Toca: 3D';
  ctx.font = '600 11px system-ui, sans-serif';
  const w = ctx.measureText(txt).width + 14;
  const x = ancho - w - 6;
  const y = arriba + 6;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, 18, 9) : ctx.rect(x, y, w, 18);
  ctx.fill();
  ctx.fillStyle = '#CBD5E1';
  ctx.textAlign = 'center';
  ctx.fillText(txt, x + w / 2, y + 13);
}

function cabecera(c, { ctx, ancho, alto }) {
  const [l1, l2] = c.estado.cabecera || [];
  const grande = Math.round(Math.max(14, Math.min(22, alto * 0.07)));
  ctx.textAlign = 'center';
  ctx.font = `800 ${grande}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
  const altoCaja = l2 ? grande + 26 : grande + 12;
  ctx.fillRect(0, 0, ancho, altoCaja);
  ctx.fillStyle = { adelante: '#4ADE80', atras: '#FCA5A5' }[c.estado.tono] || '#F8FAFC';
  if (l1) ctx.fillText(l1, ancho / 2, grande + 2);
  if (l2) {
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(l2, ancho / 2, grande + 19);
  }
  return altoCaja;
}

// ---------- 2D: vista desde arriba, la cámara sigue tu bote ----------
const COLOR_RITMO = '#FACC15';

function pintar2d(c, { ctx, ancho, alto }, { botes, dt, t, ritmo }) {
  const n = botes.length;
  const arriba = Math.max(36, Math.min(54, alto * 0.16));
  const orilla = Math.min(16, alto * 0.06);
  const abajo = 20;
  const carril = Math.min(90, (alto - arriba - abajo - 2 * orilla) / n);
  const pista = carril * n;
  const y0 = arriba + orilla + Math.max(0, (alto - arriba - abajo - 2 * orilla - pista) / 2);
  const yo = botes[0];

  // Zoom automático: que quepan los botes cercanos; los lejanos se señalan en el borde.
  const maxDif = Math.max(0, ...botes.slice(1).map((b) => Math.abs(b.dist - yo.dist)).filter((d) => d < 250));
  const objetivo = Math.max(50, Math.min(320, maxDif * 2.6 + 36));
  c.ventana += (objetivo - c.ventana) * Math.min(1, dt * 2);
  const ventana = c.ventana;
  const xYo = ancho * 0.55;
  const X = (m) => xYo + ((m - yo.dist) / ventana) * ancho;
  const M = (x) => yo.dist + ((x - xYo) / ancho) * ventana;
  const ppm = ancho / ventana;

  // Orillas
  // Si sobra alto, la tierra llena el espacio en vez de dejar franjas vacías.
  const tierraArriba = Math.max(orilla, y0 - arriba);
  const tierraAbajo = Math.max(orilla, alto - abajo - (y0 + pista));
  ctx.fillStyle = '#1F3A2A';
  ctx.fillRect(0, y0 - tierraArriba, ancho, tierraArriba);
  ctx.fillRect(0, y0 + pista, ancho, tierraAbajo);
  ctx.fillStyle = '#C2A878';
  ctx.fillRect(0, y0 - 3, ancho, 3);
  ctx.fillRect(0, y0 + pista, ancho, 3);
  // Árboles en la orilla, anclados al mundo (se desplazan al avanzar)
  ctx.fillStyle = '#2F6B3F';
  for (let m = Math.floor(M(0) / 9) * 9; m < M(ancho) + 9; m += 9) {
    const x = X(m);
    const r = Math.min(orilla * 0.42, 6);
    ctx.beginPath(); ctx.arc(x, y0 - orilla / 2 - 1, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(X(m + 4.5), y0 + pista + orilla / 2 + 1, r, 0, Math.PI * 2); ctx.fill();
  }

  // Agua
  const grad = ctx.createLinearGradient(0, y0, 0, y0 + pista);
  grad.addColorStop(0, '#0E4A70');
  grad.addColorStop(1, '#0A3352');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y0, ancho, pista);

  // Olas ancladas al mundo, con un brillo que va y viene
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.2;
  const pasoOla = 4;
  for (let fila = 0; fila < n * 3; fila++) {
    const y = y0 + (fila + 0.5) * (pista / (n * 3));
    const desf = (fila % 2) * 2;
    for (let m = Math.floor(M(0) / pasoOla) * pasoOla + desf; m < M(ancho) + pasoOla; m += pasoOla) {
      const brillo = sinMovimiento ? 0 : Math.sin(t * 1.6 + m * 0.9 + fila);
      if (brillo < 0) continue;
      const x = X(m);
      const l = Math.min(10, ppm * 1.4);
      ctx.beginPath(); ctx.arc(x, y + 3, l, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
  }

  // Líneas de boyas entre carriles: puntos cada 5 m, rojos cada 25 m, boya grande cada 250 m
  for (let k = 1; k < n; k++) {
    const y = y0 + k * carril;
    for (let m = Math.floor(M(0) / 5) * 5; m < M(ancho) + 5; m += 5) {
      if (m < 0) continue;
      const x = X(m);
      const grande = m % 250 === 0;
      ctx.fillStyle = grande ? '#F97316' : m % 25 === 0 ? '#EF4444' : 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(x, y, grande ? 5 : Math.min(2.6, ppm * 0.35 + 1), 0, Math.PI * 2); ctx.fill();
    }
  }

  // Marcas de distancia
  const paso = [10, 25, 50, 100, 250].find((q) => ventana / q <= 6) || 500;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let m = Math.ceil(M(0) / paso) * paso; m <= M(ancho); m += paso) {
    if (m < 0) continue;
    const x = X(m);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + pista); ctx.stroke();
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`${m} m`, x, alto - 5);
  }

  // Meta
  const meta = c.estado.meta;
  if (meta != null && X(meta) > -10 && X(meta) < ancho + 10) {
    const x = X(meta);
    const q = 6;
    for (let y = y0, i = 0; y < y0 + pista; y += q, i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#111';
      ctx.fillRect(x - q, y, q, q);
      ctx.fillStyle = i % 2 ? '#111' : '#fff';
      ctx.fillRect(x, y, q, q);
    }
  }

  // Línea del ritmo objetivo: dónde estarías remando justo a ese split
  if (ritmo && X(ritmo.dist) > -10 && X(ritmo.dist) < ancho + 10) {
    const x = X(ritmo.dist);
    ctx.strokeStyle = COLOR_RITMO;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + pista); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = x > ancho - 60 ? 'right' : 'left';
    ctx.fillStyle = COLOR_RITMO;
    ctx.fillText(ritmo.etiqueta, x + (x > ancho - 60 ? -4 : 4), y0 + pista - 4);
  } else if (ritmo) {
    // Fuera de la ventana: aviso en el borde con la diferencia
    const der = X(ritmo.dist) > ancho;
    const dif = Math.round(ritmo.dist - yo.dist);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = der ? 'right' : 'left';
    ctx.fillStyle = COLOR_RITMO;
    ctx.fillText(`${der ? '' : '◀ '}${ritmo.etiqueta} ${dif > 0 ? '+' : '−'}${Math.abs(dif)} m${der ? ' ▶' : ''}`, der ? ancho - 6 : 6, y0 + pista - 4);
  }

  // Botes: los rivales arriba, tú en el carril de abajo
  const orden = [...botes.slice(1), botes[0]];
  orden.forEach((b, fila) => {
    const y = y0 + carril * (fila + 0.55);
    const largo = Math.max(44, Math.min(120, ppm * 8));
    const x = X(b.dist);
    const etiquetaY = y0 + carril * fila + 14;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = b.color;
    const dif = b.yo ? '' : ` ${b.dist >= yo.dist ? '+' : '−'}${Math.round(Math.abs(b.dist - yo.dist))} m`;
    ctx.fillText(`${b.nombre}${dif}`, 8, etiquetaY);
    if (x > ancho + largo * 0.2 || x < -largo * 0.2) {
      // Fuera de la ventana: flecha en el borde
      const der = x > ancho;
      const ax = der ? ancho - 10 : 10;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(ax + (der ? 8 : -8), y);
      ctx.lineTo(ax - (der ? 6 : -6), y - 8);
      ctx.lineTo(ax - (der ? 6 : -6), y + 8);
      ctx.fill();
      return;
    }
    bote2d(ctx, x, y, largo, Math.min(carril * 0.42, 34), b, ppm);
  });
}

function bote2d(ctx, x, y, largo, remo, b, ppm) {
  const ancho = Math.max(5, largo * 0.07);
  ctx.globalAlpha = b.yo ? 1 : 0.85;
  // Estela en V que crece con la velocidad
  const estela = Math.min(largo * 1.4, b.v * ppm * 3);
  if (estela > 2) {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.35 - i * 0.1})`;
      ctx.lineWidth = 1.5;
      const off = i * 4;
      ctx.beginPath();
      ctx.moveTo(x - largo - off, y - ancho * 0.4);
      ctx.lineTo(x - largo - estela - off, y - ancho * 1.6 - i * 3);
      ctx.moveTo(x - largo - off, y + ancho * 0.4);
      ctx.lineTo(x - largo - estela - off, y + ancho * 1.6 + i * 3);
      ctx.stroke();
    }
  }
  // Casco
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - largo * 0.35, y - ancho, x - largo, y - ancho * 0.25);
  ctx.lineTo(x - largo, y + ancho * 0.25);
  ctx.quadraticCurveTo(x - largo * 0.35, y + ancho, x, y);
  ctx.fill();
  // Remos y remero
  const { ang, asiento } = palada(b.fase, b.spm);
  const px = x - largo * 0.52;
  ctx.strokeStyle = b.color;
  ctx.lineWidth = 2;
  for (const lado of [-1, 1]) {
    const bx = px + Math.sin(ang) * remo;
    const by = y + lado * Math.cos(ang) * remo;
    ctx.beginPath(); ctx.moveTo(px, y + lado * ancho * 0.6); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.ellipse(bx, by, 4, 2.2, ang * lado, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#F8FAFC';
  const sx = px - largo * 0.08 + asiento * largo * 0.06;
  ctx.beginPath(); ctx.arc(sx, y, Math.max(3, ancho * 0.55), 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- 3D: cámara detrás de tu bote ----------
function pintar3d(c, { ctx, ancho, alto }, { botes, t, ritmo }) {
  const yo = botes[0];
  const camZ = yo.dist - 13;
  const camH = 4.6;
  const horizonte = alto * 0.3;
  const f = alto * 0.95;
  const cx = ancho / 2;
  const carril = 3;
  // Tú en el centro; rivales a los lados
  const lado = (i) => (i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2) * carril);
  const lateral = botes.map((_, i) => lado(i));
  const minX = Math.min(...lateral) - carril / 2;
  const maxX = Math.max(...lateral) + carril / 2;
  // Escala horizontal: que todos los carriles quepan a la altura de tu bote, incluso en vertical.
  const extremo = Math.max(-minX, maxX) + 0.5;
  const fx = Math.min(f / 1.6, (ancho * 0.47 * 10) / extremo);
  const P = (x, z, h = 0) => {
    const d = z - camZ;
    if (d <= 0.3) return null;
    return { x: cx + (fx * x) / d, y: horizonte + (f * (camH - h)) / d, s: f / d, d };
  };

  // Cielo y fondo
  const cielo = ctx.createLinearGradient(0, 0, 0, horizonte);
  cielo.addColorStop(0, '#0B1E3A');
  cielo.addColorStop(1, '#36597F');
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, ancho, horizonte);
  // Colinas lejanas
  ctx.fillStyle = '#1C3B2C';
  ctx.beginPath();
  ctx.moveTo(0, horizonte);
  for (let x = 0; x <= ancho; x += 20) ctx.lineTo(x, horizonte - 10 - 8 * Math.sin(x / 90 + yo.dist / 400) - 5 * Math.sin(x / 37));
  ctx.lineTo(ancho, horizonte);
  ctx.fill();
  // Agua
  const agua = ctx.createLinearGradient(0, horizonte, 0, alto);
  agua.addColorStop(0, '#2C5C80');
  agua.addColorStop(1, '#0A3352');
  ctx.fillStyle = agua;
  ctx.fillRect(0, horizonte, ancho, alto - horizonte);

  // Orillas (franjas a los lados del canal)
  const lejos = 400;
  for (const s of [-1, 1]) {
    const borde = s < 0 ? minX - 6 : maxX + 6;
    const a = P(borde, camZ + 1.2);
    const b = P(borde, camZ + lejos);
    if (!a || !b) continue;
    ctx.fillStyle = '#1F3A2A';
    ctx.beginPath();
    ctx.moveTo(s < 0 ? 0 : ancho, alto);
    ctx.lineTo(a.x, alto);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(s < 0 ? 0 : ancho, b.y);
    ctx.fill();
  }

  // Olas
  if (!sinMovimiento) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let z = Math.floor((camZ + 2) / 3) * 3; z < camZ + 120; z += 3) {
      for (let x = minX - 4; x <= maxX + 4; x += 2.5) {
        if (Math.sin(t * 1.5 + z * 0.7 + x) < 0.3) continue;
        const q = P(x + (z % 2), z);
        if (!q) continue;
        const l = Math.min(14, q.s * 0.25);
        ctx.beginPath(); ctx.moveTo(q.x - l, q.y); ctx.lineTo(q.x + l, q.y); ctx.stroke();
      }
    }
  }

  // Marcas transversales de distancia y meta
  const paso = 50;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  let ultimaEtq = Infinity;
  for (let m = Math.ceil(camZ / paso) * paso; m < camZ + 300; m += paso) {
    if (m < 0) continue;
    const a = P(minX - 2, m);
    const b = P(maxX + 2, m);
    if (!a || !b) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, a.s * 0.02);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // Etiquetas solo mientras no se amontonan cerca del horizonte.
    if (ultimaEtq - b.y >= 16 && b.x + 50 < ancho) {
      ctx.fillStyle = 'rgba(226,232,240,0.85)';
      ctx.fillText(`${m} m`, b.x + 6, b.y + 4);
      ultimaEtq = b.y;
    }
  }
  const meta = c.estado.meta;
  if (meta != null && meta - camZ < 300 && meta > camZ) {
    const a = P(minX - 2, meta);
    const b = P(maxX + 2, meta);
    if (a && b) {
      const cuadros = 16;
      const grueso = Math.max(2, a.s * 0.25);
      for (let i = 0; i < cuadros; i++) {
        ctx.fillStyle = i % 2 ? '#fff' : '#111';
        const x0 = a.x + ((b.x - a.x) * i) / cuadros;
        ctx.fillRect(x0, a.y - grueso / 2, (b.x - a.x) / cuadros + 1, grueso);
      }
    }
  }

  if (ritmo && ritmo.dist - camZ < 300 && ritmo.dist > camZ + 0.5) {
    const a = P(minX - 2, ritmo.dist);
    const b = P(maxX + 2, ritmo.dist);
    if (a && b) {
      ctx.strokeStyle = COLOR_RITMO;
      ctx.lineWidth = Math.max(2, a.s * 0.08);
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = COLOR_RITMO;
      if (b.x + 70 < ancho) ctx.fillText(ritmo.etiqueta, b.x + 6, b.y - 6);
    }
  }

  // Cuerdas de boyas entre carriles
  for (let k = 0; k <= botes.length; k++) {
    const x = minX + k * carril;
    for (let z = Math.ceil((camZ + 1) / 5) * 5; z < camZ + 160; z += 5) {
      if (z < 0) continue;
      const q = P(x, z);
      if (!q) continue;
      const grande = z % 250 === 0;
      if (!grande && q.s < 2) continue;
      ctx.fillStyle = grande ? '#F97316' : z % 25 === 0 ? '#EF4444' : 'rgba(255,255,255,0.8)';
      const r = Math.max(0.8, q.s * (grande ? 0.35 : 0.12));
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Botes, del más lejano al más cercano
  const atras = [];
  const lista = botes.map((b, i) => ({ ...b, x: lateral[i] })).sort((a, b) => b.dist - a.dist);
  const etiquetas = [];
  for (const b of lista) {
    if (b.dist - camZ < 4.5) { atras.push(b); continue; }
    bote3d(ctx, P, b, etiquetas, yo.dist, alto * 0.24);
  }
  // Indicador de quien viene detrás (fuera de cámara)
  atras.forEach((b, i) => {
    const txt = `${b.nombre} ${Math.round(yo.dist - b.dist)} m atrás`;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const x = ancho / 2 + (i - (atras.length - 1) / 2) * 160;
    ctx.fillStyle = 'rgba(2,6,23,0.7)';
    ctx.fillRect(x - 76, alto - 28, 152, 22);
    ctx.fillStyle = b.color;
    ctx.fillText(`▼ ${txt}`, x, alto - 12);
  });
}

function bote3d(ctx, P, b, etiquetas, miDist, techo) {
  const largo = 8;
  const proa = P(b.x, b.dist + largo * 0.5);
  const popa = P(b.x, b.dist - largo * 0.5);
  if (!proa || !popa) return;
  const anchoCasco = 0.45;
  // Estela
  if (b.v > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, popa.s * 0.03);
    for (const s of [-1, 1]) {
      const a = P(b.x + s * 0.2, b.dist - largo * 0.5);
      const z = P(b.x + s * (0.8 + b.v * 0.5), b.dist - largo * 0.5 - b.v * 3);
      if (a && z) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke(); }
    }
  }
  // Casco como polígono proyectado
  const puntos = [
    P(b.x, b.dist + largo * 0.5, 0.15),
    P(b.x + anchoCasco, b.dist, 0.15),
    P(b.x + anchoCasco * 0.4, b.dist - largo * 0.5, 0.15),
    P(b.x - anchoCasco * 0.4, b.dist - largo * 0.5, 0.15),
    P(b.x - anchoCasco, b.dist, 0.15),
  ];
  if (puntos.some((q) => !q)) return;
  ctx.globalAlpha = b.yo ? 1 : 0.88;
  ctx.fillStyle = b.color;
  ctx.beginPath();
  puntos.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fill();
  // Remos sobre el agua
  const { ang, asiento } = palada(b.fase, b.spm);
  const pivZ = b.dist - 0.4;
  const remo = 2.9;
  ctx.strokeStyle = b.color;
  for (const s of [-1, 1]) {
    const a = P(b.x + s * 0.8, pivZ, 0.35);
    const z = P(b.x + s * (0.8 + Math.cos(ang) * remo), pivZ + Math.sin(ang) * remo, b.spm && b.fase < 0.38 ? 0 : 0.25);
    if (!a || !z) continue;
    ctx.lineWidth = Math.max(1, a.s * 0.05);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke();
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.ellipse(z.x, z.y, Math.max(1.5, z.s * 0.22), Math.max(1, z.s * 0.08), 0, 0, Math.PI * 2); ctx.fill();
  }
  // Remero: torso inclinado según la palada
  const asientoZ = pivZ - 0.9 + asiento * 0.35;
  const cadera = P(b.x, asientoZ, 0.3);
  const hombro = P(b.x, asientoZ + 0.35 - asiento * 0.25, 1.0);
  if (cadera && hombro) {
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = Math.max(2, cadera.s * 0.22);
    ctx.beginPath(); ctx.moveTo(cadera.x, cadera.y); ctx.lineTo(hombro.x, hombro.y); ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath(); ctx.arc(hombro.x, hombro.y - hombro.s * 0.12, Math.max(2, hombro.s * 0.12), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Nombre sobre el bote
  if (!b.yo) {
    const q = P(b.x, b.dist, 2);
    if (q) {
      const dif = Math.round(b.dist - miDist);
      const txt = `${b.nombre} ${dif > 0 ? '+' : ''}${dif} m`;
      ctx.font = `bold ${Math.round(Math.max(11, Math.min(14, q.s * 0.5)))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const w = ctx.measureText(txt).width + 6;
      let y = q.y;
      // Si otra etiqueta ya ocupa ese sitio, esta sube un renglón.
      const choca = (yy) => etiquetas.some((e) => Math.abs(e.x - q.x) < (e.w + w) / 2 && Math.abs(e.y - yy) < 15);
      while (choca(y) && y - 15 > techo) y -= 15;
      while (choca(y)) y += 15;
      etiquetas.push({ x: q.x, y, w });
      ctx.fillStyle = 'rgba(2,6,23,0.55)';
      ctx.fillRect(q.x - w / 2, y - 12, w, 16);
      ctx.fillStyle = b.color;
      ctx.fillText(txt, q.x, y);
    }
  }
}
