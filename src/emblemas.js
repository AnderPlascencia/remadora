// Dibujo de los emblemas de la colección de bote (velas, mascarones y palas), en canvas.
// pintarTela pinta una tela entera (fondo, ribetes y emblema) en el rectángulo w×h que empieza en (0, 0).
// Los emblemas se dibujan en una caja de 24×24 centrada; las figuras son siluetas simples para que se lean de lejos.

const SILUETAS = {
  cuervos: 'M3 13c2-3 5-4 8-3l1-2 1 2c3-1 6 0 8 3l-3 1 1 3-4-2c-1 1-2 1-3 1s-2 0-3-1l-4 2 1-3z',
  lobo: 'M5 4l4 5h6l4-5 1 9-8 8-8-8z',
  calavera: 'M12 3a7 7 0 0 0-7 7c0 3 2 4 3 5v3h8v-3c1-1 3-2 3-5a7 7 0 0 0-7-7zM3 19l18 2-1 1L2 20zM21 19L3 21l1 1 18-2z',
  sables: 'M4 4l1-1 15 15 1 3-3-1zM20 4l-1-1L4 18l-1 3 3-1z',
  kraken: 'M12 3a5 5 0 0 0-5 5c0 2 1 3 2 4-3 1-5 4-6 8 2-2 4-4 6-4-1 2-1 4 0 6 1-2 2-4 3-5 1 1 2 3 3 5 1-2 1-4 0-6 2 0 4 2 6 4-1-4-3-7-6-8 1-1 2-2 2-4a5 5 0 0 0-5-5z',
  ola: 'M2 18c3 0 4-3 6-6s5-5 8-4c-2 1-3 3-2 5 1-1 3-1 4 0-2 0-3 2-2 4 2 1 4 0 6-1v4H2z',
  sakura: 'M12 4c1 2 1 4 0 6-1-2-1-4 0-6zM20 10c-2 1-4 1-6 0 2-1 4-1 6 0zM17 19c-2-1-3-3-3-5 2 1 3 3 3 5zM7 19c0-2 1-4 3-5 0 2-1 4-3 5zM4 10c2-1 4-1 6 0-2 1-4 1-6 0z',
  'dragon-tormenta': 'M3 16c3-2 5-6 9-6 2 0 3-2 3-4l3 2-1 2 3 1-3 1c-1 3-4 5-8 5-2 0-4 1-6 3z',
  tortuga: 'M12 6c4 0 6 3 6 6s-2 6-6 6-6-3-6-6 2-6 6-6zM10 3h4l-1 3h-2zM5 8l2 2-2 2-2-2zM19 8l2 2-2 2-2-2zM5 15l2 1-1 3-2-1zM19 15l-2 1 1 3 2-1z',
  manta: 'M12 6c3 0 9 3 10 7-3 0-6-1-8 0l-1 9h-2l-1-9c-2-1-5 0-8 0 1-4 7-7 10-7z',
  aguila: 'M12 5l2 3 8-3-4 6 3 1-6 2-2 6h-2l-2-6-6-2 3-1-4-6 8 3z',
  dragon: 'M6 21c0-6 2-10 5-12l-1-4 3 3 2-3v4c2 1 3 3 2 5l-3-1c-2 2-3 5-3 8z',
  sirena: 'M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 8h4l1 6-2 4 4 3h-5l-1-3-1 3H5l4-3-1-4z',
  grulla: 'M3 9c4 0 7 2 9 5l3-6 2-1 1 1-2 1-2 7c-1 3-4 4-7 3l2-2c-3 0-5-3-6-8z',
  tiki: 'M7 3h10v18H7zM9 7h2v2H9zM13 7h2v2h-2zM9 13h6v3H9z',
};

const r = (ctx, x, y, w, h) => ctx.fillRect(x, y, w, h);

function circulo(ctx, x, y, rad) { ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); }

function estrella(ctx, x, y, rad, puntas = 5) {
  ctx.beginPath();
  for (let i = 0; i < puntas * 2; i++) {
    const a = (i / (puntas * 2)) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 ? rad * 0.45 : rad;
    ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  ctx.closePath(); ctx.fill();
}

function rayos(ctx, x, y, r0, r1, n, giro = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = giro + (i / n) * Math.PI * 2;
    const b = a + Math.PI / n * 0.5;
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos((a + b) / 2) * r1, y + Math.sin((a + b) / 2) * r1);
    ctx.lineTo(x + Math.cos(b) * r0, y + Math.sin(b) * r0);
  }
  ctx.fill();
}

// Pinta el emblema en la caja de 24×24 (ya escalada y centrada por quien llama)
function emblema24(ctx, nombre, tela, marca, t) {
  ctx.fillStyle = marca;
  ctx.strokeStyle = marca;
  const sil = SILUETAS[nombre];
  if (sil && typeof Path2D !== 'undefined') {
    ctx.fill(new Path2D(sil), 'evenodd');
    // Ojos en el color de la tela
    const ojos = { lobo: [[9.5, 11, 1.2], [14.5, 11, 1.2]], calavera: [[9.5, 10, 1.7], [14.5, 10, 1.7]] }[nombre];
    if (ojos) { ctx.fillStyle = tela; ojos.forEach(([x, y, k]) => circulo(ctx, x, y, k)); }
    return;
  }
  switch (nombre) {
    case 'runas':
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(12, 12, 5, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; r(ctx, 12 + Math.cos(a) * 8 - 0.6, 12 + Math.sin(a) * 8 - 1.5, 1.2, 3); }
      break;
    case 'brasas': {
      ctx.beginPath(); ctx.moveTo(12, 3); ctx.bezierCurveTo(18, 9, 18, 14, 16, 18); ctx.bezierCurveTo(14, 21, 10, 21, 8, 18);
      ctx.bezierCurveTo(6, 14, 8, 11, 10, 9); ctx.bezierCurveTo(10, 12, 11, 13, 12, 13); ctx.bezierCurveTo(13, 9, 12, 6, 12, 3); ctx.fill();
      const s = (t || 0) * 0.6;
      for (let i = 0; i < 5; i++) circulo(ctx, 4 + ((i * 37) % 17), 20 - ((s * 10 + i * 4.3) % 18), 0.9);
      break;
    }
    case 'mon': circulo(ctx, 12, 12, 7); ctx.fillStyle = tela; circulo(ctx, 12, 12, 3); break;
    case 'sol-naciente': circulo(ctx, 12, 12, 5); rayos(ctx, 12, 12, 5, 12, 12); break;
    case 'sol': circulo(ctx, 12, 12, 5); rayos(ctx, 12, 12, 6, 10, 10); break;
    case 'sol-invicto': circulo(ctx, 12, 12, 4.5); rayos(ctx, 12, 12, 5.5, 11, 14, (t || 0) * 0.3); break;
    case 'estrellas': {
      const pts = [[6, 6, 2], [16, 5, 1.6], [12, 11, 2.4], [19, 13, 1.5], [7, 16, 1.7], [15, 19, 1.4]];
      pts.forEach(([x, y, k], i) => { ctx.globalAlpha *= 0.65 + 0.35 * Math.sin((t || 0) * 3 + i * 1.7); estrella(ctx, x, y, k, 4); ctx.globalAlpha /= 0.65 + 0.35 * Math.sin((t || 0) * 3 + i * 1.7) || 1; });
      break;
    }
    case 'spqr':
      ctx.font = 'bold 7px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SPQR', 12, 12);
      r(ctx, 3, 6, 18, 1); r(ctx, 3, 17, 18, 1);
      break;
    case 'laurel':
      ctx.lineWidth = 1.4;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(12, 12, 7, Math.PI / 2 + s * 0.3, Math.PI / 2 + s * 2.6, s < 0); ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const a = Math.PI / 2 + s * (0.6 + i * 0.45);
          ctx.beginPath(); ctx.ellipse(12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7, 2, 1, a + s * 0.8, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    case 'tapa':
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(2 + i * 5, 9); ctx.lineTo(4.5 + i * 5, 4); ctx.lineTo(7 + i * 5, 9); ctx.fill(); }
      ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i <= 8; i++) ctx.lineTo(2 + i * 2.5, i % 2 ? 13 : 16); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(2 + i * 5, 19); ctx.lineTo(4.5 + i * 5, 23); ctx.lineTo(7 + i * 5, 19); ctx.fill(); }
      break;
    // Palas
    case 'escudo':
      circulo(ctx, 12, 12, 9);
      ctx.fillStyle = tela; ctx.beginPath(); ctx.moveTo(12, 12); ctx.arc(12, 12, 9, 0, Math.PI / 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(12, 12); ctx.arc(12, 12, 9, Math.PI, Math.PI * 1.5); ctx.fill();
      ctx.fillStyle = '#94A3B8'; circulo(ctx, 12, 12, 2);
      break;
    case 'filo': ctx.fillStyle = tela; r(ctx, 7, 2, 10, 20); ctx.fillStyle = marca; r(ctx, 7, 2, 2, 20); r(ctx, 15, 2, 2, 20); r(ctx, 7, 20, 10, 2); break;
    case 'olas':
      ctx.lineWidth = 1.8;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= 12; i++) ctx.lineTo(3 + i * 1.5, 7 + k * 5 + Math.sin(i * 1.1) * 1.5); ctx.stroke(); }
      break;
    case 'rayos':
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(12 + Math.cos(a) * 3, 12 + Math.sin(a) * 3); ctx.lineTo(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10); ctx.stroke(); }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(12, 12); ctx.lineTo(12 + Math.cos(a - 0.15) * 9, 12 + Math.sin(a - 0.15) * 9); ctx.lineTo(12 + Math.cos(a) * 11, 12 + Math.sin(a) * 11); ctx.lineTo(12 + Math.cos(a + 0.15) * 9, 12 + Math.sin(a + 0.15) * 9); ctx.fill(); }
      circulo(ctx, 12, 12, 3);
      break;
    default: circulo(ctx, 12, 12, 4);
  }
}

// Fondos con dibujo propio (franjas, ribetes, parches); lo demás va liso con el emblema encima
function fondo(ctx, nombre, w, h, tela, marca) {
  ctx.fillStyle = tela; r(ctx, 0, 0, w, h);
  ctx.fillStyle = marca;
  switch (nombre) {
    case 'franjas': for (let i = 0; i < 4; i++) r(ctx, w * (0.12 + i * 0.22), 0, w * 0.1, h); return true;
    case 'ribete': { const k = Math.max(1.5, w * 0.08); r(ctx, 0, 0, w, k); r(ctx, 0, h - k, w, k); r(ctx, 0, 0, k, h); r(ctx, w - k, 0, k, h); return true; }
    case 'franja': r(ctx, 0, h * 0.42, w, h * 0.16); return true;
    case 'parches':
      ctx.globalAlpha = 0.5; r(ctx, w * 0.1, h * 0.15, w * 0.3, h * 0.18); r(ctx, w * 0.55, h * 0.55, w * 0.32, h * 0.2); r(ctx, w * 0.2, h * 0.72, w * 0.22, h * 0.14);
      ctx.globalAlpha = 1; return true;
    case 'lobo': ctx.globalAlpha = 0.55; r(ctx, 0, h * 0.04, w, h * 0.06); r(ctx, 0, h * 0.9, w, h * 0.06); ctx.globalAlpha = 1; return false;
    default: return false;
  }
}

// Tela completa (vela o estandarte) en (0,0,w,h), con pliegues verticales suaves para que no parezca un rectángulo plano
export function pintarTela(ctx, { tela, marca, emblema }, w, h, t = 0) {
  ctx.save();
  const soloFondo = fondo(ctx, emblema, w, h, tela, marca);
  if (!soloFondo) {
    const k = Math.min(w, h) * 0.9 / 24;
    ctx.save();
    ctx.translate(w / 2 - 12 * k, h * 0.5 - 12 * k);
    ctx.scale(k, k);
    emblema24(ctx, emblema, tela, marca, t);
    ctx.restore();
  }
  // Pliegues: bandas de sombra y luz
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.22)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.08)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.04)');
  g.addColorStop(1, 'rgba(0,0,0,0.24)');
  ctx.fillStyle = g; r(ctx, 0, 0, w, h);
  ctx.restore();
}

// Icono pequeño de una pieza (mascarón o palas) en la caja de 24×24 escalada a `lado`, centrado en (x, y)
export function pintarIcono(ctx, nombre, x, y, lado, tela, marca, t = 0) {
  ctx.save();
  const k = lado / 24;
  ctx.translate(x - 12 * k, y - 12 * k);
  ctx.scale(k, k);
  if (nombre === 'ojo') {
    ctx.fillStyle = tela; ctx.beginPath(); ctx.ellipse(12, 12, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = marca; ctx.beginPath(); ctx.ellipse(12, 12, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0F172A'; circulo(ctx, 12, 12, 2.6);
  } else emblema24(ctx, nombre, tela, marca, t);
  ctx.restore();
}

export const EMBLEMAS_CON_DIBUJO = [...Object.keys(SILUETAS), 'runas', 'brasas', 'mon', 'sol-naciente', 'sol', 'sol-invicto', 'estrellas', 'spqr', 'laurel', 'tapa', 'franjas', 'ribete', 'franja', 'parches', 'ojo', 'escudo', 'filo', 'olas', 'rayos'];
