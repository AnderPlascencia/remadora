// Carrera animada contra uno o varios fantasmas, en vista 2D (desde arriba) o 3D (desde atrás).
// Los datos llegan una vez por segundo; entre lecturas se interpola para que todo se mueva fluido
// a la frecuencia de pantalla. Los remos se animan al ritmo de golpes por minuto de cada bote.
import { distanciaEn } from './estadisticas.js';

const carreras = new Set();
let animando = false;
const sinMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const COLORES_RIVAL = ['#A5B4FC', '#F9A8D4', '#5EEAD4'];
const COLOR_YO = '#F2A33A';
const COLOR_RITMO = '#FACC15';
const SPRINT_M = 250;
// Fondo de la vista 3D: fila del horizonte en la imagen (ver tools/blender/paisaje/componer.py).
const PANORAMA = { src: 'assets/carrera/fiordo.webp', horizonte: 204 };
const DURA_EVENTO = 2600; // ms que se ve un aviso (adelanto, ventaja)

// Cada clase rema en su propio bote, con su bandera.
export const BOTES = {
  vikingo: { nombre: 'Drakkar vikingo', tela: '#B91C1C', marca: '#FDE68A' },
  pirata: { nombre: 'Balandra pirata', tela: '#111827', marca: '#F8FAFC' },
  samurai: { nombre: 'Barca samurái', tela: '#F8FAFC', marca: '#DC2626' },
  polinesio: { nombre: 'Canoa polinesia', tela: '#0EA5E9', marca: '#FDE047' },
  romano: { nombre: 'Trirreme romano', tela: '#7E22CE', marca: '#FACC15' },
};

// Retratos de los carriles: se cargan una vez y se pintan cuando ya llegaron.
const imagenes = new Map();
function imagen(src) {
  if (!src || typeof Image === 'undefined') return null;
  let im = imagenes.get(src);
  if (!im) {
    im = new Image();
    im.src = src;
    imagenes.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

function retrato(ctx, src, x, y, r, color) {
  const im = imagen(src);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (im) {
    ctx.clip();
    ctx.drawImage(im, x - r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

// estado: { t, pausa, yo: { dist, v, spm }, rivales: [{ nombre, color, muestras, spmEn(t), clase?, retrato?, aviso? }], meta,
//   cabecera: [l1, l2], tono, lugar?, total?, cercanos?: [{ nombre, color, m, seg, delante }], yoClase?, yoRetrato?,
//   ventajaM?, eventos?: [{ id, tipo, texto, detalle }], ritmo?: { v, etiqueta }, referencias? }
export function crearCarrera(canvas) {
  const c = {
    canvas,
    modo: '2d',
    estado: null,
    recibido: 0,
    yoVista: null,
    ventana: 80,
    zoom: 0,
    fases: [],
    vistos: null,
    yoPantalla: null,
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
    detener() { this.estado = null; this.yoVista = null; this.vistos = null; this.centro = null; this.ventanaLista = false; this.charcos = []; this.alejar = 0; },
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
  const botes = [{
    nombre: 'Tú', color: e.yoColor || COLOR_YO, dist: c.yoVista, spm: e.pausa ? 0 : e.yo.spm, v: e.pausa ? 0 : e.yo.v, yo: true,
    clase: e.yoClase || null, retrato: e.yoRetrato || null,
  }];
  e.rivales.forEach((r, i) => {
    const d = distanciaEn(r.muestras, t);
    const d2 = distanciaEn(r.muestras, t + 1);
    const v = e.pausa ? 0 : d2 - d;
    const spm = e.pausa || v <= 0 ? 0 : (r.spmEn ? r.spmEn(t) : 24);
    // Acelerón: va un 3 % más rápido que su media de los últimos 10 s.
    const media = t > 12 ? (d - distanciaEn(r.muestras, t - 10)) / 10 : 0;
    const acelera = !e.pausa && media > 0 && v > media * 1.03;
    botes.push({ nombre: r.nombre, color: r.color || COLORES_RIVAL[i % 3], dist: d, spm, v, clase: r.clase || null, retrato: r.retrato || null, aviso: r.aviso || null, acelera });
  });
  botes.forEach((b, i) => {
    c.fases[i] = ((c.fases[i] || 0) + (dt * b.spm) / 60) % 1;
    b.fase = c.fases[i];
    // Oleaje de la palada: el bote acelera al jalar y se frena al recobrar.
    if (!b.yo && b.spm && !sinMovimiento) b.dist += (b.v * 0.12 * (60 / b.spm) / (2 * Math.PI)) * Math.sin(2 * Math.PI * b.fase);
  });
  const ritmo = e.ritmo ? { dist: e.ritmo.v * t, etiqueta: e.ritmo.etiqueta } : null;
  const referencias = (e.referencias || []).map((r) => ({ dist: distanciaEn(r.muestras, t), etiqueta: r.etiqueta, discontinua: r.discontinua }));
  const falta = e.meta != null ? e.meta - c.yoVista : null;
  const sprint = falta != null && falta <= SPRINT_M && falta > 0 && !e.pausa;
  // Avisos activos: los que ya estaban al abrir la carrera no se repiten.
  if (!c.vistos) c.vistos = new Map((e.eventos || []).map((x) => [x.id, -Infinity]));
  for (const x of e.eventos || []) if (!c.vistos.has(x.id)) c.vistos.set(x.id, ahora);
  const eventos = (e.eventos || []).filter((x) => ahora - c.vistos.get(x.id) < DURA_EVENTO).map((x) => ({ ...x, edad: (ahora - c.vistos.get(x.id)) / DURA_EVENTO }));
  botes[0].brillo = eventos.some((x) => x.tipo === 'ventaja');
  return { botes, dt, t: ahora / 1000, ritmo, referencias, falta, sprint, eventos };
}

// Palada completa según la fase (0 = ataque, 0,38 = final). Empuje: piernas, luego espalda, luego brazos;
// recuperación al revés y el asiento despacio. asiento: −1 popa, +1 proa; tronco: +1 inclinado hacia la popa
// (ataque), −0,6 hacia atrás (final); brazos: 0 estirados, 1 recogidos; ang: ángulo del remo (radianes, + hacia
// la proa), que sale de dónde están las manos; agua: la pala está metida; pluma: 1 pala girada en horizontal.
const EMPUJE = 0.38;
const suave = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
function palada(fase, spm) {
  if (!spm) return { ang: -0.15, asiento: 0.6, tronco: 0, brazos: 0.3, agua: false, pluma: 1 };
  let asiento, tronco, brazos;
  if (fase < EMPUJE) {
    const p = fase / EMPUJE;
    asiento = -1 + 2 * suave(p / 0.6);
    tronco = 1 - 1.6 * suave((p - 0.25) / 0.55);
    brazos = suave((p - 0.55) / 0.45);
  } else {
    const q = (fase - EMPUJE) / (1 - EMPUJE);
    brazos = 1 - suave(q / 0.25);
    tronco = -0.6 + 1.6 * suave((q - 0.1) / 0.35);
    asiento = 1 - 2 * suave((q - 0.3) / 0.7);
  }
  const mano = 0.5 * asiento - 0.3 * tronco + 0.2 * (2 * brazos - 1); // −1 en el ataque, ≈ +0,9 en el final
  const pluma = fase < EMPUJE ? 0 : suave((fase - EMPUJE) / 0.06) * (1 - suave((fase - 0.92) / 0.08));
  return { ang: 0.125 - 0.725 * mano, asiento, tronco, brazos, agua: fase > 0.02 && fase < EMPUJE - 0.02, pluma };
}

// Colores del remero de cada clase: ropa y pelo (o tocado).
const REMEROS = {
  vikingo: { ropa: '#7C2D12', pelo: '#C2410C' },
  pirata: { ropa: '#1F2937', pelo: '#B91C1C' },
  samurai: { ropa: '#1E3A8A', pelo: '#111827' },
  polinesio: { ropa: '#0E7490', pelo: '#1C1917' },
  romano: { ropa: '#991B1B', pelo: '#A16207' },
};
const PIEL = '#E2B48C';

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
  const arriba = altoCabecera(c);
  if (c.modo === '3d') pintar3d(c, p, datos, arriba);
  else pintar2d(c, p, datos, arriba);
  sprintFinal(c, p, datos, arriba);
  avisos(c, p, datos, arriba);
  cabecera(c, p);
  minimapa(c, p, datos, arriba);
  insignia(c, p);
}

// Pequeña pastilla en la esquina que recuerda que tocar cambia de vista.
function insignia(c, { ctx, ancho }) {
  const txt = c.modo === '3d' ? 'Toca: 2D' : 'Toca: 3D';
  ctx.font = '600 11px system-ui, sans-serif';
  const w = ctx.measureText(txt).width + 14;
  const x = ancho - w - 6;
  const y = 6;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, 18, 9) : ctx.rect(x, y, w, 18);
  ctx.fill();
  ctx.fillStyle = '#CBD5E1';
  ctx.textAlign = 'center';
  ctx.fillText(txt, x + w / 2, y + 13);
}

// Alto de la cabecera más el minimapa: la pista empieza debajo.
const MINIMAPA = 16;
const ancha = (c) => (c.canvas.clientWidth || 0) >= 480;
function altoCaja(c) {
  const e = c.estado;
  // En pantallas anchas (horizontal) el reloj y la línea extra van a la derecha: la cabecera queda en dos filas.
  if (ancha(c)) return e.lugar || e.cabecera?.[1] ? 48 : 30;
  const extra = e.cabecera?.[1] ? 15 : 0;
  const reloj = e.reloj ? 20 : 0;
  return (e.lugar ? 48 : 30) + reloj + extra;
}
const altoCabecera = (c) => altoCaja(c) + MINIMAPA;

// Recorta un texto para que quepa en el ancho dado.
function cabe(ctx, txt, max) {
  if (max <= 0) return '';
  if (ctx.measureText(txt).width <= max) return txt;
  while (txt.length > 1 && ctx.measureText(`${txt}…`).width > max) txt = txt.slice(0, -1);
  return `${txt}…`;
}

const reloj = (s) => {
  const seg = Math.max(0, Math.round(s));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const ss = String(seg % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

// Escribe trozos de texto con su propio estilo uno tras otro; devuelve el ancho total.
function trozos(ctx, partes, x, y, medir = false) {
  let w = 0;
  for (const [txt, fuente, color] of partes) {
    ctx.font = fuente;
    if (!medir) { ctx.fillStyle = color; ctx.fillText(txt, x + w, y); }
    w += ctx.measureText(txt).width;
  }
  return w;
}

function partesReloj(r) {
  const p = [['⏱ ', '700 13px system-ui, sans-serif', '#CBD5E1'], [reloj(r.lleva), '800 15px system-ui, sans-serif', '#F8FAFC']];
  if (r.falta != null) {
    p.push(['   faltan ', '600 12px system-ui, sans-serif', '#CBD5E1']);
    p.push([`${r.porRitmo ? '≈' : ''}${reloj(r.falta)}`, '800 15px system-ui, sans-serif', '#FDE047']);
  }
  if (r.lugar && r.falta) p.push([`  · a este ritmo, ${r.lugar}º`, '600 12px system-ui, sans-serif', '#CBD5E1']);
  return p;
}

// En horizontal: reloj y línea extra alineados a la derecha. Devuelve hasta dónde puede llegar lo de la izquierda.
function ladoDerecho(c, ctx, ancho, l2) {
  const e = c.estado;
  let izq = ancho - 82;
  if (e.reloj) {
    const partes = partesReloj(e.reloj);
    const w = trozos(ctx, partes, 0, 0, true);
    izq = Math.min(izq, ancho - 82 - w - 10);
    trozos(ctx, partes, ancho - 82 - w, 20);
  }
  if (l2) {
    ctx.font = '600 11px system-ui, sans-serif';
    const max = Math.max(120, ancho * 0.45);
    const txt = cabe(ctx, l2, max);
    const w = ctx.measureText(txt).width;
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'left';
    ctx.fillText(txt, ancho - 10 - w, 40);
    izq = Math.min(izq, ancho - 10 - w - 10);
  }
  return izq;
}

function cabecera(c, { ctx, ancho }) {
  const e = c.estado;
  const [l1, l2] = e.cabecera || [];
  const alto = altoCaja(c);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
  ctx.fillRect(0, 0, ancho, alto + MINIMAPA);
  const color = { adelante: '#4ADE80', atras: '#FCA5A5' }[e.tono] || '#F8FAFC';
  const insigniaW = 74;
  let y = 0;
  ctx.textAlign = 'left';
  if (e.lugar) {
    // Lugar en grande a la izquierda; a la derecha, el rival de delante y el de detrás.
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText(`${e.lugar}º`, 30, 29);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`de ${e.total}`, 30, 42);
    ctx.textAlign = 'left';
    const filas = e.cercanos || [];
    // Las filas llegan como mucho hasta la pastilla de la esquina (o hasta el reloj en horizontal).
    let derecha = ancho - insigniaW - 8;
    if (ancha(c)) derecha = ladoDerecho(c, ctx, ancho, l2);
    filas.forEach((f, i) => {
      const fy = filas.length === 1 ? 27 : 19 + i * 18;
      // Sin signo: «delante» o «detrás» ya dice el lado y así no choca con el signo de los carriles (que es el del rival).
      const tiempo = f.seg >= 60 ? `${Math.floor(f.seg / 60)}:${String(f.seg % 60).padStart(2, '0')}` : `${f.seg} s`;
      const num = `${f.m.toLocaleString('es-MX')} m${f.seg != null && f.m >= 1 ? ` · ${tiempo}` : ''}`;
      const flecha = f.delante ? '▲ ' : '▼ ';
      ctx.font = '800 13px system-ui, sans-serif';
      const wNum = ctx.measureText(num).width;
      ctx.font = '600 11px system-ui, sans-serif';
      const palabra = f.delante ? ' delante' : ' detrás';
      const wPal = ctx.measureText(palabra).width;
      ctx.font = '700 12px system-ui, sans-serif';
      const wFl = ctx.measureText(flecha).width;
      const libre = derecha - 64 - wFl - wNum - 6;
      const conPalabra = ctx.measureText(f.nombre).width + wPal <= libre;
      const nombre = cabe(ctx, f.nombre, conPalabra ? libre - wPal : libre);
      trozos(ctx, [
        [flecha, '700 12px system-ui, sans-serif', f.delante ? '#FCA5A5' : '#4ADE80'],
        [`${nombre} `, '700 12px system-ui, sans-serif', f.color],
        [` ${num}`, '800 13px system-ui, sans-serif', '#F8FAFC'],
        [conPalabra ? palabra : '', '600 11px system-ui, sans-serif', '#94A3B8'],
      ], 64, fy);
    });
    y = 48;
  } else if (l1) {
    ctx.textAlign = 'center';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(cabe(ctx, l1, ancho - 2 * insigniaW - 16), ancho / 2, 21);
    y = 30;
  }
  ctx.textAlign = 'left';
  if (ancha(c)) {
    if (!e.lugar) ladoDerecho(c, ctx, ancho, l2);
    return;
  }
  if (e.reloj) {
    const partes = partesReloj(e.reloj);
    const w = trozos(ctx, partes, 0, 0, true);
    trozos(ctx, partes, Math.max(8, (ancho - w) / 2), y + 14);
    y += 20;
  }
  if (l2) {
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'center';
    ctx.fillText(cabe(ctx, l2, ancho - 16), ancho / 2, y + 10);
  }
}

// Barra fina de 0 a la meta con un punto por bote.
function minimapa(c, { ctx, ancho }, { botes, referencias }, arriba) {
  const e = c.estado;
  const y = arriba - MINIMAPA / 2;
  const x0 = 14;
  const lejos = Math.max(...botes.map((b) => b.dist), ...referencias.map((r) => r.dist));
  const fin = e.meta ?? Math.max(200, Math.ceil((lejos * 1.25) / 100) * 100);
  // Sin meta, la etiqueta del final deja su propio espacio a la derecha para no cortarse.
  ctx.font = '600 9px system-ui, sans-serif';
  const etqFin = e.meta != null ? '' : fin >= 1000 ? `${(fin / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km` : `${fin} m`;
  const x1 = ancho - (etqFin ? Math.ceil(ctx.measureText(etqFin).width) + 8 : 22);
  const X = (m) => x0 + (Math.max(0, Math.min(fin, m)) / fin) * (x1 - x0);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  if (e.meta != null) {
    // Banderita a cuadros en la meta y tramo del sprint marcado.
    ctx.strokeStyle = 'rgba(239,68,68,0.55)';
    ctx.beginPath(); ctx.moveTo(X(e.meta - SPRINT_M), y); ctx.lineTo(x1, y); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = (i + (i > 1 ? 1 : 0)) % 2 ? '#111' : '#fff';
      ctx.fillRect(x1 + 4 + (i % 2) * 4, y - 4 + Math.floor(i / 2) * 4, 4, 4);
    }
  } else {
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.fillText(etqFin, x1 + 3, y + 3);
  }
  for (const r of referencias) {
    ctx.fillStyle = COLOR_RITMO;
    ctx.fillRect(X(r.dist) - 1, y - 5, 2, 10);
  }
  for (const b of [...botes.slice(1), botes[0]]) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(X(b.dist), y, b.yo ? 5 : 3.6, 0, Math.PI * 2); ctx.fill();
    if (b.yo) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
}

// Últimos 250 m: borde que late, contador grande y, al cruzar, el puesto de llegada.
function sprintFinal(c, { ctx, ancho, alto }, { falta, sprint, t }, arriba) {
  const e = c.estado;
  if (sprint) {
    const late = sinMovimiento ? 0.5 : 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
    ctx.strokeStyle = `rgba(239,68,68,${0.35 + 0.35 * late})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, arriba + 2, ancho - 4, alto - arriba - 4);
    // Contador del sprint en una pastilla arriba al centro, sin tapar los botes.
    const txt = `${Math.ceil(falta)} m`;
    ctx.font = '900 22px system-ui, sans-serif';
    const w = ctx.measureText(txt).width + 64;
    const y = arriba + 8;
    ctx.fillStyle = `rgba(127,29,29,${0.82 + 0.1 * late})`;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(ancho / 2 - w / 2, y, w, 30, 15) : ctx.rect(ancho / 2 - w / 2, y, w, 30);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.fillStyle = '#FECACA';
    ctx.fillText('SPRINT', ancho / 2 - w / 2 + 12, y + 19);
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.fillText(txt, ancho / 2 + w / 2 - 12, y + 23);
  } else if (falta != null && falta <= 0 && e.lugar) {
    const txt = `🏁 Llegaste ${e.lugar}º de ${e.total}`;
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(txt).width + 28;
    const y = arriba + (alto - arriba) * 0.5;
    ctx.fillStyle = 'rgba(2,6,23,0.78)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(ancho / 2 - w / 2, y - 22, w, 34, 17) : ctx.rect(ancho / 2 - w / 2, y - 22, w, 34);
    ctx.fill();
    ctx.fillStyle = e.lugar === 1 ? '#FACC15' : '#F8FAFC';
    ctx.fillText(txt, ancho / 2, y);
  }
}

// Adelantos (destello y aviso al centro) y ventajas (+15 m que sube desde tu bote).
function avisos(c, { ctx, ancho, alto }, { eventos }, arriba) {
  let fila = 0;
  for (const ev of eventos) {
    const a = sinMovimiento ? 1 : Math.min(1, (1 - ev.edad) * 3);
    if (ev.tipo === 'ventaja') {
      const p = c.yoPantalla;
      if (!p) continue;
      const sube = sinMovimiento ? 0 : ev.edad * 34;
      ctx.globalAlpha = a;
      ctx.font = '900 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(2,6,23,0.8)';
      ctx.strokeText(ev.texto, p.x, p.y - 14 - sube);
      ctx.fillStyle = '#FDE047';
      ctx.fillText(ev.texto, p.x, p.y - 14 - sube);
      if (ev.detalle) {
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.strokeText(ev.detalle, p.x, p.y - 2 - sube);
        ctx.fillText(ev.detalle, p.x, p.y - 2 - sube);
      }
      ctx.globalAlpha = 1;
      continue;
    }
    const bueno = ev.tipo === 'adelanto';
    // Destello breve de toda la pista al principio del aviso.
    if (!sinMovimiento && ev.edad < 0.25) {
      ctx.fillStyle = bueno ? `rgba(74,222,128,${0.28 * (1 - ev.edad / 0.25)})` : `rgba(239,68,68,${0.28 * (1 - ev.edad / 0.25)})`;
      ctx.fillRect(0, arriba, ancho, alto - arriba);
    }
    ctx.globalAlpha = a;
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(ev.texto).width + 24;
    const y = arriba + (c.estado.meta != null && c.estado.meta - c.yoVista <= SPRINT_M ? 64 : 26) + fila * 32;
    ctx.fillStyle = bueno ? 'rgba(20,83,45,0.92)' : 'rgba(127,29,29,0.92)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(ancho / 2 - w / 2, y - 18, w, 27, 13) : ctx.rect(ancho / 2 - w / 2, y - 18, w, 27);
    ctx.fill();
    ctx.fillStyle = bueno ? '#BBF7D0' : '#FECACA';
    ctx.fillText(ev.texto, ancho / 2, y);
    ctx.globalAlpha = 1;
    fila++;
  }
}

// ---------- 2D: vista desde arriba, la cámara sigue tu bote ----------
function pintar2d(c, { ctx, ancho, alto }, { botes, dt, t, ritmo, referencias = [], sprint }, arriba) {
  const n = botes.length;
  const orilla = Math.min(14, alto * 0.05);
  const abajo = 18;
  const carril = Math.min(90, (alto - arriba - abajo - 2 * orilla) / n);
  const pista = carril * n;
  const y0 = arriba + orilla + Math.max(0, (alto - arriba - abajo - 2 * orilla - pista) / 2);
  const yo = botes[0];

  // Zoom automático: la ventana se abre para que quepan todos los botes y se centra entre el primero y el último.
  // Solo si alguno queda a más de 3 km se señala en el borde. En el sprint se acerca si no deja a nadie fuera.
  const dists = botes.map((b) => b.dist).filter((d) => Math.abs(d - yo.dist) < 3000);
  const minD = Math.min(...dists);
  const maxD = Math.max(...dists);
  const separacion = maxD - minD;
  let objetivo = Math.max(50, separacion * 1.45 + 30);
  if (sprint && separacion < 20) objetivo = Math.max(40, objetivo * 0.7);
  c.ventana += (objetivo - c.ventana) * Math.min(1, dt * 2);
  if (sinMovimiento || !c.ventanaLista) { c.ventana = objetivo; c.ventanaLista = true; }
  const ventana = c.ventana;
  // Centro relativo a tu bote, suavizado (así no tiembla con tu avance). El bote se dibuja hacia atrás desde la proa.
  const centroObj = (minD + maxD) / 2 - ventana * 0.04 - yo.dist;
  c.centro = c.centro == null || sinMovimiento ? centroObj : c.centro + (centroObj - c.centro) * Math.min(1, dt * 2);
  const X = (m) => ancho / 2 + ((m - yo.dist - c.centro) / ventana) * ancho;
  const M = (x) => yo.dist + c.centro + ((x - ancho / 2) / ancho) * ventana;
  const ppm = ancho / ventana;
  // Con la ventana muy abierta se dibujan menos olas, boyas y árboles.
  const escala = Math.max(1, ventana / 120);

  // Orillas: si sobra alto, la tierra llena el espacio en vez de dejar franjas vacías.
  const tierraArriba = Math.max(orilla, y0 - arriba);
  const tierraAbajo = Math.max(orilla, alto - abajo - (y0 + pista));
  ctx.fillStyle = '#1F3A2A';
  ctx.fillRect(0, y0 - tierraArriba, ancho, tierraArriba);
  ctx.fillRect(0, y0 + pista, ancho, alto - (y0 + pista));
  ctx.fillStyle = '#C2A878';
  ctx.fillRect(0, y0 - 3, ancho, 3);
  ctx.fillRect(0, y0 + pista, ancho, 3);
  // Árboles en la orilla, anclados al mundo (se desplazan al avanzar)
  ctx.fillStyle = '#2F6B3F';
  const pasoArbol = 9 * Math.ceil(escala);
  for (let m = Math.floor(M(0) / pasoArbol) * pasoArbol; m < M(ancho) + pasoArbol; m += pasoArbol) {
    const r = Math.min(orilla * 0.42, 6);
    ctx.beginPath(); ctx.arc(X(m), y0 - orilla / 2 - 1, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(X(m + pasoArbol / 2), y0 + pista + orilla / 2 + 1, r, 0, Math.PI * 2); ctx.fill();
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
  const pasoOla = 4 * Math.ceil(escala);
  for (let fila = 0; fila < n * 3; fila++) {
    const y = y0 + (fila + 0.5) * (pista / (n * 3));
    const desf = (fila % 2) * 2;
    for (let m = Math.floor(M(0) / pasoOla) * pasoOla + desf; m < M(ancho) + pasoOla; m += pasoOla) {
      const brillo = sinMovimiento ? 0 : Math.sin(t * 1.6 + m * 0.9 + fila);
      if (brillo < 0) continue;
      const l = Math.min(10, ppm * 1.4);
      ctx.beginPath(); ctx.arc(X(m), y + 3, l, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
  }

  // Líneas de boyas entre carriles: puntos cada 5 m, rojos cada 25 m, boya grande cada 250 m
  const pasoBoya = escala > 8 ? 50 : escala > 3 ? 25 : 5;
  for (let k = 1; k < n; k++) {
    const y = y0 + k * carril;
    for (let m = Math.floor(M(0) / pasoBoya) * pasoBoya; m < M(ancho) + pasoBoya; m += pasoBoya) {
      if (m < 0) continue;
      const grande = m % 250 === 0;
      ctx.fillStyle = grande ? '#F2A33A' : m % 25 === 0 ? '#EF4444' : 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(X(m), y, grande ? 5 : Math.min(2.6, ppm * 0.35 + 1), 0, Math.PI * 2); ctx.fill();
    }
  }

  // Marcas de distancia
  const paso = [10, 25, 50, 100, 250, 500, 1000].find((q) => ventana / q <= 6) || 2000;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let m = Math.ceil(M(0) / paso) * paso; m <= M(ancho); m += paso) {
    if (m < 0) continue;
    const x = X(m);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + pista); ctx.stroke();
    // La etiqueta que no cabe entera en el borde no se escribe (antes salía cortada).
    const etq = `${m.toLocaleString('es-MX')} m`;
    const medio = ctx.measureText(etq).width / 2;
    if (x - medio < 2 || x + medio > ancho - 2) continue;
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(etq, x, alto - 4);
  }

  // Meta
  const meta = c.estado.meta;
  if (meta != null && X(meta) > -10 && X(meta) < ancho + 10) {
    const x = X(meta);
    const q = 6;
    for (let y = y0, i = 0; y < y0 + pista; y += q, i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#111';
      ctx.fillRect(x - q, y, q, Math.min(q, y0 + pista - y));
      ctx.fillStyle = i % 2 ? '#111' : '#fff';
      ctx.fillRect(x, y, q, Math.min(q, y0 + pista - y));
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
    const der = X(ritmo.dist) > ancho;
    const dif = Math.round(ritmo.dist - yo.dist);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = der ? 'right' : 'left';
    ctx.fillStyle = COLOR_RITMO;
    ctx.fillText(`${der ? '' : '◀ '}${ritmo.etiqueta} ${dif > 0 ? '+' : '−'}${Math.abs(dif)} m${der ? ' ▶' : ''}`, der ? ancho - 6 : 6, y0 + pista - 4);
  }

  // Referencias (tu anterior, tu mejor): línea amarilla solo en tu carril, el de abajo.
  const xsRef = referencias.map((r) => X(r.dist));
  const ocupados = [];
  referencias.forEach((r, k) => {
    const yA = y0 + carril * (n - 1) + 3;
    const yB = y0 + pista - 3;
    const x = X(r.dist);
    // Si dos líneas quedan juntas, cada etiqueta va de un lado para no encimarse.
    ctx.font = 'bold 11px system-ui, sans-serif';
    const wEtq = ctx.measureText(r.etiqueta).width + 16;
    const chocaDer = xsRef.some((ox, j) => j !== k && ox > x && ox < x + wEtq);
    const chocaIzq = xsRef.some((ox, j) => j !== k && ox < x && ox > x - wEtq);
    const aLaIzq = x > ancho - wEtq || (chocaDer && !chocaIzq);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = COLOR_RITMO;
    if (x > -10 && x < ancho + 10) {
      ctx.strokeStyle = COLOR_RITMO;
      ctx.lineWidth = 3;
      ctx.setLineDash(r.discontinua ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(x, yA); ctx.lineTo(x, yB); ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = aLaIzq ? 'right' : 'left';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(2,6,23,0.7)';
      // Si aun así choca con otra etiqueta, sube un renglón.
      const x0 = aLaIzq ? x - 5 - (wEtq - 16) : x + 5;
      let ty = yB - 4;
      while (ocupados.some((o) => o.y === ty && x0 < o.x1 + 4 && x0 + wEtq - 16 > o.x0 - 4)) ty -= 13;
      ocupados.push({ x0, x1: x0 + wEtq - 16, y: ty });
      ctx.strokeText(r.etiqueta, x + (aLaIzq ? -5 : 5), ty);
      ctx.fillText(r.etiqueta, x + (aLaIzq ? -5 : 5), ty);
    } else {
      const der = x > ancho;
      const dif = Math.round(r.dist - yo.dist);
      ctx.textAlign = der ? 'right' : 'left';
      // Fuera de la ventana: aviso en el borde con fondo, para leerse aunque pase tu bote.
      const txt = `${der ? '' : '◀ '}${r.etiqueta} ${dif > 0 ? '+' : '−'}${Math.abs(dif)} m${der ? ' ▶' : ''}`;
      const w = ctx.measureText(txt).width;
      const tx = der ? ancho - 6 : 6;
      const ty = yB - 4 - k * 14;
      ctx.fillStyle = 'rgba(2,6,23,0.7)';
      ctx.fillRect(der ? tx - w - 3 : tx - 3, ty - 10, w + 6, 13);
      ctx.fillStyle = COLOR_RITMO;
      ctx.fillText(txt, tx, ty);
    }
  });

  // Remolinos que deja cada pala al salir del agua: se quedan en su sitio del lago y se borran solos.
  c.charcos = (c.charcos || []).filter((h) => t - h.t < 2.4);
  for (const h of c.charcos) {
    const x = X(h.m);
    if (x < -20 || x > ancho + 20) continue;
    const k = (t - h.t) / 2.4;
    ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - k)})`;
    ctx.lineWidth = 1.2;
    const y = y0 + carril * (h.fila + 0.58) + h.dy * carril;
    for (const r of [0.5, 1]) {
      ctx.beginPath(); ctx.ellipse(x, y, (2 + 7 * k) * r, (1.4 + 4 * k) * r, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Botes: los rivales arriba, tú en el carril de abajo
  const orden = [...botes.slice(1), botes[0]];
  c.fasePrevia = c.fasePrevia || new Map();
  orden.forEach((b, fila) => {
    const y = y0 + carril * (fila + 0.58);
    const largo = Math.max(72, Math.min(150, ppm * 10));
    const x = X(b.dist);
    // Fuera de la ventana: la flecha va dentro de la pastilla de la diferencia, sin tapar el nombre.
    const fuera = x > ancho + largo * 0.2 ? 1 : x < -largo * 0.2 ? -1 : 0;
    etiqueta2d(ctx, b, yo, y0 + carril * fila, carril, ancho, c.estado, fuera);
    if (fuera) return;
    const remo = Math.min(carril * 0.4, 34);
    const pa = bote2d(ctx, x, y, largo, remo, b, ppm, t);
    // Al pasar del final de la palada, un remolino por pala.
    const antes = c.fasePrevia.get(b.nombre);
    c.fasePrevia.set(b.nombre, b.fase);
    if (!sinMovimiento && b.spm && antes != null && antes < EMPUJE && b.fase >= EMPUJE) {
      const anchoB = Math.max(7, largo * 0.09);
      for (const lado of [-1, 1]) {
        const bx = x - largo * 0.5 + Math.sin(pa.ang) * remo;
        const by = lado * (anchoB * 0.9 + Math.cos(pa.ang) * remo);
        c.charcos.push({ m: M(bx), fila, dy: by / carril, t });
      }
    }
    if (b.yo) c.yoPantalla = { x: x - largo * 0.5, y: y - carril * 0.2 };
  });
}

// Etiqueta del carril: retrato y nombre corto a la izquierda, diferencia a la derecha.
function etiqueta2d(ctx, b, yo, yCarril, carril, ancho, e, fuera = 0) {
  const r = Math.max(6, Math.min(10, carril * 0.17));
  const y = yCarril + r + 3;
  let x = 6;
  if (b.retrato || b.clase) {
    retrato(ctx, b.retrato, x + r, y, r, b.color);
    x += r * 2 + 5;
  }
  ctx.textAlign = 'left';
  const extra = b.acelera ? ' ⚡ acelera' : b.aviso ? ` ⚡ en ${b.aviso} s` : '';
  ctx.font = 'bold 12px system-ui, sans-serif';
  const wNombre = ctx.measureText(b.nombre).width;
  ctx.font = '700 11px system-ui, sans-serif';
  const wExtra = extra ? ctx.measureText(extra).width : 0;
  // Fondo oscuro para que el nombre se lea aunque pase un bote por debajo.
  ctx.fillStyle = 'rgba(2,6,23,0.55)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - 3, y - 8, wNombre + wExtra + 8, 16, 8) : ctx.rect(x - 3, y - 8, wNombre + wExtra + 8, 16);
  ctx.fill();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = b.color;
  ctx.fillText(b.nombre, x, y + 4);
  x += wNombre;
  // Acelerón en curso o anunciado por el Mapa del rival
  if (extra) {
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(extra, x, y + 4);
  }
  // Diferencia a la derecha del carril, en una pastilla
  let txt = '';
  let color = '#F8FAFC';
  if (b.yo) {
    if ((e.ventajaM || 0) >= 1) { txt = `⚑ +${Math.round(e.ventajaM)} m`; color = '#FDE047'; }
  } else {
    const d = Math.round(b.dist - yo.dist);
    txt = d === 0 ? 'parejos' : `${fuera < 0 ? '◀ ' : ''}${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('es-MX')} m${fuera > 0 ? ' ▶' : ''}`;
    color = d > 0 ? '#FCA5A5' : d < 0 ? '#86EFAC' : '#F8FAFC';
  }
  if (!txt) return;
  ctx.font = '800 12px system-ui, sans-serif';
  const w = ctx.measureText(txt).width + 12;
  const px = ancho - w - 6;
  const py = yCarril + 3;
  ctx.fillStyle = 'rgba(2,6,23,0.6)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(px, py, w, 17, 8) : ctx.rect(px, py, w, 17);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(txt, px + w / 2, py + 13);
}

// Bandera de popa que ondea.
function bandera2d(ctx, x, y, tam, deco, t) {
  const o = sinMovimiento ? 0 : Math.sin(t * 6 + x * 0.05) * tam * 0.18;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - tam * 0.2); ctx.stroke();
  ctx.fillStyle = deco.tela;
  ctx.beginPath();
  ctx.moveTo(x, y - tam * 0.2);
  ctx.quadraticCurveTo(x - tam * 0.5, y - tam * 0.2 + o, x - tam, y - tam * 0.05 + o);
  ctx.lineTo(x - tam, y + tam * 0.35 + o);
  ctx.quadraticCurveTo(x - tam * 0.5, y + tam * 0.45 + o, x, y + tam * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = deco.marca;
  ctx.beginPath(); ctx.arc(x - tam * 0.5, y + tam * 0.1 + o * 0.6, tam * 0.14, 0, Math.PI * 2); ctx.fill();
}

function bote2d(ctx, x, y, largo, remo, b, ppm, t) {
  const deco = BOTES[b.clase];
  let ancho = Math.max(7, largo * 0.09);
  if (b.clase === 'pirata' || b.clase === 'romano') ancho *= 1.25;
  ctx.globalAlpha = b.yo ? 1 : 0.88;
  // Estela en V que crece con la velocidad; con un acelerón, más espuma.
  const estela = Math.min(largo * 1.4, b.v * ppm * 3 * (b.acelera ? 1.4 : 1));
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
  if (b.acelera) espuma2d(ctx, x, y, ancho, largo, t);
  // Brillo dorado cuando ganas metros con un talento
  if (b.brillo) {
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = sinMovimiento ? 14 : 12 + 8 * Math.sin(t * 10);
  }
  // Canoa polinesia: flotador lateral unido con dos varas
  if (b.clase === 'polinesio') {
    ctx.strokeStyle = '#E7D3A8';
    ctx.lineWidth = 1.5;
    const yAma = y - ancho * 2.6;
    for (const k of [0.3, 0.7]) { ctx.beginPath(); ctx.moveTo(x - largo * k, y); ctx.lineTo(x - largo * k, yAma); ctx.stroke(); }
    ctx.fillStyle = '#C9A46A';
    ctx.beginPath(); ctx.ellipse(x - largo * 0.5, yAma, largo * 0.32, ancho * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Trirreme: espolón de bronce en la proa
  if (b.clase === 'romano') {
    ctx.fillStyle = '#B45309';
    ctx.beginPath(); ctx.moveTo(x + largo * 0.1, y); ctx.lineTo(x - 2, y - ancho * 0.35); ctx.lineTo(x - 2, y + ancho * 0.35); ctx.fill();
  }
  // Casco (la barca samurái tiene la popa recta)
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  if (b.clase === 'samurai') {
    ctx.quadraticCurveTo(x - largo * 0.3, y - ancho, x - largo, y - ancho * 0.75);
    ctx.lineTo(x - largo, y + ancho * 0.75);
    ctx.quadraticCurveTo(x - largo * 0.3, y + ancho, x, y);
  } else {
    ctx.quadraticCurveTo(x - largo * 0.35, y - ancho, x - largo, y - ancho * 0.25);
    ctx.lineTo(x - largo, y + ancho * 0.25);
    ctx.quadraticCurveTo(x - largo * 0.35, y + ancho, x, y);
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  if (deco) {
    if (b.clase === 'vikingo') {
      // Cabeza de dragón en la proa y escudos en las bordas
      ctx.fillStyle = deco.marca;
      ctx.beginPath(); ctx.arc(x + ancho * 0.5, y, ancho * 0.45, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 5; k++) {
        const sx = x - largo * (0.22 + k * 0.13);
        for (const s of [-1, 1]) {
          ctx.fillStyle = k % 2 ? deco.tela : deco.marca;
          ctx.beginPath(); ctx.arc(sx, y + s * ancho * 0.62, Math.max(1.6, ancho * 0.28), 0, Math.PI * 2); ctx.fill();
        }
      }
    } else if (b.clase === 'pirata') {
      // Botavara y vela vistas desde arriba
      ctx.strokeStyle = '#8B5E34';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - largo * 0.3, y); ctx.lineTo(x - largo * 0.75, y - ancho * 1.4); ctx.stroke();
      ctx.fillStyle = 'rgba(241,245,249,0.85)';
      ctx.beginPath(); ctx.moveTo(x - largo * 0.3, y); ctx.quadraticCurveTo(x - largo * 0.5, y - ancho * 2.2, x - largo * 0.75, y - ancho * 1.4); ctx.closePath(); ctx.fill();
    } else if (b.clase === 'romano') {
      ctx.strokeStyle = deco.tela;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - largo * 0.15, y); ctx.lineTo(x - largo * 0.9, y); ctx.stroke();
    } else if (b.clase === 'samurai') {
      ctx.fillStyle = deco.marca;
      ctx.beginPath(); ctx.arc(x - largo * 0.82, y, ancho * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    bandera2d(ctx, x - largo + 2, y, Math.max(7, ancho * 1.5), deco, t);
  }
  // Remos y remero, vistos desde arriba: mira a la popa (izquierda) y el cuerpo mueve los remos.
  const pa = palada(b.fase, b.spm);
  const px = x - largo * 0.5; // chumaceras
  const col = REMEROS[b.clase] || { ropa: '#475569', pelo: '#334155' };
  const dentro = ancho * 1.1; // del escálamo al puño
  const pala = Math.max(3.5, ancho * 0.6);
  const manos = [];
  for (const lado of [-1, 1]) {
    const ex = px;
    const ey = y + lado * ancho * 0.9;
    const bx = ex + Math.sin(pa.ang) * remo;
    const by = ey + lado * Math.cos(pa.ang) * remo;
    const hx = ex - Math.sin(pa.ang) * dentro;
    const hy = ey - lado * Math.cos(pa.ang) * dentro;
    manos.push([hx, hy]);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(bx, by); ctx.stroke();
    // Pala: cuadrada (ancha) en el agua, girada (fina) en la recuperación; deja un remolino al salir.
    ctx.fillStyle = pa.agua ? b.color : 'rgba(226,232,240,0.95)';
    ctx.beginPath(); ctx.ellipse(bx, by, pala * 0.55, pala * (0.42 - 0.27 * pa.pluma) + 0.4, pa.ang * lado + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    if (b.spm && b.fase < 0.14 && !sinMovimiento) {
      const k = b.fase / 0.14;
      ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
      for (let g = 0; g < 5; g++) {
        const a = g * 1.3 + lado;
        ctx.beginPath(); ctx.arc(bx + Math.cos(a) * (2 + 7 * k), by + Math.sin(a) * (2 + 7 * k), 1.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Cuerpo: piernas al reposapiés, tronco que se inclina, brazos a los puños y cabeza.
  const u = ancho * 1.25; // el remero es algo más grande que el casco para que se lea
  const cadera = px + ancho * (0.6 + 0.45 * pa.asiento);
  const pie = px - ancho * 0.9;
  const tronco = u * Math.sin(pa.tronco * (pa.tronco > 0 ? 0.55 : 0.4));
  const hombro = cadera - tronco;
  const anchoH = u * 0.6;
  ctx.strokeStyle = col.ropa;
  ctx.lineWidth = Math.max(1.6, u * 0.32);
  for (const lado of [-1, 1]) {
    const rodilla = (cadera + pie) / 2 - Math.max(0, 1 - (cadera - pie) / (ancho * 2)) * ancho * 0.3;
    ctx.beginPath(); ctx.moveTo(cadera, y + lado * ancho * 0.22); ctx.lineTo(rodilla, y + lado * ancho * 0.36); ctx.lineTo(pie, y + lado * ancho * 0.28); ctx.stroke();
  }
  ctx.fillStyle = col.ropa;
  ctx.beginPath(); ctx.ellipse((cadera + hombro) / 2, y, Math.max(anchoH * 0.7, Math.abs(cadera - hombro) / 2 + anchoH * 0.5), anchoH, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PIEL;
  ctx.lineWidth = Math.max(1.2, u * 0.2);
  manos.forEach(([hx, hy], k) => {
    const sy = y + (k ? 1 : -1) * anchoH;
    const codo = [(hombro + hx) / 2 + pa.brazos * ancho * 0.25, (sy + hy) / 2 + (k ? 1 : -1) * pa.brazos * ancho * 0.35];
    ctx.beginPath(); ctx.moveTo(hombro, sy); ctx.lineTo(codo[0], codo[1]); ctx.lineTo(hx, hy); ctx.stroke();
  });
  const rc = Math.max(2.4, u * 0.4);
  ctx.fillStyle = PIEL;
  ctx.beginPath(); ctx.arc(hombro - rc * 0.3, y, rc, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col.pelo;
  ctx.beginPath(); ctx.arc(hombro - rc * 0.1, y, rc, Math.PI * 0.5, Math.PI * 1.5, true); ctx.fill();
  ctx.globalAlpha = 1;
  return pa;
}

// Espuma en la proa de un rival que acelera.
function espuma2d(ctx, x, y, ancho, largo, t) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + (sinMovimiento ? 0 : t * 9);
    const lado = i % 2 ? 1 : -1;
    const dx = -((i * 7 + (sinMovimiento ? 0 : t * 40)) % (largo * 0.5));
    ctx.beginPath();
    ctx.arc(x + dx, y + lado * (ancho * 0.9 + Math.abs(Math.sin(a)) * ancho * 0.8), 1.2 + (i % 3) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- 3D: cámara detrás de tu bote ----------
// Número pseudoaleatorio fijo para cada posición del mundo (árboles, rocas).
const ruido = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function pintar3d(c, { ctx, ancho, alto }, { botes, t, ritmo, referencias = [], sprint, dt }, arriba) {
  const yo = botes[0];
  // En el sprint la cámara se acerca y baja.
  c.zoom += ((sprint ? 1 : 0) - c.zoom) * Math.min(1, (dt || 0) * 1.5);
  if (sinMovimiento) c.zoom = sprint ? 1 : 0;
  // Si hay distancia entre botes, la cámara se aleja y sube para que se vean todos (hasta 400 m de separación).
  const cerca = botes.map((b) => b.dist).filter((d) => Math.abs(d - yo.dist) < 400);
  const atrasM = Math.max(0, yo.dist - Math.min(...cerca));
  const separacion = Math.max(...cerca) - Math.min(...cerca);
  const alejarObj = separacion > 12 ? separacion : 0;
  c.alejar = (c.alejar || 0) + (alejarObj - (c.alejar || 0)) * Math.min(1, (dt || 0) * 1.2);
  if (sinMovimiento) c.alejar = alejarObj;
  const al = c.alejar;
  const camZ = yo.dist - 13 + c.zoom * 3.5 * (al < 12 ? 1 : 0) - Math.min(atrasM, al) - al * 0.12;
  const camH = 4.6 - c.zoom * (al < 12 ? 1 : 0) + al * 0.085;
  const alcance = Math.max(300, al + 80);
  // El horizonte y la escala se calculan con el alto que queda bajo la cabecera.
  const util = alto - arriba;
  const horizonte = arriba + util * 0.34; // deja ver las montañas del panorama bajo la cabecera
  const f = Math.min(util * 1.05, ancho * 1.15);
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

  // Cielo y fondo: panorama del fiordo renderizado en Blender (tools/blender/paisaje); mientras carga, degradados.
  const cielo = ctx.createLinearGradient(0, 0, 0, horizonte);
  cielo.addColorStop(0, '#8FA6BC');
  cielo.addColorStop(1, '#C6D1DA');
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, ancho, horizonte);
  const agua = ctx.createLinearGradient(0, horizonte, 0, alto);
  agua.addColorStop(0, '#1E2E3E');
  agua.addColorStop(1, '#0A2236');
  ctx.fillStyle = agua;
  ctx.fillRect(0, horizonte, ancho, alto - horizonte);
  const fiordo = imagen(PANORAMA.src);
  if (fiordo) {
    // 360° del panorama = 2π·f píxeles, con el horizonte de la imagen sobre el del lienzo y el frente centrado.
    const k = (2 * Math.PI * f) / fiordo.naturalWidth;
    const w = fiordo.naturalWidth * k;
    const h = fiordo.naturalHeight * k;
    const y = horizonte - PANORAMA.horizonte * k;
    let x = cx - w / 2;
    while (x > 0) x -= w;
    for (; x < ancho; x += w) ctx.drawImage(fiordo, x, y, w, h);
  } else {
    ctx.fillStyle = '#244634';
    ctx.beginPath();
    ctx.moveTo(0, horizonte);
    for (let x = 0; x <= ancho; x += 20) ctx.lineTo(x, horizonte - 18 - 10 * Math.sin(x / 140) - 6 * Math.sin(x / 53));
    ctx.lineTo(ancho, horizonte);
    ctx.fill();
  }
  // Reflejo del cielo cerca del horizonte
  const reflejo = ctx.createLinearGradient(0, horizonte, 0, horizonte + alto * 0.12);
  reflejo.addColorStop(0, 'rgba(148,184,214,0.12)');
  reflejo.addColorStop(1, 'rgba(148,184,214,0)');
  ctx.fillStyle = reflejo;
  ctx.fillRect(0, horizonte, ancho, alto * 0.12);

  // Orillas (franjas a los lados del canal) con arena en el borde
  const lejos = 400;
  const bordes = { [-1]: minX - 6, 1: maxX + 6 };
  for (const s of [-1, 1]) {
    const borde = bordes[s];
    const a = P(borde, camZ + 1.2);
    const b = P(borde, camZ + lejos);
    const a2 = P(borde + s * 0.8, camZ + 1.2);
    if (!a || !b || !a2) continue;
    ctx.fillStyle = '#C2A878';
    ctx.beginPath();
    ctx.moveTo(a.x, alto); ctx.lineTo(b.x, b.y); ctx.lineTo(a2.x, alto); ctx.fill();
    ctx.fillStyle = '#1F3A2A';
    ctx.beginPath();
    ctx.moveTo(s < 0 ? 0 : ancho, alto);
    ctx.lineTo(a2.x, alto);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(s < 0 ? 0 : ancho, b.y);
    ctx.fill();
  }

  // Olas
  if (!sinMovimiento) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let z = Math.floor((camZ + 2) / 3) * 3; z < camZ + Math.min(alcance, 160); z += 3) {
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
  for (let m = Math.ceil(camZ / paso) * paso; m < camZ + alcance; m += paso) {
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
  if (meta != null && meta - camZ < alcance && meta > camZ) {
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
      // Postes con pancarta de meta
      const pa = P(minX - 2, meta, 4);
      const pb = P(maxX + 2, meta, 4);
      if (pa && pb) {
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = Math.max(1, a.s * 0.06);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pa.x, pa.y); ctx.moveTo(b.x, b.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        const alto2 = Math.max(4, a.s * 0.5);
        for (let i = 0; i < cuadros; i++) {
          ctx.fillStyle = i % 2 ? '#111' : '#fff';
          ctx.fillRect(pa.x + ((pb.x - pa.x) * i) / cuadros, pa.y, (pb.x - pa.x) / cuadros + 1, alto2);
        }
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

  // Referencias: línea amarilla de lado a lado de tu carril (el del centro). Etiquetas alternadas a izquierda y derecha.
  referencias.forEach((r, k) => {
    if (!(r.dist - camZ < 300 && r.dist > camZ + 0.5)) return;
    const a = P(-carril / 2 + 0.2, r.dist);
    const b = P(carril / 2 - 0.2, r.dist);
    if (!a || !b) return;
    ctx.strokeStyle = COLOR_RITMO;
    ctx.lineWidth = Math.max(3, a.s * 0.12);
    ctx.setLineDash(r.discontinua ? [8, 6] : []);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 12px system-ui, sans-serif';
    const izq = k % 2 === 0;
    ctx.textAlign = izq ? 'right' : 'left';
    ctx.fillStyle = COLOR_RITMO;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(2,6,23,0.7)';
    const x = izq ? a.x - 4 : b.x + 4;
    ctx.strokeText(r.etiqueta, x, a.y + 4);
    ctx.fillText(r.etiqueta, x, a.y + 4);
  });

  // Cuerdas de boyas entre carriles
  for (let k = 0; k <= botes.length; k++) {
    const x = minX + k * carril;
    for (let z = Math.ceil((camZ + 1) / 5) * 5; z < camZ + Math.max(160, al + 40); z += 5) {
      if (z < 0) continue;
      const q = P(x, z);
      if (!q) continue;
      const grande = z % 250 === 0;
      if (!grande && q.s < 2) continue;
      ctx.fillStyle = grande ? '#F2A33A' : z % 25 === 0 ? '#EF4444' : 'rgba(255,255,255,0.8)';
      // Tope de tamaño: las boyas que pasan junto a la cámara no deben tapar la parte baja de la pista.
      const r = Math.min(grande ? 9 : 4, Math.max(0.8, q.s * (grande ? 0.35 : 0.12)));
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Orilla: árboles, rocas y juncos anclados al mundo, del más lejano al más cercano
  const PASO_ARBOL = 7;
  for (let z = Math.floor((camZ + 220) / PASO_ARBOL) * PASO_ARBOL; z > camZ + 1.5; z -= PASO_ARBOL) {
    for (const s of [-1, 1]) {
      const semilla = z * 0.37 + s * 11;
      const r1 = ruido(semilla);
      const x = bordes[s] + s * (1.5 + r1 * 5);
      const zz = z + ruido(semilla + 3) * PASO_ARBOL;
      const base = P(x, zz);
      if (!base || base.x < -60 || base.x > ancho + 60) continue;
      if (r1 < 0.18) {
        // Roca
        ctx.fillStyle = '#5B6470';
        ctx.beginPath(); ctx.ellipse(base.x, base.y, base.s * 0.7, base.s * 0.35, 0, Math.PI, 0); ctx.fill();
        continue;
      }
      const altura = 3 + ruido(semilla + 7) * 4;
      const copa = P(x, zz, altura);
      if (!copa) continue;
      ctx.strokeStyle = '#4A3423';
      ctx.lineWidth = Math.max(1, base.s * 0.12);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(copa.x, copa.y + (base.y - copa.y) * 0.3); ctx.stroke();
      ctx.fillStyle = r1 > 0.6 ? '#2F6B3F' : '#245A34';
      if (r1 > 0.6) {
        // Pino
        ctx.beginPath();
        ctx.moveTo(copa.x, copa.y);
        ctx.lineTo(copa.x - base.s * 0.9, base.y - (base.y - copa.y) * 0.25);
        ctx.lineTo(copa.x + base.s * 0.9, base.y - (base.y - copa.y) * 0.25);
        ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(copa.x, copa.y + base.s * 0.5, base.s * 0.9, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Juncos al borde del agua
  ctx.strokeStyle = '#6B8F4E';
  for (let z = Math.ceil((camZ + 2) / 2) * 2; z < camZ + 60; z += 2) {
    for (const s of [-1, 1]) {
      if (ruido(z * 1.3 + s) < 0.5) continue;
      const a = P(bordes[s] + s * 0.3, z);
      const b = P(bordes[s] + s * 0.3, z, 0.9);
      if (!a || !b) continue;
      ctx.lineWidth = Math.max(0.8, a.s * 0.03);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + (sinMovimiento ? 0 : Math.sin(t * 2 + z) * a.s * 0.05), b.y); ctx.stroke();
    }
  }

  // Botes, del más lejano al más cercano
  const lista = botes.map((b, i) => ({ ...b, x: lateral[i] })).sort((a, b) => b.dist - a.dist);
  for (const b of lista) {
    // Los rivales que van justo detrás de ti se verían enormes y deformados: solo salen en la tabla.
    if (!b.yo && b.dist - camZ < 9) continue;
    if (b.yo && b.dist - camZ < 4.5) continue;
    bote3d(ctx, P, b, t);
    if (b.yo) {
      const q = P(b.x, b.dist, 0.8);
      if (q) c.yoPantalla = { x: q.x, y: q.y };
    }
  }
  tabla3d(ctx, botes, yo, arriba, ancho);
}

// Diferencias de la vista 3D: todas juntas en la esquina, ordenadas por posición (también los que van detrás
// y no salen en cámara). Sobre cada bote solo queda una marca de su color.
function tabla3d(ctx, botes, yo, arriba, ancho) {
  const filas = [...botes].sort((a, b) => b.dist - a.dist);
  const alto = 19;
  const r = 6.5;
  ctx.font = '700 12px system-ui, sans-serif';
  const maxNombre = Math.min(96, ancho * 0.24);
  const nombres = filas.map((b) => cabe(ctx, b.nombre, maxNombre));
  const wNombre = Math.max(...nombres.map((n) => ctx.measureText(n).width));
  ctx.font = '800 12px system-ui, sans-serif';
  const difs = filas.map((b) => {
    if (b.yo) return '';
    const d = Math.round(b.dist - yo.dist);
    return d === 0 ? 'parejos' : `${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('es-MX')} m`;
  });
  const wDif = Math.max(28, ...difs.map((d) => ctx.measureText(d).width));
  const w = 8 + r * 2 + 6 + wNombre + 10 + wDif + 8;
  const x0 = 6;
  const y0 = arriba + 6;
  ctx.fillStyle = 'rgba(2,6,23,0.7)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x0, y0, w, filas.length * alto + 6, 10) : ctx.rect(x0, y0, w, filas.length * alto + 6);
  ctx.fill();
  filas.forEach((b, i) => {
    const y = y0 + 3 + i * alto + alto / 2;
    if (b.yo) {
      ctx.fillStyle = 'rgba(242,163,58,0.18)';
      ctx.fillRect(x0 + 2, y - alto / 2 + 1, w - 4, alto - 2);
    }
    retrato(ctx, b.retrato, x0 + 8 + r, y, r, b.color);
    ctx.textAlign = 'left';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = b.color;
    ctx.fillText(nombres[i], x0 + 8 + r * 2 + 6, y + 4);
    if (b.acelera || b.aviso) {
      ctx.fillStyle = '#FDE047';
      ctx.fillText('⚡', x0 + 8 + r * 2 + 6 + ctx.measureText(nombres[i]).width + 2, y + 4);
    }
    if (!b.yo) {
      const d = b.dist - yo.dist;
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = Math.round(d) > 0 ? '#FCA5A5' : Math.round(d) < 0 ? '#86EFAC' : '#F8FAFC';
      ctx.fillText(difs[i], x0 + w - 8, y + 4);
    }
  });
}

// Vela cuadrada vista desde atrás: un cuadrilátero de lado a lado entre dos alturas.
function vela3d(ctx, P, x, z, mitad, h0, h1, color, alfa) {
  const q = [P(x - mitad, z, h1), P(x + mitad, z, h1), P(x + mitad, z, h0), P(x - mitad, z, h0)];
  if (q.some((p) => !p)) return null;
  const previo = ctx.globalAlpha;
  ctx.globalAlpha = alfa;
  ctx.fillStyle = color;
  ctx.beginPath();
  q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = previo;
  return q;
}

function palo3d(ctx, P, x, z, h0, h1) {
  const a = P(x, z, h0);
  const b = P(x, z, h1);
  if (!a || !b) return null;
  ctx.strokeStyle = '#8B5E34';
  ctx.lineWidth = Math.max(1, a.s * 0.05);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  return b;
}

// Detalles de cada clase sobre el casco (en 3D).
function adornos3d(ctx, P, b, largo, t) {
  const deco = BOTES[b.clase];
  const cerca = P(b.x, b.dist);
  if (!deco || !cerca) return;
  // Velas, mástiles y estandartes no se dibujan en tu bote (taparían la pista) y se desvanecen en los rivales cercanos.
  const lejania = b.yo ? 0 : Math.max(0, Math.min(1, (cerca.d - 14) / 10));
  const alfa = 0.9 * lejania;
  const altos = lejania > 0.05;
  ctx.globalAlpha = 1;
  const onda = sinMovimiento ? 0 : Math.sin(t * 5 + b.dist) * 0.12;
  if (b.clase === 'vikingo') {
    // Cuello y cabeza de dragón en la proa, escudos a los lados y vela a rayas
    const a = P(b.x, b.dist + largo * 0.5, 0.15);
    const c = P(b.x, b.dist + largo * 0.55, 1.3);
    if (a && c) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = Math.max(1.5, a.s * 0.1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x, c.y, c.x, c.y); ctx.stroke();
      ctx.fillStyle = deco.marca;
      ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(1.5, c.s * 0.14), 0, Math.PI * 2); ctx.fill();
    }
    for (let k = -2; k <= 2; k++) {
      for (const s of [-1, 1]) {
        const q = P(b.x + s * 0.42, b.dist + k * 0.9, 0.25);
        if (!q) continue;
        ctx.fillStyle = (k + 2) % 2 ? deco.tela : deco.marca;
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, q.s * 0.1), 0, Math.PI * 2); ctx.fill();
      }
    }
    if (altos) {
      ctx.globalAlpha = lejania;
      palo3d(ctx, P, b.x, b.dist + 1, 0.15, 2.4);
      for (let i = 0; i < 4; i++) vela3d(ctx, P, b.x, b.dist + 1, 0.85, 1.0 + i * 0.32, 1.32 + i * 0.32, i % 2 ? '#F8FAFC' : deco.tela, alfa);
    }
  } else if (b.clase === 'pirata' && altos) {
    // Mástil, vela triangular y bandera negra
    ctx.globalAlpha = lejania;
    const tope = palo3d(ctx, P, b.x, b.dist + 0.8, 0.15, 3.0);
    const q = [P(b.x, b.dist + 0.8, 2.8), P(b.x, b.dist + 0.8, 0.6), P(b.x + 0.1, b.dist - 2.4, 0.6)];
    if (!q.some((p) => !p)) {
      ctx.globalAlpha = alfa;
      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = lejania;
    }
    if (tope) bandera3d(ctx, tope, deco, onda);
  } else if (b.clase === 'samurai' && altos) {
    // Nobori: estandarte alto en la popa
    ctx.globalAlpha = lejania;
    const tope = palo3d(ctx, P, b.x, b.dist - largo * 0.45, 0.15, 2.6);
    if (tope) {
      const w = Math.max(3, tope.s * 0.35);
      const h = Math.max(8, tope.s * 1.1);
      ctx.fillStyle = deco.tela;
      ctx.fillRect(tope.x, tope.y, w, h);
      ctx.fillStyle = deco.marca;
      ctx.beginPath(); ctx.arc(tope.x + w / 2, tope.y + h * 0.3, w * 0.32, 0, Math.PI * 2); ctx.fill();
    }
  } else if (b.clase === 'polinesio') {
    // Flotador lateral y banderín
    const s = b.x > 0 ? 1 : -1;
    const q = [P(b.x + s * 1.4, b.dist + 2, 0.08), P(b.x + s * 1.55, b.dist, 0.08), P(b.x + s * 1.4, b.dist - 2, 0.08), P(b.x + s * 1.25, b.dist, 0.08)];
    if (!q.some((p) => !p)) {
      ctx.fillStyle = '#C9A46A';
      ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#E7D3A8';
      for (const dz of [1.2, -1.2]) {
        const a = P(b.x, b.dist + dz, 0.2);
        const z = P(b.x + s * 1.4, b.dist + dz, 0.15);
        if (a && z) { ctx.lineWidth = Math.max(1, a.s * 0.04); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke(); }
      }
    }
    if (altos) {
      ctx.globalAlpha = lejania;
      const tope = palo3d(ctx, P, b.x, b.dist - largo * 0.42, 0.15, 1.8);
      if (tope) bandera3d(ctx, tope, deco, onda);
    }
  } else if (b.clase === 'romano') {
    // Espolón y vela cuadrada púrpura
    const a = P(b.x, b.dist + largo * 0.5, 0.05);
    const z = P(b.x, b.dist + largo * 0.5 + 0.9, 0.02);
    if (a && z) {
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = Math.max(1.5, a.s * 0.12);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke();
    }
    const q = altos ? vela3d(ctx, P, b.x, b.dist + 0.6, 0.9, 1.1, 2.3, deco.tela, alfa) : null;
    if (q) {
      ctx.globalAlpha = lejania;
      palo3d(ctx, P, b.x, b.dist + 0.6, 0.15, 2.5);
      ctx.globalAlpha = alfa;
      ctx.fillStyle = deco.marca;
      const m = { x: (q[0].x + q[2].x) / 2, y: (q[0].y + q[2].y) / 2 };
      ctx.beginPath(); ctx.arc(m.x, m.y, Math.max(1.5, q[0].s * 0.18), 0, Math.PI * 2); ctx.fill();
    }
  }
  // En tu bote, en lugar de mástil, un banderín bajo en la popa.
  if (b.yo) {
    const tope = palo3d(ctx, P, b.x, b.dist - largo * 0.48, 0.15, 0.9);
    if (tope) bandera3d(ctx, tope, deco, onda);
  }
  ctx.globalAlpha = 1;
}

function bandera3d(ctx, tope, deco, onda) {
  const previo = ctx.globalAlpha;
  const w = Math.max(5, tope.s * 0.6);
  const h = Math.max(3, tope.s * 0.35);
  ctx.fillStyle = deco.tela;
  ctx.beginPath();
  ctx.moveTo(tope.x, tope.y);
  ctx.quadraticCurveTo(tope.x - w * 0.5, tope.y + h * onda * 3, tope.x - w, tope.y + h * onda * 2);
  ctx.lineTo(tope.x - w, tope.y + h + h * onda * 2);
  ctx.quadraticCurveTo(tope.x - w * 0.5, tope.y + h + h * onda * 3, tope.x, tope.y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = deco.marca;
  ctx.beginPath(); ctx.arc(tope.x - w * 0.5, tope.y + h * 0.5 + h * onda * 2, h * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = previo;
}

function bote3d(ctx, P, b, t) {
  const largo = 8;
  const proa = P(b.x, b.dist + largo * 0.5);
  const popa = P(b.x, b.dist - largo * 0.5);
  if (!proa || !popa) return;
  const anchoCasco = b.clase === 'pirata' || b.clase === 'romano' ? 0.6 : 0.45;
  // Estela en V con espuma que se abre y se desvanece
  if (b.v > 0) {
    const fuerza = b.acelera ? 1.5 : 1;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.4 - i * 0.08) * Math.min(1, b.v / 3)})`;
      ctx.lineWidth = Math.max(1, popa.s * 0.03);
      for (const s of [-1, 1]) {
        const z0 = b.dist - largo * 0.5 - i * 2.5 * fuerza;
        const a = P(b.x + s * (0.25 + i * 0.45 * fuerza), z0);
        const z = P(b.x + s * (0.7 + i * 0.45 * fuerza + b.v * 0.3), z0 - 2.5 * fuerza);
        if (a && z) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(z.x, z.y); ctx.stroke(); }
      }
    }
    // Rastro de espuma detrás de la popa
    for (let i = 0; i < 8; i++) {
      const zz = b.dist - largo * 0.5 - 0.6 - i * 1.4;
      const q = P(b.x + (sinMovimiento ? 0 : Math.sin(t * 3 + i) * 0.1), zz, 0);
      if (!q) continue;
      ctx.fillStyle = `rgba(255,255,255,${0.3 * (1 - i / 8) * Math.min(1, b.v / 3)})`;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(1, q.s * (0.25 + i * 0.05)), Math.max(0.5, q.s * 0.05), 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Ola de proa (más grande si acelera)
  if (b.v > 0) {
    const q = P(b.x, b.dist + largo * 0.5, 0.05);
    if (q) {
      ctx.fillStyle = `rgba(255,255,255,${b.acelera ? 0.8 : 0.35})`;
      const n = b.acelera ? 10 : 4;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI;
        const r = q.s * (b.acelera ? 0.5 : 0.3) * (0.7 + 0.3 * (sinMovimiento ? 1 : Math.abs(Math.sin(t * 8 + i))));
        ctx.beginPath(); ctx.arc(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r * 0.3 + q.s * 0.05, Math.max(0.8, q.s * 0.05), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Casco como polígono proyectado
  const popaAncha = b.clase === 'samurai' ? 0.85 : 0.4;
  const puntos = [
    P(b.x, b.dist + largo * 0.5, 0.15),
    P(b.x + anchoCasco, b.dist, 0.15),
    P(b.x + anchoCasco * popaAncha, b.dist - largo * 0.5, 0.15),
    P(b.x - anchoCasco * popaAncha, b.dist - largo * 0.5, 0.15),
    P(b.x - anchoCasco, b.dist, 0.15),
  ];
  if (puntos.some((q) => !q)) return;
  ctx.globalAlpha = b.yo ? 1 : 0.9;
  if (b.brillo) {
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = sinMovimiento ? 18 : 16 + 10 * Math.sin(t * 10);
  }
  ctx.fillStyle = b.color;
  ctx.beginPath();
  puntos.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // Remos sobre el agua: salen de los puños (en las manos del remero) y pasan por los escálamos.
  const pa = palada(b.fase, b.spm);
  const { ang } = pa;
  const pivZ = b.dist - 0.4;
  // Medidas para que remo y pala quepan en el carril (medio carril = 1,5): escálamo a 0,55, fuera 0,75, pala 0,14.
  const escalamo = 0.55;
  const remo = 0.75;
  const dentro = 0.6;
  const puños = [];
  for (const s of [-1, 1]) {
    const m = P(b.x + s * (escalamo - Math.cos(ang) * dentro), pivZ - Math.sin(ang) * dentro, 0.45);
    const z = P(b.x + s * (escalamo + Math.cos(ang) * remo), pivZ + Math.sin(ang) * remo, pa.agua ? 0 : 0.3);
    puños.push(m);
    if (!m || !z) continue;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = Math.max(1, m.s * 0.05);
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(z.x, z.y); ctx.stroke();
    // Pala cuadrada en el agua, girada (fina) en la recuperación
    ctx.fillStyle = pa.agua ? b.color : '#E2E8F0';
    ctx.beginPath(); ctx.ellipse(z.x, z.y, Math.max(1.5, z.s * 0.14), Math.max(0.6, z.s * (0.05 + 0.06 * (1 - pa.pluma))), 0, 0, Math.PI * 2); ctx.fill();
    // Salpicadura al meter la pala y remolino al sacarla
    if (b.spm && !sinMovimiento && (b.fase < 0.14 || (b.fase > 0.36 && b.fase < 0.46))) {
      const k = b.fase < 0.14 ? b.fase / 0.14 : (b.fase - 0.36) / 0.1;
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
      for (let g = 0; g < 6; g++) {
        const ag = -Math.PI * (0.15 + 0.7 * (g / 5));
        const r = z.s * (0.1 + 0.18 * k);
        ctx.beginPath(); ctx.arc(z.x + Math.cos(ag) * r, z.y + Math.sin(ag) * r * (1 - k * 0.5), Math.max(0.8, z.s * 0.04), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  adornos3d(ctx, P, b, largo, t);
  ctx.globalAlpha = b.yo ? 1 : 0.9;
  // Remero: mira a la popa (a la cámara); el asiento se desliza, el tronco se inclina y los brazos van a los puños.
  const col = REMEROS[b.clase] || { ropa: '#475569', pelo: '#334155' };
  const asientoZ = pivZ + 0.25 + pa.asiento * 0.3;
  const incl = pa.tronco * 0.55;
  const hombroZ = asientoZ - Math.sin(incl) * 0.7;
  const hombroH = 0.3 + Math.cos(incl) * 0.7;
  const cadera = P(b.x, asientoZ, 0.3);
  const cuello = P(b.x, hombroZ, hombroH);
  if (cadera && cuello) {
    // Piernas hacia el reposapiés (más cerca de la cámara), con la rodilla arriba al recoger
    const pie = pivZ - 0.55;
    const doblez = Math.max(0, 1 - (asientoZ - pie) / 1.1);
    ctx.strokeStyle = col.ropa;
    ctx.lineWidth = Math.max(1.5, cadera.s * 0.1);
    for (const s of [-1, 1]) {
      const r = P(b.x + s * 0.16, (asientoZ + pie) / 2, 0.3 + doblez * 0.45);
      const f = P(b.x + s * 0.14, pie, 0.2);
      if (r && f) { ctx.beginPath(); ctx.moveTo(cadera.x + s * cadera.s * 0.12, cadera.y); ctx.lineTo(r.x, r.y); ctx.lineTo(f.x, f.y); ctx.stroke(); }
    }
    ctx.lineWidth = Math.max(2.5, cadera.s * 0.3);
    ctx.beginPath(); ctx.moveTo(cadera.x, cadera.y); ctx.lineTo(cuello.x, cuello.y); ctx.stroke();
    // Brazos
    ctx.strokeStyle = PIEL;
    ctx.lineWidth = Math.max(1.2, cuello.s * 0.07);
    [-1, 1].forEach((s, k) => {
      const h = P(b.x + s * 0.24, hombroZ, hombroH - 0.05);
      const m = puños[k];
      if (!h || !m) return;
      const codo = { x: (h.x + m.x) / 2 + s * pa.brazos * cuello.s * 0.18, y: (h.y + m.y) / 2 + pa.brazos * cuello.s * 0.06 };
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(codo.x, codo.y); ctx.lineTo(m.x, m.y); ctx.stroke();
    });
    // Cabeza con pelo
    const cab = P(b.x, hombroZ - Math.sin(incl) * 0.18, hombroH + 0.22);
    if (cab) {
      const r = Math.max(2, cab.s * 0.13);
      ctx.fillStyle = PIEL;
      ctx.beginPath(); ctx.arc(cab.x, cab.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col.pelo;
      ctx.beginPath(); ctx.arc(cab.x, cab.y, r, Math.PI, 0); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Marca del color del rival sobre su bote (las diferencias van en la tabla de la esquina)
  if (!b.yo) {
    const q = P(b.x, b.dist, 1.9);
    if (q) {
      const m = Math.max(4, Math.min(7, q.s * 0.25));
      ctx.fillStyle = b.color;
      ctx.strokeStyle = 'rgba(2,6,23,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(q.x - m, q.y - m * 1.4); ctx.lineTo(q.x + m, q.y - m * 1.4); ctx.lineTo(q.x, q.y); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }
}
