// Lector PNG mínimo (sin dependencias): dimensiones, tipo de color y píxeles RGBA.
// Soporta PNG de 8 bits, no entrelazado, en escala de grises, RGB, gris+alfa y RGBA.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const FIRMA = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CANALES = { 0: 1, 2: 3, 4: 2, 6: 4 };

export function leerPng(ruta, { pixeles = true } = {}) {
  const b = readFileSync(ruta);
  if (b.length < 33 || !b.subarray(0, 8).equals(FIRMA)) throw new Error('no es un PNG válido');
  let i = 8;
  let ancho = 0, alto = 0, bits = 0, tipo = 0, entrelazado = 0;
  const datos = [];
  while (i < b.length) {
    const largo = b.readUInt32BE(i);
    const nombre = b.toString('ascii', i + 4, i + 8);
    const cuerpo = b.subarray(i + 8, i + 8 + largo);
    if (nombre === 'IHDR') {
      ancho = cuerpo.readUInt32BE(0); alto = cuerpo.readUInt32BE(4);
      bits = cuerpo[8]; tipo = cuerpo[9]; entrelazado = cuerpo[12];
    } else if (nombre === 'IDAT') datos.push(cuerpo);
    else if (nombre === 'IEND') break;
    i += 12 + largo;
  }
  const info = { ancho, alto, bits, tipo, alfa: tipo === 4 || tipo === 6 };
  if (!pixeles) return info;
  if (bits !== 8 || entrelazado || !(tipo in CANALES)) throw new Error(`formato PNG no soportado (bits ${bits}, tipo ${tipo}, entrelazado ${entrelazado})`);
  const n = CANALES[tipo];
  const crudo = inflateSync(Buffer.concat(datos));
  const fila = ancho * n;
  const salida = Buffer.alloc(ancho * alto * 4);
  let prev = Buffer.alloc(fila);
  for (let y = 0; y < alto; y++) {
    const f = crudo[y * (fila + 1)];
    const linea = Buffer.from(crudo.subarray(y * (fila + 1) + 1, (y + 1) * (fila + 1)));
    for (let x = 0; x < fila; x++) {
      const a = x >= n ? linea[x - n] : 0, up = prev[x], c = x >= n ? prev[x - n] : 0;
      if (f === 1) linea[x] = (linea[x] + a) & 255;
      else if (f === 2) linea[x] = (linea[x] + up) & 255;
      else if (f === 3) linea[x] = (linea[x] + ((a + up) >> 1)) & 255;
      else if (f === 4) {
        const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
        linea[x] = (linea[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c)) & 255;
      }
    }
    for (let x = 0; x < ancho; x++) {
      const o = (y * ancho + x) * 4, s = x * n;
      if (n === 1 || n === 2) { salida[o] = salida[o + 1] = salida[o + 2] = linea[s]; salida[o + 3] = n === 2 ? linea[s + 1] : 255; }
      else { salida[o] = linea[s]; salida[o + 1] = linea[s + 1]; salida[o + 2] = linea[s + 2]; salida[o + 3] = n === 4 ? linea[s + 3] : 255; }
    }
    prev = linea;
  }
  return { ...info, rgba: salida };
}

// Caja del contenido visible (alfa > umbral) y conteo de píxeles transparentes.
export function analizarAlfa({ ancho, alto, rgba }, umbral = 8) {
  let x0 = ancho, y0 = alto, x1 = -1, y1 = -1, transparentes = 0, opacos = 0, semi = 0;
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const a = rgba[(y * ancho + x) * 4 + 3];
    if (a === 0) transparentes++;
    else if (a === 255) opacos++;
    else semi++;
    if (a > umbral) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const total = ancho * alto;
  return { caja: x1 < 0 ? null : { x0, y0, x1, y1 }, transparentes: transparentes / total, opacos: opacos / total, semi: semi / total };
}
