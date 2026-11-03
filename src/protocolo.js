// Decodificación de los paquetes que la consola envía por la característica 1535.
// Todos los paquetes miden 20 bytes. Hay dos tipos útiles:
//  - "ff 11 00 00 00 00 00 00 00 00 ..": golpes por minuto (byte 12) y split en s/500 m (bytes 13-14).
//  - "00 12 01 04 02 (2e|30|31) ..": watts (bytes 12-13), distancia en m (bytes 14-15)
//    y resistencia (byte 11, byte alto del valor interno).

export const SERVICIO_IFIT = '00001533-1412-efde-1523-785feabcd123';
export const CARACT_ESCRITURA = '00001534-1412-efde-1523-785feabcd123';
export const CARACT_NOTIFICACION = '00001535-1412-efde-1523-785feabcd123';
export const SERVICIO_1400 = '00001400-555e-e99c-e511-f9f4f8daeb24';

export function hexABytes(hex) {
  return new Uint8Array(hex.trim().split(/\s+/).map((h) => parseInt(h, 16)));
}

export function bytesAHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

// El byte 11 es el byte alto de un valor que va de ~374 (nivel 1) a ~9958 (nivel 24),
// con un paso de 10000/24 por nivel.
export function nivelDesdeByte(r) {
  const nivel = Math.round(((r * 256 + 128 + 42) * 24) / 10000);
  return Math.min(24, Math.max(1, nivel));
}

export function parsePaquete(b) {
  if (!b || b.length !== 20) return null;

  if (b[0] === 0xff && b[1] === 0x11) {
    for (let i = 2; i <= 9; i++) if (b[i] !== 0) return null;
    const spm = b[12];
    const split = b[13] | (b[14] << 8);
    if (spm === 0 && split > 0) return null;
    return { tipo: 'remada', spm, split };
  }

  const tipoValido = b[5] === 0x2e || b[5] === 0x30 || b[5] === 0x31;
  if (b[0] === 0x00 && b[1] === 0x12 && b[2] === 0x01 && b[3] === 0x04 && b[4] === 0x02 && tipoValido) {
    let todoFF = true;
    for (let i = 12; i <= 19; i++) if (b[i] !== 0xff) todoFF = false;
    if (todoFF) return null;
    return {
      tipo: 'metricas',
      watts: b[12] | (b[13] << 8),
      distancia: b[14] | (b[15] << 8),
      resistencia: nivelDesdeByte(b[11]),
    };
  }

  return null;
}

// Paquetes falsos con el mismo formato, para el modo demo y las pruebas.
export function paqueteRemada(spm, split) {
  const b = new Uint8Array(20);
  b[0] = 0xff; b[1] = 0x11; b[12] = spm; b[13] = split & 0xff; b[14] = split >> 8;
  return b;
}

export function paqueteMetricas(watts, distancia, nivel) {
  const b = new Uint8Array(20);
  b.set([0x00, 0x12, 0x01, 0x04, 0x02, 0x30]);
  const valor = Math.floor((nivel * 10000) / 24 - 42);
  b[11] = valor >> 8;
  b[12] = watts & 0xff; b[13] = watts >> 8;
  b[14] = distancia & 0xff; b[15] = distancia >> 8;
  return b;
}

// Calorías estimadas a partir de la potencia: eficiencia mecánica del 20 %.
export function kcalPorSegundo(watts) {
  return (watts / 0.2) / 4184;
}

export function formatoSplit(seg) {
  if (!seg) return '--:--';
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatoTiempo(seg) {
  seg = Math.max(0, Math.floor(seg));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return (h ? `${h}:` : '') + `${mm}:${String(s).padStart(2, '0')}`;
}

// Medición de pulso estándar (característica 0x2A37 del servicio Heart Rate).
// Byte 0 = banderas: bit 0 pulso en 16 bits, bits 1-2 contacto con la piel, bit 3 energía, bit 4 intervalos RR.
// contacto: true/false si el sensor lo informa, null si no. rr en ms (llegan en 1/1024 s).
export function parseMedidaPulso(dv) {
  if (!dv || dv.byteLength < 2) return null;
  const banderas = dv.getUint8(0);
  let i = 1;
  const fc = banderas & 1 ? dv.getUint16(i, true) : dv.getUint8(i);
  i += banderas & 1 ? 2 : 1;
  const contacto = banderas & 0b100 ? !!(banderas & 0b10) : null;
  let energia = null;
  if (banderas & 0b1000) { energia = dv.getUint16(i, true); i += 2; }
  const rr = [];
  if (banderas & 0b10000) {
    for (; i + 1 < dv.byteLength; i += 2) rr.push(Math.round((dv.getUint16(i, true) * 1000) / 1024));
  }
  return { fc, contacto, energia, rr };
}
